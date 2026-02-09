// ============================================================
//  ENEMY SYSTEM
//  Voxel enemies: spawning, movement, damage, death explosions.
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
  fast:  { pattern: parsePattern(PATTERNS.fast),  voxelSize: 0.24, baseHp: 15, baseSpeed: 3.0, color: 0xffff00, depth: 1, scoreValue: 15, hitboxRadius: 0.48 },
  tank:  { pattern: parsePattern(PATTERNS.tank),  voxelSize: 0.36, baseHp: 80, baseSpeed: 0.8, color: 0x4488ff, depth: 1, scoreValue: 25, hitboxRadius: 0.84 },
  swarm: { pattern: parsePattern(PATTERNS.swarm), voxelSize: 0.19, baseHp: 10, baseSpeed: 3.5, color: 0xff8800, depth: 1, scoreValue: 5, hitboxRadius: 0.36 },
};

// ── Module state ───────────────────────────────────────────
let sceneRef = null;
const activeEnemies = [];
const explosionParts = [];

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
const _dir  = new THREE.Vector3();
const _look = new THREE.Vector3();

// ── Public API ─────────────────────────────────────────────

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
  const geo   = getGeo(def.voxelSize);
  const rows  = def.pattern.length;
  const cols  = def.pattern[0].length;
  const cx    = (cols - 1) / 2;
  const cy    = (rows - 1) / 2;

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

  // Tank: one random voxel is weak point (double damage)
  if (type === 'tank') {
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
    mesh:      group,
    material,
    type,
    hp:        Math.round(def.baseHp * levelConfig.hpMultiplier),
    maxHp:     Math.round(def.baseHp * levelConfig.hpMultiplier),
    speed:     def.baseSpeed * levelConfig.speedMultiplier,
    baseColor: new THREE.Color(def.color),
    scoreValue: def.scoreValue,
    hitboxRadius: def.hitboxRadius,
    alertTimer: 0,
    statusEffects: {
      fire:   { stacks: 0, remaining: 0, tickTimer: 0 },
      shock:  { stacks: 0, remaining: 0, tickTimer: 0 },
      freeze: { stacks: 0, remaining: 0 },
    },
  };

  activeEnemies.push(enemy);
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
    if (se.shock.stacks > 0)  speedMod *= Math.max(0.3, 1 - se.shock.stacks * 0.15);
    if (se.freeze.stacks > 0) speedMod *= Math.max(0.1, 1 - se.freeze.stacks * 0.2);

    e.mesh.position.addScaledVector(_dir, e.speed * speedMod * dt);

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
    const dmgRatio = 1 - e.hp / e.maxHp;
    e.material.color.copy(e.baseColor).lerp(_redColor, dmgRatio);
  }

  return collisions;
}

const _redColor = new THREE.Color(0xff0000);

function updateStatusEffects(e, dt) {
  const se = e.statusEffects;

  // Fire DoT
  if (se.fire.remaining > 0) {
    se.fire.remaining -= dt;
    se.fire.tickTimer -= dt;
    if (se.fire.tickTimer <= 0) {
      se.fire.tickTimer = 0.5;
      const fireDmg = se.fire.stacks * 3;
      e.hp -= fireDmg;
      if (e.hp <= 0) e.hp = 0;
      // Store last DoT info for damage numbers
      e._lastDoT = { type: 'fire', damage: fireDmg };
    }
    if (se.fire.remaining <= 0) { se.fire.stacks = 0; se.fire.tickTimer = 0; }
  }

  // Shock DoT
  if (se.shock.remaining > 0) {
    se.shock.remaining -= dt;
    se.shock.tickTimer -= dt;
    if (se.shock.tickTimer <= 0) {
      se.shock.tickTimer = 0.5;
      const shockDmg = se.shock.stacks * 2;
      e.hp -= shockDmg;
      if (e.hp <= 0) e.hp = 0;
      e._lastDoT = { type: 'shock', damage: shockDmg };
    }
    if (se.shock.remaining <= 0) { se.shock.stacks = 0; se.shock.tickTimer = 0; }
  }

  // Freeze (slow only, no DoT — just tick down duration)
  if (se.freeze.remaining > 0) {
    se.freeze.remaining -= dt;
    if (se.freeze.remaining <= 0) se.freeze.stacks = 0;
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
    sprite.userData.lifetime  = 300 + Math.random() * 200;

    explosionParts.push(sprite);
  }

  // Remove enemy mesh from scene
  sceneRef.remove(e.mesh);
  // Dispose material
  e.material.dispose();
  activeEnemies.splice(index, 1);

  return { position: pos, scoreValue: e.scoreValue, baseColor: color };
}

/**
 * Remove all enemies (for level transitions).
 */
export function clearAllEnemies() {
  for (let i = activeEnemies.length - 1; i >= 0; i--) {
    sceneRef.remove(activeEnemies[i].mesh);
    activeEnemies[i].material.dispose();
  }
  activeEnemies.length = 0;
}

/**
 * Animate and clean up explosion particles.
 */
export function updateExplosions(dt, now) {
  for (let i = explosionParts.length - 1; i >= 0; i--) {
    const p   = explosionParts[i];
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
  const list = activeEnemies.map(e => e.mesh);
  if (includeBoss && activeBoss) list.push(activeBoss.mesh);
  return list;
}

/** Find which enemy a raycasted mesh belongs to. */
export function getEnemyByMesh(mesh) {
  let obj = mesh;
  while (obj) {
    if (obj.userData.isBoss) return { boss: activeBoss };
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

const BOSS_SKULL_PATTERN = [
  [0,1,1,1,0],
  [1,1,1,1,1],
  [1,1,0,1,1],
  [1,1,1,1,1],
  [0,1,0,1,0],
];

const BOSS_DEFS = {
  skull:   { pattern: BOSS_SKULL_PATTERN, voxelSize: 0.5, baseHp: 400, phases: 3, color: 0xcccccc, scoreValue: 100 },
  cowboy:  { pattern: [[1,1,1],[1,1,1],[0,1,0]], voxelSize: 0.45, baseHp: 350, phases: 3, color: 0x8B4513, scoreValue: 100 },
  orb:     { pattern: [[1,1],[1,1]], voxelSize: 0.6, baseHp: 300, phases: 2, color: 0xaa00ff, scoreValue: 100 },
  serpent: { pattern: [[1,1,1,1]], voxelSize: 0.4, baseHp: 320, phases: 2, color: 0x00ff88, scoreValue: 100 },
  turret:  { pattern: [[1,1,1],[1,1,1]], voxelSize: 0.5, baseHp: 380, phases: 2, color: 0x666666, scoreValue: 100 },
  // Tier 2–4 reuse same ids with higher baseHp (handled in spawnBoss)
  skull2:  { pattern: BOSS_SKULL_PATTERN, voxelSize: 0.5, baseHp: 600, phases: 3, color: 0xcccccc, scoreValue: 150 },
  cowboy2: { pattern: [[1,1,1],[1,1,1],[0,1,0]], voxelSize: 0.45, baseHp: 550, phases: 3, color: 0x8B4513, scoreValue: 150 },
  orb2:    { pattern: [[1,1],[1,1]], voxelSize: 0.6, baseHp: 500, phases: 2, color: 0xaa00ff, scoreValue: 150 },
  serpent2: { pattern: [[1,1,1,1]], voxelSize: 0.4, baseHp: 520, phases: 2, color: 0x00ff88, scoreValue: 150 },
  turret2: { pattern: [[1,1,1],[1,1,1]], voxelSize: 0.5, baseHp: 580, phases: 2, color: 0x666666, scoreValue: 150 },
  skull3:  { pattern: BOSS_SKULL_PATTERN, voxelSize: 0.5, baseHp: 900, phases: 3, color: 0xcccccc, scoreValue: 200 },
  cowboy3: { pattern: [[1,1,1],[1,1,1],[0,1,0]], voxelSize: 0.45, baseHp: 850, phases: 3, color: 0x8B4513, scoreValue: 200 },
  orb3:    { pattern: [[1,1],[1,1]], voxelSize: 0.6, baseHp: 800, phases: 2, color: 0xaa00ff, scoreValue: 200 },
  serpent3: { pattern: [[1,1,1,1]], voxelSize: 0.4, baseHp: 820, phases: 2, color: 0x00ff88, scoreValue: 200 },
  turret3: { pattern: [[1,1,1],[1,1,1]], voxelSize: 0.5, baseHp: 880, phases: 2, color: 0x666666, scoreValue: 200 },
  skull4:  { pattern: BOSS_SKULL_PATTERN, voxelSize: 0.5, baseHp: 1200, phases: 3, color: 0xcccccc, scoreValue: 300 },
  cowboy4: { pattern: [[1,1,1],[1,1,1],[0,1,0]], voxelSize: 0.45, baseHp: 1150, phases: 3, color: 0x8B4513, scoreValue: 300 },
  orb4:    { pattern: [[1,1],[1,1]], voxelSize: 0.6, baseHp: 1100, phases: 2, color: 0xaa00ff, scoreValue: 300 },
  serpent4: { pattern: [[1,1,1,1]], voxelSize: 0.4, baseHp: 1120, phases: 2, color: 0x00ff88, scoreValue: 300 },
  turret4: { pattern: [[1,1,1],[1,1,1]], voxelSize: 0.5, baseHp: 1180, phases: 2, color: 0x666666, scoreValue: 300 },
};

function buildBossMesh(def, id) {
  const group = new THREE.Group();
  const geo = getGeo(def.voxelSize);
  const mat = new THREE.MeshBasicMaterial({ color: def.color, transparent: true, opacity: 0.9 });
  const rows = def.pattern.length;
  const cols = def.pattern[0].length;
  const cx = (cols - 1) / 2;
  const cy = (rows - 1) / 2;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (def.pattern[r][c]) {
        const cube = new THREE.Mesh(geo, mat.clone());
        cube.position.set((c - cx) * def.voxelSize, (cy - r) * def.voxelSize, 0);
        group.add(cube);
      }
    }
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
  activeBoss = {
    mesh,
    id: bossId,
    hp: maxHp,
    maxHp,
    phase: 1,
    phases: def.phases,
    scoreValue: def.scoreValue,
    baseColor: new THREE.Color(def.color),
    spawnMinionTimer: 0,
  };
  return activeBoss;
}

export function getBoss() {
  return activeBoss;
}

export function hitBoss(damage) {
  if (!activeBoss) return { killed: false };
  activeBoss.hp -= damage;
  if (activeBoss.hp <= 0) activeBoss.hp = 0;
  const prevPhase = activeBoss.phase;
  const phaseThreshold2 = activeBoss.maxHp * (2 / 3);
  const phaseThreshold1 = activeBoss.maxHp * (1 / 3);
  if (activeBoss.phases >= 3 && activeBoss.hp > 0) {
    if (activeBoss.hp <= phaseThreshold1) activeBoss.phase = 3;
    else if (activeBoss.hp <= phaseThreshold2) activeBoss.phase = 2;
  }
  return { killed: activeBoss.hp <= 0, phaseChanged: activeBoss.phase !== prevPhase };
}

export function updateBoss(dt, now, playerPos) {
  if (!activeBoss) return;
  const b = activeBoss;
  _dir.copy(playerPos).sub(b.mesh.position);
  const dist = _dir.length();
  if (dist > 0.01) _dir.divideScalar(dist);
  const speed = 0.4 + (b.phase - 1) * 0.2;
  b.mesh.position.addScaledVector(_dir, speed * dt);
  _look.set(playerPos.x, b.mesh.position.y, playerPos.z);
  b.mesh.lookAt(_look);
  if (b.id === 'skull' || b.id.startsWith('skull')) {
    b.spawnMinionTimer = (b.spawnMinionTimer || 0) - dt;
    if (b.spawnMinionTimer <= 0) {
      b.spawnMinionTimer = 2.5 - b.phase * 0.4;
      spawnBossMinion(b.mesh.position.clone(), playerPos);
    }
  }
}

const bossMinions = [];
function spawnBossMinion(fromPos, playerPos) {
  const group = new THREE.Group();
  const geo = getGeo(0.25);
  const mat = new THREE.MeshBasicMaterial({ color: 0xff4444, transparent: true, opacity: 0.8 });
  for (let i = 0; i < 4; i++) group.add(new THREE.Mesh(geo, mat.clone()));
  group.children[0].position.set(0, 0, 0);
  group.children[1].position.set(0.25, 0, 0);
  group.children[2].position.set(0.5, 0, 0);
  group.children[3].position.set(0.75, 0, 0);
  group.position.copy(fromPos);
  group.userData.isBossMinion = true;
  group.userData.slideAngle = 0;
  group.userData.slideTimer = 0;
  sceneRef.add(group);
  bossMinions.push({ mesh: group, hp: 20, maxHp: 20 });
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
    m.mesh.position.addScaledVector(_dir, 0.6 * dt);
  }
}

export function clearBoss() {
  if (!activeBoss) return;
  sceneRef.remove(activeBoss.mesh);
  activeBoss.mesh.traverse(c => { if (c.geometry) c.geometry.dispose(); if (c.material) c.material.dispose(); });
  activeBoss = null;
  bossMinions.forEach(m => {
    sceneRef.remove(m.mesh);
    m.mesh.traverse(c => { if (c.geometry) c.geometry.dispose(); if (c.material) c.material.dispose(); });
  });
  bossMinions.length = 0;
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
  const angle    = (Math.random() - 0.5) * (100 * Math.PI / 180);
  const distance = 14.4 + Math.random() * 5.6;  // 20% shorter (was 18-25, now 14.4-20)

  const x = Math.sin(angle) * distance;
  const z = -Math.cos(angle) * distance;
  let   y = 1.5;

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
