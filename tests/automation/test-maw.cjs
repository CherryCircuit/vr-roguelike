/**
 * Test: The Maw (#168) — tier-1 boss that devours the arena
 *
 *   - Spawns with a 5-ring floor of tiles + chomp cycle
 *   - Chomp wind-up exposes the core (visible + hittable)
 *   - Core hits deal 3x while exposed; weak-point hits are immune otherwise
 *   - Phase 2 at 66% HP shrinks the arena target (14) and speeds crumble
 *   - Crumble waves remove the outer rings of tiles
 *   - Phase 3 at 33% HP shrinks further (8)
 *   - No console errors
 */
const puppeteer = require('puppeteer');

const GAME_URL = 'http://localhost:8001/dev.html';

async function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function runTest() {
  console.log('🧪 The Maw Test (#168)\n');
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

  // ── Phase 1: Load + PLAYING (level 5) ──
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
    window.game.playerName = 'MawBot';
    window.game.state = 'playing';
    window.game.health = 6;
    window.game.level = 5;
    window.game.mainWeaponLocked = { left: true, right: true };
  });
  await page.evaluate(async () => {
    const d = await import('./desktop-controls.js');
    if (!d.isEnabled()) d.enable();
  });
  await sleep(500);
  console.log('  ✅ In PLAYING state');

  const results = {};

  // Keep the test run alive (minions + chomp projectiles damage the player)
  const keepAlive = () => page.evaluate(() => {
    window.game.health = Math.min(window.game.maxHealth, window.game.health + 1);
  });

  // ── Phase 2: Spawn + arena floor + chomp cycle ──
  console.log('\n📍 Phase 2: Spawn, floor, chomp...');
  results.spawn = await page.evaluate(async () => {
    const enemies = await import('./enemies.js');
    const g = await import('./game.js');
    const cfg = g.getLevelConfig ? g.getLevelConfig() : { hpMultiplier: 1, speedMultiplier: 1 };
    enemies.clearBoss();
    enemies.clearAllEnemies();
    const boss = enemies.spawnBoss('the_maw', cfg);
    if (!boss) return { ok: false, reason: 'spawn failed' };
    return { ok: boss.floorTiles.length === 80, tiles: boss.floorTiles.length, phase: boss.phase };
  });
  console.log(`  Spawns with the 5-ring arena floor (80 tiles): ${results.spawn.ok ? '✅' : '❌'} (${JSON.stringify(results.spawn)})`);

  // ── Phase 3: Chomp wind-up exposes the core ──
  console.log('\n📍 Phase 3: Chomp core exposure...');
  results.chomp = await page.evaluate(async () => {
    const enemies = await import('./enemies.js');
    const boss = enemies.getBoss();
    if (!boss) return { ok: false, reason: 'no boss' };
    const keepAlive = setInterval(() => { window.game.health = 6; }, 400);
    const start = performance.now();
    while (performance.now() - start < 9000) {
      if (boss.coreExposed && boss.coreMesh.visible) break;
      await new Promise(r => setTimeout(r, 100));
    }
    clearInterval(keepAlive);
    window.game.health = 6;
    return { ok: boss.coreExposed && boss.coreMesh.visible, phase: boss.chompPhase };
  });
  console.log(`  Chomp wind-up exposes the core: ${results.chomp.ok ? '✅' : '❌'} (${JSON.stringify(results.chomp)})`);

  // ── Phase 4: Core 3x damage while exposed; immune otherwise ──
  console.log('\n📍 Phase 4: Core damage window...');
  results.core = await page.evaluate(async () => {
    const enemies = await import('./enemies.js');
    const boss = enemies.getBoss();
    if (!boss) return { ok: false, reason: 'no boss' };
    // Wait for the NEXT expose window to be safe (the previous one may have
    // just closed)
    const start = performance.now();
    while (performance.now() - start < 12000) {
      if (boss.coreExposed) break;
      await new Promise(r => setTimeout(r, 100));
    }
    const exposed = boss.coreExposed;
    // 3x while exposed
    const hpBefore = boss.hp;
    const result = enemies.hitBoss(100, { isWeakPoint: true });
    const threeX = result.immune ? false : hpBefore - boss.hp >= 280;
    // Wait for the core to close, then weak-point hits are immune
    const start2 = performance.now();
    while (performance.now() - start2 < 8000) {
      if (!boss.coreExposed) break;
      await new Promise(r => setTimeout(r, 100));
    }
    const hpBefore2 = boss.hp;
    const result2 = enemies.hitBoss(100, { isWeakPoint: true });
    const immuneWhenClosed = result2.immune === true && boss.hp === hpBefore2;
    return { ok: exposed && threeX && immuneWhenClosed, exposed, threeX, immuneWhenClosed };
  });
  await page.evaluate(() => { window.game.health = 6; });
  console.log(`  Core hits deal 3x; immune when closed: ${results.core.ok ? '✅' : '❌'} (${JSON.stringify(results.core)})`);

  // ── Phase 5: Crumble waves remove tiles ──
  console.log('\n📍 Phase 5: Crumble waves...');
  results.crumble = await page.evaluate(async () => {
    const enemies = await import('./enemies.js');
    const boss = enemies.getBoss();
    if (!boss) return { ok: false, reason: 'no boss' };
    const aliveBefore = boss.floorTiles.filter(t => t.alive).length;
    boss._triggerCrumbleWave();
    await new Promise(r => setTimeout(r, 2400)); // crack 1.5s + fall 0.5s
    const aliveAfter = boss.floorTiles.filter(t => t.alive).length;
    return { ok: aliveAfter < aliveBefore, aliveBefore, aliveAfter };
  });
  console.log(`  Crumble removes the outer rings: ${results.crumble.ok ? '✅' : '❌'} (${results.crumble.aliveBefore} → ${results.crumble.aliveAfter})`);

  // ── Phase 6: Phase thresholds ──
  console.log('\n📍 Phase 6: Phase thresholds...');
  results.phases = await page.evaluate(async () => {
    const enemies = await import('./enemies.js');
    const boss = enemies.getBoss();
    if (!boss) return { ok: false, reason: 'no boss' };
    boss.hp = Math.floor(boss.maxHp * 0.6);
    const start = performance.now();
    while (performance.now() - start < 3000) {
      if (boss.phase === 2) break;
      await new Promise(r => setTimeout(r, 100));
    }
    const phase2ok = boss.phase === 2 && boss.targetArenaRadius === 14;
    boss.hp = Math.floor(boss.maxHp * 0.3);
    const start2 = performance.now();
    while (performance.now() - start2 < 3000) {
      if (boss.phase === 3) break;
      await new Promise(r => setTimeout(r, 100));
    }
    return { ok: phase2ok && boss.phase === 3 && boss.targetArenaRadius === 8, phase: boss.phase, radius: boss.targetArenaRadius };
  });
  await page.evaluate(() => { window.game.health = 6; });
  console.log(`  Phases shrink the arena (66% → 14, 33% → 8): ${results.phases.ok ? '✅' : '❌'} (${JSON.stringify(results.phases)})`);

  // ── Results ──
  console.log('\n============================================================');
  console.log('📊 Results:');
  if (errors.length === 0) {
    console.log('  ✅ No console errors');
  } else {
    console.log(`  ❌ ${errors.length} console error(s):`);
    errors.slice(0, 5).forEach(e => console.log(`     - ${e.substring(0, 120)}`));
  }
  const passed = errors.length === 0 && results.spawn.ok && results.chomp.ok &&
    results.core.ok && results.crumble.ok && results.phases.ok;
  console.log(passed ? '\n✅ ALL TESTS PASSED' : '\n❌ TEST FAILURES');
  await browser.close();
  process.exit(passed ? 0 : 1);
}

runTest().catch(err => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
