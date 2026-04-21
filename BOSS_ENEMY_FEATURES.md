# SPACEOMICIDE - Boss & Enemy Feature Brainstorm
**Tuesday Focus: BOSSES & ENEMIES**
**Date: April 21, 2026**

## 🎯 OVERVIEW
5 creative boss and enemy features that enhance the stationary VR roguelike experience, working within the player constraints while adding depth to combat.

---

## 🚀 FEATURE 1: PHANTOM MIRROR (New Boss Tier - Level 7)

### Vision
A ghostly boss that creates mirrored versions of the player's recent actions, forcing strategic adaptation and reflexive thinking.

### Why This Rules
- Creates a "boss learns from your patterns" meta-game
- Rewards varied combat approaches instead of spamming one tactic
- Visually stunning mirror effects with perfect symmetry
- Psychological tension - watching your own attacks turned against you

### How It Works
**Core Mechanic**: The Phantom Mirror boss analyzes player shot patterns and recreates them as mirrored enemy attacks:

```javascript
// Boss behavior in enemies.js
class PhantomMirrorBoss extends Boss {
  constructor(def, levelConfig, sceneRef, telegraphing) {
    super(def, levelConfig, sceneRef, telegraphing);
    
    // Pattern memory system
    this.playerShotPattern = [];
    this.maxPatternLength = 8;
    this.mirrorTimer = 0;
    this.mirrorDelay = 2000; // 2 second delay before mirroring
    
    // Mirror phase tracking
    this.mirrorPhase = false;
    this.activeMirrors = [];
  }
  
  updatePlayerShots(shotInfo) {
    // Record player's shot patterns
    this.playerShotPattern.push({
      position: shotInfo.position,
      direction: shotInfo.direction,
      weapon: shotInfo.weapon,
      time: performance.now()
    });
    
    // Keep only recent shots
    const cutoff = performance.now() - 5000; // 5 second memory
    this.playerShotPattern = this.playerShotPattern.filter(shot => shot.time > cutoff);
    
    if (this.playerShotPattern.length > this.maxPatternLength) {
      this.playerShotPattern.shift();
    }
  }
  
  createMirrorAttack(playerShot) {
    // Create mirrored version of player's attack
    const mirrorPos = new THREE.Vector3(
      -playerShot.position.x, // Mirror across Y axis
      playerShot.position.y,
      playerShot.position.z
    );
    
    const mirrorDir = new THREE.Vector3(
      -playerShot.direction.x, // Mirror direction
      playerShot.direction.y,
      playerShot.direction.z
    );
    
    // Spawn enemy projectiles that mirror player's pattern
    this.spawnMirrorProjectile(mirrorPos, mirrorDir, playerShot.weapon);
  }
}
```

**Visual/Audio Direction:**
- **Visual**: Ethereal blue/purple ghostly appearance with mirror-like reflections
- **Effects**: When mirroring, create shimmering mirror planes that spawn the mirrored attacks
- **Audio**: Haunting ethereal sounds that intensify during mirror phases, with perfect "echo" sound effects matching the original shots

**Phase Progression:**
1. **Phase 1 (60% HP)**: Mirrors basic shots with 2-second delay
2. **Phase 2 (30% HP)**: Mirrors shot patterns with 1-second delay, adds slight variations
3. **Phase 3 (10% HP)**: Creates composite attacks from multiple stored patterns

**Implementation Sketch:**
```javascript
// Add to enemies.js boss spawning
if (level === 7) {
  boss = new PhantomMirrorBoss(def, levelConfig, sceneRef, telegraphingSystem);
}

// Hook into main.js weapon firing system
function fireWeapon(controller, hand, stats) {
  // Record pattern for mirroring
  if (activeBoss && activeBoss.type === 'phantom_mirror') {
    activeBoss.updatePlayerShots({
      position: controller.position,
      direction: controller.getWorldDirection(new THREE.Vector3()),
      weapon: stats.id,
      time: performance.now()
    });
  }
}
```

**Balance Notes:**
- Mirror attacks always have slightly reduced damage (70% of original)
- Player can recognize their own attack patterns and adapt
- Boss telegraphs when mirror phase is about to begin
- Maximum 4 simultaneous mirrored attacks to prevent overwhelming

**Estimated Effort:** Medium-High (new boss class, pattern tracking system, mirror effects)

---

## 🚀 FEATURE 2: ADAPTIVE SWARM INTELLIGENCE (New Enemy Type)

### Vision
Swarm enemies that learn from player tactics and evolve their behavior dynamically during a single encounter.

### Why This Rules
- Creates emergent gameplay - no two encounters feel identical
- Rewards player adaptation rather than relying on fixed patterns
- Visually interesting as swarms morph and reorganize
- Adds strategic depth to "weak" enemy type

### How It Works
**Core Mechanic**: Swarm enemies analyze player behavior and adapt their tactics:

```javascript
// Enhanced swarm behavior in enemies.js
class AdaptiveSwarm {
  constructor(swarmData) {
    this.adaptationLevel = 0;
    this.playerBehavior = {
      dodgePattern: [], // Tracks movement preferences
      weaponPreferences: {}, // Tracks weapon usage
      accuracy: 0.5,
      favoriteEngagementDistance: 3.0
    };
    this.adaptationCooldown = 0;
    this.maxAdaptationLevel = 3;
  }
  
  analyzePlayerBehavior(playerShot, playerPos) {
    // Track weapon preferences
    if (!this.playerBehavior.weaponPreferences[playerShot.weapon]) {
      this.playerBehavior.weaponPreferences[playerShot.weapon] = 0;
    }
    this.playerBehavior.weaponPreferences[playerShot.weapon]++;
    
    // Track engagement distance
    const distance = this.mesh.position.distanceTo(playerPos);
    this.playerBehavior.favoriteEngagementDistance = 
      (this.playerBehavior.favoriteEngagementDistance + distance) / 2;
  }
  
  adaptBehavior() {
    if (this.adaptationLevel >= this.maxAdaptationLevel) return;
    
    this.adaptationLevel++;
    
    switch(this.adaptationLevel) {
      case 1: // First adaptation: Faster movement
        this.speed *= 1.3;
        break;
      case 2: // Second adaptation: Evasive maneuvers
        this.addEvasivePattern();
        break;
      case 3: // Final adaptation: Coordinated attacks
        this.addCoordinationSystem();
        break;
    }
  }
  
  addEvasivePattern() {
    // Add weaving movement pattern when player is accurate
    if (this.playerBehavior.accuracy > 0.7) {
      this.evasiveMode = true;
      this.evsasiveTimer = 0;
    }
  }
}
```

**Visual/Audio Direction:**
- **Visual**: Swarm particles change color based on adaptation level (red → purple → black)
- **Effects**: Swarm forms geometric patterns as it adapts
- **Audio**: Swarm sound evolves from simple buzzing to complex choral effects

**Adaptation Triggers:**
- **Level 1**: Player hits >70% of shots
- **Level 2**: Player uses only one weapon type extensively
- **Level 3**: Player stays in preferred engagement zone

**Implementation Sketch:**
```javascript
// Enhanced swarm update function
function updateAdaptiveSwarm(swarm, dt, playerPos, playerShots) {
  // Analyze recent player behavior
  const recentAccuracy = calculateRecentAccuracy(playerShots);
  
  // Trigger adaptation based on behavior
  if (recentAccuracy > 0.7 && swarm.adaptationLevel < 1) {
    swarm.adaptBehavior();
    playAdaptationSound();
  }
  
  // Apply adapted movement patterns
  if (swarm.evasiveMode) {
    applyEvasiveMovement(swarm, playerPos);
  }
}
```

**Balance Notes:**
- Adaptations happen gradually to prevent sudden difficulty spikes
- Each adaptation has clear visual/audio cues
- Maximum adaptation ensures swarms remain threatening but not impossible
- Adaptation persists for the entire encounter

**Estimated Effort:** Medium (behavior adaptation system, enhanced swarm AI)

---

## 🚀 FEATURE 3: BOSS PHASE MEMORY (Existing Boss Enhancement)

### Vision
Bosses remember and counter the player's most successful tactics from previous phases, creating an escalating strategic challenge.

### Why This Rules
- Creates "boss learning" meta-progression within a single fight
- Rewards varied combat approaches and punishes over-reliance on one strategy
- Adds psychological tension - players must constantly adapt
- Makes each boss encounter feel unique and personal

### How It Works
**Core Mechanic**: Bosses track player effectiveness and counter successful strategies:

```javascript
// Enhanced boss system in enemies.js
class BossWithMemory extends Boss {
  constructor(def, levelConfig, sceneRef, telegraphing) {
    super(def, levelConfig, sceneRef, telegraphing);
    
    // Player behavior tracking
    this.playerTactics = {
      mostUsedWeapon: null,
      mostUsedAltWeapon: null,
      accuracyByWeapon: {},
      preferredAttackAngles: [],
      damageDealtPerPhase: {},
      dodgeTiming: []
    };
    
    // Anti-tactic systems
    this.antiTacticTimers = {};
    this.tacticMemory = {};
  }
  
  recordPlayerAction(action) {
    // Track weapon usage
    if (action.weapon) {
      this.playerTactics.accuracyByWeapon[action.weapon] = 
        (this.playerTactics.accuracyByWeapon[action.weapon] || 0) + 1;
      
      if (!this.playerTactics.mostUsedWeapon || 
          this.playerTactics.accuracyByWeapon[action.weapon] > 
          this.playerTactics.accuracyByWeapon[this.playerTactics.mostUsedWeapon]) {
        this.playerTactics.mostUsedWeapon = action.weapon;
      }
    }
    
    // Track attack angles
    if (action.angle) {
      this.playerTactics.preferredAttackAngles.push(action.angle);
    }
  }
  
  implementCounterTactics(currentPhase) {
    // Counter the most used weapon
    if (this.playerTactics.mostUsedWeapon) {
      this.createWeaponCounter(this.playerTactics.mostUsedWeapon);
    }
    
    // Counter preferred attack angles
    if (this.playerTactics.preferredAttackAngles.length > 5) {
      this.createAngleDefense();
    }
  }
  
  createWeaponCounter(weaponType) {
    switch(weaponType) {
      case 'plasma_carbine':
        // Add damage resistance to rapid fire
        this.addDamageResistance('rapid_fire', 0.5);
        break;
      case 'charge_cannon':
        // Add interrupt attacks to charged shots
        this.addChargeInterrupter();
        break;
      case 'buckshot':
        // Add narrow gaps that buckshot can't hit effectively
        this.addNarrowVulnerabilities();
        break;
    }
  }
}
```

**Phase Implementation:**
```javascript
// Enhanced phase transitions
updateBossPhaseTransition(newPhase) {
  // Record current phase performance before transition
  this.recordPhasePerformance();
  
  // Implement counter-tactics for new phase
  this.implementCounterTactics(newPhase);
  
  // Visual indication of adaptation
  this.showAdaptationVisual();
}
```

**Visual/Audio Direction:**
- **Visual**: Boss gains subtle new visual elements reflecting countered tactics
- **Effects**: When countering specific weapons, create shield effects or weak points
- **Audio**: Boss sound changes reflect the type of counter being activated

**Countered Tactics Examples:**
- **Plasma Carbine spam**: Boss gains damage resistance, adds interrupt attacks
- **Charge cannon camping**: Boss adds homing projectiles that disrupt charging
- **Buckshot rush**: Boss creates narrow gaps that require precision aiming
- **Alt weapon overuse**: Boss reduces alt weapon effectiveness in that phase

**Implementation Sketch:**
```javascript
// Hook into main.js damage system
function handleWeaponHit(damage, weaponType, hitInfo) {
  // Record player actions for boss memory
  if (activeBoss && activeBoss.hasMemory) {
    activeBoss.recordPlayerAction({
      weapon: weaponType,
      damage: damage,
      angle: calculateAttackAngle(hitInfo),
      time: performance.now()
    });
  }
}
```

**Balance Notes:**
- Counters are subtle, not frustrating
- Boss always has at least one effective countermeasure
- Players can observe and adapt to counter-counters
- Memory system resets between boss encounters

**Estimated Effort:** Medium-High (enhanced boss AI, tactic tracking system)

---

## 🚀 FEATURE 4: DYNAMIC ENVIRONMENTAL THREATS (New Enemy Mechanic)

### Vision
Enemies that manipulate the environment to create arena hazards that persist between enemy waves.

### Why This Rules
- Creates strategic depth beyond simple shooting
- Rewards environmental awareness and positioning
- Visually interesting environmental effects
- Adds progressive difficulty as arena becomes more dangerous

### How It Works
**Core Mechanic**: Special enemy types create persistent environmental hazards:

```javascript
// Environmental threat system in enemies.js
class EnvironmentalEnemy {
  constructor(def, levelConfig, sceneRef, telegraphing) {
    super(def, levelConfig, sceneRef, telegraphing);
    
    // Environmental threat tracking
    this.activeHazards = [];
    this.hazardDuration = 15000; // 15 seconds per hazard
    this.maxHazards = 3;
    this.hazardCooldown = 0;
  }
  
  createEnvironmentalHazard(hazardType, position) {
    const hazard = {
      type: hazardType,
      position: position.clone(),
      createdAt: performance.now(),
      damage: this.calculateHazardDamage(hazardType),
      radius: this.getHazardRadius(hazardType)
    };
    
    this.activeHazards.push(hazard);
    
    // Create visual representation
    this.spawnHazardVisual(hazard);
    
    // Apply environmental effect
    this.applyHazardEffect(hazard);
    
    // Start decay timer
    this.scheduleHazardDecay(hazard);
  }
  
  spawnHazardVisual(hazard) {
    switch(hazard.type) {
      case 'toxic_field':
        // Create green toxic cloud
        const cloud = createToxicCloud(hazard.position, hazard.radius);
        sceneRef.add(cloud);
        hazard.visual = cloud;
        break;
      case 'energy_barrier':
        // Create energy barrier
        const barrier = createEnergyBarrier(hazard.position, hazard.radius);
        sceneRef.add(barrier);
        hazard.visual = barrier;
        break;
      case 'gravity_zone':
        // Create gravity distortion effect
        const gravity = createGravityZone(hazard.position, hazard.radius);
        sceneRef.add(gravity);
        hazard.visual = gravity;
        break;
    }
  }
}
```

**Hazard Types:**
```javascript
const HAZARD_TYPES = {
  toxic_field: {
    color: 0x00ff00,
    damage: 2,
    radius: 2.0,
    effect: 'damage_over_time',
    visual: 'poison_cloud'
  },
  energy_barrier: {
    color: 0x00ffff,
    damage: 0,
    radius: 1.5,
    effect: 'block_projectiles',
    visual: 'energy_wall'
  },
  gravity_zone: {
    color: 0xff00ff,
    damage: 0,
    radius: 3.0,
    effect: 'pull_enemies',
    visual: 'gravity_distortion'
  }
};
```

**Environmental Update System:**
```javascript
function updateEnvironmentalHazards(enemies, dt) {
  // Update existing hazards
  enemies.forEach(enemy => {
    if (enemy.createEnvironmentalHazard) {
      enemy.activeHazards = enemy.activeHazards.filter(hazard => {
        const age = performance.now() - hazard.createdAt;
        
        // Remove expired hazards
        if (age > hazardDuration) {
          if (hazard.visual) {
            scene.remove(hazard.visual);
          }
          return false;
        }
        
        // Apply hazard effects
        applyHazardEffect(hazard, dt);
        return true;
      });
    }
  });
}
```

**Visual/Audio Direction:**
- **Visual**: Persistent environmental effects with gradual fade-out
- **Effects**: Visual feedback when entering/ex hazard zones
- **Audio**: Ambient environmental sounds that intensify near hazards

**Implementation Sketch:**
```javascript
// Add to main.js update loop
function updateGame(dt) {
  // Update environmental hazards
  updateEnvironmentalHazemies(activeEnemies, dt);
  
  // Check environmental hazard collisions
  checkHazardCollisions();
}

// Add new enemy types to game.js
function getEnemyTypes(level) {
  const types = ['basic', 'fast', 'tank'];
  
  // Add environmental enemies based on level
  if (level >= 8) types.push('environmental_toxic');
  if (level >= 12) types.push('environmental_barrier');
  if (level >= 16) types.push('environmental_gravity');
  
  return types;
}
```

**Balance Notes:**
- Hazards provide tactical advantages and disadvantages
- Maximum number of hazards prevents arena becoming too cluttered
- Hazard effects are telegraphed before appearing
- Environmental enemies are rarer but more impactful

**Estimated Effort:** Medium (environmental effects system, new enemy types)

---

## 🚀 FEATURE 5: ENEMY SYNERGY COMBOS (New Combat System)

### Vision
Enemies that combine their abilities to create powerful synergistic effects, rewarding tactical positioning and prioritization.

### Why This Rules
- Creates deep tactical gameplay - players must manage multiple threats
- Rewards smart targeting and positioning
- Visually spectacular combo effects
- Adds strategic depth beyond simple "kill everything"

### How It Works
**Core Mechanic**: Enemy types that enhance each other when near allies:

```javascript
// Synergy system in enemies.js
class SynergySystem {
  constructor() {
    this.activeSynergies = new Map(); // Map of enemy positions -> synergy effects
    this.synergyRanges = {
      speed_boost: 3.0,
      damage_amplify: 2.5,
      shield_sharing: 4.0,
      chain_attacks: 2.0
    };
  }
  
  updateSynergies(enemies) {
    // Clear existing synergies
    this.activeSynergies.clear();
    
    // Check all pairs of enemies for synergies
    for (let i = 0; i < enemies.length; i++) {
      for (let j = i + 1; j < enemies.length; j++) {
        const enemy1 = enemies[i];
        const enemy2 = enemies[j];
        
        // Check if enemies are in range
        const distance = enemy1.mesh.position.distanceTo(enemy2.mesh.position);
        
        if (distance < this.synergyRanges.speed_boost) {
          this.applySpeedBoost(enemy1, enemy2);
        }
        
        if (distance < this.synergyRanges.damage_amplify) {
          this.applyDamageAmplify(enemy1, enemy2);
        }
        
        if (distance < this.synergyRanges.shield_sharing) {
          this.applyShieldSharing(enemy1, enemy2);
        }
        
        if (distance < this.synergyRanges.chain_attacks) {
          this.applyChainAttacks(enemy1, enemy2);
        }
      }
    }
  }
  
  applySpeedBoost(enemy1, enemy2) {
    // Speed boost for same-type enemies
    if (enemy1.type === enemy2.type) {
      this.addSynergyEffect(enemy1, 'speed_boost', 1.3);
      this.addSynergyEffect(enemy2, 'speed_boost', 1.3);
    }
  }
  
  applyDamageAmplify(enemy1, enemy2) {
    // Damage amplification for complementary types
    if ((enemy1.type === 'fast' && enemy2.type === 'tank') ||
        (enemy1.type === 'tank' && enemy2.type === 'fast')) {
      this.addSynergyEffect(enemy1, 'damage_amplify', 1.5);
      this.addSynergyEffect(enemy2, 'damage_amplify', 1.5);
    }
  }
  
  applyShieldSharing(enemy1, enemy2) {
    // Shield sharing for jelly enemies
    if (enemy1.type === 'jelly' || enemy2.type === 'jelly') {
      this.createSharedShield(enemy1, enemy2);
    }
  }
  
  applyChainAttacks(enemy1, enemy2) {
    // Chain attacks for swarm enemies
    if (enemy1.type === 'swarm' || enemy2.type === 'swarm') {
      this.setupChainAttackSystem(enemy1, enemy2);
    }
  }
}
```

**Synergy Types:**
```javascript
const SYNERGY_TYPES = {
  speed_boost: {
    name: 'Pack Mentality',
    description: 'Same-type enemies move 30% faster',
    visual: 'speed_lines',
    audio: 'whoosh'
  },
  damage_amplify: {
    name: 'Tank-Fast Synergy',
    description: 'Fast enemies deal 50% more damage near tanks',
    visual: 'damage_glow',
    audio: 'power_up'
  },
  shield_sharing: {
    name: 'Jelly Fusion',
    description: 'Jelly enemies share a protective barrier',
    visual: 'energy_barrier',
    audio: 'shield'
  },
  chain_attacks: {
    name: 'Swarm Coordination',
    description: 'Swarm enemies chain attacks across multiple targets',
    visual: 'lightning_trails',
    audio: 'electric'
  }
};
```

**Visual System:**
```javascript
function createSynergyVisual(enemy1, enemy2, synergyType) {
  const midpoint = new THREE.Vector3()
    .add(enemy1.mesh.position)
    .add(enemy2.mesh.position)
    .multiplyScalar(0.5);
  
  switch(synergyType) {
    case 'speed_boost':
      // Create motion blur effect
      createMotionBlur(enemy1.mesh.position);
      createMotionBlur(enemy2.mesh.position);
      break;
    case 'damage_amplify':
      // Create damage glow
      createDamageGlow(midpoint);
      break;
    case 'shield_sharing':
      // Create connection beam
      createConnectionBeam(enemy1.mesh.position, enemy2.mesh.position);
      break;
    case 'chain_attacks':
      // Create energy web
      createEnergyWeb([enemy1.mesh.position, enemy2.mesh.position]);
      break;
  }
}
```

**Implementation Sketch:**
```javascript
// Add to enemies.js update loop
function updateEnemies(dt, now) {
  // Update synergies
  synergySystem.updateSynergies(activeEnemies);
  
  // Apply synergy effects
  activeEnemies.forEach(enemy => {
    enemy.synergies.forEach(synergy => {
      applySynergyEffect(enemy, synergy);
    });
  });
}

// Add to main.js rendering
function renderScene() {
  // Render synergy effects
  synergySystem.renderSynergies();
}
```

**Balance Notes:**
- Synergies create clear tactical opportunities
- Players can break synergies by separating enemy groups
- Visual indicators make synergies easy to identify
- Synergy effects stack but don't become overwhelming

**Strategy Examples:**
- **Break Tank-Fast synergy**: Separate fast enemies from tanks to reduce damage
- **Target Jelly Fusion**: Focus fire on jelly enemies to break shield sharing
- **Disrupt Swarm Coordination**: Kill swarm leaders to break chain attacks
- **Exploit Pack Mentality**: Area weapons work better against grouped same-type enemies

**Estimated Effort:** Medium-High (synergy tracking system, visual effects, AI coordination)

---

## 📊 SUMMARY

All 5 features enhance the Tuesday BOSSES & ENEMIES theme while respecting the stationary-player constraint:

1. **Phantom Mirror** - Boss that learns from player patterns
2. **Adaptive Swarm** - Enemies that evolve during encounters  
3. **Boss Phase Memory** - Bosses counter successful tactics
4. **Environmental Threats** - Persistent arena hazards
5. **Enemy Synergy Combos** - Tactical coordination system

Each feature is implementable in the existing Three.js/WebXR framework and adds meaningful strategic depth to the core combat loop. 🐵