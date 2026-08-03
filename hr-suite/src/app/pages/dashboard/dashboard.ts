import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-dashboard',
  imports: [RouterLink],
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.scss'
})
export class Dashboard {
  stats = [
    { label: 'Total Employees', value: '142', sub: '+3 this month', icon: '👤' },
    { label: 'Open Positions', value: '24', sub: '8 urgent', icon: '📋' },
    { label: 'Active Projects', value: '18', sub: '3 at risk', icon: '🗂️' },
    { label: 'Pending Approvals', value: '11', sub: 'Across all modules', icon: '⏳' },
  ];

  recentActivity = [
    { text: 'Fatima Malik submitted self-review', time: '2h ago', icon: '📊' },
    { text: 'REQ-2025-041 approved by CFO', time: '4h ago', icon: '✅' },
    { text: 'Project "ERP Migration" marked at risk', time: '6h ago', icon: '⚠️' },
    { text: 'Ahmed Raza offer letter sent', time: '1d ago', icon: '📧' },
    { text: 'Q3 sprint planning completed', time: '1d ago', icon: '🗓️' },
  ];

  pendingActions = [
    { text: 'Review 3 pending job requisitions', module: 'Recruitment', link: '/recruitment/requisitions', urgent: true },
    { text: 'Complete manager reviews (12 pending)', module: 'Appraisal', link: '/appraisal/cycles', urgent: true },
    { text: 'Approve timesheet entries (8)', module: 'Projects', link: '/timesheet', urgent: false },
    { text: 'Update Q3 project milestones', module: 'Projects', link: '/projects', urgent: false },
    { text: 'Send feedback reminders (3 overdue)', module: 'Appraisal', link: '/appraisal/feedback', urgent: true },
  ];
}
