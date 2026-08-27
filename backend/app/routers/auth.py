import re
from datetime import datetime, timedelta
from fastapi import APIRouter, Depends, HTTPException, status, Request, BackgroundTasks
from sqlalchemy.orm import Session
from pydantic import BaseModel, EmailStr
from ..database import get_db
from ..models.user import User, UserRole
from ..models.tenant import Tenant
from ..services.auth import authenticate_user, create_access_token, create_refresh_token, decode_token, hash_password
from ..services.email import send_email
from ..utils.audit_trail import log_action
from ..config import settings
from .deps import get_current_user

router = APIRouter(prefix="/auth", tags=["auth"])


class LoginRequest(BaseModel):
    email: str
    password: str


class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    user: dict


class RefreshRequest(BaseModel):
    refresh_token: str


class RegisterRequest(BaseModel):
    org_name: str
    full_name: str
    email: str
    password: str


class FirebaseLoginRequest(BaseModel):
    id_token: str


class ForgotPasswordRequest(BaseModel):
    email: EmailStr


class ResetPasswordRequest(BaseModel):
    token: str
    new_password: str


def _make_token_data(user: User) -> dict:
    return {"sub": str(user.id), "role": user.role.value, "tenant_id": user.tenant_id}


@router.post("/login", response_model=TokenResponse)
async def login(req: LoginRequest, request: Request, db: Session = Depends(get_db)):
    user = authenticate_user(db, req.email, req.password)
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")
    if not user.is_active:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Account disabled")

    user.last_login = datetime.utcnow()
    db.commit()

    log_action(db, "user.login", user_id=user.id,
               ip_address=request.client.host if request.client else None,
               user_agent=request.headers.get("user-agent"))
    db.commit()

    token_data = _make_token_data(user)
    return TokenResponse(
        access_token=create_access_token(token_data),
        refresh_token=create_refresh_token(token_data),
        user={
            "id": user.id, "email": user.email,
            "full_name": user.full_name, "role": user.role.value,
            "tenant_id": user.tenant_id,
        },
    )


@router.post("/refresh", response_model=TokenResponse)
async def refresh(req: RefreshRequest, db: Session = Depends(get_db)):
    payload = decode_token(req.refresh_token)
    if not payload or payload.get("type") != "refresh":
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid refresh token")
    user = db.query(User).filter(User.id == int(payload["sub"]), User.is_active == True).first()  # noqa: E712
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found")

    token_data = _make_token_data(user)
    return TokenResponse(
        access_token=create_access_token(token_data),
        refresh_token=create_refresh_token(token_data),
        user={
            "id": user.id, "email": user.email,
            "full_name": user.full_name, "role": user.role.value,
            "tenant_id": user.tenant_id,
        },
    )


@router.get("/me")
async def me(current_user: User = Depends(get_current_user)):
    return {
        "id": current_user.id,
        "email": current_user.email,
        "full_name": current_user.full_name,
        "role": current_user.role.value,
        "custom_role": current_user.custom_role,
        "is_active": current_user.is_active,
        "last_login": current_user.last_login,
        "tenant_id": current_user.tenant_id,
    }


@router.post("/logout")
async def logout(request: Request, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    log_action(db, "user.logout", user_id=current_user.id,
               ip_address=request.client.host if request.client else None)
    db.commit()
    return {"message": "Logged out successfully"}


@router.post("/firebase")
def firebase_login(req: FirebaseLoginRequest, db: Session = Depends(get_db)):
    from ..services.firebase_service import verify_firebase_token
    decoded = verify_firebase_token(req.id_token)
    if not decoded:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED,
                            detail="Invalid or expired Firebase token")
    email = decoded.get("email")
    if not email:
        raise HTTPException(status_code=400, detail="No email in Firebase token")

    user = db.query(User).filter(User.email == email, User.is_active == True).first()  # noqa: E712
    if not user:
        raise HTTPException(
            status_code=404,
            detail="No account found for this email. Contact your organization admin or register a new organization."
        )

    user.last_login = datetime.utcnow()
    log_action(db, "user.login_firebase", user_id=user.id)
    db.commit()

    token_data = _make_token_data(user)
    return TokenResponse(
        access_token=create_access_token(token_data),
        refresh_token=create_refresh_token(token_data),
        user={
            "id": user.id, "email": user.email,
            "full_name": user.full_name, "role": user.role.value,
            "tenant_id": user.tenant_id,
        },
    )


@router.post("/forgot-password")
async def forgot_password(req: ForgotPasswordRequest, background: BackgroundTasks,
                          db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == req.email, User.is_active == True).first()  # noqa: E712
    # Always return 200 to avoid user enumeration
    if not user:
        return {"message": "If that email exists you will receive a reset link shortly."}

    token = create_access_token(
        {"sub": str(user.id), "type_override": "password_reset"},
        expires_delta=timedelta(minutes=30),
    )
    reset_url = f"{settings.frontend_url}/reset-password?token={token}"
    html = f"""
    <html><body style="font-family:sans-serif;max-width:480px;margin:40px auto;color:#1B3260">
      <h2 style="color:#1B3260">Password Reset</h2>
      <p>Hi {user.full_name},</p>
      <p>We received a request to reset your CompliNow password. Click the button below — this link expires in 30 minutes.</p>
      <p style="margin:24px 0">
        <a href="{reset_url}" style="background:#00C4A0;color:#07142A;padding:12px 24px;text-decoration:none;border-radius:8px;font-weight:600">
          Reset Password
        </a>
      </p>
      <p style="color:#999;font-size:12px">If you didn't request this, you can safely ignore this email.</p>
      <p style="color:#999;font-size:11px">Or copy this link: {reset_url}</p>
    </body></html>
    """
    background.add_task(send_email, user.email, "Reset your CompliNow password", html)
    log_action(db, "user.forgot_password", user_id=user.id)
    db.commit()
    return {"message": "If that email exists you will receive a reset link shortly."}


@router.post("/reset-password")
def reset_password(req: ResetPasswordRequest, db: Session = Depends(get_db)):
    if len(req.new_password) < 8:
        raise HTTPException(status_code=400, detail="Password must be at least 8 characters")

    payload = decode_token(req.token)
    if not payload or payload.get("type_override") != "password_reset":
        raise HTTPException(status_code=400, detail="Invalid or expired reset link")

    user = db.query(User).filter(User.id == int(payload["sub"]), User.is_active == True).first()  # noqa: E712
    if not user:
        raise HTTPException(status_code=400, detail="Invalid or expired reset link")

    user.hashed_password = hash_password(req.new_password)
    log_action(db, "user.password_reset", user_id=user.id)
    db.commit()
    return {"message": "Password updated successfully"}


@router.post("/register", status_code=201)
def register(payload: RegisterRequest, db: Session = Depends(get_db)):
    if db.query(User).filter(User.email == payload.email).first():
        raise HTTPException(status_code=409, detail="An account with this email already exists")

    # Generate unique slug from org name
    base_slug = re.sub(r"[^a-z0-9-]", "", re.sub(r"[\s_]", "-", payload.org_name.lower()))[:50] or "org"
    slug, attempt = base_slug, 0
    while db.query(Tenant).filter(Tenant.slug == slug).first():
        attempt += 1
        slug = f"{base_slug}-{attempt}"

    tenant = Tenant(
        name=payload.org_name,
        slug=slug,
        plan="free",
        trial_ends_at=datetime.utcnow() + timedelta(days=14),
    )
    db.add(tenant)
    db.flush()

    user = User(
        email=payload.email,
        full_name=payload.full_name,
        hashed_password=hash_password(payload.password),
        role=UserRole.admin,
        tenant_id=tenant.id,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    db.refresh(tenant)

    token_data = _make_token_data(user)
    return {
        "access_token": create_access_token(token_data),
        "refresh_token": create_refresh_token(token_data),
        "token_type": "bearer",
        "user": {
            "id": user.id, "email": user.email,
            "full_name": user.full_name, "role": user.role.value,
            "tenant_id": user.tenant_id,
        },
        "tenant": {"id": tenant.id, "name": tenant.name, "slug": tenant.slug},
    }
