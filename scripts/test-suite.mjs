// ============================================================
// Thin wrapper to run ONE existing automation suite by name.
//
//   npm run test:suite -- elemental
//   npm run test:suite -- test-elemental.cjs
//   npm run test:suite -- --list
//
// Exists so suites can be invoked through npm without creating a
// new test runner or chaining suites together (AGENTS.md §16 warns
// that batch runs flake on load contention — run them one at a time).
// ============================================================

import { spawn } from 'node:child_process';
import { readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const suiteDir = join(root, 'tests', 'automation');

function listSuites() {
  return readdirSync(suiteDir)
    .filter((f) => f.startsWith('test-') && f.endsWith('.cjs'))
    .sort();
}

function resolveSuite(arg) {
  if (!arg) return null;
  const base = arg.replace(/\.cjs$/i, '');
  const fileName = base.startsWith('test-') ? `${base}.cjs` : `test-${base}.cjs`;
  return { fileName, fullPath: join(suiteDir, fileName) };
}

const arg = process.argv[2];

if (!arg || arg === '--list' || arg === '-l') {
  const suites = listSuites();
  console.log(`Available suites (${suites.length}) — run: npm run test:suite -- <name>`);
  for (const s of suites) console.log(`  ${s.replace(/^test-|\.cjs$/g, '')}`);
  process.exit(0);
}

const suite = resolveSuite(arg);
const child = spawn(process.execPath, [suite.fullPath], { cwd: root, stdio: 'inherit' });

child.on('error', (err) => {
  console.error(`[test-suite] failed to launch ${suite.fileName}:`, err.message);
  process.exit(1);
});

child.on('exit', (code, signal) => {
  if (signal) {
    console.error(`[test-suite] ${suite.fileName} terminated by ${signal}`);
    process.exit(1);
  }
  process.exit(code ?? 1);
});
