import { Component, inject, signal, computed } from '@angular/core';
import { RouterOutlet, RouterLink, RouterLinkActive, Router, NavigationEnd } from '@angular/router';
import { CommonModule } from '@angular/common';
import { filter } from 'rxjs/operators';
import { toSignal } from '@angular/core/rxjs-interop';

@Component({
  selector: 'app-shell',
  imports: [RouterOutlet, RouterLink, RouterLinkActive, CommonModule],
  templateUrl: './shell.html',
  styleUrl: './shell.scss'
})
export class Shell {
  private router = inject(Router);

  // Track which module section is expanded using a signal
  expandedModule = signal<'recruitment' | 'appraisal' | 'projects' | null>(null);

  // Convert router events to a signal so zoneless CD picks up URL changes
  private navEnd = toSignal(
    this.router.events.pipe(filter(e => e instanceof NavigationEnd)),
    { initialValue: null }
  );

  // Computed signal for current URL — re-evaluates whenever navEnd changes
  private currentUrl = computed(() => {
    this.navEnd(); // subscribe to navigation changes
    return this.router.url;
  });

  constructor() {
    // Auto-expand the active module on navigation using effect-like computed
    // We use a toSignal + effect pattern to auto-expand
    this.router.events.pipe(
      filter(e => e instanceof NavigationEnd)
    ).subscribe(() => {
      const url = this.router.url;
      if (url.startsWith('/recruitment')) {
        this.expandedModule.set('recruitment');
      } else if (url.startsWith('/appraisal')) {
        this.expandedModule.set('appraisal');
      } else if (
        url.startsWith('/projects') || url.startsWith('/tasks') ||
        url.startsWith('/kanban') || url.startsWith('/timesheet') || url.startsWith('/gantt')
      ) {
        this.expandedModule.set('projects');
      }
    });

    // Set initial state based on current URL
    const url = this.router.url;
    if (url.startsWith('/recruitment')) {
      this.expandedModule.set('recruitment');
    } else if (url.startsWith('/appraisal')) {
      this.expandedModule.set('appraisal');
    } else if (
      url.startsWith('/projects') || url.startsWith('/tasks') ||
      url.startsWith('/kanban') || url.startsWith('/timesheet') || url.startsWith('/gantt')
    ) {
      this.expandedModule.set('projects');
    }
  }

  toggleModule(module: 'recruitment' | 'appraisal' | 'projects') {
    this.expandedModule.set(this.expandedModule() === module ? null : module);
  }

  isModuleActive(module: 'recruitment' | 'appraisal' | 'projects'): boolean {
    const url = this.currentUrl();
    if (module === 'recruitment') return url.startsWith('/recruitment');
    if (module === 'appraisal') return url.startsWith('/appraisal');
    if (module === 'projects') return (
      url.startsWith('/projects') || url.startsWith('/tasks') ||
      url.startsWith('/kanban') || url.startsWith('/timesheet') || url.startsWith('/gantt')
    );
    return false;
  }

  get currentPage(): string {
    const url = this.currentUrl();
    if (url.startsWith('/recruitment/requisitions')) return 'Job Requisitions';
    if (url.startsWith('/recruitment/pipeline')) return 'Pipeline';
    if (url.startsWith('/recruitment/agencies')) return 'Agencies';
    if (url.startsWith('/recruitment/offer')) return 'Offers';
    if (url.startsWith('/recruitment')) return 'Recruitment';
    if (url.startsWith('/appraisal/cycles')) return 'Review Cycles';
    if (url.startsWith('/appraisal/goals')) return 'Goals';
    if (url.startsWith('/appraisal/feedback')) return 'Feedback';
    if (url.startsWith('/appraisal/organogram')) return 'Organogram';
    if (url.startsWith('/appraisal')) return 'Performance Appraisal';
    if (url.startsWith('/projects/all')) return 'All Projects';
    if (url.startsWith('/projects')) return 'Project Management';
    if (url.startsWith('/tasks')) return 'Tasks';
    if (url.startsWith('/kanban')) return 'Kanban Board';
    if (url.startsWith('/gantt')) return 'Gantt Chart';
    if (url.startsWith('/timesheet')) return 'Timesheets';
    if (url.startsWith('/employees')) return 'Employees';
    if (url.startsWith('/notifications')) return 'Notifications';
    if (url.startsWith('/settings')) return 'Settings';
    return 'Dashboard';
  }

  get topbarSearch(): string {
    const url = this.currentUrl();
    if (url.startsWith('/recruitment')) return 'Search jobs, candidates...';
    if (url.startsWith('/appraisal')) return 'Search employees, cycles...';
    if (
      url.startsWith('/projects') || url.startsWith('/tasks') ||
      url.startsWith('/kanban') || url.startsWith('/gantt') || url.startsWith('/timesheet')
    ) return 'Search projects, tasks...';
    return 'Search...';
  }
}
