/**
 * Test: Breach Events (#138) — mid-level arena hazards
 *
 *   - Seeded determinism: same seed+level → same event; level 1-3 never
 *   - Lifecycle: warning (3s) → active (8-15s) → decay → idle
 *   - Solar flare: zone mesh appears during active
 *   - Gravity inversion: enemies float upward during active
 *   - Dimensional rift: spawns 3 weak rift echoes
 *   - EMP wave: gated fire (no projectiles while active) + flag lifecycle
 *   - No console errors
 */
const puppeteer = require('puppeteer');

const GAME_URL = 'http://localhost:8001/dev.html';

async function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function runTest() {
  console.log('🧪 Breach Events Test (#138)\n');
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
    window.game.playerName = 'BreachBot';
    window.game.state = 'playing';
    window.game.health = 6;
    window.game.level = 4; // no boss at 4 — the test drives events directly
    window.game.mainWeaponLocked = { left: true, right: true };
  });
  await page.evaluate(async () => {
    const d = await import('./desktop-controls.js');
    if (!d.isEnabled()) d.enable();
  });
  await sleep(500);
  console.log('  ✅ In PLAYING state');

  const results = {};

  // ── Phase 2: Seeded determinism (pure) ──
  console.log('\n📍 Phase 2: Seeded selection...');
  results.seed = await page.evaluate(async () => {
    const b = await import('./breach-events.js');
    const gated = b.getBreachEventForLevel('x', 1) === null && b.getBreachEventForLevel('x', 3) === null;
    // Find a deterministic trigger at level 5 and verify repeatability
    let triggerSeed = null;
    let eventId = null;
    for (let s = 0; s < 200; s++) {
      const id = b.getBreachEventForLevel(s, 5);
      if (id) { triggerSeed = s; eventId = id; break; }
    }
    const repeat = triggerSeed !== null && b.getBreachEventForLevel(triggerSeed, 5) === eventId;
    // Min-level gate: the same seed must NOT trigger before the event unlocks
    const gatedByLevel = triggerSeed !== null && b.getBreachEventForLevel(triggerSeed, 2) === null;
    return { ok: gated && repeat && gatedByLevel, triggerSeed, eventId };
  });
  console.log(`  Seeded + level-gated (repeatable, min level 4): ${results.seed.ok ? '✅' : '❌'} (${JSON.stringify(results.seed)})`);

  // ── Phase 3: Lifecycle (solar flare) ──
  console.log('\n📍 Phase 3: Lifecycle...');
  results.lifecycle = await page.evaluate(async () => {
    const enemies = await import('./enemies.js');
    const b = await import('./breach-events.js');
    // Force normal time scale continuously (flare burns the player → the
    // proximity slow-mo would scale dt down and creep the event timers)
    window.game.maxHealth = 30;
    window.game.health = 30;
    const keepAlive = setInterval(() => {
      window.game.health = window.game.maxHealth;
      window._timeScale = 1.0;
      window.game.timeScale = 1.0;
      window.game.spawnTimer = 9999; // no waves → no proximity slow-mo
    }, 200);
    b.forceBreachForTest('solar_flare');
    await new Promise(r => setTimeout(r, 100));
    const phaseActive = b.getBreachPhase() === 'active' && b.getBreachEventId() === 'solar_flare';
    const scene = window.__test?.getScene?.();
    const zoneMesh = scene?.children.some(c => c.isMesh && c.material?.color?.getHex?.() === 0xff8800);
    // Wait out the 8s active + 2s decay (longer wait — the proximity
    // slow-mo bleeds a little dt even with the forced time scale)
    await new Promise(r => setTimeout(r, 14000));
    const phaseIdle = b.getBreachPhase() === 'idle';
    clearInterval(keepAlive);
    window.game.health = 6;
    return { ok: phaseActive && zoneMesh && phaseIdle, phaseActive, zoneMesh, phaseIdle };
  });
  console.log(`  Active (flare zone) → idle: ${results.lifecycle.ok ? '✅' : '❌'} (${JSON.stringify(results.lifecycle)})`);

  // ── Phase 4: Gravity inversion floats enemies ──
  console.log('\n📍 Phase 4: Gravity inversion...');
  results.gravity = await page.evaluate(async () => {
    const THREE = await import('three');
    const enemies = await import('./enemies.js');
    const b = await import('./breach-events.js');
    enemies.clearAllEnemies();
    const e = enemies.spawnEnemy('basic', new THREE.Vector3(0, 1.6, -16), window.game._levelConfig || undefined);
    if (!e) return { ok: false, reason: 'spawn failed' };
    e.baseSpeed = 0;
    e.speed = 0;
    window.game.maxHealth = 30;
    window.game.health = 30;
    const keepAlive = setInterval(() => {
      window.game.health = window.game.maxHealth;
      window._timeScale = 1.0;
      window.game.timeScale = 1.0;
      window.game.spawnTimer = 9999; // no waves → no proximity slow-mo
    }, 200);
    b.forceBreachForTest('gravity_inversion');
    await new Promise(r => setTimeout(r, 200));
    const y0 = e.mesh.position.y;
    await new Promise(r => setTimeout(r, 1500));
    const y1 = e.mesh.position.y;
    clearInterval(keepAlive);
    return { ok: y1 > y0 + 0.4, y0: +y0.toFixed(2), y1: +y1.toFixed(2) };
  });
  console.log(`  Enemies float during gravity inversion: ${results.gravity.ok ? '✅' : '❌'} (${JSON.stringify(results.gravity)})`);

  // ── Phase 5: Dimensional rift spawns echoes ──
  console.log('\n📍 Phase 5: Dimensional rift...');
  results.rift = await page.evaluate(async () => {
    const enemies = await import('./enemies.js');
    const b = await import('./breach-events.js');
    enemies.clearAllEnemies();
    window.game.maxHealth = 30;
    window.game.health = 30;
    const riftKeepAlive = setInterval(() => {
      window.game.health = window.game.maxHealth;
      window._timeScale = 1.0;
      window.game.timeScale = 1.0;
      window.game.spawnTimer = 9999;
    }, 200);
    b.forceBreachForTest('dimensional_rift');
    await new Promise(r => setTimeout(r, 400));
    const echoes = enemies.getEnemies().filter(e => e.hp <= 12 && e._bossSummoned).length;
    clearInterval(riftKeepAlive);
    return { ok: echoes >= 2, echoes };
  });
  console.log(`  Rift spawns weak echo enemies: ${results.rift.ok ? '✅' : '❌'} (${JSON.stringify(results.rift)})`);

  // ── Phase 6: EMP gates fire ──
  console.log('\n📍 Phase 6: EMP wave...');
  results.emp = await page.evaluate(async () => {
    const THREE = await import('three');
    const enemies = await import('./enemies.js');
    const ps = await import('./projectile-system.js');
    const b = await import('./breach-events.js');
    enemies.clearAllEnemies();
    window.game.maxHealth = 30;
    window.game.health = 30;
    const keepAlive = setInterval(() => {
      window.game.health = window.game.maxHealth;
      window._timeScale = 1.0;
      window.game.timeScale = 1.0;
      window.game.spawnTimer = 9999; // no waves → no proximity slow-mo
    }, 200);
    b.forceBreachForTest('emp_wave');
    await new Promise(r => setTimeout(r, 200));
    const empDuring = b.isBreachEmpActive() && b.getBreachPhase() === 'active';
    // Fire through the desktop path — no projectiles should spawn
    const camera = window.__test?.getCamera?.();
    const dir = new THREE.Vector3(0, 1, 0);
    camera.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, -1), dir);
    camera.rotation.setFromQuaternion(camera.quaternion);
    window.game.mainWeapon = { left: 'standard_blaster', right: 'standard_blaster' };
    window.game.upgrades = { left: {}, right: {} };
    await new Promise(r => setTimeout(r, 200));
    // Aim up + hold fire like other suites
    const projsBefore = ps.projectiles.length;
    await window.__test?.desktopFire?.();
    await new Promise(r => setTimeout(r, 400));
    const projsAfter = ps.projectiles.length;
    // Wait out the EMP (10s) + decay (longer wait for slow-mo dt bleed)
    await new Promise(r => setTimeout(r, 16000));
    const empAfter = b.isBreachEmpActive();
    clearInterval(keepAlive);
    return { ok: empDuring && projsAfter === projsBefore && !empAfter && b.getBreachPhase() === 'idle',
             empDuring, projsBefore, projsAfter, empAfter, phase: b.getBreachPhase() };
  });
  console.log(`  EMP disables fire during active, clears after: ${results.emp.ok ? '✅' : '❌'} (${JSON.stringify(results.emp)})`);

  // ── Results ──
  console.log('\n============================================================');
  console.log('📊 Results:');
  if (errors.length === 0) {
    console.log('  ✅ No console errors');
  } else {
    console.log(`  ❌ ${errors.length} console error(s):`);
    errors.slice(0, 5).forEach(e => console.log(`     - ${e.substring(0, 120)}`));
  }
  const passed = errors.length === 0 && results.seed.ok && results.lifecycle.ok &&
    results.gravity.ok && results.rift.ok && results.emp.ok;
  console.log(passed ? '\n✅ ALL TESTS PASSED' : '\n❌ TEST FAILURES');
  await browser.close();
  process.exit(passed ? 0 : 1);
}

runTest().catch(err => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
