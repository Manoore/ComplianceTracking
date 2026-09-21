"""
Seed the Regional Manager Clinic Site Visit checklist template.

Transcribed from the RM's own clinic-visit audit form -- a standalone site
inspection an RM performs on a visit, independent of any specific MA/PCT
daily submission (not to be confused with the "Regional Manager / Clinic
Lead Review" reviewer_only item on the MA/PCT checklists).

Usage:
    cd backend
    python seed_rm_checklist.py                         # first tenant
    python seed_rm_checklist.py --tenant-id 3
    python seed_rm_checklist.py --email you@example.com  # tenant that owns this user
    python seed_rm_checklist.py --update                 # replace sections/items on an existing template

The template is matched by name within the tenant. Without --update it is
left untouched, so re-running is safe.
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

from app.models.checklist import ChecklistTemplate, ChecklistSection, ChecklistItem, ItemCategory, ItemType
from app.models.inspection import InspectionItem
from app.models.tenant import Tenant
from app.models.user import User, UserRole

TEMPLATE_NAME = "Regional Manager Clinic Site Visit"
TEMPLATE_DESCRIPTION = (
    "Comprehensive clinic site visit checklist for Regional Managers -- facility "
    "condition, cleanliness, operational metrics, patient experience observation, "
    "marketing, and staffing."
)

_YN = ItemType.yes_no
_TXT = ItemType.text_input
_NUM = ItemType.numeric
_MC = ItemType.multiple_choice
_OTHER = ItemCategory.other
_FACILITY = ItemCategory.facility
_HYGIENE = ItemCategory.hygiene
_STAFF = ItemCategory.staff
_SAFETY = ItemCategory.safety

# Each section: (title, [(question, item_type, category, is_critical, description, type_config), ...])
# clinic_name/date of audit/RM's own name are already captured by the inspection itself
# (clinic, checkin_time, inspector) -- not duplicated here as items.
SECTIONS = [
    ("Visit Details", [
        ("Your Role", _TXT, _STAFF, False, "The role you were acting in during this visit.", None),
        ("Who is working today?", _TXT, _STAFF, False, "List Provider and clinical staff.", None),
    ]),

    ("Facility Condition", [
        ("Outside lights and open sign lit properly", _YN, _FACILITY, False, None, None),
        ("Landscape appearance acceptable", _YN, _FACILITY, False, None, None),
        ("Office furniture in good condition", _YN, _FACILITY, False, None, None),
        ("Office walls in good condition", _YN, _FACILITY, False, None, None),
        ("Office floors in good condition", _YN, _FACILITY, False, None, None),
        ("Pending repairs or open facility tickets?", _YN, _FACILITY, False, None, None),
        ("Posters properly hung and up to date verbiage", _YN, _FACILITY, False, None, None),
    ]),

    ("Area Cleanliness", [
        ("Front Waiting Area (including coffee station)", _YN, _HYGIENE, False,
         "Are the areas below clean and organized?", None),
        ("Exam rooms", _YN, _HYGIENE, False, None, None),
        ("Internal Waiting Room", _YN, _HYGIENE, False, None, None),
        ("Front Restroom", _YN, _HYGIENE, False, None, None),
        ("Employee Restroom", _YN, _HYGIENE, False, None, None),
        ("OM Restroom", _YN, _HYGIENE, False, None, None),
        ("Reception", _YN, _HYGIENE, False, None, None),
        ("Lab Area", _YN, _HYGIENE, False, None, None),
        ("Nurse's Station", _YN, _HYGIENE, False, None, None),
        ("X-Ray room", _YN, _HYGIENE, False, None, None),
        ("Break Room", _YN, _HYGIENE, False, None, None),
    ]),

    ("Exam Rooms", [
        ("Are the Exam Rooms clean?", _YN, _HYGIENE, False, None, None),
        ("Are the Exam Rooms stocked?", _YN, _FACILITY, False, None, None),
        ("Are Sharps Containers being emptied timely?", _YN, _SAFETY, True, None, None),
    ]),

    ("Operational Tasks", [
        ("How does inventory look in this clinic?", _TXT, _OTHER, False, None, None),
        ("My manager has discussed clinic spending on medical and office supplies with me in the last 7-14 days",
         _YN, _OTHER, False, None, None),
        ("Downtime tasks have been assigned to my team, both individually and as a whole", _YN, _STAFF, False, None, None),
        ("This team is utilizing the downtime checklist by logging the date they are completing downtime tasks and approximately how much time was spent",
         _YN, _STAFF, False, None, None),
        ("What is this team's current NPS score?", _NUM, _OTHER, False, None, None),
        ("Is this team hitting their NPS goal?", _YN, _OTHER, False, None, None),
        ("If no, what is the team's action plan to hit goal?", _TXT, _OTHER, False, None, None),
        ("What is this team's current response rate?", _NUM, _OTHER, False, None, {"unit": "%"}),
        ("Is this team hitting their response rate goal?", _YN, _OTHER, False, None, None),
        ("If no, what is the team's action plan to hit response rate goal?", _TXT, _OTHER, False, None, None),
        ("Is this team trending to hit their visit goal?", _YN, _OTHER, False, None, None),
        ("If no, what is their action plan to hit visit goal?", _TXT, _OTHER, False, None, None),
        ("What is the team's current tokenization rate?", _NUM, _OTHER, False, None, {"unit": "%"}),
        ("Is this team hitting their tokenization goal?", _YN, _OTHER, False, None, None),
        ("If no, what is their action plan to reach tokenization goal?", _TXT, _OTHER, False, None, None),
        ("Are 48hr callbacks up to date?", _YN, _OTHER, False, None, None),
        ("Are Old Balance Audits being completed for this clinic?", _YN, _OTHER, False, None, None),
        ("Are old balances being collected?", _YN, _OTHER, False, None, None),
        ("Is this team at 99% copay collection rate found from your audits?", _YN, _OTHER, False, None, None),
        ("If no, are you communicating these errors/deficits with team members immediately?", _YN, _OTHER, False, None, None),
        ("Is this team using phone calls to create a different patient experience -- one where we are prioritizing driving patients to our clinic and creating great impressions, etc.?",
         _YN, _OTHER, False, None, None),
        ("How many Huddles have you joined this week?", _NUM, _STAFF, False, None, None),
        ("Which clinics?", _TXT, _STAFF, False, None, None),
        ("24hr Callbacks up to date and complete (MA Checklist)", _YN, _OTHER, False,
         "Only for locations that have been assigned to complete these.", None),
    ]),

    ("First Impression (Front Desk / Arrival Experience)", [
        ("Was the patient acknowledged immediately upon entry?", _YN, _OTHER, False, None, None),
        ("Did staff use a welcoming and friendly tone?", _YN, _OTHER, False, None, None),
        ("Was the environment clean, organized, and inviting?", _YN, _OTHER, False, None, None),
        ("Did staff offer comfort items when appropriate? (coffee, water)", _YN, _OTHER, False, None, None),
        ("Were children engaged appropriately? (offered popsicle, shown kid area)", _YN, _OTHER, False, None, None),
        ("Comments/observations from the First Impression section, and any coaching opportunity", _TXT, _OTHER, False, None, None),
    ]),

    ("Communication & Expectation Setting", [
        ("Did staff clearly explain the visit process?", _YN, _OTHER, False, None, None),
        ("Did they proactively communicate wait times in a reassuring way?", _YN, _OTHER, False, None, None),
        ("Was communication calm, confident, and not discouraging?", _YN, _OTHER, False, None, None),
        ("Comments/observations from the Communication & Expectation Setting section, and any coaching opportunity", _TXT, _OTHER, False, None, None),
    ]),

    ("In-Visit Engagement (Clinical + Rounding Experience)", [
        ("Did staff round on waiting patients?", _YN, _OTHER, False, None, None),
        ("Was the rounding basket utilized appropriately?", _YN, _OTHER, False, None, None),
        ("Did staff check in on comfort/needs during wait?", _YN, _OTHER, False, None, None),
        ("Did interactions feel personal vs. transactional?", _YN, _OTHER, False, None, None),
        ("Were any above-and-beyond moments observed? (cards given?)", _YN, _OTHER, False, None, None),
        ("Comments/observations from the In-Visit Engagement section, and any coaching opportunity", _TXT, _OTHER, False, None, None),
    ]),

    ("Discharge Experience", [
        ("Did staff/provider thank the patient for choosing us?", _YN, _OTHER, False, None, None),
        ("Did they use the 30-second rule? (encouraging sharing with friends/family)", _YN, _OTHER, False, None, None),
        ("Was discharge clear and not rushed?", _YN, _OTHER, False, None, None),
        ("Do you think the patient left feeling valued and cared for?", _YN, _OTHER, False, None, None),
        ("Comments/observations from the Discharge Experience section, and any coaching opportunity", _TXT, _OTHER, False, None, None),
    ]),

    ("Service Line Awareness & Growth Behaviors", [
        ("Did staff educate the patient on additional services? (Occ Health, Primary Care, Vibrance, etc.)", _YN, _OTHER, False, None, None),
        ("Did the patient receive materials? (flyer, card, etc.)", _YN, _OTHER, False, None, None),
        ("Were occ health cards provided to patients starting new jobs?", _MC, _OTHER, False,
         "Choose Somewhat if not applicable.", {"options": ["Yes", "No", "Somewhat"]}),
        ("Did staff naturally integrate service line education into conversation?", _YN, _OTHER, False, None, None),
        ("Did staff demonstrate awareness of all service lines offered?", _YN, _OTHER, False, None, None),
        ("Comments/observations from the Service Line Awareness section, and any coaching opportunity", _TXT, _OTHER, False, None, None),
    ]),

    ("Overall Experience Rating", [
        ("Would this experience drive a positive review/referral?", _YN, _OTHER, False, None, None),
        ("Would YOU send your family here based on what you observed?", _YN, _OTHER, False, None, None),
        ("Did they provide an exceptional Hometown experience?", _YN, _OTHER, False, None, None),
        ("Biggest strength observed", _TXT, _OTHER, False, None, None),
        ("Biggest opportunity identified", _TXT, _OTHER, False, None, None),
        ("What ONE coaching moment did you provide during this visit?", _TXT, _OTHER, False, None, None),
        ("Where did the interaction take place?", _TXT, _OTHER, False, None, None),
        ("Did the interaction align with our patient experience expectation?", _YN, _OTHER, False, None, None),
        ("If no, explain the restoration process", _TXT, _OTHER, False, None, None),
    ]),

    ("Marketing", [
        ("Does the clinic have up to date marketing collateral on Vibrance?", _YN, _OTHER, False, None, None),
        ("How many Vibrance referrals have come from this clinic this week?", _NUM, _OTHER, False, None, None),
        ("Have you been out in the community marketing this week?", _YN, _OTHER, False, None, None),
        ("If so, which services did you market?", _TXT, _OTHER, False, None, None),
        ("How many chamber events have you attended this week?", _NUM, _OTHER, False, None, None),
    ]),

    ("Staffing", [
        ("Is this clinic staffed appropriately according to the staffing matrix?", _YN, _STAFF, False, None, None),
        ("If no, explain action plan to become staffed appropriately", _TXT, _STAFF, False, None, None),
        ("Is this clinic high in overtime?", _YN, _STAFF, False, None, None),
        ("If yes, explain action plan to reduce the overtime", _TXT, _STAFF, False, None, None),
    ]),
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


def build_sections_and_items(template_id):
    """Builds each ChecklistItem with section=sec (the ORM relationship) rather than
    section_id, so SQLAlchemy resolves the foreign key at flush time without needing
    the section's id to exist yet -- no separate flush-then-link step required."""
    sections = []
    order = 0
    for sec_index, (title, rows) in enumerate(SECTIONS):
        sec = ChecklistSection(template_id=template_id, title=title, order_index=sec_index)
        for i, row in enumerate(rows):
            ChecklistItem(
                template_id=template_id, section=sec,
                question=row[0], item_type=row[1], category=row[2],
                is_critical=row[3], description=row[4], type_config=row[5],
                is_required=True, weight=1.0, order_index=order + i,
            )
        order += len(rows)
        sections.append(sec)
    return sections


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--tenant-id", type=int)
    ap.add_argument("--email")
    ap.add_argument("--update", action="store_true",
                    help="replace the sections/items on the template if it already exists")
    args = ap.parse_args()

    db = SessionLocal()
    try:
        tenant = resolve_tenant(db, args)
        admin = (db.query(User)
                 .filter(User.tenant_id == tenant.id, User.role == UserRole.admin)
                 .order_by(User.id).first())

        existing = (db.query(ChecklistTemplate)
                    .filter(ChecklistTemplate.tenant_id == tenant.id,
                            ChecklistTemplate.name == TEMPLATE_NAME)
                    .first())

        total_items = sum(len(rows) for _, rows in SECTIONS)

        if existing:
            if not args.update:
                print(f"  = {TEMPLATE_NAME}: already exists ({len(existing.items)} items). "
                      f"Re-run with --update to replace.")
                return

            existing_item_ids = [i.id for i in existing.items]
            in_use_ids = set()
            if existing_item_ids:
                in_use_ids = {
                    row[0] for row in db.query(InspectionItem.checklist_item_id)
                    .filter(InspectionItem.checklist_item_id.in_(existing_item_ids))
                    .distinct().all()
                }
            if in_use_ids:
                existing.description = TEMPLATE_DESCRIPTION
                db.commit()
                print(f"  ~ {TEMPLATE_NAME}: description updated; sections/items left as-is "
                      f"({len(in_use_ids)} already used in an inspection)")
                return

            for item in list(existing.items):
                db.delete(item)
            for sec in list(existing.sections):
                db.delete(sec)
            db.flush()

            existing.description = TEMPLATE_DESCRIPTION
            sections = build_sections_and_items(existing.id)
            db.add_all(sections)
            db.commit()
            print(f"  ~ {TEMPLATE_NAME}: replaced with {len(SECTIONS)} sections, {total_items} items")
            return

        template = ChecklistTemplate(
            tenant_id=tenant.id,
            name=TEMPLATE_NAME,
            description=TEMPLATE_DESCRIPTION,
            frequency=None,  # ad-hoc site visit, not tied to a daily/weekly/monthly cadence
            is_active=True,
            is_preset=False,
            created_by=admin.id if admin else None,
        )
        db.add(template)
        db.flush()
        sections = build_sections_and_items(template.id)
        db.add_all(sections)
        db.commit()
        print(f"  + {TEMPLATE_NAME}: created with {len(SECTIONS)} sections, {total_items} items")
        print(f"\nTenant: {tenant.name} (id={tenant.id})")
    finally:
        db.close()


if __name__ == "__main__":
    main()
