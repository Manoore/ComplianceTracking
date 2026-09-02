import os
from datetime import date, timedelta, datetime
from typing import Optional, List
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from sqlalchemy.orm import Session
from pydantic import BaseModel
from ..database import get_db
from ..models.credential import Credential
from ..models.user import User, UserRole
from ..config import settings
from .deps import get_current_user

router = APIRouter(prefix="/credentials", tags=["credentials"])


class CredentialCreate(BaseModel):
    user_id: Optional[int] = None
    title: str
    credential_type: str
    issuing_body: Optional[str] = None
    credential_number: Optional[str] = None
    issue_date: Optional[str] = None
    expiry_date: Optional[str] = None
    notes: Optional[str] = None


class CredentialUpdate(CredentialCreate):
    pass


def parse_date(s: Optional[str]) -> Optional[date]:
    if not s:
        return None
    try:
        return date.fromisoformat(s)
    except Exception:
        return None


def expiry_status(expiry: Optional[date]) -> str:
    if not expiry:
        return "no_expiry"
    today = date.today()
    if expiry < today:
        return "expired"
    if expiry <= today + timedelta(days=30):
        return "expiring_soon"
    if expiry <= today + timedelta(days=90):
        return "expiring_90"
    return "valid"


def cred_out(c: Credential) -> dict:
    return {
        "id": c.id,
        "user_id": c.user_id,
        "user_name": c.user.full_name if c.user else None,
        "user_email": c.user.email if c.user else None,
        "title": c.title,
        "credential_type": c.credential_type,
        "issuing_body": c.issuing_body,
        "credential_number": c.credential_number,
        "issue_date": str(c.issue_date) if c.issue_date else None,
        "expiry_date": str(c.expiry_date) if c.expiry_date else None,
        "expiry_status": expiry_status(c.expiry_date),
        "notes": c.notes,
        "file_url": c.file_url,
        "file_name": c.file_name,
        "is_active": c.is_active,
        "created_at": str(c.created_at) if c.created_at else None,
    }


@router.get("/")
def list_credentials(user_id: Optional[int] = None, expiring_days: Optional[int] = None,
                     db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    q = db.query(Credential).filter(
        Credential.tenant_id == current_user.tenant_id,
        Credential.is_active == True,
    )
    if current_user.role not in [UserRole.admin, UserRole.manager, UserRole.auditor]:
        q = q.filter(Credential.user_id == current_user.id)
    elif user_id:
        q = q.filter(Credential.user_id == user_id)

    if expiring_days is not None:
        cutoff = date.today() + timedelta(days=expiring_days)
        q = q.filter(Credential.expiry_date.isnot(None), Credential.expiry_date <= cutoff)

    return [cred_out(c) for c in q.order_by(Credential.expiry_date.asc().nullslast()).all()]


@router.get("/summary")
def credential_summary(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    if current_user.role not in [UserRole.admin, UserRole.manager, UserRole.auditor]:
        raise HTTPException(status_code=403, detail="Forbidden")
    today = date.today()
    all_creds = db.query(Credential).filter(
        Credential.tenant_id == current_user.tenant_id,
        Credential.is_active == True,
    ).all()
    expired = [c for c in all_creds if c.expiry_date and c.expiry_date < today]
    soon_30 = [c for c in all_creds if c.expiry_date and today <= c.expiry_date <= today + timedelta(days=30)]
    soon_90 = [c for c in all_creds if c.expiry_date and today + timedelta(days=30) < c.expiry_date <= today + timedelta(days=90)]
    valid = [c for c in all_creds if not c.expiry_date or c.expiry_date > today + timedelta(days=90)]
    return {
        "total": len(all_creds),
        "expired": len(expired),
        "expiring_30": len(soon_30),
        "expiring_90": len(soon_90),
        "valid": len(valid),
        "items_expiring_soon": [cred_out(c) for c in sorted(soon_30 + expired, key=lambda x: x.expiry_date or date.min)],
    }


@router.post("/", status_code=201)
def create_credential(payload: CredentialCreate, db: Session = Depends(get_db),
                      current_user: User = Depends(get_current_user)):
    target_uid = payload.user_id or current_user.id
    if target_uid != current_user.id and current_user.role not in [UserRole.admin, UserRole.manager]:
        raise HTTPException(status_code=403, detail="Forbidden")
    c = Credential(
        tenant_id=current_user.tenant_id,
        user_id=target_uid,
        title=payload.title,
        credential_type=payload.credential_type,
        issuing_body=payload.issuing_body,
        credential_number=payload.credential_number,
        issue_date=parse_date(payload.issue_date),
        expiry_date=parse_date(payload.expiry_date),
        notes=payload.notes,
    )
    db.add(c)
    db.commit()
    db.refresh(c)
    return cred_out(c)


@router.put("/{cred_id}")
def update_credential(cred_id: int, payload: CredentialUpdate,
                      db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    c = db.query(Credential).filter(Credential.id == cred_id, Credential.tenant_id == current_user.tenant_id).first()
    if not c:
        raise HTTPException(status_code=404, detail="Not found")
    if c.user_id != current_user.id and current_user.role not in [UserRole.admin, UserRole.manager]:
        raise HTTPException(status_code=403, detail="Forbidden")
    c.title = payload.title
    c.credential_type = payload.credential_type
    c.issuing_body = payload.issuing_body
    c.credential_number = payload.credential_number
    c.issue_date = parse_date(payload.issue_date)
    c.expiry_date = parse_date(payload.expiry_date)
    c.notes = payload.notes
    db.commit()
    db.refresh(c)
    return cred_out(c)


@router.delete("/{cred_id}", status_code=204)
def delete_credential(cred_id: int, db: Session = Depends(get_db),
                      current_user: User = Depends(get_current_user)):
    c = db.query(Credential).filter(Credential.id == cred_id, Credential.tenant_id == current_user.tenant_id).first()
    if not c:
        raise HTTPException(status_code=404, detail="Not found")
    if c.user_id != current_user.id and current_user.role not in [UserRole.admin, UserRole.manager]:
        raise HTTPException(status_code=403, detail="Forbidden")
    c.is_active = False
    db.commit()


@router.post("/{cred_id}/file")
async def upload_credential_file(cred_id: int, file: UploadFile = File(...),
                                  db: Session = Depends(get_db),
                                  current_user: User = Depends(get_current_user)):
    c = db.query(Credential).filter(Credential.id == cred_id, Credential.tenant_id == current_user.tenant_id).first()
    if not c:
        raise HTTPException(status_code=404, detail="Not found")
    if c.user_id != current_user.id and current_user.role not in [UserRole.admin, UserRole.manager]:
        raise HTTPException(status_code=403, detail="Forbidden")
    ext = os.path.splitext(file.filename or "")[1].lower()
    if ext not in [".pdf", ".jpg", ".jpeg", ".png", ".doc", ".docx"]:
        raise HTTPException(status_code=400, detail="Unsupported file type")
    upload_dir = os.path.join(settings.upload_dir, "credentials")
    os.makedirs(upload_dir, exist_ok=True)
    filename = f"cred_{cred_id}_{datetime.utcnow().strftime('%Y%m%d%H%M%S')}{ext}"
    filepath = os.path.join(upload_dir, filename)
    content = await file.read()
    if len(content) > settings.max_upload_size_mb * 1024 * 1024:
        raise HTTPException(status_code=413, detail="File too large")
    with open(filepath, "wb") as f:
        f.write(content)
    c.file_url = f"/uploads/credentials/{filename}"
    c.file_name = file.filename
    db.commit()
    return {"url": c.file_url, "file_name": c.file_name}
