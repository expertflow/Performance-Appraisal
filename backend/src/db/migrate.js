'use strict';
require('dotenv').config();
const pool = require('./pool');

const schema = `
-- ── Schema ────────────────────────────────────────────────────────────────
CREATE SCHEMA IF NOT EXISTS project;

-- ── Employee snapshot (cache from Directus/BS4) ───────────────────────────
CREATE TABLE IF NOT EXISTS project.employee_snapshot (
  id            TEXT PRIMARY KEY,
  first_name    TEXT NOT NULL,
  last_name     TEXT NOT NULL,
  email         TEXT,
  department    TEXT,
  job_title     TEXT,
  avatar_url    TEXT,
  synced_at     TIMESTAMPTZ DEFAULT NOW(),
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

-- ── Projects ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS project.project (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name            TEXT NOT NULL,
  type            TEXT NOT NULL CHECK (type IN ('client','internal','operational')),
  status          TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','on_hold','completed','cancelled')),
  health_status   TEXT CHECK (health_status IN ('on_track','at_risk','off_track')),
  start_date      DATE,
  end_date        DATE,
  budget_hours    NUMERIC(10,2),
  budget_amount   NUMERIC(14,2),
  bs4_project_id  TEXT,
  client_id       TEXT,
  legal_entity_id TEXT,
  cost_center_id  TEXT,
  created_by      TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ── Tasks ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS project.task (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id      UUID NOT NULL REFERENCES project.project(id) ON DELETE CASCADE,
  parent_task_id  UUID REFERENCES project.task(id) ON DELETE CASCADE,
  title           TEXT NOT NULL,
  description     TEXT,
  priority        TEXT NOT NULL DEFAULT 'medium' CHECK (priority IN ('critical','high','medium','low')),
  status          TEXT NOT NULL DEFAULT 'todo' CHECK (status IN ('todo','in_progress','in_review','blocked','done')),
  due_date        DATE,
  estimated_hours NUMERIC(8,2),
  actual_hours    NUMERIC(8,2),
  tags            JSONB DEFAULT '[]',
  created_by      TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_task_project ON project.task(project_id);
CREATE INDEX IF NOT EXISTS idx_task_parent  ON project.task(parent_task_id);

-- ── Task assignees ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS project.task_assignee (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id     UUID NOT NULL REFERENCES project.task(id) ON DELETE CASCADE,
  employee_id TEXT NOT NULL,
  assigned_at TIMESTAMPTZ DEFAULT NOW(),
  assigned_by TEXT,
  UNIQUE(task_id, employee_id)
);

-- ── Time entries ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS project.time_entry (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id               UUID NOT NULL REFERENCES project.task(id),
  project_id            UUID NOT NULL REFERENCES project.project(id),
  subtask_id            UUID REFERENCES project.task(id),
  employee_id           TEXT NOT NULL,
  description           TEXT DEFAULT '',
  start_datetime        TIMESTAMPTZ NOT NULL,
  end_datetime          TIMESTAMPTZ NOT NULL,
  hours_worked          NUMERIC(6,2) NOT NULL CHECK (hours_worked > 0),
  is_billable           BOOLEAN DEFAULT FALSE,
  status                TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','submitted','approved','rejected')),
  approved_by           TEXT,
  approved_at           TIMESTAMPTZ,
  idempotency_key       UUID UNIQUE DEFAULT gen_random_uuid(),
  reversal_of_id        UUID REFERENCES project.time_entry(id),
  directus_id           TEXT,
  directus_sync_status  TEXT NOT NULL DEFAULT 'pending' CHECK (directus_sync_status IN ('pending','synced','failed','dead_letter')),
  directus_sync_at      TIMESTAMPTZ,
  created_at            TIMESTAMPTZ DEFAULT NOW(),
  updated_at            TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_te_project    ON project.time_entry(project_id);
CREATE INDEX IF NOT EXISTS idx_te_employee   ON project.time_entry(employee_id);
CREATE INDEX IF NOT EXISTS idx_te_sync       ON project.time_entry(directus_sync_status);
CREATE INDEX IF NOT EXISTS idx_te_created    ON project.time_entry(created_at DESC);

-- ── Directus sync log ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS project.directus_sync_log (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  time_entry_id   UUID REFERENCES project.time_entry(id),
  idempotency_key UUID,
  attempt_count   INT DEFAULT 1,
  last_attempt_at TIMESTAMPTZ DEFAULT NOW(),
  status          TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','synced','failed','dead_letter')),
  error_message   TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);
`;

async function migrate() {
  const client = await pool.connect();
  try {
    console.log('Running migrations…');
    await client.query(schema);
    console.log('✅ Migrations complete.');
  } catch (err) {
    console.error('❌ Migration failed:', err.message);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

migrate();
