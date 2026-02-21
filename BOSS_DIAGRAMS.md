# Boss System - Architecture Diagrams

## System Overview

```
┌─────────────────────────────────────────────────────────┐
│                    GAME STATE (game.js)                  │
│                                                          │
│  level: number                                           │
│  _levelConfig: LevelConfig                              │
│    - isBoss: boolean                                    │
│    - hpMultiplier: number                               │
│    - speedMultiplier: number                            │
└─────────────────────────────────────────────────────────┘
                           │
                           │ provides config
                           ▼
┌─────────────────────────────────────────────────────────┐
│              BOSS FACTORY (enemies.js)                   │
│                                                          │
│  ┌───────────────────┐  ┌────────────────────────────┐ │
│  │ BOSS_DEFS         │  │ BOSS_POOLS                 │ │
│  │                   │  │                            │ │
│  │ chrono_wraith     │  │ tier 1: ['chrono_wraith']  │ │
│  │ (future bosses)   │  │ tier 2: ['chrono_wraith']  │ │
│  │                   │  │ tier 3: ['chrono_wraith']  │ │
│  │                   │  │ tier 4: ['chrono_wraith']  │ │
│  └───────────────────┘  └────────────────────────────┘ │
│                                                          │
│  Functions:                                              │
│  - spawnBoss(bossId, levelConfig, camera) → Boss       │
│  - getBoss() → Boss | null                              │
│  - hitBoss(damage, hitInfo) → DamageResult             │
│  - updateBoss(dt, now, playerPos)                       │
│  - clearBoss()                                          │
└─────────────────────────────────────────────────────────┘
                           │
                           │ creates
                           ▼
┌─────────────────────────────────────────────────────────┐
│                 BOSS INSTANCE                            │
│                                                          │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐ │
│  │   Boss       │  │ Telegraphing │  │    Minions   │ │
│  │   (Base)     │  │   System     │  │              │ │
│  │              │  │              │  │  []          │ │
│  │ - hp         │  │ - effects[]  │  │              │ │
│  │ - phase      │  │              │  │              │ │
│  │ - mesh       │  └──────────────┘  └──────────────┘ │
│  │              │                                       │
│  └──────────────┘  ┌──────────────┐                    │
│         ▲          │ Projectiles  │                    │
│         │          │              │                    │
│         │          │  []          │                    │
│  ┌──────┴──────┐   │              │                    │
│  │ DodgerBoss  │   └──────────────┘                    │
│  │             │                                       │
│  │ - state     │                                       │
│  │ - timers    │                                       │
│  │             │                                       │
│  └─────────────┘                                       │
└─────────────────────────────────────────────────────────┘
                           │
                           │ updates
                           ▼
┌─────────────────────────────────────────────────────────┐
│                GAME LOOP (main.js)                       │
│                                                          │
│  if (cfg.isBoss && !getBoss()) {                        │
│    spawnBoss(bossId, cfg);                              │
│  }                                                       │
│                                                          │
│  updateBoss(dt, now, playerPos);                        │
│  updateBossMinions(dt, playerPos);                      │
│  updateBossProjectiles(dt, now, playerPos);            │
│  updateTelegraphing(dt, now);                           │
│  showBossHealthBar(boss.hp, boss.maxHp, boss.phases);  │
└─────────────────────────────────────────────────────────┘
```

## Boss Lifecycle

```
Level Start
      │
      ▼
┌─────────────────┐
│ Check if boss   │
│ level (5,10,15,20)│
└─────────────────┘
      │
      ├─── NO ──────► Normal level flow
      │
      ├─── YES ─────────┐
      │                  │
      │                  ▼
      │        ┌──────────────────┐
      │        │ Get tier for     │
      │        │ level            │
      │        └──────────────────┘
      │                  │
      │                  ▼
      │        ┌──────────────────┐
      │        │ Get random boss  │
      │        │ from tier pool   │
      │        └──────────────────┘
      │                  │
      │                  ▼
      │        ┌──────────────────┐
      │        │ Create boss      │
      │        │ instance         │
      │        │ (BossFactory)    │
      │        └──────────────────┘
      │                  │
      │                  ▼
      │        ┌──────────────────┐
      │        │ Apply level      │
      │        │ multipliers      │
      │        │ (HP, speed)      │
      │        └──────────────────┘
      │                  │
      │                  ▼
      │        ┌──────────────────┐
      │        │ Spawn boss in    │
      │        │ scene            │
      │        └──────────────────┘
      │                  │
      │                  ▼
      │        ┌──────────────────┐
      │        │ Show boss health │
      │        │ bar (3 segments) │
      │        └──────────────────┘
      │                  │
      │                  ▼
      │        ┌──────────────────┐
      │        │ FIGHT LOOP       │
      │        │                  │
      │        │ • Update boss    │
      │        │ • Check damage   │
      │        │ • Phase changes  │
      │        │ • Telegraphing   │
      │        │ • Minions        │
      │        │ • Projectiles    │
      │        └──────────────────┘
      │                  │
      │                  ├─── hp <= 0 ────┐
      │                  │                │
      │                  │                ▼
      │                  │      ┌──────────────────┐
      │                  │      │ Boss defeated    │
      │                  │      │                  │
      │                  │      │ • Death effects  │
      │                  │      │ • Award score    │
      │                  │      │ • Clear boss     │
      │                  │      │ • Clear minions  │
      │                  │      │ • Clear projectiles│
      │                  │      │ • Hide health bar│
      │                  │      │ • Complete level │
      │                  │      └──────────────────┘
      │                  │
      │                  └───── hp > 0 ──────┐
      │                                      │
      └──────────────────────────────────────┘
                                             │
                                             ▼
                                    Continue fighting
```

## Phase Transition Flow

```
Boss Spawned
      │
      ▼
┌─────────────────┐
│ Phase 1         │
│ (100% - 66%)    │
└─────────────────┘
      │
      │ hp <= 66%
      ▼
┌─────────────────┐
│ Phase 2         │
│ (66% - 33%)     │
│                 │
│ • Faster        │
│ • More attacks  │
│ • Telegraphs    │
└─────────────────┘
      │
      │ hp <= 33%
      ▼
┌─────────────────┐
│ Phase 3         │
│ (33% - 0%)      │
│                 │
│ • Max speed     │
│ • All abilities │
│ • Desperate     │
└─────────────────┘
      │
      │ hp <= 0
      ▼
┌─────────────────┐
│ Boss Defeated   │
└─────────────────┘
```

## Telegraphing Flow

```
Boss decides to attack
      │
      ▼
┌─────────────────────┐
│ Start telegraph     │
│ (visual + audio)    │
└─────────────────────┘
      │
      │ Duration: 0.5-2.0s
      ▼
┌─────────────────────┐
│ Telegraph active    │
│                     │
│ • Expanding visual  │
│ • Warning sound     │
│ • Player sees it    │
└─────────────────────┘
      │
      │ Telegraph ends
      ▼
┌─────────────────────┐
│ Execute attack      │
│                     │
│ • Deal damage       │
│ • Spawn minions     │
│ • Fire projectiles  │
└─────────────────────┘
      │
      │ Cooldown
      ▼
┌─────────────────────┐
│ Cooldown period     │
│ (min 0.5s)          │
└─────────────────────┘
      │
      ▼
   Ready for next
```

## DodgerBoss State Machine

```
                    ┌──────────────┐
                    │   HIDDEN     │
                    │              │
                    │ Invisible    │
                    │ Waiting      │
                    └──────────────┘
                           │
                           │ teleportTimer <= 0
                           │
                           ▼
                    ┌──────────────┐
                    │  APPEARING   │
                    │              │
                    │ Show telegraph│
                    │ Set position  │
                    └──────────────┘
                           │
                           ▼
                    ┌──────────────┐
                    │  CHARGING    │
                    │              │
                    │ Pulse visual │
                    │ Countdown    │
                    └──────────────┘
                           │
              ┌────────────┼────────────┐
              │            │            │
              │ hit during │ missed     │ hit player
              │ charge     │ player     │
              │            │            │
              ▼            ▼            ▼
       ┌──────────┐ ┌──────────┐ ┌──────────┐
       │ STUNNED  │ │  NORMAL  │ │  HIDDEN  │
       │          │ │          │ │          │
       │ Shake    │ │ Dodge    │ │ Teleport │
       │ Wait     │ │ Erratic  │ │ away     │
       └──────────┘ │ movement │ └──────────┘
              │     └──────────┘      ▲
              │            │          │
              │            │ hideTimer│
              │            │ <= 0     │
              │            ▼          │
              │     ┌──────────┐      │
              │     │  HIDING  │──────┘
              │     └──────────┘
              │ stunTimer <= 0
              │
              └─────────────────┐
                                │
                                ▼
                          [Back to HIDDEN]
```

## Weak Point System

```
Boss Mesh Created
      │
      ▼
┌─────────────────────┐
│ Identify all voxels │
│ (children of mesh)  │
└─────────────────────┘
      │
      ▼
┌─────────────────────┐
│ Select 20% randomly │
│ as weak points      │
└─────────────────────┘
      │
      ▼
┌─────────────────────┐
│ Mark as weak point  │
│ voxel.userData.     │
│   weakPoint = true  │
└─────────────────────┘
      │
      ▼
   In combat:
      │
      ├─── Player hits weak point ───┐
      │                               │
      │                               ▼
      │                      damage *= 2 (2x multiplier)
      │                               │
      │                               ▼
      │                      Visual feedback
      │                      (different color/sound)
      │
      └─── Player hits normal body ──┐
                                       │
                                       ▼
                              damage *= 1 (normal)
```

## Minion Spawning

```
Boss has minionSpawnRate > 0
      │
      ▼
┌─────────────────────┐
│ minionTimer counts  │
│ down                │
└─────────────────────┘
      │
      │ minionTimer <= 0
      ▼
┌─────────────────────┐
│ Check if max minions│
│ reached (< 20)      │
└─────────────────────┘
      │
      ├─── Max reached ────► Wait (don't spawn)
      │
      ├─── Under limit ─────┐
      │                      │
      │                      ▼
      │             ┌──────────────────┐
      │             │ Show telegraph   │
      │             │ (0.5s warning)   │
      │             └──────────────────┘
      │                      │
      │                      ▼
      │             ┌──────────────────┐
      │             │ Create minion    │
      │             │ at boss position │
      │             └──────────────────┘
      │                      │
      │                      ▼
      │             ┌──────────────────┐
      │             │ Minion moves     │
      │             │ toward player    │
      │             └──────────────────┘
      │
      └──────────────────────┘
```

## Projectile System

```
Boss has projectileRate > 0
      │
      ▼
┌─────────────────────┐
│ projectileTimer     │
│ counts down         │
└─────────────────────┘
      │
      │ projectileTimer <= 0
      ▼
┌─────────────────────┐
│ Get player position │
└─────────────────────┘
      │
      ▼
┌─────────────────────┐
│ Show telegraph      │
│ (if enabled)        │
└─────────────────────┘
      │
      ▼
┌─────────────────────┐
│ Create projectile   │
│ at boss position    │
│ aimed at player     │
└─────────────────────┘
      │
      ▼
┌─────────────────────┐
│ Projectile moves    │
│ in straight line    │
│ (velocity)          │
└─────────────────────┘
      │
      ├─── Hits player ──────► Deal damage, remove projectile
      │
      ├─── Lifetime expired ──► Remove projectile
      │
      └─── Still active ─────► Continue moving
```

## Difficulty Scaling

### Tier Multipliers
```
Tier 1 (Level 5)
├─ HP: 1.0x
├─ Speed: 1.0x
├─ Damage: 1.0x
├─ Telegraph duration: 1.0x
└─ Difficulty: Base

Tier 2 (Level 10)
├─ HP: 1.5x
├─ Speed: 1.2x
├─ Damage: 1.3x
├─ Telegraph duration: 0.9x (shorter warnings)
└─ Difficulty: +30%

Tier 3 (Level 15)
├─ HP: 2.0x
├─ Speed: 1.4x
├─ Damage: 1.6x
├─ Telegraph duration: 0.8x
└─ Difficulty: +60%

Tier 4 (Level 20)
├─ HP: 3.0x
├─ Speed: 1.6x
├─ Damage: 2.0x
├─ Telegraph duration: 0.7x
└─ Difficulty: +100%
```

### Phase Multipliers
```
Phase 1 (100% - 66% HP)
├─ Speed: 1.0x
├─ Attack rate: 1.0x
└─ Aggression: 1.0x

Phase 2 (66% - 33% HP)
├─ Speed: 1.3x (+30%)
├─ Attack rate: 1.2x (+20% faster)
└─ Aggression: 1.4x (+40% more aggressive)

Phase 3 (33% - 0% HP)
├─ Speed: 1.6x (+60%)
├─ Attack rate: 1.4x (+40% faster)
└─ Aggression: 1.8x (+80% more aggressive)
```

## Health Bar UI

```
┌────────────────────────────────────────┐
│         BOSS HEALTH BAR (HUD)          │
│                                        │
│  Segment 1    Segment 2    Segment 3   │
│  [████████]   [████████]   [████████]  │
│  (100-66%)    (66-33%)     (33-0%)     │
│                                        │
│  Phase 1: All 3 segments visible       │
│  Phase 2: Segments 2,3 visible          │
│  Phase 3: Segment 3 only                │
└────────────────────────────────────────┘

Each segment fills based on HP in that range:
  - Segment 1: HP 66-100% → 100% fill at 100%, 0% at 66%
  - Segment 2: HP 33-66% → 100% fill at 66%, 0% at 33%
  - Segment 3: HP 0-33% → 100% fill at 33%, 0% at 0%
```

## Performance Limits

```
┌─────────────────────────────────────────┐
│         PERFORMANCE LIMITS              │
│                                         │
│  Telegraph Effects: Max 10 active       │
│  Minions: Max 20 per boss               │
│  Projectiles: Max 50 active             │
│  Particle Effects: Max 60 pooled        │
│                                         │
│  Cleanup on boss death:                 │
│  • Remove boss mesh                     │
│  • Clear all minions                    │
│  • Clear all projectiles                │
│  • Clear telegraph effects              │
│  • Dispose geometries/materials         │
└─────────────────────────────────────────┘
```

## Object Pooling

```
Projectile Pool (50 instances)
┌────────────────────────────────────────┐
│ [0] ── visible: false                  │
│ [1] ── visible: true  (ACTIVE)         │
│ [2] ── visible: false                  │
│ [3] ── visible: true  (ACTIVE)         │
│ ...                                     │
│ [49] ── visible: false                 │
└────────────────────────────────────────┘

When boss fires projectile:
1. Find first inactive (visible: false)
2. Set position, velocity, visible: true
3. Update in game loop
4. When done: set visible: false, return to pool

Benefits:
• No create/destroy overhead
• Reused geometries/materials
• Predictable memory usage
```

These diagrams provide a visual understanding of the boss system architecture and data flow.
