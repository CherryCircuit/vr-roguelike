# SPACEOMICIDE Standalone Biome Review Package

## Purpose
This document is the shared architectural handoff for a standalone biome review package. It is intentionally separate from the live game repo. The goal is to let implementation agents build a reviewable environment package without making scene-architecture decisions on their own.

Coding is explicitly deferred until these documents are approved.

## Deliverable Scope
- One standalone `index.html` review harness.
- Four self-contained biome modules.
- One shared helper module if needed by implementers.
- Four tiny landmark GLBs are allowed, with procedural fallbacks defined in the biome sheets.
- One optional local lava-loop MP4 is allowed for Hellscape only, with a procedural fallback defined in the biome sheet.

## Package Topology
- `index.html`
  Review harness only. No gameplay systems.
- `shared/levelRuntime.js`
  Shared helpers, cleanup, seeded random, material registration, temp object pools.
- `levels/synthwavePlanet.js`
- `levels/desertPlanet.js`
- `levels/oozePlanet.js`
- `levels/hellscapePlanet.js`
- `assets/models/palm_silhouette.glb`
- `assets/models/megafauna_ribcage.glb`
- `assets/models/alien_spire_cluster.glb`
- `assets/models/dead_tree_twist.glb`
- `assets/video/lava_horizon_loop.mp4`

The exact implementation file names can change, but the module boundaries must not.

## Pinned Runtime Spec
- Three.js version is pinned to `r183` / `0.183.0`.
- Delivery method is raw ES modules via `type="module"` and an `importmap`.
- Import source:
  - `three`: `https://cdn.jsdelivr.net/npm/three@0.183.0/build/three.module.js`
  - `three/addons/`: `https://cdn.jsdelivr.net/npm/three@0.183.0/examples/jsm/`
- No bundler.
- No framework.
- No remote runtime dependencies beyond the pinned Three.js CDN URLs above.
- The review package must run from static HTTP, not `file://`.

## Review Harness Responsibilities
- Create and own the `THREE.WebGLRenderer`, `THREE.Scene`, `THREE.PerspectiveCamera`, and desktop review controls.
- Provide deterministic level switching with full disposal of the prior biome before loading the next one.
- Expose review controls:
  - `Click`: pointer lock
  - `WASD`: horizontal movement
  - `Q` and `E`: descend and ascend
  - `Shift`: movement speed boost
  - `R`: reset camera to player eye pose
  - `1-4`: jump directly to a level
  - `N` and `P`: next and previous level
  - `C`: toggle combat-clearance overlay
  - `F`: toggle stats overlay
- Show debug counters from `renderer.info`:
  - draw calls
  - triangles
  - points
  - lines
  - geometries
  - textures
- Compile the scene after each level load and before the level is declared ready for review.
- Never bake gameplay assumptions into biome code beyond the stationary player position and forward combat wedge.

## Review Harness Implementation Spec
### `index.html`
- Single document with inline CSS and one module bootstrap script.
- Renderer canvas is appended into `#app`.
- Required DOM structure:
  - `#app`
    renderer mount point only
  - `#overlay`
    absolute-positioned HTML UI root
  - `#level-name`
    current biome name
  - `#controls-help`
    compact key legend
  - `#stats-panel`
    renderer counters and current quality mode
  - `#shot-buttons`
    `Hero`, `Gameplay`, `Reset`, `Prev`, `Next`
  - `#banner`
    temporary load or error message area
- Debug overlay is plain HTML/CSS, not `stats.js`.
- The combat-clearance overlay is a 3D helper attached to `levelRoot/debug`, not a DOM overlay.

### Renderer Spec
- `new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'high-performance' })`
- `renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))`
- `renderer.setSize(window.innerWidth, window.innerHeight)`
- `renderer.outputColorSpace = THREE.SRGBColorSpace`
- `renderer.toneMapping = THREE.NoToneMapping`
- `renderer.sortObjects = true`
- The harness does not enable WebXR in v1.

### Camera And Controls Spec
- Camera:
  - `PerspectiveCamera(70, aspect, 0.1, 220)`
- Control system:
  - `PointerLockControls`
  - click-to-lock
  - `WASD` strafe and move
  - `Q/E` vertical move
  - `Shift` speed boost
- Camera move speeds:
  - normal: `8 units/sec`
  - boost: `18 units/sec`
- Camera reset returns to `sceneOptions.cameraStart` and orients toward `sceneOptions.cameraLookAt`.

### Scene Option Consumption
On successful biome load, the harness must:
1. set `scene.background = new THREE.Color(sceneOptions.background)`
2. set `scene.fog = sceneOptions.fog`
3. attach `root` to `scene`
4. move camera to `sceneOptions.cameraStart`
5. call `camera.lookAt(...sceneOptions.cameraLookAt)`
6. if available, run `await renderer.compileAsync(scene, camera)`, otherwise call `renderer.compile(scene, camera)`
7. wire `Hero` button to set `camera.position` and `camera.fov` from `sceneOptions.heroShot`, then `camera.lookAt(...sceneOptions.heroShot.target)` and `camera.updateProjectionMatrix()`
8. wire `Gameplay` button to set `camera.position` and `camera.fov` from `sceneOptions.gameplayShot`, then `camera.lookAt(...sceneOptions.gameplayShot.target)` and `camera.updateProjectionMatrix()`
9. update `#level-name`, `#stats-panel`, and fallback-state labels

### Stats Overlay Rendering
- `#stats-panel` updates every `250ms`
- It must read from:
  - `renderer.info.render.calls`
  - `renderer.info.render.triangles`
  - `renderer.info.render.points`
  - `renderer.info.render.lines`
  - `renderer.info.memory.geometries`
  - `renderer.info.memory.textures`
- The panel must also show:
  - current biome id
  - active quality tier
  - whether fallback assets are active
  - current shot mode: `reset`, `hero`, or `gameplay`

### Lighting Policy
- The standalone harness creates no scene lights.
- v1 handoff biomes are unlit by default and must read correctly with `MeshBasicMaterial` and shaders only.
- `MeshLambertMaterial` is out of scope for this handoff unless a future revision adds explicit light rig definitions to both the foundation doc and the biome sheet.

## Runtime Contract For Biome Modules
Each biome module must export:

```js
export const levelMeta = {
  id: 'synthwave-planet',
  name: 'Synthwave Planet',
  heroShot,
  gameplayShot,
  dominantColors,
  targetBudgets
};

export async function loadLevel(ctx) {
  return {
    root,
    sceneOptions,
    update(dt, elapsed),
    dispose()
  };
}
```

`ctx` must include:
- `scene`
- `renderer`
- `assetBaseUrl`
- `registerFadeMaterial(material)`
- `resourceTracker`
- `rng`
- `temps`
- `quality`

`sceneOptions` must include:
- `background`
- `fog`
- `cameraStart`
- `cameraLookAt`
- `heroShot`
- `gameplayShot`

## Exact Helper API Contracts
Implementation agents must use these exact helper signatures in the shared runtime module:

```ts
type Vec3Tuple = [number, number, number];

type CameraShot = {
  position: Vec3Tuple;
  target: Vec3Tuple;
  fov?: number;
};

type FadeMaterialOptions = {
  id?: string;
  defaultOpacity?: number;
  blendMode?: 'normal' | 'additive';
};

interface SeededRng {
  seed: number;
  float(): number;
  range(min: number, max: number): number;
  int(min: number, maxInclusive: number): number;
  bool(probability?: number): boolean;
  pick<T>(items: readonly T[]): T;
  reset(seed?: number): void;
}

interface TempPool {
  v3(slot: number): THREE.Vector3;
  q(slot: number): THREE.Quaternion;
  c(slot: number): THREE.Color;
  m4(slot: number): THREE.Matrix4;
  arr(slot: number, length: number): Float32Array;
}

interface ResourceTracker {
  track<T>(resource: T): T;
  trackObject(object: THREE.Object3D): THREE.Object3D;
  trackGeometry(geometry: THREE.BufferGeometry): THREE.BufferGeometry;
  trackMaterial(material: THREE.Material): THREE.Material;
  trackTexture(texture: THREE.Texture): THREE.Texture;
  trackGLTF(root: THREE.Object3D): THREE.Object3D;
  untrack<T>(resource: T): T;
  counts(): {
    objects: number;
    geometries: number;
    materials: number;
    textures: number;
  };
  disposeAll(): void;
  clear(): void;
}

interface LevelContext {
  scene: THREE.Scene;
  renderer: THREE.WebGLRenderer;
  assetBaseUrl: string;
  quality: 'high' | 'safe';
  rng: SeededRng;
  temps: TempPool;
  resourceTracker: ResourceTracker;
  registerFadeMaterial(
    material: THREE.Material,
    options?: FadeMaterialOptions
  ): THREE.Material;
}

interface SceneOptions {
  background: number;
  fog: THREE.Fog | THREE.FogExp2;
  cameraStart: Vec3Tuple;
  cameraLookAt: Vec3Tuple;
  heroShot: CameraShot;
  gameplayShot: CameraShot;
}
```

Behavior notes:
- `rng.reset(seed)` resets deterministic placement for rebuilds.
- `temps.v3(slot)` and related methods always return the same mutable object for a given slot index.
- `resourceTracker.track*()` methods return the same object passed in so they can be chained inline.
- `registerFadeMaterial()` must return the same material after recording it in a fade registry.

## Shared World Rules
- Player origin is `0, 0, 0`.
- Player eye height is `0, 1.6, 0`.
- Player faces `-Z`.
- Combat clearance zone:
  - radius: `60m`
  - azimuth: `-60` to `+60` degrees from forward
  - inside this zone, no tall props, no opaque blockers, no landmark legs or trunks that materially obstruct mid-distance enemy reads
- Near floor detail inside the combat zone is allowed if it stays lower than knee height and reads as non-blocking from player eye level.
- Side berms, framing rocks, palms, dead trees, crystals, and ruins must live mostly outside the clearance wedge.
- Far landmarks may sit inside the wedge only if they are on or beyond the fog wall and mostly silhouette-only.

## Performance Envelope
Environment-only targets before enemies, bullets, and HUD:
- Base draw calls: `<= 18`
- Hero FX draw calls: `<= 24`
- Visible triangles: `<= 60,000`
- Live particles: `<= 1,200`
- Major transparent layers: `<= 6`
- Active video textures: `<= 1`
- Active custom shader materials: `<= 5`

Hard rules:
- No `MeshStandardMaterial`.
- No dynamic shadows.
- No post-processing.
- No screen-space reflections.
- No `new THREE.Vector3()` or similar allocations inside per-frame update loops.
- No geometry rebuilds at runtime except on load or resize.
- No unbounded particle spawning.
- No complex fragment shaders with multiple noise stacks.

## Shared three.js Usage Policy
Prefer:
- `MeshBasicMaterial`
- `ShaderMaterial` only for simple UV-scroll, emissive pulse, edge glow, twinkle, or vertex wobble
- `CanvasTexture`
- `VideoTexture` only in Hellscape and only for the lava horizon strip
- `InstancedMesh`
- `Points`
- `LineSegments`
- `SphereGeometry`
- `PlaneGeometry`
- custom `BufferGeometry` for rivers and ribbons

Use cautiously:
- `GLTFLoader` for tiny landmarks only
- `Fog` or `FogExp2`
- `AdditiveBlending` for halos, aurora, haze bands, and emissive glows
- `MeshLambertMaterial` only in a future lit revision, not in this v1 handoff

Do not use:
- `TubeGeometry` for rivers
- animation mixers
- skinning
- skeletal meshes
- morph targets
- layered alpha-card forests

## Shared Helper Responsibilities
Implementation agents may create a single shared helper module with these responsibilities:
- `ResourceTracker`
  Tracks textures, materials, geometries, and object roots, and disposes them on level switch.
- `registerFadeMaterial(material)`
  Records materials that should be driven by a future crossfade system. For the standalone harness it can be a no-op registry, but every fade-eligible material must still be registered.
- seeded random helpers
  Deterministic scatter per level, using a fixed seed per biome.
- temp pools
  Reused `Vector3`, `Quaternion`, `Color`, and scratch arrays.
- instancing helpers
  Scatter transforms into `InstancedMesh` without per-frame work.
- geometry helpers
  Terrain flatten pass, ribbon mesh builder, curved plane builder for aurora.
- canvas texture builders
  Sun bands, moon discs, haze ramps, star sprites, aurora alpha strips.
- debug helpers
  Clearance-wedge visualizer and labeled review shot presets.

The exact public surface of those helpers is fixed by `Exact Helper API Contracts` above. Implementers may add private helper functions, but they must not rename or reshape the shared API.

## Scene Graph Convention
Every level should follow the same root structure:
- `levelRoot`
- `levelRoot/static`
- `levelRoot/terrain`
- `levelRoot/props`
- `levelRoot/landmarks`
- `levelRoot/fx`
- `levelRoot/sky`
- `levelRoot/debug`

This is for predictable cleanup and easy comparison between biomes.

## Shared Material Registration Policy
Call `registerFadeMaterial()` for:
- sky domes
- sun and moon discs
- glow halos
- fog cards and haze planes
- river, lava, ooze, and pool surfaces
- landmark emissive window materials
- additive atmosphere layers

Do not bother registering:
- debug helpers
- opaque terrain if it will never be faded in the standalone harness

## Level Switching And Disposal Rules
- Remove prior `root` from scene before loading the next biome.
- Dispose in this order:
  - stop timers and animation state
  - pause and release video if any
  - detach root from scene
  - dispose tracked geometries, materials, textures
  - dispose GLTF scene resources via tracker
- After disposal, wait one animation frame, then load the next level.
- After load, call compile, then snap camera to `cameraStart`.
- Validate `renderer.info.memory` after each switch.

## Review Camera Presets
Every biome must define:
- `cameraStart`
  The standard gameplay-readability viewpoint from player eye.
- `heroShot`
  A wider composition chosen to best sell the biome.
- `gameplayShot`
  A second composition from player eye that proves combat readability.

Default review poses:
- `cameraStart`: `0, 1.6, 2.5`, looking at `0, 1.4, -22`
- `heroShot`: biome-specific
- `gameplayShot`: `0, 1.6, 0`, looking at `0, 1.6, -25`

## Asset Authoring Rules For Tiny GLBs
All GLBs must:
- be static only
- be a single object hierarchy if practical
- stay under `2,500` triangles each
- use `1-2` materials max
- avoid texture dependence when possible
- prefer vertex colors or a tiny atlas
- have pivot/orientation documented in the biome sheet
- be authored to still read well as a silhouette from `30m` to `80m`

Blender export checklist:
- apply transforms
- merge submeshes where possible
- triangulate if needed before export
- freeze scale to `1,1,1`
- orient forward axis so placement is predictable
- export without cameras, lights, animation, or unnecessary extras

## Quality Tiers
All implementation should support two internal quality profiles even in the review harness:
- `high`
  Full planned feature set within the approved budget.
- `safe`
  Same composition, fewer particles, fewer stars, fewer instance counts, and procedural fallback instead of GLB or video if needed.

Each biome sheet defines what degrades first.

## Acceptance Criteria
A biome is architecturally complete when it has:
- a full layer stack from near floor to sky
- exact three.js classes and addons called out
- geometry recipes for every major visual element
- material strategy for every major element
- animation rules for every dynamic system
- GLB brief and procedural fallback
- performance caps and draw-call intent
- a degradation ladder
- hero shot and gameplay shot definitions
- review checklist

## Implementation Order For Weaker Agents
Agents must build in this order:
1. root group and scene options
2. terrain and floor composition
3. far horizon and sky
4. landmark or signature silhouette
5. repeated prop instancing
6. emissive surfaces
7. sparse FX
8. update loop
9. disposal
10. debug shot validation

Agents must not skip ahead to polish FX before the composition reads correctly from `0, 1.6, 0`.

## QA Matrix
All biomes must pass:
- load without errors over local static HTTP
- switch across all four levels ten times
- preserve a clean combat wedge
- remain readable from player eye
- stay inside environment-only budget
- survive loss of GLB or video asset by using fallback path
- contain no per-frame allocations in the level update path

## Handoff Note
The four biome sheets below are the decision-complete creative and technical spec. Weaker implementation agents should treat them as source-of-truth and avoid substituting new scene architecture, new landmark placement, or new effect families unless a fallback path is explicitly called for.
