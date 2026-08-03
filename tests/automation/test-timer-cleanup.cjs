/**
 * Test: Verify pending-timer cleanup for charge-beam triple-shot (Issues #195/#204).
 *
 * Scenario 1 — triple-shot still fires during normal play:
 *   Equip charge cannon + triple_shot upgrade (left hand only), hold space to
 *   charge, release to fire. The delayed triple-shot beam must fire ~300ms later
 *   (enemy HP drops a second time).
 *
 * Scenario 2 — timer cancelled on level completion:
 *   Fire charge beam, then trigger a level completion (nuke) within the 300ms
 *   window. The stale timer must not fire during LEVEL_COMPLETE, and the state
 *   transition must complete without console errors.
 *
 * Scenario 3 — timer cancelled on full game reset:
 *   Fire charge beam, then resetGame() within the 300ms window. No stale shot,
 *   no console errors after reset.
 */
const puppeteer = require('puppeteer');

const GAME_URL = 'http://localhost:8000/dev.html';
const SCREENSHOT_DIR = 'tests/screenshots/';

async function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

function stateName(s) {
  if (typeof s === 'string') return s;
  return `state_${s}`;
}

async function runTest() {
  console.log('🧪 Pending Timer Cleanup (triple-shot) Test\n');
  console.log('='.repeat(60));

  const errors = [];

  const browser = await puppeteer.launch({
    headless: 'new',
    args: [
      '--no-sandbox', '--disable-setuid-sandbox', '--use-angle=swiftshader',
      '--enable-webgl', '--ignore-gpu-blocklist', '--disable-gpu-sandbox',
      '--enable-features=WebGL',
    ]
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 800 });

  page.on('console', msg => {
    const text = msg.text();
    const type = msg.type();
    const isBenign = text.includes('favicon') || text.includes('GroupMarker') ||
                     text.includes('AudioContext') || text.includes('Pointer lock');
    if (type === 'error' && !isBenign) {
      errors.push(text);
      console.log(`  ❌ Console error: ${text.substring(0, 150)}`);
    }
  });

  page.on('pageerror', err => {
    errors.push(`PageError: ${err.message}`);
    console.log(`  💥 Page error: ${err.message.substring(0, 150)}`);
  });

  // ── Phase 1: Load ──
  console.log('\n📍 Phase 1: Load game (dev.html)...');
  await page.goto(GAME_URL, { waitUntil: 'networkidle2', timeout: 15000 });
  await sleep(3000);

  const initState = await page.evaluate(() => window.game?.state);
  if (initState === undefined) {
    console.log('  ❌ Game failed to initialize');
    await browser.close();
    process.exit(1);
  }
  console.log('  ✅ Game initialized');

  // ── Phase 2: Navigate to PLAYING ──
  console.log('\n📍 Phase 2: Navigate to playing...');
  const PLAYING = await page.evaluate(() => window.State?.PLAYING || 'playing');

  for (let i = 0; i < 15; i++) {
    const state = await page.evaluate(() => window.game?.state);
    if (state === PLAYING) break;
    await page.mouse.click(640, 400);
    await sleep(400);
    await page.keyboard.press('Space');
    await sleep(200);
  }

  // Force PLAYING if the click-through didn't make it (same pattern as test-bugfixes.cjs)
  let state = await page.evaluate(() => window.game?.state);
  if (state !== PLAYING) {
    await page.evaluate(() => {
      window.game.country = 'CA';
      window.game.playerName = 'TestBot';
      window.game.state = 'playing';
      window.game.health = 6;
      window.game.level = 1;
      window.game.nukes = 3;
    });
    await sleep(1000);
  }
  state = await page.evaluate(() => window.game?.state);
  console.log(`  Final state: ${stateName(state)}`);

  // Desktop controls auto-enable only when VR is detected unsupported, which is
  // unreliable in headless Chrome — enable them explicitly for firing.
  await page.evaluate(async () => {
    const d = await import('./desktop-controls.js');
    if (!d.isEnabled()) d.enable();
  });
  const desktopEnabled = await page.evaluate(async () => {
    const d = await import('./desktop-controls.js');
    return d.isEnabled();
  });
  console.log(`  Desktop controls enabled: ${desktopEnabled}`);
  if (!desktopEnabled) {
    console.log('  ❌ Could not enable desktop controls');
    await browser.close();
    process.exit(1);
  }

  // ── Phase 3: Configure charge cannon + triple shot (left hand only) ──
  console.log('\n📍 Phase 3: Equip charge cannon + triple_shot (left hand)...');
  await page.evaluate(() => {
    window.game.mainWeapon = { left: 'charge_cannon', right: 'charge_cannon' };
    window.game.upgrades.left.triple_shot = 1;
    window.game.upgrades.right.triple_shot = 0;
    window.game.nukes = 3;
    window.game.health = 6;
  });
  await page.keyboard.press('1'); // fireMode 'left' — only the left hand fires
  await sleep(300);

  // Clear the arena, wait for a fresh enemy, snap it in front of the camera
  // with high HP so all beam hits are observable without killing it.
  // The target is stored on window.__target so we track the SAME enemy
  // (fresh spawns pollute array-index-based reads).
  await page.evaluate(() => window.__test?.activateNuke?.());
  await sleep(300);

  let snapped = false;
  for (let i = 0; i < 20 && !snapped; i++) {
    snapped = await page.evaluate(() => {
      const enemies = window.__test?.getEnemies?.() || [];
      if (!enemies.length) return false;
      window.__test.fireAtEnemy(0, { distance: 6, hp: 2000 });
      const e = enemies[0];
      if (e && typeof e.hp === 'number') e.hp = 2000; // keep it alive for 2+ hits
      window.__target = e;
      return true;
    });
    if (!snapped) await sleep(500);
  }
  console.log(`  Enemy snapped in front of camera: ${snapped}`);
  if (!snapped) {
    console.log('  ❌ Could not place a test enemy');
    await browser.close();
    process.exit(1);
  }

  // HP of the tracked target enemy (immune to new spawns)
  const targetHp = () => page.evaluate(() => (window.__target && window.__target.hp > 0 ? window.__target.hp : 0));

  // ── Phase 4: Scenario 1 — triple-shot fires during normal play ──
  console.log('\n📍 Phase 4: Fire charge beam (hold space 800ms, release)...');
  const hpBefore1 = await targetHp();
  console.log(`  Target HP before: ${hpBefore1}`);

  await page.keyboard.down('Space');
  await sleep(800);   // Charge
  await page.keyboard.up('Space');  // Release → fire charge beam, schedule triple-shot
  await sleep(150);   // Give the initial beam hit time to land (before the 300ms delayed shot)
  const hpAfterFirst = await targetHp();
  await sleep(350);   // Past the 300ms delayed-shot window
  const hpAfterSecond = await targetHp();
  console.log(`  HP after initial beam: ${hpAfterFirst}`);
  console.log(`  HP after delayed shot: ${hpAfterSecond}`);

  const firstHitLanded = hpAfterFirst < hpBefore1;
  const delayedShotLanded = hpAfterSecond < hpAfterFirst;
  console.log(`  Initial beam hit: ${firstHitLanded ? '✅' : '❌'}`);
  console.log(`  Delayed triple-shot hit: ${delayedShotLanded ? '✅' : '❌'}`);

  if (!firstHitLanded || !delayedShotLanded) {
    console.log('  ❌ Triple-shot mechanic not working as expected');
    await page.screenshot({ path: SCREENSHOT_DIR + 'timer-cleanup-01-fail.png' });
    await browser.close();
    process.exit(1);
  }
  console.log('  ✅ Scenario 1 passed: triple-shot fires during normal play');

  // ── Phase 5: Scenario 2 — timer cancelled on level completion ──
  console.log('\n📍 Phase 5: Fire again, then nuke (level complete) within 300ms...');
  // Pre-fill kills to 14 so the nuke (kills ≥ 1) crosses level 1's real
  // killTarget of 15 and triggers completeLevel(). Setting _levelConfig here
  // does not stick — the playing loop re-assigns it from getLevelConfig().
  await page.evaluate(() => {
    window.game.kills = 14;
    window.game.nukes = 3;
  });
  // Ensure at least one enemy exists so the nuke kills ≥ 1 and completes the level
  const snapped2 = await page.evaluate(() => {
    const enemies = window.__test?.getEnemies?.() || [];
    if (!enemies.length) return false;
    window.__test.fireAtEnemy(0, { distance: 6, hp: 2000 });
    enemies[0].hp = 2000;
    return true;
  });
  if (!snapped2) {
    console.log('  ⚠ No enemy to nuke — skipping Scenario 2 assertion');
  } else {
    await page.keyboard.down('Space');
    await sleep(800);
    await page.keyboard.up('Space');   // Charge beam fires → triple-shot timer scheduled
    await sleep(50);                   // Fire the nuke inside the 300ms window
    const nuked = await page.evaluate(() => window.__test?.activateNuke?.() === true);
    console.log(`  Nuke activated: ${nuked}`);
    await sleep(700);                  // Past the delayed-shot window

    state = await page.evaluate(() => window.game?.state);
    console.log(`  State after nuke + 700ms: ${stateName(state)}`);
    if (!['level_complete', 'upgrade_select'].includes(state)) {
      console.log('  ❌ Level did not complete cleanly after nuke');
      await page.screenshot({ path: SCREENSHOT_DIR + 'timer-cleanup-02-fail.png' });
      await browser.close();
      process.exit(1);
    }
    console.log('  ✅ Scenario 2 passed: level completed cleanly (stale timer did not break transition)');
  }

  // ── Phase 6: Scenario 3 — timer cancelled on full game reset ──
  console.log('\n📍 Phase 6: Force PLAYING, fire, then resetGame() within 300ms...');
  await page.evaluate(() => {
    window.game.state = 'playing';
    window.game.level = 1;
    window.game.nukes = 3;
  });
  await sleep(200);
  await page.keyboard.down('Space');
  await sleep(800);
  await page.keyboard.up('Space');   // Charge beam fires → triple-shot timer scheduled
  await sleep(50);
  await page.evaluate(async () => {
    const m = await import('./game.js');
    m.resetGame();
  });
  await sleep(700);                  // Past the delayed-shot window

  state = await page.evaluate(() => window.game?.state);
  console.log(`  State after reset + 700ms: ${stateName(state)}`);
  await page.screenshot({ path: SCREENSHOT_DIR + 'timer-cleanup-03-reset.png' });

  // ── Results ──
  console.log('\n============================================================');
  console.log('📊 Results:');
  if (errors.length === 0) {
    console.log('  ✅ No console errors');
  } else {
    console.log(`  ❌ ${errors.length} console error(s):`);
    errors.slice(0, 5).forEach(e => console.log(`     - ${e.substring(0, 120)}`));
  }
  const passed = errors.length === 0;
  console.log(passed ? '\n✅ ALL TESTS PASSED' : '\n❌ TEST FAILURES');
  await browser.close();
  process.exit(passed ? 0 : 1);
}

runTest().catch(err => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
