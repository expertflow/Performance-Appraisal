import { Component } from '@angular/core';
import { FormsModule } from '@angular/forms';

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
  imports: [FormsModule],
  templateUrl: './goals.html',
  styleUrl: './goals.scss'
})
export class Goals {
  activeTab = 'All Goals';
  tabs = ['All Goals', 'My Team', 'Overdue', 'Completed'];
  activeFilter = 'All';
  filters = ['All', 'Engineering', 'Product', 'Design', 'Operations'];

  // Modal state
  showModal = false;
  showUpdateModal = false;
  exportToast = false;
  selectedGoal: GoalItem | null = null;
  updatedProgress = 0;

  newGoal = {
    title: '',
    employee: '',
    dept: 'Engineering',
    category: 'Technical',
    dueDate: '',
    description: '',
  };

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

  get onTrackCount(): number { return this.goals.filter(g => g.status === 'On Track').length; }
  get atRiskCount(): number { return this.goals.filter(g => g.status === 'At Risk' || g.status === 'Overdue').length; }
  get completedCount(): number { return this.goals.filter(g => g.status === 'Completed').length; }

  setTab(tab: string) { this.activeTab = tab; }
  setFilter(filter: string) { this.activeFilter = filter; }

  get filteredGoals(): GoalItem[] {
    return this.goals.filter(g => {
      const matchTab = this.activeTab === 'All Goals' ||
        (this.activeTab === 'Overdue' && g.status === 'Overdue') ||
        (this.activeTab === 'Completed' && g.status === 'Completed') ||
        (this.activeTab === 'My Team');
      const matchFilter = this.activeFilter === 'All' || g.dept === this.activeFilter;
      return matchTab && matchFilter;
    });
  }

  getProgressColor(pct: number): string {
    if (pct === 100) return '#059669';
    if (pct >= 70) return '#0066CC';
    if (pct >= 40) return '#D97706';
    return '#DC2626';
  }

  openModal() { this.showModal = true; }
  closeModal() { this.showModal = false; this.resetForm(); }

  resetForm() {
    this.newGoal = { title: '', employee: '', dept: 'Engineering', category: 'Technical', dueDate: '', description: '' };
  }

  submitGoal() {
    if (!this.newGoal.title || !this.newGoal.employee) return;
    const initials = this.newGoal.employee.split(' ').map((w: string) => w[0]).join('').toUpperCase().slice(0, 2);
    const colors = ['blue', 'teal', 'purple', 'orange'];
    const color = colors[this.goals.length % colors.length];
    const fmt = (s: string) => {
      if (!s) return 'TBD';
      const d = new Date(s);
      return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    };
    const nextNum = 42 + (this.goals.length - 6);
    this.goals.unshift({
      id: `G-2025-0${nextNum}`,
      title: this.newGoal.title,
      employee: this.newGoal.employee,
      initials,
      color,
      dept: this.newGoal.dept,
      category: this.newGoal.category,
      progress: 0,
      dueDate: fmt(this.newGoal.dueDate),
      status: 'On Track',
      statusClass: 'badge-green',
      description: this.newGoal.description,
    });
    this.closeModal();
  }

  openUpdateModal(goal: GoalItem) {
    this.selectedGoal = goal;
    this.updatedProgress = goal.progress;
    this.showUpdateModal = true;
  }

  closeUpdateModal() {
    this.showUpdateModal = false;
    this.selectedGoal = null;
  }

  saveProgress() {
    if (!this.selectedGoal) return;
    this.selectedGoal.progress = this.updatedProgress;
    if (this.updatedProgress === 100) {
      this.selectedGoal.status = 'Completed';
      this.selectedGoal.statusClass = 'badge-teal';
    } else if (this.updatedProgress >= 60) {
      this.selectedGoal.status = 'On Track';
      this.selectedGoal.statusClass = 'badge-green';
    } else if (this.updatedProgress >= 30) {
      this.selectedGoal.status = 'At Risk';
      this.selectedGoal.statusClass = 'badge-orange';
    } else {
      this.selectedGoal.status = 'At Risk';
      this.selectedGoal.statusClass = 'badge-orange';
    }
    this.closeUpdateModal();
  }

  exportData() {
    this.exportToast = true;
    setTimeout(() => this.exportToast = false, 3000);
  }
}
