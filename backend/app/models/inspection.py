import enum
from datetime import datetime
from sqlalchemy import Column, Integer, String, Boolean, DateTime, Enum, Text, ForeignKey, Float, JSON
from sqlalchemy.orm import relationship
from ..database import Base


class InspectionStatus(str, enum.Enum):
    draft = "draft"
    in_progress = "in_progress"
    submitted = "submitted"
    under_review = "under_review"
    approved = "approved"
    rejected = "rejected"


class ItemResult(str, enum.Enum):
    pass_ = "pass"
    fail = "fail"
    na = "na"
    pending = "pending"


class Inspection(Base):
    __tablename__ = "inspections"

    id = Column(Integer, primary_key=True, index=True)
    clinic_id = Column(Integer, ForeignKey("clinics.id"), nullable=False)
    template_id = Column(Integer, ForeignKey("checklist_templates.id"), nullable=False)
    inspector_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    status = Column(Enum(InspectionStatus), default=InspectionStatus.draft)
    compliance_score = Column(Float, nullable=True)
    risk_level = Column(String, nullable=True)  # low/medium/high/critical

    checkin_time = Column(DateTime, nullable=True)
    checkout_time = Column(DateTime, nullable=True)
    checkin_lat = Column(Float, nullable=True)
    checkin_lng = Column(Float, nullable=True)
    checkout_lat = Column(Float, nullable=True)
    checkout_lng = Column(Float, nullable=True)

    notes = Column(Text, nullable=True)
    submitted_at = Column(DateTime, nullable=True)
    synced_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    clinic = relationship("Clinic", back_populates="inspections")
    template = relationship("ChecklistTemplate")
    inspector = relationship("User", foreign_keys=[inspector_id])
    items = relationship("InspectionItem", back_populates="inspection", cascade="all, delete-orphan")
    corrective_actions = relationship("CorrectiveAction", back_populates="inspection", cascade="all, delete-orphan")


class InspectionItem(Base):
    __tablename__ = "inspection_items"

    id = Column(Integer, primary_key=True, index=True)
    inspection_id = Column(Integer, ForeignKey("inspections.id"), nullable=False)
    checklist_item_id = Column(Integer, ForeignKey("checklist_items.id"), nullable=False)
    result = Column(Enum(ItemResult), default=ItemResult.pending)
    notes = Column(Text, nullable=True)
    photo_urls = Column(JSON, default=list)  # list of file paths
    answered_at = Column(DateTime, nullable=True)

    inspection = relationship("Inspection", back_populates="items")
    checklist_item = relationship("ChecklistItem")
