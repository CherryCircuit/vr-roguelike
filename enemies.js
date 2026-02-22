// ============================================================
//  ENEMY SYSTEM
//  Voxel enemies: spawning, movement, damage, death explosions.
//  BOSS FRAMEWORK: Phase transitions, telegraphing, weak points.
// ============================================================

import * as THREE from 'three';

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

// Boss voxel debris for death animation
const bossDebris = [];
const MAX_DEBRIS = 100;  // Cap for performance

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

// ── TELEGRAPHING SYSTEM ──────────────────────────────────────
// Telegraphing system for boss attacks: visual/audio warnings
class TelegraphingSystem {
  constructor(scene, camera) {
    this.scene = scene;
    this.camera = camera;
    this.activeEffects = [];
    this.maxEffects = 10; // Performance limit
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
    }

    // Minion spawning
    this.minionSpawnTimer = 0;
    this.minionSpawnRate = def.minionSpawnRate || 0;

    // Projectiles
    this.projectileTimer = 0;
    this.projectileRate = def.projectileRate || 0;

    // Telegraphing cooldown
    this.telegraphCooldown = 0;
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
  }

  updateBehavior(dt, now, playerPos) {
    // Default behavior: just move toward player
    _dir.copy(playerPos).sub(this.mesh.position);
    const dist = _dir.length();
    if (dist > 0.01) _dir.divideScalar(dist);
    this.mesh.lookAt(_look.set(playerPos.x, this.mesh.position.y, playerPos.z));
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

  destroy() {
    this.sceneRef.remove(this.mesh);
    this.mesh.traverse(c => {
      if (c.geometry) c.geometry.dispose();
      if (c.material) c.material.dispose();
    });
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
      this.mesh.lookAt(_look.set(playerPos.x, this.mesh.position.y, playerPos.z));

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

// ── BOSS DEFINITIONS ─────────────────────────────────────────
const BOSS_SKULL_PATTERN = [
  [0, 1, 1, 1, 0],
  [1, 1, 1, 1, 1],
  [1, 1, 0, 1, 1],
  [1, 1, 1, 1, 1],
  [0, 1, 0, 1, 0],
];

const BOSS_DEFS = {
  // Teleporting boss - the ONLY boss to preserve
  chrono_wraith: {
    pattern: [[1, 1, 1, 1]],
    voxelSize: 0.45,
    baseHp: 850,
    phases: 3,
    color: 0x00ff88,
    scoreValue: 100,
    behavior: 'dodger',
    hitboxRadius: 0.45
  }
};

// ── BOSS POOL MANAGEMENT ─────────────────────────────────────
const BOSS_POOLS = {
  1: ['chrono_wraith'], // Tier 1 - only teleporting boss
  2: ['chrono_wraith'], // Tier 2
  3: ['chrono_wraith'], // Tier 3
  4: ['chrono_wraith'], // Tier 4
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
}

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

  // Create appropriate boss class
  let boss;
  if (def.behavior === 'dodger') {
    boss = new DodgerBoss(def, levelConfig, sceneRef, telegraphingSystem);
  } else {
    // Default to simple boss for now
    boss = new Boss(def, levelConfig, sceneRef, telegraphingSystem);
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
    // Boss defeated - stop all music immediately
    if (typeof window !== 'undefined' && window.stopAllMusic) {
      window.stopAllMusic();
    }

    // Play boss death sound
    if (typeof window !== 'undefined' && window.playBossDeathSound) {
      window.playBossDeathSound();
    }

    // Create voxel debris for disintegration effect
    spawnBossDebris(activeBoss);

    // Spawn boss death explosion particles
    if (typeof spawnEffectParticle === 'function') {
      for (let i = 0; i < 20; i++) {
        spawnEffectParticle(activeBoss.mesh.position, activeBoss.def.color);
      }
    }

    // Clean up boss mesh
    activeBoss.destroy();
    activeBoss = null;

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
}

export function clearBoss() {
  if (activeBoss) {
    activeBoss.destroy();
    activeBoss = null;

    if (typeof hideBossHealthBar === 'function') {
      hideBossHealthBar();
    }
  }
}

// ── TELEPORTING BOSS SPECIFIC (for compatibility) ───────────
const bossMinions = [];
export function spawnBossMinion(fromPos, playerPos, type = 'basic') {
  const group = new THREE.Group();
  const def = ENEMY_DEFS[type] || ENEMY_DEFS.basic;
  const geo = getGeo(def.voxelSize);
  const mat = new THREE.MeshBasicMaterial({ color: def.color, transparent: true, opacity: 0.8 });

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
  }
}

// ── Boss Voxel Debris Physics ─────────────────────────────────

/**
 * Spawn voxel debris from a defeated boss
 * Each voxel becomes a physics-enabled debris piece
 */
function spawnBossDebris(boss) {
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

/**
 * Update boss debris physics simulation
 * Gravity, floor collision, bouncing, fading
 */
export function updateBossDebris(dt, now) {
  const gravity = -9.8;
  const floorY = 0.05;
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

/**
 * Clear all boss debris (for level transitions)
 */
export function clearBossDebris() {
  for (const debris of bossDebris) {
    sceneRef.remove(debris);
    debris.geometry.dispose();
    debris.material.dispose();
  }
  bossDebris.length = 0;
}

// ── PROJECTILES (for compatibility) ───────────────────────────
const bossProjectiles = [];
export function spawnBossProjectile(fromPos, targetPos) {
  const geo = getGeo(0.12);
  const mat = new THREE.MeshBasicMaterial({ color: 0xff0000, emissive: 0xff0000 });
  const proj = new THREE.Mesh(geo, mat);
  proj.position.copy(fromPos);

  const dir = new THREE.Vector3().copy(targetPos).sub(fromPos).normalize();
  const speed = 4.0;

  sceneRef.add(proj);
  bossProjectiles.push({
    mesh: proj,
    velocity: dir.multiplyScalar(speed),
    createdAt: performance.now(),
    lifetime: 5000,
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

    if (proj.mesh.position.distanceTo(playerPos) < 0.5) {
      proj.hitPlayer = true;
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
  const list = activeEnemies.map(e => e.mesh);
  if (includeBoss && activeBoss) {
    list.push(activeBoss.mesh);
  }
  return list;
}

export function getEnemyByMesh(mesh) {
  let obj = mesh;
  while (obj) {
    if (obj.userData.isBoss) {
      return { boss: activeBoss, isBody: true };
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
  const material = sharedMaterials[type].clone();

  const group = new THREE.Group();
  const geo = getGeo(def.voxelSize);
  const rows = def.pattern.length;
  const cols = def.pattern[0].length;
  const cx = (cols - 1) / 2;
  const cy = (rows - 1) / 2;

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

  group.position.copy(position);
  group.userData.isEnemy = true;

  // Tank: one random voxel is weak point
  if (type === 'tank') {
    const voxels = group.children.filter(c => !c.userData.isEnemyHitbox);
    if (voxels.length > 0) {
      const weak = voxels[Math.floor(Math.random() * voxels.length)];
      weak.userData.weakPoint = true;
    }
  }

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
  sceneRef.add(group);
  return enemy;
}

export function updateEnemies(dt, now, playerPos) {
  const collisions = [];

  for (let i = activeEnemies.length - 1; i >= 0; i--) {
    const e = activeEnemies[i];

    _dir.copy(playerPos).sub(e.mesh.position);
    const dist = _dir.length();
    if (dist > 0.01) _dir.divideScalar(dist);

    let speedMod = 1;
    const se = e.statusEffects;
    if (se.shock.stacks > 0) speedMod *= Math.max(0.4, 1 - se.shock.stacks * 0.2);
    if (se.freeze.stacks > 0) speedMod *= Math.max(0.05, 1 - se.freeze.stacks * 0.4);

    e.mesh.position.addScaledVector(_dir, e.speed * speedMod * dt);

    _look.set(playerPos.x, e.mesh.position.y, playerPos.z);
    e.mesh.lookAt(_look);

    if (dist < 0.9) {
      collisions.push(i);
      continue;
    }

    updateStatusEffects(e, dt);

    const dmgRatio = 1 - e.hp / e.maxHp;
    e.material.color.copy(e.baseColor).lerp(_redColor, dmgRatio);
  }

  return collisions;
}

const _redColor = new THREE.Color(0xff0000);

function updateStatusEffects(e, dt) {
  const se = e.statusEffects;

  if (se.fire.remaining > 0) {
    se.fire.remaining -= dt;
    se.fire.tickTimer -= dt;
    if (se.fire.tickTimer <= 0) {
      se.fire.tickTimer = 0.5;
      const fireDmg = Math.round(15 * se.fire.stacks);
      e.hp -= fireDmg;
      if (e.hp <= 0) e.hp = 0;
      if (typeof window !== 'undefined' && window.spawnEffectParticle) {
        window.spawnEffectParticle(e.mesh.position, 0xff4400);
      }
    }
    if (se.fire.remaining <= 0) { se.fire.stacks = 0; se.fire.tickTimer = 0; }
  }

  if (se.shock.remaining > 0) {
    se.shock.remaining -= dt;
    se.shock.tickTimer -= dt;
    if (se.shock.tickTimer <= 0) {
      se.shock.tickTimer = 0.5;
      const shockDmg = Math.round(8 * se.shock.stacks);
      e.hp -= shockDmg;
      if (e.hp <= 0) e.hp = 0;
      if (typeof window !== 'undefined' && window.spawnEffectParticle) {
        window.spawnEffectParticle(e.mesh.position, 0xffff44);
      }
    }
    if (se.shock.remaining <= 0) { se.shock.stacks = 0; se.shock.tickTimer = 0; }
  }

  if (se.freeze.remaining > 0) {
    se.freeze.remaining -= dt;
    se.freeze.tickTimer -= dt;
    if (se.freeze.tickTimer <= 0) {
      se.freeze.tickTimer = 0.5;
      const freezeDmg = Math.round(2 * se.freeze.stacks);
      e.hp -= freezeDmg;
      if (e.hp <= 0) e.hp = 0;
      if (typeof window !== 'undefined' && window.spawnEffectParticle) {
        window.spawnEffectParticle(e.mesh.position, 0x00ffff);
      }
    }
    if (se.freeze.remaining <= 0) { se.freeze.stacks = 0; se.freeze.tickTimer = 0; }
  }
}

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

export function hitEnemy(index, damage) {
  const e = activeEnemies[index];
  if (!e) return { killed: false };

  e.hp -= damage;
  if (e.hp <= 0) {
    return { killed: true, enemy: e, overkill: -e.hp };
  }
  return { killed: false, enemy: e };
}

export function destroyEnemy(index) {
  const e = activeEnemies[index];
  if (!e) return null;

  const pos = e.mesh.position.clone();
  const color = e.baseColor.clone();

  // PERFORMANCE: Reduced from 5 to 3 particles per death
    for (let i = 0; i < 3; i++) {
    const sprite = getExplosionSprite();
    if (!sprite) break;

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

  sceneRef.remove(e.mesh);
  e.material.dispose();
  activeEnemies.splice(index, 1);

  return { position: pos, scoreValue: e.scoreValue, baseColor: color };
}

export function clearAllEnemies() {
  for (let i = activeEnemies.length - 1; i >= 0; i--) {
    sceneRef.remove(activeEnemies[i].mesh);
    activeEnemies[i].material.dispose();
  }
  activeEnemies.length = 0;
}

export function updateExplosions(dt, now) {
  for (let i = explosionParts.length - 1; i >= 0; i--) {
    const p = explosionParts[i];
    const age = now - p.userData.createdAt;

    if (age > p.userData.lifetime) {
      p.visible = false;
      explosionParts.splice(i, 1);
    } else {
      p.position.addScaledVector(p.userData.velocity, dt);
      p.userData.velocity.multiplyScalar(1 - 3 * dt);
      p.material.opacity = 1 - age / p.userData.lifetime;
    }
  }
}

export function getEnemyCount() {
  return activeEnemies.length;
}

export function getEnemies() {
  return activeEnemies;
}

export function getSpawnPosition(airSpawns, verticalAngle = 0) {
  const angle = (Math.random() - 0.5) * (100 * Math.PI / 180);
  const distance = 14.4 + Math.random() * 5.6;

  const x = Math.sin(angle) * distance;
  const z = -Math.cos(angle) * distance;
  let y = 1.5;

  if (airSpawns) {
    y = 0.5 + Math.random() * 2.5;
  }

  if (verticalAngle > 0) {
    const vertRad = verticalAngle * Math.PI / 180;
    const baseY = y;
    y = baseY + Math.sin(vertRad) * distance * Math.random();
  }

  return new THREE.Vector3(x, y, z);
}

export function getFastEnemies() {
  return activeEnemies.filter(e => e.type === 'fast');
}

export function getSwarmEnemies() {
  return activeEnemies.filter(e => e.type === 'swarm');
}

// [Full implementation would continue with all the original enemy spawning and updating logic]

// ── REMAINING EXPORTS (from original file) ───────────────────

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
  const material = sharedMaterials[type].clone();

  const group = new THREE.Group();
  const geo = getGeo(def.voxelSize);
  const rows = def.pattern.length;
  const cols = def.pattern[0].length;
  const cx = (cols - 1) / 2;
  const cy = (rows - 1) / 2;

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

  group.position.copy(position);
  group.userData.isEnemy = true;

  // Tank: one random voxel is weak point
  if (type === 'tank') {
    const voxels = group.children.filter(c => !c.userData.isEnemyHitbox);
    if (voxels.length > 0) {
      const weak = voxels[Math.floor(Math.random() * voxels.length)];
      weak.userData.weakPoint = true;
    }
  }

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
  sceneRef.add(group);
  return enemy;
}

export function updateEnemies(dt, now, playerPos) {
  const collisions = [];

  for (let i = activeEnemies.length - 1; i >= 0; i--) {
    const e = activeEnemies[i];

    _dir.copy(playerPos).sub(e.mesh.position);
    const dist = _dir.length();
    if (dist > 0.01) _dir.divideScalar(dist);

    let speedMod = 1;
    const se = e.statusEffects;
    if (se.shock.stacks > 0) speedMod *= Math.max(0.4, 1 - se.shock.stacks * 0.2);
    if (se.freeze.stacks > 0) speedMod *= Math.max(0.05, 1 - se.freeze.stacks * 0.4);

    e.mesh.position.addScaledVector(_dir, e.speed * speedMod * dt);

    _look.set(playerPos.x, e.mesh.position.y, playerPos.z);
    e.mesh.lookAt(_look);

    if (dist < 0.9) {
      collisions.push(i);
      continue;
    }

    updateStatusEffects(e, dt);

    const dmgRatio = 1 - e.hp / e.maxHp;
    e.material.color.copy(e.baseColor).lerp(_redColor, dmgRatio);
  }

  return collisions;
}

const _redColor = new THREE.Color(0xff0000);

function updateStatusEffects(e, dt) {
  const se = e.statusEffects;

  if (se.fire.remaining > 0) {
    se.fire.remaining -= dt;
    se.fire.tickTimer -= dt;
    if (se.fire.tickTimer <= 0) {
      se.fire.tickTimer = 0.5;
      const fireDmg = Math.round(15 * se.fire.stacks);
      e.hp -= fireDmg;
      if (e.hp <= 0) e.hp = 0;
      if (typeof window !== 'undefined' && window.spawnEffectParticle) {
        window.spawnEffectParticle(e.mesh.position, 0xff4400);
      }
    }
    if (se.fire.remaining <= 0) { se.fire.stacks = 0; se.fire.tickTimer = 0; }
  }

  if (se.shock.remaining > 0) {
    se.shock.remaining -= dt;
    se.shock.tickTimer -= dt;
    if (se.shock.tickTimer <= 0) {
      se.shock.tickTimer = 0.5;
      const shockDmg = Math.round(8 * se.shock.stacks);
      e.hp -= shockDmg;
      if (e.hp <= 0) e.hp = 0;
      if (typeof window !== 'undefined' && window.spawnEffectParticle) {
        window.spawnEffectParticle(e.mesh.position, 0xffff44);
      }
    }
    if (se.shock.remaining <= 0) { se.shock.stacks = 0; se.shock.tickTimer = 0; }
  }

  if (se.freeze.remaining > 0) {
    se.freeze.remaining -= dt;
    se.freeze.tickTimer -= dt;
    if (se.freeze.tickTimer <= 0) {
      se.freeze.tickTimer = 0.5;
      const freezeDmg = Math.round(2 * se.freeze.stacks);
      e.hp -= freezeDmg;
      if (e.hp <= 0) e.hp = 0;
      if (typeof window !== 'undefined' && window.spawnEffectParticle) {
        window.spawnEffectParticle(e.mesh.position, 0x00ffff);
      }
    }
    if (se.freeze.remaining <= 0) { se.freeze.stacks = 0; se.freeze.tickTimer = 0; }
  }
}

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

export function hitEnemy(index, damage) {
  const e = activeEnemies[index];
  if (!e) return { killed: false };

  e.hp -= damage;
  if (e.hp <= 0) {
    return { killed: true, enemy: e, overkill: -e.hp };
  }
  return { killed: false, enemy: e };
}

export function destroyEnemy(index) {
  const e = activeEnemies[index];
  if (!e) return null;

  const pos = e.mesh.position.clone();
  const color = e.baseColor.clone();

  // PERFORMANCE: Reduced from 5 to 3 particles per death
    for (let i = 0; i < 3; i++) {
    const sprite = getExplosionSprite();
    if (!sprite) break;

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

  sceneRef.remove(e.mesh);
  e.material.dispose();
  activeEnemies.splice(index, 1);

  return { position: pos, scoreValue: e.scoreValue, baseColor: color };
}

export function clearAllEnemies() {
  for (let i = activeEnemies.length - 1; i >= 0; i--) {
    sceneRef.remove(activeEnemies[i].mesh);
    activeEnemies[i].material.dispose();
  }
  activeEnemies.length = 0;
}

export function updateExplosions(dt, now) {
  for (let i = explosionParts.length - 1; i >= 0; i--) {
    const p = explosionParts[i];
    const age = now - p.userData.createdAt;

    if (age > p.userData.lifetime) {
      p.visible = false;
      explosionParts.splice(i, 1);
    } else {
      p.position.addScaledVector(p.userData.velocity, dt);
      p.userData.velocity.multiplyScalar(1 - 3 * dt);
      p.material.opacity = 1 - age / p.userData.lifetime;
    }
  }
}

export function getEnemyCount() {
  return activeEnemies.length;
}

export function getEnemies() {
  return activeEnemies;
}

export function getSpawnPosition(airSpawns, verticalAngle = 0) {
  const angle = (Math.random() - 0.5) * (100 * Math.PI / 180);
  const distance = 14.4 + Math.random() * 5.6;

  const x = Math.sin(angle) * distance;
  const z = -Math.cos(angle) * distance;
  let y = 1.5;

  if (airSpawns) {
    y = 0.5 + Math.random() * 2.5;
  }

  if (verticalAngle > 0) {
    const vertRad = verticalAngle * Math.PI / 180;
    const baseY = y;
    y = baseY + Math.sin(vertRad) * distance * Math.random();
  }

  return new THREE.Vector3(x, y, z);
}

export function getFastEnemies() {
  return activeEnemies.filter(e => e.type === 'fast');
}

export function getSwarmEnemies() {
  return activeEnemies.filter(e => e.type === 'swarm');
}
