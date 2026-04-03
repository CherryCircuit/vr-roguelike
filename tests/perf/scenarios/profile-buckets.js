/**
 * Profile Buckets Scenario
 *
 * Enables the __perf.startProfileBuckets() instrumentation in main.js,
 * runs an idle soak, then reads the accumulated bucket timings and writes
 * a ranked hotspot report.
 *
 * Usage:
 *   node tests/perf/run-perf.mjs --scenarios=profile-buckets
 *   node tests/perf/run-perf.mjs --scenarios=profile-buckets --profileDurationMs=20000
 */
export default async function runProfileBuckets(context) {
  const { page, log, ensurePlayingState, wait, captureTelemetry, screenshot } = context;
  const { durationMs = 15000 } = context.options || {};

  await ensurePlayingState();

  // Reset and enable bucket profiler
  const started = await page.evaluate(() => {
    const perf = window.__perf;
    if (!perf || typeof perf.startProfileBuckets !== 'function') {
      return { ok: false, reason: '__perf.startProfileBuckets not available' };
    }
    perf.startProfileBuckets();
    return { ok: true };
  });

  if (!started.ok) {
    log(`ERROR: ${started.reason}`);
    return { error: started.reason };
  }

  log(`Profiling buckets for ${durationMs}ms...`);
  await wait(durationMs);

  // Read the accumulated buckets
  const report = await page.evaluate(() => {
    const perf = window.__perf;
    if (!perf || typeof perf.dumpProfileBuckets !== 'function') {
      return { error: 'dumpProfileBuckets not available' };
    }
    
    // Enumerate scene objects by triangle count
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
              vertices: geo.attributes.position ? geo.attributes.position.count : 0,
              visible: obj.visible,
              frustumCulled: obj.frustumCulled,
            });
          }
        }
      });
      objectBreakdown.sort((a, b) => b.triangles - a.triangles);
    } else {
      objectBreakdown.push({ note: 'Scene reference not available via test hooks' });
    }
    objectBreakdown.sort((a, b) => b.triangles - a.triangles);
    
    return {
      reportText: perf.dumpProfileBuckets(),
      rawData: JSON.parse(JSON.stringify(perf._profileBuckets || {})),
      objectBreakdown,
    };
  });

  await screenshot('profile-buckets-end');
  const tail = await captureTelemetry('profile-buckets-end');

  return {
    durationMs,
    report: report.reportText,
    rawBuckets: report.rawData,
    objectBreakdown: report.objectBreakdown,
    telemetryTail: tail.data,
  };
}
