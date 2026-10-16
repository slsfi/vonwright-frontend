/*
 * Regression tests for docker-ssr-memory.js helpers and response validation.
 *
 * Usage (from the repository root):
 *   npm run test:ssr:docker:checks
 *   node scripts/test-docker-ssr-memory.js
 *
 * Coverage:
 *   - Docker memory units and medians of the final idle samples.
 *   - CLI option parsing and invalid argument rejection.
 *   - URL-list normalization, local remapping, comments, BOM, and duplicates.
 *   - Populated SSR responses and rejection of HTTP errors, redirects, CSR shells,
 *     empty roots, timeouts, and cancelled requests.
 *   - Request/idle time limits with partial reports and cleanup through a Docker fixture.
 *   - Stage progress and final idle recovery before the memory budget is evaluated.
 *   - Existing image selection through --skip-build --image, including release tags.
 *   - Background readings spanning stage transitions are excluded from phase history.
 *
 * Requires Node; npm is needed only for the npm command above. Creates temporary
 * URL-list/Docker-command fixtures, child processes, and a local HTTP server on an
 * available port. No Docker daemon, application build, or external services are
 * required. Fixtures, children, and the server are cleaned up after the tests.
 * Use test:ssr:docker to exercise real containers and measure application memory.
 *
 * Exit codes:
 *   0: all checks passed.
 *   1: an assertion or runtime error occurred.
 */

const assert = require('node:assert/strict');
const { execFile } = require('node:child_process');
const fs = require('node:fs');
const http = require('node:http');
const os = require('node:os');
const path = require('node:path');
const { promisify } = require('node:util');
const { parseArgs, loadRoutes, parseMemory, idleMedian, requestPage } = require('./docker-ssr-memory');
const execFileAsync = promisify(execFile);

async function main() {
  assert.equal(parseMemory('256MiB / 1GiB'), 256);
  assert.equal(parseMemory('1.5GiB / 16GiB'), 1536);
  assert.equal(parseMemory('1048576B / 16GiB'), 1);
  assert.equal(parseMemory('1.048576MB / 16GB'), 1);
  assert.throws(() => parseMemory('unknown'), /Unrecognized/);
  assert.throws(() => parseMemory('1.2.3MiB / 1GiB'), /Invalid/);
  assert.equal(idleMedian([
    { phase: 'idle', memoryMib: 500 }, { phase: 'idle', memoryMib: 100 },
    { phase: 'load', memoryMib: 900 }, { phase: 'idle', memoryMib: 110 },
    { phase: 'idle', memoryMib: 105 },
  ], 'idle'), 105);
  assert.equal(idleMedian([{ phase: 'idle', memoryMib: 10 }, { phase: 'idle', memoryMib: 20 }], 'idle'), 15);
  assert.throws(() => idleMedian([], 'idle'), /No memory samples/);
  console.log('PASS: Docker memory units and final idle medians');

  const options = parseArgs(['--cycles=7', '--visits', '10', '--delay-ms=0', '--skip-build', '--max-growth-mib=12.5', '--max-duration-seconds=600', '--final-idle-seconds=180']);
  assert.equal(options.cycles, 7);
  assert.equal(options.visits, 10);
  assert.equal(options.delayMs, 0);
  assert.equal(options.skipBuild, true);
  assert.equal(options.maxGrowthMib, 12.5);
  assert.equal(options.maxDurationSeconds, 600);
  assert.equal(options.finalIdleSeconds, 180);
  for (const args of [['--cycles=0'], ['--visits=1.5'], ['--port=65536'], ['--timeout-ms=NaN'],
    ['--idle-seconds=-1'], ['--max-growth-mib=-1'], ['--image'], ['--unknown'], ['--skip-build=no'],
    ['--max-duration-seconds=0'], ['--max-duration-seconds=1.5'], ['--max-duration-seconds=2147484'],
    ['--final-idle-seconds=0'], ['--final-idle-seconds=-1'], ['--final-idle-seconds=1.5']]) {
    assert.throws(() => parseArgs(args), undefined, `Should reject ${args}`);
  }
  console.log('PASS: CLI values and invalid arguments');

  const tempRoot = path.resolve(os.tmpdir());
  const directory = fs.mkdtempSync(path.join(tempRoot, 'docker-ssr-routes-'));
  const file = path.join(directory, 'urls.txt');
  try {
    fs.writeFileSync(file, '\uFEFF# sitemap export\r\nhttps://production.example/sv/text?q=1#fragment\r\n/fi/\r\n/fi/\r\n//other.example/sv/content\r\n');
    assert.deepEqual(loadRoutes(file), ['/sv/text?q=1', '/fi/', '/sv/content']);
    fs.writeFileSync(file, '# no routes\n');
    assert.throws(() => loadRoutes(file), /empty/);
    fs.writeFileSync(file, 'file:///secret');
    assert.throws(() => loadRoutes(file), /Expected an absolute HTTP URL or route/);
    assert.ok(loadRoutes().length > 1);

    // A child process isolates fixture replacements from the real HTTP checks below.
    const fixture = path.join(directory, 'docker-fixture.cjs');
    const calls = path.join(directory, 'docker-calls.jsonl');
    fs.writeFileSync(fixture, `
      const fs = require('node:fs');
      const { promisify } = require('node:util');
      const calls = ${JSON.stringify(calls)};
      let statsCalls = 0;
      const invoke = async (file, args) => {
        if (file !== 'docker') {
          throw new Error('Unexpected executable: ' + file);
        }
        fs.appendFileSync(calls, JSON.stringify(args) + '\\n');
        let stdout = '';
        if (args[0] === 'info') {
          stdout = 'linux';
        }
        if (args[0] === 'create' || args[0] === 'start') {
          stdout = 'fixture-container';
        }
        if (args[0] === 'stats') {
          statsCalls++;
          if (statsCalls === 2 && process.env.SLS_MEMORY_DELAY_SAMPLE === '1') {
            await new Promise(resolve => setTimeout(resolve, 500));
          }
          const memory = requests >= 3 && Date.now() - lastRequestAt < 1000 ? 200 : 100;
          stdout = JSON.stringify({ MemUsage: memory + 'MiB / 1GiB', CPUPerc: '0%', PIDs: '1' });
        }
        if (args[0] === 'logs') {
          stdout = 'fixture container logs';
        }
        if (args[0] === 'inspect') {
          stdout = JSON.stringify([
            { Image: 'fixture-image', State: { Running: true, OOMKilled: false }, RestartCount: 0 }
          ]);
        }
        return { stdout, stderr: '' };
      };
      require('node:child_process').execFile = Object.assign(function () {}, { [promisify.custom]: invoke });
      let requests = 0;
      let lastRequestAt = 0;
      global.fetch = async (url, { signal }) => {
        if (url.endsWith('/robots.txt')) return new Response('ready');
        requests++;
        lastRequestAt = Date.now();
        if (requests === 1 || process.env.SLS_MEMORY_FIXTURE_COMPLETE === '1') {
          return new Response('<app-root ng-server-context="ssr"><p>Content</p></app-root>');
        }
        return new Promise((resolve, reject) => {
          if (signal.aborted) return reject(signal.reason);
          signal.addEventListener('abort', () => reject(signal.reason), { once: true });
        });
      };
    `);
    fs.writeFileSync(file, '/sv/');
    for (const phase of ['request', 'idle']) {
      const output = path.join(directory, `report-${phase}`);
      await assert.rejects(execFileAsync(process.execPath, ['--require', fixture,
        path.join(__dirname, 'docker-ssr-memory.js'), '--skip-build', '--warmup-visits=1',
        '--delay-ms=0', '--max-duration-seconds=1', '--output', output,
        ...(phase === 'idle' ? ['--routes-file', file] : []),
      ], { timeout: 10000 }), error => error.code === 1
        && /time limit of 1s reached/.test(error.stderr)
        && (phase !== 'idle' || /Stage: Baseline idle - idle/.test(error.stdout)));
      const report = JSON.parse(fs.readFileSync(path.join(output, 'report.json'), 'utf8'));
      assert.equal(report.status, 'failed');
      assert.equal(report.completedRequests, 1);
      assert.match(report.error, /time limit.*incomplete/);
      assert.ok(report.measurementSeconds >= 0.9 && report.measurementSeconds < 5,
        'Should stop before the 30s request timeout or idle period elapses');
      assert.equal(report.cycles.length, 0);
      assert.match(fs.readFileSync(path.join(output, 'samples.csv'), 'utf8'), /startup,0,100/);
      assert.equal(fs.readFileSync(path.join(output, 'container.log'), 'utf8'), 'fixture container logs');
      const commands = fs.readFileSync(calls, 'utf8').trim().split('\n').map(line => JSON.parse(line));
      assert.deepEqual(commands.at(-1), ['rm', '--force', report.container]);
    }

    // Final idle has its own duration and must finish before evaluating the budget.
    const completedOutput = path.join(directory, 'report-completed');
    const releaseImage = 'ghcr.io/slsfi/digital-edition-frontend-ng:3.1.1';
    const completed = await execFileAsync(process.execPath, ['--require', fixture,
      path.join(__dirname, 'docker-ssr-memory.js'), '--skip-build', '--image', releaseImage, '--warmup-visits=1',
      '--cycles=2', '--visits=1', '--delay-ms=0', '--idle-seconds=1', '--final-idle-seconds=2',
      '--sample-seconds=1', '--max-duration-seconds=10', '--max-growth-mib=0',
      '--routes-file', file, '--output', completedOutput,
    ], { timeout: 12000, env: { ...process.env, SLS_MEMORY_FIXTURE_COMPLETE: '1', SLS_MEMORY_DELAY_SAMPLE: '1' } });
    for (const stage of ['Checking Docker', 'Starting container', 'Waiting for server', 'Warm-up',
      'Baseline idle', 'Cycle 1/2 requests', 'Cycle 1/2 idle', 'Cycle 2/2 requests', 'Final idle',
      'Saving container logs and state', 'Removing test container', 'Writing reports and summary']) {
      assert.ok(completed.stdout.includes(`Stage: ${stage}`), `Missing progress for ${stage}`);
    }
    assert.match(completed.stdout, /Warm-up: visit 1\/1; 1 total successful requests/);
    assert.match(completed.stdout, /Final idle - idle for 2s; no requests are sent/);
    const completedReport = JSON.parse(fs.readFileSync(path.join(completedOutput, 'report.json'), 'utf8'));
    assert.equal(completedReport.status, 'completed');
    assert.equal(completedReport.options.image, releaseImage);
    const completedCommands = fs.readFileSync(calls, 'utf8').trim().split('\n').map(line => JSON.parse(line));
    assert.equal(completedCommands.findLast(args => args[0] === 'create').at(-1), releaseImage);
    assert.equal(completedReport.completedRequests, 3);
    assert.deepEqual(completedReport.cycles.map(cycle => cycle.idleSeconds), [1, 2]);
    assert.equal(completedReport.cycles.at(-1).afterLoadMib, 200);
    assert.equal(completedReport.cycles.at(-1).idleMib, 100);
    assert.equal(completedReport.finalGrowthMib, 0);
    const baselineSamples = completedReport.samples.filter(sample => sample.phase === 'baseline-idle');
    assert.ok(baselineSamples.length > 0);
    assert.ok(baselineSamples.every(sample => sample.completedRequests === 1),
      'Late background samples must not be attributed to an idle phase after requests resume');
    const finalSamples = completedReport.samples.filter(sample => sample.phase === 'final-idle');
    assert.ok(finalSamples.length >= 2);
    assert.ok(finalSamples.every(sample => sample.completedRequests === 3), 'Final idle must not send requests');
    assert.ok(finalSamples.at(-1).elapsedSeconds - finalSamples[0].elapsedSeconds >= 0.8);
  } finally {
    assert.equal(path.dirname(directory), tempRoot);
    assert.ok(path.basename(directory).startsWith('docker-ssr-routes-'));
    fs.rmSync(directory, { recursive: true, force: true });
  }
  console.log('PASS: sitemap origins are stripped; comments, BOM, duplicates, and invalid routes handled');
  console.log('PASS: deadline stops pending requests and idle waits, fails with partial reports, and cleans up');
  console.log('PASS: stage progress and separate final idle recovery before the memory budget check');
  console.log('PASS: --skip-build --image starts the selected release image');
  console.log('PASS: background samples crossing phase boundaries are excluded');

  let redirectTargetRequested = false;
  const html = '<app-root ng-server-context="ssr"><p>Rendered content</p></app-root>';
  const server = http.createServer((req, res) => {
    if (req.url === '/redirect') {
      res.writeHead(302, { Location: '/redirect-target' }).end();
    } else if (req.url === '/error') {
      res.writeHead(500).end(html);
    } else if (req.url === '/csr') {
      res.end('<app-root></app-root>');
    } else if (req.url === '/empty-ssr') {
      res.end('<app-root ng-server-context="ssr"> </app-root>');
    } else if (req.url === '/plain') {
      res.end('HTTP 200 without Angular');
    } else if (req.url === '/timeout') {
      // Deliberately leave the response open to exercise the timeout.
    } else {
      redirectTargetRequested ||= req.url === '/redirect-target';
      res.end(html);
    }
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const baseUrl = `http://127.0.0.1:${server.address().port}`;
  const signal = new AbortController().signal;
  try {
    assert.equal(await requestPage(baseUrl, '/ssr', 1000, signal), Buffer.byteLength(html));
    for (const route of ['/redirect', '/error', '/csr', '/empty-ssr', '/plain']) {
      await assert.rejects(requestPage(baseUrl, route, 1000, signal), /HTTP|server-rendered/);
    }
    assert.equal(redirectTargetRequested, false);
    await assert.rejects(requestPage(baseUrl, '/timeout', 50, signal), { name: 'TimeoutError' });
    const cancelled = new AbortController();
    cancelled.abort();
    await assert.rejects(requestPage(baseUrl, '/ssr', 1000, cancelled.signal), { name: 'AbortError' });
  } finally {
    server.closeAllConnections();
    await new Promise(resolve => server.close(resolve));
  }
  console.log('PASS: real SSR required; HTTP failures, redirects, shells, timeouts, and cancellation rejected');
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
