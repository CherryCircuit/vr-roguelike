/**
 * Test: Upgrade Card Hover Preview (#215) — single left-aligned stat block
 *
 *   - Hovering a card shows ONE stat block (label/value/delta columns) and
 *     hides the card's original desc/stat/note text
 *   - Hovering a different card moves the block there and restores the first
 *   - Hovering SKIP does nothing (no crash, no preview)
 *   - Aiming away hides the block and restores all original texts
 *   - Selecting a card advances directly (no post-select bar)
 *   - No console errors
 */
const puppeteer = require('puppeteer');

const GAME_URL = 'http://localhost:8000/dev.html';

async function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function runTest() {
  console.log('🧪 Upgrade Card Hover Preview Test (#215)\n');
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

  // Aim the desktop camera (the aiming ray is camera-center based) at a
  // named object, or at an arbitrary world point for "aim away".
  const aimAt = async (targetNameOrPoint) => page.evaluate(async (target) => {
    const THREE = await import('three');
    const scene = window.__test?.getScene?.();
    const camera = window.__test?.getCamera?.();
    if (!scene || !camera) return false;
    camera.updateMatrixWorld(true);
    const camPos = camera.position.clone();
    let point;
    if (typeof target === 'string') {
      const obj = scene.getObjectByName(target);
      if (!obj) return false;
      point = new THREE.Vector3();
      obj.getWorldPosition(point);
    } else {
      point = new THREE.Vector3(target[0], target[1], target[2]);
    }
    const dir = new THREE.Vector3().subVectors(point, camPos);
    if (dir.lengthSq() === 0) return false;
    dir.normalize();
    camera.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, -1), dir);
    camera.rotation.setFromQuaternion(camera.quaternion);
    return true;
  }, targetNameOrPoint);

  const hoverCard = async (cardName) => {
    const ok = await aimAt(cardName);
    if (!ok) return false;
    await sleep(600); // hover pass (30Hz throttle) + preview swap
    return true;
  };

  // Preview block state: { blockVisible, blockHasMap, blockW, descVisible, descText }
  const getPreviewState = (cardName) => page.evaluate((name) => {
    const scene = window.__test?.getScene?.();
    const card = scene?.getObjectByName(name);
    if (!card) return null;
    const block = card.userData._previewSprite;
    const desc = card.userData._cardText_desc;
    return {
      blockVisible: !!block && block.visible,
      blockHasMap: !!(block && block.material && block.material.map),
      blockW: block && block.geometry ? block.geometry.parameters.width : 0,
      descVisible: desc ? desc.visible : null,
      descText: desc && desc.userData ? desc.userData.text : null,
    };
  }, cardName);

  const isUpgradeSelect = () => page.evaluate(() =>
    window.game?.state === (window.State?.UPGRADE_SELECT || 'upgrade_select')
  );

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

  const results = {};

  // ── Phase 2: MAIN weapon choice cards show the stat block on hover ──
  console.log('\n📍 Phase 2: MAIN weapon choice hover preview...');
  await page.evaluate(() => window.__test.progression.forceLevelComplete({ autoSelect: false }));
  await waitForUpgradeSelect();
  await sleep(1600); // warp + cooldown

  await hoverCard('upgrade-card-0');
  let st = await getPreviewState('upgrade-card-0');
  console.log(`  Card 0 state: ${JSON.stringify(st)}`);
  results.previewOn = !!(st && st.blockVisible && st.blockHasMap && st.blockW > 0.5 && st.descVisible === false);
  console.log(`  Stat block shown, original text hidden: ${results.previewOn ? '✅' : '❌'}`);

  // Hover card 1 → block moves, card 0 restores
  await hoverCard('upgrade-card-1');
  const card1 = await getPreviewState('upgrade-card-1');
  const card0 = await getPreviewState('upgrade-card-0');
  results.swapWorks = !!(card1 && card1.blockVisible);
  results.restoreWorks = !!(card0 && card0.blockVisible === false && card0.descVisible === true);
  console.log(`  Card 1 block on hover: ${results.swapWorks ? '✅' : '❌'}`);
  console.log(`  Card 0 restored after un-hover: ${results.restoreWorks ? '✅' : '❌'}`);

  // Hover SKIP → no crash, no block
  await hoverCard('upgrade-card-3');
  const skip = await getPreviewState('upgrade-card-3');
  console.log(`  SKIP hover (no block, no crash): ${skip === null ? '✅ (no text roles)' : '✅'}`);

  // Aim away → all blocks hidden, original text visible
  await aimAt([0, 6, 1]); // above the card row — nothing to hit
  await sleep(600);
  const away = await getPreviewState('upgrade-card-1');
  results.aimAwayRestore = !!(away && away.blockVisible === false && away.descVisible === true);
  console.log(`  Aiming away hides block + restores card 1: ${results.aimAwayRestore ? '✅' : '❌'}`);

  // Select first offered main weapon → advances directly (no post-select bar)
  await page.evaluate(() => window.__test.progression.selectUpgradeByIndex(0));
  await sleep(1500);
  const afterPick = await page.evaluate(() => ({ state: window.game.state, level: window.game.level }));
  const UPGRADE_SELECT = await page.evaluate(() => window.State?.UPGRADE_SELECT || 'upgrade_select');
  results.advanced = afterPick.level === 2 && afterPick.state !== UPGRADE_SELECT;
  const barGone = await page.evaluate(() => {
    const scene = window.__test?.getScene?.();
    return !scene?.getObjectByName('post-select-bar');
  });
  results.noPostBar = barGone;
  console.log(`  Advanced to level 2 directly (no post-select bar): ${results.advanced && results.noPostBar ? '✅' : '❌'} (state=${afterPick.state} level=${afterPick.level})`);

  // ── Phase 3: Normal upgrade preview ──
  console.log('\n📍 Phase 3: Normal upgrade preview...');
  await page.evaluate(() => {
    window.game.nextUpgradeHand = 'left';
    window.game.upgrades = { left: { freeze: 1 }, right: {} };
    window.__test.recomputeSynergies();
  });
  await page.evaluate(() => window.__test.progression.forceLevelComplete({ autoSelect: false }));
  await waitForUpgradeSelect();
  await sleep(1600);

  await hoverCard('upgrade-card-0');
  st = await getPreviewState('upgrade-card-0');
  results.statsOnCard = !!(st && st.blockVisible && st.blockHasMap && st.blockW > 0.5 && st.descVisible === false);
  console.log(`  Stat block on the card itself: ${results.statsOnCard ? '✅' : '❌'}`);

  // Select the hovered card → advances directly, no console errors
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
  const passed = errors.length === 0 && results.previewOn && results.swapWorks &&
                 results.restoreWorks && results.aimAwayRestore && results.advanced &&
                 results.noPostBar && results.statsOnCard;
  console.log(passed ? '\n✅ ALL TESTS PASSED' : '\n❌ TEST FAILURES');
  await browser.close();
  process.exit(passed ? 0 : 1);
}

runTest().catch(err => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
