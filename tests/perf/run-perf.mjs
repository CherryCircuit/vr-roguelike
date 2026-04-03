import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import puppeteer from 'puppeteer';

import idleSoak from './scenarios/idle-soak.js';
import combatStress from './scenarios/combat-stress.js';
import restartChurn from './scenarios/restart-churn.js';
import progressionRun from './scenarios/progression-run.js';
import profileBuckets from './scenarios/profile-buckets.js';
import combatProfileHighLevel from './scenarios/combat-profile-highlevel.js';
import combatSpikeDiag from './scenarios/combat-spike-diag.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(__dirname, '../..');
const ARTIFACT_ROOT = path.join(__dirname, 'artifacts');
const STATIC_PORT = 8000;
const GAME_URL = `http://localhost:${STATIC_PORT}`;

const CHROME_ARGS = [
  '--no-sandbox',
  '--disable-setuid-sandbox',
  '--disable-dev-shm-usage',
  '--autoplay-policy=no-user-gesture-required',
  '--use-fake-ui-for-media-stream',
  '--use-angle=swiftshader',
  '--enable-webgl',
  '--ignore-gpu-blocklist',
  '--disable-gpu-sandbox',
  '--enable-features=WebGL',
];

const SCENARIOS = {
  'idle-soak': {
    runner: idleSoak,
    defaults: { durationMs: 15000, sampleIntervalMs: 3000 },
    description: 'Stay in playing state and capture periodic telemetry to catch drift/leaks.',
  },
  'combat-stress': {
    runner: combatStress,
    defaults: { waves: 3, volleyDelayMs: 350, prepareDelayMs: 2000 },
    description: 'Drive deterministic fire-at-enemy loop to stress weapon/enemy systems.',
  },
  'restart-churn': {
    runner: restartChurn,
    defaults: { cycles: 3, soakMs: 2500 },
    description: 'Repeatedly reload and re-enter gameplay to surface init leaks and XR churn.',
  },
  'progression-run': {
    runner: progressionRun,
    defaults: {
      plan: 'synthwave_valley:2,desert_night:2,alien_planet:2,hellscape_lava:1!boss',
      autoUpgradeStrategy: 'first-card',
      maxLevels: 8,
      stopAfterBoss: true,
    },
    description: 'Use progression hooks to march through biomes/levels, selecting upgrades automatically and capturing telemetry.',
  },
  'profile-buckets': {
    runner: profileBuckets,
    defaults: { durationMs: 15000 },
    description: 'Enable per-frame bucket profiler, idle soak, then dump ranked hotspot report.',
  },
  'combat-profile-highlevel': {
    runner: combatProfileHighLevel,
    defaults: { targetLevel: 14, spawnWaitMs: 8000, profileDurationMs: 15000 },
    description: 'Jump to high level, let enemies accumulate, profile buckets during active combat.',
  },
  'combat-spike-diag': {
    runner: combatSpikeDiag,
    defaults: { targetLevel: 14, spawnWaitMs: 8000, profileDurationMs: 20000, minimal: true, spikeThresholdMs: 50 },
    description: 'Combat spike diagnostic: per-frame timing, spike detection, slow-mo event correlation. Use --minimal=false for full visuals.',
  },
};

const DEFAULT_CONFIG = {
  scenarios: Object.keys(SCENARIOS),
  iterations: 1,
  headed: false,
  output: ARTIFACT_ROOT,
};

function parseArgs(argv) {
  const result = {};
  for (const arg of argv) {
    if (!arg.startsWith('--')) continue;
    const trimmed = arg.slice(2);
    const [rawKey, rawValue] = trimmed.split('=');
    if (!rawKey) continue;
    const value = rawValue === undefined ? true : rawValue;
    result[rawKey] = value;
  }
  return result;
}

function coerceBoolean(value) {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string') {
    if (value === 'true') return true;
    if (value === 'false') return false;
  }
  return Boolean(value);
}

function numberFromArg(value, fallback) {
  if (value === undefined) return fallback;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function sanitizeTag(tag) {
  return tag.replace(/[^a-z0-9-_]/gi, '_');
}

function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function getMimeType(filePath) {
  const map = {
    '.html': 'text/html',
    '.js': 'application/javascript',
    '.mjs': 'application/javascript',
    '.css': 'text/css',
    '.json': 'application/json',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.gif': 'image/gif',
    '.svg': 'image/svg+xml',
    '.ico': 'image/x-icon',
    '.glb': 'model/gltf-binary',
    '.gltf': 'model/gltf+json',
    '.mp3': 'audio/mpeg',
    '.wav': 'audio/wav',
  };
  return map[path.extname(filePath).toLowerCase()] || 'application/octet-stream';
}

function startStaticServer() {
  return new Promise((resolve, reject) => {
    const server = http.createServer((req, res) => {
      const urlPath = decodeURIComponent(req.url.split('?')[0]);
      const requestPath = urlPath === '/' ? '/index.html' : urlPath;
      const safePath = path.normalize(path.join(PROJECT_ROOT, requestPath));

      if (!safePath.startsWith(PROJECT_ROOT)) {
        res.writeHead(403, { 'Content-Type': 'text/plain' });
        res.end('Forbidden');
        return;
      }

      fs.stat(safePath, (statErr, stats) => {
        if (statErr) {
          res.writeHead(404, { 'Content-Type': 'text/plain' });
          res.end('Not found');
          return;
        }

        const filePath = stats.isDirectory() ? path.join(safePath, 'index.html') : safePath;
        fs.readFile(filePath, (readErr, data) => {
          if (readErr) {
            res.writeHead(404, { 'Content-Type': 'text/plain' });
            res.end('Not found');
            return;
          }

          res.writeHead(200, {
            'Content-Type': getMimeType(filePath),
            'Access-Control-Allow-Origin': '*',
          });
          res.end(data);
        });
      });
    });

    server.on('error', reject);
    server.listen(STATIC_PORT, () => resolve(server));
  });
}

function stopServer(server) {
  if (!server) return Promise.resolve();
  return new Promise((resolve) => server.close(resolve));
}

function createConsoleRecorder(page) {
  const entries = [];
  const errors = [];
  const requestFailures = [];

  function onConsole(msg) {
    entries.push({
      type: msg.type(),
      text: msg.text(),
      location: msg.location(),
      ts: Date.now(),
    });
  }

  function onPageError(err) {
    errors.push({ message: err.message, stack: err.stack, ts: Date.now() });
  }

  function onRequestFailed(request) {
    requestFailures.push({
      url: request.url(),
      failure: request.failure(),
      method: request.method(),
      ts: Date.now(),
    });
  }

  page.on('console', onConsole);
  page.on('pageerror', onPageError);
  page.on('requestfailed', onRequestFailed);

  return {
    export: async (dir) => {
      await fs.promises.writeFile(
        path.join(dir, 'console.json'),
        JSON.stringify(entries, null, 2)
      );
      await fs.promises.writeFile(
        path.join(dir, 'errors.json'),
        JSON.stringify(errors, null, 2)
      );
      await fs.promises.writeFile(
        path.join(dir, 'request-failures.json'),
        JSON.stringify(requestFailures, null, 2)
      );
    },
    getCounts: () => ({
      consoleErrors: entries.filter((e) => e.type === 'error').length,
      pageErrors: errors.length,
      requestFailures: requestFailures.length,
    }),
  };
}

async function enablePerfTelemetry(page, log) {
  try {
    const status = await page.evaluate(() => {
      const perf = window.__perf || window.__test?.telemetry || null;
      if (!perf) return { ok: false };
      if (typeof perf.enable === 'function') {
        perf.enable({ historyMs: 10000 });
      }
      if (typeof perf.setHistoryWindow === 'function') {
        perf.setHistoryWindow(10000);
      }
      return {
        ok: true,
        enabled: typeof perf.isEnabled === 'function' ? perf.isEnabled() : null,
      };
    });
    if (log) {
      if (status.ok) {
        log('[telemetry] bridge enabled');
      } else {
        log('[telemetry] bridge missing, skipping enable');
      }
    }
    return status.ok;
  } catch (err) {
    if (log) log(`[telemetry] enable failed: ${err.message}`);
    return false;
  }
}

async function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function ensureGameBoot(page, log) {
  log('Navigating to game and seeding localStorage');
  await page.goto(GAME_URL, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.evaluate(() => {
    localStorage.setItem('spaceomicide_country', 'US');
    localStorage.setItem('spaceomicide_name', 'PerfHarness');
  });
  await page.reload({ waitUntil: 'networkidle2', timeout: 30000 });
  await page.waitForFunction(() => window.game && window.State, { timeout: 20000 });
  await enablePerfTelemetry(page, log);
}

async function ensurePlayingState(page, log) {
  const center = { x: 640, y: 400 };
  const start = Date.now();
  while (Date.now() - start < 30000) {
    const state = await page.evaluate(() => window.game?.state ?? null);
    if (state === 'playing') return 'playing';

    if (state === 'country_select' || state === 'name_entry') {
      log(`State ${state}, forcing profile + reload`);
      await page.evaluate(() => {
        localStorage.setItem('spaceomicide_country', 'US');
        localStorage.setItem('spaceomicide_name', 'PerfHarness');
      });
      await page.reload({ waitUntil: 'networkidle2', timeout: 30000 });
      await page.waitForFunction(() => window.game && window.State, { timeout: 20000 });
      await enablePerfTelemetry(page, log);
      continue;
    }

    if (state === 'ready_screen' || state === 'title' || state === 'level_complete') {
      await page.mouse.click(center.x, center.y);
      await wait(300);
      continue;
    }

    if (state === 'paused') {
      await page.keyboard.press('Escape');
      await wait(250);
      continue;
    }

    await wait(200);
  }
  throw new Error('Timed out reaching playing state');
}

async function detectHooks(page) {
  return page.evaluate(() => {
    const perf = window.__perf || null;
    const test = window.__test || null;
    const renderer = window.__test?.getRenderer?.();
    const summary = {
      hasPerfApi: Boolean(perf),
      availablePerfMethods: perf ? Object.keys(perf).filter((key) => typeof perf[key] === 'function') : [],
      hasTestHooks: Boolean(test),
      testApi: test ? Object.keys(test) : [],
      rendererStatsAvailable: Boolean(renderer && renderer.info),
    };
    return summary;
  });
}

async function captureTelemetry(page, dir, tag) {
  const safeTag = sanitizeTag(tag);
  const payload = await page.evaluate((label) => {
    const perf = window.__perf || null;
    const renderer = window.__test?.getRenderer?.();
    const snapshotFn = perf && (perf.getSnapshot || perf.snapshot || perf.collect || null);
    let instrumentation = null;
    let instrumentationError = null;
    if (snapshotFn) {
      try {
        instrumentation = snapshotFn.call(perf, label);
      } catch (err) {
        instrumentationError = err?.message || String(err);
      }
    }

    return {
      label,
      timestamp: new Date().toISOString(),
      perfNow: performance.now(),
      state: window.game?.state ?? null,
      level: window.game?.level ?? null,
      wave: window.game?.wave ?? null,
      score: window.game?.score ?? null,
      kills: window.game?.kills ?? null,
      health: window.game?.health ?? null,
      nukes: window.game?.nukes ?? null,
      renderer: renderer
        ? {
            geometries: renderer.info.memory.geometries,
            textures: renderer.info.memory.textures,
            programs: renderer.info.programs?.length ?? null,
            triangles: renderer.info.render.triangles,
            calls: renderer.info.render.calls,
          }
        : null,
      perfHooks: perf ? {
        fps: perf.fps ?? perf.currentFps ?? null,
        frameTime: perf.frameTime ?? perf.lastFrameMs ?? null,
        memory: perf.memory ?? null,
      } : null,
      instrumentation,
      instrumentationError,
      performanceMemory: performance.memory
        ? {
            jsHeapSizeLimit: performance.memory.jsHeapSizeLimit,
            totalJSHeapSize: performance.memory.totalJSHeapSize,
            usedJSHeapSize: performance.memory.usedJSHeapSize,
          }
        : null,
    };
  }, tag);

  const outPath = path.join(dir, `telemetry-${safeTag}.json`);
  await fs.promises.writeFile(outPath, JSON.stringify(payload, null, 2));
  return { file: outPath, data: payload };
}

async function takeScreenshot(page, dir, name) {
  const safeName = sanitizeTag(name);
  const filePath = path.join(dir, `${safeName}.png`);
  await page.screenshot({ path: filePath });
  return filePath;
}

function buildScenarioContext(page, log, iterationDir, overrides = {}) {
  return {
    page,
    log,
    options: overrides,
    wait,
    captureTelemetry: (tag) => captureTelemetry(page, iterationDir, tag),
    screenshot: (name) => takeScreenshot(page, iterationDir, name),
    ensurePlayingState: () => ensurePlayingState(page, log),
    reloadGame: async (reason) => {
      if (reason) log(`Reloading (${reason})`);
      await page.reload({ waitUntil: 'networkidle2', timeout: 30000 });
      await page.waitForFunction(() => window.game && window.State, { timeout: 20000 });
      await enablePerfTelemetry(page, log);
    },
    detectHooks: () => detectHooks(page),
  };
}

async function runScenario(options) {
  const {
    name,
    runner,
    iteration,
    iterationDir,
    scenarioOptions,
    browser,
  } = options;

  ensureDir(iterationDir);
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 800 });
  const recorder = createConsoleRecorder(page);
  const logPrefix = `[${name}#${iteration}]`;
  const log = (...args) => console.log(logPrefix, ...args);

  try {
    await ensureGameBoot(page, log);
    await ensurePlayingState(page, log);
    const hooks = await detectHooks(page);

    const context = buildScenarioContext(page, log, iterationDir, scenarioOptions);
    const scenarioResult = await runner(context);
    const telemetryTail = await captureTelemetry(page, iterationDir, 'scenario-complete');

    await recorder.export(iterationDir);

    const summary = {
      scenario: name,
      iteration,
      success: true,
      hooks,
      result: scenarioResult,
      telemetry: telemetryTail.data,
      console: recorder.getCounts(),
    };

    await fs.promises.writeFile(
      path.join(iterationDir, 'result.json'),
      JSON.stringify(summary, null, 2)
    );

    await page.close();
    return summary;
  } catch (err) {
    console.error(`${logPrefix} failed`, err);
    await recorder.export(iterationDir).catch(() => {});
    await takeScreenshot(page, iterationDir, 'scenario-error').catch(() => {});

    const failure = {
      scenario: name,
      iteration,
      success: false,
      error: err.message,
      stack: err.stack,
      console: recorder.getCounts(),
    };
    await fs.promises.writeFile(
      path.join(iterationDir, 'result.json'),
      JSON.stringify(failure, null, 2)
    );

    await page.close();
    return failure;
  }
}

function selectScenarioOverrides(args) {
  return {
    'idle-soak': {
      durationMs: numberFromArg(args.idleDurationMs, undefined),
      sampleIntervalMs: numberFromArg(args.idleSampleIntervalMs, undefined),
    },
    'combat-stress': {
      waves: numberFromArg(args.combatWaves, undefined),
      volleyDelayMs: numberFromArg(args.combatVolleyDelayMs, undefined),
      prepareDelayMs: numberFromArg(args.combatPrepareDelayMs, undefined),
    },
    'restart-churn': {
      cycles: numberFromArg(args.restartCycles, undefined),
      soakMs: numberFromArg(args.restartSoakMs, undefined),
    },
    'progression-run': {
      plan: args.progressionPlan,
      biomes: args.progressionBiomes,
      levels: numberFromArg(args.progressionLevels, undefined),
      autoUpgradeStrategy: args.progressionAutoUpgrades,
      maxLevels: numberFromArg(args.progressionMaxLevels, undefined),
      stopAfterBoss: 'progressionStopAfterBoss' in args ? coerceBoolean(args.progressionStopAfterBoss) : undefined,
    },
    'profile-buckets': {
      durationMs: numberFromArg(args.profileDurationMs, undefined),
    },
    'combat-profile-highlevel': {
      targetLevel: numberFromArg(args.targetLevel, undefined),
      spawnWaitMs: numberFromArg(args.spawnWaitMs, undefined),
      profileDurationMs: numberFromArg(args.profileDurationMs, undefined),
    },
    'combat-spike-diag': {
      targetLevel: numberFromArg(args.targetLevel, undefined),
      spawnWaitMs: numberFromArg(args.spawnWaitMs, undefined),
      profileDurationMs: numberFromArg(args.profileDurationMs, undefined),
      minimal: 'minimal' in args ? coerceBoolean(args.minimal) : undefined,
      spikeThresholdMs: numberFromArg(args.spikeThresholdMs, undefined),
    },
  };
}

function mergeScenarioOptions(defaults, overrides) {
  const merged = { ...defaults };
  for (const [key, value] of Object.entries(overrides)) {
    if (value === undefined || value === null || Number.isNaN(value)) continue;
    merged[key] = value;
  }
  return merged;
}

async function main() {
  const cli = parseArgs(process.argv.slice(2));
  const config = { ...DEFAULT_CONFIG };
  if (cli.scenarios) {
    config.scenarios = cli.scenarios.split(',').map((s) => s.trim()).filter(Boolean);
  }
  config.iterations = numberFromArg(cli.iterations, config.iterations);
  config.headed = 'headed' in cli ? coerceBoolean(cli.headed) : config.headed;
  config.output = cli.output ? path.resolve(PROJECT_ROOT, cli.output) : config.output;

  ensureDir(config.output);
  const runId = new Date().toISOString().replace(/[:.]/g, '-');
  const runDir = path.join(config.output, runId);
  ensureDir(runDir);

  const overrides = selectScenarioOverrides(cli);
  let server = null;
  try {
    server = await startStaticServer();
  } catch (err) {
    if (err.code === 'EADDRINUSE') {
      console.warn('Port 8000 already in use, assuming local server is running.');
    } else {
      throw err;
    }
  }
  const browser = await puppeteer.launch({
    headless: config.headed ? false : 'new',
    args: CHROME_ARGS,
  });

  const runResults = [];
  try {
    console.log('Perf harness starting...');
    console.log(`Scenarios: ${config.scenarios.join(', ')}`);
    console.log(`Iterations: ${config.iterations}`);
    console.log(`Artifacts: ${runDir}`);

    for (const scenarioName of config.scenarios) {
      const scenario = SCENARIOS[scenarioName];
      if (!scenario) {
        console.warn(`Unknown scenario ${scenarioName}, skipping.`);
        continue;
      }
      console.log(`\n▶ Scenario: ${scenarioName} — ${scenario.description}`);
      for (let i = 1; i <= config.iterations; i += 1) {
        const scenarioOptions = mergeScenarioOptions(
          scenario.defaults,
          overrides[scenarioName] || {}
        );
        const iterationDir = path.join(runDir, scenarioName, `iteration-${i}`);
        const result = await runScenario({
          name: scenarioName,
          runner: scenario.runner,
          iteration: i,
          iterationDir,
          scenarioOptions,
          browser,
        });
        runResults.push(result);
        const status = result.success ? '✅' : '❌';
        console.log(`  ${status} iteration ${i} complete`);
      }
    }
  } finally {
    await browser.close().catch(() => {});
    await stopServer(server);
  }

  await fs.promises.writeFile(
    path.join(runDir, 'summary.json'),
    JSON.stringify({
      startedAt: runId,
      results: runResults,
    }, null, 2)
  );

  const failures = runResults.filter((r) => !r.success);
  if (failures.length > 0) {
    console.error(`\nPerf harness completed with ${failures.length} failed iteration(s).`);
    process.exit(1);
  } else {
    console.log('\nPerf harness completed successfully.');
    process.exit(0);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((err) => {
    console.error('Fatal error in perf harness', err);
    process.exit(1);
  });
}
