import os
from contextlib import asynccontextmanager
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import JSONResponse

from .database import engine, Base
from .config import settings
from .routers import (auth, users, clinics, checklists, inspections, audits,
                       certifications, corrective_actions, reports,
                       notifications, announcements, settings as settings_router)
from .routers import roles as roles_router
from .routers import tenants as tenants_router
from .routers import superadmin as superadmin_router


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
    _seed_default_tenant()
    _seed_admin()
    _seed_roles()
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
    ]
    for stmt in stmts:
        with engine.connect() as conn:
            try:
                conn.execute(text(stmt))
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

if os.path.exists(settings.upload_dir):
    app.mount("/uploads", StaticFiles(directory=settings.upload_dir), name="uploads")


@app.get("/health")
def health():
    return {"status": "ok"}


@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    return JSONResponse(status_code=500, content={"detail": "Internal server error"})
