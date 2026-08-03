import { Component } from '@angular/core';

@Component({
  selector: 'app-gantt',
  standalone: true,
  template: `
    <div class="page-header">
      <div>
        <h1>Gantt Chart</h1>
        <p>Visualise project timelines and dependencies</p>
      </div>
      <button class="btn btn-primary">+ New Project</button>
    </div>
    <div class="card" style="padding: 48px; text-align: center; color: var(--color-text-secondary);">
      <div style="font-size: 48px; margin-bottom: 16px;">📅</div>
      <h3>Gantt Chart</h3>
      <p>Timeline view coming soon.</p>
    </div>
  `,
  styles: [`
    .page-header { display: flex; align-items: flex-start; justify-content: space-between; margin-bottom: 24px; }
    .page-header h1 { font-size: 24px; font-weight: 700; color: #1E293B; margin: 0 0 4px; }
    .page-header p { color: #64748B; font-size: 14px; margin: 0; }
    .card { background: #fff; border-radius: 12px; border: 1px solid #E2E8F0; }
    .btn { padding: 8px 16px; border-radius: 8px; font-size: 13px; font-weight: 600; cursor: pointer; border: none; }
    .btn-primary { background: #0D9488; color: #fff; }
  `]
})
export class Gantt {}
