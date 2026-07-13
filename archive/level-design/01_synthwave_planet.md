# Synthwave Planet Handoff Sheet

## Creative Intent
This level should feel like the player is standing inside the cover art of an impossible synthwave album: clean, iconic, and legible. The scene is not busy. It wins through giant scale cues, aggressive color separation, and a few sharp silhouettes that feel richer than the geometry really is.

The mood is calm but electric. The player should feel framed, not boxed in.

## Core Read
- Dominant colors: `#ff4fa3`, `#ff8d4d`, `#ffd36f`, `#6f2cff`, `#1a1038`, `#0d0620`
- Emotional read: triumphant, glossy, retro-futurist, dreamlike
- Gameplay read target: enemies should appear dark or cool-colored against a warm horizon and bright sun core, never disappear into the floor

## Scene Options
- `background`: `0x12061e`
- `fog`: `new THREE.FogExp2(0x1a0824, 0.0135)`
- `cameraStart`: `[0, 1.6, 2.5]`
- `cameraLookAt`: `[0, 1.4, -22]`

## Level Composition
### Depth Bands
- `0-10m`
  Flat combat pad with low-contrast gloss and no tall geometry.
- `10-25m`
  Road/grid continuation, subtle side curbs, no palms yet.
- `25-50m`
  Palm rows begin on far-left and far-right lanes, leaving the center open.
- `50-90m`
  Mountain silhouette strip, giant sun, low haze, and distant road convergence.
- `Sky`
  Gradient dome with a faint top-star pass and one warm atmospheric band near horizon.

### Clearance Discipline
- No palm trunks within the forward 120-degree wedge under `35m`.
- No bright side props near the centerline that compete with enemies.
- The brightest part of the scene is the sun and its reflection band, both beyond gameplay interaction range.

## Required three.js Building Blocks
- `THREE.Scene`
- `THREE.FogExp2`
- `THREE.SphereGeometry`
- `THREE.PlaneGeometry`
- `THREE.BufferGeometry`
- `THREE.LineSegments`
- `THREE.InstancedMesh`
- `THREE.Points`
- `THREE.MeshBasicMaterial`
- `THREE.ShaderMaterial`
- `THREE.CanvasTexture`
- `THREE.AdditiveBlending`
- optional `GLTFLoader` for `palm_silhouette.glb`

## Scene Graph
- `levelRoot`
- `terrain/floorBase`
- `terrain/floorGloss`
- `terrain/roadPlane`
- `props/palmClusters`
- `landmarks/mountainStripNear`
- `landmarks/mountainStripFar`
- `sky/skyDome`
- `sky/sunDisc`
- `sky/sunGlow`
- `fx/horizonHaze`
- `fx/sparseStars`
- `debug/clearanceOverlay`

## Geometry Recipes
### Floor Base
- Geometry: `PlaneGeometry(140, 140, 1, 1)`
- Orientation: horizontal, centered at origin
- Height: `y = 0`
- Role: provides the dark mirror-like ground color
- No displacement

### Floor Gloss Overlay
- Geometry: `PlaneGeometry(140, 110, 1, 1)`
- Height: `y = 0.03`
- Rotation: horizontal
- Extend more strongly toward `-Z` so horizon glow and sun streak can accumulate visually
- This is not a reflection system
- Material requirements:
  - `depthWrite = false`
  - `polygonOffset = true`
  - `polygonOffsetFactor = -1`
  - `polygonOffsetUnits = -2`

### Road/Grid Plane
- Geometry: `PlaneGeometry(90, 110, 1, 1)`
- Position: centered on `x = 0`, shifted to favor negative Z
- Width: narrow enough to imply a causeway, broad enough to feel heroic
- Use either custom `LineSegments` grid or a shader-based procedural grid on the plane
- Do not use `GridHelper` if it becomes visually generic; custom line density is preferred

### Palm Rows
Preferred path:
- Load `palm_silhouette.glb`
- Instantiate in 12-18 palms total
- Split into 4 loose clusters
- Placement:
  - left arc: `x -22 to -42`, `z -30 to -72`
  - right arc: `x 22 to 42`, `z -30 to -72`
  - optional rear framing: 2-4 palms behind player beyond `z +12`

Fallback path:
- trunk: one low-segment cylinder mesh instanced
- crown: two crossed frond planes or alpha-cut silhouette cards
- all palms merged into one or two `InstancedMesh` objects

### Mountain Strips
- Build two silhouette layers from custom `BufferGeometry` or `ShapeGeometry`
- Far strip:
  - wider, darker, lower contrast
  - `z = -82`
  - profile points:
    - `[-72, 6]`
    - `[-50, 10]`
    - `[-26, 8]`
    - `[-4, 12]`
    - `[18, 9]`
    - `[42, 11]`
    - `[72, 7]`
- Near strip:
  - slightly brighter edge, slightly taller peaks
  - `z = -68`
  - profile points:
    - `[-70, 10]`
    - `[-48, 15]`
    - `[-22, 13]`
    - `[6, 18]`
    - `[30, 14]`
    - `[54, 17]`
    - `[72, 11]`
- Keep peaks broad and iconic, not noisy

### Sun Disc
- Geometry: `PlaneGeometry(28, 28)`
- Position: `0, 16, -84`
- Use a canvas texture with horizontal cut bands
- Disc lower edge should feel close to the horizon, not high in the sky
- Canvas band spec:
  - texture size `512 x 512`
  - base vertical gradient stops:
    - `0.00 -> #fff0a8`
    - `0.28 -> #ffd26b`
    - `0.56 -> #ff9a42`
    - `0.82 -> #ff5d62`
    - `1.00 -> #d52e72`
  - cut bands remove alpha with feathered rectangles centered at these normalized Y positions and heights:
    - `0.60 / 0.010`
    - `0.67 / 0.014`
    - `0.74 / 0.018`
    - `0.80 / 0.024`
    - `0.85 / 0.030`
    - `0.90 / 0.038`
    - `0.94 / 0.050`
  - each cut gets a `4px` vertical feather on top and bottom edge
  - no cuts above the equator

### Sun Glow
- Geometry: `CircleGeometry(20, 32)`
- Position: slightly behind the sun disc
- Pure additive halo

### Horizon Haze
- Geometry: one or two long planes or a low cylinder band
- Position: near the horizon line, behind road convergence
- Use this to soften the mountain edge and road termination

### Sparse Stars
- Only if needed in the upper dome
- Count: `<= 120`
- Very small points, concentrated above `y > 24`
- Keep them dim so they do not conflict with the sunset fantasy

## Material Strategy
### Sky Dome
- `MeshBasicMaterial`
- `side = BackSide`
- Canvas-generated vertical gradient
- Color stops:
  - zenith: `#140725`
  - upper sky: `#25104a`
  - mid sky: `#8d2f7c`
  - horizon band: `#ff6f5f`
  - near horizon base: `#ffb067`
- No clouds
- No procedural noise in shader unless extremely simple

### Floor Base Material
- `MeshBasicMaterial`
- Very dark plum base `#12071f`
- A slight warm tint toward negative Z can be baked through a canvas texture if needed

### Floor Gloss Shader
- `ShaderMaterial`
- Purpose:
  - fake wet sheen
  - stretch sun color toward camera
  - add a faint moving scanline/gloss pulse
- Uniforms:
  - `uTime`
  - `uSunColor`
  - `uHorizonColor`
  - `uGlossStrength`
  - `uRoadMask`
- Behavior:
  - two low-frequency scrolling UV bands
  - fresnel-style brightening toward shallow view angles
  - horizon tint stronger for negative Z
- No normal maps
- No reflection probes

### Road/Grid Material
- Preferred:
  - `ShaderMaterial` drawing procedural lane lines and grid density increase toward horizon
- Fallback:
  - `MeshBasicMaterial` with a canvas texture and emissive-looking line color
- Colors:
  - primary grid line: `#ff55cc`
  - accent line: `#48b6ff`

### Palm Materials
- `MeshBasicMaterial`
- Silhouette color near-black `#08050d`
- Optional faint rim tint for rear palms only if they disappear against the mountains

### Mountain Materials
- `MeshBasicMaterial`
- Far layer: `#160c2a`
- Near layer: `#241140`
- Optional edge line:
  - `LineBasicMaterial`
  - opacity `0.25`
  - color `#f349b8`

### Sun Materials
- Sun disc:
  - `MeshBasicMaterial`
  - canvas texture with warm band cuts
  - alpha-enabled
- Sun halo:
  - `MeshBasicMaterial`
  - additive
  - opacity pulse range only `0.28 - 0.38`

### Sun Canvas Drawing Logic
- clear the canvas fully transparent
- draw a filled circle centered at `256,256` with radius `240`
- fill circle using the vertical gradient listed in `Sun Disc`
- for each cut band:
  - compute `bandY = normalizedY * 512`
  - compute `bandHeight = normalizedHeight * 512`
  - draw a horizontal alpha-removal band across the whole canvas width
  - feather by drawing semi-transparent strips at `25%` and `75%` alpha before full cut
- apply a mild outer glow pass behind the circle only:
  - color `#ff9d4d`
  - blur `18px`
- final sun texture must keep a crisp circular silhouette and readable cut pattern from far distance

## Animated Systems
### Floor Gloss
- Updates every frame
- Scroll two UV offsets
- Blend a shallow-angle highlight toward the horizon
- Keep motion subtle, not nightclub flicker

### Sun Halo
- Pulse slowly over 8-12 seconds
- No scale animation on the sun disc itself

### Horizon Haze
- Drift opacity slowly
- No lateral movement

### Stars
- Static or extremely subtle twinkle
- Twinkle must be material-uniform or attribute-based, never spawning new particles

## Update Loop Pseudocode
```text
update(dt, elapsed):
  glossUniforms.time += dt
  glossUniforms.offsetA.x = (elapsed * 0.008) mod 1
  glossUniforms.offsetB.y = (elapsed * 0.013) mod 1

  haloMaterial.opacity = 0.33 + sin(elapsed * 0.45) * 0.04

  hazeMaterial.opacity = 0.22 + sin(elapsed * 0.12 + 1.3) * 0.03

  if starsEnabled:
    starMaterial.opacity = 0.55 + sin(elapsed * 0.2) * 0.05
```

No transforms, no instance matrix changes, and no geometry edits in the frame loop.

## GLB Brief
### `palm_silhouette.glb`
- One trunk plus one combined frond canopy
- Under `900` triangles
- One material preferred
- No alpha texture if possible; silhouette geometry is better
- Trunk should taper dramatically
- Fronds should read from distance as a broad, flat synthwave silhouette

### Procedural Fallback
- Trunk:
  - `CylinderGeometry(0.18, 0.35, 7.5, 5)`
- Fronds:
  - 4 to 6 long narrow planes in a star pattern, merged or grouped
- All trees assembled once, then instanced by cluster transforms

## Illusion Tricks
- The floor is not reflective. It only carries stretched warm color bands near the horizon.
- The road converges more strongly than realistic perspective would require. This makes the scene feel deeper.
- Palms are placed outside the central play lane so the level feels rich without obscuring targets.
- The mountain layers are broad and few. Busy silhouettes cheapen the retrowave read.

## Budget Allocation
- Sky dome: `1 draw`
- Floor base: `1 draw`
- Floor gloss: `1 draw`
- Road plane: `1 draw`
- Mountain strips: `2-4 draws`
- Sun + halo: `2 draws`
- Palm instances: `1-2 draws`
- Haze: `1 draw`
- Stars: `0-1 draw`
- Total target: `10-14`, hard cap `18`

Triangle intent:
- floor planes and sky are trivial
- mountains combined under `3,000`
- palms under `8,000` even with fallback
- total well under `20,000`

## Degradation Ladder
If performance slips:
1. disable stars
2. remove mountain edge lines
3. reduce palm count by one third
4. simplify road/grid from shader to baked canvas texture
5. reduce floor gloss math to one scroll band

Do not remove the sun or the road. They are the level identity.

## Review Shots
### Hero Shot
- Camera: `0, 2.2, 18`
- Look at: `0, 7, -55`
- Goal: sun centered, palms framing left and right, road converging hard

### Gameplay Shot
- Camera: `0, 1.6, 0`
- Look at: `0, 1.6, -28`
- Goal: prove empty center lane and readable enemy silhouettes against warm horizon

## Acceptance Checklist
- Center combat lane is clear to `60m`
- Sun is visible from player eye without being fully occluded by mountains
- Palms feel present but never crowd the centerline
- Floor reads as glossy from player eye without looking like literal water
- Total environment draws remain within target
- Switching away disposes textures and materials cleanly

## Implementation Notes For Weaker Agents
- Build the sun first, then the road, then the mountains, then palms.
- If the scene already reads by then, add floor gloss last.
- Avoid adding new accent objects. This level succeeds through restraint.
