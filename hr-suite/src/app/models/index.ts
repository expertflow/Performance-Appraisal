// ── Shared models ──────────────────────────────────────────────────────────

export interface Employee {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  department?: string;
  job_title?: string;
  avatar_url?: string;
}

export interface Project {
  id: string;
  name: string;
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
  task_id: string;
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
