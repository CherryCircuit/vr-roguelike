const puppeteer = require('puppeteer');

async function testGame() {
  console.log('🧪 Final Desktop Controls Test\n');
  
  const browser = await puppeteer.launch({
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
  await page.goto('http://localhost:8000', { waitUntil: 'networkidle2', timeout: 15000 });
  await new Promise(r => setTimeout(r, 2000));

  console.log('2. Starting game...');
  await page.mouse.click(640, 400);
  await new Promise(r => setTimeout(r, 500));
  await page.mouse.click(640, 400);
  await new Promise(r => setTimeout(r, 2000));

  const state = await page.evaluate(() => window.game?.state);
  if (state !== 'playing') {
    console.log('❌ Game not in playing state:', state);
    await browser.close();
    return { success: false };
  }
  console.log('   ✓ Game started\n');

  console.log('3. Testing shooting (holding SPACE for 5 seconds)...');
  await page.keyboard.down('Space');
  await new Promise(r => setTimeout(r, 5000));
  await page.keyboard.up('Space');
  await new Promise(r => setTimeout(r, 2000));

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

  await page.screenshot({ path: 'test-final-result.png' });
  await browser.close();

  const success = result.state === 'playing' && result.kills > 0 && errors.length === 0;
  
  console.log('\n' + (success ? '✅ TEST PASSED' : '❌ TEST FAILED'));
  if (errors.length > 0) {
    console.log('Errors:', errors);
  }

  return { success, result, errors };
}

testGame().then(r => process.exit(r.success ? 0 : 1));
