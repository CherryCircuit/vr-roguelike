// ============================================================
//  CINEMATIC LEVEL TRANSITIONS
//
//  A camera-attached, shader-driven transition overlay used between levels
//  (and at run start). It is deliberately NOT a post-processing pass:
//  three.js EffectComposer post-processing is expensive in WebXR and can
//  break the XR render path. A camera-child quad costs one draw call and
//  works identically on Quest and desktop.
//
//  Visual grammar (AAA-style "wipe + title card"):
//    1. iris closes from the screen edges with an accent-coloured energy band
//    2. the screen is solid black for a beat while the level card animates in
//    3. iris opens, the card scales/fades out, gameplay resumes underneath
//
//  The overlay never blocks input or gameplay logic — main.js keeps running
//  its state machine behind it. `isTransitionActive()` is exposed for tests.
// ============================================================

import * as THREE from 'three';

// Camera attached → always visible no matter where the player looks.
const OVERLAY_Z = -0.35;          // metres in front of the eye (inside near plane 0.1)
const OVERLAY_SIZE = 2.6;         // covers the widest headset FOV at 0.35m
const CARD_Z = -1.05;             // title card distance
const DEFAULT_DURATION = 2.15;    // seconds; long enough to read the level name

export const TRANSITION_GROUP_NAME = 'level-transition-overlay';
export const TRANSITION_OVERLAY_NAME = 'level-transition-quad';

// Biome accent colours keep the transition in the same palette as the level
// being entered (the material is tinted per-transition via a uniform).
export const BIOME_TRANSITION_ACCENTS = {
  synthwave_valley: 0xff2fd0,
  desert_night: 0xffb347,
  alien_planet: 0x44ffa8,
  hellscape_lava: 0xff4a1c,
};

export const BIOME_TRANSITION_LABELS = {
  synthwave_valley: 'SYNTHWAVE VALLEY',
  desert_night: 'DESERT NIGHT',
  alien_planet: 'ALIEN PLANET',
  hellscape_lava: 'HELLSCAPE',
};

let _initialized = false;
let _group = null;
let _quad = null;
let _material = null;
let _card = null;
let _cardTexture = null;
let _subtitle = null;
let _subtitleTexture = null;

// Active transition state. null when idle (hot path early-returns).
let _transition = null;

// Scratch (no per-frame allocations)
const _startPos = new THREE.Vector3();
const _startQuat = new THREE.Quaternion();
const _targetQuat = new THREE.Quaternion();
const _lookMatrix = new THREE.Matrix4();
const _camDir = new THREE.Vector3();

// ------------------------------------------------------------
//  Shader
// ------------------------------------------------------------
const VERTEX_SHADER = /* glsl */`
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const FRAGMENT_SHADER = /* glsl */`
  precision highp float;

  uniform float uCover;    // 0 = clear, 1 = fully black
  uniform float uTime;     // seconds (drives the energy band)
  uniform float uAspect;   // viewport aspect (keeps the iris circular)
  uniform vec3  uAccent;   // biome accent colour
  varying vec2 vUv;

  float hash(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
  }

  void main() {
    // Aspect-corrected coordinates centered on screen.
    vec2 p = (vUv - 0.5) * vec2(uAspect, 1.0);
    float d = length(p);
    float a = atan(p.y, p.x);

    // Iris radius shrinks from just outside the screen to zero.
    float r = mix(1.45, 0.0, uCover);

    // Solid coverage outside the iris, with a 1-2px soft edge.
    float mask = smoothstep(r - 0.012, r + 0.012, d);

    // Energy band riding the iris edge: bright at the moving edge, gone when
    // the screen is fully covered (it would otherwise glow through black).
    float bandDist = abs(d - r);
    float band = exp(-pow(bandDist / 0.045, 2.0));
    float spokes = 0.55 + 0.45 * sin(a * 42.0 + uTime * 9.0);
    float pulses = 0.65 + 0.35 * sin(d * 90.0 - uTime * 14.0);

    // Fine scanlines + noise keep the black surface from looking flat.
    float scan = 0.94 + 0.06 * sin(vUv.y * 1400.0);
    float grain = (hash(vUv * 1024.0 + uTime) - 0.5) * 0.03;

    vec3 black = vec3(0.006, 0.008, 0.020);
    vec3 col = black * scan + grain;
    col += uAccent * band * spokes * pulses * (1.0 - uCover * 0.75);

    // The covered area is near-black but keeps a whisper of the accent so the
    // black beat reads as a designed card, not a dropped frame.
    col += uAccent * 0.015 * mask;

    gl_FragColor = vec4(col, clamp(mask + band * 0.35, 0.0, 1.0));
  }
`;

// ------------------------------------------------------------
//  Text card (one canvas, cached only for the active transition)
// ------------------------------------------------------------
function makeCardTexture(title, subtitle, accentHex, eyebrow = 'SECTOR CLEARED') {
  const W = 1024;
  const H = 512;
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  const accent = '#' + accentHex.toString(16).padStart(6, '0');

  // Thin rules + small caps eyebrow: the "modern AAA level card" look.
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  ctx.font = 'bold 34px "November", "Courier New", monospace';
  ctx.fillStyle = 'rgba(255,255,255,0.62)';
  // Letter-spaced eyebrow, matching the logo's UI language.
  ctx.fillText(String(eyebrow).split('').join(' '), W / 2, 108);

  ctx.font = 'bold 132px "November", "Courier New", monospace';
  ctx.shadowColor = accent;
  ctx.shadowBlur = 34;
  ctx.fillStyle = '#ffffff';
  ctx.fillText(title, W / 2, 232);

  ctx.shadowBlur = 0;
  ctx.font = 'bold 44px "November", "Courier New", monospace';
  ctx.fillStyle = accent;
  ctx.fillText(subtitle, W / 2, 330);

  // Accent rules under the text.
  ctx.strokeStyle = accent;
  ctx.globalAlpha = 0.85;
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(W / 2 - 260, 380);
  ctx.lineTo(W / 2 + 260, 380);
  ctx.stroke();
  ctx.globalAlpha = 0.35;
  ctx.beginPath();
  ctx.moveTo(W / 2 - 140, 398);
  ctx.lineTo(W / 2 + 140, 398);
  ctx.stroke();
  ctx.globalAlpha = 1;

  const tex = new THREE.CanvasTexture(canvas);
  tex.minFilter = THREE.LinearFilter;
  tex.magFilter = THREE.LinearFilter;
  tex.generateMipmaps = false;
  return tex;
}

function disposeCard() {
  if (_card) {
    if (_card.parent) _card.parent.remove(_card);
    if (_card.geometry) _card.geometry.dispose();
    if (_card.material) _card.material.dispose();
    _card = null;
  }
  if (_cardTexture) {
    _cardTexture.dispose();
    _cardTexture = null;
  }
  if (_subtitle) {
    if (_subtitle.parent) _subtitle.parent.remove(_subtitle);
    if (_subtitle.geometry) _subtitle.geometry.dispose();
    if (_subtitle.material) _subtitle.material.dispose();
    _subtitle = null;
  }
  if (_subtitleTexture) {
    _subtitleTexture.dispose();
    _subtitleTexture = null;
  }
}

// ------------------------------------------------------------
//  Init / lifecycle
// ------------------------------------------------------------
export function initTransitions({ camera }) {
  if (_initialized) return;
  if (!camera) return;

  _group = new THREE.Group();
  _group.name = TRANSITION_GROUP_NAME;
  _group.frustumCulled = false;
  _group.visible = false;
  _group.renderOrder = 9000;

  _material = new THREE.ShaderMaterial({
    uniforms: {
      uCover: { value: 0 },
      uTime: { value: 0 },
      uAspect: { value: 1.6 },
      uAccent: { value: new THREE.Color(0x00ffff) },
    },
    vertexShader: VERTEX_SHADER,
    fragmentShader: FRAGMENT_SHADER,
    transparent: true,
    depthTest: false,
    depthWrite: false,
    side: THREE.DoubleSide,
    fog: false,
  });

  _quad = new THREE.Mesh(new THREE.PlaneGeometry(OVERLAY_SIZE, OVERLAY_SIZE), _material);
  _quad.name = TRANSITION_OVERLAY_NAME;
  _quad.position.set(0, 0, OVERLAY_Z);
  _quad.frustumCulled = false;
  _quad.renderOrder = 9000;
  _group.add(_quad);

  camera.add(_group);
  _initialized = true;
}

/**
 * Start a level transition.
 * @param {object} opts
 * @param {number} opts.level            level number to show
 * @param {string} [opts.biomeId]        biome id for accent + label
 * @param {number} [opts.duration]       seconds (default 2.15)
 * @param {string} [opts.eyebrow]        small line above the level number
 * @param {string} [opts.title]          override title text
 * @param {string} [opts.subtitle]       override subtitle text
 * @returns {boolean} true when a transition started
 */
export function playLevelTransition(opts = {}) {
  if (!_initialized) return false;

  const level = Number.isFinite(opts.level) ? Math.max(1, Math.round(opts.level)) : 1;
  const biomeId = opts.biomeId || 'synthwave_valley';
  const accent = BIOME_TRANSITION_ACCENTS[biomeId] || 0x00ffff;
  const title = opts.title || `LEVEL ${String(level).padStart(2, '0')}`;
  const subtitle = opts.subtitle || BIOME_TRANSITION_LABELS[biomeId] || 'UNKNOWN SECTOR';
  const eyebrow = opts.eyebrow || 'SECTOR CLEARED';

  // Replace any in-flight transition cleanly.
  disposeCard();

  const now = performance.now();
  _transition = {
    startedAt: now,
    duration: Math.max(0.6, Number(opts.duration) || DEFAULT_DURATION),
    level,
    biomeId,
    title,
    subtitle,
    eyebrow,
    accent,
  };

  // Title card ---------------------------------------------------------
  _cardTexture = makeCardTexture(title, subtitle, accent, eyebrow);
  if (_cardTexture) {
    const cardMat = new THREE.MeshBasicMaterial({
      map: _cardTexture,
      transparent: true,
      opacity: 0,
      depthTest: false,
      depthWrite: false,
      side: THREE.DoubleSide,
      toneMapped: false,
    });
    _card = new THREE.Mesh(new THREE.PlaneGeometry(1.94, 0.97), cardMat);
    _card.name = 'level-transition-card';
    _card.position.set(0, 0.015, CARD_Z);
    _card.frustumCulled = false;
    _card.renderOrder = 9001;
    _group.add(_card);
  }

  // Accent underline that sweeps out with the card.
  if (_card) {
    const lineMat = new THREE.MeshBasicMaterial({
      color: accent,
      transparent: true,
      opacity: 0,
      depthTest: false,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      toneMapped: false,
    });
    _subtitle = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 0.012), lineMat);
    _subtitle.name = 'level-transition-accent-rule';
    _subtitle.position.set(0, -0.40, CARD_Z + 0.001);
    _subtitle.frustumCulled = false;
    _subtitle.renderOrder = 9002;
    _group.add(_subtitle);
  }

  _material.uniforms.uAccent.value.setHex(accent);
  _material.uniforms.uCover.value = 0;
  _material.uniforms.uTime.value = 0;
  _group.visible = true;
  return true;
}

/**
 * Advance the transition. Safe to call every frame; no-ops when idle.
 * @param {number} now  performance.now()
 * @param {number} dt   seconds
 * @param {THREE.Camera} camera  used to keep the card screen-aligned
 */
export function updateTransitions(now, dt, camera) {
  if (!_initialized || !_transition) return;

  const t = Math.max(0, Math.min(1, (now - _transition.startedAt) / (_transition.duration * 1000)));
  _transition.progress = t;

  // Timeline: 0 → 0.30 cover, 0.30 → 0.62 hold, 0.62 → 1.0 reveal.
  const COVER_END = 0.30;
  const HOLD_END = 0.62;
  let cover;
  if (t <= COVER_END) {
    cover = easeInOutCubic(t / COVER_END);
  } else if (t <= HOLD_END) {
    cover = 1;
  } else {
    cover = 1 - easeInOutCubic((t - HOLD_END) / (1 - HOLD_END));
  }

  _material.uniforms.uCover.value = cover;
  _material.uniforms.uTime.value = (now - _transition.startedAt) / 1000;

  // Keep the iris circular on every viewport (and in XR per-eye projection).
  const aspect = (camera && camera.aspect) ? camera.aspect : 1.6;
  _material.uniforms.uAspect.value = Number.isFinite(aspect) && aspect > 0.1 ? aspect : 1.6;

  // Card animation: pop in after the screen is mostly covered, fade before
  // the reveal so it never fights the gameplay scene.
  if (_card) {
    const inT = smoothstep(0.16, 0.40, t);
    const outT = smoothstep(0.55, 0.78, t);
    const opacity = Math.max(0, inT - outT);
    // A small overshoot on entry reads as a cinematic title slam.
    const scale = 0.86 + 0.14 * easeOutBack(Math.min(1, inT)) + outT * 0.10;
    _card.material.opacity = opacity;
    _card.scale.set(scale, scale, 1);
    _card.position.y = 0.015 + (1 - inT) * -0.03 + outT * 0.05;
    _card.visible = opacity > 0.001;
  }
  if (_subtitle) {
    const inT = smoothstep(0.24, 0.46, t);
    const outT = smoothstep(0.55, 0.75, t);
    _subtitle.material.opacity = Math.max(0, inT - outT) * 0.9;
    _subtitle.scale.set(Math.max(0.02, inT), 1, 1);
    _subtitle.visible = _subtitle.material.opacity > 0.001;
  }

  if (t >= 1) {
    endTransition();
  }
}

export function endTransition() {
  if (!_initialized) return;
  if (_material) _material.uniforms.uCover.value = 0;
  if (_group) _group.visible = false;
  disposeCard();
  _transition = null;
}

export function isTransitionActive() {
  return !!_transition;
}

/** Test/debug introspection (never used by gameplay logic). */
export function getTransitionState() {
  if (!_transition) return { active: false, initialized: _initialized };
  return {
    active: true,
    initialized: _initialized,
    progress: _transition.progress || 0,
    level: _transition.level,
    biomeId: _transition.biomeId,
    title: _transition.title,
    subtitle: _transition.subtitle,
    eyebrow: _transition.eyebrow,
    cover: _material ? _material.uniforms.uCover.value : 0,
    groupName: _group ? _group.name : null,
    childOfCamera: !!(_group && _group.parent && _group.parent.isCamera),
  };
}

// ------------------------------------------------------------
//  Easing helpers (local; keep this module dependency-free)
// ------------------------------------------------------------
function easeInOutCubic(x) {
  return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
}
function easeOutBack(x) {
  const c1 = 1.70158;
  const c3 = c1 + 1;
  return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2);
}
function smoothstep(edge0, edge1, x) {
  const t = Math.max(0, Math.min(1, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}
