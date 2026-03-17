import { InjectionToken } from '@angular/core';

import { config } from '@config';

/**
 * Feature flag for auth-related routing/interception behavior.
 *
 * Default value is resolved from app config and can be overridden in tests.
 */
export const AUTH_ENABLED = new InjectionToken<boolean>('AUTH_ENABLED', {
  providedIn: 'root',
  factory: () => config?.app?.auth?.enabled === true
});
