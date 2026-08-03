import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';

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
  imports: [RouterLink],
  templateUrl: './requisitions.html',
  styleUrl: './requisitions.scss'
})
export class Requisitions {
  activeTab = 'All';
  tabs = ['All', 'Open', 'Pending Approval', 'On Hold', 'Closed'];

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
}
