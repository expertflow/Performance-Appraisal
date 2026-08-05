import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { AppNotification } from './notification';
import { environment } from '../../environments/environment';
import { Project, Task, TimeEntry, Employee, ApiResponse, SyncStatus } from '../models';
import { JobPosting, JobApplication, ApplicationStatus } from './job-store';
import { AppUserRecord } from './user-store';

// ── Auth-local shapes ─────────────────────────────────────────────────────────
export interface LocalLoginRequest  { email: string; password: string; }
export interface LocalRegisterRequest {
  firstName: string; lastName: string; email: string;
  phone?: string; address?: string; password: string;
}
export interface LocalAuthResponse  { token: string; user: import('../models').AppUser; }

@Injectable({ providedIn: 'root' })
export class ApiService {
  private base = environment.apiUrl;

  constructor(private http: HttpClient) {}

  // ── Projects ──────────────────────────────────────────────────────────────
  getProjects(): Observable<Project[]> {
    return this.http.get<Project[]>(`${this.base}/projects`);
  }

  getProject(id: string): Observable<Project> {
    return this.http.get<Project>(`${this.base}/projects/${id}`);
  }

  createProject(payload: Partial<Project>): Observable<Project> {
    return this.http.post<Project>(`${this.base}/projects`, payload);
  }

  updateProject(id: string, patch: Partial<Project>): Observable<Project> {
    return this.http.patch<Project>(`${this.base}/projects/${id}`, patch);
  }

  deleteProject(id: string): Observable<{ deleted: string }> {
    return this.http.delete<{ deleted: string }>(`${this.base}/projects/${id}`);
  }

  // ── Tasks ─────────────────────────────────────────────────────────────────
  getTasks(projectId?: string): Observable<Task[]> {
    let params = new HttpParams();
    if (projectId) params = params.set('project_id', projectId);
    return this.http.get<Task[]>(`${this.base}/tasks`, { params });
  }

  getSubtasks(taskId: string): Observable<Task[]> {
    return this.http.get<Task[]>(`${this.base}/tasks/${taskId}/subtasks`);
  }

  // ── Employees (from Directus via backend proxy) ───────────────────────────
  getEmployees(search?: string): Observable<Employee[]> {
    let params = new HttpParams();
    if (search) params = params.set('search', search);
    return this.http.get<Employee[]>(`${this.base}/employees`, { params });
  }

  // ── Time Entries ──────────────────────────────────────────────────────────
  getTimeEntries(filters?: { project_id?: string; employee_id?: string; date_from?: string; date_to?: string }): Observable<TimeEntry[]> {
    let params = new HttpParams();
    if (filters) {
      Object.entries(filters).forEach(([k, v]) => { if (v) params = params.set(k, v); });
    }
    return this.http.get<TimeEntry[]>(`${this.base}/time-entries`, { params });
  }

  createTimeEntry(entry: Omit<TimeEntry, 'id' | 'created_at' | 'updated_at'>): Observable<TimeEntry> {
    return this.http.post<TimeEntry>(`${this.base}/time-entries`, entry);
  }

  updateTimeEntry(id: string, entry: Partial<TimeEntry>): Observable<TimeEntry> {
    return this.http.patch<TimeEntry>(`${this.base}/time-entries/${id}`, entry);
  }

  deleteTimeEntry(id: string): Observable<void> {
    return this.http.delete<void>(`${this.base}/time-entries/${id}`);
  }

  // ── Sync ──────────────────────────────────────────────────────────────────
  getSyncStatus(): Observable<SyncStatus> {
    return this.http.get<SyncStatus>(`${this.base}/sync/status`);
  }

  triggerSync(): Observable<{ message: string }> {
    return this.http.post<{ message: string }>(`${this.base}/sync/trigger`, {});
  }

  syncProjects(): Observable<{ message: string; total: number }> {
    return this.http.post<{ message: string; total: number }>(`${this.base}/projects/sync`, {});
  }

  syncEmployees(): Observable<{ message: string }> {
    return this.http.post<{ message: string }>(`${this.base}/employees/sync`, {});
  }

  // ── Job Postings ──────────────────────────────────────────────────────────
  getJobPostings(status?: string): Observable<JobPosting[]> {
    let params = new HttpParams();
    if (status) params = params.set('status', status);
    return this.http.get<JobPosting[]>(`${this.base}/job-postings`, { params });
  }

  getJobPosting(id: string): Observable<JobPosting> {
    return this.http.get<JobPosting>(`${this.base}/job-postings/${id}`);
  }

  createJobPosting(posting: Omit<JobPosting, 'id' | 'postedDate'>): Observable<JobPosting> {
    return this.http.post<JobPosting>(`${this.base}/job-postings`, posting);
  }

  updateJobPosting(id: string, patch: Partial<JobPosting>): Observable<JobPosting> {
    return this.http.patch<JobPosting>(`${this.base}/job-postings/${id}`, patch);
  }

  deleteJobPosting(id: string): Observable<{ deleted: string }> {
    return this.http.delete<{ deleted: string }>(`${this.base}/job-postings/${id}`);
  }

  // ── Job Applications ──────────────────────────────────────────────────────
  getJobApplications(filters?: { candidate_id?: string; job_id?: string }): Observable<JobApplication[]> {
    let params = new HttpParams();
    if (filters?.candidate_id) params = params.set('candidate_id', filters.candidate_id);
    if (filters?.job_id)       params = params.set('job_id',       filters.job_id);
    return this.http.get<JobApplication[]>(`${this.base}/job-applications`, { params });
  }

  submitJobApplication(app: Omit<JobApplication, 'id' | 'appliedDate' | 'status'>): Observable<JobApplication> {
    return this.http.post<JobApplication>(`${this.base}/job-applications`, app);
  }

  updateApplicationStatus(id: string, status: ApplicationStatus): Observable<JobApplication> {
    return this.http.patch<JobApplication>(`${this.base}/job-applications/${id}`, { status });
  }

  // ── Local Auth ────────────────────────────────────────────────────────────
  localLogin(req: LocalLoginRequest): Observable<LocalAuthResponse> {
    return this.http.post<LocalAuthResponse>(`${this.base}/auth-local/login`, req);
  }

  localRegister(req: LocalRegisterRequest): Observable<LocalAuthResponse> {
    return this.http.post<LocalAuthResponse>(`${this.base}/auth-local/register`, req);
  }

  // ── App Users ─────────────────────────────────────────────────────────────
  getAppUsers(): Observable<AppUserRecord[]> {
    return this.http.get<AppUserRecord[]>(`${this.base}/app-users`);
  }

  updateAppUser(id: string, patch: Partial<AppUserRecord>): Observable<AppUserRecord> {
    return this.http.patch<AppUserRecord>(`${this.base}/app-users/${id}`, patch);
  }

  deleteAppUser(id: string): Observable<{ deleted: string }> {
    return this.http.delete<{ deleted: string }>(`${this.base}/app-users/${id}`);
  }

  // ── App Notifications (backend-persisted, cross-user) ─────────────────────
  getNotifications(role: string, userId: string): Observable<AppNotification[]> {
    const params = new HttpParams().set('role', role).set('userId', userId);
    return this.http.get<AppNotification[]>(`${this.base}/notifications`, { params });
  }

  postNotification(notif: { target_role: string; type: string; title: string; body: string }): Observable<AppNotification> {
    return this.http.post<AppNotification>(`${this.base}/notifications`, notif);
  }

  markNotificationRead(id: string, userId: string): Observable<{ ok: boolean }> {
    return this.http.patch<{ ok: boolean }>(`${this.base}/notifications/${id}/read`, { userId });
  }

  markAllNotificationsRead(userId: string, role: string): Observable<{ ok: boolean }> {
    return this.http.patch<{ ok: boolean }>(`${this.base}/notifications/read-all`, { userId, role });
  }
}
