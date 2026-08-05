// ============================================================
//  THREAT COMPASS (Issue #206)
//  A ground glow beneath the player that shifts and pulses toward
//  the nearest dangers. No UI overlays — the arena floor itself
//  warns you where to look (critical in VR where you can't see
//  behind you).
//
//  Design (per issue):
//  - One circle mesh on the floor, custom ShaderMaterial.
//  - Up to 8 threat "lobes" (angle + intensity pairs) computed from
//    the live enemy list each frame.
//  - Gaussian lobes sum in the fragment shader; color ramps
//    amber (far) → orange (mid) → red (close); pulse speed scales
//    with the closest threat.
//  - Biome tint multiplies the base color (one uniform per biome).
//
//  DI pattern (AGENTS.md §17): initThreatCompass(deps) from main.js.
//  No imports of game state — getEnemies/getCamera/getFloorY are
//  injected callbacks. All buffers are pre-allocated: zero per-frame
//  allocations (VR-CRITICAL: this runs every frame at 72fps).
// ============================================================

import * as THREE from 'three';

const DEBUG = false;
const _log = DEBUG ? console.log.bind(console) : () => {};

const MAX_LOBES = 8;
const COMPASS_RADIUS = 8; // matches the issue: ~arena midfield
const COMPASS_SEGMENTS = 64;
const THREAT_RANGE = 40; // beyond this distance an enemy contributes nothing
const MIN_INTENSITY = 0.05; // below this an enemy is ignored entirely
const FLOOR_OFFSET = 0.03; // hover just above the floor to avoid z-fighting

// Scratch buffers — reused every frame, never reallocated (VR perf).
// _topLobes is a flat [angle, intensity] array, insertion-sorted by
// intensity (O(enemies × MAX_LOBES) selection, capped at 8).
const _topLobes = new Float32Array(MAX_LOBES * 2);

let _deps = null;
let _mesh = null;
let _material = null;
let _visible = false;

// Biome tint: multiplies the amber→red base ramp so each biome keeps its
// color language (issue's "optional enhancement" — one uniform per biome).
const _biomeTints = {
  synthwave_valley: new THREE.Color(1.0, 0.6, 1.15), // pinker synthwave
  desert_night: new THREE.Color(0.75, 0.85, 1.25),   // moonlit blue-white
  alien_planet: new THREE.Color(0.6, 1.15, 0.7),     // toxic green
  hellscape_lava: new THREE.Color(1.25, 0.85, 0.5),  // volcanic orange
};

function _hasDep(name) {
  return !!(_deps && typeof _deps[name] === 'function');
}

// ── Shaders ────────────────────────────────────────────────
// Vertex: pass local ground-plane coords (x, z) to the fragment shader.
const _vertexShader = `
  varying vec2 vLocalPos;
  void main() {
    vLocalPos = position.xz;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const _fragmentShader = `
  uniform float uLobes[${MAX_LOBES * 2}];
  uniform float uLobeCount;
  uniform float uTime;
  uniform float uFadeEdge;
  uniform vec3 uTint;
  varying vec2 vLocalPos;

  void main() {
    float dist = length(vLocalPos);
    if (dist > 1.0) discard;

    float pixelAngle = atan(vLocalPos.y, vLocalPos.x);
    float totalGlow = 0.0;

    // Fixed-size loop (no break — WebGL1/2-safe on Quest): inactive lobes
    // contribute zero via the count gate.
    for (int i = 0; i < ${MAX_LOBES}; i++) {
      float lobeGate = float(i) < uLobeCount ? 1.0 : 0.0;
      float lobeAngle = uLobes[i * 2];
      float lobeIntensity = uLobes[i * 2 + 1];

      // Angular distance (wrap-around)
      float angleDiff = abs(pixelAngle - lobeAngle);
      angleDiff = min(angleDiff, 6.28318 - angleDiff);

      // Gaussian lobe: width scales with intensity so close threats cast
      // a wider wash than distant shimmers
      float lobeWidth = 0.4 + lobeIntensity * 0.3;
      float contribution = exp(-angleDiff * angleDiff / (2.0 * lobeWidth * lobeWidth));
      contribution *= lobeIntensity;
      totalGlow += contribution * lobeGate;
    }

    totalGlow = clamp(totalGlow, 0.0, 1.0);

    // Pulse: faster when the closest threat is nearer (uLobes[1] holds the
    // highest-intensity lobe's intensity because lobes are sorted)
    float closestIntensity = uLobeCount > 0.0 ? uLobes[1] : 0.0;
    float pulseSpeed = 2.0 + closestIntensity * 6.0;
    totalGlow *= 0.7 + 0.3 * sin(uTime * pulseSpeed);

    // Radial fade: strongest toward the center
    totalGlow *= smoothstep(1.0, 0.0, dist);
    // Soft edge fade (no hard rim)
    totalGlow *= smoothstep(1.0, 1.0 - uFadeEdge, dist);

    // Color: amber (far) → red (close), multiplied by the biome tint
    vec3 amber = vec3(0.8, 0.5, 0.1);
    vec3 red = vec3(1.0, 0.15, 0.05);
    vec3 col = mix(amber, red, closestIntensity) * uTint;

    // Cap alpha at 0.35 — never opaque enough to hide floor details
    gl_FragColor = vec4(col, totalGlow * 0.35);
  }
`;

/**
 * Create the compass mesh and wire dependencies. Call once from main.js init.
 * deps: { scene, getEnemies, getCamera, getFloorY }
 *   - getEnemies: () => live enemy array (enemies.js)
 *   - getCamera:  () => the THREE camera (player position = camera XZ)
 *   - getFloorY:  () => current biome floor Y (main.js getBiomeFloorY)
 */
export function initThreatCompass(deps) {
  _deps = deps || null;
  if (!_deps || !_deps.scene) {
    _log('[threat-compass] missing deps — compass disabled');
    return;
  }

  const geo = new THREE.CircleGeometry(COMPASS_RADIUS, COMPASS_SEGMENTS);
  geo.rotateX(-Math.PI / 2);

  _material = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    // depthTest: false — this is an information layer like the HUD sprites;
    // biome floor meshes sit at varying heights and the 8m disc never
    // overlaps arena walls (player is at center, walls ~20m+ out)
    depthTest: false,
    uniforms: {
      uLobes: { value: new Float32Array(MAX_LOBES * 2) },
      uLobeCount: { value: 0 },
      uTime: { value: 0 },
      uFadeEdge: { value: 0.6 },
      uTint: { value: _biomeTints.synthwave_valley.clone() },
    },
    vertexShader: _vertexShader,
    fragmentShader: _fragmentShader,
  });

  _mesh = new THREE.Mesh(geo, _material);
  _mesh.name = 'threat-compass';
  _mesh.renderOrder = 10;
  _mesh.frustumCulled = false; // sits around the player; never cull it
  _mesh.visible = false;
  _deps.scene.add(_mesh);
  _visible = false;

  _log('[threat-compass] initialized');
}

/** Show/hide the compass (main.js state machine: visible only in PLAYING). */
export function setThreatCompassVisible(visible) {
  if (!_mesh || _visible === visible) return; // no-op when unchanged
  _visible = visible;
  _mesh.visible = visible;
}

/** One-time biome tint (main.js applyThemeForLevel). */
export function setThreatCompassTheme(biomeId) {
  if (!_material) return;
  const tint = _biomeTints[biomeId] || _biomeTints.synthwave_valley;
  _material.uniforms.uTint.value.copy(tint);
}

// [CORE] Per-frame update — called from the PLAYING branch of main.js.
// Cheap: one enemy pass + 8-slot insertion sort into scratch buffers.
export function updateThreatCompass(dt, now) {
  if (!_mesh || !_visible) return;

  // Track the camera XZ (stationary player, but handles VR recentering)
  // and the current biome floor height.
  if (_hasDep('getCamera')) {
    const cam = _deps.getCamera();
    if (cam) {
      _mesh.position.x = cam.position.x;
      _mesh.position.z = cam.position.z;
    }
  }
  if (_hasDep('getFloorY')) {
    _mesh.position.y = _deps.getFloorY() + FLOOR_OFFSET;
  }

  // ── Compute threat lobes from the live enemy list ──
  const enemies = _hasDep('getEnemies') ? _deps.getEnemies() : [];
  let lobeCount = 0;

  for (let i = 0; i < enemies.length; i++) {
    const e = enemies[i];
    // Skip dead/detached enemies (the array can hold recently-spliced
    // entries during updateEnemies sweeps)
    if (!e || !e.mesh || e.hp <= 0) continue;

    const ex = e.mesh.position.x - _mesh.position.x;
    const ez = e.mesh.position.z - _mesh.position.z;
    const dist = Math.sqrt(ex * ex + ez * ez);
    if (dist >= THREAT_RANGE) continue;

    const intensity = 1 - dist / THREAT_RANGE;
    if (intensity < MIN_INTENSITY) continue;

    const angle = Math.atan2(ez, ex);

    // Insertion-sort into the top-8 scratch buffer (keeps the strongest
    // threats). When the buffer is full, weaker candidates are skipped so
    // they can't overwrite the current weakest lobe.
    if (lobeCount >= MAX_LOBES && intensity <= _topLobes[(MAX_LOBES - 1) * 2 + 1]) {
      continue;
    }
    let slot = Math.min(lobeCount, MAX_LOBES - 1);
    while (slot > 0 && intensity > _topLobes[(slot - 1) * 2 + 1]) {
      _topLobes[slot * 2] = _topLobes[(slot - 1) * 2];
      _topLobes[slot * 2 + 1] = _topLobes[(slot - 1) * 2 + 1];
      slot--;
    }
    _topLobes[slot * 2] = angle;
    _topLobes[slot * 2 + 1] = intensity;
    if (lobeCount < MAX_LOBES) lobeCount++;
  }

  // ── Push to GPU uniforms (zero allocations) ──
  const lobeData = _material.uniforms.uLobes.value;
  for (let i = 0; i < MAX_LOBES; i++) {
    if (i < lobeCount) {
      lobeData[i * 2] = _topLobes[i * 2];
      lobeData[i * 2 + 1] = _topLobes[i * 2 + 1];
    } else {
      lobeData[i * 2] = 0;
      lobeData[i * 2 + 1] = 0;
    }
  }
  _material.uniforms.uLobeCount.value = lobeCount;
  _material.uniforms.uTime.value = now / 1000;
}
