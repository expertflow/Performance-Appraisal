import { Component, inject, computed } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../../services/auth';

@Component({
  selector: 'app-appraisal-dashboard',
  imports: [RouterLink],
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.scss'
})
export class AppraisalDashboard {
  private auth = inject(AuthService);

  // ── Role helpers exposed to template ──────────────────────────────────────
  readonly isEmployee  = computed(() => this.auth.isEmployee());
  readonly isManager   = computed(() => this.auth.isManager());
  readonly isHROrAdmin = computed(() => this.auth.hasRole('AppAdmin', 'HR'));

  /** Display name for the current user */
  readonly userName = computed(() => this.auth.currentUser()?.name ?? 'You');

  // ── Cycle info ─────────────────────────────────────────────────────────────
  currentCycle = {
    name: '2025 Mid-Year Review',
    period: 'Jan 1 – Jun 30, 2025',
    daysLeft: 12,
    phase: 'Manager Review',
    progress: 68,
  };

  // ── HR / AppAdmin: org-wide stats ─────────────────────────────────────────
  orgStats = [
    { label: 'Total Employees', value: '142', sub: 'In current cycle' },
    { label: 'Self Reviews Done', value: '118', sub: '83% completion' },
    { label: 'Manager Reviews', value: '74', sub: '52% completion' },
    { label: 'Peer Reviews', value: '312', sub: 'Avg 2.2 per employee' },
    { label: 'Calibrated', value: '31', sub: '22% finalized' },
  ];

  // ── Manager: team stats (mock — 5 direct reports) ─────────────────────────
  teamStats = [
    { label: 'My Team', value: '5', sub: 'Direct reports' },
    { label: 'Self Reviews Done', value: '4', sub: '80% completion' },
    { label: 'Manager Reviews', value: '2', sub: '40% completion' },
    { label: 'Peer Reviews', value: '11', sub: 'Avg 2.2 per employee' },
    { label: 'Calibrated', value: '1', sub: '20% finalized' },
  ];

  // ── Employee: personal stats ───────────────────────────────────────────────
  myStats = [
    { label: 'My Self-Review', value: 'Done', sub: 'Submitted Jul 18' },
    { label: 'Manager Review', value: 'Pending', sub: 'Awaiting manager' },
    { label: 'Peer Reviews', value: '3', sub: 'Received this cycle' },
    { label: 'Goals', value: '4', sub: '2 on track, 1 at risk' },
    { label: 'Rating', value: 'TBD', sub: 'Pending calibration' },
  ];

  get stats() {
    if (this.isEmployee()) return this.myStats;
    if (this.isManager()) return this.teamStats;
    return this.orgStats;
  }

  // ── Department completion (HR/Admin only) ─────────────────────────────────
  deptCompletion = [
    { dept: 'Engineering', done: 28, total: 35, pct: 80 },
    { dept: 'Product', done: 12, total: 14, pct: 86 },
    { dept: 'Design', done: 8, total: 10, pct: 80 },
    { dept: 'Operations', done: 15, total: 22, pct: 68 },
    { dept: 'Finance', done: 9, total: 18, pct: 50 },
  ];

  // ── Manager: team completion ───────────────────────────────────────────────
  teamCompletion = [
    { dept: 'Fatima Malik', done: 1, total: 1, pct: 100 },
    { dept: 'Omar Sheikh', done: 1, total: 1, pct: 100 },
    { dept: 'Zara Hussain', done: 0, total: 1, pct: 0 },
    { dept: 'Ahmed Raza', done: 1, total: 1, pct: 100 },
    { dept: 'Khalid Mahmood', done: 0, total: 1, pct: 20 },
  ];

  get completionData() {
    return this.isManager() ? this.teamCompletion : this.deptCompletion;
  }

  get completionLabel() {
    return this.isManager() ? 'Team Member' : 'Department';
  }

  // ── Score distribution ─────────────────────────────────────────────────────
  scoreDistribution = [
    { label: 'Exceptional', count: 18, color: '#059669', pct: 85 },
    { label: 'Exceeds', count: 34, color: '#0066CC', pct: 70 },
    { label: 'Meets', count: 52, color: '#00A3A3', pct: 55 },
    { label: 'Below', count: 12, color: '#D97706', pct: 35 },
    { label: 'Unsatisfactory', count: 4, color: '#DC2626', pct: 20 },
  ];

  // ── Recent activity ────────────────────────────────────────────────────────
  orgActivity = [
    { employee: 'Fatima Malik', action: 'Submitted self-review', time: '2h ago', initials: 'FM', color: 'blue' },
    { employee: 'Omar Sheikh', action: 'Manager review completed', time: '4h ago', initials: 'OS', color: 'teal' },
    { employee: 'Zara Hussain', action: 'Goals updated', time: '6h ago', initials: 'ZH', color: 'purple' },
  ];

  teamActivity = [
    { employee: 'Fatima Malik', action: 'Submitted self-review', time: '2h ago', initials: 'FM', color: 'blue' },
    { employee: 'Ahmed Raza', action: 'Goals updated', time: '5h ago', initials: 'AR', color: 'teal' },
  ];

  myActivity = [
    { employee: 'You', action: 'Submitted self-review', time: 'Jul 18', initials: 'ME', color: 'blue' },
    { employee: 'Manager', action: 'Viewed your review', time: 'Jul 20', initials: 'MG', color: 'teal' },
  ];

  get recentActivity() {
    if (this.isEmployee()) return this.myActivity;
    if (this.isManager()) return this.teamActivity;
    return this.orgActivity;
  }
}
