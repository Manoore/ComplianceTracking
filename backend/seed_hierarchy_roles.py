"""
Seed the custom roles used in the review hierarchy: Clinic Lead, Regional
Manager, and Director of Operations.

Usage:
    cd backend
    python seed_hierarchy_roles.py
    python seed_hierarchy_roles.py --tenant-id 3
    python seed_hierarchy_roles.py --email you@example.com

After running, assign these roles to users from the Users page (role field
becomes the custom role's slug automatically). For a Regional Manager, also
set their "Managed Region" to one of the values used in Clinic.region
(e.g. "Cleveland", "Akron") so the hierarchy dashboard scopes correctly.

Roles are matched by name within the tenant, so re-running is safe.
"""
import argparse
import os
import sys

sys.path.insert(0, os.path.dirname(__file__))

from app.database import SessionLocal
import app.models  # noqa: F401
import app.models.department  # noqa: F401  (not re-exported from app.models)

from app.models.role import Role, RolePermission
from app.models.tenant import Tenant
from app.models.user import User

# (slug, display name, modules)
ROLES = [
    ("clinic_lead", "Clinic Lead",
     ["clinics", "checklists", "inspections", "audits", "certifications", "corrective_actions",
      "policies", "executive", "departments", "credentials", "document_hub", "standards", "announcements"]),
    ("regional_manager", "Regional Manager",
     ["clinics", "checklists", "inspections", "audits", "certifications", "corrective_actions",
      "policies", "executive", "departments", "credentials", "document_hub", "standards",
      "announcements", "reports"]),
    ("director_of_operations", "Director of Operations",
     ["clinics", "checklists", "inspections", "audits", "certifications", "corrective_actions",
      "policies", "executive", "departments", "credentials", "document_hub", "standards",
      "announcements", "reports"]),
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
        for slug, display_name, modules in ROLES:
            existing = (db.query(Role)
                        .filter(Role.tenant_id == tenant.id, Role.name == slug)
                        .first())
            if existing:
                skipped += 1
                print(f"  = {display_name}: already exists")
                continue
            role = Role(name=slug, display_name=display_name, is_system=False, tenant_id=tenant.id)
            db.add(role)
            db.flush()
            db.add_all(RolePermission(role_id=role.id, module=m) for m in modules)
            created += 1
            print(f"  + {display_name}: created with {len(modules)} module(s)")

        db.commit()
        print(f"\nTenant: {tenant.name} (id={tenant.id})")
        print(f"{len(ROLES)} roles: {created} created, {skipped} already present")
    finally:
        db.close()


if __name__ == "__main__":
    main()
