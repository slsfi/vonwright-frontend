import { InjectionToken } from '@angular/core';

/** Scalar request data used by application services, independent of the server API. */
export interface ApplicationRequestContext {
  /** Router-facing request URL, including query parameters; may be locale-prefixed. */
  readonly url: string;
  /** Resolved public origin, absent when the request has no host information. */
  readonly publicOrigin?: string;
  readonly userAgent?: string;
}

// Server-only adapters provide a snapshot per application render. Browser
// consumers inject this optionally and keep their existing platform fallbacks.
export const APPLICATION_REQUEST_CONTEXT = new InjectionToken<ApplicationRequestContext | null>(
  'APPLICATION_REQUEST_CONTEXT'
);
