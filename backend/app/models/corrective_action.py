import enum
from datetime import datetime
from sqlalchemy import Column, Integer, String, Boolean, DateTime, Enum, Text, ForeignKey, Date, JSON
from sqlalchemy.orm import relationship
from ..database import Base


class ActionStatus(str, enum.Enum):
    open = "open"
    in_progress = "in_progress"
    resolved = "resolved"
    verified = "verified"
    overdue = "overdue"
    closed = "closed"


class CorrectiveAction(Base):
    __tablename__ = "corrective_actions"

    id = Column(Integer, primary_key=True, index=True)
    inspection_id = Column(Integer, ForeignKey("inspections.id"), nullable=False)
    inspection_item_id = Column(Integer, ForeignKey("inspection_items.id"), nullable=False)
    clinic_id = Column(Integer, ForeignKey("clinics.id"), nullable=False)
    assigned_to = Column(Integer, ForeignKey("users.id"), nullable=True)
    created_by = Column(Integer, ForeignKey("users.id"), nullable=False)

    title = Column(String, nullable=False)
    description = Column(Text, nullable=True)
    status = Column(Enum(ActionStatus), default=ActionStatus.open)
    priority = Column(String, default="medium")  # low/medium/high/critical
    due_date = Column(Date, nullable=True)
    requires_reinspection = Column(Boolean, default=False)

    resolved_at = Column(DateTime, nullable=True)
    verified_at = Column(DateTime, nullable=True)
    verified_by = Column(Integer, ForeignKey("users.id"), nullable=True)

    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    inspection = relationship("Inspection", back_populates="corrective_actions")
    inspection_item = relationship("InspectionItem")
    clinic = relationship("Clinic")
    assignee = relationship("User", foreign_keys=[assigned_to])
    creator = relationship("User", foreign_keys=[created_by])
    verifier = relationship("User", foreign_keys=[verified_by])
    evidence = relationship("ActionEvidence", back_populates="action", cascade="all, delete-orphan")


class ActionEvidence(Base):
    __tablename__ = "action_evidence"

    id = Column(Integer, primary_key=True, index=True)
    action_id = Column(Integer, ForeignKey("corrective_actions.id"), nullable=False)
    uploaded_by = Column(Integer, ForeignKey("users.id"), nullable=False)
    file_path = Column(String, nullable=False)
    file_name = Column(String, nullable=False)
    file_type = Column(String, nullable=True)
    notes = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    action = relationship("CorrectiveAction", back_populates="evidence")
    uploader = relationship("User", foreign_keys=[uploaded_by])
