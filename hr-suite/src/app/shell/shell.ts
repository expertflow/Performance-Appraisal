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
    if (url.startsWith('/recruitment/requisitions')) return 'Job Requisitions';
    if (url.startsWith('/recruitment/pipeline')) return 'Pipeline';
    if (url.startsWith('/recruitment/offer')) return 'Offer Management';
    if (url.startsWith('/recruitment')) return 'Recruitment';
    if (url.startsWith('/appraisal/cycles')) return 'Cycles';
    if (url.startsWith('/appraisal/goals')) return 'Goals';
    if (url.startsWith('/appraisal/feedback')) return 'Feedback';
    if (url.startsWith('/appraisal')) return 'Performance Appraisal';
    if (url.startsWith('/projects')) return 'All Projects';
    if (url.startsWith('/tasks')) return 'Tasks';
    if (url.startsWith('/kanban')) return 'Kanban Board';
    if (url.startsWith('/timesheet')) return 'Timesheet';
    if (url.startsWith('/employees')) return 'Employees';
    if (url.startsWith('/notifications')) return 'Notifications';
    if (url.startsWith('/settings')) return 'Settings';
    if (url.startsWith('/dashboard')) return 'Dashboard';
    return 'Dashboard';
  }
}
