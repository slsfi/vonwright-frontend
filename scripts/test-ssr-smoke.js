#!/usr/bin/env node

/*
 * Smoke tests for the raw HTTP responses from a running SSR app.
 *
 * Usage (from the repository root):
 *   npm run test:ssr:smoke -- [options]
 *   node scripts/test-ssr-smoke.js [options]
 *
 * For local production checks, run npm run build:ssr and npm run serve:ssr first,
 * then run the smoke tests in another terminal. Use --base-url for a running remote
 * app. Tests check response HTML and headers without executing browser JavaScript.
 * The default cases use base-app content; forks can supply their own --cases-file.
 *
 * Coverage:
 *   - Expected status, content type, HTML snippets, and response headers.
 *   - Populated Angular SSR roots and CSR shells for auth-protected routes.
 *   - SEO/default-language URLs, missing static files, and probe responses.
 *
 * Supported CLI arguments (value options accept --name=value or --name value):
 *   --base-url <url>
 *     Running app URL (default: http://localhost:4201).
 *   --timeout-ms <n>
 *     Per-request timeout in milliseconds, at least 1000 (default: 30000).
 *   --auth-enabled
 *     Expect CSR shells for protected routes; build the app with auth enabled first.
 *   --cases-file <path>
 *     JSON array of test cases, relative to the working directory or absolute.
 *     Supports literal includes checks only; defaults to the built-in base-app cases.
 *   --help | -h
 *     Show help without sending requests.
 *
 * Examples:
 *   npm run test:ssr:smoke
 *   npm run test:ssr:smoke -- --auth-enabled
 *   npm run test:ssr:smoke -- --base-url=https://edition.example --cases-file=smoke-cases.json
 *
 * Exit codes:
 *   0: all tests passed, or help was requested.
 *   1: at least one test failed, or an option/runtime error occurred.
 *
 * Maintenance:
 *   Keep TEST_CASES aligned with stable output and prefer short, deterministic snippets.
 *   Regex checks require code-owned RegExp literals; JSON cases cannot supply patterns.
 *   Use per-test headers to simulate proxy behavior (for example forwarded HTTPS).
 */

const http = require('node:http');
const https = require('node:https');
const fs = require('node:fs');
const { performance } = require('node:perf_hooks');

const DEFAULT_BASE_URL = 'http://localhost:4201';
const DEFAULT_TIMEOUT_MS = 30000;

/**
 * Test cases for SSR route verification.
 *
 * Check types:
 * - includes: strict substring match.
 * - regex: code-owned RegExp literal (useful for attribute-order tolerance; unavailable in JSON).
 *
 * Optional test-case fields:
 * - headers: request headers to send for the route.
 * - expectedStatus: expected HTTP status (defaults to 200).
 * - expectedLocation: exact Location header for an expected redirect.
 * - authProtected/authOnly: expect a CSR shell with --auth-enabled.
 * - renderMode: ssr (default), csr, or none for static/probe responses.
 * - absentHeaders: headers that must not be present (e.g. SSR limiter headers).
 */
const TEST_CASES = [
  {
    name: 'Home page Markdown sv',
    route: '/sv/',
    checks: [
      {
        description: 'Contains Swedish home markdown snippet',
        type: 'includes',
        value: '<i>Ljungblommor</i>',
      },
    ],
  },
  {
    name: 'SEO tags home sv',
    route: '/sv/',
    checks: [
      {
        description: 'Canonical link points to Swedish home',
        type: 'includes',
        value: '<link rel="canonical" href="http://localhost:4201/sv/">',
      },
      {
        description: 'Alternate hreflang sv points to Swedish home',
        type: 'includes',
        value: '<link rel="alternate" hreflang="sv" href="http://localhost:4201/sv/">',
      },
      {
        description: 'Alternate hreflang fi points to Finnish home',
        type: 'includes',
        value: '<link rel="alternate" hreflang="fi" href="http://localhost:4201/fi/">',
      },
      {
        description: 'Alternate hreflang x-default points to Swedish home',
        type: 'includes',
        value: '<link rel="alternate" hreflang="x-default" href="http://localhost:4201/sv/">',
      },
      {
        description: 'og:url points to Swedish home',
        type: 'includes',
        value: '<meta property="og:url" content="http://localhost:4201/sv/">',
      },
    ],
  },
  {
    name: 'Home page Markdown fi',
    route: '/fi/',
    checks: [
      {
        description: 'Contains Finnish home markdown snippet',
        type: 'includes',
        value: '<b>Lyriikka</b>',
      },
    ],
  },
  {
    name: 'SEO tags home fi',
    route: '/fi/',
    checks: [
      {
        description: 'Canonical link points to Swedish home',
        type: 'includes',
        value: '<link rel="canonical" href="http://localhost:4201/sv/">',
      },
      {
        description: 'Alternate hreflang sv points to Swedish home',
        type: 'includes',
        value: '<link rel="alternate" hreflang="sv" href="http://localhost:4201/sv/">',
      },
      {
        description: 'Alternate hreflang fi points to Finnish home',
        type: 'includes',
        value: '<link rel="alternate" hreflang="fi" href="http://localhost:4201/fi/">',
      },
      {
        description: 'Alternate hreflang x-default points to Swedish home',
        type: 'includes',
        value: '<link rel="alternate" hreflang="x-default" href="http://localhost:4201/sv/">',
      },
      {
        description: 'og:url points to Finnish home',
        type: 'includes',
        value: '<meta property="og:url" content="http://localhost:4201/fi/">',
      },
    ],
  },
  {
    name: 'About page Markdown sv',
    route: '/sv/about/03-01-01',
    checks: [
      {
        description: 'Contains About heading',
        type: 'includes',
        value: '<h1>Zacharias Topelius</h1>',
      },
    ],
  },
  {
    name: 'og:title',
    route: '/sv/about/03-01-01',
    checks: [
      {
        description: 'Contains og:title meta tag with expected About-page content',
        type: 'includes',
        value: '<meta property="og:title" content="Zacharias Topelius i korthet">',
      },
    ],
  },
  {
    name: 'Collection text',
    route: '/sv/collection/216/text/20280',
    authProtected: true,
    checks: [
      {
        description: 'Contains collection text snippet',
        type: 'regex',
        value: /<span class="tei(?: tei)? tooltip ttAbbreviations">Mina Herrar<\/span>/,
      },
    ],
  },
  {
    name: 'Collection introduction',
    route: '/sv/collection/203/introduction',
    authProtected: true,
    checks: [
      {
        description: 'Contains collection introduction snippet',
        type: 'includes',
        value: 'Topelius mest kända och till konceptionen mest ambitiösa verk',
      },
    ],
  },
  {
    name: 'Persons index',
    route: '/sv/index/persons',
    authProtected: true,
    checks: [
      {
        description: 'Contains person index entry',
        type: 'includes',
        value: 'Abbas I av Egypten',
      },
    ],
  },
  {
    name: 'Ionic SSR variant select plain-text label',
    // The variants component is deferred during SSR, so provide a deterministic
    // title in the serialized view state to test the parent select template.
    route: '/sv/collection/203/text/20217/ch1?views=(type:variants,uid:v1,id:6872,sortOrder:1,title:SSR+variant+title)',
    authProtected: true,
    headers: {
      'User-Agent': 'Mobi',
    },
    checks: [
      {
        description: 'Contains the selected variant and title as one plain-text label',
        type: 'regex',
        value: /<div aria-hidden="true" class="select-text sc-ion-select-md" part="text"[^>]*><!--[^>]*-->Tryckt variant – SSR variant title<\/div>/,
      },
    ],
  },
  {
    name: 'Ionic SSR ion-button structure',
    route: '/sv/collection/200/text/19870',
    authProtected: true,
    checks: [
      {
        description: 'Contains hydrated ion-button host element',
        type: 'regex',
        value: /<ion-button\b[^>]*\bclass=["'][^"']*\bion-button\b[^"']*\bhydrated\b[^"']*["'][^>]*>/i,
      },
      {
        description: 'Contains native button inside ion-button',
        type: 'regex',
        value: /<ion-button\b[\s\S]*?<button\b[^>]*\bclass=["'][^"']*\bbutton-native\b[^"']*["'][^>]*\bpart=["']native["'][^>]*>/i,
      },
      {
        description: 'Contains expected ion-icon inside ion-button',
        type: 'regex',
        value: /<ion-button\b[\s\S]*?<ion-icon\b[^>]*\bname=["']arrow-redo-sharp["'][^>]*\bhydrated\b[^>]*>/i,
      },
      {
        description: 'Contains expected button label text',
        type: 'regex',
        value: /<ion-button\b[\s\S]*?<span\b[^>]*\bside-title\b[^>]*>\s*Hänvisa\s*<\/span>/i,
      },
    ],
  },
  {
    name: 'SEO tags collection text sv',
    route: '/sv/collection/216/text/20280',
    authProtected: true,
    checks: [
      {
        description: 'Canonical link points to Swedish collection text route',
        type: 'includes',
        value: '<link rel="canonical" href="http://localhost:4201/sv/collection/216/text/20280">',
      },
      {
        description: 'Alternate hreflang sv points to Swedish collection text route',
        type: 'includes',
        value: '<link rel="alternate" hreflang="sv" href="http://localhost:4201/sv/collection/216/text/20280">',
      },
      {
        description: 'Alternate hreflang fi points to Finnish collection text route',
        type: 'includes',
        value: '<link rel="alternate" hreflang="fi" href="http://localhost:4201/fi/collection/216/text/20280">',
      },
      {
        description: 'Alternate hreflang x-default points to Swedish collection text route',
        type: 'includes',
        value: '<link rel="alternate" hreflang="x-default" href="http://localhost:4201/sv/collection/216/text/20280">',
      },
      {
        description: 'og:url points to Swedish collection text route',
        type: 'includes',
        value: '<meta property="og:url" content="http://localhost:4201/sv/collection/216/text/20280">',
      },
    ],
  },
  {
    name: 'SEO canonical strips query params',
    route: '/sv/collection/211/text/20128?views=(type:readingtext)',
    authProtected: true,
    checks: [
      {
        description: 'Canonical link excludes query params',
        type: 'includes',
        value: '<link rel="canonical" href="http://localhost:4201/sv/collection/211/text/20128">',
      },
    ],
  },
  {
    name: 'SEO tags collection text fi',
    route: '/fi/collection/211/text/20128',
    authProtected: true,
    csrChecks: [
      { description: 'Finnish shell locale', type: 'regex', value: /<html\b[^>]*\blang="fi"/ },
      { description: 'Finnish shell asset base', type: 'includes', value: '<base href="/fi/">' },
    ],
    checks: [
      {
        description: 'Canonical link points to Swedish collection text route',
        type: 'includes',
        value: '<link rel="canonical" href="http://localhost:4201/sv/collection/211/text/20128">',
      },
      {
        description: 'Alternate hreflang sv points to Swedish collection text route',
        type: 'includes',
        value: '<link rel="alternate" hreflang="sv" href="http://localhost:4201/sv/collection/211/text/20128">',
      },
      {
        description: 'Alternate hreflang fi points to Finnish collection text route',
        type: 'includes',
        value: '<link rel="alternate" hreflang="fi" href="http://localhost:4201/fi/collection/211/text/20128">',
      },
      {
        description: 'Alternate hreflang x-default points to Swedish collection text route',
        type: 'includes',
        value: '<link rel="alternate" hreflang="x-default" href="http://localhost:4201/sv/collection/211/text/20128">',
      },
      {
        description: 'og:url points to Finnish collection text route',
        type: 'includes',
        value: '<meta property="og:url" content="http://localhost:4201/fi/collection/211/text/20128">',
      },
    ],
  },
  {
    name: 'SEO tags with forwarded https headers (simulated proxy)',
    route: '/sv/collection/219/text/19443',
    authProtected: true,
    headers: {
      Host: 'topelius.sls.fi',
      'X-Forwarded-Host': 'topelius.sls.fi',
      'X-Forwarded-Proto': 'https',
    },
    checks: [
      {
        description: 'Canonical link uses https forwarded origin',
        type: 'includes',
        value: '<link rel="canonical" href="https://topelius.sls.fi/sv/collection/219/text/19443">',
      },
      {
        description: 'og:url uses https forwarded origin',
        type: 'includes',
        value: '<meta property="og:url" content="https://topelius.sls.fi/sv/collection/219/text/19443">',
      },
    ],
  },
  {
    name: 'SEO tags prefer configured HTTPS origin for public host',
    route: '/sv/collection/219/text/19443',
    authProtected: true,
    headers: {
      Host: 'topelius.sls.fi',
      'X-Forwarded-Host': 'topelius.sls.fi',
      'X-Forwarded-Proto': 'http',
    },
    checks: [
      {
        description: 'Canonical link keeps configured https origin',
        type: 'includes',
        value: '<link rel="canonical" href="https://topelius.sls.fi/sv/collection/219/text/19443">',
      },
      {
        description: 'og:url keeps configured https origin',
        type: 'includes',
        value: '<meta property="og:url" content="https://topelius.sls.fi/sv/collection/219/text/19443">',
      },
      {
        description: 'og:image keeps configured https origin',
        type: 'includes',
        value: '<meta property="og:image" content="https://topelius.sls.fi/sv/assets/images/',
      },
    ],
  },
  {
    name: 'Public SEO tags with forwarded HTTPS in both auth modes',
    route: '/sv/about/03-01-01',
    headers: {
      Host: 'topelius.sls.fi',
      'X-Forwarded-Host': 'topelius.sls.fi',
      'X-Forwarded-Proto': 'https',
    },
    checks: [
      { description: 'Public canonical uses forwarded HTTPS', type: 'includes', value: '<link rel="canonical" href="https://topelius.sls.fi/sv/about/03-01-01">' },
      { description: 'Public og:url uses forwarded HTTPS', type: 'includes', value: '<meta property="og:url" content="https://topelius.sls.fi/sv/about/03-01-01">' },
    ],
  },
  {
    name: 'Unprefixed home uses Swedish without redirecting',
    route: '/',
    checks: [
      { description: 'Swedish HTML locale', type: 'regex', value: /<html\b[^>]*\blang="sv"/ },
      { description: 'Swedish home content', type: 'includes', value: '<i>Ljungblommor</i>' },
      { description: 'Canonical uses the default-language URL', type: 'includes', value: '<link rel="canonical" href="http://localhost:4201/sv/">' },
      { description: 'og:url uses the default-language URL', type: 'includes', value: '<meta property="og:url" content="http://localhost:4201/sv/">' },
    ],
  },
  {
    name: 'Unprefixed home ignores Finnish language negotiation',
    route: '/',
    headers: { 'Accept-Language': 'fi' },
    checks: [
      { description: 'Swedish HTML locale', type: 'regex', value: /<html\b[^>]*\blang="sv"/ },
      { description: 'Swedish home content', type: 'includes', value: '<i>Ljungblommor</i>' },
      { description: 'Localized browser asset base', type: 'includes', value: '<base href="/sv/">' },
    ],
  },
  {
    name: 'Finnish public lazy route stays server rendered',
    route: '/fi/about/03-01-01',
    checks: [
      { description: 'Finnish HTML locale', type: 'regex', value: /<html\b[^>]*\blang="fi"/ },
      { description: 'Localized browser asset base', type: 'includes', value: '<base href="/fi/">' },
      { description: 'About page content', type: 'includes', value: '<h1>Zacharias Topelius</h1>' },
      { description: 'Canonical uses the default-language URL', type: 'includes', value: '<link rel="canonical" href="http://localhost:4201/sv/about/03-01-01">' },
      { description: 'og:url uses the requested locale', type: 'includes', value: '<meta property="og:url" content="http://localhost:4201/fi/about/03-01-01">' },
    ],
  },
  {
    name: 'Missing image bypasses Angular and the SSR limiter',
    route: '/sv/__ssr-smoke-missing__.png',
    expectedStatus: 404,
    renderMode: 'none',
    absentHeaders: ['ratelimit-limit'],
    checks: [],
  },
  ...['sv', 'fi', ''].map(locale => ({
    name: `Legacy ebook permanent redirect ${locale || 'default locale'}`,
    route: `${locale ? '/' + locale : ''}/ebook/marriage-conditions-1.pdf`,
    expectedStatus: 301,
    expectedLocation: `/${locale || 'sv'}/ebook/pdf/marriage-conditions-1`,
    renderMode: 'none',
    checks: [],
  })),
  {
    name: 'Legacy ebook redirect encodes the filename and splits at the last dot',
    route: '/fi/ebook/Bok%20%C3%A5.andra.epub',
    expectedStatus: 301,
    expectedLocation: '/fi/ebook/epub/Bok%20%C3%A5.andra',
    renderMode: 'none',
    checks: [],
  },
  {
    name: 'Missing static HTML bypasses Angular and the SSR limiter',
    route: '/sv/static-html/__ssr-smoke-missing__.html',
    expectedStatus: 404,
    renderMode: 'none',
    absentHeaders: ['ratelimit-limit'],
    checks: [],
  },
  ...['login', 'register', 'account', 'forgot-password'].map(route => ({
    name: `Auth-only ${route} rendering`,
    route: `/sv/${route}`,
    authOnly: true,
  })),
  {
    name: 'Unprefixed protected lazy route rendering',
    route: '/collection/203/introduction',
    authProtected: true,
    checks: [
      { description: 'Swedish HTML locale', type: 'regex', value: /<html\b[^>]*\blang="sv"/ },
      { description: 'Collection introduction content', type: 'includes', value: 'Topelius mest kända och till konceptionen mest ambitiösa verk' },
      { description: 'Canonical uses the default-language URL', type: 'includes', value: '<link rel="canonical" href="http://localhost:4201/sv/collection/203/introduction">' },
    ],
  },
  {
    name: 'Page not found',
    route: '/sv/__ssr-smoke-page-not-found__',
    expectedStatus: 404,
    checks: [
      {
        description: 'Contains the page-not-found component',
        type: 'includes',
        value: '<page-not-found',
      },
    ],
  },
  ...['sv', 'fi'].flatMap(locale => [false, true].map(mobile => ({
    name: `${mobile ? 'Mobile' : 'Desktop'} SSR layout ${locale}`,
    route: `/${locale}/collection/216/text/20280?views=(type:readingtext)`,
    authProtected: true,
    headers: {
      'User-Agent': mobile
        ? 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) Mobile/15E148 Safari/604.1'
        : 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/154.0.0.0 Safari/537.36',
    },
    csrChecks: [
      { description: 'CSR shell locale', type: 'includes', value: `lang="${locale}"` },
      { description: 'CSR shell asset base', type: 'includes', value: `<base href="/${locale}/">` },
    ],
    checks: [
      { description: 'Requested HTML locale', type: 'includes', value: `lang="${locale}"` },
      { description: 'Canonical excludes query parameters', type: 'includes', value: '<link rel="canonical" href="http://localhost:4201/sv/collection/216/text/20280">' },
      { description: 'og:url uses the requested locale without query parameters', type: 'includes', value: `<meta property="og:url" content="http://localhost:4201/${locale}/collection/216/text/20280">` },
      {
        description: 'Side navigation visibility follows the user agent', type: 'regex',
        value: mobile
          ? /<nav\b(?=[^>]*\bid="side-navigation")[^>]*\bclass="side-navigation visuallyhidden"[^>]*>/
          : /<nav\b(?=[^>]*\bid="side-navigation")[^>]*\bclass="side-navigation"[^>]*>/,
      },
      {
        description: 'Text layout follows the user agent', type: 'regex',
        value: mobile
          ? /class="[^"]*\bmobile-mode-content\b[^"]*"/
          : /<text-changer\b[^>]*\bclass="[^"]*\btext-changer-desktop-mode\b[^"]*"/,
      },
    ],
  }))),
];

function getTestCases(authEnabled, cases = TEST_CASES) {
  return cases.map(testCase => {
    if (authEnabled && (testCase.authProtected || testCase.authOnly)) {
      return { ...testCase, name: `CSR shell: ${testCase.name}`, expectedStatus: 200, renderMode: 'csr', checks: testCase.csrChecks || [] };
    }
    if (testCase.authOnly) {
      return { ...testCase, expectedStatus: 404, renderMode: 'ssr', checks: [
        { description: 'Auth-only route is unavailable', type: 'includes', value: '<page-not-found' },
      ] };
    }
    return { renderMode: 'ssr', ...testCase };
  });
}

function printHelp() {
  console.log(`
SSR smoke test utility

Usage:
  npm run test:ssr:smoke
  npm run test:ssr:smoke -- [options]

Options:
  --base-url <url> | --base-url=<url>     Base URL (default: ${DEFAULT_BASE_URL})
  --timeout-ms <n> | --timeout-ms=<n>     Request timeout in ms (default: ${DEFAULT_TIMEOUT_MS})
  --auth-enabled                         Expect CSR shells for protected routes; build with auth enabled first
  --cases-file <path>                     JSON test cases using literal includes checks (default: base app fixtures)
  --help, -h                              Show this help
`.trim());
}

function parseArgs(argv) {
  const opts = {
    baseUrl: DEFAULT_BASE_URL,
    timeoutMs: DEFAULT_TIMEOUT_MS,
    help: false,
    authEnabled: false,
    casesFile: '',
  };

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];

    if (arg === '--help' || arg === '-h') {
      opts.help = true;
      continue;
    }

    if (arg === '--auth-enabled') {
      opts.authEnabled = true;
      continue;
    }
    if (arg.startsWith('--cases-file=')) {
      opts.casesFile = arg.slice('--cases-file='.length);
      continue;
    }
    if (arg === '--cases-file' && argv[i + 1]) {
      opts.casesFile = argv[++i];
      continue;
    }

    if (arg.startsWith('--base-url=')) {
      opts.baseUrl = arg.slice('--base-url='.length);
      continue;
    }
    if (arg === '--base-url' && argv[i + 1]) {
      opts.baseUrl = argv[++i];
      continue;
    }

    if (arg.startsWith('--timeout-ms=')) {
      opts.timeoutMs = Number(arg.slice('--timeout-ms='.length));
      continue;
    }
    if (arg === '--timeout-ms' && argv[i + 1]) {
      opts.timeoutMs = Number(argv[++i]);
      continue;
    }
    throw new Error(`Unknown option or missing value: ${arg}`);
  }

  if (!Number.isFinite(opts.timeoutMs) || opts.timeoutMs < 1000) {
    throw new Error('Invalid --timeout-ms value');
  }

  return opts;
}

function normalizeRoute(route) {
  if (!route) return '/';
  return route.startsWith('/') ? route : `/${route}`;
}

function getUrl(baseUrl, route) {
  return `${baseUrl.replace(/\/+$/, '')}${normalizeRoute(route)}`;
}

async function fetchHtml(url, timeoutMs, headers) {
  if (hasExplicitHostHeader(headers)) {
    return fetchHtmlWithExplicitHost(url, timeoutMs, headers);
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  const started = performance.now();

  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: headers || undefined,
      redirect: 'manual',
    });
    const body = await response.text();
    const elapsedMs = performance.now() - started;
    return {
      ok: true,
      status: response.status,
      contentType: response.headers.get('content-type') || '',
      headers: Object.fromEntries(response.headers),
      body,
      ms: elapsedMs,
    };
  } catch (error) {
    const elapsedMs = performance.now() - started;
    return {
      ok: false,
      status: 0,
      contentType: '',
      body: '',
      ms: elapsedMs,
      error: error instanceof Error ? error.message : String(error),
    };
  } finally {
    clearTimeout(timeout);
  }
}

function hasExplicitHostHeader(headers) {
  return Object.keys(headers || {}).some((name) => name.toLowerCase() === 'host');
}

/**
 * Node's Fetch implementation does not send an explicitly supplied Host header.
 * Use the low-level HTTP client for proxy tests that need the connection target
 * and public request host to differ.
 */
function fetchHtmlWithExplicitHost(url, timeoutMs, headers) {
  const started = performance.now();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  return new Promise((resolve) => {
    let settled = false;

    const finish = (result) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      resolve({
        ...result,
        ms: performance.now() - started,
      });
    };

    const fail = (error) => {
      finish({
        ok: false,
        status: 0,
        contentType: '',
        body: '',
        error: error instanceof Error ? error.message : String(error),
      });
    };

    let targetUrl;
    try {
      targetUrl = new URL(url);
    } catch (error) {
      fail(error);
      return;
    }

    const client = targetUrl.protocol === 'https:' ? https : http;
    const request = client.get(targetUrl, { headers, signal: controller.signal }, (response) => {
      const chunks = [];
      response.setEncoding('utf8');
      response.on('data', (chunk) => chunks.push(chunk));
      response.on('end', () => {
        const contentType = response.headers['content-type'];
        finish({
          ok: true,
          status: response.statusCode || 0,
          contentType: Array.isArray(contentType) ? contentType[0] || '' : contentType || '',
          headers: response.headers,
          body: chunks.join(''),
        });
      });
      response.on('error', fail);
    });

    request.on('error', fail);
  });
}

function resolveCheckValue(value, baseUrl) {
  if (typeof value !== 'string') {
    return value;
  }

  return value.replace(DEFAULT_BASE_URL, baseUrl.replace(/\/+$/, ''));
}

function runCheck(body, check, baseUrl) {
  const value = resolveCheckValue(check.value, baseUrl);

  if (check.type === 'includes') {
    const matched = body.includes(value);
    return {
      passed: matched,
      reason: matched
        ? ''
        : `Missing expected HTML snippet: ${JSON.stringify(value)}`,
    };
  }

  if (check.type === 'regex') {
    // Only code-owned regex literals are supported. Never compile JSON input.
    if (!(value instanceof RegExp)) {
      return {
        passed: false,
        reason: 'Regex checks require a RegExp literal defined in the script; use literal includes checks in JSON case files',
      };
    }
    const matched = value.test(body);
    return {
      passed: matched,
      reason: matched
        ? ''
        : `Missing expected HTML pattern: ${value.toString()}`,
    };
  }

  return {
    passed: false,
    reason: `Unsupported check type: ${check.type}`,
  };
}

function getRenderingErrors(body, renderMode) {
  const root = body.match(/<app-root\b([^>]*)>([\s\S]*?)<\/app-root>/i);
  const serverRendered = !!root && /\bng-server-context=["']ssr["']/.test(root[1]);
  const transferredState = /<script\b[^>]*\bid=["'][^"']*-state["']/i.test(body);
  const emptyRoot = !!root && !root[2].trim();

  if (renderMode === 'ssr') {
    return serverRendered && !emptyRoot ? [] : ['Expected a populated server-rendered Angular root, got a CSR shell or non-Angular response'];
  }
  if (renderMode === 'csr') {
    return emptyRoot && !serverRendered && !transferredState ? [] : ['Expected an empty CSR shell without server-rendered protected content or transfer state'];
  }
  if (renderMode === 'none') {
    return !root ? [] : ['Static/missing-file response unexpectedly contains the Angular application'];
  }
  return [`Unsupported render mode: ${renderMode}`];
}

async function runTest(baseUrl, timeoutMs, testCase) {
  const url = getUrl(baseUrl, testCase.route);
  const response = await fetchHtml(url, timeoutMs, testCase.headers);
  const errors = [];

  if (!response.ok) {
    errors.push(`Request failed: ${response.error || 'Unknown error'}`);
    return {
      name: testCase.name,
      route: testCase.route,
      url,
      status: 'ERR',
      ms: Number(response.ms.toFixed(2)),
      passed: false,
      errors,
    };
  }

  const expectedStatus = testCase.expectedStatus ?? 200;
  if (response.status !== expectedStatus) {
    errors.push(`Expected HTTP ${expectedStatus}, got ${response.status}`);
  }

  if (testCase.expectedLocation !== undefined && response.headers.location !== testCase.expectedLocation) {
    errors.push(`Expected Location ${testCase.expectedLocation}, got ${response.headers.location || '(missing)'}`);
  }

  if (!response.contentType.toLowerCase().includes('text/html')) {
    errors.push(`Expected Content-Type containing text/html, got ${response.contentType || '(missing)'}`);
  }

  errors.push(...getRenderingErrors(response.body, testCase.renderMode));
  if (testCase.renderMode !== 'none' && !/\buser-agent\b/i.test(response.headers.vary || '')) {
    errors.push('Dynamic response is missing Vary: User-Agent');
  }
  for (const header of testCase.absentHeaders || []) {
    if (response.headers[header.toLowerCase()] !== undefined) {
      errors.push(`Response unexpectedly contains header ${header}`);
    }
  }

  for (const check of testCase.checks || []) {
    const result = runCheck(response.body, check, baseUrl);
    if (!result.passed) {
      errors.push(`${check.description}: ${result.reason}`);
    }
  }

  return {
    name: testCase.name,
    route: testCase.route,
    url,
    status: response.status,
    ms: Number(response.ms.toFixed(2)),
    passed: errors.length === 0,
    errors,
  };
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  if (opts.help) {
    printHelp();
    return;
  }

  console.log(`Base URL: ${opts.baseUrl}`);
  console.log(`Timeout per request: ${opts.timeoutMs} ms`);
  const sourceCases = opts.casesFile ? JSON.parse(fs.readFileSync(opts.casesFile, 'utf8')) : TEST_CASES;
  if (!Array.isArray(sourceCases) || !sourceCases.length) {
    throw new Error('Expected a non-empty array of smoke test cases');
  }
  if (opts.casesFile) {
    for (const testCase of sourceCases) {
      for (const check of [...(testCase.checks || []), ...(testCase.csrChecks || [])]) {
        if (check.type !== 'includes' || typeof check.value !== 'string') {
          throw new Error('JSON case files support only includes checks with literal string values');
        }
      }
    }
  }
  const testCases = getTestCases(opts.authEnabled, sourceCases);
  console.log(`Auth rendering expectations: ${opts.authEnabled ? 'enabled' : 'disabled'}`);
  console.log(`Running ${testCases.length} SSR smoke tests...\n`);

  const results = [];
  for (const testCase of testCases) {
    const result = await runTest(opts.baseUrl, opts.timeoutMs, testCase);
    results.push(result);
    const statusLabel = result.passed ? 'PASS' : 'FAIL';
    console.log(`${statusLabel}: ${result.name} (${result.route}) [${result.status}] ${result.ms} ms`);
    if (!result.passed) {
      for (const error of result.errors) {
        console.log(`  - ${error}`);
      }
    }
  }

  const passed = results.filter((r) => r.passed).length;
  const failed = results.length - passed;

  console.log('\nSummary');
  console.table(
    results.map((result) => ({
      test: result.name,
      route: result.route,
      status: result.status,
      ms: result.ms,
      result: result.passed ? 'PASS' : 'FAIL',
    })),
  );
  console.log(`Passed: ${passed}`);
  console.log(`Failed: ${failed}`);

  if (failed > 0) {
    process.exit(1);
  }
}

if (require.main === module) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  });
}

module.exports = { getTestCases, getRenderingErrors, runCheck, runTest };
