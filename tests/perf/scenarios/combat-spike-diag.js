/**
 * Combat Spike Diagnostic — Version-Resilient
 *
 * Purpose: Detect and correlate per-frame spikes during active combat.
 * Works by manipulating the Three.js scene graph at runtime (hiding visuals)
 * rather than depending on internal code structure.
 *
 * Version resilience: Only depends on:
 *   - window.__test hooks (fireAtEnemy, getEnemyCount, getScene, etc.)
 *   - window.__perf hooks (startProfileBuckets, dumpProfileBuckets, getSnapshot)
 *   - window.game (state, level, kills, health)
 *   - Three.js scene graph API (obj.visible, obj.traverse)
 *   - window.debugJumpToLevel (level skip)
 *
 * Modes:
 *   --minimal=true   Strip all non-gameplay visuals (default true)
 *   --minimal=false  Keep full visuals for comparison
 *   --targetLevel=14
 *   --profileDurationMs=20000
 *   --spikeThresholdMs=50  (flag frames above this)
 *
 * Usage:
 *   node tests/perf/run-perf.mjs --scenarios=combat-spike-diag
 *   node tests/perf/run-perf.mjs --scenarios=combat-spike-diag --targetLevel=16
 *   node tests/perf/run-perf.mjs --scenarios=combat-spike-diag --minimal=false
 */

// ── Scene stripper: hides everything that isn't gameplay-critical ──
const STRIP_SCENE_FN = `
(function stripSceneForPerf() {
  const scene = window.__test?.getScene?.();
  if (!scene) return { error: 'no scene' };

  // Names/patterns to KEEP visible (gameplay-critical)
  const keepPatterns = [
    /enemy/i, /boss/i, /minion/i,
    /projectile/i, /bullet/i, /laser/i, /missile/i, /plasma/i,
    /health/i, /hud/i, /floor/i, /ground/i, /terrain/i,
    /weapon/i, /blaster/i, /shield/i, /voxel/i, /mine/i,
    /explosion/i, /flash/i, /damage/i, /popup/i, /score/i,
    /upgrade/i, /card/i, /nuke/i, /chain/i, /combo/i,
    /stasis/i, /grenade/i, /drone/i, /tether/i, /emp/i,
    /decoy/i, /blackhole/i, /nanite/i,
    /instanced/i, /pool/i,
  ];

  // Object types to always keep
  const keepTypes = new Set(['InstancedMesh']); // enemy/projectile pools

  let hidden = 0;
  let kept = 0;
  let keptNames = [];
  let hiddenNames = [];

  scene.traverse((obj) => {
    if (obj === scene) return; // don't hide the root
    if (!obj.isMesh && !obj.isPoints && !obj.isLine && !obj.isGroup) return;

    const name = obj.name || '';
    const shouldKeep = keepPatterns.some(p => p.test(name))
      || keepTypes.has(obj.type)
      || (obj.userData && obj.userData.gameplayCritical);

    if (shouldKeep) {
      kept++;
      if (name) keptNames.push(name);
    } else {
      if (obj.visible) {
        obj.visible = false;
        hidden++;
        if (name) hiddenNames.push(name);
      }
    }
  });

  // Also disable fog and background for maximum perf
  if (scene.fog) scene.fog = null;
  if (scene.background && typeof scene.background !== 'string') {
    scene._perfOriginalBg = scene.background;
    scene.background = null;
  }

  return { hidden, kept, keptNames: keptNames.slice(0, 20), hiddenNames: hiddenNames.slice(0, 20) };
})
`;

// ── Frame spike logger: injects per-frame timing into the game loop ──
const INJECT_SPIKE_LOGGER_FN = `
(function injectSpikeLogger(thresholdMs) {
  // Create a spike log buffer on window so we can read it later
  window.__spikeLog = {
    frames: [],          // { frameTime, timestamp, events }
    spikes: [],          // frames over threshold
    slowMoEvents: [],    // { timestamp, action, timeScale }
    enemyEvents: [],     // { timestamp, action, count }
    maxFrames: 10000,
    thresholdMs: thresholdMs,
  };

  // Patch console.log to capture slow-mo and spawn events
  const origLog = console.log;
  console.log = function(...args) {
    origLog.apply(console, args);
    const msg = args.join(' ');
    const sl = window.__spikeLog;
    if (!sl) return;
    const t = performance.now();

    if (msg.includes('[bullet-time]') || msg.includes('slow-mo') || msg.includes('slowmo')) {
      sl.slowMoEvents.push({ timestamp: t, message: msg });
    }
    if (msg.includes('[spawn]') || msg.includes('spawn') || msg.includes('wave')) {
      sl.enemyEvents.push({ timestamp: t, message: msg });
    }
  };

  // Patch the game's render loop to record per-frame times
  // We do this by overriding requestAnimationFrame
  const origRAF = window.requestAnimationFrame;
  let lastFrameTime = performance.now();
  window.__origRAF = origRAF;

  window.requestAnimationFrame = function(callback) {
    return origRAF.call(window, function(timestamp) {
      const dt = timestamp - lastFrameTime;
      lastFrameTime = timestamp;

      const sl = window.__spikeLog;
      if (sl) {
        const events = [];

        // Check slow-mo state
        const ts = window._timeScale;
        const st = window.game?.slowmoActive;
        if (st || (ts && ts < 0.9)) {
          events.push('slowmo_active');
        }

        // Check enemy count
        const ec = window.__test?.getEnemyCount?.() ?? 0;
        if (ec > 0) events.push('enemies:' + ec);

        // Check for recent slow-mo events (within 200ms)
        const recentSlow = sl.slowMoEvents.filter(e => timestamp - e.timestamp < 200);
        if (recentSlow.length > 0) {
          events.push('slowmo_event:' + recentSlow[recentSlow.length - 1].message.substring(0, 40));
        }

        // Check for recent enemy events
        const recentEnemy = sl.enemyEvents.filter(e => timestamp - e.timestamp < 200);
        if (recentEnemy.length > 0) {
          events.push('enemy_event:' + recentEnemy[recentEnemy.length - 1].message.substring(0, 40));
        }

        const frame = { frameTime: dt, timestamp, events, enemyCount: ec, timeScale: ts ?? 1 };
        sl.frames.push(frame);

        if (dt > sl.thresholdMs) {
          sl.spikes.push({ ...frame, spikeMs: dt });
        }

        // Trim to prevent memory bloat
        if (sl.frames.length > sl.maxFrames) {
          sl.frames = sl.frames.slice(-sl.maxFrames / 2);
        }
      }

      callback(timestamp);
    });
  };

  return { ok: true, thresholdMs };
})
`;

// ── Restore scene visuals ──
const RESTORE_SCENE_FN = `
(function restoreScene() {
  const scene = window.__test?.getScene?.();
  if (!scene) return;
  scene.traverse((obj) => { obj.visible = true; });
  if (scene._perfOriginalBg) {
    scene.background = scene._perfOriginalBg;
    delete scene._perfOriginalBg;
  }
  // Restore original RAF
  if (window.__origRAF) {
    window.requestAnimationFrame = window.__origRAF;
    delete window.__origRAF;
  }
  delete window.__spikeLog;
})
`;

export default async function runCombatSpikeDiag(context) {
  const { page, log, wait, captureTelemetry, screenshot, ensurePlayingState } = context;
  const {
    targetLevel = 14,
    spawnWaitMs = 8000,
    profileDurationMs = 20000,
    minimal = true,
    spikeThresholdMs = 50,
  } = context.options || {};

  const mode = minimal ? 'MINIMAL' : 'FULL_VISUALS';
  log(`Mode: ${mode}, Level: ${targetLevel}, Threshold: ${spikeThresholdMs}ms`);

  // 1. Get to playing state
  await ensurePlayingState();

  // 2. Inject the spike logger (before level jump so we catch transition spikes)
  log('Injecting frame spike logger...');
  const injectResult = await page.evaluate((threshold) => {
    // Create spike log buffer
    window.__spikeLog = {
      frames: [],
      spikes: [],
      slowMoEvents: [],
      enemyEvents: [],
      maxFrames: 10000,
      thresholdMs: threshold,
    };

    // Patch console.log to capture events
    const origLog = console.log;
    window.__origConsoleLog = origLog;
    console.log = function(...args) {
      origLog.apply(console, args);
      const msg = args.join(' ');
      const sl = window.__spikeLog;
      if (!sl) return;
      const t = performance.now();
      if (msg.includes('[bullet-time]') || msg.includes('slow-mo') || msg.includes('slowmo')) {
        sl.slowMoEvents.push({ timestamp: t, message: msg.substring(0, 80) });
      }
      if (msg.includes('spawn') || msg.includes('[spawn]') || msg.includes('wave') || msg.includes('destroy')) {
        sl.enemyEvents.push({ timestamp: t, message: msg.substring(0, 80) });
      }
    };

    // Patch RAF for per-frame timing
    const origRAF = window.requestAnimationFrame.bind(window);
    let lastFrameTime = performance.now();
    window.__origRAF = window.requestAnimationFrame;
    window.requestAnimationFrame = function(callback) {
      return origRAF(function(timestamp) {
        const dt = timestamp - lastFrameTime;
        lastFrameTime = timestamp;
        const sl = window.__spikeLog;
        if (sl) {
          const events = [];
          const ts = window._timeScale;
          const ec = window.__test?.getEnemyCount?.() ?? 0;
          if (window.game?.slowmoActive || (ts && ts < 0.9)) events.push('slowmo');
          if (ec > 0) events.push('enemies:' + ec);
          // Recent events (within 200ms)
          const recentSlow = sl.slowMoEvents.filter(e => timestamp - e.timestamp < 200);
          if (recentSlow.length > 0) events.push('slowmo_event');
          const recentEnemy = sl.enemyEvents.filter(e => timestamp - e.timestamp < 200);
          if (recentEnemy.length > 0) events.push('enemy_event');

          const frame = { frameTime: Math.round(dt * 100) / 100, timestamp: Math.round(timestamp), events, enemyCount: ec, timeScale: ts ?? 1 };
          sl.frames.push(frame);
          if (dt > sl.thresholdMs) {
            sl.spikes.push({ ...frame, spikeMs: Math.round(dt * 100) / 100 });
          }
          if (sl.frames.length > sl.maxFrames) sl.frames = sl.frames.slice(-5000);
        }
        callback(timestamp);
      });
    };

    return { ok: true, thresholdMs: threshold };
  }, spikeThresholdMs);
  log(`Spike logger injected: threshold ${injectResult.thresholdMs}ms`);

  // 3. Jump to target level
  log(`Jumping to level ${targetLevel}...`);
  await page.evaluate((level) => {
    window.debugJumpToLevel = level;
    window.game.state = window.State.TITLE;
  }, targetLevel);

  await wait(500);
  await page.mouse.click(640, 400);
  await wait(1000);

  // Wait for playing state
  const playingReady = await page.evaluate(() => {
    return new Promise((resolve) => {
      const check = () => {
        const st = window.game?.state;
        if (st === 'playing') {
          resolve({ ok: true, level: window.game.level });
        } else if (st === 'ready_screen') {
          window.game.state = window.State.PLAYING;
          setTimeout(check, 300);
        } else {
          setTimeout(check, 300);
        }
      };
      check();
      setTimeout(() => resolve({ ok: false, state: window.game?.state }), 15000);
    });
  });

  if (!playingReady.ok) {
    log(`ERROR: Failed to reach level ${targetLevel}, stuck at ${playingReady.state}`);
    // Cleanup
    await page.evaluate(() => {
      if (window.__origRAF) window.requestAnimationFrame = window.__origRAF;
      if (window.__origConsoleLog) console.log = window.__origConsoleLog;
      delete window.__spikeLog;
    });
    return { error: 'failed_to_reach_level', state: playingReady.state };
  }
  log(`Now playing at level ${playingReady.level}`);

  // 4. Strip visuals if minimal mode
  if (minimal) {
    log('Stripping non-gameplay visuals...');
    const stripResult = await page.evaluate(`
      (function() {
        const scene = window.__test?.getScene?.();
        if (!scene) return { error: 'no scene' };

        const keepPatterns = [
          /enemy/i, /boss/i, /minion/i,
          /projectile/i, /bullet/i, /laser/i, /missile/i, /plasma/i,
          /health/i, /hud/i, /floor/i, /ground/i, /terrain/i,
          /weapon/i, /blaster/i, /shield/i, /voxel/i, /mine/i,
          /explosion/i, /flash/i, /damage/i, /popup/i, /score/i,
          /upgrade/i, /card/i, /nuke/i, /chain/i, /combo/i,
          /stasis/i, /grenade/i, /drone/i, /tether/i, /emp/i,
          /decoy/i, /blackhole/i, /nanite/i, /instanced/i, /pool/i,
        ];
        const keepTypes = new Set(['InstancedMesh']);

        let hidden = 0, kept = 0, keptNames = [];
        scene.traverse((obj) => {
          if (obj === scene) return;
          if (!obj.isMesh && !obj.isPoints && !obj.isLine && !obj.isGroup) return;
          const name = obj.name || '';
          const shouldKeep = keepPatterns.some(p => p.test(name)) || keepTypes.has(obj.type);
          if (shouldKeep) {
            kept++;
            if (name) keptNames.push(name);
          } else if (obj.visible) {
            obj.visible = false;
            hidden++;
          }
        });
        if (scene.fog) scene.fog = null;
        if (scene.background) { scene._perfOriginalBg = scene.background; scene.background = null; }
        return { hidden, kept, keptNames: keptNames.slice(0, 20) };
      })()
    `);
    log(`Stripped: ${stripResult.hidden} hidden, ${stripResult.kept} kept`);
    if (stripResult.keptNames?.length) {
      log(`Kept: ${stripResult.keptNames.join(', ')}`);
    }
  }

  // 5. Let enemies accumulate
  log(`Waiting ${spawnWaitMs}ms for enemies to spawn...`);
  await wait(spawnWaitMs);

  const preState = await page.evaluate(() => ({
    enemies: window.__test?.getEnemyCount?.() ?? -1,
    level: window.game?.level,
    kills: window.game?.kills,
    killTarget: window.game?._levelConfig?.killTarget,
    health: window.game?.health,
    state: window.game?.state,
  }));
  log(`Pre-profile: ${preState.enemies} enemies, ${preState.kills}/${preState.killTarget} kills`);

  await captureTelemetry('pre-combat');
  await screenshot('pre-combat');

  // 6. Run combat with active shooting while logging spikes
  log(`Running ${profileDurationMs}ms combat with spike detection...`);

  const combatResult = await page.evaluate(async (durationMs) => {
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
    let shotsFired = 0;
    const enemyCountSamples = [];

    const start = Date.now();
    while (Date.now() - start < durationMs) {
      const count = window.__test?.getEnemyCount?.() ?? 0;
      enemyCountSamples.push({ t: Date.now() - start, count });

      // Fire at enemies to maintain combat pressure
      if (count > 0) {
        for (let i = 0; i < Math.min(count, 3); i++) {
          const ok = window.__test?.fireAtEnemy?.(i, { distance: 5, hp: 1, snapToCamera: true });
          if (ok) shotsFired++;
        }
      }
      await sleep(400);
    }
    return { shotsFired, enemyCountSamples };
  }, profileDurationMs);

  // 7. Read the spike log
  log('Reading spike log...');
  const spikeReport = await page.evaluate(() => {
    const sl = window.__spikeLog;
    if (!sl) return { error: 'no spike log' };

    const frames = sl.frames;
    const spikes = sl.spikes;
    const slowMoEvents = sl.slowMoEvents;
    const enemyEvents = sl.enemyEvents;

    // Calculate stats
    const frameTimes = frames.map(f => f.frameTime);
    const avgFrameTime = frameTimes.reduce((a, b) => a + b, 0) / frameTimes.length;
    const sorted = [...frameTimes].sort((a, b) => a - b);
    const p50 = sorted[Math.floor(sorted.length * 0.5)];
    const p90 = sorted[Math.floor(sorted.length * 0.9)];
    const p95 = sorted[Math.floor(sorted.length * 0.95)];
    const p99 = sorted[Math.floor(sorted.length * 0.99)];
    const maxFrame = sorted[sorted.length - 1];
    const minFrame = sorted[0];

    // Group spikes by co-occurring events
    const spikeCauses = {};
    for (const spike of spikes) {
      const key = spike.events.length > 0 ? spike.events.sort().join('+') : 'unknown';
      if (!spikeCauses[key]) spikeCauses[key] = { count: 0, examples: [], avgMs: 0, maxMs: 0, totalTime: 0 };
      spikeCauses[key].count++;
      spikeCauses[key].totalTime += spike.spikeMs;
      spikeCauses[key].maxMs = Math.max(spikeCauses[key].maxMs, spike.spikeMs);
      if (spikeCauses[key].examples.length < 3) {
        spikeCauses[key].examples.push({
          ms: spike.spikeMs,
          frameTime: spike.frameTime,
          enemies: spike.enemyCount,
          timeScale: spike.timeScale,
        });
      }
    }
    // Calculate averages
    for (const k of Object.keys(spikeCauses)) {
      spikeCauses[k].avgMs = Math.round(spikeCauses[k].totalTime / spikeCauses[k].count * 100) / 100;
    }

    // Find frames immediately before/after slow-mo events
    const slowMoFrameAnalysis = slowMoEvents.map(evt => {
      const idx = frames.findIndex(f => Math.abs(f.timestamp - evt.timestamp) < 100);
      if (idx < 0) return null;
      const before = idx > 0 ? frames[idx - 1] : null;
      const during = frames[idx];
      const after = idx < frames.length - 1 ? frames[idx + 1] : null;
      return {
        event: evt.message.substring(0, 60),
        beforeMs: before ? before.frameTime : null,
        duringMs: during ? during.frameTime : null,
        afterMs: after ? after.frameTime : null,
        enemies: during ? during.enemyCount : null,
      };
    }).filter(Boolean);

    return {
      totalFrames: frames.length,
      spikesDetected: spikes.length,
      spikeThreshold: sl.thresholdMs,
      frameTimeStats: {
        min: Math.round(minFrame * 100) / 100,
        avg: Math.round(avgFrameTime * 100) / 100,
        p50: Math.round(p50 * 100) / 100,
        p90: Math.round(p90 * 100) / 100,
        p95: Math.round(p95 * 100) / 100,
        p99: Math.round(p99 * 100) / 100,
        max: Math.round(maxFrame * 100) / 100,
      },
      spikeCauses,
      slowMoEvents: slowMoEvents.slice(0, 20),
      enemyEvents: enemyEvents.slice(0, 20),
      slowMoFrameAnalysis,
      topSpikes: spikes.sort((a, b) => b.spikeMs - a.spikeMs).slice(0, 10).map(s => ({
        ms: s.spikeMs,
        enemies: s.enemyCount,
        timeScale: s.timeScale,
        events: s.events,
      })),
    };
  });

  await screenshot('post-combat');
  await captureTelemetry('post-combat');

  // 8. Restore if minimal mode
  if (minimal) {
    log('Restoring visuals...');
    await page.evaluate(`
      (function() {
        const scene = window.__test?.getScene?.();
        if (scene) {
          scene.traverse(obj => { obj.visible = true; });
          if (scene._perfOriginalBg) { scene.background = scene._perfOriginalBg; delete scene._perfOriginalBg; }
        }
      })()
    `);
  }

  // 9. Cleanup logger
  await page.evaluate(() => {
    if (window.__origRAF) window.requestAnimationFrame = window.__origRAF;
    if (window.__origConsoleLog) console.log = window.__origConsoleLog;
    delete window.__spikeLog;
  });

  // 10. Build report
  const stats = spikeReport.frameTimeStats;
  log(`\n${'='.repeat(60)}`);
  log(`COMBAT SPIKE DIAGNOSTIC — Level ${targetLevel} — ${mode}`);
  log(`${'='.repeat(60)}`);
  log(`Total frames: ${spikeReport.totalFrames}`);
  log(`Spikes (>${spikeReport.spikeThreshold}ms): ${spikeReport.spikesDetected}`);
  log(`Frame time: min=${stats.min}ms avg=${stats.avg}ms p50=${stats.p50}ms p90=${stats.p90}ms p95=${stats.p95}ms p99=${stats.p99}ms max=${stats.max}ms`);
  if (spikeReport.spikesDetected > 0) {
    log(`\nSpike causes:`);
    for (const [cause, data] of Object.entries(spikeReport.spikeCauses).sort((a, b) => b[1].count - a[1].count)) {
      log(`  ${cause}: ${data.count} spikes, avg=${data.avgMs}ms, max=${data.maxMs}ms`);
    }
    log(`\nTop 10 spikes:`);
    for (const s of spikeReport.topSpikes) {
      log(`  ${s.ms}ms (enemies=${s.enemies}, ts=${s.timeScale}, events=[${s.events.join(',')}])`);
    }
  }
  if (spikeReport.slowMoFrameAnalysis.length > 0) {
    log(`\nSlow-mo frame analysis:`);
    for (const a of spikeReport.slowMoFrameAnalysis) {
      log(`  ${a.event}: before=${a.beforeMs}ms during=${a.duringMs}ms after=${a.afterMs}ms (enemies=${a.enemies})`);
    }
  }
  log(`\nSlow-mo events captured: ${spikeReport.slowMoEvents.length}`);
  log(`Enemy events captured: ${spikeReport.enemyEvents.length}`);
  log(`${'='.repeat(60)}`);

  const postState = await page.evaluate(() => ({
    enemies: window.__test?.getEnemyCount?.() ?? -1,
    level: window.game?.level,
    kills: window.game?.kills,
    health: window.game?.health,
  }));

  return {
    targetLevel,
    mode,
    profileDurationMs,
    spikeThresholdMs,
    combatActivity: combatResult,
    spikeReport,
    postState,
  };
}
