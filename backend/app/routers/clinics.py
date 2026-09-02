import csv
import io
from typing import List, Optional
from datetime import datetime, timedelta
from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File
from sqlalchemy.orm import Session
from sqlalchemy import func
from pydantic import BaseModel
from ..database import get_db
from ..models.clinic import Clinic, ClinicStaff, ClinicType
from ..models.inspection import Inspection, InspectionStatus
from ..models.corrective_action import CorrectiveAction, ActionStatus
from ..models.user import User, UserRole
from ..utils.audit_trail import log_action
from .deps import get_current_user, require_admin

router = APIRouter(prefix="/clinics", tags=["clinics"])


class ClinicCreate(BaseModel):
    name: str
    clinic_type: Optional[ClinicType] = ClinicType.general_practice
    address: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = None
    zip_code: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    website: Optional[str] = None
    manager_id: Optional[int] = None
    department_id: Optional[int] = None
    notes: Optional[str] = None
    lat: Optional[float] = None
    lng: Optional[float] = None
    operating_hours: Optional[dict] = None
    license_number: Optional[str] = None
    accreditation: Optional[str] = None


class ClinicUpdate(BaseModel):
    name: Optional[str] = None
    clinic_type: Optional[ClinicType] = None
    address: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = None
    zip_code: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    website: Optional[str] = None
    manager_id: Optional[int] = None
    department_id: Optional[int] = None
    is_active: Optional[bool] = None
    notes: Optional[str] = None
    lat: Optional[float] = None
    lng: Optional[float] = None
    operating_hours: Optional[dict] = None
    license_number: Optional[str] = None
    accreditation: Optional[str] = None


def clinic_out(c: Clinic) -> dict:
    return {
        "id": c.id,
        "name": c.name,
        "clinic_type": c.clinic_type.value if c.clinic_type else None,
        "address": c.address,
        "city": c.city,
        "state": c.state,
        "zip_code": c.zip_code,
        "phone": c.phone,
        "email": c.email,
        "website": c.website,
        "manager_id": c.manager_id,
        "manager_name": c.manager.full_name if c.manager else None,
        "department_id": c.department_id,
        "department_name": c.department.name if c.department else None,
        "is_active": c.is_active,
        "notes": c.notes,
        "lat": c.lat,
        "lng": c.lng,
        "operating_hours": c.operating_hours,
        "license_number": c.license_number,
        "accreditation": c.accreditation,
        "created_at": str(c.created_at) if c.created_at else None,
    }


@router.get("/")
def list_clinics(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    q = db.query(Clinic).filter(Clinic.tenant_id == current_user.tenant_id)
    if current_user.role == UserRole.manager:
        q = q.filter(Clinic.manager_id == current_user.id)
    elif current_user.role == UserRole.team_member:
        # team members can see clinics they are staff of
        staff_clinic_ids = db.query(ClinicStaff.clinic_id).filter(ClinicStaff.user_id == current_user.id).subquery()
        q = q.filter(Clinic.id.in_(staff_clinic_ids))
    return [clinic_out(c) for c in q.order_by(Clinic.name).all()]


@router.post("/", status_code=201)
def create_clinic(payload: ClinicCreate, db: Session = Depends(get_db),
                  current_user: User = Depends(require_admin)):
    clinic = Clinic(**payload.model_dump(), tenant_id=current_user.tenant_id)
    db.add(clinic)
    db.commit()
    db.refresh(clinic)
    log_action(db, "clinic.create", user_id=current_user.id, resource_type="clinic", resource_id=clinic.id)
    db.commit()
    return clinic_out(clinic)


@router.get("/{clinic_id}")
def get_clinic(clinic_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    clinic = db.query(Clinic).filter(Clinic.id == clinic_id, Clinic.tenant_id == current_user.tenant_id).first()
    if not clinic:
        raise HTTPException(status_code=404, detail="Clinic not found")
    if current_user.role == UserRole.manager and clinic.manager_id != current_user.id:
        raise HTTPException(status_code=403, detail="Forbidden")
    return clinic_out(clinic)


@router.get("/{clinic_id}/profile")
def clinic_profile(clinic_id: int, db: Session = Depends(get_db),
                   current_user: User = Depends(get_current_user)):
    """Detailed clinic profile: compliance summary, recent inspections, open actions, staff."""
    clinic = db.query(Clinic).filter(Clinic.id == clinic_id, Clinic.tenant_id == current_user.tenant_id).first()
    if not clinic:
        raise HTTPException(status_code=404, detail="Clinic not found")

    inspections = (db.query(Inspection)
                   .filter(Inspection.clinic_id == clinic_id,
                           Inspection.compliance_score.isnot(None))
                   .order_by(Inspection.submitted_at.desc())
                   .limit(10).all())

    last_insp = inspections[0] if inspections else None
    avg_score = (db.query(func.avg(Inspection.compliance_score))
                 .filter(Inspection.clinic_id == clinic_id,
                         Inspection.compliance_score.isnot(None)).scalar())

    open_actions = (db.query(CorrectiveAction)
                    .filter(CorrectiveAction.clinic_id == clinic_id,
                            CorrectiveAction.status.in_([ActionStatus.open, ActionStatus.in_progress,
                                                          ActionStatus.pending_verification]))
                    .count())

    staff = (db.query(ClinicStaff).filter(ClinicStaff.clinic_id == clinic_id).all())

    score_history = [
        {"date": str(i.submitted_at.date()) if i.submitted_at else None,
         "score": i.compliance_score, "risk_level": i.risk_level}
        for i in reversed(inspections)
    ]

    return {
        **clinic_out(clinic),
        "stats": {
            "avg_compliance_score": round(avg_score or 0, 1),
            "last_inspection_score": last_insp.compliance_score if last_insp else None,
            "last_inspection_date": str(last_insp.submitted_at) if last_insp and last_insp.submitted_at else None,
            "last_risk_level": last_insp.risk_level if last_insp else None,
            "open_corrective_actions": open_actions,
            "total_inspections": len(inspections),
        },
        "score_history": score_history,
        "recent_inspections": [
            {
                "id": i.id,
                "score": i.compliance_score,
                "risk_level": i.risk_level,
                "status": i.status.value if i.status else None,
                "inspector_name": i.inspector.full_name if i.inspector else None,
                "submitted_at": str(i.submitted_at) if i.submitted_at else None,
            }
            for i in inspections[:5]
        ],
        "staff": [
            {"user_id": s.user_id, "full_name": s.user.full_name if s.user else None,
             "role_note": s.role_note}
            for s in staff
        ],
    }


@router.put("/{clinic_id}")
def update_clinic(clinic_id: int, payload: ClinicUpdate, db: Session = Depends(get_db),
                  current_user: User = Depends(require_admin)):
    clinic = db.query(Clinic).filter(Clinic.id == clinic_id, Clinic.tenant_id == current_user.tenant_id).first()
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
    clinic = db.query(Clinic).filter(Clinic.id == clinic_id, Clinic.tenant_id == current_user.tenant_id).first()
    if not clinic:
        raise HTTPException(status_code=404, detail="Clinic not found")
    clinic.is_active = False
    db.commit()
    log_action(db, "clinic.deactivate", user_id=current_user.id, resource_type="clinic", resource_id=clinic_id)
    db.commit()


@router.post("/{clinic_id}/staff")
def add_staff(clinic_id: int, user_id: int, role_note: str = "",
              db: Session = Depends(get_db), current_user: User = Depends(require_admin)):
    clinic = db.query(Clinic).filter(Clinic.id == clinic_id, Clinic.tenant_id == current_user.tenant_id).first()
    if not clinic:
        raise HTTPException(status_code=404, detail="Clinic not found")
    existing = db.query(ClinicStaff).filter(
        ClinicStaff.clinic_id == clinic_id, ClinicStaff.user_id == user_id).first()
    if existing:
        return {"id": existing.id}
    s = ClinicStaff(clinic_id=clinic_id, user_id=user_id, role_note=role_note)
    db.add(s)
    db.commit()
    return {"id": s.id}


@router.delete("/{clinic_id}/staff/{user_id}", status_code=204)
def remove_staff(clinic_id: int, user_id: int, db: Session = Depends(get_db),
                 current_user: User = Depends(require_admin)):
    db.query(ClinicStaff).filter(
        ClinicStaff.clinic_id == clinic_id, ClinicStaff.user_id == user_id).delete()
    db.commit()


@router.post("/import/csv", status_code=201)
async def import_csv(file: UploadFile = File(...),
                     db: Session = Depends(get_db),
                     current_user: User = Depends(require_admin)):
    """
    Bulk import clinics from CSV.
    Expected columns: name, clinic_type, address, city, state, zip_code, phone, email, notes
    """
    content = await file.read()
    text = content.decode("utf-8-sig")
    reader = csv.DictReader(io.StringIO(text))
    created = 0
    errors = []
    for i, row in enumerate(reader, start=2):
        name = (row.get("name") or "").strip()
        if not name:
            errors.append(f"Row {i}: missing name")
            continue
        try:
            c_type = ClinicType(row.get("clinic_type", "other").strip().lower()) if row.get("clinic_type") else ClinicType.general_practice
        except ValueError:
            c_type = ClinicType.general_practice
        clinic = Clinic(
            name=name,
            clinic_type=c_type,
            address=row.get("address", "").strip() or None,
            city=row.get("city", "").strip() or None,
            state=row.get("state", "").strip() or None,
            zip_code=row.get("zip_code", "").strip() or None,
            phone=row.get("phone", "").strip() or None,
            email=row.get("email", "").strip() or None,
            notes=row.get("notes", "").strip() or None,
        )
        db.add(clinic)
        created += 1
    db.commit()
    log_action(db, "clinic.bulk_import", user_id=current_user.id,
               details={"created": created, "errors": len(errors)})
    db.commit()
    return {"created": created, "errors": errors}
