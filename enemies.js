// ============================================================
//  ENEMY SYSTEM
//  Voxel enemies: spawning, movement, damage, death explosions.
// ============================================================

import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { getStasisSlowFactor } from './stasis.js';
import { playTingSound, playEnemyProjectileSound } from './audio.js';

// [Visual Overhaul] Import VFX system for voxel explosions
let spawnVoxelExplosion = null;

// Function to set VFX reference (called from main.js after initialization)
export function setVFXReference(vfxFunc) {
  spawnVoxelExplosion = vfxFunc;
}

function setMaterialEmissiveSafe(material, color, intensity = 1) {
  if (!material) return;
  if (Array.isArray(material)) {
    material.forEach((m) => setMaterialEmissiveSafe(m, color, intensity));
    return;
  }

  if (material.emissive && typeof material.emissive.copy === 'function') {
    material.emissive.copy(color);
    material.emissiveIntensity = intensity;
    return;
  }

  if (Object.prototype.hasOwnProperty.call(material, 'emissive')) delete material.emissive;
  if (Object.prototype.hasOwnProperty.call(material, 'emissiveIntensity')) delete material.emissiveIntensity;
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
  jelly: [
    '1',
    '1',
    '1',
    '1',
    '1',
  ],
  // shifter: [
  //   '111',
  //   '..1',
  //   '111',
  // ],
  // bomber: [
  //   '111',
  //   '1.1',
  //   '1.1',
  // ],
  // mimic: [
  //   '1..',
  //   '.1.',
  //   '..1',
  // ],
  // spider: [
  //   '1.1',
  //   '111',
  //   '1.1',
  // ],
  // totem: [
  //   '.1.',
  //   '.1.',
  //   '.1.',
  // ],
  wraith: [
    '1',
    '1',
    '1',
  ],
  // colossus: [
  //   '1111',
  //   '1..1',
  //   '1..1',
  //   '1111',
  // ],
};

function parsePattern(strings) {
  return strings.map(row => row.split('').map(c => (c === '1' ? 1 : 0)));
}

function buildJellyPattern(height) {
  const rows = [];
  for (let i = 0; i < height; i++) {
    rows.push('1');
  }
  return parsePattern(rows);
}

function updateJellyHitbox(enemy) {
  if (!enemy.hitbox || !enemy.voxelSize) return;
  const height = Math.max(1, enemy.jellyHeight) * enemy.voxelSize * 1.05;
  if (enemy.hitbox.geometry) enemy.hitbox.geometry.dispose();
  enemy.hitbox.geometry = new THREE.BoxGeometry(enemy.hitboxRadius * 2, height, enemy.hitboxRadius * 2);
}

function shrinkJelly(enemy) {
  if (!enemy.isJelly || enemy.jellyHeight <= 1) return false;

  const voxels = enemy.mesh.children.filter(c => c.isMesh && !c.userData.isEnemyHitbox);
  let topVoxel = null;
  let maxY = -Infinity;
  voxels.forEach(v => {
    if (v.position.y > maxY) {
      maxY = v.position.y;
      topVoxel = v;
    }
  });

  if (topVoxel) {
    const worldPos = new THREE.Vector3();
    topVoxel.getWorldPosition(worldPos);
    enemy.mesh.remove(topVoxel);
    if (topVoxel.geometry) topVoxel.geometry.dispose();
    if (topVoxel.material) topVoxel.material.dispose();
    if (spawnVoxelExplosion) {
      spawnVoxelExplosion(worldPos, enemy.baseColor.getHex(), 1, enemy.type, false, false);
    }
  }

  enemy.jellyHeight = Math.max(1, enemy.jellyHeight - 1);
  const newMax = Math.max(1, Math.round(enemy.jellyBaseHp * (enemy.jellyHeight / enemy.jellyBaseHeight)));
  enemy.maxHp = newMax;
  enemy.hp = newMax;
  enemy.speed = enemy.baseSpeed + (enemy.jellyBaseHeight - enemy.jellyHeight) * enemy.jellySpeedBoost;
  updateJellyHitbox(enemy);
  return true;
}

// ── Enemy type stats ───────────────────────────────────────
const ENEMY_DEFS = {
  basic: { pattern: parsePattern(PATTERNS.basic), voxelSize: 0.29, baseHp: 30, baseSpeed: 1.5, color: 0x00ff88, depth: 1, scoreValue: 10, hitboxRadius: 0.6 },
  fast: { pattern: parsePattern(PATTERNS.fast), voxelSize: 0.24, baseHp: 15, baseSpeed: 3.0, color: 0xffff00, depth: 1, scoreValue: 15, hitboxRadius: 0.48, telegraphType: 'flash' },
  tank: { pattern: parsePattern(PATTERNS.tank), voxelSize: 0.36, baseHp: 80, baseSpeed: 0.8, color: 0x4488ff, depth: 1, scoreValue: 25, hitboxRadius: 0.84, telegraphType: 'scale' },
  swarm: { pattern: parsePattern(PATTERNS.swarm), voxelSize: 0.19, baseHp: 10, baseSpeed: 3.5, color: 0xff8800, depth: 1, scoreValue: 5, hitboxRadius: 0.36, telegraphType: 'twitch' },
  jelly: {
    pattern: parsePattern(PATTERNS.jelly),
    voxelSize: 0.26,
    baseHp: 60,
    baseSpeed: 0.6,
    color: 0x66ffcc,
    depth: 1,
    scoreValue: 20,
    hitboxRadius: 0.35,
    telegraphType: 'glow',
    isJelly: true,
    jellyBaseHeight: 5,
    jellySpeedBoost: 0.28,
  },

  dream_slime: {
    pattern: parsePattern([
      '.1.',
      '111',
      '.1.',
    ]),
    voxelSize: 0.26,
    baseHp: 22,
    baseSpeed: 1.1,
    color: 0x8855ff,
    depth: 1,
    scoreValue: 12,
    hitboxRadius: 0.5,
    telegraphType: 'glow',
  },
  dream_eye: {
    pattern: parsePattern([
      '111',
      '1.1',
      '111',
    ]),
    voxelSize: 0.45,
    baseHp: 260,
    baseSpeed: 0.6,
    color: 0xaa66ff,
    depth: 1,
    scoreValue: 120,
    hitboxRadius: 0.95,
    telegraphType: 'glow',
  },

  // ── New enemy types (v2.0) ─────────────────────────────────
  spiral_swimmer: { pattern: [[1]], voxelSize: 0.18, baseHp: 8, baseSpeed: 2.2, color: 0x00ffcc, depth: 1, scoreValue: 8, hitboxRadius: 0.3, telegraphType: 'twitch', isTrain: true, trainLength: 10 },
  // geometry_shifter: { pattern: parsePattern(PATTERNS.shifter), voxelSize: 0.28, baseHp: 45, baseSpeed: 1.3, color: 0xff6600, depth: 1, scoreValue: 20, hitboxRadius: 0.55, telegraphType: 'scale', shapeShift: true },
  // pulse_bomber: { pattern: parsePattern(PATTERNS.bomber), voxelSize: 0.32, baseHp: 55, baseSpeed: 0.6, color: 0x8800ff, depth: 1, scoreValue: 22, hitboxRadius: 0.7, telegraphType: 'glow', isRanged: true },
  // clone_mimic: { pattern: parsePattern(PATTERNS.mimic), voxelSize: 0.26, baseHp: 35, baseSpeed: 1.8, color: 0xff00aa, depth: 1, scoreValue: 18, hitboxRadius: 0.5, telegraphType: 'flash', isMimic: true },
  // spider_walker: { pattern: parsePattern(PATTERNS.spider), voxelSize: 0.22, baseHp: 25, baseSpeed: 2.8, color: 0xff4400, depth: 1, scoreValue: 12, hitboxRadius: 0.4, telegraphType: 'twitch', isSpider: true },

  // ── Part 2: Advanced enemies (v3.0) ─────────────────────────
  mirror_knight: {
    pattern: parsePattern([
      '111',
      '1.1',
      '111',
    ]),
    voxelSize: 0.32,
    baseHp: 160,
    baseSpeed: 1.0,
    color: 0xd0d0d0,
    depth: 1,
    scoreValue: 40,
    hitboxRadius: 0.7,
    telegraphType: 'flash',
    isMirror: true,
    mirrorSpeedBoost: 0.35,
    mirrorImmuneDuration: 1.2,
  },
  // portal_mantis: {
  //   pattern: parsePattern([
  //     '1.1',
  //     '111',
  //     '.1.',
  //   ]),
  //   voxelSize: 0.25,
  //   baseHp: 40,
  //   baseSpeed: 2.0,
  //   color: 0x00ffaa,
  //   depth: 1,
  //   scoreValue: 24,
  //   hitboxRadius: 0.5,
  //   telegraphType: 'twitch',
  //   isPortal: true,
  //   portalCooldown: 4.0,
  // },
  // blackhole_totem: {
  //   pattern: parsePattern(PATTERNS.totem),
  //   voxelSize: 0.35,
  //   baseHp: 20,
  //   baseSpeed: 0,
  //   color: 0x220033,
  //   depth: 1,
  //   scoreValue: 15,
  //   hitboxRadius: 0.6,
  //   telegraphType: 'glow',
  //   isBlackhole: true,
  //   gravityRadius: 5.0,
  //   gravityStrength: 2.5,
  //   deathExplosionDamage: 50,
  // },
  conductor: {
    pattern: parsePattern([
      '1.1',
      '.1.',
      '1.1',
    ]),
    voxelSize: 0.28,
    baseHp: 140,
    baseSpeed: 0.5,
    color: 0xff66cc,
    depth: 1,
    scoreValue: 32,
    hitboxRadius: 0.6,
    telegraphType: 'glow',
    isConductor: true,
    linkRadius: 5.0,
    linkSpeedBonus: 0.45,
    linkDamageReduction: 0.35,
    conductorHoldDistance: 6.5,
    conductorArcCooldown: 0.25,
  },
  phase_wraith: {
    pattern: parsePattern(PATTERNS.wraith),
    voxelSize: 0.22,
    baseHp: 130,
    baseSpeed: 1.6,
    color: 0x8844ff,
    depth: 1,
    scoreValue: 28,
    hitboxRadius: 0.45,
    telegraphType: 'flash',
    isPhase: true,
    phaseStunDuration: 0.35,
    phaseVanishDelay: 0.5,
    phaseReappearDelay: 1.2,
    phaseSpawnCooldown: 6.0,
    phasePreferredDistMin: 5.5,
    phasePreferredDistMax: 9.5,
  },
  // obsidian_colossus: {
  //   pattern: parsePattern(PATTERNS.colossus),
  //   voxelSize: 0.42,
  //   baseHp: 260,
  //   baseSpeed: 0.45,
  //   color: 0x663300,
  //   depth: 1,
  //   scoreValue: 60,
  //   hitboxRadius: 1.2,
  //   telegraphType: 'scale',
  // },
};

// ── Module state ───────────────────────────────────────────
let sceneRef = null;
const activeEnemies = [];
const explosionParts = [];

// Enemy death physics bits
const enemyDebris = [];
const MAX_ENEMY_DEBRIS = 25;  // Cap for performance (reduced from 50)

// Boss death debris (physics-based from commit 2abb1b5)
const bossDebris = [];
const MAX_DEBRIS = 25;  // Cap for performance (reduced from 56)

// Player forward direction for front-arc constraints
const _playerForwardRef = new THREE.Vector3(0, 0, -1);
const _frontDir = new THREE.Vector3();
const _frontRight = new THREE.Vector3();
const _frontFlat = new THREE.Vector3();
const _frontUp = new THREE.Vector3(0, 1, 0);

export function setPlayerForward(forward) {
  if (forward) {
    _playerForwardRef.copy(forward);
    if (_playerForwardRef.lengthSq() < 0.0001) {
      _playerForwardRef.set(0, 0, -1);
    }
  }
}

function clampPositionToFrontArc(position, playerPos, minDist = 3, maxDist = 20, arcDeg = 120) {
  _frontDir.copy(_playerForwardRef);
  _frontDir.y = 0;
  if (_frontDir.lengthSq() < 0.0001) {
    _frontDir.set(0, 0, -1);
  }
  _frontDir.normalize();

  _frontFlat.copy(position).sub(playerPos);
  _frontFlat.y = 0;
  const dist = _frontFlat.length();
  const clampedDist = Math.min(maxDist, Math.max(minDist, dist || minDist));

  if (dist > 0.0001) {
    _frontFlat.divideScalar(dist);
  } else {
    _frontFlat.copy(_frontDir);
  }

  const halfRad = (arcDeg * Math.PI / 180) / 2;
  const cosLimit = Math.cos(halfRad);
  const sinLimit = Math.sin(halfRad);
  const dot = _frontFlat.dot(_frontDir);

  if (dot < cosLimit) {
    _frontRight.crossVectors(_frontUp, _frontDir).normalize();
    const sign = Math.sign(_frontFlat.dot(_frontRight)) || 1;
    _frontFlat.copy(_frontDir)
      .multiplyScalar(cosLimit)
      .addScaledVector(_frontRight, sign * sinLimit)
      .normalize();
  }

  position.x = playerPos.x + _frontFlat.x * clampedDist;
  position.z = playerPos.z + _frontFlat.z * clampedDist;
  return position;
}

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

// ── Basic enemy InstancedMesh pool ─────────────────────────
// One InstancedMesh for all 'basic' enemies = 1 draw call instead of N.
const MAX_BASIC_INSTANCES = 30;
const basicInstancePool = {
  mesh: null,
  freeIndices: new Set(),
  initialized: false,
};
const _basicDummyMatrix = new THREE.Matrix4().makeScale(0, 0, 0);
const _basicColorTmp = new THREE.Color();

/**
 * Build merged geometry for 'basic' enemy pattern and create InstancedMesh.
 * Called from initEnemies() after sceneRef is available.
 */
function initBasicInstancePool() {
  if (basicInstancePool.initialized || !sceneRef) return;

  const def = ENEMY_DEFS.basic;
  const geo = getGeo(def.voxelSize);
  const rows = def.pattern.length;
  const cols = def.pattern[0].length;
  const cx = (cols - 1) / 2;
  const cy = (rows - 1) / 2;

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

  let basicGeo;
  if (geometries.length > 0) {
    basicGeo = mergeGeometries(geometries);
    geometries.forEach(g => g.dispose());
  }
  if (!basicGeo) {
    console.warn('[basic-instance] Failed to build merged geometry, falling back to box');
    basicGeo = new THREE.BoxGeometry(def.voxelSize, def.voxelSize, def.voxelSize);
  }

  const basicMat = new THREE.MeshBasicMaterial({
    transparent: true,
    depthWrite: false,
    opacity: 0.7,
  });

  const im = new THREE.InstancedMesh(basicGeo, basicMat, MAX_BASIC_INSTANCES);
  im.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  im.count = 0;
  im.frustumCulled = false;

  // Initialize all instances as invisible (zero scale)
  for (let i = 0; i < MAX_BASIC_INSTANCES; i++) {
    im.setMatrixAt(i, _basicDummyMatrix);
  }
  im.instanceMatrix.needsUpdate = true;

  sceneRef.add(im);
  basicInstancePool.mesh = im;
  basicInstancePool.initialized = true;

  console.log(`[basic-instance] Pool initialized: ${MAX_BASIC_INSTANCES} slots`);
}

/**
 * Acquire an instance slot for a basic enemy.
 * Returns { instanceId } or null if pool exhausted.
 */
function acquireBasicInstance() {
  if (!basicInstancePool.initialized) return null;
  const pool = basicInstancePool;

  let instanceId;
  if (pool.freeIndices.size > 0) {
    instanceId = pool.freeIndices.values().next().value;
    pool.freeIndices.delete(instanceId);
  } else if (pool.mesh.count < MAX_BASIC_INSTANCES) {
    instanceId = pool.mesh.count;
    pool.mesh.count = instanceId + 1;
  } else {
    console.warn('[basic-instance] Pool exhausted! Falling back to individual mesh.');
    return null;
  }

  console.log(`[basic-instance] Acquired slot ${instanceId} (count=${pool.mesh.count}, free=${pool.freeIndices.size})`);
  return { instanceId, pool };
}

/**
 * Release an instance slot back to the pool.
 */
function releaseBasicInstance(instanceId) {
  if (!basicInstancePool.initialized) return;
  const pool = basicInstancePool;

  // Hide instance by zeroing its matrix
  pool.mesh.setMatrixAt(instanceId, _basicDummyMatrix);
  pool.mesh.instanceMatrix.needsUpdate = true;
  pool.freeIndices.add(instanceId);

  console.log(`[basic-instance] Released slot ${instanceId} (count=${pool.mesh.count}, free=${pool.freeIndices.size})`);
}

/**
 * Release ALL basic instance slots (for level transitions).
 */
function releaseAllBasicInstances() {
  if (!basicInstancePool.initialized) return;
  const pool = basicInstancePool;

  for (let i = 0; i < pool.mesh.count; i++) {
    pool.mesh.setMatrixAt(i, _basicDummyMatrix);
  }
  pool.mesh.instanceMatrix.needsUpdate = true;
  pool.mesh.count = 0;
  pool.freeIndices.clear();

  console.log('[basic-instance] All slots released (clearAllEnemies)');
}

// ── Fast enemy InstancedMesh pool ──────────────────────────
// One InstancedMesh for all 'fast' enemies = 1 draw call instead of N.
const MAX_FAST_INSTANCES = 40;
const fastInstancePool = {
  mesh: null,
  freeIndices: new Set(),
  initialized: false,
};
const _fastDummyMatrix = new THREE.Matrix4().makeScale(0, 0, 0);
const _fastColorTmp = new THREE.Color();

/**
 * Build merged geometry for 'fast' enemy pattern and create InstancedMesh.
 * Called from initEnemies() after sceneRef is available.
 */
function initFastInstancePool() {
  if (fastInstancePool.initialized || !sceneRef) return;

  const def = ENEMY_DEFS.fast;
  const geo = getGeo(def.voxelSize);
  const rows = def.pattern.length;
  const cols = def.pattern[0].length;
  const cx = (cols - 1) / 2;
  const cy = (rows - 1) / 2;

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

  let fastGeo;
  if (geometries.length > 0) {
    fastGeo = mergeGeometries(geometries);
    geometries.forEach(g => g.dispose());
  }
  if (!fastGeo) {
    console.warn('[fast-instance] Failed to build merged geometry, falling back to box');
    fastGeo = new THREE.BoxGeometry(def.voxelSize, def.voxelSize, def.voxelSize);
  }

  const fastMat = new THREE.MeshBasicMaterial({
    transparent: true,
    depthWrite: false,
    opacity: 0.7,
  });

  const im = new THREE.InstancedMesh(fastGeo, fastMat, MAX_FAST_INSTANCES);
  im.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  im.count = 0;
  im.frustumCulled = false;

  // Initialize all instances as invisible (zero scale)
  for (let i = 0; i < MAX_FAST_INSTANCES; i++) {
    im.setMatrixAt(i, _fastDummyMatrix);
  }
  im.instanceMatrix.needsUpdate = true;

  sceneRef.add(im);
  fastInstancePool.mesh = im;
  fastInstancePool.initialized = true;

  console.log(`[fast-instance] Pool initialized: ${MAX_FAST_INSTANCES} slots`);
}

/**
 * Acquire an instance slot for a fast enemy.
 * Returns { instanceId, pool } or null if pool exhausted.
 */
function acquireFastInstance() {
  if (!fastInstancePool.initialized) return null;
  const pool = fastInstancePool;

  let instanceId;
  if (pool.freeIndices.size > 0) {
    instanceId = pool.freeIndices.values().next().value;
    pool.freeIndices.delete(instanceId);
  } else if (pool.mesh.count < MAX_FAST_INSTANCES) {
    instanceId = pool.mesh.count;
    pool.mesh.count = instanceId + 1;
  } else {
    console.warn('[fast-instance] Pool exhausted! Falling back to individual mesh.');
    return null;
  }

  console.log(`[fast-instance] Acquired slot ${instanceId} (count=${pool.mesh.count}, free=${pool.freeIndices.size})`);
  return { instanceId, pool };
}

/**
 * Release an instance slot back to the fast pool.
 */
function releaseFastInstance(instanceId) {
  if (!fastInstancePool.initialized) return;
  const pool = fastInstancePool;

  // Hide instance by zeroing its matrix
  pool.mesh.setMatrixAt(instanceId, _fastDummyMatrix);
  pool.mesh.instanceMatrix.needsUpdate = true;
  pool.freeIndices.add(instanceId);

  console.log(`[fast-instance] Released slot ${instanceId} (count=${pool.mesh.count}, free=${pool.freeIndices.size})`);
}

/**
 * Release ALL fast instance slots (for level transitions).
 */
function releaseAllFastInstances() {
  if (!fastInstancePool.initialized) return;
  const pool = fastInstancePool;

  for (let i = 0; i < pool.mesh.count; i++) {
    pool.mesh.setMatrixAt(i, _fastDummyMatrix);
  }
  pool.mesh.instanceMatrix.needsUpdate = true;
  pool.mesh.count = 0;
  pool.freeIndices.clear();

  console.log('[fast-instance] All slots released (clearAllEnemies)');
}

// ── Tank enemy InstancedMesh pool ──────────────────────────
// One InstancedMesh for all 'tank' enemies. Tank uses a merged
// box geometry from its 2x2 voxel pattern (same approach as basic/fast).
const MAX_TANK_INSTANCES = 15;
const tankInstancePool = {
  mesh: null,
  freeIndices: new Set(),
  initialized: false,
};
const _tankDummyMatrix = new THREE.Matrix4().makeScale(0, 0, 0);
const _tankColorTmp = new THREE.Color();

/**
 * Build merged geometry for 'tank' enemy pattern and create InstancedMesh.
 * Called from initEnemies() after sceneRef is available.
 */
function initTankInstancePool() {
  if (tankInstancePool.initialized || !sceneRef) return;

  const def = ENEMY_DEFS.tank;
  const geo = getGeo(def.voxelSize);
  const rows = def.pattern.length;
  const cols = def.pattern[0].length;
  const cx = (cols - 1) / 2;
  const cy = (rows - 1) / 2;

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

  let tankGeo;
  if (geometries.length > 0) {
    tankGeo = mergeGeometries(geometries);
    geometries.forEach(g => g.dispose());
  }
  if (!tankGeo) {
    console.warn('[tank-instance] Failed to build merged geometry, falling back to box');
    tankGeo = new THREE.BoxGeometry(def.voxelSize, def.voxelSize, def.voxelSize);
  }

  const tankMat = new THREE.MeshBasicMaterial({
    transparent: true,
    depthWrite: false,
    opacity: 0.7,
  });

  const im = new THREE.InstancedMesh(tankGeo, tankMat, MAX_TANK_INSTANCES);
  im.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  im.count = 0;
  im.frustumCulled = false;

  // Initialize all instances as invisible (zero scale)
  for (let i = 0; i < MAX_TANK_INSTANCES; i++) {
    im.setMatrixAt(i, _tankDummyMatrix);
  }
  im.instanceMatrix.needsUpdate = true;

  sceneRef.add(im);
  tankInstancePool.mesh = im;
  tankInstancePool.initialized = true;

  console.log(`[tank-instance] Pool initialized: ${MAX_TANK_INSTANCES} slots`);
}

/**
 * Acquire an instance slot for a tank enemy.
 * Returns { instanceId, pool } or null if pool exhausted.
 */
function acquireTankInstance() {
  if (!tankInstancePool.initialized) return null;
  const pool = tankInstancePool;

  let instanceId;
  if (pool.freeIndices.size > 0) {
    instanceId = pool.freeIndices.values().next().value;
    pool.freeIndices.delete(instanceId);
  } else if (pool.mesh.count < MAX_TANK_INSTANCES) {
    instanceId = pool.mesh.count;
    pool.mesh.count = instanceId + 1;
  } else {
    console.warn('[tank-instance] Pool exhausted! Falling back to individual mesh.');
    return null;
  }

  console.log(`[tank-instance] Acquired slot ${instanceId} (count=${pool.mesh.count}, free=${pool.freeIndices.size})`);
  return { instanceId, pool };
}

/**
 * Release an instance slot back to the tank pool.
 */
function releaseTankInstance(instanceId) {
  if (!tankInstancePool.initialized) return;
  const pool = tankInstancePool;

  // Hide instance by zeroing its matrix
  pool.mesh.setMatrixAt(instanceId, _tankDummyMatrix);
  pool.mesh.instanceMatrix.needsUpdate = true;
  pool.freeIndices.add(instanceId);

  console.log(`[tank-instance] Released slot ${instanceId} (count=${pool.mesh.count}, free=${pool.freeIndices.size})`);
}

/**
 * Release ALL tank instance slots (for level transitions).
 */
function releaseAllTankInstances() {
  if (!tankInstancePool.initialized) return;
  const pool = tankInstancePool;

  for (let i = 0; i < pool.mesh.count; i++) {
    pool.mesh.setMatrixAt(i, _tankDummyMatrix);
  }
  pool.mesh.instanceMatrix.needsUpdate = true;
  pool.mesh.count = 0;
  pool.freeIndices.clear();

  console.log('[tank-instance] All slots released (clearAllEnemies)');
}

// ── Swarm enemy InstancedMesh pool ─────────────────────────
// One InstancedMesh for all 'swarm' enemies = 1 draw call instead of N.
const MAX_SWARM_INSTANCES = 60;
const swarmInstancePool = {
  mesh: null,
  freeIndices: new Set(),
  initialized: false,
};
const _swarmDummyMatrix = new THREE.Matrix4().makeScale(0, 0, 0);
const _swarmColorTmp = new THREE.Color();

/**
 * Build merged geometry for 'swarm' enemy pattern and create InstancedMesh.
 * Called from initEnemies() after sceneRef is available.
 */
function initSwarmInstancePool() {
  if (swarmInstancePool.initialized || !sceneRef) return;

  const def = ENEMY_DEFS.swarm;
  const geo = getGeo(def.voxelSize);
  const rows = def.pattern.length;
  const cols = def.pattern[0].length;
  const cx = (cols - 1) / 2;
  const cy = (rows - 1) / 2;

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

  let swarmGeo;
  if (geometries.length > 0) {
    swarmGeo = mergeGeometries(geometries);
    geometries.forEach(g => g.dispose());
  }
  if (!swarmGeo) {
    console.warn('[swarm-instance] Failed to build merged geometry, falling back to box');
    swarmGeo = new THREE.BoxGeometry(def.voxelSize, def.voxelSize, def.voxelSize);
  }

  const swarmMat = new THREE.MeshBasicMaterial({
    transparent: true,
    depthWrite: false,
    opacity: 0.7,
  });

  const im = new THREE.InstancedMesh(swarmGeo, swarmMat, MAX_SWARM_INSTANCES);
  im.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  im.count = 0;
  im.frustumCulled = false;

  // Initialize all instances as invisible (zero scale)
  for (let i = 0; i < MAX_SWARM_INSTANCES; i++) {
    im.setMatrixAt(i, _swarmDummyMatrix);
  }
  im.instanceMatrix.needsUpdate = true;

  sceneRef.add(im);
  swarmInstancePool.mesh = im;
  swarmInstancePool.initialized = true;

  console.log(`[swarm-instance] Pool initialized: ${MAX_SWARM_INSTANCES} slots`);
}

/**
 * Acquire an instance slot for a swarm enemy.
 * Returns { instanceId, pool } or null if pool exhausted.
 */
function acquireSwarmInstance() {
  if (!swarmInstancePool.initialized) return null;
  const pool = swarmInstancePool;

  let instanceId;
  if (pool.freeIndices.size > 0) {
    instanceId = pool.freeIndices.values().next().value;
    pool.freeIndices.delete(instanceId);
  } else if (pool.mesh.count < MAX_SWARM_INSTANCES) {
    instanceId = pool.mesh.count;
    pool.mesh.count = instanceId + 1;
  } else {
    console.warn('[swarm-instance] Pool exhausted! Falling back to individual mesh.');
    return null;
  }

  console.log(`[swarm-instance] Acquired slot ${instanceId} (count=${pool.mesh.count}, free=${pool.freeIndices.size})`);
  return { instanceId, pool };
}

/**
 * Release an instance slot back to the swarm pool.
 */
function releaseSwarmInstance(instanceId) {
  if (!swarmInstancePool.initialized) return;
  const pool = swarmInstancePool;

  // Hide instance by zeroing its matrix
  pool.mesh.setMatrixAt(instanceId, _swarmDummyMatrix);
  pool.mesh.instanceMatrix.needsUpdate = true;
  pool.freeIndices.add(instanceId);

  console.log(`[swarm-instance] Released slot ${instanceId} (count=${pool.mesh.count}, free=${pool.freeIndices.size})`);
}

/**
 * Release ALL swarm instance slots (for level transitions).
 */
function releaseAllSwarmInstances() {
  if (!swarmInstancePool.initialized) return;
  const pool = swarmInstancePool;

  for (let i = 0; i < pool.mesh.count; i++) {
    pool.mesh.setMatrixAt(i, _swarmDummyMatrix);
  }
  pool.mesh.instanceMatrix.needsUpdate = true;
  pool.mesh.count = 0;
  pool.freeIndices.clear();

  console.log('[swarm-instance] All slots released (clearAllEnemies)');
}

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
    depthWrite: false,
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
  group.userData.enemyType = type; // For debug identification

  // Add hitbox
  const hitboxGeo = new THREE.BoxGeometry(def.hitboxRadius * 2, def.hitboxRadius * 2, def.hitboxRadius * 2);
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
    voxelSize: def.voxelSize,
    baseSpeed: def.baseSpeed * levelConfig.speedMultiplier,
    levelConfig,
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
    hitbox,
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
function spawnElectricArc(fromPos, toPos, color = 0xffcc00) {
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
    color,
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
 * Clear all electric arcs (for level transitions).
 */
export function clearAllElectricArcs() {
  for (let i = electricArcs.length - 1; i >= 0; i--) {
    const arc = electricArcs[i];
    sceneRef.remove(arc.mesh);
    arc.mesh.geometry.dispose();
    arc.mesh.material.dispose();
  }
  electricArcs.length = 0;
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
      depthWrite: false,
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
    group.userData.enemyType = 'geometry_shifter_split'; // For debug identification

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
      depthWrite: false,
      opacity: 0.5,
    });

    const group = new THREE.Group();
    // Simple pattern
    const cube = new THREE.Mesh(geo, mat.clone());
    group.add(cube);

    group.position.copy(spawnPos);
    group.scale.setScalar(0.7);
    group.userData.isEnemy = true;
    group.userData.enemyType = 'clone_mimic_split'; // For debug identification

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

  // Initialize telegraphing system
  if (!telegraphingSystem) {
    telegraphingSystem = new TelegraphingSystem(scene, null);
  }

  // Initialize basic enemy InstancedMesh pool
  initBasicInstancePool();

  // Initialize tank enemy InstancedMesh pool
  initTankInstancePool();

  // Initialize fast enemy InstancedMesh pool
  initFastInstancePool();

  // Initialize swarm enemy InstancedMesh pool
  initSwarmInstancePool();
}

/**
 * Spawn a single enemy of the given type at `position`.
 * `levelConfig` from game.js provides HP/speed multipliers.
 */
export function spawnEnemy(type, position, levelConfig) {
  const def = ENEMY_DEFS[type];
  if (!def) return;
  if (type === 'mirror_knight' && activeEnemies.some(enemy => enemy.isMirror)) return;

  // Handle special enemy types
  if (def.isTrain) {
    return spawnTrainEnemy(type, position, levelConfig);
  }

  // Clone shared material (clone is cheap, shares shader program)
  if (!sharedMaterials[type]) {
    sharedMaterials[type] = new THREE.MeshBasicMaterial({
      color: def.color,
      transparent: true,
      depthWrite: false,
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

  // ── Basic enemy InstancedMesh path ──
  // Basic enemies use the InstancedMesh pool for rendering.
  // The group only holds the invisible hitbox for raycasting compatibility.
  let useInstancedBasic = false;
  if (type === 'basic') {
    const instance = acquireBasicInstance();
    if (instance) {
      useInstancedBasic = true;
      group.userData.instanceId = instance.instanceId;
      group.userData.instancePool = instance.pool;

      // Position the group and sync the instance matrix
      group.position.copy(position);
      group.updateMatrix();
      instance.pool.mesh.setMatrixAt(instance.instanceId, group.matrix);
      instance.pool.mesh.instanceMatrix.needsUpdate = true;

      // Set initial instance color
      instance.pool.mesh.setColorAt(instance.instanceId, _basicColorTmp.setHex(def.color));
      if (instance.pool.mesh.instanceColor) instance.pool.mesh.instanceColor.needsUpdate = true;
    }
    // If pool exhausted, fall through to normal path
  }

  // ── Fast enemy InstancedMesh path ──
  let useInstancedFast = false;
  if (type === 'fast') {
    const instance = acquireFastInstance();
    if (instance) {
      useInstancedFast = true;
      group.userData.instanceId = instance.instanceId;
      group.userData.instancePool = instance.pool;

      // Position the group and sync the instance matrix
      group.position.copy(position);
      group.updateMatrix();
      instance.pool.mesh.setMatrixAt(instance.instanceId, group.matrix);
      instance.pool.mesh.instanceMatrix.needsUpdate = true;

      // Set initial instance color
      instance.pool.mesh.setColorAt(instance.instanceId, _fastColorTmp.setHex(def.color));
      if (instance.pool.mesh.instanceColor) instance.pool.mesh.instanceColor.needsUpdate = true;
    }
    // If pool exhausted, fall through to normal path
  }

  // ── Swarm enemy InstancedMesh path ──
  let useInstancedSwarm = false;
  if (type === 'swarm') {
    const instance = acquireSwarmInstance();
    if (instance) {
      useInstancedSwarm = true;
      group.userData.instanceId = instance.instanceId;
      group.userData.instancePool = instance.pool;

      // Position the group and sync the instance matrix
      group.position.copy(position);
      group.updateMatrix();
      instance.pool.mesh.setMatrixAt(instance.instanceId, group.matrix);
      instance.pool.mesh.instanceMatrix.needsUpdate = true;

      // Set initial instance color
      instance.pool.mesh.setColorAt(instance.instanceId, _swarmColorTmp.setHex(def.color));
      if (instance.pool.mesh.instanceColor) instance.pool.mesh.instanceColor.needsUpdate = true;
    }
    // If pool exhausted, fall through to normal path
  }

  // ── Tank enemy InstancedMesh path ──
  let useInstancedTank = false;
  if (type === 'tank') {
    const instance = acquireTankInstance();
    if (instance) {
      useInstancedTank = true;
      group.userData.instanceId = instance.instanceId;
      group.userData.instancePool = instance.pool;

      // Position the group and sync the instance matrix
      group.position.copy(position);
      group.updateMatrix();
      instance.pool.mesh.setMatrixAt(instance.instanceId, group.matrix);
      instance.pool.mesh.instanceMatrix.needsUpdate = true;

      // Set initial instance color
      instance.pool.mesh.setColorAt(instance.instanceId, _tankColorTmp.setHex(def.color));
      if (instance.pool.mesh.instanceColor) instance.pool.mesh.instanceColor.needsUpdate = true;
    }
    // If pool exhausted, fall through to normal path
  }

  // For non-instanced basic/fast/swarm/tank and all other non-tank, non-jelly enemies,
  // merge voxel geometries into a single mesh
  if (!useInstancedBasic && !useInstancedFast && !useInstancedSwarm && !useInstancedTank && !isTank && !def.isJelly) {
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
  } else if (isTank && !useInstancedTank) {
    // Tank (non-instanced fallback): keep individual voxels for weak-point targeting
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
  } else if (def.isJelly) {
    // Jelly: individual voxels for shrink mechanic
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
  group.userData.enemyType = type; // For debug identification

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

  if (def.isJelly) {
    if (hitbox.geometry) hitbox.geometry.dispose();
    const jellyHeight = (def.jellyBaseHeight || def.pattern.length) * def.voxelSize * 1.05;
    hitbox.geometry = new THREE.BoxGeometry(def.hitboxRadius * 2, jellyHeight, def.hitboxRadius * 2);
  }

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
    voxelSize: def.voxelSize,
    hitbox,
    baseSpeed: def.baseSpeed * levelConfig.speedMultiplier,
    levelConfig,
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

    isJelly: def.isJelly || false,
    jellyHeight: def.jellyBaseHeight || 0,
    jellyBaseHeight: def.jellyBaseHeight || 0,
    jellyBaseHp: Math.round(def.baseHp * levelConfig.hpMultiplier),
    jellySpeedBoost: def.jellySpeedBoost || 0,

    isConductor: def.isConductor || false,
    linkRadius: def.linkRadius || 4.0,
    linkSpeedBonus: def.linkSpeedBonus || 0.4,
    linkDamageReduction: def.linkDamageReduction || 0.3,
    conductorHoldDistance: def.conductorHoldDistance || 6.5,
    conductorArcCooldown: def.conductorArcCooldown || 0.25,
    conductorArcTimer: 0,
    conductorStrafeDir: Math.random() < 0.5 ? -1 : 1,
    conductorStrafeTimer: 0.6 + Math.random() * 0.6,
    linkedEnemies: [],
    linkedByConductor: false,
    linkedDamageReduction: 0,

    isMirror: def.isMirror || false,
    mirrorPhase: 1,
    mirrorImmune: false,
    mirrorImmuneTimer: 0,
    mirrorSpeedBoost: def.mirrorSpeedBoost || 0.3,
    mirrorImmuneDuration: def.mirrorImmuneDuration || 1.2,

    isPhase: def.isPhase || false,
    phaseStunDuration: def.phaseStunDuration || 0.35,
    phaseVanishDelay: def.phaseVanishDelay || 0.5,
    phaseReappearDelay: def.phaseReappearDelay || 1.2,
    phaseSpawnCooldown: def.phaseSpawnCooldown || 6.0,
    phaseSpawnTimer: def.phaseSpawnCooldown ? def.phaseSpawnCooldown * 0.5 : 3.0,
    phaseStunTimer: 0,
    phaseVanishTimer: 0,
    phaseReappearTimer: 0,
    phaseHidden: false,
    phasePreferredDistMin: def.phasePreferredDistMin || 5.5,
    phasePreferredDistMax: def.phasePreferredDistMax || 9.5,
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

  for (let i = 0; i < activeEnemies.length; i++) {
    const e = activeEnemies[i];
    if (e.baseSpeed !== undefined) {
      if (e.isJelly) {
        e.speed = e.baseSpeed + (e.jellyBaseHeight - e.jellyHeight) * e.jellySpeedBoost;
      } else {
        e.speed = e.baseSpeed;
      }
    }
    e.linkedByConductor = false;
    e.linkedDamageReduction = 0;
  }

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

    if (!e.isMirror && !e.isConductor && !e.isPhase) {
      e.mesh.position.addScaledVector(_dir, e.speed * speedMod * dt);
    }

    // Sync InstancedMesh matrix for basic/fast enemies
    if (e.mesh.userData.instanceId !== undefined) {
      e.mesh.updateMatrix();
      const iid = e.mesh.userData.instanceId;
      e.mesh.userData.instancePool.mesh.setMatrixAt(iid, e.mesh.matrix);
      e.mesh.userData.instancePool.mesh.instanceMatrix.needsUpdate = true;
    }

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
            setMaterialEmissiveSafe(c.material, new THREE.Color(0xffffff), (e.fireTimer - 2.0) / 0.5);
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
      if (e.mirrorImmune) {
        e.mirrorImmuneTimer -= dt;
        if (e.mirrorImmuneTimer <= 0) {
          e.mirrorImmune = false;
        }
        e.mesh.traverse(c => {
          if (c.isMesh && c.material && !c.userData.isEnemyHitbox) {
            const pulse = 0.5 + Math.sin(now * 0.02) * 0.3;
            c.material.opacity = pulse;
            setMaterialEmissiveSafe(c.material, new THREE.Color(0xd0d0d0), 0.8);
          }
        });
      } else {
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

        const phaseSpeed = 1 + (e.mirrorPhase - 1) * e.mirrorSpeedBoost;

        // Confused state: move randomly
        if (e.mirrorConfused) {
          e.mirrorConfuseTimer -= dt;
          if (e.mirrorConfuseTimer <= 0) {
            e.mirrorConfused = false;
          } else {
            const randDir = new THREE.Vector3(
              Math.sin(now * 0.01 + i),
              0,
              Math.cos(now * 0.01 + i)
            ).normalize();
            e.mesh.position.addScaledVector(randDir, e.speed * speedMod * dt * 0.5 * phaseSpeed);
          }
        } else {
          // Mirror player's horizontal movement (opposite direction)
          const mirrorDir = _dir.clone();
          mirrorDir.x *= -1; // Opposite horizontal movement
          e.mesh.position.addScaledVector(mirrorDir, e.speed * speedMod * dt * phaseSpeed);
        }

        // Shield visual effect
        e.mesh.traverse(c => {
          if (c.isMesh && c.material && !c.userData.isEnemyHitbox) {
            const reflectGlow = Math.sin(now * 0.003) * 0.2 + 0.5;
            c.material.opacity = reflectGlow;
          }
        });
      }
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
        clampPositionToFrontArc(e.mesh.position, playerPos, 2.5, 12, 120);
        e.portalTimer = 0;
        e.portalDisoriented = true;
        e.portalDisorientTimer = 0.5;
      }

      // Portal glow effect when ready to teleport
      if (e.portalTimer >= e.portalCooldown * 0.7) {
        e.mesh.traverse(c => {
          if (c.isMesh && c.material && !c.userData.isEnemyHitbox) {
            setMaterialEmissiveSafe(c.material, new THREE.Color(0x00ffaa), 0.5);
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
          setMaterialEmissiveSafe(c.material, new THREE.Color(0x220033), 0.5);
        }
      });

      // Rotation effect
      e.mesh.rotation.y += dt * 2;
    }

    // Conductor: links to nearby enemies
    if (e.isConductor) {
      e.conductorStrafeTimer -= dt;
      if (e.conductorStrafeTimer <= 0) {
        e.conductorStrafeTimer = 0.6 + Math.random() * 0.6;
        e.conductorStrafeDir *= -1;
      }

      const perp = new THREE.Vector3(-_dir.z, 0, _dir.x).normalize();
      const holdDist = e.conductorHoldDistance || 6.5;

      if (dist < holdDist * 0.85) {
        e.mesh.position.addScaledVector(_dir, -e.speed * 0.6 * speedMod * dt);
      } else if (dist > holdDist * 1.15) {
        e.mesh.position.addScaledVector(_dir, e.speed * 0.35 * speedMod * dt);
      }
      e.mesh.position.addScaledVector(perp, e.speed * 0.6 * speedMod * e.conductorStrafeDir * dt);

      e.linkedEnemies = [];
      e.conductorArcTimer -= dt;

      for (let j = 0; j < activeEnemies.length; j++) {
        if (i === j) continue;
        const other = activeEnemies[j];
        if (other.isConductor) continue;
        const linkDist = e.mesh.position.distanceTo(other.mesh.position);
        if (linkDist <= e.linkRadius) {
          e.linkedEnemies.push(j);
          other.linkedByConductor = true;
          other.linkedDamageReduction = Math.max(other.linkedDamageReduction, e.linkDamageReduction);
          other.speed = other.baseSpeed * (1 + e.linkSpeedBonus);

          if (e.conductorArcTimer <= 0) {
            spawnElectricArc(e.mesh.position.clone(), other.mesh.position.clone(), 0xff66cc);
          }

          other.mesh.traverse(c => {
            if (c.isMesh && c.material && !c.userData.isEnemyHitbox) {
              setMaterialEmissiveSafe(c.material, new THREE.Color(0xff66cc), 0.35);
            }
          });
        }
      }

      if (e.linkedEnemies.length > 0 && e.conductorArcTimer <= 0) {
        e.conductorArcTimer = e.conductorArcCooldown;
      }

      e.mesh.traverse(c => {
        if (c.isMesh && c.material && !c.userData.isEnemyHitbox) {
          setMaterialEmissiveSafe(c.material, new THREE.Color(0xff66cc), e.linkedEnemies.length > 0 ? 0.7 : 0.3);
        }
      });
    }

    // Phase Wraith: appears midfield, spawns swarm, blinks out when shot
    if (e.isPhase) {
      if (e.phaseHidden) {
        e.phaseReappearTimer -= dt;
        if (e.phaseReappearTimer <= 0) {
          e.phaseHidden = false;
          e.phaseReappearTimer = 0;
          const distTarget = e.phasePreferredDistMin + Math.random() * (e.phasePreferredDistMax - e.phasePreferredDistMin);
          const angle = (Math.random() - 0.5) * Math.PI * 0.8;
          const baseDir = _dir.lengthSq() > 0.0001 ? _dir.clone() : new THREE.Vector3(0, 0, -1);
          const spawnDir = baseDir.applyAxisAngle(new THREE.Vector3(0, 1, 0), angle);
          e.mesh.position.set(
            playerPos.x + spawnDir.x * distTarget,
            1.2 + Math.random() * 1.2,
            playerPos.z + spawnDir.z * distTarget
          );
          clampPositionToFrontArc(e.mesh.position, playerPos, e.phasePreferredDistMin, e.phasePreferredDistMax, 120);
          e.mesh.visible = true;
          if (typeof window !== 'undefined' && window.playPhaseWraithAppear) {
            window.playPhaseWraithAppear();
          }
        }
      } else {
        if (e.phaseStunTimer > 0) {
          e.phaseStunTimer -= dt;
        } else {
          if (dist < e.phasePreferredDistMin) {
            e.mesh.position.addScaledVector(_dir, -e.speed * 0.4 * speedMod * dt);
          } else if (dist > e.phasePreferredDistMax) {
            e.mesh.position.addScaledVector(_dir, e.speed * 0.4 * speedMod * dt);
          }
        }

        if (e.phaseVanishTimer > 0) {
          e.phaseVanishTimer -= dt;
          if (e.phaseVanishTimer <= 0) {
            e.phaseHidden = true;
            e.phaseReappearTimer = e.phaseReappearDelay;
            e.mesh.visible = false;
          }
        }

        e.phaseSpawnTimer -= dt;
        if (e.phaseSpawnTimer <= 0) {
          e.phaseSpawnTimer = e.phaseSpawnCooldown;
          const spawnPos = e.mesh.position.clone();
          spawnPos.x += (Math.random() - 0.5) * 1.2;
          spawnPos.z += (Math.random() - 0.5) * 1.2;
          spawnEnemy('swarm', spawnPos, e.levelConfig);
          if (typeof window !== 'undefined' && window.playPhaseWraithSpawn) {
            window.playPhaseWraithSpawn();
          }
        }
      }

      e.mesh.traverse(c => {
        if (c.isMesh && c.material && !c.userData.isEnemyHitbox) {
          const targetOpacity = e.phaseHidden ? 0.05 : (e.phaseStunTimer > 0 ? 0.35 : 0.85);
          c.material.opacity = targetOpacity;
          setMaterialEmissiveSafe(c.material, new THREE.Color(0x8844ff), e.phaseHidden ? 0.2 : 0.5);
        }
      });
    }

    if (e.isPhase && e.phaseHidden) {
      continue;
    }

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
    // For instanced enemies, sync color directly to InstancedMesh (e.material is null for instanced types)
    const dmgRatio = 1 - e.hp / e.maxHp;
    if (e.mesh.userData.instanceId !== undefined) {
      // Instanced enemy: calculate damage color and sync to InstancedMesh
      const damageColor = new THREE.Color().copy(e.baseColor).lerp(_redColor, dmgRatio);
      const pool = e.mesh.userData.instancePool;
      pool.mesh.setColorAt(e.mesh.userData.instanceId, damageColor);
      pool.mesh.instanceColor.needsUpdate = true;
    } else {
      // Non-instanced enemy: update material color directly
      if (e.material) {
        e.material.color.copy(e.baseColor).lerp(_redColor, dmgRatio);
      }
    }
  }

  updatePulseBomberRings(dt, now, playerPos);

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

  if (e.isMirror && e.mirrorImmune) {
    playTingSound();
    return { killed: false, enemy: e, immune: true };
  }

  if (e.isPhase && e.phaseHidden) {
    return { killed: false, enemy: e, immune: true };
  }

  // Train segment hits: pop the segment, keep the head alive
  if (e.isTrain && hitInfo.trainIndex !== undefined && !hitInfo.isScout) {
    const hitObject = hitInfo.hitObject && hitInfo.hitObject.userData?.trainIndex !== undefined
      ? hitInfo.hitObject
      : null;
    const segment = hitObject || (e.trailingVoxels || []).find(v => v.userData.trainIndex === hitInfo.trainIndex);

    if (segment) {
      const segmentPos = new THREE.Vector3();
      segment.getWorldPosition(segmentPos);
      e.mesh.remove(segment);
      if (segment.material) segment.material.dispose();
      e.trailingVoxels = (e.trailingVoxels || []).filter(v => v !== segment);
      e.trainLength = (e.trailingVoxels?.length || 0) + 1;

      if (e.hitbox) {
        if (e.hitbox.geometry) e.hitbox.geometry.dispose();
        const length = e.trainLength * e.voxelSize * 1.5;
        e.hitbox.geometry = new THREE.BoxGeometry(e.hitboxRadius * 2, e.hitboxRadius * 2, length);
        e.hitbox.position.z = -(e.trainLength * e.voxelSize * 0.75);
      }

      if (spawnVoxelExplosion) {
        spawnVoxelExplosion(segmentPos, e.baseColor.getHex(), 2, e.type, false, false);
      }
    }

    return { killed: false, enemy: e, segmentDestroyed: true };
  }

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

  if (e.linkedByConductor && e.linkedDamageReduction > 0) {
    actualDamage *= (1 - e.linkedDamageReduction);
  }

  e.hp -= actualDamage;
  if (e.hp <= 0) {
    if (e.isJelly && e.jellyHeight > 1) {
      shrinkJelly(e);
      return { killed: false, enemy: e, jellyShrunk: true };
    }
    return { killed: true, enemy: e, overkill: -e.hp };
  }

  if (e.isMirror && !e.mirrorImmune) {
    const threshold2 = e.maxHp * (2 / 3);
    const threshold1 = e.maxHp * (1 / 3);
    if (e.mirrorPhase === 1 && e.hp <= threshold2) {
      e.mirrorPhase = 2;
      e.mirrorImmune = true;
      e.mirrorImmuneTimer = e.mirrorImmuneDuration;
      e.speed = e.baseSpeed + (e.mirrorPhase - 1) * e.mirrorSpeedBoost;
      playTingSound();
    } else if (e.mirrorPhase === 2 && e.hp <= threshold1) {
      e.mirrorPhase = 3;
      e.mirrorImmune = true;
      e.mirrorImmuneTimer = e.mirrorImmuneDuration;
      e.speed = e.baseSpeed + (e.mirrorPhase - 1) * e.mirrorSpeedBoost;
      playTingSound();
    }
  }

  if (e.isPhase && e.hp > 0 && !e.phaseHidden) {
    e.phaseStunTimer = e.phaseStunDuration;
    e.phaseVanishTimer = e.phaseVanishDelay;
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

  // Release InstancedMesh slot for basic enemies
  if (e.type === 'basic' && e.mesh.userData.instanceId !== undefined) {
    releaseBasicInstance(e.mesh.userData.instanceId);
  }

  // Release InstancedMesh slot for fast enemies
  if (e.type === 'fast' && e.mesh.userData.instanceId !== undefined) {
    releaseFastInstance(e.mesh.userData.instanceId);
  }

  // Release InstancedMesh slot for swarm enemies
  if (e.type === 'swarm' && e.mesh.userData.instanceId !== undefined) {
    releaseSwarmInstance(e.mesh.userData.instanceId);
  }

  // Release InstancedMesh slot for tank enemies
  if (e.type === 'tank' && e.mesh.userData.instanceId !== undefined) {
    releaseTankInstance(e.mesh.userData.instanceId);
  }

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
  console.log(`[enemy-death] destroyEnemy: spawnVoxelExplosion=${!!spawnVoxelExplosion}, type=${e.type}`);
  if (spawnVoxelExplosion) {
    // Reduced voxel counts for performance (big: 5-6, small: 2-3)
    let voxelCount = e.type === 'tank' ? 6 : e.type === 'basic' ? 4 : 3;
    // New enemy voxel counts
    if (e.isTrain) voxelCount = Math.min(e.trainLength || 5, 5); // Cap train voxels
    if (e.shapeShift) voxelCount = 5;
    if (e.isRanged) voxelCount = 5;
    if (e.isMimic) voxelCount = 4;
    if (e.isSpider) voxelCount = 3;
    // Small enemies get fewer bits
    if (e.type === 'swarm') voxelCount = 2;
    if (e.type === 'fast') voxelCount = 3;

    console.log(`[enemy-death] Spawning ${voxelCount} voxels at (${pos.x.toFixed(2)}, ${pos.y.toFixed(2)}, ${pos.z.toFixed(2)})`);
    spawnVoxelExplosion(pos, color.getHex(), voxelCount, e.type, isCritical, isOverkill);
  } else {
    console.warn('[enemy-death] spawnVoxelExplosion is NULL!');
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
  // Dispose merged geometry if present (skip if instanced - geometry lives in pool)
  if (e.mesh.userData.instanceId === undefined) {
    e.mesh.traverse(c => {
      if (c.isMesh && c.userData.isMergedGeometry && c.geometry) {
        c.geometry.dispose();
      }
    });
  }
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
  // Release all basic enemy InstancedMesh slots
  releaseAllBasicInstances();

  // Release all fast enemy InstancedMesh slots
  releaseAllFastInstances();

  // Release all swarm enemy InstancedMesh slots
  releaseAllSwarmInstances();

  // Release all tank enemy InstancedMesh slots
  releaseAllTankInstances();

  for (let i = activeEnemies.length - 1; i >= 0; i--) {
    sceneRef.remove(activeEnemies[i].mesh);
    // Dispose merged geometry (skip if instanced - geometry lives in pool)
    if (activeEnemies[i].mesh.userData.instanceId === undefined) {
      activeEnemies[i].mesh.traverse(c => {
        if (c.isMesh && c.userData.isMergedGeometry && c.geometry) {
          c.geometry.dispose();
        }
      });
    }
    if (activeEnemies[i].material) {
      activeEnemies[i].material.dispose();
    }
  }
  activeEnemies.length = 0;
  _enemyMeshesDirty = true;  // Invalidate cache

  for (let i = pulseBomberRings.length - 1; i >= 0; i--) {
    const ring = pulseBomberRings[i];
    sceneRef.remove(ring);
    ring.geometry.dispose();
    ring.material.dispose();
  }
  pulseBomberRings.length = 0;
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

// ── TELEGRAPHING SYSTEM ──────────────────────────────────────
// Telegraphing system for boss attacks: visual/audio warnings
class TelegraphingSystem {
  constructor(scene, camera) {
    this.scene = scene;
    this.camera = camera;
    this.activeEffects = [];
    this.maxEffects = 10; // Performance limit
  }

  // Clear all active telegraph effects (for level transitions)
  clearAll() {
    for (const effect of this.activeEffects) {
      this.removeEffect(effect);
    }
    this.activeEffects.length = 0;
  }

  // Start a telegraphing effect (visual warning)
  // type: 'projectile', 'charge', 'minion', 'melee', 'teleport'
  // duration: how long the telegraph lasts
  // color: visual color for the effect
  start(type, duration, color, position = null, direction = null) {
    if (this.activeEffects.length >= this.maxEffects) {
      // Remove oldest effect
      const removed = this.activeEffects.shift();
      this.removeEffect(removed);
    }

    const effect = {
      type,
      startTime: performance.now(),
      duration,
      color,
      mesh: null,
      data: {}
    };

    // Create visual representation based on type
    this.createVisual(effect, position, direction);

    if (effect.mesh) {
      this.scene.add(effect.mesh);
    }

    this.activeEffects.push(effect);
    return effect;
  }

  createVisual(effect, position, direction) {
    const now = performance.now();

    switch (effect.type) {
      case 'projectile':
        // 3D sphere that expands outward
        const projGeo = new THREE.SphereGeometry(0.25, 16, 16);
        const projMat = new THREE.MeshBasicMaterial({
          color: effect.color,
          transparent: true,
          opacity: 0.8,
          wireframe: false
        });
        effect.mesh = new THREE.Mesh(projGeo, projMat);
        if (position) {
          effect.mesh.position.copy(position);
        } else if (this.camera) {
          effect.mesh.position.set(
            this.camera.position.x,
            this.camera.position.y + 1.5,
            this.camera.position.z - 8
          );
        }
        effect.data.velocity = direction ? direction.clone() : new THREE.Vector3(0, 0, -1);
        break;

      case 'charge':
        // Large expanding sphere from player
        const chargeGeo = new THREE.SphereGeometry(0.1, 16, 16);
        const chargeMat = new THREE.MeshBasicMaterial({
          color: effect.color,
          transparent: true,
          opacity: 0.6
        });
        effect.mesh = new THREE.Mesh(chargeGeo, chargeMat);
        effect.mesh.scale.set(0.1, 0.1, 0.1);
        if (this.camera) {
          effect.mesh.position.set(
            this.camera.position.x,
            this.camera.position.y + 0.5,
            this.camera.position.z - 2
          );
        }
        break;

      case 'minion':
        // 3D sphere indicating spawn direction
        const minionGeo = new THREE.SphereGeometry(0.3, 16, 16);
        const minionMat = new THREE.MeshBasicMaterial({
          color: effect.color,
          transparent: true,
          opacity: 0.7
        });
        effect.mesh = new THREE.Mesh(minionGeo, minionMat);
        if (this.camera) {
          effect.mesh.position.set(
            this.camera.position.x,
            this.camera.position.y + 1.5,
            this.camera.position.z - 8
          );
        }
        break;

      case 'teleport':
        // Spinning eye effect
        const eyeGeo = new THREE.CircleGeometry(0.8, 32);
        const eyeMat = new THREE.MeshBasicMaterial({
          color: effect.color,
          transparent: true,
          opacity: 0.5,
          side: THREE.DoubleSide
        });
        effect.mesh = new THREE.Mesh(eyeGeo, eyeMat);
        effect.mesh.rotation.x = -Math.PI / 2;
        effect.data.spinSpeed = 0.1;
        break;

      case 'melee':
        // Large 3D sphere indicating melee attack
        const meleeGeo = new THREE.SphereGeometry(0.6, 16, 16);
        const meleeMat = new THREE.MeshBasicMaterial({
          color: effect.color,
          transparent: true,
          opacity: 0.6
        });
        effect.mesh = new THREE.Mesh(meleeGeo, meleeMat);
        break;
    }
  }

  update(dt, now) {
    for (let i = this.activeEffects.length - 1; i >= 0; i--) {
      const effect = this.activeEffects[i];
      const elapsed = (now - effect.startTime) / 1000; // seconds

      if (elapsed >= effect.duration) {
        this.removeEffect(effect);
        this.activeEffects.splice(i, 1);
        continue;
      }

      // Animate based on type
      switch (effect.type) {
        case 'projectile':
          if (effect.mesh) {
            const progress = elapsed / effect.duration;
            effect.mesh.scale.setScalar(1 + progress * 2);
            effect.mesh.material.opacity = 0.8 * (1 - progress);
          }
          break;

        case 'charge':
          if (effect.mesh) {
            const progress = elapsed / effect.duration;
            effect.mesh.scale.setScalar(0.1 + progress * 3);
            effect.mesh.material.opacity = 0.6 * (1 - progress);
          }
          break;

        case 'minion':
          if (effect.mesh) {
            const progress = elapsed / effect.duration;
            effect.mesh.scale.setScalar(0.1 + progress * 1.5);
            effect.mesh.material.opacity = 0.7 * (1 - progress);
          }
          break;

        case 'teleport':
          if (effect.mesh) {
            effect.mesh.rotation.z += effect.data.spinSpeed || 0.05;
            const progress = elapsed / effect.duration;
            effect.mesh.scale.setScalar(0.8 + progress * 0.5);
            effect.mesh.material.opacity = 0.5 * (1 - progress);
          }
          break;

        case 'melee':
          if (effect.mesh) {
            const progress = elapsed / effect.duration;
            effect.mesh.scale.setScalar(0.2 + progress * 2);
            effect.mesh.material.opacity = 0.6 * (1 - progress);
            effect.mesh.rotation.y += dt * 2;
          }
          break;
      }
    }
  }

  removeEffect(effect) {
    if (effect && effect.mesh && this.scene) {
      this.scene.remove(effect.mesh);
      if (effect.mesh.geometry) {
        effect.mesh.geometry.dispose();
      }
      if (effect.mesh.material) {
        effect.mesh.material.dispose();
      }
    }
  }

  // Play a sound for telegraphing
  playSound(type, duration) {
    // Use audio module if available
    if (typeof window !== 'undefined' && window.playBossAttackSound) {
      window.playBossAttackSound(type, duration);
    }
  }

  // Check if a telegraphing effect should be removed (e.g., after attack finishes)
  finish(type) {
    const index = this.activeEffects.findIndex(e => e.type === type);
    if (index !== -1) {
      const effect = this.activeEffects[index];
      this.removeEffect(effect);
      this.activeEffects.splice(index, 1);
      this.playSound(type, effect.duration);
    }
  }
}

// ── BOSS BASE CLASS ─────────────────────────────────────────
class Boss {
  constructor(def, levelConfig, sceneRef, telegraphing) {
    this.def = def;
    this.levelConfig = levelConfig;
    this.sceneRef = sceneRef;
    this.telegraphing = telegraphing;

    // HP and phases
    this.maxHp = Math.round(def.baseHp * levelConfig.hpMultiplier);
    this.hp = this.maxHp;
    this.phase = 1;
    this.phases = def.phases || 3;

    // Stats
    this.scoreValue = def.scoreValue;
    this.baseColor = new THREE.Color(def.color);

    // Mesh
    this.mesh = this.buildMesh(def);
    this.mesh.position.set(0, 1.5, -12);
    this.mesh.userData.isBoss = true;
    this.sceneRef.add(this.mesh);

    // Behavior state
    this.state = 'idle';
    this.stateTimer = 0;
    this.stateStartTime = 0;

    // Weak points
    this.weakPoints = [];
    if (def.weakPoints !== false) {
      this.createWeakPoints();
    } else {
      // Skip automatic weak point creation for bosses with custom weak points
      // Subclasses will add their own weak points
    }

    // Minion spawning
    this.minionSpawnTimer = 0;
    this.minionSpawnRate = def.minionSpawnRate || 0;

    // Projectiles
    this.projectileTimer = 0;
    this.projectileRate = def.projectileRate || 0;

    // Telegraphing cooldown
    this.telegraphCooldown = 0;

    // Front-arc constraints
    this.frontArc = def.frontArc || 120;
    this.minDistance = def.minDistance || 6;
    this.maxDistance = def.maxDistance || 18;
  }

  buildMesh(def) {
    const group = new THREE.Group();
    const geo = getGeo(def.voxelSize);
    const mat = new THREE.MeshBasicMaterial({
      color: def.color,
      transparent: true,
      opacity: 0.9
    });
    const rows = def.pattern.length;
    const cols = def.pattern[0].length;
    const cx = (cols - 1) / 2;
    const cy = (rows - 1) / 2;

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        if (def.pattern[r][c]) {
          const cube = new THREE.Mesh(geo, mat.clone());
          cube.position.set(
            (c - cx) * def.voxelSize,
            (cy - r) * def.voxelSize,
            0
          );
          cube.userData.isBossBody = true;
          group.add(cube);
        }
      }
    }

    // Add hitbox
    const hitboxGeo = new THREE.SphereGeometry(def.hitboxRadius || 0.5, 8, 8);
    const hitboxMat = new THREE.MeshBasicMaterial({ visible: false });
    const hitbox = new THREE.Mesh(hitboxGeo, hitboxMat);
    hitbox.userData.isBossHitbox = true;
    group.add(hitbox);

    return group;
  }

  createWeakPoints() {
    // Select random voxels as weak points (double damage)
    const voxels = this.mesh.children.filter(c => c.userData.isBossBody);
    const weakPointCount = Math.min(voxels.length, Math.floor(voxels.length / 5)); // Up to 20%

    for (let i = 0; i < weakPointCount; i++) {
      const idx = Math.floor(Math.random() * voxels.length);
      const weak = voxels[idx];
      weak.userData.weakPoint = true;
      // Make weak point visually distinct: lighter color + higher opacity
      const weakMaterial = new THREE.MeshBasicMaterial({
        color: 0xffffff,  // White - very obvious in VR
        transparent: true,
        opacity: 0.95,   // Higher opacity for visibility
      });
      weak.material = weakMaterial;
      this.weakPoints.push(weak);
    }
  }

  takeDamage(amount, hitInfo = {}) {
    let isWeakPointHit = false;

    // Check if weak point was hit
    if (hitInfo.isWeakPoint) {
      amount *= 2;
      isWeakPointHit = true;
    }

    // Charge cannon damage cap against bosses (max 100 damage per shot)
    if (hitInfo.isChargeCannon) {
      amount = Math.min(amount, 100);
    }

    this.hp -= amount;
    if (this.hp <= 0) this.hp = 0;

    // Update color based on damage
    const damageRatio = 1 - this.hp / this.maxHp;
    this.mesh.traverse(c => {
      if (c.isMesh && c.material && !c.userData.isBossBody) {
        c.material.color.copy(this.baseColor).lerp(new THREE.Color(0xff0000), damageRatio);
      }
    });

    // Phase transitions (66%, 33%)
    const prevPhase = this.phase;
    const phaseThreshold2 = this.maxHp * (2 / 3);
    const phaseThreshold1 = this.maxHp * (1 / 3);

    if (this.phases >= 3 && this.hp > 0) {
      if (this.hp <= phaseThreshold1) {
        this.phase = 3;
      } else if (this.hp <= phaseThreshold2) {
        this.phase = 2;
      }
    }

    return {
      killed: this.hp <= 0,
      phaseChanged: this.phase !== prevPhase,
      isWeakPointHit
    };
  }

  spawnMinion(position, playerPos, type = 'basic') {
    // Spawn a boss minion (simplified for now)
    // Would integrate with existing minion spawning system
    console.log(`[Boss] Spawning minion: ${type}`);
    if (typeof spawnBossMinion === 'function') {
      spawnBossMinion(position.clone(), playerPos, type);
    }
  }

  fireProjectile(targetPos) {
    // Base projectile firing
    if (typeof spawnBossProjectile === 'function') {
      spawnBossProjectile(this.mesh.position.clone(), targetPos);
    }
  }

  update(dt, now, playerPos) {
    // Update cooldowns
    if (this.telegraphCooldown > 0) {
      this.telegraphCooldown -= dt;
    }

    // Behavior-specific updates
    if (this.minionSpawnRate > 0) {
      this.minionSpawnTimer -= dt;
      if (this.minionSpawnTimer <= 0) {
        this.minionSpawnTimer = this.minionSpawnRate;
        this.onMinionSpawn(playerPos);
      }
    }

    if (this.projectileRate > 0) {
      this.projectileTimer -= dt;
      if (this.projectileTimer <= 0) {
        this.projectileTimer = this.projectileRate;
        this.onProjectileFire(playerPos);
      }
    }

    // Update state machine
    this.updateBehavior(dt, now, playerPos);

    // Keep boss in front arc and out of contact range
    this.constrainToFrontArc(playerPos);
  }

  updateBehavior(dt, now, playerPos) {
    // Default behavior: just move toward player
    _dir.copy(playerPos).sub(this.mesh.position);
    const dist = _dir.length();
    if (dist > 0.01) _dir.divideScalar(dist);
    this.mesh.lookAt(_look.copy(playerPos));
    this.mesh.position.addScaledVector(_dir, 0.3 * dt);
  }

  onMinionSpawn(playerPos) {
    // Override in subclasses
  }

  onProjectileFire(playerPos) {
    // Override in subclasses
  }

  transitionToPhase(newPhase) {
    if (newPhase > this.phase && newPhase <= this.phases) {
      this.phase = newPhase;
      this.onPhaseChange(newPhase);
    }
  }

  onPhaseChange(newPhase) {
    // Called when boss transitions to a new phase
    console.log(`[Boss] ${this.def.name} transitioning to Phase ${newPhase}`);

    // Play phase change effect
    if (this.telegraphing) {
      this.telegraphing.start('teleport', 1.0, 0x00ffff);
    }
  }

  showTelegraph(type, duration, color, position = null, direction = null) {
    if (this.telegraphCooldown <= 0 && this.telegraphing) {
      this.telegraphing.start(type, duration, color, position, direction);
      this.telegraphCooldown = 0.5; // Cooldown between telegraphs
      this.telegraphing.playSound(type, duration);
      return true;
    }
    return false;
  }

  getBoss() {
    return { mesh: this.mesh, hp: this.hp, maxHp: this.maxHp, phase: this.phase };
  }

  constrainToFrontArc(playerPos) {
    clampPositionToFrontArc(this.mesh.position, playerPos, this.minDistance, this.maxDistance, this.frontArc);
  }

  destroy() {
    this.sceneRef.remove(this.mesh);
    this.mesh.traverse(c => {
      if (c.geometry) c.geometry.dispose();
      if (c.material) c.material.dispose();
    });
  }
}

// ── SCRAP GOLEM BOSS ───────────────────────────────────────
class ScrapGolemBoss extends Boss {
  constructor(def, levelConfig, sceneRef, telegraphing) {
    super(def, levelConfig, sceneRef, telegraphing);
    
    this.slamTimer = 0;
    this.slamRate = def.slamRate || 3.0;
    this.minionTimer = 0;
    this.minionRate = def.minionRate || 6.0;
    this.state = 'moving';
    this.chargeDir = new THREE.Vector3();
  }

  updateBehavior(dt, now, playerPos) {
    const dirToPlayer = playerPos.clone().sub(this.mesh.position).normalize();
    
    // Slow movement toward player
    this.mesh.position.addScaledVector(dirToPlayer, 0.8 * dt);
    this.mesh.lookAt(playerPos.x, playerPos.y, playerPos.z);
    
    // Ground slam attack
    this.slamTimer += dt;
    if (this.slamTimer >= this.slamRate) {
      this.slamTimer = 0;
      this.performSlam(playerPos);
    }
    
    // Spawn scrap minions
    this.minionTimer += dt;
    if (this.minionTimer >= this.minionRate) {
      this.minionTimer = 0;
      this.spawnScrapMinion();
    }
  }

  performSlam(playerPos) {
    // Telegraph the slam
    if (this.telegraphing) {
      this.showTelegraph('charge', 0.8, 0x886644);
    }
    
    // Create shockwave after delay
    setTimeout(() => {
      if (typeof window !== 'undefined' && window.createBossShockwave) {
        window.createBossShockwave(this.mesh.position.clone(), 5, 15 + this.phase * 5);
      }
    }, 600);
  }

  spawnScrapMinion() {
    const angle = Math.random() * Math.PI * 2;
    const dist = 3;
    const pos = this.mesh.position.clone();
    pos.x += Math.cos(angle) * dist;
    pos.z += Math.sin(angle) * dist;
    pos.y = 1;

    // Use spawnBossMinion from enemies.js
    if (typeof spawnBossMinion === 'function') {
      spawnBossMinion(pos, this.mesh.position, 'basic');
    }
  }

  onPhaseChange(newPhase) {
    super.onPhaseChange(newPhase);
    // Phase 2: faster attacks
    if (newPhase >= 2) {
      this.slamRate = 2.5;
      this.minionRate = 5.0;
    }
    // Phase 3: even faster
    if (newPhase >= 3) {
      this.slamRate = 2.0;
      this.minionRate = 4.0;
    }
  }
}

// ── HOLO PHANTOM BOSS ───────────────────────────────────────
class HoloPhantomBoss extends Boss {
  constructor(def, levelConfig, sceneRef, telegraphing) {
    super(def, levelConfig, sceneRef, telegraphing);
    
    this.decoyTimer = 0;
    this.decoyRate = def.decoyRate || 4.0;
    this.teleportTimer = 0;
    this.teleportRate = def.teleportRate || 2.5;
    this.state = 'visible';
  }

  updateBehavior(dt, now, playerPos) {
    const dirToPlayer = playerPos.clone().sub(this.mesh.position).normalize();
    
    // Fast erratic movement
    if (this.state === 'visible') {
      this.mesh.position.addScaledVector(dirToPlayer, 2.0 * dt);
      this.mesh.lookAt(playerPos.x, playerPos.y, playerPos.z);
      
      // Create decoys
      this.decoyTimer += dt;
      if (this.decoyTimer >= this.decoyRate) {
        this.decoyTimer = 0;
        this.createDecoy();
      }
      
      // Teleport
      this.teleportTimer += dt;
      if (this.teleportTimer >= this.teleportRate) {
        this.teleportTimer = 0;
        this.teleport(playerPos);
      }
    }
  }

  createDecoy() {
    const angle = Math.random() * Math.PI * 2;
    const dist = 3 + Math.random() * 3;
    const decoyPos = this.mesh.position.clone();
    decoyPos.x += Math.cos(angle) * dist;
    decoyPos.z += Math.sin(angle) * dist;
    
    // Use new shootable decoy system
    if (typeof window !== 'undefined' && window.createHoloDecoy) {
      window.createHoloDecoy(decoyPos, 10 + this.phase * 5, 2);
    }
  }

  teleport(playerPos) {
    if (this.telegraphing) {
      this.showTelegraph('teleport', 0.4, 0x00ffff);
    }
    
    this.state = 'teleporting';
    this.mesh.visible = false;
    
    setTimeout(() => {
      const angle = Math.random() * Math.PI * 2;
      const dist = 6 + Math.random() * 4;
      this.mesh.position.set(
        playerPos.x + Math.cos(angle) * dist,
        1.5,
        playerPos.z + Math.sin(angle) * dist
      );
      this.mesh.visible = true;
      this.state = 'visible';
    }, 400);
  }

  onProjectileFire(playerPos) {
    if (this.telegraphing) {
      this.showTelegraph('projectile', 0.35, 0x00ffff);
    }

    setTimeout(() => {
      const spread = 0.4;
      const leftTarget = playerPos.clone();
      leftTarget.x -= spread;
      const rightTarget = playerPos.clone();
      rightTarget.x += spread;
      if (typeof spawnBossProjectile === 'function') {
        spawnBossProjectile(this.mesh.position.clone(), leftTarget);
        spawnBossProjectile(this.mesh.position.clone(), rightTarget);
      }
    }, 200);
  }

  onPhaseChange(newPhase) {
    super.onPhaseChange(newPhase);
    if (newPhase >= 2) {
      this.decoyRate = 3.0;
      this.teleportRate = 2.0;
    }
    if (newPhase >= 3) {
      this.decoyRate = 2.5;
      this.teleportRate = 1.5;
    }
  }
}

// ── PULSE EMITTER BOSS ───────────────────────────────────────
class PulseEmitterBoss extends Boss {
  constructor(def, levelConfig, sceneRef, telegraphing) {
    super(def, levelConfig, sceneRef, telegraphing);
    
    this.pulseTimer = 0;
    this.pulseRate = def.pulseRate || 2.0;
    this.shieldActive = false;
    this.shieldTimer = 0;
    this.shieldDuration = def.shieldDuration || 3.0;
    this.state = 'pulsing';
  }

  updateBehavior(dt, now, playerPos) {
    const dirToPlayer = playerPos.clone().sub(this.mesh.position).normalize();
    
    // Moderate movement
    this.mesh.position.addScaledVector(dirToPlayer, 1.2 * dt);
    this.mesh.lookAt(playerPos.x, playerPos.y, playerPos.z);
    
    // Pulse attacks
    this.pulseTimer += dt;
    if (this.pulseTimer >= this.pulseRate && !this.shieldActive) {
      this.pulseTimer = 0;
      this.firePulse(playerPos);
    }
    
    // Shield phase
    this.shieldTimer += dt;
    if (this.shieldTimer >= this.shieldDuration * 2) {
      this.shieldTimer = 0;
      this.activateShield();
    }
  }

  firePulse(playerPos) {
    if (this.telegraphing) {
      this.showTelegraph('projectile', 0.5, 0xff0088);
    }
    
    // Fire pulse wave
    setTimeout(() => {
      if (typeof window !== 'undefined' && window.fireBossPulse) {
        window.fireBossPulse(this.mesh.position.clone(), playerPos.clone(), 20 + this.phase * 10);
      }
    }, 400);
  }

  activateShield() {
    this.shieldActive = true;
    
    // Safely set emissiveIntensity on all child meshes with materials
    this.mesh.traverse(c => {
      if (c.isMesh && c.material) {
        setMaterialEmissiveSafe(c.material, new THREE.Color(0xffffff), 0.8);
      }
    });
    
    // Create visual shield
    if (typeof window !== 'undefined' && window.createBossShield) {
      window.createBossShield(this.mesh.position.clone(), 2);
    }
    
    setTimeout(() => {
      this.shieldActive = false;
      
      // Safely reset emissiveIntensity on all child meshes with materials
      this.mesh.traverse(c => {
        if (c.isMesh && c.material) {
          setMaterialEmissiveSafe(c.material, new THREE.Color(0xffffff), 0.3);
        }
      });
    }, this.shieldDuration * 1000);
  }

  onProjectileFire(playerPos) {
    if (this.shieldActive) return;
    if (this.telegraphing) {
      this.showTelegraph('projectile', 0.4, 0xff0088);
    }

    setTimeout(() => {
      const shots = 5;
      for (let i = 0; i < shots; i++) {
        const angle = (i / shots) * Math.PI * 2;
        const target = new THREE.Vector3(
          playerPos.x + Math.cos(angle) * 3,
          playerPos.y,
          playerPos.z + Math.sin(angle) * 3
        );
        if (typeof spawnBossProjectile === 'function') {
          spawnBossProjectile(this.mesh.position.clone(), target);
        }
      }
    }, 200);
  }

  onPhaseChange(newPhase) {
    super.onPhaseChange(newPhase);
    if (newPhase >= 2) {
      this.pulseRate = 1.5;
      this.shieldDuration = 4.0;
    }
    if (newPhase >= 3) {
      this.pulseRate = 1.2;
      this.shieldDuration = 5.0;
    }
  }
}

// ── RUST SERPENT BOSS ───────────────────────────────────────
class RustSerpentBoss extends Boss {
  constructor(def, levelConfig, sceneRef, telegraphing) {
    super(def, levelConfig, sceneRef, telegraphing);
    
    this.slitherAngle = 0;
    this.slitherSpeed = def.slitherSpeed || 1.8;
    this.toxicTimer = 0;
    this.toxicRate = def.toxicRate || 1.5;
    this.trailPositions = [];
  }

  updateBehavior(dt, now, playerPos) {
    const dirToPlayer = playerPos.clone().sub(this.mesh.position).normalize();
    
    // Slithering movement
    this.slitherAngle += dt * this.slitherSpeed * 2;
    const slitherOffset = Math.sin(this.slitherAngle) * 0.3;
    const perp = new THREE.Vector3(-dirToPlayer.z, 0, dirToPlayer.x).normalize();
    
    this.mesh.position.addScaledVector(dirToPlayer, this.slitherSpeed * dt);
    this.mesh.position.addScaledVector(perp, slitherOffset * dt);
    this.mesh.lookAt(playerPos.x, playerPos.y, playerPos.z);
    
    // Leave toxic trail
    this.toxicTimer += dt;
    if (this.toxicTimer >= this.toxicRate) {
      this.toxicTimer = 0;
      this.dropToxicPool();
    }
  }

  dropToxicPool() {
    if (typeof window !== 'undefined' && window.createToxicPool) {
      window.createToxicPool(this.mesh.position.clone(), 2.5, 5 + this.phase * 3);
    }
  }

  onProjectileFire(playerPos) {
    if (this.telegraphing) {
      this.showTelegraph('projectile', 0.35, 0xcc4400);
    }

    setTimeout(() => {
      const spread = 0.6;
      const target = playerPos.clone();
      target.x += (Math.random() - 0.5) * spread;
      target.z += (Math.random() - 0.5) * spread;
      if (typeof spawnBossProjectile === 'function') {
        spawnBossProjectile(this.mesh.position.clone(), target);
      }
    }, 200);
  }

  onPhaseChange(newPhase) {
    super.onPhaseChange(newPhase);
    if (newPhase >= 2) {
      this.slitherSpeed = 2.2;
      this.toxicRate = 1.2;
    }
    if (newPhase >= 3) {
      this.slitherSpeed = 2.6;
      this.toxicRate = 0.9;
    }
  }
}

// ── STATIC WISP BOSS ───────────────────────────────────────
class StaticWispBoss extends Boss {
  constructor(def, levelConfig, sceneRef, telegraphing) {
    super(def, levelConfig, sceneRef, telegraphing);
    
    this.electricTimer = 0;
    this.electricRate = def.electricRate || 1.2;
    this.teleportTimer = 0;
    this.teleportRate = def.teleportRate || 3.0;
    this.state = 'active';
    this.zigzagTimer = 0;
    this.zigzagDir = new THREE.Vector3();
  }

  updateBehavior(dt, now, playerPos) {
    const dirToPlayer = playerPos.clone().sub(this.mesh.position).normalize();
    
    // Fast zigzag movement
    this.zigzagTimer += dt;
    if (this.zigzagTimer >= 0.3) {
      this.zigzagTimer = 0;
      const perp = new THREE.Vector3(-dirToPlayer.z, 0, dirToPlayer.x).normalize();
      this.zigzagDir = perp.multiplyScalar(Math.random() < 0.5 ? 1 : -1);
    }
    
    this.mesh.position.addScaledVector(dirToPlayer, 2.5 * dt);
    this.mesh.position.addScaledVector(this.zigzagDir, 1.5 * dt);
    this.mesh.lookAt(playerPos.x, playerPos.y, playerPos.z);
    
    // Electric attacks
    this.electricTimer += dt;
    if (this.electricTimer >= this.electricRate) {
      this.electricTimer = 0;
      this.fireElectricBolt(playerPos);
    }
    
    // Teleport
    this.teleportTimer += dt;
    if (this.teleportTimer >= this.teleportRate) {
      this.teleportTimer = 0;
      this.teleport(playerPos);
    }
  }

  fireElectricBolt(playerPos) {
    if (this.telegraphing) {
      this.showTelegraph('projectile', 0.5, 0xffff00);
    }

    // Fire lightning bolt (rebalanced: 2-4 damage instead of 15-31 insta-kill)
    setTimeout(() => {
      if (typeof window !== 'undefined' && window.fireBossLightning) {
        window.fireBossLightning(this.mesh.position.clone(), playerPos.clone(), 1 + this.phase);
      }
    }, 300);
  }

  teleport(playerPos) {
    if (this.telegraphing) {
      this.showTelegraph('teleport', 0.3, 0xffff00);
    }
    
    this.mesh.visible = false;
    
    setTimeout(() => {
      const angle = Math.random() * Math.PI * 2;
      const dist = 5 + Math.random() * 5;
      this.mesh.position.set(
        playerPos.x + Math.cos(angle) * dist,
        1.5,
        playerPos.z + Math.sin(angle) * dist
      );
      this.mesh.visible = true;
    }, 300);
  }

  onProjectileFire(playerPos) {
    if (this.telegraphing) {
      this.showTelegraph('projectile', 0.35, 0xffff00);
    }

    setTimeout(() => {
      const spread = 0.5;
      const target = playerPos.clone();
      target.x += (Math.random() - 0.5) * spread;
      target.z += (Math.random() - 0.5) * spread;
      if (typeof spawnBossProjectile === 'function') {
        spawnBossProjectile(this.mesh.position.clone(), target);
      }
    }, 200);
  }

  onPhaseChange(newPhase) {
    super.onPhaseChange(newPhase);
    if (newPhase >= 2) {
      this.electricRate = 0.9;
      this.teleportRate = 2.5;
    }
    if (newPhase >= 3) {
      this.electricRate = 0.7;
      this.teleportRate = 2.0;
    }
  }
}

// ── SKULL HAND (Child of Skull Boss) ───────────────────────────
class SkullHand {
  constructor(parentBoss, handIndex, offsetPos, sceneRef) {
    this.parentBoss = parentBoss;
    this.handIndex = handIndex;
    this.offsetPos = offsetPos.clone();
    this.sceneRef = sceneRef;
    
    // HP scales based on how many hands remain - first hands easier, last hands harder
    const aliveHands = parentBoss.hands.filter(h => h.alive).length;
    const handsDestroyed = 4 - aliveHands;
    const baseHp = parentBoss.def.handHp || 150;
    // First hand: 100 HP, each destroyed hand adds 50% more HP to remaining hands
    // Hand 1: 100, Hand 2: 150, Hand 3: 225, Hand 4: 337
    const hpMultiplier = Math.pow(1.5, handsDestroyed);
    this.maxHp = Math.round(baseHp * 0.67 * hpMultiplier); // Start at 67% of base, scale up
    this.hp = this.maxHp;
    this.alive = true;
    console.log(`[SkullHand] Hand ${handIndex} created with ${this.hp}/${this.maxHp} HP (handsDestroyed: ${handsDestroyed})`);
    
    this.shootTimer = 0;
    this.shootRate = parentBoss.def.handShootRate || 1.5;
    
    this.buildMesh();
  }
  
  buildMesh() {
    // Voxel hand - skeletal hand shape
    this.group = new THREE.Group();
    const geo = getGeo(0.18);
    const mat = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.9
    });
    
    // Palm (center)
    const palm = new THREE.Mesh(geo, mat.clone());
    palm.userData.isHandBody = true;
    palm.userData.handIndex = this.handIndex;
    this.group.add(palm);
    
    // Fingers (4 fingers + thumb)
    const fingerPositions = [
      [-0.2, 0.3, 0],   // Index
      [0, 0.35, 0],     // Middle
      [0.2, 0.3, 0],    // Ring
      [0.35, 0.15, 0],  // Pinky
      [-0.3, -0.1, 0],  // Thumb
    ];
    
    fingerPositions.forEach(pos => {
      const finger = new THREE.Mesh(geo, mat.clone());
      finger.position.set(pos[0], pos[1], pos[2]);
      finger.userData.isHandBody = true;
      finger.userData.handIndex = this.handIndex;
      this.group.add(finger);
    });
    
    // Hitbox
    const hitboxGeo = new THREE.SphereGeometry(0.5, 8, 8);
    const hitboxMat = new THREE.MeshBasicMaterial({ visible: false });
    const hitbox = new THREE.Mesh(hitboxGeo, hitboxMat);
    hitbox.userData.isHandHitbox = true;
    hitbox.userData.handIndex = this.handIndex;
    hitbox.userData.skullHand = this;
    this.group.add(hitbox);
    
    this.group.userData.isSkullHand = true;
    this.group.userData.handIndex = this.handIndex;
    this.group.userData.skullHand = this;
    
    // Add to boss mesh for proper raycasting
    this.parentBoss.mesh.add(this.group);
  }
  
  update(dt, now, playerPos, bossPos) {
    if (!this.alive) return;
    
    // Position is relative to boss (local coordinates)
    this.group.position.copy(this.offsetPos);
    
    // Bobbing animation
    this.group.position.y += Math.sin(now * 0.003 + this.handIndex) * 0.15;
    
    // Rotate to face player (world direction)
    const worldPos = this.group.getWorldPosition(new THREE.Vector3());
    const lookDir = playerPos.clone().sub(worldPos);
    if (lookDir.length() > 0.1) {
      this.group.lookAt(playerPos.x, worldPos.y, playerPos.z);
    }
    
    // Update color based on damage - darken toward dark red
    const damageRatio = 1 - this.hp / this.maxHp;
    this.group.traverse(c => {
      if (c.isMesh && c.material && c.userData.isHandBody) {
        const baseColor = new THREE.Color(0xffffff);
        const damagedColor = new THREE.Color(0x660000); // Dark red
        c.material.color.copy(baseColor).lerp(damagedColor, damageRatio);
      }
    });
  }
  
  takeDamage(amount) {
    if (!this.alive) return { killed: false };
    
    // Damage reduction based on remaining hands - fewer hands = more tanky
    const aliveHands = this.parentBoss.hands.filter(h => h.alive).length;
    const damageReduction = 1 - (aliveHands - 1) * 0.15; // 4 hands: 85%, 3: 70%, 2: 55%, 1: 40% damage taken
    const actualDamage = Math.round(amount * damageReduction);
    console.log(`[SkullHand] Hand ${this.handIndex} takes ${actualDamage} damage (reduced from ${amount}, ${aliveHands} hands alive, ${(damageReduction * 100).toFixed(0)}% damage taken)`);
    
    this.hp -= actualDamage;
    if (this.hp <= 0) {
      this.hp = 0;
      this.alive = false;
      this.destroy();
      return { killed: true };
    }
    return { killed: false };
  }
  
  destroy() {
    // Explosion effect at world position
    if (spawnVoxelExplosion) {
      const worldPos = this.group.getWorldPosition(new THREE.Vector3());
      spawnVoxelExplosion(worldPos, 0xffffff, 12);
    }
    
    // Remove from parent (boss mesh)
    if (this.group.parent) {
      this.group.parent.remove(this.group);
    }
    this.group.traverse(c => {
      if (c.geometry) c.geometry.dispose();
      if (c.material) c.material.dispose();
    });
  }
  
  shouldShoot(now) {
    if (!this.alive) return false;
    
    this.shootTimer += 0.016; // Approximate dt
    if (this.shootTimer >= this.shootRate) {
      this.shootTimer = 0;
      return true;
    }
    return false;
  }
  
  setShootRate(rate) {
    this.shootRate = rate;
  }
  
  getPosition() {
    return this.group.getWorldPosition(new THREE.Vector3());
  }
}

// ── SKULL BOSS (Level 5 Boss) ───────────────────────────────────
class SkullBoss extends Boss {
  constructor(def, levelConfig, sceneRef, telegraphing) {
    super(def, levelConfig, sceneRef, telegraphing);
    
    // Skull-specific state
    this.hands = [];
    this.handsAlive = 4;
    this.headVulnerable = false;
    this.eyeTimer = 0;
    this.eyeShootRate = def.eyeShootRate || 0.8;
    this.moveTimer = 0;
    this.moveDirection = new THREE.Vector3();
    this.moveSpeed = def.moveSpeed || 1.5;
    
    // Build custom skull mesh
    this.buildSkullMesh();
    
    // Create 4 hands
    this.createHands();
    
    // Head starts immune
    this.setHeadImmune(true);
  }
  
  buildSkullMesh() {
    // Clear the default mesh children
    while (this.mesh.children.length > 0) {
      const child = this.mesh.children[0];
      this.mesh.remove(child);
      if (child.geometry) child.geometry.dispose();
      if (child.material) child.material.dispose();
    }
    
    const skullGroup = new THREE.Group();
    const geo = getGeo(0.25);
    const mat = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.9
    });
    
    // Skull top (dome)
    const domePositions = [
      // Top row (smaller)
      [-0.25, 0.75, 0],
      [0, 0.85, 0],
      [0.25, 0.75, 0],
      // Upper middle
      [-0.5, 0.6, 0],
      [-0.25, 0.65, 0],
      [0, 0.7, 0],
      [0.25, 0.65, 0],
      [0.5, 0.6, 0],
      // Middle (widest)
      [-0.6, 0.35, 0],
      [-0.35, 0.45, 0],
      [-0.1, 0.5, 0],
      [0.1, 0.5, 0],
      [0.35, 0.45, 0],
      [0.6, 0.35, 0],
    ];
    
    domePositions.forEach(pos => {
      const cube = new THREE.Mesh(geo, mat.clone());
      cube.position.set(pos[0], pos[1], pos[2]);
      cube.userData.isSkullBody = true;
      skullGroup.add(cube);
    });
    
    // Eye sockets (empty spaces, with red glowing eyes inside)
    const eyeGeo = getGeo(0.15);
    const eyeMat = new THREE.MeshBasicMaterial({
      color: 0xff0000,
      transparent: true,
      opacity: 0.8
    });
    
    const leftEye = new THREE.Mesh(eyeGeo, eyeMat.clone());
    leftEye.position.set(-0.3, 0.2, 0.1);
    leftEye.userData.isEye = true;
    leftEye.userData.eyeIndex = 0;
    skullGroup.add(leftEye);
    this.leftEye = leftEye;
    
    const rightEye = new THREE.Mesh(eyeGeo, eyeMat.clone());
    rightEye.position.set(0.3, 0.2, 0.1);
    rightEye.userData.isEye = true;
    rightEye.userData.eyeIndex = 1;
    skullGroup.add(rightEye);
    this.rightEye = rightEye;
    
    // Nose cavity (bridge)
    const nosePositions = [
      [0, 0.05, 0.05],
      [0, -0.1, 0],
    ];
    nosePositions.forEach(pos => {
      const cube = new THREE.Mesh(geo, mat.clone());
      cube.position.set(pos[0], pos[1], pos[2]);
      cube.userData.isSkullBody = true;
      skullGroup.add(cube);
    });
    
    // Jaw/teeth
    const jawPositions = [
      [-0.4, -0.25, 0],
      [-0.2, -0.3, 0],
      [0, -0.32, 0],
      [0.2, -0.3, 0],
      [0.4, -0.25, 0],
      // Lower jaw
      [-0.35, -0.45, 0],
      [-0.15, -0.5, 0],
      [0.05, -0.52, 0],
      [0.25, -0.5, 0],
      [0.45, -0.45, 0],
    ];
    jawPositions.forEach(pos => {
      const cube = new THREE.Mesh(geo, mat.clone());
      cube.position.set(pos[0], pos[1], pos[2]);
      cube.userData.isSkullBody = true;
      skullGroup.add(cube);
    });
    
    // Cheekbones
    const cheekPositions = [
      [-0.7, 0.1, 0],
      [0.7, 0.1, 0],
      [-0.6, -0.05, 0],
      [0.6, -0.05, 0],
    ];
    cheekPositions.forEach(pos => {
      const cube = new THREE.Mesh(geo, mat.clone());
      cube.position.set(pos[0], pos[1], pos[2]);
      cube.userData.isSkullBody = true;
      skullGroup.add(cube);
    });
    
    // Store skull voxels for color updates
    this.skullVoxels = skullGroup.children.filter(c => c.userData.isSkullBody);
    
    this.mesh.add(skullGroup);
    this.skullGroup = skullGroup;
    
    // Add hitbox for head
    const hitboxGeo = new THREE.SphereGeometry(1.0, 8, 8);
    const hitboxMat = new THREE.MeshBasicMaterial({ visible: false });
    const hitbox = new THREE.Mesh(hitboxGeo, hitboxMat);
    hitbox.userData.isBossHitbox = true;
    hitbox.userData.isSkullHead = true;
    this.mesh.add(hitbox);
  }
  
  createHands() {
    // Create 4 hands positioned around the skull
    const handOffsets = [
      new THREE.Vector3(-2.5, 0.3, 0.5),   // Left top
      new THREE.Vector3(-2.5, -0.5, 0.5),  // Left bottom
      new THREE.Vector3(2.5, 0.3, 0.5),    // Right top
      new THREE.Vector3(2.5, -0.5, 0.5),   // Right bottom
    ];
    
    handOffsets.forEach((offset, idx) => {
      const hand = new SkullHand(this, idx, offset, this.sceneRef);
      this.hands.push(hand);
    });
  }
  
  setHeadImmune(immune) {
    this.headVulnerable = !immune;
    
    // Visual feedback - dim eyes when immune
    const eyeOpacity = immune ? 0.3 : 0.9;
    const eyeColor = immune ? 0x888888 : 0xff0000;
    
    if (this.leftEye) {
      this.leftEye.material.opacity = eyeOpacity;
      this.leftEye.material.color.setHex(eyeColor);
    }
    if (this.rightEye) {
      this.rightEye.material.opacity = eyeOpacity;
      this.rightEye.material.color.setHex(eyeColor);
    }
  }
  
  updateBehavior(dt, now, playerPos) {
    // Update hands
    let aliveHands = 0;
    this.hands.forEach(hand => {
      if (hand.alive) {
        aliveHands++;
        hand.update(dt, now, playerPos, this.mesh.position);
        
        // Hand shooting (Phase 1)
        if (!this.headVulnerable && hand.shouldShoot(now)) {
          this.fireHandProjectile(hand, playerPos);
        }
      }
    });
    
    this.handsAlive = aliveHands;
    
    // Phase transition: all hands destroyed
    if (this.handsAlive === 0 && !this.headVulnerable) {
      this.setHeadImmune(false);
      this.phase = 2;
      this.onPhaseChange(2);
      this.playGrowlSound();
    }
    
    // Phase 2: Head attacks and movement
    if (this.headVulnerable) {
      this.updatePhase2(dt, now, playerPos);
    } else {
      // Phase 1: Stay mid-field, hands do the work
      this.constrainToMidfield(playerPos);
    }
    
    // Update head color based on damage
    this.updateHeadColor();
    
    // Face player
    this.mesh.lookAt(_look.copy(playerPos));
  }
  
  updatePhase2(dt, now, playerPos) {
    // Eye shooting
    this.eyeTimer += dt;
    if (this.eyeTimer >= this.eyeShootRate) {
      this.eyeTimer = 0;
      this.fireEyeProjectiles(playerPos);
    }
    
    // Erratic movement
    this.moveTimer += dt;
    if (this.moveTimer >= 2.0) {
      this.moveTimer = 0;
      // Random direction
      const angle = Math.random() * Math.PI * 2;
      this.moveDirection.set(Math.sin(angle), 0, Math.cos(angle));
    }
    
    // Apply movement
    this.mesh.position.addScaledVector(this.moveDirection, this.moveSpeed * dt);
    
    // Keep in bounds
    this.constrainToMidfield(playerPos);
  }
  
  constrainToMidfield(playerPos) {
    // Stay in a fixed arena, mid-field from player
    const dist = this.mesh.position.distanceTo(playerPos);
    
    // Stay between 6 and 12 units from player
    if (dist < 6) {
      const awayDir = this.mesh.position.clone().sub(playerPos).normalize();
      this.mesh.position.addScaledVector(awayDir, (6 - dist));
    } else if (dist > 14) {
      const towardDir = playerPos.clone().sub(this.mesh.position).normalize();
      this.mesh.position.addScaledVector(towardDir, (dist - 14));
    }
    
    // Keep in play area bounds
    const bound = 15;
    this.mesh.position.x = Math.max(-bound, Math.min(bound, this.mesh.position.x));
    this.mesh.position.z = Math.max(-bound, Math.min(bound, this.mesh.position.z));
    this.mesh.position.y = 1.5;
  }
  
  fireHandProjectile(hand, playerPos) {
    if (this.telegraphing) {
      this.showTelegraph('projectile', 0.25, 0xff0000, hand.getPosition());
    }
    
    setTimeout(() => {
      if (typeof spawnBossProjectile === 'function') {
        spawnBossProjectile(hand.getPosition(), playerPos);
      }
    }, 150);
  }
  
  fireEyeProjectiles(playerPos) {
    // Fire from both eyes
    const eyePositions = [
      this.leftEye.getWorldPosition(new THREE.Vector3()),
      this.rightEye.getWorldPosition(new THREE.Vector3()),
    ];
    
    if (this.telegraphing) {
      this.showTelegraph('projectile', 0.3, 0xff0000, this.mesh.position);
    }
    
    setTimeout(() => {
      eyePositions.forEach(eyePos => {
        if (typeof spawnBossProjectile === 'function') {
          spawnBossProjectile(eyePos, playerPos);
        }
      });
    }, 200);
  }
  
  playGrowlSound() {
    // Use audio system if available
    if (typeof window !== 'undefined' && window.playBossAttackSound) {
      window.playBossAttackSound('charge', 0.8);
    }
  }
  
  updateHeadColor() {
    const damageRatio = 1 - this.hp / this.maxHp;
    const baseColor = new THREE.Color(0xffffff);
    // More dramatic darkening: progress from white -> pink -> red -> dark red -> almost black
    const damagedColor = new THREE.Color(0x330000); // Very dark red (almost black)
    
    // Exponential darkening for more dramatic effect
    const enhancedRatio = Math.pow(damageRatio, 0.7); // Darker faster
    
    this.skullVoxels.forEach(voxel => {
      voxel.material.color.copy(baseColor).lerp(damagedColor, enhancedRatio);
    });
  }
  
  onHandDestroyed(handIndex) {
    this.handsAlive--;
    
    // Play growl
    this.playGrowlSound();
    
    // Speed up remaining hands
    const speedMultiplier = 1 + (4 - this.handsAlive) * 0.3;
    this.hands.forEach(hand => {
      if (hand.alive) {
        hand.setShootRate((this.def.handShootRate || 1.5) / speedMultiplier);
      }
    });
    
    // Increase remaining hands' max HP (they get tougher as fewer remain)
    const hpIncreaseMultiplier = 1.25; // Each destroyed hand buffs remaining by 25%
    this.hands.forEach(hand => {
      if (hand.alive) {
        const oldMax = hand.maxHp;
        hand.maxHp = Math.round(hand.maxHp * hpIncreaseMultiplier);
        // Also heal them a bit
        hand.hp = Math.min(hand.hp + 30, hand.maxHp);
        console.log(`[SkullBoss] Hand ${hand.handIndex} HP increased: ${oldMax} -> ${hand.maxHp}, now at ${hand.hp}/${hand.maxHp}`);
      }
    });
    
    // Visual telegraph
    if (this.telegraphing) {
      this.showTelegraph('teleport', 0.3, 0xff0000);
    }
  }
  
  takeDamage(amount, hitInfo = {}) {
    // Check if hitting a hand
    if (hitInfo.handIndex !== undefined) {
      const hand = this.hands[hitInfo.handIndex];
      if (hand && hand.alive) {
        const result = hand.takeDamage(amount);
        if (result.killed) {
          this.onHandDestroyed(hitInfo.handIndex);
        }
        return { killed: false, handKilled: result.killed };
      }
      return { killed: false };
    }
    
    // Head damage only in phase 2
    if (!this.headVulnerable) {
      // Head is immune
      return { killed: false, immune: true };
    }
    
    // Apply damage to head
    return super.takeDamage(amount, hitInfo);
  }
  
  onPhaseChange(newPhase) {
    super.onPhaseChange(newPhase);
    
    if (newPhase === 2) {
      // All hands destroyed, head now vulnerable
      this.eyeShootRate = this.def.eyeShootRate || 0.8;
      this.moveSpeed = this.def.moveSpeed || 1.5;
    }
  }
}

// ── TELEPORTING BOSS (DODGER) ───────────────────────────────
class DodgerBoss extends Boss {
  constructor(def, levelConfig, sceneRef, telegraphing) {
    super(def, levelConfig, sceneRef, telegraphing);

    // Dodger-specific state
    this.state = 'hidden';
    this.teleportTimer = 0;
    this.chargeTimer = 0;
    this.chargeActive = false;
    this.stunTimer = 0;
    this.hasFirstAppeared = false;
    this.firstAppearanceFront = true;
  }

  updateBehavior(dt, now, playerPos) {
    const dirToPlayer = playerPos.clone().sub(this.mesh.position).normalize();

    // Initialize state machine if not set
    if (this.state === 'idle') {
      this.state = 'hidden';
    }

    // Update state machine
    this.updateDodgerState(dt, now, playerPos, dirToPlayer);

    // Always face player when visible
    if (this.state !== 'hidden' && this.state !== 'hiding') {
      this.mesh.lookAt(_look.copy(playerPos));

      // Visual effects based on state
      this.updateVisualEffects(now);
    }
  }

  updateDodgerState(dt, now, playerPos, dirToPlayer) {
    switch (this.state) {
      case 'hidden':
        this.teleportTimer -= dt;
        if (this.teleportTimer <= 0) {
          this.state = 'appearing';
          this.showTelegraph('teleport', 0.5, 0xff00ff);

          // Determine teleport angle based on health
          const healthRatio = this.hp / this.maxHp;
          let maxAngleDeg;
          if (healthRatio > 0.66) {
            maxAngleDeg = 50;
          } else if (healthRatio > 0.33) {
            maxAngleDeg = 80;
          } else {
            maxAngleDeg = 120;
          }

          // First appearance: always directly in front
          let angle;
          if (!this.hasFirstAppeared || this.firstAppearanceFront) {
            angle = 0;
            this.firstAppearanceFront = false;
          } else {
            const halfAngleRad = (maxAngleDeg * Math.PI / 180) / 2;
            angle = (Math.random() - 0.5) * 2 * halfAngleRad;
          }

          // Calculate position
          const distance = 8 + Math.random() * 4;
          this.mesh.position.set(
            Math.sin(angle) * distance,
            1.5,
            -Math.cos(angle) * distance
          );

          // Return true for reappear sound
          if (typeof window !== 'undefined' && window.playBossTeleportReappear) {
            window.playBossTeleportReappear();
          }

          this.hasFirstAppeared = true;
          this.state = 'charging';
          this.chargeTimer = 1.5;
        }
        return;

      case 'appearing':
        this.state = 'charging';
        this.chargeTimer = 1.5;
        return;

      case 'charging':
        this.chargeTimer -= dt;
        if (this.chargeTimer <= 0 && !this.chargeHasExploded) {
          this.chargeHasExploded = true;

          const distToPlayer = this.mesh.position.distanceTo(playerPos);
          if (distToPlayer < 3) {
            // Player hit!
            this.state = 'hidden';
            this.teleportTimer = 3;

            if (typeof window !== 'undefined' && window.playBossExplosion) {
              window.playBossExplosion();
            }

            // Return explosion damage
            this.lastExplosionHitPlayer = true;
          } else {
            // Missed
            this.state = 'normal';
            this.hideTimer = 4 + Math.random() * 2;

            if (typeof window !== 'undefined' && window.playBossExplosion) {
              window.playBossExplosion();
            }
          }
        }
        return;

      case 'stunned':
        this.stunTimer -= dt;
        if (this.stunTimer <= 0) {
          this.state = 'hidden';
          this.teleportTimer = 2;
        }
        return;

      case 'normal':
        this.hideTimer -= dt;

        // Move erratically
        this.dodgeTimer = (this.dodgeTimer || 0) - dt;
        if (this.dodgeTimer <= 0) {
          this.dodgeTimer = 0.4 / this.phase;
          const perp = new THREE.Vector3(-dirToPlayer.z, 0, dirToPlayer.x).normalize();
          const randomDir = Math.random() < 0.5 ? 1 : -1;
          this.dodgeDir = perp.multiplyScalar(randomDir);
        }

        const approachSpeed = 0.2 + this.phase * 0.1;
        const dodgeSpeed = 1.0 + this.phase * 0.4;
        this.mesh.position.addScaledVector(dirToPlayer, approachSpeed * dt);
        if (this.dodgeDir) {
          this.mesh.position.addScaledVector(this.dodgeDir, dodgeSpeed * dt);
        }

        if (this.hideTimer <= 0) {
          this.state = 'hiding';
        }
        return;

      case 'hiding':
        this.state = 'hidden';
        this.teleportTimer = 1.5 + Math.random() * 1.5;
        return;
    }
  }

  updateVisualEffects(now) {
    // Charging: pulsing effect
    if (this.state === 'charging') {
      const pulse = 1 + Math.sin(now * 0.01) * 0.1;
      this.mesh.scale.set(pulse, pulse, pulse);
    } else {
      this.mesh.scale.set(1, 1, 1);
    }

    // Stunned: shake effect
    if (this.state === 'stunned') {
      this.mesh.position.x += (Math.random() - 0.5) * 0.05;
      this.mesh.position.y += (Math.random() - 0.5) * 0.05;
    }

    // Hidden: invisible
    if (this.state === 'hidden') {
      this.mesh.visible = false;
    } else {
      this.mesh.visible = true;
    }
  }

  takeDamage(amount, hitInfo = {}) {
    const result = super.takeDamage(amount, hitInfo);

    // DODGER: stun when hit during charge
    if (result.phaseChanged && hitInfo.isBody) {
      this.state = 'stunned';
      this.stunTimer = 2;

      if (typeof window !== 'undefined' && window.playBossStunned) {
        window.playBossStunned();
      }
    }

    return result;
  }

  onPhaseChange(newPhase) {
    super.onPhaseChange(newPhase);
    // Update dodger parameters based on phase
    this.dodgeTimer = 0.4 / newPhase;
  }
}

// ── HUNTER BOSS (Redmond "Hunter" Breakenridge) ─────────────
class HunterBoss extends Boss {
  constructor(def, levelConfig, sceneRef, telegraphing) {
    super(def, levelConfig, sceneRef, telegraphing);

    // Hunter-specific state
    this.droneOrbitAngle = 0;
    this.droneOrbitRadius = 1.5;
    this.rifleFireTimer = 0;
    this.droneFireTimer = 0;
    this.rifleFireRate = def.rifleFireRate || 2.5;
    this.droneFireRate = def.droneFireRate || 1.5;
    this.movingPattern = 'strafe';
    this.patternTimer = 0;
    this.strafeDir = 1;

    // Create drone mesh
    this.createDrone();
  }

  createDrone() {
    const droneGroup = new THREE.Group();
    const geo = getGeo(0.15);
    const droneMat = new THREE.MeshBasicMaterial({
      color: 0xff6600,
      transparent: true,
      opacity: 0.95
    });

    // Drone body (2x2 pattern)
    for (let r = 0; r < 2; r++) {
      for (let c = 0; c < 2; c++) {
        const cube = new THREE.Mesh(geo, droneMat.clone());
        cube.position.set(c * 0.15, r * 0.15, 0);
        droneGroup.add(cube);
      }
    }

    // Drone is weak point
    droneGroup.userData.isWeakPoint = true;
    droneGroup.userData.isBossDrone = true;

    this.droneMesh = droneGroup;
    this.mesh.add(this.droneMesh);
    this.weakPoints.push(this.droneMesh);
  }

  updateBehavior(dt, now, playerPos) {
    const dirToPlayer = playerPos.clone().sub(this.mesh.position).normalize();

    // Update drone orbit
    this.droneOrbitAngle += (2 + this.phase) * dt;
    this.droneMesh.position.set(
      Math.cos(this.droneOrbitAngle) * this.droneOrbitRadius,
      Math.sin(this.droneOrbitAngle * 2) * 0.3,
      Math.sin(this.droneOrbitAngle) * this.droneOrbitRadius
    );

    // Rifle fire (from boss)
    this.rifleFireTimer -= dt;
    if (this.rifleFireTimer <= 0) {
      this.rifleFireTimer = this.rifleFireRate / this.phase;
      if (this.telegraphing) {
        this.showTelegraph('projectile', 0.4, 0xff6600, this.mesh.position.clone(), dirToPlayer);
      }
      setTimeout(() => this.fireProjectile(playerPos), 400);
    }

    // Drone fire (from drone position)
    this.droneFireTimer -= dt;
    if (this.droneFireTimer <= 0 && this.droneFireTimer > -dt) {
      this.droneFireTimer = this.droneFireRate / this.phase;
      const droneWorldPos = this.droneMesh.getWorldPosition(new THREE.Vector3());
      const droneDir = playerPos.clone().sub(droneWorldPos).normalize();
      if (this.telegraphing) {
        this.showTelegraph('projectile', 0.3, 0xffaa00, droneWorldPos, droneDir);
      }
      setTimeout(() => {
        if (typeof spawnBossProjectile === 'function') {
          spawnBossProjectile(droneWorldPos, playerPos);
        }
      }, 300);
    }

    // Movement pattern
    this.patternTimer -= dt;
    if (this.patternTimer <= 0) {
      this.patternTimer = 2 + Math.random() * 2;
      this.movingPattern = Math.random() < 0.5 ? 'strafe' : 'approach';
      this.strafeDir = Math.random() < 0.5 ? 1 : -1;
    }

    // Execute movement
    if (this.movingPattern === 'strafe') {
      const perp = new THREE.Vector3(-dirToPlayer.z, 0, dirToPlayer.x).normalize();
      this.mesh.position.addScaledVector(perp, (1.5 + this.phase * 0.3) * this.strafeDir * dt);
    } else {
      this.mesh.position.addScaledVector(dirToPlayer, (0.5 + this.phase * 0.2) * dt);
    }

    // Keep distance
    const dist = this.mesh.position.distanceTo(playerPos);
    if (dist < 6) {
      this.mesh.position.addScaledVector(dirToPlayer.clone().negate(), 1 * dt);
    } else if (dist > 12) {
      this.mesh.position.addScaledVector(dirToPlayer, 1 * dt);
    }

    this.mesh.lookAt(_look.copy(playerPos));
  }

  onPhaseChange(newPhase) {
    super.onPhaseChange(newPhase);
    // Phase 2+: faster drone orbit
    if (newPhase >= 2) {
      this.droneOrbitRadius = 2.0;
    }
    // Phase 3+: add second drone orbit
    if (newPhase >= 3) {
      this.rifleFireRate = 2.0;
      this.droneFireRate = 1.0;
    }
  }
}

// ── DJ BOSS (DJ Drax) ─────────────────────────────────────
class DJBoss extends Boss {
  constructor(def, levelConfig, sceneRef, telegraphing) {
    super(def, levelConfig, sceneRef, telegraphing);

    // DJ-specific state
    this.beatTimer = 0;
    this.beatRate = def.beatRate || 0.6;
    this.fanSpawnTimer = 0;
    this.fanSpawnRate = def.fanSpawnRate || 4.0;
    this.speakerPulsePhase = 0;
    this.speakers = [];

    // Create speaker stacks
    this.createSpeakers();
  }

  createSpeakers() {
    const speakerPositions = [
      { x: -0.8, y: 0.5, z: -0.3 },
      { x: 0.8, y: 0.5, z: -0.3 },
      { x: -0.8, y: -0.5, z: -0.3 },
      { x: 0.8, y: -0.5, z: -0.3 },
    ];

    speakerPositions.forEach((pos, idx) => {
      const speakerGroup = new THREE.Group();
      const geo = getGeo(0.25);
      const speakerMat = new THREE.MeshBasicMaterial({
        color: 0x8800ff,
        transparent: true,
        opacity: 0.9
      });

      // Speaker body
      for (let i = 0; i < 2; i++) {
        const cube = new THREE.Mesh(geo, speakerMat.clone());
        cube.position.set(pos.x, pos.y + i * 0.25, pos.z);
        speakerGroup.add(cube);
      }

      speakerGroup.userData.isWeakPoint = true;
      speakerGroup.userData.isBossSpeaker = true;
      speakerGroup.userData.speakerIndex = idx;

      this.mesh.add(speakerGroup);
      this.speakers.push(speakerGroup);
      this.weakPoints.push(speakerGroup);
    });

    // Add DJ booth
    const boothGeo = getGeo(0.3);
    const boothMat = new THREE.MeshBasicMaterial({
      color: 0x4400aa,
      transparent: true,
      opacity: 0.85
    });
    const booth = new THREE.Mesh(boothGeo, boothMat);
    booth.position.set(0, 0, 0.5);
    booth.userData.isBossBody = true;
    this.mesh.add(booth);
  }

  updateBehavior(dt, now, playerPos) {
    // Beat system
    this.beatTimer -= dt;
    if (this.beatTimer <= 0) {
      this.beatTimer = this.beatRate / (1 + (this.phase - 1) * 0.3);
      this.speakerPulsePhase = 1.0;
      
      // Telegraph fan spawn on every 3rd beat
      this.beatCounter = (this.beatCounter || 0) + 1;
      if (this.beatCounter % 3 === 0 && this.telegraphing) {
        this.showTelegraph('minion', 0.8, 0xff00ff);
      }
    }

    // Fan minion spawning
    this.fanSpawnTimer -= dt;
    if (this.fanSpawnTimer <= 0) {
      this.fanSpawnTimer = this.fanSpawnRate / this.phase;
      this.spawnFanMinion(playerPos);
    }

    // Animate speakers
    this.speakerPulsePhase = Math.max(0, this.speakerPulsePhase - dt * 4);
    this.speakers.forEach((speaker, idx) => {
      const offset = idx * Math.PI / 2;
      const pulse = 1 + Math.sin(this.speakerPulsePhase * Math.PI * 2 + offset) * 0.3 * this.speakerPulsePhase;
      speaker.scale.setScalar(pulse);
    });

    // Slight movement to the beat
    const beatOffset = Math.sin(now * 0.01) * 0.1;
    this.mesh.position.y = 1.5 + beatOffset;

    this.mesh.lookAt(_look.copy(playerPos));
  }

  spawnFanMinion(playerPos) {
    const angle = Math.random() * Math.PI * 2;
    const distance = 6 + Math.random() * 3;
    const spawnPos = new THREE.Vector3(
      Math.cos(angle) * distance,
      1.5 + Math.random() * 1,
      Math.sin(angle) * distance
    );

    this.spawnMinion(spawnPos, playerPos, 'swarm');
  }

  onPhaseChange(newPhase) {
    super.onPhaseChange(newPhase);
    // Phase 2+: faster beat, spawn 2 fans
    if (newPhase >= 2) {
      this.beatRate = 0.5;
      this.fanSpawnRate = 3.0;
    }
    // Phase 3+: even faster, spawn 3 fans
    if (newPhase >= 3) {
      this.beatRate = 0.4;
      this.fanSpawnRate = 2.0;
    }
  }
}

// ── STARFIGHTER BOSS (Captain Kestrel) ─────────────────────
class StarfighterBoss extends Boss {
  constructor(def, levelConfig, sceneRef, telegraphing) {
    super(def, levelConfig, sceneRef, telegraphing);

    // Starfighter-specific state
    this.cannonFireTimer = 0;
    this.cannonFireRate = def.cannonFireRate || 2.0;
    this.missileTimer = 0;
    this.missileRate = def.missileRate || 5.0;
    this.attackPattern = 0;
    this.patternTimer = 0;
    this.strafing = false;
    this.strafeDir = 1;

    // Add wings
    this.createWings();
  }

  createWings() {
    const wingGeo = getGeo(0.25);
    const wingMat = new THREE.MeshBasicMaterial({
      color: 0x00aaff,
      transparent: true,
      opacity: 0.9
    });

    // Left wing
    const leftWing = new THREE.Group();
    for (let i = 0; i < 3; i++) {
      const cube = new THREE.Mesh(wingGeo, wingMat.clone());
      cube.position.set(-0.4 - i * 0.25, 0, i * 0.1);
      leftWing.add(cube);
    }
    this.mesh.add(leftWing);

    // Right wing
    const rightWing = new THREE.Group();
    for (let i = 0; i < 3; i++) {
      const cube = new THREE.Mesh(wingGeo, wingMat.clone());
      cube.position.set(0.4 + i * 0.25, 0, i * 0.1);
      rightWing.add(cube);
    }
    this.mesh.add(rightWing);

    // Cockpit (weak point)
    const cockpitGeo = getGeo(0.2);
    const cockpitMat = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.95
    });
    const cockpit = new THREE.Mesh(cockpitGeo, cockpitMat);
    cockpit.position.set(0, 0, 0.5);
    cockpit.userData.isWeakPoint = true;
    cockpit.userData.isBossCockpit = true;
    this.mesh.add(cockpit);
    this.weakPoints.push(cockpit);
  }

  updateBehavior(dt, now, playerPos) {
    const dirToPlayer = playerPos.clone().sub(this.mesh.position).normalize();

    // Pattern management
    this.patternTimer -= dt;
    if (this.patternTimer <= 0) {
      this.patternTimer = 3 + Math.random() * 2;
      this.attackPattern = (this.attackPattern + 1) % 3;
      this.strafing = Math.random() < 0.5;
      this.strafeDir = Math.random() < 0.5 ? 1 : -1;
    }

    // Twin cannons
    this.cannonFireTimer -= dt;
    if (this.cannonFireTimer <= 0) {
      this.cannonFireTimer = this.cannonFireRate / this.phase;

      if (this.attackPattern === 0 || this.attackPattern === 1) {
        // Spread shot
        const leftOffset = new THREE.Vector3(-0.3, 0, 0);
        const rightOffset = new THREE.Vector3(0.3, 0, 0);
        leftOffset.applyQuaternion(this.mesh.quaternion);
        rightOffset.applyQuaternion(this.mesh.quaternion);

        if (this.telegraphing) {
          this.showTelegraph('projectile', 0.3, 0x00aaff, this.mesh.position.clone().add(leftOffset), dirToPlayer);
        }
        setTimeout(() => {
          if (typeof spawnBossProjectile === 'function') {
            spawnBossProjectile(this.mesh.position.clone().add(leftOffset), playerPos);
          }
        }, 300);

        setTimeout(() => {
          if (typeof spawnBossProjectile === 'function') {
            spawnBossProjectile(this.mesh.position.clone().add(rightOffset), playerPos);
          }
        }, 350);
      }
    }

    // Missiles
    this.missileTimer -= dt;
    if (this.missileTimer <= 0) {
      this.missileTimer = this.missileRate / this.phase;

      if (this.attackPattern === 1 || this.attackPattern === 2) {
        if (this.telegraphing) {
          this.showTelegraph('projectile', 0.8, 0xff0000, this.mesh.position.clone(), dirToPlayer);
        }
        setTimeout(() => {
          // Spawn 3 missiles in a spread
          for (let i = -1; i <= 1; i++) {
            const offset = new THREE.Vector3(i * 0.5, 0, 0);
            offset.applyQuaternion(this.mesh.quaternion);
            if (typeof spawnBossProjectile === 'function') {
              spawnBossProjectile(this.mesh.position.clone().add(offset), playerPos);
            }
          }
        }, 800);
      }
    }

    // Movement
    if (this.strafing) {
      const perp = new THREE.Vector3(-dirToPlayer.z, 0, dirToPlayer.x).normalize();
      this.mesh.position.addScaledVector(perp, (2.0 + this.phase * 0.4) * this.strafeDir * dt);
    } else {
      this.mesh.position.addScaledVector(dirToPlayer, (0.6 + this.phase * 0.2) * dt);
    }

    const dist = this.mesh.position.distanceTo(playerPos);
    if (dist < 7) {
      this.mesh.position.addScaledVector(dirToPlayer.clone().negate(), 1.5 * dt);
    } else if (dist > 14) {
      this.mesh.position.addScaledVector(dirToPlayer, 1 * dt);
    }

    // Banking animation
    this.mesh.rotation.z = Math.sin(now * 0.003) * 0.2 * this.strafeDir;

    this.mesh.lookAt(_look.copy(playerPos));
  }

  onPhaseChange(newPhase) {
    super.onPhaseChange(newPhase);
    // Phase 2+: faster fire rate
    if (newPhase >= 2) {
      this.cannonFireRate = 1.5;
      this.missileRate = 4.0;
    }
    // Phase 3+: even faster
    if (newPhase >= 3) {
      this.cannonFireRate = 1.0;
      this.missileRate = 3.0;
    }
  }
}

// ── SCIENTIST BOSS (Dr. Aster) ──────────────────────────────
class ScientistBoss extends Boss {
  constructor(def, levelConfig, sceneRef, telegraphing) {
    super(def, levelConfig, sceneRef, telegraphing);

    // Scientist-specific state
    this.compilerActive = true;
    this.minionSpawnTimer = 0;
    this.minionSpawnRate = def.minionSpawnRate || 5.0;
    this.orbitingData = [];
    this.compilationTimer = 0;
    this.shieldActive = false;

    // Create compiler cube
    this.createCompiler();
  }

  createCompiler() {
    const compilerGroup = new THREE.Group();
    const geo = getGeo(0.2);
    const compilerMat = new THREE.MeshBasicMaterial({
      color: 0xff00ff,
      transparent: true,
      opacity: 0.9
    });

    // 3x3x3 cube
    for (let x = 0; x < 3; x++) {
      for (let y = 0; y < 3; y++) {
        for (let z = 0; z < 3; z++) {
          const cube = new THREE.Mesh(geo, compilerMat.clone());
          cube.position.set(
            (x - 1) * 0.2,
            (y - 1) * 0.2,
            (z - 1) * 0.2
          );
          cube.userData.isCompiler = true;
          compilerGroup.add(cube);
        }
      }
    }

    compilerGroup.userData.isWeakPoint = true;
    compilerGroup.userData.isBossCompiler = true;
    this.compilerMesh = compilerGroup;
    this.mesh.add(compilerGroup);
    this.weakPoints.push(compilerGroup);

    // Orbiting data packets
    for (let i = 0; i < 4; i++) {
      const dataGeo = getGeo(0.08);
      const dataMat = new THREE.MeshBasicMaterial({
        color: 0x00ffff,
        transparent: true,
        opacity: 0.95
      });
      const dataCube = new THREE.Mesh(dataGeo, dataMat);
      const angle = (i / 4) * Math.PI * 2;
      dataCube.position.set(
        Math.cos(angle) * 1.0,
        Math.sin(angle) * 0.5,
        Math.sin(angle) * 1.0
      );
      dataCube.userData.angle = angle;
      dataCube.userData.isBossData = true;
      this.orbitingData.push(dataCube);
      this.mesh.add(dataCube);
    }
  }

  updateBehavior(dt, now, playerPos) {
    // Animate compiler cube
    this.compilerMesh.rotation.y += dt * (1 + this.phase * 0.5);
    this.compilerMesh.rotation.x += dt * 0.5;

    // Animate orbiting data
    this.orbitingData.forEach((data, idx) => {
      data.userData.angle += (1 + this.phase * 0.3) * dt;
      const angle = data.userData.angle;
      const radius = 1.2 + Math.sin(now * 0.002 + idx) * 0.3;
      data.position.set(
        Math.cos(angle) * radius,
        Math.sin(angle * 2) * 0.5,
        Math.sin(angle) * radius
      );
      data.rotation.x += dt * 2;
      data.rotation.y += dt * 2;
    });

    // Compilation timer (spawns minions)
    this.compilationTimer += dt;
    const compileThreshold = this.minionSpawnRate / this.phase;

    if (this.compilationTimer >= compileThreshold && this.telegraphing) {
      this.showTelegraph('minion', 0.6, 0xff00ff);
    }

    if (this.compilationTimer >= compileThreshold) {
      this.compilationTimer = 0;
      this.spawnCompiledMinion(playerPos);
    }

    // Slow drift toward player
    const dirToPlayer = playerPos.clone().sub(this.mesh.position).normalize();
    this.mesh.position.addScaledVector(dirToPlayer, 0.3 * dt);

    // Maintain distance
    const dist = this.mesh.position.distanceTo(playerPos);
    if (dist < 8) {
      this.mesh.position.addScaledVector(dirToPlayer.clone().negate(), 0.5 * dt);
    }

    this.mesh.lookAt(_look.copy(playerPos));
  }

  spawnCompiledMinion(playerPos) {
    const angle = Math.random() * Math.PI * 2;
    const distance = 7 + Math.random() * 3;
    const spawnPos = new THREE.Vector3(
      Math.cos(angle) * distance,
      1.5,
      Math.sin(angle) * distance
    );

    // Mix of basic and fast enemies
    const minionType = Math.random() < 0.6 ? 'basic' : 'fast';
    this.spawnMinion(spawnPos, playerPos, minionType);
  }

  onPhaseChange(newPhase) {
    super.onPhaseChange(newPhase);
    // Phase 2+: more data packets
    if (newPhase >= 2) {
      this.minionSpawnRate = 4.0;
    }
    // Phase 3+: even faster compilation
    if (newPhase >= 3) {
      this.minionSpawnRate = 3.0;
    }
  }
}

// ── MONK BOSS (Sunflare Seraph) ─────────────────────────────
class MonkBoss extends Boss {
  constructor(def, levelConfig, sceneRef, telegraphing) {
    super(def, levelConfig, sceneRef, telegraphing);

    // Monk-specific state
    this.sunNodes = [];
    this.nodeOrbitSpeed = 1.0;
    this.meditationTimer = 0;
    this.meditationDuration = def.meditationDuration || 3.0;
    this.isMeditating = false;
    this.auraPulse = 0;

    // Create sun nodes
    this.createSunNodes();
  }

  createSunNodes() {
    const nodeCount = 5;
    const geo = getGeo(0.2);
    const nodeMat = new THREE.MeshBasicMaterial({
      color: 0xffdd00,
      transparent: true,
      opacity: 0.95
    });

    for (let i = 0; i < nodeCount; i++) {
      const nodeGroup = new THREE.Group();
      const angle = (i / nodeCount) * Math.PI * 2;

      // Sun node (2x2 pattern)
      for (let r = 0; r < 2; r++) {
        for (let c = 0; c < 2; c++) {
          const cube = new THREE.Mesh(geo, nodeMat.clone());
          cube.position.set(c * 0.2, r * 0.2, 0);
          nodeGroup.add(cube);
        }
      }

      nodeGroup.userData.isWeakPoint = true;
      nodeGroup.userData.isBossSunNode = true;
      nodeGroup.userData.nodeIndex = i;
      nodeGroup.userData.angle = angle;

      this.sunNodes.push(nodeGroup);
      this.mesh.add(nodeGroup);
      this.weakPoints.push(nodeGroup);
    }

    // Central body (monk)
    const bodyGeo = getGeo(0.3);
    const bodyMat = new THREE.MeshBasicMaterial({
      color: 0xffaa00,
      transparent: true,
      opacity: 0.85
    });
    const body = new THREE.Mesh(bodyGeo, bodyMat);
    body.userData.isBossBody = true;
    this.mesh.add(body);

    // Aura ring
    const auraGeo = new THREE.RingGeometry(0.8, 1.0, 32);
    const auraMat = new THREE.MeshBasicMaterial({
      color: 0xffaa00,
      transparent: true,
      opacity: 0.5,
      side: THREE.DoubleSide
    });
    this.auraMesh = new THREE.Mesh(auraGeo, auraMat);
    this.auraMesh.rotation.x = -Math.PI / 2;
    this.mesh.add(this.auraMesh);
  }

  updateBehavior(dt, now, playerPos) {
    // Update sun node orbits
    this.sunNodes.forEach((node, idx) => {
      node.userData.angle += this.nodeOrbitSpeed * dt * (1 + (this.phase - 1) * 0.5);
      const angle = node.userData.angle;
      const radius = 1.5 + Math.sin(now * 0.001 + idx) * 0.4;
      const height = Math.sin(angle * 3) * 0.5;

      node.position.set(
        Math.cos(angle) * radius,
        height,
        Math.sin(angle) * radius
      );

      // Node rotation
      node.rotation.y += dt * 2;
      node.rotation.x += dt;
    });

    // Meditation cycle
    if (this.isMeditating) {
      this.meditationTimer -= dt;
      if (this.meditationTimer <= 0) {
        this.isMeditating = false;
        this.meditationTimer = this.meditationDuration * (1 + (this.phase - 1) * 0.3);
      }
    } else {
      this.meditationTimer -= dt;
      if (this.meditationTimer <= 0) {
        this.isMeditating = true;
        // Telegraph meditation burst
        if (this.telegraphing) {
          this.showTelegraph('charge', 1.0, 0xffdd00);
        }
        setTimeout(() => this.fireMeditationBurst(playerPos), 1000);
      }
    }

    // Aura pulse
    this.auraPulse += dt * (2 + this.phase);
    const pulseScale = 1 + Math.sin(this.auraPulse) * 0.3;
    this.auraMesh.scale.setScalar(pulseScale);
    this.auraMesh.material.opacity = 0.3 + Math.sin(this.auraPulse) * 0.2;

    // Slow movement
    const dirToPlayer = playerPos.clone().sub(this.mesh.position).normalize();
    if (!this.isMeditating) {
      this.mesh.position.addScaledVector(dirToPlayer, 0.2 * dt);
    }

    // Maintain distance
    const dist = this.mesh.position.distanceTo(playerPos);
    if (dist < 6) {
      this.mesh.position.addScaledVector(dirToPlayer.clone().negate(), 0.8 * dt);
    } else if (dist > 10) {
      this.mesh.position.addScaledVector(dirToPlayer, 0.3 * dt);
    }

    this.mesh.lookAt(_look.copy(playerPos));
    this.mesh.rotation.y += dt * 0.5;
  }

  fireMeditationBurst(playerPos) {
    // Fire projectiles from each sun node
    this.sunNodes.forEach(node => {
      const nodeWorldPos = node.getWorldPosition(new THREE.Vector3());
      const dir = playerPos.clone().sub(nodeWorldPos).normalize();

      if (typeof spawnBossProjectile === 'function') {
        spawnBossProjectile(nodeWorldPos, playerPos);
      }
    });

    // Central burst
    if (typeof spawnBossProjectile === 'function') {
      spawnBossProjectile(this.mesh.position.clone(), playerPos);
    }
  }

  onPhaseChange(newPhase) {
    super.onPhaseChange(newPhase);
    // Phase 2+: faster orbit
    if (newPhase >= 2) {
      this.nodeOrbitSpeed = 1.5;
      this.meditationDuration = 2.5;
    }
    // Phase 3+: even faster
    if (newPhase >= 3) {
      this.nodeOrbitSpeed = 2.0;
      this.meditationDuration = 2.0;
    }
  }
}

// ── LEVEL 20 FINAL BOSSES ────────────────────────────────────

/**
 * Walter "Pa" Breakenridge - Patriarch on CRT throne
 * Phase 1: Hologram projections (2-3 fake Walters)
 * Phase 2: CRT barrage (rapid projectiles)
 * Phase 3: Combination attack
 * Phase 4: Desperate assault (all mechanics)
 */
class WalterBoss extends Boss {
  constructor(def, levelConfig, sceneRef, telegraphing) {
    super(def, levelConfig, sceneRef, telegraphing);
    this.holograms = [];
    this.hologramTimer = 0;
    this.crtBarrageTimer = 0;
    this.isBarraging = false;
  }

  updateBehavior(dt, now, playerPos) {
    // Update holograms
    this.updateHolograms(dt, now, playerPos);
    
    // Update CRT barrage
    this.updateCRTBarrage(dt, now, playerPos);

    // Move toward player slowly
    _dir.copy(playerPos).sub(this.mesh.position);
    const dist = _dir.length();
    if (dist > 0.01) _dir.divideScalar(dist);
    this.mesh.lookAt(_look.copy(playerPos));
    
    const speed = 0.15 + this.phase * 0.05;
    this.mesh.position.addScaledVector(_dir, speed * dt);
  }

  updateHolograms(dt, now, playerPos) {
    this.hologramTimer -= dt;
    
    if (this.phase >= 1 && this.hologramTimer <= 0) {
      // Spawn holograms based on phase
      const hologramCount = Math.min(3, this.phase);
      
      // Remove old holograms
      this.holograms.forEach(h => {
        this.sceneRef.remove(h.mesh);
      });
      this.holograms = [];
      
      // Spawn new holograms
      for (let i = 0; i < hologramCount; i++) {
        const angle = (i / hologramCount) * Math.PI * 2;
        const hologram = {
          mesh: this.mesh.clone(),
          angle: angle,
          distance: 3 + Math.random() * 2
        };
        hologram.mesh.material = hologram.mesh.material.clone();
        hologram.mesh.material.opacity = 0.4;
        this.sceneRef.add(hologram.mesh);
        this.holograms.push(hologram);
      }
      
      this.hologramTimer = 5.0 + Math.random() * 3.0;
    }
    
    // Update hologram positions (orbit around boss)
    this.holograms.forEach((h, i) => {
      h.angle += dt * 0.5;
      h.mesh.position.copy(this.mesh.position);
      h.mesh.position.x += Math.cos(h.angle) * h.distance;
      h.mesh.position.z += Math.sin(h.angle) * h.distance;
      h.mesh.material.opacity = 0.3 + Math.sin(now * 0.003 + i) * 0.2;
    });
  }

  updateCRTBarrage(dt, now, playerPos) {
    if (this.phase >= 2) {
      this.crtBarrageTimer -= dt;
      
      if (this.crtBarrageTimer <= 0 && !this.isBarraging) {
        // Start barrage
        this.isBarraging = true;
        this.showTelegraph('charge', 1.0, 0x88ff00);
        this.crtBarrageTimer = 0.1; // Rapid fire
        this.barrageCount = 5 + this.phase * 2;
      }
      
      if (this.isBarraging) {
        this.crtBarrageTimer -= dt;
        if (this.crtBarrageTimer <= 0) {
          // Fire projectile
          this.fireProjectile(playerPos);
          this.barrageCount--;
          
          if (this.barrageCount <= 0) {
            this.isBarraging = false;
            this.crtBarrageTimer = 3.0 - this.phase * 0.5;
          } else {
            this.crtBarrageTimer = 0.1;
          }
        }
      }
    }
  }

  onProjectileFire(playerPos) {
    // Override to prevent auto-firing (we handle it manually)
  }

  onPhaseChange(newPhase) {
    super.onPhaseChange(newPhase);
    this.hologramTimer = 0; // Spawn new holograms immediately
  }
}

/**
 * KERNEL - Monolith with 3 ports
 * Phase 1: Port 1 active (weak point exposed)
 * Phase 2: Port 2 active (projectiles)
 * Phase 3: Core phase (all ports vulnerable, rapid attacks)
 */
class KernelBoss extends Boss {
  constructor(def, levelConfig, sceneRef, telegraphing) {
    super(def, levelConfig, sceneRef, telegraphing);
    this.activePort = 1;
    this.portSwitchTimer = 0;
    this.corePhaseActive = false;
  }

  buildMesh(def) {
    const mesh = super.buildMesh(def);
    
    // Add 3 port indicators (colored voxels on the monolith)
    const voxels = mesh.children.filter(c => c.userData.isBossBody);
    if (voxels.length >= 3) {
      // Designate 3 voxels as ports
      voxels[0].userData.port = 1;
      voxels[1].userData.port = 2;
      voxels[2].userData.port = 3;
    }
    
    return mesh;
  }

  updateBehavior(dt, now, playerPos) {
    // Update port switching
    this.updatePorts(dt, now);
    
    // Move very slowly (monolith)
    _dir.copy(playerPos).sub(this.mesh.position);
    const dist = _dir.length();
    if (dist > 0.01) _dir.divideScalar(dist);
    this.mesh.lookAt(_look.copy(playerPos));
    
    const speed = 0.05 + this.phase * 0.02;
    this.mesh.position.addScaledVector(_dir, speed * dt);
  }

  updatePorts(dt, now) {
    this.portSwitchTimer -= dt;
    
    if (this.phase === 3 && !this.corePhaseActive) {
      // Core phase - all ports vulnerable
      this.corePhaseActive = true;
      this.activePort = 0; // All active
      
      // Make all voxels vulnerable
      this.mesh.children.forEach(c => {
        if (c.userData && c.userData.isBossBody) {
          c.userData.weakPoint = true;
          c.material.color.setHex(0xff8800);
          c.material.opacity = 1.0;
        }
      });
    } else if (this.phase < 3 && this.portSwitchTimer <= 0) {
      // Switch active port
      this.activePort = (this.activePort % 3) + 1;
      this.portSwitchTimer = 8.0 - this.phase * 2.0;
      
      // Update visual indicators
      this.mesh.children.forEach(c => {
        if (c.userData && c.userData.isBossBody && c.userData.port) {
          if (c.userData.port === this.activePort) {
            c.userData.weakPoint = true;
            c.material.opacity = 1.0;
          } else {
            c.userData.weakPoint = false;
            c.material.opacity = 0.5;
          }
        }
      });
    }
  }

  onProjectileFire(playerPos) {
    if (this.phase >= 2) {
      // Fire from active port
      this.fireProjectile(playerPos);
      
      if (this.corePhaseActive) {
        // Core phase - fire multiple projectiles
        const spread = Math.PI / 6;
        for (let i = -1; i <= 1; i++) {
          const angle = new THREE.Vector3(
            playerPos.x - this.mesh.position.x,
            0,
            playerPos.z - this.mesh.position.z
          ).normalize();
          angle.applyAxisAngle(new THREE.Vector3(0, 1, 0), i * spread);
          this.fireProjectile(this.mesh.position.clone().add(angle.multiplyScalar(2)));
        }
      }
    }
  }
}

/**
 * Synth Kraken - Portal with tentacles
 * Phase 1: Tentacle spawns (2-3 tentacles)
 * Phase 2: Acid spit (projectiles)
 * Phase 3: Portal rotation (tentacles spin)
 * Phase 4: All mechanics combined
 */
class KrakenBoss extends Boss {
  constructor(def, levelConfig, sceneRef, telegraphing) {
    super(def, levelConfig, sceneRef, telegraphing);
    this.tentacles = [];
    this.tentacleSpawnTimer = 0;
    this.rotationSpeed = 0;
  }

  updateBehavior(dt, now, playerPos) {
    // Update tentacle spawning
    this.updateTentacles(dt, now, playerPos);
    
    // Update rotation
    if (this.phase >= 3) {
      this.rotationSpeed = 0.5 + this.phase * 0.2;
      this.mesh.rotation.y += this.rotationSpeed * dt;
    }
    
    // Move slowly
    _dir.copy(playerPos).sub(this.mesh.position);
    const dist = _dir.length();
    if (dist > 0.01) _dir.divideScalar(dist);
    this.mesh.lookAt(_look.copy(playerPos));
    
    const speed = 0.1 + this.phase * 0.03;
    this.mesh.position.addScaledVector(_dir, speed * dt);
  }

  updateTentacles(dt, now, playerPos) {
    this.tentacleSpawnTimer -= dt;
    
    if (this.tentacleSpawnTimer <= 0) {
      const maxTentacles = 2 + this.phase;
      
      if (this.tentacles.length < maxTentacles) {
        // Spawn a tentacle (minion)
        const angle = Math.random() * Math.PI * 2;
        const dist = 3 + Math.random() * 2;
        const pos = this.mesh.position.clone();
        pos.x += Math.cos(angle) * dist;
        pos.z += Math.sin(angle) * dist;
        
        this.spawnMinion(pos, playerPos, 'basic');
        this.tentacles.push({ angle, spawnTime: now });
      }
      
      this.tentacleSpawnTimer = 6.0 - this.phase * 0.5;
    }
  }

  onProjectileFire(playerPos) {
    if (this.phase >= 2) {
      // Acid spit - fire at player
      this.fireProjectile(playerPos);
      
      if (this.phase >= 4) {
        // Additional spit angles
        const spread = Math.PI / 8;
        for (let i = -1; i <= 1; i++) {
          const angle = new THREE.Vector3(
            playerPos.x - this.mesh.position.x,
            0,
            playerPos.z - this.mesh.position.z
          ).normalize();
          angle.applyAxisAngle(new THREE.Vector3(0, 1, 0), i * spread);
          const target = this.mesh.position.clone().add(angle.multiplyScalar(10));
          this.fireProjectile(target);
        }
      }
    }
  }
}

/**
 * Afterimage Seraphim - Angel with afterimage turrets
 * Phase 1: Afterimage turrets (spawn 2-3 stationary turrets)
 * Phase 2: Dive attacks (charge at player)
 * Phase 3: Divine light (continuous beam attack)
 */
class SeraphimBoss extends Boss {
  constructor(def, levelConfig, sceneRef, telegraphing) {
    super(def, levelConfig, sceneRef, telegraphing);
    this.afterimages = [];
    this.afterimageSpawnTimer = 0;
    this.isDiving = false;
    this.diveTimer = 0;
  }

  updateBehavior(dt, now, playerPos) {
    // Update afterimage turrets
    this.updateAfterimages(dt, now, playerPos);
    
    // Update dive attacks
    if (this.phase >= 2) {
      this.updateDiveAttack(dt, now, playerPos);
    }
    
    // Move gracefully
    if (!this.isDiving) {
      _dir.copy(playerPos).sub(this.mesh.position);
      const dist = _dir.length();
      if (dist > 0.01) _dir.divideScalar(dist);
      this.mesh.lookAt(_look.copy(playerPos));
      
      // Float up and down
      const baseY = 1.5;
      this.mesh.position.y = baseY + Math.sin(now * 0.002) * 0.3;
      
      const speed = 0.2 + this.phase * 0.05;
      this.mesh.position.addScaledVector(_dir, speed * dt);
    }
  }

  updateAfterimages(dt, now, playerPos) {
    this.afterimageSpawnTimer -= dt;
    
    if (this.afterimageSpawnTimer <= 0) {
      const maxAfterimages = 2 + this.phase;
      
      if (this.afterimages.length < maxAfterimages) {
        // Spawn afterimage turret (minion that stays in place)
        const angle = Math.random() * Math.PI * 2;
        const dist = 4 + Math.random() * 2;
        const pos = this.mesh.position.clone();
        pos.x += Math.cos(angle) * dist;
        pos.z += Math.sin(angle) * dist;
        
        this.spawnMinion(pos, playerPos, 'basic');
        this.afterimages.push({ position: pos.clone(), spawnTime: now });
      }
      
      this.afterimageSpawnTimer = 7.0 - this.phase * 0.5;
    }
  }

  updateDiveAttack(dt, now, playerPos) {
    this.diveTimer -= dt;
    
    if (this.diveTimer <= 0 && !this.isDiving) {
      // Start dive
      this.isDiving = true;
      this.showTelegraph('charge', 1.5, 0xffff88);
      this.diveStartPos = this.mesh.position.clone();
      this.diveTargetPos = playerPos.clone();
      this.diveDuration = 1.5;
      this.diveElapsed = 0;
    }
    
    if (this.isDiving) {
      this.diveElapsed += dt;
      const t = this.diveElapsed / this.diveDuration;
      
      if (t >= 1.0) {
        // Dive complete
        this.isDiving = false;
        this.diveTimer = 5.0;
      } else {
        // Move toward target
        this.mesh.position.lerpVectors(this.diveStartPos, this.diveTargetPos, t);
      }
    }
  }

  onMinionSpawn(playerPos) {
    // Don't auto-spawn minions (we handle it manually)
  }
}

/**
 * Sun-Eater Train - 3 cars that cycle active states
 * Phase 1: Car 1 active (engine)
 * Phase 2: Car 2 active (cargo)
 * Phase 3: Car 3 active (caboose)
 * Phase 4: All cars active
 * Phase 5: Emergency mode (all cars + rapid fire)
 */
class TrainBoss extends Boss {
  constructor(def, levelConfig, sceneRef, telegraphing) {
    super(def, levelConfig, sceneRef, telegraphing);
    this.activeCar = 1;
    this.carSwitchTimer = 0;
    this.cars = [];
  }

  buildMesh(def) {
    const mesh = super.buildMesh(def);
    
    // Create 3 cars (sub-groups)
    const voxels = mesh.children.filter(c => c.userData.isBossBody);
    const totalVoxels = voxels.length;
    const voxelsPerCar = Math.floor(totalVoxels / 3);
    
    for (let i = 0; i < 3; i++) {
      const start = i * voxelsPerCar;
      const end = (i === 2) ? totalVoxels : start + voxelsPerCar;
      
      for (let j = start; j < end; j++) {
        voxels[j].userData.car = i + 1;
      }
    }
    
    return mesh;
  }

  updateBehavior(dt, now, playerPos) {
    // Update car cycling
    this.updateCars(dt, now);
    
    // Move like a train (mostly straight, slight curve)
    _dir.set(0, 0, -1);
    const speed = 0.25 + this.phase * 0.05;
    
    // Circle around arena
    const angle = now * 0.0002;
    this.mesh.position.x = Math.sin(angle) * 6;
    this.mesh.position.z = -8 + Math.cos(angle) * 6;
    this.mesh.rotation.y = angle + Math.PI / 2;
  }

  updateCars(dt, now) {
    this.carSwitchTimer -= dt;
    
    if (this.phase <= 3) {
      // Cycle through cars
      if (this.carSwitchTimer <= 0) {
        this.activeCar = (this.activeCar % 3) + 1;
        this.carSwitchTimer = 10.0 - this.phase * 1.5;
        
        // Update visual indicators
        this.mesh.children.forEach(c => {
          if (c.userData && c.userData.isBossBody && c.userData.car) {
            if (c.userData.car === this.activeCar) {
              c.userData.weakPoint = true;
              c.material.opacity = 1.0;
              setMaterialEmissiveSafe(c.material, new THREE.Color(0xffaa00), c.material.emissiveIntensity ?? 1);
            } else {
              c.userData.weakPoint = false;
              c.material.opacity = 0.4;
              setMaterialEmissiveSafe(c.material, new THREE.Color(0x000000), c.material.emissiveIntensity ?? 0);
            }
          }
        });
      }
    } else {
      // Phase 4-5: All cars active
      this.mesh.children.forEach(c => {
        if (c.userData && c.userData.isBossBody && c.userData.car) {
          c.userData.weakPoint = true;
          c.material.opacity = 1.0;
          setMaterialEmissiveSafe(c.material, new THREE.Color(0xffaa00), c.material.emissiveIntensity ?? 1);
        }
      });
    }
  }

  onProjectileFire(playerPos) {
    if (this.phase >= 4) {
      // All cars fire
      for (let i = 0; i < 3; i++) {
        const offset = new THREE.Vector3(
          (i - 1) * 0.8,
          0,
          0
        );
        const pos = this.mesh.position.clone().add(offset);
        this.fireProjectile(playerPos);
      }
    }
  }
}

// ── OUTLAW BOSS (Theodore "Shady" Breakenridge) ───────────
class OutlawBoss extends Boss {
  constructor(def, levelConfig, sceneRef, telegraphing) {
    super(def, levelConfig, sceneRef, telegraphing);

    // Outlaw-specific state
    this.vanishTimer = 0;
    this.vanishDuration = def.vanishDuration || 2.0;
    this.shadowBulletTimer = 0;
    this.shadowBulletRate = def.shadowBulletRate || 0.8;
    this.isVanished = false;
    this.reappearPosition = null;
  }

  updateBehavior(dt, now, playerPos) {
    const dirToPlayer = playerPos.clone().sub(this.mesh.position).normalize();

    // Vanish cycle
    if (!this.isVanished) {
      this.vanishTimer -= dt;
      if (this.vanishTimer <= 0) {
        this.vanish(now, playerPos);
        return;
      }

      // Fire shadow bullets
      this.shadowBulletTimer -= dt;
      if (this.shadowBulletTimer <= 0) {
        this.shadowBulletTimer = this.shadowBulletRate / this.phase;
        this.fireShadowBullets(playerPos);
      }

      // Move toward player
      const speed = 0.8 + this.phase * 0.2;
      this.mesh.position.addScaledVector(dirToPlayer, speed * dt);

      // Keep distance
      const dist = this.mesh.position.distanceTo(playerPos);
      if (dist < 6) {
        this.mesh.position.addScaledVector(dirToPlayer.clone().negate(), 1 * dt);
      } else if (dist > 12) {
        this.mesh.position.addScaledVector(dirToPlayer, 0.5 * dt);
      }

      // Visible - show mesh
      this.mesh.visible = true;

    } else {
      // Vanished - invisible, moving to reappear position
      this.mesh.visible = false;

      // Move to reappear position
      if (this.reappearPosition) {
        const dirToReappear = this.reappearPosition.clone().sub(this.mesh.position);
        const distToReappear = dirToReappear.length();
        if (distToReappear > 0.1) {
          dirToReappear.normalize();
          this.mesh.position.addScaledVector(dirToReappear, 8 * dt);
        }

        this.vanishTimer -= dt;
        if (this.vanishTimer <= 0) {
          this.reappear();
        }
      }
    }

    this.mesh.lookAt(_look.copy(playerPos));
  }

  vanish(now, playerPos) {
    this.isVanished = true;
    this.vanishTimer = this.vanishDuration / this.phase;

    // Telegraph vanish
    if (this.telegraphing) {
      this.showTelegraph('teleport', 0.5, 0x8800ff);
    }

    // Choose reappear position (behind or flanking player)
    const angle = Math.random() * Math.PI * 2;
    const distance = 6 + Math.random() * 3;
    this.reappearPosition = new THREE.Vector3(
      Math.sin(angle) * distance,
      1.5,
      Math.cos(angle) * distance
    );

    if (typeof window !== 'undefined' && window.playBossTeleportReappear) {
      window.playBossTeleportReappear();
    }
  }

  reappear() {
    this.isVanished = false;
    this.mesh.position.copy(this.reappearPosition);
    this.vanishTimer = 4 + Math.random() * 2;

    // Telegraph ambush attack
    if (this.telegraphing) {
      this.showTelegraph('charge', 0.6, 0x8800ff);
    }

    // Fire burst of shadow bullets
    setTimeout(() => {
      if (typeof window !== 'undefined' && window.updateBossHealthBar) {
        // Boss is back
      }
    }, 600);
  }

  fireShadowBullets(playerPos) {
    if (this.telegraphing) {
      this.showTelegraph('projectile', 0.3, 0x440088);
    }

    // Fire multiple shadow bullets in a spread
    const bulletCount = 2 + this.phase;
    for (let i = 0; i < bulletCount; i++) {
      setTimeout(() => {
        if (typeof spawnBossProjectile === 'function') {
          spawnBossProjectile(this.mesh.position.clone(), playerPos);
        }
      }, i * 100);
    }
  }

  onPhaseChange(newPhase) {
    super.onPhaseChange(newPhase);
    // Phase 2+: faster vanish cycle
    if (newPhase >= 2) {
      this.vanishDuration = 1.5;
      this.shadowBulletRate = 0.6;
    }
    // Phase 3+: even faster
    if (newPhase >= 3) {
      this.vanishDuration = 1.0;
      this.shadowBulletRate = 0.5;
    }
  }
}

// ── COMMANDER BOSS (Commander Halcyon) ────────────────────
class CommanderBoss extends Boss {
  constructor(def, levelConfig, sceneRef, telegraphing) {
    super(def, levelConfig, sceneRef, telegraphing);

    // Commander-specific state
    this.shieldTiles = [];
    this.shieldOrbitAngle = 0;
    this.shieldOrbitSpeed = 1.0;
    this.laserTimer = 0;
    this.laserRate = def.laserRate || 1.5;
    this.shieldActive = true;

    // Create shield tiles
    this.createShieldTiles();
  }

  createShieldTiles() {
    const tileCount = 6;
    const geo = getGeo(0.2);
    const tileMat = new THREE.MeshBasicMaterial({
      color: 0x00aaff,
      transparent: true,
      opacity: 0.7
    });

    for (let i = 0; i < tileCount; i++) {
      const tileGroup = new THREE.Group();
      const angle = (i / tileCount) * Math.PI * 2;

      // Shield tile (2x1 pattern)
      for (let r = 0; r < 2; r++) {
        const cube = new THREE.Mesh(geo, tileMat.clone());
        cube.position.set(0, r * 0.2, 0);
        tileGroup.add(cube);
      }

      tileGroup.userData.isShieldTile = true;
      tileGroup.userData.tileIndex = i;
      tileGroup.userData.angle = angle;

      this.shieldTiles.push(tileGroup);
      this.mesh.add(tileGroup);
    }
  }

  updateBehavior(dt, now, playerPos) {
    const dirToPlayer = playerPos.clone().sub(this.mesh.position).normalize();

    // Update shield orbit
    this.shieldOrbitAngle += this.shieldOrbitSpeed * dt * (1 + (this.phase - 1) * 0.3);

    this.shieldTiles.forEach((tile, idx) => {
      const baseAngle = tile.userData.angle;
      const orbitRadius = 2.0 + Math.sin(now * 0.002 + idx) * 0.3;
      const angle = baseAngle + this.shieldOrbitAngle;

      tile.position.set(
        Math.cos(angle) * orbitRadius,
        Math.sin(angle * 2) * 0.5,
        Math.sin(angle) * orbitRadius
      );

      // Tile rotation
      tile.rotation.y += dt;
      tile.rotation.x += dt * 0.5;
    });

    // Laser fire
    this.laserTimer -= dt;
    if (this.laserTimer <= 0) {
      this.laserTimer = this.laserRate / this.phase;
      this.fireLaser(playerPos);
    }

    // Slow movement
    const speed = 0.4 + this.phase * 0.1;
    this.mesh.position.addScaledVector(dirToPlayer, speed * dt);

    // Keep distance
    const dist = this.mesh.position.distanceTo(playerPos);
    if (dist < 7) {
      this.mesh.position.addScaledVector(dirToPlayer.clone().negate(), 0.8 * dt);
    } else if (dist > 14) {
      this.mesh.position.addScaledVector(dirToPlayer, 0.3 * dt);
    }

    this.mesh.lookAt(_look.copy(playerPos));
  }

  fireLaser(playerPos) {
    if (this.telegraphing) {
      this.showTelegraph('projectile', 0.5, 0x00aaff);
    }

    // Fire laser from shield tiles
    const activeTiles = this.shieldTiles.slice(0, 2 + this.phase);
    activeTiles.forEach((tile, idx) => {
      setTimeout(() => {
        if (typeof spawnBossProjectile === 'function') {
          const tileWorldPos = tile.getWorldPosition(new THREE.Vector3());
          spawnBossProjectile(tileWorldPos, playerPos);
        }
      }, idx * 150);
    });
  }

  takeDamage(amount, hitInfo = {}) {
    // Shield absorbs some damage
    let damageTaken = amount;
    if (this.shieldActive && !hitInfo.bypassShield) {
      damageTaken = amount * 0.6;
      if (Math.random() < 0.1 * this.phase) {
        // Shield breaks temporarily
        this.shieldActive = false;
        setTimeout(() => { this.shieldActive = true; }, 2000);
      }
    }

    return super.takeDamage(damageTaken, hitInfo);
  }

  onPhaseChange(newPhase) {
    super.onPhaseChange(newPhase);
    // Phase 2+: faster shield orbit
    if (newPhase >= 2) {
      this.shieldOrbitSpeed = 1.5;
      this.laserRate = 1.2;
    }
    // Phase 3+: even faster
    if (newPhase >= 3) {
      this.shieldOrbitSpeed = 2.0;
      this.laserRate = 1.0;
    }
  }
}

// ── DIVA BOSS (Madame Coda) ───────────────────────────────
class DivaBoss extends Boss {
  constructor(def, levelConfig, sceneRef, telegraphing) {
    super(def, levelConfig, sceneRef, telegraphing);

    // Diva-specific state
    this.microphones = [];
    this.beamTimer = 0;
    this.beamRate = def.beamRate || 1.2;
    this.performanceTimer = 0;
    this.performanceDuration = def.performanceDuration || 3.0;

    // Create microphone turrets
    this.createMicrophones();
  }

  createMicrophones() {
    const micPositions = [
      { x: -1.2, y: 0.3, z: 0.2 },
      { x: 1.2, y: 0.3, z: 0.2 },
      { x: 0, y: 0.8, z: 0.3 },
    ];

    micPositions.forEach((pos, idx) => {
      const micGroup = new THREE.Group();
      const geo = getGeo(0.15);
      const micMat = new THREE.MeshBasicMaterial({
        color: 0xff00ff,
        transparent: true,
        opacity: 0.9
      });

      // Microphone stand
      for (let i = 0; i < 3; i++) {
        const cube = new THREE.Mesh(geo, micMat.clone());
        cube.position.set(pos.x + i * 0.05, pos.y + i * 0.15, pos.z);
        micGroup.add(cube);
      }

      // Mic head (weak point)
      const headGeo = getGeo(0.12);
      const headMat = new THREE.MeshBasicMaterial({
        color: 0xffffff,
        transparent: true,
        opacity: 0.95
      });
      const head = new THREE.Mesh(headGeo, headMat);
      head.position.set(pos.x + 0.1, pos.y + 0.45, pos.z);
      head.userData.isWeakPoint = true;
      head.userData.isMicrophone = true;
      micGroup.add(head);
      this.weakPoints.push(head);

      micGroup.userData.microphoneIndex = idx;
      this.microphones.push(micGroup);
      this.mesh.add(micGroup);
    });
  }

  updateBehavior(dt, now, playerPos) {
    const dirToPlayer = playerPos.clone().sub(this.mesh.position).normalize();

    // Performance cycle
    this.performanceTimer -= dt;
    if (this.performanceTimer <= 0) {
      this.performanceTimer = this.performanceDuration / this.phase;

      // Telegraph performance
      if (this.telegraphing) {
        this.showTelegraph('charge', 0.8, 0xff00ff);
      }

      // Fire all microphones
      setTimeout(() => this.fireAllMicrophones(playerPos), 800);
    }

    // Beam fire
    this.beamTimer -= dt;
    if (this.beamTimer <= 0) {
      this.beamTimer = this.beamRate / this.phase;

      // Random microphone fires
      const activeMics = this.microphones.filter(mic => mic.children[3] && mic.children[3].userData.isWeakPoint);
      if (activeMics.length > 0) {
        const mic = activeMics[Math.floor(Math.random() * activeMics.length)];
        this.fireMicrophoneBeam(mic, playerPos);
      }
    }

    // Animate microphones
    this.microphones.forEach((mic, idx) => {
      const offset = idx * Math.PI / 2;
      mic.rotation.y = Math.sin(now * 0.002 + offset) * 0.3;
      mic.position.y += Math.sin(now * 0.003 + idx) * 0.002;
    });

    // Slight movement
    this.mesh.position.addScaledVector(dirToPlayer, 0.3 * dt);

    // Maintain distance
    const dist = this.mesh.position.distanceTo(playerPos);
    if (dist < 6) {
      this.mesh.position.addScaledVector(dirToPlayer.clone().negate(), 0.6 * dt);
    } else if (dist > 12) {
      this.mesh.position.addScaledVector(dirToPlayer, 0.2 * dt);
    }

    this.mesh.lookAt(_look.copy(playerPos));
  }

  fireMicrophoneBeam(mic, playerPos) {
    if (this.telegraphing) {
      const micPos = mic.getWorldPosition(new THREE.Vector3());
      this.showTelegraph('projectile', 0.4, 0xff00ff, micPos);
    }

    setTimeout(() => {
      if (typeof spawnBossProjectile === 'function') {
        const micPos = mic.getWorldPosition(new THREE.Vector3());
        spawnBossProjectile(micPos, playerPos);
      }
    }, 400);
  }

  fireAllMicrophones(playerPos) {
    this.microphones.forEach((mic, idx) => {
      setTimeout(() => {
        if (mic.children[3] && mic.children[3].userData.isWeakPoint) {
          this.fireMicrophoneBeam(mic, playerPos);
        }
      }, idx * 100);
    });
  }

  onPhaseChange(newPhase) {
    super.onPhaseChange(newPhase);
    // Phase 2+: faster performance cycle
    if (newPhase >= 2) {
      this.beamRate = 1.0;
      this.performanceDuration = 2.5;
    }
    // Phase 3+: even faster
    if (newPhase >= 3) {
      this.beamRate = 0.8;
      this.performanceDuration = 2.0;
    }
  }
}

// ── TWIN GLITCH UNITS BOSS ───────────────────────────────
class TwinGlitchBoss extends Boss {
  constructor(def, levelConfig, sceneRef, telegraphing) {
    super(def, levelConfig, sceneRef, telegraphing);

    // Twin-specific state
    this.sisters = [];
    this.vulnerabilitySwapTimer = 0;
    this.vulnerabilitySwapRate = def.vulnerabilitySwapRate || 4.0;
    this.activeSisterIndex = 0; // Which sister is vulnerable
    this.glitchTimer = 0;

    // Create twin sisters
    this.createSisters();
  }

  createSisters() {
    const sisterData = [
      { xOffset: -1.5, color: 0x00ffff, name: 'Glitch-Sister-Alpha' },
      { xOffset: 1.5, color: 0xff00ff, name: 'Glitch-Sister-Beta' }
    ];

    sisterData.forEach((data, idx) => {
      const sisterGroup = new THREE.Group();
      const geo = getGeo(0.25);
      const sisterMat = new THREE.MeshBasicMaterial({
        color: data.color,
        transparent: true,
        opacity: 0.9
      });

      // Sister body (3x3 pattern)
      for (let r = 0; r < 3; r++) {
        for (let c = 0; c < 3; c++) {
          const cube = new THREE.Mesh(geo, sisterMat.clone());
          cube.position.set(c * 0.25, r * 0.25, 0);
          cube.userData.sisterIndex = idx;
          sisterGroup.add(cube);
        }
      }

      // Core (weak point, only vulnerable when active)
      const coreGeo = getGeo(0.18);
      const coreMat = new THREE.MeshBasicMaterial({
        color: 0xffffff,
        transparent: true,
        opacity: 0.95
      });
      const core = new THREE.Mesh(coreGeo, coreMat);
      core.position.set(0.375, 0.375, 0.2);
      core.userData.isWeakPoint = true;
      core.userData.isSisterCore = true;
      core.userData.sisterIndex = idx;
      sisterGroup.add(core);
      this.weakPoints.push(core);

      sisterGroup.userData.sisterIndex = idx;
      sisterGroup.userData.sisterData = data;

      this.sisters.push({
        group: sisterGroup,
        data: data,
        positionOffset: new THREE.Vector3(data.xOffset, 0, 0)
      });

      this.mesh.add(sisterGroup);
    });

    // Initial vulnerability
    this.updateVulnerability();
  }

  updateBehavior(dt, now, playerPos) {
    const dirToPlayer = playerPos.clone().sub(this.mesh.position).normalize();

    // Vulnerability swap
    this.vulnerabilitySwapTimer -= dt;
    if (this.vulnerabilitySwapTimer <= 0) {
      this.vulnerabilitySwapTimer = this.vulnerabilitySwapRate / this.phase;
      this.swapVulnerability();
    }

    // Glitch effect
    this.glitchTimer += dt;
    if (this.glitchTimer > 0.1) {
      this.glitchTimer = 0;
      this.applyGlitchEffect();
    }

    // Animate sisters
    this.sisters.forEach((sister, idx) => {
      const isActive = idx === this.activeSisterIndex;

      // Orbit around center
      const orbitSpeed = 0.5 + this.phase * 0.2;
      const orbitAngle = now * orbitSpeed * (idx === 0 ? 1 : -1);
      const orbitRadius = 1.5 + Math.sin(now * 0.001) * 0.3;

      sister.group.position.set(
        Math.cos(orbitAngle) * orbitRadius,
        Math.sin(now * 0.002 + idx) * 0.5,
        Math.sin(orbitAngle) * orbitRadius
      );

      // Sister rotation
      sister.group.rotation.y += dt * (1 + this.phase * 0.3);

      // Visual feedback for vulnerability
      sister.group.traverse(c => {
        if (c.userData.isSisterCore) {
          c.material.opacity = isActive ? 0.95 : 0.3;
          c.material.color.setHex(isActive ? 0xffffff : sister.data.color);
        }
      });
    });

    // Projectile fire from active sister
    this.beamTimer = (this.beamTimer || 0) - dt;
    if (this.beamTimer <= 0) {
      this.beamTimer = 1.5 / this.phase;
      this.fireFromActiveSister(playerPos);
    }

    // Slow movement
    this.mesh.position.addScaledVector(dirToPlayer, 0.25 * dt);

    // Keep distance
    const dist = this.mesh.position.distanceTo(playerPos);
    if (dist < 7) {
      this.mesh.position.addScaledVector(dirToPlayer.clone().negate(), 0.5 * dt);
    } else if (dist > 14) {
      this.mesh.position.addScaledVector(dirToPlayer, 0.2 * dt);
    }

    this.mesh.lookAt(_look.copy(playerPos));
  }

  swapVulnerability() {
    // Telegraph swap
    if (this.telegraphing) {
      this.showTelegraph('teleport', 0.4, 0x00ffff);
    }

    this.activeSisterIndex = (this.activeSisterIndex + 1) % 2;
    this.updateVulnerability();
  }

  updateVulnerability() {
    this.sisters.forEach((sister, idx) => {
      sister.group.userData.isVulnerable = (idx === this.activeSisterIndex);
    });
  }

  applyGlitchEffect() {
    // Random position jitter
    this.sisters.forEach((sister, idx) => {
      sister.group.position.x += (Math.random() - 0.5) * 0.05;
      sister.group.position.y += (Math.random() - 0.5) * 0.05;
    });
  }

  fireFromActiveSister(playerPos) {
    const activeSister = this.sisters[this.activeSisterIndex];
    const sisterPos = activeSister.group.getWorldPosition(new THREE.Vector3());

    if (this.telegraphing) {
      this.showTelegraph('projectile', 0.3, 0x00ffff, sisterPos);
    }

    setTimeout(() => {
      if (typeof spawnBossProjectile === 'function') {
        spawnBossProjectile(sisterPos, playerPos);
      }
    }, 300);
  }

  takeDamage(amount, hitInfo = {}) {
    // Check if hitting vulnerable sister
    if (hitInfo.sisterIndex !== undefined && hitInfo.sisterIndex !== this.activeSisterIndex) {
      // Hitting invulnerable sister - minimal damage
      return super.takeDamage(amount * 0.1, hitInfo);
    }

    return super.takeDamage(amount, hitInfo);
  }

  onPhaseChange(newPhase) {
    super.onPhaseChange(newPhase);
    // Phase 2+: faster vulnerability swap
    if (newPhase >= 2) {
      this.vulnerabilitySwapRate = 3.0;
    }
    // Phase 3+: even faster
    if (newPhase >= 3) {
      this.vulnerabilitySwapRate = 2.0;
    }
  }
}

// ── NEON MINOTAUR BOSS ─────────────────────────────────────
class MinotaurBoss extends Boss {
  constructor(def, levelConfig, sceneRef, telegraphing) {
    super(def, levelConfig, sceneRef, telegraphing);

    // Minotaur-specific state
    this.hornShards = [];
    this.chargeTimer = 0;
    this.chargeDuration = def.chargeDuration || 2.5;
    this.isCharging = false;
    this.chargeDirection = null;
    this.slamTimer = 0;
    this.slamRate = def.slamRate || 5.0;
    this.shardTimer = 0;
    this.shardRate = def.shardRate || 0.6;

    // Create horns
    this.createHorns();
  }

  createHorns() {
    const hornPositions = [
      { x: -0.3, y: 0.8, z: 0.4 },
      { x: 0.3, y: 0.8, z: 0.4 }
    ];

    hornPositions.forEach((pos, idx) => {
      const hornGroup = new THREE.Group();
      const geo = getGeo(0.15);
      const hornMat = new THREE.MeshBasicMaterial({
        color: 0xff0088,
        transparent: true,
        opacity: 0.9
      });

      // Horn (tapered up)
      for (let i = 0; i < 4; i++) {
        const cube = new THREE.Mesh(geo, hornMat.clone());
        const size = 0.2 + i * 0.05;
        cube.position.set(pos.x, pos.y + i * 0.12, pos.z + i * 0.08);
        hornGroup.add(cube);
      }

      hornGroup.userData.isHorn = true;
      hornGroup.userData.hornIndex = idx;
      this.mesh.add(hornGroup);
      this.hornShards.push(hornGroup);
    });
  }

  updateBehavior(dt, now, playerPos) {
    const dirToPlayer = playerPos.clone().sub(this.mesh.position).normalize();

    if (this.isCharging) {
      // Charging - move fast in charge direction
      this.chargeTimer -= dt;
      if (this.chargeTimer <= 0) {
        this.isCharging = false;

        // Ground slam at end of charge
        this.groundSlam(playerPos);
      } else {
        this.mesh.position.addScaledVector(this.chargeDirection, (8 + this.phase * 2) * dt);
      }
    } else {
      // Normal behavior
      this.chargeTimer -= dt;
      if (this.chargeTimer <= 0) {
        this.chargeTimer = this.chargeDuration / this.phase;
        this.startCharge(playerPos);
      }

      // Horn shards
      this.shardTimer -= dt;
      if (this.shardTimer <= 0) {
        this.shardTimer = this.shardRate / this.phase;
        this.fireHornShards(playerPos);
      }

      // Ground slam
      this.slamTimer -= dt;
      if (this.slamTimer <= 0) {
        this.slamTimer = this.slamRate / this.phase;
        this.groundSlam(playerPos);
      }

      // Slow movement toward player
      const speed = 0.6 + this.phase * 0.15;
      this.mesh.position.addScaledVector(dirToPlayer, speed * dt);

      // Keep distance
      const dist = this.mesh.position.distanceTo(playerPos);
      if (dist < 5) {
        this.mesh.position.addScaledVector(dirToPlayer.clone().negate(), 0.8 * dt);
      } else if (dist > 14) {
        this.mesh.position.addScaledVector(dirToPlayer, 0.3 * dt);
      }
    }

    this.mesh.lookAt(_look.copy(playerPos));
  }

  startCharge(playerPos) {
    this.isCharging = true;
    this.chargeDirection = playerPos.clone().sub(this.mesh.position).normalize();

    // Telegraph charge
    if (this.telegraphing) {
      this.showTelegraph('charge', 0.8, 0xff0088);
    }

    if (typeof window !== 'undefined' && window.playBossAttackSound) {
      window.playBossAttackSound('charge', 0.8);
    }
  }

  groundSlam(playerPos) {
    // Telegraph slam
    if (this.telegraphing) {
      this.showTelegraph('melee', 0.6, 0xff0088);
    }

    // Fire shockwave projectiles in all directions
    const shardCount = 8 + this.phase * 2;
    for (let i = 0; i < shardCount; i++) {
      const angle = (i / shardCount) * Math.PI * 2;
      const targetPos = new THREE.Vector3(
        this.mesh.position.x + Math.cos(angle) * 10,
        this.mesh.position.y,
        this.mesh.position.z + Math.sin(angle) * 10
      );

      setTimeout(() => {
        if (typeof spawnBossProjectile === 'function') {
          spawnBossProjectile(this.mesh.position.clone(), targetPos);
        }
      }, i * 50);
    }

    if (typeof window !== 'undefined' && window.playBossExplosion) {
      window.playBossExplosion();
    }
  }

  fireHornShards(playerPos) {
    // Fire shards from both horns
    this.hornShards.forEach((horn, idx) => {
      const hornPos = horn.getWorldPosition(new THREE.Vector3());

      if (this.telegraphing) {
        this.showTelegraph('projectile', 0.2, 0xff0088, hornPos);
      }

      setTimeout(() => {
        if (typeof spawnBossProjectile === 'function') {
          // Add some spread
          const spread = (idx === 0 ? -1 : 1) * 0.3;
          const target = playerPos.clone();
          target.x += spread;
          spawnBossProjectile(hornPos, target);
        }
      }, 200);
    });
  }

  takeDamage(amount, hitInfo = {}) {
    let damageTaken = amount;

    // Minotaur takes reduced damage while charging
    if (this.isCharging) {
      damageTaken = amount * 0.4;
    }

    return super.takeDamage(damageTaken, hitInfo);
  }

  onPhaseChange(newPhase) {
    super.onPhaseChange(newPhase);
    // Phase 2+: faster charge, more shards
    if (newPhase >= 2) {
      this.chargeDuration = 2.0;
      this.shardRate = 0.5;
      this.slamRate = 4.0;
    }
    // Phase 3+: even faster
    if (newPhase >= 3) {
      this.chargeDuration = 1.5;
      this.shardRate = 0.4;
      this.slamRate = 3.0;
    }
  }
}

// ── BOSS DEFINITIONS ─────────────────────────────────────────
const BOSS_SKULL_PATTERN = [
  [0, 1, 1, 1, 0],
  [1, 1, 1, 1, 1],
  [1, 1, 0, 1, 1],
  [1, 1, 1, 1, 1],
  [0, 1, 0, 1, 0],
];

const BOSS_DEFS = {
  // Teleporting boss (Level 5)
  // Level 5 bosses (Tier 1 - INTRO)
  scrap_golem: {
    name: 'Scrap Golem',
    pattern: [
      [0, 1, 1, 0],
      [1, 1, 1, 1],
      [1, 1, 1, 1],
      [0, 1, 1, 0],
    ],
    voxelSize: 0.4,
    baseHp: 1100,
    phases: 3,
    color: 0x886644,
    scoreValue: 100,
    behavior: 'golem',
    hitboxRadius: 0.65,
    slamRate: 3.0,
    minionRate: 6.0,
    contactDamage: 1,
    contactCooldown: 1200,
    weakPoints: true
  },

  holo_phantom: {
    name: 'Holo Phantom',
    pattern: [
      [0, 1, 0],
      [1, 1, 1],
      [1, 1, 1],
      [0, 1, 0],
    ],
    voxelSize: 0.35,
    baseHp: 750,
    phases: 3,
    color: 0x00ffff,
    scoreValue: 100,
    behavior: 'phantom',
    hitboxRadius: 0.55,
    decoyRate: 4.0,
    teleportRate: 2.5,
    projectileRate: 2.4,
    weakPoints: false
  },

  pulse_emitter: {
    name: 'Pulse Emitter',
    pattern: [
      [1, 1, 1],
      [1, 0, 1],
      [1, 1, 1],
    ],
    voxelSize: 0.38,
    baseHp: 900,
    phases: 3,
    color: 0xff0088,
    scoreValue: 100,
    behavior: 'emitter',
    hitboxRadius: 0.6,
    pulseRate: 2.0,
    shieldDuration: 3.0,
    projectileRate: 2.8,
    contactDamage: 1,
    contactCooldown: 1000,
    weakPoints: true
  },

  rust_serpent: {
    name: 'Rust Serpent',
    pattern: [
      [1, 0, 0, 0, 0],
      [1, 1, 0, 0, 0],
      [0, 1, 1, 0, 0],
      [0, 0, 1, 1, 0],
      [0, 0, 0, 1, 1],
    ],
    voxelSize: 0.32,
    baseHp: 800,
    phases: 3,
    color: 0xcc4400,
    scoreValue: 100,
    behavior: 'serpent',
    hitboxRadius: 0.9,
    slitherSpeed: 1.8,
    toxicRate: 1.5,
    projectileRate: 2.2,
    weakPoints: true
  },

  static_wisp: {
    name: 'Static Wisp',
    pattern: [
      [0, 0, 1, 0, 0],
      [0, 1, 1, 1, 0],
      [1, 1, 0, 1, 1],
      [0, 1, 1, 1, 0],
      [0, 0, 1, 0, 0],
    ],
    voxelSize: 0.3,
    baseHp: 700,
    phases: 3,
    color: 0xffff00,
    scoreValue: 100,
    behavior: 'wisp',
    hitboxRadius: 0.55,
    electricRate: 1.2,
    teleportRate: 3.0,
    projectileRate: 2.0,
    weakPoints: false
  },

  // ── SKULL BOSS (Level 5) ─────────────────────────────────────
  skull_boss: {
    name: 'Skull Boss',
    // Custom voxel skull - not using pattern, built in class
    pattern: [[1]], // Placeholder, actual skull built in SkullBoss class
    voxelSize: 0.25,
    baseHp: 1200,
    phases: 2, // Phase 1: hands, Phase 2: head vulnerable
    color: 0xffffff, // Starts white, darkens to red
    scoreValue: 100,
    behavior: 'skull',
    hitboxRadius: 1.2,
    handHp: 150, // HP per hand
    handShootRate: 1.5, // Base shoot rate per hand
    eyeShootRate: 0.8, // Phase 2 eye shoot rate
    moveSpeed: 1.5, // Phase 2 movement speed
    weakPoints: false // Custom weak points (hands first, then head)
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

// ── BOSS POOL MANAGEMENT ─────────────────────────────────────
const BOSS_POOLS = {
  1: ['skull_boss'], // Tier 1 (Level 5) - Skull Boss only
  2: ['hunter_breakenridge', 'dj_drax', 'captain_kestrel', 'dr_aster', 'sunflare_seraph'], // Tier 2 (Level 10) - harder bosses
  3: ['theodore_breakenridge', 'commander_halcyon', 'madame_coda', 'twin_glitch', 'neon_minotaur'], // Tier 3 (Level 15) - TOUGH bosses
  4: ['walter_breakenridge', 'kernel_monolith', 'synth_kraken', 'afterimage_seraphim', 'sun_eater_train'], // Tier 4 (Level 20) - final bosses
};

// ── GLOBAL BOSS STATE ─────────────────────────────────────────
let activeBoss = null;
let telegraphingSystem = null;

// ── PUBLIC API ─────────────────────────────────────────────

export function getTelegraphingSystem() {
  return telegraphingSystem;
}

export function setCameraRef(camera) {
  if (telegraphingSystem) {
    telegraphingSystem.camera = camera;
  }
}

/**
 * Spawn a boss of the given type
 */
export function spawnBoss(bossId, levelConfig, camera) {
  const def = BOSS_DEFS[bossId];
  if (!def || !sceneRef) return null;

  // Create appropriate boss class based on behavior
  let boss;
  switch (def.behavior) {
    case 'dodger':
      boss = new DodgerBoss(def, levelConfig, sceneRef, telegraphingSystem);
      break;
    // Level 5 bosses (Tier 1)
    case 'golem':
      boss = new ScrapGolemBoss(def, levelConfig, sceneRef, telegraphingSystem);
      break;
    case 'phantom':
      boss = new HoloPhantomBoss(def, levelConfig, sceneRef, telegraphingSystem);
      break;
    case 'emitter':
      boss = new PulseEmitterBoss(def, levelConfig, sceneRef, telegraphingSystem);
      break;
    case 'serpent':
      boss = new RustSerpentBoss(def, levelConfig, sceneRef, telegraphingSystem);
      break;
    case 'wisp':
      boss = new StaticWispBoss(def, levelConfig, sceneRef, telegraphingSystem);
      break;
    case 'skull':
      boss = new SkullBoss(def, levelConfig, sceneRef, telegraphingSystem);
      break;
    // Level 10 bosses
    case 'hunter':
      boss = new HunterBoss(def, levelConfig, sceneRef, telegraphingSystem);
      break;
    case 'dj':
      boss = new DJBoss(def, levelConfig, sceneRef, telegraphingSystem);
      break;
    case 'starfighter':
      boss = new StarfighterBoss(def, levelConfig, sceneRef, telegraphingSystem);
      break;
    case 'scientist':
      boss = new ScientistBoss(def, levelConfig, sceneRef, telegraphingSystem);
      break;
    case 'monk':
      boss = new MonkBoss(def, levelConfig, sceneRef, telegraphingSystem);
      break;
    // Level 15 bosses
    case 'outlaw':
      boss = new OutlawBoss(def, levelConfig, sceneRef, telegraphingSystem);
      break;
    case 'commander':
      boss = new CommanderBoss(def, levelConfig, sceneRef, telegraphingSystem);
      break;
    case 'diva':
      boss = new DivaBoss(def, levelConfig, sceneRef, telegraphingSystem);
      break;
    case 'twin_glitch':
      boss = new TwinGlitchBoss(def, levelConfig, sceneRef, telegraphingSystem);
      break;
    case 'minotaur':
      boss = new MinotaurBoss(def, levelConfig, sceneRef, telegraphingSystem);
      break;
    // Level 20 bosses
    case 'walter':
      boss = new WalterBoss(def, levelConfig, sceneRef, telegraphingSystem);
      break;
    case 'kernel':
      boss = new KernelBoss(def, levelConfig, sceneRef, telegraphingSystem);
      break;
    case 'kraken':
      boss = new KrakenBoss(def, levelConfig, sceneRef, telegraphingSystem);
      break;
    case 'seraphim':
      boss = new SeraphimBoss(def, levelConfig, sceneRef, telegraphingSystem);
      break;
    case 'train':
      boss = new TrainBoss(def, levelConfig, sceneRef, telegraphingSystem);
      break;
    default:
      boss = new Boss(def, levelConfig, sceneRef, telegraphingSystem);
      break;
  }

  // Show boss health bar
  if (typeof showBossHealthBar === 'function') {
    showBossHealthBar(boss.hp, boss.maxHp, boss.phases);
  }

  activeBoss = boss;
  return boss;
}

export function getBoss() {
  return activeBoss;
}

export function hitBoss(damage, hitInfo = {}) {
  if (!activeBoss) return { killed: false, shieldReflected: false };

  const result = activeBoss.takeDamage(damage, hitInfo);

  if (result.killed) {
    // Let main.js own the cinematic timing and cleanup.
    // If we destroy the boss here, the cinematic loses the live boss context
    // and the level 5 transition can skip straight past the kill sequence.
    if (typeof hideBossHealthBar === 'function') {
      hideBossHealthBar();
    }
  } else {
    // Update health bar
    if (typeof updateBossHealthBar === 'function') {
      updateBossHealthBar(activeBoss.hp, activeBoss.maxHp, activeBoss.phases);
    }
  }

  return result;
}

export function updateBoss(dt, now, playerPos) {
  if (!activeBoss) return;
  activeBoss.update(dt, now, playerPos);
  // Update telegraphing effects (visual warnings)
  if (telegraphingSystem) {
    telegraphingSystem.update(dt, now);
  }
}

export function clearBoss() {
  clearBossProjectiles();

  if (activeBoss) {
    activeBoss.destroy();
    activeBoss = null;

    if (typeof hideBossHealthBar === 'function') {
      hideBossHealthBar();
    }
  }
}

export function clearAllTelegraphs() {
  if (telegraphingSystem) {
    telegraphingSystem.clearAll();
  }
}

// ── BOSS DEBRIS PHYSICS (from commit 2abb1b5) ───────────────────────────
export function spawnBossDebris(boss) {
  if (!boss || !boss.mesh) return;

  const voxels = boss.mesh.children.filter(c => c.userData.isBossBody);
  const bossPos = boss.mesh.position.clone();
  const bossColor = boss.def.color;

  // Limit debris count for performance
  const maxVoxels = Math.min(voxels.length, MAX_DEBRIS);
  const step = Math.max(1, Math.floor(voxels.length / maxVoxels));

  for (let i = 0; i < voxels.length; i += step) {
    const voxel = voxels[i];
    if (!voxel.isMesh) continue;

    // Create debris piece
    const geo = voxel.geometry.clone();
    const mat = new THREE.MeshBasicMaterial({
      color: voxel.material.color || bossColor,
      transparent: true,
      opacity: 0.9,
    });

    const debris = new THREE.Mesh(geo, mat);

    // World position of voxel
    const worldPos = new THREE.Vector3();
    voxel.getWorldPosition(worldPos);
    debris.position.copy(worldPos);

    // Random initial rotation
    debris.rotation.set(
      Math.random() * Math.PI * 2,
      Math.random() * Math.PI * 2,
      Math.random() * Math.PI * 2
    );

    // Physics properties
    debris.userData.velocity = new THREE.Vector3(
      (Math.random() - 0.5) * 4,  // Random horizontal velocity
      2 + Math.random() * 3,      // Upward velocity
      (Math.random() - 0.5) * 4
    );
    debris.userData.angularVel = new THREE.Vector3(
      (Math.random() - 0.5) * 8,
      (Math.random() - 0.5) * 8,
      (Math.random() - 0.5) * 8
    );
    debris.userData.bounces = 0;
    debris.userData.maxBounces = 2;
    debris.userData.lifetime = 3.0;  // 3 seconds before fade
    debris.userData.age = 0;
    debris.userData.onFloor = false;

    sceneRef.add(debris);
    bossDebris.push(debris);
  }

  console.log(`[boss] Spawned ${bossDebris.length} debris voxels`);
}

export function updateBossDebris(dt, now, biomeFloorY = 0.05) {
  const gravity = -9.8;
  const floorY = biomeFloorY;
  const bounceDamping = 0.5;
  const friction = 0.8;

  for (let i = bossDebris.length - 1; i >= 0; i--) {
    const debris = bossDebris[i];
    debris.userData.age += dt;

    // Age out old debris
    if (debris.userData.age > debris.userData.lifetime) {
      sceneRef.remove(debris);
      debris.geometry.dispose();
      debris.material.dispose();
      bossDebris.splice(i, 1);
      continue;
    }

    // Fade out in last second
    const fadeStart = debris.userData.lifetime - 1.0;
    if (debris.userData.age > fadeStart) {
      debris.material.opacity = 0.9 * (1 - (debris.userData.age - fadeStart));
    }

    // Skip physics if on floor and settled
    if (debris.userData.onFloor && debris.userData.bounces >= debris.userData.maxBounces) {
      // Just fade, no more physics
      continue;
    }

    // Apply gravity
    debris.userData.velocity.y += gravity * dt;

    // Update position
    debris.position.x += debris.userData.velocity.x * dt;
    debris.position.y += debris.userData.velocity.y * dt;
    debris.position.z += debris.userData.velocity.z * dt;

    // Update rotation
    debris.rotation.x += debris.userData.angularVel.x * dt;
    debris.rotation.y += debris.userData.angularVel.y * dt;
    debris.rotation.z += debris.userData.angularVel.z * dt;

    // Floor collision
    if (debris.position.y < floorY) {
      debris.position.y = floorY;
      debris.userData.velocity.y = -debris.userData.velocity.y * bounceDamping;
      debris.userData.velocity.x *= friction;
      debris.userData.velocity.z *= friction;
      debris.userData.angularVel.multiplyScalar(0.5);
      debris.userData.bounces++;

      // Mark as on floor after max bounces
      if (debris.userData.bounces >= debris.userData.maxBounces) {
        debris.userData.onFloor = true;
        debris.userData.velocity.set(0, 0, 0);
        debris.userData.angularVel.set(0, 0, 0);
      }
    }
  }
}

export function clearBossDebris() {
  for (const debris of bossDebris) {
    sceneRef.remove(debris);
    debris.geometry.dispose();
    debris.material.dispose();
  }
  bossDebris.length = 0;
}

// ── TELEPORTING BOSS SPECIFIC (for compatibility) ───────────
const bossMinions = [];
export function spawnBossMinion(fromPos, playerPos, type = 'basic') {
  const group = new THREE.Group();
  const def = ENEMY_DEFS[type] || ENEMY_DEFS.basic;
  const geo = getGeo(def.voxelSize);
  const mat = new THREE.MeshBasicMaterial({ color: def.color, transparent: true, depthWrite: false, opacity: 0.8 });

  for (let r = 0; r < 2; r++) {
    for (let c = 0; c < 2; c++) {
      const cube = new THREE.Mesh(geo, mat.clone());
      cube.position.set(c * def.voxelSize, r * def.voxelSize, 0);
      group.add(cube);
    }
  }

  group.position.copy(fromPos);
  group.userData.isBossMinion = true;
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
    clampPositionToFrontArc(m.mesh.position, playerPos, 2.0, 18, 120);
  }
}

// ── PROJECTILES (for compatibility) ───────────────────────────
const bossProjectiles = [];

function disposeBossProjectileMesh(mesh) {
  if (!mesh) return;
  sceneRef.remove(mesh);
  mesh.traverse(c => {
    if (c.geometry) c.geometry.dispose();
    if (c.material) c.material.dispose();
  });
}

export function clearBossProjectiles() {
  for (let i = bossProjectiles.length - 1; i >= 0; i--) {
    disposeBossProjectileMesh(bossProjectiles[i].mesh);
  }
  bossProjectiles.length = 0;
}

export function spawnBossProjectile(fromPos, targetPos) {
  // Play sound when boss fires projectile
  playEnemyProjectileSound();

  const projGroup = new THREE.Group();

  const coreGeo = getGeo(0.065);
  const coreMat = new THREE.MeshBasicMaterial({ color: 0xff3355 });
  const core = new THREE.Mesh(coreGeo, coreMat);
  projGroup.add(core);

  const glowGeo = getGeo(0.14);
  const glowMat = new THREE.MeshBasicMaterial({
    color: 0xff88aa,
    transparent: true,
    opacity: 0.7,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  const glow = new THREE.Mesh(glowGeo, glowMat);
  projGroup.add(glow);

  projGroup.position.copy(fromPos);
  projGroup.userData.isBossProjectile = true;
  projGroup.userData.glowPhase = Math.random() * Math.PI * 2;

  const dir = new THREE.Vector3().copy(targetPos).sub(fromPos).normalize();
  const speed = 5.2;

  sceneRef.add(projGroup);
  bossProjectiles.push({
    mesh: projGroup,
    velocity: dir.multiplyScalar(speed),
    createdAt: performance.now(),
    lifetime: 3600,
    homingStrength: 8.0,
    wigglePhase: Math.random() * Math.PI * 2,
    damage: 1,
    explosionDamage: 1,
    explosionRadius: 0.3,
    hitRadius: 0.45,
    wiggleAmplitude: 0.008,
  });
}

export function updateBossProjectiles(dt, now, playerPos) {
  for (let i = bossProjectiles.length - 1; i >= 0; i--) {
    const proj = bossProjectiles[i];
    const age = now - proj.createdAt;

    if (age > proj.lifetime) {
      if (typeof window !== 'undefined' && window.createExplosionAt) {
        window.createExplosionAt(proj.mesh.position.clone(), proj.explosionRadius || 0.3, proj.explosionDamage || 0);
      }
      disposeBossProjectileMesh(proj.mesh);
      bossProjectiles.splice(i, 1);
      continue;
    }

    const slowFactor = getStasisSlowFactor(proj.mesh.position);
    const adjustedDt = dt * slowFactor;
    const speed = proj.velocity.length();
    const toPlayer = new THREE.Vector3().subVectors(playerPos, proj.mesh.position).normalize();
    const desiredVelocity = toPlayer.multiplyScalar(speed);
    proj.velocity.lerp(desiredVelocity, Math.min(1, (proj.homingStrength || 2.5) * adjustedDt));
    if (proj.velocity.lengthSq() > 0.0001) {
      proj.velocity.setLength(speed);
    }

    proj.wigglePhase = (proj.wigglePhase || 0) + adjustedDt * 7.0;
    const forward = proj.velocity.clone().normalize();
    const side = new THREE.Vector3(-forward.z, 0, forward.x);
    if (side.lengthSq() < 0.0001) side.set(1, 0, 0);
    side.normalize();
    const wiggleOffset = Math.sin(proj.wigglePhase) * (proj.wiggleAmplitude || 0.008);
    const pulse = 0.75 + Math.sin(age * 0.015 + (proj.mesh.userData.glowPhase || 0)) * 0.25;

    const prevPos = proj.mesh.position.clone();
    proj.mesh.position.addScaledVector(proj.velocity, adjustedDt);
    proj.mesh.position.addScaledVector(side, wiggleOffset);
    proj.mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, -1), forward);
    proj.mesh.children.forEach((child, index) => {
      if (!child.material) return;
      if (index === 0) {
        child.scale.setScalar(0.9 + pulse * 0.12);
      } else {
        child.scale.setScalar(0.95 + pulse * 0.25);
        child.material.opacity = 0.35 + pulse * 0.35;
      }
    });

    if (proj.mesh.position.distanceTo(playerPos) < (proj.hitRadius || 0.45)) {
      proj.hitPlayer = true;
      if (typeof window !== 'undefined' && window.createExplosionAt) {
        window.createExplosionAt(proj.mesh.position.clone(), proj.explosionRadius || 0.3, proj.explosionDamage || 0);
      }
    }
  }
}

export function getBossProjectiles() {
  return bossProjectiles;
}

// ── TELEGRAPHING UPDATE (for main.js) ────────────────────────
export function updateTelegraphing(dt, now) {
  if (telegraphingSystem) {
    telegraphingSystem.update(dt, now);
  }
}

// ── GET ENEMY MESHES (for raycasting) ─────────────────────────
export function getEnemyMeshes(includeBoss = false) {
  if (_enemyMeshesDirty) {
    rebuildMeshCache();
  }
  if (includeBoss && activeBoss) {
    const list = [..._cachedEnemyMeshes, activeBoss.mesh];
    return list;
  }
  return _cachedEnemyMeshes;
}

export function getEnemyByMesh(mesh) {
  let obj = mesh;
  while (obj) {
    // Check for regular enemy first (check userData.isEnemy flag)
    if (obj.userData.isEnemy) {
      const idx = activeEnemies.findIndex(e => e.mesh === obj);
      if (idx >= 0) {
        return { index: idx, enemy: activeEnemies[idx] };
      }
    }

    // Check for SkullHand hit
    if (obj.userData.isSkullHand || obj.userData.isHandHitbox) {
      return { 
        boss: activeBoss, 
        isBody: true, 
        handIndex: obj.userData.handIndex 
      };
    }

    // Then check for boss
    if (obj.userData.isBoss || obj.userData.isBossHitbox) {
      return { boss: activeBoss, isBody: true };
    }

    obj = obj.parent;
  }
  return null;
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
export function getSpawnPosition(airSpawns, verticalAngle = 0, distanceRange = null) {
  const angle = (Math.random() - 0.5) * (100 * Math.PI / 180);
  const minDist = distanceRange?.min ?? 14.4;
  const maxDist = distanceRange?.max ?? 20.0;
  const distance = minDist + Math.random() * (maxDist - minDist);

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

