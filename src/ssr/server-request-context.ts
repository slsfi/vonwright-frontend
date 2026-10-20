import { DOCUMENT, FactoryProvider, REQUEST, inject } from '@angular/core';

import { APPLICATION_REQUEST_CONTEXT, ApplicationRequestContext } from '../app/tokens/request-context.token';
import { getRequestOrigin } from '../app/utils/request-origin';

/**
 * Copies Angular's SSR Web Request into the scalar context consumed by application services.
 *
 * Remove the rendered document's base path at a complete path-segment boundary, preserving
 * query parameters and escaped characters. Resolve the public origin from the request URL
 * using the configured site-origin rules; proxy headers have already been handled at the
 * Express boundary and are not interpreted again here.
 *
 * @param request Angular's validated REQUEST value, absent or null outside an active SSR request.
 * @param baseHref Rendered document's base href, including locale/deployment prefixes to strip.
 * @returns A request-context snapshot, or null when no request is available.
 */
export function createServerRequestContext(request?: Request | null, baseHref = ''): ApplicationRequestContext | null {
  if (!request) return null;

  const url = new URL(request.url);
  let basePath = baseHref ? new URL(baseHref, url).pathname : '';
  if (basePath.endsWith('/')) {
    basePath = basePath.slice(0, -1);
  }
  const pathname = basePath && (url.pathname === basePath || url.pathname.startsWith(basePath + '/'))
    ? url.pathname.slice(basePath.length) || '/' : url.pathname;
  return {
    url: pathname + url.search,
    publicOrigin: getRequestOrigin({ headers: { host: url.host }, protocol: url.protocol.slice(0, -1) }),
    userAgent: request.headers.get('user-agent') || undefined
  };
}

/**
 * Provides APPLICATION_REQUEST_CONTEXT from Angular's current REQUEST and rendered DOCUMENT.
 *
 * Register in the server application configuration. The factory reads the document's base
 * href for locale/deployment stripping and resolves a separate snapshot in each render
 * injector. Optional injection allows browser/build-time contexts and route extraction
 * without a request to resolve to null.
 *
 * @returns A factory provider for the server application's scalar request context.
 */
export function provideServerRequestContext(): FactoryProvider {
  return {
    provide: APPLICATION_REQUEST_CONTEXT,
    useFactory: () => createServerRequestContext(
      inject(REQUEST, { optional: true }),
      inject(DOCUMENT, { optional: true })?.querySelector('base')?.getAttribute('href') ?? ''
    )
  };
}
