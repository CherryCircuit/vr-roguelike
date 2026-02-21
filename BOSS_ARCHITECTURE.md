# Boss System Architecture Design

## Overview

This document defines the architecture for the boss system framework, implementing scalable boss encounters with phase transitions, telegraphing, and difficulty progression.

## Architecture Principles

1. **Modular Design**: Boss behaviors are composable and reusable
2. **Data-Driven**: Boss definitions stored in data structures
3. **Phase-Based**: All bosses support multi-phase encounters
4. **Telegraphing**: Visual/audio warnings for all major attacks
5. **Difficulty Scaling**: Bosses scale with level/tier
6. **Performance-Friendly**: Object pooling and efficient updates

---

## 1. System Components

### 1.1 Telegraphing System

**Purpose**: Provide visual/audio warnings for boss attacks

**Characteristics**:
- Multiple warning types (projectile, charge, minion, teleport, melee)
- Automatic cleanup and performance management
- Camera-attached for visibility
- Sound integration

**Data Structure**:
```typescript
interface TelegraphEffect {
  type: 'projectile' | 'charge' | 'minion' | 'teleport' | 'melee';
  startTime: number;           // When effect started (ms)
  duration: number;            // How long it lasts (ms)
  color: number;               // Hex color
  mesh: THREE.Mesh | null;     // Visual representation
  data: object;                // Type-specific data
}

class TelegraphingSystem {
  scene: THREE.Scene;
  camera: THREE.Camera;
  activeEffects: TelegraphEffect[];
  maxEffects: number;          // Performance limit (default: 10)
  
  // Start a telegraphing effect
  start(type, duration, color, position?, direction?): TelegraphEffect;
  
  // Update all active effects
  update(dt: number, now: number): void;
  
  // Remove finished effects
  removeEffect(effect: TelegraphEffect): void;
  
  // Play telegraph sound
  playSound(type: string, duration: number): void;
}
```

**Effect Types**:
- **projectile**: Expanding ring showing incoming projectile direction
- **charge**: Large expanding sphere indicating charge attack
- **minion**: Expanding arc showing spawn direction
- **teleport**: Spinning eye effect for teleportation
- **melee**: Large sweeping arc for melee attacks

### 1.2 Boss Base Class

**Purpose**: Foundation for all boss types with common functionality

**Characteristics**:
- Phase transitions (66%, 33% health by default)
- Weak point system
- Minion spawning framework
- Projectile firing framework
- Telegraphing integration
- Health bar UI updates

**Data Structure**:
```typescript
interface BossDefinition {
  id: string;                  // Unique identifier
  name: string;                // Display name
  pattern: number[][];         // Voxel pattern
  voxelSize: number;           // Size of each voxel
  baseHp: number;              // Base health points
  phases: number;              // Number of phases (default: 3)
  color: number;               // Hex color
  scoreValue: number;          // Score awarded on defeat
  behavior: string;            // Behavior type ID
  hitboxRadius: number;        // Collision radius
  minionSpawnRate?: number;    // Seconds between minion spawns
  projectileRate?: number;     // Seconds between projectiles
  weakPoints?: boolean;        // Whether boss has weak points
}

class Boss {
  def: BossDefinition;
  levelConfig: LevelConfig;
  sceneRef: THREE.Scene;
  telegraphing: TelegraphingSystem;
  
  // Health and phases
  maxHp: number;
  hp: number;
  phase: number;               // Current phase (1-3)
  phases: number;              // Total phases
  
  // Stats
  scoreValue: number;
  baseColor: THREE.Color;
  
  // Mesh
  mesh: THREE.Group;
  
  // Behavior state
  state: string;
  stateTimer: number;
  stateStartTime: number;
  
  // Weak points
  weakPoints: THREE.Mesh[];
  
  // Minion spawning
  minionSpawnTimer: number;
  minionSpawnRate: number;
  
  // Projectiles
  projectileTimer: number;
  projectileRate: number;
  
  // Telegraphing
  telegraphCooldown: number;
  
  constructor(def, levelConfig, scene, telegraphing);
  
  // Build visual mesh from definition
  buildMesh(def: BossDefinition): THREE.Group;
  
  // Create weak points on voxels
  createWeakPoints(): void;
  
  // Take damage and handle phase transitions
  takeDamage(amount: number, hitInfo?: object): DamageResult;
  
  // Spawn minion at position
  spawnMinion(position: THREE.Vector3, playerPos: THREE.Vector3, type?: string): void;
  
  // Fire projectile at target
  fireProjectile(targetPos: THREE.Vector3): void;
  
  // Update boss behavior
  update(dt: number, now: number, playerPos: THREE.Vector3): void;
  
  // Update behavior-specific logic (override in subclasses)
  updateBehavior(dt: number, now: number, playerPos: THREE.Vector3): void;
  
  // Handle minion spawning
  onMinionSpawn(playerPos: THREE.Vector3): void;
  
  // Handle projectile firing
  onProjectileFire(playerPos: THREE.Vector3): void;
  
  // Transition to new phase
  transitionToPhase(newPhase: number): void;
  
  // Called when phase changes
  onPhaseChange(newPhase: number): void;
  
  // Show telegraphing effect
  showTelegraph(type: string, duration: number, color: number, position?, direction?): boolean;
  
  // Get boss info
  getBoss(): BossInfo;
  
  // Clean up boss
  destroy(): void;
}

interface DamageResult {
  killed: boolean;              // Boss was killed
  phaseChanged: boolean;        // Phase transition occurred
  isWeakPointHit: boolean;      // Hit a weak point
}

interface BossInfo {
  mesh: THREE.Group;
  hp: number;
  maxHp: number;
  phase: number;
}
```

### 1.3 Boss Subclasses

Each boss behavior extends the base Boss class:

**DodgerBoss (Teleporting Boss)**:
```typescript
class DodgerBoss extends Boss {
  // State machine states
  state: 'hidden' | 'appearing' | 'charging' | 'stunned' | 'normal' | 'hiding';
  
  // Dodger-specific properties
  teleportTimer: number;
  chargeTimer: number;
  chargeActive: boolean;
  stunTimer: number;
  hasFirstAppeared: boolean;
  firstAppearanceFront: boolean;
  chargeHasExploded: boolean;
  hideTimer: number;
  dodgeTimer: number;
  dodgeDir: THREE.Vector3;
  
  // Override behavior update
  updateBehavior(dt, now, playerPos): void;
  
  // Dodger state machine
  updateDodgerState(dt, now, playerPos, dirToPlayer): void;
  
  // Visual effects
  updateVisualEffects(now: number): void;
  
  // Override damage handling
  takeDamage(amount, hitInfo): DamageResult;
  
  // Override phase change
  onPhaseChange(newPhase: number): void;
}
```

**Future Boss Types** (to be implemented):
- **TurretBoss**: Stationary with projectile patterns
- **SpawnerBoss**: Summons minion waves
- **ChargerBoss**: Rush attacks with knockback
- **ShieldedBoss**: Alternating invulnerability phases
- **HybridBoss**: Multiple behavior combinations

### 1.4 Boss Pool Management

**Purpose**: Track active boss and manage lifecycle

**Data Structure**:
```typescript
interface BossState {
  activeBoss: Boss | null;
  telegraphingSystem: TelegraphingSystem | null;
  bossMinions: BossMinion[];
  bossProjectiles: BossProjectile[];
}

interface BossMinion {
  mesh: THREE.Group;
  hp: number;
  maxHp: number;
  speed: number;
}

interface BossProjectile {
  mesh: THREE.Mesh;
  velocity: THREE.Vector3;
  createdAt: number;
  lifetime: number;
  hitPlayer?: boolean;
}
```

---

## 2. Boss Definitions

### 2.1 Current Bosses

**Chrono Wraith (Teleporting Boss)**:
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
  hitboxRadius: 0.45
}
```

### 2.2 Boss Tiers

Bosses are organized by tier (level 5, 10, 15, 20):

```typescript
interface BossTier {
  tier: number;                // 1-4
  levels: number[];            // Levels this tier appears
  hpMultiplier: number;        // HP scaling
  speedMultiplier: number;     // Speed scaling
  pool: string[];              // Available boss IDs
}

const BOSS_TIERS: BossTier[] = [
  {
    tier: 1,
    levels: [5],
    hpMultiplier: 1.0,
    speedMultiplier: 1.0,
    pool: ['chrono_wraith']
  },
  {
    tier: 2,
    levels: [10],
    hpMultiplier: 1.5,
    speedMultiplier: 1.2,
    pool: ['chrono_wraith']
  },
  {
    tier: 3,
    levels: [15],
    hpMultiplier: 2.0,
    speedMultiplier: 1.4,
    pool: ['chrono_wraith']
  },
  {
    tier: 4,
    levels: [20],
    hpMultiplier: 3.0,
    speedMultiplier: 1.6,
    pool: ['chrono_wraith']
  }
];
```

---

## 3. Boss Factory Pattern

### 3.1 Factory Implementation

**Purpose**: Centralized boss creation and management

```typescript
class BossFactory {
  // Get boss definition by ID
  static getBossDef(id: string): BossDefinition | null {
    return BOSS_DEFS[id] || null;
  }
  
  // Get random boss for level
  static getRandomBossForLevel(level: number): string | null {
    const tier = getBossTier(level);
    if (tier === 0) return null;
    
    const pool = BOSS_POOLS[tier];
    return pool[Math.floor(Math.random() * pool.length)];
  }
  
  // Create boss instance
  static createBoss(bossId: string, levelConfig: LevelConfig, scene: THREE.Scene, telegraphing: TelegraphingSystem): Boss | null {
    const def = this.getBossDef(bossId);
    if (!def) return null;
    
    // Create appropriate boss class based on behavior
    switch (def.behavior) {
      case 'dodger':
        return new DodgerBoss(def, levelConfig, scene, telegraphing);
      
      case 'turret':
        // return new TurretBoss(def, levelConfig, scene, telegraphing);
        return new Boss(def, levelConfig, scene, telegraphing);
      
      case 'spawner':
        // return new SpawnerBoss(def, levelConfig, scene, telegraphing);
        return new Boss(def, levelConfig, scene, telegraphing);
      
      case 'charger':
        // return new ChargerBoss(def, levelConfig, scene, telegraphing);
        return new Boss(def, levelConfig, scene, telegraphing);
      
      default:
        return new Boss(def, levelConfig, scene, telegraphing);
    }
  }
  
  // Get boss tier for level
  static getBossTier(level: number): number {
    if (level % 5 !== 0) return 0;
    return level / 5; // 1-4
  }
}
```

---

## 4. Lifecycle Management

### 4.1 Boss Lifecycle Flow

```
Level Start (Boss Level)
      │
      ▼
┌─────────────────────┐
│ Check if boss level │
│ (level % 5 === 0)   │
└─────────────────────┘
      │
      ├─── YES ──────────────┐
      │                       │
      │                       ▼
      │             ┌──────────────────┐
      │             │ Get random boss  │
      │             │ from tier pool   │
      │             └──────────────────┘
      │                       │
      │                       ▼
      │             ┌──────────────────┐
      │             │ Create boss      │
      │             │ (BossFactory)    │
      │             └──────────────────┘
      │                       │
      │                       ▼
      │             ┌──────────────────┐
      │             │ Spawn boss in    │
      │             │ scene            │
      │             └──────────────────┘
      │                       │
      │                       ▼
      │             ┌──────────────────┐
      │             │ Show boss health │
      │             │ bar (HUD)        │
      │             └──────────────────┘
      │                       │
      │                       ▼
      │             ┌──────────────────┐
      │             │ FIGHT PHASE      │
      │             │                  │
      │             │ • Update boss    │
      │             │ • Check damage   │
      │             │ • Handle phases  │
      │             │ • Spawn minions  │
      │             │ • Fire projectiles│
      │             └──────────────────┘
      │                       │
      │                       ├─── hp <= 0 ───────┐
      │                       │                    │
      │                       │                    ▼
      │                       │          ┌──────────────────┐
      │                       │          │ Boss defeated    │
      │                       │          │ • Play death FX  │
      │                       │          │ • Award score    │
      │                       │          │ • Clear boss     │
      │                       │          │ • Hide health    │
      │                       │          │   bar            │
      │                       │          │ • Complete level │
      │                       │          └──────────────────┘
      │                       │
      │                       └─────── hp > 0 ──────┐
      │                                              │
      │                                              │
      └──────────────────────────────────────────────┘
                                                     │
                                                     │
                                                     ▼
                                           Continue fighting
```

### 4.2 State Machine

Each boss uses a state machine for behavior:

**DodgerBoss State Machine**:
```
┌─────────┐
│ hidden  │ ◄─────────────────────┐
└─────────┘                       │
     │                            │
     │ teleportTimer <= 0         │
     ▼                            │
┌──────────┐                      │
│ appearing│                      │
└──────────┘                      │
     │                            │
     ▼                            │
┌──────────┐                      │
│ charging │ ── hit during ─────► │
└──────────┘    charge            │
     │                            │
     │ chargeTimer <= 0           │
     │                            │
     ├── hit player ─────────────►│
     │                            │
     │                            ▼
     │                       ┌─────────┐
     └── missed player ────► │ stunned │
                             └─────────┘
     │                            │
     │                            │ stunTimer <= 0
     ▼                            │
┌──────────┐                      │
│ normal   │ ◄────────────────────┘
└──────────┘
     │
     │ hideTimer <= 0
     ▼
┌──────────┐
│ hiding   │
└──────────┘
     │
     └──────────────────────► back to hidden
```

---

## 5. Encounter Patterns

### 5.1 Pattern Types

**Phase Transition Pattern**:
```
Phase 1 (100% - 66% HP)
  • Base behavior
  • Standard attacks
  
Phase 2 (66% - 33% HP)
  • Enhanced behavior
  • Faster attacks
  • More aggressive
  
Phase 3 (33% - 0% HP)
  • Maximum aggression
  • All abilities
  • Desperate attacks
```

**Telegraphing Pattern**:
```
1. Telegraph warning (visual + audio)
   └─ Duration: 0.5-2.0 seconds
   
2. Attack execution
   └─ Damage dealing
   
3. Cooldown
   └─ Telegraph cooldown (0.5s minimum)
   
4. Repeat or change behavior
```

**Weak Point Pattern**:
```
1. Boss spawns with random voxels marked as weak points
   └─ Typically 20% of voxels
   
2. Player hits weak point
   └─ 2x damage multiplier
   
3. Player hits normal body
   └─ 1x damage multiplier
   
4. Visual feedback
   └─ Different color/sound for weak point hits
```

**Minion Spawn Pattern**:
```
1. Timer counts down (minionSpawnRate)
   
2. Telegraph minion spawn (0.5s warning)
   
3. Spawn minion at boss position
   └─ Minion moves toward player
   
4. Limit active minions (performance)
   └─ Max 10-20 minions at once
   
5. Repeat
```

### 5.2 Boss Archetypes

**Dodger (Teleporting)**:
- **Behavior**: Teleports around player, charges with explosion
- **Weakness**: Stunned when hit during charge
- **Phase Scaling**: Faster dodges, wider teleport angles
- **Difficulty**: Moderate

**Turret (Stationary)**:
- **Behavior**: Stays in place, fires projectile patterns
- **Weakness**: Exposed during projectile cooldown
- **Phase Scaling**: More projectiles, faster fire rate
- **Difficulty**: Easy

**Spawner (Summoner)**:
- **Behavior**: Spawns minion waves, stays back
- **Weakness**: Vulnerable when minions die
- **Phase Scaling**: More minions, faster spawns
- **Difficulty**: Hard

**Charger (Rusher)**:
- **Behavior**: Rushes at player with knockback
- **Weakness**: Long recovery after charge
- **Phase Scaling**: Faster charges, longer knockback
- **Difficulty**: Moderate

**Shielded (Phased)**:
- **Behavior**: Alternates invulnerable and vulnerable phases
- **Weakness**: Damage only during vulnerable phase
- **Phase Scaling**: Shorter vulnerable windows
- **Difficulty**: Hard

---

## 6. Difficulty Scaling

### 6.1 Tier Multipliers

```typescript
function getTierMultipliers(tier: number) {
  switch (tier) {
    case 1: // Level 5
      return {
        hp: 1.0,
        speed: 1.0,
        damage: 1.0,
        projectileSpeed: 1.0,
        minionSpeed: 1.0,
        telegraphDuration: 1.0
      };
    
    case 2: // Level 10
      return {
        hp: 1.5,
        speed: 1.2,
        damage: 1.3,
        projectileSpeed: 1.2,
        minionSpeed: 1.2,
        telegraphDuration: 0.9  // Shorter warnings
      };
    
    case 3: // Level 15
      return {
        hp: 2.0,
        speed: 1.4,
        damage: 1.6,
        projectileSpeed: 1.4,
        minionSpeed: 1.4,
        telegraphDuration: 0.8
      };
    
    case 4: // Level 20
      return {
        hp: 3.0,
        speed: 1.6,
        damage: 2.0,
        projectileSpeed: 1.6,
        minionSpeed: 1.6,
        telegraphDuration: 0.7
      };
    
    default:
      return {
        hp: 1.0,
        speed: 1.0,
        damage: 1.0,
        projectileSpeed: 1.0,
        minionSpeed: 1.0,
        telegraphDuration: 1.0
      };
  }
}
```

### 6.2 Phase Scaling

Each boss phase increases difficulty:

```typescript
function getPhaseMultipliers(phase: number) {
  // Phase 1: 1.0x
  // Phase 2: 1.3x
  // Phase 3: 1.6x
  
  return {
    speed: 1.0 + (phase - 1) * 0.3,
    attackRate: 1.0 + (phase - 1) * 0.2,
    aggression: 1.0 + (phase - 1) * 0.4,
    minionCount: 1.0 + (phase - 1) * 0.5
  };
}
```

### 6.3 Level Config Integration

Bosses use the level config system:

```typescript
function spawnBossForLevel(level: number) {
  const levelConfig = getLevelConfig(level);
  const bossId = BossFactory.getRandomBossForLevel(level);
  
  if (!bossId) return;
  
  const boss = BossFactory.createBoss(
    bossId,
    levelConfig,  // Contains hpMultiplier, speedMultiplier, etc.
    scene,
    telegraphingSystem
  );
  
  // Boss HP already scaled by levelConfig.hpMultiplier
  // Boss speed already scaled by levelConfig.speedMultiplier
}
```

---

## 7. Performance Optimization

### 7.1 Object Pooling

```typescript
// Pool boss projectiles
const bossProjectilePool: THREE.Mesh[] = [];
const POOL_SIZE = 50;

function initBossProjectilePool() {
  for (let i = 0; i < POOL_SIZE; i++) {
    const geo = new THREE.BoxGeometry(0.12, 0.12, 0.12);
    const mat = new THREE.MeshBasicMaterial({ color: 0xff0000 });
    const proj = new THREE.Mesh(geo, mat);
    proj.visible = false;
    scene.add(proj);
    bossProjectilePool.push(proj);
  }
}

function getBossProjectile(): THREE.Mesh {
  for (const proj of bossProjectilePool) {
    if (!proj.visible) {
      proj.visible = true;
      return proj;
    }
  }
  return null; // Pool exhausted
}
```

### 7.2 Telegraphing Limits

```typescript
// Limit active telegraph effects
const MAX_TELEGRAPH_EFFECTS = 10;

class TelegraphingSystem {
  start(type, duration, color, position?, direction?) {
    if (this.activeEffects.length >= MAX_TELEGRAPH_EFFECTS) {
      // Remove oldest effect
      const removed = this.activeEffects.shift();
      this.removeEffect(removed);
    }
    // ... create new effect
  }
}
```

### 7.3 Minion Limits

```typescript
// Limit active minions per boss
const MAX_MINIONS_PER_BOSS = 20;

class Boss {
  spawnMinion(position, playerPos, type) {
    if (this.activeMinions.length >= MAX_MINIONS_PER_BOSS) {
      // Don't spawn more
      return;
    }
    // ... spawn minion
  }
}
```

---

## 8. Testing Strategy

### 8.1 Unit Tests

- **Boss Factory**: Test boss creation for all tiers
- **Phase Transitions**: Test at 66%, 33% thresholds
- **Weak Points**: Test damage multiplier
- **Telegraphing**: Test effect creation/cleanup
- **Difficulty Scaling**: Test tier multipliers

### 8.2 Integration Tests

- **Boss Spawn**: Test spawn at levels 5, 10, 15, 20
- **Boss Death**: Test death sequence and cleanup
- **Health Bar**: Test UI updates during fight
- **Minion Spawning**: Test minion creation and cleanup
- **Projectiles**: Test projectile creation and collision

### 8.3 Gameplay Tests

- **DodgerBoss**: Test all states (hidden, appearing, charging, stunned, normal, hiding)
- **Phase Scaling**: Test behavior changes across phases
- **Tier Scaling**: Test difficulty increase across tiers
- **Player Damage**: Test damage taken from boss attacks
- **Boss Damage**: Test damage dealt to boss

---

## 9. Future Enhancements

### 9.1 Boss Combos

Allow multiple behavior types per boss:
```typescript
interface HybridBoss extends Boss {
  behaviors: string[];  // ['dodger', 'turret']
  currentBehavior: number;
  
  switchBehavior(): void;
}
```

### 9.2 Boss Enrage Timer

Add enrage mechanics for longer fights:
```typescript
class Boss {
  enrageTimer: number;
  enrageMultiplier: number;
  
  updateEnrage(dt: number): void {
    this.enrageTimer -= dt;
    if (this.enrageTimer <= 0) {
      // Enrage: increase damage/speed
      this.enrageMultiplier = 2.0;
    }
  }
}
```

### 9.3 Boss Phases with Mechanics

Add mechanics-specific phases:
```typescript
interface BossPhase {
  hpThreshold: number;      // 0.66, 0.33, 0.0
  mechanics: string[];      // ['add_shields', 'spawn_minions']
  duration?: number;        // Timed phase
}
```

### 9.4 Boss Achievements

Track boss-specific achievements:
```typescript
interface BossAchievement {
  bossId: string;
  condition: string;        // 'no_damage', 'under_30s', 'weak_points_only'
  reward: string;           // Achievement name
}
```

---

## 10. Implementation Checklist

### Phase 1: Core Framework ✅
- [x] TelegraphingSystem implementation
- [x] Boss base class
- [x] DodgerBoss subclass
- [x] Boss factory
- [x] Boss pool management

### Phase 2: Additional Bosses ⏳
- [ ] TurretBoss implementation
- [ ] SpawnerBoss implementation
- [ ] ChargerBoss implementation
- [ ] ShieldedBoss implementation
- [ ] Add to boss pools

### Phase 3: Difficulty Scaling ⏳
- [ ] Implement tier multipliers
- [ ] Implement phase multipliers
- [ ] Test scaling at all tiers
- [ ] Balance difficulty

### Phase 4: Polish ⏳
- [ ] Boss death animations
- [ ] Boss spawn effects
- [ ] Sound effect integration
- [ ] Visual feedback improvements

---

## 11. Conclusion

This architecture provides:

✅ **Reusable Framework**: Boss base class with common functionality
✅ **Scalable Difficulty**: Tier and phase multipliers
✅ **Well-Documented Patterns**: Telegraphing, weak points, minions
✅ **Performance-Friendly**: Object pooling and limits
✅ **Extensible**: Easy to add new boss types
✅ **Testable**: Clear testing strategy

The framework is production-ready for the DodgerBoss and provides a solid foundation for implementing additional boss types.
