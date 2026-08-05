/**
 * Test: Bombardier Beetle (#199) — floor-turret enemy
 *
 *   - Spawns far, flies in, plants at the biome floor within landing range
 *   - Wind-up preview cone appears before each spray
 *   - Flame cone damages the player while they stand in it
 *   - Dies in a 2m flame burst that damages nearby enemies
 *   - Detection in level configs (level 7+)
 *   - No console errors
 */
const puppeteer = require('puppeteer');

const GAME_URL = 'http://localhost:8000/dev.html';

async function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function runTest() {
  console.log('🧪 Bombardier Beetle Test (#199)\n');
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
    window.game.playerName = 'BeetleBot';
    window.game.state = 'playing';
    window.game.health = 6;
    window.game.level = 7;
    window.game.mainWeaponLocked = { left: true, right: true };
  });
  await page.evaluate(async () => {
    const d = await import('./desktop-controls.js');
    if (!d.isEnabled()) d.enable();
  });
  await sleep(500);
  console.log('  ✅ In PLAYING state');

  const results = {};

  // ── Phase 2: Level config includes bombardier at 7+ ──
  console.log('\n📍 Phase 2: Level config detection...');
  results.levelConfig = await page.evaluate(async () => {
    const g = await import('./game.js');
    const lvl7 = g.getLevelConfig ? g.getLevelConfig() : null;
    // getLevelConfig reads game.level — we set 7 above
    return { types: lvl7?.enemyTypes || [], level: window.game.level };
  });
  results.bombardierInConfig = results.levelConfig.types.includes('bombardier');
  console.log(`  Bombardier in level 7 enemyTypes: ${results.bombardierInConfig ? '✅' : '❌'} [${results.levelConfig.types.join(',')}]`);

  // ── Phase 3: Fly → plant at floor ──
  console.log('\n📍 Phase 3: Planting...');
  results.plant = await page.evaluate(async () => {
    const THREE = await import('three');
    const enemies = await import('./enemies.js');
    enemies.clearAllEnemies();
    const camera = window.__test?.getCamera?.();
    const dir = new THREE.Vector3();
    camera.getWorldDirection(dir);
    // Spawn at 4m (inside landing range 6-8m) → plants on the first update
    const pos = camera.position.clone().addScaledVector(dir, 4);
    pos.y = 1.6;
    const b = enemies.spawnEnemy('bombardier', pos, window.game._levelConfig || undefined);
    if (!b) return { ok: false, reason: 'spawn failed' };
    await new Promise(r => setTimeout(r, 300));
    return {
      ok: b.bombardierPlanted === true,
      planted: b.bombardierPlanted,
      y: b.mesh.position.y,
      hasConeMeshes: !!(b.bombardierConePreview && b.bombardierConeFlame),
    };
  });
  console.log(`  Plants on the floor (y ${results.plant.y?.toFixed?.(2) ?? results.plant.y}): ${
    results.plant.ok && results.plant.hasConeMeshes ? '✅' : '❌'} (${JSON.stringify(results.plant)})`);

  // ── Phase 4: Wind-up preview → flame cone → player damage ──
  console.log('\n📍 Phase 4: Spray cycle...');
  await page.evaluate(() => { window.game.health = 6; });
  results.spray = await page.evaluate(async () => {
    const enemies = await import('./enemies.js');
    const list = enemies.getEnemies();
    const b = list.find(e => e.isBombardier);
    if (!b) return { ok: false, reason: 'no bombardier' };

    const seen = { preview: false, flame: false, damage: false };
    // Poll for the wind-up preview (0.6s window), then the flame, then damage
    const start = performance.now();
    while (performance.now() - start < 8000) {
      if (b.bombardierConePreview?.visible) seen.preview = true;
      if (b.bombardierConeFlame?.visible) seen.flame = true;
      if (window.game.health < 6) seen.damage = true;
      if (seen.flame && seen.damage && seen.preview) break;
      await new Promise(r => setTimeout(r, 100));
    }
    return {
      preview: seen.preview,
      flame: seen.flame,
      damage: seen.damage,
      health: window.game.health,
      sprayAngle: b.bombardierSprayAngle,
    };
  });
  await page.evaluate(() => { window.game.health = 6; });
  console.log(`  Wind-up preview cone shown: ${results.spray.preview ? '✅' : '❌'}`);
  console.log(`  Flame cone shown: ${results.spray.flame ? '✅' : '❌'}`);
  console.log(`  Player damaged while in the cone: ${results.spray.damage ? '✅' : '❌'} (health ${results.spray.health})`);

  // ── Phase 5: Death explosion damages nearby enemies ──
  console.log('\n📍 Phase 5: Death flame burst...');
  results.death = await page.evaluate(async () => {
    const THREE = await import('three');
    const enemies = await import('./enemies.js');
    const ps = await import('./projectile-system.js');
    enemies.clearAllEnemies();
    const camera = window.__test?.getCamera?.();
    const dir = new THREE.Vector3();
    camera.getWorldDirection(dir);
    const base = camera.position.clone().addScaledVector(dir, 6);
    base.y = 1.6;
    const b = enemies.spawnEnemy('bombardier', base.clone(), window.game._levelConfig || undefined);
    const victim = enemies.spawnEnemy('basic', base.clone().add(new THREE.Vector3(1.5, 0, 0)), window.game._levelConfig || undefined);
    if (!b || !victim) return { ok: false, reason: 'spawn failed' };
    const victimHpBefore = victim.hp;
    const list = enemies.getEnemies();
    const bIdx = list.indexOf(b);
    const stats = {
      damage: 999, critChance: 0, critMultiplier: 2, fireWeakenMult: 1,
      effects: [], aoeRadius: 0, projectileCount: 1, spreadAngle: 0,
      homing: false, ricochetBounces: 0, piercing: false,
      vampiricInterval: 0, scatterSeek: false, forceExplosion: false,
      isRicochetHit: false,
    };
    ps.handleHit(bIdx, b, stats, b.mesh.position.clone(), 0, false, false, {});
    return {
      victimHpBefore,
      victimHpAfter: victim.hp,
      dropped: victimHpBefore - victim.hp,
    };
  });
  console.log(`  Death burst hits the nearby enemy for ~20: ${
    results.death.dropped >= 15 && results.death.dropped <= 25 ? '✅' : '❌'} (dropped ${results.death.dropped})`);

  // ── Phase 6: Far spawn flies toward the player before planting ──
  console.log('\n📍 Phase 6: Fly-in approach...');
  results.fly = await page.evaluate(async () => {
    const THREE = await import('three');
    const enemies = await import('./enemies.js');
    enemies.clearAllEnemies();
    const camera = window.__test?.getCamera?.();
    const dir = new THREE.Vector3();
    camera.getWorldDirection(dir);
    const pos = camera.position.clone().addScaledVector(dir, 18); // far outside landing range
    pos.y = 1.6;
    const b = enemies.spawnEnemy('bombardier', pos, window.game._levelConfig || undefined);
    const startDist = b.mesh.position.distanceTo(camera.position);
    await new Promise(r => setTimeout(r, 1200)); // flies ~2.4m at speed 2
    const nowDist = b.mesh.position.distanceTo(camera.position);
    return { ok: b.bombardierPlanted === false && nowDist < startDist - 1.5, startDist, nowDist };
  });
  console.log(`  Flies toward the player before planting: ${results.fly.ok ? '✅' : '❌'} (${results.fly.startDist?.toFixed?.(1) ?? results.fly.startDist} → ${results.fly.nowDist?.toFixed?.(1) ?? results.fly.nowDist})`);

  // ── Results ──
  console.log('\n============================================================');
  console.log('📊 Results:');
  if (errors.length === 0) {
    console.log('  ✅ No console errors');
  } else {
    console.log(`  ❌ ${errors.length} console error(s):`);
    errors.slice(0, 5).forEach(e => console.log(`     - ${e.substring(0, 120)}`));
  }
  const passed = errors.length === 0 && results.bombardierInConfig &&
    results.plant.ok && results.plant.hasConeMeshes &&
    results.spray.preview && results.spray.flame && results.spray.damage &&
    results.death.dropped >= 15 && results.death.dropped <= 25 && results.fly.ok;
  console.log(passed ? '\n✅ ALL TESTS PASSED' : '\n❌ TEST FAILURES');
  await browser.close();
  process.exit(passed ? 0 : 1);
}

runTest().catch(err => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
