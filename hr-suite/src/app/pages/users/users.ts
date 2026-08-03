import { Component, inject, computed, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../services/auth';
import { AppRole } from '../../models';

export interface AppUserRecord {
  id: string;
  name: string;
  email: string;
  role: AppRole;
  department: string;
  designation: string;
  employee_id: string;
  status: 'Active' | 'Inactive';
  lastLogin: string;
}

@Component({
  selector: 'app-users',
  imports: [CommonModule, FormsModule],
  templateUrl: './users.html',
  styleUrl: './users.scss'
})
export class Users {
  private auth = inject(AuthService);

  readonly isAppAdmin = computed(() => this.auth.isAppAdmin());

  // ── Mock user data ────────────────────────────────────────────────────────
  allUsers = signal<AppUserRecord[]>([
    {
      id: 'u-zaeem',
      name: 'Zaeem Ahmad',
      email: 'zaeem.ahmad@expertflow.com',
      role: 'AppAdmin',
      department: 'Engineering',
      designation: 'Senior Software Engineer',
      employee_id: 'emp-zaeem',
      status: 'Active',
      lastLogin: '2 minutes ago',
    },
    {
      id: 'u-sara',
      name: 'Sara Ahmed',
      email: 'sara.ahmed@expertflow.com',
      role: 'HR',
      department: 'Human Resources',
      designation: 'HR Manager',
      employee_id: 'emp-002',
      status: 'Active',
      lastLogin: '1 hour ago',
    },
    {
      id: 'u-ali',
      name: 'Ali Hassan',
      email: 'ali.hassan@expertflow.com',
      role: 'Manager',
      department: 'Engineering',
      designation: 'Engineering Manager',
      employee_id: 'emp-003',
      status: 'Active',
      lastLogin: '3 hours ago',
    },
    {
      id: 'u-fatima',
      name: 'Fatima Khan',
      email: 'fatima.khan@expertflow.com',
      role: 'Employee',
      department: 'Engineering',
      designation: 'Software Engineer',
      employee_id: 'emp-001',
      status: 'Active',
      lastLogin: '1 day ago',
    },
    {
      id: 'u-omar',
      name: 'Omar Farooq',
      email: 'omar.farooq@expertflow.com',
      role: 'Employee',
      department: 'Product',
      designation: 'Product Designer',
      employee_id: 'emp-004',
      status: 'Active',
      lastLogin: '2 days ago',
    },
    {
      id: 'u-hina',
      name: 'Hina Malik',
      email: 'hina.malik@expertflow.com',
      role: 'Employee',
      department: 'Marketing',
      designation: 'Marketing Specialist',
      employee_id: 'emp-005',
      status: 'Inactive',
      lastLogin: '2 weeks ago',
    },
  ]);

  // ── Filters ───────────────────────────────────────────────────────────────
  filterRole   = '';
  filterStatus = '';
  searchQuery  = '';

  get filteredUsers(): AppUserRecord[] {
    return this.allUsers().filter(u => {
      const matchRole   = !this.filterRole   || u.role === this.filterRole;
      const matchStatus = !this.filterStatus || u.status === this.filterStatus;
      const q = this.searchQuery.toLowerCase();
      const matchSearch = !q ||
        u.name.toLowerCase().includes(q) ||
        u.email.toLowerCase().includes(q) ||
        u.department.toLowerCase().includes(q) ||
        u.designation.toLowerCase().includes(q);
      return matchRole && matchStatus && matchSearch;
    });
  }

  get stats() {
    const users = this.allUsers();
    return {
      total:    users.length,
      active:   users.filter(u => u.status === 'Active').length,
      inactive: users.filter(u => u.status === 'Inactive').length,
      admins:   users.filter(u => u.role === 'AppAdmin' || u.role === 'HR').length,
    };
  }

  // ── Edit modal ────────────────────────────────────────────────────────────
  editingUser: AppUserRecord | null = null;
  editForm: Partial<AppUserRecord> = {};
  saving = false;

  openEdit(user: AppUserRecord): void {
    this.editingUser = user;
    this.editForm = { ...user };
  }

  closeEdit(): void {
    this.editingUser = null;
    this.editForm = {};
  }

  saveEdit(): void {
    if (!this.editingUser) return;
    this.saving = true;
    // Simulate async save
    setTimeout(() => {
      this.allUsers.update(list =>
        list.map(u => u.id === this.editingUser!.id ? { ...u, ...this.editForm } as AppUserRecord : u)
      );
      this.saving = false;
      this.closeEdit();
    }, 400);
  }

  toggleStatus(user: AppUserRecord): void {
    this.allUsers.update(list =>
      list.map(u => u.id === user.id
        ? { ...u, status: u.status === 'Active' ? 'Inactive' : 'Active' }
        : u
      )
    );
  }

  // ── Delete ────────────────────────────────────────────────────────────────
  deletingUser: AppUserRecord | null = null;

  confirmDelete(user: AppUserRecord): void {
    this.deletingUser = user;
  }

  cancelDelete(): void {
    this.deletingUser = null;
  }

  deleteUser(): void {
    if (!this.deletingUser) return;
    this.allUsers.update(list => list.filter(u => u.id !== this.deletingUser!.id));
    this.deletingUser = null;
  }

  roleClass(role: AppRole): string {
    const map: Record<AppRole, string> = {
      AppAdmin: 'role-appadmin',
      HR:       'role-hr',
      Manager:  'role-manager',
      Employee: 'role-employee',
    };
    return map[role] ?? '';
  }

  initials(name: string): string {
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  }

  readonly roles: AppRole[] = ['AppAdmin', 'HR', 'Manager', 'Employee'];
}
