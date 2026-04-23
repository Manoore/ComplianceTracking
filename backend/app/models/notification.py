import enum
from datetime import datetime
from sqlalchemy import Column, Integer, String, Boolean, DateTime, Enum, Text, ForeignKey, JSON
from sqlalchemy.orm import relationship
from ..database import Base


class NotificationType(str, enum.Enum):
    inspection_assigned = "inspection_assigned"
    inspection_due = "inspection_due"
    inspection_overdue = "inspection_overdue"
    inspection_submitted = "inspection_submitted"
    inspection_approved = "inspection_approved"
    inspection_rejected = "inspection_rejected"
    action_assigned = "action_assigned"
    action_due = "action_due"
    action_overdue = "action_overdue"
    action_resolved = "action_resolved"
    certification_assigned = "certification_assigned"
    certification_due = "certification_due"
    certification_expiring = "certification_expiring"
    certification_expired = "certification_expired"
    audit_scheduled = "audit_scheduled"
    audit_completed = "audit_completed"
    critical_finding = "critical_finding"
    announcement = "announcement"
    system = "system"


class Notification(Base):
    __tablename__ = "notifications"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    notification_type = Column(Enum(NotificationType), nullable=False)
    title = Column(String, nullable=False)
    message = Column(Text, nullable=True)
    resource_type = Column(String, nullable=True)
    resource_id = Column(Integer, nullable=True)
    extra = Column(JSON, nullable=True)   # arbitrary context data
    is_read = Column(Boolean, default=False)
    read_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, index=True)

    user = relationship("User")
