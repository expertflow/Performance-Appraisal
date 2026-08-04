import { Injectable, signal, computed, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../environments/environment';
import { AppRole } from '../models';

// ── Data shape ────────────────────────────────────────────────────────────────
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
  phone?: string;
  address?: string;
}

// ── Service ───────────────────────────────────────────────────────────────────
@Injectable({ providedIn: 'root' })
export class UserStoreService {
  private http = inject(HttpClient);
  private base = `${environment.apiUrl}/app-users`;

  private _users = signal<AppUserRecord[]>([]);

  /** Read-only computed list */
  readonly users = computed(() => this._users());

  constructor() {
    this.loadUsers();
  }

  loadUsers(): void {
    this.http.get<AppUserRecord[]>(this.base).subscribe({
      next:  users => this._users.set(users),
      error: err   => console.error('[UserStore] Failed to load users:', err.message)
    });
  }

  addUser(user: AppUserRecord): void {
    // User is already persisted in DB via auth-local/register — just update local signal
    this._users.update(list => [...list, user]);
  }

  updateUser(updated: AppUserRecord): void {
    this.http.patch<AppUserRecord>(`${this.base}/${updated.id}`, {
      name:        updated.name,
      role:        updated.role,
      department:  updated.department,
      designation: updated.designation,
      employee_id: updated.employee_id,
      status:      updated.status,
    }).subscribe({
      next:  saved => this._users.update(list => list.map(u => u.id === saved.id ? saved : u)),
      error: err   => console.error('[UserStore] Failed to update user:', err.message)
    });
  }

  deleteUser(id: string): void {
    this.http.delete<{ deleted: string }>(`${this.base}/${id}`).subscribe({
      next:  () => this._users.update(list => list.filter(u => u.id !== id)),
      error: err => console.error('[UserStore] Failed to delete user:', err.message)
    });
  }

  toggleStatus(id: string): void {
    const user = this._users().find(u => u.id === id);
    if (!user) return;
    const newStatus = user.status === 'Active' ? 'Inactive' : 'Active';
    this.http.patch<AppUserRecord>(`${this.base}/${id}`, { status: newStatus }).subscribe({
      next:  saved => this._users.update(list => list.map(u => u.id === id ? saved : u)),
      error: err   => console.error('[UserStore] Failed to toggle status:', err.message)
    });
  }

  /** Reload from DB */
  resetToSeed(): void {
    this.loadUsers();
  }
}
