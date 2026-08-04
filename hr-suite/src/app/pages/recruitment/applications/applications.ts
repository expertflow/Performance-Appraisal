import { Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { JobStoreService, JobApplication, ApplicationStatus } from '../../../services/job-store';

@Component({
  selector: 'app-applications',
  imports: [CommonModule, FormsModule],
  templateUrl: './applications.html',
  styleUrl: './applications.scss'
})
export class Applications implements OnInit {
  private jobStore = inject(JobStoreService);

  readonly allApplications = this.jobStore.applications;

  // ── Filters ───────────────────────────────────────────────────────────────
  searchText    = '';
  filterJob     = 'All Jobs';
  filterStatus  = 'All Statuses';

  readonly statuses: ApplicationStatus[] = ['Submitted', 'Under Review', 'Shortlisted', 'Rejected', 'Hired'];

  get jobTitles(): string[] {
    return ['All Jobs', ...new Set(this.allApplications().map(a => a.jobTitle))];
  }

  get filteredApplications(): JobApplication[] {
    const q = this.searchText.toLowerCase();
    return this.allApplications().filter(a => {
      const matchSearch = !q ||
        a.candidateName.toLowerCase().includes(q) ||
        a.candidateEmail.toLowerCase().includes(q) ||
        a.jobTitle.toLowerCase().includes(q);
      const matchJob    = this.filterJob    === 'All Jobs'     || a.jobTitle === this.filterJob;
      const matchStatus = this.filterStatus === 'All Statuses' || a.status   === this.filterStatus;
      return matchSearch && matchJob && matchStatus;
    });
  }

  // ── Stats ─────────────────────────────────────────────────────────────────
  get stats() {
    const apps = this.allApplications();
    return [
      { label: 'Total',        value: apps.length,                                              color: '#0066CC' },
      { label: 'Under Review', value: apps.filter(a => a.status === 'Under Review').length,     color: '#5B21B6' },
      { label: 'Shortlisted',  value: apps.filter(a => a.status === 'Shortlisted').length,      color: '#00A3A3' },
      { label: 'Hired',        value: apps.filter(a => a.status === 'Hired').length,             color: '#059669' },
      { label: 'Rejected',     value: apps.filter(a => a.status === 'Rejected').length,          color: '#DC2626' },
    ];
  }

  // ── Lifecycle ─────────────────────────────────────────────────────────────
  ngOnInit(): void {
    this.jobStore.reloadAllApplications();
  }

  // ── Status update ─────────────────────────────────────────────────────────
  updateStatus(app: JobApplication, status: ApplicationStatus): void {
    this.jobStore.updateApplicationStatus(app.id, status);
  }

  statusClass(status: ApplicationStatus): string {
    const map: Record<ApplicationStatus, string> = {
      'Submitted':    'badge-blue',
      'Under Review': 'badge-orange',
      'Shortlisted':  'badge-purple',
      'Rejected':     'badge-red',
      'Hired':        'badge-green',
    };
    return map[status] ?? '';
  }

  initials(name: string): string {
    return name.split(' ').map(w => w[0] ?? '').join('').toUpperCase().slice(0, 2);
  }

  // ── Toast ─────────────────────────────────────────────────────────────────
  toast = signal('');
  showToast(msg: string): void {
    this.toast.set(msg);
    setTimeout(() => this.toast.set(''), 3000);
  }
}
