/**
 * Test: Synergy Engine (#211) — elemental combos + stat synergies.
 *
 *   - Thermal Shock (fire+freeze): frozen enemy taking fire DoT shatters —
 *     nearby enemies take 50% max-HP AoE and the freeze is consumed.
 *   - Plasma Arc (fire+shock): burning source's lightning chain spreads
 *     fire to the chained enemy; electrified enemies burn 2x faster.
 *   - Cryo-Conduction (freeze+shock): aura path runs without errors.
 *   - PRIME STATE (fire+freeze+shock): shock chains to ALL non-statused
 *     enemies in range.
 *   - Lethal Precision: 2 crit upgrades → critMultiplier 3.
 *   - Blood Letter: critical + vampiric → heal every 3 kills.
 *   - Synergy snapshot recomputes via __test.recomputeSynergies().
 */
const puppeteer = require('puppeteer');

const GAME_URL = 'http://localhost:8000/dev.html';

async function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function runTest() {
  console.log('🧪 Synergy Engine Test (#211)\n');
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

  // ── Phase 2: PLAYING ──
  console.log('\n📍 Phase 2: Start game...');
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

  // Snap N fresh enemies in a line close together; returns references on window
  const snapEnemies = (n) => page.evaluate((count) => {
    const enemies = window.__test?.getEnemies?.() || [];
    if (enemies.length < count) return false;
    window.__test.fireAtEnemy(0, { distance: 4, hp: 2000 });
    enemies[0].hp = 2000;
    for (let i = 1; i < count; i++) {
      const e = enemies[i];
      e.mesh.position.set(enemies[0].mesh.position.x + i * 1.5, 1.6, enemies[0].mesh.position.z);
      e.hp = 2000;
    }
    window.__synEnemies = enemies.slice(0, count);
    return true;
  }, n);

  const setUpgrades = (upgrades) => page.evaluate((u) => {
    window.game.upgrades = { left: { ...u }, right: { ...u } };
    window.__test.recomputeSynergies();
  }, upgrades);

  const clearStatuses = () => page.evaluate(() => {
    for (const e of window.__synEnemies) {
      if (!e || !e.statusEffects) continue;
      for (const k of Object.keys(e.statusEffects)) {
        e.statusEffects[k].stacks = 0;
        e.statusEffects[k].remaining = 0;
        e.statusEffects[k].tickTimer = 0.5;
      }
      e.hp = 2000;
    }
  });

  // ── Phase 3: THERMAL SHOCK ──
  console.log('\n📍 Phase 3: Thermal Shock (fire + freeze)...');
  let ok = false;
  for (let i = 0; i < 24 && !ok; i++) {
    ok = await snapEnemies(2);
    if (!ok) await sleep(500);
  }
  if (!ok) { console.log('  ❌ No enemies'); await browser.close(); process.exit(1); }
  await setUpgrades({ fire: 1, freeze: 1 });
  const thermalDetected = await page.evaluate(() =>
    window.game.synergies.left.some(s => s.id === 'thermal_shock')
  );
  console.log(`  Synergy detected: ${thermalDetected ? '✅' : '❌'}`);
  await clearStatuses();
  await page.keyboard.down('Space');
  await sleep(500);
  await page.keyboard.up('Space');
  await sleep(2400); // let fire DoT tick while frozen → shatter
  const thermal = await page.evaluate(() => [
    window.__synEnemies[0]?.hp,        // shattered source (DoT damage)
    window.__synEnemies[1]?.hp,        // neighbor — should take 50% maxHP AoE
    window.__synEnemies[0]?.statusEffects?.freeze?.stacks, // consumed → 0
  ]);
  console.log(`  hps (src, neighbor): ${thermal[0]}, ${thermal[1]}, freeze stacks: ${thermal[2]}`);
  const thermalOk = thermal[1] < 2000 && thermal[2] === 0;
  console.log(`  Neighbor shattered + freeze consumed: ${thermalOk ? '✅' : '❌'}`);

  // ── Phase 4: PLASMA ARC ──
  console.log('\n📍 Phase 4: Plasma Arc (fire + shock)...');
  ok = false;
  for (let i = 0; i < 24 && !ok; i++) {
    ok = await snapEnemies(2); // fresh pair so the chain target is deterministic
    if (!ok) await sleep(500);
  }
  if (!ok) { console.log('  ❌ No enemies'); await browser.close(); process.exit(1); }
  await setUpgrades({ fire: 1, shock: 1 });
  await clearStatuses();
  // Ignite the source manually so the chain spreads fire (retry until applied)
  for (let i = 0; i < 10; i++) {
    await page.evaluate(() => {
      const e = window.__synEnemies[0];
      e.statusEffects.fire.stacks = 1;
      e.statusEffects.fire.remaining = 5;
    });
    const ignited = await page.evaluate(() => window.__synEnemies[0]?.statusEffects?.fire?.stacks === 1);
    if (ignited) break;
    await sleep(100);
  }
  await page.keyboard.down('Space');
  await sleep(500);
  await page.keyboard.up('Space');
  await sleep(400);
  const plasma = await page.evaluate(() => [
    window.__synEnemies[1]?.statusEffects?.fire?.stacks,
  ]);
  console.log(`  Chained enemy fire stacks: ${plasma[0]}`);
  const plasmaOk = plasma[0] > 0;
  console.log(`  Fire spread via chain: ${plasmaOk ? '✅' : '❌'}`);

  // ── Phase 5: CRYO-CONDUCTION (aura path, no crash) ──
  console.log('\n📍 Phase 5: Cryo-Conduction (freeze + shock)...');
  await setUpgrades({ freeze: 1, shock: 1 });
  await clearStatuses();
  await page.evaluate(() => {
    const e = window.__synEnemies[0];
    e.statusEffects.freeze.stacks = 1; e.statusEffects.freeze.remaining = 3;
    e.statusEffects.shock.stacks = 1; e.statusEffects.shock.remaining = 3;
  });
  await sleep(600); // frames tick with the aura scan
  console.log('  Aura path ran without errors ✅');

  // ── Phase 6: PRIME STATE ──
  console.log('\n📍 Phase 6: PRIME STATE (fire + freeze + shock)...');
  ok = false;
  for (let i = 0; i < 24 && !ok; i++) {
    ok = await snapEnemies(3); // fresh: source + 2 targets
    if (!ok) await sleep(500);
  }
  if (!ok) { console.log('  ⚠ Could not snap 3 enemies — skipping prime phase'); }
  let primeDetected = false;
  let primeOk = false;
  if (ok) {
    await setUpgrades({ fire: 1, freeze: 1, shock: 1 });
    primeDetected = await page.evaluate(() =>
      window.game.synergies.left.some(s => s.id === 'prime_state')
    );
    console.log(`  Synergy detected: ${primeDetected ? '✅' : '❌'}`);
    await clearStatuses();
    // Move targets sideways so they are NOT in the shot path (stays unhit + non-statused)
    await page.evaluate(() => {
      const src = window.__synEnemies[0];
      for (let i = 1; i < window.__synEnemies.length; i++) {
        window.__synEnemies[i].mesh.position.set(src.mesh.position.x, 1.6, src.mesh.position.z + 6); // 6m behind, within chain range
      }
    });
    await page.keyboard.down('Space');
    await sleep(500);
    await page.keyboard.up('Space');
    await sleep(400);
    const prime = await page.evaluate(() => [
      window.__synEnemies[1]?.hp,
      window.__synEnemies[2]?.hp,
      window.__synEnemies[1]?.statusEffects?.shock?.stacks,
    ]);
    console.log(`  Targets hp after prime chain: ${prime[0]}, ${prime[1]} (shock stacks: ${prime[2]})`);
    primeOk = (prime[0] < 2000 || prime[1] < 2000) && prime[2] === 0;
    console.log(`  Chain hit non-statused targets: ${primeOk ? '✅' : '❌'}`);
  }

  // ── Phase 7: STAT SYNERGIES ──
  console.log('\n📍 Phase 7: Lethal Precision + Blood Letter...');
  const stats = await page.evaluate(async () => {
    const w = await import('./weapons.js');
    return {
      lethal: w.getWeaponStats('standard_blaster', { critical: 2 }).critMultiplier,
      blood: w.getWeaponStats('standard_blaster', { critical: 1, vampiric: 1 }).vampiricInterval,
      noSyn: w.getWeaponStats('standard_blaster', { critical: 1 }).critMultiplier,
    };
  });
  console.log(`  Lethal critMult: ${stats.lethal} (expect 3), blood interval: ${stats.blood} (expect 3), base critMult: ${stats.noSyn}`);
  const statOk = stats.lethal === 3 && stats.blood === 3;

  // ── Results ──
  console.log('\n============================================================');
  console.log('📊 Results:');
  if (errors.length === 0) {
    console.log('  ✅ No console errors');
  } else {
    console.log(`  ❌ ${errors.length} console error(s):`);
    errors.slice(0, 5).forEach(e => console.log(`     - ${e.substring(0, 120)}`));
  }
  const passed = errors.length === 0 && thermalDetected && thermalOk && plasmaOk && primeDetected && primeOk && statOk;
  console.log(passed ? '\n✅ ALL TESTS PASSED' : '\n❌ TEST FAILURES');
  await browser.close();
  process.exit(passed ? 0 : 1);
}

runTest().catch(err => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
