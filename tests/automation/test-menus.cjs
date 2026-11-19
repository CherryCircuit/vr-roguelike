/**
 * Test: menu layout + interaction (alchemy bench, evolutions, training ground)
 *
 * Guards the round-9 menu redesign:
 *   - ALCHEMY / EVOLUTIONS respond IMMEDIATELY after a level change (the card
 *     cooldown used to swallow the first ~1.5s of presses)
 *   - panels sit above the floor and inside the view
 *   - no two visible buttons overlap inside a panel
 *   - long lists scroll (chips beyond the visible window appear on scroll)
 *   - training menu lists are windowed (hidden rows are not drawn)
 *
 * Run: node tests/automation/test-menus.cjs
 */
const puppeteer = require('puppeteer');

const URL = 'http://localhost:8001/dev.html';
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

async function main() {
  console.log('🧪 Menu layout + interaction audit\n' + '='.repeat(72));
  const errors = [];
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--use-angle=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist', '--disable-gpu-sandbox'],
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 800 });
  page.on('console', (m) => {
    if (m.type() !== 'error') return;
    const u = m.location()?.url || '';
    if (u.includes('death-stats') || String(m.text()).includes('favicon')) return;
    errors.push(String(m.text()).slice(0, 220));
  });
  page.on('pageerror', (e) => errors.push('pageerror: ' + e.message.slice(0, 220)));

  await page.goto(URL, { waitUntil: 'networkidle2', timeout: 20000 });
  await sleep(3000);

  // Helpers installed in the page
  await page.evaluate(() => {
    window.__menuTest = {
      // Return { x, y, w, h } for every VISIBLE button face inside a panel,
      // expressed in the panel's local frame.
      panelRect(panelName) {
        const scene = window.__test.getScene();
        const panel = scene.getObjectByName(panelName);
        if (!panel) return null;
        const inv = panel.matrixWorld.clone().invert();
        const out = [];
        const p = panel.position.constructor;
        panel.traverse((o) => {
          const isBtn = o.userData && (o.userData.alchemyAction || o.userData.trainingAction);
          if (!isBtn || !o.geometry || !o.geometry.parameters) return;
          let vis = true, q = o;
          while (q) { if (!q.visible) { vis = false; break; } q = q.parent; }
          if (!vis) return;
          const world = o.getWorldPosition(new p());
          const local = world.clone().applyMatrix4(inv);
          const labelSprite = o.parent && o.parent.children
            ? o.parent.children.find(c => c.userData && c.userData.text)
            : null;
          out.push({
            x: +local.x.toFixed(3),
            y: +local.y.toFixed(3),
            w: +o.geometry.parameters.width.toFixed(3),
            h: +o.geometry.parameters.height.toFixed(3),
            action: (o.userData.alchemyAction || o.userData.trainingAction).type,
            label: labelSprite ? labelSprite.userData.text : '',
          });
        });
        const bg = panel.children.find(c => c.isMesh && c.geometry && c.geometry.parameters && c.geometry.parameters.width > 2);
        return {
          buttons: out,
          panelW: bg ? bg.geometry.parameters.width : null,
          panelH: bg ? bg.geometry.parameters.height : null,
        };
      },
      // World-space bounds of a panel (visible meshes only).
      panelWorld(panelName) {
        const scene = window.__test.getScene();
        const panel = scene.getObjectByName(panelName);
        if (!panel) return null;
        panel.updateMatrixWorld(true);
        let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity, minZ = Infinity, maxZ = -Infinity;
        const p = panel.position.constructor;
        panel.traverse((o) => {
          if (!o.isMesh || !o.geometry || !o.geometry.parameters) return;
          let vis = true, q = o;
          while (q) { if (!q.visible) { vis = false; break; } q = q.parent; }
          if (!vis) return;
          const w = o.geometry.parameters.width || 0;
          const h = o.geometry.parameters.height || 0;
          const c = o.getWorldPosition(new p());
          minX = Math.min(minX, c.x - w / 2); maxX = Math.max(maxX, c.x + w / 2);
          minY = Math.min(minY, c.y - h / 2); maxY = Math.max(maxY, c.y + h / 2);
          minZ = Math.min(minZ, c.z); maxZ = Math.max(maxZ, c.z);
        });
        return { minX, maxX, minY, maxY, minZ, maxZ };
      },
    };
  });

  const results = {};

  const overlaps = (rects) => {
    const bad = [];
    for (let i = 0; i < rects.length; i++) {
      for (let j = i + 1; j < rects.length; j++) {
        const a = rects[i], b = rects[j];
        const ox = Math.min(a.x + a.w / 2, b.x + b.w / 2) - Math.max(a.x - a.w / 2, b.x - b.w / 2);
        const oy = Math.min(a.y + a.h / 2, b.y + b.h / 2) - Math.max(a.y - a.h / 2, b.y - b.h / 2);
        if (ox > 0.005 && oy > 0.005) bad.push({ a: a.action, b: b.action, ox: +ox.toFixed(3), oy: +oy.toFixed(3) });
      }
    }
    return bad;
  };

  const facingCamera = async (yaw = 0) => page.evaluate((y) => {
    const cam = window.__test.getCamera();
    const E = cam.rotation.constructor;
    cam.quaternion.setFromEuler(new E(0, (y * Math.PI) / 180, 0));
    cam.position.set(0, 1.6, 0);
    cam.updateMatrixWorld(true);
  }, yaw);

  // Aim a controller at an object's world position and press.
  const press = async (objName, { tries = 6, settle = 0 } = {}) => {
    for (let t = 0; t < tries; t++) {
      const found = await page.evaluate((name) => {
        const scene = window.__test.getScene();
        const grp = scene.getObjectByName(name);
        if (!grp) return false;
        const p = grp.position.constructor;
        const world = grp.getWorldPosition(new p());
        const c = window.__test.getRenderer().xr.getController(0);
        c.matrixAutoUpdate = true;
        c.position.set(world.x, world.y, world.z + 1.2);
        const Q = c.quaternion.constructor, V = c.position.constructor;
        c.quaternion.copy(new Q().setFromUnitVectors(new V(0, 0, -1), new V(0, 0, -1)));
        c.updateMatrixWorld(true);
        return true;
      }, objName);
      if (!found) return false;
      await sleep(120);
      await page.evaluate(() => window.__test.getRenderer().xr.getController(0).dispatchEvent({ type: 'selectstart' }));
      await sleep(220);
      await page.evaluate(() => window.__test.getRenderer().xr.getController(0).dispatchEvent({ type: 'selectend' }));
      await sleep(settle || 350);
      return true;
    }
    return false;
  };

  const hudState = () => page.evaluate(() => import('./hud.js').then(h => ({
    bench: h.isAlchemyBenchOpen(), evo: h.isEvolutionsOpen(),
  })));

  // ── Setup: 6 dissolvable upgrades so the bench lists need scrolling ──
  await facingCamera(0);
  await page.evaluate(() => {
    window.game.state = 'playing';
    window.game.health = 9;
    window.game.country = 'CA';
    window.game.playerName = 'MenuBot';
    window.game.upgrades.left = { scope: 1, fire: 1, barrel: 1, piercing: 1, critical: 1, rapid_fire: 1 };
    window.game.upgrades.right = { shock: 1 };
  });
  await page.evaluate(() => window.__test.progression.forceLevelComplete({ autoSelect: false }));
  for (let i = 0; i < 40; i++) {
    if (await page.evaluate(() => window.game.state) === 'upgrade_select') break;
    await sleep(200);
  }
  await sleep(300);

  // ── 1. Bench opens on the FIRST press after the screen appears ──
  console.log('\n📍 bench: first-press open (cooldown)');
  await press('alchemy-btn-alchemy', { tries: 1, settle: 700 });
  results.benchFirstPress = (await hudState()).bench;

  if (results.benchFirstPress) {
    const rect = await page.evaluate(() => window.__menuTest.panelRect('alchemy-bench'));
    const world = await page.evaluate(() => window.__menuTest.panelWorld('alchemy-bench'));
    results.benchNoOverlap = overlaps(rect.buttons).length === 0;
    results.benchOverlapData = overlaps(rect.buttons).slice(0, 4);
    results.benchInsidePanel = rect.buttons.every(b =>
      Math.abs(b.x) + b.w / 2 <= rect.panelW / 2 + 0.02 &&
      Math.abs(b.y) + b.h / 2 <= rect.panelH / 2 + 0.02);
    results.benchAboveFloor = world.minY > 0.45;
    results.benchWorld = { minY: +world.minY.toFixed(2), maxY: +world.maxY.toFixed(2) };
    results.benchVisibleButtons = rect.buttons.length;

    // Scroll: chips window moves (6 dissolvable → 4 visible, scroll to 2)
    const before = await page.evaluate(() => window.__menuTest.panelRect('alchemy-bench').buttons.filter(b => b.action === 'dissolve_preview').map(b => b.y));
    await page.evaluate(() => import('./hud.js').then(h => h.updateAlchemyScroll(1)));
    await sleep(150);
    const after = await page.evaluate(() => window.__menuTest.panelRect('alchemy-bench').buttons.filter(b => b.action === 'dissolve_preview').map(b => b.y));
    results.benchScrollWorks = before.join(',') !== after.join(',');

    await press('alchemy-btn-back', { settle: 700 });
    results.benchBackClosed = !(await hudState()).bench;
  }

  // ── 2. Evolutions ──
  console.log('\n📍 evolutions: layout + scroll');
  await press('evolutions-btn-open', { tries: 1, settle: 700 });
  results.evoOpensOnFirstPress = (await hudState()).evo;
  if (results.evoOpensOnFirstPress) {
    const rect = await page.evaluate(() => window.__menuTest.panelRect('evolutions-menu'));
    const world = await page.evaluate(() => window.__menuTest.panelWorld('evolutions-menu'));
    results.evoNoOverlap = overlaps(rect.buttons).length === 0;
    results.evoInsidePanel = rect.buttons.every(b =>
      Math.abs(b.x) + b.w / 2 <= rect.panelW / 2 + 0.02 &&
      Math.abs(b.y) + b.h / 2 <= rect.panelH / 2 + 0.02);
    results.evoAboveFloor = world.minY > 0.45;
    results.evoWorld = { minY: +world.minY.toFixed(2), maxY: +world.maxY.toFixed(2) };

    const evoBefore = await page.evaluate(() => {
      const m = window.__test.getScene().getObjectByName('evolutions-menu');
      let n = 0;
      m.traverse(o => { if (o.userData && o.userData.rowIndex !== undefined && o.visible) n++; });
      return n;
    });
    await page.evaluate(() => import('./hud.js').then(h => h.updateEvolutionsScroll(1)));
    await sleep(150);
    const evoAfter = await page.evaluate(() => {
      const m = window.__test.getScene().getObjectByName('evolutions-menu');
      let n = 0;
      m.traverse(o => { if (o.userData && o.userData.rowIndex !== undefined && o.visible) n++; });
      return n;
    });
    results.evoScrollWindow = evoBefore === evoAfter && evoBefore > 0;
    await press('evolutions-btn-back', { settle: 700 });
  }

  // ── 3. Next level: both buttons still open on the first press ──
  console.log('\n📍 next level: buttons still instant');
  await press('upgrade-card-0', { settle: 900 });
  for (let i = 0; i < 30; i++) {
    if (await page.evaluate(() => window.game.state) === 'playing') break;
    await sleep(200);
  }
  await page.evaluate(() => window.__test.progression.forceLevelComplete({ autoSelect: false }));
  for (let i = 0; i < 40; i++) {
    if (await page.evaluate(() => window.game.state) === 'upgrade_select') break;
    await sleep(200);
  }
  await sleep(200);
  await press('evolutions-btn-open', { tries: 1, settle: 700 });
  results.evoAfterLevelChange = (await hudState()).evo;
  await press('evolutions-btn-back', { settle: 700 });
  await press('alchemy-btn-alchemy', { tries: 1, settle: 700 });
  results.alchemyAfterLevelChange = (await hudState()).bench;

  // ── 4. Training menu layout ──
  console.log('\n📍 training ground menu');
  await page.evaluate(() => import('./hud.js').then(h => { h.hideHUD(); h.hideTitle(); }));
  await page.evaluate(() => import('./training-ground.js').then(tg => { tg.startTraining(); return tg.showTrainingMenu(); }));
  await sleep(900);
  const train = await page.evaluate(() => window.__menuTest.panelRect('training-menu'));
  const trainWorld = await page.evaluate(() => window.__menuTest.panelWorld('training-menu'));
  results.trainingNoOverlap = overlaps(train.buttons).length === 0;
  results.trainingOverlapData = overlaps(train.buttons).slice(0, 4);
  results.trainingInsidePanel = train.buttons.every(b =>
    Math.abs(b.x) + b.w / 2 <= train.panelW / 2 + 0.02 &&
    Math.abs(b.y) + b.h / 2 <= train.panelH / 2 + 0.02);
  results.trainingAboveFloor = trainWorld.minY > 0.45;
  results.trainingWorld = { minY: +trainWorld.minY.toFixed(2), maxY: +trainWorld.maxY.toFixed(2), buttons: train.buttons.length };

  // Windowed lists: only 5 rows per column are visible out of 13 / 8
  const windowed = await page.evaluate(() => {
    const menu = window.__test.getScene().getObjectByName('training-menu');
    let visible = 0, hidden = 0;
    menu.traverse(o => {
      if (!o.userData || !o.userData.trainingAction || !o.geometry) return;
      let vis = true, p = o;
      while (p) { if (!p.visible) { vis = false; break; } p = p.parent; }
      vis ? visible++ : hidden++;
    });
    return { visible, hidden };
  });
  results.trainingWindowsLists = windowed.hidden > 0 && windowed.visible >= 15;

  // Scroll the enemy list and confirm the visible set changes
  const scrollBefore = await page.evaluate(() =>
    window.__menuTest.panelRect('training-menu').buttons.map(b => b.label + '@' + b.y).join('|'));
  await page.evaluate(() => import('./training-ground.js').then(tg => tg.scrollTrainingMenus(1)));
  await sleep(200);
  const scrollAfter = await page.evaluate(() =>
    window.__menuTest.panelRect('training-menu').buttons.map(b => b.label + '@' + b.y).join('|'));
  results.trainingScrollWorks = scrollBefore !== scrollAfter;
  await page.evaluate(() => import('./training-ground.js').then(tg => tg.exitTraining()));

  // ── Report ──
  console.log('\n' + '='.repeat(72));
  let failed = 0;
  for (const [k, v] of Object.entries(results)) {
    if (typeof v !== 'boolean') continue;
    console.log(`${v ? '✅' : '❌'} ${k}`);
    if (!v) failed++;
  }
  console.log('\ndata:', JSON.stringify(results, null, 1));
  if (errors.length) {
    console.log('\nconsole errors:');
    errors.slice(0, 8).forEach(e => console.log('  •', e));
    failed++;
  }
  if (failed) await page.screenshot({ path: 'tests/automation/menus-fail.png' });
  await browser.close();
  console.log(failed ? `\n❌ ${failed} FAILING CHECK(S)` : '\n✅ MENU AUDIT PASSED');
  process.exit(failed ? 1 : 0);
}

main().catch((e) => { console.error(e); process.exit(1); });
