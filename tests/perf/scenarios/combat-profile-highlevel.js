/**
 * Combat Profile at High Levels
 *
 * Uses debugJumpToLevel to skip to a target level,
 * lets enemies accumulate, then runs profile buckets
 * during active combat to find the real bottlenecks.
 *
 * Usage:
 *   node tests/perf/run-perf.mjs --scenarios=combat-profile-highlevel
 *   node tests/perf/run-perf.mjs --scenarios=combat-profile-highlevel --targetLevel=16
 *   node tests/perf/run-perf.mjs --scenarios=combat-profile-highlevel --targetLevel=14 --profileDurationMs=20000
 */
export default async function runCombatProfileHighLevel(context) {
  const { page, log, wait, captureTelemetry, screenshot } = context;
  const {
    targetLevel = 14,
    spawnWaitMs = 8000,
    profileDurationMs = 15000,
  } = context.options || {};

  // 1. Get to playing state first (standard ensurePlayingState handles title/profile setup)
  const { ensurePlayingState } = context;
  await ensurePlayingState();

  // 2. Force back to title and set the debug jump property
  log(`Jumping to level ${targetLevel} via debugJumpToLevel...`);

  const jumpResult = await page.evaluate((level) => {
    // debugJumpToLevel is checked in the title screen render loop.
    // Set the property and force state back to TITLE to trigger it.
    window.debugJumpToLevel = level;
    window.game.state = window.State.TITLE;
    return { ok: true };
  }, targetLevel);

  if (!jumpResult.ok) {
    log(`ERROR: ${jumpResult.reason}`);
    return { error: jumpResult.reason };
  }

  // 3. Wait for the title screen to pick up the jump and transition
  log('Waiting for level transition...');
  await wait(500);

  // Click through ready screen
  await page.mouse.click(640, 400);
  await wait(1000);

  // Wait for playing state at the new level
  const playingReady = await page.evaluate(() => {
    return new Promise((resolve) => {
      const check = () => {
        const st = window.game?.state;
        if (st === 'playing') {
          resolve({ ok: true, level: window.game.level, state: st });
        } else if (st === 'ready_screen') {
          // Click to advance
          window.game.state = window.State.PLAYING;
          setTimeout(check, 500);
        } else {
          setTimeout(check, 500);
        }
      };
      check();
      setTimeout(() => resolve({ ok: false, state: window.game?.state }), 15000);
    });
  });

  if (!playingReady.ok) {
    log(`ERROR: Failed to reach playing state at level ${targetLevel}, stuck at ${playingReady.state}`);
    return { error: 'failed_to_reach_playing', state: playingReady.state };
  }

  log(`Now at level ${playingReady.level}, state: ${playingReady.state}`);

  // 4. Capture baseline telemetry (before combat heats up)
  const baselineTelemetry = await captureTelemetry('level-baseline');

  // 5. Let enemies spawn and accumulate
  log(`Waiting ${spawnWaitMs}ms for enemies to spawn and accumulate...`);
  await wait(spawnWaitMs);

  // Check enemy counts before profiling
  const preProfileState = await page.evaluate(() => {
    return {
      enemies: window.__test?.getEnemyCount?.() ?? -1,
      level: window.game?.level,
      kills: window.game?.kills,
      killTarget: window.game?._levelConfig?.killTarget,
      health: window.game?.health,
      state: window.game?.state,
    };
  });
  log(`Pre-profile: ${preProfileState.enemies} enemies, ${preProfileState.kills}/${preProfileState.killTarget} kills`);

  const midCombatTelemetry = await captureTelemetry('mid-combat-pre-profile');

  // 6. Start profile buckets during active combat
  const profileStarted = await page.evaluate(() => {
    const perf = window.__perf;
    if (!perf || typeof perf.startProfileBuckets !== 'function') {
      return { ok: false, reason: '__perf.startProfileBuckets not available' };
    }
    perf.startProfileBuckets();
    return { ok: true };
  });

  if (!profileStarted.ok) {
    log(`ERROR: ${profileStarted.reason}`);
    return { error: profileStarted.reason };
  }

  // 7. During profiling, periodically fire at enemies to keep combat active
  log(`Profiling for ${profileDurationMs}ms with active combat...`);

  const combatResult = await page.evaluate(async (durationMs) => {
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
    const shots = { fired: 0, hit: 0 };
    const enemyCounts = [];
    const fpsSamples = [];

    const start = Date.now();
    while (Date.now() - start < durationMs) {
      // Record enemy count
      const count = window.__test?.getEnemyCount?.() ?? 0;
      enemyCounts.push(count);

      // Record FPS
      const instr = window.__perf?.getSnapshot?.();
      if (instr?.fps) {
        fpsSamples.push({ t: Date.now() - start, fps: instr.fps.instant, enemies: count });
      }

      // Fire at enemies to keep things active
      if (count > 0) {
        for (let i = 0; i < Math.min(count, 3); i++) {
          const ok = window.__test?.fireAtEnemy?.(i, { distance: 5, hp: 1, snapToCamera: true });
          if (ok) shots.fired += 1;
        }
      }
      await sleep(500);
    }

    return { shots, enemyCounts, fpsSamples };
  }, profileDurationMs);

  // 8. Read profile buckets
  const report = await page.evaluate(() => {
    const perf = window.__perf;
    if (!perf || typeof perf.dumpProfileBuckets !== 'function') {
      return { error: 'dumpProfileBuckets not available' };
    }

    // Scene breakdown
    const scene = window.__test?.getScene?.() || null;
    let objectBreakdown = [];
    if (scene) {
      scene.traverse((obj) => {
        if (obj.isMesh && obj.geometry) {
          const geo = obj.geometry;
          const idxCount = geo.index ? geo.index.count : (geo.attributes.position ? geo.attributes.position.count : 0);
          const tris = Math.round(idxCount / 3);
          if (tris > 100) {
            objectBreakdown.push({
              name: obj.name || '(unnamed)',
              type: geo.type,
              triangles: tris,
              visible: obj.visible,
              frustumCulled: obj.frustumCulled,
            });
          }
        }
      });
      objectBreakdown.sort((a, b) => b.triangles - a.triangles);
    }

    return {
      reportText: perf.dumpProfileBuckets(),
      rawData: JSON.parse(JSON.stringify(perf._profileBuckets || {})),
      objectBreakdown: objectBreakdown.slice(0, 20),
    };
  });

  await screenshot('combat-profile-highlevel-end');
  const tailTelemetry = await captureTelemetry('combat-profile-end');

  // Post-profile state
  const postState = await page.evaluate(() => ({
    enemies: window.__test?.getEnemyCount?.() ?? -1,
    level: window.game?.level,
    kills: window.game?.kills,
    killTarget: window.game?._levelConfig?.killTarget,
    health: window.game?.health,
    state: window.game?.state,
  }));

  return {
    targetLevel,
    profileDurationMs,
    spawnWaitMs,
    combatActivity: combatResult,
    profileReport: report.reportText,
    rawBuckets: report.rawData,
    objectBreakdown: report.objectBreakdown,
    baselineTelemetry: baselineTelemetry.data,
    midCombatTelemetry: midCombatTelemetry.data,
    tailTelemetry: tailTelemetry.data,
    postState,
    preProfileState,
  };
}
