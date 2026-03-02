// ============================================================
//  OBJECT POOLING SYSTEM
//  Reuses objects instead of creating/destroying them
// ============================================================

import * as THREE from 'three';
/**
 * Generic object pool for reusable game objects
 */
export class ObjectPool {
  constructor(createFn, resetFn, initialSize = 10) {
    this.createFn = createFn;
    this.resetFn = resetFn;
    this.pool = [];
    this.active = [];

    // Pre-populate pool
    for (let i = 0; i < initialSize; i++) {
      this.pool.push(this.createFn());
    }

    this.stats = {
      created: initialSize,
      reused: 0,
      active: 0,
      peak: 0,
    };
  }

  /**
   * Get an object from the pool (or create new if empty)
   */
  acquire(...args) {
    let obj;

    if (this.pool.length > 0) {
      obj = this.pool.pop();
      this.stats.reused++;
    } else {
      obj = this.createFn();
      this.stats.created++;
    }

    // Reset and initialize
    this.resetFn(obj, ...args);
    this.active.push(obj);
    this.stats.active = this.active.length;
    this.stats.peak = Math.max(this.stats.peak, this.stats.active);

    return obj;
  }

  /**
   * Return an object to the pool
   */
  release(obj) {
    const index = this.active.indexOf(obj);
    if (index !== -1) {
      this.active.splice(index, 1);
      this.pool.push(obj);
      this.stats.active = this.active.length;
    }
  }

  /**
   * Release all active objects
   */
  releaseAll() {
    while (this.active.length > 0) {
      this.pool.push(this.active.pop());
    }
    this.stats.active = 0;
  }

  /**
   * Clear pool and active objects
   */
  clear() {
    this.pool = [];
    this.active = [];
    this.stats.active = 0;
  }

  /**
   * Get pool statistics
   */
  getStats() {
    return {
      ...this.stats,
      poolSize: this.pool.length,
      utilization: this.stats.created > 0 ? (this.stats.reused / this.stats.created * 100).toFixed(1) : 0,
    };
  }

  /**
   * Log pool statistics
   */
  logStats(name = 'Pool') {
    const stats = this.getStats();
    console.log(`[${name}] Created: ${stats.created}, Reused: ${stats.reused} (${stats.utilization}%), Active: ${stats.active}, Peak: ${stats.peak}, Available: ${stats.poolSize}`);
  }
}

/**
 * Specialized pool for Three.js meshes
 */
export class MeshPool extends ObjectPool {
  constructor(geometry, material, initialSize = 10) {
    super(
      () => new THREE.Mesh(geometry.clone(), material.clone()),
      (mesh, position, rotation, scale) => {
        if (position) mesh.position.copy(position);
        if (rotation) mesh.rotation.copy(rotation);
        if (scale) mesh.scale.copy(scale);
        mesh.visible = true;
      },
      initialSize
    );

    this.geometry = geometry;
    this.material = material;
  }

  /**
   * Acquire a mesh with transform
   */
  acquireMesh(position = null, rotation = null, scale = null) {
    return this.acquire(position, rotation, scale);
  }

  /**
   * Release a mesh (hide it)
   */
  releaseMesh(mesh) {
    mesh.visible = false;
    this.release(mesh);
  }
}

/**
 * Specialized pool for projectiles
 */
export class ProjectilePool extends ObjectPool {
  constructor(scene, initialSize = 50) {
    super(
      () => {
        const geometry = new THREE.CylinderGeometry(0.015, 0.015, 1.0, 6);
        const material = new THREE.MeshBasicMaterial({ color: 0x00ffff });
        const mesh = new THREE.Mesh(geometry, material);
        mesh.rotation.x = Math.PI / 2;
        mesh.userData = {
          velocity: new THREE.Vector3(),
          stats: null,
          controllerIndex: 0,
          isExploding: false,
          lifetime: 3000,
          createdAt: 0,
          hitEnemies: new Set(),
        };
        return mesh;
      },
      (mesh, origin, direction, controllerIndex, stats, color = 0x00ffff) => {
        mesh.position.copy(origin);
        mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, -1), direction);
        mesh.material.color.setHex(color);
        mesh.userData.velocity.copy(direction).multiplyScalar(40);
        mesh.userData.stats = stats;
        mesh.userData.controllerIndex = controllerIndex;
        mesh.userData.isExploding = stats.aoeRadius > 0;
        mesh.userData.createdAt = performance.now();
        mesh.userData.hitEnemies.clear();
        mesh.visible = true;
      },
      initialSize
    );

    this.scene = scene;
  }

  /**
   * Acquire a projectile
   */
  spawn(origin, direction, controllerIndex, stats, color) {
    const mesh = this.acquire(origin, direction, controllerIndex, stats, color);
    this.scene.add(mesh);
    return mesh;
  }

  /**
   * Release a projectile (remove from scene)
   */
  despawn(mesh) {
    this.scene.remove(mesh);
    mesh.visible = false;
    this.release(mesh);
  }
}

/**
 * Specialized pool for explosion particles
 */
export class ExplosionPool extends ObjectPool {
  constructor(scene, initialSize = 20) {
    super(
      () => {
        const geometry = new THREE.SphereGeometry(0.3, 12, 12);
        const material = new THREE.MeshBasicMaterial({
          color: 0xff8800,
          transparent: true,
          opacity: 0.7,
          side: THREE.BackSide,
          depthWrite: false,
          blending: THREE.AdditiveBlending,
        });
        const mesh = new THREE.Mesh(geometry, material);
        mesh.userData = {
          createdAt: 0,
          duration: 350,
          radius: 1,
        };
        return mesh;
      },
      (mesh, center, radius = 1) => {
        mesh.position.copy(center);
        mesh.scale.setScalar(1);
        mesh.material.opacity = 0.7;
        mesh.userData.createdAt = performance.now();
        mesh.userData.radius = radius;
        mesh.visible = true;
      },
      initialSize
    );

    this.scene = scene;
  }

  /**
   * Spawn an explosion
   */
  spawn(center, radius = 1) {
    const mesh = this.acquire(center, radius);
    this.scene.add(mesh);
    return mesh;
  }

  /**
   * Despawn an explosion
   */
  despawn(mesh) {
    this.scene.remove(mesh);
    mesh.visible = false;
    this.release(mesh);
  }

  /**
   * Update all active explosions
   */
  update(now) {
    const toRemove = [];

    this.active.forEach(mesh => {
      const age = now - mesh.userData.createdAt;

      if (age > mesh.userData.duration) {
        toRemove.push(mesh);
      } else {
        const t = age / mesh.userData.duration;
        const scale = 1 + t * 2.5;
        mesh.scale.setScalar(scale);
        mesh.material.opacity = 0.7 * (1 - t);
      }
    });

    toRemove.forEach(mesh => this.despawn(mesh));
  }
}

// Singleton pools (will be initialized by main.js)
export let projectilePool = null;
export let explosionPool = null;
export let deathParticlePool = null;
export let muzzleFlashPool = null;
export let explosionFragmentPool = null;

/**
 * Specialized pool for death particles (reusable voxel chunks)
 */
export class DeathParticlePool extends ObjectPool {
  constructor(scene, initialSize = 100) {
    const sharedGeo = new THREE.BoxGeometry(0.2, 0.2, 0.2);
    super(
      () => {
        const mat = new THREE.MeshBasicMaterial({ color: 0xffffff });
        const mesh = new THREE.Mesh(sharedGeo, mat);
        mesh.userData = {
          velocity: new THREE.Vector3(),
          angularVel: new THREE.Vector3(),
          grounded: false,
          groundTimer: 0,
        };
        return mesh;
      },
      (mesh, position, color) => {
        mesh.position.copy(position);
        mesh.position.x += (Math.random() - 0.5) * 0.5;
        mesh.position.y += (Math.random() - 0.5) * 0.5;
        mesh.position.z += (Math.random() - 0.5) * 0.5;
        mesh.material.color.setHex(color);
        mesh.scale.setScalar(1);
        mesh.userData.velocity.set(
          (Math.random() - 0.5) * 6,
          Math.random() * 4 + 2,
          (Math.random() - 0.5) * 6,
        );
        mesh.userData.angularVel.set(
          (Math.random() - 0.5) * 10,
          (Math.random() - 0.5) * 10,
          (Math.random() - 0.5) * 10,
        );
        mesh.userData.grounded = false;
        mesh.userData.groundTimer = 0;
        mesh.visible = true;
      },
      initialSize
    );
    this.scene = scene;
    this.sharedGeo = sharedGeo;
  }

  spawn(position, color) {
    const mesh = this.acquire(position, color);
    this.scene.add(mesh);
    return mesh;
  }

  despawn(mesh) {
    this.scene.remove(mesh);
    mesh.visible = false;
    this.release(mesh);
  }
}

/**
 * Specialized pool for muzzle flashes (weapon firing effects)
 */
export class MuzzleFlashPool extends ObjectPool {
  constructor(scene, initialSize = 20) {
    super(
      () => {
        const geo = new THREE.SphereGeometry(0.08, 8, 8);
        const mat = new THREE.MeshBasicMaterial({
          color: 0xffff00,
          transparent: true,
          opacity: 0.9,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
        });
        const mesh = new THREE.Mesh(geo, mat);
        mesh.userData = { createdAt: 0, duration: 80 };
        return mesh;
      },
      (mesh, position, color = 0xffff00) => {
        mesh.position.copy(position);
        mesh.material.color.setHex(color);
        mesh.scale.setScalar(1);
        mesh.userData.createdAt = performance.now();
        mesh.visible = true;
      },
      initialSize
    );
    this.scene = scene;
  }

  spawn(position, color) {
    const mesh = this.acquire(position, color);
    this.scene.add(mesh);
    return mesh;
  }

  despawn(mesh) {
    this.scene.remove(mesh);
    mesh.visible = false;
    this.release(mesh);
  }

  update(now) {
    const toRemove = [];
    this.active.forEach(mesh => {
      const age = now - mesh.userData.createdAt;
      if (age > mesh.userData.duration) {
        toRemove.push(mesh);
      } else {
        const t = age / mesh.userData.duration;
        mesh.material.opacity = 0.9 * (1 - t);
        mesh.scale.setScalar(1 + t * 0.5);
      }
    });
    toRemove.forEach(mesh => this.despawn(mesh));
  }
}

/**
 * Specialized pool for explosion fragments (larger chunks)
 */
export class ExplosionFragmentPool extends ObjectPool {
  constructor(scene, initialSize = 40) {
    const sharedGeo = new THREE.BoxGeometry(0.15, 0.15, 0.15);
    super(
      () => {
        const mat = new THREE.MeshBasicMaterial({
          color: 0xff8800,
          transparent: true,
          opacity: 0.8,
        });
        const mesh = new THREE.Mesh(sharedGeo, mat);
        mesh.userData = {
          velocity: new THREE.Vector3(),
          createdAt: 0,
          duration: 500,
        };
        return mesh;
      },
      (mesh, center, color = 0xff8800) => {
        mesh.position.copy(center);
        mesh.material.color.setHex(color);
        mesh.material.opacity = 0.8;
        mesh.userData.velocity.set(
          (Math.random() - 0.5) * 8,
          Math.random() * 5 + 2,
          (Math.random() - 0.5) * 8,
        );
        mesh.userData.createdAt = performance.now();
        mesh.visible = true;
      },
      initialSize
    );
    this.scene = scene;
    this.sharedGeo = sharedGeo;
  }

  spawn(center, color) {
    const mesh = this.acquire(center, color);
    this.scene.add(mesh);
    return mesh;
  }

  despawn(mesh) {
    this.scene.remove(mesh);
    mesh.visible = false;
    this.release(mesh);
  }

  update(now, dt) {
    const gravity = -9.8;
    const toRemove = [];
    this.active.forEach(mesh => {
      const age = now - mesh.userData.createdAt;
      if (age > mesh.userData.duration) {
        toRemove.push(mesh);
      } else {
        mesh.userData.velocity.y += gravity * dt;
        mesh.position.addScaledVector(mesh.userData.velocity, dt);
        mesh.rotation.x += dt * 5;
        mesh.rotation.z += dt * 3;
        
        if (mesh.position.y < 0) {
          mesh.position.y = 0;
          mesh.userData.velocity.y *= -0.3;
          mesh.userData.velocity.x *= 0.8;
          mesh.userData.velocity.z *= 0.8;
        }
        
        const t = age / mesh.userData.duration;
        mesh.material.opacity = 0.8 * (1 - t);
      }
    });
    toRemove.forEach(mesh => this.despawn(mesh));
  }
}

/**
 * Initialize all object pools
 */
export function initPools(scene) {
  projectilePool = new ProjectilePool(scene, 100);
  explosionPool = new ExplosionPool(scene, 30);
  deathParticlePool = new DeathParticlePool(scene, 100);
  muzzleFlashPool = new MuzzleFlashPool(scene, 20);
  explosionFragmentPool = new ExplosionFragmentPool(scene, 40);

  console.log('[ObjectPool] Initialized pools');
  console.log('  Projectiles: 100 pre-allocated');
  console.log('  Explosions: 30 pre-allocated');
  console.log('  Death particles: 100 pre-allocated');
  console.log('  Muzzle flashes: 20 pre-allocated');
  console.log('  Explosion fragments: 40 pre-allocated');
}

/**
 * Log all pool statistics
 */
export function logAllPoolStats() {
  if (projectilePool) projectilePool.logStats('Projectiles');
  if (explosionPool) explosionPool.logStats('Explosions');
}

/**
 * Get total pooled object counts
 */
export function getPoolCounts() {
  return {
    projectiles: projectilePool ? projectilePool.stats.active : 0,
    explosions: explosionPool ? explosionPool.stats.active : 0,
    deathParticles: deathParticlePool ? deathParticlePool.stats.active : 0,
    muzzleFlashes: muzzleFlashPool ? muzzleFlashPool.stats.active : 0,
    explosionFragments: explosionFragmentPool ? explosionFragmentPool.stats.active : 0,
  };
}

/**
 * Log all pool statistics
 */
export function logAllPoolStats() {
  if (projectilePool) projectilePool.logStats('Projectiles');
  if (explosionPool) explosionPool.logStats('Explosions');
  if (deathParticlePool) deathParticlePool.logStats('DeathParticles');
  if (muzzleFlashPool) muzzleFlashPool.logStats('MuzzleFlashes');
  if (explosionFragmentPool) explosionFragmentPool.logStats('ExplosionFragments');
}
