"""
Run once to create the demo account used by App Store / Play Store reviewers.

Usage:
    cd backend
    python seed_demo.py
"""
import os
import sys

sys.path.insert(0, os.path.dirname(__file__))

from app.database import SessionLocal
from app.models.user import User, UserRole
from app.models.tenant import Tenant
from app.services.auth import hash_password
from datetime import datetime, timedelta

DEMO_EMAIL = "demo@complinow.com"
DEMO_PASSWORD = "Demo2024!"
DEMO_ORG = "Demo Clinic"

db = SessionLocal()

try:
    existing = db.query(User).filter(User.email == DEMO_EMAIL).first()
    if existing:
        print(f"Demo account already exists (id={existing.id}). Nothing to do.")
        sys.exit(0)

    # Create demo tenant
    tenant = Tenant(
        name=DEMO_ORG,
        slug="demo-clinic",
        plan="pro",
        trial_ends_at=datetime.utcnow() + timedelta(days=3650),  # 10 years
    )
    db.add(tenant)
    db.flush()

    # Create demo admin user
    user = User(
        tenant_id=tenant.id,
        email=DEMO_EMAIL,
        full_name="Demo Admin",
        hashed_password=hash_password(DEMO_PASSWORD),
        role=UserRole.admin,
        is_active=True,
    )
    db.add(user)
    db.commit()
    print(f"✅ Demo account created: {DEMO_EMAIL} / {DEMO_PASSWORD} (org: {DEMO_ORG})")

finally:
    db.close()
