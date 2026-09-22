"""
Compliance score rollups above the single-inspection level.

app/services/scoring.py scores one inspection. This module rolls that up to a
clinic, and then to a *person* -- MA/PCT, Clinic Lead, Regional Manager,
Director of Operations/Executive/Admin -- following the same hierarchy that
app/utils/hierarchy_scope.py already uses to decide who can see what.

The hierarchy math is deliberately simple (per product decision): a person's
score is the plain average of the compliance scores of the units directly
under them, not a second average re-derived from every underlying
inspection. That keeps one large clinic from outweighing a small one at
every level, and it's what "clinic score -> Clinic Lead score -> Regional
Manager score" as a readable chain actually means:
  - Clinic score            = avg(inspections at that clinic)
  - MA/PCT score (leaf)     = avg(that person's own inspections) -- there's no
                              "clinic" under an individual contributor
  - Clinic Lead score       = avg(scores of the clinics they manage)
  - Regional Manager score  = avg(scores of the clinics in their region)
  - Director/Executive/Admin score = avg(scores of every clinic in the tenant)
Each of those (except the MA leaf case) is exactly "avg of clinic scores
within scoped_clinic_ids(user)" -- so this reuses that helper directly rather
than re-deriving the branching a third time.
"""
from datetime import datetime
from typing import Optional
from sqlalchemy.orm import Session
from sqlalchemy import func
from ..models.inspection import Inspection
from ..models.clinic import Clinic
from ..models.user import User, UserRole
from ..utils.hierarchy_scope import scoped_clinic_ids


def _is_hierarchy_role(user: User) -> bool:
    custom_role = (user.custom_role or "").strip().lower()
    return (
        user.role in (UserRole.admin, UserRole.manager)
        or custom_role in ("clinic_lead", "regional_manager", "director_of_operations", "executive")
    )


def _filtered_score_query(db: Session, tenant_id: int, *, clinic_ids: Optional[list] = None,
                          inspector_id: Optional[int] = None, date_from: Optional[datetime] = None,
                          date_to: Optional[datetime] = None, template_id: Optional[int] = None,
                          region: Optional[str] = None):
    q = db.query(Inspection).filter(
        Inspection.tenant_id == tenant_id, Inspection.compliance_score.isnot(None))
    if clinic_ids is not None:
        q = q.filter(Inspection.clinic_id.in_(clinic_ids))
    if inspector_id is not None:
        q = q.filter(Inspection.inspector_id == inspector_id)
    if date_from is not None:
        q = q.filter(Inspection.submitted_at >= date_from)
    if date_to is not None:
        q = q.filter(Inspection.submitted_at <= date_to)
    if template_id is not None:
        q = q.filter(Inspection.template_id == template_id)
    if region is not None:
        q = q.join(Clinic, Inspection.clinic_id == Clinic.id).filter(Clinic.region == region)
    return q


def _avg_and_count(q) -> tuple:
    count = q.count()
    if count == 0:
        return None, 0
    avg = q.with_entities(func.avg(Inspection.compliance_score)).scalar()
    return (round(avg, 1) if avg is not None else None), count


def clinic_compliance_score(db: Session, clinic: Clinic, *, date_from: Optional[datetime] = None,
                            date_to: Optional[datetime] = None, template_id: Optional[int] = None) -> dict:
    q = _filtered_score_query(db, clinic.tenant_id, clinic_ids=[clinic.id],
                              date_from=date_from, date_to=date_to, template_id=template_id)
    score, count = _avg_and_count(q)
    return {"score": score, "inspection_count": count}


def person_compliance_score(db: Session, user: User, *, date_from: Optional[datetime] = None,
                            date_to: Optional[datetime] = None, template_id: Optional[int] = None,
                            region: Optional[str] = None) -> dict:
    if not _is_hierarchy_role(user):
        # Leaf of the hierarchy (MA/PCT with no oversight role): their own work only.
        q = _filtered_score_query(db, user.tenant_id, inspector_id=user.id,
                                  date_from=date_from, date_to=date_to, template_id=template_id,
                                  region=region)
        score, count = _avg_and_count(q)
        return {"score": score, "inspection_count": count, "clinic_count": None, "basis": "own_inspections"}

    clinic_ids, _ = scoped_clinic_ids(db, user)
    clinics_q = db.query(Clinic).filter(Clinic.tenant_id == user.tenant_id, Clinic.is_active == True)
    if clinic_ids is not None:
        clinics_q = clinics_q.filter(Clinic.id.in_(clinic_ids))
    if region:
        clinics_q = clinics_q.filter(Clinic.region == region)
    clinics = clinics_q.all()

    scores, total_inspections = [], 0
    for c in clinics:
        result = clinic_compliance_score(db, c, date_from=date_from, date_to=date_to, template_id=template_id)
        total_inspections += result["inspection_count"]
        if result["score"] is not None:
            scores.append(result["score"])

    score = round(sum(scores) / len(scores), 1) if scores else None
    return {
        "score": score, "inspection_count": total_inspections,
        "clinic_count": len(clinics), "basis": "clinic_average",
    }
