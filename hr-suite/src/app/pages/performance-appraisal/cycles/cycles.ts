import { Component } from '@angular/core';
import { FormsModule } from '@angular/forms';

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
  imports: [FormsModule],
  templateUrl: './cycles.html',
  styleUrl: './cycles.scss'
})
export class Cycles {
  activeTab = 'Active';
  tabs = ['Active', 'Upcoming', 'Completed', 'All'];

  // Modal state
  showModal = false;
  exportToast = false;

  newCycle = {
    name: '',
    type: 'Semi-Annual',
    periodStart: '',
    periodEnd: '',
    reviewStart: '',
    reviewEnd: '',
  };

  cycles: CycleItem[] = [
    {
      id: 'CYC-2025-02',
      name: '2025 Mid-Year Review',
      type: 'Semi-Annual',
      period: 'Jan 1 – Jun 30, 2025',
      startDate: 'Jun 1, 2025',
      endDate: 'Aug 15, 2025',
      phase: 'Manager Review',
      phaseClass: 'badge-blue',
      totalEmployees: 142,
      completed: 74,
      pct: 52,
    },
    {
      id: 'CYC-2025-01',
      name: '2025 Q1 Check-in',
      type: 'Quarterly',
      period: 'Jan 1 – Mar 31, 2025',
      startDate: 'Apr 1, 2025',
      endDate: 'Apr 30, 2025',
      phase: 'Finalized',
      phaseClass: 'badge-green',
      totalEmployees: 138,
      completed: 138,
      pct: 100,
    },
    {
      id: 'CYC-2024-02',
      name: '2024 Annual Review',
      type: 'Annual',
      period: 'Jan 1 – Dec 31, 2024',
      startDate: 'Jan 5, 2025',
      endDate: 'Feb 28, 2025',
      phase: 'Signed',
      phaseClass: 'badge-teal',
      totalEmployees: 130,
      completed: 130,
      pct: 100,
    },
    {
      id: 'CYC-2025-03',
      name: '2025 Year-End Review',
      type: 'Annual',
      period: 'Jan 1 – Dec 31, 2025',
      startDate: 'Dec 15, 2025',
      endDate: 'Feb 15, 2026',
      phase: 'Upcoming',
      phaseClass: 'badge-gray',
      totalEmployees: 0,
      completed: 0,
      pct: 0,
    },
  ];

  setTab(tab: string) {
    this.activeTab = tab;
  }

  get filteredCycles(): CycleItem[] {
    if (this.activeTab === 'All') return this.cycles;
    if (this.activeTab === 'Active') return this.cycles.filter(c =>
      c.phase !== 'Upcoming' && c.phase !== 'Finalized' && c.phase !== 'Signed');
    if (this.activeTab === 'Upcoming') return this.cycles.filter(c => c.phase === 'Upcoming');
    if (this.activeTab === 'Completed') return this.cycles.filter(c =>
      c.phase === 'Finalized' || c.phase === 'Signed');
    return this.cycles;
  }

  phases = [
    { label: 'Goal Setting', icon: '🎯' },
    { label: 'Self Review', icon: '✍️' },
    { label: 'Manager Review', icon: '👔' },
    { label: 'Peer Review', icon: '👥' },
    { label: 'Calibration', icon: '⚖️' },
    { label: 'Finalized', icon: '✅' },
  ];

  openModal() { this.showModal = true; }
  closeModal() { this.showModal = false; this.resetForm(); }

  resetForm() {
    this.newCycle = { name: '', type: 'Semi-Annual', periodStart: '', periodEnd: '', reviewStart: '', reviewEnd: '' };
  }

  submitCycle() {
    if (!this.newCycle.name || !this.newCycle.periodStart || !this.newCycle.periodEnd) return;
    const fmt = (s: string) => {
      const d = new Date(s);
      return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    };
    const nextNum = this.cycles.length + 1;
    this.cycles.unshift({
      id: `CYC-2025-0${nextNum}`,
      name: this.newCycle.name,
      type: this.newCycle.type,
      period: `${fmt(this.newCycle.periodStart)} – ${fmt(this.newCycle.periodEnd)}`,
      startDate: this.newCycle.reviewStart ? fmt(this.newCycle.reviewStart) : fmt(this.newCycle.periodEnd),
      endDate: this.newCycle.reviewEnd ? fmt(this.newCycle.reviewEnd) : '',
      phase: 'Upcoming',
      phaseClass: 'badge-gray',
      totalEmployees: 0,
      completed: 0,
      pct: 0,
    });
    this.closeModal();
  }

  exportData() {
    this.exportToast = true;
    setTimeout(() => this.exportToast = false, 3000);
  }
}
