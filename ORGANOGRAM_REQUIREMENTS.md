# Organogram & Appraisal Manager Assignment — Requirements

**Module:** Performance Appraisal  
**Page:** `15-organogram.html`  
**Status:** Specified — Ready for Implementation  
**Version:** 1.0  

---

## 1. Overview

The Organogram is a dedicated page within the Performance Appraisal module that visualises the full organisational hierarchy sourced from BS4 ERP. Its primary purpose is to show **which manager appraises each employee** — making the appraisal reporting line explicit and auditable.

### Key Goals
- Display all employees in a visual tree (org chart) and a flat table view
- Show each employee's **appraisal manager** (who conducts their performance review), sourced from BS4
- Allow HR Administrators to **assign or change** an employee's appraisal manager
- Show **appraisal status** (Completed / Pending / Not Started) per employee on the chart
- Sync the org structure on demand from BS4 ERP

---

## 2. Navigation

- **Sidebar location:** Performance Appraisal → Appraisal section → **Organogram** (below Feedback, above Recommendations)
- **Route:** `/appraisal/organogram`
- **UI file:** `15-organogram.html`
- **Accessible from:** All appraisal module pages (07–10, 15)

---

## 3. Data Sources (BS4 ERP)

All employee and hierarchy data is fetched from BS4 ERP. The app never becomes the master for org data.

| Data | BS4 Endpoint | Cache |
|---|---|---|
| All employees (name, title, dept, join date) | `GET /api/v1/bs4/employees` | `common.employee_snapshot` |
| Manager hierarchy (`manager_id` per employee) | `GET /api/v1/bs4/employees?include=manager` | `common.employee_snapshot` |
| Manager-only list (for assignment picker) | `GET /api/v1/bs4/employees?role=manager` | `common.employee_snapshot` |
| Department list | `GET /api/v1/bs4/departments` | `common.department_snapshot` |

**Sync behaviour:**
- On-demand sync via "Sync from BS4" button (triggers a background job)
- Scheduled nightly sync via `common.employee_snapshot` refresh job (§8.6 of HR_SUITE_REQUIREMENTS.md)
- Last-synced timestamp shown in the toolbar

---

## 4. Organogram Views

### 4.1 Tree View (default)
- Visual hierarchical org chart rendered as an HTML/CSS tree
- Each node is an **employee card** showing:
  - Avatar (initials + colour-coded by department)
  - Full name
  - Job title
  - Department badge (colour-coded)
  - Appraisal status dot (green = Done, amber = Pending, grey = Not Started)
  - Appraisal score (if completed)
- Node styles:
  - **CEO / Executive:** Purple border + gradient background
  - **Manager / Director:** Blue border + light blue background
  - **Employee:** Default grey border + white background
- Clicking a node opens the **Employee Detail Panel** (slide-in from right)
- Connector lines drawn between parent and child nodes

### 4.2 Table View
- Flat sortable/filterable table of all employees
- Columns: Employee (avatar + name + title), Department, Title, Appraisal Manager (from BS4), Appraisal Status, Score, Actions
- Pagination: 16 rows per page
- Clicking a row opens the Employee Detail Panel

---

## 5. Filters & Search

| Filter | Options |
|---|---|
| Department | All / Engineering / Design / HR / Finance / Operations / Sales |
| Appraisal Status | All / Completed / Pending / Not Started |
| Manager | All / individual manager names (from BS4) |
| Search | Free-text search by employee name (highlights matching nodes in tree, filters rows in table) |

---

## 6. Employee Detail Panel (slide-in)

Opened by clicking any node (tree) or row (table). Contains:

### 6.1 Header
- Large avatar, full name, job title, department badge

### 6.2 BS4 Source Note
- Banner: "Employee data sourced from BS4 ERP via `GET /api/v1/bs4/employees`"

### 6.3 Info Grid
- Employee ID (from BS4)
- Department
- Join Date
- Location

### 6.4 Appraisal Manager Section
- Shows current appraisal manager (name, role, avatar)
- "Change Appraisal Manager" button → opens Assign Modal
- Manager data sourced from BS4

### 6.5 Current Appraisal Status
- Status dot + label (Completed / Pending / Not Started)
- Current cycle name
- Score (if completed, shown as large number)

### 6.6 Appraisal History
- List of past appraisal cycles with: cycle name, appraiser name, score, status badge
- Sorted newest first

### 6.7 Direct Reports
- Chip list of employees who report to this person
- Empty state: "No direct reports"

### 6.8 Actions
- "View Appraisal Cycle" → navigates to `08-cycles.html`
- "View Feedback" → navigates to `10-feedback.html`

---

## 7. Assign Appraisal Manager Modal

Triggered by "Assign Appraisal Manager" (page header) or "Change Appraisal Manager" (detail panel).

### Fields

| Field | Type | Source |
|---|---|---|
| Employee | Dropdown (required) | All employees from BS4 |
| Appraisal Manager | Dropdown (required) | Managers-only list from BS4 (`?role=manager`) |
| Appraisal Cycle | Dropdown | Active cycles from `appraisal.cycle` table |
| Effective From | Date picker | Defaults to today |
| Notes | Textarea (optional) | Free text |

### Behaviour
- Saving creates/updates a record in `appraisal.appraisal_manager_assignment` table
- One active assignment per employee per cycle (unique constraint)
- Previous assignments are retained for audit history
- Notification sent to the newly assigned manager (via Notification & Workflow Service)

---

## 8. Stats Bar

Four KPI cards at the top of the page:

| Stat | Description |
|---|---|
| Total Employees | Count from BS4 snapshot |
| Appraisals Completed | Count of employees with `status = done` in active cycle |
| Pending Appraisals | Count with `status = pending` |
| Not Started | Count with `status = not_started` |

---

## 9. Data Model (schema: `appraisal`)

### New Table: `appraisal.appraisal_manager_assignment`

```sql
CREATE TABLE appraisal.appraisal_manager_assignment (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id       VARCHAR(64) NOT NULL,   -- BS4 employee ID
  manager_id        VARCHAR(64) NOT NULL,   -- BS4 manager employee ID
  cycle_id          UUID REFERENCES appraisal.cycle(id),
  effective_from    DATE NOT NULL DEFAULT CURRENT_DATE,
  effective_to      DATE,                   -- NULL = currently active
  assigned_by       UUID REFERENCES auth.user(id),
  notes             TEXT,
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  updated_at        TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (employee_id, cycle_id, effective_from)
);

CREATE INDEX idx_ama_employee ON appraisal.appraisal_manager_assignment(employee_id);
CREATE INDEX idx_ama_manager  ON appraisal.appraisal_manager_assignment(manager_id);
CREATE INDEX idx_ama_cycle    ON appraisal.appraisal_manager_assignment(cycle_id);
```

### Existing Table Extension: `appraisal.appraisal`

Add column to link to the assignment:
```sql
ALTER TABLE appraisal.appraisal
  ADD COLUMN manager_assignment_id UUID REFERENCES appraisal.appraisal_manager_assignment(id);
```

---

## 10. API Endpoints

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/v1/appraisal/organogram` | Returns org tree with appraisal status per employee |
| `GET` | `/api/v1/appraisal/organogram/employees` | Flat list with manager + appraisal status |
| `POST` | `/api/v1/appraisal/manager-assignments` | Create/update appraisal manager assignment |
| `GET` | `/api/v1/appraisal/manager-assignments/:employeeId` | Get assignment history for an employee |
| `GET` | `/api/v1/bs4/employees` | Proxy to BS4 — all employees |
| `GET` | `/api/v1/bs4/employees?role=manager` | Proxy to BS4 — managers only |

---

## 11. BS4 Integration Details

### Employee Snapshot Fields Used
```
employee_id       VARCHAR(64)   -- BS4 primary key
full_name         VARCHAR(255)
job_title         VARCHAR(255)
department_name   VARCHAR(255)
manager_id        VARCHAR(64)   -- BS4 ID of direct line manager
join_date         DATE
location          VARCHAR(255)
is_active         BOOLEAN
```

### Sync Logic
1. Nightly job calls `GET /api/v1/bs4/employees?include=manager&active=true`
2. Upserts into `common.employee_snapshot` on `employee_id`
3. Organogram page reads from snapshot (not live BS4) for performance
4. "Sync from BS4" button triggers an immediate refresh of the snapshot

---

## 12. UI Behaviour Details

### Node Colour Coding (by department)
| Department | Badge Colour |
|---|---|
| Engineering | Blue (`#EFF6FF / #0066CC`) |
| Design | Purple (`#F5F3FF / #7C3AED`) |
| HR | Green (`#F0FDF4 / #059669`) |
| Finance | Orange (`#FFF7ED / #D97706`) |
| Operations | Red (`#FEF2F2 / #DC2626`) |
| Sales | Teal (`#F0FDFA / #00A3A3`) |

### Appraisal Status Dots
| Status | Colour |
|---|---|
| Completed | Green `#059669` |
| Pending | Amber `#D97706` |
| Not Started | Grey `#CBD5E1` |

### Score Colour Coding
| Range | Label | Colour |
|---|---|---|
| 4.5 – 5.0 | Excellent | Green |
| 3.5 – 4.4 | Good | Blue |
| 2.5 – 3.4 | Average | Amber |
| < 2.5 | Needs Improvement | Red |

---

## 13. Permissions

| Role | Can View Organogram | Can Assign Manager | Can View All Scores |
|---|---|---|---|
| HR Administrator | ✅ | ✅ | ✅ |
| HR Manager | ✅ | ✅ (own dept) | ✅ (own dept) |
| Manager | ✅ (own subtree) | ❌ | ✅ (own reports) |
| Employee | ✅ (own card only) | ❌ | ❌ |

---

## 14. Notifications

When an appraisal manager is assigned or changed:
- **To new manager:** "You have been assigned as appraisal manager for [Employee Name] for [Cycle Name]"
- **To employee:** "Your appraisal manager for [Cycle Name] has been updated to [Manager Name]"
- **To HR Admin:** Audit log entry created

---

## 15. Open Questions

| # | Question | Owner |
|---|---|---|
| OQ-ORG-1 | Does BS4 expose `manager_id` on the employee record, or is hierarchy inferred from org units? | BS4 team |
| OQ-ORG-2 | Can one employee have different appraisal managers for different cycles (e.g., matrix org)? | HR team |
| OQ-ORG-3 | Should the organogram show contractors/part-time staff or only full-time employees? | HR team |
| OQ-ORG-4 | Maximum depth of hierarchy — does BS4 support unlimited levels? | BS4 team |
