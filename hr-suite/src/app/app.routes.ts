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
        path: 'recruitment/agencies',
        loadComponent: () => import('./pages/recruitment/agencies/agencies').then(m => m.Agencies)
      },
      {
        path: 'recruitment/offer',
        loadComponent: () => import('./pages/recruitment/offer/offer').then(m => m.Offer)
      },

      // ── Performance Appraisal module ──
      {
        path: 'appraisal',
        loadComponent: () => import('./pages/performance-appraisal/dashboard/dashboard').then(m => m.AppraisalDashboard)
      },
      {
        path: 'appraisal/cycles',
        loadComponent: () => import('./pages/performance-appraisal/cycles/cycles').then(m => m.Cycles)
      },
      {
        path: 'appraisal/goals',
        loadComponent: () => import('./pages/performance-appraisal/goals/goals').then(m => m.Goals)
      },
      {
        path: 'appraisal/feedback',
        loadComponent: () => import('./pages/performance-appraisal/feedback/feedback').then(m => m.Feedback)
      },
      {
        path: 'appraisal/organogram',
        loadComponent: () => import('./pages/performance-appraisal/organogram/organogram').then(m => m.Organogram)
      },

      // ── Project Management module ──
      {
        path: 'projects',
        loadComponent: () => import('./pages/project-management/dashboard/dashboard').then(m => m.ProjectsDashboard)
      },
      {
        path: 'projects/all',
        loadComponent: () => import('./pages/project-management/all-projects/all-projects').then(m => m.AllProjects)
      },
      {
        path: 'tasks',
        loadComponent: () => import('./pages/project-management/tasks/tasks').then(m => m.Tasks)
      },
      {
        path: 'kanban',
        loadComponent: () => import('./pages/project-management/kanban/kanban').then(m => m.Kanban)
      },
      {
        path: 'gantt',
        loadComponent: () => import('./pages/project-management/gantt/gantt').then(m => m.Gantt)
      },
      {
        path: 'timesheet',
        loadComponent: () => import('./pages/project-management/timesheet/timesheet').then(m => m.Timesheet)
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
