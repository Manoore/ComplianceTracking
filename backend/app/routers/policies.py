import asyncio
from datetime import datetime
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from ..database import get_db
from ..models.policy import PolicyDocument, PolicyAttestation
from ..models.user import User, UserRole
from ..services.email import send_policy_published
from .deps import get_current_user

router = APIRouter(prefix="/policies", tags=["policies"])


class QuizQuestion(BaseModel):
    question: str
    options: List[str]
    answer_index: int


class PolicyCreate(BaseModel):
    title: str
    description: Optional[str] = None
    content: str
    version: Optional[str] = "1.0"
    category: Optional[str] = None
    target_roles: Optional[List[str]] = []
    requires_quiz: Optional[bool] = False
    quiz_questions: Optional[List[dict]] = None
    pass_threshold: Optional[int] = 80
    effective_date: Optional[str] = None


class PolicyUpdate(PolicyCreate):
    pass


class AcknowledgePayload(BaseModel):
    quiz_answers: Optional[List[int]] = None  # indices chosen by user


def policy_out(p: PolicyDocument, attestation: Optional[PolicyAttestation] = None,
               total_assigned: int = 0, signed_count: int = 0) -> dict:
    return {
        "id": p.id,
        "title": p.title,
        "description": p.description,
        "content": p.content,
        "version": p.version,
        "category": p.category,
        "target_roles": p.target_roles or [],
        "is_published": p.is_published,
        "requires_quiz": p.requires_quiz,
        "quiz_questions": p.quiz_questions if p.requires_quiz else None,
        "pass_threshold": p.pass_threshold,
        "effective_date": str(p.effective_date) if p.effective_date else None,
        "published_by": p.published_by,
        "publisher_name": p.publisher.full_name if p.publisher else None,
        "published_at": str(p.published_at) if p.published_at else None,
        "is_active": p.is_active,
        "created_at": str(p.created_at) if p.created_at else None,
        "total_assigned": total_assigned,
        "signed_count": signed_count,
        "my_attestation": {
            "status": attestation.status,
            "read_at": str(attestation.read_at) if attestation and attestation.read_at else None,
            "signed_at": str(attestation.signed_at) if attestation and attestation.signed_at else None,
            "quiz_score": attestation.quiz_score,
            "quiz_passed": attestation.quiz_passed,
        } if attestation else None,
    }


def _is_admin_or_manager(user: User) -> bool:
    return user.role in [UserRole.admin, UserRole.manager]


@router.get("/")
def list_policies(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    q = db.query(PolicyDocument).filter(
        PolicyDocument.tenant_id == current_user.tenant_id,
        PolicyDocument.is_active == True,
    )
    if not _is_admin_or_manager(current_user):
        q = q.filter(PolicyDocument.is_published == True)

    policies = q.order_by(PolicyDocument.created_at.desc()).all()
    results = []
    for p in policies:
        if not _is_admin_or_manager(current_user):
            roles = p.target_roles or []
            if roles and current_user.role.value not in roles:
                continue
        total = len(p.attestations)
        signed = sum(1 for a in p.attestations if a.status in ("signed",))
        my_att = next((a for a in p.attestations if a.user_id == current_user.id), None)
        results.append(policy_out(p, my_att, total, signed))
    return results


@router.post("/", status_code=201)
def create_policy(payload: PolicyCreate, db: Session = Depends(get_db),
                  current_user: User = Depends(get_current_user)):
    if not _is_admin_or_manager(current_user):
        raise HTTPException(status_code=403, detail="Forbidden")
    eff = None
    if payload.effective_date:
        try:
            eff = datetime.fromisoformat(payload.effective_date)
        except Exception:
            pass
    p = PolicyDocument(
        tenant_id=current_user.tenant_id,
        title=payload.title,
        description=payload.description,
        content=payload.content,
        version=payload.version or "1.0",
        category=payload.category,
        target_roles=payload.target_roles or [],
        requires_quiz=payload.requires_quiz or False,
        quiz_questions=payload.quiz_questions,
        pass_threshold=payload.pass_threshold or 80,
        effective_date=eff,
    )
    db.add(p)
    db.commit()
    db.refresh(p)
    return policy_out(p, None, 0, 0)


@router.get("/{policy_id}")
def get_policy(policy_id: int, db: Session = Depends(get_db),
               current_user: User = Depends(get_current_user)):
    p = db.query(PolicyDocument).filter(
        PolicyDocument.id == policy_id,
        PolicyDocument.tenant_id == current_user.tenant_id,
    ).first()
    if not p:
        raise HTTPException(status_code=404, detail="Policy not found")
    total = len(p.attestations)
    signed = sum(1 for a in p.attestations if a.status == "signed")
    my_att = next((a for a in p.attestations if a.user_id == current_user.id), None)

    # Mark as read if not already
    if my_att and my_att.status == "pending":
        my_att.status = "read"
        my_att.read_at = datetime.utcnow()
        db.commit()
        db.refresh(my_att)

    return policy_out(p, my_att, total, signed)


@router.put("/{policy_id}")
def update_policy(policy_id: int, payload: PolicyUpdate,
                  db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    if not _is_admin_or_manager(current_user):
        raise HTTPException(status_code=403, detail="Forbidden")
    p = db.query(PolicyDocument).filter(
        PolicyDocument.id == policy_id,
        PolicyDocument.tenant_id == current_user.tenant_id,
    ).first()
    if not p:
        raise HTTPException(status_code=404, detail="Policy not found")
    eff = None
    if payload.effective_date:
        try:
            eff = datetime.fromisoformat(payload.effective_date)
        except Exception:
            pass
    p.title = payload.title
    p.description = payload.description
    p.content = payload.content
    p.version = payload.version or p.version
    p.category = payload.category
    p.target_roles = payload.target_roles or []
    p.requires_quiz = payload.requires_quiz or False
    p.quiz_questions = payload.quiz_questions
    p.pass_threshold = payload.pass_threshold or 80
    p.effective_date = eff
    db.commit()
    db.refresh(p)
    total = len(p.attestations)
    signed = sum(1 for a in p.attestations if a.status == "signed")
    my_att = next((a for a in p.attestations if a.user_id == current_user.id), None)
    return policy_out(p, my_att, total, signed)


@router.delete("/{policy_id}", status_code=204)
def delete_policy(policy_id: int, db: Session = Depends(get_db),
                  current_user: User = Depends(get_current_user)):
    if not _is_admin_or_manager(current_user):
        raise HTTPException(status_code=403, detail="Forbidden")
    p = db.query(PolicyDocument).filter(
        PolicyDocument.id == policy_id,
        PolicyDocument.tenant_id == current_user.tenant_id,
    ).first()
    if not p:
        raise HTTPException(status_code=404, detail="Policy not found")
    p.is_active = False
    db.commit()


@router.post("/{policy_id}/publish")
def publish_policy(policy_id: int, db: Session = Depends(get_db),
                   current_user: User = Depends(get_current_user)):
    if not _is_admin_or_manager(current_user):
        raise HTTPException(status_code=403, detail="Forbidden")
    p = db.query(PolicyDocument).filter(
        PolicyDocument.id == policy_id,
        PolicyDocument.tenant_id == current_user.tenant_id,
    ).first()
    if not p:
        raise HTTPException(status_code=404, detail="Policy not found")

    p.is_published = True
    p.published_by = current_user.id
    p.published_at = datetime.utcnow()

    # Create pending attestations for targeted users
    from ..models.user import User as UserModel
    users_q = db.query(UserModel).filter(
        UserModel.tenant_id == current_user.tenant_id,
        UserModel.is_active == True,
    )
    target_roles = p.target_roles or []
    all_users = users_q.all()
    existing_ids = {a.user_id for a in p.attestations}
    for u in all_users:
        if target_roles and u.role.value not in target_roles:
            continue
        if u.id in existing_ids:
            continue
        db.add(PolicyAttestation(policy_id=p.id, user_id=u.id, status="pending"))

    db.commit()
    db.refresh(p)
    total = len(p.attestations)
    signed = sum(1 for a in p.attestations if a.status == "signed")

    # Notify targeted users about the new policy
    try:
        notify_users = [u for u in all_users if not target_roles or u.role.value in target_roles]
        for u in notify_users:
            asyncio.create_task(send_policy_published(u.email, u.full_name, p.title, p.requires_quiz))
    except Exception:
        pass

    return policy_out(p, None, total, signed)


@router.post("/{policy_id}/unpublish")
def unpublish_policy(policy_id: int, db: Session = Depends(get_db),
                     current_user: User = Depends(get_current_user)):
    if not _is_admin_or_manager(current_user):
        raise HTTPException(status_code=403, detail="Forbidden")
    p = db.query(PolicyDocument).filter(
        PolicyDocument.id == policy_id,
        PolicyDocument.tenant_id == current_user.tenant_id,
    ).first()
    if not p:
        raise HTTPException(status_code=404, detail="Policy not found")
    p.is_published = False
    db.commit()
    return {"status": "ok"}


@router.post("/{policy_id}/acknowledge")
def acknowledge_policy(policy_id: int, payload: AcknowledgePayload,
                       db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    p = db.query(PolicyDocument).filter(
        PolicyDocument.id == policy_id,
        PolicyDocument.tenant_id == current_user.tenant_id,
        PolicyDocument.is_published == True,
    ).first()
    if not p:
        raise HTTPException(status_code=404, detail="Policy not found")

    att = db.query(PolicyAttestation).filter(
        PolicyAttestation.policy_id == policy_id,
        PolicyAttestation.user_id == current_user.id,
    ).first()
    if not att:
        att = PolicyAttestation(policy_id=policy_id, user_id=current_user.id, status="read")
        db.add(att)
        db.flush()

    if p.requires_quiz and payload.quiz_answers is not None:
        questions = p.quiz_questions or []
        if len(payload.quiz_answers) != len(questions):
            raise HTTPException(status_code=400, detail="Answer count mismatch")
        correct = sum(
            1 for i, q in enumerate(questions) if payload.quiz_answers[i] == q.get("answer_index")
        )
        score = (correct / len(questions) * 100) if questions else 100
        passed = score >= (p.pass_threshold or 80)
        att.quiz_score = score
        att.quiz_passed = passed
        if not passed:
            att.status = "quiz_failed"
            db.commit()
            return {"status": "quiz_failed", "score": score, "pass_threshold": p.pass_threshold}
        att.status = "signed"
        att.signed_at = datetime.utcnow()
    else:
        att.status = "signed"
        att.signed_at = datetime.utcnow()

    if not att.read_at:
        att.read_at = datetime.utcnow()

    db.commit()
    db.refresh(att)
    return {"status": "signed", "signed_at": str(att.signed_at)}


@router.get("/{policy_id}/attestations")
def list_attestations(policy_id: int, db: Session = Depends(get_db),
                      current_user: User = Depends(get_current_user)):
    if not _is_admin_or_manager(current_user):
        raise HTTPException(status_code=403, detail="Forbidden")
    p = db.query(PolicyDocument).filter(
        PolicyDocument.id == policy_id,
        PolicyDocument.tenant_id == current_user.tenant_id,
    ).first()
    if not p:
        raise HTTPException(status_code=404, detail="Policy not found")
    return [
        {
            "id": a.id,
            "user_id": a.user_id,
            "user_name": a.user.full_name if a.user else None,
            "user_email": a.user.email if a.user else None,
            "user_role": a.user.role.value if a.user else None,
            "status": a.status,
            "read_at": str(a.read_at) if a.read_at else None,
            "signed_at": str(a.signed_at) if a.signed_at else None,
            "quiz_score": a.quiz_score,
            "quiz_passed": a.quiz_passed,
        }
        for a in p.attestations
    ]
