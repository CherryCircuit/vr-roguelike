/**
 * Test: Tank weak-point hit path (regression for the production crash
 * "_uiRaycaster is not defined @ projectile-system.js" reported when
 * shooting tanks on stage 4).
 *
 * Tanks unlock at level 4 and use the precise-hit raycast path in
 * updateProjectiles (enemyNeedsPreciseProjectileHit → _uiRaycaster),
 * which broke after the Issue #196 Phase 2 extraction. This test spawns
 * a real tank and fires the standard blaster at it, asserting the weak
 * point path runs without console errors and the tank takes damage.
 */
const puppeteer = require('puppeteer');

const GAME_URL = 'http://localhost:8001/dev.html';

async function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function runTest() {
  console.log('🧪 Tank Weak-Point Hit Test (regression: _uiRaycaster crash)\n');
  console.log('='.repeat(60));

  const errors = [];

  const browser = await puppeteer.launch({
    headless: 'new',
    args: [
      '--no-sandbox', '--disable-setuid-sandbox', '--use-angle=swiftshader',
      '--enable-webgl', '--ignore-gpu-blocklist', '--disable-gpu-sandbox',
    ]
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 800 });

  page.on('console', msg => {
    const text = msg.text();
    const type = msg.type();
    const isBenign = text.includes('favicon') || text.includes('GroupMarker') ||
                     text.includes('AudioContext') || text.includes('Pointer lock') ||
                     text.includes('Autoplay');
    if (type === 'error' && !isBenign) {
      errors.push(text);
      console.log(`  ❌ Console error: ${text.substring(0, 150)}`);
    }
  });
  page.on('pageerror', err => {
    errors.push(`PageError: ${err.message}`);
    console.log(`  💥 Page error: ${err.message.substring(0, 150)}`);
  });

  console.log('\n📍 Phase 1: Load game...');
  await page.goto(GAME_URL, { waitUntil: 'networkidle2', timeout: 15000 });
  await sleep(3000);
  console.log('  ✅ Loaded');

  // ── Phase 2: PLAYING (level 4 so tank weak points are active) ──
  console.log('\n📍 Phase 2: Start game at level 4...');
  const PLAYING = await page.evaluate(() => window.State?.PLAYING || 'playing');
  for (let i = 0; i < 15; i++) {
    const st = await page.evaluate(() => window.game?.state);
    if (st === PLAYING) break;
    await page.mouse.click(640, 400);
    await sleep(400);
    await page.keyboard.press('Space');
    await sleep(200);
  }
  await page.evaluate(() => {
    window.game.country = 'CA';
    window.game.playerName = 'TestBot';
    window.game.state = 'playing';
    window.game.health = 6;
    window.game.level = 4; // tanks + weak points available
  });
  await sleep(500);
  await page.evaluate(async () => {
    const d = await import('./desktop-controls.js');
    if (!d.isEnabled()) d.enable();
    window.__enemies = await import('./enemies.js');
  });
  await page.evaluate(() => {
    window.game.mainWeapon = { left: 'standard_blaster', right: 'standard_blaster' };
  });
  await page.evaluate(() => window.__test?.activateNuke?.());

  // ── Phase 3: Spawn a tank directly in front of the camera ──
  console.log('\n📍 Phase 3: Spawn tank...');
  const tankSpawned = await page.evaluate(() => {
    const enemies = window.__enemies;
    const cfg = { hpMultiplier: 1, speedMultiplier: 1 };
    const pos = { x: 0, y: 1.6, z: -5 };
    enemies.spawnEnemy('tank', pos, cfg);
    const list = window.__test.getEnemies();
    const tank = list.find(e => e.type === 'tank');
    if (tank) {
      tank.hp = 2000;
      window.__tank = tank;
      return true;
    }
    return false;
  });
  console.log(`  Tank spawned: ${tankSpawned}`);
  if (!tankSpawned) {
    console.log('  ❌ Could not spawn tank');
    await browser.close();
    process.exit(1);
  }
  await sleep(500);

  // ── Phase 4: Fire at the tank ──
  console.log('\n📍 Phase 4: Fire at tank (exercises weak-point raycast)...');
  const hpBefore = await page.evaluate(() => window.__tank?.hp);
  await page.keyboard.down('Space');
  await sleep(1200); // several shots; each hit runs the precise-hit raycast path
  await page.keyboard.up('Space');
  await sleep(300);
  const hpAfter = await page.evaluate(() => window.__tank?.hp);
  console.log(`  Tank HP: ${hpBefore} → ${hpAfter}`);

  // ── Phase 5: Second burst after a beat (enemies move, raycast re-runs) ──
  console.log('\n📍 Phase 5: Second burst...');
  await page.keyboard.down('Space');
  await sleep(1200);
  await page.keyboard.up('Space');
  await sleep(300);
  const hpFinal = await page.evaluate(() => window.__tank?.hp);
  console.log(`  Tank HP after second burst: ${hpFinal}`);

  // ── Results ──
  console.log('\n============================================================');
  console.log('📊 Results:');
  if (errors.length === 0) {
    console.log('  ✅ No console errors');
  } else {
    console.log(`  ❌ ${errors.length} console error(s):`);
    errors.slice(0, 5).forEach(e => console.log(`     - ${e.substring(0, 120)}`));
  }
  const tookDamage = hpAfter < hpBefore && hpFinal < hpAfter;
  console.log(`  Tank took damage: ${tookDamage ? '✅' : '❌'}`);
  const passed = errors.length === 0 && tookDamage;
  console.log(passed ? '\n✅ ALL TESTS PASSED' : '\n❌ TEST FAILURES');
  await browser.close();
  process.exit(passed ? 0 : 1);
}

runTest().catch(err => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
