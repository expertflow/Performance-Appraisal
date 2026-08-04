import { Component, inject, computed, signal, OnInit } from '@angular/core';
import { RouterLink } from '@angular/router';
import { CommonModule } from '@angular/common';
import { AuthService } from '../../services/auth';
import { RequisitionStoreService } from '../../services/requisition-store';

@Component({
  selector: 'app-dashboard',
  imports: [RouterLink, CommonModule],
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.scss'
})
export class Dashboard implements OnInit {
  private auth    = inject(AuthService);
  private reqStore = inject(RequisitionStoreService);

  // ── Role helpers ──────────────────────────────────────────────────────────
  readonly role        = computed(() => this.auth.role());
  readonly isAppAdmin  = computed(() => this.auth.isAppAdmin());
  readonly isHR        = computed(() => this.auth.isHR());
  readonly isManager   = computed(() => this.auth.isManager());
  readonly isEmployee  = computed(() => this.auth.isEmployee());
  readonly canRecruit  = computed(() => this.auth.canAccessRecruitment());
  readonly canAppraisal = computed(() => this.auth.canAccessAppraisal());
  readonly canProjects  = computed(() => this.auth.canAccessProjects());
  readonly canViewEmployees = computed(() => this.auth.canViewEmployees());

  // True for AppAdmin and HR only (full recruitment access)
  readonly isHrOrAdmin = computed(() => {
    const r = this.role();
    return r === 'AppAdmin' || r === 'HR';
  });

  // ── Manager requisition counts (loaded from backend) ──────────────────────
  readonly managerTotalReqs   = computed(() => this.reqStore.total());
  readonly managerPendingReqs = computed(() => {
    return this.reqStore.requisitions().filter(r => r.status === 'Pending Approval').length;
  });
  readonly managerOpenReqs = computed(() => {
    return this.reqStore.requisitions().filter(r => r.status === 'Open').length;
  });

  get userName(): string {
    return this.auth.currentUser()?.name ?? 'User';
  }

  ngOnInit(): void {
    // Load requisitions for Manager so dashboard shows real counts
    if (this.isManager()) {
      this.reqStore.load(1, 100); // load all to get accurate counts
    }
  }

  // ── Stat cards (filtered by role) ─────────────────────────────────────────
  get stats() {
    const r = this.role();
    const managerTotal   = this.managerTotalReqs();
    const managerPending = this.managerPendingReqs();

    const all = [
      { label: 'Total Employees',    value: '142',                          sub: '+3 this month',      icon: '👤', roles: ['AppAdmin', 'HR'] },
      { label: 'Open Positions',     value: '24',                           sub: '8 urgent',           icon: '📋', roles: ['AppAdmin', 'HR'] },
      { label: 'My Requisitions',    value: String(managerTotal),           sub: `${managerPending} pending approval`, icon: '📝', roles: ['Manager'] },
      { label: 'Active Projects',    value: '18',                           sub: '3 at risk',          icon: '🗂️', roles: ['AppAdmin', 'HR', 'Manager', 'Employee'] },
      { label: 'Pending Approvals',  value: '11',                           sub: 'Across all modules', icon: '⏳', roles: ['AppAdmin', 'HR'] },
    ];
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
