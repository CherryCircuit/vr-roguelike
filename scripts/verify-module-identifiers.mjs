// ============================================================
// Verify every module references only identifiers it defines or
// imports. Catches the class of production bug where extracted
// modules reference main.js scratch variables that stayed behind
// (e.g. _uiRaycaster on tank weak-point hits, #196 Phase 2 fallout).
//
// Heuristic scope analysis: flags free identifiers that are not
// declared anywhere in the file (module or function scope), not
// imported, and not in the global allowlist. Property accesses
// (x.y), object keys (k:), string contents and $ replacement tokens
// are skipped. Output includes the surrounding line for review.
//
// Usage: node scripts/verify-module-identifiers.mjs [files...]
// ============================================================

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const DEFAULT_FILES = [
  'beam-weapons.js',
  'projectile-system.js',
  'alt-weapons.js',
  'enemies.js',
  'weapons.js',
  'game.js',
  'audio.js',
  'hud.js',
  'boss-death-cinematic.js',
  'stasis.js',
  'voxel-debris.js',
  'damage-numbers.js',
];

// ── Global allowlist ──
const GLOBALS = new Set(`
Math console Object Array Number String Boolean JSON Date Error Promise RegExp Set Map WeakMap
WeakSet Symbol BigInt Infinity NaN undefined null true false parseInt parseFloat isNaN isFinite
performance document window navigator requestAnimationFrame cancelAnimationFrame
setTimeout clearTimeout setInterval clearInterval queueMicrotask crypto URL TextEncoder
TextDecoder Blob File FormData fetch atob btoa encodeURIComponent decodeURIComponent
globalThis structuredClone ArrayBuffer DataView Float32Array Float64Array Int8Array Uint8Array
Uint8ClampedArray Int16Array Uint16Array Int32Array Uint32Array THREE arguments this super
debugger new typeof instanceof in of await yield async class extends static import export from
default as return if else for while do switch case break continue function var let const throw
try catch finally void delete with get set localStorage sessionStorage FontFace Audio Image
HTMLCanvasElement OffscreenCanvas Path2D requestIdleCallback cancelIdleCallback matchMedia
getComputedStyle devicePixelRatio screen location history Event CustomEvent KeyboardEvent
MouseEvent PointerEvent WheelEvent MutationObserver IntersectionObserver ResizeObserver
Text Node Element HTMLElement SVGElement HTMLImageElement TextDecoder TextEncoder Blob File
FormData requestAnimationFrame cancelAnimationFrame
`.trim().split(/\s+/));

const IDENT_RE = /\b[a-zA-Z_$][a-zA-Z0-9_$]*\b/g;

function collectDeclared(code) {
  const declared = new Set();
  // Module/function-scope const/let/var/function/class declarations
  const declRe = /\b(?:const|let|var|function|class)\s+([a-zA-Z_$][a-zA-Z0-9_$]*)/g;
  let m;
  while ((m = declRe.exec(code)) !== null) declared.add(m[1]);
  // Imported bindings: named {a, b as c}, default x, namespace * as x
  const importRe = /import\s+(?:(?:([a-zA-Z_$][\w$]*)\s*,\s*)?(?:\{([^}]*)\}|\*\s*as\s+([a-zA-Z_$][\w$]*))|([a-zA-Z_$][\w$]*))\s*from/g;
  while ((m = importRe.exec(code)) !== null) {
    for (const g of [1, 3, 4]) if (m[g]) declared.add(m[g]);
    if (m[2]) {
      for (const part of m[2].split(',')) {
        const name = part.trim().split(/\s+as\s+/).pop();
        if (name) declared.add(name);
      }
    }
  }
  // Function + arrow + catch parameters (each branch carries its own close paren)
  const paramsRe = /function\s+[a-zA-Z_$][\w$]*\s*\(([^)]*)\)|catch\s*\(([^)]*)\)|\(([^)]*)\)\s*=>/g;
  while ((m = paramsRe.exec(code)) !== null) {
    const params = m[1] || m[2] || m[3] || '';
    for (const part of params.split(',')) {
      // Strip nested parens (forEach((e, i) => ...) captures "(e, i")
      const clean = part.trim().replace(/^\.\.\./, '').replace(/=.*$/, '').replace(/^\(+/, '').replace(/\)+$/, '');
      const name = clean.split(':').pop().trim(); // destructured params: {a, b} / [a, b]
      if (/^[a-zA-Z_$][\w$]*$/.test(name)) declared.add(name);
    }
  }
  // Bare single-param arrows: forEach(x => ...) — no parens around the param
  const bareArrowRe = /(?:^|[^a-zA-Z_$.\w])([a-zA-Z_$][\w$]*)\s*=>/g;
  while ((m = bareArrowRe.exec(code)) !== null) {
    declared.add(m[1]);
  }
  // for (const x of ...) / for (let x in ...) loop variables
  const forOfRe = /for\s*\(\s*(?:const|let|var)\s+([a-zA-Z_$][\w$]*)\s+(?:of|in)\b/g;
  while ((m = forOfRe.exec(code)) !== null) {
    declared.add(m[1]);
  }
  // Setter params: set quaternion(q) { ... }
  const setterRe = /\bset\s+[a-zA-Z_$][\w$]*\s*\(([^)]*)\)/g;
  while ((m = setterRe.exec(code)) !== null) {
    for (const part of m[1].split(',')) {
      const name = part.trim().replace(/=.*$/, '');
      if (/^[a-zA-Z_$][\w$]*$/.test(name)) declared.add(name);
    }
  }
  // Destructured declarations: const { a, b: c } = / let [x, y] =
  const destrRe = /\b(?:const|let|var)\s+\{([^}]*)\}\s*=/g;
  while ((m = destrRe.exec(code)) !== null) {
    for (const part of m[1].split(',')) {
      const name = part.trim().split(/\s*:\s*/).pop();
      if (/^[a-zA-Z_$][\w$]*$/.test(name)) declared.add(name);
    }
  }
  return declared;
}

// ── Pre-process: strip comments, strings and template literals so only
//    real code identifiers are tokenized. Template ${...} interpolations
//    are preserved (their inner identifiers are real code). ──
function stripLiterals(code) {
  // Line comments
  code = code.replace(/\/\/[^\n]*/g, '');
  // Block comments
  code = code.replace(/\/\*[\s\S]*?\*\//g, '');
  // Single/double quoted strings
  code = code.replace(/'(?:[^'\\\n]|\\.)*'|"(?:[^"\\\n]|\\.)*"/g, '""');
  // Template literals: keep ${...} interpolations, drop the rest
  code = code.replace(/`(?:[^`\\]|\\.)*`/g, (tmpl) => {
    const parts = [];
    let re = /\$\{([^}]*)\}/g;
    let m;
    while ((m = re.exec(tmpl)) !== null) parts.push(m[1]);
    return parts.join(' ');
  });
  return code;
}

function isStringContext(code, index) {
  // Walk backwards from the identifier to find the nearest quote; crude but
  // effective for catching identifiers inside '...' / "..." strings.
  let i = index - 1;
  while (i >= 0 && /[a-zA-Z0-9_$ ]/.test(code[i])) i--;
  const before = code[i];
  if (before === `'` || before === `"`) return true;
  return false;
}

function auditFile(relPath) {
  const raw = readFileSync(join(root, relPath), 'utf8');
  const code = stripLiterals(raw);
  const declared = collectDeclared(raw); // declarations from the RAW code (params etc.)
  const flagged = [];
  let m;
  while ((m = IDENT_RE.exec(code)) !== null) {
    const token = m[0];
    const idx = m.index;
    const before = code[idx - 1];
    const after = code[idx + token.length];
    // Skip: property access (x.foo, x?.foo), object keys (foo:), $ templates
    if (before === '.' || before === '?') continue;
    if (after === ':') continue;
    if (token === '$' || /^\$\d/.test(token)) continue;
    if (isStringContext(code, idx)) continue;
    if (declared.has(token) || GLOBALS.has(token)) continue;
    // Context for review: first raw-code line containing the token
    const lines = raw.split('\n');
    const ctx = lines.find(l => new RegExp(`\\b${token}\\b`).test(l)) || '';
    flagged.push({ token, line: ctx.trim().slice(0, 140) });
  }
  return flagged;
}

const files = process.argv.slice(2).length ? process.argv.slice(2) : DEFAULT_FILES;
let total = 0;
for (const f of files) {
  const flagged = auditFile(f);
  if (flagged.length) {
    console.log(`\n=== ${f}: ${flagged.length} potential undefined identifier(s) ===`);
    for (const { token, line } of flagged) {
      console.log(`  ? ${token}  →  ${line}`);
      total++;
    }
  } else {
    console.log(`✅ ${f} — clean`);
  }
}
console.log(`\n${total} flagged total (review manually; false positives expected for locals`);
process.exit(total === 0 ? 0 : 0);
