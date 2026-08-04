import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../../services/auth';
import { JobStoreService, JobApplication } from '../../../services/job-store';

@Component({
  selector: 'app-my-applications',
  imports: [CommonModule, RouterLink],
  templateUrl: './my-applications.html',
  styleUrl: './my-applications.scss'
})
export class MyApplications implements OnInit {
  private auth     = inject(AuthService);
  private jobStore = inject(JobStoreService);

  readonly user = this.auth.currentUser;

  ngOnInit(): void {
    // Load only this candidate's applications from DB
    const uid = this.user()?.id;
    if (uid) this.jobStore.loadApplications(uid);
  }

  get myApps(): JobApplication[] {
    return this.jobStore.myApplications(this.user()?.id ?? '');
  }

  statusClass(status: JobApplication['status']): string {
    const map: Record<JobApplication['status'], string> = {
      'Submitted':    'status-submitted',
      'Under Review': 'status-review',
      'Shortlisted':  'status-shortlisted',
      'Rejected':     'status-rejected',
      'Hired':        'status-hired',
    };
    return map[status] ?? '';
  }

  countByStatus(status: JobApplication['status']): number {
    return this.myApps.filter(a => a.status === status).length;
  }

  statusIcon(status: JobApplication['status']): string {
    const map: Record<JobApplication['status'], string> = {
      'Submitted':    '📤',
      'Under Review': '🔍',
      'Shortlisted':  '⭐',
      'Rejected':     '❌',
      'Hired':        '🎉',
    };
    return map[status] ?? '📋';
  }
}
