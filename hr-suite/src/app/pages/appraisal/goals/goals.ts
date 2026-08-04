import { Component, inject, computed, signal, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { AuthService } from '../../../services/auth';
import { AppraisalStoreService, AppraisalGoal } from '../../../services/appraisal-store';

@Component({
  selector: 'app-goals',
  imports: [FormsModule, CommonModule],
  templateUrl: './goals.html',
  styleUrl: './goals.scss'
})
export class Goals implements OnInit {
  private auth  = inject(AuthService);
  readonly store = inject(AppraisalStoreService);

  // ── Role helpers ───────────────────────────────────────────────────────────
  readonly isEmployee  = computed(() => this.auth.isEmployee());
  readonly isManager   = computed(() => this.auth.isManager());
  readonly isHROrAdmin = computed(() => this.auth.hasRole('AppAdmin', 'HR'));
  readonly canAddGoal  = computed(() => !this.auth.isEmployee());

  // ── UI state ───────────────────────────────────────────────────────────────
  activeTab    = 'All Goals';
  tabs         = ['All Goals', 'On Track', 'At Risk', 'Overdue', 'Completed'];
  activeFilter = 'All';
  filters      = ['All', 'Engineering', 'Product', 'Design', 'Operations', 'Finance'];

  showModal        = false;
  showUpdateModal  = false;
  exportToast      = false;
  saving           = signal(false);
  selectedGoal: AppraisalGoal | null = null;
  updatedProgress  = 0;

  newGoal = {
    employeeId:  '',
    title:       '',
    dept:        'Engineering',
    category:    'Technical',
    dueDate:     '',
    description: '',
  };

  ngOnInit(): void {
    const user = this.auth.currentUser();
    if (!user) return;

    if (this.auth.isEmployee()) {
      this.store.loadGoals({ employeeId: user.employee_id });
    } else if (this.auth.isManager()) {
      this.store.loadGoals({ managerId: user.employee_id });
      this.store.loadTeam(user.employee_id!);
    } else {
      // HR / AppAdmin — load all
      this.store.loadGoals();
    }
  }

  // ── Computed goal list ─────────────────────────────────────────────────────
  get goals(): AppraisalGoal[] { return this.store.goals(); }

  get onTrackCount():  number { return this.goals.filter(g => g.status === 'On Track').length; }
  get atRiskCount():   number { return this.goals.filter(g => g.status === 'At Risk' || g.status === 'Overdue').length; }
  get completedCount():number { return this.goals.filter(g => g.status === 'Completed').length; }

  get filteredGoals(): AppraisalGoal[] {
    return this.goals.filter(g => {
      const matchTab =
        this.activeTab === 'All Goals' ||
        (this.activeTab === 'On Track'  && g.status === 'On Track') ||
        (this.activeTab === 'At Risk'   && g.status === 'At Risk') ||
        (this.activeTab === 'Overdue'   && g.status === 'Overdue') ||
        (this.activeTab === 'Completed' && g.status === 'Completed');
      const matchFilter = this.activeFilter === 'All' || g.department === this.activeFilter;
      return matchTab && matchFilter;
    });
  }

  // ── Team members for Manager dropdown ─────────────────────────────────────
  get teamMembers() { return this.store.team(); }

  // ── Helpers ────────────────────────────────────────────────────────────────
  initials(name: string): string { return this.store.initials(name); }
  avatarColor(name: string): string { return this.store.avatarColor(name); }
  goalStatusClass(s: string): string { return this.store.goalStatusClass(s); }

  getProgressColor(pct: number): string {
    if (pct === 100) return '#059669';
    if (pct >= 70)   return '#0066CC';
    if (pct >= 40)   return '#D97706';
    return '#DC2626';
  }

  setTab(tab: string)       { this.activeTab = tab; }
  setFilter(filter: string) { this.activeFilter = filter; }

  // ── Modal ──────────────────────────────────────────────────────────────────
  openModal()  { this.showModal = true; }
  closeModal() { this.showModal = false; this.resetForm(); }

  resetForm() {
    this.newGoal = { employeeId: '', title: '', dept: 'Engineering', category: 'Technical', dueDate: '', description: '' };
  }

  submitGoal() {
    const user = this.auth.currentUser();
    if (!user) return;

    // For Manager: employeeId is selected from team dropdown
    // For HR/Admin: employeeId is typed or selected
    const empId   = this.isManager() ? this.newGoal.employeeId : (this.newGoal.employeeId || user.employee_id!);
    const empName = this.isManager()
      ? (this.teamMembers.find(m => m.id === empId)?.fullName ?? empId)
      : this.newGoal.employeeId;

    if (!this.newGoal.title || !empId) return;
    this.saving.set(true);

    this.store.createGoal({
      employeeId:  empId,
      managerId:   user.employee_id!,
      title:       this.newGoal.title,
      description: this.newGoal.description,
      department:  this.newGoal.dept,
      category:    this.newGoal.category,
      dueDate:     this.newGoal.dueDate || null,
    }).subscribe({
      next: () => { this.saving.set(false); this.closeModal(); },
      error: err => { console.error(err); this.saving.set(false); }
    });
  }

  // ── Update Progress Modal ──────────────────────────────────────────────────
  openUpdateModal(goal: AppraisalGoal) {
    this.selectedGoal    = goal;
    this.updatedProgress = goal.progress;
    this.showUpdateModal = true;
  }

  closeUpdateModal() {
    this.showUpdateModal = false;
    this.selectedGoal    = null;
  }

  saveProgress() {
    if (!this.selectedGoal) return;
    const pct = this.updatedProgress;
    const status = pct === 100 ? 'Completed' : pct >= 60 ? 'On Track' : 'At Risk';

    this.store.updateGoal(this.selectedGoal.id, { progress: pct, status }).subscribe({
      next: () => this.closeUpdateModal(),
      error: err => console.error(err)
    });
  }

  exportData() {
    this.exportToast = true;
    setTimeout(() => this.exportToast = false, 3000);
  }
}
