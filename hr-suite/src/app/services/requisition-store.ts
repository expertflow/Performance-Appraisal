import { Injectable, signal, computed, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

// ── Data shapes ───────────────────────────────────────────────────────────────

export type ReqStatus   = 'Pending Approval' | 'Open' | 'On Hold' | 'Closed';
export type ReqPriority = 'Urgent' | 'High' | 'Normal';
export type ReqType     = 'Full-time' | 'Part-time' | 'Contract' | 'Internship';

export interface JobRequisition {
  id:            string;
  reqNumber:     string;
  title:         string;
  department:    string;
  location:      string;
  type:          ReqType;
  headcount:     number;
  priority:      ReqPriority;
  status:        ReqStatus;
  hiringManager: string;
  approvalHod:   boolean;
  approvalHr:    boolean;
  approvalCfo:   boolean;
  postedDate:    string;
  notes:         string;
}

export interface RequisitionPage {
  total: number;
  page:  number;
  limit: number;
  data:  JobRequisition[];
}

// ── Service ───────────────────────────────────────────────────────────────────
@Injectable({ providedIn: 'root' })
export class RequisitionStoreService {
  private http = inject(HttpClient);
  private base = `${environment.apiUrl}/job-requisitions`;

  private _requisitions = signal<JobRequisition[]>([]);
  private _total        = signal(0);
  private _loading      = signal(false);

  readonly requisitions = computed(() => this._requisitions());
  readonly total        = computed(() => this._total());
  readonly loading      = computed(() => this._loading());

  // ── Load ──────────────────────────────────────────────────────────────────

  load(page = 1, limit = 10, status?: string): void {
    this._loading.set(true);
    let params = new HttpParams()
      .set('page', String(page))
      .set('limit', String(limit));
    if (status) params = params.set('status', status);

    this.http.get<RequisitionPage>(this.base, { params }).subscribe({
      next: res => {
        this._requisitions.set(res.data);
        this._total.set(res.total);
        this._loading.set(false);
      },
      error: err => {
        console.error('[ReqStore] load failed:', err.message);
        this._loading.set(false);
      }
    });
  }

  // ── Create ────────────────────────────────────────────────────────────────

  create(req: Omit<JobRequisition, 'id' | 'reqNumber' | 'approvalHod' | 'approvalHr' | 'approvalCfo' | 'postedDate'>): Observable<JobRequisition> {
    return new Observable(observer => {
      this.http.post<JobRequisition>(this.base, req).subscribe({
        next: saved => {
          this._requisitions.update(list => [saved, ...list]);
          this._total.update(t => t + 1);
          observer.next(saved);
          observer.complete();
        },
        error: err => observer.error(err)
      });
    });
  }

  // ── Update ────────────────────────────────────────────────────────────────

  update(id: string, patch: Partial<JobRequisition>): Observable<JobRequisition> {
    return new Observable(observer => {
      this.http.patch<JobRequisition>(`${this.base}/${id}`, patch).subscribe({
        next: updated => {
          this._requisitions.update(list => list.map(r => r.id === id ? updated : r));
          observer.next(updated);
          observer.complete();
        },
        error: err => observer.error(err)
      });
    });
  }

  // ── Delete ────────────────────────────────────────────────────────────────

  delete(id: string): Observable<{ deleted: string }> {
    return new Observable(observer => {
      this.http.delete<{ deleted: string }>(`${this.base}/${id}`).subscribe({
        next: res => {
          this._requisitions.update(list => list.filter(r => r.id !== id));
          this._total.update(t => Math.max(0, t - 1));
          observer.next(res);
          observer.complete();
        },
        error: err => observer.error(err)
      });
    });
  }

  // ── Helpers ───────────────────────────────────────────────────────────────

  priorityClass(p: ReqPriority): string {
    return { Urgent: 'badge-red', High: 'badge-orange', Normal: 'badge-gray' }[p] ?? 'badge-gray';
  }

  statusClass(s: ReqStatus): string {
    return {
      'Open':             'badge-green',
      'Pending Approval': 'badge-orange',
      'On Hold':          'badge-gray',
      'Closed':           'badge-red',
    }[s] ?? 'badge-gray';
  }

  initials(name: string): string {
    return name.split(' ').map(w => w[0] ?? '').join('').toUpperCase().slice(0, 2);
  }
}
