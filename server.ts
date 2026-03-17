/***************************************************************************************************
 * Load `$localize` onto the global scope - used if i18n tags appear in Angular templates.
 */
import '@angular/localize/init';
import 'zone.js/node';
import { LOCALE_ID } from '@angular/core';
import { APP_BASE_HREF } from '@angular/common';
import { CommonEngine } from '@angular/ssr/node';
import express from 'express';
import { existsSync, readFileSync } from 'node:fs';
import rateLimit from 'express-rate-limit';
import { join } from 'node:path';

import AppServerModule from './src/main.server';
import { environment } from './src/environments/environment';
import { REQUEST } from './src/express.tokens';
import { config } from './src/assets/config/config';
import { authProtectedRoutePaths } from './src/app/auth-protected-route-paths.generated';

const LOOPBACK_ALLOWED_HOSTS = ['localhost', '127.0.0.1', '[::1]'] as const;

// App-level limiter for dynamic SSR render requests.
// Tunables and deployment guidance: docs/DEPLOYMENT.md
const SSR_RATE_LIMIT_WINDOW_MS = getPositiveIntFromEnv('SSR_RATE_LIMIT_WINDOW_MS', 60_000);
const SSR_RATE_LIMIT_LIMIT = getPositiveIntFromEnv('SSR_RATE_LIMIT_LIMIT', 1200);
const SSR_TRUST_PROXY_HOPS = getNonNegativeInt(config?.app?.ssr?.trustProxyHops, 2);

const authEnabled = config?.app?.auth?.enabled === true;
const authProtectedRouteSegmentPatterns = authProtectedRoutePaths.map((routePath) => toRouteSegments(routePath));

/**
 * Resolves a hostname from `config.app.siteURLOrigin` for SSR host validation.
 */
function getConfiguredAllowedHost(): string | undefined {
  const siteURLOrigin = config?.app?.siteURLOrigin;
  if (typeof siteURLOrigin !== 'string' || siteURLOrigin.trim().length === 0) {
    return undefined;
  }

  const normalizedOrigin = /^[a-zA-Z][a-zA-Z\d+\-.]*:\/\//.test(siteURLOrigin)
    ? siteURLOrigin
    : `https://${siteURLOrigin}`;

  try {
    return new URL(normalizedOrigin).hostname.toLowerCase();
  } catch {
    return undefined;
  }
}

function getAllowedHosts(): string[] {
  const allowedHosts = new Set<string>(LOOPBACK_ALLOWED_HOSTS);
  const configuredHost = getConfiguredAllowedHost();
  if (configuredHost) {
    allowedHosts.add(configuredHost);
  }

  return [...allowedHosts];
}

function toRouteSegments(routePath: string): string[] {
  return routePath.split('/').filter(Boolean);
}

function isAuthProtectedRequestPath(pathname: string): boolean {
  const requestSegments = pathname.split('/').filter(Boolean);
  return authProtectedRouteSegmentPatterns.some((routeSegments) =>
    routePatternMatchesPath(routeSegments, requestSegments)
  );
}

function routePatternMatchesPath(routeSegments: string[], pathSegments: string[]): boolean {
  if (!routeSegments.length) {
    return true;
  }

  for (let i = 0; i < routeSegments.length; i++) {
    const routeSegment = routeSegments[i];
    const requestSegment = pathSegments[i];

    if (routeSegment === '**') {
      return true;
    }

    if (requestSegment === undefined) {
      return false;
    }

    if (routeSegment.startsWith(':')) {
      continue;
    }

    if (routeSegment !== requestSegment) {
      return false;
    }
  }

  return true;
}

function getPositiveIntFromEnv(name: string, fallback: number): number {
  const value = process.env[name];
  return getPositiveInt(value, fallback);
}

function getPositiveInt(value: unknown, fallback: number): number {
  if (value === undefined || value === null || value === '') {
    return fallback;
  }
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function getNonNegativeInt(value: unknown, fallback: number): number {
  if (value === undefined || value === null || value === '') {
    return fallback;
  }
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed >= 0 ? parsed : fallback;
}

// The Express app is exported so that it can be used by serverless Functions.
export function app(lang: string): express.Express {
  const server = express();
  const browserDistFolder = join(process.cwd(), `dist/app/browser/${lang}`);
  const staticHtmlFolder = join(process.cwd(), `dist/app/browser/${lang}/static-html`);
  const indexHtml = existsSync(join(browserDistFolder, 'index.original.html'))
    ? join(browserDistFolder, 'index.original.html')
    : join(browserDistFolder, 'index.html');
  const clientRenderIndexHtml = readFileSync(indexHtml, 'utf-8');

  const allowedHosts = getAllowedHosts();
  const commonEngine = new CommonEngine({
    // `NG_ALLOWED_HOSTS` from environment is also merged by Angular internally.
    allowedHosts,
  });
  // console.log(`[SSR][${lang}] allowedHosts: ${allowedHosts.join(', ')}`);

  // Trust configured proxy hops when resolving req.ip for app-level rate limiting.
  // Default is 2 (HAProxy -> nginx -> app), configurable in config.app.ssr.trustProxyHops.
  server.set('trust proxy', SSR_TRUST_PROXY_HOPS);
  server.set('view engine', 'html');
  server.set('views', browserDistFolder);

  // Serve pre-rendered static HTML files from /static-html
  // If the file is missing, the next middleware sends a 404
  server.use('/static-html', express.static(staticHtmlFolder, {
    maxAge: '1d',
    index: false,
    redirect: false
  }));

  // Handle 404 for /static-html, this is to prevent the built-in Angular wildcard route for
  // 404 pages from handling missing files in the path
  server.use('/static-html', (req, res) => {
    res.status(404).send('File not found');
  });

  // Serve unversioned files (robots.txt, etc.) with no caching
  server.get(['/robots.txt', '/sitemap.txt', '/favicon.ico'], express.static(browserDistFolder, {
    maxAge: 0
  }));

  // Serve assets (like images in /assets/) with short caching
  server.use('/assets', express.static(join(browserDistFolder, 'assets'), {
    maxAge: '1d',
    index: false,
    redirect: false
  }));

  // Serve other static files from /browser, these should be hashed so serve with long-term caching
  server.use(express.static(browserDistFolder, {
    maxAge: '1y',
    index: false,
    redirect: false
  }));

  // Prevent Angular SSR from handling requests for known static file types (e.g. missing images or fonts)
  // These files should either be served statically or return a fast 404 without bootstrapping Angular
  const staticExtensions = new Set([
    '.png', '.jpg', '.jpeg', '.gif', '.svg', '.webp', '.avif', '.ico',
    '.woff', '.woff2', '.ttf', '.otf', '.eot',
    '.mp4', '.webm', '.mp3', '.wav', '.ogg',
    '.pdf', '.txt'
  ]);
  server.use((req, res, next) => {
    const url = req.url.split(/[?#]/, 1)[0].toLowerCase();
    const ext = url.slice(url.lastIndexOf('.'));
    if (staticExtensions.has(ext) && !url.startsWith('/ebook/')) {
      res.status(404).send('File with ' + ext + ' extension not found');
      return;
    }
    next();
  });

  // Bypass Chrome DevTools probe so it does not consume SSR limiter capacity.
  server.get('/.well-known/appspecific/com.chrome.devtools.json', (_req, res) => {
    res.status(204).end();
  });

  const renderRequestRateLimiter = rateLimit({
    windowMs: SSR_RATE_LIMIT_WINDOW_MS,
    limit: SSR_RATE_LIMIT_LIMIT,
    standardHeaders: true,
    legacyHeaders: false,
    message: 'Too many requests, please try again later.'
  });

  // Catch-all route: render Angular app for non-static paths (SSR or client-side routes, including 404 pages)
  server.use(renderRequestRateLimiter, (req, res, next) => {
    // console.log(`[SSR] Rendering URL: ${req.url}`);
    const { protocol, originalUrl, baseUrl, headers } = req;
    // Temporary request debug snippet (keep commented unless troubleshooting):
    // const forwardedForHeader = req.headers['x-forwarded-for'];
    // const forwardedFor = Array.isArray(forwardedForHeader)
    //   ? forwardedForHeader.join(', ')
    //   : forwardedForHeader ?? '-';
    // console.log(`[SSR rate-limit debug] ${req.method} ${originalUrl} ip=${req.ip} xff=${forwardedFor}`);

    // Set Vary: User-Agent header for dynamically rendered pages
    res.setHeader('Vary', 'User-Agent');

    if (authEnabled && isAuthProtectedRequestPath(req.path)) {
      // Auth-protected routes are intentionally client-rendered to avoid SSR auth state mismatch.
      res.status(200).type('html').send(clientRenderIndexHtml);
      return;
    }

    // * Inlining critical CSS is disabled here and in angular.json:
    // * architect.build.configurations.production.optimization.styles.inlineCritical
    commonEngine
      .render({
        bootstrap: AppServerModule,
        documentFilePath: indexHtml,
        url: `${protocol}://${headers.host}${originalUrl}`,
        inlineCriticalCss: false,
        publicPath: browserDistFolder,
        providers: [
          { provide: APP_BASE_HREF, useValue: baseUrl },
          { provide: LOCALE_ID, useValue: lang },
          { provide: REQUEST, useValue: req },
        ],
      })
      .then((html) => res.send(html))
      .catch((err) => next(err));
  });

  return server;
}

// * In production mode, the server is started by proxy-server.js
// * and this function is never run.
function runDev(): void {
  const port = process.env['PORT'] || 4000;

  // Start up the Node server
  const appSv = app('sv');
  const server = express();
  server.use('/sv', appSv);
  server.use('', appSv);
  server.listen(port, (error) => {
    if (error) {
      throw error;
    }
    console.log(`Node Express dev server listening on http://localhost:${port}`);
  });
}

// Webpack will replace 'require' with '__webpack_require__'
// '__non_webpack_require__' is a proxy to Node 'require'
// The below code is to ensure that the server is run only when not requiring the bundle.
// * This is run ONLY in development mode!
declare const __non_webpack_require__: NodeRequire;
const mainModule = __non_webpack_require__.main;
const moduleFilename = mainModule && mainModule.filename || '';
if (
  !environment.production &&
  (moduleFilename === __filename || moduleFilename.includes('iisnode'))
) {
  runDev();
}

export * from './src/main.server';
