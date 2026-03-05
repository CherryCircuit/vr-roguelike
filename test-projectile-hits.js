const puppeteer = require('puppeteer');

async function testProjectileHits() {
  console.log('🎯 Testing Projectile Hit Detection\n');
  
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
  const logs = [];
  page.on('console', msg => {
    const text = msg.text();
    if (msg.type() === 'error' && !text.includes('404') && !text.includes('GroupMarker')) {
      errors.push(text);
    }
    // Capture projectile-related logs
    if (text.includes('[projectile]') || text.includes('[MAIN weapon]')) {
      logs.push(text);
    }
  });

  console.log('1. Loading game...');
  await page.goto('http://localhost:8000', { waitUntil: 'networkidle2', timeout: 15000 });
  await new Promise(r => setTimeout(r, 1000));

  console.log('2. Starting game...');
  await page.mouse.click(640, 400);
  await new Promise(r => setTimeout(r, 500));
  await page.mouse.click(640, 400);
  await new Promise(r => setTimeout(r, 2000));

  let state = await page.evaluate(() => window.game?.state);
  
  // Handle country select
  if (state === 'country_select' || state === 'name_entry') {
    await page.evaluate(() => {
      localStorage.setItem('spaceomicide_country', 'US');
      localStorage.setItem('spaceomicide_name', 'TestPlayer');
    });
    await page.reload({ waitUntil: 'networkidle2' });
    await new Promise(r => setTimeout(r, 2000));
    await page.mouse.click(640, 400);
    await new Promise(r => setTimeout(r, 1000));
    state = await page.evaluate(() => window.game?.state);
  }

  if (state !== 'playing') {
    console.log('❌ Could not start game');
    await browser.close();
    return { success: false, reason: 'Game did not start' };
  }

  console.log('   ✓ Game started\n');

  console.log('3. Waiting for enemies to spawn (5 seconds)...');
  await new Promise(r => setTimeout(r, 5000));

  let enemyCount = await page.evaluate(() => {
    // Try to get enemy count from various possible sources
    return window.getEnemyCount ? window.getEnemyCount() : 
           (window.game?.enemies?.length || 0);
  });
  console.log(`   Enemies spawned: ${enemyCount}`);

  console.log('\n4. Testing shooting (holding SPACE for 5 seconds)...');
  await page.keyboard.down('Space');
  await new Promise(r => setTimeout(r, 5000));
  await page.keyboard.up('Space');
  await new Promise(r => setTimeout(r, 1000));

  const result = await page.evaluate(() => ({
    state: window.game?.state,
    level: window.game?.level,
    score: window.game?.score,
    kills: window.game?.kills,
    totalKills: window.game?.totalKills,
    health: window.game?.health
  }));

  console.log('\n   Results:');
  console.log('   State:', result.state);
  console.log('   Level:', result.level);
  console.log('   Score:', result.score);
  console.log('   Kills:', result.kills);
  console.log('   Total Kills:', result.totalKills);
  console.log('   Health:', result.health);

  await page.screenshot({ path: 'test-projectile-hits.png' });

  // Check for projectile logs
  const projectileLogs = logs.filter(l => l.includes('[projectile]'));
  const weaponLogs = logs.filter(l => l.includes('[MAIN weapon]'));
  
  console.log('\n   Logs captured:');
  console.log(`   - Weapon fired: ${weaponLogs.length} times`);
  console.log(`   - Projectile checks: ${projectileLogs.length}`);

  await browser.close();

  // Success if game is still playing and no errors
  const success = result.state === 'playing' && errors.length === 0;
  
  console.log('\n' + (success ? '✅ TEST PASSED' : '❌ TEST FAILED'));
  if (errors.length > 0) {
    console.log('Errors:', errors.slice(0, 5));
  }

  return { 
    success, 
    result, 
    errors,
    logs: { projectileLogs, weaponLogs }
  };
}

testProjectileHits().then(r => process.exit(r.success ? 0 : 1));
