import { Routes } from '@angular/router';
import { Shell } from './shell/shell';

export const routes: Routes = [
  {
    path: '',
    component: Shell,
    children: [
      { path: '', redirectTo: 'dashboard', pathMatch: 'full' },
      {
        path: 'dashboard',
        loadComponent: () => import('./pages/dashboard/dashboard').then(m => m.Dashboard)
      },
      {
        path: 'cycles',
        loadComponent: () => import('./pages/cycles/cycles').then(m => m.Cycles)
      },
      {
        path: 'goals',
        loadComponent: () => import('./pages/goals/goals').then(m => m.Goals)
      },
      {
        path: 'feedback',
        loadComponent: () => import('./pages/feedback/feedback').then(m => m.Feedback)
      }
    ]
  },
  { path: '**', redirectTo: '' }
];
