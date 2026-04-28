const http = require('http');
const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer');

const MIME_TYPES = {
  '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css',
  '.json': 'application/json', '.png': 'image/png', '.glb': 'model/gltf-binary',
  '.wav': 'audio/wav', '.mp3': 'audio/mpeg', '.svg': 'image/svg+xml',
};
const ROOT_DIR = path.resolve(__dirname, '../..');
const PORT = 8111;

function startServer() {
  return new Promise((resolve, reject) => {
    const server = http.createServer((req, res) => {
      const urlPath = decodeURIComponent(req.url.split('?')[0]);
      const requestPath = urlPath === '/' ? '/dev.html' : urlPath;
      const safePath = path.normalize(path.join(ROOT_DIR, requestPath));
      if (!safePath.startsWith(ROOT_DIR)) { res.writeHead(403); res.end(); return; }
      fs.readFile(safePath, (e, data) => {
        if (e) { res.writeHead(404); res.end('Not found'); return; }
        res.writeHead(200, { 'Content-Type': MIME_TYPES[path.extname(safePath).toLowerCase()] || 'application/octet-stream' });
        res.end(data);
      });
    });
    server.on('error', reject);
    server.listen(PORT, () => resolve(server));
  });
}

(async () => {
  const server = await startServer();
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--use-angle=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist', '--disable-gpu-sandbox'],
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 800 });
  page.on('console', msg => { if (msg.type() === 'error') console.log('[ERR]', msg.text().slice(0, 150)); });

  console.log('Loading game (dev.html)...');
  await page.goto(`http://localhost:${PORT}/dev.html`, { waitUntil: 'networkidle2', timeout: 20000 });

  // Wait for game init
  await page.waitForFunction(() => window.__test?.progression, { timeout: 20000 });
  console.log('Game loaded.');

  // Set localStorage to skip country select
  await page.evaluate(() => {
    localStorage.setItem('spaceomicide_country', 'US');
    localStorage.setItem('spaceomicide_name', 'Test');
  });

  // Force-complete level 1, auto-select weapon → goes to level 2
  console.log('Force-completing level 1 (weapon select)...');
  const r1 = await page.evaluate(() => window.__test.progression.forceLevelComplete({ autoSelect: 'first' }));
  console.log('Level 1 result:', JSON.stringify({ level: r1.level, state: r1.state }));

  // Force-complete level 2, but DON'T auto-select → stop at upgrade screen
  console.log('Force-completing level 2 (stop at upgrade screen)...');
  const r2 = await page.evaluate(async () => {
    const result = await window.__test.progression.forceLevelComplete({ autoSelect: false });
    // Wait a beat for upgrade screen to appear
    await new Promise(r => setTimeout(r, 500));
    return result;
  });
  console.log('Level 2 result:', JSON.stringify({ level: r2.level, state: r2.state, awaiting: r2.awaitingUpgrade }));

  // If at level_complete, wait for it to transition to upgrade_select
  await page.evaluate(async () => {
    for (let i = 0; i < 30; i++) {
      if (window.game?.state === 'upgrade_select') break;
      await new Promise(r => setTimeout(r, 200));
    }
  });

  // Wait for upgrade screen to render
  await new Promise(r => setTimeout(r, 2500));

  // Check state
  const state = await page.evaluate(() => window.game?.state);
  console.log('Current state:', state);

  // Check for refresh button in 3D scene
  const refreshFound = await page.evaluate(() => {
    const scene = window.__test?.getScene?.();
    if (!scene) return 'no scene';
    let found = false;
    scene.traverse(obj => { if (obj.userData?.isRefreshButton) found = true; });
    return found;
  });
  console.log('Refresh button in scene:', refreshFound);

  // Take screenshot
  const screenshotPath = path.join(ROOT_DIR, 'test-screenshot-upgrades.png');
  await page.screenshot({ path: screenshotPath });
  console.log('Screenshot saved:', screenshotPath);

  await browser.close();
  server.close();
})().catch(e => { console.error(e); process.exit(1); });
