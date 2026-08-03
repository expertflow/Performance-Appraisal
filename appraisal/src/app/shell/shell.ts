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
    if (url.includes('cycles')) return 'Appraisal Cycles';
    if (url.includes('goals')) return 'Goals';
    if (url.includes('feedback')) return 'Feedback';
    return 'Dashboard';
  }
}
