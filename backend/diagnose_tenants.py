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

    print("=" * 60)
    orphaned_users = db.query(User).filter(User.tenant_id.is_(None)).order_by(User.id).all()
    orphaned_clinics = db.query(Clinic).filter(Clinic.tenant_id.is_(None)).all()
    orphaned_templates = db.query(ChecklistTemplate).filter(ChecklistTemplate.tenant_id.is_(None)).all()

    print(f"Users with NO tenant assigned (tenant_id IS NULL): {len(orphaned_users)}")
    for u in orphaned_users:
        print(f"  user: {u.email:<35} role={u.role.value:<10} active={u.is_active}")

    print(f"\nClinics with NO tenant assigned: {len(orphaned_clinics)}")
    for c in orphaned_clinics:
        print(f"  clinic: {c.name}")

    presets = [t for t in orphaned_templates if t.is_preset]
    non_presets = [t for t in orphaned_templates if not t.is_preset]
    print(f"\nOrphaned templates: {len(orphaned_templates)} total "
          f"({len(presets)} presets, {len(non_presets)} non-preset)")
    for t in non_presets:
        print(f"  non-preset, no tenant: {t.name}")
finally:
    db.close()
