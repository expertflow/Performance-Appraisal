import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../../services/auth';
import { JobStoreService, JobApplication } from '../../../services/job-store';
import { ApiService, JobOffer } from '../../../services/api';

@Component({
  selector: 'app-my-applications',
  imports: [CommonModule, RouterLink],
  templateUrl: './my-applications.html',
  styleUrl: './my-applications.scss'
})
export class MyApplications implements OnInit {
  private auth     = inject(AuthService);
  private jobStore = inject(JobStoreService);
  private api      = inject(ApiService);

  readonly user = this.auth.currentUser;

  // ── Offers ─────────────────────────────────────────────────────────────────
  offers: JobOffer[]    = [];
  offersLoading         = false;
  respondingOfferId: string | null = null;
  offerToast: { msg: string; ok: boolean } | null = null;

  ngOnInit(): void {
    const uid = this.user()?.id;
    if (uid) {
      this.jobStore.loadApplications(uid);
      this.loadOffers(uid);
    }
  }

  loadOffers(candidateId: string): void {
    this.offersLoading = true;
    this.api.getJobOffers(candidateId).subscribe({
      next: list => { this.offers = list; this.offersLoading = false; },
      error: ()  => { this.offersLoading = false; },
    });
  }

  get pendingOffers(): JobOffer[] {
    return this.offers.filter(o => o.status === 'Pending');
  }

  respondToOffer(offerId: string, decision: 'Accepted' | 'Rejected'): void {
    this.respondingOfferId = offerId;
    this.api.respondToJobOffer(offerId, decision).subscribe({
      next: updated => {
        this.offers = this.offers.map(o => o.id === offerId ? updated : o);
        this.respondingOfferId = null;
        this.offerToast = {
          msg: decision === 'Accepted'
            ? '🎉 Offer accepted! HR has been notified.'
            : '✓ Offer declined. HR has been notified.',
          ok: decision === 'Accepted',
        };
        setTimeout(() => this.offerToast = null, 5000);
      },
      error: () => {
        this.respondingOfferId = null;
        this.offerToast = { msg: '⚠️ Something went wrong. Please try again.', ok: false };
        setTimeout(() => this.offerToast = null, 4000);
      },
    });
  }

  // ── Applications ───────────────────────────────────────────────────────────
  get myApps(): JobApplication[] {
    return this.jobStore.myApplications(this.user()?.id ?? '');
  }

  statusClass(status: JobApplication['status']): string {
    const map: Record<JobApplication['status'], string> = {
      'Submitted':    'status-submitted',
      'Under Review': 'status-review',
      'Shortlisted':  'status-shortlisted',
      'Rejected':     'status-rejected',
      'Hired':        'status-hired',
    };
    return map[status] ?? '';
  }

  countByStatus(status: JobApplication['status']): number {
    return this.myApps.filter(a => a.status === status).length;
  }

  statusIcon(status: JobApplication['status']): string {
    const map: Record<JobApplication['status'], string> = {
      'Submitted':    '📤',
      'Under Review': '🔍',
      'Shortlisted':  '⭐',
      'Rejected':     '❌',
      'Hired':        '🎉',
    };
    return map[status] ?? '📋';
  }
}
