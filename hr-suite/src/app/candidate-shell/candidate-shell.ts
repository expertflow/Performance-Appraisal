import { Component, inject, signal, OnInit, computed } from '@angular/core';
import { RouterOutlet, RouterLink, RouterLinkActive, Router, NavigationEnd } from '@angular/router';
import { CommonModule } from '@angular/common';
import { filter } from 'rxjs/operators';
import { toSignal } from '@angular/core/rxjs-interop';
import { AuthService } from '../services/auth';
import { CandidateNotificationService, CandidateNotification } from '../services/candidate-notification';

@Component({
  selector: 'app-candidate-shell',
  imports: [RouterOutlet, RouterLink, RouterLinkActive, CommonModule],
  templateUrl: './candidate-shell.html',
  styleUrl: './candidate-shell.scss'
})
export class CandidateShell implements OnInit {
  private auth    = inject(AuthService);
  private router  = inject(Router);
  readonly candNotif = inject(CandidateNotificationService);

  readonly user = this.auth.currentUser;

  notifPanelOpen  = signal(false);
  profileMenuOpen = signal(false);

  /** Track current URL reactively */
  private navEnd = toSignal(
    this.router.events.pipe(filter(e => e instanceof NavigationEnd))
  );

  /** Show Home button only when on jobs or my-applications pages */
  readonly showHomeBtn = computed(() => {
    this.navEnd(); // reactive dependency
    const url = this.router.url;
    return url.includes('/candidate/jobs') || url.includes('/candidate/my-applications');
  });

  get initials(): string {
    const name = this.user()?.name ?? '';
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) || '?';
  }

  ngOnInit(): void {
    const u = this.user();
    if (u?.id) this.candNotif.init(u.id);
  }

  toggleNotifPanel(): void {
    this.profileMenuOpen.set(false);
    this.notifPanelOpen.update(v => !v);
  }

  toggleProfileMenu(): void {
    this.notifPanelOpen.set(false);
    this.profileMenuOpen.update(v => !v);
  }

  /** Close all dropdowns when clicking outside */
  closeAll(): void {
    this.notifPanelOpen.set(false);
    this.profileMenuOpen.set(false);
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
