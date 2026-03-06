# Biome Visual Upgrade Plan
**Date:** 2026-03-05
**Task:** Enhance biome distinctiveness through geometry, particles, lighting, props, and motion

---

## Current State Analysis

### What's Already Implemented
- Basic color theming (sky, fog, grid, mountains, sun)
- Ambient particle system with 13 particle types
- Basic biome props (pillars, arches, platforms) in main.js
- Grid scaling and mountain scaling

### What Needs Enhancement
- Particles are mostly simple (float, rise, fall, swirl)
- Props are generic (same types across biomes)
- No biome-specific lighting variations
- Limited motion patterns
- Missing unique environmental features

---

## Upgrade Strategy

### 1. Enhanced Particle Systems
Add secondary particle layers and complex behaviors:
- **Layered particles**: Primary ambient + secondary detail particles
- **Interaction effects**: Particles that react to player movement
- **Environmental particles**: Weather, debris, atmospheric effects
- **Complex motion**: Orbital paths, wave patterns, burst effects

### 2. Biome-Specific Geometry
Add unique structural elements to each biome:
- **THE STACK**: Brutalist blocks, industrial scaffolding
- **OCEAN FLOOR**: Coral formations, kelp forests
- **DIGITAL RAIN**: Data streams, glitch zones
- **VAPOR SUNSET**: Palm trees, beach elements
- **CIRCUIT BOARD**: PCB traces, capacitor towers
- **KALEIDOSCOPE**: Mirror panels, geometric shapes
- **RETRO ARCADE**: Cabinet props, neon signs
- **NEON RAINFOREST**: Giant leaves, vines, glowing plants
- **VOID GARDEN**: Crystal formations, floating islands
- **SUNRISE HIGHWAY**: Road markers, distant silhouettes

### 3. Lighting Variations
Add biome-specific lighting:
- **Dynamic intensity**: Brighter/darker biomes
- **Color temperature**: Warm vs cool lighting
- **Flicker effects**: Damaged lights, glitch zones
- **Spotlighting**: Focused light beams

### 4. Motion Patterns
Add unique motion to each biome:
- **THE STACK**: Industrial machinery sounds/motion
- **OCEAN FLOOR**: Currents, swaying coral
- **DIGITAL RAIN**: Glitch distortion
- **VAPOR SUNSET**: Gentle waves, swaying palms
- **KALEIDOSCOPE**: Rotating mirrors
- **RETRO ARCADE**: Flickering lights
- **NEON RAINFOREST**: Wind through leaves
- **VOID GARDEN**: Floating drift

---

## Implementation Plan

### Phase 1: Enhanced Particle Types (scenery.js)
Add new particle behaviors:
- `current_flow` - Directional water currents
- `glitch_burst` - Random teleport particles
- `pollen_cloud` - Floating plant particles
- `crystal_shard` - Rotating crystal fragments
- `highway_dust` - Road dust clouds
- `data_stream` - Vertical code rain
- `neon_pulse` - Pulsing light rings

### Phase 2: Theme Enhancements (scenery.js)
Add new theme properties:
- `secondaryParticles` - Layer 2 particle system
- `ambientMotion` - Environmental movement patterns
- `lightIntensity` - Brightness multiplier
- `lightFlicker` - Light instability
- `envFeatures` - Array of unique features

### Phase 3: Prop Enhancements (main.js)
Extend `rebuildBiomeProps()` with:
- Biome-specific prop generators
- Unique geometry per biome
- Animated props (rotation, floating, pulsing)
- Environmental hazards (visual only)

---

## Biome-by-Biome Upgrades

### 1. SUNRISE HIGHWAY
**Visual Theme:** Endless retro highway at dawn

**Current:**
- Orange/pink sky ✓
- White grid ✓
- Dust particles ✓

**Additions:**
- **Secondary particles**: Highway dust clouds that billow
- **Motion**: Distant car headlights (particles moving in lanes)
- **Props**: Road markers (white dashes), guardrails
- **Lighting**: Warm morning glow
- **Unique**: Lane divider lines that pulse

### 2. VAPOR SUNSET
**Visual Theme:** Classic vaporwave beach

**Current:**
- Pink/orange sky ✓
- Cyan grid ✓
- Sparkle particles ✓

**Additions:**
- **Secondary particles**: Gentle wave particles on grid
- **Motion**: Slow wave undulation
- **Props**: Palm tree silhouettes (2D cutouts)
- **Lighting**: Soft sunset glow, pink tint
- **Unique**: Sun that slowly sets over 5 levels

### 3. OCEAN FLOOR
**Visual Theme:** Underwater bioluminescence

**Current:**
- Deep blue ✓
- Bubble particles ✓
- Disc platforms ✓

**Additions:**
- **Secondary particles**: Current flow (directional streams)
- **Motion**: Swaying coral, floating debris
- **Props**: Coral formations (branching geometry), kelp strands
- **Lighting**: Caustic light patterns (projected textures)
- **Unique**: Visibility reduction at distance, fish schools

### 4. CIRCUIT BOARD
**Visual Theme:** Micro-scale PCB

**Current:**
- Green/black ✓
- Electron particles ✓
- Square pillars ✓

**Additions:**
- **Secondary particles**: Power surges along traces
- **Motion**: Pulsing power LEDs
- **Props**: Capacitor towers (cylinders), IC chip blocks
- **Lighting**: Red power LED glow
- **Unique**: Gold trace lines that pulse

### 5. THE STACK
**Visual Theme:** Brutalist industrial

**Current:**
- Gray/concrete ✓
- Debris particles ✓
- Square pillars ✓

**Additions:**
- **Secondary particles**: Industrial smoke/steam
- **Motion**: Machinery vibration
- **Props**: Concrete blocks, scaffolding, graffiti tags (text)
- **Lighting**: Harsh orange industrial lights
- **Unique**: Moving shadows, elevator platforms

### 6. DIGITAL RAIN
**Visual Theme:** Matrix code rain

**Current:**
- Black/green ✓
- Code rain particles ✓

**Additions:**
- **Secondary particles**: Glitch bursts (random teleports)
- **Motion**: Screen distortion waves
- **Props**: Data columns (vertical beams)
- **Lighting**: Green phosphor glow
- **Unique**: Random glitch zones (color distortion)

### 7. KALEIDOSCOPE
**Visual Theme:** Infinite mirror maze

**Current:**
- Multi-color ✓
- Prism particles ✓

**Additions:**
- **Secondary particles**: Mirror shards
- **Motion**: Rotating geometric shapes
- **Props**: Mirror panels (reflective planes)
- **Lighting**: Color-cycling lights
- **Unique**: Reality fold effect (position mirroring)

### 8. RETRO ARCADE
**Visual Theme:** Inside an 80s arcade

**Current:**
- Neon purple ✓
- Pixel particles ✓

**Additions:**
- **Secondary particles**: Neon signs (text particles)
- **Motion**: Flickering cabinet lights
- **Props**: Arcade cabinet shapes, marquees
- **Lighting**: Black light glow
- **Unique**: Scanline effect overlay

### 9. NEON RAINFOREST
**Visual Theme:** Cyberpunk jungle

**Current:**
- Green/blue ✓
- Pollen particles ✓

**Additions:**
- **Secondary particles**: Fireflies, glowing spores
- **Motion**: Wind through leaves, swaying vines
- **Props**: Giant leaf shapes, vine strands
- **Lighting**: Bioluminescent glow
- **Unique**: Exploding plants (particle bursts)

### 10. VOID GARDEN
**Visual Theme:** Space garden

**Current:**
- Black/white ✓
- Crystal particles ✓

**Additions:**
- **Secondary particles**: Star fields, nebula wisps
- **Motion**: Floating drift, zero-G
- **Props**: Crystal formations, asteroid chunks
- **Lighting**: Starlight, distant nebula glow
- **Unique**: Platform growth over time

---

## Testing Checklist

After implementation, test each biome for:

### Visual Distinctiveness
- [ ] Each biome has unique silhouette/shape language
- [ ] Color palettes are immediately distinguishable
- [ ] Particle effects are biome-specific (not reused)
- [ ] Props match biome theme

### Performance
- [ ] FPS stays above 45 with all particle systems
- [ ] No stuttering when entering new biome
- [ ] Particle count within budget (60 max)

### Visual Quality
- [ ] Particles are visible but not distracting
- [ ] Props don't obscure gameplay
- [ ] Lighting enhances mood without hiding enemies
- [ ] Motion adds life without causing motion sickness

### Integration
- [ ] Biome transitions are smooth
- [ ] Themes apply correctly per level
- [ ] No visual glitches or z-fighting
- [ ] Works in both VR and desktop modes

---

## Implementation Order

1. **Enhanced particle types** (scenery.js) - 30 min
2. **Theme property additions** (scenery.js) - 20 min
3. **Particle system upgrades** (scenery.js) - 40 min
4. **Biome-specific prop logic** (main.js) - 60 min
5. **Testing and refinement** - 30 min

**Total estimated time:** 3 hours

---

## Success Metrics

- Each biome has 2+ unique visual features
- Particle systems are varied (not just recolors)
- Props match biome theme (not generic)
- Visual quality matches CREATIVE_EXPANSION_PLAN.md descriptions
- Performance maintained at 45+ FPS
