# HR Suite — MVP Sprint Plan

**Version:** 1.1
**Date:** 2026-07-30
**Companion to:** `HR_SUITE_REQUIREMENTS.md` (v1.3)

> **v1.1 change (capacity correction):** realistic throughput re-baselined to 12–14 pts/sprint (the old 15–18 band double-counted the buffer); per-sprint totals now shown against that ceiling — every sprint is over, so the true timeline is ~9–10 one-week sprints, not 7. Sequencing, DoD, and story content unchanged in this revision.
**Goal:** Ship a **Minimum Viable Product** — the shared foundation plus a **thin, happy-path vertical slice of all three modules** (Recruitment, Appraisal, Project) — that real internal users can log into and use end-to-end.

---

## 1. MVP Definition

> A single internal Angular app where a staff user signs in with company Google, and can walk the **core happy path** of each module. No external portal, no AI, no live ERP integrations (mocked behind adapters), no advanced views.

### In scope (v1)
- Internal Google SSO login + JWT + route guards (one user population only)
- Single PostgreSQL DB, schema-per-module, migrations
- Express API gateway + shared middleware (auth, RBAC, audit, logger)
- Minimal Notification & Workflow Service (email + one approval flow per module)
- BS4 employee/org data via **mock adapter** seeded into `common.employee_snapshot`
- **Recruitment:** requisition → internal posting → application intake (resume upload) → manual pipeline stages → offer record
- **Appraisal:** cycle → goals → self + manager feedback → simple weighted score → view
- **Project:** project → tasks → Kanban + List views → manual time entry → manager approval
- One minimal read-only dashboard per module
- Timezone display in user's local zone (store UTC)
- Deploy to one chosen cloud (containers + managed Postgres + object storage)

### Explicitly OUT of scope (deferred — see §6)
- External user portal & external OAuth track (candidates/agencies/clients self-service)
- AI resume screening, PII redaction, bias monitoring
- External job boards (LinkedIn/Indeed/Rozee), agency portal
- Live BS4 push + live Directus time sync (mocked; real sync is post-MVP)
- Weighted multi-panel scorecards, blind review
- 360° peer/subordinate/skip-level feedback + anonymity aggregation + calibration bell curve
- Increment/promotion recommendation engine (basic report only)
- Gantt, Calendar view, task dependencies, resource utilization/capacity
- In-app notifications (WebSocket/SSE) — email only for MVP
- GDPR erasure workflow, DR drill, full security audit

---

## 2. Cadence & Team Assumptions

| Assumption | Value |
|---|---|
| Sprint length | **1 week** |
| Team | **2–3 devs** (assume 1 heavier FE, 1 heavier BE, 1 flex/full-stack) |
| MVP duration | **~8–9 weeks** (7 sprints of *content*, but see capacity reality below — the load does not fit 7 calendar weeks) |
| **Realistic capacity/sprint** | **12–14 story points** — a 2–3 dev team on a **1-week** sprint loses ~15–20% to standup/planning/review/retro + code-review turnaround, and there is no dedicated QA. This is *net* deliverable feature work, buffer already removed. |
| Integrations | BS4 + Directus **mocked behind adapters** so external teams never block the MVP |
| Environments | `local` (docker-compose) + one shared `staging` from Sprint 2 onward |

**Story point scale:** 1 = few hours · 2 = ~half day · 3 = ~1 day · 5 = ~2 days · 8 = needs splitting.

> **Capacity correction (v1.1 of this plan).** The original ~15–18 pt band double-counted the QA/review buffer — it claimed to *include* buffer, but the story lists then consumed the whole band with pure feature work. Corrected realistic throughput is **12–14 pts**. Against that ceiling, the current story loads are:
>
> | Sprint | Sum of pts | vs. 12–14 ceiling |
> |---|---|---|
> | S1 Foundation I | **19** | 🔴 over (~+5) |
> | S2 Foundation II | **20** | 🔴 over (~+6, worst; also the critical-path foundation) |
> | S3 Recruitment | **18** | 🔴 over (~+4) |
> | S4 Appraisal | **19** | 🔴 over (~+5) |
> | S5 Project | **18** | 🔴 over (~+4) |
> | S6 Cross-cut | **16** | 🟠 slightly over |
> | S7 Hardening | **18** | 🔴 over (~+4) |
>
> **Every sprint exceeds realistic capacity.** As pure capacity math: the plan holds **~128 pts** of work; at 13 pts/sprint that is **~10 sprints**, not 7 — i.e. the 7-week timeline is optimistic by roughly **40%**. To land it: either (a) extend to **~9–10 one-week sprints**, or (b) trim the lowest-value story out of each sprint into the post-MVP backlog to bring each to ≤14. Per scope of this revision, sequencing, DoD, and story content are left unchanged — only the capacity numbers and timeline are corrected here.

---

## 3. Sprint-by-Sprint Plan

### Sprint 1 — Foundation I: skeleton + auth
**Goal:** A staff user can log in with company Google and land on an (empty) authenticated shell.

| ID | Story | Pts | Lead |
|---|---|---|---|
| S1-1 | Scaffold monorepo (npm workspaces): Angular app + service stubs + `shared/` package + docker-compose | 3 | Flex |
| S1-2 | Provision one managed PostgreSQL; create schemas `auth, common, recruitment, appraisal, project, notification`; migration runner | 3 | BE |
| S1-3 | Auth Service: internal Google OAuth verify (hosted-domain), issue JWT (15m) + refresh (7d), `auth.user_account` | 5 | BE |
| S1-4 | API gateway skeleton: JWT validation middleware, `/api/v1/*` path routing to services | 3 | BE |
| S1-5 | Angular core module: Google login, token storage, refresh interceptor, route guard, empty shell layout | 5 | FE |

**Sprint demo / DoD:** login → authenticated empty dashboard; token refresh works; unauthenticated requests rejected at gateway.

---

### Sprint 2 — Foundation II: shared services + data + storage
**Goal:** Cross-cutting plumbing every module depends on is live.

| ID | Story | Pts | Lead |
|---|---|---|---|
| S2-1 | `shared/` middleware: RBAC (coarse role check), append-only `common.audit_log`, correlation-ID logger | 5 | BE |
| S2-2 | **Mock BS4 adapter** + one-time backfill + `common.employee_snapshot` seed (employees, departments, org hierarchy) | 3 | BE |
| S2-3 | Minimal Notification & Workflow Service: email (SMTP/SendGrid), `notification_template`, `approval_task`, `workflow_rule`, approve/reject callback API | 5 | BE |
| S2-4 | Object storage + upload pipeline: `common.document`, presigned download via app, ClamAV scan-before-clean | 5 | Flex |
| S2-5 | Timezone: store UTC everywhere; Angular pipe renders auto-detected local timezone | 2 | FE |

**Sprint demo / DoD:** an approval task can be created and emailed; a file uploads → scans → downloads via presigned URL; audit rows written for mutations; staging deploy live.

---

### Sprint 3 — Recruitment thin slice
**Goal:** HR/Hiring Manager can run a requisition to an offer record.

| ID | Story | Pts | Lead |
|---|---|---|---|
| S3-1 | `recruitment` migrations: `job_requisition, job_posting, candidate, application, interview_stage, scorecard, offer` (MVP subset) | 3 | BE |
| S3-2 | Requisition CRUD + single-step approval (→ Notification/Workflow) | 5 | Full |
| S3-3 | Internal job posting + basic application intake with resume upload (→ S2-4) | 3 | Full |
| S3-4 | Manual pipeline: move application through fixed stages (Screen → Interview → Offer); simple 1–5 rating (no weighting/panels) | 5 | Full |
| S3-5 | Offer record: create + mark accepted/declined; **mock** BS4 hire push (logged, not live) | 2 | BE |

**Sprint demo / DoD:** create requisition → approve → post → apply with resume → advance stages → record accepted offer.

---

### Sprint 4 — Appraisal thin slice
**Goal:** A cycle runs from goals to a viewable score.

| ID | Story | Pts | Lead |
|---|---|---|---|
| S4-1 | `appraisal` migrations: `appraisal_cycle, employee_cycle, competency_framework, goal, feedback_request, feedback_response, scoring_weight_config` | 3 | BE |
| S4-2 | Cycle management (create annual cycle, enroll employees from snapshot) | 3 | Full |
| S4-3 | Goal setting + manager approval (→ Notification/Workflow) | 5 | Full |
| S4-4 | Feedback collection: **self + manager only** (peer/subordinate/anonymity deferred) | 5 | Full |
| S4-5 | Simple weighted score (self/manager weights from `scoring_weight_config`) + employee score view; basic recommendation report (score only) | 3 | Full |

**Sprint demo / DoD:** create cycle → set & approve goals → self + manager feedback → view computed score.

> Note: the `anonymous_feedback_response` schema split (10.3) is trivial to migrate now even if unused — include the table so anonymity isn't retrofitted later.

---

### Sprint 5 — Project thin slice
**Goal:** A project with tasks, two views, and approved time.

| ID | Story | Pts | Lead |
|---|---|---|---|
| S5-1 | `project` migrations: `project, task, time_entry` (+ `idempotency_key`, `directus_sync_status` columns for later) | 3 | BE |
| S5-2 | Project + task CRUD (assignee from snapshot) | 5 | Full |
| S5-3 | **Kanban** board (drag across status) + **List** view (Gantt/Calendar deferred) | 5 | FE |
| S5-4 | Manual time entry against tasks + weekly timesheet view | 3 | Full |
| S5-5 | Manager approval of time entries; **mock** Directus sync (marks `synced`, no live call) | 2 | BE |

**Sprint demo / DoD:** create project → add tasks → move on Kanban → log time → manager approves → status flips to synced (mock).

---

### Sprint 6 — Cross-cutting glue & dashboards
**Goal:** The three slices feel like one product.

| ID | Story | Pts | Lead |
|---|---|---|---|
| S6-1 | One minimal read-only dashboard per module (a few key counts each) | 5 | FE |
| S6-2 | Wire all three approval flows end-to-end through Notification/Workflow (email + callback) | 3 | BE |
| S6-3 | RBAC pass: per-module role gating (HR Admin / Manager / Employee etc.) at service + UI | 5 | Full |
| S6-4 | Navigation, shared UI polish, error/empty states, audit-log coverage check | 3 | FE |

**Sprint demo / DoD:** a role-restricted user sees only permitted modules; each module has a working dashboard; every approval routes through the workflow service.

---

### Sprint 7 — Hardening, UAT & launch
**Goal:** MVP deployed and validated.

| ID | Story | Pts | Lead |
|---|---|---|---|
| S7-1 | E2E happy-path smoke tests for all three module flows | 5 | Full |
| S7-2 | Lightweight security review (authz on downloads, gateway audience checks, secrets in secrets manager) | 3 | BE |
| S7-3 | Production deploy to chosen cloud (containers + managed Postgres + object storage + secrets) | 5 | Flex |
| S7-4 | UAT with HR + a hiring manager + a PM; triage & fix P1 bugs | 5 | All |

**Sprint demo / DoD:** MVP live in production; UAT sign-off; known-issues list for post-MVP.

---

## 4. Dependency Order (why this sequence)

```
S1 (auth+shell) ─► S2 (middleware+notify+storage+snapshot) ─┬─► S3 Recruitment
                                                            ├─► S4 Appraisal
                                                            └─► S5 Project
                                                                     │
                                              S6 (dashboards+RBAC+glue) ─► S7 (harden+launch)
```
- **S1→S2 are hard prerequisites** for every module — nothing user-facing ships before them.
- **S3/S4/S5 are independent** once S2 lands; if capacity allows, a full-stack dev can start the next module's migrations while another finishes the current slice.
- Mocked BS4/Directus adapters keep S3–S5 off the critical path of external teams.

---

## 5. Risks & Mitigations

| Risk | Impact | Mitigation |
|---|---|---|
| 1-week sprints + small team = tight per-module slices | Slip | Hard-cap each module to the happy path only; push anything extra to §6 backlog immediately |
| Foundation (S1–S2) overruns | Everything slips | Timebox; ClamAV and full audit coverage can trail into S6 if needed |
| BS4/Directus contracts not ready | Blocked integration | MVP uses **mock adapters**; real sync is a post-MVP epic, not a blocker |
| Google OAuth / hosted-domain config delays | No login | Resolve OAuth client + domain allowlist in Sprint 1, day 1 |
| Scope creep from stakeholders wanting "just one more field" | Slip | This doc's §1 in/out list is the contract; changes go to backlog |

---

## 6. Post-MVP Backlog (deferred, prioritized)

1. **External portal + external OAuth track** (candidates/agencies/clients) — unlocks real recruitment sourcing
2. **Live BS4 push + live Directus time sync** (idempotency, reversal entries, reconciliation, DLQ)
3. **AI resume screening** (pluggable adapter, PII redaction, bias monitoring)
4. **Full 360°** (peer/subordinate/skip-level, schema-enforced anonymity, calibration bell curve)
5. **Increment/promotion recommendation engine**
6. **Gantt + Calendar views, task dependencies, resource utilization/capacity planning**
7. **In-app notifications** (WebSocket/SSE)
8. **External job boards + agency portal**
9. **GDPR erasure workflow, DR restore drill, full security audit**

---

## 7. Definition of Done (every story)

- [ ] Code merged to main behind review; migrations checked in
- [ ] Mutations write to `common.audit_log`; timestamps stored UTC
- [ ] Authz enforced at **service level**, not just UI
- [ ] Runs in docker-compose locally and on staging
- [ ] Happy-path verified (manual or automated)
- [ ] No secrets in code — pulled from secrets manager

---

*Companion plan to HR_SUITE_REQUIREMENTS.md v1.3 · MVP = thin slice of all 3 modules · 1-week sprints, 2–3 devs · realistic capacity 12–14 pts/sprint (~9–10 sprints).*
