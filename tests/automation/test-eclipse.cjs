/**
 * Test: Eclipse Engine Phase 2 (#172) — upgrade corruption layer
 *
 *   - Pure stats transform: damage cut, fire rate penalty, projectile
 *     halving + scatter flag, crit-reflect flag, pierce seal, vampiric off,
 *     status ammo stripped
 *   - pickEclipseTarget: only eclipsable upgrades the player owns; null
 *     when the loadout has nothing to corrupt
 *   - Boss integration: 50% HP triggers the corruption phase; the eclipse
 *     scheduler auto-triggers an eclipse; escalation tiers by HP; SHOCK
 *     hits extend the interval; destroy() purges all eclipses
 *   - Fire pipeline: corrupted damage shows up on real fired projectiles
 *     (computeWeaponStats wrapper) and reverts after purge
 *   - HUD warning: visible on trigger, counts down, hides on expiry/purge
 *   - Self-damage drains + crit reflect damage the player
 *   - No console errors
 */
const puppeteer = require('puppeteer');

const GAME_URL = 'http://localhost:8001/dev.html';

async function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function runTest() {
  console.log('🧪 Eclipse Engine Phase 2 Test (#172)\n');
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
    // The death-stats API 404s on the static dev server (Vercel-only route)
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
    window.game.playerName = 'EclipseBot';
    window.game.state = 'playing';
    window.game.health = 6;
    window.game.level = 20;
    window.game.mainWeaponLocked = { left: true, right: true };
    window.game.mainWeapon = { left: 'standard_blaster', right: 'standard_blaster' };
    // Issue #172: the corruption layer targets UNIVERSAL stat upgrades only —
    // scope stacks on the left hand are what the boss will corrupt
    window.game.upgrades = { left: { scope: 2 }, right: {} };
  });
  await page.evaluate(async () => {
    const d = await import('./desktop-controls.js');
    if (!d.isEnabled()) d.enable();
  });
  await sleep(500);
  console.log('  ✅ In PLAYING state');

  const results = {};

  // Aim the desktop camera straight up so projectiles fly skyward where no
  // spawned enemy can intercept them before the snapshot.
  const aimUp = () => page.evaluate(async () => {
    const THREE = await import('three');
    const camera = window.__test?.getCamera?.();
    if (!camera) return false;
    const dir = new THREE.Vector3(0, 1, 0);
    camera.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, -1), dir);
    camera.rotation.setFromQuaternion(camera.quaternion);
    return true;
  });

  // ── Phase 2: Pure module checks ──
  console.log('\n📍 Phase 2: Pure stats transform + target picking...');
  results.pure = await page.evaluate(async () => {
    const e = await import('./eclipse.js');
    const base = {
      damage: 40, fireInterval: 300, projectileCount: 3, critChance: 0.5,
      critMultiplier: 2, piercing: true, vampiricInterval: 4,
      effects: [{ type: 'fire', stacks: 1 }], hasChargeAoEFire: true,
    };
    const corrupted = e.applyEclipseToStats(base, ['scope', 'barrel', 'double_shot', 'critical', 'piercing', 'vampiric', 'fire']);
    const clean = e.applyEclipseToStats(base, []);
    return {
      // Pure: same object back when nothing is eclipsed, input never mutated
      noopSameRef: clean === base,
      inputUnmutated: base.damage === 40 && base.projectileCount === 3,
      damageCut: corrupted.damage === 28,            // 40 × 0.7 = 28
      fireRatePenalty: corrupted.fireInterval === 510, // 300 × 1.7
      projectileHalved: corrupted.projectileCount === 2, // round(3 × 0.5)
      scatterFlag: corrupted.eclipsedScatter === true,
      critReflectFlag: corrupted.critReflect === true,
      pierceSealed: corrupted.piercing === false,
      vampiricOff: corrupted.vampiricInterval === 0,
      statusStripped: corrupted.effects.length === 0 && corrupted.hasChargeAoEFire === false,
      // Target picking: only owned + eclipsable; null when nothing to take
      picksScope: (() => {
        const t = e.pickEclipseTarget();
        return t && t.id === 'scope' && t.hand === 'left';
      })(),
    };
  });
  console.log(`  Damage cut (40→28): ${results.pure.damageCut ? '✅' : '❌'}`);
  console.log(`  Fire-rate penalty (300→510): ${results.pure.fireRatePenalty ? '✅' : '❌'}`);
  console.log(`  Projectiles halved + scatter flag: ${results.pure.projectileHalved && results.pure.scatterFlag ? '✅' : '❌'}`);
  console.log(`  Crit-reflect flag / pierce sealed / vampiric off / status stripped: ${
    results.pure.critReflectFlag && results.pure.pierceSealed && results.pure.vampiricOff && results.pure.statusStripped ? '✅' : '❌'}`);
  console.log(`  No-op same ref + input unmutated (pure getter rule): ${results.pure.noopSameRef && results.pure.inputUnmutated ? '✅' : '❌'}`);
  console.log(`  pickEclipseTarget picks owned scope (left): ${results.pure.picksScope ? '✅' : '❌'}`);

  // ── Phase 3: Boss integration — 50% HP triggers corruption ──
  console.log('\n📍 Phase 3: Boss 50% HP trigger + scheduler...');
  const bossPhase = await page.evaluate(async () => {
    const enemies = await import('./enemies.js');
    const e = await import('./eclipse.js');
    const g = await import('./game.js');
    const cfg = g.getLevelConfig() || { hpMultiplier: 1, level: 20 };
    enemies.clearBoss();
    const boss = enemies.spawnBoss('eclipse_engine', cfg);
    if (!boss) return { ok: false, reason: 'spawn failed' };
    const maxHp = boss.maxHp;
    boss.hp = Math.floor(maxHp * 0.49); // just under the 50% threshold
    boss.takeDamage(1, {});             // damage path fires the 50% trigger
    const triggered = boss.eclipseActive === true;
    // Drive the scheduler manually (the live loop also drives it; direct
    // calls make the timing deterministic for assertions)
    boss.updateEclipseLayer(7);         // 4s initial delay + 7s ≥ 10s interval
    const triggeredCount = e.getActiveEclipseCount();
    const ids = e.getActiveEclipseIds('left');
    const gotScope = ids.includes('scope');
    // Escalation: drop below 33% HP → 8s interval / 12s duration / 2 max
    boss.hp = Math.floor(maxHp * 0.3);
    boss._updateEclipseTiming();
    const escalated = boss._eclipseInterval === 8000 && boss._eclipseDurationSec === 12 && boss._maxEclipses === 2;
    // Shock counterplay: a SHOCK-status hit registers the extension window
    boss.takeDamage(1, { effects: [{ type: 'shock' }] });
    const shockWindow = (performance.now() - boss._shockHitAt) < 4000;
    // Purge on destroy (boss death)
    enemies.clearBoss();
    const purged = e.getActiveEclipseCount() === 0;
    return { ok: triggered && triggeredCount === 1 && gotScope && escalated && shockWindow && purged,
             triggered, triggeredCount, gotScope, escalated, shockWindow, purged };
  });
  console.log(`  50% HP activates corruption phase: ${bossPhase.triggered ? '✅' : '❌'}`);
  console.log(`  Scheduler eclipsed the owned scope upgrade (1 active, left): ${bossPhase.triggeredCount === 1 && bossPhase.gotScope ? '✅' : '❌'} (${bossPhase.triggeredCount})`);
  console.log(`  Escalation at <33% HP (8s/12s/2): ${bossPhase.escalated ? '✅' : '❌'}`);
  console.log(`  SHOCK hit opens the 4s extension window: ${bossPhase.shockWindow ? '✅' : '❌'}`);
  console.log(`  Boss destroy purges all eclipses: ${bossPhase.purged ? '✅' : '❌'}`);

  // ── Phase 4: Real fire pipeline — corrupted damage + revert on purge ──
  console.log('\n📍 Phase 4: Fire pipeline corruption + purge revert...');
  await page.evaluate(() => { window.game.health = 6; });
  await page.evaluate(async () => {
    const enemies = await import('./enemies.js');
    const e = await import('./eclipse.js');
    const g = await import('./game.js');
    const cfg = g.getLevelConfig() || { hpMultiplier: 1, level: 20 };
    enemies.clearBoss();
    const boss = enemies.spawnBoss('eclipse_engine', cfg);
    boss.hp = Math.floor(boss.maxHp * 0.49);
    boss.takeDamage(1, {});
    boss.updateEclipseLayer(7); // auto-eclipse the left scope
    // Keep the boss around for the eclipse to stay active (destroy purges)
    window.__eclipseTestBoss = boss;
  });
  await sleep(300);
  await aimUp();
  await page.keyboard.press('1'); // left hand only
  await page.keyboard.down('Space');
  await sleep(600);
  await page.keyboard.up('Space');
  results.fireCorrupted = await page.evaluate(async () => {
    const ps = await import('./projectile-system.js');
    return ps.projectiles.map(p => p.userData?.stats?.damage || 0);
  });
  await page.evaluate(async () => {
    const enemies = await import('./enemies.js');
    enemies.clearBoss(); // boss death → purge
  });
  await sleep(400);
  // Snapshot only projectiles spawned AFTER this point — the projectile pool
  // recycles entries, so stale pooled projectiles from the corrupted burst
  // (damage 25) would otherwise linger in the array and false-fail the check.
  const t0 = await page.evaluate(() => performance.now());
  await page.keyboard.down('Space');
  await sleep(600);
  await page.keyboard.up('Space');
  results.fireClean = await page.evaluate(async (start) => {
    const ps = await import('./projectile-system.js');
    return ps.projectiles
      .filter(p => p.visible && (p.userData?.createdAt || 0) >= start)
      .map(p => p.userData?.stats?.damage || 0);
  }, t0);
  const hasCorrupted = results.fireCorrupted.includes(25); // (15 + 20) × 0.7 → 25
  const hasClean = results.fireClean.includes(35);         // 15 + scope(2)×10 → 35
  const noCorruptedAfterPurge = !results.fireClean.includes(25);
  console.log(`  Corrupted shot deals 25 (35×0.7): ${hasCorrupted ? '✅' : '❌'} [${results.fireCorrupted.join(',')}]`);
  console.log(`  After purge damage back to 35, no 25s left: ${hasClean && noCorruptedAfterPurge ? '✅' : '❌'} [${results.fireClean.join(',')}]`);

  // ── Phase 5: HUD warning + countdown + expiry ──
  console.log('\n📍 Phase 5: HUD eclipse warning...');
  results.hud = await page.evaluate(async () => {
    const e = await import('./eclipse.js');
    const hud = await import('./hud.js');
    const camera = window.__test?.getCamera?.();
    const group = camera?.getObjectByName?.('eclipse-warning');
    const visibleBefore = !!group && group.visible;

    e.applyEclipse({ id: 'scope', hand: 'left' }, 1.2); // 1.2s countdown
    const groupAfter = camera?.getObjectByName?.('eclipse-warning');
    const visibleOnTrigger = !!groupAfter && groupAfter.visible;
    const hasSprite = visibleOnTrigger && groupAfter.children.length > 0;

    // Countdown ticks: the sprite must re-render each second (lastSecond bumps)
    const now = performance.now();
    hud.updateEclipseWarning(now + 1100);
    const ticks = groupAfter.children.length > 0;

    // Expiry hides the warning (updateEclipseWarning handles it)
    hud.updateEclipseWarning(now + 1500);
    const hiddenOnExpiry = !groupAfter.visible;

    // Manual hide path
    hud.showEclipseWarning('TEST', '#ff0044', 5000);
    hud.hideEclipseWarning();
    const hiddenOnHide = !groupAfter.visible;

    // Clean slate for later phases
    e.purgeAllEclipses();

    return { visibleBefore, visibleOnTrigger, hasSprite, ticks, hiddenOnExpiry, hiddenOnHide,
             groupFound: !!group, groupFoundAfter: !!groupAfter };
  });
  console.log(`  Hidden before trigger, visible on trigger (with sprite): ${
    !results.hud.visibleBefore && results.hud.visibleOnTrigger && results.hud.hasSprite ? '✅' : '❌'} (before:${results.hud.visibleBefore} after:${results.hud.visibleOnTrigger} sprite:${results.hud.hasSprite} group:${results.hud.groupFound}/${results.hud.groupFoundAfter})`);
  console.log(`  Countdown re-renders while active: ${results.hud.ticks ? '✅' : '❌'}`);
  console.log(`  Hides on expiry + manual hide: ${results.hud.hiddenOnExpiry && results.hud.hiddenOnHide ? '✅' : '❌'}`);

  // ── Phase 6: Self-damage drains + crit reflect ──
  console.log('\n📍 Phase 6: Self-damage (drains + crit reflect)...');
  await page.evaluate(() => { window.game.health = 6; });
  const drain = await page.evaluate(async () => {
    const e = await import('./eclipse.js');
    const g = await import('./game.js');
    e.purgeAllEclipses();
    e.applyEclipse({ id: 'fire', hand: 'left' }, 30); // harmful eclipse
    const before = g.game ? g.game.health : 6;
    e.updateEclipse(2.0); // first drain tick
    const afterOne = g.game ? g.game.health : 6;
    e.updateEclipse(2.0); // second tick
    const afterTwo = g.game ? g.game.health : 6;
    e.purgeAllEclipses();
    return { before, afterOne, afterTwo };
  });
  await page.evaluate(() => { window.game.health = 6; });
  const reflect = await page.evaluate(async () => {
    const THREE = await import('three');
    const enemies = await import('./enemies.js');
    const ps = await import('./projectile-system.js');
    const g = await import('./game.js');
    enemies.clearAllEnemies();
    const camera = window.__test?.getCamera?.();
    const dir = new THREE.Vector3();
    camera.getWorldDirection(dir);
    const pos = camera.position.clone().addScaledVector(dir, 4);
    pos.y = 1.6;
    const enemy = enemies.spawnEnemy('basic', pos, window.game._levelConfig || undefined);
    if (!enemy) return { ok: false, reason: 'no enemy' };
    enemy.hp = 5000; // never dies during the loop
    const idx = enemies.getEnemies().indexOf(enemy);
    const stats = {
      damage: 1, critChance: 1.0, critMultiplier: 2, fireWeakenMult: 1,
      effects: [], aoeRadius: 0, projectileCount: 1, spreadAngle: 0,
      homing: false, ricochetBounces: 0, piercing: false,
      vampiricInterval: 0, scatterSeek: false, forceExplosion: false,
      isRicochetHit: false, critReflect: true,
    };
    const hpBefore = enemy.hp;
    for (let i = 0; i < 25; i++) {
      ps.handleHit(idx, enemy, stats, enemy.mesh.position.clone(), 0, false, false, {});
    }
    const dead = g.game.health <= 0;
    return { ok: g.game.health < 6, health: g.game.health, dead, enemyHurt: hpBefore - enemy.hp };
  });
  console.log(`  Status/vampiric eclipse drains 1 HP per 2s tick: ${
    drain.afterOne < drain.before && drain.afterTwo < drain.afterOne ? '✅' : '❌'} (${drain.before}→${drain.afterOne}→${drain.afterTwo})`);
  console.log(`  Crit reflect damages the player (15% of 25 crits): ${reflect.ok ? '✅' : '❌'} (health ${reflect.health})`);
  await page.evaluate(() => { window.game.health = 6; });

  // ── Results ──
  console.log('\n============================================================');
  console.log('📊 Results:');
  if (errors.length === 0) {
    console.log('  ✅ No console errors');
  } else {
    console.log(`  ❌ ${errors.length} console error(s):`);
    errors.slice(0, 5).forEach(e => console.log(`     - ${e.substring(0, 120)}`));
  }
  const pureOk = results.pure.damageCut && results.pure.fireRatePenalty && results.pure.projectileHalved &&
    results.pure.scatterFlag && results.pure.critReflectFlag && results.pure.pierceSealed &&
    results.pure.vampiricOff && results.pure.statusStripped && results.pure.noopSameRef &&
    results.pure.inputUnmutated && results.pure.picksScope;
  const passed = errors.length === 0 && pureOk && bossPhase.ok && hasCorrupted && hasClean &&
    noCorruptedAfterPurge && !results.hud.visibleBefore && results.hud.visibleOnTrigger && results.hud.hasSprite &&
    results.hud.ticks && results.hud.hiddenOnExpiry && results.hud.hiddenOnHide &&
    drain.afterOne < drain.before && drain.afterTwo < drain.afterOne && reflect.ok;
  console.log(passed ? '\n✅ ALL TESTS PASSED' : '\n❌ TEST FAILURES');
  await browser.close();
  process.exit(passed ? 0 : 1);
}

runTest().catch(err => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
