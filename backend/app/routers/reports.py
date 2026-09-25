import re
from datetime import datetime, timedelta
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from sqlalchemy import func
import io
from ..database import get_db
from ..models.inspection import Inspection, InspectionStatus
from ..models.corrective_action import CorrectiveAction, ActionStatus
from ..models.certification import TeamCertification, CertStatus
from ..models.audit import AuditReview, AuditStatus
from ..models.clinic import Clinic
from ..models.user import User, UserRole
from ..utils.hierarchy_scope import scoped_clinic_ids as get_scoped_clinic_ids
from ..services.hierarchy_score import clinic_compliance_score, person_compliance_score
from .deps import get_current_user, require_admin_or_auditor

router = APIRouter(prefix="/reports", tags=["reports"])


def _parse_date(s: Optional[str], end_of_day: bool = False) -> Optional[datetime]:
    if not s:
        return None
    d = datetime.strptime(s, "%Y-%m-%d")
    if end_of_day:
        d = d.replace(hour=23, minute=59, second=59)
    return d


def _scope_slug(scope_label: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", scope_label.lower()).strip("-") or "all"


def _role_label(user: User) -> str:
    labels = {
        "clinic_lead": "Clinic Lead", "regional_manager": "Regional Manager",
        "director_of_operations": "Director of Operations", "executive": "Executive",
    }
    custom_role = (user.custom_role or "").strip().lower()
    if custom_role in labels:
        return labels[custom_role]
    if user.role == UserRole.admin:
        return "Admin"
    return "MA/PCT"


def _direct_reports(db: Session, subject: User) -> list:
    """People one level below `subject` in the review hierarchy. There's no formal
    reporting-line field in this app, so this is inferred the same way the rest of
    the app already infers it: a Regional Manager's reports are the Clinic Leads
    managing a clinic in their region; a Clinic Lead's reports are the MAs/PCTs who
    have actually inspected at one of their clinics (same idea as the shared-checklist
    model -- "who's done work here" rather than a formal roster); Director of
    Operations/Executive/Admin's reports are the tenant's Regional Managers. A plain
    MA/PCT has no reports -- they're the leaf of the hierarchy."""
    custom_role = (subject.custom_role or "").strip().lower()
    tenant_id = subject.tenant_id

    if subject.role == UserRole.admin or custom_role in ("director_of_operations", "executive"):
        return db.query(User).filter(
            User.tenant_id == tenant_id, User.is_active == True, User.custom_role == "regional_manager",
        ).order_by(User.full_name).all()

    if custom_role == "regional_manager" and subject.managed_region:
        clinic_ids = [i for (i,) in db.query(Clinic.id).filter(
            Clinic.tenant_id == tenant_id, Clinic.region == subject.managed_region).all()]
        if not clinic_ids:
            return []
        manager_ids = {i for (i,) in db.query(Clinic.manager_id).filter(
            Clinic.id.in_(clinic_ids), Clinic.manager_id.isnot(None)).all()}
        if not manager_ids:
            return []
        return db.query(User).filter(
            User.id.in_(manager_ids), User.tenant_id == tenant_id, User.is_active == True,
            User.custom_role == "clinic_lead",
        ).order_by(User.full_name).all()

    if custom_role == "clinic_lead" or subject.role == UserRole.manager:
        clinic_ids = [i for (i,) in db.query(Clinic.id).filter(Clinic.manager_id == subject.id).all()]
        if not clinic_ids:
            return []
        inspector_ids = {i for (i,) in db.query(Inspection.inspector_id).filter(
            Inspection.clinic_id.in_(clinic_ids)).distinct().all()}
        if not inspector_ids:
            return []
        return db.query(User).filter(
            User.id.in_(inspector_ids), User.tenant_id == tenant_id, User.is_active == True,
        ).order_by(User.full_name).all()

    return []


def _can_view_person(db: Session, current_user: User, target: User) -> bool:
    """Whether current_user may view target's rollup: themself, an admin/Director of
    Operations/Executive (see everyone in the tenant), or anyone reachable by walking
    down current_user's own _direct_reports chain -- so a Regional Manager can view a
    Clinic Lead's report, and through them an MA's, but not another region's."""
    if target.id == current_user.id:
        return True
    if target.tenant_id != current_user.tenant_id:
        return False
    custom_role = (current_user.custom_role or "").strip().lower()
    if current_user.role == UserRole.admin or custom_role in ("director_of_operations", "executive"):
        return True
    frontier = _direct_reports(db, current_user)
    seen = set()
    while frontier:
        nxt = []
        for u in frontier:
            if u.id == target.id:
                return True
            if u.id in seen:
                continue
            seen.add(u.id)
            nxt.extend(_direct_reports(db, u))
        frontier = nxt
    return False


def _visible_assignees(db: Session, current_user: User) -> list:
    """People the current user could reasonably filter a report by: everyone in the
    tenant for an oversight role that sees everything, or -- for a scoped role --
    whoever has actually inspected or manages within that scope, plus themselves."""
    custom_role = (current_user.custom_role or "").strip().lower()
    if current_user.role == UserRole.admin or custom_role in ("director_of_operations", "executive"):
        return db.query(User).filter(
            User.tenant_id == current_user.tenant_id, User.is_active == True,
        ).order_by(User.full_name).all()
    clinic_ids, _ = get_scoped_clinic_ids(db, current_user)
    if clinic_ids is None:
        return db.query(User).filter(
            User.tenant_id == current_user.tenant_id, User.is_active == True,
        ).order_by(User.full_name).all()
    if not clinic_ids:
        return [current_user]
    inspector_ids = {i for (i,) in db.query(Inspection.inspector_id).filter(
        Inspection.clinic_id.in_(clinic_ids)).distinct().all()}
    manager_ids = {i for (i,) in db.query(Clinic.manager_id).filter(
        Clinic.id.in_(clinic_ids), Clinic.manager_id.isnot(None)).all()}
    ids = inspector_ids | manager_ids | {current_user.id}
    return db.query(User).filter(
        User.id.in_(ids), User.is_active == True,
    ).order_by(User.full_name).all()


_FREQUENCY_PERIODS = {
    "daily": "today",
    "weekly": "this week",
    "monthly": "this month",
}


def _period_bounds(frequency: str, now: datetime) -> tuple:
    """Start/end of the current period for this frequency -- what counts as
    "on time" for a submission right now."""
    if frequency == "weekly":
        start = (now - timedelta(days=now.weekday())).replace(hour=0, minute=0, second=0, microsecond=0)
        return start, start + timedelta(days=7)
    if frequency == "monthly":
        start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
        next_month = (start.replace(day=28) + timedelta(days=4)).replace(day=1)
        return start, next_month
    start = now.replace(hour=0, minute=0, second=0, microsecond=0)
    return start, start + timedelta(days=1)


@router.get("/hierarchy")
def hierarchy_dashboard(region: Optional[str] = None, view_as_user_id: Optional[int] = None,
                        frequency: str = "daily",
                        db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """
    Rollup of checklist completion (daily, weekly, or monthly) and open issues,
    scoped to the viewer's place in the org: a Clinic Lead (manager) sees their
    own clinics, a Regional Manager sees their region, and Director of
    Operations / Executive / Admin see every region.

    Admins may pass view_as_user_id to preview the dashboard exactly as that
    person would see it (their own scope, not the admin's), and region to
    narrow down to one region within whatever scope applies.
    """
    from ..models.checklist import ChecklistTemplate

    if frequency not in _FREQUENCY_PERIODS:
        raise HTTPException(status_code=400, detail=f"frequency must be one of {list(_FREQUENCY_PERIODS)}")

    period_start, period_end = _period_bounds(frequency, datetime.utcnow())

    viewing_as = None
    scope_user = current_user
    if view_as_user_id is not None:
        if current_user.role != UserRole.admin:
            raise HTTPException(status_code=403, detail="Only admins can view another user's dashboard")
        target = db.query(User).filter(User.id == view_as_user_id, User.tenant_id == current_user.tenant_id).first()
        if not target:
            raise HTTPException(status_code=404, detail="User not found")
        scope_user = target
        viewing_as = {
            "id": target.id,
            "full_name": target.full_name,
            "custom_role": target.custom_role,
            "managed_region": target.managed_region,
        }

    # custom_role is stored as the slugified role name (e.g. "regional_manager"),
    # matching Role.name — not the human-readable display name.
    custom_role = (scope_user.custom_role or "").strip().lower()
    clinics_q = db.query(Clinic).filter(Clinic.tenant_id == current_user.tenant_id, Clinic.is_active == True)

    if scope_user.role == UserRole.admin or custom_role in ("director_of_operations", "executive"):
        scope_label = "All Regions"
    elif custom_role == "regional_manager":
        if scope_user.managed_region:
            clinics_q = clinics_q.filter(Clinic.region == scope_user.managed_region)
            scope_label = f"Region: {scope_user.managed_region}"
        else:
            # No region assigned yet -- scope to nothing rather than silently
            # falling through to "every clinic in the tenant" below.
            clinics_q = clinics_q.filter(Clinic.id.in_([]))
            scope_label = "No region assigned"
    elif custom_role == "clinic_lead" or scope_user.role == UserRole.manager:
        clinics_q = clinics_q.filter(Clinic.manager_id == scope_user.id)
        scope_label = "Your Clinics"
    else:
        scope_label = "All Regions"

    # Regions available within this scope, before the optional region filter narrows it —
    # lets the frontend offer only the regions that actually mean something here.
    available_regions = sorted({
        r for (r,) in clinics_q.with_entities(Clinic.region).distinct().all() if r
    })

    if region:
        clinics_q = clinics_q.filter(Clinic.region == region)
        scope_label = f"{scope_label} — Region: {region}" if scope_label != "All Regions" else f"Region: {region}"

    clinics = clinics_q.order_by(Clinic.region, Clinic.name).all()

    period_templates = (db.query(ChecklistTemplate)
                        .filter(ChecklistTemplate.tenant_id == current_user.tenant_id,
                                ChecklistTemplate.frequency == frequency,
                                ChecklistTemplate.is_active == True)
                        .all())

    def applicable_templates(clinic):
        return [t for t in period_templates if t.department_id is None or t.department_id == clinic.department_id]

    clinic_rows = []
    missing = []
    submitted_count = 0
    for c in clinics:
        applicable = applicable_templates(c)
        if not applicable:
            status_str = "no_template"
            missing_names = []
        else:
            template_ids = [t.id for t in applicable]
            submitted_ids = {
                row[0] for row in db.query(Inspection.template_id).filter(
                    Inspection.clinic_id == c.id,
                    Inspection.template_id.in_(template_ids),
                    Inspection.checkin_time >= period_start,
                    Inspection.checkin_time < period_end,
                ).distinct().all()
            }
            missing_names = [t.name for t in applicable if t.id not in submitted_ids]
            status_str = "submitted" if not missing_names else "missing"

        if status_str == "submitted":
            submitted_count += 1

        open_actions = db.query(CorrectiveAction).filter(
            CorrectiveAction.clinic_id == c.id,
            CorrectiveAction.status.in_([ActionStatus.open, ActionStatus.in_progress, ActionStatus.pending_verification]),
        ).count()

        row = {
            "clinic_id": c.id,
            "clinic_name": c.name,
            "region": c.region or "Unassigned",
            "manager_name": c.manager.full_name if c.manager else None,
            "status": status_str,
            "missing_templates": missing_names,
            "open_corrective_actions": open_actions,
        }
        clinic_rows.append(row)
        if status_str == "missing":
            missing.append(row)

    regions: dict = {}
    for row in clinic_rows:
        regions.setdefault(row["region"], []).append(row)
    region_summaries = [
        {
            "region": r,
            "clinics": rows,
            "total": len(rows),
            "submitted": sum(1 for x in rows if x["status"] == "submitted"),
            "missing": sum(1 for x in rows if x["status"] == "missing"),
        }
        for r, rows in sorted(regions.items(), key=lambda kv: (kv[0] == "Unassigned", kv[0]))
    ]

    # One card per Clinic Lead (grouped from the same rows above — no extra queries),
    # so it's obvious at a glance whose clinics are behind, not just which clinics.
    leads: dict = {}
    for row in clinic_rows:
        key = row["manager_name"] or "Unassigned"
        entry = leads.setdefault(key, {
            "name": key, "total_clinics": 0, "submitted": 0,
            "missing": 0, "open_corrective_actions": 0,
        })
        entry["total_clinics"] += 1
        if row["status"] == "submitted":
            entry["submitted"] += 1
        elif row["status"] == "missing":
            entry["missing"] += 1
        entry["open_corrective_actions"] += row["open_corrective_actions"]
    by_individual = sorted(leads.values(), key=lambda x: (-x["missing"], x["name"]))

    return {
        "scope_label": scope_label,
        "viewing_as": viewing_as,
        "available_regions": available_regions,
        "as_of": datetime.utcnow().isoformat(),
        "frequency": frequency,
        "period_label": _FREQUENCY_PERIODS[frequency],
        "has_templates": len(period_templates) > 0,
        "summary": {
            "total_clinics": len(clinic_rows),
            "submitted": submitted_count,
            "missing": len(missing),
        },
        "missing_clinics": missing,
        "regions": region_summaries,
        "by_individual": by_individual,
    }


@router.get("/dashboard")
def dashboard(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    from ..models.user import UserRole
    now = datetime.utcnow()
    tenant_id = current_user.tenant_id
    scoped_clinic_ids, scope_label = get_scoped_clinic_ids(db, current_user)

    q_insp = db.query(Inspection).filter(Inspection.tenant_id == tenant_id)
    q_actions = db.query(CorrectiveAction).filter(CorrectiveAction.tenant_id == tenant_id)
    # TeamCertification has no tenant_id of its own -- scope it through its course.
    from ..models.certification import Course
    q_certs = (db.query(TeamCertification)
               .join(Course, TeamCertification.course_id == Course.id)
               .filter(Course.tenant_id == tenant_id))

    if scoped_clinic_ids is not None:
        q_insp = q_insp.filter(Inspection.clinic_id.in_(scoped_clinic_ids))
        q_actions = q_actions.filter(CorrectiveAction.clinic_id.in_(scoped_clinic_ids))

    total_inspections = q_insp.count()
    approved = q_insp.filter(Inspection.status == InspectionStatus.approved).count()
    pending_review = q_insp.filter(Inspection.status.in_([InspectionStatus.submitted, InspectionStatus.under_review])).count()
    avg_score = q_insp.with_entities(func.avg(Inspection.compliance_score)).filter(
        Inspection.compliance_score.isnot(None)).scalar()

    open_actions = q_actions.filter(CorrectiveAction.status.in_([ActionStatus.open, ActionStatus.in_progress, ActionStatus.pending_verification])).count()
    overdue_actions = q_actions.filter(
        CorrectiveAction.status.in_([ActionStatus.open, ActionStatus.in_progress]),
        CorrectiveAction.due_date < now.date(),
    ).count()

    total_certs = q_certs.count()
    completed_certs = q_certs.filter(TeamCertification.status == CertStatus.completed).count()
    expiring_certs = q_certs.filter(
        TeamCertification.status == CertStatus.completed,
        TeamCertification.expires_at.isnot(None),
        TeamCertification.expires_at <= now + timedelta(days=30),
        TeamCertification.expires_at > now,
    ).count()

    # AuditReview has no tenant_id of its own -- scope it through its inspection.
    q_audits = (db.query(AuditReview)
                .join(Inspection, AuditReview.inspection_id == Inspection.id)
                .filter(Inspection.tenant_id == tenant_id))
    if scoped_clinic_ids is not None:
        q_audits = q_audits.filter(Inspection.clinic_id.in_(scoped_clinic_ids))
    elif current_user.role == UserRole.auditor:
        q_audits = q_audits.filter(AuditReview.auditor_id == current_user.id)
    audit_counts = {s.value: q_audits.filter(AuditReview.status == s).count() for s in AuditStatus}
    audit_decided = audit_counts["approved"] + audit_counts["rejected"]
    audit_summary = {
        **audit_counts,
        "total": sum(audit_counts.values()),
        "approval_rate": round(audit_counts["approved"] / audit_decided * 100, 1) if audit_decided else None,
    }

    # Clinics by risk level
    clinics_q = db.query(Clinic).filter(Clinic.tenant_id == tenant_id, Clinic.is_active == True)
    if scoped_clinic_ids is not None:
        clinics_q = clinics_q.filter(Clinic.id.in_(scoped_clinic_ids))
    clinics = clinics_q.all()
    risk_breakdown = {"low": 0, "medium": 0, "high": 0, "critical": 0, "unknown": 0}
    clinic_scores = []
    for c in clinics:
        latest = (db.query(Inspection)
                  .filter(Inspection.clinic_id == c.id, Inspection.compliance_score.isnot(None))
                  .order_by(Inspection.submitted_at.desc()).first())
        if latest:
            risk = latest.risk_level or "unknown"
            risk_breakdown[risk] = risk_breakdown.get(risk, 0) + 1
            clinic_scores.append({
                "clinic_id": c.id, "clinic_name": c.name,
                "score": latest.compliance_score, "risk_level": latest.risk_level,
                "last_inspection": str(latest.submitted_at) if latest.submitted_at else None,
            })
        else:
            risk_breakdown["unknown"] += 1

    recent = (q_insp.filter(Inspection.compliance_score.isnot(None))
              .order_by(Inspection.submitted_at.desc()).limit(10).all())

    trend = []
    for i in range(5, -1, -1):
        start = (now - timedelta(days=30 * (i + 1))).replace(day=1)
        end = (now - timedelta(days=30 * i)).replace(day=1)
        trend_q = db.query(func.avg(Inspection.compliance_score)).filter(
            Inspection.tenant_id == tenant_id,
            Inspection.submitted_at >= start, Inspection.submitted_at < end,
            Inspection.compliance_score.isnot(None))
        if scoped_clinic_ids is not None:
            trend_q = trend_q.filter(Inspection.clinic_id.in_(scoped_clinic_ids))
        avg = trend_q.scalar()
        trend.append({"month": start.strftime("%b %Y"), "avg_score": round(avg or 0, 1)})

    return {
        "scope_label": scope_label,
        "summary": {
            "total_inspections": total_inspections,
            "approved_inspections": approved,
            "pending_review": pending_review,
            "avg_compliance_score": round(avg_score or 0, 1),
            "open_corrective_actions": open_actions,
            "overdue_corrective_actions": overdue_actions,
            "total_certifications": total_certs,
            "completed_certifications": completed_certs,
            "expiring_certifications": expiring_certs,
        },
        "risk_breakdown": risk_breakdown,
        "clinic_scores": clinic_scores,
        "trend": trend,
        "audit_summary": audit_summary,
        "recent_inspections": [
            {
                "id": i.id,
                "clinic_name": i.clinic.name if i.clinic else None,
                "score": i.compliance_score,
                "risk_level": i.risk_level,
                "status": i.status.value if i.status else None,
                "submitted_at": str(i.submitted_at) if i.submitted_at else None,
            }
            for i in recent
        ],
    }


@router.get("/my-tasks")
def my_tasks(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """Staff-level view: my assigned tasks, my certifications, my inspection history."""
    actions = db.query(CorrectiveAction).filter(
        CorrectiveAction.assigned_to == current_user.id,
        CorrectiveAction.status.in_([ActionStatus.open, ActionStatus.in_progress]),
    ).order_by(CorrectiveAction.due_date).limit(20).all()

    certs = db.query(TeamCertification).filter(
        TeamCertification.participant_email == current_user.email,
    ).order_by(TeamCertification.created_at.desc()).limit(20).all()

    inspections = db.query(Inspection).filter(
        Inspection.inspector_id == current_user.id,
    ).order_by(Inspection.created_at.desc()).limit(10).all()

    return {
        "assigned_actions": [
            {"id": a.id, "title": a.title, "status": a.status.value,
             "priority": a.priority, "due_date": str(a.due_date) if a.due_date else None,
             "clinic_name": a.clinic.name if a.clinic else None}
            for a in actions
        ],
        "certifications": [
            {"id": c.id, "course_title": c.course.title if c.course else None,
             "status": c.status.value, "score": c.score,
             "expires_at": str(c.expires_at) if c.expires_at else None}
            for c in certs
        ],
        "recent_inspections": [
            {"id": i.id, "clinic_name": i.clinic.name if i.clinic else None,
             "score": i.compliance_score, "status": i.status.value,
             "created_at": str(i.created_at)}
            for i in inspections
        ],
    }


@router.get("/compliance/filters")
def compliance_filters(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """Options for the Reports page's filter bar: clinic, region ("location"),
    checklist template, and assignee -- all narrowed to what current_user is
    actually allowed to see, same scoping every other endpoint here uses."""
    from ..models.checklist import ChecklistTemplate
    clinic_ids, scope_label = get_scoped_clinic_ids(db, current_user)
    clinics_q = db.query(Clinic).filter(Clinic.tenant_id == current_user.tenant_id, Clinic.is_active == True)
    if clinic_ids is not None:
        clinics_q = clinics_q.filter(Clinic.id.in_(clinic_ids))
    clinics = clinics_q.order_by(Clinic.name).all()
    regions = sorted({c.region for c in clinics if c.region})
    templates = db.query(ChecklistTemplate).filter(
        ChecklistTemplate.tenant_id == current_user.tenant_id, ChecklistTemplate.is_active == True,
    ).order_by(ChecklistTemplate.name).all()
    assignees = _visible_assignees(db, current_user)
    return {
        "scope_label": scope_label,
        "clinics": [{"id": c.id, "name": c.name, "region": c.region} for c in clinics],
        "regions": regions,
        "templates": [{"id": t.id, "name": t.name} for t in templates],
        "assignees": [{"id": u.id, "name": u.full_name} for u in assignees],
    }


@router.get("/compliance/clinics")
def compliance_clinics(clinic_id: Optional[int] = None, region: Optional[str] = None,
                       date_from: Optional[str] = None, date_to: Optional[str] = None,
                       assignee_id: Optional[int] = None, template_id: Optional[int] = None,
                       db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """Every clinic current_user can see, each with its own compliance score
    (avg of its inspections' scores) -- the "compliance score on each clinic"
    row of the report, filterable and click-through-able to that clinic's
    existing profile page on the frontend."""
    scoped_ids, scope_label = get_scoped_clinic_ids(db, current_user)
    q = db.query(Clinic).filter(Clinic.tenant_id == current_user.tenant_id, Clinic.is_active == True)
    if scoped_ids is not None:
        q = q.filter(Clinic.id.in_(scoped_ids))
    if clinic_id:
        q = q.filter(Clinic.id == clinic_id)
    if region:
        q = q.filter(Clinic.region == region)

    df, dt = _parse_date(date_from), _parse_date(date_to, end_of_day=True)

    if assignee_id:
        insp_q = db.query(Inspection.clinic_id).filter(Inspection.inspector_id == assignee_id)
        if df:
            insp_q = insp_q.filter(Inspection.submitted_at >= df)
        if dt:
            insp_q = insp_q.filter(Inspection.submitted_at <= dt)
        matching = {i for (i,) in insp_q.distinct().all()}
        matching |= {i for (i,) in db.query(CorrectiveAction.clinic_id).filter(
            CorrectiveAction.assigned_to == assignee_id).distinct().all()}
        q = q.filter(Clinic.id.in_(matching)) if matching else q.filter(Clinic.id.in_([]))

    clinics = q.order_by(Clinic.region, Clinic.name).all()
    rows = []
    scored = []
    total_inspections = 0
    for c in clinics:
        result = clinic_compliance_score(db, c, date_from=df, date_to=dt, template_id=template_id)
        rows.append({
            "clinic_id": c.id, "clinic_name": c.name, "region": c.region,
            "manager_name": c.manager.full_name if c.manager else None,
            "score": result["score"], "inspection_count": result["inspection_count"],
        })
        total_inspections += result["inspection_count"]
        if result["score"] is not None:
            scored.append(result["score"])

    # A single top-line number for the whole filtered view -- the simple average
    # of the clinics actually scored, same math as every other level of the
    # hierarchy (a large clinic doesn't outweigh a small one).
    overall = {
        "score": round(sum(scored) / len(scored), 1) if scored else None,
        "clinic_count": len(rows),
        "scored_clinic_count": len(scored),
        "inspection_count": total_inspections,
    }
    return {"scope_label": scope_label, "overall": overall, "clinics": rows}


@router.get("/compliance/checklists")
def compliance_checklists(clinic_id: Optional[int] = None, region: Optional[str] = None,
                          date_from: Optional[str] = None, date_to: Optional[str] = None,
                          assignee_id: Optional[int] = None, template_id: Optional[int] = None,
                          db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """Every checklist template actually used within current_user's scope and the
    given filters, each with its own compliance score (avg across every inspection
    that used it) -- the "compliance score on each checklist" row of the report.
    template_id narrows this to a single template's own score/trend, for a
    checklist's drill-down page."""
    from ..models.checklist import ChecklistTemplate
    scoped_ids, _ = get_scoped_clinic_ids(db, current_user)
    q = db.query(Inspection).filter(
        Inspection.tenant_id == current_user.tenant_id, Inspection.compliance_score.isnot(None))
    if scoped_ids is not None:
        q = q.filter(Inspection.clinic_id.in_(scoped_ids))
    if clinic_id:
        q = q.filter(Inspection.clinic_id == clinic_id)
    if template_id:
        q = q.filter(Inspection.template_id == template_id)
    if region:
        q = q.join(Clinic, Inspection.clinic_id == Clinic.id).filter(Clinic.region == region)
    df, dt = _parse_date(date_from), _parse_date(date_to, end_of_day=True)
    if df:
        q = q.filter(Inspection.submitted_at >= df)
    if dt:
        q = q.filter(Inspection.submitted_at <= dt)
    if assignee_id:
        action_insp_ids = {i for (i,) in db.query(CorrectiveAction.inspection_id).filter(
            CorrectiveAction.assigned_to == assignee_id, CorrectiveAction.inspection_id.isnot(None)).all()}
        if action_insp_ids:
            q = q.filter((Inspection.inspector_id == assignee_id) | (Inspection.id.in_(action_insp_ids)))
        else:
            q = q.filter(Inspection.inspector_id == assignee_id)

    by_template: dict = {}
    for i in q.all():
        by_template.setdefault(i.template_id, []).append(i)

    tmap = {}
    if by_template:
        tmap = {t.id: t for t in db.query(ChecklistTemplate).filter(
            ChecklistTemplate.id.in_(by_template.keys())).all()}

    rows = []
    for tid, insps in by_template.items():
        scores = [i.compliance_score for i in insps if i.compliance_score is not None]
        t = tmap.get(tid)
        rows.append({
            "template_id": tid,
            "template_name": t.name if t else f"Template #{tid}",
            "score": round(sum(scores) / len(scores), 1) if scores else None,
            "inspection_count": len(insps),
            "clinic_count": len({i.clinic_id for i in insps}),
        })
    rows.sort(key=lambda r: r["template_name"])
    return {"checklists": rows}


@router.get("/compliance/people")
def compliance_people(as_user_id: Optional[int] = None, region: Optional[str] = None,
                      date_from: Optional[str] = None, date_to: Optional[str] = None,
                      template_id: Optional[int] = None,
                      db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """The hierarchical "compliance score on each Regional Manager/Clinic Lead/MA"
    view: one person's own score plus the people directly below them, each already
    carrying their own score -- click one of `reports` and call this again with
    as_user_id set to drill further down, same pattern as clicking into a clinic."""
    subject = current_user
    if as_user_id is not None and as_user_id != current_user.id:
        target = db.query(User).filter(User.id == as_user_id).first()
        if not target:
            raise HTTPException(status_code=404, detail="User not found")
        if not _can_view_person(db, current_user, target):
            raise HTTPException(status_code=403, detail="You can't view this person's report")
        subject = target

    df, dt = _parse_date(date_from), _parse_date(date_to, end_of_day=True)
    own = person_compliance_score(db, subject, date_from=df, date_to=dt, template_id=template_id, region=region)
    reports = []
    for u in _direct_reports(db, subject):
        r = person_compliance_score(db, u, date_from=df, date_to=dt, template_id=template_id, region=region)
        reports.append({"id": u.id, "name": u.full_name, "role_label": _role_label(u), **r})

    return {
        "subject": {
            "id": subject.id, "name": subject.full_name, "role_label": _role_label(subject),
            "region": subject.managed_region, **own,
        },
        "reports": reports,
    }


# The 3 standard checklists the compliance matrix tracks -- looked up by their exact
# names since there's no other way to identify "the daily one" vs "the monthly one"
# vs the RM's own site-visit checklist. A tenant missing one of these templates just
# gets None for that column, not an error.
_MATRIX_TEMPLATES = [
    ("ma_daily", "MA/PCT Daily Check List"),
    ("ma_monthly", "MA/PCT Monthly Check List"),
    ("rm_checklist", "Regional Manager Clinic Site Visit"),
]


def _month_start(now: datetime) -> datetime:
    return now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)


def _months_before(now: datetime, n: int) -> datetime:
    """First day of the month n months before the current one."""
    first_of_this_month = _month_start(now)
    month = first_of_this_month.month - n
    year = first_of_this_month.year
    while month <= 0:
        month += 12
        year -= 1
    return first_of_this_month.replace(year=year, month=month)


def _trailing_3_months_start(now: datetime) -> datetime:
    """First day of the month 2 months before the current one -- a rolling 3
    calendar-month window (this month, last month, the month before) that always
    includes the current, still-in-progress month."""
    return _months_before(now, 2)


def _avg_score(db: Session, tenant_id: int, template_id: int, clinic_ids: Optional[list] = None,
              date_from: Optional[datetime] = None) -> Optional[float]:
    q = db.query(func.avg(Inspection.compliance_score)).filter(
        Inspection.tenant_id == tenant_id, Inspection.template_id == template_id,
        Inspection.compliance_score.isnot(None))
    if clinic_ids is not None:
        q = q.filter(Inspection.clinic_id.in_(clinic_ids))
    if date_from is not None:
        q = q.filter(Inspection.submitted_at >= date_from)
    val = q.scalar()
    return round(val, 1) if val is not None else None


def _avg_score_period(db: Session, tenant_id: int, clinic_ids: Optional[list] = None,
                      date_from: Optional[datetime] = None, date_to: Optional[datetime] = None) -> Optional[float]:
    """Same as _avg_score but across every checklist template, not just one --
    used for the CEO summary's headline number and region rollups."""
    q = db.query(func.avg(Inspection.compliance_score)).filter(
        Inspection.tenant_id == tenant_id, Inspection.compliance_score.isnot(None))
    if clinic_ids is not None:
        q = q.filter(Inspection.clinic_id.in_(clinic_ids))
    if date_from is not None:
        q = q.filter(Inspection.submitted_at >= date_from)
    if date_to is not None:
        q = q.filter(Inspection.submitted_at < date_to)
    val = q.scalar()
    return round(val, 1) if val is not None else None


@router.get("/compliance-matrix")
def compliance_matrix(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """The Region -> Clinic grid the Executive Dashboard leads with: for each of the
    3 standard checklists, every clinic's current-month score, trailing-3-month
    score, and the enterprise-wide average for that same checklist to compare
    against. The enterprise number is always computed across every clinic in the
    tenant, regardless of the viewer's own scope -- a Regional Manager/Clinic Lead
    should be able to see how their clinics compare to the whole org, not just
    their own slice of it. Rows themselves are scoped normally (admin/Director/
    Executive see every region; a Regional Manager sees their region; a Clinic
    Lead sees their clinics)."""
    from ..models.checklist import ChecklistTemplate

    now = datetime.utcnow()
    month_start = _month_start(now)
    trailing_start = _trailing_3_months_start(now)

    templates = {}
    for key, name in _MATRIX_TEMPLATES:
        t = db.query(ChecklistTemplate).filter(
            ChecklistTemplate.tenant_id == current_user.tenant_id, ChecklistTemplate.name == name,
        ).first()
        templates[key] = {"id": t.id, "name": t.name} if t else None

    enterprise = {
        key: (_avg_score(db, current_user.tenant_id, meta["id"]) if meta else None)
        for key, meta in templates.items()
    }

    clinic_ids, scope_label = get_scoped_clinic_ids(db, current_user)
    clinics_q = db.query(Clinic).filter(Clinic.tenant_id == current_user.tenant_id, Clinic.is_active == True)
    if clinic_ids is not None:
        clinics_q = clinics_q.filter(Clinic.id.in_(clinic_ids))
    clinics = clinics_q.order_by(Clinic.region, Clinic.name).all()

    regions: dict = {}
    for c in clinics:
        row = {"clinic_id": c.id, "clinic_name": c.name}
        for key, meta in templates.items():
            if not meta:
                row[key] = {"current_month": None, "three_month": None}
                continue
            row[key] = {
                "current_month": _avg_score(db, current_user.tenant_id, meta["id"],
                                            clinic_ids=[c.id], date_from=month_start),
                "three_month": _avg_score(db, current_user.tenant_id, meta["id"],
                                          clinic_ids=[c.id], date_from=trailing_start),
            }
        region_name = c.region or "Unassigned"
        regions.setdefault(region_name, []).append(row)

    region_list = [
        {"region": r, "clinics": rows}
        for r, rows in sorted(regions.items(), key=lambda kv: (kv[0] == "Unassigned", kv[0]))
    ]

    return {
        "scope_label": scope_label,
        "templates": templates,
        "enterprise": enterprise,
        "regions": region_list,
    }


# A region's month-over-month change smaller than this is noise, not a real "declining"
# trend -- avoids flagging a region as an exception over a 0.1pt wobble.
_TREND_EPSILON = 0.5


@router.get("/ceo-summary")
def ceo_summary(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """Headline snapshot for the top of the Executive Dashboard: one score (scoped to
    the viewer, same as everywhere else) with a trend arrow, plus a short, exceptions-
    only list of regions that need attention -- below the configured amber threshold,
    or declining month over month -- each with the accountable Regional Manager
    attached. Everything else on the page is the drill-down; this is the 30-second
    answer to "is the company compliant, and where's the fire."""
    from ..models.org_settings import OrgSettings

    now = datetime.utcnow()
    month_start = _month_start(now)
    last_month_start = _months_before(now, 1)

    settings_row = db.query(OrgSettings).first()
    amber_threshold = (settings_row.compliance_amber_threshold if settings_row else None) or 80

    clinic_ids, scope_label = get_scoped_clinic_ids(db, current_user)

    overall_this_month = _avg_score_period(db, current_user.tenant_id, clinic_ids=clinic_ids, date_from=month_start)
    overall_last_month = _avg_score_period(db, current_user.tenant_id, clinic_ids=clinic_ids,
                                           date_from=last_month_start, date_to=month_start)
    overall_trend = (round(overall_this_month - overall_last_month, 1)
                     if overall_this_month is not None and overall_last_month is not None else None)

    clinics_q = db.query(Clinic).filter(Clinic.tenant_id == current_user.tenant_id, Clinic.is_active == True)
    if clinic_ids is not None:
        clinics_q = clinics_q.filter(Clinic.id.in_(clinic_ids))
    clinics = clinics_q.all()

    by_region: dict = {}
    for c in clinics:
        by_region.setdefault(c.region or "Unassigned", []).append(c.id)

    exceptions = []
    healthy_count = 0
    for region, region_clinic_ids in by_region.items():
        this_month = _avg_score_period(db, current_user.tenant_id, clinic_ids=region_clinic_ids, date_from=month_start)
        last_month = _avg_score_period(db, current_user.tenant_id, clinic_ids=region_clinic_ids,
                                       date_from=last_month_start, date_to=month_start)
        trend = (round(this_month - last_month, 1)
                if this_month is not None and last_month is not None else None)

        below_threshold = this_month is not None and this_month < amber_threshold
        declining = trend is not None and trend < -_TREND_EPSILON
        if not (below_threshold or declining):
            healthy_count += 1
            continue

        owner = None
        if region != "Unassigned":
            owner = db.query(User).filter(
                User.tenant_id == current_user.tenant_id, User.is_active == True,
                User.custom_role == "regional_manager", User.managed_region == region,
            ).first()

        reasons = []
        if below_threshold:
            reasons.append("below_threshold")
        if declining:
            reasons.append("declining")

        exceptions.append({
            "region": region,
            "score": this_month,
            "previous_score": last_month,
            "trend": trend,
            "reasons": reasons,
            "clinic_count": len(region_clinic_ids),
            "owner_name": owner.full_name if owner else None,
            "owner_id": owner.id if owner else None,
        })

    # Worst score first; a region with no inspections yet (score is None) sorts last --
    # it's a gap worth noticing, but a 55% clinic is the more urgent fire.
    exceptions.sort(key=lambda e: (e["score"] is None, e["score"] if e["score"] is not None else 0))

    return {
        "scope_label": scope_label,
        "period_label": now.strftime("%B %Y"),
        "amber_threshold": amber_threshold,
        "overall": {
            "score": overall_this_month,
            "previous_score": overall_last_month,
            "trend": overall_trend,
        },
        "exceptions": exceptions,
        "healthy_region_count": healthy_count,
    }


@router.get("/inspection-calendar")
def inspection_calendar(template_id: int, year: int, month: int,
                        db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """The "Inspection Wise Report" drill-down: pick one checklist template and one
    month, get a day-by-day compliance grid across whatever clinics current_user
    can see. A cell carries the inspection id it came from so the frontend can
    link straight to that checklist rather than duplicating item-level detail
    here -- that detail already lives on the inspection itself."""
    from ..models.checklist import ChecklistTemplate

    if not (1 <= month <= 12):
        raise HTTPException(status_code=400, detail="month must be between 1 and 12")

    template = db.query(ChecklistTemplate).filter(
        ChecklistTemplate.id == template_id, ChecklistTemplate.tenant_id == current_user.tenant_id,
    ).first()
    if not template:
        raise HTTPException(status_code=404, detail="Checklist template not found")

    month_start = datetime(year, month, 1)
    next_month = datetime(year + 1, 1, 1) if month == 12 else datetime(year, month + 1, 1)

    clinic_ids, scope_label = get_scoped_clinic_ids(db, current_user)
    clinics_q = db.query(Clinic).filter(Clinic.tenant_id == current_user.tenant_id, Clinic.is_active == True)
    if clinic_ids is not None:
        clinics_q = clinics_q.filter(Clinic.id.in_(clinic_ids))
    clinics = clinics_q.order_by(Clinic.region, Clinic.name).all()

    q = db.query(Inspection).filter(
        Inspection.tenant_id == current_user.tenant_id, Inspection.template_id == template_id,
        Inspection.submitted_at >= month_start, Inspection.submitted_at < next_month,
        Inspection.compliance_score.isnot(None),
    )
    if clinic_ids is not None:
        q = q.filter(Inspection.clinic_id.in_(clinic_ids))

    by_clinic_day: dict = {}
    for i in q.all():
        by_clinic_day.setdefault(i.clinic_id, {}).setdefault(i.submitted_at.day, []).append(i)

    rows = []
    for c in clinics:
        days = {}
        for day, items in by_clinic_day.get(c.id, {}).items():
            scores = [x.compliance_score for x in items]
            days[str(day)] = {
                "score": round(sum(scores) / len(scores), 1),
                "inspection_id": items[0].id,  # first that day -- the cell links through to it
                "count": len(items),
            }
        rows.append({"clinic_id": c.id, "clinic_name": c.name, "region": c.region, "days": days})

    return {
        "scope_label": scope_label,
        "template": {"id": template.id, "name": template.name},
        "year": year, "month": month,
        "days_in_month": (next_month - month_start).days,
        "clinics": rows,
    }


@router.get("/compliance-trends")
def compliance_trends(clinic_id: Optional[int] = None, days: int = 180,
                      template_id: Optional[int] = None, region: Optional[str] = None,
                      assignee_id: Optional[int] = None,
                      db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    now = datetime.utcnow()
    since = now - timedelta(days=days)
    # Was previously unscoped by tenant or hierarchy -- any authenticated user could
    # see every tenant's trend data. Scope it like every other report endpoint here.
    scoped_ids, _ = get_scoped_clinic_ids(db, current_user)
    q = db.query(Inspection).filter(
        Inspection.tenant_id == current_user.tenant_id,
        Inspection.submitted_at >= since,
        Inspection.compliance_score.isnot(None),
    )
    if scoped_ids is not None:
        q = q.filter(Inspection.clinic_id.in_(scoped_ids))
    if clinic_id:
        q = q.filter(Inspection.clinic_id == clinic_id)
    if template_id:
        q = q.filter(Inspection.template_id == template_id)
    if assignee_id:
        q = q.filter(Inspection.inspector_id == assignee_id)
    if region:
        q = q.join(Clinic, Inspection.clinic_id == Clinic.id).filter(Clinic.region == region)
    inspections = q.order_by(Inspection.submitted_at).all()
    return [
        {"id": i.id, "date": str(i.submitted_at.date()), "score": i.compliance_score,
         "risk_level": i.risk_level, "clinic_name": i.clinic.name if i.clinic else None}
        for i in inspections
    ]


@router.get("/export/csv")
def export_csv(resource: str = "inspections", db: Session = Depends(get_db),
               current_user: User = Depends(require_admin_or_auditor)):
    import csv
    output = io.StringIO()
    writer = csv.writer(output)
    # Was previously completely unscoped -- an auditor whose access is limited to one
    # region could export every tenant's data. Same scoping every other report endpoint
    # here uses, so an export only ever contains what that person can actually see.
    scoped_ids, scope_label = get_scoped_clinic_ids(db, current_user)

    if resource == "inspections":
        writer.writerow(["ID", "Clinic", "Inspector", "Score", "Risk", "Status", "Submitted"])
        q = db.query(Inspection).filter(
            Inspection.tenant_id == current_user.tenant_id, Inspection.compliance_score.isnot(None))
        if scoped_ids is not None:
            q = q.filter(Inspection.clinic_id.in_(scoped_ids))
        for r in q.all():
            writer.writerow([r.id, r.clinic.name if r.clinic else "", r.inspector.full_name if r.inspector else "",
                              r.compliance_score, r.risk_level, r.status.value if r.status else "", r.submitted_at])
    elif resource == "actions":
        writer.writerow(["ID", "Clinic", "Title", "Status", "Priority", "Due Date", "Assignee"])
        q = db.query(CorrectiveAction).filter(CorrectiveAction.tenant_id == current_user.tenant_id)
        if scoped_ids is not None:
            q = q.filter(CorrectiveAction.clinic_id.in_(scoped_ids))
        for r in q.all():
            writer.writerow([r.id, r.clinic.name if r.clinic else "", r.title,
                              r.status.value if r.status else "", r.priority, r.due_date,
                              r.assignee.full_name if r.assignee else ""])
    elif resource == "certifications":
        writer.writerow(["ID", "Name", "Email", "Course", "Score", "Status", "Completed", "Expires"])
        from ..models.certification import Course
        q = (db.query(TeamCertification)
             .join(Course, TeamCertification.course_id == Course.id)
             .filter(Course.tenant_id == current_user.tenant_id))
        for r in q.all():
            writer.writerow([r.id, r.participant_name, r.participant_email,
                              r.course.title if r.course else "", r.score,
                              r.status.value if r.status else "", r.completed_at, r.expires_at])

    output.seek(0)
    filename = f"{resource}_{_scope_slug(scope_label)}_{datetime.utcnow().strftime('%Y-%m-%d')}.csv"
    return StreamingResponse(
        io.BytesIO(output.getvalue().encode()),
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename={filename}"},
    )


@router.get("/export/excel")
def export_excel(resource: str = "inspections", db: Session = Depends(get_db),
                 current_user: User = Depends(require_admin_or_auditor)):
    from openpyxl import Workbook
    from openpyxl.styles import Font, PatternFill, Alignment
    from openpyxl.utils import get_column_letter

    scoped_ids, scope_label = get_scoped_clinic_ids(db, current_user)

    wb = Workbook()
    ws = wb.active

    HEADER_FONT = Font(bold=True, color="FFFFFF")
    HEADER_FILL = PatternFill("solid", fgColor="1E40AF")
    HEADER_ALIGN = Alignment(horizontal="center")
    META_FONT = Font(italic=True, color="6B7280", size=10)

    def write_meta_and_headers(title: str, headers: list):
        # A sheet with just column headers gives no clue what it actually covers once
        # downloaded -- lead with who generated it, when, and exactly what scope of
        # data it's limited to (the same scope_label shown in the app), before the
        # real header row.
        ws.title = title
        ws.append([f"Generated by {current_user.full_name} on {datetime.utcnow().strftime('%Y-%m-%d %H:%M UTC')}"])
        ws.append([f"Scope: {scope_label}"])
        ws.append([])
        for row in (1, 2):
            ws.cell(row=row, column=1).font = META_FONT
        header_row = ws.max_row + 1
        ws.append(headers)
        for col, _ in enumerate(headers, start=1):
            cell = ws.cell(row=header_row, column=col)
            cell.font = HEADER_FONT
            cell.fill = HEADER_FILL
            cell.alignment = HEADER_ALIGN
            ws.column_dimensions[get_column_letter(col)].width = 20

    if resource == "inspections":
        write_meta_and_headers("Inspections", ["ID", "Clinic", "Clinic Type", "Inspector", "Score", "Risk Level",
                                               "Status", "Check-in", "Submitted"])
        q = db.query(Inspection).filter(Inspection.tenant_id == current_user.tenant_id)
        if scoped_ids is not None:
            q = q.filter(Inspection.clinic_id.in_(scoped_ids))
        for r in q.order_by(Inspection.created_at.desc()).all():
            ws.append([r.id,
                        r.clinic.name if r.clinic else "",
                        r.clinic.clinic_type.value if r.clinic and r.clinic.clinic_type else "",
                        r.inspector.full_name if r.inspector else "",
                        round(r.compliance_score, 1) if r.compliance_score else "",
                        r.risk_level or "",
                        r.status.value if r.status else "",
                        str(r.checkin_time) if r.checkin_time else "",
                        str(r.submitted_at) if r.submitted_at else ""])

    elif resource == "actions":
        write_meta_and_headers("Corrective Actions", ["ID", "Clinic", "Title", "Status", "Priority", "Assigned To",
                                                       "Due Date", "Resolved At", "Source"])
        q = db.query(CorrectiveAction).filter(CorrectiveAction.tenant_id == current_user.tenant_id)
        if scoped_ids is not None:
            q = q.filter(CorrectiveAction.clinic_id.in_(scoped_ids))
        for r in q.order_by(CorrectiveAction.created_at.desc()).all():
            ws.append([r.id,
                        r.clinic.name if r.clinic else "",
                        r.title,
                        r.status.value if r.status else "",
                        r.priority,
                        r.assignee.full_name if r.assignee else "Unassigned",
                        str(r.due_date) if r.due_date else "",
                        str(r.resolved_at) if r.resolved_at else "",
                        "Manual" if r.is_manual else f"Inspection #{r.inspection_id}"])

    elif resource == "certifications":
        write_meta_and_headers("Certifications", ["ID", "Name", "Email", "Course", "Score", "Status",
                                                   "Attempts", "Completed", "Expires"])
        from ..models.certification import Course
        q = (db.query(TeamCertification)
             .join(Course, TeamCertification.course_id == Course.id)
             .filter(Course.tenant_id == current_user.tenant_id))
        for r in q.order_by(TeamCertification.created_at.desc()).all():
            ws.append([r.id, r.participant_name, r.participant_email,
                        r.course.title if r.course else "", r.score,
                        r.status.value if r.status else "", r.attempts,
                        str(r.completed_at) if r.completed_at else "",
                        str(r.expires_at) if r.expires_at else ""])

    elif resource == "clinic_scorecard":
        write_meta_and_headers("Clinic Scorecard", ["Clinic", "Type", "City", "State", "Avg Score",
                                                     "Last Score", "Risk Level", "Open Actions", "Last Inspection"])
        cq = db.query(Clinic).filter(Clinic.tenant_id == current_user.tenant_id, Clinic.is_active == True)
        if scoped_ids is not None:
            cq = cq.filter(Clinic.id.in_(scoped_ids))
        for c in cq.order_by(Clinic.name).all():
            avg = db.query(func.avg(Inspection.compliance_score)).filter(
                Inspection.clinic_id == c.id, Inspection.compliance_score.isnot(None)).scalar()
            latest = (db.query(Inspection)
                      .filter(Inspection.clinic_id == c.id, Inspection.compliance_score.isnot(None))
                      .order_by(Inspection.submitted_at.desc()).first())
            open_cnt = db.query(CorrectiveAction).filter(
                CorrectiveAction.clinic_id == c.id,
                CorrectiveAction.status.in_([ActionStatus.open, ActionStatus.in_progress])).count()
            ws.append([c.name,
                        c.clinic_type.value if c.clinic_type else "",
                        c.city or "", c.state or "",
                        round(avg, 1) if avg else "",
                        round(latest.compliance_score, 1) if latest else "",
                        latest.risk_level if latest else "",
                        open_cnt,
                        str(latest.submitted_at.date()) if latest and latest.submitted_at else ""])

    buf = io.BytesIO()
    wb.save(buf)
    buf.seek(0)
    filename = f"{resource}_{_scope_slug(scope_label)}_{datetime.utcnow().strftime('%Y-%m-%d')}.xlsx"
    return StreamingResponse(
        buf,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f"attachment; filename={filename}"},
    )


# Import needed for excel scorecard
from sqlalchemy import func
