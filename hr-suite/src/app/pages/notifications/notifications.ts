// notifications page
import { Component, inject, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NotificationService, AppNotification } from '../../services/notification';

@Component({
  selector: 'app-notifications',
  imports: [CommonModule],
  templateUrl: './notifications.html',
  styleUrl: './notifications.scss'
})
export class Notifications {
  readonly notif = inject(NotificationService);

  readonly notifications = computed(() => this.notif.notifications());
  readonly unreadCount   = computed(() => this.notif.unreadCount());

  markRead(n: AppNotification): void {
    this.notif.markRead(n.id);
  }

  markAllRead(): void {
    this.notif.markAllRead();
  }

  typeIcon(type: AppNotification['type']): string {
    if (type === 'success') return '✅';
    if (type === 'warning') return '⚠️';
    if (type === 'error')   return '❌';
    return 'ℹ️';
  }

  typeClass(type: AppNotification['type']): string {
    return `notif-type-${type}`;
  }
}
