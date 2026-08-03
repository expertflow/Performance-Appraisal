import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { ApiService } from '../../../services/api';
import { Task, Project } from '../../../models';

@Component({
  selector: 'app-tasks',
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './tasks.html',
  styleUrl: './tasks.scss'
})
export class Tasks implements OnInit {
  tasks: Task[] = [];
  projects: Project[] = [];
  loading = true;
  filterProjectId = '';
  expandedTasks = new Set<string>();

  constructor(private api: ApiService) {}

  ngOnInit() {
    this.api.getProjects().subscribe({ next: p => this.projects = p, error: () => {} });
    this.loadTasks();
  }

  loadTasks() {
    this.loading = true;
    this.api.getTasks(this.filterProjectId || undefined).subscribe({
      next: t => { this.tasks = t.filter(x => !x.parent_task_id); this.loading = false; },
      error: () => { this.loading = false; }
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
