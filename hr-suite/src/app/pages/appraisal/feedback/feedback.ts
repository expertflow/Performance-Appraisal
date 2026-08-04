import { Component, inject, computed, signal, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { AuthService } from '../../../services/auth';
import { AppraisalStoreService, AppraisalRecord } from '../../../services/appraisal-store';

@Component({
  selector: 'app-feedback',
  imports: [FormsModule, CommonModule],
  templateUrl: './feedback.html',
  styleUrl: './feedback.scss'
})
export class Feedback implements OnInit {
  private auth  = inject(AuthService);
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

  newForm = {
    employeeId:    '',
    employeeName:  '',
    department:    '',
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
      this.store.loadRecords({ employeeId: user.employee_id });
    } else if (this.auth.isManager()) {
      this.store.loadRecords({ managerId: user.employee_id });
      this.store.loadTeam(user.employee_id!);
    } else {
      this.store.loadRecords();
    }
  }

  // ── Data ───────────────────────────────────────────────────────────────────
  get records(): AppraisalRecord[] { return this.store.records(); }

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
        r.id.toLowerCase().includes(this.searchText.toLowerCase());
      return matchTab && matchSearch;
    });
  }

  get teamMembers() { return this.store.team(); }

  setTab(tab: string) { this.activeTab = tab; }

  statusClass(s: string): string { return this.store.statusClass(s); }
  initials(name: string): string { return this.store.initials(name); }
  avatarColor(name: string): string { return this.store.avatarColor(name); }

  // ── Add Appraisal Modal ────────────────────────────────────────────────────
  openModal()  { this.showModal = true; }
  closeModal() { this.showModal = false; this.resetForm(); }

  resetForm() {
    this.newForm = { employeeId: '', employeeName: '', department: '', selfReview: '', managerReview: '', rating: '', goalsMet: 0 };
  }

  onTeamMemberChange() {
    const member = this.teamMembers.find(m => m.id === this.newForm.employeeId);
    if (member) {
      this.newForm.employeeName = member.fullName;
      this.newForm.department   = member.department;
    }
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
    this.store.updateRecord(this.selectedRecord.id, {
      managerReview: this.editForm.managerReview,
      rating:        this.editForm.rating ? Number(this.editForm.rating) : null,
      goalsMet:      this.editForm.goalsMet,
      status:        this.editForm.status,
    }).subscribe({
      next: () => { this.saving.set(false); this.closeEdit(); },
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
