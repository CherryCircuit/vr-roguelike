/**
 * Progression Stress Test — Full Playthrough
 *
 * Plays through all 20 levels sequentially, killing enemies and clicking
 * through upgrades at each level. Captures per-level renderer stats to
 * detect resource leaks across progression.
 *
 * After completing all levels, performs a full restart and captures
 * "fresh run" stats to detect leaked resources that persisted after reset.
 *
 * Version resilience: Only depends on:
 *   - window.__test hooks (fireAtEnemy, getEnemyCount, getScene, getRenderer)
 *   - window.__perf hooks (getSnapshot, fps, frameTime)
 *   - window.game (state, level, kills, health)
 *   - window.debugJumpToLevel
 *
 * Usage:
 *   node tests/perf/run-perf.mjs --scenarios=progression-stress
 *   node tests/perf/run-perf.mjs --scenarios=progression-stress --startLevel=5 --endLevel=10
 *   node tests/perf/run-perf.mjs --scenarios=progression-stress --killTimeoutMs=30000
 */

export default async function runProgressionStress(context) {
  const { page, log, wait, captureTelemetry, screenshot, ensurePlayingState, reloadGame } = context;
  const {
    startLevel = 1,
    endLevel = 20,
    killTimeoutMs = 60000,
    spikeThresholdMs = 50,
    fireLoopIntervalMs = 300,
  } = context.options || {};

  const GEO_LEAK_THRESHOLD = 100;

  log(`Progression stress: levels ${startLevel}–${endLevel}, kill timeout ${killTimeoutMs}ms`);

  // ── Per-level data collection ──
  const levelReports = [];
  let previousGeo = null;

  // ── Helper: capture renderer stats ──
  async function getRendererStats() {
    return page.evaluate(() => {
      const renderer = window.__test?.getRenderer?.();
      if (!renderer || !renderer.info) return null;
      const snap = window.__perf?.getSnapshot?.();
      return {
        geometries: renderer.info.memory.geometries,
        textures: renderer.info.memory.textures,
        triangles: renderer.info.render.triangles,
        drawCalls: renderer.info.render.calls,
        programs: renderer.info.programs?.length ?? null,
        fps: snap?.fps?.instant ?? snap?.fps ?? null,
        frameTime: snap?.frameTime ?? null,
        memory: snap?.memory ?? null,
        jsHeap: performance.memory
          ? {
              usedJSHeapSize: performance.memory.usedJSHeapSize,
              totalJSHeapSize: performance.memory.totalJSHeapSize,
              jsHeapSizeLimit: performance.memory.jsHeapSizeLimit,
            }
          : null,
      };
    });
  }

  // ── Helper: wait for a specific game state ──
  async function waitForState(targetStates, timeoutMs = 15000) {
    const targets = new Set(Array.isArray(targetStates) ? targetStates : [targetStates]);
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
      const state = await page.evaluate(() => window.game?.state ?? null);
      if (targets.has(state)) return state;
      await wait(200);
    }
    const current = await page.evaluate(() => window.game?.state ?? null);
    return current;
  }

  // ── Helper: fire at enemies until all dead or timeout ──
  async function killAllEnemies(levelNum) {
    const start = Date.now();
    let shotsFired = 0;
    let waveCheckInterval = 3000;
    let lastWaveCheck = 0;
    const frameSpikes = [];

    // Inject a lightweight spike tracker for this level
    await page.evaluate((threshold) => {
      window.__levelSpikes = [];
      const origRAF = window.requestAnimationFrame.bind(window);
      let lastT = performance.now();
      window.__origRAF_level = origRAF;
      window.requestAnimationFrame = function(cb) {
        return origRAF(function(ts) {
          const dt = ts - lastT;
          lastT = ts;
          if (dt > threshold) {
            window.__levelSpikes.push({ ms: Math.round(dt * 100) / 100, t: Math.round(ts) });
            if (window.__levelSpikes.length > 500) window.__levelSpikes = window.__levelSpikes.slice(-250);
          }
          cb(ts);
        });
      };
    }, spikeThresholdMs);

    try {
      while (Date.now() - start < killTimeoutMs) {
        const elapsed = Date.now() - start;

        const stateInfo = await page.evaluate(() => ({
          state: window.game?.state ?? null,
          enemies: window.__test?.getEnemyCount?.() ?? 0,
          kills: window.game?.kills ?? 0,
          killTarget: window.game?._levelConfig?.killTarget ?? 0,
          health: window.game?.health ?? 0,
        }));

        // Level complete or died
        if (stateInfo.state === 'level_complete') {
          log(`  Level ${levelNum} complete! (${stateInfo.kills} kills, ${Date.now() - start}ms)`);
          break;
        }
        if (stateInfo.state === 'game_over' || stateInfo.health <= 0) {
          log(`  Level ${levelNum}: game over at ${stateInfo.kills} kills. Continuing.`);
          break;
        }
        if (stateInfo.state !== 'playing') {
          // Unexpected state, try to advance
          await page.mouse.click(640, 400);
          await wait(500);
          continue;
        }

        // Fire at enemies
        if (stateInfo.enemies > 0) {
          const shotsThisRound = Math.min(stateInfo.enemies, 3);
          for (let i = 0; i < shotsThisRound; i++) {
            const ok = await page.evaluate((idx) =>
              window.__test?.fireAtEnemy?.(idx, { distance: 5, hp: 1, snapToCamera: true }) ?? false, i
            );
            if (ok) shotsFired++;
          }
        } else {
          // No enemies visible. Might be between waves or level complete pending.
          // Give the game a moment to transition.
          await wait(1000);
          const recheck = await page.evaluate(() => window.game?.state ?? null);
          if (recheck === 'level_complete') {
            log(`  Level ${levelNum} complete! (${Date.now() - start}ms)`);
            break;
          }
        }

        await wait(fireLoopIntervalMs);

        // Periodic status
        if (elapsed - lastWaveCheck > waveCheckInterval) {
          log(`  [${Math.round(elapsed / 1000)}s] enemies=${stateInfo.enemies} kills=${stateInfo.kills}/${stateInfo.killTarget} shots=${shotsFired}`);
          lastWaveCheck = elapsed;
        }
      }

      // Collect spikes
      const spikes = await page.evaluate(() => {
        const s = window.__levelSpikes || [];
        return [...s];
      });
      frameSpikes.push(...spikes);

      return { shotsFired, frameSpikes, timedOut: Date.now() - start >= killTimeoutMs };
    } finally {
      // Restore RAF
      await page.evaluate(() => {
        if (window.__origRAF_level) {
          window.requestAnimationFrame = window.__origRAF_level;
          delete window.__origRAF_level;
        }
        delete window.__levelSpikes;
      });
    }
  }

  // ── Helper: click through upgrade screen ──
  async function clickThroughUpgrade(levelNum) {
    const state = await waitForState(['upgrade_select'], 5000);
    if (state === 'upgrade_select') {
      await wait(500); // Let the cards animate in
      await page.mouse.click(640, 400);
      log(`  Level ${levelNum}: selected upgrade card`);
      await wait(300);
      return true;
    }
    // Might have skipped straight to ready_screen
    if (state === 'ready_screen') {
      log(`  Level ${levelNum}: no upgrade screen, at ready_screen`);
      return true;
    }
    log(`  Level ${levelNum}: unexpected state after combat: ${state}, clicking center`);
    await page.mouse.click(640, 400);
    await wait(500);
    return true;
  }

  // ── Helper: click through ready_screen ──
  async function clickThroughReady(levelNum) {
    const state = await waitForState(['ready_screen', 'playing'], 5000);
    if (state === 'ready_screen') {
      await page.mouse.click(640, 400);
      log(`  Level ${levelNum}: clicked through ready_screen`);
      await wait(500);
    }
  }

  // ── Helper: jump to a specific level ──
  async function jumpToLevel(levelNum) {
    await page.evaluate((level) => {
      window.debugJumpToLevel = level;
      window.game.state = window.State.TITLE;
    }, levelNum);
    await wait(500);
    await page.mouse.click(640, 400);
    await wait(1000);

    const result = await page.evaluate(() => {
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

    if (!result.ok) {
      throw new Error(`Failed to reach level ${levelNum}, stuck at ${result.state}`);
    }
    log(`  Now at level ${result.level}`);
    return result.level;
  }

  // ══════════════════════════════════════════════
  // MAIN LOOP: Play through each level
  // ══════════════════════════════════════════════

  // Ensure we're in a playing state first
  await ensurePlayingState();

  // Capture baseline stats before starting
  const baselineStats = await getRendererStats();
  log(`Baseline stats: GEO=${baselineStats?.geometries}, TEX=${baselineStats?.textures}, TRI=${baselineStats?.triangles}, DC=${baselineStats?.drawCalls}`);
  previousGeo = baselineStats?.geometries ?? 0;

  // Capture baseline telemetry
  await captureTelemetry('baseline');
  await screenshot('baseline');

  for (let lvl = startLevel; lvl <= endLevel; lvl++) {
    const isBoss = [5, 10, 15, 20].includes(lvl);
    log(`\n── Level ${lvl}${isBoss ? ' (BOSS)' : ''} ──`);

    // Jump to level (for level 1 we may already be there)
    if (lvl === 1 && startLevel === 1) {
      // We're already in playing state at level 1 after ensurePlayingState
      const currentLevel = await page.evaluate(() => window.game?.level ?? 1);
      if (currentLevel !== 1) {
        await jumpToLevel(1);
      }
    } else {
      await jumpToLevel(lvl);
    }

    // Brief wait for enemies to spawn
    const spawnWait = isBoss ? 2000 : 1500;
    log(`  Waiting ${spawnWait}ms for enemies to spawn...`);
    await wait(spawnWait);

    // Capture pre-combat stats
    const preStats = await getRendererStats();
    const preEnemies = await page.evaluate(() => window.__test?.getEnemyCount?.() ?? 0);
    log(`  Pre-combat: enemies=${preEnemies}, GEO=${preStats?.geometries}, TRI=${preStats?.triangles}`);

    await captureTelemetry(`level-${lvl}-pre-combat`);

    // Kill all enemies
    const combatResult = await killAllEnemies(lvl);

    // Capture post-combat stats
    const postStats = await getRendererStats();
    await captureTelemetry(`level-${lvl}-post-combat`);
    await screenshot(`level-${lvl}-post-combat`);

    // Click through upgrade screen if present
    const didUpgrade = await clickThroughUpgrade(lvl);

    // Click through ready screen for next level
    if (lvl < endLevel) {
      await clickThroughReady(lvl);
    }

    // Calculate deltas
    const geoDelta = previousGeo !== null ? (postStats?.geometries ?? 0) - previousGeo : 0;
    const geoJumpFlag = geoDelta > GEO_LEAK_THRESHOLD;

    const report = {
      level: lvl,
      isBoss,
      preCombat: { enemies: preEnemies, stats: preStats },
      postCombat: { stats: postStats },
      combat: {
        shotsFired: combatResult.shotsFired,
        timedOut: combatResult.timedOut,
        frameSpikes: combatResult.frameSpikes.length,
        worstSpike: combatResult.frameSpikes.length > 0
          ? Math.max(...combatResult.frameSpikes.map(s => s.ms))
          : 0,
        topSpikes: combatResult.frameSpikes
          .sort((a, b) => b.ms - a.ms)
          .slice(0, 5),
      },
      delta: {
        geo: geoDelta,
        textures: previousGeo !== null && baselineStats ? (postStats?.textures ?? 0) - (baselineStats.textures ?? 0) : null,
        triangles: previousGeo !== null && baselineStats ? (postStats?.triangles ?? 0) - (baselineStats.triangles ?? 0) : null,
        drawCalls: previousGeo !== null && baselineStats ? (postStats?.drawCalls ?? 0) - (baselineStats.drawCalls ?? 0) : null,
      },
      geoJumpFlag,
      upgraded: didUpgrade,
    };

    levelReports.push(report);
    previousGeo = postStats?.geometries ?? previousGeo;

    // Per-level summary
    log(`  Post-combat: GEO=${postStats?.geometries}, TEX=${postStats?.textures}, TRI=${postStats?.triangles}, DC=${postStats?.drawCalls}`);
    log(`  GEO delta: ${geoDelta >= 0 ? '+' : ''}${geoDelta}${geoJumpFlag ? ' ⚠️ LEAK' : ''}`);
    log(`  Frame spikes: ${combatResult.frameSpikes.length} (worst: ${report.combat.worstSpike}ms)`);
    if (combatResult.timedOut) {
      log(`  ⚠️ Timed out killing enemies after ${killTimeoutMs}ms`);
    }
  }

  // ══════════════════════════════════════════════
  // POST-PROGRESSION: Full restart to detect leaks
  // ══════════════════════════════════════════════

  log(`\n── Full restart to detect persistent leaks ──`);

  const preRestartStats = await getRendererStats();
  log(`Pre-restart: GEO=${preRestartStats?.geometries}, TEX=${preRestartStats?.textures}, TRI=${preRestartStats?.triangles}`);

  await captureTelemetry('pre-restart');
  await screenshot('pre-restart');

  // Full page reload
  await reloadGame('full restart for leak detection');
  await ensurePlayingState();

  // Capture fresh-run stats
  const postRestartStats = await getRendererStats();
  log(`Post-restart: GEO=${postRestartStats?.geometries}, TEX=${postRestartStats?.textures}, TRI=${postRestartStats?.triangles}`);

  await captureTelemetry('post-restart');
  await screenshot('post-restart');

  const leakAnalysis = {
    preRestart: preRestartStats,
    postRestart: postRestartStats,
    leaked: {
      geometries: (preRestartStats?.geometries ?? 0) - (postRestartStats?.geometries ?? 0),
      textures: (preRestartStats?.textures ?? 0) - (postRestartStats?.textures ?? 0),
      triangles: (preRestartStats?.triangles ?? 0) - (postRestartStats?.triangles ?? 0),
      drawCalls: (preRestartStats?.drawCalls ?? 0) - (postRestartStats?.drawCalls ?? 0),
    },
    clean: (postRestartStats?.geometries ?? 0) <= (baselineStats?.geometries ?? 0) + 10
      && (postRestartStats?.textures ?? 0) <= (baselineStats?.textures ?? 0) + 10,
  };

  // ══════════════════════════════════════════════
  // REPORT
  // ══════════════════════════════════════════════

  const geoJumpLevels = levelReports.filter(r => r.geoJumpFlag);
  const totalSpikes = levelReports.reduce((sum, r) => sum + r.combat.frameSpikes, 0);
  const worstOverallSpike = Math.max(0, ...levelReports.map(r => r.combat.worstSpike));
  const timedOutLevels = levelReports.filter(r => r.combat.timedOut);

  log(`\n${'═'.repeat(64)}`);
  log(`PROGRESSION STRESS TEST RESULTS — Levels ${startLevel}–${endLevel}`);
  log(`${'═'.repeat(64)}`);
  log(``);
  log(`Per-level renderer stats:`);
  log(`  ${'LVL'.padEnd(5)} ${'BOSS'.padEnd(5)} ${'GEO'.padEnd(6)} ${'TEX'.padEnd(6)} ${'TRI'.padEnd(10)} ${'DC'.padEnd(5)} ${'ΔGEO'.padEnd(7)} ${'SPIKES'.padEnd(7)} ${'WORST'.padEnd(8)} ${'TIMEOUT'}`);
  log(`  ${'─'.repeat(70)}`);

  for (const r of levelReports) {
    const stats = r.postCombat.stats;
    const geoStr = (stats?.geometries ?? '?').toString().padEnd(6);
    const texStr = (stats?.textures ?? '?').toString().padEnd(6);
    const triStr = (stats?.triangles ?? '?').toString().padEnd(10);
    const dcStr = (stats?.drawCalls ?? '?').toString().padEnd(5);
    const deltaStr = (r.delta.geo >= 0 ? '+' : '') + (r.delta.geo ?? '?');
    const deltaPad = deltaStr.padEnd(7);
    const spikeStr = r.combat.frameSpikes.toString().padEnd(7);
    const worstStr = (r.combat.worstSpike + 'ms').padEnd(8);
    const bossStr = (r.isBoss ? 'YES' : '').padEnd(5);
    const toStr = (r.combat.timedOut ? 'YES' : '').padEnd(7);

    log(`  ${r.level.toString().padEnd(5)} ${bossStr} ${geoStr} ${texStr} ${triStr} ${dcStr} ${deltaPad} ${spikeStr} ${worstStr} ${toStr}`);
  }

  log(``);
  log(`Post-restart leak analysis:`);
  log(`  GEO leaked:  ${leakAnalysis.leaked.geometries}`);
  log(`  TEX leaked:  ${leakAnalysis.leaked.textures}`);
  log(`  TRI leaked:  ${leakAnalysis.leaked.triangles}`);
  log(`  DC leaked:   ${leakAnalysis.leaked.drawCalls}`);
  log(`  Clean reset: ${leakAnalysis.clean ? 'YES ✅' : 'NO ⚠️'}`);

  if (geoJumpLevels.length > 0) {
    log(``);
    log(`⚠️  GEO jumps > ${GEO_LEAK_THRESHOLD}: levels [${geoJumpLevels.map(r => r.level).join(', ')}]`);
  }

  if (timedOutLevels.length > 0) {
    log(``);
    log(`⚠️  Kill timeouts: levels [${timedOutLevels.map(r => r.level).join(', ')}]`);
  }

  log(``);
  log(`Total frame spikes across all levels: ${totalSpikes}`);
  log(`Worst single spike: ${worstOverallSpike}ms`);
  log(`${'═'.repeat(64)}`);

  return {
    startLevel,
    endLevel,
    killTimeoutMs,
    spikeThresholdMs,
    baselineStats,
    levelReports,
    leakAnalysis,
    summary: {
      levelsCompleted: levelReports.length,
      geoJumpLevels: geoJumpLevels.map(r => r.level),
      timedOutLevels: timedOutLevels.map(r => r.level),
      totalFrameSpikes: totalSpikes,
      worstSpike: worstOverallSpike,
      cleanRestart: leakAnalysis.clean,
    },
  };
}
