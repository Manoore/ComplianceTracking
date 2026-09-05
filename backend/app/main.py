import os
from contextlib import asynccontextmanager
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import JSONResponse, HTMLResponse

from .database import engine, Base
from .config import settings
from .models import platform_setting as _ps_model  # noqa: ensure table registered
from .models import policy as _policy_model  # noqa: ensure table registered
from .models import department as _dept_model  # noqa
from .models import credential as _cred_model  # noqa
from .models import document_hub as _dochub_model  # noqa
from .models import standard as _std_model  # noqa
from .routers import (auth, users, clinics, checklists, inspections, audits,
                       certifications, corrective_actions, reports,
                       notifications, announcements, settings as settings_router)
from .routers import roles as roles_router
from .routers import tenants as tenants_router
from .routers import superadmin as superadmin_router
from .routers import policies as policies_router
from .routers import departments as departments_router
from .routers import credentials as credentials_router
from .routers import document_hub as document_hub_router
from .routers import standards as standards_router


@asynccontextmanager
async def lifespan(app: FastAPI):
    Base.metadata.create_all(bind=engine)
    _apply_migrations()
    os.makedirs(settings.upload_dir, exist_ok=True)
    os.makedirs(os.path.join(settings.upload_dir, "inspections"), exist_ok=True)
    os.makedirs(os.path.join(settings.upload_dir, "evidence"), exist_ok=True)
    os.makedirs(os.path.join(settings.upload_dir, "certificates"), exist_ok=True)
    os.makedirs(os.path.join(settings.upload_dir, "reports"), exist_ok=True)
    os.makedirs(os.path.join(settings.upload_dir, "branding"), exist_ok=True)
    os.makedirs(os.path.join(settings.upload_dir, "credentials"), exist_ok=True)
    os.makedirs(os.path.join(settings.upload_dir, "documents"), exist_ok=True)
    _seed_default_tenant()
    _seed_admin()
    _seed_roles()
    _seed_standards()
    yield


def _apply_migrations():
    from sqlalchemy import text
    stmts = [
        "ALTER TABLE users ADD COLUMN custom_role VARCHAR(50)",
        "ALTER TABLE users ADD COLUMN tenant_id INTEGER",
        "ALTER TABLE clinics ADD COLUMN tenant_id INTEGER",
        "ALTER TABLE checklist_templates ADD COLUMN tenant_id INTEGER",
        "ALTER TABLE inspections ADD COLUMN tenant_id INTEGER",
        "ALTER TABLE audit_cycles ADD COLUMN tenant_id INTEGER",
        "ALTER TABLE courses ADD COLUMN tenant_id INTEGER",
        "ALTER TABLE corrective_actions ADD COLUMN tenant_id INTEGER",
        "ALTER TABLE announcements ADD COLUMN tenant_id INTEGER",
        "ALTER TABLE roles ADD COLUMN tenant_id INTEGER",
        "ALTER TABLE org_settings ADD COLUMN tenant_id INTEGER",
        "ALTER TABLE courses ADD COLUMN target_roles JSONB",
        "ALTER TABLE inspection_items ADD COLUMN numeric_value FLOAT",
        "ALTER TABLE inspection_items ADD COLUMN passes_range BOOLEAN",
        "ALTER TABLE inspection_items ADD COLUMN document_url VARCHAR",
        "ALTER TABLE inspection_items ADD COLUMN second_signer_id INTEGER",
        "ALTER TABLE inspection_items ADD COLUMN second_signed_at TIMESTAMP",
        "ALTER TABLE inspection_items ADD COLUMN second_signature TEXT",
        "ALTER TABLE inspection_items ADD COLUMN answered_at TIMESTAMP",
        "ALTER TABLE clinics ADD COLUMN department_id INTEGER REFERENCES departments(id)",
        "ALTER TABLE checklist_items ADD COLUMN standard_tags JSONB",
    ]
    for stmt in stmts:
        with engine.connect() as conn:
            try:
                conn.execute(text(stmt))
                conn.commit()
            except Exception:
                conn.rollback()
    # Add new ItemType enum values (Postgres ALTER TYPE is idempotent via exception handling)
    new_item_types = ["numeric_range", "dual_signoff", "document_upload"]
    for val in new_item_types:
        with engine.connect() as conn:
            try:
                conn.execute(text(f"ALTER TYPE itemtype ADD VALUE '{val}'"))
                conn.commit()
            except Exception:
                conn.rollback()

    # Drop old unique constraint on roles.name if it exists (Postgres)
    with engine.connect() as conn:
        try:
            conn.execute(text("ALTER TABLE roles DROP CONSTRAINT roles_name_key"))
            conn.commit()
        except Exception:
            conn.rollback()


def _seed_default_tenant():
    from sqlalchemy import text
    from .database import SessionLocal
    from .models.tenant import Tenant
    db = SessionLocal()
    try:
        existing = db.query(Tenant).first()
        if existing:
            return existing.id
        tenant = Tenant(name="My Organization", slug="default", plan="free")
        db.add(tenant)
        db.commit()
        db.refresh(tenant)
        tid = tenant.id
        tables = ["users", "clinics", "checklist_templates", "inspections",
                  "audit_cycles", "courses", "corrective_actions", "announcements",
                  "org_settings"]
        with engine.connect() as conn:
            for table in tables:
                try:
                    conn.execute(text(f"UPDATE {table} SET tenant_id = {tid} WHERE tenant_id IS NULL"))
                    conn.commit()
                except Exception:
                    pass
        return tid
    finally:
        db.close()


def _seed_admin():
    from .database import SessionLocal
    from .models.user import User, UserRole
    from .models.tenant import Tenant
    from .services.auth import hash_password
    db = SessionLocal()
    try:
        if db.query(User).count() == 0:
            tenant = db.query(Tenant).first()
            admin = User(
                email="admin@compliance.local",
                full_name="System Administrator",
                hashed_password=hash_password("admin123"),
                role=UserRole.admin,
                tenant_id=tenant.id if tenant else None,
            )
            db.add(admin)
            db.commit()
    finally:
        db.close()


def _seed_roles():
    from .database import SessionLocal
    from .models.role import Role, RolePermission, DEFAULT_PERMISSIONS, SYSTEM_ROLES
    db = SessionLocal()
    try:
        for role_name, display_name in SYSTEM_ROLES.items():
            existing = db.query(Role).filter(
                Role.name == role_name,
                Role.tenant_id == None,  # noqa: E711
            ).first()
            if not existing:
                role = Role(name=role_name, display_name=display_name, is_system=True, tenant_id=None)
                db.add(role)
                db.flush()
                for module in DEFAULT_PERMISSIONS.get(role_name, []):
                    db.add(RolePermission(role_id=role.id, module=module))
        db.commit()
    finally:
        db.close()


def _seed_standards():
    from .database import SessionLocal
    from .models.standard import AccreditationStandard, BUILTIN_STANDARDS
    db = SessionLocal()
    try:
        for s in BUILTIN_STANDARDS:
            existing = db.query(AccreditationStandard).filter(
                AccreditationStandard.code == s["code"],
                AccreditationStandard.is_builtin == True,
            ).first()
            if not existing:
                db.add(AccreditationStandard(code=s["code"], name=s["name"], is_builtin=True, tenant_id=None))
        db.commit()
    finally:
        db.close()


app = FastAPI(
    title="CompliNow",
    description="Compliance inspections, audits, corrective actions, and certifications for any industry.",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router, prefix="/api")
app.include_router(users.router, prefix="/api")
app.include_router(clinics.router, prefix="/api")
app.include_router(checklists.router, prefix="/api")
app.include_router(inspections.router, prefix="/api")
app.include_router(audits.router, prefix="/api")
app.include_router(certifications.router, prefix="/api")
app.include_router(corrective_actions.router, prefix="/api")
app.include_router(reports.router, prefix="/api")
app.include_router(notifications.router, prefix="/api")
app.include_router(announcements.router, prefix="/api")
app.include_router(settings_router.router, prefix="/api")
app.include_router(roles_router.router, prefix="/api")
app.include_router(tenants_router.router, prefix="/api")
app.include_router(superadmin_router.router, prefix="/api")
app.include_router(policies_router.router, prefix="/api")
app.include_router(departments_router.router, prefix="/api")
app.include_router(credentials_router.router, prefix="/api")
app.include_router(document_hub_router.router, prefix="/api")
app.include_router(standards_router.router, prefix="/api")

if os.path.exists(settings.upload_dir):
    app.mount("/uploads", StaticFiles(directory=settings.upload_dir), name="uploads")


@app.get("/")
@app.get("/health")
def health():
    return {"status": "ok"}


@app.get("/privacy", response_class=HTMLResponse)
def privacy_policy():
    return """<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>CompliNow Privacy Policy</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 800px; margin: 40px auto; padding: 0 24px; color: #222; line-height: 1.7; }
    h1 { color: #1A3C74; } h2 { color: #1A3C74; margin-top: 32px; }
    p, ul { margin: 12px 0; } ul { padding-left: 24px; }
    .updated { color: #888; font-size: 14px; }
    a { color: #1A3C74; }
  </style>
</head>
<body>
  <h1>CompliNow Privacy Policy</h1>
  <p class="updated">Last updated: January 1, 2025</p>

  <h2>1. Information We Collect</h2>
  <p>CompliNow collects information necessary to provide compliance management services to healthcare organizations:</p>
  <ul>
    <li>Account information: name, email address, role within your organization</li>
    <li>Inspection data: checklist responses, photos, GPS coordinates of inspection sites</li>
    <li>Credential data: professional license numbers and expiry dates</li>
    <li>Usage data: app interactions and session timestamps for audit trail purposes</li>
  </ul>

  <h2>2. How We Use Your Information</h2>
  <ul>
    <li>Provide compliance tracking and reporting services</li>
    <li>Generate inspection reports and corrective action workflows</li>
    <li>Send compliance alerts and policy acknowledgment reminders</li>
    <li>Maintain audit logs as required by applicable regulations</li>
  </ul>

  <h2>3. HIPAA Compliance</h2>
  <p>CompliNow is designed to support HIPAA-compliant workflows. We do not store Protected Health Information (PHI) as defined by HIPAA. All data is encrypted in transit (TLS 1.2+) and at rest. We sign Business Associate Agreements (BAAs) with covered entities upon request.</p>

  <h2>4. Data Security</h2>
  <ul>
    <li>All data transmitted between the app and our servers uses HTTPS/TLS encryption</li>
    <li>Authentication tokens are stored in the device's secure keystore (iOS Keychain / Android Keystore)</li>
    <li>Sessions automatically expire after 15 minutes of inactivity</li>
    <li>No sensitive compliance data is included in device backups</li>
  </ul>

  <h2>5. Data Sharing</h2>
  <p>We do not sell your personal information. We may share data with:</p>
  <ul>
    <li>Your organization's administrators (as required to provide the service)</li>
    <li>Cloud infrastructure providers (AWS/GCP) under data processing agreements</li>
    <li>Regulatory authorities if required by law</li>
  </ul>

  <h2>6. Camera and Location</h2>
  <p>The app requests access to your camera and location only during compliance inspections to capture photo evidence and GPS-stamp inspection locations. This data is associated with inspection records in your organization's account and is not used for advertising or analytics.</p>

  <h2>7. Data Retention and Deletion</h2>
  <p>Compliance records are retained for the duration of your organization's subscription plus any legally required retention period. You may request deletion of your personal account at any time from within the app (Profile → Delete Account). Organization data deletion requests should be submitted to support@complinow.com.</p>

  <h2>8. Your Rights</h2>
  <p>Depending on your jurisdiction, you may have the right to access, correct, port, or delete your personal data. To exercise these rights, contact us at privacy@complinow.com.</p>

  <h2>9. Contact</h2>
  <p>Privacy Officer: privacy@complinow.com<br>Support: support@complinow.com<br>Website: <a href="https://complinow.com">complinow.com</a></p>

  <p><em>CompliNow is a compliance management and workflow tool. It is not a medical device and does not diagnose, treat, cure, or prevent any medical condition.</em></p>
</body>
</html>"""


@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    return JSONResponse(status_code=500, content={"detail": "Internal server error"})
