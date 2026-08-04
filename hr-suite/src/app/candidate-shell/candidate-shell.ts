import { Component, inject, signal, OnInit } from '@angular/core';
import { RouterOutlet, RouterLink, RouterLinkActive } from '@angular/router';
import { CommonModule } from '@angular/common';
import { AuthService } from '../services/auth';
import { CandidateNotificationService, CandidateNotification } from '../services/candidate-notification';

@Component({
  selector: 'app-candidate-shell',
  imports: [RouterOutlet, RouterLink, RouterLinkActive, CommonModule],
  templateUrl: './candidate-shell.html',
  styleUrl: './candidate-shell.scss'
})
export class CandidateShell implements OnInit {
  private auth   = inject(AuthService);
  readonly candNotif = inject(CandidateNotificationService);

  readonly user = this.auth.currentUser;

  notifPanelOpen = signal(false);

  get initials(): string {
    const name = this.user()?.name ?? '';
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) || '?';
  }

  ngOnInit(): void {
    const u = this.user();
    if (u?.id) this.candNotif.init(u.id);
  }

  toggleNotifPanel(): void {
    this.notifPanelOpen.update(v => !v);
  }

  closeNotifPanel(): void {
    this.notifPanelOpen.set(false);
  }

  markRead(n: CandidateNotification): void {
    this.candNotif.markRead(n.id);
  }

  markAllRead(): void {
    this.candNotif.markAllRead();
  }

  notifIcon(type: CandidateNotification['type']): string {
    const map: Record<string, string> = {
      interview: '📅',
      status:    '🔄',
      offer:     '🎉',
      rejection: '❌',
      info:      'ℹ️',
    };
    return map[type] ?? 'ℹ️';
  }

  logout(): void {
    this.auth.logout();
  }
}
