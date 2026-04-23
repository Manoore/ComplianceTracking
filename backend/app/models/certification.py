import enum
from datetime import datetime
from sqlalchemy import Column, Integer, String, Boolean, DateTime, Enum, Text, ForeignKey, Float, JSON, Date
from sqlalchemy.orm import relationship
from ..database import Base


class CertStatus(str, enum.Enum):
    not_started = "not_started"
    in_progress = "in_progress"
    completed = "completed"
    failed = "failed"
    expired = "expired"
    overdue = "overdue"


class Course(Base):
    __tablename__ = "courses"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String, nullable=False)
    description = Column(Text, nullable=True)
    pass_threshold = Column(Float, default=80.0)  # percentage
    validity_days = Column(Integer, default=365)  # cert valid for N days
    is_active = Column(Boolean, default=True)
    created_by = Column(Integer, ForeignKey("users.id"))
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    creator = relationship("User", foreign_keys=[created_by])
    quizzes = relationship("Quiz", back_populates="course", cascade="all, delete-orphan")
    links = relationship("CertificationLink", back_populates="course", cascade="all, delete-orphan")


class Quiz(Base):
    __tablename__ = "quizzes"

    id = Column(Integer, primary_key=True, index=True)
    course_id = Column(Integer, ForeignKey("courses.id"), nullable=False)
    title = Column(String, nullable=False)
    description = Column(Text, nullable=True)
    time_limit_minutes = Column(Integer, nullable=True)
    max_attempts = Column(Integer, default=3)
    order_index = Column(Integer, default=0)

    course = relationship("Course", back_populates="quizzes")
    questions = relationship("QuizQuestion", back_populates="quiz", cascade="all, delete-orphan", order_by="QuizQuestion.order_index")


class QuizQuestion(Base):
    __tablename__ = "quiz_questions"

    id = Column(Integer, primary_key=True, index=True)
    quiz_id = Column(Integer, ForeignKey("quizzes.id"), nullable=False)
    question_text = Column(Text, nullable=False)
    explanation = Column(Text, nullable=True)
    order_index = Column(Integer, default=0)

    quiz = relationship("Quiz", back_populates="questions")
    options = relationship("QuizOption", back_populates="question", cascade="all, delete-orphan")


class QuizOption(Base):
    __tablename__ = "quiz_options"

    id = Column(Integer, primary_key=True, index=True)
    question_id = Column(Integer, ForeignKey("quiz_questions.id"), nullable=False)
    option_text = Column(Text, nullable=False)
    is_correct = Column(Boolean, default=False)

    question = relationship("QuizQuestion", back_populates="options")


class CertificationLink(Base):
    """Shareable link for a course — no app install needed."""
    __tablename__ = "certification_links"

    id = Column(Integer, primary_key=True, index=True)
    course_id = Column(Integer, ForeignKey("courses.id"), nullable=False)
    token = Column(String, unique=True, nullable=False, index=True)
    assigned_email = Column(String, nullable=True)  # pre-assigned recipient
    assigned_name = Column(String, nullable=True)
    expires_at = Column(DateTime, nullable=True)
    is_active = Column(Boolean, default=True)
    created_by = Column(Integer, ForeignKey("users.id"))
    created_at = Column(DateTime, default=datetime.utcnow)

    course = relationship("Course", back_populates="links")
    creator = relationship("User", foreign_keys=[created_by])
    certifications = relationship("TeamCertification", back_populates="link", cascade="all, delete-orphan")


class TeamCertification(Base):
    __tablename__ = "team_certifications"

    id = Column(Integer, primary_key=True, index=True)
    link_id = Column(Integer, ForeignKey("certification_links.id"), nullable=False)
    course_id = Column(Integer, ForeignKey("courses.id"), nullable=False)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True)  # null for anonymous
    participant_name = Column(String, nullable=False)
    participant_email = Column(String, nullable=False)
    status = Column(Enum(CertStatus), default=CertStatus.not_started)
    score = Column(Float, nullable=True)
    attempts = Column(Integer, default=0)
    answers = Column(JSON, default=dict)  # {question_id: option_id}
    started_at = Column(DateTime, nullable=True)
    completed_at = Column(DateTime, nullable=True)
    expires_at = Column(DateTime, nullable=True)
    certificate_path = Column(String, nullable=True)
    qr_code = Column(String, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    link = relationship("CertificationLink", back_populates="certifications")
    course = relationship("Course")
    user = relationship("User", foreign_keys=[user_id])
