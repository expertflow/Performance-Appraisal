import { Component, inject, signal, OnInit, computed } from '@angular/core';
import { RouterLink } from '@angular/router';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { JobStoreService, JobPosting, JobApplication, ApplicationStatus, JobType, JobStatus } from '../../../services/job-store';
import { AuthService } from '../../../services/auth';

@Component({
  selector: 'app-recruitment-dashboard',
  imports: [RouterLink, CommonModule, FormsModule],
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.scss'
})
export class RecruitmentDashboard implements OnInit {
  private jobStore = inject(JobStoreService);
  private auth     = inject(AuthService);

  /** Managers can view the recruitment dashboard but cannot create/edit/delete */
  readonly isReadOnly = computed(() => this.auth.role() === 'Manager');

  jobTabs = ['All', 'Open', 'Draft', 'Closed'];
  activeJobTab = 'All';

  ngOnInit(): void {
    this.jobStore.loadJobs();
    this.jobStore.reloadAllApplications();
  }

  // ── Real DB jobs ───────────────────────────────────────────────────────────
  readonly allDbJobs = this.jobStore.jobs;

  get filteredJobs(): JobPosting[] {
    const jobs = this.allDbJobs();
    if (this.activeJobTab === 'All') return jobs;
    return jobs.filter(j => j.status === this.activeJobTab);
  }

  setJobTab(tab: string) {
    this.activeJobTab = tab;
  }

  jobStatusClass(status: JobStatus): string {
    const map: Record<JobStatus, string> = {
      'Open':   'badge-green',
      'Draft':  'badge-orange',
      'Closed': 'badge-gray',
    };
    return map[status] ?? '';
  }

  daysLeft(deadline: string): number {
    if (!deadline) return 0;
    return Math.max(0, Math.ceil((new Date(deadline).getTime() - Date.now()) / 86400000));
  }

  // ── Post Job Modal ─────────────────────────────────────────────────────────
  showPostJobModal = signal(false);
  postJobSaving    = signal(false);
  postJobError     = signal('');
  postJobSuccess   = signal(false);

  postJobForm = {
    title:        '',
    department:   '',
    location:     '',
    type:         'Full-time' as JobType,
    status:       'Open' as JobStatus,
    description:  '',
    requirementsRaw: '',
    deadline:     '',
    autoShortlistThreshold: 0,
  };

  openPostJobModal(): void {
    this.postJobForm = {
      title: '', department: '', location: '',
      type: 'Full-time', status: 'Open',
      description: '', requirementsRaw: '', deadline: '',
      autoShortlistThreshold: 0,
    };
    this.postJobError.set('');
    this.postJobSuccess.set(false);
    this.showPostJobModal.set(true);
  }

  closePostJobModal(): void {
    this.showPostJobModal.set(false);
  }

  submitPostJob(): void {
    const f = this.postJobForm;
    if (!f.title.trim() || !f.department.trim() || !f.location.trim() || !f.type) {
      this.postJobError.set('Title, Department, Location and Type are required.');
      return;
    }
    const requirements = f.requirementsRaw
      .split(/[\n,]+/)
      .map(r => r.trim())
      .filter(r => r.length > 0);

    this.postJobSaving.set(true);
    this.postJobError.set('');

    this.jobStore.createJobPosting({
      title:        f.title.trim(),
      department:   f.department.trim(),
      location:     f.location.trim(),
      type:         f.type,
      status:       f.status,
      description:  f.description.trim(),
      requirements,
      deadline:     f.deadline || '',
      autoShortlistThreshold: f.autoShortlistThreshold ?? 0,
    }).subscribe({
      next: () => {
        this.postJobSaving.set(false);
        this.postJobSuccess.set(true);
        setTimeout(() => this.closePostJobModal(), 1200);
      },
      error: err => {
        this.postJobSaving.set(false);
        this.postJobError.set(err?.error?.error || 'Failed to post job. Please try again.');
      }
    });
  }

  // ── Edit Job Modal ─────────────────────────────────────────────────────────
  showEditJobModal = signal(false);
  editJobSaving    = signal(false);
  editJobError     = signal('');
  editJobSuccess   = signal(false);
  editingJobId     = '';

  editJobForm = {
    title:           '',
    department:      '',
    location:        '',
    type:            'Full-time' as JobType,
    status:          'Open' as JobStatus,
    description:     '',
    requirementsRaw: '',
    deadline:        '',
    autoShortlistThreshold: 0,
  };

  openEditJobModal(job: JobPosting, event: Event): void {
    event.stopPropagation();
    this.editingJobId = job.id;
    this.editJobForm = {
      title:           job.title,
      department:      job.department,
      location:        job.location,
      type:            job.type,
      status:          job.status,
      description:     job.description,
      requirementsRaw: job.requirements.join('\n'),
      deadline:        job.deadline || '',
      autoShortlistThreshold: job.autoShortlistThreshold ?? 0,
    };
    this.editJobError.set('');
    this.editJobSuccess.set(false);
    this.showEditJobModal.set(true);
  }

  closeEditJobModal(): void {
    this.showEditJobModal.set(false);
  }

  saveEditJob(): void {
    const f = this.editJobForm;
    if (!f.title.trim() || !f.department.trim() || !f.location.trim()) {
      this.editJobError.set('Title, Department and Location are required.');
      return;
    }
    const requirements = f.requirementsRaw
      .split(/[\n,]+/)
      .map(r => r.trim())
      .filter(r => r.length > 0);

    this.editJobSaving.set(true);
    this.editJobError.set('');

    this.jobStore.updateJobPosting(this.editingJobId, {
      title:        f.title.trim(),
      department:   f.department.trim(),
      location:     f.location.trim(),
      type:         f.type,
      status:       f.status,
      description:  f.description.trim(),
      requirements,
      deadline:     f.deadline || '',
      autoShortlistThreshold: f.autoShortlistThreshold ?? 0,
    }).subscribe({
      next: () => {
        this.editJobSaving.set(false);
        this.editJobSuccess.set(true);
        setTimeout(() => this.closeEditJobModal(), 1200);
      },
      error: err => {
        this.editJobSaving.set(false);
        this.editJobError.set(err?.error?.error || 'Failed to update job. Please try again.');
      }
    });
  }

  // ── Requirements Popup ─────────────────────────────────────────────────────
  requirementsJobId = signal<string | null>(null);

  toggleRequirements(job: JobPosting, event: Event): void {
    event.stopPropagation();
    this.requirementsJobId.update(id => id === job.id ? null : job.id);
  }

  closeRequirements(): void {
    this.requirementsJobId.set(null);
  }

  // ── Delete Job ─────────────────────────────────────────────────────────────
  deleteJob(job: JobPosting, event: Event): void {
    event.stopPropagation();
    if (!confirm(`Delete "${job.title}"? This cannot be undone.`)) return;
    this.jobStore.deleteJobPosting(job.id).subscribe({
      error: err => alert('Failed to delete: ' + (err?.error?.error || err.message))
    });
  }

  // ── Stats ──────────────────────────────────────────────────────────────────
  readonly allApplications = this.jobStore.applications;

  get stats() {
    const jobs = this.allDbJobs();
    const apps = this.allApplications();
    return [
      { label: 'Open Positions',     value: String(jobs.filter(j => j.status === 'Open').length),                    sub: 'from database' },
      { label: 'Total Applications', value: String(apps.length),                                                      sub: 'all time' },
      { label: 'Shortlisted',        value: String(apps.filter(a => a.status === 'Shortlisted').length),              sub: 'candidates' },
      { label: 'Hired',              value: String(apps.filter(a => a.status === 'Hired').length),                    sub: 'this cycle' },
      { label: 'Rejected',           value: String(apps.filter(a => a.status === 'Rejected').length),                 sub: 'candidates' },
    ];
  }

  get funnelData() {
    const apps = this.allApplications();
    const total = apps.length || 1;
    return [
      { label: 'Applied',      count: apps.length,                                              color: '#0066CC', pct: 100 },
      { label: 'Under Review', count: apps.filter(a => a.status === 'Under Review').length,     color: '#5B21B6', pct: Math.round(apps.filter(a => a.status === 'Under Review').length / total * 100) },
      { label: 'Shortlisted',  count: apps.filter(a => a.status === 'Shortlisted').length,      color: '#00A3A3', pct: Math.round(apps.filter(a => a.status === 'Shortlisted').length / total * 100) },
      { label: 'Hired',        count: apps.filter(a => a.status === 'Hired').length,             color: '#059669', pct: Math.round(apps.filter(a => a.status === 'Hired').length / total * 100) },
    ];
  }
}
