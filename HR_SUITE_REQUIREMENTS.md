# HR & Project Management Suite — Complete Requirements Document

**Version:** 1.0  
**Date:** 2026-07-30  
**Status:** Requirements Gathered — Ready for PRD  

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Technology Stack](#2-technology-stack)
3. [System Architecture](#3-system-architecture)
4. [Authentication & SSO](#4-authentication--sso)
5. [Module 1: Recruitment](#5-module-1-recruitment)
6. [Module 2: Performance Appraisal](#6-module-2-performance-appraisal)
7. [Module 3: Project & Task Management](#7-module-3-project--task-management)
8. [BS4 ERP Integration](#8-bs4-erp-integration)
9. [Notifications & Workflow Engine](#9-notifications--workflow-engine)
10. [Reporting & Analytics](#10-reporting--analytics)
11. [Project Structure](#11-project-structure)
12. [Next Steps](#12-next-steps)

---

## 1. Executive Summary

This document defines the requirements for a new **HR & Project Management Suite** consisting of three fully independent modules:

| Module | Purpose |
|---|---|
| **Recruitment** | End-to-end applicant tracking with AI-assisted screening |
| **Performance Appraisal** | 360° feedback with configurable review cycles |
| **Project & Task Management** | Multi-view project tracking with time entry sync |

### Key Principles

- Each module is **fully independent** — separate frontend, backend, and database
- All three modules share a **single SSO layer** for seamless user experience
- Integration with **BS4 ERP** is via secured REST APIs (JSON over HTTPS)
- Integration with **existing Directus ERP** for time entry sync (Project module)
- Deployed on **GCP** using existing infrastructure

---

## 2. Technology Stack

| Layer | Technology | Notes |
|---|---|---|
| **Frontend** | Angular + TypeScript + CSS | Separate Angular app per module, shared shell |
| **Backend** | Node.js + Express.js | Separate microservice per module |
| **Database** | PostgreSQL | Separate database per module |
| **API Protocol** | REST — JSON over HTTP/HTTPS | All internal and external APIs |
| **AI Provider** | Pluggable adapter | OpenAI / Google Gemini / Kimi — configurable |
| **Deployment** | GCP | Cloud Run or GKE, existing GCP infrastructure |
| **Auth** | JWT (access + refresh tokens) | Issued by central Auth Service |
| **Email** | SMTP / SendGrid | Notification service |
| **Real-time** | WebSocket / SSE | In-app notifications |

---

## 3. System Architecture

### 3.1 High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    FRONTEND — Angular + TypeScript               │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────┐  │
│  │  Recruitment │  │  Appraisal   │  │  Project/Task Mgmt   │  │
│  │     SPA      │  │     SPA      │  │         SPA          │  │
│  └──────────────┘  └──────────────┘  └──────────────────────┘  │
│                  ┌─────────────────────┐                         │
│                  │  Shared Auth Shell  │                         │
│                  │  SSO + Navigation   │                         │
│                  └─────────────────────┘                         │
└─────────────────────────────────────────────────────────────────┘
                              │ HTTPS
                    ┌─────────▼──────────┐
                    │    API Gateway     │
                    │  JWT Validation    │
                    │  Rate Limiting     │
                    │  Request Routing   │
                    └─────────┬──────────┘
                              │
        ┌─────────────────────┼─────────────────────┐
        │                     │                     │
┌───────▼──────┐   ┌──────────▼──────┐   ┌─────────▼───────┐
│ Recruitment  │   │   Appraisal     │   │  Project/Task   │
│   Service    │   │    Service      │   │    Service      │
│  :3001       │   │    :3002        │   │    :3003        │
└───────┬──────┘   └──────────┬──────┘   └─────────┬───────┘
        │                     │                     │
┌───────▼──────┐   ┌──────────▼──────┐   ┌─────────▼───────┐
│recruitment_db│   │  appraisal_db   │   │   project_db    │
│ (PostgreSQL) │   │  (PostgreSQL)   │   │  (PostgreSQL)   │
└──────────────┘   └─────────────────┘   └─────────────────┘

Additional Services:
  Auth Service      :3000  →  auth_db (PostgreSQL)
  Notification Svc  :3004  →  Email (SMTP/SendGrid) + WebSocket
  AI Service        :3005  →  OpenAI / Gemini / Kimi (pluggable)
```

### 3.2 External Integrations

```
New App Services ←──── HTTPS/JSON ────→ BS4 ERP
  - Recruitment Service  →  Push new hire core fields
  - Appraisal Service    →  Pull employee + org data
  - Project Service      →  Pull employee + cost centers

Project Service ←──── HTTPS/JSON ────→ Directus ERP
  - Push approved time entries for payroll/billing sync

Recruitment Service ←── HTTPS/JSON ──→ Job Boards
  - LinkedIn, Indeed, Rozee.pk (configurable)

AI Service ←──────── HTTPS/JSON ─────→ AI Provider
  - OpenAI / Google Gemini / Kimi (pluggable adapter pattern)
```

---

## 4. Authentication & SSO

### 4.1 Strategy

- **Single Auth Service** issues JWT tokens valid across all 3 modules
- **BS4 ERP** is the source of truth for user identity
- Auth service syncs user profile and roles from BS4 on every login
- Angular **shared shell** handles token storage, refresh, and module routing
- **RBAC** (Role-Based Access Control) enforced at API Gateway and service level

### 4.2 JWT Token Payload

```json
{
  "userId": "uuid",
  "email": "user@company.com",
  "roles": ["hr_admin", "hiring_manager"],
  "modules": ["recruitment", "appraisal", "project"],
  "legalEntity": "entity_id",
  "department": "dept_id",
  "bs4EmployeeId": "emp_id",
  "iat": 1234567890,
  "exp": 1234567890
}
```

### 4.3 Login Flow

```
1. User submits credentials to Angular shell
2. Angular POSTs to Auth Service /auth/login
3. Auth Service validates credentials against BS4 API
4. BS4 returns user profile + roles
5. Auth Service issues JWT (access token 15min + refresh token 7d)
6. Angular stores tokens, decodes module permissions
7. User is routed to permitted modules
8. All subsequent API calls include: Authorization: Bearer {access_token}
```

### 4.4 Token Refresh

- Access token expires every **15 minutes**
- Refresh token valid for **7 days**
- Angular interceptor auto-refreshes silently before expiry
- On refresh token expiry, user is redirected to login

---

## 5. Module 1: Recruitment

### 5.1 Overview

A full Applicant Tracking System (ATS) supporting internal postings, external job boards, and recruitment agency portals with AI-assisted resume screening.

### 5.2 User Roles

| Role | Access Scope |
|---|---|
| **HR Admin** | Full system — job requisitions, pipeline management, offers, reporting, agency management |
| **Hiring Manager** | Department-scoped — raise requisitions, shortlist candidates, interview feedback, offer approval |
| **Candidate** | Self-service portal — apply, upload documents, track application status |
| **Recruitment Agency** | Agency portal — submit candidates against open requisitions, track submission status |

### 5.3 Sourcing Channels

- **Internal postings** — published on internal employee portal
- **External job boards** — LinkedIn, Indeed, Rozee.pk (configurable integrations)
- **Recruitment agencies** — dedicated agency portal for candidate submission

### 5.4 Core Feature Set

#### 5.4.1 Job Requisition Management
- HR or Hiring Manager raises a job requisition
- Requisition includes: title, department, location, headcount, salary band, job description, required competencies
- Multi-level approval workflow before posting
- Requisition linked to BS4 department/cost center

#### 5.4.2 Job Posting
- Publish to internal portal, external boards, and/or agency portal simultaneously
- Configurable application form per job type
- Application deadline management
- Auto-close when headcount filled

#### 5.4.3 AI-Assisted Resume Screening
- AI parses uploaded resumes against job description requirements
- Generates a **match score** per candidate (0–100)
- Flags missing mandatory qualifications
- Provides reasoning summary for each score
- AI suggestions are **advisory only** — HR/HM makes final shortlist decision
- Pluggable AI provider: OpenAI / Google Gemini / Kimi

#### 5.4.4 Multi-Stage Interview Pipeline

Each job has a **configurable stage template** (different templates per role level/type):

```
Stage 1: Phone Screen       → Scorecard: Communication, Role Fit
Stage 2: Technical Round    → Scorecard: Technical competencies (weighted)
Stage 3: HR Interview       → Scorecard: Culture fit, Compensation alignment
Stage 4: Final/Panel Round  → Scorecard: Leadership, Panel consensus
```

- Per-stage scorecards with **weighted competency ratings**
- Panel interview support (multiple interviewers per stage)
- Configurable evaluation templates per job type/level
- Interviewer feedback visible to HR; hidden from other interviewers until submitted (blind review)

#### 5.4.5 Offer Management
- Generate offer letter from configurable templates
- Offer approval workflow (HR → Department Head → Finance if above band)
- Digital offer delivery to candidate
- Candidate accepts/declines within portal
- Counter-offer handling

#### 5.4.6 BS4 Integration at Hire

**Auto-push to BS4 (on offer acceptance + start date confirmed):**
- Employee name, designation, department
- Reporting manager
- Joining date
- Offered salary / grade
- Legal entity assignment

**HR Onboarding Notification:**
- Automated checklist notification to HR for remaining BS4 steps
- Items: bank details, documents upload, benefits enrollment, system access provisioning

### 5.5 Recruitment Data Model

```
job_requisition
  id, title, department_id (BS4), location, headcount, salary_band_min,
  salary_band_max, job_description, required_competencies (jsonb),
  status, created_by, approved_by, created_at

job_posting
  id, requisition_id, channel (internal/linkedin/indeed/rozee/agency),
  posted_at, closes_at, status, external_posting_id

application
  id, posting_id, candidate_id, agency_id (nullable), source,
  status, ai_score, ai_reasoning, submitted_at

candidate
  id, first_name, last_name, email, phone, resume_url,
  linkedin_url, created_at

agency
  id, name, contact_name, contact_email, contract_start, contract_end,
  fee_percentage, status

interview_stage
  id, application_id, stage_template_id, stage_order, scheduled_at,
  status, overall_score

scorecard
  id, interview_stage_id, interviewer_id, competency, rating (1-5),
  weight, comments, submitted_at

offer
  id, application_id, salary, designation, joining_date, status,
  generated_at, sent_at, responded_at, candidate_response

employee_handoff
  id, offer_id, bs4_push_status, bs4_employee_id, pushed_at,
  onboarding_notification_sent_at
```

---

## 6. Module 2: Performance Appraisal

### 6.1 Overview

A 360° feedback system with configurable review cycles (quarterly, mid-year, annual) supporting goal setting, multi-rater feedback, calibration, and increment/promotion recommendations.

### 6.2 User Roles

| Role | Access Scope |
|---|---|
| **HR Admin** | Full system — cycle management, calibration, recommendations, reporting |
| **Manager** | Team-scoped — set goals, review team members, calibration participation |
| **Employee** | Self — self-assessment, view own feedback, goal tracking |
| **Peer / Subordinate** | Feedback-only — respond to feedback requests for nominated employees |

### 6.3 Appraisal Methodology

**360° Feedback** combined with **configurable review cycles**:

#### Review Cycle Types (Configurable per Department/Role)

| Cycle | Frequency | Scope |
|---|---|---|
| **Quarterly Check-in** | Every 3 months | Lightweight — progress update + blockers + manager notes |
| **Mid-Year Review** | 6 months | Full 360° feedback round + goal adjustment |
| **Annual Review** | 12 months | Comprehensive 360° + final scoring + calibration + recommendations |

#### 360° Feedback Participants

| Reviewer Type | Description |
|---|---|
| **Self** | Employee self-assessment against goals and competencies |
| **Manager** | Direct line manager rating |
| **Peers** | Nominated colleagues at same level (typically 2–4) |
| **Subordinates** | Direct reports (for employees who manage others) |
| **Skip-level** | Optional senior leadership input for senior roles |

### 6.4 Core Feature Set

#### 6.4.1 Goal Setting
- Goals set at start of each annual cycle
- Goals linked to: department objectives, individual KPIs, competency framework
- SMART goal format (Specific, Measurable, Achievable, Relevant, Time-bound)
- Manager approves employee goals
- Goals visible to all 360° reviewers during feedback

#### 6.4.2 Feedback Collection
- System auto-generates feedback requests based on cycle type
- Employees nominate peers/subordinates (manager approves nominations)
- Anonymous feedback option for peer/subordinate responses
- Deadline reminders via notification service
- Feedback locked after submission

#### 6.4.3 Scoring & Calibration
- Weighted scoring: self (10%), peers (20%), subordinates (20%), manager (50%)
- Configurable weights per organization/department
- Calibration session: HR + managers review score distribution
- Bell curve / forced distribution view for calibration
- Final calibrated score recorded

#### 6.4.4 Increment & Promotion Recommendations
- System generates structured recommendation report per employee
- Report includes: final score, score trend (vs. prior cycles), peer comparison, suggested increment band
- HR reviews recommendations and **manually applies** changes in BS4
- No auto-push of salary/grade changes — human-in-the-loop required

### 6.5 BS4 Integration

**Pulls from BS4:**
- Employee master (name, designation, department, joining date)
- Org hierarchy (reporting lines for 360° participant resolution)
- Salary bands (for increment recommendation context)
- Legal entity assignments

**No auto-push to BS4** — recommendations are generated as reports for HR to act on manually.

### 6.6 Appraisal Data Model

```
appraisal_cycle
  id, name, type (quarterly/midyear/annual), start_date, end_date,
  status, created_by, created_at

employee_cycle
  id, cycle_id, employee_id (BS4), status, final_score,
  calibrated_score, recommendation_generated

goal
  id, employee_cycle_id, title, description, kpi_metric,
  target_value, actual_value, weight, status

feedback_request
  id, employee_cycle_id, reviewer_id, reviewer_type
  (self/manager/peer/subordinate/skip), status, due_date, is_anonymous

feedback_response
  id, feedback_request_id, competency, rating (1-5), comments,
  submitted_at

calibration
  id, cycle_id, department_id, facilitated_by, held_at, notes

recommendation
  id, employee_cycle_id, final_score, score_trend, suggested_increment_pct,
  suggested_designation_change, generated_at, reviewed_by_hr
```

---

## 7. Module 3: Project & Task Management

### 7.1 Overview

A comprehensive project and task management system supporting client-billable projects, internal projects, and recurring operational tasks with multi-view visualization and time tracking synced to the existing Directus ERP.

### 7.2 User Roles

| Role | Access Scope |
|---|---|
| **Admin** | Full system — all projects, resource management, reporting |
| **Project Manager** | Assigned projects — full project control, resource assignment, reporting |
| **Team Member** | Assigned tasks — task updates, time logging, comments |
| **Client** | Client portal (optional) — view project status and milestones only |

### 7.3 Project Types

| Type | Description | Billing |
|---|---|---|
| **Client Project** | External client deliverables | Billable — tracked against client budget |
| **Internal Project** | IT, process improvement, initiatives | Non-billable — tracked against cost center |
| **Operational Tasks** | Recurring departmental BAU work | Non-billable — tracked for utilization |

### 7.4 Views (User-Switchable)

| View | Description |
|---|---|
| **Kanban Board** | Drag-and-drop cards across status columns (To Do → In Progress → Review → Done) |
| **Gantt Chart** | Timeline view with task dependencies, milestones, and critical path |
| **List View** | Tabular, sortable, filterable task list with bulk actions |
| **Calendar View** | Deadline and milestone calendar with task due dates |

### 7.5 Core Feature Set

#### 7.5.1 Project Management
- Create projects with: name, type, client (if applicable), start/end dates, budget, description
- Project phases / milestones with target dates
- Project status: Planning → Active → On Hold → Completed → Cancelled
- Project health indicators: On Track / At Risk / Delayed
- Budget tracking (estimated vs. actual hours and cost)

#### 7.5.2 Task Management
- Tasks linked to projects (or standalone for operational tasks)
- Task fields: title, description, assignee(s), priority, due date, estimated hours, status, tags
- Subtask support (one level deep)
- Task dependencies (finish-to-start, start-to-start)
- File attachments per task
- Comment thread per task with @mentions

#### 7.5.3 Resource Management
- Assign employees (pulled from BS4) to projects and tasks
- Resource utilization view: hours allocated vs. available per employee
- Capacity planning: see team availability across projects

#### 7.5.4 Time Tracking

**Dual system strategy:**

```
Employee logs hours in new module against specific tasks
         ↓
Time entry stored in project_db (PostgreSQL)
         ↓
Manager approves time entries
         ↓
Approved entries sync to Directus ERP via secured API
         ↓
Directus ERP processes for payroll / client billing
```

- Employees log time directly against tasks (start/stop timer or manual entry)
- Daily/weekly timesheet view
- Manager approval workflow for time entries
- Approved entries sync to Directus ERP (scheduled nightly or event-driven on approval)
- Sync status tracked per entry (pending / synced / failed)

### 7.6 BS4 Integration

**Pulls from BS4:**
- Employee master (for resource assignment)
- Org structure (for project team hierarchy)
- Cost centers (for internal project cost allocation)
- Client data (if maintained in BS4)

**Pushes to Directus ERP:**
- Approved time entries (employee_id, task_id, project_id, hours, date, billable flag)

### 7.7 Project/Task Data Model

```
project
  id, name, type (client/internal/operational), client_id (nullable),
  start_date, end_date, budget_hours, budget_amount, status,
  health_status, cost_center_id (BS4), created_by, created_at

milestone
  id, project_id, name, target_date, completed_at, status

task
  id, project_id, milestone_id (nullable), parent_task_id (nullable),
  title, description, assignee_id (BS4 employee), priority,
  due_date, estimated_hours, actual_hours, status, tags (jsonb),
  created_by, created_at

task_dependency
  id, task_id, depends_on_task_id, dependency_type

time_entry
  id, task_id, employee_id (BS4), date, hours, description,
  is_billable, status (draft/submitted/approved/rejected),
  approved_by, approved_at, directus_sync_status, directus_sync_at

task_comment
  id, task_id, author_id, body, mentions (jsonb), created_at

task_attachment
  id, task_id, filename, file_url, uploaded_by, uploaded_at

client
  id, name, contact_name, contact_email, bs4_client_id (nullable)
```

---

## 8. BS4 ERP Integration

### 8.1 Integration Pattern

All communication between the new application and BS4 ERP uses **REST APIs with JSON over HTTPS**.

```
New App Service
    │
    │  HTTPS POST/GET
    │  Authorization: Bearer {api_key}
    │  Content-Type: application/json
    ▼
BS4 API Gateway
    │  Validates API key + scope
    │  Rate limiting
    │  Audit logging
    ▼
BS4 ERP Internal
    │
    ▼
JSON Response → New App Service
```

### 8.2 Authentication

- API Key per service (Recruitment, Appraisal, Project)
- Keys stored in **GCP Secret Manager** — never hardcoded
- Keys rotated periodically (quarterly minimum)
- Each key has defined scopes (read-only vs. read-write)

### 8.3 Data Contracts

#### Inbound (BS4 → New App)

| Endpoint | Data | Consumer |
|---|---|---|
| `GET /employees` | Employee master list | All modules |
| `GET /employees/{id}` | Single employee detail | All modules |
| `GET /org-hierarchy` | Reporting lines tree | Appraisal, Project |
| `GET /departments` | Department list | All modules |
| `GET /cost-centers` | Cost center list | Project |
| `GET /salary-bands` | Salary band definitions | Appraisal |
| `GET /legal-entities` | Legal entity list | Recruitment |

#### Outbound (New App → BS4)

| Endpoint | Data | Producer |
|---|---|---|
| `POST /employees` | New hire core fields | Recruitment |
| `POST /notifications` | HR onboarding checklist trigger | Recruitment |

#### Outbound (New App → Directus ERP)

| Endpoint | Data | Producer |
|---|---|---|
| `POST /time-entries/bulk` | Approved time entries | Project |

### 8.4 Error Handling

- Retry logic: 3 attempts with exponential backoff for transient failures
- Dead letter queue for failed sync operations
- Alert notification to admin on repeated failures
- All integration calls logged with request/response for audit

---

## 9. Notifications & Workflow Engine

### 9.1 Notification Channels

| Channel | Delivery | Use Cases |
|---|---|---|
| **In-App** | WebSocket / SSE (real-time) | Task assignments, approvals pending, feedback requests, mentions |
| **Email** | SMTP / SendGrid | Interview invites, offer letters, appraisal cycle start, deadline reminders |

### 9.2 Approval Routing Engine

The workflow engine resolves approvers dynamically from BS4 org hierarchy:

```
Trigger Event
    ↓
Workflow Rule Engine
    ↓
Resolve Approvers (from BS4 org hierarchy)
    ↓
Create Approval Task in DB
    ↓
Notify Approver (Email + In-App)
    ↓
Approver Decision:
  ├── Approve → Next stage or complete
  ├── Reject  → Notify requester with comments
  └── Timeout → Escalate to skip-level approver
```

### 9.3 Approval Workflows Per Module

**Recruitment:**
1. Job Requisition → Department Head → HR Director
2. Offer Letter → HR Manager → Department Head → Finance (if above band)
3. Hire Confirmation → HR Admin

**Performance Appraisal:**
1. Goal Setting → Manager approval
2. Peer Nomination → Manager approval
3. Calibration Sign-off → HR Director
4. Recommendation Report → HR Director → CEO (for senior roles)

**Project & Task Management:**
1. Project Creation → Department Head (for internal) / Finance (for client projects)
2. Budget Approval → Finance
3. Time Entry → Project Manager approval (for billing)

### 9.4 Notification Templates

All notification templates are configurable by HR Admin:
- Subject line
- Body (HTML email / plain text in-app)
- Dynamic variables: `{{employee_name}}`, `{{job_title}}`, `{{deadline}}`, etc.
- Multi-language support (configurable)

---

## 10. Reporting & Analytics

### 10.1 Recruitment Dashboard

| Metric | Description |
|---|---|
| Open Positions | Count by department, location, seniority |
| Pipeline Funnel | Applied → Screened → Interviewed → Offered → Hired |
| Time-to-Hire | Average days from requisition to offer acceptance |
| Source Effectiveness | Hire rate by channel (internal/LinkedIn/Indeed/agency) |
| Agency Performance | Submissions, shortlists, hires, cost per hire per agency |
| AI Screening Accuracy | AI score vs. final hire decision correlation |

### 10.2 Performance Appraisal Dashboard

| Metric | Description |
|---|---|
| Review Completion Rate | % of employees with completed reviews by department |
| Score Distribution | Bell curve / histogram of final scores |
| Goal Achievement Rate | % of goals met/exceeded vs. missed |
| 360° Participation Rate | % of feedback requests responded to |
| Increment Pipeline | Employees by recommended increment band |
| Score Trend | Year-over-year score movement per employee/department |

### 10.3 Project & Task Management Dashboard

| Metric | Description |
|---|---|
| Project Health | Count by On Track / At Risk / Delayed |
| Resource Utilization | Hours allocated vs. available per employee |
| Burn Rate | Hours logged vs. estimated per project |
| Milestone Completion | On-time vs. delayed milestones |
| Billable vs. Non-Billable | Hours breakdown by project type |
| Time Entry Sync Status | Pending / synced / failed entries to Directus ERP |

### 10.4 Cross-Module Executive Reports

| Report | Data Sources |
|---|---|
| **Employee Lifecycle** | Recruitment (hire date, source) + Appraisal (scores) + Project (utilization) |
| **Department Health** | Headcount growth + appraisal scores + project delivery rate |
| **Cost Analysis** | Recruitment cost + salary increments + billable hours revenue |
| **Workforce Planning** | Open positions + attrition risk (low appraisal scores) + capacity |

---

## 11. Project Structure

```
hr-suite/
├── frontend/
│   ├── shell/                    ← Angular SSO shell app (shared auth + navigation)
│   │   ├── src/
│   │   │   ├── app/
│   │   │   │   ├── auth/         ← Login, token management, guards
│   │   │   │   ├── shell/        ← App shell, module routing
│   │   │   │   └── shared/       ← Shared components, pipes, directives
│   │   │   └── environments/
│   │   └── package.json
│   │
│   ├── recruitment/              ← Recruitment Angular app
│   │   ├── src/app/
│   │   │   ├── job-requisitions/
│   │   │   ├── job-postings/
│   │   │   ├── applications/
│   │   │   ├── interviews/
│   │   │   ├── offers/
│   │   │   ├── agencies/
│   │   │   └── reports/
│   │   └── package.json
│   │
│   ├── appraisal/                ← Performance Appraisal Angular app
│   │   ├── src/app/
│   │   │   ├── cycles/
│   │   │   ├── goals/
│   │   │   ├── feedback/
│   │   │   ├── calibration/
│   │   │   ├── recommendations/
│   │   │   └── reports/
│   │   └── package.json
│   │
│   ├── project-mgmt/             ← Project/Task Management Angular app
│   │   ├── src/app/
│   │   │   ├── projects/
│   │   │   ├── tasks/
│   │   │   ├── kanban/
│   │   │   ├── gantt/
│   │   │   ├── time-tracking/
│   │   │   ├── resources/
│   │   │   └── reports/
│   │   └── package.json
│   │
│   └── shared-lib/               ← Angular library: shared models, services, UI components
│       ├── src/lib/
│       │   ├── models/           ← TypeScript interfaces
│       │   ├── services/         ← HTTP client services
│       │   ├── components/       ← Shared UI components
│       │   └── interceptors/     ← JWT interceptor, error handler
│       └── package.json
│
├── backend/
│   ├── auth-service/             ← Node.js + Express — JWT, SSO, BS4 user sync
│   │   ├── src/
│   │   │   ├── routes/
│   │   │   ├── middleware/
│   │   │   ├── services/
│   │   │   └── bs4-client/
│   │   └── package.json
│   │
│   ├── recruitment-service/      ← Node.js + Express — ATS, pipeline, offers
│   │   ├── src/
│   │   │   ├── routes/
│   │   │   ├── controllers/
│   │   │   ├── services/
│   │   │   ├── models/
│   │   │   └── integrations/     ← Job board adapters
│   │   └── package.json
│   │
│   ├── appraisal-service/        ← Node.js + Express — 360°, cycles, calibration
│   │   ├── src/
│   │   │   ├── routes/
│   │   │   ├── controllers/
│   │   │   ├── services/
│   │   │   └── models/
│   │   └── package.json
│   │
│   ├── project-service/          ← Node.js + Express — projects, tasks, time entries
│   │   ├── src/
│   │   │   ├── routes/
│   │   │   ├── controllers/
│   │   │   ├── services/
│   │   │   ├── models/
│   │   │   └── sync/             ← Directus ERP sync
│   │   └── package.json
│   │
│   ├── notification-service/     ← Node.js + Express — email + in-app notifications
│   │   ├── src/
│   │   │   ├── routes/
│   │   │   ├── templates/        ← Email HTML templates
│   │   │   ├── services/
│   │   │   │   ├── email.service.ts
│   │   │   │   └── websocket.service.ts
│   │   │   └── models/
│   │   └── package.json
│   │
│   ├── ai-service/               ← Node.js + Express — pluggable AI provider adapter
│   │   ├── src/
│   │   │   ├── routes/
│   │   │   ├── adapters/
│   │   │   │   ├── openai.adapter.ts
│   │   │   │   ├── gemini.adapter.ts
│   │   │   │   └── kimi.adapter.ts
│   │   │   └── services/
│   │   │       └── resume-screener.service.ts
│   │   └── package.json
│   │
│   └── shared/                   ← Shared backend utilities
│       ├── middleware/
│       │   ├── auth.middleware.ts ← JWT validation
│       │   ├── rbac.middleware.ts ← Role-based access control
│       │   └── logger.middleware.ts
│       ├── bs4-client/           ← BS4 ERP HTTP client with retry logic
│       ├── directus-client/      ← Directus ERP HTTP client
│       └── utils/
│
├── database/
│   ├── recruitment/
│   │   ├── migrations/           ← Numbered SQL migration files
│   │   └── seeds/                ← Test/demo data
│   ├── appraisal/
│   │   ├── migrations/
│   │   └── seeds/
│   ├── project/
│   │   ├── migrations/
│   │   └── seeds/
│   └── auth/
│       ├── migrations/
│       └── seeds/
│
└── infrastructure/
    ├── gcp/
    │   ├── cloud-run/            ← Cloud Run service definitions per service
    │   ├── cloud-sql/            ← Cloud SQL PostgreSQL instance configs
    │   └── secret-manager/       ← GCP Secret Manager key references
    └── docker/
        ├── Dockerfile.auth
        ├── Dockerfile.recruitment
        ├── Dockerfile.appraisal
        ├── Dockerfile.project
        ├── Dockerfile.notification
        ├── Dockerfile.ai
        └── docker-compose.yml    ← Local development environment
```

---

## 12. Next Steps

### Phase 1 — Foundation (Weeks 1–4)
- [ ] Finalize BS4 API contract with BS4 team (endpoint specs, auth tokens, rate limits)
- [ ] Set up GCP project, Cloud SQL instances (4 PostgreSQL DBs), Secret Manager
- [ ] Scaffold monorepo structure with Angular workspace + Node.js services
- [ ] Implement Auth Service + JWT SSO + Angular shared shell
- [ ] Database migrations for all 4 databases

### Phase 2 — Recruitment Module (Weeks 5–12)
- [ ] Job Requisition + Approval workflow
- [ ] Job Posting (internal + agency portal)
- [ ] Candidate application intake
- [ ] AI resume screening integration (pluggable adapter)
- [ ] Multi-stage interview pipeline + scorecards
- [ ] Offer management + BS4 hire push
- [ ] Recruitment dashboard

### Phase 3 — Performance Appraisal Module (Weeks 13–20)
- [ ] Appraisal cycle management
- [ ] Goal setting + approval
- [ ] 360° feedback collection (all reviewer types)
- [ ] Scoring + calibration
- [ ] Increment/promotion recommendation reports
- [ ] Appraisal dashboard

### Phase 4 — Project & Task Management Module (Weeks 21–30)
- [ ] Project + milestone management
- [ ] Task management (all CRUD)
- [ ] Kanban, Gantt, List, Calendar views
- [ ] Time tracking + manager approval
- [ ] Directus ERP time entry sync
- [ ] Resource utilization view
- [ ] Project dashboard

### Phase 5 — Cross-Cutting & Launch (Weeks 31–36)
- [ ] Notification service (email + in-app WebSocket)
- [ ] Approval routing engine (all modules)
- [ ] Cross-module executive reporting
- [ ] External job board integrations (LinkedIn, Indeed, Rozee.pk)
- [ ] Performance testing + security audit
- [ ] UAT with HR team, hiring managers, and pilot users
- [ ] Production deployment on GCP

---

## 13. Confirmed Decisions — Master Reference

| Category | Decision |
|---|---|
| **Frontend** | Angular + TypeScript + CSS |
| **Backend** | Node.js + Express.js (microservices per module) |
| **Database** | PostgreSQL (separate DB per module) |
| **API Protocol** | JSON over HTTP/HTTPS (REST) |
| **AI Provider** | Pluggable adapter — OpenAI / Google Gemini / Kimi |
| **Auth** | JWT-based SSO, single token across all 3 modules, BS4 user sync |
| **Notifications** | Email (SMTP/SendGrid) + In-App (WebSocket/SSE) |
| **Workflows** | Approval routing engine with BS4 org hierarchy for approver resolution |
| **Reporting** | Per-module dashboards + cross-module executive reporting |
| **Deployment** | GCP (Cloud Run + Cloud SQL) |
| **Recruitment — Sourcing** | Internal + External boards (LinkedIn/Indeed/Rozee) + Agencies |
| **Recruitment — Roles** | HR Admin, Hiring Manager, Candidate, Agency |
| **Recruitment — BS4 Hire** | Auto-push core fields + HR onboarding notification |
| **Recruitment — Pipeline** | Advanced structured + AI resume screening + weighted scorecards |
| **Appraisal — Methodology** | 360° feedback + Quarterly / Mid-Year / Annual cycles |
| **Appraisal — BS4 Push** | Partial — recommendations only, HR applies manually in BS4 |
| **Project — Types** | Client + Internal + Operational tasks |
| **Project — Time Tracking** | Dual system — new module + nightly sync to Directus ERP |
| **Project — Views** | Kanban + Gantt + List + Calendar (user-switchable) |

---

*Document maintained by: Engineering Team*
*Last updated: 2026-07-30*
*Next review: After BS4 API contract finalization*