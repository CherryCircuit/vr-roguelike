/**
 * Test: Void Tendril (#171) — spatial-control enemy with blocking barriers
 *
 *   - Level config includes void_tendril at level 9+
 *   - Barrier grows over ~2s and becomes active
 *   - Player projectiles in the barrier's arc are consumed (barrier HP drops)
 *   - Projectiles outside the arc pass through
 *   - Barrier breaks after 3 hits; FIRE status burns it in 1 hit
 *   - After the barrier breaks, shots reach the anchor and kill it (2 HP)
 *   - No console errors
 */
const puppeteer = require('puppeteer');

const GAME_URL = 'http://localhost:8001/dev.html';

async function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function runTest() {
  console.log('🧪 Void Tendril Test (#171)\n');
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
    window.game.playerName = 'TendrilBot';
    window.game.state = 'playing';
    window.game.health = 6;
    window.game.level = 9;
    window.game.mainWeaponLocked = { left: true, right: true };
  });
  await page.evaluate(async () => {
    const d = await import('./desktop-controls.js');
    if (!d.isEnabled()) d.enable();
  });
  await sleep(500);
  console.log('  ✅ In PLAYING state');

  const results = {};

  // ── Phase 2: Level config + growth ──
  console.log('\n📍 Phase 2: Spawn + barrier growth...');
  results.growth = await page.evaluate(async () => {
    const THREE = await import('three');
    const enemies = await import('./enemies.js');
    const g = await import('./game.js');
    const cfg = g.getLevelConfig ? g.getLevelConfig() : null;
    const inConfig = cfg?.enemyTypes?.includes('void_tendril') || false;
    enemies.clearAllEnemies();
    const camera = window.__test?.getCamera?.();
    const t = enemies.spawnEnemy('void_tendril', camera.position.clone().add(new THREE.Vector3(0, 1.6, -14)), window.game._levelConfig || undefined);
    if (!t) return { ok: false, reason: 'spawn failed', inConfig };
    t.tendrilAngle = 0; // barrier centered on +X from the player
    t.tendrilRotateSpeed = 0; // freeze rotation for deterministic arc tests
    const start = performance.now();
    while (performance.now() - start < 6000) {
      if (t.tendrilBarrierActive) break;
      await new Promise(r => setTimeout(r, 100));
    }
    return {
      ok: t.tendrilBarrierActive && t.tendrilGrowth >= 1,
      inConfig, active: t.tendrilBarrierActive, growth: t.tendrilGrowth,
      hasMesh: !!t.tendrilBarrierMesh,
    };
  });
  console.log(`  Level 9 config includes void_tendril: ${results.growth.inConfig ? '✅' : '❌'}`);
  console.log(`  Barrier grows to full in ~2s: ${results.growth.ok && results.growth.hasMesh ? '✅' : '❌'} (${JSON.stringify(results.growth)})`);

  // ── Phase 3: Barrier consumes projectiles in its arc ──
  console.log('\n📍 Phase 3: Barrier blocks shots in its arc...');
  results.block = await page.evaluate(async () => {
    const THREE = await import('three');
    const enemies = await import('./enemies.js');
    const ps = await import('./projectile-system.js');
    // Fresh tendril: wave enemies wandered near the player during the growth
    // wait and can intercept the test shot before the barrier does
    enemies.clearAllEnemies();
    const t = enemies.spawnEnemy('void_tendril', new THREE.Vector3(0, 1.6, -14), window.game._levelConfig || undefined);
    if (!t) return { ok: false, reason: 'no tendril' };
    t.tendrilAngle = 0;
    t.tendrilRotateSpeed = 0;
    t.tendrilGrowth = 1;
    t.tendrilBarrierActive = true;
    const barrierHpBefore = t.tendrilBarrierHP;
    // Fire INTO the arc: from the player along +X (tendrilAngle 0, arc ±30°)
    const origin = new THREE.Vector3(0, 1.5, 0);
    const stats = {
      damage: 5, critChance: 0, critMultiplier: 2, fireWeakenMult: 1,
      effects: [], aoeRadius: 0, projectileCount: 1, spreadAngle: 0,
      homing: false, ricochetBounces: 0, piercing: false,
      vampiricInterval: 0, scatterSeek: false, forceExplosion: false,
      isRicochetHit: false, projectileSpeed: 12,
    };
    const shotId = `tendril-in-${Date.now()}`;
    ps.spawnProjectile(origin, new THREE.Vector3(1, 0, 0), 0, stats, shotId);
    await new Promise(r => setTimeout(r, 400)); // ~4.8m — inside the barrier arc (3-12m)
    // The pool may recycle consumed entries (stale userData), so the REAL
    // signal is the barrier HP dropping
    return { ok: t.tendrilBarrierHP < barrierHpBefore, hpBefore: barrierHpBefore, hpAfter: t.tendrilBarrierHP };
  });
  console.log(`  Shot in the arc is consumed + barrier HP drops: ${results.block.ok ? '✅' : '❌'} (${JSON.stringify(results.block)})`);

  // ── Phase 4: Shots outside the arc pass through ──
  console.log('\n📍 Phase 4: Shots outside the arc pass...');
  results.pass = await page.evaluate(async () => {
    const THREE = await import('three');
    const enemies = await import('./enemies.js');
    const ps = await import('./projectile-system.js');
    // Fresh tendril with FROZEN rotation + fixed arc so no other barrier
    // interferes and the arc can't rotate into the test shot
    enemies.clearAllEnemies();
    const t = enemies.spawnEnemy('void_tendril', new THREE.Vector3(0, 1.6, -14), window.game._levelConfig || undefined);
    t.tendrilAngle = 0;
    t.tendrilGrowth = 1;
    t.tendrilBarrierActive = true;
    t.tendrilRotateSpeed = 0;
    // Arc is ±30° around angle 0 (+X). Fire at +45° → outside the arc.
    const origin = new THREE.Vector3(0, 1.5, 0);
    const dir = new THREE.Vector3(Math.cos(Math.PI / 4), 0, Math.sin(Math.PI / 4)).normalize();
    const stats = {
      damage: 6, critChance: 0, critMultiplier: 2, fireWeakenMult: 1,
      effects: [], aoeRadius: 0, projectileCount: 1, spreadAngle: 0,
      homing: false, ricochetBounces: 0, piercing: false,
      vampiricInterval: 0, scatterSeek: false, forceExplosion: false,
      isRicochetHit: false, projectileSpeed: 12,
    };
    ps.spawnProjectile(origin, dir, 0, stats, `tendril-out-${Date.now()}`);
    await new Promise(r => setTimeout(r, 400));
    const stillAlive = ps.projectiles.some(p => p.userData?.stats?.damage === 6 && p.userData.spawnPos?.x === origin.x);
    return { ok: stillAlive, stillAlive };
  });
  console.log(`  Shot at +45° (outside arc) keeps flying: ${results.pass.ok ? '✅' : '❌'}`);

  // ── Phase 5: Barrier breaks after 3 hits; FIRE burns it in 1 ──
  console.log('\n📍 Phase 5: Barrier destruction...');
  results.break = await page.evaluate(async () => {
    const THREE = await import('three');
    const enemies = await import('./enemies.js');
    const ps = await import('./projectile-system.js');
    const shotStats = {
      damage: 5, critChance: 0, critMultiplier: 2, fireWeakenMult: 1, effects: [],
      aoeRadius: 0, projectileCount: 1, spreadAngle: 0, homing: false,
      ricochetBounces: 0, piercing: false, vampiricInterval: 0,
      scatterSeek: false, forceExplosion: false, isRicochetHit: false,
      projectileSpeed: 12,
    };
    // Normal barrier: 3 hits (fresh tendril, frozen arc)
    enemies.clearAllEnemies();
    const t = enemies.spawnEnemy('void_tendril', new THREE.Vector3(0, 1.6, -14), window.game._levelConfig || undefined);
    t.tendrilAngle = 0;
    t.tendrilGrowth = 1;
    t.tendrilBarrierActive = true;
    t.tendrilRotateSpeed = 0;
    for (let i = 0; i < 3; i++) {
      ps.spawnProjectile(new THREE.Vector3(0, 1.5, 0), new THREE.Vector3(1, 0, 0), 0, shotStats, `tendril-break-${Date.now()}-${i}`);
      await new Promise(r => setTimeout(r, 200));
    }
    // Each shot takes ~250ms to travel past the 3m inner radius, so the
    // third hit lands ~650ms after the first shot — wait for it
    await new Promise(r => setTimeout(r, 400));
    const normalBroken = !t.tendrilBarrierActive;

    // FIRE-status barrier: 1 hit destroys it (fresh tendril)
    enemies.clearAllEnemies();
    const t2 = enemies.spawnEnemy('void_tendril', new THREE.Vector3(0, 1.6, -14), window.game._levelConfig || undefined);
    t2.tendrilAngle = 0;
    t2.tendrilGrowth = 1;
    t2.tendrilBarrierActive = true;
    t2.tendrilRotateSpeed = 0;
    t2.statusEffects.fire.stacks = 1;
    ps.spawnProjectile(new THREE.Vector3(0, 1.5, 0), new THREE.Vector3(1, 0, 0), 0, shotStats, `tendril-fire-${Date.now()}`);
    await new Promise(r => setTimeout(r, 400)); // shot needs ~250ms to reach the barrier
    const fireBroken = !t2.tendrilBarrierActive;

    return { normalBroken, fireBroken };
  });
  console.log(`  Barrier breaks after 3 hits: ${results.break.normalBroken ? '✅' : '❌'}`);
  console.log(`  FIRE status burns the barrier in 1 hit: ${results.break.fireBroken ? '✅' : '❌'}`);

  // ── Phase 6: Anchor dies after the barrier is down ──
  console.log('\n📍 Phase 6: Anchor vulnerability...');
  results.anchor = await page.evaluate(async () => {
    const THREE = await import('three');
    const enemies = await import('./enemies.js');
    const ps = await import('./projectile-system.js');
    enemies.clearAllEnemies();
    const t = enemies.spawnEnemy('void_tendril', new THREE.Vector3(0, 1.6, -14), window.game._levelConfig || undefined);
    // Barrier already broken (as if shot down), anchor exposed with 2 HP
    t.tendrilBarrierActive = false;
    t.hp = 2;
    t.maxHp = 2;
    const list = enemies.getEnemies();
    const idx = list.indexOf(t);
    const stats = {
      damage: 2, critChance: 0, critMultiplier: 2, fireWeakenMult: 1,
      effects: [], aoeRadius: 0, projectileCount: 1, spreadAngle: 0,
      homing: false, ricochetBounces: 0, piercing: false,
      vampiricInterval: 0, scatterSeek: false, forceExplosion: false,
      isRicochetHit: false,
    };
    ps.handleHit(idx, t, stats, t.mesh.position.clone(), 0, false, false, {});
    const hpAfter1 = t.hp;
    ps.handleHit(idx, t, stats, t.mesh.position.clone(), 0, false, false, {});
    return { ok: hpAfter1 === 0, hpAfter1, gone: !enemies.getEnemies().includes(t) };
  });
  console.log(`  Exposed anchor dies in 2 hits: ${results.anchor.ok ? '✅' : '❌'} (${JSON.stringify(results.anchor)})`);

  // ── Results ──
  console.log('\n============================================================');
  console.log('📊 Results:');
  if (errors.length === 0) {
    console.log('  ✅ No console errors');
  } else {
    console.log(`  ❌ ${errors.length} console error(s):`);
    errors.slice(0, 5).forEach(e => console.log(`     - ${e.substring(0, 120)}`));
  }
  const passed = errors.length === 0 && results.growth.ok && results.growth.inConfig &&
    results.block.ok && results.pass.ok && results.break.normalBroken &&
    results.break.fireBroken && results.anchor.ok;
  console.log(passed ? '\n✅ ALL TESTS PASSED' : '\n❌ TEST FAILURES');
  await browser.close();
  process.exit(passed ? 0 : 1);
}

runTest().catch(err => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
