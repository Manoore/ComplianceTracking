"""
One-time fix: turn the "Regional Manager Initials / Date" line on the
MA/PCT Daily and Monthly checklists from a single signature (which the
MA filling out the checklist could just initial themselves) into a
dual sign-off, which requires a second, different person to actually
review and countersign before that item -- and the checklist -- counts
as complete.

seed_checklists.py --update won't apply this change on its own once any
inspection has been submitted against these templates (it deliberately
leaves items alone in that case, to avoid destroying compliance
history). This script instead updates just the existing item's type and
question text in place -- safe, because it only affects how the item is
rendered and validated going forward; nothing about already-submitted
inspection answers is touched.

After this runs, use the Roles & Permissions page to confirm each
Regional Manager / Clinic Lead / Director custom role can actually see
the clinics whose checklists they need to countersign, and check the
inspection detail page for the new "2nd Signature Required" prompt on
the checklists in progress.

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

OLD_QUESTION = "Regional Manager Initials / Date"
NEW_QUESTION = "Regional Manager / Clinic Lead Review"
NEW_DESCRIPTION = ("MA/PCT signs first; the Regional Manager or Clinic Lead must review "
                   "and countersign before this checklist counts as complete.")
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
                     ChecklistItem.question == OLD_QUESTION))
        if args.tenant_id:
            q = q.filter(ChecklistTemplate.tenant_id == args.tenant_id)
        items = q.all()

        if not items:
            print("No matching items found (already fixed, or these templates aren't seeded yet).")
            return

        for item in items:
            tpl = item.template
            print(f"{'Would update' if not args.apply else 'Updating'}: "
                  f"tenant={tpl.tenant_id} template='{tpl.name}' item_id={item.id} "
                  f"({item.item_type.value} -> {ItemType.dual_signoff.value})")
            if args.apply:
                item.question = NEW_QUESTION
                item.item_type = ItemType.dual_signoff
                item.description = NEW_DESCRIPTION

        if args.apply:
            db.commit()
            print(f"\nUpdated {len(items)} item(s).")
        else:
            print(f"\n{len(items)} item(s) would be updated. Re-run with --apply to write.")
    finally:
        db.close()


if __name__ == "__main__":
    main()
