/*
 * Regression tests for benchmark-ssr.js runtime startup and cleanup.
 *
 * Usage (from the repository root):
 *   npm run test:ssr:benchmark
 *   node scripts/test-benchmark-ssr.js
 *
 * Coverage:
 *   - Auto-start through npm run serve:ssr with an alternate runtime entry and PORT.
 *   - Cold-run and warm-run output from successful HTTP requests.
 *   - Runtime launch failures, startup timeouts, and SIGINT interruption.
 *   - Cleanup of the npm launcher and runtime processes after each scenario.
 *
 * Requires Node and npm. Creates temporary runtime fixtures and local HTTP servers
 * on available ports; no application build or running SSR app is required.
 * Fixture files and child processes are cleaned up after the tests.
 *
 * Exit codes:
 *   0: all checks passed.
 *   1: an assertion or runtime error occurred.
 */

const assert = require('node:assert/strict');
const { execFile } = require('node:child_process');
const fs = require('node:fs');
const net = require('node:net');
const os = require('node:os');
const path = require('node:path');
const { setTimeout: delay } = require('node:timers/promises');
const { promisify } = require('node:util');

const execFileAsync = promisify(execFile);

async function getFreePort() {
  const server = net.createServer();
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const port = server.address().port;
  await new Promise(resolve => server.close(resolve));
  return port;
}

async function assertStopped(pid, port) {
  for (let attempt = 0; attempt < 30; attempt++) {
    try {
      process.kill(pid, 0);
    } catch (error) {
      if (error.code !== 'ESRCH') throw error;
      const listening = await new Promise(resolve => {
        const socket = net.connect({ host: '127.0.0.1', port });
        socket.once('connect', () => { socket.destroy(); resolve(true); });
        socket.once('error', () => resolve(false));
      });
      assert.equal(listening, false, `SSR port ${port} remained open`);
      return;
    }
    await delay(100);
  }
  assert.fail(`SSR process ${pid} survived benchmark cleanup`);
}

async function main() {
  const tempRoot = path.resolve(os.tmpdir());
  const fixtureRoot = fs.mkdtempSync(path.join(tempRoot, 'ssr-benchmark-'));
  const scripts = path.join(fixtureRoot, 'scripts');
  fs.mkdirSync(scripts);
  const benchmark = path.join(scripts, 'benchmark-ssr.js');
  fs.copyFileSync(path.join(__dirname, 'benchmark-ssr.js'), benchmark);
  const runtime = path.join(fixtureRoot, 'alternate-entry.cjs');
  const pidFile = path.join(fixtureRoot, 'runtime.pid');
  const manifest = path.join(fixtureRoot, 'package.json');
  const writeManifest = entry => fs.writeFileSync(manifest, JSON.stringify({
    private: true, scripts: { 'serve:ssr': `node ${entry}` },
  }));
  const recordPid = "require('node:fs').writeFileSync('runtime.pid', String(process.pid));";

  try {
    // No dist/proxy file exists: the canonical script alone selects the entry.
    writeManifest('alternate-entry.cjs');
    fs.writeFileSync(runtime, recordPid + `
      require('node:http').createServer((req, res) => res.end('fixture SSR'))
        .listen(Number(process.env.PORT), '127.0.0.1');
    `);
    const port = await getFreePort();
    const completed = await execFileAsync(process.execPath, [benchmark,
      '--port', String(port), '--warm-runs=1', '--routes=/sv/,/fi/',
    ], { timeout: 15000 });
    assert.match(completed.stdout, /Cold runs/);
    assert.match(completed.stdout, /Warm summary/);
    assert.equal((completed.stdout.match(/│\s+200\s+│/g) || []).length, 6);
    await assertStopped(Number(fs.readFileSync(pidFile, 'utf8')), port);
    fs.unlinkSync(pidFile);
    console.log('PASS: benchmark uses serve:ssr with an alternate entry, inherits PORT, and stops its runtime');

    writeManifest('missing-entry.cjs');
    await assert.rejects(execFileAsync(process.execPath, [benchmark,
      '--port', String(await getFreePort()), '--startup-timeout-ms=8000',
    ], { timeout: 12000 }), error => error.code === 1
      && /npm run serve:ssr exited/.test(error.stderr)
      && /missing-entry/.test(error.stderr)
      && !/did not start within/.test(error.stderr));
    console.log('PASS: failed canonical launch reports the runtime error before the startup timeout');

    writeManifest('alternate-entry.cjs');
    fs.writeFileSync(runtime, recordPid + 'setInterval(() => {}, 1000);');
    const stalledPort = await getFreePort();
    await assert.rejects(execFileAsync(process.execPath, [benchmark,
      '--port', String(stalledPort), '--startup-timeout-ms=1000',
    ], { timeout: 10000 }), error => error.code === 1
      && /SSR server did not start within 1000 ms/.test(error.stderr));
    await assertStopped(Number(fs.readFileSync(pidFile, 'utf8')), stalledPort);
    fs.unlinkSync(pidFile);
    console.log('PASS: startup timeout also stops the npm launcher and stalled runtime');

    // Emit SIGINT after the fixture child starts, including on Windows where
    // ChildProcess.kill() terminates rather than delivering POSIX signals.
    const interrupter = path.join(fixtureRoot, 'interrupt.cjs');
    fs.writeFileSync(interrupter, `setInterval(() => {
      if (require('node:fs').existsSync('runtime.pid')) process.emit('SIGINT');
    }, 50);`);
    const interruptedPort = await getFreePort();
    await assert.rejects(execFileAsync(process.execPath, ['--require', interrupter, benchmark,
      '--port', String(interruptedPort), '--startup-timeout-ms=8000',
    ], { cwd: fixtureRoot, timeout: 12000 }), error => error.code === 130);
    await assertStopped(Number(fs.readFileSync(pidFile, 'utf8')), interruptedPort);
    fs.unlinkSync(pidFile);
    console.log('PASS: interruption stops the launcher and runtime before exiting with SIGINT status');
  } finally {
    // Also release a fixture child when an assertion fails, so failures cannot
    // keep inherited pipes or the temporary Windows working directory open.
    if (fs.existsSync(pidFile)) {
      try {
        process.kill(Number(fs.readFileSync(pidFile, 'utf8')));
      } catch (error) {
        if (error.code !== 'ESRCH') throw error;
      }
    }
    // Verify the exact temporary target before recursively removing fixtures.
    assert.equal(path.dirname(fixtureRoot), tempRoot);
    assert.ok(path.basename(fixtureRoot).startsWith('ssr-benchmark-'));
    fs.rmSync(fixtureRoot, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
  }
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
