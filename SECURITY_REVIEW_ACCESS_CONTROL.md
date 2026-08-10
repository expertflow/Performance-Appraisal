# Access Control & Data Handling Review

**Date:** 2026-08-10
**Scope:** `backend/` (Express API), `hr-suite/` (Angular app)
**Reviewed at:** commit `5adc3388` (tip of `main`)
**Method:** static read of route handlers, guards, services, and the Angular data-loading paths. No live system was probed and no exploit was executed — every finding below is traced to a file and line in this repository.

This document answers three questions:

1. Does the tooling prevent employee A from seeing employee B's performance appraisals?
2. How are CV attachments handled in the recruitment stage?
3. Does any of it integrate with Gmail?

§2 reconciles these findings with the development team's account of the module, which describes role-based access as already applied. A short description of what the Project Management module covers is included at the end, since it shares the same data-access pattern.

---

## 1. Executive summary

| # | Finding | Severity | Status |
|---|---|---|---|
| F-1 | Appraisal API has no authentication — every endpoint is anonymous | Critical | Open |
| F-2 | Record/goal scoping comes from client-supplied query parameters | Critical | Open |
| F-3 | The user's role lives in `localStorage` and is never verified server-side | Critical | Open |
| F-4 | Appraisal dashboard downloads all colleagues' records into every browser | High | Open |
| F-5 | Appraisal writes/deletes have no ownership check | High | Open |
| F-6 | CVs stored as base64 in a Postgres text column, served to anonymous callers | High | Open |
| F-7 | Passwords stored and compared in plaintext | Critical | Open |
| F-8 | Session tokens are static, non-expiring opaque strings | High | Open |
| F-9 | Notification feed trusts caller-supplied `role` and `userId` | Medium | Open |
| F-10 | `backend/.env` is tracked in git despite the `.gitignore` rule | Low | Open |

Role-based scoping **is** implemented for the appraisal module, in the Angular components — it is real, and it matches the model the team describes. Every finding above concerns the API beneath it, which enforces none of that scoping. See §2.

**Headline:** there is currently no server-side access control anywhere in the API. Separation between employees exists only as filtering inside the Angular app, which any user can bypass with a single unauthenticated HTTP request. This is a gap against the project's own specification, not just against general good practice — `HR_SUITE_REQUIREMENTS.md:222` requires "RBAC enforced at API Gateway and service level", and `:298` requires that "every external-facing query in a module service applies a **mandatory scoping predicate**… A request with no valid external scope returns **empty**, never all rows."

---

## 2. Reconciling the developer's account

The developer describes the module as follows:

> "I have applied security to the Performance Appraisal module. A manager can only view the appraisals of employees in their own team, while each employee can only view their own appraisal and the feedback they have received. Only the App Admin and HR/Finance roles have access to view all performance appraisals and the complete data."

**That description of the intended model is correct, and the scoping logic it describes genuinely exists.** The disagreement is narrow and specific: **the logic lives in the Angular components, not in the API.** Both statements can be true at once — the UI behaves exactly as described, and the API enforces none of it.

### What was actually built

The role-scoping code is real and matches the description closely:

- `hr-suite/src/app/pages/appraisal/organogram/organogram.ts:75-90` — AppAdmin/HR unfiltered; Manager filtered to own subtree via `collectSubtreeIds()`; Employee filtered to manager + self + direct reports.
- `hr-suite/src/app/pages/appraisal/feedback/feedback.ts:62-79` — Employee loads `{ employeeId: me }`, Manager loads `{ managerId: me }`, HR/Admin loads unfiltered.
- `hr-suite/src/app/pages/appraisal/goals/goals.ts:50-58` — the same three-way split.
- `hr-suite/src/app/app.routes.ts:124-148` — `roleGuard` on each appraisal route.

A user logging into the deployed app sees precisely what the developer says they see. Nothing in this review disputes that.

### Where the accounts diverge

Every one of those checks runs in the user's own browser, on data the browser has already been given, using a role read from the user's own `localStorage`. None of it constrains what the API returns.

Four verifications, run against the tip of `main` (`5adc3388`):

1. **The appraisal backend is unchanged.** `git diff 603129f5 origin/main -- backend/src/routes/performance-appraisals.js backend/src/index.js` returns empty. The route file contains no reference to `req.user`, `req.headers`, or any role value — searchable in full at `backend/src/routes/performance-appraisals.js`.

2. **JWT authentication is declared but never built.** `APP_GOALS.md:248` lists "JWT auth, role guards on all routes, backend role checks" as delivered. `jsonwebtoken` is indeed a dependency (`backend/package.json:17`) — but it is never imported anywhere in `backend/src`. There is no `jwt.sign`, no `jwt.verify`, no auth middleware. Tokens are static uuid strings (`auth-local.js:323`, `auth-google.js` `google-token-${uuidv4()}`), and no data endpoint reads them. The dependency was added; the feature was not.

3. **CR-012 documents itself as frontend-only.** The change request that introduced organogram scoping (`USER_INPUT.md:205-230`) lists its own "What Changed" as three files: `organogram.ts`, `organogram.html`, `organogram.scss`. Commit `737352d6` confirms: 3 files changed, all under `hr-suite/src/app/pages/appraisal/organogram/`. No backend file was touched. This is consistent — the work was scoped as a UI change and delivered as one.

4. **The filtered views operate on unfiltered data.** `organogram.ts:58-65` fetches the complete employee roster via `api.getEmployees()` and stores it in `allEmployees`; `buildTree()` then filters that in-memory copy for rendering. The full company roster is in every user's browser regardless of role. The appraisal dashboard does the same with appraisal content — `dashboard.ts:120` requests the entire cycle for all roles and narrows at `:132`.

Point 4 is the one worth dwelling on, because it does not require an attacker. An Employee opening `/appraisal` today has their colleagues' `selfReview`, `managerReview`, and `rating` sitting in their browser's memory and network log. The UI declines to render it. Opening devtools reads it. No tampering, no crafted request, no technical skill beyond F12.

### Why the distinction matters

A role check in the browser answers "what should this user be shown?" A role check in the API answers "what is this user allowed to receive?" Only the second survives a caller who is not the app. Because `/api/v1/appraisals/records` requires no token at all, the bypass is not even an authenticated-user escalation — anyone who can reach the host retrieves every appraisal in the company, with no account.

The gap is also measured against this project's own documents, not an external standard:

| Document | Requirement | Built? |
|---|---|---|
| `APP_GOALS.md:222` | "Role-based access enforced at both frontend and backend" | Frontend only |
| `APP_GOALS.md:248` | "JWT auth, role guards on all routes, backend role checks" | Route guards only |
| `HR_SUITE_REQUIREMENTS.md:222` | "RBAC enforced at API Gateway and service level" | No |
| `HR_SUITE_REQUIREMENTS.md:298` | Mandatory scoping predicate; no scope returns empty, never all rows | No |

`APP_GOALS.md:45-54` ("Goal 3 — Enforce Role-Based Data Access") states the target model in the same terms the developer used. The model is agreed. What remains is to move its enforcement from the browser to the server — the findings in §3 below are the specific work that requires, and the scoping rules to implement are exactly the ones the developer articulated.

**Net:** treat the frontend scoping as complete and correct at the presentation layer, and the backend enforcement as not yet started. The remediation in §8 does not replace the developer's work; it puts a server-side twin behind it.

---

## 3. Can employee A see employee B's appraisal?

**Yes — trivially, and without needing an account.**

### F-1 · The API has no authentication layer

`backend/src/index.js:66` mounts the appraisal router with nothing in front of it:

```js
app.use('/api/v1/appraisals', performanceAppraisalsRouter);
```

The global middleware stack (`index.js:34-46`) is `helmet`, `cors`, `morgan`, and body parsers — no authentication, no session handling, no RBAC. Across the entire backend only two handlers ever read the `Authorization` header: `set-password` and `change-password` (`backend/src/routes/auth-local.js:311-342`, `:346+`). `performance-appraisals.js` never references `req.headers` or `req.user`; it has no concept of a caller.

The Angular app does attach a bearer token to every request (`hr-suite/src/app/interceptors/auth.interceptor.ts:5-11`), but no appraisal endpoint reads it. The token is decorative.

### F-2 · Scoping is a query parameter the caller chooses

`performance-appraisals.js:221-245` builds its `WHERE` clause purely from `req.query`:

```js
if (managerId)  { conditions.push(`r.manager_id=$${i++}`);  vals.push(managerId); }
if (employeeId) { conditions.push(`r.employee_id=$${i++}`); vals.push(employeeId); }
if (cycleId)    { conditions.push(`r.cycle_id=$${i++}`);    vals.push(cycleId); }
const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
```

When no parameters are supplied, `where` is the empty string and the query is an unfiltered `SELECT` across the whole table. So:

```
GET /api/v1/appraisals/records
```

returns every appraisal record in the company — `self_review`, `manager_review`, `rating`, `goals_met`, `status` — to anyone who can reach the host, with no token. `/goals` (`:307-323`) has the same shape. `/team?managerId=` (`:396-420`) returns any manager's direct reports for the asking.

The client decides its own scope. `hr-suite/src/app/pages/appraisal/feedback/feedback.ts:62-79` and `goals/goals.ts:50-58`:

```ts
if (this.auth.isEmployee())      this.store.loadRecords({ employeeId: user.employee_id });
else if (this.auth.isManager())  this.store.loadRecords({ managerId: user.employee_id });
else                             this.store.loadRecords();   // HR/Admin: everything
```

Employee A only has to send `?employeeId=<B's id>`, or omit the parameter entirely, to read B's data. No credential is involved at any point.

### F-3 · The role is client-owned state

`hr-suite/src/app/services/auth.ts:159-166` loads the current user — including `role` — out of `localStorage['hr_suite_user']`. `roleGuard` (`hr-suite/src/app/guards/role.guard.ts:10-17`) and `authGuard` (`guards/auth.guard.ts:5-24`) compare against that value. Editing one localStorage key in devtools promotes an Employee to HR in the UI. Because the server never checks anyway, the guards only decide which Angular components render — they are a navigation convenience, not a security control.

### F-4 · The dashboard already ships everyone's data to every browser

This one requires no tampering at all. `hr-suite/src/app/pages/appraisal/dashboard/dashboard.ts:120` fetches the full cycle for **all** roles:

```ts
const records$ = this.api.getAppraisalRecords({ cycleId });   // no employee/manager filter
```

and then narrows in the browser at `:132` (`records.find(r => r.employeeId === user.id)`). An Employee's own dashboard downloads colleagues' `selfReview`, `managerReview`, and `rating` into their tab and simply declines to paint most of it. Devtools → Network is sufficient to read it.

### F-5 · Writes and deletes are equally open

`PATCH /records/:id` (`:267-290`), `DELETE /records/:id` (`:293-300`), `PATCH /goals/:id` (`:359-379`), and `DELETE /goals/:id` (`:382-389`) accept any id with no ownership check and no field-level rules. Employee A can rewrite or delete B's manager review and rating, and can create or delete appraisal cycles (`:168-191`).

### Adjacent auth weaknesses

- **F-7 · Plaintext passwords.** Compared with `rows[0].password !== password` (`auth-local.js:100`) and written raw at `:334` and `:375`. A database read discloses every credential directly.
- **F-8 · Static tokens.** Session tokens are opaque strings in `auth_local.account.token`, matched with `WHERE token = $1` (`:323`, `:361`). No expiry, no rotation, no signature, no revocation path beyond editing the row.
- **F-9 · Notification feed.** `GET /api/v1/notifications?role=&userId=` (`backend/src/routes/notifications.js:29-40`) trusts caller-supplied `role` and `userId`. Appraisal goal notifications carry goal titles in the body (`performance-appraisals.js:341-350`), so this is a second read path to appraisal content.
- **CORS is not a control here.** The allowlist at `index.js:35-43` constrains browsers on other origins. It does nothing against `curl`, Postman, or any non-browser client.

### Remediation

1. Issue real tokens (signed and expiring), and add an `authenticate` middleware that resolves `req.user` from `auth_local.account`, applied to the appraisal router and every other data router.
2. Derive scoping server-side: ignore `employeeId`/`managerId` from the query string and inject the predicate from `req.user` — Employee → `employee_id = me`; Manager → `manager_id = me` (or a reports subquery for skip-level); HR/AppAdmin → unfiltered. A request that resolves to no scope returns empty, never all rows (per `HR_SUITE_REQUIREMENTS.md:298`).
3. Add ownership checks to every `PATCH`/`DELETE`, including field-level rules — an employee may write `self_review`, but not `rating` or `manager_review`.
4. Change the dashboard to request a pre-scoped aggregate instead of pulling the full cycle and filtering client-side.
5. Hash passwords (bcrypt or argon2) with a migration for existing plaintext rows.

Items 1–4 are the containment fix and hang together. Item 5 is separable.

---

## 4. CV attachments in recruitment

### How it works today

**Upload is base64-in-JSON, not a file upload.** `hr-suite/src/app/pages/candidate/jobs/jobs.ts:111-116` reads the selected PDF with `FileReader.readAsDataURL()` and holds the resulting `data:application/pdf;base64,…` string in a signal. `:144` posts that string as an ordinary JSON field named `resumeLink`.

**Storage is a Postgres text column.** `backend/src/db/migrate.js:184-185` declares:

```sql
resume_link       TEXT NOT NULL,
resume_file_name  TEXT DEFAULT '',
```

`backend/src/routes/job-applications.js:443-453` inserts the base64 blob straight into `recruitment.job_application.resume_link`. There is no object storage, no `common.document` metadata row, and no filesystem involved. Express is configured for a 20 MB JSON body (`index.js:45`) to accommodate this.

**Retrieval hands the blob back in JSON.** `mapRow` returns `resumeLink` verbatim (`job-applications.js:32-33`), and the UI renders it as a download anchor whose `href` is the data URL itself — `hr-suite/src/app/pages/recruitment/pipeline/pipeline.html:102`, `applications/applications.html:98`, and the candidate's own `my-applications.html:173`.

**Validation is client-side only.** `jobs.ts:96-105` checks `file.type === 'application/pdf'` and `file.size > 5 * 1024 * 1024`. Both run in the browser. `POST /api/v1/job-applications` (`:419-465`) checks only that `resumeLink` is non-empty (`:426`) — it never validates the MIME prefix, decodes the payload, checks magic bytes, or enforces a size ceiling beyond the 20 MB body limit.

### Assessment

- **F-6 · CVs are readable anonymously.** `GET /api/v1/job-applications` (`:385-402`) and `GET /api/v1/job-applications/:id` (`:405-417`) have no auth, exactly as with appraisals. `candidate_id` and `job_id` are optional filters; omitting them returns every application with every CV embedded. That is a bulk personal-data disclosure — names, emails, phone numbers, addresses, and full résumé PDFs — reachable by an unauthenticated `curl`. Under GDPR-style obligations (flagged as open question OQ-8 at `HR_SUITE_REQUIREMENTS.md:1462`) this is the most consequential finding in the recruitment module.
- **No malware scanning.** The spec calls for ClamAV on every upload before persist (`HR_SUITE_REQUIREMENTS.md:72`, `:1102`, `:1324`). Nothing of the sort exists in the code. Because a data URL is rendered as a download link, a candidate can upload any bytes they like with a `application/pdf` prefix, and a recruiter's click opens it.
- **The declared type is attacker-controlled.** The `data:` prefix comes from the client. A caller posting directly to the API can set any MIME type; the browser will honour it on download.
- **Base64 in a row is a poor fit operationally.** ~33% size inflation, blobs inside every `SELECT *` (`:387`, `:407`) and therefore in every list response, no range requests, no CDN, no lifecycle/retention policy, and a right-to-erasure workflow that has to rewrite table rows rather than delete objects. Table and backup growth track total CV volume directly.
- **Divergence from the spec is total, not partial.** `HR_SUITE_REQUIREMENTS.md:469` — "Resume files live in object storage; `common.document` holds metadata + virus scan status". `:1092` — all uploaded files in S3-compatible object storage. `:1104` — downloads go through the web app after an authz check, via pre-signed URLs with a ≤ 60 s TTL. `:1106` — the auditable event is URL issuance. None of that is built; the current design has no point at which an authz check or an audit event could even be inserted, because the bytes travel inside the ordinary list response.

### One more thing worth flagging: AI screening receives base64, not text

`job-applications.js:194` and `:307` build the LLM prompt like this:

```js
app.resume_link ? `RESUME (base64 PDF data — candidate uploaded CV):\n${app.resume_link.slice(0, 2000)}` : '',
```

The first 2 000 characters of a base64-encoded PDF are the file header and compressed stream — not readable text. The model is being asked to screen a candidate against a payload that carries essentially no information about them, then its output is stored as a screening score. So auto-screening (`autoScreenApplication`, `:162`) is not merely insecure — its scores are not meaningfully derived from the CV. Note that `POST /api/v1/ai/screen-resume` (`backend/src/routes/ai-screen.js:14`) has a `resumeText` parameter that *would* work correctly; the application path simply never populates it, because no PDF text extraction step exists.

Two consequences follow. Any decision made on those scores is unsupported, which matters if screening outcomes are ever challenged. And the same fix — server-side PDF text extraction — resolves both the screening-quality problem and the input needed for a proper `common.document` pipeline.

### Recommended target

1. Switch to `multipart/form-data` with a streaming parser (`multer` or equivalent) and a hard size limit enforced server-side.
2. Validate by magic bytes, not by the client-declared MIME type.
3. Scan with ClamAV before persisting; record `scan_status` on a `common.document` row.
4. Store the object in S3-compatible storage; keep only the metadata/reference in `recruitment.job_application`.
5. Serve downloads through an authenticated endpoint that authorizes, logs the issuance, and returns a short-TTL pre-signed URL.
6. Extract PDF text server-side and feed `resumeText` to the screening endpoint.
7. Stop returning blob columns in list queries — replace `SELECT *` at `:387` and `:407` with explicit column lists.

---

## 5. Gmail integration

**There is no Gmail integration.** Nothing in the codebase uses the Gmail API, and no OAuth scope is requested that would permit it.

What exists is two separate things that are easy to mistake for it:

**Google Sign-In (identity only).** `backend/src/routes/auth-google.js:60-76` registers a Passport `GoogleStrategy` with `scope: ['profile', 'email']`. Those scopes grant the user's name, email address, and avatar — nothing more. The callback (`:68-110`) uses the email to find or create an `auth_local.account`, resolves the role (internal domain → Manager/Employee via `resolveRoleFromDirectus`; external → Candidate), and issues a `google-token-<uuid>` string. The `accessToken` and `refreshToken` arguments are received but never stored or used, so there is no live Google credential to call any API with. `session: false` at `:144` and `:149` confirms it is login-only.

**Outbound mail over SMTP via nodemailer.** `backend/src/routes/send-email.js:18-42` builds a nodemailer transport from `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASS` and sends. The same block is duplicated in `auth-local.js:25-45` for OTP delivery. This is generic SMTP — it would work against Gmail's SMTP relay if pointed at `smtp.gmail.com` with an app password, but equally against any other provider. That is a configuration choice, not an integration: no Gmail-specific API, no threading, no labels, no reading of mail, no send-as, no delivery/bounce tracking.

Three consequences worth noting:

- **When `SMTP_HOST` is unset, mail silently does not send.** Both `send-email.js:44-48` and `auth-local.js:39-44` fall through to a console stub that returns `{ sent: true, stub: true }`. Callers that only check for a 200 treat this as success. Since account verification OTPs travel this path, a deployment missing `SMTP_HOST` produces accounts that can never verify, with no error surfaced anywhere.
- **`POST /api/v1/send-email` is an unauthenticated open relay-by-proxy.** It accepts arbitrary `to`, `subject`, and `html` (`:11-15`) from any caller with no auth and no allowlist, and sends from the configured company address. Anyone who can reach the API can send arbitrary HTML mail to arbitrary recipients as `hr@expertflow.com`. That is a phishing primitive using your domain's reputation, and a fast route to that domain being blocklisted. It should require authentication and be restricted to server-side template invocation rather than caller-supplied HTML.
- **SMTP credentials are not in either `.env.example`.** Neither the root nor `backend/.env.example` documents the `SMTP_*` variables the code reads, so a fresh deployment lands in stub mode by default without any signal that it has.

If real Gmail integration is wanted later — sending as the HR mailbox, threading candidate correspondence, reading replies into the pipeline — that is a distinct piece of work: Gmail API scopes (`gmail.send`, `gmail.readonly`), a domain-wide-delegated service account or per-user OAuth with stored refresh tokens, and Google verification for restricted scopes. None of the current groundwork carries over except the `passport-google-oauth20` dependency.

---

## 6. Project Management module — what it covers

Included briefly for context, since it shares the access-control pattern above.

**Feature surface** (`hr-suite/src/app/app.routes.ts:150-186`, components under `hr-suite/src/app/pages/project-management/`):

| Route | Purpose |
|---|---|
| `/projects` | Portfolio dashboard — aggregate project stats |
| `/projects/all` | Project list with CRUD |
| `/tasks` | Task list with status and project filters |
| `/tasks/:id` | Subtask detail (tasks self-reference via `parent_task_id`) |
| `/kanban` | Board view, drag-to-change-status |
| `/gantt` | Timeline view |
| `/timesheet` | Time-entry logging and review |

**Backend:** `projects.js` (list/detail/create/update/delete plus `POST /sync`), `tasks.js` (including `GET /:id/subtasks` and a self-join that returns subtasks nested under each parent), and `time-entries.js` (CRUD plus `GET /directus-summary`).

**Directus/BS4 coupling:** this module is the integration point with the `bs4.expertflow.com` Directus ERP. `backend/src/services/sync.js` runs bidirectionally — pushing local time entries with `directus_sync_status = 'pending'` up to the Directus `TimeEntry` collection, then pulling remote changes back down and upserting by `directus_id`. Failures are recorded in `project.directus_sync_log` with an idempotency key and attempt count. A cron job at `index.js:84-93` runs the sync nightly at 00:00 `Asia/Karachi`. `project.employee_snapshot`, populated from the same source, is also what the appraisal module reads for reporting lines (`performance-appraisals.js:400`) and what login uses to auto-promote a user to Manager (`auth-local.js:66-87`).

**Same access-control gap.** All three routers are mounted without auth (`index.js:54-57`), and the query builders follow the same optional-filter pattern: `tasks.js:7-20` and `time-entries.js:122-133` produce an unfiltered `SELECT` when no parameters are passed. `GET /api/v1/time-entries` with no arguments returns every employee's logged hours, joined to their name via `employee_snapshot` (`:135-149`). The four route guards on these pages (`app.routes.ts:150-186`) allow all internal roles and, as established in §3, are cosmetic. Any fix applied to the appraisal module should be applied here in the same pass — the middleware is shared, so the marginal cost is small.

---

## 7. Note on repository hygiene

**F-10.** `backend/.env` is tracked in git (first added in commit `c839189e`), even though `.gitignore` lists `.env` — `.gitignore` does not apply to files already tracked. As committed, `DB_PASSWORD` is the placeholder `changeme` and `DIRECTUS_TOKEN` is empty, so no live credential is currently exposed; `DB_HOST` and `DB_USER` hold real-looking internal values. The risk is prospective: any real value written to that file gets committed by default. Recommended fix is `git rm --cached backend/.env`, then rotate anything that has ever been committed there.

---

## 8. Suggested sequencing

**Immediately** — F-1, F-2, F-6. Authentication middleware plus server-derived scoping across `appraisals`, `job-applications`, `projects`, `tasks`, `time-entries`. This is one shared middleware and a scoping helper; the per-route change is small once those exist. Also lock down `POST /api/v1/send-email`.

**Next** — F-5, F-7, F-8. Ownership and field-level write rules; password hashing with migration; signed expiring tokens with revocation.

**Then** — the CV storage rework (multipart → magic-byte validation → ClamAV → object storage → pre-signed download), which also unblocks correct AI screening via server-side PDF text extraction.

**Housekeeping** — F-4 (dashboard aggregate endpoint), F-9 (server-derived notification scope), F-10 (untrack `.env`), and `SMTP_*` documentation in both `.env.example` files.
