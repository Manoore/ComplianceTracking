import os
import secrets
from datetime import datetime, timedelta
from typing import Optional, List
from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from sqlalchemy.orm import Session
from pydantic import BaseModel, EmailStr
from ..database import get_db
from ..models.certification import (Course, Quiz, QuizQuestion, QuizOption,
                                     CertificationLink, TeamCertification, CertStatus)
from ..models.user import User, UserRole
from ..services import pdf as pdf_service
from ..services.email import send_certification_reminder
from ..utils.audit_trail import log_action
from ..config import settings
from .deps import get_current_user, require_admin
from .notifications import notify
from ..models.notification import NotificationType

router = APIRouter(prefix="/certifications", tags=["certifications"])


class OptionIn(BaseModel):
    option_text: str
    is_correct: bool = False


class QuestionIn(BaseModel):
    question_text: str
    explanation: Optional[str] = None
    order_index: int = 0
    options: List[OptionIn] = []


class QuizIn(BaseModel):
    title: str
    description: Optional[str] = None
    time_limit_minutes: Optional[int] = None
    max_attempts: int = 3
    order_index: int = 0
    questions: List[QuestionIn] = []


class CourseCreate(BaseModel):
    title: str
    description: Optional[str] = None
    pass_threshold: float = 80.0
    validity_days: int = 365
    quizzes: List[QuizIn] = []
    target_roles: Optional[List[str]] = None  # e.g. ['auditor', 'team_member']


class LinkCreate(BaseModel):
    course_id: int
    assigned_email: Optional[EmailStr] = None
    assigned_name: Optional[str] = None
    expires_days: Optional[int] = None


class SubmitAnswers(BaseModel):
    answers: dict  # {question_id: option_id}
    participant_name: str
    participant_email: EmailStr


def course_out(c: Course) -> dict:
    return {
        "id": c.id,
        "title": c.title,
        "description": c.description,
        "pass_threshold": c.pass_threshold,
        "validity_days": c.validity_days,
        "is_active": c.is_active,
        "target_roles": c.target_roles,
        "quiz_count": len(c.quizzes) if c.quizzes else 0,
        "created_at": str(c.created_at) if c.created_at else None,
    }


def cert_out(cert: TeamCertification) -> dict:
    return {
        "id": cert.id,
        "participant_name": cert.participant_name,
        "participant_email": cert.participant_email,
        "course_id": cert.course_id,
        "course_title": cert.course.title if cert.course else None,
        "status": cert.status.value if cert.status else None,
        "score": cert.score,
        "attempts": cert.attempts,
        "started_at": str(cert.started_at) if cert.started_at else None,
        "completed_at": str(cert.completed_at) if cert.completed_at else None,
        "expires_at": str(cert.expires_at) if cert.expires_at else None,
        "certificate_path": cert.certificate_path,
    }


@router.get("/courses")
def list_courses(db: Session = Depends(get_db), _=Depends(get_current_user)):
    courses = db.query(Course).filter(Course.is_active == True).all()
    return [course_out(c) for c in courses]


@router.post("/courses", status_code=201)
def create_course(payload: CourseCreate, db: Session = Depends(get_db),
                  current_user: User = Depends(require_admin)):
    course = Course(
        title=payload.title,
        description=payload.description,
        pass_threshold=payload.pass_threshold,
        validity_days=payload.validity_days,
        target_roles=payload.target_roles,
        tenant_id=current_user.tenant_id,
        created_by=current_user.id,
    )
    db.add(course)
    db.flush()

    for quiz_data in payload.quizzes:
        quiz = Quiz(
            course_id=course.id,
            title=quiz_data.title,
            description=quiz_data.description,
            time_limit_minutes=quiz_data.time_limit_minutes,
            max_attempts=quiz_data.max_attempts,
            order_index=quiz_data.order_index,
        )
        db.add(quiz)
        db.flush()
        for q_data in quiz_data.questions:
            question = QuizQuestion(
                quiz_id=quiz.id,
                question_text=q_data.question_text,
                explanation=q_data.explanation,
                order_index=q_data.order_index,
            )
            db.add(question)
            db.flush()
            for opt in q_data.options:
                db.add(QuizOption(question_id=question.id, option_text=opt.option_text, is_correct=opt.is_correct))

    db.commit()
    db.refresh(course)
    log_action(db, "course.create", user_id=current_user.id, resource_type="course", resource_id=course.id)

    if payload.target_roles:
        target_users = db.query(User).filter(
            User.tenant_id == current_user.tenant_id,
            User.is_active == True,
            User.role.in_(payload.target_roles),
        ).all()
        role_label = ', '.join(r.replace('_', ' ').title() for r in payload.target_roles)
        for u in target_users:
            notify(db, u.id, NotificationType.system,
                   title=f"New Training: {course.title}",
                   message=f"A new certification course has been assigned to {role_label}.",
                   resource_type="course", resource_id=course.id)

    db.commit()
    return course_out(course)


@router.get("/courses/{course_id}")
def get_course(course_id: int, db: Session = Depends(get_db),
               current_user: User = Depends(get_current_user)):
    course = db.query(Course).filter(Course.id == course_id).first()
    if not course:
        raise HTTPException(status_code=404, detail="Course not found")
    is_admin = current_user.role == UserRole.admin
    result = course_out(course)
    result["quizzes"] = []
    for quiz in (course.quizzes or []):
        q_out = {"id": quiz.id, "title": quiz.title, "description": quiz.description,
                 "time_limit_minutes": quiz.time_limit_minutes,
                 "max_attempts": quiz.max_attempts, "questions": []}
        for question in (quiz.questions or []):
            opts = []
            for o in (question.options or []):
                opt = {"id": o.id, "option_text": o.option_text}
                if is_admin:
                    opt["is_correct"] = o.is_correct
                opts.append(opt)
            q_out["questions"].append({
                "id": question.id,
                "question_text": question.question_text,
                "explanation": question.explanation if is_admin else None,
                "options": opts,
            })
        result["quizzes"].append(q_out)
    return result


@router.put("/courses/{course_id}")
def update_course(course_id: int, payload: CourseCreate, db: Session = Depends(get_db),
                  current_user: User = Depends(require_admin)):
    course = db.query(Course).filter(Course.id == course_id).first()
    if not course:
        raise HTTPException(status_code=404, detail="Course not found")

    course.title = payload.title
    course.description = payload.description
    course.pass_threshold = payload.pass_threshold
    course.validity_days = payload.validity_days

    for quiz in list(course.quizzes or []):
        db.delete(quiz)
    db.flush()

    for quiz_data in payload.quizzes:
        quiz = Quiz(
            course_id=course.id,
            title=quiz_data.title,
            description=quiz_data.description,
            time_limit_minutes=quiz_data.time_limit_minutes,
            max_attempts=quiz_data.max_attempts,
            order_index=quiz_data.order_index,
        )
        db.add(quiz)
        db.flush()
        for q_data in quiz_data.questions:
            question = QuizQuestion(
                quiz_id=quiz.id,
                question_text=q_data.question_text,
                explanation=q_data.explanation,
                order_index=q_data.order_index,
            )
            db.add(question)
            db.flush()
            for opt in q_data.options:
                db.add(QuizOption(question_id=question.id, option_text=opt.option_text, is_correct=opt.is_correct))

    db.commit()
    db.refresh(course)
    log_action(db, "course.update", user_id=current_user.id, resource_type="course", resource_id=course.id)
    db.commit()
    return course_out(course)


@router.delete("/courses/{course_id}", status_code=204)
def delete_course(course_id: int, db: Session = Depends(get_db),
                  current_user: User = Depends(require_admin)):
    course = db.query(Course).filter(Course.id == course_id).first()
    if not course:
        raise HTTPException(status_code=404, detail="Course not found")
    course.is_active = False
    db.commit()
    log_action(db, "course.delete", user_id=current_user.id, resource_type="course", resource_id=course_id)
    db.commit()
    return None


@router.post("/links", status_code=201)
def create_link(payload: LinkCreate, background_tasks: BackgroundTasks,
                db: Session = Depends(get_db), current_user: User = Depends(require_admin)):
    course = db.query(Course).filter(Course.id == payload.course_id).first()
    if not course:
        raise HTTPException(status_code=404, detail="Course not found")

    token = secrets.token_urlsafe(32)
    expires_at = datetime.utcnow() + timedelta(days=payload.expires_days) if payload.expires_days else None
    link = CertificationLink(
        course_id=payload.course_id,
        token=token,
        assigned_email=payload.assigned_email,
        assigned_name=payload.assigned_name,
        expires_at=expires_at,
        created_by=current_user.id,
    )
    db.add(link)
    db.commit()
    db.refresh(link)

    link_url = f"{settings.frontend_url}/certify/{token}"
    if payload.assigned_email:
        background_tasks.add_task(
            send_certification_reminder,
            payload.assigned_email,
            payload.assigned_name or payload.assigned_email,
            course.title,
            link_url,
            str(expires_at.date()) if expires_at else None,
        )

    return {"id": link.id, "token": token, "url": link_url}


@router.get("/links")
def list_links(db: Session = Depends(get_db), _=Depends(require_admin), course_id: Optional[int] = None):
    q = db.query(CertificationLink)
    if course_id:
        q = q.filter(CertificationLink.course_id == course_id)
    links = q.order_by(CertificationLink.created_at.desc()).all()
    return [
        {
            "id": lnk.id,
            "token": lnk.token,
            "course_id": lnk.course_id,
            "course_title": lnk.course.title if lnk.course else None,
            "assigned_email": lnk.assigned_email,
            "assigned_name": lnk.assigned_name,
            "expires_at": str(lnk.expires_at) if lnk.expires_at else None,
            "is_active": lnk.is_active,
            "completions": len(lnk.certifications) if lnk.certifications else 0,
        }
        for lnk in links
    ]


@router.get("/take/{token}")
def get_certification_link(token: str, db: Session = Depends(get_db)):
    """Public endpoint — no auth required. Returns course content for taking certification."""
    link = db.query(CertificationLink).filter(CertificationLink.token == token, CertificationLink.is_active == True).first()
    if not link:
        raise HTTPException(status_code=404, detail="Certification link not found or expired")
    if link.expires_at and link.expires_at < datetime.utcnow():
        raise HTTPException(status_code=410, detail="Certification link has expired")

    course = link.course
    result = {
        "link_id": link.id,
        "course_id": course.id,
        "course_title": course.title,
        "course_description": course.description,
        "pass_threshold": course.pass_threshold,
        "assigned_name": link.assigned_name,
        "assigned_email": link.assigned_email,
        "quizzes": [],
    }
    for quiz in (course.quizzes or []):
        q_out = {"id": quiz.id, "title": quiz.title, "time_limit_minutes": quiz.time_limit_minutes, "questions": []}
        for question in (quiz.questions or []):
            opts = [{"id": o.id, "option_text": o.option_text} for o in (question.options or [])]
            q_out["questions"].append({"id": question.id, "question_text": question.question_text, "options": opts})
        result["quizzes"].append(q_out)
    return result


@router.post("/take/{token}/submit")
def submit_certification(token: str, payload: SubmitAnswers, background_tasks: BackgroundTasks,
                         db: Session = Depends(get_db)):
    """Public endpoint — no auth required."""
    link = db.query(CertificationLink).filter(CertificationLink.token == token, CertificationLink.is_active == True).first()
    if not link:
        raise HTTPException(status_code=404, detail="Link not found")
    if link.expires_at and link.expires_at < datetime.utcnow():
        raise HTTPException(status_code=410, detail="Link expired")

    course = link.course

    # Check attempts
    existing = db.query(TeamCertification).filter(
        TeamCertification.link_id == link.id,
        TeamCertification.participant_email == payload.participant_email,
    ).first()
    max_attempts = max((q.max_attempts for q in course.quizzes), default=3)
    if existing and existing.attempts >= max_attempts and existing.status != CertStatus.completed:
        raise HTTPException(status_code=400, detail="Maximum attempts reached")

    # Score
    all_questions = []
    for quiz in (course.quizzes or []):
        all_questions.extend(quiz.questions or [])

    correct = 0
    for question in all_questions:
        selected_id = payload.answers.get(str(question.id))
        if selected_id:
            opt = db.query(QuizOption).filter(QuizOption.id == int(selected_id), QuizOption.question_id == question.id).first()
            if opt and opt.is_correct:
                correct += 1
    score = (correct / len(all_questions) * 100) if all_questions else 0
    passed = score >= course.pass_threshold

    now = datetime.utcnow()
    if not existing:
        cert = TeamCertification(
            link_id=link.id,
            course_id=course.id,
            participant_name=payload.participant_name,
            participant_email=payload.participant_email,
            started_at=now,
        )
        db.add(cert)
        db.flush()
    else:
        cert = existing

    cert.attempts += 1
    cert.score = score
    cert.answers = payload.answers
    cert.status = CertStatus.completed if passed else CertStatus.failed
    if passed:
        cert.completed_at = now
        cert.expires_at = now + timedelta(days=course.validity_days)

    db.commit()
    db.refresh(cert)

    if passed:
        output_dir = os.path.join(settings.upload_dir, "certificates")
        filepath = pdf_service.generate_certificate(cert, course, output_dir)
        rel_path = os.path.relpath(filepath, settings.upload_dir)
        cert.certificate_path = f"/uploads/{rel_path}"
        db.commit()

    return cert_out(cert)


@router.get("/")
def list_certifications(db: Session = Depends(get_db), current_user: User = Depends(get_current_user),
                        course_id: Optional[int] = None, status: Optional[str] = None):
    q = db.query(TeamCertification)
    if current_user.role == UserRole.team_member:
        q = q.filter(TeamCertification.user_id == current_user.id)
    if course_id:
        q = q.filter(TeamCertification.course_id == course_id)
    if status:
        q = q.filter(TeamCertification.status == status)
    certs = q.order_by(TeamCertification.created_at.desc()).limit(500).all()
    return [cert_out(c) for c in certs]


@router.get("/verify/{cert_id}")
def verify_certificate(cert_id: int, db: Session = Depends(get_db)):
    """Public verification endpoint."""
    cert = db.query(TeamCertification).filter(TeamCertification.id == cert_id).first()
    if not cert or cert.status != CertStatus.completed:
        raise HTTPException(status_code=404, detail="Certificate not found")
    return {
        "valid": True,
        "participant_name": cert.participant_name,
        "course_title": cert.course.title if cert.course else None,
        "completed_at": str(cert.completed_at) if cert.completed_at else None,
        "expires_at": str(cert.expires_at) if cert.expires_at else None,
        "score": cert.score,
    }


@router.post("/remind/{link_id}")
async def send_reminder(link_id: int, db: Session = Depends(get_db), _=Depends(require_admin)):
    link = db.query(CertificationLink).filter(CertificationLink.id == link_id).first()
    if not link or not link.assigned_email:
        raise HTTPException(status_code=404, detail="Link not found or no email assigned")
    link_url = f"{settings.frontend_url}/certify/{link.token}"
    await send_certification_reminder(
        link.assigned_email, link.assigned_name or link.assigned_email,
        link.course.title, link_url,
        str(link.expires_at.date()) if link.expires_at else None,
    )
    return {"sent": True}
