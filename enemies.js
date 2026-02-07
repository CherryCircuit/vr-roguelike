// ============================================================
//  ENEMY SYSTEM
//  Voxel enemies: spawning, movement, damage, death explosions.
// ============================================================

import * as THREE from 'three';

// ── Voxel patterns (Space-Invaders-inspired, 3D) ──────────
// Each row is a string: '1' = voxel, '.' = empty
const PATTERNS = {
  basic: [
    '..1.....1..',
    '...1...1...',
    '..1111111..',
    '.11.111.11.',
    '11111111111',
    '1.1111111.1',
    '1.1.....1.1',
    '...11.11...',
  ],
  fast: [
    '.1.',
    '111',
    '.1.',
    '1.1',
  ],
  tank: [
    '.1111.',
    '111111',
    '11..11',
    '11..11',
    '111111',
    '.1111.',
  ],
  swarm: [
    '11',
    '11',
  ],
};

function parsePattern(strings) {
  return strings.map(row => row.split('').map(c => (c === '1' ? 1 : 0)));
}

// ── Enemy type stats ───────────────────────────────────────
const ENEMY_DEFS = {
  basic: { pattern: parsePattern(PATTERNS.basic), voxelSize: 0.055, baseHp: 30, baseSpeed: 1.5, color: 0x00ff88, depth: 2, scoreValue: 10 },
  fast:  { pattern: parsePattern(PATTERNS.fast),  voxelSize: 0.07,  baseHp: 15, baseSpeed: 3.0, color: 0xffff00, depth: 2, scoreValue: 15 },
  tank:  { pattern: parsePattern(PATTERNS.tank),  voxelSize: 0.09,  baseHp: 80, baseSpeed: 0.8, color: 0x4488ff, depth: 3, scoreValue: 25 },
  swarm: { pattern: parsePattern(PATTERNS.swarm), voxelSize: 0.05,  baseHp: 10, baseSpeed: 3.5, color: 0xff8800, depth: 1, scoreValue: 5  },
};

// ── Module state ───────────────────────────────────────────
let sceneRef = null;
const activeEnemies = [];
const explosionParts = [];

// Shared cube geometry (reused across all voxel cubes)
const sharedGeos = {};
function getGeo(size) {
  const key = size.toFixed(4);
  if (!sharedGeos[key]) {
    sharedGeos[key] = new THREE.BoxGeometry(size * 0.92, size * 0.92, size * 0.92);
  }
  return sharedGeos[key];
}

// Temp vectors (avoid allocation in hot loops)
const _dir  = new THREE.Vector3();
const _look = new THREE.Vector3();

// ── Public API ─────────────────────────────────────────────

export function initEnemies(scene) {
  sceneRef = scene;
}

/**
 * Spawn a single enemy of the given type at `position`.
 * `levelConfig` from game.js provides HP/speed multipliers.
 */
export function spawnEnemy(type, position, levelConfig) {
  const def = ENEMY_DEFS[type];
  if (!def) return;

  const material = new THREE.MeshBasicMaterial({
    color: def.color,
    transparent: true,
    opacity: 0.7,
  });

  const group = new THREE.Group();
  const geo   = getGeo(def.voxelSize);
  const rows  = def.pattern.length;
  const cols  = def.pattern[0].length;
  const cx    = (cols - 1) / 2;
  const cy    = (rows - 1) / 2;

  for (let d = 0; d < def.depth; d++) {
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        if (def.pattern[r][c]) {
          const cube = new THREE.Mesh(geo, material);
          cube.position.set(
            (c - cx) * def.voxelSize,
            (cy - r) * def.voxelSize,
            d * def.voxelSize,
          );
          group.add(cube);
        }
      }
    }
  }

  group.position.copy(position);
  group.userData.isEnemy = true;

  const enemy = {
    mesh:      group,
    material,
    type,
    hp:        Math.round(def.baseHp * levelConfig.hpMultiplier),
    maxHp:     Math.round(def.baseHp * levelConfig.hpMultiplier),
    speed:     def.baseSpeed * levelConfig.speedMultiplier,
    baseColor: new THREE.Color(def.color),
    scoreValue: def.scoreValue,
    statusEffects: {
      fire:   { stacks: 0, remaining: 0, tickTimer: 0 },
      shock:  { stacks: 0, remaining: 0, tickTimer: 0 },
      freeze: { stacks: 0, remaining: 0 },
    },
  };

  activeEnemies.push(enemy);
  sceneRef.add(group);
  return enemy;
}

/**
 * Move enemies, check collisions, apply DoT.
 * Returns array of enemy indices that reached the player.
 */
export function updateEnemies(dt, now, playerPos) {
  const collisions = [];

  for (let i = activeEnemies.length - 1; i >= 0; i--) {
    const e = activeEnemies[i];

    // ── Movement toward player ──
    _dir.copy(playerPos).sub(e.mesh.position);
    const dist = _dir.length();
    if (dist > 0.01) _dir.divideScalar(dist); // normalize

    let speedMod = 1;
    const se = e.statusEffects;
    if (se.shock.stacks > 0)  speedMod *= Math.max(0.3, 1 - se.shock.stacks * 0.15);
    if (se.freeze.stacks > 0) speedMod *= Math.max(0.1, 1 - se.freeze.stacks * 0.2);

    e.mesh.position.addScaledVector(_dir, e.speed * speedMod * dt);

    // Face player (horizontal only)
    _look.set(playerPos.x, e.mesh.position.y, playerPos.z);
    e.mesh.lookAt(_look);

    // ── Collision with player ──
    if (dist < 0.9) {
      collisions.push(i);
      continue;
    }

    // ── Status effect ticking ──
    updateStatusEffects(e, dt);

    // ── Colour: lerp from base → red based on damage ──
    const dmgRatio = 1 - e.hp / e.maxHp;
    e.material.color.copy(e.baseColor).lerp(_redColor, dmgRatio);
  }

  return collisions;
}

const _redColor = new THREE.Color(0xff0000);

function updateStatusEffects(e, dt) {
  const se = e.statusEffects;

  // Fire DoT
  if (se.fire.remaining > 0) {
    se.fire.remaining -= dt;
    se.fire.tickTimer -= dt;
    if (se.fire.tickTimer <= 0) {
      se.fire.tickTimer = 0.5;
      const fireDmg = se.fire.stacks * 3;
      e.hp -= fireDmg;
      if (e.hp <= 0) e.hp = 0;
      // Store last DoT info for damage numbers
      e._lastDoT = { type: 'fire', damage: fireDmg };
    }
    if (se.fire.remaining <= 0) { se.fire.stacks = 0; se.fire.tickTimer = 0; }
  }

  // Shock DoT
  if (se.shock.remaining > 0) {
    se.shock.remaining -= dt;
    se.shock.tickTimer -= dt;
    if (se.shock.tickTimer <= 0) {
      se.shock.tickTimer = 0.5;
      const shockDmg = se.shock.stacks * 2;
      e.hp -= shockDmg;
      if (e.hp <= 0) e.hp = 0;
      e._lastDoT = { type: 'shock', damage: shockDmg };
    }
    if (se.shock.remaining <= 0) { se.shock.stacks = 0; se.shock.tickTimer = 0; }
  }

  // Freeze (slow only, no DoT — just tick down duration)
  if (se.freeze.remaining > 0) {
    se.freeze.remaining -= dt;
    if (se.freeze.remaining <= 0) se.freeze.stacks = 0;
  }
}

/**
 * Apply status effects to an enemy.
 */
export function applyEffects(enemyIndex, effects) {
  const e = activeEnemies[enemyIndex];
  if (!e) return;

  effects.forEach(({ type, stacks }) => {
    const se = e.statusEffects[type];
    if (!se) return;
    se.stacks = Math.max(se.stacks, stacks);
    se.remaining = 2 + stacks * 0.5;
  });
}

/**
 * Deal damage to an enemy. Returns { killed, enemy, overkill }.
 */
export function hitEnemy(index, damage) {
  const e = activeEnemies[index];
  if (!e) return { killed: false };

  e.hp -= damage;
  if (e.hp <= 0) {
    return { killed: true, enemy: e, overkill: -e.hp };
  }
  return { killed: false, enemy: e };
}

/**
 * Destroy enemy at `index` — remove from scene, spawn explosion.
 */
export function destroyEnemy(index) {
  const e = activeEnemies[index];
  if (!e) return null;

  const pos = e.mesh.position.clone();
  const color = e.baseColor.clone();

  // Spawn simple particle explosion (reduced count for performance)
  const particleCount = 8;
  for (let i = 0; i < particleCount; i++) {
    const size = 0.05 + Math.random() * 0.05;
    const partMesh = new THREE.Mesh(
      new THREE.BoxGeometry(size, size, size),
      new THREE.MeshBasicMaterial({
        color: Math.random() > 0.5 ? 0xff00ff : 0x00ffff,
        transparent: true,
        opacity: 1,
      }),
    );
    partMesh.position.copy(pos);
    partMesh.userData.velocity = new THREE.Vector3(
      (Math.random() - 0.5) * 6,
      (Math.random() - 0.5) * 6,
      (Math.random() - 0.5) * 6,
    );
    partMesh.userData.createdAt = performance.now();
    partMesh.userData.lifetime  = 400 + Math.random() * 300;

    sceneRef.add(partMesh);
    explosionParts.push(partMesh);
  }

  // Remove enemy mesh from scene
  sceneRef.remove(e.mesh);
  // Dispose material
  e.material.dispose();
  activeEnemies.splice(index, 1);

  return { position: pos, scoreValue: e.scoreValue, baseColor: color };
}

/**
 * Remove all enemies (for level transitions).
 */
export function clearAllEnemies() {
  for (let i = activeEnemies.length - 1; i >= 0; i--) {
    sceneRef.remove(activeEnemies[i].mesh);
    activeEnemies[i].material.dispose();
  }
  activeEnemies.length = 0;
}

/**
 * Animate and clean up explosion particles.
 */
export function updateExplosions(dt, now) {
  for (let i = explosionParts.length - 1; i >= 0; i--) {
    const p   = explosionParts[i];
    const age = now - p.userData.createdAt;

    if (age > p.userData.lifetime) {
      sceneRef.remove(p);
      p.geometry.dispose();
      p.material.dispose();
      explosionParts.splice(i, 1);
    } else {
      p.position.addScaledVector(p.userData.velocity, dt);
      p.userData.velocity.multiplyScalar(1 - 3 * dt); // drag
      p.material.opacity = 1 - age / p.userData.lifetime;
      p.rotation.x += 4 * dt;
      p.rotation.z += 4 * dt;
    }
  }
}

/** Return all enemy mesh groups (for raycasting). */
export function getEnemyMeshes() {
  return activeEnemies.map(e => e.mesh);
}

/** Find which enemy a raycasted mesh belongs to. */
export function getEnemyByMesh(mesh) {
  let obj = mesh;
  while (obj && !obj.userData.isEnemy) obj = obj.parent;
  if (!obj || !obj.userData.isEnemy) return null;
  const idx = activeEnemies.findIndex(e => e.mesh === obj);
  return idx >= 0 ? { index: idx, enemy: activeEnemies[idx] } : null;
}

/** Get number of active enemies. */
export function getEnemyCount() {
  return activeEnemies.length;
}

/** Get active enemies array (read-only intent). */
export function getEnemies() {
  return activeEnemies;
}

/**
 * Get a random spawn position in a 160° cone in front of the player.
 */
export function getSpawnPosition(airSpawns) {
  const angle    = (Math.random() - 0.5) * (160 * Math.PI / 180);
  const distance = 18 + Math.random() * 7;

  const x = Math.sin(angle) * distance;
  const z = -Math.cos(angle) * distance;
  let   y = 1.5;

  if (airSpawns) {
    y = 0.5 + Math.random() * 2.5;
  }

  return new THREE.Vector3(x, y, z);
}
