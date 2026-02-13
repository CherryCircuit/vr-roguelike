// ============================================================
//  SPACEOMICIDE — Main Game Controller
//  Phase 1: Core game loop with levels, enemies, upgrades, HUD
// ============================================================

import * as THREE from 'three';
import { VRButton } from 'three/addons/webxr/VRButton.js';
import Stats from 'three/addons/libs/stats.module.js';

import { State, game, resetGame, getLevelConfig, getBossTier, getRandomBossIdForLevel, addScore, getComboMultiplier, damagePlayer, addUpgrade, LEVELS } from './game.js';
import { getRandomUpgrades, getRandomSpecialUpgrades, getRandomUpgradeExcluding, getUpgradeDef, getWeaponStats } from './upgrades.js';
import { playShoothSound, playHitSound, playExplosionSound, playDamageSound, playFastEnemySpawn, playSwarmEnemySpawn, playBasicEnemySpawn, playTankEnemySpawn, playBossSpawn, playMenuClick, playErrorSound, playBuckshotSound, playProximityAlert, playSwarmProximityAlert, playUpgradeSound, playSlowMoSound, playSlowMoReverseSound, startLightningSound, stopLightningSound, playMusic, stopMusic, playBossAlertSound, playBigExplosionSound, playGameOverSound, playButtonHoverSound, playButtonClickSound, playLowHealthAlertSound, playVampireHealSound, playBuckshotSoundNew, fadeOutMusic } from './audio.js';
// getMusicFrequencyData removed - music visualizer commented out
import {
  initEnemies, spawnEnemy, updateEnemies, updateExplosions, getEnemyMeshes,
  getEnemyByMesh, clearAllEnemies, getEnemyCount, hitEnemy, destroyEnemy,
  applyEffects, getSpawnPosition, getEnemies, getFastEnemies, getSwarmEnemies,
  getBoss, spawnBoss, hitBoss, updateBoss, clearBoss, getBossMinionMeshes, getBossMinionByMesh, hitBossMinion, updateBossMinions,
  updateBossProjectiles, getBossProjectiles
} from './enemies.js';
import {
  initHUD, showTitle, hideTitle, updateTitle, showHUD, hideHUD, updateHUD,
  showLevelComplete, hideLevelComplete, showUpgradeCards, hideUpgradeCards,
  updateUpgradeCards, getUpgradeCardHit, showGameOver, showVictory, updateEndScreen,
  hideGameOver, triggerHitFlash, updateHitFlash, spawnDamageNumber, updateDamageNumbers, updateFPS,
  showBossHealthBar, hideBossHealthBar, updateBossHealthBar,
  updateComboPopups, checkComboIncrease,
  getTitleButtonHit, showNameEntry, hideNameEntry, getKeyboardHit, updateKeyboardHover, getNameEntryName,
  showScoreboard, hideScoreboard, getScoreboardHit, updateScoreboardScroll,
  showCountrySelect, hideCountrySelect, getCountrySelectHit,
  // [Power Outage Update] #3, #8: New HUD functions
  showBossAlert, hideBossAlert, updateBossAlert, showKillsRemainingMessage, updateKillsRemainingMessage,
  // Button hover system
  updateAllButtonHovers, clearHoverableButtons, spawnVampireHealIndicator
} from './hud.js';
import {
  submitScore, fetchTopScores, fetchScoresByCountry, fetchScoresByContinent,
  isNameClean, COUNTRIES, CONTINENTS,
  getStoredCountry, setStoredCountry, getStoredName, setStoredName
} from './scoreboard.js';

// ── Constants ──────────────────────────────────────────────
const NEON_PINK = 0xff00ff;
const NEON_CYAN = 0x00ffff;
const DARK_BG = 0x0a0015;
const SUN_CORE = 0xffaa00;
const SUN_GLOW = 0xff6600;
const MTN_DARK = 0x1a0033;
const MTN_WIRE = 0x6600aa;

const LASER_RANGE = 50;
const LASER_DURATION = 250;

// ── Module State ───────────────────────────────────────────
let stats;
const lightningBoltPool = [];
let lightningPoolIndex = 0;
const explosionVisualPool = [];
const sharedLightningMaterial = new THREE.LineBasicMaterial({
  color: 0xffff44,
  linewidth: 2,
  transparent: true,
  opacity: 0.9,
  blending: THREE.AdditiveBlending,
  depthWrite: false
});
const lightningGroup = new THREE.Group();

// Temp vectors
const _tempVec = new THREE.Vector3();
const _tempQuat = new THREE.Quaternion();
const _tempDir = new THREE.Vector3();
const _raycaster = new THREE.Raycaster();
let scene, camera, renderer;
const controllers = [];
const controllerTriggerPressed = [false, false];
const projectiles = [];
let lastTime = 0;
let frameCount = 0;  // For staggering updates

// Weapon firing cooldowns (per controller)
const weaponCooldowns = [0, 0];

// Big Boom: only one "exploding" shot per hand every 2.75s (ms)
const BIG_BOOM_COOLDOWN_MS = 2750;
const lastExplodingShotTime = [0, 0];

// Explosion visuals (short-lived expanding spheres)
const explosionVisuals = [];

// Lightning beam state (per controller)
const lightningBeams = [null, null];
const lightningTimers = [0, 0];

// Charge shot state (per controller): time when trigger was pressed (ms) or null
const chargeShotStartTime = [null, null];
const CHARGE_SHOT_MAX_TIME = 5.0;  // seconds
const CHARGE_SHOT_MIN_FIRE = 0.6;  // seconds (below this, no fire or minimal)

// Holographic blaster displays (per controller)
const blasterDisplays = [null, null];

// Mountain visualizer
const mountainLines = [];
const mountainBasePeaks = [];

// Environment refs for level-based scaling (sun, ominous horizon)
let sunMeshRef = null;
let sunGlowRef = null;
let ominousRef = null;

// Floor damage flash
let floorMaterial = null;
const FLOOR_BASE_COLOR = new THREE.Color(0x220044);
let floorFlashTimer = 0;
let floorFlashing = false;

// Low health alert state
let lowHealthAlertActive = false;
let lowHealthPulseTimer = 0;
let lowHealthSoundTimer = 0;
const LOW_HEALTH_PULSE_SPEED = 2.0; // Pulses per second
const LOW_HEALTH_SOUND_INTERVAL = 3000; // 3 seconds between alert sounds

// Upgrade selection
let upgradeSelectionCooldown = 0;
let pendingUpgrades = [];
let upgradeHand = 'left';  // which hand is selecting

// Game over cooldown
let gameOverCooldown = 0;

// Bullet-time slow-mo
let slowMoActive = false;
let slowMoDuration = 0;
let slowMoSoundPlayed = false;
let slowMoRampOut = false;       // Ramp timeScale back to 1 over 0.5s when nearby enemies cleared
let slowMoRampOutTimer = 0;
const SLOW_MO_TRIGGER_DIST = 2.0;
const SLOW_MO_RAMP_OUT_DURATION = 0.5;
let timeScale = 1.0;

// Camera shake on damage - commented out (doesn't work in VR)
// let cameraShake = 0;
// let cameraShakeIntensity = 0;
// const originalCameraPos = new THREE.Vector3();

// ── Bootstrap ──────────────────────────────────────────────
init();

// ============================================================
//  INITIALISATION
// ============================================================
function init() {
  console.log('[SPACEOMICIDE] Initialising...');

  // Setup Stats
  if (typeof Stats !== 'undefined') {
    stats = new Stats();
    stats.dom.style.display = 'none';
    document.body.appendChild(stats.dom);
  }

  // Scene — use black background for Adreno GPU "Fast clear" optimization on Quest
  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x000000);
  scene.fog = new THREE.FogExp2(0x000000, 0.012);

  // Setup Lightning Pool
  scene.add(lightningGroup);
  for (let i = 0; i < 40; i++) {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(32 * 3), 3));
    const bolt = new THREE.Line(geo, sharedLightningMaterial);
    bolt.visible = false;
    bolt.frustumCulled = false;
    lightningBoltPool.push(bolt);
    lightningGroup.add(bolt);
  }

  // Setup Explosion Pool
  const sharedExplosionGeo = new THREE.SphereGeometry(1, 12, 12);
  const sharedExplosionMat = new THREE.MeshBasicMaterial({
    color: 0xff8800, transparent: true, opacity: 0.7, side: THREE.BackSide, depthWrite: false, blending: THREE.AdditiveBlending
  });
  for (let i = 0; i < 40; i++) {
    const mesh = new THREE.Mesh(sharedExplosionGeo, sharedExplosionMat.clone());
    mesh.visible = false;
    mesh.userData.active = false;
    explosionVisualPool.push(mesh);
    scene.add(mesh);
  }

  // Camera
  camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.1, 1000);
  camera.position.set(0, 1.6, 0);

  // Renderer — optimized for Quest performance
  renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));  // Cap pixel ratio for perf
  renderer.xr.enabled = true;
  // No tone mapping — we use MeshBasicMaterial so ACES adds shader cost with no benefit
  renderer.toneMapping = THREE.NoToneMapping;
  document.body.appendChild(renderer.domElement);

  // VR Button
  const vrButton = VRButton.createButton(renderer);
  document.body.appendChild(vrButton);

  if (!navigator.xr) {
    document.getElementById('no-vr').style.display = 'block';
    console.warn('[init] WebXR not supported');
  } else {
    navigator.xr.isSessionSupported('immersive-vr').then((supported) => {
      if (!supported) {
        document.getElementById('no-vr').style.display = 'block';
        console.warn('[init] immersive-vr not supported');
      }
    });
  }

  // Build world
  createEnvironment();
  setupControllers();

  // Init subsystems
  initEnemies(scene);
  initHUD(camera, scene);

  // Start at title
  resetGame();
  showTitle();

  // Listeners
  window.addEventListener('resize', onWindowResize);

  // Render loop
  renderer.setAnimationLoop(render);

  // Start menu music
  playMusic('menu');

  console.log('[init] SPACEOMICIDE ready — pull trigger at title screen to start');
}

// ============================================================
//  ENVIRONMENT
// ============================================================
function createEnvironment() {
  // Grid floor - reduced size to cut ugly distant static
  const grid = new THREE.GridHelper(120, 48, NEON_PINK, 0xff0088);
  if (Array.isArray(grid.material)) {
    grid.material.forEach(m => { m.transparent = true; m.opacity = 0.85; });
  } else {
    grid.material.transparent = true;
    grid.material.opacity = 0.85;
  }
  scene.add(grid);

  const floorGeo = new THREE.PlaneGeometry(200, 200);
  const floorMat = new THREE.MeshBasicMaterial({ color: 0x220044 });
  floorMaterial = floorMat;  // Store reference for damage flash
  const floor = new THREE.Mesh(floorGeo, floorMat);
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = -0.01;
  scene.add(floor);

  // Horizon glow ring — a cylinder ring at the grid edge, visible from inside
  // Provides the illusion of a glowing horizon all around the player
  const horizonRadius = 60;  // At grid edge
  const horizonHeight = 3;
  const horizonSegments = 48;

  // Create gradient texture for horizon glow (bright at bottom, fading up)
  const horizonCanvas = document.createElement('canvas');
  horizonCanvas.width = 4;
  horizonCanvas.height = 64;
  const horizonCtx = horizonCanvas.getContext('2d');
  const horizonGrad = horizonCtx.createLinearGradient(0, 64, 0, 0);
  horizonGrad.addColorStop(0, '#ffaacc');   // Bright pinkish-white at base
  horizonGrad.addColorStop(0.3, '#ff66aa');
  horizonGrad.addColorStop(0.7, '#ff225588');
  horizonGrad.addColorStop(1.0, '#ff000000');
  horizonCtx.fillStyle = horizonGrad;
  horizonCtx.fillRect(0, 0, 4, 64);

  const horizonTexture = new THREE.CanvasTexture(horizonCanvas);
  const horizonGeo = new THREE.CylinderGeometry(horizonRadius, horizonRadius, horizonHeight, horizonSegments, 1, true);
  const horizonMat = new THREE.MeshBasicMaterial({
    map: horizonTexture,
    transparent: true,
    side: THREE.BackSide,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  const horizonRing = new THREE.Mesh(horizonGeo, horizonMat);
  horizonRing.position.set(0, horizonHeight / 2 - 0.5, 0);
  horizonRing.renderOrder = -2;
  scene.add(horizonRing);

  // Second brighter, shorter glow layer for intensity at ground level
  const horizonInnerGeo = new THREE.CylinderGeometry(horizonRadius - 0.5, horizonRadius - 0.5, 1.5, horizonSegments, 1, true);
  const horizonInnerMat = new THREE.MeshBasicMaterial({
    color: 0xffccee,
    transparent: true,
    opacity: 0.5,
    side: THREE.BackSide,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  const horizonInnerRing = new THREE.Mesh(horizonInnerGeo, horizonInnerMat);
  horizonInnerRing.position.set(0, 0.25, 0);
  horizonInnerRing.renderOrder = -2;
  scene.add(horizonInnerRing);

  createSun();
  createMountains();
  createStars();

  // createAurora();  // COMMENTED OUT - causing error
  // createOminousHorizon();  // COMMENTED OUT - commented out earlier
  createAtmosphere();

  // NOTE: Lights removed — all materials are MeshBasicMaterial (unlit)
  // so lights have zero visual effect but cost GPU overhead.
  // If PBR materials are added later, re-add lights here.
}

function createSun() {
  // TODO: Replace canvas-generated sun with a hand-crafted PNG texture for best quality.
  // To swap: load a transparent PNG with `new THREE.TextureLoader().load('sun.png', tex => { ... })`
  // and apply it to the sunMat below. The PNG should be a circle with horizontal cutout bands.

  // Generate synthwave sun as a canvas texture with built-in cutout bands
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d');

  // Draw sun circle — only bottom half visible (sits on horizon)
  // Upper half: warm yellow/orange. Lower half: deep orange/red with bands.
  const sunGrad = ctx.createLinearGradient(256, 30, 256, 482);
  sunGrad.addColorStop(0, '#ffdd33');    // Bright warm yellow at top
  sunGrad.addColorStop(0.3, '#ffaa00');
  sunGrad.addColorStop(0.5, '#ff6600');
  sunGrad.addColorStop(0.7, '#ff3300');
  sunGrad.addColorStop(1.0, '#cc1100');  // Deep red at bottom

  ctx.beginPath();
  ctx.arc(256, 256, 248, 0, Math.PI * 2);
  ctx.fillStyle = sunGrad;
  ctx.fill();

  // Slight outer glow baked into the texture (soft edge)
  ctx.shadowColor = '#ff8800';
  ctx.shadowBlur = 20;
  ctx.beginPath();
  ctx.arc(256, 256, 248, 0, Math.PI * 2);
  ctx.fillStyle = sunGrad;
  ctx.fill();
  ctx.shadowBlur = 0;

  // Cut horizontal bands in the lower half — thick at bottom, thin toward center
  // Classic retrowave sun: bands only below the equator
  ctx.globalCompositeOperation = 'destination-out';
  const bandDefs = [
    { y: 0.90, h: 0.065 },  // Bottom: thickest
    { y: 0.82, h: 0.050 },
    { y: 0.75, h: 0.038 },
    { y: 0.69, h: 0.028 },
    { y: 0.64, h: 0.020 },
    { y: 0.60, h: 0.013 },
    { y: 0.57, h: 0.008 },
    { y: 0.54, h: 0.004 },  // Center: thinnest
  ];
  for (const b of bandDefs) {
    const cy = b.y * 512;
    const ch = b.h * 512;
    ctx.fillStyle = 'black';
    ctx.fillRect(0, cy - ch / 2, 512, ch);
  }
  ctx.globalCompositeOperation = 'source-over';

  const sunTexture = new THREE.CanvasTexture(canvas);
  const sunMat = new THREE.MeshBasicMaterial({
    map: sunTexture,
    transparent: true,
    side: THREE.DoubleSide,
    depthWrite: false,
  });
  // Position so the lower ~40% of the sun dips below the horizon
  const sunMesh = new THREE.Mesh(new THREE.PlaneGeometry(32, 32), sunMat);
  sunMesh.position.set(0, 12, -89);
  sunMesh.renderOrder = -10;
  scene.add(sunMesh);
  sunMeshRef = sunMesh;

  // Outer glow behind sun (additive for bloom effect)
  const glowMat = new THREE.MeshBasicMaterial({
    color: SUN_GLOW,
    side: THREE.DoubleSide,
    transparent: true,
    opacity: 0.35,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  const glow = new THREE.Mesh(new THREE.CircleGeometry(24, 32), glowMat);
  glow.position.set(0, 12, -89.5);
  glow.renderOrder = -11;
  scene.add(glow);
  sunGlowRef = glow;

  createOminousHorizon();
  // createAurora();
  // Atmosphere: vertical gradient cylinder around player
  createAtmosphere();
}

/** Low-res aurora borealis on sky dome — performance friendly (small texture, single mesh) - COMMENTED OUT */
// function createAurora() {
//   const w = 32;
//   const h = 64;
//   const canvas = document.createElement('canvas');
//   canvas.width = w;
//   canvas.height = h;
//   const ctx = canvas.getContext('2d');
//   const grad = ctx.createLinearGradient(0, 0, 0, h);
//   grad.addColorStop(0, 'rgba(0,40,60,0)');
//   grad.addColorStop(0.3, 'rgba(0,200,180,0.08)');
//   grad.addColorStop(0.5, 'rgba(0,255,200,0.12)');
//   grad.addColorStop(0.7, 'rgba(0,180,220,0.06)');
//   grad.addColorStop(1, 'rgba(0,40,80,0)');
//   ctx.fillStyle = grad;
//   ctx.fillRect(0, 0, w, h);
//   const tex = new THREE.CanvasTexture(canvas);
//   tex.wrapS = THREE.RepeatWrapping;
//   const geo = new THREE.CylinderGeometry(95, 95, 25, 32, 1, true);
//   const mat = new THREE.MeshBasicMaterial({
//     map: tex,
//     transparent: true,
//     opacity: 0.9,
//     side: THREE.BackSide,
//     depthWrite: false,
//   });
//   const mesh = new THREE.Mesh(geo, mat);
//   mesh.position.set(0, 15, 0);
//   mesh.renderOrder = -21;
//   scene.add(mesh);
// }

/** Dark ominous shape over horizon; appears from level 10, large by level 16 - COMMENTED OUT */
// function createOminousHorizon() {
//   const geo = new THREE.PlaneGeometry(80, 50);
//   const mat = new THREE.MeshBasicMaterial({
//     color: 0x0a0015,
//     transparent: true,
//     opacity: 0,
//     side: THREE.DoubleSide,
//     depthWrite: false,
//   });
//   const mesh = new THREE.Mesh(geo, mat);
//   mesh.position.set(0, 28, -95);
//   mesh.renderOrder = -12;
//   scene.add(mesh);
//   ominousRef = mesh;
// }


/** Dark ominous shape over the horizon; appears from level 10, large by level 16 */
function createOminousHorizon() {
  const geo = new THREE.PlaneGeometry(80, 50);
  const mat = new THREE.MeshBasicMaterial({
    color: 0x0a0015,
    transparent: true,
    opacity: 0,
    side: THREE.DoubleSide,
    depthWrite: false,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.set(0, 28, -95);
  mesh.renderOrder = -12;
  scene.add(mesh);
  ominousRef = mesh;
}

function createAtmosphere() {
  // 360-degree atmosphere gradient cylinder around the player
  // Creates the illusion of being on a round planet with warm horizon glow
  const segments = 48;
  const radius = 92;  // Just behind mountains
  const height = 30;

  // Create a canvas for the gradient texture
  // Use full-opacity colors and control alpha separately in the gradient
  const canvas = document.createElement('canvas');
  canvas.width = 4;
  canvas.height = 256;
  const ctx = canvas.getContext('2d');

  // Paint the gradient: warm colors at base, fading to transparent at top
  // Note: CSS rgba() alpha is 0.0-1.0
  const grad = ctx.createLinearGradient(0, 256, 0, 0);  // bottom to top
  grad.addColorStop(0, 'rgba(255, 80, 20, 1.0)');    // Full intensity warm orange at base
  grad.addColorStop(0.08, 'rgba(255, 60, 30, 0.85)');   // Still strong
  grad.addColorStop(0.2, 'rgba(220, 50, 40, 0.55)');   // Red-orange
  grad.addColorStop(0.4, 'rgba(160, 30, 60, 0.3)');    // Darker red
  grad.addColorStop(0.6, 'rgba(100, 15, 50, 0.12)');   // Deep purple-red
  grad.addColorStop(0.8, 'rgba(50, 5, 40, 0.04)');     // Nearly gone
  grad.addColorStop(1.0, 'rgba(20, 0, 20, 0.0)');      // Fully transparent
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 4, 256);

  const atmTexture = new THREE.CanvasTexture(canvas);
  atmTexture.wrapS = THREE.RepeatWrapping;

  // Create a cylinder geometry (open-ended, only the side)
  const cylGeo = new THREE.CylinderGeometry(radius, radius, height, segments, 1, true);
  const cylMat = new THREE.MeshBasicMaterial({
    map: atmTexture,
    transparent: true,
    opacity: 0.8,
    side: THREE.BackSide,  // Visible from inside
    depthWrite: false,
  });
  const cylinder = new THREE.Mesh(cylGeo, cylMat);
  cylinder.position.set(0, height / 2 - 2, 0);  // Base near ground level
  cylinder.renderOrder = -13;
  scene.add(cylinder);
}

function createMountains() {
  const layers = [
    { z: -85, color: 0x0d001a, peaks: generatePeaks(12, 6, 20), layerIndex: 0 },
    { z: -75, color: MTN_DARK, peaks: generatePeaks(10, 4, 14), layerIndex: 1 },
  ];
  layers.forEach(({ z, color, peaks, layerIndex }) => {
    // Store base peaks for animation
    mountainBasePeaks[layerIndex] = peaks.map(([x, y]) => ({ x, y, baseY: y }));

    const shape = new THREE.Shape();
    shape.moveTo(-100, 0);
    peaks.forEach(([x, y]) => shape.lineTo(x, y));
    shape.lineTo(100, 0);
    shape.closePath();

    const fillMesh = new THREE.Mesh(new THREE.ShapeGeometry(shape), new THREE.MeshBasicMaterial({ color, side: THREE.DoubleSide }));
    fillMesh.position.set(0, 0, z);
    fillMesh.renderOrder = -5;  // Draw after foreground, before sun
    scene.add(fillMesh);

    const edgePoints = [new THREE.Vector3(-100, 0, z)];
    peaks.forEach(([x, y]) => edgePoints.push(new THREE.Vector3(x, y, z)));
    edgePoints.push(new THREE.Vector3(100, 0, z));
    const geometry = new THREE.BufferGeometry().setFromPoints(edgePoints);
    const edgeLine = new THREE.Line(geometry, new THREE.LineBasicMaterial({ color: MTN_WIRE, transparent: true, opacity: 0.8 }));
    scene.add(edgeLine);

    // Store for animation
    mountainLines[layerIndex] = { line: edgeLine, geometry, z, fillMesh, shape };
  });
}

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

function createStars() {
  // Reduced from 1500 to 800 — still looks great, fewer draw calls
  // Made stars further away (400 instead of 300) and smaller (0.3 instead of 0.5)
  const count = 800;
  const positions = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    const i3 = i * 3;
    positions[i3] = (Math.random() - 0.5) * 400;
    positions[i3 + 1] = Math.random() * 100 + 20;
    positions[i3 + 2] = (Math.random() - 0.5) * 400;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  // Opaque stars (no transparency = cheaper to render, no sorting needed)
  const mat = new THREE.PointsMaterial({ color: 0xffffff, size: 0.3 });
  const stars = new THREE.Points(geo, mat);
  stars.renderOrder = -20;  // Draw last (furthest background)
  scene.add(stars);
}

// ============================================================
//  CONTROLLERS
// ============================================================
function setupControllers() {
  for (let i = 0; i < 2; i++) {
    const controller = renderer.xr.getController(i);

    controller.addEventListener('selectstart', () => { controllerTriggerPressed[i] = true; onTriggerPress(controller, i); });
    controller.addEventListener('selectend', () => { controllerTriggerPressed[i] = false; onTriggerRelease(i); });
    controller.addEventListener('connected', (e) => {
      console.log(`[controller] ${i} connected — ${e.data.handedness}`);
      controller.userData.handedness = e.data.handedness;
    });
    controller.addEventListener('disconnected', () => {
      console.log(`[controller] ${i} disconnected`);
    });

    controller.add(createControllerVisual(i));
    scene.add(controller);
    controllers.push(controller);
  }
}

function createControllerVisual(index) {
  const color = index === 0 ? NEON_CYAN : NEON_PINK;
  const group = new THREE.Group();

  group.add(new THREE.Mesh(new THREE.SphereGeometry(0.03, 16, 16), new THREE.MeshBasicMaterial({ color })));
  group.add(new THREE.Mesh(new THREE.SphereGeometry(0.055, 16, 16), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.2 })));

  // Aim line extending forward
  const aimGeo = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, 0, -10)]);
  group.add(new THREE.Line(aimGeo, new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.3 })));

  // Create holographic display (initially hidden)
  const display = createBlasterDisplay(index);
  display.visible = false;
  display.name = 'blasterDisplay';
  group.add(display);
  blasterDisplays[index] = display;

  return group;
}

function createBlasterDisplay(controllerIndex) {
  const group = new THREE.Group();
  const hand = controllerIndex === 0 ? 'left' : 'right';

  // No background panel — text floats as part of hologram

  // Subtle border outline (no solid panel behind it)
  const borderPanelGeo = new THREE.PlaneGeometry(0.2, 0.25);
  const borderGeo = new THREE.EdgesGeometry(borderPanelGeo);
  const borderMat = new THREE.LineBasicMaterial({ color: 0x00ffff, transparent: true, opacity: 0.3 });
  const border = new THREE.LineSegments(borderGeo, borderMat);
  border.position.z = 0.001;
  group.add(border);

  // Scrolling scan lines for old-TV hologram effect
  // Rendered IN FRONT of text (higher z + renderOrder) so they aren't occluded
  const scanLines = [];
  for (let i = 0; i < 8; i++) {
    const lineGeo = new THREE.PlaneGeometry(0.21, 0.0015);
    const lineMat = new THREE.MeshBasicMaterial({
      color: 0x44ffff,
      transparent: true,
      opacity: 0.25,
      depthTest: false,       // Always render on top
      blending: THREE.AdditiveBlending,  // Glow through text
    });
    const line = new THREE.Mesh(lineGeo, lineMat);
    line.position.y = -0.125 + (i * 0.035);
    line.position.z = 0.005;  // Well in front of text (text is at z=0.002)
    line.renderOrder = 1000;  // Render after everything else in the display
    group.add(line);
    scanLines.push(line);
  }
  group.userData.scanLines = scanLines;

  // Position above controller
  group.position.set(0, 0.15, -0.05);
  group.rotation.x = -Math.PI / 4;  // Tilt toward user

  // Create text sprites (will be updated later)
  group.userData.hand = hand;
  group.userData.needsUpdate = true;

  return group;
}

function updateBlasterDisplay(display, controllerIndex) {
  if (!display || !display.visible) return;

  const hand = display.userData.hand;
  const stats = game.handStats[hand];
  const upgrades = game.upgrades[hand];

  // Remove old text
  const oldText = display.children.filter(c => c.userData.isText);
  oldText.forEach(t => display.remove(t));

  // Create new text (using PlaneGeometry to respect parent rotation)
  const makeText = (text, yPos, size = 20) => {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    canvas.width = 256;
    canvas.height = 64;

    // Clear canvas to transparent
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    ctx.font = `bold ${size}px Arial`;
    ctx.fillStyle = '#00ffff';
    ctx.textAlign = 'center';
    ctx.fillText(text, 128, 32);

    const texture = new THREE.CanvasTexture(canvas);

    // Use PlaneGeometry instead of Sprite so it follows parent rotation
    const geometry = new THREE.PlaneGeometry(0.15, 0.04);
    const material = new THREE.MeshBasicMaterial({
      map: texture,
      transparent: true,
      alphaTest: 0.05,
      side: THREE.DoubleSide,
      depthTest: true
    });

    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(0, yPos, 0.002);
    mesh.userData.isText = true;
    return mesh;
  };

  display.add(makeText(`${hand.toUpperCase()} BLASTER`, 0.1));
  display.add(makeText(`KILLS: ${stats.kills}`, 0.04, 16));
  display.add(makeText(`DMG: ${Math.round(stats.totalDamage)}`, -0.02, 16));

  // Show upgrade count
  const upgradeCount = Object.values(upgrades).reduce((sum, count) => sum + count, 0);
  display.add(makeText(`UPGRADES: ${upgradeCount}`, -0.08, 16));

  display.userData.needsUpdate = false;
}

/** Animate hologram scan lines (called every frame, separate from data updates) */
function animateBlasterScanLines(display) {
  if (!display || !display.visible) return;
  const scanLines = display.userData.scanLines;
  if (!scanLines) return;
  const time = performance.now() * 0.001;
  for (let i = 0; i < scanLines.length; i++) {
    const line = scanLines[i];
    // Scroll upward, evenly spaced, moderate speed
    let y = ((time * 0.12 + i * 0.035) % 0.28) - 0.14;
    line.position.y = y;
    // Fade near edges of the display area, brighter in the middle
    const edgeDist = Math.min(Math.abs(y + 0.12), Math.abs(y - 0.12));
    line.material.opacity = Math.min(0.35, edgeDist * 4);
  }
}

// ============================================================
//  INPUT HANDLING
// ============================================================
// Scoreboard flow context
let scoreboardFromGameOver = false;  // true = came from game over, false = came from title

function onTriggerPress(controller, index) {
  const st = game.state;

  if (st === State.TITLE) {
    handleTitleTrigger(controller);
  } else if (st === State.PLAYING) {
    shootWeapon(controller, index);
  } else if (st === State.UPGRADE_SELECT) {
    selectUpgrade(controller);
  } else if (st === State.GAME_OVER || st === State.VICTORY) {
    if (gameOverCooldown <= 0) {
      handleGameOverTrigger(controller);
    }
  } else if (st === State.NAME_ENTRY) {
    handleNameEntryTrigger(controller);
  } else if (st === State.SCOREBOARD || st === State.REGIONAL_SCORES) {
    handleScoreboardTrigger(controller);
  } else if (st === State.COUNTRY_SELECT) {
    handleCountrySelectTrigger(controller);
  }
}

function handleTitleTrigger(controller) {
  const origin = new THREE.Vector3();
  const quat = new THREE.Quaternion();
  controller.getWorldPosition(origin);
  controller.getWorldQuaternion(quat);
  const direction = new THREE.Vector3(0, 0, -1).applyQuaternion(quat);
  const raycaster = new THREE.Raycaster(origin, direction, 0, 20);

  const btnHit = getTitleButtonHit(raycaster);
  if (btnHit === 'scoreboard') {
    playButtonClickSound();
    scoreboardFromGameOver = false;
    game.state = State.SCOREBOARD;
    hideTitle();
    showScoreboard([], 'LOADING...');
    fetchTopScores().then(scores => {
      showScoreboard(scores, 'GLOBAL LEADERBOARD');
    });
    return;
  }
  startGame();
}

function handleGameOverTrigger(controller) {
  // Store final score/level for name entry
  game.finalScore = game.score;
  game.finalLevel = game.level;
  scoreboardFromGameOver = true;
  hideGameOver();

  // If no stored country, go to country select first
  if (!getStoredCountry()) {
    game.state = State.COUNTRY_SELECT;
    showCountrySelect(COUNTRIES, CONTINENTS, 'North America');
  } else {
    game.state = State.NAME_ENTRY;
    showNameEntry(game.finalScore, game.finalLevel, getStoredName());
  }
}

function handleNameEntryTrigger(controller) {
  const origin = new THREE.Vector3();
  const quat = new THREE.Quaternion();
  controller.getWorldPosition(origin);
  controller.getWorldQuaternion(quat);
  const direction = new THREE.Vector3(0, 0, -1).applyQuaternion(quat);
  const raycaster = new THREE.Raycaster(origin, direction, 0, 10);

  const result = getKeyboardHit(raycaster);
  if (result && result.action === 'submit') {
    playButtonClickSound();
    const name = result.name.trim();
    if (!isNameClean(name)) {
      console.log('[scoreboard] Name rejected by profanity filter');
      return;
    }
    setStoredName(name);
    hideNameEntry();

    // Submit score and show scoreboard
    game.state = State.SCOREBOARD;
    showScoreboard([], 'SUBMITTING...');
    const country = getStoredCountry() || '';
    submitScore(name, game.finalScore, game.finalLevel, country).then(() => {
      // Small artificial delay to ensure DB indexing is finished for consistent read-after-write
      return new Promise(resolve => setTimeout(resolve, 500));
    }).then(() => {
      return fetchTopScores();
    }).then(scores => {
      showScoreboard(scores, 'GLOBAL LEADERBOARD');
    }).catch(err => {
      console.error('[scoreboard] Detailed error in submission flow:', err);
      showScoreboard([], 'ERROR SUBMITTING SCORE');
    });
  }
}

function handleScoreboardTrigger(controller) {
  const origin = new THREE.Vector3();
  const quat = new THREE.Quaternion();
  controller.getWorldPosition(origin);
  controller.getWorldQuaternion(quat);
  const direction = new THREE.Vector3(0, 0, -1).applyQuaternion(quat);
  const raycaster = new THREE.Raycaster(origin, direction, 0, 20);

  const action = getScoreboardHit(raycaster);
  if (action === 'back') {
    playButtonClickSound();
    hideScoreboard();
    resetGame();
    showTitle();
    return;
  }
  if (action === 'country') {
    playButtonClickSound();
    // Show country select for filtering
    scoreboardFromGameOver = false;
    game.state = State.COUNTRY_SELECT;
    hideScoreboard();
    showCountrySelect(COUNTRIES, CONTINENTS, 'North America');
    return;
  }
  if (action === 'continent') {
    playButtonClickSound();
    // Show continent picker — reuse country select but select a continent
    scoreboardFromGameOver = false;
    game.state = State.COUNTRY_SELECT;
    hideScoreboard();
    showCountrySelect(COUNTRIES, CONTINENTS, 'North America');
    return;
  }
}

function handleCountrySelectTrigger(controller) {
  const origin = new THREE.Vector3();
  const quat = new THREE.Quaternion();
  controller.getWorldPosition(origin);
  controller.getWorldQuaternion(quat);
  const direction = new THREE.Vector3(0, 0, -1).applyQuaternion(quat);
  const raycaster = new THREE.Raycaster(origin, direction, 0, 10);

  const result = getCountrySelectHit(raycaster, COUNTRIES);
  if (!result) return;

  if (result.action === 'back') {
    playButtonClickSound();
    hideCountrySelect();
    if (scoreboardFromGameOver) {
      // Back to name entry
      game.state = State.NAME_ENTRY;
      showNameEntry(game.finalScore, game.finalLevel, getStoredName());
    } else {
      // Back to scoreboard
      game.state = State.SCOREBOARD;
      showScoreboard([], 'LOADING...');
      fetchTopScores().then(scores => {
        showScoreboard(scores, 'GLOBAL LEADERBOARD');
      });
    }
    return;
  }

  if (result.action === 'select') {
    playButtonClickSound();
    setStoredCountry(result.code);
    hideCountrySelect();

    if (scoreboardFromGameOver) {
      // After setting country during game-over flow, go to name entry
      game.state = State.NAME_ENTRY;
      showNameEntry(game.finalScore, game.finalLevel, getStoredName());
    } else {
      // Filtering scoreboard by country
      game.state = State.REGIONAL_SCORES;
      const country = COUNTRIES.find(c => c.code === result.code);
      const label = country ? country.name : result.code;
      showScoreboard([], 'LOADING...');
      fetchScoresByCountry(result.code).then(scores => {
        // [Power Outage Update] #13: Pass country info for header split
        showScoreboard(scores, `${label.toUpperCase()} LEADERBOARD`, {
          countryCode: result.code,
          countryName: label
        });
      });
    }
  }
}

function onTriggerRelease(index) {
  // Charge shot: fire beam on release
  if (chargeShotStartTime[index] !== null) {
    const hand = index === 0 ? 'left' : 'right';
    const stats = getWeaponStats(game.upgrades[hand]);
    if (stats.chargeShot) {
      const chargeTimeSec = (performance.now() - chargeShotStartTime[index]) / 1000;
      fireChargeBeam(controllers[index], index, chargeTimeSec, stats);
    }
    chargeShotStartTime[index] = null;
  }
  // Stop lightning beam when trigger released
  if (lightningBeams[index]) {
    scene.remove(lightningBeams[index]);
    lightningBeams[index] = null;
    stopLightningSound();
  }
}

// ============================================================
//  GAME STATE TRANSITIONS
// ============================================================
function debugJumpToLevel(targetLevel) {
  console.log(`[debug] Jump to level ${targetLevel}`);
  hideTitle();
  resetGame();
  game.state = State.PLAYING;
  game.level = targetLevel;
  game._levelConfig = getLevelConfig();
  game.health = game.maxHealth;

  const hand = (lvl, idx) => ((lvl + idx) % 2 === 1 ? 'left' : 'right');
  for (let lvl = 1; lvl < targetLevel; lvl++) {
    const cfg = LEVELS[lvl - 1];
    if (cfg && cfg.isBoss) {
      const special = getRandomSpecialUpgrades(1)[0];
      if (special) addUpgrade(special.id, hand(lvl, 0));
    } else {
      const upgrades = getRandomUpgrades(3);
      upgrades.forEach((u, idx) => addUpgrade(u.id, hand(lvl, idx)));
    }
  }
  game.kills = 0;
  game._levelConfig = getLevelConfig();
  showHUD();
  blasterDisplays.forEach(d => { if (d) d.visible = false; });
  if (targetLevel >= 6) playMusic('levels6to10');
  else playMusic('levels1to5');
}

function startGame() {
  console.log('[game] Starting new game');
  hideTitle();
  resetGame();
  game.state = State.PLAYING;
  game.level = 1;
  game._levelConfig = getLevelConfig();
  showHUD();

  // Hide blaster displays during gameplay
  blasterDisplays.forEach(d => { if (d) d.visible = false; });

  // Start level music
  playMusic('levels1to5');
}

function completeLevel() {
  console.log(`[game] Level ${game.level} complete`);
  
  // [Power Outage Update] #9: Store completed kill counts for HUD display
  const cfg = game._levelConfig;
  game._completedKills = game.kills;
  game._completedKillTarget = cfg ? cfg.killTarget : game.kills;
  
  // Stop boss music when boss dies
  if (cfg && cfg.isBoss) {
    stopMusic();
    console.log(`[music] Stopped boss music after defeating boss at level ${game.level}`);
  }
  
  // [Power Outage Update] #6: Enter slow-mo finale instead of immediate completion
  game.state = State.LEVEL_COMPLETE_SLOWMO;
  game.stateTimer = 3.0; // 3 seconds of slow-mo
  timeScale = 0.15; // Heavy slow-mo
  playBigExplosionSound();
  stopLightningSound();
  game.justBossKill = cfg && cfg.isBoss;
  showLevelComplete(game.level, camera.position);
}

function showUpgradeScreen() {
  console.log('[game] Showing upgrade selection');
  game.state = State.UPGRADE_SELECT;
  hideLevelComplete();

  // Stop lightning sound during upgrade screen
  stopLightningSound();

  // Fade out all music over 4 seconds when next level is a boss level
  const nextLevel = game.level + 1;
  if (nextLevel % 5 === 0 && nextLevel <= 20) {
    fadeOutMusic(4.0);
    console.log(`[music] Fading out all music before boss level ${nextLevel}`);
  }

  // Alternate between left and right hand
  upgradeHand = upgradeHand === 'left' ? 'right' : 'left';

  // Determine what shot types to exclude (if both hands have the same one)
  const shotTypeIds = ['lightning', 'buckshot', 'charge_shot'];
  const leftShotType = shotTypeIds.find(s => (game.upgrades.left[s] || 0) > 0);
  const rightShotType = shotTypeIds.find(s => (game.upgrades.right[s] || 0) > 0);
  const excludeIds = [];

  // If both hands have the same shot type, don't offer it
  if (leftShotType && leftShotType === rightShotType) {
    excludeIds.push(leftShotType);
    console.log(`[game] Both hands have ${leftShotType}, excluding from upgrade pool`);
  }

  pendingUpgrades = game.justBossKill ? getRandomSpecialUpgrades(3) : getRandomUpgrades(3, excludeIds);
  showUpgradeCards(pendingUpgrades, camera.position, upgradeHand);
  if (game.justBossKill) game.justBossKill = false;
  upgradeSelectionCooldown = 1.5; // prevent instant selection

  // Mark blaster displays for update
  blasterDisplays.forEach(d => { if (d) d.userData.needsUpdate = true; });
}

function selectUpgradeAndAdvance(upgrade, hand) {
  console.log(`[game] Selected upgrade: ${upgrade.name} for ${hand} hand`);
  
  playButtonClickSound();

  // Handle SKIP option - restore full health instead of upgrade
  if (upgrade.id === 'SKIP') {
    game.health = game.maxHealth;
    console.log('[game] Skipped upgrade, health restored to full');
    playUpgradeSound();
    hideUpgradeCards();
    advanceLevelAfterUpgrade();
    return;
  }

  const def = getUpgradeDef(upgrade.id) || upgrade;
  const shotTypeIds = ['lightning', 'buckshot', 'charge_shot'];
  const isShotTypeSideGrade = def.sideGrade && shotTypeIds.includes(upgrade.id);
  const currentShotType = shotTypeIds.find(s => (game.upgrades[hand][s] || 0) > 0);
  const handHasOtherShotType = currentShotType && currentShotType !== upgrade.id;

  // Side-grade: change shot type and replace this card with another, then pick again
  if (isShotTypeSideGrade && handHasOtherShotType) {
    delete game.upgrades[hand][currentShotType];
    addUpgrade(upgrade.id, hand);
    playUpgradeSound();
    const idx = pendingUpgrades.findIndex(u => u.id === upgrade.id);
    const replacement = getRandomUpgradeExcluding([upgrade.id]);
    if (replacement && idx >= 0) {
      pendingUpgrades = [...pendingUpgrades];
      pendingUpgrades[idx] = replacement;
      hideUpgradeCards();
      showUpgradeCards(pendingUpgrades, camera.position, hand);
      upgradeSelectionCooldown = 1.5;
    } else {
      hideUpgradeCards();
      advanceLevelAfterUpgrade();
    }
    return;
  }

  addUpgrade(upgrade.id, hand);
  playUpgradeSound();
  hideUpgradeCards();
  advanceLevelAfterUpgrade();
}

function advanceLevelAfterUpgrade() {
  game.level++;
  game.kills = 0;

  // [Power Outage Update] #9: Reset kills remaining flag for new level
  game._shownKillsRemaining = false;

  if (game.level > 20) {
    endGame(true); // victory
  } else {
    game._levelConfig = getLevelConfig();
    
    // [Power Outage Update] #2, #3: Check for boss level - enter BOSS_ALERT state
    if (game._levelConfig.isBoss) {
      game.state = State.BOSS_ALERT;
      game.stateTimer = 3.0; // 3 second alert sequence
      // Start boss music immediately at alert screen
      const bossCategory = `boss${game.level}`;
      playMusic(bossCategory);
      playBossAlertSound();
      showBossAlert();
      console.log(`[game] Boss alert for level ${game.level} - boss music started`);
    } else {
      game.state = State.PLAYING;
      showHUD();
      
      // Start appropriate level music after boss or based on level range
      if (game.level >= 1 && game.level <= 5) {
        playMusic('levels1to5');
      } else if (game.level >= 6 && game.level <= 10) {
        playMusic('levels6to10');
      }
      // Levels 11-20 currently use levels6to10 music (extend if needed)
    }

    // Hide blaster displays during gameplay
    blasterDisplays.forEach(d => { if (d) d.visible = false; });
  }
}

function endGame(victory) {
  console.log(`[game] Game ${victory ? 'won' : 'over'} — score: ${game.score}`);
  game.state = victory ? State.VICTORY : State.GAME_OVER;
  game.finalScore = game.score;
  game.finalLevel = game.level;
  clearAllEnemies();
  clearBoss();
  hideHUD();
  hideBossHealthBar();
  gameOverCooldown = 2.0;  // 2 second cooldown before restart allowed

  // Stop music
  stopMusic();
  stopLightningSound();

  // [Power Outage Update] #15: Play game over sound on death
  if (!victory) {
    playGameOverSound();
  }

  if (victory) {
    showVictory(game.score, camera.position);
  } else {
    showGameOver(game.score, camera.position);
  }
}

// ============================================================
//  SHOOTING & COMBAT
// ============================================================
function shootWeapon(controller, index) {
  const now = performance.now();
  const hand = index === 0 ? 'left' : 'right';
  const stats = getWeaponStats(game.upgrades[hand]);

  // Lightning beam mode - handled separately in update loop
  if (stats.lightning) {
    return;  // Lightning is continuous hold-to-fire
  }

  // Check cooldown
  if (now - weaponCooldowns[index] < stats.fireInterval) return;
  weaponCooldowns[index] = now;

  controller.getWorldPosition(_tempVec);
  controller.getWorldQuaternion(_tempQuat);
  _tempDir.set(0, 0, -1).applyQuaternion(_tempQuat);

  // Fire projectile(s)
  const count = stats.projectileCount;

  // [Power Outage Update] #1: Buckshot now uses cone spread instead of parallel lines
  for (let i = 0; i < count; i++) {
    let pelletDir = _tempDir.clone();
    
    if (stats.spreadAngle > 0) {
      // Apply random cone spread (spreadAngle is already in radians from upgrades.js)
      const spreadRad = stats.spreadAngle;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.random() * spreadRad;
      const perturbX = Math.sin(phi) * Math.cos(theta);
      const perturbY = Math.sin(phi) * Math.sin(theta);
      const up = new THREE.Vector3(0, 1, 0);
      const right = new THREE.Vector3().crossVectors(pelletDir, up).normalize();
      const trueUp = new THREE.Vector3().crossVectors(right, pelletDir).normalize();
      pelletDir.addScaledVector(right, perturbX);
      pelletDir.addScaledVector(trueUp, perturbY);
      pelletDir.normalize();
    }

    spawnProjectile(_tempVec.clone(), pelletDir, index, stats);
  }

  // Play sound once for all pellets (not per pellet)
  if (stats.spreadAngle > 0) {
    playBuckshotSoundNew(); // New buckshot sound
  } else {
    playShoothSound();
  }

  // console.log(`[shoot] ${hand} hand fired ${count} projectile(s)`);
}

function updateLightningBeam(controller, index, stats, dt) {
  controller.getWorldPosition(_tempVec);
  controller.getWorldQuaternion(_tempQuat);
  const direction = new THREE.Vector3(0, 0, -1).applyQuaternion(_tempQuat);

  // Find all enemies within range and chain to them
  const enemies = getEnemies();
  const targets = [];
  const maxChains = 2 + Math.floor(stats.lightningRange / 8);

  enemies.forEach((e, i) => {
    const dist = e.mesh.position.distanceTo(_tempVec);
    _tempDir.copy(e.mesh.position).sub(_tempVec).normalize();
    const angle = _tempDir.dot(direction);

    // Within range and roughly in front (45° cone)
    if (dist < stats.lightningRange && angle > 0.7) {
      targets.push({ index: i, enemy: e, dist });
    }
  });

  // Sort by distance, take closest N
  targets.sort((a, b) => a.dist - b.dist);
  const chainTargets = targets.slice(0, maxChains);

  // Create or update lightning beam visuals
  if (chainTargets.length > 0) {
    startLightningSound();

    let lastPos = _tempVec.clone();
    chainTargets.forEach(({ enemy }) => {
      const targetPos = enemy.mesh.position;

      // Get bolt from pool
      if (lightningPoolIndex < lightningBoltPool.length) {
        const bolt = lightningBoltPool[lightningPoolIndex++];
        updateLightningBoltGeo(bolt, lastPos, targetPos);
        bolt.visible = true;
      }

      lastPos = targetPos.clone();
    });

    // Apply damage
    const tickInterval = stats.lightningTickInterval != null ? stats.lightningTickInterval : 0.2;
    lightningTimers[index] += dt;
    if (lightningTimers[index] >= tickInterval) {
      lightningTimers[index] = 0;
      chainTargets.forEach(({ index: enemyIndex, enemy }) => {
        const result = hitEnemy(enemyIndex, stats.lightningDamage);
        spawnDamageNumber(enemy.mesh.position, stats.lightningDamage, '#ffff44');
        playHitSound();
        if (stats.effects && stats.effects.length > 0) applyEffects(enemyIndex, stats.effects);
        if (result.killed) {
          playExplosionSound();
          const destroyData = destroyEnemy(enemyIndex);
          if (destroyData) {
            game.kills++;
            game.totalKills++;
            game.killsWithoutHit++;
            addScore(destroyData.scoreValue);
            const cfg = game._levelConfig;
            if (cfg && game.kills >= cfg.killTarget) completeLevel();
          }
        }
      });
    }
  } else {
    stopLightningSound();
    lightningTimers[index] = 0;
  }
}

// Update existing line geometry for zigzag
function updateLightningBoltGeo(bolt, start, end) {
  const positions = bolt.geometry.attributes.position.array;
  const segments = 8;
  const zigzagAmount = 0.15;
  let idx = 0;

  // Start point
  positions[idx++] = start.x;
  positions[idx++] = start.y;
  positions[idx++] = start.z;

  const dir = _tempDir.subVectors(end, start).normalize();
  const perp = new THREE.Vector3(-dir.z, 0, dir.x).normalize();

  for (let i = 1; i < segments; i++) {
    const t = i / segments;
    const mx = start.x + (end.x - start.x) * t;
    const my = start.y + (end.y - start.y) * t;
    const mz = start.z + (end.z - start.z) * t;

    // Random offset
    const offsetScale = (Math.random() - 0.5) * zigzagAmount;

    positions[idx++] = mx + perp.x * offsetScale;
    positions[idx++] = my + perp.y * offsetScale + (Math.random() - 0.5) * 0.1;
    positions[idx++] = mz + perp.z * offsetScale;
  }

  // End point
  positions[idx++] = end.x;
  positions[idx++] = end.y;
  positions[idx++] = end.z;

  bolt.geometry.setDrawRange(0, segments + 1);
  bolt.geometry.attributes.position.needsUpdate = true;
  bolt.geometry.computeBoundingSphere();
}

// Create zigzag lightning bolt between two points
function createLightningBolt(start, end) {
  const points = [start.clone()];
  const segments = 8;
  const zigzagAmount = 0.15;

  for (let i = 1; i < segments; i++) {
    const t = i / segments;
    const mid = new THREE.Vector3().lerpVectors(start, end, t);

    // Random perpendicular offset
    const dir = new THREE.Vector3().subVectors(end, start).normalize();
    const perp = new THREE.Vector3(-dir.z, 0, dir.x).normalize();
    const offset = perp.multiplyScalar((Math.random() - 0.5) * zigzagAmount);

    mid.add(offset);
    points.push(mid);
  }
  points.push(end.clone());

  const geometry = new THREE.BufferGeometry().setFromPoints(points);
  const material = new THREE.LineBasicMaterial({
    color: 0xffff44,
    linewidth: 2,
    transparent: true,
    opacity: 0.9
  });
  return new THREE.Line(geometry, material);
}

/** Charge shot: scale 0.6s->0.2, 1.5s->0.3, 2.5s->0.4, 4s->0.6, 5s->1.0 */
function chargeTimeToScale(t) {
  if (t >= CHARGE_SHOT_MAX_TIME) return 1;
  if (t <= 0.6) return (t / 0.6) * 0.2;
  const keyframes = [[0.6, 0.2], [1.5, 0.3], [2.5, 0.4], [4, 0.6], [5, 1]];
  for (let k = 1; k < keyframes.length; k++) {
    if (t <= keyframes[k][0]) {
      const [t0, s0] = keyframes[k - 1];
      const [t1, s1] = keyframes[k];
      return s0 + (s1 - s0) * (t - t0) / (t1 - t0);
    }
  }
  return 1;
}

/** Distance from point to line segment (a to b) */
function pointToSegmentDist(p, a, b) {
  const ab = new THREE.Vector3().subVectors(b, a);
  const ap = new THREE.Vector3().subVectors(p, a);
  const t = Math.max(0, Math.min(1, ap.dot(ab) / ab.lengthSq()));
  const proj = new THREE.Vector3().copy(a).addScaledVector(ab, t);
  return p.distanceTo(proj);
}

const _chargeBeamA = new THREE.Vector3();
const _chargeBeamB = new THREE.Vector3();

function fireChargeBeam(controller, index, chargeTimeSec, stats) {
  if (chargeTimeSec < 0.15) return; // minimum charge to fire
  const scale = chargeTimeToScale(chargeTimeSec);
  let damage = stats.damage * scale;
  if (scale >= 1) damage = Math.max(300, damage);
  const beamWidth = 0.2 + scale * 1.3;
  const range = 50;

  const origin = new THREE.Vector3();
  const quat = new THREE.Quaternion();
  controller.getWorldPosition(origin);
  controller.getWorldQuaternion(quat);
  const direction = new THREE.Vector3(0, 0, -1).applyQuaternion(quat);

  _chargeBeamA.copy(origin);
  _chargeBeamB.copy(origin).addScaledVector(direction, range);

  const controllerIndex = index;
  const hand = index === 0 ? 'left' : 'right';

  const chargeStats = { ...stats, damage: Math.round(damage) };
  getEnemies().forEach((e, i) => {
    const dist = pointToSegmentDist(e.mesh.position, _chargeBeamA, _chargeBeamB);
    if (dist < beamWidth) {
      handleHit(i, e, chargeStats, e.mesh.position.clone(), controllerIndex, false, false);
    }
  });

  const boss = getBoss();
  if (boss) {
    const dist = pointToSegmentDist(boss.mesh.position, _chargeBeamA, _chargeBeamB);
    if (dist < beamWidth) {
      const result = hitBoss(Math.round(damage));

      // Shield reflection
      if (result.shieldReflected) {
        spawnDamageNumber(boss.mesh.position.clone(), 0, '#ff00ff');
        playHitSound();
        const dead = damagePlayer(1);
        triggerHitFlash();
        playDamageSound();
        // cameraShake = 0.3;
        // cameraShakeIntensity = 0.03;
        // originalCameraPos.copy(camera.position);
        floorFlashing = true;
        floorFlashTimer = 0.5;
        if (dead) endGame(false);
        return;
      }

      spawnDamageNumber(boss.mesh.position.clone(), Math.round(damage), '#ff4444');
      game.handStats[hand].totalDamage += damage;
      if (result.killed) {
        playExplosionSound();
        clearBoss();
        hideBossHealthBar();
        game.kills++;
        game.totalKills++;
        addScore(boss.scoreValue);
        completeLevel();
      }
    }
  }

  // Brief beam visual (cylinder)
  const beamGeo = new THREE.CylinderGeometry(beamWidth * 0.5, beamWidth * 0.5, range, 8);
  const beamMat = new THREE.MeshBasicMaterial({
    color: 0xffffff,
    transparent: true,
    opacity: 0.4 + scale * 0.4,
    side: THREE.DoubleSide,
    depthWrite: false,
  });
  const beamMesh = new THREE.Mesh(beamGeo, beamMat);
  beamMesh.position.copy(origin).addScaledVector(direction, range * 0.5);
  beamMesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction);
  beamMesh.userData.createdAt = performance.now();
  beamMesh.userData.duration = 150;
  beamMesh.userData.isChargeBeam = true;
  scene.add(beamMesh);
  explosionVisuals.push(beamMesh);

  playShoothSound();
}

function spawnProjectile(origin, direction, controllerIndex, stats) {
  const now = performance.now();
  const color = controllerIndex === 0 ? NEON_CYAN : NEON_PINK;
  const isBuckshot = stats.spreadAngle > 0;

  // Big Boom: only one exploding shot per hand every 2.75s
  let isExploding = false;
  if (stats.aoeRadius > 0) {
    if (now - lastExplodingShotTime[controllerIndex] >= BIG_BOOM_COOLDOWN_MS) {
      isExploding = true;
      lastExplodingShotTime[controllerIndex] = now;
    }
  }

  // Star Wars style laser bolt (thin cylinder) or pellet
  let mesh;
  if (isBuckshot) {
    // Pellet: small sphere
    mesh = new THREE.Mesh(
      new THREE.SphereGeometry(0.025, 6, 6),
      new THREE.MeshBasicMaterial({ color: 0xdddddd })
    );
  } else {
    // Laser bolt: elongated cylinder (3-4 feet ~ 1 meter)
    const group = new THREE.Group();
    const boltLength = 1.0;
    const boltGeo = new THREE.CylinderGeometry(0.015, 0.015, boltLength, 6);
    const bolt = new THREE.Mesh(boltGeo, new THREE.MeshBasicMaterial({ color }));
    bolt.rotation.x = Math.PI / 2; // align with forward direction
    bolt.position.z = -boltLength / 2;
    group.add(bolt);

    // Glow cylinder
    const glowGeo = new THREE.CylinderGeometry(0.035, 0.035, boltLength, 6);
    const glowBolt = new THREE.Mesh(glowGeo, new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.2 }));
    glowBolt.rotation.x = Math.PI / 2;
    glowBolt.position.z = -boltLength / 2;
    group.add(glowBolt);

    mesh = group;
  }

  mesh.position.copy(origin);
  mesh.userData.velocity = direction.clone().multiplyScalar(isBuckshot ? 20 : 40);
  mesh.userData.stats = stats;
  mesh.userData.controllerIndex = controllerIndex;
  mesh.userData.isExploding = isExploding;
  mesh.userData.lifetime = 3000;
  mesh.userData.createdAt = performance.now();
  mesh.userData.hitEnemies = new Set();

  // Orient bolt along direction
  if (!isBuckshot) {
    mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, -1), direction);
  }

  scene.add(mesh);
  projectiles.push(mesh);
  // Sound is now played once in shootWeapon() for all pellets
}

function handleHit(enemyIndex, enemy, stats, hitPoint, controllerIndex, isExploding = false, hitWeakPoint = false) {
  // Calculate damage
  let damage = stats.damage;

  // Tank weak point (one random voxel takes double damage)
  if (hitWeakPoint) damage *= 2;

  // [Power Outage Update] #14: Track crit for visual feedback
  let isCrit = false;
  if (stats.critChance > 0 && Math.random() < stats.critChance) {
    damage *= (stats.critMultiplier || 2);
    isCrit = true;
  }

  // Fire debuff increases damage taken
  if (enemy.statusEffects.fire.stacks > 0) {
    damage *= stats.fireWeakenMult;
  }

  // Apply damage
  const result = hitEnemy(enemyIndex, damage);

  // Track damage for hand stats
  if (controllerIndex !== undefined) {
    const hand = controllerIndex === 0 ? 'left' : 'right';
    game.handStats[hand].totalDamage += damage;
  }

  // [Power Outage Update] #14: Pass crit info to damage number
  spawnDamageNumber(hitPoint, damage, isCrit ? '#ffff00' : '#ffffff', isCrit);
  playHitSound();

  // Apply status effects
  if (stats.effects.length > 0) {
    applyEffects(enemyIndex, stats.effects);
  }

  // AOE explosion: only when this projectile was an "exploding" shot (once per 2.75s per hand), with higher damage + visible boom
  if (stats.aoeRadius > 0 && isExploding) {
    handleAOE(hitPoint, stats.aoeRadius, stats.damage * 1.2, controllerIndex);
    spawnExplosionVisual(hitPoint, stats.aoeRadius);
  }

  // If killed
  if (result.killed) {
    playExplosionSound();
    const destroyData = destroyEnemy(enemyIndex);
    if (destroyData) {
      game.kills++;
      game.totalKills++;
      game.killsWithoutHit++;
      addScore(destroyData.scoreValue);

      // Track kills for hand stats
      if (controllerIndex !== undefined) {
        const hand = controllerIndex === 0 ? 'left' : 'right';
        game.handStats[hand].kills++;
      }

      // Vampiric healing
      if (stats.vampiricInterval > 0 && game.totalKills % stats.vampiricInterval === 0) {
        game.health = Math.min(game.maxHealth, game.health + 1);
        console.log('[vampiric] Healed 1 HP');
        // Play heal sound and show visual indicator
        playVampireHealSound();
        spawnVampireHealIndicator(destroyData.position);
      }

      // [Power Outage Update] #8: Show "5 KILLS REMAINING" message
      const cfg = game._levelConfig;
      if (cfg) {
        const remaining = cfg.killTarget - game.kills;
        if (remaining === 5 && !game._shownKillsRemaining) {
          game._shownKillsRemaining = true;
          showKillsRemainingMessage(5);
        }
      }

      // Check level complete
      if (cfg && game.kills >= cfg.killTarget) {
        completeLevel();
      }
    }
  }
}

function handleBossHit(boss, stats, hitPoint, controllerIndex) {
  let damage = stats.damage;
  if (stats.critChance > 0 && Math.random() < stats.critChance) damage *= (stats.critMultiplier || 2);
  const result = hitBoss(damage);

  // Shield reflection: damage player instead of boss
  if (result.shieldReflected) {
    spawnDamageNumber(hitPoint, 0, '#ff00ff');  // Show 0 damage in magenta
    playHitSound();
    const dead = damagePlayer(1);
    triggerHitFlash();
    playDamageSound();
    // cameraShake = 0.3;
    // cameraShakeIntensity = 0.03;
    // originalCameraPos.copy(camera.position);
    floorFlashing = true;
    floorFlashTimer = 0.5;
    console.log('[boss] Shield reflected damage!');
    if (dead) endGame(false);
    return;
  }

  if (controllerIndex !== undefined) {
    const hand = controllerIndex === 0 ? 'left' : 'right';
    game.handStats[hand].totalDamage += damage;
  }
  spawnDamageNumber(hitPoint, damage, '#ff4444');
  playHitSound();
  if (result.killed) {
    playExplosionSound();
    clearBoss();
    hideBossHealthBar();
    game.kills++;
    game.totalKills++;
    game.killsWithoutHit++;
    addScore(boss.scoreValue);
    completeLevel();
  }
}

function handleAOE(center, radius, damage, controllerIndex) {
  const enemies = getEnemies();
  enemies.forEach((e, i) => {
    const dist = e.mesh.position.distanceTo(center);
    if (dist < radius) {
      const aoeDamage = damage * (1 - dist / radius);
      hitEnemy(i, aoeDamage);
      spawnDamageNumber(e.mesh.position, aoeDamage, '#ff8800');

      // Track AOE damage
      if (controllerIndex !== undefined) {
        const hand = controllerIndex === 0 ? 'left' : 'right';
        game.handStats[hand].totalDamage += aoeDamage;
      }
    }
  });
}

/** Spawn a short-lived visible explosion (expanding sphere) at center. */
function spawnExplosionVisual(center, radius) {
  const mesh = explosionVisualPool.find(m => !m.userData.active);
  if (!mesh) return; // Pool empty

  mesh.userData.active = true;
  mesh.visible = true;
  mesh.position.copy(center);
  mesh.scale.setScalar(0.1);
  mesh.material.opacity = 0.7;
  mesh.renderOrder = 900;
  mesh.userData.createdAt = performance.now();
  mesh.userData.duration = 350;
  mesh.userData.radius = radius;
  mesh.userData.isChargeBeam = false;

  explosionVisuals.push(mesh);
}

function updateExplosionVisuals(dt, now) {
  for (let i = explosionVisuals.length - 1; i >= 0; i--) {
    const m = explosionVisuals[i];
    const age = now - m.userData.createdAt;

    // Special handling for beam visual (not pooled yet, or different logic)
    if (m.userData.isChargeBeam) {
      if (age > m.userData.duration) {
        scene.remove(m);
        m.geometry.dispose();
        m.material.dispose();
        explosionVisuals.splice(i, 1);
      } else {
        const t = age / m.userData.duration;
        m.material.opacity = (0.4 + 0.4) * (1 - t);
      }
      continue;
    }

    if (age > m.userData.duration) {
      // Return to pool
      m.visible = false;
      m.userData.active = false;
      explosionVisuals.splice(i, 1);
    } else {
      const t = age / m.userData.duration;
      const targetScale = m.userData.radius * 0.3 * (1 + t * 2.5);
      m.scale.setScalar(targetScale);
      m.material.opacity = 0.7 * (1 - t);
    }
  }
}

function handleRicochet(fromPoint, stats, bounceCount, controllerIndex) {
  if (bounceCount >= stats.ricochetBounces) return;

  const enemies = getEnemies();
  let closest = null;
  let closestDist = 8;

  enemies.forEach((e, i) => {
    const dist = e.mesh.position.distanceTo(fromPoint);
    if (dist < closestDist) {
      closestDist = dist;
      closest = { index: i, enemy: e };
    }
  });

  if (closest) {
    handleHit(closest.index, closest.enemy, { ...stats, damage: stats.damage * 0.5 }, closest.enemy.mesh.position, controllerIndex);
    handleRicochet(closest.enemy.mesh.position, stats, bounceCount + 1, controllerIndex);
  }
}

function updateProjectiles(dt) {
  const now = performance.now();
  const raycaster = new THREE.Raycaster();
  const enemies = getEnemyMeshes(true).concat(getBossMinionMeshes());

  for (let i = projectiles.length - 1; i >= 0; i--) {
    const proj = projectiles[i];
    const age = now - proj.userData.createdAt;

    // Remove expired projectiles
    if (age > proj.userData.lifetime) {
      scene.remove(proj);
      projectiles.splice(i, 1);
      continue;
    }

    // Move projectile
    const moveDistance = proj.userData.velocity.length() * dt;
    proj.position.addScaledVector(proj.userData.velocity, dt);

    // Check collision with enemies
    raycaster.set(proj.position, proj.userData.velocity.clone().normalize());
    const hits = raycaster.intersectObjects(enemies, true);

    if (hits.length > 0 && hits[0].distance < moveDistance * 2) {
      const result = getEnemyByMesh(hits[0].object);
      if (result && result.boss) {
        handleBossHit(result.boss, proj.userData.stats, hits[0].point, proj.userData.controllerIndex);
        if (!proj.userData.stats.piercing) {
          scene.remove(proj);
          projectiles.splice(i, 1);
        }
      } else if (result && result.index !== undefined && !proj.userData.hitEnemies.has(result.index)) {
        proj.userData.hitEnemies.add(result.index);
        const hitObj = hits[0].object;
        const hitWeakPoint = hitObj.userData && hitObj.userData.weakPoint === true;
        handleHit(result.index, result.enemy, proj.userData.stats, hits[0].point, proj.userData.controllerIndex, proj.userData.isExploding, hitWeakPoint);

        // Ricochet effect
        if (proj.userData.stats.ricochetBounces > 0) {
          handleRicochet(hits[0].point, proj.userData.stats, 0, proj.userData.controllerIndex);
        }

        // Remove projectile if not piercing
        if (!proj.userData.stats.piercing) {
          scene.remove(proj);
          projectiles.splice(i, 1);
        }
      } else {
        const minionResult = getBossMinionByMesh(hits[0].object);
        if (minionResult) {
          const mResult = hitBossMinion(minionResult.index, proj.userData.stats.damage);
          spawnDamageNumber(hits[0].point, proj.userData.stats.damage, '#ff8800');
          if (mResult.killed) playExplosionSound();
          if (!proj.userData.stats.piercing) {
            scene.remove(proj);
            projectiles.splice(i, 1);
          }
        }
      }
    }
  }
}

function selectUpgrade(controller) {
  if (upgradeSelectionCooldown > 0) return;

  const origin = new THREE.Vector3();
  const quat = new THREE.Quaternion();
  controller.getWorldPosition(origin);
  controller.getWorldQuaternion(quat);
  const direction = new THREE.Vector3(0, 0, -1).applyQuaternion(quat);

  const raycaster = new THREE.Raycaster(origin, direction, 0, 10);
  const result = getUpgradeCardHit(raycaster);

  if (result) {
    selectUpgradeAndAdvance(result.upgrade, result.hand);
  }
}

// ============================================================
//  ENEMY SPAWNING
// ============================================================
function spawnEnemyWave(dt) {
  if (game.state !== State.PLAYING) return;

  const cfg = game._levelConfig;
  if (!cfg) return;

  // Boss level: spawn boss once, no normal waves
  if (cfg.isBoss) {
    if (!getBoss()) {
      const bossId = getRandomBossIdForLevel(game.level);
      if (bossId) spawnBoss(bossId, cfg);
    }
    return;
  }

  game.spawnTimer -= dt;
  if (game.spawnTimer <= 0) {
    game.spawnTimer = cfg.spawnInterval;

    // Don't spawn if we already have enough enemies
    if (getEnemyCount() < 15) {
      const types = cfg.enemyTypes;
      const type = types[Math.floor(Math.random() * types.length)];

      // Calculate vertical spawn angle based on level
      let verticalAngle = 0;
      if (game.level >= 16) verticalAngle = 60;
      else if (game.level >= 11) verticalAngle = 40;
      else if (game.level >= 6) verticalAngle = 20;

      const pos = getSpawnPosition(cfg.airSpawns, verticalAngle);
      spawnEnemy(type, pos, cfg);

      // [Power Outage Update] #7: Spawn sounds for all enemy types
      if (type === 'fast') {
        playFastEnemySpawn();
      } else if (type === 'swarm') {
        playSwarmEnemySpawn();
      } else if (type === 'basic') {
        playBasicEnemySpawn();
      } else if (type === 'tank') {
        playTankEnemySpawn();
      }
    }
  }
}

function updateFastEnemyAlerts(dt, playerPos) {
  const fastEnemies = getFastEnemies();
  fastEnemies.forEach(e => {
    const dist = e.mesh.position.distanceTo(playerPos);
    if (dist < 10) {
      e.alertTimer = (e.alertTimer || 0) - dt;
      if (e.alertTimer <= 0) {
        e.alertTimer = 0.2; // play alert every 0.2s

        // Calculate pan based on enemy position relative to player
        const dx = e.mesh.position.x - playerPos.x;
        const dz = e.mesh.position.z - playerPos.z;
        const angle = Math.atan2(dx, -dz);
        const pan = Math.sin(angle);
        const intensity = 1 - (dist / 10);

        playProximityAlert(pan, intensity);
      }
    }
  });

  // Swarm enemies - more aggressive alerts
  const swarmEnemies = getSwarmEnemies();
  swarmEnemies.forEach(e => {
    const dist = e.mesh.position.distanceTo(playerPos);
    if (dist < 8) {  // Closer range for swarm
      e.alertTimer = (e.alertTimer || 0) - dt;
      if (e.alertTimer <= 0) {
        e.alertTimer = 0.15; // More frequent alerts

        const dx = e.mesh.position.x - playerPos.x;
        const dz = e.mesh.position.z - playerPos.z;
        const angle = Math.atan2(dx, -dz);
        const pan = Math.sin(angle);
        const intensity = 1 - (dist / 8);

        playSwarmProximityAlert(pan, intensity);
      }
    }
  });
}

// ============================================================
//  RENDER / UPDATE LOOP
// ============================================================
function render(timestamp) {
  // Stats update
  if (typeof stats !== 'undefined' && stats) {
    if (window.debugPerfMonitor) {
      stats.dom.style.display = 'block';
      stats.update();
    } else {
      stats.dom.style.display = 'none';
    }
  }

  // Reset lightning pool
  lightningPoolIndex = 0;
  lightningBoltPool.forEach(b => b.visible = false);

  frameCount++;
  const now = timestamp || performance.now();
  const rawDt = Math.min((now - lastTime) / 1000, 0.1);
  lastTime = now;

  // Apply bullet-time slow-mo and ramp-out (use raw dt)
  if (slowMoRampOut) {
    slowMoRampOutTimer -= rawDt;
    if (slowMoRampOutTimer <= 0) {
      slowMoRampOut = false;
      timeScale = 1.0;
    } else {
      timeScale = 0.2 + (1 - slowMoRampOutTimer / SLOW_MO_RAMP_OUT_DURATION) * 0.8;
    }
  } else if (slowMoActive) {
    slowMoDuration -= rawDt;
    if (slowMoDuration <= 0) {
      slowMoActive = false;
      slowMoSoundPlayed = false;
      timeScale = 1.0;
      console.log('[bullet-time] ENDED');
    } else {
      timeScale = 0.2;
    }
  } else {
    timeScale = 1.0;
  }

  const dt = rawDt * timeScale;  // Scaled time for game logic

  const st = game.state;

  // ── Title screen ──
  if (st === State.TITLE) {
    updateTitle(now);
    
    // Button hover updates
    for (let i = 0; i < controllers.length; i++) {
      const ctrl = controllers[i];
      if (!ctrl) continue;
      const origin = new THREE.Vector3();
      const quat = new THREE.Quaternion();
      ctrl.getWorldPosition(origin);
      ctrl.getWorldQuaternion(quat);
      const dir = new THREE.Vector3(0, 0, -1).applyQuaternion(quat);
      const rc = new THREE.Raycaster(origin, dir, 0, 10);
      updateAllButtonHovers(rc, now, rawDt, playButtonHoverSound, playButtonClickSound);
      break; // Only need one controller for hover
    }
    
    if (typeof window !== 'undefined' && window.debugJumpToLevel) {
      const level = window.debugJumpToLevel;
      window.debugJumpToLevel = null;
      debugJumpToLevel(level);
    }
  }

  // ── Playing ──
  else if (st === State.PLAYING) {
    spawnEnemyWave(dt);

    // Full-auto shooting / Lightning beams
    for (let i = 0; i < 2; i++) {
      if (controllerTriggerPressed[i]) {
        const hand = i === 0 ? 'left' : 'right';
        const stats = getWeaponStats(game.upgrades[hand]);

        if (stats.chargeShot) {
          if (chargeShotStartTime[i] === null) chargeShotStartTime[i] = now;
        } else if (stats.lightning) {
          updateLightningBeam(controllers[i], i, stats, dt);
        } else {
          shootWeapon(controllers[i], i);
        }
      } else {
        if (chargeShotStartTime[i] !== null) chargeShotStartTime[i] = null;
        if (lightningBeams[i]) {
          scene.remove(lightningBeams[i]);
          lightningBeams[i] = null;
        }
      }
    }

    // Fast enemy proximity alerts
    updateFastEnemyAlerts(dt, camera.position);

    // Update enemies
    const playerPos = camera.position.clone();

    // If in slow-mo, check whether all enemies in trigger range are gone → ramp out over 0.5s + reverse sound
    if (slowMoActive && !slowMoRampOut) {
      const enemiesForRamp = getEnemies();
      const anyNear = enemiesForRamp.some(e => e.mesh.position.distanceTo(playerPos) < SLOW_MO_TRIGGER_DIST);
      if (!anyNear) {
        slowMoActive = false;
        slowMoSoundPlayed = false;
        slowMoRampOut = true;
        slowMoRampOutTimer = SLOW_MO_RAMP_OUT_DURATION;
        playSlowMoReverseSound();
        console.log('[bullet-time] RAMP OUT — enemies cleared');
      }
    }

    // Check for near-miss bullet-time trigger
    if (!slowMoActive && !slowMoRampOut) {
      const enemies = getEnemies();
      for (const e of enemies) {
        const dist = e.mesh.position.distanceTo(playerPos);
        if (dist < SLOW_MO_TRIGGER_DIST) {
          slowMoActive = true;
          slowMoDuration = 2.5;
          console.log('[bullet-time] ACTIVATED!');
          break;
        }
      }
      if (slowMoActive && !slowMoSoundPlayed) {
        playSlowMoSound();
        slowMoSoundPlayed = true;
      }
    }

    const collisions = updateEnemies(dt, now, playerPos);

    // Boss update and health bar
    const boss = getBoss();
    if (boss) {
      updateBoss(dt, now, playerPos);
      updateBossMinions(dt, playerPos);
      // [Power Outage Update] #4: Pass boss mesh for world-space health bar positioning
      showBossHealthBar(boss.hp, boss.maxHp, boss.phases);
      updateBossHealthBar(boss.hp, boss.maxHp, boss.phases, boss.mesh);
    } else {
      hideBossHealthBar();
    }

    // Handle enemy collisions with player
    collisions.forEach(index => {
      destroyEnemy(index);
      const dead = damagePlayer(1);
      triggerHitFlash();
      playDamageSound();

      // Trigger camera shake - commented out (doesn't work in VR)
      // cameraShake = 0.5;  // 0.5 second shake duration
      // cameraShakeIntensity = 0.05;  // shake magnitude
      // originalCameraPos.copy(camera.position);

      // Trigger floor flash
      floorFlashing = true;
      floorFlashTimer = 0.5;

      slowMoActive = false;
      slowMoRampOut = false;
      timeScale = 1.0;
      console.log(`[damage] Player hit! Health: ${game.health}`);
      if (dead) {
        endGame(false);
      }
    });

    // Boss collision with player
    if (boss && boss.mesh.position.distanceTo(playerPos) < 1.5) {
      const dead = damagePlayer(2);
      triggerHitFlash();
      playDamageSound();
      // cameraShake = 0.6;
      // cameraShakeIntensity = 0.06;
      // originalCameraPos.copy(camera.position);
      floorFlashing = true;
      floorFlashTimer = 0.5;
      slowMoActive = false;
      slowMoRampOut = false;
      timeScale = 1.0;
      if (dead) endGame(false);
    }

    // Boss projectiles
    updateBossProjectiles(dt, now, playerPos);
    const bossProjs = getBossProjectiles();
    for (let i = bossProjs.length - 1; i >= 0; i--) {
      const proj = bossProjs[i];
      if (proj.hitPlayer) {
        scene.remove(proj.mesh);
        proj.mesh.geometry.dispose();
        proj.mesh.material.dispose();
        bossProjs.splice(i, 1);

        const dead = damagePlayer(1);
        triggerHitFlash();
        playDamageSound();
        // cameraShake = 0.4;
        // cameraShakeIntensity = 0.04;
        // originalCameraPos.copy(camera.position);
        floorFlashing = true;
        floorFlashTimer = 0.5;
        if (dead) endGame(false);
      }
    }

    // Check for DoT damage on enemies
    const enemies = getEnemies();
    enemies.forEach((e, i) => {
      if (e._lastDoT) {
        const colorMap = { fire: '#ff4400', shock: '#4488ff', freeze: '#88ccff' };
        spawnDamageNumber(e.mesh.position, e._lastDoT.damage, colorMap[e._lastDoT.type] || '#ffffff');
        delete e._lastDoT;

        if (e.hp <= 0) {
          const destroyData = destroyEnemy(i);
          if (destroyData) {
            game.kills++;
            game.totalKills++;
            game.killsWithoutHit++;
            addScore(destroyData.scoreValue);

            const cfg = game._levelConfig;
            if (cfg && game.kills >= cfg.killTarget) {
              completeLevel();
            }
          }
        }
      }
    });

    // Update HUD (staggered — every 3rd frame to reduce geometry recreation cost)
    game._levelConfig = getLevelConfig();
    game._combo = getComboMultiplier();
    checkComboIncrease(game._combo, camera.position, playUpgradeSound);
    if (frameCount % 3 === 0) {
      updateHUD(game);
    }
  }

  // ── Level complete (cooldown before upgrade screen) ──
  else if (st === State.LEVEL_COMPLETE) {
    game.stateTimer -= dt;
    if (game.stateTimer <= 0) {
      showUpgradeScreen();
    }
  }

  // [Power Outage Update] #6: Slow-mo level complete finale
  else if (st === State.LEVEL_COMPLETE_SLOWMO) {
    game.stateTimer -= rawDt; // Use raw time, not scaled
    timeScale = 0.15; // Maintain slow-mo
    
    // After ~1.5s: explode all remaining enemies
    // Fix: Collect all enemies first, then destroy in reverse order to avoid index issues
    if (game.stateTimer <= 1.5 && !game._slowMoExplosionsDone) {
      game._slowMoExplosionsDone = true;
      const enemies = getEnemies();
      // Process from end to beginning to avoid index shifting
      for (let i = enemies.length - 1; i >= 0; i--) {
        const e = enemies[i];
        // Trigger explosion effect
        spawnDamageNumber(e.mesh.position, e.hp || 10, '#ff8800');
        playExplosionSound();
        destroyEnemy(i);
      }
    }
    
    // [Power Outage Update] #9: Show highlighted kill counter during slow-mo
    if (frameCount % 3 === 0 && game._completedKills !== undefined) {
      // Create highlighted HUD data
      const highlightedGame = {
        ...game,
        kills: game._completedKills,
        _levelConfig: { ...game._levelConfig, killTarget: game._completedKillTarget },
        _highlighted: true
      };
      updateHUD(highlightedGame);
    }
    
    // After 3s: restore time and transition to LEVEL_COMPLETE
    if (game.stateTimer <= 0) {
      timeScale = 1.0;
      game._slowMoExplosionsDone = false;
      clearAllEnemies();
      hideLevelComplete();
      game.state = State.LEVEL_COMPLETE;
      game.stateTimer = 0.5;
      showLevelComplete(game.level, camera.position);
    }
  }

  // [Power Outage Update] #3: Boss alert sequence
  else if (st === State.BOSS_ALERT) {
    game.stateTimer -= rawDt;
    updateBossAlert(now);
    
    // Play alert sound periodically
    if (game.stateTimer > 1.0 && game.stateTimer < 2.5 && !game._alertSound2) {
      game._alertSound2 = true;
      playBossAlertSound();
    }
    
    // After 3s: transition to PLAYING, spawn boss (music already started)
    if (game.stateTimer <= 0) {
      hideBossAlert();
      game._alertSound2 = false;
      game.state = State.PLAYING;
      showHUD();
      // Boss music already started in advanceLevelAfterUpgrade
      console.log(`[game] Boss fight starting at level ${game.level}`);
    }
  }

  // ── Upgrade selection ──
  else if (st === State.UPGRADE_SELECT) {
    // [Power Outage Update] #9: Hide HUD during upgrade selection
    hideHUD();
    upgradeSelectionCooldown = Math.max(0, upgradeSelectionCooldown - dt);
    updateUpgradeCards(now, upgradeSelectionCooldown);

    // Show and update blaster displays
    blasterDisplays.forEach((display, i) => {
      if (display) {
        display.visible = true;
        if (display.userData.needsUpdate) {
          updateBlasterDisplay(display, i);
        }
        animateBlasterScanLines(display);
      }
    });

    // Button hover updates
    for (let i = 0; i < controllers.length; i++) {
      const ctrl = controllers[i];
      if (!ctrl) continue;
      const origin = new THREE.Vector3();
      const quat = new THREE.Quaternion();
      ctrl.getWorldPosition(origin);
      ctrl.getWorldQuaternion(quat);
      const dir = new THREE.Vector3(0, 0, -1).applyQuaternion(quat);
      const rc = new THREE.Raycaster(origin, dir, 0, 10);
      updateAllButtonHovers(rc, now, dt, playButtonHoverSound, playButtonClickSound);
      break;
    }
  }

  // ── Game over / Victory ──
  else if (st === State.GAME_OVER || st === State.VICTORY) {
    updateEndScreen(now);
    gameOverCooldown = Math.max(0, gameOverCooldown - dt);
  }

  // ── Name entry (keyboard hover) ──
  else if (st === State.NAME_ENTRY) {
    for (let i = 0; i < controllers.length; i++) {
      const ctrl = controllers[i];
      if (!ctrl) continue;
      const origin = new THREE.Vector3();
      const quat = new THREE.Quaternion();
      ctrl.getWorldPosition(origin);
      ctrl.getWorldQuaternion(quat);
      const dir = new THREE.Vector3(0, 0, -1).applyQuaternion(quat);
      const rc = new THREE.Raycaster(origin, dir, 0, 10);
      updateKeyboardHover(rc);
      updateAllButtonHovers(rc, now, rawDt, playButtonHoverSound, playButtonClickSound);
      break;  // Only need one controller for hover
    }
  }

  // ── Scoreboard / Regional Scores ──
  else if (st === State.SCOREBOARD || st === State.REGIONAL_SCORES) {
    for (let i = 0; i < controllers.length; i++) {
      const ctrl = controllers[i];
      if (!ctrl) continue;
      const origin = new THREE.Vector3();
      const quat = new THREE.Quaternion();
      ctrl.getWorldPosition(origin);
      ctrl.getWorldQuaternion(quat);
      const dir = new THREE.Vector3(0, 0, -1).applyQuaternion(quat);
      const rc = new THREE.Raycaster(origin, dir, 0, 10);
      updateAllButtonHovers(rc, now, rawDt, playButtonHoverSound, playButtonClickSound);
      break;
    }
  }

  // ── Country Select ──
  else if (st === State.COUNTRY_SELECT) {
    for (let i = 0; i < controllers.length; i++) {
      const ctrl = controllers[i];
      if (!ctrl) continue;
      const origin = new THREE.Vector3();
      const quat = new THREE.Quaternion();
      ctrl.getWorldPosition(origin);
      ctrl.getWorldQuaternion(quat);
      const dir = new THREE.Vector3(0, 0, -1).applyQuaternion(quat);
      const rc = new THREE.Raycaster(origin, dir, 0, 10);
      updateAllButtonHovers(rc, now, rawDt, playButtonHoverSound, playButtonClickSound);
      break;
    }
  }

  // ── Camera shake on damage ── COMMENTED OUT (doesn't work in VR)
  // if (cameraShake > 0) {
  //   cameraShake -= rawDt;
  //   if (cameraShake <= 0) {
  //     cameraShake = 0;
  //   } else {
  //     // Apply random shake offset
  //     const shake = cameraShakeIntensity * (cameraShake / 0.5);  // Fade out over duration
  //     camera.position.x += (Math.random() - 0.5) * shake;
  //     camera.position.y += (Math.random() - 0.5) * shake;
  //     camera.position.z += (Math.random() - 0.5) * shake;
  //   }
  // }


  // ── Floor damage flash ──
  if (floorFlashing && floorMaterial) {
    floorFlashTimer -= rawDt;
    if (floorFlashTimer <= 0) {
      floorFlashing = false;
      floorMaterial.color.copy(FLOOR_BASE_COLOR);
    } else {
      // Lerp from red/white back to base color
      const t = floorFlashTimer / 0.5;  // 0.5s flash duration
      const flashColor = new THREE.Color(0xff2222);  // Bright red
      floorMaterial.color.lerpColors(FLOOR_BASE_COLOR, flashColor, t);
    }
  }
  
  // ── Low health pulsing floor (1/2 heart = health === 1) ──
  if (game.health === 1 && game.state === State.PLAYING) {
    if (!lowHealthAlertActive) {
      lowHealthAlertActive = true;
      lowHealthPulseTimer = 0;
      lowHealthSoundTimer = 0;
    }
    
    lowHealthPulseTimer += rawDt * LOW_HEALTH_PULSE_SPEED * Math.PI;
    lowHealthSoundTimer += rawDt * 1000;
    
    // Pulse floor color between base and red
    if (floorMaterial && !floorFlashing) {
      const pulseT = (Math.sin(lowHealthPulseTimer) + 1) / 2; // 0 to 1
      const pulseColor = new THREE.Color(0xff2222);
      floorMaterial.color.lerpColors(FLOOR_BASE_COLOR, pulseColor, pulseT * 0.5);
    }
    
    // Play alert sound every 3 seconds
    if (lowHealthSoundTimer >= LOW_HEALTH_SOUND_INTERVAL) {
      lowHealthSoundTimer = 0;
      playLowHealthAlertSound();
    }
  } else {
    // Reset low health state when health is restored or game state changes
    if (lowHealthAlertActive) {
      lowHealthAlertActive = false;
      if (floorMaterial && !floorFlashing) {
        floorMaterial.color.copy(FLOOR_BASE_COLOR);
      }
    }
  }

  // ── Environment: sun and ominous horizon scale with level ──
  const envLevel = game.state === State.PLAYING ? game.level : 1;
  if (sunMeshRef && sunGlowRef) {
    const sunScale = 1 + (envLevel - 1) * 0.04;
    sunMeshRef.scale.setScalar(sunScale);
    sunGlowRef.scale.setScalar(sunScale);
  }
  if (ominousRef) {
    if (envLevel >= 10) {
      const t = Math.min(1, (envLevel - 10) / 6); // 0 at 10, 1 at 16
      ominousRef.visible = true;
      ominousRef.material.opacity = 0.25 + t * 0.6;
      ominousRef.scale.setScalar(0.5 + t * 1.2);
    } else {
      ominousRef.visible = false;
    }
  }

  // ── Universal updates ──
  updateProjectiles(dt);
  updateExplosions(dt, now);
  updateExplosionVisuals(now);
  updateDamageNumbers(dt, now);
  updateComboPopups(dt, now);
  updateHitFlash(rawDt);  // Use rawDt so flash works during bullet-time
  // [Power Outage Update] #3, #8: Update boss alert and kills remaining message
  updateBossAlert(now);
  updateKillsRemainingMessage(now);
  updateFPS(now, {
    perfMonitor: typeof window !== 'undefined' && window.debugPerfMonitor,
    frameTimeMs: rawDt * 1000,
  });

  // Music visualizer (DISABLED - causing FPS drops)
  // if (now % 3 < 1) {
  //   updateMountainVisualizer();
  // }

  // Hide scanlines overlay in VR — it creates a dark box that follows the head and obscures the view
  const scanlinesEl = document.getElementById('scanlines');
  if (scanlinesEl) scanlinesEl.style.display = renderer.xr.isPresenting ? 'none' : '';

  renderer.render(scene, camera);
}

// ============================================================
//  MUSIC VISUALIZER - COMMENTED OUT
// ============================================================
// function updateMountainVisualizer() {
//   const freqData = getMusicFrequencyData();
//   if (!freqData || mountainLines.length === 0) return;
//
//   mountainLines.forEach((layer, layerIndex) => {
//     const peaks = mountainBasePeaks[layerIndex];
//     if (!peaks) return;
//
//     const points = [new THREE.Vector3(-100, 0, layer.z)];
//
//     peaks.forEach((peak, i) => {
//       // Map frequency bins to peaks (spread across spectrum)
//       const binIndex = Math.floor((i / peaks.length) * freqData.length);
//       const amplitude = freqData[binIndex] / 255;  // Normalize 0-1
//
//       // Subtle height modulation (max 2 units up/down)
//       const heightMod = amplitude * 2 * (layerIndex === 0 ? 0.8 : 1.2);
//       const newY = peak.baseY + heightMod;
//
//       points.push(new THREE.Vector3(peak.x, newY, layer.z));
//     });
//
//     points.push(new THREE.Vector3(100, 0, layer.z));
//
//     // Update line geometry
//     layer.geometry.setFromPoints(points);
//     layer.geometry.attributes.position.needsUpdate = true;
//   });
// }



// ============================================================
//  WINDOW RESIZE
// ============================================================
function onWindowResize() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
}
