import { Injectable, signal, computed, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

// ── Data shapes ───────────────────────────────────────────────────────────────

export interface AppraisalCycle {
  id:          string;
  name:        string;
  type:        string;
  period_start: string | null;
  period_end:   string | null;
  review_start: string | null;
  review_end:   string | null;
  phase:       string;
  created_at:  string;
}

export interface AppraisalRecord {
  id:            string;
  cycleId:       string;
  cycleName:     string;
  employeeId:    string;
  employeeName:  string;
  managerId:     string;
  department:    string;
  rating:        number | null;
  selfReview:    string;
  managerReview: string;
  goalsMet:      number;
  status:        'draft' | 'submitted' | 'acknowledged';
  createdAt:     string;
  updatedAt:     string;
}

export interface AppraisalGoal {
  id:          string;
  recordId:    string | null;
  employeeId:  string;
  managerId:   string;
  title:       string;
  description: string;
  department:  string;
  category:    string;
  progress:    number;
  dueDate:     string | null;
  status:      string;
  createdAt:   string;
  updatedAt:   string;
}

export interface TeamMember {
  id:         string;
  firstName:  string;
  lastName:   string;
  fullName:   string;
  email:      string;
  department: string;
  jobTitle:   string;
  managerId:  string;
}

// ── Service ───────────────────────────────────────────────────────────────────

@Injectable({ providedIn: 'root' })
export class AppraisalStoreService {
  private http = inject(HttpClient);
  private base = `${environment.apiUrl}/appraisals`;

  // ── Signals ───────────────────────────────────────────────────────────────
  private _cycles    = signal<AppraisalCycle[]>([]);
  private _records   = signal<AppraisalRecord[]>([]);
  private _goals     = signal<AppraisalGoal[]>([]);
  private _team      = signal<TeamMember[]>([]);
  private _loading   = signal(false);

  readonly cycles  = computed(() => this._cycles());
  readonly records = computed(() => this._records());
  readonly goals   = computed(() => this._goals());
  readonly team    = computed(() => this._team());
  readonly loading = computed(() => this._loading());

  // ── Cycles ────────────────────────────────────────────────────────────────

  loadCycles(): void {
    this.http.get<AppraisalCycle[]>(`${this.base}/cycles`).subscribe({
      next: data => this._cycles.set(data),
      error: err => console.error('[AppraisalStore] loadCycles:', err.message)
    });
  }

  createCycle(payload: Partial<AppraisalCycle>): Observable<AppraisalCycle> {
    return new Observable(obs => {
      this.http.post<AppraisalCycle>(`${this.base}/cycles`, payload).subscribe({
        next: c => { this._cycles.update(list => [c, ...list]); obs.next(c); obs.complete(); },
        error: err => obs.error(err)
      });
    });
  }

  // ── Records ───────────────────────────────────────────────────────────────

  loadRecords(filters: { managerId?: string; employeeId?: string; cycleId?: string } = {}): void {
    this._loading.set(true);
    let params = new HttpParams();
    if (filters.managerId)  params = params.set('managerId',  filters.managerId);
    if (filters.employeeId) params = params.set('employeeId', filters.employeeId);
    if (filters.cycleId)    params = params.set('cycleId',    filters.cycleId);

    this.http.get<AppraisalRecord[]>(`${this.base}/records`, { params }).subscribe({
      next: data => { this._records.set(data); this._loading.set(false); },
      error: err => { console.error('[AppraisalStore] loadRecords:', err.message); this._loading.set(false); }
    });
  }

  createRecord(payload: Partial<AppraisalRecord>): Observable<AppraisalRecord> {
    return new Observable(obs => {
      this.http.post<AppraisalRecord>(`${this.base}/records`, payload).subscribe({
        next: r => { this._records.update(list => [r, ...list]); obs.next(r); obs.complete(); },
        error: err => obs.error(err)
      });
    });
  }

  updateRecord(id: string, patch: Partial<AppraisalRecord>): Observable<AppraisalRecord> {
    return new Observable(obs => {
      this.http.patch<AppraisalRecord>(`${this.base}/records/${id}`, patch).subscribe({
        next: r => { this._records.update(list => list.map(x => x.id === id ? r : x)); obs.next(r); obs.complete(); },
        error: err => obs.error(err)
      });
    });
  }

  deleteRecord(id: string): Observable<void> {
    return new Observable(obs => {
      this.http.delete(`${this.base}/records/${id}`).subscribe({
        next: () => { this._records.update(list => list.filter(x => x.id !== id)); obs.next(); obs.complete(); },
        error: err => obs.error(err)
      });
    });
  }

  // ── Goals ─────────────────────────────────────────────────────────────────

  loadGoals(filters: { managerId?: string; employeeId?: string } = {}): void {
    let params = new HttpParams();
    if (filters.managerId)  params = params.set('managerId',  filters.managerId);
    if (filters.employeeId) params = params.set('employeeId', filters.employeeId);

    this.http.get<AppraisalGoal[]>(`${this.base}/goals`, { params }).subscribe({
      next: data => this._goals.set(data),
      error: err => console.error('[AppraisalStore] loadGoals:', err.message)
    });
  }

  createGoal(payload: Partial<AppraisalGoal>): Observable<AppraisalGoal> {
    return new Observable(obs => {
      this.http.post<AppraisalGoal>(`${this.base}/goals`, payload).subscribe({
        next: g => { this._goals.update(list => [g, ...list]); obs.next(g); obs.complete(); },
        error: err => obs.error(err)
      });
    });
  }

  updateGoal(id: string, patch: Partial<AppraisalGoal>): Observable<AppraisalGoal> {
    return new Observable(obs => {
      this.http.patch<AppraisalGoal>(`${this.base}/goals/${id}`, patch).subscribe({
        next: g => { this._goals.update(list => list.map(x => x.id === id ? g : x)); obs.next(g); obs.complete(); },
        error: err => obs.error(err)
      });
    });
  }

  deleteGoal(id: string): Observable<void> {
    return new Observable(obs => {
      this.http.delete(`${this.base}/goals/${id}`).subscribe({
        next: () => { this._goals.update(list => list.filter(x => x.id !== id)); obs.next(); obs.complete(); },
        error: err => obs.error(err)
      });
    });
  }

  // ── Team members (Manager's direct reports from BS4) ─────────────────────

  loadTeam(managerId: string): void {
    this.http.get<TeamMember[]>(`${this.base}/team`, { params: { managerId } }).subscribe({
      next: data => this._team.set(data),
      error: err => console.error('[AppraisalStore] loadTeam:', err.message)
    });
  }

  // ── Helpers ───────────────────────────────────────────────────────────────

  statusClass(status: string): string {
    return {
      draft:        'badge-gray',
      submitted:    'badge-blue',
      acknowledged: 'badge-green',
    }[status] ?? 'badge-gray';
  }

  goalStatusClass(status: string): string {
    return {
      'On Track':  'badge-green',
      'At Risk':   'badge-orange',
      'Overdue':   'badge-red',
      'Completed': 'badge-teal',
    }[status] ?? 'badge-gray';
  }

  initials(name: string): string {
    return name.split(' ').map(w => w[0] ?? '').join('').toUpperCase().slice(0, 2);
  }

  avatarColor(name: string): string {
    const colors = ['blue', 'teal', 'purple', 'orange'];
    let hash = 0;
    for (const c of name) hash = (hash * 31 + c.charCodeAt(0)) & 0xffff;
    return colors[hash % colors.length];
  }
}
