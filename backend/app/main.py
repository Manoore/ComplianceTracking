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


@asynccontextmanager
async def lifespan(app: FastAPI):
    Base.metadata.create_all(bind=engine)
    os.makedirs(settings.upload_dir, exist_ok=True)
    os.makedirs(os.path.join(settings.upload_dir, "inspections"), exist_ok=True)
    os.makedirs(os.path.join(settings.upload_dir, "evidence"), exist_ok=True)
    os.makedirs(os.path.join(settings.upload_dir, "certificates"), exist_ok=True)
    os.makedirs(os.path.join(settings.upload_dir, "reports"), exist_ok=True)
    os.makedirs(os.path.join(settings.upload_dir, "branding"), exist_ok=True)
    _seed_admin()
    yield


def _seed_admin():
    from .database import SessionLocal
    from .models.user import User, UserRole
    from .services.auth import hash_password
    db = SessionLocal()
    try:
        if db.query(User).count() == 0:
            admin = User(
                email="admin@compliance.local",
                full_name="System Administrator",
                hashed_password=hash_password("admin123"),
                role=UserRole.admin,
            )
            db.add(admin)
            db.commit()
    finally:
        db.close()


app = FastAPI(
    title="Compliance & Audit Management",
    description="Medical clinic compliance inspections, auditor reviews, and team certifications.",
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

if os.path.exists(settings.upload_dir):
    app.mount("/uploads", StaticFiles(directory=settings.upload_dir), name="uploads")


@app.get("/health")
def health():
    return {"status": "ok"}


@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    return JSONResponse(status_code=500, content={"detail": "Internal server error"})
