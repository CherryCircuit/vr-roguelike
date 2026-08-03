/**
 * Test: Weapon Evolution (#143) — Phase A+B
 *
 *   - Recipe progress line shows on the upgrade screen (Twin Helix: 2/3 ●●○)
 *   - Selecting the final recipe piece triggers the cinematic INSTEAD of the
 *     post-select bar (state stays upgrade_select, evo-rig appears)
 *   - Cinematic completes → weapon evolved (state advanced, weaponEvolution
 *     set, controller core 30% larger + signature color, rig cleaned up)
 *   - Next upgrade screen shows the "EVOLVED" line
 *   - EVO badge appears on uncollected recipe cards (when offered)
 *   - resetGame() clears evolution state
 *   - No console errors throughout
 */
const puppeteer = require('puppeteer');

const GAME_URL = 'http://localhost:8000/dev.html';

async function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function runTest() {
  console.log('🧪 Weapon Evolution Test (#143)\n');
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

  // Aim the desktop camera at a named object, then click screen center.
  const aimAndClick = async (objName) => {
    const ok = await page.evaluate(async (name) => {
      const THREE = await import('three');
      const scene = window.__test?.getScene?.();
      const camera = window.__test?.getCamera?.();
      if (!scene || !camera) return false;
      const obj = scene.getObjectByName(name);
      if (!obj) return false;
      camera.updateMatrixWorld(true);
      const camPos = camera.position.clone();
      const target = new THREE.Vector3();
      obj.getWorldPosition(target);
      const dir = new THREE.Vector3().subVectors(target, camPos);
      if (dir.lengthSq() === 0) return false;
      dir.normalize();
      camera.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, -1), dir);
      camera.rotation.setFromQuaternion(camera.quaternion);
      return true;
    }, objName);
    if (!ok) return false;
    await sleep(300);
    await page.mouse.click(640, 400);
    await sleep(400);
    return true;
  };

  const sceneHas = (objName) => page.evaluate((name) => {
    const scene = window.__test?.getScene?.();
    return !!scene?.getObjectByName(name);
  }, objName);

  // Text sprites under the upgrade-cards group (userData.text)
  const upgradeScreenTexts = () => page.evaluate(() => {
    const scene = window.__test?.getScene?.();
    const group = scene?.getObjectByName('upgrade-cards');
    if (!group) return [];
    const texts = [];
    group.traverse(c => { if (c.userData && c.userData.text) texts.push(c.userData.text); });
    return texts;
  });

  const waitForUpgradeSelect = async (timeoutMs = 12000) => {
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
      const st = await page.evaluate(() => window.game?.state);
      if (st === 'upgrade_select') return true;
      await sleep(300);
    }
    return false;
  };

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
    window.game.playerName = 'EvoBot';
    window.game.state = 'playing';
    window.game.health = 6;
    window.game.level = 1;
    window.game.mainWeaponLocked = { left: true, right: true };
    window.game.mainWeapon = { left: 'standard_blaster', right: 'standard_blaster' };
  });
  await page.evaluate(async () => {
    const d = await import('./desktop-controls.js');
    if (!d.isEnabled()) d.enable();
  });
  await sleep(500);
  console.log('  ✅ In PLAYING state');

  // ── Phase 2: Progress line on upgrade screen ──
  console.log('\n📍 Phase 2: Recipe progress line + EVO badge...');
  await page.evaluate(() => {
    window.game.nextUpgradeHand = 'left';
    // Twin Helix recipe: scope + double_shot + critical (2/3 owned)
    window.game.upgrades = { left: { scope: 1, double_shot: 1 }, right: {} };
  });
  await page.evaluate(() => window.__test.progression.forceLevelComplete({ autoSelect: false }));
  await waitForUpgradeSelect();
  await sleep(1600);

  let texts = await upgradeScreenTexts();
  const progressLine = texts.some(t => /Twin Helix: 2\/3/.test(t));
  console.log(`  Progress line 'Twin Helix: 2/3 ●●○': ${progressLine ? '✅' : '❌'}`);
  if (!progressLine) console.log(`    got: ${texts.join(' | ')}`);

  // EVO badge: check the critical card if offered (uncollected recipe piece)
  const offered = await page.evaluate(() => window.__test.progression.getPendingUpgrades());
  const criticalIdx = offered.findIndex(s => s.id === 'critical');
  let badgeOk = 'skipped (critical not offered)';
  if (criticalIdx >= 0) {
    const hasBadge = await page.evaluate((idx) => {
      const scene = window.__test?.getScene?.();
      const card = scene?.getObjectByName(`upgrade-card-${idx}`);
      return !!(card && card.userData.evoBadge);
    }, criticalIdx);
    badgeOk = hasBadge ? true : false;
  }
  console.log(`  EVO badge on uncollected recipe card: ${badgeOk === true ? '✅' : badgeOk === false ? '❌' : badgeOk}`);

  // ── Phase 3: Select final piece → cinematic triggers ──
  console.log('\n📍 Phase 3: Final recipe card → cinematic...');
  // Deterministic: swap card 0's payload to 'critical' and click it
  const swapped = await page.evaluate(async () => {
    const w = await import('./weapons.js');
    const scene = window.__test?.getScene?.();
    const card = scene?.getObjectByName('upgrade-card-0');
    if (!card) return false;
    const critical = w.getUpgradeDef('critical');
    if (!critical) return false;
    const sel = { upgrade: critical, hand: 'left' };
    card.userData.upgradeSelection = sel;
    const face = card.children.find(c => c.userData && c.userData.isUpgradeCard);
    if (face) face.userData.upgradeSelection = sel;
    return true;
  });
  console.log(`  Card-0 payload swapped to Critical: ${swapped ? '✅' : '❌'}`);

  await aimAndClick('upgrade-card-0');
  await sleep(2600); // announce phase (2s) → rig spawns at gather start
  const afterPick = await page.evaluate(() => ({
    state: window.game.state,
    evo: window.game.weaponEvolution?.left?.id || null,
  }));
  const rigExists = await sceneHas('evo-rig');
  console.log(`  State=${afterPick.state} (should stay upgrade_select), evo=${afterPick.evo}, rig=${rigExists}`);
  const cinematicStarted = afterPick.state === 'upgrade_select' && afterPick.evo === 'twin_helix' && rigExists;
  console.log(`  Cinematic started instead of advancing: ${cinematicStarted ? '✅' : '❌'}`);

  // ── Phase 4: Cinematic completes → evolved + advanced ──
  console.log('\n📍 Phase 4: Cinematic completion...');
  // Full cinematic is ~10s (announce 2 + gather 1.5 + spin 3 + merge 1 + reveal 1.5 + return 1)
  const start = Date.now();
  let done = false;
  while (Date.now() - start < 16000) {
    const st = await page.evaluate(() => window.game.state);
    if (st !== 'upgrade_select') { done = true; break; }
    await sleep(500);
  }
  const afterCinematic = await page.evaluate(async () => {
    const THREE = await import('three');
    const scene = window.__test?.getScene?.();
    const camera = window.__test?.getCamera?.();
    const controller = window.__test?.getScene?.()?.getObjectByName('controller-visual-left');
    const core = controller?.children.find(c => c.name === 'controller-core-left');
    const rig = scene?.getObjectByName('evo-rig');
    return {
      state: window.game.state,
      level: window.game.level,
      evo: window.game.weaponEvolution?.left?.id || null,
      rigGone: !rig,
      coreScale: core ? core.scale.x : null,
      coreColor: core ? '#' + core.material.color.getHexString() : null,
      camera: !!camera,
    };
  });
  console.log(`  After cinematic: state=${afterCinematic.state} level=${afterCinematic.level} evo=${afterCinematic.evo}`);
  console.log(`  Rig cleaned up: ${afterCinematic.rigGone ? '✅' : '❌'} | core scale=${afterCinematic.coreScale} color=${afterCinematic.coreColor}`);
  const cinematicDone = done && afterCinematic.state === 'playing' && afterCinematic.level === 2 &&
                        afterCinematic.evo === 'twin_helix' && afterCinematic.rigGone &&
                        Math.abs(afterCinematic.coreScale - 1.3) < 0.01 &&
                        afterCinematic.coreColor === '#00ffff';
  console.log(`  Cinematic complete + evolved look: ${cinematicDone ? '✅' : '❌'}`);

  // ── Phase 5: Evolved line on next upgrade screen (LEFT hand = evolved) ──
  console.log('\n📍 Phase 5: Evolved progress line + reset...');
  await page.evaluate(() => { window.game.nextUpgradeHand = 'left'; });
  await page.evaluate(() => window.__test.progression.forceLevelComplete({ autoSelect: false }));
  await waitForUpgradeSelect();
  await sleep(1600);
  texts = await upgradeScreenTexts();
  const evolvedLine = texts.some(t => /TWIN HELIX EVOLVED/.test(t));
  console.log(`  'TWIN HELIX EVOLVED' line: ${evolvedLine ? '✅' : '❌'}`);

  // Select a card to leave the screen cleanly (right hand — not evolved)
  await page.evaluate(() => window.__test.progression.selectUpgradeByIndex(0));
  await sleep(400);
  await aimAndClick('alchemy-btn-continue');
  await sleep(1200);

  // Reset clears evolution state
  await page.evaluate(() => window.game.state = 'title');
  await sleep(500);
  await page.evaluate(() => {
    window.game.resetGame ? window.game.resetGame() : null;
  });
  // Dev.html exposes resetGame? Use progression restart instead
  await page.evaluate(() => window.__test.progression.runPlan({ segments: [{ levelCount: 1 }], autoUpgrades: 'first-card' }));
  await sleep(2500);
  const resetState = await page.evaluate(() => ({
    evo: window.game.weaponEvolution,
    state: window.game.state,
  }));
  const resetOk = resetState.evo.left === null && resetState.evo.right === null;
  console.log(`  Evolution state cleared on reset: ${resetOk ? '✅' : '❌'}`);
  const coreScaleAfterReset = await page.evaluate(() => {
    const scene = window.__test?.getScene?.();
    const controller = scene?.getObjectByName('controller-visual-left');
    const core = controller?.children.find(c => c.name === 'controller-core-left');
    return core ? core.scale.x : null;
  });
  console.log(`  Core scale restored (${coreScaleAfterReset}): ${Math.abs(coreScaleAfterReset - 1) < 0.01 ? '✅' : '❌'}`);

  // ── Results ──
  console.log('\n============================================================');
  console.log('📊 Results:');
  if (errors.length === 0) {
    console.log('  ✅ No console errors');
  } else {
    console.log(`  ❌ ${errors.length} console error(s):`);
    errors.slice(0, 5).forEach(e => console.log(`     - ${e.substring(0, 120)}`));
  }
  const passed = errors.length === 0 && progressLine && swapped && cinematicStarted && cinematicDone &&
                 evolvedLine && resetOk && coreScaleAfterReset !== null && Math.abs(coreScaleAfterReset - 1) < 0.01 &&
                 badgeOk !== false;
  console.log(passed ? '\n✅ ALL TESTS PASSED' : '\n❌ TEST FAILURES');
  await browser.close();
  process.exit(passed ? 0 : 1);
}

runTest().catch(err => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
