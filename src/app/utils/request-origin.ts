import type { Request } from 'express';

import { config } from '../../assets/config/config';


/**
 * Helpers for resolving the public origin used by SSR.
 *
 * The app is commonly deployed behind a TLS-terminating proxy in front of
 * nginx, while nginx talks to Node/Express over plain HTTP. In that setup,
 * Express can see an internal HTTP request even though the public page URL is
 * HTTPS. SEO tags and Angular's SSR document location must use the public
 * origin, not the internal proxy hop.
 *
 * `app.siteURLOrigin` is treated as authoritative when the incoming request
 * host matches the configured public host. This keeps canonical/Open Graph
 * URLs stable even if a proxy overwrites or omits `X-Forwarded-Proto`.
 */
type OriginRequest = Pick<Request, 'headers' | 'protocol'>;
type RenderRequest = OriginRequest & Pick<Request, 'originalUrl'>;

const URL_SCHEME_PATTERN = /^[a-zA-Z][a-zA-Z\d+\-.]*:\/\//;

/**
 * Resolves the configured public site origin, normalizing host-only values to HTTPS.
 * This is the canonical origin configured by each edition/fork.
 */
export function getConfiguredSiteOrigin(): string | undefined {
  const siteURLOrigin = config?.app?.siteURLOrigin;
  if (typeof siteURLOrigin !== 'string' || siteURLOrigin.trim().length === 0) {
    return undefined;
  }

  const normalizedOrigin = URL_SCHEME_PATTERN.test(siteURLOrigin)
    ? siteURLOrigin
    : `https://${siteURLOrigin}`;

  try {
    return new URL(normalizedOrigin).origin;
  } catch {
    return undefined;
  }
}

/**
 * Resolves the configured public site hostname.
 * Used for host allow-listing and for matching requests to the configured
 * public origin without considering protocol or port.
 */
export function getConfiguredSiteHostname(): string | undefined {
  const configuredOrigin = getConfiguredSiteOrigin();
  if (!configuredOrigin) {
    return undefined;
  }

  try {
    return new URL(configuredOrigin).hostname.toLowerCase();
  } catch {
    return undefined;
  }
}

/**
 * Builds the public origin for an SSR request.
 *
 * If the request host is the configured public host, the configured origin wins
 * over forwarded protocol headers from an internal HTTP proxy hop.
 *
 * For unknown hosts, the resolver keeps the existing dynamic behavior:
 * forwarded host/protocol headers are used when present, non-local requests
 * fall back to the configured protocol, and local development falls back to
 * Express' request protocol.
 */
export function getRequestOrigin(request?: OriginRequest | null): string | undefined {
  if (!request) {
    return undefined;
  }

  const host = getRequestHeaderValue(request, 'x-forwarded-host')
    || getRequestHeaderValue(request, 'host');

  if (!host) {
    return undefined;
  }

  const configuredOriginForHost = getConfiguredSiteOriginForHost(host);
  if (configuredOriginForHost) {
    return configuredOriginForHost;
  }

  const protocol = getRequestHeaderValue(request, 'x-forwarded-proto')
    || (!isLocalHost(host) ? getConfiguredSiteProtocol() : undefined)
    || request.protocol
    || 'http';

  return `${protocol}://${host}`;
}

/**
 * Builds the absolute URL passed to Angular SSR for one request.
 *
 * Angular uses this URL to populate the server-side document location. The
 * document location is then consumed by metadata helpers that generate
 * canonical and Open Graph URLs, so this must be the public URL.
 */
export function getRequestRenderUrl(request: RenderRequest): string {
  const origin = getRequestOrigin(request);
  if (origin) {
    return `${origin}${request.originalUrl}`;
  }

  const protocol = request.protocol || 'http';
  const host = getRequestHeaderValue(request, 'host') || 'localhost';
  return `${protocol}://${host}${request.originalUrl}`;
}

function getConfiguredSiteOriginForHost(host: string): string | undefined {
  const configuredOrigin = getConfiguredSiteOrigin();
  const configuredHostname = getConfiguredSiteHostname();
  const requestHostname = getHostname(host);

  return configuredOrigin && configuredHostname && requestHostname === configuredHostname
    ? configuredOrigin
    : undefined;
}

function getConfiguredSiteProtocol(): string | undefined {
  const configuredOrigin = getConfiguredSiteOrigin();
  if (!configuredOrigin) {
    return undefined;
  }

  try {
    return new URL(configuredOrigin).protocol.replace(':', '');
  } catch {
    return undefined;
  }
}

function getRequestHeaderValue(request: OriginRequest, headerName: string): string | undefined {
  const header = request.headers?.[headerName.toLowerCase()];
  if (!header) {
    return undefined;
  }
  const firstValue = Array.isArray(header) ? header[0] : header;
  const normalizedValue = String(firstValue).split(',')[0]?.trim();
  return normalizedValue || undefined;
}

function isLocalHost(host: string): boolean {
  const hostname = getHostname(host);
  return (
    hostname === 'localhost' ||
    hostname === '127.0.0.1' ||
    hostname === '::1' ||
    hostname === '[::1]'
  );
}

function getHostname(hostOrOrigin: string): string | undefined {
  const normalizedHostOrOrigin = URL_SCHEME_PATTERN.test(hostOrOrigin)
    ? hostOrOrigin
    : `http://${hostOrOrigin}`;

  try {
    return new URL(normalizedHostOrOrigin).hostname.toLowerCase();
  } catch {
    return undefined;
  }
}
