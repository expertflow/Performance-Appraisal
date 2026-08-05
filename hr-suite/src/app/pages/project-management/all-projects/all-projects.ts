'use strict';
import { Component, inject, ChangeDetectorRef, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { ApiService } from '../../../services/api';
import { Project } from '../../../models';

@Component({
  selector: 'app-all-projects',
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './all-projects.html',
  styleUrl: './all-projects.scss'
})
export class AllProjects implements OnInit {
  private api = inject(ApiService);
  private cdr = inject(ChangeDetectorRef);

  projects: Project[] = [];
  loading = true;

  // Filters
  filterStatus = '';
  searchText   = '';

  ngOnInit() { this.load(); }

  load() {
    this.loading = true;
    this.api.getProjects().subscribe({
      next: p => {
        if (p.length === 0) {
          // Auto-sync projects from Directus on first load
          this.api.syncProjects().subscribe({
            next: () => {
              this.api.getProjects().subscribe({
                next: p2 => {
                  this.projects = p2;
                  this.loading = false;
                  this.cdr.detectChanges();
                },
                error: () => { this.loading = false; this.cdr.detectChanges(); }
              });
            },
            error: () => {
              this.projects = p;
              this.loading = false;
              this.cdr.detectChanges();
            }
          });
        } else {
          this.projects = p;
          this.loading = false;
          this.cdr.detectChanges();
        }
      },
      error: () => { this.loading = false; this.cdr.detectChanges(); }
    });
  }

  get filtered(): Project[] {
    return this.projects.filter(p => {
      if (this.filterStatus && p.status !== this.filterStatus) return false;
      if (this.searchText   && !p.name.toLowerCase().includes(this.searchText.toLowerCase())) return false;
      return true;
    });
  }

  statusClass(s: string): string {
    const m: Record<string, string> = {
      active: 'badge-green', on_hold: 'badge-orange',
      completed: 'badge-blue', cancelled: 'badge-red'
    };
    return m[s] ?? 'badge-gray';
  }
}
