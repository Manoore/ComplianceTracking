from typing import Optional
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from ..database import get_db
from ..models.department import Department
from ..models.clinic import Clinic
from ..models.user import User, UserRole
from .deps import get_current_user

router = APIRouter(prefix="/departments", tags=["departments"])


class DepartmentCreate(BaseModel):
    name: str
    description: Optional[str] = None
    color: Optional[str] = None


class DepartmentUpdate(DepartmentCreate):
    pass


def dept_out(d: Department, db: Session) -> dict:
    clinic_count = db.query(Clinic).filter(Clinic.department_id == d.id, Clinic.is_active == True).count()
    return {
        "id": d.id,
        "name": d.name,
        "description": d.description,
        "color": d.color,
        "is_active": d.is_active,
        "clinic_count": clinic_count,
        "created_at": str(d.created_at) if d.created_at else None,
    }


@router.get("/")
def list_departments(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    depts = db.query(Department).filter(
        Department.tenant_id == current_user.tenant_id,
        Department.is_active == True,
    ).order_by(Department.name).all()
    return [dept_out(d, db) for d in depts]


@router.post("/", status_code=201)
def create_department(payload: DepartmentCreate, db: Session = Depends(get_db),
                      current_user: User = Depends(get_current_user)):
    if current_user.role not in [UserRole.admin, UserRole.manager]:
        raise HTTPException(status_code=403, detail="Forbidden")
    d = Department(
        tenant_id=current_user.tenant_id,
        name=payload.name,
        description=payload.description,
        color=payload.color,
    )
    db.add(d)
    db.commit()
    db.refresh(d)
    return dept_out(d, db)


@router.put("/{dept_id}")
def update_department(dept_id: int, payload: DepartmentUpdate,
                      db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    if current_user.role not in [UserRole.admin, UserRole.manager]:
        raise HTTPException(status_code=403, detail="Forbidden")
    d = db.query(Department).filter(Department.id == dept_id, Department.tenant_id == current_user.tenant_id).first()
    if not d:
        raise HTTPException(status_code=404, detail="Department not found")
    d.name = payload.name
    d.description = payload.description
    d.color = payload.color
    db.commit()
    db.refresh(d)
    return dept_out(d, db)


@router.delete("/{dept_id}", status_code=204)
def delete_department(dept_id: int, db: Session = Depends(get_db),
                      current_user: User = Depends(get_current_user)):
    if current_user.role != UserRole.admin:
        raise HTTPException(status_code=403, detail="Forbidden")
    d = db.query(Department).filter(Department.id == dept_id, Department.tenant_id == current_user.tenant_id).first()
    if not d:
        raise HTTPException(status_code=404, detail="Department not found")
    db.query(Clinic).filter(Clinic.department_id == dept_id).update({"department_id": None})
    d.is_active = False
    db.commit()


@router.get("/{dept_id}/clinics")
def dept_clinics(dept_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    clinics = db.query(Clinic).filter(Clinic.department_id == dept_id, Clinic.is_active == True).all()
    return [{"id": c.id, "name": c.name, "city": c.city, "state": c.state} for c in clinics]


@router.post("/{dept_id}/assign-clinic/{clinic_id}")
def assign_clinic(dept_id: int, clinic_id: int, db: Session = Depends(get_db),
                  current_user: User = Depends(get_current_user)):
    if current_user.role not in [UserRole.admin, UserRole.manager]:
        raise HTTPException(status_code=403, detail="Forbidden")
    clinic = db.query(Clinic).filter(Clinic.id == clinic_id, Clinic.tenant_id == current_user.tenant_id).first()
    if not clinic:
        raise HTTPException(status_code=404, detail="Clinic not found")
    clinic.department_id = dept_id
    db.commit()
    return {"status": "ok"}


@router.post("/{dept_id}/unassign-clinic/{clinic_id}")
def unassign_clinic(dept_id: int, clinic_id: int, db: Session = Depends(get_db),
                    current_user: User = Depends(get_current_user)):
    if current_user.role not in [UserRole.admin, UserRole.manager]:
        raise HTTPException(status_code=403, detail="Forbidden")
    clinic = db.query(Clinic).filter(Clinic.id == clinic_id, Clinic.department_id == dept_id).first()
    if clinic:
        clinic.department_id = None
        db.commit()
    return {"status": "ok"}
