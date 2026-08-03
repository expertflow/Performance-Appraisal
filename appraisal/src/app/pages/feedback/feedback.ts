import { Component } from '@angular/core';

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
  imports: [],
  templateUrl: './feedback.html',
  styleUrl: './feedback.scss'
})
export class Feedback {
  activeTab = 'All';
  tabs = ['All', 'Pending', 'Completed', 'Overdue'];

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
}
