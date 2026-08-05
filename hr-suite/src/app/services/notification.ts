import { Injectable, signal, computed, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../environments/environment';

export type NotifType = 'info' | 'success' | 'warning' | 'error';

export interface AppNotification {
  id: string;
  type: NotifType;
  title: string;
  body: string;
  time: string;   // display string e.g. "2 hours ago"
  read: boolean;
}

const STORAGE_KEY = 'ef_notif_read_ids';

function loadReadIds(): Set<string> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return new Set<string>(JSON.parse(raw));
  } catch { /* ignore */ }
  return new Set<string>();
}

function saveReadIds(ids: Set<string>): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify([...ids]));
  } catch { /* ignore */ }
}

@Injectable({ providedIn: 'root' })
export class NotificationService {
  private http = inject(HttpClient);
  private base = environment.apiUrl;

  private _readIds = loadReadIds();

  // Start empty; populated only from backend
  private _notifications = signal<AppNotification[]>([]);

  readonly notifications = computed(() => this._notifications());

  readonly unreadCount = computed(() =>
    this._notifications().filter(n => !n.read).length
  );

  // ── Load backend notifications for a given role/userId ────────────────────
  loadFromBackend(role: string, userId: string): void {
    if (!role || !userId) return;
    this.http.get<AppNotification[]>(
      `${this.base}/notifications`,
      { params: { role, userId } }
    ).subscribe({
      next: backendNotifs => {
        // Apply local read state to backend notifications
        const withReadState = backendNotifs.map(n => ({
          ...n,
          read: this._readIds.has(n.id) || n.read,
        }));
        this._notifications.set(withReadState);
      },
      error: () => {
        // Backend unavailable — show empty list (no dummy data)
        this._notifications.set([]);
      }
    });
  }

  // ── Push a new dynamic notification (in-memory only, e.g. from pipeline) ──
  push(notif: Omit<AppNotification, 'read'>): void {
    this._notifications.update(list => [{ ...notif, read: false }, ...list]);
  }

  // ── Push a notification to the backend (cross-user, persisted) ────────────
  pushToBackend(notif: { target_role: string; type: string; title: string; body: string }): void {
    this.http.post<AppNotification>(`${this.base}/notifications`, notif).subscribe({
      error: err => console.warn('[NotificationService] pushToBackend failed:', err.message)
    });
  }

  markRead(id: string, userId?: string): void {
    this._readIds.add(id);
    saveReadIds(this._readIds);
    this._notifications.update(list =>
      list.map(n => n.id === id ? { ...n, read: true } : n)
    );
    // Persist to backend for backend-sourced notifications
    if (userId) {
      this.http.patch(`${this.base}/notifications/${id}/read`, { userId }).subscribe();
    }
  }

  markAllRead(userId?: string, role?: string): void {
    this._notifications().forEach(n => this._readIds.add(n.id));
    saveReadIds(this._readIds);
    this._notifications.update(list =>
      list.map(n => ({ ...n, read: true }))
    );
    // Persist to backend
    if (userId && role) {
      this.http.patch(`${this.base}/notifications/read-all`, { userId, role }).subscribe();
    }
  }
}
