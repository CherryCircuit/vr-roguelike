const http = require('http');
const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer');

const MIME_TYPES = {
  '.html': 'text/html',
  '.js': 'application/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.mp3': 'audio/mpeg',
  '.wav': 'audio/wav',
  '.glb': 'model/gltf-binary',
  '.gltf': 'model/gltf+json',
  '.ico': 'image/x-icon'
};

const ROOT_DIR = __dirname;
const PORT = 8000;

function getMimeType(filePath) {
  return MIME_TYPES[path.extname(filePath).toLowerCase()] || 'application/octet-stream';
}

function startStaticServer() {
  return new Promise((resolve, reject) => {
    const server = http.createServer((req, res) => {
      const urlPath = decodeURIComponent(req.url.split('?')[0]);
      const requestPath = urlPath === '/' ? '/index.html' : urlPath;
      const safePath = path.normalize(path.join(ROOT_DIR, requestPath));

      if (!safePath.startsWith(ROOT_DIR)) {
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
            'Access-Control-Allow-Origin': '*'
          });
          res.end(data);
        });
      });
    });

    server.on('error', reject);
    server.listen(PORT, () => resolve(server));
  });
}

function stopServer(server) {
  if (!server) return Promise.resolve();
  return new Promise(resolve => server.close(resolve));
}

async function testGame() {
  console.log('🧪 Ready Screen Kill Test\n');

  let server;
  let browser;

  try {
    server = await startStaticServer();

    browser = await puppeteer.launch({
      headless: 'new',
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--use-angle=swiftshader',
        '--enable-webgl',
        '--ignore-gpu-blocklist',
        '--disable-gpu-sandbox',
        '--enable-features=WebGL'
      ]
    });

    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 800 });

    const errors = [];
    page.on('console', msg => {
      if (msg.type() === 'error' && !msg.text().includes('404') && !msg.text().includes('GroupMarker')) {
        errors.push(msg.text());
      }
    });

    console.log('1. Loading game...');
    await page.goto(`http://localhost:${PORT}`, { waitUntil: 'networkidle2', timeout: 15000 });
    await page.waitForFunction(() => window.game && window.State, { timeout: 15000 });

    const center = { x: 640, y: 400 };

    console.log('2. Engaging screen (click once)...');
    await page.mouse.click(center.x, center.y);
    await page.waitForFunction(() => document.pointerLockElement === document.body || window.game?.state !== 'title', { timeout: 5000 }).catch(() => {});

    console.log('3. Starting level 1 (click once)...');
    await page.mouse.click(center.x, center.y);
    await page.waitForFunction(() => window.game && ['playing', 'country_select', 'name_entry'].includes(window.game.state), { timeout: 15000 });

    let state = await page.evaluate(() => window.game?.state);
    console.log('   State after clicks:', state);

    // Handle country select if it appears (game checks on start)
    if (state === 'country_select' || state === 'name_entry') {
      console.log('   Country select appeared, setting localStorage...');

      await page.evaluate(() => {
        localStorage.setItem('spaceomicide_country', 'US');
        localStorage.setItem('spaceomicide_name', 'TestPlayer');
      });

      await page.reload({ waitUntil: 'networkidle2' });
      await page.waitForFunction(() => window.game && window.State, { timeout: 15000 });
      await page.mouse.click(center.x, center.y);
      await page.mouse.click(center.x, center.y);
      await page.waitForFunction(() => window.game && window.game.state === 'playing', { timeout: 15000 });
      state = await page.evaluate(() => window.game?.state);
      console.log('   State after reload:', state);
    }

    if (state !== 'playing') {
      console.log('❌ Could not start game');
      await page.screenshot({ path: 'test-failed.png' });
      return { success: false, state };
    }

    console.log('   ✓ Game started\n');

    console.log('4. Waiting for enemies...');
    await page.waitForFunction(() => window.__test?.getEnemyCount && window.__test.getEnemyCount() > 0, { timeout: 15000 });

    const shot = await page.evaluate(() => {
      const api = window.__test;
      if (!api || !api.getEnemies || !api.getCamera || !api.fireAtEnemy) return null;

      const enemies = api.getEnemies();
      const camera = api.getCamera();
      if (!enemies || !camera || enemies.length === 0) return null;

      const width = window.innerWidth;
      const height = window.innerHeight;
      const centerX = width / 2;
      const centerY = height / 2;

      let bestIndex = -1;
      let bestDist = Infinity;

      for (let i = 0; i < enemies.length; i += 1) {
        const enemy = enemies[i];
        if (!enemy || !enemy.mesh || !enemy.mesh.position) continue;
        const pos = enemy.mesh.position.clone();
        const toEnemy = pos.clone().sub(camera.position);
        const dir = camera.getWorldDirection(new pos.constructor());
        const facing = toEnemy.clone().normalize().dot(dir);
        if (facing <= 0) continue;

        const projected = pos.clone().project(camera);
        if (projected.z < -1 || projected.z > 1) continue;

        const screenX = (projected.x * 0.5 + 0.5) * width;
        const screenY = (-projected.y * 0.5 + 0.5) * height;
        const dist = Math.hypot(screenX - centerX, screenY - centerY);

        if (dist < bestDist) {
          bestDist = dist;
          bestIndex = i;
        }
      }

      if (bestIndex < 0) return null;
      const fired = api.fireAtEnemy(bestIndex, { snapToCamera: true, distance: 6, hp: 1 });
      return { fired, index: bestIndex };
    });

    if (!shot || !shot.fired) {
      console.log('❌ Could not find target enemy for deterministic shot');
      await page.screenshot({ path: 'test-no-target.png' });
      return { success: false, state: 'no-target' };
    }

    const startScore = await page.evaluate(() => window.game?.score || 0);
    const startKills = await page.evaluate(() => window.game?.kills || 0);
    console.log('5. Fired deterministic shot at enemy...');

    console.log('6. Waiting for score or kills to increase...');
    await page.waitForFunction(
      (score, kills) => window.game && (window.game.score > score || window.game.kills > kills),
      { timeout: 10000 },
      startScore,
      startKills
    );

    const result = await page.evaluate(() => ({
      state: window.game?.state,
      level: window.game?.level,
      score: window.game?.score,
      kills: window.game?.kills,
      health: window.game?.health
    }));

    console.log('   State:', result.state);
    console.log('   Level:', result.level);
    console.log('   Score:', result.score);
    console.log('   Kills:', result.kills);
    console.log('   Health:', result.health);

    await page.screenshot({ path: 'test-result.png' });

    const success = result.state === 'playing' && result.score > startScore && errors.length === 0;

    console.log('\n' + (success ? '✅ TEST PASSED' : '❌ TEST FAILED'));
    if (errors.length > 0) {
      console.log('Errors:', errors.slice(0, 3));
    }

    return { success, result, errors };
  } finally {
    if (browser) {
      await browser.close();
    }
    await stopServer(server);
  }
}

testGame().then(r => process.exit(r.success ? 0 : 1));
