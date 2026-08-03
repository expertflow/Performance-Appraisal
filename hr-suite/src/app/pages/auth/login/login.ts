import { Component, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../../services/auth';
import { AppRole } from '../../../models';

@Component({
  selector: 'app-login',
  imports: [FormsModule],
  templateUrl: './login.html',
  styleUrl: './login.scss'
})
export class Login {
  email         = '';
  password      = '';
  keepSignedIn  = false;
  loading       = signal(false);
  error         = signal('');
  showPass      = signal(false);

  constructor(private auth: AuthService, private router: Router) {
    // Already logged in → redirect
    if (this.auth.isLoggedIn()) {
      this.router.navigate(['/dashboard']);
    }
  }

  submit() {
    if (!this.email || !this.password) {
      this.error.set('Please enter your email and password.');
      return;
    }
    this.loading.set(true);
    this.error.set('');
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

  // ── Demo quick-login buttons (remove in production) ───────────────────────
  demoLogin(role: AppRole) {
    this.auth.mockLogin(role);
    this.router.navigate(['/dashboard']);
  }
}
