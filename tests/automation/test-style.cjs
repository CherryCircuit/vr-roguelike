/**
 * Test: Bullet Carnival style system (#189)
 *
 *   - Pure grade boundaries (D→SSS)
 *   - Kill tracking: variety rises on first kill, drains on same-hand streaks;
 *     tempo rises on rapid kills; grade improves after a kill streak
 *   - Grade-up moment: style-flash fires, grade letter changes, sting plays
 *   - SSS: score multiplier (3x), health pickups drop (stubbed Math.random),
 *     projectile trail tint applied
 *   - Meter decay: meters fall over time without action
 *   - A+ grade: one offered upgrade card is a SPECIAL pool upgrade
 *   - resetGame clears style state
 *   - No console errors
 */
const puppeteer = require('puppeteer');

const GAME_URL = 'http://localhost:8000/dev.html';

async function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function runTest() {
  console.log('🧪 Bullet Carnival Style Test (#189)\n');
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

  const readStyle = () => page.evaluate(() => ({
    state: { ...window.game.styleState },
    grade: { ...window.game.styleGrade },
  }));

  const waitForEnemy = async () => {
    for (let i = 0; i < 20; i++) {
      const count = await page.evaluate(() => window.__test?.getEnemyCount?.() || 0);
      if (count > 0) return true;
      await sleep(500);
    }
    return false;
  };

  // Spawn a fresh basic enemy in front of the camera (returns when its mesh
  // is live). Kills go through the REAL projectile-system handleHit path so
  // score + style + drop rolls all fire — deterministic, no wave/pacing or
  // projectile-flight dependence.
  const prepareEnemy = async () => {
    for (let attempt = 0; attempt < 5; attempt++) {
      const spawned = await page.evaluate(async (distance) => {
        const THREE = await import('three');
        const enemies = await import('./enemies.js');
        const camera = window.__test?.getCamera?.();
        if (!camera) return false;
        const dir = new THREE.Vector3();
        camera.getWorldDirection(dir);
        const pos = camera.position.clone().addScaledVector(dir, distance);
        pos.y = 1.6;
        try {
          enemies.spawnEnemy('basic', pos, window.game._levelConfig || undefined);
          return true;
        } catch (e) { return false; }
      }, 4);
      if (!spawned) { await sleep(300); continue; }
      await sleep(300); // let the enemy register its mesh
      return true;
    }
    return false;
  };

  const killPrepared = async () => {
    const result = await page.evaluate(async () => {
      const enemies = await import('./enemies.js');
      const ps = await import('./projectile-system.js');
      const list = enemies.getEnemies();
      const idx = list.findIndex(e => e && e.hp > 0 && e.mesh);
      if (idx < 0) return { ok: false, reason: 'no live enemy' };
      const e = list[idx];
      const stats = {
        damage: 999, critChance: 0, critMultiplier: 2, fireWeakenMult: 1,
        effects: [], aoeRadius: 0, projectileCount: 1, spreadAngle: 0,
        homing: false, ricochetBounces: 0, piercing: false,
        vampiricInterval: 0, scatterSeek: false, forceExplosion: false,
        isRicochetHit: false,
      };
      const hitPoint = e.mesh.position.clone();
      try {
        ps.handleHit(idx, e, stats, hitPoint, 0, false, false, {});
        return { ok: true };
      } catch (err) {
        return { ok: false, reason: String(err).substring(0, 120) };
      }
    });
    return result.ok;
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
    window.game.playerName = 'StyleBot';
    window.game.state = 'playing';
    window.game.health = 6;
    window.game.level = 1;
    window.game.mainWeaponLocked = { left: true, right: true };
    window.game.mainWeapon = { left: 'standard_blaster', right: 'standard_blaster' };
    window.game.upgrades = { left: {}, right: {} };
  });
  await page.evaluate(async () => {
    const d = await import('./desktop-controls.js');
    if (!d.isEnabled()) d.enable();
  });
  await sleep(500);
  console.log('  ✅ In PLAYING state');

  const results = {};

  // ── Phase 2: Pure grade boundaries ──
  console.log('\n📍 Phase 2: Grade boundaries (pure)...');
  results.gradeBoundaries = await page.evaluate(async () => {
    const w = await import('./weapons.js');
    const g = (v, p, t, c) => w.computeStyleGrade({ variety: v, precision: p, tempo: t, creativity: c });
    return g(0, 0, 0, 0).grade === 'D' && g(25, 25, 25, 25).grade === 'C' &&
           g(55, 55, 55, 55).grade === 'A' && g(70, 70, 70, 70).grade === 'S' &&
           g(85, 85, 85, 85).grade === 'SS' && g(95, 95, 95, 95).grade === 'SSS';
  });
  console.log(`  D/C/A/S/SS/SSS boundaries: ${results.gradeBoundaries ? '✅' : '❌'}`);

  // ── Phase 3: Kill tracking ──
  console.log('\n📍 Phase 3: Kill tracking (variety/tempo/precision)...');
  await waitForEnemy();
  // Capture base projectile material colors BEFORE any grade-up (SS+ tint check)
  const baseColors = await page.evaluate(async () => {
    const ps = await import('./projectile-system.js');
    return [...ps.playerProjectileMaterials].filter(m => m.color).map(m => m.color.getHex());
  });
  await prepareEnemy();
  await killPrepared();
  let style = await readStyle();
  // ±1 tolerance: the meters decay continuously (2%/s) while the read runs
  results.varietyFirst = Math.abs(style.state.variety - 15) < 1;
  console.log(`  Variety after first kill (15): ${results.varietyFirst ? '✅' : '❌'} (${style.state.variety.toFixed(1)})`);
  // Streak drain + rapid-kill tempo, deterministically: seed the style state
  // with a "recent same-hand kill" AFTER the enemy is ready, so the next
  // kill lands ~100ms later and hits the -4 streak branch + <2s tempo branch.
  await prepareEnemy();
  await page.evaluate(() => {
    window.game.styleState = {
      variety: 50, precision: 0, tempo: 0, creativity: 0,
      lastKillHand: 'left', lastKillWeapon: 'standard_blaster',
      lastKillTime: performance.now() - 500,
    };
  });
  await sleep(100);
  await killPrepared();
  style = await readStyle();
  results.varietyStreak = Math.abs(style.state.variety - 46) < 3; // 50 - 4 (streak) - decay
  results.tempoRapid = style.state.tempo > 8; // +12 within 2s (decayed slightly)
  console.log(`  Variety drains on same-hand streak (~46): ${results.varietyStreak ? '✅' : '❌'} (${style.state.variety.toFixed(1)})`);
  console.log(`  Tempo rose on rapid kill (~12): ${results.tempoRapid ? '✅' : '❌'} (${style.state.tempo.toFixed(1)})`);

  // ── Phase 4: Grade improves + grade-up flash + letter ──
  console.log('\n📍 Phase 4: Grade-up moment...');
  await prepareEnemy();
  // Seed 48s (avg 48 → grade B pre-kill); the kill adds +15/+8/+12/+10 →
  // avg ~57 → grade A (B→A fires the grade-up flash), even after ~1s of decay.
  await page.evaluate(() => {
    window.game.styleState = {
      variety: 48, precision: 48, tempo: 48, creativity: 48,
      lastKillHand: 'right', lastKillWeapon: 'buckshot',
      lastKillTime: performance.now() - 500, // recent → tempo boost applies
    };
  });
  await sleep(100);
  await killPrepared();
  style = await readStyle();
  results.gradeUp = style.grade.tier < 6 && style.grade.grade === 'A';
  console.log(`  Grade improved to A: ${results.gradeUp ? '✅' : '❌'} (${style.grade.grade})`);
  // Flash mesh opacity poll (fades in ~170ms — poll fast)
  let flashSeen = false;
  for (let i = 0; i < 30; i++) {
    flashSeen = await page.evaluate(() => {
      const scene = window.__test?.getScene?.();
      const cam = window.__test?.getCamera?.();
      const flash = cam?.children.find(c => c.name === 'style-flash');
      return !!flash && flash.visible && flash.material.opacity > 0.05;
    });
    if (flashSeen) break;
    await sleep(20);
  }
  results.styleFlash = flashSeen;
  console.log(`  Grade-up flash fired: ${results.styleFlash ? '✅' : '❌'}`);
  const letter = await page.evaluate(() => {
    const scene = window.__test?.getScene?.();
    const hud = scene?.getObjectByName('style-hud');
    let text = null;
    hud?.traverse(c => { if (c.userData && c.userData.text) text = c.userData.text; });
    return text;
  });
  results.letter = letter && letter !== 'D';
  console.log(`  Grade letter updated (${letter}): ${results.letter ? '✅' : '❌'}`);

  // ── Phase 5: SSS rewards (multiplier, health drops, trail tint) ──
  console.log('\n📍 Phase 5: SSS rewards...');
  await prepareEnemy();
  // Force Math.random low so the 5% health-drop roll always fires
  await page.evaluate(() => { window.__origRandom = Math.random; Math.random = () => 0.01; });
  const scoreBefore = await page.evaluate(() => window.game.score);
  // Seed + kill in ONE evaluate: zero frames pass between, so the meters are
  // exactly 100 at grade time (the decay never gets a chance to drop SSS
  // below its 95-average threshold).
  await page.evaluate(async () => {
    window.game.styleState = { variety: 100, precision: 100, tempo: 100, creativity: 100, lastKillHand: null, lastKillWeapon: null, lastKillTime: 0 };
    const enemies = await import('./enemies.js');
    const ps = await import('./projectile-system.js');
    const list = enemies.getEnemies();
    const idx = list.findIndex(e => e && e.hp > 0 && e.mesh);
    if (idx < 0) return;
    const e = list[idx];
    const stats = {
      damage: 999, critChance: 0, critMultiplier: 2, fireWeakenMult: 1,
      effects: [], aoeRadius: 0, projectileCount: 1, spreadAngle: 0,
      homing: false, ricochetBounces: 0, piercing: false,
      vampiricInterval: 0, scatterSeek: false, forceExplosion: false,
      isRicochetHit: false,
    };
    ps.handleHit(idx, e, stats, e.mesh.position.clone(), 0, false, false, {});
  });
  await sleep(400); // let the grade letter texture update (next frames)
  const after = await page.evaluate(() => ({
    score: window.game.score,
    grade: window.game.styleGrade.grade,
    letter: (() => {
      const scene = window.__test?.getScene?.();
      const hud = scene?.getObjectByName('style-hud');
      let t = null;
      hud?.traverse(c => { if (c.userData && c.userData.text) t = c.userData.text; });
      return t;
    })(),
  }));
  // The meters decay continuously, so a single delayed read can land at SS.
  // Poll: reseed 100s + read the recomputed grade until SSS is observed.
  let sssGrade = after.grade === 'SSS';
  let sssLetter = after.letter === 'SSS';
  if (!sssGrade || !sssLetter) {
    for (let i = 0; i < 12 && (!sssGrade || !sssLetter); i++) {
      await page.evaluate(() => {
        window.game.styleState = { variety: 100, precision: 100, tempo: 100, creativity: 100, lastKillHand: null, lastKillWeapon: null, lastKillTime: 0 };
      });
      await sleep(80);
      const polled = await page.evaluate(() => {
        const scene = window.__test?.getScene?.();
        const hud = scene?.getObjectByName('style-hud');
        let t = null;
        hud?.traverse(c => { if (c.userData && c.userData.text) t = c.userData.text; });
        return { grade: window.game.styleGrade.grade, letter: t };
      });
      sssGrade = sssGrade || polled.grade === 'SSS';
      sssLetter = sssLetter || polled.letter === 'SSS';
    }
  }
  results.sssGrade = sssGrade && sssLetter;
  const hasPickup = await page.evaluate(() => {
    const scene = window.__test?.getScene?.();
    let found = false;
    scene?.traverse(o => { if (o.name === 'health-pickup') found = true; });
    return found;
  });
  results.scoreMult = after.score - scoreBefore >= 30; // 10 × 3.0 × accuracy(≥1)
  results.healthDrop = hasPickup;
  console.log(`  SSS grade + letter: ${results.sssGrade ? '✅' : '❌'} (${after.grade}/${after.letter})`);
  console.log(`  Score multiplier ≥3x (${after.score - scoreBefore} pts): ${results.scoreMult ? '✅' : '❌'}`);
  console.log(`  Health pickup dropped (S+): ${results.healthDrop ? '✅' : '❌'}`);

  // Trail tint: player projectile materials shifted from their base color
  results.trailTint = await page.evaluate(async (base) => {
    const ps = await import('./projectile-system.js');
    const colors = [...ps.playerProjectileMaterials].filter(m => m.color).map(m => m.color.getHex());
    if (colors.length === 0 || base.length === 0) return false;
    return colors.some(c => !base.includes(c));
  }, baseColors);
  console.log(`  SS+ projectile trail tint: ${results.trailTint ? '✅' : '❌'}`);
  // restore randomness
  await page.evaluate(() => { Math.random = window.__origRandom || Math.random; });

  // ── Phase 6: Meter decay ──
  console.log('\n📍 Phase 6: Meter decay...');
  await page.evaluate(() => {
    window.game.styleState = { variety: 100, precision: 100, tempo: 100, creativity: 100, lastKillHand: null, lastKillWeapon: null, lastKillTime: 0 };
  });
  await sleep(2600); // ~2.6s: tempo decays 3%/s (~92), others 2%/s (~95)
  style = await readStyle();
  results.decay = style.state.variety < 99 && style.state.tempo < 96;
  console.log(`  Meters decay over time (v=${style.state.variety.toFixed(1)} t=${style.state.tempo.toFixed(1)}): ${results.decay ? '✅' : '❌'}`);

  // ── Phase 7: A+ special upgrade card ──
  console.log('\n📍 Phase 7: A+ special upgrade card...');
  await page.evaluate(() => {
    window.game.styleState = { variety: 100, precision: 100, tempo: 100, creativity: 100, lastKillHand: null, lastKillWeapon: null, lastKillTime: 0 };
    window.game.nextUpgradeHand = 'left';
  });
  await page.evaluate(() => window.__test.progression.forceLevelComplete({ autoSelect: false }));
  const start = Date.now();
  while (Date.now() - start < 12000) {
    const st = await page.evaluate(() => window.game?.state);
    if (st === 'upgrade_select') break;
    await sleep(300);
  }
  await sleep(1600);
  const offered = await page.evaluate(() => window.__test.progression.getPendingUpgrades());
  const specialIds = ['mega_scope', 'turbo_barrel', 'triple_shot', 'super_crit', 'life_steal', 'overcharge', 'mega_boom'];
  results.specialCard = offered.some(s => specialIds.includes(s.id));
  console.log(`  Special upgrade card offered at A+: ${results.specialCard ? '✅' : '❌'} (${offered.slice(0, 3).map(s => s.id).join(', ')})`);
  // Leave the screen cleanly (the special card is selectable like any other)
  await page.evaluate(() => window.__test.progression.selectUpgradeByIndex(0));
  await sleep(400);
  await page.evaluate(async () => {
    const THREE = await import('three');
    const scene = window.__test?.getScene?.();
    const camera = window.__test?.getCamera?.();
    const btn = scene?.getObjectByName('alchemy-btn-continue');
    if (btn && camera) {
      camera.updateMatrixWorld(true);
      const camPos = camera.position.clone();
      const target = new THREE.Vector3();
      btn.getWorldPosition(target);
      const dir = new THREE.Vector3().subVectors(target, camPos);
      if (dir.lengthSq() > 0) {
        dir.normalize();
        camera.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, -1), dir);
        camera.rotation.setFromQuaternion(camera.quaternion);
      }
    }
  });
  await sleep(300);
  await page.mouse.click(640, 400);
  await sleep(1500);

  // ── Phase 8: Reset clears style ──
  console.log('\n📍 Phase 8: Reset clears style state...');
  await page.evaluate(() => window.__test.progression.runPlan({ segments: [{ levelCount: 1 }], autoUpgrades: 'first-card' }));
  await sleep(2500);
  const resetStyle = await page.evaluate(() => ({
    state: { ...window.game.styleState },
    grade: window.game.styleGrade.grade,
  }));
  results.reset = resetStyle.state.variety === 0 && resetStyle.grade === 'D';
  console.log(`  Style state cleared on reset: ${results.reset ? '✅' : '❌'}`);

  // ── Results ──
  console.log('\n============================================================');
  console.log('📊 Results:');
  if (errors.length === 0) {
    console.log('  ✅ No console errors');
  } else {
    console.log(`  ❌ ${errors.length} console error(s):`);
    errors.slice(0, 5).forEach(e => console.log(`     - ${e.substring(0, 120)}`));
  }
  const passed = errors.length === 0 && results.gradeBoundaries && results.varietyFirst &&
                 results.varietyStreak && results.tempoRapid && results.gradeUp && results.styleFlash &&
                 results.letter && results.sssGrade && results.scoreMult && results.healthDrop &&
                 results.trailTint && results.decay && results.specialCard && results.reset;
  console.log(passed ? '\n✅ ALL TESTS PASSED' : '\n❌ TEST FAILURES');
  await browser.close();
  process.exit(passed ? 0 : 1);
}

runTest().catch(err => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
