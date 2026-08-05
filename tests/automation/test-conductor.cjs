/**
 * Test: Conductor Ascendant (#170) — tier-3 boss that conducts formations
 *
 *   - Spawns and starts a movement (held formation enemies, real types)
 *   - Shield reduces damage by 80% while active
 *   - Killing enough formation enemies disrupts → shield drops, full damage
 *   - After disruption the next movement begins
 *   - Phase 2 below 50% HP: shield tightens to 90%
 *   - No console errors
 */
const puppeteer = require('puppeteer');

const GAME_URL = 'http://localhost:8001/dev.html';

async function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function runTest() {
  console.log('🧪 Conductor Ascendant Test (#170)\n');
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

  // ── Phase 1: Load + PLAYING (level 15) ──
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
    window.game.playerName = 'MaestroBot';
    window.game.state = 'playing';
    window.game.health = 6;
    window.game.level = 15;
    window.game.mainWeaponLocked = { left: true, right: true };
  });
  await page.evaluate(async () => {
    const d = await import('./desktop-controls.js');
    if (!d.isEnabled()) d.enable();
  });
  await sleep(500);
  console.log('  ✅ In PLAYING state');

  const results = {};

  // ── Phase 2: Spawn + first movement ──
  console.log('\n📍 Phase 2: Spawn + movement start...');
  results.spawn = await page.evaluate(async () => {
    const enemies = await import('./enemies.js');
    const g = await import('./game.js');
    const cfg = g.getLevelConfig ? g.getLevelConfig() : { hpMultiplier: 1, speedMultiplier: 1 };
    enemies.clearBoss();
    enemies.clearAllEnemies();
    const boss = enemies.spawnBoss('conductor_ascendant', cfg);
    if (!boss) return { ok: false, reason: 'spawn failed' };
    await new Promise(r => setTimeout(r, 600));
    const held = enemies.getEnemies().filter(e => e._conductorHeld && e.hp > 0);
    const types = [...new Set(held.map(e => e.type))];
    return {
      ok: held.length >= 8 && ['spiral', 'wave', 'grid', 'pincer'].includes(boss.currentMovementType),
      heldCount: held.length,
      types,
      movement: boss.currentMovementType,
      shield: boss._shieldActive,
    };
  });
  console.log(`  Movement started with held formation (${results.spawn.heldCount} enemies, ${results.spawn.types?.join('/')}): ${
    results.spawn.ok ? '✅' : '❌'} (${JSON.stringify(results.spawn)})`);

  // ── Phase 3: Shield damage reduction ──
  console.log('\n📍 Phase 3: Shield reduction...');
  results.shield = await page.evaluate(async () => {
    const enemies = await import('./enemies.js');
    const boss = enemies.getBoss();
    if (!boss) return { ok: false, reason: 'no boss' };
    const hpBefore = boss.hp;
    enemies.hitBoss(100, {});
    return { ok: hpBefore - boss.hp <= 25, dropped: hpBefore - boss.hp };
  });
  console.log(`  Shield absorbs 80% (100 → ~20): ${results.shield.ok ? '✅' : '❌'} (dropped ${results.shield.dropped})`);

  // ── Phase 4: Disruption → shield drops → full damage ──
  console.log('\n📍 Phase 4: Disruption...');
  results.disrupt = await page.evaluate(async () => {
    const THREE = await import('three');
    const enemies = await import('./enemies.js');
    const ps = await import('./projectile-system.js');
    const boss = enemies.getBoss();
    if (!boss) return { ok: false, reason: 'no boss' };
    // Kill the movement's threshold (4+ for spiral, 3+ for grid, etc.) —
    // kill a flat 6 held enemies to cover every movement type
    const held = enemies.getEnemies().filter(e => e._conductorHeld && e.hp > 0);
    if (held.length < 6) return { ok: false, reason: 'not enough held enemies', n: held.length };
    const stats = {
      damage: 999, critChance: 0, critMultiplier: 2, fireWeakenMult: 1,
      effects: [], aoeRadius: 0, projectileCount: 1, spreadAngle: 0,
      homing: false, ricochetBounces: 0, piercing: false,
      vampiricInterval: 0, scatterSeek: false, forceExplosion: false,
      isRicochetHit: false,
    };
    for (let i = 0; i < 6; i++) {
      const e = held[i];
      const idx = enemies.getEnemies().indexOf(e);
      if (idx >= 0 && e.hp > 0) {
        ps.handleHit(idx, e, stats, e.mesh.position.clone(), 0, false, false, {});
      }
    }
    // Poll for the disruption window
    const start = performance.now();
    while (performance.now() - start < 4000) {
      if (boss._disruptionTimer > 0) break;
      await new Promise(r => setTimeout(r, 100));
    }
    const disrupted = boss._disruptionTimer > 0 && !boss._shieldActive;
    // Full damage during the window
    const hpBefore = boss.hp;
    enemies.hitBoss(100, {});
    const fullDamage = hpBefore - boss.hp >= 95;
    return { ok: disrupted && fullDamage, disrupted, fullDamage, dropped: hpBefore - boss.hp };
  });
  await page.evaluate(() => { window.game.health = 6; });
  console.log(`  Disruption drops the shield + full damage: ${results.disrupt.ok ? '✅' : '❌'} (${JSON.stringify(results.disrupt)})`);

  // ── Phase 5: Next movement after disruption ──
  console.log('\n📍 Phase 5: Next movement...');
  results.nextMovement = await page.evaluate(async () => {
    const enemies = await import('./enemies.js');
    const boss = enemies.getBoss();
    if (!boss) return { ok: false, reason: 'no boss' };
    const idxBefore = boss.movementIndex;
    // Released formation enemies swarm the player — keep health topped up
    // (buffed max so a 24-swarm release can't end the run mid-test)
    window.game.maxHealth = 30;
    window.game.health = 30;
    const keepAlive = setInterval(() => {
      window.game.health = window.game.maxHealth;
      window._timeScale = 1.0;
      window.game.timeScale = 1.0;
    }, 250);
    // Wait for the 3s disruption window to expire + next movement to start
    const start = performance.now();
    while (performance.now() - start < 6000) {
      if (boss._disruptionTimer === 0 && boss.movementIndex > idxBefore &&
          enemies.getEnemies().filter(e => e._conductorHeld && e.hp > 0).length >= 8) {
        break;
      }
      await new Promise(r => setTimeout(r, 100));
    }
    clearInterval(keepAlive);
    window.game.health = 6;
    const held = enemies.getEnemies().filter(e => e._conductorHeld && e.hp > 0).length;
    return { ok: boss.movementIndex > idxBefore && held >= 8, movement: boss.currentMovementType, held };
  });
  console.log(`  Next movement starts after disruption: ${results.nextMovement.ok ? '✅' : '❌'} (${JSON.stringify(results.nextMovement)})`);

  // ── Phase 6: Phase 2 below 50% HP ──
  console.log('\n📍 Phase 6: Phase 2...');
  results.phase2 = await page.evaluate(async () => {
    const enemies = await import('./enemies.js');
    const boss = enemies.getBoss();
    if (!boss) return { ok: false, reason: 'no boss' };
    boss.hp = Math.floor(boss.maxHp * 0.4);
    window.game.maxHealth = 30;
    window.game.health = 30;
    const keepAlive = setInterval(() => {
      window.game.health = window.game.maxHealth;
      window._timeScale = 1.0;
      window.game.timeScale = 1.0;
    }, 250);
    const start = performance.now();
    while (performance.now() - start < 4000) {
      if (boss._phase2) break;
      await new Promise(r => setTimeout(r, 100));
    }
    clearInterval(keepAlive);
    window.game.health = 6;
    return { ok: boss._phase2 && boss._shieldReduction === 0.9, phase2: boss._phase2, reduction: boss._shieldReduction };
  });
  console.log(`  Phase 2 at 50% HP (90% shield): ${results.phase2.ok ? '✅' : '❌'} (${JSON.stringify(results.phase2)})`);

  // ── Results ──
  console.log('\n============================================================');
  console.log('📊 Results:');
  if (errors.length === 0) {
    console.log('  ✅ No console errors');
  } else {
    console.log(`  ❌ ${errors.length} console error(s):`);
    errors.slice(0, 5).forEach(e => console.log(`     - ${e.substring(0, 120)}`));
  }
  const passed = errors.length === 0 && results.spawn.ok && results.shield.ok &&
    results.disrupt.ok && results.nextMovement.ok && results.phase2.ok;
  console.log(passed ? '\n✅ ALL TESTS PASSED' : '\n❌ TEST FAILURES');
  await browser.close();
  process.exit(passed ? 0 : 1);
}

runTest().catch(err => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
