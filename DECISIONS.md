# DECISIONS.md - Architecture & Design Decisions

> Record of significant decisions made during development.

## Decision Log

### 2026-02-XX: Weapon System Architecture

**Context**: Current weapon system conflates "shot types" with "upgrades", making it hard to add new weapons and balance progression.

**Decision**: Refactor to MAIN WEAPON / ALT WEAPON / UPGRADE system.

**Rationale**:
- MAIN WEAPONS (top trigger) are primary damage dealers
- ALT WEAPONS (lower trigger) provide utility with cooldowns
- UPGRADES can be universal or weapon-specific
- Per-hand independence allows asymmetric builds

**Consequences**:
- Major refactor of `upgrades.js` and `game.js`
- Need UI for cooldown indicators
- More upgrade combinations to balance

**Alternatives Considered**:
- Keep current system, add more upgrades (rejected - too limited)
- Global weapon pool shared between hands (rejected - less strategic)

---

### 2026-02-XX: Boss System Redesign

**Context**: Current bosses are simple "move toward player" enemies. They die too quickly and aren't memorable.

**Decision**: Create 20 unique bosses (5 per boss level) with phase-based mechanics, weak points, and 2-4 minute fight durations.

**Rationale**:
- Bosses should be "experiences", not just tanky enemies
- Phase transitions (66%, 33% HP) add dynamism
- Weak points reward accuracy
- Longer fights allow for mechanic complexity

**Consequences**:
- Boss framework needed (#28)
- 20 bosses is a lot of content (may need to phase implementation)
- Performance concerns with complex boss logic

**Alternatives Considered**:
- Keep existing bosses, buff HP (rejected - boring)
- Fewer bosses, more phases (rejected - less variety)

---

### 2026-02-XX: Keyboard/Mouse Support for Bot Testing

**Context**: Bots cannot test the game without a VR headset, severely limiting autonomous development.

**Decision**: Implement keyboard/mouse controls as development mode.

**Rationale**:
- Enables bots to play, test, and debug
- WASD + mouse aim + click to fire
- Can auto-detect VR availability

**Consequences**:
- Different feel from VR (not a replacement for human testing)
- Aiming mechanics need 2D cursor solution
- Movement in 3D space limited without room-scale

**Alternatives Considered**:
- WebXR emulator (rejected - complex, unreliable)
- No desktop support (rejected - blocks autonomous dev)

---

### 2026-02-XX: No External Assets Policy

**Context**: Game uses procedural generation for all audio and visuals.

**Decision**: Continue with no external assets. All sounds via Web Audio API, all visuals via Three.js primitives.

**Rationale**:
- No asset pipeline needed
- Smaller download size
- Easier for bots to modify
- Fits synthwave procedural aesthetic

**Consequences**:
- Limited audio/visual complexity
- Sfxr-style sounds can feel repetitive
- Voxel aesthetic is simple

**Alternatives Considered**:
- Add GLTF models (partially adopted for some enemies)
- Add audio files (rejected - breaks no-asset rule)

---

### 2026-02-XX: Object Pooling Everywhere

**Context**: VR requires consistent 72fps. Object creation in render loop causes GC pauses and frame drops.

**Decision**: All reusable objects (enemies, projectiles, particles) must use object pooling.

**Rationale**:
- Zero allocations in render loop
- Predictable memory usage
- No GC pauses

**Consequences**:
- More complex initialization
- Need to manage pool sizes carefully
- Can't use convenient array methods in hot paths

**Alternatives Considered**:
- Generational GC (not available in JS)
- Accept occasional frame drops (rejected - VR sickness risk)

---

### 2026-02-XX: No Build Step

**Context**: Game runs directly in browser with ES6 modules, no bundler.

**Decision**: Keep no build step. Use native ES6 modules.

**Rationale**:
- Simpler development
- No webpack/rollup complexity
- Instant reload
- Easier for bots to understand

**Consequences**:
- Can't use npm packages directly
- Limited to CDN-available libraries
- No tree-shaking

**Alternatives Considered**:
- Add Vite/Parcel (rejected - adds complexity)
- Use import maps (partially adopted)

---

### 2026-02-XX: Per-Hand Weapon Independence

**Context**: Player has two controllers. Weapons can be different per hand.

**Decision**: Each hand maintains independent weapon state and upgrades.

**Rationale**:
- Asymmetric builds are fun
- More strategic upgrade choices
- Allows "main hand + utility off-hand" playstyles

**Consequences**:
- More state to track
- UI must show both hands
- Balance more complex

**Alternatives Considered**:
- Shared weapon state (rejected - less interesting)
- Only one active weapon (rejected - wastes VR potential)

---

### 2026-02-XX: Kill-Based Level Progression

**Context**: Players progress through levels by killing enemies.

**Decision**: Keep kill-based progression. Kill X enemies → level complete.

**Rationale**:
- Simple to understand
- Encourages aggressive play
- Easy to balance

**Consequences**:
- Can feel grindy if kill counts too high
- Doesn't reward exploration (not applicable in arena)

**Alternatives Considered**:
- Time-based waves (rejected - penalizes slow players)
- Objective-based (rejected - too complex for scope)

---

## Pending Decisions

### Boss Selection Logic

**Question**: How to select which boss spawns at each boss level?

**Options**:
1. Random from pool of 5
2. Sequential (fixed order)
3. Player choice (show 3, pick 1)
4. Based on player performance

**Status**: Undecided

---

### Upgrade Card Presentation

**Question**: How many upgrade cards to show at level-up?

**Options**:
1. 3 cards (pick 1)
2. 4 cards (pick 1)
3. Adaptive based on level

**Status**: Undecided

---

### Aurora Borealis Implementation

**Question**: Should we implement aurora sky-dome, or is it too performance-heavy?

**Options**:
1. Implement with low-res pixel GIF
2. Skip, focus on other visuals
3. Implement as optional "fancy graphics" toggle

**Status**: Undecided (need performance testing)

---

## Decision Process

When making significant changes:
1. Document context and options
2. Record decision and rationale
3. Note consequences
4. Review periodically

---

*Last updated: Brain dump session Feb 2026*
