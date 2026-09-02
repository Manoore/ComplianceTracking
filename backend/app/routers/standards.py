from typing import Optional
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from ..database import get_db
from ..models.standard import AccreditationStandard, BUILTIN_STANDARDS
from ..models.checklist import ChecklistItem
from ..models.inspection import InspectionItem, ItemResult
from ..models.user import User, UserRole
from .deps import get_current_user

router = APIRouter(prefix="/standards", tags=["standards"])


class StandardCreate(BaseModel):
    code: str
    name: str
    description: Optional[str] = None


def std_out(s: AccreditationStandard) -> dict:
    return {
        "id": s.id,
        "code": s.code,
        "name": s.name,
        "description": s.description,
        "is_builtin": s.is_builtin,
        "is_active": s.is_active,
    }


@router.get("/")
def list_standards(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    stds = db.query(AccreditationStandard).filter(
        AccreditationStandard.is_active == True,
    ).filter(
        (AccreditationStandard.tenant_id == current_user.tenant_id) |
        (AccreditationStandard.tenant_id == None)  # noqa
    ).order_by(AccreditationStandard.code).all()
    return [std_out(s) for s in stds]


@router.post("/", status_code=201)
def create_standard(payload: StandardCreate, db: Session = Depends(get_db),
                    current_user: User = Depends(get_current_user)):
    if current_user.role != UserRole.admin:
        raise HTTPException(status_code=403, detail="Forbidden")
    s = AccreditationStandard(
        tenant_id=current_user.tenant_id,
        code=payload.code.upper(),
        name=payload.name,
        description=payload.description,
    )
    db.add(s)
    db.commit()
    db.refresh(s)
    return std_out(s)


@router.put("/{std_id}")
def update_standard(std_id: int, payload: StandardCreate, db: Session = Depends(get_db),
                    current_user: User = Depends(get_current_user)):
    if current_user.role != UserRole.admin:
        raise HTTPException(status_code=403, detail="Forbidden")
    s = db.query(AccreditationStandard).filter(
        AccreditationStandard.id == std_id,
        AccreditationStandard.tenant_id == current_user.tenant_id,
    ).first()
    if not s:
        raise HTTPException(status_code=404, detail="Not found")
    s.code = payload.code.upper()
    s.name = payload.name
    s.description = payload.description
    db.commit()
    db.refresh(s)
    return std_out(s)


@router.delete("/{std_id}", status_code=204)
def delete_standard(std_id: int, db: Session = Depends(get_db),
                    current_user: User = Depends(get_current_user)):
    if current_user.role != UserRole.admin:
        raise HTTPException(status_code=403, detail="Forbidden")
    s = db.query(AccreditationStandard).filter(
        AccreditationStandard.id == std_id,
        AccreditationStandard.tenant_id == current_user.tenant_id,
    ).first()
    if not s:
        raise HTTPException(status_code=404, detail="Not found")
    s.is_active = False
    db.commit()


@router.get("/compliance")
def compliance_by_standard(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """For each standard code, show # items tagged and compliance rate across all inspections."""
    all_items = db.query(ChecklistItem).all()
    all_inspection_items = db.query(InspectionItem).all()

    # Build a lookup: checklist_item_id -> list of inspection_item results
    ci_to_results: dict = {}
    for ii in all_inspection_items:
        ci_to_results.setdefault(ii.checklist_item_id, []).append(ii.result)

    # Aggregate by standard tag
    std_data: dict = {}
    for ci in all_items:
        tags = ci.standard_tags or []
        for tag in tags:
            if tag not in std_data:
                std_data[tag] = {"tagged_items": 0, "pass": 0, "fail": 0, "total_answered": 0}
            std_data[tag]["tagged_items"] += 1
            results = ci_to_results.get(ci.id, [])
            for r in results:
                if r in [ItemResult.pass_, ItemResult.pass_]:
                    std_data[tag]["pass"] += 1
                    std_data[tag]["total_answered"] += 1
                elif r == ItemResult.fail:
                    std_data[tag]["fail"] += 1
                    std_data[tag]["total_answered"] += 1

    result = []
    for code, data in std_data.items():
        answered = data["total_answered"]
        compliance = round(data["pass"] / answered * 100, 1) if answered > 0 else None
        result.append({
            "code": code,
            "tagged_items": data["tagged_items"],
            "pass": data["pass"],
            "fail": data["fail"],
            "total_answered": answered,
            "compliance_rate": compliance,
        })
    return sorted(result, key=lambda x: x["code"])


@router.post("/seed-builtins")
def seed_builtins(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    if current_user.role != UserRole.admin:
        raise HTTPException(status_code=403, detail="Forbidden")
    created = 0
    for s in BUILTIN_STANDARDS:
        existing = db.query(AccreditationStandard).filter(
            AccreditationStandard.code == s["code"],
            AccreditationStandard.is_builtin == True,
        ).first()
        if not existing:
            db.add(AccreditationStandard(code=s["code"], name=s["name"], is_builtin=True, tenant_id=None))
            created += 1
    db.commit()
    return {"seeded": created}
