// ============================================================
//  ENEMY SYSTEM
//  Voxel enemies: spawning, movement, damage, death explosions.
// ============================================================

import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { getStasisSlowFactor } from './stasis.js';
import { playTingSound, playEnemyProjectileSound, playProjectileWarningSound, playBossProjectileFiredSound, playBossProjectileAlertSound, playPhaseWraithCharge as playMortarCharge, playSkullPhaseSound, playSkullHandGrowlSound, playSkullDeathKnell, playSkullLaughSound } from './audio.js';

// [Visual Overhaul] Import VFX system for voxel explosions
let spawnVoxelExplosion = null;

// PERFORMANCE: Debug flag to disable console.log in hot paths on Quest
const DEBUG = false;
const _log = DEBUG ? console.log.bind(console) : () => {};

// ============================================================
// ENEMY SPAWN WARP-IN EFFECT
// Animate scale 0→1 with easeOutBack + emissive flash on spawn.
// Toggle with ENABLE_SPAWN_WARP.
// ============================================================
const ENABLE_SPAWN_WARP = true;
const SPAWN_WARP_DURATION = 200; // ms total scale-up
const SPAWN_WARP_FLASH_PEAK = 50; // ms when emissive peaks

function easeOutBack(t) {
  const c1 = 1.70158;
  const c3 = c1 + 1;
  return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
}

function applySpawnWarp(enemy) {
  enemy.mesh.scale.setScalar(0);
  enemy._warpStartTime = performance.now();
  enemy._warpActive = true;
}

function updateSpawnWarp(enemy, now) {
  if (!enemy._warpActive) return;
  const elapsed = now - enemy._warpStartTime;
  if (elapsed >= SPAWN_WARP_DURATION) {
    enemy.mesh.scale.setScalar(1);
    enemy._warpActive = false;
    // Reset emissive on cached materials
    const mats = enemy._cachedMaterials;
    if (mats) {
      for (let i = 0; i < mats.length; i++) {
        mats[i].opacity = mats[i].userData && mats[i].userData._warpOrigOpacity != null
          ? mats[i].userData._warpOrigOpacity : 0.7;
      }
    }
    return;
  }
  const t = elapsed / SPAWN_WARP_DURATION;
  const s = easeOutBack(t);
  enemy.mesh.scale.setScalar(s);

  // Emissive flash: peak at SPAWN_WARP_FLASH_PEAK, fade to 0 by end
  const mats = enemy._cachedMaterials;
  if (mats) {
    let flashIntensity;
    if (elapsed < SPAWN_WARP_FLASH_PEAK) {
      flashIntensity = elapsed / SPAWN_WARP_FLASH_PEAK;
    } else {
      flashIntensity = 1 - (elapsed - SPAWN_WARP_FLASH_PEAK) / (SPAWN_WARP_DURATION - SPAWN_WARP_FLASH_PEAK);
    }
    for (let i = 0; i < mats.length; i++) {
      const m = mats[i];
      if (m.userData._warpOrigOpacity == null) {
        m.userData._warpOrigOpacity = m.opacity;
      }
      // Boost opacity during flash (brighter)
      m.opacity = m.userData._warpOrigOpacity + flashIntensity * (1 - m.userData._warpOrigOpacity);
    }
  }
}

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

// Pre-allocated scratch vectors (avoid per-frame GC in update methods)
const _scratch = new THREE.Vector3();
const _scratch2 = new THREE.Vector3();
const _scratch3 = new THREE.Vector3();

// Pre-allocated scratch colors (avoid per-frame GC in enemy update hot paths)
const _emissiveSilver = new THREE.Color(0xd0d0d0);
const _emissiveGreen = new THREE.Color(0x00ffaa);
const _emissivePurple = new THREE.Color(0x220033);
const _emissivePink = new THREE.Color(0xff66cc);
const _emissiveViolet = new THREE.Color(0x8844ff);
const _emissiveRed = new THREE.Color(0xff0000);
const _emissiveBlack = new THREE.Color(0x000000);
const _emissiveWhite = new THREE.Color(0xffffff);
const _emissiveAmber = new THREE.Color(0xffaa00);
const _scratchColor = new THREE.Color();
const _scratchMat4 = new THREE.Matrix4();
const _scratchMat4b = new THREE.Matrix4();
const _scratchScale = new THREE.Vector3();
const _explosionSpriteVel = new THREE.Vector3();

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
  mortar: [
    '.1.',
    '1.1',
    '.1.',
    '.1.',
  ],
};

function parsePattern(strings) {
  return strings.map(row => row.split('').map(c => (c === '1' ? 1 : 0)));
}

function updateJellyHitbox(enemy) {
  if (!enemy.hitbox || !enemy.voxelSize) return;
  const height = Math.max(1, enemy.jellyHeight) * enemy.voxelSize * 1.05;
  if (enemy.hitbox.geometry) enemy.hitbox.geometry.dispose();
  enemy.hitbox.geometry = getHitboxGeo(enemy.hitboxRadius * 2, height, enemy.hitboxRadius * 2);
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
  spiral_swimmer: { pattern: [[1]], voxelSize: 0.18, baseHp: 8, baseSpeed: 2.2, color: 0x00ffcc, depth: 1, scoreValue: 8, hitboxRadius: 0.5, telegraphType: 'twitch', isTrain: true, trainLength: 10 },

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
  mortar: {
    pattern: parsePattern(PATTERNS.mortar),
    voxelSize: 0.24,
    baseHp: 30,
    baseSpeed: 0.6,
    color: 0xff0000,
    depth: 1,
    scoreValue: 28,
    hitboxRadius: 0.45,
    telegraphType: 'flash',
    isMortar: true,
    mortarTelegraphDuration: 2.0,
    mortarAttackCooldown: 4.0,
    mortarArcHeight: 2.0,
    mortarStrafeSpeed: 0.8,
    mortarPreferredDistMin: 8.0,
    mortarPreferredDistMax: 14.0,
  },
};

// ── Module state ───────────────────────────────────────────
let sceneRef = null;
const activeEnemies = [];
let nextEnemyId = 1;
const explosionParts = [];

// Enemy death physics bits
const enemyDebris = [];
const MAX_ENEMY_DEBRIS = 25;  // Cap for performance (reduced from 50)

// Boss death debris (physics-based from commit 2abb1b5)
const bossDebris = [];
const MAX_DEBRIS = 25;  // Cap for performance (reduced from 56)

// Player forward direction for front-arc constraints
const _playerForwardRef = new THREE.Vector3(0, 0, -1);
const _bossSpawnForwardRef = new THREE.Vector3(0, 0, -1);
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

export function setBossSpawnForward(forward) {
  if (!forward) {
    _bossSpawnForwardRef.set(0, 0, -1);
    return;
  }
  _bossSpawnForwardRef.copy(forward);
  _bossSpawnForwardRef.y = 0;
  if (_bossSpawnForwardRef.lengthSq() < 0.0001) {
    _bossSpawnForwardRef.set(0, 0, -1);
  } else {
    _bossSpawnForwardRef.normalize();
  }
}

function clampPositionToFrontArc(position, playerPos, minDist = 3, maxDist = 20, arcDeg = 120, forwardOverride = null) {
  _frontDir.copy(forwardOverride || _playerForwardRef);
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

// Shared hitbox geometry cache
const hitboxGeoCache = {};
function getHitboxGeo(w, h, d) {
  const key = `${w.toFixed(4)},${h.toFixed(4)},${d.toFixed(4)}`;
  if (!hitboxGeoCache[key]) {
    hitboxGeoCache[key] = new THREE.BoxGeometry(w, h, d);
  }
  return hitboxGeoCache[key];
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

// Clear all geometry caches (called on game restart to prevent GPU object leaks)
export function clearGeometryCaches() {
  for (const key of Object.keys(hitboxGeoCache)) {
    hitboxGeoCache[key].dispose();
    delete hitboxGeoCache[key];
  }
  for (const key of Object.keys(sharedGeos)) {
    sharedGeos[key].dispose();
    delete sharedGeos[key];
  }
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
    opacity: 0.7,
    depthWrite: false,
    fog: false,
  });

  const im = new THREE.InstancedMesh(basicGeo, basicMat, MAX_BASIC_INSTANCES);
  im.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  im.renderOrder = 10;
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

  if (window?.debugInstancing) console.log(`[basic-instance] Pool initialized: ${MAX_BASIC_INSTANCES} slots`);
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
    if (window?.debugInstancing) console.warn('[basic-instance] Pool exhausted! Falling back to individual mesh.');
    return null;
  }

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

  if (window?.debugInstancing) console.log('[basic-instance] All slots released (clearAllEnemies)');
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
    opacity: 0.7,
    depthWrite: false,
    fog: false,
  });

  const im = new THREE.InstancedMesh(fastGeo, fastMat, MAX_FAST_INSTANCES);
  im.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  im.renderOrder = 10;
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

  if (window?.debugInstancing) console.log(`[fast-instance] Pool initialized: ${MAX_FAST_INSTANCES} slots`);
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
    if (window?.debugInstancing) console.warn('[fast-instance] Pool exhausted! Falling back to individual mesh.');
    return null;
  }

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

  if (window?.debugInstancing) console.log('[fast-instance] All slots released (clearAllEnemies)');
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
    opacity: 0.7,
    depthWrite: false,
    fog: false,
  });

  const im = new THREE.InstancedMesh(tankGeo, tankMat, MAX_TANK_INSTANCES);
  im.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  im.renderOrder = 10;
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

  if (window?.debugInstancing) console.log(`[tank-instance] Pool initialized: ${MAX_TANK_INSTANCES} slots`);
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
    if (window?.debugInstancing) console.warn('[tank-instance] Pool exhausted! Falling back to individual mesh.');
    return null;
  }

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

  if (window?.debugInstancing) console.log('[tank-instance] All slots released (clearAllEnemies)');
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
    opacity: 0.7,
    depthWrite: false,
    fog: false,
  });

  const im = new THREE.InstancedMesh(swarmGeo, swarmMat, MAX_SWARM_INSTANCES);
  im.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  im.renderOrder = 10;
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

  if (window?.debugInstancing) console.log(`[swarm-instance] Pool initialized: ${MAX_SWARM_INSTANCES} slots`);
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
    if (window?.debugInstancing) console.warn('[swarm-instance] Pool exhausted! Falling back to individual mesh.');
    return null;
  }

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

  if (window?.debugInstancing) console.log('[swarm-instance] All slots released (clearAllEnemies)');
}

// ── Conductor enemy InstancedMesh pool ──────────────────────
// One InstancedMesh for all 'conductor' enemies = 1 draw call instead of N.
const MAX_CONDUCTOR_INSTANCES = 20;
const conductorInstancePool = {
  mesh: null,
  freeIndices: new Set(),
  initialized: false,
};
const _conductorDummyMatrix = new THREE.Matrix4().makeScale(0, 0, 0);
const _conductorColorTmp = new THREE.Color();

function initConductorInstancePool() {
  if (conductorInstancePool.initialized || !sceneRef) return;

  const def = ENEMY_DEFS.conductor;
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

  let conductorGeo;
  if (geometries.length > 0) {
    conductorGeo = mergeGeometries(geometries);
    geometries.forEach(g => g.dispose());
  }
  if (!conductorGeo) {
    console.warn('[conductor-instance] Failed to build merged geometry, falling back to box');
    conductorGeo = new THREE.BoxGeometry(def.voxelSize, def.voxelSize, def.voxelSize);
  }

  const conductorMat = new THREE.MeshBasicMaterial({
    transparent: true,
    opacity: 0.7,
    depthWrite: false,
    fog: false,
  });

  const im = new THREE.InstancedMesh(conductorGeo, conductorMat, MAX_CONDUCTOR_INSTANCES);
  im.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  im.renderOrder = 10;
  im.count = 0;
  im.frustumCulled = false;

  for (let i = 0; i < MAX_CONDUCTOR_INSTANCES; i++) {
    im.setMatrixAt(i, _conductorDummyMatrix);
  }
  im.instanceMatrix.needsUpdate = true;

  sceneRef.add(im);
  conductorInstancePool.mesh = im;
  conductorInstancePool.initialized = true;

  if (window?.debugInstancing) console.log(`[conductor-instance] Pool initialized: ${MAX_CONDUCTOR_INSTANCES} slots`);
}

function acquireConductorInstance() {
  if (!conductorInstancePool.initialized) return null;
  const pool = conductorInstancePool;

  let instanceId;
  if (pool.freeIndices.size > 0) {
    instanceId = pool.freeIndices.values().next().value;
    pool.freeIndices.delete(instanceId);
  } else if (pool.mesh.count < MAX_CONDUCTOR_INSTANCES) {
    instanceId = pool.mesh.count;
    pool.mesh.count = instanceId + 1;
  } else {
    if (window?.debugInstancing) console.warn('[conductor-instance] Pool exhausted! Falling back to individual mesh.');
    return null;
  }

  return { instanceId, pool };
}

function releaseConductorInstance(instanceId) {
  if (!conductorInstancePool.initialized) return;
  const pool = conductorInstancePool;

  pool.mesh.setMatrixAt(instanceId, _conductorDummyMatrix);
  pool.mesh.instanceMatrix.needsUpdate = true;
  pool.freeIndices.add(instanceId);
}

function releaseAllConductorInstances() {
  if (!conductorInstancePool.initialized) return;
  const pool = conductorInstancePool;

  for (let i = 0; i < pool.mesh.count; i++) {
    pool.mesh.setMatrixAt(i, _conductorDummyMatrix);
  }
  pool.mesh.instanceMatrix.needsUpdate = true;
  pool.mesh.count = 0;
  pool.freeIndices.clear();

  if (window?.debugInstancing) console.log('[conductor-instance] All slots released (clearAllEnemies)');
}

// ── Mortar enemy InstancedMesh pool ───────────────────
// One InstancedMesh for all 'mortar' enemies = 1 draw call instead of N.
const MAX_MORTAR_INSTANCES = 15;
const mortarInstancePool = {
  mesh: null,
  freeIndices: new Set(),
  initialized: false,
};
const _mortarDummyMatrix = new THREE.Matrix4().makeScale(0, 0, 0);
const _mortarColorTmp = new THREE.Color();

function initMortarInstancePool() {
  if (mortarInstancePool.initialized || !sceneRef) return;

  const def = ENEMY_DEFS.mortar;
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

  let mortarGeo;
  if (geometries.length > 0) {
    mortarGeo = mergeGeometries(geometries);
    geometries.forEach(g => g.dispose());
  }
  if (!mortarGeo) {
    console.warn('[mortar-instance] Failed to build merged geometry, falling back to box');
    mortarGeo = new THREE.BoxGeometry(def.voxelSize, def.voxelSize, def.voxelSize);
  }

  const mortarMat = new THREE.MeshBasicMaterial({
    transparent: true,
    opacity: 0.7,
    depthWrite: false,
    fog: false,
  });

  const im = new THREE.InstancedMesh(mortarGeo, mortarMat, MAX_MORTAR_INSTANCES);
  im.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  im.renderOrder = 10;
  im.count = 0;
  im.frustumCulled = false;

  for (let i = 0; i < MAX_MORTAR_INSTANCES; i++) {
    im.setMatrixAt(i, _mortarDummyMatrix);
  }
  im.instanceMatrix.needsUpdate = true;

  sceneRef.add(im);
  mortarInstancePool.mesh = im;
  mortarInstancePool.initialized = true;

  if (window?.debugInstancing) console.log(`[mortar-instance] Pool initialized: ${MAX_MORTAR_INSTANCES} slots`);
}

function acquireMortarInstance() {
  if (!mortarInstancePool.initialized) return null;
  const pool = mortarInstancePool;

  let instanceId;
  if (pool.freeIndices.size > 0) {
    instanceId = pool.freeIndices.values().next().value;
    pool.freeIndices.delete(instanceId);
  } else if (pool.mesh.count < MAX_MORTAR_INSTANCES) {
    instanceId = pool.mesh.count;
    pool.mesh.count = instanceId + 1;
  } else {
    if (window?.debugInstancing) console.warn('[mortar-instance] Pool exhausted! Falling back to individual mesh.');
    return null;
  }

  return { instanceId, pool };
}

function releaseMortarInstance(instanceId) {
  if (!mortarInstancePool.initialized) return;
  const pool = mortarInstancePool;

  pool.mesh.setMatrixAt(instanceId, _mortarDummyMatrix);
  pool.mesh.instanceMatrix.needsUpdate = true;
  pool.freeIndices.add(instanceId);
}

function releaseAllMortarInstances() {
  if (!mortarInstancePool.initialized) return;
  const pool = mortarInstancePool;

  for (let i = 0; i < pool.mesh.count; i++) {
    pool.mesh.setMatrixAt(i, _mortarDummyMatrix);
  }
  pool.mesh.instanceMatrix.needsUpdate = true;
  pool.mesh.count = 0;
  pool.freeIndices.clear();

  if (window?.debugInstancing) console.log('[mortar-instance] All slots released (clearAllEnemies)');
}

// ── Mirror Knight enemy InstancedMesh pool ──────────────────
// One InstancedMesh for all 'mirror_knight' enemies = 1 draw call instead of N.
const MAX_MIRROR_KNIGHT_INSTANCES = 5;
const mirrorKnightInstancePool = {
  mesh: null,
  freeIndices: new Set(),
  initialized: false,
};
const _mirrorKnightDummyMatrix = new THREE.Matrix4().makeScale(0, 0, 0);
const _mirrorKnightColorTmp = new THREE.Color();

function initMirrorKnightInstancePool() {
  if (mirrorKnightInstancePool.initialized || !sceneRef) return;

  const def = ENEMY_DEFS.mirror_knight;
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

  let mirrorKnightGeo;
  if (geometries.length > 0) {
    mirrorKnightGeo = mergeGeometries(geometries);
    geometries.forEach(g => g.dispose());
  }
  if (!mirrorKnightGeo) {
    console.warn('[mirror_knight-instance] Failed to build merged geometry, falling back to box');
    mirrorKnightGeo = new THREE.BoxGeometry(def.voxelSize, def.voxelSize, def.voxelSize);
  }

  const mirrorKnightMat = new THREE.MeshBasicMaterial({
    transparent: true,
    opacity: 0.7,
    depthWrite: false,
    fog: false,
  });

  const im = new THREE.InstancedMesh(mirrorKnightGeo, mirrorKnightMat, MAX_MIRROR_KNIGHT_INSTANCES);
  im.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  im.renderOrder = 10;
  im.count = 0;
  im.frustumCulled = false;

  for (let i = 0; i < MAX_MIRROR_KNIGHT_INSTANCES; i++) {
    im.setMatrixAt(i, _mirrorKnightDummyMatrix);
  }
  im.instanceMatrix.needsUpdate = true;

  sceneRef.add(im);
  mirrorKnightInstancePool.mesh = im;
  mirrorKnightInstancePool.initialized = true;

  if (window?.debugInstancing) console.log(`[mirror_knight-instance] Pool initialized: ${MAX_MIRROR_KNIGHT_INSTANCES} slots`);
}

function acquireMirrorKnightInstance() {
  if (!mirrorKnightInstancePool.initialized) return null;
  const pool = mirrorKnightInstancePool;

  let instanceId;
  if (pool.freeIndices.size > 0) {
    instanceId = pool.freeIndices.values().next().value;
    pool.freeIndices.delete(instanceId);
  } else if (pool.mesh.count < MAX_MIRROR_KNIGHT_INSTANCES) {
    instanceId = pool.mesh.count;
    pool.mesh.count = instanceId + 1;
  } else {
    if (window?.debugInstancing) console.warn('[mirror_knight-instance] Pool exhausted! Falling back to individual mesh.');
    return null;
  }

  return { instanceId, pool };
}

function releaseMirrorKnightInstance(instanceId) {
  if (!mirrorKnightInstancePool.initialized) return;
  const pool = mirrorKnightInstancePool;

  pool.mesh.setMatrixAt(instanceId, _mirrorKnightDummyMatrix);
  pool.mesh.instanceMatrix.needsUpdate = true;
  pool.freeIndices.add(instanceId);
}

function releaseAllMirrorKnightInstances() {
  if (!mirrorKnightInstancePool.initialized) return;
  const pool = mirrorKnightInstancePool;

  for (let i = 0; i < pool.mesh.count; i++) {
    pool.mesh.setMatrixAt(i, _mirrorKnightDummyMatrix);
  }
  pool.mesh.instanceMatrix.needsUpdate = true;
  pool.mesh.count = 0;
  pool.freeIndices.clear();

  if (window?.debugInstancing) console.log('[mirror_knight-instance] All slots released (clearAllEnemies)');
}

// ── Spiral Swimmer train segment InstancedMesh pool ─────────
// One InstancedMesh for all spiral_swimmer segments = 1 draw call instead of N.
// Each train has trainLength (10) segments, so pool size accommodates multiple trains.
const MAX_SPIRAL_SWIMMER_INSTANCES = 50; // ~5 trains of 10 segments each
const spiralSwimmerInstancePool = {
  mesh: null,
  freeIndices: new Set(),
  initialized: false,
};
const _spiralSwimmerDummyMatrix = new THREE.Matrix4().makeScale(0, 0, 0);
const _spiralSwimmerColorTmp = new THREE.Color();

function initSpiralSwimmerInstancePool() {
  if (spiralSwimmerInstancePool.initialized || !sceneRef) return;

  const def = ENEMY_DEFS.spiral_swimmer;
  // Spiral swimmer has a single-voxel pattern
  const geo = getGeo(def.voxelSize);

  const spiralSwimmerGeo = geo.clone();

  const spiralSwimmerMat = new THREE.MeshBasicMaterial({
    transparent: true,
    opacity: 0.8,
    depthWrite: false,
    fog: false,
  });

  const im = new THREE.InstancedMesh(spiralSwimmerGeo, spiralSwimmerMat, MAX_SPIRAL_SWIMMER_INSTANCES);
  im.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  im.renderOrder = 10;
  im.count = 0;
  im.frustumCulled = false;

  for (let i = 0; i < MAX_SPIRAL_SWIMMER_INSTANCES; i++) {
    im.setMatrixAt(i, _spiralSwimmerDummyMatrix);
  }
  im.instanceMatrix.needsUpdate = true;

  sceneRef.add(im);
  spiralSwimmerInstancePool.mesh = im;
  spiralSwimmerInstancePool.initialized = true;

  if (window?.debugInstancing) console.log(`[spiral_swimmer-instance] Pool initialized: ${MAX_SPIRAL_SWIMMER_INSTANCES} slots`);
}

function acquireSpiralSwimmerInstance() {
  if (!spiralSwimmerInstancePool.initialized) return null;
  const pool = spiralSwimmerInstancePool;

  let instanceId;
  if (pool.freeIndices.size > 0) {
    instanceId = pool.freeIndices.values().next().value;
    pool.freeIndices.delete(instanceId);
  } else if (pool.mesh.count < MAX_SPIRAL_SWIMMER_INSTANCES) {
    instanceId = pool.mesh.count;
    pool.mesh.count = instanceId + 1;
  } else {
    if (window?.debugInstancing) console.warn('[spiral_swimmer-instance] Pool exhausted! Falling back to individual mesh.');
    return null;
  }

  return { instanceId, pool };
}

function releaseSpiralSwimmerInstance(instanceId) {
  if (!spiralSwimmerInstancePool.initialized) return;
  const pool = spiralSwimmerInstancePool;

  pool.mesh.setMatrixAt(instanceId, _spiralSwimmerDummyMatrix);
  pool.mesh.instanceMatrix.needsUpdate = true;
  pool.freeIndices.add(instanceId);
}

function releaseAllSpiralSwimmerInstances() {
  if (!spiralSwimmerInstancePool.initialized) return;
  const pool = spiralSwimmerInstancePool;

  for (let i = 0; i < pool.mesh.count; i++) {
    pool.mesh.setMatrixAt(i, _spiralSwimmerDummyMatrix);
  }
  pool.mesh.instanceMatrix.needsUpdate = true;
  pool.mesh.count = 0;
  pool.freeIndices.clear();

  if (window?.debugInstancing) console.log('[spiral_swimmer-instance] All slots released (clearAllEnemies)');
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
function recordPlayerPosition(pos, now) {
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

  // Create the group to hold hitbox and track position
  const group = new THREE.Group();
  group.renderOrder = 10;

  // Try to use instanced rendering for train segments
  const instanceIds = []; // Track all instance IDs for this train
  let useInstancedTrain = false;

  // Acquire instances for all segments
  for (let i = 0; i < trainLength; i++) {
    const instance = acquireSpiralSwimmerInstance();
    if (instance) {
      instanceIds.push(instance);
    } else {
      // Pool exhausted, release any acquired instances and fall back
      instanceIds.forEach(inst => releaseSpiralSwimmerInstance(inst.instanceId));
      instanceIds.length = 0;
      break;
    }
  }

  useInstancedTrain = instanceIds.length === trainLength;

  if (useInstancedTrain) {
    // Instanced path: set up instance matrices and colors
    const pool = instanceIds[0].pool;

    // Set initial positions for all segments
    for (let i = 0; i < trainLength; i++) {
      const inst = instanceIds[i];
      const segmentPos = position.clone();
      if (i > 0) {
        segmentPos.z -= i * def.voxelSize * 1.5;
      }

      // Create matrix for this segment
      const matrix = new THREE.Matrix4();
      matrix.setPosition(segmentPos);
      pool.mesh.setMatrixAt(inst.instanceId, matrix);
      pool.mesh.setColorAt(inst.instanceId, _spiralSwimmerColorTmp.setHex(def.color));
    }
    // Head segment (index 0): same color as tail, but larger (scale handled in update)
    pool.mesh.instanceMatrix.needsUpdate = true;
    if (pool.mesh.instanceColor) pool.mesh.instanceColor.needsUpdate = true;

    // Store instance info in group userData
    group.userData.instanceIds = instanceIds.map(inst => inst.instanceId);
    group.userData.instancePool = pool;
    group.userData.useInstancedTrain = true;
  } else {
    // Fallback: create individual meshes
    const geo = getGeo(def.voxelSize);
    const material = new THREE.MeshBasicMaterial({
      color: def.color,
      transparent: true,
      opacity: 0.8,
      depthWrite: false,
      fog: false,
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

    group.userData.trailingVoxels = trailingVoxels;
  }

  group.position.copy(position);
  group.userData.isEnemy = true;
  group.userData.enemyType = type;

  // Add hitbox
  const hitboxMat = new THREE.MeshBasicMaterial({ visible: false });
  const hitbox = new THREE.Mesh(getHitboxGeo(def.hitboxRadius * 2, def.hitboxRadius * 2, def.hitboxRadius * 2), hitboxMat);
  hitbox.userData.isEnemyHitbox = true;
  hitbox.position.z = -(trainLength * def.voxelSize * 0.75);
  group.add(hitbox);

  const enemy = {
    id: nextEnemyId++,
    mesh: group,
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
    material: null, // Train enemies don't own material (instanced pool or child meshes)
    trailingVoxels: useInstancedTrain ? null : group.userData.trailingVoxels,
    instanceIds: useInstancedTrain ? group.userData.instanceIds : null,
    hitbox,
    spiralAngle: 0,
    spiralRadius: 0.8,
    scattered: false,
    scatterTimer: 0,
  };

  if (ENABLE_SPAWN_WARP) applySpawnWarp(enemy);

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
 * Spawn baby spiders from Spider Walker death.
 */
function spawnBabySpiders(position, count = 3) {
  for (let i = 0; i < count; i++) {
    const geo = getGeo(0.12);
    const mat = new THREE.MeshBasicMaterial({
      color: 0xff6644,
      transparent: true,
      opacity: 0.7,
      depthWrite: false,
      fog: false,
    });
    const spider = new THREE.Mesh(geo, mat);
    spider.renderOrder = 10;
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
      depthWrite: false,
      fog: false,
    });
    const shard = new THREE.Mesh(geo, mat);
    shard.renderOrder = 10;
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
function updateShieldShards(dt, now, playerPos) {
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
    depthWrite: false,
    fog: false,
  });
  const echo = new THREE.Mesh(geo, mat);
  echo.renderOrder = 10;
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
      // Don't dispose shared geometry from getGeo() - it's cached
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


const electricArcs = [];
/**
 * Clear all electric arcs spawned by a specific conductor.
 * Called when a conductor dies to immediately remove its buff visuals.
 * @param {number} conductorId - Unique ID of the conductor
 */
function clearConductorArcs(conductorId) {
  for (let i = electricArcs.length - 1; i >= 0; i--) {
    const arc = electricArcs[i];
    if (arc.conductorId === conductorId) {
      sceneRef.remove(arc.mesh);
      arc.mesh.geometry.dispose();
      arc.mesh.material.dispose();
      electricArcs.splice(i, 1);
    }
  }
}

/**
 * Clear all electric arcs connected to a specific buffed enemy.
 * Called when a buffed enemy dies to immediately remove its lightning visuals.
 * @param {number} targetEnemyId - Unique ID of the buffed enemy
 */
function clearTargetEnemyArcs(targetEnemyId) {
  for (let i = electricArcs.length - 1; i >= 0; i--) {
    const arc = electricArcs[i];
    if (arc.targetEnemyId === targetEnemyId) {
      sceneRef.remove(arc.mesh);
      arc.mesh.geometry.dispose();
      arc.mesh.material.dispose();
      electricArcs.splice(i, 1);
    }
  }
}

/**
 * Clear all electric arcs (for level transitions).
 */
export function clearAllElectricArcs() {
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
    _scratch.copy(playerPos).sub(spider.mesh.position);
    const dist = _scratch.length();
    if (dist > 0.1) {
      _scratch.normalize();
      spider.mesh.position.addScaledVector(_scratch, spider.speed * dt);
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
      depthWrite: false,
      fog: false,
    });

    const group = new THREE.Group();
    group.renderOrder = 10;
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
    const hitboxMat = new THREE.MeshBasicMaterial({ visible: false });
    const hitbox = new THREE.Mesh(getHitboxGeo(0.4, 0.4, 0.4), hitboxMat);
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

    if (ENABLE_SPAWN_WARP) applySpawnWarp(enemy);

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
      depthWrite: false,
      fog: false,
    });

    const group = new THREE.Group();
    group.renderOrder = 10;
    // Simple pattern
    const cube = new THREE.Mesh(geo, mat.clone());
    group.add(cube);

    group.position.copy(spawnPos);
    group.scale.setScalar(0.7);
    group.userData.isEnemy = true;
    group.userData.enemyType = 'clone_mimic_split'; // For debug identification

    // Add hitbox
    const hitboxMat = new THREE.MeshBasicMaterial({ visible: false });
    const hitbox = new THREE.Mesh(getHitboxGeo(0.3, 0.3, 0.3), hitboxMat);
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

    if (ENABLE_SPAWN_WARP) applySpawnWarp(enemy);

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

// PERFORMANCE: Additional scratch vectors for enemy AI hot paths
const _enemyScratch1 = new THREE.Vector3();
const _enemyScratch2 = new THREE.Vector3();
const _enemyScratch3 = new THREE.Vector3();

// Status effect text popups (glowing title text style, similar to damage numbers)
const statusBubbles = [];

/**
 * Spawn glowing title text indicating a status effect was applied.
 * Task #4: Replaced comic bubble icons with large glowing text for VR readability.
 * Colors: Fire=#ff3300, Freeze=#88ccff, Shock=#ffdd00
 */
function spawnStatusEffectBubble(position, effectType, stacks) {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  canvas.width = 256;
  canvas.height = 128;

  // Determine color and text based on effect type
  // Task #4: Use specified glowing colors for each effect
  let glowColor, text;
  switch (effectType) {
    case 'fire':
      glowColor = '#ff3300';  // Hot red
      text = stacks > 1 ? `FIRE x${stacks}!` : 'FIRE!';
      break;
    case 'shock':
      glowColor = '#ffdd00';  // Electric yellow
      text = stacks > 1 ? `SHOCK x${stacks}!` : 'SHOCK!';
      break;
    case 'freeze':
      glowColor = '#88ccff';  // Icy blue
      text = stacks > 1 ? `CHILL x${stacks}!` : 'CHILL!';
      break;
    default:
      glowColor = '#ffffff';
      text = 'EFFECT!';
  }

  // Large font for VR readability
  const fontSize = 56;
  ctx.font = `bold ${fontSize}px Arial, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  // Glow effect (similar to damage numbers)
  ctx.shadowColor = glowColor;
  ctx.shadowBlur = 20;

  // Drop shadow for depth
  ctx.fillStyle = 'rgba(0,0,0,0.8)';
  ctx.fillText(text, 130, 66);

  // Main glowing text
  ctx.fillStyle = glowColor;
  ctx.fillText(text, 128, 64);

  const texture = new THREE.CanvasTexture(canvas);
  texture.minFilter = THREE.LinearFilter;
  texture.premultiplyAlpha = false;

  // Larger scale for VR readability (similar to damage numbers)
  const scale = 0.5;
  const width = scale * 2;
  const height = scale;

  const mesh = new THREE.Mesh(
    new THREE.PlaneGeometry(width, height),
    new THREE.MeshBasicMaterial({ 
      map: texture, 
      transparent: true, 
      opacity: 0.95,
      depthTest: false, 
      side: THREE.DoubleSide 
    })
  );
  
  // Position at enemy, pop up effect
  mesh.position.copy(position);
  mesh.position.y += 1.2;  // Above enemy
  mesh.position.x += (Math.random() - 0.5) * 0.3;
  mesh.position.z += (Math.random() - 0.5) * 0.3;
  
  mesh.renderOrder = 998;
  mesh.userData.createdAt = performance.now();
  mesh.userData.lifetime = 800;
  mesh.userData.velocity = new THREE.Vector3(
    (Math.random() - 0.5) * 0.5,
    1.2,  // Float up
    (Math.random() - 0.5) * 0.5
  );

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
 * Spawn a health gain popup (white + with pixel half-heart) at enemy position when VAMPIRE triggers.
 */
export function spawnHealthGainPopup(position) {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  canvas.width = 256;
  canvas.height = 128;

  // Transparent canvas (no background)
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // Pixel heart pattern (7x6 grid from HUD)
  const HEART_PIXELS = [
    [0, 1, 1, 0, 1, 1, 0],
    [1, 1, 1, 1, 1, 1, 1],
    [1, 1, 1, 1, 1, 1, 1],
    [0, 1, 1, 1, 1, 1, 0],
    [0, 0, 1, 1, 1, 0, 0],
    [0, 0, 0, 1, 0, 0, 0],
  ];

  const pixelSize = 8;
  const heartX = 140;
  const heartY = canvas.height / 2 - (6 * pixelSize) / 2;

  // Draw half-heart (left side only: columns 0-3)
  ctx.fillStyle = '#ff0044';
  for (let row = 0; row < 6; row++) {
    for (let col = 0; col < 4; col++) {
      if (HEART_PIXELS[row][col]) {
        ctx.fillRect(heartX + col * pixelSize, heartY + row * pixelSize, pixelSize, pixelSize);
      }
    }
  }

  // White + on the left
  ctx.font = 'bold 72px Arial';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#ffffff';
  ctx.shadowColor = '#000000';
  ctx.shadowBlur = 4;
  ctx.fillText('+', 60, canvas.height / 2);

  const texture = new THREE.CanvasTexture(canvas);
  texture.minFilter = THREE.LinearFilter;

  const material = new THREE.SpriteMaterial({
    map: texture,
    transparent: true,
    depthTest: false,
  });

  const mesh = new THREE.Sprite(material);
  mesh.position.copy(position);
  mesh.position.y += 0.3;  // Slightly above enemy
  mesh.scale.set(0.6, 0.3, 1);
  mesh.renderOrder = 997;
  mesh.userData.createdAt = performance.now();
  mesh.userData.lifetime = 1000;
  mesh.userData.velocity = new THREE.Vector3((Math.random() - 0.5) * 0.3, 1.2, (Math.random() - 0.5) * 0.3);

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

  // Initialize conductor enemy InstancedMesh pool
  initConductorInstancePool();

  // Initialize mortar enemy InstancedMesh pool
  initMortarInstancePool();

  // Initialize mirror_knight enemy InstancedMesh pool
  initMirrorKnightInstancePool();

  // Initialize spiral_swimmer enemy InstancedMesh pool (for train segments)
  initSpiralSwimmerInstancePool();
}

/**
 * Spawn a single enemy of the given type at `position`.
 * `levelConfig` from game.js provides HP/speed multipliers.
 */
export function spawnEnemy(type, position, levelConfig) {
  const def = ENEMY_DEFS[type];
  if (!def) return;
  if (type === 'mirror_knight' && activeEnemies.some(enemy => enemy.isMirror)) return;

  // Limit 5-high jelly enemies to 1 concurrent (they're too hard in groups)
  if (type === 'jelly' && activeEnemies.some(enemy => enemy.isJelly)) return;

  // Limit conductor (warden) enemies to 2 concurrent
  if (type === 'conductor' && activeEnemies.filter(enemy => enemy.isConductor).length >= 2) return;

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
      depthWrite: false,
      fog: false,
    });
  }
  const material = sharedMaterials[type].clone();

  const group = new THREE.Group();
  group.renderOrder = 10;
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

  // ── Conductor enemy InstancedMesh path ──
  let useInstancedConductor = false;
  if (type === 'conductor') {
    const instance = acquireConductorInstance();
    if (instance) {
      useInstancedConductor = true;
      group.userData.instanceId = instance.instanceId;
      group.userData.instancePool = instance.pool;

      // Position the group and sync the instance matrix
      group.position.copy(position);
      group.updateMatrix();
      instance.pool.mesh.setMatrixAt(instance.instanceId, group.matrix);
      instance.pool.mesh.instanceMatrix.needsUpdate = true;

      // Set initial instance color
      instance.pool.mesh.setColorAt(instance.instanceId, _conductorColorTmp.setHex(def.color));
      if (instance.pool.mesh.instanceColor) instance.pool.mesh.instanceColor.needsUpdate = true;
    }
    // If pool exhausted, fall through to normal path
  }

  // ── Mortar enemy InstancedMesh path ──
  let useInstancedMortar = false;
  if (type === 'mortar') {
    const instance = acquireMortarInstance();
    if (instance) {
      useInstancedMortar = true;
      group.userData.instanceId = instance.instanceId;
      group.userData.instancePool = instance.pool;

      // Position the group and sync the instance matrix
      group.position.copy(position);
      group.updateMatrix();
      instance.pool.mesh.setMatrixAt(instance.instanceId, group.matrix);
      instance.pool.mesh.instanceMatrix.needsUpdate = true;

      // Set initial instance color
      instance.pool.mesh.setColorAt(instance.instanceId, _mortarColorTmp.setHex(def.color));
      if (instance.pool.mesh.instanceColor) instance.pool.mesh.instanceColor.needsUpdate = true;
    }
    // If pool exhausted, fall through to normal path
  }

  // ── Mirror Knight enemy InstancedMesh path ──
  let useInstancedMirrorKnight = false;
  if (type === 'mirror_knight') {
    const instance = acquireMirrorKnightInstance();
    if (instance) {
      useInstancedMirrorKnight = true;
      group.userData.instanceId = instance.instanceId;
      group.userData.instancePool = instance.pool;

      // Position the group and sync the instance matrix
      group.position.copy(position);
      group.updateMatrix();
      instance.pool.mesh.setMatrixAt(instance.instanceId, group.matrix);
      instance.pool.mesh.instanceMatrix.needsUpdate = true;

      // Set initial instance color
      instance.pool.mesh.setColorAt(instance.instanceId, _mirrorKnightColorTmp.setHex(def.color));
      if (instance.pool.mesh.instanceColor) instance.pool.mesh.instanceColor.needsUpdate = true;
    }
    // If pool exhausted, fall through to normal path
  }

  // For non-instanced basic/fast/swarm/tank and all other non-tank, non-jelly enemies,
  // merge voxel geometries into a single mesh
  const useInstanced = useInstancedBasic || useInstancedFast || useInstancedSwarm || useInstancedTank ||
                       useInstancedConductor || useInstancedMortar || useInstancedMirrorKnight;
  if (!useInstanced && !isTank && !def.isJelly) {
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
  const hitboxMat = new THREE.MeshBasicMaterial({ visible: false });
  const hitbox = new THREE.Mesh(getHitboxGeo(def.hitboxRadius * 2, def.hitboxRadius * 2, def.hitboxRadius * 2), hitboxMat);
  hitbox.userData.isEnemyHitbox = true;
  group.add(hitbox);

  if (def.isJelly) {
    const jellyHeight = (def.jellyBaseHeight || def.pattern.length) * def.voxelSize * 1.05;
    hitbox.geometry = getHitboxGeo(def.hitboxRadius * 2, jellyHeight, def.hitboxRadius * 2);
  }

  const enemy = {
    id: nextEnemyId++,
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
    phaseBaseY: position.y,
    phaseChargeTimer: 0,
    phaseCharging: false,
    phasePreferredDistMin: def.phasePreferredDistMin || 5.5,
    phasePreferredDistMax: def.phasePreferredDistMax || 9.5,

    isMortar: def.isMortar || false,
    mortarTelegraphDuration: def.mortarTelegraphDuration || 2.0,
    mortarAttackCooldown: def.mortarAttackCooldown || 4.0,
    mortarAttackTimer: def.mortarAttackCooldown ? def.mortarAttackCooldown * 0.5 : 2.0,
    mortarArcHeight: def.mortarArcHeight || 2.0,
    mortarStrafeSpeed: def.mortarStrafeSpeed || 0.8,
    mortarPreferredDistMin: def.mortarPreferredDistMin || 8.0,
    mortarPreferredDistMax: def.mortarPreferredDistMax || 14.0,
    mortarStrafeDir: Math.random() < 0.5 ? -1 : 1,
    mortarTelegraphTimer: 0,
    mortarTelegraphing: false,
    mortarTelegraphParticles: [],
  };

  // Cache material references to avoid traverse() in the update hot path
  enemy._cachedMaterials = [];
  group.traverse(c => {
    if (c.isMesh && c.material && !c.userData.isEnemyHitbox) {
      enemy._cachedMaterials.push(c.material);
    }
  });

  if (ENABLE_SPAWN_WARP) applySpawnWarp(enemy);

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
  _enemyCacheDirty = true; // invalidate cache at frame start
  const collisions = [];
  const _dirtyPools = new Set();  // Collect pools that need GPU buffer sync

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

    // ── Spawn warp-in animation ──
    if (ENABLE_SPAWN_WARP && e._warpActive) {
      updateSpawnWarp(e, now);
    }

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

    if (!e.isMirror && !e.isConductor && !e.isPhase && !e.isMortar) {
      e.mesh.position.addScaledVector(_dir, e.speed * speedMod * dt);
    }

    // Sync InstancedMesh matrix for basic/fast enemies
    if (e.mesh.userData.instanceId !== undefined) {
      e.mesh.updateMatrix();
      const iid = e.mesh.userData.instanceId;
      const pool = e.mesh.userData.instancePool;
      pool.mesh.setMatrixAt(iid, e.mesh.matrix);
      _dirtyPools.add(pool);
    }

    // ── Special Enemy AI Behaviors ──
    // Spiral Swimmer: corkscrew movement
    if (e.isTrain && !e.scattered) {
      e.spiralAngle += dt * 4; // Spiral speed
      // Head moves straight toward player, NO lateral bobbing
      // Keep within vertical bounds
      e.mesh.position.y = Math.max(0.5, Math.min(3.5, e.mesh.position.y));

      // Animate trailing voxels to follow in spiral (non-instanced fallback)
      if (e.trailingVoxels) {
        e.trailingVoxels.forEach((voxel, idx) => {
          const phase = e.spiralAngle - (idx + 1) * 0.4;
          voxel.position.x = Math.sin(phase) * e.spiralRadius * 0.5;
          voxel.position.y = Math.cos(phase) * e.spiralRadius * 0.3;
        });
      }

      // Sync instanced train segments (if using instancing)
      if (e.instanceIds && e.mesh.userData.instancePool) {
        const pool = e.mesh.userData.instancePool;
        for (let i = 0; i < e.instanceIds.length; i++) {
          const iid = e.instanceIds[i];
          const phase = e.spiralAngle - i * 0.4;
          const localX = Math.sin(phase) * e.spiralRadius * 0.5;
          const localY = Math.cos(phase) * e.spiralRadius * 0.3;
          const localZ = -i * e.voxelSize * 1.5;

          // Head is 1.8x larger for clear target, tail segments stay small
          const headScale = i === 0 ? 1.8 : 1.0;
          _scratchMat4.makeTranslation(localX, localY, localZ);
          _scratchMat4.scale(_scratchScale.set(headScale, headScale, headScale));
          _scratchMat4.premultiply(_scratchMat4b.makeTranslation(e.mesh.position.x, e.mesh.position.y, e.mesh.position.z));
          pool.mesh.setMatrixAt(iid, _scratchMat4);
        }
        _dirtyPools.add(pool);
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
        for (const mat of e._cachedMaterials) {
          mat.color.setHex(shapeColors[e.currentShape] || e.baseColor.getHex());
        }
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
        _scratchColor.set(0xffffff);
        for (const mat of e._cachedMaterials) {
          setMaterialEmissiveSafe(mat, _scratchColor, (e.fireTimer - 2.0) / 0.5);
        }
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
        _scratch.copy(targetPos).sub(e.mesh.position);
        const mimicDist = _scratch.length();
        if (mimicDist > 0.1) {
          _scratch.normalize();
          e.mesh.position.addScaledVector(_scratch, e.speed * speedMod * dt);
        }
      }

      // Glitchy visual effect
      for (const mat of e._cachedMaterials) {
        mat.opacity = 0.5 + Math.sin(now * 0.01) * 0.2;
      }
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
        const pulse = 0.5 + Math.sin(now * 0.02) * 0.3;
        for (const mat of e._cachedMaterials) {
          mat.opacity = pulse;
          setMaterialEmissiveSafe(mat, _emissiveSilver, 0.8);
        }
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
            // PERFORMANCE: Use pre-allocated vector instead of new THREE.Vector3()
            const randDir = _enemyScratch1.set(
              Math.sin(now * 0.01 + i),
              0,
              Math.cos(now * 0.01 + i)
            ).normalize();
            e.mesh.position.addScaledVector(randDir, e.speed * speedMod * dt * 0.5 * phaseSpeed);
          }
        } else {
          // Mirror player's horizontal movement (opposite direction)
          // PERFORMANCE: Use pre-allocated vector instead of _dir.clone()
          const mirrorDir = _enemyScratch1.copy(_dir);
          mirrorDir.x *= -1; // Opposite horizontal movement
          e.mesh.position.addScaledVector(mirrorDir, e.speed * speedMod * dt * phaseSpeed);
        }

        // Clamp knight position to within 45 degrees from player's forward direction
        // PERFORMANCE: Use pre-allocated vector instead of new THREE.Vector3()
        const toEnemy = _enemyScratch2.subVectors(e.mesh.position, playerPos);
        toEnemy.y = 0;
        const enemyAngle = Math.atan2(toEnemy.x, toEnemy.z);
        const maxAngle = Math.PI / 4; // 45 degrees
        if (Math.abs(enemyAngle) > maxAngle) {
          const clampedAngle = Math.sign(enemyAngle) * maxAngle;
          const dist = toEnemy.length();
          e.mesh.position.x = playerPos.x + Math.sin(clampedAngle) * dist;
          e.mesh.position.z = playerPos.z + Math.cos(clampedAngle) * dist;
        }

        // Shield visual effect
        const reflectGlow = Math.sin(now * 0.003) * 0.2 + 0.5;
        for (const mat of e._cachedMaterials) {
          mat.opacity = reflectGlow;
        }
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
        for (const mat of e._cachedMaterials) {
          mat.opacity = 0.3 + Math.random() * 0.4;
        }
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
        for (const mat of e._cachedMaterials) {
          setMaterialEmissiveSafe(mat, _emissiveGreen, 0.5);
        }
      }
    }

    // Black Hole Totem: stationary, creates gravity field
    if (e.isBlackhole) {
      // Stationary - no movement

      // Visual effect: dark swirling vortex
      const pulse = 0.3 + Math.sin(now * 0.005) * 0.2;
      for (const mat of e._cachedMaterials) {
        mat.opacity = pulse;
        setMaterialEmissiveSafe(mat, _emissivePurple, 0.5);
      }

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

      // PERFORMANCE: Use pre-allocated vector instead of new THREE.Vector3()
      const perp = _enemyScratch1.set(-_dir.z, 0, _dir.x).normalize();
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

          other.mesh.traverse(c => {
            if (c.isMesh && c.material && !c.userData.isEnemyHitbox) {
              setMaterialEmissiveSafe(c.material, _emissivePink, 0.35);
            }
          });
        }
      }

      if (e.linkedEnemies.length > 0 && e.conductorArcTimer <= 0) {
        e.conductorArcTimer = e.conductorArcCooldown;
      }

      for (const mat of e._cachedMaterials) {
        setMaterialEmissiveSafe(mat, _emissivePink, e.linkedEnemies.length > 0 ? 0.7 : 0.3);
      }
    }

    // Mortar: slow strafing enemy that telegraphs and lobs projectiles
    if (e.isMortar) {
      // Slow horizontal strafe left and right
      const strafeAmount = e.mortarStrafeSpeed * e.mortarStrafeDir * speedMod * dt;
      // Strafe perpendicular to direction toward player
      _enemyScratch2.set(-_dir.z, 0, _dir.x); // perpendicular to forward
      e.mesh.position.addScaledVector(_enemyScratch2, strafeAmount);

      // Reverse direction periodically via sine wave
      e.mortarStrafeDir = Math.sign(Math.sin(now * 0.001 + e.id * 2.3));
      if (e.mortarStrafeDir === 0) e.mortarStrafeDir = 1;

      // Maintain distance in preferred range
      if (dist < e.mortarPreferredDistMin) {
        e.mesh.position.addScaledVector(_dir, -e.speed * 0.5 * speedMod * dt);
      } else if (dist > e.mortarPreferredDistMax) {
        e.mesh.position.addScaledVector(_dir, e.speed * 0.5 * speedMod * dt);
      }

      // Keep mortar in front arc
      clampPositionToFrontArc(e.mesh.position, playerPos, e.mortarPreferredDistMin, e.mortarPreferredDistMax, 120);

      // Attack cycle: telegraph then fire lobbed projectile
      e.mortarAttackTimer -= dt;

      if (e.mortarAttackTimer <= e.mortarTelegraphDuration && !e.mortarTelegraphing) {
        // Start telegraph
        e.mortarTelegraphing = true;
        e.mortarTelegraphTimer = e.mortarTelegraphDuration;
        playMortarCharge(); // Charge-up sound during telegraph
      }

      if (e.mortarTelegraphing) {
        e.mortarTelegraphTimer -= dt;

        // Telegraph visual: energy sucking particles
        const telegraphProgress = 1.0 - (e.mortarTelegraphTimer / e.mortarTelegraphDuration);
        const pulseIntensity = 0.3 + 0.7 * telegraphProgress * (0.5 + 0.5 * Math.sin(now * 0.02));

        for (const mat of e._cachedMaterials) {
          mat.opacity = 0.7 + 0.3 * telegraphProgress;
          setMaterialEmissiveSafe(mat, _emissiveRed, pulseIntensity);
        }

        // Spawn energy-gathering particles during telegraph
        if (e.mortarTelegraphParticles.length < 8 && Math.random() < 0.3) {
          const particleOffset = new THREE.Vector3(
            (Math.random() - 0.5) * 2.0,
            (Math.random() - 0.5) * 2.0,
            (Math.random() - 0.5) * 2.0
          );
          const particle = {
            pos: e.mesh.position.clone().add(particleOffset),
            vel: e.mesh.position.clone().sub(e.mesh.position.clone().add(particleOffset)).normalize().multiplyScalar(2.0),
            life: 0.5 + Math.random() * 0.5,
            maxLife: 0.5 + Math.random() * 0.5,
          };
          e.mortarTelegraphParticles.push(particle);
        }

        // Update telegraph particles (suck toward mortar)
        for (let pi = e.mortarTelegraphParticles.length - 1; pi >= 0; pi--) {
          const p = e.mortarTelegraphParticles[pi];
          p.life -= dt;
          const toCenter = e.mesh.position.clone().sub(p.pos);
          p.vel.add(toCenter.normalize().multiplyScalar(8.0 * dt));
          p.pos.add(p.vel.clone().multiplyScalar(dt));
          if (p.life <= 0) {
            e.mortarTelegraphParticles.splice(pi, 1);
          }
        }

        // Fire when telegraph completes
        if (e.mortarTelegraphTimer <= 0) {
          e.mortarTelegraphing = false;
          e.mortarAttackTimer = e.mortarAttackCooldown;
          e.mortarTelegraphParticles.length = 0;

          // Fire lobbed projectile at player
          const fromPos = e.mesh.position.clone();
          fromPos.y += 0.5; // Fire from slightly above the mortar
          const targetPos = playerPos.clone();
          spawnMortarProjectile(fromPos, targetPos, e.mortarArcHeight);
          playBossProjectileFiredSound(); // Skull Boss lob shot sound
        }
      } else {
        // Idle visual
        for (const mat of e._cachedMaterials) {
          mat.opacity = 0.7;
          setMaterialEmissiveSafe(mat, _emissiveRed, 0.2 + 0.1 * Math.sin(now * 0.003 + e.id));
        }
      }
    }

    // Phase Wraith legacy support (removed, replaced by Mortar)
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
      _scratchColor.copy(e.baseColor).lerp(_redColor, dmgRatio);
      const pool = e.mesh.userData.instancePool;
      pool.mesh.setColorAt(e.mesh.userData.instanceId, _scratchColor);
      _dirtyPools.add(pool);
    } else {
      // Non-instanced enemy: update material color directly
      if (e.material) {
        e.material.color.copy(e.baseColor).lerp(_redColor, dmgRatio);
      }
    }
  }

  // Flush all dirty instanced pool buffers to GPU (once per pool, not per enemy)
  for (const pool of _dirtyPools) {
    pool.mesh.instanceMatrix.needsUpdate = true;
    if (pool.mesh.instanceColor) pool.mesh.instanceColor.needsUpdate = true;
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
        e.hitbox.geometry = getHitboxGeo(e.hitboxRadius * 2, e.hitboxRadius * 2, length);
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

  // Release InstancedMesh slot for conductor enemies
  if (e.type === 'conductor' && e.mesh.userData.instanceId !== undefined) {
    releaseConductorInstance(e.mesh.userData.instanceId);
  }

  // Release InstancedMesh slot for mortar enemies
  if (e.type === 'mortar' && e.mesh.userData.instanceId !== undefined) {
    releaseMortarInstance(e.mesh.userData.instanceId);
  }

  // Release InstancedMesh slot for mirror_knight enemies
  if (e.type === 'mirror_knight' && e.mesh.userData.instanceId !== undefined) {
    releaseMirrorKnightInstance(e.mesh.userData.instanceId);
  }

  // Release all InstancedMesh slots for spiral_swimmer (train) enemies
  if (e.isTrain && e.instanceIds) {
    e.instanceIds.forEach(iid => releaseSpiralSwimmerInstance(iid));
    e.instanceIds.length = 0;
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

  // Cleanup: if this enemy is linked by a conductor, remove it from that conductor's list
  // and reset emissive. Must happen before mesh is removed from scene.
  for (let ci = 0; ci < activeEnemies.length; ci++) {
    const cond = activeEnemies[ci];
    if (!cond.isConductor || ci === index) continue;
    const linkIdx = cond.linkedEnemies.indexOf(index);
    if (linkIdx !== -1) {
      cond.linkedEnemies.splice(linkIdx, 1);
    }
  }
  // Reset pink emissive on linked enemies
  if (e.linkedByConductor) {
    e.mesh.traverse(c => {
      if (c.isMesh && c.material && !c.userData.isEnemyHitbox) {
        setMaterialEmissiveSafe(c.material, _emissiveBlack, 0);
      }
    });
    // Clear all electric arcs connected to this buffed enemy
    clearTargetEnemyArcs(e.id);
  }

  // Conductor: Chain overload - kills all linked enemies
  if (e.isConductor) {
    // Clear all electric arcs spawned by this conductor immediately
    clearConductorArcs(e.id);

    if (e.linkedEnemies.length > 0) {
      // Snapshot linked enemy references before killing to avoid index corruption
      // (recursive destroyEnemy calls will splice activeEnemies, shifting indices)
      const linkedRefs = e.linkedEnemies
        .map(idx => activeEnemies[idx])
        .filter(ref => ref != null);
      e.linkedEnemies = [];

      linkedRefs.forEach(ref => {
        // Set hp to 0; the main update loop will call destroyEnemy on next iteration
        ref.hp = 0;
      });
    }
  }

  // [Physics Death System] Spawn voxel explosions with physics
  if (spawnVoxelExplosion) {
    // Debris count based on enemy voxel pattern size
    let voxelCount;
    // Count child meshes without allocating an array (avoids GC spike on death)
    let childMeshCount = e.voxelPatternSize || 0;
    if (!childMeshCount) {
      for (let ci = 0; ci < e.mesh.children.length; ci++) {
        if (e.mesh.children[ci].isMesh && !e.mesh.children[ci].userData.isEnemyHitbox) childMeshCount++;
      }
    }
    const voxelPatternSize = childMeshCount;

    if (voxelPatternSize <= 1) {
      voxelCount = Math.floor(Math.random() * 3) + 1;  // 1-3
    } else if (voxelPatternSize === 2) {
      voxelCount = Math.floor(Math.random() * 3) + 2;  // 2-4
    } else if (voxelPatternSize === 3) {
      voxelCount = Math.floor(Math.random() * 3) + 2;  // 2-4
    } else if (voxelPatternSize === 4) {
      voxelCount = Math.floor(Math.random() * 4) + 2;  // 2-5
    } else if (voxelPatternSize === 5) {
      voxelCount = Math.floor(Math.random() * 3) + 3;  // 3-5
    } else {
      voxelCount = 6;  // Tank or larger: always 6
    }

    // Special type overrides (can override the random count)
    if (e.isTrain) voxelCount = Math.min(e.trainLength || 5, 5); // Cap train voxels
    if (e.shapeShift) voxelCount = 5;
    if (e.isRanged) voxelCount = 5;
    if (e.isMimic) voxelCount = 4;
    if (e.isSpider) voxelCount = 3;
    if (e.isPhase) voxelCount = Math.floor(Math.random() * 4) + 5; // 5-8 voxels for phase wraith

    // Mini-boss types get higher cap (conductor, mirror knight, phase wraith, etc.)
    const isMiniboss = e.isConductor || e.isMirror || e.isPhase || e.isMortar || e.isBlackhole;
    if (isMiniboss) {
      voxelCount = Math.max(voxelCount, 6); // At least 6 for mini-bosses
    }

    // Cap by tier: regular 8, mini-boss 15, absolute ceiling 25
    const tierCap = isMiniboss ? 15 : 8;
    voxelCount = Math.min(voxelCount, tierCap);
    voxelCount = Math.min(voxelCount, MAX_DEBRIS); // Absolute ceiling

    // spawnVoxelExplosion(pos, color, voxelCount, type, isCritical, isOverkill)
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

    // Reuse a pre-allocated velocity vector (clone to store on sprite)
    const vel = _explosionSpriteVel.set(
      (Math.random() - 0.5) * 5,
      (Math.random() - 0.5) * 5,
      (Math.random() - 0.5) * 5,
    ).clone();
    sprite.userData.velocity = vel;
    sprite.userData.createdAt = performance.now();
    sprite.userData.lifetime = 300 + Math.random() * 200;

    explosionParts.push(sprite);
  }

  // Remove enemy mesh from scene
  sceneRef.remove(e.mesh);
  // Dispose all geometries including hitbox
  // For instanced enemies, voxel geometry lives in the InstancedMesh pool,
  // but hitbox geometry (userData.isEnemyHitbox) is per-enemy and must be disposed.
  e.mesh.traverse(c => {
    if (c.isMesh && c.geometry) {
      // Skip instanced voxel geometry (shared pool), but always dispose hitboxes
      if (c.userData.isEnemyHitbox || e.mesh.userData.instanceId === undefined) {
        c.geometry.dispose();
      }
      // Dispose per-enemy materials (hitbox materials are not shared)
      if (c.material && c.material !== (e.material || null) && !c.material._isShared) {
        c.material.dispose();
      }
    }
  });
  // Dispose material (if enemy owns one)
  if (e.material) e.material.dispose();
  activeEnemies.splice(index, 1);
  _enemyMeshesDirty = true;  // Invalidate cache

  return { position: pos, scoreValue: e.scoreValue, baseColor: color, type: e.type };
}

/**
 * Remove all enemies (for level transitions).
 */
export function clearAllEnemies() {
  // Clear geometry caches to prevent GPU object accumulation across game restarts
  clearGeometryCaches();

  // Clear electric arcs (conductor arcs must not leak across level transitions)
  clearAllElectricArcs();

  // Release all basic enemy InstancedMesh slots
  releaseAllBasicInstances();

  // Release all fast enemy InstancedMesh slots
  releaseAllFastInstances();

  // Release all swarm enemy InstancedMesh slots
  releaseAllSwarmInstances();

  // Release all tank enemy InstancedMesh slots
  releaseAllTankInstances();

  // Release all conductor enemy InstancedMesh slots
  releaseAllConductorInstances();

  // Release all mortar enemy InstancedMesh slots
  releaseAllMortarInstances();

  // Release all mirror_knight enemy InstancedMesh slots
  releaseAllMirrorKnightInstances();

  // Release all spiral_swimmer enemy InstancedMesh slots
  releaseAllSpiralSwimmerInstances();

  for (let i = activeEnemies.length - 1; i >= 0; i--) {
    sceneRef.remove(activeEnemies[i].mesh);
    // Dispose all geometries including hitbox
    // For instanced enemies, voxel geometry lives in pool, but hitboxes must be disposed
    activeEnemies[i].mesh.traverse(c => {
      if (c.isMesh && c.geometry) {
        if (c.userData.isEnemyHitbox || activeEnemies[i].mesh.userData.instanceId === undefined) {
          c.geometry.dispose();
        }
        if (c.material && c.material !== activeEnemies[i].material && !c.material._isShared) {
          c.material.dispose();
        }
      }
    });
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

  // Clear shield shards (Mirror Knight death ground hazards)
  for (let i = shieldShards.length - 1; i >= 0; i--) {
    const shard = shieldShards[i];
    sceneRef.remove(shard.mesh);
    if (shard.mesh.geometry) shard.mesh.geometry.dispose();
    if (shard.mesh.material) shard.mesh.material.dispose();
  }
  shieldShards.length = 0;

  // Clear phase echoes (Phase Wraith death ghosts)
  for (let i = phaseEchoes.length - 1; i >= 0; i--) {
    const echo = phaseEchoes[i];
    sceneRef.remove(echo.mesh);
    if (echo.mesh.geometry) echo.mesh.geometry.dispose();
    if (echo.mesh.material) echo.mesh.material.dispose();
  }
  phaseEchoes.length = 0;

  // Clear baby spiders (Spider Walker death babies)
  for (let i = babySpiders.length - 1; i >= 0; i--) {
    const spider = babySpiders[i];
    sceneRef.remove(spider.mesh);
    if (spider.mesh.geometry) spider.mesh.geometry.dispose();
    if (spider.mesh.material) spider.mesh.material.dispose();
  }
  babySpiders.length = 0;

  // Clear status bubbles (status effect popup sprites)
  for (let i = statusBubbles.length - 1; i >= 0; i--) {
    const b = statusBubbles[i];
    sceneRef.remove(b);
    if (b.material) {
      if (b.material.map) b.material.map.dispose();
      b.material.dispose();
    }
    if (b.geometry) b.geometry.dispose();
  }
  statusBubbles.length = 0;

  // Clear explosion parts (death particle sprites)
  for (let i = explosionParts.length - 1; i >= 0; i--) {
    const p = explosionParts[i];
    if (p.parent) p.parent.remove(p);
    if (p.material) {
      if (p.material.map) p.material.map.dispose();
      p.material.dispose();
    }
    if (p.geometry) p.geometry.dispose();
  }
  explosionParts.length = 0;

  // Clear enemy debris (unused placeholder array, clean anyway)
  for (let i = enemyDebris.length - 1; i >= 0; i--) {
    const d = enemyDebris[i];
    if (d.parent) d.parent.remove(d);
    if (d.geometry) d.geometry.dispose();
    if (d.material) d.material.dispose();
  }
  enemyDebris.length = 0;

  // Clear boss debris
  clearBossDebris();

  // Clear boss minions (in case boss wasn't killed)
  clearBossMinions();

  // Clear boss itself
  clearBoss();
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
        effect.mesh.name = 'boss-attack-projectile';
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
        effect.mesh.name = 'boss-attack-charge';
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
        effect.mesh.name = 'boss-attack-minion';
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
        effect.mesh.name = 'boss-attack-melee';
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
    group.renderOrder = 10;
    const geo = getGeo(def.voxelSize);
    const mat = new THREE.MeshBasicMaterial({
      color: def.color,
      transparent: true,
      opacity: 0.9,
      depthWrite: false,
      fog: false,
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

    // Add hitbox (use cached geometry to avoid per-spawn leak)
    const hitboxMat = new THREE.MeshBasicMaterial({ visible: false });
    const hitbox = new THREE.Mesh(getHitboxGeo((def.hitboxRadius || 0.5) * 2, (def.hitboxRadius || 0.5) * 2, (def.hitboxRadius || 0.5) * 2), hitboxMat);
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
        depthWrite: false,
        fog: false,
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
    _log(`[Boss] ${this.def.name} transitioning to Phase ${newPhase}`);

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
    // Keep bosses locked to the same forward arc the player spawned facing.
    // The spawn vector is captured once per level so bosses ignore head turns
    // but still respect the encounter framing and distance limits.
    clampPositionToFrontArc(
      this.mesh.position,
      playerPos,
      this.minDistance,
      this.maxDistance,
      this.frontArc,
      _bossSpawnForwardRef,
    );
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
    _scratch.copy(playerPos).sub(this.mesh.position).normalize();
    
    // Slow movement toward player
    this.mesh.position.addScaledVector(_scratch, 0.8 * dt);
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
    _scratch.copy(playerPos).sub(this.mesh.position).normalize();
    
    // Fast erratic movement
    if (this.state === 'visible') {
      this.mesh.position.addScaledVector(_scratch, 2.0 * dt);
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
        setMaterialEmissiveSafe(c.material, _emissiveWhite, 0.8);
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
          setMaterialEmissiveSafe(c.material, _emissiveWhite, 0.3);
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
    _log(`[SkullHand] Hand ${handIndex} created with ${this.hp}/${this.maxHp} HP (handsDestroyed: ${handsDestroyed})`);
    
    this.shootTimer = 0;
    this.shootRate = parentBoss.def.handShootRate || 1.5;
    
    this.buildMesh();
  }
  
  buildMesh() {
    // Voxel hand - skeletal hand shape
    this.group = new THREE.Group();
    this.group.renderOrder = 10;
    const geo = getGeo(0.18);
    const mat = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.9,
      depthWrite: false,
      fog: false,
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
    
    // Hitbox (use cached geometry to avoid per-spawn leak)
    const hitboxMat = new THREE.MeshBasicMaterial({ visible: false });
    const hitbox = new THREE.Mesh(getHitboxGeo(1.0, 1.0, 1.0), hitboxMat);
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
    
    // Horizontal oscillating animation (slow left/right sway)
    const horizontalPhase = this.handIndex % 2 === 0 ? 0 : Math.PI; // Alternate phase for top/bottom hands
    this.group.position.x += Math.sin(now * 0.002 + horizontalPhase) * 0.5;
    
    // Rotate to face player (world direction)
    this.group.getWorldPosition(_scratch);
    _scratch2.copy(playerPos).sub(_scratch);
    if (_scratch2.length() > 0.1) {
      this.group.lookAt(playerPos.x, _scratch.y, playerPos.z);
    }
    
    // Update color based on damage - darken toward dark red
    const damageRatio = 1 - this.hp / this.maxHp;
    this.group.traverse(c => {
      if (c.isMesh && c.material && c.userData.isHandBody) {
        _scratchColor.set(0xffffff);
        const damagedColor = new THREE.Color(0x660000); // Dark red
        c.material.color.copy(_scratchColor).lerp(damagedColor, damageRatio);
      }
    });
  }
  
  takeDamage(amount) {
    if (!this.alive) return { killed: false };
    
    // Damage reduction based on remaining hands - fewer hands = more tanky
    const aliveHands = this.parentBoss.hands.filter(h => h.alive).length;
    const damageReduction = 1 - (aliveHands - 1) * 0.15; // 4 hands: 85%, 3: 70%, 2: 55%, 1: 40% damage taken
    const actualDamage = Math.round(amount * damageReduction);
    if (DEBUG) console.log(`[SkullHand] Hand ${this.handIndex} takes ${actualDamage} damage (reduced from ${amount}, ${aliveHands} hands alive, ${(damageReduction * 100).toFixed(0)}% damage taken)`);
    
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
    // Explosion effect at world position (3 voxels per turret/hand)
    if (spawnVoxelExplosion) {
      const worldPos = this.group.getWorldPosition(new THREE.Vector3());
      spawnVoxelExplosion(worldPos, 0xffffff, 3, 'basic', false, false);
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
    
    // Shared ammo pool for hands (Part 2)
    this.ammoPool = {
      timer: 0,
      baseFireRate: 1.2, // Base fire rate when 4 hands alive
      shotsSinceReload: 0,
      reloadTimer: 0,
      reloading: false
    };
    
    // Skull phase tracking (Part 3)
    this.skullPhase = 0; // 0 = hand phase, 1/2/3 = skull phases
    this.transitioning = false;
    this.transitionTimer = 0;
    this.transitionDuration = 3.0; // 3-second invuln between phases
    
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
    skullGroup.renderOrder = 10;
    const geo = getGeo(0.25);
    const mat = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.9,
      depthWrite: false,
      fog: false,
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
      opacity: 0.8,
      depthWrite: false,
      fog: false,
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
    
    // Add hitbox for head (use cached geometry to avoid per-spawn leak)
    const hitboxMat = new THREE.MeshBasicMaterial({ visible: false });
    const hitbox = new THREE.Mesh(getHitboxGeo(2.0, 2.0, 2.0), hitboxMat);
    hitbox.userData.isBossHitbox = true;
    hitbox.userData.isSkullHead = true;
    this.mesh.add(hitbox);
  }
  
  createHands() {
    // Create 4 hands positioned around the skull
    const handOffsets = [
      new THREE.Vector3(-4.5, 0.3, 0.5),   // Left top
      new THREE.Vector3(-4.5, -0.5, 0.5),  // Left bottom
      new THREE.Vector3(4.5, 0.3, 0.5),    // Right top
      new THREE.Vector3(4.5, -0.5, 0.5),   // Right bottom
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
      }
    });
    
    this.handsAlive = aliveHands;
    
    // Phase transition: all hands destroyed -> start skull phase 1
    if (this.handsAlive === 0 && !this.headVulnerable) {
      this.setHeadImmune(false);
      this.skullPhase = 1;
      this.phase = 2; // Legacy phase tracking for health bar
      this.onPhaseChange(2);
      this.playGrowlSound();
    }
    
    // HAND PHASE: Shared ammo pool shooting
    if (!this.headVulnerable && this.handsAlive > 0) {
      this.updateHandPhaseAmmo(dt, now, playerPos);
      this.constrainToMidfield(playerPos);
    }
    
    // SKULL PHASE: 3-phase fight with transitions
    if (this.headVulnerable) {
      if (this.transitioning) {
        this.updateTransition(dt, now, playerPos);
      } else {
        this.updateSkullPhase(dt, now, playerPos);
      }
    }
    
    // Update head color based on damage
    this.updateHeadColor();
    
    // Face player
    this.mesh.lookAt(_look.copy(playerPos));
  }
  
  // Part 2: Shared ammo pool for hands
  updateHandPhaseAmmo(dt, now, playerPos) {
    const pool = this.ammoPool;
    
    // Calculate fire rate based on alive hands (fewer hands = faster fire)
    // 4 hands: 1.2s, 3 hands: 1.0s, 2 hands: 0.8s, 1 hand: 0.5s
    const handCount = this.handsAlive;
    let fireRate = pool.baseFireRate;
    if (handCount === 3) fireRate = 1.0;
    else if (handCount === 2) fireRate = 0.8;
    else if (handCount === 1) fireRate = 0.5;
    
    // Handle reload mechanic for single hand
    if (handCount === 1) {
      if (pool.reloading) {
        pool.reloadTimer += dt;
        if (pool.reloadTimer >= 3.0) {
          pool.reloading = false;
          pool.reloadTimer = 0;
          pool.shotsSinceReload = 0;
        }
        return; // Don't shoot while reloading
      }
    }
    
    pool.timer += dt;
    if (pool.timer >= fireRate) {
      pool.timer = 0;
      
      // Pick random alive hand to shoot
      const aliveHands = this.hands.filter(h => h.alive);
      if (aliveHands.length > 0) {
        const randomHand = aliveHands[Math.floor(Math.random() * aliveHands.length)];
        this.fireHandProjectile(randomHand, playerPos);
        
        // Track shots for reload mechanic
        if (handCount === 1) {
          pool.shotsSinceReload++;
          if (pool.shotsSinceReload >= 4) {
            pool.reloading = true;
            pool.reloadTimer = 0;
          }
        }
      }
    }
  }
  
  // Part 3: Skull phase logic with 3 phases and transitions
  updateSkullPhase(dt, now, playerPos) {
    // Determine current skull phase based on HP thresholds
    // Force re-evaluation every frame so large damage chunks can't skip phases
    const phaseThreshold2 = this.maxHp * (2 / 3);
    const phaseThreshold1 = this.maxHp * (1 / 3);
    const newPhase = this.hp > phaseThreshold2 ? 1 : this.hp > phaseThreshold1 ? 2 : 3;
    
    // Check for phase transition
    if (newPhase !== this.skullPhase && !this.transitioning) {
      // Enter transition (3-sec invuln)
      this.startPhaseTransition(this.skullPhase, newPhase);
      this.skullPhase = newPhase;
      return;
    }
    
    // If transitioning, don't run normal phase behavior
    if (this.transitioning) return;
    
    // Phase-specific behavior
    const phaseConfig = this.getSkullPhaseConfig();
    
    // Eye shooting with lobbed projectiles
    this.eyeTimer += dt;
    if (this.eyeTimer >= phaseConfig.shootRate) {
      this.eyeTimer = 0;
      this.fireLobbedEyeProjectiles(playerPos, phaseConfig.arcHeight);
    }
    
    // Movement with phase-specific speed and erraticness
    this.moveTimer += dt;
    const directionChangeInterval = phaseConfig.erraticness; // How often to change direction
    if (this.moveTimer >= directionChangeInterval) {
      this.moveTimer = 0;
      // Random direction
      const angle = Math.random() * Math.PI * 2;
      this.moveDirection.set(Math.sin(angle), 0, Math.cos(angle));
    }
    
    // Apply movement
    this.mesh.position.addScaledVector(this.moveDirection, phaseConfig.moveSpeed * dt);
    
    // Keep in bounds
    this.constrainToMidfield(playerPos);
  }
  
  getSkullPhaseConfig() {
    // Return phase-specific configuration
    switch (this.skullPhase) {
      case 1: // 1800-1200 HP: Slow, predictable
        return {
          moveSpeed: 1.5,
          shootRate: 1.2,
          arcHeight: 1.0,
          erraticness: 3.0 // Change direction every 3 seconds
        };
      case 2: // 1200-600 HP: Faster, more erratic
        return {
          moveSpeed: 2.5,
          shootRate: 0.8,
          arcHeight: 1.5,
          erraticness: 1.5 // Change direction every 1.5 seconds
        };
      case 3: // 600-0 HP: Very fast, very erratic
        return {
          moveSpeed: 4.0,
          shootRate: 0.5,
          arcHeight: 2.0,
          erraticness: 0.8 // Change direction every 0.8 seconds
        };
      default:
        return {
          moveSpeed: 1.5,
          shootRate: 1.2,
          arcHeight: 2.0,
          erraticness: 3.0
        };
    }
  }
  
  startPhaseTransition(fromPhase, toPhase) {
    this.transitioning = true;
    this.transitionTimer = 0;
    this.transitionFromPhase = fromPhase;
    this.transitionToPhase = toPhase;
    
    // Visual effects during transition
    this.playGrowlSound();
    playSkullPhaseSound();
    
    // Brighten eyes
    if (this.leftEye) {
      this.leftEye.material.color.setHex(0xff3333);
      this.leftEye.material.opacity = 1.0;
    }
    if (this.rightEye) {
      this.rightEye.material.color.setHex(0xff3333);
      this.rightEye.material.opacity = 1.0;
    }
    
    _log(`[SkullBoss] Phase transition: ${fromPhase} -> ${toPhase} (3-sec invuln)`);
  }
  
  updateTransition(dt, now, playerPos) {
    this.transitionTimer += dt;
    
    // Stop movement and shooting during transition
    // Pulsing scale effect
    const pulse = 1.0 + 0.1 * Math.sin(this.transitionTimer * 8.0);
    this.mesh.scale.setScalar(pulse);
    
    // Eye glow pulsing
    const eyeGlow = 0.5 + 0.5 * Math.sin(this.transitionTimer * 6.0);
    if (this.leftEye) {
      this.leftEye.material.opacity = eyeGlow;
    }
    if (this.rightEye) {
      this.rightEye.material.opacity = eyeGlow;
    }
    
    // Transition complete
    if (this.transitionTimer >= this.transitionDuration) {
      this.transitioning = false;
      this.mesh.scale.setScalar(1.0);
      
      // Set final eye state for new phase
      const eyeOpacity = 0.8 + (this.transitionToPhase - 1) * 0.1; // Brighter in later phases
      if (this.leftEye) {
        this.leftEye.material.opacity = eyeOpacity;
        this.leftEye.material.color.setHex(0xff0000);
      }
      if (this.rightEye) {
        this.rightEye.material.opacity = eyeOpacity;
        this.rightEye.material.color.setHex(0xff0000);
      }
      
      _log(`[SkullBoss] Transition complete, now in phase ${this.transitionToPhase}`);
    }
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
      // Cancel if hand was destroyed during telegraph delay
      if (!hand.alive) return;
      if (typeof spawnBossProjectile === 'function') {
        spawnBossProjectile(hand.getPosition(), playerPos);
      }
    }, 150);
  }
  
  fireEyeProjectiles(playerPos) {
    // Fire from both eyes (used by hand phase if needed)
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
  
  // Part 4: Lobbed projectiles for skull phase (arc trajectory)
  fireLobbedEyeProjectiles(playerPos, arcHeight) {
    // Show telegraph briefly before firing
    if (this.telegraphing) {
      this.showTelegraph('projectile', 0.3, 0xff0000, this.mesh.position);
    }
    
    // Fire immediately from current eye positions (no setTimeout delay)
    // This prevents the boss from moving between aiming and firing
    const leftPos = this.leftEye.getWorldPosition(new THREE.Vector3());
    const rightPos = this.rightEye.getWorldPosition(new THREE.Vector3());
    const targetPos = playerPos.clone();
    
    if (typeof spawnBossLobbedProjectile === 'function') {
      spawnBossLobbedProjectile(leftPos, targetPos, arcHeight || 2.0);
      spawnBossLobbedProjectile(rightPos, targetPos, arcHeight || 2.0);
    }
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
    playSkullHandGrowlSound();
    
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
        _log(`[SkullBoss] Hand ${hand.handIndex} HP increased: ${oldMax} -> ${hand.maxHp}, now at ${hand.hp}/${hand.maxHp}`);
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
    
    // Head damage only when vulnerable
    if (!this.headVulnerable) {
      return { killed: false, immune: true };
    }
    
    // Head immune during phase transitions
    if (this.transitioning) {
      return { killed: false, immune: true };
    }
    
    // Apply damage to head
    return super.takeDamage(amount, hitInfo);
  }
  
  onPhaseChange(newPhase) {
    super.onPhaseChange(newPhase);
    // Phase config is now driven by getSkullPhaseConfig() based on HP thresholds
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
              setMaterialEmissiveSafe(c.material, _emissiveAmber, c.material.emissiveIntensity ?? 1);
            } else {
              c.userData.weakPoint = false;
              c.material.opacity = 0.4;
              setMaterialEmissiveSafe(c.material, _emissiveBlack, c.material.emissiveIntensity ?? 0);
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
          setMaterialEmissiveSafe(c.material, _emissiveAmber, c.material.emissiveIntensity ?? 1);
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

    // Phase system (3-phase fight modeled after Skull Boss)
    this.skullPhase = 0; // 0 = initial, 1/2/3 = phases
    this.transitioning = false;
    this.transitionTimer = 0;
    this.transitionDuration = 3.0;
    this.transitionFromPhase = 0;
    this.transitionToPhase = 0;

    // Movement state (horizontal XZ plane only)
    this.moveTimer = 10; // Trigger immediate direction pick on first frame
    this.moveDirection = new THREE.Vector3(1, 0, 0);
    this.fixedY = 1.5;

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
    // Check for phase transitions based on HP
    // Dynamic phase thresholds based on maxHp fractions
    const phaseThreshold2 = this.maxHp * (2 / 3);
    const phaseThreshold1 = this.maxHp * (1 / 3);
    const newPhase = this.hp > phaseThreshold2 ? 1 : this.hp > phaseThreshold1 ? 2 : 3;

    if (this.skullPhase === 0) {
      // First frame: enter phase 1
      this.skullPhase = 1;
      this.onMinotaurPhaseChange(1);
    } else if (newPhase !== this.skullPhase && !this.transitioning) {
      this.startPhaseTransition(this.skullPhase, newPhase);
      this.skullPhase = newPhase;
      return;
    }

    if (this.transitioning) {
      this.updateTransition(dt, now, playerPos);
      return;
    }

    const phaseConfig = this.getMinotaurPhaseConfig();

    if (this.isCharging) {
      // Charging: move fast in horizontal charge direction
      this.chargeTimer -= dt;
      if (this.chargeTimer <= 0) {
        this.isCharging = false;
        this.groundSlam(playerPos);
      } else {
        this.mesh.position.addScaledVector(this.chargeDirection, phaseConfig.chargeSpeed * dt);
      }
    } else {
      // Normal behavior
      this.chargeTimer -= dt;
      if (this.chargeTimer <= 0) {
        this.chargeTimer = this.chargeDuration / this.skullPhase;
        this.startCharge(playerPos);
      }

      // Horn shards
      this.shardTimer -= dt;
      if (this.shardTimer <= 0) {
        this.shardTimer = phaseConfig.shardRate;
        this.fireHornShards(playerPos);
      }

      // Ground slam
      this.slamTimer -= dt;
      if (this.slamTimer <= 0) {
        this.slamTimer = phaseConfig.slamRate;
        this.groundSlam(playerPos);
      }

      // Fast horizontal dodging: direction flips on timer
      this.moveTimer += dt;
      if (this.moveTimer >= phaseConfig.erraticness) {
        this.moveTimer = 0;
        // Pick a new direction perpendicular to the boss→player line
        // for strafing/dodge-feel, with some randomness
        const toPlayer = new THREE.Vector3().subVectors(playerPos, this.mesh.position);
        toPlayer.y = 0;
        if (toPlayer.lengthSq() > 0.01) toPlayer.normalize();
        // Perpendicular direction (left or right of player)
        const perp = new THREE.Vector3(-toPlayer.z, 0, toPlayer.x);
        // Flip or randomize direction
        const side = this.moveDirection.dot(perp) < 0 ? 1 : -1;
        if (Math.random() < 0.3) {
          // Occasionally dodge directly toward/away
          const angle = Math.random() * Math.PI * 2;
          this.moveDirection.set(Math.sin(angle), 0, Math.cos(angle));
        } else {
          // Strafe perpendicular
          this.moveDirection.copy(perp).multiplyScalar(side);
        }
      }
      this.mesh.position.addScaledVector(this.moveDirection, phaseConfig.moveSpeed * dt);
    }

    this.constrainToMidfield(playerPos);
    this.mesh.position.y = this.fixedY;
    this.mesh.lookAt(_look.copy(playerPos).setY(this.fixedY));
  }

  getMinotaurPhaseConfig() {
    switch (this.skullPhase) {
      case 1: // Phase 1: Fast lateral dodging
        return {
          moveSpeed: 6.0,
          chargeSpeed: 8.0,
          shardRate: 0.7,
          slamRate: 5.0,
          erraticness: 0.8
        };
      case 2: // Phase 2: Faster, more aggressive
        return {
          moveSpeed: 9.0,
          chargeSpeed: 12.0,
          shardRate: 0.5,
          slamRate: 3.5,
          erraticness: 0.5
        };
      case 3: // Phase 3: Very fast, relentless
        return {
          moveSpeed: 13.0,
          chargeSpeed: 16.0,
          shardRate: 0.35,
          slamRate: 2.5,
          erraticness: 0.3
        };
      default:
        return {
          moveSpeed: 6.0,
          chargeSpeed: 8.0,
          shardRate: 0.7,
          slamRate: 5.0,
          erraticness: 0.8
        };
    }
  }

  startPhaseTransition(fromPhase, toPhase) {
    this.transitioning = true;
    this.transitionTimer = 0;
    this.transitionFromPhase = fromPhase;
    this.transitionToPhase = toPhase;

    // Sound effects
    playSkullPhaseSound();
    playSkullHandGrowlSound();

    _log(`[MinotaurBoss] Phase transition: ${fromPhase} -> ${toPhase} (3-sec invuln)`);
  }

  updateTransition(dt, now, playerPos) {
    this.transitionTimer += dt;

    // Stop movement and attacking during transition
    // Pulsing scale effect
    const pulse = 1.0 + 0.15 * Math.sin(this.transitionTimer * 8.0);
    this.mesh.scale.setScalar(pulse);

    // Horn glow pulsing
    const hornGlow = 0.4 + 0.6 * Math.abs(Math.sin(this.transitionTimer * 6.0));
    this.hornShards.forEach(hornGroup => {
      hornGroup.traverse(child => {
        if (child.isMesh && child.material) {
          child.material.opacity = hornGlow;
        }
      });
    });

    // Transition complete
    if (this.transitionTimer >= this.transitionDuration) {
      this.transitioning = false;
      this.mesh.scale.setScalar(1.0);

      // Reset horn opacity
      this.hornShards.forEach(hornGroup => {
        hornGroup.traverse(child => {
          if (child.isMesh && child.material) {
            child.material.opacity = 0.9;
          }
        });
      });

      this.onMinotaurPhaseChange(this.transitionToPhase);
      _log(`[MinotaurBoss] Transition complete, now in phase ${this.transitionToPhase}`);
    }
  }

  constrainToMidfield(playerPos) {
    // Stay in a fixed arena, mid-field from player
    const dist = this.mesh.position.distanceTo(playerPos);

    // Stay between 6 and 14 units from player
    if (dist < 6) {
      const awayDir = this.mesh.position.clone().sub(playerPos).normalize();
      awayDir.y = 0;
      if (awayDir.lengthSq() > 0) awayDir.normalize();
      this.mesh.position.addScaledVector(awayDir, (6 - dist));
    } else if (dist > 14) {
      const towardDir = playerPos.clone().sub(this.mesh.position).normalize();
      towardDir.y = 0;
      if (towardDir.lengthSq() > 0) towardDir.normalize();
      this.mesh.position.addScaledVector(towardDir, (dist - 14));
    }

    // Keep in play area bounds
    const bound = 15;
    this.mesh.position.x = Math.max(-bound, Math.min(bound, this.mesh.position.x));
    this.mesh.position.z = Math.max(-bound, Math.min(bound, this.mesh.position.z));
    this.mesh.position.y = this.fixedY;
  }

  onMinotaurPhaseChange(newPhase) {
    const config = this.getMinotaurPhaseConfig();
    this.shardRate = config.shardRate;
    this.slamRate = config.slamRate;
    this.chargeDuration = newPhase === 3 ? 1.5 : newPhase === 2 ? 2.0 : 2.5;
    _log(`[MinotaurBoss] Phase ${newPhase} config applied: speed=${config.moveSpeed}, chargeSpeed=${config.chargeSpeed}`);
  }

  startCharge(playerPos) {
    this.isCharging = true;
    // Horizontal-only charge direction (XZ plane)
    this.chargeDirection = playerPos.clone().sub(this.mesh.position);
    this.chargeDirection.y = 0;
    this.chargeDirection.normalize();

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
    const shardCount = 8 + this.skullPhase * 2;
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
    // Immune during phase transitions
    if (this.transitioning) {
      return { killed: false, immune: true };
    }

    let damageTaken = amount;

    // Minotaur takes reduced damage while charging
    if (this.isCharging) {
      damageTaken = amount * 0.4;
    }

    return super.takeDamage(damageTaken, hitInfo);
  }

  onPhaseChange(newPhase) {
    // Phase changes are handled by the skullPhase system
    // This is kept for Boss base class compatibility
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

// ── THE PRISM BOSS (Level 10) ─────────────────────────────────
class PrismBoss extends Boss {
  constructor(def, levelConfig, sceneRef, telegraphing) {
    super(def, levelConfig, sceneRef, telegraphing);

    // Phase system state (same pattern as MinotaurBoss)
    this.skullPhase = 0;
    this.transitioning = false;
    this.transitionTimer = 0;
    this.transitionDuration = 3.0;
    this.transitionFromPhase = 0;
    this.transitionToPhase = 0;
    this.moveTimer = 0;
    this.moveDirection = new THREE.Vector3();
    this.fixedY = 1.5;

    // Phase 1 state
    this.facets = [];
    this.vulnerableFacetIndex = 0;
    this.facetRotateTimer = 0;
    this.facetRotateRate = 4.0;
    this.healAmount = 15;
    this.facetHps = [350, 350, 350, 350];
    this.facetsDestroyed = 0;

    // Phase 2 state
    this.shards = [];
    this.coreShardIndex = 0;
    this.coreSwapTimer = 0;
    this.coreSwapRate = 5.0;
    this.mergeTimer = 0;
    this.mergeRate = 12.0;
    this.isMerged = false;
    this.mergeCooldownTimer = 0;
    this.shootTimer = 0;

    // Phase 3 state
    this.healChargeTimer = 0;
    this.healChargeRate = 15.0;
    this.isHealCharging = false;
    this.healChargeDuration = 5.0;
    this.healChargeProgress = 0;
    this.healWeakPoints = [];
    this.weakPointsHit = 0;
    this.healAttempts = 0;
    this.phase3ShootTimer = 0;

    // Build custom visuals
    this.buildPrismMesh();
    this.buildFacets();
  }

  buildPrismMesh() {
    // Clear default mesh children
    while (this.mesh.children.length > 0) {
      this.mesh.remove(this.mesh.children[0]);
    }

    this.prismBody = new THREE.Group();
    const geo = getGeo(0.25);
    const mat = new THREE.MeshBasicMaterial({
      color: 0xff44ff, transparent: true, opacity: 0.4
    });

    // Octahedron: 2 top, 4 middle, 2 bottom
    const positions = [
      [0, 0.75, 0], [0, 0.5, 0],           // top
      [-0.25, 0.25, 0], [0.25, 0.25, 0],    // middle upper
      [-0.25, -0.25, 0], [0.25, -0.25, 0],  // middle lower
      [0, -0.5, 0], [0, -0.75, 0]           // bottom
    ];

    positions.forEach(pos => {
      const cube = new THREE.Mesh(geo, mat.clone());
      cube.position.set(pos[0], pos[1], pos[2]);
      cube.userData.isBossBody = true;
      this.prismBody.add(cube);
    });

    this.mesh.add(this.prismBody);
  }

  buildFacets() {
    const facetColors = [0xff2222, 0x2222ff, 0x22ff22, 0xffff22];
    // Position facets on 4 faces of the prism (front, back, left, right)
    const facetPositions = [
      [0, 0, 0.35],   // front
      [0, 0, -0.35],  // back
      [0.35, 0, 0],   // right
      [-0.35, 0, 0]   // left
    ];
    const facetRotations = [
      [0, 0, 0],
      [0, Math.PI, 0],
      [0, Math.PI / 2, 0],
      [0, -Math.PI / 2, 0]
    ];

    const geo = getGeo(0.18);

    for (let i = 0; i < 4; i++) {
      const facetGroup = new THREE.Group();
      const mat = new THREE.MeshBasicMaterial({
        color: facetColors[i], transparent: true, opacity: 0.9
      });

      // Flat pattern of 6 cubes (2 rows x 3 cols)
      const offsets = [
        [-0.1, 0.1, 0], [0, 0.1, 0], [0.1, 0.1, 0],
        [-0.1, -0.1, 0], [0, -0.1, 0], [0.1, -0.1, 0]
      ];

      offsets.forEach(off => {
        const cube = new THREE.Mesh(geo, mat.clone());
        cube.position.set(off[0], off[1], off[2]);
        cube.userData.isFacet = true;
        cube.userData.facetIndex = i;
        facetGroup.add(cube);
      });

      facetGroup.position.set(facetPositions[i][0], facetPositions[i][1], facetPositions[i][2]);
      facetGroup.rotation.set(facetRotations[i][0], facetRotations[i][1], facetRotations[i][2]);
      facetGroup.userData.isFacet = true;
      facetGroup.userData.facetIndex = i;

      this.facets.push(facetGroup);
      this.mesh.add(facetGroup);
    }

    // Mark first facet as vulnerable
    this.updateVulnerableFacet(0);
  }

  updateVulnerableFacet(newIndex) {
    // Remove weak point from old facet
    if (this.facets[this.vulnerableFacetIndex]) {
      this.facets[this.vulnerableFacetIndex].traverse(child => {
        child.userData.isWeakPoint = false;
      });
      // Remove glow
      const oldGlow = this.facets[this.vulnerableFacetIndex].getObjectByName('facetGlow');
      if (oldGlow) this.facets[this.vulnerableFacetIndex].remove(oldGlow);
    }

    this.vulnerableFacetIndex = newIndex;

    // Add weak point and glow to new facet
    const facet = this.facets[newIndex];
    if (facet) {
      facet.traverse(child => {
        child.userData.isWeakPoint = true;
      });

      // White glow outline
      const glowGeo = getGeo(0.22);
      const glowMat = new THREE.MeshBasicMaterial({
        color: 0xffffff, transparent: true, opacity: 0.6
      });
      const glow = new THREE.Mesh(glowGeo, glowMat);
      glow.name = 'facetGlow';
      glow.position.set(0, 0, 0.02);
      facet.add(glow);
    }
  }

  // ── PHASE 1: Learn the Angles ───────────────────────────
  initPhase1() {
    this.skullPhase = 1;
    this.phase = 1;
    this.facetRotateTimer = 0;
    this.shootTimer = 0;
    _log('[PrismBoss] Entering Phase 1: Learn the Angles');
  }

  updatePhase1(dt, now, playerPos) {
    const config = this.getPrismPhaseConfig();

    // Facet rotation timer
    this.facetRotateTimer += dt;
    if (this.facetRotateTimer >= this.facetRotateRate) {
      this.facetRotateTimer = 0;
      // Pick a new vulnerable facet (different from current)
      let newIdx;
      do {
        newIdx = Math.floor(Math.random() * 4);
      } while (newIdx === this.vulnerableFacetIndex && this.facetsDestroyed < 3);
      this.updateVulnerableFacet(newIdx);
    }

    // Fire projectiles from non-vulnerable facets
    this.shootTimer -= dt;
    if (this.shootTimer <= 0) {
      this.shootTimer = config.shootRate;
      this.firePhase1Projectiles(playerPos);
    }

    // Movement: slow horizontal drift
    this.moveTimer += dt;
    if (this.moveTimer >= config.erraticness) {
      this.moveTimer = 0;
      const angle = Math.random() * Math.PI * 2;
      this.moveDirection.set(Math.sin(angle), 0, Math.cos(angle));
    }
    this.mesh.position.addScaledVector(this.moveDirection, config.moveSpeed * dt);

    this.constrainToMidfield(playerPos);
    this.mesh.position.y = this.fixedY;
  }

  firePhase1Projectiles(playerPos) {
    for (let i = 0; i < 4; i++) {
      if (i === this.vulnerableFacetIndex) continue;
      if (!this.facets[i] || !this.facets[i].visible) continue;

      // Fire from this non-vulnerable facet
      const facetPos = this.facets[i].getWorldPosition(new THREE.Vector3());
      if (this.telegraphing) {
        this.showTelegraph('projectile', 0.3, 0xff44ff, facetPos);
      }

      const facetIdx = i;
      setTimeout(() => {
        if (typeof spawnBossProjectile === 'function') {
          spawnBossProjectile(facetPos, playerPos.clone());
        }
      }, 300);
    }
  }

  // ── PHASE 2: The Split ──────────────────────────────────
  initPhase2() {
    this.skullPhase = 2;
    this.phase = 2;
    this.shootTimer = 0;
    this.coreSwapTimer = 0;
    this.mergeTimer = 0;
    this.isMerged = false;
    this.mergeCooldownTimer = 3.0; // Small delay before first merge

    // Hide prism body and facets
    if (this.prismBody) this.prismBody.visible = false;
    this.facets.forEach(f => { if (f) f.visible = false; });

    // Create shards
    this.createShards();
    _log('[PrismBoss] Entering Phase 2: The Split');
  }

  createShards() {
    const shardColors = [0xff2222, 0x2222ff, 0x22ff22];
    const orbitRadii = [2.0, 3.5, 5.0];
    const orbitSpeeds = [1.2, 0.8, 0.5];
    const orbitHeights = [0, 1.5, -1.0];

    for (let i = 0; i < 3; i++) {
      const shard = new THREE.Group();
      const geo = getGeo(0.2);
      const mat = new THREE.MeshBasicMaterial({
        color: shardColors[i], transparent: true, opacity: 0.8
      });
      for (let j = 0; j < 4; j++) {
        const cube = new THREE.Mesh(geo, mat.clone());
        cube.position.set(
          (j % 2) * 0.2 - 0.1,
          Math.floor(j / 2) * 0.2,
          0
        );
        shard.add(cube);
      }

      // Core indicator (white dot)
      const coreGeo = new THREE.SphereGeometry(0.08, 6, 6);
      const coreMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
      const core = new THREE.Mesh(coreGeo, coreMat);
      core.name = 'prism-weak-point-core';
      core.visible = (i === 0);
      core.userData.isWeakPoint = (i === 0);
      core.userData.isPrismCore = true;
      shard.add(core);

      shard.userData.shardIndex = i;
      shard.userData.orbitRadius = orbitRadii[i];
      shard.userData.orbitSpeed = orbitSpeeds[i];
      shard.userData.orbitHeight = orbitHeights[i];
      shard.userData.angle = (i / 3) * Math.PI * 2;

      this.shards.push(shard);
      this.mesh.add(shard);
    }
  }

  updatePhase2(dt, now, playerPos) {
    const config = this.getPrismPhaseConfig();

    // Core swap timer
    this.coreSwapTimer += dt;
    if (this.coreSwapTimer >= this.coreSwapRate) {
      this.coreSwapTimer = 0;
      this.swapCore();
    }

    // Merge/split cycle
    this.mergeCooldownTimer -= dt;
    this.mergeTimer += dt;
    if (!this.isMerged && this.mergeTimer >= this.mergeRate && this.mergeCooldownTimer <= 0) {
      this.startMerge();
    }

    if (this.isMerged) {
      // During merge: invulnerable, merge lasts 3 seconds from startMerge
      // mergeTimer was reset to this.mergeRate in startMerge, so check for +3.0
      if (this.mergeTimer >= this.mergeRate + 3.0) {
        this.endMerge();
      }
      return;
    }

    // Update shard positions (orbiting)
    this.shards.forEach(shard => {
      shard.userData.angle += shard.userData.orbitSpeed * dt;
      const a = shard.userData.angle;
      const r = shard.userData.orbitRadius;
      shard.position.set(
        Math.cos(a) * r,
        shard.userData.orbitHeight,
        Math.sin(a) * r
      );
      shard.lookAt(_look.copy(playerPos).setY(shard.userData.orbitHeight));
    });

    // Shooting
    this.shootTimer -= dt;
    if (this.shootTimer <= 0) {
      this.shootTimer = config.shootRate;
      this.fireShardProjectiles(playerPos);
    }

    // Movement
    this.moveTimer += dt;
    if (this.moveTimer >= config.erraticness) {
      this.moveTimer = 0;
      const angle = Math.random() * Math.PI * 2;
      this.moveDirection.set(Math.sin(angle), 0, Math.cos(angle));
    }
    this.mesh.position.addScaledVector(this.moveDirection, config.moveSpeed * dt);
    this.constrainToMidfield(playerPos);
    this.mesh.position.y = this.fixedY;
  }

  swapCore() {
    // Remove core from old shard
    this.shards.forEach(shard => {
      shard.traverse(child => {
        if (child.userData.isPrismCore) {
          child.visible = false;
          child.userData.isWeakPoint = false;
        }
      });
    });

    // Pick new core shard (different from current)
    let newIdx;
    do {
      newIdx = Math.floor(Math.random() * 3);
    } while (newIdx === this.coreShardIndex);
    this.coreShardIndex = newIdx;

    // Flash telegraph
    if (this.telegraphing) {
      this.showTelegraph('teleport', 0.3, 0xffffff);
    }

    // Enable core on new shard
    this.shards[newIdx].traverse(child => {
      if (child.userData.isPrismCore) {
        child.visible = true;
        child.userData.isWeakPoint = true;
      }
    });
  }

  startMerge() {
    this.isMerged = true;
    this.mergeTimer = this.mergeRate; // Lock timer at merge start

    // Telegraph merge
    if (this.telegraphing) {
      this.showTelegraph('charge', 1.0, 0xff44ff);
    }
    playSkullHandGrowlSound();

    // Move shards to center
    this.shards.forEach(shard => {
      shard.position.set(0, 0, 0);
    });

    // Fire ring of 8 projectiles outward after short delay
    setTimeout(() => {
      for (let i = 0; i < 8; i++) {
        const angle = (i / 8) * Math.PI * 2;
        const targetPos = new THREE.Vector3(
          this.mesh.position.x + Math.cos(angle) * 10,
          this.mesh.position.y,
          this.mesh.position.z + Math.sin(angle) * 10
        );
        if (typeof spawnBossProjectile === 'function') {
          spawnBossProjectile(this.mesh.position.clone(), targetPos);
        }
      }
    }, 1500);
  }

  endMerge() {
    this.isMerged = false;
    this.mergeTimer = 0;
    this.mergeCooldownTimer = 3.0;
  }

  fireShardProjectiles(playerPos) {
    const config = this.getPrismPhaseConfig();
    this.shards.forEach((shard, idx) => {
      if (!shard.visible && shard.parent) return;
      const shardPos = shard.getWorldPosition(new THREE.Vector3());

      if (this.telegraphing) {
        this.showTelegraph('projectile', 0.2, 0xff44ff, shardPos);
      }

      setTimeout(() => {
        if (typeof spawnBossProjectile !== 'function') return;

        if (idx === 0) {
          // Inner: rapid single shot
          spawnBossProjectile(shardPos, playerPos.clone());
        } else if (idx === 1) {
          // Middle: 3-shot spread
          for (let s = -1; s <= 1; s++) {
            const target = playerPos.clone();
            target.x += s * 0.5;
            target.y += s * 0.2;
            spawnBossProjectile(shardPos, target);
          }
        } else {
          // Outer: slow big shot (just fires one aimed at player)
          spawnBossProjectile(shardPos, playerPos.clone());
        }
      }, 200);
    });
  }

  // ── PHASE 3: Overload ───────────────────────────────────
  initPhase3() {
    this.skullPhase = 3;
    this.phase = 3;
    this.isHealCharging = false;
    this.healChargeTimer = 0;
    this.phase3ShootTimer = 0;

    // Show prism body again (damaged look - darker color)
    if (this.prismBody) {
      this.prismBody.visible = true;
      this.prismBody.traverse(child => {
        if (child.isMesh && child.material) {
          child.material.color.setHex(0x881188);
          child.material.opacity = 0.6;
        }
      });
    }

    // Hide shards
    this.shards.forEach(shard => {
      shard.traverse(child => {
        if (child.userData.isPrismCore) {
          child.visible = true;
          child.userData.isWeakPoint = true;
        }
      });
    });

    _log('[PrismBoss] Entering Phase 3: Overload');
  }

  updatePhase3(dt, now, playerPos) {
    const config = this.getPrismPhaseConfig();

    // Continuous projectile fire (increasing rate based on heal attempts)
    let shootRate = config.shootRate;
    if (this.healAttempts >= 1) shootRate *= 0.85;
    if (this.healAttempts >= 2) shootRate *= 0.85;
    if (this.healAttempts >= 3) shootRate *= 0.8;

    this.phase3ShootTimer -= dt;
    if (this.phase3ShootTimer <= 0 && !this.isHealCharging) {
      this.phase3ShootTimer = shootRate;
      this.firePhase3Projectiles(playerPos);
    }

    // Heal charge mechanic
    if (!this.isHealCharging) {
      this.healChargeTimer += dt;
      if (this.healChargeTimer >= this.healChargeRate) {
        this.startHealCharge();
      }
    } else {
      this.healChargeProgress += dt;
      // Update heal weak point orbits
      this.healWeakPoints.forEach((wp, idx) => {
        if (!wp.parent) return;
        wp.userData.angle += (1.5 + idx * 0.5) * dt;
        const r = 1.5 + idx * 0.3;
        wp.position.set(
          Math.cos(wp.userData.angle) * r,
          0.5 + idx * 0.4,
          Math.sin(wp.userData.angle) * r
        );
      });

      // Check if all weak points hit
      if (this.weakPointsHit >= 3) {
        this.cancelHealCharge();
      } else if (this.healChargeProgress >= this.healChargeDuration) {
        // Timer expired: boss heals
        this.completeHealCharge();
      }
    }

    // Movement
    this.moveTimer += dt;
    if (this.moveTimer >= config.erraticness) {
      this.moveTimer = 0;
      const angle = Math.random() * Math.PI * 2;
      this.moveDirection.set(Math.sin(angle), 0, Math.cos(angle));
    }
    this.mesh.position.addScaledVector(this.moveDirection, config.moveSpeed * dt);
    this.constrainToMidfield(playerPos);
    this.mesh.position.y = this.fixedY;
  }

  firePhase3Projectiles(playerPos) {
    const bossPos = this.mesh.position.clone();

    if (this.telegraphing) {
      this.showTelegraph('projectile', 0.2, 0xff44ff, bossPos);
    }

    setTimeout(() => {
      if (typeof spawnBossProjectile !== 'function') return;
      spawnBossProjectile(bossPos, playerPos.clone());

      // Spread shots after heal attempt 2
      if (this.healAttempts >= 2) {
        for (let s = -1; s <= 1; s += 2) {
          const target = playerPos.clone();
          target.x += s * 0.6;
          target.y += s * 0.2;
          spawnBossProjectile(bossPos, target);
        }
      }
    }, 200);
  }

  startHealCharge() {
    this.isHealCharging = true;
    this.healChargeProgress = 0;
    this.weakPointsHit = 0;
    this.healWeakPoints = [];

    // Telegraph
    if (this.telegraphing) {
      this.showTelegraph('charge', 0.5, 0x00ff00);
    }
    playSkullPhaseSound();

    // Spawn 3 orbiting weak points
    for (let i = 0; i < 3; i++) {
      const wpGeo = new THREE.SphereGeometry(0.15, 8, 8);
      const wpMat = new THREE.MeshBasicMaterial({
        color: 0xffffff, emissive: 0xffffff
      });
      // MeshBasicMaterial doesn't have emissive in practice, but we set color bright
      const wp = new THREE.Mesh(wpGeo, wpMat);
      wp.name = 'prism-heal-weak-point';
      wp.userData.isWeakPoint = true;
      wp.userData.isHealWeakPoint = true;
      wp.userData.healWeakPointIndex = i;
      wp.userData.angle = (i / 3) * Math.PI * 2;

      this.healWeakPoints.push(wp);
      this.weakPoints.push(wp);
      this.mesh.add(wp);
    }

    _log('[PrismBoss] Heal charge started! Hit the 3 weak points!');
  }

  cancelHealCharge() {
    this.isHealCharging = false;
    this.healChargeTimer = 0;
    playSkullHandGrowlSound();
    this.cleanupHealWeakPoints();
    _log('[PrismBoss] Heal charge cancelled! All weak points hit.');
  }

  completeHealCharge() {
    this.isHealCharging = false;
    this.healChargeTimer = 0;
    this.healAttempts++;

    // Heal 25% HP
    const healAmount = Math.floor(this.maxHp * 0.25);
    this.hp = Math.min(this.maxHp, this.hp + healAmount);
    playSkullPhaseSound();
    this.cleanupHealWeakPoints();

    // Update health bar
    if (typeof updateBossHealthBar === 'function') {
      updateBossHealthBar(this.hp, this.maxHp, this.phases);
    }

    _log(`[PrismBoss] Heal complete! +${healAmount} HP. Attempt #${this.healAttempts}`);
  }

  cleanupHealWeakPoints() {
    this.healWeakPoints.forEach(wp => {
      // Remove from weakPoints array
      const wpIdx = this.weakPoints.indexOf(wp);
      if (wpIdx !== -1) this.weakPoints.splice(wpIdx, 1);
      // Remove from scene
      if (wp.parent) wp.parent.remove(wp);
      if (wp.geometry) wp.geometry.dispose();
      if (wp.material) wp.material.dispose();
    });
    this.healWeakPoints = [];
  }

  onHealWeakPointHit(wp) {
    this.weakPointsHit++;
    playSkullHandGrowlSound();

    // Remove this weak point
    const idx = this.healWeakPoints.indexOf(wp);
    if (idx !== -1) this.healWeakPoints.splice(idx, 1);
    const wpIdx = this.weakPoints.indexOf(wp);
    if (wpIdx !== -1) this.weakPoints.splice(wpIdx, 1);
    if (wp.parent) wp.parent.remove(wp);
    if (wp.geometry) wp.geometry.dispose();
    if (wp.material) wp.material.dispose();
  }

  // ── PHASE TRANSITIONS ────────────────────────────────────
  startPhaseTransition(fromPhase, toPhase) {
    this.transitioning = true;
    this.transitionTimer = 0;
    this.transitionFromPhase = fromPhase;
    this.transitionToPhase = toPhase;

    playSkullPhaseSound();
    playSkullHandGrowlSound();

    // Clean up shards if leaving phase 2
    if (fromPhase === 2) {
      this.shards.forEach(shard => {
        if (shard.parent) shard.parent.remove(shard);
        shard.traverse(child => {
          if (child.geometry) child.geometry.dispose();
          if (child.material) child.material.dispose();
        });
      });
      this.shards = [];
    }

    _log(`[PrismBoss] Phase transition: ${fromPhase} -> ${toPhase}`);
  }

  updateTransition(dt, now, playerPos) {
    this.transitionTimer += dt;

    // Pulsing scale effect
    const pulse = 1.0 + 0.15 * Math.sin(this.transitionTimer * 8.0);
    this.mesh.scale.setScalar(pulse);

    // Body glow pulsing
    if (this.prismBody) {
      const glow = 0.2 + 0.6 * Math.abs(Math.sin(this.transitionTimer * 6.0));
      this.prismBody.traverse(child => {
        if (child.isMesh && child.material) {
          child.material.opacity = glow;
        }
      });
    }

    // Transition complete
    if (this.transitionTimer >= this.transitionDuration) {
      this.transitioning = false;
      this.mesh.scale.setScalar(1.0);

      // Reset body opacity
      if (this.prismBody) {
        this.prismBody.traverse(child => {
          if (child.isMesh && child.material) {
            child.material.opacity = 0.4;
          }
        });
      }

      // Enter new phase
      if (this.transitionToPhase === 1) this.initPhase1();
      else if (this.transitionToPhase === 2) this.initPhase2();
      else if (this.transitionToPhase === 3) this.initPhase3();

      _log(`[PrismBoss] Transition complete, now in phase ${this.transitionToPhase}`);
    }
  }

  getPrismPhaseConfig() {
    switch (this.skullPhase) {
      case 1:
        return { moveSpeed: 1.0, shootRate: 1.5, erraticness: 3.0, facetRotateRate: 4.0 };
      case 2:
        return { moveSpeed: 1.5, shootRate: 1.0, erraticness: 2.0, coreSwapRate: 5.0, mergeRate: 12.0 };
      case 3:
        return { moveSpeed: 2.0, shootRate: 0.7, erraticness: 1.5, healChargeRate: 15.0, healChargeDuration: 5.0 };
      default:
        return { moveSpeed: 1.0, shootRate: 1.5, erraticness: 3.0 };
    }
  }

  constrainToMidfield(playerPos) {
    const dist = this.mesh.position.distanceTo(playerPos);
    if (dist < 6) {
      const awayDir = this.mesh.position.clone().sub(playerPos).normalize();
      awayDir.y = 0;
      if (awayDir.lengthSq() > 0) awayDir.normalize();
      this.mesh.position.addScaledVector(awayDir, (6 - dist));
    } else if (dist > 14) {
      const towardDir = playerPos.clone().sub(this.mesh.position).normalize();
      towardDir.y = 0;
      if (towardDir.lengthSq() > 0) towardDir.normalize();
      this.mesh.position.addScaledVector(towardDir, (dist - 14));
    }
    const bound = 15;
    this.mesh.position.x = Math.max(-bound, Math.min(bound, this.mesh.position.x));
    this.mesh.position.z = Math.max(-bound, Math.min(bound, this.mesh.position.z));
    this.mesh.position.y = this.fixedY;
  }

  // ── UPDATE LOOP ──────────────────────────────────────────
  updateBehavior(dt, now, playerPos) {
    if (this.transitioning) {
      this.updateTransition(dt, now, playerPos);
      this.mesh.lookAt(_look.copy(playerPos).setY(this.fixedY));
      return;
    }

    switch (this.skullPhase) {
      case 0: this.initPhase1(); break;
      case 1: this.updatePhase1(dt, now, playerPos); break;
      case 2: this.updatePhase2(dt, now, playerPos); break;
      case 3: this.updatePhase3(dt, now, playerPos); break;
    }

    this.mesh.lookAt(_look.copy(playerPos).setY(this.fixedY));
  }

  takeDamage(amount, hitInfo = {}) {
    // Immune during phase transitions
    if (this.transitioning) return { killed: false, immune: true };

    // Phase 1: facet targeting
    if (this.skullPhase === 1) {
      if (hitInfo.facetIndex !== undefined && hitInfo.facetIndex !== this.vulnerableFacetIndex) {
        // Wrong facet: heal boss
        this.hp = Math.min(this.maxHp, this.hp + this.healAmount);
        playSkullHandGrowlSound();
        return { killed: false, healed: true };
      }
      // Right facet (or non-facet body hit): damage facet + reduce boss HP
      if (hitInfo.facetIndex === this.vulnerableFacetIndex) {
        const facetIdx = hitInfo.facetIndex;
        this.facetHps[facetIdx] -= amount;
        if (this.facetHps[facetIdx] <= 0 && this.facets[facetIdx]) {
          if (this.facets[facetIdx].visible) {
            this.facets[facetIdx].visible = false;
            this.facetsDestroyed++;
            playSkullHandGrowlSound();
          }
        }
      }
      // Always reduce boss HP in Phase 1 (so health bar depletes)
      this.hp -= amount;
      if (this.hp < 0) this.hp = 0;

      // Phase 1 -> 2 transition when enough facets destroyed OR HP drops below 2/3
      const hpThreshold23 = this.maxHp * (2 / 3);
      if (this.facetsDestroyed >= 2 || this.hp <= hpThreshold23) {
        this.startPhaseTransition(1, 2);
        this.skullPhase = 2;
      }

      if (this.hp <= 0) {
        return { killed: true };
      }
      return { killed: false, facetDamaged: true };
    }

    // Phase 2: damage goes to boss HP (merge = immune)
    if (this.skullPhase === 2) {
      if (this.isMerged) {
        return { killed: false, immune: true };
      }
      // Apply damage to boss HP
      this.hp -= amount;
      if (this.hp < 0) this.hp = 0;

      // Phase 2 -> 3 transition when HP drops below 1/3
      const hpThreshold13 = this.maxHp * (1 / 3);
      if (this.hp > 0 && this.hp <= hpThreshold13) {
        this.startPhaseTransition(2, 3);
        this.skullPhase = 3;
      }

      if (this.hp <= 0) {
        return { killed: true };
      }
      return { killed: false };
    }

    // Phase 3: check if hitting heal weak points
    if (this.skullPhase === 3 && this.isHealCharging) {
      if (hitInfo.isHealWeakPoint) {
        // Find the matching weak point by healWeakPointIndex (not array index)
        const wpIndex = hitInfo.healWeakPointIndex;
        const wp = this.healWeakPoints.find(w => w.userData.healWeakPointIndex === wpIndex);
        if (wp) {
          this.onHealWeakPointHit(wp);
        }
        return { killed: false, healWeakPointHit: true };
      }
    }

    // Phase 3 default: standard damage to boss HP
    if (this.skullPhase === 3) {
      this.hp -= amount;
      if (this.hp < 0) this.hp = 0;
      if (this.hp <= 0) {
        return { killed: true };
      }
      return { killed: false };
    }

    // Fallback
    return super.takeDamage(amount, hitInfo);
  }

  onPhaseChange(newPhase) {
    // Phase changes are handled by skullPhase system
  }
}

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
    baseHp: 1800, // 3 bars of 600 HP each
    phases: 3, // Hand phase + 3 skull phases (total 4 phases, but only skull has health bars)
    color: 0xffffff, // Starts white, darkens to red
    scoreValue: 100,
    behavior: 'skull',
    hitboxRadius: 1.2,
    handHp: 150, // HP per hand
    handShootRate: 1.5, // Base shoot rate per hand (UNUSED now - shared ammo pool)
    eyeShootRate: 0.8, // Skull phase base shoot rate
    moveSpeed: 1.5, // Skull phase base movement speed
    weakPoints: false // Custom weak points (hands first, then head)
  },

  // The Prism (Level 10, replaces tier 2 pool)
  the_prism: {
    name: 'The Prism',
    pattern: [[1]],
    voxelSize: 0.25,
    baseHp: 1400,
    phases: 3,
    color: 0xff44ff,
    scoreValue: 200,
    behavior: 'prism',
    hitboxRadius: 1.0,
    contactDamage: 1,
    contactCooldown: 1200,
    weakPoints: true
  },

  // Level 15 boss (Tier 3)
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
  2: ['the_prism'], // Tier 2 (Level 10) - The Prism only
  3: ['neon_minotaur'], // Tier 3 (Level 15) - Neon Minotaur only
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
    case 'prism':
      boss = new PrismBoss(def, levelConfig, sceneRef, telegraphingSystem);
      break;
    case 'hunter':
      boss = new HunterBoss(def, levelConfig, sceneRef, telegraphingSystem);
      break;
    // Level 15 bosses
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
  clearBossMinions();

  if (activeBoss) {
    activeBoss.destroy();
    activeBoss = null;

    if (typeof hideBossHealthBar === 'function') {
      hideBossHealthBar();
    }
  }
}

/** Remove all boss minions from the scene and clear the array. */
export function clearBossMinions() {
  for (let i = bossMinions.length - 1; i >= 0; i--) {
    const m = bossMinions[i];
    if (m.mesh) {
      sceneRef.remove(m.mesh);
      m.mesh.traverse(c => {
        if (c.geometry) c.geometry.dispose();
        if (c.material) c.material.dispose();
      });
    }
  }
  bossMinions.length = 0;
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

  _log(`[boss] Spawned ${bossDebris.length} debris voxels`);
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
  group.renderOrder = 10;
  const def = ENEMY_DEFS[type] || ENEMY_DEFS.basic;
  const geo = getGeo(def.voxelSize);
  const mat = new THREE.MeshBasicMaterial({ color: def.color, transparent: true, opacity: 0.8, depthWrite: false, fog: false });

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

/**
 * Distance-only clamp (no look direction constraint).
 * Used for boss minions to prevent them from "following" player's head.
 */
function clampPositionToDistance(position, playerPos, minDist = 2, maxDist = 18) {
  const dx = position.x - playerPos.x;
  const dz = position.z - playerPos.z;
  const dist = Math.sqrt(dx * dx + dz * dz);
  if (dist > maxDist) {
    const s = maxDist / dist;
    position.x = playerPos.x + dx * s;
    position.z = playerPos.z + dz * s;
  } else if (dist < minDist && dist > 0.001) {
    const s = minDist / dist;
    position.x = playerPos.x + dx * s;
    position.z = playerPos.z + dz * s;
  }
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
    // Use distance-only clamp (not front-arc) to prevent minions from following player's look direction
    clampPositionToDistance(m.mesh.position, playerPos, 2.0, 18);
  }
}

// ── BOSS PROJECTILES (InstancedMesh pool) ───────────────────────
// Boss projectiles use TWO InstancedMesh pools (core + glow) sharing instance indices.
// This reduces draw calls from 2N (N projectiles × 2 meshes) to just 2.
const BOSS_PROJ_POOL_SIZE = 50;

let bossProjCorePool = null;   // InstancedMesh for core spheres (red)
let bossProjFreeIndices = [];  // Available instance indices
const bossProjData = [];       // Per-instance data (parallel to instance indices)
const _bossProjMatrix = new THREE.Matrix4();
const _bossProjScale = new THREE.Vector3();
const _identityQuat = new THREE.Quaternion();  // Identity rotation
const _unitScale = new THREE.Vector3(1, 1, 1);  // Unit scale for initial spawn

function initBossProjPools() {
  if (bossProjCorePool || !sceneRef) return;

  // Boss projectiles: bright red-orange spheres (core only, no glow to avoid depth artifacts)
  const coreGeo = new THREE.SphereGeometry(0.18, 8, 8);
  const coreMat = new THREE.MeshBasicMaterial({
    color: 0xff4400,
    transparent: true,
    opacity: 0.9,
    depthWrite: false,
    depthTest: true,
  });
  bossProjCorePool = new THREE.InstancedMesh(coreGeo, coreMat, BOSS_PROJ_POOL_SIZE);
  bossProjCorePool.name = 'boss-projectile-pool';
  bossProjCorePool.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  bossProjCorePool.count = 0;
  bossProjCorePool.frustumCulled = false;
  bossProjCorePool.renderOrder = 10;
  bossProjCorePool.visible = true;  // Ensure visible on init
  sceneRef.add(bossProjCorePool);

  // Initialize free indices (all available)
  for (let i = 0; i < BOSS_PROJ_POOL_SIZE; i++) {
    bossProjFreeIndices.push(i);
    bossProjData.push(null);
  }

  _log('[performance] Boss projectile InstancedMesh pool initialized (50 instances, 1 draw call)');
}

function acquireBossProjIndex() {
  if (bossProjFreeIndices.length === 0) {
    console.warn('[bossProj] Pool exhausted');
    return -1;
  }
  const idx = bossProjFreeIndices.pop();

  // Expand visible count if needed
  if (idx >= bossProjCorePool.count) {
    bossProjCorePool.count = idx + 1;
  }

  return idx;
}

export function releaseBossProjIndex(idx) {
  if (idx < 0 || idx >= BOSS_PROJ_POOL_SIZE) return;

  // Hide instance by scaling to 0
  _bossProjMatrix.makeScale(0, 0, 0);
  bossProjCorePool.setMatrixAt(idx, _bossProjMatrix);
  bossProjCorePool.instanceMatrix.needsUpdate = true;

  bossProjData[idx] = null;
  bossProjFreeIndices.push(idx);
}

// Legacy array for compatibility with getBossProjectiles()
const bossProjectiles = [];

export function clearBossProjectiles() {
  // Release all active instances
  for (let i = 0; i < bossProjData.length; i++) {
    if (bossProjData[i] !== null) {
      releaseBossProjIndex(i);
    }
  }
  bossProjectiles.length = 0;

  // Reset count to 0 so instances are properly hidden
  // (releasing scales them to 0, but count must also be reset)
  if (bossProjCorePool) {
    bossProjCorePool.count = 0;
    bossProjCorePool.visible = false;  // Hide pool between levels
    bossProjCorePool.instanceMatrix.needsUpdate = true;
  }

  // Reset free indices to initial state
  bossProjFreeIndices.length = 0;
  for (let i = 0; i < BOSS_PROJ_POOL_SIZE; i++) {
    bossProjFreeIndices.push(i);
    bossProjData[i] = null;
  }
}

export function spawnBossProjectile(fromPos, targetPos, lobbed = false, arcHeight = 3.5) {
  // Don't spawn if no active boss (prevents leaked projectiles during transitions)
  if (!activeBoss) return;

  // Initialize pools if needed (called once on first spawn)
  initBossProjPools();

  // Ensure pool is visible (clearBossProjectiles hides it between levels)
  if (bossProjCorePool && !bossProjCorePool.visible) {
    bossProjCorePool.visible = true;
  }

  // Acquire an instance slot
  const idx = acquireBossProjIndex();
  if (idx < 0) return; // Pool exhausted

  // Play sound when boss fires projectile
  playBossProjectileFiredSound();

  let velocity;
  let homingStrength;
  let wiggleAmplitude;

  if (lobbed) {
    // Lobbed projectile: arc trajectory aimed at player position
    const horizontalDir = new THREE.Vector3(
      targetPos.x - fromPos.x,
      0,
      targetPos.z - fromPos.z
    );
    const horizontalDist = horizontalDir.length();
    if (horizontalDist > 0.001) horizontalDir.normalize();

    const gravity = 9.8;
    const heightDiff = targetPos.y - fromPos.y;

    // Start with flight time proportional to horizontal distance
    let flightTime = Math.max(0.8, horizontalDist / 6.0);

    // Compute v0y so the projectile lands at targetPos.y at flightTime
    // y(T) = fromPos.y + v0y*T - 0.5*g*T^2 = targetPos.y
    // v0y = (heightDiff + 0.5*g*T^2) / T
    let initialUpSpeed = (heightDiff + 0.5 * gravity * flightTime * flightTime) / flightTime;

    // Ensure the arc peaks at least arcHeight above the launch position
    // Peak above launch = v0y^2 / (2*g)
    const peakAboveLaunch = (initialUpSpeed * initialUpSpeed) / (2 * gravity);
    if (peakAboveLaunch < arcHeight) {
      // Need a higher arc: increase flightTime so v0y produces >= arcHeight above launch
      const minV0y = Math.sqrt(2 * gravity * arcHeight);
      // Solve: minV0y = (heightDiff + 0.5*g*T^2) / T  =>  0.5*g*T^2 - minV0y*T + heightDiff = 0
      const disc = minV0y * minV0y - 2 * gravity * heightDiff;
      flightTime = disc >= 0
        ? (minV0y + Math.sqrt(disc)) / gravity
        : minV0y * 2 / gravity; // fallback for extreme cases
      flightTime = Math.max(flightTime, 0.8);
      initialUpSpeed = (heightDiff + 0.5 * gravity * flightTime * flightTime) / flightTime;
    }

    const horizontalSpeed = flightTime > 0.001 ? horizontalDist / flightTime : 0;

    velocity = new THREE.Vector3(
      horizontalDir.x * horizontalSpeed,
      initialUpSpeed,
      horizontalDir.z * horizontalSpeed
    );
    homingStrength = 0; // No homing for lobbed projectiles
    wiggleAmplitude = 0;
  } else {
    // Straight-line homing projectile (original behavior)
    const dir = new THREE.Vector3().copy(targetPos).sub(fromPos).normalize();
    const speed = 5.2;
    velocity = dir.multiplyScalar(speed);
    homingStrength = 8.0;
    wiggleAmplitude = 0.008;
  }

  // Store per-instance data
  const data = {
    instanceIndex: idx,
    position: fromPos.clone(),
    velocity: velocity,
    createdAt: performance.now(),
    lifetime: lobbed ? 6000 : 3600, // Lobbed projectiles live longer
    homingStrength: homingStrength,
    wigglePhase: Math.random() * Math.PI * 2,
    wiggleAmplitude: wiggleAmplitude,
    damage: 1,
    explosionDamage: 1,
    explosionRadius: 0.3,
    hitRadius: 0.45,
    hitPlayer: false,
    lobbed: lobbed,
    gravity: lobbed ? 9.8 : 0,
  };
  bossProjData[idx] = data;

  // Set initial matrix (position + unit scale)
  _bossProjMatrix.compose(fromPos, _identityQuat, _unitScale);
  bossProjCorePool.setMatrixAt(idx, _bossProjMatrix);
  bossProjCorePool.instanceMatrix.needsUpdate = true;

  // Create lightweight proxy for compatibility with getBossProjectiles()
  const proxy = {
    position: data.position,
    userData: { isBossProjectile: true },
  };
  bossProjectiles.push({
    mesh: proxy,
    _instIdx: idx,
    velocity: data.velocity,
    createdAt: data.createdAt,
    lifetime: data.lifetime,
    homingStrength: data.homingStrength,
    wigglePhase: data.wigglePhase,
    damage: data.damage,
    explosionDamage: data.explosionDamage,
    explosionRadius: data.explosionRadius,
    hitRadius: data.hitRadius,
    wiggleAmplitude: data.wiggleAmplitude,
    hitPlayer: false,
    lobbed: data.lobbed,
    gravity: data.gravity,
  });
}

// Convenience wrapper for lobbed projectiles (skull phase eye shots)
export function spawnBossLobbedProjectile(fromPos, targetPos, arcHeight = 3.5) {
  return spawnBossProjectile(fromPos, targetPos, true, arcHeight);
}

// Mortar enemy lobbed projectile (works without active boss)
export function spawnMortarProjectile(fromPos, targetPos, arcHeight = 2.0) {
  // Initialize pools if needed
  initBossProjPools();

  if (bossProjCorePool && !bossProjCorePool.visible) {
    bossProjCorePool.visible = true;
  }

  const idx = acquireBossProjIndex();
  if (idx < 0) return;

  // Lobbed trajectory calculation
  const horizontalDir = new THREE.Vector3(
    targetPos.x - fromPos.x,
    0,
    targetPos.z - fromPos.z
  );
  const horizontalDist = horizontalDir.length();
  if (horizontalDist > 0.001) horizontalDir.normalize();

  const gravity = 9.8;
  const heightDiff = targetPos.y - fromPos.y;
  let flightTime = Math.max(0.8, horizontalDist / 6.0);
  let initialUpSpeed = (heightDiff + 0.5 * gravity * flightTime * flightTime) / flightTime;

  const peakAboveLaunch = (initialUpSpeed * initialUpSpeed) / (2 * gravity);
  if (peakAboveLaunch < arcHeight) {
    const minV0y = Math.sqrt(2 * gravity * arcHeight);
    const a = 0.5 * gravity;
    const b = -heightDiff;
    const c = -(minV0y * minV0y) / (2 * gravity);
    const discriminant = b * b - 4 * a * c;
    if (discriminant >= 0) {
      const t1 = (-b + Math.sqrt(discriminant)) / (2 * a);
      const t2 = (-b - Math.sqrt(discriminant)) / (2 * a);
      flightTime = Math.max(t1, t2);
      if (flightTime <= 0) flightTime = Math.min(t1, t2);
      if (flightTime <= 0) flightTime = horizontalDist / 6.0;
    }
    initialUpSpeed = (heightDiff + 0.5 * gravity * flightTime * flightTime) / flightTime;
  }

  const velocity = new THREE.Vector3(
    horizontalDir.x * (horizontalDist / flightTime),
    initialUpSpeed,
    horizontalDir.z * (horizontalDist / flightTime)
  );

  const data = bossProjData[idx];
  if (!data) return;

  data.position.copy(fromPos);
  data.velocity.copy(velocity);
  data.homingStrength = 0;
  data.wigglePhase = 0;
  data.wiggleAmplitude = 0;
  data.damage = 1;
  data.explosionDamage = 0;
  data.explosionRadius = 0.3;
  data.hitRadius = 0.3;
  data.lobbed = true;
  data.gravity = gravity;

  _bossProjMatrix.compose(fromPos, _identityQuat, _unitScale);
  bossProjCorePool.setMatrixAt(idx, _bossProjMatrix);
  bossProjCorePool.instanceMatrix.needsUpdate = true;

  // Set color to red for mortar projectiles
  bossProjCorePool.setColorAt(idx, _mortarColorTmp.setHex(0xff0000));
  if (bossProjCorePool.instanceColor) bossProjCorePool.instanceColor.needsUpdate = true;

  const proxy = {
    position: data.position,
    userData: { isBossProjectile: true, isMortarProjectile: true },
  };
  bossProjectiles.push({
    _instIdx: idx,
    mesh: proxy,
    createdAt: performance.now(),
    lifetime: 6000,
    velocity: data.velocity,
    homingStrength: 0,
    wigglePhase: 0,
    damage: 1,
    explosionDamage: 0,
    explosionRadius: 0.3,
    hitRadius: 0.3,
    wiggleAmplitude: 0,
    hitPlayer: false,
    lobbed: true,
    gravity: gravity,
  });
}

export function updateBossProjectiles(dt, now, playerPos) {
  if (!bossProjCorePool) return;

  for (let i = bossProjectiles.length - 1; i >= 0; i--) {
    const proj = bossProjectiles[i];
    const idx = proj._instIdx;
    const data = bossProjData[idx];
    if (!data) {
      bossProjectiles.splice(i, 1);
      continue;
    }

    const age = now - proj.createdAt;

    if (age > proj.lifetime) {
      if (typeof window !== 'undefined' && window.createExplosionAt) {
        window.createExplosionAt(proj.mesh.position.clone(), proj.explosionRadius || 0.3, proj.explosionDamage || 0);
      }
      releaseBossProjIndex(idx);
      bossProjectiles.splice(i, 1);
      continue;
    }

    const slowFactor = getStasisSlowFactor(proj.mesh.position);
    const adjustedDt = dt * slowFactor;
    
    if (proj.lobbed) {
      // Lobbed projectile: apply gravity, no homing
      proj.velocity.y -= (proj.gravity || 9.8) * adjustedDt;
      proj.mesh.position.addScaledVector(proj.velocity, adjustedDt);
    } else {
      // Homing projectile: steer toward player
      const speed = proj.velocity.length();
      _scratch.subVectors(playerPos, proj.mesh.position).normalize();
      const desiredVelocity = _scratch.multiplyScalar(speed);
      proj.velocity.lerp(desiredVelocity, Math.min(1, (proj.homingStrength || 2.5) * adjustedDt));
      if (proj.velocity.lengthSq() > 0.0001) {
        proj.velocity.setLength(speed);
      }
      proj.mesh.position.addScaledVector(proj.velocity, adjustedDt);
    }

    proj.wigglePhase = (proj.wigglePhase || 0) + adjustedDt * 7.0;
    _scratch2.copy(proj.velocity).normalize();
    _scratch3.set(-_scratch2.z, 0, _scratch2.x);
    if (_scratch3.lengthSq() < 0.0001) _scratch3.set(1, 0, 0);
    _scratch3.normalize();
    const wiggleOffset = Math.sin(proj.wigglePhase) * (proj.wiggleAmplitude || 0.008);

    // Only add wiggle for non-lobbed (homing) projectiles
    if (!proj.lobbed) {
      proj.mesh.position.addScaledVector(_scratch3, wiggleOffset);
    }

    // Despawn lobbed projectiles that fall below ground
    if (proj.lobbed && proj.mesh.position.y < -2) {
      if (typeof window !== 'undefined' && window.createExplosionAt) {
        window.createExplosionAt(proj.mesh.position.clone(), proj.explosionRadius || 0.3, proj.explosionDamage || 0);
      }
      releaseBossProjIndex(idx);
      bossProjectiles.splice(i, 1);
      continue;
    }

    // Update instance matrix
    _bossProjScale.set(1, 1, 1);
    _bossProjMatrix.compose(proj.mesh.position, _identityQuat, _bossProjScale);
    bossProjCorePool.setMatrixAt(idx, _bossProjMatrix);

    // Proximity alert (Geiger-counter style) - plays at increasing rate as projectile gets closer
    const distToPlayer = proj.mesh.position.distanceTo(playerPos);
    if (distToPlayer < 8) {
      const alertInterval = 200 + (distToPlayer / 8) * 600; // 200ms at closest, 800ms at edge
      if (now - (proj._lastAlertTime || 0) > alertInterval) {
        playBossProjectileAlertSound();
        proj._lastAlertTime = now;
      }
    }

    if (distToPlayer < (proj.hitRadius || 0.45)) {
      proj.hitPlayer = true;
      if (typeof window !== 'undefined' && window.createExplosionAt) {
        window.createExplosionAt(proj.mesh.position.clone(), proj.explosionRadius || 0.3, proj.explosionDamage || 0);
      }
    }
  }

  // Mark buffer for GPU update
  bossProjCorePool.instanceMatrix.needsUpdate = true;
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
// Cached arrays for fast/swarm enemy lookups (avoid filter() allocation every frame)
let _cachedFastEnemies = [];
let _cachedSwarmEnemies = [];
let _enemyCacheDirty = true;

export function invalidateEnemyCache() { _enemyCacheDirty = true; }

function refreshEnemyCache() {
  if (!_enemyCacheDirty) return;
  _cachedFastEnemies.length = 0;
  _cachedSwarmEnemies.length = 0;
  for (let i = 0; i < activeEnemies.length; i++) {
    const e = activeEnemies[i];
    if (e.type === 'fast') _cachedFastEnemies.push(e);
    else if (e.type === 'swarm') _cachedSwarmEnemies.push(e);
  }
  _enemyCacheDirty = false;
}

export function getFastEnemies() {
  refreshEnemyCache();
  return _cachedFastEnemies;
}

/** Get all swarm enemies (for proximity alerts) */
export function getSwarmEnemies() {
  refreshEnemyCache();
  return _cachedSwarmEnemies;
}

