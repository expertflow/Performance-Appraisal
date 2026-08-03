import { Routes } from '@angular/router';
import { Shell } from './shell/shell';

export const routes: Routes = [
  {
    path: '',
    component: Shell,
    children: [
      { path: '', redirectTo: 'dashboard', pathMatch: 'full' },

      // ── Overview ──
      {
        path: 'dashboard',
        loadComponent: () => import('./pages/dashboard/dashboard').then(m => m.Dashboard)
      },

      // ── Recruitment module ──
      {
        path: 'recruitment',
        loadComponent: () => import('./pages/recruitment/dashboard/dashboard').then(m => m.RecruitmentDashboard)
      },
      {
        path: 'recruitment/requisitions',
        loadComponent: () => import('./pages/recruitment/requisitions/requisitions').then(m => m.Requisitions)
      },
      {
        path: 'recruitment/pipeline',
        loadComponent: () => import('./pages/recruitment/pipeline/pipeline').then(m => m.Pipeline)
      },
      {
        path: 'recruitment/offer',
        loadComponent: () => import('./pages/recruitment/offer/offer').then(m => m.Offer)
      },

      // ── Appraisal module ──
      {
        path: 'appraisal',
        loadComponent: () => import('./pages/appraisal/dashboard/dashboard').then(m => m.AppraisalDashboard)
      },
      {
        path: 'appraisal/cycles',
        loadComponent: () => import('./pages/appraisal/cycles/cycles').then(m => m.Cycles)
      },
      {
        path: 'appraisal/goals',
        loadComponent: () => import('./pages/appraisal/goals/goals').then(m => m.Goals)
      },
      {
        path: 'appraisal/feedback',
        loadComponent: () => import('./pages/appraisal/feedback/feedback').then(m => m.Feedback)
      },

      // ── Project Management module ──
      {
        path: 'projects',
        loadComponent: () => import('./pages/projects/projects').then(m => m.Projects)
      },
      {
        path: 'tasks',
        loadComponent: () => import('./pages/tasks/tasks').then(m => m.Tasks)
      },
      {
        path: 'kanban',
        loadComponent: () => import('./pages/kanban/kanban').then(m => m.Kanban)
      },
      {
        path: 'timesheet',
        loadComponent: () => import('./pages/timesheet/timesheet').then(m => m.Timesheet)
      },

      // ── Administration ──
      {
        path: 'employees',
        loadComponent: () => import('./pages/employees/employees').then(m => m.Employees)
      },
      {
        path: 'notifications',
        loadComponent: () => import('./pages/notifications/notifications').then(m => m.Notifications)
      },
      {
        path: 'settings',
        loadComponent: () => import('./pages/settings/settings').then(m => m.Settings)
      }
    ]
  },
  { path: '**', redirectTo: '' }
];
