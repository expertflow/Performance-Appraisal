import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-recruitment-dashboard',
  imports: [RouterLink, CommonModule],
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.scss'
})
export class RecruitmentDashboard {
  jobTabs = ['All Jobs', 'Active', 'On Hold', 'Closed'];
  activeJobTab = 'All Jobs';

  setJobTab(tab: string) {
    this.activeJobTab = tab;
  }

  stats = [
    { label: 'Open Positions', value: '24', sub: '8 urgent' },
    { label: 'Active Candidates', value: '187', sub: '+12 this week' },
    { label: 'Interviews Today', value: '9', sub: '3 pending confirm' },
    { label: 'Offers Pending', value: '6', sub: '2 expiring soon' },
    { label: 'Hired This Month', value: '11', sub: 'vs 8 last month' },
  ];

  funnelStages = [
    { label: 'Applied', count: 187, color: '#0066CC', pct: 100 },
    { label: 'Screened', count: 94, color: '#5B21B6', pct: 50 },
    { label: 'Technical', count: 41, color: '#00A3A3', pct: 22 },
    { label: 'HR Interview', count: 18, color: '#D97706', pct: 10 },
    { label: 'Offer', count: 6, color: '#059669', pct: 3 },
  ];

  allJobs = [
    {
      title: 'Senior Angular Developer',
      dept: 'Engineering',
      location: 'Lahore · Hybrid',
      type: 'Full-time',
      posted: '3 days ago',
      applicants: 34,
      interviews: 5,
      status: 'Active',
      statusClass: 'badge-green',
    },
    {
      title: 'Product Manager',
      dept: 'Product',
      location: 'Karachi · Remote',
      type: 'Full-time',
      posted: '1 week ago',
      applicants: 28,
      interviews: 3,
      status: 'Active',
      statusClass: 'badge-green',
    },
    {
      title: 'UX Designer',
      dept: 'Design',
      location: 'Islamabad · On-site',
      type: 'Full-time',
      posted: '2 weeks ago',
      applicants: 19,
      interviews: 2,
      status: 'On Hold',
      statusClass: 'badge-orange',
    },
    {
      title: 'DevOps Engineer',
      dept: 'Infrastructure',
      location: 'Lahore · Hybrid',
      type: 'Full-time',
      posted: '5 days ago',
      applicants: 12,
      interviews: 1,
      status: 'Active',
      statusClass: 'badge-green',
    },
    {
      title: 'QA Engineer',
      dept: 'Engineering',
      location: 'Lahore · Remote',
      type: 'Full-time',
      posted: '1 month ago',
      applicants: 8,
      interviews: 0,
      status: 'Closed',
      statusClass: 'badge-gray',
    },
  ];

  get jobs() {
    if (this.activeJobTab === 'All Jobs') return this.allJobs;
    return this.allJobs.filter(j => j.status === this.activeJobTab);
  }
}
