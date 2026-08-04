import { Component, inject, signal, OnInit } from '@angular/core';
import { RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import {
  RequisitionStoreService,
  JobRequisition,
  ReqStatus,
  ReqPriority,
  ReqType,
} from '../../../services/requisition-store';
import { JobStoreService, JobApplication } from '../../../services/job-store';
import { ApiService } from '../../../services/api';
import { Employee } from '../../../models';

const PAGE_SIZE = 5;

@Component({
  selector: 'app-requisitions',
  imports: [RouterLink, FormsModule, CommonModule],
  templateUrl: './requisitions.html',
  styleUrl: './requisitions.scss'
})
export class Requisitions implements OnInit {
  private store    = inject(RequisitionStoreService);
  private jobStore = inject(JobStoreService);
  private api      = inject(ApiService);

  // ── Employees (from Directus/BS4 via backend) ─────────────────────────────
  employees = signal<Employee[]>([]);
  employeesLoading = signal(false);

  // ── Filters ───────────────────────────────────────────────────────────────
  searchText     = '';
  filterDept     = 'All Departments';
  filterLocation = 'All Locations';
  filterPriority = 'All Priorities';

  // ── Pagination ────────────────────────────────────────────────────────────
  currentPage = signal(1);
  pageSize    = PAGE_SIZE;

  readonly allRequisitions = this.store.requisitions;
  readonly total           = this.store.total;
  readonly loading         = this.store.loading;

  // Applications from career portal (all, loaded once)
  readonly allApplications = this.jobStore.applications;

  get totalPages(): number {
    return Math.max(1, Math.ceil(this.total() / this.pageSize));
  }

  get pageNumbers(): number[] {
    return Array.from({ length: this.totalPages }, (_, i) => i + 1);
  }

  get filteredRequisitions(): JobRequisition[] {
    return this.allRequisitions().filter(r => {
      const matchSearch = !this.searchText ||
        r.title.toLowerCase().includes(this.searchText.toLowerCase()) ||
        r.reqNumber.toLowerCase().includes(this.searchText.toLowerCase());
      const matchDept     = this.filterDept     === 'All Departments' || r.department === this.filterDept;
      const matchLocation = this.filterLocation === 'All Locations'   || r.location.toLowerCase().includes(this.filterLocation.toLowerCase());
      const matchPriority = this.filterPriority === 'All Priorities'  || r.priority === this.filterPriority;
      return matchSearch && matchDept && matchLocation && matchPriority;
    });
  }

  /** Applications for a given job title (matched by title since requisitions don't have job_id) */
  applicationsForReq(req: JobRequisition): JobApplication[] {
    return this.allApplications().filter(a =>
      a.jobTitle.toLowerCase() === req.title.toLowerCase()
    );
  }

  // ── Lifecycle ─────────────────────────────────────────────────────────────
  ngOnInit(): void {
    this.loadPage(1);
    this.jobStore.reloadAllApplications();
    this.loadEmployees();
  }

  loadEmployees(): void {
    this.employeesLoading.set(true);
    this.api.getEmployees().subscribe({
      next: list => {
        this.employees.set(list);
        this.employeesLoading.set(false);
      },
      error: () => this.employeesLoading.set(false),
    });
  }

  employeeFullName(e: Employee): string {
    return `${e.first_name} ${e.last_name}`.trim();
  }

  loadPage(page: number): void {
    this.currentPage.set(page);
    this.store.load(page, this.pageSize);
  }

  prevPage(): void {
    if (this.currentPage() > 1) this.loadPage(this.currentPage() - 1);
  }

  nextPage(): void {
    if (this.currentPage() < this.totalPages) this.loadPage(this.currentPage() + 1);
  }

  goToPage(p: number): void {
    this.loadPage(p);
  }

  // ── Helpers ───────────────────────────────────────────────────────────────
  priorityClass(p: ReqPriority): string { return this.store.priorityClass(p); }
  statusClass(s: ReqStatus): string     { return this.store.statusClass(s); }

  exportToast = signal(false);
  exportData(): void {
    this.exportToast.set(true);
    setTimeout(() => this.exportToast.set(false), 3000);
  }

  // ── New Requisition Modal ─────────────────────────────────────────────────
  showNewModal  = signal(false);
  newReqSaving  = signal(false);
  newReqError   = signal('');
  newReqSuccess = signal(false);

  newReqForm = {
    title:          '',
    hiringManager:  '',
    department:     '',
    location:       '',
    type:           'Full-time' as ReqType,
    priority:       'Normal' as ReqPriority,
    headcount:      1,
    notes:          '',
  };

  openNewModal(): void {
    this.newReqForm = {
      title: '', hiringManager: '', department: '', location: '',
      type: 'Full-time', priority: 'Normal', headcount: 1, notes: '',
    };
    this.newReqError.set('');
    this.newReqSuccess.set(false);
    this.showNewModal.set(true);
  }

  closeNewModal(): void {
    this.showNewModal.set(false);
  }

  submitRequisition(): void {
    const f = this.newReqForm;
    if (!f.title.trim() || !f.hiringManager.trim() || !f.department.trim() || !f.location.trim()) {
      this.newReqError.set('Title, Hiring Manager, Department and Location are required.');
      return;
    }
    this.newReqSaving.set(true);
    this.newReqError.set('');

    this.store.create({
      title:         f.title.trim(),
      department:    f.department.trim(),
      location:      f.location.trim(),
      type:          f.type,
      priority:      f.priority,
      headcount:     f.headcount,
      status:        'Pending Approval' as ReqStatus,
      hiringManager: f.hiringManager.trim(),
      notes:         f.notes.trim(),
    }).subscribe({
      next: () => {
        this.newReqSaving.set(false);
        this.newReqSuccess.set(true);
        setTimeout(() => this.closeNewModal(), 1200);
      },
      error: err => {
        this.newReqSaving.set(false);
        this.newReqError.set(err?.error?.error || 'Failed to create requisition. Please try again.');
      }
    });
  }
}
