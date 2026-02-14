# Port Synthwave VR Blaster from Three.js to Babylon.js

## WHY
Three.js has an unfixable bug on Quest Browser: any material with partial alpha causes black rectangles in WebXR. No workaround exists. Babylon.js handles WebXR framebuffer alpha correctly.

## CRITICAL RULE
**NEVER use `material.alpha < 1` or `material.transparencyMode = ALPHA_BLEND` in Babylon.js.** Use `ALPHA_TEST` or fully opaque materials only. We cannot risk the same bug.

---

## Files That DON'T Need Porting (copy as-is)
- `audio.js` — pure Web Audio API, zero Three.js
- `scoreboard.js` — pure Supabase/fetch, zero Three.js
- `game.js` — pure state/data, zero Three.js
- `upgrades.js` — pure data/math, zero Three.js

## Files That Need Porting
- `main.js` (~2400 lines) — scene, renderer, VR, controllers, render loop, projectiles, environment
- `hud.js` (~2100 lines) — all in-VR UI (text, menus, health, damage numbers)
- `enemies.js` (~900 lines) — enemy meshes, AI, bosses, explosions

---

## Game Design Summary (what the port must reproduce)

**Genre**: VR wave shooter, synthwave aesthetic, 20 levels, roguelike upgrades.

**Core Loop**: Stand in place, dual-wield blasters (VR controllers), shoot voxel enemies approaching from all directions. Kill target per level. Pick upgrades between levels. Boss every 5 levels.

**Visual Style**: Black void background, magenta grid floor, neon colors, retro CRT feel. Enemies are small voxel clusters. Environment has wireframe mountains, horizon glow, sun disk.

**State Machine** (game.js): TITLE → PLAYING → LEVEL_COMPLETE_SLOWMO → LEVEL_COMPLETE → UPGRADE_SELECT → (next level). Boss levels: BOSS_ALERT → PLAYING. Death: GAME_OVER → NAME_ENTRY → COUNTRY_SELECT → SCOREBOARD.

**Weapons**: Per-hand upgrades. Base = single raycast laser. Side-grades: Buckshot (spread), Lightning (hold for auto-lock beam), Charge Shot (hold & release). Upgrades stack (scope=+damage, barrel=+firerate, critical, piercing, ricochet, AOE, fire/shock/freeze DoT, vampiric heal).

**Enemies**: basic (straight line), fast (erratic, level 3+), tank (slow/tough, level 6+), swarm (tiny/fast, level 8+). Air spawns at level 6+. Voxel geometry, darken on damage.

**Bosses**: 4 tiers × 5 types. Each has unique mechanics (summon minions, projectiles, teleport, charge, shields). World-space health bar.

**HUD**: Floor-mounted (health hearts, score, level, combo). Floating text (damage numbers, alerts). 3D menus (title, upgrades, scoreboard, keyboard for name entry).

**Audio**: 100% procedural Web Audio API. No audio files. Already ported (audio.js).

---

## Babylon.js Setup (replaces index.html + main.js init)

```html
<script src="https://cdn.babylonjs.com/babylon.js"></script>
<script src="https://cdn.babylonjs.com/gui/babylon.gui.min.js"></script>
<script src="https://cdn.babylonjs.com/loaders/babylonjs.loaders.min.js"></script>
```

Or use ES modules:
```html
<script type="importmap">
{
  "imports": {
    "@babylonjs/core": "https://cdn.jsdelivr.net/npm/@babylonjs/core/+esm",
    "@babylonjs/gui": "https://cdn.jsdelivr.net/npm/@babylonjs/gui/+esm"
  }
}
</script>
```

### Scene init
```javascript
const canvas = document.getElementById('renderCanvas');
const engine = new BABYLON.Engine(canvas, true);
const scene = new BABYLON.Scene(engine);
scene.clearColor = new BABYLON.Color4(0, 0, 0, 1); // Black, fully opaque

const camera = new BABYLON.FreeCamera('cam', new BABYLON.Vector3(0, 1.6, 0), scene);

// WebXR
const xr = await scene.createDefaultXRExperienceAsync({
  floorMeshes: [],
  disableTeleportation: true,
});

engine.runRenderLoop(() => scene.render());
```

---

## Concept Mapping: Three.js → Babylon.js

### Meshes & Geometry
```javascript
// Three.js
new THREE.Mesh(new THREE.BoxGeometry(1,1,1), new THREE.MeshBasicMaterial({color: 0xff00ff}))

// Babylon.js
const box = BABYLON.MeshBuilder.CreateBox('box', {size: 1}, scene);
const mat = new BABYLON.StandardMaterial('mat', scene);
mat.diffuseColor = new BABYLON.Color3(1, 0, 1);
mat.emissiveColor = new BABYLON.Color3(1, 0, 1); // Self-lit (no lights needed, like MeshBasicMaterial)
mat.disableLighting = true;
box.material = mat;
```

Key: Set `disableLighting = true` and use `emissiveColor` to replicate Three.js `MeshBasicMaterial` (unlit).

### Grid Floor
```javascript
const ground = BABYLON.MeshBuilder.CreateGround('grid', {width: 100, height: 100}, scene);
const gridMat = new BABYLON.GridMaterial('gridMat', scene);
gridMat.majorUnitFrequency = 5;
gridMat.gridRatio = 1.67;
gridMat.mainColor = new BABYLON.Color3(0, 0, 0);
gridMat.lineColor = new BABYLON.Color3(1, 0, 1);
ground.material = gridMat;
```

### Text / HUD (replaces all canvas texture sprites in hud.js)
```javascript
// Babylon GUI is purpose-built for this — no canvas textures needed
const advancedTexture = BABYLON.GUI.AdvancedDynamicTexture.CreateFullscreenUI('UI');

// For world-space text (damage numbers, floating labels):
const plane = BABYLON.MeshBuilder.CreatePlane('text', {width: 2, height: 0.5}, scene);
const adTexture = BABYLON.GUI.AdvancedDynamicTexture.CreateForMesh(plane);
const textBlock = new BABYLON.GUI.TextBlock();
textBlock.text = 'LEVEL 5';
textBlock.color = '#00ffff';
textBlock.fontSize = 48;
adTexture.addControl(textBlock);
```

### VR Controllers
```javascript
xr.input.onControllerAddedObservable.add((controller) => {
  controller.onMotionControllerInitObservable.add((mc) => {
    // Trigger
    const trigger = mc.getComponent('xr-standard-trigger');
    trigger.onButtonStateChangedObservable.add((component) => {
      if (component.pressed) { /* fire weapon */ }
    });
    // Grip
    const grip = mc.getComponent('xr-standard-squeeze');
    grip.onButtonStateChangedObservable.add((component) => {
      if (component.pressed) { /* alt weapon / nuke */ }
    });
  });
});
```

### Raycasting (for shooting)
```javascript
const ray = new BABYLON.Ray(origin, direction, maxDistance);
const hit = scene.pickWithRay(ray, (mesh) => mesh.isEnemy);
```

### Object Pooling (same pattern, different API)
```javascript
// Pre-allocate
const pool = [];
for (let i = 0; i < 60; i++) {
  const mesh = BABYLON.MeshBuilder.CreateSphere('exp' + i, {diameter: 1}, scene);
  mesh.isVisible = false;
  pool.push(mesh);
}
// Reuse
function getFromPool() {
  return pool.find(m => !m.isVisible);
}
```

### Dispose (memory management)
```javascript
mesh.dispose(); // Babylon handles geometry+material cleanup automatically
// But for materials shared across meshes, dispose separately:
material.dispose();
texture.dispose();
```

### Lines (lightning, wireframe mountains, aim ray)
```javascript
const points = [new BABYLON.Vector3(0,0,0), new BABYLON.Vector3(1,1,0)];
const line = BABYLON.MeshBuilder.CreateLines('line', {points}, scene);
line.color = new BABYLON.Color3(1, 0, 1);
```

### Fog
```javascript
scene.fogMode = BABYLON.Scene.FOGMODE_EXP2;
scene.fogDensity = 0.012;
scene.fogColor = new BABYLON.Color3(0, 0, 0);
```

### Groups (THREE.Group → TransformNode)
```javascript
const group = new BABYLON.TransformNode('enemyGroup', scene);
childMesh.parent = group;
group.position = new BABYLON.Vector3(x, y, z);
```

---

## Porting Strategy

### Phase 1: Bare scene + VR entry
- index.html with Babylon.js CDN
- Black scene, grid floor, enter VR
- Verify: NO BLACK BOXES
- If black boxes appear, stop and report

### Phase 2: Environment
- Wireframe mountains (Lines)
- Sun disk (opaque plane, emissive orange)
- Horizon glow (opaque gradient meshes with emissive colors — no transparency)
- Fog

### Phase 3: Controllers + Shooting
- Controller tracking
- Trigger input → raycast
- Projectile spawning + movement
- Import audio.js, play shoot sound

### Phase 4: Enemies
- Port enemy voxel meshes (BoxGeometry → CreateBox)
- Movement AI (straight copy of logic)
- Hit detection (ray vs enemy meshes)
- Damage darkening (lerp emissiveColor toward dark red)
- Death explosions (pool of sphere meshes)
- Import game.js for state

### Phase 5: HUD
- Floor HUD (hearts, score, level) using Babylon GUI on world-space planes
- Damage numbers (pooled world-space text)
- Floating alerts

### Phase 6: Game States
- Title screen (3D text + button)
- Upgrade selection cards
- Level complete flow
- Boss alert
- Game over → name entry → scoreboard

### Phase 7: Bosses
- Port boss definitions and AI
- Boss health bar (world-space GUI)

### Phase 8: Polish
- Slow-mo (scale engine timestep)
- Lightning weapon (Lines with animation)
- Charge shot beam
- Buckshot spread

---

## Performance Notes
- Target: 72fps on Quest 2
- Use shared materials (one per enemy type)
- Use `mesh.freezeWorldMatrix()` for static environment meshes
- Use object pooling for projectiles, explosions, damage numbers
- Stagger expensive updates: `if (frameCount % 3 === 0)`
- Babylon has built-in `scene.performancePriority = BABYLON.ScenePerformancePriority.Aggressive` for VR
