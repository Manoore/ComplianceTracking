import enum
from datetime import datetime
from sqlalchemy import Column, Integer, String, Boolean, DateTime, Enum, Text, ForeignKey, Float, JSON
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


class ItemType(str, enum.Enum):
    pass_fail_na = "pass_fail_na"   # original default
    yes_no = "yes_no"
    text_input = "text_input"
    numeric = "numeric"             # plain numeric entry
    numeric_range = "numeric_range" # numeric with pass/fail min–max bounds
    photo = "photo"                 # photo capture required
    signature = "signature"         # single e-signature
    dual_signoff = "dual_signoff"   # two independent signers required
    document_upload = "document_upload"  # file attachment required
    date_picker = "date_picker"
    multiple_choice = "multiple_choice"


class ChecklistTemplate(Base):
    __tablename__ = "checklist_templates"

    id = Column(Integer, primary_key=True, index=True)
    tenant_id = Column(Integer, ForeignKey("tenants.id"), nullable=True, index=True)
    name = Column(String, nullable=False)
    description = Column(Text, nullable=True)
    is_active = Column(Boolean, default=True)
    is_preset = Column(Boolean, default=False)   # system-provided preset
    preset_category = Column(String, nullable=True)  # e.g. "OSHA", "HIPAA"
    version = Column(Integer, default=1)
    parent_template_id = Column(Integer, ForeignKey("checklist_templates.id"), nullable=True)  # cloned from
    created_by = Column(Integer, ForeignKey("users.id"))
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    creator = relationship("User", foreign_keys=[created_by])
    sections = relationship("ChecklistSection", back_populates="template",
                            cascade="all, delete-orphan", order_by="ChecklistSection.order_index")
    items = relationship("ChecklistItem", back_populates="template",
                         cascade="all, delete-orphan", order_by="ChecklistItem.order_index")


class ChecklistSection(Base):
    """Optional grouping of items within a template."""
    __tablename__ = "checklist_sections"

    id = Column(Integer, primary_key=True, index=True)
    template_id = Column(Integer, ForeignKey("checklist_templates.id"), nullable=False)
    title = Column(String, nullable=False)
    description = Column(Text, nullable=True)
    order_index = Column(Integer, default=0)

    template = relationship("ChecklistTemplate", back_populates="sections")
    items = relationship("ChecklistItem", back_populates="section",
                         order_by="ChecklistItem.order_index")


class ChecklistItem(Base):
    __tablename__ = "checklist_items"

    id = Column(Integer, primary_key=True, index=True)
    template_id = Column(Integer, ForeignKey("checklist_templates.id"), nullable=False)
    section_id = Column(Integer, ForeignKey("checklist_sections.id"), nullable=True)
    item_type = Column(Enum(ItemType), default=ItemType.pass_fail_na)
    category = Column(Enum(ItemCategory), default=ItemCategory.other)
    question = Column(Text, nullable=False)
    description = Column(Text, nullable=True)
    reference_url = Column(String, nullable=True)   # link to guideline/doc
    is_required = Column(Boolean, default=True)
    is_critical = Column(Boolean, default=False)
    weight = Column(Float, default=1.0)             # weighted scoring
    # For numeric type: {"min": 0, "max": 100, "unit": "°F"}
    # For multiple_choice: {"options": ["A", "B", "C"], "correct": "A"}
    type_config = Column(JSON, nullable=True)
    # Conditional: {"if_item_id": 5, "if_answer": "fail", "action": "show"}
    conditional_logic = Column(JSON, nullable=True)
    # Accreditation standard tags: ["OSHA", "HIPAA", "AAAHC"]
    standard_tags = Column(JSON, nullable=True)
    order_index = Column(Integer, default=0)
    created_at = Column(DateTime, default=datetime.utcnow)

    template = relationship("ChecklistTemplate", back_populates="items")
    section = relationship("ChecklistSection", back_populates="items")
