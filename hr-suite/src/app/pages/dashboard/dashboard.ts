import { Component, inject, computed, signal, OnInit } from '@angular/core';
import { RouterLink } from '@angular/router';
import { CommonModule } from '@angular/common';
import { forkJoin } from 'rxjs';
import { AuthService } from '../../services/auth';
import { ApiService } from '../../services/api';
import { RequisitionStoreService } from '../../services/requisition-store';

@Component({
  selector: 'app-dashboard',
  imports: [RouterLink, CommonModule],
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.scss'
})
export class Dashboard implements OnInit {
  private auth     = inject(AuthService);
  private api      = inject(ApiService);
  private reqStore = inject(RequisitionStoreService);

  // ── Role helpers ──────────────────────────────────────────────────────────
  readonly role         = computed(() => this.auth.role());
  readonly isAppAdmin   = computed(() => this.auth.isAppAdmin());
  readonly isHR         = computed(() => this.auth.isHR());
  readonly isManager    = computed(() => this.auth.isManager());
  readonly isEmployee   = computed(() => this.auth.isEmployee());
  readonly canRecruit   = computed(() => this.auth.canAccessRecruitment());
  readonly canAppraisal = computed(() => this.auth.canAccessAppraisal());
  readonly canProjects  = computed(() => this.auth.canAccessProjects());
  readonly canViewEmployees = computed(() => this.auth.canViewEmployees());

  readonly isHrOrAdmin = computed(() => {
    const r = this.role();
    return r === 'AppAdmin' || r === 'HR';
  });

  // ── Manager requisition counts ────────────────────────────────────────────
  readonly managerTotalReqs   = computed(() => this.reqStore.total());
  readonly managerPendingReqs = computed(() => {
    return this.reqStore.requisitions().filter(r => r.status === 'Pending Approval').length;
  });
  readonly managerOpenReqs = computed(() => {
    return this.reqStore.requisitions().filter(r => r.status === 'Open').length;
  });

  // ── Real data signals ─────────────────────────────────────────────────────
  totalEmployees   = signal<number | null>(null);
  openPositions    = signal<number | null>(null);
  activeProjects   = signal<number | null>(null);
  openTasks        = signal<number | null>(null);
  atRiskProjects   = signal<number | null>(null);

  // Recruitment module card stats
  recruitCandidates    = signal<number>(0);
  recruitOffersPending = signal<number>(0);

  // Appraisal module card stats
  appraisalInCycle    = signal<number>(0);
  appraisalCompletion = signal<number>(0);
  appraisalDaysLeft   = signal<number>(0);
  appraisalHasCycle   = signal<boolean>(false);

  get userName(): string {
    return this.auth.currentUser()?.name ?? 'User';
  }

  ngOnInit(): void {
    // Load requisitions for Manager
    if (this.isManager()) {
      this.reqStore.load(1, 100);
    }
    this.loadDashboardData();
  }

  private loadDashboardData(): void {
    const r = this.role();
    const isAdminOrHR = r === 'AppAdmin' || r === 'HR';

    // Always load projects (all roles see Active Projects count)
    forkJoin({
      projects: this.api.getProjects(),
      tasks:    this.api.getTasks(),
    }).subscribe({
      next: ({ projects, tasks }) => {
        const active = projects.filter(p => p.status === 'active');
        this.activeProjects.set(active.length);
        const atRisk = projects.filter(p => (p as any).health_status === 'at_risk');
        this.atRiskProjects.set(atRisk.length);
        const openT = tasks.filter(t => !t.parent_task_id && t.status !== 'done');
        this.openTasks.set(openT.length);
      },
      error: () => {}
    });

    // Load appraisal cycles for the Performance Appraisal card
    this.api.getAppraisalCycles().subscribe({
      next: cycles => {
        // Find the active cycle (not Upcoming, Finalized, or Signed)
        const active = cycles.find((c: any) =>
          c.phase !== 'Upcoming' && c.phase !== 'Finalized' && c.phase !== 'Signed'
        );
        if (active) {
          this.appraisalHasCycle.set(true);
          // Days left = review_end - today
          if (active.review_end) {
            const end = new Date(active.review_end);
            const today = new Date();
            const diff = Math.max(0, Math.ceil((end.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)));
            this.appraisalDaysLeft.set(diff);
          }
          // Load records for this cycle to compute completion
          this.api.getAppraisalRecords({ cycleId: active.id }).subscribe({
            next: records => {
              const total = records.length;
              const done  = records.filter((rec: any) => rec.status === 'completed' || rec.status === 'signed').length;
              this.appraisalInCycle.set(total);
              this.appraisalCompletion.set(total > 0 ? Math.round((done / total) * 100) : 0);
            },
            error: () => {}
          });
        } else {
          this.appraisalHasCycle.set(false);
          this.appraisalInCycle.set(0);
          this.appraisalCompletion.set(0);
          this.appraisalDaysLeft.set(0);
        }
      },
      error: () => {
        this.appraisalHasCycle.set(false);
      }
    });

    // Total Employees: AppAdmin/HR only
    if (isAdminOrHR) {
      this.api.getEmployees().subscribe({
        next: emps => this.totalEmployees.set(emps.length),
        error: () => {}
      });

      // Recruitment card: candidates + offers pending
      forkJoin({
        allJobs: this.api.getJobPostings(),
        allApps: this.api.getJobApplications(),
      }).subscribe({
        next: ({ allJobs, allApps }) => {
          this.recruitCandidates.set(allApps.length);
          const offersPending = allApps.filter(a => (a.status as string) === 'Shortlisted').length;
          this.recruitOffersPending.set(offersPending);
          const openJobs = allJobs.filter(j => j.status === 'Open');
          this.openPositions.set(openJobs.length);
        },
        error: () => {}
      });
    }
  }

  // ── Stat cards (filtered by role) ─────────────────────────────────────────
  get stats() {
    const r = this.role();
    const isAdminOrHR = r === 'AppAdmin' || r === 'HR';
    const managerTotal   = this.managerTotalReqs();
    const managerPending = this.managerPendingReqs();

    const all: { label: string; value: string; sub: string; icon: string; roles: string[] }[] = [];

    if (isAdminOrHR) {
      const empCount = this.totalEmployees();
      all.push({
        label: 'Total Employees',
        value: empCount !== null ? String(empCount) : '…',
        sub: 'Active employees',
        icon: '👤',
        roles: ['AppAdmin', 'HR']
      });
    }

    if (isAdminOrHR) {
      const posCount = this.openPositions();
      all.push({
        label: 'Open Positions',
        value: posCount !== null ? String(posCount) : '…',
        sub: 'Active job postings',
        icon: '📋',
        roles: ['AppAdmin', 'HR']
      });
    }

    if (r === 'Manager') {
      all.push({
        label: 'My Requisitions',
        value: String(managerTotal),
        sub: `${managerPending} pending approval`,
        icon: '📝',
        roles: ['Manager']
      });
    }

    const projCount = this.activeProjects();
    all.push({
      label: 'Active Projects',
      value: projCount !== null ? String(projCount) : '…',
      sub: `${this.atRiskProjects() ?? 0} at risk`,
      icon: '🗂️',
      roles: ['AppAdmin', 'HR', 'Manager', 'Employee']
    });

    return all.filter(s => r && s.roles.includes(r));
  }

  // ── Recent Activity ────────────────────────────────────────────────────────
  get recentActivity() {
    return [];
  }

  // ── Pending Actions (filtered by role) ────────────────────────────────────
  get pendingActions() {
    return [];
  }
}
