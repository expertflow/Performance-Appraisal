import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-dashboard',
  imports: [RouterLink],
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.scss'
})
export class Dashboard {
  currentCycle = {
    name: '2025 Mid-Year Review',
    period: 'Jan 1 – Jun 30, 2025',
    daysLeft: 12,
    phase: 'Manager Review',
    progress: 68,
  };

  stats = [
    { label: 'Total Employees', value: '142', sub: 'In current cycle' },
    { label: 'Self Reviews Done', value: '118', sub: '83% completion' },
    { label: 'Manager Reviews', value: '74', sub: '52% completion' },
    { label: 'Peer Reviews', value: '312', sub: 'Avg 2.2 per employee' },
    { label: 'Calibrated', value: '31', sub: '22% finalized' },
  ];

  deptCompletion = [
    { dept: 'Engineering', done: 28, total: 35, pct: 80 },
    { dept: 'Product', done: 12, total: 14, pct: 86 },
    { dept: 'Design', done: 8, total: 10, pct: 80 },
    { dept: 'Operations', done: 15, total: 22, pct: 68 },
    { dept: 'Finance', done: 9, total: 18, pct: 50 },
  ];

  scoreDistribution = [
    { label: 'Exceptional', count: 18, color: '#059669', pct: 85 },
    { label: 'Exceeds', count: 34, color: '#0066CC', pct: 70 },
    { label: 'Meets', count: 52, color: '#00A3A3', pct: 55 },
    { label: 'Below', count: 12, color: '#D97706', pct: 35 },
    { label: 'Unsatisfactory', count: 4, color: '#DC2626', pct: 20 },
  ];

  recentActivity = [
    { employee: 'Fatima Malik', action: 'Submitted self-review', time: '2h ago', initials: 'FM', color: 'blue' },
    { employee: 'Omar Sheikh', action: 'Manager review completed', time: '4h ago', initials: 'OS', color: 'teal' },
    { employee: 'Zara Hussain', action: 'Goals updated', time: '6h ago', initials: 'ZH', color: 'purple' },
  ];
}
