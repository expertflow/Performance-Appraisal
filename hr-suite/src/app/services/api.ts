import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { Project, Task, TimeEntry, Employee, ApiResponse, SyncStatus } from '../models';

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
}
