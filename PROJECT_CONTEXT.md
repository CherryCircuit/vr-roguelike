# PROJECT_CONTEXT.md - SPACEOMICIDE Architecture & Design

> Comprehensive context for understanding the codebase.

## Project Overview

**SPACEOMICIDE** is a WebXR-based VR roguelike shooter designed for Meta Quest headsets. The game features:

- Procedural voxel-based enemies and environments
- Synthwave/cyberpunk aesthetic
- Per-hand weapon customization
- 20-level progression with 4 boss fights
- Global leaderboard via Supabase

### Tech Stack

- **Three.js** - 3D rendering (loaded via CDN)
- **WebXR Device API** - VR headset integration
- **Web Audio API** - Procedural sound generation
- **Supabase** - Leaderboard database
- **No build step** - Pure ES6 modules in browser

### Design Philosophy

1. **Performance First** - VR requires 72fps, no exceptions
2. **Procedural Everything** - No external assets, all generated
3. **Pool, Don't Create** - Object reuse in render loop
4. **State Machine** - Clear game states, no spaghetti logic
5. **Per-Hand Agency** - Left and right hands are independent

## Core Systems

### 1. Game State (`game.js`)

Central state machine managing:
- Player health (hearts system)
- Score and multipliers
- Current level and wave
- Upgrade states (per hand)
- Game phase (menu, playing, paused, game over)

```javascript
const State = {
  MENU: 'menu',
  PLAYING: 'playing',
  LEVEL_COMPLETE: 'level_complete',
  LEVEL_UP: 'level_up',
  GAME_OVER: 'game_over',
  BOSS: 'boss'
};
```

### 2. Rendering (`main.js`)

Main loop structure:
```javascript
function animate() {
  // 1. Update controllers
  updateControllers();
  
  // 2. Update game logic (if playing)
  if (game.state === State.PLAYING) {
    updateEnemies();
    updateProjectiles();
    checkCollisions();
  }
  
  // 3. Render scene
  renderer.render(scene, camera);
}
```

**Critical**: Nothing expensive in this loop. All object creation happens at startup.

### 3. Enemy System (`enemies.js`)

Enemy types:
- **Basic** - Single voxel, moves toward player
- **Fast** - Smaller, quicker
- **Tank** - 6 voxels, higher HP, weak points (planned)
- **Boss** - Unique mechanics per boss

Pooling pattern:
```javascript
const enemyPool = [];
const MAX_ENEMIES = 50;

function initEnemyPool() {
  for (let i = 0; i < MAX_ENEMIES; i++) {
    const enemy = createEnemy();
    enemy.active = false;
    enemyPool.push(enemy);
  }
}

function spawnEnemy() {
  const enemy = enemyPool.find(e => !e.active);
  if (enemy) {
    enemy.active = true;
    // configure enemy
  }
}
```

### 4. Weapon System (`upgrades.js`)

**Current (being refactored)**:
- Shot types: Standard, Buckshot, Lightning, Charge Cannon
- Upgrades apply globally

**Planned Architecture**:
- **MAIN WEAPONS** - Top trigger, primary fire
- **ALT WEAPONS** - Lower trigger, cooldown-based
- **UPGRADES** - Universal or weapon-specific

Each hand independent:
```javascript
game.upgrades = {
  left: { mainWeapon: 'blaster', altWeapon: 'shield', upgrades: [] },
  right: { mainWeapon: 'buckshot', altWeapon: 'rocket', upgrades: [] }
};
```

### 5. HUD System (`hud.js`)

Sprite-based UI elements:
- Floor HUD (health, score, kill counter)
- Level-up cards (upgrade selection)
- Alerts ("5 kills remaining")
- Boss health bars (planned)

All text rendered as sprites using `createTextSprite()`.

### 6. Audio System (`audio.js`)

Procedural sound generation:
- sfxr-style parameters (see sfxrjs)
- Web Audio API synthesis
- No external audio files

Usage:
```javascript
playSound({ wave_type: 0, p_env_attack: 0.1, ... });
```

## Level Design

### Standard Levels (1-4, 6-9, 11-14, 16-19)

1. Display "LEVEL X" intro
2. Spawn waves of enemies
3. Kill X enemies to progress
4. Show "Y kills remaining" alert
5. Level complete → Level-up screen

### Boss Levels (5, 10, 15, 20)

1. Stop music, boss intro
2. Unique boss fight mechanics
3. Phase transitions at 66%, 33% HP
4. Boss death effects (voxel physics, sounds)
5. Special upgrade reward (RARE/EPIC/ULTRA)

## Known Technical Debt

### Critical Issues

1. **Black Box Transparency Bug**
   - Low-opacity box follows viewpoint
   - Caused by transparent materials (sun, mountains)
   - Multiple bots failed to fix
   - Needs Three.js rendering order investigation

2. **Dual Blaster Performance Degradation**
   - At level 12+, text/billboards disappear
   - Enemies become invisible by level 14
   - Only happens with 2 standard blasters + upgrades
   - Likely object pool exhaustion or geometry limits

3. **HUD Counter Bugs**
   - Score shows glitched zero
   - Kill counter (X/Y) not always accurate
   - Doesn't reset properly on level change

### System-Wide Refactors Needed

1. **Weapon System Overhaul** (#33)
   - Replace shot-type system with MAIN/ALT/UPGRADE
   - Per-hand weapon tracking
   - Cooldown UI for ALT weapons

2. **Boss System Overhaul** (#28)
   - Remove all current bosses (except teleporting)
   - Create framework for phase-based fights
   - 20 new unique bosses

3. **Keyboard/Mouse Support** (#16)
   - Enable bot testing without VR headset
   - Critical for autonomous development

## Performance Guidelines

### Never in Render Loop
- `new Object()` / `new THREE.Mesh()`
- JSON.parse()
- Scene graph searches (`scene.getObjectByName()`)
- Expensive math (use lookup tables)

### Always Do
- Pre-allocate objects at startup
- Cache calculations
- Use object pooling
- Stagger updates (`frameCount % 10 === 0`)

### Performance Targets
- 72fps in VR headset
- <16ms frame time
- <100 active objects at once
- <50 draw calls per frame

## File Responsibilities

| File | Purpose | Touch With Care |
|------|---------|-----------------|
| `main.js` | Render loop, scene setup | ⚠️ HIGH |
| `game.js` | State machine | Medium |
| `enemies.js` | Enemy logic | Medium |
| `upgrades.js` | Weapon/upgrade logic | Medium |
| `hud.js` | UI rendering | Medium |
| `audio.js` | Sound generation | Low |
| `scoreboard.js` | Leaderboard | Low |

## External Dependencies

All loaded via CDN in `index.html`:
- Three.js (3D rendering)
- Supabase JS client (database)

No npm packages, no node_modules.

## Testing Workflow

1. **Desktop Preview** - Test basic functionality
2. **VR Headset** - Test actual gameplay
3. **Performance Monitor** - Use FPS counter (#14)
4. **Playtest** - Full run to level 20

## Future Considerations

- Mobile VR support (outside Meta Quest)
- Local multiplayer
- Save/load game state
- Additional weapon types
- Procedural level generation

---

*Last updated: Brain dump session Feb 2026*
