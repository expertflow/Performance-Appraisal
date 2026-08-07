import { Component, OnInit, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { CommonModule } from '@angular/common';
import { ApiService } from '../../../services/api';
import { AuthService } from '../../../services/auth';
import { forkJoin } from 'rxjs';

interface ActivityItem {
  icon: string;
  text: string;
  sub: string;
  time: string;
}

@Component({
  selector: 'app-projects-dashboard',
  standalone: true,
  imports: [RouterLink, CommonModule],
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
      <!-- Active Projects: all roles see real count -->
      <div class="stat-card">
        <div class="stat-label">Active Projects</div>
        <div class="stat-value">
          @if (loading()) { <span style="font-size:16px;color:var(--color-text-secondary);">…</span> }
          @else { {{ activeProjectCount() }} }
        </div>
        <div class="stat-sub">{{ activeProjectCount() === 1 ? '1 project' : activeProjectCount() + ' projects' }} active</div>
      </div>

      <!-- Open Tasks: AppAdmin/HR = all; Manager/Employee = own tasks only -->
      <div class="stat-card">
        <div class="stat-label">Open Tasks</div>
        <div class="stat-value">
          @if (loading()) { <span style="font-size:16px;color:var(--color-text-secondary);">…</span> }
          @else { {{ openTaskCount() }} }
        </div>
        <div class="stat-sub">
          @if (isAdminOrHR()) { Across all projects }
          @else { Assigned to or created by you }
        </div>
      </div>

      <!-- Hours Logged: all roles see only their own hours this month -->
      <div class="stat-card">
        <div class="stat-label">Hours Logged</div>
        <div class="stat-value">
          @if (loading()) { <span style="font-size:16px;color:var(--color-text-secondary);">…</span> }
          @else { {{ hoursLogged() }} }
        </div>
        <div class="stat-sub">Your hours this month</div>
      </div>

      <!-- On Schedule: derived from active projects -->
      <div class="stat-card">
        <div class="stat-label">On Schedule</div>
        <div class="stat-value" style="color:var(--color-green);">
          @if (loading()) { <span style="font-size:16px;color:var(--color-text-secondary);">…</span> }
          @else { {{ onSchedulePct() }}% }
        </div>
        <div class="stat-sub">{{ onScheduleCount() }} of {{ activeProjectCount() }} projects</div>
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
        @if (loading()) {
          <div style="padding:32px;text-align:center;color:var(--color-text-muted);">
            <div class="spinner" style="width:28px;height:28px;border:3px solid var(--color-border);border-top-color:var(--color-primary);border-radius:50%;animation:spin .8s linear infinite;margin:0 auto 8px;"></div>
            <p style="font-size:13px;">Loading activity…</p>
          </div>
        } @else if (recentActivity().length === 0) {
          <div style="padding:40px;text-align:center;color:var(--color-text-muted);">
            <div style="font-size:32px;margin-bottom:8px;">📋</div>
            <p style="font-size:13px;">No recent activity yet.</p>
          </div>
        } @else {
          <div style="display:flex;flex-direction:column;gap:0;">
            @for (item of recentActivity(); track item.text + item.time) {
              <div style="display:flex;align-items:flex-start;gap:12px;padding:10px 0;border-bottom:1px solid var(--color-border);">
                <div style="width:32px;height:32px;border-radius:50%;background:var(--color-bg-secondary,#f0f4ff);display:flex;align-items:center;justify-content:center;font-size:15px;flex-shrink:0;">
                  {{ item.icon }}
                </div>
                <div style="flex:1;min-width:0;">
                  <div style="font-size:13px;font-weight:500;color:var(--color-text);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">{{ item.text }}</div>
                  <div style="font-size:11px;color:var(--color-text-secondary);margin-top:2px;">{{ item.sub }}</div>
                </div>
                <div style="font-size:11px;color:var(--color-text-muted);white-space:nowrap;flex-shrink:0;">{{ item.time }}</div>
              </div>
            }
          </div>
        }
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
export class ProjectsDashboard implements OnInit {
  private api  = inject(ApiService);
  private auth = inject(AuthService);

  loading            = signal(true);
  activeProjectCount = signal(0);
  openTaskCount      = signal(0);
  hoursLogged        = signal(0);
  onScheduleCount    = signal(0);
  onSchedulePct      = signal(0);
  recentActivity     = signal<ActivityItem[]>([]);

  isAdminOrHR(): boolean {
    return this.auth.hasRole('AppAdmin', 'HR');
  }

  ngOnInit(): void {
    const employeeId = this.auth.employeeId;
    const now        = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
    const monthEnd   = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().slice(0, 10);

    // Fetch projects + tasks + my time entries in parallel
    forkJoin({
      projects:    this.api.getProjects(),
      tasks:       this.api.getTasks(),
      timeEntries: this.api.getTimeEntries({
        employee_id: employeeId,
        date_from:   monthStart,
        date_to:     monthEnd
      })
    }).subscribe({
      next: ({ projects, tasks, timeEntries }) => {
        // ── Active Projects (all roles: real count) ──────────────────────────
        const active = projects.filter(p =>
          (p.status || '').toLowerCase() === 'active'
        );
        this.activeProjectCount.set(active.length);

        // On Schedule = projects with health_status 'on_track' or no health flag
        const onTrack = active.filter(p =>
          !p.health_status || p.health_status === 'on_track'
        );
        this.onScheduleCount.set(onTrack.length);
        this.onSchedulePct.set(
          active.length > 0 ? Math.round((onTrack.length / active.length) * 100) : 0
        );

        // ── Open Tasks (role-based) ──────────────────────────────────────────
        // Open = not done/completed
        const openTasks = tasks.filter(t =>
          t.status !== 'done' && (t as any).status !== 'completed'
        );

        if (this.isAdminOrHR()) {
          // AppAdmin & HR: count ALL open tasks
          this.openTaskCount.set(openTasks.length);
        } else {
          // Manager & Employee: only tasks assigned to them OR created by them
          // The backend returns assigned_employee_id and created_by as extra fields
          const myTasks = openTasks.filter(t => {
            const task = t as any;
            const assignedToMe = task.assigned_employee_id === employeeId;
            const createdByMe  = task.created_by === employeeId;
            // Also check assignees array if present
            const inAssignees  = Array.isArray(t.assignees) &&
              t.assignees.some((a: any) => a.id === employeeId);
            return assignedToMe || createdByMe || inAssignees;
          });
          this.openTaskCount.set(myTasks.length);
        }

        // ── Hours Logged (all roles: own hours this month only) ──────────────
        const totalHours = timeEntries.reduce((sum, e) => {
          const h = typeof e.hours_worked === 'number'
            ? e.hours_worked
            : parseFloat(String(e.hours_worked) || '0');
          return sum + (isNaN(h) ? 0 : h);
        }, 0);
        this.hoursLogged.set(Math.round(totalHours * 10) / 10);

        // ── Recent Activity feed ─────────────────────────────────────────────
        const activity: ActivityItem[] = [];

        // Time entries → activity items
        const sortedEntries = [...timeEntries]
          .sort((a, b) => new Date(b.start_datetime ?? 0).getTime() - new Date(a.start_datetime ?? 0).getTime())
          .slice(0, 5);
        sortedEntries.forEach(e => {
          const h = typeof e.hours_worked === 'number'
            ? e.hours_worked
            : parseFloat(String(e.hours_worked) || '0');
          const hrs = isNaN(h) ? 0 : Math.round(h * 10) / 10;
          const proj = projects.find(p => p.id === e.project_id);
          activity.push({
            icon: '⏱️',
            text: `Logged ${hrs}h${proj ? ' on ' + proj.name : ''}`,
            sub:  e.description ? e.description.slice(0, 60) : 'Time entry',
            time: e.start_datetime ? this.relativeTime(e.start_datetime) : '',
          });
        });

        // Recent tasks (last updated / created) → activity items
        const recentTasks = [...tasks]
          .sort((a, b) => {
            const da = (a as any).updated_at || (a as any).created_at || '';
            const db = (b as any).updated_at || (b as any).created_at || '';
            return new Date(db).getTime() - new Date(da).getTime();
          })
          .slice(0, 5);
        recentTasks.forEach(t => {
          const statusIcon = t.status === 'done' ? '✅' : t.status === 'in_progress' ? '🔄' : '📋';
          const dateStr = (t as any).updated_at || (t as any).created_at || '';
          activity.push({
            icon: statusIcon,
            text: t.title || 'Task',
            sub:  `Status: ${t.status ?? 'open'}`,
            time: dateStr ? this.relativeTime(dateStr) : '',
          });
        });

        // Sort combined activity by recency (items with no time go last)
        activity.sort((a, b) => {
          if (!a.time && !b.time) return 0;
          if (!a.time) return 1;
          if (!b.time) return -1;
          return 0; // already sorted by source
        });

        this.recentActivity.set(activity.slice(0, 10));
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
      }
    });
  }

  private relativeTime(dateStr: string): string {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins  = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days  = Math.floor(diff / 86400000);
    if (mins < 1)   return 'just now';
    if (mins < 60)  return `${mins}m ago`;
    if (hours < 24) return `${hours}h ago`;
    if (days < 7)   return `${days}d ago`;
    return new Date(dateStr).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
  }
}
