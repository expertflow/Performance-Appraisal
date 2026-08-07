import { Component, OnInit, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { JobStoreService, JobApplication } from '../../../services/job-store';
import { ApiService, JobOffer } from '../../../services/api';

@Component({
  selector: 'app-offer',
  imports: [RouterLink, FormsModule, CommonModule],
  templateUrl: './offer.html',
  styleUrl: './offer.scss'
})
export class Offer implements OnInit {
  private jobStore = inject(JobStoreService);
  private api      = inject(ApiService);

  // Filter state
  searchText = '';
  filterStatus = 'All Statuses';

  // Modal state
  showModal   = false;
  exportToast = false;
  saving      = false;
  saveError   = '';

  // ── Candidate picker state ─────────────────────────────────────────────────
  candidateSearch = '';
  showCandidateDropdown = false;
  selectedApplication: JobApplication | null = null;

  get eligibleCandidates(): JobApplication[] {
    const apps = this.jobStore.applications();
    // Exclude Rejected; deduplicate by candidateId keeping latest
    const seen = new Map<string, JobApplication>();
    for (const a of apps) {
      if (a.status === 'Rejected') continue;
      const existing = seen.get(a.candidateId);
      if (!existing || a.appliedDate > existing.appliedDate) seen.set(a.candidateId, a);
    }
    return Array.from(seen.values());
  }

  get filteredCandidates(): JobApplication[] {
    const q = this.candidateSearch.toLowerCase();
    if (!q) return this.eligibleCandidates;
    return this.eligibleCandidates.filter(a =>
      a.candidateName.toLowerCase().includes(q) ||
      a.jobTitle.toLowerCase().includes(q) ||
      a.candidateEmail.toLowerCase().includes(q)
    );
  }

  selectCandidate(app: JobApplication): void {
    this.selectedApplication = app;
    this.newOffer.candidate  = app.candidateName;
    this.newOffer.role       = app.jobTitle;
    this.candidateSearch     = app.candidateName;
    this.showCandidateDropdown = false;
  }

  newOffer = {
    candidate:  '',
    role:       '',
    dept:       'Engineering',
    salary:     '',
    expiryDays: 7,
  };

  // ── DB-backed offers ───────────────────────────────────────────────────────
  offers: JobOffer[] = [];
  loading = false;

  ngOnInit(): void {
    this.jobStore.reloadAllApplications();
    this.loadOffers();
  }

  loadOffers(): void {
    this.loading = true;
    this.api.getJobOffers().subscribe({
      next: list => { this.offers = list; this.loading = false; },
      error: ()  => { this.loading = false; },
    });
  }

  get stats() {
    const total      = this.offers.length;
    const pending    = this.offers.filter(o => o.status === 'Pending').length;
    const accepted   = this.offers.filter(o => o.status === 'Accepted').length;
    const rejected   = this.offers.filter(o => o.status === 'Rejected').length;
    const acceptRate = total ? Math.round((accepted / total) * 100) : 0;
    return [
      { label: 'Total Offers',        value: String(total),    sub: 'All time' },
      { label: 'Pending',             value: String(pending),  sub: 'Awaiting response' },
      { label: 'Accepted',            value: String(accepted), sub: `${acceptRate}% acceptance rate` },
      { label: 'Rejected',            value: String(rejected), sub: 'Requires re-pipeline' },
      { label: 'Avg. Time to Accept', value: '—',              sub: 'Last 30 days' },
    ];
  }

  statusClass(status: string): string {
    const m: Record<string, string> = {
      Pending:  'badge-orange',
      Accepted: 'badge-green',
      Rejected: 'badge-red',
    };
    return m[status] ?? 'badge-orange';
  }

  get filteredOffers(): JobOffer[] {
    return this.offers.filter(o => {
      const matchSearch = !this.searchText ||
        o.candidateName.toLowerCase().includes(this.searchText.toLowerCase()) ||
        o.role.toLowerCase().includes(this.searchText.toLowerCase()) ||
        o.id.toLowerCase().includes(this.searchText.toLowerCase());
      const matchStatus = this.filterStatus === 'All Statuses' || o.status === this.filterStatus;
      return matchSearch && matchStatus;
    });
  }

  openModal() { this.showModal = true; this.saveError = ''; }
  closeModal() { this.showModal = false; this.resetForm(); }

  resetForm() {
    this.newOffer = { candidate: '', role: '', dept: 'Engineering', salary: '', expiryDays: 7 };
    this.candidateSearch       = '';
    this.showCandidateDropdown = false;
    this.selectedApplication   = null;
    this.saveError             = '';
  }

  submitOffer() {
    if (!this.newOffer.candidate || !this.newOffer.role || !this.newOffer.salary) return;
    if (!this.selectedApplication) {
      this.saveError = 'Please select a candidate from the dropdown.';
      return;
    }

    this.saving    = true;
    this.saveError = '';

    this.api.createJobOffer({
      candidateId:    this.selectedApplication.candidateId,
      candidateName:  this.selectedApplication.candidateName,
      candidateEmail: this.selectedApplication.candidateEmail,
      jobTitle:       this.selectedApplication.jobTitle,
      role:           this.newOffer.role,
      dept:           this.newOffer.dept,
      salary:         this.newOffer.salary,
      expiryDays:     this.newOffer.expiryDays,
    }).subscribe({
      next: offer => {
        this.offers.unshift(offer);
        this.saving = false;
        this.closeModal();
      },
      error: err => {
        this.saveError = err?.error?.error || 'Failed to send offer. Please try again.';
        this.saving = false;
      },
    });
  }

  exportData() {
    this.exportToast = true;
    setTimeout(() => this.exportToast = false, 3000);
  }

  initials(name: string): string {
    return name.split(' ').map(w => w[0] ?? '').join('').toUpperCase().slice(0, 2);
  }

  avatarColor(idx: number): string {
    const colors = ['#00A3A3', '#0066CC', '#7C3AED', '#D97706'];
    return colors[idx % colors.length];
  }
}
