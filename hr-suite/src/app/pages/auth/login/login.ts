import { Component, signal, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../../services/auth';
import { UserStoreService } from '../../../services/user-store';
import { ApiService } from '../../../services/api';

// ── Component ─────────────────────────────────────────────────────────────────
@Component({
  selector: 'app-login',
  imports: [FormsModule],
  templateUrl: './login.html',
  styleUrl: './login.scss'
})
export class Login {
  private auth      = inject(AuthService);
  private router    = inject(Router);
  private userStore = inject(UserStoreService);
  private api       = inject(ApiService);

  // ── Sign-in fields ──────────────────────────────────────────────────────────
  email        = '';
  password     = '';
  keepSignedIn = false;
  loading      = signal(false);
  error        = signal('');
  showPass     = signal(false);

  // ── View toggle ─────────────────────────────────────────────────────────────
  showRegister    = signal(false);
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

  constructor() {
    if (this.auth.isLoggedIn()) {
      const role = this.auth.role();
      if (role === 'Candidate') {
        this.router.navigate(['/candidate/jobs'], { replaceUrl: true });
      } else {
        this.router.navigate(['/dashboard'], { replaceUrl: true });
      }
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

    // Try local DB login first (covers all roles including Candidate)
    this.api.localLogin({ email: this.email, password: this.password }).subscribe({
      next: res => {
        this.loading.set(false);
        this.auth.mockLoginWithUser(res.user, res.token);
        if (res.user.role === 'Candidate') {
          this.router.navigate(['/candidate/jobs']);
        } else {
          this.router.navigate(['/dashboard']);
        }
      },
      error: localErr => {
        // If local login fails and it's an @expertflow.com email, try real backend
        if (this.email.toLowerCase().endsWith('@expertflow.com')) {
          this.auth.login({ email: this.email, password: this.password }).subscribe({
            next: () => {
              this.loading.set(false);
              this.router.navigate(['/dashboard']);
            },
            error: err => {
              this.loading.set(false);
              this.error.set(err?.error?.message || 'Invalid email or password.');
            }
          });
        } else {
          this.loading.set(false);
          this.error.set(localErr?.error?.error || 'Invalid email or password. Please create an account first.');
        }
      }
    });
  }

  googleSignIn() {
    this.error.set('Google SSO is not yet configured. Only @expertflow.com accounts will be permitted. Please sign in with your email and password for now.');
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

    // Validate required fields
    if (!r.firstName.trim() || !r.lastName.trim()) {
      this.regError.set('First name and last name are required.');
      return;
    }
    if (!r.email.trim()) {
      this.regError.set('Email address is required.');
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

    this.regLoading.set(true);
    this.regError.set('');

    this.api.localRegister({
      firstName: r.firstName.trim(),
      lastName:  r.lastName.trim(),
      email:     r.email.trim(),
      phone:     r.phone.trim()   || undefined,
      address:   r.address.trim() || undefined,
      password:  r.password,
    }).subscribe({
      next: res => {
        this.regLoading.set(false);
        this.registerSuccess.set(true);

        // If internal employee, add to UserStore (for All Users page)
        if (res.user.role !== 'Candidate') {
          this.userStore.addUser({
            id:          res.user.id,
            name:        res.user.name,
            email:       res.user.email,
            role:        res.user.role,
            department:  '—',
            designation: '—',
            employee_id: res.user.employee_id || '',
            status:      'Active',
            lastLogin:   'Just now',
          });
        }

        // Auto-switch back to sign-in after 2 s, pre-fill email
        setTimeout(() => {
          this.email    = res.user.email;
          this.password = '';
          this.reg = { firstName: '', lastName: '', email: '', phone: '', address: '', password: '', confirmPassword: '' };
          this.registerSuccess.set(false);
          this.showRegister.set(false);
        }, 2000);
      },
      error: err => {
        this.regLoading.set(false);
        this.regError.set(err?.error?.error || 'Registration failed. Please try again.');
      }
    });
  }
}
