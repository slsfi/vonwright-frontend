/*
 * Regression tests for static collection menus, sitemap TOCs and shared fetch retries.
 *
 * Usage (from the repository root):
 *   npm run test:static-collection-menus
 *   node scripts/test-prebuild-generate-static-collection-menus.js
 *
 * Coverage:
 *   - Shared non-multilingual TOCs are fetched once per collection across languages.
 *   - Menu output files are initialized for each collection and language.
 *   - Both generators use the shared collection TOC fetch policy.
 *   - TOC requests use five retries with quadratic cooldowns and no client timeouts.
 *   - Slow, streamed TOC responses larger than 1 MB are read completely.
 *   - Exhausted retries report failure after the expected number of attempts.
 *
 * Run after changing either generator or the fetch helpers in prebuild-common-fns.js.
 * Uses mocked configuration, translations and file writes, plus a local HTTP fixture;
 * no backend, generated output, or build is needed.
 *
 * Exit codes:
 *   0: all checks passed.
 *   1: an assertion or runtime error occurred.
 */

const assert = require('assert/strict');
const fs = require('fs');
const http = require('node:http');
const https = require('node:https');
const { EventEmitter } = require('node:events');
const { Readable } = require('node:stream');
const common = require('../prebuild-common-fns');
const { generateStaticCollectionMenus } = require('../prebuild-generate-static-collection-menus');
const { generateSitemap } = require('../prebuild-generate-sitemap');


async function testSharedTocDataIsFetchedOnce() {
  const original = {
    appendFileSync: fs.appendFileSync,
    writeFileSync: fs.writeFileSync,
    fetchWithRetry: common.fetchWithRetry,
    fetchCollectionToc: common.fetchCollectionToc,
    getConfig: common.getConfig,
    getTranslation: common.getTranslation,
    sleep: common.sleep,
    consoleLog: console.log,
    consoleWarn: console.warn
  };
  const fetchCalls = [];
  const initializedFiles = [];

  try {
    common.getConfig = () => ({
      app: {
        auth: { enabled: false },
        backendBaseURL: 'https://api.example.test',
        i18n: {
          languages: [{ code: 'sv' }, { code: 'fi' }],
          multilingualCollectionTableOfContents: false
        },
        prebuild: { staticCollectionMenus: true },
        projectNameDB: 'edition',
        ssr: { collectionSideMenu: false }
      },
      collections: {
        frontMatterPages: {},
        order: [[1, 2]]
      }
    });
    common.getTranslation = () => 'translation';
    common.fetchWithRetry = async (...args) => {
      fetchCalls.push(args);
      if (args[0].endsWith('/collections')) {
        return [
          { id: 1, title: 'Collection 1' },
          { id: 2, title: 'Collection 2' }
        ];
      }
      assert.fail(`Unexpected request: ${args[0]}`);
    };
    common.fetchCollectionToc = async endpoint => {
      fetchCalls.push([endpoint]);
      const collectionId = Number(endpoint.split('/').pop());
      return {
        collectionId,
        children: [{ itemId: `${collectionId}_100`, text: `Text ${collectionId}` }]
      };
    };
    common.sleep = async () => {};
    fs.writeFileSync = filePath => initializedFiles.push(filePath);
    fs.appendFileSync = () => {};
    console.log = () => {};
    console.warn = () => {};

    await generateStaticCollectionMenus();

    assert.deepEqual(
      fetchCalls.map(call => call[0]),
      [
        'https://api.example.test/edition/collections',
        'https://api.example.test/edition/toc/1',
        'https://api.example.test/edition/toc/2'
      ]
    );
    assert.deepEqual(
      initializedFiles.map(filePath => filePath.split(/[\\/]/).pop()).sort(),
      ['1_fi.htm', '1_sv.htm', '2_fi.htm', '2_sv.htm']
    );
  } finally {
    fs.appendFileSync = original.appendFileSync;
    fs.writeFileSync = original.writeFileSync;
    common.fetchWithRetry = original.fetchWithRetry;
    common.fetchCollectionToc = original.fetchCollectionToc;
    common.getConfig = original.getConfig;
    common.getTranslation = original.getTranslation;
    common.sleep = original.sleep;
    console.log = original.consoleLog;
    console.warn = original.consoleWarn;
  }
}


async function testSitemapUsesCollectionTocFetcher() {
  const original = {
    appendFileSync: fs.appendFileSync,
    writeFileSync: fs.writeFileSync,
    fetchWithRetry: common.fetchWithRetry,
    fetchCollectionToc: common.fetchCollectionToc,
    getConfig: common.getConfig,
    consoleLog: console.log
  };
  const tocEndpoints = [];
  const sitemapLines = [];

  try {
    common.getConfig = () => ({
      app: {
        backendBaseURL: 'https://api.example.test',
        projectNameDB: 'edition',
        siteURLOrigin: 'https://edition.example.test',
        i18n: { defaultLanguage: 'fi', multilingualCollectionTableOfContents: true }
      },
      collections: { order: [[1]] },
      component: { mainSideMenu: { items: { collections: true } } }
    });
    common.fetchWithRetry = async endpoint => {
      assert.equal(endpoint, 'https://api.example.test/edition/collections/fi');
      return [{ id: 1 }];
    };
    common.fetchCollectionToc = async endpoint => {
      tocEndpoints.push(endpoint);
      return { children: [{ itemId: '1_100' }, { itemId: '1_100_2' }] };
    };
    fs.writeFileSync = () => {};
    fs.appendFileSync = (_filePath, content) => sitemapLines.push(content);
    console.log = () => {};

    await generateSitemap();

    assert.deepEqual(tocEndpoints, ['https://api.example.test/edition/toc/1/fi']);
    assert.ok(sitemapLines.includes('https://edition.example.test/fi/collection/1/text/100\n'));
    assert.ok(sitemapLines.includes('https://edition.example.test/fi/collection/1/text/100/2\n'));
  } finally {
    fs.appendFileSync = original.appendFileSync;
    fs.writeFileSync = original.writeFileSync;
    common.fetchWithRetry = original.fetchWithRetry;
    common.fetchCollectionToc = original.fetchCollectionToc;
    common.getConfig = original.getConfig;
    console.log = original.consoleLog;
  }
}


async function testRetryCountAndIncrementalCooldown() {
  const originalFetch = global.fetch;
  const originalConsoleWarn = console.warn;
  const originalConsoleError = console.error;
  const warnings = [];
  const errors = [];
  let fetchCount = 0;

  try {
    global.fetch = async () => {
      fetchCount++;
      return { ok: false, status: 503 };
    };
    console.warn = message => warnings.push(message);
    console.error = message => errors.push(message);

    const result = await common.fetchWithRetry('https://api.example.test/toc/1', 3, 0, 1);
    const retryWarnings = warnings.filter(message => message.startsWith('Fetch failed'));

    assert.equal(result, null);
    assert.equal(fetchCount, 4);
    assert.deepEqual(retryWarnings, [
      'Fetch failed for https://api.example.test/toc/1. Retrying (1/3) in 0ms...',
      'Fetch failed for https://api.example.test/toc/1. Retrying (2/3) in 1ms...',
      'Fetch failed for https://api.example.test/toc/1. Retrying (3/3) in 2ms...'
    ]);
    assert.deepEqual(errors, [
      'Fetch failed for https://api.example.test/toc/1 after 4 attempts (3 retries).'
    ]);
  } finally {
    global.fetch = originalFetch;
    console.warn = originalConsoleWarn;
    console.error = originalConsoleError;
  }
}


async function testTocRetryPolicy(succeedOnLastAttempt) {
  const originalGet = http.get;
  const originalSetTimeout = global.setTimeout;
  const originalConsoleWarn = console.warn;
  const originalConsoleError = console.error;
  const delays = [];
  const errors = [];
  const toc = { children: [{ itemId: '1_100' }] };
  let fetchCount = 0;
  const failedResponses = [];

  try {
    http.get = (_endpoint, _options, onResponse) => {
      fetchCount++;
      const request = new EventEmitter();
      queueMicrotask(() => {
        if (fetchCount === 1) {
          request.emit('error', new Error('Connection reset'));
        } else if (fetchCount === 2) {
          onResponse(createMockResponse('{', 200));
        } else if (succeedOnLastAttempt && fetchCount === 6) {
          onResponse(createMockResponse(JSON.stringify(toc), 200));
        } else {
          const response = createMockResponse('Unavailable', 503);
          failedResponses.push(response);
          onResponse(response);
        }
      });
      return request;
    };
    // Record the actual requested waits without delaying the test.
    global.setTimeout = (callback, delay) => {
      delays.push(delay);
      callback();
    };
    console.warn = () => {};
    console.error = message => errors.push(message);

    const result = await common.fetchCollectionToc('http://api.example.test/toc/1');

    assert.deepEqual(result, succeedOnLastAttempt ? toc : null);
    assert.equal(fetchCount, 6);
    assert.deepEqual(delays, [4000, 9000, 16000, 25000, 36000]);
    assert.equal(failedResponses.length, succeedOnLastAttempt ? 3 : 4);
    assert.ok(failedResponses.every(response => response.destroyed));
    assert.deepEqual(errors, succeedOnLastAttempt ? [] : [
      'Fetch failed for http://api.example.test/toc/1 after 6 attempts (5 retries).'
    ]);
  } finally {
    http.get = originalGet;
    global.setTimeout = originalSetTimeout;
    console.warn = originalConsoleWarn;
    console.error = originalConsoleError;
  }
}


async function testTocTimeoutsAreDisabled() {
  const originalHttpGet = http.get;
  const originalHttpsGet = https.get;
  const requests = [];

  try {
    for (const client of [http, https]) {
      client.get = (url, options, onResponse) => {
        requests.push({ client, url, options });
        queueMicrotask(() => onResponse(createMockResponse('{"children":[]}', 200)));
        return new EventEmitter();
      };
    }

    await common.fetchCollectionToc('http://api.example.test/toc/1');
    await common.fetchCollectionToc('https://api.example.test/toc/1');

    assert.equal(requests.length, 2);
    assert.equal(requests[0].client, http);
    assert.equal(requests[1].client, https);
    for (const { options } of requests) {
      assert.equal(options.timeout, 0);
      assert.equal(options.agent, false);
    }
  } finally {
    http.get = originalHttpGet;
    https.get = originalHttpsGet;
  }
}


function createMockResponse(body, statusCode) {
  const response = Readable.from([Buffer.from(body)]);
  response.statusCode = statusCode;
  response.headers = {};
  return response;
}


async function testLargeStreamedTocResponse() {
  const toc = { children: [{ itemId: '1_100', text: 'åäö'.repeat(180000) }] };
  const body = Buffer.from(JSON.stringify(toc));
  assert.ok(body.length > 1024 * 1024);
  let requestCount = 0;
  const server = http.createServer(async (req, res) => {
    requestCount++;
    assert.equal(req.headers['accept-encoding'], 'identity');
    if (req.url === '/redirect') {
      res.writeHead(302, { Location: '/toc/1' });
      res.end();
      return;
    }
    // Delay headers and the body separately to exercise both response phases.
    await common.sleep(30);
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.flushHeaders();
    for (let offset = 0; offset < body.length; offset += 65536) {
      await common.sleep(5);
      res.write(body.subarray(offset, offset + 65536));
    }
    res.end();
  });

  try {
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    const result = await common.fetchCollectionToc(`http://127.0.0.1:${server.address().port}/redirect`);
    assert.deepEqual(result, toc);
    assert.equal(requestCount, 2);
  } finally {
    await new Promise(resolve => server.close(resolve));
  }
}


async function run() {
  await testSharedTocDataIsFetchedOnce();
  await testSitemapUsesCollectionTocFetcher();
  await testRetryCountAndIncrementalCooldown();
  await testTocRetryPolicy(false);
  await testTocRetryPolicy(true);
  await testTocTimeoutsAreDisabled();
  await testLargeStreamedTocResponse();
  console.log('Static collection menu and sitemap prebuild tests passed.');
}


run().catch(err => {
  console.error(err);
  process.exitCode = 1;
});
