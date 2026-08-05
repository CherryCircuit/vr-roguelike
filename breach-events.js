// ============================================================
//  BREACH EVENTS (Issue #138)
//  Mid-level environmental hazards: ~40% of levels after level 3
//  trigger one dramatic arena event (never on boss levels, never
//  stacked, min 10s into the level). Each event is telegraphed for
//  3s, active 8-15s, then decays.
//
//  Events (5 starters):
//  - solar_flare: a quarter-arena zone burns player AND enemies (2 DPS)
//  - gravity_inversion: enemies float upward (player unaffected)
//  - asteroid_rain: 5-8 impacts deal 50 AoE in 2m (player + enemies)
//  - dimensional_rift: a center portal pulls enemies/player and spawns
//    3 weak "rift echo" enemies
//  - emp_wave: weapons disabled for the duration (dodge-and-survive)
//
//  DI pattern (AGENTS.md §17): initBreachEvents(deps) from main.js.
//  Seeded determinism: the event for a level is derived from the run
//  seed + level number (same seed → same breaches).
// ============================================================

import * as THREE from 'three';

const DEBUG = false;
const _log = DEBUG ? console.log.bind(console) : () => {};

const WARNING_DURATION = 3000;
const DECAY_DURATION = 2000;

// Event configs: min level, active duration
const BREACH_EVENTS = {
  solar_flare: { minLevel: 3, duration: 8000, name: 'SOLAR FLARE INCOMING', color: '#ff8800' },
  gravity_inversion: { minLevel: 6, duration: 10000, name: 'GRAVITY INVERTED', color: '#4488ff' },
  asteroid_rain: { minLevel: 8, duration: 12000, name: 'ASTEROID RAIN', color: '#ff6644' },
  dimensional_rift: { minLevel: 10, duration: 15000, name: 'DIMENSIONAL RIFT', color: '#aa44ff' },
  emp_wave: { minLevel: 13, duration: 10000, name: 'EMP WAVE', color: '#44ccff' },
};

let _deps = null;
let _event = null;          // current event state or null
let _phase = 'idle';        // idle | warning | active | decay
let _phaseTimer = 0;
let _breachDone = false;    // one per level
let _flareZone = null;      // { center, radius }
let _flareBurnTimer = 0;
let _asteroids = [];        // { position, impactAt, done }
let _asteroidTimer = 0;
let _rift = null;           // { mesh, pullTimer }
let _riftEchoesSpawned = false;
let _empActive = false;

const _flareGeo = null;
let _flareZoneMesh = null;

function _hasDep(name) {
  return !!(_deps && typeof _deps[name] === 'function');
}

/**
 * Wire breach-event deps. Called once from main.js init.
 * deps: { scene, getEnemies, getBoss, getPlayerPos, applyPlayerDamage,
 *         hitEnemy, spawnEnemy, showFloatingMessage, getLevelSeed }
 */
export function initBreachEvents(deps) {
  _deps = deps || null;
  _event = null;
  _phase = 'idle';
  _breachDone = false;
  _asteroids = [];
  _rift = null;
  _empActive = false;
  if (_flareZoneMesh && _flareZoneMesh.parent) _flareZoneMesh.parent.remove(_flareZoneMesh);
  _flareZoneMesh = null;
  _log('[breach] system initialized');
}

/**
 * Deterministic per-level event selection (seed + level hash).
 * Returns the event id for the level, or null when none triggers.
 */
export function getBreachEventForLevel(seed, level) {
  if (level <= 3) return null;
  // ~40% trigger chance, seeded
  let h = 0;
  const s = String(seed ?? 1) + ':' + level;
  for (let i = 0; i < s.length; i++) {
    h = (h * 31 + s.charCodeAt(i)) >>> 0;
  }
  if (h % 100 >= 40) return null;
  // Pick from events unlocked at this level (seeded pick)
  const unlocked = Object.keys(BREACH_EVENTS).filter(id => BREACH_EVENTS[id].minLevel <= level);
  return unlocked[(h >> 8) % unlocked.length];
}

/**
 * Start the warning phase for the level's breach (called by main.js at
 * level start when getBreachEventForLevel returned an id). Returns true
 * when a breach was scheduled.
 */
export function startBreachEvent(seed, level) {
  if (_breachDone || _event) return false;
  const id = getBreachEventForLevel(seed, level);
  if (!id) return false;
  const cfg = BREACH_EVENTS[id];
  _event = { id, name: cfg.name, color: cfg.color, duration: cfg.duration };
  _phase = 'warning';
  _phaseTimer = WARNING_DURATION;
  _breachDone = true;
  if (_hasDep('showFloatingMessage')) {
    _deps.showFloatingMessage(`⚠ ${cfg.name}`, {
      duration: WARNING_DURATION, color: cfg.color, glowColor: cfg.color,
      fontSize: 56, scale: 0.5, offsetY: 0.75,
    });
  }
  _log(`[breach] ${id} warning`);
  return true;
}

/** True while an EMP breach is active (fire gates in main.js). */
export function isBreachEmpActive() {
  return _empActive;
}

/** Test seams: current phase ('idle'|'warning'|'active'|'decay') + event id. */
export function getBreachPhase() {
  return _phase;
}
export function getBreachEventId() {
  return _event ? _event.id : null;
}

/** Test seam: force an event straight into its ACTIVE phase (deterministic). */
export function forceBreachForTest(id) {
  resetBreachState();
  _event = { id, name: BREACH_EVENTS[id]?.name || id, color: BREACH_EVENTS[id]?.color || '#ffffff', duration: BREACH_EVENTS[id]?.duration || 10000 };
  _phase = 'warning';
  _phaseTimer = 10; // skip the 3s warning almost instantly
}

/** Reset per-level state (called on level start). */
export function resetBreachState() {
  _event = null;
  _phase = 'idle';
  _phaseTimer = 0;
  _breachDone = false;
  _empActive = false;
  _asteroids = [];
  _rift = null;
  _riftEchoesSpawned = false;
  for (const ast of _asteroids) {
    if (ast.marker && ast.marker.parent) ast.marker.parent.remove(ast.marker);
  }
  _asteroids = [];
  if (_rift?.mesh?.parent) _rift.mesh.parent.remove(_rift.mesh);
  _rift = null;
  if (_flareZoneMesh && _flareZoneMesh.parent) _flareZoneMesh.parent.remove(_flareZoneMesh);
  _flareZoneMesh = null;
}

function _ensureFlareZoneMesh() {
  if (_flareZoneMesh) return;
  const geo = new THREE.CircleGeometry(6, 40);
  geo.rotateX(-Math.PI / 2);
  _flareZoneMesh = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({
    color: 0xff8800, transparent: true, opacity: 0.25, depthWrite: false,
    blending: THREE.AdditiveBlending, fog: false,
  }));
  _flareZoneMesh.position.y = 0.06;
  _deps.scene.add(_flareZoneMesh);
}

// ── Event start (warning → active) ──

function _activateEvent() {
  if (!_event) return;
  const id = _event.id;
  if (id === 'solar_flare') {
    // Quarter of the arena: random 120° sector, radius 10
    const angle = Math.random() * Math.PI * 2;
    const center = new THREE.Vector3(Math.cos(angle) * 7, 0, Math.sin(angle) * 7);
    _flareZone = { center, radius: 6 };
    _ensureFlareZoneMesh();
    _flareZoneMesh.position.set(center.x, 0.06, center.z);
    _flareZoneMesh.material.opacity = 0.35;
  } else if (id === 'gravity_inversion') {
    // Enemies float upward for the duration (checked per frame)
  } else if (id === 'asteroid_rain') {
    const count = 5 + Math.floor(Math.random() * 4); // 5-8
    const playerPos = _hasDep('getPlayerPos') ? _deps.getPlayerPos() : new THREE.Vector3();
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const dist = 5 + Math.random() * 8;
      _asteroids.push({
        position: new THREE.Vector3(playerPos.x + Math.cos(angle) * dist, 0, playerPos.z + Math.sin(angle) * dist),
        impactAt: performance.now() + 1500 + i * 1200,
        done: false,
      });
    }
    _asteroidTimer = 0;
  } else if (id === 'dimensional_rift') {
    const playerPos = _hasDep('getPlayerPos') ? _deps.getPlayerPos() : new THREE.Vector3();
    const geo = new THREE.RingGeometry(0.7, 1.3, 32);
    _rift = {
      mesh: new THREE.Mesh(geo, new THREE.MeshBasicMaterial({
        color: 0xaa44ff, transparent: true, opacity: 0.7, side: THREE.DoubleSide,
        depthWrite: false, blending: THREE.AdditiveBlending, fog: false,
      })),
      position: new THREE.Vector3(playerPos.x, 0.1, playerPos.z - 5),
    };
    _rift.mesh.rotation.x = -Math.PI / 2;
    _rift.mesh.position.copy(_rift.position);
    _deps.scene.add(_rift.mesh);
    _riftEchoesSpawned = false;
  } else if (id === 'emp_wave') {
    _empActive = true;
  }
  _phase = 'active';
  _phaseTimer = _event.duration;
  _log(`[breach] ${id} active`);
}

function _deactivateEvent() {
  if (_event?.id === 'emp_wave') _empActive = false;
  if (_flareZoneMesh) _flareZoneMesh.material.opacity = 0;
  _flareZone = null;
  if (_rift?.mesh?.parent) _rift.mesh.parent.remove(_rift.mesh);
  _rift = null;
  _event = null;
  _phase = 'idle';
}

// ── Per-frame update (main.js PLAYING branch) ──

export function updateBreachEvents(dt, now) {
  if (!_event) return;

  if (_phase === 'warning') {
    _phaseTimer -= dt * 1000;
    if (_phaseTimer <= 0) _activateEvent();
    return;
  }

  if (_phase === 'active') {
    _phaseTimer -= dt * 1000;

    const id = _event.id;
    if (id === 'solar_flare' && _flareZone) {
      // Burn everything in the zone: 2 DPS
      _flareBurnTimer += dt;
      if (_flareBurnTimer >= 0.5) {
        _flareBurnTimer = 0;
        const playerPos = _hasDep('getPlayerPos') ? _deps.getPlayerPos() : new THREE.Vector3();
        if (playerPos.distanceTo(_flareZone.center) < _flareZone.radius && _hasDep('applyPlayerDamage')) {
          _deps.applyPlayerDamage(1);
        }
        if (_hasDep('getEnemies')) {
          const enemies = _deps.getEnemies();
          for (let i = 0; i < enemies.length; i++) {
            const e = enemies[i];
            if (!e?.mesh || e.hp <= 0) continue;
            if (e.mesh.position.distanceTo(_flareZone.center) < _flareZone.radius) {
              e.hp = Math.max(0, e.hp - 1);
            }
          }
        }
      }
    } else if (id === 'gravity_inversion' && _hasDep('getEnemies')) {
      // Enemies float upward 0.5 m/s
      const enemies = _deps.getEnemies();
      for (let i = 0; i < enemies.length; i++) {
        const e = enemies[i];
        if (!e?.mesh || e.hp <= 0 || e._bossSummoned) continue;
        e.mesh.position.y += 0.5 * dt;
      }
    } else if (id === 'asteroid_rain') {
      // Impacts: 50 AoE in 2m (player + enemies)
      for (const ast of _asteroids) {
        if (ast.done || now < ast.impactAt) continue;
        ast.done = true;
        const playerPos = _hasDep('getPlayerPos') ? _deps.getPlayerPos() : new THREE.Vector3();
        if (playerPos.distanceTo(ast.position) < 2 && _hasDep('applyPlayerDamage')) {
          _deps.applyPlayerDamage(50);
        }
        if (_hasDep('getEnemies')) {
          const enemies = _deps.getEnemies();
          for (let i = 0; i < enemies.length; i++) {
            const e = enemies[i];
            if (!e?.mesh || e.hp <= 0) continue;
            if (e.mesh.position.distanceTo(ast.position) < 2) {
              e.hp = Math.max(0, e.hp - 50);
            }
          }
        }
      }
    } else if (id === 'dimensional_rift' && _rift) {
      // Pull enemies/player toward the rift center (slow)
      const pullCenter = _rift.position;
      if (_hasDep('getEnemies')) {
        const enemies = _deps.getEnemies();
        for (let i = 0; i < enemies.length; i++) {
          const e = enemies[i];
          if (!e?.mesh || e.hp <= 0) continue;
          const dir = _riftPull.copy(pullCenter).sub(e.mesh.position);
          const d = dir.length();
          if (d < 0.001) continue;
          e.mesh.position.addScaledVector(dir.divideScalar(d), Math.min(1.5, d * 0.08) * dt);
        }
      }
      const playerPos = _hasDep('getPlayerPos') ? _deps.getPlayerPos() : new THREE.Vector3();
      const pdir = _riftPull.copy(pullCenter).sub(playerPos);
      const pd = pdir.length();
      if (pd > 0.001 && pd < 6) {
        // gentle pull (the player is stationary; just visuals — skip movement)
      }
      // Spawn 3 weak rift echoes once
      if (!_riftEchoesSpawned && _hasDep('spawnEnemy')) {
        _riftEchoesSpawned = true;
        for (let i = 0; i < 3; i++) {
          const pos = new THREE.Vector3(
            pullCenter.x + Math.cos(i * 2.1) * 2,
            1.4,
            pullCenter.z + Math.sin(i * 2.1) * 2,
          );
          const echo = _deps.spawnEnemy('basic', pos, { hpMultiplier: 1, speedMultiplier: 1 });
          if (echo) {
            echo.hp = 12;
            echo.maxHp = 12;
            echo._bossSummoned = true;
            echo.scoreValue = 0;
            if (echo._cachedMaterials) {
              for (const m of echo._cachedMaterials) if (m.color) m.color.setHex(0xaa44ff);
            }
          }
        }
      }
      _rift.mesh.rotation.z += dt * 3;
    }

    if (_phaseTimer <= 0) {
      _phase = 'decay';
      _phaseTimer = DECAY_DURATION;
    }
    return;
  }

  if (_phase === 'decay') {
    _phaseTimer -= dt * 1000;
    if (_phaseTimer <= 0) _deactivateEvent();
  }
}

const _riftPull = new THREE.Vector3();
