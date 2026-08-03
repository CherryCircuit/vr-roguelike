/**
 * Test: Reactive Music Layer (#142) + Threat Spatial Audio (#184).
 *
 * The render loop re-drives both systems every frame with real game state,
 * so the test drives the REAL game rather than fighting the loop:
 *
 * Threat audio (title screen, PLAYING loop not running):
 *   - enemies inside their profile range get pooled HRTF emitters
 *   - out-of-range and dead enemies are reaped
 *   - emitter count caps at MAX_THREAT_EMITTERS (10)
 *
 * Reactive music (game forced to PLAYING, real enemies spawned):
 *   - percussion rises with enemy count (combat)
 *   - BPM glides toward the frenzy target with many enemies
 *   - intensity rises on boss presence
 *   - stems duck to silence outside gameplay states
 *   - stopReactiveMusic() sticks (render loop does not restart it)
 */
const puppeteer = require('puppeteer');

const GAME_URL = 'http://localhost:8000/dev.html';

async function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function runTest() {
  console.log('🧪 Audio Pack Test (Reactive Music + Threat Audio)\n');
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
    const isBenign = text.includes('favicon') || text.includes('GroupMarker') ||
                     text.includes('AudioContext') || text.includes('Pointer lock') ||
                     text.includes('Autoplay');
    if (type === 'error' && !isBenign) {
      errors.push(text);
      console.log(`  ❌ Console error: ${text.substring(0, 150)}`);
    }
  });
  page.on('pageerror', err => {
    errors.push(`PageError: ${err.message}`);
    console.log(`  💥 Page error: ${err.message.substring(0, 150)}`);
  });

  console.log('\n📍 Phase 1: Load game...');
  await page.goto(GAME_URL, { waitUntil: 'networkidle2', timeout: 15000 });
  await sleep(3000);
  console.log('  ✅ Loaded');

  await page.evaluate(async () => {
    window.__audio = await import('./audio.js');
    window.__enemies = await import('./enemies.js');
  });

  // ── Phase 2: Threat audio — emitter pooling (title screen) ──
  console.log('\n📍 Phase 2: Threat audio — emitter pooling...');
  // NOTE: fakes must be built INSIDE page.evaluate — puppeteer serializes
  // arguments, which would strip methods like distanceTo.
  await page.evaluate(() => {
    const vec = (x, y, z) => ({ x, y, z, distanceTo: (v) => Math.hypot(x - v.x, y - v.y, z - v.z) });
    const playerPos = vec(0, 1.6, 0);
    const cam = { position: { x: 0, y: 1.6, z: 0 }, quaternion: { x: 0, y: 0, z: 0, w: 1 } };
    const enemy = (id, type, x, z) => ({ id, type, hp: 100, mesh: { position: vec(x, 1.6, z) } });
    window.__threatFixtures = { vec, playerPos, cam, enemy };
  });

  // Tank at 3m (in range 7), basic at 20m (out of range 6) → only tank emits
  await page.evaluate(() => {
    const { playerPos, cam, enemy } = window.__threatFixtures;
    window.__audio.updateThreatAudio(0.1, [enemy(1, 'tank', 0, -3), enemy(2, 'basic', 0, -20)], playerPos, cam);
  });
  let count = await page.evaluate(() => window.__audio.getActiveThreatEmitterCount());
  console.log(`  Tank in range + basic out of range → emitters: ${count} (expect 1)`);
  if (count !== 1) {
    console.log('  ❌ Range filtering failed');
    await browser.close();
    process.exit(1);
  }

  // Bring basic into range → 2 emitters
  await page.evaluate(() => {
    const { playerPos, cam, enemy } = window.__threatFixtures;
    window.__audio.updateThreatAudio(0.1, [enemy(1, 'tank', 0, -3), enemy(2, 'basic', 0, -4)], playerPos, cam);
  });
  count = await page.evaluate(() => window.__audio.getActiveThreatEmitterCount());
  console.log(`  Both in range → emitters: ${count} (expect 2)`);
  if (count !== 2) {
    console.log('  ❌ Emitter creation failed');
    await browser.close();
    process.exit(1);
  }

  // Remove basic → reaped
  await page.evaluate(() => {
    const { playerPos, cam, enemy } = window.__threatFixtures;
    window.__audio.updateThreatAudio(0.1, [enemy(1, 'tank', 0, -3)], playerPos, cam);
  });
  count = await page.evaluate(() => window.__audio.getActiveThreatEmitterCount());
  console.log(`  Basic removed → emitters: ${count} (expect 1)`);
  if (count !== 1) {
    console.log('  ❌ Dead-enemy reaping failed');
    await browser.close();
    process.exit(1);
  }

  // Dead enemy (hp 0) also reaped
  await page.evaluate(() => {
    const { playerPos, cam } = window.__threatFixtures;
    const dead = { id: 1, type: 'tank', hp: 0, mesh: { position: { x: 0, y: 1.6, z: -3, distanceTo: () => 3 } } };
    window.__audio.updateThreatAudio(0.1, [dead], playerPos, cam);
  });
  count = await page.evaluate(() => window.__audio.getActiveThreatEmitterCount());
  console.log(`  Dead tank → emitters: ${count} (expect 0)`);
  if (count !== 0) {
    console.log('  ❌ Dead-enemy reaping failed (hp 0)');
    await browser.close();
    process.exit(1);
  }

  // Pool cap: 12 enemies in range → max 10 emitters
  await page.evaluate(() => {
    const { playerPos, cam, vec } = window.__threatFixtures;
    const swarm = [];
    for (let i = 1; i <= 12; i++) {
      const angle = (i / 12) * Math.PI * 2;
      const x = Math.sin(angle) * 3;
      const z = -Math.cos(angle) * 3;
      swarm.push({ id: i, type: 'basic', hp: 100, mesh: { position: vec(x, 1.6, z) } });
    }
    window.__audio.updateThreatAudio(0.1, swarm, playerPos, cam);
  });
  count = await page.evaluate(() => window.__audio.getActiveThreatEmitterCount());
  console.log(`  12 enemies in range → emitters: ${count} (cap 10)`);
  if (count > 10) {
    console.log('  ❌ Emitter pool cap exceeded');
    await browser.close();
    process.exit(1);
  }
  await page.evaluate(() => {
    const { playerPos, cam } = window.__threatFixtures;
    window.__audio.updateThreatAudio(0.1, [], playerPos, cam);
  });

  // ── Phase 3: Start a real game (PLAYING) ──
  console.log('\n📍 Phase 3: Start game (PLAYING)...');
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
    window.game.playerName = 'TestBot';
    window.game.state = 'playing';
    window.game.health = 6;
    window.game.maxHealth = 6;
    window.game.level = 1;
    window.game.nukes = 3;
  });
  await sleep(500);
  console.log('  ✅ Playing');

  const spawnEnemies = (n) => page.evaluate((count) => {
    const enemies = window.__enemies;
    const cfg = { hpMultiplier: 1, speedMultiplier: 1 };
    for (let i = 0; i < count; i++) {
      const pos = enemies.getSpawnPosition(false, 0);
      enemies.spawnEnemy('basic', pos, cfg);
    }
  }, n);

  // ── Phase 4: Reactive music — combat (5 enemies) ──
  console.log('\n📍 Phase 4: Reactive music — combat state...');
  await spawnEnemies(5);
  await sleep(1600); // let BPM glide + crossfade settle
  let state = await page.evaluate(() => window.__audio.getReactiveMusicState());
  console.log(`  Combat — bpm: ${state.bpm}, percussion: ${state.stems.percussion}`);
  const combatOk = state.stems.percussion > 0.05 && state.bpm > 105;
  console.log(`  Combat stem targets: ${combatOk ? '✅' : '❌'}`);

  // ── Phase 5: Reactive music — frenzy (10 more enemies) ──
  console.log('\n📍 Phase 5: Reactive music — frenzy state...');
  await spawnEnemies(10);
  await sleep(1600);
  state = await page.evaluate(() => window.__audio.getReactiveMusicState());
  console.log(`  Frenzy — bpm: ${state.bpm}, percussion: ${state.stems.percussion}`);
  const frenzyOk = state.stems.percussion > 0.12 && state.bpm > 115;
  console.log(`  Frenzy stem targets: ${frenzyOk ? '✅' : '❌'}`);

  // ── Phase 6: Reactive music — boss intensity ──
  console.log('\n📍 Phase 6: Reactive music — boss intensity...');
  await page.evaluate(() => {
    window.game.health = 6; // survive the boss spawn
    window.__enemies.spawnBoss('skull_boss', { hpMultiplier: 1, speedMultiplier: 1 });
  });
  await sleep(1200);
  state = await page.evaluate(() => window.__audio.getReactiveMusicState());
  console.log(`  Boss — bpm: ${state.bpm}, intensity: ${state.stems.intensity}, ambient: ${state.stems.ambient}`);
  const bossOk = state.stems.intensity > 0.1;
  console.log(`  Boss stem targets: ${bossOk ? '✅' : '❌'}`);
  await page.evaluate(() => window.__enemies.clearBoss());

  // ── Phase 7: Reactive music — duck outside gameplay ──
  console.log('\n📍 Phase 7: Reactive music — duck on non-playing state...');
  await page.evaluate(() => { window.game.state = 'level_complete'; });
  await sleep(1200);
  state = await page.evaluate(() => window.__audio.getReactiveMusicState());
  console.log(`  Ducked stems: ${JSON.stringify(state.stems)}`);
  const duckOk = state.stems.percussion < 0.03 && state.stems.melody < 0.03 && state.stems.intensity < 0.03;
  console.log(`  Duck targets: ${duckOk ? '✅' : '❌'}`);

  // ── Phase 8: Reactive music — stop ──
  console.log('\n📍 Phase 8: Reactive music — stop...');
  await page.evaluate(() => window.__audio.stopReactiveMusic());
  await sleep(600);
  state = await page.evaluate(() => window.__audio.getReactiveMusicState());
  console.log(`  Running after stop: ${state.running}`);
  const stopOk = state.running === false;
  console.log(`  Stop: ${stopOk ? '✅' : '❌'}`);

  // ── Results ──
  console.log('\n============================================================');
  console.log('📊 Results:');
  if (errors.length === 0) {
    console.log('  ✅ No console errors');
  } else {
    console.log(`  ❌ ${errors.length} console error(s):`);
    errors.slice(0, 5).forEach(e => console.log(`     - ${e.substring(0, 120)}`));
  }
  const passed = errors.length === 0 && combatOk && frenzyOk && bossOk && duckOk && stopOk;
  console.log(passed ? '\n✅ ALL TESTS PASSED' : '\n❌ TEST FAILURES');
  await browser.close();
  process.exit(passed ? 0 : 1);
}

runTest().catch(err => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
