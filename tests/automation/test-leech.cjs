/**
 * Test: Parasitic Leech (#167) — latch + drain + burst enemy
 *
 *   - Level config includes leech at level 8+
 *   - Rushes the player, latches within 2m, orbits at 1.5m
 *   - Drains whole HP to the player (fractional accumulation)
 *   - Swells as it steals HP
 *   - Bursts into 3-4 smaller minions after 3 HP stolen
 *   - Minions drain too but never burst again
 *   - No console errors
 */
const puppeteer = require('puppeteer');

const GAME_URL = 'http://localhost:8001/dev.html';

async function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function runTest() {
  console.log('🧪 Parasitic Leech Test (#167)\n');
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
    const loc = msg.location && msg.location();
    const isApi404 = loc && loc.url && loc.url.includes('death-stats');
    const isBenign = isApi404 || text.includes('favicon') || text.includes('GroupMarker') ||
                     text.includes('AudioContext') || text.includes('Pointer lock') ||
                     text.includes('Autoplay') || text.includes('r2.dev') || text.includes('ERR_FAILED');
    if (type === 'error' && !isBenign) {
      errors.push(text);
      console.log(`  ❌ Console error: ${text.substring(0, 150)}`);
    }
  });
  page.on('pageerror', err => {
    errors.push(`PageError: ${err.message}`);
    console.log(`  💥 Page error: ${err.message.substring(0, 150)}`);
  });

  // ── Phase 1: Load + PLAYING ──
  console.log('\n📍 Phase 1: Load game...');
  await page.goto(GAME_URL, { waitUntil: 'networkidle2', timeout: 15000 });
  await sleep(3000);
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
    window.game.playerName = 'LeechBot';
    window.game.state = 'playing';
    window.game.health = 6;
    window.game.level = 8;
    window.game.mainWeaponLocked = { left: true, right: true };
  });
  await page.evaluate(async () => {
    const d = await import('./desktop-controls.js');
    if (!d.isEnabled()) d.enable();
  });
  await sleep(500);
  console.log('  ✅ In PLAYING state');

  const results = {};

  // ── Phase 2: Config + rush + latch ──
  console.log('\n📍 Phase 2: Rush and latch...');
  results.latch = await page.evaluate(async () => {
    const THREE = await import('three');
    const enemies = await import('./enemies.js');
    const g = await import('./game.js');
    const cfg = g.getLevelConfig ? g.getLevelConfig() : null;
    const inConfig = cfg?.enemyTypes?.includes('leech') || false;
    enemies.clearAllEnemies();
    const camera = window.__test?.getCamera?.();
    // Spawn 1m from the player → latches immediately on the first update
    const l = enemies.spawnEnemy('leech', camera.position.clone().add(new THREE.Vector3(1, 0.5, 0)), window.game._levelConfig || undefined);
    if (!l) return { ok: false, reason: 'spawn failed', inConfig };
    await new Promise(r => setTimeout(r, 400));
    // 2D distance (the leech orbits at y=0.5 — vertical offset would skew it)
    const dx = l.mesh.position.x - camera.position.x;
    const dz = l.mesh.position.z - camera.position.z;
    const distToPlayer = Math.hypot(dx, dz);
    return {
      ok: l.isLatched && distToPlayer < 1.8, // orbiting at 1.5m radius
      inConfig, latched: l.isLatched, distToPlayer,
    };
  });
  console.log(`  Level 8 config includes leech: ${results.latch.inConfig ? '✅' : '❌'}`);
  console.log(`  Latches and orbits near the player: ${results.latch.ok ? '✅' : '❌'} (${JSON.stringify(results.latch)})`);

  // ── Phase 3: Drain + swell ──
  console.log('\n📍 Phase 3: Drain and swell...');
  results.drain = await page.evaluate(async () => {
    const enemies = await import('./enemies.js');
    const l = enemies.getEnemies().find(e => e.isLeech);
    if (!l) return { ok: false, reason: 'no leech' };
    // Speed up the drain for the test: 3 ticks of 0.5 = 1.5 stolen → 1 whole
    // HP drained + visible swell
    l.drainInterval = 0.2;
    window.game.health = 6;
    await new Promise(r => setTimeout(r, 1000)); // ~5 ticks
    return {
      health: window.game.health,
      stolen: l.stolenHp,
      scale: l.drainVisualScale,
      ok: window.game.health < 6 && l.stolenHp > 0 && l.drainVisualScale > 1,
    };
  });
  console.log(`  Drains player HP + swells: ${results.drain.ok ? '✅' : '❌'} (health ${results.drain.health}, stolen ${results.drain.stolen?.toFixed?.(1) ?? results.drain.stolen}, scale ${results.drain.scale?.toFixed?.(2) ?? results.drain.scale})`);

  // ── Phase 4: Burst into minions ──
  console.log('\n📍 Phase 4: Burst into minions...');
  results.burst = await page.evaluate(async () => {
    const enemies = await import('./enemies.js');
    const l = enemies.getEnemies().find(e => e.isLeech);
    if (!l) return { ok: false, reason: 'no leech' };
    // Force the burst threshold quickly
    l.stolenHp = l.burstThreshold;
    l.drainInterval = 0.1;
    await new Promise(r => setTimeout(r, 500));
    const minions = enemies.getEnemies().filter(e => e.type === 'leech_minion');
    const parentGone = !enemies.getEnemies().some(e => e.isLeech && e.type === 'leech');
    return {
      ok: minions.length >= 3 && parentGone,
      minions: minions.length,
      minionCanBurst: minions.every(m => !m.canBurst),
    };
  });
  console.log(`  Bursts into 3-4 minions (parent gone, no recursion): ${
    results.burst.ok && results.burst.minionCanBurst ? '✅' : '❌'} (${results.burst.minions} minions)`);

  // ── Phase 5: Minions drain too ──
  console.log('\n📍 Phase 5: Minion drain...');
  results.minionDrain = await page.evaluate(async () => {
    const enemies = await import('./enemies.js');
    const minions = enemies.getEnemies().filter(e => e.type === 'leech_minion');
    if (minions.length === 0) return { ok: false, reason: 'no minions' };
    minions[0].drainInterval = 0.2;
    minions[0].isLatched = true; // force latch so the drain tick runs
    const start = performance.now();
    window.game.health = 6;
    await new Promise(r => setTimeout(r, 1200));
    return { ok: window.game.health < 6, health: window.game.health };
  });
  await page.evaluate(() => { window.game.health = 6; });
  console.log(`  Minions drain HP too: ${results.minionDrain.ok ? '✅' : '❌'} (health ${results.minionDrain.health})`);

  // ── Results ──
  console.log('\n============================================================');
  console.log('📊 Results:');
  if (errors.length === 0) {
    console.log('  ✅ No console errors');
  } else {
    console.log(`  ❌ ${errors.length} console error(s):`);
    errors.slice(0, 5).forEach(e => console.log(`     - ${e.substring(0, 120)}`));
  }
  const passed = errors.length === 0 && results.latch.ok && results.latch.inConfig &&
    results.drain.ok && results.burst.ok && results.burst.minionCanBurst && results.minionDrain.ok;
  console.log(passed ? '\n✅ ALL TESTS PASSED' : '\n❌ TEST FAILURES');
  await browser.close();
  process.exit(passed ? 0 : 1);
}

runTest().catch(err => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
