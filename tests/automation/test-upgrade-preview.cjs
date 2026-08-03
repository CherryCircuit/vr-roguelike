/**
 * Test: Upgrade Card Preview (#215)
 *
 *   - Level 1 MAIN weapon choice cards show a stat-delta preview panel on hover
 *   - Normal upgrade cards show stat deltas + synergy hints + DPS estimate
 *   - Hovering a different card rebuilds the panel
 *   - Hovering SKIP hides the panel
 *   - Panel is gone after selection (no leaks, no console errors)
 */
const puppeteer = require('puppeteer');

const GAME_URL = 'http://localhost:8000/dev.html';

async function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function runTest() {
  console.log('🧪 Upgrade Card Preview Test (#215)\n');
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

  // Read the preview panel's text sprites (userData.text set by the panel builder).
  const getPanelTexts = () => page.evaluate(() => {
    const scene = window.__test?.getScene?.();
    if (!scene) return null;
    const panel = scene.getObjectByName('upgrade-preview-panel');
    if (!panel) return null;
    const texts = [];
    panel.traverse(c => { if (c.userData && c.userData.text) texts.push(c.userData.text); });
    return texts;
  });

  // Desktop aiming ray is CAMERA-CENTER based (getAimRaycaster uses
  // setFromCamera({x:0,y:0})) — the mouse position never drives hover.
  // To hover a card we point the camera at it.
  const aimCameraAt = (cardName) => page.evaluate(async (name) => {
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
  }, cardName);

  const hoverCard = async (cardName) => {
    // Retry once: if the aim lands mid card-warp the card can move before
    // the hover ray fires, leaving the ray aimed at empty space.
    for (let attempt = 0; attempt < 2; attempt++) {
      const ok = await aimCameraAt(cardName);
      if (!ok) return false;
      await sleep(500); // hover pass (30Hz throttle) + panel build
      const hover = await getHoverState();
      if (hover && Object.keys(hover).length > 0) return true;
    }
    return false;
  };

  const isUpgradeSelect = () => page.evaluate(() =>
    window.game?.state === (window.State?.UPGRADE_SELECT || 'upgrade_select')
  );

  // Debug: which card the hover system actually registered per input source.
  const getHoverState = () => page.evaluate(() => {
    const scene = window.__test?.getScene?.();
    const group = scene?.getObjectByName('upgrade-cards');
    if (!group) return null;
    const sel = group.userData?.hoveredSelections || {};
    const out = {};
    for (const k of Object.keys(sel)) out[k] = sel[k]?.upgrade?.id || 'none';
    return out;
  });

  // LEVEL_COMPLETE runs a fade timer before showUpgradeScreen — poll for the
  // upgrade screen instead of guessing the delay.
  const waitForUpgradeSelect = async (timeoutMs = 12000) => {
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
      if (await isUpgradeSelect()) return true;
      await sleep(300);
    }
    return false;
  };

  // ── Phase 1: Load + PLAYING ──
  console.log('\n📍 Phase 1: Load game...');
  await page.goto(GAME_URL, { waitUntil: 'networkidle2', timeout: 15000 });
  await sleep(3000);
  console.log('  ✅ Loaded');

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
    window.game.playerName = 'PreviewBot';
    window.game.state = 'playing';
    window.game.health = 6;
    window.game.level = 1;
    window.game.mainWeaponLocked = { left: false, right: false };
  });
  await page.evaluate(async () => {
    const d = await import('./desktop-controls.js');
    if (!d.isEnabled()) d.enable();
  });
  await sleep(500);
  console.log('  ✅ In PLAYING state');

  // ── Phase 2: MAIN weapon choice cards (level 1→2) ──
  console.log('\n📍 Phase 2: MAIN weapon choice preview...');
  const lvl1 = await page.evaluate(() => window.__test.progression.forceLevelComplete({ autoSelect: false }));
  console.log(`  Force level complete: state=${lvl1.state}`);
  const gotUpgradeScreen = await waitForUpgradeSelect();
  console.log(`  Upgrade screen: ${gotUpgradeScreen ? '✅' : '❌'}`);
  await sleep(1600); // card warp intro (~420ms + stagger) + selection cooldown

  const mainSummaries = await page.evaluate(() => window.__test.progression.getPendingUpgrades());
  console.log(`  Offered: ${mainSummaries.slice(0, 3).map(s => s.name).join(', ')}`);
  const mainCardOk = mainSummaries.length >= 3 && mainSummaries[0].type === 'main';
  console.log(`  MAIN weapon cards shown: ${mainCardOk ? '✅' : '❌'}`);

  // Hover first main weapon card → panel with stat deltas
  const hovered1 = await hoverCard('upgrade-card-0');
  console.log(`  Hover card 0: ${hovered1 ? '✅' : '❌ (aim failed)'}`);
  let texts = await getPanelTexts();
  console.log(`  Panel texts: ${texts ? texts.join(' | ') : 'NO PANEL'}`);
  console.log(`  Hover state: ${JSON.stringify(await getHoverState())}`);
  const panelOnWeapon = texts && texts.length >= 3 && texts.some(t => /DMG|FIRE RATE|SHOTS/.test(t)) && texts.some(t => /DPS/.test(t));
  console.log(`  Panel shows stats + DPS: ${panelOnWeapon ? '✅' : '❌'}`);

  // Hover different card → panel rebuilds (name changes)
  const mainName0 = texts ? texts[0] : '';
  await hoverCard('upgrade-card-1');
  texts = await getPanelTexts();
  console.log(`  Hover state after card-1: ${JSON.stringify(await getHoverState())}`);
  const panelRebuilt = texts && texts[0] !== mainName0 && texts.length >= 3;
  console.log(`  Panel rebuilds on new card (${mainName0} → ${texts ? texts[0] : 'none'}): ${panelRebuilt ? '✅' : '❌'}`);

  // Hover SKIP → panel hides
  await hoverCard('upgrade-card-3');
  texts = await getPanelTexts();
  const panelHiddenOnSkip = texts === null;
  console.log(`  Panel hidden on SKIP hover: ${panelHiddenOnSkip ? '✅' : '❌'}`);

  // Select first offered main weapon → post-select bar → CONTINUE → advance
  await page.evaluate(() => window.__test.progression.selectUpgradeByIndex(0));
  await sleep(500);
  const postBar = await page.evaluate(async () => {
    const THREE = await import('three');
    const scene = window.__test?.getScene?.();
    const camera = window.__test?.getCamera?.();
    const btn = scene?.getObjectByName('alchemy-btn-continue');
    if (!btn || !camera) return 'missing';
    camera.updateMatrixWorld(true);
    const camPos = camera.position.clone();
    const target = new THREE.Vector3();
    btn.getWorldPosition(target);
    const dir = new THREE.Vector3().subVectors(target, camPos);
    if (dir.lengthSq() === 0) return 'nulldir';
    dir.normalize();
    camera.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, -1), dir);
    camera.rotation.setFromQuaternion(camera.quaternion);
    return 'aimed';
  });
  await sleep(300);
  await page.mouse.click(640, 400); // CONTINUE on the post-select bar
  await sleep(1500);
  const afterPick = await page.evaluate(() => ({ state: window.game.state, level: window.game.level }));
  const UPGRADE_SELECT = await page.evaluate(() => window.State?.UPGRADE_SELECT || 'upgrade_select');
  console.log(`  Post-select bar: ${postBar} — After CONTINUE: state=${afterPick.state} level=${afterPick.level}`);
  const pickedOk = afterPick.level === 2 && afterPick.state !== UPGRADE_SELECT;
  texts = await getPanelTexts();
  console.log(`  Advanced to level 2: ${pickedOk ? '✅' : '❌'}, panel gone: ${texts === null ? '✅' : '❌'}`);

  // ── Phase 3: Normal upgrades + synergy hint ──
  console.log('\n📍 Phase 3: Normal upgrade preview + synergy hint...');
  await page.evaluate(() => {
    window.game.nextUpgradeHand = 'left';
    window.game.upgrades = { left: { freeze: 1 }, right: {} };
    window.__test.recomputeSynergies();
  });
  const lvl2 = await page.evaluate(() => window.__test.progression.forceLevelComplete({ autoSelect: false }));
  console.log(`  Force level complete: state=${lvl2.state} (hand=left, owns freeze)`);
  const gotUpgradeScreen2 = await waitForUpgradeSelect();
  console.log(`  Upgrade screen: ${gotUpgradeScreen2 ? '✅' : '❌'}`);
  await sleep(1600);

  const upgradeSummaries = await page.evaluate(() => window.__test.progression.getPendingUpgrades());
  const offered = upgradeSummaries.filter(s => s.index !== 'skip').slice(0, 3);
  console.log(`  Offered: ${offered.map(s => s.name).join(', ')}`);

  // Deterministic synergy-hint check: swap card 0's payload to a FIRE upgrade.
  // The hand owns freeze (set above), so the panel MUST show a Thermal Shock
  // hint. This exercises the real hover → preview path; only the card payload
  // is replaced (the HUD reads selection metadata via resolveUpgradeSelectionFromObject).
  const swapped = await page.evaluate(async () => {
    const w = await import('./weapons.js');
    const scene = window.__test?.getScene?.();
    const card = scene?.getObjectByName('upgrade-card-0');
    if (!card) return false;
    const fire = w.getUpgradeDef('fire');
    if (!fire) return false;
    const sel = { upgrade: fire, hand: 'left' };
    card.userData.upgradeSelection = sel;
    const face = card.children.find(c => c.userData && c.userData.isUpgradeCard);
    if (face) face.userData.upgradeSelection = sel;
    return true;
  });
  console.log(`  Card-0 payload swapped to Fire: ${swapped ? '✅' : '❌'}`);

  await hoverCard('upgrade-card-0');
  texts = await getPanelTexts();
  console.log(`  Panel for Fire (owns freeze): ${texts ? texts.join(' | ') : 'NO PANEL'}`);
  const hasSynergyHint = texts && texts.some(t => t.includes('NEW SYNERGY'));
  const hasDps = texts && texts.some(t => t.includes('EST KILLS/S'));
  console.log(`  Synergy hint shown: ${hasSynergyHint ? '✅' : '❌'}`);
  console.log(`  DPS + kill estimate shown: ${hasDps ? '✅' : '❌'}`);

  // Hover away to SKIP → panel hides again
  await hoverCard('upgrade-card-3');
  texts = await getPanelTexts();
  console.log(`  Panel hidden on SKIP (2): ${texts === null ? '✅' : '❌'}`);

  // Select via API to close cleanly
  await page.evaluate(() => window.__test.progression.selectUpgradeByIndex(0));
  await sleep(1200);

  // ── Results ──
  console.log('\n============================================================');
  console.log('📊 Results:');
  if (errors.length === 0) {
    console.log('  ✅ No console errors');
  } else {
    console.log(`  ❌ ${errors.length} console error(s):`);
    errors.slice(0, 5).forEach(e => console.log(`     - ${e.substring(0, 120)}`));
  }
  const passed = errors.length === 0 && mainCardOk && hovered1 && panelOnWeapon && panelRebuilt &&
                 panelHiddenOnSkip && pickedOk && hasSynergyHint && hasDps;
  console.log(passed ? '\n✅ ALL TESTS PASSED' : '\n❌ TEST FAILURES');
  await browser.close();
  process.exit(passed ? 0 : 1);
}

runTest().catch(err => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
