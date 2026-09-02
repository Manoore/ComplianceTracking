import enum
from datetime import datetime
from sqlalchemy import Column, Integer, String, Boolean, DateTime, Float, ForeignKey, Text, Enum, JSON
from sqlalchemy.orm import relationship
from ..database import Base


class ClinicType(str, enum.Enum):
    general_practice = "general_practice"
    dental = "dental"
    lab = "lab"
    pharmacy = "pharmacy"
    specialist = "specialist"
    urgent_care = "urgent_care"
    mental_health = "mental_health"
    physical_therapy = "physical_therapy"
    radiology = "radiology"
    other = "other"


class Clinic(Base):
    __tablename__ = "clinics"

    id = Column(Integer, primary_key=True, index=True)
    tenant_id = Column(Integer, ForeignKey("tenants.id"), nullable=True, index=True)
    name = Column(String, nullable=False)
    clinic_type = Column(Enum(ClinicType), default=ClinicType.general_practice, nullable=True)
    address = Column(String, nullable=True)
    city = Column(String, nullable=True)
    state = Column(String, nullable=True)
    zip_code = Column(String, nullable=True)
    phone = Column(String, nullable=True)
    email = Column(String, nullable=True)
    website = Column(String, nullable=True)
    manager_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    is_active = Column(Boolean, default=True)
    notes = Column(Text, nullable=True)
    # Geo-location
    lat = Column(Float, nullable=True)
    lng = Column(Float, nullable=True)
    # Operating hours stored as JSON: {"mon": "09:00-17:00", "tue": "09:00-17:00", ...}
    operating_hours = Column(JSON, nullable=True)
    # Branding / org info
    license_number = Column(String, nullable=True)
    accreditation = Column(String, nullable=True)
    department_id = Column(Integer, ForeignKey("departments.id"), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    manager = relationship("User", foreign_keys=[manager_id])
    department = relationship("Department", foreign_keys=[department_id], back_populates="clinics")
    inspections = relationship("Inspection", back_populates="clinic", cascade="all, delete-orphan")
    staff = relationship("ClinicStaff", back_populates="clinic", cascade="all, delete-orphan")


class ClinicStaff(Base):
    """Many-to-many between Clinic and User (staff assignments)."""
    __tablename__ = "clinic_staff"

    id = Column(Integer, primary_key=True, index=True)
    clinic_id = Column(Integer, ForeignKey("clinics.id"), nullable=False)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    role_note = Column(String, nullable=True)
    assigned_at = Column(DateTime, default=datetime.utcnow)

    clinic = relationship("Clinic", back_populates="staff")
    user = relationship("User")
