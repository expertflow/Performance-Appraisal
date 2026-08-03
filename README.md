# ExpertFlow HR Suite

A full-stack HR & Project Management web application built with Angular 22 (Angular 19+ API), Node.js/Express, and PostgreSQL. Employees, projects, and time entries sync bidirectionally with Directus ERP at `bs4.expertflow.com`.

---

## Project Structure

```
Performance-Appraisal/
├── hr-suite/          # Angular 22 frontend
├── backend/           # Node.js/Express API
├── docker-compose.yml          # Local development
├── docker-compose.prod.yml     # Production
├── .env.example                # Environment variable template
└── ui-prototype/               # HTML/CSS prototype (reference)
```

---

## Quick Start (Local)

### Prerequisites
- Node.js 22+
- PostgreSQL 16+
- Docker & Docker Compose (optional)

### Option A — Docker (recommended)

```bash
# 1. Copy and fill in environment variables
cp .env.example .env
# Edit .env — set DIRECTUS_TOKEN

# 2. Start all services
docker-compose up --build

# 3. Run database migrations (first time only)
docker exec hr_suite_backend node src/db/migrate.js
```

- Frontend: http://localhost:4200
- Backend API: http://localhost:3000
- Health check: http://localhost:3000/health

### Option B — Manual

```bash
# 1. Start PostgreSQL locally, then:

# Backend
cd backend
cp .env.example .env   # fill in values
npm install
node src/db/migrate.js  # run migrations
npm run dev             # starts on :3000

# Frontend (new terminal)
cd hr-suite
npm install
ng serve               # starts on :4200
```

---

## Production Deployment

```bash
# Set all env vars in .env.prod or as system environment variables
docker-compose -f docker-compose.prod.yml up -d --build

# Run migrations
docker exec hr_suite_backend_prod node src/db/migrate.js
```

---

## Environment Variables

| Variable | Description | Default |
|---|---|---|
| `DB_HOST` | PostgreSQL host | `localhost` |
| `DB_PORT` | PostgreSQL port | `5432` |
| `DB_NAME` | Database name | `hr_suite` |
| `DB_USER` | DB username | `hr_suite_user` |
| `DB_PASSWORD` | DB password | `changeme` |
| `DIRECTUS_URL` | Directus base URL | `https://bs4.expertflow.com` |
| `DIRECTUS_TOKEN` | Directus static token | *(required)* |
| `APP_URL` | Frontend URL (for otrs_project_ref links) | `http://localhost:4200` |
| `PORT` | Backend port | `3000` |
| `CORS_ORIGIN` | Allowed CORS origin | `http://localhost:4200` |

---

## API Endpoints

| Method | Path | Description |
|---|---|---|
| GET | `/api/v1/projects` | List all projects |
| GET | `/api/v1/tasks?project_id=` | List tasks (with subtasks) |
| GET | `/api/v1/tasks/:id/subtasks` | List subtasks for a task |
| GET | `/api/v1/employees?search=` | List employees (from snapshot/Directus) |
| POST | `/api/v1/employees/sync` | Force refresh employees from Directus |
| GET | `/api/v1/time-entries` | List time entries |
| POST | `/api/v1/time-entries` | Create time entry |
| PATCH | `/api/v1/time-entries/:id` | Update time entry |
| DELETE | `/api/v1/time-entries/:id` | Delete draft time entry |
| GET | `/api/v1/sync/status` | Directus sync status |
| POST | `/api/v1/sync/trigger` | Trigger manual sync |

---

## Directus Sync

**Bidirectional sync runs daily at 00:00 (Asia/Karachi timezone).**

- **App → Directus**: Pushes all `pending` time entries. Populates `otrs_project_ref` field with a link back to the time entry in this app.
- **Directus → App**: Pulls time entries updated since last sync. Upserts into local DB by `directus_id`.

**Synced fields**: `employee`, `project`, `description`, `start_datetime`, `end_datetime`, `hours_worked`, `otrs_project_ref` (outbound only).

Manual sync: `POST /api/v1/sync/trigger`

---

## Time Entry Form

The **New Time Entry** form on the Timesheet page features:
- **Project** dropdown (from backend/Directus)
- **Task** dropdown — filtered by selected project
- **Subtask** dropdown — filtered by selected project + task
- **Employee** dropdown — from Directus employee snapshot
- **Start DateTime** + **End DateTime** pickers
- **Hours Worked** — auto-calculated from start/end, manually overridable
- Sync status badge per entry (pending / synced / failed)

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | Angular 22 (standalone components, signals) |
| Styling | SCSS with CSS custom properties |
| Backend | Node.js 22 + Express 4 |
| Database | PostgreSQL 16 |
| ORM | Raw SQL via `pg` |
| Sync | `node-cron` + `axios` |
| Container | Docker + nginx |
| ERP | Directus at `bs4.expertflow.com` |
