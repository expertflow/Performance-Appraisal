import { Component, inject, computed } from '@angular/core';
// settings page
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../services/auth';

interface ProjectTimeEntry {
  projectId: string;
  projectName: string;
  color: string;
  totalHours: number;
  entryCount: number;
}

@Component({
  selector: 'app-settings',
  imports: [CommonModule, RouterLink],
  templateUrl: './settings.html',
  styleUrl: './settings.scss'
})
export class Settings {
  private auth = inject(AuthService);

  readonly user = computed(() => this.auth.currentUser());

  get userInitials(): string {
    const name = this.user()?.name ?? '';
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  }

  get roleLabel(): string {
    const r = this.user()?.role;
    if (r === 'AppAdmin') return 'App Administrator';
    if (r === 'HR')       return 'HR Manager';
    if (r === 'Manager')  return 'Team Manager';
    if (r === 'Employee') return 'Employee';
    return r ?? '';
  }

  get department(): string {
    // In production this would come from the employee record
    const emp = this.user()?.employee_id;
    if (!emp) return '—';
    // Mock department mapping
    const deptMap: Record<string, string> = {
      'emp-zaeem':  'Engineering',
      'emp-001':    'Engineering',
      'emp-002':    'Product',
      'emp-003':    'Design',
      'emp-004':    'Marketing',
      'emp-005':    'Sales',
    };
    return deptMap[emp] ?? 'Engineering';
  }

  get designation(): string {
    const emp = this.user()?.employee_id;
    if (!emp) return '—';
    const desigMap: Record<string, string> = {
      'emp-zaeem':  'Senior Software Engineer',
      'emp-001':    'Software Engineer',
      'emp-002':    'Product Manager',
      'emp-003':    'UX Designer',
      'emp-004':    'Marketing Specialist',
      'emp-005':    'Sales Executive',
    };
    return desigMap[emp] ?? 'Software Engineer';
  }

  // Mock time entries per project for the current user
  readonly projectTimeEntries: ProjectTimeEntry[] = [
    { projectId: 'p1', projectName: 'EF Internal Tools',    color: '#0066CC', totalHours: 42.5,  entryCount: 18 },
    { projectId: 'p2', projectName: 'Customer Portal v2',   color: '#059669', totalHours: 28.0,  entryCount: 12 },
    { projectId: 'p3', projectName: 'HR Suite Redesign',    color: '#D97706', totalHours: 15.75, entryCount:  7 },
    { projectId: 'p4', projectName: 'API Gateway Migration', color: '#7C3AED', totalHours:  8.25, entryCount:  4 },
    { projectId: 'p5', projectName: 'DevOps Automation',    color: '#DC2626', totalHours:  5.0,  entryCount:  3 },
  ];

  get totalHours(): number {
    return this.projectTimeEntries.reduce((s, e) => s + e.totalHours, 0);
  }

  get totalEntries(): number {
    return this.projectTimeEntries.reduce((s, e) => s + e.entryCount, 0);
  }

  barWidth(hours: number): number {
    const max = Math.max(...this.projectTimeEntries.map(e => e.totalHours));
    return max > 0 ? Math.round((hours / max) * 100) : 0;
  }
}
