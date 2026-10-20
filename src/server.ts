import {
  AngularNodeAppEngine,
  createNodeRequestHandler,
  createWebRequestFromNodeRequest,
  isMainModule,
  writeResponseToNodeResponse
} from '@angular/ssr/node';
import express from 'express';
import rateLimit from 'express-rate-limit';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import angularConfig from '../angular.json';
import { config } from './project/config';
import { environment } from './environments/environment';
import { getConfiguredSiteHostname, getRequestOrigin } from './app/utils/request-origin';
import { getDefaultServerLocale, getServerLocales, localizeRequestUrl, type ServerLocale } from './ssr/server-locales';

/** Locale, proxy, and rate-limit settings for middleware registered before Angular rendering. */
interface SsrMiddlewareOptions {
  locales: readonly ServerLocale[];
  defaultLocale: ServerLocale;
  trustProxyHops: number;
  trustedProxyAddresses: string[];
  rateLimitWindowMs: number;
  rateLimitLimit: number;
}

// Express checks the sender of these headers; Angular filters and validates them for SSR.
const proxyHeaders = ['x-forwarded-host', 'x-forwarded-proto'];

// Restrict SSR hosts to local development, the configured public site, and explicit
// deployment aliases supplied through NG_ALLOWED_HOSTS.
const allowedHosts = new Set(['localhost', '127.0.0.1', '[::1]']);
const configuredHost = getConfiguredSiteHostname();
if (configuredHost) {
  allowedHosts.add(configuredHost);
}
for (const host of (process.env['NG_ALLOWED_HOSTS'] ?? '').split(',').map(host => host.trim()).filter(Boolean)) {
  allowedHosts.add(host);
}

// One engine owns dispatch to the localized applications emitted by the integrated build.
const angularApp = new AngularNodeAppEngine({ allowedHosts: [...allowedHosts], trustProxyHeaders: proxyHeaders });
const browserFolder = resolve(dirname(fileURLToPath(import.meta.url)), '../browser');
// Built SSR uses emitted locale directories and localizes unprefixed request URLs.
// The production flag also identifies a built entry imported by another module;
// isMainModule covers direct execution, including non-production builds.
// CLI development SSR imports this entry with production=false and serves one
// in-memory app at the dev server's base path, so it skips that URL localization.
const localizedRuntime = environment.production || isMainModule(import.meta.url);
const locales = getServerLocales(angularConfig.projects.app, browserFolder, localizedRuntime);
const defaultLanguage = config.app?.i18n?.defaultLanguage ?? config.app?.i18n?.languages?.[0]?.code ?? 'sv';
const defaultLocale = getDefaultServerLocale(locales, defaultLanguage);

// Create the Express app here so its setup, Angular handler, and listener stay together.
export const app = express();

// Serve static files and probes before limiting requests that reach the Angular handler.
configureSsrMiddleware(app, {
  locales,
  defaultLocale,
  trustProxyHops: getInt(config.app?.ssr?.trustProxyHops, 2, 0),
  trustedProxyAddresses: config.app?.ssr?.trustedProxyAddresses ?? ['loopback', 'linklocal', 'uniquelocal'],
  rateLimitWindowMs: getInt(process.env['SSR_RATE_LIMIT_WINDOW_MS'], 60_000, 1),
  rateLimitLimit: getInt(process.env['SSR_RATE_LIMIT_LIMIT'], 1200, 1)
});

// Handle remaining requests with Angular SSR, client-rendered routes, or application 404 pages.
app.use(async (req, res, next) => {
  // Mobile and desktop SSR output differs. Retain this header for Express fall-through/errors
  // as well as on Angular's response below, whose headers can replace Express's headers.
  res.vary('User-Agent');
  try {
    // Adapt the sanitized Node request to Angular's Web Request API. Internally
    // prefix unlocalized URLs with the default locale while preserving the browser URL.
    const request = createWebRequestFromNodeRequest(req, proxyHeaders);
    const url = localizedRuntime ? localizeRequestUrl(new URL(request.url), locales, defaultLocale) : new URL(request.url);

    // Keep Angular's document location and SEO URLs on the public origin, including
    // configured HTTPS when nginx reaches Node over an internal HTTP connection.
    const origin = getRequestOrigin(req);
    const renderUrl = origin ? origin + url.pathname + url.search : url.href;
    const headers = new Headers(request.headers);
    // IP forwarding is consumed by Express; Angular trusts only host/protocol.
    headers.delete('x-forwarded-for');
    // Align the Host header with the resolved public URL instead of an internal proxy host.
    headers.set('host', new URL(renderUrl).host);

    // Generated server routes select public SSR or auth-protected CSR shells.
    // Critical CSS inlining remains disabled in angular.json's production optimization.
    const response = await angularApp.handle(new Request(renderUrl, new Request(request, { headers })));
    if (!response) {
      // Let Express handle requests that Angular does not support.
      next();
      return;
    }
    // Preserve User-Agent variation on Angular's response before its headers are
    // written to Express, including any other Vary values set by Angular.
    response.headers.append('Vary', 'User-Agent');
    await writeResponseToNodeResponse(response, res);
  } catch (error) {
    next(error);
  }
});

// Start a listener only when the built entry is executed directly (npm run serve:ssr).
// Angular CLI can import the handler without opening a second server port.
if (isMainModule(import.meta.url)) {
  const port = process.env['PORT'] || 4201;
  app.listen(port, error => {
    if (error) {
      throw error;
    }
    console.log(`Node Express server listening on http://localhost:${port}`);
  });
}

export const reqHandler = createNodeRequestHandler(app);

/**
 * Registers the middleware that runs before Angular rendering on an existing Express app.
 *
 * Establish proxy trust and check forwarded host/protocol senders first. Locale-specific
 * and default static routers then handle files, fast 404s, and probes before dynamic requests reach
 * the SSR rate limiter. The caller registers its Angular handler after this function returns.
 *
 * @param app Express app created by the server entry.
 * @param options Locale directories, proxy trust, and dynamic-request rate limits.
 */
export function configureSsrMiddleware(app: express.Express, options: SsrMiddlewareOptions): void {
  // Resolve req.ip through trusted proxy addresses and the configured hop limit.
  // The default two-hop deployment is HAProxy -> nginx -> Node; see docs/DEPLOYMENT.md.
  app.set('trust proxy', options.trustedProxyAddresses);
  const trustAddress = app.get('trust proxy fn') as (address: string) => boolean;
  app.set('trust proxy', (address: string, hop: number) => hop < options.trustProxyHops && trustAddress(address));

  // Only trusted immediate peers may supply the forwarded host/protocol used by our
  // origin helper and Angular. Express resolves client IPs through its trust function;
  // Angular filters other forwarding headers according to trustProxyHeaders.
  app.use((req, _res, next) => {
    const trustedPeer = options.trustProxyHops > 0 && trustAddress(req.socket.remoteAddress ?? '');
    if (!trustedPeer) {
      delete req.headers['x-forwarded-host'];
      delete req.headers['x-forwarded-proto'];
    }
    next();
  });

  // Reuse the default locale's router at both its locale prefix and the unprefixed mount.
  const defaultStaticFiles = staticFiles(options.defaultLocale.browserFolder);

  // Serve each emitted locale's browser directory at its configured URL prefix.
  // Match longer prefixes first so nested locale paths are handled by their own router.
  for (const locale of [...options.locales].sort((a, b) => b.path.length - a.path.length)) {
    if (locale.path) {
      const files = locale.browserFolder === options.defaultLocale.browserFolder
        ? defaultStaticFiles : staticFiles(locale.browserFolder);
      app.use('/' + locale.path, files);
    }
  }

  // Unprefixed static requests use the configured default locale. Skip requests that
  // already passed through a locale router, preserving dynamic fall-through such as ebooks.
  app.use('/' + options.defaultLocale.basePath, (req, res, next) => {
    const pathname = req.baseUrl + req.path;
    if (options.locales.some(locale => locale.path &&
      (pathname === '/' + locale.path || pathname.startsWith('/' + locale.path + '/')))) {
      next();
      return;
    }
    defaultStaticFiles(req, res, next);
  });

  // Limit only dynamic render requests: served files, fast static 404s, and probes
  // have already returned. Limits are configurable through SSR_RATE_LIMIT_* above.
  app.use(rateLimit({
    windowMs: options.rateLimitWindowMs,
    limit: options.rateLimitLimit,
    standardHeaders: true,
    legacyHeaders: false,
    message: 'Too many requests, please try again later.'
  }));
}

/**
 * Creates the static-file and probe middleware for one locale's browser output.
 *
 * Existing files, missing known static extensions, missing static HTML, and DevTools probes
 * return before Angular rendering. Unmatched application routes, including ebook PDF paths, fall
 * through to the next handler. Mount this router at the locale's URL prefix.
 *
 * @param browserFolder Locale browser directory containing the files to serve.
 * @returns A router retaining the public-file, asset, and hashed-output cache policies.
 */
function staticFiles(browserFolder: string): express.Router {
  const router = express.Router();

  // Serve generated static HTML with a one-day cache, without directory indexes or redirects.
  router.use('/static-html', express.static(join(browserFolder, 'static-html'), {
    maxAge: '1d', index: false, redirect: false
  }));

  // Missing static HTML must return here so Angular's wildcard 404 page is not bootstrapped.
  router.use('/static-html', (_req, res) => res.status(404).send('File not found'));

  // Unversioned public files must be revalidated rather than cached for a year.
  router.get(['/robots.txt', '/sitemap.txt', '/favicon.ico'], express.static(browserFolder, { maxAge: 0 }));

  // Public assets may change without filename hashes, so retain their shorter one-day cache.
  router.use('/assets', express.static(join(browserFolder, 'assets'), {
    maxAge: '1d', index: false, redirect: false
  }));

  // Other browser output is intended to be hashed and can use long-term caching.
  router.use(express.static(browserFolder, { maxAge: '1y', index: false, redirect: false }));

  // Missing images, fonts, media, PDFs, and similar files should return a fast 404
  // without reaching Angular or consuming SSR limiter capacity.
  const staticExtensions = new Set([
    '.png', '.jpg', '.jpeg', '.gif', '.svg', '.webp', '.avif', '.ico',
    '.woff', '.woff2', '.ttf', '.otf', '.eot',
    '.mp4', '.webm', '.mp3', '.wav', '.ogg', '.pdf', '.txt'
  ]);
  router.use((req, res, next) => {
    const pathname = req.url.split(/[?#]/, 1)[0].toLowerCase();
    const ext = pathname.slice(pathname.lastIndexOf('.'));
    // Ebook URLs can end in .pdf while still being application routes.
    if (staticExtensions.has(ext) && !pathname.startsWith('/ebook/')) {
      res.status(404).send('File with ' + ext + ' extension not found');
      return;
    }
    next();
  });

  // Chrome's DevTools probe needs no rendering and must not consume the SSR rate-limit quota.
  router.get('/.well-known/appspecific/com.chrome.devtools.json', (_req, res) => res.status(204).end());
  return router;
}

/**
 * Reads an integer from a config value or environment-variable string.
 * Missing, invalid, fractional, or below-minimum values use the supplied fallback.
 *
 * @param value Raw setting to convert to a number.
 * @param fallback Default used when the setting is absent or invalid.
 * @param minimum Smallest accepted integer, inclusive.
 * @returns The validated integer or fallback.
 */
function getInt(value: unknown, fallback: number, minimum: number): number {
  if (value === undefined || value === null || value === '') return fallback;
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed >= minimum ? parsed : fallback;
}
