import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from './auth.service';
import { evaluateAccess } from './route-access';

/**
 * Client-side counterpart of the Nitro auth middleware: the same rules (route-access.ts), applied
 * when the user navigates inside the already loaded app. Used by every protected page.
 */
export const accessGuard: CanActivateFn = (_route, state) => {
	const auth = inject(AuthService);
	const router = inject(Router);

	const decision = evaluateAccess(state.url, auth.role());
	return decision.allowed ? true : router.parseUrl(decision.redirectTo);
};
