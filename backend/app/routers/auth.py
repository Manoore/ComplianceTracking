import re
from datetime import datetime, timedelta
from fastapi import APIRouter, Depends, HTTPException, status, Request, BackgroundTasks
from fastapi.security import HTTPAuthorizationCredentials
from sqlalchemy.orm import Session
from pydantic import BaseModel, EmailStr
from ..database import get_db
from ..models.user import User, UserRole
from ..models.tenant import Tenant
from ..services.auth import authenticate_user, create_access_token, create_refresh_token, decode_token, hash_password
from ..services.email import send_password_reset
from ..utils.audit_trail import log_action
from ..config import settings
from .deps import get_current_user, require_admin, bearer

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


class ChangePasswordRequest(BaseModel):
    current_password: str
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


@router.post("/impersonate/{user_id}", response_model=TokenResponse)
async def impersonate(user_id: int, request: Request,
                      credentials: HTTPAuthorizationCredentials = Depends(bearer),
                      db: Session = Depends(get_db),
                      current_user: User = Depends(require_admin)):
    """Admin-only "View As": issues a normal access/refresh token pair for another
    user in the same tenant, so an admin can see exactly what that person's account
    sees (every existing endpoint "just works" since get_current_user only ever
    looks at the token's `sub`) without knowing their password. Purely for
    verifying how each role's views look -- actions taken while impersonating are
    logged under the impersonated user, same as if they'd done it themselves, so
    the frontend keeps a persistent banner up for the whole time."""
    payload = decode_token(credentials.credentials) or {}
    if payload.get("imp_by"):
        raise HTTPException(status_code=403, detail="Already viewing as someone else -- exit back to your own account first")

    target = db.query(User).filter(User.id == user_id, User.tenant_id == current_user.tenant_id).first()
    if not target:
        raise HTTPException(status_code=404, detail="User not found")
    if target.id == current_user.id:
        raise HTTPException(status_code=400, detail="That's your own account")
    if not target.is_active:
        raise HTTPException(status_code=400, detail="That user's account is disabled")

    log_action(db, "user.impersonate_start", user_id=current_user.id, resource_type="user",
               resource_id=target.id, details={"target_name": target.full_name},
               ip_address=request.client.host if request.client else None)
    db.commit()

    token_data = _make_token_data(target)
    token_data["imp_by"] = current_user.id
    return TokenResponse(
        access_token=create_access_token(token_data),
        refresh_token=create_refresh_token(token_data),
        user={
            "id": target.id, "email": target.email,
            "full_name": target.full_name, "role": target.role.value,
            "custom_role": target.custom_role, "tenant_id": target.tenant_id,
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


class DeleteAccountRequest(BaseModel):
    password: str


@router.delete("/me", status_code=200)
def delete_my_account(
    req: DeleteAccountRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Allow a user to permanently delete their own account. Requires password confirmation."""
    from ..services.auth import verify_password
    if current_user.hashed_password and not verify_password(req.password, current_user.hashed_password):
        raise HTTPException(status_code=400, detail="Incorrect password")

    log_action(db, "user.delete_account", user_id=current_user.id,
               resource_type="user", resource_id=current_user.id)

    # Anonymize PII so other records (audit logs) remain intact but the account is gone
    current_user.email = f"deleted_{current_user.id}@deleted.invalid"
    current_user.full_name = "Deleted User"
    current_user.hashed_password = None
    current_user.sso_subject = None
    current_user.avatar_url = None
    current_user.is_active = False

    db.commit()
    return {"message": "Account deleted successfully"}


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
    background.add_task(send_password_reset, user.email, user.full_name, reset_url)
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


@router.post("/change-password")
def change_password(req: ChangePasswordRequest, db: Session = Depends(get_db),
                    current_user: User = Depends(get_current_user)):
    from ..services.auth import verify_password
    if len(req.new_password) < 8:
        raise HTTPException(status_code=400, detail="Password must be at least 8 characters")
    if not current_user.hashed_password or not verify_password(req.current_password, current_user.hashed_password):
        raise HTTPException(status_code=400, detail="Current password is incorrect")

    current_user.hashed_password = hash_password(req.new_password)
    log_action(db, "user.change_password", user_id=current_user.id)
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
