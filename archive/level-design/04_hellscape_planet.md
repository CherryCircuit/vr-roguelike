# Hellscape Planet Handoff Sheet

## Creative Intent
This level should feel infernal, oppressive, and mythic. The player stands inside a charred ravine with a lava river cutting away toward a caldera and a distant lava sea. The scene should feel violently hot even though the player never moves.

This is the darkest biome in geometry and the hottest in emissive accents.

## Core Read
- Dominant colors: `#110706`, `#2a0d09`, `#5b1910`, `#ff5b1f`, `#ffb347`, `#ffd98d`
- Emotional read: doomed, volcanic, ritual, cataclysmic
- Gameplay read target: enemies must read as silhouettes against hot lava accents and warm moons without being swallowed by overbright fire everywhere

## Scene Options
- `background`: `0x170807`
- `fog`: `new THREE.FogExp2(0x1b0906, 0.0225)`
- `cameraStart`: `[0, 1.6, 2.5]`
- `cameraLookAt`: `[0, 1.6, -24]`

## Level Composition
### Depth Bands
- `0-10m`
  Mostly dark, ash-covered, flat combat lane.
- `10-30m`
  Ravine side walls begin to rise on left and right, keeping the center open.
- `30-58m`
  Lava river snakes through the valley floor toward a far caldera.
- `58-95m`
  Caldera plume, distant lava ocean strip, dead trees on side ridges, basalt teeth.
- `Sky`
  Large moons and hot haze, sparse ash and ember drift.

### Clearance Discipline
- No dead trees or basalt spikes within the center forward wedge under `30m`.
- Ravine framing should narrow the scene visually without physically obstructing aim lines.
- The nearest lava read should stay beyond the inner combat pad. Heat is felt visually, not as a floor hazard at player feet.

## Required three.js Building Blocks
- `THREE.Scene`
- `THREE.FogExp2`
- `THREE.SphereGeometry`
- `THREE.PlaneGeometry`
- `THREE.BufferGeometry`
- `THREE.CatmullRomCurve3`
- `THREE.InstancedMesh`
- `THREE.Points`
- `THREE.MeshBasicMaterial`
- `THREE.ShaderMaterial`
- `THREE.CanvasTexture`
- `THREE.VideoTexture`
- `THREE.AdditiveBlending`
- optional `GLTFLoader` for `dead_tree_twist.glb`

## Scene Graph
- `levelRoot`
- `terrain/ravineTerrain`
- `terrain/lavaRiver`
- `terrain/lavaHorizonStrip`
- `props/treeInstances`
- `props/basaltSpikeInstances`
- `landmarks/calderaRidge`
- `landmarks/plumeCore`
- `sky/skyDome`
- `sky/moonLargeA`
- `sky/moonLargeB`
- `sky/moonSmall`
- `fx/horizonHeatBand`
- `fx/ashPoints`
- `fx/emberPoints`
- `debug/clearanceOverlay`

## Geometry Recipes
### Ravine Terrain
- Geometry: `PlaneGeometry(140, 140, 70, 70)`
- Height logic:
  - central combat lane flattened
  - side walls rise from roughly `x +/- 14` outward
  - mild forward valley tilt to guide eye toward caldera
- Heights should be asymmetrical left to right so the ravine feels natural
- Avoid tiny rock chatter in the mesh

### Lava River
- Build from `CatmullRomCurve3` sampled into a ribbon mesh
- Control points, in order:
  - `[-3, 0.0, -24]`
  - `[-6, 0.0, -34]`
  - `[4, 0.0, -46]`
  - `[-2, 0.0, -58]`
  - `[6, 0.0, -70]`
  - `[0, 0.0, -86]`
- Width:
  - near `3.5m`
  - far `7m`
- Banks should be implied by terrain form and emissive edge glow, not extra geometry

### Lava Horizon Strip
Preferred path:
- one thin plane on far horizon
- receives muted `VideoTexture`
- placed behind caldera ridge breaks so it peeks through gaps

Fallback path:
- same plane geometry
- procedural shader with two scroll bands and heat tint

### Dead Tree Instances
Preferred path:
- `dead_tree_twist.glb`
- sparse count `10-16`
- placed on left and right ridges and rear edges

Fallback path:
- trunk and two branch forks from low-segment cylinders
- merge once, instance many

### Basalt Spike Instances
- one spike mesh
- used for side ridges and far foreground edge only
- count:
  - high `24-36`
  - safe `14-22`

### Caldera Ridge
- far horizon ridge mesh with a central breach or glowing notch
- larger than a mountain strip, more like a collapsed crater rim
- Profile points at `z = -92`:
  - `[-72, 12]`
  - `[-54, 18]`
  - `[-36, 16]`
  - `[-18, 22]`
  - `[-6, 17]`
  - `[0, 8]`
  - `[8, 19]`
  - `[22, 24]`
  - `[42, 18]`
  - `[58, 15]`
  - `[72, 12]`
- Breach opening:
  - spans `x = -3` to `x = 5`
  - glowing notch height target `6`

### Plume Core
- simple stacked planes or narrow cone plus additive card system
- it should read as a vertical eruption column in the far distance
- this is not a particle fountain

### Moons
- three total:
  - two large warm moons
  - one smaller central or lower moon
- Use planes or spheres with canvases generated exactly by `Moon Canvas Logic` below, plus separate glow discs
- Exact placements:
  - `moonLargeA`: position `[-34, 34, -82]`, plane size `18`, azimuth about `-22deg`, elevation about `34deg`
  - `moonLargeB`: position `[28, 38, -86]`, plane size `21`, azimuth about `18deg`, elevation about `39deg`
  - `moonSmall`: position `[0, 24, -70]`, plane size `9`, azimuth `0deg`, elevation about `20deg`

### Ash And Embers
- two bounded `Points` systems
- ash:
  - more numerous
  - dim and slow
- embers:
  - fewer
  - brighter
  - concentrated lower in the scene

## Material Strategy
### Ravine Terrain
- `MeshBasicMaterial` preferred
- Deep charcoal-to-red-brown gradient baked with vertex colors if available
- Terrain must remain mostly dark so lava owns the light

### Lava River Shader
- `ShaderMaterial`
- Uniforms:
  - `uTime`
  - `uColorCore = #ffd26a`
  - `uColorHot = #ff7a1f`
  - `uColorCrust = #5b130e`
  - `uFlowA`
  - `uFlowB`
  - `uGlowStrength`
  - `uEdgeBoost`
- Shader behavior:
  - dual horizontal/diagonal UV scroll
  - emissive center veins
  - darker crust islands
  - brighter edges where lava meets bank
- Must read as lava even from far player eye

### Lava Horizon Strip
If video path works:
- `VideoTexture`
- muted low-res loop
- `MeshBasicMaterial`
- low opacity modulation only if necessary

Fallback path:
- `ShaderMaterial`
- long slow flow bands and occasional bright seam pulses

### Dead Trees
- `MeshBasicMaterial`
- near-black `#090505`
- silhouette only

### Basalt Spikes
- `MeshBasicMaterial`
- dark volcanic rock with tiny warm tint on facing side if needed

### Caldera Ridge And Plume
- ridge:
  - `MeshBasicMaterial`
  - dark silhouette
- breach glow:
  - separate additive plane or strip
- plume:
  - additive planes with animated opacity and UV warp
  - keep the plume narrow and readable, not smoky noise

### Sky Dome
- `MeshBasicMaterial`
- Backside canvas gradient:
  - zenith `#170706`
  - upper `#3a120d`
  - mid `#8d2b16`
  - horizon `#ff7d37`
  - base haze `#ffbc6e`

### Moons
- Warm yellow-orange discs
- Additive glows behind each
- Slight varying scales for layered depth

### Moon Canvas Logic
- Canvas size `256 x 256`
- Base radial gradient:
  - center `#ffe6a6`
  - mid `#ffd072`
  - rim `#e79842`
- Crater pass:
  - `9` crater circles
  - radius range `10-32`
  - darker fill `rgba(168,86,34,0.38)`
  - lighter rim `rgba(255,226,166,0.20)`
- Add subtle mottling with `12` low-alpha blotches using warm brown tints
- Keep crater contrast low enough that the moons still read as glowing masses from distance

### Ash And Embers
- `PointsMaterial`
- ash: dark warm gray with low opacity
- embers: orange-yellow with slightly larger size

## Animated Systems
### Lava River
- dual UV flow
- emissive pulse
- no geometry movement

### Lava Horizon Strip
- If video:
  - let media playback drive the texture
  - no extra per-frame processing
- If shader:
  - use one slow band and one medium band only

### Plume
- opacity breathing
- one vertical UV offset if textured

### Ash And Embers
- update positions in-place
- drift upward and slightly sideways
- wrap particles when they leave bounds

### Moon Halos
- very slow pulse, optional and subtle

## Update Loop Pseudocode
```text
update(dt, elapsed):
  lavaUniforms.uTime = elapsed

  if lavaHorizonUsesShader:
    lavaHorizonUniforms.uTime = elapsed

  plumeMaterial.opacity = 0.28 + sin(elapsed * 0.3) * 0.05

  updateAshPositionsWithWrap(dt)
  updateEmberPositionsWithWrap(dt)

  moonGlowA.opacity = 0.22 + sin(elapsed * 0.11) * 0.02
  moonGlowB.opacity = 0.18 + sin(elapsed * 0.14 + 0.7) * 0.02
```

## GLB Brief
### `dead_tree_twist.glb`
- Under `1,200` triangles
- One material
- Twisted trunk with 2-4 strong branch shapes
- No tiny twig clutter
- Must read clearly in silhouette at distance

### Procedural Fallback
- one trunk cylinder
- two or three branch cylinders
- merge into one dead-tree kit
- instance with scale and rotation variation

## Video Asset Brief
### `lava_horizon_loop.mp4`
- muted
- seamless
- `<= 512px` long edge
- `12-15fps`
- no alpha
- heavy detail is not needed; broad glowing motion is enough

Autoplay policy:
- attempt play on load
- if blocked or failed, switch material to procedural fallback
- architecture must not depend on the video succeeding

## Illusion Tricks
- The far lava ocean gives the biome a feeling of enormous scale for one extra plane.
- The ravine side walls frame the fight and imply depth without cluttering the center.
- Trees are sparse silhouettes, not forests.
- The plume and breach glow make the valley feel geologically active without expensive particles.

## Budget Allocation
- Sky dome: `1 draw`
- Terrain: `1 draw`
- Lava river: `1 draw`
- Lava horizon strip: `1 draw`
- Tree instances: `1 draw`
- Basalt spikes: `1 draw`
- Caldera ridge: `1 draw`
- Plume: `1-2 draws`
- Moon discs and glows: `4-6 draws`
- Heat band: `1 draw`
- Ash points: `1 draw`
- Ember points: `1 draw`
- Total target: `14-18`, hard cap `20`

Triangle intent:
- terrain around `9,800`
- river ribbon trivial
- tree GLB under `1,200`
- total under `28,000`

## Degradation Ladder
1. reduce embers
2. reduce ash
3. reduce spike count
4. reduce tree count
5. simplify plume to one card
6. switch video horizon to procedural shader fallback

Do not remove the lava river or the caldera breach. Those are the identity anchors.

## Review Shots
### Hero Shot
- Camera: `4, 2.8, 18`
- Look at: `2, 8, -62`
- Goal: show ravine walls, lava S-curve, moons, and distant horizon sea

### Gameplay Shot
- Camera: `0, 1.6, 0`
- Look at: `0, 1.6, -28`
- Goal: verify open center combat lane and readable enemy silhouettes despite hot lava accents

## Acceptance Checklist
- Central combat floor stays dark and readable
- Lava never crowds the player pad
- Side walls frame but do not obstruct
- Far lava strip works with both video and fallback paths
- Trees remain sparse and silhouette-first
- Ash and embers remain bounded and cheap

## Implementation Notes For Weaker Agents
- Establish the ravine silhouette first.
- Add lava river second and validate readability.
- Add moons third to define the sky.
- Add particles last and keep them sparse. If the scene already feels hot enough, fewer particles is the correct answer.
