// ============================================================
//  ENEMY SYSTEM
//  Voxel enemies: spawning, movement, damage, death explosions.
// ============================================================

import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { getStasisSlowFactor } from './stasis.js';
import {
  playTingSound, playEnemyProjectileSound, playProjectileWarningSound,
  playBossProjectileFiredSound, playBossProjectileAlertSound,
  playPhaseWraithCharge as playMortarCharge,
  playSkullPhaseSound, playSkullHandGrowlSound, playSkullDeathKnell, playSkullLaughSound,
  playFinalBossSealBreakSound, playFinalBossChargeSound, playFinalBossAscendSound,
  playFinalBossExposeSound, playFinalBossSummonWallSound, playFinalBossReleaseWallSound,
} from './audio.js';

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
let cameraRef = null;
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

// ── Mesh caches (avoid hot-path array allocation / linear lookups) ──
// VR-CRITICAL: Projectile collision and beam weapons query these repeatedly.
// Keep root-mesh arrays stable and maintain O(1) root -> index maps.
let _cachedEnemyMeshes = [];
let _enemyMeshesDirty = true;
const _enemyMeshToIndex = new Map();

let _cachedBossMinionMeshes = [];
let _bossMinionMeshesDirty = true;
const _bossMinionMeshToIndex = new Map();

function rebuildMeshCache() {
  _cachedEnemyMeshes.length = 0;
  _enemyMeshToIndex.clear();

  for (let i = 0; i < activeEnemies.length; i++) {
    const enemy = activeEnemies[i];
    if (!enemy) continue;
    enemy._activeIndex = i;
    if (enemy.mesh) {
      _cachedEnemyMeshes.push(enemy.mesh);
      _enemyMeshToIndex.set(enemy.mesh, i);
    }
  }

  _enemyMeshesDirty = false;
}

function rebuildBossMinionMeshCache() {
  _cachedBossMinionMeshes.length = 0;
  _bossMinionMeshToIndex.clear();

  for (let i = 0; i < bossMinions.length; i++) {
    const minion = bossMinions[i];
    if (!minion) continue;
    minion._bossMinionIndex = i;
    if (minion.mesh) {
      _cachedBossMinionMeshes.push(minion.mesh);
      _bossMinionMeshToIndex.set(minion.mesh, i);
    }
  }

  _bossMinionMeshesDirty = false;
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
// ── Status effect bubble pool (FIRE/SHOCK/CHILL) ──
const STATUS_BUBBLE_POOL_SIZE = 8;
const statusBubblePool = [];
const statusBubbleActive = [];

function initStatusBubblePool() {
  if (statusBubblePool.length > 0) return;
  for (let i = 0; i < STATUS_BUBBLE_POOL_SIZE; i++) {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 128;
    const texture = new THREE.CanvasTexture(canvas);
    texture.minFilter = THREE.LinearFilter;
    texture.premultiplyAlpha = false;
    const material = new THREE.MeshBasicMaterial({
      map: texture,
      transparent: true,
      opacity: 0.95,
      depthTest: false,
      side: THREE.DoubleSide,
    });
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(1, 0.5), material);
    mesh.visible = false;
    mesh.renderOrder = 998;
    mesh.userData = { createdAt: 0, lifetime: 800, velocity: new THREE.Vector3() };
    statusBubblePool.push({ mesh, canvas, ctx: canvas.getContext('2d'), texture });
    if (sceneRef) sceneRef.add(mesh);
  }
}

function spawnStatusEffectBubble(position, effectType, stacks) {
  initStatusBubblePool();

  // Grab from pool
  let entry = statusBubblePool.pop();
  if (!entry) {
    // Pool exhausted - recycle oldest active
    entry = statusBubbleActive.shift();
    if (!entry) return;
  }

  const { mesh, canvas, ctx, texture } = entry;

  // Determine color and text
  let glowColor, text;
  switch (effectType) {
    case 'fire': glowColor = '#ff3300'; text = stacks > 1 ? `FIRE x${stacks}!` : 'FIRE!'; break;
    case 'shock': glowColor = '#ffdd00'; text = stacks > 1 ? `SHOCK x${stacks}!` : 'SHOCK!'; break;
    case 'freeze': glowColor = '#88ccff'; text = stacks > 1 ? `CHILL x${stacks}!` : 'CHILL!'; break;
    default: glowColor = '#ffffff'; text = 'EFFECT!';
  }

  // Redraw canvas
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.font = 'bold 56px Arial, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.shadowColor = glowColor;
  ctx.shadowBlur = 20;
  ctx.fillStyle = 'rgba(0,0,0,0.8)';
  ctx.fillText(text, 130, 66);
  ctx.fillStyle = glowColor;
  ctx.fillText(text, 128, 64);
  texture.needsUpdate = true;

  // Scale for VR readability
  const scale = 0.5;
  mesh.scale.set(scale * 2, scale, 1);
  mesh.material.opacity = 0.95;
  mesh.position.copy(position);
  mesh.position.y += 1.2;
  mesh.position.x += (Math.random() - 0.5) * 0.3;
  mesh.position.z += (Math.random() - 0.5) * 0.3;
  mesh.visible = true;
  mesh.userData.createdAt = performance.now();
  mesh.userData.lifetime = 800;
  mesh.userData.velocity.set(
    (Math.random() - 0.5) * 0.5, 1.2, (Math.random() - 0.5) * 0.5
  );

  statusBubbleActive.push(entry);

  // Remove from legacy statusBubbles if present
  const sbIdx = statusBubbles.indexOf(mesh);
  if (sbIdx >= 0) statusBubbles.splice(sbIdx, 1);
}

// ── Health gain popup pool (avoid texture churn from vampire triggers) ──
const HEALTH_POPUP_POOL_SIZE = 5;
const healthPopupPool = [];  // Pre-created sprites ready for reuse
const healthPopupActive = []; // Currently animating

// Pre-draw the static +heart texture once
function createHealthPopupTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 128;
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // Pixel heart pattern (7x6 grid, half-heart: columns 0-3)
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
  return texture;
}

let _sharedHealthTexture = null;

function initHealthPopupPool() {
  if (healthPopupPool.length > 0) return;
  if (!_sharedHealthTexture) _sharedHealthTexture = createHealthPopupTexture();
  for (let i = 0; i < HEALTH_POPUP_POOL_SIZE; i++) {
    const material = new THREE.SpriteMaterial({
      map: _sharedHealthTexture,
      transparent: true,
      depthTest: false,
    });
    const mesh = new THREE.Sprite(material);
    mesh.visible = false;
    mesh.renderOrder = 997;
    mesh.scale.set(1.35, 0.675, 1);
    mesh.userData = { createdAt: 0, lifetime: 1000, velocity: new THREE.Vector3() };
    healthPopupPool.push(mesh);
    if (sceneRef) sceneRef.add(mesh);
  }
}

/**
 * Spawn a health gain popup (white + with pixel half-heart) at enemy position when VAMPIRE triggers.
 * Uses object pool to avoid creating new textures/sprites each trigger.
 */
export function spawnHealthGainPopup(position) {
  initHealthPopupPool();

  // Grab from pool (or steal oldest active if pool exhausted)
  let mesh = healthPopupPool.pop();
  if (!mesh) {
    // Pool empty - recycle the oldest active popup
    mesh = healthPopupActive.shift();
    if (!mesh) return; // Safety
  }

  mesh.position.copy(position);
  mesh.position.y += 0.3;
  mesh.material.opacity = 1;
  mesh.visible = true;
  mesh.userData.createdAt = performance.now();
  mesh.userData.lifetime = 1000;
  mesh.userData.velocity.set(
    (Math.random() - 0.5) * 0.3, 1.2, (Math.random() - 0.5) * 0.3
  );

  healthPopupActive.push(mesh);

  // Remove from legacy statusBubbles if present
  const sbIdx = statusBubbles.indexOf(mesh);
  if (sbIdx >= 0) statusBubbles.splice(sbIdx, 1);
}

// Update pooled health popups (called from updateStatusBubbles)
export function updateHealthPopups(dt, now) {
  for (let i = healthPopupActive.length - 1; i >= 0; i--) {
    const mesh = healthPopupActive[i];
    const age = now - mesh.userData.createdAt;

    if (age > mesh.userData.lifetime) {
      // Return to pool
      mesh.visible = false;
      healthPopupActive.splice(i, 1);
      healthPopupPool.push(mesh);
    } else {
      // Animate: float up + fade
      mesh.position.addScaledVector(mesh.userData.velocity, dt);
      const progress = age / mesh.userData.lifetime;
      mesh.material.opacity = 1 - progress;
      mesh.userData.velocity.y -= dt * 0.5; // Gentle deceleration
    }
  }
}

/**
 * Update status effect bubbles (animate and remove expired).
 */
export function updateStatusBubbles(dt, now) {
  // Update pooled health popups
  updateHealthPopups(dt, now);

  // Update pooled status effect bubbles (FIRE/SHOCK/CHILL)
  for (let i = statusBubbleActive.length - 1; i >= 0; i--) {
    const entry = statusBubbleActive[i];
    const b = entry.mesh;
    const age = now - b.userData.createdAt;
    if (age > b.userData.lifetime) {
      b.visible = false;
      statusBubbleActive.splice(i, 1);
      statusBubblePool.push(entry);
    } else {
      b.position.addScaledVector(b.userData.velocity, dt);
      b.userData.velocity.y -= 3 * dt;
      b.material.opacity = 0.95 * (1 - age / b.userData.lifetime);
    }
  }

  // Legacy status bubbles (non-pooled, for any remaining callers)
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
    // Perf: Cache the live array index once so projectile / beam code can avoid indexOf().
    e._activeIndex = i;
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

    // Final boss phase-2 formations freeze real enemies in a wall so the player
    // can shoot them before release. Keep them readable and skip normal AI while held.
    if (e._eclipseHeld) {
      if (e._eclipseHoldTarget) {
        e.mesh.position.lerp(e._eclipseHoldTarget, Math.min(1, dt * 7.5));
        e.mesh.position.y += Math.sin(now * 0.004 + (e._eclipseHoldBob || 0)) * 0.0025;
      }

      if (e.mesh.userData.instanceId !== undefined) {
        e.mesh.updateMatrix();
        const iid = e.mesh.userData.instanceId;
        const pool = e.mesh.userData.instancePool;
        pool.mesh.setMatrixAt(iid, e.mesh.matrix);
        _dirtyPools.add(pool);
      }

      _look.set(playerPos.x, e.mesh.position.y, playerPos.z);
      e.mesh.lookAt(_look);
      updateStatusEffects(e, dt);

      const heldDamageRatio = 1 - e.hp / e.maxHp;
      if (e.mesh.userData.instanceId !== undefined) {
        _scratchColor.copy(e.baseColor).lerp(_redColor, heldDamageRatio);
        const pool = e.mesh.userData.instancePool;
        pool.mesh.setColorAt(e.mesh.userData.instanceId, _scratchColor);
        _dirtyPools.add(pool);
      } else if (e.material) {
        e.material.color.copy(e.baseColor).lerp(_redColor, heldDamageRatio);
      }
      continue;
    }

    if (e._eclipseReleaseTimer > 0 && e._eclipseReleaseVector) {
      e._eclipseReleaseTimer -= dt;
      e.mesh.position.addScaledVector(e._eclipseReleaseVector, dt);
      if (e._eclipseReleaseTimer <= 0) {
        e._eclipseReleaseTimer = 0;
        e._eclipseReleaseVector = null;
      }
    }

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
 * Destroy enemy at `index` - remove from scene, spawn explosion.
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
  _enemyMeshToIndex.clear();

  return {
    position: pos,
    scoreValue: e.scoreValue,
    baseColor: color,
    type: e.type,
    skipLevelProgress: !!e._bossSummoned,
  };
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
  _enemyMeshToIndex.clear();
  _cachedEnemyMeshes.length = 0;

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
  // type: 'projectile', 'charge', 'minion', 'melee', 'teleport', 'pulse', 'shockwave'
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
        // Large expanding sphere from boss or player
        const chargeGeo = new THREE.SphereGeometry(0.1, 16, 16);
        const chargeMat = new THREE.MeshBasicMaterial({
          color: effect.color,
          transparent: true,
          opacity: 0.6
        });
        effect.mesh = new THREE.Mesh(chargeGeo, chargeMat);
        effect.mesh.name = 'boss-attack-charge';
        effect.mesh.scale.set(0.1, 0.1, 0.1);
        if (position) {
          effect.mesh.position.copy(position);
        } else if (this.camera) {
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
        if (position) {
          effect.mesh.position.copy(position);
        }
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
        if (position) {
          effect.mesh.position.copy(position);
        }
        break;

      case 'pulse':
        // VR-safe ring pulse centered on the attack origin.
        const pulseGeo = new THREE.RingGeometry(0.5, 0.75, 40);
        const pulseMat = new THREE.MeshBasicMaterial({
          color: effect.color,
          transparent: true,
          opacity: 0.65,
          side: THREE.DoubleSide,
          depthWrite: false,
        });
        effect.mesh = new THREE.Mesh(pulseGeo, pulseMat);
        effect.mesh.rotation.x = -Math.PI / 2;
        effect.mesh.name = 'boss-attack-pulse';
        if (position) {
          effect.mesh.position.copy(position);
        }
        break;

      case 'shockwave':
        // Ground ring that expands outward to communicate an arena-wide burst.
        const shockwaveGeo = new THREE.RingGeometry(0.7, 1.0, 48);
        const shockwaveMat = new THREE.MeshBasicMaterial({
          color: effect.color,
          transparent: true,
          opacity: 0.75,
          side: THREE.DoubleSide,
          depthWrite: false,
        });
        effect.mesh = new THREE.Mesh(shockwaveGeo, shockwaveMat);
        effect.mesh.rotation.x = -Math.PI / 2;
        effect.mesh.name = 'boss-attack-shockwave';
        if (position) {
          effect.mesh.position.copy(position);
        }
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

        case 'pulse':
          if (effect.mesh) {
            const progress = elapsed / effect.duration;
            effect.mesh.scale.setScalar(0.75 + progress * 2.5);
            effect.mesh.material.opacity = 0.65 * (1 - progress);
            effect.mesh.rotation.z += dt * 0.8;
          }
          break;

        case 'shockwave':
          if (effect.mesh) {
            const progress = elapsed / effect.duration;
            effect.mesh.scale.setScalar(0.8 + progress * 7.5);
            effect.mesh.material.opacity = 0.75 * (1 - progress);
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
    this.mesh.position.set(0, 2.5, -12);
    this.mesh.userData.isBoss = true;
    this.mesh.renderOrder = 5; // Render below menus (pause=10000, settings=995)
    this.sceneRef.add(this.mesh);

    // Rise animation: spawn below floor, animate upward
    this._riseAnimActive = true;
    this._riseAnimStart = performance.now();
    this._riseAnimDuration = 2000; // 2 seconds
    this._riseTargetY = this.mesh.position.y;
    this.mesh.position.y -= 4.0; // Start 4 units below target

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

    // Timer ownership for safe cancellation on destroy/phase change
    this._timers = new Set();
    this._destroyed = false;
  }

  /** Schedule a callback that auto-cancels if the boss is destroyed. */
  later(ms, fn) {
    const id = setTimeout(() => {
      this._timers.delete(id);
      if (!this._destroyed) fn();
    }, ms);
    this._timers.add(id);
    return id;
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
    // Per-voxel tinting: if subclass set up voxelMaterials, use those instead of flat tinting
    if (this.voxelMaterials && this.voxelMaterials.length > 0) {
      this.updateVoxelTinting(damageRatio);
    } else {
      this.mesh.traverse(c => {
        if (c.isMesh && c.material && !c.userData.isBossBody) {
          c.material.color.copy(this.baseColor).lerp(new THREE.Color(0xff0000), damageRatio);
        }
      });
    }

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

  /** Per-voxel damage tinting: lerp each voxel from its original color toward dark red. */
  updateVoxelTinting(damageRatio) {
    const damagedColor = new THREE.Color(0x880000);
    const enhancedRatio = Math.pow(damageRatio, 0.7);
    for (let i = 0; i < this.voxelMaterials.length; i++) {
      const entry = this.voxelMaterials[i];
      entry.mesh.material.color.copy(entry.originalColor).lerp(damagedColor, enhancedRatio);
    }
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
      const fromPos = this.mesh.position.clone().add(new THREE.Vector3(0, 1.5, 0));
      spawnBossProjectile(fromPos, targetPos);
    }
  }

  update(dt, now, playerPos) {
    // Rise animation on spawn
    if (this._riseAnimActive) {
      const elapsed = performance.now() - this._riseAnimStart;
      const t = Math.min(1, elapsed / this._riseAnimDuration);
      // Ease-out cubic
      const ease = 1 - Math.pow(1 - t, 3);
      this.mesh.position.y = this._riseTargetY - 4.0 + ease * 4.0;
      if (t >= 1) {
        this._riseAnimActive = false;
        this.mesh.position.y = this._riseTargetY;
      }
      return; // Skip normal behavior during rise
    }

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
    this._destroyed = true;
    this._timers.forEach(clearTimeout);
    this._timers.clear();

    this.sceneRef.remove(this.mesh);
    this.mesh.traverse(c => {
      if (c.geometry) c.geometry.dispose();
      if (c.material) {
        if (Array.isArray(c.material)) c.material.forEach(m => m.dispose && m.dispose());
        else if (c.material.dispose) c.material.dispose();
      }
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
    this.later(600, () => {
      if (typeof window !== 'undefined' && window.createBossShockwave) {
        window.createBossShockwave(this.mesh.position.clone(), 5, 15 + this.phase * 5);
      }
    });
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

    this.later(400, () => {
      const angle = Math.random() * Math.PI * 2;
      const dist = 6 + Math.random() * 4;
      this.mesh.position.set(
        playerPos.x + Math.cos(angle) * dist,
        1.5,
        playerPos.z + Math.sin(angle) * dist
      );
      this.mesh.visible = true;
      this.state = 'visible';
    });
  }

  onProjectileFire(playerPos) {
    if (this.telegraphing) {
      this.showTelegraph('projectile', 0.35, 0x00ffff);
    }

    this.later(200, () => {
      const spread = 0.4;
      const leftTarget = playerPos.clone();
      leftTarget.x -= spread;
      const rightTarget = playerPos.clone();
      rightTarget.x += spread;
      if (typeof spawnBossProjectile === 'function') {
        const fromPos = this.mesh.position.clone().add(new THREE.Vector3(0, 1.5, 0));
        spawnBossProjectile(fromPos, leftTarget);
        spawnBossProjectile(fromPos, rightTarget);
      }
    });
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
    this.later(400, () => {
      if (typeof window !== 'undefined' && window.fireBossPulse) {
        window.fireBossPulse(this.mesh.position.clone(), playerPos.clone(), 20 + this.phase * 10);
      }
    });
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

    this.later(this.shieldDuration * 1000, () => {
      this.shieldActive = false;

      // Safely reset emissiveIntensity on all child meshes with materials
      this.mesh.traverse(c => {
        if (c.isMesh && c.material) {
          setMaterialEmissiveSafe(c.material, _emissiveWhite, 0.3);
        }
      });
    });
  }

  onProjectileFire(playerPos) {
    if (this.shieldActive) return;
    if (this.telegraphing) {
      this.showTelegraph('projectile', 0.4, 0xff0088);
    }

    this.later(200, () => {
      const shots = 5;
      for (let i = 0; i < shots; i++) {
        const angle = (i / shots) * Math.PI * 2;
        const target = new THREE.Vector3(
          playerPos.x + Math.cos(angle) * 3,
          playerPos.y,
          playerPos.z + Math.sin(angle) * 3
        );
        if (typeof spawnBossProjectile === 'function') {
          const fromPos = this.mesh.position.clone().add(new THREE.Vector3(0, 1.5, 0));
          spawnBossProjectile(fromPos, target);
        }
      }
    });
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

    this.later(200, () => {
      const spread = 0.6;
      const target = playerPos.clone();
      target.x += (Math.random() - 0.5) * spread;
      target.z += (Math.random() - 0.5) * spread;
      if (typeof spawnBossProjectile === 'function') {
        const fromPos = this.mesh.position.clone().add(new THREE.Vector3(0, 1.5, 0));
        spawnBossProjectile(fromPos, target);
      }
    });
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
    this.later(300, () => {
      if (typeof window !== 'undefined' && window.fireBossLightning) {
        window.fireBossLightning(this.mesh.position.clone(), playerPos.clone(), 1 + this.phase);
      }
    });
  }

  teleport(playerPos) {
    if (this.telegraphing) {
      this.showTelegraph('teleport', 0.3, 0xffff00);
    }

    this.mesh.visible = false;

    this.later(300, () => {
      const angle = Math.random() * Math.PI * 2;
      const dist = 5 + Math.random() * 5;
      this.mesh.position.set(
        playerPos.x + Math.cos(angle) * dist,
        1.5,
        playerPos.z + Math.sin(angle) * dist
      );
      this.mesh.visible = true;
    });
  }

  onProjectileFire(playerPos) {
    if (this.telegraphing) {
      this.showTelegraph('projectile', 0.35, 0xffff00);
    }

    this.later(200, () => {
      const spread = 0.5;
      const target = playerPos.clone();
      target.x += (Math.random() - 0.5) * spread;
      target.z += (Math.random() - 0.5) * spread;
      if (typeof spawnBossProjectile === 'function') {
        const fromPos = this.mesh.position.clone().add(new THREE.Vector3(0, 1.5, 0));
        spawnBossProjectile(fromPos, target);
      }
    });
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
    this.group.renderOrder = 5;
    const geo = getGeo(0.25);
    const mat = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.9,
      depthWrite: false,
      fog: false,
    });

    // Palm (center)
    const palm = new THREE.Mesh(geo, mat.clone());
    palm.renderOrder = 2;
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
      finger.renderOrder = 2;
      finger.position.set(pos[0], pos[1], pos[2]);
      finger.userData.isHandBody = true;
      finger.userData.handIndex = this.handIndex;
      this.group.add(finger);
    });

    // Hitbox (use cached geometry to avoid per-spawn leak)
    // Must use transparent+opacity:0 instead of visible:false because Three.js raycaster skips invisible meshes
    const hitboxMat = new THREE.MeshBasicMaterial({
      transparent: true,
      opacity: 0,
      depthWrite: false,
      depthTest: false,
    });
    const hitbox = new THREE.Mesh(getHitboxGeo(2.1, 2.1, 2.1), hitboxMat);
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
      if (c.material) {
        if (Array.isArray(c.material)) c.material.forEach(m => m.dispose && m.dispose());
        else if (c.material.dispose) c.material.dispose();
      }
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
    skullGroup.renderOrder = 5;
    const geo = getGeo(0.375);

    // NECRO pixel art: 9 wide × 7 tall, flat front-facing
    // Colors: 0=blank, 1=🟨=#F9F2E5, 2=🟧=#E4D8C8, 3=🟫=#9E8D74, 4=⬛=#180000, 5=🟥=#F90001, 6=🟪=#594B38, 7=🟦=#2B2111, 8=🟩=#F8F0E4
    const COLORS = {
      bone_highlight: 0xF9F2E5,  // 🟨 new top highlight
      bone_mid: 0xE4D8C8,        // 🟧 warm mid-tone bone
      bone_base: 0x9E8D74,       // 🟫 base bone color
      shadow: 0x180000,          // ⬛ deep shadow
      eye_glow: 0xF90001,        // 🟥 core eye glow
      eye_falloff: 0x594B38,     // 🟪 subsurface glow
      cool_shadow: 0x2B2111,     // 🟦 cool shadow under skull
      decay_tint: 0xF8F0E4,      // 🟩 light fill near jaw
    };

    // Grid definition: full 9-element rows, 0 = blank
    // 0=blank, 1=🟨, 2=🟧, 3=🟫, 4=⬛, 5=🟥, 6=🟪, 7=🟦, 8=🟩
    const GRID = [
      // Row 0: ⬜️⬜️🟫🟧🟧🟧🟫⬜️⬜️
      [0,0,3,2,2,2,3,0,0],
      // Row 1: ⬜️🟫🟨🟨🟨🟨🟨🟫⬜️
      [0,3,1,1,1,1,1,3,0],
      // Row 2: 🟫🟧🟧🟧🟧🟧🟧🟧🟫
      [3,2,2,2,2,2,2,2,3],
      // Row 3: 🟫⬛️⬛️🟩⬜️🟩⬛️⬛️🟫 (col 4 = blank = nose)
      [3,4,4,8,0,8,4,4,3],
      // Row 4: 🟫⬛️🟥🟪🟨🟪🟥⬛️🟫
      [3,4,5,6,1,6,5,4,3],
      // Row 5: ⬜️🟦🟧🟨🟪🟨🟧🟦⬜️
      [0,7,2,1,6,1,2,7,0],
      // Row 6: ⬜️🟦🟧🟫🟧🟫🟧🟦⬜️
      [0,7,2,3,2,3,2,7,0],
    ];

    // No column offsets needed - all rows are full 9-element arrays

    // Color key map
    const COLOR_MAP = {
      1: COLORS.bone_highlight,
      2: COLORS.bone_mid,
      3: COLORS.bone_base,
      4: COLORS.shadow,
      5: COLORS.eye_glow,
      6: COLORS.eye_falloff,
      7: COLORS.cool_shadow,
      8: COLORS.decay_tint,
    };

    // Center the grid: 9 wide, 7 tall. Offset so center is at (0,0)
    const gridW = 9;
    const gridH = 7;
    const voxelSize = 0.375;
    const halfW = (gridW - 1) * voxelSize / 2;
    const halfH = (gridH - 1) * voxelSize / 2;

    let eyeCount = 0;
    const skullVoxels = [];
    this.voxelMaterials = [];

    GRID.forEach((row, rowIdx) => {
      row.forEach((cell, cellIdx) => {
        const col = cellIdx;
        if (cell === 0) return; // blank
        const colorHex = COLOR_MAP[cell];
        if (!colorHex) return;

        const mat = new THREE.MeshBasicMaterial({
          color: colorHex,
          transparent: true,
          opacity: 0.9,
          depthWrite: false,
          fog: false,
        });
        const cube = new THREE.Mesh(geo, mat);
        cube.renderOrder = 2;
        cube.position.set(
          col * voxelSize - halfW,
          (gridH - 1 - rowIdx) * voxelSize - halfH,
          0
        );

        // Mark eyes
        if (cell === 5) {  // eye_glow
          cube.userData.isEye = true;
          cube.userData.eyeIndex = eyeCount;
          // Eye material: start bright, will be animated in updateBehavior
          mat.color.setHex(0xff0000);
          mat.opacity = 0.95;
          if (eyeCount === 0) this.leftEye = cube;
          else this.rightEye = cube;
          eyeCount++;
        } else {
          cube.userData.isSkullBody = true;
          skullVoxels.push(cube);
          this.voxelMaterials.push({ mesh: cube, originalColor: new THREE.Color(colorHex) });
        }

        skullGroup.add(cube);
      });
    });

    this.skullVoxels = skullVoxels;

    this.mesh.add(skullGroup);
    this.skullGroup = skullGroup;
    this.skullGroup.scale.setScalar(1.3);

    // Add hitbox for head (use cached geometry to avoid per-spawn leak)
    const hitboxMat = new THREE.MeshBasicMaterial({ visible: false });
    const hitbox = new THREE.Mesh(getHitboxGeo(3.0, 3.0, 3.0), hitboxMat);
    hitbox.userData.isBossHitbox = true;
    hitbox.userData.isSkullHead = true;
    this.mesh.add(hitbox);
  }

  createHands() {
    // Create 4 hands positioned around the skull
    const handOffsets = [
      new THREE.Vector3(-6.75, 0.45, 0.75),   // Left top
      new THREE.Vector3(-6.75, -0.75, 0.75),  // Left bottom
      new THREE.Vector3(6.75, 0.45, 0.75),    // Right top
      new THREE.Vector3(6.75, -0.75, 0.75),   // Right bottom
    ];

    handOffsets.forEach((offset, idx) => {
      const hand = new SkullHand(this, idx, offset, this.sceneRef);
      // Hands start visible - they move up with boss mesh during rise animation
      this.hands.push(hand);
    });
  }

  setHeadImmune(immune) {
    this.headVulnerable = !immune;

    // Visual feedback - dim eye opacity when immune
    // Color is now handled by pulsing animation in updateBehavior
    const eyeOpacity = immune ? 0.4 : 0.95;
    if (this.leftEye) this.leftEye.material.opacity = eyeOpacity;
    if (this.rightEye) this.rightEye.material.opacity = eyeOpacity;
  }

  updateBehavior(dt, now, playerPos) {
    // Hands are visible from the start (rise with boss mesh)
    if (!this._handsInitialized) {
      this._handsInitialized = true;
    }

    // Bobbing animation (only after rise completes)
    // _bobBaseY is the target Y from rise animation
    this._bobBaseY = this._bobBaseY || this._riseTargetY;
    this.mesh.position.y = this._bobBaseY + Math.sin(now * 0.002) * 0.3;

    // Eye glow pulsing: loop from dark red to bright red
    const pulseT = (Math.sin(now * 0.004) + 1) * 0.5; // 0..1 oscillation
    // In angry phases (headVulnerable, skullPhase >= 2), eyes stay brighter
    const minBrightness = this.headVulnerable && this.skullPhase >= 2 ? 0.6 : 0.25;
    const brightness = minBrightness + pulseT * (1.0 - minBrightness);
    const eyeR = Math.floor(brightness * 255);
    const eyeColor = (eyeR << 16); // red channel only
    if (this.leftEye) this.leftEye.material.color.setHex(eyeColor);
    if (this.rightEye) this.rightEye.material.color.setHex(eyeColor);

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

    // Burst cooldown timer for phase 3
    if (this._burstCooldown && this._burstCooldown > 0) {
      this._burstCooldown -= dt;
      // Don't fire during cooldown, but keep moving
    } else {
      // Eye shooting with lobbed projectiles (alternating eyes)
      this.eyeTimer += dt;
      if (this.eyeTimer >= phaseConfig.shootRate) {
        this.eyeTimer = 0;
        this.fireLobbedEyeProjectiles(playerPos, phaseConfig.arcHeight);
      }
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
          arcHeight: 2.0,
          erraticness: 3.0
        };
      case 2: // 1200-600 HP: Faster, more erratic
        return {
          moveSpeed: 2.5,
          shootRate: 0.8,
          arcHeight: 2.0,
          erraticness: 1.5
        };
      case 3: // 600-0 HP: Very fast, with burst/cooldown
        return {
          moveSpeed: 4.0,
          shootRate: 0.4,
          arcHeight: 2.5,
          erraticness: 0.8
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

    // Stay between 8 and 16 units from player (moved back for NECRO)
    if (dist < 8) {
      const awayDir = this.mesh.position.clone().sub(playerPos).normalize();
      this.mesh.position.addScaledVector(awayDir, (8 - dist));
    } else if (dist > 16) {
      const towardDir = playerPos.clone().sub(this.mesh.position).normalize();
      this.mesh.position.addScaledVector(towardDir, (dist - 16));
    }

    // Keep in play area bounds
    const bound = 15;
    this.mesh.position.x = Math.max(-bound, Math.min(bound, this.mesh.position.x));
    this.mesh.position.z = Math.max(-bound, Math.min(bound, this.mesh.position.z));
    // Don't override Y - bobbing animation handles it via _bobBaseY
  }

  fireHandProjectile(hand, playerPos) {
    if (this.telegraphing) {
      this.showTelegraph('projectile', 0.25, 0xff0000, hand.getPosition());
    }

    this.later(150, () => {
      // Cancel if hand was destroyed during telegraph delay
      if (!hand.alive) return;
      if (typeof spawnBossProjectile === 'function') {
        spawnBossProjectile(hand.getPosition(), playerPos);
      }
    });
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

    this.later(200, () => {
      eyePositions.forEach(eyePos => {
        if (typeof spawnBossProjectile === 'function') {
          spawnBossProjectile(eyePos, playerPos);
        }
      });
    }, 200);
  }

  // Part 4: Lobbed projectiles for skull phase (arc trajectory, alternating eyes)
  fireLobbedEyeProjectiles(playerPos, arcHeight) {
    // Show telegraph briefly before firing
    if (this.telegraphing) {
      this.showTelegraph('projectile', 0.3, 0xff0000, this.mesh.position);
    }

    // Burst/cooldown system for phase 3: fire 15 shots, then pause 3s
    if (this.skullPhase >= 3) {
      if (this._burstCooldown && this._burstCooldown > 0) return;
      this._burstCount = (this._burstCount || 0) + 1;
      if (this._burstCount >= 15) {
        this._burstCount = 0;
        this._burstCooldown = 3.0; // 3-second reload pause
        return;
      }
    }

    // Alternate eyes: left, right, left, right...
    this._eyeSide = (this._eyeSide || 0) === 0 ? 1 : 0;
    const eyePos = this._eyeSide === 1
      ? this.leftEye.getWorldPosition(new THREE.Vector3())
      : this.rightEye.getWorldPosition(new THREE.Vector3());

    // Arc sideways: aim at a point offset perpendicular to the player direction
    // This creates a sweeping curve that arcs left/right
    const toPlayer = new THREE.Vector3().subVectors(playerPos, eyePos);
    toPlayer.y = 0;
    toPlayer.normalize();
    // Perpendicular direction (rotated 90 degrees on Y)
    const perpDir = new THREE.Vector3(-toPlayer.z, 0, toPlayer.x);
    // Alternate curve direction based on eye side
    const curveDir = this._eyeSide === 1 ? 1 : -1;
    const curveOffset = perpDir.clone().multiplyScalar(curveDir * 2.5);
    const curvedTarget = playerPos.clone().add(curveOffset);

    if (typeof spawnBossProjectile === 'function') {
      spawnBossProjectile(eyePos, curvedTarget, false, 0);
    }
  }

  playGrowlSound() {
    // Use audio system if available
    if (typeof window !== 'undefined' && window.playBossAttackSound) {
      window.playBossAttackSound('charge', 0.8);
    }
  }

  updateHeadColor() {
    if (this.voxelMaterials && this.voxelMaterials.length > 0) return; // Handled by per-voxel tinting in takeDamage
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
      this.later(400, () => this.fireProjectile(playerPos));
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
      this.later(300, () => {
        if (typeof spawnBossProjectile === 'function') {
          spawnBossProjectile(droneWorldPos, playerPos);
        }
      });
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
        const hologramMesh = this.mesh.clone(true);
        hologramMesh.traverse((c) => {
          if (!c.isMesh) return;
          c.material = c.material.clone();
          c.material.transparent = true;
          c.material.opacity = 0.4;
        });
        const hologram = {
          mesh: hologramMesh,
          angle: angle,
          distance: 3 + Math.random() * 2
        };
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
      const opacity = 0.3 + Math.sin(now * 0.003 + i) * 0.2;
      h.mesh.traverse((c) => {
        if (!c.isMesh) return;
        c.material.opacity = opacity;
      });
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

  // Compute world-space center of voxels belonging to a given car (1-based)
  getCarCenter(carNum) {
    const carVoxels = this.mesh.children.filter(
      c => c.userData && c.userData.isBossBody && c.userData.car === carNum
    );
    if (carVoxels.length === 0) return this.mesh.position.clone();
    const center = new THREE.Vector3();
    for (const v of carVoxels) {
      v.getWorldPosition(_enemyScratch3);
      center.add(_enemyScratch3);
    }
    center.divideScalar(carVoxels.length);
    return center;
  }

  onProjectileFire(playerPos) {
    if (this.phase >= 4) {
      // All cars fire from their own positions
      for (let carNum = 1; carNum <= 3; carNum++) {
        const carPos = this.getCarCenter(carNum);
        if (typeof spawnBossProjectile === 'function') {
          spawnBossProjectile(carPos, playerPos);
        }
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

    // Lunge-based movement state
    this.lungePhase = 'idle'; // 'idle' | 'lunging' | 'recovery'
    this.lungeTimer = 0;
    this.lungeDuration = 2.0;
    this.lungeRecoveryTime = 0.8;
    this.lungeStartPos = new THREE.Vector3();
    this.lungeEndPos = new THREE.Vector3();
    this.lungeCount = 0;
    this.currentY = 1.5;
    this.lungeDirection = 1; // 1 = moving right, -1 = moving left
    this.lungeSide = 1;     // 1 = right side, -1 = left side (alternates)
    this.shardFiredThisLunge = false;

    // Create horns
    this.createHorns();
    this.buildFaceMesh();
  }

  buildFaceMesh() {
    // Clear default mesh children (built from pattern)
    while (this.mesh.children.length > 0) {
      const child = this.mesh.children[0];
      this.mesh.remove(child);
      if (child.geometry) child.geometry.dispose();
      if (child.material) child.material.dispose();
    }

    const faceGroup = new THREE.Group();
    faceGroup.renderOrder = 2;
    const geo = getGeo(0.375);

    // BLOOD MINOTAUR pixel art: 8 wide × 7 tall, flat front-facing
    const COLORS = {
      horn: 0xeee6d7,    // 🟨
      dark_face: 0x361500, // 🟫
      light_face: 0x9c3d01, // 🟧
      eye: 0xd70200,       // 🟥
    };

    // Grid: 0=blank, 1=🟨, 2=🟫, 3=🟧, 4=🟥
    const GRID = [
      // Row 0: 🟨⬜️⬜️⬜️⬜️⬜️⬜️🟨
      [1, 0, 0, 0, 0, 0, 0, 1],
      // Row 1: 🟨⬜️⬜️⬜️⬜️⬜️⬜️🟨
      [1, 0, 0, 0, 0, 0, 0, 1],
      // Row 2: 🟨🟨🟫🟧🟧🟫🟨🟨
      [1, 1, 2, 3, 3, 2, 1, 1],
      // Row 3: 🟫🟫🟧🟧🟧🟧🟫🟫
      [2, 2, 3, 3, 3, 3, 2, 2],
      // Row 4: ⬜️🟫🟥🟫🟫🟥🟫⬜️
      [0, 2, 4, 2, 2, 4, 2, 0],
      // Row 5: ⬜️⬜️🟫🟧🟧🟫⬜️⬜️
      [0, 0, 2, 3, 3, 2, 0, 0],
      // Row 6: ⬜️⬜️🟫🟫🟫🟫⬜️⬜️
      [0, 0, 2, 2, 2, 2, 0, 0],
    ];

    const COLOR_MAP = {
      1: COLORS.horn,
      2: COLORS.dark_face,
      3: COLORS.light_face,
      4: COLORS.eye,
    };

    const gridW = 8;
    const gridH = 7;
    const voxelSize = 0.375;
    const halfW = (gridW - 1) * voxelSize / 2;
    const halfH = (gridH - 1) * voxelSize / 2;

    let eyeCount = 0;
    const faceVoxels = [];
    this.voxelMaterials = [];

    GRID.forEach((row, rowIdx) => {
      row.forEach((cell, colIdx) => {
        if (cell === 0) return;
        const colorHex = COLOR_MAP[cell];
        if (!colorHex) return;

        const mat = new THREE.MeshBasicMaterial({
          color: colorHex,
          transparent: true,
          opacity: 0.9,
          depthWrite: false,
          fog: false,
        });
        const cube = new THREE.Mesh(geo, mat);
        cube.position.set(
          colIdx * voxelSize - halfW,
          (gridH - 1 - rowIdx) * voxelSize - halfH,
          0
        );

        if (cell === 4) {  // eye
          cube.userData.isEye = true;
          cube.userData.eyeIndex = eyeCount;
          if (eyeCount === 0) this.leftEye = cube;
          else this.rightEye = cube;
          eyeCount++;
        } else {
          cube.userData.isFaceBody = true;
          faceVoxels.push(cube);
          this.voxelMaterials.push({ mesh: cube, originalColor: new THREE.Color(colorHex) });
        }

        faceGroup.add(cube);
      });
    });

    this.faceVoxels = faceVoxels;
    this.mesh.add(faceGroup);
    this.faceGroup = faceGroup;

    // Keep existing hitbox
    const hitboxMat = new THREE.MeshBasicMaterial({ visible: false });
    const hitbox = new THREE.Mesh(getHitboxGeo(3.0, 3.0, 3.0), hitboxMat);
    hitbox.userData.isBossHitbox = true;
    this.mesh.add(hitbox);
  }

  createHorns() {
    const hornPositions = [
      { x: -0.45, y: 1.2, z: 0.6 },
      { x: 0.45, y: 1.2, z: 0.6 }
    ];

    hornPositions.forEach((pos, idx) => {
      const hornGroup = new THREE.Group();
      const geo = getGeo(0.225);
      const hornMat = new THREE.MeshBasicMaterial({
        color: 0xeee6d7,
        transparent: true,
        opacity: 0.9
      });

      // Horn (tapered up)
      for (let i = 0; i < 4; i++) {
        const cube = new THREE.Mesh(geo, hornMat.clone());
        cube.position.set(pos.x, pos.y + i * 0.18, pos.z + i * 0.12);
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
    const phaseThreshold2 = this.maxHp * (2 / 3);
    const phaseThreshold1 = this.maxHp * (1 / 3);
    const newPhase = this.hp > phaseThreshold2 ? 1 : this.hp > phaseThreshold1 ? 2 : 3;

    if (this.skullPhase === 0) {
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

    // Ground slam on timer (independent of lunges)
    this.slamTimer -= dt;
    if (this.slamTimer <= 0) {
      this.slamTimer = this.slamRate;
      this.groundSlam(playerPos);
    }

    // Lunge state machine
    switch (this.lungePhase) {
      case 'idle':
        this.startLunge(playerPos, phaseConfig);
        break;

      case 'lunging':
        this.updateLunge(dt, playerPos, phaseConfig);
        break;

      case 'recovery':
        this.lungeTimer -= dt;
        if (this.lungeTimer <= 0) {
          this.lungePhase = 'idle';
        }
        break;
    }

    this.mesh.lookAt(_look.copy(playerPos).setY(this.mesh.position.y));
  }

  startLunge(playerPos, phaseConfig) {
    this.lungePhase = 'lunging';
    this.lungeTimer = 0;
    this.lungeDuration = phaseConfig.lungeDuration;
    this.lungeRecoveryTime = phaseConfig.recoveryTime;
    this.shardFiredThisLunge = false;

    // Alternate side: left of player, then right of player, repeat
    this.lungeSide *= -1;

    // Calculate player's forward direction (horizontal only)
    const fwd = new THREE.Vector3(0, 0, -1);
    if (typeof cameraRef !== 'undefined' && cameraRef) {
      fwd.set(0, 0, -1).applyQuaternion(cameraRef.quaternion);
      fwd.y = 0;
      fwd.normalize();
    }
    const right = new THREE.Vector3(-fwd.z, 0, fwd.x); // perpendicular right

    // Start position: current position
    this.lungeStartPos.copy(this.mesh.position);

    // End position: opposite side of player
    const lateralDist = 8; // How far left/right from player
    const fwdDist = 6;     // How far in front of player
    const endBase = playerPos.clone().add(fwd.clone().multiplyScalar(fwdDist));
    const lateralOffset = right.clone().multiplyScalar(this.lungeSide * lateralDist);
    endBase.add(lateralOffset);

    // Y logic for diagonal lunges
    const diagonalEvery = phaseConfig.diagonalEvery;
    const isDiagonalLunge = diagonalEvery < Infinity &&
      (this.lungeCount + 1) % diagonalEvery === 0;

    this.lungeEndPos.copy(endBase);
    if (isDiagonalLunge) {
      this.lungeEndPos.y = this.currentY < 4 ? 5 : 1.5;
    } else {
      this.lungeEndPos.y = this.currentY;
    }
  }

  updateLunge(dt, playerPos, phaseConfig) {
    this.lungeTimer += dt;
    const t = Math.min(this.lungeTimer / this.lungeDuration, 1.0);

    // Ease-out interpolation
    const easedT = 1 - (1 - t) * (1 - t);

    // Interpolate position directly
    this.mesh.position.lerpVectors(this.lungeStartPos, this.lungeEndPos, easedT);
    this.currentY = this.mesh.position.y;

    // Fire projectiles during the fast part (first 30% of lunge)
    if (t < 0.3 && !this.shardFiredThisLunge) {
      this.shardFiredThisLunge = true;
      const burstCount = this.skullPhase >= 2 ? 2 : 1;
      for (let b = 0; b < burstCount; b++) {
        this.later(b * 150, () => {
          this.fireHornShards(playerPos);
        });
      }
    }

    // Lunge complete
    if (t >= 1.0) {
      this.lungeCount++;
      this.currentY = this.lungeEndPos.y;
      this.lungePhase = 'recovery';
      this.lungeTimer = this.lungeRecoveryTime;
    }
  }

  getCurrentDist(playerPos) {
    const dx = this.mesh.position.x - playerPos.x;
    const dz = this.mesh.position.z - playerPos.z;
    return Math.sqrt(dx * dx + dz * dz);
  }

  getMinotaurPhaseConfig() {
    switch (this.skullPhase) {
      case 1:
        return { lungeDuration: 2.0, recoveryTime: 0.8, diagonalEvery: Infinity, shardRate: 0.7 };
      case 2:
        return { lungeDuration: 1.4, recoveryTime: 0.5, diagonalEvery: 3, shardRate: 0.5 };
      case 3:
        return { lungeDuration: 1.0, recoveryTime: 0.3, diagonalEvery: 2, shardRate: 0.35 };
      default:
        return { lungeDuration: 2.0, recoveryTime: 0.8, diagonalEvery: Infinity, shardRate: 0.7 };
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
    // Legacy constraint - kept for compatibility but lunges handle positioning
    const bound = 15;
    this.mesh.position.x = Math.max(-bound, Math.min(bound, this.mesh.position.x));
    this.mesh.position.z = Math.max(-bound, Math.min(bound, this.mesh.position.z));
  }

  onMinotaurPhaseChange(newPhase) {
    const config = this.getMinotaurPhaseConfig();
    this.shardRate = config.shardRate;
    this.slamRate = newPhase === 3 ? 2.5 : newPhase === 2 ? 3.5 : 5.0;
    _log(`[MinotaurBoss] Phase ${newPhase} config applied: lungeDur=${config.lungeDuration}s, recovery=${config.recoveryTime}s, diagEvery=${config.diagonalEvery}`);
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

      this.later(i * 50, () => {
        if (typeof spawnBossProjectile === 'function') {
          const fromPos = this.mesh.position.clone().add(new THREE.Vector3(0, 1.5, 0));
          spawnBossProjectile(fromPos, targetPos);
        }
      });
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

      this.later(200, () => {
        if (typeof spawnBossProjectile === 'function') {
          // Add some spread
          const spread = (idx === 0 ? -1 : 1) * 0.3;
          const target = playerPos.clone();
          target.x += spread;
          spawnBossProjectile(hornPos, target);
        }
      });
    });
  }

  takeDamage(amount, hitInfo = {}) {
    // Immune during phase transitions
    if (this.transitioning) {
      return { killed: false, immune: true };
    }

    // Minotaur takes reduced damage during the fast part of a lunge
    let damageTaken = amount;
    if (this.lungePhase === 'lunging') {
      const t = Math.min(this.lungeTimer / this.lungeDuration, 1.0);
      if (t < 0.3) {
        damageTaken = amount * 0.4;
      }
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

    // Phase system state
    this.skullPhase = 0;
    this.transitioning = false;
    this.transitionTimer = 0;
    this.transitionDuration = 4.5; // Longer for split cinematic
    this.transitionFromPhase = 0;
    this.transitionToPhase = 0;
    this.moveTimer = 0;
    this.moveDirection = new THREE.Vector3();
    this.fixedY = 1.5;

    // Phase 1 state
    this.prismSpinSpeed = 0.3; // Slow Y-axis spin (radians/sec)
    this.vulnerableFacetIndex = 0;
    this.facetRotateTimer = 0;
    this.facetRotateRate = 4.0;
    this.healAmount = 15;
    this.facetHps = [350, 350, 350];
    this.facetsDestroyed = 0;
    this.shootTimer = 0;

    // Phase 2 state
    this.shards = [];
    this.coreShardIndex = 0;
    this.coreSwapTimer = 0;
    this.coreSwapRate = 5.0;
    this.mergeTimer = 0;
    this.mergeRate = 12.0;
    this.isMerged = false;
    this.mergeCooldownTimer = 0;

    // Split cinematic state
    this.splitCinematicPhase = 'none'; // none, centering, spinup, splitting, done
    this.splitCinematicTimer = 0;
    this.shardSpawnPositions = [];

    // Rejoin cinematic state
    this.rejoinPhase = 'none'; // none, converging, spinning, bursting, done
    this.rejoinTimer = 0;

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

    // Facet colors (3 facets: red, blue, green)
    this.facetColors = [0xff2222, 0x2222ff, 0x22ff22];
    this.facetMaterials = [];
    this.pendingCenterReset = false;

    // Build custom visuals
    this.buildPrismMesh();
  }

  // ── MESH BUILDING ────────────────────────────────────────
  buildPrismMesh() {
    // Clear default mesh children
    while (this.mesh.children.length > 0) {
      const child = this.mesh.children[0];
      this.mesh.remove(child);
      if (child.geometry) child.geometry.dispose();
      if (child.material) {
        if (Array.isArray(child.material)) child.material.forEach(m => m.dispose());
        else child.material.dispose();
      }
    }

    // Build a 3-faceted tall diamond/crystal shape
    const radius = 1.8;
    // OctahedronGeometry(radius, 0) gives 8 triangular faces (4 upper, 4 lower)
    // We want 3 visible facets, so we use a custom approach:
    // Create an octahedron and group into 3 facet groups
    const geo = new THREE.OctahedronGeometry(radius, 0);
    // Scale Y to make it taller (diamond-like)
    const posAttr = geo.getAttribute('position');
    for (let i = 0; i < posAttr.count; i++) {
      posAttr.setY(i, posAttr.getY(i) * 1.6);
    }
    posAttr.needsUpdate = true;
    geo.computeVertexNormals();

    // Octahedron has 8 faces. Group into 3 facet groups.
    // Face indices 0-1 → facet 0, 2-3 → facet 1, 4-5 → facet 2, 6-7 → facet 2 (overflow)
    // But since OctahedronGeometry is non-indexed, use position count
    const indexCount = geo.index ? geo.index.count : posAttr.count;
    const faceCount = Math.floor(indexCount / 3);

    this.facetMaterials = this.facetColors.map(c =>
      new THREE.MeshBasicMaterial({
        color: c, transparent: true, opacity: 0.95
      })
    );

    // Distribute faces across 3 facet groups
    const facesPerGroup = Math.ceil(faceCount / 3);
    for (let g = 0; g < 3; g++) {
      const start = g * facesPerGroup;
      const count = Math.min(facesPerGroup, faceCount - start);
      if (count > 0) {
        geo.addGroup(start * 3, count * 3, g);
      }
    }

    // Glow material for vulnerable facet indicator (index 3)
    this.vulnerableGlowMat = new THREE.MeshBasicMaterial({
      color: 0xffffff, transparent: true, opacity: 0.95
    });
    this.facetMaterials.push(this.vulnerableGlowMat);

    this.prismMesh = new THREE.Mesh(geo, this.facetMaterials);
    this.prismMesh.renderOrder = 2;
    this.prismMesh.userData.isBossBody = true;
    this.mesh.add(this.prismMesh);

    // Store face group data
    this.faceGroupCount = 3;
    this.facesPerGroup = facesPerGroup;

    // Hitbox (bigger for the larger prism)
    const hitboxMat = new THREE.MeshBasicMaterial({ visible: false });
    const hitbox = new THREE.Mesh(
      getHitboxGeo(4, 4, 4), hitboxMat
    );
    hitbox.userData.isBossHitbox = true;
    this.mesh.add(hitbox);

    // Vulnerable facet indicator: glowing ring around the weak facet
    const ringGeo = new THREE.TorusGeometry(2.0, 0.08, 8, 24);
    this.vulnerableRingMat = new THREE.MeshBasicMaterial({
      color: 0xffffff, transparent: true, opacity: 0.9
    });
    this.vulnerableRing = new THREE.Mesh(ringGeo, this.vulnerableRingMat);
    this.vulnerableRing.rotation.x = Math.PI / 2; // Lay flat
    this.mesh.add(this.vulnerableRing);

    // Floating arrow indicator pointing at vulnerable facet
    const arrowGeo = new THREE.ConeGeometry(0.2, 0.6, 4);
    const arrowMat = new THREE.MeshBasicMaterial({
      color: 0xffff00, transparent: true, opacity: 0.95
    });
    this.vulnerableArrow = new THREE.Mesh(arrowGeo, arrowMat);
    this.vulnerableArrow.name = 'prism-vulnerable-arrow';
    this.mesh.add(this.vulnerableArrow);

    // Add invisible hitbox meshes per face group for facet detection (3 facets)
    this.facetHitboxes = [];
    for (let i = 0; i < 3; i++) {
      const angle = (i / 3) * Math.PI * 2;
      const hitGeo = new THREE.BoxGeometry(1.8, 1.8, 0.5);
      const hitMat = new THREE.MeshBasicMaterial({ visible: false });
      const hitMesh = new THREE.Mesh(hitGeo, hitMat);
      hitMesh.position.set(Math.sin(angle) * 1.2, 0, Math.cos(angle) * 1.2);
      hitMesh.rotation.y = angle;
      hitMesh.userData.isFacet = true;
      hitMesh.userData.facetIndex = i;
      this.facetHitboxes.push(hitMesh);
      this.mesh.add(hitMesh);
    }

    // Mark first facet as vulnerable
    this.updateVulnerableFacet(0);
  }

  updateVulnerableFacet(newIndex) {
    // Restore previous facet's original color and full opacity
    const prevMat = this.facetMaterials[this.vulnerableFacetIndex];
    if (prevMat) {
      prevMat.color.setHex(this.facetColors[this.vulnerableFacetIndex]);
      prevMat.opacity = 0.95;
      prevMat.color.setHex(this.facetColors[this.vulnerableFacetIndex]);
    }

    this.vulnerableFacetIndex = newIndex;

    // Glow the new vulnerable facet white and bright
    const newMat = this.facetMaterials[newIndex];
    if (newMat) {
      newMat.color.setHex(0xffffff);
      newMat.opacity = 1.0;
    }

    // Dim non-vulnerable facets to make the vulnerable one stand out
    this.facetMaterials.forEach((mat, i) => {
      if (i < 3 && i !== newIndex) {
        mat.opacity = 0.4;
        mat.color.setHex(this.facetColors[i]);
      }
    });

    // Update facet hitbox weak points
    this.facetHitboxes.forEach((hb, i) => {
      hb.userData.isWeakPoint = (i === newIndex);
    });

    // Position the ring and arrow around the vulnerable facet
    const angle = (newIndex / 3) * Math.PI * 2;
    if (this.vulnerableRing) {
      this.vulnerableRing.position.set(Math.sin(angle) * 0.3, 0, Math.cos(angle) * 0.3);
      // Rotate ring to face the facet direction
      this.vulnerableRing.rotation.set(Math.PI / 2, -angle, 0);
      this.vulnerableRing.visible = true;
    }
    if (this.vulnerableArrow) {
      const arrowDist = 2.8;
      this.vulnerableArrow.position.set(
        Math.sin(angle) * arrowDist,
        1.2 + Math.sin(Date.now() * 0.003) * 0.2,
        Math.cos(angle) * arrowDist
      );
      // Point arrow toward the facet
      this.vulnerableArrow.lookAt(0, this.vulnerableArrow.position.y, 0);
      this.vulnerableArrow.visible = true;
    }
  }

  // ── PHASE 1: Learn the Angles ───────────────────────────
  initPhase1() {
    this.skullPhase = 1;
    this.phase = 1;
    this.facetRotateTimer = 0;
    this.shootTimer = 0;
    this.prismSpinSpeed = 0.3;

    // Show prism mesh
    if (this.prismMesh) this.prismMesh.visible = true;
    this.facetHitboxes.forEach(hb => { hb.visible = true; });

    _log('[PrismBoss] Entering Phase 1: Learn the Angles');
  }

  updatePhase1(dt, now, playerPos) {
    const config = this.getPrismPhaseConfig();

    // Slow continuous spin
    if (this.prismMesh) {
      this.prismMesh.rotation.y += this.prismSpinSpeed * dt;
    }
    // Spin facet hitboxes too so they stay aligned
    this.facetHitboxes.forEach(hb => {
      // They're children of this.mesh, so their local rotation tracks with prismMesh
    });

    // Vulnerable facet glow pulsing - aggressive
    const glowMat = this.facetMaterials[this.vulnerableFacetIndex];
    if (glowMat) {
      const pulse = 0.6 + 0.4 * Math.sin(now * 0.008);
      glowMat.opacity = pulse;
      // Emissive-like color shift between white and facet color
      const flash = Math.abs(Math.sin(now * 0.006));
      glowMat.color.setRGB(1.0, 1.0, 1.0);
    }

    // Scale pulse on the vulnerable facet hitbox for visual emphasis
    if (this.facetHitboxes[this.vulnerableFacetIndex]) {
      const scalePulse = 1.0 + 0.15 * Math.sin(now * 0.008);
      this.facetHitboxes[this.vulnerableFacetIndex].scale.setScalar(scalePulse);
    }

    // Pulse the vulnerable ring
    if (this.vulnerableRingMat) {
      this.vulnerableRingMat.opacity = 0.5 + 0.5 * Math.abs(Math.sin(now * 0.006));
    }
    if (this.vulnerableRing) {
      const ringPulse = 1.0 + 0.1 * Math.sin(now * 0.007);
      this.vulnerableRing.scale.setScalar(ringPulse);
    }

    // Bob the arrow indicator
    if (this.vulnerableArrow && this.vulnerableArrow.visible) {
      const arrowAngle = (this.vulnerableFacetIndex / 3) * Math.PI * 2;
      const arrowDist = 2.8;
      this.vulnerableArrow.position.set(
        Math.sin(arrowAngle) * arrowDist,
        1.2 + Math.sin(now * 0.003) * 0.3,
        Math.cos(arrowAngle) * arrowDist
      );
    }

    // Facet rotation timer (swap vulnerable facet)
    this.facetRotateTimer += dt;
    if (this.facetRotateTimer >= this.facetRotateRate) {
      this.facetRotateTimer = 0;
      let newIdx;
      do {
        newIdx = Math.floor(Math.random() * 3);
      } while (newIdx === this.vulnerableFacetIndex && this.facetsDestroyed < 2);
      this.updateVulnerableFacet(newIdx);
    }

    // Fire projectiles from non-vulnerable faces
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
    // Fire from boss position toward player (skip vulnerable facet)
    const bossPos = this.mesh.position.clone();

    if (this.telegraphing) {
      this.showTelegraph('projectile', 0.3, 0xff44ff, bossPos);
    }

    this.later(300, () => {
      if (typeof spawnBossProjectile !== 'function') return;
      // Fire 2-3 projectiles aimed slightly off-center
      const count = 2 + Math.floor(Math.random() * 2);
      for (let i = 0; i < count; i++) {
        const target = playerPos.clone();
        target.x += (Math.random() - 0.5) * 1.5;
        target.y += (Math.random() - 0.5) * 0.8;
        target.z += (Math.random() - 0.5) * 1.5;
        spawnBossProjectile(bossPos, target);
      }
    });
  }

  // ── PHASE 2: The Split (with cinematic) ─────────────────
  initPhase2() {
    this.skullPhase = 2;
    this.phase = 2;
    this.shootTimer = 0;
    this.coreSwapTimer = 0;
    this.mergeTimer = 0;
    this.isMerged = false;
    this.mergeCooldownTimer = 5.0; // Delay before first merge

    // Start split cinematic instead of immediate split
    this.splitCinematicPhase = 'centering';
    this.splitCinematicTimer = 0;
    this.transitioning = true; // Invulnerable during cinematic

    // Hide vulnerable indicators during split cinematic
    if (this.vulnerableRing) this.vulnerableRing.visible = false;
    if (this.vulnerableArrow) this.vulnerableArrow.visible = false;

    _log('[PrismBoss] Phase 2: Starting split cinematic');
  }

  updateSplitCinematic(dt, now, playerPos) {
    this.splitCinematicTimer += dt;

    switch (this.splitCinematicPhase) {
      case 'centering': {
        // Move boss to center in front of player (1.5 seconds)
        const targetPos = playerPos.clone();
        const dir = new THREE.Vector3(0, 0, -1);
        // Apply camera direction if available, otherwise default forward
        targetPos.addScaledVector(dir, 8);
        targetPos.y = this.fixedY;

        const lerp = Math.min(1, dt * 3.0);
        this.mesh.position.lerp(targetPos, lerp);

        // Stop facet rotation, mark transitioning
        if (this.splitCinematicTimer >= 1.5) {
          this.splitCinematicPhase = 'spinup';
          this.splitCinematicTimer = 0;
          playSkullPhaseSound();
        }
        break;
      }

      case 'spinup': {
        // Spin faster and faster (1 → 5 rotations/sec over 3 seconds)
        const progress = Math.min(this.splitCinematicTimer / 3.0, 1.0);
        const spinRate = (1.0 + progress * 4.0) * Math.PI * 2; // radians/sec
        if (this.prismMesh) {
          this.prismMesh.rotation.y += spinRate * dt;
        }

        // Motion blur: pulse scale as spin gets faster
        const blurAmount = progress * 0.3;
        const scaleX = 1.0 + blurAmount * Math.abs(Math.sin(this.splitCinematicTimer * 20));
        const scaleY = 1.0 - blurAmount * 0.5;
        const scaleZ = 1.0 + blurAmount * Math.abs(Math.cos(this.splitCinematicTimer * 20));
        this.mesh.scale.set(scaleX, scaleY, scaleZ);

        // All facets glow brighter as spin accelerates
        const brightness = 0.95 + progress * 0.05;
        this.facetMaterials.forEach((mat, i) => {
          if (i < 3) {
            mat.color.setHex(0xffffff);
            mat.opacity = brightness;
          }
        });

        // Fire wild projectiles during the spin, staggered across 3 seconds
        // Fire ~10 projectiles spread across the spin duration
        const totalProjectiles = 10;
        const fireInterval = 3.0 / totalProjectiles;
        const expectedShots = Math.floor(this.splitCinematicTimer / fireInterval);
        if (!this._spinShotsFired) this._spinShotsFired = 0;
        while (this._spinShotsFired < expectedShots && this._spinShotsFired < totalProjectiles) {
          const bossPos = this.mesh.position.clone();
          // Fire in random directions as boss spins
          const randAngle = Math.random() * Math.PI * 2;
          const spreadH = 2.0 + Math.random() * 3.0;
          const target = playerPos.clone();
          target.x += Math.cos(randAngle) * spreadH;
          target.z += Math.sin(randAngle) * spreadH;
          target.y += (Math.random() - 0.5) * 2.0;
          const arcHeight = 2.0 + Math.random() * 4.0;
          if (typeof spawnBossProjectile === 'function') {
            spawnBossProjectile(bossPos, target, true, arcHeight);
          }
          this._spinShotsFired++;
        }

        playSkullHandGrowlSound();

        if (this.splitCinematicTimer >= 3.0) {
          this.splitCinematicPhase = 'splitting';
          this.splitCinematicTimer = 0;
          this.mesh.scale.setScalar(1.0);
          this._spinShotsFired = 0;
        }
        break;
      }

      case 'splitting': {
        // Hide prism, create shards that fly outward
        if (this.prismMesh) this.prismMesh.visible = false;
        this.facetHitboxes.forEach(hb => { hb.visible = false; });
        if (this.vulnerableRing) this.vulnerableRing.visible = false;
        if (this.vulnerableArrow) this.vulnerableArrow.visible = false;

        // Create the 3 shards with outward animation (projectiles fired during spinup)
        this.createShards();

        // Animate shards flying outward over 1 second
        const splitProgress = Math.min(this.splitCinematicTimer / 1.0, 1.0);
        const easeOut = 1 - Math.pow(1 - splitProgress, 3);
        this.shards.forEach((shard, i) => {
          const targetR = shard.userData.orbitRadius;
          const currentR = easeOut * targetR;
          const a = shard.userData.angle;
          shard.position.set(
            Math.cos(a) * currentR,
            shard.userData.orbitHeight * easeOut,
            Math.sin(a) * currentR
          );
          shard.scale.setScalar(easeOut);
        });

        if (this.splitCinematicTimer >= 1.0) {
          this.splitCinematicPhase = 'done';
          this.transitioning = false;
          this.mesh.scale.setScalar(1.0);
          _log('[PrismBoss] Split cinematic complete, shards active');
        }
        break;
      }
    }
  }

  createShards() {
    const shardColors = [0xff2222, 0x2222ff, 0x22ff22];
    const orbitRadii = [2.5, 4.0, 5.5];
    const orbitSpeeds = [1.2, 0.8, 0.5];
    const orbitHeights = [0, 1.5, -1.0];

    for (let i = 0; i < 3; i++) {
      const shard = new THREE.Group();

      // Build shard as a tapered crystal shape using flat-shaded geometry
      const shardGeo = new THREE.ConeGeometry(0.5, 1.4, 4, 1);
      const shardMat = new THREE.MeshBasicMaterial({
        color: shardColors[i], transparent: true, opacity: 0.9
      });
      const shardMesh = new THREE.Mesh(shardGeo, shardMat);
      shardMesh.userData.isBossBody = true;
      shard.add(shardMesh);

      // Core indicator (white dot)
      const coreGeo = new THREE.SphereGeometry(0.15, 8, 8);
      const coreMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
      const core = new THREE.Mesh(coreGeo, coreMat);
      core.name = 'prism-weak-point-core';
      core.visible = (i === 0);
      core.userData.isWeakPoint = (i === 0);
      core.userData.isPrismCore = true;
      core.position.y = -0.3;
      shard.add(core);

      shard.userData.shardIndex = i;
      shard.userData.orbitRadius = orbitRadii[i];
      shard.userData.orbitSpeed = orbitSpeeds[i];
      shard.userData.orbitHeight = orbitHeights[i];
      shard.userData.angle = (i / 3) * Math.PI * 2;
      shard.scale.setScalar(0); // Start invisible for split animation

      this.shards.push(shard);
      this.mesh.add(shard);
    }
  }

  fireSplitBurst(playerPos) {
    // Fire 10 lobbed seeker projectiles at various arcs toward the player
    const bossPos = this.mesh.position.clone();
    const count = 10;
    for (let i = 0; i < count; i++) {
      const angle = (i / count) * Math.PI * 2;
      // Spread targets around and above the player
      const spreadH = 3.0;
      const spreadV = 2.0;
      const target = playerPos.clone();
      target.x += Math.cos(angle) * spreadH;
      target.z += Math.sin(angle) * spreadH;
      target.y += (Math.random() * spreadV) - 0.5;

      // Use lobbed projectiles with varied arc heights
      const arcHeight = 3.0 + Math.random() * 5.0;

      this.later(i * 60, () => {
        if (typeof spawnBossProjectile === 'function') {
          spawnBossProjectile(bossPos.clone(), target, true, arcHeight);
        }
      });
    }
  }

  updatePhase2(dt, now, playerPos) {
    const config = this.getPrismPhaseConfig();

    // Handle split cinematic
    if (this.splitCinematicPhase !== 'none' && this.splitCinematicPhase !== 'done') {
      this.updateSplitCinematic(dt, now, playerPos);
      return;
    }

    // Handle rejoin cinematic
    if (this.rejoinPhase !== 'none' && this.rejoinPhase !== 'done') {
      this.updateRejoinCinematic(dt, now, playerPos);
      return;
    }

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
      this.startRejoin();
    }

    if (this.isMerged) {
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
      shard.lookAt(_look.copy(playerPos).setY(this.mesh.position.y + shard.userData.orbitHeight));
      // Slow spin each shard
      shard.rotation.y += 1.5 * dt;
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
    this.shards.forEach(shard => {
      shard.traverse(child => {
        if (child.userData.isPrismCore) {
          child.visible = false;
          child.userData.isWeakPoint = false;
        }
      });
    });

    let newIdx;
    do {
      newIdx = Math.floor(Math.random() * 3);
    } while (newIdx === this.coreShardIndex);
    this.coreShardIndex = newIdx;

    if (this.telegraphing) {
      this.showTelegraph('teleport', 0.3, 0xffffff);
    }

    this.shards[newIdx].traverse(child => {
      if (child.userData.isPrismCore) {
        child.visible = true;
        child.userData.isWeakPoint = true;
      }
    });
  }

  // ── REJOIN CINEMATIC ────────────────────────────────────
  startRejoin() {
    this.rejoinPhase = 'converging';
    this.rejoinTimer = 0;
    this.isMerged = true;
    this.mergeTimer = this.mergeRate;
    this.transitioning = true; // Invulnerable during rejoin

    playSkullHandGrowlSound();
    _log('[PrismBoss] Starting rejoin cinematic');
  }

  updateRejoinCinematic(dt, now, playerPos) {
    this.rejoinTimer += dt;

    switch (this.rejoinPhase) {
      case 'converging': {
        // Shards fly to center (1.5 seconds)
        const progress = Math.min(this.rejoinTimer / 1.5, 1.0);
        const easeIn = progress * progress;

        this.shards.forEach(shard => {
          const targetR = 0;
          const currentR = shard.userData.orbitRadius * (1 - easeIn);
          const a = shard.userData.angle;
          shard.position.set(
            Math.cos(a) * currentR,
            shard.userData.orbitHeight * (1 - easeIn),
            Math.sin(a) * currentR
          );
          shard.scale.setScalar(1 - easeIn * 0.5);
        });

        if (this.rejoinTimer >= 1.5) {
          this.rejoinPhase = 'spinning';
          this.rejoinTimer = 0;
          playSkullPhaseSound();
          // Hide shards
          this.shards.forEach(s => { s.visible = false; });
          // Show prism briefly
          if (this.prismMesh) this.prismMesh.visible = true;
        }
        break;
      }

      case 'spinning': {
        // Show merged prism spinning (1.5 seconds)
        if (this.prismMesh) {
          const spinRate = 8.0 * Math.PI * 2; // Very fast spin
          this.prismMesh.rotation.y += spinRate * dt;
          this.prismMesh.visible = true;
        }

        // Flash all facets white
        this.facetMaterials.forEach((mat, i) => {
          if (i < 3) {
            mat.color.setHex(0xffffff);
            mat.opacity = 0.9 + 0.1 * Math.sin(this.rejoinTimer * 30);
          }
        });

        const pulse = 1.0 + 0.2 * Math.sin(this.rejoinTimer * 15);
        this.mesh.scale.setScalar(pulse);

        if (this.rejoinTimer >= 1.5) {
          this.rejoinPhase = 'bursting';
          this.rejoinTimer = 0;
          this.mesh.scale.setScalar(1.0);

          // Fire projectile burst
          this.fireSplitBurst(playerPos);
        }
        break;
      }

      case 'bursting': {
        // Re-show shards flying back out (1 second)
        if (this.prismMesh) this.prismMesh.visible = false;
        this.shards.forEach(s => { s.visible = true; });

        const progress = Math.min(this.rejoinTimer / 1.0, 1.0);
        const easeOut = 1 - Math.pow(1 - progress, 3);

        this.shards.forEach((shard, i) => {
          const targetR = shard.userData.orbitRadius;
          const currentR = easeOut * targetR;
          const a = shard.userData.angle;
          shard.position.set(
            Math.cos(a) * currentR,
            shard.userData.orbitHeight * easeOut,
            Math.sin(a) * currentR
          );
          shard.scale.setScalar(0.5 + easeOut * 0.5);
        });

        if (this.rejoinTimer >= 1.0) {
          this.rejoinPhase = 'done';
          this.transitioning = false;
          this.mesh.scale.setScalar(1.0);

          // Reset facet colors
          this.facetMaterials.forEach((mat, i) => {
            if (i < 3) mat.color.setHex(this.facetColors[i]);
          });

          _log('[PrismBoss] Rejoin complete, shards active again');
        }
        break;
      }
    }
  }

  startMerge() {
    this.isMerged = true;
    this.mergeTimer = this.mergeRate;

    if (this.telegraphing) {
      this.showTelegraph('charge', 1.0, 0xff44ff);
    }
    playSkullHandGrowlSound();

    this.shards.forEach(shard => {
      shard.position.set(0, 0, 0);
    });

    this.later(1500, () => {
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
    });
  }

  endMerge() {
    this.isMerged = false;
    this.mergeTimer = 0;
    this.mergeCooldownTimer = 3.0;
  }

  fireShardProjectiles(playerPos) {
    this.shards.forEach((shard, idx) => {
      if (!shard.visible || !shard.parent) return;
      const shardPos = shard.getWorldPosition(new THREE.Vector3());

      if (this.telegraphing) {
        this.showTelegraph('projectile', 0.2, 0xff44ff, shardPos);
      }

      this.later(200, () => {
        if (typeof spawnBossProjectile !== 'function') return;

        if (idx === 0) {
          spawnBossProjectile(shardPos, playerPos.clone());
        } else if (idx === 1) {
          for (let s = -1; s <= 1; s++) {
            const target = playerPos.clone();
            target.x += s * 0.5;
            target.y += s * 0.2;
            spawnBossProjectile(shardPos, target);
          }
        } else {
          spawnBossProjectile(shardPos, playerPos.clone());
        }
      });
    });
  }

  // ── PHASE 3: Overload ───────────────────────────────────
  initPhase3() {
    this.skullPhase = 3;
    this.phase = 3;
    this.isHealCharging = false;
    this.healChargeTimer = 0;
    this.phase3ShootTimer = 0;

    // Clean up shards
    this.shards.forEach(shard => {
      if (shard.parent) shard.parent.remove(shard);
      shard.traverse(child => {
        if (child.geometry) child.geometry.dispose();
        if (child.material) {
          if (Array.isArray(child.material)) child.material.forEach(m => m.dispose && m.dispose());
          else if (child.material.dispose) child.material.dispose();
        }
      });
    });
    this.shards = [];

    // Show prism body again (damaged look)
    if (this.prismMesh) {
      this.prismMesh.visible = true;
      // Darken facets for damaged look
      this.facetMaterials.forEach((mat, i) => {
        if (i < 3) {
          mat.color.setHex(0x881188);
          mat.opacity = 0.7;
        }
      });
    }
    this.facetHitboxes.forEach(hb => { hb.visible = false; });

    _log('[PrismBoss] Entering Phase 3: Overload');
  }

  updatePhase3(dt, now, playerPos) {
    const config = this.getPrismPhaseConfig();

    // Slow damaged spin in phase 3
    if (this.prismMesh) {
      this.prismMesh.rotation.y += 0.15 * dt;
    }

    // Continuous projectile fire
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

      if (this.weakPointsHit >= 3) {
        this.cancelHealCharge();
      } else if (this.healChargeProgress >= this.healChargeDuration) {
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

    this.later(200, () => {
      if (typeof spawnBossProjectile !== 'function') return;
      spawnBossProjectile(bossPos, playerPos.clone());

      if (this.healAttempts >= 2) {
        for (let s = -1; s <= 1; s += 2) {
          const target = playerPos.clone();
          target.x += s * 0.6;
          target.y += s * 0.2;
          spawnBossProjectile(bossPos, target);
        }
      }
    });
  }

  startHealCharge() {
    this.isHealCharging = true;
    this.healChargeProgress = 0;
    this.weakPointsHit = 0;
    this.healWeakPoints = [];

    if (this.telegraphing) {
      this.showTelegraph('charge', 0.5, 0x00ff00);
    }
    playSkullPhaseSound();

    for (let i = 0; i < 3; i++) {
      const wpGeo = new THREE.SphereGeometry(0.15, 8, 8);
      const wpMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
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

    const healAmount = Math.floor(this.maxHp * 0.25);
    this.hp = Math.min(this.maxHp, this.hp + healAmount);
    playSkullPhaseSound();
    this.cleanupHealWeakPoints();

    if (typeof updateBossHealthBar === 'function') {
      updateBossHealthBar(this.hp, this.maxHp, this.phases);
    }

    _log(`[PrismBoss] Heal complete! +${healAmount} HP. Attempt #${this.healAttempts}`);
  }

  cleanupHealWeakPoints() {
    this.healWeakPoints.forEach(wp => {
      const wpIdx = this.weakPoints.indexOf(wp);
      if (wpIdx !== -1) this.weakPoints.splice(wpIdx, 1);
      if (wp.parent) wp.parent.remove(wp);
      if (wp.geometry) wp.geometry.dispose();
      if (wp.material) wp.material.dispose();
    });
    this.healWeakPoints = [];
  }

  onHealWeakPointHit(wp) {
    this.weakPointsHit++;
    playSkullHandGrowlSound();

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
    this.pendingCenterReset = true; // Reset to center on first updateTransition frame

    // Hide vulnerable indicators during transition
    if (this.vulnerableRing) this.vulnerableRing.visible = false;
    if (this.vulnerableArrow) this.vulnerableArrow.visible = false;

    playSkullPhaseSound();
    playSkullHandGrowlSound();

    // Clean up shards if leaving phase 2
    if (fromPhase === 2) {
      this.shards.forEach(shard => {
        if (shard.parent) shard.parent.remove(shard);
        shard.traverse(child => {
          if (child.geometry) child.geometry.dispose();
          if (child.material) {
            if (Array.isArray(child.material)) child.material.forEach(m => m.dispose && m.dispose());
            else if (child.material.dispose) child.material.dispose();
          }
        });
      });
      this.shards = [];
    }

    _log(`[PrismBoss] Phase transition: ${fromPhase} -> ${toPhase}`);
  }

  updateTransition(dt, now, playerPos) {
    // On first frame, snap to center in front of player
    if (this.pendingCenterReset && playerPos) {
      const forward = new THREE.Vector3(0, 0, -1);
      const targetPos = playerPos.clone().addScaledVector(forward, 8);
      targetPos.y = this.fixedY;
      this.mesh.position.copy(targetPos);
      this.pendingCenterReset = false;
    }

    this.transitionTimer += dt;

    // Pulsing scale effect
    const pulse = 1.0 + 0.15 * Math.sin(this.transitionTimer * 8.0);
    this.mesh.scale.setScalar(pulse);

    // Spin prism during transition
    if (this.prismMesh) {
      this.prismMesh.rotation.y += 5.0 * dt;
    }

    // Body glow pulsing
    this.facetMaterials.forEach((mat, i) => {
      if (i < 3 && mat) {
        const glow = 0.3 + 0.7 * Math.abs(Math.sin(this.transitionTimer * 6.0));
        mat.opacity = glow;
      }
    });

    // Transition complete
    if (this.transitionTimer >= this.transitionDuration) {
      this.transitioning = false;
      this.mesh.scale.setScalar(1.0);

      // Reset facet colors and opacity
      this.facetMaterials.forEach((mat, i) => {
        if (i < 3) {
          mat.color.setHex(this.facetColors[i]);
          mat.opacity = 0.95;
        }
      });

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
      // Phase 2 split cinematic has its own update path
      if (this.skullPhase === 2 && this.splitCinematicPhase !== 'none' && this.splitCinematicPhase !== 'done') {
        this.updateSplitCinematic(dt, now, playerPos);
        this.mesh.lookAt(_look.copy(playerPos).setY(this.fixedY));
        return;
      }
      // Phase 2 rejoin cinematic has its own update path
      if (this.skullPhase === 2 && this.rejoinPhase !== 'none' && this.rejoinPhase !== 'done') {
        this.updateRejoinCinematic(dt, now, playerPos);
        this.mesh.lookAt(_look.copy(playerPos).setY(this.fixedY));
        return;
      }
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
    // Immune during phase transitions and cinematics
    if (this.transitioning) return { killed: false, immune: true };

    // Phase 1: facet targeting
    if (this.skullPhase === 1) {
      // Check if hit a specific facet
      const hitFacet = hitInfo.facetIndex;
      if (hitFacet !== undefined && hitFacet !== this.vulnerableFacetIndex) {
        // Wrong facet: heal boss
        this.hp = Math.min(this.maxHp, this.hp + this.healAmount);
        playSkullHandGrowlSound();
        return { killed: false, healed: true };
      }
      // Vulnerable facet hit or general body hit: damage
      if (hitFacet === this.vulnerableFacetIndex) {
        this.facetHps[hitFacet] -= amount;
        if (this.facetHps[hitFacet] <= 0 && this.facetsDestroyed < 3) {
          this.facetsDestroyed++;
          // Dim the destroyed facet
          const mat = this.facetMaterials[hitFacet];
          if (mat) {
            mat.opacity = 0.3;
          }
          playSkullHandGrowlSound();
        }
      }
      this.hp -= amount;
      if (this.hp < 0) this.hp = 0;

      const hpThreshold23 = this.maxHp * (2 / 3);
      if (this.facetsDestroyed >= 2 || this.hp <= hpThreshold23) {
        this.startPhaseTransition(1, 2);
        this.skullPhase = 2;
      }

      if (this.hp <= 0) return { killed: true };
      return { killed: false, facetDamaged: true };
    }

    // Phase 2: damage to boss HP (merge/cinematic = immune, handled above)
    if (this.skullPhase === 2) {
      if (this.isMerged) return { killed: false, immune: true };
      this.hp -= amount;
      if (this.hp < 0) this.hp = 0;

      const hpThreshold13 = this.maxHp * (1 / 3);
      if (this.hp > 0 && this.hp <= hpThreshold13) {
        this.startPhaseTransition(2, 3);
        this.skullPhase = 3;
      }

      if (this.hp <= 0) return { killed: true };
      return { killed: false };
    }

    // Phase 3: heal weak point check
    if (this.skullPhase === 3 && this.isHealCharging) {
      if (hitInfo.isHealWeakPoint) {
        const wpIndex = hitInfo.healWeakPointIndex;
        const wp = this.healWeakPoints.find(w => w.userData.healWeakPointIndex === wpIndex);
        if (wp) this.onHealWeakPointHit(wp);
        return { killed: false, healWeakPointHit: true };
      }
    }

    // Phase 3 default
    if (this.skullPhase === 3) {
      this.hp -= amount;
      if (this.hp < 0) this.hp = 0;
      if (this.hp <= 0) return { killed: true };
      return { killed: false };
    }

    return super.takeDamage(amount, hitInfo);
  }

  onPhaseChange(newPhase) {
    // Phase changes handled by skullPhase system
  }
}

// ── ECLIPSE ENGINE (Final Boss, Level 20) ───────────────────
const ECLIPSE_WALL_LEVEL = Object.freeze({
  hpMultiplier: 1,
  speedMultiplier: 1,
});

class EclipseEngineBoss extends Boss {
  constructor(def, levelConfig, sceneRef, telegraphing) {
    super(def, levelConfig, sceneRef, telegraphing);

    // VR-CRITICAL: This fight is heavily scripted. Explicit timers and state
    // keep the long encounter deterministic and prevent orphaned attacks.
    this.fixedY = 2.6;
    this.moveTimer = 0;
    this.moveDirection = new THREE.Vector3(1, 0, 0);
    this.moveTarget = new THREE.Vector3(0, this.fixedY, -14);
    this.phaseHeightPhase = Math.random() * Math.PI * 2;
    this.transitioning = false;
    this.transitionTimer = 0;
    this.transitionDuration = 3.1; // Long enough to read in-headset, short enough to keep tension
    this.pendingPhaseTransition = 0;

    // Phase floors deliberately force multiple windows so a stacked DPS build
    // cannot delete the climax in one exposure.
    this.phase2Threshold = this.maxHp * 0.72;
    this.phase3Threshold = this.maxHp * 0.42;
    this.lastStandThreshold = this.maxHp * 0.14;

    this.coreExposed = false;
    this.windowTimer = 0;
    this.windowDamageBudget = 0;
    this.windowDamageTaken = 0;
    this.forceCloseWindow = false;
    this.lastStand = false;

    this.sealNodes = [];
    this.anchorNodes = [];
    this.phase2WallEnemies = [];
    this.phase2WallType = 'swarm';
    this.phase2WallPatternIndex = 0;
    this.phase2WallSpawnIndex = 0;
    this.phase2WallSpawnTimer = 0;
    this.phase2WallTimer = 0;
    this.phase2WallReleaseTimer = 0;
    this.phase2InterruptTimer = 0;
    this.phase2InterruptBonus = 0;
    this.phase2WallTotalPlanned = 0;
    this.phase2ShockwaveStep = 0;

    this.volleyTimer = 0;
    this.lobTimer = 0;
    this.patternTimer = 0;
    this.coreShotTimer = 0;
    this.phase3MeteorTimer = 0;
    this.phase3BarrageTimer = 0;
    this.phase3CrackTimer = 0;
    this.phase3ShockwaveTimer = 0;
    this.phase1SealAttackIndex = 0;

    this.shellMeshes = [];
    this.heartMeshes = [];
    this.crownMeshes = [];
    this.ascensionMeshes = [];
    this.spireMeshes = [];
    this.crownEmitters = [];
    this.finalEmitters = [];

    this.visualSpin = 0;
    this.visualPulse = 0;
    this.currentScale = 1;
    this.targetScale = 1;

    this.phase2Formations = this.buildPhase2Formations();

    this.frontArc = 140;
    this.minDistance = 8;
    this.maxDistance = 22;

    this.buildEclipseMesh();
    this.enterPhase1();
  }

  // Build a small voxel cluster from shared cube geometry.
  // The cubes share cached geometry, so cleanup only disposes materials.
  createVoxelCluster(positions, size, color, opacity, userData = {}, collectInto = null) {
    const group = new THREE.Group();
    const geo = getGeo(size);

    positions.forEach((pos) => {
      const cube = new THREE.Mesh(
        geo,
        new THREE.MeshBasicMaterial({
          color,
          transparent: true,
          opacity,
          depthWrite: false,
          fog: false,
        }),
      );
      cube.position.set(pos[0], pos[1], pos[2]);
      Object.assign(cube.userData, userData);
      group.add(cube);
      if (collectInto) collectInto.push(cube);
    });

    return group;
  }

  buildEclipseMesh() {
    while (this.mesh.children.length > 0) {
      const child = this.mesh.children[0];
      this.mesh.remove(child);
      child.traverse?.((part) => {
        if (part.material) part.material.dispose();
      });
    }

    // Core shell: still readable as a heart-protecting machine, but taller so
    // phase-3 scale changes feel cathedral-sized instead of just "slightly larger".
    this.shellGroup = this.createVoxelCluster([
      [0, 1.05, 0],
      [0.35, 0.78, 0],
      [-0.35, 0.78, 0],
      [0.62, 0.38, 0],
      [-0.62, 0.38, 0],
      [0.74, 0, 0],
      [-0.74, 0, 0],
      [0.62, -0.38, 0],
      [-0.62, -0.38, 0],
      [0.35, -0.78, 0],
      [-0.35, -0.78, 0],
      [0, -1.05, 0],
      [0.22, 0.2, 0.26],
      [-0.22, 0.2, 0.26],
      [0.22, -0.2, 0.26],
      [-0.22, -0.2, 0.26],
    ], 0.24, 0x33ccff, 0.9, { isBossBody: true }, this.shellMeshes);
    this.mesh.add(this.shellGroup);

    this.spireGroup = this.createVoxelCluster([
      [0, 1.55, -0.08],
      [0, 1.95, -0.02],
      [0, 2.3, 0.0],
      [0, -1.45, -0.08],
      [0, -1.8, 0.0],
    ], 0.19, 0xffb46b, 0.78, { isBossBody: true }, this.spireMeshes);
    this.mesh.add(this.spireGroup);

    this.heartGroup = this.createVoxelCluster([
      [0, 0.2, 0.42],
      [0.22, 0.2, 0.3],
      [-0.22, 0.2, 0.3],
      [0.34, -0.08, 0.18],
      [-0.34, -0.08, 0.18],
      [0, -0.18, 0.28],
      [0, -0.42, 0.18],
    ], 0.19, 0xffffff, 0.95, { isEclipseHeart: true }, this.heartMeshes);
    this.mesh.add(this.heartGroup);

    this.crownGroup = new THREE.Group();
    const crownOffsets = [
      { pos: [2.1, 0.3, 0], rotY: 0 },
      { pos: [-2.1, 0.3, 0], rotY: Math.PI },
      { pos: [0, 0.9, 2.0], rotY: Math.PI / 2 },
      { pos: [0, 0.9, -2.0], rotY: -Math.PI / 2 },
    ];
    crownOffsets.forEach((cfg, idx) => {
      const arm = this.createVoxelCluster([
        [0, 0, 0],
        [0.34, 0.18, 0],
        [0.7, 0.12, 0],
        [0.98, -0.05, 0],
      ], 0.17, 0x7cf8ff, 0.74, { isBossBody: true }, this.crownMeshes);
      arm.position.set(cfg.pos[0], cfg.pos[1], cfg.pos[2]);
      arm.rotation.y = cfg.rotY;

      const tip = new THREE.Mesh(
        getGeo(0.2),
        new THREE.MeshBasicMaterial({
          color: 0xffc06d,
          transparent: true,
          opacity: 0.9,
          depthWrite: false,
          fog: false,
        }),
      );
      tip.position.set(1.32, -0.08, 0);
      tip.userData.isBossBody = true;
      arm.add(tip);
      this.crownEmitters[idx] = tip;
      this.crownMeshes.push(tip);
      this.crownGroup.add(arm);
    });
    this.mesh.add(this.crownGroup);

    this.ascensionGroup = new THREE.Group();
    this.ascensionGroup.visible = false;
    const ascensionOffsets = [
      { pos: [2.85, 1.25, 0], rotY: 0 },
      { pos: [-2.85, 1.25, 0], rotY: Math.PI },
      { pos: [0, 2.35, 2.6], rotY: Math.PI / 2 },
      { pos: [0, 2.35, -2.6], rotY: -Math.PI / 2 },
    ];
    ascensionOffsets.forEach((cfg, idx) => {
      const spike = this.createVoxelCluster([
        [0, 0, 0],
        [0.4, 0.25, 0],
        [0.82, 0.12, 0],
        [1.2, -0.02, 0],
        [1.56, -0.18, 0],
      ], 0.21, 0xff7a3d, 0.84, { isBossBody: true }, this.ascensionMeshes);
      spike.position.set(cfg.pos[0], cfg.pos[1], cfg.pos[2]);
      spike.rotation.y = cfg.rotY;

      const tip = new THREE.Mesh(
        getGeo(0.23),
        new THREE.MeshBasicMaterial({
          color: 0xfff4c2,
          transparent: true,
          opacity: 0.94,
          depthWrite: false,
          fog: false,
        }),
      );
      tip.position.set(1.88, -0.22, 0);
      tip.userData.isBossBody = true;
      spike.add(tip);
      this.finalEmitters[idx] = tip;
      this.ascensionMeshes.push(tip);
      this.ascensionGroup.add(spike);
    });
    this.mesh.add(this.ascensionGroup);

    const hitbox = new THREE.Mesh(
      getHitboxGeo(3.6, 5.8, 3.6),
      new THREE.MeshBasicMaterial({ visible: false }),
    );
    hitbox.userData.isBossHitbox = true;
    this.mesh.add(hitbox);
  }

  createWeakNode(id, type, color) {
    const group = new THREE.Group();
    group.name = `eclipse-${type}-${id}`;
    group.userData.eclipseNodeId = id;
    group.userData.eclipseNodeType = type;

    const geo = getGeo(type === 'anchor' ? 0.22 : 0.19);
    const positions = [
      [0, 0, 0.16],
      [0.18, 0, 0],
      [-0.18, 0, 0],
      [0, 0.18, 0],
      [0, -0.18, 0],
      [0, 0, -0.16],
    ];

    positions.forEach((pos, idx) => {
      const cube = new THREE.Mesh(
        geo,
        new THREE.MeshBasicMaterial({
          color: idx === 0 ? 0xffffff : color,
          transparent: true,
          opacity: 0.96,
          depthWrite: false,
          fog: false,
        }),
      );
      cube.position.set(pos[0], pos[1], pos[2]);
      cube.userData.isWeakPoint = true;
      cube.userData.eclipseNodeId = id;
      cube.userData.eclipseNodeType = type;
      group.add(cube);
    });

    // VR-CRITICAL: These sit far away and move on multiple height bands, so the
    // invisible hit area must be larger than the visible voxels to stay fair.
    const hitboxSize = type === 'anchor' ? 0.95 : 1.1;
    const hitbox = new THREE.Mesh(
      getHitboxGeo(hitboxSize, hitboxSize, hitboxSize),
      new THREE.MeshBasicMaterial({ visible: false }),
    );
    hitbox.userData.isWeakPoint = true;
    hitbox.userData.eclipseNodeId = id;
    hitbox.userData.eclipseNodeType = type;
    group.add(hitbox);

    group.scale.setScalar(type === 'anchor' ? 1.35 : 1.55);
    return group;
  }

  buildPhase2Formations() {
    const swarm = [];
    const tank = [];

    for (let row = 0; row < 5; row++) {
      for (let col = 0; col < 6; col++) {
        swarm.push(new THREE.Vector3(
          (col - 2.5) * 1.7,
          0.95 + row * 0.72 + ((row + col) % 2 === 0 ? 0.18 : -0.08),
          (row % 2 === 0 ? 0.0 : -0.45),
        ));
      }
    }

    for (let row = 0; row < 3; row++) {
      for (let col = 0; col < 4; col++) {
        tank.push(new THREE.Vector3(
          (col - 1.5) * 2.8,
          1.1 + row * 1.3,
          -row * 0.8,
        ));
      }
    }

    return { swarm, tank };
  }

  setHeartExposed(exposed) {
    this.coreExposed = exposed;
    this.heartMeshes.forEach((mesh) => {
      mesh.userData.isWeakPoint = exposed;
    });
  }

  clearWeakNodes(nodes) {
    if (!nodes || nodes.length === 0) return;
    nodes.forEach((node) => {
      node.active = false;
      if (node.group?.parent) node.group.parent.remove(node.group);
      node.group?.traverse((part) => {
        if (part.material) part.material.dispose();
      });
      node.group = null;
    });
    nodes.length = 0;
  }

  clearWallEnemies() {
    this.phase2WallEnemies.forEach((enemy) => {
      if (!enemy) return;
      enemy._eclipseHeld = false;
      enemy._eclipseHoldTarget = null;
      enemy._eclipseReleaseTimer = 0;
      enemy._eclipseReleaseVector = null;
    });
    this.phase2WallEnemies.length = 0;
  }

  enterPhase1() {
    this.phase = 1;
    this.state = 'phase1_sealed';
    this.fixedY = 2.6;
    this.targetScale = 1.15;
    this.volleyTimer = 1.65;
    this.lobTimer = 1.35;
    this.patternTimer = 5.8;
    this.windowTimer = 0;
    this.windowDamageBudget = 0;
    this.windowDamageTaken = 0;
    this.forceCloseWindow = false;
    this.setHeartExposed(false);
    this.clearWeakNodes(this.anchorNodes);
    this.clearWallEnemies();
    this.spawnPhase1Seals();
  }

  enterPhase2() {
    this.phase = 2;
    this.state = 'phase2_wall_setup';
    this.fixedY = 5.1;
    this.targetScale = 1.45;
    this.windowTimer = 0;
    this.windowDamageBudget = 0;
    this.windowDamageTaken = 0;
    this.forceCloseWindow = false;
    this.phase2InterruptTimer = 0;
    this.phase2ShockwaveStep = 0;
    this.phase2WallPatternIndex = 0;
    this.phase2InterruptBonus = 0;
    this.setHeartExposed(false);
    this.clearWeakNodes(this.sealNodes);
    this.clearWeakNodes(this.anchorNodes);
    this.clearWallEnemies();
    this.startWallPattern('swarm');
  }

  enterPhase3() {
    this.phase = 3;
    this.state = 'phase3_armor';
    this.fixedY = 7.1;
    this.targetScale = 3.2;
    this.phase3MeteorTimer = 0.7;
    this.phase3BarrageTimer = 2.1;
    this.phase3CrackTimer = 7.0;
    this.phase3ShockwaveTimer = 3.0;
    this.windowTimer = 0;
    this.forceCloseWindow = false;
    this.lastStand = false;
    this.setHeartExposed(false);
    this.clearWeakNodes(this.sealNodes);
    this.clearWeakNodes(this.anchorNodes);
    this.clearWallEnemies();
    if (this.ascensionGroup) this.ascensionGroup.visible = true;
  }

  spawnPhase1Seals() {
    this.clearWeakNodes(this.sealNodes);
    const configs = [
      { angle: 0.2, radius: 5.5, height: 3.7, speed: 0.72 },
      { angle: Math.PI * 0.86, radius: 6.1, height: -1.55, speed: -0.58 },
      { angle: Math.PI * 1.58, radius: 5.0, height: 1.2, speed: 0.94 },
    ];

    configs.forEach((cfg, idx) => {
      const group = this.createWeakNode(idx, 'seal', 0x59f7ff);
      group.position.set(Math.cos(cfg.angle) * cfg.radius, cfg.height, Math.sin(cfg.angle) * cfg.radius);
      this.mesh.add(group);
      this.sealNodes.push({
        id: idx,
        type: 'seal',
        hp: 78,
        angle: cfg.angle,
        radius: cfg.radius,
        height: cfg.height,
        speed: cfg.speed,
        active: true,
        group,
      });
    });
  }

  spawnPhase2Anchors() {
    this.clearWeakNodes(this.anchorNodes);
    const configs = [
      { offset: new THREE.Vector3(-4.7, 1.9, 0.6), bob: 0 },
      { offset: new THREE.Vector3(4.8, -1.2, -0.8), bob: Math.PI * 0.7 },
      { offset: new THREE.Vector3(0, 4.2, -1.3), bob: Math.PI * 1.2 },
    ];

    configs.forEach((cfg, idx) => {
      const group = this.createWeakNode(idx, 'anchor', 0xff9966);
      group.position.copy(cfg.offset);
      this.mesh.add(group);
      this.anchorNodes.push({
        id: idx,
        type: 'anchor',
        hp: 110,
        offset: cfg.offset.clone(),
        bob: cfg.bob,
        active: true,
        group,
      });
    });
  }

  startPhaseTransition(newPhase) {
    if (this.transitioning || newPhase <= this.phase) return;

    this.transitioning = true;
    this.transitionTimer = 0;
    this.pendingPhaseTransition = newPhase;
    this.state = 'transition';
    this.windowTimer = 0;
    this.forceCloseWindow = false;
    this.setHeartExposed(false);
    this.clearWeakNodes(this.sealNodes);
    this.clearWeakNodes(this.anchorNodes);
    this.clearWallEnemies();
    playFinalBossAscendSound();

    if (this.telegraphing) {
      this.telegraphing.start('teleport', 0.8, 0xffaa44, this.mesh.position.clone());
      this.telegraphing.start('pulse', 1.0, 0xffd07a, this.mesh.position.clone());
      this.telegraphing.start('shockwave', 1.15, 0xff6b33, this.mesh.position.clone());
    }
  }

  beginCoreWindow(duration, budgetRatio) {
    this.windowTimer = duration;
    this.windowDamageBudget = budgetRatio === Infinity ? Infinity : this.maxHp * budgetRatio;
    this.windowDamageTaken = 0;
    this.forceCloseWindow = false;
    this.coreShotTimer = 0.9;
    this.setHeartExposed(true);

    // The expose callout has to be unmistakable in VR or players miss the burn window.
    playFinalBossExposeSound();
    playFinalBossSealBreakSound();

    const heartPos = this.getHeartWorldPosition();
    if (this.telegraphing) {
      this.telegraphing.start('pulse', 0.85, 0xfff1b5, heartPos.clone());
      this.telegraphing.start('charge', 0.7, 0xffd27a, heartPos.clone());
    }
  }

  resolveExposure() {
    this.windowTimer = 0;
    this.windowDamageBudget = 0;
    this.windowDamageTaken = 0;
    this.forceCloseWindow = false;
    this.setHeartExposed(false);

    if (this.pendingPhaseTransition > this.phase) {
      this.startPhaseTransition(this.pendingPhaseTransition);
      return;
    }

    if (this.phase === 1) {
      this.state = 'phase1_sealed';
      this.spawnPhase1Seals();
      this.volleyTimer = 1.3;
      this.lobTimer = 1.2;
      this.patternTimer = 4.9;
    } else if (this.phase === 2) {
      const nextType = this.phase2WallPatternIndex % 2 === 0 ? 'swarm' : 'tank';
      this.startWallPattern(nextType);
    } else if (this.phase === 3 && !this.lastStand) {
      this.state = 'phase3_armor';
      this.phase3MeteorTimer = 0.55;
      this.phase3BarrageTimer = 1.8;
      this.phase3CrackTimer = 6.8;
      this.phase3ShockwaveTimer = 2.8;
    }
  }

  enterLastStand() {
    if (this.lastStand) return;
    this.lastStand = true;
    this.state = 'phase3_laststand';
    this.fixedY = 8.4;
    this.targetScale = 4.1;
    this.setHeartExposed(true);
    this.windowTimer = 999;
    this.windowDamageBudget = Infinity;
    this.windowDamageTaken = 0;
    this.forceCloseWindow = false;
    this.phase3MeteorTimer = 0.7;
    this.phase3BarrageTimer = 1.1;
    this.phase3ShockwaveTimer = 2.4;
    playFinalBossAscendSound();
    playFinalBossExposeSound();

    if (this.telegraphing) {
      this.telegraphing.start('pulse', 1.0, 0xffefbf, this.mesh.position.clone());
      this.telegraphing.start('shockwave', 1.2, 0xff5c33, this.mesh.position.clone());
    }
  }

  updateSealNodes(dt, now, playerPos) {
    this.sealNodes.forEach((node) => {
      if (!node.active || !node.group?.parent) return;
      node.angle += node.speed * dt;
      node.group.position.set(
        Math.cos(node.angle) * node.radius,
        node.height + Math.sin(now * 0.0022 + node.id * 1.6) * 0.42,
        Math.sin(node.angle) * node.radius,
      );
      node.group.lookAt(playerPos);
    });
  }

  updateAnchorNodes(now, playerPos) {
    this.anchorNodes.forEach((node) => {
      if (!node.active || !node.group?.parent) return;
      node.group.position.set(
        node.offset.x + Math.sin(now * 0.0017 + node.bob) * 0.3,
        node.offset.y + Math.sin(now * 0.0032 + node.bob) * 0.45,
        node.offset.z + Math.cos(now * 0.0026 + node.bob) * 0.28,
      );
      node.group.lookAt(playerPos);
    });
  }

  collectEmitterPositions(emitters) {
    return emitters
      .map((emitter) => emitter?.getWorldPosition(new THREE.Vector3()))
      .filter(Boolean);
  }

  getHeartWorldPosition() {
    return this.heartGroup.getWorldPosition(new THREE.Vector3());
  }

  fireDirectFan(origins, playerPos, shotCount, spreadX, delayMs, color) {
    if (!origins || origins.length === 0) return;
    const expectedPhase = this.phase;
    const expectedState = this.state;

    origins.forEach((origin) => {
      if (this.telegraphing) {
        this.telegraphing.start('projectile', delayMs / 1000, color, origin.clone());
      }
    });

    const targets = [];
    if (shotCount <= 1) {
      targets.push(playerPos.clone());
    } else {
      for (let i = 0; i < shotCount; i++) {
        const offset = shotCount === 1 ? 0 : (i / (shotCount - 1) - 0.5);
        const target = playerPos.clone();
        target.x += offset * spreadX;
        target.y += Math.abs(offset) * 0.2;
        targets.push(target);
      }
    }

    this.later(delayMs, () => {
      if (this.phase !== expectedPhase || this.state !== expectedState) return;
      origins.forEach((origin) => {
        targets.forEach((target) => {
          spawnBossProjectile(origin.clone(), target.clone());
        });
      });
    });
  }

  fireLobbedVolley(origins, playerPos, targetOffsets, arcHeight, delayMs, color) {
    if (!origins || origins.length === 0 || !targetOffsets || targetOffsets.length === 0) return;
    const expectedPhase = this.phase;
    const expectedState = this.state;

    const targets = targetOffsets.map((offset) => {
      const target = playerPos.clone();
      target.x += offset.x || 0;
      target.y += offset.y || 0;
      target.z += offset.z || 0;
      return target;
    });

    if (this.telegraphing) {
      origins.forEach((origin) => {
        this.telegraphing.start('projectile', delayMs / 1000, color, origin.clone());
      });
      targets.slice(0, 4).forEach((target) => {
        const warningPos = target.clone();
        warningPos.y = 0.05;
        this.telegraphing.start('pulse', delayMs / 1000, color, warningPos);
      });
    }

    this.later(delayMs, () => {
      if (this.phase !== expectedPhase || this.state !== expectedState) return;
      origins.forEach((origin) => {
        targets.forEach((target) => {
          spawnBossProjectile(origin.clone(), target.clone(), true, arcHeight);
        });
      });
    });
  }

  fireRadialBurst(projectileCount, radius, waveCount = 1, waveSpacingMs = 150, color = 0xff6633) {
    const origin = this.mesh.position.clone();
    const expectedPhase = this.phase;
    const expectedState = this.state;

    if (this.telegraphing) {
      this.telegraphing.start('shockwave', 0.8, color, origin.clone());
    }

    for (let wave = 0; wave < waveCount; wave++) {
      this.later(wave * waveSpacingMs, () => {
        if (this.phase !== expectedPhase || this.state !== expectedState) return;
        for (let i = 0; i < projectileCount; i++) {
          const angle = (i / projectileCount) * Math.PI * 2 + wave * 0.11;
          const target = new THREE.Vector3(
            origin.x + Math.cos(angle) * radius,
            origin.y,
            origin.z + Math.sin(angle) * radius,
          );
          spawnBossProjectile(origin.clone(), target);
        }
      });
    }
  }

  fireMeasuredHeartShot(playerPos, spreadX = 0) {
    const origin = this.getHeartWorldPosition();
    const expectedPhase = this.phase;
    const expectedState = this.state;
    const target = playerPos.clone();
    if (spreadX !== 0) target.x += spreadX;
    this.showTelegraph('projectile', 0.28, 0xfff0b2, origin);
    this.later(280, () => {
      if (this.phase !== expectedPhase || this.state !== expectedState) return;
      spawnBossProjectile(origin.clone(), target);
    });
  }

  fireSealLobbedPressure(playerPos) {
    const activeSeals = this.sealNodes.filter((node) => node.active && node.group?.parent);
    if (activeSeals.length === 0) return;

    const node = activeSeals[this.phase1SealAttackIndex % activeSeals.length];
    this.phase1SealAttackIndex++;
    const origin = node.group.getWorldPosition(new THREE.Vector3());
    const offsets = [
      { x: -0.85, z: -0.25 },
      { x: 0.8, z: 0.55 },
    ];
    this.fireLobbedVolley([origin], playerPos, offsets, 3.9, 560, 0x6eeaff);
  }

  firePhase2BacklineMortars(playerPos, originCount = 2) {
    const emitterOrigins = this.collectEmitterPositions(this.crownEmitters);
    const origins = emitterOrigins.slice(0, originCount).map((origin, idx) => {
      origin.y += 1.8 + idx * 0.8;
      return origin;
    });
    const offsets = [
      { x: -1.25, z: -0.5 },
      { x: 1.25, z: -0.3 },
      { x: 0.25, z: 1.1 },
    ];
    this.fireLobbedVolley(origins, playerPos, offsets, 5.6, 640, 0xff8a44);
  }

  firePhase3MeteorRain(playerPos) {
    const origins = this.collectEmitterPositions(this.finalEmitters.length > 0 ? this.finalEmitters : this.crownEmitters);
    if (origins.length === 0) return;
    origins.forEach((origin, idx) => {
      origin.y += 2.8 + idx * 0.55;
    });
    const offsets = [
      { x: -1.6, z: -0.9 },
      { x: 1.55, z: -0.6 },
      { x: -0.45, z: 1.2 },
      { x: 0.8, z: 1.35 },
    ];
    this.fireLobbedVolley(origins.slice(0, 3), playerPos, offsets, this.lastStand ? 6.8 : 6.1, 620, 0xffb25a);
  }

  firePhase3GiantVolley(playerPos) {
    const origins = this.collectEmitterPositions(this.finalEmitters.length > 0 ? this.finalEmitters : this.crownEmitters);
    if (origins.length === 0) return;
    this.fireDirectFan(origins.slice(0, 3), playerPos, 3, this.lastStand ? 1.75 : 1.45, 360, 0xffd27a);
  }

  startWallPattern(type) {
    this.state = 'phase2_wall_setup';
    this.phase2WallType = type;
    this.phase2WallSpawnIndex = 0;
    this.phase2WallSpawnTimer = 0.12;
    this.phase2WallTimer = 0;
    this.phase2WallReleaseTimer = 0;
    this.phase2InterruptTimer = 0;
    this.phase2ShockwaveStep = 0;
    this.phase2InterruptBonus = 0;
    this.phase2WallTotalPlanned = this.phase2Formations[type].length;
    this.lobTimer = 0.75;
    this.volleyTimer = 1.6;
    this.clearWeakNodes(this.anchorNodes);
    this.clearWallEnemies();
    this.setHeartExposed(false);
    playFinalBossSummonWallSound();
    playFinalBossChargeSound();

    if (this.telegraphing) {
      this.telegraphing.start('charge', 1.2, 0xff8844, this.mesh.position.clone());
      this.telegraphing.start('pulse', 1.4, 0xffb266, this.mesh.position.clone());
    }
  }

  spawnWallEnemy(slot, playerPos) {
    const worldTarget = new THREE.Vector3(
      slot.x + this.mesh.position.x * 0.45,
      slot.y,
      Math.min(this.mesh.position.z + 5.6, playerPos.z - 10.8) + slot.z,
    );

    const enemyType = this.phase2WallType === 'tank' ? 'tank' : 'swarm';
    const enemy = spawnEnemy(enemyType, worldTarget.clone(), ECLIPSE_WALL_LEVEL);
    if (!enemy) return null;

    enemy._eclipseHeld = true;
    enemy._eclipseHoldTarget = worldTarget.clone();
    enemy._eclipseHoldBob = Math.random() * Math.PI * 2;
    enemy._eclipseReleaseTimer = 0;
    enemy._eclipseReleaseVector = null;
    enemy._eclipseWallType = this.phase2WallType;
    enemy._bossSummoned = true;

    // The wall needs to be threatening but still answerable.
    if (enemyType === 'swarm') {
      enemy.hp = 26;
      enemy.maxHp = 26;
      enemy.baseSpeed = 5.8;
      enemy.speed = 5.8;
    } else {
      enemy.hp = 165;
      enemy.maxHp = 165;
      enemy.baseSpeed = 1.18;
      enemy.speed = 1.18;
    }

    this.phase2WallEnemies.push(enemy);
    return enemy;
  }

  releaseWallEnemies(playerPos) {
    playFinalBossReleaseWallSound();
    let alive = 0;

    this.phase2WallEnemies.forEach((enemy) => {
      if (!enemy || enemy.hp <= 0) return;
      alive++;
      enemy._eclipseHeld = false;
      enemy._eclipseHoldTarget = null;
      enemy._eclipseReleaseTimer = this.phase2WallType === 'tank' ? 2.2 : 1.35;
      enemy._eclipseReleaseVector = _scratch.copy(playerPos).sub(enemy.mesh.position).normalize().multiplyScalar(
        this.phase2WallType === 'tank' ? 3.2 : 7.4,
      ).clone();
      if (this.phase2WallType === 'tank') {
        enemy.baseSpeed = Math.max(enemy.baseSpeed, 1.45);
        enemy.speed = enemy.baseSpeed;
      }
    });

    const survivalRatio = this.phase2WallTotalPlanned > 0 ? alive / this.phase2WallTotalPlanned : 1;
    if (survivalRatio <= 0.25) this.phase2InterruptBonus = 1.6;
    else if (survivalRatio <= 0.55) this.phase2InterruptBonus = 0.8;
    else this.phase2InterruptBonus = 0;

    this.state = 'phase2_wall_release';
    this.phase2WallReleaseTimer = 5.2 - this.phase2InterruptBonus * 0.45;
    this.phase2ShockwaveStep = 0;

    if (this.telegraphing) {
      this.telegraphing.start('shockwave', 0.9, 0xff5a2f, this.mesh.position.clone());
    }
  }

  countActiveWallEnemies() {
    let alive = 0;
    this.phase2WallEnemies.forEach((enemy) => {
      if (!enemy || enemy.hp <= 0) return;
      if (activeEnemies.includes(enemy)) alive++;
    });
    return alive;
  }

  startAnchorInterrupt() {
    this.state = 'phase2_interrupt';
    this.phase2InterruptTimer = 0;
    this.phase2ShockwaveStep = 0;
    this.lobTimer = 0.65;
    this.setHeartExposed(false);
    this.spawnPhase2Anchors();
    playFinalBossChargeSound();

    if (this.telegraphing) {
      this.telegraphing.start('charge', 1.0, 0xff8844, this.mesh.position.clone());
      this.telegraphing.start('pulse', 1.25, 0xffb266, this.mesh.position.clone());
      this.telegraphing.start('shockwave', 1.55, 0xff5522, this.mesh.position.clone());
    }
  }

  resolveAnchorInterrupt(interrupted) {
    if (this.state !== 'phase2_interrupt') return;

    this.clearWeakNodes(this.anchorNodes);
    this.state = 'phase2_exposed';
    this.phase2InterruptTimer = 0;
    this.phase2ShockwaveStep = 0;

    if (interrupted) {
      this.beginCoreWindow(8.4 + this.phase2InterruptBonus, 0.07 + this.phase2InterruptBonus * 0.0045);
    } else {
      this.beginCoreWindow(4.6, 0.036);
    }
    this.phase2WallPatternIndex++;
  }

  updateMovement(dt, now, playerPos) {
    if (this.transitioning) return;

    // Phase 2 backline patterns deliberately push the boss high and far away
    // so the player has to look up and solve the wall attack under pressure.
    if (this.phase === 2 && (this.state === 'phase2_wall_setup' || this.state === 'phase2_wall_release' || this.state === 'phase2_interrupt')) {
      this.moveTarget.set(
        playerPos.x + Math.sin(now * 0.0009 + this.phaseHeightPhase) * 5.5,
        5.4 + Math.sin(now * 0.0018 + this.phaseHeightPhase * 0.7) * 2.15,
        playerPos.z - 17.6 + Math.cos(now * 0.0012) * 1.4,
      );
      this.mesh.position.lerp(this.moveTarget, Math.min(1, dt * 2.2));
      return;
    }

    if (this.phase === 3) {
      this.moveTarget.set(
        playerPos.x + Math.sin(now * 0.0007 + this.phaseHeightPhase) * 4.4,
        (this.lastStand ? 8.4 : 7.1) + Math.sin(now * 0.0016 + this.phaseHeightPhase) * (this.lastStand ? 1.6 : 2.45),
        playerPos.z - (this.lastStand ? 13.2 : 15.1) + Math.cos(now * 0.00105) * 2.2,
      );
      this.mesh.position.lerp(this.moveTarget, Math.min(1, dt * (this.lastStand ? 1.8 : 1.5)));
      return;
    }

    this.moveTimer += dt;
    if (this.moveTimer >= 1.9) {
      this.moveTimer = 0;
      _scratch.copy(this.mesh.position).sub(playerPos);
      _scratch.y = 0;
      if (_scratch.lengthSq() < 0.0001) _scratch.set(0, 0, 1);
      else _scratch.normalize();

      _scratch2.set(-_scratch.z, 0, _scratch.x).normalize();
      const tangentSign = Math.random() < 0.5 ? -1 : 1;
      this.moveDirection.copy(_scratch2.multiplyScalar(tangentSign)).addScaledVector(_scratch, this.coreExposed ? -0.22 : 0.12);
      if (this.moveDirection.lengthSq() < 0.0001) this.moveDirection.set(tangentSign, 0, 0);
      else this.moveDirection.normalize();
    }

    const speed = this.coreExposed ? 0.55 : 1.0;
    this.mesh.position.addScaledVector(this.moveDirection, speed * dt);
    const targetY = this.fixedY + Math.sin(now * 0.0014 + this.phaseHeightPhase) * (this.coreExposed ? 0.35 : 0.75);
    this.mesh.position.y += (targetY - this.mesh.position.y) * Math.min(1, dt * 3.8);
  }

  updateVisualState(dt) {
    this.visualSpin += dt * (this.phase === 3 ? 0.95 : this.phase === 2 ? 0.74 : 0.58);
    this.visualPulse += dt * (this.transitioning ? 5.6 : this.phase === 3 ? 3.5 : 2.3);
    this.currentScale += (this.targetScale - this.currentScale) * Math.min(1, dt * 2.1);

    const pulseAmp = this.transitioning ? 0.12 : this.phase === 3 ? 0.08 : 0.045;
    const pulse = 1 + Math.sin(this.visualPulse) * pulseAmp;
    this.mesh.scale.setScalar(this.currentScale * pulse);

    if (this.crownGroup) this.crownGroup.rotation.y = this.visualSpin;
    if (this.ascensionGroup) this.ascensionGroup.rotation.y = -this.visualSpin * 0.75;
    if (this.spireGroup) this.spireGroup.rotation.z = Math.sin(this.visualPulse * 0.3) * 0.04;

    const damageRatio = 1 - (this.hp / this.maxHp);
    const shellColor = this.transitioning
      ? 0xffc766
      : this.phase === 1
        ? 0x33ccff
        : this.phase === 2
          ? 0xff7a33
          : this.lastStand
            ? 0xfff1c2
            : 0xff5533;
    const heartColor = this.coreExposed || this.lastStand ? 0xfff5c8 : this.phase === 3 ? 0xffb15c : 0xff6c96;
    const heartOpacity = this.coreExposed || this.lastStand ? 0.98 : this.phase === 3 ? 0.45 : 0.3;

    this.shellMeshes.forEach((mesh) => {
      mesh.material.color.setHex(shellColor);
      mesh.material.opacity = Math.max(0.42, 0.92 - damageRatio * 0.22);
    });
    this.spireMeshes.forEach((mesh) => {
      mesh.material.color.setHex(this.phase >= 2 ? 0xffb25a : 0xffd27a);
      mesh.material.opacity = this.phase === 3 ? 0.88 : 0.76;
    });
    this.crownMeshes.forEach((mesh) => {
      mesh.material.color.setHex(this.phase >= 2 ? 0xffaa55 : 0x7cf8ff);
      mesh.material.opacity = this.phase === 3 ? 0.86 : 0.72;
    });
    this.ascensionMeshes.forEach((mesh) => {
      mesh.material.color.setHex(this.lastStand ? 0xfff0b2 : 0xff7a3d);
      mesh.material.opacity = this.phase === 3 ? 0.9 : 0.0;
    });
    this.heartMeshes.forEach((mesh) => {
      mesh.material.color.setHex(heartColor);
      mesh.material.opacity = heartOpacity;
    });

    const heartScale = this.coreExposed || this.lastStand
      ? 1.22 + Math.sin(this.visualPulse * 1.5) * 0.17
      : 0.94 + Math.sin(this.visualPulse * 0.75) * 0.05;
    if (this.heartGroup) this.heartGroup.scale.setScalar(heartScale);
  }

  updatePhase1(dt, now, playerPos) {
    this.updateSealNodes(dt, now, playerPos);

    if (this.coreExposed) {
      this.windowTimer -= dt;
      this.coreShotTimer -= dt;

      if (this.coreShotTimer <= 0) {
        this.coreShotTimer = 1.7;
        this.fireMeasuredHeartShot(playerPos, this.windowDamageTaken > this.windowDamageBudget * 0.5 ? 0.45 : -0.45);
      }
      if (this.forceCloseWindow || this.windowTimer <= 0) {
        this.resolveExposure();
      }
      return;
    }

    this.lobTimer -= dt;
    this.volleyTimer -= dt;
    this.patternTimer -= dt;

    if (this.lobTimer <= 0) {
      this.lobTimer = 2.55;
      this.fireSealLobbedPressure(playerPos);
    }
    if (this.volleyTimer <= 0) {
      this.volleyTimer = 2.15;
      const crownOrigins = this.collectEmitterPositions(this.crownEmitters);
      this.fireDirectFan(crownOrigins.slice(0, 1), playerPos, 2, 0.7, 380, 0x8ceeff);
    }
    if (this.patternTimer <= 0) {
      this.patternTimer = 6.8;
      this.firePhase2BacklineMortars(playerPos, 1);
    }
  }

  updatePhase2(dt, now, playerPos) {
    if (this.state === 'phase2_wall_setup') {
      this.phase2WallTimer += dt;
      this.phase2WallSpawnTimer -= dt;
      this.lobTimer -= dt;
      this.volleyTimer -= dt;

      if (this.phase2WallSpawnIndex < this.phase2Formations[this.phase2WallType].length && this.phase2WallSpawnTimer <= 0) {
        const slot = this.phase2Formations[this.phase2WallType][this.phase2WallSpawnIndex];
        this.spawnWallEnemy(slot, playerPos);
        this.phase2WallSpawnIndex++;
        this.phase2WallSpawnTimer = this.phase2WallType === 'tank' ? 0.28 : 0.16;
      }

      if (this.lobTimer <= 0) {
        this.lobTimer = 1.45;
        this.firePhase2BacklineMortars(playerPos, this.phase2WallType === 'tank' ? 1 : 2);
      }
      if (this.volleyTimer <= 0) {
        this.volleyTimer = 2.1;
        const crownOrigins = this.collectEmitterPositions(this.crownEmitters);
        this.fireDirectFan(crownOrigins.slice(0, 2), playerPos, 2, 1.35, 420, 0xff9955);
      }

      const spawnedAll = this.phase2WallSpawnIndex >= this.phase2Formations[this.phase2WallType].length;
      const aliveWallEnemies = this.countActiveWallEnemies();
      if (spawnedAll && aliveWallEnemies === 0 && this.phase2WallTimer >= 3.0) {
        this.phase2InterruptBonus = 1.8;
        this.startAnchorInterrupt();
        return;
      }
      if (spawnedAll && this.phase2WallTimer >= 8.8) {
        this.releaseWallEnemies(playerPos);
      }
      return;
    }

    if (this.state === 'phase2_wall_release') {
      this.phase2WallReleaseTimer -= dt;
      this.lobTimer -= dt;
      this.volleyTimer -= dt;

      if (this.lobTimer <= 0) {
        this.lobTimer = 1.15;
        this.firePhase2BacklineMortars(playerPos, this.phase2WallType === 'tank' ? 2 : 1);
      }
      if (this.volleyTimer <= 0) {
        this.volleyTimer = 2.0;
        const crownOrigins = this.collectEmitterPositions(this.crownEmitters);
        this.fireDirectFan(crownOrigins.slice(1, 3), playerPos, 3, 1.3, 420, 0xff8844);
      }
      if (this.phase2ShockwaveStep === 0 && this.phase2WallReleaseTimer <= 3.2) {
        this.phase2ShockwaveStep = 1;
        this.fireRadialBurst(10, 11.5, 1, 0, 0xff6e33);
      }
      if (this.phase2WallReleaseTimer <= 0) {
        this.startAnchorInterrupt();
      }
      return;
    }

    if (this.state === 'phase2_interrupt') {
      this.phase2InterruptTimer += dt;
      this.lobTimer -= dt;
      this.updateAnchorNodes(now, playerPos);

      if (this.anchorNodes.length > 0 && this.anchorNodes.every((node) => !node.active)) {
        this.resolveAnchorInterrupt(true);
        return;
      }

      if (this.lobTimer <= 0) {
        this.lobTimer = 1.3;
        this.firePhase2BacklineMortars(playerPos, 2);
      }
      if (this.phase2ShockwaveStep === 0 && this.phase2InterruptTimer >= 1.3) {
        this.phase2ShockwaveStep = 1;
        this.fireRadialBurst(9, 11.0, 1, 0, 0xff6633);
      }
      if (this.phase2ShockwaveStep === 1 && this.phase2InterruptTimer >= 2.7) {
        this.phase2ShockwaveStep = 2;
        this.fireRadialBurst(10, 12.0, 1, 0, 0xff8844);
      }
      if (this.phase2InterruptTimer >= 5.2) {
        this.resolveAnchorInterrupt(false);
      }
      return;
    }

    if (this.coreExposed) {
      this.windowTimer -= dt;
      this.coreShotTimer -= dt;
      this.lobTimer -= dt;

      if (this.coreShotTimer <= 0) {
        this.coreShotTimer = 1.25;
        this.fireMeasuredHeartShot(playerPos, Math.random() < 0.5 ? -0.6 : 0.6);
      }
      if (this.lobTimer <= 0) {
        this.lobTimer = 2.2;
        this.firePhase2BacklineMortars(playerPos, 1);
      }
      if (this.forceCloseWindow || this.windowTimer <= 0) {
        this.resolveExposure();
      }
    }
  }

  updatePhase3(dt, now, playerPos) {
    if (this.lastStand) {
      this.phase3MeteorTimer -= dt;
      this.phase3BarrageTimer -= dt;
      this.phase3ShockwaveTimer -= dt;

      if (this.phase3MeteorTimer <= 0) {
        this.phase3MeteorTimer = 1.15;
        this.firePhase3MeteorRain(playerPos);
      }
      if (this.phase3BarrageTimer <= 0) {
        this.phase3BarrageTimer = 1.0;
        this.firePhase3GiantVolley(playerPos);
      }
      if (this.phase3ShockwaveTimer <= 0) {
        this.phase3ShockwaveTimer = 2.45;
        this.fireRadialBurst(12, 13.0, 2, 170, 0xff6a33);
      }
      return;
    }

    if (this.coreExposed) {
      this.windowTimer -= dt;
      this.coreShotTimer -= dt;
      this.phase3MeteorTimer -= dt;

      if (this.coreShotTimer <= 0) {
        this.coreShotTimer = 1.1;
        this.fireMeasuredHeartShot(playerPos, Math.random() < 0.5 ? -0.55 : 0.55);
      }
      if (this.phase3MeteorTimer <= 0) {
        this.phase3MeteorTimer = 2.35;
        this.firePhase3MeteorRain(playerPos);
      }
      if (this.forceCloseWindow || this.windowTimer <= 0) {
        this.resolveExposure();
      }
      return;
    }

    this.phase3MeteorTimer -= dt;
    this.phase3BarrageTimer -= dt;
    this.phase3CrackTimer -= dt;
    this.phase3ShockwaveTimer -= dt;

    if (this.phase3MeteorTimer <= 0) {
      this.phase3MeteorTimer = 1.45;
      this.firePhase3MeteorRain(playerPos);
    }
    if (this.phase3BarrageTimer <= 0) {
      this.phase3BarrageTimer = 2.25;
      this.firePhase3GiantVolley(playerPos);
    }
    if (this.phase3ShockwaveTimer <= 0) {
      this.phase3ShockwaveTimer = 3.7;
      this.fireRadialBurst(11, 12.5, 1, 0, 0xff7a33);
    }
    if (this.phase3CrackTimer <= 0) {
      this.state = 'phase3_exposed';
      this.beginCoreWindow(7.6, 0.082);
    }
  }

  updateTransition(dt) {
    this.transitionTimer += dt;
    if (this.pendingPhaseTransition === 3) {
      this.targetScale = 2.3;
    }

    if (this.transitionTimer >= this.transitionDuration) {
      this.transitioning = false;
      const nextPhase = this.pendingPhaseTransition;
      this.pendingPhaseTransition = 0;

      if (nextPhase === 2) this.enterPhase2();
      else if (nextPhase === 3) this.enterPhase3();
      this.onPhaseChange(this.phase);
    }
  }

  updateBehavior(dt, now, playerPos) {
    this.updateVisualState(dt);

    if (this.transitioning) {
      this.updateTransition(dt);
      this.mesh.lookAt(_look.copy(playerPos).setY(this.mesh.position.y * 0.55));
      return;
    }

    this.updateMovement(dt, now, playerPos);

    if (this.phase === 1) this.updatePhase1(dt, now, playerPos);
    else if (this.phase === 2) this.updatePhase2(dt, now, playerPos);
    else this.updatePhase3(dt, now, playerPos);

    this.mesh.lookAt(_look.copy(playerPos).setY(this.mesh.position.y * 0.55));
  }

  damageWeakNode(hitInfo, amount) {
    const nodePool = hitInfo.eclipseNodeType === 'seal'
      ? this.sealNodes
      : hitInfo.eclipseNodeType === 'anchor'
        ? this.anchorNodes
        : null;
    if (!nodePool) return { killed: false, immune: true };

    const node = nodePool.find((candidate) => candidate.id === hitInfo.eclipseNodeId && candidate.active);
    if (!node) return { killed: false, immune: true };

    node.hp -= amount;
    if (node.hp > 0) {
      return { killed: false };
    }

    node.active = false;
    const nodePos = node.group.getWorldPosition(new THREE.Vector3());
    playFinalBossSealBreakSound();
    if (this.telegraphing) {
      this.telegraphing.start('pulse', 0.4, 0xffffff, nodePos);
    }
    if (node.group.parent) node.group.parent.remove(node.group);
    node.group.traverse((part) => {
      if (part.material) part.material.dispose();
    });
    node.group = null;

    if (nodePool === this.sealNodes && this.sealNodes.every((candidate) => !candidate.active)) {
      this.state = 'phase1_exposed';
      this.beginCoreWindow(9.8, 0.07);
    }

    if (nodePool === this.anchorNodes && this.anchorNodes.every((candidate) => !candidate.active)) {
      this.resolveAnchorInterrupt(true);
    }

    return { killed: false };
  }

  applyBossDamage(amount, hitInfo = {}) {
    let actualDamage = amount;
    if (hitInfo.isWeakPoint || hitInfo.isEclipseHeart) {
      actualDamage *= 1.3;
    }
    if (hitInfo.isChargeCannon) {
      actualDamage = Math.min(actualDamage, 140);
    }

    const phaseFloor = this.phase === 1
      ? this.phase2Threshold
      : this.phase === 2
        ? this.phase3Threshold
        : this.lastStand
          ? 0
          : this.lastStandThreshold;
    const budgetRemaining = this.windowDamageBudget === Infinity
      ? Infinity
      : Math.max(0, this.windowDamageBudget - this.windowDamageTaken);
    const phaseRemaining = phaseFloor > 0 ? Math.max(0, this.hp - phaseFloor) : actualDamage;
    const damageToApply = Math.min(actualDamage, budgetRemaining, phaseRemaining);

    if (damageToApply <= 0) {
      if (this.phase === 1 && this.hp <= this.phase2Threshold + 0.001) {
        this.pendingPhaseTransition = 2;
        this.forceCloseWindow = true;
      }
      if (this.phase === 2 && this.hp <= this.phase3Threshold + 0.001) {
        this.pendingPhaseTransition = 3;
        this.forceCloseWindow = true;
      }
      if (this.phase === 3 && !this.lastStand && this.hp <= this.lastStandThreshold + 0.001) {
        this.enterLastStand();
      }
      return { killed: false, immune: true };
    }

    this.hp -= damageToApply;
    if (this.hp < 0) this.hp = 0;
    this.windowDamageTaken += damageToApply;

    if (this.windowDamageBudget !== Infinity && this.windowDamageTaken >= this.windowDamageBudget - 0.001) {
      this.forceCloseWindow = true;
    }

    if (this.phase === 1 && this.hp <= this.phase2Threshold + 0.001) {
      this.hp = this.phase2Threshold;
      this.pendingPhaseTransition = 2;
      this.forceCloseWindow = true;
    } else if (this.phase === 2 && this.hp <= this.phase3Threshold + 0.001) {
      this.hp = this.phase3Threshold;
      this.pendingPhaseTransition = 3;
      this.forceCloseWindow = true;
    } else if (this.phase === 3 && !this.lastStand && this.hp <= this.lastStandThreshold + 0.001) {
      this.hp = this.lastStandThreshold;
      this.enterLastStand();
    }

    return { killed: this.hp <= 0 };
  }

  takeDamage(amount, hitInfo = {}) {
    if (this.transitioning) {
      return { killed: false, immune: true };
    }

    if (hitInfo.eclipseNodeId !== undefined && hitInfo.eclipseNodeType) {
      return this.damageWeakNode(hitInfo, amount);
    }

    if (!this.coreExposed && !this.lastStand) {
      return { killed: false, immune: true };
    }

    return this.applyBossDamage(amount, hitInfo);
  }

  onPhaseChange(newPhase) {
    if (this.telegraphing) {
      this.telegraphing.start('teleport', 0.75, 0xffbb66, this.mesh.position.clone());
      this.telegraphing.start('pulse', 0.9, 0xffe2a8, this.mesh.position.clone());
    }
    if (newPhase === 3 && this.ascensionGroup) {
      this.ascensionGroup.visible = true;
    }
  }

  destroy() {
    this._destroyed = true;
    this._timers.forEach(clearTimeout);
    this._timers.clear();
    this.clearWeakNodes(this.sealNodes);
    this.clearWeakNodes(this.anchorNodes);
    this.clearWallEnemies();

    if (this.sceneRef && this.mesh?.parent === this.sceneRef) {
      this.sceneRef.remove(this.mesh);
    } else if (this.mesh?.parent) {
      this.mesh.parent.remove(this.mesh);
    }

    this.mesh?.traverse((part) => {
      if (part.material) part.material.dispose();
    });
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
    name: 'NECRO',
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
    name: 'BLOOD MINOTAUR',
    pattern: [[1]],
    voxelSize: 0.25,
    baseHp: 1900,
    phases: 3,
    color: 0xd70200,
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
  },

  eclipse_engine: {
    name: 'Eclipse Engine',
    pattern: [[1]],
    voxelSize: 0.22,
    baseHp: 4200,
    phases: 3,
    color: 0x33ccff,
    scoreValue: 800,
    behavior: 'eclipse',
    hitboxRadius: 1.6,
    weakPoints: false,
    finalSequence: 'eclipse-collapse',
  }
};

// ── BOSS POOL MANAGEMENT ─────────────────────────────────────
const BOSS_POOLS = {
  1: ['skull_boss'], // Tier 1 (Level 5) - Skull Boss only
  2: ['the_prism'], // Tier 2 (Level 10) - The Prism only
  3: ['neon_minotaur'], // Tier 3 (Level 15) - Neon Minotaur only
  4: ['eclipse_engine'], // Tier 4 (Level 20) - authored final boss
};

// ── GLOBAL BOSS STATE ─────────────────────────────────────────
let activeBoss = null;
let telegraphingSystem = null;

// ── PUBLIC API ─────────────────────────────────────────────

export function getTelegraphingSystem() {
  return telegraphingSystem;
}

export function setCameraRef(camera) {
  cameraRef = camera;
  if (telegraphingSystem) {
    telegraphingSystem.camera = camera;
  }
}

/**
 * Spawn a boss of the given type
 */
export function getBossNameForLevel(level) {
  if (level % 5 !== 0) return '';
  const tier = level / 5;
  const pool = BOSS_POOLS[tier];
  if (!pool || pool.length === 0) return '';
  const bossId = pool[0];
  const def = BOSS_DEFS[bossId];
  return def ? def.name : '';
}

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
    case 'eclipse':
      boss = new EclipseEngineBoss(def, levelConfig, sceneRef, telegraphingSystem);
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
        if (c.material) {
          if (Array.isArray(c.material)) c.material.forEach(m => m.dispose && m.dispose());
          else if (c.material.dispose) c.material.dispose();
        }
      });
    }
  }
  bossMinions.length = 0;
  _bossMinionMeshesDirty = true;
  _bossMinionMeshToIndex.clear();
  _cachedBossMinionMeshes.length = 0;
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
  group.renderOrder = 2;
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
  // Perf: Slightly generous hit radius keeps the final-boss minions readable in VR
  // while letting projectile collision use direct math instead of recursive raycasts.
  group.userData.hitRadius = Math.max(def.hitboxRadius || def.voxelSize * 2.8, 0.8);
  sceneRef.add(group);
  bossMinions.push({ mesh: group, hp: def.baseHp, maxHp: def.baseHp, speed: def.baseSpeed });
  _bossMinionMeshesDirty = true;
}

export function getBossMinionMeshes() {
  if (_bossMinionMeshesDirty) {
    rebuildBossMinionMeshCache();
  }
  return _cachedBossMinionMeshes;
}

export function getBossMinionByMesh(mesh) {
  if (_bossMinionMeshesDirty) {
    rebuildBossMinionMeshCache();
  }
  let obj = mesh;
  while (obj) {
    if (obj.userData.isBossMinion) {
      const idx = _bossMinionMeshToIndex.get(obj);
      return idx !== undefined ? { index: idx, minion: bossMinions[idx] } : null;
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
    m.mesh.traverse(c => { if (c.geometry) c.geometry.dispose(); if (c.material) { if (Array.isArray(c.material)) c.material.forEach(m => m.dispose && m.dispose()); else if (c.material.dispose) c.material.dispose(); } });
    bossMinions.splice(index, 1);
    _bossMinionMeshesDirty = true;
    _bossMinionMeshToIndex.clear();
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
let bossProjGlowPool = null;   // InstancedMesh for billboarded glow planes
let bossProjFreeIndices = [];  // Available instance indices
const bossProjData = [];       // Per-instance data (parallel to instance indices)
const _bossProjMatrix = new THREE.Matrix4();
const _bossProjGlowMatrix = new THREE.Matrix4();
const _bossProjScale = new THREE.Vector3();
const _identityQuat = new THREE.Quaternion();  // Identity rotation
const _unitScale = new THREE.Vector3(1, 1, 1);  // Unit scale for initial spawn
const _billboardQuat = new THREE.Quaternion();
const _billboardMat = new THREE.Matrix4();
const _upVector = new THREE.Vector3(0, 1, 0);

function initBossProjPools() {
  if (bossProjCorePool || !sceneRef) return;

  // Boss projectiles: bright white-hot core spheres (smaller, glow planes do the heavy lifting)
  const coreGeo = new THREE.SphereGeometry(0.10, 10, 10);  // 30% smaller (was 0.14)
  const coreMat = new THREE.MeshBasicMaterial({
    color: 0xffbb77,  // Brighter white-orange (was 0xff5500)
    transparent: true,
    opacity: 0.95,    // Brighter (was 0.85)
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

  // Glow pool: radial gradient planes (synthwave-sun style fade at edges)
  const glowSize = 128;
  const glowCanvas = document.createElement('canvas');
  glowCanvas.width = glowSize;
  glowCanvas.height = glowSize;
  const glowCtx = glowCanvas.getContext('2d');
  const halfGlow = glowSize / 2;
  const glowGrad = glowCtx.createRadialGradient(halfGlow, halfGlow, 0, halfGlow, halfGlow, halfGlow);
  glowGrad.addColorStop(0, 'rgba(255,120,20,1)');     // Bright orange center
  glowGrad.addColorStop(0.3, 'rgba(255,80,0,0.7)');   // Mid orange
  glowGrad.addColorStop(0.6, 'rgba(255,50,0,0.3)');    // Fading
  glowGrad.addColorStop(1, 'rgba(255,30,0,0)');        // Transparent edge
  glowCtx.fillStyle = glowGrad;
  glowCtx.fillRect(0, 0, glowSize, glowSize);
  const glowTexture = new THREE.CanvasTexture(glowCanvas);

  const glowGeo = new THREE.PlaneGeometry(0.7, 0.7);
  const glowMat = new THREE.MeshBasicMaterial({
    map: glowTexture,
    color: 0xff6600,
    transparent: true,
    opacity: 0.9,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    depthTest: true,
    side: THREE.DoubleSide,
  });
  bossProjGlowPool = new THREE.InstancedMesh(glowGeo, glowMat, BOSS_PROJ_POOL_SIZE);
  bossProjGlowPool.name = 'boss-projectile-glow-pool';
  bossProjGlowPool.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  bossProjGlowPool.count = 0;
  bossProjGlowPool.frustumCulled = false;
  bossProjGlowPool.renderOrder = 9;  // Draw before core so core is on top
  bossProjGlowPool.visible = true;
  sceneRef.add(bossProjGlowPool);

  // Initialize free indices (all available)
  for (let i = 0; i < BOSS_PROJ_POOL_SIZE; i++) {
    bossProjFreeIndices.push(i);
    bossProjData.push(null);
  }

  _log('[performance] Boss projectile InstancedMesh pool initialized (50 instances, 2 draw calls)');
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
  if (idx >= bossProjGlowPool.count) {
    bossProjGlowPool.count = idx + 1;
  }

  return idx;
}

export function releaseBossProjIndex(idx) {
  if (idx < 0 || idx >= BOSS_PROJ_POOL_SIZE) return;

  // Hide instance by scaling to 0
  _bossProjMatrix.makeScale(0, 0, 0);
  bossProjCorePool.setMatrixAt(idx, _bossProjMatrix);
  bossProjCorePool.instanceMatrix.needsUpdate = true;
  bossProjGlowPool.setMatrixAt(idx, _bossProjMatrix);
  bossProjGlowPool.instanceMatrix.needsUpdate = true;

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
  if (bossProjGlowPool) {
    bossProjGlowPool.count = 0;
    bossProjGlowPool.visible = false;
    bossProjGlowPool.instanceMatrix.needsUpdate = true;
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
  if (bossProjGlowPool && !bossProjGlowPool.visible) {
    bossProjGlowPool.visible = true;
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
    lifetime: lobbed ? 6000 : 5000, // Lobbed projectiles live longer; hands at ±6.75 need extra distance
    homingStrength: homingStrength,
    wigglePhase: Math.random() * Math.PI * 2,
    wiggleAmplitude: wiggleAmplitude,
    damage: 1,
    explosionDamage: 1,
    explosionRadius: 0.3,
    hitRadius: 0.8,
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
  if (bossProjGlowPool && !bossProjGlowPool.visible) {
    bossProjGlowPool.visible = true;
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

    // Update glow instance: billboard toward camera, fade with age
    if (cameraRef) {
      _billboardMat.lookAt(proj.mesh.position, cameraRef.position, _upVector);
      _billboardQuat.setFromRotationMatrix(_billboardMat);
      // Scale glow slightly with age for a "blooming" effect
      const ageFraction = Math.min(age / proj.lifetime, 1);
      const glowScale = 1 + ageFraction * 0.3;
      _bossProjScale.set(glowScale, glowScale, glowScale);
      _bossProjGlowMatrix.compose(proj.mesh.position, _billboardQuat, _bossProjScale);
      bossProjGlowPool.setMatrixAt(idx, _bossProjGlowMatrix);
    }

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
  bossProjGlowPool.instanceMatrix.needsUpdate = true;
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
  if (_enemyMeshesDirty) {
    rebuildMeshCache();
  }
  let obj = mesh;
  while (obj) {
    // Check for regular enemy first (check userData.isEnemy flag)
    if (obj.userData.isEnemy) {
      const idx = _enemyMeshToIndex.get(obj);
      if (idx !== undefined) {
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
