// ============================================================
//  RUNTIME CONFIGURATION
//  Shared boot-time and dev-tool state for live vs dev launchers.
// ============================================================

const DEFAULT_VISUAL_TUNING = {
  renderMode: 'normal',
  stereoEyeSeparation: 0.064,
  glowStrength: 1.0,
  smokeStrength: 1.0,
  fogIntensity: 1.0,
  shellStrength: 1.0,
  shellSaturation: 1.0,
  shellScanlineSpeed: 1.0,
  shellNoiseAmount: 0.35,
  shellTint: '#99b8ff',
};

function sanitizeRawRuntimeConfig(raw = {}) {
  const rawDev = raw.dev || {};
  const rawSeed = raw.seed || {};
  const rawVisualTuning = rawDev.visualTuning || {};

  return {
    mode: raw.mode === 'dev' ? 'dev' : 'live',
    dev: {
      enabled: rawDev.enabled === true,
      exposeGlobals: rawDev.exposeGlobals === true,
      testAPI: rawDev.testAPI === true,
      perfMonitor: rawDev.perfMonitor === true,
      showFPS: rawDev.showFPS === true,
      positionPanel: rawDev.positionPanel === true,
      debugConsole: rawDev.debugConsole === true,
      seedControls: rawDev.seedControls === true,
      pendingJumpToLevel: Number.isFinite(rawDev.pendingJumpToLevel) ? rawDev.pendingJumpToLevel : null,
      visualTuning: { ...DEFAULT_VISUAL_TUNING, ...rawVisualTuning },
    },
    seed: {
      value: Number.isFinite(rawSeed.value) ? rawSeed.value : null,
      tier: typeof rawSeed.tier === 'string' ? rawSeed.tier : 'standard',
    },
    actions: {},
  };
}

const rawConfig = typeof globalThis !== 'undefined' ? globalThis.__SPACEOMICIDE_RUNTIME__ : null;
const runtimeConfig = sanitizeRawRuntimeConfig(rawConfig || {});

if (typeof globalThis !== 'undefined') {
  globalThis.__SPACEOMICIDE_RUNTIME__ = runtimeConfig;
}

export function getRuntimeConfig() {
  return runtimeConfig;
}

export function isDevRuntime() {
  return runtimeConfig.dev.enabled === true;
}

export function setDevFlag(key, value) {
  runtimeConfig.dev[key] = value;
  return runtimeConfig.dev[key];
}

export function getSeedSelection() {
  return runtimeConfig.seed;
}

export function setSeedSelection(seedValue, seedTier = runtimeConfig.seed.tier) {
  runtimeConfig.seed.value = Number.isFinite(seedValue) ? seedValue : null;
  runtimeConfig.seed.tier = typeof seedTier === 'string' ? seedTier : 'standard';
  return runtimeConfig.seed;
}

export function queueDebugJump(level) {
  runtimeConfig.dev.pendingJumpToLevel = Number.isFinite(level) ? level : null;
}

export function consumeDebugJump() {
  const level = runtimeConfig.dev.pendingJumpToLevel;
  runtimeConfig.dev.pendingJumpToLevel = null;
  return level;
}

export function registerRuntimeAction(name, fn) {
  if (typeof name !== 'string' || !name) return;
  runtimeConfig.actions[name] = typeof fn === 'function' ? fn : null;
}

export function invokeRuntimeAction(name, ...args) {
  const fn = runtimeConfig.actions[name];
  if (typeof fn !== 'function') return undefined;
  return fn(...args);
}
