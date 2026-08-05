/**
 * Test: Threat Compass (#206) — ground glow toward nearest dangers
 *
 *   - Compass mesh exists in the scene, hidden by default
 *   - Visible during PLAYING, hidden in non-play states (animate wiring)
 *   - Lobes computed from real enemy positions: count, angles match
 *     atan2(dz, dx) from the player, closest enemy is the strongest lobe
 *   - No enemies → zero lobes, no crash
 *   - Biome tint swaps the shader uniform
 *   - No console errors
 */
const puppeteer = require('puppeteer');

const GAME_URL = 'http://localhost:8001/dev.html';

async function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function runTest() {
  console.log('🧪 Threat Compass Test (#206)\n');
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
    window.game.playerName = 'CompassBot';
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

  // ── Phase 2: Mesh exists + visible during PLAYING, hidden elsewhere ──
  console.log('\n📍 Phase 2: Mesh existence + state visibility wiring...');
  await sleep(300); // let the loop run a few frames
  results.mesh = await page.evaluate(() => {
    const scene = window.__test?.getScene?.();
    const mesh = scene?.getObjectByName?.('threat-compass');
    if (!mesh) return { ok: false, reason: 'no mesh' };
    return { ok: true, visiblePlaying: mesh.visible, posY: mesh.position.y };
  });
  // Pause state must hide it (the animate loop calls setThreatCompassVisible
  // every frame with st === PLAYING)
  await page.evaluate(() => { window.game.state = 'paused'; });
  await sleep(400);
  const hiddenPaused = await page.evaluate(() => {
    const scene = window.__test?.getScene?.();
    return scene?.getObjectByName?.('threat-compass')?.visible === false;
  });
  await page.evaluate(() => { window.game.state = 'playing'; });
  await sleep(400);
  const visibleAgain = await page.evaluate(() => {
    const scene = window.__test?.getScene?.();
    return scene?.getObjectByName?.('threat-compass')?.visible === true;
  });
  console.log(`  Mesh exists + visible during PLAYING: ${results.mesh.ok && results.mesh.visiblePlaying ? '✅' : '❌'} (${JSON.stringify(results.mesh)})`);
  console.log(`  Hidden in PAUSED, back on resume: ${hiddenPaused && visibleAgain ? '✅' : '❌'}`);

  // ── Phase 3: Lobe math from real enemy positions ──
  console.log('\n📍 Phase 3: Lobe computation from enemies...');
  results.lobes = await page.evaluate(async () => {
    const THREE = await import('three');
    const enemies = await import('./enemies.js');
    const tc = await import('./threat-compass.js');
    enemies.clearAllEnemies();
    // Clear any dead enemies still in the list
    const camera = window.__test?.getCamera?.();
    const px = camera ? camera.position.x : 0;
    const pz = camera ? camera.position.z : 0;
    const cfg = window.game._levelConfig || undefined;

    // Close enemy 5m directly behind-left, far enemy 30m ahead-right
    const closePos = new THREE.Vector3(px - 3, 1.6, pz - 4); // behind-left, ~5m
    const farPos = new THREE.Vector3(px + 21, 1.6, pz + 21); // ahead-right, ~30m
    const close = enemies.spawnEnemy('fast', closePos, cfg);
    const far = enemies.spawnEnemy('basic', farPos, cfg);
    if (!close || !far) return { ok: false, reason: 'spawn failed' };

    tc.setThreatCompassVisible(true);
    tc.updateThreatCompass(0.016, performance.now());

    const scene = window.__test?.getScene?.();
    const mesh = scene.getObjectByName('threat-compass');
    const mat = mesh.material;
    const u = mat.uniforms;
    const lobes = u.uLobes.value;
    const count = u.uLobeCount.value;

    // Expected angles from the compass's own position (player XZ)
    const cx = mesh.position.x, cz = mesh.position.z;
    const closeAngle = Math.atan2(close.mesh.position.z - cz, close.mesh.position.x - cx);
    const farAngle = Math.atan2(far.mesh.position.z - cz, far.mesh.position.x - cx);
    const closeDist = Math.hypot(close.mesh.position.x - cx, close.mesh.position.z - cz);
    const farDist = Math.hypot(far.mesh.position.x - cx, far.mesh.position.z - cz);
    const closeIntensity = Math.max(0, 1 - closeDist / 40);
    const farIntensity = Math.max(0, 1 - farDist / 40);

    // Angle normalization helper (map to [-PI, PI] like atan2)
    const norm = (a) => { while (a > Math.PI) a -= Math.PI * 2; while (a < -Math.PI) a += Math.PI * 2; return a; };
    const diff = (a, b) => Math.abs(norm(a - b));

    const angles = [];
    const intensities = [];
    for (let i = 0; i < count; i++) {
      angles.push(lobes[i * 2]);
      intensities.push(lobes[i * 2 + 1]);
    }
    // The closest enemy must be the STRONGEST lobe (lobe 0)
    const closeIsStrongest = count >= 1 &&
      Math.min(...angles.map((a, i) => diff(a, closeAngle))) < 0.15 &&
      Math.min(...angles.map((a, i) => diff(a, farAngle))) < 0.15 &&
      Math.max(...intensities) >= closeIntensity - 0.05 &&
      intensities[0] >= closeIntensity - 0.05;
    // Close intensity > far intensity (closer = stronger)
    const ordering = intensities[0] > intensities[1];
    // Intensity values match the distance formula
    const closeMatches = Math.abs(intensities[0] - closeIntensity) < 0.05;
    const farMatches = count >= 2 && Math.abs(intensities[1] - farIntensity) < 0.05;

    enemies.clearAllEnemies();
    tc.updateThreatCompass(0.016, performance.now());
    const zeroOk = u.uLobeCount.value === 0;

    return { ok: closeIsStrongest && ordering && closeMatches && farMatches && zeroOk,
             count, angles: angles.map(a => +a.toFixed(3)), intensities: intensities.map(i => +i.toFixed(3)),
             closeAngle: +closeAngle.toFixed(3), farAngle: +farAngle.toFixed(3),
             closeIntensity: +closeIntensity.toFixed(3), farIntensity: +farIntensity.toFixed(3),
             closeIsStrongest, ordering, closeMatches, farMatches, zeroOk };
  });
  console.log(`  Both enemies produce lobes (${results.lobes.count}): ${
    results.lobes.count === 2 ? '✅' : '❌'} [${results.lobes.angles}]`);
  console.log(`  Angles match atan2 from player (close ${results.lobes.closeAngle} / far ${results.lobes.farAngle}): ${
    results.lobes.closeIsStrongest ? '✅' : '❌'}`);
  console.log(`  Closest enemy is the strongest lobe + intensity ordering: ${
    results.lobes.ordering && results.lobes.closeMatches && results.lobes.farMatches ? '✅' : '❌'} [${results.lobes.intensities}]`);
  console.log(`  Zero lobes after clearing arena: ${results.lobes.zeroOk ? '✅' : '❌'}`);

  // ── Phase 4: Biome tint ──
  console.log('\n📍 Phase 4: Biome tint...');
  results.tint = await page.evaluate(async () => {
    const tc = await import('./threat-compass.js');
    const scene = window.__test?.getScene?.();
    const mat = scene.getObjectByName('threat-compass').material;
    tc.setThreatCompassTheme('hellscape_lava');
    const lava = mat.uniforms.uTint.value.toArray().map(v => +v.toFixed(3));
    tc.setThreatCompassTheme('synthwave_valley');
    const synth = mat.uniforms.uTint.value.toArray().map(v => +v.toFixed(3));
    return {
      ok: lava[0] === 1.25 && lava[1] === 0.85 && lava[2] === 0.5 &&
          synth[0] === 1 && synth[1] === 0.6 && synth[2] === 1.15,
      lava, synth,
    };
  });
  console.log(`  Hellscape lava tint (1.25,0.85,0.5) + synthwave pink (1,0.6,1.15): ${
    results.tint.ok ? '✅' : '❌'} [${results.tint.lava}] [${results.tint.synth}]`);

  // ── Results ──
  console.log('\n============================================================');
  console.log('📊 Results:');
  if (errors.length === 0) {
    console.log('  ✅ No console errors');
  } else {
    console.log(`  ❌ ${errors.length} console error(s):`);
    errors.slice(0, 5).forEach(e => console.log(`     - ${e.substring(0, 120)}`));
  }
  const passed = errors.length === 0 && results.mesh.ok && results.mesh.visiblePlaying &&
    hiddenPaused && visibleAgain && results.lobes.ok && results.tint.ok;
  console.log(passed ? '\n✅ ALL TESTS PASSED' : '\n❌ TEST FAILURES');
  await browser.close();
  process.exit(passed ? 0 : 1);
}

runTest().catch(err => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
