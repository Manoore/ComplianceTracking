"""
Seed the standard service-line departments used to organize clinics and
checklist templates.

Usage:
    cd backend
    python seed_departments.py                         # first tenant
    python seed_departments.py --tenant-id 3
    python seed_departments.py --email you@example.com # tenant that owns this user

Departments are matched by name within the tenant, so re-running is safe —
existing ones are left untouched.
"""
import argparse
import os
import sys

sys.path.insert(0, os.path.dirname(__file__))

from app.database import SessionLocal
import app.models  # noqa: F401
import app.models.department  # noqa: F401  (not re-exported from app.models)

from app.models.department import Department
from app.models.tenant import Tenant
from app.models.user import User

# (name, description, color)
DEPARTMENTS = [
    ("Urgent Care", "Walk-in acute care clinics", "#dc2626"),
    ("Occupational Health", "Employer and workplace health services", "#0891b2"),
    ("Primary Care", "Routine and preventive care clinics", "#16a34a"),
    ("Clinical Research", "Trial and research sites", "#7c3aed"),
    ("Corporate", "Administrative and shared-services locations", "#57534e"),
]


def resolve_tenant(db, args):
    if args.tenant_id:
        t = db.query(Tenant).filter(Tenant.id == args.tenant_id).first()
        if not t:
            sys.exit(f"No tenant with id={args.tenant_id}")
        return t
    if args.email:
        user = db.query(User).filter(User.email == args.email).first()
        if not user:
            sys.exit(f"No user with email={args.email}")
        if not user.tenant_id:
            sys.exit(f"User {args.email} has no tenant assigned")
        return db.query(Tenant).filter(Tenant.id == user.tenant_id).first()
    t = db.query(Tenant).order_by(Tenant.id).first()
    if not t:
        sys.exit("No tenants exist yet. Start the API once to seed the default tenant.")
    return t


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--tenant-id", type=int)
    ap.add_argument("--email")
    args = ap.parse_args()

    db = SessionLocal()
    try:
        tenant = resolve_tenant(db, args)
        created = skipped = 0
        for name, description, color in DEPARTMENTS:
            existing = (db.query(Department)
                        .filter(Department.tenant_id == tenant.id, Department.name == name)
                        .first())
            if existing:
                skipped += 1
                continue
            db.add(Department(tenant_id=tenant.id, name=name, description=description,
                              color=color, is_active=True))
            created += 1

        db.commit()
        print(f"Tenant: {tenant.name} (id={tenant.id})")
        print(f"{len(DEPARTMENTS)} departments: {created} created, {skipped} already present")
    finally:
        db.close()


if __name__ == "__main__":
    main()
