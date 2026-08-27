from datetime import datetime
from sqlalchemy import Column, Integer, String, Boolean, DateTime, Text, JSON, ForeignKey
from ..database import Base


class OrgSettings(Base):
    __tablename__ = "org_settings"

    id = Column(Integer, primary_key=True, index=True)
    tenant_id = Column(Integer, ForeignKey("tenants.id"), nullable=True, index=True)
    org_name = Column(String, default="My Organization")
    org_logo_url = Column(String, nullable=True)
    primary_color = Column(String, default="#1E40AF")
    secondary_color = Column(String, default="#3B82F6")

    # Email notification toggles (JSON map of NotificationType -> bool)
    email_notifications = Column(JSON, default=dict)
    # Reminder schedule config
    cert_reminder_days = Column(JSON, default=lambda: [3, 7, 14])
    cert_expiry_warning_days = Column(JSON, default=lambda: [7, 14, 30])
    action_overdue_escalation_days = Column(Integer, default=3)

    # SSO config (sensitive — store encrypted in production)
    sso_enabled = Column(Boolean, default=False)
    sso_provider = Column(String, nullable=True)
    sso_client_id = Column(String, nullable=True)
    sso_discovery_url = Column(String, nullable=True)

    # Data retention
    inspection_retention_days = Column(Integer, default=2555)  # 7 years
    audit_log_retention_days = Column(Integer, default=2555)

    # Backup
    backup_enabled = Column(Boolean, default=True)
    backup_frequency = Column(String, default="daily")  # daily/weekly
    backup_retention_count = Column(Integer, default=30)

    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
