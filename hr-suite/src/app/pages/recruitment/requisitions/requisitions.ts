import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';

interface Requisition {
  id: string;
  title: string;
  dept: string;
  location: string;
  type: string;
  headcount: number;
  approvalSteps: { label: string; done: boolean }[];
  hiringManager: string;
  hiringManagerInitial: string;
  posted: string;
  status: string;
  statusClass: string;
  priority: string;
  priorityClass: string;
}

@Component({
  selector: 'app-requisitions',
  imports: [RouterLink, FormsModule],
  templateUrl: './requisitions.html',
  styleUrl: './requisitions.scss'
})
export class Requisitions {
  activeTab = 'All';
  tabs = ['All', 'Open', 'Pending Approval', 'On Hold', 'Closed'];

  // Filter state
  searchText = '';
  filterDept = 'All Departments';
  filterLocation = 'All Locations';
  filterPriority = 'All Priorities';

  // Modal state
  showModal = false;
  exportToast = false;

  newReq = {
    title: '',
    dept: 'Engineering',
    location: 'Lahore · Hybrid',
    type: 'Full-time',
    headcount: 1,
    priority: 'Normal',
    hiringManager: '',
  };

  requisitions: Requisition[] = [
    {
      id: 'REQ-2025-041',
      title: 'Senior Angular Developer',
      dept: 'Engineering',
      location: 'Lahore · Hybrid',
      type: 'Full-time',
      headcount: 2,
      approvalSteps: [
        { label: 'HOD', done: true },
        { label: 'HR', done: true },
        { label: 'CFO', done: false },
      ],
      hiringManager: 'Fatima Malik',
      hiringManagerInitial: 'FM',
      posted: 'Jul 28, 2025',
      status: 'Open',
      statusClass: 'badge-green',
      priority: 'Urgent',
      priorityClass: 'badge-red',
    },
    {
      id: 'REQ-2025-040',
      title: 'Product Manager',
      dept: 'Product',
      location: 'Karachi · Remote',
      type: 'Full-time',
      headcount: 1,
      approvalSteps: [
        { label: 'HOD', done: true },
        { label: 'HR', done: true },
        { label: 'CFO', done: true },
      ],
      hiringManager: 'Omar Sheikh',
      hiringManagerInitial: 'OS',
      posted: 'Jul 22, 2025',
      status: 'Open',
      statusClass: 'badge-green',
      priority: 'High',
      priorityClass: 'badge-orange',
    },
    {
      id: 'REQ-2025-039',
      title: 'UX Designer',
      dept: 'Design',
      location: 'Islamabad · On-site',
      type: 'Full-time',
      headcount: 1,
      approvalSteps: [
        { label: 'HOD', done: true },
        { label: 'HR', done: false },
        { label: 'CFO', done: false },
      ],
      hiringManager: 'Zara Hussain',
      hiringManagerInitial: 'ZH',
      posted: 'Jul 18, 2025',
      status: 'Pending Approval',
      statusClass: 'badge-orange',
      priority: 'Normal',
      priorityClass: 'badge-gray',
    },
    {
      id: 'REQ-2025-038',
      title: 'DevOps Engineer',
      dept: 'Infrastructure',
      location: 'Lahore · Hybrid',
      type: 'Full-time',
      headcount: 1,
      approvalSteps: [
        { label: 'HOD', done: true },
        { label: 'HR', done: true },
        { label: 'CFO', done: true },
      ],
      hiringManager: 'Ahmed Raza',
      hiringManagerInitial: 'AR',
      posted: 'Jul 15, 2025',
      status: 'Open',
      statusClass: 'badge-green',
      priority: 'High',
      priorityClass: 'badge-orange',
    },
    {
      id: 'REQ-2025-037',
      title: 'Business Analyst',
      dept: 'Operations',
      location: 'Karachi · Hybrid',
      type: 'Contract',
      headcount: 2,
      approvalSteps: [
        { label: 'HOD', done: true },
        { label: 'HR', done: true },
        { label: 'CFO', done: false },
      ],
      hiringManager: 'Khalid Mahmood',
      hiringManagerInitial: 'KM',
      posted: 'Jul 10, 2025',
      status: 'On Hold',
      statusClass: 'badge-gray',
      priority: 'Normal',
      priorityClass: 'badge-gray',
    },
  ];

  setTab(tab: string) {
    this.activeTab = tab;
  }

  get filteredRequisitions(): Requisition[] {
    return this.requisitions.filter(r => {
      const matchTab = this.activeTab === 'All' || r.status === this.activeTab;
      const matchSearch = !this.searchText ||
        r.title.toLowerCase().includes(this.searchText.toLowerCase()) ||
        r.id.toLowerCase().includes(this.searchText.toLowerCase()) ||
        r.hiringManager.toLowerCase().includes(this.searchText.toLowerCase());
      const matchDept = this.filterDept === 'All Departments' || r.dept === this.filterDept;
      const matchLocation = this.filterLocation === 'All Locations' ||
        r.location.toLowerCase().includes(this.filterLocation.toLowerCase());
      const matchPriority = this.filterPriority === 'All Priorities' || r.priority === this.filterPriority;
      return matchTab && matchSearch && matchDept && matchLocation && matchPriority;
    });
  }

  openModal() { this.showModal = true; }
  closeModal() { this.showModal = false; this.resetForm(); }

  resetForm() {
    this.newReq = { title: '', dept: 'Engineering', location: 'Lahore · Hybrid', type: 'Full-time', headcount: 1, priority: 'Normal', hiringManager: '' };
  }

  submitRequisition() {
    if (!this.newReq.title || !this.newReq.hiringManager) return;
    const initials = this.newReq.hiringManager.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
    const priorityClassMap: Record<string, string> = { Urgent: 'badge-red', High: 'badge-orange', Normal: 'badge-gray' };
    const nextId = `REQ-2025-0${42 + this.requisitions.length - 5}`;
    this.requisitions.unshift({
      id: nextId,
      title: this.newReq.title,
      dept: this.newReq.dept,
      location: this.newReq.location,
      type: this.newReq.type,
      headcount: this.newReq.headcount,
      approvalSteps: [{ label: 'HOD', done: false }, { label: 'HR', done: false }, { label: 'CFO', done: false }],
      hiringManager: this.newReq.hiringManager,
      hiringManagerInitial: initials,
      posted: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
      status: 'Pending Approval',
      statusClass: 'badge-orange',
      priority: this.newReq.priority,
      priorityClass: priorityClassMap[this.newReq.priority] || 'badge-gray',
    });
    this.closeModal();
  }

  exportData() {
    this.exportToast = true;
    setTimeout(() => this.exportToast = false, 3000);
  }
}
