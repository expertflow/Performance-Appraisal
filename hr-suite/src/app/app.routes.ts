import { Routes } from '@angular/router';
import { Shell } from './shell/shell';
import { authGuard } from './guards/auth.guard';
import { roleGuard } from './guards/role.guard';

export const routes: Routes = [
  // ── Public routes (no auth required) ──────────────────────────────────────
  {
    path: 'login',
    loadComponent: () => import('./pages/auth/login/login').then(m => m.Login)
  },

  // ── Protected shell ────────────────────────────────────────────────────────
  {
    path: '',
    component: Shell,
    canActivate: [authGuard],
    children: [
      { path: '', redirectTo: 'dashboard', pathMatch: 'full' },

      // ── Overview (all roles) ──
      {
        path: 'dashboard',
        loadComponent: () => import('./pages/dashboard/dashboard').then(m => m.Dashboard)
      },

      // ── Change password (all roles) ──
      {
        path: 'change-password',
        loadComponent: () => import('./pages/auth/change-password/change-password').then(m => m.ChangePassword)
      },

      // ── Settings (all roles) ──
      {
        path: 'settings',
        loadComponent: () => import('./pages/settings/settings').then(m => m.Settings)
      },

      // ── Notifications (all roles) ──
      {
        path: 'notifications',
        loadComponent: () => import('./pages/notifications/notifications').then(m => m.Notifications)
      },

      // ── Recruitment module (AppAdmin, HR only) ──────────────────────────────
      {
        path: 'recruitment',
        canActivate: [roleGuard(['AppAdmin', 'HR'])],
        loadComponent: () => import('./pages/recruitment/dashboard/dashboard').then(m => m.RecruitmentDashboard)
      },
      {
        path: 'recruitment/requisitions',
        canActivate: [roleGuard(['AppAdmin', 'HR'])],
        loadComponent: () => import('./pages/recruitment/requisitions/requisitions').then(m => m.Requisitions)
      },
      {
        path: 'recruitment/pipeline',
        canActivate: [roleGuard(['AppAdmin', 'HR'])],
        loadComponent: () => import('./pages/recruitment/pipeline/pipeline').then(m => m.Pipeline)
      },
      {
        path: 'recruitment/agencies',
        canActivate: [roleGuard(['AppAdmin', 'HR'])],
        loadComponent: () => import('./pages/recruitment/agencies/agencies').then(m => m.Agencies)
      },
      {
        path: 'recruitment/offer',
        canActivate: [roleGuard(['AppAdmin', 'HR'])],
        loadComponent: () => import('./pages/recruitment/offer/offer').then(m => m.Offer)
      },

      // ── Employees (AppAdmin, HR only) ───────────────────────────────────────
      {
        path: 'employees',
        canActivate: [roleGuard(['AppAdmin', 'HR'])],
        loadComponent: () => import('./pages/employees/employees').then(m => m.Employees)
      },

      // ── Performance Appraisal module (all roles, scoped by role in component) ─
      {
        path: 'appraisal',
        canActivate: [roleGuard(['AppAdmin', 'HR', 'Manager', 'Employee'])],
        loadComponent: () => import('./pages/performance-appraisal/dashboard/dashboard').then(m => m.AppraisalDashboard)
      },
      {
        path: 'appraisal/cycles',
        canActivate: [roleGuard(['AppAdmin', 'HR', 'Manager'])],
        loadComponent: () => import('./pages/performance-appraisal/cycles/cycles').then(m => m.Cycles)
      },
      {
        path: 'appraisal/goals',
        canActivate: [roleGuard(['AppAdmin', 'HR', 'Manager', 'Employee'])],
        loadComponent: () => import('./pages/performance-appraisal/goals/goals').then(m => m.Goals)
      },
      {
        path: 'appraisal/feedback',
        canActivate: [roleGuard(['AppAdmin', 'HR', 'Manager', 'Employee'])],
        loadComponent: () => import('./pages/performance-appraisal/feedback/feedback').then(m => m.Feedback)
      },
      {
        path: 'appraisal/organogram',
        canActivate: [roleGuard(['AppAdmin', 'HR'])],
        loadComponent: () => import('./pages/performance-appraisal/organogram/organogram').then(m => m.Organogram)
      },

      // ── Project Management module (all roles, Employee is read-only for projects) ─
      {
        path: 'projects',
        canActivate: [roleGuard(['AppAdmin', 'HR', 'Manager', 'Employee'])],
        loadComponent: () => import('./pages/project-management/dashboard/dashboard').then(m => m.ProjectsDashboard)
      },
      {
        path: 'projects/all',
        canActivate: [roleGuard(['AppAdmin', 'HR', 'Manager', 'Employee'])],
        loadComponent: () => import('./pages/project-management/all-projects/all-projects').then(m => m.AllProjects)
      },
      {
        path: 'tasks',
        canActivate: [roleGuard(['AppAdmin', 'HR', 'Manager', 'Employee'])],
        loadComponent: () => import('./pages/project-management/tasks/tasks').then(m => m.Tasks)
      },
      {
        path: 'kanban',
        canActivate: [roleGuard(['AppAdmin', 'HR', 'Manager', 'Employee'])],
        loadComponent: () => import('./pages/project-management/kanban/kanban').then(m => m.Kanban)
      },
      {
        path: 'gantt',
        canActivate: [roleGuard(['AppAdmin', 'HR', 'Manager', 'Employee'])],
        loadComponent: () => import('./pages/project-management/gantt/gantt').then(m => m.Gantt)
      },
      {
        path: 'timesheet',
        canActivate: [roleGuard(['AppAdmin', 'HR', 'Manager', 'Employee'])],
        loadComponent: () => import('./pages/project-management/timesheet/timesheet').then(m => m.Timesheet)
      },
    ]
  },

  // ── Fallback ───────────────────────────────────────────────────────────────
  { path: '**', redirectTo: '' }
];
