#!/usr/bin/env node
import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

const PROJECT = path.resolve(process.argv[1], '../../..');
const ARTIFACTS_DIR = path.join(PROJECT, 'tests/perf/artifacts');

const FLAGS = [
  ['ENABLE_FLOOR_BLOOM', path.join(PROJECT, 'biomes/synthwave-valley.js')],
  ['ENABLE_SPEED_LINES', path.join(PROJECT, 'hud.js')],
  ['ENABLE_MUZZLE_FLASH', path.join(PROJECT, 'main.js')],
  ['ENABLE_SPAWN_WARP', path.join(PROJECT, 'enemies.js')],
];

function setFlag(file, flag, val) {
  const c = fs.readFileSync(file, 'utf8');
  fs.writeFileSync(file, c.replace(new RegExp(`const ${flag} = (true|false);`), `const ${flag} = ${val};`));
}

function restoreAll() { FLAGS.forEach(([f, p]) => setFlag(p, f, true)); }

function getLatestResult() {
  const dirs = fs.readdirSync(ARTIFACTS_DIR).sort();
  const latest = path.join(ARTIFACTS_DIR, dirs[dirs.length - 1]);
  const resultFile = path.join(latest, 'idle-soak/iteration-1/result.json');
  if (!fs.existsSync(resultFile)) return null;
  const d = JSON.parse(fs.readFileSync(resultFile, 'utf8'));
  const t = d.telemetry?.instrumentation || {};
  return {
    label: '',
    drawCalls: t.renderer?.drawCalls,
    triangles: t.renderer?.triangles,
    geometries: t.renderer?.geometries,
    frameTimeAvg: t.frameTimeMs?.avgHistory,
    errors: d.console?.pageErrors || 0,
  };
}

function runPerf(label) {
  process.stdout.write(`  ${label}...`);
  try {
    execSync(`cd ${PROJECT} && node tests/perf/run-perf.mjs idle-soak 2>&1`, {
      timeout: 60000,
      stdio: 'pipe',
    });
  } catch (e) {
    // harness may OOM on progression but idle-soak should complete
  }
  const r = getLatestResult();
  if (r) {
    r.label = label;
    console.log(` dc=${r.drawCalls} tri=${r.triangles} geo=${r.geometries} ft=${Number(r.frameTimeAvg).toFixed(1)}ms err=${r.errors}`);
  } else {
    console.log(' (no result)');
  }
  return r;
}

// --- Main ---

restoreAll();
const results = [];

console.log('\n=== FLAG PERF TEST ===');

console.log('\nPhase 1: Baseline (all enabled)');
results.push(runPerf('ALL_ENABLED'));

console.log('\nPhase 2: Individual flag tests');
for (const [flag, file] of FLAGS) {
  setFlag(file, flag, false);
  results.push(runPerf('OFF_' + flag.replace('ENABLE_', '')));
  setFlag(file, flag, true);
}

console.log('\nPhase 3: All disabled');
FLAGS.forEach(([f, p]) => setFlag(p, f, false));
results.push(runPerf('ALL_DISABLED'));

restoreAll();

// Summary table
const baseline = results.find(r => r.label === 'ALL_ENABLED');
console.log('\n=== RESULTS ===');
console.log('Label                    | DrawCalls | Triangles | GEO | FTavg  | vs Baseline');
console.log('-------------------------|-----------|-----------|-----|--------|------------');
for (const r of results) {
  const l = (r?.label || '?').padEnd(25);
  const dc = String(r?.drawCalls ?? '?').padStart(9);
  const tr = String(r?.triangles ?? '?').padStart(9);
  const g = String(r?.geometries ?? '?').padStart(3);
  const ft = r?.frameTimeAvg ? Number(r.frameTimeAvg).toFixed(1).padStart(6) : '     ?';
  let delta = '';
  if (baseline?.frameTimeAvg && r?.frameTimeAvg && r.label !== 'ALL_ENABLED') {
    const d = Number(r.frameTimeAvg) - Number(baseline.frameTimeAvg);
    delta = (d >= 0 ? '+' : '') + d.toFixed(1) + 'ms';
  }
  const deltaStr = delta.padStart(11);
  console.log(`${l}| ${dc} | ${tr} | ${g} | ${ft} | ${deltaStr}`);
}

console.log('\nAll flags restored to true.');
