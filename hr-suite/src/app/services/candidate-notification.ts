import { Injectable, signal, computed, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../environments/environment';

export type CandidateNotifType = 'interview' | 'status' | 'offer' | 'rejection' | 'info';

export interface CandidateNotification {
  id: string;
  type: CandidateNotifType;
  title: string;
  body: string;
  time: string;
  read: boolean;
  candidateId: string;
}

const STORAGE_KEY = 'ef_candidate_notifs';

function loadNotifs(candidateId: string): CandidateNotification[] {
  try {
    const raw = localStorage.getItem(`${STORAGE_KEY}_${candidateId}`);
    if (raw) return JSON.parse(raw);
  } catch { /* ignore */ }
  return [];
}

function saveNotifs(candidateId: string, notifs: CandidateNotification[]): void {
  try {
    localStorage.setItem(`${STORAGE_KEY}_${candidateId}`, JSON.stringify(notifs));
  } catch { /* ignore */ }
}

@Injectable({ providedIn: 'root' })
export class CandidateNotificationService {
  private http = inject(HttpClient);
  private base = `${environment.apiUrl}/send-email`;

  private _candidateId = '';
  private _notifications = signal<CandidateNotification[]>([]);

  readonly notifications = computed(() => this._notifications());
  readonly unreadCount   = computed(() => this._notifications().filter(n => !n.read).length);

  /** Call once after login to scope notifications to this candidate */
  init(candidateId: string): void {
    this._candidateId = candidateId;
    this._notifications.set(loadNotifs(candidateId));
  }

  /** Push a new in-app notification for the candidate */
  push(notif: Omit<CandidateNotification, 'id' | 'read' | 'candidateId'>): void {
    const n: CandidateNotification = {
      ...notif,
      id: `cn-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      read: false,
      candidateId: this._candidateId,
    };
    this._notifications.update(list => {
      const updated = [n, ...list];
      saveNotifs(this._candidateId, updated);
      return updated;
    });
  }

  markRead(id: string): void {
    this._notifications.update(list => {
      const updated = list.map(n => n.id === id ? { ...n, read: true } : n);
      saveNotifs(this._candidateId, updated);
      return updated;
    });
  }

  markAllRead(): void {
    this._notifications.update(list => {
      const updated = list.map(n => ({ ...n, read: true }));
      saveNotifs(this._candidateId, updated);
      return updated;
    });
  }

  /** Send email via backend (fire-and-forget) */
  sendEmail(to: string, subject: string, html: string): void {
    this.http.post(this.base, { to, subject, html }).subscribe({
      error: err => console.warn('[CandidateNotif] Email send failed:', err.message)
    });
  }
}
