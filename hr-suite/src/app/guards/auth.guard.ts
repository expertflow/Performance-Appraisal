import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth';

export const authGuard: CanActivateFn = () => {
  const auth   = inject(AuthService);
  const router = inject(Router);

  if (auth.isLoggedIn()) return true;

  // replaceUrl: true ensures the protected route is NOT added to browser history,
  // so the back button after logout cannot return to the app.
  router.navigate(['/login'], { replaceUrl: true });
  return false;
};
