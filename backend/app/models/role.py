from sqlalchemy import Column, Integer, String, Boolean, ForeignKey, UniqueConstraint
from sqlalchemy.orm import relationship
from ..database import Base

ALL_MODULES = [
    "clinics", "checklists", "inspections", "audits", "certifications",
    "corrective_actions", "policies", "executive", "departments", "credentials",
    "document_hub", "standards", "announcements", "reports",
]

DEFAULT_PERMISSIONS = {
    "manager": ["clinics", "inspections", "audits", "certifications", "corrective_actions",
                "policies", "executive", "departments", "credentials", "document_hub", "standards", "announcements"],
    "auditor": ["clinics", "inspections", "audits", "certifications", "corrective_actions",
                "policies", "executive", "credentials", "document_hub", "standards", "announcements", "reports"],
    "team_member": ["inspections", "certifications", "corrective_actions", "policies",
                    "credentials", "document_hub", "announcements"],
}

SYSTEM_ROLES = {
    "admin": "Admin",
    "manager": "Manager",
    "auditor": "Auditor",
    "team_member": "Team Member",
}


class Role(Base):
    __tablename__ = "roles"
    id = Column(Integer, primary_key=True)
    name = Column(String(50), nullable=False)
    display_name = Column(String(100), nullable=False)
    is_system = Column(Boolean, default=False)
    tenant_id = Column(Integer, ForeignKey("tenants.id"), nullable=True, index=True)
    permissions = relationship("RolePermission", back_populates="role", cascade="all, delete-orphan")
    __table_args__ = (UniqueConstraint("name", "tenant_id", name="uq_role_name_tenant"),)


class RolePermission(Base):
    __tablename__ = "role_permissions"
    id = Column(Integer, primary_key=True)
    role_id = Column(Integer, ForeignKey("roles.id", ondelete="CASCADE"), nullable=False)
    module = Column(String(50), nullable=False)
    role = relationship("Role", back_populates="permissions")
    __table_args__ = (UniqueConstraint("role_id", "module"),)
