const puppeteer = require('puppeteer');

async function testGame() {
  console.log('🧪 Comprehensive Browser Test\n');
  
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
  const warnings = [];
  
  page.on('console', msg => {
    const text = msg.text();
    const type = msg.type();
    
    // Filter out known benign errors patterns
    const isBenign = text.includes('404') || 
                     text.includes('GroupMarker') ||
                     text.includes('favicon.ico');
    
    if (type === 'error' && !isBenign) {
      errors.push(text);
      console.log('   ❌ Console error:', text);
    } else if (type === 'warning') {
      warnings.push(text);
    }
  });

  // Test 1: Fresh load without localStorage
  console.log('1. Testing fresh load (clearing localStorage)...');
  await page.goto('http://localhost:8000', { waitUntil: 'networkidle2', timeout: 15000 });
  
  // Clear any existing data
  await page.evaluate(() => {
    localStorage.removeItem('spaceomicide_country');
    localStorage.removeItem('spaceomicide_name');
  });
  
  // Reload to apply cleared storage
  await page.reload({ waitUntil: 'networkidle2' });
  await new Promise(r => setTimeout(r, 1000));
  
  let state = await page.evaluate(() => window.game?.state);
  console.log('   Initial state:', state);
  
  // Click twice to pass title screen (like original test)
  console.log('   Clicking to start game...');
  await page.mouse.click(640, 400);
  await new Promise(r => setTimeout(r, 500));
  await page.mouse.click(640, 400);
  await new Promise(r => setTimeout(r, 2000));
  
  state = await page.evaluate(() => window.game?.state);
  console.log('   State after clicks:', state);
  
  // Test 2: Handle country_select screen
  if (state === 'country_select') {
    console.log('   Country select screen detected, handling...');
    await new Promise(r => setTimeout(r, 500));
    
    // Click on US option (typically near top center)
    await page.mouse.click(640, 300);
    await new Promise(r => setTimeout(r, 500));
    
    state = await page.evaluate(() => window.game?.state);
    console.log('   State after country click:', state);
  }
  
  // Test 3: Handle name_entry screen
  if (state === 'name_entry') {
    console.log('   Name entry screen detected, handling...');
    
    // Set name via localStorage
    await page.evaluate(() => {
      localStorage.setItem('spaceomicide_name', 'TestPlayer');
    });
    
    // Click continue/submit button
    await page.mouse.click(640, 400);
    await new Promise(r => setTimeout(r, 500));
    
    state = await page.evaluate(() => window.game?.state);
    console.log('   State after name entry:', state);
  }
  
  // Test 4: Handle ready_screen
  if (state === 'ready_screen') {
    console.log('   Ready screen detected, clicking to start...');
    await page.mouse.click(640, 400);
    await new Promise(r => setTimeout(r, 1000));
    state = await page.evaluate(() => window.game?.state);
    console.log('   State after ready click:', state);
  }
  
  // Test 5: Verify game reached playing state
  if (state !== 'playing') {
    console.log('   Trying space key to start...');
    await page.keyboard.press('Space');
    await new Promise(r => setTimeout(r, 1000));
    state = await page.evaluate(() => window.game?.state);
    console.log('   State after space:', state);
  }

  if (state !== 'playing') {
    console.log('\n❌ FAILED: Could not reach playing state');
    await page.screenshot({ path: 'test-comprehensive-failed.png' });
    await browser.close();
    return { success: false, state, errors, warnings };
  }

  console.log('   ✓ Game reached playing state\n');

  // Test 6: Verify no blocking runtime errors
  console.log('2. Checking for runtime errors...');
  await new Promise(r => setTimeout(r, 1000));
  
  // Test 7: Test gameplay mechanics
  console.log('3. Testing gameplay (shooting for 3 seconds)...');
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

  await page.screenshot({ path: 'test-comprehensive-result.png' });
  await browser.close();

  const success = result.state === 'playing' && errors.length === 0;
  
  console.log('\n' + (success ? '✅ TEST PASSED' : '❌ TEST FAILED'));
  if (errors.length > 0) {
    console.log('   Errors found:', errors.length);
    errors.forEach((e, i) => console.log(`   ${i+1}. ${e}`));
  }
  if (warnings.length > 0) {
    console.log('   Warnings:', warnings.length);
  }

  return { success, result, errors, warnings };
}

testGame().then(r => process.exit(r.success ? 0 : 1));
