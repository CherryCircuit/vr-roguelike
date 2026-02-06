// ============================================================
//  SYNTHWAVE VR BLASTER — Minimum Viable Demo
//  A WebXR shooter with neon aesthetics, dual controllers,
//  laser beams, and a destructible test enemy.
// ============================================================

import * as THREE from 'three';
import { VRButton } from 'three/addons/webxr/VRButton.js';

// ── Colour Constants ───────────────────────────────────────
const NEON_PINK  = 0xff00ff;
const NEON_CYAN  = 0x00ffff;
const DARK_BG    = 0x0a0015;   // deep purple-black
const SUN_CORE   = 0xffaa00;
const SUN_GLOW   = 0xff6600;
const MTN_DARK   = 0x1a0033;
const MTN_WIRE   = 0x6600aa;

// ── Gameplay Constants ─────────────────────────────────────
const LASER_RANGE    = 50;
const LASER_DURATION = 250;   // ms before laser fades

// ── State ──────────────────────────────────────────────────
let scene, camera, renderer;
const controllers = [];
let enemy = null;
const lasers = [];
const explosionParticles = [];
let lastTime = 0;

// ── Bootstrap ──────────────────────────────────────────────
init();

// ============================================================
//  INITIALISATION
// ============================================================
function init() {
  // --- Scene ---
  scene = new THREE.Scene();
  scene.background = new THREE.Color(DARK_BG);
  scene.fog = new THREE.FogExp2(DARK_BG, 0.012);

  // --- Camera (standing height; overridden by headset in VR) ---
  camera = new THREE.PerspectiveCamera(
    70, window.innerWidth / window.innerHeight, 0.1, 1000
  );
  camera.position.set(0, 1.6, 0);

  // --- Renderer ---
  renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(window.devicePixelRatio);
  renderer.xr.enabled = true;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.5;
  document.body.appendChild(renderer.domElement);

  // --- VR Button ---
  // VRButton handles WebXR session creation and shows fallback text
  // if the browser doesn't support immersive VR.
  const vrButton = VRButton.createButton(renderer);
  document.body.appendChild(vrButton);

  // Extra fallback: show our styled message when WebXR is absent
  if (!navigator.xr) {
    document.getElementById('no-vr').style.display = 'block';
    console.warn('WebXR not supported on this browser');
  } else {
    navigator.xr.isSessionSupported('immersive-vr').then((supported) => {
      if (!supported) {
        document.getElementById('no-vr').style.display = 'block';
        console.warn('immersive-vr session not supported');
      }
    });
  }

  // --- Build the world ---
  createEnvironment();
  setupControllers();
  spawnEnemy();

  // --- Listeners ---
  window.addEventListener('resize', onWindowResize);

  // --- Render loop (WebXR-compatible) ---
  renderer.setAnimationLoop(render);

  console.log('[init] Synthwave VR Blaster ready');
  console.log('[init] Controls: pull either trigger to shoot');
}

// ============================================================
//  ENVIRONMENT
// ============================================================
function createEnvironment() {
  // ── Grid Floor ──
  // Neon magenta grid à la the synthwave concept art
  const grid = new THREE.GridHelper(200, 80, NEON_PINK, 0x660044);
  if (Array.isArray(grid.material)) {
    grid.material.forEach((m) => { m.transparent = true; m.opacity = 0.6; });
  } else {
    grid.material.transparent = true;
    grid.material.opacity = 0.6;
  }
  scene.add(grid);

  // Dark plane underneath to prevent seeing through the floor
  const floorGeo = new THREE.PlaneGeometry(200, 200);
  const floorMat = new THREE.MeshBasicMaterial({ color: 0x110022, side: THREE.DoubleSide });
  const floor = new THREE.Mesh(floorGeo, floorMat);
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = -0.01;
  scene.add(floor);

  // ── Synthwave Sun ──
  createSun();

  // ── Mountain Silhouettes ──
  createMountains();

  // ── Stars ──
  createStars();

  // ── Lighting ──
  scene.add(new THREE.AmbientLight(0x330066, 0.4));

  const pinkLight = new THREE.PointLight(NEON_PINK, 1.5, 30);
  pinkLight.position.set(-6, 4, -6);
  scene.add(pinkLight);

  const cyanLight = new THREE.PointLight(NEON_CYAN, 1.5, 30);
  cyanLight.position.set(6, 4, -6);
  scene.add(cyanLight);
}

// ── Sun ────────────────────────────────────────────────────
function createSun() {
  // Bright core
  const coreMat = new THREE.MeshBasicMaterial({ color: SUN_CORE, side: THREE.DoubleSide });
  const core = new THREE.Mesh(new THREE.CircleGeometry(14, 64), coreMat);
  core.position.set(0, 10, -90);
  scene.add(core);

  // Outer glow ring
  const glowMat = new THREE.MeshBasicMaterial({
    color: SUN_GLOW, side: THREE.DoubleSide, transparent: true, opacity: 0.3,
  });
  const glow = new THREE.Mesh(new THREE.CircleGeometry(20, 64), glowMat);
  glow.position.set(0, 10, -90.5);
  scene.add(glow);

  // Horizontal stripe lines across the sun (retro look)
  const stripeMat = new THREE.LineBasicMaterial({ color: DARK_BG });
  for (let y = -10; y <= 0; y += 2) {
    const points = [
      new THREE.Vector3(-15, 10 + y, -89.9),
      new THREE.Vector3(15, 10 + y, -89.9),
    ];
    const stripe = new THREE.Line(
      new THREE.BufferGeometry().setFromPoints(points), stripeMat
    );
    scene.add(stripe);
  }
}

// ── Mountains ──────────────────────────────────────────────
function createMountains() {
  // Two layers of low-poly mountain silhouettes on the horizon
  const layers = [
    { z: -85, color: 0x0d001a, peaks: generatePeaks(12, 6, 20) },
    { z: -75, color: MTN_DARK,  peaks: generatePeaks(10, 4, 14) },
  ];

  layers.forEach(({ z, color, peaks }) => {
    // Solid fill silhouette
    const shape = new THREE.Shape();
    shape.moveTo(-100, 0);
    peaks.forEach(([x, y]) => shape.lineTo(x, y));
    shape.lineTo(100, 0);
    shape.closePath();

    const fillMesh = new THREE.Mesh(
      new THREE.ShapeGeometry(shape),
      new THREE.MeshBasicMaterial({ color, side: THREE.DoubleSide })
    );
    fillMesh.position.set(0, 0, z);
    scene.add(fillMesh);

    // Wireframe top edge
    const edgePoints = [new THREE.Vector3(-100, 0, z)];
    peaks.forEach(([x, y]) => edgePoints.push(new THREE.Vector3(x, y, z)));
    edgePoints.push(new THREE.Vector3(100, 0, z));

    const edgeLine = new THREE.Line(
      new THREE.BufferGeometry().setFromPoints(edgePoints),
      new THREE.LineBasicMaterial({ color: MTN_WIRE, transparent: true, opacity: 0.5 })
    );
    scene.add(edgeLine);
  });
}

/** Generate random jagged mountain peaks spanning -100..100 on X */
function generatePeaks(count, minH, maxH) {
  const peaks = [];
  const step = 200 / (count + 1);
  for (let i = 1; i <= count; i++) {
    const x = -100 + i * step + (Math.random() - 0.5) * step * 0.6;
    const y = minH + Math.random() * (maxH - minH);
    peaks.push([x, y]);
  }
  return peaks;
}

// ── Stars ──────────────────────────────────────────────────
function createStars() {
  const count = 1500;
  const positions = new Float32Array(count * 3);

  for (let i = 0; i < count; i++) {
    const i3 = i * 3;
    positions[i3]     = (Math.random() - 0.5) * 300;  // x
    positions[i3 + 1] = Math.random() * 80 + 10;      // y (above horizon)
    positions[i3 + 2] = (Math.random() - 0.5) * 300;  // z
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));

  const mat = new THREE.PointsMaterial({
    color: 0xffffff, size: 0.3, transparent: true, opacity: 0.7,
  });
  scene.add(new THREE.Points(geo, mat));
}

// ============================================================
//  CONTROLLERS
// ============================================================
function setupControllers() {
  for (let i = 0; i < 2; i++) {
    const controller = renderer.xr.getController(i);

    // ── Events ──
    controller.addEventListener('selectstart', () => onTriggerPress(controller, i));
    controller.addEventListener('selectend',   () => onTriggerRelease(i));
    controller.addEventListener('connected', (e) => {
      console.log(`[controller] ${i} connected — ${e.data.handedness} hand`);
      controller.userData.handedness = e.data.handedness;
    });
    controller.addEventListener('disconnected', () => {
      console.log(`[controller] ${i} disconnected`);
    });

    // ── Visual: glowing neon sphere + aim pointer ──
    controller.add(createControllerVisual(i));
    scene.add(controller);
    controllers.push(controller);
  }
}

/** Build a neon sphere + faint aim line for one controller */
function createControllerVisual(index) {
  const color = index === 0 ? NEON_CYAN : NEON_PINK;
  const group = new THREE.Group();

  // Bright core sphere
  group.add(new THREE.Mesh(
    new THREE.SphereGeometry(0.03, 16, 16),
    new THREE.MeshBasicMaterial({ color })
  ));

  // Soft outer glow
  group.add(new THREE.Mesh(
    new THREE.SphereGeometry(0.055, 16, 16),
    new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.2 })
  ));

  // Aim pointer (short line showing forward direction)
  const aimGeo = new THREE.BufferGeometry().setFromPoints([
    new THREE.Vector3(0, 0, 0),
    new THREE.Vector3(0, 0, -0.4),
  ]);
  group.add(new THREE.Line(
    aimGeo,
    new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.4 })
  ));

  return group;
}

// ============================================================
//  SHOOTING
// ============================================================
function onTriggerPress(controller, index) {
  console.log(`[shoot] trigger pressed — controller ${index}`);
  shootLaser(controller, index);
}

function onTriggerRelease(index) {
  console.log(`[shoot] trigger released — controller ${index}`);
}

function shootLaser(controller, index) {
  // World-space position and forward direction of the controller
  const origin = new THREE.Vector3();
  const quat   = new THREE.Quaternion();
  controller.getWorldPosition(origin);
  controller.getWorldQuaternion(quat);
  const direction = new THREE.Vector3(0, 0, -1).applyQuaternion(quat);

  // Raycast against the enemy
  const raycaster = new THREE.Raycaster(origin, direction, 0, LASER_RANGE);
  let endPoint = origin.clone().add(direction.clone().multiplyScalar(LASER_RANGE));
  let hit = false;

  if (enemy) {
    const intersects = raycaster.intersectObject(enemy, true);
    if (intersects.length > 0) {
      endPoint = intersects[0].point.clone();
      hit = true;
      console.log(`[shoot] HIT enemy at distance ${intersects[0].distance.toFixed(2)}`);
      destroyEnemy();
    }
  }

  if (!hit) {
    console.log('[shoot] miss');
  }

  // Visual laser beam
  createLaserBeam(origin, endPoint, index);
}

// ── Laser Beam Visual ──────────────────────────────────────
function createLaserBeam(start, end, controllerIndex) {
  const color = controllerIndex === 0 ? NEON_CYAN : NEON_PINK;
  const group = new THREE.Group();

  // Core beam (thin tube)
  const path = new THREE.LineCurve3(start.clone(), end.clone());
  const coreGeo = new THREE.TubeGeometry(path, 1, 0.006, 6, false);
  group.add(new THREE.Mesh(
    coreGeo,
    new THREE.MeshBasicMaterial({ color })
  ));

  // Glow beam (wider, semi-transparent tube)
  const glowGeo = new THREE.TubeGeometry(path, 1, 0.025, 6, false);
  group.add(new THREE.Mesh(
    glowGeo,
    new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.15 })
  ));

  // Impact flash at end point
  const flash = new THREE.Mesh(
    new THREE.SphereGeometry(0.06, 8, 8),
    new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.8 })
  );
  flash.position.copy(end);
  group.add(flash);

  group.userData.createdAt = performance.now();
  scene.add(group);
  lasers.push(group);
}

// ============================================================
//  ENEMY
// ============================================================
function spawnEnemy() {
  const group = new THREE.Group();

  // Solid core cube
  group.add(new THREE.Mesh(
    new THREE.BoxGeometry(0.5, 0.5, 0.5),
    new THREE.MeshBasicMaterial({ color: NEON_PINK })
  ));

  // Wireframe overlay (slightly larger for depth)
  group.add(new THREE.Mesh(
    new THREE.BoxGeometry(0.52, 0.52, 0.52),
    new THREE.MeshBasicMaterial({ color: 0xffffff, wireframe: true, transparent: true, opacity: 0.4 })
  ));

  // Outer glow shell
  group.add(new THREE.Mesh(
    new THREE.BoxGeometry(0.62, 0.62, 0.62),
    new THREE.MeshBasicMaterial({ color: NEON_PINK, transparent: true, opacity: 0.12 })
  ));

  // Place in front of the player at eye level
  group.position.set(0, 1.5, -5);
  scene.add(group);
  enemy = group;

  console.log(`[enemy] spawned at (${group.position.x}, ${group.position.y}, ${group.position.z})`);
}

function destroyEnemy() {
  if (!enemy) return;

  const pos = enemy.position.clone();
  scene.remove(enemy);
  enemy = null;

  // Spawn explosion particles
  spawnExplosion(pos);
  console.log('[enemy] destroyed — explosion triggered');
}

// ── Explosion ──────────────────────────────────────────────
function spawnExplosion(position) {
  const count = 24;
  for (let i = 0; i < count; i++) {
    const size = 0.02 + Math.random() * 0.07;
    const color = Math.random() > 0.5 ? NEON_PINK : NEON_CYAN;

    const mesh = new THREE.Mesh(
      new THREE.BoxGeometry(size, size, size),
      new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 1 })
    );
    mesh.position.copy(position);

    // Random outward velocity
    mesh.userData.velocity = new THREE.Vector3(
      (Math.random() - 0.5) * 5,
      (Math.random() - 0.5) * 5,
      (Math.random() - 0.5) * 5,
    );
    mesh.userData.createdAt = performance.now();
    mesh.userData.lifetime  = 800 + Math.random() * 400; // 0.8–1.2 s

    scene.add(mesh);
    explosionParticles.push(mesh);
  }
}

// ============================================================
//  RENDER / UPDATE LOOP
// ============================================================
function render(timestamp) {
  const now = timestamp || performance.now();
  const dt  = Math.min((now - lastTime) / 1000, 0.1); // seconds, capped
  lastTime  = now;

  // ── Animate enemy (gentle hover + rotation) ──
  if (enemy) {
    enemy.rotation.y += 0.8 * dt;
    enemy.rotation.x += 0.4 * dt;
    enemy.position.y  = 1.5 + Math.sin(now * 0.002) * 0.1;
  }

  // ── Fade & remove lasers ──
  for (let i = lasers.length - 1; i >= 0; i--) {
    const laser = lasers[i];
    const age = now - laser.userData.createdAt;

    if (age > LASER_DURATION) {
      scene.remove(laser);
      lasers.splice(i, 1);
    } else {
      const alpha = 1 - age / LASER_DURATION;
      laser.traverse((child) => {
        if (child.material && child.material.transparent !== undefined) {
          child.material.opacity = child.material.userData?.baseOpacity
            ? child.material.userData.baseOpacity * alpha
            : alpha;
        }
      });
    }
  }

  // ── Update explosion particles ──
  for (let i = explosionParticles.length - 1; i >= 0; i--) {
    const p   = explosionParticles[i];
    const age = now - p.userData.createdAt;

    if (age > p.userData.lifetime) {
      scene.remove(p);
      explosionParticles.splice(i, 1);
    } else {
      // Move
      p.position.addScaledVector(p.userData.velocity, dt);
      // Drag
      p.userData.velocity.multiplyScalar(1 - 2.5 * dt);
      // Fade
      p.material.opacity = 1 - age / p.userData.lifetime;
      // Tumble
      p.rotation.x += 3 * dt;
      p.rotation.z += 3 * dt;
    }
  }

  renderer.render(scene, camera);
}

// ============================================================
//  WINDOW RESIZE
// ============================================================
function onWindowResize() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
}
