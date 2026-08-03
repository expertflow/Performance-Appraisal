import { Component, inject, computed } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../../services/auth';

interface FeedbackRequest {
  id: string;
  subject: string;
  subjectInitials: string;
  subjectColor: string;
  subjectEmployeeId: string;
  reviewer: string;
  reviewerInitials: string;
  reviewerColor: string;
  reviewerEmployeeId: string;
  managerId: string;
  type: string;
  typeClass: string;
  requestedDate: string;
  dueDate: string;
  status: string;
  statusClass: string;
  cycle: string;
}

@Component({
  selector: 'app-feedback',
  imports: [FormsModule],
  templateUrl: './feedback.html',
  styleUrl: './feedback.scss'
})
export class Feedback {
  private auth = inject(AuthService);

  // ── Role helpers ───────────────────────────────────────────────────────────
  readonly isEmployee     = computed(() => this.auth.isEmployee());
  readonly isManager      = computed(() => this.auth.isManager());
  readonly isHROrAdmin    = computed(() => this.auth.hasRole('AppAdmin', 'HR'));
  readonly canRequestFeedback = computed(() => !this.auth.isEmployee());

  activeTab = 'All';
  tabs = ['All', 'Pending', 'Completed', 'Overdue'];

  // Filter state
  searchText = '';
  filterCycle = '2025 Mid-Year Review';

  // Modal state
  showModal = false;
  exportToast = false;

  newFeedback = {
    subject: '',
    reviewer: '',
    type: 'Peer',
    cycle: '2025 Mid-Year Review',
    dueDate: '',
  };

  // All feedback — in production filtered server-side by role
  allFeedback: FeedbackRequest[] = [
    {
      id: 'FB-2025-089',
      subject: 'Fatima Malik',
      subjectInitials: 'FM',
      subjectColor: 'blue',
      subjectEmployeeId: 'emp-001',
      reviewer: 'Omar Sheikh',
      reviewerInitials: 'OS',
      reviewerColor: 'teal',
      reviewerEmployeeId: 'emp-002',
      managerId: 'emp-mgr',
      type: 'Peer',
      typeClass: 'badge-purple',
      requestedDate: 'Jul 20, 2025',
      dueDate: 'Aug 5, 2025',
      status: 'Pending',
      statusClass: 'badge-orange',
      cycle: '2025 Mid-Year Review',
    },
    {
      id: 'FB-2025-088',
      subject: 'Ahmed Raza',
      subjectInitials: 'AR',
      subjectColor: 'teal',
      subjectEmployeeId: 'emp-004',
      reviewer: 'Zara Hussain',
      reviewerInitials: 'ZH',
      reviewerColor: 'purple',
      reviewerEmployeeId: 'emp-003',
      managerId: 'emp-mgr',
      type: 'Peer',
      typeClass: 'badge-purple',
      requestedDate: 'Jul 18, 2025',
      dueDate: 'Aug 3, 2025',
      status: 'Completed',
      statusClass: 'badge-green',
      cycle: '2025 Mid-Year Review',
    },
    {
      id: 'FB-2025-087',
      subject: 'Zara Hussain',
      subjectInitials: 'ZH',
      subjectColor: 'purple',
      subjectEmployeeId: 'emp-003',
      reviewer: 'Khalid Mahmood',
      reviewerInitials: 'KM',
      reviewerColor: 'orange',
      reviewerEmployeeId: 'emp-005',
      managerId: 'emp-mgr',
      type: 'Peer',
      typeClass: 'badge-purple',
      requestedDate: 'Jul 15, 2025',
      dueDate: 'Jul 30, 2025',
      status: 'Overdue',
      statusClass: 'badge-red',
      cycle: '2025 Mid-Year Review',
    },
    {
      id: 'FB-2025-086',
      subject: 'Omar Sheikh',
      subjectInitials: 'OS',
      subjectColor: 'teal',
      subjectEmployeeId: 'emp-002',
      reviewer: 'Nadia Baig',
      reviewerInitials: 'NB',
      reviewerColor: 'blue',
      reviewerEmployeeId: 'emp-006',
      managerId: 'emp-mgr',
      type: 'Peer',
      typeClass: 'badge-purple',
      requestedDate: 'Jul 14, 2025',
      dueDate: 'Jul 29, 2025',
      status: 'Completed',
      statusClass: 'badge-green',
      cycle: '2025 Mid-Year Review',
    },
    {
      id: 'FB-2025-085',
      subject: 'Fatima Malik',
      subjectInitials: 'FM',
      subjectColor: 'blue',
      subjectEmployeeId: 'emp-001',
      reviewer: 'Ahmed Raza',
      reviewerInitials: 'AR',
      reviewerColor: 'teal',
      reviewerEmployeeId: 'emp-004',
      managerId: 'emp-mgr',
      type: '360°',
      typeClass: 'badge-blue',
      requestedDate: 'Jul 10, 2025',
      dueDate: 'Jul 25, 2025',
      status: 'Completed',
      statusClass: 'badge-green',
      cycle: '2025 Mid-Year Review',
    },
    {
      id: 'FB-2025-084',
      subject: 'Khalid Mahmood',
      subjectInitials: 'KM',
      subjectColor: 'orange',
      subjectEmployeeId: 'emp-005',
      reviewer: 'Fatima Malik',
      reviewerInitials: 'FM',
      reviewerColor: 'blue',
      reviewerEmployeeId: 'emp-001',
      managerId: 'emp-mgr2',
      type: 'Peer',
      typeClass: 'badge-purple',
      requestedDate: 'Jul 8, 2025',
      dueDate: 'Jul 23, 2025',
      status: 'Pending',
      statusClass: 'badge-orange',
      cycle: '2025 Mid-Year Review',
    },
  ];

  /** Feedback scoped to the current user's role */
  get feedbackRequests(): FeedbackRequest[] {
    const user = this.auth.currentUser();
    if (!user) return [];

    if (this.auth.isEmployee()) {
      // Employee sees only feedback where they are the subject or reviewer
      return this.allFeedback.filter(fb =>
        fb.subjectEmployeeId === user.employee_id ||
        fb.reviewerEmployeeId === user.employee_id
      );
    }
    if (this.auth.isManager()) {
      // Manager sees feedback for their direct reports
      return this.allFeedback.filter(fb => fb.managerId === user.employee_id);
    }
    // HR / AppAdmin see all
    return this.allFeedback;
  }

  get stats() {
    const all = this.feedbackRequests;
    return [
      { label: 'Total Requests', value: String(all.length), sub: 'Current cycle' },
      { label: 'Completed', value: String(all.filter(f => f.status === 'Completed').length), sub: 'Response rate' },
      { label: 'Pending', value: String(all.filter(f => f.status === 'Pending').length), sub: 'Awaiting response' },
      { label: 'Overdue', value: String(all.filter(f => f.status === 'Overdue').length), sub: 'Needs follow-up' },
    ];
  }

  setTab(tab: string) { this.activeTab = tab; }

  get filteredFeedback(): FeedbackRequest[] {
    return this.feedbackRequests.filter(fb => {
      const matchTab = this.activeTab === 'All' || fb.status === this.activeTab;
      const matchSearch = !this.searchText ||
        fb.subject.toLowerCase().includes(this.searchText.toLowerCase()) ||
        fb.reviewer.toLowerCase().includes(this.searchText.toLowerCase()) ||
        fb.id.toLowerCase().includes(this.searchText.toLowerCase());
      return matchTab && matchSearch;
    });
  }

  openModal() { this.showModal = true; }
  closeModal() { this.showModal = false; this.resetForm(); }

  resetForm() {
    this.newFeedback = { subject: '', reviewer: '', type: 'Peer', cycle: '2025 Mid-Year Review', dueDate: '' };
  }

  submitFeedback() {
    if (!this.newFeedback.subject || !this.newFeedback.reviewer) return;
    const sInitials = this.newFeedback.subject.split(' ').map((w: string) => w[0]).join('').toUpperCase().slice(0, 2);
    const rInitials = this.newFeedback.reviewer.split(' ').map((w: string) => w[0]).join('').toUpperCase().slice(0, 2);
    const colors = ['blue', 'teal', 'purple', 'orange'];
    const typeClassMap: Record<string, string> = { 'Peer': 'badge-purple', '360°': 'badge-blue', 'Manager': 'badge-orange', 'Self': 'badge-gray' };
    const fmt = (s: string) => {
      if (!s) return 'TBD';
      const d = new Date(s);
      return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    };
    const user = this.auth.currentUser();
    const nextNum = 90 + (this.allFeedback.length - 6);
    this.allFeedback.unshift({
      id: `FB-2025-0${nextNum}`,
      subject: this.newFeedback.subject,
      subjectInitials: sInitials,
      subjectColor: colors[this.allFeedback.length % colors.length],
      subjectEmployeeId: 'emp-new',
      reviewer: this.newFeedback.reviewer,
      reviewerInitials: rInitials,
      reviewerColor: colors[(this.allFeedback.length + 1) % colors.length],
      reviewerEmployeeId: 'emp-new2',
      managerId: user?.employee_id ?? '',
      type: this.newFeedback.type,
      typeClass: typeClassMap[this.newFeedback.type] || 'badge-gray',
      requestedDate: fmt(new Date().toISOString().split('T')[0]),
      dueDate: fmt(this.newFeedback.dueDate),
      status: 'Pending',
      statusClass: 'badge-orange',
      cycle: this.newFeedback.cycle,
    });
    this.closeModal();
  }

  exportData() {
    this.exportToast = true;
    setTimeout(() => this.exportToast = false, 3000);
  }
}
