// ============================================================
//  TRAINING GROUND — main-menu practice arena ("the holodeck")
//  A full practice mode reachable from the title screen:
//   - Spawn a wave of any enemy type (or a chosen count), or any boss
//   - Build ANY loadout: every upgrade + the six evolutions
//   - Invincible: test damage output against the enemies/bosses that
//     give you trouble, without risking a run
//
//  The arena is a grid "holodeck": an endless dark room with a glowing
//  grid floor and walls, replacing the biome while training is active.
//
//  DI pattern (AGENTS.md §17): initTrainingGround(deps) from main.js.
//  Menu buttons ride userData.trainingAction; main.js routes triggers,
//  desktop clicks, and the aim raycast through this module while the
//  menu is open. Input is never captured by this module directly.
// ============================================================

import * as THREE from 'three';
import { game, State, getLevelConfig, setWeaponEvolution, addUpgrade } from './game.js';
import { makeSizedText, showHUD, hudGroup, digitalFontFamily } from './hud.js';
import { WEAPON_EVOLUTIONS, getUpgradeDef, UPGRADE_POOL, SPECIAL_UPGRADE_POOL } from './weapons.js';

const DEBUG = false;
const _log = DEBUG ? console.log.bind(console) : () => {};

// ── Deps ────────────────────────────────────────────────────
let _deps = null;

function _hasDep(name) {
  return !!(_deps && typeof _deps[name] === 'function');
}

// ── Module state ────────────────────────────────────────────
let _active = false;          // training mode active (holodeck + combat loop)
let _menuGroup = null;        // the 3D menu (child of scene)
let _menuOpen = false;
let _loadoutView = false;     // false = COMBAT view, true = LOADOUT view
let _waveSize = 5;
let _enemyScroll = 0;
let _loadoutScroll = 0;
let _holodeckGroup = null;
let _hoveredButton = null;    // hovered button mesh (scale/border highlight)
let _oldLevelConfig = null;
let _trainingConfig = null;

// Wave queue: the player builds a battle in the menu, then presses GO.
// Bosses in the queue spawn immediately at GO; enemies are released in
// staggered batches (like a real level) so the fight develops over time.
let _pendingWave = [];        // [{ kind:'enemy'|'boss', type, count }]
let _activeWave = [];         // remaining enemies to release { type, count }
let _waveReleaseTimer = 0;    // seconds until the next batch
const WAVE_BATCH_SIZE = 3;    // enemies released per batch
const WAVE_BATCH_INTERVAL = 1.2; // seconds between batches

// Menu render orders: MUST sit above the floor HUD (makeSprite default 999).
const MENU_BG_RO = 1000;
const MENU_BTN_RO = 1001;
const MENU_TEXT_RO = 1002;

// ── Public API ──────────────────────────────────────────────

/**
 * Wire deps. Called once from main.js init.
 * deps: { scene, camera, renderer, spawnEnemy, spawnBoss, clearAllEnemies,
 *         showBossHealthBar, playMenuClick, playMenuHoverSound,
 *         clearBiomeScene, applyThemeForLevel, recomputeSynergies }
 */
export function initTrainingGround(deps) {
  _deps = deps || null;
  // Load the digital-clock font for the wave counters (async; counters fall
  // back to monospace until it's ready, then redraw on the next queue click).
  import('./hud.js').then(m => m.loadDigitalFont?.()).catch(() => {});
  _log('[training-ground] initialized');
}

export function isTrainingActive() {
  return _active;
}

export function isTrainingMenuOpen() {
  return _menuOpen;
}

/** Enter the holodeck: swap the biome, arm the training config. */
export function startTraining() {
  if (_active) return;
  _active = true;
  _menuOpen = false;
  _loadoutView = false;
  _waveSize = 5;

  // Build a meaty training config (≈ level 9 hpMultiplier) so enemies and
  // bosses survive long enough to test damage output against.
  _oldLevelConfig = game._levelConfig || null;
  const base = getLevelConfig();
  _trainingConfig = {
    ...base,
    hpMultiplier: 3,
    speedMultiplier: 1.0,
    spawnInterval: 9999,
    killTarget: 9999, // no "kills remaining" alerts in training
    isBoss: false,
  };
  game._levelConfig = _trainingConfig;
  game.trainingMode = true;
  game.kills = 0;
  game.score = 0;
  game.health = game.maxHealth;
  // Random music from ANY level category (player feedback) — playMusic
  // already shuffles the playlist; the settings menu (pause → SETTINGS)
  // lets the player skip tracks / adjust volume.
  if (_hasDep('playMusic')) {
    const cats = ['levels1to5', 'levels6to10', 'levels11to14', 'levels16to19'];
    _deps.playMusic(cats[Math.floor(Math.random() * cats.length)]);
  }
  // The combat loop (enemies, projectiles, bosses) runs in the PLAYING
  // branch — training reuses it wholesale.
  game.state = State.PLAYING;
  showHUD(); // floor HUD (hearts/score) — the title hid it

  // Swap the environment for the holodeck grid room
  if (_hasDep('clearBiomeScene')) _deps.clearBiomeScene();
  buildHolodeck();

  // Keep the player's HUD state clean
  if (_hasDep('playMenuClick')) _deps.playMenuClick();
  _log('[training-ground] entered training');
}

/** Leave the holodeck back to the title screen. */
export function exitTraining() {
  if (!_active) return;
  hideTrainingMenu();
  if (_holodeckGroup) {
    disposeHolodeck();
  }
  game.trainingMode = false;
  if (_oldLevelConfig) game._levelConfig = _oldLevelConfig;
  _oldLevelConfig = null;
  _trainingConfig = null;
  // Clear the field AND the boss health bar (player feedback: it stayed on
  // screen after EXIT until the next run started).
  if (_hasDep('clearAllEnemies')) _deps.clearAllEnemies();
  if (_hasDep('clearBoss')) _deps.clearBoss();
  if (_hasDep('hideBossHealthBar')) _deps.hideBossHealthBar();
  _activeWave = [];
  _pendingWave = [];
  if (_hasDep('applyThemeForLevel')) _deps.applyThemeForLevel(game.level || 1);
  _active = false;
  _log('[training-ground] exited training');
}

// ── Menu open/close ─────────────────────────────────────────

export function toggleTrainingMenu() {
  if (_menuOpen) hideTrainingMenu(); else showTrainingMenu();
}

export function showTrainingMenu(resetView = true) {
  if (!_active || _menuOpen) return;
  _menuOpen = true;
  if (resetView) _loadoutView = false; // fresh open → combat view
  _enemyScroll = 0;
  _loadoutScroll = 0;
  // The menu must draw over the floor HUD: hide the HUD while browsing
  // (some HUD sprites are depthTest:false and would otherwise render on top).
  if (hudGroup) hudGroup.visible = false;
  buildTrainingMenu();
}

export function hideTrainingMenu() {
  _menuOpen = false;
  if (hudGroup) hudGroup.visible = true;
  if (_menuGroup) {
    disposeMenuGroup(_menuGroup);
    if (_menuGroup.parent) _menuGroup.parent.remove(_menuGroup);
    _menuGroup = null;
  }
  _hoveredButton = null;
}

// ── Menu construction ───────────────────────────────────────

// Glyph-sized button label: makeSizedText sizes by GLYPH size (the recurring
// "tiny text" problem came from makeSprite's scale = sprite height). The
// maxWidth is computed from the BUTTON WIDTH so the text box fills the button
// (the old fixed maxWidth made text wrap on a 15×-wider button).
const BTN_GLYPH = 0.055;
const HEADING_GLYPH = 0.065;

function buttonTextMaxWidth(buttonW, fontSize, glyph) {
  // sprite width = canvasWidth × glyph/fontSize → canvasWidth = w × fontSize/glyph
  return Math.floor(buttonW * (fontSize / glyph) * 0.92);
}

function makeButton(parent, label, action, x, y, opts = {}) {
  const w = opts.w || 1.0;
  const h = opts.h || 0.2;
  const color = opts.color ?? 0x00ff88;
  const fontSize = opts.fontSize || 42;
  const glyph = opts.glyphSize || BTN_GLYPH;
  const group = new THREE.Group();
  group.position.set(x, y, 0.02);
  parent.add(group);
  const face = new THREE.Mesh(
    new THREE.PlaneGeometry(w, h),
    new THREE.MeshBasicMaterial({
      color: 0x111133, transparent: true, opacity: 0.92,
      side: THREE.DoubleSide, depthWrite: false, depthTest: true,
    })
  );
  face.renderOrder = MENU_BTN_RO;
  face.userData.trainingAction = action;
  face.userData.borderColor = color;
  face.userData._btnGroup = group;
  group.add(face);
  const border = new THREE.LineSegments(
    new THREE.EdgesGeometry(face.geometry),
    new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.7 })
  );
  border.renderOrder = MENU_BTN_RO;
  group.add(border);
  const sprite = makeSizedText(label, {
    fontSize,
    color: opts.textColor || '#ffffff',
    glyphSize: glyph,
    depthTest: true,
    forceArial: true,
    maxWidth: buttonTextMaxWidth(w, fontSize, glyph),
  });
  sprite.renderOrder = MENU_TEXT_RO;
  sprite.position.set(0, 0, 0.03);
  group.add(sprite);
  return face;
}

function makeLabel(parent, text, x, y, opts = {}) {
  const s = makeSizedText(text, {
    fontSize: opts.fontSize || 46,
    color: opts.color || '#ffffff',
    glow: opts.glow !== false,
    glowColor: opts.color || '#ffffff',
    glyphSize: opts.glyphSize || HEADING_GLYPH,
    depthTest: true,
    forceArial: !!opts.forceArial,
  });
  s.renderOrder = MENU_TEXT_RO;
  s.position.set(x, y, 0.02);
  parent.add(s);
  return s;
}

function buildTrainingMenu() {
  const group = new THREE.Group();
  group.name = 'training-menu';
  // Camera-relative like the upgrade cards: in front of the player
  const cam = _hasDep('camera') ? _deps.camera : null;
  const baseY = cam ? cam.position.y : 1.6;
  group.position.set(0, baseY + 0.4, -2.9);
  _deps.scene.add(group);
  _menuGroup = group;

  // Narrower panel — the columns hug the center now that the buttons are
  // compact (player feedback: no reason for a huge menu).
  const panelW = 5.6;
  const panelH = 3.9;
  const bg = new THREE.Mesh(
    new THREE.PlaneGeometry(panelW, panelH),
    new THREE.MeshBasicMaterial({ color: 0x0a0f22, transparent: true, opacity: 0.96, side: THREE.DoubleSide, depthWrite: false, depthTest: true })
  );
  bg.renderOrder = MENU_BG_RO;
  group.add(bg);
  const border = new THREE.LineSegments(
    new THREE.EdgesGeometry(bg.geometry),
    new THREE.LineBasicMaterial({ color: 0x00ff88 })
  );
  border.renderOrder = MENU_BG_RO;
  group.add(border);

  if (_loadoutView) {
    buildLoadoutView(group);
  } else {
    buildCombatView(group);
  }
}

// ── Digital wave counter (player feedback): an old-alarm-clock style
// lime-on-black 2-digit display beside each enemy/boss button. Brightens
// with a flash when it updates and pulses while the count is active.
const _counterFlashPhase = Math.random() * Math.PI * 2;
function makeDigitalCounter(value) {
  const group = new THREE.Group();
  group.name = 'wave-counter';
  const bg = new THREE.Mesh(
    new THREE.PlaneGeometry(0.16, 0.19),
    new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.85, side: THREE.DoubleSide, depthWrite: false, depthTest: true })
  );
  bg.renderOrder = MENU_BTN_RO;
  group.add(bg);
  const border = new THREE.LineSegments(
    new THREE.EdgesGeometry(bg.geometry),
    new THREE.LineBasicMaterial({ color: 0x226622, transparent: true, opacity: 0.9 })
  );
  border.renderOrder = MENU_BTN_RO;
  group.add(border);

  const canvas = document.createElement('canvas');
  canvas.width = 48;
  canvas.height = 56;
  const tex = new THREE.CanvasTexture(canvas);
  const textMesh = new THREE.Mesh(
    new THREE.PlaneGeometry(0.13, 0.15),
    new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, depthTest: true })
  );
  textMesh.renderOrder = MENU_TEXT_RO;
  textMesh.position.z = 0.01;
  group.add(textMesh);

  const ctx = canvas.getContext('2d');
  const draw = (v, flash) => {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.font = '28px ' + digitalFontFamily;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const str = String(v).padStart(2, '0');
    // Lime green digits; flash → white-hot overlay
    ctx.fillStyle = flash ? '#c8ffd8' : '#44ff66';
    ctx.shadowColor = '#44ff66';
    ctx.shadowBlur = flash ? 12 : 4;
    ctx.fillText(str, canvas.width / 2, canvas.height / 2 + 1);
    tex.needsUpdate = true;
  };
  draw(value, true);
  group.userData.counter = { value, draw, flashStart: performance.now() };
  return group;
}

function updateCounters(now) {
  if (!_menuGroup) return;
  _menuGroup.traverse(c => {
    const ud = c.userData?.counter;
    if (!ud) return;
    // Flash decay after an update (300ms) then a gentle brightness loop
    const flashT = Math.min(1, (now - ud.flashStart) / 300);
    const flash = 1 - flashT;
    const active = ud.value > 0;
    const loop = active ? 0.55 + 0.3 * Math.sin(now * 0.004 + _counterFlashPhase) : 0.35;
    c.traverse(child => {
      if (child.isMesh && child.material?.map) {
        child.material.opacity = Math.max(0.25, loop + flash * 0.4);
      }
    });
  });
}

function buildCombatView(group) {
  const title = makeLabel(group, 'TRAINING GROUND', 0, 1.68, { fontSize: 92, color: '#00ff88', glyphSize: 0.17 });
  const sub = makeLabel(group, 'BUILD A WAVE — THEN PRESS GO', 0, 1.32, { fontSize: 38, color: '#8899bb', glyphSize: 0.052, forceArial: true });

  // ── ENEMIES column (scrollable) — buttons + digital counters ──
  const enemyHeader = makeLabel(group, 'ENEMIES', -1.9, 0.98, { fontSize: 88, color: '#ff8866', glyphSize: 0.13 });
  const enemyList = new THREE.Group();
  enemyList.position.set(-1.9, 0.76, 0.01);
  group.add(enemyList);
  const ENEMY_IDS = [
    ['basic', 'DRONE'], ['fast', 'SNEAK'], ['tank', 'SENTINEL'], ['swarm', 'DART'],
    ['spiral_swimmer', 'SPIRAL SWIMMER'], ['jelly', 'STACK'], ['conductor', 'COMMANDER'],
    ['mortar', 'MORTAR'], ['bombardier', 'BOMBARDIER'], ['void_anchor', 'VOID ANCHOR'],
    ['void_tendril', 'VOID TENDRIL'], ['echo_phantom', 'ECHO PHANTOM'], ['leech', 'LEECH'],
  ];
  const visibleEnemies = 6;
  ENEMY_IDS.forEach(([id, label], i) => {
    const row = new THREE.Group();
    row.position.set(-0.28, -i * 0.2, 0); // button left, counter right
    enemyList.add(row);
    const pendingCount = _pendingWave.find(p => p.kind === 'enemy' && p.type === id)?.count || 0;
    makeButton(row, label, { type: 'queue_enemy', id }, -0.28, 0, { w: 0.78, h: 0.17, color: 0xff8866, fontSize: 40, glyphSize: 0.054 });
    const counter = makeDigitalCounter(pendingCount);
    counter.position.set(0.33, 0, 0.02);
    row.add(counter);
  });
  enemyList.userData.maxRows = ENEMY_IDS.length - visibleEnemies;
  enemyList.userData.scrollKey = 'enemy';

  // ── BOSSES column — buttons + digital counters ──
  const bossHeader = makeLabel(group, 'BOSSES', 1.9, 0.98, { fontSize: 88, color: '#ff88ff', glyphSize: 0.13 });
  const BOSS_IDS = [
    ['skull_boss', 'NECRO'], ['the_maw', 'THE MAW'], ['the_prism', 'THE PRISM'],
    ['mirror_gauntlet', 'MIRROR GAUNTLET'], ['neon_minotaur', 'BLOOD MINOTAUR'],
    ['conductor_ascendant', 'CONDUCTOR'], ['the_masquerade', 'MASQUERADE'],
    ['eclipse_engine', 'ECLIPSE ENGINE'],
  ];
  let by = 0.74;
  BOSS_IDS.forEach(([id, label]) => {
    const row = new THREE.Group();
    row.position.set(-0.28, by, 0);
    group.add(row);
    const pendingCount = _pendingWave.find(p => p.kind === 'boss' && p.type === id)?.count || 0;
    makeButton(row, label, { type: 'queue_boss', id }, -0.28, 0, { w: 1.0, h: 0.18, color: 0xff88ff, fontSize: 38, glyphSize: 0.056 });
    const counter = makeDigitalCounter(pendingCount);
    counter.position.set(0.45, 0, 0.02);
    row.add(counter);
    by -= 0.23;
  });

  // ── CENTER: WAVE SIZE section (compact, no overlap, moved down) ──
  const waveHeader = makeLabel(group, 'WAVE SIZE', 0, 0.62, { fontSize: 56, color: '#ffdd00', glyphSize: 0.085 });
  // Compact stepper: -5 | -1 | SIZE | +1 | +5 (each 0.28 wide, 0.36 apart)
  makeButton(group, '-5', { type: 'wave_add', amount: -5 }, -0.75, 0.3, { w: 0.28, h: 0.24, color: 0xffdd00, fontSize: 34, glyphSize: 0.06 });
  makeButton(group, '-1', { type: 'wave_add', amount: -1 }, -0.39, 0.3, { w: 0.28, h: 0.24, color: 0xffdd00, fontSize: 34, glyphSize: 0.06 });
  makeButton(group, `SIZE: ${_waveSize}`, { type: 'noop' }, 0, 0.3, { w: 0.62, h: 0.26, color: 0xffdd00, fontSize: 44, glyphSize: 0.07 });
  makeButton(group, '+1', { type: 'wave_add', amount: 1 }, 0.39, 0.3, { w: 0.28, h: 0.24, color: 0xffdd00, fontSize: 34, glyphSize: 0.06 });
  makeButton(group, '+5', { type: 'wave_add', amount: 5 }, 0.75, 0.3, { w: 0.28, h: 0.24, color: 0xffdd00, fontSize: 34, glyphSize: 0.06 });

  // GO + actions
  const waveActive = _activeWave.length > 0 || _pendingWave.some(p => p.kind === 'enemy');
  makeButton(group, waveActive ? 'GO (WAVE RUNNING)' : 'GO!', { type: 'go_wave' }, 0, -0.18, { w: 1.5, h: 0.28, color: 0x00ff88, fontSize: 48, glyphSize: 0.07 });
  makeButton(group, 'CLEAR WAVE', { type: 'clear_wave' }, 0, -0.56, { w: 1.5, h: 0.24, color: 0xff6644, fontSize: 38, glyphSize: 0.055 });
  makeButton(group, 'LOADOUT →', { type: 'goto_loadout' }, 0, -0.92, { w: 1.5, h: 0.24, color: 0x44aaff, fontSize: 38, glyphSize: 0.055 });
  makeButton(group, 'EXIT TRAINING', { type: 'exit_training' }, 0, -1.28, { w: 1.5, h: 0.24, color: 0xff4444, fontSize: 38, glyphSize: 0.055 });

  const tip = makeLabel(group, 'GO CLOSES THIS MENU — THUMBSTICK OR T REOPENS IT', 0, -1.66, { fontSize: 30, color: '#6688aa', glyphSize: 0.04, forceArial: true });
}

function buildLoadoutView(group) {
  const title = makeLabel(group, 'LOADOUT — BUILD YOUR ARSENAL', 0, 1.68, { fontSize: 52, color: '#44aaff', glyphSize: 0.08 });

  // ── UPGRADES column (scrollable) ──
  const upHeader = makeLabel(group, 'UPGRADES (BOTH HANDS)', -1.9, 0.98, { fontSize: 38, color: '#44ffaa', glyphSize: 0.052 });
  const upList = new THREE.Group();
  upList.position.set(-1.9, 0.76, 0.01);
  group.add(upList);
  const allUpgrades = [...UPGRADE_POOL, ...SPECIAL_UPGRADE_POOL].filter((u, i, arr) => arr.findIndex(x => x.id === u.id) === i);
  allUpgrades.forEach((u, i) => {
    makeButton(upList, u.name.toUpperCase(), { type: 'add_upgrade', id: u.id }, 0, -i * 0.18, { w: 0.92, h: 0.16, color: 0x44ffaa, fontSize: 38, glyphSize: 0.05 });
  });
  upList.userData.maxRows = Math.max(0, allUpgrades.length - 6);
  upList.userData.scrollKey = 'loadout';

  // ── EVOLUTIONS column ──
  const evoHeader = makeLabel(group, 'EVOLUTIONS', 1.9, 0.98, { fontSize: 38, color: '#ffdd00', glyphSize: 0.052 });
  let ey = 0.74;
  Object.entries(WEAPON_EVOLUTIONS).forEach(([weaponId, evo]) => {
    makeButton(group, evo.name.toUpperCase(), {
      type: 'evolve', weaponId, evoId: evo.id,
    }, 1.9, ey, { w: 1.15, h: 0.2, color: evo.sigColor || 0xffdd00, fontSize: 38, glyphSize: 0.056 });
    const from = makeLabel(group, `from ${(evo.from || weaponId).toUpperCase()}`, 1.9, ey - 0.11, { fontSize: 26, color: '#8899bb', glyphSize: 0.034, forceArial: true });
    ey -= 0.3;
  });

  // ── Actions ──
  makeButton(group, 'RESET LOADOUT', { type: 'reset_loadout' }, 0, 0.1, { w: 1.3, h: 0.22, color: 0xff8844, fontSize: 38, glyphSize: 0.055 });
  makeButton(group, '← COMBAT', { type: 'goto_combat' }, 0, -0.26, { w: 1.3, h: 0.22, color: 0x44aaff, fontSize: 38, glyphSize: 0.055 });
  makeButton(group, 'EXIT TRAINING', { type: 'exit_training' }, 0, -0.62, { w: 1.3, h: 0.22, color: 0xff4444, fontSize: 38, glyphSize: 0.055 });
}

function disposeMenuGroup(group) {
  group.traverse(child => {
    if (child.geometry) child.geometry.dispose();
    if (child.material) {
      if (Array.isArray(child.material)) child.material.forEach(m => m.dispose());
      else child.material.dispose();
    }
  });
}

// ── Holodeck environment ────────────────────────────────────

function buildHolodeck() {
  const group = new THREE.Group();
  group.name = 'holodeck-room';

  // Grid shader with a digital-green pulse (player feedback: lime → dark
  // forest green, like a cool holodeck grid — not pink/blue).
  const gridShader = {
    uniforms: {
      uColor: { value: new THREE.Color(0x44ff88) },
      uPulseA: { value: new THREE.Color(0x88ff44) },   // lime
      uPulseB: { value: new THREE.Color(0x1a5c1a) },   // dark forest green
      uTime: { value: 0 },
      uFogColor: { value: new THREE.Color(0x02060c) },
    },
    vertexShader: `
      varying vec3 vWorldPos;
      void main() {
        vWorldPos = (modelMatrix * vec4(position, 1.0)).xyz;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform vec3 uColor;
      uniform vec3 uPulseA;
      uniform vec3 uPulseB;
      uniform float uTime;
      uniform vec3 uFogColor;
      varying vec3 vWorldPos;
      void main() {
        float grid = 0.0;
        // Fine lines + bold lines every 5 cells
        float f1 = abs(fract(vWorldPos.x / 2.0) - 0.5);
        float f2 = abs(fract(vWorldPos.z / 2.0) - 0.5);
        float bold1 = abs(fract(vWorldPos.x / 10.0) - 0.5);
        float bold2 = abs(fract(vWorldPos.z / 10.0) - 0.5);
        float lineW = 0.02;
        grid = max(
          step(1.0 - lineW, f1 * 2.0) + step(1.0 - lineW, f2 * 2.0),
          (step(1.0 - lineW * 3.0, bold1 * 2.0) + step(1.0 - lineW * 3.0, bold2 * 2.0)) * 1.6
        );
        grid = clamp(grid, 0.0, 1.0);
        // Digital green pulse: lines breathe lime ↔ forest green, with a
        // ripple radiating outward from the player.
        float wave = 0.5 + 0.5 * sin(uTime * 1.8);
        vec3 pulseColor = mix(uPulseA, uPulseB, wave);
        vec3 col = mix(uColor, pulseColor, 0.7);
        float dist = length(vWorldPos.xz);
        float ripple = 0.75 + 0.25 * sin(uTime * 2.2 - dist * 0.35);
        col *= ripple;
        // Distance fade → black void (the "endless" look)
        float fade = 1.0 - smoothstep(20.0, 140.0, dist);
        col = mix(col, uFogColor, 0.4);
        gl_FragColor = vec4(col * grid * fade, 1.0);
      }
    `,
  };

  // Floor
  const floorGeo = new THREE.PlaneGeometry(400, 400);
  const floorMat = new THREE.ShaderMaterial({
    ...gridShader,
    side: THREE.DoubleSide,
    depthWrite: true,
    depthTest: true,
    fog: false,
  });
  const floor = new THREE.Mesh(floorGeo, floorMat);
  floor.rotation.x = -Math.PI / 2;
  floor.name = 'holodeck-floor';
  group.add(floor);

  // Far "walls" as a grid dome (BackSide sphere with the grid shader) —
  // a faint grid horizon so the room feels enclosed like a holodeck.
  const wallGeo = new THREE.SphereGeometry(180, 24, 12);
  const wallMat = new THREE.ShaderMaterial({
    ...gridShader,
    side: THREE.BackSide,
    depthWrite: false,
    depthTest: true,
  });
  const wall = new THREE.Mesh(wallGeo, wallMat);
  wall.position.y = 90;
  wall.name = 'holodeck-walls';
  group.add(wall);

  // Vignette glow under the player
  const glowTex = makeRadialGlowTexture();
  const glow = new THREE.Mesh(
    new THREE.PlaneGeometry(14, 14),
    new THREE.MeshBasicMaterial({ map: glowTex, transparent: true, opacity: 0.35, blending: THREE.AdditiveBlending, depthWrite: false, depthTest: true })
  );
  glow.rotation.x = -Math.PI / 2;
  glow.position.y = 0.02;
  glow.name = 'holodeck-center-glow';
  group.add(glow);

  // World-space instructions sign out on the field (NEVER camera-pinned).
  // Raised and ~200% larger so it's legible from the player (feedback: too
  // far + too small + clipped the floor).
  const signGroup = new THREE.Group();
  signGroup.name = 'holodeck-sign';
  signGroup.position.set(0, 2.15, -5.2);
  const signTitle = makeSizedText('TRAINING GROUND', {
    fontSize: 120, color: '#00ff88', glow: true, glowColor: '#00ff88',
    glyphSize: 0.34, depthTest: true, forceArial: true,
  });
  signTitle.position.set(0, 0.6, 0);
  signGroup.add(signTitle);
  const signHint = makeSizedText('YOU ARE INVINCIBLE — THUMBSTICK CLICK OR T OPENS THE TRAINING MENU', {
    fontSize: 60, color: '#88ffcc', glow: true, glowColor: '#00aa66',
    glyphSize: 0.13, depthTest: true, forceArial: true, maxWidth: 1100,
  });
  signHint.position.set(0, -0.1, 0);
  signGroup.add(signHint);
  const signSub = makeSizedText('BUILD A WAVE · PRESS GO · TEST YOUR ARSENAL', {
    fontSize: 50, color: '#6688aa', glow: true, glowColor: '#224466',
    glyphSize: 0.1, depthTest: true, forceArial: true,
  });
  signSub.position.set(0, -0.55, 0);
  signGroup.add(signSub);
  group.add(signGroup);
  _holodeckSignTime = 0;

  if (_deps.scene.background && _deps.scene.background.isColor) {
    _deps.scene.background.set(0x02060c);
  } else {
    _deps.scene.background = new THREE.Color(0x02060c);
  }
  _deps.scene.add(group);
  _holodeckGroup = group;
}

// Pulse the holodeck grid shader (called per frame while training is active).
let _holodeckSignTime = 0;
function updateHolodeck(now) {
  if (!_holodeckGroup) return;
  const t = now * 0.001;
  _holodeckGroup.traverse(child => {
    if (child.material?.uniforms?.uTime) {
      child.material.uniforms.uTime.value = t;
    }
  });
}

function makeRadialGlowTexture() {
  const size = 128;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  g.addColorStop(0, 'rgba(0,255,136,0.9)');
  g.addColorStop(0.4, 'rgba(0,180,120,0.35)');
  g.addColorStop(1, 'rgba(0,80,60,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  return new THREE.CanvasTexture(canvas);
}

function disposeHolodeck() {
  if (!_holodeckGroup) return;
  _holodeckGroup.traverse(child => {
    if (child.geometry) child.geometry.dispose();
    if (child.material) {
      if (child.material.uniforms) {
        for (const k of Object.keys(child.material.uniforms)) {
          const v = child.material.uniforms[k]?.value;
          if (v && v.isTexture) v.dispose();
        }
      }
      if (Array.isArray(child.material)) child.material.forEach(m => m.dispose());
      else child.material.dispose();
    }
  });
  if (_holodeckGroup.parent) _holodeckGroup.parent.remove(_holodeckGroup);
  _holodeckGroup = null;
}

// ── Input: raycast + hover + actions ────────────────────────

/** Raycast the training menu buttons. Returns the action payload or null. */
export function getTrainingMenuHit(raycaster) {
  if (!_menuOpen || !_menuGroup || !raycaster) return null;
  const targets = [];
  _menuGroup.traverse(c => {
    if (c.userData && c.userData.trainingAction) targets.push(c);
  });
  if (targets.length === 0) return null;
  const hits = raycaster.intersectObjects(targets, false);
  for (const hit of hits) {
    const action = hit.object.userData.trainingAction;
    if (action) return action;
  }
  return null;
}

/** Hover pass for the training menu (scale + border brighten). */
export function updateTrainingHover(raycaster) {
  if (!_menuOpen || !_menuGroup || !raycaster) return;
  const targets = [];
  _menuGroup.traverse(c => {
    if (c.userData && c.userData.trainingAction) targets.push(c);
  });
  const hits = raycaster.intersectObjects(targets, false);
  const hovered = hits.length > 0 ? hits[0].object : null;

  if (hovered && hovered !== _hoveredButton && _hasDep('playMenuHoverSound')) {
    _deps.playMenuHoverSound();
  }
  _hoveredButton = hovered;

  targets.forEach(btn => {
    const group = btn.userData._btnGroup;
    if (!group) return;
    const isHovered = btn === hovered;
    const border = group.children.find(c => c.isLineSegments);
    if (border && border.material) {
      const color = btn.userData.borderColor || 0x00ff88;
      border.material.opacity = isHovered ? 1 : 0.7;
      border.material.color.set(color);
    }
    const baseScale = group.userData._baseScale || 1;
    const current = group.userData._hoverScale ?? 1;
    const desired = isHovered ? 1.06 : 1;
    const next = current + (desired - current) * 0.25;
    group.userData._hoverScale = next;
    if (!group.userData._baseScale) group.userData._baseScale = 1;
    group.scale.setScalar(Math.max(0.4, baseScale * next));
  });
}

/**
 * Execute a training menu action. Called from main.js (trigger/click paths).
 * Returns true when the action was consumed.
 */
export function handleTrainingAction(action) {
  if (!action || !action.type) return false;
  if (_hasDep('playMenuClick')) _deps.playMenuClick();

  switch (action.type) {
    case 'noop':
      return true;

    case 'wave_add': {
      _waveSize = Math.max(1, Math.min(30, _waveSize + (action.amount || 0)));
      rebuildMenu();
      return true;
    }

    case 'queue_enemy': {
      // Add _waveSize of this enemy to the pending wave (merged per type)
      const entry = _pendingWave.find(p => p.kind === 'enemy' && p.type === action.id);
      if (entry) entry.count = Math.min(30, entry.count + _waveSize);
      else _pendingWave.push({ kind: 'enemy', type: action.id, count: _waveSize });
      rebuildMenu();
      return true;
    }

    case 'queue_boss': {
      // Bosses spawn at GO; queueing again adds one more
      const entry = _pendingWave.find(p => p.kind === 'boss' && p.type === action.id);
      if (entry) entry.count += 1;
      else _pendingWave.push({ kind: 'boss', type: action.id, count: 1 });
      rebuildMenu();
      return true;
    }

    case 'clear_wave': {
      // FULL reset: clear the pending queue AND the entire field (enemies +
      // bosses + boss health bar) — player feedback.
      _pendingWave = [];
      _activeWave = [];
      if (_hasDep('clearAllEnemies')) _deps.clearAllEnemies();
      if (_hasDep('clearBoss')) _deps.clearBoss();
      if (_hasDep('hideBossHealthBar')) _deps.hideBossHealthBar();
      rebuildMenu();
      return true;
    }

    case 'go_wave': {
      startPendingWave();
      return true;
    }

    case 'clear_enemies': {
      if (_hasDep('clearAllEnemies')) _deps.clearAllEnemies();
      return true;
    }

    case 'goto_loadout': {
      _loadoutView = true;
      rebuildMenu();
      return true;
    }

    case 'goto_combat': {
      _loadoutView = false;
      rebuildMenu();
      return true;
    }

    case 'add_upgrade': {
      const def = getUpgradeDef(action.id);
      if (!def) return true;
      // Universal upgrades → both hands; weapon-specific → matching hand
      if (def.type === 'weapon_specific' && def.weapon) {
        for (const hand of ['left', 'right']) {
          if ((game.mainWeapon?.[hand] || '') === def.weapon) {
            addUpgrade(def.id, hand);
          }
        }
      } else {
        addUpgrade(def.id, 'left');
        addUpgrade(def.id, 'right');
      }
      if (_hasDep('recomputeSynergies')) _deps.recomputeSynergies();
      return true;
    }

    case 'evolve': {
      // Evolve BOTH hands to the chosen evolution (base weapon + evo state)
      for (const hand of ['left', 'right']) {
        game.mainWeapon[hand] = action.weaponId;
        setWeaponEvolution(action.evoId, hand);
      }
      if (_hasDep('recomputeSynergies')) _deps.recomputeSynergies();
      return true;
    }

    case 'reset_loadout': {
      game.upgrades = { left: {}, right: {} };
      game.weaponEvolution = { left: null, right: null };
      game.mainWeapon = { left: 'standard_blaster', right: 'standard_blaster' };
      if (_hasDep('recomputeSynergies')) _deps.recomputeSynergies();
      return true;
    }

    case 'exit_training': {
      exitTraining();
      if (_hasDep('exitToTitle')) _deps.exitToTitle();
      return true;
    }

    default:
      return false;
  }
}

function rebuildMenu() {
  hideTrainingMenu();
  showTrainingMenu(false); // preserve the current view (combat/loadout)
}

// ── Wave release ────────────────────────────────────────────

// GO: bosses in the pending wave spawn immediately; enemies move into the
// active release queue and are trickled out in batches (like a real level).
// The menu closes so the player can actually fight (player feedback).
function startPendingWave() {
  if (_pendingWave.length === 0) return;
  for (const p of _pendingWave) {
    if (p.kind === 'boss') {
      for (let i = 0; i < p.count; i++) spawnBossInTraining(p.type);
    } else {
      const entry = _activeWave.find(e => e.type === p.type);
      if (entry) entry.count += p.count;
      else _activeWave.push({ type: p.type, count: p.count });
    }
  }
  _pendingWave = [];
  _waveReleaseTimer = 0.5; // first batch lands quickly
  hideTrainingMenu();
}

// Tick the active wave: release batches of enemies over time. Called every
// frame from main.js while training is active (menu open or not).
function updateWaveRelease(dt) {
  if (_activeWave.length === 0) return;
  _waveReleaseTimer -= dt;
  if (_waveReleaseTimer > 0) return;

  let released = 0;
  for (let i = _activeWave.length - 1; i >= 0 && released < WAVE_BATCH_SIZE; i--) {
    const entry = _activeWave[i];
    const batch = Math.min(entry.count, WAVE_BATCH_SIZE - released);
    for (let b = 0; b < batch; b++) spawnEnemyAt(entry.type);
    entry.count -= batch;
    released += batch;
    if (entry.count <= 0) _activeWave.splice(i, 1);
  }
  _waveReleaseTimer = WAVE_BATCH_INTERVAL;
}

function spawnEnemyAt(type) {
  if (!_hasDep('spawnEnemy')) return;
  const cfg = _trainingConfig || _deps.getLevelConfig?.() || game._levelConfig;
  const cam = _deps.camera;
  // STRICT front-arc spawn rule (matches the main game's getSpawnPosition:
  // ±50° from the player's forward). Player feedback: enemies were spawning
  // behind the player in the training ground.
  const angle = (Math.random() - 0.5) * (100 * Math.PI / 180);
  const dist = 10 + Math.random() * 6;
  const pos = new THREE.Vector3(
    cam.position.x + Math.sin(angle) * dist,
    cam.position.y + 0.1,
    cam.position.z - Math.cos(angle) * dist,
  );
  _deps.spawnEnemy(type, pos, cfg);
}

function spawnBossInTraining(bossId) {
  if (!_hasDep('spawnBoss')) return;
  const cfg = _trainingConfig || _deps.getLevelConfig?.() || game._levelConfig;
  const boss = _deps.spawnBoss(bossId, cfg);
  if (boss && _hasDep('showBossHealthBar')) _deps.showBossHealthBar(boss);
  _log(`[training-ground] spawned boss ${bossId}`);
}

// ── Per-frame scroll + updates (called from main.js) ────────

let _scrollAccum = 0;

/** Scroll the menu lists via the Quest thumbstick (edge-triggered). */
export function updateTrainingScrollInput(now) {
  if (!_menuOpen) return;
  const session = _deps.renderer?.xr?.getSession?.();
  if (!session) return;
  let axis = 0;
  session.inputSources.forEach(source => {
    const gp = source.gamepad;
    if (!gp?.axes || gp.axes.length < 2) return;
    const y = gp.axes[1] ?? 0;
    if (Math.abs(y) > 0.25 && Math.abs(y) > Math.abs(axis)) axis = y;
  });
  if (axis !== 0) {
    _scrollAccum += axis * 0.02;
    if (Math.abs(_scrollAccum) >= 1) {
      scrollMenus(axis > 0 ? 1 : -1);
      _scrollAccum = 0;
    }
  } else {
    _scrollAccum = 0;
  }
}

/** Scroll the menu lists from the desktop wheel. */
export function scrollTrainingMenus(delta) {
  scrollMenus(delta);
}

function scrollMenus(delta) {
  if (!_menuGroup) return;
  const lists = [];
  _menuGroup.traverse(c => {
    if (c.userData && c.userData.scrollKey) lists.push(c);
  });
  lists.forEach(list => {
    const max = list.userData.maxRows || 0;
    if (max <= 0) return;
    let scroll = list.userData._scroll || 0;
    scroll = Math.max(0, Math.min(max, scroll + (delta > 0 ? 1 : -1)));
    list.userData._scroll = scroll;
    list.position.y = 0.86 + scroll * 0.17;
  });
}

/** Per-frame menu pulse + wave release (called from main.js while training). */
export function updateTrainingMenu(now, dt) {
  updateHolodeck(now);
  // The menu PAUSES the wave: no releases while it's open (player feedback —
  // opening the menu mid-fight should freeze the action).
  if (!_menuOpen) updateWaveRelease(dt);
  updateCounters(now);
}

// Test seam: expose wave size for automation.
export function getTrainingWaveSize() {
  return _waveSize;
}
