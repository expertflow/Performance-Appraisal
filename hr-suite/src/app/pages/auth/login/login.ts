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
  showPass        = signal(false);
  showGoogleInfo  = signal(false);

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

  // ── Forgot password ─────────────────────────────────────────────────────────
  showForgot        = signal(false);  // step 1: enter email
  showForgotOtp     = signal(false);  // step 2: enter OTP
  showForgotNewPw   = signal(false);  // step 3: set new password
  forgotResetDone   = signal(false);  // success screen
  forgotEmail       = '';
  forgotOtpCode     = '';
  forgotNewPw       = '';
  forgotConfirmPw   = '';
  forgotShowPw      = signal(false);
  forgotError       = signal('');
  forgotLoading     = signal(false);
  forgotResendMsg   = signal('');
  forgotResending   = signal(false);

  constructor() {
    if (this.auth.isLoggedIn()) {
      const role = this.auth.role();
      if (role === 'Candidate') {
        this.router.navigate(['/candidate/home'], { replaceUrl: true });
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
          this.router.navigate(['/candidate/home']);
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
    this.showForgot.set(false);
    this.showForgotOtp.set(false);
    this.showForgotNewPw.set(false);
    this.forgotResetDone.set(false);
    this.forgotError.set('');
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

  // ── Forgot password ──────────────────────────────────────────────────────────

  /** Step 0: open forgot-password panel from sign-in view */
  openForgotPassword() {
    this.forgotEmail       = this.email; // pre-fill if user already typed email
    this.forgotOtpCode     = '';
    this.forgotNewPw       = '';
    this.forgotConfirmPw   = '';
    this.forgotError.set('');
    this.forgotResendMsg.set('');
    this.showForgot.set(true);
    this.showForgotOtp.set(false);
    this.showForgotNewPw.set(false);
    this.forgotResetDone.set(false);
  }

  /** Step 1: submit email → request OTP */
  submitForgotEmail() {
    const email = this.forgotEmail.trim();
    if (!email) {
      this.forgotError.set('Please enter your email address.');
      return;
    }
    this.forgotLoading.set(true);
    this.forgotError.set('');

    this.api.forgotPassword(email).subscribe({
      next: () => {
        this.forgotLoading.set(false);
        this.showForgot.set(false);
        this.showForgotOtp.set(true);
      },
      error: err => {
        this.forgotLoading.set(false);
        this.forgotError.set(err?.error?.error || 'Failed to send reset code. Please try again.');
      }
    });
  }

  /** Step 2: verify OTP → move to new-password step */
  submitForgotOtp() {
    const code = this.forgotOtpCode.trim();
    if (!code || code.length !== 6) {
      this.forgotError.set('Please enter the 6-digit code sent to your email.');
      return;
    }
    // Just advance to step 3 — actual OTP verification happens with the password
    this.forgotError.set('');
    this.showForgotOtp.set(false);
    this.showForgotNewPw.set(true);
  }

  /** Step 3: set new password → call reset-password endpoint */
  submitForgotNewPw() {
    if (!this.forgotNewPw) {
      this.forgotError.set('Please enter a new password.');
      return;
    }
    if (this.forgotNewPw.length < 6) {
      this.forgotError.set('Password must be at least 6 characters.');
      return;
    }
    if (this.forgotNewPw !== this.forgotConfirmPw) {
      this.forgotError.set('Passwords do not match.');
      return;
    }

    this.forgotLoading.set(true);
    this.forgotError.set('');

    this.api.resetPassword(this.forgotEmail.trim(), this.forgotOtpCode.trim(), this.forgotNewPw).subscribe({
      next: () => {
        this.forgotLoading.set(false);
        this.showForgotNewPw.set(false);
        this.forgotResetDone.set(true);
        // After 3 seconds, return to sign-in with email pre-filled
        setTimeout(() => {
          this.email = this.forgotEmail.trim();
          this.password = '';
          this.forgotResetDone.set(false);
          this.showForgot.set(false);
          this.showForgotOtp.set(false);
          this.showForgotNewPw.set(false);
        }, 3000);
      },
      error: err => {
        this.forgotLoading.set(false);
        this.forgotError.set(err?.error?.error || 'Failed to reset password. Please try again.');
      }
    });
  }

  /** Resend forgot-password OTP */
  resendForgotOtp() {
    const email = this.forgotEmail.trim();
    if (!email) return;

    this.forgotResending.set(true);
    this.forgotResendMsg.set('');
    this.forgotError.set('');

    this.api.forgotPassword(email).subscribe({
      next: () => {
        this.forgotResending.set(false);
        this.forgotResendMsg.set('A new reset code has been sent to your email.');
      },
      error: err => {
        this.forgotResending.set(false);
        this.forgotError.set(err?.error?.error || 'Failed to resend code. Please try again.');
      }
    });
  }
}
