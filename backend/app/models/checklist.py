import enum
from datetime import datetime
from sqlalchemy import Column, Integer, String, Boolean, DateTime, Enum, Text, ForeignKey
from sqlalchemy.orm import relationship
from ..database import Base


class ItemCategory(str, enum.Enum):
    safety = "safety"
    hygiene = "hygiene"
    equipment = "equipment"
    documentation = "documentation"
    staff = "staff"
    facility = "facility"
    regulatory = "regulatory"
    other = "other"


class ChecklistTemplate(Base):
    __tablename__ = "checklist_templates"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    description = Column(Text, nullable=True)
    is_active = Column(Boolean, default=True)
    created_by = Column(Integer, ForeignKey("users.id"))
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    creator = relationship("User", foreign_keys=[created_by])
    items = relationship("ChecklistItem", back_populates="template", cascade="all, delete-orphan", order_by="ChecklistItem.order_index")


class ChecklistItem(Base):
    __tablename__ = "checklist_items"

    id = Column(Integer, primary_key=True, index=True)
    template_id = Column(Integer, ForeignKey("checklist_templates.id"), nullable=False)
    category = Column(Enum(ItemCategory), default=ItemCategory.other)
    question = Column(Text, nullable=False)
    description = Column(Text, nullable=True)
    is_required = Column(Boolean, default=True)
    is_critical = Column(Boolean, default=False)  # critical failures block pass
    order_index = Column(Integer, default=0)
    created_at = Column(DateTime, default=datetime.utcnow)

    template = relationship("ChecklistTemplate", back_populates="items")
