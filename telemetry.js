// ============================================================
//  PERFORMANCE TELEMETRY SUPPORT
//  Lightweight frame history tracking for automated perf checks
// ============================================================

const telemetryState = {
  enabled: false,
  historyMs: 5000,
  samples: [], // [{ time, frameTimeMs }]
  lastSample: null,
};

function clampHistoryWindow(ms) {
  if (!Number.isFinite(ms)) return telemetryState.historyMs;
  const clamped = Math.max(500, Math.min(ms, 60000));
  telemetryState.historyMs = clamped;
  return telemetryState.historyMs;
}

function pruneSamples(now) {
  const cutoff = now - telemetryState.historyMs;
  while (telemetryState.samples.length && telemetryState.samples[0].time < cutoff) {
    telemetryState.samples.shift();
  }
}

export function enableTelemetry(options = {}) {
  telemetryState.enabled = true;
  if (options.historyMs) {
    clampHistoryWindow(options.historyMs);
  }
  telemetryState.samples.length = 0;
  telemetryState.lastSample = null;
  return true;
}

export function disableTelemetry() {
  telemetryState.enabled = false;
  telemetryState.samples.length = 0;
  return false;
}

export function isTelemetryEnabled() {
  return telemetryState.enabled;
}

export function setTelemetryHistoryMs(ms) {
  const updated = clampHistoryWindow(ms);
  if (telemetryState.lastSample) {
    pruneSamples(telemetryState.lastSample.now);
  }
  return updated;
}

function computeWindowStats(now, windowMs) {
  const cutoff = now - windowMs;
  const values = [];
  let earliest = now;

  for (let i = telemetryState.samples.length - 1; i >= 0; i--) {
    const entry = telemetryState.samples[i];
    if (entry.time < cutoff) break;
    values.push(entry.frameTimeMs);
    if (entry.time < earliest) earliest = entry.time;
  }

  if (values.length === 0) {
    return {
      count: 0,
      avg: null,
      min: null,
      max: null,
      p95: null,
      p99: null,
      fps: 0,
    };
  }

  const sum = values.reduce((a, b) => a + b, 0);
  const avg = sum / values.length;
  const sorted = values.slice().sort((a, b) => a - b);
  const percentile = (p) => {
    if (sorted.length === 0) return null;
    const idx = Math.min(sorted.length - 1, Math.max(0, Math.floor(p * (sorted.length - 1))));
    return sorted[idx];
  };
  const durationSec = Math.max(0.001, (now - Math.max(cutoff, earliest)) / 1000);
  const fps = Math.round(values.length / durationSec);

  return {
    count: values.length,
    avg,
    min: sorted[0],
    max: sorted[sorted.length - 1],
    p95: percentile(0.95),
    p99: percentile(0.99),
    fps,
  };
}

export function recordTelemetrySample(sample) {
  telemetryState.lastSample = { ...sample };
  telemetryState.samples.push({ time: sample.now, frameTimeMs: sample.frameTimeMs });
  pruneSamples(sample.now);
}

export function getTelemetrySnapshot() {
  const sample = telemetryState.lastSample;
  if (!sample) return null;

  const stats1s = computeWindowStats(sample.now, 1000);
  const statsHistory = computeWindowStats(sample.now, telemetryState.historyMs);

  return {
    timestamp: sample.now,
    frame: sample.frame,
    fps: {
      instant: sample.frameTimeMs > 0 ? 1000 / sample.frameTimeMs : 0,
      avg1s: stats1s.fps,
      avgHistory: statsHistory.fps,
    },
    frameTimeMs: {
      last: sample.frameTimeMs,
      avg1s: stats1s.avg,
      min1s: stats1s.min,
      max1s: stats1s.max,
      p95_1s: stats1s.p95,
      p99_1s: stats1s.p99,
      avgHistory: statsHistory.avg,
      p95History: statsHistory.p95,
      p99History: statsHistory.p99,
      countHistory: statsHistory.count,
    },
    history: {
      windowMs: telemetryState.historyMs,
      samples: telemetryState.samples.length,
      enabled: telemetryState.enabled,
    },
    memory: sample.memory || null,
    renderer: sample.renderer || null,
    counts: sample.counts || null,
    gameplay: sample.gameplay || null,
  };
}
