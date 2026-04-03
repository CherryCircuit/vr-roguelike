export default async function runIdleSoak(context) {
  const { log, ensurePlayingState, wait, captureTelemetry, screenshot, detectHooks } = context;
  const { durationMs = 15000, sampleIntervalMs = 3000 } = context.options || {};

  const hooks = await detectHooks();
  if (!hooks.hasPerfApi) {
    log('No window.__perf hooks detected, falling back to renderer + game stats only.');
  }

  await ensurePlayingState();
  log(`Idling for ${durationMs}ms with telemetry every ${sampleIntervalMs}ms`);
  const start = Date.now();
  const snapshots = [];

  snapshots.push((await captureTelemetry('idle-start')).data);

  while (Date.now() - start < durationMs) {
    await wait(sampleIntervalMs);
    snapshots.push((await captureTelemetry(`idle-${Math.round(Date.now() - start)}`)).data);
  }

  const tail = await captureTelemetry('idle-end');
  await screenshot('idle-soak-end');

  return {
    durationMs,
    sampleIntervalMs,
    sampleCount: snapshots.length + 1, // includes idle-end capture
    perfHooksDetected: hooks.hasPerfApi,
    rendererStats: tail.data.renderer,
  };
}
