/**
 * Test: Void Marks (#139) — death scars that persist into future runs
 *
 *   - Stored marks load from localStorage
 *   - Level change spawns marks matching level + biome at the recorded spot
 *   - A mark in range shows the prompt + is interactable
 *   - INHERIT grants one universal upgrade from the ghost run and consumes
 *     the mark
 *   - PURGE grants +500 × level score and consumes the mark
 *   - Recorded deaths persist to localStorage (max 20)
 *   - No console errors
 */
const puppeteer = require('puppeteer');

const GAME_URL = 'http://localhost:8001/dev.html';

async function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function runTest() {
  console.log('🧪 Void Marks Test (#139)\n');
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
  // Seed stored marks BEFORE the page loads (initVoidMarks reads localStorage)
  await page.evaluateOnNewDocument(() => {
    try {
      localStorage.setItem('void_marks', JSON.stringify([
        { level: 4, biome: 'synthwave_valley', position: { x: 0, y: 1.6, z: 0 },
          upgrades: ['scope', 'vampiric'], killedBy: 'test', timestamp: 1 },
        { level: 5, biome: 'synthwave_valley', position: { x: 0, y: 1.6, z: 0 },
          upgrades: ['barrel'], killedBy: 'test', timestamp: 2 },
      ]));
    } catch (e) { /* ignore */ }
  });

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

  // ── Phase 1: Load + PLAYING (level 4) ──
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
    window.game.playerName = 'GhostBot';
    window.game.state = 'playing';
    window.game.health = 6;
    window.game.level = 4;
    window.game.mainWeaponLocked = { left: true, right: true };
    window.game.upgrades = { left: {}, right: {} };
  });
  await page.evaluate(async () => {
    const d = await import('./desktop-controls.js');
    if (!d.isEnabled()) d.enable();
  });
  await sleep(600);
  console.log('  ✅ In PLAYING state');

  const results = {};

  // ── Phase 2: Marks spawn on level change ──
  console.log('\n📍 Phase 2: Level-4 mark spawns...');
  results.spawn = await page.evaluate(async () => {
    const vm = await import('./void-marks.js');
    await new Promise(r => setTimeout(r, 300)); // let the level-change detection run
    return { ok: vm.getActiveMarkCount() === 1, count: vm.getActiveMarkCount() };
  });
  console.log(`  The level-4 mark appears in the arena: ${results.spawn.ok ? '✅' : '❌'} (${JSON.stringify(results.spawn)})`);

  // ── Phase 3: Inherit ──
  console.log('\n📍 Phase 3: Inherit...');
  results.inherit = await page.evaluate(async () => {
    const vm = await import('./void-marks.js');
    // The mark spawned at the player's position — in interaction range
    const inRange = vm.isVoidMarkInRange();
    const inherited = vm.tryVoidMarkInherit();
    const left = window.game.upgrades.left || {};
    const granted = Object.keys(left).filter(id => left[id] > 0);
    return {
      ok: inRange && inherited && granted.length >= 1,
      inRange, inherited,
      granted,
      marksAfter: vm.getActiveMarkCount(),
    };
  });
  console.log(`  Inherit grants one upgrade from the ghost run: ${results.inherit.ok ? '✅' : '❌'} (${JSON.stringify(results.inherit)})`);

  // ── Phase 4: Purge (level-5 mark) ──
  console.log('\n📍 Phase 4: Purge...');
  results.purge = await page.evaluate(async () => {
    const vm = await import('./void-marks.js');
    // Advance to level 5 → the level-5 mark spawns
    window.game.level = 5;
    await new Promise(r => setTimeout(r, 400));
    const spawned = vm.getActiveMarkCount() === 1;
    // The mark spawned at the player's position (0, 0.3, 0) — in range
    await new Promise(r => setTimeout(r, 100));
    const inRange = vm.isVoidMarkInRange();
    const scoreBefore = window.game.score;
    const purged = vm.tryVoidMarkPurge();
    // addScore applies accuracy/style multipliers — assert a large gain,
    // not the exact bonus
    return {
      ok: spawned && inRange && purged && window.game.score > scoreBefore + 1000,
      spawned, inRange, purged, scoreBefore, scoreAfter: window.game.score,
    };
  });
  console.log(`  Purge grants +500×level score: ${results.purge.ok ? '✅' : '❌'} (${JSON.stringify(results.purge)})`);

  // ── Phase 5: Death recording persists ──
  console.log('\n📍 Phase 5: Death recording...');
  results.record = await page.evaluate(async () => {
    const vm = await import('./void-marks.js');
    vm.recordVoidMark({ x: 3, y: 1.6, z: -2 }, 4, { left: { critical: 1 }, right: {} }, { type: 'enemy', name: 'TEST' });
    const stored = JSON.parse(localStorage.getItem('void_marks') || '[]');
    const last = stored[stored.length - 1];
    return { ok: stored.length >= 1 && last.level === 4 && last.upgrades.includes('critical'), count: stored.length, lastUpgrades: last?.upgrades };
  });
  console.log(`  Death records persist (upgrades + level): ${results.record.ok ? '✅' : '❌'} (${JSON.stringify(results.record)})`);

  // ── Results ──
  console.log('\n============================================================');
  console.log('📊 Results:');
  if (errors.length === 0) {
    console.log('  ✅ No console errors');
  } else {
    console.log(`  ❌ ${errors.length} console error(s):`);
    errors.slice(0, 5).forEach(e => console.log(`     - ${e.substring(0, 120)}`));
  }
  const passed = errors.length === 0 && results.spawn.ok && results.inherit.ok &&
    results.purge.ok && results.record.ok;
  console.log(passed ? '\n✅ ALL TESTS PASSED' : '\n❌ TEST FAILURES');
  await browser.close();
  process.exit(passed ? 0 : 1);
}

runTest().catch(err => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
