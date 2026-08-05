// ============================================================
//  INPUT ROUTER (Issue #196 Phase 4, reduced scope)
//  State→handler dispatch tables for VR trigger presses, desktop
//  clicks, and alt-fire squeezes.
//
//  Pure-move extraction from main.js. The heavy per-state handlers
//  still live in main.js and are REGISTERED here at init; this module
//  owns only the routing tables (game.state → handler) plus the
//  settings-visible shortcut that TITLE/PAUSED share.
//
//  Deps (initInputRouter, from main.js):
//    isSettingsVisible, trigger: {...}, desktop: {...}, squeeze: {...},
//    triggerRelease
//  Trigger/desktop handler keys: settingsTrigger, titleTrigger,
//  playingTrigger, upgradeTrigger, gameOverTrigger, nameEntryTrigger,
//  scoreboardTrigger, countrySelectTrigger, readyTrigger, pauseTrigger.
//  Squeeze keys: playingSqueezePress, playingSqueezeRelease.
//
//  game.state/State come from game.js (the bottom of the dep graph —
//  no cycle: game.js never imports main.js).
// ============================================================

import { State, game } from './game.js';

let _deps = {
  isSettingsVisible: () => false,
  trigger: {},
  desktop: {},
  squeeze: {},
  triggerRelease: null,
};

const _triggerRoutes = {
  [State.TITLE]: { settings: 'settingsTrigger', fallback: 'titleTrigger' },
  [State.PLAYING]: { fallback: 'playingTrigger' },
  [State.UPGRADE_SELECT]: { fallback: 'upgradeTrigger' },
  [State.GAME_OVER]: { fallback: 'gameOverTrigger' },
  [State.VICTORY]: { fallback: 'gameOverTrigger' },
  [State.NAME_ENTRY]: { fallback: 'nameEntryTrigger' },
  [State.SCOREBOARD]: { fallback: 'scoreboardTrigger' },
  [State.REGIONAL_SCORES]: { fallback: 'scoreboardTrigger' },
  [State.COUNTRY_SELECT]: { fallback: 'countrySelectTrigger' },
  [State.READY_SCREEN]: { fallback: 'readyTrigger' },
  [State.PAUSED]: { settings: 'settingsTrigger', fallback: 'pauseTrigger' },
};

// Desktop has no PLAYING branch (firing is handled by desktop-controls.js)
const _desktopRoutes = {
  [State.TITLE]: { settings: 'settingsTrigger', fallback: 'titleTrigger' },
  [State.UPGRADE_SELECT]: { fallback: 'upgradeTrigger' },
  [State.GAME_OVER]: { fallback: 'gameOverTrigger' },
  [State.VICTORY]: { fallback: 'gameOverTrigger' },
  [State.NAME_ENTRY]: { fallback: 'nameEntryTrigger' },
  [State.SCOREBOARD]: { fallback: 'scoreboardTrigger' },
  [State.REGIONAL_SCORES]: { fallback: 'scoreboardTrigger' },
  [State.COUNTRY_SELECT]: { fallback: 'countrySelectTrigger' },
  [State.READY_SCREEN]: { fallback: 'readyTrigger' },
  [State.PAUSED]: { settings: 'settingsTrigger', fallback: 'pauseTrigger' },
};

const _squeezeRoutes = {
  [State.PLAYING]: { fallback: 'playingSqueezePress' },
};

/**
 * Wire the handler registry. Called once from main.js init AFTER all
 * handlers are defined (function declarations are hoisted, so ordering
 * is flexible).
 */
export function initInputRouter(deps) {
  _deps = {
    isSettingsVisible: deps?.isSettingsVisible || (() => false),
    trigger: deps?.trigger || {},
    desktop: deps?.desktop || {},
    squeeze: deps?.squeeze || {},
    triggerRelease: deps?.triggerRelease || null,
  };
}

function _route(table, args, handlers) {
  const st = game.state;
  const entry = table[st];
  if (!entry) return;
  const settingsOpen = _deps.isSettingsVisible();
  const key = entry.settings && settingsOpen ? entry.settings : entry.fallback;
  const fn = handlers[key];
  if (fn) fn(...args);
}

/** VR/controller trigger press — routes by state. */
export function handleTriggerPress(controller, index) {
  _route(_triggerRoutes, [controller, index], _deps.trigger);
}

/** VR/controller trigger release — delegates (charge/lightning cleanup). */
export function handleTriggerRelease(index) {
  if (_deps.triggerRelease) _deps.triggerRelease(index);
}

/** VR/controller alt-fire squeeze press — routes by state. */
export function handleSqueezePress(controller, index) {
  _route(_squeezeRoutes, [controller, index], _deps.squeeze);
}

/** VR/controller alt-fire squeeze release — delegates. */
export function handleSqueezeRelease(index) {
  if (_deps.squeeze.playingSqueezeRelease) _deps.squeeze.playingSqueezeRelease(index);
}

/** Desktop mouse click — routes by state. */
export function handleDesktopClick() {
  _route(_desktopRoutes, [], _deps.desktop);
}
