import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth';
import { AppRole } from '../models';

/**
 * Usage in routes:
 *   canActivate: [authGuard, roleGuard(['AppAdmin', 'HR'])]
 */
export function roleGuard(allowed: AppRole[]): CanActivateFn {
  return () => {
    const auth   = inject(AuthService);
    const router = inject(Router);
    if (auth.hasRole(...allowed)) return true;
    return router.createUrlTree(['/dashboard']);
  };
}
