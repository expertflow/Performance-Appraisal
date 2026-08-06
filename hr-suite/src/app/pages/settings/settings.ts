import { Component, inject, computed, signal, OnInit } from '@angular/core';
// settings page
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../services/auth';
import { ApiService } from '../../services/api';
import { forkJoin, of } from 'rxjs';
import { catchError, switchMap } from 'rxjs/operators';
import { Employee } from '../../models';

interface ProjectTimeEntry {
  projectId: string;
  projectName: string;
  color: string;
  totalHours: number;
  entryCount: number;
}

// Palette for projects
const COLOR_PALETTE = [
  '#0066CC', '#059669', '#D97706', '#7C3AED',
  '#DC2626', '#0891B2', '#65A30D', '#DB2777',
];

@Component({
  selector: 'app-settings',
  imports: [CommonModule, RouterLink],
  templateUrl: './settings.html',
  styleUrl: './settings.scss'
})
export class Settings implements OnInit {
  private auth = inject(AuthService);
  private api  = inject(ApiService);

  readonly user         = computed(() => this.auth.currentUser());
  readonly isGoogleOnly = computed(() => this.auth.isGoogleOnly());

  // ── Employee profile fields loaded from Directus via backend ─────────────
  readonly department    = signal<string>('—');
  readonly designation   = signal<string>('—');
  readonly directusEmpId = signal<string>('—');   // Directus numeric employee ID

  // ── Total Time Logged (from Directus ERP) ────────────────────────────────
  readonly projectTimeEntries = signal<ProjectTimeEntry[]>([]);
  readonly loading             = signal(true);

  get userInitials(): string {
    const name = this.user()?.name ?? '';
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  }

  get roleLabel(): string {
    const r = this.user()?.role;
    if (r === 'AppAdmin') return 'App Administrator';
    if (r === 'HR')       return 'HR Manager';
    if (r === 'Manager')  return 'Team Manager';
    if (r === 'Employee') return 'Employee';
    return r ?? '';
  }

  get totalHours(): number {
    return this.projectTimeEntries().reduce((s, e) => s + e.totalHours, 0);
  }

  get totalEntries(): number {
    return this.projectTimeEntries().reduce((s, e) => s + e.entryCount, 0);
  }

  barWidth(hours: number): number {
    const max = Math.max(...this.projectTimeEntries().map(e => e.totalHours), 0);
    return max > 0 ? Math.round((hours / max) * 100) : 0;
  }

  ngOnInit(): void {
    const userEmail = this.user()?.email?.toLowerCase();
    const empId     = this.user()?.employee_id;

    // Step 1: Load employees to find the Directus employee record by email
    this.api.getEmployees()
      .pipe(
        catchError(() => of([] as Employee[])),
        switchMap(employees => {
          // Match by email first, fallback to employee_id
          let matchedEmp: Employee | undefined;
          if (userEmail) {
            matchedEmp = employees.find(e => (e.email ?? '').toLowerCase() === userEmail);
          }
          if (!matchedEmp && empId) {
            matchedEmp = employees.find(e => e.id === empId);
          }

          if (matchedEmp) {
            this.department.set(matchedEmp.department ?? '—');
            const desig = (matchedEmp as any).designation ?? matchedEmp.job_title ?? '—';
            this.designation.set(desig || '—');
            this.directusEmpId.set(matchedEmp.id ?? '—');
          }

          // Step 2: Fetch Directus time summary using the matched Directus employee ID
          const directusId = matchedEmp?.id ?? empId;
          if (!directusId) {
            this.loading.set(false);
            return of([]);
          }

          return this.api.getDirectusTimeSummary(directusId)
            .pipe(catchError(() => of([])));
        })
      )
      .subscribe(summary => {
        // Assign colors from palette
        const entries: ProjectTimeEntry[] = (summary as any[]).map((item, idx) => ({
          projectId:   item.projectId,
          projectName: item.projectName,
          color:       COLOR_PALETTE[idx % COLOR_PALETTE.length],
          totalHours:  item.totalHours,
          entryCount:  item.entryCount,
        }));
        this.projectTimeEntries.set(entries);
        this.loading.set(false);
      });
  }
}
