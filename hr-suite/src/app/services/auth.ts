import { Injectable, signal, computed } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { Observable, tap } from 'rxjs';
import { environment } from '../../environments/environment';
import { AppUser, AppRole, LoginRequest, LoginResponse } from '../models';

const TOKEN_KEY = 'hr_suite_token';
const USER_KEY  = 'hr_suite_user';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private base = environment.apiUrl;

  // ── Reactive state ────────────────────────────────────────────────────────
  private _user = signal<AppUser | null>(this.loadUser());
  readonly currentUser = this._user.asReadonly();
  readonly isLoggedIn  = computed(() => this._user() !== null);
  readonly role        = computed(() => this._user()?.role ?? null);

  constructor(private http: HttpClient, private router: Router) {}

  // ── Auth API ──────────────────────────────────────────────────────────────

  login(req: LoginRequest): Observable<LoginResponse> {
    return this.http.post<LoginResponse>(`${this.base}/auth/login`, req).pipe(
      tap(res => {
        localStorage.setItem(TOKEN_KEY, res.token);
        localStorage.setItem(USER_KEY, JSON.stringify(res.user));
        this._user.set(res.user);
      })
    );
  }

  logout(): void {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    this._user.set(null);
    // replaceUrl: true replaces the current history entry so the back button
    // cannot navigate back into the app after logout.
    this.router.navigate(['/login'], { replaceUrl: true });
  }

  changePassword(currentPassword: string, newPassword: string): Observable<{ message: string }> {
    return this.http.post<{ message: string }>(`${this.base}/auth/change-password`, {
      current_password: currentPassword,
      new_password: newPassword
    });
  }

  getToken(): string | null {
    return localStorage.getItem(TOKEN_KEY);
  }

  // ── Role helpers ──────────────────────────────────────────────────────────

  hasRole(...roles: AppRole[]): boolean {
    const r = this._user()?.role;
    return r ? roles.includes(r) : false;
  }

  isAppAdmin(): boolean  { return this.hasRole('AppAdmin'); }
  isHR(): boolean        { return this.hasRole('HR'); }
  isManager(): boolean   { return this.hasRole('Manager'); }
  isEmployee(): boolean  { return this.hasRole('Employee'); }

  /** Can manage app users (create/update/delete accounts) */
  canManageUsers(): boolean { return this.isAppAdmin(); }

  /** Can see all employees synced from BS4 */
  canViewEmployees(): boolean { return this.hasRole('AppAdmin', 'HR'); }

  /** Can access Recruitment module */
  canAccessRecruitment(): boolean { return this.hasRole('AppAdmin', 'HR'); }

  /** Can access Performance Appraisal module */
  canAccessAppraisal(): boolean { return this.hasRole('AppAdmin', 'HR', 'Manager', 'Employee'); }

  /** Can access Project Management module */
  canAccessProjects(): boolean { return this.hasRole('AppAdmin', 'HR', 'Manager', 'Employee'); }

  /** Can create/update/delete projects (not Employee) */
  canMutateProjects(): boolean { return this.hasRole('AppAdmin', 'HR', 'Manager'); }

  /** Employee ID of the currently logged-in user */
  get employeeId(): string | undefined { return this._user()?.employee_id; }

  /** Manager's employee_id (for Employee role: who their manager is) */
  get managerId(): string | undefined { return this._user()?.manager_id; }

  // ── Local / mock login helpers ────────────────────────────────────────────

  /**
   * Log in with a fully-formed AppUser object and token.
   * Used for hardcoded local accounts (e.g. zaeem.ahmad@expertflow.com).
   */
  mockLoginWithUser(user: AppUser, token: string): void {
    localStorage.setItem(TOKEN_KEY, token);
    localStorage.setItem(USER_KEY, JSON.stringify(user));
    this._user.set(user);
  }

  /**
   * Use this when the backend is not available.
   * Call mockLogin('AppAdmin' | 'HR' | 'Manager' | 'Employee') from the login page.
   */
  mockLogin(role: AppRole): void {
    const mockUsers: Record<AppRole, AppUser> = {
      AppAdmin: {
        id: 'u1', email: 'admin@ef.com', name: 'Admin User',
        role: 'AppAdmin', employee_id: 'emp-admin'
      },
      HR: {
        id: 'u2', email: 'hr@ef.com', name: 'HR Manager',
        role: 'HR', employee_id: 'emp-hr'
      },
      Manager: {
        id: 'u3', email: 'manager@ef.com', name: 'Team Manager',
        role: 'Manager', employee_id: 'emp-mgr'
      },
      Employee: {
        id: 'u4', email: 'employee@ef.com', name: 'John Employee',
        role: 'Employee', employee_id: 'emp-001', manager_id: 'emp-mgr'
      }
    };
    const user = mockUsers[role];
    const token = `mock-token-${role.toLowerCase()}`;
    localStorage.setItem(TOKEN_KEY, token);
    localStorage.setItem(USER_KEY, JSON.stringify(user));
    this._user.set(user);
  }

  // ── Private ───────────────────────────────────────────────────────────────

  private loadUser(): AppUser | null {
    try {
      const raw = localStorage.getItem(USER_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }
}
