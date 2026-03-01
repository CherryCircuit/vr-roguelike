# INSTRUCTION SET 5: Boss Fight System

## Overview
Create epic boss fights that last at least 2 minutes, with pools of 5 different bosses per tier, each with unique attack patterns and mechanics.

## Requirements

**Boss Tiers:**
- Tier 1: Level 5 (5 boss types)
- Tier 2: Level 10 (5 boss types)
- Tier 3: Level 15 (5 boss types)
- Tier 4: Level 20 (5 boss types)

**Fight Duration:**
- Minimum 2 minutes per boss fight
- Boss health scales to ensure this duration
- Attacks become more aggressive as health depletes

**Boss Selection:**
- Random boss from pool of 5 for that tier
- Each boss has unique visual design and attack patterns

## Existing Boss System

The code already has boss pools defined in `game.js`:

```javascript
const BOSS_POOL_TIER1 = ['grave_voxel', 'iron_sentry', 'chrono_wraith', 'siege_ram', 'core_guardian'];
const BOSS_POOL_TIER2 = ['grave_voxel2', 'iron_sentry2', 'chrono_wraith2', 'siege_ram2', 'core_guardian2'];
const BOSS_POOL_TIER3 = ['grave_voxel3', 'iron_sentry3', 'chrono_wraith3', 'siege_ram3', 'core_guardian3'];
const BOSS_POOL_TIER4 = ['grave_voxel4', 'iron_sentry4', 'chrono_wraith4', 'siege_ram4', 'core_guardian4'];
```

And function to pick random boss:

```javascript
export function getRandomBossIdForLevel(level) {
  const tier = getBossTier(level);
  if (tier === 0) return null;
  const pools = { 1: BOSS_POOL_TIER1, 2: BOSS_POOL_TIER2, 3: BOSS_POOL_TIER3, 4: BOSS_POOL_TIER4 };
  const pool = pools[tier];
  return pool[Math.floor(Math.random() * pool.length)];
}
```

## Implementation Steps

### Step 1: Define Boss Stats

In `enemies.js`, add boss definitions:

```javascript
const BOSS_BASE_HEALTH = 5000;  // Base health for tier 1
const BOSS_HEALTH_MULTIPLIER = 2.5;  // Each tier multiplies by this

export const BOSS_DEFINITIONS = {
  // ═══════════════════════════════════════════════════════
  // TIER 1 - Level 5
  // ═══════════════════════════════════════════════════════

  grave_voxel: {
    name: 'Grave Voxel',
    tier: 1,
    health: BOSS_BASE_HEALTH,
    size: 3,
    color: 0x8800ff,
    speed: 2,
    attacks: ['summon_minions', 'ground_slam', 'voxel_barrage'],
    attackInterval: 3.0,  // Attacks every 3 seconds
    phase2Threshold: 0.5,  // Phase 2 at 50% health
  },

  iron_sentry: {
    name: 'Iron Sentry',
    tier: 1,
    health: BOSS_BASE_HEALTH,
    size: 3.5,
    color: 0xcccccc,
    speed: 1,
    attacks: ['laser_sweep', 'missile_barrage', 'shield_bash'],
    attackInterval: 2.5,
    phase2Threshold: 0.5,
  },

  chrono_wraith: {
    name: 'Chrono Wraith',
    tier: 1,
    health: BOSS_BASE_HEALTH * 0.8,  // Less health, more evasive
    size: 2.5,
    color: 0x00ffff,
    speed: 4,
    attacks: ['teleport', 'time_slow_aura', 'energy_bolts'],
    attackInterval: 2.0,
    phase2Threshold: 0.6,
  },

  siege_ram: {
    name: 'Siege Ram',
    tier: 1,
    health: BOSS_BASE_HEALTH * 1.3,  // Tank boss
    size: 4,
    color: 0xff4400,
    speed: 3,
    attacks: ['charge_attack', 'shockwave', 'stomp'],
    attackInterval: 4.0,
    phase2Threshold: 0.4,
  },

  core_guardian: {
    name: 'Core Guardian',
    tier: 1,
    health: BOSS_BASE_HEALTH,
    size: 3,
    color: 0xff00ff,
    speed: 2,
    attacks: ['shield_pulse', 'core_beam', 'spawn_turrets'],
    attackInterval: 3.5,
    phase2Threshold: 0.5,
  },

  // ═══════════════════════════════════════════════════════
  // TIER 2 - Level 10 (same bosses, upgraded)
  // ═══════════════════════════════════════════════════════

  grave_voxel2: {
    name: 'Grave Voxel MK-II',
    tier: 2,
    health: BOSS_BASE_HEALTH * BOSS_HEALTH_MULTIPLIER,
    size: 3.5,
    color: 0xaa00ff,
    speed: 2.5,
    attacks: ['summon_minions', 'ground_slam', 'voxel_barrage', 'necro_wave'],
    attackInterval: 2.5,
    phase2Threshold: 0.5,
  },

  iron_sentry2: {
    name: 'Iron Sentry MK-II',
    tier: 2,
    health: BOSS_BASE_HEALTH * BOSS_HEALTH_MULTIPLIER,
    size: 4,
    color: 0xaaaaaa,
    speed: 1.5,
    attacks: ['laser_sweep', 'missile_barrage', 'shield_bash', 'emp_pulse'],
    attackInterval: 2.0,
    phase2Threshold: 0.5,
  },

  chrono_wraith2: {
    name: 'Chrono Wraith MK-II',
    tier: 2,
    health: BOSS_BASE_HEALTH * BOSS_HEALTH_MULTIPLIER * 0.8,
    size: 3,
    color: 0x00ffdd,
    speed: 5,
    attacks: ['teleport', 'time_slow_aura', 'energy_bolts', 'temporal_split'],
    attackInterval: 1.8,
    phase2Threshold: 0.6,
  },

  siege_ram2: {
    name: 'Siege Ram MK-II',
    tier: 2,
    health: BOSS_BASE_HEALTH * BOSS_HEALTH_MULTIPLIER * 1.3,
    size: 4.5,
    color: 0xff6600,
    speed: 3.5,
    attacks: ['charge_attack', 'shockwave', 'stomp', 'flame_trail'],
    attackInterval: 3.5,
    phase2Threshold: 0.4,
  },

  core_guardian2: {
    name: 'Core Guardian MK-II',
    tier: 2,
    health: BOSS_BASE_HEALTH * BOSS_HEALTH_MULTIPLIER,
    size: 3.5,
    color: 0xff00dd,
    speed: 2.5,
    attacks: ['shield_pulse', 'core_beam', 'spawn_turrets', 'overcharge'],
    attackInterval: 3.0,
    phase2Threshold: 0.5,
  },

  // ═══════════════════════════════════════════════════════
  // TIER 3 & 4: Similar pattern, scale up stats
  // (Define all 10 more bosses here with same pattern)
  // ═══════════════════════════════════════════════════════
};
```

### Step 2: Create Boss Entity

In `enemies.js`, add boss spawning:

```javascript
let currentBoss = null;

export function spawnBoss(bossId) {
  const def = BOSS_DEFINITIONS[bossId];
  if (!def) {
    console.error('Unknown boss ID:', bossId);
    return null;
  }

  console.log(`Spawning boss: ${def.name}`);

  // Create boss mesh (much larger than normal enemies)
  const geo = new THREE.BoxGeometry(def.size, def.size, def.size);
  const mat = new THREE.MeshStandardMaterial({
    color: def.color,
    emissive: def.color,
    emissiveIntensity: 0.3,
    metalness: 0.7,
    roughness: 0.3
  });
  const mesh = new THREE.Mesh(geo, mat);

  // Spawn position: center of arena, elevated
  mesh.position.set(0, def.size / 2 + 2, -15);

  scene.add(mesh);

  // Boss entity
  currentBoss = {
    id: bossId,
    def: def,
    mesh: mesh,
    health: def.health,
    maxHealth: def.health,
    phase: 1,
    attackTimer: 0,
    movePattern: 'circle',  // Circle around player
    moveTimer: 0,
    invulnerable: false,  // For teleport/shield phases
  };

  // Show boss health bar
  showBossHealthBar(def.name, 1.0);

  // Play boss intro sound
  playBossIntroSound();

  return currentBoss;
}
```

### Step 3: Boss Movement Patterns

```javascript
function updateBoss(delta) {
  if (!currentBoss) return;

  const boss = currentBoss;
  const def = boss.def;

  // Update attack timer
  boss.attackTimer -= delta;
  if (boss.attackTimer <= 0) {
    executeBossAttack(boss);
    boss.attackTimer = def.attackInterval;
  }

  // Movement pattern
  boss.moveTimer += delta;

  switch (boss.movePattern) {
    case 'circle':
      // Circle around player
      const radius = 10;
      const angle = boss.moveTimer * def.speed * 0.1;
      boss.mesh.position.x = Math.cos(angle) * radius;
      boss.mesh.position.z = Math.sin(angle) * radius - 15;
      break;

    case 'strafe':
      // Side-to-side strafing
      boss.mesh.position.x = Math.sin(boss.moveTimer * def.speed) * 8;
      break;

    case 'charge':
      // Charge toward player (for Siege Ram)
      // Implemented in attack function
      break;

    case 'teleport':
      // Random teleportation (for Chrono Wraith)
      // Implemented in attack function
      break;
  }

  // Check phase transition
  const healthPercent = boss.health / boss.maxHealth;
  if (healthPercent <= def.phase2Threshold && boss.phase === 1) {
    enterPhase2(boss);
  }

  // Update health bar
  updateBossHealthBar(healthPercent);

  // Look at player
  boss.mesh.lookAt(camera.position);
}
```

### Step 4: Attack Implementations

```javascript
function executeBossAttack(boss) {
  if (boss.invulnerable) return;

  const attackType = boss.def.attacks[Math.floor(Math.random() * boss.def.attacks.length)];

  console.log(`Boss attack: ${attackType}`);

  switch (attackType) {
    case 'summon_minions':
      // Spawn 3-5 basic enemies
      for (let i = 0; i < 3 + Math.floor(Math.random() * 3); i++) {
        const angle = Math.random() * Math.PI * 2;
        const dist = 5;
        spawnEnemy('basic', {
          x: boss.mesh.position.x + Math.cos(angle) * dist,
          y: 1,
          z: boss.mesh.position.z + Math.sin(angle) * dist
        });
      }
      playBossSummonSound();
      break;

    case 'ground_slam':
      // AOE damage around boss
      createShockwave(boss.mesh.position, 5, 20);
      playBossGroundSlamSound();
      break;

    case 'voxel_barrage':
      // Fire multiple projectiles in spread
      for (let i = 0; i < 8; i++) {
        const angle = (i / 8) * Math.PI * 2;
        fireBossProjectile(boss.mesh.position, angle, 10);
      }
      playBossProjectileSound();
      break;

    case 'laser_sweep':
      // Rotating laser beam
      createLaserSweep(boss.mesh.position, 3.0);
      break;

    case 'missile_barrage':
      // Homing missiles
      for (let i = 0; i < 4; i++) {
        setTimeout(() => {
          fireHomingMissile(boss.mesh.position, camera.position);
        }, i * 200);
      }
      break;

    case 'teleport':
      // Teleport to random position
      boss.invulnerable = true;
      boss.mesh.visible = false;
      setTimeout(() => {
        const angle = Math.random() * Math.PI * 2;
        boss.mesh.position.x = Math.cos(angle) * 12;
        boss.mesh.position.z = Math.sin(angle) * 12 - 15;
        boss.mesh.visible = true;
        boss.invulnerable = false;
      }, 1000);
      playBossTeleportSound();
      break;

    case 'charge_attack':
      // Charge toward player
      chargeAtPlayer(boss);
      break;

    // ... implement other attack types ...
  }
}

function enterPhase2(boss) {
  boss.phase = 2;
  console.log(`${boss.def.name} entering Phase 2!`);

  // Speed up attacks
  boss.def.attackInterval *= 0.7;

  // Change color to red
  boss.mesh.material.color.setHex(0xff0000);
  boss.mesh.material.emissive.setHex(0xff0000);

  // Flash effect
  boss.mesh.material.emissiveIntensity = 1.0;
  setTimeout(() => {
    boss.mesh.material.emissiveIntensity = 0.3;
  }, 500);

  // Show phase 2 message
  showBigMessage('PHASE 2', 2.0);
  playBossPhase2Sound();
}
```

### Step 5: Boss Damage and Death

```javascript
export function damageBoss(amount) {
  if (!currentBoss || currentBoss.invulnerable) return false;

  currentBoss.health -= amount;

  // Damage number
  showDamageNumber(currentBoss.mesh.position, amount, 0xff0000);

  // Hit flash
  currentBoss.mesh.material.emissiveIntensity = 0.8;
  setTimeout(() => {
    currentBoss.mesh.material.emissiveIntensity = 0.3;
  }, 100);

  if (currentBoss.health <= 0) {
    killBoss();
    return true;  // Boss dead
  }

  return false;  // Boss still alive
}

function killBoss() {
  console.log(`Boss defeated: ${currentBoss.def.name}`);

  // Huge explosion
  createMassiveExplosion(currentBoss.mesh.position);

  // Remove boss
  scene.remove(currentBoss.mesh);
  currentBoss = null;

  // Hide health bar
  hideBossHealthBar();

  // Award score (bonus for bosses)
  addScore(10000);

  // Mark as boss kill for special upgrades
  game.justBossKill = true;

  // Play victory sound
  playBossDefeatSound();

  // Trigger level complete
  game.state = State.LEVEL_COMPLETE_SLOWMO;
  game.stateTimer = 0;
}
```

### Step 6: Integrate with Main Loop

In `main.js`, update the animate loop:

```javascript
function animate() {
  // ... existing code ...

  if (game.state === State.PLAYING) {
    const delta = clock.getDelta();

    // Update boss if active
    if (currentBoss) {
      updateBoss(delta);
    } else {
      // Regular enemy spawning
      spawnEnemiesNormally();
    }

    // ... rest of game logic ...
  }

  // ... rest of animate ...
}
```

### Step 7: Boss Spawning on Boss Levels

In level start logic:

```javascript
function startLevel() {
  const config = getLevelConfig();

  if (config.isBoss) {
    // Boss level
    const bossId = getRandomBossIdForLevel(game.level);
    console.log(`Boss level ${game.level}, spawning:`, bossId);

    // Clear any existing enemies
    clearAllEnemies();

    // Show boss alert screen
    game.state = State.BOSS_ALERT;
    game.stateTimer = 3.0;  // 3 second alert

    // Store boss ID for after alert
    game.nextBossId = bossId;
  } else {
    // Normal level
    game.state = State.PLAYING;
    game.stateTimer = 0;
  }
}

// In state machine update:
if (game.state === State.BOSS_ALERT) {
  game.stateTimer -= delta;
  if (game.stateTimer <= 0) {
    // Spawn the boss
    spawnBoss(game.nextBossId);
    game.state = State.PLAYING;
  }
}
```

## Health Calculation for 2+ Minute Fights

Target: 2 minutes = 120 seconds

Assuming player DPS (damage per second):
- Tier 1: ~50 DPS → Boss needs 6000 HP
- Tier 2: ~100 DPS → Boss needs 12000 HP
- Tier 3: ~200 DPS → Boss needs 24000 HP
- Tier 4: ~400 DPS → Boss needs 48000 HP

Tune `BOSS_BASE_HEALTH` and `BOSS_HEALTH_MULTIPLIER` based on playtesting.

## Testing Checklist

- [ ] Each boss spawns correctly
- [ ] Boss attacks are distinct and visible
- [ ] Fights last at least 2 minutes
- [ ] Phase 2 transition works
- [ ] Boss death triggers level complete
- [ ] Health bar displays correctly
- [ ] All 5 bosses per tier implemented
- [ ] Boss selection is random from pool
- [ ] No performance drops during boss fights

## Sound Effects

Add these boss sounds to `audio.js`:

```javascript
export function playBossIntroSound() {
  // Deep rumble with rising pitch
}

export function playBossSummonSound() {
  // Mystical summoning sound
}

export function playBossGroundSlamSound() {
  // Heavy impact with shockwave
}

export function playBossProjectileSound() {
  // Energy weapon firing
}

export function playBossTeleportSound() {
  // Woosh with pitch bend
}

export function playBossPhase2Sound() {
  // Dramatic power-up sound
}

export function playBossDefeatSound() {
  // Victory fanfare
}
```

## Notes

- Boss fights should feel epic, not grindy
- Telegraphing attacks is important (visual wind-up before attack)
- Consider adding invulnerability phases for attack animations
- Test each boss fight to ensure they're fun, not frustrating
- Balance: Dodge-able attacks vs unavoidable chip damage
