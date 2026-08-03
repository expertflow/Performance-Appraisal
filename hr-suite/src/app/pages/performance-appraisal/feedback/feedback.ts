import { Component } from '@angular/core';
import { FormsModule } from '@angular/forms';

interface FeedbackRequest {
  id: string;
  subject: string;
  subjectInitials: string;
  subjectColor: string;
  reviewer: string;
  reviewerInitials: string;
  reviewerColor: string;
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

  feedbackRequests: FeedbackRequest[] = [
    {
      id: 'FB-2025-089',
      subject: 'Fatima Malik',
      subjectInitials: 'FM',
      subjectColor: 'blue',
      reviewer: 'Omar Sheikh',
      reviewerInitials: 'OS',
      reviewerColor: 'teal',
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
      reviewer: 'Zara Hussain',
      reviewerInitials: 'ZH',
      reviewerColor: 'purple',
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
      reviewer: 'Khalid Mahmood',
      reviewerInitials: 'KM',
      reviewerColor: 'orange',
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
      reviewer: 'Nadia Baig',
      reviewerInitials: 'NB',
      reviewerColor: 'blue',
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
      reviewer: 'Ahmed Raza',
      reviewerInitials: 'AR',
      reviewerColor: 'teal',
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
      reviewer: 'Fatima Malik',
      reviewerInitials: 'FM',
      reviewerColor: 'blue',
      type: 'Peer',
      typeClass: 'badge-purple',
      requestedDate: 'Jul 8, 2025',
      dueDate: 'Jul 23, 2025',
      status: 'Pending',
      statusClass: 'badge-orange',
      cycle: '2025 Mid-Year Review',
    },
  ];

  stats = [
    { label: 'Total Requests', value: '6', sub: 'Current cycle' },
    { label: 'Completed', value: '3', sub: '50% response rate' },
    { label: 'Pending', value: '2', sub: 'Awaiting response' },
    { label: 'Overdue', value: '1', sub: 'Needs follow-up' },
  ];

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
    const nextNum = 90 + (this.feedbackRequests.length - 6);
    this.feedbackRequests.unshift({
      id: `FB-2025-0${nextNum}`,
      subject: this.newFeedback.subject,
      subjectInitials: sInitials,
      subjectColor: colors[this.feedbackRequests.length % colors.length],
      reviewer: this.newFeedback.reviewer,
      reviewerInitials: rInitials,
      reviewerColor: colors[(this.feedbackRequests.length + 1) % colors.length],
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
