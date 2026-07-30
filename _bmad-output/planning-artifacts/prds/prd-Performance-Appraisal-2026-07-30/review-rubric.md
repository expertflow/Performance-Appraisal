# PRD Quality Review — HR & Project Management Suite (v1.2)

## Overall verdict

This is a strong, internally consistent architecture-and-scope spec: the technical decisions are stated as decisions with rejected alternatives named (§3.3), cross-references resolve cleanly, and the data models are unusually concrete for a chain-top artifact. What holds up is the *engineering* story — schema isolation, auth-track separation, idempotent sync, anonymity-by-schema. What is at risk is everything a story-creation workflow needs to test against: there are **no acceptance criteria and no measurable thresholds on any functional requirement**, non-functional bounds exist only for DR/token-lifetime and are deliberately absent for scale/concurrency, and there is **no Non-Goals section, no tagged assumptions, and no glossary**. As a feed for architecture it is adequate-to-strong; as a feed for epics/stories it is thin on done-ness and will force downstream workflows to invent every acceptance condition.

## Decision-readiness — strong

The document reads like a set of decisions, not a menu. §3.3 states the API-gateway choice and names **"Rejected alternatives:" Apigee, Kong, managed cloud gateways** with a reason for each and a revisit trigger — this is exactly the trade-off honesty the rubric rewards. §11 opens "**Decision: reporting is independent per module**" and explicitly defers cross-module reporting to "its own phase; it is **out of scope** for the initial build." §6.4.4 / §6.5 make a real call — "**No auto-push to BS4** — recommendations are generated as reports for HR to act on manually" — and §14 restates it as "Partial." The v1.1/v1.2 change logs at the top show decisions evolving rather than being smoothed to neutral.

What keeps this from being flawless for *decision-making* is the absence of any surfaced open tensions. There are no `[NOTE FOR PM]` callouts and no Open Questions list; §13 has a single "Finalize BS4 API contract" placeholder but the document never admits what is still unknown (e.g., whether Rozee.pk even has an API — §13 says "verify Rozee.pk API availability," which is a genuine open question buried as a checkbox). A decision-maker gets clear answers but no honest map of residual risk.

### Findings
- **medium** No open-tensions surface (§13, whole doc) — real unknowns (Rozee.pk API existence, BS4 contract not yet finalized, DPA per AI provider "required before production use" §10.5) are scattered as task checkboxes rather than collected as open questions a PM must close. *Fix:* add a short "Open Questions / Risks" subsection listing the unresolved external dependencies with an owner.

## Substance over theater — strong

Very little furniture. The differentiation content is earned by concrete mechanism, not adjectives: anonymity is "**enforced by the schema, not by hiding columns in the UI**" and backed by a table (`anonymous_feedback_response`) with "**NO reviewer_id, NO feedback_request_id**" (§6.6, §10.3). The sync-integrity rules (§7.5.4) spell out idempotency keys, append-only reversal entries, and a >2-day reconciliation flag — these drive real data-model columns (`idempotency_key`, `reversal_of_id`, `directus_sync_log`). The resilience-cache story (§8.5, §4.3) is a genuine architectural stance ("BS4 down → login unaffected") not boilerplate. Data-model "Notes" blocks explicitly justify why tables exist ("`competency_framework` is now a real table — it was referenced ... but had no home").

The one soft spot is §10.6 and parts of §10.2, which lean on generic security phrasing ("Database encryption at rest," "TLS in transit everywhere"). These are fine as baselines but are the closest thing to NFR boilerplate in the doc — and because no product-specific performance thresholds exist anywhere, the security section is the only NFR content and it is unquantified beyond RPO/RTO.

### Findings
- **low** Generic security baselines (§10.2, §10.6) — "encryption at rest," "TLS everywhere" are table-stakes statements without product-specific scope. Acceptable, but they are the entirety of the NFR surface. *Fix:* keep, but pair with the missing performance/scale bounds (see Done-ness).

## Strategic coherence — strong

There is a clear thesis: three independent modules on a deliberately shared foundation (single Postgres schema-per-module, one auth service, one notification/workflow service), justified for an internal suite. §1 Key Principles state it and every module honors it — recruitment/appraisal/project each get their own schema, all route through the gateway, all consume `common.employee_snapshot`. The phasing (§13) follows the thesis: Phase 1 builds the shared foundation (auth both tracks, minimal notification/workflow, snapshot backfill) *because* "required by every later phase," not "easy first." The gateway "revisit if ... exposed to external high-traffic consumers" (§3.3) shows scope discipline matched to the internal-tool kind.

The coherence gap is on the metrics side. §11 dashboards are labeled and sensible (Time-to-Hire, 360° Participation Rate, Burn Rate), but they are **reporting features, not Success Metrics for the product** — there is no statement of what outcome would make this suite a success, and no counter-metrics. That is defensible for an internal-tooling spec (the rubric allows operational SMs), but the doc never explicitly says "these dashboards are the operational metrics; there is no product-level success target," so a reader can't tell whether SMs were considered and scoped out or simply omitted.

### Findings
- **medium** Dashboard metrics stand in for Success Metrics with no counter-metrics (§11.1–11.3) — e.g., "AI Screening Accuracy" is measured but no target correlation, and nothing guards against gaming Time-to-Hire by lowering bar. *Fix:* add one line per module stating the target/threshold that defines success, or explicitly state SMs are operational-only by design.

## Done-ness clarity — broken

This is the document's central weakness and, per the brief, judged unforgiving. **Essentially no functional requirement carries a testable acceptance condition or measurable threshold.** Features are described as capabilities ("Multi-level approval workflow before posting," §5.4.1; "Auto-close when headcount filled," §5.4.2; "Resource utilization view: hours allocated vs. available," §7.5.3) with no definition of done, no edge-case behavior, and no verifiable outcome. An engineer could not tell when any of these is "done" without inventing the criteria.

Vague terms are pervasive and load-bearing:
- **"lightweight"** — §3.3 "a **lightweight** Express-based gateway service"; §6.3 Quarterly Check-in is "**Lightweight** — progress update + blockers." Neither is bounded.
- **"advanced structured"** — §14 Recruitment—Pipeline "**Advanced structured** + AI resume screening" — a marketing phrase with no referent anywhere in §5.4.
- **"seamless"** — §1 "single SSO layer ... for **seamless** user experience."
- **"reasonable"** — not present (good), but its cousins are: "stale cache is **acceptable** for login" (§4.3) with no staleness bound except the >24h fallback in §8.5; "in whatever way suits them" (§7.5.4) for time entry.

Non-functional thresholds are almost entirely absent and this is acknowledged/deliberate: **no concurrency, throughput, latency, data-volume, or user-count numbers anywhere.** The only quantified NFRs are token lifetimes (15 min / 7 d, §4.4), RPO ≤ 24h / RTO ≤ 4h (§10.6), key rotation "quarterly," retention "minimum 7 years," reconciliation ">2 days," and minimum cohort sizes (2 responses, "e.g., 8 employees" §10.3). "≥ 1 warm instance" (§9.1) is the only availability-shaped number and it has no SLA behind it. There is no acceptance section anywhere in the document.

A few requirements *do* carry testable consequences and should be credited: the AI screening flow ("match score per candidate (0–100)," "advisory only — the UI never allows auto-rejection on AI score alone," §5.4.3/§10.5); the sync idempotency/reversal/reconciliation rules (§7.5.4); anonymity withholding below 2 responses (§10.3); scoring weights self/peer/sub/manager = 10/20/20/50 (§6.4.3). These are the exception, not the rule.

### Findings
- **critical** No acceptance criteria on functional requirements (§5.4, §6.4, §7.5 throughout) — features are capability bullets with no "done" condition or edge-case behavior (what happens when an approver in the chain has left? when headcount is reduced below filled? when a peer nomination is rejected?). Story creation will have to invent all of it. *Fix:* add at least one testable consequence per FR, or an Acceptance Criteria block per feature group.
- **critical** No non-functional thresholds for scale/performance (whole doc; §10.6 is DR-only) — concurrency, response-time, data-volume, and user-count are absent. The brief notes this is deliberate, but nothing in the doc *states* it is deferred, so downstream architecture cannot tell "unknown" from "unbounded." *Fix:* add an explicit "Performance & scale targets: deferred to architecture — expected order-of-magnitude is N users / M concurrent" line, even if approximate.
- **high** Unbounded vague qualifiers used as spec (§3.3 "lightweight"; §6.3 "Lightweight"; §14 "Advanced structured"; §1 "seamless") — each carries requirement weight without a definition. "Advanced structured" in particular has no expansion anywhere in §5.4. *Fix:* replace with the concrete behavior each is standing in for, or delete.
- **medium** Cache-staleness contract is soft (§4.3 "stale cache is acceptable for login") — "acceptable" is undefined except the §8.5 >24h refetch; login-time role staleness has security implications (a revoked role could persist up to a sync cycle). *Fix:* state the maximum tolerated staleness for auth-relevant fields and whether role revocation forces an immediate re-sync.

## Scope honesty — thin

Scope is handled unevenly. Where the doc *does* address omissions it is admirably explicit: cross-module reporting is "**out of scope** for the initial build" (§11); §6.5/§14 mark BS4 push as "Partial — recommendations only"; §7.5.4 says "no start/stop timer"; subtasks are "one level deep" (§7.5.2); the change logs document what was added and when. Phasing (§13) also functions as a rough scope boundary.

But there is **no consolidated Non-Goals section**, and no `[NON-GOAL for MVP]` callouts, so most exclusions must be *inferred* from their absence. Notable silent gaps: mobile/responsive support (never mentioned), offline behavior, bulk data import/export beyond the one-time backfill, SLA/support model, i18n scope beyond "multi-language templates," and what happens to the external portal for declined candidates. More seriously for the rubric: there are **no `[ASSUMPTION: …]` tags anywhere and no Assumptions Index**, yet the document clearly rests on inferences (that BS4 exposes the seven GET endpoints in §8.3; that Directus accepts an idempotency key and deduplicates on it, §7.5.4; that job boards have usable APIs). These are stated as fact, not tagged as assumptions to confirm. Given this is a green-light-toward-build chain-top artifact, un-tagged assumptions are a real downstream hazard.

### Findings
- **high** No Non-Goals / deferred-scope section (whole doc) — exclusions exist but are scattered inline (§11, §7.5.4) or must be inferred (mobile, offline, export, SLA). A single Non-Goals list is where this would do real work. *Fix:* add a Non-Goals section consolidating the inline exclusions plus the inferred ones.
- **high** No tagged assumptions or Assumptions Index (§8.3, §7.5.4, §5.3) — external-dependency assumptions (BS4 endpoint shapes, Directus dedup-on-key behavior, job-board API availability) are asserted as fact. *Fix:* tag each external-contract assumption `[ASSUMPTION: …]` and index them so the BS4/Directus/board contract reviews have a checklist.
- **low** Change logs partly substitute for scope narrative (§ top) — useful, but a reader without v1.0/v1.1 context can't reconstruct what was cut vs. never in. *Fix:* fold net exclusions into the Non-Goals section.

## Downstream usability — adequate

As a chain-top feed this is a mixed picture, weighted by the rubric toward "downstream matters more." Strengths: the §-cross-reference system is heavily used and **every reference resolves** — I verified 3.3, 3.5, 4.3, 4.5, 7.5.4, 8.4, 8.5, 9.4, 10.3, 10.4, 10.5, 10.7, 11.1, 11.3, and 12 all point to real, correctly-numbered sections. Section numbering is contiguous (1–14, with clean sub-numbering). §14 "Confirmed Decisions — Master Reference" is an excellent extraction surface for architecture. Data-model tables are concrete enough to source schema work directly, and the §12 project structure maps services to ports and schemas consistently.

Weaknesses that will cost downstream workflows: **there is no glossary**, so domain nouns are defined only by first use and drift in a few places (see Mechanical notes). There are **no FR / UJ / SM IDs** — requirements are prose bullets under numbered headings, so there is nothing stable for stories to cite ("implements FR-x"); downstream must reference by section number, which is coarse (a §5.4.4 has ~6 distinct requirements). And there are **no user journeys at all** — for the module-heavy, multi-role parts (recruitment candidate/agency flows, 360° feedback across five reviewer types) this is a genuine gap even granting the internal-tool shape (see Shape fit).

### Findings
- **high** No stable requirement IDs (§5–§9) — requirements are unnumbered bullets; nothing for stories/tests to reference precisely. Section numbers are too coarse (multiple requirements per §x.x.x). *Fix:* assign FR IDs (e.g., REC-FR-012) to each requirement bullet, or at minimum to each feature sub-section.
- **medium** No glossary (whole doc) — terms like "cycle," "stage," "requisition," "snapshot," "reversal entry," "calibration," "cohort" are defined only by usage. Story/UX workflows can't source a canonical definition. *Fix:* add a short glossary of the ~15 domain nouns.

## Shape fit — adequate

The document has largely chosen the right shape for its content: a **capability-plus-architecture spec** for an internal multi-module tool, which the rubric explicitly says may treat UJs as overhead and SMs as operational. The heavy investment in data models, integration contracts, and cross-cutting services (auth, gateway, notification/workflow) is appropriate for a chain-top artifact feeding architecture. The brownfield reality is handled well: BS4 and Directus are treated as existing systems with pinned external contracts (§3.4, §8.3), and the snapshot cache explicitly derisks the brownfield dependency. Existing-vs-new is clear.

Where the shape is a slight mismatch: the Recruitment and Appraisal modules are **not** single-operator internal flows — recruitment spans HR Admin, Hiring Manager, external Candidate, and external Agency across an apply→screen→interview→offer→hire pipeline, and appraisal spans five reviewer types with anonymity and calibration. These are genuinely multi-stakeholder, UX-load-bearing flows where the rubric says named-protagonist UJs would be load-bearing — and there are none. So the doc is under-formalized on the journey side for exactly the two modules where journeys would earn their keep, while being appropriately capability-shaped for the Project module and the shared foundation. Net: adequate, not broken, because the role tables (§5.2, §6.2, §7.2) and workflow lists (§9.3) partially compensate.

### Findings
- **medium** No user journeys for the multi-stakeholder flows (§5, §6) — recruitment (candidate/agency external + HR/HM internal) and 360° appraisal are UX-heavy, multi-role journeys with handoffs; role tables and §9.3 workflows only partially cover the sequence and none name a protagonist walking through it. *Fix:* add 2–4 named-protagonist UJs for the highest-stakes flows (candidate apply→offer; employee 360° cycle), leaving the Project module capability-shaped.

## Mechanical notes

- **Cross-references: clean.** All inline `see x.y` / `(x.y)` references resolve to existing, correctly-numbered sections (verified 3.3, 3.5, 4.3, 4.5, 7.5.4, 8.4, 8.5, 9.4, 10.3, 10.4, 10.5, 10.7, 11.1, 11.3, 12). No dangling refs found. This is a notable strength.
- **Section-ID continuity: clean.** Headings run 1–14 with contiguous sub-numbering; no gaps or duplicates. TOC anchors match headings.
- **Glossary drift (minor):** "Hiring Manager" (§5.2) vs. "HM" (§5.4.3 "HR/HM"); "Notification & Workflow Service" vs. "Notification Service" (§2 Email row "Notification service") vs. "workflow engine" (§9.2) — same component, three surface forms. "Directus ERP" (§7.1, §8) vs. "existing Directus ERP" (§1) — fine but inconsistent qualifier. "operational tasks" vs. "Operational Tasks" vs. "BAU" (§7.3). Low impact; a glossary would fix all.
- **Assumptions Index: absent.** No inline `[ASSUMPTION]` tags exist, so nothing to round-trip — flagged under Scope honesty as a gap, not a drift.
- **UJ protagonists: N/A** — no UJs present (see Shape fit / Downstream usability).
- **Data-model consistency: good.** Schema list (`auth, common, recruitment, appraisal, project, notification`) is stated identically in §1, §2, §14, §12; port assignments (3000–3005, 8080, 3310) are consistent across §3.1 and §12. `common.document` and `common.employee_snapshot` referenced consistently across modules.
- **Required sections for stakes/type:** present — architecture, data models, integration contracts, security/compliance, phasing, decisions register. Missing for a build-feeding artifact: Non-Goals, Assumptions Index, Glossary, and any acceptance/NFR-threshold section.
