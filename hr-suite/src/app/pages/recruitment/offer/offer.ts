import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';

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
  imports: [RouterLink, FormsModule],
  templateUrl: './offer.html',
  styleUrl: './offer.scss'
})
export class Offer {
  // Filter state
  searchText = '';
  filterStatus = 'All Statuses';

  // Modal state
  showModal = false;
  exportToast = false;

  newOffer = {
    candidate: '',
    role: '',
    dept: 'Engineering',
    salary: '',
    expiryDays: 7,
  };

  offers: OfferItem[] = [
    {
      id: 'OFF-2025-018',
      candidate: 'Ahmed Raza',
      initials: 'AR',
      color: 'teal',
      role: 'Senior Angular Developer',
      dept: 'Engineering',
      salary: 'PKR 350,000 / month',
      sentDate: 'Jul 28, 2025',
      expiryDate: 'Aug 4, 2025',
      status: 'Pending',
      statusClass: 'badge-orange',
    },
    {
      id: 'OFF-2025-017',
      candidate: 'Fatima Malik',
      initials: 'FM',
      color: 'blue',
      role: 'Product Manager',
      dept: 'Product',
      salary: 'PKR 280,000 / month',
      sentDate: 'Jul 25, 2025',
      expiryDate: 'Aug 1, 2025',
      status: 'Accepted',
      statusClass: 'badge-green',
    },
    {
      id: 'OFF-2025-016',
      candidate: 'Zara Hussain',
      initials: 'ZH',
      color: 'purple',
      role: 'UX Designer',
      dept: 'Design',
      salary: 'PKR 220,000 / month',
      sentDate: 'Jul 22, 2025',
      expiryDate: 'Jul 29, 2025',
      status: 'Negotiating',
      statusClass: 'badge-blue',
    },
    {
      id: 'OFF-2025-015',
      candidate: 'Omar Sheikh',
      initials: 'OS',
      color: 'teal',
      role: 'DevOps Engineer',
      dept: 'Infrastructure',
      salary: 'PKR 300,000 / month',
      sentDate: 'Jul 18, 2025',
      expiryDate: 'Jul 25, 2025',
      status: 'Declined',
      statusClass: 'badge-red',
    },
    {
      id: 'OFF-2025-014',
      candidate: 'Nadia Baig',
      initials: 'NB',
      color: 'orange',
      role: 'Business Analyst',
      dept: 'Operations',
      salary: 'PKR 180,000 / month',
      sentDate: 'Jul 15, 2025',
      expiryDate: 'Jul 22, 2025',
      status: 'Accepted',
      statusClass: 'badge-green',
    },
    {
      id: 'OFF-2025-013',
      candidate: 'Khalid Mahmood',
      initials: 'KM',
      color: 'blue',
      role: 'Senior Angular Developer',
      dept: 'Engineering',
      salary: 'PKR 320,000 / month',
      sentDate: 'Jul 10, 2025',
      expiryDate: 'Jul 17, 2025',
      status: 'Accepted',
      statusClass: 'badge-green',
    },
  ];

  stats = [
    { label: 'Total Offers', value: '6', sub: 'This month' },
    { label: 'Pending', value: '1', sub: 'Awaiting response' },
    { label: 'Accepted', value: '3', sub: '50% acceptance rate' },
    { label: 'Declined', value: '1', sub: 'Requires re-pipeline' },
    { label: 'Avg. Time to Accept', value: '3.2d', sub: 'Last 30 days' },
  ];

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

  submitOffer() {
    if (!this.newOffer.candidate || !this.newOffer.role || !this.newOffer.salary) return;
    const initials = this.newOffer.candidate.split(' ').map((w: string) => w[0]).join('').toUpperCase().slice(0, 2);
    const colors = ['teal', 'blue', 'purple', 'orange'];
    const color = colors[this.offers.length % colors.length];
    const today = new Date();
    const expiry = new Date(today);
    expiry.setDate(expiry.getDate() + this.newOffer.expiryDays);
    const fmt = (d: Date) => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    const nextNum = 19 + (this.offers.length - 6);
    this.offers.unshift({
      id: `OFF-2025-0${nextNum}`,
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
