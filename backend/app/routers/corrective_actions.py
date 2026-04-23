import os
from datetime import datetime, date
from typing import Optional, List
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, BackgroundTasks
from sqlalchemy.orm import Session
from pydantic import BaseModel
from ..database import get_db
from ..models.corrective_action import CorrectiveAction, ActionEvidence, ActionStatus
from ..models.user import User, UserRole
from ..services.email import send_corrective_action_notification
from ..utils.audit_trail import log_action
from ..config import settings
from .deps import get_current_user, require_admin_or_auditor

router = APIRouter(prefix="/corrective-actions", tags=["corrective_actions"])


class ActionUpdate(BaseModel):
    assigned_to: Optional[int] = None
    due_date: Optional[date] = None
    priority: Optional[str] = None
    description: Optional[str] = None
    status: Optional[ActionStatus] = None


def action_out(a: CorrectiveAction) -> dict:
    return {
        "id": a.id,
        "inspection_id": a.inspection_id,
        "clinic_id": a.clinic_id,
        "clinic_name": a.clinic.name if a.clinic else None,
        "title": a.title,
        "description": a.description,
        "status": a.status.value if a.status else None,
        "priority": a.priority,
        "assigned_to": a.assigned_to,
        "assignee_name": a.assignee.full_name if a.assignee else None,
        "due_date": str(a.due_date) if a.due_date else None,
        "requires_reinspection": a.requires_reinspection,
        "resolved_at": str(a.resolved_at) if a.resolved_at else None,
        "verified_at": str(a.verified_at) if a.verified_at else None,
        "created_at": str(a.created_at) if a.created_at else None,
        "evidence": [
            {"id": e.id, "file_name": e.file_name, "file_path": e.file_path,
             "notes": e.notes, "uploaded_at": str(e.created_at)}
            for e in (a.evidence or [])
        ],
    }


@router.get("/")
def list_actions(db: Session = Depends(get_db), current_user: User = Depends(get_current_user),
                 status: Optional[str] = None, clinic_id: Optional[int] = None):
    q = db.query(CorrectiveAction)
    if current_user.role == UserRole.manager:
        from ..models.clinic import Clinic
        managed = db.query(Clinic.id).filter(Clinic.manager_id == current_user.id).subquery()
        q = q.filter(CorrectiveAction.clinic_id.in_(managed))
    elif current_user.role == UserRole.team_member:
        q = q.filter(CorrectiveAction.assigned_to == current_user.id)
    if status:
        q = q.filter(CorrectiveAction.status == status)
    if clinic_id:
        q = q.filter(CorrectiveAction.clinic_id == clinic_id)
    actions = q.order_by(CorrectiveAction.created_at.desc()).limit(200).all()
    return [action_out(a) for a in actions]


@router.get("/{action_id}")
def get_action(action_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    action = db.query(CorrectiveAction).filter(CorrectiveAction.id == action_id).first()
    if not action:
        raise HTTPException(status_code=404, detail="Action not found")
    return action_out(action)


@router.put("/{action_id}")
async def update_action(action_id: int, payload: ActionUpdate,
                        background_tasks: BackgroundTasks,
                        db: Session = Depends(get_db),
                        current_user: User = Depends(get_current_user)):
    action = db.query(CorrectiveAction).filter(CorrectiveAction.id == action_id).first()
    if not action:
        raise HTTPException(status_code=404, detail="Action not found")

    old_assignee = action.assigned_to
    for k, v in payload.model_dump(exclude_none=True).items():
        setattr(action, k, v)

    if payload.status == ActionStatus.resolved:
        action.resolved_at = datetime.utcnow()

    db.commit()
    db.refresh(action)
    log_action(db, "corrective_action.update", user_id=current_user.id,
               resource_type="corrective_action", resource_id=action_id)
    db.commit()

    if payload.assigned_to and payload.assigned_to != old_assignee:
        user = db.query(User).filter(User.id == payload.assigned_to).first()
        if user and action.clinic:
            background_tasks.add_task(
                send_corrective_action_notification,
                user.email, user.full_name, action.title,
                action.clinic.name, str(action.due_date or "TBD"),
            )

    return action_out(action)


@router.post("/{action_id}/verify")
def verify_action(action_id: int, db: Session = Depends(get_db),
                  current_user: User = Depends(require_admin_or_auditor)):
    action = db.query(CorrectiveAction).filter(CorrectiveAction.id == action_id).first()
    if not action:
        raise HTTPException(status_code=404, detail="Action not found")
    action.status = ActionStatus.verified
    action.verified_at = datetime.utcnow()
    action.verified_by = current_user.id
    db.commit()
    log_action(db, "corrective_action.verify", user_id=current_user.id,
               resource_type="corrective_action", resource_id=action_id)
    db.commit()
    return action_out(action)


@router.post("/{action_id}/evidence")
async def upload_evidence(action_id: int, file: UploadFile = File(...),
                          notes: Optional[str] = None,
                          db: Session = Depends(get_db),
                          current_user: User = Depends(get_current_user)):
    action = db.query(CorrectiveAction).filter(CorrectiveAction.id == action_id).first()
    if not action:
        raise HTTPException(status_code=404, detail="Action not found")

    upload_dir = os.path.join(settings.upload_dir, "evidence", str(action_id))
    os.makedirs(upload_dir, exist_ok=True)

    ext = os.path.splitext(file.filename or "")[1].lower()
    filename = f"{datetime.utcnow().strftime('%Y%m%d%H%M%S')}{ext}"
    filepath = os.path.join(upload_dir, filename)

    content = await file.read()
    if len(content) > settings.max_upload_size_mb * 1024 * 1024:
        raise HTTPException(status_code=413, detail="File too large")

    with open(filepath, "wb") as f:
        f.write(content)

    rel_path = f"/uploads/evidence/{action_id}/{filename}"
    evidence = ActionEvidence(
        action_id=action_id,
        uploaded_by=current_user.id,
        file_path=rel_path,
        file_name=file.filename or filename,
        file_type=file.content_type,
        notes=notes,
    )
    db.add(evidence)
    if action.status == ActionStatus.open:
        action.status = ActionStatus.in_progress
    db.commit()
    return {"file_path": rel_path}
