import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth';

export const authGuard: CanActivateFn = () => {
  const auth   = inject(AuthService);
  const router = inject(Router);

  if (!auth.isLoggedIn()) {
    router.navigate(['/login'], { replaceUrl: true });
    return false;
  }

  // Candidates must stay in the /candidate portal — block access to internal shell
  const role = auth.role();
  const url  = router.getCurrentNavigation()?.extractedUrl.toString() ?? '';

  if (role === 'Candidate' && !url.startsWith('/candidate')) {
    router.navigate(['/candidate/jobs'], { replaceUrl: true });
    return false;
  }

  return true;
};
