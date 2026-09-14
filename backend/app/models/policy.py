from datetime import datetime
from sqlalchemy import Column, Integer, String, Text, Boolean, DateTime, ForeignKey, Float, JSON
from sqlalchemy.orm import relationship
from ..database import Base


class PolicyDocument(Base):
    __tablename__ = "policy_documents"

    id = Column(Integer, primary_key=True, index=True)
    tenant_id = Column(Integer, nullable=True)
    title = Column(String, nullable=False)
    description = Column(Text, nullable=True)
    content = Column(Text, nullable=False)
    version = Column(String, default="1.0")
    category = Column(String, nullable=True)
    # Plain JSON (not the Postgres-only JSONB) so this table can also be created on
    # SQLite, which is the default local-dev database -- SQLAlchemy's JSON type still
    # works fine against an existing Postgres JSONB column in production.
    target_roles = Column(JSON, default=list)  # e.g. ["admin", "team_member"]
    is_published = Column(Boolean, default=False)
    requires_quiz = Column(Boolean, default=False)
    quiz_questions = Column(JSON, nullable=True)  # [{question, options, answer_index}]
    pass_threshold = Column(Integer, default=80)  # percentage
    effective_date = Column(DateTime, nullable=True)
    published_by = Column(Integer, ForeignKey("users.id"), nullable=True)
    published_at = Column(DateTime, nullable=True)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    publisher = relationship("User", foreign_keys=[published_by])
    attestations = relationship("PolicyAttestation", back_populates="policy", cascade="all, delete-orphan")


class PolicyAttestation(Base):
    __tablename__ = "policy_attestations"

    id = Column(Integer, primary_key=True, index=True)
    policy_id = Column(Integer, ForeignKey("policy_documents.id"), nullable=False)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    status = Column(String, default="pending")  # pending | read | signed | quiz_failed
    read_at = Column(DateTime, nullable=True)
    signed_at = Column(DateTime, nullable=True)
    quiz_score = Column(Float, nullable=True)
    quiz_passed = Column(Boolean, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    policy = relationship("PolicyDocument", back_populates="attestations")
    user = relationship("User", foreign_keys=[user_id])
