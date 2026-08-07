import { Routes } from '@angular/router';
import { Shell } from './shell/shell';
import { CandidateShell } from './candidate-shell/candidate-shell';
import { authGuard } from './guards/auth.guard';
import { roleGuard } from './guards/role.guard';

export const routes: Routes = [
  // ── Public routes (no auth required) ──────────────────────────────────────
  {
    path: 'login',
    loadComponent: () => import('./pages/auth/login/login').then(m => m.Login)
  },
  {
    path: 'auth/google-callback',
    loadComponent: () => import('./pages/auth/google-callback/google-callback').then(m => m.GoogleCallback)
  },

  // ── Candidate portal (external users) ─────────────────────────────────────
  {
    path: 'candidate',
    component: CandidateShell,
    canActivate: [authGuard, roleGuard(['Candidate'])],
    children: [
      { path: '', redirectTo: 'jobs', pathMatch: 'full' },
      {
        path: 'jobs',
        loadComponent: () => import('./pages/candidate/jobs/jobs').then(m => m.CandidateJobs)
      },
      {
        path: 'my-applications',
        loadComponent: () => import('./pages/candidate/my-applications/my-applications').then(m => m.MyApplications)
      },
    ]
  },

  // ── Protected shell (internal staff) ──────────────────────────────────────
  {
    path: '',
    component: Shell,
    canActivate: [authGuard],
    children: [
      { path: '', redirectTo: 'dashboard', pathMatch: 'full' },

      // ── Overview (all internal roles) ──
      {
        path: 'dashboard',
        loadComponent: () => import('./pages/dashboard/dashboard').then(m => m.Dashboard)
      },

      // ── Change password (all internal roles) ──
      {
        path: 'change-password',
        loadComponent: () => import('./pages/auth/change-password/change-password').then(m => m.ChangePassword)
      },

      // ── Settings (all internal roles) ──
      {
        path: 'settings',
        loadComponent: () => import('./pages/settings/settings').then(m => m.Settings)
      },

      // ── All Users (AppAdmin, HR only) ──
      {
        path: 'users',
        canActivate: [roleGuard(['AppAdmin', 'HR'])],
        loadComponent: () => import('./pages/users/users').then(m => m.Users)
      },

      // ── Notifications (all internal roles) ──
      {
        path: 'notifications',
        loadComponent: () => import('./pages/notifications/notifications').then(m => m.Notifications)
      },

      // ── Recruitment module ───────────────────────────────────────────────────
      {
        path: 'recruitment',
        canActivate: [roleGuard(['AppAdmin', 'HR'])],
        loadComponent: () => import('./pages/recruitment/dashboard/dashboard').then(m => m.RecruitmentDashboard)
      },
      {
        path: 'recruitment/requisitions',
        canActivate: [roleGuard(['AppAdmin', 'HR', 'Manager'])],
        loadComponent: () => import('./pages/recruitment/requisitions/requisitions').then(m => m.Requisitions)
      },
      {
        path: 'recruitment/pipeline',
        canActivate: [roleGuard(['AppAdmin', 'HR'])],
        loadComponent: () => import('./pages/recruitment/pipeline/pipeline').then(m => m.Pipeline)
      },
      {
        path: 'recruitment/applications',
        canActivate: [roleGuard(['AppAdmin', 'HR'])],
        loadComponent: () => import('./pages/recruitment/applications/applications').then(m => m.Applications)
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

      // ── Performance Appraisal module (all internal roles) ───────────────────
      {
        path: 'appraisal',
        canActivate: [roleGuard(['AppAdmin', 'HR', 'Manager', 'Employee'])],
        loadComponent: () => import('./pages/appraisal/dashboard/dashboard').then(m => m.AppraisalDashboard)
      },
      {
        path: 'appraisal/cycles',
        canActivate: [roleGuard(['AppAdmin', 'HR', 'Manager'])],
        loadComponent: () => import('./pages/appraisal/cycles/cycles').then(m => m.Cycles)
      },
      {
        path: 'appraisal/goals',
        canActivate: [roleGuard(['AppAdmin', 'HR', 'Manager', 'Employee'])],
        loadComponent: () => import('./pages/appraisal/goals/goals').then(m => m.Goals)
      },
      {
        path: 'appraisal/feedback',
        canActivate: [roleGuard(['AppAdmin', 'HR', 'Manager', 'Employee'])],
        loadComponent: () => import('./pages/appraisal/feedback/feedback').then(m => m.Feedback)
      },
      {
        path: 'appraisal/organogram',
        canActivate: [roleGuard(['AppAdmin', 'HR', 'Manager', 'Employee'])],
        loadComponent: () => import('./pages/appraisal/organogram/organogram').then(m => m.Organogram)
      },

      // ── Project Management module (all internal roles) ──────────────────────
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
        path: 'tasks/:id',
        canActivate: [roleGuard(['AppAdmin', 'HR', 'Manager', 'Employee'])],
        loadComponent: () => import('./pages/project-management/subtasks/subtasks').then(m => m.Subtasks)
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
  { path: '**', redirectTo: 'login' }
];
