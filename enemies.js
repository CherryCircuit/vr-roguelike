// ============================================================
//  ENEMY SYSTEM - Babylon.js Port
//  Voxel enemies: spawning, movement, damage, death explosions.
// ============================================================

import * as BABYLON from '@babylonjs/core';

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
  basic: { pattern: parsePattern(PATTERNS.basic), voxelSize: 0.29, baseHp: 30, baseSpeed: 1.5, color: new BABYLON.Color3(0, 1, 0.53), depth: 1, scoreValue: 10, hitboxRadius: 0.6 },
  fast: { pattern: parsePattern(PATTERNS.fast), voxelSize: 0.24, baseHp: 15, baseSpeed: 3.0, color: new BABYLON.Color3(1, 1, 0), depth: 1, scoreValue: 15, hitboxRadius: 0.48 },
  tank: { pattern: parsePattern(PATTERNS.tank), voxelSize: 0.36, baseHp: 80, baseSpeed: 0.8, color: new BABYLON.Color3(0.27, 0.53, 1), depth: 1, scoreValue: 25, hitboxRadius: 0.84 },
  swarm: { pattern: parsePattern(PATTERNS.swarm), voxelSize: 0.19, baseHp: 10, baseSpeed: 3.5, color: new BABYLON.Color3(1, 0.53, 0), depth: 1, scoreValue: 5, hitboxRadius: 0.36 },
};

// ── Module state ───────────────────────────────────────────
let sceneRef = null;
const activeEnemies = [];

// Explosion particle system pool
const EXPLOSION_POOL_SIZE = 60;
let explosionParticleSystem = null;

// ── Public API ─────────────────────────────────────────────

export function initEnemies(scene) {
  sceneRef = scene;
  initExplosionPool();
}

/**
 * Initialize explosion particle system pool
 */
function initExplosionPool() {
  if (explosionParticleSystem) return;
  
  // Create a procedural texture for explosion particles
  const explosionTexture = new BABYLON.DynamicTexture('explosionTex', 32, sceneRef);
  const ctx = explosionTexture.getContext();
  ctx.fillStyle = 'white';
  ctx.beginPath();
  ctx.arc(16, 16, 12, 0, Math.PI * 2);
  ctx.fill();
  explosionTexture.update();
  
  explosionParticleSystem = new BABYLON.ParticleSystem('explosions', EXPLOSION_POOL_SIZE, sceneRef);
  explosionParticleSystem.particleTexture = explosionTexture;
  
  // Color gradient: magenta to cyan
  explosionParticleSystem.addColorGradient(0, new BABYLON.Color4(1, 0, 1, 1));
  explosionParticleSystem.addColorGradient(1, new BABYLON.Color4(0, 1, 1, 0));
  
  explosionParticleSystem.minSize = 0.1;
  explosionParticleSystem.maxSize = 0.4;
  explosionParticleSystem.minLifeTime = 0.2;
  explosionParticleSystem.maxLifeTime = 0.5;
  
  explosionParticleSystem.emitRate = 0; // Manual emission
  explosionParticleSystem.manualEmitCount = 0;
  
  explosionParticleSystem.minEmitPower = 2;
  explosionParticleSystem.maxEmitPower = 5;
  
  explosionParticleSystem.blendMode = BABYLON.ParticleSystem.BLENDMODE_ADD;
  
  explosionParticleSystem.start();
}

/**
 * Spawn explosion particles at position
 */
function spawnExplosion(position) {
  if (!explosionParticleSystem) return;
  
  explosionParticleSystem.emitter = position.clone();
  explosionParticleSystem.manualEmitCount = 8; // Emit 8 particles
  explosionParticleSystem.createPointEmitter(
    new BABYLON.Vector3(-1, -1, -1),
    new BABYLON.Vector3(1, 1, 1)
  );
}

/**
 * Spawn a single enemy of the given type at `position`.
 * `levelConfig` from game.js provides HP/speed multipliers.
 */
export function spawnEnemy(type, position, levelConfig) {
  const def = ENEMY_DEFS[type];
  if (!def) return;

  // Create enemy mesh container
  const enemyMesh = new BABYLON.TransformNode('enemy_' + type, sceneRef);
  enemyMesh.position = position.clone();
  
  // Create material for this enemy
  const material = new BABYLON.StandardMaterial('enemyMat_' + type, sceneRef);
  material.diffuseColor = def.color.clone();
  material.emissiveColor = def.color.scale(0.3);
  material.specularColor = new BABYLON.Color3(0, 0, 0);

  const voxelSize = def.voxelSize;
  const rows = def.pattern.length;
  const cols = def.pattern[0].length;
  const cx = (cols - 1) / 2;
  const cy = (rows - 1) / 2;

  // Create voxel meshes
  const voxels = [];
  for (let d = 0; d < def.depth; d++) {
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        if (def.pattern[r][c]) {
          const voxel = BABYLON.MeshBuilder.CreateBox('voxel', { size: voxelSize * 0.92 }, sceneRef);
          voxel.position = new BABYLON.Vector3(
            (c - cx) * voxelSize,
            (cy - r) * voxelSize,
            d * voxelSize
          );
          voxel.material = material;
          voxel.parent = enemyMesh;
          voxels.push(voxel);
        }
      }
    }
  }

  // Tank: one random voxel is weak point (double damage)
  if (type === 'tank' && voxels.length > 0) {
    const weakVoxel = voxels[Math.floor(Math.random() * voxels.length)];
    weakVoxel.metadata = { ...weakVoxel.metadata, weakPoint: true };
  }

  // Store enemy data
  const enemy = {
    mesh: enemyMesh,
    voxels,
    material,
    type,
    hp: Math.round(def.baseHp * levelConfig.hpMultiplier),
    maxHp: Math.round(def.baseHp * levelConfig.hpMultiplier),
    speed: def.baseSpeed * levelConfig.speedMultiplier,
    baseColor: def.color.clone(),
    scoreValue: def.scoreValue,
    hitboxRadius: def.hitboxRadius,
    statusEffects: {
      fire: { stacks: 0, remaining: 0, tickTimer: 0 },
      shock: { stacks: 0, remaining: 0, tickTimer: 0 },
      freeze: { stacks: 0, remaining: 0, tickTimer: 0 },
    },
  };

  // Add metadata for raycasting
  enemyMesh.metadata = { isEnemy: true, enemyRef: enemy };

  activeEnemies.push(enemy);
  return enemy;
}

/**
 * Move enemies toward player, check collisions, apply DoT.
 * Returns array of enemy indices that reached the player.
 */
export function updateEnemies(dt, now, playerPos) {
  const collisions = [];

  for (let i = activeEnemies.length - 1; i >= 0; i--) {
    const e = activeEnemies[i];

    // Direction toward player
    const dir = playerPos.subtract(e.mesh.position);
    const dist = dir.length();
    if (dist > 0.01) dir.normalize();

    // Speed modifiers from status effects
    let speedMod = 1;
    const se = e.statusEffects;
    if (se.shock.stacks > 0) speedMod *= Math.max(0.4, 1 - se.shock.stacks * 0.2);
    if (se.freeze.stacks > 0) speedMod *= Math.max(0.05, 1 - se.freeze.stacks * 0.4);

    // Move enemy
    const movement = dir.scale(e.speed * speedMod * dt);
    e.mesh.position.addInPlace(movement);

    // Face player (horizontal only)
    const lookTarget = new BABYLON.Vector3(playerPos.x, e.mesh.position.y, playerPos.z);
    e.mesh.lookAt(lookTarget);

    // Apply visual color based on status effects and damage
    const dmgRatio = 1 - e.hp / e.maxHp;
    const displayColor = e.baseColor.clone();
    
    if (se.fire.stacks > 0) {
      displayColor.copyFromFloats(1, 0.27, 0); // Orange for fire
    } else if (se.freeze.stacks > 0) {
      displayColor.copyFromFloats(0.27, 0.67, 1); // Light blue for freeze
    } else if (se.shock.stacks > 0) {
      displayColor.copyFromFloats(1, 1, 0.27); // Yellow for shock
    } else {
      // Lerp to red based on damage
      BABYLON.Color3.LerpToRef(displayColor, new BABYLON.Color3(1, 0, 0), dmgRatio, displayColor);
    }
    
    e.material.diffuseColor = displayColor;
    e.material.emissiveColor = displayColor.scale(0.3);

    // ── Collision with player ──
    if (dist < 0.9) {
      collisions.push(i);
      continue;
    }

    // ── Status effect ticking ──
    updateStatusEffects(e, dt);
  }

  return collisions;
}

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
      e._lastDoT = { type: 'shock', damage: shockDmg };
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
      e._lastDoT = { type: 'freeze', damage: freezeDmg };
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
export function hitEnemy(index, damage, isWeakPoint = false) {
  const e = activeEnemies[index];
  if (!e) return { killed: false };

  // Weak point doubles damage
  const actualDamage = isWeakPoint ? damage * 2 : damage;
  e.hp -= actualDamage;
  
  if (e.hp <= 0) {
    return { killed: true, enemy: e, overkill: -e.hp };
  }
  return { killed: false, enemy: e, damage: actualDamage };
}

/**
 * Destroy enemy at `index` — remove from scene, spawn explosion.
 */
export function destroyEnemy(index) {
  const e = activeEnemies[index];
  if (!e) return null;

  const pos = e.mesh.position.clone();
  const color = e.baseColor.clone();

  // Spawn explosion particles
  spawnExplosion(pos);

  // Dispose voxels
  e.voxels.forEach(v => v.dispose());
  
  // Dispose material
  e.material.dispose();
  
  // Dispose mesh container
  e.mesh.dispose();
  
  activeEnemies.splice(index, 1);

  return { position: pos, scoreValue: e.scoreValue, baseColor: color };
}

/**
 * Remove all enemies (for level transitions).
 */
export function clearAllEnemies() {
  for (let i = activeEnemies.length - 1; i >= 0; i--) {
    const e = activeEnemies[i];
    e.voxels.forEach(v => v.dispose());
    e.material.dispose();
    e.mesh.dispose();
  }
  activeEnemies.length = 0;
}

/** Return all enemy meshes (for raycasting). */
export function getEnemyMeshes() {
  return activeEnemies.map(e => e.mesh);
}

/** Get all voxel meshes (for precise hit detection). */
export function getEnemyVoxels() {
  const voxels = [];
  activeEnemies.forEach(e => {
    voxels.push(...e.voxels);
  });
  return voxels;
}

/** Find which enemy a raycasted mesh belongs to. */
export function getEnemyByMesh(mesh) {
  // Check if it's a voxel
  for (let i = 0; i < activeEnemies.length; i++) {
    const e = activeEnemies[i];
    
    // Check if mesh is the enemy container
    if (e.mesh === mesh) {
      return { index: i, enemy: e };
    }
    
    // Check if mesh is a voxel
    const voxelIndex = e.voxels.indexOf(mesh);
    if (voxelIndex !== -1) {
      const isWeakPoint = mesh.metadata?.weakPoint || false;
      return { index: i, enemy: e, voxelIndex, isWeakPoint };
    }
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
export function getSpawnPosition(airSpawns, verticalAngle = 0) {
  const angle = (Math.random() - 0.5) * (100 * Math.PI / 180);
  const distance = 14.4 + Math.random() * 5.6;  // 20% shorter (was 18-25, now 14.4-20)

  const x = Math.sin(angle) * distance;
  const z = Math.cos(angle) * distance;
  let y = 1.5;

  if (airSpawns) {
    y = 0.5 + Math.random() * 2.5;
  }

  return new BABYLON.Vector3(x, y, z);
}

// ═══════════════════════════════════════════════════════════════
// BOSS SYSTEM (Simplified for Phase 2 - will expand later)
// ═══════════════════════════════════════════════════════════════

let activeBoss = null;

const BOSS_SKULL_PATTERN = [
  [0, 1, 1, 1, 0],
  [1, 1, 1, 1, 1],
  [1, 1, 0, 1, 1],
  [1, 1, 1, 1, 1],
  [0, 1, 0, 1, 0],
];

const BOSS_DEFS = {
  // Tier 1 — Balanced HP
  grave_voxel: { pattern: BOSS_SKULL_PATTERN, voxelSize: 0.52, baseHp: 1000, phases: 3, color: new BABYLON.Color3(0.8, 0.8, 0.8), scoreValue: 100, behavior: 'spawner' },
  iron_sentry: { pattern: [[1, 1, 1], [1, 1, 1], [0, 1, 0]], voxelSize: 0.48, baseHp: 900, phases: 3, color: new BABYLON.Color3(0.55, 0.27, 0.07), scoreValue: 100, behavior: 'turret' },
  core_guardian: { pattern: [[1, 1], [1, 1]], voxelSize: 0.65, baseHp: 560, phases: 3, color: new BABYLON.Color3(0.67, 0, 1), scoreValue: 100, behavior: 'shielded' },
  chrono_wraith: { pattern: [[1, 1, 1, 1]], voxelSize: 0.45, baseHp: 850, phases: 3, color: new BABYLON.Color3(0, 1, 0.53), scoreValue: 100, behavior: 'dodger' },
  siege_ram: { pattern: [[1, 1, 1], [1, 1, 1]], voxelSize: 0.55, baseHp: 950, phases: 3, color: new BABYLON.Color3(0.4, 0.4, 0.4), scoreValue: 100, behavior: 'charger' },

  // Tier 2
  grave_voxel2: { pattern: BOSS_SKULL_PATTERN, voxelSize: 0.52, baseHp: 1500, phases: 3, color: new BABYLON.Color3(0.73, 0.73, 0.73), scoreValue: 150, behavior: 'spawner' },
  iron_sentry2: { pattern: [[1, 1, 1], [1, 1, 1], [0, 1, 0]], voxelSize: 0.48, baseHp: 1350, phases: 3, color: new BABYLON.Color3(0.48, 0.23, 0.06), scoreValue: 150, behavior: 'turret' },
  core_guardian2: { pattern: [[1, 1], [1, 1]], voxelSize: 0.65, baseHp: 840, phases: 3, color: new BABYLON.Color3(0.6, 0, 0.93), scoreValue: 150, behavior: 'shielded' },
  chrono_wraith2: { pattern: [[1, 1, 1, 1]], voxelSize: 0.45, baseHp: 1275, phases: 3, color: new BABYLON.Color3(0, 0.93, 0.47), scoreValue: 150, behavior: 'dodger' },
  siege_ram2: { pattern: [[1, 1, 1], [1, 1, 1]], voxelSize: 0.55, baseHp: 1425, phases: 3, color: new BABYLON.Color3(0.33, 0.33, 0.33), scoreValue: 150, behavior: 'charger' },

  // Tier 3
  grave_voxel3: { pattern: BOSS_SKULL_PATTERN, voxelSize: 0.52, baseHp: 2200, phases: 3, color: new BABYLON.Color3(0.67, 0.67, 0.67), scoreValue: 200, behavior: 'spawner' },
  iron_sentry3: { pattern: [[1, 1, 1], [1, 1, 1], [0, 1, 0]], voxelSize: 0.48, baseHp: 2000, phases: 3, color: new BABYLON.Color3(0.42, 0.19, 0.05), scoreValue: 200, behavior: 'turret' },
  core_guardian3: { pattern: [[1, 1], [1, 1]], voxelSize: 0.65, baseHp: 1260, phases: 3, color: new BABYLON.Color3(0.53, 0, 0.87), scoreValue: 200, behavior: 'shielded' },
  chrono_wraith3: { pattern: [[1, 1, 1, 1]], voxelSize: 0.45, baseHp: 1900, phases: 3, color: new BABYLON.Color3(0, 0.87, 0.4), scoreValue: 200, behavior: 'dodger' },
  siege_ram3: { pattern: [[1, 1, 1], [1, 1, 1]], voxelSize: 0.55, baseHp: 2100, phases: 3, color: new BABYLON.Color3(0.27, 0.27, 0.27), scoreValue: 200, behavior: 'charger' },

  // Tier 4
  grave_voxel4: { pattern: BOSS_SKULL_PATTERN, voxelSize: 0.52, baseHp: 3200, phases: 3, color: new BABYLON.Color3(0.6, 0.6, 0.6), scoreValue: 400, behavior: 'spawner' },
  iron_sentry4: { pattern: [[1, 1, 1], [1, 1, 1], [0, 1, 0]], voxelSize: 0.48, baseHp: 2900, phases: 3, color: new BABYLON.Color3(0.35, 0.15, 0.04), scoreValue: 400, behavior: 'turret' },
  core_guardian4: { pattern: [[1, 1], [1, 1]], voxelSize: 0.65, baseHp: 1820, phases: 3, color: new BABYLON.Color3(0.47, 0, 0.8), scoreValue: 400, behavior: 'shielded' },
  chrono_wraith4: { pattern: [[1, 1, 1, 1]], voxelSize: 0.45, baseHp: 2700, phases: 3, color: new BABYLON.Color3(0, 0.8, 0.33), scoreValue: 400, behavior: 'dodger' },
  siege_ram4: { pattern: [[1, 1, 1], [1, 1, 1]], voxelSize: 0.55, baseHp: 3000, phases: 3, color: new BABYLON.Color3(0.2, 0.2, 0.2), scoreValue: 400, behavior: 'charger' },
};

export function spawnBoss(bossId, levelConfig) {
  const def = BOSS_DEFS[bossId];
  if (!def || !sceneRef) return null;

  // Create boss container
  const bossMesh = new BABYLON.TransformNode('boss_' + bossId, sceneRef);
  bossMesh.position = new BABYLON.Vector3(0, 1.5, 12);

  // Create material
  const material = new BABYLON.StandardMaterial('bossMat', sceneRef);
  material.diffuseColor = def.color.clone();
  material.emissiveColor = def.color.scale(0.4);

  // Create voxels
  const voxels = [];
  const voxelSize = def.voxelSize;
  const rows = def.pattern.length;
  const cols = def.pattern[0].length;
  const cx = (cols - 1) / 2;
  const cy = (rows - 1) / 2;

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (def.pattern[r][c]) {
        const voxel = BABYLON.MeshBuilder.CreateBox('bossVoxel', { size: voxelSize * 0.95 }, sceneRef);
        voxel.position = new BABYLON.Vector3(
          (c - cx) * voxelSize,
          (cy - r) * voxelSize,
          0
        );
        voxel.material = material;
        voxel.parent = bossMesh;
        voxels.push(voxel);
      }
    }
  }

  const maxHp = Math.round(def.baseHp * levelConfig.hpMultiplier);
  
  activeBoss = {
    mesh: bossMesh,
    voxels,
    material,
    id: bossId,
    hp: maxHp,
    maxHp,
    phase: 1,
    phases: def.phases,
    scoreValue: def.scoreValue,
    baseColor: def.color.clone(),
    behavior: def.behavior,
    spawnMinionTimer: 0,
    shootTimer: 0,
    chargeTimer: 0,
    chargeActive: false,
    dodgeTimer: 0,
    dodgeDir: new BABYLON.Vector3(),
  };

  bossMesh.metadata = { isBoss: true, bossRef: activeBoss };

  return activeBoss;
}

export function getBoss() {
  return activeBoss;
}

export function hitBoss(damage) {
  if (!activeBoss) return { killed: false };

  activeBoss.hp -= damage;
  if (activeBoss.hp <= 0) activeBoss.hp = 0;

  // Phase transitions
  const prevPhase = activeBoss.phase;
  const phaseThreshold2 = activeBoss.maxHp * (2 / 3);
  const phaseThreshold1 = activeBoss.maxHp * (1 / 3);
  if (activeBoss.phases >= 3 && activeBoss.hp > 0) {
    if (activeBoss.hp <= phaseThreshold1) activeBoss.phase = 3;
    else if (activeBoss.hp <= phaseThreshold2) activeBoss.phase = 2;
  }

  return { 
    killed: activeBoss.hp <= 0, 
    phaseChanged: activeBoss.phase !== prevPhase 
  };
}

export function updateBoss(dt, now, playerPos) {
  if (!activeBoss) return;
  const b = activeBoss;

  // Direction toward player
  const dir = playerPos.subtract(b.mesh.position);
  const dist = dir.length();
  if (dist > 0.01) dir.normalize();

  // Always look at player
  const lookTarget = new BABYLON.Vector3(playerPos.x, b.mesh.position.y, playerPos.z);
  b.mesh.lookAt(lookTarget);

  // Basic movement toward player (behavior-specific logic can be added later)
  const speed = 0.25 + (b.phase - 1) * 0.1;
  b.mesh.position.addInPlace(dir.scale(speed * dt));

  // Update color based on phase
  const phaseColor = b.baseColor.clone();
  if (b.phase === 2) {
    phaseColor.scaleInPlace(1.2);
  } else if (b.phase === 3) {
    phaseColor.copyFromFloats(1, 0.5, 0.5); // Red tint in final phase
  }
  b.material.diffuseColor = phaseColor;
  b.material.emissiveColor = phaseColor.scale(0.4);
}

export function clearBoss() {
  if (!activeBoss) return;

  // Dispose voxels and material
  activeBoss.voxels.forEach(v => v.dispose());
  activeBoss.material.dispose();
  activeBoss.mesh.dispose();
  
  activeBoss = null;
}

/** Get fast enemies for proximity alerts */
export function getFastEnemies() {
  return activeEnemies.filter(e => e.type === 'fast');
}

/** Get swarm enemies for proximity alerts */
export function getSwarmEnemies() {
  return activeEnemies.filter(e => e.type === 'swarm');
}
