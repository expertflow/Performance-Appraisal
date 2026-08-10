# HR Suite — Role-Based Access Control (RBAC) Matrix

> **Source of truth:** Derived directly from [`app.routes.ts`](hr-suite/src/app/app.routes.ts), [`auth.ts`](hr-suite/src/app/services/auth.ts), and all page component files.
> **Last updated:** 2026-08-10
> **Live app:** https://hrsuite.expertflow.com

---

## Table of Contents

1. [Roles Overview](#1-roles-overview)
2. [Legend](#2-legend)
3. [Global / Shell Features](#3-global--shell-features)
4. [Recruitment Module](#4-recruitment-module)
5. [Performance Appraisal Module](#5-performance-appraisal-module)
6. [Project Management Module](#6-project-management-module)
7. [Employee Directory](#7-employee-directory)
8. [User Management](#8-user-management)
9. [Candidate Portal](#9-candidate-portal)
10. [Summary: Who Can Do What in Performance Appraisals](#10-summary-who-can-do-what-in-performance-appraisals)

---

## 1. Roles Overview

| Role | Internal Code | Display Label | Description |
|------|--------------|---------------|-------------|
| **AppAdmin** | `AppAdmin` | AppAdmin | Full system administrator. Can do everything. |
| **HR** | `HR` | Admin/HR/Finance | HR, Admin, and Finance staff. Broad access across all modules. |
| **Manager** | `Manager` | Manager | Team manager. Can manage their own team's appraisals, goals, and requisitions. |
| **Employee** | `Employee` | Employee | Regular staff member. Read-only or self-only access in most modules. |
| **Candidate** | `Candidate` | Candidate | External job applicant. Isolated to the Candidate Portal only. |

> **Note:** The `HR` role's display label was changed to **"Admin/HR/Finance"** to reflect that it covers HR, Admin, and Finance responsibilities. The underlying role value remains `HR`.

---

## 2. Legend

| Symbol | Meaning |
|--------|---------|
| ✅ | Full access (view + create + edit + delete) |
| 👁️ | View / read only |
| ✏️ | Can edit (but not create or delete) |
| ➕ | Can create only |
| 🚫 | No access — route is blocked by `roleGuard` |
| 🔒 | Scoped — can only see/edit their own data |
| 🌳 | Scoped to own team/subtree |

---

## 3. Global / Shell Features

| Feature | AppAdmin | HR | Manager | Employee | Candidate |
|---------|----------|----|---------|----------|-----------|
| Login (local password) | ✅ | ✅ | ✅ | ✅ | ✅ |
| Login (Google SSO) | ✅ | ✅ | ✅ | ✅ | ✅ |
| Dashboard (`/dashboard`) | ✅ | ✅ | ✅ | ✅ | 🚫 |
| Change Password (`/change-password`) | ✅ | ✅ | ✅ | ✅ | 🚫 |
| Settings (`/settings`) | ✅ | ✅ | ✅ | ✅ | 🚫 |
| About (`/about`) | ✅ | ✅ | ✅ | ✅ | 🚫 |
| Notifications (`/notifications`) | ✅ | ✅ | ✅ | ✅ | 🚫 |
| Sidebar navigation | ✅ | ✅ | ✅ | ✅ | 🚫 |
| Role label shown in UI | "AppAdmin" | "Admin/HR/Finance" | "Manager" | "Employee" | "Candidate" |

---

## 4. Recruitment Module

### 4.1 Route Access

| Route | AppAdmin | HR | Manager | Employee | Candidate |
|-------|----------|----|---------|----------|-----------|
| `/recruitment` (Dashboard) | ✅ | ✅ | 🚫 | 🚫 | 🚫 |
| `/recruitment/requisitions` | ✅ | ✅ | ✅ | 🚫 | 🚫 |
| `/recruitment/pipeline` | ✅ | ✅ | ✅ | 🚫 | 🚫 |
| `/recruitment/applications` | ✅ | ✅ | 🚫 | 🚫 | 🚫 |
| `/recruitment/offer` | ✅ | ✅ | 🚫 | 🚫 | 🚫 |

### 4.2 Recruitment Dashboard (Job Postings)

| Feature | AppAdmin | HR | Manager | Employee |
|---------|----------|----|---------|----------|
| View all job postings | ✅ | ✅ | 🚫 | 🚫 |
| Post a new job | ✅ | ✅ | 🚫 | 🚫 |
| Edit a job posting | ✅ | ✅ | 🚫 | 🚫 |
| Delete a job posting | ✅ | ✅ | 🚫 | 🚫 |
| Set AI auto-shortlist threshold (slider) | ✅ | ✅ | 🚫 | 🚫 |
| Link job to a requisition (auto-fill) | ✅ | ✅ | 🚫 | 🚫 |
| View recruitment funnel stats | ✅ | ✅ | 🚫 | 🚫 |

### 4.3 Job Requisitions

| Feature | AppAdmin | HR | Manager | Employee |
|---------|----------|----|---------|----------|
| View all requisitions | ✅ | ✅ | 🌳 Own dept | 🚫 |
| Create a requisition | ✅ | ✅ | ✅ | 🚫 |
| Edit a requisition | ✅ | ✅ | ✅ | 🚫 |
| Delete a requisition | ✅ | ✅ | ✅ | 🚫 |
| Approve/reject requisition (HOD/HR/CFO) | ✅ | ✅ | 🚫 | 🚫 |
| Export requisitions CSV | ✅ | ✅ | ✅ | 🚫 |

> **Manager note:** Managers can create and manage requisitions but cannot approve them at the HR/CFO level.

### 4.4 Candidate Pipeline

| Feature | AppAdmin | HR | Manager | Employee |
|---------|----------|----|---------|----------|
| View pipeline (Kanban board) | ✅ | ✅ | ✅ | 🚫 |
| Select job to view pipeline | ✅ | ✅ | ✅ | 🚫 |
| View candidate detail panel | ✅ | ✅ | ✅ | 🚫 |
| Move candidate to a different stage | ✅ | ✅ | ✅ | 🚫 |
| Schedule interview | ✅ | ✅ | ✅ | 🚫 |
| Reject candidate | ✅ | ✅ | ✅ | 🚫 |
| Send offer notification | ✅ | ✅ | ✅ | 🚫 |
| View AI score on candidate card | ✅ | ✅ | ✅ | 🚫 |
| View AI reasoning in detail panel | ✅ | ✅ | ✅ | 🚫 |

> **AI Screening:** Triggered automatically on application submission. No manual trigger button exists.

### 4.5 Applications List

| Feature | AppAdmin | HR | Manager | Employee |
|---------|----------|----|---------|----------|
| View all applications | ✅ | ✅ | 🚫 | 🚫 |
| Filter by job / status | ✅ | ✅ | 🚫 | 🚫 |
| Update application status | ✅ | ✅ | 🚫 | 🚫 |
| Delete an application | ✅ | ✅ | 🚫 | 🚫 |

### 4.6 Offer Management

| Feature | AppAdmin | HR | Manager | Employee |
|---------|----------|----|---------|----------|
| View all offers | ✅ | ✅ | 🚫 | 🚫 |
| Create an offer | ✅ | ✅ | 🚫 | 🚫 |
| Edit an offer | ✅ | ✅ | 🚫 | 🚫 |

---

## 5. Performance Appraisal Module

> **This is the most important section.** All internal roles (AppAdmin, HR, Manager, Employee) can access the appraisal module, but with different scopes and permissions.

### 5.1 Route Access

| Route | AppAdmin | HR | Manager | Employee | Candidate |
|-------|----------|----|---------|----------|-----------|
| `/appraisal` (Dashboard) | ✅ | ✅ | ✅ | ✅ | 🚫 |
| `/appraisal/cycles` | ✅ | ✅ | ✅ | 🚫 | 🚫 |
| `/appraisal/goals` | ✅ | ✅ | ✅ | ✅ | 🚫 |
| `/appraisal/feedback` | ✅ | ✅ | ✅ | ✅ | 🚫 |
| `/appraisal/organogram` | ✅ | ✅ | ✅ | ✅ | 🚫 |

### 5.2 Appraisal Cycles

| Feature | AppAdmin | HR | Manager | Employee |
|---------|----------|----|---------|----------|
| View all cycles | ✅ | ✅ | ✅ | 🚫 |
| Create a new cycle | ✅ | ✅ | 🚫 | 🚫 |
| Activate a cycle | ✅ | ✅ | 🚫 | 🚫 |
| Advance cycle phase | ✅ | ✅ | 🚫 | 🚫 |
| Delete a cycle | ✅ | ✅ | 🚫 | 🚫 |
| Export cycle data | ✅ | ✅ | ✅ | 🚫 |

> **Employee:** Cannot access `/appraisal/cycles` at all — route is blocked by `roleGuard`.
> **Manager:** Can view cycles (to reference when creating goals/feedback) but cannot create, activate, or delete them.

### 5.3 Goals

| Feature | AppAdmin | HR | Manager | Employee |
|---------|----------|----|---------|----------|
| View goals | ✅ All | ✅ All | 🌳 Own team | 🔒 Own goals only |
| Create a goal | ✅ | ✅ | ✅ | 🚫 |
| Assign goal to any employee | ✅ | ✅ | 🚫 | 🚫 |
| Assign goal to own team member | 🚫 (uses all-emp) | 🚫 (uses all-emp) | ✅ | 🚫 |
| Select appraisal cycle for goal | ✅ | ✅ | ✅ | 🚫 |
| Update goal progress (%) | ✅ | ✅ | ✅ | 🚫 |
| Delete a goal | ✅ | ✅ | ✅ | 🚫 |
| Export goals CSV | ✅ | ✅ | ✅ | 🚫 |
| Receive notification when goal assigned | — | — | — | ✅ |

**Data scope when loading goals:**
- **AppAdmin / HR:** Load ALL goals across all employees
- **Manager:** Load goals where `managerId = own employee_id` (own team only)
- **Employee:** Load goals where `employeeId = own employee_id` (own goals only)

**Notification:** When a goal is assigned, the target employee receives:
- An in-app notification
- An email notification

### 5.4 Performance Appraisal Records (Feedback)

> **This is the core appraisal feature.** It records manager reviews, ratings, and goal completion for each employee.

| Feature | AppAdmin | HR | Manager | Employee |
|---------|----------|----|---------|----------|
| **View appraisal records** | ✅ All records | ✅ All records | 🌳 Own team records | 🔒 Own records only |
| **Create an appraisal record** | ✅ | ✅ | ✅ | 🚫 |
| Select employee for appraisal | ✅ Any employee | ✅ Any employee | 🌳 Own team only | 🚫 |
| Select appraisal cycle | ✅ | ✅ | ✅ | 🚫 |
| Select linked goal | ✅ | ✅ | ✅ | 🚫 |
| Write self-review text | ✅ | ✅ | ✅ | 🚫 |
| Write manager review text | ✅ | ✅ | ✅ | 🚫 |
| Set rating (1–5) | ✅ | ✅ | ✅ | 🚫 |
| Set goals met (%) | ✅ | ✅ | ✅ | 🚫 |
| **Edit an appraisal record** | ✅ | ✅ | ✅ | 🚫 |
| Change appraisal status | ✅ | ✅ | ✅ | 🚫 |
| Submit appraisal (draft → submitted) | ✅ | ✅ | ✅ | 🚫 |
| Acknowledge appraisal | ✅ | ✅ | ✅ | 🚫 |
| **Delete an appraisal record** | ✅ | ✅ | ✅ | 🚫 |
| Export appraisal data | ✅ | ✅ | ✅ | 🚫 |
| **Receive email when appraisal submitted** | — | — | — | ✅ |

**Appraisal record statuses:**
| Status | Meaning |
|--------|---------|
| `draft` | Created but not yet submitted to employee |
| `submitted` | Manager has submitted — employee receives email notification |
| `acknowledged` | Employee has acknowledged the review |

**Data scope when loading appraisal records:**
- **AppAdmin / HR:** Load ALL records across all employees
- **Manager:** Load records where `managerId = own employee_id`
- **Employee:** Load records where `employeeId = own employee_id`

**Email notification on submission:**
When a manager changes status from `draft` → `submitted`, the system:
1. Looks up the employee's actual email address from the employee snapshot
2. Sends an email with: rating, goals met %, manager review comments, and a link to log in

### 5.5 Organogram (Org Chart)

| Feature | AppAdmin | HR | Manager | Employee |
|---------|----------|----|---------|----------|
| View organogram | ✅ Full tree | ✅ Full tree | 🌳 Own subtree | 🔒 Self + manager |
| Search employees in org | ✅ | ✅ | ✅ (scoped) | ✅ (scoped) |
| Filter by department | ✅ | ✅ | ✅ | ✅ |
| Export CSV | ✅ | ✅ | 🚫 | 🚫 |
| See "You" badge on own card | ✅ | ✅ | ✅ | ✅ |

**Organogram visibility scoping:**
| Role | What they see |
|------|--------------|
| AppAdmin | Full company org tree — all employees, all departments |
| HR | Full company org tree — all employees, all departments |
| Manager | Own subtree: self + all direct and indirect reports (BFS traversal) |
| Employee | Self + own direct manager + own direct reports (if any) |

---

## 6. Project Management Module

### 6.1 Route Access

| Route | AppAdmin | HR | Manager | Employee | Candidate |
|-------|----------|----|---------|----------|-----------|
| `/projects` (Dashboard) | ✅ | ✅ | ✅ | ✅ | 🚫 |
| `/projects/all` (All Projects) | ✅ | ✅ | ✅ | ✅ | 🚫 |
| `/tasks` (Task List) | ✅ | ✅ | ✅ | ✅ | 🚫 |
| `/tasks/:id` (Subtasks) | ✅ | ✅ | ✅ | ✅ | 🚫 |
| `/kanban` (Kanban Board) | ✅ | ✅ | ✅ | ✅ | 🚫 |
| `/gantt` (Gantt Chart) | ✅ | ✅ | ✅ | ✅ | 🚫 |
| `/timesheet` (Time Tracking) | ✅ | ✅ | ✅ | ✅ | 🚫 |

### 6.2 Projects

| Feature | AppAdmin | HR | Manager | Employee |
|---------|----------|----|---------|----------|
| View all projects | ✅ | ✅ | ✅ | ✅ |
| Create a project | ✅ | ✅ | ✅ | 🚫 |
| Edit a project | ✅ | ✅ | ✅ | 🚫 |
| Delete a project | ✅ | ✅ | ✅ | 🚫 |

> **`canMutateProjects()`** is `true` for AppAdmin, HR, Manager — `false` for Employee.

### 6.3 Tasks

| Feature | AppAdmin | HR | Manager | Employee |
|---------|----------|----|---------|----------|
| View all tasks | ✅ | ✅ | ✅ | ✅ |
| Filter tasks by project | ✅ | ✅ | ✅ | ✅ |
| Create a task | ✅ | ✅ | ✅ | 🚫 |
| Edit a task | ✅ | ✅ | ✅ | 🚫 |
| Delete a task | ✅ | ✅ | ✅ | 🚫 |
| Assign task to employee | ✅ | ✅ | ✅ | 🚫 |
| Log time on a task | ✅ | ✅ | ✅ | ✅ |
| View subtasks | ✅ | ✅ | ✅ | ✅ |
| Create subtasks | ✅ | ✅ | ✅ | 🚫 |
| Receive task assignment notification | — | — | — | ✅ |

> **Employee note:** The `isEmployee` flag hides the "New Task" button and edit/delete actions in the UI. Employees can view all tasks and log time.

### 6.4 Kanban Board

| Feature | AppAdmin | HR | Manager | Employee |
|---------|----------|----|---------|----------|
| View Kanban board | ✅ | ✅ | ✅ | ✅ |
| Drag tasks between columns | ✅ | ✅ | ✅ | 🚫 |
| Filter by project | ✅ | ✅ | ✅ | ✅ |

### 6.5 Gantt Chart

| Feature | AppAdmin | HR | Manager | Employee |
|---------|----------|----|---------|----------|
| View Gantt chart | ✅ | ✅ | ✅ | ✅ |
| Filter by project | ✅ | ✅ | ✅ | ✅ |

### 6.6 Timesheet / Time Tracking

| Feature | AppAdmin | HR | Manager | Employee |
|---------|----------|----|---------|----------|
| View time entries | ✅ All | ✅ All | ✅ All | ✅ All |
| Log time entry | ✅ | ✅ | ✅ | ✅ |
| Edit time entry | ✅ | ✅ | ✅ | ✅ |
| Delete time entry | ✅ | ✅ | ✅ | ✅ |
| View Directus time summary | ✅ | ✅ | ✅ | ✅ |
| Filter by project / employee / date | ✅ | ✅ | ✅ | ✅ |

---

## 7. Employee Directory

| Feature | AppAdmin | HR | Manager | Employee | Candidate |
|---------|----------|----|---------|----------|-----------|
| Access `/employees` page | ✅ | ✅ | 🚫 | 🚫 | 🚫 |
| View employee list | ✅ | ✅ | 🚫 | 🚫 | 🚫 |
| View employee detail (modal) | ✅ | ✅ | 🚫 | 🚫 | 🚫 |
| Filter by status | ✅ | ✅ | 🚫 | 🚫 | 🚫 |
| Sync employees from Directus | ✅ | ✅ | 🚫 | 🚫 | 🚫 |
| Default filter | Employed | Employed | — | — | — |

> **Sync behaviour:** Only employees with status `Employed` are pulled from Directus. Terminated or on-leave employees are excluded from the local snapshot.

---

## 8. User Management

| Feature | AppAdmin | HR | Manager | Employee | Candidate |
|---------|----------|----|---------|----------|-----------|
| Access `/users` page | ✅ | ✅ | 🚫 | 🚫 | 🚫 |
| View all app users | ✅ | ✅ | 🚫 | 🚫 | 🚫 |
| Filter users by role / status | ✅ | ✅ | 🚫 | 🚫 | 🚫 |
| Edit user (role, status, employee link) | ✅ | 🚫 | 🚫 | 🚫 | 🚫 |
| Delete a user | ✅ | 🚫 | 🚫 | 🚫 | 🚫 |
| Create a new user | ✅ | 🚫 | 🚫 | 🚫 | 🚫 |

> **`canManageUsers()`** is `true` only for `AppAdmin`. HR can view the users list but cannot create, edit, or delete users.

---

## 9. Candidate Portal

The Candidate Portal is a completely separate shell (`/candidate/*`) accessible **only** to users with the `Candidate` role. Internal staff (AppAdmin, HR, Manager, Employee) cannot access it.

| Feature | Candidate | All Internal Roles |
|---------|-----------|-------------------|
| Access `/candidate` portal | ✅ | 🚫 |
| View open job listings | ✅ | 🚫 |
| Apply to a job | ✅ | 🚫 |
| View own applications | ✅ | 🚫 |
| Track application status | ✅ | 🚫 |
| Candidate settings | ✅ | 🚫 |
| Access internal app (`/dashboard`, etc.) | 🚫 | ✅ |

**AI Screening (automatic):** When a Candidate submits an application:
1. The backend immediately calls the Claude AI API to screen the resume
2. An AI score (0–100) and reasoning are stored on the application
3. If the score ≥ the job's `auto_shortlist_threshold`, the application is automatically moved to the `Screening` stage
4. The candidate is not notified of the AI score

---

## 10. Summary: Who Can Do What in Performance Appraisals

This section answers the specific question: **who can view and manage Performance Appraisals?**

### 10.1 Quick Reference

| Action | AppAdmin | HR | Manager | Employee |
|--------|----------|----|---------|----------|
| **View appraisal records** | ✅ All | ✅ All | 🌳 Own team | 🔒 Own only |
| **Create appraisal record** | ✅ | ✅ | ✅ | 🚫 |
| **Edit appraisal record** | ✅ | ✅ | ✅ | 🚫 |
| **Delete appraisal record** | ✅ | ✅ | ✅ | 🚫 |
| **Submit appraisal** | ✅ | ✅ | ✅ | 🚫 |
| **Acknowledge appraisal** | ✅ | ✅ | ✅ | 🚫 |
| **Manage appraisal cycles** | ✅ | ✅ | 👁️ View | 🚫 |
| **Create / assign goals** | ✅ | ✅ | ✅ | 🚫 |
| **View own goals** | ✅ | ✅ | ✅ | ✅ |
| **Update goal progress** | ✅ | ✅ | ✅ | 🚫 |
| **View organogram** | ✅ Full | ✅ Full | 🌳 Own subtree | 🔒 Self + manager |

### 10.2 Detailed Explanation by Role

#### AppAdmin
- Sees **all** appraisal records for all employees across all departments
- Can create, edit, delete, and submit appraisals for any employee
- Can create and manage appraisal cycles (activate, advance phase, delete)
- Can assign goals to any employee
- Sees the full company organogram

#### HR (Admin/HR/Finance)
- Sees **all** appraisal records for all employees across all departments
- Can create, edit, delete, and submit appraisals for any employee
- Can create and manage appraisal cycles
- Can assign goals to any employee
- Sees the full company organogram
- **Same access as AppAdmin for appraisal purposes**

#### Manager
- Sees **only** appraisal records where they are the assigned manager (`managerId = own employee_id`)
- Can create appraisal records for their own team members only
- Can edit, submit, and acknowledge appraisals for their team
- Can assign goals to their own team members only
- Sees the organogram scoped to their own subtree (self + all direct/indirect reports)
- **Cannot** create or manage appraisal cycles

#### Employee
- Sees **only** their own appraisal records (`employeeId = own employee_id`)
- **Cannot** create, edit, or delete any appraisal record
- **Cannot** create or assign goals
- Can view their own goals (assigned by manager or HR)
- Receives an **email notification** when their manager submits an appraisal
- Sees the organogram scoped to: self + own direct manager + own direct reports
- **Cannot** access the Appraisal Cycles page

### 10.3 Appraisal Workflow

```
1. HR/AppAdmin creates an Appraisal Cycle
        ↓
2. Manager (or HR/Admin) assigns Goals to employees
        ↓  [Employee receives in-app + email notification]
3. Manager creates an Appraisal Record (status: draft)
        ↓
4. Manager fills in: manager review, rating (1–5), goals met (%)
        ↓
5. Manager submits the appraisal (status: submitted)
        ↓  [Employee receives email with rating, comments, goals met %]
6. Appraisal is acknowledged (status: acknowledged)
```

---

## Appendix: Route Guard Summary

Extracted from [`app.routes.ts`](hr-suite/src/app/app.routes.ts):

| Route | Allowed Roles |
|-------|--------------|
| `/login` | Public |
| `/auth/google-callback` | Public |
| `/candidate/**` | `Candidate` only |
| `/dashboard` | All internal roles |
| `/change-password` | All internal roles |
| `/settings` | All internal roles |
| `/about` | All internal roles |
| `/notifications` | All internal roles |
| `/users` | `AppAdmin`, `HR` |
| `/recruitment` | `AppAdmin`, `HR` |
| `/recruitment/requisitions` | `AppAdmin`, `HR`, `Manager` |
| `/recruitment/pipeline` | `AppAdmin`, `HR`, `Manager` |
| `/recruitment/applications` | `AppAdmin`, `HR` |
| `/recruitment/offer` | `AppAdmin`, `HR` |
| `/employees` | `AppAdmin`, `HR` |
| `/appraisal` | `AppAdmin`, `HR`, `Manager`, `Employee` |
| `/appraisal/cycles` | `AppAdmin`, `HR`, `Manager` |
| `/appraisal/goals` | `AppAdmin`, `HR`, `Manager`, `Employee` |
| `/appraisal/feedback` | `AppAdmin`, `HR`, `Manager`, `Employee` |
| `/appraisal/organogram` | `AppAdmin`, `HR`, `Manager`, `Employee` |
| `/projects` | `AppAdmin`, `HR`, `Manager`, `Employee` |
| `/projects/all` | `AppAdmin`, `HR`, `Manager`, `Employee` |
| `/tasks` | `AppAdmin`, `HR`, `Manager`, `Employee` |
| `/tasks/:id` | `AppAdmin`, `HR`, `Manager`, `Employee` |
| `/kanban` | `AppAdmin`, `HR`, `Manager`, `Employee` |
| `/gantt` | `AppAdmin`, `HR`, `Manager`, `Employee` |
| `/timesheet` | `AppAdmin`, `HR`, `Manager`, `Employee` |
