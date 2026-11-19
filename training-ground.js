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
import { makeSizedText, showHUD, hudGroup, digitalFontFamily, loadLayout } from './hud.js';
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
// Cached button faces for raycasting. Rebuilt whenever the menu is built, so
// the hit test no longer traverses the whole menu group on every query
// (hit + hover + one per controller per frame = 4+ traversals per frame).
let _menuTargets = [];
// Placement captured when the menu opens (world pos + yaw). Rebuilds reuse it
// so the panel does not jump around while the player clicks through buttons.
let _menuAnchor = null;

// ── Layout-driven geometry (layouts/training-ground.json) ───
// Every static element + generated-list template is read from the layout so
// the layout editor can tune positions/sizes/fonts. Defaults below are the
// fallbacks used if the JSON is missing.
let _layout = null;
let _layoutPromise = null;
function el(id, def) {
  const e = _layout?.elements?.[id];
  return e ? { ...def, ...e } : def;
}
function listTpl(id, def) {
  const l = _layout?.lists?.[id];
  return l ? { ...def, ...l } : def;
}
function _hex(n) { return '#' + (n >>> 0).toString(16).padStart(6, '0').slice(-6); }
async function ensureTrainingLayout() {
  if (_layout) return _layout;
  if (!_layoutPromise) {
    _layoutPromise = loadLayout('training-ground')
      .then((d) => { _layout = d || {}; return _layout; })
      .catch(() => { _layout = {}; return _layout; });
  }
  return _layoutPromise;
}

// Wave queue: the player builds a battle in the menu, then presses GO.
// Bosses in the queue spawn immediately at GO; enemies are released in
// staggered batches (like a real level) so the fight develops over time.
let _pendingWave = [];        // [{ kind:'enemy'|'boss', type, count }]
let _activeWave = [];         // remaining enemies to release { type, count }
let _waveReleaseTimer = 0;    // seconds until the next batch
const WAVE_BATCH_SIZE = 3;    // enemies released per batch
const WAVE_BATCH_INTERVAL = 1.2; // seconds between batches
// Spawn-basis scratch vectors (per spawn, not per frame)
const _trainSpawnFwd = new THREE.Vector3();
const _trainSpawnRight = new THREE.Vector3();
const _WORLD_UP = new THREE.Vector3(0, 1, 0);
// Fixed front axis for this training session (set in startTraining).
const _trainForward = new THREE.Vector3(0, 0, -1);

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
  // Preload the layout so the first menu open is already laid out.
  ensureTrainingLayout();
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

  // Fixed front axis for the whole training session (spawns never follow the
  // headset): captured once here, like a level's spawn forward.
  const cam = _hasDep('camera') ? _deps.camera : null;
  if (cam) {
    cam.getWorldDirection(_trainForward);
    _trainForward.y = 0;
    if (_trainForward.lengthSq() < 1e-6) _trainForward.set(0, 0, -1);
    else _trainForward.normalize();
  } else {
    _trainForward.set(0, 0, -1);
  }

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

export async function showTrainingMenu(resetView = true) {
  if (!_active || _menuOpen) return;
  _menuOpen = true;
  if (resetView) {
    _loadoutView = false; // fresh open → combat view
    // Capture where the player is looking so the panel always opens in FRONT
    // of them (the holodeck is walk-around; a fixed world-space panel ended up
    // behind the player once they moved).
    _menuAnchor = computeMenuAnchor();
  }
  _enemyScroll = 0;
  _loadoutScroll = 0;
  // The menu must draw over the floor HUD: hide the HUD while browsing
  // (some HUD sprites are depthTest:false and would otherwise render on top).
  if (hudGroup) hudGroup.visible = false;
  await ensureTrainingLayout();
  if (!_menuOpen) return; // hidden again while the layout loaded
  buildTrainingMenu();
}

/**
 * Where the menu panel should live: 2.9m along the player's horizontal gaze,
 * yawed to face them. Falls back to the old fixed spot when the camera dep is
 * unavailable (headless tests).
 */
function computeMenuAnchor() {
  const cam = _hasDep('camera') ? _deps.camera : null;
  if (!cam) return { x: 0, y: 2.0, z: -2.9, yaw: 0 };
  const pos = new THREE.Vector3();
  cam.getWorldPosition(pos);
  const dir = new THREE.Vector3();
  cam.getWorldDirection(dir);
  dir.y = 0;
  if (dir.lengthSq() < 1e-6) dir.set(0, 0, -1);
  dir.normalize();
  return {
    x: pos.x + dir.x * 2.9,
    y: pos.y + 0.4,
    z: pos.z + dir.z * 2.9,
    // The panel's front is +Z and its text is drawn on that side, so rotate
    // so +Z points BACK along the gaze (toward the player). Yawing to
    // atan2(dir.x, dir.z) would face it away and mirror every label.
    yaw: Math.atan2(-dir.x, -dir.z),
  };
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
  _menuTargets = [];
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
    // Opaque face (no alpha blending over the panel) — a queued/active button
    // gets a brighter fill so the wave queue reads at a glance.
    new THREE.MeshBasicMaterial({
      color: opts.active ? 0x24305a : 0x141a33,
      side: THREE.DoubleSide, depthWrite: true, depthTest: true,
    })
  );
  face.renderOrder = MENU_BTN_RO;
  face.userData.trainingAction = action;
  face.userData.borderColor = color;
  face.userData._btnGroup = group;
  group.add(face);
  // Cache the hittable face for the raycast pass (see _menuTargets).
  _menuTargets.push(face);
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
  // Camera-relative like the upgrade cards: in front of the player, facing them
  const anchor = _menuAnchor || computeMenuAnchor();
  group.position.set(anchor.x, anchor.y, anchor.z);
  group.rotation.y = anchor.yaw;
  _deps.scene.add(group);
  _menuGroup = group;
  _menuTargets = []; // makeButton() repopulates this for the raycast pass

  // Panel: one OPAQUE quad (translucent stacks cost VR fill rate for nothing).
  const bg = new THREE.Mesh(
    new THREE.PlaneGeometry(MENU_PANEL.w, MENU_PANEL.h),
    new THREE.MeshBasicMaterial({
      color: 0x0a0c18, side: THREE.DoubleSide, depthWrite: true, depthTest: true,
    })
  );
  bg.position.set(0, 0, 0);
  bg.renderOrder = MENU_BG_RO;
  group.add(bg);
  const border = new THREE.LineSegments(
    new THREE.EdgesGeometry(bg.geometry),
    new THREE.LineBasicMaterial({ color: 0x00ff88, transparent: true, opacity: 0.85 })
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
// (Digital wave counters removed — the queue count now lives inside each
// button's label, which removed 21 canvas textures, 21 quads and a per-frame
// menu traverse while the menu was open.)


// (Digital wave counters removed — the queue count now lives inside each
// button's label, which removed 21 canvas textures, 21 quads and a per-frame
// menu traverse while the menu was open.)


// ── Menu metrics ───────────────────────────────────────────
// Compact, opaque, eye-level panel. Everything below is in MENU-LOCAL metres
// (the panel is 3.8 x 2.3, placed 2.9m in front of the player). The digital
// "alarm clock" counters were removed: 21 extra canvas textures + 21 quads for
// numbers that read better inside the button label, and the old panel ran off
// the bottom of the view.
const MENU_PANEL = { w: 3.8, h: 2.3 };
const MENU_COL = { left: -1.16, center: 0, right: 1.16 };
const MENU_HEADER_Y = 0.56;
const MENU_LIST_TOP = 0.34;
const MENU_ROW_H = 0.26;
const MENU_BTN_H = 0.235;
const MENU_VISIBLE_ROWS = 5;
const MENU_GLYPH_BTN = 0.042;
const MENU_GLYPH_HEADER = 0.052;
const MENU_GLYPH_TITLE = 0.075;

function buildCombatView(parent) {
  makeLabel(parent, 'TRAINING GROUND', 0, 0.96, { fontSize: 72, color: '#00ff88', glyphSize: MENU_GLYPH_TITLE });
  makeLabel(parent, 'BUILD A WAVE — PRESS GO · STICK SCROLLS LISTS', 0, 0.80, {
    fontSize: 30, color: '#8f9cc4', glyphSize: 0.038, forceArial: true,
  });

  // ── ENEMIES column (scrollable) ──
  makeLabel(parent, 'ENEMIES', MENU_COL.left, MENU_HEADER_Y, { fontSize: 48, color: '#ff8866', glyphSize: MENU_GLYPH_HEADER });
  const ENEMY_IDS = [
    ['basic', 'DRONE'], ['fast', 'SNEAK'], ['tank', 'SENTINEL'], ['swarm', 'DART'],
    ['spiral_swimmer', 'SPIRAL SWIMMER'], ['jelly', 'STACK'], ['conductor', 'COMMANDER'],
    ['mortar', 'MORTAR'], ['bombardier', 'BOMBARDIER'], ['void_anchor', 'VOID ANCHOR'],
    ['void_tendril', 'VOID TENDRIL'], ['echo_phantom', 'ECHO PHANTOM'], ['leech', 'LEECH'],
  ];
  const enemyList = new THREE.Group();
  enemyList.position.set(MENU_COL.left, MENU_LIST_TOP, 0.01);
  parent.add(enemyList);
  ENEMY_IDS.forEach(([id, label], i) => {
    const row = new THREE.Group();
    row.position.set(0, -i * MENU_ROW_H, 0);
    enemyList.add(row);
    const pendingCount = _pendingWave.find(p => p.kind === 'enemy' && p.type === id)?.count || 0;
    makeButton(row, pendingCount > 0 ? `${label} ×${pendingCount}` : label, { type: 'queue_enemy', id }, 0, 0, {
      w: 1.0, h: MENU_BTN_H, color: 0xff8866, fontSize: 40, glyphSize: MENU_GLYPH_BTN,
      active: pendingCount > 0,
    });
  });
  enemyList.userData.maxRows = Math.max(0, ENEMY_IDS.length - MENU_VISIBLE_ROWS);
  enemyList.userData.scrollKey = 'enemy';
  enemyList.userData.baseY = MENU_LIST_TOP;
  enemyList.userData.rowH = MENU_ROW_H;
  applyListWindow(enemyList);

  // ── BOSSES column (scrollable) ──
  makeLabel(parent, 'BOSSES', MENU_COL.right, MENU_HEADER_Y, { fontSize: 48, color: '#ff88ff', glyphSize: MENU_GLYPH_HEADER });
  const BOSS_IDS = [
    ['skull_boss', 'NECRO'], ['the_maw', 'THE MAW'], ['the_prism', 'THE PRISM'],
    ['mirror_gauntlet', 'MIRROR GAUNTLET'], ['neon_minotaur', 'BLOOD MINOTAUR'],
    ['conductor_ascendant', 'CONDUCTOR'], ['the_masquerade', 'MASQUERADE'],
    ['eclipse_engine', 'ECLIPSE ENGINE'],
  ];
  const bossList = new THREE.Group();
  bossList.position.set(MENU_COL.right, MENU_LIST_TOP, 0.01);
  parent.add(bossList);
  BOSS_IDS.forEach(([id, label], i) => {
    const row = new THREE.Group();
    row.position.set(0, -i * MENU_ROW_H, 0);
    bossList.add(row);
    const pendingCount = _pendingWave.find(p => p.kind === 'boss' && p.type === id)?.count || 0;
    makeButton(row, pendingCount > 0 ? `${label} ×${pendingCount}` : label, { type: 'queue_boss', id }, 0, 0, {
      w: 1.0, h: MENU_BTN_H, color: 0xff88ff, fontSize: 38, glyphSize: MENU_GLYPH_BTN,
      active: pendingCount > 0,
    });
  });
  bossList.userData.maxRows = Math.max(0, BOSS_IDS.length - MENU_VISIBLE_ROWS);
  bossList.userData.scrollKey = 'boss';
  bossList.userData.baseY = MENU_LIST_TOP;
  bossList.userData.rowH = MENU_ROW_H;
  applyListWindow(bossList);

  // ── CENTER: wave size stepper + actions ──
  makeLabel(parent, 'WAVE SIZE', MENU_COL.center, MENU_HEADER_Y, { fontSize: 46, color: '#ffdd00', glyphSize: MENU_GLYPH_HEADER });
  for (const d of [{ text: '-5', x: -0.51, amount: -5 }, { text: '-1', x: -0.3, amount: -1 }]) {
    makeButton(parent, d.text, { type: 'wave_add', amount: d.amount }, d.x, MENU_LIST_TOP, {
      w: 0.18, h: MENU_BTN_H, color: 0xffdd00, fontSize: 36, glyphSize: 0.048,
    });
  }
  makeButton(parent, `SIZE ${_waveSize}`, { type: 'noop' }, 0, MENU_LIST_TOP, {
    w: 0.4, h: MENU_BTN_H, color: 0xffdd00, fontSize: 38, glyphSize: 0.048,
  });
  for (const d of [{ text: '+1', x: 0.3, amount: 1 }, { text: '+5', x: 0.51, amount: 5 }]) {
    makeButton(parent, d.text, { type: 'wave_add', amount: d.amount }, d.x, MENU_LIST_TOP, {
      w: 0.18, h: MENU_BTN_H, color: 0xffdd00, fontSize: 36, glyphSize: 0.048,
    });
  }

  const waveActive = _activeWave.length > 0 || _pendingWave.some(p => p.kind === 'enemy');
  makeButton(parent, waveActive ? 'GO (WAVE RUNNING)' : 'GO!', { type: 'go_wave' }, 0, -0.06, {
    w: 1.15, h: 0.3, color: 0x00ff88, fontSize: 52, glyphSize: 0.062,
  });
  makeButton(parent, 'CLEAR WAVE', { type: 'clear_wave' }, 0, -0.36, {
    w: 1.15, h: MENU_BTN_H, color: 0xff6644, fontSize: 40, glyphSize: MENU_GLYPH_BTN,
  });
  makeButton(parent, 'LOADOUT →', { type: 'goto_loadout' }, 0, -0.62, {
    w: 1.15, h: MENU_BTN_H, color: 0x44aaff, fontSize: 40, glyphSize: MENU_GLYPH_BTN,
  });
  makeButton(parent, 'EXIT TRAINING', { type: 'exit_training' }, 0, -0.88, {
    w: 1.15, h: MENU_BTN_H, color: 0xff4444, fontSize: 40, glyphSize: MENU_GLYPH_BTN,
  });
}


// Short display names for the LOADOUT upgrade buttons (long pool names would
// wrap on the compact buttons).
// Short display names for the LOADOUT upgrade buttons (long pool names would
// wrap on the compact buttons).
const LOADOUT_SHORT_NAMES = {
  'buckshot_gentlemen': 'GENTLEMEN', 'duck_hunt': 'DUCK HUNT', 'its_electric': 'ELECTRIC',
  'tesla_coil': 'TESLA COIL', 'quick_charge': 'QUICK CHARGE', 'excess_heat': 'HEAT',
  'death_ray': 'DEATH RAY', 'hold_together': 'HOLD TOGETHER', 'gimme_more': 'GIM ME MORE',
  'mega_scope': 'MEGA SCOPE', 'turbo_barrel': 'TURBO BARREL', 'triple_shot': 'TRIPLE SHOT',
  'super_crit': 'SUPER CRIT', 'life_steal': 'LIFE STEAL', 'overcharge': 'OVERCHARGE',
  'mega_boom': 'MEGA BOOM', 'focused_frenzy': 'FRENZY', 'extra_nuke': 'NUKE',
  'rapid_fire': 'RAPID FIRE', 'damage_up': 'DAMAGE', 'spread_shot': 'SPREAD',
  'homing': 'HOMING', 'magnetize': 'MAGNET', 'charge_shot': 'CHARGE', 'bounce': 'BOUNCE',
  'chain_lightning': 'CHAIN', 'dream_fragment': 'DREAM',
};

/**
 * Build a scrollable upgrade column for one hand.
 * All upgrades are created once; scrolling only moves/toggles the window
 * (rebuilding text sprites per scroll step was a stutter source).
 */
function buildUpgradeColumn(parent, hand, x, scrollKey) {
  const allUpgrades = [...UPGRADE_POOL, ...SPECIAL_UPGRADE_POOL]
    .filter((u, i, arr) => arr.findIndex(v => v.id === u.id) === i);

  const column = new THREE.Group();
  column.position.set(x, MENU_LIST_TOP, 0.01);
  parent.add(column);

  allUpgrades.forEach((u, i) => {
    const row = new THREE.Group();
    row.position.set(0, -i * MENU_ROW_H, 0);
    column.add(row);
    const count = game.upgrades?.[hand]?.[u.id] || 0;
    const short = LOADOUT_SHORT_NAMES[u.id] || u.name.toUpperCase();
    makeButton(row, count > 0 ? `${short} ×${count}` : short, { type: 'add_upgrade_hand', id: u.id, hand }, 0, 0, {
      w: 1.0, h: MENU_BTN_H, color: 0x44ffaa, fontSize: 36, glyphSize: MENU_GLYPH_BTN,
      active: count > 0,
    });
  });

  column.userData.maxRows = Math.max(0, allUpgrades.length - MENU_VISIBLE_ROWS);
  column.userData.scrollKey = scrollKey;
  column.userData.baseY = MENU_LIST_TOP;
  column.userData.rowH = MENU_ROW_H;
  applyListWindow(column);
  return column;
}
;

function buildLoadoutView(parent) {
  makeLabel(parent, 'LOADOUT', 0, 0.96, { fontSize: 72, color: '#44aaff', glyphSize: MENU_GLYPH_TITLE });
  makeLabel(parent, 'CLICK AN UPGRADE TO ADD IT TO THAT HAND — STICK SCROLLS', 0, 0.80, {
    fontSize: 30, color: '#8f9cc4', glyphSize: 0.038, forceArial: true,
  });

  // LEFT BLASTER
  makeLabel(parent, 'LEFT BLASTER', MENU_COL.left, MENU_HEADER_Y, { fontSize: 46, color: '#00ffff', glyphSize: MENU_GLYPH_HEADER });
  buildUpgradeColumn(parent, 'left', MENU_COL.left, 'loadout-left');

  // EVOLUTIONS (center)
  makeLabel(parent, 'EVOLUTIONS', MENU_COL.center, MENU_HEADER_Y, { fontSize: 46, color: '#ffdd00', glyphSize: MENU_GLYPH_HEADER });
  const evoList = new THREE.Group();
  evoList.position.set(MENU_COL.center, MENU_LIST_TOP, 0.01);
  parent.add(evoList);
  const evoEntries = Object.entries(WEAPON_EVOLUTIONS);
  evoEntries.forEach(([weaponId, evo], i) => {
    const row = new THREE.Group();
    row.position.set(0, -i * MENU_ROW_H, 0);
    evoList.add(row);
    makeButton(row, evo.name.toUpperCase(), { type: 'evolve', weaponId, evoId: evo.id }, 0, 0, {
      w: 1.0, h: MENU_BTN_H, color: evo.sigColor || 0xffdd00, fontSize: 36, glyphSize: MENU_GLYPH_BTN,
    });
  });
  evoList.userData.maxRows = Math.max(0, evoEntries.length - MENU_VISIBLE_ROWS);
  evoList.userData.scrollKey = 'loadout-evo';
  evoList.userData.baseY = MENU_LIST_TOP;
  evoList.userData.rowH = MENU_ROW_H;
  applyListWindow(evoList);

  // RIGHT BLASTER
  makeLabel(parent, 'RIGHT BLASTER', MENU_COL.right, MENU_HEADER_Y, { fontSize: 46, color: '#00ffff', glyphSize: MENU_GLYPH_HEADER });
  buildUpgradeColumn(parent, 'right', MENU_COL.right, 'loadout-right');

  // Separator so the action bar reads as chrome, not as another list row
  const divider = new THREE.Mesh(
    new THREE.PlaneGeometry(MENU_PANEL.w - 0.5, 0.008),
    new THREE.MeshBasicMaterial({ color: 0x2a3350, side: THREE.DoubleSide, depthTest: true })
  );
  divider.position.set(0, -0.735, 0.015);
  divider.renderOrder = MENU_TEXT_RO;
  parent.add(divider);

  // Bottom action bar
  makeButton(parent, 'RESET', { type: 'reset_loadout' }, MENU_COL.left, -0.9, {
    w: 1.0, h: 0.26, color: 0xff8844, fontSize: 40, glyphSize: MENU_GLYPH_BTN,
  });
  makeButton(parent, '← COMBAT', { type: 'goto_combat' }, MENU_COL.center, -0.9, {
    w: 1.0, h: 0.26, color: 0x44aaff, fontSize: 40, glyphSize: MENU_GLYPH_BTN,
  });
  makeButton(parent, 'EXIT TRAINING', { type: 'exit_training' }, MENU_COL.right, -0.9, {
    w: 1.0, h: 0.26, color: 0xff4444, fontSize: 40, glyphSize: MENU_GLYPH_BTN,
  });
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
  //
  // AA fix (feedback: the far grid shimmered / looked harsh): the old shader
  // used hard `step()` lines, so once a line got thinner than one pixel it
  // aliased into moiré. Lines are now drawn analytically with `fwidth()` —
  // the line keeps a constant ~1-2px width in screen space and fades out
  // instead of snapping — and the grid is faded to the void well before the
  // horizon so nothing sharp is left at distance.
  const gridVertexShader = `
      varying vec3 vWorldPos;
      void main() {
        vWorldPos = (modelMatrix * vec4(position, 1.0)).xyz;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `;
  const gridFragmentShader = `
      uniform vec3 uColor;
      uniform vec3 uPulseA;
      uniform vec3 uPulseB;
      uniform float uTime;
      uniform vec3 uFogColor;
      uniform float uFadeStart;
      uniform float uFadeEnd;
      uniform float uLinePx;
      uniform float uAlpha;
      varying vec3 vWorldPos;

      // Analytic anti-aliased grid line: 0 between lines, 1 on a line.
      // fwidth() = world units per pixel, so widthPx is a real screen-space
      // width — the line stays visible-but-soft at distance instead of
      // alias-snapping on and off.
      float gridLine(float coord, float spacing, float widthPx) {
        float scaled = coord / spacing;
        float distPx = abs(fract(scaled - 0.5) - 0.5) / max(fwidth(scaled), 1e-5);
        return 1.0 - smoothstep(0.0, widthPx, distPx);
      }

      void main() {
        // Fine lines (every 2m) + bold lines (every 10m)
        float fine = max(gridLine(vWorldPos.x, 2.0, uLinePx),
                         gridLine(vWorldPos.z, 2.0, uLinePx));
        float bold = max(gridLine(vWorldPos.x, 10.0, uLinePx * 1.8),
                         gridLine(vWorldPos.z, 10.0, uLinePx * 1.8));
        float grid = clamp(fine * 0.75 + bold, 0.0, 1.0);
        // Digital green pulse: lines breathe lime ↔ forest green, with a
        // ripple radiating outward from the player.
        float wave = 0.5 + 0.5 * sin(uTime * 1.8);
        vec3 pulseColor = mix(uPulseA, uPulseB, wave);
        vec3 col = mix(uColor, pulseColor, 0.7);
        float dist = length(vWorldPos.xz);
        float ripple = 0.75 + 0.25 * sin(uTime * 2.2 - dist * 0.35);
        col *= ripple;
        // Distance fade → black void (the "endless" look). Soft 2-stop fade:
        // lines thin, dim, then vanish long before the plane's 200m edge.
        float fade = 1.0 - smoothstep(uFadeStart, uFadeEnd, dist);
        fade *= fade; // ease-out so the horizon melts instead of clipping
        // Blend the whole field into the fog colour (same as the scene
        // background) so the plane's edge is invisible in every direction.
        vec3 outCol = mix(uFogColor, col * grid, fade);
        gl_FragColor = vec4(outCol, uAlpha * fade);
      }
    `;
  // Grid fade distances (metres from the arena centre). The floor is fully
  // faded by 62m — aliasing from the huge plane never reaches the player.
  const FLOOR_FADE_START = 14;
  const FLOOR_FADE_END = 62;
  // The wall dome is 180m out, so it gets a longer leash; it only ever shows
  // as a faint horizon haze.
  const WALL_FADE_START = 40;
  const WALL_FADE_END = 170;

  // Each mesh needs its OWN uniforms object — spreading a shared `uniforms`
  // reference made the floor and wall fight over the same uniform values.
  const makeGridMaterial = (opts) => new THREE.ShaderMaterial({
    uniforms: {
      uColor: { value: new THREE.Color(0x44ff88) },
      uPulseA: { value: new THREE.Color(0x88ff44) },   // lime
      uPulseB: { value: new THREE.Color(0x1a5c1a) },   // dark forest green
      uTime: { value: 0 },
      uFogColor: { value: new THREE.Color(0x02060c) },
      uFadeStart: { value: opts.fadeStart },
      uFadeEnd: { value: opts.fadeEnd },
      uLinePx: { value: opts.linePx ?? 1.25 },
      uAlpha: { value: opts.alpha ?? 1 },
    },
    vertexShader: gridVertexShader,
    fragmentShader: gridFragmentShader,
    fog: false,
    ...opts.rest,
  });

  // Floor — OPAQUE on purpose: a transparent 400m plane would sort against
  // every other transparent object in the scene (glow pools, sprites) and
  // cause draw-order popping. The RGB fade to uFogColor already melts the
  // horizon into the background.
  const floorGeo = new THREE.PlaneGeometry(400, 400);
  const floorMat = makeGridMaterial({
    fadeStart: FLOOR_FADE_START,
    fadeEnd: FLOOR_FADE_END,
    alpha: 1,
    rest: {
      side: THREE.DoubleSide,
      depthWrite: true,
      depthTest: true,
      transparent: false,
    },
  });
  const floor = new THREE.Mesh(floorGeo, floorMat);
  floor.rotation.x = -Math.PI / 2;
  floor.name = 'holodeck-floor';
  group.add(floor);

  // Far "walls" as a grid dome (BackSide sphere with the grid shader) —
  // a faint grid horizon so the room feels enclosed like a holodeck.
  const wallGeo = new THREE.SphereGeometry(180, 24, 12);
  const wallMat = makeGridMaterial({
    fadeStart: WALL_FADE_START,
    fadeEnd: WALL_FADE_END,
    linePx: 1.1,
    alpha: 0.9,
    rest: {
      side: THREE.BackSide,
      depthWrite: false,
      depthTest: true,
      transparent: true,
    },
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

/**
 * Raycast the training menu buttons.
 * Returns { action, distance, point } for the closest button, or null.
 * `distance` lets the caller stop the pointer beam on the button face.
 */
export function raycastTrainingMenu(raycaster) {
  if (!_menuOpen || !_menuGroup || !raycaster || _menuTargets.length === 0) return null;
  const hits = raycaster.intersectObjects(_menuTargets, false);
  for (const hit of hits) {
    const action = hit.object.userData.trainingAction;
    if (action) {
      return { action, object: hit.object, distance: hit.distance, point: hit.point };
    }
  }
  return null;
}

/** Raycast the training menu buttons. Returns the action payload or null. */
export function getTrainingMenuHit(raycaster) {
  const r = raycastTrainingMenu(raycaster);
  return r ? r.action : null;
}

/**
 * Hover pass for the training menu (scale + border brighten).
 * Accepts one raycaster or an array of them (one per controller) and
 * highlights the closest button any pointer is touching.
 */
export function updateTrainingHover(raycasters) {
  if (!_menuOpen || !_menuGroup) return;
  const list = Array.isArray(raycasters) ? raycasters : [raycasters];
  let hovered = null;
  let hoveredDist = Infinity;
  for (const rc of list) {
    if (!rc) continue;
    const hit = raycastTrainingMenu(rc);
    if (hit && hit.distance < hoveredDist) {
      hoveredDist = hit.distance;
      hovered = hit.object;
    }
  }

  if (hovered && hovered !== _hoveredButton && _hasDep('playMenuHoverSound')) {
    _deps.playMenuHoverSound();
  }
  _hoveredButton = hovered;

  _menuTargets.forEach(btn => {
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

    case 'add_upgrade_hand': {
      // Per-hand upgrade (player feedback): each blaster gets its own set of
      // upgrade buttons with a live digital counter of how many it owns.
      const def = getUpgradeDef(action.id);
      if (!def) return true;
      const hand = action.hand === 'right' ? 'right' : 'left';
      addUpgrade(def.id, hand);
      if (_hasDep('recomputeSynergies')) _deps.recomputeSynergies();
      rebuildMenu();
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
  // FIXED front arc for the session (captured at startTraining) — 150° wide
  // like the main game. Head-turn-relative spawning is deliberately avoided:
  // targets must never appear behind you.
  const angle = (Math.random() - 0.5) * (150 * Math.PI / 180);
  const dist = 10 + Math.random() * 6;
  _trainSpawnFwd.copy(_trainForward);
  _trainSpawnRight.crossVectors(_trainSpawnFwd, _WORLD_UP).normalize();
  const sin = Math.sin(angle) * dist;
  const cos = Math.cos(angle) * dist;
  const pos = new THREE.Vector3(
    cam.position.x + _trainSpawnFwd.x * cos + _trainSpawnRight.x * sin,
    cam.position.y + 0.1,
    cam.position.z + _trainSpawnFwd.z * cos + _trainSpawnRight.z * sin,
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
    // Thumbstick Y. Meta Quest reports the stick on axes[3]; other mappings
    // (and the desktop test rig) use axes[1] — take whichever is pushed.
    const y1 = Math.abs(gp.axes[1] ?? 0) > 0.25 ? (gp.axes[1] ?? 0) : 0;
    const y3 = gp.axes.length > 3 && Math.abs(gp.axes[3] ?? 0) > 0.25 ? (gp.axes[3] ?? 0) : 0;
    const y = Math.abs(y1) > Math.abs(y3) ? y1 : y3;
    if (y !== 0 && Math.abs(y) > Math.abs(axis)) axis = y;
  });
  if (axis !== 0) {
    // 0.05/frame → one row per ~0.3s on a held stick at 72fps
    _scrollAccum += axis * 0.05;
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
    if (max <= 0) { applyListWindow(list); return; }
    const baseY = list.userData.baseY ?? 0.34;
    const rowH = list.userData.rowH ?? MENU_ROW_H;
    let scroll = list.userData._scroll || 0;
    scroll = Math.max(0, Math.min(max, scroll + (delta > 0 ? 1 : -1)));
    list.userData._scroll = scroll;
    list.position.y = baseY + scroll * rowH;
    applyListWindow(list);
  });
}

/**
 * Show only the rows inside the visible band.
 * Without this the 13-enemy list kept drawing rows 6-13 BELOW the panel and
 * over the floor (player report: "the menu goes into the floor"). No clipping
 * planes — just visibility per row, applied only when the window changes.
 */
function applyListWindow(list) {
  const scroll = list.userData._scroll || 0;
  const visible = list.userData.visibleRows || MENU_VISIBLE_ROWS;
  const rows = list.children;
  for (let i = 0; i < rows.length; i++) {
    const slot = i - scroll;
    rows[i].visible = slot >= 0 && slot < visible;
  }
}

/** Per-frame menu pulse + wave release (called from main.js while training). */
export function updateTrainingMenu(now, dt) {
  updateHolodeck(now);
  // The menu PAUSES the wave: no releases while it's open (player feedback —
  // opening the menu mid-fight should freeze the action).
  if (!_menuOpen) updateWaveRelease(dt);
}

// Test seam: expose wave size for automation.
export function getTrainingWaveSize() {
  return _waveSize;
}

