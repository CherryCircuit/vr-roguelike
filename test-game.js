const puppeteer = require('puppeteer');

async function testGame() {
  console.log('🧪 Quick Desktop Controls Test\n');
  
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
  await new Promise(r => setTimeout(r, 1000));

  console.log('2. Starting game (clicking twice for ready screen)...');
  await page.mouse.click(640, 400);
  await new Promise(r => setTimeout(r, 500));
  await page.mouse.click(640, 400);
  await new Promise(r => setTimeout(r, 2000));

  let state = await page.evaluate(() => window.game?.state);
  console.log('   State after clicks:', state);

  // Handle country select if it appears (game checks on start)
  if (state === 'country_select' || state === 'name_entry') {
    console.log('   Country/name select appeared, setting via localStorage and reloading...');
    await page.evaluate(() => {
      localStorage.setItem('playerCountry', 'US');
      localStorage.setItem('playerName', 'TestPlayer');
    });
    await page.reload({ waitUntil: 'networkidle2' });
    await new Promise(r => setTimeout(r, 2000));
    
    // Click to start again after reload
    await page.mouse.click(640, 400);
    await new Promise(r => setTimeout(r, 500));
    await page.mouse.click(640, 400);
    await new Promise(r => setTimeout(r, 1500));
    
    state = await page.evaluate(() => window.game?.state);
    console.log('   State after reload:', state);
  }

  if (state !== 'playing') {
    console.log('   Still not playing, trying space key...');
    await page.keyboard.press('Space');
    await new Promise(r => setTimeout(r, 1000));
    state = await page.evaluate(() => window.game?.state);
    console.log('   State after space:', state);
  }

  if (state !== 'playing') {
    console.log('❌ Could not start game');
    await page.screenshot({ path: 'test-failed.png' });
    await browser.close();
    return { success: false, state };
  }

  console.log('   ✓ Game started\n');

  console.log('3. Testing shooting (holding SPACE for 3 seconds)...');
  await page.keyboard.down('Space');
  await new Promise(r => setTimeout(r, 3000));
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

  await page.screenshot({ path: 'test-result.png' });
  await browser.close();

  const success = result.state === 'playing' && errors.length === 0;
  
  console.log('\n' + (success ? '✅ TEST PASSED' : '❌ TEST FAILED'));
  if (errors.length > 0) {
    console.log('Errors:', errors.slice(0, 3));
  }

  return { success, result, errors };
}

testGame().then(r => process.exit(r.success ? 0 : 1));
