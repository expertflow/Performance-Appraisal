import { Injectable, signal, computed } from '@angular/core';

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

/** Load the set of already-read notification IDs from localStorage */
function loadReadIds(): Set<string> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return new Set<string>(JSON.parse(raw));
  } catch { /* ignore */ }
  return new Set<string>();
}

/** Persist the set of read IDs to localStorage */
function saveReadIds(ids: Set<string>): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify([...ids]));
  } catch { /* ignore */ }
}

// ── Static notification catalogue ─────────────────────────────────────────────
const CATALOGUE: Omit<AppNotification, 'read'>[] = [
  {
    id: 'n1',
    type: 'info',
    title: 'Appraisal Cycle Started',
    body: 'Q3 2025 performance review cycle has been opened. Complete your self-assessment by Aug 15.',
    time: '2 hours ago',
  },
  {
    id: 'n2',
    type: 'success',
    title: 'Goal Approved',
    body: 'Your goal "Improve API response time by 30%" has been approved by your manager.',
    time: '5 hours ago',
  },
  {
    id: 'n3',
    type: 'warning',
    title: 'Timesheet Pending',
    body: 'You have 3 time entries from last week that are not yet submitted for review.',
    time: '1 day ago',
  },
  {
    id: 'n4',
    type: 'info',
    title: 'Feedback Request',
    body: 'Sara Ahmed has requested 360° feedback from you. Deadline: Aug 10.',
    time: '1 day ago',
  },
  {
    id: 'n5',
    type: 'success',
    title: 'Project Milestone Reached',
    body: 'EF Internal Tools project has reached the 75% completion milestone.',
    time: '2 days ago',
  },
  {
    id: 'n6',
    type: 'info',
    title: 'New Team Member',
    body: 'Ali Hassan has joined the Engineering team. Welcome them aboard!',
    time: '3 days ago',
  },
  {
    id: 'n7',
    type: 'warning',
    title: 'Leave Request Pending',
    body: 'You have a pending leave request awaiting manager approval.',
    time: '4 days ago',
  },
  {
    id: 'n8',
    type: 'error',
    title: 'Sync Failed',
    body: 'Time entry sync to OTRS failed for 2 entries. Please retry from the Timesheet page.',
    time: '5 days ago',
  },
];

@Injectable({ providedIn: 'root' })
export class NotificationService {

  private _readIds = loadReadIds();

  private _notifications = signal<AppNotification[]>(
    CATALOGUE.map(n => ({ ...n, read: this._readIds.has(n.id) }))
  );

  readonly notifications = computed(() => this._notifications());

  readonly unreadCount = computed(() =>
    this._notifications().filter(n => !n.read).length
  );

  markRead(id: string): void {
    this._readIds.add(id);
    saveReadIds(this._readIds);
    this._notifications.update(list =>
      list.map(n => n.id === id ? { ...n, read: true } : n)
    );
  }

  markAllRead(): void {
    this._notifications().forEach(n => this._readIds.add(n.id));
    saveReadIds(this._readIds);
    this._notifications.update(list =>
      list.map(n => ({ ...n, read: true }))
    );
  }
}
