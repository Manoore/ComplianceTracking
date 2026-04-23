from datetime import datetime
from typing import List, Optional
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from ..database import get_db
from ..models.notification import Notification, NotificationType
from ..models.user import User
from .deps import get_current_user

router = APIRouter(prefix="/notifications", tags=["notifications"])


def notify(db: Session, user_id: int, notification_type: NotificationType,
           title: str, message: str = "", resource_type: str = None,
           resource_id: int = None, extra: dict = None):
    n = Notification(
        user_id=user_id,
        notification_type=notification_type,
        title=title,
        message=message,
        resource_type=resource_type,
        resource_id=resource_id,
        extra=extra,
    )
    db.add(n)


@router.get("/")
def list_notifications(db: Session = Depends(get_db),
                       current_user: User = Depends(get_current_user),
                       unread_only: bool = False, limit: int = 50):
    q = db.query(Notification).filter(Notification.user_id == current_user.id)
    if unread_only:
        q = q.filter(Notification.is_read == False)
    notifications = q.order_by(Notification.created_at.desc()).limit(limit).all()
    return [
        {
            "id": n.id,
            "type": n.notification_type.value,
            "title": n.title,
            "message": n.message,
            "resource_type": n.resource_type,
            "resource_id": n.resource_id,
            "is_read": n.is_read,
            "read_at": str(n.read_at) if n.read_at else None,
            "created_at": str(n.created_at),
        }
        for n in notifications
    ]


@router.get("/unread-count")
def unread_count(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    count = db.query(Notification).filter(
        Notification.user_id == current_user.id,
        Notification.is_read == False,
    ).count()
    return {"count": count}


@router.post("/{notification_id}/read")
def mark_read(notification_id: int, db: Session = Depends(get_db),
              current_user: User = Depends(get_current_user)):
    n = db.query(Notification).filter(
        Notification.id == notification_id,
        Notification.user_id == current_user.id,
    ).first()
    if n:
        n.is_read = True
        n.read_at = datetime.utcnow()
        db.commit()
    return {"ok": True}


@router.post("/read-all")
def mark_all_read(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    db.query(Notification).filter(
        Notification.user_id == current_user.id,
        Notification.is_read == False,
    ).update({"is_read": True, "read_at": datetime.utcnow()})
    db.commit()
    return {"ok": True}
