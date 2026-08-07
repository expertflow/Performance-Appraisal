import { Component, OnInit, inject } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { AuthService } from '../../../services/auth';
import { AppUser } from '../../../models';

/**
 * Landing page for Google OAuth redirect.
 *
 * The backend redirects here after a successful Google login:
 *   /auth/google-callback?token=<jwt>&user=<json>
 *
 * This component reads those query params, stores the session via
 * AuthService.mockLoginWithUser(), then navigates to /dashboard.
 */
@Component({
  selector: 'app-google-callback',
  standalone: true,
  template: `
    <div style="display:flex;align-items:center;justify-content:center;height:100vh;
                background:var(--color-bg,#f8fafc);flex-direction:column;gap:16px;">
      <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#6366f1"
           stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83
                 M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/>
      </svg>
      <p style="font-size:15px;color:#6b7280;font-family:sans-serif;">
        {{ message }}
      </p>
    </div>
  `,
})
export class GoogleCallback implements OnInit {
  private route  = inject(ActivatedRoute);
  private router = inject(Router);
  private auth   = inject(AuthService);

  message = 'Signing you in with Google…';

  ngOnInit(): void {
    const params = this.route.snapshot.queryParamMap;
    const token  = params.get('token');
    const userRaw = params.get('user');
    const error  = params.get('error');

    if (error) {
      const msgs: Record<string, string> = {
        google_denied:         'Google sign-in was cancelled.',
        google_failed:         'Google sign-in failed. Please try again.',
        google_not_configured: 'Google login is not yet configured.',
      };
      this.message = msgs[error] || 'Sign-in failed. Please try again.';
      setTimeout(() => this.router.navigate(['/login'], { replaceUrl: true }), 2500);
      return;
    }

    if (!token || !userRaw) {
      this.message = 'Invalid callback. Redirecting to login…';
      setTimeout(() => this.router.navigate(['/login'], { replaceUrl: true }), 1500);
      return;
    }

    try {
      const user: AppUser = JSON.parse(decodeURIComponent(userRaw));
      this.auth.mockLoginWithUser(user, token);

      if (user.role === 'Candidate') {
        this.router.navigate(['/candidate/home'], { replaceUrl: true });
      } else {
        this.router.navigate(['/dashboard'], { replaceUrl: true });
      }
    } catch {
      this.message = 'Failed to parse login data. Redirecting…';
      setTimeout(() => this.router.navigate(['/login'], { replaceUrl: true }), 1500);
    }
  }
}
