import os
from datetime import datetime
from typing import List, Optional
from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, UploadFile, File, Form, Request
from sqlalchemy.orm import Session
from pydantic import BaseModel
from ..database import get_db
from ..models.inspection import Inspection, InspectionItem, InspectionStatus, ItemResult
from ..models.checklist import ChecklistItem
from ..models.corrective_action import CorrectiveAction, ActionStatus
from ..models.clinic import Clinic
from ..models.user import User, UserRole
from ..services.scoring import calculate_compliance_score
from ..services.email import send_inspection_submitted
from ..utils.audit_trail import log_action
from ..utils.hierarchy_scope import scoped_clinic_ids
from ..config import settings
from .deps import get_current_user, require_admin_or_auditor

router = APIRouter(prefix="/inspections", tags=["inspections"])


class InspectionCreate(BaseModel):
    clinic_id: int
    template_id: int
    checkin_lat: Optional[float] = None
    checkin_lng: Optional[float] = None


class ItemUpdate(BaseModel):
    result: Optional[ItemResult] = None
    notes: Optional[str] = None
    text_value: Optional[str] = None
    numeric_value: Optional[float] = None
    signature: Optional[str] = None   # base64 for signature type


class SecondSignPayload(BaseModel):
    signature: Optional[str] = None


class CheckoutPayload(BaseModel):
    checkout_lat: Optional[float] = None
    checkout_lng: Optional[float] = None
    notes: Optional[str] = None


def _can_countersign(user: User, clinic: Optional[Clinic]) -> bool:
    """Who may complete the second sign-off on a dual_signoff item: the same hierarchy
    that can see this clinic on the Executive dashboard (Clinic Lead -> Regional Manager ->
    Director of Operations -> Admin), not just any other logged-in user."""
    if user.role == UserRole.admin:
        return True
    custom_role = (user.custom_role or "").strip().lower()
    if custom_role in ("director_of_operations", "executive"):
        return True
    if not clinic:
        return False
    if custom_role == "regional_manager":
        return bool(user.managed_region) and user.managed_region == clinic.region
    if custom_role == "clinic_lead" or user.role == UserRole.manager:
        return clinic.manager_id == user.id
    return False


def _reviewable_clinic_ids(db: Session, user: User) -> Optional[list]:
    """Clinic IDs whose reviewer_only items `user` may countersign, or None for
    "every clinic in the tenant". Mirrors _can_countersign's role logic exactly
    (unlike scoped_clinic_ids, which is for the Executive dashboard and treats a
    plain team_member as seeing everything -- here that same user can't countersign
    anything, so they get an empty list, not unrestricted access)."""
    if user.role == UserRole.admin:
        return None
    custom_role = (user.custom_role or "").strip().lower()
    if custom_role in ("director_of_operations", "executive"):
        return None
    q = db.query(Clinic.id).filter(Clinic.tenant_id == user.tenant_id)
    if custom_role == "regional_manager" and user.managed_region:
        return [i for (i,) in q.filter(Clinic.region == user.managed_region).all()]
    if custom_role == "clinic_lead" or user.role == UserRole.manager:
        return [i for (i,) in q.filter(Clinic.manager_id == user.id).all()]
    return []


def inspection_out(insp: Inspection, current_user: Optional[User] = None) -> dict:
    can_review = current_user is not None and _can_countersign(current_user, insp.clinic)
    return {
        "id": insp.id,
        "clinic_id": insp.clinic_id,
        "clinic_name": insp.clinic.name if insp.clinic else None,
        "template_id": insp.template_id,
        "template_name": insp.template.name if insp.template else None,
        "template_frequency": insp.template.frequency if insp.template else None,
        "inspector_id": insp.inspector_id,
        "inspector_name": insp.inspector.full_name if insp.inspector else None,
        "status": insp.status.value if insp.status else None,
        "compliance_score": insp.compliance_score,
        "risk_level": insp.risk_level,
        "checkin_time": str(insp.checkin_time) if insp.checkin_time else None,
        "checkout_time": str(insp.checkout_time) if insp.checkout_time else None,
        "checkin_lat": insp.checkin_lat,
        "checkin_lng": insp.checkin_lng,
        "notes": insp.notes,
        "submitted_at": str(insp.submitted_at) if insp.submitted_at else None,
        "created_at": str(insp.created_at) if insp.created_at else None,
        "items": [
            {
                "id": i.id,
                "checklist_item_id": i.checklist_item_id,
                "question": i.checklist_item.question if i.checklist_item else None,
                "category": i.checklist_item.category.value if i.checklist_item and i.checklist_item.category else None,
                "is_critical": i.checklist_item.is_critical if i.checklist_item else False,
                "item_type": i.checklist_item.item_type.value if i.checklist_item and i.checklist_item.item_type else "pass_fail_na",
                "type_config": i.checklist_item.type_config if i.checklist_item else None,
                "reviewer_only": bool(i.checklist_item.reviewer_only) if i.checklist_item else False,
                "can_reviewer_sign": can_review,
                "result": i.result.value if i.result else None,
                "notes": i.notes,
                "text_value": i.text_value,
                "numeric_value": i.numeric_value,
                "passes_range": i.passes_range,
                "document_url": i.document_url,
                "photo_urls": i.photo_urls or [],
                "second_signer_id": i.second_signer_id,
                "second_signed_at": str(i.second_signed_at) if i.second_signed_at else None,
                "second_signer_name": i.second_signer.full_name if i.second_signer else None,
            }
            for i in (insp.items or [])
        ],
    }


@router.get("")
def list_inspections(db: Session = Depends(get_db), current_user: User = Depends(get_current_user),
                     clinic_id: Optional[int] = None, status: Optional[str] = None,
                     user_id: Optional[int] = None, frequency: Optional[str] = None):
    q = db.query(Inspection).filter(Inspection.tenant_id == current_user.tenant_id)

    # A hierarchy custom role (Clinic Lead, Regional Manager, Director of Operations,
    # Executive) always reports its base role as team_member, so it must be checked
    # before falling back to "just my own submissions" -- otherwise a Regional Manager
    # would only ever see the inspections they personally filed, not their region's.
    custom_role = (current_user.custom_role or "").strip().lower()
    is_hierarchy_role = custom_role in ("clinic_lead", "regional_manager", "director_of_operations", "executive")
    if current_user.role == UserRole.team_member and not is_hierarchy_role:
        q = q.filter(Inspection.inspector_id == current_user.id)
    else:
        ids, _ = scoped_clinic_ids(db, current_user)
        if ids is not None:
            q = q.filter(Inspection.clinic_id.in_(ids))

    if clinic_id:
        q = q.filter(Inspection.clinic_id == clinic_id)
    if status:
        q = q.filter(Inspection.status == status)
    if user_id:
        q = q.filter(Inspection.inspector_id == user_id)
    if frequency:
        from ..models.checklist import ChecklistTemplate
        template_ids = db.query(ChecklistTemplate.id).filter(
            ChecklistTemplate.tenant_id == current_user.tenant_id,
            ChecklistTemplate.frequency == frequency,
        ).subquery()
        q = q.filter(Inspection.template_id.in_(template_ids))
    return [inspection_out(i, current_user) for i in q.order_by(Inspection.created_at.desc()).limit(200).all()]


@router.post("", status_code=201)
def create_inspection(payload: InspectionCreate, db: Session = Depends(get_db),
                      current_user: User = Depends(get_current_user)):
    from ..models.checklist import ChecklistTemplate
    template = db.query(ChecklistTemplate).filter(ChecklistTemplate.id == payload.template_id).first()
    if not template:
        raise HTTPException(status_code=404, detail="Template not found")

    insp = Inspection(
        clinic_id=payload.clinic_id,
        template_id=payload.template_id,
        inspector_id=current_user.id,
        status=InspectionStatus.in_progress,
        tenant_id=current_user.tenant_id,
        checkin_time=datetime.utcnow(),
        checkin_lat=payload.checkin_lat,
        checkin_lng=payload.checkin_lng,
    )
    db.add(insp)
    db.flush()

    for ci in template.items:
        db.add(InspectionItem(inspection_id=insp.id, checklist_item_id=ci.id))

    db.commit()
    db.refresh(insp)
    log_action(db, "inspection.create", user_id=current_user.id, resource_type="inspection", resource_id=insp.id)
    db.commit()
    return inspection_out(insp, current_user)


@router.get("/pending-review")
def pending_review(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """Every reviewer_only item still awaiting current_user's countersignature,
    across whichever clinics they're allowed to review -- the queue a Clinic Lead,
    Regional Manager, Director of Operations, or Admin works through directly,
    instead of having to open each inspection individually to find it.

    Must be registered before /{inspection_id} -- otherwise "pending-review" would
    be swallowed by that route's inspection_id: int path parameter.
    """
    clinic_ids = _reviewable_clinic_ids(db, current_user)
    if clinic_ids == []:
        return []

    q = (db.query(InspectionItem)
         .join(Inspection, InspectionItem.inspection_id == Inspection.id)
         .join(ChecklistItem, InspectionItem.checklist_item_id == ChecklistItem.id)
         .filter(
             Inspection.tenant_id == current_user.tenant_id,
             Inspection.status != InspectionStatus.draft,
             Inspection.status != InspectionStatus.in_progress,
             ChecklistItem.reviewer_only == True,  # noqa: E712
             InspectionItem.second_signer_id.is_(None),
         ))
    if clinic_ids is not None:
        q = q.filter(Inspection.clinic_id.in_(clinic_ids))

    items = q.order_by(Inspection.submitted_at.asc()).all()
    return [
        {
            "inspection_id": item.inspection_id,
            "item_id": item.id,
            "clinic_id": item.inspection.clinic_id,
            "clinic_name": item.inspection.clinic.name if item.inspection.clinic else None,
            "template_name": item.inspection.template.name if item.inspection.template else None,
            "inspector_name": item.inspection.inspector.full_name if item.inspection.inspector else None,
            "submitted_at": str(item.inspection.submitted_at) if item.inspection.submitted_at else None,
        }
        for item in items
    ]


@router.get("/{inspection_id}")
def get_inspection(inspection_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    insp = db.query(Inspection).filter(Inspection.tenant_id == current_user.tenant_id,Inspection.id == inspection_id).first()
    if not insp:
        raise HTTPException(status_code=404, detail="Inspection not found")
    return inspection_out(insp, current_user)


@router.delete("/{inspection_id}", status_code=204)
def delete_inspection(inspection_id: int, db: Session = Depends(get_db),
                      current_user: User = Depends(get_current_user)):
    """Discard an inspection that hasn't been submitted yet. Once submitted it's a
    compliance record and must be preserved, so this only works for draft/in-progress ones."""
    insp = db.query(Inspection).filter(Inspection.id == inspection_id).first()
    if not insp:
        raise HTTPException(status_code=404, detail="Inspection not found")
    if insp.inspector_id != current_user.id and current_user.role != UserRole.admin:
        raise HTTPException(status_code=403, detail="Forbidden")
    if insp.status not in [InspectionStatus.draft, InspectionStatus.in_progress]:
        raise HTTPException(
            status_code=400,
            detail="This inspection has already been submitted and is part of the compliance "
                   "record — it can no longer be deleted.",
        )
    clinic_name = insp.clinic.name if insp.clinic else None
    db.delete(insp)
    db.commit()
    log_action(db, "inspection.delete", user_id=current_user.id, resource_type="inspection",
               resource_id=inspection_id, details={"clinic": clinic_name})
    db.commit()


@router.put("/{inspection_id}/items/{item_id}")
def update_item(inspection_id: int, item_id: int, payload: ItemUpdate,
                db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    insp = db.query(Inspection).filter(Inspection.id == inspection_id).first()
    if not insp:
        raise HTTPException(status_code=404, detail="Inspection not found")
    if insp.inspector_id != current_user.id and current_user.role not in [UserRole.admin]:
        raise HTTPException(status_code=403, detail="Forbidden")
    if insp.status not in [InspectionStatus.draft, InspectionStatus.in_progress]:
        raise HTTPException(status_code=400, detail="Inspection already submitted")

    item = db.query(InspectionItem).filter(
        InspectionItem.id == item_id, InspectionItem.inspection_id == inspection_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")

    ci = item.checklist_item
    if ci and ci.reviewer_only:
        raise HTTPException(status_code=403, detail="This item is completed by your Clinic Lead or "
                                                     "Regional Manager after you submit the checklist")
    item_type = ci.item_type.value if ci and ci.item_type else "pass_fail_na"

    if item_type == "numeric_range" and payload.numeric_value is not None:
        item.numeric_value = payload.numeric_value
        cfg = (ci.type_config or {}) if ci else {}
        lo, hi = cfg.get("min"), cfg.get("max")
        in_range = (lo is None or payload.numeric_value >= lo) and (hi is None or payload.numeric_value <= hi)
        item.passes_range = in_range
        item.result = ItemResult.pass_ if in_range else ItemResult.fail
    elif item_type == "numeric" and payload.numeric_value is not None:
        item.numeric_value = payload.numeric_value
        item.result = ItemResult.pass_
    elif item_type in ("text_input", "date_picker") and payload.text_value is not None:
        item.text_value = payload.text_value
        item.result = ItemResult.pass_ if payload.text_value.strip() else ItemResult.pending
    elif item_type == "signature" and payload.signature is not None:
        item.text_value = payload.signature
        item.result = ItemResult.pass_
    elif item_type == "dual_signoff" and payload.signature is not None:
        item.text_value = payload.signature
        # Result becomes pass only when second signer also signs
        item.result = ItemResult.pending
    elif payload.result is not None:
        item.result = payload.result

    if payload.notes is not None:
        item.notes = payload.notes
    item.answered_at = datetime.utcnow()
    db.commit()
    return {"status": "ok", "result": item.result.value, "passes_range": item.passes_range}


@router.post("/{inspection_id}/items/{item_id}/photos")
async def upload_photo(inspection_id: int, item_id: int,
                       file: UploadFile = File(...),
                       db: Session = Depends(get_db),
                       current_user: User = Depends(get_current_user)):
    insp = db.query(Inspection).filter(Inspection.id == inspection_id).first()
    if not insp or insp.inspector_id != current_user.id:
        raise HTTPException(status_code=403, detail="Forbidden")

    item = db.query(InspectionItem).filter(
        InspectionItem.id == item_id, InspectionItem.inspection_id == inspection_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")

    ext = os.path.splitext(file.filename or "")[1].lower()
    if ext not in [".jpg", ".jpeg", ".png", ".webp"]:
        raise HTTPException(status_code=400, detail="Only image files allowed")

    upload_dir = os.path.join(settings.upload_dir, "inspections", str(inspection_id))
    os.makedirs(upload_dir, exist_ok=True)
    filename = f"{item_id}_{datetime.utcnow().strftime('%Y%m%d%H%M%S')}{ext}"
    filepath = os.path.join(upload_dir, filename)

    content = await file.read()
    if len(content) > settings.max_upload_size_mb * 1024 * 1024:
        raise HTTPException(status_code=413, detail="File too large")

    with open(filepath, "wb") as f:
        f.write(content)

    urls = list(item.photo_urls or [])
    urls.append(f"/uploads/inspections/{inspection_id}/{filename}")
    item.photo_urls = urls
    db.commit()
    return {"url": urls[-1]}


@router.post("/{inspection_id}/items/{item_id}/second-sign")
def second_sign(inspection_id: int, item_id: int, payload: SecondSignPayload,
                db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    insp = db.query(Inspection).filter(Inspection.id == inspection_id).first()
    if not insp:
        raise HTTPException(status_code=404, detail="Inspection not found")
    item = db.query(InspectionItem).filter(
        InspectionItem.id == item_id, InspectionItem.inspection_id == inspection_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")

    ci = item.checklist_item
    is_reviewer_only = bool(ci and ci.reviewer_only)

    if is_reviewer_only:
        # This is the reviewer's own, only signature -- the MA never signs it (update_item
        # blocks that), so it only makes sense once the MA has actually submitted.
        if insp.status in (InspectionStatus.draft, InspectionStatus.in_progress):
            raise HTTPException(status_code=400, detail="The MA/PCT must submit this checklist first")
    else:
        # Original dual_signoff behavior: a first signature (by the inspector) must
        # already exist, and this all happens before submission.
        if insp.status not in (InspectionStatus.draft, InspectionStatus.in_progress):
            raise HTTPException(status_code=400, detail="Inspection not editable")
        if not item.text_value:
            raise HTTPException(status_code=400, detail="First signature required before second sign-off")

    if item.second_signer_id == current_user.id or insp.inspector_id == current_user.id:
        raise HTTPException(status_code=400, detail="Second signer must be a different user")
    if not _can_countersign(current_user, insp.clinic):
        raise HTTPException(status_code=403, detail="Only this clinic's Lead, Regional Manager, "
                                                     "Director of Operations, or an Admin can countersign")
    if is_reviewer_only:
        item.text_value = payload.signature
    item.second_signer_id = current_user.id
    item.second_signed_at = datetime.utcnow()
    item.second_signature = payload.signature
    item.result = ItemResult.pass_
    db.commit()
    return {"status": "ok"}


@router.post("/{inspection_id}/items/{item_id}/document")
async def upload_document(inspection_id: int, item_id: int,
                          file: UploadFile = File(...),
                          db: Session = Depends(get_db),
                          current_user: User = Depends(get_current_user)):
    insp = db.query(Inspection).filter(Inspection.id == inspection_id).first()
    if not insp or insp.inspector_id != current_user.id:
        raise HTTPException(status_code=403, detail="Forbidden")
    item = db.query(InspectionItem).filter(
        InspectionItem.id == item_id, InspectionItem.inspection_id == inspection_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")
    ext = os.path.splitext(file.filename or "")[1].lower()
    if ext not in [".pdf", ".doc", ".docx", ".xls", ".xlsx", ".jpg", ".jpeg", ".png"]:
        raise HTTPException(status_code=400, detail="Unsupported file type")
    upload_dir = os.path.join(settings.upload_dir, "inspections", str(inspection_id))
    os.makedirs(upload_dir, exist_ok=True)
    filename = f"doc_{item_id}_{datetime.utcnow().strftime('%Y%m%d%H%M%S')}{ext}"
    filepath = os.path.join(upload_dir, filename)
    content = await file.read()
    if len(content) > settings.max_upload_size_mb * 1024 * 1024:
        raise HTTPException(status_code=413, detail="File too large")
    with open(filepath, "wb") as f:
        f.write(content)
    item.document_url = f"/uploads/inspections/{inspection_id}/{filename}"
    item.result = ItemResult.pass_
    item.answered_at = datetime.utcnow()
    db.commit()
    return {"url": item.document_url}


@router.post("/{inspection_id}/checkout")
def checkout(inspection_id: int, payload: CheckoutPayload,
             db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    insp = db.query(Inspection).filter(Inspection.id == inspection_id).first()
    if not insp or insp.inspector_id != current_user.id:
        raise HTTPException(status_code=403, detail="Forbidden")
    insp.checkout_time = datetime.utcnow()
    insp.checkout_lat = payload.checkout_lat
    insp.checkout_lng = payload.checkout_lng
    if payload.notes:
        insp.notes = payload.notes
    db.commit()
    return {"status": "ok"}


@router.post("/{inspection_id}/submit")
def submit_inspection(inspection_id: int, background_tasks: BackgroundTasks,
                      db: Session = Depends(get_db),
                      current_user: User = Depends(get_current_user)):
    insp = db.query(Inspection).filter(Inspection.id == inspection_id).first()
    if not insp:
        raise HTTPException(status_code=404, detail="Inspection not found")
    if insp.inspector_id != current_user.id and current_user.role != UserRole.admin:
        raise HTTPException(status_code=403, detail="Forbidden")
    if insp.status not in [InspectionStatus.draft, InspectionStatus.in_progress]:
        raise HTTPException(status_code=400, detail="Already submitted")

    checklist_items = db.query(ChecklistItem).filter(ChecklistItem.template_id == insp.template_id).all()
    result = calculate_compliance_score(insp.items, checklist_items)
    insp.compliance_score = result["score"]
    insp.risk_level = result["risk_level"]
    insp.status = InspectionStatus.submitted
    insp.submitted_at = datetime.utcnow()

    # Auto-generate corrective actions for failed items
    for item in insp.items:
        if item.result == ItemResult.fail and item.checklist_item:
            ci = item.checklist_item
            action = CorrectiveAction(
                inspection_id=insp.id,
                inspection_item_id=item.id,
                clinic_id=insp.clinic_id,
                created_by=current_user.id,
                title=f"Corrective Action: {ci.question[:100]}",
                priority="high" if ci.is_critical else "medium",
                requires_reinspection=ci.is_critical,
            )
            db.add(action)

    db.commit()
    db.refresh(insp)
    log_action(db, "inspection.submit", user_id=current_user.id, resource_type="inspection", resource_id=inspection_id,
               details={"score": result["score"], "risk": result["risk_level"]})
    db.commit()

    # Notify auditors/admins about the submitted inspection
    try:
        auditors = db.query(User).filter(
            User.role.in_([UserRole.admin, UserRole.auditor]),
            User.is_active == True,
            User.tenant_id == current_user.tenant_id,
        ).all()
        clinic_name = insp.clinic.name if insp.clinic else "Unknown"
        inspector_name = current_user.full_name
        score = result["score"]
        for aud in auditors:
            background_tasks.add_task(send_inspection_submitted, aud.email, aud.full_name, clinic_name, score, inspector_name)
    except Exception:
        pass

    return inspection_out(insp, current_user)
