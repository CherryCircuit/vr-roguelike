// ============================================================
// Stamp the build/deploy date into index.html's version text.
// Runs as the Vercel buildCommand (vercel.json) so the shipped
// page always shows the actual deploy date instead of a stale
// hand-edited string. Pure Node stdlib — no dependencies.
// Usage: node scripts/stamp-version.mjs
// ============================================================

import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const indexPath = join(root, 'index.html');
const html = readFileSync(indexPath, 'utf8');

const pad = (n) => String(n).padStart(2, '0');
const d = new Date();
const hour12 = d.getUTCHours() % 12 || 12;
const ampm = d.getUTCHours() < 12 ? 'AM' : 'PM';
const version = `v${d.getUTCFullYear()}.${pad(d.getUTCMonth() + 1)}.${pad(d.getUTCDate())}.${pad(hour12)}${pad(d.getUTCMinutes())}${ampm}`;

const next = html.replace(/(id="version-text">)(v[^<]*)(<\/p>)/, `$1${version}$3`);
if (next === html) {
  // Distinguish "element missing" from "already stamped in this same minute"
  // (re-running the build twice in one minute produces an identical string)
  if (!html.includes('id="version-text">')) {
    console.error('[stamp-version] version-text element not found — aborting');
    process.exit(1);
  }
  console.log(`[stamp-version] Already stamped ${version} — no change`);
  process.exit(0);
}

writeFileSync(indexPath, next);
console.log(`[stamp-version] Stamped ${version} into index.html`);
