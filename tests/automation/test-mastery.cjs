/**
 * Test: Weapon Mastery (#213) — permanent per-weapon progression
 *
 *   - Tier math (Novice/Adept/Expert/Master thresholds)
 *   - localStorage persistence: seeded kills load + kill tracking increments
 *   - Adept+ damage bonus in getWeaponStats (+10%)
 *   - Mastery card offered at Master tier on the upgrade screen
 *   - Card effects: Last Light (10th shot 5x), Overkill (3-way split),
 *     Melting Point (sustained plasma ignites), Swarm Intelligence (seekers
 *     double), Point Blank (close-range ramp)
 *   - Game-over mastery title line
 *   - No console errors
 */
const puppeteer = require('puppeteer');

const GAME_URL = 'http://localhost:8000/dev.html';

async function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function runTest() {
  console.log('🧪 Weapon Mastery Test (#213)\n');
  console.log('='.repeat(60));

  const errors = [];

  const browser = await puppeteer.launch({
    headless: 'new',
    args: [
      '--no-sandbox', '--disable-setuid-sandbox', '--use-angle=swiftshader',
      '--enable-webgl', '--ignore-gpu-blocklist', '--disable-gpu-sandbox',
    ]
  });

  // Seed mastery state BEFORE the page loads (loadMastery runs at init)
  const browserPage = await browser.newPage();
  await browserPage.setViewport({ width: 1280, height: 800 });
  await browserPage.evaluateOnNewDocument(() => {
    try {
      localStorage.setItem('spaceomicide_mastery', JSON.stringify({
        standard_blaster: 60,   // Adept
        lightning_rod: 600,     // Master
      }));
    } catch (e) { /* ignore */ }
  });

  const page = browserPage;
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
    window.game.playerName = 'MasterBot';
    window.game.state = 'playing';
    window.game.health = 6;
    window.game.level = 1;
    window.game.mainWeaponLocked = { left: true, right: true };
    window.game.mainWeapon = { left: 'standard_blaster', right: 'standard_blaster' };
    window.game.upgrades = { left: {}, right: {} };
  });
  await page.evaluate(async () => {
    const d = await import('./desktop-controls.js');
    if (!d.isEnabled()) d.enable();
  });
  await sleep(500);
  console.log('  ✅ In PLAYING state');

  const results = {};

  // ── Phase 2: Tier math + persistence + Adept bonus ──
  console.log('\n📍 Phase 2: Tiers, persistence, Adept bonus...');
  results.tiers = await page.evaluate(async () => {
    const m = await import('./mastery.js');
    const w = await import('./weapons.js');
    return {
      seededAdept: m.getMasteryTier('standard_blaster') === 'Adept',
      seededMaster: m.getMasteryTier('lightning_rod') === 'Master',
      kills: m.getMasteryKills('standard_blaster') === 60,
      adeptDamage: w.getWeaponStats('standard_blaster', {}).damage === 17, // 15 × 1.1 → 17
      noviceDamage: w.getWeaponStats('seeker_burst', {}).damage === 12,    // no kills → 12 (unchanged)
    };
  });
  console.log(`  Seeded tiers load from localStorage (Adept/Master): ${results.tiers.seededAdept && results.tiers.seededMaster ? '✅' : '❌'}`);
  console.log(`  Adept +10% damage (15 → 17), Novice unchanged (seeker 12): ${results.tiers.adeptDamage && results.tiers.noviceDamage ? '✅' : '❌'}`);

  // ── Phase 3: Kill tracking ──
  console.log('\n📍 Phase 3: Kill tracking...');
  await page.evaluate(async () => {
    const THREE = await import('three');
    const enemies = await import('./enemies.js');
    const camera = window.__test?.getCamera?.();
    const dir = new THREE.Vector3();
    camera.getWorldDirection(dir);
    const pos = camera.position.clone().addScaledVector(dir, 4);
    pos.y = 1.6;
    enemies.spawnEnemy('basic', pos, window.game._levelConfig || undefined);
  });
  await sleep(400);
  results.killTracked = await page.evaluate(async () => {
    const enemies = await import('./enemies.js');
    const ps = await import('./projectile-system.js');
    const m = await import('./mastery.js');
    const list = enemies.getEnemies();
    const idx = list.findIndex(e => e && e.hp > 0 && e.mesh);
    if (idx < 0) return { ok: false, reason: 'no enemy' };
    const before = m.getMasteryKills('standard_blaster');
    const stats = {
      damage: 999, critChance: 0, critMultiplier: 2, fireWeakenMult: 1,
      effects: [], aoeRadius: 0, projectileCount: 1, spreadAngle: 0,
      homing: false, ricochetBounces: 0, piercing: false,
      vampiricInterval: 0, scatterSeek: false, forceExplosion: false,
      isRicochetHit: false,
    };
    ps.handleHit(idx, list[idx], stats, list[idx].mesh.position.clone(), 0, false, false, {});
    return { ok: m.getMasteryKills('standard_blaster') === before + 1, before };
  });
  console.log(`  Kill increments the weapon's mastery counter: ${results.killTracked.ok ? '✅' : '❌'} (${JSON.stringify(results.killTracked)})`);

  // ── Phase 4: Mastery card offered at Master tier ──
  console.log('\n📍 Phase 4: Mastery card at Master tier...');
  await page.evaluate(() => {
    window.game.mainWeapon = { left: 'lightning_rod', right: 'lightning_rod' };
    window.game.upgrades = { left: {}, right: {} };
    window.game.nextUpgradeHand = 'left';
  });
  await page.evaluate(() => window.__test.progression.forceLevelComplete({ autoSelect: false }));
  const start = Date.now();
  while (Date.now() - start < 12000) {
    if (await page.evaluate(() => window.game?.state) === 'upgrade_select') break;
    await sleep(300);
  }
  await sleep(1600);
  const offered = await page.evaluate(() => window.__test.progression.getPendingUpgrades());
  results.masteryCard = offered.some(s => s.id === 'teslas_domain');
  console.log(`  Tesla's Domain offered at Master tier: ${results.masteryCard ? '✅' : '❌'} (${offered.slice(0, 3).map(s => s.id).join(', ')})`);
  // Leave the screen
  await page.evaluate(() => window.__test.progression.selectUpgradeByIndex(0));
  await sleep(1200);

  // ── Phase 5: Card effects ──
  console.log('\n📍 Phase 5: Card effects...');

  // Clear the arena before each firing phase — a spawned enemy in the flight
  // path intercepts projectiles before the snapshot (intermittent flakes).
  const clearEnemies = () => page.evaluate(async () => {
    const enemies = await import('./enemies.js');
    enemies.clearAllEnemies();
  });

  // Aim the desktop camera straight up: projectiles fly skyward where no
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

  // 5a. Last Light: every 10th shot deals 5x
  await clearEnemies();
  await aimUp();
  await page.evaluate(() => {
    window.game.mainWeapon = { left: 'standard_blaster', right: 'standard_blaster' };
    window.game.upgrades = { left: { last_light: 1 }, right: {} };
  });
  await page.keyboard.press('1'); // left only
  await page.keyboard.down('Space');
  await sleep(1900); // ~10 shots at 180ms
  await page.keyboard.up('Space');
  const llDump = await page.evaluate(async () => {
    const ps = await import('./projectile-system.js');
    return ps.projectiles.map(p => p.userData?.stats?.damage);
  });
  results.lastLight = await page.evaluate(async () => {
    const ps = await import('./projectile-system.js');
    // The seeded Adept bonus makes base damage 17 → the 10th shot is 85
    return ps.projectiles.some(p => p.userData?.stats?.damage === 85) &&
           ps.projectiles.some(p => p.userData?.stats?.damage === 17);
  });
  console.log(`  Last Light 10th-shot 5x (85 vs 17): ${results.lastLight ? '✅' : '❌'}`);

  // 5b. Overkill: max-charge release splits into 3 (max charge = 1000 → 3×333)
  await clearEnemies();
  await page.evaluate(() => {
    window.game.mainWeapon = { left: 'charge_cannon', right: 'charge_cannon' };
    window.game.upgrades = { left: { overkill: 1 }, right: {} };
  });
  await sleep(300);
  await aimUp();
  await page.keyboard.press('1');
  await page.keyboard.down('Space');
  await sleep(3300); // full charge (~3s)
  await page.keyboard.up('Space');
  await sleep(300);
  results.overkill = await page.evaluate(async () => {
    const ps = await import('./projectile-system.js');
    const damages = ps.projectiles.map(p => p.userData?.stats?.damage || 0);
    const split = damages.filter(d => d === 333);
    // 3 split projectiles of 333 each (charge max damage 1000 / 3)
    return { ok: split.length >= 3, count: split.length, dmg: damages.join(',') };
  });
  console.log(`  Overkill max-charge split (${results.overkill.count} × 333): ${results.overkill.ok ? '✅' : '❌'}`);

  // 5c. Melting Point: sustained plasma ignites (fire effect on shots)
  await clearEnemies();
  await page.evaluate(() => {
    window.game.mainWeapon = { left: 'plasma_carbine', right: 'plasma_carbine' };
    window.game.upgrades = { left: { melting_point: 1 }, right: {} };
  });
  await sleep(300);
  await page.keyboard.press('1');
  await page.keyboard.down('Space');
  await sleep(4200); // wind-up (600ms) + ramp + >3s sustained
  await page.keyboard.up('Space');
  results.melting = await page.evaluate(async () => {
    const ps = await import('./projectile-system.js');
    return ps.projectiles.some(p =>
      (p.userData?.stats?.effects || []).some(e => e.type === 'fire' && e.stacks > 0)
    );
  });
  console.log(`  Melting Point ignites after sustained fire: ${results.melting ? '✅' : '❌'}`);

  // 5d. Swarm Intelligence: seekers deal double damage (16 = 8 × 2)
  await page.evaluate(() => {
    window.game.mainWeapon = { left: 'seeker_burst', right: 'seeker_burst' };
    window.game.upgrades = { left: { swarm_intelligence: 1 }, right: {} };
  });
  await page.evaluate(async () => {
    const enemies = await import('./enemies.js');
    enemies.clearAllEnemies();
  });
  await sleep(300);
  await page.keyboard.press('1');
  await page.keyboard.down('Space');
  await sleep(400);
  await page.keyboard.up('Space');
  results.swarm = await page.evaluate(async () => {
    const ps = await import('./projectile-system.js');
    return ps.projectiles.some(p => p.userData?.stats?.damage === 24);
  });
  console.log(`  Swarm Intelligence seekers deal 24 (12 × 2): ${results.swarm ? '✅' : '❌'}`);

  // 5e. Point Blank: close-range ramp (2x under 3m via travelDist)
  results.pointBlank = await page.evaluate(async () => {
    const enemies = await import('./enemies.js');
    const ps = await import('./projectile-system.js');
    const THREE = await import('three');
    const list = enemies.getEnemies();
    const idx = list.findIndex(e => e && e.hp > 0 && e.mesh);
    if (idx < 0) return { ok: false, reason: 'no enemy' };
    const e = list[idx];
    const hpBefore = e.hp;
    const stats = {
      damage: 10, critChance: 0, critMultiplier: 2, fireWeakenMult: 1,
      effects: [], aoeRadius: 0, projectileCount: 1, spreadAngle: 0.2,
      homing: false, ricochetBounces: 0, piercing: false,
      vampiricInterval: 0, scatterSeek: false, forceExplosion: false,
      isRicochetHit: false, pointBlank: true, travelDist: 2, // close → 2x
    };
    ps.handleHit(idx, e, stats, e.mesh.position.clone(), 0, false, false, {});
    return { ok: hpBefore - e.hp >= 20, dealt: hpBefore - e.hp };
  });
  console.log(`  Point Blank close-range 2x (${results.pointBlank.dealt} dealt): ${results.pointBlank.ok ? '✅' : '❌'}`);

  // ── Phase 6: Game-over mastery title ──
  console.log('\n📍 Phase 6: Game-over mastery title...');
  // Trigger a real game over: drop to 1 HP, spawn an enemy on top of the
  // player, and let the collision damage end the run (showGameOver renders
  // the mastery line).
  await page.evaluate(async () => {
    const THREE = await import('three');
    const enemies = await import('./enemies.js');
    const camera = window.__test?.getCamera?.();
    window.game.health = 1;
    window.game.mainWeapon = { left: 'lightning_rod', right: 'lightning_rod' };
    const pos = camera.position.clone();
    pos.y = 1.5;
    enemies.spawnEnemy('fast', pos, window.game._levelConfig || undefined);
  });
  await sleep(6000); // enemy closes in, damages, game over
  const titleText = await page.evaluate(() => {
    const scene = window.__test?.getScene?.();
    const line = scene?.getObjectByName('masteryLine');
    if (!line) return null;
    let t = null;
    line.traverse(c => { if (c.userData && c.userData.text) t = c.userData.text; });
    return t;
  });
  results.title = !!titleText && /⚡/.test(titleText) && /MASTER/.test(titleText);
  console.log(`  Game-over mastery title (${titleText}): ${results.title ? '✅' : '❌'}`);

  // ── Results ──
  console.log('\n============================================================');
  console.log('📊 Results:');
  if (errors.length === 0) {
    console.log('  ✅ No console errors');
  } else {
    console.log(`  ❌ ${errors.length} console error(s):`);
    errors.slice(0, 5).forEach(e => console.log(`     - ${e.substring(0, 120)}`));
  }
  const passed = errors.length === 0 &&
    results.tiers.seededAdept && results.tiers.seededMaster && results.tiers.adeptDamage && results.tiers.noviceDamage &&
    results.killTracked.ok && results.masteryCard && results.lastLight && results.overkill.ok &&
    results.melting && results.swarm && results.pointBlank.ok && results.title;
  console.log(passed ? '\n✅ ALL TESTS PASSED' : '\n❌ TEST FAILURES');
  await browser.close();
  process.exit(passed ? 0 : 1);
}

runTest().catch(err => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
