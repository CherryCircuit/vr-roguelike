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
import { makeSprite, showHUD } from './hud.js';
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

// ── Public API ──────────────────────────────────────────────

/**
 * Wire deps. Called once from main.js init.
 * deps: { scene, camera, renderer, spawnEnemy, spawnBoss, clearAllEnemies,
 *         showBossHealthBar, playMenuClick, playMenuHoverSound,
 *         clearBiomeScene, applyThemeForLevel, recomputeSynergies }
 */
export function initTrainingGround(deps) {
  _deps = deps || null;
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
  if (_hasDep('applyThemeForLevel')) _deps.applyThemeForLevel(game.level || 1);
  if (_hasDep('clearAllEnemies')) _deps.clearAllEnemies();
  _active = false;
  _log('[training-ground] exited training');
}

// ── Menu open/close ─────────────────────────────────────────

export function toggleTrainingMenu() {
  if (_menuOpen) hideTrainingMenu(); else showTrainingMenu();
}

export function showTrainingMenu() {
  if (!_active || _menuOpen) return;
  _menuOpen = true;
  _loadoutView = false;
  _enemyScroll = 0;
  _loadoutScroll = 0;
  buildTrainingMenu();
}

export function hideTrainingMenu() {
  _menuOpen = false;
  if (_menuGroup) {
    disposeMenuGroup(_menuGroup);
    if (_menuGroup.parent) _menuGroup.parent.remove(_menuGroup);
    _menuGroup = null;
  }
  _hoveredButton = null;
}

// ── Menu construction ───────────────────────────────────────

function makeButton(parent, label, action, x, y, opts = {}) {
  const w = opts.w || 1.85;
  const h = opts.h || 0.14;
  const color = opts.color ?? 0x00ff88;
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
  face.renderOrder = 2;
  face.userData.trainingAction = action;
  face.userData.borderColor = color;
  face.userData._btnGroup = group;
  group.add(face);
  const border = new THREE.LineSegments(
    new THREE.EdgesGeometry(face.geometry),
    new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.7 })
  );
  border.renderOrder = 2;
  group.add(border);
  const sprite = makeSprite(label, {
    fontSize: opts.fontSize || 24,
    color: opts.textColor || '#ffffff',
    scale: opts.textScale || 0.16,
    depthTest: true,
    forceArial: true,
    maxWidth: Math.floor(w * 120),
  });
  sprite.position.set(0, 0, 0.03);
  group.add(sprite);
  return face;
}

function makeLabel(parent, text, x, y, opts = {}) {
  const s = makeSprite(text, {
    fontSize: opts.fontSize || 30,
    color: opts.color || '#ffffff',
    glow: opts.glow !== false,
    glowColor: opts.color || '#ffffff',
    scale: opts.scale || 0.24,
    depthTest: true,
    forceArial: !!opts.forceArial,
  });
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
  group.position.set(0, baseY + 0.55, -2.9);
  _deps.scene.add(group);
  _menuGroup = group;

  const panelW = 7.0;
  const panelH = 4.0;
  const bg = new THREE.Mesh(
    new THREE.PlaneGeometry(panelW, panelH),
    new THREE.MeshBasicMaterial({ color: 0x0a0f22, transparent: true, opacity: 0.96, side: THREE.DoubleSide, depthWrite: false, depthTest: true })
  );
  bg.renderOrder = 1;
  group.add(bg);
  const border = new THREE.LineSegments(
    new THREE.EdgesGeometry(bg.geometry),
    new THREE.LineBasicMaterial({ color: 0x00ff88 })
  );
  border.renderOrder = 1;
  group.add(border);

  if (_loadoutView) {
    buildLoadoutView(group);
  } else {
    buildCombatView(group);
  }
}

function buildCombatView(group) {
  const title = makeLabel(group, 'TRAINING GROUND', 0, 1.72, { fontSize: 46, color: '#00ff88' });
  title.userData.text = 'TRAINING GROUND';
  const sub = makeLabel(group, 'SPAWN SPARRING PARTNERS — THEN TEST YOUR ARSENAL', 0, 1.38, { fontSize: 22, color: '#8899bb', scale: 0.18, forceArial: true });
  sub.userData.text = 'SPAWN SPARRING PARTNERS — THEN TEST YOUR ARSENAL';

  // ── ENEMIES column (scrollable) ──
  const enemyHeader = makeLabel(group, 'ENEMIES', -2.55, 1.08, { fontSize: 30, color: '#ff8866' });
  enemyHeader.userData.text = 'ENEMIES';
  const enemyList = new THREE.Group();
  enemyList.position.set(-2.55, 0.86, 0.01);
  group.add(enemyList);
  const ENEMY_IDS = [
    ['basic', 'DRONE'], ['fast', 'SNEAK'], ['tank', 'SENTINEL'], ['swarm', 'DART'],
    ['spiral_swimmer', 'SPIRAL SWIMMER'], ['jelly', 'STACK'], ['conductor', 'COMMANDER'],
    ['mortar', 'MORTAR'], ['bombardier', 'BOMBARDIER'], ['void_anchor', 'VOID ANCHOR'],
    ['void_tendril', 'VOID TENDRIL'], ['echo_phantom', 'ECHO PHANTOM'], ['leech', 'LEECH'],
  ];
  const visibleEnemies = 6;
  ENEMY_IDS.forEach(([id, label], i) => {
    const face = makeButton(enemyList, `${label}  (+${_waveSize})`, {
      type: 'spawn_enemy', id,
    }, 0, -i * 0.17, { w: 1.95, h: 0.15, color: 0xff8866, fontSize: 23, textScale: 0.15 });
    face.userData._row = i;
  });
  enemyList.userData.maxRows = ENEMY_IDS.length - visibleEnemies;
  enemyList.userData.scrollKey = 'enemy';

  // Scroll hints (thumbstick/wheel)
  const scrollHint = makeLabel(group, 'SCROLL: THUMBSTICK / WHEEL', -2.55, -1.15, { fontSize: 18, color: '#667799', scale: 0.14, forceArial: true });
  scrollHint.userData.text = 'SCROLL: THUMBSTICK / WHEEL';

  // ── BOSSES column ──
  const bossHeader = makeLabel(group, 'BOSSES', 2.55, 1.08, { fontSize: 30, color: '#ff88ff' });
  bossHeader.userData.text = 'BOSSES';
  const BOSS_IDS = [
    ['skull_boss', 'NECRO'], ['the_maw', 'THE MAW'], ['the_prism', 'THE PRISM'],
    ['mirror_gauntlet', 'MIRROR GAUNTLET'], ['neon_minotaur', 'BLOOD MINOTAUR'],
    ['conductor_ascendant', 'CONDUCTOR'], ['the_masquerade', 'MASQUERADE'],
    ['eclipse_engine', 'ECLIPSE ENGINE'],
  ];
  let by = 0.86;
  BOSS_IDS.forEach(([id, label]) => {
    makeButton(group, label, { type: 'spawn_boss', id }, 2.55, by, { w: 2.1, h: 0.16, color: 0xff88ff, fontSize: 24, textScale: 0.16 });
    by -= 0.19;
  });

  // ── CENTER column: wave size + actions ──
  const waveHeader = makeLabel(group, 'WAVE SIZE', 0, 1.08, { fontSize: 30, color: '#ffdd00' });
  waveHeader.userData.text = 'WAVE SIZE';
  makeButton(group, `SIZE: ${_waveSize}`, { type: 'noop' }, 0, 0.86, { w: 1.3, h: 0.22, color: 0xffdd00, fontSize: 30, textScale: 0.2 });
  makeButton(group, '+5', { type: 'wave_add', amount: 5 }, 0.72, 0.86, { w: 0.55, h: 0.22, color: 0xffdd00, fontSize: 28, textScale: 0.2 });
  makeButton(group, '+1', { type: 'wave_add', amount: 1 }, 0.72, 0.56, { w: 0.55, h: 0.2, color: 0xffdd00, fontSize: 26, textScale: 0.18 });
  makeButton(group, '-1', { type: 'wave_add', amount: -1 }, -0.72, 0.56, { w: 0.55, h: 0.2, color: 0xffdd00, fontSize: 26, textScale: 0.18 });
  makeButton(group, '-5', { type: 'wave_add', amount: -5 }, -0.72, 0.86, { w: 0.55, h: 0.22, color: 0xffdd00, fontSize: 28, textScale: 0.2 });

  makeButton(group, 'CLEAR ENEMIES', { type: 'clear_enemies' }, 0, 0.18, { w: 1.9, h: 0.2, color: 0xff6644, fontSize: 26, textScale: 0.18 });
  makeButton(group, 'LOADOUT →', { type: 'goto_loadout' }, 0, -0.12, { w: 1.9, h: 0.2, color: 0x44aaff, fontSize: 26, textScale: 0.18 });
  makeButton(group, 'EXIT TRAINING', { type: 'exit_training' }, 0, -0.45, { w: 1.9, h: 0.2, color: 0xff4444, fontSize: 26, textScale: 0.18 });

  const tip = makeLabel(group, 'TIP: CLOSE THIS MENU TO FIGHT — YOU ARE INVINCIBLE HERE', 0, -1.35, { fontSize: 18, color: '#6688aa', scale: 0.14, forceArial: true });
  tip.userData.text = 'TIP: CLOSE THIS MENU TO FIGHT — YOU ARE INVINCIBLE HERE';
}

function buildLoadoutView(group) {
  const title = makeLabel(group, 'LOADOUT — BUILD YOUR ARSENAL', 0, 1.72, { fontSize: 42, color: '#44aaff' });
  title.userData.text = 'LOADOUT — BUILD YOUR ARSENAL';

  // ── UPGRADES column (scrollable) ──
  const upHeader = makeLabel(group, 'UPGRADES (BOTH HANDS)', -2.55, 1.08, { fontSize: 28, color: '#44ffaa' });
  upHeader.userData.text = 'UPGRADES (BOTH HANDS)';
  const upList = new THREE.Group();
  upList.position.set(-2.55, 0.86, 0.01);
  group.add(upList);
  const allUpgrades = [...UPGRADE_POOL, ...SPECIAL_UPGRADE_POOL].filter((u, i, arr) => arr.findIndex(x => x.id === u.id) === i);
  allUpgrades.forEach((u, i) => {
    makeButton(upList, u.name.toUpperCase(), { type: 'add_upgrade', id: u.id }, 0, -i * 0.17, { w: 1.95, h: 0.15, color: 0x44ffaa, fontSize: 21, textScale: 0.14 });
  });
  upList.userData.maxRows = Math.max(0, allUpgrades.length - 6);
  upList.userData.scrollKey = 'loadout';

  // ── EVOLUTIONS column ──
  const evoHeader = makeLabel(group, 'EVOLUTIONS', 2.55, 1.08, { fontSize: 28, color: '#ffdd00' });
  evoHeader.userData.text = 'EVOLUTIONS';
  let ey = 0.86;
  Object.entries(WEAPON_EVOLUTIONS).forEach(([weaponId, evo]) => {
    makeButton(group, `${evo.name.toUpperCase()}`, {
      type: 'evolve', weaponId, evoId: evo.id,
    }, 2.55, ey, { w: 2.1, h: 0.18, color: evo.sigColor || 0xffdd00, fontSize: 24, textScale: 0.16 });
    const from = makeLabel(group, `from ${(evo.from || weaponId).toUpperCase()}`, 2.55, ey - 0.08, { fontSize: 16, color: '#8899bb', scale: 0.12, forceArial: true });
    from.userData.text = `from ${(evo.from || weaponId).toUpperCase()}`;
    ey -= 0.27;
  });

  // ── Actions ──
  makeButton(group, 'RESET LOADOUT', { type: 'reset_loadout' }, 0, 0.1, { w: 1.9, h: 0.2, color: 0xff8844, fontSize: 26, textScale: 0.18 });
  makeButton(group, '← COMBAT', { type: 'goto_combat' }, 0, -0.22, { w: 1.9, h: 0.2, color: 0x44aaff, fontSize: 26, textScale: 0.18 });
  makeButton(group, 'EXIT TRAINING', { type: 'exit_training' }, 0, -0.55, { w: 1.9, h: 0.2, color: 0xff4444, fontSize: 26, textScale: 0.18 });
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

  // Grid shader: glowing lines over a black void, fogged with distance.
  const gridShader = {
    uniforms: {
      uColor: { value: new THREE.Color(0x00ff88) },
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
        // Distance fade → black void (the "endless" look)
        float dist = length(vWorldPos.xz);
        float fade = 1.0 - smoothstep(20.0, 140.0, dist);
        vec3 col = uColor * grid * fade;
        col = mix(col, uFogColor, 0.4);
        gl_FragColor = vec4(col, 1.0);
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

  if (_deps.scene.background && _deps.scene.background.isColor) {
    _deps.scene.background.set(0x02060c);
  } else {
    _deps.scene.background = new THREE.Color(0x02060c);
  }
  _deps.scene.add(group);
  _holodeckGroup = group;
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

    case 'spawn_enemy': {
      spawnEnemyWave(action.id, _waveSize);
      return true;
    }

    case 'spawn_boss': {
      spawnBossInTraining(action.id);
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
  showTrainingMenu();
}

// ── Spawning ────────────────────────────────────────────────

function spawnEnemyWave(type, count) {
  if (!_hasDep('spawnEnemy')) return;
  const cfg = _trainingConfig || _deps.getLevelConfig?.() || game._levelConfig;
  const cam = _deps.camera;
  const spawnCount = Math.min(count, 30);
  for (let i = 0; i < spawnCount; i++) {
    // Ring around the player, front-biased (enemies approach from ahead)
    const angle = -Math.PI * 0.75 + Math.random() * Math.PI * 1.5;
    const dist = 9 + Math.random() * 7;
    const pos = new THREE.Vector3(
      cam.position.x + Math.sin(angle) * dist,
      cam.position.y + 0.1,
      cam.position.z - Math.cos(angle) * dist,
    );
    const e = _deps.spawnEnemy(type, pos, cfg);
    if (!e) break;
  }
  _log(`[training-ground] spawned ${spawnCount}× ${type}`);
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

/** Per-frame menu pulse (called from main.js while training is active). */
export function updateTrainingMenu(now) {
  if (!_menuOpen || !_menuGroup) return;
  // Nothing per-frame needed beyond hover — kept as a hook.
}

// Test seam: expose wave size for automation.
export function getTrainingWaveSize() {
  return _waveSize;
}
