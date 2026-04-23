from datetime import datetime, timedelta
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from sqlalchemy import func
import io
from ..database import get_db
from ..models.inspection import Inspection, InspectionStatus
from ..models.corrective_action import CorrectiveAction, ActionStatus
from ..models.certification import TeamCertification, CertStatus
from ..models.clinic import Clinic
from ..models.user import User
from .deps import get_current_user, require_admin_or_auditor

router = APIRouter(prefix="/reports", tags=["reports"])


@router.get("/dashboard")
def dashboard(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    from ..models.user import UserRole
    now = datetime.utcnow()
    thirty_days_ago = now - timedelta(days=30)

    q_insp = db.query(Inspection)
    q_actions = db.query(CorrectiveAction)
    q_certs = db.query(TeamCertification)

    if current_user.role == UserRole.manager:
        managed_ids = db.query(Clinic.id).filter(Clinic.manager_id == current_user.id).subquery()
        q_insp = q_insp.filter(Inspection.clinic_id.in_(managed_ids))
        q_actions = q_actions.filter(CorrectiveAction.clinic_id.in_(managed_ids))

    total_inspections = q_insp.count()
    approved_inspections = q_insp.filter(Inspection.status == InspectionStatus.approved).count()
    pending_review = q_insp.filter(Inspection.status.in_([InspectionStatus.submitted, InspectionStatus.under_review])).count()

    avg_score = db.query(func.avg(Inspection.compliance_score)).filter(
        Inspection.compliance_score.isnot(None)).scalar()

    open_actions = q_actions.filter(CorrectiveAction.status.in_([ActionStatus.open, ActionStatus.in_progress])).count()
    overdue_actions = q_actions.filter(
        CorrectiveAction.status.in_([ActionStatus.open, ActionStatus.in_progress]),
        CorrectiveAction.due_date < now.date(),
    ).count()

    total_certs = q_certs.count()
    completed_certs = q_certs.filter(TeamCertification.status == CertStatus.completed).count()
    overdue_certs = q_certs.filter(
        TeamCertification.status.notin_([CertStatus.completed]),
        TeamCertification.expires_at < now,
    ).count()

    # Recent inspections with scores
    recent = q_insp.filter(Inspection.compliance_score.isnot(None)).order_by(
        Inspection.submitted_at.desc()).limit(10).all()

    # Score by clinic
    clinics = db.query(Clinic).filter(Clinic.is_active == True).all()
    clinic_scores = []
    for c in clinics:
        latest = db.query(Inspection).filter(
            Inspection.clinic_id == c.id,
            Inspection.compliance_score.isnot(None),
        ).order_by(Inspection.submitted_at.desc()).first()
        if latest:
            clinic_scores.append({
                "clinic_id": c.id,
                "clinic_name": c.name,
                "score": latest.compliance_score,
                "risk_level": latest.risk_level,
                "last_inspection": str(latest.submitted_at) if latest.submitted_at else None,
            })

    # Trend: last 6 months avg score
    trend = []
    for i in range(5, -1, -1):
        start = (now - timedelta(days=30 * (i + 1))).replace(day=1)
        end = (now - timedelta(days=30 * i)).replace(day=1)
        avg = db.query(func.avg(Inspection.compliance_score)).filter(
            Inspection.submitted_at >= start,
            Inspection.submitted_at < end,
            Inspection.compliance_score.isnot(None),
        ).scalar()
        trend.append({"month": start.strftime("%b %Y"), "avg_score": round(avg or 0, 1)})

    return {
        "summary": {
            "total_inspections": total_inspections,
            "approved_inspections": approved_inspections,
            "pending_review": pending_review,
            "avg_compliance_score": round(avg_score or 0, 1),
            "open_corrective_actions": open_actions,
            "overdue_corrective_actions": overdue_actions,
            "total_certifications": total_certs,
            "completed_certifications": completed_certs,
            "overdue_certifications": overdue_certs,
        },
        "clinic_scores": clinic_scores,
        "trend": trend,
        "recent_inspections": [
            {
                "id": i.id,
                "clinic_name": i.clinic.name if i.clinic else None,
                "score": i.compliance_score,
                "risk_level": i.risk_level,
                "status": i.status.value if i.status else None,
                "submitted_at": str(i.submitted_at) if i.submitted_at else None,
            }
            for i in recent
        ],
    }


@router.get("/compliance-trends")
def compliance_trends(clinic_id: Optional[int] = None, days: int = 180,
                      db: Session = Depends(get_db), _=Depends(get_current_user)):
    from sqlalchemy import and_
    now = datetime.utcnow()
    since = now - timedelta(days=days)
    q = db.query(Inspection).filter(
        Inspection.submitted_at >= since,
        Inspection.compliance_score.isnot(None),
    )
    if clinic_id:
        q = q.filter(Inspection.clinic_id == clinic_id)
    inspections = q.order_by(Inspection.submitted_at).all()
    return [
        {
            "date": str(i.submitted_at.date()) if i.submitted_at else None,
            "score": i.compliance_score,
            "risk_level": i.risk_level,
            "clinic_name": i.clinic.name if i.clinic else None,
        }
        for i in inspections
    ]


@router.get("/export/csv")
def export_csv(resource: str = "inspections", db: Session = Depends(get_db),
               _=Depends(require_admin_or_auditor)):
    import csv
    output = io.StringIO()
    writer = csv.writer(output)

    if resource == "inspections":
        writer.writerow(["ID", "Clinic", "Inspector", "Score", "Risk", "Status", "Submitted"])
        rows = db.query(Inspection).filter(Inspection.compliance_score.isnot(None)).all()
        for r in rows:
            writer.writerow([r.id, r.clinic.name if r.clinic else "", r.inspector.full_name if r.inspector else "",
                              r.compliance_score, r.risk_level, r.status.value if r.status else "", r.submitted_at])
    elif resource == "actions":
        writer.writerow(["ID", "Clinic", "Title", "Status", "Priority", "Due Date", "Assignee"])
        rows = db.query(CorrectiveAction).all()
        for r in rows:
            writer.writerow([r.id, r.clinic.name if r.clinic else "", r.title, r.status.value if r.status else "",
                              r.priority, r.due_date, r.assignee.full_name if r.assignee else ""])
    elif resource == "certifications":
        writer.writerow(["ID", "Name", "Email", "Course", "Score", "Status", "Completed", "Expires"])
        rows = db.query(TeamCertification).all()
        for r in rows:
            writer.writerow([r.id, r.participant_name, r.participant_email,
                              r.course.title if r.course else "", r.score, r.status.value if r.status else "",
                              r.completed_at, r.expires_at])

    output.seek(0)
    return StreamingResponse(
        io.BytesIO(output.getvalue().encode()),
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename={resource}.csv"},
    )
