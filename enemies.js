// ============================================================
//  ENEMY SYSTEM
//  Voxel enemies: spawning, movement, damage, death explosions.
// ============================================================

import * as THREE from 'three';

// ── Voxel patterns (simplified for performance) ───────────
const PATTERNS = {
  basic: [
    '.1.',
    '111',
    '.1.',
  ],
  fast: [
    '1',
    '1',
  ],
  tank: [
    '111',
    '111',
  ],
  swarm: [
    '1',
  ],
};

function parsePattern(strings) {
  return strings.map(row => row.split('').map(c => (c === '1' ? 1 : 0)));
}

// ── Enemy type stats ───────────────────────────────────────
const ENEMY_DEFS = {
  basic: { pattern: parsePattern(PATTERNS.basic), voxelSize: 0.12, baseHp: 30, baseSpeed: 1.5, color: 0x00ff88, depth: 1, scoreValue: 10, hitboxRadius: 0.25 },
  fast:  { pattern: parsePattern(PATTERNS.fast),  voxelSize: 0.1,  baseHp: 15, baseSpeed: 3.0, color: 0xffff00, depth: 1, scoreValue: 15, hitboxRadius: 0.2 },
  tank:  { pattern: parsePattern(PATTERNS.tank),  voxelSize: 0.15, baseHp: 80, baseSpeed: 0.8, color: 0x4488ff, depth: 1, scoreValue: 25, hitboxRadius: 0.35 },
  swarm: { pattern: parsePattern(PATTERNS.swarm), voxelSize: 0.08, baseHp: 10, baseSpeed: 3.5, color: 0xff8800, depth: 1, scoreValue: 5, hitboxRadius: 0.15 },
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

  // Add invisible sphere hitbox for better hit detection
  const hitboxGeo = new THREE.SphereGeometry(def.hitboxRadius, 8, 8);
  const hitboxMat = new THREE.MeshBasicMaterial({ visible: false });
  const hitbox = new THREE.Mesh(hitboxGeo, hitboxMat);
  hitbox.userData.isEnemyHitbox = true;
  group.add(hitbox);

  const enemy = {
    mesh:      group,
    material,
    type,
    hp:        Math.round(def.baseHp * levelConfig.hpMultiplier),
    maxHp:     Math.round(def.baseHp * levelConfig.hpMultiplier),
    speed:     def.baseSpeed * levelConfig.speedMultiplier,
    baseColor: new THREE.Color(def.color),
    scoreValue: def.scoreValue,
    hitboxRadius: def.hitboxRadius,
    alertTimer: 0,
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

  // Sprite-based explosion for performance
  const particleCount = 5;
  for (let i = 0; i < particleCount; i++) {
    const canvas = document.createElement('canvas');
    canvas.width = 16;
    canvas.height = 16;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = Math.random() > 0.5 ? '#ff00ff' : '#00ffff';
    ctx.fillRect(0, 0, 16, 16);

    const texture = new THREE.CanvasTexture(canvas);
    const spriteMat = new THREE.SpriteMaterial({ map: texture, transparent: true, opacity: 1 });
    const sprite = new THREE.Sprite(spriteMat);
    sprite.scale.set(0.1, 0.1, 1);
    sprite.position.copy(pos);

    sprite.userData.velocity = new THREE.Vector3(
      (Math.random() - 0.5) * 5,
      (Math.random() - 0.5) * 5,
      (Math.random() - 0.5) * 5,
    );
    sprite.userData.createdAt = performance.now();
    sprite.userData.lifetime  = 300 + Math.random() * 200;

    sceneRef.add(sprite);
    explosionParts.push(sprite);
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
      if (p.material.map) p.material.map.dispose();
      p.material.dispose();
      explosionParts.splice(i, 1);
    } else {
      p.position.addScaledVector(p.userData.velocity, dt);
      p.userData.velocity.multiplyScalar(1 - 3 * dt);
      p.material.opacity = 1 - age / p.userData.lifetime;
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
 * Get a random spawn position in a 100° cone in front of the player.
 */
export function getSpawnPosition(airSpawns) {
  const angle    = (Math.random() - 0.5) * (100 * Math.PI / 180);
  const distance = 18 + Math.random() * 7;

  const x = Math.sin(angle) * distance;
  const z = -Math.cos(angle) * distance;
  let   y = 1.5;

  if (airSpawns) {
    y = 0.5 + Math.random() * 2.5;
  }

  return new THREE.Vector3(x, y, z);
}

/** Get all fast enemies (for proximity alerts) */
export function getFastEnemies() {
  return activeEnemies.filter(e => e.type === 'fast');
}
