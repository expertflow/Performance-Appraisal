import { Component, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../../services/auth';
import { AppUser } from '../../../models';

// ── Hardcoded accounts (replace with real API when backend is ready) ──────────
const LOCAL_ACCOUNTS: Array<{ email: string; password: string; user: AppUser; token: string }> = [
  {
    email: 'zaeem.ahmad@expertflow.com',
    password: '12345',
    token: 'local-token-appadmin',
    user: {
      id: 'u-zaeem',
      email: 'zaeem.ahmad@expertflow.com',
      name: 'Zaeem Ahmad',
      role: 'AppAdmin',
      employee_id: 'emp-zaeem',
    }
  }
];

@Component({
  selector: 'app-login',
  imports: [FormsModule],
  templateUrl: './login.html',
  styleUrl: './login.scss'
})
export class Login {
  email        = '';
  password     = '';
  keepSignedIn = false;
  loading      = signal(false);
  error        = signal('');
  showPass     = signal(false);

  constructor(private auth: AuthService, private router: Router) {
    if (this.auth.isLoggedIn()) {
      // Replace login in history so back button doesn't return here when already logged in
      this.router.navigate(['/dashboard'], { replaceUrl: true });
    }
  }

  submit() {
    if (!this.email || !this.password) {
      this.error.set('Please enter your email and password.');
      return;
    }

    this.loading.set(true);
    this.error.set('');

    // ── Check local accounts first ─────────────────────────────────────────
    const match = LOCAL_ACCOUNTS.find(
      a => a.email.toLowerCase() === this.email.toLowerCase() && a.password === this.password
    );

    if (match) {
      // Simulate a successful login without a backend
      this.auth.mockLoginWithUser(match.user, match.token);
      this.loading.set(false);
      this.router.navigate(['/dashboard']);
      return;
    }

    // ── Validate @expertflow.com domain ───────────────────────────────────
    if (!this.email.toLowerCase().endsWith('@expertflow.com')) {
      this.loading.set(false);
      this.error.set('Access restricted to ExpertFlow personnel only. Please use your @expertflow.com account.');
      return;
    }

    // ── Try real backend ───────────────────────────────────────────────────
    this.auth.login({ email: this.email, password: this.password }).subscribe({
      next: () => {
        this.loading.set(false);
        this.router.navigate(['/dashboard']);
      },
      error: (err) => {
        this.loading.set(false);
        this.error.set(err?.error?.message || 'Invalid email or password.');
      }
    });
  }

  googleSignIn() {
    // Placeholder — wire to real Google OAuth when backend is ready
    this.error.set('Google SSO is not yet configured. Please sign in with your email and password.');
  }
}
