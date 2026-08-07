import { Component, OnInit, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { JobStoreService, JobApplication } from '../../../services/job-store';

interface OfferItem {
  id: string;
  candidate: string;
  initials: string;
  color: string;
  role: string;
  dept: string;
  salary: string;
  sentDate: string;
  expiryDate: string;
  status: string;
  statusClass: string;
}

@Component({
  selector: 'app-offer',
  imports: [RouterLink, FormsModule, CommonModule],
  templateUrl: './offer.html',
  styleUrl: './offer.scss'
})
export class Offer implements OnInit {
  private jobStore = inject(JobStoreService);

  // Filter state
  searchText = '';
  filterStatus = 'All Statuses';

  // Modal state
  showModal = false;
  exportToast = false;

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
    this.newOffer.candidate = app.candidateName;
    this.newOffer.role      = app.jobTitle;
    this.candidateSearch    = app.candidateName;
    this.showCandidateDropdown = false;
  }

  newOffer = {
    candidate: '',
    role: '',
    dept: 'Engineering',
    salary: '',
    expiryDays: 7,
  };

  offers: OfferItem[] = [];

  ngOnInit(): void {
    this.jobStore.reloadAllApplications();
  }

  get stats() {
    const total       = this.offers.length;
    const pending     = this.offers.filter(o => o.status === 'Pending').length;
    const accepted    = this.offers.filter(o => o.status === 'Accepted').length;
    const declined    = this.offers.filter(o => o.status === 'Declined').length;
    const acceptRate  = total ? Math.round((accepted / total) * 100) : 0;
    return [
      { label: 'Total Offers',       value: String(total),    sub: 'All time' },
      { label: 'Pending',            value: String(pending),  sub: 'Awaiting response' },
      { label: 'Accepted',           value: String(accepted), sub: `${acceptRate}% acceptance rate` },
      { label: 'Declined',           value: String(declined), sub: 'Requires re-pipeline' },
      { label: 'Avg. Time to Accept', value: '—',             sub: 'Last 30 days' },
    ];
  }

  get filteredOffers(): OfferItem[] {
    return this.offers.filter(o => {
      const matchSearch = !this.searchText ||
        o.candidate.toLowerCase().includes(this.searchText.toLowerCase()) ||
        o.role.toLowerCase().includes(this.searchText.toLowerCase()) ||
        o.id.toLowerCase().includes(this.searchText.toLowerCase());
      const matchStatus = this.filterStatus === 'All Statuses' || o.status === this.filterStatus;
      return matchSearch && matchStatus;
    });
  }

  openModal() { this.showModal = true; }
  closeModal() { this.showModal = false; this.resetForm(); }

  resetForm() {
    this.newOffer = { candidate: '', role: '', dept: 'Engineering', salary: '', expiryDays: 7 };
    this.candidateSearch       = '';
    this.showCandidateDropdown = false;
    this.selectedApplication   = null;
  }

  // ── Edit ──────────────────────────────────────────────────────────────────
  showEditModal = false;
  editingOffer: OfferItem | null = null;
  editForm = { candidate: '', role: '', dept: '', salary: '', status: '' };

  openEdit(offer: OfferItem): void {
    this.editingOffer = offer;
    this.editForm = {
      candidate: offer.candidate,
      role:      offer.role,
      dept:      offer.dept,
      salary:    offer.salary,
      status:    offer.status,
    };
    this.showEditModal = true;
  }

  closeEdit(): void {
    this.showEditModal = false;
    this.editingOffer = null;
  }

  saveEdit(): void {
    if (!this.editingOffer) return;
    const statusClassMap: Record<string, string> = {
      Pending:     'badge-orange',
      Accepted:    'badge-green',
      Negotiating: 'badge-blue',
      Declined:    'badge-red',
    };
    const idx = this.offers.findIndex(o => o.id === this.editingOffer!.id);
    if (idx !== -1) {
      this.offers[idx] = {
        ...this.offers[idx],
        candidate:   this.editForm.candidate,
        role:        this.editForm.role,
        dept:        this.editForm.dept,
        salary:      this.editForm.salary,
        status:      this.editForm.status,
        statusClass: statusClassMap[this.editForm.status] ?? 'badge-orange',
        initials:    this.editForm.candidate.split(' ').map((w: string) => w[0]).join('').toUpperCase().slice(0, 2),
      };
    }
    this.closeEdit();
  }

  // ── Delete ────────────────────────────────────────────────────────────────
  deleteOffer(offer: OfferItem): void {
    if (confirm(`Delete offer ${offer.id} for ${offer.candidate}?`)) {
      this.offers = this.offers.filter(o => o.id !== offer.id);
    }
  }

  private offerCounter = 1;

  submitOffer() {
    if (!this.newOffer.candidate || !this.newOffer.role || !this.newOffer.salary) return;
    const initials = this.newOffer.candidate.split(' ').map((w: string) => w[0]).join('').toUpperCase().slice(0, 2);
    const colors = ['teal', 'blue', 'purple', 'orange'];
    const color = colors[this.offers.length % colors.length];
    const today = new Date();
    const expiry = new Date(today);
    expiry.setDate(expiry.getDate() + this.newOffer.expiryDays);
    const fmt = (d: Date) => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    const year = today.getFullYear();
    const seq  = String(this.offerCounter++).padStart(3, '0');
    this.offers.unshift({
      id: `OFF-${year}-${seq}`,
      candidate: this.newOffer.candidate,
      initials,
      color,
      role: this.newOffer.role,
      dept: this.newOffer.dept,
      salary: this.newOffer.salary,
      sentDate: fmt(today),
      expiryDate: fmt(expiry),
      status: 'Pending',
      statusClass: 'badge-orange',
    });
    this.closeModal();
  }

  exportData() {
    this.exportToast = true;
    setTimeout(() => this.exportToast = false, 3000);
  }
}
