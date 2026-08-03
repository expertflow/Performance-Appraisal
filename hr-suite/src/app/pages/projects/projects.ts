import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { ApiService } from '../../services/api';
import { Project } from '../../models';

@Component({
  selector: 'app-projects',
  imports: [CommonModule, RouterLink],
  templateUrl: './projects.html',
  styleUrl: './projects.scss'
})
export class Projects implements OnInit {
  projects: Project[] = [];
  loading = true;

  constructor(private api: ApiService) {}

  ngOnInit() {
    this.api.getProjects().subscribe({
      next: p => { this.projects = p; this.loading = false; },
      error: () => { this.loading = false; }
    });
  }

  statusClass(status: string): string {
    const map: Record<string, string> = {
      active: 'badge-green', on_hold: 'badge-orange',
      completed: 'badge-blue', cancelled: 'badge-red'
    };
    return map[status] ?? 'badge-gray';
  }

  healthClass(h?: string): string {
    if (h === 'on_track') return 'badge-green';
    if (h === 'at_risk') return 'badge-orange';
    if (h === 'off_track') return 'badge-red';
    return 'badge-gray';
  }
}
