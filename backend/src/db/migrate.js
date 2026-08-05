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
  manager_id    TEXT,
  avatar_url    TEXT,
  synced_at     TIMESTAMPTZ DEFAULT NOW(),
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);
-- Add columns for exact Directus Employee fields (idempotent)
ALTER TABLE project.employee_snapshot ADD COLUMN IF NOT EXISTS manager_id         TEXT;
ALTER TABLE project.employee_snapshot ADD COLUMN IF NOT EXISTS status             TEXT;
ALTER TABLE project.employee_snapshot ADD COLUMN IF NOT EXISTS region_code        TEXT;
ALTER TABLE project.employee_snapshot ADD COLUMN IF NOT EXISTS default_project_id TEXT;
ALTER TABLE project.employee_snapshot ADD COLUMN IF NOT EXISTS mobile_number      TEXT;
ALTER TABLE project.employee_snapshot ADD COLUMN IF NOT EXISTS phone_no           TEXT;
ALTER TABLE project.employee_snapshot ADD COLUMN IF NOT EXISTS employ_start_date  TEXT;
ALTER TABLE project.employee_snapshot ADD COLUMN IF NOT EXISTS department         TEXT;
ALTER TABLE project.employee_snapshot ADD COLUMN IF NOT EXISTS designation        TEXT;
ALTER TABLE project.employee_snapshot ADD COLUMN IF NOT EXISTS seniority          TEXT;
ALTER TABLE project.employee_snapshot ADD COLUMN IF NOT EXISTS country            TEXT;
ALTER TABLE project.employee_snapshot ADD COLUMN IF NOT EXISTS legal_entity_id    TEXT;
-- Legacy columns kept for backward compatibility
ALTER TABLE project.employee_snapshot ADD COLUMN IF NOT EXISTS phone              TEXT;
ALTER TABLE project.employee_snapshot ADD COLUMN IF NOT EXISTS mobile             TEXT;
ALTER TABLE project.employee_snapshot ADD COLUMN IF NOT EXISTS hire_date          DATE;
ALTER TABLE project.employee_snapshot ADD COLUMN IF NOT EXISTS emp_status         TEXT;
ALTER TABLE project.employee_snapshot ADD COLUMN IF NOT EXISTS gender             TEXT;
ALTER TABLE project.employee_snapshot ADD COLUMN IF NOT EXISTS nationality        TEXT;
ALTER TABLE project.employee_snapshot ADD COLUMN IF NOT EXISTS address            TEXT;
ALTER TABLE project.employee_snapshot ADD COLUMN IF NOT EXISTS city               TEXT;
ALTER TABLE project.employee_snapshot ADD COLUMN IF NOT EXISTS directus_id        TEXT;
ALTER TABLE project.employee_snapshot ADD COLUMN IF NOT EXISTS avatar_url         TEXT;

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
  bs4_project_id  TEXT UNIQUE,
  client_id       TEXT,
  legal_entity_id TEXT,
  cost_center_id  TEXT,
  created_by      TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);
-- Add UNIQUE constraint on bs4_project_id for existing deployments (idempotent)
ALTER TABLE project.project ADD COLUMN IF NOT EXISTS bs4_project_id TEXT;
-- Add description column for existing deployments (idempotent)
ALTER TABLE project.project ADD COLUMN IF NOT EXISTS description TEXT;
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'project_project_bs4_project_id_key'
      AND conrelid = 'project.project'::regclass
  ) THEN
    ALTER TABLE project.project ADD CONSTRAINT project_project_bs4_project_id_key UNIQUE (bs4_project_id);
  END IF;
END $$;

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
-- task_id is nullable — employees can log time against a project without a task
ALTER TABLE project.time_entry ALTER COLUMN task_id DROP NOT NULL;
CREATE TABLE IF NOT EXISTS project.time_entry (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id               UUID REFERENCES project.task(id),
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
-- ── Recruitment schema ────────────────────────────────────────────────────────
CREATE SCHEMA IF NOT EXISTS recruitment;

-- ── Job postings ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS recruitment.job_posting (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title        TEXT NOT NULL,
  department   TEXT NOT NULL,
  location     TEXT NOT NULL,
  type         TEXT NOT NULL,
  status       TEXT NOT NULL DEFAULT 'Open',
  description  TEXT DEFAULT '',
  requirements JSONB DEFAULT '[]',
  posted_date  DATE DEFAULT CURRENT_DATE,
  deadline     DATE,
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  updated_at   TIMESTAMPTZ DEFAULT NOW()
);

-- ── Job applications ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS recruitment.job_application (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id            UUID NOT NULL REFERENCES recruitment.job_posting(id) ON DELETE CASCADE,
  job_title         TEXT NOT NULL,
  candidate_id      TEXT NOT NULL,
  candidate_name    TEXT NOT NULL,
  candidate_email   TEXT NOT NULL,
  candidate_phone   TEXT DEFAULT '',
  candidate_address TEXT DEFAULT '',
  cover_letter      TEXT NOT NULL,
  resume_link       TEXT NOT NULL,
  resume_file_name  TEXT DEFAULT '',
  linkedin_url      TEXT DEFAULT '',
  github_url        TEXT DEFAULT '',
  status            TEXT NOT NULL DEFAULT 'Submitted',
  applied_date      DATE DEFAULT CURRENT_DATE,
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  updated_at        TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ja_job       ON recruitment.job_application(job_id);
CREATE INDEX IF NOT EXISTS idx_ja_candidate ON recruitment.job_application(candidate_id);

-- ── App users (local accounts for HR suite) ───────────────────────────────────
CREATE SCHEMA IF NOT EXISTS auth_local;

CREATE TABLE IF NOT EXISTS auth_local.account (
  id           TEXT PRIMARY KEY,
  email        TEXT NOT NULL UNIQUE,
  password     TEXT NOT NULL,
  token        TEXT NOT NULL,
  role         TEXT NOT NULL DEFAULT 'Candidate',
  name         TEXT NOT NULL,
  phone        TEXT DEFAULT '',
  address      TEXT DEFAULT '',
  employee_id  TEXT DEFAULT '',
  manager_id   TEXT DEFAULT '',
  avatar_url   TEXT DEFAULT '',
  status       TEXT NOT NULL DEFAULT 'Active',
  department   TEXT DEFAULT '',
  designation  TEXT DEFAULT '',
  last_login   TIMESTAMPTZ,
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  updated_at   TIMESTAMPTZ DEFAULT NOW()
);

-- Seed default admin account (password: 12345)
INSERT INTO auth_local.account (id, email, password, token, role, name, employee_id, status, department, designation)
VALUES (
  'u-zaeem',
  'zaeem.ahmad@expertflow.com',
  '12345',
  'local-token-appadmin',
  'AppAdmin',
  'Zaeem Ahmad',
  'emp-zaeem',
  'Active',
  'Engineering',
  'Senior Software Engineer'
) ON CONFLICT (email) DO NOTHING;

-- Seed default HR account
INSERT INTO auth_local.account (id, email, password, token, role, name, employee_id, status, department, designation)
VALUES (
  'u-sara',
  'sara.ahmed@expertflow.com',
  '12345',
  'local-token-hr',
  'HR',
  'Sara Ahmed',
  'emp-002',
  'Active',
  'Human Resources',
  'HR Manager'
) ON CONFLICT (email) DO NOTHING;

-- Seed default Manager account
INSERT INTO auth_local.account (id, email, password, token, role, name, employee_id, status, department, designation)
VALUES (
  'u-ali',
  'ali.hassan@expertflow.com',
  '12345',
  'local-token-manager',
  'Manager',
  'Ali Hassan',
  'emp-003',
  'Active',
  'Engineering',
  'Engineering Manager'
) ON CONFLICT (email) DO NOTHING;

-- Seed default Employee account
INSERT INTO auth_local.account (id, email, password, token, role, name, employee_id, status, department, designation)
VALUES (
  'u-fatima',
  'fatima.khan@expertflow.com',
  '12345',
  'local-token-employee',
  'Employee',
  'Fatima Khan',
  'emp-001',
  'Active',
  'Engineering',
  'Software Engineer'
) ON CONFLICT (email) DO NOTHING;

-- Seed job postings
INSERT INTO recruitment.job_posting (id, title, department, location, type, status, description, requirements, posted_date, deadline)
VALUES
  (gen_random_uuid(), 'Senior Software Engineer', 'Engineering', 'Lahore, Pakistan (Hybrid)', 'Full-time', 'Open',
   'We are looking for a Senior Software Engineer to join our Engineering team.',
   '["5+ years of software development experience","Proficiency in Angular, TypeScript, and Node.js","Experience with cloud platforms (GCP/AWS)","Strong understanding of REST APIs and microservices","Excellent communication skills"]',
   '2026-07-20', '2026-08-31'),
  (gen_random_uuid(), 'HR Business Partner', 'Human Resources', 'Lahore, Pakistan (On-site)', 'Full-time', 'Open',
   'Join our HR team as an HR Business Partner.',
   '["3+ years of HR experience","Knowledge of Pakistani labour law","Experience with HRIS systems","Strong interpersonal and negotiation skills","MBA or equivalent in HR preferred"]',
   '2026-07-25', '2026-08-25'),
  (gen_random_uuid(), 'Product Designer (UX/UI)', 'Product', 'Remote (Pakistan)', 'Full-time', 'Open',
   'We are seeking a talented Product Designer to craft intuitive user experiences.',
   '["3+ years of UX/UI design experience","Proficiency in Figma","Strong portfolio demonstrating end-to-end design process","Experience with design systems","Familiarity with front-end development is a plus"]',
   '2026-07-28', '2026-09-05'),
  (gen_random_uuid(), 'Marketing Specialist', 'Marketing', 'Lahore, Pakistan (Hybrid)', 'Full-time', 'Open',
   'ExpertFlow is looking for a creative and data-driven Marketing Specialist.',
   '["2+ years of digital marketing experience","Experience with SEO, SEM, and social media marketing","Proficiency in Google Analytics","Strong copywriting and content creation skills","Bachelor degree in Marketing or related field"]',
   '2026-08-01', '2026-09-01'),
  (gen_random_uuid(), 'Software Engineering Intern', 'Engineering', 'Lahore, Pakistan (On-site)', 'Internship', 'Open',
   'Gain hands-on experience working alongside our engineering team on real projects.',
   '["Currently enrolled in a CS or related degree program","Basic knowledge of JavaScript/TypeScript","Eagerness to learn and collaborate","Available for 3-6 months"]',
   '2026-08-02', '2026-08-20')
ON CONFLICT DO NOTHING;
`;

// ── Job Requisitions ──────────────────────────────────────────────────────────
const reqSchema = `
CREATE TABLE IF NOT EXISTS recruitment.job_requisition (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  req_number      TEXT        NOT NULL UNIQUE,
  title           TEXT        NOT NULL,
  department      TEXT        NOT NULL,
  location        TEXT        NOT NULL DEFAULT '',
  type            TEXT        NOT NULL DEFAULT 'Full-time',
  headcount       INT         NOT NULL DEFAULT 1,
  priority        TEXT        NOT NULL DEFAULT 'Normal',
  status          TEXT        NOT NULL DEFAULT 'Pending Approval',
  hiring_manager  TEXT        NOT NULL DEFAULT '',
  approval_hod    BOOLEAN     NOT NULL DEFAULT FALSE,
  approval_hr     BOOLEAN     NOT NULL DEFAULT FALSE,
  approval_cfo    BOOLEAN     NOT NULL DEFAULT FALSE,
  posted_date     DATE        DEFAULT CURRENT_DATE,
  notes           TEXT        DEFAULT '',
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO recruitment.job_requisition
  (req_number, title, department, location, type, headcount, priority, status,
   hiring_manager, approval_hod, approval_hr, approval_cfo, posted_date)
VALUES
  ('REQ-2025-041','Senior Angular Developer','Engineering','Lahore · Hybrid','Full-time',2,'Urgent','Open',
   'Fatima Malik',TRUE,TRUE,FALSE,'2025-07-28'),
  ('REQ-2025-040','Product Manager','Product','Karachi · Remote','Full-time',1,'High','Open',
   'Omar Sheikh',TRUE,TRUE,TRUE,'2025-07-22'),
  ('REQ-2025-039','UX Designer','Design','Islamabad · On-site','Full-time',1,'Normal','Pending Approval',
   'Zara Hussain',TRUE,FALSE,FALSE,'2025-07-18'),
  ('REQ-2025-038','DevOps Engineer','Infrastructure','Lahore · Hybrid','Full-time',1,'High','Open',
   'Ahmed Raza',TRUE,TRUE,TRUE,'2025-07-15'),
  ('REQ-2025-037','Business Analyst','Operations','Karachi · Hybrid','Contract',2,'Normal','On Hold',
   'Khalid Mahmood',TRUE,TRUE,FALSE,'2025-07-10')
ON CONFLICT DO NOTHING;
`;

async function migrate() {
  const client = await pool.connect();
  try {
    console.log('Running migrations…');
    await client.query(schema);
    await client.query(reqSchema);
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
