from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from ..database import get_db
from ..models.role import Role, RolePermission, ALL_MODULES
from ..models.user import User, UserRole
from .deps import get_current_user, require_admin

router = APIRouter(prefix="/roles", tags=["roles"])

ADMIN_MODULES = ["dashboard"] + ALL_MODULES + ["users", "settings", "roles"]


def _effective_role(user: User) -> str:
    cr = getattr(user, "custom_role", None)
    return cr if cr else str(user.role.value if hasattr(user.role, "value") else user.role)


class RoleOut(BaseModel):
    name: str
    display_name: str
    is_system: bool
    modules: List[str]


class RoleCreate(BaseModel):
    name: str
    display_name: str


class PermissionsUpdate(BaseModel):
    modules: List[str]


@router.get("/my-permissions")
def my_permissions(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    role_name = _effective_role(current_user)
    if role_name == "admin":
        return {"role": role_name, "modules": ADMIN_MODULES}
    role = db.query(Role).filter(Role.name == role_name).first()
    if not role:
        return {"role": role_name, "modules": ["dashboard"]}
    return {"role": role_name, "modules": ["dashboard"] + [p.module for p in role.permissions]}


@router.get("/", response_model=List[RoleOut])
def list_roles(db: Session = Depends(get_db), _=Depends(require_admin)):
    roles = db.query(Role).order_by(Role.name).all()
    return [
        RoleOut(name=r.name, display_name=r.display_name, is_system=r.is_system,
                modules=[p.module for p in r.permissions])
        for r in roles
    ]


@router.post("/", response_model=RoleOut, status_code=201)
def create_role(payload: RoleCreate, db: Session = Depends(get_db), _=Depends(require_admin)):
    name = payload.name.lower().replace(" ", "_")
    if db.query(Role).filter(Role.name == name).first():
        raise HTTPException(400, "Role name already exists")
    role = Role(name=name, display_name=payload.display_name, is_system=False)
    db.add(role)
    db.commit()
    db.refresh(role)
    return RoleOut(name=role.name, display_name=role.display_name, is_system=False, modules=[])


@router.put("/{role_name}/permissions")
def update_permissions(
    role_name: str, payload: PermissionsUpdate,
    db: Session = Depends(get_db), _=Depends(require_admin),
):
    if role_name == "admin":
        raise HTTPException(400, "Admin permissions cannot be changed")
    role = db.query(Role).filter(Role.name == role_name).first()
    if not role:
        raise HTTPException(404, "Role not found")
    db.query(RolePermission).filter(RolePermission.role_id == role.id).delete()
    for module in payload.modules:
        if module in ALL_MODULES:
            db.add(RolePermission(role_id=role.id, module=module))
    db.commit()
    return {"ok": True}


@router.delete("/{role_name}", status_code=204)
def delete_role(role_name: str, db: Session = Depends(get_db), _=Depends(require_admin)):
    role = db.query(Role).filter(Role.name == role_name).first()
    if not role:
        raise HTTPException(404, "Role not found")
    if role.is_system:
        raise HTTPException(400, "Cannot delete system roles")
    db.delete(role)
    db.commit()
