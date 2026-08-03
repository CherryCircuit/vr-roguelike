/**
 * Test: Elemental Ammo System (#216) — fire DoT, shock chain, freeze slow.
 *
 *   - Fire upgrade: shooting applies the fire status; DoT ticks reduce
 *     enemy HP over time after the shot stops.
 *   - Shock upgrade: applying shock chains 15 dmg to the nearest enemy
 *     within 6m (the marquee #216 mechanic) with a lightning arc visual.
 *   - Freeze upgrade: applies the freeze status without crashing.
 *   - Zero console errors throughout (guards status VFX + chain arc paths).
 */
const puppeteer = require('puppeteer');

const GAME_URL = 'http://localhost:8000/dev.html';

async function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function runTest() {
  console.log('🧪 Elemental Ammo Test (fire DoT / shock chain / freeze)\n');
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

  // ── Phase 2: PLAYING + two test enemies ──
  console.log('\n📍 Phase 2: Start game, place two enemies 1m apart...');
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
    window.game.level = 1;
  });
  await sleep(500);
  await page.evaluate(async () => {
    const d = await import('./desktop-controls.js');
    if (!d.isEnabled()) d.enable();
  });
  await page.evaluate(() => {
    window.game.mainWeapon = { left: 'standard_blaster', right: 'standard_blaster' };
  });
  await page.evaluate(() => window.__test?.activateNuke?.());

  let snapped = false;
  for (let i = 0; i < 24 && !snapped; i++) {
    snapped = await page.evaluate(() => {
      const enemies = window.__test?.getEnemies?.() || [];
      if (enemies.length < 2) return false;
      window.__test.fireAtEnemy(0, { distance: 4, hp: 1000 });
      window.__test.fireAtEnemy(1, { distance: 5, hp: 1000 });
      enemies[0].hp = 1000;
      enemies[1].hp = 1000;
      window.__e0 = enemies[0];
      window.__e1 = enemies[1];
      return true;
    });
    if (!snapped) await sleep(500);
  }
  console.log(`  Enemies placed: ${snapped}`);
  if (!snapped) {
    console.log('  ❌ Could not place test enemies');
    await browser.close();
    process.exit(1);
  }

  const resetStatus = () => page.evaluate(() => {
    const enemies = window.__test?.getEnemies?.() || [];
    for (const e of enemies) {
      if (!e.statusEffects) continue;
      for (const key of Object.keys(e.statusEffects)) {
        e.statusEffects[key].stacks = 0;
        e.statusEffects[key].remaining = 0;
      }
      e.hp = 1000;
    }
  });

  // ── Phase 3: FIRE — DoT ticks ──
  console.log('\n📍 Phase 3: Fire upgrade — DoT over time...');
  await page.evaluate(() => {
    window.game.upgrades = { left: { fire: 1 }, right: { fire: 1 } };
  });
  await resetStatus();
  await page.keyboard.down('Space');
  await sleep(400);
  await page.keyboard.up('Space');
  const hpAfterShots = await page.evaluate(() => window.__e0?.hp);
  await sleep(1500); // let DoT ticks land
  const hpAfterDoT = await page.evaluate(() => window.__e0?.hp);
  console.log(`  HP after shots: ${hpAfterShots}, after 1.5s DoT: ${hpAfterDoT}`);
  const fireDotOk = hpAfterDoT < hpAfterShots;
  const fireStatusOk = await page.evaluate(() =>
    (window.__test?.getEnemies?.() || []).some(e => e.statusEffects?.fire?.stacks > 0)
  );
  console.log(`  Fire DoT tick: ${fireDotOk ? '✅' : '❌'}`);
  console.log(`  Fire status applied: ${fireStatusOk ? '✅' : '❌'}`);

  // ── Phase 4: SHOCK — chain to nearby enemy ──
  console.log('\n📍 Phase 4: Shock upgrade — chain to nearest enemy...');
  await page.evaluate(() => {
    window.game.upgrades = { left: { shock: 1 }, right: { shock: 1 } };
  });
  await resetStatus();
  const shockBefore = await page.evaluate(() => [window.__e0?.hp, window.__e1?.hp]);
  await page.keyboard.down('Space');
  await sleep(400);
  await page.keyboard.up('Space');
  await sleep(400); // allow the chain damage to land
  const shockAfter = await page.evaluate(() => [window.__e0?.hp, window.__e1?.hp]);
  console.log(`  HPs before: ${shockBefore.join(', ')}, after: ${shockAfter.join(', ')}`);
  const chainOk = shockAfter[1] < shockBefore[1];
  console.log(`  Chain damaged nearest enemy: ${chainOk ? '✅' : '❌'}`);

  // ── Phase 5: FREEZE — status applies without errors ──
  console.log('\n📍 Phase 5: Freeze upgrade — status applies...');
  await page.evaluate(() => {
    window.game.upgrades = { left: { freeze: 1 }, right: { freeze: 1 } };
  });
  await resetStatus();
  await page.keyboard.down('Space');
  await sleep(400);
  await page.keyboard.up('Space');
  await sleep(300);
  const freezeOk = await page.evaluate(() =>
    (window.__test?.getEnemies?.() || []).some(e => e.statusEffects?.freeze?.stacks > 0)
  );
  console.log(`  Freeze status applied: ${freezeOk ? '✅' : '❌'}`);

  // ── Results ──
  console.log('\n============================================================');
  console.log('📊 Results:');
  if (errors.length === 0) {
    console.log('  ✅ No console errors');
  } else {
    console.log(`  ❌ ${errors.length} console error(s):`);
    errors.slice(0, 5).forEach(e => console.log(`     - ${e.substring(0, 120)}`));
  }
  const passed = errors.length === 0 && fireDotOk && fireStatusOk && chainOk && freezeOk;
  console.log(passed ? '\n✅ ALL TESTS PASSED' : '\n❌ TEST FAILURES');
  await browser.close();
  process.exit(passed ? 0 : 1);
}

runTest().catch(err => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
