/**
 * Test: enemy visibility / placement audit
 *
 * Measures, over several levels and several player facings, whether enemies are
 * where a player could actually see them:
 *   - SPAWN inside the front cone (never behind the player)
 *   - at every sample: not behind the player, not under the floor, not
 *     occluded by level (biome) geometry, and actually renderable
 *     (visible + non-zero scale) once the spawn warp has finished
 *
 * The probe runs INSIDE the page on requestAnimationFrame so it samples every
 * rendered frame without IPC overhead, then reports per-enemy-type stats:
 *
 *   behind   — samples where the enemy sat behind the player's horizontal facing
 *   under    — samples where the mesh bounding box dipped below the floor
 *   occl     — samples where biome geometry was between the camera and the enemy
 *   gone     — samples where an active enemy was invisible / zero-scale
 *   spawn*   — spawn-time placement (behind / outside the ±55° front cone)
 *
 * Phases keep a CONSTANT player facing, so "behind the player" is a real
 * violation rather than the player simply turning around. The last phase is a
 * per-type sweep that spawns every enemy type through the game's own spawn
 * function so rare types are covered too.
 *
 * Run: node tests/automation/test-enemy-visibility.cjs
 * Env: VIS_VERBOSE=1 dumps the first offender positions per type.
 */
const puppeteer = require('puppeteer');

const GAME_URL = 'http://localhost:8001/dev.html';
const VERBOSE = process.env.VIS_VERBOSE === '1';

// Spawns are FIXED to world -Z (see getSpawnForward). Each phase just turns the
// head to a different angle while playing, to prove placement ignores it.
const PHASES = [
  { label: 'L1  head 0°', level: 1, yaw: 0, lookYaw: 0 },
  { label: 'L8  head 80°', level: 8, yaw: 80, lookYaw: 80 },
  { label: 'L13 head 175°', level: 13, yaw: -95, lookYaw: 175 },
  { label: 'L18 head -20°', level: 18, yaw: 160, lookYaw: -20 },
];

const CONE_DEG = 55;    // spawn arc is 100° total (±50) + small tolerance
const BEHIND_DEG = 90;  // hard failure
const PHASE_MS = 15000; // natural-combat sampling per phase
const SWEEP_MS = 9000;  // per-type sweep sampling
const SWEEP_TYPES = [
  'basic', 'fast', 'tank', 'swarm', 'spiral_swimmer', 'jelly', 'conductor',
  'mortar', 'bombardier', 'void_anchor', 'void_tendril', 'echo_phantom', 'leech',
];

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

async function installProbe(page, cfg) {
  return page.evaluate(async (cfg) => {
    const THREE = await import('three');
    const env = await import('./environment-orchestration.js');
    const enemiesMod = await import('./enemies.js');

    const cam = window.__test.getCamera();
    const P = {
      on: true,
      frames: 0,
      raf: 0,
      errors: 0,
      lastError: null,
      floorY: env.getBiomeFloorY(),
      types: Object.create(null),
      seen: Object.create(null),
      boxes: Object.create(null),
      born: Object.create(null),
      fwd: new THREE.Vector3(),
      to: new THREE.Vector3(),
      size: new THREE.Vector3(),
      box: new THREE.Box3(),
      ray: new THREE.Raycaster(),
      occluder: env.biomeSceneGroup || null,
      samples: 0,
      spawns: 0,
      behind: 0,
      under: 0,
      occl: 0,
      gone: 0,
      spawnBehind: 0,
      spawnOutsideCone: 0,
    };
    window.__visProbe = P;

    const stat = (type) => {
      let s = P.types[type];
      if (!s) {
        s = P.types[type] = {
          type, samples: 0, spawns: 0,
          behind: 0, under: 0, occl: 0, gone: 0, high: 0,
          spawnBehind: 0, spawnOutsideCone: 0,
          maxAngle: 0, minRelY: 99, worst: [],
        };
      }
      return s;
    };

    // Seed everything already on the field: those enemies spawned BEFORE this
    // phase's facing was set, so they must not be counted as spawns here and
    // their angle says nothing about this phase's spawn placement.
    P.pre = Object.create(null);
    for (const e of (window.__test.getEnemies() || [])) {
      if (e && e.mesh) {
        P.seen[e.mesh.uuid] = true;
        P.pre[e.mesh.uuid] = true;
        P.born[e.mesh.uuid] = performance.now();
      }
    }

    const sample = () => {
      const list = window.__test.getEnemies() || [];
      // Angles are measured against the LEVEL'S FIXED FRONT (not the head) —
      // that is the axis spawns and clamps must obey.
      enemiesMod.getSpawnForward(P.fwd);

      for (let i = 0; i < list.length; i++) {
        const e = list[i];
        if (!e || !e.mesh) continue;
        const s = stat(e.type || 'unknown');
        s.samples++;
        P.samples++;

        const uid = e.mesh.uuid;
        const isPre = !!P.pre[uid];
        const pos = e.mesh.position;
        const dx = pos.x - cam.position.x;
        const dz = pos.z - cam.position.z;
        const distXZ = Math.hypot(dx, dz) || 0.0001;
        const dot = Math.min(1, Math.max(-1, (dx * P.fwd.x + dz * P.fwd.z) / distXZ));
        const angle = Math.acos(dot) * 180 / Math.PI;
        // Enemies that were already on the field before this phase's front was
        // captured say nothing about placement — skip their angle stats.
        if (!isPre && angle > s.maxAngle) s.maxAngle = angle;

        // ── spawn bookkeeping: first time this enemy is seen ──
        if (!P.seen[uid]) {
          P.seen[uid] = true;
          P.born[uid] = performance.now();
          P.spawns++;
          s.spawns++;
          // Measure the AUTHORED spawn point (enemies move before the first
          // frame sample; a fast enemy could otherwise look 2-4° off bearing
          // and fail a placement gate it actually passed).
          const sp = e._spawnPosition || pos;
          const sdx = sp.x - cam.position.x;
          const sdz = sp.z - cam.position.z;
          const sdist = Math.hypot(sdx, sdz) || 0.0001;
          const sdot = Math.min(1, Math.max(-1, (sdx * P.fwd.x + sdz * P.fwd.z) / sdist));
          const spawnAngle = Math.acos(sdot) * 180 / Math.PI;
          // Leeches latch ON the player and burst into minions radiating from
          // that point — those spawns are intentionally all around the player,
          // so the front-cone rule does not apply to them.
          const radialBurst = e.type === 'leech_minion' || e.isLatched === true || e.spiderState === 'latched';
          if (!radialBurst) {
            if (spawnAngle > cfg.behind) { s.spawnBehind++; P.spawnBehind++; }
            else if (spawnAngle > cfg.cone) { s.spawnOutsideCone++; P.spawnOutsideCone++; }
          }
        }

        // ── body bounds from the enemy's own hitbox ──
        // setFromObject(group) is useless here: several enemies carry huge VFX
        // children (bombardier cone, void tendril wall, anchor sphere) that
        // would make the "body" look 4m tall. The invisible hitbox IS the body
        // volume, and its geometry is shared per type, so cache by geometry.
        let b = P.boxes[uid];
        if (!b && e.mesh.scale.x > 0.85) {
          let hb = null;
          for (let ci = 0; ci < e.mesh.children.length; ci++) {
            if (e.mesh.children[ci].userData && e.mesh.children[ci].userData.isEnemyHitbox) {
              hb = e.mesh.children[ci];
              break;
            }
          }
          if (hb && hb.geometry) {
            if (!hb.geometry.boundingBox) hb.geometry.computeBoundingBox();
            const gb = hb.geometry.boundingBox;
            const key = 'geo:' + hb.geometry.uuid;
            let cached = P.boxes[key];
            if (!cached) {
              cached = P.boxes[key] = {
                minY: gb.min.y,
                sizeY: gb.max.y - gb.min.y,
                radius: Math.max(gb.max.x - gb.min.x, gb.max.z - gb.min.z) * 0.5,
              };
            }
            b = P.boxes[uid] = cached;
          } else {
            P.box.setFromObject(e.mesh);
            P.box.getSize(P.size);
            b = P.boxes[uid] = {
              minY: -(P.size.y || 0.6) * 0.5,
              sizeY: P.size.y || 0.6,
              radius: Math.max(P.size.x, P.size.z, P.size.y) * 0.5 || 0.4,
            };
          }
        }

        if (!isPre && angle > cfg.behind) {
          // Leeches/spiders that LATCH ride on the player, so being outside the
          // front cone is intended — do not count those.
          const attached = e.isLatched === true || e.spiderState === 'latched';
          if (!attached) {
            s.behind++;
            P.behind++;
            if (cfg.verbose && s.worst.length < 3) {
              s.worst.push({ k: 'behind', ang: +angle.toFixed(0), pos: [+pos.x.toFixed(1), +pos.y.toFixed(2), +pos.z.toFixed(1)] });
            }
          }
        }
        if (b) {
          const minY = pos.y + b.minY * e.mesh.scale.y;
          const relY = minY - P.floorY;
          if (relY < s.minRelY) s.minRelY = relY;
          if (relY < -0.25) {
            s.under++;
            P.under++;
            if (cfg.verbose && s.worst.length < 3) {
              s.worst.push({ k: 'under', relY: +relY.toFixed(2), pos: [+pos.x.toFixed(1), +pos.y.toFixed(2), +pos.z.toFixed(1)] });
            }
          }
          if (relY > 7) s.high++;
        }

        // ── renderable check (after the 200ms spawn warp) ──
        const age = performance.now() - (P.born[uid] || 0);
        if (age > 600 && (!e.mesh.visible || e.mesh.scale.x < 0.05)) {
          s.gone++;
          P.gone++;
          if (cfg.verbose && s.worst.length < 3) {
            s.worst.push({ k: 'gone', vis: e.mesh.visible, scale: +e.mesh.scale.x.toFixed(2), type: e.type });
          }
        }

        // ── occlusion by level geometry (every 10th frame, ≤4 enemies) ──
        if (P.occluder && P.frames % 10 === 0 && i < 4) {
          P.ray.set(cam.position, P.to.set(dx, (pos.y + 0.3) - cam.position.y, dz).normalize());
          const hits = P.ray.intersectObject(P.occluder, true);
          if (hits.length > 0) {
            const d = hits[0].distance;
            const dist = Math.hypot(distXZ, pos.y - cam.position.y);
            if (d < dist - (b ? b.radius : 0.4)) {
              s.occl++;
              P.occl++;
              if (cfg.verbose && s.worst.length < 3) {
                s.worst.push({ k: 'occl', d: +d.toFixed(1), dist: +dist.toFixed(1), obj: hits[0].object.name || hits[0].object.type });
              }
            }
          }
        }
      }
      P.frames++;
    };

    const tick = () => {
      if (!P.on) return;
      try {
        sample();
      } catch (err) {
        P.errors++;
        P.lastError = String((err && err.message) || err);
        if (P.errors > 5) { P.on = false; return; }
      }
      P.raf = requestAnimationFrame(tick);
    };
    P.raf = requestAnimationFrame(tick);
    return { floorY: P.floorY, hasOccluder: !!P.occluder };
  }, cfg);
}

async function readProbe(page) {
  return page.evaluate(() => {
    const P = window.__visProbe;
    P.on = false;
    if (P.raf) cancelAnimationFrame(P.raf);
    const totals = { frames: P.frames, samples: P.samples, spawns: P.spawns, errors: P.errors, lastError: P.lastError,
      behind: P.behind, under: P.under, occl: P.occl, gone: P.gone, spawnBehind: P.spawnBehind, spawnOutsideCone: P.spawnOutsideCone };
    return { totals, types: P.types };
  });
}

function mergeTotals(into, types) {
  for (const [type, s] of Object.entries(types || {})) {
    const t = into[type] || (into[type] = {
      type, samples: 0, spawns: 0, behind: 0, under: 0, occl: 0, gone: 0,
      spawnBehind: 0, spawnOutsideCone: 0, maxAngle: 0, minRelY: 99, worst: [],
    });
    for (const k of ['samples', 'spawns', 'behind', 'under', 'occl', 'gone', 'spawnBehind', 'spawnOutsideCone']) {
      t[k] += s[k] || 0;
    }
    t.maxAngle = Math.max(t.maxAngle, s.maxAngle || 0);
    t.minRelY = Math.min(t.minRelY, s.minRelY ?? 99);
    if (s.worst) for (const w of s.worst) { if (t.worst.length < 3) t.worst.push(w); }
  }
}

async function runTest() {
  console.log('🧪 Enemy Visibility Audit\n' + '='.repeat(78));

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

  page.on('console', (msg) => {
    if (msg.type() !== 'error') return;
    const text = msg.text();
    const url = msg.location()?.url || '';
    if (url.includes('death-stats') || text.includes('favicon')) return;
    errors.push(text);
  });
  page.on('pageerror', (err) => errors.push('pageerror: ' + err.message));

  await page.goto(GAME_URL, { waitUntil: 'networkidle2', timeout: 20000 });
  await sleep(3000);

  const total = {};
  const cfg = { cone: CONE_DEG, behind: BEHIND_DEG, verbose: VERBOSE };

  const setFacing = async (yawDeg) => page.evaluate((yaw) => {
    const cam = window.__test.getCamera();
    const THREE_Euler = cam.rotation.constructor;
    cam.quaternion.setFromEuler(new THREE_Euler(0, (yaw * Math.PI) / 180, 0));
    cam.position.set(0, cam.position.y, 0);
    cam.updateMatrixWorld(true);
  }, yawDeg);

  for (const phase of PHASES) {
    console.log(`\n📍 ${phase.label}`);
    // Stance at level start → this becomes the level's FIXED front.
    await setFacing(phase.yaw);
    await page.evaluate(async (lvl) => {
      await window.__test.progression.startAt({ level: lvl });
    }, phase.level);
    await sleep(900);
    // Turn the head AFTER the level started: the spawn arc must NOT follow it.
    await setFacing(phase.lookYaw);
    // Faster waves so an 15s window still fills the arena (test-only).
    await page.evaluate(() => {
      window.game.health = 99;
      if (window.game._levelConfig) {
        window.game._levelConfig.spawnInterval = 0.75;
        window.game.spawnTimer = 0.2;
      }
    });

    await installProbe(page, cfg);
    await sleep(PHASE_MS);
    const { totals, types } = await readProbe(page);
    console.log(`  frames=${totals.frames} samples=${totals.samples} spawns=${totals.spawns}` +
      (totals.errors ? `  probeErrors=${totals.errors} (${totals.lastError})` : ''));
    console.log(`  spawn>90°=${totals.spawnBehind} spawn>${CONE_DEG}°=${totals.spawnOutsideCone} ` +
      `behind=${totals.behind} under=${totals.under} occl=${totals.occl} gone=${totals.gone}`);
    mergeTotals(total, types);
  }

  // ── Per-type sweep: every enemy type through the game's own spawn path ──
  console.log('\n📍 per-type sweep (L20, head 200°)');
  await setFacing(70);
  await page.evaluate(async () => {
    await window.__test.progression.startAt({ level: 20 });
  });
  await sleep(900);
  await setFacing(200); // head turned away from the fixed front
  await page.evaluate(() => { window.game.health = 99; });
  // Install the probe FIRST so the per-type spawns below are measured as
  // spawns (angles against the fixed front) rather than pre-existing enemies.
  await installProbe(page, cfg);
  await page.evaluate(async () => {
    const en = await import('./enemies.js');
    const cfgL = window.game._levelConfig;
    for (const type of ['basic', 'fast', 'tank', 'swarm', 'spiral_swimmer', 'jelly', 'conductor',
      'mortar', 'bombardier', 'void_anchor', 'void_tendril', 'echo_phantom', 'leech']) {
      const pos = en.getSpawnPosition(cfgL?.airSpawns, 0, null);
      en.spawnEnemy(type, pos, cfgL);
    }
  });
  await sleep(SWEEP_MS);
  const sweep = await readProbe(page);
  console.log(`  frames=${sweep.totals.frames} samples=${sweep.totals.samples} spawns=${sweep.totals.spawns}` +
    (sweep.totals.errors ? `  probeErrors=${sweep.totals.errors} (${sweep.totals.lastError})` : ''));
  mergeTotals(total, sweep.types);

  // ── Report ──
  console.log('\n' + '='.repeat(78));
  console.log('PER-TYPE TOTALS');
  console.log('   type             samples spawns spawn>90 spawn>55  behind  under  occl   gone  minRelY  maxAng');

  const rows = Object.values(total)
    .filter(t => t.samples > 0)
    .sort((a, b) => {
      const bad = (t) => t.behind + t.under + t.occl + t.gone + t.spawnBehind;
      return bad(b) - bad(a);
    });

  for (const t of rows) {
    const bad = t.behind + t.under + t.occl + t.gone + t.spawnBehind;
    console.log(
      `${bad > 0 ? '❌' : '✅'} ${(t.type || '?').padEnd(16)} ` +
      `${String(t.samples).padStart(7)} ${String(t.spawns).padStart(6)} ` +
      `${String(t.spawnBehind).padStart(8)} ${String(t.spawnOutsideCone).padStart(8)} ` +
      `${String(t.behind).padStart(7)} ${String(t.under).padStart(6)} ${String(t.occl).padStart(5)} ` +
      `${String(t.gone).padStart(6)} ${(t.minRelY === 99 ? '-' : t.minRelY.toFixed(2)).padStart(8)} ${t.maxAngle.toFixed(0).padStart(6)}` +
      (t.worst && t.worst.length ? `   e.g. ${JSON.stringify(t.worst[0])}` : '')
    );
  }

  const sum = (k) => rows.reduce((n, t) => n + t[k], 0);
  const checks = {
    'no spawn behind player': sum('spawnBehind') === 0,
    'no spawn outside front cone': sum('spawnOutsideCone') === 0,
    'never behind player in play': sum('behind') === 0,
    'never under the floor': sum('under') === 0,
    'never occluded by level geometry': sum('occl') === 0,
    'always renderable once spawned': sum('gone') === 0,
    'no console errors': errors.length === 0,
  };

  console.log('\n── Verdicts ──');
  let failed = 0;
  for (const [name, ok] of Object.entries(checks)) {
    console.log(`${ok ? '✅' : '❌'} ${name}`);
    if (!ok) failed++;
  }
  if (errors.length) {
    console.log('\nconsole errors:');
    errors.slice(0, 10).forEach(e => console.log('  •', e.slice(0, 220)));
  }

  await browser.close();
  console.log(failed ? `\n❌ ${failed} FAILING CHECK(S)` : '\n✅ ENEMY VISIBILITY AUDIT PASSED');
  process.exit(failed ? 1 : 0);
}

runTest().catch((err) => {
  console.error('Test crashed:', err);
  process.exit(1);
});


