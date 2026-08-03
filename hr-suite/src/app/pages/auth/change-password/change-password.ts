import { Component, signal } from '@angular/core';
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
  currentPassword = '';
  newPassword     = '';
  confirmPassword = '';
  loading  = signal(false);
  error    = signal('');
  success  = signal('');

  constructor(private auth: AuthService, private router: Router) {}

  get user() { return this.auth.currentUser(); }

  submit() {
    this.error.set('');
    this.success.set('');

    if (!this.currentPassword || !this.newPassword || !this.confirmPassword) {
      this.error.set('All fields are required.');
      return;
    }
    if (this.newPassword.length < 8) {
      this.error.set('New password must be at least 8 characters.');
      return;
    }
    if (this.newPassword !== this.confirmPassword) {
      this.error.set('New passwords do not match.');
      return;
    }

    this.loading.set(true);
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
        this.error.set(err?.error?.message || 'Failed to change password.');
      }
    });
  }
}
