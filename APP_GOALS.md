# HR Suite — Application Goals

**Document:** APP_GOALS.md
**Version:** 1.0
**Date:** 2026-08-10
**Live App:** https://hrsuite.expertflow.com
**Organization:** ExpertFlow

---

## Overview

The **HR Suite** is an internal HR management platform built for ExpertFlow to digitize and streamline core HR operations. It replaces manual spreadsheet-based processes with a unified, role-aware web application that integrates with the existing Directus ERP system.

---

## 1. Primary Goals

### Goal 1 — Centralize HR Operations
**Problem:** HR processes (recruitment, appraisals, project tracking) were managed across disconnected spreadsheets, emails, and manual records.

**Goal:** Provide a single web platform where all HR operations are managed, tracked, and auditable.

**Success Criteria:**
- All active job postings managed in one place
- All employee appraisal cycles tracked in one system
- All project time entries logged and visible to managers
- No need for separate spreadsheets for core HR workflows

---

### Goal 2 — Automate Recruitment Screening
**Problem:** HR manually reviewed every job application, which was time-consuming and inconsistent.

**Goal:** Use AI to automatically score and screen candidates against job requirements, so HR focuses only on qualified applicants.

**Success Criteria:**
- Every application automatically scored (0–100) by AI on submission
- Applications above the threshold automatically moved to Screening stage
- HR can see AI reasoning for each score
- Time-to-first-review reduced significantly

---

### Goal 3 — Enforce Role-Based Data Access
**Problem:** All HR staff could see all data regardless of their role, creating privacy and confidentiality concerns.

**Goal:** Each user sees only the data relevant to their role — managers see their team, employees see their own data, HR sees everything.

**Success Criteria:**
- Managers see only their team's appraisals, goals, and organogram subtree
- Employees see only their own goals, feedback, and limited organogram
- Candidates (external) see only their own applications and offers
- AppAdmin and HR have full system access

---

### Goal 4 — Integrate with Existing ERP (Directus)
**Problem:** Employee master data lived in Directus ERP (`bs4.expertflow.com`). Any new HR system needed to use the same employee records.

**Goal:** Sync employee data from Directus into the HR Suite so the app always reflects the current workforce without duplicate data entry.

**Success Criteria:**
- Employee sync pulls only currently `Employed` staff from Directus
- Terminated/resigned employees automatically excluded from the app
- Sync can be triggered on-demand by HR
- All employee-related features (goals, appraisals, organogram, tasks) use synced data

---

### Goal 5 — Support the Full Recruitment Lifecycle
**Problem:** Recruitment was tracked in spreadsheets with no structured pipeline, no offer management, and no candidate communication system.

**Goal:** Provide end-to-end recruitment management from job requisition to offer acceptance.

**Success Criteria:**
- Job requisitions created with multi-level approval (HOD → HR → CFO)
- Jobs posted and visible to candidates via external portal
- Candidates apply online and track their application status
- Pipeline managed via Kanban board (Applied → Screening → Interview → Offer → Hired)
- Offers generated and sent digitally
- Candidates accept/decline offers through the portal

---

### Goal 6 — Enable Structured Performance Appraisals
**Problem:** Performance reviews were informal, inconsistent, and not linked to measurable goals.

**Goal:** Provide a structured appraisal system with cycles, goals, and feedback records that managers and employees can use throughout the year.

**Success Criteria:**
- HR creates appraisal cycles (Annual, Mid-Year, Quarterly, Probation)
- Managers assign SMART goals to employees with target dates and weights
- Employees receive notifications when goals are assigned
- Managers record feedback/ratings against goals
- Employees can view their own appraisal history
- All appraisal data exportable to CSV

---

### Goal 7 — Visualize the Organization Structure
**Problem:** There was no visual representation of the company hierarchy, making it hard to understand reporting lines.

**Goal:** Provide an interactive organogram that shows the company hierarchy, with role-appropriate scoping.

**Success Criteria:**
- Full org chart visible to AppAdmin and HR
- Managers see their own team subtree only
- Employees see their manager, themselves, and their direct reports
- Current user highlighted with "You" badge
- Searchable and filterable by department
- Exportable to CSV (admin/HR only)

---

### Goal 8 — Track Projects and Time
**Problem:** Project work and time tracking were not integrated with HR data, making resource utilization invisible.

**Goal:** Provide project and task management with time logging, linked to the same employee data used across the app.

**Success Criteria:**
- Projects created with type (Client/Internal/Operational), budget, and timeline
- Tasks assigned to employees with priority, due dates, and status
- Multiple views: List, Kanban, Gantt
- Employees log time against tasks
- Managers approve time entries
- Time entries sync to Directus ERP for payroll/billing

---

### Goal 9 — Keep Data Clean and Consistent
**Problem:** Manual processes led to stale, inconsistent data (e.g., terminated employees still appearing in lists).

**Goal:** Enforce data quality rules so the app always reflects accurate, current information.

**Success Criteria:**
- Only `Employed` employees appear in the app (terminated/resigned excluded)
- Employee sync removes non-employed records from the local snapshot
- Role display names are consistent throughout the app
- Modals don't accidentally close and lose user data

---

### Goal 10 — Notify Users of Relevant Events
**Problem:** Users had no way to know when something required their attention (new goal assigned, application received, etc.).

**Goal:** Deliver timely in-app and email notifications for key events.

**Success Criteria:**
- In-app notification bell with unread count
- Email sent to employee when a goal is assigned to them
- Email sent to candidate when application status changes
- Email sent when interview is scheduled
- Email sent when offer is created

---

## 2. Non-Goals (Out of Scope)

These are explicitly **not** goals of the current HR Suite:

| # | Not a Goal | Reason |
|---|-----------|--------|
| 1 | Replace Directus ERP | HR Suite complements Directus; it does not replace it |
| 2 | Payroll processing | Payroll remains in Directus/BS4 |
| 3 | Leave management | Not in scope for this phase |
| 4 | Mobile native app | Responsive web only |
| 5 | Offline mode | Online-only application |
| 6 | Multi-language UI | English only (notification templates may vary) |
| 7 | Auto-push salary changes to ERP | Recommendations only; HR applies manually |
| 8 | Advanced analytics / BI dashboards | Basic stats only; no cross-module reporting |
| 9 | Document storage / file uploads | Resume URLs stored, not actual files |
| 10 | Automated nightly employee sync | Manual sync trigger only (for now) |

---

## 3. User Goals by Role

### AppAdmin
- Manage all user accounts and roles
- Full visibility into all modules
- Configure system settings
- Export any data

### HR / Admin / Finance (`HR` role)
- Manage the full recruitment pipeline
- Create and manage appraisal cycles
- Assign goals to any employee
- View full organogram
- Sync employees from Directus
- Generate reports and exports

### Manager
- View and manage own team's appraisals and goals
- Participate in recruitment pipeline (requisitions, interviews)
- Manage projects and approve time entries
- See own team in organogram

### Employee
- View own goals and appraisal records
- Submit self-assessments
- Log time against tasks
- See own position in organogram
- Track own notifications

### Candidate (External)
- Browse open job postings
- Apply to jobs online
- Track application status
- View interview schedules
- Accept or decline job offers

---

## 4. Quality Goals

| Quality Attribute | Target |
|------------------|--------|
| **Usability** | Any HR staff member can use the app without training |
| **Performance** | Pages load in < 2 seconds on normal connection |
| **Reliability** | App available during business hours (PKT) |
| **Security** | Role-based access enforced at both frontend and backend |
| **Data Integrity** | Only employed employees shown; sync removes stale records |
| **Consistency** | Same UI patterns (modals, buttons, forms) across all pages |

---

## 5. Success Metrics

| Metric | How Measured |
|--------|-------------|
| Recruitment pipeline adoption | All active jobs managed in HR Suite (not spreadsheets) |
| AI screening effectiveness | % of auto-shortlisted candidates that proceed to interview |
| Appraisal cycle completion | % of employees with completed appraisal records per cycle |
| Goal assignment coverage | % of employees with at least one active goal per cycle |
| Time entry adoption | % of project hours logged in HR Suite vs. estimated |
| User satisfaction | Feedback from HR team and managers after 30-day pilot |

---

## 6. Technical Goals

| Goal | Implementation |
|------|---------------|
| Single codebase | One Angular app + one Express backend |
| Easy deployment | Automated via `deploy.py` script |
| Maintainable code | Angular standalone components, TypeScript strict mode |
| Secure by default | JWT auth, role guards on all routes, backend role checks |
| ERP integration | Directus sync with filter for Employed status only |
| AI integration | Pluggable — currently Claude; can swap provider |

---

## 7. Roadmap (Future Goals)

These are goals identified for future development phases:

| Priority | Goal | Description |
|----------|------|-------------|
| High | Scheduled employee sync | Auto-sync from Directus nightly instead of manual |
| High | Audit trail | Log all changes to goals, feedback, appraisals with before/after |
| Medium | Leave management module | Track leave requests and balances |
| Medium | Bulk goal assignment | Assign same goal to multiple employees at once |
| Medium | PDF/image organogram export | Export org chart as image or PDF |
| Medium | Advanced recruitment reports | Time-to-hire, source effectiveness, pipeline conversion |
| Low | Mobile-responsive improvements | Better experience on tablets |
| Low | Multi-language notifications | Notification templates in Urdu/Arabic |
| Low | Candidate resume file upload | Store actual files, not just URLs |

---

*Document maintained by: Engineering Team*
*Version: 1.0 · Created: 2026-08-10*
*Reflects the HR Suite as deployed at hrsuite.expertflow.com*
