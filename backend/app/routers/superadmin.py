import re
from datetime import datetime, timedelta
from typing import Optional, List, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, Header, status
from sqlalchemy import func, text
from sqlalchemy.orm import Session
from pydantic import BaseModel
from ..database import get_db
from ..models.tenant import Tenant
from ..models.user import User, UserRole
from ..models.inspection import Inspection
from ..models.certification import Course, TeamCertification
from ..models.corrective_action import CorrectiveAction
from ..models.platform_setting import PlatformSetting
from ..services.auth import create_access_token, hash_password
from ..config import settings

DEFAULT_PLAN_CONFIGS: Dict[str, Any] = {
    "free":       {"label": "Free",       "price_monthly": 0,   "price_annual": 0,    "max_locations": 1,  "max_users": 5,   "features": ["Basic inspections", "Standard checklists", "PDF certificates", "Email notifications"]},
    "starter":    {"label": "Starter",    "price_monthly": 49,  "price_annual": 490,  "max_locations": 5,  "max_users": 25,  "features": ["Everything in Free", "Custom checklists", "Analytics dashboard", "Corrective actions", "Excel/CSV exports"]},
    "pro":        {"label": "Pro",        "price_monthly": 149, "price_annual": 1490, "max_locations": 0,  "max_users": 100, "features": ["Everything in Starter", "Custom branding", "Accreditation engine", "Role-based permissions", "Priority email support"]},
    "enterprise": {"label": "Enterprise", "price_monthly": 0,   "price_annual": 0,    "max_locations": 0,  "max_users": 0,   "features": ["Everything in Pro", "SSO / SAML", "Dedicated support", "SLA guarantee", "Custom integrations", "Audit log export"]},
}

router = APIRouter(prefix="/superadmin", tags=["superadmin"])


class SALoginRequest(BaseModel):
    email: str
    password: str


class TenantUpdate(BaseModel):
    is_active: Optional[bool] = None
    plan: Optional[str] = None
    trial_ends_at: Optional[str] = None


class CreateTenantRequest(BaseModel):
    org_name: str
    admin_email: str
    admin_password: str
    plan: str = "free"
    trial_days: int = 14


class PlanConfigUpdate(BaseModel):
    configs: Dict[str, Any]


def _require_sa(authorization: str = Header(...)):
    from ..services.auth import decode_token
    scheme, _, token = authorization.partition(" ")
    if scheme.lower() != "bearer" or not token:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Missing token")
    payload = decode_token(token)
    if not payload or payload.get("role") != "superadmin":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Super-admin access required")
    return payload


@router.post("/login")
def sa_login(req: SALoginRequest):
    if req.email != settings.super_admin_email:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")
    # compare password — stored as plain in settings for simplicity, use bcrypt if hashed
    expected = settings.super_admin_password
    # allow plain-text comparison (env var is the source of truth)
    if req.password != expected:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")
    token = create_access_token({"sub": "superadmin", "role": "superadmin"})
    return {"access_token": token, "token_type": "bearer"}


@router.get("/stats")
def sa_stats(db: Session = Depends(get_db), _=Depends(_require_sa)):
    total_tenants = db.query(func.count(Tenant.id)).scalar()
    active_tenants = db.query(func.count(Tenant.id)).filter(Tenant.is_active == True).scalar()
    total_users = db.query(func.count(User.id)).filter(User.tenant_id.isnot(None)).scalar()
    total_inspections = db.query(func.count(Inspection.id)).scalar()
    total_certifications = db.query(func.count(TeamCertification.id)).scalar()
    return {
        "total_tenants": total_tenants,
        "active_tenants": active_tenants,
        "suspended_tenants": total_tenants - active_tenants,
        "total_users": total_users,
        "total_inspections": total_inspections,
        "total_certifications": total_certifications,
    }


@router.get("/tenants")
def sa_list_tenants(db: Session = Depends(get_db), _=Depends(_require_sa)):
    tenants = db.query(Tenant).order_by(Tenant.created_at.desc()).all()
    result = []
    for t in tenants:
        user_count = db.query(func.count(User.id)).filter(User.tenant_id == t.id).scalar()
        inspection_count = db.query(func.count(Inspection.id)).filter(Inspection.tenant_id == t.id).scalar()
        open_actions = db.query(func.count(CorrectiveAction.id)).filter(
            CorrectiveAction.tenant_id == t.id,
            CorrectiveAction.status.notin_(["resolved", "verified"])
        ).scalar()
        result.append({
            "id": t.id,
            "name": t.name,
            "slug": t.slug,
            "plan": t.plan,
            "is_active": t.is_active,
            "trial_ends_at": str(t.trial_ends_at) if t.trial_ends_at else None,
            "created_at": str(t.created_at) if t.created_at else None,
            "user_count": user_count,
            "inspection_count": inspection_count,
            "open_actions": open_actions,
        })
    return result


@router.get("/tenants/{tenant_id}")
def sa_get_tenant(tenant_id: int, db: Session = Depends(get_db), _=Depends(_require_sa)):
    t = db.query(Tenant).filter(Tenant.id == tenant_id).first()
    if not t:
        raise HTTPException(status_code=404, detail="Tenant not found")
    users = db.query(User).filter(User.tenant_id == tenant_id).all()
    return {
        "id": t.id,
        "name": t.name,
        "slug": t.slug,
        "plan": t.plan,
        "is_active": t.is_active,
        "trial_ends_at": str(t.trial_ends_at) if t.trial_ends_at else None,
        "created_at": str(t.created_at) if t.created_at else None,
        "users": [{"id": u.id, "email": u.email, "full_name": u.full_name, "role": u.role.value, "is_active": u.is_active} for u in users],
    }


@router.put("/tenants/{tenant_id}")
def sa_update_tenant(tenant_id: int, payload: TenantUpdate,
                     db: Session = Depends(get_db), _=Depends(_require_sa)):
    t = db.query(Tenant).filter(Tenant.id == tenant_id).first()
    if not t:
        raise HTTPException(status_code=404, detail="Tenant not found")
    if payload.is_active is not None:
        t.is_active = payload.is_active
    if payload.plan is not None:
        t.plan = payload.plan
    if payload.trial_ends_at is not None:
        try:
            t.trial_ends_at = datetime.fromisoformat(payload.trial_ends_at)
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid trial_ends_at date")
    db.commit()
    db.refresh(t)
    return {"id": t.id, "name": t.name, "plan": t.plan, "is_active": t.is_active}


@router.post("/tenants", status_code=201)
def sa_create_tenant(payload: CreateTenantRequest, db: Session = Depends(get_db), _=Depends(_require_sa)):
    if db.query(User).filter(User.email == payload.admin_email).first():
        raise HTTPException(status_code=409, detail="A user with this email already exists")

    base_slug = re.sub(r"[^a-z0-9-]", "", re.sub(r"[\s_]", "-", payload.org_name.lower()))[:50] or "org"
    slug, attempt = base_slug, 0
    while db.query(Tenant).filter(Tenant.slug == slug).first():
        attempt += 1
        slug = f"{base_slug}-{attempt}"

    tenant = Tenant(
        name=payload.org_name,
        slug=slug,
        plan=payload.plan,
        trial_ends_at=datetime.utcnow() + timedelta(days=payload.trial_days),
    )
    db.add(tenant)
    db.flush()

    user = User(
        email=payload.admin_email,
        full_name="Admin",
        hashed_password=hash_password(payload.admin_password),
        role=UserRole.admin,
        tenant_id=tenant.id,
    )
    db.add(user)
    db.commit()
    db.refresh(tenant)
    return {
        "id": tenant.id, "name": tenant.name, "slug": tenant.slug,
        "plan": tenant.plan, "is_active": tenant.is_active,
        "admin_email": user.email,
    }


@router.get("/plans")
def sa_get_plans(db: Session = Depends(get_db), _=Depends(_require_sa)):
    row = db.query(PlatformSetting).filter(PlatformSetting.key == "plan_configs").first()
    return row.value if row else DEFAULT_PLAN_CONFIGS


@router.put("/plans")
def sa_update_plans(payload: PlanConfigUpdate, db: Session = Depends(get_db), _=Depends(_require_sa)):
    row = db.query(PlatformSetting).filter(PlatformSetting.key == "plan_configs").first()
    if row:
        row.value = payload.configs
    else:
        db.add(PlatformSetting(key="plan_configs", value=payload.configs))
    db.commit()
    return payload.configs


@router.get("/analytics")
def sa_analytics(db: Session = Depends(get_db), _=Depends(_require_sa)):
    now = datetime.utcnow()

    # Monthly signups (last 6 months)
    signups_by_month = []
    inspections_by_month = []
    for i in range(5, -1, -1):
        month_start = (now.replace(day=1) - timedelta(days=i * 30)).replace(day=1)
        if i > 0:
            month_end = (now.replace(day=1) - timedelta(days=(i - 1) * 30)).replace(day=1)
        else:
            month_end = now
        label = month_start.strftime("%b %Y")
        signups = db.query(func.count(Tenant.id)).filter(
            Tenant.created_at >= month_start, Tenant.created_at < month_end
        ).scalar() or 0
        insp = db.query(func.count(Inspection.id)).filter(
            Inspection.created_at >= month_start, Inspection.created_at < month_end
        ).scalar() or 0
        signups_by_month.append({"month": label, "count": signups})
        inspections_by_month.append({"month": label, "count": insp})

    # Plan distribution
    plan_distribution = []
    for plan in ["free", "starter", "pro", "enterprise"]:
        count = db.query(func.count(Tenant.id)).filter(
            Tenant.plan == plan, Tenant.is_active == True  # noqa
        ).scalar() or 0
        plan_distribution.append({"plan": plan, "count": count})

    # MRR (from plan pricing)
    plan_row = db.query(PlatformSetting).filter(PlatformSetting.key == "plan_configs").first()
    plan_configs = plan_row.value if plan_row else DEFAULT_PLAN_CONFIGS
    mrr = sum(
        (plan_configs.get(t.plan, {}).get("price_monthly", 0) or 0)
        for t in db.query(Tenant).filter(Tenant.is_active == True).all()  # noqa
    )

    # Total corrective actions open
    open_actions = db.query(func.count(CorrectiveAction.id)).filter(
        CorrectiveAction.status.notin_(["resolved", "verified"])
    ).scalar() or 0

    return {
        "signups_by_month": signups_by_month,
        "inspections_by_month": inspections_by_month,
        "plan_distribution": plan_distribution,
        "mrr": mrr,
        "open_actions": open_actions,
        "total_courses": db.query(func.count(Course.id)).scalar() or 0,
        "total_certifications": db.query(func.count(TeamCertification.id)).scalar() or 0,
    }
