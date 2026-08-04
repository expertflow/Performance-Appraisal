import { Component, inject, computed, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../../services/auth';
import { ApiService } from '../../../services/api';
import { Project } from '../../../models';

type ProjectType   = 'client' | 'internal' | 'operational';
type ProjectStatus = 'active' | 'on_hold' | 'completed' | 'cancelled';
type HealthStatus  = 'on_track' | 'at_risk' | 'off_track';

interface ProjectForm {
  name: string;
  type: ProjectType;
  status: ProjectStatus;
  health_status: HealthStatus;
  start_date: string;
  end_date: string;
  budget_hours?: number;
  budget_amount?: number;
}

@Component({
  selector: 'app-all-projects',
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './all-projects.html',
  styleUrl: './all-projects.scss'
})
export class AllProjects implements OnInit {
  private auth = inject(AuthService);
  private api  = inject(ApiService);

  readonly canMutate  = computed(() => this.auth.canMutateProjects());
  readonly isEmployee = computed(() => this.auth.isEmployee());

  projects: Project[] = [];
  loading = true;
  saving  = signal(false);
  error   = '';
  success = '';

  // Filters
  filterStatus = '';
  filterType   = '';
  searchText   = '';

  // New project modal
  showModal = false;
  newForm: ProjectForm = this.emptyForm();

  // Edit modal
  showEditModal = false;
  editId = '';
  editForm: ProjectForm = this.emptyForm();

  ngOnInit() { this.load(); }

  load() {
    this.loading = true;
    this.api.getProjects().subscribe({
      next: p => { this.projects = p; this.loading = false; },
      error: () => { this.loading = false; }
    });
  }

  get filtered(): Project[] {
    return this.projects.filter(p => {
      if (this.filterStatus && p.status !== this.filterStatus) return false;
      if (this.filterType   && p.type   !== this.filterType)   return false;
      if (this.searchText   && !p.name.toLowerCase().includes(this.searchText.toLowerCase())) return false;
      return true;
    });
  }

  statusClass(s: string): string {
    const m: Record<string, string> = {
      active: 'badge-green', on_hold: 'badge-orange',
      completed: 'badge-blue', cancelled: 'badge-red'
    };
    return m[s] ?? 'badge-gray';
  }

  healthClass(h?: string): string {
    if (h === 'on_track')  return 'badge-green';
    if (h === 'at_risk')   return 'badge-orange';
    if (h === 'off_track') return 'badge-red';
    return 'badge-gray';
  }

  openNew() {
    this.newForm = this.emptyForm();
    this.error = '';
    this.showModal = true;
  }

  closeNew() { this.showModal = false; }

  submitNew() {
    if (!this.newForm.name.trim()) { this.error = 'Project name is required.'; return; }
    this.saving.set(true);
    this.error = '';
    const payload: Partial<Project> = {
      name: this.newForm.name,
      type: this.newForm.type,
      status: this.newForm.status,
      health_status: this.newForm.health_status,
      start_date: this.newForm.start_date || undefined,
      end_date: this.newForm.end_date || undefined,
      budget_hours: this.newForm.budget_hours,
      budget_amount: this.newForm.budget_amount
    };
    this.api.createProject(payload).subscribe({
      next: (p: Project) => {
        this.projects.unshift(p);
        this.saving.set(false);
        this.success = 'Project created!';
        this.showModal = false;
        setTimeout(() => this.success = '', 3000);
      },
      error: (err: { error?: { error?: string } }) => {
        this.saving.set(false);
        this.error = err?.error?.error || 'Failed to create project.';
      }
    });
  }

  openEdit(p: Project) {
    this.editId = p.id;
    this.editForm = {
      name: p.name,
      type: p.type,
      status: p.status,
      health_status: p.health_status ?? 'on_track',
      start_date: p.start_date ?? '',
      end_date: p.end_date ?? '',
      budget_hours: p.budget_hours,
      budget_amount: p.budget_amount
    };
    this.error = '';
    this.showEditModal = true;
  }

  closeEdit() { this.showEditModal = false; }

  saveEdit() {
    if (!this.editId) return;
    this.saving.set(true);
    this.error = '';
    const patch: Partial<Project> = {
      name: this.editForm.name,
      type: this.editForm.type,
      status: this.editForm.status,
      health_status: this.editForm.health_status,
      start_date: this.editForm.start_date || undefined,
      end_date: this.editForm.end_date || undefined,
      budget_hours: this.editForm.budget_hours,
      budget_amount: this.editForm.budget_amount
    };
    this.api.updateProject(this.editId, patch).subscribe({
      next: (updated: Project) => {
        const idx = this.projects.findIndex(p => p.id === this.editId);
        if (idx >= 0) this.projects[idx] = updated;
        this.saving.set(false);
        this.success = 'Project updated!';
        this.showEditModal = false;
        setTimeout(() => this.success = '', 3000);
      },
      error: (err: { error?: { error?: string } }) => {
        this.saving.set(false);
        this.error = err?.error?.error || 'Failed to update project.';
      }
    });
  }

  private emptyForm(): ProjectForm {
    return {
      name: '', type: 'internal', status: 'active',
      health_status: 'on_track', start_date: '', end_date: ''
    };
  }
}
