/**
 * Test: Dual-Wield Combos (#218)
 *
 *   - Dual Strike: both hands fire within 100ms → second shot +25% damage
 *   - Drill + Momentum: alternate fire within 300ms → second shot 100% crit
 *   - Heat Wave: 6+ rapid shots in 1s → exploding shot (aoeRadius + forced)
 *   - Overload: lightning_rod + other hand → other shot gains 30 dmg impact AOE
 *   - Scatter-Seek: seeker_burst + buckshot pairing → seekers tagged scatterSeek
 *   - No console errors
 */
const puppeteer = require('puppeteer');

const GAME_URL = 'http://localhost:8000/dev.html';

async function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function runTest() {
  console.log('🧪 Dual-Wield Combo Test (#218)\n');
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

  const setWeapons = async (left, right) => page.evaluate(({ left, right }) => {
    window.game.mainWeapon = { left, right };
    window.game.mainWeaponLocked = { left: true, right: true };
    window.game.upgrades = { left: {}, right: {} };
    window.game.weaponEvolution = { left: null, right: null };
  }, { left, right });

  // Snapshot the projectiles fired since `marker` (projectile objects are
  // pooled proxies — we copy the stats fields we care about).
  const getProjectileStats = async (marker) => page.evaluate(async (m) => {
    const ps = await import('./projectile-system.js');
    const out = [];
    for (const p of ps.projectiles) {
      const s = p.userData?.stats;
      if (!s) continue;
      out.push({
        damage: s.damage,
        critChance: s.critChance,
        aoeRadius: s.aoeRadius || 0,
        aoeDamage: s.aoeDamage || 0,
        forceExplosion: !!s.forceExplosion,
        scatterSeek: !!p.userData?.scatterSeek,
        id: s.mainWeaponId,
      });
    }
    return { count: out.length, projs: out.slice(-m) };
  }, marker);

  const fireBoth = async (ms) => {
    await page.keyboard.down('Space');
    await sleep(ms);
    await page.keyboard.up('Space');
  };

  // Single-shot tap (down+up) — deterministic single fire event
  const tapFire = async () => {
    await page.keyboard.down('Space');
    await sleep(60);
    await page.keyboard.up('Space');
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
    window.game.playerName = 'ComboBot';
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

  // ── Phase 2: Dual Strike (standard_blaster + buckshot) ──
  console.log('\n📍 Phase 2: Dual Strike (+25% on second shot)...');
  await setWeapons('standard_blaster', 'buckshot');
  await sleep(300);
  // fireMode 'both' (default): left fires first, right fires same frame (<100ms)
  await tapFire();
  await sleep(400);
  const dual = await getProjectileStats(8);
  results.dualStrike = dual.projs.some(p => p.id === 'buckshot' && p.damage === 23) &&
                       dual.projs.some(p => p.id === 'standard_blaster' && p.damage === 15);
  console.log(`  Dual Strike damage split (15 / 23): ${results.dualStrike ? '✅' : '❌'} (${dual.projs.map(p => `${p.id}:${p.damage}`).join(', ') || 'none'})`);

  // ── Phase 3: Drill + Momentum (alternate fire) ──
  console.log('\n📍 Phase 3: Drill + Momentum (alternate fire, 100-300ms)...');
  await setWeapons('standard_blaster', 'buckshot');
  await sleep(1500); // let combo timers from Phase 2 age out
  await page.keyboard.press('1'); // fireMode left
  await tapFire();                 // left fires
  await sleep(150);
  await page.keyboard.press('2'); // fireMode right
  await tapFire();                 // right fires ~150ms later → drill+momentum
  await sleep(500);
  const drill = await getProjectileStats(8);
  results.drill = drill.projs.some(p => p.id === 'buckshot' && p.critChance === 1);
  results.momentum = drill.projs.some(p => p.id === 'buckshot' && p.damage === 22); // 18×1.2=21.6→22
  console.log(`  Drill (right critChance=1): ${results.drill ? '✅' : '❌'} | Momentum (dmg 22): ${results.momentum ? '✅' : '❌'} (${drill.projs.map(p => `${p.id}:${p.damage}/${p.critChance}`).join(', ') || 'none'})`);

  // ── Phase 4: Heat Wave (sustained fire) ──
  console.log('\n📍 Phase 4: Heat Wave (6th+ rapid shot explodes)...');
  await setWeapons('standard_blaster', 'standard_blaster');
  await sleep(1200);
  await page.keyboard.press('1'); // left only
  await fireBoth(1400); // ~7 shots at 180ms
  const heat = await getProjectileStats(8);
  results.heatWave = heat.projs.some(p => p.forceExplosion && p.aoeRadius === 1.5);
  console.log(`  Heat Wave forced explosion: ${results.heatWave ? '✅' : '❌'} (${heat.projs.filter(p => p.forceExplosion).length} exploding of ${heat.count})`);

  // ── Phase 5: Overload (lightning_rod + other) ──
  console.log('\n📍 Phase 5: Overload (lightning pair — 30 dmg impact AOE)...');
  await setWeapons('lightning_rod', 'standard_blaster');
  await sleep(1200);
  await page.keyboard.press('1'); // left = lightning (records fire on press)
  await page.keyboard.down('Space');
  await sleep(150);
  await page.keyboard.press('2'); // right fires → otherDelta < 100ms → overload
  await sleep(250);
  await page.keyboard.up('Space');
  const overload = await getProjectileStats(6);
  results.overload = overload.projs.some(p => p.id === 'standard_blaster' && p.aoeDamage === 30 && p.aoeRadius === 1.2);
  console.log(`  Overload AOE on other hand's shot: ${results.overload ? '✅' : '❌'} (${overload.projs.map(p => `${p.id}:aoe${p.aoeDamage}`).join(', ') || 'none'})`);

  // ── Phase 6: Scatter-Seek (seeker_burst + buckshot) ──
  console.log('\n📍 Phase 6: Scatter-Seek (seeker homes to buckshot hits)...');
  await setWeapons('seeker_burst', 'buckshot');
  await sleep(1200);
  await page.keyboard.press('1'); // left = seeker
  await fireBoth(400);
  const scatter = await getProjectileStats(12);
  results.scatterSeek = scatter.projs.some(p => p.id === 'seeker_burst' && p.scatterSeek);
  console.log(`  Seeker projectiles tagged scatterSeek: ${results.scatterSeek ? '✅' : '❌'} (${scatter.projs.filter(p => p.id === 'seeker_burst' && p.scatterSeek).length} of ${scatter.projs.filter(p => p.id === 'seeker_burst').length})`);

  // ── Results ──
  console.log('\n============================================================');
  console.log('📊 Results:');
  if (errors.length === 0) {
    console.log('  ✅ No console errors');
  } else {
    console.log(`  ❌ ${errors.length} console error(s):`);
    errors.slice(0, 5).forEach(e => console.log(`     - ${e.substring(0, 120)}`));
  }
  const passed = errors.length === 0 && results.dualStrike && results.drill && results.momentum &&
                 results.heatWave && results.overload && results.scatterSeek;
  console.log(passed ? '\n✅ ALL TESTS PASSED' : '\n❌ TEST FAILURES');
  await browser.close();
  process.exit(passed ? 0 : 1);
}

runTest().catch(err => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
