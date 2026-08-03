// ============================================================
// Verify every runtime import/reference resolves inside the
// Vercel deployment file set (i.e. not blocked by .vercelignore).
//
// The .vercelignore exclusion list caused a production 404
// (bake-clouds.js, imported by two biomes). This script scans all
// files that WILL ship, extracts their relative import specifiers
// and index.html src/href references, and fails if any target is
// missing or ignored. Run before pushing deployment changes:
//   node scripts/verify-deploy-assets.mjs
// ============================================================

import { readFileSync, readdirSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, relative, sep, posix } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const IGNORE_FILE = join(root, '.vercelignore');

// ── .vercelignore pattern matching (mirrors Vercel semantics for the
//    simple patterns this repo uses: dir names, exact files, *.ext) ──
function readIgnorePatterns() {
  return readFileSync(IGNORE_FILE, 'utf8')
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith('#'));
}

function toRegex(pattern) {
  const escaped = pattern.replace(/[.+^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`^${escaped.replace(/\*/g, '[^/]*')}$`);
}

function isIgnored(relPath, patterns) {
  // relPath uses posix separators, relative to root
  const segments = relPath.split('/');
  for (const pattern of patterns) {
    const glob = pattern.replace(/\/$/, '');
    if (glob.includes('/')) {
      if (toRegex(glob).test(relPath)) return true;
    } else {
      if (segments.includes(glob)) return true; // dir or file name anywhere
      if (toRegex(glob).test(segments[segments.length - 1])) return true;
    }
  }
  return false;
}

// ── Walk the repo, building the deployed file set ──
function walk(dir, patterns, out) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const abs = join(dir, entry.name);
    const rel = posix.normalize(relative(root, abs));
    if (isIgnored(rel, patterns)) continue;
    if (entry.isDirectory()) {
      walk(abs, patterns, out);
    } else {
      out.add(rel);
    }
  }
}

// ── Extract relative import specifiers from a JS file ──
function findRelativeImports(code) {
  const found = [];
  // import ... from 'x'; / import 'x'; / export ... from 'x';
  const re = /(?:import|export)(?:[^'"]*?)\s*from\s*['"]([^'"]+)['"]|import\s*['"]([^'"]+)['"]/g;
  let m;
  while ((m = re.exec(code)) !== null) {
    const spec = m[1] || m[2];
    if (spec && (spec.startsWith('./') || spec.startsWith('../'))) found.push(spec);
  }
  return found;
}

// ── Main ──
const patterns = readIgnorePatterns();
const deployed = new Set();
walk(root, patterns, deployed);

const missing = [];
const scanned = [];

// index.html src/href references
const html = readFileSync(join(root, 'index.html'), 'utf8');
const htmlRefs = [...html.matchAll(/(?:src|href)="([^"]+)"/g)].map((m) => m[1]);
for (const ref of htmlRefs) {
  if (!/^(https?:|\/\/|data:|#)/.test(ref)) {
    const clean = ref.split('?')[0].split('#')[0];
    if (!deployed.has(clean)) missing.push(`index.html → ${ref}`);
  }
}

// JS module imports (relative only; bare specifiers resolve via import map)
for (const rel of deployed) {
  if (!rel.endsWith('.js') && !rel.endsWith('.mjs')) continue;
  const code = readFileSync(join(root, rel), 'utf8');
  scanned.push(rel);
  for (const spec of findRelativeImports(code)) {
    const resolved = posix.normalize(posix.join(posix.dirname(rel), spec));
    if (!deployed.has(resolved)) missing.push(`${rel} → ${spec}`);
  }
}

console.log(`[verify-deploy-assets] ${deployed.size} files deploy, ${scanned.length} JS modules scanned`);

if (missing.length > 0) {
  console.error('\n❌ MISSING RUNTIME REFERENCES (blocked by .vercelignore or not in repo):');
  for (const m of missing) console.error(`   - ${m}`);
  console.error(`\n[verify-deploy-assets] FAILED — fix .vercelignore before pushing`);
  process.exit(1);
}

console.log('[verify-deploy-assets] ✅ All runtime references resolve inside the deployment');
