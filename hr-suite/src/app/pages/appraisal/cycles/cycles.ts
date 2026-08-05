import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { ApiService } from '../../../services/api';
import { AuthService } from '../../../services/auth';

interface CycleItem {
  id: string;
  name: string;
  type: string;
  period: string;
  startDate: string;
  endDate: string;
  phase: string;
  phaseClass: string;
  totalEmployees: number;
  completed: number;
  pct: number;
}

@Component({
  selector: 'app-cycles',
  imports: [FormsModule, CommonModule],
  templateUrl: './cycles.html',
  styleUrl: './cycles.scss'
})
export class Cycles implements OnInit {
  private api  = inject(ApiService);
  private auth = inject(AuthService);

  readonly isAppAdmin = computed(() => this.auth.isAppAdmin());

  activeTab = 'Active';
  tabs = ['Active', 'Upcoming', 'Completed', 'All'];

  // Modal state
  showModal    = false;
  exportToast  = false;
  deleteConfirmId: string | null = null;
  deleting     = signal(false);

  newCycle = {
    name: '',
    type: 'Semi-Annual',
    periodStart: '',
    periodEnd: '',
    reviewStart: '',
    reviewEnd: '',
  };

  cycles = signal<CycleItem[]>([]);
  loading = signal(true);

  ngOnInit() {
    this.loadCycles();
  }

  loadCycles() {
    this.loading.set(true);
    this.api.getAppraisalCycles().subscribe({
      next: rows => {
        this.cycles.set(rows.map(r => this.mapCycle(r)));
        this.loading.set(false);
      },
      error: () => this.loading.set(false)
    });
  }

  private mapCycle(r: any): CycleItem {
    const fmt = (d: string | null) => {
      if (!d) return '';
      return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    };
    const periodStart = r.period_start ? fmt(r.period_start) : '';
    const periodEnd   = r.period_end   ? fmt(r.period_end)   : '';
    const period = (periodStart && periodEnd) ? `${periodStart} – ${periodEnd}` : '—';

    const phaseClassMap: Record<string, string> = {
      'Upcoming':       'badge-gray',
      'Goal Setting':   'badge-purple',
      'Self Review':    'badge-orange',
      'Manager Review': 'badge-blue',
      'Peer Review':    'badge-teal',
      'Calibration':    'badge-yellow',
      'Finalized':      'badge-green',
      'Signed':         'badge-teal',
    };

    return {
      id:             r.id,
      name:           r.name,
      type:           r.type ?? 'Annual',
      period,
      startDate:      r.review_start ? fmt(r.review_start) : '',
      endDate:        r.review_end   ? fmt(r.review_end)   : '',
      phase:          r.phase ?? 'Upcoming',
      phaseClass:     phaseClassMap[r.phase] ?? 'badge-gray',
      totalEmployees: 0,
      completed:      0,
      pct:            0,
    };
  }

  setTab(tab: string) {
    this.activeTab = tab;
  }

  get filteredCycles(): CycleItem[] {
    const all = this.cycles();
    if (this.activeTab === 'All') return all;
    if (this.activeTab === 'Active') return all.filter(c =>
      c.phase !== 'Upcoming' && c.phase !== 'Finalized' && c.phase !== 'Signed');
    if (this.activeTab === 'Upcoming') return all.filter(c => c.phase === 'Upcoming');
    if (this.activeTab === 'Completed') return all.filter(c =>
      c.phase === 'Finalized' || c.phase === 'Signed');
    return all;
  }

  phases = [
    { label: 'Goal Setting', icon: '🎯' },
    { label: 'Self Review', icon: '✍️' },
    { label: 'Manager Review', icon: '👔' },
    { label: 'Peer Review', icon: '👥' },
    { label: 'Calibration', icon: '⚖️' },
    { label: 'Finalized', icon: '✅' },
  ];

  get activeCycle(): CycleItem | null {
    return this.cycles().find(c =>
      c.phase !== 'Upcoming' && c.phase !== 'Finalized' && c.phase !== 'Signed'
    ) ?? null;
  }

  get activeCyclePhaseIndex(): number {
    const phase = this.activeCycle?.phase ?? '';
    return this.phases.findIndex(p => p.label === phase);
  }

  openModal()  { this.showModal = true; }
  closeModal() { this.showModal = false; this.resetForm(); }

  resetForm() {
    this.newCycle = { name: '', type: 'Semi-Annual', periodStart: '', periodEnd: '', reviewStart: '', reviewEnd: '' };
  }

  submitCycle() {
    if (!this.newCycle.name || !this.newCycle.periodStart || !this.newCycle.periodEnd) return;
    this.api.createAppraisalCycle({
      name:         this.newCycle.name,
      type:         this.newCycle.type,
      period_start: this.newCycle.periodStart,
      period_end:   this.newCycle.periodEnd,
      review_start: this.newCycle.reviewStart || null,
      review_end:   this.newCycle.reviewEnd   || null,
    }).subscribe({
      next: () => { this.closeModal(); this.loadCycles(); },
      error: () => { this.closeModal(); this.loadCycles(); }
    });
  }

  confirmDelete(id: string) {
    this.deleteConfirmId = id;
  }

  cancelDelete() {
    this.deleteConfirmId = null;
  }

  doDelete(id: string) {
    this.deleting.set(true);
    this.api.deleteAppraisalCycle(id).subscribe({
      next: () => {
        this.deleting.set(false);
        this.deleteConfirmId = null;
        this.loadCycles();
      },
      error: () => {
        this.deleting.set(false);
        this.deleteConfirmId = null;
      }
    });
  }

  exportData() {
    this.exportToast = true;
    setTimeout(() => this.exportToast = false, 3000);
  }
}
