# Handover — Backend Access Control for HR Suite

**To:** Zaeem Ahmad
**From:** Access control review, 2026-08-10
**Companion doc:** [`SECURITY_REVIEW_ACCESS_CONTROL.md`](SECURITY_REVIEW_ACCESS_CONTROL.md) — full findings with file:line evidence
**Repos cross-referenced:** `expertflow/BS4-ERP-CRM-Finance` (`0834e70e`), `expertflow/EFITAssets` (`cf7b0da4`)

---

## 1. What this is

A review of who can see what in the HR Suite, plus a check of two sibling repos so we don't rebuild things that already exist at ExpertFlow. This handover is the practical part: what to change, in what order, and what to copy rather than write.

The short version: **the access rules you designed are right. They need to run on the server as well as in the browser.** Most of the work below is porting decisions you've already made — not making new ones.

---

## 2. What's already correct — keep it

This is worth stating plainly, because the rest of the document is a to-do list and could otherwise read as if the module were unbuilt.

- **The scoping model is sound and fully specified.** `ROLE_ACCESS_MATRIX.md` §10.1 is a complete, unambiguous permission table. That's the hard thinking, and it's done.
- **The frontend implements it correctly.** `organogram.ts:75-90` (subtree BFS for managers, manager+self+reports for employees), `feedback.ts:62-79`, `goals.ts:50-58`, and `roleGuard` on every route in `app.routes.ts:124-148`. The deployed app behaves as documented.
- **The Directus/BS4 sync is solid.** Bidirectional with idempotency keys, attempt counts, and a failure log (`services/sync.js`, `project.directus_sync_log`). That's more careful than most integrations.
- **Google SSO is already wired** (`auth-google.js`) — which matters, because it means step 1 below is smaller than it looks.

None of this needs redoing. The remediation adds a server-side layer beneath it.

---

## 3. The core problem, in one paragraph

Every access check currently runs in the browser, using a role read from `localStorage`, on data the browser has already been given. The API has no authentication middleware at all (`backend/src/index.js:34-46`), and the appraisal handlers build their `WHERE` clause from query parameters the caller supplies (`performance-appraisals.js:221-245`). So `GET /api/v1/appraisals/records` with no token and no parameters returns every appraisal record in the company — self-reviews, manager reviews, ratings. The same is true of `/api/v1/job-applications` (every CV, every candidate's contact details), `/api/v1/time-entries`, `/api/v1/tasks`, and `/api/v1/employees`.

Worth knowing before you start: `Expertflow IT assets.md` §4.2.3 references a **salary-leak incident on 2026-07-07** in the ERP. HR data exposure is not hypothetical here, and appraisal content is in the same sensitivity class.

One consequence needs no attacker at all. The appraisal dashboard requests the whole cycle for every role (`dashboard.ts:120`) and filters client-side (`:132`). An Employee opening `/appraisal` already has colleagues' review text and ratings in their browser's network log. The UI declines to render it; devtools reads it. Fixing that one is a small change and I'd do it early — see step 4.

---

## 4. What to do

### Step 1 — Authentication middleware (blocks everything else)

Create `backend/src/middleware/auth.js`. Resolve the caller once, attach to `req.user`, and mount it in front of every data router.

EFITAssets has a working version of exactly this pattern at `efgateway/api/auth.py:19-50` — verify token, check `email_verified`, check the domain, return a principal. It's about thirty lines. Same IdP, same domain restriction; only the language differs.

```js
// backend/src/middleware/auth.js
module.exports = async function authenticate(req, res, next) {
  const header = req.headers.authorization || '';
  const token  = header.startsWith('Bearer ') ? header.slice(7) : '';
  if (!token) return res.status(401).json({ error: 'Authentication required' });

  const { rows } = await pool.query(
    `SELECT id, email, name, role, employee_id, status
       FROM auth_local.account
      WHERE token = $1`, [token]
  );
  if (!rows.length)                  return res.status(401).json({ error: 'Invalid token' });
  if (rows[0].status !== 'Active')   return res.status(403).json({ error: 'Account inactive' });

  req.user = rows[0];   // role comes from the DB — never from the request
  next();
};
```

Then in `index.js`, in front of the data routers (leave `/auth-local`, `/auth/google`, and `/health` open):

```js
app.use('/api/v1/appraisals',       authenticate, performanceAppraisalsRouter);
app.use('/api/v1/job-applications', authenticate, jobApplicationsRouter);
app.use('/api/v1/employees',        authenticate, employeesRouter);
app.use('/api/v1/time-entries',     authenticate, timeEntriesRouter);
app.use('/api/v1/tasks',            authenticate, tasksRouter);
app.use('/api/v1/projects',         authenticate, projectsRouter);
app.use('/api/v1/notifications',    authenticate, notificationsRouter);
app.use('/api/v1/send-email',       authenticate, sendEmailRouter);
```

The interceptor already sends the token (`auth.interceptor.ts:5-11`), so the frontend needs no change for this step.

`POST /api/v1/send-email` deserves particular attention: it currently accepts arbitrary `to`/`subject`/`html` from anyone and sends as `hr@expertflow.com`. That's a phishing primitive on our own domain. Authenticate it, and ideally move to server-side templates so callers pass a template name and parameters rather than raw HTML.

**Note on tokens:** the current token is a static string in `auth_local.account.token`, with no expiry and no rotation. The middleware above works with it as-is, so it doesn't block you. Replacing it with a signed, expiring token is step 6 — `jsonwebtoken` is already in `package.json:17`, just never imported.

### Step 2 — Server-derived scoping

This is the core change. **Ignore `employeeId` and `managerId` from the query string entirely** and derive the predicate from `req.user`. A helper keeps it consistent:

```js
// backend/src/middleware/scope.js
// Returns { clause, values } to AND into any appraisal query.
async function appraisalScope(user, alias = 'r') {
  if (user.role === 'AppAdmin' || user.role === 'HR') {
    return { clause: '', values: [] };                       // unrestricted
  }
  if (user.role === 'Manager') {
    return {
      clause: `${alias}.manager_id = $1`,
      values: [user.employee_id],
    };
  }
  if (user.role === 'Employee') {
    return {
      clause: `${alias}.employee_id = $1`,
      values: [user.employee_id],
    };
  }
  return { clause: 'FALSE', values: [] };                    // unknown role → no rows
}
```

That last line matters and is easy to skip: an unrecognised or missing role must return **nothing**, not everything. `HR_SUITE_REQUIREMENTS.md:298` puts it as "a request with no valid external scope returns empty, never all rows." The current code does the opposite — no filter means no `WHERE`.

Apply it in `performance-appraisals.js` at `/records` (`:221`), `/goals` (`:307`), and `/team` (`:396`). `cycleId` stays a user-supplied filter — it narrows within the permitted set, so it's fine.

Manager scope is currently direct reports only (`manager_id = me`). The organogram already does full-subtree via `collectSubtreeIds()`. Worth confirming with HR which one the appraisal rules intend — if it's skip-level, this becomes a recursive CTE over `employee_snapshot`. Flagging rather than assuming.

### Step 3 — Ownership and field rules on writes

`PATCH /records/:id`, `DELETE /records/:id`, `PATCH /goals/:id`, `DELETE /goals/:id` currently accept any id from any caller. Two checks needed: does this row fall inside the caller's scope, and may this role write *this field*?

Per `ROLE_ACCESS_MATRIX.md` §10.1, an Employee can update their own goal progress and self-review, but not `rating` or `manager_review`. So field-level filtering, not just row-level:

```js
const EMPLOYEE_WRITABLE = new Set(['selfReview', 'progress']);

if (req.user.role === 'Employee') {
  const attempted = Object.keys(req.body);
  const forbidden = attempted.filter(f => !EMPLOYEE_WRITABLE.has(f));
  if (forbidden.length) {
    return res.status(403).json({ error: `Cannot modify: ${forbidden.join(', ')}` });
  }
}
```

Cycle create/delete (`:168`, `:184`) should be AppAdmin/HR only — the matrix already says so.

### Step 4 — Stop shipping everyone's data to the browser

Independent of the above and quick. `dashboard.ts:120` calls `getAppraisalRecords({ cycleId })` with no scope and filters at `:132`. Add a backend aggregate endpoint that returns only the numbers the dashboard renders (counts, averages, distribution) plus the caller's own record — not the full row set. Once step 2 lands, the unscoped fetch will return only permitted rows anyway, but the dashboard should stop asking for rows it doesn't display.

Same pattern in `organogram.ts:58-65`, which pulls the full employee roster and filters in `buildTree()`.

### Step 5 — Password hashing

`auth-local.js:100` compares passwords in plaintext (`rows[0].password !== password`), and `:334`/`:375` store them raw. Use bcrypt or argon2, with a migration that re-hashes on next successful login (verify against plaintext once, write back a hash, flip a `password_algo` column).

### Step 6 — Real tokens

Signed and expiring, with revocation. `jsonwebtoken` is already a dependency. Do this after steps 1–3 — the middleware boundary from step 1 is what makes it a contained change.

---

## 5. Reuse, don't rebuild

Checked BS4 and EFITAssets specifically so we don't duplicate work.

| Need | Where it already exists | Notes |
|---|---|---|
| Auth middleware | `EFITAssets/efgateway/api/auth.py:19-50` | Google OIDC verification, domain check, DI-injected. ~30 lines, direct template for step 1. |
| CV upload → object storage | `BS4/projects/erp/directus/extensions/journal-gcs-upload/index.js:22-80` | `busboy` streamed into a GCS write stream. No base64. |
| Authorized file download | `BS4/…/gcs-access-proxy/index.js:47,102,235-266` | `verifyRlsAccess()` — permission check *then* serve, 401/403 otherwise. This is the step our current design has nowhere to put. |
| Document metadata model | `BS4` `Journal` + junction tables | The `common.document` shape `HR_SUITE_REQUIREMENTS.md:1092` asks for. |
| Outbound email | `BS4/services/chat-timebot/src/index.js:266-313` | nodemailer → `smtp.gmail.com:465`, app password from Secret Manager (`service.yaml:44-52`). |

**Two traps:**

- `BS4/projects/erp/directus/extensions/crm-gmail-sync/` contains **only a `package.json`** — no `index.js`. It declares `googleapis` and fails to load at runtime. Not prior art.
- EFITAssets' Gmail integration is **`gmail.readonly`** (`efgateway/api/connectors/gmail_oauth.py:39`) — it reads invoice attachments on a scheduler and *cannot send*. It does not help with OTP or candidate mail. Use the BS4 SMTP pattern for that.

**Not solved anywhere:** ClamAV. No virus scanning in either repo, so `HR_SUITE_REQUIREMENTS.md:1102` is unbuilt org-wide. If we do the CV storage rework, that part is genuinely new.

### On CVs specifically

Currently the PDF is base64'd in the browser (`jobs.ts:111-116`) and stored in a `TEXT` column (`migrate.js:184`). Target: `multipart/form-data` → magic-byte validation (not the client-declared MIME type) → ClamAV → GCS → metadata row → downloads through an authenticated endpoint issuing a short-TTL signed URL.

One side effect worth knowing: AI screening currently receives `resume_link.slice(0, 2000)` (`job-applications.js:194`, `:307`) — the first 2 000 characters of a base64 PDF, which is header and compressed stream, not text. The scores being stored aren't derived from CV content in any meaningful way. `POST /api/v1/ai/screen-resume` already accepts a `resumeText` parameter that would work correctly; nothing populates it because there's no PDF text extraction step. Adding extraction server-side fixes the screening quality and feeds the storage pipeline at the same time.

---

## 6. How our roles relate to the org IAM model

Relevant because you may hear "use the central RBAC" and it's more nuanced than that.

`EFITAssets/CENTRAL_IDP_RBAC_RECOMMENDATION.md` (decided 2026-07-10) sets Google Workspace as the identity master, with roles as Google Groups and OpenBao issuing credentials. But **there is no central authorization service** — no `/me`, no `/authz`, no token introspection. Each application verifies Google OIDC itself and enforces its own rules. BS4 does this with its own `UserToRole`/`RolePermissions` tables.

So:

- **Our own permission model is architecturally correct.** `ROLE_ACCESS_MATRIX.md` isn't redundant with the IAM work — it's the layer the IAM work explicitly leaves to each app. Keep it.
- **Our own identity model is not.** Local plaintext passwords and static tokens diverge from the standard. Google SSO is already wired; the gap is that the API doesn't verify anything afterwards.
- **`Manager` and `Employee` have no equivalent in the org groups.** The org model (`Expertflow IT assets.md` §4.2.1) is functional — `developers`, `hr-finance`, `marketing`, `support`, `infra-admins`, etc. There's an `ef-hr-finance` group that maps to our `HR` role, but no `manager`/`employee` group, and there shouldn't be: those are *relational* (manager-of-whom), derived from `employee_snapshot.manager_id`. Deriving them from Directus, as `resolveRoleFromDirectus()` already does, is the right call.

The realistic target: `AppAdmin`/`HR` from group membership at login; `Manager`/`Employee` from the reporting line in `employee_snapshot`, as today.

**One caution, from `Expertflow IT assets.md` §4.2.3.** BS4's app-level RBAC has a documented weakness — the `UserToRole`/`RolePermissions` control tables are `PUBLIC`-writable with RLS disabled, a privilege-escalation seam mitigated only by secret custody and a detective audit. So BS4 is a good source for *file-access patterns*, not a model to copy wholesale for role storage. The same section carries a correction (2026-07-07, post salary-leak): Postgres cannot verify a JWT inside an RLS policy, so central IAM buys **governance** — one joiner/mover/leaver flow — not DB-layer spoof resistance. That still comes from connection custody. Useful to know if the "just use central IAM" framing comes up: it doesn't remove the need for the middleware in step 1.

---

## 7. Bundling project management with performance management

Raised separately, and it holds up — the original design already called for these to be separated, and the implementation collapsed them.

### What the spec asked for

`HR_SUITE_REQUIREMENTS.md:66` and `:1370` specify six schemas: `auth`, `common`, `recruitment`, **`appraisal`**, `project`, `notification`. Appraisal gets its own. The isolation rule at `:126` is explicit:

> each service connects with a DB role granting access **only** to its own schema … Cross-schema **joins** in application code are not allowed; cross-module data flows through service APIs.

And `:127` states the purpose plainly — the isolation is "a blast-radius and access-control boundary."

### What was built

Appraisal tables live in the **`project`** schema:

```
project.appraisal_cycles      (performance-appraisals.js:24)
project.appraisal_records     (performance-appraisals.js:38)
project.appraisal_goals       (performance-appraisals.js:56)
```

sitting alongside `project.task`, `project.time_entry`, `project.project`, and `project.employee_snapshot`. There is no `appraisal` schema. `backend/src/db/pool.js` opens a single pool with one DB role and no `search_path` restriction, so every route — timesheet, kanban, Gantt, appraisal — reaches every table with identical privileges.

The boundary the spec designed specifically to protect appraisal data does not exist.

### Why it matters more here than usual

The two modules have opposite sensitivity profiles. Project management is *meant* to be open — everyone sees the board, the Gantt, who logged what. Performance data is need-to-know: review text, ratings, and the reporting line. Bundling them means the most-exposed surface shares credentials with the most-sensitive data. A SQL-injection or credential leak anywhere in the timesheet or Kanban path reaches `project.appraisal_records` with the same connection, and nothing at the database layer objects.

It also makes the mistake easy to *make*. Nothing stops a future query from joining `project.task` to `project.appraisal_records` — they're in the same namespace, and the spec's "no cross-schema joins" rule can't bite when there's only one schema.

**Evidence that the schema confusion is already causing bugs:** appraisal notifications insert into `auth_local.app_notifications` (`performance-appraisals.js:12`, `:342`), while the notification feed reads from an unqualified `app_notifications` (`notifications.js:9,34`), as do recruitment and offers (`job-applications.js:49`, `job-offers.js:31`). Those resolve to different tables. Goal-assignment and cycle-start notifications are very likely never reaching the UI — and both inserts are wrapped in `.catch(() => {})`, so it fails silently. Worth checking against the live DB.

### Options, cheapest first

**1. Separate schema + separate DB role (recommended, small).** Move the three tables and give appraisal routes their own pool:

```sql
CREATE SCHEMA IF NOT EXISTS appraisal;
ALTER TABLE project.appraisal_cycles  SET SCHEMA appraisal;
ALTER TABLE project.appraisal_records SET SCHEMA appraisal;
ALTER TABLE project.appraisal_goals   SET SCHEMA appraisal;

CREATE ROLE hr_appraisal_svc LOGIN PASSWORD '…';
GRANT USAGE ON SCHEMA appraisal TO hr_appraisal_svc;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA appraisal TO hr_appraisal_svc;
-- and crucially: no grant on schema project

REVOKE ALL ON SCHEMA appraisal FROM hr_suite_user;   -- the PM/general role
GRANT USAGE ON SCHEMA appraisal TO hr_appraisal_svc;
```

Then a second pool in `db/pool-appraisal.js` used only by `performance-appraisals.js`. Two pools in one process still gives a real boundary: the project-management code path physically cannot read appraisal rows, whatever a bug does. `employee_snapshot` stays in `project` with read-only grant to the appraisal role, since both modules legitimately need it.

This is a day's work including the migration and is where I'd start.

**2. Enforce the no-cross-schema-join rule.** Once (1) is done it's mostly self-enforcing, but worth a note in the repo so nobody reintroduces a join.

**3. Full service split.** A separate deployable for appraisal, with cross-module traffic over APIs — what the spec's "cross-module data flows through service APIs" ultimately implies. Cleanest, considerably more work, and worth deferring until (1) is in place and the auth middleware from §4 exists. (1) captures most of the risk reduction for a fraction of the effort.

### On the frontend side

All modules ship in one Angular app with one token and one session. Routes are lazy-loaded (`loadComponent` in `app.routes.ts`), so an Employee doesn't download the appraisal admin chunks until they navigate — but those chunks are fetchable by anyone who knows the path. That's a code-disclosure question, not a data one, and it stops mattering once the API enforces scope. Splitting the frontend is not where I'd spend effort; splitting the database role is.

---

## 8. Decisions that aren't yours alone

Worth raising rather than settling in code:

1. **Manager scope — direct reports or full subtree?** Organogram uses subtree; appraisal records use direct reports. Both defensible; HR should say which.
2. **Should appraisal data live behind Directus policies** like the rest of the ERP, or stay in its own schema with enforced middleware? We currently connect to BS4 with a static `DIRECTUS_TOKEN` (`sync.js:24`) — one privileged identity for all users, so Directus permissions and RLS are bypassed by construction. Either direction is fine; the current state (own schema, no enforcement) isn't.
3. **Retention and erasure for CVs.** Base64-in-a-row means right-to-erasure rewrites table rows rather than deleting objects. Object storage makes this tractable — relevant to `HR_SUITE_REQUIREMENTS.md` OQ-8.

---

## 9. Verifying as you go

Before the change, from any machine that can reach the API — each of these should return data today and `401` afterwards:

```bash
curl -s https://<api-host>/api/v1/appraisals/records | head -c 400
curl -s https://<api-host>/api/v1/job-applications  | head -c 400
curl -s https://<api-host>/api/v1/time-entries      | head -c 400
```

After step 2, with a valid Employee token, this should return only that employee's rows regardless of the parameter:

```bash
curl -s -H "Authorization: Bearer <employee-token>" \
  "https://<api-host>/api/v1/appraisals/records?employeeId=<someone-else-id>"
```

That last one is the real test: the parameter must be ignored, not honoured.

---

## 10. Suggested order

1. Step 1 (auth middleware) + step 4 (dashboard aggregate) — biggest exposure reduction for the least code
2. Step 2 (server-derived scoping) — the core fix
3. Step 3 (write rules)
4. Steps 5–6 (password hashing, real tokens)
5. CV storage rework — larger, and reuses BS4's pattern

Steps 1–3 share one middleware and one helper; the per-route change after that is a few lines each. The same middleware covers recruitment, projects, tasks, and time entries, so it's worth doing once, properly, rather than per-module.

Happy to pair on step 1 or review the PR for steps 1–3 — that's where the design decisions concentrate.
