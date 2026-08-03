import { Component } from '@angular/core';
import { RouterOutlet, RouterLink, RouterLinkActive, Router } from '@angular/router';

@Component({
  selector: 'app-shell',
  imports: [RouterOutlet, RouterLink, RouterLinkActive],
  templateUrl: './shell.html',
  styleUrl: './shell.scss'
})
export class Shell {
  constructor(private router: Router) {}

  get currentPage(): string {
    const url = this.router.url;
    if (url.includes('dashboard')) return 'Dashboard';
    if (url.includes('requisitions')) return 'Job Requisitions';
    if (url.includes('pipeline')) return 'Pipeline';
    if (url.includes('offer')) return 'Offer Management';
    return 'Dashboard';
  }
}
