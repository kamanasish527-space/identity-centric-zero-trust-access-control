# AI-Based Identity-Centric Zero Trust Access Control Platform

Production-oriented full-stack Zero Trust SaaS-style platform using FastAPI, PostgreSQL/SQLite, React, and Docker.

## What This Delivers

- Identity and access lifecycle: registration, login, JWT auth, refresh tokens, RBAC (`user`, `analyst`, `admin`)
- Security hardening: Argon2 hashing, CSRF protection, secure headers, brute-force lockout, rate limiting
- AI behavior engine: per-user baseline learning, deviation scoring, weighted risk model, threat classification
- Adaptive policy engine:
  - `low` -> allow
  - `medium` -> step-up OTP simulation
  - `high` -> deny
  - `critical` -> lock account + alert
- Continuous session monitoring: periodic heartbeat risk re-evaluation and session termination on escalation
- MITRE ATT&CK mapping: `T1078`, `T1021`, `T1046`, `T1071`, `T1110`, `T1566`
- SOC-style dashboard: risk charts, logs, threat intel, session monitor, admin controls, settings tuning
- Structured audit logging in DB and CSV export
- Dockerized deployment with PostgreSQL

## Tech Stack

- Backend: Python 3, FastAPI, SQLAlchemy, Alembic, SlowAPI
- Database: PostgreSQL (primary), SQLite fallback
- Frontend: React + Vite + Recharts
- Auth: JWT access + refresh, CSRF token checks for state-changing routes
- DevOps: Dockerfile(s), Docker Compose, env-driven configuration

## Repository Structure

```text
backend/
  app/
    api/
    core/
    db/
    models/
    schemas/
    services/
    main.py
  alembic/
  requirements.txt
  Dockerfile
frontend/
  src/
    api/
    components/
    context/
    hooks/
    layout/
    pages/
    styles/
  Dockerfile
  nginx.conf
docs/
  API.md
.env.example
docker-compose.yml
```

## Security Architecture Notes

- Passwords are hashed with Argon2 (`passlib[argon2]`)
- Access and refresh JWT tokens are separated by secret key and token type
- CSRF protection uses double-submit behavior (`csrf_token` cookie + `X-CSRF-Token` header + JWT claim match)
- Repeated failed logins trigger account locking
- Session heartbeat continuously re-evaluates trust and can terminate sessions
- API responses use structured JSON errors
- Security headers middleware sets HSTS, CSP, frame restrictions, and MIME protections
- Audit events are persisted to `audit_logs` and streamed over websocket for live UI updates

## Local Development

### 1) Backend

```bash
cd backend
python -m venv .venv
# Windows
.\.venv\Scripts\activate
# Linux/macOS
# source .venv/bin/activate

pip install -r requirements.txt
copy ..\.env.example .env

# SQLite quick start
alembic upgrade head
uvicorn app.main:app --reload --port 8000
```

API docs: `http://localhost:8000/docs`

### 2) Frontend

```bash
cd frontend
npm install
copy .env.example .env
npm run dev
```

Frontend runs at `http://localhost:5173`.

## Docker Deployment

```bash
copy .env.example .env
docker compose up --build
```

Services:
- Frontend: `http://localhost:3000`
- Backend API: `http://localhost:8000`
- PostgreSQL: internal `db:5432`

## Bootstrap Admin (Optional)

To auto-create an admin on startup, set in `.env`:

```env
BOOTSTRAP_ADMIN_USERNAME=ztadmin
BOOTSTRAP_ADMIN_EMAIL=admin@company.com
BOOTSTRAP_ADMIN_PASSWORD=<set-your-own-password>
```

If left empty, no default admin credentials are created.

## Migrations

```bash
cd backend
alembic upgrade head
# create new migration
alembic revision --autogenerate -m "describe_change"
```

## Key Behavior Flow

1. User login captures identity signals (IP, device fingerprint, location, timing, frequency).
2. Risk engine compares against baseline and computes weighted score.
3. Policy engine chooses allow/step-up/deny/lock.
4. Baseline updates on successful authentications.
5. Session heartbeat re-checks trust continuously and can terminate risky sessions.
6. Audit trail records every auth and policy decision with optional MITRE mapping.

## API Reference

See `docs/API.md`.
