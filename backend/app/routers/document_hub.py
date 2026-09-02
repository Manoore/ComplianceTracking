import os
from datetime import datetime
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from sqlalchemy.orm import Session
from ..database import get_db
from ..models.document_hub import HubDocument, HubDocumentVersion
from ..models.user import User, UserRole
from ..config import settings
from .deps import get_current_user

router = APIRouter(prefix="/document-hub", tags=["document_hub"])

ALLOWED_EXTS = [".pdf", ".doc", ".docx", ".xls", ".xlsx", ".ppt", ".pptx",
                ".txt", ".csv", ".jpg", ".jpeg", ".png"]


def doc_out(d: HubDocument) -> dict:
    return {
        "id": d.id,
        "title": d.title,
        "description": d.description,
        "category": d.category,
        "tags": d.tags,
        "current_version": d.current_version,
        "file_url": d.file_url,
        "file_name": d.file_name,
        "file_size": d.file_size,
        "uploaded_by": d.uploaded_by,
        "uploader_name": d.uploader.full_name if d.uploader else None,
        "is_active": d.is_active,
        "created_at": str(d.created_at) if d.created_at else None,
        "updated_at": str(d.updated_at) if d.updated_at else None,
        "version_count": len(d.versions),
    }


@router.get("/")
def list_documents(category: Optional[str] = None, search: Optional[str] = None,
                   db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    q = db.query(HubDocument).filter(
        HubDocument.tenant_id == current_user.tenant_id,
        HubDocument.is_active == True,
    )
    if category:
        q = q.filter(HubDocument.category == category)
    if search:
        q = q.filter(HubDocument.title.ilike(f"%{search}%"))
    return [doc_out(d) for d in q.order_by(HubDocument.updated_at.desc()).all()]


@router.get("/{doc_id}")
def get_document(doc_id: int, db: Session = Depends(get_db),
                 current_user: User = Depends(get_current_user)):
    d = db.query(HubDocument).filter(HubDocument.id == doc_id,
                                      HubDocument.tenant_id == current_user.tenant_id).first()
    if not d:
        raise HTTPException(status_code=404, detail="Document not found")
    out = doc_out(d)
    out["versions"] = [
        {
            "version_number": v.version_number,
            "file_url": v.file_url,
            "file_name": v.file_name,
            "change_notes": v.change_notes,
            "uploader_name": v.uploader.full_name if v.uploader else None,
            "created_at": str(v.created_at) if v.created_at else None,
        }
        for v in d.versions
    ]
    return out


@router.post("/", status_code=201)
async def upload_document(
    title: str = Form(...),
    description: str = Form(""),
    category: str = Form(""),
    tags: str = Form(""),
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    ext = os.path.splitext(file.filename or "")[1].lower()
    if ext not in ALLOWED_EXTS:
        raise HTTPException(status_code=400, detail="Unsupported file type")
    content = await file.read()
    if len(content) > settings.max_upload_size_mb * 1024 * 1024:
        raise HTTPException(status_code=413, detail="File too large")
    upload_dir = os.path.join(settings.upload_dir, "documents")
    os.makedirs(upload_dir, exist_ok=True)
    filename = f"doc_{datetime.utcnow().strftime('%Y%m%d%H%M%S')}_{file.filename}"
    filepath = os.path.join(upload_dir, filename)
    with open(filepath, "wb") as f:
        f.write(content)
    file_url = f"/uploads/documents/{filename}"

    d = HubDocument(
        tenant_id=current_user.tenant_id,
        title=title,
        description=description or None,
        category=category or None,
        tags=tags or None,
        file_url=file_url,
        file_name=file.filename,
        file_size=len(content),
        uploaded_by=current_user.id,
        current_version=1,
    )
    db.add(d)
    db.flush()
    db.add(HubDocumentVersion(
        document_id=d.id, version_number=1,
        file_url=file_url, file_name=file.filename,
        change_notes="Initial upload", uploaded_by=current_user.id,
    ))
    db.commit()
    db.refresh(d)
    return doc_out(d)


@router.put("/{doc_id}/metadata")
def update_metadata(doc_id: int, title: str = Form(...), description: str = Form(""),
                    category: str = Form(""), tags: str = Form(""),
                    db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    if current_user.role not in [UserRole.admin, UserRole.manager]:
        raise HTTPException(status_code=403, detail="Forbidden")
    d = db.query(HubDocument).filter(HubDocument.id == doc_id,
                                      HubDocument.tenant_id == current_user.tenant_id).first()
    if not d:
        raise HTTPException(status_code=404, detail="Not found")
    d.title = title
    d.description = description or None
    d.category = category or None
    d.tags = tags or None
    db.commit()
    db.refresh(d)
    return doc_out(d)


@router.post("/{doc_id}/new-version", status_code=201)
async def upload_new_version(doc_id: int, change_notes: str = Form(""),
                              file: UploadFile = File(...),
                              db: Session = Depends(get_db),
                              current_user: User = Depends(get_current_user)):
    if current_user.role not in [UserRole.admin, UserRole.manager]:
        raise HTTPException(status_code=403, detail="Forbidden")
    d = db.query(HubDocument).filter(HubDocument.id == doc_id,
                                      HubDocument.tenant_id == current_user.tenant_id).first()
    if not d:
        raise HTTPException(status_code=404, detail="Not found")
    ext = os.path.splitext(file.filename or "")[1].lower()
    if ext not in ALLOWED_EXTS:
        raise HTTPException(status_code=400, detail="Unsupported file type")
    content = await file.read()
    if len(content) > settings.max_upload_size_mb * 1024 * 1024:
        raise HTTPException(status_code=413, detail="File too large")
    upload_dir = os.path.join(settings.upload_dir, "documents")
    os.makedirs(upload_dir, exist_ok=True)
    filename = f"doc_{doc_id}_v{d.current_version + 1}_{datetime.utcnow().strftime('%Y%m%d%H%M%S')}{ext}"
    filepath = os.path.join(upload_dir, filename)
    with open(filepath, "wb") as f:
        f.write(content)
    file_url = f"/uploads/documents/{filename}"
    new_ver = d.current_version + 1
    d.current_version = new_ver
    d.file_url = file_url
    d.file_name = file.filename
    d.file_size = len(content)
    db.add(HubDocumentVersion(
        document_id=d.id, version_number=new_ver,
        file_url=file_url, file_name=file.filename,
        change_notes=change_notes or None, uploaded_by=current_user.id,
    ))
    db.commit()
    db.refresh(d)
    return doc_out(d)


@router.delete("/{doc_id}", status_code=204)
def archive_document(doc_id: int, db: Session = Depends(get_db),
                     current_user: User = Depends(get_current_user)):
    if current_user.role not in [UserRole.admin, UserRole.manager]:
        raise HTTPException(status_code=403, detail="Forbidden")
    d = db.query(HubDocument).filter(HubDocument.id == doc_id,
                                      HubDocument.tenant_id == current_user.tenant_id).first()
    if not d:
        raise HTTPException(status_code=404, detail="Not found")
    d.is_active = False
    db.commit()
