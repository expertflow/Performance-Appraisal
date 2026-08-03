import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-projects-dashboard',
  imports: [RouterLink],
  template: `
    <div class="page-header">
      <div>
        <h1>Project Management</h1>
        <p>Overview of all active projects and tasks</p>
      </div>
      <div class="flex gap-2">
        <a routerLink="/projects/all" class="btn btn-secondary btn-sm">All Projects</a>
        <a routerLink="/kanban" class="btn btn-primary btn-sm">🗂️ Kanban Board</a>
      </div>
    </div>

    <div class="stat-grid" style="grid-template-columns: repeat(4, 1fr);">
      <div class="stat-card">
        <div class="stat-label">Active Projects</div>
        <div class="stat-value">12</div>
        <div class="stat-sub">3 at risk</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Open Tasks</div>
        <div class="stat-value">84</div>
        <div class="stat-sub">Across all projects</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Hours Logged</div>
        <div class="stat-value">1,240</div>
        <div class="stat-sub">This month</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">On Schedule</div>
        <div class="stat-value" style="color:var(--color-green);">75%</div>
        <div class="stat-sub">9 of 12 projects</div>
      </div>
    </div>

    <div class="grid-2" style="margin-top:20px;">
      <div class="card">
        <div class="card-header"><h3>Quick Navigation</h3></div>
        <div style="display:flex;flex-direction:column;gap:10px;">
          <a routerLink="/projects/all" class="quick-action-btn">
            <span style="font-size:20px;">📁</span>
            <div>
              <div style="font-weight:600;font-size:13px;">All Projects</div>
              <div style="font-size:11px;color:var(--color-text-secondary);">Browse and manage all projects</div>
            </div>
          </a>
          <a routerLink="/tasks" class="quick-action-btn">
            <span style="font-size:20px;">✅</span>
            <div>
              <div style="font-weight:600;font-size:13px;">Tasks</div>
              <div style="font-size:11px;color:var(--color-text-secondary);">View all tasks with subtasks</div>
            </div>
          </a>
          <a routerLink="/kanban" class="quick-action-btn">
            <span style="font-size:20px;">🗂️</span>
            <div>
              <div style="font-weight:600;font-size:13px;">Kanban Board</div>
              <div style="font-size:11px;color:var(--color-text-secondary);">Drag-and-drop task management</div>
            </div>
          </a>
          <a routerLink="/gantt" class="quick-action-btn">
            <span style="font-size:20px;">📅</span>
            <div>
              <div style="font-weight:600;font-size:13px;">Gantt Chart</div>
              <div style="font-size:11px;color:var(--color-text-secondary);">Project timeline view</div>
            </div>
          </a>
          <a routerLink="/timesheet" class="quick-action-btn">
            <span style="font-size:20px;">⏱️</span>
            <div>
              <div style="font-weight:600;font-size:13px;">Timesheet</div>
              <div style="font-size:11px;color:var(--color-text-secondary);">Log and manage time entries</div>
            </div>
          </a>
        </div>
      </div>
      <div class="card">
        <div class="card-header"><h3>Recent Activity</h3></div>
        <div style="padding:40px;text-align:center;color:var(--color-text-muted);">
          <div style="font-size:32px;margin-bottom:8px;">📊</div>
          <p>Activity feed coming soon.</p>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .quick-action-btn {
      display: flex; align-items: center; gap: 12px; padding: 12px;
      background: var(--color-bg); border: 1px solid var(--color-border);
      border-radius: var(--radius-md); cursor: pointer; transition: var(--transition);
      text-decoration: none; color: inherit; width: 100%; text-align: left;
    }
    .quick-action-btn:hover { border-color: var(--color-teal); background: #F0FDFA; }
  `]
})
export class ProjectsDashboard {}
