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

  // ── OTP verification ────────────────────────────────────────────────────────
  showOtp         = signal(false);
  otpEmail        = signal('');   // signal so template binding is reactive
  otpCode         = '';
  otpError        = signal('');
  otpLoading      = signal(false);
  otpResendMsg    = signal('');
  otpResending    = signal(false);
  otpVerified     = signal(false); // show success screen before redirect

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
    // Redirect browser to backend OAuth entry point.
    // nginx proxies /api/ → Node, so this works on both IP and domain.
    window.location.href = '/api/v1/auth/google';
  }

  // ── Registration ────────────────────────────────────────────────────────────
  switchToRegister() {
    this.error.set('');
    this.regError.set('');
    this.registerSuccess.set(false);
    this.showRegister.set(true);
    this.showOtp.set(false);
  }

  switchToLogin() {
    this.regError.set('');
    this.showRegister.set(false);
    this.showOtp.set(false);
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

    const emailToRegister = r.email.trim().toLowerCase();

    this.api.localRegister({
      firstName: r.firstName.trim(),
      lastName:  r.lastName.trim(),
      email:     emailToRegister,
      phone:     r.phone.trim()   || undefined,
      address:   r.address.trim() || undefined,
      password:  r.password,
    }).subscribe({
      next: res => {
        this.regLoading.set(false);
        // Account created with Pending status — show OTP screen
        // Use res.email if available, otherwise fall back to what user typed
        const confirmedEmail = res.email || emailToRegister;
        this.otpEmail.set(confirmedEmail);
        this.otpCode = '';
        this.otpError.set('');
        this.otpResendMsg.set('');
        this.showRegister.set(false);
        this.showOtp.set(true);
      },
      error: err => {
        this.regLoading.set(false);
        this.regError.set(err?.error?.error || 'Registration failed. Please try again.');
      }
    });
  }

  // ── OTP verification ────────────────────────────────────────────────────────
  verifyOtp() {
    const email = this.otpEmail();
    const code  = this.otpCode.trim();

    if (!email) {
      this.otpError.set('Session expired. Please go back and register again.');
      return;
    }
    if (!code || code.length !== 6) {
      this.otpError.set('Please enter the 6-digit code sent to your email.');
      return;
    }

    this.otpLoading.set(true);
    this.otpError.set('');
    this.otpResendMsg.set('');

    this.api.verifyOtp(email, code).subscribe({
      next: res => {
        this.otpLoading.set(false);
        // Show success screen, then redirect to login after 3 seconds
        this.otpVerified.set(true);
        const verifiedEmail = res.user.email;
        setTimeout(() => {
          // Pre-fill email on login form and go back to sign-in
          this.email = verifiedEmail;
          this.password = '';
          this.otpVerified.set(false);
          this.showOtp.set(false);
          this.showRegister.set(false);
        }, 3000);
      },
      error: err => {
        this.otpLoading.set(false);
        this.otpError.set(err?.error?.error || 'Verification failed. Please try again.');
      }
    });
  }

  resendOtp() {
    const email = this.otpEmail();
    if (!email) {
      this.otpError.set('Session expired. Please go back and register again.');
      return;
    }

    this.otpResending.set(true);
    this.otpResendMsg.set('');
    this.otpError.set('');

    this.api.resendOtp(email).subscribe({
      next: () => {
        this.otpResending.set(false);
        this.otpResendMsg.set('A new code has been sent to your email.');
      },
      error: err => {
        this.otpResending.set(false);
        this.otpError.set(err?.error?.error || 'Failed to resend code. Please try again.');
      }
    });
  }
}
