// ============================================================
//  VOID MARKS (Issue #139)
//  Deaths leave scars: a mark spawns in FUTURE runs at the same
//  level/biome where you died. Approaching it offers a choice:
//  INHERIT one upgrade from the ghost run (trigger) or PURGE it
//  for bonus score (nuke). Consumed either way.
//
//  Persistence: localStorage 'void_marks' (max 20, FIFO).
//  DI pattern (AGENTS.md §17): initVoidMarks(deps) from main.js.
// ============================================================

import * as THREE from 'three';

const DEBUG = false;
const _log = DEBUG ? console.log.bind(console) : () => {};

const STORAGE_KEY = 'void_marks';
const MAX_MARKS = 20;
const INTERACT_RANGE = 2.2;
const PROMPT_RANGE = 3.0;

let _deps = null;
let _marks = [];          // persisted marks (all levels)
let _activeMarks = [];    // spawned in the current level
let _promptShown = false;

function _hasDep(name) {
  return !!(_deps && typeof _deps[name] === 'function');
}

function _loadStored() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch (e) {
    return [];
  }
}

function _saveStored() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(_marks.slice(-MAX_MARKS)));
  } catch (e) {
    // storage unavailable — in-memory only (never throw)
  }
}

/**
 * Wire deps. Called once from main.js init.
 * deps: { scene, getPlayerPos, getBiomeForLevel, getUpgradeDef, addUpgrade,
 *         getRandomSpecialUpgrades, addScore, showFloatingMessage,
 *         hideFloatingMessage, playInheritSound, playPurgeSound }
 */
export function initVoidMarks(deps) {
  _deps = deps || null;
  _marks = _loadStored();
  _activeMarks = [];
  _promptShown = false;
  _log(`[void-marks] loaded ${_marks.length} stored marks`);
}

/** Record a death for future runs (called from endGame). */
export function recordVoidMark(position, level, upgrades, killedBy) {
  const biome = _hasDep('getBiomeForLevel') ? _deps.getBiomeForLevel(level) : 'synthwave_valley';
  // upgrades is game.upgrades: { left: {...}, right: {...} } — merge both hands
  const ids = [];
  for (const hand of ['left', 'right']) {
    const map = upgrades?.[hand] || {};
    for (const id of Object.keys(map)) {
      if ((map[id] || 0) > 0) ids.push(id);
    }
  }
  _marks.push({
    level,
    biome,
    position: { x: position.x, y: position.y, z: position.z },
    upgrades: ids,
    killedBy: killedBy || 'unknown',
    timestamp: Date.now(),
    isBossMark: false,
  });
  if (_marks.length > MAX_MARKS) _marks = _marks.slice(-MAX_MARKS);
  _saveStored();
  _log(`[void-marks] recorded death at level ${level}`);
}

/**
 * Spawn marks for the current level (matching level + biome).
 * Called at level start.
 */
export function spawnLevelVoidMarks(level, playerPos) {
  _activeMarks = [];
  _promptShown = false;
  const biome = _hasDep('getBiomeForLevel') ? _deps.getBiomeForLevel(level) : 'synthwave_valley';
  const matches = _marks.filter(m => m.level === level && m.biome === biome);
  if (matches.length === 0) return 0;

  for (const mark of matches) {
    const group = new THREE.Group();
    const geo = getMarkGeo();
    const mat = new THREE.MeshBasicMaterial({
      color: 0x4400aa, transparent: true, opacity: 0.65,
      depthWrite: false, blending: THREE.AdditiveBlending, fog: false,
    });
    // Spectral figure: a small 2x3 column
    for (let y = 0; y < 3; y++) {
      for (let x = -1; x <= 0; x++) {
        const vox = new THREE.Mesh(geo, mat);
        vox.position.set(x * 0.22, y * 0.24 + 0.3, 0);
        group.add(vox);
      }
    }
    const glowGeo = new THREE.SphereGeometry(0.5, 10, 8);
    const glowMat = new THREE.MeshBasicMaterial({
      color: 0x4400aa, transparent: true, opacity: 0.25,
      depthWrite: false, blending: THREE.AdditiveBlending, fog: false,
    });
    const glow = new THREE.Mesh(glowGeo, glowMat);
    glow.position.y = 0.7;
    group.add(glow);

    const pos = new THREE.Vector3(mark.position.x, 0.3, mark.position.z);
    // Clamp into the arena so marks never spawn off-world
    pos.x = Math.max(-16, Math.min(16, pos.x));
    pos.z = Math.max(-16, Math.min(16, pos.z));
    group.position.copy(pos);
    group.userData.voidMark = { mark, born: performance.now(), phase: Math.random() * Math.PI * 2 };
    _deps.scene.add(group);
    _activeMarks.push(group);
  }
  _log(`[void-marks] spawned ${_activeMarks.length} marks for level ${level}`);
  return _activeMarks.length;
}

let _markGeo = null;
function getMarkGeo() {
  if (!_markGeo) _markGeo = new THREE.BoxGeometry(0.22, 0.24, 0.22);
  return _markGeo;
}

// Animate marks: pulse + face the player when close. Returns the mark in
// interaction range (or null).
function _updateMarks(dt, now) {
  let interactable = null;
  const playerPos = _hasDep('getPlayerPos') ? _deps.getPlayerPos() : new THREE.Vector3();
  for (const group of _activeMarks) {
    if (!group.parent) continue;
    const ud = group.userData.voidMark;
    // Breathing pulse
    const t = (now - ud.born) / 1000;
    group.scale.setScalar(1 + Math.sin(t * 2 + ud.phase) * 0.06);
    const dist = group.position.distanceTo(playerPos);
    if (dist < PROMPT_RANGE && _hasDep('showFloatingMessage')) {
      // Face the player (head turns)
      group.rotation.y = Math.atan2(playerPos.x - group.position.x, playerPos.z - group.position.z);
    }
    if (dist < INTERACT_RANGE && !interactable) {
      interactable = group;
    }
  }
  return interactable;
}

/** True while a void mark is in interaction range (main.js fire gate). */
export function isVoidMarkInRange() {
  if (!_hasDep('getPlayerPos')) return false;
  const playerPos = _deps.getPlayerPos();
  for (const group of _activeMarks) {
    if (!group.parent) continue;
    if (group.position.distanceTo(playerPos) < INTERACT_RANGE) return true;
  }
  return false;
}

/** Per-frame update (main.js PLAYING branch): pulse + prompt. */
export function updateVoidMarks(dt, now) {
  if (_activeMarks.length === 0) return;
  const interactable = _updateMarks(dt, now);
  if (interactable && !_promptShown && _hasDep('showFloatingMessage')) {
    _promptShown = true;
    const mark = interactable.userData.voidMark.mark;
    const offer = _getOfferLabel(mark);
    // Small unobtrusive hint (player feedback: the old prompt was a huge
    // in-your-face banner that overflowed the view). Sized like the eclipse
    // warning banner but placed higher/further so it never blocks targets.
    // maxWidth word-wraps it into two compact lines.
    _deps.showFloatingMessage(`VOID MARK — ${offer} · TRIGGER: INHERIT · NUKE: PURGE`, {
      sticky: true, color: '#aa66ff', glowColor: '#4400aa',
      fontSize: 26, scale: 0.2, offsetY: 0.62, offsetZ: -1.3, maxWidth: 300,
    });
  } else if (!interactable && _promptShown) {
    _promptShown = false;
    if (_hasDep('hideFloatingMessage')) _deps.hideFloatingMessage();
  }
}

function _getOfferLabel(mark) {
  if (mark.isBossMark) return 'SPECIAL UPGRADE';
  if (mark.upgrades.length === 0) return 'NOTHING';
  const def = _hasDep('getUpgradeDef') ? _deps.getUpgradeDef(mark.upgrades[0]) : null;
  return def ? def.name.toUpperCase() : 'UPGRADE';
}

// Pick the upgrade to inherit: boss marks → special pool; otherwise a random
// universal upgrade from the ghost run
function _pickInheritUpgrade(mark) {
  if (mark.isBossMark && _hasDep('getRandomSpecialUpgrades')) {
    const specials = _deps.getRandomSpecialUpgrades(1);
    return specials && specials[0] ? specials[0].id : null;
  }
  if (!mark.upgrades || mark.upgrades.length === 0) return null;
  const universal = mark.upgrades.filter(id => {
    const def = _hasDep('getUpgradeDef') ? _deps.getUpgradeDef(id) : null;
    return def && def.type === 'universal';
  });
  const pool = universal.length > 0 ? universal : mark.upgrades;
  return pool[Math.floor(Math.random() * pool.length)];
}

function _consumeMark(group) {
  if (group.parent) group.parent.remove(group);
  group.traverse((child) => {
    if (child.geometry) child.geometry.dispose();
    if (child.material) child.material.dispose();
  });
  const idx = _activeMarks.indexOf(group);
  if (idx >= 0) _activeMarks.splice(idx, 1);
  _marks = _marks.filter(m => m !== group.userData.voidMark.mark);
  _saveStored();
  if (_hasDep('hideFloatingMessage')) _deps.hideFloatingMessage();
  _promptShown = false;
}

/**
 * INHERIT: called from the trigger path (returns true when a mark was
 * consumed — the shot is suppressed that frame).
 */
export function tryVoidMarkInherit() {
  const playerPos = _hasDep('getPlayerPos') ? _deps.getPlayerPos() : new THREE.Vector3();
  for (const group of _activeMarks) {
    if (!group.parent) continue;
    if (group.position.distanceTo(playerPos) < INTERACT_RANGE) {
      const mark = group.userData.voidMark.mark;
      const upgradeId = _pickInheritUpgrade(mark);
      if (upgradeId && _hasDep('addUpgrade')) {
        _deps.addUpgrade(upgradeId, 'left');
      }
      if (_hasDep('playInheritSound')) _deps.playInheritSound();
      _consumeMark(group);
      return true;
    }
  }
  return false;
}

/**
 * PURGE: called from the nuke path (returns true when a mark was consumed —
 * the nuke is NOT spent for the purge).
 */
export function tryVoidMarkPurge() {
  const playerPos = _hasDep('getPlayerPos') ? _deps.getPlayerPos() : new THREE.Vector3();
  for (const group of _activeMarks) {
    if (!group.parent) continue;
    if (group.position.distanceTo(playerPos) < INTERACT_RANGE) {
      const mark = group.userData.voidMark.mark;
      const bonus = 500 * (mark.level || 1);
      if (_hasDep('addScore')) _deps.addScore(bonus);
      if (_hasDep('playPurgeSound')) _deps.playPurgeSound();
      _consumeMark(group);
      return true;
    }
  }
  return false;
}

/** Test seams. */
export function getActiveMarkCount() {
  return _activeMarks.filter(g => g.parent).length;
}
export function clearActiveMarks() {
  for (const group of _activeMarks) {
    if (group.parent) group.parent.remove(group);
  }
  _activeMarks = [];
  _promptShown = false;
}
