from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from pydantic import BaseModel
from ..database import get_db
from ..models.clinic import Clinic
from ..models.user import User, UserRole
from ..utils.audit_trail import log_action
from .deps import get_current_user, require_admin, require_admin_or_manager

router = APIRouter(prefix="/clinics", tags=["clinics"])


class ClinicCreate(BaseModel):
    name: str
    address: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = None
    zip_code: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    manager_id: Optional[int] = None
    notes: Optional[str] = None


class ClinicUpdate(BaseModel):
    name: Optional[str] = None
    address: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = None
    zip_code: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    manager_id: Optional[int] = None
    is_active: Optional[bool] = None
    notes: Optional[str] = None


def clinic_out(c: Clinic) -> dict:
    return {
        "id": c.id,
        "name": c.name,
        "address": c.address,
        "city": c.city,
        "state": c.state,
        "zip_code": c.zip_code,
        "phone": c.phone,
        "email": c.email,
        "manager_id": c.manager_id,
        "manager_name": c.manager.full_name if c.manager else None,
        "is_active": c.is_active,
        "notes": c.notes,
        "created_at": str(c.created_at) if c.created_at else None,
    }


@router.get("/")
def list_clinics(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    q = db.query(Clinic)
    if current_user.role == UserRole.manager:
        q = q.filter(Clinic.manager_id == current_user.id)
    elif current_user.role == UserRole.team_member:
        return []
    return [clinic_out(c) for c in q.order_by(Clinic.name).all()]


@router.post("/", status_code=201)
def create_clinic(payload: ClinicCreate, db: Session = Depends(get_db),
                  current_user: User = Depends(require_admin)):
    clinic = Clinic(**payload.model_dump())
    db.add(clinic)
    db.commit()
    db.refresh(clinic)
    log_action(db, "clinic.create", user_id=current_user.id, resource_type="clinic", resource_id=clinic.id)
    db.commit()
    return clinic_out(clinic)


@router.get("/{clinic_id}")
def get_clinic(clinic_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    clinic = db.query(Clinic).filter(Clinic.id == clinic_id).first()
    if not clinic:
        raise HTTPException(status_code=404, detail="Clinic not found")
    if current_user.role == UserRole.manager and clinic.manager_id != current_user.id:
        raise HTTPException(status_code=403, detail="Forbidden")
    return clinic_out(clinic)


@router.put("/{clinic_id}")
def update_clinic(clinic_id: int, payload: ClinicUpdate, db: Session = Depends(get_db),
                  current_user: User = Depends(require_admin)):
    clinic = db.query(Clinic).filter(Clinic.id == clinic_id).first()
    if not clinic:
        raise HTTPException(status_code=404, detail="Clinic not found")
    for k, v in payload.model_dump(exclude_none=True).items():
        setattr(clinic, k, v)
    db.commit()
    db.refresh(clinic)
    log_action(db, "clinic.update", user_id=current_user.id, resource_type="clinic", resource_id=clinic_id)
    db.commit()
    return clinic_out(clinic)


@router.delete("/{clinic_id}", status_code=204)
def delete_clinic(clinic_id: int, db: Session = Depends(get_db), current_user: User = Depends(require_admin)):
    clinic = db.query(Clinic).filter(Clinic.id == clinic_id).first()
    if not clinic:
        raise HTTPException(status_code=404, detail="Clinic not found")
    clinic.is_active = False
    db.commit()
    log_action(db, "clinic.deactivate", user_id=current_user.id, resource_type="clinic", resource_id=clinic_id)
    db.commit()
