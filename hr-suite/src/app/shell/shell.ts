import { Component, inject, signal, computed } from '@angular/core';
import { RouterOutlet, RouterLink, RouterLinkActive, Router, NavigationEnd } from '@angular/router';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { filter } from 'rxjs/operators';
import { toSignal } from '@angular/core/rxjs-interop';
import { AuthService } from '../services/auth';
import { NotificationService } from '../services/notification';
import { SearchService } from '../services/search';

@Component({
  selector: 'app-shell',
  imports: [RouterOutlet, RouterLink, RouterLinkActive, CommonModule, FormsModule],
  templateUrl: './shell.html',
  styleUrl: './shell.scss'
})
export class Shell {
  private router = inject(Router);
  readonly auth   = inject(AuthService);
  readonly notif  = inject(NotificationService);
  readonly search = inject(SearchService);

  // Track which module section is expanded
  expandedModule = signal<'recruitment' | 'appraisal' | 'projects' | null>(null);

  // User menu dropdown open state (top-right)
  userMenuOpen = signal(false);

  // Profile popup open state (bottom-left sidebar)
  profileMenuOpen = signal(false);

  // Convert router events to a signal so zoneless CD picks up URL changes
  private navEnd = toSignal(
    this.router.events.pipe(filter(e => e instanceof NavigationEnd)),
    { initialValue: null }
  );

  // Computed signal for current URL
  private currentUrl = computed(() => {
    this.navEnd();
    return this.router.url;
  });

  // ── Role helpers exposed to template ─────────────────────────────────────
  get user()           { return this.auth.currentUser(); }
  get isAppAdmin()     { return this.auth.isAppAdmin(); }
  get isHR()           { return this.auth.isHR(); }
  get isManager()      { return this.auth.isManager(); }
  get isEmployee()     { return this.auth.isEmployee(); }
  get canRecruit()     { return this.auth.canAccessRecruitment(); }
  get canAppraisal()   { return this.auth.canAccessAppraisal(); }
  get canProjects()    { return this.auth.canAccessProjects(); }
  get canViewEmployees() { return this.auth.canViewEmployees(); }
  get isGoogleOnly(): boolean { return this.auth.isGoogleOnly(); }

  get userInitials(): string {
    const name = this.user?.name ?? '';
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  }

  get roleLabel(): string {
    const r = this.user?.role;
    if (r === 'AppAdmin') return 'App Administrator';
    if (r === 'HR')       return 'HR Manager';
    if (r === 'Manager')  return 'Team Manager';
    if (r === 'Employee') return 'Employee';
    return '';
  }

  constructor() {
    // Auto-expand the active module on navigation
    this.router.events.pipe(
      filter(e => e instanceof NavigationEnd)
    ).subscribe(() => {
      this.autoExpand();
      this.userMenuOpen.set(false);    // close top-right user menu on navigation
      this.profileMenuOpen.set(false); // close sidebar profile popup on navigation
      this.search.clear();             // clear topbar search on page navigation
    });
    this.autoExpand();

    // Load backend notifications for all logged-in users
    const u = this.auth.currentUser();
    if (u) {
      this.notif.loadFromBackend(u.role, u.id);
    }
  }

  private autoExpand() {
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
    if (module === 'appraisal')   return url.startsWith('/appraisal');
    if (module === 'projects')    return (
      url.startsWith('/projects') || url.startsWith('/tasks') ||
      url.startsWith('/kanban') || url.startsWith('/timesheet') || url.startsWith('/gantt')
    );
    return false;
  }

  toggleUserMenu() {
    this.userMenuOpen.set(!this.userMenuOpen());
  }

  toggleProfileMenu() {
    this.profileMenuOpen.set(!this.profileMenuOpen());
  }

  closeProfileMenu() {
    this.profileMenuOpen.set(false);
  }

  logout() {
    this.userMenuOpen.set(false);
    this.profileMenuOpen.set(false);
    this.auth.logout();
  }

  get currentPage(): string {
    const url = this.currentUrl();
    if (url.startsWith('/recruitment/requisitions'))  return 'Job Requisitions';
    if (url.startsWith('/recruitment/applications'))  return 'Candidate Applications';
    if (url.startsWith('/recruitment/pipeline'))      return 'Pipeline';
    if (url.startsWith('/recruitment/agencies'))      return 'Agencies';
    if (url.startsWith('/recruitment/offer'))         return 'Offers';
    if (url.startsWith('/recruitment'))               return 'Recruitment';
    if (url.startsWith('/appraisal/cycles'))        return 'Review Cycles';
    if (url.startsWith('/appraisal/goals'))         return 'Goals';
    if (url.startsWith('/appraisal/feedback'))      return 'Feedback';
    if (url.startsWith('/appraisal/organogram'))    return 'Organogram';
    if (url.startsWith('/appraisal'))               return 'Performance Appraisal';
    if (url.startsWith('/projects/all'))            return 'All Projects';
    if (url.startsWith('/projects'))                return 'Project Management';
    if (url.startsWith('/tasks'))                   return 'Tasks';
    if (url.startsWith('/kanban'))                  return 'Kanban Board';
    if (url.startsWith('/gantt'))                   return 'Gantt Chart';
    if (url.startsWith('/timesheet'))               return 'Timesheets';
    if (url.startsWith('/employees'))               return 'Employees';
    if (url.startsWith('/notifications'))           return 'Notifications';
    if (url.startsWith('/settings'))                return 'Settings';
    if (url.startsWith('/change-password'))         return 'Change Password';
    if (url.startsWith('/users'))                   return 'All Users';
    return 'Dashboard';
  }

  get topbarSearch(): string {
    const url = this.currentUrl();
    if (url.startsWith('/recruitment'))  return 'Search jobs, candidates...';
    if (url.startsWith('/appraisal'))    return 'Search employees, cycles...';
    if (url.startsWith('/timesheet'))    return 'Search time entries...';
    if (url.startsWith('/tasks'))        return 'Search tasks...';
    if (url.startsWith('/projects/all')) return 'Search projects...';
    if (url.startsWith('/projects'))     return 'Search projects, tasks...';
    if (url.startsWith('/kanban'))       return 'Search tasks...';
    if (url.startsWith('/gantt'))        return 'Search tasks...';
    if (url.startsWith('/employees'))    return 'Search employees...';
    return 'Search...';
  }

  onSearchInput(value: string) {
    this.search.set(value);
  }
}
