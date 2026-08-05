// ============================================================
//  PROJECTILE SYSTEM — spawn/update/hit + instanced pools
//  Extracted from main.js (Issue #196 Phase 2 refactor).
//  Owns all projectile/accuracy/explosion state, the InstancedMesh
//  pools, hostile projectile cache, debris glow and seeker queue.
//  Reverse dependencies into main.js (hit handlers, alt-weapon
//  interactions, HUD) are injected via initProjectileSystem().
// ============================================================

import * as THREE from 'three';
import { game, State, addScore, trackCrit, trackKill, trackShot, trackShotHit, registerAccuracyHit, registerAccuracyMiss, damagePlayer } from './game.js';
import {
  getEnemies, getEnemyByMesh, getEnemyCount, getBoss, getBossMinions,
  getBossProjectiles, hitEnemy, hitBoss, hitBossMinion, applyEffects,
  releaseBossProjIndex, spawnHealthGainPopup, collectVoidAnchors,
} from './enemies.js';
import {
  playBossProjectileDestroySound, playBuckshotSound, playBuffedHitSound,
  playComboSound, playDamageSound, playExplosionSound, playHealSound,
  playHitSound, playProjectileWarningSound, playSeekerBurstSound,
  playShoothSound, playTingSound,
} from './audio.js';
import { updateHUD, spawnKillChainPopup, triggerHitFlash } from './hud.js';
import { spawnDamageNumber, spawnCritIndicator } from './damage-numbers.js';
import { spawnVoxelExplosion, activeVoxels } from './voxel-debris.js';
import { startBossDeathCinematic } from './boss-death-cinematic.js';
import { getStasisSlowFactor } from './stasis.js';
import { pointToSegmentDistSq, updateChargeBeamVisuals, getHandForController } from './beam-weapons.js';
// NOTE: intentional ES module cycle — projectile-system ↔ alt-weapons (both
// directions, runtime-only usage), valid for native ES modules. See also the
// beam-weapons cycle comment.
import { checkPlasmaOrbDetonation, checkPlayerProjectileHitsDrone, checkProjectileNaniteInteraction } from './alt-weapons.js';

// [DEBUG] Mirrors main.js — console.log blocks the render thread on Quest
const DEBUG = false;
const _log = DEBUG ? console.log.bind(console) : () => {};
const _warn = DEBUG ? console.warn.bind(console) : () => {};

// ============================================================
// MODULE STATE (moved from main.js — Issue #196 Phase 2)
// ============================================================

// Active projectiles (player + hostile) — exported live binding so
// main.js's alt weapons, nuke and telemetry share the same array.
export const projectiles = [];

const _hashScratchProjectiles = [];

// PERFORMANCE: Hard cap on active projectiles to prevent accumulation
const MAX_PROJECTILES = 150; // Increased from 100 for triple-shot + fast weapon sustained fire

// PERFORMANCE: InstancedMesh projectile system
// Instead of individual THREE.Group/Mesh objects per projectile (each a draw call),
// we use ONE InstancedMesh per projectile type. This collapses ~100 draw calls
// down to ~4, matching the three.js physics_ammo_instancing pattern.
const PROJECTILE_POOL_SIZE = 150;

// Stable single-material projectile visuals.
const PROJECTILE_BOLT = {
  opacity: 0.7,
};

// [CORE] Create reusable projectile material
function createProjectileMaterial(colorHex) {
  const material = basicMat(colorHex, {
    transparent: true,
    opacity: PROJECTILE_BOLT.opacity,
    depthWrite: false,
  });
  material.userData.baseOpacity = PROJECTILE_BOLT.opacity;
  return material;
}

// Per-instance data arrays (parallel to InstancedMesh instance indices)
const projectileInstanceData = {
  laser: [],
  buckshot: [],
  seeker: [],
  plasma_carbine: []
};  // poolType -> [{ active, velocity, stats, controllerIndex, ... }]

// InstancedMesh references per pool type
export const instancedProjectiles = {};  // poolType -> { mesh, glowMesh, haloMesh, maxCount, freeIndices: Set }

// Reusable temp objects (avoid GC pressure)
const _projMatrix = new THREE.Matrix4();
const _projScale = new THREE.Vector3(1, 1, 1);
const _projColor = new THREE.Color();
const _hitStatsScratch = {};  // reused stats object for handleHit
// Scratch vectors moved from main.js with their projectile systems
const _upAxisUnit = new THREE.Vector3(0, 1, 0);           // seeker 180° flip axis
export const _goldColor = new THREE.Color(0xffd700);      // nanite reveal/DoT tint

// Shared camera-shake / floor-flash state — moved from main.js because both
// beam-weapons.js (lightning shield reflect) and main.js's render loop write
// and read it. NOTE: exported as a mutable OBJECT — ES module imported
// bindings are read-only (even for `export let`), so writers mutate
// properties instead of assigning the binding.
export const screenFx = {
  cameraShake: 0,
  cameraShakeIntensity: 0,
  originalCameraPos: new THREE.Vector3(),
  floorFlashing: false,
  floorFlashTimer: 0,
};

// Evolved-weapon hooks (Issue #143 Phase C): projectile-system can't import
// evolutions.js (would cycle), so evolutions.js registers callbacks here —
// same shared-mutable-object pattern as screenFx.
export const evolvedFxHooks = {
  // Called from a Dragon's Breath pellet's update every ~120ms so the
  // pellet drops a burning trail on the ground while it flies.
  onDragonsBreathTrail: null,
};

// Scatter-Seek (Issue #218): enemies recently hit by buckshot pellets,
// preferred as seeker targets when the seeker_burst+buckshot pairing is
// active. Capped + age-pruned to avoid unbounded growth.
export const recentBuckshotHits = [];
const BUCKSHOT_HIT_CAP = 24;
const BUCKSHOT_HIT_MAX_AGE_MS = 1000;

export function recordBuckshotHit(enemyMesh) {
  if (!enemyMesh) return;
  const now = performance.now();
  // Prune stale entries (cheap — capped array, rare pushes)
  for (let i = recentBuckshotHits.length - 1; i >= 0; i--) {
    if (now - recentBuckshotHits[i].time > BUCKSHOT_HIT_MAX_AGE_MS) recentBuckshotHits.splice(i, 1);
  }
  recentBuckshotHits.push({ mesh: enemyMesh, time: now });
  if (recentBuckshotHits.length > BUCKSHOT_HIT_CAP) recentBuckshotHits.shift();
}

// Big Boom cooldown state (exploding-shot upgrade) — owned by handleHit
const BIG_BOOM_COOLDOWN_MS = 2750;
const lastExplodingShotTime = [0, 0];

// Debris glow plane pool (for boss projectile explosion bits)
let _debrisGlowPool = null;       // InstancedMesh for billboarded orange glow
let _debrisGlowActive = [];       // { voxelIndex, poolIndex } mappings
let _debrisGlowFree = [];         // Free instance indices
const DEBRIS_GLOW_POOL_SIZE = 20; // Enough for several simultaneous explosions
const _debrisGlowMatrix = new THREE.Matrix4();
const _debrisGlowQuat = new THREE.Quaternion();
const _debrisGlowScale = new THREE.Vector3();
const _debrisGlowBillboardMat = new THREE.Matrix4();
const _debrisGlowUpVec = new THREE.Vector3(0, 1, 0);
const _debrisGlowHideMat = new THREE.Matrix4().makeScale(0, 0, 0);

// Explosion visuals - pooled for Quest performance (pre-allocated geometry)
const EXPLOSION_POOL_SIZE = 8;
export const explosionPool = [];
export const explosionVisuals = []; // still used for rare non-pooled visuals (toxic pools, shields, boss VFX)
let _explosionGeo = null; // shared unit sphere, created once

// [CORE] Initialize explosion visual pool
export function initExplosionPool(scene) {
  _explosionGeo = new THREE.SphereGeometry(1, 12, 12); // unit sphere, scaled per-use
  _explosionGeo.name = 'explosion-pool-geo';
  for (let i = 0; i < EXPLOSION_POOL_SIZE; i++) {
    const mat = basicMat(0xff8800, {
      transparent: true, opacity: 0.7, side: THREE.BackSide,
      depthWrite: false, blending: THREE.AdditiveBlending,
    });
    const mesh = new THREE.Mesh(_explosionGeo, mat);
    mesh.name = `explosion-pool-${i}`;
    mesh.visible = false;
    mesh.renderOrder = 900;
    scene.add(mesh);
    explosionPool.push({ mesh, active: false, createdAt: 0, duration: 0, radius: 0 });
  }
}

// Seeker burst fire queue: pending shots for burst-fire weapons
// Each entry: { origin, direction, controllerIndex, stats, shotId, fireTime }
export const seekerBurstQueue = [];
const SEEKER_BURST_DELAY = 45; // 45ms between shots in burst ("pew-pew-pew") - reduced from 80ms for faster burst
const SEEKER_BURST_COOLDOWN = 350; // 350ms pause after burst completes (prevents continuous fire with multi-projectile upgrades)
const seekerBurstCooldownEnd = [0, 0]; // per-hand burst cooldown timestamps

// [DEBUG] Player projectile materials that should respond to visual tuning sliders.
export const playerProjectileMaterials = new Set();

// [DEBUG] Register projectile material for visual tuning glow adjustment
function registerPlayerProjectileMaterial(material) {
  if (!material) return;
  if (!material.userData) material.userData = {};
  if (material.userData.baseOpacity === undefined) {
    material.userData.baseOpacity = material.opacity !== undefined ? material.opacity : 1;
  }
  if (material.uniforms?.uOpacity && material.userData.baseUniformOpacity === undefined) {
    material.userData.baseUniformOpacity = material.uniforms.uOpacity.value;
  }
  playerProjectileMaterials.add(material);
}

// ============================================================
// REGISTERED DEPENDENCIES (injected from main.js at init)
// ============================================================
let scene = null;
let camera = null;
let enemySpatialHash = null;
let uiRaycaster = null; // shared raycast scratch (main.js upgrade-select + tank weak points)
// WebXR presenting state (main.js's renderer) — used to skip desktop-only
// camera jolts inside handleHit
let isXrPresenting = () => false;

// Hooks into main.js systems not yet extracted
let basicMat = (color, opts) => null;
let handleEnemyKilled = () => null;
let disposeMesh = () => null;
let disposeObject3D = () => null;
let applyPlayerDamage = () => false;
let checkKillsAlert = () => null;
let endGame = () => null;
let setKilledBy = () => null;
let triggerScreenShake = () => null;
let setMaterialEmissiveSafe = () => null;

/**
 * Register runtime dependencies from main.js. Must be called once at init.
 * @param {Object} deps - { scene, camera, enemySpatialHash, basicMat,
 *   hooks: { handleEnemyKilled, disposeMesh, disposeObject3D,
 *   applyPlayerDamage, checkKillsAlert, endGame, setKilledBy,
 *   triggerScreenShake, setMaterialEmissiveSafe, checkPlasmaOrbDetonation,
 *   checkPlayerProjectileHitsDrone, checkProjectileNaniteInteraction } }
 */
export function initProjectileSystem(deps) {
  if (!deps) return;
  scene = deps.scene || null;
  camera = deps.camera || null;
  enemySpatialHash = deps.enemySpatialHash || null;
  if (typeof deps.basicMat === 'function') basicMat = deps.basicMat;
  if (typeof deps.isXrPresenting === 'function') isXrPresenting = deps.isXrPresenting;
  if (deps.uiRaycaster) uiRaycaster = deps.uiRaycaster;
  const h = deps.hooks || {};
  if (typeof h.handleEnemyKilled === 'function') handleEnemyKilled = h.handleEnemyKilled;
  if (typeof h.disposeMesh === 'function') disposeMesh = h.disposeMesh;
  if (typeof h.disposeObject3D === 'function') disposeObject3D = h.disposeObject3D;
  if (typeof h.applyPlayerDamage === 'function') applyPlayerDamage = h.applyPlayerDamage;
  if (typeof h.checkKillsAlert === 'function') checkKillsAlert = h.checkKillsAlert;
  if (typeof h.endGame === 'function') endGame = h.endGame;
  if (typeof h.setKilledBy === 'function') setKilledBy = h.setKilledBy;
  if (typeof h.triggerScreenShake === 'function') triggerScreenShake = h.triggerScreenShake;
  if (typeof h.setMaterialEmissiveSafe === 'function') setMaterialEmissiveSafe = h.setMaterialEmissiveSafe;
}

// Accuracy bonus shot tracking
let accuracyShotId = 0;
const accuracyShots = new Map();

// [CORE] Accuracy tracking: start shot
function startAccuracyShot(pelletCount, hand) {
  const shotId = ++accuracyShotId;
  accuracyShots.set(shotId, { remaining: pelletCount, hit: false, hand });
  trackShot(hand);
  return shotId;
}

// Track previous accuracy multiplier for popup triggers
let prevAccuracyMultiplier = 1;

// [CORE] Accuracy tracking: mark hit
function markAccuracyHit(shotId, hand) {
  const shot = accuracyShots.get(shotId);
  if (!shot || shot.hit) return;
  shot.hit = true;
  trackShotHit(0, hand);

  // Store previous multiplier before hit
  const oldMultiplier = game.accuracyMultiplier || 1;
  registerAccuracyHit();
  const newMultiplier = game.accuracyMultiplier || 1;

  // Spawn accuracy popup if multiplier increased to a new integer threshold (2x, 3x, 4x, 5x)
  const oldThreshold = Math.floor(oldMultiplier);
  const newThreshold = Math.floor(newMultiplier);
  if (newThreshold > oldThreshold && newThreshold >= 2) {
    spawnKillChainPopup(newThreshold, camera.position);
    playComboSound(newThreshold);
    _log(`[accuracy] ${newThreshold}x accuracy bonus!`);
  }

  prevAccuracyMultiplier = newMultiplier;
}

// [CORE] Accuracy tracking: resolve shot and apply bonus
function resolveAccuracyPellet(shotId) {
  const shot = accuracyShots.get(shotId);
  if (!shot) return;
  shot.remaining -= 1;
  if (shot.remaining <= 0) {
    accuracyShots.delete(shotId);
    if (!shot.hit) {
      registerAccuracyMiss();
      // REMOVED: triggerAccuracyHurt() - red flash should only trigger on player damage, not missed shots
    }
  }
}

// [CORE] Resolve a shot that never spawned projectiles (pool exhausted / dropped).
// Every pellet of the shot must be resolved once, otherwise the accuracyShots
// Map entry leaks (and the miss is never registered).
function resolveDroppedShot(shotId, pelletCount) {
  if (!shotId) return;
  const count = Math.max(1, pelletCount || 1);
  for (let i = 0; i < count; i++) resolveAccuracyPellet(shotId);
}

// Perf: hostile-projectile caches rebuilt once per frame in updateProjectiles().
// The original code scanned ALL earlier entries of projectiles[] for every
// player projectile (O(n²) per frame). Hostile entries are rare, so caching
// them turns the scan into O(n + n·h). Must be maintained at every removal
// site within the frame (see _dropHostileFromCache).
const _hostileProjectilesInArray = [];
const _hostileVisualsInExplosion = [];

function _dropHostileFromCache(proj) {
  if (!proj) return;
  const li = _hostileProjectilesInArray.indexOf(proj);
  if (li >= 0) _hostileProjectilesInArray.splice(li, 1);
}
// PERFORMANCE: Clear all active projectiles and return them to pool
// [CORE] Clear all projectiles from scene
function clearAllProjectiles() {
  for (let i = projectiles.length - 1; i >= 0; i--) {
    const proj = projectiles[i];
    if (proj?.userData?.isPooled) {
      returnProjectileToPool(proj);
    } else {
      // Many hostile/boss helper projectiles allocate unique geo/mat per shot.
      // Remove and dispose so GPU resources do not accumulate across levels.
      disposeObject3D(proj);
    }
  }
  projectiles.length = 0;

  // Prune disposed materials from the projectile tuning set
  for (const mat of playerProjectileMaterials) {
    if (mat.disposed) playerProjectileMaterials.delete(mat);
  }
}

function initProjectilePool() {
  if (instancedProjectiles['laser']) return;

  // ── Laser bolts (standard blaster) ──
  const laserGeo = new THREE.CylinderGeometry(0.03, 0.03, 1.0, 6);
  laserGeo.rotateX(Math.PI / 2);
  const laserMat = createProjectileMaterial(0xffffff);
  registerPlayerProjectileMaterial(laserMat);
  const laserIM = new THREE.InstancedMesh(laserGeo, laserMat, 120);
  laserIM.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  laserIM.count = 0;
  laserIM.frustumCulled = false;
  laserIM.renderOrder = 950;
  scene.add(laserIM);
  instancedProjectiles['laser'] = { mesh: laserIM, maxCount: 120, freeIndices: new Set() };

  // ── Buckshot pellets ──
  const buckGeo = new THREE.SphereGeometry(0.05, 6, 6);
  const buckMat = createProjectileMaterial(0xffffff);
  registerPlayerProjectileMaterial(buckMat);
  const buckIM = new THREE.InstancedMesh(buckGeo, buckMat, 40);
  buckIM.name = 'buckshot-instanced';
  buckIM.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  buckIM.count = 0;
  buckIM.frustumCulled = false;
  buckIM.renderOrder = 950;
  scene.add(buckIM);
  instancedProjectiles['buckshot'] = { mesh: buckIM, maxCount: 40, freeIndices: new Set() };

  // ── Seeker burst bolts: tadpole/sperm shape via LatheGeometry ──
  // Profile curve (radius at each Z position), revolved around Y axis, then rotated to point -Z
  const seekerPts = [
    new THREE.Vector2(0.0, 0.0),    // z=-0.06 tip of head
    new THREE.Vector2(0.06, 0.03),  // z=-0.04 widest head (1.5x)
    new THREE.Vector2(0.03, 0.09), // z=0 neck
    new THREE.Vector2(0.012, 0.165),// z=0.05 tail start
    new THREE.Vector2(0.003, 0.315),// z=0.15 tail end
  ];
  const seekerCurve = new THREE.SplineCurve(seekerPts);
  const seekerGeo = new THREE.LatheGeometry(seekerCurve.getPoints(20), 8, 0, Math.PI * 2);
  // LatheGeometry revolves around Y axis: profile X=radius, Y=height
  // Rotate so head points -Z (forward) and tail extends +Z
  seekerGeo.rotateX(Math.PI / 2);
  const seekerMat = createProjectileMaterial(0xffffff);
  registerPlayerProjectileMaterial(seekerMat);
  const seekerIM = new THREE.InstancedMesh(seekerGeo, seekerMat, 60);
  seekerIM.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  seekerIM.count = 0;
  seekerIM.frustumCulled = false;
  seekerIM.renderOrder = 950;
  scene.add(seekerIM);
  instancedProjectiles['seeker'] = { mesh: seekerIM, maxCount: 60, freeIndices: new Set() };

  // ── Plasma carbine darts ──
  // PERFORMANCE: Bumped from 30 to 80 to support dual wield + fire rate upgrades
  const plasmaGeo = new THREE.CylinderGeometry(0.025, 0.025, 0.25, 6);  // Thinner and shorter than standard blaster bolts
  plasmaGeo.rotateX(Math.PI / 2);
  const plasmaMat = createProjectileMaterial(0xffffff);
  registerPlayerProjectileMaterial(plasmaMat);
  const plasmaIM = new THREE.InstancedMesh(plasmaGeo, plasmaMat, 80);
  plasmaIM.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  plasmaIM.count = 0;
  plasmaIM.frustumCulled = false;
  plasmaIM.renderOrder = 950;
  scene.add(plasmaIM);
  instancedProjectiles['plasma_carbine'] = { mesh: plasmaIM, maxCount: 80, freeIndices: new Set() };

  Object.keys(projectileInstanceData).forEach(poolType => {
    const maxCount = instancedProjectiles[poolType].maxCount;
    for (let i = 0; i < maxCount; i++) {
      projectileInstanceData[poolType].push(null);
    }
  });

  // ── Player projectile glow planes (Star Wars-style bloom) ──
  // Create separate glow textures per weapon type with matching colors
  function createGlowTexture(r, g, b) {
    const size = 64;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    const half = size / 2;
    const grad = ctx.createRadialGradient(half, half, 0, half, half, half);
    grad.addColorStop(0, `rgba(255,255,255,1)`);       // Bright white core
    grad.addColorStop(0.2, `rgba(${Math.floor(r*255)},${Math.floor(g*255)},${Math.floor(b*255)},0.7)`);
    grad.addColorStop(0.5, `rgba(${Math.floor(r*200)},${Math.floor(g*200)},${Math.floor(b*200)},0.3)`);
    grad.addColorStop(1, `rgba(${Math.floor(r*100)},${Math.floor(g*100)},${Math.floor(b*100)},0)`);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, size, size);
    const tex = new THREE.CanvasTexture(canvas);
    tex.minFilter = THREE.LinearFilter;
    return tex;
  }

  // Weapon glow colors (weapon identity colors, not hand-based)
  // Standard blaster: cyan left / pink right (per hand)
  // Other weapons: single identity color
  const glowTextures = {
    laser: createGlowTexture(0.0, 1.0, 1.0),              // Cyan (standard blaster left)
    laser_right: createGlowTexture(1.0, 0.0, 1.0),        // Pink (standard blaster right)
    buckshot: createGlowTexture(1.0, 0.53, 0.0),          // Orange #ff8800
    seeker: createGlowTexture(0.51, 1.0, 0.17),           // Lightsaber green #83FF2B
    plasma_carbine: createGlowTexture(0.64, 0.31, 0.71),  // Purple #A450B6
  };

  // Create glow pool for each projectile type
  // Standard blaster (laser) gets two pools: cyan for left, pink for right
  // Other weapons get a single identity-colored pool
  const glowGeo = new THREE.PlaneGeometry(0.35, 0.35);
  const glowPoolConfigs = [
    { poolType: 'laser', texKey: 'laser', count: 60 },
    { poolType: 'laser_right', texKey: 'laser_right', count: 60 },
    { poolType: 'buckshot', texKey: 'buckshot', count: instancedProjectiles['buckshot'].maxCount },
    { poolType: 'seeker', texKey: 'seeker', count: instancedProjectiles['seeker'].maxCount },
    { poolType: 'plasma_carbine', texKey: 'plasma_carbine', count: instancedProjectiles['plasma_carbine'].maxCount },
  ];

  for (const cfg of glowPoolConfigs) {
    const glowTex = glowTextures[cfg.texKey] || glowTextures.laser;
    const glowMat = new THREE.MeshBasicMaterial({
      map: glowTex,
      transparent: true,
      opacity: 0.8,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      depthTest: true,
      side: THREE.DoubleSide,
    });
    registerPlayerProjectileMaterial(glowMat);

    const glowIM = new THREE.InstancedMesh(glowGeo, glowMat, cfg.count);
    glowIM.name = `${cfg.poolType}-glow-pool`;
    glowIM.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    glowIM.count = 0;
    glowIM.frustumCulled = false;
    glowIM.renderOrder = 949;  // Just behind the projectile cores (950)
    glowIM.visible = true;
    scene.add(glowIM);

    // Store glow pool reference
    // laser -> laser glow, laser_right -> laser glow (both map to 'laser' projectile pool)
    if (cfg.poolType === 'laser_right') {
      instancedProjectiles['laser'].glowMeshRight = glowIM;
    } else {
      instancedProjectiles[cfg.poolType].glowMesh = glowIM;
    }

    // Initialize all glow instances as hidden (scale 0)
    const hideMatrix = new THREE.Matrix4().makeScale(0, 0, 0);
    for (let i = 0; i < cfg.count; i++) {
      glowIM.setMatrixAt(i, hideMatrix);
    }
    glowIM.instanceMatrix.needsUpdate = true;
  }

  _log('[performance] InstancedMesh projectile pools initialized: laser(120), buckshot(40), seeker(60), plasma_carbine(80) + glow planes');
}

// PERFORMANCE: Acquire an instance slot from the InstancedMesh pool.
// Returns { index, pool } or null if pool exhausted.
// [CORE] Get a pooled projectile from the instanced mesh pool
function getPooledProjectile(poolType, color) {
  const pool = instancedProjectiles[poolType];
  if (!pool) return null;

  // Find a free slot
  let slotIndex = -1;
  if (pool.freeIndices.size > 0) {
    slotIndex = pool.freeIndices.values().next().value;
    pool.freeIndices.delete(slotIndex);
  } else if (pool.mesh.count < pool.maxCount) {
    slotIndex = pool.mesh.count;
    pool.mesh.count = slotIndex + 1;
  } else {
    // Pool exhausted - try to recycle oldest
    return null;
  }

  pool.mesh.setColorAt(slotIndex, _projColor.setHex(color));
  pool.mesh.instanceColor.needsUpdate = true;

  // Reset transforms so projectile + glow twins start hidden
  _projMatrix.makeScale(0, 0, 0);
  commitProjectileInstance(poolType, slotIndex, _projMatrix);

  // Initialize instance data
  if (!projectileInstanceData[poolType][slotIndex]) {
    projectileInstanceData[poolType][slotIndex] = {};
  }
  const data = projectileInstanceData[poolType][slotIndex];
  data.active = true;
  data.poolType = poolType;
  data.instanceIndex = slotIndex;
  data.position = new THREE.Vector3();
  data.quaternion = new THREE.Quaternion();

  // Return a lightweight proxy object that updateProjectiles() can use
  // This proxy mimics the old mesh interface: .position, .userData, .visible
  return createProjectileProxy(poolType, slotIndex, color);
}

// Create a proxy object that mimics THREE.Mesh for projectile compatibility.
// The proxy tracks position/rotation in the parallel data array and syncs
// to the InstancedMesh via commitProjectileInstance().
// [CORE] Create projectile proxy for instanced rendering
function createProjectileProxy(poolType, instanceIndex, color) {
  const pool = instancedProjectiles[poolType];
  const data = projectileInstanceData[poolType][instanceIndex];

  // Proxy position that writes to InstancedMatrix on commit
  const pos = new THREE.Vector3();

  const proxy = {
    // Compatible with existing code that checks these
    visible: true,
    userData: {
      isPooled: true,
      poolType: poolType,
      instanceIndex: instanceIndex,
      velocity: null,
      stats: null,
      controllerIndex: undefined,
      isExploding: undefined,
      lifetime: undefined,
      createdAt: undefined,
      hitEnemies: null,
      shotId: undefined,
      hitConfirmed: false,
      homingRange: 0,
      homingStrength: 0,
      baseSpeed: 0,
      homingTarget: null,
      tailPhase: 0,
      tailSpeed: 0,
      direction: null,
      speed: 0,
      wigglePhase: Math.random() * Math.PI * 2,
      damage: 0,
      duration: 0,
      isBossProjectile: false,
      isDecoy: false,
      explosionRadius: 0,
      explosionDamage: 0,
      naniteInfused: false,
      isDroneProjectile: false,
      scatterSeek: false, // Issue #218: home to buckshot-hit targets
    },
    // Position accessor - returns a vector that we sync to the instance matrix
    get position() { return pos; },
    set position(v) { pos.copy(v); },
    // Quaternion for orientation
    get quaternion() { return data.quaternion; },
    set quaternion(q) { data.quaternion.copy(q); },
    // Children accessor (compatibility for seeker visual updates)
    children: [],
    // Material (compatibility)
    material: pool.mesh.material,
  };

  // Sync position to the InstancedMesh pair (core + glow)
  proxy.commit = function() {
    _projMatrix.compose(pos, data.quaternion, _projScale);
    commitProjectileInstance(poolType, instanceIndex, _projMatrix, proxy._controllerIndex);
  };

  return proxy;
}

// Reusable temp objects for glow billboarding
const _projGlowMat = new THREE.Matrix4();
const _projGlowQuat = new THREE.Quaternion();
const _projGlowScale = new THREE.Vector3(1, 1, 1);
const _projGlowScale0 = new THREE.Vector3(0, 0, 0);
const _projGlowPos = new THREE.Vector3();
const _projGlowTmpQ = new THREE.Quaternion();
const _projGlowScl = new THREE.Vector3();
const _upVec = new THREE.Vector3(0, 1, 0);

// [CORE] Commit projectile instance transform to instanced mesh + glow billboard
function commitProjectileInstance(poolType, instanceIndex, matrix, controllerIndex) {
  const pool = instancedProjectiles[poolType];
  if (!pool) return;
  pool.mesh.setMatrixAt(instanceIndex, matrix);
  pool.mesh.instanceMatrix.needsUpdate = true;

  // Select glow mesh: laser pool uses left/right glow based on controller
  let glow = pool.glowMesh;
  if (poolType === 'laser' && pool.glowMeshRight) {
    glow = (controllerIndex === 1) ? pool.glowMeshRight : pool.glowMesh;
  }

  // Keep glow mesh count in sync with core
  if (glow && glow.count < pool.mesh.count) {
    glow.count = pool.mesh.count;
  }

  // Update glow billboard plane (if pool has one)
  if (glow && camera) {
    _projGlowPos.setFromMatrixPosition(matrix);
    matrix.decompose(_projGlowPos, _projGlowTmpQ, _projGlowScl);
    const isHidden = _projGlowScl.x < 0.001;
    // Re-get position since decompose overwrites it
    _projGlowPos.setFromMatrixPosition(matrix);

    if (isHidden) {
      glow.setMatrixAt(instanceIndex, _projGlowMat.compose(_projGlowPos, _projGlowQuat, _projGlowScale0));
    } else {
      _projGlowMat.lookAt(_projGlowPos, camera.position, _upVec);
      _projGlowQuat.setFromRotationMatrix(_projGlowMat);
      glow.setMatrixAt(instanceIndex, _projGlowMat.compose(_projGlowPos, _projGlowQuat, _projGlowScale));
    }
    glow.instanceMatrix.needsUpdate = true;
  }
}

// PERFORMANCE: Return projectile instance to pool (deactivate)
// [CORE] Return projectile to pool for reuse
function returnProjectileToPool(proj) {
  if (!proj || !proj.userData) return;

  const poolType = proj.userData.poolType;
  const instanceIndex = proj.userData.instanceIndex;

  if (poolType && instanceIndex !== undefined && instancedProjectiles[poolType]) {
    const pool = instancedProjectiles[poolType];

    // Hide instance by scaling to zero
    _projMatrix.makeScale(0, 0, 0);
    commitProjectileInstance(poolType, instanceIndex, _projMatrix, proj.userData.controllerIndex);

    // Also hide right-hand glow if laser pool
    if (poolType === 'laser' && pool.glowMeshRight) {
      const rightGlow = pool.glowMeshRight;
      if (rightGlow.count > instanceIndex) {
        rightGlow.setMatrixAt(instanceIndex, _projMatrix);
        rightGlow.instanceMatrix.needsUpdate = true;
      }
    }

    // Mark as free (DO NOT shrink count - can hide active instances at higher indices)
    pool.freeIndices.add(instanceIndex);

    // Clear instance data
    if (projectileInstanceData[poolType][instanceIndex]) {
      const d = projectileInstanceData[poolType][instanceIndex];
      d.active = false;
      // Reset all userData fields
      const ud = proj.userData;
      ud.velocity = null;
      ud.stats = null;
      ud.controllerIndex = undefined;
      ud.isExploding = undefined;
      ud.lifetime = undefined;
      ud.createdAt = undefined;
      ud.hitEnemies = null;
      ud.homingRange = 0;
      ud.homingStrength = 0;
      ud.baseSpeed = 0;
      ud.homingTarget = null;
      ud.tailPhase = 0;
      ud.tailSpeed = 0;
      ud.direction = null;
      ud.speed = 0;
      ud.damage = 0;
      ud.duration = 0;
      ud.isBossProjectile = false;
      ud.isDecoy = false;
      ud.naniteInfused = false;
      ud.isDroneProjectile = false;
    }
  } else {
    // Fallback for non-instanced projectiles (hostile projectiles, decoys, etc.)
    proj.visible = false;
  }
}

// [CORE] Check if projectile is hostile (boss projectile)
function isHostileProjectile(proj) {
  return !!(proj && proj.userData && (proj.userData.isBossProjectile || (proj.userData.damage && !proj.userData.stats)));
}

// [CORE] Trigger hostile projectile explosion effect
function triggerHostileProjectileExplosion(position, radius, damage) {
  const blastPos = position.clone();
  spawnExplosionVisual(blastPos, radius);
  if (typeof window !== 'undefined' && typeof window.createExplosionAt === 'function' && damage > 0) {
    window.createExplosionAt(blastPos, radius, damage);
  }
}

// [CORE] Spawn boss projectile destruction VFX
function spawnBossProjectileDestructionFX(position, projColor) {
  // Debris: orange/warm voxels matching boss projectile orb color
  const sparkCount = 4 + Math.floor(Math.random() * 3); // 4-6
  const bossDebrisColor = 0xff8833; // Warm orange matching boss projectile orb
  spawnVoxelExplosion(position.clone(), bossDebrisColor, sparkCount, 'basic', false, false);
  // Scale to 55% (larger than old 30%, still smaller than enemy 100%)
  for (let i = Math.max(0, activeVoxels.length - sparkCount); i < activeVoxels.length; i++) {
    activeVoxels[i].scale.setScalar(0.55);
    activeVoxels[i].userData.isBossDebris = true;
    // Acquire a glow plane for this debris bit
    if (_debrisGlowFree.length > 0) {
      const gIdx = _debrisGlowFree.pop();
      if (gIdx >= _debrisGlowPool.count) _debrisGlowPool.count = gIdx + 1;
      _debrisGlowActive.push({ voxel: activeVoxels[i], glowIdx: gIdx });
    }
  }
  // Play fizzle sound (throttled in audio.js to avoid spam)
  playBossProjectileDestroySound();
}

const SEEKER_RETARGET_INTERVAL_MS = 120;

// [CORE] Update seeker projectile visual (homing curve)
function updateSeekerProjectileVisual(proj, dt) {
  if (!proj || !proj.children || proj.children.length < 2) return;
  proj.userData.tailPhase = (proj.userData.tailPhase || Math.random() * Math.PI * 2) + dt * (proj.userData.tailSpeed || 18);
  const head = proj.children[0];
  const tail = proj.children[1];
  const glow = proj.children[2];
  const sway = Math.sin(proj.userData.tailPhase) * 0.06;
  tail.rotation.z = sway;
  tail.scale.y = 0.85 + Math.sin(proj.userData.tailPhase * 1.7) * 0.12;
  head.position.x = Math.sin(proj.userData.tailPhase * 0.5) * 0.01;
  if (glow && glow.material) {
    glow.material.opacity = 0.18 + Math.sin(proj.userData.tailPhase * 1.5) * 0.08;
  }
}

// [CORE] Find nearest enemy target for seeker projectile
function findSeekerTarget(proj) {
  const homingRange = proj.userData.homingRange || 0;
  if (homingRange <= 0) return null;
  const enemies = getEnemies();

  // Issue #218 Scatter-Seek: prefer fresh buckshot-hit targets
  if (proj.userData.scatterSeek) {
    const now = performance.now();
    for (const entry of recentBuckshotHits) {
      if (now - entry.time > BUCKSHOT_HIT_MAX_AGE_MS) continue;
      const mesh = entry.mesh;
      if (!mesh || !mesh.parent) continue;
      if (mesh.position.distanceToSquared(proj.position) <= homingRange * homingRange) {
        return mesh;
      }
    }
  }

  let nearestTarget = null;
  let nearestDistSq = homingRange * homingRange;
  for (let i = 0; i < enemies.length; i++) {
    const mesh = enemies[i]?.mesh;
    if (!mesh) continue;
    const distSq = mesh.position.distanceToSquared(proj.position);
    if (distSq < nearestDistSq) {
      nearestDistSq = distSq;
      nearestTarget = mesh;
    }
  }

  const boss = getBoss();
  if (boss?.mesh) {
    const bossDistSq = boss.mesh.position.distanceToSquared(proj.position);
    if (bossDistSq < nearestDistSq) {
      nearestTarget = boss.mesh;
    }
  }

  return nearestTarget;
}

// [CORE] Update hostile projectile visual effects
function updateHostileProjectileVisual(proj, now) {
  if (!proj) return;
  const pulse = 0.75 + Math.sin(now * 0.012 + (proj.userData.glowPhase || 0)) * 0.25;
  if (proj.material) {
    proj.material.opacity = Math.min(1, 0.8 + pulse * 0.2);
  }
  if (proj.children) {
    proj.children.forEach((child, index) => {
      if (!child.material) return;
      if (index === 0) {
        child.scale.setScalar(0.9 + pulse * 0.15);
      } else {
        child.scale.setScalar(0.95 + pulse * 0.3);
        child.material.opacity = Math.min(1, 0.25 + pulse * 0.4);
      }
    });
  }
}

// ============================================================
// VOXEL PHYSICS DEATH SYSTEM
// Pooled voxels for enemy death explosions
// MAIN WEAPON FIRING
// fireMainWeapon, lightning beams, charge shots, plasma carbine
// HOT PATH: Called every frame when trigger held during PLAYING
// COUPLING: weaponCooldowns, chargeShotStartTime, projectiles[]
// ============================================================
// [CORE] Fire main weapon (pistol, shotgun, etc.)
function spawnProjectile(origin, direction, controllerIndex, stats, shotId, options = {}) {
  // PERFORMANCE: Recycle oldest projectile when at cap to keep fire continuous
  if (projectiles.length >= MAX_PROJECTILES) {
    const recycled = projectiles.shift();
    if (recycled) {
      // Fix: resolve accuracy tracking before recycling — recycled shots never
      // hit the update loop's resolve path, leaking accuracyShots Map entries
      resolveProjectileAccuracy(recycled);
      returnProjectileToPool(recycled);
    }
  }

  const now = performance.now();
  // Use spread threshold: only treat as buckshot if spread > 5 degrees (0.087 rad)
  // This prevents plasma carbine (1.5 deg spread) from being treated as buckshot
  const BUCKSHOT_SPREAD_THRESHOLD = 0.087; // ~5 degrees
  const isBuckshot = (stats.spreadAngle || 0) > BUCKSHOT_SPREAD_THRESHOLD && !stats.homing;
  const isPlasmaCarbine = stats.mainWeaponId === 'plasma_carbine';
  const poolType = stats.homing ? 'seeker' : (isPlasmaCarbine ? 'plasma_carbine' : (isBuckshot ? 'buckshot' : 'laser'));
  
  // All projectile cores are white (Star Wars blaster style)
  // Color identity comes from glow billboards + controller spheres
  const projectileColor = 0xffffff;

  // [DEBUG] Projectile investigation logging in spawnProjectile
  if (window.DEBUG_PROJECTILES) {
    const handLabel = controllerIndex === 0 ? 'LEFT' : 'RIGHT';
  }

  // Big Boom: only one exploding shot per hand every 2.75s
  let isExploding = false;
  if (stats.aoeRadius > 0) {
    if (now - lastExplodingShotTime[controllerIndex] >= BIG_BOOM_COOLDOWN_MS) {
      isExploding = true;
      lastExplodingShotTime[controllerIndex] = now;
    }
  }

  // PERFORMANCE: Get projectile from pool instead of creating new
  let mesh = getPooledProjectile(poolType, projectileColor);

  if (!mesh) {
    // Pool exhausted - force-expire active projectiles until we free a slot in the right pool type
    // A single recycle may free a slot in a different pool type, so loop until we succeed
    const recycleLimit = projectiles.length; // bound: don't recycle more than currently active
    for (let i = 0; i < recycleLimit; i++) {
      const recycled = projectiles.shift();
      if (recycled) {
        // Fix: same accuracy resolution as above — this forced-expire path also
        // bypasses the update loop's resolve path
        resolveProjectileAccuracy(recycled);
        returnProjectileToPool(recycled);
        mesh = getPooledProjectile(poolType, projectileColor);
        if (mesh) break;
      } else {
        break;
      }
    }
  }

  if (!mesh) {
    // Safety net: all pools exhausted, no active projectiles to recycle
    if (window.DEBUG_PROJECTILES) {
      window._droppedShots = (window._droppedShots || 0) + 1;
      console.warn(`[PROJECTILE] Shot dropped (pool exhausted). Total dropped: ${window._droppedShots}, poolType: ${poolType}`);
    }
    // Fix: this shot registered accuracy pellets in startAccuracyShot but never
    // spawned a projectile — resolve them so the Map entry can't leak
    resolveDroppedShot(shotId, stats?.projectileCount);
    return;
  }

  // Reset and activate pooled projectile
  mesh.position.copy(origin);
  let shotDirection = direction.clone();
  if (isBuckshot) {
    // Use half the spreadAngle as max per-pellet deviation for natural distribution
    const halfCone = (stats.spreadAngle || THREE.MathUtils.degToRad(8)) * 0.5;
    const angle = Math.random() * halfCone;
    let axis = new THREE.Vector3(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5);
    if (axis.lengthSq() < 0.0001) axis.set(0, 1, 0);
    axis.cross(shotDirection);
    if (axis.lengthSq() < 0.0001) axis.set(1, 0, 0);
    axis.normalize();
    shotDirection.applyAxisAngle(axis, angle);
  }
  const projectileSpeed = stats.projectileSpeed || (isBuckshot ? 20 : 40);
  mesh.userData.velocity = shotDirection.clone().multiplyScalar(projectileSpeed);
  mesh.userData.stats = stats;
  mesh.userData.controllerIndex = controllerIndex;
  mesh._controllerIndex = controllerIndex;  // For commitProjectileInstance glow routing
  mesh.userData.isExploding = isExploding;
  mesh.userData.lifetime = 1500;
  mesh.userData.createdAt = performance.now();
  mesh.userData.hitEnemies = new Set();
  mesh.userData.shotId = shotId;
  mesh.userData.hitConfirmed = false;
  mesh.userData.homingRange = stats.homing ? (stats.homingRange || 15) : 0;
  mesh.userData.homingStrength = stats.homing ? 15 : 0;
  mesh.userData.baseSpeed = projectileSpeed;
  mesh.userData.homingTarget = null;
  mesh.userData.nextHomingTargetRefreshAt = 0;
  mesh.userData.tailPhase = stats.homing ? Math.random() * Math.PI * 2 : 0;
  mesh.userData.tailSpeed = stats.homing ? 16 + Math.random() * 5 : 0;
  mesh.userData.scatterSeek = !!stats.scatterSeek; // Issue #218
  mesh.userData.spawnPos = origin.clone(); // Issue #213 Point Blank range ramp
  mesh.visible = true;

  // Orient bolt along direction
  if (!isBuckshot) {
    mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, -1), direction);
  }

  // Commit initial position to InstancedMesh
  if (mesh.commit) {
    mesh.commit();
  }

  projectiles.push(mesh);

  if (!options.suppressSound) {
    if (isBuckshot) {
      playBuckshotSound();
    } else {
      playShoothSound();
    }
  }

  // Return the pooled proxy so callers can tag it (Issue #143: evolved
  // weapons set userData flags like isHelix / isDragonsBreath after spawn).
  return mesh;
}

// Process seeker burst queue - fires queued shots at their scheduled time
// [CORE] Process seeker burst queue
function processSeekerBurstQueue(now) {
  if (seekerBurstQueue.length === 0) return;
  
  // Process all shots that are ready to fire
  for (let i = seekerBurstQueue.length - 1; i >= 0; i--) {
    const shot = seekerBurstQueue[i];
    if (now >= shot.fireTime) {
      spawnProjectile(shot.origin, shot.direction, shot.controllerIndex, shot.stats, shot.shotId, { suppressSound: true });
      // Play per-shot sound: "p" for middle shots, full "pew" for last
      playSeekerBurstSound(shot.isLastShot, shot.totalShots, shot.burstIndex);
      // Set burst cooldown when last shot fires
      if (shot.isLastShot) {
        seekerBurstCooldownEnd[shot.controllerIndex] = now + SEEKER_BURST_COOLDOWN;
      }
      seekerBurstQueue.splice(i, 1);
    }
  }
}

// ============================================================
//  SLOW-MO DEATH CAMERA
// ============================================================

// [CORE] Linear interpolation helper
function countActiveStatusEffects(enemy) {
  if (!enemy || !enemy.statusEffects) return 0;
  let count = 0;
  for (const key of Object.keys(enemy.statusEffects)) {
    if ((enemy.statusEffects[key]?.stacks || 0) > 0) count++;
  }
  return count;
}

// [CORE] Linear interpolation helper
function handleHit(enemyIndex, enemy, stats, hitPoint, controllerIndex, isExploding, hitWeakPoint, hitInfo) {
  // Issue #218 Scatter-Seek: record buckshot pellet hits so seekers can home
  // to them (same spread threshold as spawnProjectile).
  const BUCKSHOT_SPREAD_THRESHOLD_HIT = 0.087;
  if ((stats.spreadAngle || 0) > BUCKSHOT_SPREAD_THRESHOLD_HIT && !stats.homing) {
    recordBuckshotHit(enemy.mesh);
  }

  // Calculate damage
  let damage = stats.damage;

  // Issue #213 Point Blank (buckshot mastery): damage ramps the closer the
  // pellet is to its spawn point (2x under 3m, 1.5x under 6m)
  if (stats.pointBlank) {
    const travel = stats.travelDist || 0;
    if (travel < 3) damage *= 2;
    else if (travel < 6) damage *= 1.5;
  }

  // Tank weak point (one random voxel takes double damage)
  if (hitWeakPoint) damage *= 2;

  // Critical hit
  let isCrit = false;
  if (stats.critChance > 0 && Math.random() < stats.critChance) {
    damage *= (stats.critMultiplier || 2);
    isCrit = true;
    trackCrit();
    // Issue #172: eclipsed crit upgrades reflect — the shot loses its crit
    // and the player takes 1 damage instead (15% of crits; survivable over
    // the 10s eclipse, impossible to ignore at high fire rate)
    if (stats.critReflect && Math.random() < 0.15) {
      isCrit = false;
      damage /= (stats.critMultiplier || 2);
      const dead = applyPlayerDamage(1);
      screenFx.cameraShake = Math.max(screenFx.cameraShake || 0, 0.25);
      screenFx.cameraShakeIntensity = 0.03;
      triggerScreenShake(0.1, 300);
      if (dead) endGame(false);
    }
  }

  // Impact freeze for critical hits or weak points
  const isCritical = isCrit;
  if (isCritical) {
    // Freeze frame briefly (0.1s visual pause)
    const freezeDuration = 100; // 0.1 seconds

    // Small camera jolt (desktop only - skip in VR to avoid fighting with WebXR tracking)
    if (!isXrPresenting()) {
      camera.position.x += (Math.random() - 0.5) * 0.05;
      camera.position.y += (Math.random() - 0.5) * 0.05;
    }

    // No red screen flash on crits - removed per user request
    // triggerHitFlash();

    if (DEBUG) console.log(`[Impact] CRITICAL HIT! Damage: ${Math.round(damage)}, Freeze: ${freezeDuration}ms`);
  }

  // Fire debuff increases damage taken
  if (enemy.statusEffects.fire.stacks > 0) {
    damage *= stats.fireWeakenMult;
  }

  // Apply damage
  const resolvedHitInfo = { ...hitInfo, weakPoint: hitWeakPoint };
  const result = hitEnemy(enemyIndex, damage, resolvedHitInfo);

  // Track damage for hand stats
  if (controllerIndex !== undefined) {
    const hand = getHandForController(controllerIndex);
    game.handStats[hand].totalDamage += damage;
  }

  // Spawn damage number (reddish if enemy is buffed by conductor, yellow+double if crit)
  const isBuffed = enemy.linkedByConductor && enemy.linkedDamageReduction > 0;
  const dmgColor = isCritical ? '#ffff00' : (isBuffed ? '#ff6666' : '#ffffff');
  spawnDamageNumber(hitPoint, damage, dmgColor, isCritical ? 2.0 : 1.0);
  
  // CRIT indicator for critical hits
  if (isCritical) {
    spawnCritIndicator(hitPoint);
  }
  
  // Muffled hit sound for buffed enemies, normal hit otherwise
  if (isBuffed) {
    playBuffedHitSound();
  } else {
    playHitSound();
  }

  // Apply status effects
  if (stats.effects.length > 0) {
    applyEffects(enemyIndex, stats.effects);
  }

  // AOE explosion: exploding shots (once per 2.75s per hand) OR combo-forced
  // explosions (Issue #218: Heat Wave / Overload) with a custom aoeDamage.
  if (stats.aoeRadius > 0 && (isExploding || stats.forceExplosion)) {
    handleAOE(hitPoint, stats.aoeRadius, stats.aoeDamage || stats.damage * 1.2, controllerIndex);
    spawnExplosionVisual(hitPoint, stats.aoeRadius);
  }

  // If killed
  if (result.killed) {
    playExplosionSound();
    // Issue #189 style attribution: pass kill source + style-flavored flags
    const statusCombo = countActiveStatusEffects(enemy) >= 2;
    const destroyData = handleEnemyKilled(enemyIndex, {
      isCritical,
      overkill: result.overkill > 0,
      killsWithoutHit: true,
      skipChain: false,
      hand: controllerIndex !== undefined ? getHandForController(controllerIndex) : undefined,
      isRicochet: !!stats.isRicochetHit,
      statusCombo,
    });
    if (destroyData) {
      // Track kills for hand stats
      if (controllerIndex !== undefined) {
        const hand = getHandForController(controllerIndex);
        game.handStats[hand].kills++;
        
        // Track enemy kills by type
        if (destroyData.type) {
          if (!game.handStats[hand].enemyKills) {
            game.handStats[hand].enemyKills = {};
          }
          game.handStats[hand].enemyKills[destroyData.type] = (game.handStats[hand].enemyKills[destroyData.type] || 0) + 1;
        }
      }

      // Vampiric healing
      if (stats.vampiricInterval > 0 && game.totalKills % stats.vampiricInterval === 0) {
        game.health = Math.min(game.maxHealth, game.health + 1);
        if (DEBUG) console.log('[vampiric] Healed 1 HP');
        spawnHealthGainPopup(destroyData.position);  // Spawn +💖 popup at enemy position
        playHealSound();  // Play healing sound
      }

      // Soul Chain (Issue #211): ricochet kills also count toward the
      // vampiric heal threshold — every N ricochet kills heals 1 HP
      if (stats.isRicochetHit && stats.vampiricInterval > 0 && controllerIndex !== undefined) {
        const soulHand = getHandForController(controllerIndex);
        const soulChainActive = game.synergies?.[soulHand]?.some(s => s.id === 'soul_chain');
        if (soulChainActive) {
          game.ricochetKillCount++;
          if (game.ricochetKillCount % stats.vampiricInterval === 0) {
            game.health = Math.min(game.maxHealth, game.health + 1);
            spawnHealthGainPopup(destroyData.position);
            playHealSound();
          }
        }
      }
    }
  }
}

// [CORE] Handle projectile hit on boss
function handleBossHit(boss, stats, hitPoint, controllerIndex, handIndex, hitObject) {
  let damage = stats.damage;
  let isCrit = false;
  if (stats.critChance > 0 && Math.random() < stats.critChance) {
    damage *= (stats.critMultiplier || 2);
    isCrit = true;
    trackCrit();
    // Issue #172: eclipsed crit upgrades reflect — the shot loses its crit
    // and the player takes 1 damage instead (15% of crits)
    if (stats.critReflect && Math.random() < 0.15) {
      isCrit = false;
      damage /= (stats.critMultiplier || 2);
      const dead = applyPlayerDamage(1);
      screenFx.cameraShake = Math.max(screenFx.cameraShake || 0, 0.25);
      screenFx.cameraShakeIntensity = 0.03;
      triggerScreenShake(0.1, 300);
      if (dead) {
        endGame(false);
        return;
      }
    }
  }

  // Extract facet/shard/weak point info from hit object for PrismBoss
  const bossHitInfo = { handIndex };
  // Issue #172: pass the shot's status effects so the Eclipse Engine can
  // react (SHOCK hits extend the corruption interval — the counterplay)
  if (stats.effects && stats.effects.length) bossHitInfo.effects = stats.effects;
  if (hitObject && hitObject.userData) {
    if (hitObject.userData.facetIndex !== undefined) bossHitInfo.facetIndex = hitObject.userData.facetIndex;
    if (hitObject.userData.isWeakPoint) bossHitInfo.isWeakPoint = true;
    if (hitObject.userData.isHealWeakPoint) bossHitInfo.isHealWeakPoint = true;
    if (hitObject.userData.healWeakPointIndex !== undefined) bossHitInfo.healWeakPointIndex = hitObject.userData.healWeakPointIndex;
    if (hitObject.userData.isPrismCore) bossHitInfo.isPrismCore = true;
    if (hitObject.userData.shardIndex !== undefined) bossHitInfo.shardIndex = hitObject.userData.shardIndex;
    if (hitObject.userData.eclipseNodeId !== undefined) bossHitInfo.eclipseNodeId = hitObject.userData.eclipseNodeId;
    if (hitObject.userData.eclipseNodeType) bossHitInfo.eclipseNodeType = hitObject.userData.eclipseNodeType;
    if (hitObject.userData.isEclipseHeart) bossHitInfo.isEclipseHeart = true;
  }
  // Walk up to find facet info on parent groups
  let walk = hitObject;
  while (walk && (
    bossHitInfo.facetIndex === undefined
    || bossHitInfo.eclipseNodeId === undefined
    || bossHitInfo.eclipseNodeType === undefined
  )) {
    if (walk.userData && walk.userData.facetIndex !== undefined && bossHitInfo.facetIndex === undefined) {
      bossHitInfo.facetIndex = walk.userData.facetIndex;
    }
    if (walk.userData && walk.userData.shardIndex !== undefined && bossHitInfo.shardIndex === undefined) {
      bossHitInfo.shardIndex = walk.userData.shardIndex;
    }
    if (walk.userData && walk.userData.eclipseNodeId !== undefined && bossHitInfo.eclipseNodeId === undefined) {
      bossHitInfo.eclipseNodeId = walk.userData.eclipseNodeId;
    }
    if (walk.userData && walk.userData.eclipseNodeType && bossHitInfo.eclipseNodeType === undefined) {
      bossHitInfo.eclipseNodeType = walk.userData.eclipseNodeType;
    }
    if (walk.userData && walk.userData.isEclipseHeart) {
      bossHitInfo.isEclipseHeart = true;
    }
    if (
      bossHitInfo.facetIndex !== undefined
      && bossHitInfo.shardIndex !== undefined
      && bossHitInfo.eclipseNodeId !== undefined
      && bossHitInfo.eclipseNodeType !== undefined
    ) {
      break;
    }
    walk = walk.parent;
  }

  const result = hitBoss(damage, bossHitInfo);

  // Shield reflection: damage player instead of boss
  if (result.shieldReflected) {
    spawnDamageNumber(hitPoint, 0, '#ff00ff');  // Show 0 damage in magenta
    playHitSound();
    const dead = applyPlayerDamage(1);
    setKilledBy({ type: 'boss', name: boss.def?.name || 'Boss', enemyType: boss.def?.behavior || '' });
    triggerHitFlash(true);
    playDamageSound();
    screenFx.cameraShake = 0.3;
    screenFx.cameraShakeIntensity = 0.03;
    screenFx.originalCameraPos.copy(camera.position);

    // Light screen shake on player damage
    triggerScreenShake(0.15, 500); // 0.15 shake for 500ms

    screenFx.floorFlashing = true;
    screenFx.floorFlashTimer = 1.0;
    if (DEBUG) console.log('[boss] Shield reflected damage!');
    if (dead) endGame(false);
    return;
  }
  // Immune hit (e.g., skull boss head before hands destroyed)
  if (result.immune) {
    spawnDamageNumber(hitPoint, 0, '#aaaaaa');  // Show 0 damage in gray
    playTingSound();  // Metallic ping sound
    if (DEBUG) console.log('[boss] Hit was immune!');
    return;
  }

  // Healed hit (wrong facet on PrismBoss - boss heals instead of taking damage)
  if (result.healed) {
    const healAmt = result.healAmount || damage;
    spawnDamageNumber(hitPoint, healAmt, '#00ff44');  // Green number showing heal amount
    playHealSound();  // Distinctive heal sound
    if (DEBUG) console.log(`[boss] Wrong facet hit! Boss healed for ${healAmt}`);
    return;
  }

  if (controllerIndex !== undefined) {
    const hand = getHandForController(controllerIndex);
    game.handStats[hand].totalDamage += damage;
  }
  spawnDamageNumber(hitPoint, damage, '#ff4444');
  playHitSound();
  if (result.killed) {
    playExplosionSound();
    game.kills++;
    trackKill(true);
    game.killsWithoutHit++;
    addScore(boss.scoreValue);

    // Update HUD immediately to show correct kill count before level complete
    updateHUD(game);

    // Check for kills remaining alert (for non-boss levels that might call this)
    checkKillsAlert();

    startBossDeathCinematic(boss);
  }
}

// [CORE] Handle area-of-effect damage
function handleAOE(center, radius, damage, controllerIndex) {
  const enemies = getEnemies();
  enemies.forEach((e, i) => {
    const dist = e.mesh.position.distanceTo(center);
    if (dist < radius) {
      const aoeDamage = damage * (1 - dist / radius);
      hitEnemy(i, aoeDamage);
      spawnDamageNumber(e.mesh.position, aoeDamage, '#ff8800');

      // Track AOE damage
      if (controllerIndex !== undefined) {
        const hand = getHandForController(controllerIndex);
        game.handStats[hand].totalDamage += aoeDamage;
      }
    }
  });
}

/** Spawn a short-lived visible explosion (expanding sphere) at center. */
// [CORE] Spawn explosion visual at position
function spawnExplosionVisual(center, radius) {
  // PERFORMANCE: Use pooled explosion meshes instead of allocating new geometry each call
  let entry = null;
  for (let i = 0; i < EXPLOSION_POOL_SIZE; i++) {
    if (!explosionPool[i].active) { entry = explosionPool[i]; break; }
  }
  // Fix: pool exhaustion used to still play sound + shake for a visual that
  // never appears (common during multi-kill explosions). Bail out first.
  if (!entry) return; // All busy, skip (avoids accumulation)

  // Play explosion sound
  playExplosionSound();

  // Bigger shake for explosions
  triggerScreenShake(0.3, 300); // 0.3 shake for 300ms

  const duration = 350; // ms
  entry.active = true;
  entry.createdAt = performance.now();
  entry.duration = duration;
  entry.radius = radius;
  entry.mesh.visible = true;
  entry.mesh.position.copy(center);
  // Safety: skip explosion if center is near world origin (likely a bug)
  if (entry.mesh.position.lengthSq() < 0.01) {
    entry.active = false;
    entry.mesh.visible = false;
    return;
  }
  entry.mesh.scale.setScalar(radius * 0.3);
  // Reset material opacity for pooled mesh
  entry.mesh.material.opacity = 0.7;
}

// [CORE] Update explosion visual animations
function updateExplosionVisuals(dt, now) {
  updateChargeBeamVisuals(now);

  // Update pooled explosion visuals
  for (let i = 0; i < EXPLOSION_POOL_SIZE; i++) {
    const entry = explosionPool[i];
    if (!entry.active) continue;
    const age = now - entry.createdAt;
    if (age > entry.duration) {
      entry.active = false;
      entry.mesh.visible = false;
    } else {
      const t = age / entry.duration;
      const scale = 1 + t * 2.5;
      entry.mesh.scale.setScalar(entry.radius * 0.3 * scale);
      entry.mesh.material.opacity = 0.7 * (1 - t);
    }
  }

  // Update rare non-pooled visuals (toxic pools, boss shields, transient bolts)
  for (let i = explosionVisuals.length - 1; i >= 0; i--) {
    const m = explosionVisuals[i];
    const age = now - m.userData.createdAt;
    if (age > m.userData.duration) {
      disposeMesh(m);
      explosionVisuals.splice(i, 1);
    } else {
      const t = age / m.userData.duration;
      if (m.userData.isChargeBeamCore || m.userData.isChargeBeam) {
        // Horizon-fade animation: appears full, then fades toward distance
        // Pulse effect: beam feels like it's "shooting through" the scene
        // Both core (NormalBlending) and glow (AdditiveBlending) share the same animation
        
        // Phase 1: Full opacity pulse (0-30% of duration)
        // Phase 2: Horizon fade (30-100% of duration)
        const pulsePhase = t < 0.3 ? t / 0.3 : 1.0;
        const fadePhase = t < 0.3 ? 0 : (t - 0.3) / 0.7;
        
        // Opacity: starts at max, pulses slightly, then fades
        const pulseIntensity = Math.sin(pulsePhase * Math.PI) * 0.2;
        const baseOpacity = m.userData.maxOpacity || 0.8;
        const fadeOpacity = 1 - Math.pow(fadePhase, 2); // Quadratic fade for smoother effect
        
        m.material.opacity = baseOpacity * (1 + pulseIntensity) * fadeOpacity;
        
        // Scale the beam down slightly over time (shooting into space effect)
        const scaleDown = 1 - fadePhase * 0.3;
        m.scale.set(scaleDown, 1, scaleDown);
      } else if (m.userData.isToxicPool) {
        // Toxic pool - check for player damage over time
        m.material.opacity = 0.6 * (1 - t * 0.5);
        
        // Deal damage every 0.5 seconds
        if (now - m.userData.lastDamageTime > 500) {
          const playerPos = camera.position;
          const dist = new THREE.Vector2(
            playerPos.x - m.position.x,
            playerPos.z - m.position.z
          ).length();
          
          if (dist < m.userData.radius && typeof damagePlayer === 'function') {
            const _dead = applyPlayerDamage(m.userData.damage);
            triggerHitFlash(true);
            playDamageSound();
            if (_dead && game.state === State.PLAYING) {
              const _boss = getBoss();
              setKilledBy({ type: 'environment', name: _boss?.def?.name || 'Toxic Pool', enemyType: 'toxic_pool' });
              endGame(false);
            }
          }
          m.userData.lastDamageTime = now;
        }
      } else if (m.userData.isBossShield) {
        // Boss shield - pulsing effect
        m.material.opacity = 0.3 + Math.sin(now * 0.01) * 0.1;
      } else {
        const scale = 1 + t * 2.5;
        m.scale.setScalar(scale);
        m.material.opacity = 0.7 * (1 - t);
      }
    }
  }
}

// ============================================================
//  BOSS ATTACK HELPER FUNCTIONS
// ============================================================

// ── Shared geometry/material pool for boss helpers ───────
const _bossHelperPool = {
  debrisGeo: null,
  debrisMat: null,
  decoyGeo: null,
  decoyMat: null,
  pulseGeo: null,
  pulseMat: null,
  lightningGeo: null,
  lightningMat: null,
};

// Per-hand synergy check (game.synergies snapshot recomputed on upgrade picks)
function handHasSynergy(controllerIndex, synergyId) {
  if (controllerIndex === undefined) return false;
  const hand = getHandForController(controllerIndex);
  return !!(game.synergies?.[hand]?.some(s => s.id === synergyId));
}

// ── Swarm Leader drones (Issue #211) ────────────────────────
// Lost seekers convert into small protective drones that orbit the player
// and destroy enemy projectiles on contact. Shared geo/mat (spawned rarely,
// capped); cleaned up on pool reset.
const _swarmDrones = []; // { mesh, orbitPhase, createdAt }
const SWARM_DRONE_CAP = 6;
const SWARM_DRONE_DURATION = 6000;
const SWARM_DRONE_ORBIT_RADIUS = 1.4;
const SWARM_DRONE_BLOCK_RADIUS_SQ = 0.35; // ~0.59m kill radius
let _swarmDroneGeo = null;
let _swarmDroneMat = null;

function spawnSwarmDrone(position) {
  if (_swarmDrones.length >= SWARM_DRONE_CAP) return;
  if (!_swarmDroneGeo) _swarmDroneGeo = new THREE.OctahedronGeometry(0.12, 0);
  if (!_swarmDroneMat) {
    _swarmDroneMat = new THREE.MeshBasicMaterial({ color: 0x83ff2b, transparent: true, opacity: 0.9 });
  }
  const mesh = new THREE.Mesh(_swarmDroneGeo, _swarmDroneMat);
  mesh.position.copy(position);
  mesh.userData.createdAt = performance.now();
  scene.add(mesh);
  _swarmDrones.push(mesh);
}

function updateSwarmDrones(dt, now) {
  for (let i = _swarmDrones.length - 1; i >= 0; i--) {
    const drone = _swarmDrones[i];
    // Expire: remove mesh (shared geo/mat stays for the next drone)
    if (now - drone.userData.createdAt > SWARM_DRONE_DURATION) {
      scene.remove(drone);
      _swarmDrones.splice(i, 1);
      continue;
    }
    // Orbit the player (camera XZ) with a gentle bob
    const orbitAngle = (now * 0.002) + i * (Math.PI * 2 / SWARM_DRONE_CAP);
    drone.position.set(
      camera.position.x + Math.cos(orbitAngle) * SWARM_DRONE_ORBIT_RADIUS,
      camera.position.y - 0.5 + Math.sin(now * 0.003 + i) * 0.15,
      camera.position.z + Math.sin(orbitAngle) * SWARM_DRONE_ORBIT_RADIUS,
    );
    // Block enemy projectiles on contact (same destruction path as the beam)
    const bossProjs = getBossProjectiles();
    for (let j = bossProjs.length - 1; j >= 0; j--) {
      const bossProj = bossProjs[j];
      if (!bossProj) continue;
      if (drone.position.distanceToSquared(bossProj.position) < SWARM_DRONE_BLOCK_RADIUS_SQ) {
        spawnBossProjectileDestructionFX(bossProj.position.clone());
        if (bossProj._instIdx !== undefined) releaseBossProjIndex(bossProj._instIdx);
        bossProjs.splice(j, 1);
      }
    }
  }
}

export function clearSwarmDrones() {
  for (const drone of _swarmDrones) {
    scene.remove(drone);
  }
  _swarmDrones.length = 0;
}

/** Test seam: how many protective drones are currently orbiting. */
export function getSwarmDroneCount() {
  return _swarmDrones.length;
}

/**
 * Bounce a ricochet shot to the nearest enemy. When `excludeEnemies` is
 * provided (Pinball Wizard synergy), already-hit enemies are skipped so
 * pierced shots ricochet onto NEW targets instead of re-hitting the enemy
 * they just passed through.
 */
export function handleRicochet(fromPoint, stats, bounceCount, controllerIndex, excludeEnemies = null) {
  if (bounceCount >= stats.ricochetBounces) return;

  const enemies = getEnemies();
  let closest = null;
  let closestDist = 8;
  let fallback = null;
  let fallbackDist = 8;

  enemies.forEach((e, i) => {
    if (!e?.mesh) return;
    const dist = e.mesh.position.distanceTo(fromPoint);
    if (dist < closestDist) {
      // Pinball Wizard: skip enemies this projectile already hit; keep the
      // closest as a fallback when no new target exists (pre-synergy behavior)
      if (excludeEnemies && excludeEnemies.has(i)) {
        fallback = { index: i, enemy: e };
        fallbackDist = dist;
        return;
      }
      closestDist = dist;
      closest = { index: i, enemy: e };
    }
  });
  const target = closest || fallback;
  if (excludeEnemies && !closest) return; // only already-hit enemies nearby — no bounce

  if (target) {
    // isRicochetHit feeds Issue #189 style creativity scoring
    handleHit(target.index, target.enemy, { ...stats, damage: stats.damage * 0.5, isRicochetHit: true }, target.enemy.mesh.position, controllerIndex);
    handleRicochet(target.enemy.mesh.position, stats, bounceCount + 1, controllerIndex, excludeEnemies);
  }
}

// [CORE] Mark projectile as having scored a hit
function markProjectileHit(proj) {
  if (!proj?.userData?.shotId) return;
  proj.userData.hitConfirmed = true;
  markAccuracyHit(proj.userData.shotId);
}

// [CORE] Resolve projectile accuracy tracking
function resolveProjectileAccuracy(proj) {
  if (!proj?.userData?.shotId) return;
  resolveAccuracyPellet(proj.userData.shotId);
}

// Pooled temp vectors for projectile hot paths (per-frame allocations)
const _projHomingDesired = new THREE.Vector3();
const _projHomingQuatDir = new THREE.Vector3(0, 0, -1);
const _projHomingVelNorm = new THREE.Vector3();
const _hostileProjDesired = new THREE.Vector3();
const _hostileProjCurrent = new THREE.Vector3();
const _hostileProjSide = new THREE.Vector3();
// Scratch vectors for Twin Helix parametric motion (Issue #143)
const _helixPos = new THREE.Vector3();
const _projectileRayDir = new THREE.Vector3();
const _projectileNearbyMeshes = [];
const _projectileSegmentStart = new THREE.Vector3();
const _projectileSegmentEnd = new THREE.Vector3();
const _projectileClosestPoint = new THREE.Vector3();
const _projectileBestHitPoint = new THREE.Vector3();
// Issue #198 Void Anchor gravity bending (filled once per frame)
const _voidAnchors = [];
const _voidAnchorDir = new THREE.Vector3();

function enemyNeedsPreciseProjectileHit(enemy) {
  return !!enemy && (enemy.type === 'tank' || enemy.isTrain);
}

// ============================================================
// PROJECTILE UPDATE LOOP
// Movement, homing, hostile projectiles, collision detection
// HOT PATH: Called every frame from render()
// COUPLING: projectiles[], instancedProjectiles, enemies spatial hash
// RISK: Changes here affect hit detection, game feel, performance
// ============================================================
// [CORE] Update all projectiles (movement, collision, lifetime)
function updateProjectiles(dt) {
  const now = performance.now();

  // Issue #198: refresh the planted-anchor list once per frame (max 2 alive)
  _voidAnchors.length = 0;
  collectVoidAnchors().forEach(a => _voidAnchors.push(a));

  // Perf: rebuild hostile caches once per frame (see declaration notes).
  // Hostile entries in projectiles[]/explosionVisuals[] are rare (boss
  // lightning, decoys, toxic pools, shields), so iterating caches instead of
  // full arrays turns the per-projectile collision scans from O(n²) to O(n·h).
  _hostileProjectilesInArray.length = 0;
  for (let hi = 0; hi < projectiles.length; hi++) {
    const p = projectiles[hi];
    if (p && isHostileProjectile(p)) _hostileProjectilesInArray.push(p);
  }
  _hostileVisualsInExplosion.length = 0;
  for (let vi = 0; vi < explosionVisuals.length; vi++) {
    const v = explosionVisuals[vi];
    if (v && v.userData.isBossProjectile) _hostileVisualsInExplosion.push(v);
  }

  for (let i = projectiles.length - 1; i >= 0; i--) {
    const proj = projectiles[i];

    // Skip undefined projectiles (safety check)
    if (!proj) {
      projectiles.splice(i, 1);
      continue;
    }

    // Skip projectiles with missing data (safety check)
    if (!proj.userData || !proj.userData.stats) {
      // Check if this is a hostile projectile (moving)
      if (proj.userData && proj.userData.damage && proj.userData.direction) {
        const age = now - proj.userData.createdAt;
        if (age > proj.userData.duration) {
          triggerHostileProjectileExplosion(proj.position, 0.3, 0);
          disposeObject3D(proj);
          _dropHostileFromCache(proj);  // Perf: keep hostile cache in sync
          projectiles.splice(i, 1);
          continue;
        }

        const slowFactor = getStasisSlowFactor(proj.position);
        const adjustedDt = dt * slowFactor;
        const playerPos = camera.position;

        // Mini-swarm style steering and visual pop so hostile shots feel alive.
        _hostileProjDesired.subVectors(playerPos, proj.position).normalize();
        _hostileProjCurrent.copy(proj.userData.direction).normalize();
        _hostileProjCurrent.lerp(_hostileProjDesired, Math.min(1, adjustedDt * 2.8));
        proj.userData.direction.copy(_hostileProjCurrent.normalize());

        const wigglePhase = (proj.userData.wigglePhase || Math.random() * Math.PI * 2) + adjustedDt * 8;
        proj.userData.wigglePhase = wigglePhase;
        _hostileProjSide.set(-proj.userData.direction.z, 0, proj.userData.direction.x).normalize();
        proj.position.addScaledVector(_hostileProjSide, Math.sin(wigglePhase) * 0.015);
        proj.position.addScaledVector(proj.userData.direction, proj.userData.speed * adjustedDt);
        updateHostileProjectileVisual(proj, now);

        const dist = proj.position.distanceTo(playerPos);

        // Warning beep when an enemy projectile is getting dangerously close.
        if (dist < 4.0 && !proj.userData.warned) {
          playProjectileWarningSound();
          proj.userData.warned = true;
        }

        if (dist < 1.0) {
          if (typeof damagePlayer === 'function') {
            const _dead = applyPlayerDamage(proj.userData.damage);
            triggerHitFlash(true);
            playDamageSound();
            if (_dead && game.state === State.PLAYING) {
              if (proj.userData.isBossProjectile) {
                const bossName = proj.userData.bossName || getBoss()?.def?.name || 'Boss';
                const bossBehavior = proj.userData.bossBehavior || getBoss()?.def?.behavior || '';
                setKilledBy({ type: 'boss', name: bossName, enemyType: bossBehavior });
              } else if (proj.userData.isMortarProjectile) {
                setKilledBy({ type: 'enemy', name: 'Mortar', enemyType: 'mortar' });
              } else {
                setKilledBy({ type: 'enemy', name: 'Enemy Projectile', enemyType: 'projectile' });
              }
              endGame(false);
            }
          }
          triggerHostileProjectileExplosion(proj.position, 0.4, 0);
          disposeObject3D(proj);
          _dropHostileFromCache(proj);  // Perf: keep hostile cache in sync
          projectiles.splice(i, 1);
          continue;
        }

        continue;
      }

      // Check if this is a stationary boss projectile (decoy, shield, etc.) with duration
      if (proj.userData && proj.userData.isBossProjectile && proj.userData.duration && proj.userData.createdAt) {
        const age = now - proj.userData.createdAt;
        if (age > proj.userData.duration) {
          // Explode if it's a decoy
          if (proj.userData.isDecoy && typeof window !== 'undefined' && window.createExplosionAt) {
            window.createExplosionAt(proj.position.clone(), proj.userData.explosionRadius, proj.userData.explosionDamage);
          }
          disposeObject3D(proj);
          _dropHostileFromCache(proj);  // Perf: keep hostile cache in sync
          projectiles.splice(i, 1);
          continue;
        }
      }
      
      resolveProjectileAccuracy(proj);
      if (proj.userData?.isPooled) {
        returnProjectileToPool(proj);
      } else {
        disposeObject3D(proj);
      }
      _dropHostileFromCache(proj);  // Perf: keep hostile cache in sync
      projectiles.splice(i, 1);
      continue;
    }
    
    const age = now - proj.userData.createdAt;

    // Remove expired projectiles - return to pool
    if (age > proj.userData.lifetime) {
      // Issue #211 Swarm Leader: seekers that expired WITHOUT ever locking a
      // target become orbiting protective drones (they block enemy projectiles)
      if (proj.userData.homingRange > 0 && !proj.userData.homingTarget &&
          handHasSynergy(proj.userData.controllerIndex, 'swarm_leader')) {
        spawnSwarmDrone(proj.position);
      }
      resolveProjectileAccuracy(proj);
      if (proj.userData.isPooled) {
        returnProjectileToPool(proj);
      } else {
        disposeObject3D(proj);
      }
      projectiles.splice(i, 1);
      continue;
    }

    // Check if projectile is inside a stasis field
    const slowFactor = getStasisSlowFactor(proj.position);
    const adjustedDt = dt * slowFactor;

    // Homing behavior (Seeker Burst)
    if (proj.userData.homingRange && proj.userData.homingRange > 0) {
      let targetMesh = proj.userData.homingTarget;
      const targetStillValid = targetMesh
        && targetMesh.parent
        && targetMesh.position.distanceToSquared(proj.position) <= proj.userData.homingRange * proj.userData.homingRange;
      if (!targetStillValid && now >= (proj.userData.nextHomingTargetRefreshAt || 0)) {
        targetMesh = findSeekerTarget(proj);
        proj.userData.homingTarget = targetMesh || null;
        proj.userData.nextHomingTargetRefreshAt = now + SEEKER_RETARGET_INTERVAL_MS;
      }

      const baseSpeed = proj.userData.baseSpeed || proj.userData.velocity.length();
      if (targetMesh) {
        _projHomingDesired.subVectors(targetMesh.position, proj.position).normalize().multiplyScalar(baseSpeed);
        // Use high homing strength so seekers directly target enemies
        // instead of circling them at low turn rates
        const homingStrength = proj.userData.homingStrength || 15;
        proj.userData.velocity.lerp(_projHomingDesired, Math.min(1, homingStrength * adjustedDt));
        if (proj.userData.velocity.lengthSq() > 0.0001) {
          proj.userData.velocity.setLength(baseSpeed);
        }
      } else if (proj.userData.velocity.lengthSq() > 0.0001) {
        proj.userData.velocity.setLength(baseSpeed);
      }

      if (proj.userData.velocity.lengthSq() > 0.0001) {
        _projHomingQuatDir.set(0, 0, -1);
        _projHomingVelNorm.copy(proj.userData.velocity).normalize();
        const _seekDot = _projHomingQuatDir.dot(_projHomingVelNorm);
        if (_seekDot > 0.9999) {
          proj.quaternion.identity();
        } else if (_seekDot < -0.9999) {
          // Perf: reuse module scratch axis instead of allocating a Vector3 per frame
          proj.quaternion.setFromAxisAngle(_upAxisUnit, Math.PI);
        } else {
          proj.quaternion.setFromUnitVectors(_projHomingQuatDir, _projHomingVelNorm);
        }
      }
      updateSeekerProjectileVisual(proj, adjustedDt);
    }

    // Move projectile (apply stasis slow effect)
    // Issue #198 Void Anchor: bend velocity toward planted wells BEFORE the
    // movement step (seekers resist — their homing overrides the field)
    if (_voidAnchors.length > 0) {
      if (!proj.userData.homingRange || proj.userData.homingRange <= 0) {
        for (let ai = 0; ai < _voidAnchors.length; ai++) {
          const a = _voidAnchors[ai];
          const radius = a.anchorGravityRadius;
          _voidAnchorDir.subVectors(a.mesh.position, proj.position);
          const vDist = _voidAnchorDir.length();
          if (vDist >= radius || vDist < 0.001) continue;
          const bend = a.gravityBendRate * (1 - vDist / radius) * adjustedDt;
          const vSpeed = proj.userData.velocity.length();
          if (vSpeed <= 0.001) continue;
          _voidAnchorDir.divideScalar(vDist).multiplyScalar(vSpeed);
          proj.userData.velocity.lerp(_voidAnchorDir, Math.min(1, bend));
        }
      }
    }
    const moveDistance = proj.userData.velocity.length() * adjustedDt;
    if (proj.userData.isHelix) {
      // Issue #143: Twin Helix — parametric double-helix motion around the
      // forward axis (replaces linear travel; hit detection is position-based
      // so it works unchanged). Pre-allocated scratch vectors for perf.
      proj.userData.helixTime = (proj.userData.helixTime || 0) + adjustedDt;
      const ht = proj.userData.helixTime;
      const angle = ht * (proj.userData.helixSpeed || 8) + (proj.userData.helixPhase || 0);
      const travel = (proj.userData.velocity.length() || 0) * ht;
      _helixPos
        .copy(proj.userData.helixOrigin)
        .addScaledVector(proj.userData.helixForward, travel)
        .addScaledVector(proj.userData.helixRight, Math.cos(angle) * (proj.userData.helixRadius || 0.3) * 0.3)
        .addScaledVector(proj.userData.helixUp, Math.sin(angle) * (proj.userData.helixRadius || 0.3) * 0.3);
      proj.position.copy(_helixPos);
    } else {
      proj.position.addScaledVector(proj.userData.velocity, adjustedDt);
    }

    // Issue #143: Dragon's Breath — molten pellets drop fire trails on the
    // ground while flying (callback registered by evolutions.js)
    if (proj.userData.isDragonsBreath && evolvedFxHooks.onDragonsBreathTrail) {
      if (now - (proj.userData._lastTrailAt || 0) >= 120) {
        proj.userData._lastTrailAt = now;
        evolvedFxHooks.onDragonsBreathTrail(proj.position);
      }
    }

    // Commit position to InstancedMesh (sync GPU buffer)
    if (proj.commit) {
      proj.commit();
    }

    // Check if projectile passes through nanite swarm and gains nanite damage
    checkProjectileNaniteInteraction(proj);

    // Check collision with plasma orbs (player can shoot orbs to detonate early)
    if (checkPlasmaOrbDetonation(proj)) {
      markProjectileHit(proj);
      resolveProjectileAccuracy(proj);
      if (proj.userData.isPooled) {
        returnProjectileToPool(proj);
      } else {
        disposeObject3D(proj);
      }
      projectiles.splice(i, 1);
      continue;
    }

    // Check collision with reflector drones (overcharge mechanic)
    if (proj.userData.controllerIndex !== undefined && checkPlayerProjectileHitsDrone(proj.position, proj.userData.controllerIndex)) {
      markProjectileHit(proj);
      resolveProjectileAccuracy(proj);
      if (proj.userData.isPooled) {
        returnProjectileToPool(proj);
      } else {
        disposeObject3D(proj);
      }
      projectiles.splice(i, 1);
      continue;
    }

    // Check collision with enemies
    // VR-CRITICAL: Use direct segment-vs-sphere tests for standard enemies/minions,
    // and only recurse through child meshes when weak-point logic actually needs it.
    const projPos = proj.position;
    const broadRadius = moveDistance * 2 + 1.5; // Move distance + max hitbox radius
    const hashRadius = broadRadius + 3;
    _projectileNearbyMeshes.length = 0;

    if (proj.userData.velocity && typeof proj.userData.velocity.lengthSq === 'function') {
      _projectileRayDir.copy(proj.userData.velocity);
    } else {
      _projectileRayDir.set(0, 0, -1);
    }
    if (_projectileRayDir.lengthSq() === 0) {
      _projectileRayDir.set(0, 0, -1);
    } else {
      _projectileRayDir.normalize();
    }

    _projectileSegmentEnd.copy(proj.position);
    _projectileSegmentStart.copy(proj.position).addScaledVector(_projectileRayDir, -moveDistance);

    let directEnemyHit = null;
    let directEnemyHitDistanceSq = Infinity;
    let directMinionHit = null;
    let directMinionHitDistanceSq = Infinity;

    _hashScratchProjectiles.length = 0;
    enemySpatialHash.queryInto(_hashScratchProjectiles, projPos.x, projPos.z, hashRadius);
    const hashed = _hashScratchProjectiles;
    for (let ei = 0; ei < hashed.length; ei++) {
      const enemy = hashed[ei];
      if (!enemy || !enemy.mesh) continue;

      const dx = projPos.x - enemy.mesh.position.x;
      const dy = projPos.y - enemy.mesh.position.y;
      const dz = projPos.z - enemy.mesh.position.z;
      const centerDistSq = dx * dx + dy * dy + dz * dz;
      const hitRadius = (enemy.hitboxRadius || 1) + broadRadius;
      if (centerDistSq >= hitRadius * hitRadius) continue;

      if (enemyNeedsPreciseProjectileHit(enemy)) {
        _projectileNearbyMeshes.push(enemy.mesh);
        continue;
      }

      const directHitRadius = (enemy.hitboxRadius || 1) + 0.12;
      const hitDistSq = pointToSegmentDistSq(enemy.mesh.position, _projectileSegmentStart, _projectileSegmentEnd, _projectileClosestPoint);
      if (hitDistSq <= directHitRadius * directHitRadius) {
        const liveEnemy = getEnemyByMesh(enemy.mesh);
        const enemyIndex = liveEnemy?.index;
        if (enemyIndex === undefined || proj.userData.hitEnemies.has(enemyIndex)) continue;
        const pathDistSq = _projectileSegmentStart.distanceToSquared(_projectileClosestPoint);
        if (pathDistSq < directEnemyHitDistanceSq) {
          directEnemyHitDistanceSq = pathDistSq;
          _projectileBestHitPoint.copy(_projectileClosestPoint);
          directEnemyHit = { index: enemyIndex, enemy: liveEnemy.enemy, point: _projectileBestHitPoint.clone() };
        }
      }
    }

    // Bosses still use precise mesh hits so custom weak-point logic stays intact.
    const boss = getBoss();
    if (boss && boss.mesh) {
      const dx = projPos.x - boss.mesh.position.x;
      const dy = projPos.y - boss.mesh.position.y;
      const dz = projPos.z - boss.mesh.position.z;
      const distSq = dx * dx + dy * dy + dz * dz;
      const bossRadius = boss.hands && boss.hands.length > 0 ? 8.0 : (boss.def?.behavior === 'eclipse' ? 8.0 : 3.0);
      if (distSq < (broadRadius + bossRadius) * (broadRadius + bossRadius)) {
        _projectileNearbyMeshes.push(boss.mesh);
      }
    }

    // Boss minions do not need child-mesh precision, so we can hit them with a cheap sphere test.
    const bossMinions = getBossMinions();
    if (bossMinions.length > 0) {
      for (let mi = 0; mi < bossMinions.length; mi++) {
        const minion = bossMinions[mi];
        const minionMesh = minion?.mesh;
        if (!minionMesh) continue;

        const dx = projPos.x - minionMesh.position.x;
        const dy = projPos.y - minionMesh.position.y;
        const dz = projPos.z - minionMesh.position.z;
        const centerDistSq = dx * dx + dy * dy + dz * dz;
        const minionRadius = (minionMesh.userData.hitRadius || 0.8) + broadRadius;
        if (centerDistSq >= minionRadius * minionRadius) continue;

        const hitRadiusSq = (minionMesh.userData.hitRadius || 0.8) * (minionMesh.userData.hitRadius || 0.8);
        const hitDistSq = pointToSegmentDistSq(minionMesh.position, _projectileSegmentStart, _projectileSegmentEnd, _projectileClosestPoint);
        if (hitDistSq <= hitRadiusSq) {
          const pathDistSq = _projectileSegmentStart.distanceToSquared(_projectileClosestPoint);
          if (pathDistSq < directMinionHitDistanceSq) {
            directMinionHitDistanceSq = pathDistSq;
            directMinionHit = { index: mi, minion, point: _projectileClosestPoint.clone() };
          }
        }
      }
    }

    let preciseHit = null;
    if (_projectileNearbyMeshes.length > 0 && uiRaycaster) {
      uiRaycaster.set(_projectileSegmentStart, _projectileRayDir);
      uiRaycaster.near = 0;
      uiRaycaster.far = Math.max(moveDistance, 0.5) + 1.5;
      const hits = uiRaycaster.intersectObjects(_projectileNearbyMeshes, true);
      if (hits.length > 0) {
        preciseHit = hits[0];
      }
    }

    const preciseHitDistanceSq = preciseHit ? preciseHit.distance * preciseHit.distance : Infinity;
    const shouldUsePreciseHit = preciseHit
      && preciseHit.distance <= Math.max(moveDistance, 0.5) + 1.5
      && preciseHitDistanceSq <= directEnemyHitDistanceSq
      && preciseHitDistanceSq <= directMinionHitDistanceSq;

    if (shouldUsePreciseHit) {
      const result = getEnemyByMesh(preciseHit.object);
      if (result && result.boss) {
        markProjectileHit(proj);
        handleBossHit(result.boss, proj.userData.stats, preciseHit.point, proj.userData.controllerIndex, result.handIndex, preciseHit.object);
        if (!proj.userData.stats?.piercing) {
          resolveProjectileAccuracy(proj);
          if (proj.userData.isPooled) {
            returnProjectileToPool(proj);
          } else {
            disposeObject3D(proj);
          }
          projectiles.splice(i, 1);
        }
      } else if (result && result.index !== undefined && !proj.userData.hitEnemies.has(result.index)) {
        proj.userData.hitEnemies.add(result.index);
        const hitObj = preciseHit.object;
        const hitWeakPoint = hitObj.userData && hitObj.userData.weakPoint === true;
        const hitInfo = {
          trainIndex: hitObj.userData?.trainIndex,
          isScout: hitObj.userData?.isScout,
          hitObject: hitObj,
        };

        const naniteDamage = proj.userData.naniteInfused ? 5 : 0;
        if (naniteDamage > 0) {
          const enemy = result.enemy;
          if (!enemy._naniteRevealed) {
            enemy._naniteRevealed = true;
            if (enemy.mesh.material) {
              // Perf: module scratch Color (was new THREE.Color per hit)
              setMaterialEmissiveSafe(enemy.mesh.material, _goldColor, 0.5);
            }
          }
        }

        markProjectileHit(proj);
        // Perf: Object.assign into scratch stats instead of { ...stats } spread per hit
        Object.assign(_hitStatsScratch, proj.userData.stats);
        _hitStatsScratch.damage = proj.userData.stats.damage + naniteDamage;
        handleHit(result.index, result.enemy, _hitStatsScratch, preciseHit.point, proj.userData.controllerIndex, proj.userData.isExploding, hitWeakPoint, hitInfo);

        if (proj.userData.stats?.ricochetBounces > 0) {
          // Issue #211 Pinball Wizard: pierced shots ricochet onto NEW targets
          handleRicochet(preciseHit.point, proj.userData.stats, 0, proj.userData.controllerIndex,
            handHasSynergy(proj.userData.controllerIndex, 'pinball_wizard') ? proj.userData.hitEnemies : null);
        }

        if (!proj.userData.stats?.piercing) {
          resolveProjectileAccuracy(proj);
          if (proj.userData.isPooled) {
            returnProjectileToPool(proj);
          } else {
            disposeObject3D(proj);
          }
          projectiles.splice(i, 1);
        }
      }
    } else if (directEnemyHit) {
      proj.userData.hitEnemies.add(directEnemyHit.index);
      const naniteDamage = proj.userData.naniteInfused ? 5 : 0;

      if (naniteDamage > 0 && !directEnemyHit.enemy._naniteRevealed) {
        directEnemyHit.enemy._naniteRevealed = true;
        if (directEnemyHit.enemy.mesh.material) {
          // Perf: module scratch Color (was new THREE.Color per hit)
          setMaterialEmissiveSafe(directEnemyHit.enemy.mesh.material, _goldColor, 0.5);
        }
      }

      markProjectileHit(proj);
      // Perf: Object.assign into scratch stats instead of { ...stats } spread per hit
      Object.assign(_hitStatsScratch, proj.userData.stats);
      _hitStatsScratch.damage = proj.userData.stats.damage + naniteDamage;
      // Issue #213: travel distance for the Point Blank close-range ramp
      _hitStatsScratch.travelDist = proj.userData.spawnPos
        ? proj.position.distanceTo(proj.userData.spawnPos)
        : 0;
      handleHit(
        directEnemyHit.index,
        directEnemyHit.enemy,
        _hitStatsScratch,
        directEnemyHit.point,
        proj.userData.controllerIndex,
        proj.userData.isExploding,
        false,
        { hitObject: directEnemyHit.enemy.mesh }
      );

      if (proj.userData.stats?.ricochetBounces > 0) {
        // Issue #211 Pinball Wizard: pierced shots ricochet onto NEW targets
        handleRicochet(directEnemyHit.point, proj.userData.stats, 0, proj.userData.controllerIndex,
          handHasSynergy(proj.userData.controllerIndex, 'pinball_wizard') ? proj.userData.hitEnemies : null);
      }

      if (!proj.userData.stats?.piercing) {
        resolveProjectileAccuracy(proj);
        if (proj.userData.isPooled) {
          returnProjectileToPool(proj);
        } else {
          disposeObject3D(proj);
        }
        projectiles.splice(i, 1);
      }
    } else if (directMinionHit) {
      markProjectileHit(proj);
      const mResult = hitBossMinion(directMinionHit.index, proj.userData.stats?.damage);
      spawnDamageNumber(directMinionHit.point, proj.userData.stats?.damage, '#ff8800');
      if (mResult.killed) playExplosionSound();
      if (!proj.userData.stats?.piercing) {
        resolveProjectileAccuracy(proj);
        if (proj.userData.isPooled) {
          returnProjectileToPool(proj);
        } else {
          disposeObject3D(proj);
        }
        projectiles.splice(i, 1);
      }
    }

    // Safety: once a collision removed this projectile, skip the remaining collision tiers.
    if (!projectiles[i] || projectiles[i] !== proj) {
      continue;
    }
    
    // Check collision with boss projectiles (player can shoot them down)
    // Boss projectiles should NOT collide with other boss projectiles - only with player
    if (proj.userData.stats && !proj.userData.isBossProjectile) { // Only player projectiles, exclude boss projectiles
      const bossProjs = getBossProjectiles();
      if (bossProjs.length > 0) {
        for (let j = bossProjs.length - 1; j >= 0; j--) {
          const bossProj = bossProjs[j];
          if (!bossProj) continue;
        if (proj.position.distanceToSquared(bossProj.position) < 0.25) {
            spawnBossProjectileDestructionFX(bossProj.position.clone());
            if (bossProj._instIdx !== undefined) releaseBossProjIndex(bossProj._instIdx);
            bossProjs.splice(j, 1);

            if (!proj.userData.stats?.piercing) {
              markProjectileHit(proj);
              resolveProjectileAccuracy(proj);
              if (proj.userData.isPooled) {
                returnProjectileToPool(proj);
              } else {
                disposeObject3D(proj);
              }
              projectiles.splice(i, 1);
            }
            break;
          }
        }
      }

      // Perf: was O(n²) nested loop over ALL earlier projectiles; now iterates
      // the per-frame hostile cache (hostile entries are rare)
      for (let hi = _hostileProjectilesInArray.length - 1; hi >= 0; hi--) {
        const bossProj = _hostileProjectilesInArray[hi];
        if (!bossProj || !bossProj.userData) continue;
        
        if (proj.position.distanceToSquared(bossProj.position) < 0.25) { // 0.5m collision radius
          // Destroy hostile projectile with a small blast
          triggerHostileProjectileExplosion(bossProj.position.clone(), 0.35, 0);
          markProjectileHit(proj);
          
          // If it's a decoy, explode it
          if (bossProj.userData.isDecoy && typeof window !== 'undefined' && window.createExplosionAt) {
            window.createExplosionAt(bossProj.position.clone(), bossProj.userData.explosionRadius, bossProj.userData.explosionDamage);
          }
          
          disposeObject3D(bossProj);
          const hIdx = projectiles.indexOf(bossProj);
          if (hIdx >= 0) projectiles.splice(hIdx, 1);
          _hostileProjectilesInArray.splice(hi, 1);
          
          // Destroy player projectile (unless piercing)
          // Fix: remove by reference — splicing the hostile at a LOWER index
          // shifts this projectile's index, so projectiles.splice(i,1) would
          // remove the wrong element
          if (!proj.userData.stats?.piercing) {
            markProjectileHit(proj);
            resolveProjectileAccuracy(proj);
            if (proj.userData.isPooled) {
              returnProjectileToPool(proj);
            } else {
              disposeObject3D(proj);
            }
            const pi = projectiles.indexOf(proj);
            if (pi >= 0) projectiles.splice(pi, 1);
          }
          
          break; // Only hit one boss projectile
        }
      }
      
      // Also check collision with explosionVisuals (toxic pools, etc.)
      // Perf: was a full scan of ALL explosionVisuals; now uses the hostile cache
      if (proj.userData.stats && projectiles[i]) { // Make sure projectile still exists
        for (let vi = _hostileVisualsInExplosion.length - 1; vi >= 0; vi--) {
          const visual = _hostileVisualsInExplosion[vi];
          if (!visual) continue;
          if (proj.position.distanceToSquared(visual.position) < 1.0) { // 1.0m radius squared
            // Destroy the visual
            spawnExplosionVisual(visual.position.clone(), 0.3);
            disposeObject3D(visual);
            const vIdx = explosionVisuals.indexOf(visual);
            if (vIdx >= 0) explosionVisuals.splice(vIdx, 1);
            _hostileVisualsInExplosion.splice(vi, 1);
            markProjectileHit(proj);
            
            // Destroy player projectile (unless piercing)
            if (!proj.userData.stats?.piercing) {
              resolveProjectileAccuracy(proj);
              if (proj.userData.isPooled) {
                returnProjectileToPool(proj);
              } else {
                disposeObject3D(proj);
              }
              projectiles.splice(i, 1);
            }
            
            break;
          }
        }
      }
    }
  }

  // Issue #211 Swarm Leader: orbit + block pass for protective drones
  updateSwarmDrones(dt, now);
}

// [CORE] Handle VR upgrade card selection

// ============================================================
// SYSTEM LIFECYCLE (moved from main.js init + render loop)
// ============================================================

// Initialize debris glow plane pool (orange glow for boss projectile debris)
function initDebrisGlowPool(scene) {
  if (_debrisGlowPool) return;
  const glowSize = 64;
  const glowCanvas = document.createElement('canvas');
  glowCanvas.width = glowSize;
  glowCanvas.height = glowSize;
  const glowCtx = glowCanvas.getContext('2d');
  const half = glowSize / 2;
  const grad = glowCtx.createRadialGradient(half, half, 0, half, half, half);
  grad.addColorStop(0, 'rgba(255,160,40,1)');
  grad.addColorStop(0.3, 'rgba(255,100,10,0.7)');
  grad.addColorStop(0.6, 'rgba(255,50,0,0.3)');
  grad.addColorStop(1, 'rgba(200,20,0,0)');
  glowCtx.fillStyle = grad;
  glowCtx.fillRect(0, 0, glowSize, glowSize);
  const glowTex = new THREE.CanvasTexture(glowCanvas);
  glowTex.minFilter = THREE.LinearFilter;
  const glowGeo = new THREE.PlaneGeometry(0.4, 0.4);
  const glowMat = new THREE.MeshBasicMaterial({
    map: glowTex,
    color: 0xff6600,
    transparent: true,
    opacity: 0.85,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    depthTest: true,
    side: THREE.DoubleSide,
  });
  _debrisGlowPool = new THREE.InstancedMesh(glowGeo, glowMat, DEBRIS_GLOW_POOL_SIZE);
  _debrisGlowPool.name = 'debris-glow-pool';
  _debrisGlowPool.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  _debrisGlowPool.count = 0;
  _debrisGlowPool.frustumCulled = false;
  _debrisGlowPool.renderOrder = 8;
  _debrisGlowPool.visible = true;
  scene.add(_debrisGlowPool);
  _debrisGlowFree = [];
  for (let i = 0; i < DEBRIS_GLOW_POOL_SIZE; i++) _debrisGlowFree.push(i);
  _debrisGlowActive = [];
  _log('[debris-glow] Glow plane pool initialized (20 instances)');
}

/**
 * Full projectile-system init. Call once from main.js init() after the
 * scene exists (replaces the inline initProjectilePool + initExplosionPool
 * + debris-glow init blocks).
 */
export function initProjectileScene(scene) {
  initProjectilePool();
  initExplosionPool(scene);
  initDebrisGlowPool(scene);
}

/**
 * Per-frame debris glow update (billboard toward camera, follow voxel).
 * Was an inline block in main.js's render loop.
 */
export function updateDebrisGlow(cameraRef) {
  if (_debrisGlowActive.length > 0 && _debrisGlowPool) {
    for (let gi = _debrisGlowActive.length - 1; gi >= 0; gi--) {
      const entry = _debrisGlowActive[gi];
      const voxel = entry.voxel;
      if (!voxel || !voxel.visible) {
        // Voxel returned to pool, release glow instance
        _debrisGlowPool.setMatrixAt(entry.glowIdx, _debrisGlowHideMat);
        _debrisGlowFree.push(entry.glowIdx);
        _debrisGlowActive.splice(gi, 1);
        continue;
      }
      // Billboard toward camera
      if (cameraRef) {
        _debrisGlowBillboardMat.lookAt(voxel.position, cameraRef.position, _debrisGlowUpVec);
        _debrisGlowQuat.setFromRotationMatrix(_debrisGlowBillboardMat);
      }
      // Fade glow with voxel opacity
      const age = performance.now() - voxel.userData.createdAt;
      const fadeStart = voxel.userData.lifetime - 500;
      const glowOpacity = age > fadeStart ? Math.max(0, 1.0 - (age - fadeStart) / 500) : 1.0;
      const s = 0.55 * glowOpacity;
      _debrisGlowScale.set(Math.max(s, 0.01), Math.max(s, 0.01), Math.max(s, 0.01));
      _debrisGlowMatrix.compose(voxel.position, _debrisGlowQuat, _debrisGlowScale);
      _debrisGlowPool.setMatrixAt(entry.glowIdx, _debrisGlowMatrix);
    }
    _debrisGlowPool.instanceMatrix.needsUpdate = true;
  }
}

/**
 * Reset InstancedMesh projectile pools + debris glow on full game restart.
 * Called from main.js's registerResetHook (drone/boss-helper pools stay in
 * main.js and are disposed by the same hook).
 */
export function resetProjectilePools() {
  for (const [poolType, pool] of Object.entries(instancedProjectiles)) {
    if (pool.mesh) {
      pool.mesh.count = 0;
      pool.mesh.instanceMatrix.needsUpdate = true;
    }
    pool.freeIndices = new Set();
    if (projectileInstanceData[poolType]) {
      for (let i = 0; i < projectileInstanceData[poolType].length; i++) {
        projectileInstanceData[poolType][i] = { active: false };
      }
    }
    // Reset glow planes too
    if (pool.glowMesh) { pool.glowMesh.count = 0; pool.glowMesh.instanceMatrix.needsUpdate = true; }
    if (pool.glowMeshRight) { pool.glowMeshRight.count = 0; pool.glowMeshRight.instanceMatrix.needsUpdate = true; }
  }
  // Reset debris glow pool
  if (_debrisGlowPool) {
    _debrisGlowPool.count = 0;
    _debrisGlowPool.instanceMatrix.needsUpdate = true;
    _debrisGlowActive.length = 0;
    _debrisGlowFree = [];
    for (let i = 0; i < DEBRIS_GLOW_POOL_SIZE; i++) _debrisGlowFree.push(i);
  }

  // Issue #211: clear protective Swarm Leader drones on full game restart
  clearSwarmDrones();
}

/**
 * Debris-glow-only reset for level transitions (clearAllAltWeaponEffects).
 * Same work as resetProjectilePools minus the instanced projectile pools.
 */
export function resetDebrisGlow() {
  if (_debrisGlowPool) {
    _debrisGlowPool.count = 0;
    _debrisGlowPool.instanceMatrix.needsUpdate = true;
    _debrisGlowActive.length = 0;
    _debrisGlowFree = [];
    for (let i = 0; i < DEBRIS_GLOW_POOL_SIZE; i++) _debrisGlowFree.push(i);
  }
}

// Exports for main.js + beam-weapons.js (functions extracted from the monolith)
export {
  clearAllProjectiles, startAccuracyShot, resolveDroppedShot,
  spawnProjectile, getPooledProjectile, processSeekerBurstQueue,
  updateProjectiles, updateExplosionVisuals, spawnExplosionVisual,
  isHostileProjectile, markProjectileHit, resolveProjectileAccuracy,
  handleHit, spawnBossProjectileDestructionFX, triggerHostileProjectileExplosion,
  // Per-hand seeker burst cooldown — main.js's fireMainWeapon gates on it
  // (Issue #218 test surfaced this as a latent production crash: the seeker
  // fire path referenced it without an import).
  seekerBurstCooldownEnd,
  SEEKER_BURST_DELAY,
};
// Live hostile-projectile cache (per-frame, rebuilt in updateProjectiles) —
// shared with beam-weapons.js for orb collision scans.
export { _hostileProjectilesInArray };
// Constants shared with main.js (visual tuning + perf debug logging)
export { PROJECTILE_BOLT, MAX_PROJECTILES };
// Per-instance data arrays (shared with main.js reset hooks + telemetry)
export { projectileInstanceData };
