from typing import List
from ..models.inspection import InspectionItem, ItemResult
from ..models.checklist import ChecklistItem


def calculate_compliance_score(items: List[InspectionItem], checklist_items: List[ChecklistItem]) -> dict:
    """Returns compliance_score (0-100) and risk_level."""
    item_map = {ci.id: ci for ci in checklist_items}

    total = 0
    passed = 0
    failed_critical = False

    for item in items:
        ci = item_map.get(item.checklist_item_id)
        if not ci:
            continue
        if item.result == ItemResult.na:
            continue
        total += 1
        if item.result == ItemResult.pass_:
            passed += 1
        elif item.result == ItemResult.fail and ci.is_critical:
            failed_critical = True

    score = (passed / total * 100) if total > 0 else 0

    if failed_critical or score < 60:
        risk = "critical"
    elif score < 75:
        risk = "high"
    elif score < 85:
        risk = "medium"
    else:
        risk = "low"

    return {"score": round(score, 1), "risk_level": risk}
