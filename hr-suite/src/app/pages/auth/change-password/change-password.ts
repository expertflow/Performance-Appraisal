import { Component, signal, inject, computed } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../../services/auth';

@Component({
  selector: 'app-change-password',
  imports: [FormsModule, RouterLink],
  templateUrl: './change-password.html',
  styleUrl: './change-password.scss'
})
export class ChangePassword {
  private auth   = inject(AuthService);
  private router = inject(Router);

  /** True when the user signed in via Google and has no local password yet */
  readonly isGoogleOnly = computed(() => this.auth.isGoogleOnly());

  currentPassword = '';
  newPassword     = '';
  confirmPassword = '';
  loading  = signal(false);
  error    = signal('');
  success  = signal('');

  get user() { return this.auth.currentUser(); }

  get pageTitle(): string {
    return this.isGoogleOnly() ? 'Set a Password' : 'Change Password';
  }

  get pageSubtitle(): string {
    return this.isGoogleOnly()
      ? 'Set a local password so you can also sign in with email and password'
      : 'Update your account password';
  }

  submit() {
    this.error.set('');
    this.success.set('');

    if (!this.newPassword || !this.confirmPassword) {
      this.error.set('Please fill in all required fields.');
      return;
    }
    if (this.newPassword.length < 8) {
      this.error.set('New password must be at least 8 characters.');
      return;
    }
    if (this.newPassword !== this.confirmPassword) {
      this.error.set('Passwords do not match.');
      return;
    }
    if (!this.isGoogleOnly() && !this.currentPassword) {
      this.error.set('Current password is required.');
      return;
    }

    this.loading.set(true);

    if (this.isGoogleOnly()) {
      // Google-only: set password for the first time
      this.auth.setPassword(this.newPassword).subscribe({
        next: (res) => {
          this.loading.set(false);
          this.auth.markPasswordSet();
          this.success.set(res.message || 'Password set successfully.');
          this.newPassword = '';
          this.confirmPassword = '';
          setTimeout(() => this.router.navigate(['/settings']), 2000);
        },
        error: (err) => {
          this.loading.set(false);
          this.error.set(err?.error?.error || err?.error?.message || 'Failed to set password.');
        }
      });
    } else {
      // Local account: change existing password
      this.auth.changePassword(this.currentPassword, this.newPassword).subscribe({
        next: (res) => {
          this.loading.set(false);
          this.success.set(res.message || 'Password changed successfully.');
          this.currentPassword = '';
          this.newPassword = '';
          this.confirmPassword = '';
          setTimeout(() => this.router.navigate(['/dashboard']), 2000);
        },
        error: (err) => {
          this.loading.set(false);
          this.error.set(err?.error?.error || err?.error?.message || 'Failed to change password.');
        }
      });
    }
  }
}
