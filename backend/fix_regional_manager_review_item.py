"""
One-time fix: make the "Regional Manager Initials / Date" line on the
MA/PCT Daily and Monthly checklists a reviewer-only item -- something
only the assigned Clinic Lead / Regional Manager / Director of
Operations / Admin can complete, and only after the MA/PCT has
submitted the checklist. The MA never sees an editable control for it.

seed_checklists.py --update won't apply this change on its own once any
inspection has been submitted against these templates (it deliberately
leaves items alone in that case, to avoid destroying compliance
history). This script instead updates just the existing item in place --
safe, because it only affects how the item is rendered and validated
going forward; nothing about already-submitted inspection answers is
touched.

Safe to run whether the item is still in its original state or was
already touched by an earlier version of this script.

Usage:
    cd backend
    python fix_regional_manager_review_item.py                # dry run: reports only
    python fix_regional_manager_review_item.py --apply         # writes, all tenants
    python fix_regional_manager_review_item.py --apply --tenant-id 3
"""
import argparse
import os
import sys

sys.path.insert(0, os.path.dirname(__file__))

from app.database import SessionLocal

import app.models  # noqa: F401
import app.models.department  # noqa: F401  (not re-exported from app.models)

from app.models.checklist import ChecklistTemplate, ChecklistItem, ItemType

NEW_QUESTION = "Regional Manager / Clinic Lead Review"
NEW_DESCRIPTION = ("Completed by the assigned Clinic Lead or Regional Manager after the "
                   "MA/PCT submits this checklist -- not something the MA fills in.")
TEMPLATE_NAMES = ("MA/PCT Daily Check List", "MA/PCT Monthly Check List")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--tenant-id", type=int, help="limit to one tenant (default: all tenants)")
    ap.add_argument("--apply", action="store_true",
                    help="write the changes; without this flag, only a report is printed")
    args = ap.parse_args()

    db = SessionLocal()
    try:
        q = (db.query(ChecklistItem)
             .join(ChecklistTemplate, ChecklistItem.template_id == ChecklistTemplate.id)
             .filter(ChecklistTemplate.name.in_(TEMPLATE_NAMES),
                     ChecklistItem.question.in_(["Regional Manager Initials / Date", NEW_QUESTION])))
        if args.tenant_id:
            q = q.filter(ChecklistTemplate.tenant_id == args.tenant_id)
        items = q.all()

        already_done = [i for i in items if i.item_type == ItemType.signature and i.reviewer_only]
        to_fix = [i for i in items if i not in already_done]

        if not to_fix:
            print(f"Nothing to do -- {len(already_done)} item(s) already correct, "
                  f"or these templates aren't seeded yet.")
            return

        for item in to_fix:
            tpl = item.template
            print(f"{'Would update' if not args.apply else 'Updating'}: "
                  f"tenant={tpl.tenant_id} template='{tpl.name}' item_id={item.id} "
                  f"(type={item.item_type.value}, reviewer_only={item.reviewer_only} -> "
                  f"type=signature, reviewer_only=True)")
            if args.apply:
                item.question = NEW_QUESTION
                item.item_type = ItemType.signature
                item.description = NEW_DESCRIPTION
                item.reviewer_only = True

        if args.apply:
            db.commit()
            print(f"\nUpdated {len(to_fix)} item(s).")
        else:
            print(f"\n{len(to_fix)} item(s) would be updated. Re-run with --apply to write.")
    finally:
        db.close()


if __name__ == "__main__":
    main()
