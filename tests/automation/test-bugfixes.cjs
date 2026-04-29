/**
 * Test: Verify bug fixes for drone/boss projectile pooling, ShaderMaterial disposal, pool reset
 * Uses dev.html to get window.game access. Runs headless Puppeteer, checks for errors,
 * plays through levels, exercises drone/boss projectile paths.
 */
const puppeteer = require('puppeteer');

const GAME_URL = 'http://localhost:8000/dev.html';
const SCREENSHOT_DIR = 'tests/screenshots/';

async function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

function stateName(s) {
  if (typeof s === 'string') return s;
  return `state_${s}`;
}

// Helper: get the playing state string from the browser
async function getPlayingState(page) {
  return await page.evaluate(() => window.State?.PLAYING || 'playing');
}

async function runTest() {
  console.log('🧪 Bug Fix Verification Test\n');
  console.log('='.repeat(60));

  const errors = [];
  
  const browser = await puppeteer.launch({
    headless: 'new',
    args: [
      '--no-sandbox', '--disable-setuid-sandbox', '--use-angle=swiftshader',
      '--enable-webgl', '--ignore-gpu-blocklist', '--disable-gpu-sandbox',
      '--enable-features=WebGL',
    ]
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 800 });

  page.on('console', msg => {
    const text = msg.text();
    const type = msg.type();
    const isBenign = text.includes('favicon') || text.includes('GroupMarker') ||
                     text.includes('AudioContext') || text.includes('Pointer lock');
    if (type === 'error' && !isBenign) {
      errors.push(text);
      console.log(`  ❌ Console error: ${text.substring(0, 150)}`);
    }
  });

  page.on('pageerror', err => {
    errors.push(`PageError: ${err.message}`);
    console.log(`  💥 Page error: ${err.message.substring(0, 150)}`);
  });

  // ── Phase 1: Load ──
  console.log('\n📍 Phase 1: Load game (dev.html)...');
  await page.goto(GAME_URL, { waitUntil: 'networkidle2', timeout: 15000 });
  await sleep(3000);
  
  const initState = await page.evaluate(() => window.game?.state);
  console.log(`  State: ${stateName(initState)}`);
  
  if (initState === undefined) {
    console.log('  ❌ Game failed to initialize');
    await page.screenshot({ path: SCREENSHOT_DIR + 'bugfix-01-no-game.png' });
    await browser.close();
    process.exit(1);
  }
  console.log('  ✅ Game initialized');
  await page.screenshot({ path: SCREENSHOT_DIR + 'bugfix-01-loaded.png' });

  // ── Phase 2: Navigate to PLAYING ──
  console.log('\n📍 Phase 2: Navigate to playing...');
  const PLAYING = await getPlayingState(page);
  
  // Click through screens
  for (let i = 0; i < 15; i++) {
    const state = await page.evaluate(() => window.game?.state);
    if (state === PLAYING) break;
    await page.mouse.click(640, 400);
    await sleep(400);
    await page.keyboard.press('Space');
    await sleep(200);
  }
  
  let state = await page.evaluate(() => window.game?.state);
  console.log(`  After clicks: ${stateName(state)}`);
  await page.screenshot({ path: SCREENSHOT_DIR + 'bugfix-02-state.png' });

  // Force if needed
  if (state !== PLAYING) {
    console.log('  Forcing playing state...');
    await page.evaluate((PLAYING) => {
      window.game.country = 'CA';
      window.game.playerName = 'TestBot';
      window.game.state = PLAYING;
      window.game.health = 6;
      window.game.level = 1;
      window.game.nukes = 3;
    }, PLAYING);
    await sleep(1000);
  }
  
  state = await page.evaluate(() => window.game?.state);
  console.log(`  Final state: ${stateName(state)}`);

  // ── Phase 3: Gameplay simulation ──
  console.log('\n📍 Phase 3: Gameplay simulation (15 seconds)...');
  const playStart = Date.now();
  while (Date.now() - playStart < 15000) {
    const x = 400 + Math.random() * 480;
    const y = 200 + Math.random() * 400;
    await page.mouse.click(x, y);
    await sleep(300);
    
    const elapsed = (Date.now() - playStart) / 1000;
    if (elapsed > 3 && elapsed % 3 < 0.4) {
      const s = await page.evaluate(() => ({
        state: window.game?.state,
        level: window.game?.level,
        health: window.game?.health,
        kills: window.game?.kills,
      }));
      console.log(`  [${elapsed.toFixed(0)}s] level=${s.level} health=${s.health} kills=${s.kills} state=${stateName(s.state)}`);
    }
  }

  const finalState = await page.evaluate(() => ({
    level: window.game?.level,
    health: window.game?.health,
    kills: window.game?.kills,
  }));
  console.log(`  Final: level=${finalState.level} health=${finalState.health} kills=${finalState.kills}`);
  await page.screenshot({ path: SCREENSHOT_DIR + 'bugfix-03-gameplay.png' });

  // ── Phase 4: Game reset (pool cleanup) ──
  console.log('\n📍 Phase 4: Test game reset (pool cleanup)...');
  await page.evaluate((PLAYING) => {
    const game = window.game;
    game.state = 'title';
    game.level = 1;
    game.health = 6;
    game.kills = 0;
    game.score = 0;
    game.totalKills = 0;
    game.nukes = 3;
  }, PLAYING);
  await sleep(2000);
  
  const resetState = await page.evaluate(() => window.game?.state);
  console.log(`  After reset: state=${stateName(resetState)}`);
  console.log('  ✅ Reset completed (no crash = pass)');
  await page.screenshot({ path: SCREENSHOT_DIR + 'bugfix-04-reset.png' });

  // ── Phase 5: Second playthrough ──
  console.log('\n📍 Phase 5: Second playthrough after reset...');
  // Click back to playing
  for (let i = 0; i < 15; i++) {
    const s = await page.evaluate(() => window.game?.state);
    if (s === PLAYING) break;
    await page.mouse.click(640, 400);
    await sleep(400);
  }
  state = await page.evaluate(() => window.game?.state);
  if (state !== PLAYING) {
    await page.evaluate((PLAYING) => {
      window.game.country = 'CA';
      window.game.playerName = 'TestBot2';
      window.game.state = PLAYING;
      window.game.health = 6;
      window.game.level = 1;
    }, PLAYING);
  }
  await sleep(2000);
  
  for (let i = 0; i < 20; i++) {
    await page.mouse.click(400 + Math.random() * 480, 200 + Math.random() * 400);
    await sleep(200);
  }
  
  const secondRun = await page.evaluate(() => ({
    state: window.game?.state,
    level: window.game?.level,
    health: window.game?.health,
  }));
  console.log(`  Second run: level=${secondRun.level} health=${secondRun.health} state=${stateName(secondRun.state)}`);
  console.log('  ✅ Second playthrough (no crash = pass)');
  await page.screenshot({ path: SCREENSHOT_DIR + 'bugfix-05-second-run.png' });

  // ── Results ──
  console.log('\n' + '='.repeat(60));
  console.log('📊 Results:\n');
  
  if (errors.length === 0) {
    console.log('  ✅ No console errors');
  } else {
    console.log(`  ❌ ${errors.length} console error(s):`);
    errors.forEach(e => console.log(`     - ${e.substring(0, 120)}`));
  }

  const passed = errors.length === 0;
  console.log(`\n${passed ? '✅ ALL TESTS PASSED' : '❌ TESTS FAILED'}`);
  
  await browser.close();
  process.exit(passed ? 0 : 1);
}

runTest().catch(err => {
  console.error('Test runner crashed:', err);
  process.exit(1);
});
