// ============================================================
//  VOXEL DEBRIS PHYSICS
//  Object pool for death explosion voxels with gravity/bounce/fade.
// ============================================================

import * as THREE from 'three';

// Shared state (exported so main.js can access for reset/telemetry)
export const voxelPool = [];
export const activeVoxels = [];

const VOXEL_POOL_SIZE = 50;
const MAX_ACTIVE_VOXELS = 25;  // Cap for performance (reduced from 200)

// Temp vector for death pattern velocity calculation
const _deathVel = new THREE.Vector3();

// Callbacks (set from main.js to avoid circular deps)
let _triggerScreenShake = null;
let _playExplosionSound = null;

export function initVoxelDebris(scene, triggerScreenShake, playExplosionSound) {
  _triggerScreenShake = triggerScreenShake;
  _playExplosionSound = playExplosionSound;

  const voxelGeo = new THREE.BoxGeometry(0.15, 0.15, 0.15);  // 40% smaller death voxels
  
  for (let i = 0; i < VOXEL_POOL_SIZE; i++) {
    const material = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 1.0,
    });
    const voxel = new THREE.Mesh(voxelGeo, material);
    voxel.visible = false;
    voxel.userData.velocity = new THREE.Vector3();
    voxel.userData.createdAt = 0;
    voxel.userData.lifetime = 0;
    voxel.userData.isGold = false;
    scene.add(voxel);
    voxelPool.push(voxel);
  }
}

export function getPooledVoxel() {
  for (const voxel of voxelPool) {
    if (!voxel.visible) return voxel;
  }
  return null;
}

export function returnVoxelToPool(voxel) {
  voxel.visible = false;
  voxel.userData.velocity.set(0, 0, 0);
  voxel.userData.createdAt = 0;
  voxel.userData.lifetime = 0;
  voxel.userData.isGold = false;
  voxel.material.opacity = 1.0;
}

export function spawnVoxelExplosion(position, color, voxelCount, enemyType = 'basic', isCritical = false, isOverkill = false) {
  // Double voxels for overkill
  if (isOverkill) {
    voxelCount *= 2;
  }
  
  // Cap at 8 voxels per enemy to prevent spam
  voxelCount = Math.min(voxelCount, 8);
  
  // Make room by removing oldest voxels if at cap
  while (activeVoxels.length >= MAX_ACTIVE_VOXELS && activeVoxels.length > 0) {
    const oldest = activeVoxels.shift();
    returnVoxelToPool(oldest);
  }
  
  // Calculate available space in pool
  const availableVoxels = MAX_ACTIVE_VOXELS - activeVoxels.length;
  voxelCount = Math.min(voxelCount, availableVoxels);
  
  // Enemy-specific death patterns
  const pattern = getDeathPattern(enemyType);
  
  for (let i = 0; i < voxelCount; i++) {
    const voxel = getPooledVoxel();
    if (!voxel) break; // Pool exhausted
    
    // Set position (slightly randomized around center)
    voxel.position.copy(position);
    voxel.position.x += (Math.random() - 0.5) * 0.3;
    voxel.position.y += (Math.random() - 0.5) * 0.3;
    voxel.position.z += (Math.random() - 0.5) * 0.3;
    
    // Keep death voxels matched to the enemy's original color.
    voxel.material.color.setHex(color);
    voxel.material.opacity = 1.0;
    
    // Calculate velocity based on pattern
    const velocity = pattern.calculateVelocity(i, voxelCount);
    
    // Initialize voxel physics data
    voxel.userData.velocity = velocity;
    voxel.userData.createdAt = performance.now();
    voxel.userData.lifetime = 2000 + Math.random() * 1000; // 2-3 seconds
    voxel.userData.isGold = isCritical;
    voxel.visible = true;
    
    activeVoxels.push(voxel);
  }
  
  // Screen shake for critical kills
  if (isCritical && _triggerScreenShake) {
    _triggerScreenShake(0.3, 200);
  }
  
  // LOUDER explosion for overkill
  if (isOverkill && _playExplosionSound) {
    _playExplosionSound();
    _playExplosionSound(); // Double sound
  }
}

/**
 * Get death pattern for enemy type
 */
function getDeathPattern(enemyType) {
  const patterns = {
    basic: {
      calculateVelocity: (i, total) => {
        return _deathVel.set(
          (Math.random() - 0.5) * 6,
          Math.random() * 4 + 2,
          (Math.random() - 0.5) * 6
        ).clone();
      }
    },
    tank: {
      calculateVelocity: (i, total) => {
        return _deathVel.set(
          (Math.random() - 0.5) * 2,
          Math.random() * 2 + 1,
          (Math.random() - 0.5) * 2
        ).clone();
      }
    },
    fast: {
      calculateVelocity: (i, total) => {
        return _deathVel.set(
          (Math.random() - 0.5) * 10,
          Math.random() * 6 + 3,
          (Math.random() - 0.5) * 10
        ).clone();
      }
    },
    swarm: {
      calculateVelocity: (i, total) => {
        return _deathVel.set(
          (Math.random() - 0.5) * 8,
          Math.random() * 5 + 2,
          (Math.random() - 0.5) * 8
        ).clone();
      }
    },
    boss: {
      calculateVelocity: (i, total) => {
        const angle = (i / total) * Math.PI * 2;
        const speed = 8 + Math.random() * 4;
        return _deathVel.set(
          Math.cos(angle) * speed,
          Math.random() * 8 + 4,
          Math.sin(angle) * speed
        ).clone();
      }
    }
  };
  
  return patterns[enemyType] || patterns.basic;
}

/**
 * Update voxel physics (gravity, bounce, fade)
 */
export function updateVoxelPhysics(dt, now) {
  const gravity = -9.8;
  const bounceCoefficient = 0.3;
  const floorY = 0;  // Fixed: use 0 for reliable floor collision
  
  for (let i = activeVoxels.length - 1; i >= 0; i--) {
    const voxel = activeVoxels[i];
    const age = now - voxel.userData.createdAt;
    
    // Remove expired voxels
    if (age > voxel.userData.lifetime) {
      returnVoxelToPool(voxel);
      activeVoxels.splice(i, 1);
      continue;
    }
    
    // Apply gravity
    voxel.userData.velocity.y += gravity * dt;
    
    // Update position
    voxel.position.addScaledVector(voxel.userData.velocity, dt);
    
    // Floor collision with bounce
    if (voxel.position.y <= floorY) {
      voxel.position.y = floorY;
      voxel.userData.velocity.y *= -bounceCoefficient;
      
      // Apply friction on bounce
      voxel.userData.velocity.x *= 0.8;
      voxel.userData.velocity.z *= 0.8;
    }
    
    // Fade out in last 0.5 seconds
    const fadeStart = voxel.userData.lifetime - 500;
    if (age > fadeStart) {
      voxel.material.opacity = Math.max(0, 1.0 - (age - fadeStart) / 500);
    }
  }
}
