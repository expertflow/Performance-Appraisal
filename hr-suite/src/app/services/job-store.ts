import { Injectable, signal, computed, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

// ── Data shapes ───────────────────────────────────────────────────────────────

export type JobStatus = 'Open' | 'Closed' | 'Draft';
export type JobType   = 'Full-time' | 'Part-time' | 'Contract' | 'Internship';

export interface JobPosting {
  id: string;
  title: string;
  department: string;
  location: string;
  type: JobType;
  status: JobStatus;
  description: string;
  requirements: string[];
  postedDate: string;
  deadline: string;
}

export type ApplicationStatus = 'Submitted' | 'Under Review' | 'Shortlisted' | 'Rejected' | 'Hired';

export interface JobApplication {
  id: string;
  jobId: string;
  jobTitle: string;
  candidateId: string;       // AppUser.id of the candidate
  candidateName: string;
  candidateEmail: string;
  candidatePhone: string;    // from candidate's account
  candidateAddress: string;  // from candidate's account
  coverLetter: string;
  resumeLink: string;        // base64 data URL of the uploaded PDF
  resumeFileName: string;    // original filename e.g. "john-cv.pdf"
  linkedinUrl: string;       // optional
  githubUrl: string;         // optional
  appliedDate: string;
  status: ApplicationStatus;
}

// ── Service ───────────────────────────────────────────────────────────────────
@Injectable({ providedIn: 'root' })
export class JobStoreService {
  private http     = inject(HttpClient);
  private base     = `${environment.apiUrl}/job-postings`;
  private appsBase = `${environment.apiUrl}/job-applications`;

  private _jobs         = signal<JobPosting[]>([]);
  private _applications = signal<JobApplication[]>([]);
  private _loading      = signal(false);

  readonly jobs         = computed(() => this._jobs());
  readonly applications = computed(() => this._applications());
  readonly loading      = computed(() => this._loading());

  /** Open jobs only (for candidate portal) */
  readonly openJobs = computed(() => this._jobs().filter(j => j.status === 'Open'));

  constructor() {
    this.loadJobs();
    this.loadApplications();
  }

  // ── Load from DB ──────────────────────────────────────────────────────────

  loadJobs(): void {
    this._loading.set(true);
    this.http.get<JobPosting[]>(this.base).subscribe({
      next:  jobs => { this._jobs.set(jobs); this._loading.set(false); },
      error: err  => { console.error('[JobStore] Failed to load job postings:', err.message); this._loading.set(false); }
    });
  }

  loadApplications(candidateId?: string): void {
    let params = new HttpParams();
    if (candidateId) params = params.set('candidate_id', candidateId);
    this.http.get<JobApplication[]>(this.appsBase, { params }).subscribe({
      next:  apps => this._applications.set(apps),
      error: err  => console.error('[JobStore] Failed to load applications:', err.message)
    });
  }

  // ── Queries ───────────────────────────────────────────────────────────────

  /** Applications for a specific candidate */
  myApplications(candidateId: string): JobApplication[] {
    return this._applications().filter(a => a.candidateId === candidateId);
  }

  /** All applications (for HR dashboard) */
  allApplications(): JobApplication[] {
    return this._applications();
  }

  /** Applications for a specific job (for HR) */
  applicationsForJob(jobId: string): JobApplication[] {
    return this._applications().filter(a => a.jobId === jobId);
  }

  /** Has this candidate already applied to this job? */
  hasApplied(candidateId: string, jobId: string): boolean {
    return this._applications().some(a => a.candidateId === candidateId && a.jobId === jobId);
  }

  // ── Mutations ─────────────────────────────────────────────────────────────

  /** Create a new job posting (HR action) — returns Observable */
  createJobPosting(job: Omit<JobPosting, 'id' | 'postedDate'>): Observable<JobPosting> {
    return new Observable(observer => {
      this.http.post<JobPosting>(this.base, job).subscribe({
        next: saved => {
          this._jobs.update(list => [saved, ...list]);
          observer.next(saved);
          observer.complete();
        },
        error: err => observer.error(err)
      });
    });
  }

  /** Update an existing job posting (HR action) */
  updateJobPosting(id: string, changes: Partial<Omit<JobPosting, 'id' | 'postedDate'>>): Observable<JobPosting> {
    return new Observable(observer => {
      this.http.patch<JobPosting>(`${this.base}/${id}`, changes).subscribe({
        next: updated => {
          this._jobs.update(list => list.map(j => j.id === id ? updated : j));
          observer.next(updated);
          observer.complete();
        },
        error: err => observer.error(err)
      });
    });
  }

  /** Delete a job posting (HR action) */
  deleteJobPosting(id: string): Observable<void> {
    return new Observable(observer => {
      this.http.delete<{ deleted: string }>(`${this.base}/${id}`).subscribe({
        next: () => {
          this._jobs.update(list => list.filter(j => j.id !== id));
          observer.next();
          observer.complete();
        },
        error: err => observer.error(err)
      });
    });
  }

  /** Submit a new application — returns Observable so caller can handle errors */
  applyToJob(app: Omit<JobApplication, 'id' | 'appliedDate' | 'status'>): Observable<JobApplication> {
    return new Observable(observer => {
      this.http.post<JobApplication>(this.appsBase, app).subscribe({
        next: saved => {
          this._applications.update(list => [...list, saved]);
          observer.next(saved);
          observer.complete();
        },
        error: err => observer.error(err)
      });
    });
  }

  /** Update application status (HR action) */
  updateApplicationStatus(appId: string, status: ApplicationStatus): void {
    this.http.patch<JobApplication>(`${this.appsBase}/${appId}`, { status }).subscribe({
      next:  updated => this._applications.update(list => list.map(a => a.id === appId ? updated : a)),
      error: err     => console.error('[JobStore] Failed to update status:', err.message)
    });
  }

  /** Reload all applications (HR view — no candidate filter) */
  reloadAllApplications(): void {
    this.http.get<JobApplication[]>(this.appsBase).subscribe({
      next:  apps => this._applications.set(apps),
      error: err  => console.error('[JobStore] Failed to reload applications:', err.message)
    });
  }
}
