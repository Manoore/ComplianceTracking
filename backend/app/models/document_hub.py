from datetime import datetime
from sqlalchemy import Column, Integer, String, Text, Boolean, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from ..database import Base

DOCUMENT_CATEGORIES = [
    "Clinical Protocol", "HR Policy", "Safety Procedure", "OSHA", "HIPAA",
    "Quality Assurance", "Operations", "Training Material", "Form / Template", "Other",
]


class HubDocument(Base):
    __tablename__ = "hub_documents"

    id = Column(Integer, primary_key=True, index=True)
    tenant_id = Column(Integer, nullable=True, index=True)
    title = Column(String, nullable=False)
    description = Column(Text, nullable=True)
    category = Column(String, nullable=True)
    tags = Column(String, nullable=True)  # comma-separated
    current_version = Column(Integer, default=1)
    file_url = Column(String, nullable=False)
    file_name = Column(String, nullable=False)
    file_size = Column(Integer, nullable=True)
    uploaded_by = Column(Integer, ForeignKey("users.id"), nullable=True)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    uploader = relationship("User", foreign_keys=[uploaded_by])
    versions = relationship("HubDocumentVersion", back_populates="document",
                            order_by="HubDocumentVersion.version_number.desc()",
                            cascade="all, delete-orphan")


class HubDocumentVersion(Base):
    __tablename__ = "hub_document_versions"

    id = Column(Integer, primary_key=True, index=True)
    document_id = Column(Integer, ForeignKey("hub_documents.id"), nullable=False)
    version_number = Column(Integer, nullable=False)
    file_url = Column(String, nullable=False)
    file_name = Column(String, nullable=False)
    change_notes = Column(Text, nullable=True)
    uploaded_by = Column(Integer, ForeignKey("users.id"), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    document = relationship("HubDocument", back_populates="versions")
    uploader = relationship("User", foreign_keys=[uploaded_by])
