import puppeteer from '/home/graeme/.openclaw/workspace-codey/vr-roguelike/node_modules/puppeteer/lib/esm/puppeteer/puppeteer.js';
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const browser = await puppeteer.launch({
  executablePath: '/usr/bin/google-chrome',
  headless: 'new',
  args: [
    '--no-sandbox','--disable-setuid-sandbox','--disable-dev-shm-usage','--no-first-run',
    '--use-fake-ui-for-media-stream','--autoplay-policy=no-user-gesture-required','--use-angle=swiftshader',
    '--enable-webgl','--ignore-gpu-blocklist','--disable-gpu-sandbox','--enable-features=WebGL'
  ]
});
const page = await browser.newPage();
await page.setViewport({ width: 1280, height: 800 });
const pageErrors = [];
page.on('pageerror', err => pageErrors.push(err.message));
await page.goto('http://localhost:8000', { waitUntil: 'networkidle2', timeout: 30000 }).catch(() => {});
await sleep(6000);
await page.mouse.click(640, 400);
await sleep(2500);
await page.mouse.click(640, 400);
await sleep(1500);
await page.waitForFunction(() => window.__test && typeof window.__test.getEnemyCount === 'function', { timeout: 10000 });
await page.waitForFunction(() => window.__test.getEnemyCount() > 0, { timeout: 15000 }).catch(() => {});
const fireResult = await page.evaluate(async () => {
  const results = [];
  for (let i = 0; i < 4; i++) {
    results.push(window.__test?.fireAtEnemy?.(0, { distance: 7, snapToCamera: true, hp: 5 }) ?? false);
    await new Promise(r => setTimeout(r, 120));
  }
  return { enemyCount: window.__test?.getEnemyCount?.() ?? null, fired: results, title: document.title };
});
await sleep(250);
await page.screenshot({ path: '/home/graeme/.openclaw/workspace-codey/vr-roguelike/tmp/synthwave-projectiles-check.png' });
console.log(JSON.stringify({ fireResult, pageErrors }, null, 2));
await browser.close();
