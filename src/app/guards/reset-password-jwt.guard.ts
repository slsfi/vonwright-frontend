import { CanActivateFn } from '@angular/router';

import { createJwtFragmentGuard } from './jwt-fragment.guard';

/**
 * Requires a non-empty `jwt` fragment parameter for the reset-password page.
 * Redirects to forgot-password when the token is missing.
 */
export const resetPasswordJwtGuard: CanActivateFn = createJwtFragmentGuard('/forgot-password');
