import { Component, OnInit, inject, computed, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink, ActivatedRoute } from '@angular/router';
import { ApiService } from '../../../services/api';
import { AuthService } from '../../../services/auth';
import { Task, Project } from '../../../models';

@Component({
  selector: 'app-tasks',
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './tasks.html',
  styleUrl: './tasks.scss'
})
export class Tasks implements OnInit {
  private auth  = inject(AuthService);
  private cdr   = inject(ChangeDetectorRef);
  private route = inject(ActivatedRoute);

  // ── Role helpers ───────────────────────────────────────────────────────────
  readonly isEmployee    = computed(() => this.auth.isEmployee());
  readonly canMutateTasks = computed(() => true);

  tasks: Task[] = [];
  projects: Project[] = [];
  loading = true;
  filterProjectId = '';
  expandedTasks = new Set<string>();

  constructor(private api: ApiService) {}

  ngOnInit() {
    // Read optional ?project=<uuid> query param from All Projects "Tasks" button
    const projectParam = this.route.snapshot.queryParamMap.get('project');
    if (projectParam) {
      this.filterProjectId = projectParam;
    }

    this.api.getProjects().subscribe({
      next: p => { this.projects = p; this.cdr.detectChanges(); },
      error: () => {}
    });
    this.loadTasks();
  }

  loadTasks() {
    this.loading = true;
    this.api.getTasks(this.filterProjectId || undefined).subscribe({
      next: t => { this.tasks = t.filter(x => !x.parent_task_id); this.loading = false; this.cdr.detectChanges(); },
      error: () => { this.loading = false; this.cdr.detectChanges(); }
    });
  }

  toggleExpand(taskId: string) {
    if (this.expandedTasks.has(taskId)) {
      this.expandedTasks.delete(taskId);
    } else {
      this.expandedTasks.add(taskId);
    }
  }

  isExpanded(taskId: string): boolean {
    return this.expandedTasks.has(taskId);
  }

  priorityClass(p: string): string {
    const m: Record<string, string> = { critical: 'badge-red', high: 'badge-orange', medium: 'badge-blue', low: 'badge-gray' };
    return m[p] ?? 'badge-gray';
  }

  statusClass(s: string): string {
    const m: Record<string, string> = { done: 'badge-green', in_progress: 'badge-blue', blocked: 'badge-red', in_review: 'badge-purple', todo: 'badge-gray' };
    return m[s] ?? 'badge-gray';
  }

  getProjectName(id: string): string {
    return this.projects.find(p => p.id === id)?.name ?? id;
  }
}
