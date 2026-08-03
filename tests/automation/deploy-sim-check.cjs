// Boot the LIVE launcher (index.html — no window.__test/game globals) from the
// simulated deployed set; assert zero console errors, zero failed requests,
// and a canvas present after boot.
const puppeteer = require('puppeteer');
(async () => {
  const errors = [];
  const failed = [];
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--use-angle=swiftshader',
           '--enable-webgl', '--ignore-gpu-blocklist', '--disable-gpu-sandbox'],
  });
  const page = await browser.newPage();
  page.setViewport({ width: 1280, height: 800 });
  page.on('console', m => {
    const t = m.text();
    if (m.type() === 'error' && !/favicon|GroupMarker|AudioContext|Pointer lock/i.test(t)) errors.push(t);
  });
  page.on('pageerror', e => errors.push('PageError: ' + e.message));
  page.on('requestfailed', r => failed.push(r.url() + ' -> ' + (r.failure()?.errorText || '?')));
  await page.goto('http://localhost:8015/index.html', { waitUntil: 'networkidle2', timeout: 20000 });
  await new Promise(r => setTimeout(r, 4000));
  const canvas = await page.evaluate(() => !!document.querySelector('canvas'));
  console.log('canvas:', canvas);
  console.log('failed requests:', failed.length ? failed : 'none');
  console.log('console errors:', errors.length ? errors : 'none');
  await browser.close();
  process.exit(errors.length === 0 && failed.length === 0 && canvas ? 0 : 1);
})().catch(e => { console.error(e); process.exit(1); });
