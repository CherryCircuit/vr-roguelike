export default async function runCombatStress(context) {
  const { log, ensurePlayingState, captureTelemetry, screenshot, wait, detectHooks, page } = context;
  const {
    waves = 3,
    volleyDelayMs = 350,
    prepareDelayMs = 2000,
  } = context.options || {};

  await ensurePlayingState();
  const hooks = await detectHooks();
  const hasTestAPI = hooks.hasTestHooks;
  if (!hasTestAPI) {
    log('window.__test hooks are missing, cannot drive deterministic combat.');
    return { blocked: 'missing __test hooks', hasTestHooks: false };
  }

  await captureTelemetry('combat-start');

  const runResult = await page.evaluate(async (config) => {
    const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
    if (!window.__test?.fireAtEnemy || !window.__test?.getEnemyCount) {
      return { blocked: true, reason: 'missing __test.fireAtEnemy' };
    }

    const summary = {
      waveResults: [],
      initialKills: window.game?.kills ?? 0,
      initialScore: window.game?.score ?? 0,
      shots: 0,
    };

    for (let wave = 0; wave < config.waves; wave += 1) {
      await sleep(config.prepareDelayMs);

      let attempts = 0;
      while (window.__test.getEnemyCount() === 0 && attempts < 40) {
        await sleep(250);
        attempts += 1;
      }

      const enemyCount = window.__test.getEnemyCount();
      let fired = 0;

      if (enemyCount > 0) {
        for (let i = 0; i < enemyCount; i += 1) {
          const ok = window.__test.fireAtEnemy(i, { distance: 5, hp: 1, snapToCamera: true });
          if (ok) fired += 1;
          await sleep(config.volleyDelayMs);
        }
      }

      summary.waveResults.push({
        wave,
        enemyCount,
        fired,
        waitedForSpawn: attempts * 250,
      });
      summary.shots += fired;
      await sleep(400);
    }

    await sleep(1500);

    summary.finalKills = window.game?.kills ?? 0;
    summary.finalScore = window.game?.score ?? 0;
    summary.finalState = window.game?.state ?? null;

    return summary;
  }, { waves, volleyDelayMs, prepareDelayMs });

  const telemetry = await captureTelemetry('combat-end');
  await screenshot('combat-stress-end');

  return {
    waves,
    volleyDelayMs,
    prepareDelayMs,
    ...runResult,
    rendererStats: telemetry.data.renderer,
  };
}
