from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from pydantic import BaseModel
from ..database import get_db
from ..models.checklist import ChecklistTemplate, ChecklistItem, ItemCategory
from ..models.user import User
from ..utils.audit_trail import log_action
from .deps import get_current_user, require_admin

router = APIRouter(prefix="/checklists", tags=["checklists"])


class ItemIn(BaseModel):
    category: ItemCategory = ItemCategory.other
    question: str
    description: Optional[str] = None
    is_required: bool = True
    is_critical: bool = False
    order_index: int = 0


class TemplateCreate(BaseModel):
    name: str
    description: Optional[str] = None
    items: List[ItemIn] = []


class TemplateUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    is_active: Optional[bool] = None


def item_out(i: ChecklistItem) -> dict:
    return {
        "id": i.id,
        "template_id": i.template_id,
        "category": i.category.value if i.category else None,
        "question": i.question,
        "description": i.description,
        "is_required": i.is_required,
        "is_critical": i.is_critical,
        "order_index": i.order_index,
    }


def template_out(t: ChecklistTemplate) -> dict:
    return {
        "id": t.id,
        "name": t.name,
        "description": t.description,
        "is_active": t.is_active,
        "created_by": t.created_by,
        "items": [item_out(i) for i in (t.items or [])],
        "created_at": str(t.created_at) if t.created_at else None,
    }


@router.get("/")
def list_templates(db: Session = Depends(get_db), _=Depends(get_current_user)):
    templates = db.query(ChecklistTemplate).filter(ChecklistTemplate.is_active == True).all()
    return [template_out(t) for t in templates]


@router.post("/", status_code=201)
def create_template(payload: TemplateCreate, db: Session = Depends(get_db),
                    current_user: User = Depends(require_admin)):
    t = ChecklistTemplate(name=payload.name, description=payload.description, created_by=current_user.id)
    db.add(t)
    db.flush()
    for item_data in payload.items:
        item = ChecklistItem(template_id=t.id, **item_data.model_dump())
        db.add(item)
    db.commit()
    db.refresh(t)
    log_action(db, "checklist.create", user_id=current_user.id, resource_type="checklist_template", resource_id=t.id)
    db.commit()
    return template_out(t)


@router.get("/{template_id}")
def get_template(template_id: int, db: Session = Depends(get_db), _=Depends(get_current_user)):
    t = db.query(ChecklistTemplate).filter(ChecklistTemplate.id == template_id).first()
    if not t:
        raise HTTPException(status_code=404, detail="Template not found")
    return template_out(t)


@router.put("/{template_id}")
def update_template(template_id: int, payload: TemplateUpdate, db: Session = Depends(get_db),
                    current_user: User = Depends(require_admin)):
    t = db.query(ChecklistTemplate).filter(ChecklistTemplate.id == template_id).first()
    if not t:
        raise HTTPException(status_code=404, detail="Template not found")
    for k, v in payload.model_dump(exclude_none=True).items():
        setattr(t, k, v)
    db.commit()
    db.refresh(t)
    log_action(db, "checklist.update", user_id=current_user.id, resource_type="checklist_template", resource_id=template_id)
    db.commit()
    return template_out(t)


@router.post("/{template_id}/items", status_code=201)
def add_item(template_id: int, payload: ItemIn, db: Session = Depends(get_db),
             current_user: User = Depends(require_admin)):
    t = db.query(ChecklistTemplate).filter(ChecklistTemplate.id == template_id).first()
    if not t:
        raise HTTPException(status_code=404, detail="Template not found")
    item = ChecklistItem(template_id=template_id, **payload.model_dump())
    db.add(item)
    db.commit()
    db.refresh(item)
    return item_out(item)


@router.put("/{template_id}/items/{item_id}")
def update_item(template_id: int, item_id: int, payload: ItemIn, db: Session = Depends(get_db),
                current_user: User = Depends(require_admin)):
    item = db.query(ChecklistItem).filter(ChecklistItem.id == item_id, ChecklistItem.template_id == template_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")
    for k, v in payload.model_dump().items():
        setattr(item, k, v)
    db.commit()
    db.refresh(item)
    return item_out(item)


@router.delete("/{template_id}/items/{item_id}", status_code=204)
def delete_item(template_id: int, item_id: int, db: Session = Depends(get_db),
                current_user: User = Depends(require_admin)):
    item = db.query(ChecklistItem).filter(ChecklistItem.id == item_id, ChecklistItem.template_id == template_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")
    db.delete(item)
    db.commit()
