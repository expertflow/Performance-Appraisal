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

@Injectable({ providedIn: 'root' })
export class NotificationService {
  private _notifications = signal<AppNotification[]>([
    {
      id: 'n1',
      type: 'info',
      title: 'Appraisal Cycle Started',
      body: 'Q3 2025 performance review cycle has been opened. Complete your self-assessment by Aug 15.',
      time: '2 hours ago',
      read: false,
    },
    {
      id: 'n2',
      type: 'success',
      title: 'Goal Approved',
      body: 'Your goal "Improve API response time by 30%" has been approved by your manager.',
      time: '5 hours ago',
      read: false,
    },
    {
      id: 'n3',
      type: 'warning',
      title: 'Timesheet Pending',
      body: 'You have 3 time entries from last week that are not yet submitted for review.',
      time: '1 day ago',
      read: false,
    },
    {
      id: 'n4',
      type: 'info',
      title: 'Feedback Request',
      body: 'Sara Ahmed has requested 360° feedback from you. Deadline: Aug 10.',
      time: '1 day ago',
      read: false,
    },
    {
      id: 'n5',
      type: 'success',
      title: 'Project Milestone Reached',
      body: 'EF Internal Tools project has reached the 75% completion milestone.',
      time: '2 days ago',
      read: true,
    },
    {
      id: 'n6',
      type: 'info',
      title: 'New Team Member',
      body: 'Ali Hassan has joined the Engineering team. Welcome them aboard!',
      time: '3 days ago',
      read: true,
    },
    {
      id: 'n7',
      type: 'warning',
      title: 'Leave Request Pending',
      body: 'You have a pending leave request awaiting manager approval.',
      time: '4 days ago',
      read: true,
    },
    {
      id: 'n8',
      type: 'error',
      title: 'Sync Failed',
      body: 'Time entry sync to OTRS failed for 2 entries. Please retry from the Timesheet page.',
      time: '5 days ago',
      read: true,
    },
  ]);

  readonly notifications = computed(() => this._notifications());

  readonly unreadCount = computed(() =>
    this._notifications().filter(n => !n.read).length
  );

  markRead(id: string): void {
    this._notifications.update(list =>
      list.map(n => n.id === id ? { ...n, read: true } : n)
    );
  }

  markAllRead(): void {
    this._notifications.update(list =>
      list.map(n => ({ ...n, read: true }))
    );
  }
}
