import { Component, OnInit, inject, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../../services/api';
import { Project, Task } from '../../../models';

interface GanttRow {
  id: string;
  label: string;
  type: 'project' | 'task';
  projectId?: string;
  start: Date | null;
  end: Date | null;
  status: string;
  priority?: string;
  collapsed?: boolean;
}

@Component({
  selector: 'app-gantt',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="page-header">
      <div>
        <h1>Gantt Chart</h1>
        <p>Project timeline view</p>
      </div>
      <div class="flex gap-2" style="align-items:center;">
        <select class="form-control" style="width:180px;" title="Filter project" [(ngModel)]="filterProjectId" (change)="applyFilter()">
          <option value="">All Projects</option>
          @for (p of projects; track p.id) {
            <option [value]="p.id">{{ p.name }}</option>
          }
        </select>
        <div class="flex gap-2" style="align-items:center;font-size:13px;color:var(--color-text-secondary);">
          <button class="btn btn-secondary btn-sm" (click)="shiftView(-1)">‹ Prev</button>
          <span style="min-width:120px;text-align:center;font-weight:600;">{{ monthLabel }}</span>
          <button class="btn btn-secondary btn-sm" (click)="shiftView(1)">Next ›</button>
        </div>
        <button class="btn btn-secondary btn-sm" (click)="resetView()">Today</button>
      </div>
    </div>

    @if (loading) {
      <div class="flex items-center gap-2"><div class="spinner"></div><span class="text-muted">Loading…</span></div>
    } @else if (visibleRows.length === 0) {
      <div class="card" style="padding:48px;text-align:center;color:var(--color-text-secondary);">
        <div style="font-size:48px;margin-bottom:16px;">📅</div>
        <h3>No projects with dates found</h3>
        <p>Add start and end dates to your projects and tasks to see them here.</p>
      </div>
    } @else {
      <div class="card" style="padding:0;overflow:hidden;">
        <div style="display:flex;overflow:hidden;">

          <!-- Left panel: row labels -->
          <div style="min-width:220px;max-width:220px;border-right:1px solid var(--color-border);flex-shrink:0;">
            <!-- Header -->
            <div style="height:48px;border-bottom:1px solid var(--color-border);display:flex;align-items:center;padding:0 12px;background:var(--color-bg-secondary);font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.05em;color:var(--color-text-secondary);">
              Project / Task
            </div>
            <!-- Rows -->
            @for (row of visibleRows; track row.id) {
              <div [style.height.px]="ROW_H"
                   [style.background]="row.type === 'project' ? 'var(--color-bg-secondary)' : 'var(--color-bg)'"
                   style="display:flex;align-items:center;padding:0 8px;border-bottom:1px solid var(--color-border);gap:6px;cursor:pointer;"
                   (click)="row.type === 'project' ? toggleProject(row.id) : null">
                @if (row.type === 'project') {
                  <span style="font-size:10px;color:var(--color-text-secondary);">
                    {{ isCollapsed(row.id) ? '▶' : '▼' }}
                  </span>
                  <span style="font-weight:700;font-size:12px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" [title]="row.label">
                    📁 {{ row.label }}
                  </span>
                } @else {
                  <span style="width:12px;flex-shrink:0;"></span>
                  <span class="badge" [class]="priorityClass(row.priority || '')" style="font-size:9px;padding:1px 4px;flex-shrink:0;">{{ row.priority }}</span>
                  <span style="font-size:12px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" [title]="row.label">{{ row.label }}</span>
                }
              </div>
            }
          </div>

          <!-- Right panel: timeline -->
          <div style="flex:1;overflow-x:auto;" #timelinePanel>
            <div [style.min-width.px]="totalWidth">
              <!-- Day headers -->
              <div style="height:48px;border-bottom:1px solid var(--color-border);display:flex;background:var(--color-bg-secondary);position:sticky;top:0;z-index:2;">
                @for (day of days; track day.iso) {
                  <div [style.width.px]="DAY_W"
                       [style.background]="day.isToday ? '#EFF6FF' : day.isWeekend ? '#F8FAFC' : 'var(--color-bg-secondary)'"
                       style="border-right:1px solid var(--color-border);flex-shrink:0;display:flex;flex-direction:column;align-items:center;justify-content:center;">
                    <div style="font-size:9px;color:var(--color-text-secondary);text-transform:uppercase;">{{ day.dayName }}</div>
                    <div [style.font-weight]="day.isToday ? '700' : '400'"
                         [style.color]="day.isToday ? 'var(--color-teal)' : 'var(--color-text-primary)'"
                         style="font-size:11px;">{{ day.dayNum }}</div>
                  </div>
                }
              </div>

              <!-- Gantt rows -->
              @for (row of visibleRows; track row.id) {
                <div [style.height.px]="ROW_H"
                     [style.width.px]="totalWidth"
                     [style.background]="row.type === 'project' ? 'var(--color-bg-secondary)' : 'var(--color-bg)'"
                     style="position:relative;border-bottom:1px solid var(--color-border);">

                  <!-- Weekend shading -->
                  @for (day of days; track day.iso) {
                    @if (day.isWeekend) {
                      <div [style.left.px]="day.index * DAY_W"
                           [style.width.px]="DAY_W"
                           style="position:absolute;top:0;bottom:0;background:rgba(0,0,0,.025);pointer-events:none;"></div>
                    }
                  }

                  <!-- Today line -->
                  @if (todayOffset >= 0) {
                    <div [style.left.px]="todayOffset"
                         style="position:absolute;top:0;bottom:0;width:2px;background:var(--color-teal);opacity:.5;pointer-events:none;z-index:1;"></div>
                  }

                  <!-- Bar -->
                  @if (getBar(row); as bar) {
                    <div [style.left.px]="bar.left"
                         [style.width.px]="bar.width"
                         [style.top.px]="row.type === 'project' ? 10 : 12"
                         [style.height.px]="row.type === 'project' ? ROW_H - 20 : ROW_H - 24"
                         [style.background]="bar.color"
                         [style.border-radius.px]="4"
                         [title]="row.label + ': ' + formatDate(row.start) + ' → ' + formatDate(row.end)"
                         style="position:absolute;display:flex;align-items:center;padding:0 6px;overflow:hidden;cursor:default;box-shadow:0 1px 3px rgba(0,0,0,.15);">
                      <span style="font-size:10px;color:#fff;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;font-weight:600;">
                        {{ row.label }}
                      </span>
                    </div>
                  }
                </div>
              }
            </div>
          </div>
        </div>

        <!-- Legend -->
        <div style="padding:12px 16px;border-top:1px solid var(--color-border);display:flex;gap:16px;flex-wrap:wrap;font-size:11px;color:var(--color-text-secondary);">
          <span style="display:flex;align-items:center;gap:4px;"><span style="width:12px;height:12px;border-radius:2px;background:#0066CC;display:inline-block;"></span> Active Project</span>
          <span style="display:flex;align-items:center;gap:4px;"><span style="width:12px;height:12px;border-radius:2px;background:#64748B;display:inline-block;"></span> On Hold</span>
          <span style="display:flex;align-items:center;gap:4px;"><span style="width:12px;height:12px;border-radius:2px;background:#059669;display:inline-block;"></span> Completed</span>
          <span style="display:flex;align-items:center;gap:4px;"><span style="width:12px;height:12px;border-radius:2px;background:#F59E0B;display:inline-block;"></span> Task (todo/in progress)</span>
          <span style="display:flex;align-items:center;gap:4px;"><span style="width:12px;height:12px;border-radius:2px;background:#DC2626;display:inline-block;"></span> Task (blocked)</span>
          <span style="display:flex;align-items:center;gap:4px;"><span style="width:12px;height:12px;border-radius:2px;background:#94A3B8;display:inline-block;"></span> Task (done)</span>
          <span style="margin-left:auto;">Click project row to expand/collapse tasks</span>
        </div>
      </div>
    }
  `,
  styles: [`
    .page-header { display:flex;align-items:flex-start;justify-content:space-between;margin-bottom:24px;flex-wrap:wrap;gap:12px; }
    .page-header h1 { font-size:24px;font-weight:700;color:#1E293B;margin:0 0 4px; }
    .page-header p { color:#64748B;font-size:14px;margin:0; }
    .card { background:#fff;border-radius:12px;border:1px solid #E2E8F0; }
    .flex { display:flex; }
    .gap-2 { gap:8px; }
    .items-center { align-items:center; }
    .text-muted { color:var(--color-text-secondary);font-size:13px; }
    .spinner { width:20px;height:20px;border:2px solid #e2e8f0;border-top-color:#0066CC;border-radius:50%;animation:spin .7s linear infinite; }
    @keyframes spin { to { transform:rotate(360deg); } }
  `]
})
export class Gantt implements OnInit {
  private api = inject(ApiService);
  private cdr = inject(ChangeDetectorRef);

  readonly ROW_H = 40;
  readonly DAY_W = 28;

  loading = true;
  projects: Project[] = [];
  tasks: Task[] = [];
  filterProjectId = '';

  // View window
  viewStart!: Date;
  viewDays = 60; // show 60 days

  collapsedProjects = new Set<string>();
  allRows: GanttRow[] = [];

  get days(): { iso: string; dayName: string; dayNum: string; isToday: boolean; isWeekend: boolean; index: number }[] {
    const result = [];
    const today = new Date(); today.setHours(0,0,0,0);
    for (let i = 0; i < this.viewDays; i++) {
      const d = new Date(this.viewStart);
      d.setDate(d.getDate() + i);
      const dow = d.getDay();
      result.push({
        iso: d.toISOString().slice(0,10),
        dayName: ['Su','Mo','Tu','We','Th','Fr','Sa'][dow],
        dayNum: String(d.getDate()),
        isToday: d.getTime() === today.getTime(),
        isWeekend: dow === 0 || dow === 6,
        index: i
      });
    }
    return result;
  }

  get totalWidth(): number { return this.viewDays * this.DAY_W; }

  get monthLabel(): string {
    const end = new Date(this.viewStart);
    end.setDate(end.getDate() + this.viewDays - 1);
    const s = this.viewStart;
    if (s.getMonth() === end.getMonth()) {
      return s.toLocaleString('default', { month: 'long', year: 'numeric' });
    }
    return `${s.toLocaleString('default', { month: 'short' })} – ${end.toLocaleString('default', { month: 'short', year: 'numeric' })}`;
  }

  get todayOffset(): number {
    const today = new Date(); today.setHours(0,0,0,0);
    const diff = Math.floor((today.getTime() - this.viewStart.getTime()) / 86400000);
    if (diff < 0 || diff >= this.viewDays) return -1;
    return diff * this.DAY_W + this.DAY_W / 2;
  }

  get visibleRows(): GanttRow[] {
    return this.allRows.filter(r => {
      if (r.type === 'project') return true;
      return !this.collapsedProjects.has(r.projectId!);
    });
  }

  ngOnInit(): void {
    this.resetView();
    this.loadData();
  }

  resetView(): void {
    const today = new Date();
    today.setHours(0,0,0,0);
    today.setDate(today.getDate() - 7); // start 1 week before today
    this.viewStart = today;
  }

  shiftView(direction: number): void {
    const d = new Date(this.viewStart);
    d.setDate(d.getDate() + direction * 30);
    this.viewStart = d;
  }

  loadData(): void {
    this.loading = true;
    this.api.getProjects().subscribe({
      next: projects => {
        this.projects = projects;
        this.api.getTasks().subscribe({
          next: tasks => {
            this.tasks = tasks.filter(t => !t.parent_task_id);
            this.buildRows();
            this.loading = false;
            this.cdr.detectChanges();
          },
          error: () => { this.loading = false; this.cdr.detectChanges(); }
        });
      },
      error: () => { this.loading = false; this.cdr.detectChanges(); }
    });
  }

  applyFilter(): void {
    this.buildRows();
    this.cdr.detectChanges();
  }

  buildRows(): void {
    const rows: GanttRow[] = [];
    const filtered = this.filterProjectId
      ? this.projects.filter(p => p.id === this.filterProjectId)
      : this.projects;

    for (const p of filtered) {
      const pStart = p.start_date ? new Date(p.start_date) : null;
      const pEnd   = p.end_date   ? new Date(p.end_date)   : null;

      rows.push({
        id: p.id, label: p.name, type: 'project',
        start: pStart, end: pEnd, status: p.status
      });

      const pTasks = this.tasks.filter(t => t.project_id === p.id);
      for (const t of pTasks) {
        const tStart = (t as any).start_date ? new Date((t as any).start_date) : pStart;
        const tEnd   = t.due_date            ? new Date(t.due_date)            : pEnd;
        rows.push({
          id: t.id, label: t.title, type: 'task',
          projectId: p.id,
          start: tStart, end: tEnd,
          status: t.status, priority: t.priority
        });
      }
    }
    this.allRows = rows;
  }

  toggleProject(id: string): void {
    if (this.collapsedProjects.has(id)) {
      this.collapsedProjects.delete(id);
    } else {
      this.collapsedProjects.add(id);
    }
    this.cdr.detectChanges();
  }

  isCollapsed(id: string): boolean {
    return this.collapsedProjects.has(id);
  }

  getBar(row: GanttRow): { left: number; width: number; color: string } | null {
    if (!row.start || !row.end) return null;
    const viewEnd = new Date(this.viewStart);
    viewEnd.setDate(viewEnd.getDate() + this.viewDays);

    // Clamp to view window
    const barStart = row.start < this.viewStart ? this.viewStart : row.start;
    const barEnd   = row.end   > viewEnd        ? viewEnd        : row.end;
    if (barStart >= barEnd) return null;

    const left  = Math.floor((barStart.getTime() - this.viewStart.getTime()) / 86400000) * this.DAY_W;
    const width = Math.max(this.DAY_W, Math.ceil((barEnd.getTime() - barStart.getTime()) / 86400000) * this.DAY_W);

    const color = row.type === 'project'
      ? this.projectColor(row.status)
      : this.taskColor(row.status);

    return { left, width, color };
  }

  projectColor(status: string): string {
    const m: Record<string, string> = {
      active: '#0066CC', on_hold: '#64748B', completed: '#059669', cancelled: '#DC2626'
    };
    return m[status] ?? '#0066CC';
  }

  taskColor(status: string): string {
    const m: Record<string, string> = {
      todo: '#F59E0B', in_progress: '#0066CC', in_review: '#5B21B6',
      blocked: '#DC2626', done: '#94A3B8'
    };
    return m[status] ?? '#F59E0B';
  }

  priorityClass(p: string): string {
    const m: Record<string, string> = {
      critical: 'badge-red', high: 'badge-orange', medium: 'badge-blue', low: 'badge-gray'
    };
    return m[p] ?? 'badge-gray';
  }

  formatDate(d: Date | null): string {
    if (!d) return '—';
    return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  }
}
