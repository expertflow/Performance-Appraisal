import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { ApiService } from '../../../services/api';
import { Task, Project } from '../../../models';

type KanbanStatus = 'todo' | 'in_progress' | 'in_review' | 'blocked' | 'done';

@Component({
  selector: 'app-kanban',
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './kanban.html',
  styleUrl: './kanban.scss'
})
export class Kanban implements OnInit {
  tasks: Task[] = [];
  projects: Project[] = [];
  loading = true;
  filterProjectId = '';

  columns: { id: KanbanStatus; label: string; color: string }[] = [
    { id: 'todo', label: 'To Do', color: '#64748B' },
    { id: 'in_progress', label: 'In Progress', color: '#0066CC' },
    { id: 'in_review', label: 'In Review', color: '#5B21B6' },
    { id: 'blocked', label: 'Blocked', color: '#DC2626' },
    { id: 'done', label: 'Done', color: '#059669' }
  ];

  constructor(private api: ApiService) {}

  ngOnInit() {
    this.api.getProjects().subscribe({ next: p => this.projects = p, error: () => {} });
    this.loadTasks();
  }

  loadTasks() {
    this.loading = true;
    this.api.getTasks(this.filterProjectId || undefined).subscribe({
      next: t => { this.tasks = t; this.loading = false; },
      error: () => { this.loading = false; }
    });
  }

  getColumnTasks(status: KanbanStatus): Task[] {
    return this.tasks.filter(t => t.status === status && !t.parent_task_id);
  }

  priorityClass(p: string): string {
    const m: Record<string, string> = { critical: 'badge-red', high: 'badge-orange', medium: 'badge-blue', low: 'badge-gray' };
    return m[p] ?? 'badge-gray';
  }

  getProjectName(id: string): string {
    return this.projects.find(p => p.id === id)?.name ?? '';
  }
}
