"""
One-time fix: attach orphaned (tenant_id IS NULL) users, clinics, and custom
checklist templates to the tenant they actually belong to.

These rows predate the tenant_id column. It was added to existing tables via
`ALTER TABLE ... ADD COLUMN` with no backfill for the single-tenant era
before this feature existed, so old rows were left with tenant_id = NULL.
Preset templates (is_preset=True) are deliberately left alone - they are a
shared, tenant-less library, not organization-specific data.

Usage:
    cd backend
    python fix_orphaned_tenants.py                 # dry run: reports only, no writes
    python fix_orphaned_tenants.py --apply          # writes, targeting the first tenant
    python fix_orphaned_tenants.py --apply --tenant-id 3
"""
import argparse
import os
import sys

sys.path.insert(0, os.path.dirname(__file__))

from app.database import SessionLocal

# Relationships are declared by name, so every referenced mapper must be
# imported before the affected mappers are configured.
import app.models  # noqa: F401
import app.models.department  # noqa: F401  (not re-exported from app.models)

from app.models.tenant import Tenant
from app.models.user import User
from app.models.clinic import Clinic
from app.models.checklist import ChecklistTemplate


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--tenant-id", type=int,
                    help="tenant to assign orphaned rows to (default: first tenant by id)")
    ap.add_argument("--apply", action="store_true",
                    help="write the changes; without this flag, only a report is printed")
    args = ap.parse_args()

    db = SessionLocal()
    try:
        if args.tenant_id:
            tenant = db.query(Tenant).filter(Tenant.id == args.tenant_id).first()
            if not tenant:
                sys.exit(f"No tenant with id={args.tenant_id}")
        else:
            tenant = db.query(Tenant).order_by(Tenant.id).first()
            if not tenant:
                sys.exit("No tenants exist yet.")

        orphaned_users = db.query(User).filter(User.tenant_id.is_(None)).order_by(User.id).all()
        orphaned_clinics = db.query(Clinic).filter(Clinic.tenant_id.is_(None)).all()
        orphaned_templates = (db.query(ChecklistTemplate)
                              .filter(ChecklistTemplate.tenant_id.is_(None),
                                      ChecklistTemplate.is_preset == False)  # noqa: E712
                              .all())

        print(f"Target tenant: {tenant.name!r} (id={tenant.id})\n")

        print(f"Users to reassign ({len(orphaned_users)}):")
        for u in orphaned_users:
            print(f"  {u.email}  (role={u.role.value})")

        print(f"\nClinics to reassign ({len(orphaned_clinics)}):")
        for c in orphaned_clinics:
            print(f"  {c.name}")

        print(f"\nCustom templates to reassign ({len(orphaned_templates)}):")
        for t in orphaned_templates:
            print(f"  {t.name}")

        if not args.apply:
            print("\nDry run only, nothing was changed. Re-run with --apply to write these changes.")
            return

        for u in orphaned_users:
            u.tenant_id = tenant.id
        for c in orphaned_clinics:
            c.tenant_id = tenant.id
        for t in orphaned_templates:
            t.tenant_id = tenant.id
        db.commit()

        print(f"\nDone: {len(orphaned_users)} user(s), {len(orphaned_clinics)} clinic(s), "
              f"{len(orphaned_templates)} template(s) now belong to tenant {tenant.id}.")
    finally:
        db.close()


if __name__ == "__main__":
    main()
