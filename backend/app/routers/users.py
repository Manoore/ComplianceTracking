from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from pydantic import BaseModel, EmailStr
from ..database import get_db
from ..models.user import User, UserRole
from ..services.auth import hash_password
from ..utils.audit_trail import log_action
from .deps import get_current_user, require_admin

router = APIRouter(prefix="/users", tags=["users"])


class UserCreate(BaseModel):
    email: EmailStr
    full_name: str
    password: Optional[str] = None
    role: UserRole = UserRole.team_member
    custom_role: Optional[str] = None


class UserUpdate(BaseModel):
    full_name: Optional[str] = None
    role: Optional[UserRole] = None
    custom_role: Optional[str] = None
    is_active: Optional[bool] = None
    password: Optional[str] = None


class UserOut(BaseModel):
    id: int
    email: str
    full_name: str
    role: str
    custom_role: Optional[str] = None
    is_active: bool
    last_login: Optional[str] = None

    class Config:
        from_attributes = True


@router.get("/", response_model=List[UserOut])
def list_users(db: Session = Depends(get_db), current_user: User = Depends(require_admin)):
    users = db.query(User).filter(User.tenant_id == current_user.tenant_id).order_by(User.full_name).all()
    return [UserOut(id=u.id, email=u.email, full_name=u.full_name, role=u.role.value,
                    custom_role=u.custom_role, is_active=u.is_active,
                    last_login=str(u.last_login) if u.last_login else None)
            for u in users]


@router.post("/", response_model=UserOut, status_code=status.HTTP_201_CREATED)
def create_user(payload: UserCreate, db: Session = Depends(get_db),
                current_user: User = Depends(require_admin)):
    if db.query(User).filter(User.email == payload.email).first():
        raise HTTPException(status_code=400, detail="Email already registered")
    user = User(
        email=payload.email,
        full_name=payload.full_name,
        hashed_password=hash_password(payload.password) if payload.password else None,
        role=payload.role,
        custom_role=payload.custom_role or None,
        tenant_id=current_user.tenant_id,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    log_action(db, "user.create", user_id=current_user.id, resource_type="user", resource_id=user.id)
    db.commit()
    return UserOut(id=user.id, email=user.email, full_name=user.full_name,
                   role=user.role.value, custom_role=user.custom_role, is_active=user.is_active)


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
    if payload.is_active is not None and current_user.role == UserRole.admin:
        user.is_active = payload.is_active
    if payload.password:
        user.hashed_password = hash_password(payload.password)
    db.commit()
    db.refresh(user)
    log_action(db, "user.update", user_id=current_user.id, resource_type="user", resource_id=user.id)
    db.commit()
    return UserOut(id=user.id, email=user.email, full_name=user.full_name,
                   role=user.role.value, custom_role=user.custom_role, is_active=user.is_active)


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
