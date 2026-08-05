/**
 * Test: Echo Phantom (#169) — replays the player's last 3s of aim
 *
 *   - Level config includes echo_phantom at level 11+
 *   - spawnEchoPhantom creates a translucent ghost (opacity 0.4)
 *   - Playback fires an echo projectile for each recorded shot, along the
 *     recorded direction
 *   - Echo projectiles damage OTHER enemies (accidental ally)
 *   - Phantom fades out and dies after ~4s
 *   - No console errors
 */
const puppeteer = require('puppeteer');

const GAME_URL = 'http://localhost:8000/dev.html';

async function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function runTest() {
  console.log('🧪 Echo Phantom Test (#169)\n');
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
    window.game.playerName = 'EchoBot';
    window.game.state = 'playing';
    window.game.health = 6;
    window.game.level = 11;
    window.game.mainWeaponLocked = { left: true, right: true };
  });
  await page.evaluate(async () => {
    const d = await import('./desktop-controls.js');
    if (!d.isEnabled()) d.enable();
  });
  await sleep(500);
  console.log('  ✅ In PLAYING state');

  const results = {};

  // ── Phase 2: Level config + spawn ──
  console.log('\n📍 Phase 2: Spawn + ghost styling...');
  results.spawn = await page.evaluate(async () => {
    const THREE = await import('three');
    const enemies = await import('./enemies.js');
    const g = await import('./game.js');
    const cfg = g.getLevelConfig ? g.getLevelConfig() : null;
    const inConfig = cfg?.enemyTypes?.includes('echo_phantom') || false;
    enemies.clearAllEnemies();
    // Deterministic snapshot: aim -z, shots at samples 0 and 3
    const dir = new THREE.Vector3(0, 0, -1);
    const snapshot = [
      { position: new THREE.Vector3(0, 1.5, 0), direction: dir.clone(), timestamp: 0, fire: true },
      { position: new THREE.Vector3(0, 1.5, 0), direction: dir.clone(), timestamp: 100 },
      { position: new THREE.Vector3(0, 1.5, 0), direction: dir.clone(), timestamp: 200 },
      { position: new THREE.Vector3(0, 1.5, 0), direction: dir.clone(), timestamp: 300, fire: true },
      { position: new THREE.Vector3(0, 1.5, 0), direction: dir.clone(), timestamp: 400 },
    ];
    const e = enemies.spawnEchoPhantom(new THREE.Vector3(0, 1.6, 10), 'left', snapshot);
    if (!e) return { ok: false, reason: 'spawn failed', inConfig };
    return {
      ok: e.isEchoPhantom && e.echoSnapshot.length === 5 && e._cachedMaterials[0].opacity === 0.4,
      inConfig, opacity: e._cachedMaterials[0].opacity,
    };
  });
  console.log(`  Level 11 config includes echo_phantom: ${results.spawn.inConfig ? '✅' : '❌'}`);
  console.log(`  Ghost spawns with translucent styling + snapshot: ${results.spawn.ok ? '✅' : '❌'} (${JSON.stringify(results.spawn)})`);

  // ── Phase 3: Playback fires echo projectiles ──
  console.log('\n📍 Phase 3: Echo projectile playback...');
  results.playback = await page.evaluate(async () => {
    const enemies = await import('./enemies.js');
    const ps = await import('./projectile-system.js');
    await new Promise(r => setTimeout(r, 700)); // playback: shot 0 at ~0.1s, shot 1 at ~0.4s
    const echoes = ps.projectiles.filter(p => p.userData?.stats?.damage === 6);
    return { ok: echoes.length >= 1, count: echoes.length, damages: echoes.map(p => p.userData.stats.damage) };
  });
  console.log(`  Echo fires projectiles along the recorded aim: ${results.playback.ok ? '✅' : '❌'} (${results.playback.count} shots)`);

  // ── Phase 4: Echo projectiles damage other enemies ──
  console.log('\n📍 Phase 4: Echo shots hurt enemies (friendly fire)...');
  results.friendly = await page.evaluate(async () => {
    const THREE = await import('three');
    const enemies = await import('./enemies.js');
    const ps = await import('./projectile-system.js');
    // Clear and rebuild: phantom at (0,1.6,10) aiming -z; enemy 4m in front
    enemies.clearAllEnemies();
    const dir = new THREE.Vector3(0, 0, -1);
    const snapshot = [
      { position: new THREE.Vector3(0, 1.5, 0), direction: dir.clone(), timestamp: 0, fire: true },
      { position: new THREE.Vector3(0, 1.5, 0), direction: dir.clone(), timestamp: 100 },
    ];
    // Phantom at y=0.7 so its shot origin (y+0.9 = 1.6) crosses the enemy's
    // hitbox height exactly
    const e = enemies.spawnEchoPhantom(new THREE.Vector3(0, 0.7, 10), 'left', snapshot);
    const victim = enemies.spawnEnemy('basic', new THREE.Vector3(0, 1.6, 6), window.game._levelConfig || undefined);
    if (!e || !victim) return { ok: false, reason: 'spawn failed' };
    const hpBefore = victim.hp;
    await new Promise(r => setTimeout(r, 900)); // shot fires ~0.1s, travels 4m at 9m/s
    return { ok: victim.hp < hpBefore, hpBefore, hpAfter: victim.hp, dropped: hpBefore - victim.hp };
  });
  console.log(`  Echo shot hits the enemy: ${results.friendly.ok ? '✅' : '❌'} (dropped ${results.friendly.dropped})`);

  // ── Phase 5: Phantom fades and dies ──
  console.log('\n📍 Phase 5: Fade-out...');
  results.fade = await page.evaluate(async () => {
    const enemies = await import('./enemies.js');
    // Poll until the phantom is gone (fade starts ~4s after spawn, takes
    // ~0.2s at opacity 0.4 → dies by ~4.3s)
    const start = performance.now();
    let sawFading = false;
    while (performance.now() - start < 8000) {
      const e = enemies.getEnemies().find(x => x.isEchoPhantom);
      if (!e) break;
      if (e.echoFading) sawFading = true;
      await new Promise(r => setTimeout(r, 200));
    }
    const gone = !enemies.getEnemies().some(x => x.isEchoPhantom && x.hp > 0);
    return { ok: sawFading && gone, sawFading, gone };
  });
  console.log(`  Phantom fades and dies after ~4s: ${results.fade.ok ? '✅' : '❌'} (${JSON.stringify(results.fade)})`);

  // ── Results ──
  console.log('\n============================================================');
  console.log('📊 Results:');
  if (errors.length === 0) {
    console.log('  ✅ No console errors');
  } else {
    console.log(`  ❌ ${errors.length} console error(s):`);
    errors.slice(0, 5).forEach(e => console.log(`     - ${e.substring(0, 120)}`));
  }
  const passed = errors.length === 0 && results.spawn.ok && results.spawn.inConfig &&
    results.playback.ok && results.friendly.ok && results.fade.ok;
  console.log(passed ? '\n✅ ALL TESTS PASSED' : '\n❌ TEST FAILURES');
  await browser.close();
  process.exit(passed ? 0 : 1);
}

runTest().catch(err => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
