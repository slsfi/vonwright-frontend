import { CanActivateFn } from '@angular/router';

import { createJwtFragmentGuard } from './jwt-fragment.guard';

/**
 * Requires a non-empty `jwt` fragment parameter for the verify-email page.
 * Redirects to login when the token is missing.
 */
export const verifyEmailJwtGuard: CanActivateFn = createJwtFragmentGuard('/login');
