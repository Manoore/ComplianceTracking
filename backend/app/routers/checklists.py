from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from ..database import get_db
from ..models.checklist import ChecklistTemplate, ChecklistSection, ChecklistItem, ItemCategory, ItemType
from ..models.user import User
from ..utils.audit_trail import log_action
from .deps import get_current_user, require_admin
from ..data.preset_templates import PRESET_TEMPLATES

router = APIRouter(prefix="/checklists", tags=["checklists"])


class SectionIn(BaseModel):
    title: str
    description: Optional[str] = None
    order_index: int = 0


class ItemIn(BaseModel):
    section_id: Optional[int] = None
    item_type: ItemType = ItemType.pass_fail_na
    category: ItemCategory = ItemCategory.other
    question: str
    description: Optional[str] = None
    reference_url: Optional[str] = None
    is_required: bool = True
    is_critical: bool = False
    weight: float = 1.0
    type_config: Optional[dict] = None
    conditional_logic: Optional[dict] = None
    standard_tags: Optional[list] = None
    order_index: int = 0


class TemplateCreate(BaseModel):
    name: str
    description: Optional[str] = None
    sections: List[SectionIn] = []
    items: List[ItemIn] = []


class TemplateUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    is_active: Optional[bool] = None
    items: Optional[List[ItemIn]] = None


def section_out(s: ChecklistSection) -> dict:
    return {
        "id": s.id,
        "title": s.title,
        "description": s.description,
        "order_index": s.order_index,
    }


def item_out(i: ChecklistItem) -> dict:
    return {
        "id": i.id,
        "template_id": i.template_id,
        "section_id": i.section_id,
        "item_type": i.item_type.value if i.item_type else "pass_fail_na",
        "category": i.category.value if i.category else None,
        "question": i.question,
        "description": i.description,
        "reference_url": i.reference_url,
        "is_required": i.is_required,
        "is_critical": i.is_critical,
        "weight": i.weight,
        "type_config": i.type_config,
        "conditional_logic": i.conditional_logic,
        "standard_tags": i.standard_tags or [],
        "order_index": i.order_index,
    }


def template_out(t: ChecklistTemplate) -> dict:
    return {
        "id": t.id,
        "name": t.name,
        "description": t.description,
        "is_active": t.is_active,
        "is_preset": t.is_preset,
        "preset_category": t.preset_category,
        "version": t.version,
        "parent_template_id": t.parent_template_id,
        "created_by": t.created_by,
        "sections": [section_out(s) for s in (t.sections or [])],
        "items": [item_out(i) for i in (t.items or [])],
        "created_at": str(t.created_at) if t.created_at else None,
    }


@router.get("/")
def list_templates(include_presets: bool = True, db: Session = Depends(get_db),
                   _=Depends(get_current_user)):
    q = db.query(ChecklistTemplate).filter(ChecklistTemplate.is_active == True)
    if not include_presets:
        q = q.filter(ChecklistTemplate.is_preset == False)
    return [template_out(t) for t in q.order_by(ChecklistTemplate.name).all()]


@router.get("/presets")
def list_presets(db: Session = Depends(get_db), _=Depends(get_current_user)):
    """Return available preset categories and counts."""
    presets = db.query(ChecklistTemplate).filter(ChecklistTemplate.is_preset == True).all()
    if not presets:
        return [{"category": k, "count": len(v["items"])} for k, v in PRESET_TEMPLATES.items()]
    cats = {}
    for p in presets:
        c = p.preset_category or "other"
        cats[c] = cats.get(c, 0) + 1
    return [{"category": k, "count": v} for k, v in cats.items()]


@router.post("/presets/{category}/deploy", status_code=201)
def deploy_preset(category: str, db: Session = Depends(get_db),
                  current_user: User = Depends(require_admin)):
    """Create a ready-to-use template from a built-in preset."""
    data = PRESET_TEMPLATES.get(category)
    if not data:
        raise HTTPException(status_code=404, detail=f"Preset '{category}' not found")

    t = ChecklistTemplate(
        name=data["name"],
        description=data.get("description"),
        is_preset=True,
        preset_category=category,
        created_by=current_user.id,
    )
    db.add(t)
    db.flush()

    section_map: dict[str, int] = {}
    for sec_data in data.get("sections", []):
        sec = ChecklistSection(template_id=t.id, title=sec_data["title"],
                               order_index=sec_data.get("order_index", 0))
        db.add(sec)
        db.flush()
        section_map[sec_data["title"]] = sec.id

    for idx, item_data in enumerate(data.get("items", [])):
        sec_id = section_map.get(item_data.get("section")) if item_data.get("section") else None
        item = ChecklistItem(
            template_id=t.id,
            section_id=sec_id,
            item_type=ItemType(item_data.get("item_type", "pass_fail_na")),
            category=ItemCategory(item_data.get("category", "other")),
            question=item_data["question"],
            description=item_data.get("description"),
            reference_url=item_data.get("reference_url"),
            is_required=item_data.get("is_required", True),
            is_critical=item_data.get("is_critical", False),
            weight=item_data.get("weight", 1.0),
            order_index=idx,
        )
        db.add(item)

    db.commit()
    db.refresh(t)
    log_action(db, "checklist.deploy_preset", user_id=current_user.id,
               resource_type="checklist_template", resource_id=t.id,
               details={"category": category})
    db.commit()
    return template_out(t)


@router.post("/{template_id}/clone", status_code=201)
def clone_template(template_id: int, new_name: Optional[str] = None,
                   db: Session = Depends(get_db), current_user: User = Depends(require_admin)):
    src = db.query(ChecklistTemplate).filter(ChecklistTemplate.id == template_id).first()
    if not src:
        raise HTTPException(status_code=404, detail="Template not found")

    clone = ChecklistTemplate(
        name=new_name or f"{src.name} (copy)",
        description=src.description,
        is_preset=False,
        version=src.version,
        parent_template_id=src.id,
        created_by=current_user.id,
    )
    db.add(clone)
    db.flush()

    section_id_map: dict[int, int] = {}
    for sec in (src.sections or []):
        new_sec = ChecklistSection(template_id=clone.id, title=sec.title,
                                   description=sec.description, order_index=sec.order_index)
        db.add(new_sec)
        db.flush()
        section_id_map[sec.id] = new_sec.id

    for item in (src.items or []):
        new_item = ChecklistItem(
            template_id=clone.id,
            section_id=section_id_map.get(item.section_id) if item.section_id else None,
            item_type=item.item_type,
            category=item.category,
            question=item.question,
            description=item.description,
            reference_url=item.reference_url,
            is_required=item.is_required,
            is_critical=item.is_critical,
            weight=item.weight,
            type_config=item.type_config,
            conditional_logic=item.conditional_logic,
            order_index=item.order_index,
        )
        db.add(new_item)

    db.commit()
    db.refresh(clone)
    log_action(db, "checklist.clone", user_id=current_user.id,
               resource_type="checklist_template", resource_id=clone.id,
               details={"cloned_from": template_id})
    db.commit()
    return template_out(clone)


@router.post("/", status_code=201)
def create_template(payload: TemplateCreate, db: Session = Depends(get_db),
                    current_user: User = Depends(require_admin)):
    t = ChecklistTemplate(name=payload.name, description=payload.description,
                          created_by=current_user.id)
    db.add(t)
    db.flush()

    section_map: dict[int, int] = {}  # payload index -> db id
    for idx, sec_data in enumerate(payload.sections):
        sec = ChecklistSection(template_id=t.id, title=sec_data.title,
                               description=sec_data.description, order_index=sec_data.order_index)
        db.add(sec)
        db.flush()
        section_map[idx] = sec.id

    for item_data in payload.items:
        item = ChecklistItem(template_id=t.id, **item_data.model_dump())
        db.add(item)

    db.commit()
    db.refresh(t)
    log_action(db, "checklist.create", user_id=current_user.id,
               resource_type="checklist_template", resource_id=t.id)
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
    for k, v in payload.model_dump(exclude_none=True, exclude={'items'}).items():
        setattr(t, k, v)
    if payload.items is not None:
        db.query(ChecklistItem).filter(ChecklistItem.template_id == template_id).delete()
        for idx, item_data in enumerate(payload.items):
            data = item_data.model_dump()
            data['order_index'] = idx
            item = ChecklistItem(template_id=template_id, **data)
            db.add(item)
    db.commit()
    db.refresh(t)
    return template_out(t)


@router.post("/{template_id}/sections", status_code=201)
def add_section(template_id: int, payload: SectionIn, db: Session = Depends(get_db),
                current_user: User = Depends(require_admin)):
    t = db.query(ChecklistTemplate).filter(ChecklistTemplate.id == template_id).first()
    if not t:
        raise HTTPException(status_code=404, detail="Template not found")
    sec = ChecklistSection(template_id=template_id, **payload.model_dump())
    db.add(sec)
    db.commit()
    db.refresh(sec)
    return section_out(sec)


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
def update_item(template_id: int, item_id: int, payload: ItemIn,
                db: Session = Depends(get_db), current_user: User = Depends(require_admin)):
    item = db.query(ChecklistItem).filter(
        ChecklistItem.id == item_id, ChecklistItem.template_id == template_id).first()
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
    item = db.query(ChecklistItem).filter(
        ChecklistItem.id == item_id, ChecklistItem.template_id == template_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")
    db.delete(item)
    db.commit()
