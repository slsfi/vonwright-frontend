#!/usr/bin/env node

/*
 * Regression tests for the production Express middleware and SSR locale helpers.
 *
 * Usage (from the repository root):
 *   npm run test:ssr:server
 *     Builds SSR first, then runs these checks.
 *   node scripts/test-ssr-server.js
 *     Runs against an existing build; run npm run build:ssr after server changes.
 *
 * Coverage:
 *   - Configured locale paths, default-language fallbacks, and deployment prefixes.
 *   - Static files/probes bypassing Angular and the SSR rate limiter.
 *   - Static caching, missing-file responses, and dynamic ebook fall-through.
 *   - Dynamic response limiting and trusted-proxy headers/client IP handling.
 *
 * Requires installed dependencies and dist/app/server/server.mjs. Imports the built
 * middleware without starting the production listener, and uses a render spy in
 * place of Angular. Tests create temporary files and local HTTP servers on available
 * ports, then clean them up; no separately running app or backend is needed.
 *
 * Exit codes:
 *   0: all checks passed.
 *   1: an assertion, import, or runtime error occurred.
 */

const assert = require('node:assert/strict');
const express = require('express');
const fs = require('node:fs');
const http = require('node:http');
const os = require('node:os');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

/** Runs built-server middleware and locale checks with test-owned files and local HTTP servers. */
async function main() {
  const { configureSsrMiddleware } = await import(pathToFileURL(path.resolve(__dirname, '../dist/app/server/server.mjs')));
  const { getServerLocales, getDefaultServerLocale, localizeRequestUrl } =
    await import(pathToFileURL(path.resolve(__dirname, '../src/ssr/server-locales.ts')));
  const fixture = fs.mkdtempSync(path.join(os.tmpdir(), 'ssr-server-'));
  let passed = 0;
  /** Records a named check only after its synchronous or asynchronous assertions succeed. */
  async function check(name, test) {
    await test();
    passed++;
    console.log(`PASS: ${name}`);
  }
  /** Writes a fixture file relative to directory, creating its parent folders as needed. */
  function write(directory, file, content) {
    const target = path.join(directory, file);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, content);
  }
  const project = {
    i18n: { sourceLocale: 'aa', locales: { fr: { subPath: 'francais' }, de: { subPath: 'deutsch' } } },
    architect: { build: { options: { localize: ['fr', 'de'] }, configurations: { production: {} } } }
  };
  const browserFolder = path.join(fixture, 'browser');
  for (const subPath of ['francais', 'deutsch']) {
    const directory = path.join(browserFolder, subPath);
    for (const file of ['index.csr.html', 'robots.txt', 'sitemap.txt', 'favicon.ico', 'assets/image.png',
      'main-EXAMPLE.js', 'static-html/menu.html']) write(directory, file, `${subPath}: ${file}`);
  }
  const locales = getServerLocales(project, browserFolder);
  const defaultLocale = getDefaultServerLocale(locales, 'fr');
  const options = {
    locales, defaultLocale, trustProxyHops: 2,
    trustedProxyAddresses: ['loopback', 'linklocal', 'uniquelocal'],
    rateLimitWindowMs: 60_000, rateLimitLimit: 1
  };
  /**
   * Runs assertions against a temporary Express server with an instrumented render handler.
   * Passes a request helper and captured render calls to test, then closes the listener
   * even when assertions fail. Overrides customize the shared locale/proxy/limiter options.
   */
  async function withServer(overrides, test) {
    const calls = [];
    const app = express();
    configureSsrMiddleware(app, { ...options, ...overrides });
    // The server entry owns rendering and dynamic response headers after the shared middleware.
    app.use((req, res) => {
      calls.push({ url: req.originalUrl, headers: { ...req.headers }, ip: req.ip });
      res.vary('User-Agent');
      res.type('html').send('<app-root>Dynamic response</app-root>');
    });
    const server = http.createServer((req, res) => {
      // Simulate a public peer so local HTTP tests exercise the proxy boundary.
      Object.defineProperty(req.socket, 'remoteAddress', {
        configurable: true, value: req.headers['x-test-remote-address'] || '127.0.0.1'
      });
      delete req.headers['x-test-remote-address'];
      app(req, res);
    });
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    const base = `http://127.0.0.1:${server.address().port}`;
    /** Returns raw status, headers, and body for a fixture request without following redirects. */
    async function request(route, headers = {}) {
      const response = await fetch(base + route, { headers, redirect: 'manual' });
      return { status: response.status, headers: response.headers, body: await response.text() };
    }
    try { await test(request, calls); }
    finally { await new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve())); }
  }
  /** Asserts that a static/probe response carries none of the dynamic SSR rate-limit headers. */
  function withoutLimiter(response) {
    for (const header of ['ratelimit-limit', 'ratelimit-remaining', 'ratelimit-reset', 'ratelimit-policy']) {
      assert.equal(response.headers.get(header), null, header);
    }
  }
  try {
    await check('locale directories and URL paths follow fork configuration', () => {
      assert.deepEqual(locales.map(locale => [locale.code, locale.path]), [['fr', 'francais'], ['de', 'deutsch']]);
      assert.equal(defaultLocale.code, 'fr');
    });
    await check('single-locale output falls back to the emitted locale', () => {
      const single = path.join(fixture, 'single');
      write(single, 'deutsch/index.csr.html', 'shell');
      const emitted = getServerLocales(project, single);
      assert.deepEqual(emitted.map(locale => locale.code), ['de']);
      assert.equal(getDefaultServerLocale(emitted, 'fr').code, 'de');
    });
    await check('in-memory builds retain configured locales without inventing output directories', () => {
      assert.deepEqual(getServerLocales(project, path.join(fixture, 'not-emitted')).map(locale => locale.code), ['fr', 'de']);
      assert.deepEqual(getServerLocales(project, path.join(fixture, 'single'), false).map(locale => locale.code), ['fr', 'de']);
    });
    await check('disabled localization keeps the source app at the browser root', () => {
      for (const localize of [false, []]) {
        const unlocalizedProject = structuredClone(project);
        unlocalizedProject.architect.build.options.localize = localize;
        const unlocalized = getServerLocales(unlocalizedProject, browserFolder);
        assert.deepEqual(unlocalized.map(locale => [locale.code, locale.path, locale.browserFolder]),
          [['aa', '', browserFolder]]);
        const url = new URL('https://edition.example/about');
        assert.equal(localizeRequestUrl(url, unlocalized, unlocalized[0]), url);
      }
    });
    await check('default-language URL adaptation preserves escaped paths and queries', () => {
      const url = new URL('https://edition.example/about/a%20b?search=a%2Bb');
      assert.equal(localizeRequestUrl(url, locales, defaultLocale).href,
        'https://edition.example/francais/about/a%20b?search=a%2Bb');
      assert.equal(url.pathname, '/about/a%20b');
      for (const route of ['/deutsch/about', '/francais/']) {
        assert.equal(localizeRequestUrl(new URL('https://edition.example' + route), locales, defaultLocale).pathname, route);
      }
    });
    await check('deployment base paths are preserved without duplicating their prefix', () => {
      const nestedProject = structuredClone(project);
      nestedProject.architect.build.options.baseHref = '/edition/';
      const nestedLocales = getServerLocales(nestedProject, browserFolder);
      const nestedDefault = getDefaultServerLocale(nestedLocales, 'fr');
      assert.equal(localizeRequestUrl(new URL('https://edition.example/edition/about?menu=open'), nestedLocales, nestedDefault).href,
        'https://edition.example/edition/francais/about?menu=open');
    });
    await check('single-locale forks serve localized and unprefixed static paths', async () => {
      const single = [locales[1]];
      await withServer({ locales: single, defaultLocale: single[0] }, async (request, calls) => {
        for (const route of ['/robots.txt', '/deutsch/robots.txt']) {
          const response = await request(route);
          assert.equal(response.status, 200);
          assert.equal(response.body, 'deutsch: robots.txt');
          withoutLimiter(response);
        }
        assert.equal(calls.length, 0);
      });
    });
    await check('nested deployment paths preserve static caching and the ebook exception', async () => {
      const nestedProject = structuredClone(project);
      nestedProject.architect.build.options.baseHref = '/edition/';
      const nestedLocales = getServerLocales(nestedProject, browserFolder);
      await withServer({ locales: nestedLocales, defaultLocale: getDefaultServerLocale(nestedLocales, 'fr') }, async (request, calls) => {
        for (const route of ['/edition/robots.txt', '/edition/deutsch/robots.txt']) {
          const response = await request(route);
          assert.equal(response.status, 200);
          withoutLimiter(response);
        }
        assert.equal(calls.length, 0);
        assert.equal((await request('/edition/deutsch/ebook/book.pdf')).status, 200);
        assert.equal(calls.length, 1);
      });
    });
    await withServer({}, async (request, calls) => {
      await check('static files in both locales and at the unprefixed root bypass Angular', async () => {
        for (const [prefix, content] of [['/francais', 'francais'], ['/deutsch', 'deutsch'], ['', 'francais']]) {
          for (const file of ['robots.txt', 'sitemap.txt', 'favicon.ico', 'assets/image.png', 'main-EXAMPLE.js', 'static-html/menu.html']) {
            const response = await request(`${prefix}/${file}`);
            assert.equal(response.status, 200);
            assert.equal(response.body, `${content}: ${file}`);
            withoutLimiter(response);
            const maxAge = ['robots.txt', 'sitemap.txt', 'favicon.ico'].includes(file) ? 0
              : file.startsWith('assets/') || file.startsWith('static-html/') ? 86400 : 31536000;
            assert.equal(response.headers.get('cache-control'), `public, max-age=${maxAge}`);
          }
        }
        assert.equal(calls.length, 0);
      });
      await check('missing static files and static-html return fast 404s without Angular', async () => {
        for (const prefix of ['/francais', '/deutsch', '']) {
          for (const file of ['missing.png?query=1', 'missing.woff2', 'static-html/missing.html', 'static-html/']) {
            const response = await request(`${prefix}/${file}`);
            assert.equal(response.status, 404);
            withoutLimiter(response);
          }
        }
        assert.equal(calls.length, 0);
      });
      await check('DevTools probes bypass Angular and consume no SSR limiter capacity', async () => {
        for (const prefix of ['/francais', '/deutsch', '']) {
          const response = await request(`${prefix}/.well-known/appspecific/com.chrome.devtools.json`);
          assert.equal(response.status, 204);
          assert.equal(response.body, '');
          withoutLimiter(response);
        }
        assert.equal(calls.length, 0);
      });
      await check('dynamic requests reach Angular, retain Vary, and are rate limited', async () => {
        const first = await request('/francais/about');
        assert.equal(first.status, 200);
        assert.equal(first.headers.get('ratelimit-remaining'), '0');
        assert.match(first.headers.get('vary'), /User-Agent/);
        assert.equal(calls.length, 1);
        assert.equal((await request('/deutsch/about')).status, 429);
        assert.equal(calls.length, 1);
      });
      await check('static files and probes remain available after the dynamic quota is exhausted', async () => {
        for (const route of ['/deutsch/robots.txt', '/assets/image.png', '/francais/static-html/menu.html']) {
          const response = await request(route);
          assert.equal(response.status, 200);
          withoutLimiter(response);
        }
        assert.equal((await request('/.well-known/appspecific/com.chrome.devtools.json')).status, 204);
        assert.equal(calls.length, 1);
      });
    });
    await withServer({ rateLimitLimit: 10 }, async (request, calls) => {
      await check('ebook PDF routes still reach the dynamic handler', async () => {
        assert.equal((await request('/deutsch/ebook/book.pdf')).status, 200);
        assert.equal(calls.length, 1);
      });
      const forwarding = {
        'x-forwarded-host': 'edition.example', 'x-forwarded-proto': 'https',
        'x-forwarded-for': '192.0.2.45, 10.0.0.4', 'x-forwarded-prefix': '/spoof',
        forwarded: 'host=attacker.example;proto=http'
      };
      await check('trusted proxy origin headers and client IP pass through without duplicating Angular header filtering', async () => {
        assert.equal((await request('/francais/about', forwarding)).status, 200);
        const call = calls.at(-1);
        assert.equal(call.headers['x-forwarded-host'], 'edition.example');
        assert.equal(call.headers['x-forwarded-proto'], 'https');
        assert.equal(call.ip, '192.0.2.45');
        assert.equal(call.headers.forwarded, forwarding.forwarded);
        assert.equal(call.headers['x-forwarded-prefix'], forwarding['x-forwarded-prefix']);
      });
      await check('direct untrusted peers cannot spoof the origin or limiter client IP', async () => {
        assert.equal((await request('/francais/about', { ...forwarding, 'x-test-remote-address': '198.51.100.10' })).status, 200);
        const call = calls.at(-1);
        assert.equal(call.headers['x-forwarded-host'], undefined);
        assert.equal(call.headers['x-forwarded-proto'], undefined);
        // Express ignores this untrusted IP chain; Angular owns filtering of the other headers.
        assert.equal(call.headers['x-forwarded-for'], forwarding['x-forwarded-for']);
        assert.equal(call.headers.forwarded, forwarding.forwarded);
        assert.equal(call.headers['x-forwarded-prefix'], forwarding['x-forwarded-prefix']);
        assert.equal(call.ip, '198.51.100.10');
      });
    });
    await withServer({ trustProxyHops: 0 }, async (request, calls) => {
      await check('zero proxy hops disables forwarding even from a loopback peer', async () => {
        assert.equal((await request('/about', { 'x-forwarded-host': 'attacker.example', 'x-forwarded-proto': 'https' })).status, 200);
        assert.equal(calls[0].headers['x-forwarded-host'], undefined);
        assert.equal(calls[0].headers['x-forwarded-proto'], undefined);
      });
    });
    console.log(`All SSR server checks passed (${passed}/${passed}).`);
  } finally {
    // The resolved cleanup target must remain the exact test-owned OS temp directory.
    assert.equal(path.dirname(fixture), path.resolve(os.tmpdir()));
    assert.ok(path.basename(fixture).startsWith('ssr-server-'));
    fs.rmSync(fixture, { recursive: true, force: true });
  }
}

main().catch(error => { console.error(error); process.exitCode = 1; });
