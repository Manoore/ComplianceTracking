# Compliance & Audit Management

A self-hosted web application for managing medical clinic compliance inspections, auditor reviews, and team compliance certifications.

## Quick Start

### With Docker Compose (recommended)

```bash
# 1. Copy and configure environment
cp .env.example .env
# Edit .env — at minimum set SECRET_KEY

# 2. Start the application
docker compose up -d

# 3. Open in browser
open http://localhost:3000
```

Default login: `admin@compliance.local` / `admin123`

**Change the default password immediately after first login.**

---

## Features

### 1. Clinic Inspection Checklists
- Admin registers multiple clinic locations with assigned managers
- Managers conduct digital inspections on mobile or desktop
- Each checklist item marked pass / fail / N/A with optional notes and photo upload
- GPS check-in/check-out captured automatically
- Auto-calculated compliance score (0–100%) and risk level (low / medium / high / critical)
- Failed items automatically generate corrective action tasks
- Works offline — sync when reconnected

### 2. Auditor Workflow
- Auditors review submitted inspections and approve or reject
- Immutable audit trail logging every action (who, what, when, IP)
- Auto-calculated risk/compliance score per clinic
- One-click PDF audit reports with findings and evidence
- Recurring audit cycles with auditor assignments per clinic

### 3. Team Compliance Certification
- Admin creates compliance courses with pass/fail threshold
- Generate unique shareable links (no app account required for team members)
- Team members complete certification in browser
- Real-time dashboard: not started / in progress / completed / overdue
- Email reminders for incomplete or expiring certifications
- Auto-generated PDF certificates with QR verification codes
- Expiry tracking and renewal flagging

### 4. Reporting & Analytics
- Dashboard: overall compliance rates, overdue items, trend charts
- Clinic-by-clinic score comparison with risk colour coding
- Export to CSV (inspections, corrective actions, certifications)
- 6-month compliance trend line chart

### 5. Corrective Actions
- Failed checklist items auto-create tasks with deadlines
- Assign to responsible person with email notification
- Upload evidence (photos/docs) proving resolution
- Auditor / admin verification step
- Flags items requiring re-inspection

---

## Roles & Permissions

| Feature | Admin | Manager | Auditor | Team Member |
|---------|-------|---------|---------|-------------|
| Manage clinics/users/templates | ✓ | | | |
| Conduct inspections | ✓ | ✓ | | |
| Review & approve inspections | ✓ | | ✓ | |
| Generate audit reports | ✓ | | ✓ | |
| Manage courses & certification links | ✓ | | | |
| View certifications dashboard | ✓ | ✓ | ✓ | |
| Complete assigned certifications | ✓ | ✓ | ✓ | ✓ |
| Manage corrective actions | ✓ | ✓ | ✓ | |
| Resolve own assigned actions | ✓ | ✓ | ✓ | ✓ |
| View audit trail | ✓ | | ✓ | |

---

## Configuration

All settings live in `.env`:

| Variable | Description | Default |
|----------|-------------|---------|
| `SECRET_KEY` | JWT signing key — **change in production** | `changeme…` |
| `DATABASE_URL` | SQLite or PostgreSQL URL | SQLite |
| `SMTP_HOST` | SMTP server for email reminders | (disabled) |
| `FRONTEND_URL` | Public URL for certificate links | `http://localhost:3000` |
| `SSO_ENABLED` | Enable OIDC/OAuth2 SSO | `false` |
| `SSO_DISCOVERY_URL` | OIDC discovery endpoint | — |

---

## Development (without Docker)

### Backend
```bash
cd backend
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload
# API available at http://localhost:8000
# Swagger docs at http://localhost:8000/docs
```

### Frontend
```bash
cd frontend
npm install
npm run dev
# App available at http://localhost:5173
```

---

## Architecture

```
backend/
  app/
    models/       SQLAlchemy ORM models
    routers/      FastAPI route handlers
    services/     auth · pdf · email · scoring
    utils/        audit trail helper
  data/           SQLite database (persistent volume)
  uploads/        Uploaded files (persistent volume)

frontend/
  src/
    pages/        One file per screen
    components/   Reusable UI (sidebar, badges, score ring)
    hooks/        Auth context
    services/     Axios API client
    types/        TypeScript type definitions
```

**Stack:** FastAPI · SQLAlchemy · SQLite/PostgreSQL · React 18 · TypeScript · Tailwind CSS · Recharts · Docker Compose

---

## Security Notes

- All API endpoints require JWT authentication except `/certify/:token` (public certification links) and `/verify/:certId` (certificate verification)
- Passwords hashed with bcrypt
- Data encrypted in transit via TLS (configure in your reverse proxy)
- SQLite WAL mode enabled for concurrent access
- Audit trail is append-only (no delete endpoint)
- File uploads validated for type and size (default 20 MB max)
