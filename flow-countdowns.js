// ============================================================
//  FLOW COUNTDOWNS (Issue #196 Phase 4, reduced scope)
//  The two small state machines that gate gameplay transitions:
//  the READY-SCREEN countdown (3-2-1 before a level starts) and
//  the PAUSE-RESUME countdown (3-2-1 before returning to play).
//
//  Pure-move extraction from main.js. All HUD/audio side effects and
//  the actual state transitions are INJECTED callbacks — this module
//  owns only the timing state machines.
//
//  Deps (initFlowCountdowns, from main.js):
//    updateReadyCountdownText, playCountdown321, hideReadyScreen,
//    hideHUD, showHUD, hidePauseMenu, showPauseCountdown,
//    updatePauseCountdownDisplay, hidePauseCountdown,
//    onReadyCountdownComplete, onPauseCountdownComplete
// ============================================================

const DEBUG = false;
const _log = DEBUG ? console.log.bind(console) : () => {};

const READY_COUNTDOWN_SECONDS = 3;
const PAUSE_COUNTDOWN_DURATION = 3.0;

// Ready-screen countdown state
let readyCountdownActive = false;
let readyCountdownStartTime = 0;
let readyCountdownLastValue = READY_COUNTDOWN_SECONDS;

// Pause-resume countdown state
let pauseCountdown = 0;
let pauseCountdownActive = false;
let pauseCountdownStartTime = 0;
let pauseCountdownLastValue = 0;

let _deps = {};

function _hasDep(name) {
  return typeof _deps[name] === 'function';
}

/**
 * Wire countdown deps. Called once from main.js init.
 * All callbacks are guarded — safe no-op when unset (dev pages, tests).
 */
export function initFlowCountdowns(deps) {
  _deps = deps || {};
  readyCountdownActive = false;
  pauseCountdownActive = false;
  _log('[flow-countdowns] initialized');
}

// ── Ready-screen countdown ─────────────────────────────────

export function isReadyCountdownActive() {
  return readyCountdownActive;
}

/** Reset the ready countdown (level restarts, debug jumps, game reset). */
export function resetReadyCountdown() {
  readyCountdownActive = false;
  readyCountdownStartTime = 0;
  readyCountdownLastValue = READY_COUNTDOWN_SECONDS;
  if (_hasDep('updateReadyCountdownText')) _deps.updateReadyCountdownText(null);
}

/** Begin the 3-2-1 countdown before gameplay. */
export function startReadyCountdown() {
  if (readyCountdownActive) return;
  readyCountdownActive = true;
  readyCountdownStartTime = performance.now();
  readyCountdownLastValue = READY_COUNTDOWN_SECONDS;
  if (_hasDep('updateReadyCountdownText')) _deps.updateReadyCountdownText(`${READY_COUNTDOWN_SECONDS}`);
  if (_hasDep('playCountdown321')) _deps.playCountdown321(); // 321 sound triggers on the "3"
}

/** Tick the ready countdown (render-loop READY_SCREEN branch). */
export function updateReadyCountdown(now) {
  if (!readyCountdownActive) return;
  const elapsed = (now - readyCountdownStartTime) / 1000;
  const remaining = READY_COUNTDOWN_SECONDS - elapsed;
  if (remaining <= 0) {
    // Clear the flag BEFORE the callback so a re-entrant start can't early-return
    readyCountdownActive = false;
    readyCountdownStartTime = 0;
    if (_hasDep('onReadyCountdownComplete')) _deps.onReadyCountdownComplete();
    return;
  }
  const displayValue = Math.ceil(remaining);
  if (displayValue !== readyCountdownLastValue) {
    readyCountdownLastValue = displayValue;
    if (_hasDep('updateReadyCountdownText')) _deps.updateReadyCountdownText(`${displayValue}`);
  }
}

// ── Pause-resume countdown ─────────────────────────────────

export function isPauseCountdownActive() {
  return pauseCountdownActive;
}

/** Begin the 3-2-1 countdown before resuming from pause. */
export function startPauseCountdown() {
  if (pauseCountdownActive) return;
  if (_hasDep('hidePauseMenu')) _deps.hidePauseMenu();
  pauseCountdownActive = true;
  pauseCountdownStartTime = performance.now();
  pauseCountdownLastValue = Math.ceil(PAUSE_COUNTDOWN_DURATION);
  pauseCountdown = PAUSE_COUNTDOWN_DURATION;
  if (_hasDep('showPauseCountdown')) _deps.showPauseCountdown(pauseCountdown);
  if (_hasDep('updatePauseCountdownDisplay')) _deps.updatePauseCountdownDisplay(pauseCountdown);
  if (_hasDep('playCountdown321')) _deps.playCountdown321(); // 321 sound triggers on the "3"
}

/** Tick the pause countdown (render-loop PAUSED branch). */
export function updatePauseCountdown(now) {
  if (!pauseCountdownActive) return;
  const elapsed = (now - pauseCountdownStartTime) / 1000;
  const remaining = PAUSE_COUNTDOWN_DURATION - elapsed;
  if (remaining <= 0) {
    pauseCountdownActive = false;
    pauseCountdown = 0;
    if (_hasDep('hidePauseCountdown')) _deps.hidePauseCountdown();
    if (_hasDep('onPauseCountdownComplete')) _deps.onPauseCountdownComplete();
    return;
  }

  pauseCountdown = remaining;
  const displayValue = Math.ceil(remaining);
  if (displayValue !== pauseCountdownLastValue) {
    pauseCountdownLastValue = displayValue;
    if (_hasDep('updatePauseCountdownDisplay')) _deps.updatePauseCountdownDisplay(pauseCountdown);
  }
}
