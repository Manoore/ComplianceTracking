"""
One-off diagnostic: which tenant does each user belong to, and where did the
seeded clinics/templates land? Read-only — makes no changes.

Usage:
    cd backend
    python diagnose_tenants.py
"""
import os
import sys

sys.path.insert(0, os.path.dirname(__file__))

from app.database import SessionLocal
import app.models  # noqa: F401
import app.models.department  # noqa: F401  (not re-exported from app.models)

from app.models.tenant import Tenant
from app.models.user import User
from app.models.clinic import Clinic
from app.models.checklist import ChecklistTemplate

db = SessionLocal()
try:
    tenants = db.query(Tenant).order_by(Tenant.id).all()
    print(f"{len(tenants)} tenant(s):\n")
    for t in tenants:
        users = db.query(User).filter(User.tenant_id == t.id).order_by(User.id).all()
        clinic_count = db.query(Clinic).filter(Clinic.tenant_id == t.id).count()
        template_count = db.query(ChecklistTemplate).filter(ChecklistTemplate.tenant_id == t.id).count()
        print(f"Tenant id={t.id}  name={t.name!r}")
        print(f"  clinics: {clinic_count}   templates (tenant_id set): {template_count}")
        if users:
            for u in users:
                print(f"  user: {u.email:<35} role={u.role.value:<10} active={u.is_active}")
        else:
            print("  (no users)")
        print()

    orphaned_templates = db.query(ChecklistTemplate).filter(ChecklistTemplate.tenant_id.is_(None)).count()
    if orphaned_templates:
        print(f"NOTE: {orphaned_templates} template(s) have no tenant_id set (tenant_id IS NULL).")
finally:
    db.close()
