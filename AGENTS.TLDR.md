# AGENTS.TLDR.md - Quick Reference for SPACEOMICIDE

> One-page cheat sheet for bots working on this project.

## What Is This?

**SPACEOMICIDE** is a WebXR VR roguelike shooter for Meta Quest. No build step, no npm, no external assets. All procedural.

## Key Rules

- **60fps minimum** (72fps target) - VR performance is critical
- **No loops** in render loop - avoid `for`/`while` in `animate()`
- **Object pooling** everywhere - reuse, don't create/destroy
- **Comment thoroughly** - explain WHY, not what
- **Test in VR** - desktop preview doesn't catch VR bugs

## Architecture

```
game.js      → State machine (health, score, level, upgrades)
main.js      → Render loop, scene setup, controller input
enemies.js   → Enemy spawning, AI, damage (pooled)
upgrades.js  → Weapon stats, upgrade effects (pure functions)
hud.js       → Sprite-based UI, text rendering
audio.js     → Procedural Web Audio (sfxr-style)
scoreboard.js → Supabase integration for leaderboards
```

## Critical Patterns

### Object Pooling
```javascript
const pool = Array.from({ length: 50 }, () => createObject());
pool.forEach(obj => { obj.visible = false; scene.add(obj); });

// Reuse: find invisible, configure, set visible
const obj = pool.find(o => !o.visible);
```

### State Machine
```javascript
if (game.state === State.PLAYING) { /* game logic */ }
game.state = State.LEVEL_COMPLETE;
```

### Per-Hand Tracking
```javascript
game.upgrades.left = { weapon: 'blaster', damage: 10 };
game.upgrades.right = { weapon: 'buckshot', spread: 0.3 };
```

## Current Systems

### Weapons (being refactored)
- **MAIN WEAPONS** (top trigger): Blaster, Buckshot, Lightning, Charge Cannon, Plasma Carbine, Seeker Burst
- **ALT WEAPONS** (lower trigger): Rocket, Helper Bot, Shield, Gravity Well, Ion Mortar, Hologram Decoy
- **UPGRADES**: Universal + weapon-specific

### Levels
- Standard levels: 1-4, 6-9, 11-14, 16-19 (enemy waves)
- Boss levels: 5, 10, 15, 20 (unique fights)
- Kill requirements increase per level

### Boss System (being overhauled)
- 20 unique bosses planned (5 per boss level)
- Phase transitions at 66% and 33% health
- Weak points, minions, projectile patterns

## Known Issues

- **Black box overlay** - transparency rendering bug (long-standing)
- **Dual blaster performance** - degrades at level 12+ with certain upgrades
- **HUD counter bugs** - score/kill counters not always accurate
- **Charge cannon broken** - no visuals, wrong damage scaling

## File Modification Rules

- **main.js** - Touch carefully, complex render loop
- **game.js** - Follow existing state patterns
- **enemies.js** - Use pool pattern strictly
- **upgrades.js** - Pure functions only
- **hud.js** - Use `createTextSprite` pattern
- **audio.js** - Procedural only, no external files

## Quick Commands

```bash
# Run locally (no build needed)
python3 -m http.server 8000
# Open http://localhost:8000 in browser

# Test in VR
# Open in Meta Quest Browser, enter VR

# Git workflow
git checkout -b feature/issue-XX-description
git add -A && git commit -m "feat: description (#XX)"
git push -u origin feature/issue-XX-description
```

## Sound Effect Format

All sounds are sfxr-style JSON parameters:
```json
{ "oldParams": true, "wave_type": 0, "p_env_attack": 0.1, ... }
```

Use `audio.js` functions to play these.

---

**When in doubt:** Read AGENTS.md for full guidelines.
