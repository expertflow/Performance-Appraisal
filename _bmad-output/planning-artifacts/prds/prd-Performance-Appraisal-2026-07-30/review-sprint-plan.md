# Sprint Plan MVP — Scrum Master Validation Review

**Reviewer lens:** Agile Scrum Master, execution-realism focus
**Artifacts reviewed:** `SPRINT_PLAN_MVP.md` (v1.0) against `HR_SUITE_REQUIREMENTS.md` (v1.2)
**Date:** 2026-07-30
**Context:** MVP = thin happy-path vertical slice of 3 modules on a shared foundation · 1-week sprints · 2–3 devs · 7 sprints · BS4/Directus mocked behind adapters

---

## Overall Verdict

The plan is **well-structured and thin-slice-disciplined** — scope carving is genuinely good and the in/out contract is explicit. However, **it is NOT executable as-is on the stated capacity.** The declared ceiling is ~15–18 pts/sprint, but four of seven sprints are booked at 18–20 pts with **zero explicit allocation for review, QA, meetings, or ceremony overhead** — on 1-week sprints for a 2–3 dev team that is a structural over-commit, not a rounding error. The foundation sprints (S1–S2) are the most overloaded and the most schedule-critical, so slippage there cascades into every module slice. Fix the capacity math and the cross-cutting sequencing (RBAC/audit) and this becomes a credible plan.

---

## Point Totals Per Sprint (recomputed)

| Sprint | Stories | Sum of Pts | Claimed cap (15–18) | Verdict |
|---|---|---|---|---|
| S1 Foundation I | 3+3+5+3+5 | **19** | over | **Overloaded** |
| S2 Foundation II | 5+3+5+5+2 | **20** | over | **Overloaded (worst)** |
| S3 Recruitment | 3+5+3+5+2 | **18** | at ceiling | Tight |
| S4 Appraisal | 3+3+5+5+3 | **19** | over | **Overloaded** |
| S5 Project | 3+5+5+3+2 | **18** | at ceiling | Tight |
| S6 Cross-cut | 5+3+5+3 | **16** | in range | OK |
| S7 Hardening | 5+3+5+5 | **18** | at ceiling | Tight |

**Every sprint except S6 is at or above the top of the stated capacity band, and three exceed it outright.** The band itself already claims to include "buffer for review/QA" (§2), but the story lists consume the entire band with feature work — meaning the buffer is double-counted away.

---

## Findings

### CRITICAL

**C1 — Capacity band is contradicted by the story loads; no real QA/ceremony buffer exists**
*Location: §2 Cadence / all sprints*
The 15–18 pt band is stated to already include review/QA buffer, yet S1=19, S2=20, S4=19 book pure feature work above the band, and S3/S5/S7 sit exactly at the ceiling. On a 1-week sprint a 2–3 dev team loses ~15–20% of capacity to standup/planning/review/retro plus code review turnaround; there is no dedicated QA person (§Risk gap R3). Realistic sustainable throughput is closer to **12–14 pts**.
*Fix:* Re-baseline capacity to ~12–14 pts/sprint and move the lowest-value story out of each 18+ sprint into a buffer/backlog; treat S1–S2 as candidates for an 8-sprint plan.

**C2 — Foundation (S1–S2) is both the most overloaded and the most schedule-critical; single point of cascade failure**
*Location: Sprint 1, Sprint 2 / §4 Dependency Order*
The plan itself states "S1→S2 are hard prerequisites for every module" and "Foundation overruns → everything slips" (§5). Yet these two sprints are loaded at 19 and 20 pts — the two heaviest in the plan — and S2 packs five hard infrastructure items (RBAC+audit+logger, mock BS4, notify+workflow service, object storage+ClamAV, timezone) into one week. Any of object storage + ClamAV scan pipeline (S2-4, 5pts) or the notification+workflow service (S2-3, 5pts) realistically eats a week alone with a shared DB and first-time cloud setup. If S2 slips, S3/S4/S5 all slip.
*Fix:* Split S2 into two sprints (2a: RBAC/audit/logger + snapshot; 2b: notify/workflow + storage/ClamAV), accepting a 7→8 sprint plan, OR trail ClamAV + full audit coverage into S6 per the stated mitigation and de-risk the critical path now, not reactively.

---

### HIGH

**H1 — RBAC and audit are introduced coarsely in S2 but the real per-module RBAC pass is deferred to S6, forcing rework**
*Location: Sprint 6 / S6-3 vs Sprint 2 / S2-1; DoD line "Authz enforced at service level"*
S2-1 delivers only a "coarse role check." Per-module role gating (HR Admin / Manager / Employee) at service + UI is deferred to S6-3 (5 pts). But S3/S4/S5 build requisition approval, goal approval, score visibility, and time-entry approval — all of which are inherently role-scoped (requirements §5.2, §6.2, §7.2, and §10.2 "restricted to HR Admin, enforced at service level"). Building three module slices with only coarse auth and then retrofitting fine-grained RBAC in S6 means revisiting every service endpoint and every UI guard. This directly contradicts the DoD which requires service-level authz on *every* story.
*Fix:* Define the role/permission model in S2 and enforce per-endpoint RBAC inside each module slice as it is built (S3–S5); make S6-3 a verification/hardening pass, not the first real implementation.

**H2 — Audit logging is a DoD requirement from S1 but "audit-log coverage check" is deferred to S6-4**
*Location: DoD §7 vs Sprint 6 / S6-4*
The DoD says every story writes mutations to `common.audit_log`, and requirements §10.1 name specific mandatory audited events (score changes, offer approval, salary recommendation *views*, time-entry approvals/reversals, resume downloads). If audit coverage is only *checked* in S6, teams will build S3–S5 mutations without consistent audit wiring and then backfill — rework, and a compliance gap during any interim demo.
*Fix:* Make audit-write part of the S2-1 shared middleware contract and enforce it in the per-story DoD from S3 onward; keep S6-4 as a coverage audit only.

**H3 — Single shared staging from S2 with three parallel module streams and no environment isolation**
*Location: §2 Environments / §4 (parallel S3–S5)*
The plan encourages a full-stack dev to start the next module while another finishes the current slice (§4), and runs on "one shared staging from Sprint 2." Parallel migration development against one shared Postgres + one staging with a 2–3 person team invites migration collisions and broken-staging stalls, with no CI gate mentioned until S7 smoke tests.
*Fix:* Add ephemeral/per-branch DB (docker-compose is local-only) or at minimum a migration-ordering convention + a basic CI check (migrate + build + lint) starting S2, not S7.

**H4 — External OAuth track is required by the requirements' Phase 1 but silently dropped; candidate application intake has no working front door**
*Location: Sprint 3 / S3-3 vs Requirements §4.5, Phase 1 checklist, §5.4.2*
The plan explicitly defers the external portal + external OAuth (§1 out-of-scope) — a reasonable MVP call. BUT S3-3 delivers "internal job posting + basic application intake with resume upload," and the requirements model candidates as **external** users (§5.2, §4.5). The plan does not state *who* applies or *how* in the internal-only MVP. If only internal staff can log in (§1 "one user population only"), the recruitment happy path "apply with resume" has no actor unless an internal user creates the candidate/application on the candidate's behalf.
*Fix:* Explicitly scope S3-3 as "HR/recruiter creates candidate + uploads resume on their behalf" (internal proxy intake), and note external self-service apply is post-MVP — otherwise the demo path is undefined.

---

### MEDIUM

**M1 — S2-3 (notification + workflow service) is under-pointed at 5 for what it must deliver**
*Location: Sprint 2 / S2-3*
S2-3 bundles email delivery, `notification_template`, `approval_task`, `workflow_rule`, AND the approve/reject callback API — this is the shared approval engine that all three modules' approvals (S3-2, S4-3, S5-5, S6-2) depend on. At 5 pts (~2 days) alongside four other S2 stories, it is optimistic and it is on the critical path.
*Fix:* Re-estimate to 8 and split (delivery+templates vs. workflow rule engine+callbacks), or pull it forward into its own foundation sub-sprint.

**M2 — S1 is overloaded and front-loads OAuth, which is the plan's own top login risk**
*Location: Sprint 1 (19 pts) / Risk "OAuth config delays"*
S1 at 19 pts includes the full OAuth verify + JWT + refresh (S1-3, 5pts) and the Angular login/refresh/guard stack (S1-5, 5pts) — the two riskiest items — in the same overloaded week, while the risk table admits OAuth config can delay login and says "resolve day 1." Day-1 dependency + 19 pts = high slip probability for the sprint that gates everything.
*Fix:* Move S1-2 (DB provisioning/migration runner, 3pts) or S1-4 (gateway skeleton) into a pre-sprint/spike or S2, keeping S1 focused on the auth vertical.

**M3 — Timezone (S2-5) done early is good, but "user's local calendar day" for time entries is a hidden requirement not captured**
*Location: Sprint 2 / S2-5 vs Requirements §3.5, §7.5.4*
S2-5 covers store-UTC + display-local (correct, early — good). But requirements §3.5/§7.5.4 require time entries be recorded against the *user's local calendar day* with captured offset so payroll resolves the business day. S5-4 (manual time entry) does not mention this, and it is genuinely needed for a correct time-tracking demo (a late-night entry crossing UTC midnight lands on the wrong day).
*Fix:* Add "capture local calendar day + offset on time entry" to S5-4 acceptance, leveraging the S2-5 timezone work.

**M4 — Definition of Done lacks review/QA sign-off criteria and demo acceptance**
*Location: §7 Definition of Done*
The DoD covers merge/migrations/audit/authz/deploy/secrets but has no criteria for: acceptance-test pass, code review by a second dev (only "behind review"), or product/stakeholder acceptance of the sprint goal. "Happy-path verified (manual or automated)" permits zero automated tests until S7-1, so regressions across S3–S5 go undetected.
*Fix:* Add "at least the sprint-goal happy path has an automated E2E/integration test" to the DoD from S3 onward, and add a demo/acceptance checkbox per sprint goal.

**M5 — Recruitment migration (S3-1) declares tables the MVP never uses (`scorecard`, full `interview_stage`)**
*Location: Sprint 3 / S3-1 & S3-4*
S3-1 migrates `scorecard` and `interview_stage`, and S3-4 explicitly says "simple 1–5 rating (no weighting/panels)." Creating the scorecard/panel tables is minor, but the risk is scope creep: the presence of scorecard tables invites building scorecard UI. The thin slice needs only a stage-advance + a rating field.
*Fix:* Keep the migration minimal (rating on the application/stage row); defer `scorecard`/`interview_panel`/`stage_template` tables to the post-MVP pipeline epic — mirrors how S4 correctly defers anonymity but pre-migrates the table.

---

### LOW

**L1 — S6 dashboards (S6-1, 5pts) may be blocked by data volume from earlier demos**
*Location: Sprint 6 / S6-1*
Read-only dashboards with "a few key counts" are fine, but they depend on S3–S5 producing enough seeded/demo data to render meaningful counts. No demo-seed story exists.
*Fix:* Add a small seed-data task (or fold into each module sprint's DoD) so dashboards have content in S6.

**L2 — Idempotency/reversal columns pre-migrated in S5-1 but reversal *behavior* is deferred; ensure it is not half-built**
*Location: Sprint 5 / S5-1 & S5-5*
S5-1 adds `idempotency_key` + `directus_sync_status`; S5-5 mocks sync as a status flip. Requirements §7.5.4 lock synced entries and require reversal entries. The MVP correctly mocks the sync, but should explicitly state that edit-after-sync locking is deferred so it is not accidentally scoped in.
*Fix:* One line in S5-5: "locking/reversal deferred to live-sync epic; mock flips status only."

**L3 — No explicit spike/setup budget for first-time cloud + secrets-manager provisioning**
*Location: Sprint 1 / S1-2, Sprint 7 / S7-3*
Provisioning managed Postgres + object storage + secrets manager on a chosen cloud for the first time routinely burns unplanned time; it is embedded in S1-2 (3pts) and S7-3 (5pts) with no spike buffer.
*Fix:* Add a pre-Sprint-1 half-day infra spike, or bump S1-2 to 5.

**L4 — Risk table omits several execution risks**
*Location: §5 Risks*
Missing risks: (a) single shared staging becoming a bottleneck/broken-build stall (see H3); (b) no dedicated QA → quality debt accrues to S7; (c) mock-to-real integration debt — S3–S5 build against mock BS4/Directus adapters whose contracts (§8.3) are unverified, so the real-sync epic may reveal adapter interface mismatches; (d) OAuth is listed but the *external* OAuth track drop (H4) is not flagged as a demo-scope risk.
*Fix:* Add these four rows to §5 with mitigations (CI gate, QA rotation, adapter contract tests, explicit intake-actor decision).

---

## Thin-Slice Coherence Assessment

Scope carving is the plan's strongest quality. Correctly deferred: AI screening, 360°/peer/anonymity aggregation, calibration bell curve, Gantt/Calendar/dependencies, resource utilization, in-app WebSocket, external boards, GDPR erasure, DR drill. Correctly *pre-migrated but unused*: `anonymous_feedback_response` (S4 note), sync columns (S5-1) — good forward-compatibility discipline.

Scope creep to trim: `scorecard`/panel tables in S3 (M5). Deferred-but-actually-needed for a working demo: fine-grained RBAC (H1), the time-entry local-day rule (M3), and a defined applicant actor (H4).

---

## Dependency Ordering Assessment

The S1→S2→(S3‖S4‖S5)→S6→S7 spine is sound and correctly identifies S1–S2 as hard prerequisites. Parallelization of S3/S4/S5 after S2 is genuinely achievable *for a 3-dev team* but the plan's own capacity is 2–3 devs — with 2 devs the three slices are effectively serial, which the 7-sprint schedule already assumes (one module per sprint). The dependency risk is not ordering but the overload on the two gating foundation sprints (C2) and the late RBAC/audit (H1/H2) that force back-tracking into completed slices.

---

## Finding Count by Severity

| Severity | Count |
|---|---|
| Critical | 2 |
| High | 4 |
| Medium | 5 |
| Low | 4 |
| **Total** | **15** |

---

*Review artifact — companion to SPRINT_PLAN_MVP.md v1.0.*
