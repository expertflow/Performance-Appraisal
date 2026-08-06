// ── Shared models ──────────────────────────────────────────────────────────

export type AppRole = 'AppAdmin' | 'HR' | 'Manager' | 'Employee' | 'Candidate';

export interface AppUser {
  id: string;
  email: string;
  name: string;
  role: AppRole;
  employee_id?: string;   // linked BS4/Directus employee record
  manager_id?: string;    // for Employee role: their manager's employee_id
  avatar_url?: string;
  phone?: string;         // stored for candidates
  address?: string;       // stored for candidates
  /** 'google' = signed in via Google SSO (no local password set yet)
   *  'local'  = signed in with email+password */
  loginMethod?: 'google' | 'local';
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface LoginResponse {
  token: string;
  user: AppUser;
}

export interface Employee {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  department?: string;
  designation?: string;   // from Directus Designation field
  job_title?: string;     // alias kept for compatibility
  avatar_url?: string;
  manager_id?: string;    // reporting hierarchy from BS4 sync
}

export interface Project {
  id: string;
  name: string;
  description?: string;
  type: 'client' | 'internal' | 'operational';
  status: 'active' | 'on_hold' | 'completed' | 'cancelled';
  health_status?: 'on_track' | 'at_risk' | 'off_track';
  start_date?: string;
  end_date?: string;
  budget_hours?: number;
  budget_amount?: number;
  bs4_project_id?: string;
  created_at: string;
  updated_at: string;
}

export interface Task {
  id: string;
  project_id: string;
  parent_task_id?: string | null;
  title: string;
  description?: string;
  priority: 'critical' | 'high' | 'medium' | 'low';
  status: 'todo' | 'in_progress' | 'in_review' | 'blocked' | 'done';
  due_date?: string;
  estimated_hours?: number;
  actual_hours?: number;
  assignees?: Employee[];
  subtasks?: Task[];
  created_at: string;
  updated_at: string;
}

export interface TimeEntry {
  id?: string;
  task_id?: string | null;
  project_id: string;
  subtask_id?: string | null;
  employee_id: string;
  employee?: Employee;
  description: string;
  start_datetime: string;
  end_datetime: string;
  hours_worked: number;
  is_billable?: boolean;
  status?: 'draft' | 'submitted' | 'approved' | 'rejected';
  directus_sync_status?: 'pending' | 'synced' | 'failed';
  directus_id?: string;
  idempotency_key?: string;
  created_at?: string;
  updated_at?: string;
}

export interface TimeEntryFormData {
  project_id: string;
  task_id: string;
  subtask_id: string;
  employee_id: string;
  description: string;
  start_datetime: string;
  end_datetime: string;
  hours_worked: number | null;
}

// ── Performance Appraisal ─────────────────────────────────────────────────

export interface PerformanceAppraisal {
  id: string;
  employee_id: string;
  manager_id: string;       // employee_id of the manager
  cycle_id?: string;
  rating?: number;          // 1-5
  comments?: string;
  goals_met?: number;       // percentage
  status: 'draft' | 'submitted' | 'acknowledged';
  created_at: string;
  updated_at: string;
}

export interface ManagerEmployeeMapping {
  id: string;
  manager_employee_id: string;
  employee_id: string;
  synced_from_bs4: boolean;
  created_at: string;
}

export interface ApiResponse<T> {
  data: T;
  total?: number;
  page?: number;
  limit?: number;
}

export interface SyncStatus {
  last_sync_at: string | null;
  pending_count: number;
  failed_count: number;
  synced_count: number;
}
