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
        path: 'requisitions',
        loadComponent: () => import('./pages/requisitions/requisitions').then(m => m.Requisitions)
      },
      {
        path: 'pipeline',
        loadComponent: () => import('./pages/pipeline/pipeline').then(m => m.Pipeline)
      },
      {
        path: 'offer',
        loadComponent: () => import('./pages/offer/offer').then(m => m.Offer)
      }
    ]
  },
  { path: '**', redirectTo: '' }
];
