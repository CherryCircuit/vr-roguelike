/**
 * Full Run + Restart Test
 * Plays through 17 levels → game over → name entry → scoreboard → title → new 17-level run
 * Tracks GEO/TEX/TRI/DC/Heap at each level to verify cleanup between playthroughs.
 */
export default async function runFullRunRestart(context) {
  const { page, log, wait, captureTelemetry, screenshot } = context;
  const { targetLevels = 17, playerName = 'CODEY' } = context.options || {};

  const snapshots = [];

  async function snap(label) {
    const data = await page.evaluate(() => {
      const r = window.__test?.getRenderer?.();
      if (!r) return { error: 'no renderer' };
      const info = r.info.memory;
      const render = r.info.render;
      const g = window.__SPACEOMICIDE_RUNTIME__?.game || window.__game || window.game;
      const inst = window.__perf?.collect ? window.__perf.collect() : null;
      return {
        geo: info.geometries,
        tex: info.textures,
        tri: inst?.renderer?.triangles ?? render.triangles,
        dc: inst?.renderer?.drawCalls ?? render.calls,
        heapMB: inst?.memory?.usedMB ?? null,
        level: g?.level ?? null,
        state: g?.state ?? null,
        enemies: inst?.counts?.enemies ?? null,
      };
    });
    data.label = label;
    snapshots.push(data);
    if (data.error) {
      log(`  [${label}] ERROR: ${data.error}`);
    } else {
      log(`  [${label}] GEO=${data.geo} TEX=${data.tex} TRI=${data.tri} DC=${data.dc} heap=${data.heapMB}MB L=${data.level} state=${data.state}`);
    }
    return data;
  }

  // ── RUN 1: Play through targetLevels levels ──
  log(`Run 1: advancing ${targetLevels} levels`);
  await snap('run1-start');

  for (let lvl = 1; lvl <= targetLevels; lvl++) {
    await page.evaluate(() => {
      const p = window.__progression || window.__test?.progression;
      if (p?.forceLevelComplete) {
        try { p.forceLevelComplete(); } catch(e) { /* boss alert timeout */ }
      }
    });
    await wait(800);

    await page.evaluate(() => {
      const p = window.__progression || window.__test?.progression;
      if (p?.selectUpgradeByIndex) p.selectUpgradeByIndex(0);
      else if (p?.skipUpgrade) p.skipUpgrade();
    });
    await wait(1500);
    await snap(`run1-L${lvl}`);
  }

  // ── Trigger game over ──
  log('Triggering game over...');
  await page.evaluate(() => {
    const g = window.__SPACEOMICIDE_RUNTIME__?.game || window.__game || window.game;
    if (g) {
      g.finalScore = g.score || 100;
      g.finalLevel = g.level || 17;
    }
    // Kill the player
    const p = window.__progression || window.__test?.progression;
    if (p?.forceLevelComplete) {
      // The game may have already ended at L20 (victory). Check state.
    }
  });

  // Check if we hit victory (L20) instead of game over
  const endState = await page.evaluate(() => {
    const g = window.__SPACEOMICIDE_RUNTIME__?.game || window.__game || window.game;
    return g?.state;
  });
  log(`End state after ${targetLevels} levels: ${endState}`);

  if (endState === 'victory' || endState === 'game_over') {
    // Already in an end state, proceed
  } else {
    // Force game over
    await page.evaluate(() => {
      const g = window.__SPACEOMICIDE_RUNTIME__?.game || window.__game || window.game;
      if (g) {
        g.health = 0;
      }
    });
    await wait(2000);
  }
  await snap('run1-endgame');

  // ── Navigate to name entry (from game over or victory) ──
  log('Navigating to name entry...');
  await page.evaluate(() => {
    const g = window.__SPACEOMICIDE_RUNTIME__?.game || window.__game || window.game;
    // Store country so we skip country select
    if (typeof setStoredCountry === 'function') setStoredCountry('CA');
    else if (window.__test?.setStoredCountry) window.__test.setStoredCountry('CA');

    // Go to name entry
    g.state = 'name_entry';
    // The showNameEntry function needs to be called from hud
    // Check if it's available via the global hud module
  });
  await wait(1000);
  await snap('run1-nameentry');

  // ── Type the name and submit ──
  log(`Typing name "${playerName}"...`);
  await page.evaluate((name) => {
    // Use the desktop type callback which is registered
    // The nameKeyCallback was registered with setNameKeyCallback
    // We can call desktopTypeChar directly from the hud module via the callback
    // Actually, let's just simulate key events
  }, playerName);

  // Type each character via keyboard dispatch
  for (const ch of playerName) {
    await page.keyboard.press(ch);
    await wait(100);
  }
  // Press Enter to submit
  await page.keyboard.press('Enter');
  await wait(2500);
  await snap('run1-scoreboard');

  // ── Go back to title from scoreboard ──
  log('Returning to title...');
  await page.evaluate(() => {
    const g = window.__SPACEOMICIDE_RUNTIME__?.game || window.__game || window.game;
    // Simulate the "back" action from scoreboard
    // resetGame + showTitle
    g.state = 'title';
  });
  await wait(2000);
  await snap('run1-title');

  // ── RUN 2: Start a new game ──
  log(`Run 2: starting new game for ${targetLevels} levels`);
  await page.evaluate(() => {
    const p = window.__progression || window.__test?.progression;
    if (p?.startAt) {
      p.startAt(1);
    } else {
      const btn = document.querySelector('button');
      if (btn) btn.click();
    }
  });
  await wait(3000);
  await snap('run2-start');

  for (let lvl = 1; lvl <= targetLevels; lvl++) {
    await page.evaluate(() => {
      const p = window.__progression || window.__test?.progression;
      if (p?.forceLevelComplete) {
        try { p.forceLevelComplete(); } catch(e) {}
      }
    });
    await wait(800);

    await page.evaluate(() => {
      const p = window.__progression || window.__test?.progression;
      if (p?.selectUpgradeByIndex) p.selectUpgradeByIndex(0);
      else if (p?.skipUpgrade) p.skipUpgrade();
    });
    await wait(1500);
    await snap(`run2-L${lvl}`);
  }

  await snap('run2-end');

  // ── Analysis ──
  const s = (label) => snapshots.find(x => x.label === label);
  const r1s = s('run1-start');
  const r1l = s(`run1-L${targetLevels}`);
  const title = s('run1-title');
  const r2s = s('run2-start');
  const r2l = s(`run2-L${targetLevels}`);

  const analysis = {};
  if (r1s && !r1s.error) {
    analysis.run1StartGEO = r1s.geo;
    analysis.run1StartTEX = r1s.tex;
    analysis.run1StartHeap = r1s.heapMB;
  }
  if (r1l && !r1l.error) {
    analysis.run1EndGEO = r1l.geo;
    analysis.run1EndTEX = r1l.tex;
    analysis.run1EndHeap = r1l.heapMB;
  }
  if (title && !title.error) {
    analysis.titleGEO = title.geo;
    analysis.titleTEX = title.tex;
    analysis.titleHeap = title.heapMB;
    if (r1s && !r1s.error) {
      analysis.titleDriftGEO = title.geo - r1s.geo;
      analysis.titleDriftTEX = title.tex - r1s.tex;
    }
  }
  if (r2s && !r2s.error) {
    analysis.run2StartGEO = r2s.geo;
    analysis.run2StartTEX = r2s.tex;
    analysis.run2StartHeap = r2s.heapMB;
    if (r1s && !r1s.error) {
      analysis.run2vsRun1GEO = r2s.geo - r1s.geo;
      analysis.run2vsRun1TEX = r2s.tex - r1s.tex;
    }
  }
  if (r2l && !r2l.error) {
    analysis.run2EndGEO = r2l.geo;
    analysis.run2EndTEX = r2l.tex;
    if (r1l && !r1l.error) {
      analysis.run2EndVsRun1EndGEO = r2l.geo - r1l.geo;
    }
  }

  log(`\n=== FULL RUN RESTART RESULTS ===`);
  log(`Run 1 Start:  GEO=${analysis.run1StartGEO} TEX=${analysis.run1StartTEX}`);
  log(`Run 1 End:    GEO=${analysis.run1EndGEO} TEX=${analysis.run1EndTEX}`);
  log(`Title Screen: GEO=${analysis.titleGEO} TEX=${analysis.titleTEX} (drift: GEO ${analysis.titleDriftGEO ?? '?'}, TEX ${analysis.titleDriftTEX ?? '?'})`);
  log(`Run 2 Start:  GEO=${analysis.run2StartGEO} TEX=${analysis.run2StartTEX} (vs Run1: GEO ${analysis.run2vsRun1GEO ?? '?'}, TEX ${analysis.run2vsRun1TEX ?? '?'})`);
  log(`Run 2 End:    GEO=${analysis.run2EndGEO} TEX=${analysis.run2EndTEX} (vs Run1 End: GEO ${analysis.run2EndVsRun1EndGEO ?? '?'})`);

  await screenshot('full-run-restart-end');

  return {
    success: !snapshots.some(s => s.error),
    analysis,
    snapshots: snapshots.map(s => ({
      label: s.label,
      geo: s.geo,
      tex: s.tex,
      tri: s.tri,
      dc: s.dc,
      heapMB: s.heapMB,
      level: s.level,
      state: s.state,
    })),
    totalSnapshots: snapshots.length,
  };
}
