import { Component, inject, computed, signal, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { AuthService } from '../../../services/auth';
import { AppraisalStoreService, AppraisalRecord, AppraisalCycle, AppraisalGoal } from '../../../services/appraisal-store';
import { ApiService } from '../../../services/api';

@Component({
  selector: 'app-feedback',
  imports: [FormsModule, CommonModule],
  templateUrl: './feedback.html',
  styleUrl: './feedback.scss'
})
export class Feedback implements OnInit {
  private auth  = inject(AuthService);
  private api   = inject(ApiService);
  readonly store = inject(AppraisalStoreService);

  // ── Role helpers ───────────────────────────────────────────────────────────
  readonly isEmployee     = computed(() => this.auth.isEmployee());
  readonly isManager      = computed(() => this.auth.isManager());
  readonly isHROrAdmin    = computed(() => this.auth.hasRole('AppAdmin', 'HR'));
  readonly canAddAppraisal = computed(() => !this.auth.isEmployee());

  // ── UI state ───────────────────────────────────────────────────────────────
  activeTab   = 'All';
  tabs        = ['All', 'Draft', 'Submitted', 'Acknowledged'];
  searchText  = '';
  exportToast = false;

  showModal   = false;
  showEditModal = false;
  saving      = signal(false);
  selectedRecord: AppraisalRecord | null = null;

  // Goal search for the modal
  goalSearch = '';

  newForm = {
    employeeId:    '',
    employeeName:  '',
    department:    '',
    cycleId:       '',
    goalId:        '',
    selfReview:    '',
    managerReview: '',
    rating:        '' as string | number,
    goalsMet:      0,
  };

  editForm = {
    managerReview: '',
    rating:        '' as string | number,
    goalsMet:      0,
    status:        'draft' as 'draft' | 'submitted' | 'acknowledged',
  };

  ngOnInit(): void {
    const user = this.auth.currentUser();
    if (!user) return;

    if (this.auth.isEmployee()) {
      // Employee sees only their own records
      this.store.loadRecords({ employeeId: user.employee_id });
      // Load goals assigned to this employee
      this.store.loadGoals({ employeeId: user.employee_id });
      // Load cycles (view only)
      this.store.loadCycles();
    } else if (this.auth.isManager()) {
      this.store.loadRecords({ managerId: user.employee_id });
      this.store.loadTeam(user.employee_id!);
      this.store.loadCycles();
      this.store.loadGoals({ managerId: user.employee_id });
    } else {
      // HR / AppAdmin — load all
      this.store.loadRecords();
      this.store.loadAllEmployees();
      this.store.loadCycles();
      this.store.loadGoals();
    }
  }

  // ── Data ───────────────────────────────────────────────────────────────────
  get records(): AppraisalRecord[] { return this.store.records(); }
  get teamMembers() { return this.store.team(); }
  get allEmployees() { return this.store.employees(); }
  get cycles(): AppraisalCycle[] { return this.store.cycles(); }

  // Goals filtered by selected employee in the form
  get filteredGoalsForForm(): AppraisalGoal[] {
    const empId = this.newForm.employeeId;
    const goals = this.store.goals();
    const base = empId ? goals.filter(g => g.employeeId === empId) : goals;
    if (!this.goalSearch) return base;
    const q = this.goalSearch.toLowerCase();
    return base.filter(g => g.title.toLowerCase().includes(q));
  }

  get stats() {
    const all = this.records;
    return [
      { label: 'Total',        value: String(all.length),                                          sub: 'All records' },
      { label: 'Draft',        value: String(all.filter(r => r.status === 'draft').length),        sub: 'In progress' },
      { label: 'Submitted',    value: String(all.filter(r => r.status === 'submitted').length),    sub: 'Awaiting acknowledgement' },
      { label: 'Acknowledged', value: String(all.filter(r => r.status === 'acknowledged').length), sub: 'Completed' },
    ];
  }

  get filteredRecords(): AppraisalRecord[] {
    return this.records.filter(r => {
      const matchTab = this.activeTab === 'All' ||
        (this.activeTab === 'Draft'        && r.status === 'draft') ||
        (this.activeTab === 'Submitted'    && r.status === 'submitted') ||
        (this.activeTab === 'Acknowledged' && r.status === 'acknowledged');
      const matchSearch = !this.searchText ||
        r.employeeName.toLowerCase().includes(this.searchText.toLowerCase()) ||
        r.department.toLowerCase().includes(this.searchText.toLowerCase()) ||
        (r.cycleName ?? '').toLowerCase().includes(this.searchText.toLowerCase());
      return matchTab && matchSearch;
    });
  }

  setTab(tab: string) { this.activeTab = tab; }

  statusClass(s: string): string { return this.store.statusClass(s); }
  initials(name: string): string { return this.store.initials(name); }
  avatarColor(name: string): string { return this.store.avatarColor(name); }

  // ── Add Appraisal Modal ────────────────────────────────────────────────────
  openModal()  { this.showModal = true; }
  closeModal() { this.showModal = false; this.resetForm(); }

  resetForm() {
    this.newForm = {
      employeeId: '', employeeName: '', department: '',
      cycleId: '', goalId: '',
      selfReview: '', managerReview: '', rating: '', goalsMet: 0
    };
    this.goalSearch = '';
  }

  onTeamMemberChange() {
    const member = this.teamMembers.find(m => m.id === this.newForm.employeeId);
    if (member) {
      this.newForm.employeeName = member.fullName;
      this.newForm.department   = member.department;
    }
    this.newForm.goalId = '';
    this.goalSearch = '';
  }

  onEmployeeDropdownChange() {
    const emp = this.allEmployees.find(e => e.id === this.newForm.employeeId);
    if (emp) {
      this.newForm.employeeName = emp.fullName;
      this.newForm.department   = emp.department;
    }
    this.newForm.goalId = '';
    this.goalSearch = '';
  }

  submitAppraisal() {
    const user = this.auth.currentUser();
    if (!user || !this.newForm.employeeId || !this.newForm.employeeName) return;
    this.saving.set(true);

    this.store.createRecord({
      employeeId:    this.newForm.employeeId,
      employeeName:  this.newForm.employeeName,
      managerId:     user.employee_id!,
      department:    this.newForm.department,
      cycleId:       this.newForm.cycleId || undefined,
      selfReview:    this.newForm.selfReview,
      managerReview: this.newForm.managerReview,
      rating:        this.newForm.rating ? Number(this.newForm.rating) : null,
      goalsMet:      this.newForm.goalsMet,
      status:        'draft',
    }).subscribe({
      next: () => { this.saving.set(false); this.closeModal(); },
      error: err => { console.error(err); this.saving.set(false); }
    });
  }

  // ── Edit / Review Modal ────────────────────────────────────────────────────
  openEdit(record: AppraisalRecord) {
    this.selectedRecord = record;
    this.editForm = {
      managerReview: record.managerReview,
      rating:        record.rating ?? '',
      goalsMet:      record.goalsMet,
      status:        record.status,
    };
    this.showEditModal = true;
  }

  closeEdit() { this.showEditModal = false; this.selectedRecord = null; }

  saveEdit() {
    if (!this.selectedRecord) return;
    this.saving.set(true);
    const prevStatus = this.selectedRecord.status;
    const newStatus  = this.editForm.status;

    this.store.updateRecord(this.selectedRecord.id, {
      managerReview: this.editForm.managerReview,
      rating:        this.editForm.rating ? Number(this.editForm.rating) : null,
      goalsMet:      this.editForm.goalsMet,
      status:        newStatus,
    }).subscribe({
      next: () => {
        this.saving.set(false);
        // Send email notification to employee when feedback is submitted
        if (prevStatus !== 'submitted' && newStatus === 'submitted' && this.selectedRecord) {
          const rec = this.selectedRecord;
          // Look up actual email address from employees or team list
          const empEmail =
            this.allEmployees.find(e => e.id === rec.employeeId)?.email ||
            this.teamMembers.find(m => m.id === rec.employeeId)?.email ||
            '';
          if (empEmail) {
            this.api.sendEmail(
              empEmail,
              `Performance Appraisal Feedback — ${rec.cycleName || 'Appraisal'}`,
              `<p>Dear ${rec.employeeName},</p>
               <p>Your manager has submitted a performance appraisal review for you.</p>
               <ul>
                 <li><strong>Rating:</strong> ${this.editForm.rating || 'Not rated'}/5</li>
                 <li><strong>Goals Met:</strong> ${this.editForm.goalsMet}%</li>
                 <li><strong>Comments:</strong> ${this.editForm.managerReview || '—'}</li>
               </ul>
               <p>Please log in to HR Suite to view and acknowledge your appraisal.</p>`
            ).subscribe({ error: () => {} });
          }
        }
        this.closeEdit();
      },
      error: err => { console.error(err); this.saving.set(false); }
    });
  }

  deleteRecord(record: AppraisalRecord) {
    if (!confirm(`Delete appraisal for ${record.employeeName}?`)) return;
    this.store.deleteRecord(record.id).subscribe({
      error: err => console.error(err)
    });
  }

  exportData() {
    this.exportToast = true;
    setTimeout(() => this.exportToast = false, 3000);
  }
}
