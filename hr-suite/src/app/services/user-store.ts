import { Injectable, signal, computed } from '@angular/core';
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
}

const STORAGE_KEY = 'ef_users_v1';

// ── Seed data (used only on first run / when localStorage is empty) ───────────
const SEED_USERS: AppUserRecord[] = [
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
];

// ── localStorage helpers ──────────────────────────────────────────────────────
function load(): AppUserRecord[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw) as AppUserRecord[];
  } catch { /* ignore */ }
  return SEED_USERS;
}

function save(users: AppUserRecord[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(users));
  } catch { /* ignore */ }
}

// ── Service ───────────────────────────────────────────────────────────────────
@Injectable({ providedIn: 'root' })
export class UserStoreService {

  private _users = signal<AppUserRecord[]>(load());

  /** Read-only computed list */
  readonly users = computed(() => this._users());

  /** Persist + update signal */
  private commit(list: AppUserRecord[]): void {
    save(list);
    this._users.set(list);
  }

  addUser(user: AppUserRecord): void {
    this.commit([...this._users(), user]);
  }

  updateUser(updated: AppUserRecord): void {
    this.commit(this._users().map(u => u.id === updated.id ? updated : u));
  }

  deleteUser(id: string): void {
    this.commit(this._users().filter(u => u.id !== id));
  }

  toggleStatus(id: string): void {
    this.commit(
      this._users().map(u =>
        u.id === id
          ? { ...u, status: u.status === 'Active' ? 'Inactive' : 'Active' }
          : u
      )
    );
  }

  /** Wipe localStorage and reset to seed data (useful for dev/testing) */
  resetToSeed(): void {
    this.commit([...SEED_USERS]);
  }
}
