export default async function runRestartChurn(context) {
  const { log, ensurePlayingState, reloadGame, wait, captureTelemetry, screenshot } = context;
  const { cycles = 3, soakMs = 2500 } = context.options || {};

  const cycleSummaries = [];

  for (let cycle = 1; cycle <= cycles; cycle += 1) {
    log(`Cycle ${cycle}/${cycles}: stabilizing in playing state`);
    await ensurePlayingState();

    const before = await captureTelemetry(`restart-${cycle}-before`);
    await wait(soakMs);
    const after = await captureTelemetry(`restart-${cycle}-after`);

    cycleSummaries.push({
      cycle,
      soakMs,
      startState: before.data.state,
      endState: after.data.state,
      killsDelta: (after.data.kills ?? 0) - (before.data.kills ?? 0),
      scoreDelta: (after.data.score ?? 0) - (before.data.score ?? 0),
    });

    if (cycle < cycles) {
      await reloadGame(`restart-cycle-${cycle}`);
    }
  }

  await screenshot('restart-churn-end');

  return {
    cycles,
    soakMs,
    cyclesRun: cycleSummaries,
  };
}
