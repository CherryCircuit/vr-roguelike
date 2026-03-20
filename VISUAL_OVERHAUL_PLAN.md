# SPACEOMICIDE Visual Overhaul — Implementation Plan

**Repository:** ~/Github/vr-roguelike  
**Tech:** Three.js, WebXR, vanilla JS  
**Target:** Quest 2/3 @ 72fps

---

## Table of Contents
1. [Architecture Overview](#1-architecture-overview)
2. [File Structure](#2-file-structure)
3. [Implementation Order](#3-implementation-order)
4. [Feature 1: Mountains (Valley Effect)](#4-mountains)
5. [Feature 2: Sun Glow](#5-sun-glow)
6. [Feature 3: Scrolling Pink Grid Floor](#6-scrolling-grid)
7. [Feature 4: Death Physics & Voxel Explosions](#7-death-physics)
8. [Feature 5: Weapon Projectiles](#8-weapon-projectiles)
9. [Feature 6: Weapon Models](#9-weapon-models)
10. [Feature 7: Level-Based Scenery Changes](#10-level-scenery)
11. [Performance Budget](#11-performance-budget)
12. [Task Breakdown](#12-tasks)

---

## 1. Architecture Overview

### Current State
- **main.js** (2924 lines) — monolith: init, environment, controllers, combat, render loop
- **enemies.js** — voxel enemies with merged geometry, explosion sprite pool (60 pooled sprites)
- **weapons.js** — weapon/upgrade definitions (reference, not actively imported by main.js)
- **upgrades.js** — actual weapon stat calculations used in gameplay
- **game.js** — state machine (12 states), level config (20 levels, boss every 5th)
- **hud.js** — UI panels, damage numbers, boss health bar
- All materials are `MeshBasicMaterial` (unlit = no lights needed = Quest-optimal)
- Environment: static `GridHelper(120,48)`, canvas-textured sun plane, 2D `ShapeGeometry` mountains, `Points` stars

### Key Constraints
- **Quest 2/3 target**: 72fps at 1.5x foveated resolution
- All materials MUST stay `MeshBasicMaterial` or use very simple custom shaders
- No post-processing (no EffectComposer — too expensive for mobile VR)
- Object pooling everywhere (enemies already do this pattern)
- Draw call budget: aim for <200 total
- Existing `renderer.toneMapping = THREE.NoToneMapping` — keep it

---

## 2. File Structure

```
vr-roguelike/
├── main.js                    # (MODIFY) Hook new systems, strip old env code
├── environment.js             # (NEW) Mountains, sun, atmosphere, scrolling grid
├── scenery.js                 # (NEW) Level-based scenery themes & transitions
├── vfx.js                     # (NEW) Voxel death explosions, sparks, projectile trails
├── weapon-models.js           # (NEW) 3D weapon models for VR hands
├── enemies.js                 # (MODIFY) Hook new death effects from vfx.js
├── upgrades.js                # (MODIFY minor) Projectile visual metadata
├── game.js                    # (MODIFY minor) Add currentTheme to state
├── hud.js                     # (no change)
├── weapons.js                 # (existing reference)
└── (no shaders/ directory needed — all inline MeshBasicMaterial)
```

---

## 3. Implementation Order

**Phase 1 — Foundation (do first, enables everything else)**
1. Create `environment.js` — extract `createEnvironment()` and children from main.js
2. Create `vfx.js` — particle/voxel pool system

**Phase 2 — High Impact Visuals**
3. 🏔️ Mountains (wireframe valley ring)
4. ☀️ Sun glow enhancement
5. 🟪 Scrolling grid floor

**Phase 3 — Combat Feel**
6. 💥 Death physics (voxel explosions with gravity + burn)
7. 🔫 Weapon projectiles (glowing lasers with trails)

**Phase 4 — Polish**
8. 🔧 Weapon models in hand
9. 🌍 Level-based scenery changes (5 themes)

---

## 4. Mountains (Valley Effect)

### Current Code (main.js ~L480-520)
- `createMountains()` — 2 layers of `THREE.Shape` + `ShapeGeometry` (2D silhouettes)
- Only behind player (negative Z), `THREE.Line` for edges
- Colors: `MTN_DARK = 0x1a0033`, `MTN_WIRE = 0x6600aa`

### New Implementation

**Technique**: Ring of low-poly terrain using `BufferGeometry` with randomized vertex heights. Solid dark fill mesh + glowing wireframe via `EdgesGeometry`.

```js
// environment.js

export function createMountainRing(scene) {
  const RING_RADIUS = 80;
  const RING_SEGMENTS = 64;   // Around the circle
  const HEIGHT_ROWS = 5;      // Vertical resolution
  const MAX_HEIGHT = 25;
  const MIN_HEIGHT = 8;

  const positions = [];
  const indices = [];

  for (let row = 0; row <= HEIGHT_ROWS; row++) {
    const y = row / HEIGHT_ROWS;
    for (let seg = 0; seg <= RING_SEGMENTS; seg++) {
      const angle = (seg / RING_SEGMENTS) * Math.PI * 2;
      const x = Math.cos(angle) * RING_RADIUS;
      const z = Math.sin(angle) * RING_RADIUS;

      let height = 0;
      if (row > 0) {
        // Layered sine waves for organic peaks
        const noise1 = Math.sin(angle * 3.7 + 1.2) * 0.4;
        const noise2 = Math.sin(angle * 7.3 + 4.5) * 0.2;
        const noise3 = Math.sin(angle * 13.1 + 2.8) * 0.1;
        const peakFactor = Math.sin(y * Math.PI); // Peak in middle rows
        height = (MIN_HEIGHT + (MAX_HEIGHT - MIN_HEIGHT) * (noise1 + noise2 + noise3 + 0.7)) * peakFactor;
      }
      positions.push(x, height, z);
    }
  }

  // Triangle indices
  for (let row = 0; row < HEIGHT_ROWS; row++) {
    for (let seg = 0; seg < RING_SEGMENTS; seg++) {
      const a = row * (RING_SEGMENTS + 1) + seg;
      const b = a + RING_SEGMENTS + 1;
      indices.push(a, b, a + 1, b, b + 1, a + 1);
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setIndex(indices);

  // Solid dark fill
  const fillMat = new THREE.MeshBasicMaterial({ color: 0x0a0020, side: THREE.DoubleSide });
  const fillMesh = new THREE.Mesh(geometry, fillMat);
  fillMesh.renderOrder = -5;
  scene.add(fillMesh);

  // Glowing cyan wireframe
  const edges = new THREE.EdgesGeometry(geometry, 15);
  const wireMat = new THREE.LineBasicMaterial({
    color: 0x00ffff,
    transparent: true,
    opacity: 0.6,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  const wireframe = new THREE.LineSegments(edges, wireMat);
  wireframe.renderOrder = -4;
  scene.add(wireframe);

  return { fillMesh, wireframe, wireMat, fillMat };
}
```

**Performance**: ~320 triangles, computed once. **2 draw calls** total (fill + wireframe). EdgesGeometry computed at init = zero runtime cost.

---

## 5. Sun Glow Enhancement

### Changes to `createSun()`

**1. Brighter gradient** — update canvas color stops:
```js
sunGrad.addColorStop(0, '#ffff88');    // Bright yellow (was #ffdd33)
sunGrad.addColorStop(0.3, '#ffdd33');
sunGrad.addColorStop(0.5, '#ffaa00');
sunGrad.addColorStop(0.7, '#ff6600');
sunGrad.addColorStop(1.0, '#ff3300');
```

**2. Layered glow rings** — add after existing glow:
```js
const extraGlows = [
  { radius: 28, opacity: 0.2, color: 0xff8800 },
  { radius: 36, opacity: 0.08, color: 0xff6600 },
];
extraGlows.forEach(({ radius, opacity, color }) => {
  const mat = new THREE.MeshBasicMaterial({
    color, side: THREE.DoubleSide, transparent: true, opacity,
    blending: THREE.AdditiveBlending, depthWrite: false,
  });
  const mesh = new THREE.Mesh(new THREE.CircleGeometry(radius, 32), mat);
  mesh.position.set(0, 12, -89.8);
  mesh.renderOrder = -12;
  scene.add(mesh);
});
```

**3. Pulse animation** (in render loop):
```js
if (sunGlowRef) {
  sunGlowRef.material.opacity = 0.3 + Math.sin(now * 0.001) * 0.05;
}
```

**Performance**: +2 draw calls, zero shader cost.

---

## 6. Scrolling Pink Grid Floor

### Replace static `GridHelper` with animated texture

```js
// environment.js

export function createScrollingGrid(scene) {
  // Canvas grid texture
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#000000';
  ctx.fillRect(0, 0, 256, 256);

  ctx.strokeStyle = '#ff00ff';
  ctx.lineWidth = 2;
  const cellSize = 256 / 16;
  for (let i = 0; i <= 16; i++) {
    const pos = i * cellSize;
    ctx.beginPath(); ctx.moveTo(pos, 0); ctx.lineTo(pos, 256); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(0, pos); ctx.lineTo(256, pos); ctx.stroke();
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(8, 8);

  const material = new THREE.MeshBasicMaterial({
    map: texture, transparent: true, opacity: 0.85,
    blending: THREE.AdditiveBlending, depthWrite: false,
  });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(200, 200), material);
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.y = 0.01;
  scene.add(mesh);

  return { mesh, texture, material };
}

// Called every frame during gameplay:
export function updateScrollingGrid(gridData, dt, isPlaying) {
  if (!isPlaying) return;
  gridData.texture.offset.y += dt * 0.5; // Tune speed here
}
```

**Performance**: Replaces `GridHelper` (2 draw calls for LineSegments) with 1 textured plane. UV offset animation is GPU-free.

---

## 7. Death Physics & Voxel Explosions

### New system in `vfx.js`

**Key design**: Pool of 200 small cubes (InstancedMesh for 1 draw call). On enemy death → position cubes at enemy location, apply outward velocity + gravity. On ground contact → spawn spark sprites + shrink/color-shift to burn up.

```js
// vfx.js

const VOXEL_POOL_SIZE = 200;
const SPARK_POOL_SIZE = 100;
const GRAVITY = -9.8;

const sharedVoxelGeo = new THREE.BoxGeometry(0.25, 0.25, 0.25);
let voxelPool = [];
let sparkPool = [];
let activeVoxels = [];
let activeSparks = [];

export function initVFX(scene) {
  // Voxel pool
  for (let i = 0; i < VOXEL_POOL_SIZE; i++) {
    const mat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    const mesh = new THREE.Mesh(sharedVoxelGeo, mat);
    mesh.visible = false;
    scene.add(mesh);
    voxelPool.push({
      mesh, velocity: new THREE.Vector3(), angularVel: new THREE.Vector3(),
      life: 0, maxLife: 0, grounded: false, groundTimer: 0,
    });
  }

  // Spark sprite pool
  const sparkCanvas = document.createElement('canvas');
  sparkCanvas.width = 8; sparkCanvas.height = 8;
  const sCtx = sparkCanvas.getContext('2d');
  sCtx.fillStyle = '#ffaa44';
  sCtx.beginPath(); sCtx.arc(4, 4, 4, 0, Math.PI * 2); sCtx.fill();
  const sparkTex = new THREE.CanvasTexture(sparkCanvas);

  for (let i = 0; i < SPARK_POOL_SIZE; i++) {
    const mat = new THREE.SpriteMaterial({
      map: sparkTex, transparent: true, opacity: 1,
      blending: THREE.AdditiveBlending, depthWrite: false,
    });
    const sprite = new THREE.Sprite(mat);
    sprite.visible = false;
    sprite.scale.set(0.05, 0.05, 1);
    scene.add(sprite);
    sparkPool.push({ sprite, velocity: new THREE.Vector3(), life: 0, maxLife: 0 });
  }
}

export function spawnVoxelExplosion(center, color, voxelCount = 6) {
  for (let i = 0; i < voxelCount; i++) {
    const v = voxelPool.find(v => !v.mesh.visible);
    if (!v) break;

    v.mesh.visible = true;
    v.mesh.material.color.setHex(color);
    v.mesh.position.copy(center);
    v.mesh.position.x += (Math.random() - 0.5) * 0.5;
    v.mesh.position.y += (Math.random() - 0.5) * 0.5;
    v.mesh.position.z += (Math.random() - 0.5) * 0.5;
    v.mesh.scale.setScalar(1);

    v.velocity.set(
      (Math.random() - 0.5) * 6,
      Math.random() * 4 + 2,
      (Math.random() - 0.5) * 6,
    );
    v.angularVel.set(
      (Math.random() - 0.5) * 10,
      (Math.random() - 0.5) * 10,
      (Math.random() - 0.5) * 10,
    );
    v.life = 0;
    v.maxLife = 2.0 + Math.random();
    v.grounded = false;
    v.groundTimer = 0;
    activeVoxels.push(v);
  }
}

export function updateVFX(dt) {
  // Voxels
  for (let i = activeVoxels.length - 1; i >= 0; i--) {
    const v = activeVoxels[i];
    v.life += dt;
    if (v.life > v.maxLife) {
      v.mesh.visible = false;
      v.mesh.scale.setScalar(1);
      activeVoxels.splice(i, 1);
      continue;
    }
    if (!v.grounded) {
      v.velocity.y += GRAVITY * dt;
      v.mesh.position.addScaledVector(v.velocity, dt);
      v.mesh.rotation.x += v.angularVel.x * dt;
      v.mesh.rotation.y += v.angularVel.y * dt;
      v.mesh.rotation.z += v.angularVel.z * dt;
      if (v.mesh.position.y <= 0.1) {
        v.mesh.position.y = 0.1;
        v.grounded = true;
        v.groundTimer = 0;
        spawnSparks(v.mesh.position, 3);
      }
    } else {
      v.groundTimer += dt;
      const burnT = v.groundTimer / 0.8;
      v.mesh.scale.setScalar(Math.max(0, 1 - burnT));
      // Shift to orange/red
      v.mesh.material.color.lerp(new THREE.Color(0xff4400), dt * 3);
      if (Math.random() < dt * 5) spawnSparks(v.mesh.position, 1);
      if (burnT >= 1) {
        v.mesh.visible = false;
        v.mesh.scale.setScalar(1);
        activeVoxels.splice(i, 1);
      }
    }
  }

  // Sparks
  for (let i = activeSparks.length - 1; i >= 0; i--) {
    const s = activeSparks[i];
    s.life += dt;
    if (s.life > s.maxLife) {
      s.sprite.visible = false;
      activeSparks.splice(i, 1);
      continue;
    }
    s.sprite.position.addScaledVector(s.velocity, dt);
    s.velocity.y += GRAVITY * 0.5 * dt;
    const t = s.life / s.maxLife;
    s.sprite.material.opacity = 1 - t;
    s.sprite.scale.setScalar(0.05 * (1 - t * 0.5));
  }
}

function spawnSparks(position, count) {
  for (let i = 0; i < count; i++) {
    const s = sparkPool.find(s => !s.sprite.visible);
    if (!s) break;
    s.sprite.visible = true;
    s.sprite.position.copy(position);
    s.sprite.material.opacity = 1;
    s.velocity.set((Math.random()-0.5)*3, Math.random()*3+1, (Math.random()-0.5)*3);
    s.life = 0;
    s.maxLife = 0.3 + Math.random() * 0.3;
    activeSparks.push(s);
  }
}
```

### Integration with enemies.js
```js
// In destroyEnemy(), after existing explosion:
import { spawnVoxelExplosion } from './vfx.js';

const voxelCount = enemy.type === 'tank' ? 10 : enemy.type === 'basic' ? 6 : 4;
spawnVoxelExplosion(enemy.mesh.position, enemy.def.color, voxelCount);
```

**Performance**: 200 pooled cubes sharing 1 geometry. Peak ~30-50 visible = acceptable. For further optimization, use `InstancedMesh` to batch all voxels into 1 draw call.

---

## 8. Weapon Projectiles

### New projectile visuals per weapon type

Replace the current simple cylinders/spheres with multi-part glowing bolts:

#### Standard Blaster → Plasma Bolt
```js
function createPlasmaBolt(color) {
  const group = new THREE.Group();
  // White core
  const core = new THREE.Mesh(
    new THREE.CylinderGeometry(0.02, 0.01, 0.8, 6),
    new THREE.MeshBasicMaterial({ color: 0xffffff }),
  );
  core.rotation.x = Math.PI / 2;
  core.position.z = -0.4;
  group.add(core);

  // Colored glow envelope
  const glow = new THREE.Mesh(
    new THREE.CylinderGeometry(0.06, 0.02, 1.0, 6),
    new THREE.MeshBasicMaterial({
      color, transparent: true, opacity: 0.3,
      blending: THREE.AdditiveBlending, depthWrite: false,
    }),
  );
  glow.rotation.x = Math.PI / 2;
  glow.position.z = -0.5;
  group.add(glow);

  // Front tip
  const tip = new THREE.Mesh(
    new THREE.SphereGeometry(0.04, 8, 8),
    new THREE.MeshBasicMaterial({
      color, transparent: true, opacity: 0.5,
      blending: THREE.AdditiveBlending, depthWrite: false,
    }),
  );
  tip.position.z = -0.05;
  group.add(tip);

  return group;
}
```

#### Buckshot → Glowing Pellets
```js
function createGlowPellet() {
  const group = new THREE.Group();
  group.add(new THREE.Mesh(
    new THREE.SphereGeometry(0.03, 6, 6),
    new THREE.MeshBasicMaterial({ color: 0xffcc88 }),
  ));
  group.add(new THREE.Mesh(
    new THREE.SphereGeometry(0.06, 6, 6),
    new THREE.MeshBasicMaterial({
      color: 0xff8844, transparent: true, opacity: 0.25,
      blending: THREE.AdditiveBlending, depthWrite: false,
    }),
  ));
  return group;
}
```

#### Charge Shot Enhancement
Add ring shockwave on release:
```js
function spawnChargeShockwave(position, direction, progress) {
  const ring = new THREE.Mesh(
    new THREE.TorusGeometry(0.3, 0.05, 8, 24),
    new THREE.MeshBasicMaterial({
      color: 0x00ffff, transparent: true, opacity: 0.6,
      blending: THREE.AdditiveBlending, depthWrite: false,
    }),
  );
  ring.position.copy(position);
  ring.lookAt(position.clone().add(direction));
  ring.userData = { life: 0, maxLife: 0.3, expandRate: 8 + progress * 12 };
  scene.add(ring);
  // Expand + fade in render loop, remove when life > maxLife
}
```

#### Lightning — enhance existing
Add brighter white core line behind yellow, occasional fork branches.

**Performance**: 3-4 meshes per projectile × ~15 visible = 45-60 draw calls. **Pool projectile groups** instead of creating/destroying them.

---

## 9. Weapon Models

### Procedural low-poly models per weapon type

```js
// weapon-models.js

export function createWeaponModel(weaponId) {
  switch (weaponId) {
    case 'buckshot': return createShotgunModel();
    case 'lightning': return createLightningRodModel();
    case 'charge_shot': return createChargeCannonModel();
    default: return createBlasterModel();
  }
}

function createBlasterModel() {
  const g = new THREE.Group();
  // Barrel (cylinder)
  const barrel = new THREE.Mesh(
    new THREE.CylinderGeometry(0.015, 0.02, 0.25, 8),
    new THREE.MeshBasicMaterial({ color: 0x444466 }),
  );
  barrel.rotation.x = Math.PI / 2;
  barrel.position.z = -0.15;
  g.add(barrel);

  // Body (box)
  const body = new THREE.Mesh(
    new THREE.BoxGeometry(0.04, 0.035, 0.12),
    new THREE.MeshBasicMaterial({ color: 0x333355 }),
  );
  body.position.z = -0.02;
  g.add(body);

  // Muzzle glow
  const muzzle = new THREE.Mesh(
    new THREE.SphereGeometry(0.018, 8, 8),
    new THREE.MeshBasicMaterial({
      color: 0x00ffff, transparent: true, opacity: 0.5,
      blending: THREE.AdditiveBlending,
    }),
  );
  muzzle.position.z = -0.28;
  g.add(muzzle);

  // Edge glow on body
  const edges = new THREE.LineSegments(
    new THREE.EdgesGeometry(body.geometry),
    new THREE.LineBasicMaterial({ color: 0x00ffff, transparent: true, opacity: 0.4 }),
  );
  edges.position.copy(body.position);
  g.add(edges);

  return g;
}

function createShotgunModel() {
  const g = new THREE.Group();
  // Double barrel
  [-0.015, 0.015].forEach(x => {
    const b = new THREE.Mesh(
      new THREE.CylinderGeometry(0.012, 0.015, 0.22, 6),
      new THREE.MeshBasicMaterial({ color: 0x555544 }),
    );
    b.rotation.x = Math.PI / 2;
    b.position.set(x, 0, -0.14);
    g.add(b);
  });
  // Body
  g.add(Object.assign(new THREE.Mesh(
    new THREE.BoxGeometry(0.06, 0.04, 0.1),
    new THREE.MeshBasicMaterial({ color: 0x554433 }),
  )));
  // Orange accent strip
  const accent = new THREE.Mesh(
    new THREE.BoxGeometry(0.062, 0.005, 0.08),
    new THREE.MeshBasicMaterial({ color: 0xff8800, transparent: true, opacity: 0.6 }),
  );
  accent.position.y = 0.022;
  g.add(accent);
  return g;
}

function createLightningRodModel() {
  const g = new THREE.Group();
  const rod = new THREE.Mesh(
    new THREE.CylinderGeometry(0.008, 0.012, 0.3, 6),
    new THREE.MeshBasicMaterial({ color: 0x666688 }),
  );
  rod.rotation.x = Math.PI / 2;
  rod.position.z = -0.18;
  g.add(rod);
  // Tesla coil ring
  const coil = new THREE.Mesh(
    new THREE.TorusGeometry(0.03, 0.005, 6, 12),
    new THREE.MeshBasicMaterial({
      color: 0xff00ff, transparent: true, opacity: 0.6,
      blending: THREE.AdditiveBlending,
    }),
  );
  coil.position.z = -0.25;
  g.add(coil);
  // Spark tip
  const tip = new THREE.Mesh(
    new THREE.SphereGeometry(0.015, 8, 8),
    new THREE.MeshBasicMaterial({
      color: 0xffff44, transparent: true, opacity: 0.7,
      blending: THREE.AdditiveBlending,
    }),
  );
  tip.position.z = -0.33;
  tip.name = 'sparkTip';
  g.add(tip);
  return g;
}

function createChargeCannonModel() {
  const g = new THREE.Group();
  // Wide barrel
  const barrel = new THREE.Mesh(
    new THREE.CylinderGeometry(0.025, 0.035, 0.2, 8),
    new THREE.MeshBasicMaterial({ color: 0x553333 }),
  );
  barrel.rotation.x = Math.PI / 2;
  barrel.position.z = -0.12;
  g.add(barrel);
  // Energy chamber ring
  const chamber = new THREE.Mesh(
    new THREE.TorusGeometry(0.04, 0.008, 8, 16),
    new THREE.MeshBasicMaterial({
      color: 0xff4444, transparent: true, opacity: 0.4,
      blending: THREE.AdditiveBlending,
    }),
  );
  chamber.position.z = -0.04;
  g.add(chamber);
  // Chunky body
  g.add(Object.assign(new THREE.Mesh(
    new THREE.BoxGeometry(0.06, 0.05, 0.1),
    new THREE.MeshBasicMaterial({ color: 0x442222 }),
  ), { position: new THREE.Vector3(0, 0, 0.02) }));
  return g;
}
```

### Integration
```js
// In main.js, when weapon changes (upgrade selection):
import { createWeaponModel } from './weapon-models.js';

function updateControllerWeapon(controllerIndex, weaponId) {
  const controller = controllers[controllerIndex];
  const old = controller.getObjectByName('weaponModel');
  if (old) controller.remove(old);
  const model = createWeaponModel(weaponId);
  model.name = 'weaponModel';
  controller.add(model);
}
```

**Performance**: 3-5 meshes per weapon × 2 hands = 6-10 draw calls (replacing current ~6).

---

## 10. Level-Based Scenery Changes

### Theme System — `scenery.js`

```js
export const THEMES = {
  // Levels 1-4: Classic Synthwave (default)
  synthwave: {
    skyColor: 0x000000,
    fogColor: 0x000000,
    fogDensity: 0.012,
    gridColor: '#ff00ff',
    gridOpacity: 0.85,
    mountainFill: 0x0a0020,
    mountainWire: 0x00ffff,
    mountainWireOpacity: 0.6,
    sunColors: ['#ffff88', '#ffdd33', '#ffaa00', '#ff6600', '#ff3300'],
    sunGlowColor: 0xff6600,
    starColor: 0xffffff,
    particles: null,
  },

  // Levels 6-9: Neon Hellscape
  hellscape: {
    skyColor: 0x0a0000,
    fogColor: 0x1a0000,
    fogDensity: 0.015,
    gridColor: '#ff4400',
    gridOpacity: 0.9,
    mountainFill: 0x1a0000,
    mountainWire: 0xff4400,
    mountainWireOpacity: 0.8,
    sunColors: ['#ff0000', '#ff4400', '#ff0000', '#880000', '#440000'],
    sunGlowColor: 0xff2200,
    starColor: 0xff4444,
    particles: { type: 'embers', color: 0xff4400, count: 30, speed: 0.5 },
  },

  // Levels 11-14: Frozen Digital
  frozen: {
    skyColor: 0x000a15,
    fogColor: 0x001122,
    fogDensity: 0.01,
    gridColor: '#0088ff',
    gridOpacity: 0.7,
    mountainFill: 0x001133,
    mountainWire: 0x44aaff,
    mountainWireOpacity: 0.7,
    sunColors: ['#aaddff', '#88bbff', '#4488ff', '#2255aa', '#112244'],
    sunGlowColor: 0x4488ff,
    starColor: 0x88ccff,
    particles: { type: 'snow', color: 0xccddff, count: 50, speed: 0.3 },
  },

  // Levels 16-19: Void Corruption
  corruption: {
    skyColor: 0x050005,
    fogColor: 0x0a000a,
    fogDensity: 0.018,
    gridColor: '#aa00ff',
    gridOpacity: 0.6,
    mountainFill: 0x0a000a,
    mountainWire: 0xaa00ff,
    mountainWireOpacity: 0.9,
    sunColors: ['#ff00ff', '#aa00ff', '#6600cc', '#330066', '#110033'],
    sunGlowColor: 0xaa00ff,
    starColor: 0xcc88ff,
    particles: { type: 'corruption', color: 0xaa00ff, count: 40, speed: 0.8 },
  },

  // Boss levels (5, 10, 15, 20): Red Alert
  boss: {
    skyColor: 0x0a0000,
    fogColor: 0x1a0000,
    fogDensity: 0.02,
    gridColor: '#ff0000',
    gridOpacity: 1.0,
    mountainFill: 0x1a0000,
    mountainWire: 0xff0000,
    mountainWireOpacity: 1.0,
    sunColors: ['#ff0000', '#ff0000', '#aa0000', '#660000', '#330000'],
    sunGlowColor: 0xff0000,
    starColor: 0xff2222,
    particles: { type: 'danger', color: 0xff0000, count: 60, speed: 1.0 },
  },
};

export function getThemeForLevel(level) {
  if (level % 5 === 0) return THEMES.boss;
  if (level <= 4) return THEMES.synthwave;
  if (level <= 9) return THEMES.hellscape;
  if (level <= 14) return THEMES.frozen;
  return THEMES.corruption;
}

export function applyTheme(theme, refs) {
  const { scene, gridData, mountainRefs, sunRefs } = refs;

  scene.background.setHex(theme.skyColor);
  scene.fog.color.setHex(theme.fogColor);
  scene.fog.density = theme.fogDensity;

  if (gridData) {
    regenerateGridTexture(gridData, theme.gridColor);
    gridData.material.opacity = theme.gridOpacity;
  }

  if (mountainRefs) {
    mountainRefs.fillMat.color.setHex(theme.mountainFill);
    mountainRefs.wireMat.color.setHex(theme.mountainWire);
    mountainRefs.wireMat.opacity = theme.mountainWireOpacity;
  }

  if (sunRefs) {
    regenerateSunTexture(sunRefs.mesh, theme.sunColors);
    sunRefs.glowMesh.material.color.setHex(theme.sunGlowColor);
  }
}

function regenerateGridTexture(gridData, colorStr) {
  const canvas = gridData.texture.image;
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, 256, 256);
  ctx.fillStyle = '#000000';
  ctx.fillRect(0, 0, 256, 256);
  ctx.strokeStyle = colorStr;
  ctx.lineWidth = 2;
  const s = 256 / 16;
  for (let i = 0; i <= 16; i++) {
    ctx.beginPath(); ctx.moveTo(i*s, 0); ctx.lineTo(i*s, 256); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(0, i*s); ctx.lineTo(256, i*s); ctx.stroke();
  }
  gridData.texture.needsUpdate = true;
}

function regenerateSunTexture(sunMesh, colorStops) {
  const canvas = sunMesh.material.map.image;
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, 512, 512);
  const grad = ctx.createLinearGradient(256, 30, 256, 482);
  colorStops.forEach((c, i) => grad.addColorStop(i / (colorStops.length - 1), c));
  ctx.beginPath(); ctx.arc(256, 256, 248, 0, Math.PI * 2); ctx.fillStyle = grad; ctx.fill();
  // Re-cut bands
  ctx.globalCompositeOperation = 'destination-out';
  [{ y:.9, h:.065 },{ y:.82, h:.05 },{ y:.75, h:.038 },{ y:.69, h:.028 },
   { y:.64, h:.02 },{ y:.6, h:.013 },{ y:.57, h:.008 },{ y:.54, h:.004 }]
    .forEach(b => { ctx.fillStyle='black'; ctx.fillRect(0,b.y*512-b.h*256,512,b.h*512); });
  ctx.globalCompositeOperation = 'source-over';
  sunMesh.material.map.needsUpdate = true;
}
```

### Ambient Particle System

```js
const AMBIENT_POOL = 60;
let ambientParticles = null;

export function initAmbientParticles(scene) {
  const positions = new Float32Array(AMBIENT_POOL * 3);
  for (let i = 0; i < AMBIENT_POOL; i++) {
    positions[i*3] = (Math.random()-0.5)*40;
    positions[i*3+1] = Math.random()*15+1;
    positions[i*3+2] = (Math.random()-0.5)*40;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  const mat = new THREE.PointsMaterial({
    color: 0xffffff, size: 0.15, transparent: true, opacity: 0.6,
    blending: THREE.AdditiveBlending, depthWrite: false,
  });
  const points = new THREE.Points(geo, mat);
  scene.add(points);
  ambientParticles = { points, geo, mat, positions };
}

export function updateAmbientParticles(dt, theme, playerPos) {
  if (!ambientParticles || !theme.particles) {
    if (ambientParticles) ambientParticles.points.visible = false;
    return;
  }
  ambientParticles.points.visible = true;
  ambientParticles.mat.color.setHex(theme.particles.color);

  const pos = ambientParticles.positions;
  const speed = theme.particles.speed;
  const now = performance.now();

  for (let i = 0; i < AMBIENT_POOL; i++) {
    const i3 = i * 3;
    switch (theme.particles.type) {
      case 'embers':
        pos[i3+1] += speed * dt;
        pos[i3] += Math.sin(now*0.001+i)*0.01;
        break;
      case 'snow':
        pos[i3+1] -= speed * dt;
        pos[i3] += Math.sin(now*0.0005+i)*0.02;
        break;
      case 'corruption': case 'danger':
        const a = now*0.0003+(i/AMBIENT_POOL)*Math.PI*2;
        pos[i3] += Math.cos(a)*speed*dt*0.5;
        pos[i3+2] += Math.sin(a)*speed*dt*0.5;
        break;
    }
    // Reset out-of-range
    const dx=pos[i3]-playerPos.x, dz=pos[i3+2]-playerPos.z;
    if (pos[i3+1]>20 || pos[i3+1]<-1 || dx*dx+dz*dz>900) {
      pos[i3] = playerPos.x+(Math.random()-0.5)*40;
      pos[i3+1] = theme.particles.type==='snow' ? 15 : Math.random()*2;
      pos[i3+2] = playerPos.z+(Math.random()-0.5)*40;
    }
  }
  ambientParticles.geo.attributes.position.needsUpdate = true;
}
```

### Integration Points in main.js
```js
// At level start (startGame, advanceLevelAfterUpgrade):
const theme = getThemeForLevel(game.level);
applyTheme(theme, { scene, gridData, mountainRefs, sunRefs });
game.currentTheme = theme;

// In render() during PLAYING:
updateAmbientParticles(dt, game.currentTheme, camera.position);
```

**Performance**: Theme switch = ~5 texture updates (one frame). Ambient particles = 1 draw call (Points with 60 vertices).

---

## 11. Performance Budget

### Draw Call Estimate (worst case, heavy combat)

| Component | Current | After Overhaul |
|-----------|---------|---------------|
| Grid floor | 2 | 1 (textured plane) |
| Mountains | 4 | 2 (ring fill + wireframe) |
| Sun + glow | 3 | 5 (+2 glow layers) |
| Stars | 1 | 1 |
| Atmosphere + horizon | 5 | 5 |
| Controllers + weapons | 6 | 10 (weapon models) |
| Enemies (merged geo) | ~15 | ~15 |
| Projectiles | ~15 | ~30 (glow layers) |
| Explosion voxels (pooled) | 0 | ~30 (or 1 with InstancedMesh) |
| Sparks (sprites) | 0 | ~10 |
| Ambient particles | 0 | 1 |
| HUD | ~20 | ~20 |
| Lightning pool | ~5 | ~5 |
| Existing explosions | ~10 | ~10 |
| **TOTAL** | **~86** | **~145** |

**145 draw calls** — well within Quest budget (problems start at 300+).

With InstancedMesh for voxels: **~116 draw calls**.

### Memory Delta
- Voxel pool: 200 × shared geo = ~50KB
- Spark pool: 100 sprites = ~20KB
- Grid texture: 256×256 = ~260KB
- Weapon models: ~5KB each
- **Total new: ~400KB** — negligible

### Frame Time (Quest 2, 72Hz = 13.8ms/frame)
- Current estimate: ~8ms
- After overhaul: ~10-11ms
- **Headroom: ~3ms** ✅

---

## 12. Task Breakdown

| # | Task | Files | Complexity | Depends On |
|---|------|-------|------------|------------|
| 1 | Create `environment.js`, extract env code from main.js | environment.js, main.js | Medium | — |
| 2 | Scrolling grid floor | environment.js, main.js | Junior | Task 1 |
| 3 | Wireframe mountain ring (valley) | environment.js | Medium | Task 1 |
| 4 | Sun glow enhancement | environment.js | Junior | Task 1 |
| 5 | Create `vfx.js` — voxel death explosions + sparks | vfx.js, enemies.js, main.js | Senior | — |
| 6 | Enhanced weapon projectiles | main.js (spawnProjectile) | Medium | — |
| 7 | Create `weapon-models.js` | weapon-models.js, main.js | Medium | — |
| 8 | Create `scenery.js` — theme system + ambient particles | scenery.js, main.js, game.js | Senior | Tasks 1-4 |
| 9 | Integration, wiring, VR testing | main.js | Medium | All above |

### Recommended Implementation Sequence
1. **Tasks 1-4** (environment refactor + visuals) — independent, high visual impact
2. **Task 5** (death physics) — most complex, biggest "feel" improvement
3. **Tasks 6-7** (projectiles + weapons) — combat polish
4. **Task 8** (scenery themes) — ties everything together
5. **Task 9** (integration pass) — final wiring + perf testing

Each task should be a separate issue/PR to keep changes reviewable and testable.
