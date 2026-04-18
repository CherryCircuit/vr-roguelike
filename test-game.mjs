import puppeteer from '/home/graeme/.openclaw/workspace-codey/vr-roguelike/node_modules/puppeteer/lib/esm/puppeteer/puppeteer.js';

const browser = await puppeteer.launch({
  executablePath: '/usr/bin/google-chrome',
  headless: 'new',
  args: [
    '--no-sandbox',
    '--disable-setuid-sandbox',
    '--disable-dev-shm-usage',
    '--no-first-run',
    '--use-fake-ui-for-media-stream',
    '--autoplay-policy=no-user-gesture-required',
    '--use-angle=swiftshader',
    '--enable-webgl',
    '--ignore-gpu-blocklist',
    '--disable-gpu-sandbox',
    '--enable-features=WebGL',
  ]
});

const page = await browser.newPage();
await page.setViewport({ width: 1280, height: 800 });

const consoleMessages = [];
const pageErrors = [];
const networkFails = [];

page.on('console', msg => {
  consoleMessages.push({ type: msg.type(), text: msg.text(), location: msg.location() });
});

page.on('pageerror', err => {
  pageErrors.push({ message: err.message, stack: err.stack });
});

page.on('requestfailed', req => {
  networkFails.push(`${req.failure()?.errorText} - ${req.url()}`);
});

console.log('Navigating to game...');
try {
  await page.goto('http://localhost:8000', { waitUntil: 'networkidle2', timeout: 30000 });
} catch(e) {
  console.log('Navigation note:', e.message);
}

await new Promise(r => setTimeout(r, 6000));

const title = await page.title();
console.log('Page title:', title);

const domInfo = await page.evaluate(() => {
  const canvas = document.querySelector('canvas');
  const vrBtn = document.getElementById('VRButton');
  const infoEl = document.getElementById('info');
  const noVr = document.getElementById('no-vr');
  const testCanvas = document.createElement('canvas');
  const gl = testCanvas.getContext('webgl') || testCanvas.getContext('experimental-webgl');
  return {
    hasCanvas: !!canvas,
    canvasSize: canvas ? `${canvas.width}x${canvas.height}` : 'N/A',
    vrButton: vrBtn ? vrBtn.textContent?.trim() : 'NOT FOUND',
    infoText: infoEl ? infoEl.textContent?.trim().substring(0, 200) : 'NOT FOUND',
    noVrVisible: noVr ? (noVr.style.display !== 'none') : false,
    noVrContent: noVr ? noVr.textContent?.trim().substring(0, 200) : '',
    hasWebGL: !!gl,
    bodyText: document.body.innerText?.substring(0, 300),
  };
});

console.log('\n=== DOM State ===');
console.log(JSON.stringify(domInfo, null, 2));

console.log('\n=== Network Failures ===');
networkFails.forEach(f => console.log(f));

// Try clicking center for any 3D UI
await page.mouse.click(640, 400);
await new Promise(r => setTimeout(r, 2000));

// Move mouse to simulate gameplay
await page.mouse.move(700, 350);
await new Promise(r => setTimeout(r, 500));

// Try pressing W for movement
await page.keyboard.press('KeyW');
await new Promise(r => setTimeout(r, 1000));

await page.screenshot({ path: '/home/graeme/.openclaw/workspace-codey/vr-roguelike/game-screenshot.png' });
console.log('Screenshot saved');

console.log('\n=== Console Messages (' + consoleMessages.length + ' total) ===');
consoleMessages.forEach(m => {
  console.log(`[${m.type.toUpperCase()}] ${m.text}`);
  if (m.location?.url && m.location.lineNumber) {
    console.log(`  at ${m.location.url}:${m.location.lineNumber}`);
  }
});

console.log('\n=== Page Errors (' + pageErrors.length + ' total) ===');
pageErrors.forEach(e => {
  console.log('ERROR:', e.message);
  if (e.stack) console.log(e.stack.substring(0, 1000));
});

await browser.close();
console.log('\nTest complete.');
