/**
 * Test: The Masquerade (#200) — hidden boss that body-swaps on kill
 *
 *   - Spawns disguised as a normal basic enemy (host, mask hidden)
 *   - Killing the host body-swaps: transfersUsed++, 25% boss HP cost,
 *     a new host takes over
 *   - After the transfer cap the boss reveals its mask
 *   - The mask alternates comedy (gold) / tragedy (purple) expressions
 *   - Phase 3 (<25% HP) fires cross-pattern volleys (4 bolts)
 *   - No console errors
 */
const puppeteer = require('puppeteer');

const GAME_URL = 'http://localhost:8001/dev.html';

async function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function runTest() {
  console.log('🧪 The Masquerade Test (#200)\n');
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
    window.game.playerName = 'MaskBot';
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

  // ── Phase 2: Disguise ──
  console.log('\n📍 Phase 2: The disguise...');
  results.disguise = await page.evaluate(async () => {
    const THREE = await import('three');
    const enemies = await import('./enemies.js');
    const g = await import('./game.js');
    const cfg = g.getLevelConfig ? g.getLevelConfig() : { hpMultiplier: 1, speedMultiplier: 1 };
    enemies.clearBoss();
    enemies.clearAllEnemies();
    const boss = enemies.spawnBoss('the_masquerade', cfg);
    if (!boss) return { ok: false, reason: 'spawn failed' };
    // Decoy enemies so body-swaps have hosts to jump into
    const camera = window.__test?.getCamera?.();
    for (let i = 0; i < 3; i++) {
      const pos = camera.position.clone().add(new THREE.Vector3((i - 1) * 3, 1.6, -14));
      const decoy = enemies.spawnEnemy('basic', pos, window.game._levelConfig || undefined);
      if (decoy) decoy._bossSummoned = false;
    }
    await new Promise(r => setTimeout(r, 400));
    const host = boss.hostEnemy;
    return {
      ok: boss.masqueradeActive && !!host && host._masqueradeHost && !boss.mesh.visible,
      hostType: host?.type,
      hostHp: host?.hp,
      transfers: boss.transfersUsed,
    };
  });
  console.log(`  Disguised as a basic enemy (mask hidden): ${results.disguise.ok ? '✅' : '❌'} (${JSON.stringify(results.disguise)})`);

  // ── Phase 3: Body-swap on kill ──
  console.log('\n📍 Phase 3: Body-swap...');
  results.swap = await page.evaluate(async () => {
    const THREE = await import('three');
    const enemies = await import('./enemies.js');
    const ps = await import('./projectile-system.js');
    const boss = enemies.getBoss();
    if (!boss) return { ok: false, reason: 'no boss' };
    const hpBefore = boss.hp;
    // Kill the host body via the real hit path
    const host = boss.hostEnemy;
    if (!host) return { ok: false, reason: 'no host' };
    const idx = enemies.getEnemies().indexOf(host);
    if (idx < 0) return { ok: false, reason: 'host not in list' };
    const stats = {
      damage: 999, critChance: 0, critMultiplier: 2, fireWeakenMult: 1,
      effects: [], aoeRadius: 0, projectileCount: 1, spreadAngle: 0,
      homing: false, ricochetBounces: 0, piercing: false,
      vampiricInterval: 0, scatterSeek: false, forceExplosion: false,
      isRicochetHit: false,
    };
    ps.handleHit(idx, host, stats, host.mesh.position.clone(), 0, false, false, {});
    await new Promise(r => setTimeout(r, 300));
    const cost = Math.round(boss.maxHp * 0.25);
    return {
      ok: boss.transfersUsed === 1 && boss.hp === hpBefore - cost &&
          boss.masqueradeActive && !!boss.hostEnemy,
      transfers: boss.transfersUsed,
      hpDrop: hpBefore - boss.hp,
      cost,
      stillDisguised: boss.masqueradeActive,
    };
  });
  console.log(`  Kill → body-swap (−25% HP, new host): ${results.swap.ok ? '✅' : '❌'} (${JSON.stringify(results.swap)})`);

  // ── Phase 4: Second swap → reveal ──
  console.log('\n📍 Phase 4: Reveal...');
  results.reveal = await page.evaluate(async () => {
    const THREE = await import('three');
    const enemies = await import('./enemies.js');
    const ps = await import('./projectile-system.js');
    const boss = enemies.getBoss();
    if (!boss) return { ok: false, reason: 'no boss' };
    // The revealed mask fires 8-12 dmg bolts — a 6-HP player dies between
    // restores (which would clear the boss mid-test). Give the test player
    // real survivability.
    window.game.maxHealth = 30;
    window.game.health = 30;
    const keepAlive = setInterval(() => { window.game.health = window.game.maxHealth; }, 300);
    // Keep killing hosts until the swap cap reveals the mask
    for (let round = 0; round < 4; round++) {
      const host = boss.hostEnemy;
      if (!host || !boss.masqueradeActive) break;
      const idx = enemies.getEnemies().indexOf(host);
      if (idx < 0) break;
      const stats = {
        damage: 999, critChance: 0, critMultiplier: 2, fireWeakenMult: 1,
        effects: [], aoeRadius: 0, projectileCount: 1, spreadAngle: 0,
        homing: false, ricochetBounces: 0, piercing: false,
        vampiricInterval: 0, scatterSeek: false, forceExplosion: false,
        isRicochetHit: false,
      };
      ps.handleHit(idx, host, stats, host.mesh.position.clone(), 0, false, false, {});
      await new Promise(r => setTimeout(r, 300));
    }
    const start = performance.now();
    while (performance.now() - start < 3000) {
      if (!boss.masqueradeActive && boss.maskVisible) break;
      await new Promise(r => setTimeout(r, 100));
    }
    clearInterval(keepAlive);
    // NOTE: do NOT reset health to 6 here — the revealed mask's next volley
    // would kill the player (clearing the boss) before phase 5 can run
    window.game.health = 30;
    return { ok: !boss.masqueradeActive && boss.maskVisible && boss.mesh.visible, transfers: boss.transfersUsed };
  });
  console.log(`  Mask reveals after the swap cap: ${results.reveal.ok ? '✅' : '❌'} (${JSON.stringify(results.reveal)})`);

  // ── Phase 5: Expression alternation + phase 3 cross fire ──
  console.log('\n📍 Phase 5: Expressions + cross fire...');
  results.phase = await page.evaluate(async () => {
    const enemies = await import('./enemies.js');
    const boss = enemies.getBoss();
    if (!boss) return { ok: false, reason: 'no boss' };
    window.game.maxHealth = 30;
    window.game.health = 30;
    // Proximity slow-mo (damage near enemies) scales dt down — the mask's
    // timers would creep. Force normal time scale continuously (the slow-mo
    // re-engages each frame from nearby enemies).
    window._timeScale = 1.0;
    window.game.timeScale = 1.0;
    window.game.slowmoActive = false;
    const keepAlive = setInterval(() => {
      window.game.health = window.game.maxHealth;
      window._timeScale = 1.0;
      window.game.timeScale = 1.0;
    }, 200);
    // Expression alternates (comedy gold ↔ tragedy purple)
    const start = performance.now();
    let sawTragedy = false;
    while (performance.now() - start < 7000) {
      if (boss.expression === 'tragedy') { sawTragedy = true; break; }
      await new Promise(r => setTimeout(r, 100));
    }
    // Phase 3: cross-pattern volley (4 bolts per volley)
    boss.hp = Math.floor(boss.maxHp * 0.2);
    boss.fireTimer = 0.1;
    const start2 = performance.now();
    let crossCount = 0;
    while (performance.now() - start2 < 2000) {
      crossCount = enemies.getBossProjectiles().length;
      if (crossCount >= 3) break;
      await new Promise(r => setTimeout(r, 100));
    }
    clearInterval(keepAlive);
    window.game.health = 30;
    return {
      ok: sawTragedy && crossCount >= 3, sawTragedy, crossCount,
      expr: boss.expression, exprTimer: boss.expressionTimer,
      sameBoss: enemies.getBoss() === boss, masked: boss.maskVisible,
    };
  });
  console.log(`  Comedy/tragedy alternation + cross fire: ${results.phase.ok ? '✅' : '❌'} (${JSON.stringify(results.phase)})`);

  // ── Results ──
  console.log('\n============================================================');
  console.log('📊 Results:');
  if (errors.length === 0) {
    console.log('  ✅ No console errors');
  } else {
    console.log(`  ❌ ${errors.length} console error(s):`);
    errors.slice(0, 5).forEach(e => console.log(`     - ${e.substring(0, 120)}`));
  }
  const passed = errors.length === 0 && results.disguise.ok && results.swap.ok &&
    results.reveal.ok && results.phase.ok;
  console.log(passed ? '\n✅ ALL TESTS PASSED' : '\n❌ TEST FAILURES');
  await browser.close();
  process.exit(passed ? 0 : 1);
}

runTest().catch(err => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
