# Desert Planet Handoff Sheet

## Creative Intent
This level should feel ancient, sun-blasted, and quietly alien. The mood is not barren in the boring sense. It is vast, dry, and sacred, with isolated pools and a gigantic fossil landmark implying lost megafauna and a long-dead ecosystem.

The scene should feel like a memory of water.

## Core Read
- Dominant colors: `#c28a4a`, `#e1be84`, `#f0dfb5`, `#7ec9c6`, `#8b5d34`, `#5e3921`
- Emotional read: ancient, archaeological, lonely, noble
- Gameplay read target: enemies must silhouette against pale haze and cooler pool accents, not blend into the sand

## Scene Options
- `background`: `0xe3c28d`
- `fog`: `new THREE.Fog(0xe9d4ad, 34, 112)`
- `cameraStart`: `[0, 1.6, 2.5]`
- `cameraLookAt`: `[0, 1.6, -24]`

## Level Composition
### Depth Bands
- `0-10m`
  Flattened dusty arena with only tiny cracks and shallow contour variation.
- `10-28m`
  Low rock humps and a few pool basins at the side edges.
- `28-55m`
  More pools, sparse succulent clusters, and gentle height variation.
- `55-90m`
  Ribcage landmark on the far-right horizon, distant mesas, upper dust haze.
- `Sky`
  Warm bleached dome with mild sunwash and distant airborne dust.

### Clearance Discipline
- No pool surfaces or rock humps in the central firing lane within `18m`.
- No succulents above knee height inside the forward wedge under `35m`.
- Ribcage must stay off-axis to the right so it sells scale without interfering with aim.

## Required three.js Building Blocks
- `THREE.Scene`
- `THREE.Fog`
- `THREE.SphereGeometry`
- `THREE.PlaneGeometry`
- `THREE.CircleGeometry`
- `THREE.ShapeGeometry`
- `THREE.InstancedMesh`
- `THREE.Points`
- `THREE.MeshBasicMaterial`
- `THREE.ShaderMaterial`
- `THREE.CanvasTexture`
- optional `GLTFLoader` for `megafauna_ribcage.glb`

## Scene Graph
- `levelRoot`
- `terrain/terrainPlane`
- `terrain/poolMeshes`
- `props/rockInstances`
- `props/succulentInstances`
- `landmarks/ribcage`
- `landmarks/mesaStrip`
- `sky/skyDome`
- `fx/dustBand`
- `fx/upperDustPoints`
- `debug/clearanceOverlay`

## Geometry Recipes
### Terrain Plane
- Geometry: `PlaneGeometry(140, 140, 70, 70)`
- Height logic:
  - broad bowl shape at large scale
  - flatten radius of roughly `11m` around player
  - very shallow erosion noise only
- Max local height change near combat pad:
  - under `0.6m` within `18m`
- More pronounced forms should live to the sides and far distance

### Pool Basins
- Do not cut geometry holes in terrain
- Use visual basins composed of:
  - slightly lowered inset ring mesh
  - separate emissive pool surface mesh
- Shape:
  - mostly ovals and bean shapes
  - count `5-8`
- Placement:
  - left rear quadrant
  - far-left midground
  - far-right midground
  - right edge midground
- Keep the center mostly dry

### Rock Instances
- One low-poly rock kit instanced many times
- Use three separate instanced variants, not one merged geometry:
  - `rockVariantA`: squat wedge
  - `rockVariantB`: long slab
  - `rockVariantC`: upright chunk
- Required draw structure:
  - `1 InstancedMesh` per rock variant
- Count:
  - high detail: `rockVariantA = 20`, `rockVariantB = 18`, `rockVariantC = 14`
  - safe mode: `rockVariantA = 10`, `rockVariantB = 8`, `rockVariantC = 6`
- Keep rocks denser on side arcs than in front center

### Succulent Instances
- One alien succulent kit
- Thick, simple branching shapes, not botanical detail
- Count:
  - high detail: `24-32`
  - safe mode: `14-20`
- Color variation should come from per-instance tint if needed, not extra materials

### Ribcage Landmark
Preferred path:
- `megafauna_ribcage.glb`
- Position:
  - `x = 28 to 40`
  - `z = -58 to -72`
- Rotation:
  - angled partly toward the center so the ribs read in perspective
- Height:
  - should dominate the skyline

Fallback path:
- Build `6-8` rib arches from partial `TorusGeometry` sections:
  - torus radius `4.5 - 6.0`
  - tube radius `0.28 - 0.42`
  - radial segments `6`
  - tubular segments `10`
  - arc `Math.PI * 0.78`
- Rotate each torus segment upright and non-uniformly scale to vary rib shape
- Add one spine bridge
- Use a second tiny skull or broken front section only if it stays under budget

### Mesa Strip
- One distant terrain silhouette layer behind the ribcage
- Broad mesas, low frequency only
- Keep it lower contrast than the ribcage
- Profile points at `z = -86`:
  - `[-72, 7]`
  - `[-48, 11]`
  - `[-24, 8]`
  - `[0, 13]`
  - `[24, 9]`
  - `[50, 12]`
  - `[72, 6]`

## Material Strategy
### Terrain Material
- `MeshBasicMaterial`
- Flat shading enabled
- Base sand color near `#b8854e`
- Add vertex colors or subtle baked color map:
  - cooler in depressions
  - lighter on ridges
- No lighting dependence

### Pool Surface Shader
- `ShaderMaterial`
- Purpose:
  - alien glowing mineral slurry
  - slight swirl motion
  - radial brightness near pool center
- Uniforms:
  - `uTime`
  - `uBaseColorA = #6bd9c7`
  - `uBaseColorB = #d7ffef`
  - `uEdgeColor = #b6f6ff`
  - `uGlowStrength`
  - `uRippleScale`
- Behavior:
  - one slow rotation of UVs
  - one soft radial pulse
  - no real ripples
- Pool surfaces should feel placid and uncanny

### Pool Surface Shader Logic
- Use centered UVs:
  - `p = uv - 0.5`
  - `r = length(p)`
  - `a = atan(p.y, p.x)`
- Compute swirl:
  - `swirl = 0.5 + 0.5 * sin(a * 4.0 + r * 18.0 - uTime * 0.35)`
- Compute inner mask:
  - `inner = smoothstep(0.52, 0.12, r)`
- Compute rim ring:
  - `ring = smoothstep(0.48, 0.38, r) - smoothstep(0.38, 0.28, r)`
- Final color:
  - `mix(uBaseColorA, uBaseColorB, swirl) * inner + uEdgeColor * ring * 0.55`
- Final alpha:
  - `smoothstep(0.52, 0.48, r)`
- Emissive pulse multiplier:
  - `0.92 + 0.08 * sin(uTime * 0.22 + phase)`

### Pool Rim Material
- `MeshBasicMaterial`
- Slightly darker and smoother than surrounding sand
- Rim should help sell the depression without complex geometry

### Rocks And Succulents
- Rocks:
  - `MeshBasicMaterial`
  - warm dark brown
- Succulents:
  - `MeshBasicMaterial`
  - muted alien reds, violets, and desaturated teals
- Keep instance materials shared

### Ribcage Material
- `MeshBasicMaterial`
- Fossil bone tone around `#d6c19d`
- Slight grime variation via vertex color if available
- No texture dependence required

### Sky Dome
- `MeshBasicMaterial`
- Backside gradient:
  - zenith: `#d8b27a`
  - upper sky: `#e1c28f`
  - horizon: `#f3ddb5`
- This should feel washed out, almost overexposed, but still warm

### Dust FX
- Upper dust points:
  - `PointsMaterial`
  - sparse, tiny, low opacity
- Dust band:
  - plane or curved strip
  - warm semi-transparent haze with very low movement

## Animated Systems
### Pool Surfaces
- Rotate UV sampling slowly
- Pulse emissive value with long period
- Optional tiny distortion from a second scroll map
- Never displace geometry

### Dust Band
- Slight opacity drift only
- No visible sweeping wind streaks in v1

### Upper Dust Points
- Either static or minute horizontal drift using preallocated positions and wraparound

## Update Loop Pseudocode
```text
update(dt, elapsed):
  for each poolMaterial:
    poolMaterial.uniforms.uTime = elapsed
    poolMaterial.uniforms.uGlowStrength = 0.85 + sin(elapsed * 0.22 + poolPhase) * 0.08

  dustBandMaterial.opacity = 0.18 + sin(elapsed * 0.09) * 0.02

  if driftingDustEnabled:
    advance fixed dust positions by tiny x offset
    wrap particles that leave bounds
    mark one position attribute dirty
```

## GLB Brief
### `megafauna_ribcage.glb`
- Under `2,500` triangles
- One material preferred
- Silhouette first
- Ribs should be thick enough to read in fog
- The landmark should feel enormous even when placed far away
- Avoid tiny vertebra details that disappear on Quest

### Procedural Fallback
- `6-8` rib arches
- each arch from one partial `TorusGeometry`
- one long spine beam
- optional partial skull from a few wedge forms
- merge and simplify once built

## Illusion Tricks
- Pools are brighter than natural so they punctuate the level and keep it from feeling monotone.
- The ribcage is oversized and partly fog-softened. This makes it feel even larger than it is.
- Color variation in terrain should be broad and painterly, not noisy.
- The level feels populated through grouped side clusters, not uniform scatter everywhere.

## Budget Allocation
- Sky dome: `1 draw`
- Terrain: `1 draw`
- Pool surfaces: `1 draw` if shared material, `2 draws` max
- Pool rims: `1 draw`
- Rock instances: `1 draw`
- Succulent instances: `1 draw`
- Ribcage: `1 draw`
- Mesa strip: `1 draw`
- Dust band: `1 draw`
- Dust points: `1 draw`
- Total target: `12-16`

Triangle intent:
- terrain around `9,800`
- ribcage under `2,500`
- rocks and succulents lightweight
- total comfortably under `25,000`

## Degradation Ladder
1. reduce dust points
2. reduce succulent count
3. reduce rock count
4. simplify pool shader to one UV rotation
5. switch ribcage to procedural fallback if GLB path is problematic

Do not remove the pools or the ribcage. Those are the biome identity anchors.

## Review Shots
### Hero Shot
- Camera: `-10, 2.5, 16`
- Look at: `22, 8, -56`
- Goal: ribcage dominates right horizon while pools and succulents punctuate foreground

### Gameplay Shot
- Camera: `0, 1.6, 0`
- Look at: `0, 1.6, -28`
- Goal: demonstrate that the central combat lane remains clear and the far-right ribcage does not obstruct target reads

## Acceptance Checklist
- Player eye position sees open center space
- Pools cluster mostly to sides and outer midground
- Ribcage reads colossal from gameplay view
- Terrain variation is broad, not bumpy and noisy
- Dust adds atmosphere without making the level look blurry
- All pool surfaces share a tight, cheap shader implementation

## Implementation Notes For Weaker Agents
- Finish terrain flattening before placing pools.
- Place ribcage before finalizing prop scatter so the level composes around it.
- If the level feels empty, add one more side cluster, not center clutter.
