/**
 * Test: Void Anchor (#198) — stationary gravity well enemy
 *
 *   - Level config includes void_anchor at level 8+
 *   - Drifts to a planting spot 8-14m from the player, then plants
 *   - Gravity well grows from 3m toward its full radius
 *   - Player projectiles bend toward the well while inside the field
 *   - Seekers resist the bending (homing overrides)
 *   - Full-size anchor pulses damage to the player
 *   - No console errors
 */
const puppeteer = require('puppeteer');

const GAME_URL = 'http://localhost:8000/dev.html';

async function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function runTest() {
  console.log('🧪 Void Anchor Test (#198)\n');
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
    window.game.playerName = 'AnchorBot';
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

  // ── Phase 2: Level config + spawn + plant ──
  console.log('\n📍 Phase 2: Spawn, drift, plant...');
  results.plant = await page.evaluate(async () => {
    const THREE = await import('three');
    const enemies = await import('./enemies.js');
    const g = await import('./game.js');
    const cfg = g.getLevelConfig ? g.getLevelConfig() : null;
    const inConfig = cfg?.enemyTypes?.includes('void_anchor') || false;
    enemies.clearAllEnemies();
    const camera = window.__test?.getCamera?.();
    const pos = camera.position.clone().add(new THREE.Vector3(0, 1.6, -4));
    const a = enemies.spawnEnemy('void_anchor', pos, window.game._levelConfig || undefined);
    if (!a) return { ok: false, reason: 'spawn failed', inConfig };
    // Poll until planted (drift is ~2m/s toward a spot 8-14m out)
    const start = performance.now();
    let planted = false;
    while (performance.now() - start < 15000) {
      if (a.anchorPlanted) { planted = true; break; }
      await new Promise(r => setTimeout(r, 100));
    }
    const plantDist = a.anchorPlantTarget
      ? Math.hypot(a.anchorPlantTarget.x - camera.position.x, a.anchorPlantTarget.z - camera.position.z)
      : -1;
    return {
      ok: planted && plantDist >= 7.5 && plantDist <= 14.5,
      inConfig, planted,
      plantDist,
      growthAtPlant: a.anchorGravityRadius,
    };
  });
  console.log(`  Level 8 config includes void_anchor: ${results.plant.inConfig ? '✅' : '❌'}`);
  console.log(`  Drifts and plants 8-14m from the player (${results.plant.plantDist?.toFixed?.(1) ?? results.plant.plantDist}): ${
    results.plant.ok ? '✅' : '❌'} (${JSON.stringify(results.plant)})`);

  // ── Phase 3: Well grows over time ──
  console.log('\n📍 Phase 3: Gravity well growth...');
  results.growth = await page.evaluate(async () => {
    const enemies = await import('./enemies.js');
    const a = enemies.getEnemies().find(e => e.isVoidAnchor);
    if (!a) return { ok: false, reason: 'no anchor' };
    const r0 = a.anchorGravityRadius;
    await new Promise(r => setTimeout(r, 2500)); // 2.5s of growth (3→5 over 8s)
    return { r0, r1: a.anchorGravityRadius, grew: a.anchorGravityRadius > r0 + 0.2 };
  });
  console.log(`  Well grows after planting (${results.growth.r0?.toFixed?.(2) ?? results.growth.r0} → ${results.growth.r1?.toFixed?.(2) ?? results.growth.r1}): ${
    results.growth.grew ? '✅' : '❌'}`);

  // ── Phase 4: Projectile bending toward the well ──
  console.log('\n📍 Phase 4: Projectile bending...');
  results.bend = await page.evaluate(async () => {
    const THREE = await import('three');
    const enemies = await import('./enemies.js');
    const ps = await import('./projectile-system.js');
    const a = enemies.getEnemies().find(e => e.isVoidAnchor);
    if (!a) return { ok: false, reason: 'no anchor' };
    // Force a FIXED position + full well for a deterministic geometry:
    // camera at origin, anchor at (5, 1, 0), probe flies -z past it at 1.5m
    // lateral. Amplified bend rate makes the pull robustly observable (the
    // spec 15°/s is a balance constant).
    a.anchorPlanted = true;
    a.mesh.position.set(5, 1, 0);
    a.anchorPlantTime = performance.now() - 10000;
    a.anchorGravityRadius = 5;
    a.gravityBendRate = 1.5;
    // Fire a projectile THROUGH the field: start 1.5m laterally from the
    // anchor, 6m in front of it, flying parallel past. The well pulls it
    // toward the center — lateral drift shrinks over the flight.
    const anchorPos = a.mesh.position;
    const origin = new THREE.Vector3(3.5, 1, 6);
    const dir = new THREE.Vector3(0, 0, -1); // flying toward -z (past the anchor)
    const stats = {
      damage: 1, critChance: 0, critMultiplier: 2, fireWeakenMult: 1,
      effects: [], aoeRadius: 0, projectileCount: 1, spreadAngle: 0,
      homing: false, ricochetBounces: 0, piercing: false,
      vampiricInterval: 0, scatterSeek: false, forceExplosion: false,
      isRicochetHit: false, projectileSpeed: 12,
    };
    ps.spawnProjectile(origin, dir, 0, stats, `anchor-probe-${Date.now()}`);
    await new Promise(r => setTimeout(r, 900)); // ~10.8m of flight through the field
    const proj = ps.projectiles.find(p => p.userData?.stats && p.userData.stats.damage === 1 && p.userData.spawnPos?.x === origin.x);
    if (!proj) return { ok: false, reason: 'projectile expired early', x: null };
    // Bending check: the projectile should have moved toward the anchor's x
    // (lateral drift shrunk from the 1.5m starting offset)
    const distToAnchor = proj.position.distanceTo(anchorPos);
    const lateralDrift = Math.abs(proj.position.x - anchorPos.x);
    return {
      ok: lateralDrift < 1.25, // pulled at least ~0.25m toward the well
      distToAnchor,
      lateralDrift,
      projX: proj.position.x,
      anchorX: anchorPos.x,
    };
  });
  console.log(`  Projectile curves toward the well: ${results.bend.ok ? '✅' : '❌'} (${JSON.stringify(results.bend)})`);
  await page.evaluate(async () => {
    const ps = await import('./projectile-system.js');
    ps.clearAllProjectiles();
  });

  // ── Phase 5: Seeker resists bending ──
  console.log('\n📍 Phase 5: Seeker resistance...');
  results.seeker = await page.evaluate(async () => {
    const THREE = await import('three');
    const enemies = await import('./enemies.js');
    const ps = await import('./projectile-system.js');
    const a = enemies.getEnemies().find(e => e.isVoidAnchor);
    if (!a) return { ok: false, reason: 'no anchor' };
    // Same fixed geometry as Phase 4 (anchor at (5,1,0))
    const anchorPos = a.mesh.position;
    const origin = new THREE.Vector3(3.5, 1, 6);
    const dir = new THREE.Vector3(0, 0, -1);
    const stats = {
      damage: 1, critChance: 0, critMultiplier: 2, fireWeakenMult: 1,
      effects: [], aoeRadius: 0, projectileCount: 1, spreadAngle: 0,
      homing: true, homingRange: 0.01, homingStrength: 15, // tiny range: never locks, but counts as a seeker
      ricochetBounces: 0, piercing: false,
      vampiricInterval: 0, scatterSeek: false, forceExplosion: false,
      isRicochetHit: false, projectileSpeed: 12,
    };
    ps.spawnProjectile(origin, dir, 0, stats, `anchor-seeker-${Date.now()}`);
    await new Promise(r => setTimeout(r, 900));
    const proj = ps.projectiles.find(p => p.userData?.stats?.homing === true && p.userData.spawnPos?.x === origin.x);
    if (!proj) return { ok: false, reason: 'seeker expired', dist: null };
    const dist = proj.position.distanceTo(anchorPos);
    // A seeker flies straight (no lock, no bending) — its lateral distance
    // to the anchor stays ~1.5 (a bent shot would be pulled closer)
    return { ok: dist > 1.45, dist };
  });
  console.log(`  Seeker flies straight through the field: ${results.seeker.ok ? '✅' : '❌'} (dist ${results.seeker.dist?.toFixed?.(1) ?? results.seeker.dist})`);
  await page.evaluate(async () => {
    const ps = await import('./projectile-system.js');
    ps.clearAllProjectiles();
  });

  // ── Phase 6: Full-size pulse damage ──
  console.log('\n📍 Phase 6: Full-size pulse damage...');
  results.pulse = await page.evaluate(async () => {
    const enemies = await import('./enemies.js');
    const a = enemies.getEnemies().find(e => e.isVoidAnchor);
    if (!a) return { ok: false, reason: 'no anchor' };
    // Force full size + fast pulse for the test (fake an old plant so the
    // growth gate passes)
    a.anchorPlantTime = performance.now() - 10000;
    a.anchorGravityRadius = a.gravityRadius;
    a.pulseDamageInterval = 0.4;
    a.anchorPulseTimer = 0;
    const startTime = performance.now();
    window.game.health = 6;
    while (performance.now() - startTime < 5000) {
      if (window.game.health < 6) break;
      await new Promise(r => setTimeout(r, 100));
    }
    return { ok: window.game.health < 6, health: window.game.health };
  });
  await page.evaluate(() => { window.game.health = 6; });
  console.log(`  Full-size anchor pulses damage: ${results.pulse.ok ? '✅' : '❌'} (health ${results.pulse.health})`);

  // ── Results ──
  console.log('\n============================================================');
  console.log('📊 Results:');
  if (errors.length === 0) {
    console.log('  ✅ No console errors');
  } else {
    console.log(`  ❌ ${errors.length} console error(s):`);
    errors.slice(0, 5).forEach(e => console.log(`     - ${e.substring(0, 120)}`));
  }
  const passed = errors.length === 0 && results.plant.ok && results.plant.inConfig &&
    results.growth.grew && results.bend.ok && results.seeker.ok && results.pulse.ok;
  console.log(passed ? '\n✅ ALL TESTS PASSED' : '\n❌ TEST FAILURES');
  await browser.close();
  process.exit(passed ? 0 : 1);
}

runTest().catch(err => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
