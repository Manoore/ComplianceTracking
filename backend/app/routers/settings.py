from typing import Optional, List
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from sqlalchemy.orm import Session
from pydantic import BaseModel
from ..database import get_db
from ..models.org_settings import OrgSettings
from .deps import require_admin, get_current_user

router = APIRouter(prefix="/settings", tags=["settings"])


class OrgSettingsUpdate(BaseModel):
    org_name: Optional[str] = None
    primary_color: Optional[str] = None
    secondary_color: Optional[str] = None
    email_notifications: Optional[dict] = None
    cert_reminder_days: Optional[List[int]] = None
    cert_expiry_warning_days: Optional[List[int]] = None
    action_overdue_escalation_days: Optional[int] = None
    sso_enabled: Optional[bool] = None
    sso_provider: Optional[str] = None
    sso_client_id: Optional[str] = None
    sso_discovery_url: Optional[str] = None
    inspection_retention_days: Optional[int] = None
    audit_log_retention_days: Optional[int] = None
    backup_enabled: Optional[bool] = None
    backup_frequency: Optional[str] = None
    backup_retention_count: Optional[int] = None
    compliance_green_threshold: Optional[int] = None
    compliance_amber_threshold: Optional[int] = None


def _get_or_create(db: Session) -> OrgSettings:
    s = db.query(OrgSettings).first()
    if not s:
        s = OrgSettings()
        db.add(s)
        db.commit()
        db.refresh(s)
    return s


def settings_out(s: OrgSettings) -> dict:
    return {
        "org_name": s.org_name,
        "org_logo_url": s.org_logo_url,
        "primary_color": s.primary_color,
        "secondary_color": s.secondary_color,
        "email_notifications": s.email_notifications or {},
        "cert_reminder_days": s.cert_reminder_days or [3, 7, 14],
        "cert_expiry_warning_days": s.cert_expiry_warning_days or [7, 14, 30],
        "action_overdue_escalation_days": s.action_overdue_escalation_days,
        "sso_enabled": s.sso_enabled,
        "sso_provider": s.sso_provider,
        "sso_client_id": s.sso_client_id,
        "sso_discovery_url": s.sso_discovery_url,
        "inspection_retention_days": s.inspection_retention_days,
        "audit_log_retention_days": s.audit_log_retention_days,
        "backup_enabled": s.backup_enabled,
        "backup_frequency": s.backup_frequency,
        "backup_retention_count": s.backup_retention_count,
        "compliance_green_threshold": s.compliance_green_threshold or 90,
        "compliance_amber_threshold": s.compliance_amber_threshold or 80,
        "updated_at": str(s.updated_at) if s.updated_at else None,
    }


@router.get("")
def get_settings(db: Session = Depends(get_db), _=Depends(require_admin)):
    return settings_out(_get_or_create(db))


# Read-only, open to any authenticated user (not just admins) -- every score display
# across the app (matrix, dashboards, reports, score rings) needs these to color itself
# consistently, regardless of who's viewing.
@router.get("/compliance-thresholds")
def get_compliance_thresholds(db: Session = Depends(get_db), _=Depends(get_current_user)):
    s = _get_or_create(db)
    return {
        "green": s.compliance_green_threshold or 90,
        "amber": s.compliance_amber_threshold or 80,
    }


@router.put("")
def update_settings(payload: OrgSettingsUpdate, db: Session = Depends(get_db),
                    _=Depends(require_admin)):
    green = payload.compliance_green_threshold
    amber = payload.compliance_amber_threshold
    if green is not None or amber is not None:
        s_existing = _get_or_create(db)
        check_green = green if green is not None else (s_existing.compliance_green_threshold or 90)
        check_amber = amber if amber is not None else (s_existing.compliance_amber_threshold or 80)
        if not (0 <= check_amber < check_green <= 100):
            raise HTTPException(
                status_code=400,
                detail="Thresholds must satisfy 0 <= amber < green <= 100",
            )
    s = _get_or_create(db)
    for k, v in payload.model_dump(exclude_none=True).items():
        setattr(s, k, v)
    db.commit()
    db.refresh(s)
    return settings_out(s)


@router.post("/logo")
async def upload_logo(file: UploadFile = File(...), db: Session = Depends(get_db),
                      _=Depends(require_admin)):
    import os
    from ..config import settings as cfg
    upload_dir = os.path.join(cfg.upload_dir, "branding")
    os.makedirs(upload_dir, exist_ok=True)
    content = await file.read()
    ext = os.path.splitext(file.filename or "logo.png")[1]
    path = os.path.join(upload_dir, f"logo{ext}")
    with open(path, "wb") as f:
        f.write(content)
    logo_url = f"/uploads/branding/logo{ext}"
    s = _get_or_create(db)
    s.org_logo_url = logo_url
    db.commit()
    return {"logo_url": logo_url}
