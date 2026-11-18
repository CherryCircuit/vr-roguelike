/**
 * Test: Training Ground VR input + round-8 regressions
 *
 *   - VR trigger during UPGRADE_SELECT does not crash ("getSandboxHit is not
 *     defined": the dead debug-sandbox call that survived the Training Ground
 *     commit 658fd3e) — both the selectstart path and the held-trigger poll
 *   - A controller still PICKS an upgrade card after that fix
 *   - Left/right blaster wrist displays share text size + positions
 *   - The holodeck training menu is operable from a CONTROLLER ray (the old
 *     code raycast the desktop centre camera, which is null in VR): pointer
 *     beam engages, WAVE SIZE steps, queue + GO spawns enemies
 *   - Holodeck grid material carries the AA/distance-fade uniforms
 *   - Bestiary backdrop arc is centred in FRONT of the player (-Z, x≈0)
 *
 * Run: node tests/automation/test-training-vr.cjs  (needs :8001 server)
 */
const puppeteer = require('puppeteer');

const URL = 'http://localhost:8001/dev.html';
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

(async () => {
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--use-angle=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist', '--disable-gpu-sandbox'],
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 720 });

  const errors = [];
  page.on('console', (msg) => {
    if (msg.type() !== 'error') return;
    const url = msg.location()?.url || '';
    if (url.includes('death-stats') || url.includes('favicon')) return;
    errors.push(msg.text());
  });
  page.on('pageerror', (err) => errors.push('pageerror: ' + err.message));

  const results = {};
  await page.goto(URL, { waitUntil: 'networkidle2', timeout: 20000 });
  await sleep(3500);

  // ── Get into PLAYING ──
  await page.evaluate(() => {
    window.game.state = 'playing';
    window.game.health = 6;
    window.game.level = 1;
    window.game.country = 'CA';
    window.game.playerName = 'VerifyBot';
  });
  await sleep(400);

  // ── 1. UPGRADE_SELECT + controller trigger must not throw ──
  console.log('\n📍 upgrade trigger crash');
  await page.evaluate(() => window.__test.progression.forceLevelComplete({ autoSelect: false }));
  for (let i = 0; i < 30; i++) {
    const st = await page.evaluate(() => window.game.state);
    if (st === 'upgrade_select') break;
    await sleep(300);
  }
  await sleep(1400); // warp + selection cooldown

  const beforeErrors = errors.length;
  // Fire the VR trigger with the ray pointing at nothing (the crash case).
  await page.evaluate(() => {
    const c = window.__test.getRenderer().xr.getController(0);
    c.position.set(0, 0, 0);
    c.quaternion.identity();
    c.updateMatrixWorld(true);
    c.dispatchEvent({ type: 'selectstart' });
    c.dispatchEvent({ type: 'selectend' });
  });
  await sleep(500);
  results.noTriggerCrash = errors.length === beforeErrors;
  // The held-trigger poll fallback in the render loop (the other crash path).
  await page.evaluate(() => {
    const c = window.__test.getRenderer().xr.getController(1);
    c.dispatchEvent({ type: 'selectstart' });
  });
  await sleep(800);
  await page.evaluate(() => {
    const c = window.__test.getRenderer().xr.getController(1);
    c.dispatchEvent({ type: 'selectend' });
  });
  results.noHeldTriggerCrash = errors.length === beforeErrors;
  results.stillInUpgradeSelect = await page.evaluate(() => window.game.state === 'upgrade_select');

  // Left/right blaster displays must share text sizes + positions (bug #4).
  results.wristParity = await page.evaluate(() => {
    const scene = window.__test.getScene();
    const grab = (name) => {
      const d = scene.getObjectByName(name);
      if (!d) return null;
      return d.children.filter(c => c.userData.isText).map(c => ({
        w: c.geometry.parameters.width,
        h: c.geometry.parameters.height,
        x: c.position.x,
        y: c.position.y,
      }));
    };
    const l = grab('blaster-display-left');
    const r = grab('blaster-display-right');
    if (!l || !r || l.length === 0 || l.length !== r.length) return { ok: false, l: l?.length, r: r?.length };
    const diffs = [];
    l.forEach((a, i) => {
      const b = r[i];
      if (Math.abs(a.h - b.h) > 1e-4 || Math.abs(a.y - b.y) > 1e-4 || Math.abs(a.x - b.x) > 1e-4) {
        diffs.push({ i, l: a, r: b });
      }
    });
    return { ok: diffs.length === 0, count: l.length, diffs: diffs.slice(0, 4) };
  }).catch(e => ({ ok: false, error: String(e) }));
  results.wristParityOk = results.wristParity?.ok === true;

  // Aim at card 0 and press: the pick must still work.
  const cardAim = await page.evaluate(() => {
    const scene = window.__test.getScene();
    const card = scene.getObjectByName('upgrade-card-0');
    if (!card) return null;
    const p = card.getWorldPosition(new (card.position.constructor)());
    return { x: p.x, y: p.y, z: p.z };
  });
  if (cardAim) {
    await page.evaluate((target) => {
      const c = window.__test.getRenderer().xr.getController(0);
      // Stand 1m in front of the card. Object3D.lookAt on a Group aims +Z, so
      // orient manually: the controller's aim ray is its local -Z.
      const origin = { x: target.x, y: target.y, z: target.z + 1 };
      c.matrixAutoUpdate = true; // XRController defaults to false (headerless pose write)
      c.position.set(origin.x, origin.y, origin.z);
      const dir = { x: target.x - origin.x, y: target.y - origin.y, z: target.z - origin.z };
      const len = Math.hypot(dir.x, dir.y, dir.z) || 1;
      const THREE_Quat = c.quaternion.constructor;
      const THREE_Vec = c.position.constructor;
      c.quaternion.copy(new THREE_Quat().setFromUnitVectors(
        new THREE_Vec(0, 0, -1), new THREE_Vec(dir.x / len, dir.y / len, dir.z / len)
      ));
      c.updateMatrixWorld(true);
      c.dispatchEvent({ type: 'selectstart' });
    }, cardAim);
    await sleep(1200);
    await page.evaluate(() => {
      const c = window.__test.getRenderer().xr.getController(0);
      c.dispatchEvent({ type: 'selectend' });
    });
    await sleep(600);
    results.cardPickWorks = await page.evaluate(() => window.game.state !== 'upgrade_select');
  } else {
    results.cardPickWorks = false;
    results.cardMissing = true;
  }

  // ── 2. Training menu via controller ──
  console.log('\n📍 training menu controller input');
  await page.evaluate(async () => {
    window.game.state = 'playing';
    const tg = await import('./training-ground.js');
    tg.startTraining();
    await tg.showTrainingMenu();
  });
  await sleep(900);
  results.trainingMenuOpen = await page.evaluate(async () => {
    const tg = await import('./training-ground.js');
    return tg.isTrainingMenuOpen() && tg.isTrainingActive();
  });

  // Pointer beam check: aim at a button, confirm the beam shortens + brightens.
  const aimAt = async (predicateSrc) => page.evaluate(async (src) => {
    const tg = await import('./training-ground.js');
    const scene = window.__test.getScene();
    const menu = scene.getObjectByName('training-menu');
    if (!menu) return null;
    const THREE_Vec = menu.position.constructor;
    const pred = new Function('action', `return (${src})(action);`);
    let target = null;
    menu.traverse((o) => {
      if (!target && o.userData?.trainingAction && pred(o.userData.trainingAction)) target = o;
    });
    if (!target) return null;
    const p = target.getWorldPosition(new THREE_Vec());
    return { action: target.userData.trainingAction, x: p.x, y: p.y, z: p.z };
  }, predicateSrc);

  const aimAndPress = async (target) => {
    await page.evaluate((t) => {
      const c = window.__test.getRenderer().xr.getController(0);
      c.matrixAutoUpdate = true;
      c.position.set(t.x, t.y, t.z + 1.0);
      // Controller aim ray is local -Z (Group.lookAt would aim +Z).
      const THREE_Quat = c.quaternion.constructor;
      const THREE_Vec = c.position.constructor;
      c.quaternion.copy(new THREE_Quat().setFromUnitVectors(
        new THREE_Vec(0, 0, -1), new THREE_Vec(0, 0, -1)
      ));
      c.updateMatrixWorld(true);
    }, target);
    await sleep(300); // let the pointer/hover pass run
    const beam = await page.evaluate(() => {
      const c = window.__test.getRenderer().xr.getController(0);
      const parts = c.userData.pointerParts;
      return parts ? { scaleZ: parts.aimLine.scale.z, opacity: parts.aimLine.material.opacity } : null;
    });
    await page.evaluate(() => {
      window.__test.getRenderer().xr.getController(0).dispatchEvent({ type: 'selectstart' });
    });
    await sleep(500);
    await page.evaluate(() => {
      window.__test.getRenderer().xr.getController(0).dispatchEvent({ type: 'selectend' });
    });
    await sleep(500);
    return beam;
  };

  const waveSizeBefore = await page.evaluate(async () => (await import('./training-ground.js')).getTrainingWaveSize());
  const plus5 = await aimAt('a => a.type === "wave_add" && a.amount === 5');
  results.foundWaveButton = !!plus5;
  if (plus5) {
    const beam = await aimAndPress(plus5);
    results.pointerBeam = !!beam && beam.opacity > 0.9 && beam.scaleZ < 0.5;
    results.pointerBeamData = beam;
    // Re-open the menu (rebuild happens inside the action) and read the size.
    await sleep(400);
    results.waveSizeChanged = await page.evaluate(async (before) => {
      const tg = await import('./training-ground.js');
      return tg.getTrainingWaveSize() === before + 5;
    }, waveSizeBefore);
  }

  // Queue 5 drones then GO: enemies must actually spawn.
  const queue = await aimAt('a => a.type === "queue_enemy" && a.id === "basic"');
  results.foundQueueButton = !!queue;
  if (queue) await aimAndPress(queue);
  await sleep(400);
  const goBtn = await aimAt('a => a.type === "go_wave"');
  results.foundGoButton = !!goBtn;
  if (goBtn) await aimAndPress(goBtn);
  await sleep(2600);
  results.menuClosedOnGo = await page.evaluate(async () => !(await import('./training-ground.js')).isTrainingMenuOpen());
  results.enemiesSpawned = await page.evaluate(() => (window.__test.getEnemyCount?.() || 0) > 0);
  results.enemyCount = await page.evaluate(() => window.__test.getEnemyCount?.() || 0);

  // ── 3. Holodeck grid material ──
  results.gridAA = await page.evaluate(() => {
    const floor = window.__test.getScene().getObjectByName('holodeck-floor');
    const u = floor?.material?.uniforms;
    return !!(u && u.uFadeStart && u.uFadeEnd && u.uLinePx && u.uAlpha);
  });

  // ── 4. Bestiary backdrop centred in front of the player ──
  console.log('\n📍 bestiary backdrop');
  await page.evaluate(async () => {
    const tg = await import('./training-ground.js');
    tg.exitTraining();
    const hud = await import('./hud.js');
    hud.showBestiary(window.__test.getCamera().position);
  });
  await sleep(600);
  const bg = await page.evaluate(() => {
    const mesh = window.__test.getScene().getObjectByName('bestiary-background-panel');
    if (!mesh) return null;
    const pos = mesh.geometry.attributes.position;
    let sx = 0, sz = 0;
    for (let i = 0; i < pos.count; i++) { sx += pos.getX(i); sz += pos.getZ(i); }
    return { meanX: sx / pos.count, meanZ: sz / pos.count, count: pos.count };
  });
  results.bestiaryBackdropCentred = !!bg && Math.abs(bg.meanX) < 1 && bg.meanZ < -3;
  results.bestiaryBackdropData = bg;

  // ── Report ──
  console.log('\n── Results ──');
  let failed = 0;
  for (const [k, v] of Object.entries(results)) {
    // Only booleans are assertions; the rest are debug payloads printed below.
    if (typeof v !== 'boolean') continue;
    console.log(`${v ? '✅' : '❌'} ${k}`);
    if (!v) failed++;
  }
  console.log('data:', JSON.stringify(results, null, 2));
  console.log(`\nconsole errors (${errors.length}):`);
  errors.slice(0, 12).forEach(e => console.log('  •', e));

  if (failed || errors.length) {
    await page.screenshot({ path: 'tests/automation/training-vr-fail.png' });
    console.log('\n❌ TEST FAILURES');
  } else {
    console.log('\n✅ ALL TESTS PASSED');
  }
  await browser.close();
  process.exit(failed || errors.length ? 1 : 0);
})();


