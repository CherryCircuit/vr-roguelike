import puppeteer from 'puppeteer';
const sleep = ms => new Promise(r => setTimeout(r, ms));
const browser = await puppeteer.launch({
  headless: true,
  args: ['--no-sandbox','--disable-setuid-sandbox','--disable-dev-shm-usage','--use-angle=swiftshader','--enable-webgl','--ignore-gpu-blocklist','--disable-gpu-sandbox','--enable-unsafe-swiftshader']
});
const page = await browser.newPage();
await page.setViewport({width:1280,height:800});
await page.goto('http://localhost:8000',{waitUntil:'domcontentloaded',timeout:30000});
await sleep(5000);
await page.mouse.click(640,400);
await sleep(6000);
await page.screenshot({path:'/tmp/game-screenshot4.png',fullPage:false});
console.log('Screenshot saved');
await browser.close();
