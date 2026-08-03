// ============================================================
//  BEAM WEAPONS — charge cannon + lightning rod systems
//  Extracted from main.js (Phase 1 of Issue #196 refactor).
//  Owns all charge/lightning state, visuals and the pending
//  timer registry. Reverse dependencies into main.js (hit
//  handling, damage popups, HUD) are injected via
//  initBeamWeapons() so this module stays importable.
// ============================================================

import * as THREE from 'three';
import { game, addScore, trackKill, getBossTier, registerAccuracyHit } from './game.js';
import { getWeaponStats } from './weapons.js';
import {
  getEnemies, getBoss, hitBoss, hitEnemy, getEnemyByMesh, applyEffects,
  getBossProjectiles, releaseBossProjIndex, spawnHealthGainPopup,
} from './enemies.js';
import {
  playChargeFireSound, playHitSound, playExplosionSound, playComboSound,
  playHealSound, playTingSound, playDamageSound, startLightningSound,
  startLightningOrbChargeSound, updateLightningOrbChargeSound, stopLightningOrbChargeSound,
  startLightningOrbTravelLoop, stopLightningOrbTravelLoop, playLightningOrbFireSound,
} from './audio.js';
import { updateHUD, spawnKillChainPopup, triggerHitFlash } from './hud.js';
import { spawnDamageNumber } from './damage-numbers.js';
import { startBossDeathCinematic } from './boss-death-cinematic.js';
// NOTE: intentional ES module cycle — beam-weapons → projectile-system → beam-weapons.
// Both modules only call each other's functions at runtime (never during module
// evaluation), which is valid for native ES modules. A future phase can break it
// with a shared collision/utility module.
import {
  handleHit, spawnBossProjectileDestructionFX, triggerHostileProjectileExplosion,
  projectiles, _hostileProjectilesInArray, explosionVisuals,
} from './projectile-system.js';

// [DEBUG] Mirrors main.js — console.log blocks the render thread on Quest
const DEBUG = false;

// ============================================================
// PENDING TIMER REGISTRY
// Tracks setTimeout IDs so gameplay timers (e.g. charge-beam
// triple-shot) can be cancelled on level transitions and game
// reset. Fix for Issue #195/#204: stale timers firing into the
// next level or during upgrade selection.
// ============================================================
const pendingTimers = new Set();

// Schedule a timeout that is tracked for cleanup.
// Returns the timer ID (usable with clearTimeout).
function scheduleTimeout(fn, ms) {
  const id = setTimeout(() => {
    pendingTimers.delete(id);
    fn();
  }, ms);
  pendingTimers.add(id);
  return id;
}

// Cancel every tracked timer. Called on level complete + game reset.
export function clearAllPendingTimers() {
  for (const id of pendingTimers) clearTimeout(id);
  pendingTimers.clear();
}

// ============================================================
// MODULE STATE (moved from main.js — Issue #196 Phase 1)
// ============================================================

// Lightning beam state (per controller)
const lightningBeams = [null, null];
const lightningTimers = [0, 0];
const LIGHTNING_BOLT_SEGMENTS = 8;
const MAX_LIGHTNING_CHAINS = 6;
const lightningOrbChargeStart = [null, null];
const lightningOrbChargeVisuals = [null, null];
const activeLightningOrbs = [];
const LIGHTNING_ORB_MAX_POOL = 4;
const LIGHTNING_ORB_SPEED = 8.5;
const LIGHTNING_ORB_LIFETIME = 5000;
const LIGHTNING_ORB_RADIUS_MIN = 0.18;
const LIGHTNING_ORB_RADIUS_MAX = 0.6;
const LIGHTNING_FORWARD_RANGE = 0.5;  // Max forward beam length when no enemies in range (~1-2 feet, prevents cheesing boss fights)
const LIGHTNING_BOSS_PROJ_RADIUS_SQ = 1.0;  // Hit radius squared for boss projectile intersection

// Charge shot constants + per-controller visual state
const CHARGE_SHOT_MAX_TIME = 3.0;  // seconds to reach full charge
const CHARGE_SHOT_MIN_FIRE = 0.1;  // minimum charge time to fire
const CHARGE_SHOT_MIN_DAMAGE = 50;   // minimum damage at no charge
const CHARGE_SHOT_MAX_DAMAGE = 1000; // maximum damage at full charge
const chargeBeamVisuals = [null, null];
const chargeGlowSpheres = [null, null];
const chargeParticleSystems = [null, null];
const activeChargeExplosions = [];

// Scratch space for spatial hash queries (perf: reused across frames)
const _hashScratchLightning = [];

// ============================================================
// REGISTERED DEPENDENCIES (injected from main.js at init)
// Reverse deps: hooks into main.js-owned systems that are not
// extracted yet (projectile pool, hit handling, HUD, damage).
// ============================================================
let scene = null;
let camera = null;
let controllers = null;
let enemySpatialHash = null;

// Hooks into main.js (set via initBeamWeapons)
let basicMat = (color, opts) => null;
let handleEnemyKilled = () => null;
let disposeObject3D = () => null;
let setKilledBy = () => null;
let applyPlayerDamage = () => false;
let checkKillsAlert = () => null;
let endGame = () => null;
let triggerScreenShake = () => null;

/**
 * Register runtime dependencies from main.js. Must be called once at init
 * after controllers/scene/camera are created.
 * @param {Object} deps - { scene, camera, controllers, enemySpatialHash,
 *   basicMat, hooks: { handleEnemyKilled, disposeObject3D, setKilledBy,
 *   applyPlayerDamage, checkKillsAlert, endGame, triggerScreenShake } }
 * (handleHit/spawnBossProjectileDestructionFX/triggerHostileProjectileExplosion/
 *  projectiles/_hostileProjectilesInArray are imported from projectile-system.js)
 */
export function initBeamWeapons(deps) {
  if (!deps) return;
  scene = deps.scene || null;
  camera = deps.camera || null;
  controllers = deps.controllers || null;
  enemySpatialHash = deps.enemySpatialHash || null;
  if (typeof deps.basicMat === 'function') basicMat = deps.basicMat;
  const h = deps.hooks || {};
  if (typeof h.handleEnemyKilled === 'function') handleEnemyKilled = h.handleEnemyKilled;
  if (typeof h.disposeObject3D === 'function') disposeObject3D = h.disposeObject3D;
  if (typeof h.setKilledBy === 'function') setKilledBy = h.setKilledBy;
  if (typeof h.applyPlayerDamage === 'function') applyPlayerDamage = h.applyPlayerDamage;
  if (typeof h.checkKillsAlert === 'function') checkKillsAlert = h.checkKillsAlert;
  if (typeof h.endGame === 'function') endGame = h.endGame;
  if (typeof h.triggerScreenShake === 'function') triggerScreenShake = h.triggerScreenShake;
}

// Map a controller index to a hand ('left'/'right'), honoring VR-handedness
// swaps reported through the controller's userData (moved from main.js).
export function getHandForController(controllerIndex) {
  const controller = controllers && controllers[controllerIndex];
  if (controller && controller.userData.handedness) {
    // Use actual controller handedness (from VR system)
    return controller.userData.handedness;
  }
  // Fallback to index-based mapping (controller 0 = left, controller 1 = right)
  return controllerIndex === 0 ? 'left' : 'right';
}

// State queries used by main.js's trigger/release handling
export function isLightningOrbCharging(index) {
  return lightningOrbChargeStart[index] !== null;
}
export function getLightningOrbChargeSec(index, now) {
  return (now - lightningOrbChargeStart[index]) / 1000;
}

// Full cleanup for level transitions / game reset: charge explosions,
// beam visuals, lightning beams + orbs (replaces the old inline reset hook).
export function resetChargeSystems() {
  for (let i = activeChargeExplosions.length - 1; i >= 0; i--) {
    const exp = activeChargeExplosions[i];
    if (scene) scene.remove(exp.mesh);
    exp.mesh.geometry.dispose();
    exp.mesh.material.dispose();
    if (exp.texture) exp.texture.dispose();
  }
  activeChargeExplosions.length = 0;
  clearAllChargeBeamVisuals();
  clearAllLightningBeams();
  clearAllLightningOrbs();
}

/**
 * Handle the continuous lightning beam while the trigger is held.
 * fireMainWeapon() returns early for lightning weapons, then the main update loop
 * calls this every frame to: (1) read the controller pose, (2) grab nearby enemies
 * from the spatial hash, (3) maintain the beam visuals/sound, and (4) tick damage
 * on lightningTickInterval. This keeps lightning weapons feel like hold-to-fire beams
 * without going through the projectile system.
 */
// [CORE] Update lightning beam weapon (continuous beam)
// Issue #22: Always fires forward. Curves toward enemies if nearby.
// Forward beam hits and destroys boss projectiles.
function updateLightningBeam(controller, index, stats, dt) {
  controller.getWorldPosition(_lightningOrigin);
  controller.getWorldQuaternion(_lightningQuat);
  _lightningDirCalc.set(0, 0, -1).applyQuaternion(_lightningQuat);

  // Calculate forward beam endpoint
  _lightningForwardEnd.copy(_lightningOrigin).addScaledVector(_lightningDirCalc, LIGHTNING_FORWARD_RANGE);

  // Find enemies within lock-on range using spatial hash
  // Perf: queryInto reuses a scratch array; parallel arrays + insertion sort
  // avoid per-frame {enemy,distSq} objects and sort() comparator closure
  _hashScratchLightning.length = 0;
  enemySpatialHash.queryInto(_hashScratchLightning, _lightningOrigin.x, _lightningOrigin.z, stats.lightningRange);
  _lightningTargetEnemies.length = 0;
  _lightningTargetDistSq.length = 0;
  const maxChains = stats.lightningMaxTargets || 3;
  const lightningRangeSq = stats.lightningRange * stats.lightningRange;

  for (let hi = 0; hi < _hashScratchLightning.length; hi++) {
    const e = _hashScratchLightning[hi];
    // Verify enemy is still valid (alive, mesh present, and registered in enemy list)
    if (!e || !e.mesh || !e.mesh.parent || e.hp <= 0) continue;
    const distSq = e.mesh.position.distanceToSquared(_lightningOrigin);
    _lightningToEnemy.copy(e.mesh.position).sub(_lightningOrigin).normalize();
    const angle = _lightningToEnemy.dot(_lightningDirCalc);

    // Within range and roughly in front (45° cone)
    if (distSq < lightningRangeSq && angle > 0.7) {
      _lightningTargetEnemies.push(e);
      _lightningTargetDistSq.push(distSq);
    }
  }

  // Insertion sort by distance (few targets; parallel arrays stay in sync)
  for (let si = 1; si < _lightningTargetDistSq.length; si++) {
    const d = _lightningTargetDistSq[si];
    const e = _lightningTargetEnemies[si];
    let si2 = si - 1;
    while (si2 >= 0 && _lightningTargetDistSq[si2] > d) {
      _lightningTargetDistSq[si2 + 1] = _lightningTargetDistSq[si2];
      _lightningTargetEnemies[si2 + 1] = _lightningTargetEnemies[si2];
      si2--;
    }
    _lightningTargetDistSq[si2 + 1] = d;
    _lightningTargetEnemies[si2 + 1] = e;
  }

  const chainCount = Math.min(_lightningTargetEnemies.length, maxChains);

  // Always show beam (sound + visuals)
  startLightningSound();
  const beam = ensureLightningBeam(index);
  const positions = beam.userData.positions;
  let offset = 0;

  // Draw beam forward from controller
  _lightningLastPos.copy(_lightningOrigin);

  if (chainCount > 0) {
    // First segment: forward beam then curve to first target
    // Draw a short forward segment, then zigzag to each target
    _lightningMidPoint.copy(_lightningOrigin).addScaledVector(_lightningDirCalc, 2.0);  // 2 units forward before curving
    offset = writeLightningBoltPositions(_lightningOrigin, _lightningMidPoint, positions, offset);
    for (let ti = 0; ti < chainCount; ti++) {
      const targetPos = _lightningTargetEnemies[ti].mesh.position;
      const startPos = ti === 0 ? _lightningMidPoint : _lightningTargetEnemies[ti - 1].mesh.position;
      offset = writeLightningBoltPositions(startPos, targetPos, positions, offset);
    }
  } else {
    // No enemies: straight forward beam
    offset = writeLightningBoltPositions(_lightningOrigin, _lightningForwardEnd, positions, offset);
  }

  beam.geometry.attributes.position.needsUpdate = true;
  beam.geometry.setDrawRange(0, offset / 3);
  beam.visible = offset > 0;

  // Check boss projectile intersection with forward beam segment
  const bossProjectiles = getBossProjectiles();
  if (bossProjectiles.length > 0) {
    // Use origin -> forwardEnd as the beam line for intersection
    // Fix: removed degenerate ternary (both branches were _lightningOrigin)
    const beamStart = _lightningOrigin;
    const beamEnd = _lightningForwardEnd;
    for (let i = bossProjectiles.length - 1; i >= 0; i--) {
      const bossProj = bossProjectiles[i];
      if (!bossProj) continue;
      const distSq = pointToSegmentDistSq(bossProj.position, beamStart, beamEnd);
      if (distSq < LIGHTNING_BOSS_PROJ_RADIUS_SQ) {
        spawnBossProjectileDestructionFX(bossProj.position.clone());
        if (bossProj._instIdx !== undefined) releaseBossProjIndex(bossProj._instIdx);
        bossProjectiles.splice(i, 1);
      }
    }
  }

  // Apply damage to enemy targets at tick interval
  if (chainCount > 0) {
    const tickInterval = stats.lightningTickInterval != null ? stats.lightningTickInterval : 0.2;
    lightningTimers[index] += dt;
    if (lightningTimers[index] >= tickInterval) {
      lightningTimers[index] = 0;

      let accuracyHitRegistered = false;
      for (let ti = 0; ti < chainCount; ti++) {
        const enemy = _lightningTargetEnemies[ti];
        const liveTarget = enemy?.mesh ? getEnemyByMesh(enemy.mesh) : null;
        const enemyIndex = liveTarget?.index;
        if (enemyIndex === undefined) continue;
        const result = hitEnemy(enemyIndex, stats.lightningDamage);
        if (!accuracyHitRegistered) {
          const oldMultiplier = game.accuracyMultiplier || 1;
          registerAccuracyHit();
          const newMultiplier = game.accuracyMultiplier || 1;
          const oldThreshold = Math.floor(oldMultiplier);
          const newThreshold = Math.floor(newMultiplier);
          if (newThreshold > oldThreshold && newThreshold >= 2) {
            spawnKillChainPopup(newThreshold, camera.position);
            playComboSound(newThreshold);
          }
          accuracyHitRegistered = true;
        }
        spawnDamageNumber(enemy.mesh.position, stats.lightningDamage, '#ffff44');
        playHitSound();
        if (stats.effects && stats.effects.length > 0) applyEffects(enemyIndex, stats.effects);

        if (result.killed) {
          playExplosionSound();
          const destroyData = handleEnemyKilled(enemyIndex, { killsWithoutHit: true, skipChain: false });
          if (destroyData) {
            // Track kills for hand stats (was missing, caused vampiric/hologram bug)
            const hand = getHandForController(index);
            game.handStats[hand].kills++;
            if (destroyData.type) {
              if (!game.handStats[hand].enemyKills) {
                game.handStats[hand].enemyKills = {};
              }
              game.handStats[hand].enemyKills[destroyData.type] = (game.handStats[hand].enemyKills[destroyData.type] || 0) + 1;
            }
            // Vampiric healing
            if (stats.vampiricInterval > 0 && game.totalKills % stats.vampiricInterval === 0) {
              game.health = Math.min(game.maxHealth, game.health + 1);
              if (DEBUG) console.log('[vampiric] Healed 1 HP (lightning)');
              spawnHealthGainPopup(destroyData.position);
              playHealSound();
            }
          }
        }
      }
    }
  }
}

// Pooled temp vectors for lightning bolt generation (per-segment)
const _lightningDir = new THREE.Vector3();
const _lightningPerp = new THREE.Vector3();
const _lightningPrevPoint = new THREE.Vector3();
const _lightningNextPoint = new THREE.Vector3();
const _lightningUp = new THREE.Vector3(0, 1, 0);
const _lightningAltPerp = new THREE.Vector3();

// PERFORMANCE: Scratch vectors for updateLightningBeam hot path
const _lightningOrigin = new THREE.Vector3();
const _lightningQuat = new THREE.Quaternion();
const _lightningDirCalc = new THREE.Vector3();
const _lightningToEnemy = new THREE.Vector3();
// Perf: reused target lists for updateLightningBeam — avoids allocating a
// `targets` array + {enemy,distSq} objects + sort() closure every frame
const _lightningTargetEnemies = [];
const _lightningTargetDistSq = [];
const _lightningLastPos = new THREE.Vector3();
const _lightningForwardEnd = new THREE.Vector3();
const _lightningMidPoint = new THREE.Vector3();
const _lightningOrbOrigin = new THREE.Vector3();
const _lightningOrbQuat = new THREE.Quaternion();
const _lightningOrbDir = new THREE.Vector3(0, 0, -1);

// PERFORMANCE: Pooled lightning material (reused across bolts)
const _lightningMaterial = new THREE.LineBasicMaterial({
  color: 0xffff44,
  linewidth: 2,
  transparent: true,
  opacity: 0.9
});

/**
 * Lazily create one persistent lightning beam per hand.
 * VR-CRITICAL: Reusing one geometry avoids per-frame BufferGeometry churn.
 */
function ensureLightningBeam(index) {
  if (lightningBeams[index]) return lightningBeams[index];

  const maxVertices = (MAX_LIGHTNING_CHAINS + 2) * LIGHTNING_BOLT_SEGMENTS * 2;  // +2 for forward beam + midpoint
  const positions = new Float32Array(maxVertices * 3);
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setDrawRange(0, 0);

  const beam = new THREE.LineSegments(geometry, _lightningMaterial);
  beam.name = `lightning-beam-${index}`;
  beam.frustumCulled = false;
  beam.renderOrder = 95;
  beam.visible = false;
  beam.userData.positions = positions;
  scene.add(beam);
  lightningBeams[index] = beam;
  return beam;
}

/**
 * Hide a pooled lightning beam without disposing its shared GPU resources.
 * This keeps trigger spam from causing GC or driver hitches in VR.
 */
function clearLightningBeam(index) {
  const beam = lightningBeams[index];
  if (!beam) return;
  beam.visible = false;
  beam.geometry.setDrawRange(0, 0);
}

function isBossLightningLevel() {
  return game._levelConfig?.isBoss || getBossTier(game.level) > 0;
}

function ensureLightningOrbChargeVisual(controller, index) {
  let visual = lightningOrbChargeVisuals[index];
  if (!visual) {
    const group = new THREE.Group();
    group.name = `lightning-orb-charge-${index}`;
    const core = new THREE.Mesh(
      new THREE.SphereGeometry(0.12, 16, 12),
      basicMat(0xffff44, {
        transparent: true,
        opacity: 0.8,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      })
    );
    const glow = new THREE.Mesh(
      new THREE.SphereGeometry(0.22, 16, 12),
      basicMat(0xff44ff, {
        transparent: true,
        opacity: 0.24,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      })
    );
    group.add(glow);
    group.add(core);
    group.position.set(0, 0, -0.18);
    group.visible = false;
    visual = { group, core, glow };
    lightningOrbChargeVisuals[index] = visual;
  }

  // Desktop virtual controllers are plain objects (no .add()), so attach to camera instead
  const parent = (controller && typeof controller.add === 'function') ? controller : camera;
  if (parent && visual.group.parent !== parent) {
    parent.add(visual.group);
  }
  return visual;
}

function updateLightningOrbCharge(controller, index, stats, now) {
  if (lightningOrbChargeStart[index] === null) {
    lightningOrbChargeStart[index] = now;
    startLightningOrbChargeSound(index);
  }

  const chargeTime = (now - lightningOrbChargeStart[index]) / 1000;
  const maxCharge = stats.lightningOrbChargeTime || 1.5;
  const progress = Math.min(1, chargeTime / maxCharge);
  const visual = ensureLightningOrbChargeVisual(controller, index);
  const scale = THREE.MathUtils.lerp(0.55, 1.8, progress);
  visual.group.visible = true;
  visual.core.scale.setScalar(scale);
  visual.glow.scale.setScalar(scale * 1.2);
  visual.core.material.opacity = 0.55 + progress * 0.35;
  visual.glow.material.opacity = 0.18 + progress * 0.28;
  visual.group.rotation.y = now * 0.008;
  updateLightningOrbChargeSound(index, progress);
}

function clearLightningOrbCharge(index) {
  lightningOrbChargeStart[index] = null;
  stopLightningOrbChargeSound(index);
  const visual = lightningOrbChargeVisuals[index];
  if (visual) visual.group.visible = false;
}

function acquireLightningOrbVisual() {
  for (let i = 0; i < activeLightningOrbs.length; i++) {
    if (!activeLightningOrbs[i].active) return activeLightningOrbs[i];
  }
  if (activeLightningOrbs.length >= LIGHTNING_ORB_MAX_POOL) {
    releaseLightningOrb(activeLightningOrbs[0]);
    return activeLightningOrbs[0];
  }

  const group = new THREE.Group();
  group.name = 'lightning-boss-orb';
  const core = new THREE.Mesh(
    new THREE.SphereGeometry(1, 20, 14),
    basicMat(0xffff66, {
      transparent: true,
      opacity: 0.9,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    })
  );
  const glow = new THREE.Mesh(
    new THREE.SphereGeometry(1, 20, 14),
    basicMat(0xff44ff, {
      transparent: true,
      opacity: 0.3,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    })
  );
  group.add(glow);
  group.add(core);
  group.visible = false;
  scene.add(group);

  const orb = {
    active: false,
    group,
    core,
    glow,
    position: new THREE.Vector3(),
    velocity: new THREE.Vector3(),
    radius: LIGHTNING_ORB_RADIUS_MIN,
    createdAt: 0,
    damage: 0,
    hand: 'left',
    controllerIndex: 0,
    travelLoop: null,
  };
  activeLightningOrbs.push(orb);
  return orb;
}

function releaseLightningOrb(orb) {
  if (!orb) return;
  orb.active = false;
  orb.group.visible = false;
  stopLightningOrbTravelLoop(orb.travelLoop);
  orb.travelLoop = null;
}

function fireLightningOrb(controller, index, chargeTimeSec, stats) {
  const maxCharge = stats.lightningOrbChargeTime || 1.5;
  const progress = Math.max(0, Math.min(1, chargeTimeSec / maxCharge));
  if (progress <= 0.05) return;

  controller.getWorldPosition(_lightningOrbOrigin);
  controller.getWorldQuaternion(_lightningOrbQuat);
  _lightningOrbDir.set(0, 0, -1).applyQuaternion(_lightningOrbQuat).normalize();

  const orb = acquireLightningOrbVisual();
  orb.active = true;
  orb.position.copy(_lightningOrbOrigin).addScaledVector(_lightningOrbDir, 0.25);
  orb.velocity.copy(_lightningOrbDir).multiplyScalar(LIGHTNING_ORB_SPEED);
  orb.radius = THREE.MathUtils.lerp(LIGHTNING_ORB_RADIUS_MIN, LIGHTNING_ORB_RADIUS_MAX, progress);
  orb.createdAt = performance.now();
  // Boss-mode Lightning Rod is deliberately capped so upgrades matter without
  // deleting level bosses in one release.
  orb.damage = Math.min(
    stats.lightningOrbDamageCap || 280,
    Math.round(stats.lightningDamage * THREE.MathUtils.lerp(6, 12, progress))
  );
  orb.hand = getHandForController(index);
  orb.controllerIndex = index;
  orb.group.position.copy(orb.position);
  orb.group.scale.setScalar(orb.radius);
  orb.group.visible = true;
  orb.travelLoop = startLightningOrbTravelLoop(progress);
  playLightningOrbFireSound(progress);
}

function clearAllLightningOrbs() {
  for (let i = 0; i < activeLightningOrbs.length; i++) {
    releaseLightningOrb(activeLightningOrbs[i]);
  }
  for (let i = 0; i < lightningOrbChargeStart.length; i++) {
    clearLightningOrbCharge(i);
  }
}

function updateLightningOrbs(dt, now) {
  for (let i = activeLightningOrbs.length - 1; i >= 0; i--) {
    const orb = activeLightningOrbs[i];
    if (!orb.active) continue;

    if (now - orb.createdAt > LIGHTNING_ORB_LIFETIME) {
      releaseLightningOrb(orb);
      continue;
    }

    orb.position.addScaledVector(orb.velocity, dt);
    orb.group.position.copy(orb.position);
    orb.group.rotation.y += dt * 8;
    orb.core.material.opacity = 0.75 + Math.sin(now * 0.02) * 0.12;
    orb.glow.material.opacity = 0.24 + Math.sin(now * 0.014) * 0.08;

    const bossProjectiles = getBossProjectiles();
    for (let pi = bossProjectiles.length - 1; pi >= 0; pi--) {
      const bossProj = bossProjectiles[pi];
      if (!bossProj) continue;
      const hitRadius = orb.radius + (bossProj.hitRadius || 0.45);
      if (orb.position.distanceToSquared(bossProj.position) <= hitRadius * hitRadius) {
        spawnBossProjectileDestructionFX(bossProj.position.clone());
        if (bossProj._instIdx !== undefined) releaseBossProjIndex(bossProj._instIdx);
        bossProjectiles.splice(pi, 1);
      }
    }

    // Perf: iterate the per-frame hostile cache instead of the full
    // projectiles[] array (cache rebuilt in updateProjectiles each frame)
    for (let hi = _hostileProjectilesInArray.length - 1; hi >= 0; hi--) {
      const hostile = _hostileProjectilesInArray[hi];
      if (!hostile) continue;
      const hitRadius = orb.radius + 0.35;
      if (orb.position.distanceToSquared(hostile.position) <= hitRadius * hitRadius) {
        triggerHostileProjectileExplosion(hostile.position.clone(), 0.35, 0);
        disposeObject3D(hostile);
        const hpIdx = projectiles.indexOf(hostile);
        if (hpIdx >= 0) projectiles.splice(hpIdx, 1);
        _hostileProjectilesInArray.splice(hi, 1);
      }
    }

    const boss = getBoss();
    if (!boss?.mesh) continue;
    const bossRadius = boss.def?.behavior === 'eclipse' ? 4.0 : 2.2;
    const hitRadius = orb.radius + bossRadius;
    if (orb.position.distanceToSquared(boss.mesh.position) > hitRadius * hitRadius) continue;

    const result = hitBoss(orb.damage, { isLightningOrb: true, handIndex: orb.controllerIndex });
    spawnDamageNumber(boss.mesh.position.clone(), result.immune ? 0 : orb.damage, result.immune ? '#aaaaaa' : '#ffff44');
    if (result.shieldReflected) {
      const dead = applyPlayerDamage(1);
      setKilledBy({ type: 'boss', name: boss.def?.name || 'Boss', enemyType: boss.def?.behavior || '' });
      triggerHitFlash(true);
      playDamageSound();
      if (dead) endGame(false);
    } else if (result.immune) {
      playTingSound();
    } else {
      game.handStats[orb.hand].totalDamage += orb.damage;
      playHitSound();
      if (result.killed) {
        playExplosionSound();
        game.kills++;
        trackKill(true);
        game.killsWithoutHit++;
        addScore(boss.scoreValue);
        updateHUD(game);
        checkKillsAlert();
        startBossDeathCinematic(boss);
      }
    }
    releaseLightningOrb(orb);
  }
}

/**
 * Write a zig-zag lightning chain into a shared LineSegments position buffer.
 * @returns {number} Updated vertex offset into the Float32Array
 */
function writeLightningBoltPositions(start, end, positions, offset) {
  _lightningDir.subVectors(end, start);
  const length = _lightningDir.length();
  if (length <= 0.0001) {
    return offset;
  }
  _lightningDir.divideScalar(length);
  _lightningPerp.crossVectors(_lightningDir, _lightningUp);
  if (_lightningPerp.lengthSq() < 0.0001) {
    _lightningPerp.set(1, 0, 0);
  } else {
    _lightningPerp.normalize();
  }
  _lightningAltPerp.crossVectors(_lightningDir, _lightningPerp).normalize();

  _lightningPrevPoint.copy(start);
  const zigzagAmount = Math.min(0.28, 0.08 + length * 0.04);

  for (let i = 1; i <= LIGHTNING_BOLT_SEGMENTS; i++) {
    const t = i / LIGHTNING_BOLT_SEGMENTS;
    _lightningNextPoint.lerpVectors(start, end, t);

    if (i < LIGHTNING_BOLT_SEGMENTS) {
      const jitterA = (Math.random() - 0.5) * zigzagAmount;
      const jitterB = (Math.random() - 0.5) * zigzagAmount * 0.45;
      _lightningNextPoint.addScaledVector(_lightningPerp, jitterA);
      _lightningNextPoint.addScaledVector(_lightningAltPerp, jitterB);
    }

    positions[offset++] = _lightningPrevPoint.x;
    positions[offset++] = _lightningPrevPoint.y;
    positions[offset++] = _lightningPrevPoint.z;
    positions[offset++] = _lightningNextPoint.x;
    positions[offset++] = _lightningNextPoint.y;
    positions[offset++] = _lightningNextPoint.z;

    _lightningPrevPoint.copy(_lightningNextPoint);
  }

  return offset;
}

/**
 * Rare-use helper for boss-authored lightning VFX.
 * This is intentionally separate from the player beam pool because bosses fire it
 * infrequently, so a tiny transient line is cheaper than adding another global system.
 */
function spawnTransientLightningBolt(start, end, duration = 120) {
  const maxVertices = LIGHTNING_BOLT_SEGMENTS * 2;
  const positions = new Float32Array(maxVertices * 3);
  const offset = writeLightningBoltPositions(start, end, positions, 0);
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setDrawRange(0, offset / 3);

  const material = _lightningMaterial.clone();
  const bolt = new THREE.LineSegments(geometry, material);
  bolt.name = 'boss-lightning-bolt';
  bolt.frustumCulled = false;
  bolt.userData.createdAt = performance.now();
  bolt.userData.duration = duration;
  scene.add(bolt);
  explosionVisuals.push(bolt);
}

/**
 * Get charge damage based on charge time (Mega Man style curve)
 * @param {number} t - charge time in seconds
 * @returns {number} damage value
 */
// [CORE] Charge cannon damage calculation
function chargeTimeToDamage(t, chargeRateMultiplier = 1, damageMultiplier = 1) {
  // chargeRateMultiplier: from quick_charge upgrade (e.g. 2.0 = half charge time)
  // damageMultiplier: from death_ray upgrade (e.g. 2.0 = double max damage)
  const effectiveMaxTime = CHARGE_SHOT_MAX_TIME / chargeRateMultiplier;
  const clampedT = Math.min(t, effectiveMaxTime);
  const progress = clampedT / effectiveMaxTime;
  const maxDamage = CHARGE_SHOT_MAX_DAMAGE * damageMultiplier;

  return CHARGE_SHOT_MIN_DAMAGE + (maxDamage - CHARGE_SHOT_MIN_DAMAGE) * progress;
}

/**
 * Get charge progress (0-1) for visual effects
 * Uses the same curve as damage for consistent feedback
 */
// [CORE] Charge cannon progress calculation
function chargeTimeToProgress(t, chargeRateMultiplier = 1) {
  const effectiveMaxTime = CHARGE_SHOT_MAX_TIME / chargeRateMultiplier;
  const clampedT = Math.min(t, effectiveMaxTime);
  return clampedT / effectiveMaxTime;
}

/**
 * Create or update charge visual effects on controller
 * - Glowing sphere that gets brighter with charge
 * - Orbiting particles for Mega Man style charging
 * @param {THREE.Controller} controller - The controller
 * @param {number} index - Controller index (0=left, 1=right)
 * @param {number} progress - Charge progress from 0 to 1
 */
// [CORE] Update charge cannon visual effects
function updateChargeVisuals(controller, index, progress) {
  if (!controller || typeof controller.add !== 'function') return;

  // Initialize glow sphere if needed
  if (!chargeGlowSpheres[index]) {
    // Main glow sphere at controller tip
    const glowGeo = new THREE.SphereGeometry(0.05, 16, 16);
    const glowMat = basicMat(0x00ffff, {
      transparent: true,
      opacity: 0.1,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const glowSphere = new THREE.Mesh(glowGeo, glowMat);
    glowSphere.name = 'charge-glow-sphere';
    glowSphere.position.set(0, 0, -0.1);  // In front of controller
    controller.add(glowSphere);
    chargeGlowSpheres[index] = glowSphere;

    // Create orbiting particles (8 small spheres in a ring)
    const particleGroup = new THREE.Group();
    const particleCount = 8;
    for (let i = 0; i < particleCount; i++) {
      const particleGeo = new THREE.SphereGeometry(0.015, 8, 8);
      const particleMat = basicMat(0x00ffff, {
        transparent: true,
        opacity: 0.5,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      });
      const particle = new THREE.Mesh(particleGeo, particleMat);
      particle.name = 'charge-particle';
      particle.userData.orbitAngle = (i / particleCount) * Math.PI * 2;
      particle.userData.orbitRadius = 0.08;
      particleGroup.add(particle);
    }
    particleGroup.position.set(0, 0, -0.1);
    controller.add(particleGroup);
    chargeParticleSystems[index] = particleGroup;
  }

  const glowSphere = chargeGlowSpheres[index];
  const particleGroup = chargeParticleSystems[index];

  if (!glowSphere || !particleGroup) return;

  // Show the effects
  glowSphere.visible = true;
  particleGroup.visible = true;

  // Update glow sphere: scale and color based on charge
  // Scale from 0.05 to 0.15 radius
  const scale = 1 + progress * 2;
  glowSphere.scale.setScalar(scale);

  // Color shifts from cyan (low) to white/pink (high)
  _chargeVisualColor.lerpColors(_chargeBeamBaseColor, _chargeBeamHotColor, progress);
  const color = _chargeVisualColor;
  glowSphere.material.color.copy(color);

  // Opacity increases with charge
  glowSphere.material.opacity = 0.1 + progress * 0.6;

  // Update orbiting particles
  const time = performance.now() * 0.001;
  const orbitSpeed = 2 + progress * 6;  // Faster orbit as charge increases
  const orbitRadius = 0.08 + progress * 0.07;  // Wider orbit as charge increases

  particleGroup.children.forEach((particle, i) => {
    const baseAngle = particle.userData.orbitAngle;
    const angle = baseAngle + time * orbitSpeed;

    particle.position.x = Math.cos(angle) * orbitRadius;
    particle.position.y = Math.sin(angle) * orbitRadius;
    particle.position.z = Math.sin(angle * 0.5) * 0.02;  // Slight wobble

    // Particle color matches glow
    particle.material.color.copy(color);

    // Particles get brighter as charge increases
    particle.material.opacity = 0.3 + progress * 0.7;

    // Particle size increases
    const particleScale = 0.5 + progress * 1.5;
    particle.scale.setScalar(particleScale);
  });
}

/**
 * Hide and clean up charge visual effects
 * @param {number} index - Controller index (0=left, 1=right)
 */
// [CORE] Hide charge cannon visual effects
function hideChargeVisuals(index) {
  if (chargeGlowSpheres[index]) {
    chargeGlowSpheres[index].visible = false;
  }
  if (chargeParticleSystems[index]) {
    chargeParticleSystems[index].visible = false;
  }
}

/**
 * Create persistent charge beam meshes for one hand.
 * VR-CRITICAL: The charge cannon is a marquee effect, so we pool it instead of
 * allocating cylinders into explosionVisuals on every shot.
 */
function ensureChargeBeamVisual(index) {
  if (chargeBeamVisuals[index]) return chargeBeamVisuals[index];

  const coreGeo = new THREE.CylinderGeometry(1, 0.15, 1, 6);
  const glowGeo = new THREE.CylinderGeometry(1, 0.1, 1, 8);
  const coreMat = basicMat(0x00ffff, {
    transparent: true,
    opacity: 0.9,
    side: THREE.DoubleSide,
    depthWrite: false,
    blending: THREE.NormalBlending,
  });
  const glowMat = basicMat(0x00ffff, {
    transparent: true,
    opacity: 0.7,
    side: THREE.DoubleSide,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });

  const coreMesh = new THREE.Mesh(coreGeo, coreMat);
  coreMesh.name = `charge-beam-core-${index}`;
  coreMesh.renderOrder = 100;
  coreMesh.visible = false;
  coreMesh.frustumCulled = false;
  scene.add(coreMesh);

  const glowMesh = new THREE.Mesh(glowGeo, glowMat);
  glowMesh.name = `charge-beam-glow-${index}`;
  glowMesh.renderOrder = 101;
  glowMesh.visible = false;
  glowMesh.frustumCulled = false;
  scene.add(glowMesh);

  chargeBeamVisuals[index] = {
    coreMesh,
    glowMesh,
    createdAt: 0,
    duration: 0,
    maxCoreOpacity: 0.9,
    maxGlowOpacity: 0.7,
    baseCoreWidth: 0,
    baseGlowWidth: 0,
    range: 0,
  };
  return chargeBeamVisuals[index];
}

function clearChargeBeamVisual(index) {
  const beam = chargeBeamVisuals[index];
  if (!beam) return;
  beam.coreMesh.visible = false;
  beam.glowMesh.visible = false;
  beam.duration = 0;
}

function clearAllChargeBeamVisuals() {
  for (let i = 0; i < chargeBeamVisuals.length; i++) {
    clearChargeBeamVisual(i);
  }
}

/**
 * Reuse one core+glow beam pair per hand for the charge cannon.
 * This preserves the old look while eliminating per-shot geometry churn.
 */

// ── Charge Cannon AoE Explosion Visuals ──────────────────────

/**
 * Spawn a billboard explosion at the given position.
 * @param {THREE.Vector3} position - World position of explosion center
 * @param {string|number} color - Color tint (CSS string or hex)
 */
function spawnChargeExplosion(position, color) {
  // Canvas-based radial gradient glow for a proper round explosion effect
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d');
  const gradient = ctx.createRadialGradient(128, 128, 0, 128, 128, 128);
  const c = new THREE.Color(color);
  const r = Math.round(c.r * 255);
  const g = Math.round(c.g * 255);
  const b = Math.round(c.b * 255);
  gradient.addColorStop(0.0, `rgba(255,255,255,1.0)`); // White core
  gradient.addColorStop(0.15, `rgba(${r},${g},${b},1.0)`); // Colored bright
  gradient.addColorStop(0.4, `rgba(${r},${g},${b},0.6)`);
  gradient.addColorStop(0.7, `rgba(${r},${g},${b},0.2)`);
  gradient.addColorStop(1.0, `rgba(${r},${g},${b},0)`);
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 256, 256);

  const texture = new THREE.CanvasTexture(canvas);
  const geo = new THREE.PlaneGeometry(3.0, 3.0);
  const mat = new THREE.MeshBasicMaterial({
    map: texture,
    transparent: true,
    opacity: 1.0,
    depthTest: false,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.copy(position);
  mesh.scale.setScalar(0.3);
  scene.add(mesh);
  activeChargeExplosions.push({
    mesh,
    texture,
    age: 0,
    maxAge: 0.6,
  });
}

/**
 * Update active charge explosions (billboard + animate fade/scale).
 * Call from the main render loop.
 */
function updateChargeExplosions(dt) {
  const camPos = camera.position;
  for (let i = activeChargeExplosions.length - 1; i >= 0; i--) {
    const exp = activeChargeExplosions[i];
    exp.age += dt;
    const t = Math.min(exp.age / exp.maxAge, 1);
    // Scale: 0.5 -> 3.0 over 0.4s (ease out)
    const scaleT = Math.min(exp.age / 0.4, 1);
    exp.mesh.scale.setScalar(0.5 + 2.5 * scaleT);
    // Opacity: 0.9 -> 0.0 over 0.5s
    exp.mesh.material.opacity = 0.9 * (1 - t);
    // Billboard: always face camera
    exp.mesh.lookAt(camPos);
    // Clean up when done
    if (exp.age >= exp.maxAge) {
      scene.remove(exp.mesh);
      exp.mesh.geometry.dispose();
      exp.mesh.material.dispose();
      if (exp.texture) exp.texture.dispose();
      activeChargeExplosions.splice(i, 1);
    }
  }
}

function activateChargeBeamVisual(index, origin, direction, range, beamWidth, progress, now) {
  const beam = ensureChargeBeamVisual(index);
  const visualBeamWidth = beamWidth * 0.3;
  const coreWidth = visualBeamWidth * 0.4;

  _chargeBeamColor.lerpColors(_chargeBeamBaseColor, _chargeBeamHotColor, progress);

  beam.createdAt = now;
  beam.duration = 200;
  beam.maxCoreOpacity = 0.9;
  beam.maxGlowOpacity = 0.7;
  beam.baseCoreWidth = coreWidth;
  beam.baseGlowWidth = visualBeamWidth;
  beam.range = range;

  beam.coreMesh.visible = true;
  beam.glowMesh.visible = true;

  beam.coreMesh.position.copy(origin).addScaledVector(direction, range * 0.5);
  beam.glowMesh.position.copy(beam.coreMesh.position);
  beam.coreMesh.quaternion.setFromUnitVectors(_chargeBeamUp, direction);
  beam.glowMesh.quaternion.copy(beam.coreMesh.quaternion);

  beam.coreMesh.scale.set(coreWidth, range, coreWidth);
  beam.glowMesh.scale.set(visualBeamWidth, range, visualBeamWidth);

  beam.coreMesh.material.color.copy(_chargeBeamColor);
  beam.glowMesh.material.color.copy(_chargeBeamColor);
  beam.coreMesh.material.opacity = beam.maxCoreOpacity;
  beam.glowMesh.material.opacity = beam.maxGlowOpacity;
}

function updateChargeBeamVisuals(now) {
  for (let i = 0; i < chargeBeamVisuals.length; i++) {
    const beam = chargeBeamVisuals[i];
    if (!beam || !beam.coreMesh.visible || beam.duration <= 0) continue;

    const age = now - beam.createdAt;
    if (age > beam.duration) {
      clearChargeBeamVisual(i);
      continue;
    }

    const t = age / beam.duration;
    const pulsePhase = t < 0.3 ? t / 0.3 : 1.0;
    const fadePhase = t < 0.3 ? 0 : (t - 0.3) / 0.7;
    const pulseIntensity = Math.sin(pulsePhase * Math.PI) * 0.2;
    const fadeOpacity = 1 - Math.pow(fadePhase, 2);
    const scaleDown = 1 - fadePhase * 0.3;

    beam.coreMesh.material.opacity = beam.maxCoreOpacity * (1 + pulseIntensity) * fadeOpacity;
    beam.glowMesh.material.opacity = beam.maxGlowOpacity * (1 + pulseIntensity) * fadeOpacity;
    beam.coreMesh.scale.set(
      Math.max(0.0001, beam.baseCoreWidth * scaleDown),
      beam.range,
      Math.max(0.0001, beam.baseCoreWidth * scaleDown)
    );
    beam.glowMesh.scale.set(
      Math.max(0.0001, beam.baseGlowWidth * scaleDown),
      beam.range,
      Math.max(0.0001, beam.baseGlowWidth * scaleDown)
    );
  }
}

// Pooled temp vectors for pointToSegmentDist (hot path)
const _ptsAb = new THREE.Vector3();
const _ptsAp = new THREE.Vector3();
const _ptsProj = new THREE.Vector3();

/**
 * Distance squared from point to line segment (a to b).
 * Perf: Hot collision path uses squared distance to avoid sqrt churn.
 */
function pointToSegmentDistSq(p, a, b, outClosestPoint = null) {
  _ptsAb.subVectors(b, a);
  const abLenSq = _ptsAb.lengthSq();
  let t = 0;
  if (abLenSq > 0.000001) {
    _ptsAp.subVectors(p, a);
    t = Math.max(0, Math.min(1, _ptsAp.dot(_ptsAb) / abLenSq));
  }
  _ptsProj.copy(a).addScaledVector(_ptsAb, t);
  if (outClosestPoint) outClosestPoint.copy(_ptsProj);
  return p.distanceToSquared(_ptsProj);
}

/** Distance from point to line segment (a to b) */
// [CORE] Point-to-line-segment distance calculation
function pointToSegmentDist(p, a, b) {
  return Math.sqrt(pointToSegmentDistSq(p, a, b));
}

const _chargeBeamA = new THREE.Vector3();
const _chargeBeamB = new THREE.Vector3();
const _playerForward = new THREE.Vector3();
const _chargeBeamOrigin = new THREE.Vector3();
const _chargeBeamQuat = new THREE.Quaternion();
const _chargeBeamDir = new THREE.Vector3(0, 0, -1);
const _chargeBeamUp = new THREE.Vector3(0, 1, 0);
const _chargeBeamColor = new THREE.Color();
const _chargeBeamBaseColor = new THREE.Color(0x00ffff);
const _chargeBeamHotColor = new THREE.Color(0xffffff);
const _chargeVisualColor = new THREE.Color();

// [CORE] Fire charge beam weapon
function fireChargeBeam(controller, index, chargeTimeSec, stats, options = {}) {
  if (chargeTimeSec < CHARGE_SHOT_MIN_FIRE) return; // minimum charge to fire

  const chargeRateMultiplier = stats.chargeRateMultiplier || 1;
  const damageMultiplier = stats.chargeDeathRayMultiplier || 1;

  // Use Mega Man style damage curve
  const damage = Math.round(chargeTimeToDamage(chargeTimeSec, chargeRateMultiplier, damageMultiplier));
  const progress = chargeTimeToProgress(chargeTimeSec, chargeRateMultiplier);

  // Play the charge fire sound with progress for intensity
  playChargeFireSound(progress);

  // Beam width scales with progress (0.2 at min, 1.5 at max)
  const beamWidth = 0.2 + progress * 1.3;
  const range = 50;

  controller.getWorldPosition(_chargeBeamOrigin);
  controller.getWorldQuaternion(_chargeBeamQuat);
  _chargeBeamDir.set(0, 0, -1).applyQuaternion(_chargeBeamQuat);

  _chargeBeamA.copy(_chargeBeamOrigin);
  _chargeBeamB.copy(_chargeBeamOrigin).addScaledVector(_chargeBeamDir, range);

  const controllerIndex = index;
  const hand = getHandForController(index);

  // Track positions of enemies killed by this beam for AoE effects
  const aoeKillPositions = [];
  const isFullCharge = progress >= 1.0;

  const chargeStats = { ...stats, damage: Math.round(damage) };
  const beamWidthSq = beamWidth * beamWidth;
  getEnemies().forEach((e, i) => {
    const distSq = pointToSegmentDistSq(e.mesh.position, _chargeBeamA, _chargeBeamB);
    if (distSq < beamWidthSq) {
      // Record position before hit (enemy may be destroyed after handleHit)
      const enemyPos = e.mesh.position.clone();
      const hpBefore = e.hp;
      handleHit(i, e, chargeStats, enemyPos, controllerIndex, false, false);
      // If killed by this beam and it was a full charge, track for AoE
      if (isFullCharge && hpBefore > 0 && e.hp <= 0) {
        aoeKillPositions.push(enemyPos);
      }
    }
  });

  const boss = getBoss();
  if (boss) {
    const distSq = pointToSegmentDistSq(boss.mesh.position, _chargeBeamA, _chargeBeamB);
    if (distSq < beamWidthSq) {
      const result = hitBoss(Math.round(damage), { isChargeCannon: true });

      // Shield reflection
      if (result.shieldReflected) {
        spawnDamageNumber(boss.mesh.position.clone(), 0, '#ff00ff');
        playHitSound();
        const dead = applyPlayerDamage(1);
        setKilledBy({ type: 'boss', name: boss.def?.name || 'Boss', enemyType: boss.def?.behavior || '' });
        triggerHitFlash(true);
        playDamageSound();
        cameraShake = 0.3;
        cameraShakeIntensity = 0.03;
        originalCameraPos.copy(camera.position);

        // Light screen shake on player damage
        triggerScreenShake(0.15, 500); // 0.15 shake for 500ms

        floorFlashing = true;
        floorFlashTimer = 1.0;
        if (dead) endGame(false);
        return;
      }

      spawnDamageNumber(boss.mesh.position.clone(), Math.round(damage), '#ff4444');
      game.handStats[hand].totalDamage += damage;
      if (result.killed) {
        playExplosionSound();
        game.kills++;
        trackKill(true);
        addScore(boss.scoreValue);

        // Update HUD immediately to show correct kill count before level complete
        updateHUD(game);

        // Check for kills remaining alert (for non-boss levels that might call this)
        checkKillsAlert();

        startBossDeathCinematic(boss);
      }
    }
  }

  // Check collision with boss projectiles (charge beam destroys them)
  const bossProjectiles = getBossProjectiles();
  if (bossProjectiles.length > 0) {
    for (let i = bossProjectiles.length - 1; i >= 0; i--) {
      const bossProj = bossProjectiles[i];
      if (!bossProj) continue;
      
      // Check if boss projectile intersects with beam line
      const hitRadius = beamWidth + 0.3;
      const distSq = pointToSegmentDistSq(bossProj.position, _chargeBeamA, _chargeBeamB);
      if (distSq < hitRadius * hitRadius) { // Slightly larger collision radius
        // Destroy boss projectile with explosion effect
        spawnBossProjectileDestructionFX(bossProj.position.clone());
        if (bossProj._instIdx !== undefined) releaseBossProjIndex(bossProj._instIdx);
        bossProjectiles.splice(i, 1);
      }
    }
  }
  activateChargeBeamVisual(index, _chargeBeamOrigin, _chargeBeamDir, range, beamWidth, progress, performance.now());

  // AoE explosion effects on full charge kills
  if (isFullCharge && aoeKillPositions.length > 0) {
    const aoeRadius = 3.0;
    const aoeDamage = 200;
    const enemies = getEnemies();

    aoeKillPositions.forEach(killPos => {
      // Determine which element effects to apply
      const hasFire = stats.hasExcessHeat || stats.hasChargeAoEFire;
      const hasFreeze = stats.hasChargeAoEFreeze;
      const hasShock = stats.hasChargeAoEShock;

      if (hasFire) {
        spawnChargeExplosion(killPos, '#ff4400');
        enemies.forEach((e, i) => {
          if (!e || e.hp <= 0) return;
          const dist = e.mesh.position.distanceTo(killPos);
          if (dist <= aoeRadius) {
            const result = hitEnemy(i, aoeDamage);
            spawnDamageNumber(e.mesh.position.clone(), aoeDamage, '#ff4400');
            // Apply fire DoT
            applyEffects(i, [{ type: 'fire', stacks: 2 }]);
            if (result.killed) {
              handleEnemyKilled(i, { killsWithoutHit: true, skipChain: false });
            }
          }
        });
      }
      if (hasFreeze) {
        if (!hasFire) spawnChargeExplosion(killPos, '#88ccff'); // Don't double-spawn visual
        enemies.forEach((e, i) => {
          if (!e || e.hp <= 0) return;
          const dist = e.mesh.position.distanceTo(killPos);
          if (dist <= aoeRadius) {
            const result = hitEnemy(i, Math.round(aoeDamage * 0.5)); // Freeze deals less direct damage
            spawnDamageNumber(e.mesh.position.clone(), Math.round(aoeDamage * 0.5), '#88ccff');
            applyEffects(i, [{ type: 'freeze', stacks: 2 }]);
            if (result.killed) {
              handleEnemyKilled(i, { killsWithoutHit: true, skipChain: false });
            }
          }
        });
      }
      if (hasShock) {
        if (!hasFire && !hasFreeze) spawnChargeExplosion(killPos, '#ffff44');
        enemies.forEach((e, i) => {
          if (!e || e.hp <= 0) return;
          const dist = e.mesh.position.distanceTo(killPos);
          if (dist <= aoeRadius) {
            const result = hitEnemy(i, Math.round(aoeDamage * 0.75));
            spawnDamageNumber(e.mesh.position.clone(), Math.round(aoeDamage * 0.75), '#ffff44');
            applyEffects(i, [{ type: 'shock', stacks: 2 }]);
            if (result.killed) {
              handleEnemyKilled(i, { killsWithoutHit: true, skipChain: false });
            }
          }
        });
      }

      // If no element but still full charge, spawn a generic explosion (white)
      if (!hasFire && !hasFreeze && !hasShock) {
        spawnChargeExplosion(killPos, '#ffffff');
        // No element damage, just the visual
      }
    });
  }

  // Triple shot: schedule a second beam 300ms later (only on initial fire, not on delayed shots)
  // Timer is tracked in pendingTimers so it is cancelled on level complete / game reset
  // (Issue #195/#204: stale timer used to fire into the next level).
  if ((game.upgrades[hand].triple_shot || 0) > 0 && !options._isDelayedShot) {
    const savedChargeTime = chargeTimeSec;
    const savedStats = { ...stats };
    const savedIndex = index;
    const savedController = controller;
    scheduleTimeout(() => {
      // Guard: weapon still equipped, game still playing
      if (!game || game.state !== State.PLAYING) return;
      const currentHand = getHandForController(savedIndex);
      if (game.mainWeapon[currentHand] !== stats.mainWeaponId) return;
      // Reuse the ORIGINAL controller the beam was fired from. On VR this is
      // the same object as controllers[savedIndex]; on desktop it is the
      // virtual controller — controllers[] are never positioned outside a VR
      // session, so indexing them here fired the delayed beam from the wrong
      // origin (Issue #195: stale/wrong controller on the delayed shot).
      if (savedController) {
        fireChargeBeam(savedController, savedIndex, savedChargeTime, savedStats, { _isDelayedShot: true });
      }
    }, 300);
  }
}

function clearAllLightningBeams() {
  for (let i = 0; i < lightningBeams.length; i++) {
    if (lightningBeams[i]) {
      clearLightningBeam(i);
    }
  }
  lightningTimers.fill(0);
}

// Clear all alt-weapon effects (grenades, mines, decoys, drones, etc.)

// Exports for main.js (functions extracted from the monolith — Issue #196)
export {
  fireChargeBeam, fireLightningOrb, updateLightningOrbCharge, clearLightningOrbCharge,
  updateLightningBeam, clearLightningBeam, clearAllLightningBeams, clearAllLightningOrbs, updateLightningOrbs,
  isBossLightningLevel, updateChargeVisuals, hideChargeVisuals, clearAllChargeBeamVisuals,
  updateChargeExplosions, updateChargeBeamVisuals, chargeTimeToProgress,
  pointToSegmentDistSq, spawnTransientLightningBolt,
};
