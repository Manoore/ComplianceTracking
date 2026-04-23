import os
from datetime import datetime, date
from typing import Optional, List
from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from sqlalchemy.orm import Session
from pydantic import BaseModel
from ..database import get_db
from ..models.audit import AuditCycle, AuditAssignment, AuditReview, AuditStatus
from ..models.inspection import Inspection, InspectionStatus
from ..models.user import User, UserRole
from ..services import pdf as pdf_service
from ..utils.audit_trail import log_action
from ..config import settings
from .deps import get_current_user, require_admin, require_admin_or_auditor

router = APIRouter(prefix="/audits", tags=["audits"])


class CycleCreate(BaseModel):
    name: str
    description: Optional[str] = None
    start_date: date
    end_date: date
    is_recurring: bool = False
    recurrence_days: Optional[int] = None


class AssignmentCreate(BaseModel):
    clinic_id: int
    auditor_id: int
    due_date: Optional[date] = None


class ReviewPayload(BaseModel):
    status: AuditStatus
    findings: Optional[str] = None
    risk_score: Optional[float] = None
    risk_level: Optional[str] = None


def review_out(r: AuditReview) -> dict:
    return {
        "id": r.id,
        "inspection_id": r.inspection_id,
        "auditor_id": r.auditor_id,
        "auditor_name": r.auditor.full_name if r.auditor else None,
        "status": r.status.value if r.status else None,
        "findings": r.findings,
        "risk_score": r.risk_score,
        "risk_level": r.risk_level,
        "report_path": r.report_path,
        "reviewed_at": str(r.reviewed_at) if r.reviewed_at else None,
        "created_at": str(r.created_at) if r.created_at else None,
    }


@router.get("/cycles")
def list_cycles(db: Session = Depends(get_db), _=Depends(require_admin_or_auditor)):
    cycles = db.query(AuditCycle).order_by(AuditCycle.start_date.desc()).all()
    return [{"id": c.id, "name": c.name, "start_date": str(c.start_date),
             "end_date": str(c.end_date), "is_recurring": c.is_recurring} for c in cycles]


@router.post("/cycles", status_code=201)
def create_cycle(payload: CycleCreate, db: Session = Depends(get_db), current_user: User = Depends(require_admin)):
    cycle = AuditCycle(**payload.model_dump(), created_by=current_user.id)
    db.add(cycle)
    db.commit()
    db.refresh(cycle)
    return {"id": cycle.id, "name": cycle.name}


@router.post("/cycles/{cycle_id}/assignments", status_code=201)
def add_assignment(cycle_id: int, payload: AssignmentCreate, db: Session = Depends(get_db),
                   current_user: User = Depends(require_admin)):
    cycle = db.query(AuditCycle).filter(AuditCycle.id == cycle_id).first()
    if not cycle:
        raise HTTPException(status_code=404, detail="Cycle not found")
    assignment = AuditAssignment(cycle_id=cycle_id, **payload.model_dump())
    db.add(assignment)
    db.commit()
    return {"id": assignment.id}


@router.get("/reviews")
def list_reviews(db: Session = Depends(get_db), current_user: User = Depends(get_current_user),
                 status: Optional[str] = None):
    q = db.query(AuditReview)
    if current_user.role == UserRole.auditor:
        q = q.filter(AuditReview.auditor_id == current_user.id)
    if status:
        q = q.filter(AuditReview.status == status)
    reviews = q.order_by(AuditReview.created_at.desc()).limit(200).all()
    return [review_out(r) for r in reviews]


@router.post("/reviews", status_code=201)
def create_review(inspection_id: int, db: Session = Depends(get_db),
                  current_user: User = Depends(require_admin_or_auditor)):
    insp = db.query(Inspection).filter(Inspection.id == inspection_id).first()
    if not insp:
        raise HTTPException(status_code=404, detail="Inspection not found")
    if insp.status != InspectionStatus.submitted:
        raise HTTPException(status_code=400, detail="Inspection is not submitted yet")
    existing = db.query(AuditReview).filter(AuditReview.inspection_id == inspection_id).first()
    if existing:
        return review_out(existing)

    review = AuditReview(inspection_id=inspection_id, auditor_id=current_user.id)
    db.add(review)
    insp.status = InspectionStatus.under_review
    db.commit()
    db.refresh(review)
    log_action(db, "audit.review.create", user_id=current_user.id, resource_type="audit_review", resource_id=review.id)
    db.commit()
    return review_out(review)


@router.put("/reviews/{review_id}")
def update_review(review_id: int, payload: ReviewPayload,
                  background_tasks: BackgroundTasks,
                  db: Session = Depends(get_db),
                  current_user: User = Depends(require_admin_or_auditor)):
    review = db.query(AuditReview).filter(AuditReview.id == review_id).first()
    if not review:
        raise HTTPException(status_code=404, detail="Review not found")
    if current_user.role == UserRole.auditor and review.auditor_id != current_user.id:
        raise HTTPException(status_code=403, detail="Forbidden")

    review.status = payload.status
    review.findings = payload.findings
    review.risk_score = payload.risk_score
    review.risk_level = payload.risk_level
    review.reviewed_at = datetime.utcnow()

    insp = review.inspection
    if payload.status == AuditStatus.approved:
        insp.status = InspectionStatus.approved
    elif payload.status == AuditStatus.rejected:
        insp.status = InspectionStatus.rejected

    db.commit()
    log_action(db, f"audit.review.{payload.status.value}", user_id=current_user.id,
               resource_type="audit_review", resource_id=review_id)
    db.commit()
    return review_out(review)


@router.post("/reviews/{review_id}/report")
def generate_report(review_id: int, background_tasks: BackgroundTasks,
                    db: Session = Depends(get_db),
                    current_user: User = Depends(require_admin_or_auditor)):
    review = db.query(AuditReview).filter(AuditReview.id == review_id).first()
    if not review:
        raise HTTPException(status_code=404, detail="Review not found")

    output_dir = os.path.join(settings.upload_dir, "reports")
    filepath = pdf_service.generate_audit_report(
        review.inspection, review, review.inspection.items, output_dir)
    rel_path = os.path.relpath(filepath, settings.upload_dir)
    review.report_path = f"/uploads/{rel_path}"
    db.commit()
    log_action(db, "audit.report.generate", user_id=current_user.id,
               resource_type="audit_review", resource_id=review_id)
    db.commit()
    return {"report_path": review.report_path}


@router.get("/trail")
def audit_trail(db: Session = Depends(get_db), _=Depends(require_admin_or_auditor),
                resource_type: Optional[str] = None, resource_id: Optional[int] = None,
                limit: int = 100):
    from ..models.audit_trail import AuditTrail
    q = db.query(AuditTrail)
    if resource_type:
        q = q.filter(AuditTrail.resource_type == resource_type)
    if resource_id:
        q = q.filter(AuditTrail.resource_id == resource_id)
    entries = q.order_by(AuditTrail.timestamp.desc()).limit(limit).all()
    return [
        {
            "id": e.id,
            "user_id": e.user_id,
            "user_name": e.user.full_name if e.user else "System",
            "action": e.action,
            "resource_type": e.resource_type,
            "resource_id": e.resource_id,
            "details": e.details,
            "ip_address": e.ip_address,
            "timestamp": str(e.timestamp),
        }
        for e in entries
    ]
