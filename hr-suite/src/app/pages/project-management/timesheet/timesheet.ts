import { Component, OnInit, inject, computed, effect, ChangeDetectorRef, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../../services/api';
import { AuthService } from '../../../services/auth';
import { SearchService } from '../../../services/search';
import { TimeEntryService } from '../../../services/time-entry';
import { TimeEntry, Project, Task, Employee, TimeEntryFormData } from '../../../models';

interface EditEntryForm {
  employee_id: string;
  project_id: string;
  task_id: string;
  subtask_id: string;
  description: string;
  start_datetime: string;
  end_datetime: string;
  hours_worked: number | null;
}

@Component({
  selector: 'app-timesheet',
  imports: [CommonModule, FormsModule],
  templateUrl: './timesheet.html',
  styleUrl: './timesheet.scss'
})
export class Timesheet implements OnInit {
  private auth   = inject(AuthService);
  private cdr    = inject(ChangeDetectorRef);
  private search = inject(SearchService);

  // ── Role helpers ───────────────────────────────────────────────────────────
  readonly isEmployee = computed(() => this.auth.isEmployee());
  readonly isAppAdmin = computed(() => this.auth.isAppAdmin());

  // Data
  timeEntries: TimeEntry[] = [];
  allTimeEntries: TimeEntry[] = [];   // unfiltered master list for client-side filter
  projects: Project[] = [];
  allTasks: Task[] = [];              // all tasks (for filter dropdown)
  allSubtasks: Task[] = [];           // all subtasks (for filter dropdown)
  tasks: Task[] = [];                 // tasks for new/edit modal (project-scoped)
  subtasks: Task[] = [];              // subtasks for new/edit modal (task-scoped)
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

  // ── Filters ────────────────────────────────────────────────────────────────
  filterDateFrom = '';
  filterDateTo   = '';

  // Searchable multi-select filter state
  filterProjectIds:  string[] = [];
  filterEmployeeIds: string[] = [];
  filterTaskIds:     string[] = [];
  filterSubtaskIds:  string[] = [];

  projectSearch  = '';
  employeeSearch = '';
  taskSearch     = '';
  subtaskSearch  = '';

  showProjectDrop  = false;
  showEmployeeDrop = false;
  showTaskDrop     = false;
  showSubtaskDrop  = false;

  // ── Edit modal ─────────────────────────────────────────────────────────────
  showEditModal   = false;
  editingEntry: TimeEntry | null = null;
  editSaving      = false;
  editError       = '';
  editForm: EditEntryForm = this.emptyEditForm();
  editTasks: Task[]    = [];
  editSubtasks: Task[] = [];
  editHoursManual = false;

  // ── Delete confirm ─────────────────────────────────────────────────────────
  showDeleteConfirm  = false;
  deletingEntry: TimeEntry | null = null;
  deleteInProgress   = false;

  constructor(
    private api: ApiService,
    private teService: TimeEntryService
  ) {
    // Re-filter whenever the topbar search query changes
    effect(() => {
      this.search.query(); // track signal
      this.applyClientFilters();
      this.cdr.detectChanges();
    });
  }

  ngOnInit() {
    this.loadData();
  }

  // Close dropdowns when clicking outside
  @HostListener('document:click', ['$event'])
  onDocClick(e: MouseEvent) {
    const t = e.target as HTMLElement;
    if (!t.closest('.ts-filter-wrap')) {
      this.showProjectDrop = this.showEmployeeDrop = this.showTaskDrop = this.showSubtaskDrop = false;
      this.cdr.detectChanges();
    }
  }

  loadData() {
    this.loading = true;
    this.api.getProjects().subscribe({
      next: p => {
        this.projects = p;
        this.cdr.detectChanges();
        if (p.length === 0) {
          this.api.syncProjects().subscribe({
            next: () => this.api.getProjects().subscribe({ next: p2 => { this.projects = p2; this.cdr.detectChanges(); }, error: () => {} }),
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
    // Load all tasks for filter dropdown
    this.api.getTasks().subscribe({
      next: t => {
        this.allTasks    = t.filter(x => !x.parent_task_id);
        this.allSubtasks = t.filter(x => !!x.parent_task_id);
        this.cdr.detectChanges();
      },
      error: () => {}
    });
    this.loadTimeEntries();
  }

  loadTimeEntries() {
    const filters: Record<string, string> = {};
    if (this.filterDateFrom) filters['date_from'] = this.filterDateFrom;
    if (this.filterDateTo)   filters['date_to']   = this.filterDateTo;

    // Employee: auto-filter to their own entries
    const user = this.auth.currentUser();
    if (this.auth.isEmployee() && user?.employee_id) {
      filters['employee_id'] = user.employee_id;
    }

    this.api.getTimeEntries(filters).subscribe({
      next: e => {
        this.allTimeEntries = e;
        this.applyClientFilters();
        this.loading = false;
        this.cdr.detectChanges();
      },
      error: () => { this.loading = false; this.cdr.detectChanges(); }
    });
  }

  applyClientFilters() {
    let list = [...this.allTimeEntries];
    if (this.filterProjectIds.length)  list = list.filter(e => this.filterProjectIds.includes(e.project_id));
    if (this.filterEmployeeIds.length) list = list.filter(e => this.filterEmployeeIds.includes(e.employee_id));
    if (this.filterTaskIds.length)     list = list.filter(e => e.task_id != null && this.filterTaskIds.includes(e.task_id));
    if (this.filterSubtaskIds.length)  list = list.filter(e => e.subtask_id != null && this.filterSubtaskIds.includes(e.subtask_id));
    // Apply topbar search query
    const q = this.search.query().toLowerCase().trim();
    if (q) {
      list = list.filter(e => {
        const empName = this.getEmployeeName(e.employee_id, (e as any)['employee']).toLowerCase();
        const projName = this.getProjectName(e.project_id).toLowerCase();
        const desc = (e.description || '').toLowerCase();
        return empName.includes(q) || projName.includes(q) || desc.includes(q);
      });
    }
    this.timeEntries = list;
  }

  onDateFilterChange() { this.loadTimeEntries(); }

  // ── Searchable multi-select helpers ────────────────────────────────────────

  get filteredProjects()  { return this.projects.filter(p => p.name.toLowerCase().includes(this.projectSearch.toLowerCase())); }
  get filteredEmployees() { return this.employees.filter(e => `${e.first_name} ${e.last_name}`.toLowerCase().includes(this.employeeSearch.toLowerCase())); }
  get filteredTasks()     { return this.allTasks.filter(t => t.title.toLowerCase().includes(this.taskSearch.toLowerCase())); }
  get filteredSubtasks()  { return this.allSubtasks.filter(s => s.title.toLowerCase().includes(this.subtaskSearch.toLowerCase())); }

  toggleFilter(arr: string[], id: string): string[] {
    return arr.includes(id) ? arr.filter(x => x !== id) : [...arr, id];
  }

  toggleProjectFilter(id: string)  { this.filterProjectIds  = this.toggleFilter(this.filterProjectIds,  id); this.applyClientFilters(); }
  toggleEmployeeFilter(id: string) { this.filterEmployeeIds = this.toggleFilter(this.filterEmployeeIds, id); this.applyClientFilters(); }
  toggleTaskFilter(id: string)     { this.filterTaskIds     = this.toggleFilter(this.filterTaskIds,     id); this.applyClientFilters(); }
  toggleSubtaskFilter(id: string)  { this.filterSubtaskIds  = this.toggleFilter(this.filterSubtaskIds,  id); this.applyClientFilters(); }

  clearProjectFilter()  { this.filterProjectIds  = []; this.applyClientFilters(); }
  clearEmployeeFilter() { this.filterEmployeeIds = []; this.applyClientFilters(); }
  clearTaskFilter()     { this.filterTaskIds     = []; this.applyClientFilters(); }
  clearSubtaskFilter()  { this.filterSubtaskIds  = []; this.applyClientFilters(); }

  filterLabel(ids: string[], all: { id: string; label: string }[], singular: string): string {
    if (!ids.length) return `All ${singular}s`;
    if (ids.length === 1) return all.find(x => x.id === ids[0])?.label ?? '1 selected';
    return `${ids.length} selected`;
  }

  get projectFilterLabel()  { return this.filterLabel(this.filterProjectIds,  this.projects.map(p => ({ id: p.id, label: p.name })), 'Project'); }
  get employeeFilterLabel() { return this.filterLabel(this.filterEmployeeIds, this.employees.map(e => ({ id: e.id, label: `${e.first_name} ${e.last_name}` })), 'Employee'); }
  get taskFilterLabel()     { return this.filterLabel(this.filterTaskIds,     this.allTasks.map(t => ({ id: t.id, label: t.title })), 'Task'); }
  get subtaskFilterLabel()  { return this.filterLabel(this.filterSubtaskIds,  this.allSubtasks.map(s => ({ id: s.id, label: s.title })), 'Subtask'); }

  toggleDrop(which: 'project' | 'employee' | 'task' | 'subtask', e: MouseEvent) {
    e.stopPropagation();
    this.showProjectDrop  = which === 'project'  ? !this.showProjectDrop  : false;
    this.showEmployeeDrop = which === 'employee' ? !this.showEmployeeDrop : false;
    this.showTaskDrop     = which === 'task'     ? !this.showTaskDrop     : false;
    this.showSubtaskDrop  = which === 'subtask'  ? !this.showSubtaskDrop  : false;
    this.cdr.detectChanges();
  }

  stopProp(e: MouseEvent) { e.stopPropagation(); }

  // ── Cascading dropdowns (new entry modal) ─────────────────────────────────

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

  onHoursManualEdit() { this.hoursManuallyEdited = true; }

  resetHoursManual() {
    this.hoursManuallyEdited = false;
    this.onDatetimeChange();
  }

  // ── New Entry Modal ───────────────────────────────────────────────────────

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

  closeModal() { this.showModal = false; }

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
    const payload: any = {
      task_id:        this.form.task_id || null,
      project_id:     this.form.project_id,
      subtask_id:     this.form.subtask_id || null,
      employee_id:    this.form.employee_id,
      description:    this.form.description,
      start_datetime: this.form.start_datetime,
      end_datetime:   this.form.end_datetime,
      hours_worked:   this.form.hours_worked,
    };
    this.api.createTimeEntry(payload).subscribe({
      next: entry => {
        this.allTimeEntries.unshift(entry);
        this.applyClientFilters();
        this.saving = false;
        this.success = 'Time entry saved successfully.';
        this.cdr.detectChanges();
        setTimeout(() => { this.success = ''; this.closeModal(); this.cdr.detectChanges(); }, 1500);
      },
      error: err => {
        this.saving = false;
        this.error = err?.error?.error || err?.error?.message || 'Failed to save time entry.';
        this.cdr.detectChanges();
      }
    });
  }

  // ── Edit Entry Modal ──────────────────────────────────────────────────────

  openEditModal(entry: TimeEntry) {
    this.editingEntry = entry;
    this.editError = '';
    this.editHoursManual = false;
    this.editForm = {
      employee_id:    entry.employee_id,
      project_id:     entry.project_id,
      task_id:        entry.task_id || '',
      subtask_id:     entry.subtask_id || '',
      description:    entry.description || '',
      start_datetime: entry.start_datetime ? entry.start_datetime.substring(0, 16) : '',
      end_datetime:   entry.end_datetime   ? entry.end_datetime.substring(0, 16)   : '',
      hours_worked:   entry.hours_worked ?? null,
    };
    // Load tasks for this project
    this.editTasks = [];
    this.editSubtasks = [];
    if (entry.project_id) {
      this.api.getTasks(entry.project_id).subscribe({
        next: t => { this.editTasks = t.filter(x => !x.parent_task_id); this.cdr.detectChanges(); },
        error: () => {}
      });
    }
    if (entry.task_id) {
      this.api.getSubtasks(entry.task_id).subscribe({
        next: s => { this.editSubtasks = s; this.cdr.detectChanges(); },
        error: () => {}
      });
    }
    this.showEditModal = true;
    this.cdr.detectChanges();
  }

  closeEditModal() { this.showEditModal = false; this.editingEntry = null; this.cdr.detectChanges(); }

  onEditProjectChange() {
    this.editForm.task_id = '';
    this.editForm.subtask_id = '';
    this.editTasks = [];
    this.editSubtasks = [];
    if (!this.editForm.project_id) return;
    this.api.getTasks(this.editForm.project_id).subscribe({
      next: t => { this.editTasks = t.filter(x => !x.parent_task_id); this.cdr.detectChanges(); },
      error: () => {}
    });
  }

  onEditTaskChange() {
    this.editForm.subtask_id = '';
    this.editSubtasks = [];
    if (!this.editForm.task_id) return;
    this.api.getSubtasks(this.editForm.task_id).subscribe({
      next: s => { this.editSubtasks = s; this.cdr.detectChanges(); },
      error: () => {}
    });
  }

  onEditDatetimeChange() {
    if (this.editHoursManual) return;
    const calc = this.teService.calculateHours(this.editForm.start_datetime, this.editForm.end_datetime);
    if (calc !== null) { this.editForm.hours_worked = calc; this.cdr.detectChanges(); }
  }

  submitEdit() {
    if (!this.editingEntry) return;
    if (!this.editForm.project_id || !this.editForm.employee_id ||
        !this.editForm.start_datetime || !this.editForm.end_datetime) {
      this.editError = 'Project, Employee, Start and End time are required.';
      return;
    }
    this.editSaving = true;
    this.editError = '';
    const patch: any = {
      employee_id:    this.editForm.employee_id,
      project_id:     this.editForm.project_id,
      task_id:        this.editForm.task_id || null,
      subtask_id:     this.editForm.subtask_id || null,
      description:    this.editForm.description,
      start_datetime: this.editForm.start_datetime,
      end_datetime:   this.editForm.end_datetime,
      hours_worked:   this.editForm.hours_worked,
    };
    this.api.updateTimeEntry(this.editingEntry.id!, patch).subscribe({
      next: updated => {
        const idx = this.allTimeEntries.findIndex(e => e.id === updated.id);
        if (idx >= 0) this.allTimeEntries[idx] = updated;
        this.applyClientFilters();
        this.editSaving = false;
        this.showEditModal = false;
        this.editingEntry = null;
        this.success = 'Time entry updated.';
        this.cdr.detectChanges();
        setTimeout(() => { this.success = ''; this.cdr.detectChanges(); }, 2000);
      },
      error: err => {
        this.editSaving = false;
        this.editError = err?.error?.error || 'Failed to update time entry.';
        this.cdr.detectChanges();
      }
    });
  }

  // ── Delete Confirm ────────────────────────────────────────────────────────

  openDeleteConfirm(entry: TimeEntry) {
    this.deletingEntry = entry;
    this.showDeleteConfirm = true;
    this.cdr.detectChanges();
  }

  closeDeleteConfirm() { this.showDeleteConfirm = false; this.deletingEntry = null; this.cdr.detectChanges(); }

  confirmDelete() {
    if (!this.deletingEntry) return;
    this.deleteInProgress = true;
    this.api.deleteTimeEntry(this.deletingEntry.id!).subscribe({
      next: () => {
        this.allTimeEntries = this.allTimeEntries.filter(e => e.id !== this.deletingEntry!.id);
        this.applyClientFilters();
        this.deleteInProgress = false;
        this.showDeleteConfirm = false;
        this.deletingEntry = null;
        this.success = 'Time entry deleted.';
        this.cdr.detectChanges();
        setTimeout(() => { this.success = ''; this.cdr.detectChanges(); }, 2000);
      },
      error: err => {
        this.deleteInProgress = false;
        this.error = err?.error?.error || 'Failed to delete time entry.';
        this.cdr.detectChanges();
      }
    });
  }

  // ── Helpers ───────────────────────────────────────────────────────────────

  emptyForm(): TimeEntryFormData {
    return { project_id: '', task_id: '', subtask_id: '', employee_id: '', description: '', start_datetime: '', end_datetime: '', hours_worked: null };
  }

  emptyEditForm(): EditEntryForm {
    return { employee_id: '', project_id: '', task_id: '', subtask_id: '', description: '', start_datetime: '', end_datetime: '', hours_worked: null };
  }

  formatHours(h: number): string { return this.teService.formatHours(h); }

  getEmployeeName(id: string, entryEmployee?: any): string {
    // Prefer the joined employee object on the time entry row (has actual name from Directus)
    if (entryEmployee && (entryEmployee.first_name || entryEmployee.last_name)) {
      return `${entryEmployee.first_name ?? ''} ${entryEmployee.last_name ?? ''}`.trim();
    }
    // Fallback: look up in loaded employees list
    const e = this.employees.find(x => x.id === id);
    return e ? `${e.first_name} ${e.last_name}` : id;
  }

  getProjectName(id: string): string { return this.projects.find(p => p.id === id)?.name ?? id; }

  getTaskName(id: string | null | undefined): string {
    if (!id) return '—';
    return this.allTasks.find(t => t.id === id)?.title ?? this.allSubtasks.find(s => s.id === id)?.title ?? id;
  }
}
