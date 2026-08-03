import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';

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
  imports: [RouterLink],
  templateUrl: './offer.html',
  styleUrl: './offer.scss'
})
export class Offer {
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
}
