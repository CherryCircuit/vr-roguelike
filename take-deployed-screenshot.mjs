import puppeteer from 'puppeteer';

async function main() {
  const browser = await puppeteer.launch({
    headless: true,
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
  
  console.log('Loading deployed site...');
  await page.goto('https://cherrycircuit.github.io/vr-roguelike/', { waitUntil: 'networkidle0', timeout: 30000 });
  
  // Wait for game to initialize
  await new Promise(r => setTimeout(r, 5000));
  
  console.log('Taking screenshot...');
  await page.screenshot({ path: 'deployed-screenshot.png', fullPage: false });
  
  // Get page errors
  const errors = await page.evaluate(() => window.__pageErrors || []);
  console.log('Page errors:', errors);
  
  await browser.close();
  console.log('Screenshot saved to deployed-screenshot.png');
}

main().catch(console.error);
