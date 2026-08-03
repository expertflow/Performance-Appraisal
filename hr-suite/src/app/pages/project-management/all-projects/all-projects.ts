import { Component, inject, computed } from '@angular/core';
import { AuthService } from '../../../services/auth';

@Component({
  selector: 'app-all-projects',
  standalone: true,
  template: `
    <div class="page-header">
      <div>
        <h1>All Projects</h1>
        <p>{{ isEmployee() ? 'Browse projects you are assigned to' : 'Browse and manage all active projects' }}</p>
      </div>
      @if (canMutate()) {
        <button class="btn btn-primary">+ New Project</button>
      }
    </div>
    <div class="card" style="padding: 48px; text-align: center; color: var(--color-text-secondary);">
      <div style="font-size: 48px; margin-bottom: 16px;">📁</div>
      <h3>All Projects</h3>
      <p>Full project list coming soon.</p>
      @if (isEmployee()) {
        <p style="font-size:12px;margin-top:8px;color:var(--color-text-muted);">
          You have read-only access to projects.
        </p>
      }
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
export class AllProjects {
  private auth = inject(AuthService);

  readonly isEmployee = computed(() => this.auth.isEmployee());
  readonly canMutate  = computed(() => this.auth.canMutateProjects());
}
