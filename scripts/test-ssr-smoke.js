#!/usr/bin/env node

const { performance } = require('node:perf_hooks');

/**
 * SSR smoke tests for a running SSR server (typically localhost).
 *
 * Purpose:
 * - Quickly verify that selected routes return server-rendered HTML.
 * - Catch regressions where key content disappears from the initial HTML response.
 * - Provide a repeatable alternative to manual checks in browser DevTools.
 *
 * What each test asserts:
 * - HTTP status is 200.
 * - Content-Type includes "text/html".
 * - Response body contains one or more expected SSR markers.
 *
 * This script checks the raw HTTP response body from the server.
 * It does not execute client-side JavaScript.
 *
 * Usage:
 * - npm run test:ssr:smoke
 * - npm run test:ssr:smoke -- --base-url=http://localhost:4201
 * - npm run test:ssr:smoke -- --base-url=https://topelius.sls.fi
 * - npm run test:ssr:smoke -- --timeout-ms=5000
 *
 * Exit codes:
 * - 0: all tests passed.
 * - 1: at least one test failed, or script/runtime error.
 *
 * Maintenance:
 * - Keep TEST_CASES aligned with stable SSR output.
 * - Prefer short, deterministic snippets that should always be present.
 * - Use "regex" checks only when attribute order may vary in generated HTML.
 * - Use per-test `headers` to simulate proxy behavior (for example forwarded HTTPS).
 */
const DEFAULT_BASE_URL = 'http://localhost:4201';
const DEFAULT_TIMEOUT_MS = 30000;

/**
 * Test cases for SSR route verification.
 *
 * Check types:
 * - includes: strict substring match.
 * - regex: regular-expression match (useful for attribute-order tolerance).
 *
 * Optional test-case fields:
 * - headers: request headers to send for the route.
 */
const TEST_CASES = [
  {
    name: 'Home page Markdown sv',
    route: '/sv/',
    checks: [
      {
        description: 'Contains Swedish home markdown snippet',
        type: 'includes',
        value: '<i class="sc-ion-content">Ljungblommor</i>',
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
        value: '<b class="sc-ion-content">Lyriikka</b>',
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
        value: '<h1 class="sc-ion-content">Zacharias Topelius</h1>',
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
    checks: [
      {
        description: 'Contains collection text snippet',
        type: 'includes',
        value: '<span class="tei tooltip ttAbbreviations sc-ion-content">Mina Herrar</span>',
      },
    ],
  },
  {
    name: 'SEO tags collection text sv',
    route: '/sv/collection/216/text/20280',
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
    name: 'Ionic SSR ion-button structure',
    route: '/sv/collection/200/text/19870',
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
    name: 'SEO canonical strips query params',
    route: '/sv/collection/211/text/20128?views=(type:readingtext)',
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
];

function printHelp() {
  console.log(`
SSR smoke test utility

Usage:
  npm run test:ssr:smoke
  npm run test:ssr:smoke -- [options]

Options:
  --base-url <url> | --base-url=<url>     Base URL (default: ${DEFAULT_BASE_URL})
  --timeout-ms <n> | --timeout-ms=<n>     Request timeout in ms (default: ${DEFAULT_TIMEOUT_MS})
  --help, -h                              Show this help
`.trim());
}

function parseArgs(argv) {
  const opts = {
    baseUrl: DEFAULT_BASE_URL,
    timeoutMs: DEFAULT_TIMEOUT_MS,
    help: false,
  };

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];

    if (arg === '--help' || arg === '-h') {
      opts.help = true;
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
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  const started = performance.now();

  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: headers || undefined,
    });
    const body = await response.text();
    const elapsedMs = performance.now() - started;
    return {
      ok: true,
      status: response.status,
      contentType: response.headers.get('content-type') || '',
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

function runCheck(body, check) {
  if (check.type === 'includes') {
    const matched = body.includes(check.value);
    return {
      passed: matched,
      reason: matched
        ? ''
        : `Missing expected HTML snippet: ${JSON.stringify(check.value)}`,
    };
  }

  if (check.type === 'regex') {
    const matched = check.value.test(body);
    return {
      passed: matched,
      reason: matched
        ? ''
        : `Missing expected HTML pattern: ${check.value.toString()}`,
    };
  }

  return {
    passed: false,
    reason: `Unsupported check type: ${check.type}`,
  };
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

  if (response.status !== 200) {
    errors.push(`Expected HTTP 200, got ${response.status}`);
  }

  if (!response.contentType.toLowerCase().includes('text/html')) {
    errors.push(`Expected Content-Type containing text/html, got ${response.contentType || '(missing)'}`);
  }

  for (const check of testCase.checks) {
    const result = runCheck(response.body, check);
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
  console.log(`Running ${TEST_CASES.length} SSR smoke tests...\n`);

  const results = [];
  for (const testCase of TEST_CASES) {
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

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
