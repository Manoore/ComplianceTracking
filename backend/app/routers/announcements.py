from datetime import datetime
from typing import Optional, List
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from ..database import get_db
from ..models.announcement import Announcement, AnnouncementRead
from ..models.user import User
from ..utils.audit_trail import log_action
from .deps import get_current_user, require_admin

router = APIRouter(prefix="/announcements", tags=["announcements"])


class AnnouncementCreate(BaseModel):
    title: str
    body: str
    target: str = "all"
    is_pinned: bool = False
    requires_acknowledgment: bool = False
    attachments: List[dict] = []


class AnnouncementUpdate(BaseModel):
    title: Optional[str] = None
    body: Optional[str] = None
    is_pinned: Optional[bool] = None
    is_active: Optional[bool] = None


def ann_out(a: Announcement, user_id: int) -> dict:
    read = next((r for r in (a.reads or []) if r.user_id == user_id), None)
    return {
        "id": a.id,
        "title": a.title,
        "body": a.body,
        "target": a.target,
        "is_pinned": a.is_pinned,
        "requires_acknowledgment": a.requires_acknowledgment,
        "attachments": a.attachments or [],
        "is_active": a.is_active,
        "published_at": str(a.published_at) if a.published_at else None,
        "created_by": a.created_by,
        "creator_name": a.creator.full_name if a.creator else None,
        "created_at": str(a.created_at),
        "read_count": len(a.reads) if a.reads else 0,
        "is_read": read is not None,
        "is_acknowledged": read.acknowledged if read else False,
    }


@router.get("/")
def list_announcements(db: Session = Depends(get_db),
                       current_user: User = Depends(get_current_user)):
    q = db.query(Announcement).filter(Announcement.is_active == True)
    announcements = q.order_by(Announcement.is_pinned.desc(), Announcement.created_at.desc()).limit(100).all()
    return [ann_out(a, current_user.id) for a in announcements]


@router.post("/", status_code=201)
def create_announcement(payload: AnnouncementCreate,
                         db: Session = Depends(get_db),
                         current_user: User = Depends(require_admin)):
    ann = Announcement(
        created_by=current_user.id,
        title=payload.title,
        body=payload.body,
        target=payload.target,
        is_pinned=payload.is_pinned,
        requires_acknowledgment=payload.requires_acknowledgment,
        attachments=payload.attachments,
        published_at=datetime.utcnow(),
    )
    db.add(ann)
    db.commit()
    db.refresh(ann)
    log_action(db, "announcement.create", user_id=current_user.id,
               resource_type="announcement", resource_id=ann.id)
    db.commit()
    return ann_out(ann, current_user.id)


@router.put("/{ann_id}")
def update_announcement(ann_id: int, payload: AnnouncementUpdate,
                         db: Session = Depends(get_db),
                         current_user: User = Depends(require_admin)):
    ann = db.query(Announcement).filter(Announcement.id == ann_id).first()
    if not ann:
        raise HTTPException(status_code=404, detail="Announcement not found")
    for k, v in payload.model_dump(exclude_none=True).items():
        setattr(ann, k, v)
    db.commit()
    return ann_out(ann, current_user.id)


@router.delete("/{ann_id}", status_code=204)
def delete_announcement(ann_id: int, db: Session = Depends(get_db),
                         current_user: User = Depends(require_admin)):
    ann = db.query(Announcement).filter(Announcement.id == ann_id).first()
    if not ann:
        raise HTTPException(status_code=404, detail="Not found")
    ann.is_active = False
    db.commit()


@router.post("/{ann_id}/read")
def mark_read(ann_id: int, db: Session = Depends(get_db),
              current_user: User = Depends(get_current_user)):
    ann = db.query(Announcement).filter(Announcement.id == ann_id).first()
    if not ann:
        raise HTTPException(status_code=404, detail="Not found")
    existing = db.query(AnnouncementRead).filter(
        AnnouncementRead.announcement_id == ann_id,
        AnnouncementRead.user_id == current_user.id,
    ).first()
    if not existing:
        db.add(AnnouncementRead(announcement_id=ann_id, user_id=current_user.id))
        db.commit()
    return {"ok": True}


@router.post("/{ann_id}/acknowledge")
def acknowledge(ann_id: int, db: Session = Depends(get_db),
                current_user: User = Depends(get_current_user)):
    record = db.query(AnnouncementRead).filter(
        AnnouncementRead.announcement_id == ann_id,
        AnnouncementRead.user_id == current_user.id,
    ).first()
    if not record:
        record = AnnouncementRead(announcement_id=ann_id, user_id=current_user.id)
        db.add(record)
    record.acknowledged = True
    record.acknowledged_at = datetime.utcnow()
    db.commit()
    return {"ok": True}


@router.get("/{ann_id}/reads")
def get_reads(ann_id: int, db: Session = Depends(get_db),
              current_user: User = Depends(require_admin)):
    reads = db.query(AnnouncementRead).filter(AnnouncementRead.announcement_id == ann_id).all()
    return [
        {
            "user_id": r.user_id,
            "user_name": r.user.full_name if r.user else None,
            "acknowledged": r.acknowledged,
            "acknowledged_at": str(r.acknowledged_at) if r.acknowledged_at else None,
            "read_at": str(r.read_at),
        }
        for r in reads
    ]
