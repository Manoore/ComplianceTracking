import os
from datetime import datetime
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, Request
from sqlalchemy.orm import Session
from pydantic import BaseModel
from ..database import get_db
from ..models.inspection import Inspection, InspectionItem, InspectionStatus, ItemResult
from ..models.checklist import ChecklistItem
from ..models.corrective_action import CorrectiveAction, ActionStatus
from ..models.user import User, UserRole
from ..services.scoring import calculate_compliance_score
from ..utils.audit_trail import log_action
from ..config import settings
from .deps import get_current_user, require_admin_or_auditor

router = APIRouter(prefix="/inspections", tags=["inspections"])


class InspectionCreate(BaseModel):
    clinic_id: int
    template_id: int
    checkin_lat: Optional[float] = None
    checkin_lng: Optional[float] = None


class ItemUpdate(BaseModel):
    result: ItemResult
    notes: Optional[str] = None


class CheckoutPayload(BaseModel):
    checkout_lat: Optional[float] = None
    checkout_lng: Optional[float] = None
    notes: Optional[str] = None


def inspection_out(insp: Inspection) -> dict:
    return {
        "id": insp.id,
        "clinic_id": insp.clinic_id,
        "clinic_name": insp.clinic.name if insp.clinic else None,
        "template_id": insp.template_id,
        "template_name": insp.template.name if insp.template else None,
        "inspector_id": insp.inspector_id,
        "inspector_name": insp.inspector.full_name if insp.inspector else None,
        "status": insp.status.value if insp.status else None,
        "compliance_score": insp.compliance_score,
        "risk_level": insp.risk_level,
        "checkin_time": str(insp.checkin_time) if insp.checkin_time else None,
        "checkout_time": str(insp.checkout_time) if insp.checkout_time else None,
        "checkin_lat": insp.checkin_lat,
        "checkin_lng": insp.checkin_lng,
        "notes": insp.notes,
        "submitted_at": str(insp.submitted_at) if insp.submitted_at else None,
        "created_at": str(insp.created_at) if insp.created_at else None,
        "items": [
            {
                "id": i.id,
                "checklist_item_id": i.checklist_item_id,
                "question": i.checklist_item.question if i.checklist_item else None,
                "category": i.checklist_item.category.value if i.checklist_item and i.checklist_item.category else None,
                "is_critical": i.checklist_item.is_critical if i.checklist_item else False,
                "result": i.result.value if i.result else None,
                "notes": i.notes,
                "photo_urls": i.photo_urls or [],
            }
            for i in (insp.items or [])
        ],
    }


@router.get("/")
def list_inspections(db: Session = Depends(get_db), current_user: User = Depends(get_current_user),
                     clinic_id: Optional[int] = None, status: Optional[str] = None):
    q = db.query(Inspection)
    if current_user.role == UserRole.manager:
        from ..models.clinic import Clinic
        managed = db.query(Clinic.id).filter(Clinic.manager_id == current_user.id).subquery()
        q = q.filter(Inspection.clinic_id.in_(managed))
    elif current_user.role == UserRole.team_member:
        q = q.filter(Inspection.inspector_id == current_user.id)
    if clinic_id:
        q = q.filter(Inspection.clinic_id == clinic_id)
    if status:
        q = q.filter(Inspection.status == status)
    return [inspection_out(i) for i in q.order_by(Inspection.created_at.desc()).limit(200).all()]


@router.post("/", status_code=201)
def create_inspection(payload: InspectionCreate, db: Session = Depends(get_db),
                      current_user: User = Depends(get_current_user)):
    from ..models.checklist import ChecklistTemplate
    template = db.query(ChecklistTemplate).filter(ChecklistTemplate.id == payload.template_id).first()
    if not template:
        raise HTTPException(status_code=404, detail="Template not found")

    insp = Inspection(
        clinic_id=payload.clinic_id,
        template_id=payload.template_id,
        inspector_id=current_user.id,
        status=InspectionStatus.in_progress,
        tenant_id=current_user.tenant_id,
        checkin_time=datetime.utcnow(),
        checkin_lat=payload.checkin_lat,
        checkin_lng=payload.checkin_lng,
    )
    db.add(insp)
    db.flush()

    for ci in template.items:
        db.add(InspectionItem(inspection_id=insp.id, checklist_item_id=ci.id))

    db.commit()
    db.refresh(insp)
    log_action(db, "inspection.create", user_id=current_user.id, resource_type="inspection", resource_id=insp.id)
    db.commit()
    return inspection_out(insp)


@router.get("/{inspection_id}")
def get_inspection(inspection_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    insp = db.query(Inspection).filter(Inspection.tenant_id == current_user.tenant_id,Inspection.id == inspection_id).first()
    if not insp:
        raise HTTPException(status_code=404, detail="Inspection not found")
    return inspection_out(insp)


@router.put("/{inspection_id}/items/{item_id}")
def update_item(inspection_id: int, item_id: int, payload: ItemUpdate,
                db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    insp = db.query(Inspection).filter(Inspection.id == inspection_id).first()
    if not insp:
        raise HTTPException(status_code=404, detail="Inspection not found")
    if insp.inspector_id != current_user.id and current_user.role not in [UserRole.admin]:
        raise HTTPException(status_code=403, detail="Forbidden")
    if insp.status not in [InspectionStatus.draft, InspectionStatus.in_progress]:
        raise HTTPException(status_code=400, detail="Inspection already submitted")

    item = db.query(InspectionItem).filter(
        InspectionItem.id == item_id, InspectionItem.inspection_id == inspection_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")

    item.result = payload.result
    item.notes = payload.notes
    item.answered_at = datetime.utcnow()
    db.commit()
    return {"status": "ok"}


@router.post("/{inspection_id}/items/{item_id}/photos")
async def upload_photo(inspection_id: int, item_id: int,
                       file: UploadFile = File(...),
                       db: Session = Depends(get_db),
                       current_user: User = Depends(get_current_user)):
    insp = db.query(Inspection).filter(Inspection.id == inspection_id).first()
    if not insp or insp.inspector_id != current_user.id:
        raise HTTPException(status_code=403, detail="Forbidden")

    item = db.query(InspectionItem).filter(
        InspectionItem.id == item_id, InspectionItem.inspection_id == inspection_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")

    ext = os.path.splitext(file.filename or "")[1].lower()
    if ext not in [".jpg", ".jpeg", ".png", ".webp"]:
        raise HTTPException(status_code=400, detail="Only image files allowed")

    upload_dir = os.path.join(settings.upload_dir, "inspections", str(inspection_id))
    os.makedirs(upload_dir, exist_ok=True)
    filename = f"{item_id}_{datetime.utcnow().strftime('%Y%m%d%H%M%S')}{ext}"
    filepath = os.path.join(upload_dir, filename)

    content = await file.read()
    if len(content) > settings.max_upload_size_mb * 1024 * 1024:
        raise HTTPException(status_code=413, detail="File too large")

    with open(filepath, "wb") as f:
        f.write(content)

    urls = list(item.photo_urls or [])
    urls.append(f"/uploads/inspections/{inspection_id}/{filename}")
    item.photo_urls = urls
    db.commit()
    return {"url": urls[-1]}


@router.post("/{inspection_id}/checkout")
def checkout(inspection_id: int, payload: CheckoutPayload,
             db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    insp = db.query(Inspection).filter(Inspection.id == inspection_id).first()
    if not insp or insp.inspector_id != current_user.id:
        raise HTTPException(status_code=403, detail="Forbidden")
    insp.checkout_time = datetime.utcnow()
    insp.checkout_lat = payload.checkout_lat
    insp.checkout_lng = payload.checkout_lng
    if payload.notes:
        insp.notes = payload.notes
    db.commit()
    return {"status": "ok"}


@router.post("/{inspection_id}/submit")
def submit_inspection(inspection_id: int, db: Session = Depends(get_db),
                      current_user: User = Depends(get_current_user)):
    insp = db.query(Inspection).filter(Inspection.id == inspection_id).first()
    if not insp:
        raise HTTPException(status_code=404, detail="Inspection not found")
    if insp.inspector_id != current_user.id and current_user.role != UserRole.admin:
        raise HTTPException(status_code=403, detail="Forbidden")
    if insp.status not in [InspectionStatus.draft, InspectionStatus.in_progress]:
        raise HTTPException(status_code=400, detail="Already submitted")

    checklist_items = db.query(ChecklistItem).filter(ChecklistItem.template_id == insp.template_id).all()
    result = calculate_compliance_score(insp.items, checklist_items)
    insp.compliance_score = result["score"]
    insp.risk_level = result["risk_level"]
    insp.status = InspectionStatus.submitted
    insp.submitted_at = datetime.utcnow()

    # Auto-generate corrective actions for failed items
    for item in insp.items:
        if item.result == ItemResult.fail and item.checklist_item:
            ci = item.checklist_item
            action = CorrectiveAction(
                inspection_id=insp.id,
                inspection_item_id=item.id,
                clinic_id=insp.clinic_id,
                created_by=current_user.id,
                title=f"Corrective Action: {ci.question[:100]}",
                priority="high" if ci.is_critical else "medium",
                requires_reinspection=ci.is_critical,
            )
            db.add(action)

    db.commit()
    db.refresh(insp)
    log_action(db, "inspection.submit", user_id=current_user.id, resource_type="inspection", resource_id=inspection_id,
               details={"score": result["score"], "risk": result["risk_level"]})
    db.commit()
    return inspection_out(insp)
