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
  recruitCandidates   = signal<number>(0);
  recruitOffersPending = signal<number>(0);

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
        // Active Projects: all roles see real count
        const active = projects.filter(p => p.status === 'active');
        this.activeProjects.set(active.length);

        // At-risk: projects with health_status = 'at_risk'
        const atRisk = projects.filter(p => (p as any).health_status === 'at_risk');
        this.atRiskProjects.set(atRisk.length);

        // Open Tasks: all non-done top-level tasks
        const openT = tasks.filter(t => !t.parent_task_id && t.status !== 'done');
        this.openTasks.set(openT.length);
      },
      error: () => {}
    });

    // Total Employees: AppAdmin/HR only
    if (isAdminOrHR) {
      this.api.getEmployees().subscribe({
        next: emps => this.totalEmployees.set(emps.length),
        error: () => {}
      });

      // Open Positions: AppAdmin/HR only
      this.api.getJobPostings('Open').subscribe({
        next: jobs => {
          this.openPositions.set(jobs.length);
          // Candidates = all applications for open jobs
          this.recruitCandidates.set(jobs.length * 0); // will be overridden below
        },
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
          // Open positions = jobs with status Open
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

    // Total Employees: AppAdmin/HR only, real count
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

    // Open Positions: AppAdmin/HR only, real count
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

    // My Requisitions: Manager only
    if (r === 'Manager') {
      all.push({
        label: 'My Requisitions',
        value: String(managerTotal),
        sub: `${managerPending} pending approval`,
        icon: '📝',
        roles: ['Manager']
      });
    }

    // Active Projects: all roles, real count
    const projCount = this.activeProjects();
    all.push({
      label: 'Active Projects',
      value: projCount !== null ? String(projCount) : '…',
      sub: `${this.atRiskProjects() ?? 0} at risk`,
      icon: '🗂️',
      roles: ['AppAdmin', 'HR', 'Manager', 'Employee']
    });

    // Pending Approvals: AppAdmin/HR only
    if (isAdminOrHR) {
      all.push({
        label: 'Pending Approvals',
        value: '11',
        sub: 'Across all modules',
        icon: '⏳',
        roles: ['AppAdmin', 'HR']
      });
    }

    return all.filter(s => r && s.roles.includes(r));
  }

  // ── Recent Activity ────────────────────────────────────────────────────────
  get recentActivity() {
    const r = this.role();
    const all = [
      { text: 'Fatima Malik submitted self-review',       time: '2h ago', icon: '📊', roles: ['AppAdmin', 'HR', 'Manager'] },
      { text: 'REQ-2025-041 approved by CFO',             time: '4h ago', icon: '✅', roles: ['AppAdmin', 'HR'] },
      { text: 'Project "ERP Migration" marked at risk',   time: '6h ago', icon: '⚠️', roles: ['AppAdmin', 'HR', 'Manager', 'Employee'] },
      { text: 'Ahmed Raza offer letter sent',             time: '1d ago', icon: '📧', roles: ['AppAdmin', 'HR'] },
      { text: 'Q3 sprint planning completed',             time: '1d ago', icon: '🗓️', roles: ['AppAdmin', 'HR', 'Manager', 'Employee'] },
    ];
    return all.filter(a => r && a.roles.includes(r));
  }

  // ── Pending Actions (filtered by role) ────────────────────────────────────
  get pendingActions() {
    const r = this.role();
    const all = [
      { text: 'Review 3 pending job requisitions',    module: 'Recruitment', link: '/recruitment/requisitions', urgent: true,  roles: ['AppAdmin', 'HR', 'Manager'] },
      { text: 'Complete manager reviews (12 pending)', module: 'Appraisal',   link: '/appraisal/cycles',        urgent: true,  roles: ['AppAdmin', 'HR'] },
      { text: 'Approve timesheet entries (8)',         module: 'Projects',    link: '/timesheet',               urgent: false, roles: ['AppAdmin', 'HR', 'Manager'] },
      { text: 'Update Q3 project milestones',          module: 'Projects',    link: '/projects',                urgent: false, roles: ['AppAdmin', 'HR', 'Manager', 'Employee'] },
      { text: 'Send feedback reminders (3 overdue)',   module: 'Appraisal',   link: '/appraisal/feedback',      urgent: true,  roles: ['AppAdmin', 'HR'] },
    ];
    return all.filter(a => r && a.roles.includes(r));
  }
}
