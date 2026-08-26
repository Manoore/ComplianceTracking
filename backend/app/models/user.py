import enum
from datetime import datetime
from sqlalchemy import Column, Integer, String, Boolean, DateTime, Enum
from ..database import Base


class UserRole(str, enum.Enum):
    admin = "admin"
    manager = "manager"
    auditor = "auditor"
    team_member = "team_member"


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String, unique=True, index=True, nullable=False)
    full_name = Column(String, nullable=False)
    hashed_password = Column(String, nullable=True)  # null for SSO-only users
    role = Column(Enum(UserRole), default=UserRole.team_member, nullable=False)
    custom_role = Column(String(50), nullable=True)  # overrides role for permission lookup
    is_active = Column(Boolean, default=True)
    sso_subject = Column(String, nullable=True, unique=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    last_login = Column(DateTime, nullable=True)
    avatar_url = Column(String, nullable=True)
