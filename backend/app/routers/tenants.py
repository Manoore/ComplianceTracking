from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session
from ..database import get_db
from ..models.tenant import Tenant
from ..models.user import User
from .deps import get_current_user

router = APIRouter(prefix="/tenants", tags=["tenants"])


class TenantOut(BaseModel):
    id: int
    name: str
    slug: str
    plan: str
    is_active: bool
    trial_ends_at: datetime | None
    created_at: datetime

    class Config:
        from_attributes = True


@router.get("/me", response_model=TenantOut)
def get_my_tenant(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if not current_user.tenant_id:
        raise HTTPException(status_code=404, detail="No tenant associated with this user")
    tenant = db.query(Tenant).filter(Tenant.id == current_user.tenant_id).first()
    if not tenant:
        raise HTTPException(status_code=404, detail="Tenant not found")
    return tenant
