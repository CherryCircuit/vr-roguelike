/**
 * Test: Deferred Combos (#211/#218) — kill-chain + weapon-specific combos + HUD glow
 *
 *   - Synergy detection: soul_chain, pinball_wizard, momentum_chain,
 *     tesla_tower, final_solution, swarm_leader
 *   - Soul Chain: ricochet kills count toward the vampiric heal threshold
 *   - Pinball Wizard: ricochet bounces skip already-hit enemies
 *   - Momentum: kills add +5% damage per stack (2s window, cap 5x) with decay
 *   - Tesla Tower: lightning hits 2 more enemies AND secondary chains
 *   - Final Solution: full-charge kill spawns a black hole
 *   - Swarm Leader: lost seekers become orbiting drones (spawn + expire)
 *   - Combo glow: accuracy bar flashes on triggerComboGlow
 *   - No console errors
 */
const puppeteer = require('puppeteer');

const GAME_URL = 'http://localhost:8001/dev.html';

async function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function runTest() {
  console.log('🧪 Deferred Combos Test (#211/#218)\n');
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
    window.game.playerName = 'ComboBot';
    window.game.state = 'playing';
    window.game.health = 6;
    window.game.level = 1;
    window.game.mainWeaponLocked = { left: true, right: true };
  });
  await page.evaluate(async () => {
    const d = await import('./desktop-controls.js');
    if (!d.isEnabled()) d.enable();
  });
  await sleep(500);
  console.log('  ✅ In PLAYING state');

  const results = {};

  // Helpers executed in the page
  const setSynergies = (left, right) => page.evaluate(async (l, r) => {
    const w = await import('./weapons.js');
    window.game.upgrades = { left: l, right: r };
    window.game.synergies = {
      left: w.detectSynergies(l),
      right: w.detectSynergies(r),
    };
  }, left, right);

  const clearEnemies = () => page.evaluate(async () => {
    const enemies = await import('./enemies.js');
    enemies.clearAllEnemies();
  });

  const aimUp = () => page.evaluate(async () => {
    const THREE = await import('three');
    const camera = window.__test?.getCamera?.();
    if (!camera) return false;
    const dir = new THREE.Vector3(0, 1, 0);
    camera.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, -1), dir);
    camera.rotation.setFromQuaternion(camera.quaternion);
    return true;
  });

  const makeHitStats = (overrides = {}) => ({
    damage: 999, critChance: 0, critMultiplier: 2, fireWeakenMult: 1,
    effects: [], aoeRadius: 0, projectileCount: 1, spreadAngle: 0,
    homing: false, ricochetBounces: 0, piercing: false,
    vampiricInterval: 0, scatterSeek: false, forceExplosion: false,
    isRicochetHit: false,
    ...overrides,
  });

  // ── Phase 2: Synergy detection (pure) ──
  console.log('\n📍 Phase 2: Synergy detection...');
  results.detect = await page.evaluate(async () => {
    const w = await import('./weapons.js');
    const has = (upgrades, id) => w.detectSynergies(upgrades).some(s => s.id === id);
    return {
      soulChain: has({ vampiric: 1, ricochet: 1 }, 'soul_chain'),
      pinball: has({ ricochet: 1, piercing: 1 }, 'pinball_wizard'),
      pinballOvercharge: has({ ricochet: 1, overcharge: 1 }, 'pinball_wizard'),
      momentum: has({ overcharge: 1 }, 'momentum_chain'),
      teslaTower: has({ tesla_coil: 1, shock: 1 }, 'tesla_tower'),
      finalSolution: has({ quick_charge: 1, death_ray: 1 }, 'final_solution'),
      swarmLeader: has({ gimme_more: 1 }, 'swarm_leader'),
      noFalsePositive: !has({ vampiric: 1 }, 'soul_chain'),
    };
  });
  console.log(`  Soul Chain / Pinball Wizard / Momentum: ${
    results.detect.soulChain && results.detect.pinball && results.detect.pinballOvercharge && results.detect.momentum ? '✅' : '❌'}`);
  console.log(`  Tesla Tower / Final Solution / Swarm Leader: ${
    results.detect.teslaTower && results.detect.finalSolution && results.detect.swarmLeader ? '✅' : '❌'}`);
  console.log(`  No false positives (vampiric alone ≠ soul chain): ${results.detect.noFalsePositive ? '✅' : '❌'}`);

  // ── Phase 3: Soul Chain — ricochet kills count toward heals ──
  console.log('\n📍 Phase 3: Soul Chain heal counting...');
  results.soulChain = await page.evaluate(async () => {
    const THREE = await import('three');
    const enemies = await import('./enemies.js');
    const ps = await import('./projectile-system.js');
    const w = await import('./weapons.js');
    window.game.health = 5;
    window.game.ricochetKillCount = 0;
    window.game.totalKills = 0;
    window.game.upgrades = { left: { vampiric: 1, ricochet: 1 }, right: {} };
    window.game.synergies = { left: w.detectSynergies(window.game.upgrades.left), right: [] };
    enemies.clearAllEnemies();
    const camera = window.__test?.getCamera?.();
    const dir = new THREE.Vector3();
    camera.getWorldDirection(dir);
    const basePos = camera.position.clone().addScaledVector(dir, 6);
    basePos.y = 1.6;

    const killAt = (pos, isRicochet) => {
      const enemy = enemies.spawnEnemy('basic', pos, window.game._levelConfig || undefined);
      const idx = enemies.getEnemies().indexOf(enemy);
      // Inline stats object (helper lives in Node context, not the page)
      const stats = {
        damage: 999, critChance: 0, critMultiplier: 2, fireWeakenMult: 1,
        effects: [], aoeRadius: 0, projectileCount: 1, spreadAngle: 0,
        homing: false, ricochetBounces: 0, piercing: false,
        vampiricInterval: 7, scatterSeek: false, forceExplosion: false,
        isRicochetHit: isRicochet,
      };
      ps.handleHit(idx, enemy, stats, enemy.mesh.position.clone(), 0, false, false, {});
    };
    // 3 direct kills (totalKills 3), then 7 ricochet kills (totalKills 10).
    // The ORIGINAL vampiric check runs on totalKills % 7 — at kill 10 it is
    // 10 % 7 = 3 ≠ 0, so ONLY Soul Chain's own counter (7 % 7 = 0) heals.
    for (let i = 0; i < 3; i++) killAt(basePos.clone().add(new THREE.Vector3(i * 1.2, 0, 0)), false);
    for (let i = 0; i < 7; i++) killAt(basePos.clone().add(new THREE.Vector3(i * 1.2, 0, 2)), true);
    return {
      health: window.game.health,
      ricochetCount: window.game.ricochetKillCount,
      totalKills: window.game.totalKills,
    };
  });
  console.log(`  7 ricochet kills heal exactly on the 7th (5→6): ${
    results.soulChain.health === 6 && results.soulChain.ricochetCount === 7 ? '✅' : '❌'} (h:${results.soulChain.health} rc:${results.soulChain.ricochetCount} tk:${results.soulChain.totalKills})`);
  await page.evaluate(() => { window.game.health = 6; });

  // ── Phase 4: Pinball Wizard — bounces skip already-hit enemies ──
  console.log('\n📍 Phase 4: Pinball Wizard bounce targeting...');
  results.pinball = await page.evaluate(async () => {
    const THREE = await import('three');
    const enemies = await import('./enemies.js');
    const ps = await import('./projectile-system.js');
    enemies.clearAllEnemies();
    const camera = window.__test?.getCamera?.();
    const dir = new THREE.Vector3();
    camera.getWorldDirection(dir);
    const basePos = camera.position.clone().addScaledVector(dir, 6);
    basePos.y = 1.6;

    const spawnPair = () => {
      const a = enemies.spawnEnemy('basic', basePos.clone().add(new THREE.Vector3(0, 0, 0)), window.game._levelConfig || undefined);
      const b = enemies.spawnEnemy('basic', basePos.clone().add(new THREE.Vector3(1.2, 0, 0)), window.game._levelConfig || undefined);
      const list = enemies.getEnemies();
      return { a, b, aIdx: list.indexOf(a), bIdx: list.indexOf(b), bHpBefore: b.hp };
    };

    // Case 1: excludeEnemies = {aIdx} → bounce must hit B (not re-hit A)
    const pair1 = spawnPair();
    const bounceStats = {
      damage: 10, critChance: 0, critMultiplier: 2, fireWeakenMult: 1,
      effects: [], aoeRadius: 0, projectileCount: 1, spreadAngle: 0,
      homing: false, ricochetBounces: 1, piercing: false,
      vampiricInterval: 0, scatterSeek: false, forceExplosion: false,
      isRicochetHit: false,
    };
    ps.handleRicochet(pair1.a.mesh.position, bounceStats, 0, 0, new Set([pair1.aIdx]));
    const bHpAfterBounce = pair1.b.hp;

    // Case 2: no exclude set → bounce re-hits the closest (A).
    // Clear the arena first — case 1's enemies sit at the SAME positions
    // and would be the "closest" targets instead of pair2's A.
    enemies.clearAllEnemies();
    const pair2 = spawnPair();
    const aHpBefore = pair2.a.hp;
    ps.handleRicochet(pair2.a.mesh.position, bounceStats, 0, 0, null);
    const aHpAfterReHit = pair2.a.hp;

    return {
      bTookDamage: bHpAfterBounce < pair1.bHpBefore,
      reHitClosest: (aHpBefore - aHpAfterReHit) >= 5, // 50% of the 10 dmg bounce landed
    };
  });
  console.log(`  Bounce with exclude → hits the NEW enemy (B): ${results.pinball.bTookDamage ? '✅' : '❌'}`);
  console.log(`  Bounce without exclude → re-hits closest (A): ${results.pinball.reHitClosest ? '✅' : '❌'} (debug ${JSON.stringify(results.pinball.debug)})`);

  // ── Phase 5: Momentum — kill streak damage + decay ──
  console.log('\n📍 Phase 5: Momentum kill-chain damage...');
  await setSynergies({ overcharge: 1 }, {});
  await clearEnemies();
  results.momentum = await page.evaluate(async () => {
    const THREE = await import('three');
    const enemies = await import('./enemies.js');
    const ps = await import('./projectile-system.js');
    const camera = window.__test?.getCamera?.();
    const dir = new THREE.Vector3();
    camera.getWorldDirection(dir);
    const pos = camera.position.clone().addScaledVector(dir, 5);
    pos.y = 1.6;
    const enemy = enemies.spawnEnemy('basic', pos, window.game._levelConfig || undefined);
    const idx = enemies.getEnemies().indexOf(enemy);
    const stats = {
      damage: 999, critChance: 0, critMultiplier: 2, fireWeakenMult: 1,
      effects: [], aoeRadius: 0, projectileCount: 1, spreadAngle: 0,
      homing: false, ricochetBounces: 0, piercing: false,
      vampiricInterval: 0, scatterSeek: false, forceExplosion: false,
      isRicochetHit: false,
    };
    ps.handleHit(idx, enemy, stats, enemy.mesh.position.clone(), 0, false, false, {});
    return { kills: window.game.totalKills };
  });
  await sleep(300);
  await aimUp();
  await page.keyboard.press('1');
  await page.keyboard.down('Space');
  await sleep(500);
  await page.keyboard.up('Space');
  results.momentumStacked = await page.evaluate(async () => {
    const ps = await import('./projectile-system.js');
    return ps.projectiles.map(p => p.userData?.stats?.damage || 0);
  });
  // 18 (overcharge 15×1.2) × 1.05 (1 kill stack) = 18.9 → 19
  const stackedOk = results.momentumStacked.includes(19);
  // Decay: wait past the 2s window, fire again → back to 18
  await sleep(2100);
  await page.keyboard.down('Space');
  await sleep(400);
  await page.keyboard.up('Space');
  results.momentumDecayed = await page.evaluate(async () => {
    const ps = await import('./projectile-system.js');
    return ps.projectiles.map(p => p.userData?.stats?.damage || 0);
  });
  const decayedOk = results.momentumDecayed.includes(18) && !results.momentumDecayed.includes(19);
  console.log(`  Killed → +5% damage on next shot (18→19): ${stackedOk ? '✅' : '❌'} [${results.momentumStacked.join(',')}]`);
  console.log(`  Decays after 2s (back to 18): ${decayedOk ? '✅' : '❌'} [${results.momentumDecayed.join(',')}]`);

  // ── Phase 6: Tesla Tower — extra chains + secondary chains ──
  console.log('\n📍 Phase 6: Tesla Tower chain extension...');
  results.teslaTower = await page.evaluate(async () => {
    const THREE = await import('three');
    const enemies = await import('./enemies.js');
    const beam = await import('./beam-weapons.js');
    const w = await import('./weapons.js');
    enemies.clearAllEnemies();
    window.game.upgrades = { left: { tesla_coil: 1, shock: 1 }, right: {} };
    window.game.synergies = { left: w.detectSynergies(window.game.upgrades.left), right: [] };

    const stub = {
      getWorldPosition: (v) => v.set(0, 1.5, -2),
      getWorldQuaternion: (q) => q.identity(),
    };
    const stats = {
      lightning: true, lightningRange: 15, lightningMaxTargets: 3,
      lightningTickInterval: 0.01, lightningDamage: 5, damage: 5,
    };
    const spawnCluster = () => {
      const spawned = [];
      for (let i = 0; i < 6; i++) {
        const e = enemies.spawnEnemy('basic', new THREE.Vector3(-2.5 + i * 1.0, 1.5, -8), window.game._levelConfig || undefined);
        if (e) { e.baseSpeed = 0; e.speed = 0; spawned.push(e); }
      }
      return spawned;
    };

    const damagedCount = (spawned) => {
      let n = 0;
      const list = enemies.getEnemies();
      spawned.forEach(s => {
        const live = list.find(e => e === s);
        if (live && live.hp < live.maxHp) n++;
      });
      return n;
    };

    // Tower active: 6 enemies clustered — tower should damage ALL of them
    const withTower = spawnCluster();
    await new Promise(r => setTimeout(r, 150)); // let the spatial hash pick them up
    for (let i = 0; i < 4; i++) beam.updateLightningBeam(stub, 0, stats, 0.05);
    beam.clearAllLightningBeams();
    const towerDamaged = damagedCount(withTower);

    // Tower inactive: same cluster → only the 3 primary chains hit
    enemies.clearAllEnemies();
    window.game.upgrades = { left: {}, right: {} };
    window.game.synergies = { left: [], right: [] };
    const withoutTower = spawnCluster();
    await new Promise(r => setTimeout(r, 150));
    for (let i = 0; i < 4; i++) beam.updateLightningBeam(stub, 0, stats, 0.05);
    beam.clearAllLightningBeams();
    const baseDamaged = damagedCount(withoutTower);

    return { towerDamaged, baseDamaged };
  });
  console.log(`  Tesla Tower damages all 6 (vs 3 base): ${
    results.teslaTower.towerDamaged >= 5 && results.teslaTower.baseDamaged <= 3 ? '✅' : '❌'} (tower:${results.teslaTower.towerDamaged} base:${results.teslaTower.baseDamaged})`);

  // ── Phase 7: Final Solution — full-charge kill spawns a black hole ──
  console.log('\n📍 Phase 7: Final Solution black hole...');
  results.finalSolution = await page.evaluate(async () => {
    const THREE = await import('three');
    const enemies = await import('./enemies.js');
    const beam = await import('./beam-weapons.js');
    const alt = await import('./alt-weapons.js');
    const w = await import('./weapons.js');
    enemies.clearAllEnemies();
    window.game.upgrades = { left: { quick_charge: 1, death_ray: 1 }, right: {} };
    window.game.synergies = { left: w.detectSynergies(window.game.upgrades.left), right: [] };
    // Killable enemy straight ahead of the stub controller
    const enemy = enemies.spawnEnemy('basic', new THREE.Vector3(0, 1.5, -8), window.game._levelConfig || undefined);
    enemy.hp = 10;
    enemy.maxHp = 10;
    const bhCountBefore = alt.activeBlackHoles.length;

    const stub = {
      getWorldPosition: (v) => v.set(0, 1.5, -2),
      getWorldQuaternion: (q) => q.identity(),
    };
    const stats = {
      chargeShot: true, chargeRateMultiplier: 1, chargeDeathRayMultiplier: 1,
      chargeTimeMax: 5, damage: 99999, projectileCount: 1,
      effects: [], aoeRadius: 0, critChance: 0, critMultiplier: 2,
      fireWeakenMult: 1, spreadAngle: 0, homing: false, ricochetBounces: 0,
      piercing: false, vampiricInterval: 0, scatterSeek: false,
      forceExplosion: false, isRicochetHit: false,
    };
    beam.fireChargeBeam(stub, 0, 5.0, stats, {});
    return {
      spawned: alt.activeBlackHoles.length === bhCountBefore + 1,
      count: alt.activeBlackHoles.length,
    };
  });
  console.log(`  Full-charge kill opens a black hole: ${results.finalSolution.spawned ? '✅' : '❌'} (count ${results.finalSolution.count})`);
  await sleep(2600); // let the black hole expire (2s duration)

  // ── Phase 8: Swarm Leader — lost seekers become drones ──
  console.log('\n📍 Phase 8: Swarm Leader protective drones...');
  await setSynergies({ gimme_more: 1 }, {});
  await clearEnemies();
  results.swarmLeader = await page.evaluate(async () => {
    const THREE = await import('three');
    const ps = await import('./projectile-system.js');
    // Seeker fired straight up with a 1m homing range so it can NEVER lock a
    // target (wave enemies spawn 5m+ away) — it must expire targetless.
    const seekerStats = {
      homing: true, homingRange: 1, homingStrength: 15,
      projectileSpeed: 12, damage: 1, critChance: 0, critMultiplier: 2,
      fireWeakenMult: 1, effects: [], aoeRadius: 0, projectileCount: 1,
      spreadAngle: 0, ricochetBounces: 0, piercing: false,
      vampiricInterval: 0, scatterSeek: false, forceExplosion: false,
      isRicochetHit: false,
    };
    const origin = new THREE.Vector3(0, 1.6, -3);
    ps.spawnProjectile(origin, new THREE.Vector3(0, 1, 0), 0, seekerStats, `combo-seeker-${Date.now()}`);
    return true;
  });
  await sleep(1800); // seeker lifetime 1500ms → drone spawns
  const droneCount = await page.evaluate(async () => {
    const ps = await import('./projectile-system.js');
    return ps.getSwarmDroneCount();
  });
  await sleep(6500); // drone duration 6000ms → expires
  const droneCountAfter = await page.evaluate(async () => {
    const ps = await import('./projectile-system.js');
    return ps.getSwarmDroneCount();
  });
  console.log(`  Lost seeker becomes a drone: ${droneCount === 1 ? '✅' : '❌'} (${droneCount})`);
  console.log(`  Drone expires after its duration: ${droneCountAfter === 0 ? '✅' : '❌'} (${droneCountAfter})`);

  // ── Phase 9: Combo glow ──
  console.log('\n📍 Phase 9: Combo icon glow...');
  await page.evaluate(async () => {
    const hud = await import('./hud.js');
    hud.triggerComboGlow(0xff8800);
  });
  await sleep(300);
  results.glowVisible = await page.evaluate(() => {
    const scene = window.__test?.getScene?.();
    const bar = scene?.getObjectByName?.('floor-hud-combo-bar');
    return !!bar && bar.visible;
  });
  await sleep(700); // glow duration 600ms → gone
  results.glowGone = await page.evaluate(() => {
    const scene = window.__test?.getScene?.();
    const bar = scene?.getObjectByName?.('floor-hud-combo-bar');
    return !!bar && !bar.visible;
  });
  console.log(`  Bar glows on combo trigger: ${results.glowVisible ? '✅' : '❌'}`);
  console.log(`  Glow fades after ~0.6s: ${results.glowGone ? '✅' : '❌'}`);

  // ── Results ──
  console.log('\n============================================================');
  console.log('📊 Results:');
  if (errors.length === 0) {
    console.log('  ✅ No console errors');
  } else {
    console.log(`  ❌ ${errors.length} console error(s):`);
    errors.slice(0, 5).forEach(e => console.log(`     - ${e.substring(0, 120)}`));
  }
  const detectOk = results.detect.soulChain && results.detect.pinball && results.detect.pinballOvercharge &&
    results.detect.momentum && results.detect.teslaTower && results.detect.finalSolution &&
    results.detect.swarmLeader && results.detect.noFalsePositive;
  const passed = errors.length === 0 && detectOk &&
    results.soulChain.health === 6 && results.soulChain.ricochetCount === 7 &&
    results.pinball.bTookDamage && results.pinball.reHitClosest &&
    stackedOk && decayedOk &&
    results.teslaTower.towerDamaged >= 5 && results.teslaTower.baseDamaged <= 3 &&
    results.finalSolution.spawned &&
    droneCount === 1 && droneCountAfter === 0 &&
    results.glowVisible && results.glowGone;
  console.log(passed ? '\n✅ ALL TESTS PASSED' : '\n❌ TEST FAILURES');
  await browser.close();
  process.exit(passed ? 0 : 1);
}

runTest().catch(err => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
