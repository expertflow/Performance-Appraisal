# Adversarial Review — HR & Project Management Suite Requirements (v1.2)

**Reviewer stance:** Cynical senior reviewer. Target: `HR_SUITE_REQUIREMENTS.md` v1.2.
**Date:** 2026-07-30

---

## Overall Verdict

This is a well-dressed requirements doc that has clearly been through two rounds of gap-closing (v1.1, v1.2) — and it *reads* complete, which is exactly the problem. The happy paths are lovingly detailed while the failure paths, ownership, and enforcement mechanisms for the hardest requirements are hand-waved with confident prose ("enforced at service level," "idempotent, see 7.5.4," "schema-enforced"). Several load-bearing claims contradict the actual data model or architecture. The single-DB and cloud-agnostic decisions are asserted with zero capacity/scale numbers behind them. Observability is deferred to nowhere. There is no test strategy at all. This is buildable, but multiple listed "decisions" are really "we'll figure it out later" in a nice table.

---

## Findings

### CRITICAL

---

**[CRITICAL] External data-scoping is asserted but has no enforcement mechanism or data model to back it**
**Location:** §4.5, §5.2, §7.2
The doc repeatedly promises external users see "only their own" records "enforced at service level, not just UI." The only enforcement artifact is `scopeIds: ["application:uuid"]` in the external JWT. That does not scale or hold: a candidate with multiple applications, an agency with dozens of submissions, or a client with many projects would need an unbounded, constantly-changing list of IDs baked into a 15-minute token. There is no described server-side authorization filter (e.g., "every external query is scoped by `external_account.linked_entity_id`"), no join path defined, and `application` has no `external_account_id` FK. The single most security-critical requirement in the doc has no actual implementation.
**Fix:** Define a mandatory server-side scoping predicate keyed on `external_account.id` (not JWT-embedded IDs) and add the FK columns to make it enforceable.

---

**[CRITICAL] Gateway WebSocket routing contradicts the stated gateway design**
**Location:** §3.1, §3.3, §9.1, §2 (Real-time row)
§3.3 rejects managed cloud API gateways partly for "limited flexibility for WebSocket routes," implying the custom gateway handles WebSocket. But §3.3 describes only HTTP concerns: JWT validation, `express-rate-limit`, path-based *HTTP* proxying. There is no story for how the WebSocket/SSE connection (notification service :3004) traverses the gateway, how the long-lived socket is authenticated (JWT expires in 15 min — what happens to an open socket at minute 16?), how sticky sessions work with "multi-instance" notification service, or how rate limiting applies to a persistent connection. The "≥1 warm instance" note (§9.1) addresses scale-to-zero but not multi-instance socket affinity/fan-out (no Redis pub/sub or shared backplane mentioned).
**Fix:** Specify WebSocket auth lifecycle (re-auth on token refresh or socket-level ticket), a pub/sub backplane for multi-instance fan-out, and whether sockets bypass or traverse the gateway.

---

**[CRITICAL] BS4 push failure after offer acceptance has no defined failure path**
**Location:** §5.4.6, §8.4, `employee_handoff` table
The offer-accept → BS4 push is the single most business-critical write in Recruitment (a person has accepted a job). §8.4 gives generic "3 retries + DLQ" but there is no defined behavior when the new-hire push lands in the DLQ: Is the candidate told they're hired while BS4 has no record? Who reconciles? `employee_handoff.bs4_push_status` exists but no states are enumerated and no reconciliation job is described (unlike Directus, which got a 2-day reconciliation job in §7.5.4). Also: `POST /employees` to BS4 is claimed idempotent (§8.4) but no idempotency key is defined on that call (only time-entries got one), so a retry after an ambiguous timeout can create a duplicate employee.
**Fix:** Enumerate `bs4_push_status` states, add an idempotency key to `POST /employees`, and define a reconciliation + manual-recovery path mirroring the Directus one.

---

### HIGH

---

**[HIGH] "Single-DB schema isolation" contradicts cross-module data flows and the audit design**
**Location:** §3.1 (schema isolation rule), §10.1
The rule says each service's DB role can touch "only its own schema plus read `common`," and "cross-schema joins in application code are not allowed." Yet: (a) §10.1 offers "a single `common.audit_log`" written by shared middleware in *every* service — that requires every service to *write* to `common`, contradicting "read access to the `common` schema." (b) The workflow service (§9.2) resolves approvers from `common.employee_snapshot` and writes `notification.approval_task` referencing `entity_id` in other schemas — cross-module references with no FK possible across the isolation boundary, so referential integrity is silently abandoned. The "isolation" is architectural theater on a single database.
**Fix:** Clarify `common` write-grants explicitly (audit), and acknowledge that cross-schema entity references are unenforced pointers requiring app-level integrity checks.

---

**[HIGH] No capacity, scale, or concurrency numbers justify the single-DB decision**
**Location:** §1, §2, §14, §10.6
"Single PostgreSQL database" is presented as a confirmed decision six times, but there is not one number anywhere: no user count, no expected employees, no concurrent-user target, no data volume, no QPS, no growth projection. RTO/RPO are stated (§10.6) but throughput/scale are not. You cannot claim single-DB is the right call — or size the "managed PostgreSQL instance" — without these. This is a decision dressed up as validated when it's actually unexamined.
**Fix:** Add a non-functional requirements section with concrete scale targets (users, employees, peak concurrency, storage growth) and validate single-DB against them.

---

**[HIGH] No observability / monitoring story at all**
**Location:** entire doc (absent); §3.3 mentions correlation IDs only
Correlation IDs are forwarded, and that's the extent of it. There is no logging aggregation, no metrics, no tracing, no health checks, no alerting definition (beyond vague "alert admin on repeated failures" in §8.4 with no channel/threshold/owner), no dashboards for system health (the §11 dashboards are *business* metrics only). For a distributed system of 8+ services on unspecified cloud, running blind. This isn't "deferred" — it's simply missing, and nothing in the phases (§13) adds it.
**Fix:** Add an observability requirement (structured logs + metrics + tracing + health endpoints + alerting) and slot it into Phase 1, not "later."

---

**[HIGH] No test strategy exists**
**Location:** §13 (Phase 5 only), entire doc
The only testing mentioned is "security audit + performance testing" and "UAT" in Phase 5 — i.e., at the very end, weeks 31-36. No unit/integration/contract-test strategy, no mention of testing the BS4/Directus integration contracts (critical for external dependencies), no test data strategy, no CI gate. Contract tests especially matter here because BS4/Directus are external systems whose contracts §13 admits aren't even finalized yet.
**Fix:** Add a test strategy (unit/integration/contract/e2e) with contract tests for BS4 and Directus, wired into CI from Phase 1.

---

**[HIGH] Refresh-token rotation is described but reuse-detection (theft response) is not**
**Location:** §4.4
Refresh tokens are "rotated on each use" and "stored hashed" — good, but rotation without *reuse detection* is a half-measure. If a stolen refresh token is used, rotation just means the thief and victim take turns minting tokens. The doc never says what happens when a previously-rotated (already-used) refresh token is presented — the canonical theft signal. No token-family invalidation, no forced re-auth on reuse.
**Fix:** Specify refresh-token reuse detection: presenting a consumed token invalidates the entire token family and forces re-login.

---

**[HIGH] Signed-URL leakage / TTL / scope is undefined**
**Location:** §2 (File Storage), §10.4
Downloads issue "short-lived pre-signed URLs" after an authz check. But a pre-signed URL is a bearer credential — once minted it is valid for anyone who obtains it, regardless of the original authz check, until it expires. No TTL value is given ("short-lived" is not a spec), no statement that URLs are single-download or IP/referrer-bound, no logging that a *specific user* was issued a URL for a *specific object* (the audit logs "file downloads" per §10.1 but a pre-signed URL download happens directly against object storage, invisible to the app — so the audit claim is likely false for the actual download event).
**Fix:** Define a concrete TTL, minimize URL lifetime/scope, and reconcile the "audit all resume downloads" claim with the fact that pre-signed downloads bypass the app.

---

**[HIGH] Anonymous-feedback anonymity is defeatable and under-specified despite the schema claim**
**Location:** §6.4.2, §10.3, `anonymous_feedback_response`
The schema drops `reviewer_id`/`feedback_request_id` — good intent — but the notification/workflow layer still *creates* per-reviewer feedback requests (§6.4.2 "auto-generates feedback requests"), and delivery/read tracking in `notification` (§9.5, has `recipient_id`, `read_at`, timestamps) plus submission timestamps on the anonymous row create a trivial correlation attack (small teams, timing). The "minimum 2 responses" threshold (§10.3) is far too low to prevent de-anonymization in a 3-person peer set. "Schema-enforced anonymity" is a claim that the surrounding system undermines.
**Fix:** Raise minimum thresholds, strip/round submission timestamps on anonymous rows, and address the notification-layer timing side-channel explicitly.

---

**[HIGH] Directus reversal-entry edge cases are unhandled**
**Location:** §7.5.4
The append-only reversal model is clean until reality: (a) What if the *reversal entry itself* fails to sync? You now have a locked original showing wrong hours and a stuck correction. (b) Can you reverse a reversal? (c) What if the original never actually synced (DLQ) but a user tries to "correct" it — you'd push a negative entry for something Directus never received. (d) Nothing prevents the corrected/replacement positive entry from itself needing correction, i.e., unbounded chains. The reconciliation job only flags `approved + !synced`; it says nothing about reversal integrity.
**Fix:** Define reversal preconditions (original must be `synced`), forbid reversing unsynced entries, and add reversal entries to the reconciliation job.

---

### MEDIUM

---

**[MEDIUM] `external_account` → business-entity linkage has no reverse FK and no scoping join path**
**Location:** §4.5 (`auth.external_account`), §5.5, §7.7
`external_account.linked_entity_id` points at `recruitment.agency` / `recruitment.candidate` / `project.client`, but this crosses the schema-isolation boundary (auth → recruitment/project) which §3.1 forbids as a join. And there is no `external_account_id` on `application`, `candidate`, or `project` for the actual per-request scoping filter. The linkage table exists but the enforcement join does not.
**Fix:** Add scoping columns/logic that work within the isolation rules (service-level lookup, not cross-schema FK).

---

**[MEDIUM] Idempotency-key collision / semantics undefined**
**Location:** §7.5.4, §8.4
"Directus deduplicates on it" — but what if the *content* differs for the same key (client bug re-uses a key with different hours)? Does Directus reject, overwrite, or silently keep the first? What if two different entries collide on a UUID (astronomically unlikely but the doc claims "unique" as a guarantee, not a constraint)? Idempotency semantics are asserted, not specified, and they depend on Directus behavior the doc doesn't own or verify.
**Fix:** Specify idempotency semantics (key+payload-hash) and confirm Directus's actual dedup behavior in the contract.

---

**[MEDIUM] No owner/trigger for several recurring jobs and "quarterly" processes**
**Location:** §8.5 (nightly delta), §7.5.4 (daily reconciliation), §10.2 (retention purge), §10.5 (quarterly bias report), §8.2 (quarterly key rotation)
Multiple background processes are named with a cadence but no owning service, no failure path, and no alerting. Who runs the retention purge (§10.2 "rejected resumes purged after 12 months")? What triggers it, and what if it fails? The bias report and key rotation are "quarterly" with no owner or automation. The nightly delta sync (§8.5) has no failure behavior — if it fails silently for a week, the snapshot goes stale and login (§4.3) serves stale roles with no alert.
**Fix:** Assign an owning service, a trigger, a failure/alert path, and a monitoring signal to every scheduled job.

---

**[MEDIUM] Initial-data bootstrap covers employees but not RBAC roles, templates, or workflow rules**
**Location:** §8.5, §13 Phase 1
The one-time backfill seeds `employee_snapshot`. But nothing seeds the initial `workflow_rule` set, `notification_template` set, RBAC role definitions, competency frameworks, or `scoring_weight_config` defaults — all of which are prerequisites for the very first requisition/appraisal/approval to function. `database/seeds/` exists in §12 but its contents are undefined. On day one, the approval engine has no rules and no templates.
**Fix:** Define seed data for roles, workflow rules, default templates, and scoring config as a Phase 1 deliverable.

---

**[MEDIUM] Authz model for the external portal is coarse and role-collapsed**
**Location:** §4.5, §5.2
External roles are `candidate | agency | client`, but an agency submitting "against open requisitions" needs to *read* requisition data (which is company data the doc says externals "must never reach"). The boundary between "job posting an agency can see" and "internal requisition data" is never drawn. Similarly, a client viewing "milestones" — which milestone fields are safe vs. internal (budget, cost center, internal notes)? No field-level visibility spec.
**Fix:** Define a field-level external-visibility whitelist per external role for postings/milestones/submissions.

---

**[MEDIUM] `feedback_response` vs `anonymous_feedback_response` split leaves skip-level and self ambiguous**
**Location:** §6.6
`feedback_request.reviewer_type` allows `self/manager/peer/subordinate/skip`. `feedback_response` comment says "NON-anonymous only (self, manager, skip-level)"; `anonymous_feedback_response` says "peer/subordinate." So peer/subordinate are *always* anonymous — but §6.4.2 says anonymity is an *option* ("anonymous feedback option"). If a peer response is non-anonymous, which table does it go in? The two-table design hard-codes anonymity by reviewer_type, contradicting the "optional" language.
**Fix:** Reconcile whether anonymity is per-response-optional or fixed-by-reviewer-type; the schema currently forces the latter.

---

**[MEDIUM] Weighted scoring config allows invalid states**
**Location:** §6.4.3, `scoring_weight_config`
Weights (self/peer/subordinate/manager pct) are independently stored columns with no constraint that they sum to 100, and no rule for employees with *no subordinates* (subordinate 20% weight — does it redistribute or silently drop, skewing the score?). Same for employees with no peers. The 360° math breaks for individual contributors under a config built for managers.
**Fix:** Add a sum=100 constraint and define weight redistribution when a reviewer class is empty.

---

**[MEDIUM] GDPR erasure vs. append-only ledgers and Directus is under-specified**
**Location:** §10.7, §7.5.4, §8
Erasure "locates all records across every schema" — but time entries are an append-only ledger already *pushed to Directus* (payroll), a system the erasure workflow does not control. Erasing an external candidate is scoped; erasing an *employee's* PII collides directly with the 7-year payroll-retention requirement (§10.1) and the immutable Directus ledger. The doc only reasons about candidates/external users and quietly ignores the employee case and the downstream ERP copies.
**Fix:** Scope erasure explicitly to data the suite controls, document lawful-basis retention exemptions for payroll data, and state that downstream ERP erasure is out of the suite's control (separate process).

---

**[MEDIUM] No rate-limit story for WebSocket, external portal, or auth endpoints specifically**
**Location:** §3.3
`express-rate-limit` "per user/IP" is the whole story. The unauthenticated external portal (public Google accounts, self-registering candidates) is the prime abuse target and gets no dedicated limit. `/auth/google` (token verification, external calls to Google) has no specific throttle. WebSocket connection-rate/message-rate limiting is absent (see also the critical WS finding).
**Fix:** Define per-endpoint-class rate limits (auth, external-portal, WS connect/message) distinct from the generic per-user/IP default.

---

### LOW

---

**[LOW] JWT `modules` claim can go stale for up to 7 days**
**Location:** §4.2, §4.4
Module/role permissions are embedded in the access token; a role revocation only propagates on refresh (up to 15 min) — acceptable — but roles are sourced from a snapshot that can be 24h+ stale (§8.5), so a de-provisioned user could retain access notably longer than intended. No token/revocation list.
**Fix:** Note the staleness window explicitly and consider a revocation check for sensitive role removals.

---

**[LOW] Timezone rule can't resolve billing day for cross-midnight or traveling users**
**Location:** §3.5
"User's local calendar day, auto-detected from browser each session" means a user who travels (or whose VPN shifts) can log the same work under two different business days across sessions. Auto-detection with no stored per-user preference makes payroll day assignment non-deterministic across devices.
**Fix:** Capture and persist the timezone-at-entry per time_entry (partially implied) and lock the business-day derivation to that stored offset, not the live session.

---

**[LOW] `task` subtasks "one level deep" is a business rule with no enforcement point**
**Location:** §7.5.2, `task.parent_task_id`
`parent_task_id` is self-referential with nothing preventing a subtask having a subtask. "One level deep" is stated in prose only.
**Fix:** Add an application/DB check that a task with a non-null `parent_task_id` cannot itself be a parent.

---

**[LOW] Job-board integration approval is a schedule risk buried as a checkbox**
**Location:** §13 Phase 1 & 5
"Approval can take weeks" for LinkedIn/Indeed, yet the integration is Phase 5 (weeks 31-36) and gated on paperwork started in Phase 1. If approval slips (they routinely do, or get denied), a headline sourcing channel silently misses launch. No fallback (manual posting) is specified.
**Fix:** Add a manual-posting fallback and treat external-board approval as an explicit schedule risk with a contingency.

---

**[LOW] `notification.status` has no retry/backoff for failed email, unlike sync**
**Location:** §9.5
`notification.status` includes `failed` but there is no retry policy, DLQ, or escalation for failed email delivery — a dropped offer-letter or interview-invite email just sits as `failed` with no owner. Directus sync got a whole retry/DLQ/reconciliation apparatus; notifications got none.
**Fix:** Define retry/DLQ/alerting for failed notification delivery, at least for transactional (offer/interview) emails.

---

**[LOW] "Cloud-agnostic" is asserted but IaC per-target multiplies untested surface**
**Location:** §1, §2, §12 (`infrastructure/deploy` per target)
Supporting Cloud Run / ECS / AKS / k8s "per target" means 4 deployment configs, 4 secrets-manager integrations, 4 object-storage behaviors — none of which will be tested unless actually deployed. "Cloud-agnostic" here is aspiration; in practice one target gets built and the rest rot. This inflates scope for a benefit ("no lock-in") that may never be exercised.
**Fix:** Pick one primary target for launch; state the others as "portable-by-design, unvalidated" rather than implying parity.

---

## Finding Count by Severity

| Severity | Count |
|---|---|
| Critical | 3 |
| High | 8 |
| Medium | 9 |
| Low | 6 |
| **Total** | **26** |

---

*Adversarial review complete. The document's greatest liability is not any single gap but the pattern: its hardest requirements (external scoping, anonymity, integration failure recovery, WebSocket) are stated as settled with confident cross-references, while the mechanisms those references point to don't fully exist.*
