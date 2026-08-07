import { Component, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { AuthService } from '../../../services/auth';
import { environment } from '../../../../environments/environment';

@Component({
  selector: 'app-candidate-settings',
  imports: [RouterLink, FormsModule],
  templateUrl: './candidate-settings.html',
  styleUrl: './candidate-settings.scss'
})
export class CandidateSettings {
  private auth = inject(AuthService);
  private http  = inject(HttpClient);
  private base  = environment.apiUrl;

  readonly user        = this.auth.currentUser;
  readonly isGoogleOnly = this.auth.isGoogleOnly;

  // Change / Set password form
  currentPassword = '';
  newPassword     = '';
  confirmPassword = '';

  saving   = signal(false);
  pwMsg    = signal<{ type: 'success' | 'error'; text: string } | null>(null);

  get initials(): string {
    const name = this.user()?.name ?? '';
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) || '?';
  }

  submitPassword(): void {
    this.pwMsg.set(null);

    if (this.newPassword !== this.confirmPassword) {
      this.pwMsg.set({ type: 'error', text: 'New passwords do not match.' });
      return;
    }
    if (this.newPassword.length < 8) {
      this.pwMsg.set({ type: 'error', text: 'Password must be at least 8 characters.' });
      return;
    }

    this.saving.set(true);

    const req$ = this.isGoogleOnly()
      ? this.auth.setPassword(this.newPassword)
      : this.auth.changePassword(this.currentPassword, this.newPassword);

    req$.subscribe({
      next: () => {
        this.pwMsg.set({ type: 'success', text: 'Password updated successfully!' });
        this.currentPassword = '';
        this.newPassword     = '';
        this.confirmPassword = '';
        this.saving.set(false);
        if (this.isGoogleOnly()) this.auth.markPasswordSet();
      },
      error: err => {
        this.pwMsg.set({ type: 'error', text: err?.error?.message ?? 'Failed to update password.' });
        this.saving.set(false);
      }
    });
  }
}
