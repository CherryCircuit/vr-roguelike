// ============================================================
// Minimal dependency-free static file server for local dev/tests.
//
// The documented test server command was `python3 -m http.server 8001`,
// but Python is not guaranteed on Windows dev machines. This is a
// stdlib-only equivalent so `npm run serve` works everywhere.
//
// Usage: node scripts/serve.mjs [port]   (default 8001)
// Tests hit: http://localhost:8001/dev.html
// ============================================================

import { createServer } from 'node:http';
import { readFile, stat, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve, extname, sep } from 'node:path';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const port = Number(process.argv[2] || 8001);

// Content types for the file kinds this repo ships (JS modules, assets, models).
const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.cjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.map': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.ico': 'image/x-icon',
  '.webp': 'image/webp',
  '.glb': 'model/gltf-binary',
  '.gltf': 'model/gltf+json',
  '.ttf': 'font/ttf',
  '.otf': 'font/otf',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.wasm': 'application/wasm',
  '.txt': 'text/plain; charset=utf-8',
  '.mp3': 'audio/mpeg',
  '.m4a': 'audio/mp4',
  '.wav': 'audio/wav',
  '.ogg': 'audio/ogg',
};

const server = createServer(async (req, res) => {
  try {
    // Dev-only write endpoint used by tools/layout-editor.html: saving a
    // screen writes layouts/<name>.json directly so the game picks it up on
    // reload. Disabled for anything but the simple layout names.
    if (req.method === 'POST' && (req.url || '').startsWith('/__layout/')) {
      const name = decodeURIComponent((req.url || '').slice('/__layout/'.length).split('?')[0]);
      if (!/^[a-z0-9_-]+$/i.test(name)) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: false, error: 'invalid layout name' }));
        return;
      }
      let body = '';
      let tooBig = false;
      req.on('data', (chunk) => { body += chunk; if (body.length > 2_000_000) { tooBig = true; req.destroy(); } });
      await new Promise((resolveEnd) => { req.on('end', resolveEnd); req.on('close', resolveEnd); });
      if (tooBig) { res.writeHead(413); res.end('payload too large'); return; }
      try { JSON.parse(body); } catch {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: false, error: 'invalid JSON' }));
        return;
      }
      const layoutsDir = resolve(root, 'layouts');
      const dest = resolve(layoutsDir, `${name}.json`);
      if (dest !== layoutsDir && !dest.startsWith(layoutsDir + sep)) {
        res.writeHead(403); res.end('Forbidden'); return;
      }
      await writeFile(dest, body, 'utf8');
      console.log(`[serve] saved layouts/${name}.json (${body.length} bytes)`);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: true, file: `layouts/${name}.json` }));
      return;
    }

    // Strip query/hash, decode, and reject traversal outside the repo root.
    const urlPath = decodeURIComponent((req.url || '/').split('?')[0].split('#')[0]);
    const filePath = resolve(root, '.' + urlPath);
    if (filePath !== root && !filePath.startsWith(root + sep)) {
      res.writeHead(403);
      res.end('Forbidden');
      return;
    }

    let target = filePath;
    try {
      const info = await stat(target);
      if (info.isDirectory()) target = join(target, 'index.html');
    } catch {
      res.writeHead(404);
      res.end('Not found');
      return;
    }

    const data = await readFile(target);
    res.writeHead(200, {
      'Content-Type': MIME[extname(target).toLowerCase()] || 'application/octet-stream',
      'Cache-Control': 'no-cache, no-store, must-revalidate',
    });
    res.end(data);
  } catch (err) {
    res.writeHead(500);
    res.end('Server error: ' + err.message);
  }
});

server.listen(port, () => {
  console.log(`[serve] ${root}`);
  console.log(`[serve] listening on http://localhost:${port} (tests: /dev.html)`);
});
