/**
 * Test: Mirror Gauntlet (#197) — boss that copies your loadout
 *
 *   - Spawns with the chrome sphere + fire cycle
 *   - Fires mirror projectiles at 70% of the player's weapon damage
 *   - Buckshot loadout → pellet spread (multiple projectiles)
 *   - Phase 2 at 66% HP reveals the inner figure + fires BOTH hands
 *   - Phase 3 at 33% HP fires faster + spawns afterimages
 *   - No console errors
 */
const puppeteer = require('puppeteer');

const GAME_URL = 'http://localhost:8001/dev.html';

async function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function runTest() {
  console.log('🧪 Mirror Gauntlet Test (#197)\n');
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

  // ── Phase 1: Load + PLAYING (level 10) ──
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
    window.game.playerName = 'MirrorBot';
    window.game.state = 'playing';
    window.game.health = 6;
    window.game.level = 10;
    window.game.mainWeaponLocked = { left: true, right: true };
    // Blaster with scope upgrades: 15 + 2×10 = 35 → mirror fires 24 (70%)
    window.game.mainWeapon = { left: 'standard_blaster', right: 'standard_blaster' };
    window.game.upgrades = { left: { scope: 2 }, right: {} };
  });
  await page.evaluate(async () => {
    const d = await import('./desktop-controls.js');
    if (!d.isEnabled()) d.enable();
  });
  await sleep(500);
  console.log('  ✅ In PLAYING state');

  const results = {};

  // ── Phase 2: Spawn + mirror projectile damage ──
  console.log('\n📍 Phase 2: Spawn + mirror shots...');
  results.spawn = await page.evaluate(async () => {
    const enemies = await import('./enemies.js');
    const g = await import('./game.js');
    const cfg = g.getLevelConfig ? g.getLevelConfig() : { hpMultiplier: 1, speedMultiplier: 1 };
    enemies.clearBoss();
    enemies.clearAllEnemies();
    const boss = enemies.spawnBoss('mirror_gauntlet', cfg);
    if (!boss) return { ok: false, reason: 'spawn failed' };
    // Wait for a mirror volley (first fire at ~1.2s)
    const keepAlive = setInterval(() => { window.game.health = 6; }, 400);
    const start = performance.now();
    let projDamage = null;
    while (performance.now() - start < 6000) {
      const projs = enemies.getBossProjectiles();
      if (projs.length > 0) {
        projDamage = projs[0].userData?.damage ?? projs[0].damage ?? null;
        break;
      }
      await new Promise(r => setTimeout(r, 100));
    }
    clearInterval(keepAlive);
    window.game.health = 6;
    // Blaster mirror: 35 × 0.7 = 24.5 → 25
    return { ok: projDamage === 25, projDamage, bossPhase: boss.phase };
  });
  console.log(`  Mirror fires your weapon at 70% damage (35 → 25): ${
    results.spawn.ok ? '✅' : '❌'} (${JSON.stringify(results.spawn)})`);

  // ── Phase 3: Buckshot loadout → pellet spread ──
  console.log('\n📍 Phase 3: Buckshot mirror spread...');
  results.buckshot = await page.evaluate(async () => {
    const enemies = await import('./enemies.js');
    window.game.mainWeapon = { left: 'buckshot', right: 'buckshot' };
    window.game.upgrades = { left: {}, right: {} };
    // Buckshot base damage 15 × 0.7 = 10.5 → 11 per pellet (× 0.7 again = 8)
    const boss = enemies.getBoss();
    if (!boss) return { ok: false, reason: 'no boss' };
    boss.mirrorFireTimer = 0.1;
    const start = performance.now();
    let pelletCount = 0;
    while (performance.now() - start < 4000) {
      const projs = enemies.getBossProjectiles();
      const count = projs.filter(p => (p.userData?.damage ?? p.damage) <= 11).length;
      if (count >= 3) { pelletCount = count; break; }
      await new Promise(r => setTimeout(r, 100));
    }
    window.game.mainWeapon = { left: 'standard_blaster', right: 'standard_blaster' };
    window.game.upgrades = { left: { scope: 2 }, right: {} };
    return { ok: pelletCount >= 3, pelletCount };
  });
  console.log(`  Buckshot mirror sprays pellets: ${results.buckshot.ok ? '✅' : '❌'} (${results.buckshot.pelletCount} pellets)`);

  // ── Phase 4: Phase 2 — both hands + inner figure ──
  console.log('\n📍 Phase 4: Phase 2...');
  results.phase2 = await page.evaluate(async () => {
    const enemies = await import('./enemies.js');
    const boss = enemies.getBoss();
    if (!boss) return { ok: false, reason: 'no boss' };
    const keepAlive = setInterval(() => { window.game.health = 6; }, 300);
    boss.hp = Math.floor(boss.maxHp * 0.6);
    const start = performance.now();
    while (performance.now() - start < 3000) {
      if (boss.phase === 2) break;
      await new Promise(r => setTimeout(r, 100));
    }
    clearInterval(keepAlive);
    window.game.health = 6;
    return { ok: boss.phase === 2 && boss.innerFigure.visible, phase: boss.phase, innerVisible: boss.innerFigure.visible };
  });
  await page.evaluate(() => { window.game.health = 6; });
  console.log(`  Phase 2 reveals the inner figure: ${results.phase2.ok ? '✅' : '❌'} (${JSON.stringify(results.phase2)})`);

  // ── Phase 5: Phase 3 — faster fire + afterimages ──
  console.log('\n📍 Phase 5: Phase 3...');
  results.phase3 = await page.evaluate(async () => {
    const enemies = await import('./enemies.js');
    const g = await import('./game.js');
    // Fresh boss — the phase-2 fight may have ended the run (clearing the
    // old reference); a fresh spawn keeps the phase math deterministic
    const cfg = g.getLevelConfig ? g.getLevelConfig() : { hpMultiplier: 1, speedMultiplier: 1 };
    enemies.clearBoss();
    enemies.clearAllEnemies();
    const boss = enemies.spawnBoss('mirror_gauntlet', cfg);
    if (!boss) return { ok: false, reason: 'spawn failed' };
    const keepAlive = setInterval(() => { window.game.health = 6; }, 300);
    boss.hp = Math.floor(boss.maxHp * 0.3);
    const start = performance.now();
    while (performance.now() - start < 3000) {
      if (boss.phase === 3) break;
      await new Promise(r => setTimeout(r, 100));
    }
    boss.afterimageTimer = 0.1;
    const start2 = performance.now();
    let afterimages = 0;
    while (performance.now() - start2 < 3000) {
      afterimages = boss.afterimages.length;
      if (afterimages >= 2) break;
      await new Promise(r => setTimeout(r, 100));
    }
    clearInterval(keepAlive);
    window.game.health = 6;
    return { ok: boss.phase === 3 && afterimages >= 2 && boss.mirrorFireInterval < 1.2,
             phase: boss.phase, afterimages, interval: boss.mirrorFireInterval };
  });
  await page.evaluate(() => { window.game.health = 6; });
  console.log(`  Phase 3 overclocks (faster + afterimages): ${results.phase3.ok ? '✅' : '❌'} (${JSON.stringify(results.phase3)})`);

  // ── Results ──
  console.log('\n============================================================');
  console.log('📊 Results:');
  if (errors.length === 0) {
    console.log('  ✅ No console errors');
  } else {
    console.log(`  ❌ ${errors.length} console error(s):`);
    errors.slice(0, 5).forEach(e => console.log(`     - ${e.substring(0, 120)}`));
  }
  const passed = errors.length === 0 && results.spawn.ok && results.buckshot.ok &&
    results.phase2.ok && results.phase3.ok;
  console.log(passed ? '\n✅ ALL TESTS PASSED' : '\n❌ TEST FAILURES');
  await browser.close();
  process.exit(passed ? 0 : 1);
}

runTest().catch(err => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
