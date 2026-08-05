// ============================================================
//  ALT WEAPONS — 20 special weapons (Issue #196 Phase 3)
//  Extracted from main.js: shields, laser mines, decoys, black
//  holes, nanites, tethers, phase dash, reflector drones, stasis
//  fields, plasma orbs, grenades, proximity mines, attack drones,
//  EMP, teleport + all their pools and active arrays.
//  Reverse dependencies into main.js are injected via
//  initAltWeapons(). NOTE: ES module cycle with projectile-system
//  (both directions, runtime-only usage) — valid for native modules.
// ============================================================

import * as THREE from 'three';
import { game } from './game.js';
import { getAltWeapon } from './weapons.js';
import { getBoss, getEnemies, getEnemyByMesh, getEnemyMeshes, hitBoss, hitEnemy } from './enemies.js';
import { clearAllChargeBeamVisuals, clearAllLightningOrbs, getHandForController } from './beam-weapons.js';
import { initExplosionPool, resetDebrisGlow, spawnExplosionVisual, projectiles, explosionVisuals, explosionPool, _goldColor } from './projectile-system.js';
import { activeVoxels } from './voxel-debris.js';
import { playExplosionSound, playHitSound, playShoothSound } from './audio.js';
import { spawnDamageNumber } from './damage-numbers.js';
import { setActiveStasisFields } from './stasis.js';

// [DEBUG] Mirrors main.js — console.log blocks the render thread on Quest
const DEBUG = false;
const _log = DEBUG ? console.log.bind(console) : () => {};

// ============================================================
// MODULE STATE (moved from main.js — Issue #196 Phase 3)
// ============================================================

// ALT weapon state
export const activeShields = [];  // { mesh, hand, expiresAt }
export const activeLaserMines = [];  // { mesh, armedAt, isArmed, position, triggered, laserMesh, autoDetonateAt }
export const activeStasisFields = [];  // { mesh, position, radius, expiresAt, slowFactor }
export const activePlasmaOrbs = [];  // { mesh, velocity, damage, aoeRadius, expiresAt, detonatable }
const STASIS_FIELD_POOL_SIZE = 3;
const PLASMA_ORB_POOL_SIZE = 4;
const stasisFieldVisualPool = [];
const plasmaOrbVisualPool = [];
let stasisFieldPoolInitialized = false;
let plasmaOrbPoolInitialized = false;

// Phase Dash afterimages
export const activePhaseDashAfterimages = [];  // { mesh, position, expiresAt, damage, aoeRadius }

// Laser mine passive tracking (moved from main.js with spawnLaserMinesPassively)
const playerLastPosition = new THREE.Vector3();
let playerStillnessStartTime = null;
let laserMineSpawnCooldown = 0;

// Scratch objects moved from main.js with their alt-weapon systems (perf:
// reused across frames — no per-frame allocation in the render loop)
// NOTE: _goldColor is imported from projectile-system.js (shared nanite tint)
const _blackColor = new THREE.Color(0x000000);            // nanite un-reveal tint
const _tetherDirection = new THREE.Vector3();             // tether line direction
const _tetherToPlayer = new THREE.Vector3();              // tether yank direction
const _tetherStartPos = new THREE.Vector3();              // tether start (player) pos
const _tetherParticlePos = new THREE.Vector3();           // tether particle pos
const _decoyTargetPos = new THREE.Vector3();              // decoy redirect target
const _orbToEnemy = new THREE.Vector3();                  // plasma orb homing steer
const _shieldPlayerPos = new THREE.Vector3();             // shield follow position
const _evoV3a = new THREE.Vector3();                      // attack drone homing steer
const _hashScratchAfterimages = [];
const _hashScratchOrbHoming = [];
const _hashScratchOrbCollision = [];
const _hashScratchOrbAoe = [];
const _hashScratchGrenade = [];
const _hashScratchMineProximity = [];
const _hashScratchMineAoe = [];

// Decoy system
export const activeDecoys = [];
const MAX_DECOYS = 3;

// Black hole system
export const activeBlackHoles = [];
export const activeMines = [];
const MAX_BLACK_HOLES = 2;
const MAX_MINES = 5;

// Tether harpoon system
export const activeTethers = [];
const MAX_TETHERS = 2;

// Nanite swarm system
export const activeNaniteSwarms = [];
const MAX_NANITE_SWARMS = 2;

// Reflector drone system
export const activeReflectorDrones = [];
const MAX_REFLECTOR_DRONES = 2;
const reflectorDronePool = [];
let reflectorDronePoolInitialized = false;

// ============================================================
// REGISTERED DEPENDENCIES (injected from main.js at init)
// ============================================================
let scene = null;
let camera = null;
let enemySpatialHash = null;
let uiRaycaster = null; // shared raycast scratch (main.js upgrade-select + tether)
// WebXR presenting state (main.js's renderer) — used to skip desktop-only
// effects inside fireTeleport/firePhaseDash
let isXrPresenting = () => false;

// Hooks into main.js systems not yet extracted
let basicMat = (color, opts) => null;
let disposeMesh = () => null;
let handleEnemyKilled = () => null;
let setMaterialEmissiveSafe = () => null;
let triggerScreenShake = () => null;

/**
 * Register runtime dependencies from main.js. Must be called once at init.
 * Also registers this module's activeStasisFields array with stasis.js
 * (getStasisSlowFactor reads it for projectile/enemy slow checks).
 */
export function initAltWeapons(deps) {
  if (!deps) return;
  scene = deps.scene || null;
  camera = deps.camera || null;
  enemySpatialHash = deps.enemySpatialHash || null;
  if (typeof deps.basicMat === 'function') basicMat = deps.basicMat;
  if (typeof deps.isXrPresenting === 'function') isXrPresenting = deps.isXrPresenting;
  if (deps.uiRaycaster) uiRaycaster = deps.uiRaycaster;
  const h = deps.hooks || {};
  if (typeof h.disposeMesh === 'function') disposeMesh = h.disposeMesh;
  if (typeof h.handleEnemyKilled === 'function') handleEnemyKilled = h.handleEnemyKilled;
  if (typeof h.setMaterialEmissiveSafe === 'function') setMaterialEmissiveSafe = h.setMaterialEmissiveSafe;
  if (typeof h.triggerScreenShake === 'function') triggerScreenShake = h.triggerScreenShake;
  // stasis.js keeps its own reference to the active fields array
  setActiveStasisFields(activeStasisFields);
}

function initReflectorDronePool() {
  if (reflectorDronePoolInitialized || !scene) return;

  for (let poolIndex = 0; poolIndex < MAX_REFLECTOR_DRONES; poolIndex++) {
    const droneGroup = new THREE.Group();
    droneGroup.visible = false;

    const hexShape = new THREE.Shape();
    const hexRadius = 0.2;
    for (let i = 0; i < 6; i++) {
      const angle = (i / 6) * Math.PI * 2 - Math.PI / 2;
      const x = Math.cos(angle) * hexRadius;
      const y = Math.sin(angle) * hexRadius;
      if (i === 0) hexShape.moveTo(x, y);
      else hexShape.lineTo(x, y);
    }
    hexShape.closePath();

    const hexGeo = new THREE.ShapeGeometry(hexShape);
    const hexMat = basicMat(0x00ffcc, {
      transparent: true,
      opacity: 0.9,
      side: THREE.DoubleSide,
    });
    const hexMesh = new THREE.Mesh(hexGeo, hexMat);
    hexMesh.rotation.x = Math.PI / 2;
    droneGroup.add(hexMesh);

    const coreGeo = new THREE.SphereGeometry(0.08, 8, 8);
    const coreMat = basicMat(0x00ffcc, {
      transparent: true,
      opacity: 0.8,
    });
    const core = new THREE.Mesh(coreGeo, coreMat);
    core.name = 'reflector-drone-core';
    droneGroup.add(core);

    const shieldGeo = new THREE.SphereGeometry(0.4, 16, 16);
    const shieldMat = basicMat(0x00ffcc, {
      transparent: true,
      opacity: 0.2,
      side: THREE.BackSide,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const shield = new THREE.Mesh(shieldGeo, shieldMat);
    shield.name = 'reflector-drone-shield';
    droneGroup.add(shield);

    const particles = [];
    for (let i = 0; i < 12; i++) {
      const particleGeo = new THREE.SphereGeometry(0.02, 4, 4);
      const particleMat = basicMat(0x00ffaa, {
        transparent: true,
        opacity: 0.7,
      });
      const particle = new THREE.Mesh(particleGeo, particleMat);
      particle.name = 'reflector-drone-particle';
      particle.userData.orbitAngle = (i / 12) * Math.PI * 2;
      particle.userData.orbitRadius = 0.25;
      droneGroup.add(particle);
      particles.push(particle);
    }

    scene.add(droneGroup);
    reflectorDronePool.push({
      mesh: droneGroup,
      hexMesh,
      hexMat,
      coreMat,
      shieldMat,
      particles,
      active: false,
    });
  }

  reflectorDronePoolInitialized = true;
}

function acquireReflectorDroneVisual() {
  initReflectorDronePool();
  for (let i = 0; i < reflectorDronePool.length; i++) {
    const entry = reflectorDronePool[i];
    if (entry.active) continue;
    entry.active = true;
    entry.mesh.visible = true;
    entry.mesh.scale.setScalar(1);
    entry.mesh.rotation.set(0, 0, 0);
    entry.hexMat.opacity = 0.9;
    entry.coreMat.opacity = 0.8;
    entry.shieldMat.opacity = 0.2;
    entry.hexMat.color.setHex(0x00ffcc);
    entry.coreMat.color.setHex(0x00ffcc);
    entry.shieldMat.color.setHex(0x00ffcc);
    for (let j = 0; j < entry.particles.length; j++) {
      entry.particles[j].visible = true;
      entry.particles[j].material.opacity = 0.7;
      entry.particles[j].scale.setScalar(1);
    }
    return entry;
  }
  return null;
}

function releaseReflectorDroneVisual(entry) {
  if (!entry) return;
  entry.active = false;
  entry.mesh.visible = false;
}

const attackDronePool = [];
let attackDronePoolInitialized = false;

function fireAltWeapon(controller, index) {
  const hand = getHandForController(index);
  const altWeaponId = game.altWeapon[hand];
  
  // Check if ALT weapon is equipped
  if (!altWeaponId) {
    // No ALT weapon equipped for this hand
    return;
  }
  
  // Check cooldown
  const now = performance.now();
  if (now < game.altCooldowns[hand]) {
    // Still on cooldown
    return;
  }
  
  const altWeapon = getAltWeapon(altWeaponId);
  if (!altWeapon) {
    console.warn(`Unknown ALT weapon: ${altWeaponId}`);
    return;
  }
  
  // Get controller position and direction
  const origin = new THREE.Vector3();
  const quat = new THREE.Quaternion();
  controller.getWorldPosition(origin);
  controller.getWorldQuaternion(quat);
  const direction = new THREE.Vector3(0, 0, -1).applyQuaternion(quat);
  
  // Execute ALT weapon specific logic
  _log(`[ALT weapon] Firing ${altWeaponId} from ${hand} hand`);
  
  switch (altWeaponId) {
    case 'shield':
      fireShield(controller, index, hand, altWeapon);
      break;

    case 'laser_mine':
      fireLaserMine(controller, index, hand, altWeapon);
      break;
      
    case 'grenade':
      fireGrenade(origin, direction, hand, altWeapon);
      break;

    case 'mine':
      fireProximityMine(origin, hand, altWeapon);
      break;

    case 'drone':
      fireAttackDrone(origin, hand, altWeapon);
      break;

    case 'emp':
      fireEMP(origin, hand, altWeapon);
      break;

    case 'teleport':
      fireTeleport(origin, direction, hand, altWeapon);
      break;

    case 'stasis_field':
      fireStasisField(origin, direction, hand, altWeapon);
      break;

    case 'plasma_orb':
      firePlasmaOrb(origin, direction, hand, altWeapon);
      break;

    case 'decoy':
      fireDecoy(origin, hand, altWeapon);
      break;

    case 'black_hole':
      fireBlackHole(origin, direction, hand, altWeapon);
      break;

    case 'tether_harpoon':
      fireTetherHarpoon(origin, direction, hand, altWeapon);
      break;

    case 'nanite_swarm':
      fireNaniteSwarm(origin, hand, altWeapon);
      break;

    case 'phase_dash':
      firePhaseDash(controller, index, hand, altWeapon, origin, direction);
      break;

    case 'reflector_drone':
      fireReflectorDrone(origin, hand, altWeapon);
      break;

    default:
      console.warn(`Unknown ALT weapon type: ${altWeaponId}`);
      return;
  }
  
  // Set cooldown
  game.altCooldowns[hand] = now + altWeapon.cooldown;
  playShoothSound();  // Placeholder sound
}

// ============================================================
//  SHIELD ALT WEAPON
// ============================================================
// [CORE] Shield weapon system
function fireShield(controller, index, hand, altWeapon) {
  // Get player camera position (shield surrounds player)
  const playerPos = camera.position.clone();
  
  // Create blue translucent sphere around player
  const shieldGeo = new THREE.SphereGeometry(1.2, 24, 24);
  shieldGeo.name = 'shield-sphere';
  const shieldMat = basicMat(0x4488ff, {
    transparent: true,
    opacity: 0.4,
    side: THREE.DoubleSide,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  const shieldMesh = new THREE.Mesh(shieldGeo, shieldMat);
    shieldMesh.name = 'shield-energy';
  shieldMesh.position.copy(playerPos);
  shieldMesh.renderOrder = 500;
  scene.add(shieldMesh);
  
  // Track active shield
  const shieldData = {
    mesh: shieldMesh,
    hand: hand,
    expiresAt: performance.now() + altWeapon.duration,
    position: playerPos.clone(),
    radius: 1.2,
  };
  activeShields.push(shieldData);
  
  _log(`[Shield] Activated for ${altWeapon.duration / 1000}s at ${hand} hand`);
  playShoothSound();
}

// [CORE] Update active shields
function updateShields(now) {
  for (let i = activeShields.length - 1; i >= 0; i--) {
    const shield = activeShields[i];
    
    // Check if expired
    if (now >= shield.expiresAt) {
      disposeMesh(shield.mesh);
      activeShields.splice(i, 1);
      _log('[Shield] Expired');
      continue;
    }
    
    // Make shield follow player
    // Perf: scratch vector instead of camera.position.clone() per shield per frame
    _shieldPlayerPos.copy(camera.position);
    shield.mesh.position.copy(_shieldPlayerPos);
    shield.position.copy(_shieldPlayerPos);
    
    // Fade out effect in last 0.5s
    const remaining = shield.expiresAt - now;
    if (remaining < 500) {
      shield.mesh.material.opacity = 0.4 * (remaining / 500);
    }
    
    // Pulse effect
    const pulse = 1 + Math.sin(now * 0.01) * 0.05;
    shield.mesh.scale.setScalar(pulse);
  }
}

// ============================================================
//  LASER MINE ALT WEAPON (PASSIVE)
// ============================================================

/**
 * Spawn laser mines around player when standing still for 2+ seconds
 * This is called from the update loop, not from trigger press
 */
// [CORE] Laser mine passive spawning
function spawnLaserMinesPassively(playerPos, now, dt) {
  // Check if player has laser mine equipped in either hand
  const leftAlt = game.altWeapon.left;
  const rightAlt = game.altWeapon.right;

  const hasLeftLaserMine = leftAlt === 'laser_mine';
  const hasRightLaserMine = rightAlt === 'laser_mine';

  if (!hasLeftLaserMine && !hasRightLaserMine) {
    playerStillnessStartTime = null;
    return;
  }

  // Track cooldown
  if (laserMineSpawnCooldown > 0) {
    laserMineSpawnCooldown -= dt * 1000;
    return;
  }

  // Check if player is standing still (within 0.3m movement threshold)
  const moveDistance = playerPos.distanceTo(playerLastPosition);
  const STILLNESS_THRESHOLD = 0.3;

  if (moveDistance < STILLNESS_THRESHOLD) {
    // Player is standing still
    if (!playerStillnessStartTime) {
      playerStillnessStartTime = now;
    } else {
      const stillnessDuration = now - playerStillnessStartTime;
      const altWeapon = getAltWeapon('laser_mine');
      const requiredTime = altWeapon.stillnessTime || 2000;

      if (stillnessDuration >= requiredTime) {
        // Spawn mines around player
        const mineCount = altWeapon.mineCount || 3;
        const mineRadius = 1.5; // Distance from player

        for (let i = 0; i < mineCount; i++) {
          const angle = (i / mineCount) * Math.PI * 2;
          const minePos = new THREE.Vector3(
            playerPos.x + Math.cos(angle) * mineRadius,
            0.1,
            playerPos.z + Math.sin(angle) * mineRadius
          );

          // Determine which hand this mine belongs to
          const hand = hasLeftLaserMine ? 'left' : 'right';

          // Spawn the mine
          spawnSingleLaserMine(minePos, hand, altWeapon);
        }

        // Set cooldown and reset stillness tracking
        laserMineSpawnCooldown = 5000; // 5 second cooldown between spawns
        playerStillnessStartTime = null;

        _log(`[Laser Mine] Spawned ${mineCount} passive mines around player`);
      }
    }
  } else {
    // Player moved - reset stillness tracking
    playerStillnessStartTime = null;
  }

  // Update last position
  playerLastPosition.copy(playerPos);
}

/**
 * Spawn a single laser mine at a position
 */
function spawnSingleLaserMine(position, hand, altWeapon) {
  // Check max active mines for this hand
  const handMines = activeLaserMines.filter(m => m.hand === hand);
  if (handMines.length >= (altWeapon.maxActive || 5)) {
    // Remove oldest mine
    const oldest = handMines[0];
    if (oldest.mesh) {
      disposeMesh(oldest.mesh);
    }
    if (oldest.glowMesh) {
      disposeMesh(oldest.glowMesh);
    }
    if (oldest.laserMesh) {
      disposeMesh(oldest.laserMesh);
    }
    const idx = activeLaserMines.indexOf(oldest);
    if (idx >= 0) activeLaserMines.splice(idx, 1);
  }

  // Create purple icosahedron mine
  const mineGeo = new THREE.IcosahedronGeometry(0.12, 0);
  const mineMat = basicMat(0xaa00ff, {
    transparent: true,
    opacity: 0.9,
  });
  const mineMesh = new THREE.Mesh(mineGeo, mineMat);
  mineMesh.position.copy(position);
  mineMesh.renderOrder = 400;
  scene.add(mineMesh);

  // Add outer glow sphere
  const glowGeo = new THREE.SphereGeometry(0.2, 12, 12);
  const glowMat = basicMat(0xaa00ff, {
    transparent: true,
    opacity: 0.3,
    side: THREE.BackSide,
  });
  const glowMesh = new THREE.Mesh(glowGeo, glowMat);
  glowMesh.name = 'laser-mine-glow';
  glowMesh.position.copy(position);
  glowMesh.renderOrder = 399;
  scene.add(glowMesh);

  const now = performance.now();

  // Track active mine
  const mineData = {
    mesh: mineMesh,
    glowMesh: glowMesh,
    hand: hand,
    position: position.clone(),
    placedAt: now,
    armedAt: now + (altWeapon.armTime || 1000),
    autoDetonateAt: now + (altWeapon.autoDetonateTime || 4000),
    isArmed: false,
    triggered: false,
    triggeredAt: null,
    laserMesh: null,
    damage: altWeapon.damage || 50,
    triggerRadius: altWeapon.triggerRadius || 3,
    pulsePhase: Math.random() * Math.PI * 2,
  };
  activeLaserMines.push(mineData);
}

// Legacy function - no longer triggered by squeeze, kept for compatibility
// [CORE] Fire laser mine alt weapon
function fireLaserMine(controller, index, hand, altWeapon) {
  // Laser mines are now passive - no trigger-based firing
  _log('[Laser Mine] Passive weapon - use spawnLaserMinesPassively()');
}

// [CORE] Update laser mines (arming, targeting, detonating)
function updateLaserMines(now, dt) {
  const enemies = getEnemies();

  for (let i = activeLaserMines.length - 1; i >= 0; i--) {
    const mine = activeLaserMines[i];

    // Pulsing glow effect
    if (mine.glowMesh) {
      mine.pulsePhase += dt * 3;
      const pulse = 0.2 + Math.sin(mine.pulsePhase) * 0.15;
      mine.glowMesh.material.opacity = pulse;
      const scale = 1 + Math.sin(mine.pulsePhase) * 0.1;
      mine.glowMesh.scale.setScalar(scale);
    }

    // Rotate mine
    if (mine.mesh) {
      mine.mesh.rotation.x += dt * 0.5;
      mine.mesh.rotation.y += dt * 0.7;
    }

    // Not armed yet
    if (now < mine.armedAt) {
      // Flashing effect while arming
      const flash = Math.sin(now * 0.02) > 0 ? 0.9 : 0.4;
      mine.mesh.material.opacity = flash;
      continue;
    }

    // Just armed
    if (!mine.isArmed) {
      mine.isArmed = true;
      mine.mesh.material.opacity = 1.0;
      mine.mesh.material.color.setHex(0xcc44ff);  // Brighter purple when armed
      _log('[Laser Mine] Armed');
    }

    // Check for auto-detonation
    if (now >= mine.autoDetonateAt && !mine.triggered) {
      triggerLaserMine(mine, null, enemies);
      continue;
    }

    // Already triggered - skip
    if (mine.triggered) continue;

    // Check for enemy proximity
    let nearestEnemy = null;
    let nearestDist = mine.triggerRadius;

    for (const e of enemies) {
      const dist = e.mesh.position.distanceTo(mine.position);
      if (dist < nearestDist) {
        nearestDist = dist;
        nearestEnemy = e;
      }
    }

    // Trigger mine if enemy in range
    if (nearestEnemy) {
      triggerLaserMine(mine, nearestEnemy, enemies);
    }
  }

  // Clean up triggered mines after laser duration
  for (let i = activeLaserMines.length - 1; i >= 0; i--) {
    const mine = activeLaserMines[i];
    if (mine.triggered && mine.triggeredAt && now - mine.triggeredAt > 500) {
      // Remove laser visual after 500ms
      if (mine.laserMesh) {
        disposeMesh(mine.laserMesh);
        mine.laserMesh = null;
      }
      // Remove mine visuals
      if (mine.mesh) {
        disposeMesh(mine.mesh);
      }
      if (mine.glowMesh) {
        disposeMesh(mine.glowMesh);
      }
      activeLaserMines.splice(i, 1);
      _log('[Laser Mine] Cleaned up');
    }
  }
}

// [CORE] Trigger laser mine explosion
function triggerLaserMine(mine, nearestEnemy, allEnemies) {
  mine.triggered = true;
  mine.triggeredAt = performance.now();

  // Explosion sound + visual feedback always fire (mine still "explodes")
  playExplosionSound();
  mine.mesh.material.color.setHex(0xffffff);
  mine.mesh.scale.setScalar(2);

  // Fix: auto-detonation passes nearestEnemy=null (no enemy in range).
  // Previously dereferenced nearestEnemy.mesh unconditionally → TypeError crash.
  if (!nearestEnemy || !nearestEnemy.mesh) return;

  // Create laser beam from mine to nearest enemy
  const start = mine.position.clone();
  start.y = 0.5;  // Mine height
  const end = nearestEnemy.mesh.position.clone();
  
  // Create laser line
  const points = [start, end];
  const laserGeo = new THREE.BufferGeometry().setFromPoints(points);
  const laserMat = new THREE.LineBasicMaterial({
    color: 0xff0000,
    transparent: true,
    opacity: 0.9,
    linewidth: 3,
  });
  const laserMesh = new THREE.Line(laserGeo, laserMat);
  laserMesh.renderOrder = 600;
  scene.add(laserMesh);
  mine.laserMesh = laserMesh;
  
  // Damage all enemies in line (simplified: check distance to line)
  const lineDir = new THREE.Vector3().subVectors(end, start).normalize();
  const lineLength = start.distanceTo(end);
  
  for (const e of allEnemies) {
    const toEnemy = new THREE.Vector3().subVectors(e.mesh.position, start);
    const projection = toEnemy.dot(lineDir);
    
    // Check if enemy is along the laser line
    if (projection >= 0 && projection <= lineLength) {
      const closestPoint = start.clone().addScaledVector(lineDir, projection);
      const distToLine = e.mesh.position.distanceTo(closestPoint);
      
      // Within 0.5m of laser line takes damage
      if (distToLine < 0.5) {
        const enemyIndex = allEnemies.indexOf(e);
        if (enemyIndex >= 0) {
          hitEnemy(enemyIndex, mine.damage);
          spawnDamageNumber(e.mesh.position, mine.damage, '#ff0000');
          _log(`[Laser Mine] Hit enemy for ${mine.damage} damage`);
        }
      }
    }
  }
  
  // Visual feedback on mine
  mine.mesh.material.color.setHex(0xffffff);
  mine.mesh.scale.setScalar(2);
}

// ============================================================
//  DECOY HOLOGRAM IMPLEMENTATION
// ============================================================

// [CORE] Decoy weapon system
function fireDecoy(origin, hand, altWeapon) {
  // Limit active decoys
  if (activeDecoys.length >= MAX_DECOYS) {
    // Remove oldest decoy
    const oldest = activeDecoys.shift();
    destroyDecoy(oldest, false);
  }

  _log(`[ALT] Decoy deployed at ${origin.x.toFixed(2)}, ${origin.y.toFixed(2)}, ${origin.z.toFixed(2)}`);

  // Create holographic copy of player (simple sphere for now)
  const decoyGroup = new THREE.Group();

  // Body - glitchy semi-transparent sphere
  const bodyGeo = new THREE.SphereGeometry(0.4, 12, 12);
  const bodyMat = basicMat(0x00ffaa, {
    transparent: true,
    opacity: 0.6,
    wireframe: true,
  });
  const body = new THREE.Mesh(bodyGeo, bodyMat);
    body.name = 'decoy-body';
  decoyGroup.add(body);

  // Static overlay - glitchy particles
  const staticGeo = new THREE.BufferGeometry();
  const staticCount = 50;
  const staticPositions = new Float32Array(staticCount * 3);
  for (let i = 0; i < staticCount; i++) {
    staticPositions[i * 3] = (Math.random() - 0.5) * 0.8;
    staticPositions[i * 3 + 1] = (Math.random() - 0.5) * 0.8;
    staticPositions[i * 3 + 2] = (Math.random() - 0.5) * 0.8;
  }
  staticGeo.setAttribute('position', new THREE.BufferAttribute(staticPositions, 3));
  const staticMat = new THREE.PointsMaterial({
    color: 0xffffff,
    size: 0.05,
    transparent: true,
    opacity: 0.8,
  });
  const staticParticles = new THREE.Points(staticGeo, staticMat);
  decoyGroup.add(staticParticles);

  // Outer glow
  const glowGeo = new THREE.SphereGeometry(0.6, 12, 12);
  const glowMat = basicMat(0x00ffaa, {
    transparent: true,
    opacity: 0.2,
    side: THREE.BackSide,
  });
  const glow = new THREE.Mesh(glowGeo, glowMat);
  decoyGroup.add(glow);
    glow.name = 'decoy-glow';

  decoyGroup.position.copy(origin);
  decoyGroup.position.y = Math.max(0.5, origin.y);  // Ensure above ground

  // Decoy state
  const decoy = {
    mesh: decoyGroup,
    bodyMat,
    staticParticles,
    glowMat,
    createdAt: performance.now(),
    duration: altWeapon.duration || 8000,
    position: decoyGroup.position.clone(),
    targetingEnemies: new Set(),
    hand,
    explosionDamage: altWeapon.explosionDamage || 30,
    explosionDamagePerTarget: altWeapon.explosionDamagePerTarget || 15,
  };

  scene.add(decoyGroup);
  activeDecoys.push(decoy);

  playShoothSound();
}

// [CORE] Update decoy targets and animations
function updateDecoys(dt, now, playerPos) {
  for (let i = activeDecoys.length - 1; i >= 0; i--) {
    const decoy = activeDecoys[i];
    const age = now - decoy.createdAt;

    // Check if expired
    if (age >= decoy.duration) {
      destroyDecoy(decoy, true);
      activeDecoys.splice(i, 1);
      continue;
    }

    // Glitch effect - random position jitter
    const glitchIntensity = 0.02;
    decoy.mesh.position.x = decoy.position.x + (Math.random() - 0.5) * glitchIntensity;
    decoy.mesh.position.y = decoy.position.y + (Math.random() - 0.5) * glitchIntensity;
    decoy.mesh.position.z = decoy.position.z + (Math.random() - 0.5) * glitchIntensity;

    // Flicker opacity
    const flicker = 0.4 + Math.random() * 0.4;
    decoy.bodyMat.opacity = flicker;
    decoy.glowMat.opacity = flicker * 0.3;

    // Update static particles
    const positions = decoy.staticParticles.geometry.attributes.position.array;
    for (let j = 0; j < positions.length; j += 3) {
      positions[j] = (Math.random() - 0.5) * 0.8;
      positions[j + 1] = (Math.random() - 0.5) * 0.8;
      positions[j + 2] = (Math.random() - 0.5) * 0.8;
    }
    decoy.staticParticles.geometry.attributes.position.needsUpdate = true;

    // Attract enemies - find enemies targeting this decoy
    decoy.targetingEnemies.clear();
    const enemies = getEnemies();
    enemies.forEach((e, idx) => {
      const distToDecoy = e.mesh.position.distanceTo(decoy.position);
      const distToPlayer = e.mesh.position.distanceTo(playerPos);

      // Enemy targets decoy if it's closer than player (with some leeway)
      if (distToDecoy < distToPlayer * 1.2 && distToDecoy < 15) {
        decoy.targetingEnemies.add(idx);

        // Redirect enemy toward decoy (note: direction math removed — original
        // normalized a throwaway vector; enemies follow e.targetPosition)
        // Perf: scratch vector instead of decoy.position.clone() per enemy per frame
        e.targetPosition = _decoyTargetPos.copy(decoy.position);
      }
    });

    // Check if decoy is "destroyed" by nearby enemies
    // Perf: in-place scan instead of enemies.filter() allocating a new array
    let decoyDestroyed = false;
    for (let ei = 0; ei < enemies.length; ei++) {
      if (enemies[ei].mesh.position.distanceTo(decoy.position) < 0.8) {
        decoyDestroyed = true;
        break;
      }
    }
    if (decoyDestroyed) {
      destroyDecoy(decoy, true);
      activeDecoys.splice(i, 1);
    }
  }
}

// [CORE] Destroy decoy with optional explosion
function destroyDecoy(decoy, explode) {
  if (explode) {
    // Calculate explosion damage based on enemies targeting it
    const targetCount = decoy.targetingEnemies.size;
    const totalDamage = decoy.explosionDamage + (targetCount * decoy.explosionDamagePerTarget);

    _log(`[Decoy] Destroyed! Targets: ${targetCount}, Total damage: ${totalDamage}`);

    // Damage nearby enemies
    const enemies = getEnemies();
    enemies.forEach((e, idx) => {
      const dist = e.mesh.position.distanceTo(decoy.position);
      if (dist < 3) {
        const damageMultiplier = 1 - (dist / 3);  // More damage closer to decoy
        const damage = Math.round(totalDamage * damageMultiplier);
        const result = hitEnemy(idx, damage);
        spawnDamageNumber(e.mesh.position, damage, '#00ffaa');
        playExplosionSound();

        handleEnemyKilled(idx);
      }
    });

    // Visual explosion
    spawnExplosionVisual(decoy.position, 2);
    triggerScreenShake(0.2, 200);
  }

  // Clean up mesh
  disposeMesh(decoy.mesh);
}

// ============================================================
//  BLACK HOLE (SINGULARITY MINE) IMPLEMENTATION
// ============================================================

// [CORE] Black hole weapon system
function fireBlackHole(origin, direction, hand, altWeapon) {
  // Limit active mines
  if (activeMines.length >= MAX_MINES) {
    // Remove oldest mine
    const oldest = activeMines.shift();
    disposeMesh(oldest.mesh);
  }

  _log(`[ALT] Black hole mine thrown from ${hand} hand`);

  // Create mine projectile
  const mineGeo = new THREE.SphereGeometry(0.15, 8, 8);
  const mineMat = basicMat(0x8800ff, {
    transparent: true,
    opacity: 0.9,
  });
  const mine = new THREE.Mesh(mineGeo, mineMat);
    mine.name = 'black-hole-mine';

  // Add glow
  const glowGeo = new THREE.SphereGeometry(0.25, 8, 8);
  const glowMat = basicMat(0x8800ff, {
    transparent: true,
    opacity: 0.3,
    side: THREE.BackSide,
  });
  const glow = new THREE.Mesh(glowGeo, glowMat);
  glow.name = 'black-hole-mine';
  mine.add(glow);

  mine.position.copy(origin);

  const mineData = {
    mesh: mine,
    glowMat,
    velocity: direction.clone().multiplyScalar(8),  // Toss speed
    createdAt: performance.now(),
    hand,
    armed: false,
    armTime: 1000,  // 1 second to arm
    triggerRadius: altWeapon.triggerRadius || 2,
    blackHoleDuration: altWeapon.duration || 2000,
    damage: altWeapon.damage || 40,
    pullRadius: altWeapon.pullRadius || 5,
    stunDuration: altWeapon.stunDuration || 1000,
  };

  scene.add(mine);
  activeMines.push(mineData);

  playShoothSound();
}

// Pooled temp vector for black hole pull (per-enemy per-frame)
const _bhPullToCenter = new THREE.Vector3();
// Perf: scratch parallel arrays for black-hole pull damage (avoids per-frame
// `affectedEnemies = []` + {index, enemy, dist} object literals)
const _bhAffectedIdx = [];
const _bhAffectedEnemy = [];
const _bhAffectedDist = [];

// [CORE] Update mines and black holes
function updateMinesAndBlackHoles(dt, now, playerPos) {
  // Update mines (projectiles that haven't triggered yet)
  for (let i = activeMines.length - 1; i >= 0; i--) {
    const mine = activeMines[i];
    const age = now - mine.createdAt;

    // Move mine (with gravity)
    mine.velocity.y -= 9.8 * dt;  // Gravity
    mine.mesh.position.addScaledVector(mine.velocity, dt);

    // Ground collision
    if (mine.mesh.position.y < 0.15) {
      mine.mesh.position.y = 0.15;
      mine.velocity.set(0, 0, 0);
    }

    // Check if armed
    if (!mine.armed && age >= mine.armTime) {
      mine.armed = true;
      mine.mesh.material.color.setHex(0xff00ff);  // Change color when armed
      _log('[Mine] Armed!');
    }

    // Check for proximity trigger (if armed)
    if (mine.armed) {
      const enemies = getEnemies();
      for (const e of enemies) {
        const dist = e.mesh.position.distanceTo(mine.mesh.position);
        if (dist < mine.triggerRadius) {
          // Trigger black hole!
          triggerBlackHole(mine, i);
          break;
        }
      }
    }

    // Pulse glow
    const pulse = 0.3 + Math.sin(age * 0.01) * 0.15;
    mine.glowMat.opacity = pulse;
  }

  // Update active black holes
  for (let i = activeBlackHoles.length - 1; i >= 0; i--) {
    const bh = activeBlackHoles[i];
    const age = now - bh.createdAt;

    // Check if expired
    if (age >= bh.duration) {
      destroyBlackHole(bh);
      activeBlackHoles.splice(i, 1);
      continue;
    }

    // Progress through duration
    const progress = age / bh.duration;

    // Pull enemies toward center
    const enemies = getEnemies();
    // Perf: scratch arrays instead of allocating a fresh array + objects per
    // black hole per frame (only used transiently for the end-of-life damage)
    _bhAffectedIdx.length = 0;
    _bhAffectedEnemy.length = 0;
    _bhAffectedDist.length = 0;
    const affectedEnemies = _bhAffectedIdx;

    for (let ei = 0; ei < enemies.length; ei++) {
      const e = enemies[ei];
      const dist = e.mesh.position.distanceTo(bh.position);
      if (dist < bh.pullRadius) {
        _bhAffectedIdx.push(ei);
        _bhAffectedEnemy.push(e);
        _bhAffectedDist.push(dist);

        // Pull strength increases toward center, fades at end
        const pullStrength = (1 - dist / bh.pullRadius) * (1 - progress * 0.5) * 8;
        _bhPullToCenter.subVectors(bh.position, e.mesh.position).normalize();
        e.mesh.position.addScaledVector(_bhPullToCenter, pullStrength * dt);

        // Record that this enemy was affected (for stun)
        if (!bh.affectedEnemies.has(ei)) {
          bh.affectedEnemies.add(ei);
        }
      }
    }

    // Visual rotation and pulse
    bh.mesh.rotation.y += dt * 3;
    bh.mesh.rotation.z += dt * 2;

    // Inner vortex rotation
    if (bh.innerRing) {
      bh.innerRing.rotation.z -= dt * 5;
    }

    // Particle spiral effect
    const particlePositions = bh.particles.geometry.attributes.position.array;
    for (let j = 0; j < particlePositions.length; j += 3) {
      const angle = Math.atan2(particlePositions[j + 2], particlePositions[j]);
      const radius = Math.sqrt(particlePositions[j] ** 2 + particlePositions[j + 2] ** 2);
      const newAngle = angle + dt * 3;
      const newRadius = Math.max(0.3, radius - dt * 0.5);  // Spiral inward

      particlePositions[j] = Math.cos(newAngle) * newRadius;
      particlePositions[j + 2] = Math.sin(newAngle) * newRadius;
      particlePositions[j + 1] += (Math.random() - 0.5) * dt * 2;
    }
    bh.particles.geometry.attributes.position.needsUpdate = true;

    // Apply damage when black hole ends
    if (progress >= 0.9 && !bh.damageApplied) {
      bh.damageApplied = true;

      affectedEnemies.forEach((index, ai) => {
        const enemy = _bhAffectedEnemy[ai];
        const dist = _bhAffectedDist[ai];
        const damageMultiplier = 1 - (dist / bh.pullRadius);
        const damage = Math.round(bh.damage * damageMultiplier);
        const result = hitEnemy(index, damage);
        spawnDamageNumber(enemy.mesh.position, damage, '#8800ff');
        playHitSound();

        handleEnemyKilled(index);
      });
    }
  }
}

// [CORE] Trigger black hole collapse
function triggerBlackHole(mine, mineIndex) {
  _log('[Black Hole] Triggered!');

  // Remove mine
  disposeMesh(mine.mesh);
  activeMines.splice(mineIndex, 1);

  // Limit active black holes
  if (activeBlackHoles.length >= MAX_BLACK_HOLES) {
    const oldest = activeBlackHoles.shift();
    destroyBlackHole(oldest);
  }

  buildBlackHole(mine.mesh.position, {
    duration: mine.blackHoleDuration,
    damage: mine.damage,
    pullRadius: mine.pullRadius,
    stunDuration: mine.stunDuration,
  });

  playExplosionSound();
  triggerScreenShake(0.4, 300);
}

// [CORE] Build a black hole entity (shared by the mine alt-weapon and the
// Final Solution combo). Creates the visual, registers with activeBlackHoles
// (updateBlackHoles drives pull + collapse), returns the entity.
function buildBlackHole(position, opts) {
  // Create black hole visual
  const bhGroup = new THREE.Group();

  // Core - dark sphere
  const coreGeo = new THREE.SphereGeometry(0.3, 16, 16);
  coreGeo.name = 'black-hole-core-geo';
  const coreMat = basicMat(0x110022, {
    transparent: true,
    opacity: 0.9,
  });
  const core = new THREE.Mesh(coreGeo, coreMat);
  core.name = 'black-hole-core';
  bhGroup.add(core);

  // Outer ring - purple vortex
  const ringGeo = new THREE.RingGeometry(0.4, 1.5, 32);
  const ringMat = basicMat(0x8800ff, {
    transparent: true,
    opacity: 0.6,
    side: THREE.DoubleSide,
  });
  const ring = new THREE.Mesh(ringGeo, ringMat);
  ring.name = 'black-hole-core';
  ring.rotation.x = Math.PI / 2;
  bhGroup.add(ring);

  // Inner spinning ring
  const innerRingGeo = new THREE.RingGeometry(0.3, 0.5, 16);
  const innerRingMat = basicMat(0xaa44ff, {
    transparent: true,
    opacity: 0.8,
    side: THREE.DoubleSide,
  });
  const innerRing = new THREE.Mesh(innerRingGeo, innerRingMat);
  innerRing.rotation.x = Math.PI / 2;
  bhGroup.add(innerRing);

  // Particle spiral
  const particleCount = 100;
  const particleGeo = new THREE.BufferGeometry();
  const particlePositions = new Float32Array(particleCount * 3);
  for (let j = 0; j < particleCount; j++) {
    const angle = (j / particleCount) * Math.PI * 6;  // 3 spirals
    const radius = 0.3 + (j / particleCount) * 1.2;
    particlePositions[j * 3] = Math.cos(angle) * radius;
    particlePositions[j * 3 + 1] = (Math.random() - 0.5) * 0.5;
    particlePositions[j * 3 + 2] = Math.sin(angle) * radius;
  }
  particleGeo.setAttribute('position', new THREE.BufferAttribute(particlePositions, 3));
  const particleMat = new THREE.PointsMaterial({
    color: 0xcc88ff,
    size: 0.08,
    transparent: true,
    opacity: 0.8,
  });
  const particles = new THREE.Points(particleGeo, particleMat);
  bhGroup.add(particles);

  // Event horizon glow
  const glowGeo = new THREE.SphereGeometry(1.8, 16, 16);
  const glowMat = basicMat(0x4400aa, {
    transparent: true,
    opacity: 0.3,
    side: THREE.BackSide,
  });
  const glow = new THREE.Mesh(glowGeo, glowMat);
  glow.name = 'black-hole-mine-glow';
  bhGroup.add(glow);

  bhGroup.position.copy(position);
  bhGroup.position.y = 0.5;

  const blackHole = {
    mesh: bhGroup,
    innerRing,
    particles,
    glowMat,
    ringMat,
    position: bhGroup.position.clone(),
    createdAt: performance.now(),
    duration: opts.duration,
    damage: opts.damage,
    pullRadius: opts.pullRadius,
    stunDuration: opts.stunDuration,
    affectedEnemies: new Set(),
    damageApplied: false,
  };

  scene.add(bhGroup);
  activeBlackHoles.push(blackHole);

  return blackHole;
}

/**
 * Spawn a black hole at a world position (Final Solution combo, Issue #211).
 * Shares the mine black hole's visual + updateBlackHoles pull/collapse logic.
 * @param {THREE.Vector3} position - world position (y lifted to 0.5)
 * @param {Object} opts - { duration, damage, pullRadius, stunDuration }
 */
export function spawnBlackHoleAt(position, opts = {}) {
  const blackHole = buildBlackHole(position, {
    duration: opts.duration ?? 2000,
    damage: opts.damage ?? 60,
    pullRadius: opts.pullRadius ?? 6,
    stunDuration: opts.stunDuration ?? 0.8,
  });
  if (!blackHole) return null;
  playExplosionSound();
  triggerScreenShake(0.4, 300);
  return blackHole;
}

// [CORE] Destroy black hole and cleanup
function destroyBlackHole(bh) {
  _log('[Black Hole] Collapsed!');

  // Apply stun to affected enemies
  const enemies = getEnemies();
  bh.affectedEnemies.forEach(idx => {
    if (enemies[idx]) {
      // Apply stun effect
      if (!enemies[idx].statusEffects) {
        enemies[idx].statusEffects = { stun: { stacks: 0, timer: 0 } };
      }
      if (!enemies[idx].statusEffects.stun) {
        enemies[idx].statusEffects.stun = { stacks: 0, timer: 0 };
      }
      enemies[idx].statusEffects.stun.stacks += 1;
      enemies[idx].statusEffects.stun.timer = Math.max(
        enemies[idx].statusEffects.stun.timer,
        bh.stunDuration
      );
    }
  });

  // Visual collapse
  spawnExplosionVisual(bh.position, 1.5);

  // Clean up mesh
  // Clean up mesh
  disposeMesh(bh.mesh);
}

// ============================================================
//  NANITE SWARM IMPLEMENTATION
// ============================================================

// [CORE] Nanite swarm weapon system
function fireNaniteSwarm(origin, hand, altWeapon) {
  // Limit active swarms
  if (activeNaniteSwarms.length >= MAX_NANITE_SWARMS) {
    // Check if there's already an active swarm from this hand - recall it
    const existingIndex = activeNaniteSwarms.findIndex(s => s.hand === hand);
    if (existingIndex >= 0) {
      // Recall early - remove existing swarm
      const swarm = activeNaniteSwarms[existingIndex];
      destroyNaniteSwarm(swarm);
      activeNaniteSwarms.splice(existingIndex, 1);
      _log('[Nanite Swarm] Recalled early from', hand, 'hand');
    } else {
      // Remove oldest swarm
      const oldest = activeNaniteSwarms.shift();
      destroyNaniteSwarm(oldest);
    }
  }

  _log(`[ALT] Nanite Swarm deployed from ${hand} hand`);

  // Create golden shimmering cloud at player position
  const swarmGroup = new THREE.Group();

  // Core sphere - golden glow
  const coreGeo = new THREE.SphereGeometry(0.2, 12, 12);
  const coreMat = basicMat(0xffd700, {
    transparent: true,
    opacity: 0.4,
    blending: THREE.AdditiveBlending,
  });
  const core = new THREE.Mesh(coreGeo, coreMat);
  core.name = 'nanite-swarm-core';
  swarmGroup.add(core);

  // Outer glow sphere
  const glowGeo = new THREE.SphereGeometry(altWeapon.radius || 3.0, 24, 24);
  const glowMat = basicMat(0xffaa00, {
    transparent: true,
    opacity: 0.15,
    side: THREE.BackSide,
    blending: THREE.AdditiveBlending,
  });
  const glow = new THREE.Mesh(glowGeo, glowMat);
  glow.name = 'nanite-swarm-core';
  swarmGroup.add(glow);

  // Glitter particles - golden sparkles
  const particleCount = 80;
  const particles = [];
  for (let i = 0; i < particleCount; i++) {
    const particleGeo = new THREE.SphereGeometry(0.03, 4, 4);
    const particleMat = basicMat(0xffff00, {
      transparent: true,
      opacity: 0.8,
      blending: THREE.AdditiveBlending,
    });
    const particle = new THREE.Mesh(particleGeo, particleMat);
    particle.name = 'nanite-swarm-particle';

    // Random position within sphere
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.acos(2 * Math.random() - 1);
    const r = (altWeapon.radius || 3.0) * Math.pow(Math.random(), 0.5);
    particle.position.x = r * Math.sin(phi) * Math.cos(theta);
    particle.position.y = r * Math.sin(phi) * Math.sin(theta);
    particle.position.z = r * Math.cos(phi);

    swarmGroup.add(particle);
    particles.push({
      mesh: particle,
      angle: Math.random() * Math.PI * 2,
      speed: 0.3 + Math.random() * 0.5,
      radius: r,
      phi,
      theta,
      verticalSpeed: (Math.random() - 0.5) * 0.5,
    });
  }

  // Position at player location (use camera position for desktop, controller for VR)
  const playerPos = camera.position.clone();
  swarmGroup.position.copy(playerPos);
  swarmGroup.position.y = 1.0; // Hip height

  // Swarm data
  const swarm = {
    mesh: swarmGroup,
    coreMat,
    glowMat,
    particles,
    hand,
    createdAt: performance.now(),
    expiresAt: performance.now() + (altWeapon.duration || 10000),
    duration: altWeapon.duration || 10000,
    dotDamage: altWeapon.dotDamage || 5,
    radius: altWeapon.radius || 3.0,
    position: swarmGroup.position.clone(),
    affectedEnemies: new Set(),
    lastDotTick: performance.now(),
  };

  scene.add(swarmGroup);
  activeNaniteSwarms.push(swarm);

  playShoothSound();
}

// [CORE] Update nanite swarms
function updateNaniteSwarms(now, dt, playerPos) {
  for (let i = activeNaniteSwarms.length - 1; i >= 0; i--) {
    const swarm = activeNaniteSwarms[i];
    const age = now - swarm.createdAt;

    // Check if expired
    if (age >= swarm.duration) {
      destroyNaniteSwarm(swarm);
      activeNaniteSwarms.splice(i, 1);
      _log('[Nanite Swarm] Expired');
      continue;
    }

    // Animate particles - swirling glitter effect
    // GPU optimization: update twinkle opacity every 3 frames instead of every frame
    const twinkleFrame = Math.floor(now / 50) % 3 === 0;
    swarm.particles.forEach(p => {
      // Update angle for rotation
      p.angle += p.speed * dt;
      p.phi += p.verticalSpeed * dt * 0.1;

      // Calculate new position
      p.mesh.position.x = p.radius * Math.sin(p.phi) * Math.cos(p.angle);
      p.mesh.position.y = p.radius * Math.sin(p.phi) * Math.sin(p.angle);
      p.mesh.position.z = p.radius * Math.cos(p.phi);

      // Twinkle effect - GPU optimization: throttle to every 3rd frame (~20fps twinkle)
      if (twinkleFrame) {
        p.mesh.material.opacity = 0.3 + Math.sin(now * 0.01 + p.angle) * 0.5;
      }
    });

    // Pulse the core
    const pulse = 1 + Math.sin(age * 0.003) * 0.1;
    swarm.mesh.children[0].scale.setScalar(pulse); // Core pulse

    // Pulsing glow opacity
    const glowPulse = 0.15 + Math.sin(age * 0.005) * 0.05;
    swarm.glowMat.opacity = glowPulse;

    // Apply DoT to enemies in cloud every second
    const enemies = getEnemies();
    const dotInterval = 1000; // 1 second between DoT ticks

    if (now - swarm.lastDotTick >= dotInterval) {
      swarm.lastDotTick = now;

      enemies.forEach((e, index) => {
        const dist = e.mesh.position.distanceTo(swarm.position);
        if (dist < swarm.radius) {
          // Apply DoT damage
          const result = hitEnemy(index, swarm.dotDamage);
          spawnDamageNumber(e.mesh.position, swarm.dotDamage, '#ffd700');
          playHitSound();

          // Mark enemy as revealed - add sparkle effect
          if (!e._naniteRevealed) {
            e._naniteRevealed = true;
            // Add visible outline through walls
            if (e.mesh.material) {
              // Perf: module scratch Color (was new THREE.Color per enemy per frame)
              setMaterialEmissiveSafe(e.mesh.material, _goldColor, 0.5);
            }
          }

          // Track affected enemy
          if (!swarm.affectedEnemies.has(index)) {
            swarm.affectedEnemies.add(index);
          }

          // Check if killed by DoT
          handleEnemyKilled(index);
        }
      });
    }

    // Reveal enemies in range - show them through walls
    enemies.forEach((e, index) => {
      const dist = e.mesh.position.distanceTo(swarm.position);
      if (dist < swarm.radius) {
        e._naniteRevealed = true;
        if (e.mesh.material && !e.mesh._originalOpacity) {
          e.mesh._originalOpacity = e.mesh.material.opacity;
        }
        if (e.mesh.material) {
          setMaterialEmissiveSafe(e.mesh.material, _goldColor, 0.5);
        }
      }
    });
  }
}

// [CORE] Destroy nanite swarm
function destroyNaniteSwarm(swarm) {
  _log('[Nanite Swarm] Destroyed');

  // Clear reveal effect from enemies
  const enemies = getEnemies();
  enemies.forEach(e => {
    if (e._naniteRevealed) {
      e._naniteRevealed = false;
      if (e.mesh.material) {
        // Perf: module scratch Color (was new THREE.Color per enemy on destroy)
        setMaterialEmissiveSafe(e.mesh.material, _blackColor, 0);
      }
    }
  });

  // Remove mesh
  disposeMesh(swarm.mesh);
}

// Check if projectile passes through nanite swarm and add damage
// [CORE] Check projectile-nanite interaction
function checkProjectileNaniteInteraction(proj) {
  for (const swarm of activeNaniteSwarms) {
    if (proj.position.distanceToSquared(swarm.position) < swarm.radius * swarm.radius && !proj.userData.naniteInfused) {
      // Projectile carries nanites - mark it
      proj.userData.naniteInfused = true;
      proj.userData.naniteSwarm = swarm;
      // Visual: change projectile color slightly golden
      if (proj.children && proj.children[0]) {
        proj.children[0].material.color.setHex(0xffcc00);
      }
      break;
    }
  }

  return proj.userData.naniteInfused;
}

// ============================================================
//  TETHER HARPOON IMPLEMENTATION
// ============================================================

// [CORE] Tether harpoon weapon system
function fireTetherHarpoon(origin, direction, hand, altWeapon) {
  // Raycast to find enemy within range
  uiRaycaster.set(origin, direction, 0, altWeapon.range);
  const enemyMeshes = getEnemyMeshes(true);
  const hits = uiRaycaster.intersectObjects(enemyMeshes, true);

  if (hits.length === 0) {
    _log('[Tether Harpoon] No target in range');
    return;  // No target
  }

  // Find the enemy from the hit mesh
  const result = getEnemyByMesh(hits[0].object);
  if (!result || result.index === undefined) {
    _log('[Tether Harpoon] Hit but no enemy found');
    return;
  }

  const enemy = result.enemy;
  const enemyIndex = result.index;

  // Check if this enemy is already tethered
  const alreadyTethered = activeTethers.some(t => t.enemyIndex === enemyIndex);
  if (alreadyTethered) {
    _log('[Tether Harpoon] Enemy already tethered');
    return;
  }

  // Limit active tethers
  if (activeTethers.length >= MAX_TETHERS) {
    const oldest = activeTethers.shift();
    destroyTether(oldest);
  }

  _log(`[Tether Harpoon] Connected to enemy ${enemyIndex}!`);

  // Create green energy rope visual
  const tetherGroup = new THREE.Group();

  // Main tether line
  const tetherGeo = new THREE.BufferGeometry();
  const positions = new Float32Array(6);  // 2 points * 3 coords
  tetherGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  const tetherMat = new THREE.LineBasicMaterial({
    color: 0x00ff88,
    transparent: true,
    opacity: 0.9,
    linewidth: 2,
  });
  const tetherLine = new THREE.Line(tetherGeo, tetherMat);
  tetherGroup.add(tetherLine);

  // Glow effect
  const glowGeo = new THREE.BufferGeometry();
  glowGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(6), 3));
  const glowMat = new THREE.LineBasicMaterial({
    color: 0x00ff88,
    transparent: true,
    opacity: 0.3,
    linewidth: 4,
  });
  const glowLine = new THREE.Line(glowGeo, glowMat);
  tetherGroup.add(glowLine);

  // Energy particles along tether
  const particleCount = 10;
  const particles = [];
  for (let i = 0; i < particleCount; i++) {
    const particleGeo = new THREE.SphereGeometry(0.03, 4, 4);
    const particleMat = basicMat(0x00ffaa, {
      transparent: true,
      opacity: 0.7,
    });
    const particle = new THREE.Mesh(particleGeo, particleMat);
    particle.name = 'tether-particle';
    particle.userData.offset = i / particleCount;
    particle.userData.speed = 1 + Math.random();
    tetherGroup.add(particle);
    particles.push(particle);
  }

  scene.add(tetherGroup);

  // Create tether data
  const tether = {
    mesh: tetherGroup,
    line: tetherLine,
    glowLine,
    particles,
    lineGeo: tetherGeo,
    glowGeo,
    hand,
    enemyIndex,
    enemy,
    createdAt: performance.now(),
    duration: altWeapon.tetherDuration || 8000,
    damage: altWeapon.damage || 25,
    yankForce: altWeapon.yankForce || 12,
    lastCollisionTime: 0,
    yankActive: false,
    yankStartTime: 0,
  };

  activeTethers.push(tether);
  playShoothSound();
}

// [CORE] Update active tethers
function updateTethers(dt, now, playerPos) {
  const enemies = getEnemies();

  for (let i = activeTethers.length - 1; i >= 0; i--) {
    const tether = activeTethers[i];
    const age = now - tether.createdAt;

    // Check if expired
    if (age >= tether.duration) {
      destroyTether(tether);
      activeTethers.splice(i, 1);
      continue;
    }

    // Check if enemy still exists
    const enemy = enemies[tether.enemyIndex];
    if (!enemy) {
      destroyTether(tether);
      activeTethers.splice(i, 1);
      continue;
    }

    // Update tether line positions
    // Perf: scratch vectors instead of clone() per tether per frame
    _tetherStartPos.copy(playerPos);
    _tetherStartPos.y = Math.max(0.5, _tetherStartPos.y);  // Clamp to reasonable height
    const start = _tetherStartPos;
    const end = enemy.mesh.position;  // read-only reference for the line endpoints

    // Update main line
    const positions = tether.lineGeo.attributes.position.array;
    positions[0] = start.x;
    positions[1] = start.y;
    positions[2] = start.z;
    positions[3] = end.x;
    positions[4] = end.y;
    positions[5] = end.z;
    tether.lineGeo.attributes.position.needsUpdate = true;

    // Update glow line
    const glowPositions = tether.glowGeo.attributes.position.array;
    glowPositions[0] = start.x;
    glowPositions[1] = start.y;
    glowPositions[2] = start.z;
    glowPositions[3] = end.x;
    glowPositions[4] = end.y;
    glowPositions[5] = end.z;
    tether.glowGeo.attributes.position.needsUpdate = true;

    // Animate particles along tether
    const tetherLength = start.distanceTo(end);
    _tetherDirection.subVectors(end, start);
    const tetherLengthSafe = _tetherDirection.length();
    if (tetherLengthSafe > 1e-6) _tetherDirection.divideScalar(tetherLengthSafe);

    tether.particles.forEach(p => {
      const t = ((now * 0.001 * p.userData.speed + p.userData.offset) % 1);
      _tetherParticlePos.copy(start).addScaledVector(_tetherDirection, t * tetherLength);
      p.position.copy(_tetherParticlePos);
      p.material.opacity = 0.7 * Math.sin(t * Math.PI);  // Fade at ends
    });

    // Calculate tether tension (stretch factor)
    const restLength = 3.0;  // Comfortable tether length
    const stretch = Math.max(0, tetherLength - restLength);

    // Yank mechanic: pull enemy toward player when stretched
    if (stretch > 0) {
      const pullStrength = Math.min(1, stretch / 5) * tether.yankForce * dt;
      _tetherToPlayer.subVectors(start, end);
      const yankLen = _tetherToPlayer.length();
      if (yankLen > 1e-6) _tetherToPlayer.divideScalar(yankLen);
      enemy.mesh.position.addScaledVector(_tetherToPlayer, pullStrength);
    }

    // Collision damage: check if tethered enemy hits other enemies
    const collisionCooldown = 500;  // 500ms between collision damage
    if (now - tether.lastCollisionTime > collisionCooldown) {
      for (let j = 0; j < enemies.length; j++) {
        if (j === tether.enemyIndex) continue;

        const otherEnemy = enemies[j];
        const dist = enemy.mesh.position.distanceTo(otherEnemy.mesh.position);

        if (dist < 1.0) {  // Collision radius
          // Apply collision damage to both enemies
          hitEnemy(tether.enemyIndex, tether.damage);
          hitEnemy(j, tether.damage * 0.5);  // Half damage to other enemy

          spawnDamageNumber(enemy.mesh.position, tether.damage, '#00ff88');
          spawnDamageNumber(otherEnemy.mesh.position, tether.damage * 0.5, '#00ff88');

          playHitSound();
          tether.lastCollisionTime = now;

          // Check if killed
          if (enemy.hp <= 0) {
            handleEnemyKilled(tether.enemyIndex);
            destroyTether(tether);
            activeTethers.splice(i, 1);
            break;
          }

          // Visual feedback
          spawnExplosionVisual(enemy.mesh.position, 0.5);
        }
      }
    }

    // Pulse opacity based on age (fade out near end)
    const fadeStart = tether.duration * 0.8;
    if (age > fadeStart) {
      const fadeProgress = (age - fadeStart) / (tether.duration - fadeStart);
      tether.line.material.opacity = 0.9 * (1 - fadeProgress);
      tether.glowLine.material.opacity = 0.3 * (1 - fadeProgress);
    }
  }
}

// [CORE] Destroy tether and cleanup
function destroyTether(tether) {
  disposeMesh(tether.mesh);
  _log('[Tether Harpoon] Tether destroyed');
}

// ============================================================
//  PHASE DASH
// ============================================================

/**
 * Fire Phase Dash - instant teleport in movement direction
 * Leaves explosive afterimage that detonates after 1 second
 * Damages enemies in dash path
 */
// [CORE] Phase dash weapon system
function firePhaseDash(controller, index, hand, altWeapon, origin, direction) {
  _log(`[Phase Dash] Teleporting ${hand} hand`);

  const dashDistance = altWeapon.dashDistance || 5;
  const afterimageDamage = altWeapon.afterimageDamage || 40;
  const afterimageDelay = altWeapon.afterimageDelay || 1000;

  // Get player position (camera position)
  const playerPos = camera.position.clone();
  const oldPosition = playerPos.clone();

  // Calculate teleport destination
  // Dash in movement direction (controller aim direction)
  const destination = playerPos.clone().addScaledVector(direction, dashDistance);

  // Clamp destination to ground level
  destination.y = Math.max(0.5, destination.y);

  // Teleport player (desktop only - in VR, WebXR controls camera position)
  if (!isXrPresenting()) {
    camera.position.copy(destination);
    _log(`[Phase Dash] Teleported from (${oldPosition.x.toFixed(2)}, ${oldPosition.y.toFixed(2)}, ${oldPosition.z.toFixed(2)}) to (${destination.x.toFixed(2)}, ${destination.y.toFixed(2)}, ${destination.z.toFixed(2)})`);
  } else {
    _log(`[Phase Dash] VR mode - teleport visual only (WebXR controls camera)`);
  }

  // Create blue ghostly afterimage at old position
  const afterimageGroup = new THREE.Group();

  // Main afterimage shell (semi-transparent sphere)
  const shellGeo = new THREE.SphereGeometry(0.4, 16, 16);
  const shellMat = basicMat(0x4488ff, {
    transparent: true,
    opacity: 0.6,
    side: THREE.DoubleSide,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  const shell = new THREE.Mesh(shellGeo, shellMat);
    shell.name = 'phase-dash-shell';
  afterimageGroup.add(shell);

  // Pixel dissolution effect (small cubes)
  const pixelCount = 20;
  const pixels = [];
  for (let i = 0; i < pixelCount; i++) {
    const pixelGeo = new THREE.BoxGeometry(0.08, 0.08, 0.08);
    const pixelMat = basicMat(0x88ccff, {
      transparent: true,
      opacity: 0.7,
    });
    const pixel = new THREE.Mesh(pixelGeo, pixelMat);

    // Random position around the shell
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.acos(2 * Math.random() - 1);
    const r = 0.4 + Math.random() * 0.2;
    pixel.position.x = r * Math.sin(phi) * Math.cos(theta);
    pixel.position.y = r * Math.sin(phi) * Math.sin(theta);
    pixel.position.z = r * Math.cos(phi);

    afterimageGroup.add(pixel);
    pixels.push({
      mesh: pixel,
      velocity: new THREE.Vector3(
        (Math.random() - 0.5) * 2,
        (Math.random() - 0.5) * 2,
        (Math.random() - 0.5) * 2
      ),
    });
  }

  afterimageGroup.position.copy(oldPosition);
  afterimageGroup.position.y = Math.max(0.5, oldPosition.y);

  scene.add(afterimageGroup);

  // Add to active afterimages
  const afterimageData = {
    mesh: afterimageGroup,
    shell,
    pixels,
    position: oldPosition.clone(),
    damage: afterimageDamage,
    aoeRadius: 2.0,
    createdAt: performance.now(),
    expiresAt: performance.now() + afterimageDelay,
    hand,
  };
  activePhaseDashAfterimages.push(afterimageData);

  // Check for enemies in dash path and damage them
  const enemies = getEnemies();
  const dashEndPos = destination.clone();
  const dashDir = new THREE.Vector3().subVectors(dashEndPos, oldPosition).normalize();
  const dashLength = oldPosition.distanceTo(dashEndPos);

  enemies.forEach((e, enemyIndex) => {
    const enemyPos = e.mesh.position;

    // Check if enemy is along the dash path
    const toEnemy = new THREE.Vector3().subVectors(enemyPos, oldPosition);
    const projection = toEnemy.dot(dashDir);

    if (projection >= 0 && projection <= dashLength) {
      const closestPoint = oldPosition.clone().addScaledVector(dashDir, projection);
      const distToLine = enemyPos.distanceTo(closestPoint);

      // Damage enemies within 1.5m of dash line
      if (distToLine < 1.5) {
        const dashDamage = Math.round(afterimageDamage * 0.5);  // Half damage during dash
        const result = hitEnemy(enemyIndex, dashDamage);
        spawnDamageNumber(enemyPos, dashDamage, '#4488ff');
        _log(`[Phase Dash] Hit enemy for ${dashDamage} damage`);

        handleEnemyKilled(enemyIndex);
      }
    }
  });

  playShoothSound();
  triggerScreenShake(0.2, 200);
}

/**
 * Update Phase Dash afterimages
 * Handles pixel dissolution and detonation
 */
// [CORE] Update phase dash afterimages
function updatePhaseDashAfterimages(now, dt) {
  for (let i = activePhaseDashAfterimages.length - 1; i >= 0; i--) {
    const afterimage = activePhaseDashAfterimages[i];
    const age = now - afterimage.createdAt;

    // Update pixel dissolution effect
    afterimage.pixels.forEach(pixel => {
      // Move pixels outward
      pixel.mesh.position.addScaledVector(pixel.velocity, dt);

      // Fade out pixels over time
      const fadeProgress = age / afterimage.expiresAt;
      pixel.mesh.material.opacity = 0.7 * (1 - fadeProgress);
      pixel.mesh.scale.setScalar(1 - fadeProgress);
    });

    // Check if afterimage should detonate
    if (age >= afterimage.expiresAt) {
      // Detonate - AOE damage using spatial hash
      const enemies = getEnemies();  // Still needed for index lookup
      _hashScratchAfterimages.length = 0;
      enemySpatialHash.queryInto(_hashScratchAfterimages, afterimage.position.x, afterimage.position.z, afterimage.aoeRadius);
      const nearby = _hashScratchAfterimages;
      for (const e of nearby) {
        const enemyIndex = enemies.indexOf(e);
        const dist = e.mesh.position.distanceTo(afterimage.position);
        if (dist < afterimage.aoeRadius) {
          const damageMultiplier = 1 - (dist / afterimage.aoeRadius);
          const damage = Math.round(afterimage.damage * damageMultiplier);
          const result = hitEnemy(enemyIndex, damage);
          spawnDamageNumber(e.mesh.position, damage, '#88ccff');
          _log(`[Phase Dash] Afterimage exploded for ${damage} damage`);

          handleEnemyKilled(enemyIndex);
        }
      }

      // Visual explosion
      spawnExplosionVisual(afterimage.position, afterimage.aoeRadius);
      playExplosionSound();
      triggerScreenShake(0.3, 300);

      // Clean up afterimage
      disposeMesh(afterimage.mesh);
      activePhaseDashAfterimages.splice(i, 1);
      _log('[Phase Dash] Afterimage detonated');
    }
  }
}

// ============================================================
//  REFLECTOR DRONE IMPLEMENTATION
// ============================================================

/**
 * Fire Reflector Drone - spawns orbiting drone that reflects enemy projectiles
 * Overcharge: player can shoot the drone for 100% reflect but drone takes damage
 */
// [CORE] Reflector drone weapon system
function fireReflectorDrone(origin, hand, altWeapon) {
  // Limit active drones
  if (activeReflectorDrones.length >= MAX_REFLECTOR_DRONES) {
    // Check if there's already an active drone from this hand - remove it
    const existingIndex = activeReflectorDrones.findIndex(d => d.hand === hand);
    if (existingIndex >= 0) {
      const drone = activeReflectorDrones[existingIndex];
      destroyReflectorDrone(drone);
      activeReflectorDrones.splice(existingIndex, 1);
      _log('[Reflector Drone] Recalled early from', hand, 'hand');
    } else {
      // Remove oldest drone
      const oldest = activeReflectorDrones.shift();
      destroyReflectorDrone(oldest);
    }
  }

  _log(`[ALT] Reflector Drone deployed from ${hand} hand`);
  const pooledVisual = acquireReflectorDroneVisual();
  if (!pooledVisual) return;

  // Position at player location
  const playerPos = camera.position.clone();
  pooledVisual.mesh.position.copy(playerPos);
  pooledVisual.mesh.position.y = 1.2;  // Chest height

  // Drone data
  const drone = {
    poolEntry: pooledVisual,
    mesh: pooledVisual.mesh,
    hexMesh: pooledVisual.hexMesh,
    hexMat: pooledVisual.hexMat,
    coreMat: pooledVisual.coreMat,
    shieldMat: pooledVisual.shieldMat,
    particles: pooledVisual.particles,
    hand,
    createdAt: performance.now(),
    expiresAt: performance.now() + (altWeapon.duration || 15000),
    duration: altWeapon.duration || 15000,
    reflectChance: altWeapon.reflectChance || 0.5,
    overchargeReflect: altWeapon.overchargeReflect || 1.0,
    health: altWeapon.droneHealth || 50,
    maxHealth: altWeapon.droneHealth || 50,
    orbitRadius: altWeapon.orbitRadius || 2.0,
    orbitSpeed: altWeapon.orbitSpeed || 1.5,
    orbitAngle: 0,
    overcharged: false,
    lastReflectTime: 0,
  };

  activeReflectorDrones.push(drone);
  playShoothSound();
}

/**
 * Update Reflector Drones - orbit player, check for projectile reflection
 */
// [CORE] Update reflector drones
function updateReflectorDrones(now, dt, playerPos) {
  for (let i = activeReflectorDrones.length - 1; i >= 0; i--) {
    const drone = activeReflectorDrones[i];
    const age = now - drone.createdAt;

    // Check if expired
    if (age >= drone.duration || drone.health <= 0) {
      if (drone.health <= 0) {
        _log('[Reflector Drone] Destroyed!');
        spawnExplosionVisual(drone.mesh.position, 0.5);
        playExplosionSound();
      }
      destroyReflectorDrone(drone);
      activeReflectorDrones.splice(i, 1);
      continue;
    }

    // Orbit around player
    drone.orbitAngle += drone.orbitSpeed * dt;
    const orbitX = Math.cos(drone.orbitAngle) * drone.orbitRadius;
    const orbitZ = Math.sin(drone.orbitAngle) * drone.orbitRadius;

    drone.mesh.position.x = playerPos.x + orbitX;
    drone.mesh.position.z = playerPos.z + orbitZ;
    drone.mesh.position.y = 1.2 + Math.sin(age * 0.002) * 0.1;  // Gentle bob

    // Rotate drone
    drone.mesh.rotation.y = -drone.orbitAngle + Math.PI / 2;

    // Animate orbiting particles
    drone.particles.forEach((p, idx) => {
      p.userData.orbitAngle += dt * 3;
      const radius = p.userData.orbitRadius;
      p.position.x = Math.cos(p.userData.orbitAngle) * radius;
      p.position.z = Math.sin(p.userData.orbitAngle) * radius;
      p.position.y = Math.sin(age * 0.005 + idx) * 0.05;
    });

    // Pulse shield effect
    const shieldPulse = 0.15 + Math.sin(age * 0.008) * 0.05;
    drone.shieldMat.opacity = shieldPulse;

    // Change color based on overcharge state
    if (drone.overcharged) {
      drone.hexMat.color.setHex(0xff6600);  // Orange when overcharged
      drone.shieldMat.color.setHex(0xff6600);
      drone.coreMat.color.setHex(0xff6600);
    } else {
      drone.hexMat.color.setHex(0x00ffcc);  // Cyan-green normally
      drone.shieldMat.color.setHex(0x00ffcc);
      drone.coreMat.color.setHex(0x00ffcc);
    }

    // Fade out near end of duration
    const fadeStart = drone.duration * 0.85;
    if (age > fadeStart) {
      const fadeProgress = (age - fadeStart) / (drone.duration - fadeStart);
      drone.hexMat.opacity = 0.9 * (1 - fadeProgress);
      drone.coreMat.opacity = 0.8 * (1 - fadeProgress);
      drone.shieldMat.opacity = Math.min(drone.shieldMat.opacity, 0.2 * (1 - fadeProgress));
    }
  }
}

/**
 * Check if enemy projectile should be reflected by a drone
 * @returns {boolean} true if projectile was reflected
 */
// [CORE] Check reflector drone projectile reflection
function checkReflectorDroneReflection(projPos, isBossProjectile = false) {
  for (const drone of activeReflectorDrones) {
    const dist = projPos.distanceTo(drone.mesh.position);
    if (dist < 0.5) {  // Within drone shield radius
      // Determine reflect chance
      const reflectChance = drone.overcharged ? drone.overchargeReflect : drone.reflectChance;

      if (Math.random() < reflectChance) {
        // Reflect the projectile!
        _log(`[Reflector Drone] Reflected projectile! (${drone.overcharged ? '100%' : '50%'} chance)`);
        spawnExplosionVisual(projPos, 0.3);
        playHitSound();
        drone.lastReflectTime = performance.now();

        return true;  // Projectile reflected
      }
    }
  }
  return false;
}

/**
 * Check if player projectile hits a drone (overcharge mechanic)
 * @returns {boolean} true if drone was hit
 */
// [CORE] Check player projectile hits drone
function checkPlayerProjectileHitsDrone(projPos, projControllerIndex) {
  for (let i = 0; i < activeReflectorDrones.length; i++) {
    const drone = activeReflectorDrones[i];

    // Don't let the same hand that spawned the drone hit it
    const droneHand = drone.hand;
    const projHand = getHandForController(projControllerIndex);
    if (droneHand === projHand) continue;

    if (projPos.distanceToSquared(drone.mesh.position) < 0.09) {  // 0.3m hit radius
      // Overcharge the drone (100% reflect but takes damage)
      drone.overcharged = true;
      drone.health -= 10;  // 10 damage per shot

      _log(`[Reflector Drone] Overcharged! Health: ${drone.health}/${drone.maxHealth}`);

      // Visual feedback
      drone.hexMat.color.setHex(0xff6600);  // Flash orange
      drone.shieldMat.color.setHex(0xff6600);
      spawnDamageNumber(drone.mesh.position, 10, '#ff6600');
      playHitSound();

      // Spawn reflected projectile back at nearest enemy
      spawnReflectedProjectile(drone.mesh.position.clone());

      return true;
    }
  }
  return false;
}

/**
 * Spawn a reflected projectile from drone position
 */
// [CORE] Spawn reflected projectile from drone
function spawnReflectedProjectile(origin) {
  // Find nearest enemy
  const enemies = getEnemies();
  let nearestEnemy = null;
  let nearestDist = 20;

  enemies.forEach(e => {
    const dist = e.mesh.position.distanceTo(origin);
    if (dist < nearestDist) {
      nearestDist = dist;
      nearestEnemy = e;
    }
  });

  // Also check boss
  const boss = getBoss();
  if (boss) {
    const dist = boss.mesh.position.distanceTo(origin);
    if (dist < nearestDist) {
      nearestDist = dist;
      nearestEnemy = boss;
    }
  }

  if (!nearestEnemy) {
    // No target, just shoot forward
    return;
  }

  // Create reflected projectile
  const direction = new THREE.Vector3()
    .subVectors(nearestEnemy.mesh ? nearestEnemy.mesh.position : nearestEnemy.position, origin)
    .normalize();

  const reflectedGeo = new THREE.SphereGeometry(0.05, 8, 8);
  const reflectedMat = basicMat(0x00ffcc, {
    transparent: true,
    opacity: 0.9,
  });
  const reflectedProj = new THREE.Mesh(reflectedGeo, reflectedMat);
    reflectedProj.name = 'reflected-projectile';
  reflectedProj.position.copy(origin);
  reflectedProj.userData.velocity = direction.clone().multiplyScalar(30);
  reflectedProj.userData.createdAt = performance.now();
  reflectedProj.userData.lifetime = 2000;
  reflectedProj.userData.damage = 20;
  reflectedProj.userData.isReflected = true;
  scene.add(reflectedProj);
  projectiles.push(reflectedProj);

  _log('[Reflector Drone] Spawned reflected projectile');
}

/**
 * Destroy a reflector drone
 */
// [CORE] Destroy reflector drone
function destroyReflectorDrone(drone) {
  if (drone?.poolEntry) {
    releaseReflectorDroneVisual(drone.poolEntry);
    return;
  }
  disposeMesh(drone.mesh);
  _log('[Reflector Drone] Destroyed');
}

// ============================================================
//  STASIS FIELD
// ============================================================

/**
 * Initialize pooled stasis visuals.
 * VR-CRITICAL: Stasis spheres are expensive translucent meshes with many particles,
 * so we allocate a tiny fixed pool and reskin/reposition it instead of rebuilding
 * geometry every cast.
 */
function initStasisFieldVisualPool() {
  if (stasisFieldPoolInitialized || !scene) return;

  for (let poolIndex = 0; poolIndex < STASIS_FIELD_POOL_SIZE; poolIndex++) {
    const fieldGeo = new THREE.SphereGeometry(1, 24, 24);
    const fieldMat = basicMat(0x4488ff, {
      transparent: true,
      opacity: 0.3,
      side: THREE.BackSide,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    const fieldMesh = new THREE.Mesh(fieldGeo, fieldMat);
    fieldMesh.name = 'stasis-field';
    fieldMesh.visible = false;
    scene.add(fieldMesh);

    const particles = [];
    for (let i = 0; i < 30; i++) {
      const particleGeo = new THREE.SphereGeometry(0.05, 4, 4);
      const particleMat = basicMat(0x88ccff, {
        transparent: true,
        opacity: 0.6,
        blending: THREE.AdditiveBlending,
      });
      const particle = new THREE.Mesh(particleGeo, particleMat);
      particle.name = 'stasis-field-particle';
      particle.visible = false;
      fieldMesh.add(particle);
      particles.push({
        mesh: particle,
        angle: Math.random() * Math.PI * 2,
        speed: 0.5 + Math.random() * 0.5,
        heightOffset: Math.random() * Math.PI * 2,
      });
    }

    stasisFieldVisualPool.push({
      mesh: fieldMesh,
      material: fieldMat,
      particles,
      active: false,
    });
  }

  stasisFieldPoolInitialized = true;
}

/**
 * Acquire one pooled stasis field visual.
 * Resets particle state so repeat casts do not inherit stale animation.
 */
function acquireStasisFieldVisual(radius) {
  initStasisFieldVisualPool();
  for (let i = 0; i < stasisFieldVisualPool.length; i++) {
    const entry = stasisFieldVisualPool[i];
    if (entry.active) continue;
    entry.active = true;
    entry.mesh.visible = true;
    entry.mesh.scale.setScalar(radius);
    entry.material.opacity = 0.3;
    for (let j = 0; j < entry.particles.length; j++) {
      const particle = entry.particles[j];
      particle.angle = Math.random() * Math.PI * 2;
      particle.speed = 0.5 + Math.random() * 0.5;
      particle.heightOffset = Math.random() * Math.PI * 2;
      particle.mesh.visible = true;
      particle.mesh.material.opacity = 0.6;
      particle.mesh.position.set(0, 0, 0);
    }
    return entry;
  }
  return null;
}

function releaseStasisFieldVisual(entry) {
  if (!entry) return;
  entry.active = false;
  entry.mesh.visible = false;
}

function destroyStasisField(field) {
  if (field?.poolEntry) {
    releaseStasisFieldVisual(field.poolEntry);
    return;
  }
  disposeMesh(field.mesh);
}

// [CORE] Stasis field weapon system
function fireStasisField(origin, direction, hand, altWeapon) {
  // Create stasis field at target location
  const targetPosition = origin.clone().addScaledVector(direction, 8); // 8 units forward

  const radius = altWeapon.radius || 3.0;
  const pooledVisual = acquireStasisFieldVisual(radius);
  if (!pooledVisual) return;
  const mesh = pooledVisual.mesh;
  mesh.position.copy(targetPosition);

  // Add to active stasis fields
  const expiresAt = performance.now() + (altWeapon.duration || 5000);
  activeStasisFields.push({
    poolEntry: pooledVisual,
    mesh,
    material: pooledVisual.material,
    position: targetPosition,
    radius,
    expiresAt,
    duration: altWeapon.duration || 5000,  // Fix: pulse phase reads this (was hardcoded 5000 in a degenerate ternary)
    slowFactor: altWeapon.slowFactor || 0.2,
    particles: pooledVisual.particles,
  });

  _log(`[Stasis Field] Created at (${targetPosition.x.toFixed(2)}, ${targetPosition.y.toFixed(2)}, ${targetPosition.z.toFixed(2)}) for ${altWeapon.duration / 1000}s`);
}

// [CORE] Update stasis fields
function updateStasisFields(now, dt) {
  for (let i = activeStasisFields.length - 1; i >= 0; i--) {
    const field = activeStasisFields[i];

    // Remove expired fields
    if (now > field.expiresAt) {
      destroyStasisField(field);
      activeStasisFields.splice(i, 1);
      continue;
    }

    // Animate particles (swirling effect)
    field.particles.forEach(p => {
      p.angle += p.speed * dt;
      p.mesh.position.x = field.radius * Math.sin(p.angle) * Math.cos(p.heightOffset);
      p.mesh.position.z = field.radius * Math.sin(p.angle) * Math.sin(p.heightOffset);
      p.mesh.position.y = field.radius * Math.cos(p.angle);
    });

    // Pulsing opacity
    // Fix: degenerate ternary (both branches were 5000) — the pulse phase is
    // meant to follow the field's actual lifetime. Use stored field.duration
    // (set at spawn) so pulse phase matches the field's real expiry.
    const age = now - (field.expiresAt - (field.duration || 5000));
    const pulse = Math.sin(age * 0.005) * 0.1 + 0.3;
    field.material.opacity = pulse;
  }
}

// ============================================================
//  PLASMA ORB
// ============================================================

/**
 * Initialize pooled plasma orb visuals.
 * Perf: each orb previously allocated its own mesh plus eight trail meshes.
 * Pooling keeps this weapon from spraying transient geometry into the scene.
 */
function initPlasmaOrbVisualPool() {
  if (plasmaOrbPoolInitialized || !scene) return;

  for (let poolIndex = 0; poolIndex < PLASMA_ORB_POOL_SIZE; poolIndex++) {
    const orbGeo = new THREE.SphereGeometry(0.15, 16, 16);
    const orbMat = basicMat(0xaa44ff, {
      transparent: true,
      opacity: 0.8,
      blending: THREE.AdditiveBlending,
    });
    const orbMesh = new THREE.Mesh(orbGeo, orbMat);
    orbMesh.name = 'plasma-orb';
    orbMesh.visible = false;
    scene.add(orbMesh);

    const trailParticles = [];
    for (let i = 0; i < 8; i++) {
      const trailGeo = new THREE.SphereGeometry(0.08, 8, 8);
      const trailMat = basicMat(0xcc66ff, {
        transparent: true,
        opacity: 0.5 - (i * 0.05),
        blending: THREE.AdditiveBlending,
      });
      const trail = new THREE.Mesh(trailGeo, trailMat);
      trail.name = 'plasma-trail';
      trail.visible = false;
      scene.add(trail);
      trailParticles.push({
        mesh: trail,
        material: trailMat,
        baseOpacity: 0.5 - (i * 0.05),
        age: 0,
      });
    }

    plasmaOrbVisualPool.push({
      mesh: orbMesh,
      material: orbMat,
      trailParticles,
      active: false,
    });
  }

  plasmaOrbPoolInitialized = true;
}

function acquirePlasmaOrbVisual(origin) {
  initPlasmaOrbVisualPool();
  for (let i = 0; i < plasmaOrbVisualPool.length; i++) {
    const entry = plasmaOrbVisualPool[i];
    if (entry.active) continue;
    entry.active = true;
    entry.mesh.visible = true;
    entry.mesh.position.copy(origin);
    entry.material.opacity = 0.8;
    for (let j = 0; j < entry.trailParticles.length; j++) {
      const trail = entry.trailParticles[j];
      trail.age = 0;
      trail.mesh.visible = false;
      trail.mesh.position.copy(origin);
      trail.material.opacity = trail.baseOpacity;
    }
    return entry;
  }
  return null;
}

function releasePlasmaOrbVisual(entry) {
  if (!entry) return;
  entry.active = false;
  entry.mesh.visible = false;
  for (let i = 0; i < entry.trailParticles.length; i++) {
    entry.trailParticles[i].mesh.visible = false;
  }
}

function destroyPlasmaOrb(orb) {
  if (orb?.poolEntry) {
    releasePlasmaOrbVisual(orb.poolEntry);
    return;
  }
  if (orb?.trailParticles) {
    orb.trailParticles.forEach(t => disposeMesh(t.mesh));
  }
  disposeMesh(orb.mesh);
}

// [CORE] Plasma orb weapon system
function firePlasmaOrb(origin, direction, hand, altWeapon) {
  const pooledVisual = acquirePlasmaOrbVisual(origin);
  if (!pooledVisual) return;
  const mesh = pooledVisual.mesh;

  // Calculate velocity
  const speed = altWeapon.speed || 5;
  const velocity = direction.clone().multiplyScalar(speed);

  // Add to active plasma orbs
  const expiresAt = performance.now() + 10000; // 10 second lifetime
  activePlasmaOrbs.push({
    poolEntry: pooledVisual,
    mesh,
    material: pooledVisual.material,
    velocity,
    damage: altWeapon.damage || 75,
    aoeRadius: altWeapon.aoeRadius || 2.0,
    homingRange: altWeapon.homingRange || 15,
    expiresAt,
    detonatable: altWeapon.detonateOnHit !== false,
    trailParticles: pooledVisual.trailParticles,
    lastTrailUpdate: performance.now(),
  });

  _log(`[Plasma Orb] Fired from ${hand} hand, damage: ${altWeapon.damage}`);
}

// [CORE] Update plasma orbs
function updatePlasmaOrbs(now, dt) {
  const enemies = getEnemies();  // Still needed for index lookup
  for (let i = activePlasmaOrbs.length - 1; i >= 0; i--) {
    const orb = activePlasmaOrbs[i];

    // Remove expired orbs
    if (now > orb.expiresAt) {
      destroyPlasmaOrb(orb);
      activePlasmaOrbs.splice(i, 1);
      continue;
    }

    // Find nearest enemy for homing using spatial hash
    _hashScratchOrbHoming.length = 0;
    enemySpatialHash.queryInto(_hashScratchOrbHoming, orb.mesh.position.x, orb.mesh.position.z, orb.homingRange);
    const nearbyForHoming = _hashScratchOrbHoming;
    let nearestEnemy = null;
    let nearestDist = orb.homingRange;

    for (const e of nearbyForHoming) {
      const dist = e.mesh.position.distanceTo(orb.mesh.position);
      if (dist < nearestDist) {
        nearestDist = dist;
        nearestEnemy = e;
      }
    }

    // Homing behavior: steer towards nearest enemy
    if (nearestEnemy) {
      // Perf: scratch vector instead of new Vector3 per orb per frame
      _orbToEnemy.subVectors(nearestEnemy.mesh.position, orb.mesh.position).normalize();
      const homingStrength = 3.0; // Steering force
      orb.velocity.lerp(_orbToEnemy.multiplyScalar(orb.velocity.length()), homingStrength * dt);
    }

    // Move orb
    orb.mesh.position.addScaledVector(orb.velocity, dt);

    // Update trail particles
    if (now - orb.lastTrailUpdate > 50) { // Update every 50ms
      orb.lastTrailUpdate = now;

      // Shift trail particles
      for (let j = orb.trailParticles.length - 1; j > 0; j--) {
        orb.trailParticles[j].mesh.position.copy(orb.trailParticles[j - 1].mesh.position);
        orb.trailParticles[j].mesh.visible = true;
        orb.trailParticles[j].age = orb.trailParticles[j - 1].age + dt;
      }

      // First particle follows orb
      orb.trailParticles[0].mesh.position.copy(orb.mesh.position);
      orb.trailParticles[0].mesh.visible = true;
      orb.trailParticles[0].age = 0;

      // Fade out trail particles based on age
      orb.trailParticles.forEach(t => {
        const maxAge = 0.5; // Trail particles last 0.5 seconds
        const opacity = Math.max(0, 0.5 * (1 - t.age / maxAge));
        t.mesh.material.opacity = opacity;
        if (t.age >= maxAge) t.mesh.visible = false;
      });
    }

    // Check collision with enemies using spatial hash
    _hashScratchOrbCollision.length = 0;
    enemySpatialHash.queryInto(_hashScratchOrbCollision, orb.mesh.position.x, orb.mesh.position.z, 0.5);
    const nearbyForCollision = _hashScratchOrbCollision;
    for (const e of nearbyForCollision) {
      const dist = orb.mesh.position.distanceTo(e.mesh.position);
      if (dist < 0.3) { // Collision radius
        // Detonate orb
        const enemyIndex = enemies.indexOf(e);
        detonatePlasmaOrb(orb, enemyIndex);
        return; // Exit loop after detonation
      }
    }

    // Check if orb can be shot by player (detonate early)
    // This is handled in projectile collision detection
  }
}

// [CORE] Detonate plasma orb
function detonatePlasmaOrb(orb, enemyIndex) {
  // Apply damage to enemy
  if (enemyIndex !== undefined) {
    const result = hitEnemy(enemyIndex, orb.damage);
    spawnDamageNumber(orb.mesh.position, orb.damage, '#aa44ff');

    if (result.killed) {
      playExplosionSound();
      handleEnemyKilled(enemyIndex, { killsWithoutHit: true });
    }
  }

  // AOE damage to nearby enemies using spatial hash
  if (orb.aoeRadius > 0) {
    const enemies = getEnemies();  // Still needed for index lookup
    _hashScratchOrbAoe.length = 0;
    enemySpatialHash.queryInto(_hashScratchOrbAoe, orb.mesh.position.x, orb.mesh.position.z, orb.aoeRadius);
    const nearby = _hashScratchOrbAoe;
    for (const e of nearby) {
      const i = enemies.indexOf(e);
      if (i === enemyIndex) continue; // Skip the enemy we already hit
      const dist = e.mesh.position.distanceTo(orb.mesh.position);
      if (dist < orb.aoeRadius) {
        const aoeDamage = orb.damage * 0.5 * (1 - dist / orb.aoeRadius);
        hitEnemy(i, aoeDamage);
        spawnDamageNumber(e.mesh.position, aoeDamage, '#aa44ff');
      }
    }
  }

  // Visual explosion
  spawnExplosionVisual(orb.mesh.position, orb.aoeRadius || 2.0);

  // Remove orb and trail
  destroyPlasmaOrb(orb);

  // Remove from active array
  const index = activePlasmaOrbs.indexOf(orb);
  if (index !== -1) {
    activePlasmaOrbs.splice(index, 1);
  }

  _log('[Plasma Orb] Detonated!');
}

// Check if player projectiles can detonate plasma orbs
// [CORE] Check plasma orb detonation on projectile hit
function checkPlasmaOrbDetonation(proj) {
  for (let i = activePlasmaOrbs.length - 1; i >= 0; i--) {
    const orb = activePlasmaOrbs[i];
    if (!orb.detonatable) continue;

    if (proj.position.distanceToSquared(orb.mesh.position) < 0.25) { // 0.5m hit radius
      // Detonate orb with smaller AOE (early detonation)
      orb.aoeRadius *= 0.6; // 60% of normal radius
      detonatePlasmaOrb(orb, undefined);
      _log('[Plasma Orb] Detonated early by player shot!');
      return true;
    }
  }
  return false;
}

// ============================================================
//  GRENADE - Throwable explosive
// ============================================================

const activeGrenades = [];
const MAX_GRENADES = 5;
const grenadePool = [];
let grenadePoolInitialized = false;

function initGrenadePool() {
  if (grenadePoolInitialized || !scene) return;

  for (let i = 0; i < MAX_GRENADES; i++) {
    const grenadeGeo = new THREE.SphereGeometry(0.1, 8, 8);
    const grenadeMat = basicMat(0xff4444, {
      transparent: true,
      opacity: 0.9,
    });
    const grenade = new THREE.Mesh(grenadeGeo, grenadeMat);
    grenade.name = 'grenade';
    grenade.visible = false;

    const glowGeo = new THREE.SphereGeometry(0.15, 8, 8);
    const glowMat = basicMat(0xff4444, {
      transparent: true,
      opacity: 0.3,
      side: THREE.BackSide,
    });
    const glow = new THREE.Mesh(glowGeo, glowMat);
    glow.name = 'grenade-glow';
    grenade.add(glow);

    scene.add(grenade);
    grenadePool.push({ mesh: grenade, glowMat, active: false });
  }

  grenadePoolInitialized = true;
}

function acquireGrenadeVisual() {
  initGrenadePool();
  for (let i = 0; i < grenadePool.length; i++) {
    const entry = grenadePool[i];
    if (entry.active) continue;
    entry.active = true;
    entry.mesh.visible = true;
    entry.mesh.scale.setScalar(1);
    entry.mesh.rotation.set(0, 0, 0);
    entry.mesh.material.opacity = 0.9;
    entry.glowMat.opacity = 0.3;
    return entry;
  }
  return null;
}

function releaseGrenadeVisual(entry) {
  if (!entry) return;
  entry.active = false;
  entry.mesh.visible = false;
}

// [CORE] Grenade weapon system
function fireGrenade(origin, direction, hand, altWeapon) {
  // Limit active grenades
  if (activeGrenades.length >= MAX_GRENADES) {
    const oldest = activeGrenades.shift();
    destroyGrenade(oldest);
  }

  _log(`[Grenade] Thrown from ${hand} hand`);

  const pooledVisual = acquireGrenadeVisual();
  if (!pooledVisual) return;
  pooledVisual.mesh.position.copy(origin);

  const grenadeData = {
    poolEntry: pooledVisual,
    mesh: pooledVisual.mesh,
    glowMat: pooledVisual.glowMat,
    velocity: direction.clone().multiplyScalar(12), // Toss speed
    createdAt: performance.now(),
    hand,
    damage: altWeapon.damage || 40,
    aoeRadius: altWeapon.aoeRadius || 2.0,
    fuseTime: 2000, // 2 second fuse
    bounceCount: 0,
  };

  activeGrenades.push(grenadeData);
  playShoothSound();
}

// [CORE] Update grenades (physics, arming)
function updateGrenades(dt, now) {
  for (let i = activeGrenades.length - 1; i >= 0; i--) {
    const grenade = activeGrenades[i];
    const age = now - grenade.createdAt;

    // Apply gravity
    grenade.velocity.y -= 9.8 * dt;

    // Move grenade
    grenade.mesh.position.addScaledVector(grenade.velocity, dt);

    // Ground collision with bounce
    if (grenade.mesh.position.y < 0.1) {
      grenade.mesh.position.y = 0.1;
      grenade.velocity.y *= -0.4; // Bounce
      grenade.velocity.x *= 0.7; // Friction
      grenade.velocity.z *= 0.7;
      grenade.bounceCount++;
    }

    // Pulse glow effect
    const pulse = 0.3 + Math.sin(age * 0.02) * 0.15;
    grenade.glowMat.opacity = pulse;

    // Check fuse timer
    if (age >= grenade.fuseTime) {
      detonateGrenade(grenade, i);
    }
  }
}

// [CORE] Detonate grenade
function detonateGrenade(grenade, index) {
  _log('[Grenade] Detonated!');

  // AOE damage to enemies using spatial hash
  const enemies = getEnemies();  // Still needed for index lookup
  _hashScratchGrenade.length = 0;
  enemySpatialHash.queryInto(_hashScratchGrenade, grenade.mesh.position.x, grenade.mesh.position.z, grenade.aoeRadius);
  const nearby = _hashScratchGrenade;
  for (const e of nearby) {
    const i = enemies.indexOf(e);
    const dist = e.mesh.position.distanceTo(grenade.mesh.position);
    if (dist < grenade.aoeRadius) {
      const damageMultiplier = 1 - (dist / grenade.aoeRadius);
      const damage = Math.round(grenade.damage * damageMultiplier);
      const result = hitEnemy(i, damage);
      spawnDamageNumber(e.mesh.position, damage, '#ff4444');

      handleEnemyKilled(i);
    }
  }

  // Visual explosion
  spawnExplosionVisual(grenade.mesh.position, grenade.aoeRadius);
  playExplosionSound();
  triggerScreenShake(0.3, 300);

  // Remove grenade
  destroyGrenade(grenade);
  activeGrenades.splice(index, 1);
}

// [CORE] Destroy grenade mesh
function destroyGrenade(grenade) {
  if (grenade?.poolEntry) {
    releaseGrenadeVisual(grenade.poolEntry);
    return;
  }
  disposeMesh(grenade.mesh);
}

// ============================================================
//  PROXIMITY MINE - Placeable explosive trap
// ============================================================

const activeProximityMines = [];
const MAX_PROXIMITY_MINES = 3;
const proximityMinePool = [];
let proximityMinePoolInitialized = false;

function initProximityMinePool() {
  if (proximityMinePoolInitialized || !scene) return;

  for (let i = 0; i < MAX_PROXIMITY_MINES; i++) {
    const mineGeo = new THREE.IcosahedronGeometry(0.12, 0);
    const mineMat = basicMat(0xffaa00, {
      transparent: true,
      opacity: 0.9,
    });
    const mine = new THREE.Mesh(mineGeo, mineMat);
    mine.visible = false;

    const glowGeo = new THREE.SphereGeometry(0.2, 8, 8);
    const glowMat = basicMat(0xffaa00, {
      transparent: true,
      opacity: 0.3,
      side: THREE.BackSide,
    });
    const glow = new THREE.Mesh(glowGeo, glowMat);
    glow.name = 'proximity-mine-glow';
    mine.add(glow);

    scene.add(mine);
    proximityMinePool.push({ mesh: mine, glowMat, active: false });
  }

  proximityMinePoolInitialized = true;
}

function acquireProximityMineVisual() {
  initProximityMinePool();
  for (let i = 0; i < proximityMinePool.length; i++) {
    const entry = proximityMinePool[i];
    if (entry.active) continue;
    entry.active = true;
    entry.mesh.visible = true;
    entry.mesh.scale.setScalar(1);
    entry.mesh.rotation.set(0, 0, 0);
    entry.mesh.material.opacity = 0.9;
    entry.mesh.material.color.setHex(0xffaa00);
    entry.glowMat.opacity = 0.3;
    return entry;
  }
  return null;
}

function releaseProximityMineVisual(entry) {
  if (!entry) return;
  entry.active = false;
  entry.mesh.visible = false;
}

// [CORE] Proximity mine weapon system
function fireProximityMine(origin, hand, altWeapon) {
  // Limit active mines per hand
  const handMines = activeProximityMines.filter(m => m.hand === hand);
  if (handMines.length >= (altWeapon.maxActive || 3)) {
    // Remove oldest mine from this hand
    const oldest = handMines[0];
    destroyProximityMine(oldest);
    const idx = activeProximityMines.indexOf(oldest);
    if (idx >= 0) activeProximityMines.splice(idx, 1);
  }

  _log(`[Mine] Placed from ${hand} hand`);

  const pooledVisual = acquireProximityMineVisual();
  if (!pooledVisual) return;
  const mine = pooledVisual.mesh;

  // Place at ground level
  mine.position.copy(origin);
  mine.position.y = 0.15;

  const mineData = {
    poolEntry: pooledVisual,
    mesh: mine,
    glowMat: pooledVisual.glowMat,
    hand,
    position: mine.position.clone(),
    placedAt: performance.now(),
    armedAt: performance.now() + 1000, // 1 second arm time
    damage: altWeapon.damage || 60,
    aoeRadius: altWeapon.aoeRadius || 2.5,
    triggerRadius: 2.0,
    isArmed: false,
    pulsePhase: Math.random() * Math.PI * 2,
  };

  activeProximityMines.push(mineData);
  playShoothSound();
}

// [CORE] Update proximity mines
function updateProximityMines(now, dt) {
  for (let i = activeProximityMines.length - 1; i >= 0; i--) {
    const mine = activeProximityMines[i];
    const age = now - mine.placedAt;

    // Pulsing glow effect
    mine.pulsePhase += dt * 3;
    const pulse = 0.2 + Math.sin(mine.pulsePhase) * 0.15;
    mine.glowMat.opacity = pulse;

    // Rotate mine
    mine.mesh.rotation.x += dt * 0.5;
    mine.mesh.rotation.y += dt * 0.7;

    // Check if armed
    if (!mine.isArmed && now >= mine.armedAt) {
      mine.isArmed = true;
      mine.mesh.material.color.setHex(0xffcc00); // Brighter when armed
      _log('[Mine] Armed!');
    }

    // Not armed yet - skip proximity check
    if (!mine.isArmed) continue;

    // Check for enemy proximity using spatial hash
    _hashScratchMineProximity.length = 0;
    enemySpatialHash.queryInto(_hashScratchMineProximity, mine.position.x, mine.position.z, mine.triggerRadius);
    const nearby = _hashScratchMineProximity;
    for (const e of nearby) {
      const dist = e.mesh.position.distanceTo(mine.position);
      if (dist < mine.triggerRadius) {
        detonateProximityMine(mine, i);
        break;
      }
    }
  }
}

// [CORE] Detonate proximity mine
function detonateProximityMine(mine, index) {
  _log('[Mine] Detonated!');

  // AOE damage to enemies using spatial hash
  const enemies = getEnemies();  // Still needed for index lookup
  _hashScratchMineAoe.length = 0;
  enemySpatialHash.queryInto(_hashScratchMineAoe, mine.position.x, mine.position.z, mine.aoeRadius);
  const nearby = _hashScratchMineAoe;
  for (const e of nearby) {
    const i = enemies.indexOf(e);
    const dist = e.mesh.position.distanceTo(mine.position);
    if (dist < mine.aoeRadius) {
      const damageMultiplier = 1 - (dist / mine.aoeRadius);
      const damage = Math.round(mine.damage * damageMultiplier);
      const result = hitEnemy(i, damage);
      spawnDamageNumber(e.mesh.position, damage, '#ffaa00');

      handleEnemyKilled(i);
    }
  }

  // Visual explosion
  spawnExplosionVisual(mine.position, mine.aoeRadius);
  playExplosionSound();
  triggerScreenShake(0.4, 350);

  // Remove mine
  destroyProximityMine(mine);
  activeProximityMines.splice(index, 1);
}

// [CORE] Destroy proximity mine
function destroyProximityMine(mine) {
  if (mine?.poolEntry) {
    releaseProximityMineVisual(mine.poolEntry);
    return;
  }
  disposeMesh(mine.mesh);
}

// ============================================================
//  ATTACK DRONE - Orbiting auto-targeting helper
// ============================================================

const activeAttackDrones = [];
const MAX_ATTACK_DRONES = 2;

// ── Drone projectile pool (reused geometry + material) ────
let _droneProjGeo = null;
let _droneProjMat = null;

function _ensureDroneProjPool() {
  if (!_droneProjGeo) {
    _droneProjGeo = new THREE.SphereGeometry(0.04, 6, 6);
  }
  if (!_droneProjMat) {
    _droneProjMat = basicMat(0x88ff88, { transparent: true, opacity: 0.8 });
  }
}

function _getDroneProjectile(now) {
  _ensureDroneProjPool();
  const proj = new THREE.Mesh(_droneProjGeo, _droneProjMat);
  proj.name = 'drone-projectile';
  proj.userData._sharedPool = true; // don't dispose shared geo/mat
  proj.userData.velocity = new THREE.Vector3();
  proj.userData.createdAt = now;
  proj.userData.lifetime = 1500;
  proj.userData.damage = 0;
  proj.userData.isDroneProjectile = true;
  return proj;
}

function _disposeDroneProjPool() {
  if (_droneProjGeo) { _droneProjGeo.dispose(); _droneProjGeo = null; }
  if (_droneProjMat) { _droneProjMat.dispose(); _droneProjMat = null; }
}

function initAttackDronePool() {
  if (attackDronePoolInitialized || !scene) return;

  for (let poolIndex = 0; poolIndex < MAX_ATTACK_DRONES; poolIndex++) {
    const droneGroup = new THREE.Group();
    droneGroup.visible = false;

    const hexShape = new THREE.Shape();
    const hexRadius = 0.15;
    for (let i = 0; i < 6; i++) {
      const angle = (i / 6) * Math.PI * 2 - Math.PI / 2;
      const x = Math.cos(angle) * hexRadius;
      const y = Math.sin(angle) * hexRadius;
      if (i === 0) hexShape.moveTo(x, y);
      else hexShape.lineTo(x, y);
    }
    hexShape.closePath();

    const hexGeo = new THREE.ShapeGeometry(hexShape);
    const hexMat = basicMat(0x88ff88, {
      transparent: true,
      opacity: 0.9,
      side: THREE.DoubleSide,
    });
    const hex = new THREE.Mesh(hexGeo, hexMat);
    hex.rotation.x = Math.PI / 2;
    droneGroup.add(hex);

    const coreGeo = new THREE.SphereGeometry(0.06, 8, 8);
    const coreMat = basicMat(0x88ff88, {
      transparent: true,
      opacity: 0.8,
    });
    const core = new THREE.Mesh(coreGeo, coreMat);
    core.name = 'attack-drone-core';
    droneGroup.add(core);

    const glowGeo = new THREE.SphereGeometry(0.25, 12, 12);
    const glowMat = basicMat(0x88ff88, {
      transparent: true,
      opacity: 0.2,
      side: THREE.BackSide,
    });
    const glow = new THREE.Mesh(glowGeo, glowMat);
    glow.name = 'attack-drone-glow';
    droneGroup.add(glow);

    scene.add(droneGroup);
    attackDronePool.push({
      mesh: droneGroup,
      hexMat,
      coreMat,
      glowMat,
      active: false,
    });
  }

  attackDronePoolInitialized = true;
}

function acquireAttackDroneVisual() {
  initAttackDronePool();
  for (let i = 0; i < attackDronePool.length; i++) {
    const entry = attackDronePool[i];
    if (entry.active) continue;
    entry.active = true;
    entry.mesh.visible = true;
    entry.mesh.scale.setScalar(1);
    entry.mesh.rotation.set(0, 0, 0);
    entry.coreMat.opacity = 0.8;
    entry.glowMat.opacity = 0.2;
    entry.hexMat.opacity = 0.9;
    return entry;
  }
  return null;
}

function releaseAttackDroneVisual(entry) {
  if (!entry) return;
  entry.active = false;
  entry.mesh.visible = false;
}

// [CORE] Attack drone weapon system
function fireAttackDrone(origin, hand, altWeapon) {
  // Limit active drones
  const handDrones = activeAttackDrones.filter(d => d.hand === hand);
  if (handDrones.length >= MAX_ATTACK_DRONES) {
    const oldest = handDrones[0];
    destroyAttackDrone(oldest);
    const idx = activeAttackDrones.indexOf(oldest);
    if (idx >= 0) activeAttackDrones.splice(idx, 1);
  }

  _log(`[Drone] Deployed from ${hand} hand`);
  const pooledVisual = acquireAttackDroneVisual();
  if (!pooledVisual) return;

  // Position at player location
  const playerPos = camera.position.clone();
  pooledVisual.mesh.position.copy(playerPos);
  pooledVisual.mesh.position.y = 1.2;

  const droneData = {
    poolEntry: pooledVisual,
    mesh: pooledVisual.mesh,
    coreMat: pooledVisual.coreMat,
    glowMat: pooledVisual.glowMat,
    hand,
    createdAt: performance.now(),
    expiresAt: performance.now() + (altWeapon.duration || 10000),
    damage: altWeapon.damage || 8,
    fireInterval: altWeapon.fireInterval || 200,
    lastFireTime: 0,
    orbitAngle: Math.random() * Math.PI * 2,
    orbitRadius: 2.0,
    orbitSpeed: 1.5,
  };

  activeAttackDrones.push(droneData);
  playShoothSound();
}

// [CORE] Update attack drones (targeting, firing)
function updateAttackDrones(now, dt, playerPos) {
  for (let i = activeAttackDrones.length - 1; i >= 0; i--) {
    const drone = activeAttackDrones[i];
    const age = now - drone.createdAt;

    // Check if expired
    if (now >= drone.expiresAt) {
      destroyAttackDrone(drone);
      activeAttackDrones.splice(i, 1);
      _log('[Drone] Expired');
      continue;
    }

    // Orbit around player
    drone.orbitAngle += drone.orbitSpeed * dt;
    const orbitX = Math.cos(drone.orbitAngle) * drone.orbitRadius;
    const orbitZ = Math.sin(drone.orbitAngle) * drone.orbitRadius;

    drone.mesh.position.x = playerPos.x + orbitX;
    drone.mesh.position.z = playerPos.z + orbitZ;
    drone.mesh.position.y = 1.2 + Math.sin(age * 0.002) * 0.1;

    // Rotate drone
    drone.mesh.rotation.y = -drone.orbitAngle + Math.PI / 2;

    // Pulse glow
    const pulse = 0.15 + Math.sin(age * 0.008) * 0.05;
    drone.glowMat.opacity = pulse;

    // Fire at nearest enemy
    if (now - drone.lastFireTime >= drone.fireInterval) {
      const enemies = getEnemies();
      let nearestEnemy = null;
      let nearestDist = 15;

      enemies.forEach(e => {
        const dist = e.mesh.position.distanceTo(drone.mesh.position);
        if (dist < nearestDist) {
          nearestDist = dist;
          nearestEnemy = e;
        }
      });

      if (nearestEnemy) {
        // Fire projectile at enemy (reuse pooled geometry + material)
        _evoV3a.subVectors(nearestEnemy.mesh.position, drone.mesh.position).normalize();
        const proj = _getDroneProjectile(now);
        proj.position.copy(drone.mesh.position);
        proj.userData.velocity.copy(_evoV3a).multiplyScalar(25);
        proj.userData.createdAt = now;
        proj.userData.lifetime = 1500;
        proj.userData.damage = drone.damage;
        proj.userData.isDroneProjectile = true;
        scene.add(proj);
        projectiles.push(proj);

        drone.lastFireTime = now;
      }
    }

    // Fade out near end
    const fadeStart = (drone.expiresAt - drone.createdAt) * 0.85;
    if (age > fadeStart) {
      const fadeProgress = (age - fadeStart) / ((drone.expiresAt - drone.createdAt) - fadeStart);
      drone.coreMat.opacity = 0.8 * (1 - fadeProgress);
      drone.glowMat.opacity = Math.min(drone.glowMat.opacity, 0.2 * (1 - fadeProgress));
    }
  }
}

// [CORE] Destroy attack drone
function destroyAttackDrone(drone) {
  if (drone?.poolEntry) {
    releaseAttackDroneVisual(drone.poolEntry);
    return;
  }
  disposeMesh(drone.mesh);
}

// ============================================================
//  EMP - Area effect that stuns/shocks enemies
// ============================================================

// [CORE] EMP weapon system
const EMP_VISUAL_POOL_SIZE = 4;
const empVisualPool = [];
let empVisualPoolInitialized = false;

function initEMPVisualPool() {
  if (empVisualPoolInitialized || !scene) return;

  for (let i = 0; i < EMP_VISUAL_POOL_SIZE; i++) {
    const ringGeo = new THREE.RingGeometry(0.1, 5, 32);
    const ringMat = basicMat(0x00ffff, {
      transparent: true,
      opacity: 0.6,
      side: THREE.DoubleSide,
    });
    const ring = new THREE.Mesh(ringGeo, ringMat);
    ring.visible = false;
    scene.add(ring);
    empVisualPool.push({ ring, ringMat, active: false });
  }

  empVisualPoolInitialized = true;
}

function acquireEMPVisual() {
  initEMPVisualPool();
  for (let i = 0; i < empVisualPool.length; i++) {
    const entry = empVisualPool[i];
    if (entry.active) continue;
    entry.active = true;
    entry.ring.visible = true;
    entry.ring.scale.setScalar(1);
    entry.ringMat.opacity = 0.6;
    return entry;
  }
  return null;
}

function releaseEMPVisual(entry) {
  if (!entry) return;
  entry.active = false;
  entry.ring.visible = false;
}

function fireEMP(origin, hand, altWeapon) {
  _log(`[EMP] Activated from ${hand} hand`);

  const range = altWeapon.range || 5;
  const duration = altWeapon.duration || 3000;
  const playerPos = camera.position.clone();

  const pooledVisual = acquireEMPVisual();
  if (!pooledVisual) return;
  const ring = pooledVisual.ring;
  ring.position.copy(playerPos);
  ring.position.y = 1.0;
  ring.rotation.x = Math.PI / 2;

  // Track for animation
  const empData = {
    poolEntry: pooledVisual,
    ring,
    ringMat: pooledVisual.ringMat,
    createdAt: performance.now(),
    expiresAt: performance.now() + 500, // Quick burst
    range,
    duration,
    damageApplied: false,
  };

  // Damage and stun enemies in range
  const enemies = getEnemies();
  enemies.forEach((e, i) => {
    const dist = e.mesh.position.distanceTo(playerPos);
    if (dist < range) {
      // Apply shock/stun effect
      if (!e.statusEffects) {
        e.statusEffects = { shock: { stacks: 0, timer: 0 } };
      }
      if (!e.statusEffects.shock) {
        e.statusEffects.shock = { stacks: 0, timer: 0 };
      }
      e.statusEffects.shock.stacks += 3;
      e.statusEffects.shock.timer = Math.max(e.statusEffects.shock.timer, duration);

      // Small damage
      const empDamage = 10;
      const result = hitEnemy(i, empDamage);
      spawnDamageNumber(e.mesh.position, empDamage, '#00ffff');

      handleEnemyKilled(i);
    }
  });

  // Also affect boss if present
  const boss = getBoss();
  if (boss) {
    const dist = boss.mesh.position.distanceTo(playerPos);
    if (dist < range) {
      hitBoss(15);
      spawnDamageNumber(boss.mesh.position, 15, '#00ffff');
    }
  }

  // Add to active visuals for animation
  activeEMPVisuals.push(empData);

  playShoothSound();
  triggerScreenShake(0.3, 300);
}

const activeEMPVisuals = [];

// [CORE] Update EMP visuals
function updateEMPVisuals(now, dt) {
  for (let i = activeEMPVisuals.length - 1; i >= 0; i--) {
    const emp = activeEMPVisuals[i];
    const age = now - emp.createdAt;

    // Fade out ring
    const progress = age / 500;
    emp.ringMat.opacity = 0.6 * (1 - progress);

    // Scale ring outward
    emp.ring.scale.setScalar(1 + progress * 2);

    // Remove when done
    if (age >= 500) {
      releaseEMPVisual(emp.poolEntry);
      activeEMPVisuals.splice(i, 1);
    }
  }
}

// ============================================================
//  TELEPORT - Instant movement to target location
// ============================================================

// [CORE] Teleport weapon system
const TELEPORT_VISUAL_POOL_SIZE = 4;
const teleportVisualPool = [];
let teleportVisualPoolInitialized = false;

function initTeleportVisualPool() {
  if (teleportVisualPoolInitialized || !scene) return;

  for (let i = 0; i < TELEPORT_VISUAL_POOL_SIZE; i++) {
    const startEffectGeo = new THREE.SphereGeometry(0.5, 16, 16);
    const startEffectMat = basicMat(0xaa00ff, {
      transparent: true,
      opacity: 0.5,
      blending: THREE.AdditiveBlending,
    });
    const startEffect = new THREE.Mesh(startEffectGeo, startEffectMat);
    startEffect.name = 'teleport-start-effect';
    startEffect.visible = false;
    scene.add(startEffect);

    const endEffectGeo = new THREE.SphereGeometry(0.5, 16, 16);
    const endEffectMat = basicMat(0xaa00ff, {
      transparent: true,
      opacity: 0.5,
      blending: THREE.AdditiveBlending,
    });
    const endEffect = new THREE.Mesh(endEffectGeo, endEffectMat);
    endEffect.name = 'teleport-end-effect';
    endEffect.visible = false;
    scene.add(endEffect);

    teleportVisualPool.push({
      startEffect,
      startEffectMat,
      endEffect,
      endEffectMat,
      active: false,
    });
  }

  teleportVisualPoolInitialized = true;
}

function acquireTeleportVisual() {
  initTeleportVisualPool();
  for (let i = 0; i < teleportVisualPool.length; i++) {
    const entry = teleportVisualPool[i];
    if (entry.active) continue;
    entry.active = true;
    entry.startEffect.visible = true;
    entry.endEffect.visible = true;
    entry.startEffect.scale.setScalar(1);
    entry.endEffect.scale.setScalar(1);
    entry.startEffectMat.opacity = 0.5;
    entry.endEffectMat.opacity = 0.5;
    return entry;
  }
  return null;
}

function releaseTeleportVisual(entry) {
  if (!entry) return;
  entry.active = false;
  entry.startEffect.visible = false;
  entry.endEffect.visible = false;
}

function fireTeleport(origin, direction, hand, altWeapon) {
  _log(`[Teleport] Activated from ${hand} hand`);

  const range = altWeapon.range || 10;
  const playerPos = camera.position.clone();

  // Calculate teleport destination
  const destination = playerPos.clone().addScaledVector(direction, range);

  // Clamp destination to ground level
  destination.y = Math.max(0.5, destination.y);

  const pooledVisual = acquireTeleportVisual();
  if (!pooledVisual) return;
  const startEffect = pooledVisual.startEffect;
  startEffect.position.copy(playerPos);

  // Teleport player (desktop only - in VR, WebXR controls camera position)
  if (!isXrPresenting()) {
    camera.position.copy(destination);
    _log(`[Teleport] Moved from (${playerPos.x.toFixed(2)}, ${playerPos.y.toFixed(2)}, ${playerPos.z.toFixed(2)}) to (${destination.x.toFixed(2)}, ${destination.y.toFixed(2)}, ${destination.z.toFixed(2)})`);
  } else {
    _log(`[Teleport] VR mode - teleport visual only (WebXR controls camera)`);
  }

  const endEffect = pooledVisual.endEffect;
  endEffect.position.copy(destination);

  // Track effects for fade-out
  const teleportData = {
    poolEntry: pooledVisual,
    startEffect,
    startEffectMat: pooledVisual.startEffectMat,
    endEffect,
    endEffectMat: pooledVisual.endEffectMat,
    createdAt: performance.now(),
    duration: 300,
  };

  activeTeleportEffects.push(teleportData);
  playShoothSound();
  triggerScreenShake(0.2, 200);
}

const activeTeleportEffects = [];

// [CORE] Update teleport effects
function updateTeleportEffects(now, dt) {
  for (let i = activeTeleportEffects.length - 1; i >= 0; i--) {
    const effect = activeTeleportEffects[i];
    const age = now - effect.createdAt;

    // Fade out both effects
    const progress = age / effect.duration;
    const opacity = 0.5 * (1 - progress);
    effect.startEffectMat.opacity = opacity;
    effect.endEffectMat.opacity = opacity;

    // Scale up effects
    effect.startEffect.scale.setScalar(1 + progress);
    effect.endEffect.scale.setScalar(1 + progress);

    // Remove when done
    if (age >= effect.duration) {
      releaseTeleportVisual(effect.poolEntry);
      activeTeleportEffects.splice(i, 1);
    }
  }
}

// ============================================================
//  GAME STATE TRANSITIONS
// ============================================================
// [DEBUG] Jump to a specific level for testing (skips progression)
function clearAllAltWeaponEffects() {
  // Clear active shields
  for (let i = activeShields.length - 1; i >= 0; i--) {
    disposeMesh(activeShields[i].mesh);
  }
  activeShields.length = 0;

  // Clear active laser mines
  for (let i = activeLaserMines.length - 1; i >= 0; i--) {
    const mine = activeLaserMines[i];
    if (mine.mesh) disposeMesh(mine.mesh);
    // Fix: a triggered mine (mid-laser) also holds laserMesh (beam) and glowMesh —
    // the update-loop cleanup disposes all three; mirror it here so level
    // transitions don't leak the beam/glow visuals
    if (mine.laserMesh) disposeMesh(mine.laserMesh);
    if (mine.glowMesh) disposeMesh(mine.glowMesh);
  }
  activeLaserMines.length = 0;

  // Clear active decoys
  for (let i = activeDecoys.length - 1; i >= 0; i--) {
    disposeMesh(activeDecoys[i].mesh);
  }
  activeDecoys.length = 0;

  // Clear active black holes
  for (let i = activeBlackHoles.length - 1; i >= 0; i--) {
    disposeMesh(activeBlackHoles[i].mesh);
  }
  activeBlackHoles.length = 0;

  // Clear active mines (black hole mines)
  for (let i = activeMines.length - 1; i >= 0; i--) {
    if (activeMines[i].mesh) disposeMesh(activeMines[i].mesh);
  }
  activeMines.length = 0;

  // Clear active tethers
  for (let i = activeTethers.length - 1; i >= 0; i--) {
    disposeMesh(activeTethers[i].mesh);
  }
  activeTethers.length = 0;

  // Clear active nanite swarms
  for (let i = activeNaniteSwarms.length - 1; i >= 0; i--) {
    disposeMesh(activeNaniteSwarms[i].mesh);
  }
  activeNaniteSwarms.length = 0;

  // Clear active reflector drones
  for (let i = activeReflectorDrones.length - 1; i >= 0; i--) {
    destroyReflectorDrone(activeReflectorDrones[i]);
  }
  activeReflectorDrones.length = 0;

  // Clear active grenades
  for (let i = activeGrenades.length - 1; i >= 0; i--) {
    destroyGrenade(activeGrenades[i]);
  }
  activeGrenades.length = 0;

  // Clear active proximity mines
  for (let i = activeProximityMines.length - 1; i >= 0; i--) {
    destroyProximityMine(activeProximityMines[i]);
  }
  activeProximityMines.length = 0;

  // Clear active attack drones
  for (let i = activeAttackDrones.length - 1; i >= 0; i--) {
    destroyAttackDrone(activeAttackDrones[i]);
  }
  activeAttackDrones.length = 0;

  // Clear active plasma orbs
  for (let i = activePlasmaOrbs.length - 1; i >= 0; i--) {
    destroyPlasmaOrb(activePlasmaOrbs[i]);
  }
  activePlasmaOrbs.length = 0;

  // Clear active phase dash afterimages
  for (let i = activePhaseDashAfterimages.length - 1; i >= 0; i--) {
    disposeMesh(activePhaseDashAfterimages[i].mesh);
  }
  activePhaseDashAfterimages.length = 0;

  // Clear active stasis fields
  for (let i = activeStasisFields.length - 1; i >= 0; i--) {
    destroyStasisField(activeStasisFields[i]);
  }
  activeStasisFields.length = 0;

  // Clear active EMP visuals
  for (let i = activeEMPVisuals.length - 1; i >= 0; i--) {
    releaseEMPVisual(activeEMPVisuals[i].poolEntry);
  }
  activeEMPVisuals.length = 0;

  // Clear active teleport effects
  for (let i = activeTeleportEffects.length - 1; i >= 0; i--) {
    releaseTeleportVisual(activeTeleportEffects[i].poolEntry);
  }
  activeTeleportEffects.length = 0;

  // Clear explosion visuals (toxic pools, boss shields, etc.)
  for (let i = explosionVisuals.length - 1; i >= 0; i--) {
    disposeMesh(explosionVisuals[i]);
  }
  explosionVisuals.length = 0;
  clearAllChargeBeamVisuals();
  clearAllLightningOrbs();

  // Remove explosion pool meshes from scene and clear pool, then reinitialize
  for (let i = 0; i < explosionPool.length; i++) {
    if (explosionPool[i].mesh.parent) {
      explosionPool[i].mesh.parent.remove(explosionPool[i].mesh);
    }
    disposeMesh(explosionPool[i].mesh);
  }
  explosionPool.length = 0;
  // Reinitialize pool with fresh meshes for the new level
  if (scene) initExplosionPool(scene);

  // Clear active voxels
  for (let i = activeVoxels.length - 1; i >= 0; i--) {
    const voxel = activeVoxels[i];
    voxel.visible = false;
    voxel.userData.velocity = null;
    voxel.userData.createdAt = undefined;
    voxel.userData.lifetime = undefined;
  }
  activeVoxels.length = 0;

  // Reset debris glow pool (owned by projectile-system.js)
  resetDebrisGlow();

  _log('[cleanup] Cleared all alt-weapon effects and visuals');
}


// ============================================================
// EXPORTS for main.js + projectile-system.js
// ============================================================

// Active arrays declared inside the extracted body (grenades onward)
export { activeGrenades, activeProximityMines, activeAttackDrones, activeEMPVisuals, activeTeleportEffects };

// Functions consumed by main.js (render loop, input, reset hooks, telemetry)
// and by projectile-system.js (interaction checks — documented module cycle)
export {
  fireAltWeapon, updateShields, spawnLaserMinesPassively, updateLaserMines,
  updateDecoys, updateMinesAndBlackHoles, updateNaniteSwarms, updateTethers,
  updatePhaseDashAfterimages, updateReflectorDrones, updateStasisFields,
  updatePlasmaOrbs, updateGrenades, updateProximityMines, updateAttackDrones,
  updateEMPVisuals, updateTeleportEffects, clearAllAltWeaponEffects,
  _disposeDroneProjPool, checkProjectileNaniteInteraction,
  checkPlasmaOrbDetonation, checkPlayerProjectileHitsDrone,
};
