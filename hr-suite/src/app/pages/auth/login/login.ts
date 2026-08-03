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
  // ── Sign-in fields ──────────────────────────────────────────────────────────
  email        = '';
  password     = '';
  keepSignedIn = false;
  loading      = signal(false);
  error        = signal('');
  showPass     = signal(false);

  // ── View toggle ─────────────────────────────────────────────────────────────
  showRegister = signal(false);
  registerSuccess = signal(false);

  // ── Registration fields ─────────────────────────────────────────────────────
  reg = {
    firstName:       '',
    lastName:        '',
    email:           '',
    phone:           '',
    address:         '',
    password:        '',
    confirmPassword: '',
  };
  regShowPass    = signal(false);
  regShowConfirm = signal(false);
  regError       = signal('');
  regLoading     = signal(false);

  constructor(private auth: AuthService, private router: Router) {
    if (this.auth.isLoggedIn()) {
      this.router.navigate(['/dashboard'], { replaceUrl: true });
    }
  }

  // ── Sign-in ─────────────────────────────────────────────────────────────────
  submit() {
    if (!this.email || !this.password) {
      this.error.set('Please enter your email and password.');
      return;
    }

    this.loading.set(true);
    this.error.set('');

    const match = LOCAL_ACCOUNTS.find(
      a => a.email.toLowerCase() === this.email.toLowerCase() && a.password === this.password
    );

    if (match) {
      this.auth.mockLoginWithUser(match.user, match.token);
      this.loading.set(false);
      this.router.navigate(['/dashboard']);
      return;
    }

    if (!this.email.toLowerCase().endsWith('@expertflow.com')) {
      this.loading.set(false);
      this.error.set('Access restricted to ExpertFlow personnel only. Please use your @expertflow.com account.');
      return;
    }

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
    this.error.set('Google SSO is not yet configured. Please sign in with your email and password.');
  }

  // ── Registration ────────────────────────────────────────────────────────────
  switchToRegister() {
    this.error.set('');
    this.regError.set('');
    this.registerSuccess.set(false);
    this.showRegister.set(true);
  }

  switchToLogin() {
    this.regError.set('');
    this.showRegister.set(false);
  }

  register() {
    const r = this.reg;

    if (!r.firstName.trim() || !r.lastName.trim()) {
      this.regError.set('First name and last name are required.');
      return;
    }
    if (!r.email.trim()) {
      this.regError.set('Work email is required.');
      return;
    }
    if (!r.email.toLowerCase().endsWith('@expertflow.com')) {
      this.regError.set('Only @expertflow.com email addresses are allowed.');
      return;
    }
    if (!r.phone.trim()) {
      this.regError.set('Phone number is required.');
      return;
    }
    if (!r.password) {
      this.regError.set('Password is required.');
      return;
    }
    if (r.password.length < 6) {
      this.regError.set('Password must be at least 6 characters.');
      return;
    }
    if (r.password !== r.confirmPassword) {
      this.regError.set('Passwords do not match.');
      return;
    }

    // Check duplicate
    const exists = LOCAL_ACCOUNTS.find(a => a.email.toLowerCase() === r.email.toLowerCase());
    if (exists) {
      this.regError.set('An account with this email already exists.');
      return;
    }

    this.regLoading.set(true);
    this.regError.set('');

    // Simulate async registration
    setTimeout(() => {
      const newId = 'u-' + Date.now();
      const newUser: AppUser = {
        id: newId,
        email: r.email.trim().toLowerCase(),
        name: `${r.firstName.trim()} ${r.lastName.trim()}`,
        role: 'Employee',
        employee_id: 'emp-' + newId,
      };
      LOCAL_ACCOUNTS.push({
        email: newUser.email,
        password: r.password,
        token: 'local-token-' + newId,
        user: newUser,
      });

      this.regLoading.set(false);
      this.registerSuccess.set(true);

      // Auto-switch to login after 2 s
      setTimeout(() => {
        this.email    = r.email.trim().toLowerCase();
        this.password = '';
        this.reg = { firstName: '', lastName: '', email: '', phone: '', address: '', password: '', confirmPassword: '' };
        this.registerSuccess.set(false);
        this.showRegister.set(false);
      }, 2000);
    }, 600);
  }
}
