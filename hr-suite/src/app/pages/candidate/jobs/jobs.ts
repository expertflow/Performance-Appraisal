import { Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../../services/auth';
import { JobStoreService, JobPosting } from '../../../services/job-store';
import { NotificationService } from '../../../services/notification';

@Component({
  selector: 'app-candidate-jobs',
  imports: [CommonModule, FormsModule],
  templateUrl: './jobs.html',
  styleUrl: './jobs.scss'
})
export class CandidateJobs implements OnInit {
  private auth         = inject(AuthService);
  protected jobStore   = inject(JobStoreService);
  private notifService = inject(NotificationService);

  readonly user     = this.auth.currentUser;
  readonly openJobs = this.jobStore.openJobs;

  // ── Filters ───────────────────────────────────────────────────────────────
  searchQuery      = '';
  filterDepartment = '';
  filterType       = '';

  ngOnInit(): void {
    // Load jobs and candidate-specific applications from DB
    this.jobStore.loadJobs();
    const uid = this.user()?.id;
    if (uid) this.jobStore.loadApplications(uid);
  }

  get filteredJobs(): JobPosting[] {
    const q = this.searchQuery.toLowerCase();
    return this.openJobs().filter(j => {
      const matchSearch = !q ||
        j.title.toLowerCase().includes(q) ||
        j.department.toLowerCase().includes(q) ||
        j.location.toLowerCase().includes(q);
      const matchDept = !this.filterDepartment || j.department === this.filterDepartment;
      const matchType = !this.filterType || j.type === this.filterType;
      return matchSearch && matchDept && matchType;
    });
  }

  get departments(): string[] {
    return [...new Set(this.openJobs().map(j => j.department))].sort();
  }

  // ── Apply modal ───────────────────────────────────────────────────────────
  selectedJob: JobPosting | null = null;
  applyForm = {
    coverLetter:  '',
    linkedinUrl:  '',
    githubUrl:    '',
  };
  resumeFile: File | null = null;
  resumeFileName = signal('');
  resumeDataUrl  = signal('');   // base64 data URL stored in DB

  applying     = signal(false);
  applySuccess = signal(false);
  applyError   = signal('');

  openApply(job: JobPosting): void {
    const uid = this.user()?.id ?? '';
    if (this.jobStore.hasApplied(uid, job.id)) {
      this.applyError.set('You have already applied to this position.');
      this.selectedJob = job;
      return;
    }
    this.selectedJob = job;
    this.applyForm   = { coverLetter: '', linkedinUrl: '', githubUrl: '' };
    this.resumeFile  = null;
    this.resumeFileName.set('');
    this.resumeDataUrl.set('');
    this.applySuccess.set(false);
    this.applyError.set('');
  }

  closeApply(): void {
    this.selectedJob = null;
    this.resumeFile  = null;
    this.resumeFileName.set('');
    this.resumeDataUrl.set('');
    this.applySuccess.set(false);
    this.applyError.set('');
  }

  onResumeSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file  = input.files?.[0] ?? null;
    if (!file) return;

    if (file.type !== 'application/pdf') {
      this.applyError.set('Only PDF files are accepted for the resume.');
      input.value = '';
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      this.applyError.set('Resume file must be smaller than 5 MB.');
      input.value = '';
      return;
    }

    this.resumeFile = file;
    this.resumeFileName.set(file.name);
    this.applyError.set('');

    // Convert to base64 so it can be stored in the DB and downloaded later
    const reader = new FileReader();
    reader.onload = () => {
      this.resumeDataUrl.set(reader.result as string);
    };
    reader.readAsDataURL(file);
  }

  submitApplication(): void {
    const u = this.user();
    if (!u || !this.selectedJob) return;

    if (!this.applyForm.coverLetter.trim()) {
      this.applyError.set('Please write a short cover letter.');
      return;
    }
    if (!this.resumeDataUrl()) {
      this.applyError.set('Please attach your resume (PDF, max 5 MB).');
      return;
    }

    this.applying.set(true);
    this.applyError.set('');

    this.jobStore.applyToJob({
      jobId:            this.selectedJob.id,
      jobTitle:         this.selectedJob.title,
      candidateId:      u.id,
      candidateName:    u.name,
      candidateEmail:   u.email,
      candidatePhone:   u.phone   ?? '',
      candidateAddress: u.address ?? '',
      coverLetter:      this.applyForm.coverLetter,
      resumeLink:       this.resumeDataUrl(),
      resumeFileName:   this.resumeFileName(),
      linkedinUrl:      this.applyForm.linkedinUrl,
      githubUrl:        this.applyForm.githubUrl,
    }).subscribe({
      next: () => {
        this.applying.set(false);
        this.applySuccess.set(true);
        // Notify HR about new application
        const job = this.selectedJob;
        const u2  = this.user();
        if (job && u2) {
          this.notifService.push({
            id:    `app-${Date.now()}`,
            type:  'info',
            title: `New Application: ${job.title}`,
            body:  `${u2.name} has applied for ${job.title} via the Careers Portal.`,
            time:  'Just now',
          });
        }
      },
      error: err => {
        this.applying.set(false);
        this.applyError.set(err?.error?.error || 'Failed to submit application. Please try again.');
      }
    });
  }

  hasApplied(jobId: string): boolean {
    return this.jobStore.hasApplied(this.user()?.id ?? '', jobId);
  }

  daysLeft(deadline: string): number {
    const d = new Date(deadline).getTime() - Date.now();
    return Math.max(0, Math.ceil(d / 86400000));
  }
}
