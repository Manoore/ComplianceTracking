"""
Seed the Medical Assistant / Patient Care Technician checklist templates.

Transcribed from the clinic's own paper forms:
  - MA/PCT Daily Check List    (17 items)
  - MA/PCT Monthly Check List  (15 items)

Usage:
    cd backend
    python seed_checklists.py                         # first tenant
    python seed_checklists.py --tenant-id 3
    python seed_checklists.py --email you@example.com # tenant that owns this user
    python seed_checklists.py --update                # replace items on existing templates

Templates are matched by name within the tenant. Without --update they are left
untouched, so re-running is safe.
"""
import argparse
import os
import sys

sys.path.insert(0, os.path.dirname(__file__))

from app.database import SessionLocal

# Relationships are declared by name, so every referenced mapper must be
# imported before the checklist mappers are configured.
import app.models  # noqa: F401
import app.models.department  # noqa: F401  (not re-exported from app.models)

from app.models.checklist import ChecklistTemplate, ChecklistItem, ItemCategory, ItemType
from app.models.tenant import Tenant
from app.models.user import User, UserRole

# (question, item_type, category, is_critical, description, type_config)
_P = ItemType.pass_fail_na
_SIG = ItemType.signature
_NUM = ItemType.numeric_range

DAILY = [
    ("48 Hour Callbacks Completed", _P, ItemCategory.documentation, False, None, None),
    ("Lab Reports Scanned / Called", _P, ItemCategory.documentation, False, None, None),
    ("X-Ray Reports Scanned / Called", _P, ItemCategory.documentation, False, None, None),
    ("UDS Reports / Chain of Custody", _P, ItemCategory.documentation, False, None, None),
    ("Mail / Fax / Scan Processed", _P, ItemCategory.documentation, False, None, None),
    ("RX Pads Counted (AM/PM)", _P, ItemCategory.regulatory, True,
     "Count prescription pads at the start and end of each shift.", None),
    ("Medication Refrigerator Temperature", _NUM, ItemCategory.equipment, True,
     "Record the actual temperature. Acceptable range is 36-46 degrees Fahrenheit.",
     {"min": 36, "max": 46, "unit": "°F"}),
    ("Multi-Dose Medications / Vials Labeled With Date Opened", _P, ItemCategory.safety, False, None, None),
    ("Equipment Turned Off", _P, ItemCategory.equipment, False, None, None),
    ("Rooms Stocked", _P, ItemCategory.facility, False, None, None),
    ("Instruments Cleaned / Wrapped / Autoclaved", _P, ItemCategory.hygiene, True, None, None),
    ("Deliveries Put Away; Invoice Scanned to Regional Manager", _P, ItemCategory.documentation, False, None, None),
    ("Cabinet Doors and Outer Doors Locked", _P, ItemCategory.safety, True, None, None),
    ("Daily Charts Audited", _P, ItemCategory.documentation, False, None, None),
    ("Oxygen Tanks and AED Checked", _P, ItemCategory.equipment, True, None, None),
    ("Eye Wash Station Checked", _P, ItemCategory.safety, False,
     "Required weekly rather than daily.", None),
    ("Regional Manager Initials / Date", _SIG, ItemCategory.staff, False, None, None),
]

MONTHLY = [
    ("Crash Cart / Procedure Room Inspection", _P, ItemCategory.equipment, True,
     "Medications: Aspirin, Benadryl injectable, Epinephrine injectable, Clonidine tablet, "
     "Ammonia inhalant and Glucose tablets. Confirm EKG, suction and defibrillator are "
     "operating and supplies are stocked.", None),
    ("Procedure Instruments Inspected and Replaced", _P, ItemCategory.equipment, False,
     "Autoclaved instrument packs must be re-autoclaved every 30 days regardless of use.", None),
    ("Emergency Light Box, First Aid Kit and Master Spill Kit Checked and Stocked",
     _P, ItemCategory.safety, True, None, None),
    ("Fire Extinguisher Charge Checked", _P, ItemCategory.safety, True, None, None),
    ("Basic Room Station Cleaned", _P, ItemCategory.hygiene, False,
     "Shelves, containers, counters, machines, supply drawers, exam beds, X-ray room and table.", None),
    ("Medications Checked for Expiration Dates", _P, ItemCategory.regulatory, True, None, None),
    ("Expired Medication Re-Ordered as Necessary", _P, ItemCategory.regulatory, False,
     "Includes injections and crash cart medications.", None),
    ("Blood Sugar Machine Controls Checked", _P, ItemCategory.equipment, False, None, None),
    ("Strep and Mono Controls Checked", _P, ItemCategory.equipment, False,
     "Check controls on open boxes.", None),
    ("BAT Calibration", _P, ItemCategory.equipment, False, None, None),
    ("Autoclave Spore Test Completed and Documented", _P, ItemCategory.hygiene, True, None, None),
    ("Monthly Supply Inventory Check List", _P, ItemCategory.facility, False,
     "To be completed each week.", None),
    ("Sharps and Biohazard Bins Checked for Overflow", _P, ItemCategory.safety, True, None, None),
    ("Mock Emergency Response Check List", _P, ItemCategory.safety, False, None, None),
    ("Regional Manager Initials / Date", _SIG, ItemCategory.staff, False, None, None),
]

TEMPLATES = [
    ("MA/PCT Daily Check List",
     "Daily checklist for Medical Assistants and Patient Care Technicians. "
     "Initial each item when complete; record the actual medication refrigerator temperature.",
     "daily", DAILY),
    ("MA/PCT Monthly Check List",
     "Monthly checklist for Medical Assistants and Patient Care Technicians. "
     "Initial and date each item when complete.",
     "monthly", MONTHLY),
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


def build_items(template_id, rows):
    return [
        ChecklistItem(
            template_id=template_id,
            question=question,
            item_type=item_type,
            category=category,
            is_critical=is_critical,
            description=description,
            type_config=type_config,
            is_required=True,
            weight=1.0,
            order_index=i,
        )
        for i, (question, item_type, category, is_critical, description, type_config)
        in enumerate(rows)
    ]


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--tenant-id", type=int)
    ap.add_argument("--email")
    ap.add_argument("--update", action="store_true",
                    help="replace the items on templates that already exist")
    args = ap.parse_args()

    db = SessionLocal()
    try:
        tenant = resolve_tenant(db, args)
        admin = (db.query(User)
                 .filter(User.tenant_id == tenant.id, User.role == UserRole.admin)
                 .order_by(User.id).first())

        created = updated = skipped = 0
        for name, description, frequency, rows in TEMPLATES:
            existing = (db.query(ChecklistTemplate)
                        .filter(ChecklistTemplate.tenant_id == tenant.id,
                                ChecklistTemplate.name == name)
                        .first())
            if existing:
                if not args.update:
                    skipped += 1
                    print(f"  = {name}: already exists ({len(existing.items)} items)")
                    continue
                existing.description = description
                existing.frequency = frequency
                for item in list(existing.items):
                    db.delete(item)
                db.flush()
                db.add_all(build_items(existing.id, rows))
                updated += 1
                print(f"  ~ {name}: items replaced ({len(rows)})")
                continue

            template = ChecklistTemplate(
                tenant_id=tenant.id,
                name=name,
                description=description,
                frequency=frequency,
                is_active=True,
                is_preset=False,
                created_by=admin.id if admin else None,
            )
            db.add(template)
            db.flush()
            db.add_all(build_items(template.id, rows))
            created += 1
            print(f"  + {name}: created with {len(rows)} items")

        db.commit()
        print(f"\nTenant: {tenant.name} (id={tenant.id})")
        print(f"{len(TEMPLATES)} templates: {created} created, {updated} updated, {skipped} already present")
        if skipped and not args.update:
            print("Re-run with --update to replace the items on the ones that already existed.")
    finally:
        db.close()


if __name__ == "__main__":
    main()
