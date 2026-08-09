/**
 * Test: Upgrade Alchemy Bench (#185)
 *
 *   - The card screen has an ALCHEMY button (no post-select bar)
 *   - ALCHEMY opens the bench; Essence starts at 0, forge locked
 *   - Dissolve math: +1 per standard stack, +2 per weapon-specific
 *   - Weapon Synthesis refunds 1 Essence when the main weapon has no
 *     weapon-specific upgrades (standard_blaster)
 *   - Forge lock: once per level, shown as (USED)
 *   - Dissolving after forging is still allowed; forging again is blocked
 *   - Essence resets to 0 on the next level's upgrade screen
 *   - CONTINUE advances exactly like the old flow
 */
const puppeteer = require('puppeteer');

const GAME_URL = 'http://localhost:8001/dev.html';

async function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function runTest() {
  console.log('🧪 Upgrade Alchemy Test (#185)\n');
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

  // Aim the desktop camera (the aiming ray is camera-center based) at a
  // named alchemy button, then click at screen center to fire its action.
  const clickAlchemyButton = async (btnName) => {
    const ok = await page.evaluate(async (name) => {
      const THREE = await import('three');
      const scene = window.__test?.getScene?.();
      const camera = window.__test?.getCamera?.();
      if (!scene || !camera) return false;
      const btn = scene.getObjectByName(name);
      if (!btn) return false;
      camera.updateMatrixWorld(true);
      const camPos = camera.position.clone();
      const target = new THREE.Vector3();
      btn.getWorldPosition(target);
      const dir = new THREE.Vector3().subVectors(target, camPos);
      if (dir.lengthSq() === 0) return false;
      dir.normalize();
      camera.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, -1), dir);
      camera.rotation.setFromQuaternion(camera.quaternion);
      return true;
    }, btnName);
    if (!ok) return false;
    await sleep(300); // hover pass
    await page.mouse.click(640, 400);
    await sleep(400);
    return true;
  };

  // New flow (Issue #185 redesign): dissolve/forge clicks open a CONFIRM
  // popup first. clickAndConfirm clicks the button, then CONFIRM.
  const clickAndConfirm = async (btnName) => {
    if (!await clickAlchemyButton(btnName)) return false;
    return clickAlchemyButton('alchemy-popup-confirm');
  };

  // All text sprites under the named group (userData.text carries labels).
  const textsIn = (groupName) => page.evaluate((name) => {
    const scene = window.__test?.getScene?.();
    const group = scene?.getObjectByName(name);
    if (!group) return null;
    const texts = [];
    group.traverse(c => { if (c.userData && c.userData.text) texts.push(c.userData.text); });
    return texts;
  }, groupName);

  const groupExists = (groupName) => page.evaluate((name) => {
    const scene = window.__test?.getScene?.();
    const obj = scene?.getObjectByName(name);
    return !!obj;
  }, groupName);

  const waitForUpgradeSelect = async (timeoutMs = 12000) => {
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
      const st = await page.evaluate(() => window.game?.state);
      if (st === 'upgrade_select') return true;
      await sleep(300);
    }
    return false;
  };

  const startLevel1 = async () => {
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
      window.game.playerName = 'AlchemyBot';
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
  };

  const openBench = async (upgrades) => {
    await page.evaluate((u) => {
      window.game.nextUpgradeHand = 'left';
      window.game.upgrades = {
        left: { ...(u.left || {}) },
        right: { ...(u.right || {}) },
      };
      window.__test.recomputeSynergies();
    }, upgrades);
    await page.evaluate(() => window.__test.progression.forceLevelComplete({ autoSelect: false }));
    if (!await waitForUpgradeSelect()) return 'no_upgrade_screen';
    await sleep(1600); // warp + cooldown
    // The ALCHEMY button sits on the card screen itself (the old
    // post-select bar was removed)
    if (!await clickAlchemyButton('alchemy-btn-alchemy')) return 'no_alchemy_btn';
    if (!await groupExists('alchemy-bench')) return 'bench_not_open';
    return 'ok';
  };

  // ── Phase 1: Load + PLAYING ──
  console.log('\n📍 Phase 1: Load game...');
  await page.goto(GAME_URL, { waitUntil: 'networkidle2', timeout: 15000 });
  await sleep(3000);
  await startLevel1();
  console.log('  ✅ In PLAYING state (level 1, standard blaster, both hands locked)');

  // ── Phase 2: Post-select bar + bench open ──
  console.log('\n📍 Phase 2: Bench opens with dissolve chips + locked forge...');
  let result = await openBench({ left: { scope: 2, fire: 1 }, right: { barrel: 1 } });
  console.log(`  openBench: ${result}`);
  let texts = await textsIn('alchemy-bench');
  console.log(`  Bench texts: ${texts ? texts.join(' | ') : 'NO BENCH'}`);
  const benchOpened = result === 'ok' && texts && texts.some(t => t.includes('ESSENCE: 0/3'));
  console.log(`  Bench open, essence 0/3: ${benchOpened ? '✅' : '❌'}`);

  // Dissolve scope stack #1 → essence 1 (confirm popup first)
  await clickAndConfirm('alchemy-btn-dissolve-left-scope');
  texts = await textsIn('alchemy-bench');
  const scopeDissolved = texts && texts.some(t => t.includes('ESSENCE: 1/3'));
  console.log(`  Dissolve scope (0 → 1 essence): ${scopeDissolved ? '✅' : '❌'}`);

  // Dissolve fire (status) → essence 2; then second scope → essence 3
  await clickAndConfirm('alchemy-btn-dissolve-left-fire');
  await clickAndConfirm('alchemy-btn-dissolve-left-scope');
  texts = await textsIn('alchemy-bench');
  const essence3 = texts && texts.some(t => t.includes('ESSENCE: 3/3'));
  console.log(`  Essence 3/3 after 3 dissolves: ${essence3 ? '✅' : '❌'}`);
  console.log(`  Right-hand barrel still listed: ${texts && texts.some(t => t.includes('Barrel')) ? '✅' : '❌'}`);

  // Weapon Synthesis on standard_blaster → refund (spend 3, get 1 back)
  await clickAlchemyButton('alchemy-btn-forge-weapon_synthesis');
  const refundPopup = await page.evaluate(() => {
    const scene = window.__test?.getScene?.();
    const popup = scene?.getObjectByName('alchemy-popup');
    let hasRefundText = false;
    popup?.traverse(c => { if (c.userData && c.userData.text && String(c.userData.text).includes('refunds 1 essence')) hasRefundText = true; });
    return !!popup && hasRefundText;
  });
  await clickAlchemyButton('alchemy-popup-confirm');
  texts = await textsIn('alchemy-bench');
  const refund = texts && texts.some(t => t.includes('ESSENCE: 1/3')) && texts.some(t => t.includes('USED'));
  console.log(`  Synthesis refund popup + apply (3 → 1, forge used): ${refundPopup && refund ? '✅' : '❌'}`);
  const gameState = await page.evaluate(() => ({
    essence: window.game.alchemyEssence,
    forged: window.game.alchemyForgedThisLevel,
    upgrades: { ...window.game.upgrades.left },
  }));
  console.log(`  game state: essence=${gameState.essence} forged=${gameState.forged} left=${JSON.stringify(gameState.upgrades)}`);

  // Dissolve after forging is allowed (essence 1 → 2)
  await clickAndConfirm('alchemy-btn-dissolve-right-barrel');
  texts = await textsIn('alchemy-bench');
  const dissolveAfterForge = texts && texts.some(t => t.includes('ESSENCE: 2/3'));
  console.log(`  Dissolve after forge allowed (1 → 2): ${dissolveAfterForge ? '✅' : '❌'}`);

  // Forge again → blocked (once per level + essence < 3)
  await clickAlchemyButton('alchemy-btn-forge-mystery_brew');
  const essenceAfterBlocked = await page.evaluate(() => window.game.alchemyEssence);
  const forgeBlocked = essenceAfterBlocked === 2;
  console.log(`  Second forge blocked (essence stays 2): ${forgeBlocked ? '✅' : '❌'}`);

  // Back → card screen → pick a card → advances directly to level 2
  await clickAlchemyButton('alchemy-btn-back');
  const benchClosed = !(await groupExists('alchemy-bench'));
  const alchemyBtnBack = await groupExists('alchemy-btn-alchemy');
  console.log(`  Back returns to card screen (bench closed, ALCHEMY button back): ${benchClosed && alchemyBtnBack ? '✅' : '❌'}`);
  await page.evaluate(() => window.__test.progression.selectUpgradeByIndex(0));
  await sleep(1500);
  const afterContinue = await page.evaluate(() => ({ state: window.game.state, level: window.game.level }));
  console.log(`  After CONTINUE: state=${afterContinue.state} level=${afterContinue.level}`);
  const advanced = afterContinue.level === 2 && afterContinue.state === 'playing';
  console.log(`  Advanced to level 2: ${advanced ? '✅' : '❌'}`);

  // ── Phase 3: Essence resets + Targeted Infusion + real forge ──
  console.log('\n📍 Phase 3: Essence reset + targeted infusion forge...');
  result = await openBench({ left: { scope: 3 } });
  const essenceReset = result === 'ok' && await page.evaluate(() => window.game.alchemyEssence === 0);
  console.log(`  Essence reset to 0 on new level: ${essenceReset ? '✅' : '❌'}`);

  // 3 dissolvable scope stacks → 3 essence → forge buttons enabled
  for (let i = 0; i < 3; i++) {
    await clickAndConfirm('alchemy-btn-dissolve-left-scope');
  }
  texts = await textsIn('alchemy-bench');
  const forgeEnabled = texts && texts.some(t => t.includes('ESSENCE: 3/3'));
  console.log(`  Essence 3/3 again: ${forgeEnabled ? '✅' : '❌'}`);

  // Targeted Infusion → category picker → STATUS category → preview popup → confirm
  await clickAlchemyButton('alchemy-btn-forge-targeted_infusion');
  const catView = await groupExists('alchemy-btn-cat-status');
  console.log(`  Category picker shown: ${catView ? '✅' : '❌'}`);
  const before = await page.evaluate(() => ({ ...window.game.upgrades.left }));
  await clickAndConfirm('alchemy-btn-cat-status');
  const after = await page.evaluate(() => ({ ...window.game.upgrades.left }));
  const statusIds = ['fire', 'shock', 'freeze', 'ricochet', 'excess_heat'];
  const statusForged = statusIds.some(id => (after[id] || 0) > (before[id] || 0));
  console.log(`  Status upgrade forged: ${statusForged ? '✅' : '❌'} (${JSON.stringify(before)} → ${JSON.stringify(after)})`);
  texts = await textsIn('alchemy-bench');
  const usedLabel = texts && texts.some(t => t.includes('(USED)'));
  console.log(`  Forge buttons locked with (USED): ${usedLabel ? '✅' : '❌'}`);

  // Finish: back → card screen → pick a card → level 3
  await clickAlchemyButton('alchemy-btn-back');
  const backToCards2 = await groupExists('alchemy-btn-alchemy');
  console.log(`  Back returns to card screen (2): ${backToCards2 ? '✅' : '❌'}`);
  await page.evaluate(() => window.__test.progression.selectUpgradeByIndex(0));
  await sleep(1500);
  const final = await page.evaluate(() => ({ state: window.game.state, level: window.game.level }));
  console.log(`  Final: state=${final.state} level=${final.level}`);
  const finished = final.level === 3;

  // ── Results ──
  console.log('\n============================================================');
  console.log('📊 Results:');
  if (errors.length === 0) {
    console.log('  ✅ No console errors');
  } else {
    console.log(`  ❌ ${errors.length} console error(s):`);
    errors.slice(0, 5).forEach(e => console.log(`     - ${e.substring(0, 120)}`));
  }
  const passed = errors.length === 0 && benchOpened && scopeDissolved && essence3 && refund &&
                 dissolveAfterForge && forgeBlocked && benchClosed && advanced &&
                 essenceReset && forgeEnabled && catView && statusForged && usedLabel &&
                 backToCards2 && finished;
  console.log(passed ? '\n✅ ALL TESTS PASSED' : '\n❌ TEST FAILURES');
  await browser.close();
  process.exit(passed ? 0 : 1);
}

runTest().catch(err => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
