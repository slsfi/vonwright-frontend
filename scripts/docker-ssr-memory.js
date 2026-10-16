#!/usr/bin/env node

/*
 * Repeated SSR visits and memory observations for the production Docker image.
 *
 * Usage (from the repository root):
 *   npm run test:ssr:docker
 *   node scripts/docker-ssr-memory.js
 *
 * Examples:
 *   npm run test:ssr:docker -- --pull
 *   npm run test:ssr:docker -- --skip-build --keep-container
 *   docker pull ghcr.io/slsfi/digital-edition-frontend-ng:3.1.1
 *   npm run test:ssr:docker -- --skip-build --image=ghcr.io/slsfi/digital-edition-frontend-ng:3.1.1
 *   npm run test:ssr:docker -- --skip-build --final-idle-seconds=180
 *   npm run test:ssr:docker -- --skip-build --cycles=10 --visits=30 --max-duration-seconds=3600
 *   npm run test:ssr:docker -- --routes-file=../digital_edition_scripts/simulate_visits/urls.txt
 *   npm run test:ssr:docker -- --help
 *
 * Workflow:
 *   - Build the local Dockerfile, or reuse an image with --skip-build.
 *   - Start a fresh container on loopback (host port 4210 by default).
 *   - Warm every route, establish an idle baseline, then repeat load/idle cycles.
 *   - Observe two minutes of final idle time after all requests have finished.
 *   - Require HTTP 200 responses with populated server-rendered Angular roots.
 *   - Sample Docker memory and report idle medians, baseline growth, and peak usage.
 *
 * Requires Docker Desktop in Linux-container mode, the Docker CLI, and the Node/npm
 * versions declared in package.json. Live edition APIs must be reachable from the
 * container. Default routes match the sample edition; --routes-file replaces them
 * with public SSR routes. Absolute URLs are remapped to the local container.
 * To compare a published release, pull it first and use --skip-build --image=<tag>.
 * Without --skip-build, --image selects the tag for a new local build. --pull only
 * refreshes the base image when building; docker pull refreshes a published image.
 * The normal image launcher and garbage collection remain in use; GC is not forced.
 * The default request/idle run targets 10-15 minutes and stops after 15 minutes.
 * Image building, container startup, and cleanup take additional time.
 * Stage messages, visit counts, and periodic memory/elapsed-time updates show progress.
 *
 * Writes samples.csv, report.json, and container.log under ignored
 * tmp/docker-ssr-memory/<timestamp>/, or the directory selected with --output.
 * Failures and interruptions save partial reports. The container is removed unless
 * --keep-container is supplied; the image and reports remain for later inspection.
 * Memory needs review: completion alone does not prove the absence of a leak.
 * Use --max-growth-mib to enforce an explicit final idle growth budget.
 *
 * Measurement notes:
 *   - docker stats --no-stream reports cache-adjusted Linux container memory,
 *     including launcher processes, rather than JavaScript live heap usage.
 *   - Sampling pauses --sample-seconds between Docker calls; readings spanning
 *     stage transitions are discarded. Peaks are the highest observed samples.
 *   - Idle values use the median of the last three samples in each idle phase.
 *     The final growth budget is checked after the longer final idle period.
 *   - Node may retain heap pages, compiled code, and allocator memory after GC.
 *     A warm plateau above startup usage alone does not establish a leak.
 * References:
 *   https://docs.docker.com/reference/cli/docker/container/stats/
 *   https://nodejs.org/docs/latest-v24.x/api/process.html#processmemoryusage
 *
 * Exit codes:
 *   0: request/measurement run completed within any supplied memory budget.
 *   1: an argument, request, Docker, measurement, budget, time limit, or cleanup error occurred.
 *   130: interrupted by SIGINT or SIGTERM.
 *
 * See docs/DEVELOPMENT.md#repeatable-docker-ssr-memory-check for interpretation.
 */

const { execFile, spawn } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const { setTimeout: delay } = require('node:timers/promises');
const { promisify } = require('node:util');

const execFileAsync = promisify(execFile);
const ROOT = path.resolve(__dirname, '..');
const MIB = 1024 ** 2;
const DEFAULT_ROUTES = [
  '/sv/', '/fi/', '/sv/content', '/fi/content',
  '/sv/about/03-01-01', '/fi/about/03-01-01',
  '/sv/collection/216/cover', '/sv/collection/216/introduction',
  '/sv/collection/216/text/20280', '/sv/collection/211/text/20128',
  '/fi/collection/211/text/20128', '/sv/index/persons',
];

function printHelp() {
  console.log(`Usage: npm run test:ssr:docker -- [options]

Builds the Dockerfile, starts a fresh container bound to loopback, warms every
route, then alternates repeated sequential visits with idle memory observations.
Prints stage/visit progress and periodic memory updates, including final idle.
Requires Docker Desktop in Linux-container mode. Uses only Node built-ins.

  --skip-build                 Use an already built image
  --pull                       Refresh the Docker base image when building
  --image <tag>                Image to build/run (digital-edition-frontend-ng:memory-test)
  --port <n>                   Host port (4210; container port is 4201)
  --cycles <n>                 Measured load/idle cycles (3)
  --visits <n>                 Visits to ALL routes per cycle (15)
  --warmup-visits <n>          Visits to all routes before the baseline (50)
  --delay-ms <n>               Pause after each request (100)
  --idle-seconds <n>           Baseline and intermediate idle periods (30)
  --final-idle-seconds <n>     Idle after the last request cycle (120)
  --sample-seconds <n>         Memory sampling interval (5)
  --timeout-ms <n>             Per-request timeout (30000)
  --max-duration-seconds <n>   Request/idle time limit, excluding build/startup (900)
  --routes-file <path>         Replace defaults with one URL or route per line
  --output <directory>         Report directory (tmp/docker-ssr-memory/<timestamp>)
  --max-growth-mib <n>         Optional final idle growth budget; exceeded = exit 1
  --keep-container             Leave the test container running for inspection
  --help, -h                  Show help

URLs from a routes file are remapped to the LOCAL container, including their
path/query. Blank lines and # comments are ignored. Redirects, non-200 responses,
CSR shells, and request/statistics errors fail the run. Defaults match this
repository's sample edition; use public SSR routes for other editions.

Reports: samples.csv, report.json, container.log. Memory uses Docker CLI's
cache-adjusted Linux usage. Idle values are medians of the last three samples
in each idle phase. No automatic leak verdict is made without an explicit
budget: inspect the idle trend, peak, and longer runs. Ctrl+C saves partial
results and removes the container unless --keep-container was supplied.
The time limit also saves partial results and exits 1 if the run is incomplete.
Defaults target 10-15 minutes of requests and idle periods; build/startup and
cleanup take additional time. Increase the time limit for longer runs.`);
  console.log(`
Published release example:
  docker pull ghcr.io/slsfi/digital-edition-frontend-ng:3.1.1
  npm run test:ssr:docker -- --skip-build --image=ghcr.io/slsfi/digital-edition-frontend-ng:3.1.1

Use --skip-build for published images; otherwise --image tags a new local build.
--pull refreshes the Dockerfile's base image only when building.`);
}

function parseArgs(argv) {
  const options = {
    image: 'digital-edition-frontend-ng:memory-test', port: 4210,
    cycles: 3, visits: 15, warmupVisits: 50, delayMs: 100,
    idleSeconds: 30, finalIdleSeconds: 120, sampleSeconds: 5, timeoutMs: 30000, maxDurationSeconds: 900,
    skipBuild: false, pull: false, keepContainer: false,
    output: path.join(ROOT, 'tmp', 'docker-ssr-memory', new Date().toISOString().replace(/[:.]/g, '-')),
  };
  const flags = { '--skip-build': 'skipBuild', '--pull': 'pull', '--keep-container': 'keepContainer' };
  const values = {
    '--image': 'image', '--port': 'port', '--cycles': 'cycles', '--visits': 'visits',
    '--warmup-visits': 'warmupVisits', '--delay-ms': 'delayMs', '--idle-seconds': 'idleSeconds',
    '--final-idle-seconds': 'finalIdleSeconds',
    '--sample-seconds': 'sampleSeconds', '--timeout-ms': 'timeoutMs', '--routes-file': 'routesFile',
    '--max-duration-seconds': 'maxDurationSeconds',
    '--output': 'output', '--max-growth-mib': 'maxGrowthMib',
  };
  for (let i = 0; i < argv.length; i++) {
    const [key, ...parts] = argv[i].split('=');
    if (key === '--help' || key === '-h') {
      options.help = true;
    } else if (flags[key] && !parts.length) {
      options[flags[key]] = true;
    } else if (values[key]) {
      const value = parts.length ? parts.join('=') : argv[++i];
      if (!value || value.startsWith('--')) {
        throw new Error(`Missing value for ${key}`);
      }
      options[values[key]] = value;
    } else {
      throw new Error(`Unknown option: ${argv[i]}`);
    }
  }
  for (const key of ['port', 'cycles', 'visits', 'warmupVisits', 'delayMs', 'idleSeconds', 'finalIdleSeconds', 'sampleSeconds', 'timeoutMs', 'maxDurationSeconds']) {
    options[key] = Number(options[key]);
    if (!Number.isSafeInteger(options[key]) || options[key] < (key === 'delayMs' ? 0 : 1)) {
      throw new Error(`${key} must be ${key === 'delayMs' ? 'a non-negative' : 'a positive'} integer`);
    }
  }
  if (options.port > 65535) {
    throw new Error('port must be at most 65535');
  }
  if (options.maxDurationSeconds * 1000 > 2 ** 31 - 1) {
    throw new Error('max-duration-seconds exceeds the supported timer duration');
  }
  if (options.maxGrowthMib !== undefined) {
    options.maxGrowthMib = Number(options.maxGrowthMib);
    if (!Number.isFinite(options.maxGrowthMib) || options.maxGrowthMib < 0) {
      throw new Error('max-growth-mib must be a non-negative number');
    }
  }
  if (!options.image || options.image.startsWith('-')) {
    throw new Error('Invalid image tag');
  }
  options.output = path.resolve(options.output);
  return options;
}

function loadRoutes(file) {
  if (!file) return [...DEFAULT_ROUTES];
  const routes = fs.readFileSync(file, 'utf8').replace(/^\uFEFF/, '').split(/\r?\n/)
    .map(line => line.trim()).filter(line => line && !line.startsWith('#')).map(line => {
      // Only the path and query survive: a production sitemap must never receive load.
      if (!line.startsWith('/') && !/^https?:\/\//i.test(line)) {
        throw new Error(`Expected an absolute HTTP URL or route: ${line}`);
      }
      const url = new URL(line, 'http://localhost');
      return url.pathname + url.search;
    });
  if (!routes.length) {
    throw new Error('The routes file is empty');
  }
  return [...new Set(routes)];
}

function parseMemory(value) {
  const match = value.match(/^([\d.]+)\s*(B|kB|MB|GB|TB|KiB|MiB|GiB|TiB)\s*\//);
  if (!match) {
    throw new Error(`Unrecognized Docker memory usage: ${value}`);
  }
  const units = { B: 1, kB: 1e3, MB: 1e6, GB: 1e9, TB: 1e12, KiB: 1024, MiB: MIB, GiB: 1024 ** 3, TiB: 1024 ** 4 };
  const memory = Number(match[1]) * units[match[2]] / MIB;
  if (!Number.isFinite(memory)) {
    throw new Error(`Invalid Docker memory usage: ${value}`);
  }
  return memory;
}

function idleMedian(samples, phase) {
  const values = samples.filter(sample => sample.phase === phase).slice(-3)
    .map(sample => sample.memoryMib).sort((a, b) => a - b);
  if (!values.length) {
    throw new Error(`No memory samples for ${phase}`);
  }
  const middle = Math.floor(values.length / 2);
  return values.length % 2 ? values[middle] : (values[middle - 1] + values[middle]) / 2;
}

async function requestPage(baseUrl, route, timeoutMs, signal) {
  // Concatenation keeps even a path beginning // on the local origin.
  const response = await fetch(baseUrl + route, {
    redirect: 'manual', signal: AbortSignal.any([signal, AbortSignal.timeout(timeoutMs)]),
    headers: { 'user-agent': 'SLS-Docker-SSR-memory-check' },
  });
  const body = await response.text();
  if (response.status !== 200) {
    throw new Error(`${route}: HTTP ${response.status} (expected 200, redirects are not followed)`);
  }
  const root = body.match(/<app-root\b([^>]*)>([\s\S]*?)<\/app-root>/i);
  if (!root || !/\bng-server-context=["']ssr["']/.test(root[1]) || !root[2].trim()) {
    throw new Error(`${route}: expected a populated server-rendered Angular root`);
  }
  return Buffer.byteLength(body);
}

async function docker(args) {
  const { stdout } = await execFileAsync('docker', args, { cwd: ROOT, timeout: 30000, maxBuffer: 16 * 1024 ** 2 });
  return stdout.trim();
}

async function buildImage(options, signal) {
  const args = ['build', ...(options.pull ? ['--pull'] : []), '-t', options.image, '.'];
  const child = spawn('docker', args, { cwd: ROOT, stdio: 'inherit', signal });
  await new Promise((resolve, reject) => {
    child.on('error', reject);
    child.on('exit', (code, exitSignal) => code === 0 ? resolve() : reject(new Error(`docker build exited: ${code ?? exitSignal}`)));
  });
}

async function run(options) {
  const routes = loadRoutes(options.routesFile);
  fs.mkdirSync(options.output, { recursive: true });
  const csvFile = path.join(options.output, 'samples.csv');
  fs.writeFileSync(csvFile, 'timestamp,elapsed_seconds,phase,completed_requests,memory_mib,cpu_percent,pids\n');
  const controller = new AbortController();
  const samplerController = new AbortController();
  const interrupt = () => controller.abort(new Error('Interrupted'));
  process.once('SIGINT', interrupt);
  process.once('SIGTERM', interrupt);
  const started = Date.now();
  const name = `sls-ssr-memory-${process.pid}-${started}`;
  const baseUrl = `http://127.0.0.1:${options.port}`;
  const report = {
    startedAt: new Date(started).toISOString(), options, routes, container: name, baseUrl,
    completedRequests: 0, responseBytes: 0, cycles: [], samples: [], status: 'incomplete',
  };
  let created = false;
  let phase = 'startup';
  let phaseName = 'Startup';
  let phaseStarted = started;
  let phaseStartRequests = 0;
  let phaseRequests = 0;
  let phaseIdleSeconds = 0;
  let lastProgressAt = started;
  let sampler;
  let samplerError;
  let durationTimer;
  let timedOut = false;

  function progress(message) {
    lastProgressAt = Date.now();
    const seconds = Math.floor((lastProgressAt - started) / 1000);
    console.log(`[${Math.floor(seconds / 60)}m ${String(seconds % 60).padStart(2, '0')}s] ${message}`);
  }

  function beginPhase(label, name, detail, requests = 0, idleSeconds = 0) {
    phase = label;
    phaseName = name;
    phaseStarted = Date.now();
    phaseStartRequests = report.completedRequests;
    phaseRequests = requests;
    phaseIdleSeconds = idleSeconds;
    progress(`Stage: ${name} - ${detail}`);
  }

  async function sample(label = phase) {
    const stats = JSON.parse(await docker(['stats', '--no-stream', '--format', '{{json .}}', name]));
    // A background call may finish after requests have resumed or a new idle phase
    // has begun. Leave that boundary-spanning reading out of the phase history.
    if (label !== phase) return parseMemory(stats.MemUsage);
    const row = {
      timestamp: new Date().toISOString(), elapsedSeconds: (Date.now() - started) / 1000,
      phase: label, completedRequests: report.completedRequests, memoryMib: parseMemory(stats.MemUsage),
      cpuPercent: Number(stats.CPUPerc.replace('%', '')), pids: Number(stats.PIDs),
    };
    report.samples.push(row);
    fs.appendFileSync(csvFile, [row.timestamp, row.elapsedSeconds, label, row.completedRequests,
      row.memoryMib, row.cpuPercent, row.pids].join(',') + '\n');
    if (label === phase && Date.now() - lastProgressAt >= 15000) {
      const elapsed = Math.floor((Date.now() - phaseStarted) / 1000);
      const completed = report.completedRequests - phaseStartRequests;
      const activity = phaseIdleSeconds
        ? `${Math.min(elapsed, phaseIdleSeconds)}/${phaseIdleSeconds}s idle`
        : phaseRequests ? `${completed}/${phaseRequests} requests; ${elapsed}s in stage` : `${elapsed}s in stage`;
      const delta = row.memoryMib - report.baselineMib;
      const growth = report.baselineMib === undefined ? ''
        : `; change ${delta >= 0 ? '+' : ''}${delta.toFixed(1)} MiB from baseline`;
      progress(`${phaseName}: ${activity}; memory ${row.memoryMib.toFixed(1)} MiB${growth}`);
    }
    return row.memoryMib;
  }

  async function idle(label, name, seconds) {
    beginPhase(label, name, `idle for ${seconds}s; no requests are sent`, 0, seconds);
    await delay(seconds * 1000, undefined, { signal: controller.signal });
    await sample(label);
    const value = idleMedian(report.samples, label);
    progress(`${name}: ${value.toFixed(1)} MiB (median of final samples)`);
    return value;
  }

  async function visit(count, label, name) {
    beginPhase(label, name, `${count} visits to ${routes.length} routes (${count * routes.length} requests)`,
      count * routes.length);
    for (let visitIndex = 1; visitIndex <= count; visitIndex++) {
      for (const route of routes) {
        controller.signal.throwIfAborted();
        report.responseBytes += await requestPage(baseUrl, route, options.timeoutMs, controller.signal);
        report.completedRequests++;
        await delay(options.delayMs, undefined, { signal: controller.signal });
      }
      progress(`${name}: visit ${visitIndex}/${count}; ${report.completedRequests} total successful requests`);
    }
  }

  try {
    console.log(`Reports: ${options.output}`);
    beginPhase('docker-check', 'Checking Docker', 'Linux containers required');
    const osType = await docker(['info', '--format', '{{.OSType}}']);
    if (osType !== 'linux') {
      throw new Error('Docker must be running Linux containers');
    }
    if (!options.skipBuild) {
      beginPhase('build', 'Building image', options.image);
      await buildImage(options, controller.signal);
    } else {
      progress(`Using existing image: ${options.image} (--skip-build)`);
    }
    controller.signal.throwIfAborted();
    beginPhase('container-start', 'Starting container', name);
    await docker(['create', '--name', name, '--publish', `127.0.0.1:${options.port}:4201`,
      '--env', 'PORT=4201', options.image]);
    created = true;
    controller.signal.throwIfAborted();
    await docker(['start', name]);
    console.log(`Container: ${name}\nURL: ${baseUrl}\nRoutes: ${routes.length}; measured requests: ${options.cycles * options.visits * routes.length}`);
    beginPhase('startup', 'Waiting for server', `${baseUrl}/robots.txt`);
    // Poll a static file so readiness does not warm SSR or consume limiter capacity.
    const deadline = Date.now() + 60000;
    while (true) {
      controller.signal.throwIfAborted();
      try {
        const response = await fetch(`${baseUrl}/robots.txt`, {
          signal: AbortSignal.any([controller.signal, AbortSignal.timeout(2000)]), redirect: 'manual',
        });
        await response.arrayBuffer();
        if (response.ok) {
          break;
        }
      } catch {
        // Retry connection failures until the startup deadline.
      }
      if (Date.now() >= deadline) {
        throw new Error('Container did not become ready within 60 seconds');
      }
      await delay(500, undefined, { signal: controller.signal });
    }
    report.measurementStartedAt = new Date().toISOString();
    durationTimer = setTimeout(() => {
      timedOut = true;
      controller.abort(new Error(`Request/idle time limit of ${options.maxDurationSeconds}s reached; run incomplete`));
    }, options.maxDurationSeconds * 1000);
    console.log(`Request/idle time limit: ${options.maxDurationSeconds}s (build/startup excluded)`);
    report.startupMemoryMib = await sample();
    sampler = (async () => {
      while (!samplerController.signal.aborted) {
        await delay(options.sampleSeconds * 1000, undefined, { signal: samplerController.signal });
        await sample();
      }
    })().catch(error => {
      if (!samplerController.signal.aborted) {
        samplerError = error;
        controller.abort(error);
      }
    });
    await visit(options.warmupVisits, 'warmup', 'Warm-up');
    report.baselineMib = await idle('baseline-idle', 'Baseline idle', options.idleSeconds);
    for (let cycle = 1; cycle <= options.cycles; cycle++) {
      await visit(options.visits, `cycle-${cycle}-load`, `Cycle ${cycle}/${options.cycles} requests`);
      const afterLoadMib = await sample();
      const finalCycle = cycle === options.cycles;
      const idleSeconds = finalCycle ? options.finalIdleSeconds : options.idleSeconds;
      const idleMib = await idle(finalCycle ? 'final-idle' : `cycle-${cycle}-idle`,
        finalCycle ? 'Final idle' : `Cycle ${cycle}/${options.cycles} idle`, idleSeconds);
      report.cycles.push({ cycle, afterLoadMib, idleMib, idleSeconds, growthMib: idleMib - report.baselineMib });
    }
    controller.signal.throwIfAborted();
    report.finalGrowthMib = report.cycles.at(-1).growthMib;
    if (options.maxGrowthMib !== undefined && report.finalGrowthMib > options.maxGrowthMib) {
      throw new Error(`Final idle growth ${report.finalGrowthMib.toFixed(1)} MiB exceeds ${options.maxGrowthMib} MiB budget`);
    }
    report.status = 'completed';
  } catch (error) {
    report.status = controller.signal.aborted && !samplerError && !timedOut ? 'interrupted' : 'failed';
    report.error = (samplerError || (controller.signal.aborted ? controller.signal.reason : error)).message;
    console.error(report.error);
    process.exitCode = report.status === 'interrupted' ? 130 : 1;
  } finally {
    clearTimeout(durationTimer);
    if (report.measurementStartedAt) {
      report.measurementSeconds = (Date.now() - Date.parse(report.measurementStartedAt)) / 1000;
    }
    samplerController.abort();
    await sampler;
    if (samplerError) {
      report.status = 'failed';
      report.error = samplerError.message;
      process.exitCode = 1;
    }
    if (created) {
      progress('Stage: Saving container logs and state');
      try {
        const logs = await execFileAsync('docker', ['logs', name], { cwd: ROOT, timeout: 30000, maxBuffer: 16 * 1024 ** 2 });
        fs.writeFileSync(path.join(options.output, 'container.log'), logs.stdout + logs.stderr);
        const [info] = JSON.parse(await docker(['inspect', name]));
        report.imageId = info.Image;
        report.containerState = info.State;
        report.restartCount = info.RestartCount;
        if (report.status === 'completed' && (!info.State.Running || info.State.OOMKilled || info.RestartCount)) {
          throw new Error('Container stopped, was OOM-killed, or restarted during the run');
        }
      } catch (error) {
        report.status = 'failed';
        report.error = error.message;
        process.exitCode = 1;
        console.error(error.message);
      }
      if (!options.keepContainer) {
        progress('Stage: Removing test container');
        try {
          await docker(['rm', '--force', name]);
        } catch (error) {
          report.status = 'failed';
          report.cleanupError = error.message;
          process.exitCode = 1;
          console.error(`Cleanup failed; remove ${name} manually: ${error.message}`);
        }
      } else {
        console.log(`Container left running. Stop/remove it with: docker rm --force ${name}`);
      }
    }
    process.removeListener('SIGINT', interrupt);
    process.removeListener('SIGTERM', interrupt);
    report.finishedAt = new Date().toISOString();
    report.peakMib = report.samples.length ? Math.max(...report.samples.map(row => row.memoryMib)) : null;
    progress('Stage: Writing reports and summary');
    fs.writeFileSync(path.join(options.output, 'report.json'), JSON.stringify(report, null, 2) + '\n');
    console.table(report.cycles.map(row => ({ cycle: row.cycle, afterLoadMiB: row.afterLoadMib.toFixed(1),
      idleMiB: row.idleMib.toFixed(1), growthMiB: row.growthMib.toFixed(1) })));
    console.log(`Status: ${report.status}; successful requests: ${report.completedRequests}; sampled peak: ${report.peakMib?.toFixed(1) ?? 'n/a'} MiB`);
    console.log(`Reports: ${options.output}`);
    if (report.status === 'completed' && options.maxGrowthMib === undefined) {
      console.log('Memory observation only: compare idle values across cycles; completion does not prove absence of a leak.');
    }
  }
}

if (require.main === module) {
  (async () => {
    const options = parseArgs(process.argv.slice(2));
    if (options.help) {
      printHelp();
      return;
    }
    await run(options);
  })().catch(error => {
    console.error(error.message);
    process.exitCode = 1;
  });
}

module.exports = { parseArgs, loadRoutes, parseMemory, idleMedian, requestPage };
