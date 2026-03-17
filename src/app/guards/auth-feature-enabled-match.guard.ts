import { inject } from '@angular/core';
import { CanMatchFn } from '@angular/router';
import { AUTH_ENABLED } from '@tokens/auth.tokens';

/**
 * Exposes auth-only routes (for example `/login`) only when auth feature is enabled.
 */
export const authFeatureEnabledMatchGuard: CanMatchFn = () => {
  return inject(AUTH_ENABLED);
};
