import { Component, OnInit, inject, computed, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink, ActivatedRoute, Router } from '@angular/router';
import { ApiService } from '../../../services/api';
import { AuthService } from '../../../services/auth';
import { SearchService } from '../../../services/search';
import { Task, Project, Employee } from '../../../models';
import { AppUserRecord } from '../../../services/user-store';

interface NewSubtaskForm {
  title: string;
  description: string;
  due_date: string;
  status: 'todo' | 'done';
  assigned_employee_id: string;
}

interface EditSubtaskForm {
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
  subtask_id: string;
  description: string;
  employee_id: string;
  start_datetime: string;
  end_datetime: string;
  hours_worked: string;   // HH:MM:SS or empty (auto-calc)
  manual_hours: boolean;  // true = user typed hours manually
}

@Component({
  selector: 'app-subtasks',
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './subtasks.html',
  styleUrl: './subtasks.scss'
})
export class Subtasks implements OnInit {
  readonly auth   = inject(AuthService);
  readonly router = inject(Router);
  private cdr     = inject(ChangeDetectorRef);
  private route   = inject(ActivatedRoute);
  private search  = inject(SearchService);

  readonly currentUserName = computed(() => this.auth.currentUser()?.name || '—');

  parentTask: Task | null = null;
  subtasks: Task[] = [];
  projects: Project[] = [];
  employees: Employee[] = [];
  appUsers: AppUserRecord[] = [];
  loading = true;
  taskId = '';

  /** Subtasks filtered by topbar search query */
  get filteredSubtasks(): Task[] {
    const q = this.search.query().toLowerCase().trim();
    if (!q) return this.subtasks;
    return this.subtasks.filter(s =>
      s.title.toLowerCase().includes(q) ||
      (s.description || '').toLowerCase().includes(q)
    );
  }

  // ── New Subtask modal ───────────────────────────────────────────────────────
  showModal = false;
  saving = false;
  saveError = '';
  form: NewSubtaskForm = this.emptyForm();

  // ── Edit Subtask modal ──────────────────────────────────────────────────────
  showEditModal = false;
  editingSubtask: Task | null = null;
  editSaving = false;
  editError = '';
  editForm: EditSubtaskForm = this.emptyEditForm();

  // ── Delete confirm ──────────────────────────────────────────────────────────
  showDeleteConfirm = false;
  deletingSubtask: Task | null = null;
  deleteInProgress = false;

  // ── Log Time modal ──────────────────────────────────────────────────────────
  showLogTimeModal = false;
  logTimeSubtask: Task | null = null;
  logTimeSaving = false;
  logTimeError = '';
  logTimeForm: LogTimeForm = this.emptyLogTimeForm();

  constructor(private api: ApiService) {}

  ngOnInit() {
    this.taskId = this.route.snapshot.paramMap.get('id') || '';
    if (!this.taskId) { this.router.navigate(['/tasks']); return; }

    this.api.getEmployees(undefined, true).subscribe({
      next: e => { this.employees = e; this.cdr.detectChanges(); },
      error: () => {}
    });
    this.api.getAppUsers().subscribe({
      next: u => { this.appUsers = u; this.cdr.detectChanges(); },
      error: () => {}
    });
    this.api.getProjects().subscribe({
      next: p => { this.projects = p; this.cdr.detectChanges(); },
      error: () => {}
    });

    this.loadParentTask();
    this.loadSubtasks();
  }

  loadParentTask() {
    this.api.getTasks().subscribe({
      next: tasks => {
        this.parentTask = tasks.find(t => t.id === this.taskId) || null;
        this.cdr.detectChanges();
      },
      error: () => {}
    });
  }

  loadSubtasks() {
    this.loading = true;
    this.api.getSubtasks(this.taskId).subscribe({
      next: s => { this.subtasks = s; this.loading = false; this.cdr.detectChanges(); },
      error: () => { this.loading = false; this.cdr.detectChanges(); }
    });
  }

  // ── New Subtask ─────────────────────────────────────────────────────────────
  openModal() {
    this.form = this.emptyForm();
    this.saveError = '';
    this.showModal = true;
    this.cdr.detectChanges();
  }

  closeModal() { this.showModal = false; this.cdr.detectChanges(); }

  emptyForm(): NewSubtaskForm {
    return { title: '', description: '', due_date: '', status: 'todo', assigned_employee_id: '' };
  }

  submitSubtask() {
    if (!this.form.title.trim()) { this.saveError = 'Subtask name is required.'; return; }

    this.saving = true;
    this.saveError = '';

    const payload = {
      project_id:     this.parentTask?.project_id || '',
      parent_task_id: this.taskId,
      title:          this.form.title.trim(),
      description:    this.form.description.trim() || undefined,
      status:         this.form.status === 'done' ? 'done' : 'todo',
      due_date:       this.form.due_date || undefined,
      created_by:     this.auth.currentUser()?.id,
    };

    this.api.createTask(payload as any).subscribe({
      next: subtask => {
        this.saving = false;
        this.showModal = false;
        if (this.form.assigned_employee_id) {
          this.sendAssignmentNotification(subtask, this.form.assigned_employee_id);
        }
        this.loadSubtasks();
        this.cdr.detectChanges();
      },
      error: err => {
        this.saving = false;
        this.saveError = err?.error?.error || 'Failed to create subtask.';
        this.cdr.detectChanges();
      }
    });
  }

  // ── Edit Subtask ────────────────────────────────────────────────────────────
  openEditModal(subtask: Task, event: Event) {
    event.stopPropagation();
    this.editingSubtask = subtask;
    this.editForm = {
      title:           subtask.title,
      description:     subtask.description || '',
      due_date:        subtask.due_date ? subtask.due_date.substring(0, 10) : '',
      status:          subtask.status,
      priority:        subtask.priority || 'medium',
      estimated_hours: subtask.estimated_hours != null ? String(subtask.estimated_hours) : '',
    };
    this.editError = '';
    this.showEditModal = true;
    this.cdr.detectChanges();
  }

  closeEditModal() { this.showEditModal = false; this.editingSubtask = null; this.cdr.detectChanges(); }

  emptyEditForm(): EditSubtaskForm {
    return { title: '', description: '', due_date: '', status: 'todo', priority: 'medium', estimated_hours: '' };
  }

  submitEdit() {
    if (!this.editForm.title.trim()) { this.editError = 'Subtask name is required.'; return; }
    if (!this.editingSubtask) return;

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

    this.api.updateTask(this.editingSubtask.id, patch).subscribe({
      next: () => {
        this.editSaving = false;
        this.showEditModal = false;
        this.editingSubtask = null;
        this.loadSubtasks();
        this.cdr.detectChanges();
      },
      error: err => {
        this.editSaving = false;
        this.editError = err?.error?.error || 'Failed to update subtask.';
        this.cdr.detectChanges();
      }
    });
  }

  // ── Delete Subtask ──────────────────────────────────────────────────────────
  openDeleteConfirm(subtask: Task, event: Event) {
    event.stopPropagation();
    this.deletingSubtask = subtask;
    this.showDeleteConfirm = true;
    this.cdr.detectChanges();
  }

  closeDeleteConfirm() { this.showDeleteConfirm = false; this.deletingSubtask = null; this.cdr.detectChanges(); }

  confirmDelete() {
    if (!this.deletingSubtask) return;
    this.deleteInProgress = true;
    this.api.deleteTask(this.deletingSubtask.id).subscribe({
      next: () => {
        this.deleteInProgress = false;
        this.showDeleteConfirm = false;
        this.deletingSubtask = null;
        this.loadSubtasks();
        this.cdr.detectChanges();
      },
      error: () => {
        this.deleteInProgress = false;
        this.cdr.detectChanges();
      }
    });
  }

  // ── Log Time ────────────────────────────────────────────────────────────────
  emptyLogTimeForm(): LogTimeForm {
    return { project_id: '', task_id: '', subtask_id: '', description: '', employee_id: '', start_datetime: '', end_datetime: '', hours_worked: '', manual_hours: false };
  }

  /** Find the employee_id linked to the currently logged-in app user */
  private currentEmployeeId(): string {
    const user = this.auth.currentUser();
    if (!user) return '';
    return (user as any).employee_id || '';
  }

  openLogTimeModal(subtask: Task, event: Event) {
    event.stopPropagation();
    this.logTimeSubtask = subtask;
    this.logTimeError = '';
    this.logTimeForm = {
      project_id:     this.parentTask?.project_id || subtask.project_id || '',
      task_id:        this.taskId,
      subtask_id:     subtask.id,
      description:    subtask.description || subtask.title,
      employee_id:    this.currentEmployeeId(),
      start_datetime: '',
      end_datetime:   '',
      hours_worked:   '',
      manual_hours:   false,
    };
    this.showLogTimeModal = true;
    this.cdr.detectChanges();
  }

  closeLogTimeModal() { this.showLogTimeModal = false; this.logTimeSubtask = null; this.cdr.detectChanges(); }

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
      subtask_id:     f.subtask_id || null,
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
        this.logTimeSubtask = null;
        this.cdr.detectChanges();
      },
      error: err => {
        this.logTimeSaving = false;
        this.logTimeError = err?.error?.error || 'Failed to log time.';
        this.cdr.detectChanges();
      }
    });
  }

  // ── Notification + Email helper ─────────────────────────────────────────────
  private sendAssignmentNotification(subtask: Task, employeeId: string) {
    const appUser = this.appUsers.find(u => u.employee_id === employeeId);
    const emp = this.employees.find(e => e.id === employeeId);
    const empName = emp ? `${emp.first_name} ${emp.last_name}` : 'You';
    const parentTitle = this.parentTask?.title || '';
    const taskUrl = `https://hrsuite.expertflow.com/tasks/${this.taskId}`;

    // App notification
    this.api.postNotification({
      target_role:    'Employee',
      target_user_id: appUser?.id || undefined,
      type:           'info',
      title:          `New Subtask Assigned: ${subtask.title}`,
      body:           `You have been assigned to subtask "${subtask.title}"${parentTitle ? ` under task "${parentTitle}"` : ''}.`,
    }).subscribe({ error: () => {} });

    // Email (only if we have the assignee's email via appUser)
    if (appUser?.email) {
      this.api.sendEmail(
        appUser.email,
        `New Subtask Assigned: ${subtask.title}`,
        `<h2>You have a new subtask assignment</h2>
         <p>Hi ${empName},</p>
         <p>You have been assigned to the following subtask:</p>
         <table style="border-collapse:collapse;margin:12px 0;">
           <tr><td style="padding:4px 12px 4px 0;font-weight:600;">Subtask:</td><td>${subtask.title}</td></tr>
           ${parentTitle ? `<tr><td style="padding:4px 12px 4px 0;font-weight:600;">Parent Task:</td><td>${parentTitle}</td></tr>` : ''}
           ${subtask.due_date ? `<tr><td style="padding:4px 12px 4px 0;font-weight:600;">Due Date:</td><td>${subtask.due_date.substring(0,10)}</td></tr>` : ''}
           ${subtask.priority ? `<tr><td style="padding:4px 12px 4px 0;font-weight:600;">Priority:</td><td>${subtask.priority}</td></tr>` : ''}
         </table>
         <p><a href="${taskUrl}" style="background:#1878cc;color:#fff;padding:10px 20px;border-radius:6px;text-decoration:none;display:inline-block;">View Task</a></p>
         <p style="color:#64748b;font-size:13px;">Best regards,<br>ExpertFlow HR Suite</p>`
      ).subscribe({ error: () => {} });
    }
  }

  // ── Helpers ─────────────────────────────────────────────────────────────────
  getProjectName(id: string): string {
    return this.projects.find(p => p.id === id)?.name ?? '—';
  }

  statusClass(s: string): string {
    const m: Record<string, string> = { done: 'badge-green', in_progress: 'badge-blue', blocked: 'badge-red', in_review: 'badge-purple', todo: 'badge-gray' };
    return m[s] ?? 'badge-gray';
  }

  priorityClass(p: string): string {
    const m: Record<string, string> = { critical: 'badge-red', high: 'badge-orange', medium: 'badge-blue', low: 'badge-gray' };
    return m[p] ?? 'badge-gray';
  }
}
