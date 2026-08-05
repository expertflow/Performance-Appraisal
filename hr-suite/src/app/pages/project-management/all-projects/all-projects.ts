import { Component, inject, ChangeDetectorRef, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { ApiService } from '../../../services/api';
import { Project } from '../../../models';

// Open/Active projects sort first; closed/cancelled sort last
const STATUS_ORDER: Record<string, number> = {
  active: 0, on_hold: 1, completed: 2, cancelled: 3
};

@Component({
  selector: 'app-all-projects',
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './all-projects.html',
  styleUrl: './all-projects.scss'
})
export class AllProjects implements OnInit {
  private api    = inject(ApiService);
  private cdr    = inject(ChangeDetectorRef);
  private router = inject(Router);

  projects: Project[] = [];
  loading = true;

  // Filters
  filterStatus = '';
  searchText   = '';

  ngOnInit() { this.load(); }

  load() {
    this.loading = true;
    this.api.getProjects().subscribe({
      next: p => {
        if (p.length === 0) {
          // Auto-sync projects from Directus on first load
          this.api.syncProjects().subscribe({
            next: () => {
              this.api.getProjects().subscribe({
                next: p2 => {
                  this.projects = this.sortProjects(p2);
                  this.loading = false;
                  this.cdr.detectChanges();
                },
                error: () => { this.loading = false; this.cdr.detectChanges(); }
              });
            },
            error: () => {
              this.projects = this.sortProjects(p);
              this.loading = false;
              this.cdr.detectChanges();
            }
          });
        } else {
          this.projects = this.sortProjects(p);
          this.loading = false;
          this.cdr.detectChanges();
        }
      },
      error: () => { this.loading = false; this.cdr.detectChanges(); }
    });
  }

  /** Sort: open/active first, then on_hold, then completed, then cancelled */
  private sortProjects(list: Project[]): Project[] {
    return [...list].sort((a, b) => {
      const ao = STATUS_ORDER[a.status] ?? 99;
      const bo = STATUS_ORDER[b.status] ?? 99;
      if (ao !== bo) return ao - bo;
      return a.name.localeCompare(b.name);
    });
  }

  get filtered(): Project[] {
    return this.projects.filter(p => {
      if (this.filterStatus && p.status !== this.filterStatus) return false;
      if (this.searchText && !p.name.toLowerCase().includes(this.searchText.toLowerCase())) return false;
      return true;
    });
  }

  /** Navigate to Tasks page pre-filtered by this project's local UUID */
  viewTasks(project: Project) {
    this.router.navigate(['/tasks'], { queryParams: { project: project.id } });
  }

  statusLabel(s: string): string {
    const m: Record<string, string> = {
      active: 'Open', on_hold: 'On Hold',
      completed: 'Closed', cancelled: 'Cancelled'
    };
    return m[s] ?? s;
  }

  statusClass(s: string): string {
    const m: Record<string, string> = {
      active: 'badge-green', on_hold: 'badge-orange',
      completed: 'badge-blue', cancelled: 'badge-red'
    };
    return m[s] ?? 'badge-gray';
  }
}
