// ============================================================
// Stamp the build/deploy date into index.html's version text.
// Runs as the Vercel buildCommand (vercel.json) so the shipped
// page always shows the actual deploy date instead of a stale
// hand-edited string. Pure Node stdlib — no dependencies.
// Timestamps are rendered in PACIFIC TIME (America/Los_Angeles)
// so the hour/minutes match the player's local clock.
// Usage: node scripts/stamp-version.mjs
// ============================================================

import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const indexPath = join(root, 'index.html');
const html = readFileSync(indexPath, 'utf8');

// Pacific Time with DST handled by the IANA zone (America/Los_Angeles).
// Intl is available in all Node versions Vercel's builder ships.
const pad = (n) => String(n).padStart(2, '0');
const now = new Date();
const parts = new Intl.DateTimeFormat('en-US', {
  timeZone: 'America/Los_Angeles',
  year: 'numeric', month: '2-digit', day: '2-digit',
  hour: '2-digit', minute: '2-digit', hour12: true,
}).formatToParts(now);
const get = (t) => (parts.find(p => p.type === t) || {}).value || '';
const hour12 = String((parseInt(get('hour'), 10) % 12) || 12).padStart(2, '0');
const version = `v${get('year')}.${get('month')}.${get('day')}.${hour12}${get('minute')}${get('dayPeriod') === 'AM' ? 'AM' : 'PM'}`;

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
