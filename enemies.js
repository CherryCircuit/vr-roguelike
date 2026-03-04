// ============================================================
//  ENEMY SYSTEM
//  Voxel enemies: spawning, movement, damage, death explosions.
// ============================================================

import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { getStasisSlowFactor } from './stasis.js';

// [Visual Overhaul] Import VFX system for voxel explosions
let spawnVoxelExplosion = null;

// Function to set VFX reference (called from main.js after initialization)
export function setVFXReference(vfxFunc) {
  spawnVoxelExplosion = vfxFunc;
}

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
  basic: { pattern: parsePattern(PATTERNS.basic), voxelSize: 0.29, baseHp: 30, baseSpeed: 1.5, color: 0x00ff88, depth: 1, scoreValue: 10, hitboxRadius: 0.6 },
  fast: { pattern: parsePattern(PATTERNS.fast), voxelSize: 0.24, baseHp: 15, baseSpeed: 3.0, color: 0xffff00, depth: 1, scoreValue: 15, hitboxRadius: 0.48, telegraphType: 'flash' },
  tank: { pattern: parsePattern(PATTERNS.tank), voxelSize: 0.36, baseHp: 80, baseSpeed: 0.8, color: 0x4488ff, depth: 1, scoreValue: 25, hitboxRadius: 0.84, telegraphType: 'scale' },
  swarm: { pattern: parsePattern(PATTERNS.swarm), voxelSize: 0.19, baseHp: 10, baseSpeed: 3.5, color: 0xff8800, depth: 1, scoreValue: 5, hitboxRadius: 0.36, telegraphType: 'twitch' },

  // ── New enemy types (v2.0) ─────────────────────────────────
  spiral_swimmer: { pattern: [[1]], voxelSize: 0.18, baseHp: 8, baseSpeed: 2.2, color: 0x00ffcc, depth: 1, scoreValue: 8, hitboxRadius: 0.3, telegraphType: 'twitch', isTrain: true, trainLength: 10 },
  geometry_shifter: { pattern: parsePattern(PATTERNS.basic), voxelSize: 0.28, baseHp: 45, baseSpeed: 1.3, color: 0xff6600, depth: 1, scoreValue: 20, hitboxRadius: 0.55, telegraphType: 'scale', shapeShift: true },
  pulse_bomber: { pattern: parsePattern(PATTERNS.basic), voxelSize: 0.32, baseHp: 55, baseSpeed: 0.6, color: 0x8800ff, depth: 1, scoreValue: 22, hitboxRadius: 0.7, telegraphType: 'glow', isRanged: true },
  clone_mimic: { pattern: parsePattern(PATTERNS.basic), voxelSize: 0.26, baseHp: 35, baseSpeed: 1.8, color: 0xff00aa, depth: 1, scoreValue: 18, hitboxRadius: 0.5, telegraphType: 'flash', isMimic: true },
  spider_walker: { pattern: parsePattern(PATTERNS.swarm), voxelSize: 0.22, baseHp: 25, baseSpeed: 2.8, color: 0xff4400, depth: 1, scoreValue: 12, hitboxRadius: 0.4, telegraphType: 'twitch', isSpider: true },

  // ── Part 2: Advanced enemies (v3.0) ─────────────────────────
  mirror_knight: {
    pattern: parsePattern([
      '111',
      '1.1',
      '111',
    ]),
    voxelSize: 0.3,
    baseHp: 65,
    baseSpeed: 1.4,
    color: 0xcccccc,
    depth: 1,
    scoreValue: 28,
    hitboxRadius: 0.65,
    telegraphType: 'flash',
    isMirror: true,
    damageReflection: 0.3,
  },
  portal_mantis: {
    pattern: parsePattern([
      '1.1',
      '111',
      '.1.',
    ]),
    voxelSize: 0.25,
    baseHp: 40,
    baseSpeed: 2.0,
    color: 0x00ffaa,
    depth: 1,
    scoreValue: 24,
    hitboxRadius: 0.5,
    telegraphType: 'twitch',
    isPortal: true,
    portalCooldown: 4.0,
  },
  blackhole_totem: {
    pattern: parsePattern([
      '.1.',
      '111',
      '.1.',
    ]),
    voxelSize: 0.35,
    baseHp: 20,
    baseSpeed: 0,
    color: 0x220033,
    depth: 1,
    scoreValue: 15,
    hitboxRadius: 0.6,
    telegraphType: 'glow',
    isBlackhole: true,
    gravityRadius: 5.0,
    gravityStrength: 2.5,
    deathExplosionDamage: 50,
  },
  conductor: {
    pattern: parsePattern([
      '1.1',
      '.1.',
      '1.1',
    ]),
    voxelSize: 0.28,
    baseHp: 50,
    baseSpeed: 1.2,
    color: 0xffcc00,
    depth: 1,
    scoreValue: 30,
    hitboxRadius: 0.55,
    telegraphType: 'scale',
    isConductor: true,
    linkRadius: 4.0,
    linkSpeedBonus: 0.4,
    linkDamageReduction: 0.3,
  },
  phase_wraith: {
    pattern: parsePattern(PATTERNS.fast),
    voxelSize: 0.22,
    baseHp: 30,
    baseSpeed: 2.5,
    color: 0x8844ff,
    depth: 1,
    scoreValue: 22,
    hitboxRadius: 0.4,
    telegraphType: 'flash',
    isPhase: true,
    phaseCycleTime: 2.0,
    invisibleDamageBonus: 2.0,
  },
};

// ── Module state ───────────────────────────────────────────
let sceneRef = null;
const activeEnemies = [];
const explosionParts = [];

// ── Mesh cache (avoid per-frame array allocation in getEnemyMeshes) ──
let _cachedEnemyMeshes = [];
let _enemyMeshesDirty = true;

function rebuildMeshCache() {
  _cachedEnemyMeshes = activeEnemies.map(e => e.mesh);
  _enemyMeshesDirty = false;
}

// Shared cube geometry (reused across all voxel cubes)
const sharedGeos = {};
function getGeo(size) {
  const key = size.toFixed(4);
  if (!sharedGeos[key]) {
    sharedGeos[key] = new THREE.BoxGeometry(size * 0.92, size * 0.92, size * 0.92);
  }
  return sharedGeos[key];
}

// Shared materials per enemy type (avoid creating new material per spawn)
const sharedMaterials = {};

// Player movement history for Clone Mimics (stores last 3 seconds of positions)
const playerMovementHistory = [];
const MOVEMENT_HISTORY_DURATION = 3000; // 3 seconds in ms

// Baby spiders spawned from Spider Walker deaths
const babySpiders = [];

// Pulse Bomber projectiles (sonic rings)
const pulseBomberRings = [];

/**
 * Record player position for Clone Mimic tracking.
 * Call this from main game loop.
 */
export function recordPlayerPosition(pos, now) {
  playerMovementHistory.push({ pos: pos.clone(), time: now });
  // Remove entries older than MOVEMENT_HISTORY_DURATION
  while (playerMovementHistory.length > 0 && now - playerMovementHistory[0].time > MOVEMENT_HISTORY_DURATION) {
    playerMovementHistory.shift();
  }
}

/**
 * Spawn a train-style enemy (Spiral Swimmer).
 * Creates a chain of connected voxels that move in a spiral pattern.
 */
function spawnTrainEnemy(type, position, levelConfig) {
  const def = ENEMY_DEFS[type];
  const trainLength = def.trainLength || 8;

  // Create the lead "scout" voxel
  const group = new THREE.Group();
  const geo = getGeo(def.voxelSize);
  const material = new THREE.MeshBasicMaterial({
    color: def.color,
    transparent: true,
    opacity: 0.8,
  });

  // Scout (leader) voxel - marked as weak point
  const scout = new THREE.Mesh(geo, material.clone());
  scout.position.set(0, 0, 0);
  scout.userData.isScout = true;
  scout.userData.weakPoint = true;
  group.add(scout);

  // Create trailing voxels
  const trailingVoxels = [];
  for (let i = 1; i < trainLength; i++) {
    const voxel = new THREE.Mesh(geo, material.clone());
    voxel.position.set(0, 0, -i * def.voxelSize * 1.5);
    voxel.userData.trainIndex = i;
    group.add(voxel);
    trailingVoxels.push(voxel);
  }

  group.position.copy(position);
  group.userData.isEnemy = true;

  // Add hitbox
  const hitboxGeo = new THREE.BoxGeometry(def.hitboxRadius * 2, def.hitboxRadius * 2, trainLength * def.voxelSize * 1.5);
  const hitboxMat = new THREE.MeshBasicMaterial({ visible: false });
  const hitbox = new THREE.Mesh(hitboxGeo, hitboxMat);
  hitbox.userData.isEnemyHitbox = true;
  hitbox.position.z = -(trainLength * def.voxelSize * 0.75);
  group.add(hitbox);

  const enemy = {
    mesh: group,
    material,
    type,
    hp: Math.round(def.baseHp * levelConfig.hpMultiplier),
    maxHp: Math.round(def.baseHp * levelConfig.hpMultiplier),
    speed: def.baseSpeed * levelConfig.speedMultiplier,
    baseColor: new THREE.Color(def.color),
    scoreValue: def.scoreValue,
    hitboxRadius: def.hitboxRadius,
    alertTimer: 0,
    telegraphTimer: 0,
    telegraphActive: false,
    telegraphType: def.telegraphType || null,
    lastAttackTime: 0,
    statusEffects: {
      fire: { stacks: 0, remaining: 0, tickTimer: 0 },
      shock: { stacks: 0, remaining: 0, tickTimer: 0 },
      freeze: { stacks: 0, remaining: 0, tickTimer: 0 },
    },
    // Train-specific state
    isTrain: true,
    trainLength,
    trailingVoxels,
    spiralAngle: 0,
    spiralRadius: 0.8,
    scattered: false,
    scatterTimer: 0,
  };

  activeEnemies.push(enemy);
  _enemyMeshesDirty = true;
  sceneRef.add(group);
  return enemy;
}

/**
 * Spawn a sonic ring projectile from Pulse Bomber.
 */
function spawnSonicRing(position, targetPos) {
  const ringGeo = new THREE.TorusGeometry(0.3, 0.08, 8, 16);
  const ringMat = new THREE.MeshBasicMaterial({
    color: 0x8800ff,
    transparent: true,
    opacity: 0.8,
  });
  const ring = new THREE.Mesh(ringGeo, ringMat);
  ring.position.copy(position);

  const dir = targetPos.clone().sub(position).normalize();
  ring.lookAt(targetPos);
  ring.userData.velocity = dir.multiplyScalar(2.5);
  ring.userData.createdAt = performance.now();
  ring.userData.lifetime = 3000;
  ring.userData.radius = 0.3;
  ring.userData.damage = 15;

  sceneRef.add(ring);
  pulseBomberRings.push(ring);
}

/**
 * Update sonic rings (expand and travel).
 */
export function updatePulseBomberRings(dt, now, playerPos) {
  for (let i = pulseBomberRings.length - 1; i >= 0; i--) {
    const ring = pulseBomberRings[i];
    const age = now - ring.userData.createdAt;

    if (age > ring.userData.lifetime) {
      sceneRef.remove(ring);
      ring.geometry.dispose();
      ring.material.dispose();
      pulseBomberRings.splice(i, 1);
      continue;
    }

    // Expand the ring
    ring.userData.radius += dt * 0.5;
    ring.scale.setScalar(ring.userData.radius / 0.3);

    // Move toward target
    ring.position.addScaledVector(ring.userData.velocity, dt);

    // Check collision with player
    if (ring.position.distanceTo(playerPos) < ring.userData.radius + 0.3) {
      ring.hitPlayer = true;
    }

    // Fade out
    ring.material.opacity = 0.8 * (1 - age / ring.userData.lifetime);
  }
}

/**
 * Check if player was hit by any sonic rings.
 */
export function getPulseBomberRingHits() {
  return pulseBomberRings.filter(r => r.hitPlayer);
}

/**
 * Clear hit flags on pulse bomber rings.
 */
export function clearPulseBomberRingHits() {
  pulseBomberRings.forEach(r => r.hitPlayer = false);
}

/**
 * Spawn baby spiders from Spider Walker death.
 */
function spawnBabySpiders(position, count = 3) {
  for (let i = 0; i < count; i++) {
    const geo = getGeo(0.12);
    const mat = new THREE.MeshBasicMaterial({
      color: 0xff6644,
      transparent: true,
      opacity: 0.7,
    });
    const spider = new THREE.Mesh(geo, mat);
    spider.position.copy(position);
    spider.position.x += (Math.random() - 0.5) * 0.5;
    spider.position.z += (Math.random() - 0.5) * 0.5;
    spider.position.y = 0.3;

    sceneRef.add(spider);
    babySpiders.push({
      mesh: spider,
      hp: 5,
      maxHp: 5,
      speed: 4.0,
      lifetime: 5000,
      createdAt: performance.now(),
    });
  }
}

// ── Part 2: Advanced enemy helper functions ─────────────────
const shieldShards = [];

/**
 * Spawn shield shards for Mirror Knight death effect.
 */
function spawnShieldShards(position, count = 3) {
  for (let i = 0; i < count; i++) {
    const geo = getGeo(0.25);
    const mat = new THREE.MeshBasicMaterial({
      color: 0xcccccc,
      transparent: true,
      opacity: 0.8,
    });
    const shard = new THREE.Mesh(geo, mat);
    shard.position.copy(position);
    shard.position.x += (Math.random() - 0.5) * 1.5;
    shard.position.z += (Math.random() - 0.5) * 1.5;
    shard.position.y = 0.3;

    sceneRef.add(shard);
    shieldShards.push({
      mesh: shard,
      damage: 15,
      lifetime: 8000, // 8 seconds
      createdAt: performance.now(),
    });
  }
}

/**
 * Update shield shards (ground hazards).
 */
export function updateShieldShards(dt, now, playerPos) {
  const collisions = [];

  for (let i = shieldShards.length - 1; i >= 0; i--) {
    const shard = shieldShards[i];
    const age = now - shard.createdAt;

    if (age > shard.lifetime) {
      sceneRef.remove(shard.mesh);
      shard.mesh.geometry.dispose();
      shard.mesh.material.dispose();
      shieldShards.splice(i, 1);
      continue;
    }

    // Fade out near end of lifetime
    const fadeStart = shard.lifetime * 0.7;
    if (age > fadeStart) {
      const fadeProgress = (age - fadeStart) / (shard.lifetime - fadeStart);
      shard.mesh.material.opacity = 0.8 * (1 - fadeProgress);
    }

    // Check collision with player
    const dist = shard.mesh.position.distanceTo(playerPos);
    if (dist < 0.6) {
      collisions.push({ shard, index: i });
    }
  }

  return collisions;
}

const phaseEchoes = [];

/**
 * Spawn phase echo for Phase Wraith death effect.
 */
function spawnPhaseEcho(position) {
  const geo = getGeo(0.22);
  const mat = new THREE.MeshBasicMaterial({
    color: 0x8844ff,
    transparent: true,
    opacity: 0.6,
  });
  const echo = new THREE.Mesh(geo, mat);
  echo.position.copy(position);

  sceneRef.add(echo);
  phaseEchoes.push({
    mesh: echo,
    lifetime: 5000, // 5 seconds
    createdAt: performance.now(),
    position: position.clone(),
  });
}

/**
 * Update phase echoes (distraction ghosts).
 */
export function updatePhaseEchoes(dt, now) {
  for (let i = phaseEchoes.length - 1; i >= 0; i--) {
    const echo = phaseEchoes[i];
    const age = now - echo.createdAt;

    if (age > echo.lifetime) {
      sceneRef.remove(echo.mesh);
      echo.mesh.geometry.dispose();
      echo.mesh.material.dispose();
      phaseEchoes.splice(i, 1);
      continue;
    }

    // Float around randomly
    const wobble = Math.sin(age * 0.003) * 0.5;
    echo.mesh.position.y = echo.position.y + wobble;
    echo.mesh.rotation.y += dt * 2;

    // Fade out near end
    const fadeStart = echo.lifetime * 0.7;
    if (age > fadeStart) {
      const fadeProgress = (age - fadeStart) / (echo.lifetime - fadeStart);
      echo.mesh.material.opacity = 0.6 * (1 - fadeProgress);
    }
  }
}

/**
 * Damage nearby enemies (for Black Hole Totem death).
 */
function damageNearbyEnemies(position, damage, radius) {
  for (let i = 0; i < activeEnemies.length; i++) {
    const enemy = activeEnemies[i];
    const dist = enemy.mesh.position.distanceTo(position);
    if (dist <= radius) {
      enemy.hp -= damage;
      if (enemy.hp <= 0) enemy.hp = 0;
    }
  }
}

/**
 * Spawn electric arc effect (for Conductor chain overload).
 */
function spawnElectricArc(fromPos, toPos) {
  // Create a simple line for the electric arc
  const points = [];
  const segments = 10;
  for (let i = 0; i <= segments; i++) {
    const t = i / segments;
    const point = fromPos.clone().lerp(toPos, t);
    // Add some randomness for electric effect
    if (i > 0 && i < segments) {
      point.x += (Math.random() - 0.5) * 0.3;
      point.y += (Math.random() - 0.5) * 0.3;
      point.z += (Math.random() - 0.5) * 0.3;
    }
    points.push(point);
  }

  const geometry = new THREE.BufferGeometry().setFromPoints(points);
  const material = new THREE.LineBasicMaterial({
    color: 0xffcc00,
    transparent: true,
    opacity: 1.0,
  });
  const arc = new THREE.Line(geometry, material);

  sceneRef.add(arc);

  // Store for cleanup
  electricArcs.push({
    mesh: arc,
    createdAt: performance.now(),
    lifetime: 200, // 0.2 seconds
  });
}

const electricArcs = [];

/**
 * Update electric arcs (fade out).
 */
export function updateElectricArcs(dt, now) {
  for (let i = electricArcs.length - 1; i >= 0; i--) {
    const arc = electricArcs[i];
    const age = now - arc.createdAt;

    if (age > arc.lifetime) {
      sceneRef.remove(arc.mesh);
      arc.mesh.geometry.dispose();
      arc.mesh.material.dispose();
      electricArcs.splice(i, 1);
      continue;
    }

    // Fade out
    const progress = age / arc.lifetime;
    arc.mesh.material.opacity = 1 - progress;
  }
}

/**
 * Update baby spiders.
 */
export function updateBabySpiders(dt, now, playerPos) {
  const collisions = [];

  for (let i = babySpiders.length - 1; i >= 0; i--) {
    const spider = babySpiders[i];
    const age = now - spider.createdAt;

    if (age > spider.lifetime) {
      sceneRef.remove(spider.mesh);
      spider.mesh.geometry.dispose();
      spider.mesh.material.dispose();
      babySpiders.splice(i, 1);
      continue;
    }

    // Chase player
    const dir = playerPos.clone().sub(spider.mesh.position);
    const dist = dir.length();
    if (dist > 0.1) {
      dir.normalize();
      spider.mesh.position.addScaledVector(dir, spider.speed * dt);
    }

    // Collision with player
    if (dist < 0.5) {
      collisions.push({ spider, index: i });
    }
  }

  return collisions;
}

/**
 * Get baby spider meshes for raycasting.
 */
export function getBabySpiderMeshes() {
  return babySpiders.map(s => s.mesh);
}

/**
 * Hit a baby spider.
 */
export function hitBabySpider(index, damage) {
  const spider = babySpiders[index];
  if (!spider) return { killed: false };

  spider.hp -= damage;
  if (spider.hp <= 0) {
    sceneRef.remove(spider.mesh);
    spider.mesh.geometry.dispose();
    spider.mesh.material.dispose();
    babySpiders.splice(index, 1);
    return { killed: true };
  }
  return { killed: false };
}

/**
 * Spawn Geometry Shifter split (2 smaller versions).
 */
function spawnGeometryShifterSplit(position, hp, scale) {
  const offsets = [
    new THREE.Vector3(-0.5, 0, -0.5),
    new THREE.Vector3(0.5, 0, 0.5),
  ];

  offsets.forEach(offset => {
    const spawnPos = position.clone().add(offset);
    const geo = getGeo(0.2);
    const mat = new THREE.MeshBasicMaterial({
      color: 0xff88ff,
      transparent: true,
      opacity: 0.7,
    });

    const group = new THREE.Group();
    // Simple 2x2 pattern for split
    const pattern = [[1, 1], [1, 1]];
    pattern.forEach((row, r) => {
      row.forEach((cell, c) => {
        if (cell) {
          const cube = new THREE.Mesh(geo, mat.clone());
          cube.position.set((c - 0.5) * 0.2, (0.5 - r) * 0.2, 0);
          group.add(cube);
        }
      });
    });

    group.position.copy(spawnPos);
    group.scale.setScalar(scale);
    group.userData.isEnemy = true;

    // Add hitbox
    const hitboxGeo = new THREE.BoxGeometry(0.4, 0.4, 0.4);
    const hitboxMat = new THREE.MeshBasicMaterial({ visible: false });
    const hitbox = new THREE.Mesh(hitboxGeo, hitboxMat);
    hitbox.userData.isEnemyHitbox = true;
    group.add(hitbox);

    const enemy = {
      mesh: group,
      material: mat,
      type: 'geometry_shifter_split',
      hp: Math.round(hp),
      maxHp: Math.round(hp),
      speed: 1.5,
      baseColor: new THREE.Color(0xff88ff),
      scoreValue: 8,
      hitboxRadius: 0.3,
      alertTimer: 0,
      telegraphTimer: 0,
      telegraphActive: false,
      telegraphType: 'scale',
      lastAttackTime: 0,
      statusEffects: {
        fire: { stacks: 0, remaining: 0, tickTimer: 0 },
        shock: { stacks: 0, remaining: 0, tickTimer: 0 },
        freeze: { stacks: 0, remaining: 0, tickTimer: 0 },
      },
      shapeShift: false, // Splits don't shift
      currentShape: 'tetrahedron',
      shapeTimer: 0,
      isRanged: false,
      coreExposed: false,
      coreTimer: 0,
      fireTimer: 0,
      isMimic: false,
      mimicDelay: 1000,
      mimicHistoryIndex: 0,
      isSpider: false,
      spiderState: 'roaming',
      latchTimer: 0,
      latchDamageTimer: 0,
      wallNormal: new THREE.Vector3(0, 1, 0),
    };

    activeEnemies.push(enemy);
    _enemyMeshesDirty = true;
    sceneRef.add(group);
  });
}

/**
 * Spawn Clone Mimic split (2 smaller versions).
 */
function spawnCloneMimicSplit(position) {
  const offsets = [
    new THREE.Vector3(-0.4, 0, 0),
    new THREE.Vector3(0.4, 0, 0),
  ];

  offsets.forEach(offset => {
    const spawnPos = position.clone().add(offset);
    const geo = getGeo(0.2);
    const mat = new THREE.MeshBasicMaterial({
      color: 0xff00aa,
      transparent: true,
      opacity: 0.5,
    });

    const group = new THREE.Group();
    // Simple pattern
    const cube = new THREE.Mesh(geo, mat.clone());
    group.add(cube);

    group.position.copy(spawnPos);
    group.scale.setScalar(0.7);
    group.userData.isEnemy = true;

    // Add hitbox
    const hitboxGeo = new THREE.BoxGeometry(0.3, 0.3, 0.3);
    const hitboxMat = new THREE.MeshBasicMaterial({ visible: false });
    const hitbox = new THREE.Mesh(hitboxGeo, hitboxMat);
    hitbox.userData.isEnemyHitbox = true;
    group.add(hitbox);

    const enemy = {
      mesh: group,
      material: mat,
      type: 'clone_mimic_split',
      hp: 15,
      maxHp: 15,
      speed: 2.0,
      baseColor: new THREE.Color(0xff00aa),
      scoreValue: 6,
      hitboxRadius: 0.25,
      alertTimer: 0,
      telegraphTimer: 0,
      telegraphActive: false,
      telegraphType: 'flash',
      lastAttackTime: 0,
      statusEffects: {
        fire: { stacks: 0, remaining: 0, tickTimer: 0 },
        shock: { stacks: 0, remaining: 0, tickTimer: 0 },
        freeze: { stacks: 0, remaining: 0, tickTimer: 0 },
      },
      shapeShift: false,
      currentShape: 'cube',
      shapeTimer: 0,
      isRanged: false,
      coreExposed: false,
      coreTimer: 0,
      fireTimer: 0,
      isMimic: true, // Splits still mimic
      mimicDelay: 1500, // Longer delay for splits
      mimicHistoryIndex: 0,
      isSpider: false,
      spiderState: 'roaming',
      latchTimer: 0,
      latchDamageTimer: 0,
      wallNormal: new THREE.Vector3(0, 1, 0),
    };

    activeEnemies.push(enemy);
    _enemyMeshesDirty = true;
    sceneRef.add(group);
  });
}

// Pre-built explosion sprite pool (avoid creating canvas/texture per particle)
const EXPLOSION_POOL_SIZE = 60;
const explosionPool = [];
let explosionPoolReady = false;
let explosionTexturePink = null;
let explosionTextureCyan = null;

function initExplosionPool() {
  // Create two shared textures for explosion particles
  const makeExpTex = (color) => {
    const canvas = document.createElement('canvas');
    canvas.width = 16;
    canvas.height = 16;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = color;
    ctx.fillRect(0, 0, 16, 16);
    return new THREE.CanvasTexture(canvas);
  };
  explosionTexturePink = makeExpTex('#ff00ff');
  explosionTextureCyan = makeExpTex('#00ffff');

  for (let i = 0; i < EXPLOSION_POOL_SIZE; i++) {
    const tex = i % 2 === 0 ? explosionTexturePink : explosionTextureCyan;
    const spriteMat = new THREE.SpriteMaterial({ map: tex, transparent: true, opacity: 1 });
    const sprite = new THREE.Sprite(spriteMat);
    sprite.scale.set(0.1, 0.1, 1);
    sprite.visible = false;
    explosionPool.push(sprite);
  }
  explosionPoolReady = true;
}

function getExplosionSprite() {
  // Find an inactive sprite in the pool
  for (const sprite of explosionPool) {
    if (!sprite.visible) return sprite;
  }
  return null; // Pool exhausted, skip this particle
}

// Temp vectors (avoid allocation in hot loops)
const _dir = new THREE.Vector3();
const _look = new THREE.Vector3();

// Status effect bubbles array (similar to damage numbers)
const statusBubbles = [];

/**
 * Spawn a speech bubble indicating a status effect was applied.
 */
function spawnStatusEffectBubble(position, effectType, stacks) {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  canvas.width = 256;
  canvas.height = 128;

  // Determine color and text based on effect type
  let bgColor, textColor, text;
  switch (effectType) {
    case 'fire':
      bgColor = '#ff4400';
      textColor = '#ffffff';
      text = stacks > 1 ? `FIRE x${stacks}!` : 'FIRE!';
      break;
    case 'shock':
      bgColor = '#ffff44';
      textColor = '#000000';
      text = stacks > 1 ? `SHOCK x${stacks}!` : 'SHOCK!';
      break;
    case 'freeze':
      bgColor = '#44aaff';
      textColor = '#ffffff';
      text = stacks > 1 ? `CHILL x${stacks}!` : 'CHILL!';
      break;
    default:
      bgColor = '#888888';
      textColor = '#ffffff';
      text = 'EFFECT!';
  }

  // Background bubble
  ctx.fillStyle = bgColor;
  ctx.strokeStyle = '#000000';
  ctx.lineWidth = 6;

  // Flashy comic bubble shape
  ctx.beginPath();
  ctx.moveTo(40, 60);
  ctx.lineTo(20, 20); ctx.lineTo(80, 40);
  ctx.lineTo(128, 10); ctx.lineTo(176, 40);
  ctx.lineTo(236, 20); ctx.lineTo(216, 60);
  ctx.lineTo(236, 100); ctx.lineTo(176, 80);
  ctx.lineTo(128, 110); ctx.lineTo(80, 80);
  ctx.lineTo(20, 100); ctx.closePath();
  ctx.fill();
  ctx.stroke();

  ctx.font = 'bold 36px "Comic Sans MS", cursive, sans-serif';
  if (text.length > 8) ctx.font = 'bold 24px "Comic Sans MS", cursive, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = textColor;
  ctx.fillText(text, 128, 64);

  const texture = new THREE.CanvasTexture(canvas);
  texture.premultiplyAlpha = false;
  const mesh = new THREE.Mesh(
    new THREE.PlaneGeometry(1.5, 0.75),
    new THREE.MeshBasicMaterial({ map: texture, transparent: true, depthTest: false, side: THREE.DoubleSide })
  );
  mesh.position.copy(position);
  mesh.position.y += 1.2;
  mesh.position.z += 0.5;
  mesh.renderOrder = 997;
  mesh.userData.createdAt = performance.now();
  mesh.userData.lifetime = 800;
  mesh.userData.velocity = new THREE.Vector3((Math.random() - 0.5) * 0.5, 1.5, (Math.random() - 0.5) * 0.5);

  sceneRef.add(mesh);
  statusBubbles.push(mesh);

  // Cap total to prevent perf issues
  while (statusBubbles.length > 20) {
    const old = statusBubbles.shift();
    sceneRef.remove(old);
    old.material.map.dispose();
    old.material.dispose();
  }
}

/**
 * Update status effect bubbles (animate and remove expired).
 */
export function updateStatusBubbles(dt, now) {
  for (let i = statusBubbles.length - 1; i >= 0; i--) {
    const b = statusBubbles[i];
    const age = now - b.userData.createdAt;

    if (age > b.userData.lifetime) {
      sceneRef.remove(b);
      b.material.map.dispose();
      b.material.dispose();
      statusBubbles.splice(i, 1);
    } else {
      b.position.addScaledVector(b.userData.velocity, dt);
      b.userData.velocity.y -= 3 * dt;
      const progress = age / b.userData.lifetime;
      b.material.opacity = 1 - progress;
    }
  }
}

// ── Public API ─────────────────────────────────────────────

export function initEnemies(scene) {
  sceneRef = scene;
  if (!explosionPoolReady) {
    initExplosionPool();
    // Add all pool sprites to scene (hidden by default)
    explosionPool.forEach(s => scene.add(s));
  }
}

/**
 * Spawn a single enemy of the given type at `position`.
 * `levelConfig` from game.js provides HP/speed multipliers.
 */
export function spawnEnemy(type, position, levelConfig) {
  const def = ENEMY_DEFS[type];
  if (!def) return;

  // Handle special enemy types
  if (def.isTrain) {
    return spawnTrainEnemy(type, position, levelConfig);
  }

  // Clone shared material (clone is cheap, shares shader program)
  if (!sharedMaterials[type]) {
    sharedMaterials[type] = new THREE.MeshBasicMaterial({
      color: def.color,
      transparent: true,
      opacity: 0.7,
    });
  }
  const material = sharedMaterials[type].clone();

  const group = new THREE.Group();
  const geo = getGeo(def.voxelSize);
  const rows = def.pattern.length;
  const cols = def.pattern[0].length;
  const cx = (cols - 1) / 2;
  const cy = (rows - 1) / 2;
  const isTank = type === 'tank';

  // For non-tank enemies, merge voxel geometries into a single mesh
  // This reduces draw calls from ~10-20 per enemy down to 1
  if (!isTank) {
    const geometries = [];
    for (let d = 0; d < def.depth; d++) {
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          if (def.pattern[r][c]) {
            const g = geo.clone();
            g.translate(
              (c - cx) * def.voxelSize,
              (cy - r) * def.voxelSize,
              d * def.voxelSize,
            );
            geometries.push(g);
          }
        }
      }
    }
    if (geometries.length > 0) {
      const mergedGeo = mergeGeometries(geometries);
      if (mergedGeo) {
        const mergedMesh = new THREE.Mesh(mergedGeo, material);
        mergedMesh.userData.isMergedGeometry = true;
        group.add(mergedMesh);
      }
      // Dispose cloned geometries (the merged one is a new copy)
      geometries.forEach(g => g.dispose());
    }
  } else {
    // Tank: keep individual voxels for weak-point targeting
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
  }

  group.position.copy(position);
  group.userData.isEnemy = true;

  // Tank: one random voxel is weak point (double damage)
  if (isTank) {
    const voxels = group.children.filter(c => !c.userData.isEnemyHitbox);
    if (voxels.length > 0) {
      const weak = voxels[Math.floor(Math.random() * voxels.length)];
      weak.userData.weakPoint = true;
    }
  }

  // Add invisible box hitbox for better hit detection (cheaper than sphere)
  const hitboxGeo = new THREE.BoxGeometry(def.hitboxRadius * 2, def.hitboxRadius * 2, def.hitboxRadius * 2);
  const hitboxMat = new THREE.MeshBasicMaterial({ visible: false });
  const hitbox = new THREE.Mesh(hitboxGeo, hitboxMat);
  hitbox.userData.isEnemyHitbox = true;
  group.add(hitbox);

  const enemy = {
    mesh: group,
    material,
    type,
    hp: Math.round(def.baseHp * levelConfig.hpMultiplier),
    maxHp: Math.round(def.baseHp * levelConfig.hpMultiplier),
    speed: def.baseSpeed * levelConfig.speedMultiplier,
    baseColor: new THREE.Color(def.color),
    scoreValue: def.scoreValue,
    hitboxRadius: def.hitboxRadius,
    alertTimer: 0,
    telegraphTimer: 0,
    telegraphActive: false,
    telegraphType: def.telegraphType || null,
    lastAttackTime: 0,
    statusEffects: {
      fire: { stacks: 0, remaining: 0, tickTimer: 0 },
      shock: { stacks: 0, remaining: 0, tickTimer: 0 },
      freeze: { stacks: 0, remaining: 0, tickTimer: 0 },
    },
    // Special enemy states
    shapeShift: def.shapeShift || false,
    currentShape: 'cube',
    shapeTimer: 0,
    isRanged: def.isRanged || false,
    coreExposed: false,
    coreTimer: 0,
    fireTimer: 0,
    isMimic: def.isMimic || false,
    mimicDelay: 1000, // 1 second delay
    mimicHistoryIndex: 0,
    isSpider: def.isSpider || false,
    spiderState: 'roaming', // 'roaming', 'latched'
    latchTimer: 0,
    latchDamageTimer: 0,
    wallNormal: new THREE.Vector3(0, 1, 0),

    // ── Part 2: Advanced enemy states ───────────────────────
    isMirror: def.isMirror || false,
    mirrorLastPlayerDir: new THREE.Vector3(),
    mirrorConfused: false,
    mirrorConfuseTimer: 0,
    mirrorStillTimer: 0,

    isPortal: def.isPortal || false,
    portalCooldown: def.portalCooldown || 4.0,
    portalTimer: 0,
    portalDisoriented: false,
    portalDisorientTimer: 0,

    isBlackhole: def.isBlackhole || false,
    gravityRadius: def.gravityRadius || 5.0,
    gravityStrength: def.gravityStrength || 2.5,
    deathExplosionDamage: def.deathExplosionDamage || 50,

    isConductor: def.isConductor || false,
    linkRadius: def.linkRadius || 4.0,
    linkSpeedBonus: def.linkSpeedBonus || 0.4,
    linkDamageReduction: def.linkDamageReduction || 0.3,
    linkedEnemies: [],

    isPhase: def.isPhase || false,
    phaseCycleTime: def.phaseCycleTime || 2.0,
    phaseTimer: 0,
    isInvisible: false,
    invisibleDamageBonus: def.invisibleDamageBonus || 2.0,
  };

  activeEnemies.push(enemy);
  _enemyMeshesDirty = true;  // Invalidate cache
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
    if (se.shock.stacks > 0) speedMod *= Math.max(0.4, 1 - se.shock.stacks * 0.2);
    if (se.freeze.stacks > 0) speedMod *= Math.max(0.05, 1 - se.freeze.stacks * 0.4);

    // Apply stasis field slow effect
    const stasisSlow = getStasisSlowFactor(e.mesh.position);
    speedMod *= stasisSlow;

    e.mesh.position.addScaledVector(_dir, e.speed * speedMod * dt);

    // ── Special Enemy AI Behaviors ──
    // Spiral Swimmer: corkscrew movement
    if (e.isTrain && !e.scattered) {
      e.spiralAngle += dt * 4; // Spiral speed
      const spiralOffset = Math.sin(e.spiralAngle) * e.spiralRadius;
      e.mesh.position.x += Math.cos(e.spiralAngle) * 0.3 * dt;
      e.mesh.position.y += spiralOffset * 0.1 * dt;
      // Keep within bounds
      e.mesh.position.y = Math.max(0.5, Math.min(3.5, e.mesh.position.y));

      // Animate trailing voxels to follow in spiral
      if (e.trailingVoxels) {
        e.trailingVoxels.forEach((voxel, idx) => {
          const phase = e.spiralAngle - (idx + 1) * 0.4;
          voxel.position.x = Math.sin(phase) * e.spiralRadius * 0.5;
          voxel.position.y = Math.cos(phase) * e.spiralRadius * 0.3;
        });
      }
    }

    // Scattered train: random movement
    if (e.isTrain && e.scattered) {
      e.scatterTimer -= dt;
      if (e.scatterTimer <= 0) {
        e.scattered = false;
      }
      // Random jitter
      e.mesh.position.x += (Math.random() - 0.5) * 2 * dt;
      e.mesh.position.z += (Math.random() - 0.5) * 2 * dt;
    }

    // Geometry Shifter: shape-changing
    if (e.shapeShift) {
      e.shapeTimer += dt;
      if (e.shapeTimer >= 2.0) {
        e.shapeTimer = 0;
        // Cycle through shapes
        const shapes = ['cube', 'pyramid', 'sphere', 'tetrahedron'];
        const currentIdx = shapes.indexOf(e.currentShape);
        e.currentShape = shapes[(currentIdx + 1) % shapes.length];

        // Visual scale change based on shape
        const scaleMod = e.currentShape === 'sphere' ? 1.2 : e.currentShape === 'pyramid' ? 0.9 : 1.0;
        e.mesh.scale.setScalar(scaleMod);

        // Color change based on shape
        const shapeColors = { cube: 0xff0000, pyramid: 0xff8800, sphere: 0xffff00, tetrahedron: 0xff88ff };
        e.mesh.traverse(c => {
          if (c.isMesh && c.material && !c.userData.isEnemyHitbox) {
            c.material.color.setHex(shapeColors[e.currentShape] || e.baseColor.getHex());
          }
        });
      }
    }

    // Pulse Bomber: ranged attacks
    if (e.isRanged) {
      e.fireTimer += dt;
      e.coreTimer += dt;

      // Fire sonic rings every 2.5 seconds
      if (e.fireTimer >= 2.5 && dist > 3) {
        e.fireTimer = 0;
        e.coreExposed = true;
        e.coreTimer = 0;

        // Spawn sonic ring
        spawnSonicRing(e.mesh.position.clone(), playerPos);
      }

      // Core exposure window (1.5s)
      if (e.coreExposed && e.coreTimer > 1.5) {
        e.coreExposed = false;
      }

      // Telegraph glow before firing
      if (e.fireTimer >= 2.0 && !e.coreExposed) {
        e.mesh.traverse(c => {
          if (c.isMesh && c.material && !c.userData.isEnemyHitbox) {
            c.material.emissive = new THREE.Color(0xffffff);
            c.material.emissiveIntensity = (e.fireTimer - 2.0) / 0.5;
          }
        });
      }

      // Keep distance from player
      if (dist < 4) {
        e.mesh.position.addScaledVector(_dir, -e.speed * 0.5 * dt);
      }
    }

    // Clone Mimic: copy player movement with delay
    if (e.isMimic && playerMovementHistory.length > 0) {
      const targetTime = now - e.mimicDelay;
      // Find the position from 1 second ago
      let targetPos = null;
      for (let j = playerMovementHistory.length - 1; j >= 0; j--) {
        if (playerMovementHistory[j].time <= targetTime) {
          targetPos = playerMovementHistory[j].pos;
          break;
        }
      }

      if (targetPos) {
        const mimicDir = targetPos.clone().sub(e.mesh.position);
        const mimicDist = mimicDir.length();
        if (mimicDist > 0.1) {
          mimicDir.normalize();
          e.mesh.position.addScaledVector(mimicDir, e.speed * speedMod * dt);
        }
      }

      // Glitchy visual effect
      e.mesh.traverse(c => {
        if (c.isMesh && c.material && !c.userData.isEnemyHitbox) {
          c.material.opacity = 0.5 + Math.sin(now * 0.01) * 0.2;
        }
      });
    }

    // Spider Walker: wall/ceiling movement and latching
    if (e.isSpider) {
      if (e.spiderState === 'roaming') {
        // Randomly switch between floor, walls, ceiling
        if (Math.random() < 0.01) {
          const surfaces = ['floor', 'wall', 'ceiling'];
          const surface = surfaces[Math.floor(Math.random() * surfaces.length)];

          if (surface === 'ceiling') {
            e.mesh.position.y = 3.5;
            e.wallNormal.set(0, -1, 0);
          } else if (surface === 'wall') {
            e.mesh.position.y = 1.5 + Math.random();
            e.wallNormal.set(Math.random() > 0.5 ? 1 : -1, 0, 0);
          } else {
            e.mesh.position.y = 0.5;
            e.wallNormal.set(0, 1, 0);
          }
        }

        // Leap attack when close
        if (dist < 3 && dist > 1 && Math.random() < 0.02) {
          e.spiderState = 'leaping';
          e.latchTimer = 0;
        }
      } else if (e.spiderState === 'leaping') {
        // Quick dash toward player
        e.mesh.position.addScaledVector(_dir, e.speed * 3 * dt);

        if (dist < 0.8) {
          e.spiderState = 'latched';
          e.latchTimer = 0;
          e.latchDamageTimer = 0;
        }

        e.latchTimer += dt;
        if (e.latchTimer > 1) {
          e.spiderState = 'roaming';
        }
      } else if (e.spiderState === 'latched') {
        // Stay on player, drain health
        e.mesh.position.copy(playerPos);
        e.mesh.position.y += 0.5;

        // Latch damage handled in game.js via collision
        e.latchTimer += dt;

        // Auto-detach after 3 seconds
        if (e.latchTimer > 3) {
          e.spiderState = 'roaming';
          e.mesh.position.y = 0.5;
        }
      }
    }

    // ── Part 2: Advanced enemy AI ───────────────────────────
    // Mirror Knight: mirrors player's left/right movements (opposite)
    if (e.isMirror) {
      // Check if player is standing still (confuses the knight)
      const playerVel = playerPos.clone().sub(e.mirrorLastPlayerDir);
      e.mirrorLastPlayerDir.copy(playerPos);
      if (playerVel.length() < 0.01) {
        e.mirrorStillTimer += dt;
        if (e.mirrorStillTimer > 2.0) {
          e.mirrorConfused = true;
          e.mirrorConfuseTimer = 1.5;
        }
      } else {
        e.mirrorStillTimer = 0;
      }

      // Confused state: move randomly
      if (e.mirrorConfused) {
        e.mirrorConfuseTimer -= dt;
        if (e.mirrorConfuseTimer <= 0) {
          e.mirrorConfused = false;
        } else {
          // Random movement while confused
          const randDir = new THREE.Vector3(
            Math.sin(now * 0.01 + i),
            0,
            Math.cos(now * 0.01 + i)
          ).normalize();
          e.mesh.position.addScaledVector(randDir, e.speed * speedMod * dt * 0.5);
        }
      } else {
        // Mirror player's horizontal movement (opposite direction)
        const mirrorDir = _dir.clone();
        mirrorDir.x *= -1; // Opposite horizontal movement
        e.mesh.position.addScaledVector(mirrorDir, e.speed * speedMod * dt);
      }

      // Shield visual effect
      e.mesh.traverse(c => {
        if (c.isMesh && c.material && !c.userData.isEnemyHitbox) {
          const reflectGlow = Math.sin(now * 0.003) * 0.2 + 0.5;
          c.material.opacity = reflectGlow;
        }
      });
    }

    // Portal Mantis: opens portals and exits near player
    if (e.isPortal) {
      e.portalTimer += dt;
      e.portalDisorientTimer = Math.max(0, e.portalDisorientTimer - dt);

      if (e.portalDisoriented) {
        // Disoriented after exiting portal: move slower
        speedMod *= 0.3;
        // Visual glitch effect
        e.mesh.traverse(c => {
          if (c.isMesh && c.material && !c.userData.isEnemyHitbox) {
            c.material.opacity = 0.3 + Math.random() * 0.4;
          }
        });
        if (e.portalDisorientTimer <= 0) {
          e.portalDisoriented = false;
        }
      } else if (e.portalTimer >= e.portalCooldown && dist > 3.0) {
        // Open portal and teleport near player
        const angle = Math.random() * Math.PI * 2;
        const teleportDist = 2.5 + Math.random() * 1.5;
        e.mesh.position.set(
          playerPos.x + Math.cos(angle) * teleportDist,
          e.mesh.position.y,
          playerPos.z + Math.sin(angle) * teleportDist
        );
        e.portalTimer = 0;
        e.portalDisoriented = true;
        e.portalDisorientTimer = 0.5;
      }

      // Portal glow effect when ready to teleport
      if (e.portalTimer >= e.portalCooldown * 0.7) {
        e.mesh.traverse(c => {
          if (c.isMesh && c.material && !c.userData.isEnemyHitbox) {
            c.material.emissive = new THREE.Color(0x00ffaa);
            c.material.emissiveIntensity = 0.5;
          }
        });
      }
    }

    // Black Hole Totem: stationary, creates gravity field
    if (e.isBlackhole) {
      // Stationary - no movement

      // Visual effect: dark swirling vortex
      e.mesh.traverse(c => {
        if (c.isMesh && c.material && !c.userData.isEnemyHitbox) {
          const pulse = 0.3 + Math.sin(now * 0.005) * 0.2;
          c.material.opacity = pulse;
          c.material.emissive = new THREE.Color(0x220033);
          c.material.emissiveIntensity = 0.5;
        }
      });

      // Rotation effect
      e.mesh.rotation.y += dt * 2;
    }

    // Conductor: links to nearby enemies
    if (e.isConductor) {
      // Find nearby enemies to link (every frame)
      e.linkedEnemies = [];
      const levelConfig = { speedMultiplier: 1 }; // Default, will be overridden

      for (let j = 0; j < activeEnemies.length; j++) {
        if (i === j) continue;
        const other = activeEnemies[j];
        const linkDist = e.mesh.position.distanceTo(other.mesh.position);
        if (linkDist <= e.linkRadius && !other.isConductor) {
          e.linkedEnemies.push(j);
          // Buff linked enemies: speed bonus
          const baseDef = ENEMY_DEFS[other.type];
          if (baseDef) {
            other.speed = baseDef.baseSpeed * (1 + e.linkSpeedBonus);
          }
        }
      }

      // Visual tether effect (electric arc)
      e.mesh.traverse(c => {
        if (c.isMesh && c.material && !c.userData.isEnemyHitbox) {
          c.material.emissive = new THREE.Color(0xffcc00);
          c.material.emissiveIntensity = e.linkedEnemies.length > 0 ? 0.6 : 0.2;
        }
      });
    }

    // Phase Wraith: blinks in/out of visibility
    if (e.isPhase) {
      e.phaseTimer += dt;
      const cycleProgress = (e.phaseTimer % e.phaseCycleTime) / e.phaseCycleTime;

      // First half: visible, second half: invisible
      e.isInvisible = cycleProgress > 0.5;

      // Visual effect
      e.mesh.traverse(c => {
        if (c.isMesh && c.material && !c.userData.isEnemyHitbox) {
          c.material.opacity = e.isInvisible ? 0.15 : 0.85;
          if (e.isInvisible) {
            c.material.emissive = new THREE.Color(0x8844ff);
            c.material.emissiveIntensity = 0.3;
          } else {
            c.material.emissive = new THREE.Color(0x000000);
            c.material.emissiveIntensity = 0;
          }
        }
      });
    }

    // Face player (horizontal only)
    _look.set(playerPos.x, e.mesh.position.y, playerPos.z);
    e.mesh.lookAt(_look);

    // Apply visual tints for status effects
    e.mesh.traverse(c => {
      if (c.isMesh && c.material) {
        const baseColor = e.baseColor.clone();
        if (se.fire.stacks > 0) {
          c.material.color.setHex(0xff4400);
        } else if (se.freeze.stacks > 0) {
          c.material.color.setHex(0x44aaff);
        } else if (se.shock.stacks > 0) {
          c.material.color.setHex(0xffff44);
        } else {
          const dmgRatio = 1 - e.hp / e.maxHp;
          c.material.color.copy(baseColor).lerp(_redColor, dmgRatio);
        }
      }
    });

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

  // Fire DoT (Large)
  if (se.fire.remaining > 0) {
    se.fire.remaining -= dt;
    se.fire.tickTimer -= dt;
    if (se.fire.tickTimer <= 0) {
      se.fire.tickTimer = 0.5;
      const fireDmg = Math.round(15 * se.fire.stacks);
      e.hp -= fireDmg;
      if (e.hp <= 0) e.hp = 0;
      e._lastDoT = { type: 'fire', damage: fireDmg };
      // Spawn fire particles - commented out as window.spawnEffectParticle doesn't exist
      // if (typeof window !== 'undefined' && window.spawnEffectParticle) {
      //   window.spawnEffectParticle(e.mesh.position, 0xff4400);
      // }
    }
    if (se.fire.remaining <= 0) { se.fire.stacks = 0; se.fire.tickTimer = 0; }
  }

  // Shock DoT (Medium)
  if (se.shock.remaining > 0) {
    se.shock.remaining -= dt;
    se.shock.tickTimer -= dt;
    if (se.shock.tickTimer <= 0) {
      se.shock.tickTimer = 0.5;
      const shockDmg = Math.round(8 * se.shock.stacks);
      e.hp -= shockDmg;
      if (e.hp <= 0) e.hp = 0;
      e._lastDoT = { type: 'shock', damage: shockDmg };
      // Spawn shock particles - commented out as window.spawnEffectParticle doesn't exist
      // if (typeof window !== 'undefined' && window.spawnEffectParticle) {
      //   window.spawnEffectParticle(e.mesh.position, 0xffff44);
      // }
    }
    if (se.shock.remaining <= 0) { se.shock.stacks = 0; se.shock.tickTimer = 0; }
  }

  // Freeze DoT (NO damage - CHILL only slows)
  if (se.freeze.remaining > 0) {
    se.freeze.remaining -= dt;
    se.freeze.tickTimer -= dt;
    if (se.freeze.tickTimer <= 0) {
      se.freeze.tickTimer = 0.5;
      // CHILL: NO damage, just slows
      e._lastDoT = { type: 'freeze', damage: 0 };
      // Spawn freeze particles - commented out as window.spawnEffectParticle doesn't exist
      // if (typeof window !== 'undefined' && window.spawnEffectParticle) {
      //   window.spawnEffectParticle(e.mesh.position, 0x00ffff);
      // }
    }
    if (se.freeze.remaining <= 0) { se.freeze.stacks = 0; se.freeze.tickTimer = 0; }
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

    // Check if this is a new application (was 0, now > 0)
    const wasInactive = se.stacks === 0;
    se.stacks = Math.max(se.stacks, stacks);

    // CHILL (freeze) lasts longer than other effects
    if (type === 'freeze') {
      se.remaining = 4 + stacks * 0.8; // Longer duration: 4s base + 0.8s per stack
    } else {
      se.remaining = 2 + stacks * 0.5; // Standard duration: 2s base + 0.5s per stack
    }

    // Spawn speech bubble when effect is first applied
    if (wasInactive) {
      spawnStatusEffectBubble(e.mesh.position, type, se.stacks);
    }
  });
}

/**
 * Deal damage to an enemy. Returns { killed, enemy, overkill }.
 */
export function hitEnemy(index, damage, hitInfo = {}) {
  const e = activeEnemies[index];
  if (!e) return { killed: false };

  // Special damage modifiers
  let actualDamage = damage;

  // Pulse Bomber: 3x damage when core exposed
  if (e.isRanged && e.coreExposed) {
    actualDamage *= 3;
  }

  // Tank: check for weak point
  if (e.type === 'tank' && hitInfo.weakPoint) {
    actualDamage *= 2;
  }

  // Spiral Swimmer: scatter school if scout killed
  if (e.isTrain && hitInfo.weakPoint) {
    e.scattered = true;
    e.scatterTimer = 3.0; // 3 seconds of chaos
    // Give bonus damage to scout
    actualDamage *= 1.5;
  }

  e.hp -= actualDamage;
  if (e.hp <= 0) {
    return { killed: true, enemy: e, overkill: -e.hp };
  }
  return { killed: false, enemy: e };
}

// [Instruction 1] Alt weapon star drop callback - set by main.js
let onEnemyDestroyedCallback = null;

/**
 * Set callback to be called when an enemy is destroyed.
 * Used for alt weapon star drops (3% chance).
 */
export function setOnEnemyDestroyedCallback(callback) {
  onEnemyDestroyedCallback = callback;
}

/**
 * Destroy enemy at `index` — remove from scene, spawn explosion.
 */
export function destroyEnemy(index, isCritical = false, isOverkill = false) {
  const e = activeEnemies[index];
  if (!e) return null;

  const pos = e.mesh.position.clone();
  const color = e.baseColor.clone();

  // ── Special death effects for new enemies ──
  // Geometry Shifter: split into 2 smaller when in tetrahedron form
  if (e.shapeShift && e.currentShape === 'tetrahedron') {
    spawnGeometryShifterSplit(pos, e.hp * 0.3, 0.7);
  }

  // Clone Mimic: split into 2 smaller unless killed fast (overkill)
  if (e.isMimic && !isOverkill) {
    spawnCloneMimicSplit(pos);
  }

  // Spider Walker: drop baby spiders
  if (e.isSpider) {
    spawnBabySpiders(pos, 3);
  }

  // Spiral Swimmer: if scout was killed, scatter is already handled
  // but we give bonus score for killing the scout
  if (e.isTrain && e.mesh.children[0]?.userData?.weakPoint) {
    // Scout kill bonus
    e.scoreValue += 5;
  }

  // ── Part 2: Advanced enemy death effects ───────────────────
  // Mirror Knight: Shield shatters into 3 ground hazards
  if (e.isMirror) {
    spawnShieldShards(pos, 3);
  }

  // Portal Mantis: No special death effect (normal death)
  // Phase Wraith: Creates "phase echo" ghost (5s distraction)
  if (e.isPhase) {
    spawnPhaseEcho(pos);
  }

  // Black Hole Totem: Damages nearby enemies on death
  if (e.isBlackhole) {
    damageNearbyEnemies(pos, e.deathExplosionDamage, 5.0);
  }

  // Conductor: Chain overload - kills all linked enemies
  if (e.isConductor && e.linkedEnemies.length > 0) {
    // Kill all linked enemies (chain reaction)
    e.linkedEnemies.forEach(linkedIdx => {
      if (activeEnemies[linkedIdx]) {
        // Deal massive damage to linked enemy
        activeEnemies[linkedIdx].hp = 0;
        // Visual feedback: electric arc
        spawnElectricArc(pos, activeEnemies[linkedIdx].mesh.position.clone());
      }
    });
  }

  // [Physics Death System] Spawn voxel explosions with physics
  if (spawnVoxelExplosion) {
    let voxelCount = e.type === 'tank' ? 10 : e.type === 'basic' ? 6 : 4;
    // New enemy voxel counts
    if (e.isTrain) voxelCount = e.trainLength || 8;
    if (e.shapeShift) voxelCount = 8;
    if (e.isRanged) voxelCount = 6;
    if (e.isMimic) voxelCount = 5;
    if (e.isSpider) voxelCount = 4;

    spawnVoxelExplosion(pos, color.getHex(), voxelCount, e.type, isCritical, isOverkill);
  }

  // Pooled explosion particles (no allocation per death)
  const particleCount = 5;
  for (let i = 0; i < particleCount; i++) {
    const sprite = getExplosionSprite();
    if (!sprite) break;  // Pool exhausted

    sprite.material.opacity = 1;
    sprite.material.map = Math.random() > 0.5 ? explosionTexturePink : explosionTextureCyan;
    sprite.position.copy(pos);
    sprite.visible = true;

    sprite.userData.velocity = new THREE.Vector3(
      (Math.random() - 0.5) * 5,
      (Math.random() - 0.5) * 5,
      (Math.random() - 0.5) * 5,
    );
    sprite.userData.createdAt = performance.now();
    sprite.userData.lifetime = 300 + Math.random() * 200;

    explosionParts.push(sprite);
  }

  // Remove enemy mesh from scene
  sceneRef.remove(e.mesh);
  // Dispose merged geometry if present
  e.mesh.traverse(c => {
    if (c.isMesh && c.userData.isMergedGeometry && c.geometry) {
      c.geometry.dispose();
    }
  });
  // Dispose material
  e.material.dispose();
  activeEnemies.splice(index, 1);
  _enemyMeshesDirty = true;  // Invalidate cache

  return { position: pos, scoreValue: e.scoreValue, baseColor: color };
}

/**
 * Remove all enemies (for level transitions).
 */
export function clearAllEnemies() {
  for (let i = activeEnemies.length - 1; i >= 0; i--) {
    sceneRef.remove(activeEnemies[i].mesh);
    // Dispose merged geometry
    activeEnemies[i].mesh.traverse(c => {
      if (c.isMesh && c.userData.isMergedGeometry && c.geometry) {
        c.geometry.dispose();
      }
    });
    activeEnemies[i].material.dispose();
  }
  activeEnemies.length = 0;
  _enemyMeshesDirty = true;  // Invalidate cache
}

/**
 * Animate and clean up explosion particles.
 */
export function updateExplosions(dt, now) {
  for (let i = explosionParts.length - 1; i >= 0; i--) {
    const p = explosionParts[i];
    const age = now - p.userData.createdAt;

    if (age > p.userData.lifetime) {
      // Return to pool (hide, don't destroy)
      p.visible = false;
      explosionParts.splice(i, 1);
    } else {
      p.position.addScaledVector(p.userData.velocity, dt);
      p.userData.velocity.multiplyScalar(1 - 3 * dt);
      p.material.opacity = 1 - age / p.userData.lifetime;
    }
  }
}

/** Return all enemy mesh groups (for raycasting). Optionally include boss mesh. */
export function getEnemyMeshes(includeBoss = false) {
  // Use cached array to avoid per-frame allocation
  if (_enemyMeshesDirty) {
    rebuildMeshCache();
  }
  if (includeBoss && activeBoss) {
    // Boss queries are rare, so allocating here is fine
    const list = [..._cachedEnemyMeshes, activeBoss.mesh];
    if (activeBoss.shields) {
      list.push(...activeBoss.shields);
    }
    return list;
  }
  return _cachedEnemyMeshes;
}

/** Find which enemy a raycasted mesh belongs to. */
export function getEnemyByMesh(mesh) {
  let obj = mesh;
  while (obj) {
    if (obj.userData.isShield) return { boss: activeBoss, isShield: true };
    if (obj.userData.isBoss) return { boss: activeBoss, isBody: true };
    if (obj.userData.isEnemy) {
      const idx = activeEnemies.findIndex(e => e.mesh === obj);
      return idx >= 0 ? { index: idx, enemy: activeEnemies[idx] } : null;
    }
    obj = obj.parent;
  }
  return null;
}

// ── BOSS SYSTEM ───────────────────────────────────────────
let activeBoss = null;

const BOSS_SKULL_PATTERN = [
  [0, 1, 1, 1, 0],
  [1, 1, 1, 1, 1],
  [1, 1, 0, 1, 1],
  [1, 1, 1, 1, 1],
  [0, 1, 0, 1, 0],
];

const BOSS_DEFS = {
  // Teleporting boss (Level 5)
  chrono_wraith: {
    pattern: [[1, 1, 1, 1]],
    voxelSize: 0.45,
    baseHp: 850,
    phases: 3,
    color: 0x00ff88,
    scoreValue: 100,
    behavior: 'dodger',
    hitboxRadius: 0.45
  },

  // Level 10 bosses (Tier 2 - HARDER)
  hunter_breakenridge: {
    name: 'Redmond "Hunter" Breakenridge',
    pattern: [
      [0, 0, 1, 0, 0],
      [0, 1, 1, 1, 0],
      [1, 1, 1, 1, 1],
      [0, 1, 1, 1, 0],
      [0, 0, 1, 0, 0],
    ],
    voxelSize: 0.35,
    baseHp: 1200,
    phases: 3,
    color: 0xff6600,
    scoreValue: 200,
    behavior: 'hunter',
    hitboxRadius: 0.6,
    rifleFireRate: 2.5,
    droneFireRate: 1.5,
    weakPoints: false  // Custom weak points (drone)
  },

  dj_drax: {
    name: 'DJ Drax',
    pattern: [
      [1, 1, 1],
      [1, 1, 1],
    ],
    voxelSize: 0.3,
    baseHp: 1300,
    phases: 3,
    color: 0x8800ff,
    scoreValue: 200,
    behavior: 'dj',
    hitboxRadius: 0.7,
    beatRate: 0.6,
    fanSpawnRate: 4.0,
    weakPoints: false  // Custom weak points (speakers)
  },

  captain_kestrel: {
    name: 'Captain Kestrel',
    pattern: [
      [0, 0, 1, 0, 0],
      [0, 1, 1, 1, 0],
      [1, 1, 1, 1, 1],
      [0, 1, 1, 1, 0],
      [0, 0, 1, 0, 0],
    ],
    voxelSize: 0.3,
    baseHp: 1150,
    phases: 3,
    color: 0x00aaff,
    scoreValue: 200,
    behavior: 'starfighter',
    hitboxRadius: 0.65,
    cannonFireRate: 2.0,
    missileRate: 5.0,
    weakPoints: false  // Custom weak points (cockpit)
  },

  dr_aster: {
    name: 'Dr. Aster',
    pattern: [
      [0, 1, 0],
      [1, 1, 1],
      [0, 1, 0],
    ],
    voxelSize: 0.35,
    baseHp: 1100,
    phases: 3,
    color: 0xff00ff,
    scoreValue: 200,
    behavior: 'scientist',
    hitboxRadius: 0.55,
    minionSpawnRate: 5.0,
    weakPoints: false  // Custom weak points (compiler)
  },

  sunflare_seraph: {
    name: 'Sunflare Seraph',
    pattern: [
      [0, 0, 1, 0, 0],
      [0, 1, 1, 1, 0],
      [1, 1, 1, 1, 1],
      [0, 1, 1, 1, 0],
      [0, 0, 1, 0, 0],
    ],
    voxelSize: 0.3,
    baseHp: 1250,
    phases: 3,
    color: 0xffdd00,
    scoreValue: 200,
    behavior: 'monk',
    hitboxRadius: 0.7,
    meditationDuration: 3.0,
    weakPoints: false  // Custom weak points (sun nodes)
  },

  // Level 15 bosses (Tier 3 - TOUGH)
  theodore_breakenridge: {
    name: 'Theodore "Shady" Breakenridge',
    pattern: [
      [0, 0, 1, 0, 0],
      [0, 1, 1, 1, 0],
      [1, 1, 1, 1, 1],
      [0, 1, 1, 1, 0],
      [0, 0, 1, 0, 0],
    ],
    voxelSize: 0.4,
    baseHp: 1800,
    phases: 3,
    color: 0x8800ff,
    scoreValue: 400,
    behavior: 'outlaw',
    hitboxRadius: 0.7,
    vanishDuration: 2.0,
    shadowBulletRate: 0.8,
    weakPoints: true
  },

  commander_halcyon: {
    name: 'Commander Halcyon',
    pattern: [
      [0, 0, 1, 0, 0],
      [0, 1, 1, 1, 0],
      [1, 1, 1, 1, 1],
      [0, 1, 1, 1, 0],
      [0, 0, 1, 0, 0],
    ],
    voxelSize: 0.38,
    baseHp: 1750,
    phases: 3,
    color: 0x00aaff,
    scoreValue: 400,
    behavior: 'commander',
    hitboxRadius: 0.75,
    laserRate: 1.5,
    weakPoints: false
  },

  madame_coda: {
    name: 'Madame Coda',
    pattern: [
      [1, 1, 1],
      [1, 1, 1],
      [1, 1, 1],
    ],
    voxelSize: 0.32,
    baseHp: 1700,
    phases: 3,
    color: 0xff00ff,
    scoreValue: 400,
    behavior: 'diva',
    hitboxRadius: 0.7,
    beamRate: 1.2,
    performanceDuration: 3.0,
    weakPoints: false
  },

  twin_glitch: {
    name: 'Twin Glitch Units',
    pattern: [
      [1, 1],
      [1, 1],
    ],
    voxelSize: 0.25,
    baseHp: 1600,
    phases: 3,
    color: 0x00ffff,
    scoreValue: 400,
    behavior: 'twin_glitch',
    hitboxRadius: 1.2,
    vulnerabilitySwapRate: 4.0,
    weakPoints: false
  },

  neon_minotaur: {
    name: 'Neon Minotaur',
    pattern: [
      [0, 0, 1, 0, 0],
      [0, 1, 1, 1, 0],
      [1, 1, 1, 1, 1],
      [0, 1, 1, 1, 0],
      [0, 0, 1, 0, 0],
    ],
    voxelSize: 0.42,
    baseHp: 1900,
    phases: 3,
    color: 0xff0088,
    scoreValue: 400,
    behavior: 'minotaur',
    hitboxRadius: 0.8,
    chargeDuration: 2.5,
    slamRate: 5.0,
    shardRate: 0.6,
    weakPoints: true
  },

  // Level 20 Final Bosses (Tier 4 - VERY TOUGH)
  walter_breakenridge: {
    name: 'Walter "Pa" Breakenridge',
    pattern: [
      [0, 0, 1, 1, 1, 0, 0],
      [0, 1, 1, 1, 1, 1, 0],
      [1, 1, 1, 1, 1, 1, 1],
      [1, 1, 1, 1, 1, 1, 1],
      [0, 1, 1, 1, 1, 1, 0],
      [0, 0, 1, 1, 1, 0, 0],
    ],
    voxelSize: 0.5,
    baseHp: 1800,
    phases: 4,
    color: 0x88ff00,
    scoreValue: 500,
    behavior: 'walter',
    hitboxRadius: 1.2,
    minionSpawnRate: 4.0,
    projectileRate: 2.5
  },

  kernel_monolith: {
    name: 'KERNEL',
    pattern: [
      [1, 1, 1],
      [1, 1, 1],
      [1, 1, 1],
      [1, 1, 1],
      [1, 1, 1],
    ],
    voxelSize: 0.55,
    baseHp: 2000,
    phases: 3,
    color: 0xff8800,
    scoreValue: 500,
    behavior: 'kernel',
    hitboxRadius: 1.0,
    projectileRate: 1.8
  },

  synth_kraken: {
    name: 'Synth Kraken',
    pattern: [
      [0, 0, 1, 1, 0, 0],
      [0, 1, 1, 1, 1, 0],
      [1, 1, 1, 1, 1, 1],
      [1, 1, 1, 1, 1, 1],
      [0, 1, 1, 1, 1, 0],
    ],
    voxelSize: 0.48,
    baseHp: 1900,
    phases: 4,
    color: 0x00ffff,
    scoreValue: 500,
    behavior: 'kraken',
    hitboxRadius: 1.1,
    minionSpawnRate: 5.0,
    projectileRate: 3.0
  },

  afterimage_seraphim: {
    name: 'Afterimage Seraphim',
    pattern: [
      [1, 0, 0, 0, 1],
      [0, 1, 1, 1, 0],
      [0, 0, 1, 0, 0],
      [0, 1, 1, 1, 0],
      [0, 1, 0, 1, 0],
      [0, 1, 0, 1, 0],
    ],
    voxelSize: 0.45,
    baseHp: 1700,
    phases: 3,
    color: 0xffff88,
    scoreValue: 500,
    behavior: 'seraphim',
    hitboxRadius: 0.9,
    minionSpawnRate: 6.0
  },

  sun_eater_train: {
    name: 'Sun-Eater Train',
    pattern: [
      [1, 1, 1],
      [1, 1, 1],
      [1, 1, 1],
    ],
    voxelSize: 0.6,
    baseHp: 2200,
    phases: 5,
    color: 0xffaa00,
    scoreValue: 500,
    behavior: 'train',
    hitboxRadius: 1.3,
    projectileRate: 2.0
  }
};

function buildBossMesh(def, id) {
  const group = new THREE.Group();
  const geo = getGeo(def.voxelSize);
  const mat = new THREE.MeshBasicMaterial({ color: def.color, transparent: true, opacity: 0.9 });
  const rows = def.pattern.length;
  const cols = def.pattern[0].length;
  const cx = (cols - 1) / 2;
  const cy = (rows - 1) / 2;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (def.pattern[r][c]) {
        const cube = new THREE.Mesh(geo, mat.clone());
        cube.position.set((c - cx) * def.voxelSize, (cy - r) * def.voxelSize, 0);
        group.add(cube);
      }
    }
  }
  group.userData.isBoss = true;
  return group;
}

export function spawnBoss(bossId, levelConfig) {
  const def = BOSS_DEFS[bossId];
  if (!def || !sceneRef) return null;
  const mesh = buildBossMesh(def, bossId);
  const maxHp = Math.round(def.baseHp * levelConfig.hpMultiplier);
  mesh.position.set(0, 1.5, -12);
  sceneRef.add(mesh);

  activeBoss = {
    mesh,
    id: bossId,
    hp: maxHp,
    maxHp,
    phase: 1,
    phases: def.phases,
    scoreValue: def.scoreValue,
    baseColor: new THREE.Color(def.color),
    behavior: def.behavior,

    // Behavior state
    spawnMinionTimer: 0,
    shootTimer: 0,
    chargeTimer: 0,
    chargeActive: false,
    dodgeTimer: 0,
    dodgeDir: new THREE.Vector3(),
    shields: [],          // Orbiting shield meshes
    shieldsActive: false,
    shieldAngle: 0,
  };

  // Create shields for shielded bosses
  if (def.behavior === 'shielded') {
    createBossShields(activeBoss);
  }

  return activeBoss;
}

function createBossShields(boss) {
  const shieldCount = 3;  // 3 orbiting shields
  const geo = getGeo(0.3);
  const mat = new THREE.MeshBasicMaterial({ color: 0xff00aa, transparent: true, opacity: 0.7 });

  for (let i = 0; i < shieldCount; i++) {
    const shield = new THREE.Mesh(geo, mat.clone());
    shield.userData.isShield = true;
    shield.userData.shieldIndex = i;
    sceneRef.add(shield);
    boss.shields.push(shield);
  }
  boss.shieldsActive = true;
}

export function getBoss() {
  return activeBoss;
}

export function hitBoss(damage, hitInfo = {}) {
  if (!activeBoss) return { killed: false, shieldReflected: false };

  // Core Guardian logic: only take damage via shields. Direct body hits reflect.
  if (activeBoss.behavior === 'shielded' && activeBoss.shieldsActive) {
    if (hitInfo.isShield) {
      // Taking damage via orbiting bits
    } else if (hitInfo.isBody) {
      return { killed: false, shieldReflected: true, phaseChanged: false };
    } else {
      // Indirect damage (fire/AOE)? Allow but maybe reduced?
      // Let's allow AOE to tick damage normally or it becomes frustrating.
    }
  }

  activeBoss.hp -= damage;
  if (activeBoss.hp <= 0) activeBoss.hp = 0;

  // DODGER behavior: Teleport on hit (chance increases with phase)
  if (activeBoss.behavior === 'dodger' && Math.random() < 0.2 + activeBoss.phase * 0.1) {
    const angle = Math.random() * Math.PI * 2;
    const dist = 6 + Math.random() * 4;
    activeBoss.mesh.position.set(
      Math.cos(angle) * dist,
      1.5,
      Math.sin(angle) * dist
    );
  }

  const prevPhase = activeBoss.phase;
  const phaseThreshold2 = activeBoss.maxHp * (2 / 3);
  const phaseThreshold1 = activeBoss.maxHp * (1 / 3);
  if (activeBoss.phases >= 3 && activeBoss.hp > 0) {
    if (activeBoss.hp <= phaseThreshold1) activeBoss.phase = 3;
    else if (activeBoss.hp <= phaseThreshold2) activeBoss.phase = 2;
  }
  return { killed: activeBoss.hp <= 0, shieldReflected: false, phaseChanged: activeBoss.phase !== prevPhase };
}

export function updateBoss(dt, now, playerPos) {
  if (!activeBoss) return;
  const b = activeBoss;

  _dir.copy(playerPos).sub(b.mesh.position);
  const dist = _dir.length();
  if (dist > 0.01) _dir.divideScalar(dist);

  // Always look at player
  _look.set(playerPos.x, b.mesh.position.y, playerPos.z);
  b.mesh.lookAt(_look);

  // === BEHAVIOR-SPECIFIC LOGIC ===

  if (b.behavior === 'spawner') {
    // SPAWNER: Moves toward player, spawns minions
    const speed = 0.25 + (b.phase - 1) * 0.1;
    b.mesh.position.addScaledVector(_dir, speed * dt);

    b.spawnMinionTimer -= dt;
    if (b.spawnMinionTimer <= 0) {
      const spawnRate = 2.5 - b.phase * 0.6;
      b.spawnMinionTimer = spawnRate;

      // Spawn multiple minions, potentially 'fast' ones in higher tiers
      const spawnCount = b.phase === 3 ? 3 : b.phase === 2 ? 2 : 1;
      for (let i = 0; i < spawnCount; i++) {
        const minionType = (b.id.includes('2') || b.id.includes('3') || b.id.includes('4')) && b.phase === 3 ? 'fast' : 'basic';
        spawnBossMinion(b.mesh.position.clone(), playerPos, minionType);
      }
    }
  }

  else if (b.behavior === 'turret') {
    // TURRET: Stationary, shoots projectiles
    b.shootTimer -= dt;
    if (b.shootTimer <= 0) {
      const shootRate = 1.8 - b.phase * 0.4;
      b.shootTimer = shootRate;

      // Phase 1: 1 shot, Phase 2: 3 shots fan, Phase 3: 5 shots spray
      if (b.phase === 1) {
        spawnBossProjectile(b.mesh.position.clone(), playerPos);
      } else if (b.phase === 2) {
        // 3 shot fan
        for (let i = -1; i <= 1; i++) {
          const offset = new THREE.Vector3(i * 2, 0, 0).applyQuaternion(b.mesh.quaternion);
          spawnBossProjectile(b.mesh.position.clone(), playerPos.clone().add(offset));
        }
      } else {
        // 5 shot spray
        for (let i = -2; i <= 2; i++) {
          const offset = new THREE.Vector3(i * 1.5, (Math.random() - 0.5) * 2, 0).applyQuaternion(b.mesh.quaternion);
          spawnBossProjectile(b.mesh.position.clone(), playerPos.clone().add(offset));
        }
      }
    }
  }

  else if (b.behavior === 'dodger') {
    // DODGER: Moves erratically, hard to hit
    b.dodgeTimer -= dt;
    if (b.dodgeTimer <= 0) {
      b.dodgeTimer = 0.6 / b.phase;
      const perp = new THREE.Vector3(-_dir.z, 0, _dir.x).normalize();
      const randomDir = Math.random() < 0.5 ? 1 : -1;
      b.dodgeDir.copy(perp).multiplyScalar(randomDir);
    }

    const approachSpeed = 0.15 + b.phase * 0.08;
    const dodgeSpeed = 0.8 + b.phase * 0.3;
    b.mesh.position.addScaledVector(_dir, approachSpeed * dt);
    b.mesh.position.addScaledVector(b.dodgeDir, dodgeSpeed * dt);
  }

  else if (b.behavior === 'charger') {
    // CHARGER: Bursts toward player
    b.chargeTimer -= dt;

    if (b.chargeActive) {
      const chargeSpeed = 3.5 + b.phase * 0.8;
      b.mesh.position.addScaledVector(_dir, chargeSpeed * dt);

      if (b.chargeTimer <= 0) {
        b.chargeActive = false;
        b.chargeTimer = 1.6 - b.phase * 0.3;
      }
    } else {
      if (b.chargeTimer <= 0) {
        b.chargeActive = true;
        b.chargeTimer = 0.45 + Math.random() * 0.25;
      }
    }
  }

  else if (b.behavior === 'shielded') {
    // SHIELDED: Orbiting shields reflect damage
    const speed = 0.2 + b.phase * 0.05;
    b.mesh.position.addScaledVector(_dir, speed * dt);

    b.shieldAngle += dt * (2.0 + b.phase * 0.5);
    const radius = 1.4 + Math.sin(now * 0.002) * 0.3;

    b.shieldsActive = b.phase < 3;

    b.shields.forEach((shield, i) => {
      const angle = b.shieldAngle + (i * Math.PI * 2 / b.shields.length);
      shield.position.set(
        b.mesh.position.x + Math.cos(angle) * radius,
        b.mesh.position.y + Math.sin(now * 0.003 + i) * 0.5,
        b.mesh.position.z + Math.sin(angle) * radius
      );
      shield.visible = b.shieldsActive;
      if (shield.material) {
        shield.material.color.setHSL(0.8, 1, 0.5 + Math.sin(now * 0.01) * 0.2);
      }
    });
  }

  // Default fallback (shouldn't hit, but just in case)
  else {
    const speed = 0.4 + (b.phase - 1) * 0.2;
    b.mesh.position.addScaledVector(_dir, speed * dt);
  }
}

const bossMinions = [];
function spawnBossMinion(fromPos, playerPos, type = 'basic') {
  const group = new THREE.Group();
  const def = ENEMY_DEFS[type] || ENEMY_DEFS.basic;
  const geo = getGeo(def.voxelSize);
  const mat = new THREE.MeshBasicMaterial({ color: def.color, transparent: true, opacity: 0.8 });

  // Create a small 2x2 voxel minion
  for (let r = 0; r < 2; r++) {
    for (let c = 0; c < 2; c++) {
      const cube = new THREE.Mesh(geo, mat.clone());
      cube.position.set(c * def.voxelSize, r * def.voxelSize, 0);
      group.add(cube);
    }
  }

  group.position.copy(fromPos);
  group.userData.isBossMinion = true;
  group.userData.slideAngle = 0;
  group.userData.slideTimer = 0;
  sceneRef.add(group);
  bossMinions.push({ mesh: group, hp: def.baseHp, maxHp: def.baseHp, speed: def.baseSpeed });
}

export function getBossMinionMeshes() {
  return bossMinions.map(m => m.mesh);
}

export function getBossMinionByMesh(mesh) {
  let obj = mesh;
  while (obj) {
    if (obj.userData.isBossMinion) {
      const idx = bossMinions.findIndex(m => m.mesh === obj);
      return idx >= 0 ? { index: idx, minion: bossMinions[idx] } : null;
    }
    obj = obj.parent;
  }
  return null;
}

export function hitBossMinion(index, damage) {
  const m = bossMinions[index];
  if (!m) return { killed: false };
  m.hp -= damage;
  if (m.hp <= 0) {
    sceneRef.remove(m.mesh);
    m.mesh.traverse(c => { if (c.geometry) c.geometry.dispose(); if (c.material) c.material.dispose(); });
    bossMinions.splice(index, 1);
    return { killed: true };
  }
  return { killed: false };
}

export function updateBossMinions(dt, playerPos) {
  for (let i = bossMinions.length - 1; i >= 0; i--) {
    const m = bossMinions[i];
    m.mesh.userData.slideTimer = (m.mesh.userData.slideTimer || 0) + dt;
    let angle = m.mesh.userData.slideAngle || 0;
    if (m.mesh.userData.slideTimer > 0.15) {
      m.mesh.userData.slideTimer = 0;
      angle = (angle + Math.PI / 4) % (Math.PI * 2);
      if (angle > Math.PI) angle -= Math.PI * 2;
      m.mesh.userData.slideAngle = angle;
    }
    m.mesh.rotation.y = m.mesh.userData.slideAngle || 0;
    _dir.copy(playerPos).sub(m.mesh.position).normalize();
    m.mesh.position.addScaledVector(_dir, (m.speed || 0.6) * dt);
  }
}

// ── Boss Projectiles (for turret/shooter bosses) ───────────
const bossProjectiles = [];

function spawnBossProjectile(fromPos, targetPos) {
  const geo = getGeo(0.12);
  const mat = new THREE.MeshBasicMaterial({ color: 0xff0000, emissive: 0xff0000 });
  const proj = new THREE.Mesh(geo, mat);
  proj.position.copy(fromPos);

  const dir = new THREE.Vector3().copy(targetPos).sub(fromPos).normalize();
  const speed = 4.0;  // Slow enough to dodge

  sceneRef.add(proj);
  bossProjectiles.push({
    mesh: proj,
    velocity: dir.multiplyScalar(speed),
    createdAt: performance.now(),
    lifetime: 5000,  // 5 seconds
  });
}

export function updateBossProjectiles(dt, now, playerPos) {
  for (let i = bossProjectiles.length - 1; i >= 0; i--) {
    const proj = bossProjectiles[i];
    const age = now - proj.createdAt;

    if (age > proj.lifetime) {
      sceneRef.remove(proj.mesh);
      proj.mesh.geometry.dispose();
      proj.mesh.material.dispose();
      bossProjectiles.splice(i, 1);
      continue;
    }

    proj.mesh.position.addScaledVector(proj.velocity, dt);

    // Check collision with player
    if (proj.mesh.position.distanceTo(playerPos) < 0.5) {
      // Return damage flag (main.js will handle damage)
      proj.hitPlayer = true;
    }
  }
}

export function getBossProjectiles() {
  return bossProjectiles;
}

export function clearBoss() {
  if (!activeBoss) return;

  // Clean up boss mesh
  sceneRef.remove(activeBoss.mesh);
  activeBoss.mesh.traverse(c => { if (c.geometry) c.geometry.dispose(); if (c.material) c.material.dispose(); });

  // Clean up shields
  if (activeBoss.shields) {
    activeBoss.shields.forEach(shield => {
      sceneRef.remove(shield);
      shield.geometry.dispose();
      shield.material.dispose();
    });
  }

  activeBoss = null;

  // Clean up minions
  bossMinions.forEach(m => {
    sceneRef.remove(m.mesh);
    m.mesh.traverse(c => { if (c.geometry) c.geometry.dispose(); if (c.material) c.material.dispose(); });
  });
  bossMinions.length = 0;

  // Clean up projectiles
  bossProjectiles.forEach(p => {
    sceneRef.remove(p.mesh);
    p.mesh.geometry.dispose();
    p.mesh.material.dispose();
  });
  bossProjectiles.length = 0;
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
export function getSpawnPosition(airSpawns, verticalAngle = 0) {
  const angle = (Math.random() - 0.5) * (100 * Math.PI / 180);
  const distance = 14.4 + Math.random() * 5.6;  // 20% shorter (was 18-25, now 14.4-20)

  const x = Math.sin(angle) * distance;
  const z = -Math.cos(angle) * distance;
  let y = 1.5;

  if (airSpawns) {
    y = 0.5 + Math.random() * 2.5;
  }

  // Apply vertical angle for difficulty progression
  if (verticalAngle > 0) {
    const vertRad = verticalAngle * Math.PI / 180;
    const baseY = y;
    y = baseY + Math.sin(vertRad) * distance * Math.random();
  }

  return new THREE.Vector3(x, y, z);
}

/** Get all fast enemies (for proximity alerts) */
export function getFastEnemies() {
  return activeEnemies.filter(e => e.type === 'fast');
}

/** Get all swarm enemies (for proximity alerts) */
export function getSwarmEnemies() {
  return activeEnemies.filter(e => e.type === 'swarm');
}
