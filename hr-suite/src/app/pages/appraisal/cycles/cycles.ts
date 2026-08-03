import { Component } from '@angular/core';

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
  imports: [],
  templateUrl: './cycles.html',
  styleUrl: './cycles.scss'
})
export class Cycles {
  activeTab = 'Active';
  tabs = ['Active', 'Upcoming', 'Completed', 'All'];

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

  phases = [
    { label: 'Goal Setting', icon: '🎯' },
    { label: 'Self Review', icon: '✍️' },
    { label: 'Manager Review', icon: '👔' },
    { label: 'Peer Review', icon: '👥' },
    { label: 'Calibration', icon: '⚖️' },
    { label: 'Finalized', icon: '✅' },
  ];
}
