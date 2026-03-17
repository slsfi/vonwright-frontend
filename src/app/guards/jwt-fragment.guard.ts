import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';

/**
 * Creates a route guard that requires a non-empty `jwt` fragment parameter.
 * Redirects to the provided path when the token is missing.
 */
export function createJwtFragmentGuard(redirectPath: string): CanActivateFn {
  return (route) => {
    const fragment = typeof route.fragment === 'string' ? route.fragment : '';
    const normalizedFragment = fragment.startsWith('#') ? fragment.slice(1) : fragment;
    const jwt = new URLSearchParams(normalizedFragment).get('jwt')?.trim() ?? '';

    if (jwt.length > 0) {
      return true;
    }

    return inject(Router).createUrlTree([redirectPath]);
  };
}
