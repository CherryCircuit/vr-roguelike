# Ooze Planet Handoff Sheet

## Creative Intent
This level should feel poisonous, supernatural, and beautiful in a dangerous way. It is the most overtly fantastical of the set: glowing river, alien skyline, aurora curtains, distant electrical weather, and twin moons over a black-violet volcanic plain.

The player should feel like they are standing inside a toxic cathedral.

## Core Read
- Dominant colors: `#0f0818`, `#2a1340`, `#59ff91`, `#9a4bff`, `#80d6ff`, `#f8c7ff`
- Emotional read: radioactive, uncanny, ceremonial, cosmic
- Gameplay read target: enemies must remain readable against the glowing river and sky drama, so the centerline foreground stays dark and clean

## Scene Options
- `background`: `0x10081a`
- `fog`: `new THREE.FogExp2(0x120a1d, 0.0175)`
- `cameraStart`: `[0, 1.6, 2.5]`
- `cameraLookAt`: `[0, 1.6, -24]`

## Level Composition
### Depth Bands
- `0-12m`
  Dark basalt floor with barely perceptible displacement.
- `12-28m`
  Low basalt fins and crystal outcrops at side lanes only.
- `28-58m`
  Glowing ooze river meanders through midground, off the direct centerline.
- `58-90m`
  Alien citadel on right horizon, mountains, storm clouds, lightning bank.
- `Sky`
  Twin moons left, aurora curtains center-left to center-right, sparse stars and shooting stars.

### Clearance Discipline
- No river crossing the center under `25m`.
- No crystal clusters inside the forward wedge under `20m`.
- Citadel stays right-of-center so it can dominate without sitting behind enemy approach lines.

## Required three.js Building Blocks
- `THREE.Scene`
- `THREE.FogExp2`
- `THREE.SphereGeometry`
- `THREE.PlaneGeometry`
- `THREE.BufferGeometry`
- `THREE.CatmullRomCurve3`
- `THREE.LineSegments`
- `THREE.Points`
- `THREE.InstancedMesh`
- `THREE.MeshBasicMaterial`
- `THREE.ShaderMaterial`
- `THREE.CanvasTexture`
- `THREE.AdditiveBlending`
- optional `GLTFLoader` for `alien_spire_cluster.glb`

## Scene Graph
- `levelRoot`
- `terrain/basaltPlane`
- `terrain/oozeRiver`
- `props/crystalInstances`
- `props/basaltFinInstances`
- `landmarks/citadel`
- `landmarks/mountainStrip`
- `sky/skyDome`
- `sky/moonLarge`
- `sky/moonSmall`
- `fx/auroraA`
- `fx/auroraB`
- `fx/cloudBank`
- `fx/lightningPool`
- `fx/starField`
- `fx/shootingStars`
- `debug/clearanceOverlay`

## Geometry Recipes
### Basalt Plane
- Geometry: `PlaneGeometry(140, 140, 60, 60)`
- Height logic:
  - subtle warped ground with broad swells only
  - center `12m` mostly flat
  - slight side rises for silhouette framing
- Keep terrain detail low-frequency so the river and sky remain the stars

### Ooze River
- Use `CatmullRomCurve3` to define path
- Sample into a custom ribbon `BufferGeometry`
- Width:
  - near midground `4-5m`
  - far distance `8-10m`
- Control points, in order:
  - `[-24, 0.0, -18]`
  - `[-22, 0.0, -28]`
  - `[-10, 0.0, -40]`
  - `[-2, 0.0, -52]`
  - `[-11, 0.0, -66]`
  - `[-6, 0.0, -82]`
- Never run directly from player center to horizon like a road; it should feel organic and dangerous

### Crystal Instances
- One crystal cluster geometry
- Tall, sharp, and sparse
- Place mainly:
  - front-left edge outside combat wedge
  - front-right edge outside combat wedge
  - rear side arcs
- Count:
  - high detail `18-26`
  - safe `10-14`

### Basalt Fin Instances
- One jagged volcanic fin mesh
- Flatter and lower than the crystals
- Used to break the plain and support river banks
- Count:
  - high detail `20-28`
  - safe `12-16`

### Citadel Landmark
Preferred path:
- `alien_spire_cluster.glb`
- Position: `x = 26 to 34`, `z = -66 to -78`
- Shape language:
  - vertical spires
  - curved organic towers
  - glowing slits or windows

Fallback path:
- stack cones, spikes, and tapered cylinders
- add separate emissive slit planes
- silhouette must read as alien architecture, not geology

### Aurora Curtains
- `2` curved planes in standard mode, optional third plane only in hero-FX mode
- Large scale, behind mountains, below top of sky dome
- Use canvas alpha textures generated exactly by `Aurora Canvas Logic` below
- Do not model real volumetric aurora

### Cloud Bank
- One or two dark cloud planes near lightning area
- Positioned behind the citadel and mountains
- Keep silhouette broad

### Lightning Pool
- Fixed set of `4` line-based bolts
- Positioned only in the far background
- Hidden until a flash event
- Each bolt uses `7` points and `6` rendered line segments
- Base local 2D offset template for all bolts:
  - `t = [0.00, 0.18, 0.35, 0.52, 0.70, 0.86, 1.00]`
  - `xOffset = [0.0, 1.6, -1.2, 2.3, -0.8, 1.1, 0.0]`
- Bolt generation algorithm:
  - choose start and end anchor for bolt
  - for each point index `i`:
    - `y = lerp(startY, endY, t[i])`
    - `x = lerp(startX, endX, t[i]) + xOffset[i] * scale + seededJitterX`
    - `z = lerp(startZ, endZ, t[i]) + seededJitterZ`
  - `seededJitterX` range per point: `[-0.35, 0.35]`
  - `seededJitterZ` range per point: `[-0.20, 0.20]`
  - `scale` per bolt: `0.85 - 1.20`
- Bolt anchors:
  - bolt A: start `[22, 34, -82]`, end `[16, 15, -80]`
  - bolt B: start `[28, 38, -86]`, end `[23, 18, -84]`
  - bolt C: start `[34, 33, -88]`, end `[29, 16, -87]`
  - bolt D: start `[18, 36, -90]`, end `[14, 19, -89]`

### Stars And Shooting Stars
- Star field:
  - `Points`
  - count `<= 220`
- Shooting stars:
  - fixed ring buffer of `8-12`
  - moving point streaks or tiny line segments in upper sky only

## Material Strategy
### Basalt Ground
- `MeshBasicMaterial`
- Deep violet-black base `#11091a`
- Optional vertex color bands for subtle mineral variation
- No lighting dependence required

### Ooze River Shader
- `ShaderMaterial`
- Core role:
  - feel luminous and toxic
  - move without fluid simulation
- Uniforms:
  - `uTime`
  - `uColorA = #43ff81`
  - `uColorB = #baffd4`
  - `uEdgeColor = #c8fff1`
  - `uFlowSpeedA`
  - `uFlowSpeedB`
  - `uNoiseScale`
  - `uGlowStrength`
- Shader behavior:
  - dual UV scroll at different speeds
  - brighter edges
  - soft center pulse
  - gentle downstream directional bias
- Keep it cheap and 2D

### Crystals
- `MeshBasicMaterial`
- Colors vary per instance across:
  - `#7e64ff`
  - `#8ce8ff`
  - `#b95dff`
- Small additive glow planes allowed only on the biggest rear crystals if needed

### Basalt Fins
- `MeshBasicMaterial`
- Nearly black with faint cool tint

### Citadel
- Main body:
  - `MeshBasicMaterial`
  - dark purple-black
- Emissive slits:
  - separate material
  - additive or plain bright basic material
  - colors: magenta-violet mix

### Sky Dome
- `MeshBasicMaterial`
- Backside canvas gradient:
  - zenith `#090514`
  - upper band `#1a0c2e`
  - horizon `#5a2f7c`
  - lower glow behind horizon `#ef7df8` softened by fog

### Moons
- Use canvas-painted discs on planes or simple spheres
- Larger moon plane:
  - position `[-34, 34, -82]`
  - size `18`
- Smaller moon plane:
  - position `[-12, 45, -90]`
  - size `9`
- Additive glow planes behind each

### Aurora
- `ShaderMaterial` or alpha-textured `MeshBasicMaterial`
- Additive or normal blending depending on readability
- Scroll alpha mask vertically or diagonally very slowly
- Use green-to-cyan and violet accents sparingly

### Aurora Canvas Logic
- Canvas size `256 x 1024`
- Fill transparent background
- Draw `5` vertical ribbon columns with these normalized X anchors and widths:
  - `0.12 / 0.08`
  - `0.30 / 0.12`
  - `0.48 / 0.10`
  - `0.68 / 0.14`
  - `0.84 / 0.09`
- For each ribbon:
  - use a top-to-bottom gradient:
    - `0.00 -> rgba(80,255,190,0.00)`
    - `0.25 -> rgba(110,255,205,0.14)`
    - `0.55 -> rgba(130,255,220,0.32)`
    - `0.82 -> rgba(170,120,255,0.18)`
    - `1.00 -> rgba(170,120,255,0.00)`
  - multiply alpha by a vertical stripe mask made from `sin(y * 0.055 + phase)` thresholded into soft bands
- Blur horizontally by `3px` only

### Moon Canvas Logic
- Canvas size `256 x 256`
- Base fill:
  - large moon `#b66cff`
  - small moon `#d99aff`
- Draw `7` crater circles:
  - radius range `12-34`
  - darker fill at `55%` alpha
  - lighter rim stroke at `18%` alpha
- Add one soft limb glow with `12px` blur on the lower-left edge

### Clouds And Lightning
- Clouds:
  - canvas alpha plane
  - dark violet
- Lightning:
  - `LineBasicMaterial`
  - high opacity only during flash windows
  - color `#d8b0ff`

## Animated Systems
### Ooze River
- dual UV scroll
- emissive pulse
- optional subtle downstream brightness drift

### Aurora
- slow texture offset
- minimal opacity breathing

### Lightning
- deterministic seeded intervals
- flash pattern:
  - quick on
  - one shorter afterflash
  - long dark pause

### Shooting Stars
- fixed buffer
- when one star expires, reset its preallocated state and relaunch from a high sky position

## Update Loop Pseudocode
```text
update(dt, elapsed):
  riverUniforms.uTime = elapsed

  auroraA.uniforms.uOffset += dt * 0.003
  auroraB.uniforms.uOffset += dt * 0.002

  lightningTimer -= dt
  if lightningTimer <= 0:
    trigger next seeded flash sequence
    reset lightningTimer to next seeded interval

  updateLightningVisibilityFromSequence(elapsed)

  for each shootingStar in fixedBuffer:
    advance position by precomputed velocity
    decrease lifetime
    if lifetime <= 0:
      reset star in place using seeded values
```

## GLB Brief
### `alien_spire_cluster.glb`
- Under `2,500` triangles
- Prefer one body material and one emissive slit material
- Silhouette priority over ornamental detail
- Spires should taper aggressively and cluster asymmetrically
- The landmark must read as constructed, not just natural rock

### Procedural Fallback
- `3-5` main spires from cones or tapered cylinders
- `4-6` secondary spikes
- separate slit-window quads
- one low base plinth or ridge

## Illusion Tricks
- The river is brightest in the scene floor, but it never comes close enough to dominate the central firing lane.
- Aurora planes do most of the work of selling a huge sky.
- The citadel gets perceived richness from backlighting, fog, and silhouette gaps, not mesh detail.
- Rare lightning makes the world feel alive without constant animation cost.

## Budget Allocation
- Sky dome: `1 draw`
- Basalt plane: `1 draw`
- River: `1 draw`
- Crystal instances: `1 draw`
- Basalt fins: `1 draw`
- Citadel: `1-2 draws`
- Mountain strip: `1 draw`
- Aurora planes: `2 draws` in standard mode, `3` only in hero-FX mode
- Cloud bank: `1 draw`
- Lightning: `1 draw`
- Stars: `1 draw`
- Shooting stars: `1 draw`
- Total target: `15-18` standard, `19-20` only during temporary hero-FX states

Triangle intent:
- terrain around `7,000`
- river ribbon negligible
- citadel under `2,500`
- all instances combined lightweight
- total under `30,000`

## Degradation Ladder
1. cut shooting stars in half
2. reduce crystal count
3. reduce basalt fin count
4. collapse aurora from three planes to two
5. simplify lightning to two bolts
6. switch citadel to procedural fallback if GLB path is unstable

Do not remove the river or the aurora. They are the identity anchors.

## Review Shots
### Hero Shot
- Camera: `-8, 3.4, 20`
- Look at: `20, 10, -62`
- Goal: capture river sweep, twin moons, aurora, and citadel in one frame

### Gameplay Shot
- Camera: `0, 1.6, 0`
- Look at: `0, 1.6, -28`
- Goal: prove that the glowing river and citadel do not compromise mid-distance enemy visibility

## Acceptance Checklist
- River stays out of the inner combat circle
- Citadel clearly reads as architecture
- Aurora is visible but does not wash out enemies
- Lightning is rare and dramatic, not constant
- Shooting stars stay in upper sky only
- Total effect stack stays within transparent layer budget

## Implementation Notes For Weaker Agents
- Compose the dark plain first.
- Add river second and validate gameplay readability from player eye.
- Add citadel before sky FX so the level has a grounded focal point.
- If the scene gets too noisy, remove crystals before touching aurora or river.
