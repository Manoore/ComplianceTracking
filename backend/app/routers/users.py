from datetime import timedelta
from typing import List, Optional
from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, status
from sqlalchemy.orm import Session
from pydantic import BaseModel, EmailStr
from ..database import get_db
from ..models.user import User, UserRole
from ..models.tenant import Tenant
from ..services.auth import hash_password, create_access_token
from ..services.email import send_account_verification
from ..utils.audit_trail import log_action
from ..config import settings
from .deps import get_current_user, require_admin

router = APIRouter(prefix="/users", tags=["users"])


def _queue_invite_email(background: BackgroundTasks, user: User, tenant_name: str):
    """Builds the same verify-account token/link the /auth/verify-account endpoint
    expects, then queues the email -- add_task awaits an async callable itself,
    so this must pass send_account_verification directly rather than calling it."""
    token = create_access_token(
        {"sub": str(user.id), "type_override": "account_verify"},
        expires_delta=timedelta(days=7),
    )
    verify_url = f"{settings.frontend_url}/verify-account?token={token}"
    background.add_task(send_account_verification, user.email, user.full_name, tenant_name, verify_url)


class UserCreate(BaseModel):
    email: EmailStr
    full_name: str
    password: Optional[str] = None
    role: UserRole = UserRole.team_member
    custom_role: Optional[str] = None
    managed_region: Optional[str] = None


class UserUpdate(BaseModel):
    full_name: Optional[str] = None
    role: Optional[UserRole] = None
    custom_role: Optional[str] = None
    managed_region: Optional[str] = None
    is_active: Optional[bool] = None
    password: Optional[str] = None


class UserOut(BaseModel):
    id: int
    email: str
    full_name: str
    role: str
    custom_role: Optional[str] = None
    managed_region: Optional[str] = None
    is_active: bool
    is_verified: bool = True
    last_login: Optional[str] = None

    class Config:
        from_attributes = True


@router.get("", response_model=List[UserOut])
def list_users(db: Session = Depends(get_db), current_user: User = Depends(require_admin)):
    users = db.query(User).filter(User.tenant_id == current_user.tenant_id).order_by(User.full_name).all()
    return [UserOut(id=u.id, email=u.email, full_name=u.full_name, role=u.role.value,
                    custom_role=u.custom_role, managed_region=u.managed_region, is_active=u.is_active,
                    is_verified=bool(u.is_verified),
                    last_login=str(u.last_login) if u.last_login else None)
            for u in users]


@router.post("", response_model=UserOut, status_code=status.HTTP_201_CREATED)
def create_user(payload: UserCreate, background: BackgroundTasks, db: Session = Depends(get_db),
                current_user: User = Depends(require_admin)):
    if db.query(User).filter(User.email == payload.email).first():
        raise HTTPException(status_code=400, detail="Email already registered")
    # Leaving password blank invites them instead: no usable credential is set
    # (matching the existing nullable hashed_password used for SSO-only users),
    # so they can't log in until they click the emailed link and set their own.
    invite = not payload.password
    user = User(
        email=payload.email,
        full_name=payload.full_name,
        hashed_password=hash_password(payload.password) if payload.password else None,
        role=payload.role,
        custom_role=payload.custom_role or None,
        managed_region=payload.managed_region or None,
        tenant_id=current_user.tenant_id,
        is_verified=not invite,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    log_action(db, "user.create", user_id=current_user.id, resource_type="user", resource_id=user.id,
              details={"invited": invite})
    db.commit()
    if invite:
        tenant = db.query(Tenant).filter(Tenant.id == current_user.tenant_id).first()
        _queue_invite_email(background, user, tenant.name if tenant else "CompliNow")
    return UserOut(id=user.id, email=user.email, full_name=user.full_name,
                   role=user.role.value, custom_role=user.custom_role,
                   managed_region=user.managed_region, is_active=user.is_active,
                   is_verified=user.is_verified)


@router.put("/{user_id}", response_model=UserOut)
def update_user(user_id: int, payload: UserUpdate, db: Session = Depends(get_db),
                current_user: User = Depends(get_current_user)):
    if current_user.role != UserRole.admin and current_user.id != user_id:
        raise HTTPException(status_code=403, detail="Forbidden")
    user = db.query(User).filter(User.id == user_id, User.tenant_id == current_user.tenant_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    if payload.full_name is not None:
        user.full_name = payload.full_name
    if payload.role is not None and current_user.role == UserRole.admin:
        user.role = payload.role
    if payload.custom_role is not None and current_user.role == UserRole.admin:
        user.custom_role = payload.custom_role or None
    if payload.managed_region is not None and current_user.role == UserRole.admin:
        user.managed_region = payload.managed_region or None
    if payload.is_active is not None and current_user.role == UserRole.admin:
        user.is_active = payload.is_active
    if payload.password:
        user.hashed_password = hash_password(payload.password)
        user.is_verified = True  # admin setting it directly stands in for the email link
    db.commit()
    db.refresh(user)
    log_action(db, "user.update", user_id=current_user.id, resource_type="user", resource_id=user.id)
    db.commit()
    return UserOut(id=user.id, email=user.email, full_name=user.full_name,
                   role=user.role.value, custom_role=user.custom_role,
                   managed_region=user.managed_region, is_active=user.is_active,
                   is_verified=user.is_verified)


@router.post("/{user_id}/resend-verification", response_model=UserOut)
def resend_verification(user_id: int, background: BackgroundTasks, db: Session = Depends(get_db),
                        current_user: User = Depends(require_admin)):
    user = db.query(User).filter(User.id == user_id, User.tenant_id == current_user.tenant_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    if user.is_verified:
        raise HTTPException(status_code=400, detail="This user has already verified their account")
    tenant = db.query(Tenant).filter(Tenant.id == current_user.tenant_id).first()
    _queue_invite_email(background, user, tenant.name if tenant else "CompliNow")
    log_action(db, "user.resend_verification", user_id=current_user.id, resource_type="user", resource_id=user.id)
    db.commit()
    return UserOut(id=user.id, email=user.email, full_name=user.full_name,
                   role=user.role.value, custom_role=user.custom_role,
                   managed_region=user.managed_region, is_active=user.is_active,
                   is_verified=user.is_verified)


@router.delete("/{user_id}", status_code=204)
def delete_user(user_id: int, db: Session = Depends(get_db), current_user: User = Depends(require_admin)):
    user = db.query(User).filter(User.id == user_id, User.tenant_id == current_user.tenant_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    if user.id == current_user.id:
        raise HTTPException(status_code=400, detail="Cannot delete yourself")
    user.is_active = False
    db.commit()
    log_action(db, "user.deactivate", user_id=current_user.id, resource_type="user", resource_id=user_id)
    db.commit()
