import { Component, inject, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../services/auth';
import { UserStoreService, AppUserRecord } from '../../services/user-store';
import { AppRole } from '../../models';

// Re-export so templates / other files that imported from here still work
export type { AppUserRecord } from '../../services/user-store';

@Component({
  selector: 'app-users',
  imports: [CommonModule, FormsModule],
  templateUrl: './users.html',
  styleUrl: './users.scss'
})
export class Users {
  private auth      = inject(AuthService);
  private userStore = inject(UserStoreService);

  readonly isAppAdmin = computed(() => this.auth.isAppAdmin());

  // ── Expose the persisted list ─────────────────────────────────────────────
  readonly allUsers = this.userStore.users;

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
    setTimeout(() => {
      this.userStore.updateUser({ ...this.editingUser!, ...this.editForm } as AppUserRecord);
      this.saving = false;
      this.closeEdit();
    }, 400);
  }

  toggleStatus(user: AppUserRecord): void {
    this.userStore.toggleStatus(user.id);
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
    this.userStore.deleteUser(this.deletingUser.id);
    this.deletingUser = null;
  }

  // ── Helpers ───────────────────────────────────────────────────────────────
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
