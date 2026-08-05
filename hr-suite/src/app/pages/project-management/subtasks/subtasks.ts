import { Component, OnInit, inject, computed, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink, ActivatedRoute, Router } from '@angular/router';
import { ApiService } from '../../../services/api';
import { AuthService } from '../../../services/auth';
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
  hours: string;
  note: string;
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

  readonly currentUserName = computed(() => this.auth.currentUser()?.name || '—');

  parentTask: Task | null = null;
  subtasks: Task[] = [];
  projects: Project[] = [];
  employees: Employee[] = [];
  appUsers: AppUserRecord[] = [];
  loading = true;
  taskId = '';

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
  logTimeForm: LogTimeForm = { hours: '', note: '' };

  constructor(private api: ApiService) {}

  ngOnInit() {
    this.taskId = this.route.snapshot.paramMap.get('id') || '';
    if (!this.taskId) { this.router.navigate(['/tasks']); return; }

    this.api.getEmployees().subscribe({
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
  openLogTimeModal(subtask: Task, event: Event) {
    event.stopPropagation();
    this.logTimeSubtask = subtask;
    this.logTimeForm = { hours: '', note: '' };
    this.logTimeError = '';
    this.showLogTimeModal = true;
    this.cdr.detectChanges();
  }

  closeLogTimeModal() { this.showLogTimeModal = false; this.logTimeSubtask = null; this.cdr.detectChanges(); }

  submitLogTime() {
    const h = parseFloat(this.logTimeForm.hours);
    if (!this.logTimeForm.hours || isNaN(h) || h <= 0) {
      this.logTimeError = 'Please enter valid hours (> 0).';
      return;
    }
    if (!this.logTimeSubtask) return;

    this.logTimeSaving = true;
    this.logTimeError = '';

    this.api.updateTask(this.logTimeSubtask.id, { actual_hours: (this.logTimeSubtask.actual_hours || 0) + h } as any).subscribe({
      next: () => {
        this.logTimeSaving = false;
        this.showLogTimeModal = false;
        this.logTimeSubtask = null;
        this.loadSubtasks();
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
  private sendAssignmentNotification(subtask: Task, employeeId: string) {
    const appUser = this.appUsers.find(u => u.employee_id === employeeId);
    const emp = this.employees.find(e => e.id === employeeId);
    const empName = emp ? `${emp.first_name} ${emp.last_name}` : 'You';

    this.api.postNotification({
      target_role:    'Employee',
      target_user_id: appUser?.id || undefined,
      type:           'info',
      title:          `New Subtask Assigned: ${subtask.title}`,
      body:           `${empName} has been assigned to subtask "${subtask.title}"${this.parentTask ? ` under task "${this.parentTask.title}"` : ''}.`,
    }).subscribe({ error: () => {} });
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
