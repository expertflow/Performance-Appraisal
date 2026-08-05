import { Component, inject, computed, signal, OnInit } from '@angular/core';
import { RouterLink } from '@angular/router';
import { CommonModule } from '@angular/common';
import { AuthService } from '../../../services/auth';
import { ApiService } from '../../../services/api';
import { forkJoin } from 'rxjs';

interface CycleSummary {
  id: string;
  name: string;
  period: string;
  daysLeft: number;
  phase: string;
  progress: number;
}

interface StatCard {
  label: string;
  value: string;
  sub: string;
}

interface DeptRow {
  dept: string;
  done: number;
  total: number;
  pct: number;
}

interface ScoreBar {
  label: string;
  count: number;
  color: string;
  pct: number;
}

@Component({
  selector: 'app-appraisal-dashboard',
  imports: [RouterLink, CommonModule],
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.scss'
})
export class AppraisalDashboard implements OnInit {
  private auth = inject(AuthService);
  private api  = inject(ApiService);

  // ── Role helpers ──────────────────────────────────────────────────────────
  readonly isEmployee  = computed(() => this.auth.isEmployee());
  readonly isManager   = computed(() => this.auth.isManager());
  readonly isHROrAdmin = computed(() => this.auth.hasRole('AppAdmin', 'HR'));
  readonly userName    = computed(() => this.auth.currentUser()?.name ?? 'You');

  // ── Loading state ─────────────────────────────────────────────────────────
  loading = signal(true);

  // ── Active cycle ──────────────────────────────────────────────────────────
  activeCycle = signal<CycleSummary | null>(null);

  // ── Stats ─────────────────────────────────────────────────────────────────
  orgStats     = signal<StatCard[]>([]);
  teamStats    = signal<StatCard[]>([]);
  myStats      = signal<StatCard[]>([]);

  get stats(): StatCard[] {
    if (this.isEmployee()) return this.myStats();
    if (this.isManager())  return this.teamStats();
    return this.orgStats();
  }

  // ── Completion data ───────────────────────────────────────────────────────
  deptCompletion = signal<DeptRow[]>([]);
  teamCompletion = signal<DeptRow[]>([]);

  get completionData(): DeptRow[] {
    return this.isManager() ? this.teamCompletion() : this.deptCompletion();
  }

  get completionLabel(): string {
    return this.isManager() ? 'Team Member' : 'Department';
  }

  // ── Score distribution ────────────────────────────────────────────────────
  scoreDistribution = signal<ScoreBar[]>([]);

  // ── Employee personal record ──────────────────────────────────────────────
  myRecord = signal<any | null>(null);
  myGoals  = signal<any[]>([]);

  // ── Lifecycle ─────────────────────────────────────────────────────────────
  ngOnInit(): void {
    this.api.getAppraisalCycles().subscribe({
      next: cycles => {
        const active = cycles.find(c =>
          c.phase !== 'Upcoming' && c.phase !== 'Finalized' && c.phase !== 'Signed'
        ) ?? cycles[0] ?? null;

        if (!active) {
          this.loading.set(false);
          return;
        }

        const fmt = (d: string | null) => d ? new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—';
        const daysLeft = active.review_end
          ? Math.max(0, Math.ceil((new Date(active.review_end).getTime() - Date.now()) / 86400000))
          : 0;

        this.activeCycle.set({
          id:       active.id,
          name:     active.name,
          period:   `${fmt(active.period_start)} – ${fmt(active.period_end)}`,
          daysLeft,
          phase:    active.phase ?? 'In Progress',
          progress: 0, // computed after records load
        });

        const user = this.auth.currentUser();
        const cycleId = active.id;

        // Load records for this cycle
        const records$ = this.api.getAppraisalRecords({ cycleId });
        const goals$   = this.api.getAppraisalRecords({ cycleId, employeeId: user?.id });

        forkJoin({ records: records$, myRecs: goals$ }).subscribe({
          next: ({ records, myRecs }) => {
            this.buildOrgStats(records);
            this.buildDeptCompletion(records);
            this.buildScoreDistribution(records);

            if (user) {
              this.buildTeamStats(records, user.id);
              this.buildTeamCompletion(records, user.id);
              const myRec = records.find(r => r.employeeId === user.id) ?? null;
              this.myRecord.set(myRec);
              this.buildMyStats(myRec, records);
            }

            // Compute overall progress = % of records with status != 'draft'
            const total = records.length;
            const done  = records.filter(r => r.status !== 'draft').length;
            const pct   = total > 0 ? Math.round((done / total) * 100) : 0;
            this.activeCycle.update(c => c ? { ...c, progress: pct } : c);

            this.loading.set(false);
          },
          error: () => this.loading.set(false)
        });
      },
      error: () => this.loading.set(false)
    });
  }

  // ── Builders ──────────────────────────────────────────────────────────────

  private buildOrgStats(records: any[]): void {
    const total      = records.length;
    const selfDone   = records.filter(r => r.selfReview && r.selfReview.trim()).length;
    const mgrDone    = records.filter(r => r.managerReview && r.managerReview.trim()).length;
    const calibrated = records.filter(r => r.status === 'finalized' || r.status === 'signed').length;
    const selfPct    = total > 0 ? Math.round((selfDone / total) * 100) : 0;
    const mgrPct     = total > 0 ? Math.round((mgrDone / total) * 100) : 0;
    const calPct     = total > 0 ? Math.round((calibrated / total) * 100) : 0;

    this.orgStats.set([
      { label: 'Total Employees', value: String(total),      sub: 'In current cycle' },
      { label: 'Self Reviews Done', value: String(selfDone), sub: `${selfPct}% completion` },
      { label: 'Manager Reviews',   value: String(mgrDone),  sub: `${mgrPct}% completion` },
      { label: 'Peer Reviews',      value: '—',              sub: 'Not tracked yet' },
      { label: 'Calibrated',        value: String(calibrated), sub: `${calPct}% finalized` },
    ]);
  }

  private buildTeamStats(records: any[], managerId: string): void {
    const team     = records.filter(r => r.managerId === managerId);
    const total    = team.length;
    const selfDone = team.filter(r => r.selfReview && r.selfReview.trim()).length;
    const mgrDone  = team.filter(r => r.managerReview && r.managerReview.trim()).length;
    const calib    = team.filter(r => r.status === 'finalized' || r.status === 'signed').length;
    const selfPct  = total > 0 ? Math.round((selfDone / total) * 100) : 0;
    const mgrPct   = total > 0 ? Math.round((mgrDone / total) * 100) : 0;

    this.teamStats.set([
      { label: 'My Team',           value: String(total),    sub: 'Direct reports' },
      { label: 'Self Reviews Done', value: String(selfDone), sub: `${selfPct}% completion` },
      { label: 'Manager Reviews',   value: String(mgrDone),  sub: `${mgrPct}% completion` },
      { label: 'Peer Reviews',      value: '—',              sub: 'Not tracked yet' },
      { label: 'Calibrated',        value: String(calib),    sub: 'Finalized' },
    ]);
  }

  private buildMyStats(rec: any | null, allRecords: any[]): void {
    if (!rec) {
      this.myStats.set([
        { label: 'My Self-Review',  value: 'Not started', sub: 'No record yet' },
        { label: 'Manager Review',  value: '—',           sub: '—' },
        { label: 'Peer Reviews',    value: '—',           sub: 'Not tracked yet' },
        { label: 'Goals',           value: '—',           sub: '—' },
        { label: 'Rating',          value: '—',           sub: 'Pending' },
      ]);
      return;
    }
    const selfStatus = rec.selfReview?.trim() ? 'Done' : 'Pending';
    const mgrStatus  = rec.managerReview?.trim() ? 'Done' : 'Awaiting manager';
    const rating     = rec.rating != null ? String(rec.rating) : 'TBD';

    this.myStats.set([
      { label: 'My Self-Review',  value: selfStatus, sub: selfStatus === 'Done' ? 'Submitted' : 'Not yet submitted' },
      { label: 'Manager Review',  value: mgrStatus,  sub: mgrStatus === 'Done' ? 'Completed' : 'Awaiting manager' },
      { label: 'Peer Reviews',    value: '—',        sub: 'Not tracked yet' },
      { label: 'Goals',           value: String(rec.goalsMet ?? 0), sub: 'Goals met' },
      { label: 'Rating',          value: rating,     sub: rec.status === 'finalized' ? 'Finalized' : 'Pending calibration' },
    ]);
  }

  private buildDeptCompletion(records: any[]): void {
    const map = new Map<string, { done: number; total: number }>();
    for (const r of records) {
      const dept = r.department || 'Unknown';
      if (!map.has(dept)) map.set(dept, { done: 0, total: 0 });
      const entry = map.get(dept)!;
      entry.total++;
      if (r.status !== 'draft') entry.done++;
    }
    const rows: DeptRow[] = [];
    map.forEach((v, dept) => {
      rows.push({ dept, done: v.done, total: v.total, pct: v.total > 0 ? Math.round((v.done / v.total) * 100) : 0 });
    });
    rows.sort((a, b) => b.pct - a.pct);
    this.deptCompletion.set(rows);
  }

  private buildTeamCompletion(records: any[], managerId: string): void {
    const team = records.filter(r => r.managerId === managerId);
    const rows: DeptRow[] = team.map(r => ({
      dept:  r.employeeName,
      done:  r.status !== 'draft' ? 1 : 0,
      total: 1,
      pct:   r.status !== 'draft' ? 100 : 0,
    }));
    this.teamCompletion.set(rows);
  }

  private buildScoreDistribution(records: any[]): void {
    const rated = records.filter(r => r.rating != null);
    const buckets = [
      { label: 'Exceptional', min: 4.5, max: 5.0, color: '#059669' },
      { label: 'Exceeds',     min: 3.5, max: 4.5, color: '#0066CC' },
      { label: 'Meets',       min: 2.5, max: 3.5, color: '#00A3A3' },
      { label: 'Below',       min: 1.5, max: 2.5, color: '#D97706' },
      { label: 'Unsatisfactory', min: 0, max: 1.5, color: '#DC2626' },
    ];
    const maxCount = Math.max(1, ...buckets.map(b =>
      rated.filter(r => r.rating >= b.min && r.rating < b.max + 0.01).length
    ));
    const bars: ScoreBar[] = buckets.map(b => {
      const count = rated.filter(r => r.rating >= b.min && r.rating <= b.max).length;
      return { label: b.label, count, color: b.color, pct: Math.round((count / maxCount) * 100) };
    });
    this.scoreDistribution.set(bars);
  }

  // ── Employee personal progress steps ─────────────────────────────────────
  get myProgressSteps() {
    const rec = this.myRecord();
    return [
      {
        label:  'Self-Review',
        status: rec?.selfReview?.trim() ? 'Done' : 'Pending',
        pct:    rec?.selfReview?.trim() ? 100 : 0,
        color:  rec?.selfReview?.trim() ? '#059669' : '#D97706',
      },
      {
        label:  'Manager Review',
        status: rec?.managerReview?.trim() ? 'Done' : 'Pending',
        pct:    rec?.managerReview?.trim() ? 100 : 0,
        color:  rec?.managerReview?.trim() ? '#059669' : '#D97706',
      },
      {
        label:  'Goals',
        status: rec ? `${rec.goalsMet ?? 0} met` : '—',
        pct:    50,
        color:  '#0066CC',
      },
      {
        label:  'Rating',
        status: rec?.rating != null ? String(rec.rating) : 'TBD',
        pct:    rec?.rating != null ? 100 : 0,
        color:  rec?.rating != null ? '#059669' : '#6B7280',
      },
    ];
  }
}
