import { Component, OnInit, inject, computed, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink, ActivatedRoute, Router } from '@angular/router';
import { ApiService } from '../../../services/api';
import { AuthService } from '../../../services/auth';
import { SearchService } from '../../../services/search';
import { Task, Project, Employee } from '../../../models';
import { AppUserRecord } from '../../../services/user-store';

interface NewTaskForm {
  title: string;
  description: string;
  project_id: string;
  due_date: string;
  status: 'todo' | 'done';
  assigned_employee_id: string;
}

interface EditTaskForm {
  title: string;
  description: string;
  due_date: string;
  status: string;
  priority: string;
  estimated_hours: string;
}

interface LogTimeForm {
  project_id: string;
  task_id: string;
  description: string;
  employee_id: string;
  start_datetime: string;
  end_datetime: string;
  hours_worked: string;   // HH:MM:SS or empty (auto-calc)
  manual_hours: boolean;  // true = user typed hours manually
}

@Component({
  selector: 'app-tasks',
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './tasks.html',
  styleUrl: './tasks.scss'
})
export class Tasks implements OnInit {
  readonly auth   = inject(AuthService);
  readonly router = inject(Router);
  private cdr     = inject(ChangeDetectorRef);
  private route   = inject(ActivatedRoute);
  private search  = inject(SearchService);

  readonly isEmployee      = computed(() => this.auth.isEmployee());
  readonly currentUserName = computed(() => this.auth.currentUser()?.name || '—');

  tasks: Task[] = [];
  projects: Project[] = [];
  employees: Employee[] = [];
  appUsers: AppUserRecord[] = [];
  loading = true;
  filterProjectId = '';
  expandedTasks = new Set<string>();

  /** Tasks filtered by topbar search query */
  get filteredTasks(): Task[] {
    const q = this.search.query().toLowerCase().trim();
    if (!q) return this.tasks;
    return this.tasks.filter(t =>
      t.title.toLowerCase().includes(q) ||
      (t.description || '').toLowerCase().includes(q)
    );
  }

  // ── New Task modal ──────────────────────────────────────────────────────────
  showModal = false;
  saving = false;
  saveError = '';
  form: NewTaskForm = this.emptyForm();

  // ── Edit Task modal ─────────────────────────────────────────────────────────
  showEditModal = false;
  editingTask: Task | null = null;
  editSaving = false;
  editError = '';
  editForm: EditTaskForm = this.emptyEditForm();

  // ── Delete confirm ──────────────────────────────────────────────────────────
  showDeleteConfirm = false;
  deletingTask: Task | null = null;
  deleteInProgress = false;
  deleteError = '';

  // ── Log Time modal ──────────────────────────────────────────────────────────
  showLogTimeModal = false;
  logTimeTask: Task | null = null;
  logTimeSaving = false;
  logTimeError = '';
  logTimeForm: LogTimeForm = this.emptyLogTimeForm();

  constructor(private api: ApiService) {}

  ngOnInit() {
    const projectParam = this.route.snapshot.queryParamMap.get('project');
    if (projectParam) this.filterProjectId = projectParam;

    this.api.getProjects().subscribe({
      next: p => { this.projects = p; this.cdr.detectChanges(); },
      error: () => {}
    });
    this.api.getEmployees(undefined, true).subscribe({
      next: e => { this.employees = e; this.cdr.detectChanges(); },
      error: () => {}
    });
    this.api.getAppUsers().subscribe({
      next: u => { this.appUsers = u; this.cdr.detectChanges(); },
      error: () => {}
    });
    this.loadTasks();
  }

  loadTasks() {
    this.loading = true;
    this.api.getTasks(this.filterProjectId || undefined).subscribe({
      next: t => { this.tasks = t.filter(x => !x.parent_task_id); this.loading = false; this.cdr.detectChanges(); },
      error: () => { this.loading = false; this.cdr.detectChanges(); }
    });
  }

  toggleExpand(taskId: string) {
    if (this.expandedTasks.has(taskId)) this.expandedTasks.delete(taskId);
    else this.expandedTasks.add(taskId);
  }

  isExpanded(taskId: string): boolean { return this.expandedTasks.has(taskId); }

  // ── New Task ────────────────────────────────────────────────────────────────
  openModal() {
    this.form = this.emptyForm();
    if (this.filterProjectId) this.form.project_id = this.filterProjectId;
    this.saveError = '';
    this.showModal = true;
    this.cdr.detectChanges();
  }

  closeModal() { this.showModal = false; this.cdr.detectChanges(); }

  emptyForm(): NewTaskForm {
    return { title: '', description: '', project_id: '', due_date: '', status: 'todo', assigned_employee_id: '' };
  }

  submitTask() {
    if (!this.form.title.trim()) { this.saveError = 'Task name is required.'; return; }
    if (!this.form.project_id)   { this.saveError = 'Please select a project.'; return; }

    this.saving = true;
    this.saveError = '';

    const payload = {
      project_id:  this.form.project_id,
      title:       this.form.title.trim(),
      description: this.form.description.trim() || undefined,
      status:      this.form.status === 'done' ? 'done' : 'todo',
      due_date:    this.form.due_date || undefined,
      created_by:  this.auth.currentUser()?.id,
    };

    this.api.createTask(payload).subscribe({
      next: task => {
        this.saving = false;
        this.showModal = false;
        if (this.form.assigned_employee_id) {
          this.sendAssignmentNotification(task, this.form.assigned_employee_id);
        }
        this.loadTasks();
        this.cdr.detectChanges();
      },
      error: err => {
        this.saving = false;
        this.saveError = err?.error?.error || 'Failed to create task.';
        this.cdr.detectChanges();
      }
    });
  }

  // ── Edit Task ───────────────────────────────────────────────────────────────
  openEditModal(task: Task, event: Event) {
    event.stopPropagation();
    this.editingTask = task;
    this.editForm = {
      title:           task.title,
      description:     task.description || '',
      due_date:        task.due_date ? task.due_date.substring(0, 10) : '',
      status:          task.status,
      priority:        task.priority || 'medium',
      estimated_hours: task.estimated_hours != null ? String(task.estimated_hours) : '',
    };
    this.editError = '';
    this.showEditModal = true;
    this.cdr.detectChanges();
  }

  closeEditModal() { this.showEditModal = false; this.editingTask = null; this.cdr.detectChanges(); }

  emptyEditForm(): EditTaskForm {
    return { title: '', description: '', due_date: '', status: 'todo', priority: 'medium', estimated_hours: '' };
  }

  submitEdit() {
    if (!this.editForm.title.trim()) { this.editError = 'Task name is required.'; return; }
    if (!this.editingTask) return;

    this.editSaving = true;
    this.editError = '';

    const patch: any = {
      title:       this.editForm.title.trim(),
      description: this.editForm.description.trim() || undefined,
      status:      this.editForm.status,
      priority:    this.editForm.priority,
      due_date:    this.editForm.due_date || undefined,
    };
    if (this.editForm.estimated_hours) {
      patch.estimated_hours = parseFloat(this.editForm.estimated_hours);
    }

    this.api.updateTask(this.editingTask.id, patch).subscribe({
      next: () => {
        this.editSaving = false;
        this.showEditModal = false;
        this.editingTask = null;
        this.loadTasks();
        this.cdr.detectChanges();
      },
      error: err => {
        this.editSaving = false;
        this.editError = err?.error?.error || 'Failed to update task.';
        this.cdr.detectChanges();
      }
    });
  }

  // ── Delete Task ─────────────────────────────────────────────────────────────
  openDeleteConfirm(task: Task, event: Event) {
    event.stopPropagation();
    this.deletingTask = task;
    this.showDeleteConfirm = true;
    this.cdr.detectChanges();
  }

  closeDeleteConfirm() { this.showDeleteConfirm = false; this.deletingTask = null; this.cdr.detectChanges(); }

  confirmDelete() {
    if (!this.deletingTask) return;
    this.deleteInProgress = true;
    this.deleteError = '';
    this.api.deleteTask(this.deletingTask.id).subscribe({
      next: () => {
        this.deleteInProgress = false;
        this.showDeleteConfirm = false;
        this.deletingTask = null;
        this.deleteError = '';
        this.loadTasks();
        this.cdr.detectChanges();
      },
      error: (err: any) => {
        this.deleteInProgress = false;
        this.deleteError = err?.error?.error || 'Failed to delete task. Please try again.';
        this.cdr.detectChanges();
      }
    });
  }

  // ── Log Time ────────────────────────────────────────────────────────────────
  emptyLogTimeForm(): LogTimeForm {
    return { project_id: '', task_id: '', description: '', employee_id: '', start_datetime: '', end_datetime: '', hours_worked: '', manual_hours: false };
  }

  /** Find the employee_id linked to the currently logged-in app user */
  private currentEmployeeId(): string {
    const user = this.auth.currentUser();
    if (!user) return '';
    // AppUser has employee_id field
    return (user as any).employee_id || '';
  }

  openLogTimeModal(task: Task, event: Event) {
    event.stopPropagation();
    this.logTimeTask = task;
    this.logTimeError = '';
    this.logTimeForm = {
      project_id:     task.project_id,
      task_id:        task.id,
      description:    task.description || task.title,
      employee_id:    this.currentEmployeeId(),
      start_datetime: '',
      end_datetime:   '',
      hours_worked:   '',
      manual_hours:   false,
    };
    this.showLogTimeModal = true;
    this.cdr.detectChanges();
  }

  closeLogTimeModal() { this.showLogTimeModal = false; this.logTimeTask = null; this.cdr.detectChanges(); }

  /** Called when start or end datetime changes — auto-calc hours if not manual */
  onDatetimeChange() {
    if (this.logTimeForm.manual_hours) return;
    const start = this.logTimeForm.start_datetime;
    const end   = this.logTimeForm.end_datetime;
    if (start && end) {
      const diffMs = new Date(end).getTime() - new Date(start).getTime();
      if (diffMs > 0) {
        const totalSec = Math.floor(diffMs / 1000);
        const h = Math.floor(totalSec / 3600);
        const m = Math.floor((totalSec % 3600) / 60);
        const s = totalSec % 60;
        this.logTimeForm.hours_worked = `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
      } else {
        this.logTimeForm.hours_worked = '';
      }
      this.cdr.detectChanges();
    }
  }

  onHoursWorkedChange() {
    // If user types in hours_worked, mark as manual so auto-calc stops overwriting
    this.logTimeForm.manual_hours = !!this.logTimeForm.hours_worked;
  }

  submitLogTime() {
    const f = this.logTimeForm;
    if (!f.start_datetime) { this.logTimeError = 'Start date/time is required.'; return; }
    if (!f.end_datetime)   { this.logTimeError = 'End date/time is required.'; return; }
    if (new Date(f.end_datetime) <= new Date(f.start_datetime)) {
      this.logTimeError = 'End must be after Start.'; return;
    }
    if (!f.employee_id) { this.logTimeError = 'Employee is required.'; return; }

    this.logTimeSaving = true;
    this.logTimeError = '';

    const payload: any = {
      project_id:     f.project_id,
      task_id:        f.task_id || null,
      employee_id:    f.employee_id,
      description:    f.description,
      start_datetime: f.start_datetime,
      end_datetime:   f.end_datetime,
    };
    // Only send hours_worked if manually entered; otherwise backend auto-calcs
    if (f.manual_hours && f.hours_worked) {
      payload.hours_worked = f.hours_worked;
    }

    this.api.createTimeEntry(payload).subscribe({
      next: () => {
        this.logTimeSaving = false;
        this.showLogTimeModal = false;
        this.logTimeTask = null;
        this.cdr.detectChanges();
      },
      error: err => {
        this.logTimeSaving = false;
        this.logTimeError = err?.error?.error || 'Failed to log time.';
        this.cdr.detectChanges();
      }
    });
  }

  // ── Notification helper ─────────────────────────────────────────────────────
  private sendAssignmentNotification(task: Task, employeeId: string) {
    const appUser = this.appUsers.find(u => u.employee_id === employeeId);
    const emp = this.employees.find(e => e.id === employeeId);
    const empName = emp ? `${emp.first_name} ${emp.last_name}` : 'You';
    const projectName = this.projects.find(p => p.id === task.project_id)?.name || '';

    this.api.postNotification({
      target_role:    'Employee',
      target_user_id: appUser?.id || undefined,
      type:           'info',
      title:          `New Task Assigned: ${task.title}`,
      body:           `${empName} has been assigned to task "${task.title}"${projectName ? ` in project "${projectName}"` : ''}.`,
    }).subscribe({ error: () => {} });
  }

  // ── Helpers ─────────────────────────────────────────────────────────────────
  priorityClass(p: string): string {
    const m: Record<string, string> = { critical: 'badge-red', high: 'badge-orange', medium: 'badge-blue', low: 'badge-gray' };
    return m[p] ?? 'badge-gray';
  }

  statusClass(s: string): string {
    const m: Record<string, string> = { done: 'badge-green', in_progress: 'badge-blue', blocked: 'badge-red', in_review: 'badge-purple', todo: 'badge-gray' };
    return m[s] ?? 'badge-gray';
  }

  getProjectName(id: string): string {
    return this.projects.find(p => p.id === id)?.name ?? id;
  }

  getEmployeeName(id: string): string {
    const e = this.employees.find(e => e.id === id);
    return e ? `${e.first_name} ${e.last_name}` : id;
  }
}
