# HR Suite — User Input & Change Request Log

**Document:** USER_INPUT.md
**Purpose:** Records all user-requested features, changes, and fixes made to the HR Suite application
**Period:** 2026 (Development & Enhancement Phase)
**Live App:** https://hrsuite.expertflow.com

---

## How to Read This Document

Each entry records:
- **Request:** What the user asked for
- **Why:** The business reason
- **What Changed:** Files and logic modified
- **Status:** Completed / In Progress / Pending

---

## Change Log

---

### CR-001 — Remove Click-Outside Modal Close

**Date:** 2026 (early)
**Requested by:** User
**Request:** "Modals should not close when clicking outside — users lose their form data"
**Why:** Accidental data loss when users click outside a modal while filling a form

**What Changed:**
- Removed `(click)="close()"` from all `.modal-overlay` divs across **25 pages**
- Modals now only close via the explicit ✕ button or Cancel button
- Affected pages: all recruitment, appraisal, project, user management pages

**Status:** ✅ Completed — Deployed

---

### CR-002 — Add Employee & Cycle Dropdowns to Goal Form

**Date:** 2026
**Requested by:** User
**Request:** "When HR or Manager adds a goal, they should be able to select which employee the goal is for, and which appraisal cycle it belongs to"
**Why:** Previously the goal form had no employee selector — HR couldn't assign goals to specific employees

**What Changed:**
- `appraisal/goals/goals.ts` — Added employee dropdown (from employee snapshot) and cycle dropdown to the Add Goal form
- `appraisal/goals/goals.html` — Added `<select>` for employee and cycle in the modal
- Backend: Goal creation now accepts `employee_id` and `cycle_id`
- Roles that can assign goals to others: AppAdmin, HR, Manager

**Status:** ✅ Completed — Deployed

---

### CR-003 — Notify Employee When Goal is Assigned

**Date:** 2026
**Requested by:** User
**Request:** "When a manager or HR assigns a goal to an employee, the employee should receive a notification"
**Why:** Employees need to know when new goals are assigned to them

**What Changed:**
- Backend `goals.js` route — After goal creation, sends:
  - In-app notification to the assigned employee
  - Email notification to the employee's email address
- Notification content: "New goal assigned: [goal title]"

**Status:** ✅ Completed — Deployed

---

### CR-004 — Feedback Page: Employee Dropdown Instead of Free Text

**Date:** 2026
**Requested by:** User
**Request:** "Replace the employee ID/name text fields in the feedback form with a proper dropdown"
**Why:** Free-text entry caused errors and inconsistency; dropdown ensures valid employee selection

**What Changed:**
- `appraisal/feedback/feedback.ts` — Replaced free-text employee fields with searchable dropdown from employee snapshot
- `appraisal/feedback/feedback.html` — Updated form UI
- Also added: Cycle dropdown and Goals dropdown (filtered by selected employee)

**Status:** ✅ Completed — Deployed

---

### CR-005 — Fix Email Lookup in Feedback Edit

**Date:** 2026
**Requested by:** User (bug report)
**Request:** "Email notifications from feedback edit are going to wrong address"
**Why:** The `saveEdit()` function was using `employeeId` as the email address instead of looking up the actual email

**What Changed:**
- `appraisal/feedback/feedback.ts` — `saveEdit()` now looks up the employee record from the snapshot to get the actual email address before sending notification

**Status:** ✅ Completed — Deployed

---

### CR-006 — AI Auto-Shortlist Threshold for Job Postings

**Date:** 2026
**Requested by:** User
**Request:** "Add a threshold setting to job postings — if a candidate's AI score is above the threshold, automatically move them to the Screening stage"
**Why:** Automate the initial screening step; HR doesn't need to manually review every application

**What Changed:**
- Database: Added `auto_shortlist_threshold` column to `project.job_posting`
- Backend `job-postings.js` — Added threshold to create/update routes
- Backend `job-applications.js` — After AI screening, if score ≥ threshold, auto-update status to 'Screening'
- Frontend `dashboard.html` (Recruitment) — Added blue gradient slider box to Post Job modal
- Frontend `dashboard.html` — Added same slider to Edit Job modal (matching styling)
- Slider range: 0–100%, default 70%

**Status:** ✅ Completed — Deployed

---

### CR-007 — Auto-Trigger AI Screening on Application Submission

**Date:** 2026
**Requested by:** User
**Request:** "AI screening should happen automatically when a candidate submits an application — don't require HR to manually click 'Screen'"
**Why:** Manual screening step was an extra burden; automation makes the pipeline faster

**What Changed:**
- Backend `job-applications.js` — After saving a new application, automatically calls the AI screening function
- AI score and reasoning stored immediately on the application record
- Auto-shortlist logic runs immediately after screening
- Removed manual "AI Screen" button from pipeline candidate cards

**Status:** ✅ Completed — Deployed

---

### CR-008 — Show AI Score on Pipeline Candidate Cards

**Date:** 2026
**Requested by:** User
**Request:** "Show the AI score directly on the candidate card in the pipeline view"
**Why:** HR needs to see AI scores at a glance without opening each candidate's detail

**What Changed:**
- `recruitment/pipeline/pipeline.html` — Added AI score badge on candidate cards
- Score displayed with color coding: green (high), amber (medium), red (low)
- Score shown as percentage with AI reasoning available in detail panel

**Status:** ✅ Completed — Deployed

---

### CR-009 — Job Requisition Dropdown in Post Job Form

**Date:** 2026
**Requested by:** User
**Request:** "When posting a job, allow selecting an existing requisition — it should auto-fill the job title and description from the requisition"
**Why:** Avoids duplicate data entry; ensures job postings are linked to approved requisitions

**What Changed:**
- `recruitment/dashboard/dashboard.ts` — Added requisition dropdown to Post Job modal
- `recruitment/dashboard/dashboard.html` — Requisition selector with auto-fill logic
- When a requisition is selected: title, description, requirements auto-populate
- Requisition ID stored on the job posting

**Status:** ✅ Completed — Deployed

---

### CR-010 — Fix Modal Close Button UI Globally

**Date:** 2026
**Requested by:** User
**Request:** "The modal close (✕) buttons look inconsistent across the app — fix them globally"
**Why:** UI consistency; some close buttons were misaligned or styled differently

**What Changed:**
- Standardized modal close button styling across all modals in the app
- Consistent position (top-right), size, and hover effect

**Status:** ✅ Completed — Deployed

---

### CR-011 — Employees Page: Show Only Employed Employees

**Date:** 2026
**Requested by:** User
**Request:** "Only show employees with status 'Employed' in the Employees page — not terminated or on leave"
**Why:** The employees list was showing all statuses including terminated employees, cluttering the view

**What Changed:**
- Frontend `employees/employees.ts` — Changed default `filterStatus` from `''` (all) to `'Employed'`
- Backend `employees.js` (sync route) — Added `&filter[status][_eq]=Employed` to Directus API call
- Backend — After sync, deletes non-Employed employees from the local snapshot
- Result: Only currently employed staff appear in the app

**Status:** ✅ Completed — Deployed

---

### CR-012 — Organogram Role-Based Visibility

**Date:** 2026
**Requested by:** User
**Request:** "In the organogram, each manager should only see their own team. Employees should see their manager and themselves. AppAdmin and HR should see the full organogram."
**Why:** Privacy and relevance — managers don't need to see other departments' org structure

**What Changed:**
- `appraisal/organogram/organogram.ts`:
  - Injected `AuthService` to get current user's role and employee ID
  - Added `collectSubtreeIds()` BFS method to find all reports under a manager
  - `buildTree()` now scopes the employee list based on role:
    - **AppAdmin/HR:** No filter — full tree
    - **Manager:** Filters to own subtree (self + all direct/indirect reports)
    - **Employee:** Filters to own manager + self + own direct reports
  - Added `isCurrentUser` flag, `visibleCount` getter, `isFullView` computed signal
- `appraisal/organogram/organogram.html`:
  - Added role context banner for non-admin users explaining what they're seeing
  - Added "You" badge on the current user's card
  - Export CSV button only shown to AppAdmin/HR
  - Subtitle shows "Your team — N members shown" for scoped views
- `appraisal/organogram/organogram.scss`:
  - Added `.org-scope-banner` (blue gradient info banner)
  - Added `.org-card.is-current-user` (blue border highlight)
  - Added `.org-you-badge` (small blue pill badge)

**Status:** ✅ Completed — Deployed

---

### CR-013 — HR Role Display Name Change

**Date:** 2026
**Requested by:** User
**Request:** "Change the HR role name to 'Admin/HR/Finance' — just the display label, not the actual role value or permissions"
**Why:** The role covers Admin, HR, and Finance responsibilities — the label should reflect this

**What Changed (display only — internal role value `'HR'` unchanged):**
- `shell/shell.ts` — `roleLabel` getter: `'HR Manager'` → `'Admin/HR/Finance'`
- `shell/shell.html` — Role chip uses `roleLabel` instead of raw `user?.role`
- `settings/settings.ts` — `roleLabel` getter updated
- `auth/change-password/change-password.ts` — Added `roleLabel` getter
- `auth/change-password/change-password.html` — Role badge uses `roleLabel`
- `users/users.ts` — Added `roleDisplayLabel()` helper method
- `users/users.html`:
  - Stat label: `Admins / HR` → `Admins / HR/Finance`
  - Role filter dropdown: `HR` → `Admin/HR/Finance`
  - Table role chip uses `roleDisplayLabel(u.role)`

**Status:** ✅ Completed — Deployed

---

### CR-014 — DBeaver PostgreSQL Connection Setup

**Date:** 2026-08-10
**Requested by:** User
**Request:** "How do I connect DBeaver to the production database? Getting 'Connection refused' error"
**Why:** Direct port 5432 is blocked by VM firewall; need SSH tunnel

**Solution Provided:**
- Root cause: PostgreSQL port 5432 is not exposed to internet; local PostgreSQL on port 5432 was conflicting with tunnel
- Solution: DBeaver SSH tunnel with local port 15432
- SSH credentials: `root@169.58.125.199:22`, password auth
- DB credentials: `hr_suite_user / HrSuite2025!` on `localhost:15432`
- Implementation: JSch SSH implementation, local port 15432 → remote port 5432

**Status:** ✅ Resolved (configuration guidance provided)

---

## Pending / Future Requests

*(No pending requests as of 2026-08-10)*

---

## Notes for Future Development

1. **Employee sync is manual** — consider adding a scheduled nightly sync
2. **No audit trail** — changes to goals/feedback are not logged with before/after values
3. **No file upload** — resumes are stored as URLs, not actual files
4. **No bulk operations** — goals, feedback records must be created one at a time
5. **Organogram export** — CSV export only available to AppAdmin/HR; consider adding PDF/image export

---

*Document maintained by: Engineering Team*
*Last updated: 2026-08-10*
