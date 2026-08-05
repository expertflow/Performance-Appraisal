import { Component, OnInit, inject, computed, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../../services/api';
import { AuthService } from '../../../services/auth';
import { TimeEntryService } from '../../../services/time-entry';
import { TimeEntry, Project, Task, Employee, TimeEntryFormData } from '../../../models';

@Component({
  selector: 'app-timesheet',
  imports: [CommonModule, FormsModule],
  templateUrl: './timesheet.html',
  styleUrl: './timesheet.scss'
})
export class Timesheet implements OnInit {
  private auth = inject(AuthService);
  private cdr  = inject(ChangeDetectorRef);

  // ── Role helpers ───────────────────────────────────────────────────────────
  readonly isEmployee = computed(() => this.auth.isEmployee());
  readonly canLogTime = computed(() => true);

  // Data
  timeEntries: TimeEntry[] = [];
  projects: Project[] = [];
  tasks: Task[] = [];
  subtasks: Task[] = [];
  employees: Employee[] = [];

  // UI state
  loading = true;
  showModal = false;
  saving = false;
  error = '';
  success = '';
  hoursManuallyEdited = false;

  // Form
  form: TimeEntryFormData = this.emptyForm();

  // Filters
  filterProjectId = '';
  filterEmployeeId = '';
  filterDateFrom = '';
  filterDateTo = '';

  constructor(
    private api: ApiService,
    private teService: TimeEntryService
  ) {}

  ngOnInit() {
    this.loadData();
  }

  loadData() {
    this.loading = true;
    // Load projects — if empty, auto-sync from Directus
    this.api.getProjects().subscribe({
      next: p => {
        this.projects = p;
        this.cdr.detectChanges();
        if (p.length === 0) {
          this.api.syncProjects().subscribe({
            next: () => {
              this.api.getProjects().subscribe({
                next: p2 => { this.projects = p2; this.cdr.detectChanges(); },
                error: () => {}
              });
            },
            error: () => {}
          });
        }
      },
      error: () => {}
    });
    this.api.getEmployees().subscribe({
      next: e => { this.employees = e; this.cdr.detectChanges(); },
      error: () => {}
    });
    this.loadTimeEntries();
  }

  loadTimeEntries() {
    const filters: Record<string, string> = {};
    if (this.filterProjectId) filters['project_id'] = this.filterProjectId;
    if (this.filterEmployeeId) filters['employee_id'] = this.filterEmployeeId;
    if (this.filterDateFrom) filters['date_from'] = this.filterDateFrom;
    if (this.filterDateTo) filters['date_to'] = this.filterDateTo;

    // Employee: auto-filter to their own entries
    const user = this.auth.currentUser();
    if (this.auth.isEmployee() && user?.employee_id) {
      filters['employee_id'] = user.employee_id;
    }

    this.api.getTimeEntries(filters).subscribe({
      next: e => { this.timeEntries = e; this.loading = false; this.cdr.detectChanges(); },
      error: () => { this.loading = false; this.cdr.detectChanges(); }
    });
  }

  // ── Cascading dropdowns ───────────────────────────────────────────────────

  onProjectChange() {
    this.form.task_id = '';
    this.form.subtask_id = '';
    this.tasks = [];
    this.subtasks = [];
    if (!this.form.project_id) return;
    this.api.getTasks(this.form.project_id).subscribe({
      next: t => { this.tasks = t.filter(x => !x.parent_task_id); this.cdr.detectChanges(); },
      error: () => {}
    });
  }

  onTaskChange() {
    this.form.subtask_id = '';
    this.subtasks = [];
    if (!this.form.task_id) return;
    this.api.getSubtasks(this.form.task_id).subscribe({
      next: s => { this.subtasks = s; this.cdr.detectChanges(); },
      error: () => {}
    });
  }

  // ── Hours auto-calculation ────────────────────────────────────────────────

  onDatetimeChange() {
    if (this.hoursManuallyEdited) return;
    const calc = this.teService.calculateHours(this.form.start_datetime, this.form.end_datetime);
    if (calc !== null) this.form.hours_worked = calc;
  }

  onHoursManualEdit() {
    this.hoursManuallyEdited = true;
  }

  resetHoursManual() {
    this.hoursManuallyEdited = false;
    this.onDatetimeChange();
  }

  // ── Modal ─────────────────────────────────────────────────────────────────

  openModal() {
    this.form = this.emptyForm();
    const user = this.auth.currentUser();
    if (this.auth.isEmployee() && user?.employee_id) {
      this.form.employee_id = user.employee_id;
    }
    this.tasks = [];
    this.subtasks = [];
    this.hoursManuallyEdited = false;
    this.error = '';
    this.success = '';
    this.showModal = true;
  }

  closeModal() {
    this.showModal = false;
  }

  submitEntry() {
    if (!this.form.project_id || !this.form.employee_id ||
        !this.form.start_datetime || !this.form.end_datetime) {
      this.error = 'Please fill in all required fields (Project, Employee, Start & End time).';
      return;
    }
    if (!this.form.hours_worked || this.form.hours_worked <= 0) {
      this.error = 'Hours worked must be greater than 0.';
      return;
    }
    this.saving = true;
    this.error = '';
    const payload: Omit<TimeEntry, 'id' | 'created_at' | 'updated_at'> = {
      task_id: this.form.task_id || null,
      project_id: this.form.project_id,
      subtask_id: this.form.subtask_id || null,
      employee_id: this.form.employee_id,
      description: this.form.description,
      start_datetime: this.form.start_datetime,
      end_datetime: this.form.end_datetime,
      hours_worked: this.form.hours_worked!,
      status: 'draft',
      directus_sync_status: 'pending'
    };
    this.api.createTimeEntry(payload).subscribe({
      next: entry => {
        this.timeEntries.unshift(entry);
        this.saving = false;
        this.success = 'Time entry saved successfully.';
        this.cdr.detectChanges();
        setTimeout(() => { this.success = ''; this.closeModal(); this.cdr.detectChanges(); }, 1500);
      },
      error: err => {
        this.saving = false;
        this.error = err?.error?.message || 'Failed to save time entry.';
        this.cdr.detectChanges();
      }
    });
  }

  // ── Helpers ───────────────────────────────────────────────────────────────

  emptyForm(): TimeEntryFormData {
    return {
      project_id: '',
      task_id: '',
      subtask_id: '',
      employee_id: '',
      description: '',
      start_datetime: '',
      end_datetime: '',
      hours_worked: null
    };
  }

  formatHours(h: number): string {
    return this.teService.formatHours(h);
  }

  getEmployeeName(id: string): string {
    const e = this.employees.find(x => x.id === id);
    return e ? `${e.first_name} ${e.last_name}` : id;
  }

  getProjectName(id: string): string {
    return this.projects.find(p => p.id === id)?.name ?? id;
  }

  getSyncBadge(status?: string): string {
    if (status === 'synced') return 'badge-green';
    if (status === 'failed') return 'badge-red';
    return 'badge-orange';
  }

  triggerSync() {
    this.api.triggerSync().subscribe({
      next: r => { this.success = r.message; this.cdr.detectChanges(); setTimeout(() => { this.success = ''; this.cdr.detectChanges(); }, 3000); },
      error: () => { this.error = 'Sync trigger failed.'; this.cdr.detectChanges(); }
    });
  }
}
