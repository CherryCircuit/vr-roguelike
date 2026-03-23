# Boss System - Developer Quick Reference

## File Structure

```
vr-roguelike/
├── enemies.js                # Boss framework implementation
├── game.js                   # Boss pool definitions
├── main.js                   # Boss spawning and updates
├── hud.js                    # Boss health bar UI
├── BOSS_ARCHITECTURE.md      # Full architecture docs
└── BOSS_QUICK_REFERENCE.md   # This file
```

## Key Classes

### TelegraphingSystem
Manages visual/audio warnings for boss attacks.

```javascript
// Initialize
const telegraphing = new TelegraphingSystem(scene, camera);

// Start effect
telegraphing.start('projectile', 1.0, 0xff00ff, position, direction);

// Update in game loop
telegraphing.update(dt, now);
```

### Boss (Base Class)
Foundation for all boss types.

```javascript
class Boss {
  constructor(def, levelConfig, scene, telegraphing) {
    // Properties
    this.maxHp = Math.round(def.baseHp * levelConfig.hpMultiplier);
    this.hp = this.maxHp;
    this.phase = 1;
    this.phases = def.phases;
    
    // Methods
    this.takeDamage(amount, hitInfo);
    this.spawnMinion(position, playerPos, type);
    this.fireProjectile(targetPos);
    this.update(dt, now, playerPos);
    this.showTelegraph(type, duration, color, position?, direction?);
    this.destroy();
  }
}
```

### DodgerBoss
Teleporting boss implementation.

```javascript
class DodgerBoss extends Boss {
  // States
  state: 'hidden' | 'appearing' | 'charging' | 'stunned' | 'normal' | 'hiding';
  
  // Properties
  teleportTimer: number;
  chargeTimer: number;
  stunTimer: number;
  
  // Overrides
  updateBehavior(dt, now, playerPos);
  takeDamage(amount, hitInfo);
  onPhaseChange(newPhase);
}
```

## Boss Definitions

### Data Structure
```javascript
{
  id: 'chrono_wraith',
  name: 'Chrono Wraith',
  pattern: [[1, 1, 1, 1]],
  voxelSize: 0.45,
  baseHp: 850,
  phases: 3,
  color: 0x00ff88,
  scoreValue: 100,
  behavior: 'dodger',
  hitboxRadius: 0.45,
  minionSpawnRate: 0,      // Optional
  projectileRate: 0,       // Optional
  weakPoints: true         // Optional
}
```

### Current Bosses

| ID | Name | Behavior | HP | Phases |
|----|------|----------|-----|--------|
| chrono_wraith | Chrono Wraith | dodger | 850 | 3 |

## Boss Tiers

| Tier | Level | HP Mult | Speed Mult | Pool |
|------|-------|---------|------------|------|
| 1 | 5 | 1.0x | 1.0x | chrono_wraith |
| 2 | 10 | 1.5x | 1.2x | chrono_wraith |
| 3 | 15 | 2.0x | 1.4x | chrono_wraith |
| 4 | 20 | 3.0x | 1.6x | chrono_wraith |

## Common Operations

### Spawn Boss
```javascript
import { spawnBoss, getTelegraphingSystem, setCameraRef } from './enemies.js';
import { getRandomBossIdForLevel } from './game.js';

// Initialize telegraphing (once)
setCameraRef(camera);

// Spawn boss
const levelConfig = getLevelConfig();
const bossId = getRandomBossIdForLevel(game.level);
if (bossId) {
  spawnBoss(bossId, levelConfig, camera);
  playBossSpawn();
}
```

### Update Boss
```javascript
import { updateBoss, getBoss } from './enemies.js';

// In game loop
const playerPos = camera.position;
updateBoss(dt, now, playerPos);

// Check if boss exists
const boss = getBoss();
if (boss) {
  updateBossHealthBar(boss.hp, boss.maxHp, boss.phases);
}
```

### Hit Boss
```javascript
import { hitBoss } from './enemies.js';

// When player projectile hits boss
const result = hitBoss(damage, { isWeakPoint: false });

if (result.killed) {
  // Boss defeated
  addScore(boss.scoreValue);
  completeLevel();
}

if (result.phaseChanged) {
  // Phase transition
  console.log(`Phase ${activeBoss.phase}`);
}
```

### Clear Boss
```javascript
import { clearBoss } from './enemies.js';

// When boss defeated or level reset
clearBoss();
```

## Telegraphing Effects

### Types

| Type | Visual | Use Case |
|------|--------|----------|
| projectile | Expanding ring | Ranged attacks |
| charge | Expanding sphere | Rush attacks |
| minion | Expanding arc | Minion spawns |
| teleport | Spinning eye | Teleportation |
| melee | Sweeping arc | Melee attacks |

### Usage
```javascript
// In Boss class
this.showTelegraph('projectile', 1.0, 0xff00ff, position, direction);
```

### Performance
- Max 10 active effects
- Auto-cleanup when finished
- Reuse geometries/materials

## Phase Transitions

### Thresholds
- **Phase 1**: 100% - 66% HP
- **Phase 2**: 66% - 33% HP  
- **Phase 3**: 33% - 0% HP

### Implementation
```javascript
takeDamage(amount, hitInfo) {
  this.hp -= amount;
  
  // Check phase transitions
  const prevPhase = this.phase;
  const phaseThreshold2 = this.maxHp * (2/3);
  const phaseThreshold1 = this.maxHp * (1/3);
  
  if (this.hp <= phaseThreshold1) {
    this.phase = 3;
  } else if (this.hp <= phaseThreshold2) {
    this.phase = 2;
  }
  
  if (this.phase !== prevPhase) {
    this.onPhaseChange(this.phase);
    return { killed: false, phaseChanged: true };
  }
  
  return { killed: this.hp <= 0, phaseChanged: false };
}
```

## Weak Points

### Creation
```javascript
createWeakPoints() {
  const voxels = this.mesh.children.filter(c => c.userData.isBossBody);
  const weakPointCount = Math.floor(voxels.length * 0.2); // 20%
  
  for (let i = 0; i < weakPointCount; i++) {
    const idx = Math.floor(Math.random() * voxels.length);
    const weak = voxels[idx];
    weak.userData.weakPoint = true;
    this.weakPoints.push(weak);
  }
}
```

### Damage
```javascript
takeDamage(amount, hitInfo = {}) {
  if (hitInfo.isWeakPoint) {
    amount *= 2;  // Double damage
  }
  
  this.hp -= amount;
  // ...
}
```

## Minion System

### Spawn Minion
```javascript
spawnMinion(position, playerPos, type = 'basic') {
  const group = new THREE.Group();
  const def = ENEMY_DEFS[type];
  
  // Build minion mesh
  // ...
  
  group.userData.isBossMinion = true;
  scene.add(group);
  bossMinions.push({ mesh: group, hp: def.baseHp, speed: def.baseSpeed });
}
```

### Update Minions
```javascript
updateBossMinions(dt, playerPos) {
  for (let i = bossMinions.length - 1; i >= 0; i--) {
    const m = bossMinions[i];
    
    // Move toward player
    const dir = playerPos.clone().sub(m.mesh.position).normalize();
    m.mesh.position.addScaledVector(dir, m.speed * dt);
    
    // Check collision
    // ...
  }
}
```

## Projectile System

### Spawn Projectile
```javascript
spawnBossProjectile(fromPos, targetPos) {
  const geo = getGeo(0.12);
  const mat = new THREE.MeshBasicMaterial({ color: 0xff0000 });
  const proj = new THREE.Mesh(geo, mat);
  proj.position.copy(fromPos);
  
  const dir = targetPos.clone().sub(fromPos).normalize();
  const speed = 4.0;
  
  scene.add(proj);
  bossProjectiles.push({
    mesh: proj,
    velocity: dir.multiplyScalar(speed),
    createdAt: performance.now(),
    lifetime: 5000
  });
}
```

### Update Projectiles
```javascript
updateBossProjectiles(dt, now, playerPos) {
  for (let i = bossProjectiles.length - 1; i >= 0; i--) {
    const proj = bossProjectiles[i];
    const age = now - proj.createdAt;
    
    if (age > proj.lifetime) {
      // Remove projectile
      scene.remove(proj.mesh);
      proj.mesh.geometry.dispose();
      proj.mesh.material.dispose();
      bossProjectiles.splice(i, 1);
      continue;
    }
    
    // Move projectile
    proj.mesh.position.addScaledVector(proj.velocity, dt);
    
    // Check player collision
    if (proj.mesh.position.distanceTo(playerPos) < 0.5) {
      proj.hitPlayer = true;
    }
  }
}
```

## State Machine (DodgerBoss)

### States
```
hidden → appearing → charging → stunned/normal → hiding → hidden
```

### Implementation
```javascript
updateDodgerState(dt, now, playerPos, dirToPlayer) {
  switch (this.state) {
    case 'hidden':
      this.teleportTimer -= dt;
      if (this.teleportTimer <= 0) {
        this.state = 'appearing';
        // Calculate teleport position
      }
      break;
    
    case 'appearing':
      this.state = 'charging';
      this.chargeTimer = 1.5;
      break;
    
    case 'charging':
      this.chargeTimer -= dt;
      if (this.chargeTimer <= 0) {
        // Check if hit player
        if (hit) {
          this.state = 'hidden';
        } else {
          this.state = 'normal';
        }
      }
      break;
    
    case 'stunned':
      this.stunTimer -= dt;
      if (this.stunTimer <= 0) {
        this.state = 'hidden';
      }
      break;
    
    case 'normal':
      // Move erratically
      // Hide after timer
      if (this.hideTimer <= 0) {
        this.state = 'hiding';
      }
      break;
    
    case 'hiding':
      this.state = 'hidden';
      break;
  }
}
```

## Difficulty Scaling

### Apply Tier Multipliers
```javascript
// HP already scaled by levelConfig.hpMultiplier
this.maxHp = Math.round(def.baseHp * levelConfig.hpMultiplier);

// Speed already scaled by levelConfig.speedMultiplier
const speed = baseSpeed * levelConfig.speedMultiplier;
```

### Apply Phase Multipliers
```javascript
// In updateBehavior
const speedMult = 1.0 + (this.phase - 1) * 0.3;
const attackRateMult = 1.0 + (this.phase - 1) * 0.2;

const actualSpeed = baseSpeed * speedMult;
const actualAttackRate = baseAttackRate / attackRateMult;
```

## Performance Tips

### Object Pooling
```javascript
// Reuse projectile meshes
const projectilePool = [];

function getProjectile() {
  for (const proj of projectilePool) {
    if (!proj.visible) {
      proj.visible = true;
      return proj;
    }
  }
  return null;
}
```

### Limit Active Objects
```javascript
// Max minions
if (bossMinions.length >= 20) return;

// Max telegraph effects
if (telegraphing.activeEffects.length >= 10) return;

// Max projectiles
if (bossProjectiles.length >= 50) return;
```

### Cleanup
```javascript
// On boss death
clearBoss() {
  // Remove boss mesh
  activeBoss.destroy();
  
  // Clear minions
  bossMinions.forEach(m => scene.remove(m.mesh));
  bossMinions.length = 0;
  
  // Clear projectiles
  bossProjectiles.forEach(p => {
    scene.remove(p.mesh);
    p.mesh.geometry.dispose();
    p.mesh.material.dispose();
  });
  bossProjectiles.length = 0;
}
```

## Testing Commands

### Spawn Specific Boss
```javascript
// In browser console
import { spawnBoss } from './enemies.js';
spawnBoss('chrono_wraith', getLevelConfig(), camera);
```

### Set Boss HP
```javascript
// In browser console
const boss = getBoss();
if (boss) {
  boss.hp = boss.maxHp * 0.5;  // 50% HP
  console.log(`HP: ${boss.hp}/${boss.maxHp}`);
}
```

### Trigger Phase Change
```javascript
// In browser console
const boss = getBoss();
if (boss) {
  boss.hp = boss.maxHp * 0.3;  // Trigger phase 3
  hitBoss(0);  // Force phase check
}
```

### Test Telegraphing
```javascript
// In browser console
const telegraphing = getTelegraphingSystem();
telegraphing.start('projectile', 2.0, 0xff00ff, camera.position);
```

## Debug Mode

Enable debug logging:
```javascript
localStorage.setItem('debug_boss', 'true');
```

Then in enemies.js:
```javascript
if (localStorage.getItem('debug_boss') === 'true') {
  console.log('[Boss] State:', this.state, 'HP:', this.hp);
}
```

## Common Pitfalls

### 1. Not Checking Boss Exists
❌ `const hp = getBoss().hp;`
✅ `const boss = getBoss(); if (boss) { const hp = boss.hp; }`

### 2. Not Disposing Resources
❌ `scene.remove(boss.mesh);`
✅ `boss.destroy();` (calls dispose internally)

### 3. Not Clearing Minions/Projectiles
❌ `clearBoss();` (without clearing minions)
✅ `clearBoss();` (already clears minions and projectiles)

### 4. Missing Telegraphing System
❌ `const telegraphing = new TelegraphingSystem(scene, null);`
✅ `setCameraRef(camera);` (called once during init)

## Next Steps

1. Read BOSS_ARCHITECTURE.md for full design
2. Implement additional boss types (Turret, Spawner, Charger)
3. Test all boss tiers
4. Balance difficulty scaling
5. Add visual polish (death effects, spawn effects)
