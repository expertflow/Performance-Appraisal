# HR & Project Management Suite — Complete Requirements Document

**Version:** 1.3  
**Date:** 2026-07-30  
**Status:** Requirements Gathered — Ready for PRD  

> **v1.3 changes (post-validation hardening):** Resolved reviewer findings — external data-scoping now has a server-side predicate + FK columns (§4.5); WebSocket auth lifecycle + backplane defined (§9.1); BS4 hire-push failure path, status states, and idempotency key added (§5.4.6, §8.4); refresh-token reuse detection (§4.4); signed-URL TTL + download-audit reconciliation (§10.4); raised anonymity thresholds + timing-side-channel mitigation (§10.3); scoring weights sum=100 + empty-class redistribution (§6.4.3); Directus reversal preconditions + idempotency semantics (§7.5.4); scheduled-job ownership table (§8.6); Phase-1 seed data (§8.5, §13). Added §3.6 Observability (deferred), §3.7 Testing Strategy, §3.8 Non-Functional & Scale (deferred to architecture), §15 Non-Goals, §16 Assumptions, §17 Glossary, §18 Open Questions & Risks. Replaced vague qualifiers; picked a primary cloud target.
>
> **v1.2 changes:** Separate external-user portal with its own Google OAuth track (candidates, agencies, clients — no access to company data); cloud-agnostic deployment (no hard GCP dependency); timezone & localization rule added (store UTC, display in user's auto-detected local timezone); REST API versioning convention (`/api/v1/...`); GDPR right-to-erasure process; one-time initial employee/org backfill added to Phase 1; time entry simplified to manual entry (no start/stop timer).
>
> **v1.1 changes:** Single PostgreSQL database (schema-per-module), single Angular app with feature modules, Google SSO, Notification & Workflow Service moved to Phase 1–2, Express API Gateway, object-storage file storage with ClamAV scanning, security & compliance section added, data model gaps resolved, reporting scoped to per-module.

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
10. [Security & Compliance](#10-security--compliance)
11. [Reporting & Analytics](#11-reporting--analytics)
12. [Project Structure](#12-project-structure)
13. [Next Steps](#13-next-steps)
14. [Confirmed Decisions — Master Reference](#14-confirmed-decisions--master-reference)
15. [Non-Goals](#15-non-goals)
16. [Assumptions](#16-assumptions)
17. [Glossary](#17-glossary)
18. [Open Questions & Risks](#18-open-questions--risks)

---

## 1. Executive Summary

This document defines the requirements for a new **HR & Project Management Suite** consisting of three fully independent modules:

| Module | Purpose |
|---|---|
| **Recruitment** | End-to-end applicant tracking with AI-assisted screening |
| **Performance Appraisal** | 360° feedback with configurable review cycles |
| **Project & Task Management** | Multi-view project tracking with time entry sync |

### Key Principles

- Each module is **independent** — separate backend service and separate database schema; one shared Angular frontend with lazy-loaded feature modules
- **Single PostgreSQL database** (`hr_suite_db`) with **schema-per-module** for isolation
- All three modules share a **single SSO layer** (Google OAuth + JWT) so a user signs in once and moves between permitted modules without re-authenticating
- Integration with **BS4 ERP** is via secured REST APIs (JSON over HTTPS)
- Integration with **existing Directus ERP** for time entry sync (Project module)
- **Cloud-agnostic by design, one target validated at launch** — packaged as Docker containers against portable primitives (managed PostgreSQL, S3-compatible object storage, container runtime, secrets manager) so there is no hard lock-in. **Exactly one primary cloud target is built, tested, and deployed for launch** (chosen during architecture, §18); the other targets are *portable-by-design but unvalidated* until actually exercised — the doc does not claim running parity across four clouds.

---

## 2. Technology Stack

| Layer | Technology | Notes |
|---|---|---|
| **Frontend** | Angular (latest) + TypeScript + CSS | **One** Angular app; lazy-loaded feature modules per HR module |
| **Backend** | Node.js + Express.js | Separate service per module |
| **API Gateway** | Express-based gateway service | JWT validation, rate limiting, request routing (see 3.3) |
| **Database** | PostgreSQL — **single database** `hr_suite_db` | Schema-per-module: `auth`, `common`, `recruitment`, `appraisal`, `project`, `notification` |
| **API Protocol** | REST — JSON over HTTP/HTTPS | All internal and external APIs |
| **AI Provider** | Pluggable adapter | OpenAI / Google Gemini / Kimi — configurable |
| **Deployment** | Cloud-agnostic (containers) | Docker containers on any suitable cloud — managed container runtime (Cloud Run / ECS / AKS / Kubernetes); not tied to one provider |
| **Auth** | Google OAuth 2.0 + JWT (access + refresh) | Two OAuth apps: **internal** (company workspace domain) + **external** (public Google accounts); issued by central Auth Service (see 4.5) |
| **File Storage** | S3-compatible object storage | GCS / Amazon S3 / Azure Blob — any S3-compatible bucket; downloads served through the web app with authz checks |
| **Antivirus** | ClamAV (`clamd`) | Open-source AV engine, runs as a container; scans all uploads |
| **Email** | SMTP / SendGrid | Notification service |
| **Real-time** | WebSocket / SSE | In-app notifications |

---

## 3. System Architecture

### 3.1 High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│              FRONTEND — Single Angular App + TypeScript          │
│   Lazy-loaded feature modules, one deployable application:       │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────┐  │
│  │  Recruitment │  │  Appraisal   │  │  Project/Task Mgmt   │  │
│  │   module     │  │   module     │  │       module         │  │
│  └──────────────┘  └──────────────┘  └──────────────────────┘  │
│   Core: Google SSO login, token mgmt, guards, shared UI lib     │
└─────────────────────────────────────────────────────────────────┘
                              │ HTTPS
                    ┌─────────▼──────────┐
                    │    API Gateway     │  :8080
                    │  JWT Validation    │
                    │  Rate Limiting     │
                    │  Request Routing   │
                    └─────────┬──────────┘
                              │
        ┌──────────┬──────────┼──────────┬──────────────────┐
        │          │          │          │                  │
┌───────▼──────┐ ┌─▼───────────┐ ┌───────▼──────┐ ┌─────────▼────────┐
│ Recruitment  │ │  Appraisal  │ │ Project/Task │ │ Notification &   │
│   Service    │ │   Service   │ │   Service    │ │ Workflow Service │
│  :3001       │ │   :3002     │ │   :3003      │ │     :3004        │
└───────┬──────┘ └─────┬───────┘ └───────┬──────┘ └─────────┬────────┘
        │              │                 │                  │
        └──────────────┴────────┬────────┴──────────────────┘
                                │
              ┌─────────────────▼──────────────────┐
              │      hr_suite_db (PostgreSQL)       │
              │  Schemas: auth, common,             │
              │  recruitment, appraisal,            │
              │  project, notification              │
              └────────────────────────────────────┘

Additional Services:
  Auth Service      :3000  →  auth schema (Google SSO, JWT, user/role store)
  AI Service        :3005  →  OpenAI / Gemini / Kimi (pluggable, stateless)
  ClamAV (clamd)    :3310  →  Container; scans uploaded files before object-storage persist
```

> **Two frontends:** the diagram above shows the **internal** Angular app used by staff. External users (candidates, agencies, clients) use a **separate `external-portal-app`** with its own Google OAuth app; it reaches the same gateway but carries `audience: "external"` tokens and can only touch its own records (see 4.5).

**Schema isolation rule:** each service connects with a DB role granting access **only** to its own schema, plus **read** access to `common` **and INSERT-only** access to `common.audit_log` (every service must write audit rows — see 10.1). Cross-schema **joins** in application code are not allowed; cross-module data flows through service APIs.

> **Cross-schema references are unenforced pointers, by design.** Columns like `notification.approval_task.entity_id` (pointing at a row in `recruitment`/`appraisal`/`project`) or `*_id (BS4)` cannot carry a real foreign key across the isolation boundary. Referential integrity for these is the **owning service's responsibility** (validate-on-write, reconcile-on-read); the database does not guarantee it. This is the accepted cost of schema isolation on a single database — the isolation is a blast-radius and access-control boundary, not a full physical partition.

### 3.2 External Integrations

```
New App Services ←──── HTTPS/JSON ────→ BS4 ERP
  - Auth Service       →  Pull user profile + roles (on login, with cache fallback)
  - Recruitment Service→  Push new hire core fields
  - Appraisal Service  →  Pull employee + org data
  - Project Service    →  Pull employee + cost centers

Nightly Sync Job ←──── HTTPS/JSON ────→ BS4 ERP
  - Delta-sync employee master + org hierarchy into common.employee_snapshot

Project Service ←──── HTTPS/JSON ────→ Directus ERP
  - Push approved time entries for payroll/billing sync (idempotent, see 7.5.4)

Recruitment Service ←── HTTPS/JSON ──→ Job Boards
  - LinkedIn, Indeed, Rozee.pk (configurable)

AI Service ←──────── HTTPS/JSON ─────→ AI Provider
  - OpenAI / Google Gemini / Kimi (pluggable adapter pattern)
```

### 3.3 API Gateway Decision

The API Gateway is a **thin Express-based gateway service** (`api-gateway`, port 8080) — **no business logic**, only routing, auth, and rate-limiting — built with the same stack the team already uses:

- **JWT validation** — verifies access tokens before forwarding (shared middleware)
- **RBAC pre-check** — coarse role checks at the edge; fine-grained checks remain in services
- **Rate limiting** — `express-rate-limit` per user/IP
- **Request routing** — path-based proxying (`/api/recruitment/*` → :3001, etc.)
- **Request logging** — correlation ID per request, forwarded to all services

**Rejected alternatives:** Apigee (license cost disproportionate for an internal suite), Kong (extra infra to operate), managed cloud API gateways (OpenAPI spec maintenance overhead, limited flexibility for WebSocket routes). Revisit if the suite is ever exposed to external high-traffic consumers.

### 3.4 API Versioning

- All REST endpoints are versioned via a URL path prefix: `/api/v1/recruitment/*`, `/api/v1/appraisal/*`, etc.
- External-facing contracts (BS4 ERP, Directus ERP) are pinned to an explicit version so an upstream change never silently breaks a consumer.
- The versioned internal `shared/` package (see 12) forces all services onto the same middleware version in a sprint; the `v1` URL prefix insulates external clients from that internal churn.
- Breaking changes ship under a new prefix (`/api/v2/...`) with the prior version kept alive until all consumers migrate.

### 3.5 Localization & Timezone

- **All timestamps are stored in the database as UTC.** No local-time values are ever persisted.
- **Display is in the user's local timezone**, auto-detected from the browser/system on each session. A user logging in from Pakistan sees times in PKT (GMT+5); a user elsewhere sees their own local time — no manual timezone setting required.
- **Time entries** are recorded against the **user's local calendar day** at entry time. The `time_entry` row persists **both** the UTC instant **and** the timezone offset captured at entry (`entry_tz_offset`); payroll/billing derive the business day from that **stored** offset, never from the live session — so a traveling user or shifted VPN cannot reassign an entry to a different day on a later view.
- Appraisal cycle dates, interview schedules, and deadlines follow the same rule: stored UTC, rendered local.
- The captured locale also drives multi-language notification template selection (see 9.4).

### 3.6 Observability & Monitoring

> **Status: DEFERRED — not built in the initial phases (owner decision).** Documented here so the gap is explicit rather than silently missing.

- What exists today: per-request **correlation IDs** minted at the gateway and forwarded to every service (see 3.3), plus the failure alerts called out in 8.4 / 8.6.
- Deferred to a later phase (revisit before scale-up): centralized structured-log aggregation, metrics, distributed tracing, per-service health/readiness endpoints, and an alerting policy with named channels and thresholds.
- **Interim rule:** every service still emits structured logs with the correlation ID and exposes a basic `/health` endpoint, so the deferral does not block a minimal ops posture.

### 3.7 Testing Strategy

- **Unit tests** — per service, business logic and edge cases; run on every commit.
- **Integration tests** — service ↔ database (per schema) and service ↔ mocked BS4/Directus adapters.
- **Contract tests** — pinned against the BS4 and Directus REST contracts (§8.3); these guard the external dependencies whose contracts are not yet finalized (§18) and are the acceptance gate before the mock adapters are swapped for live ones.
- **E2E happy-path tests** — one per module's primary flow (requisition→offer, cycle→score, project→approved-time).
- **CI gate** — migrate + build + lint + unit/integration must pass before merge, wired from the foundation phase (not left to the end).
- Detailed, per-requirement **acceptance criteria are authored at story-creation time** downstream; this document defines the testable *consequences* inline where a requirement is non-obvious (e.g., 5.4.1 approver-left-chain, 5.4.2 headcount-reduced-below-filled).

### 3.8 Non-Functional Requirements & Scale

> **Status: scale/performance targets DEFERRED to the architecture phase (owner decision).** Stated explicitly so downstream can distinguish *unknown* from *unbounded*.

| NFR | Value |
|---|---|
| Concurrency / throughput / data-volume / user-count | **Deferred** — to be set with the architecture team; the single-DB decision (§14) is revisited against these numbers before build sign-off |
| Access token lifetime | 15 min (§4.4) |
| Refresh token lifetime | 7 days, rotated + reuse-detected (§4.4) |
| Snapshot staleness tolerance | ≤ 24 h; auth-relevant role revocations force immediate re-sync (§4.3) |
| RPO / RTO | ≤ 24 h / ≤ 4 h (§10.6) |
| Notification/WS warm instances | ≥ 1 (§9.1) |
| Audit retention | ≥ 7 years for payroll-adjacent records (§10.1) |

---

## 4. Authentication & SSO

### 4.1 Strategy

- **Google OAuth 2.0 is the identity provider for two separate user populations** (see 4.5):
  - **Internal staff** — authenticate with their **company Google Workspace account** (hosted-domain restricted), the same identity used by BS4/Directus
  - **External users** (candidates, agencies, clients) — authenticate with **any personal Google account** via a **separate OAuth app and separate portal**, with **no access to company data**
- **Single Auth Service** issues JWT tokens valid across the modules each population is entitled to
- **BS4 ERP remains the source of truth for profile, roles, and org data** — but NOT for authentication
- **BS4 downtime does not block login:** authentication is Google-side; profile/roles fall back to the local `common.employee_snapshot` cache (nightly delta sync, see 8.5)
- Angular **core module** handles token storage, refresh, and route guards per feature module
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
1. User clicks "Sign in with Google" in the Angular app
2. Google OAuth consent flow returns a Google ID token
3. Angular POSTs the ID token to Auth Service /auth/google
4. Auth Service verifies the ID token with Google (signature + audience + hosted domain)
5. Auth Service loads or creates the local user_account record
6. Profile + roles synced from BS4 if reachable; otherwise read from
   common.employee_snapshot cache (stale cache is acceptable for login)
7. Auth Service issues JWT (access token 15min + refresh token 7d)
8. Angular stores tokens, decodes module permissions
9. User is routed to permitted feature modules
10. All subsequent API calls include: Authorization: Bearer {access_token}
```

**Consequence:** if BS4 is down, users still log in and work normally; only fresh profile/role changes are delayed until the next successful sync.

**Staleness bound & revocation:** profile/role data may be at most **24 h** stale (the nightly sync cadence, §8.5). Because roles are embedded in the access token, a role change propagates within one token refresh (≤ 15 min) once the snapshot updates — worst case ≈ 24 h + 15 min. **Security-sensitive removals** (deactivation, HR-Admin/salary-access revocation) must **not** wait for the nightly cycle: they trigger an **immediate targeted re-sync + token-family invalidation** for that user so access is cut promptly.

### 4.4 Token Refresh

- Access token expires every **15 minutes**
- Refresh token valid for **7 days**, stored hashed in `auth.refresh_token`, rotated on each use
- **Reuse detection (theft response):** refresh tokens are chained in a **token family**. Presenting an already-consumed (previously-rotated) refresh token is the canonical theft signal → the **entire family is invalidated** and the user is forced to re-authenticate. Rotation alone is not sufficient.
- Angular interceptor auto-refreshes silently before expiry
- On refresh token expiry, user is redirected to login

### 4.5 External User Portal & Auth Track

Candidates, recruitment agencies, and clients are **external** — they have no company Google Workspace account and must never reach internal HR data. They are served by a **separate portal and a separate authentication track**.

**Separation model:**

| Aspect | Internal staff | External users |
|---|---|---|
| Portal | Main HR Suite app (all feature modules per role) | Dedicated external portal (apply/track, agency submissions, client status only) |
| Google OAuth app | Company Workspace, **hosted-domain restricted** | Separate OAuth app, **any Google account** allowed |
| Identity store | `auth.user_account` (linked to `common.employee_snapshot`) | `auth.external_account` (**no BS4/snapshot linkage**) |
| JWT payload | Full (roles, modules, `bs4EmployeeId`, `legalEntity`, `department`) | Minimal (see below) |
| Data visibility | Per-role company data | **Only their own** applications/submissions/projects — enforced at service level, not just UI |

**External JWT payload** (no company attributes, **no record-ID list**):

```json
{
  "externalAccountId": "uuid",     // stable identity, NOT a list of record IDs
  "email": "candidate@gmail.com",
  "audience": "external",
  "accountType": "candidate",      // or "agency", "client"
  "iat": 1234567890,
  "exp": 1234567890
}
```

**Server-side scoping (the actual enforcement — not the token).** The token carries only the stable `externalAccountId`; it never enumerates the rows a user may touch (an agency or client would need an unbounded, ever-changing list). Instead:

1. The auth layer resolves `externalAccountId` → its linked business entity (`auth.external_account.linked_entity_type` + `linked_entity_id`) and injects a **trusted, signed request-context header** (e.g. `X-External-Scope: candidate:<uuid>`) that downstream services cannot spoof.
2. Every external-facing query in a module service applies a **mandatory scoping predicate** derived from that context — `WHERE candidate_id = :scope` (Recruitment), `WHERE agency_id = :scope`, or `WHERE client_id = :scope` (Project). A request with no valid external scope returns **empty**, never all rows.
3. This works **within** the schema-isolation rule (§3.1): the `auth → recruitment/project` linkage is resolved by the auth layer and passed as context, **not** as a cross-schema join or FK. The module tables already carry the scoping columns (`application.candidate_id`, `application.agency_id`, `project.client_id`); the predicate keys on those.

**Field-level visibility whitelist.** External roles legitimately need *some* company data (an agency reads open postings; a client reads milestone status), so each external role has an explicit **read-whitelist** — not "no company data at all":
- **Agency** → job **posting** public fields only (title, description, location, close date); **never** the internal `job_requisition` (salary band, cost center, approver notes).
- **Client** → milestone name/target-date/status only; **never** budget, cost center, internal task detail, or comments.
- **Candidate** → only their own `application`/`offer` status fields.
Anything not on the whitelist is not serializable to an external token, enforced in the service's DTO layer.

**Enforcement rules:**
- The API Gateway rejects any `audience: "external"` token on internal routes and vice-versa — the two populations cannot cross the boundary even with a valid token.
- External accounts carry **no `bs4EmployeeId`, `legalEntity`, or `department`**; services that resolve org/snapshot data reject external tokens outright.
- Agency and client accounts are **provisioned/invited** by HR/PM (they cannot self-register into a company relationship); a candidate self-registers but is scoped only to their own applications.

```
auth.external_account
  id, email, google_sub, account_type (candidate/agency/client),
  linked_entity_type, linked_entity_id (→ recruitment.agency /
  recruitment.candidate / project.client resolved at the service layer,
  not a cross-schema FK), status, invited_by, created_at, updated_at
```

---

## 5. Module 1: Recruitment

### 5.1 Overview

A full Applicant Tracking System (ATS) supporting internal postings, external job boards, and recruitment agency portals with AI-assisted resume screening.

### 5.2 User Roles

| Role | Access Scope |
|---|---|
| **HR Admin** | Full system — job requisitions, pipeline management, offers, reporting, agency management |
| **Hiring Manager** | Department-scoped — raise requisitions, shortlist candidates, interview feedback, offer approval |
| **Candidate** | **External portal** (see 4.5) — apply, upload documents, track own application status only |
| **Recruitment Agency** | **External portal** (see 4.5) — submit candidates against open requisitions, track own submission status only |

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
- **Edge — approver no longer available:** if a resolved approver has left or been deactivated (per snapshot), the workflow engine re-resolves to their current org-hierarchy replacement, or escalates to skip-level after the configured timeout (§9.2); a requisition never stalls on a dead approver.

#### 5.4.2 Job Posting
- Publish to internal portal, external boards, and/or agency portal simultaneously
- Configurable application form per job type
- Application deadline management
- Auto-close when headcount filled
- **Edge — headcount reduced below filled:** if headcount is lowered below the number of already-accepted offers, the posting stays closed and the system flags the over-hire for HR review rather than silently rescinding offers; reducing headcount never auto-cancels a confirmed hire.

#### 5.4.3 AI-Assisted Resume Screening
- AI parses uploaded resumes against job description requirements
- Generates a **match score** per candidate (0–100)
- Flags missing mandatory qualifications
- Provides reasoning summary for each score
- AI suggestions are **advisory only** — HR/HM makes final shortlist decision
- Pluggable AI provider: OpenAI / Google Gemini / Kimi
- Compliance guardrails apply (see 10.5)

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

**Push reliability (this is the most business-critical write in Recruitment — a person has accepted a job):**
- `POST /employees` to BS4 carries an **idempotency key** derived from `offer_id` (§8.4), so a retry after an ambiguous timeout **cannot create a duplicate employee**.
- `employee_handoff.bs4_push_status` is an explicit state machine: `pending → pushing → pushed | failed → dead_letter`.
- **Candidate is never told "you're hired" contingent on BS4** — acceptance is recorded in the suite immediately; the BS4 write is a downstream integration whose status is tracked separately.
- On `dead_letter`, HR is alerted and the handoff appears on a **reconciliation queue** (mirroring the Directus reconciliation in §7.5.4) for manual recovery; the accepted offer is never lost regardless of BS4 availability.

### 5.5 Recruitment Data Model (schema: `recruitment`)

```
job_requisition
  id, title, department_id (BS4), legal_entity_id, location, headcount,
  salary_band_min, salary_band_max, job_description,
  required_competencies (jsonb), status, created_by, approved_by,
  created_at, updated_at

job_posting
  id, requisition_id, channel (internal/linkedin/indeed/rozee/agency),
  posted_at, closes_at, status, external_posting_id, created_at, updated_at

candidate
  id, first_name, last_name, email, phone, resume_document_id
  (→ common.document), linkedin_url, created_at, updated_at

application
  id, posting_id, candidate_id, agency_id (nullable), source,
  status, ai_score, ai_reasoning, submitted_at, updated_at

agency
  id, name, contact_name, contact_email, contract_start, contract_end,
  fee_percentage, status, created_at, updated_at

stage_template
  id, name, role_level, stages (jsonb — ordered list of stage defs with
  scorecard competencies + weights), is_active, created_at, updated_at

interview_stage
  id, application_id, stage_template_id, stage_order, scheduled_at,
  status, overall_score, created_at, updated_at

interview_panel
  id, interview_stage_id, interviewer_id, created_at

scorecard
  id, interview_stage_id, interviewer_id, competency, rating (1-5),
  weight, comments, submitted_at, created_at, updated_at

offer
  id, application_id, salary, designation, joining_date, status,
  generated_at, sent_at, responded_at, candidate_response,
  created_at, updated_at

ai_screening_log
  id, application_id, provider (openai/gemini/kimi), model,
  prompt_hash, score, reasoning, pii_redacted (bool), created_at

employee_handoff
  id, offer_id, idempotency_key (uuid, unique, derived from offer_id),
  bs4_push_status (pending/pushing/pushed/failed/dead_letter),
  bs4_employee_id, attempt_count, last_attempt_at, error_message,
  pushed_at, onboarding_notification_sent_at, created_at, updated_at
```

**Notes:**
- `stage_template` and `interview_panel` back the configurable pipeline and panel support in 5.4.4 (previously missing).
- `ai_screening_log` feeds the AI Screening Accuracy metric (11.1) and bias audits (10.5).
- Resume files live in object storage; `common.document` holds metadata + virus scan status (see 10.4).

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
| **Quarterly Check-in** | Every 3 months | Progress update + blockers + manager notes (no full 360°, no scoring) |
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
- **Anonymity is fixed by reviewer type, not a per-response toggle:** peer and subordinate feedback is **always** anonymous (stored in `anonymous_feedback_response`); self, manager, and skip-level feedback is **always** attributed (stored in `feedback_response`). This removes the ambiguity of an "optional" flag — the schema, not a UI checkbox, determines anonymity (see 10.3, 6.6).
- Deadline reminders via notification service
- Feedback locked after submission

#### 6.4.3 Scoring & Calibration
- Weighted scoring: self (10%), peers (20%), subordinates (20%), manager (50%)
- Configurable weights per organization/department (stored in `scoring_weight_config`)
- **Weights must sum to exactly 100** — enforced by a check constraint / validation on `scoring_weight_config`; an invalid config cannot be saved.
- **Empty reviewer class (e.g. an individual contributor with no subordinates, or nobody with approved peers):** the missing class's weight is **redistributed proportionally across the remaining classes** so the final score is always out of 100 and is never silently deflated. The redistribution rule is recorded on the score so calibration can see it was applied.
- Calibration session: HR + managers review score distribution
- Bell curve / forced distribution view for calibration (minimum cohort size applies, see 10.3)
- Final calibrated score recorded

#### 6.4.4 Increment & Promotion Recommendations
- System generates structured recommendation report per employee
- Report includes: final score, score trend (vs. prior cycles), peer comparison, suggested increment band
- HR reviews recommendations and **manually applies** changes in BS4
- No auto-push of salary/grade changes — human-in-the-loop required

### 6.5 BS4 Integration

**Pulls from BS4:**
- Employee master (name, designation, department, joining date)
- Org hierarchy (reporting lines for 360° participant resolution and organogram display)
- Manager hierarchy (`manager_id` per employee — used to build the org tree and resolve appraisal managers)
- Salary bands (for increment recommendation context)
- Legal entity assignments

**No auto-push to BS4** — recommendations are generated as reports for HR to act on manually.

### 6.5a Organogram & Appraisal Manager Assignment

> **Full specification:** See [`ORGANOGRAM_REQUIREMENTS.md`](./ORGANOGRAM_REQUIREMENTS.md)

**Purpose:** A dedicated Organogram page (`15-organogram.html`) within the Performance Appraisal module visualises the full organisational hierarchy from BS4 and makes explicit **which manager appraises each employee**.

**Key features:**
- **Tree view** — visual org chart with employee cards showing name, title, department badge, appraisal status dot (green/amber/grey), and score
- **Table view** — flat sortable/filterable table with columns: Employee, Department, Title, Appraisal Manager (from BS4), Appraisal Status, Score
- **Employee detail panel** — slide-in panel showing BS4 data, appraisal manager, appraisal history, direct reports, and links to cycle/feedback pages
- **Assign Appraisal Manager modal** — HR Admin can assign or change who appraises an employee; manager list sourced from `GET /api/v1/bs4/employees?role=manager`
- **Sync from BS4** — on-demand button triggers immediate refresh of `common.employee_snapshot`
- **Filters:** Department, Appraisal Status, Manager, free-text search

**Navigation:** Sidebar → Performance Appraisal → Appraisal → **Organogram** (below Feedback)

**BS4 endpoints used:**

| Endpoint | Purpose |
|---|---|
| `GET /api/v1/bs4/employees` | All employees for org tree |
| `GET /api/v1/bs4/employees?include=manager` | Hierarchy (manager_id per employee) |
| `GET /api/v1/bs4/employees?role=manager` | Manager-only list for assignment picker |

**New DB table:** `appraisal.appraisal_manager_assignment`

| Column | Type | Description |
|---|---|---|
| `id` | UUID PK | |
| `employee_id` | VARCHAR(64) | BS4 employee ID |
| `manager_id` | VARCHAR(64) | BS4 manager employee ID |
| `cycle_id` | UUID FK → `appraisal.cycle` | Which cycle this assignment applies to |
| `effective_from` | DATE | Defaults to today |
| `effective_to` | DATE | NULL = currently active |
| `assigned_by` | UUID FK → `auth.user` | HR Admin who made the assignment |
| `notes` | TEXT | Optional |

**Permissions:**

| Role | View Organogram | Assign Manager | View All Scores |
|---|---|---|---|
| HR Administrator | ✅ | ✅ | ✅ |
| HR Manager | ✅ | ✅ (own dept) | ✅ (own dept) |
| Manager | ✅ (own subtree) | ❌ | ✅ (own reports) |
| Employee | ✅ (own card) | ❌ | ❌ |

### 6.6 Appraisal Data Model (schema: `appraisal`)

```
appraisal_cycle
  id, name, type (quarterly/midyear/annual), start_date, end_date,
  status, created_by, created_at, updated_at

employee_cycle
  id, cycle_id, employee_id (BS4), status, final_score,
  calibrated_score, recommendation_generated, created_at, updated_at

competency_framework
  id, name, description, role_level, department_id (nullable),
  weight, is_active, created_at, updated_at

goal
  id, employee_cycle_id, competency_id (nullable → competency_framework),
  title, description, kpi_metric, target_value, actual_value, weight,
  status, created_at, updated_at

scoring_weight_config
  id, department_id (nullable = org-wide default), cycle_type,
  self_pct, peer_pct, subordinate_pct, manager_pct,
  created_at, updated_at
  -- CHECK (self_pct + peer_pct + subordinate_pct + manager_pct = 100);
  -- empty reviewer classes redistribute proportionally at scoring time (see 6.4.3)

feedback_request
  id, employee_cycle_id, reviewer_id, reviewer_type
  (self/manager/peer/subordinate/skip), status, due_date,
  is_anonymous, created_at, updated_at

feedback_response
  id, feedback_request_id, competency, rating (1-5), comments,
  submitted_at
  -- NON-anonymous responses only (self, manager, skip-level)

anonymous_feedback_response
  id, employee_cycle_id, reviewer_type (peer/subordinate), competency,
  rating (1-5), comments, submitted_date (DAY granularity, not a timestamp)
  -- NO reviewer_id, NO feedback_request_id, NO precise timestamp:
  -- anonymity is schema-enforced and the timing side-channel is closed (see 10.3)

calibration
  id, cycle_id, department_id, facilitated_by, held_at, notes,
  created_at, updated_at

recommendation
  id, employee_cycle_id, final_score, score_trend, suggested_increment_pct,
  suggested_designation_change, generated_at, reviewed_by_hr,
  created_at, updated_at
```

**Notes:**
- `competency_framework` is now a real table — it was referenced by goals and scorecards but had no home.
- `scoring_weight_config` makes the 6.4.3 weights configurable per department as required.
- `anonymous_feedback_response` has **no reviewer linkage by design** — see 10.3.

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
| **Client** | **External portal** (optional, see 4.5) — view own project status and milestones only |

### 7.3 Project Types

| Type | Description | Billing |
|---|---|---|
| **Client Project** | External client deliverables | Billable — tracked against client budget |
| **Internal Project** | IT, process improvement, initiatives | Non-billable — tracked against cost center |
| **Operational Tasks** | Recurring departmental BAU work | Non-billable — tracked for utilization |

### 7.4 Views (User-Switchable)

| View | Route / Page | Description |
|---|---|---|
| **Task List (Table)** | `14-tasks.html` | **Primary task view** — flat table of all tasks across projects; each row expands inline to reveal subtasks as indented child rows; columns: Task Name, Project (linked), Assignees (avatar chips from BS4), Due Date (overdue highlighted), Priority badge, Status badge, Subtask progress bar; supports expand-all / collapse-all; slide-in detail panel on task click |
| **Kanban Board** | `12-kanban.html` | Drag-and-drop cards across status columns (To Do → In Progress → Review → Done); Odoo-style task detail panel |
| **Gantt Chart** | *(planned)* | Timeline view with task dependencies, milestones, and critical path |
| **Calendar View** | *(planned)* | Deadline and milestone calendar with task due dates |

> **Navigation:** The sidebar "Projects" section exposes: Dashboard → All Projects → **Tasks** → Kanban Board → Gantt Chart → Timesheets → Resources. "Tasks" links directly to the Task List table view (`14-tasks.html`).

### 7.5 Core Feature Set

#### 7.5.1 Project Management
- Create projects with: name, type, client (if applicable), start/end dates, budget, description
- Project phases / milestones with target dates
- Project status: Planning → Active → On Hold → Completed → Cancelled
- Project health indicators: On Track / At Risk / Delayed
- Budget tracking (estimated vs. actual hours and cost)

#### 7.5.2 Task Management

**Primary View — Task List Table (`14-tasks.html`):**

Tasks have a dedicated table/list view as the primary navigation destination (sidebar: Projects → Tasks). This is separate from the Kanban board.

| Column | Description |
|---|---|
| **Task Name** | Expandable row trigger; clicking the name opens the slide-in detail panel |
| **Project** | Linked to project detail page; value sourced from BS4 |
| **Assignees** | Avatar chip stack; multi-assignee from BS4 employee list |
| **Due Date** | ISO date; overdue shown in red, due-soon in amber |
| **Priority** | Colour-coded badge: Critical / High / Medium / Low |
| **Status** | Badge: To Do / In Progress / In Review / Done / Blocked |
| **Subtasks** | Mini progress bar + `done/total` count |

**Subtask rows in the table:**
- Each task row has an expand toggle (▶) that reveals its subtasks as indented child rows in the same table
- Subtask rows show the same columns (Project, Assignees, Due Date, Priority, Status) but are visually indented and styled differently
- An "＋ Add subtask" row appears at the bottom of each expanded group
- Expand All / Collapse All controls available in the filter bar
- Subtasks are stored in the same `project.task` table via `parent_task_id` (one level deep enforced)

**Task Form Fields (Odoo-style, inline-editable in slide-in detail panel):**

| Field | Type | Source / Behaviour |
|---|---|---|
| **Name** | Text (required) | Free-text task title; displayed as heading in task detail view |
| **Project** | Linked field (required) | Searchable dropdown — pulls project list from BS4 via `GET /bs4/projects`; clicking the project name navigates to the project detail page |
| **Assignee(s)** | Multi-select people picker | Pulls employee list from BS4 via `GET /bs4/employees` (uses `common.employee_snapshot` cache); supports single or multiple selection; shows avatar + full name; searchable by name or department |
| **Due Date** | Date picker | ISO 8601 date; shown in task table row and Kanban column; overdue tasks highlighted in red |
| **Priority** | Single-select | Critical / High / Medium / Low; colour-coded badge |
| **Status** | Status pill bar (clickable) | To Do / In Progress / In Review / Blocked / Done; drives Kanban column placement |
| **Estimated Hours** | Number | Decimal hours; used for resource utilisation and budget tracking |
| **Description** | Rich text | Markdown-supported; supports @mentions (resolved against BS4 employee list) |
| **Tags** | Multi-select free-text | Stored as JSONB; used for filtering |

**Subtask Support (one level deep):**
- Any task can have child subtasks; subtasks share the same field set except they cannot themselves have subtasks (enforced at app + DB level via `parent_task_id` constraint)
- Subtasks displayed in two places: (1) as expandable inline rows in the Task List table, (2) as a checklist in the "Subtasks" tab of the task detail panel
- Subtask progress rolled up to parent: `(completed subtasks / total subtasks) × 100`
- Subtask count + progress bar shown in the Task List table and on Kanban cards
- Subtasks inherit parent's project; assignee and due date are independently settable per subtask

**Additional task capabilities:**
- Task dependencies (finish-to-start, start-to-start)
- File attachments per task (stored in object storage, scanned by ClamAV — see 10.4)
- Comment thread per task with @mentions (employee list from BS4)
- Activity log: auto-generated timeline of field changes, status transitions, comments
- New Task modal: accessible from Task List page and Kanban board; includes BS4 employee multi-picker and BS4 project picker

#### 7.5.3 Resource Management
- Assign employees (from `common.employee_snapshot`, synced from BS4) to projects and tasks
- Resource utilization view: hours allocated vs. available per employee
- Capacity planning: see team availability across projects

#### 7.5.4 Time Tracking & Directus Sync

**Dual system strategy:**

```
Employee logs hours in new module against specific tasks
         ↓
Time entry stored in project.time_entry (PostgreSQL)
         ↓
Manager approves time entries
         ↓
Approved entries sync to Directus ERP via secured API (idempotent)
         ↓
Directus ERP processes for payroll / client billing
```

- Employees log time directly against tasks via **manual entry** (date + hours + description); no start/stop timer — the user records the entry in whatever way suits them
- Daily/weekly timesheet view
- Manager approval workflow for time entries
- Approved entries sync to Directus ERP (scheduled nightly or event-driven on approval)
- Sync status tracked per entry (pending / synced / failed)

**Sync integrity rules (required):**
- **Idempotency:** every time entry gets a unique `idempotency_key` (UUID) at creation. The key is sent with every sync attempt. **Semantics = key + payload-hash:** if the same key arrives with a *different* payload (client bug re-using a key), Directus **rejects** it rather than overwriting or silently keeping the first — the mismatch is surfaced as a sync error, not swallowed. (This behavior is an assumption on the Directus contract, see §16 / §18.)
- **Edit-after-sync:** an entry in `approved + synced` state is **locked**. Corrections are made as a **reversal entry** (negative-hours adjustment referencing the original), which syncs as a new entry. Payroll always sees an append-only ledger.
- **Reversal preconditions (required to keep the ledger sane):**
  - The original must already be `synced` — **you cannot reverse an entry that never reached Directus.** An unsynced `approved` entry is corrected by fixing it before it syncs, not by a reversal.
  - **A reversal cannot itself be reversed.** To re-correct, void the whole (original + reversal) pair and submit a fresh entry — this bounds correction chains and prevents unbounded ± ladders.
  - If a reversal **itself fails to sync**, it enters the same retry/DLQ/reconciliation path as any entry; the original stays locked and the pair is flagged as an incomplete correction.
- **Reconciliation:** a daily job flags (a) entries in `approved` state with `directus_sync_status != synced` older than 2 days, **and (b) reversal entries whose sync is incomplete**; flagged items appear on the Project dashboard (see 11.3) and trigger an admin alert.

### 7.6 BS4 Integration

**Pulls from BS4 (via `common.employee_snapshot` cache + on-demand fallback):**
- Employee master (for resource assignment)
- Org structure (for project team hierarchy)
- Cost centers (for internal project cost allocation)
- Client data (if maintained in BS4)

**Pushes to Directus ERP:**
- Approved time entries (employee_id, task_id, project_id, hours, date, billable flag, idempotency_key)

### 7.7 Project/Task Data Model (schema: `project`)

```
project
  id, name, type (client/internal/operational), client_id (nullable),
  legal_entity_id, start_date, end_date, budget_hours, budget_amount,
  status, health_status, cost_center_id (BS4), created_by,
  created_at, updated_at

milestone
  id, project_id, name, target_date, completed_at, status,
  created_at, updated_at

task
  id, project_id (FK → project; links to BS4 project via bs4_project_id),
  milestone_id (nullable), parent_task_id (nullable → task),
  title, description, priority (critical/high/medium/low),
  due_date (date), estimated_hours (decimal), actual_hours (decimal),
  status (todo/in_progress/in_review/blocked/done),
  tags (jsonb), created_by, created_at, updated_at
  -- "one level deep" ENFORCED: parent_task_id non-null → cannot be parent
  -- CHECK (parent_task_id IS NULL OR NOT EXISTS (
  --   SELECT 1 FROM task WHERE parent_task_id = task.id))

task_assignee                          -- multi-assignee join table
  id, task_id (FK → task), employee_id (BS4 employee_snapshot.id),
  assigned_at, assigned_by
  -- employee data resolved via common.employee_snapshot (BS4 cache)
  -- UI picker: GET /api/v1/bs4/employees?search=&dept=&active=true

project
  id, name, type (client/internal/operational),
  bs4_project_id (nullable — links to BS4 project record),
  client_id (nullable), legal_entity_id, start_date, end_date,
  budget_hours, budget_amount, status, health_status,
  cost_center_id (BS4), created_by, created_at, updated_at
  -- UI picker: GET /api/v1/bs4/projects?active=true
  -- Clicking project name in task form → navigates to project detail page

task_dependency
  id, task_id, depends_on_task_id, dependency_type
  (finish_to_start | start_to_start), created_at

time_entry
  id, task_id, employee_id (BS4), date, entry_tz_offset (captured at entry,
  see 3.5), hours, description, is_billable,
  status (draft/submitted/approved/rejected),
  approved_by, approved_at, idempotency_key (uuid, unique),
  reversal_of_id (nullable → time_entry), directus_sync_status,
  directus_sync_at, created_at, updated_at

directus_sync_log
  id, time_entry_id, idempotency_key, attempt_count, last_attempt_at,
  status (pending/synced/failed/dead_letter), error_message, created_at

task_comment
  id, task_id, author_id, body, mentions (jsonb), created_at, updated_at

task_attachment
  id, task_id, document_id (→ common.document), uploaded_by, created_at

client
  id, name, contact_name, contact_email, bs4_client_id (nullable),
  created_at, updated_at
```

**Notes:**
- `directus_sync_log` + `idempotency_key` implement the retry/DLQ/reconciliation behavior (7.5.4, 8.4).
- Attachments reference `common.document` (object-storage metadata + scan status) instead of a raw URL.

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

- API Key per service (Auth, Recruitment, Appraisal, Project)
- Keys stored in the **cloud provider's secrets manager** (GCP Secret Manager / AWS Secrets Manager / Azure Key Vault / HashiCorp Vault) — never hardcoded
- Keys rotated periodically (quarterly minimum)
- Each key has defined scopes (read-only vs. read-write)

### 8.3 Data Contracts

#### Inbound (BS4 → New App)

| Endpoint | Data | Consumer |
|---|---|---|
| `GET /employees` | Employee master list | Nightly sync → `common.employee_snapshot` |
| `GET /employees/{id}` | Single employee detail | All services (cache fallback) |
| `GET /org-hierarchy` | Reporting lines tree | Appraisal, Project (via snapshot) |
| `GET /departments` | Department list | All modules (via snapshot) |
| `GET /cost-centers` | Cost center list | Project (via snapshot) |
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
| `POST /time-entries/bulk` | Approved time entries + idempotency keys | Project |

### 8.4 Error Handling

- Retry logic: 3 attempts with exponential backoff for transient failures
- **Idempotency keys on all mutating outbound calls** — time entries (`time_entry.idempotency_key`, §7.5.4) **and** new-hire push (`employee_handoff.idempotency_key` derived from `offer_id`, §5.4.6) — retries are always safe
- Dead letter queue for failed operations: `directus_sync_log.status = dead_letter` (time sync) and `employee_handoff.bs4_push_status = dead_letter` (hire push); both surface on a reconciliation queue for manual recovery
- Alert notification to admin on repeated failures (channel + threshold defined per job in §8.6)
- All integration calls logged with request/response for audit

### 8.5 Employee Snapshot (Resilience Cache)

To remove BS4 as a runtime single point of failure:

```
common.employee_snapshot
  bs4_employee_id (PK), full_name, email, designation, department_id,
  reporting_to, legal_entity_id, cost_center_id, status,
  synced_at
```

- **One-time initial backfill** (Phase 1): a full pull of all employees, departments, cost centers, and org hierarchy from BS4 seeds `common.employee_snapshot` before any module goes live. The nightly delta job only maintains it thereafter.
- **Nightly delta sync job** (a scheduled cron runner → Auth Service) pulls changed employees, departments, cost centers, and org hierarchy from BS4
- Services read employee/org data from the snapshot; on-demand BS4 pull only as fallback for records missing or stale (> 24h)
- Login never depends on BS4 availability (see 4.3)

### 8.6 Scheduled Jobs — Ownership & Failure Handling

Every recurring/background process has a named owner, trigger, failure behavior, and monitoring signal — none run "somewhere, somehow."

| Job | Owner service | Trigger | On failure |
|---|---|---|---|
| Employee snapshot delta sync | Auth Service | Nightly cron | Alert if a run fails or last-success > 26 h (stale snapshot → stale roles); retries next cycle |
| Directus time-entry sync | Project Service | On approval + nightly sweep | Retry/backoff → DLQ → reconciliation queue (§7.5.4) |
| Directus reconciliation | Project Service | Daily | Admin alert; surfaces on Project dashboard (§11.3) |
| BS4 hire-push | Recruitment Service | On offer-accept + start-date | Retry/backoff → `dead_letter` → HR reconciliation queue (§5.4.6) |
| Retention purge (rejected-candidate resumes @ 12 mo) | Recruitment Service | Daily | Alert on failure; nothing is purged silently — purge actions are audited (§10.2) |
| AI bias report | AI Service | Quarterly | Report generation failure alerts HR; prior report retained (§10.5) |
| BS4 API key rotation | Ops / Auth Service | Quarterly | Rotation failure blocks nothing immediately but raises a high-priority ops alert (§8.2) |

---

## 9. Notifications & Workflow Engine

The **Notification & Workflow Service** (:3004, schema `notification`) owns all notification delivery **and** approval workflow state. Module services call it via REST — no module implements its own approval plumbing.

### 9.1 Notification Channels

| Channel | Delivery | Use Cases |
|---|---|---|
| **In-App** | WebSocket / SSE (real-time) | Task assignments, approvals pending, feedback requests, mentions |
| **Email** | SMTP / SendGrid | Interview invites, offer letters, appraisal cycle start, deadline reminders |

> Deployment note: the service keeps **≥ 1 warm instance** (no scale-to-zero) so WebSocket/SSE connections are not dropped.

**Real-time connection design (resolves the gateway/WebSocket question in §3.3):**
- **Connection path:** the browser opens the socket **directly to the Notification & Workflow Service** (not proxied through the HTTP gateway, which handles request/response traffic only). The gateway remains HTTP-only; this removes the contradiction of routing long-lived sockets through a request-oriented proxy.
- **Auth handshake:** the client obtains a **short-lived single-use WebSocket ticket** from an authenticated HTTP endpoint (validated like any `/api/v1` call), then presents that ticket to open the socket. The socket is **not** authenticated by the 15-min access token directly.
- **Token expiry mid-connection:** the client **re-authenticates the live socket** on each access-token refresh (sends a fresh ticket over the open channel); a socket that fails to re-auth within a grace window is closed and the client reconnects. So "minute 16" does not silently keep an unauthorized socket open.
- **Multi-instance fan-out:** with `≥ 1` and potentially many warm instances, a user's socket may land on any instance. A **pub/sub backplane (e.g. Redis)** fans events out to whichever instance holds the connection — no sticky-session requirement, no missed notifications across instances.
- **Rate limiting:** connection-rate and message-rate limits are applied at the socket layer (distinct from the gateway's per-user/IP HTTP limits, §3.3).

### 9.2 Approval Routing Engine

The workflow engine resolves approvers dynamically from the org hierarchy (`common.employee_snapshot`):

```
Trigger Event (from any module service)
    ↓
Workflow Rule Engine (Notification & Workflow Service)
    ↓
Resolve Approvers (org hierarchy from common.employee_snapshot)
    ↓
Create Approval Task in notification.approval_task
    ↓
Notify Approver (Email + In-App)
    ↓
Approver Decision:
  ├── Approve → Next stage or complete (callback to originating module)
  ├── Reject  → Notify requester with comments
  └── Timeout → Escalate to skip-level approver (timeout per workflow_rule)
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

All notification templates are configurable by HR Admin (stored in `notification.notification_template`):
- Subject line
- Body (HTML email / plain text in-app)
- Dynamic variables: `{{employee_name}}`, `{{job_title}}`, `{{deadline}}`, etc.
- Multi-language support (configurable)

### 9.5 Notification & Workflow Data Model (schema: `notification`)

```
notification_template
  id, module, event_type, channel (email/in_app), language,
  subject, body, variables (jsonb), is_active, created_at, updated_at

notification
  id, recipient_id, template_id (nullable), channel, payload (jsonb),
  status (pending/sent/failed/dead_letter/read), attempt_count,
  last_attempt_at, sent_at, read_at, created_at

workflow_rule
  id, module, trigger_event, step_order, approver_resolution
  (department_head/skip_level/finance/hr_director/specific_role),
  condition (jsonb, e.g. {"salary_above_band": true}),
  timeout_hours, escalate_to, is_active, created_at, updated_at

approval_task
  id, module, entity_type, entity_id, workflow_rule_id, step_order,
  approver_id, status (pending/approved/rejected/escalated/expired),
  due_at, decided_at, decision_comments, created_at, updated_at
```

**Delivery reliability (email).** Transactional emails (offer letters, interview invites, deadline reminders) are **not fire-and-forget**: a `failed` send is retried with backoff, and after exhausting retries moves to `dead_letter` with an admin alert — a dropped offer-letter email never sits silently unseen. In-app notifications degrade gracefully (delivered on next connect via the backplane, §9.1).

---

## 10. Security & Compliance

### 10.1 Audit Trail

HR data changes must be fully auditable. Requirements:

- Every mutating API call is logged: actor, action, entity, before/after values, timestamp, correlation ID
- **Explicitly audited events:** score/rating changes, calibration adjustments, offer creation/approval/modification, salary recommendation views and edits, time entry approvals and reversals, and **file-download URL issuance** for resumes/attachments (the enforceable audit point — see 10.4)
- Audit log is append-only, retained per company policy (minimum 7 years for payroll-adjacent records), queryable by HR Admin
- Implementation: shared `audit_log` middleware writing to an append-only table per schema (or a single `common.audit_log`)

### 10.2 PII & Data Protection

- Resumes, appraisal data, and salary recommendations are classified **sensitive PII**
- Data retention policy defined per record type (e.g., rejected-candidate resumes purged after 12 months unless consent extended)
- Access to salary-band and recommendation data restricted to HR Admin role only (enforced at service level, not just UI)
- Verify obligations under applicable data-protection law (operations indicated in Pakistan; GDPR if any EU candidates/employees are processed)
- Database encryption at rest (managed PostgreSQL default on any provider) and TLS in transit everywhere

### 10.3 Anonymous Feedback Integrity

- Anonymous peer/subordinate responses are stored in `appraisal.anonymous_feedback_response` with **no reviewer identity column and no link to `feedback_request`** — anonymity is enforced by the schema, not by hiding columns in the UI
- Results are only shown to the reviewed employee in aggregated form with a **minimum of 3 responses per reviewer type** (raised from 2 — two responses in a small peer set is trivially de-anonymized); below the threshold, results are withheld as "insufficient responses"
- **Timing side-channel is closed:** the anonymous row stores only a **coarse submission date (day granularity), not a precise timestamp**, and carries no `feedback_request_id`. The correlation attack via the `notification` layer (which does hold `recipient_id` + `read_at`, §9.5) is explicitly mitigated — notification delivery/read records for feedback requests are **not joinable** to anonymous responses, and anonymous submissions are written on a decoupled path so ordering cannot be aligned with request delivery.
- Calibration bell-curve views require a minimum cohort size (e.g., 8 employees) to prevent reverse-engineering individual scores

### 10.4 File Storage & Malware Scanning

- All uploaded files (resumes, task attachments, offer letters) stored in **S3-compatible object storage**; metadata in `common.document`:

```
common.document
  id, module, owner_entity_type, owner_entity_id, filename,
  content_type, size_bytes, storage_path (bucket key), scan_status
  (pending/clean/infected), scan_engine, scanned_at,
  uploaded_by, created_at, updated_at
```

- **ClamAV** (`clamd`) runs as a container in the compose/container environment; every upload is scanned before `scan_status = clean`
- `infected` files are quarantined (a bucket with no public access bindings), uploader and admin are notified, file is never served
- Downloads go **through the web application only**: the service validates the user's permission, then issues a **pre-signed URL with a short, explicit TTL of ≤ 60 seconds**, minimally scoped to a single object (GET only). No publicly readable object URLs anywhere.
- **A pre-signed URL is a bearer credential** — anyone holding it can fetch the object until it expires. The short TTL bounds the leakage window; the URL is never logged or embedded in a shareable location.
- **Audit reconciliation (important):** because the actual object fetch goes **directly to object storage and bypasses the app**, the auditable event is the **URL-issuance** — the app logs *"user X was granted a download URL for object Y at time T"* (§10.1). That is the accurate, enforceable audit record; the §10.1 "file downloads" requirement is satisfied by logging issuance, not the storage-side GET. (Object-storage server access logs, if enabled, are a secondary control.)

### 10.5 AI Screening Guardrails

- AI scores are **advisory only**; the UI never allows auto-rejection on AI score alone
- **PII redaction option** (configurable per provider): name/email/phone stripped from resume text before sending to the AI provider; `ai_screening_log.pii_redacted` records which mode was used
- Use provider API tiers with **no training on customer data** / zero-retention; a data-processing agreement per enabled provider is required before production use
- **Bias monitoring:** quarterly report from `ai_screening_log` vs. actual shortlist/hire outcomes, checking for adverse impact across source channels and demographics where lawfully recorded
- `ai_screening_log` keeps provider, model, prompt hash, score, and reasoning for every call — full auditability of AI decisions

### 10.6 Availability, Backup & DR

| Area | Target |
|---|---|
| Database backups | Managed PostgreSQL automated daily backups + point-in-time recovery (PITR) |
| RPO | ≤ 24 hours (PITR window) |
| RTO | ≤ 4 hours (redeploy containers + restore managed PostgreSQL) |
| Service availability | Multi-instance container runtime; notification service keeps ≥ 1 warm instance for WebSocket/SSE |
| Secrets | Cloud secrets manager only; quarterly rotation |
| Dependency failure | BS4 down → login unaffected (Google SSO + snapshot cache); Directus down → sync queues and retries, no data loss |

### 10.7 Right to Erasure (GDPR)

Where a data subject (typically a candidate or external user) exercises the right to erasure:

- A **single erasure workflow**, triggered by HR Admin, locates all records for the subject across every schema (`recruitment`, `common.document`, external `auth.external_account`, etc.) and the object-storage files, using the subject's identity keys.
- Personal data is **deleted or irreversibly anonymized** (name/email/phone/resume removed; a non-identifying tombstone kept only where a foreign key must survive).
- Object-storage files (resumes, attachments) are deleted from the bucket; the `common.document` row is anonymized.
- **The append-only `audit_log` is exempt** — it retains the *fact* that an action occurred (actor, action, timestamp) under legitimate-interest/legal-obligation grounds, but PII payloads in before/after snapshots are redacted so the audit trail cannot be used to reconstruct erased data.
- Every erasure is itself an audited event (who requested, who executed, when, what scope).
- **Scope is limited to data the suite controls, and the employee case differs from the candidate case:**
  - **Candidates / external users** — fully erasable within the suite (no downstream payroll copy).
  - **Employees** — erasure collides with the **7-year payroll-adjacent retention** requirement (§10.1) and with **append-only time entries already pushed to Directus** (payroll). Payroll-adjacent records are retained under a **lawful-basis / legal-obligation exemption**, not erased on request; only non-payroll PII the suite controls is erased/anonymized.
  - **Downstream ERPs (BS4, Directus)** hold their own copies that this suite does **not** control. Erasure there is a **separate process owned by those systems**; the suite's workflow explicitly states it cannot and does not erase downstream ERP data, and hands off an erasure request reference for the ERP teams to action.

---

## 11. Reporting & Analytics

**Decision: reporting is independent per module.** Each dashboard queries only its own schema — no cross-module queries. If cross-module executive reports are needed later, introduce a separate reporting store (nightly ETL) as its own phase; it is **out of scope** for the initial build.

> **These dashboards are operational metrics, by design — not product-level success targets.** As an internal tool, success is defined operationally (adoption + the metrics below), and setting numeric targets is a business decision for the pilot owners, deferred to the architecture/rollout phase (§18). Two guardrail counter-metrics are called out so metrics aren't gamed: **Time-to-Hire** is watched alongside **90-day new-hire retention / hiring-manager satisfaction** (so speed isn't bought by lowering the bar), and **Review Completion Rate** alongside **feedback quality flags** (so completion isn't bought with rubber-stamp reviews).

### 11.1 Recruitment Dashboard

| Metric | Description |
|---|---|
| Open Positions | Count by department, location, seniority |
| Pipeline Funnel | Applied → Screened → Interviewed → Offered → Hired |
| Time-to-Hire | Average days from requisition to offer acceptance |
| Source Effectiveness | Hire rate by channel (internal/LinkedIn/Indeed/agency) |
| Agency Performance | Submissions, shortlists, hires, cost per hire per agency |
| AI Screening Accuracy | AI score vs. final hire decision correlation (from `ai_screening_log`) |

### 11.2 Performance Appraisal Dashboard

| Metric | Description |
|---|---|
| Review Completion Rate | % of employees with completed reviews by department |
| Score Distribution | Bell curve / histogram of final scores (min cohort size, see 10.3) |
| Goal Achievement Rate | % of goals met/exceeded vs. missed |
| 360° Participation Rate | % of feedback requests responded to |
| Increment Pipeline | Employees by recommended increment band |
| Score Trend | Year-over-year score movement per employee/department |

### 11.3 Project & Task Management Dashboard

| Metric | Description |
|---|---|
| Project Health | Count by On Track / At Risk / Delayed |
| Resource Utilization | Hours allocated vs. available per employee |
| Burn Rate | Hours logged vs. estimated per project |
| Milestone Completion | On-time vs. delayed milestones |
| Billable vs. Non-Billable | Hours breakdown by project type |
| Time Entry Sync Status | Pending / synced / failed entries to Directus ERP, incl. reconciliation flags (> 2 days unsynced) |

---

## 12. Project Structure

```
hr-suite/
├── frontend/
│   ├── hr-suite-app/              ← INTERNAL Angular app (latest Angular + TypeScript)
│   │   ├── src/
│   │   │   ├── app/
│   │   │   │   ├── core/          ← Internal Google SSO login, token mgmt, guards, interceptors
│   │   │   │   ├── shared/        ← Shared models, UI components, pipes, directives
│   │   │   │   └── features/
│   │   │   │       ├── recruitment/    ← lazy-loaded: requisitions, postings,
│   │   │   │       │                   applications, interviews, offers, agencies, reports
│   │   │   │       ├── appraisal/      ← lazy-loaded: cycles, goals, feedback,
│   │   │   │       │                   calibration, recommendations, reports
│   │   │   │       └── project-mgmt/   ← lazy-loaded: projects, tasks, kanban,
│   │   │   │                           gantt, time-tracking, resources, reports
│   │   │   └── environments/
│   │   └── package.json
│   │
│   └── external-portal-app/       ← SEPARATE Angular app for external users (see 4.5)
│       ├── src/app/               ← External Google OAuth login; candidate apply/track,
│       │                            agency submissions, client status — NO company data
│       └── package.json
│
├── backend/
│   ├── api-gateway/              ← Express — routing, JWT validation, rate limiting :8080
│   │   ├── src/
│   │   │   ├── routes/
│   │   │   └── proxy/
│   │   └── package.json
│   │
│   ├── auth-service/             ← Express — Google SSO verify, JWT issue/refresh, :3000
│   │   ├── src/
│   │   │   ├── routes/
│   │   │   ├── middleware/
│   │   │   ├── services/
│   │   │   ├── jobs/             ← Nightly BS4 employee snapshot delta sync
│   │   │   └── bs4-client/
│   │   └── package.json
│   │
│   ├── recruitment-service/      ← Express — ATS, pipeline, offers :3001
│   │   ├── src/
│   │   │   ├── routes/
│   │   │   ├── controllers/
│   │   │   ├── services/
│   │   │   ├── models/
│   │   │   └── integrations/     ← Job board adapters
│   │   └── package.json
│   │
│   ├── appraisal-service/        ← Express — 360°, cycles, calibration :3002
│   │   ├── src/
│   │   │   ├── routes/
│   │   │   ├── controllers/
│   │   │   ├── services/
│   │   │   └── models/
│   │   └── package.json
│   │
│   ├── project-service/          ← Express — projects, tasks, time entries :3003
│   │   ├── src/
│   │   │   ├── routes/
│   │   │   ├── controllers/
│   │   │   ├── services/
│   │   │   ├── models/
│   │   │   └── sync/             ← Directus ERP sync (idempotent + reconciliation)
│   │   └── package.json
│   │
│   ├── notification-service/     ← Express — notifications + WORKFLOW ENGINE :3004
│   │   ├── src/
│   │   │   ├── routes/
│   │   │   ├── templates/        ← Email HTML templates
│   │   │   ├── services/
│   │   │   │   ├── email.service.ts
│   │   │   │   ├── websocket.service.ts
│   │   │   │   └── workflow.service.ts   ← Approval routing engine
│   │   │   └── models/
│   │   └── package.json
│   │
│   ├── ai-service/               ← Express — pluggable AI provider adapter :3005
│   │   ├── src/
│   │   │   ├── routes/
│   │   │   ├── adapters/
│   │   │   │   ├── openai.adapter.ts
│   │   │   │   ├── gemini.adapter.ts
│   │   │   │   └── kimi.adapter.ts
│   │   │   └── services/
│   │   │       ├── resume-screener.service.ts
│   │   │       └── pii-redactor.service.ts
│   │   └── package.json
│   │
│   └── shared/                   ← npm workspaces internal package (versioned —
│       ├── middleware/               changes require version bump + all services
│       │   ├── auth.middleware.ts    upgrade in the same sprint; no drift)
│       │   ├── rbac.middleware.ts
│       │   ├── audit.middleware.ts
│       │   └── logger.middleware.ts
│       ├── bs4-client/           ← BS4 ERP HTTP client with retry logic
│       ├── directus-client/      ← Directus ERP HTTP client (idempotency keys)
│       └── utils/
│
├── database/                     ← ONE database: hr_suite_db
│   ├── migrations/
│   │   ├── auth/                 ← Numbered SQL files per schema
│   │   ├── common/               ← employee_snapshot, document, audit_log
│   │   ├── recruitment/
│   │   ├── appraisal/
│   │   ├── project/
│   │   └── notification/
│   └── seeds/
│
└── infrastructure/
    ├── deploy/                  ← Cloud-agnostic IaC (per target: Cloud Run / ECS / AKS / k8s)
    │   ├── runtime/             ← Container service definitions per service
    │   ├── database/            ← ONE managed PostgreSQL instance config
    │   └── secrets/             ← Secrets-manager key references (provider-neutral)
    └── docker/
        ├── Dockerfile.gateway
        ├── Dockerfile.auth
        ├── Dockerfile.recruitment
        ├── Dockerfile.appraisal
        ├── Dockerfile.project
        ├── Dockerfile.notification
        ├── Dockerfile.ai
        └── docker-compose.yml    ← Local dev: all services + postgres + clamd
```

---

## 13. Next Steps

### Phase 1 — Foundation (Weeks 1–4)
- [ ] Finalize BS4 API contract with BS4 team (endpoint specs, auth tokens, rate limits)
- [ ] **Submit LinkedIn/Indeed partner API applications and verify Rozee.pk API availability** — approval can take weeks; integration ships in Phase 5 but the paperwork starts now
- [ ] Provision cloud infra on the chosen provider: container runtime, **one** managed PostgreSQL instance, secrets manager, object-storage buckets
- [ ] Scaffold monorepo: Angular app + Node.js services (npm workspaces)
- [ ] Implement Auth Service (Google SSO + JWT + refresh) with **both auth tracks** — internal (hosted-domain) and external portal (public Google, `auth.external_account`, see 4.5) — and Angular core module (login, guards, interceptors)
- [ ] Implement **minimal Notification & Workflow Service** (email channel, templates, approval_task/workflow_rule, approval callbacks) — required by every later phase
- [ ] Database migrations for all schemas (`auth`, `common`, `recruitment`, `appraisal`, `project`, `notification`)
- [ ] **One-time initial BS4 backfill** of employee/org/cost-center data into `common.employee_snapshot`, then the nightly delta sync job
- [ ] **Seed data** (prerequisite for the very first requisition/appraisal/approval to function): RBAC role/permission definitions, default `workflow_rule` set per module, default `notification_template` set, competency frameworks, and `scoring_weight_config` defaults — populate `database/seeds/`
- [ ] Object-storage buckets + ClamAV (clamd) container with upload-scan pipeline
- [ ] CI gate (migrate + build + lint + unit/integration) and contract-test harness for the BS4/Directus adapters (see 3.7)

### Phase 2 — Recruitment Module (Weeks 5–12)
- [ ] Job Requisition + Approval workflow
- [ ] Job Posting (internal + agency portal)
- [ ] Candidate application intake via external portal (with resume upload → scan → object storage)
- [ ] AI resume screening integration (pluggable adapter + PII redaction)
- [ ] Multi-stage interview pipeline + scorecards
- [ ] Offer management + BS4 hire push
- [ ] Recruitment dashboard

### Phase 3 — Performance Appraisal Module (Weeks 13–20)
- [ ] Appraisal cycle management
- [ ] Competency framework + goal setting + approval
- [ ] 360° feedback collection (all reviewer types, schema-enforced anonymity)
- [ ] Scoring + calibration
- [ ] Increment/promotion recommendation reports
- [ ] Appraisal dashboard

### Phase 4 — Project & Task Management Module (Weeks 21–30)
- [ ] Project + milestone management
- [ ] Task management (all CRUD)
- [ ] Kanban, Gantt, List, Calendar views
- [ ] Time tracking + manager approval
- [ ] Directus ERP time entry sync (idempotent + reconciliation report)
- [ ] Resource utilization view
- [ ] Project dashboard

### Phase 5 — Cross-Cutting & Launch (Weeks 31–36)
- [ ] In-app notification channel (WebSocket/SSE) on the existing Notification & Workflow Service
- [ ] External job board integrations (LinkedIn, Indeed, Rozee.pk) — using Phase 1 API approvals; **manual-posting fallback ships regardless** so a delayed/denied board approval (a real schedule risk, §18) never blocks launch of that sourcing channel
- [ ] Security audit (incl. audit-trail verification) + performance testing
- [ ] Backup/DR restore drill
- [ ] UAT with HR team, hiring managers, and pilot users
- [ ] Production deployment on the selected cloud

---

## 14. Confirmed Decisions — Master Reference

| Category | Decision |
|---|---|
| **Frontend** | One Angular app (latest) + TypeScript + CSS; lazy-loaded feature modules per HR module |
| **Backend** | Node.js + Express.js (service per module + API gateway + auth + notification/workflow + AI) |
| **API Gateway** | Express-based gateway service (JWT validation, rate limiting, routing) |
| **Database** | **Single PostgreSQL database** `hr_suite_db`, schema-per-module (`auth`, `common`, `recruitment`, `appraisal`, `project`, `notification`) |
| **API Protocol** | JSON over HTTP/HTTPS (REST); URL-path versioning (`/api/v1/...`) |
| **AI Provider** | Pluggable adapter — OpenAI / Google Gemini / Kimi; advisory-only with PII redaction + bias monitoring |
| **Auth — Internal** | Google OAuth 2.0 (company Workspace, same identity as BS4/Directus) + JWT SSO; BS4 profile/role sync with snapshot cache — login works when BS4 is down |
| **Auth — External** | Separate portal + separate Google OAuth app (any Google account) for candidates/agencies/clients; `auth.external_account`, minimal JWT, **no company data access** (see 4.5) |
| **Timezone** | Store all timestamps UTC; display in user's auto-detected local timezone; time entries recorded against user's local calendar day (see 3.5) |
| **File Storage** | S3-compatible object storage (GCS/S3/Azure Blob); downloads via web app with authz + pre-signed URLs; ClamAV scan on every upload |
| **Notifications** | Email (SMTP/SendGrid) + In-App (WebSocket/SSE); built in Phase 1–2 (minimal), in-app channel completed in Phase 5 |
| **Workflows** | Approval routing engine owned by Notification & Workflow Service; approver resolution from org hierarchy snapshot |
| **Reporting** | Independent per-module dashboards; no cross-module queries in initial build |
| **Deployment** | **Cloud-agnostic** — Docker containers on any suitable cloud (managed container runtime + one managed PostgreSQL + object storage + secrets manager) |
| **Compliance** | Append-only audit trail; GDPR right-to-erasure workflow across schemas + object storage (audit log exempt/redacted, see 10.7) |
| **Recruitment — Sourcing** | Internal + External boards (LinkedIn/Indeed/Rozee) + Agencies |
| **Recruitment — Roles** | HR Admin, Hiring Manager, Candidate, Agency |
| **Recruitment — BS4 Hire** | Auto-push core fields + HR onboarding notification |
| **Recruitment — Pipeline** | Multi-stage configurable pipeline (per-job stage templates) + AI resume screening + weighted scorecards |
| **Appraisal — Methodology** | 360° feedback + Quarterly / Mid-Year / Annual cycles |
| **Appraisal — Anonymity** | Schema-enforced (no reviewer linkage for anonymous responses) |
| **Appraisal — BS4 Push** | Partial — recommendations only, HR applies manually in BS4 |
| **Project — Types** | Client + Internal + Operational tasks |
| **Project — Time Tracking** | Dual system — new module + idempotent sync to Directus ERP; locked after sync, corrections via reversal entries |
| **Project — Views** | Kanban + Gantt + List + Calendar (user-switchable) |

---

## 15. Non-Goals

Consolidates exclusions that were previously scattered inline or left to inference. These are **explicitly out of scope** for the initial build (some are deferred to named phases; some are simply not planned):

| # | Non-Goal | Note |
|---|---|---|
| NG-1 | Cross-module executive reporting / shared analytics store | Deferred to a later ETL phase (§11) |
| NG-2 | Auto-push of salary/grade/promotion changes to BS4 | Recommendations only; HR applies manually (§6.5) |
| NG-3 | Start/stop time **timers** | Manual time entry only (§7.5.4) |
| NG-4 | Task nesting beyond **one level** of subtasks | Enforced (§7.5.2) |
| NG-5 | Gantt critical-path automation / advanced scheduling | Views exist; auto-scheduling is not in scope |
| NG-6 | **Mobile / native apps** | Responsive web only; native mobile not planned |
| NG-7 | **Offline mode** | Online-only |
| NG-8 | Bulk data import/export beyond the one-time BS4 backfill | Not planned |
| NG-9 | Formal end-user **SLA / support model** | Internal tool; ops posture only (§3.6) |
| NG-10 | Full i18n | Only notification templates are multi-language (§9.4); UI i18n not in scope |
| NG-11 | Running parity across all four clouds | One target validated; others portable-but-unvalidated (§1) |
| NG-12 | Observability platform | Deferred; correlation IDs + `/health` + failure alerts only (§3.6) |
| NG-13 | Numeric performance/scale targets in this doc | Deferred to architecture (§3.8) |

## 16. Assumptions

Inferences this document rests on that are **not yet confirmed** — each must be validated before the dependent work is built. Tagged so the BS4/Directus/board contract reviews have a checklist.

- **[ASSUMPTION A-1]** BS4 exposes the seven inbound GET endpoints in §8.3 with the fields listed (employee, org-hierarchy, departments, cost-centers, salary-bands, legal-entities). *Validate in the BS4 API contract (§18).*
- **[ASSUMPTION A-2]** BS4 accepts `POST /employees` and `POST /notifications` and honors an **idempotency key** (so retries don't duplicate a new hire). *Validate in the BS4 contract.*
- **[ASSUMPTION A-3]** Directus accepts `POST /time-entries/bulk`, **deduplicates on the idempotency key**, and **rejects a key-reuse with a different payload** (§7.5.4). *Validate in the Directus contract.*
- **[ASSUMPTION A-4]** LinkedIn, Indeed, and Rozee.pk offer usable posting APIs under terms we can meet. *Rozee.pk API existence is itself unverified (§18).*
- **[ASSUMPTION A-5]** The company Google Workspace supports hosted-domain-restricted OAuth for the internal track (§4.1).
- **[ASSUMPTION A-6]** BS4 remains the sole source of truth for employee/org data; the suite never becomes the master for those records.
- **[ASSUMPTION A-7]** A managed Redis (or equivalent) is available on the chosen cloud for the WebSocket backplane (§9.1).

## 17. Glossary

Canonical definitions of the recurring domain nouns (removes the surface-form drift noted in review: "Notification & Workflow Service", "Hiring Manager/HM", etc.).

| Term | Definition |
|---|---|
| **Requisition** | An approved request to hire for a role; parent of postings and applications (§5.4.1) |
| **Posting** | A published instance of a requisition on a channel (internal/board/agency) (§5.4.2) |
| **Application** | A candidate's submission against a posting; carries pipeline stage + AI score (§5.5) |
| **Stage** | One step of a job's interview pipeline, defined by a stage template (§5.4.4) |
| **Scorecard** | A weighted competency rating submitted by an interviewer for a stage (§5.5) |
| **Cycle** | An appraisal round (quarterly / mid-year / annual) enrolling a set of employees (§6.3) |
| **Calibration** | HR+manager session normalizing scores across a cohort (§6.4.3) |
| **Cohort** | The group of employees compared in a calibration/bell-curve view (min size applies) (§10.3) |
| **Snapshot** | `common.employee_snapshot`, the local cache of BS4 employee/org data (§8.5) |
| **Reversal entry** | A negative-hours append-only correction to a synced time entry (§7.5.4) |
| **Idempotency key** | A unique per-record token making outbound sync retries safe (§7.5.4, §8.4) |
| **Handoff** | The BS4 new-hire push record + onboarding notification (`employee_handoff`) (§5.4.6) |
| **Approval task** | A single approver's pending decision in a workflow (`approval_task`) (§9.5) |
| **Notification & Workflow Service** | The single service (:3004) owning notification delivery **and** approval routing. Referred to only by this full name (not "Notification Service" or "workflow engine"). |
| **Internal / External user** | Internal = company-Workspace staff; External = candidate/agency/client on the separate portal (§4.5) |

## 18. Open Questions & Risks

Unresolved items with owners — collected here instead of buried as task checkboxes.

| # | Open question / risk | Owner | Blocks |
|---|---|---|---|
| OQ-1 | BS4 API contract not finalized (endpoints, auth, rate limits, idempotency support) | Eng + BS4 team | Confirms A-1/A-2; all BS4 integration |
| OQ-2 | Does Rozee.pk expose a usable posting API? (existence unverified) | Recruitment lead | A-4; Phase-5 board integration |
| OQ-3 | LinkedIn/Indeed partner-API approval timeline (weeks; may be denied) | Recruitment lead | Phase-5 sourcing (manual fallback mitigates, §13) |
| OQ-4 | Directus dedup/rejection semantics on idempotency key | Eng + Directus team | Confirms A-3; time-entry sync integrity |
| OQ-5 | Numeric scale/concurrency/data-volume targets → validate the single-DB decision | Architecture team | §3.8; single-DB sign-off |
| OQ-6 | Which single cloud is the primary launch target? | Architecture + Ops | §1; deployment build |
| OQ-7 | Data-processing agreement (zero-retention) per enabled AI provider | Legal + Eng | §10.5; AI screening in production |
| OQ-8 | Applicable data-protection obligations (Pakistan ops; GDPR if EU subjects) | Legal | §10.2 / §10.7 scope |
| OQ-9 | Observability platform choice + when it lands (currently deferred) | Ops | §3.6; production readiness |

---

*Document maintained by: Engineering Team*  
*Version: 1.3 · Last updated: 2026-07-30*  
*Next review: After BS4 API contract finalization (OQ-1) and primary-cloud selection (OQ-6)*
