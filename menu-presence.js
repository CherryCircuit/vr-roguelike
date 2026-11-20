// ============================================================
//  MENU PRESENCE
//
//  World-space VR menus are anchored where the player was looking when they
//  opened. In a headset the player can freely turn, which can leave a menu
//  completely behind them ("I can't find the menu" / "the buttons don't
//  work" — the raycast is there, the panel is not).
//
//  This module keeps every registered modal menu findable:
//    - if the panel is out of the player's view cone for a short beat, or
//      has drifted far out of arm's/ray range, it glides back in front of
//      the camera at its authored distance
//    - it never moves while the player is looking at it (no fighting the
//      player's aim), and it rate-limits recentres so a spinning head does
//      not make the menu whip around
//
//  Deliberately dependency-free: hud.js / pause-menu.js register groups and
//  main.js ticks it once per frame. No per-frame allocations.
// ============================================================

import * as THREE from 'three';

const _forward = new THREE.Vector3();
const _toMenu = new THREE.Vector3();
const _target = new THREE.Vector3();

const DEFAULT_OPTIONS = {
  // Angular limit (half-angle from gaze) before the menu counts as "lost".
  // 52°: the menu is still half-visible at the edge of most headset FOVs.
  angleLimitDeg: 52,
  minDistance: 1.6,
  maxDistance: 5.2,
  // How long it must stay out of view before it re-anchors (seconds).
  lostGraceSec: 0.35,
  // Minimum gap between two automatic recentres (seconds).
  cooldownSec: 1.4,
  // Recentre animation length (seconds).
  moveDurationSec: 0.32,
};

const entries = new Map();

/**
 * Register a world-space menu group.
 * @param {string} name
 * @param {() => THREE.Object3D | null} getGroup
 * @param {object} [opts]
 * @param {number} [opts.angleLimitDeg]
 * @param {number} [opts.minDistance]
 * @param {number} [opts.maxDistance]
 * @param {boolean} [opts.ownerControlsPosition] group repositions itself every
 *        frame (pause menu) — only call onRecenter for it
 * @param {(pos: THREE.Vector3, yaw: number) => void} [opts.onRecenter]
 * @param {boolean} [opts.recenterYaw]
 */
export function registerMenuPresence(name, getGroup, opts = {}) {
  entries.set(name, {
    name,
    getGroup,
    opts: { ...DEFAULT_OPTIONS, recenterYaw: true, ...opts },
    lostSince: 0,
    lastRecenterAt: -Infinity,
    anim: null,
  });
}

/**
 * Tick every registered menu. Called once per frame from main.js render().
 * @param {THREE.Camera} camera
 * @param {number} now performance.now()
 * @param {number} dt seconds
 */
export function updateMenuPresence(camera, now, dt) {
  if (!camera) return;

  for (const entry of entries.values()) {
    const group = entry.getGroup ? entry.getGroup() : null;
    if (!group || !isEffectivelyVisible(group)) {
      entry.lostSince = 0;
      entry.anim = null;
      continue;
    }

    // ── In-flight recentre animation ────────────────────────────────
    if (entry.anim) {
      const a = entry.anim;
      const t = Math.max(0, Math.min(1, (now - a.start) / a.durationMs));
      const eased = 1 - Math.pow(1 - t, 3); // easeOutCubic
      if (!entry.opts.ownerControlsPosition) {
        group.position.lerpVectors(a.fromPos, a.toPos, eased);
      }
      if (entry.opts.recenterYaw) {
        group.rotation.y = a.fromYaw + shortestAngle(a.fromYaw, a.toYaw) * eased;
      }
      if (t >= 1) {
        if (!entry.opts.ownerControlsPosition) group.position.copy(a.toPos);
        if (entry.opts.recenterYaw) group.rotation.y = a.toYaw;
        entry.anim = null;
      }
      continue;
    }

    // ── Is the panel inside the player's view cone? ─────────────────
    camera.getWorldDirection(_forward);
    _forward.y = 0;
    if (_forward.lengthSq() < 1e-6) _forward.set(0, 0, -1);
    _forward.normalize();

    _toMenu.copy(group.position).sub(camera.position);
    const vertical = _toMenu.y;
    _toMenu.y = 0;
    const distance = _toMenu.length();
    const opts = entry.opts;

    let lost = false;
    if (distance > 0.25) {
      _toMenu.divideScalar(distance);
      const cos = Math.max(-1, Math.min(1, _forward.dot(_toMenu)));
      const angleDeg = Math.acos(cos) * 180 / Math.PI;
      lost = angleDeg > opts.angleLimitDeg
        || distance > opts.maxDistance
        || distance < opts.minDistance * 0.55;
    }

    if (!lost) {
      entry.lostSince = 0;
      continue;
    }

    if (!entry.lostSince) {
      entry.lostSince = now;
      continue;
    }
    if (now - entry.lostSince < opts.lostGraceSec * 1000) continue;
    if (now - entry.lastRecenterAt < opts.cooldownSec * 1000) continue;

    // ── Re-anchor in front of the player ───────────────────────────
    // Preserve the authored viewing distance (clamped so the menu is always
    // readable) and the panel's vertical composition relative to the eye.
    const targetDistance = Math.min(opts.maxDistance, Math.max(opts.minDistance, distance || opts.minDistance));
    _target.copy(camera.position).addScaledVector(_forward, targetDistance);
    _target.y = camera.position.y + Math.max(-0.6, Math.min(1.0, vertical));

    // Yaw so the panel's +Z face turns toward the player.
    const dx = camera.position.x - _target.x;
    const dz = camera.position.z - _target.z;
    const yaw = Math.atan2(dx, dz);

    entry.lastRecenterAt = now;
    entry.lostSince = 0;

    if (opts.onRecenter) {
      opts.onRecenter(_target, yaw);
    }

    if (opts.ownerControlsPosition) {
      // The owner handles position; still apply the yaw immediately so the
      // panel is readable the moment it reappears.
      if (opts.recenterYaw) group.rotation.y = yaw;
      continue;
    }

    entry.anim = {
      start: now,
      durationMs: Math.max(60, opts.moveDurationSec * 1000),
      fromPos: group.position.clone(),
      toPos: _target.clone(),
      fromYaw: group.rotation.y,
      toYaw: yaw,
    };
  }
}

/** True when the object and all ancestors are visible. */
function isEffectivelyVisible(obj) {
  let node = obj;
  while (node) {
    if (node.visible === false) return false;
    node = node.parent;
  }
  return true;
}

/** Unwrap the shortest signed angle from `from` to `to` (radians). */
function shortestAngle(from, to) {
  let d = (to - from) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d < -Math.PI) d += Math.PI * 2;
  return d;
}

/** Force a menu back into view immediately (tests/debug). */
export function forceMenuRecenter(name, camera) {
  const entry = entries.get(name);
  if (!entry || !camera) return false;
  const group = entry.getGroup ? entry.getGroup() : null;
  if (!group) return false;

  camera.getWorldDirection(_forward);
  _forward.y = 0;
  if (_forward.lengthSq() < 1e-6) _forward.set(0, 0, -1);
  _forward.normalize();

  _toMenu.copy(group.position).sub(camera.position);
  const vertical = _toMenu.y;
  _toMenu.y = 0;
  const distance = _toMenu.length();
  const opts = entry.opts;
  const targetDistance = Math.min(opts.maxDistance, Math.max(opts.minDistance, distance || opts.minDistance));
  _target.copy(camera.position).addScaledVector(_forward, targetDistance);
  _target.y = camera.position.y + Math.max(-0.6, Math.min(1.0, vertical));
  const dx = camera.position.x - _target.x;
  const dz = camera.position.z - _target.z;
  const yaw = Math.atan2(dx, dz);

  if (opts.onRecenter) opts.onRecenter(_target, yaw);
  if (!opts.ownerControlsPosition) {
    group.position.copy(_target);
    if (opts.recenterYaw) group.rotation.y = yaw;
  }
  entry.lostSince = 0;
  entry.anim = null;
  return true;
}

/** Debug/test view of every registered menu. */
export function getMenuPresenceState(camera) {
  const out = [];
  for (const entry of entries.values()) {
    const group = entry.getGroup ? entry.getGroup() : null;
    if (!group) continue;
    let angleDeg = null;
    if (camera) {
      camera.getWorldDirection(_forward);
      _forward.y = 0;
      _forward.normalize();
      _toMenu.copy(group.position).sub(camera.position);
      _toMenu.y = 0;
      const d = _toMenu.length();
      if (d > 0.001) {
        _toMenu.divideScalar(d);
        angleDeg = Math.acos(Math.max(-1, Math.min(1, _forward.dot(_toMenu)))) * 180 / Math.PI;
      }
    }
    out.push({
      name: entry.name,
      visible: isEffectivelyVisible(group),
      angleDeg: angleDeg == null ? null : +angleDeg.toFixed(2),
      distance: +group.position.distanceTo(camera ? camera.position : group.position).toFixed(2),
      animating: !!entry.anim,
    });
  }
  return out;
}

/** Clear all registrations (tests/re-init only). */
export function resetMenuPresence() {
  entries.clear();
}
