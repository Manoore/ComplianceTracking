"""
Shared clinic-visibility scoping for the review hierarchy: MA -> Clinic Lead
(single clinic) -> Regional Manager (a region's worth of clinics) -> Director
of Operations / Executive / Admin (everything in the tenant).

A custom role (Clinic Lead, Regional Manager, Director of Operations) always
reports its base `role` as team_member, so callers must use this helper
instead of checking `user.role` alone -- that's exactly the bug this file
exists to stop from being repeated in every router that needs clinic scoping.
"""
from typing import Optional
from sqlalchemy.orm import Session
from ..models.clinic import Clinic
from ..models.user import User, UserRole


def scoped_clinic_ids(db: Session, user: User) -> tuple:
    """Clinic IDs `user` should see (or None for "every clinic in their
    tenant"), plus a human-readable label for what that scope is."""
    custom_role = (user.custom_role or "").strip().lower()
    if user.role == UserRole.admin or custom_role in ("director_of_operations", "executive"):
        return None, "All Regions"
    q = db.query(Clinic.id).filter(Clinic.tenant_id == user.tenant_id)
    if custom_role == "regional_manager":
        if not user.managed_region:
            # Misconfigured account -- no region assigned yet. Scope to nothing
            # rather than falling through to "every clinic in the tenant": a
            # Regional Manager missing this field must never silently see
            # everyone else's clinics just because their own setup is incomplete.
            return [], "No region assigned"
        return [i for (i,) in q.filter(Clinic.region == user.managed_region).all()], f"Region: {user.managed_region}"
    if custom_role == "clinic_lead" or user.role == UserRole.manager:
        return [i for (i,) in q.filter(Clinic.manager_id == user.id).all()], "Your Clinics"
    return None, "All Regions"
