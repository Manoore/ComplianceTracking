from datetime import datetime
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Header, status
from sqlalchemy import func
from sqlalchemy.orm import Session
from pydantic import BaseModel
from ..database import get_db
from ..models.tenant import Tenant
from ..models.user import User
from ..models.inspection import Inspection
from ..models.certification import Course, TeamCertification
from ..models.corrective_action import CorrectiveAction
from ..services.auth import create_access_token, verify_password, hash_password
from ..config import settings

router = APIRouter(prefix="/superadmin", tags=["superadmin"])


class SALoginRequest(BaseModel):
    email: str
    password: str


class TenantUpdate(BaseModel):
    is_active: Optional[bool] = None
    plan: Optional[str] = None


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
    db.commit()
    db.refresh(t)
    return {"id": t.id, "name": t.name, "plan": t.plan, "is_active": t.is_active}
