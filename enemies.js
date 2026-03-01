// ============================================================
//  ENEMY SYSTEM
//  Voxel enemies: spawning, movement, damage, death explosions.
// ============================================================

import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

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
  fast: { pattern: parsePattern(PATTERNS.fast), voxelSize: 0.24, baseHp: 15, baseSpeed: 3.0, color: 0xffff00, depth: 1, scoreValue: 15, hitboxRadius: 0.48 },
  tank: { pattern: parsePattern(PATTERNS.tank), voxelSize: 0.36, baseHp: 80, baseSpeed: 0.8, color: 0x4488ff, depth: 1, scoreValue: 25, hitboxRadius: 0.84 },
  swarm: { pattern: parsePattern(PATTERNS.swarm), voxelSize: 0.19, baseHp: 10, baseSpeed: 3.5, color: 0xff8800, depth: 1, scoreValue: 5, hitboxRadius: 0.36 },
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

// ── Public API ─────────────────────────────────────────────

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
        // Circle that expands outward
        const projGeo = new THREE.RingGeometry(0.2, 0.3, 32);
        const projMat = new THREE.MeshBasicMaterial({
          color: effect.color,
          transparent: true,
          opacity: 0.8,
          side: THREE.DoubleSide
        });
        effect.mesh = new THREE.Mesh(projGeo, projMat);
        effect.mesh.rotation.x = -Math.PI / 2;
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
        // Expanding arc indicating spawn direction
        const minionGeo = new THREE.RingGeometry(0.1, 0.5, 8);
        const minionMat = new THREE.MeshBasicMaterial({
          color: effect.color,
          transparent: true,
          opacity: 0.7,
          side: THREE.DoubleSide
        });
        effect.mesh = new THREE.Mesh(minionGeo, minionMat);
        effect.mesh.rotation.x = -Math.PI / 2;
        effect.mesh.rotation.z = Math.PI / 4;
        if (this.camera) {
          effect.mesh.position.set(
            this.camera.position.x,
            this.camera.position.y + 1.5,
            this.camera.position.z - 8
          );
        }
        break;

      case 'teleport':
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
        // Large sweeping arc
        const meleeGeo = new THREE.RingGeometry(0.2, 1.0, 32);
        const meleeMat = new THREE.MeshBasicMaterial({
          color: effect.color,
          transparent: true,
          opacity: 0.6,
          side: THREE.DoubleSide
        });
        effect.mesh = new THREE.Mesh(meleeGeo, meleeMat);
        effect.mesh.rotation.x = -Math.PI / 2;
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

  // Add invisible sphere hitbox for better hit detection
  const hitboxGeo = new THREE.SphereGeometry(def.hitboxRadius, 8, 8);
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
    statusEffects: {
      fire: { stacks: 0, remaining: 0, tickTimer: 0 },
      shock: { stacks: 0, remaining: 0, tickTimer: 0 },
      freeze: { stacks: 0, remaining: 0, tickTimer: 0 },
    },
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

    e.mesh.position.addScaledVector(_dir, e.speed * speedMod * dt);

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

  // Freeze DoT (Small)
  if (se.freeze.remaining > 0) {
    se.freeze.remaining -= dt;
    se.freeze.tickTimer -= dt;
    if (se.freeze.tickTimer <= 0) {
      se.freeze.tickTimer = 0.5;
      const freezeDmg = Math.round(2 * se.freeze.stacks);
      e.hp -= freezeDmg;
      if (e.hp <= 0) e.hp = 0;
      e._lastDoT = { type: 'freeze', damage: freezeDmg };
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
export function destroyEnemy(index) {
  const e = activeEnemies[index];
  if (!e) return null;

  const pos = e.mesh.position.clone();
  const color = e.baseColor.clone();

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

    this.mesh.lookAt(_look.set(playerPos.x, this.mesh.position.y, playerPos.z));
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

    this.mesh.lookAt(_look.set(playerPos.x, this.mesh.position.y, playerPos.z));
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

    this.mesh.lookAt(_look.set(playerPos.x, this.mesh.position.y, playerPos.z));
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

// ── BOSS DEFINITIONS ─────────────────────────────────────────
const BOSS_SKULL_PATTERN = [
  [0, 1, 1, 1, 0],
  [1, 1, 1, 1, 1],
  [1, 1, 0, 1, 1],
  [1, 1, 1, 1, 1],
  [0, 1, 0, 1, 0],
];

const BOSS_DEFS = {
  // Tier 1 — Balanced HP (Shielded -30%)
  grave_voxel: { pattern: BOSS_SKULL_PATTERN, voxelSize: 0.52, baseHp: 1000, phases: 3, color: 0xcccccc, scoreValue: 100, behavior: 'spawner' },
  iron_sentry: { pattern: [[1, 1, 1], [1, 1, 1], [0, 1, 0]], voxelSize: 0.48, baseHp: 900, phases: 3, color: 0x8B4513, scoreValue: 100, behavior: 'turret' },
  core_guardian: { pattern: [[1, 1], [1, 1]], voxelSize: 0.65, baseHp: 560, phases: 3, color: 0xaa00ff, scoreValue: 100, behavior: 'shielded' },
  chrono_wraith: { pattern: [[1, 1, 1, 1]], voxelSize: 0.45, baseHp: 850, phases: 3, color: 0x00ff88, scoreValue: 100, behavior: 'dodger' },
  siege_ram: { pattern: [[1, 1, 1], [1, 1, 1]], voxelSize: 0.55, baseHp: 950, phases: 3, color: 0x666666, scoreValue: 100, behavior: 'charger' },

  // Tier 2
  grave_voxel2: { pattern: BOSS_SKULL_PATTERN, voxelSize: 0.52, baseHp: 1500, phases: 3, color: 0xbbbbbb, scoreValue: 150, behavior: 'spawner' },
  iron_sentry2: { pattern: [[1, 1, 1], [1, 1, 1], [0, 1, 0]], voxelSize: 0.48, baseHp: 1350, phases: 3, color: 0x7a3a10, scoreValue: 150, behavior: 'turret' },
  core_guardian2: { pattern: [[1, 1], [1, 1]], voxelSize: 0.65, baseHp: 840, phases: 3, color: 0x9900ee, scoreValue: 150, behavior: 'shielded' },
  chrono_wraith2: { pattern: [[1, 1, 1, 1]], voxelSize: 0.45, baseHp: 1275, phases: 3, color: 0x00ee77, scoreValue: 150, behavior: 'dodger' },
  siege_ram2: { pattern: [[1, 1, 1], [1, 1, 1]], voxelSize: 0.55, baseHp: 1425, phases: 3, color: 0x555555, scoreValue: 150, behavior: 'charger' },

  // Tier 3
  grave_voxel3: { pattern: BOSS_SKULL_PATTERN, voxelSize: 0.52, baseHp: 2200, phases: 3, color: 0xaaaaaa, scoreValue: 200, behavior: 'spawner' },
  iron_sentry3: { pattern: [[1, 1, 1], [1, 1, 1], [0, 1, 0]], voxelSize: 0.48, baseHp: 2000, phases: 3, color: 0x6b300d, scoreValue: 200, behavior: 'turret' },
  core_guardian3: { pattern: [[1, 1], [1, 1]], voxelSize: 0.65, baseHp: 1260, phases: 3, color: 0x8800dd, scoreValue: 200, behavior: 'shielded' },
  chrono_wraith3: { pattern: [[1, 1, 1, 1]], voxelSize: 0.45, baseHp: 1900, phases: 3, color: 0x00dd66, scoreValue: 200, behavior: 'dodger' },
  siege_ram3: { pattern: [[1, 1, 1], [1, 1, 1]], voxelSize: 0.55, baseHp: 2100, phases: 3, color: 0x444444, scoreValue: 200, behavior: 'charger' },

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
    weakPoints: false  // Shield tiles act as damage reduction
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
    weakPoints: false  // Custom weak points (microphones)
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
    hitboxRadius: 1.2, // Larger hitbox for both sisters
    vulnerabilitySwapRate: 4.0,
    weakPoints: false  // Custom weak points (sister cores)
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
    weakPoints: true,

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
    name: 'KERNEL Monolith',
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

    this.mesh.lookAt(_look.set(playerPos.x, this.mesh.position.y, playerPos.z));
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

    this.mesh.lookAt(_look.set(playerPos.x, this.mesh.position.y, playerPos.z));
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

    this.mesh.lookAt(_look.set(playerPos.x, this.mesh.position.y, playerPos.z));
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

    this.mesh.lookAt(_look.set(playerPos.x, this.mesh.position.y, playerPos.z));
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

    this.mesh.lookAt(_look.set(playerPos.x, this.mesh.position.y, playerPos.z));
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

// ── BOSS POOL MANAGEMENT ─────────────────────────────────────

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
    this.updateHolograms(dt, now, playerPos);
    this.updateCRTBarrage(dt, now, playerPos);
    _dir.copy(playerPos).sub(this.mesh.position);
    const dist = _dir.length();
    if (dist > 0.01) _dir.divideScalar(dist);
    this.mesh.lookAt(_look.set(playerPos.x, this.mesh.position.y, playerPos.z));
    const speed = 0.15 + this.phase * 0.05;
    this.mesh.position.addScaledVector(_dir, speed * dt);
  }

  updateHolograms(dt, now, playerPos) {
    this.hologramTimer -= dt;
    if (this.phase >= 1 && this.hologramTimer <= 0) {
      const hologramCount = Math.min(3, this.phase);
      this.holograms.forEach(h => this.sceneRef.remove(h.mesh));
      this.holograms = [];
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
        this.isBarraging = true;
        this.showTelegraph('charge', 1.0, 0x88ff00);
        this.crtBarrageTimer = 0.1;
        this.barrageCount = 5 + this.phase * 2;
      }
      if (this.isBarraging) {
        this.crtBarrageTimer -= dt;
        if (this.crtBarrageTimer <= 0) {
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

  onProjectileFire(playerPos) {}
  onPhaseChange(newPhase) { super.onPhaseChange(newPhase); this.hologramTimer = 0; }
}

/**
 * KERNEL - Monolith with 3 ports
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
    const voxels = mesh.children.filter(c => c.userData.isBossBody);
    if (voxels.length >= 3) {
      voxels[0].userData.port = 1;
      voxels[1].userData.port = 2;
      voxels[2].userData.port = 3;
    }
    return mesh;
  }

  updateBehavior(dt, now, playerPos) {
    this.updatePorts(dt, now);
    _dir.copy(playerPos).sub(this.mesh.position);
    const dist = _dir.length();
    if (dist > 0.01) _dir.divideScalar(dist);
    this.mesh.lookAt(_look.set(playerPos.x, this.mesh.position.y, playerPos.z));
    const speed = 0.05 + this.phase * 0.02;
    this.mesh.position.addScaledVector(_dir, speed * dt);
  }

  updatePorts(dt, now) {
    this.portSwitchTimer -= dt;
    if (this.phase === 3 && !this.corePhaseActive) {
      this.corePhaseActive = true;
      this.activePort = 0;
      this.mesh.children.forEach(c => {
        if (c.userData && c.userData.isBossBody) {
          c.userData.weakPoint = true;
          c.material.color.setHex(0xff8800);
          c.material.opacity = 1.0;
        }
      });
    } else if (this.phase < 3 && this.portSwitchTimer <= 0) {
      this.activePort = (this.activePort % 3) + 1;
      this.portSwitchTimer = 8.0 - this.phase * 2.0;
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
      this.fireProjectile(playerPos);
      if (this.corePhaseActive) {
        const spread = Math.PI / 6;
        for (let i = -1; i <= 1; i++) {
          const angle = new THREE.Vector3(
            playerPos.x - this.mesh.position.x, 0,
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
 */
class KrakenBoss extends Boss {
  constructor(def, levelConfig, sceneRef, telegraphing) {
    super(def, levelConfig, sceneRef, telegraphing);
    this.tentacles = [];
    this.tentacleSpawnTimer = 0;
    this.rotationSpeed = 0;
  }

  updateBehavior(dt, now, playerPos) {
    this.updateTentacles(dt, now, playerPos);
    if (this.phase >= 3) {
      this.rotationSpeed = 0.5 + this.phase * 0.2;
      this.mesh.rotation.y += this.rotationSpeed * dt;
    }
    _dir.copy(playerPos).sub(this.mesh.position);
    const dist = _dir.length();
    if (dist > 0.01) _dir.divideScalar(dist);
    this.mesh.lookAt(_look.set(playerPos.x, this.mesh.position.y, playerPos.z));
    const speed = 0.1 + this.phase * 0.03;
    this.mesh.position.addScaledVector(_dir, speed * dt);
  }

  updateTentacles(dt, now, playerPos) {
    this.tentacleSpawnTimer -= dt;
    if (this.tentacleSpawnTimer <= 0) {
      const maxTentacles = 2 + this.phase;
      if (this.tentacles.length < maxTentacles) {
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
      this.fireProjectile(playerPos);
      if (this.phase >= 4) {
        const spread = Math.PI / 8;
        for (let i = -1; i <= 1; i++) {
          const angle = new THREE.Vector3(
            playerPos.x - this.mesh.position.x, 0,
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
    this.updateAfterimages(dt, now, playerPos);
    if (this.phase >= 2) this.updateDiveAttack(dt, now, playerPos);
    if (!this.isDiving) {
      _dir.copy(playerPos).sub(this.mesh.position);
      const dist = _dir.length();
      if (dist > 0.01) _dir.divideScalar(dist);
      this.mesh.lookAt(_look.set(playerPos.x, this.mesh.position.y, playerPos.z));
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
        this.isDiving = false;
        this.diveTimer = 5.0;
      } else {
        this.mesh.position.lerpVectors(this.diveStartPos, this.diveTargetPos, t);
      }
    }
  }

  onMinionSpawn(playerPos) {}
}

/**
 * Sun-Eater Train - 3 cars that cycle active states
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
    const voxels = mesh.children.filter(c => c.userData.isBossBody);
    const totalVoxels = voxels.length;
    const voxelsPerCar = Math.floor(totalVoxels / 3);
    for (let i = 0; i < 3; i++) {
      const start = i * voxelsPerCar;
      const end = (i === 2) ? totalVoxels : start + voxelsPerCar;
      for (let j = start; j < end; j++) voxels[j].userData.car = i + 1;
    }
    return mesh;
  }

  updateBehavior(dt, now, playerPos) {
    this.updateCars(dt, now);
    const angle = now * 0.0002;
    this.mesh.position.x = Math.sin(angle) * 6;
    this.mesh.position.z = -8 + Math.cos(angle) * 6;
    this.mesh.rotation.y = angle + Math.PI / 2;
  }

  updateCars(dt, now) {
    this.carSwitchTimer -= dt;
    if (this.phase <= 3) {
      if (this.carSwitchTimer <= 0) {
        this.activeCar = (this.activeCar % 3) + 1;
        this.carSwitchTimer = 10.0 - this.phase * 1.5;
        this.mesh.children.forEach(c => {
          if (c.userData && c.userData.isBossBody && c.userData.car) {
            if (c.userData.car === this.activeCar) {
              c.userData.weakPoint = true;
              c.material.opacity = 1.0;
              c.material.emissive = new THREE.Color(0xffaa00);
            } else {
              c.userData.weakPoint = false;
              c.material.opacity = 0.4;
              c.material.emissive = new THREE.Color(0x000000);
            }
          }
        });
      }
    } else {
      this.mesh.children.forEach(c => {
        if (c.userData && c.userData.isBossBody && c.userData.car) {
          c.userData.weakPoint = true;
          c.material.opacity = 1.0;
          c.material.emissive = new THREE.Color(0xffaa00);
        }
      });
    }
  }

  onProjectileFire(playerPos) {
    if (this.phase >= 4) {
      for (let i = 0; i < 3; i++) {
        this.fireProjectile(playerPos);
      }
    }
  }
}

const BOSS_POOLS = {
  1: ['chrono_wraith'], // Tier 1 (Level 5) - only teleporting boss
  2: ['hunter_breakenridge', 'dj_drax', 'captain_kestrel', 'dr_aster', 'sunflare_seraph'], // Tier 2 (Level 10) - harder bosses
  3: ['theodore_breakenridge', 'commander_halcyon', 'madame_coda', 'twin_glitch', 'neon_minotaur'], // Tier 3 (Level 15) - TOUGH bosses
  4: ['walter_breakenridge', 'kernel_monolith', 'synth_kraken', 'afterimage_seraphim', 'sun_eater_train'], // Tier 4 (Level 20) - FINAL bosses
};

// ── GLOBAL BOSS STATE ─────────────────────────────────────────
let activeBoss = null;
let telegraphingSystem = null;

// ── PUBLIC API ─────────────────────────────────────────────

export function initEnemies(scene) {
  sceneRef = scene;
  if (!explosionPoolReady) {
    initExplosionPool();
    explosionPool.forEach(s => scene.add(s));
  }

  // Initialize telegraphing system
  if (!telegraphingSystem) {
    // Camera reference will be passed when camera is initialized
    telegraphingSystem = new TelegraphingSystem(scene, null);
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

  // Create appropriate boss class based on behavior
  let boss;
  switch (def.behavior) {
    case 'dodger':
      boss = new DodgerBoss(def, levelConfig, sceneRef, telegraphingSystem);
      break;
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
export function spawnBossProjectile(fromPos, targetPos, speed = 4.0, damage = 1) {
  const geo = getGeo(0.12);
  const mat = new THREE.MeshBasicMaterial({ color: 0xff0000, emissive: 0xff0000 });
  const proj = new THREE.Mesh(geo, mat);
  proj.position.copy(fromPos);

  const dir = new THREE.Vector3().copy(targetPos).sub(fromPos).normalize();

  sceneRef.add(proj);
  bossProjectiles.push({
    mesh: proj,
    velocity: dir.multiplyScalar(speed),
    createdAt: performance.now(),
    lifetime: 5000,
    damage: damage,
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

export function getEnemyByMesh(mesh) {
  let obj = mesh;
  while (obj) {
    if (obj.userData.isBoss) {
      return { boss: activeBoss, isBody: true };
    }
    if (obj.userData.isEnemy) {
      const idx = activeEnemies.findIndex(e => e.mesh === obj);
      return idx >= 0 ? { index: idx, enemy: activeEnemies[idx] } : null;
    }
    obj = obj.parent;
  }
  return null;
}

// ── ALL OTHER ENEMY FUNCTIONS (unchanged) ─────────────────────

/**
 * Spawn a single enemy of the given type at `position`.
 */
export function spawnEnemy(type, position, levelConfig) {
  const def = ENEMY_DEFS[type];
  if (!def) return;

  if (!sharedMaterials[type]) {
    sharedMaterials[type] = new THREE.MeshBasicMaterial({
      color: def.color,
      transparent: true,
      opacity: 0.7,
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
