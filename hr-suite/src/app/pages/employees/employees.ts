import { Component, OnInit, inject, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../services/api';
import { SearchService } from '../../services/search';

/**
 * Exact Directus Employee fields from screenshot:
 * id, email, EmployStartDate, MobileNumber, status, EmployeeName,
 * RegionCode, DefaultProjectId, ManagerId, PhoneNo, Seniority,
 * Department, Designation
 */
interface EmployeeRecord {
  id: string;
  first_name: string;
  last_name: string;
  email?: string;
  status?: string;
  region_code?: string;
  default_project_id?: string;
  mobile_number?: string;
  phone_no?: string;
  employ_start_date?: string;
  department?: string;
  designation?: string;
  manager_id?: string;
  seniority?: string;
  country?: string;
  legal_entity_id?: string;
  synced_at?: string;
}

@Component({
  selector: 'app-employees',
  imports: [CommonModule, FormsModule],
  templateUrl: './employees.html',
  styleUrl: './employees.scss'
})
export class Employees implements OnInit {
  private api    = inject(ApiService);
  private cdr    = inject(ChangeDetectorRef);
  private search = inject(SearchService);

  employees: EmployeeRecord[] = [];
  loading = true;
  syncing = false;
  syncMessage = '';
  filterStatus = '';

  // Detail modal
  showDetail = false;
  selectedEmployee: EmployeeRecord | null = null;

  get statuses(): string[] {
    const statuses = this.employees
      .map(e => e.status || '')
      .filter(s => !!s);
    return [...new Set(statuses)].sort();
  }

  get filtered(): EmployeeRecord[] {
    const q = this.search.query().toLowerCase().trim();
    return this.employees.filter(e => {
      if (this.filterStatus && e.status !== this.filterStatus) return false;
      if (q) {
        const fullName = `${e.first_name} ${e.last_name}`.toLowerCase();
        const email    = (e.email || '').toLowerCase();
        const dept     = (e.department || '').toLowerCase();
        const desig    = (e.designation || '').toLowerCase();
        const region   = (e.region_code || '').toLowerCase();
        const mobile   = (e.mobile_number || '').toLowerCase();
        if (!fullName.includes(q) && !email.includes(q) && !dept.includes(q) &&
            !desig.includes(q) && !region.includes(q) && !mobile.includes(q)) return false;
      }
      return true;
    });
  }

  ngOnInit() {
    this.load();
  }

  load() {
    this.loading = true;
    this.api.getEmployees().subscribe({
      next: (emps: any[]) => {
        this.employees = emps;
        this.loading = false;
        this.cdr.detectChanges();
      },
      error: () => { this.loading = false; this.cdr.detectChanges(); }
    });
  }

  syncFromDirectus() {
    this.syncing = true;
    this.syncMessage = '';
    this.api.syncEmployees().subscribe({
      next: (res: any) => {
        this.syncing = false;
        this.syncMessage = res.message || `Synced ${res.count ?? ''} employees.`;
        this.load();
        setTimeout(() => { this.syncMessage = ''; this.cdr.detectChanges(); }, 4000);
      },
      error: (err: any) => {
        this.syncing = false;
        this.syncMessage = err?.error?.error || 'Sync failed.';
        this.cdr.detectChanges();
        setTimeout(() => { this.syncMessage = ''; this.cdr.detectChanges(); }, 4000);
      }
    });
  }

  openDetail(emp: EmployeeRecord) {
    this.selectedEmployee = emp;
    this.showDetail = true;
    this.cdr.detectChanges();
  }

  closeDetail() {
    this.showDetail = false;
    this.selectedEmployee = null;
    this.cdr.detectChanges();
  }

  initials(emp: EmployeeRecord): string {
    return `${emp.first_name?.[0] ?? ''}${emp.last_name?.[0] ?? ''}`.toUpperCase();
  }

  statusClass(s?: string): string {
    if (!s) return 'badge-gray';
    const sl = s.toLowerCase();
    if (sl === 'employed' || sl === 'active') return 'badge-green';
    if (sl === 'resigned' || sl === 'terminated') return 'badge-red';
    if (sl === 'former employee') return 'badge-orange';
    return 'badge-gray';
  }

  formatDate(d?: string): string {
    if (!d) return '—';
    try { return new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }); }
    catch { return d; }
  }

  seniorityLabel(s?: string): string {
    if (!s) return '—';
    try {
      const parsed = JSON.parse(s);
      return parsed?.Name || parsed?.name || s;
    } catch {
      return s;
    }
  }

  managerLabel(managerId?: string): string {
    if (!managerId) return '—';
    const mgr = this.employees.find(e => e.id === managerId);
    return mgr ? `${mgr.first_name} ${mgr.last_name}` : managerId;
  }
}
