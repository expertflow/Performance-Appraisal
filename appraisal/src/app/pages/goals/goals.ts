import { Component } from '@angular/core';

interface GoalItem {
  id: string;
  title: string;
  employee: string;
  initials: string;
  color: string;
  dept: string;
  category: string;
  progress: number;
  dueDate: string;
  status: string;
  statusClass: string;
  description: string;
}

@Component({
  selector: 'app-goals',
  imports: [],
  templateUrl: './goals.html',
  styleUrl: './goals.scss'
})
export class Goals {
  activeTab = 'All Goals';
  tabs = ['All Goals', 'My Team', 'Overdue', 'Completed'];
  activeFilter = 'All';
  filters = ['All', 'Engineering', 'Product', 'Design', 'Operations'];

  goals: GoalItem[] = [
    {
      id: 'G-2025-041',
      title: 'Migrate legacy API to GraphQL',
      employee: 'Fatima Malik',
      initials: 'FM',
      color: 'blue',
      dept: 'Engineering',
      category: 'Technical',
      progress: 75,
      dueDate: 'Jun 30, 2025',
      status: 'On Track',
      statusClass: 'badge-green',
      description: 'Complete migration of 3 remaining REST endpoints to GraphQL schema',
    },
    {
      id: 'G-2025-040',
      title: 'Launch Q3 product roadmap',
      employee: 'Omar Sheikh',
      initials: 'OS',
      color: 'teal',
      dept: 'Product',
      category: 'Strategic',
      progress: 60,
      dueDate: 'Jul 15, 2025',
      status: 'On Track',
      statusClass: 'badge-green',
      description: 'Define and communicate Q3 product priorities to all stakeholders',
    },
    {
      id: 'G-2025-039',
      title: 'Redesign onboarding flow',
      employee: 'Zara Hussain',
      initials: 'ZH',
      color: 'purple',
      dept: 'Design',
      category: 'UX',
      progress: 40,
      dueDate: 'Jun 15, 2025',
      status: 'At Risk',
      statusClass: 'badge-orange',
      description: 'Complete user research and deliver new onboarding wireframes',
    },
    {
      id: 'G-2025-038',
      title: 'Reduce deployment time by 40%',
      employee: 'Ahmed Raza',
      initials: 'AR',
      color: 'teal',
      dept: 'Engineering',
      category: 'Operational',
      progress: 90,
      dueDate: 'Jun 30, 2025',
      status: 'On Track',
      statusClass: 'badge-green',
      description: 'Implement CI/CD pipeline improvements to reduce deployment time',
    },
    {
      id: 'G-2025-037',
      title: 'Complete PMP certification',
      employee: 'Khalid Mahmood',
      initials: 'KM',
      color: 'orange',
      dept: 'Operations',
      category: 'Development',
      progress: 20,
      dueDate: 'May 31, 2025',
      status: 'Overdue',
      statusClass: 'badge-red',
      description: 'Pass PMP exam and obtain certification',
    },
    {
      id: 'G-2025-036',
      title: 'Implement automated testing suite',
      employee: 'Nadia Baig',
      initials: 'NB',
      color: 'blue',
      dept: 'Engineering',
      category: 'Technical',
      progress: 100,
      dueDate: 'May 15, 2025',
      status: 'Completed',
      statusClass: 'badge-teal',
      description: 'Set up Playwright E2E tests covering all critical user flows',
    },
  ];

  setTab(tab: string) { this.activeTab = tab; }
  setFilter(filter: string) { this.activeFilter = filter; }

  getProgressColor(pct: number): string {
    if (pct === 100) return '#059669';
    if (pct >= 70) return '#0066CC';
    if (pct >= 40) return '#D97706';
    return '#DC2626';
  }
}
