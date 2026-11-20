/**
 * Test: visual systems + readability audit (round 11)
 *
 * Covers the player-facing items that no existing suite asserted:
 *   1. Cinematic level transitions — camera-locked overlay, level card text,
 *      animated cover, clean teardown.
 *   2. Menu presence — every world-space menu re-anchors in front of the
 *      player after they turn away (never "impossible to see").
 *   3. Button geometry — every visible button in every menu has a usable
 *      angular size (≥ 2.5° tall/wide on a Quest-ish 100° FOV).
 *   4. Quest thumbstick scrolling — axes[3] mapping scrolls the alchemy bench
 *      and evolutions list (the old code only read axes[1]).
 *   5. Enemy readability — silhouettes have real voxel volume, boss bodies
 *      are merged (1 draw call) with capped weak points, ground shadows and
 *      attack-intent rings track live enemies, mortar shells show a landing
 *      marker.
 *   6. Projectile visibility — every instanced projectile pool renders a
 *      visible core + additive glow in front of the camera.
 *   7. Stress performance — 20+ enemies + sustained fire stays under a
 *      generous headless frame-time/draw-call ceiling.
 *
 * Run: node tests/automation/test-visuals.cjs
 * Needs the dev server on :8001.
 */
const puppeteer = require('puppeteer');
const path = require('path');

const URL = 'http://localhost:8001/dev.html';
const SHOT = 'tests/screenshots/visual-audit';
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

async function main() {
  console.log('🧪 Visual systems + readability audit\n' + '='.repeat(72));

  const results = {};
  const errors = [];
  const browser = await puppeteer.launch({
    headless: 'new',
    args: [
      '--no-sandbox', '--disable-setuid-sandbox', '--use-angle=swiftshader',
      '--enable-webgl', '--ignore-gpu-blocklist', '--disable-gpu-sandbox',
    ],
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 800 });

  page.on('console', (m) => {
    if (m.type() !== 'error') return;
    const url = m.location()?.url || '';
    const text = String(m.text());
    // Documented benign noise: static-dev-server death-stats 404 + favicon.
    if (url.includes('death-stats') || text.includes('favicon')) return;
    if (text.includes('501') || text.includes('404')) return;
    errors.push(text.slice(0, 240));
  });
  page.on('pageerror', (e) => errors.push('pageerror: ' + e.message.slice(0, 240)));

  await page.goto(URL, { waitUntil: 'networkidle2', timeout: 30000 });
  await sleep(3500);

  // ── helpers installed in the page ──────────────────────────────────
  await page.evaluate(() => {
    window.__va = {
      setCamera(yawDeg = 0, pitchDeg = 0) {
        const cam = window.__test.getCamera();
        const E = cam.rotation.constructor;
        cam.position.set(0, 1.7, 0);
        cam.quaternion.setFromEuler(new E(pitchDeg * Math.PI / 180, yawDeg * Math.PI / 180, 0, 'YXZ'));
        cam.updateMatrixWorld(true);
      },
      // Buttons = meshes whose userData identifies an interactive action.
      collectButtons(rootName) {
        const scene = window.__test.getScene();
        const root = scene.getObjectByName(rootName);
        if (!root) return null;
        const cam = window.__test.getCamera();
        const p = cam.position.constructor;
        const out = [];
        root.traverse((o) => {
          if (!o.isMesh || !o.geometry) return;
          const u = o.userData || {};
          const isBtn = u.isUpgradeCard || u.isResumeButton || u.isPauseSettingsBtn ||
            u.isSettingsBtn || u.isTitleScoreboardBtn || u.isTitleSettingsBtn ||
            u.isTitleBestiaryBtn || u.isTitleTrainingBtn ||
            u.alchemyAction || u.trainingAction || u.scoreboardAction ||
            u.isCountryAction || u.countryAction || u.countryCode || u.continentTab || u.isKeyboardKey;
          if (!isBtn) return;
          let vis = true, q = o;
          while (q) { if (q.visible === false) { vis = false; break; } q = q.parent; }
          if (!vis) return;
          if (!o.geometry.boundingBox) o.geometry.computeBoundingBox();
          const bb = o.geometry.boundingBox;
          const size = bb.max.clone().sub(bb.min);
          const worldScale = o.getWorldScale(new p());
          const w = Math.abs(size.x * worldScale.x);
          const h = Math.abs(size.y * worldScale.y);
          if (w < 0.001 || h < 0.001) return;
          const world = o.getWorldPosition(new p());
          const d = Math.max(0.2, world.distanceTo(cam.position));
          const angW = 2 * Math.atan((w / 2) / d) * 180 / Math.PI;
          const angH = 2 * Math.atan((h / 2) / d) * 180 / Math.PI;
          out.push({
            name: o.name || '(unnamed)',
            w: +w.toFixed(3), h: +h.toFixed(3), d: +d.toFixed(2),
            angW: +angW.toFixed(1), angH: +angH.toFixed(1),
          });
        });
        return out;
      },
      // Project a menu's bounding-box centre into normalised screen space.
      projectMenu(rootName) {
        const scene = window.__test.getScene();
        const root = scene.getObjectByName(rootName);
        if (!root) return null;
        const cam = window.__test.getCamera();
        const V = cam.position.constructor;
        root.updateMatrixWorld(true);
        const centre = root.getWorldPosition(new V());
        const projected = centre.clone().project(cam);
        return { x: +projected.x.toFixed(3), y: +projected.y.toFixed(3), z: +projected.z.toFixed(3) };
      },
      countMarkerPools() {
        return window.__test.enemyReadability.getMarkers();
      },
      // Raycast from the camera at every visible button centre and resolve it
      // through the same hit function the trigger/click path uses.
      async buttonHits(groupName, kind) {
        const THREE = await import('three');
        const hud = await import('./hud.js');
        const training = await import('./training-ground.js');
        const scene = window.__test.getScene();
        const root = scene.getObjectByName(groupName);
        if (!root) return [];
        const cam = window.__test.getCamera();
        const V = cam.position.constructor;
        const rc = new THREE.Raycaster();
        const matches = (u) => {
          if (kind === 'cards') return !!u.isUpgradeCard;
          if (kind === 'alchemy') return !!u.alchemyAction;
          if (kind === 'training') return !!u.trainingAction;
          if (kind === 'title') return !!(u.isTitleScoreboardBtn || u.isTitleSettingsBtn || u.isTitleBestiaryBtn || u.isTitleTrainingBtn);
          if (kind === 'pause') return !!(u.isResumeButton || u.isPauseSettingsBtn);
          if (kind === 'settings') return !!u.isSettingsBtn;
          if (kind === 'bestiary') return !!u.scoreboardAction;
          if (kind === 'scoreboard') return !!u.scoreboardAction;
          if (kind === 'country') return !!(u.isCountryAction || u.countryAction || u.isCountryBtn);
          return false;
        };
        const buttons = [];
        root.traverse((o) => {
          if (!o.isMesh || !o.geometry) return;
          if (!matches(o.userData || {})) return;
          let vis = true, q = o;
          while (q) { if (q.visible === false) { vis = false; break; } q = q.parent; }
          if (!vis) return;
          buttons.push(o);
        });
        const out = [];
        for (let i = 0; i < buttons.length; i++) {
          const world = buttons[i].getWorldPosition(new V());
          const dir = world.clone().sub(cam.position);
          if (dir.lengthSq() < 1e-6) continue;
          dir.normalize();
          rc.set(cam.position, dir, 0.05, 12);
          let action = null;
          if (kind === 'title') action = hud.getTitleButtonHit(rc);
          else if (kind === 'pause') action = hud.getPauseMenuHit(rc);
          else if (kind === 'settings') action = hud.getSettingsHit(rc);
          else if (kind === 'alchemy') action = hud.getAlchemyBenchHit(rc);
          else if (kind === 'training') action = training.getTrainingMenuHit(rc);
          else if (kind === 'bestiary') action = hud.getBestiaryHit(rc);
          else if (kind === 'scoreboard') action = hud.getScoreboardHit(rc);
          else if (kind === 'country') { const sb = await import('./scoreboard.js'); action = hud.getCountrySelectHit(rc, sb.COUNTRIES); }
          else if (kind === 'cards') {
            const sel = hud.getUpgradeCardHit(rc);
            action = sel && sel.upgrade ? (sel.upgrade.id || 'skip') : null;
          }
          out.push({ action: action && action.type ? action.type : action, ok: action != null, name: buttons[i].name || '(unnamed)', pos: [+world.x.toFixed(2), +world.y.toFixed(2), +world.z.toFixed(2)] });
        }
        return out;
      },
    };
  });

  const setCam = (yaw = 0, pitch = 0) => page.evaluate((y, p) => window.__va.setCamera(y, p), yaw, pitch);
  const menuState = () => page.evaluate(() => window.__test.menus.getState());
  const angleFor = async (name) => {
    const list = await menuState();
    const entry = list.find(e => e.name === name);
    return entry ? entry.angleDeg : null;
  };
  const projectMenu = (name) => page.evaluate((n) => window.__va.projectMenu(n), name);

  // ── 1. Transition overlay ─────────────────────────────────────────
  console.log('\n📍 cinematic level transition');
  await setCam(0, 0);
  const t0 = await page.evaluate(() => {
    const started = window.__test.transitions.play({
      level: 3, biomeId: 'desert_night', duration: 2.4, eyebrow: 'TEST SECTOR',
    });
    return { started, state: window.__test.transitions.getState() };
  });
  results.transitionStarts = !!t0.started && t0.state.active === true;
  results.transitionCameraChild = t0.state.childOfCamera === true;
  results.transitionTitle = t0.state.title === 'LEVEL 03' && t0.state.subtitle === 'DESERT NIGHT';
  results.transitionEyebrow = t0.state.eyebrow === 'TEST SECTOR';

  await sleep(900);
  await page.screenshot({ path: `${SHOT}-transition.png` });
  const tMid = await page.evaluate(() => window.__test.transitions.getState());
  results.transitionAnimates = tMid.active && tMid.progress > 0.1 && tMid.cover > 0.4;

  // Turning the head must not hide the overlay (it is a camera child).
  await setCam(160, 20);
  const tTurn = await page.evaluate(() => window.__test.transitions.getState());
  results.transitionFollowsHead = tTurn.active && tTurn.childOfCamera;
  await setCam(0, 0);

  await sleep(2200);
  const tEnd = await page.evaluate(() => {
    const state = window.__test.transitions.getState();
    const group = window.__test.getScene().getObjectByName('level-transition-overlay');
    const card = window.__test.getScene().getObjectByName('level-transition-card');
    return { state, visible: group ? group.visible : null, cardLeft: !!card };
  });
  results.transitionEnds = tEnd.state.active === false && tEnd.visible === false && !tEnd.cardLeft;

  // ── 2. Menu presence (never impossible to see) ────────────────────
  console.log('\n📍 menu presence after turning around');
  await setCam(0, 0);
  await page.evaluate(async () => {
    window.game.state = 'paused';
    const h = await import('./hud.js');
    h.showPauseMenu();
  });
  await sleep(700);
  await setCam(180, 0);
  await sleep(2200);
  const pauseAngle = await angleFor('pause-menu');
  const pauseProj = await projectMenu('pause-menu');
  results.pauseRecenters = pauseAngle != null && pauseAngle < 60;
  results.pauseOnScreen = !!pauseProj && Math.abs(pauseProj.x) < 0.98 && Math.abs(pauseProj.y) < 0.98 && pauseProj.z < 1;
  await page.screenshot({ path: `${SHOT}-pause-recentered.png` });

  await page.evaluate(async () => {
    const h = await import('./hud.js');
    h.hidePauseMenu();
    window.game.state = 'upgrade_select';
    h.showUpgradeCards([
      { id: 'damage', name: 'Damage Up', desc: 'More damage', color: '#00ffff' },
      { id: 'fire_rate', name: 'Fire Rate', desc: 'Faster fire', color: '#ff00ff' },
    ], { x: 0, y: 1.7, z: 0 }, 'left');
  });
  await setCam(90, 0);
  await sleep(2200);
  const cardAngle = await angleFor('upgrade-cards');
  const cardProj = await projectMenu('upgrade-cards');
  results.cardsRecenter = cardAngle != null && cardAngle < 60;
  results.cardsOnScreen = !!cardProj && Math.abs(cardProj.x) < 0.98 && Math.abs(cardProj.y) < 0.98;

  await page.evaluate(async () => {
    const s = await import('./settings-menu.js');
    await s.showSettings('pause');
  });
  await sleep(500);
  await setCam(200, 0);
  await sleep(2200);
  const settingsAngle = await angleFor('settings-menu');
  results.settingsRecenters = settingsAngle != null && settingsAngle < 60;
  await page.evaluate(async () => {
    const s = await import('./settings-menu.js');
    s.hideSettings();
  });
  await setCam(0, 0);

  // ── 3. Button angular sizes ───────────────────────────────────────
  console.log('\n📍 button sizes (all menus)');
  const menuCases = [
    { name: 'title', group: 'title-screen', kind: 'title', open: null },
    { name: 'pause', group: 'pause-menu', kind: 'pause', open: async () => {
      await page.evaluate(async () => { const h = await import('./hud.js'); window.game.state = 'paused'; h.showPauseMenu(); });
    } },
    { name: 'settings', group: 'settings-menu', kind: 'settings', open: async () => {
      await page.evaluate(async () => { const s = await import('./settings-menu.js'); await s.showSettings('pause'); });
    } },
    { name: 'upgrade-cards', group: 'upgrade-cards', kind: 'cards', open: async () => {
      await page.evaluate(async () => {
        const h = await import('./hud.js'); const s = await import('./settings-menu.js');
        s.hideSettings(); h.hidePauseMenu(); window.game.state = 'upgrade_select';
        h.showUpgradeCards([{ id: 'damage', name: 'Damage', desc: 'More damage', color: '#00ffff' }],
          { x: 0, y: 1.7, z: 0 }, 'left');
      });
    } },
    { name: 'alchemy', group: 'alchemy-bench', kind: 'alchemy', open: async () => {
      await page.evaluate(async () => {
        const h = await import('./hud.js');
        window.game.upgrades.left = { scope: 1, fire: 1, barrel: 1, piercing: 1, critical: 1, double_shot: 1, vampiric: 1, shock: 1, freeze: 1 };
        window.game.alchemyEssence = 40;
        h.showAlchemyBench('left');
      });
    } },
    { name: 'evolutions', group: 'evolutions-menu', kind: 'alchemy', open: async () => {
      await page.evaluate(async () => { const h = await import('./hud.js'); h.hideAlchemyBench(); h.showEvolutionsMenu(); });
    } },
    { name: 'training', group: 'training-menu', kind: 'training', open: async () => {
      await page.evaluate(async () => {
        const h = await import('./hud.js'); const tg = await import('./training-ground.js');
        h.hideEvolutionsMenu(); h.hideHUD(); h.hideTitle();
        tg.startTraining(); tg.showTrainingMenu();
      });
    } },
    { name: 'bestiary', group: 'bestiary', kind: 'bestiary', open: async () => {
      await page.evaluate(async () => {
        const h = await import('./hud.js'); const tg = await import('./training-ground.js');
        tg.exitTraining(); h.hideHUD(); h.showBestiary({ x: 0, y: 1.7, z: 0 });
      });
    } },
    { name: 'scoreboard', group: 'scoreboard', kind: 'scoreboard', open: async () => {
      await page.evaluate(async () => {
        const h = await import('./hud.js');
        h.hideBestiary();
        h.showScoreboard([{ name: 'TESTER', score: 1234, level: 3, country: 'CA' }], null, null);
      });
    } },
    { name: 'country-select', group: 'country-select', kind: 'country', open: async () => {
      await page.evaluate(async () => {
        const h = await import('./hud.js'); const sb = await import('./scoreboard.js');
        h.hideScoreboard();
        h.showCountrySelect(sb.COUNTRIES, sb.CONTINENTS, 'Europe', { x: 0, y: 1.7, z: 0 });
      });
    } },
  ];

  const buttonReports = {};
  const buttonHitReports = {};
  for (const c of menuCases) {
    // Deterministic facing for every menu: previous cases turn the head.
    await setCam(0, 0);
    if (c.open) await c.open();
    if (c.name === 'title') {
      // hide everything else so only the title buttons are measured
      await page.evaluate(async () => {
        const tg = await import('./training-ground.js');
        tg.exitTraining();
        const h = await import('./hud.js');
        h.hideHUD(); h.showTitle();
      });
      await sleep(700);
    }
    await sleep(500);
    const buttons = await page.evaluate((g) => window.__va.collectButtons(g), c.group);
    buttonReports[c.name] = buttons || [];
    const hits = await page.evaluate(([g, k]) => window.__va.buttonHits(g, k), [c.group, c.kind]);
    buttonHitReports[c.name] = hits || [];
    await sleep(100);
  }
  // Remove any buttons whose menu is now hidden (collection already filters).
  for (const [name, list] of Object.entries(buttonReports)) {
    const meaningful = list.filter(b => b.angH > 0);
    results[`buttons-${name}-count`] = meaningful.length >= 1;
    results[`buttons-${name}-min-size`] = meaningful.every(b => b.angH >= 2.5 && b.angW >= 2.5);
    if (!results[`buttons-${name}-min-size`]) {
      console.log(`  ⚠ ${name} small buttons:`, meaningful.filter(b => b.angH < 2.5 || b.angW < 2.5).slice(0, 5));
    }
    const hits = buttonHitReports[name] || [];
    results[`buttons-${name}-hit`] = hits.length >= 1 && hits.every(h => h.ok);
    if (!results[`buttons-${name}-hit`]) {
      console.log(`  ⚠ ${name} dead buttons:`, hits.filter(h => !h.ok).slice(0, 6));
    }
  }

  // ── 4. Quest thumbstick scrolling (axes[3]) ───────────────────────
  console.log('\n📍 thumbstick scroll (Quest axes[3])');
  await page.evaluate(async () => {
    const h = await import('./hud.js');
    const tg = await import('./training-ground.js');
    tg.exitTraining();
    window.game.state = 'upgrade_select';
    // Six dissolvable upgrades so the bench has a scrollable list.
    window.game.upgrades.left = { scope: 1, fire: 1, barrel: 1, piercing: 1, critical: 1, double_shot: 1, vampiric: 1, shock: 1, freeze: 1 };
    window.game.alchemyEssence = 40;
    h.showUpgradeCards([{ id: 'damage', name: 'Damage', desc: 'x', color: '#00ffff' }], { x: 0, y: 1.7, z: 0 }, 'left');
    h.showAlchemyBench('left');
  });
  await sleep(600);
  const readChips = () => page.evaluate(() => {
    const pan = window.__test.getScene().getObjectByName('alchemy-bench');
    if (!pan) return null;
    const out = [];
    const V = window.__test.getCamera().position.constructor;
    pan.updateMatrixWorld(true);
    const inv = pan.matrixWorld.clone().invert();
    pan.traverse((o) => {
      if (!o.userData || !o.userData.alchemyAction || !o.geometry) return;
      if (o.userData.alchemyAction.type !== 'dissolve_preview') return;
      let vis = true, q = o;
      while (q) { if (q.visible === false) { vis = false; break; } q = q.parent; }
      if (!vis) return;
      const local = o.getWorldPosition(new V()).applyMatrix4(inv);
      out.push(`${o.userData.alchemyAction.upgradeId || '?'}@${local.y.toFixed(3)}`);
    });
    return out;
  });
  await page.evaluate(() => {
    const r = window.__test.getRenderer();
    r.xr.getSession = () => ({ inputSources: [{ gamepad: { axes: [0, 0, 0, -1], buttons: [] } }] });
  });
  const chipsBefore = await readChips();
  const joyDebugBefore = await page.evaluate(async (chipCount) => {
    const h = await import('./hud.js');
    return {
      open: h.isAlchemyBenchOpen(),
      state: window.game.state,
      hasSession: !!window.__test.getRenderer().xr.getSession(),
      bench: !!window.__test.getScene().getObjectByName('alchemy-bench'),
      chips: chipCount,
    };
  }, chipsBefore ? chipsBefore.length : -1);
  await sleep(7000);
  await page.evaluate(() => { window.__test.getRenderer().xr.getSession = () => null; });
  const chipsAfter = await readChips();
  if (JSON.stringify(chipsBefore) === JSON.stringify(chipsAfter)) {
    console.log('  joystick debug:', JSON.stringify({ chipsBefore, chipsAfter, joyDebugBefore }));
  }
  results.joystickScrollsAlchemy = !!chipsBefore && !!chipsAfter && JSON.stringify(chipsBefore) !== JSON.stringify(chipsAfter);

  // ── 5. Enemy readability ─────────────────────────────────────────
  console.log('\n📍 enemy silhouette fidelity + intent');
  const enemyStats = await page.evaluate(() => window.__test.enemyReadability.getEnemyStats());
  const bossStats = await page.evaluate(() => window.__test.enemyReadability.getBossStats());
  const mustRead = ['basic', 'fast', 'tank', 'swarm', 'mortar', 'bombardier', 'void_anchor',
    'void_tendril', 'echo_phantom', 'leech', 'conductor', 'mirror_knight'];
  results.silhouettesHaveVolume = mustRead.every(t => enemyStats[t] && enemyStats[t].voxels >= 10);
  results.silhouettesReadableSize = mustRead.every(t => enemyStats[t].width >= 0.35 && enemyStats[t].height >= 0.3);
  results.bossesHaveDetail = bossStats.scrap_golem.cells >= 40 && bossStats.the_maw.cells >= 30;
  results.bossMergeOptIn = bossStats.scrap_golem.mergedBody === true && bossStats.pulse_emitter.mergedBody === true;

  // Spawn a readability lineup + measure live marker pools.
  const spawn = async () => page.evaluate(async (types) => {
    const en = await import('./enemies.js');
    const h = await import('./hud.js');
    h.hideHUD(); h.hideTitle();
    en.clearAllEnemies();
    const cfg = window.game._levelConfig;
    const around = types.length;
    for (let i = 0; i < around; i++) {
      const x = (i - (around - 1) / 2) * 2.0;
      en.spawnEnemy(types[i], { x, y: 1.4, z: -9 }, cfg);
    }
    const cam = window.__test.getCamera();
    cam.position.set(0, 2.0, 0);
    cam.quaternion.set(0, 0, 0, 1);
    cam.updateMatrixWorld(true);
    return en.getEnemies().length;
  }, mustRead);
  // ensure a playable state for spawn + updates
  await page.evaluate(async () => {
    await window.__test.progression.startAt({ level: 3 }).catch(() => {});
  });
  const spawned = await spawn();
  await sleep(2200);
  const markers = await page.evaluate(() => window.__va.countMarkerPools());
  results.groundShadowsTrackEnemies = markers.shadows >= Math.max(1, spawned - 1);
  results.intentRingsPresent = markers.intentRings >= 1;
  await page.screenshot({ path: `${SHOT}-enemy-lineup.png` });

  // Mortar landing marker: call the real spawn path.
  const landingBefore = await page.evaluate(() => {
    const before = window.__va.countMarkerPools().landingMarkers;
    return before;
  });
  await page.evaluate(async () => {
    const en = await import('./enemies.js');
    const THREE = await import('three');
    en.spawnMortarProjectile(new THREE.Vector3(3, 2.2, -8), new THREE.Vector3(0, 0, -3), 2.0);
  });
  await sleep(400);
  const landingAfter = await page.evaluate(() => window.__va.countMarkerPools().landingMarkers);
  results.mortarLandingMarker = landingAfter > landingBefore;

  // ── 6. Boss body merge + weak point cap ─────────────────────────
  console.log('\n📍 boss body merge + weak points');
  const bossInfo = await page.evaluate(async () => {
    const en = await import('./enemies.js');
    en.clearAllEnemies();
    en.clearBoss();
    const boss = en.spawnBoss('scrap_golem', window.game._levelConfig);
    let mergedBody = 0;
    boss.mesh.traverse((o) => { if (o.userData && o.userData.isMergedBossBody) mergedBody++; });
    const callsBefore = window.__test.getRenderer().info.render.calls;
    return {
      mergedBody,
      children: boss.mesh.children.length,
      weak: boss.weakPoints.length,
      weakPositionsUnique: new Set(boss.weakPoints.map(w => w.position.toArray().join(','))).size,
      callsBefore,
    };
  });
  results.bossBodyMerged = bossInfo.mergedBody === 1;
  results.bossWeakPointsCapped = bossInfo.weak >= 3 && bossInfo.weak <= 6;
  results.bossDrawCallsLow = bossInfo.children <= 10;
  await page.evaluate(async () => { const en = await import('./enemies.js'); en.clearBoss(); en.clearAllEnemies(); });

  // ── 7. Projectile visibility ─────────────────────────────────────
  console.log('\n📍 projectile pools visible');
  const projInfo = await page.evaluate(async () => {
    const ps = await import('./projectile-system.js');
    const THREE = await import('three');
    const cam = window.__test.getCamera();
    cam.position.set(0, 1.7, 0);
    cam.quaternion.set(0, 0, 0, 1);
    cam.updateMatrixWorld(true);
    // Slow-mo freezes the shells in the visible cone long enough to inspect.
    window.game.slowmoActive = true;
    window.game.slowmoIntensity = 0.03;
    window.game.slowmoTimer = performance.now() + 20000;
    window.game.timeScale = 0.03;

    const origin = new THREE.Vector3(0, 1.6, -3);
    const dir = new THREE.Vector3(0, 0, -1);
    ps.spawnProjectile(origin.clone(), dir, 0, { damage: 10, speed: 30, mainWeaponId: 'standard_blaster' }, 'va-laser');
    ps.spawnProjectile(origin.clone(), dir, 0, { damage: 8, speed: 24, spreadAngle: 0.2, mainWeaponId: 'buckshot' }, 'va-buck');
    ps.spawnProjectile(origin.clone(), dir, 0, { damage: 8, speed: 18, homing: true, mainWeaponId: 'seeker_burst' }, 'va-seek');
    ps.spawnProjectile(origin.clone(), dir, 0, { damage: 8, speed: 28, mainWeaponId: 'plasma_carbine' }, 'va-plasma');

    await new Promise(r => setTimeout(r, 250));
    const V = THREE.Vector3;
    const pools = {};
    for (const [type, pool] of Object.entries(ps.instancedProjectiles)) {
      if (!pool || !pool.mesh) { pools[type] = null; continue; }
      const count = pool.mesh.count;
      let onScreen = 0;
      // Project each live projectile's position (only this type's data).
      const data = ps.projectileInstanceData[type] || [];
      for (let i = 0; i < data.length; i++) {
        const entry = data[i];
        if (!entry || !entry.active) continue;
        const pos = new V().copy(pool.mesh.position);
        // Read the instance matrix translation for this slot.
        const m = new THREE.Matrix4();
        pool.mesh.getMatrixAt(i, m);
        pos.setFromMatrixPosition(m);
        const p = pos.clone().project(cam);
        if (Math.abs(p.x) < 1 && Math.abs(p.y) < 1 && p.z < 1 && p.z > -1) onScreen++;
      }
      pools[type] = {
        count,
        onScreen,
        visible: pool.mesh.visible,
        opacity: pool.mesh.material.opacity,
        glowCount: pool.glowMesh ? pool.glowMesh.count : 0,
        glowVisible: pool.glowMesh ? pool.glowMesh.visible : false,
      };
    }
    // Hostile projectile pool: needs an active boss (by design — boss shots
    // are gated on a live boss to prevent leaks during transitions).
    const en = await import('./enemies.js');
    const THREE2 = await import('three');
    const scene = window.__test.getScene();
    en.clearBoss();
    en.spawnBoss('scrap_golem', window.game._levelConfig);
    en.spawnBossProjectile(new THREE2.Vector3(0, 2, -8), new THREE2.Vector3(0, 1.7, 0), false);
    await new Promise(r => setTimeout(r, 200));
    const bossPoolNow = scene.getObjectByName('boss-projectile-pool');
    const bossGlowPoolNow = scene.getObjectByName('boss-projectile-glow-pool');
    return {
      pools,
      bossPool: bossPoolNow ? { count: bossPoolNow.count, visible: bossPoolNow.visible } : null,
      bossGlowPool: bossGlowPoolNow ? { count: bossGlowPoolNow.count, visible: bossGlowPoolNow.visible } : null,
    };
  });
  results.laserVisible = projInfo.pools.laser.count >= 1 && projInfo.pools.laser.visible &&
    projInfo.pools.laser.opacity > 0.1 && projInfo.pools.laser.glowCount >= 1;
  results.buckshotVisible = projInfo.pools.buckshot.count >= 1 && projInfo.pools.buckshot.glowCount >= 1;
  results.seekerVisible = projInfo.pools.seeker.count >= 1 && projInfo.pools.seeker.glowCount >= 1;
  results.plasmaVisible = projInfo.pools.plasma_carbine.count >= 1 && projInfo.pools.plasma_carbine.glowCount >= 1;
  results.projectilesOnScreen = projInfo.pools.laser.onScreen >= 1;
  results.enemyProjectilesVisible = !!projInfo.bossPool && projInfo.bossPool.visible && projInfo.bossPool.count >= 1;
  await page.screenshot({ path: `${SHOT}-projectiles.png` });

  // ── 8. Stress performance ────────────────────────────────────────
  console.log('\n📍 stress performance (20 enemies + fire)');
  await page.evaluate(async () => {
    window.game.slowmoActive = false;
    window.game.timeScale = 1;
    window.game.trainingMode = true;   // keep the level from completing mid-measure
    window.game.state = 'playing';
    window.game.kills = 0;
    window.__test.transitions.end();
    const en = await import('./enemies.js');
    const ps = await import('./projectile-system.js');
    const h = await import('./hud.js');
    const s = await import('./settings-menu.js');
    h.hideAlchemyBench(); h.hideEvolutionsMenu(); s.hideSettings();
    h.showHUD();
    en.clearAllEnemies();
    en.clearBoss();
    ps.clearAllProjectiles();
    const cfg = window.game._levelConfig;
    const types = ['basic', 'fast', 'tank', 'swarm', 'mortar', 'bombardier', 'conductor'];
    for (let i = 0; i < 22; i++) {
      const a = (i / 22) * Math.PI - Math.PI / 2;
      en.spawnEnemy(types[i % types.length], {
        x: Math.sin(a) * 11,
        y: 1.4 + (i % 3) * 0.5,
        z: -Math.cos(a) * 11,
      }, cfg);
    }
    // Tough targets: keep all 22 alive for the whole window so the sample is
    // steady-state combat rather than an emptying arena.
    en.getEnemies().forEach((e) => { e.hp = 99999; e.maxHp = 99999; });
    window.__test.telemetry.enable({ historyMs: 6000 });
  });
  await sleep(1000);
  const stressStart = Date.now();
  while (Date.now() - stressStart < 6000) {
    await page.evaluate(() => {
      const es = window.__test.getEnemies();
      const alive = es.find(e => e && e.mesh && e.hp > 0);
      if (!alive) return false;
      return window.__test.fireAtEnemy(es.indexOf(alive), { distance: 6, hp: 999999 });
    });
    await sleep(120);
  }
  const stress = await page.evaluate(() => {
    const s = window.__test.telemetry.snapshot();
    const r = window.__test.getRenderer();
    return {
      fps1s: s && s.fps && s.fps.avg1s,
      avgFrame: s && s.frameTimeMs && s.frameTimeMs.avgHistory,
      p95: s && s.frameTimeMs && s.frameTimeMs.p95History,
      calls: r.info.render.calls,
      triangles: r.info.render.triangles,
      geometries: r.info.memory.geometries,
      textures: r.info.memory.textures,
      enemies: window.__test.getEnemies().length,
      state: window.game.state,
    };
  });
  console.log('  stress:', JSON.stringify(stress));
  // Generous headless ceilings (SwiftShader software raster): catches gross
  // regressions (allocations per frame, runaway draw calls) not micro-noise.
  results.stressFrameTime = stress.avgFrame != null && stress.avgFrame < 45;
  results.stressDrawCalls = stress.calls < 180;
  results.stressNoLeak = stress.geometries < 900 && stress.textures < 500;

  // ── Report ───────────────────────────────────────────────────────
  console.log('\n' + '='.repeat(72));
  let failed = 0;
  for (const [key, value] of Object.entries(results)) {
    if (typeof value !== 'boolean') continue;
    console.log(`${value ? '✅' : '❌'} ${key}`);
    if (!value) failed++;
  }
  console.log('\ndata:', JSON.stringify({
    buttonReports,
    bossInfo,
    projInfo: {
      laser: projInfo.pools.laser,
      buckshot: projInfo.pools.buckshot,
      seeker: projInfo.pools.seeker,
      plasma: projInfo.pools.plasma_carbine,
      bossPool: projInfo.bossPool,
      onScreen: projInfo.pools.laser.onScreen,
    },
    markerPools: markers,
    stress,
    enemyStats,
    bossStats: {
      scrap_golem: bossStats.scrap_golem,
      the_maw: bossStats.the_maw,
      pulse_emitter: bossStats.pulse_emitter,
    },
  }, null, 1));

  if (errors.length) {
    console.log('\nconsole errors:');
    errors.slice(0, 10).forEach(e => console.log('  •', e));
    failed++;
  }
  if (failed) {
    await page.screenshot({ path: `${SHOT}-failure.png` });
    console.log(`\n❌ ${failed} FAILING CHECK(S)`);
  } else {
    console.log('\n✅ VISUAL AUDIT PASSED');
  }
  await browser.close();
  process.exit(failed ? 1 : 0);
}

main().catch((err) => {
  console.error('Test runner crashed:', err);
  process.exit(1);
});
