import puppeteer from 'puppeteer';
const browser = await puppeteer.launch({
  headless: 'new',
  args: ['--no-sandbox','--disable-setuid-sandbox','--disable-dev-shm-usage',
    '--use-angle=swiftshader','--enable-webgl','--ignore-gpu-blocklist',
    '--disable-gpu-sandbox','--enable-features=WebGL','--enable-unsafe-swiftshader']
});
const page = await browser.newPage();
await page.goto('http://localhost:8000', { waitUntil: 'networkidle0', timeout: 30000 });
await new Promise(r => setTimeout(r, 3000));
await page.mouse.click(400, 300);
await new Promise(r => setTimeout(r, 2000));
await page.screenshot({ path: '/home/graeme/.openclaw/workspace-codey/fog-test.png', fullPage: false });
console.log('done');
await browser.close();
