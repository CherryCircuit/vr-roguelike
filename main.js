// ============================================================
//  SPACEOMICIDE — Main Game Controller
//  Phase 1: Core game loop with levels, enemies, upgrades, HUD
// ============================================================

import * as THREE from 'three';
import { VRButton } from 'three/addons/webxr/VRButton.js';

import { State, game, resetGame, getLevelConfig, getBossTier, getRandomBossIdForLevel, addScore, registerAccuracyHit, registerAccuracyMiss, damagePlayer, addUpgrade, setMainWeapon, setAltWeapon, getNextUpgradeHand, needsMainWeaponChoice, LEVELS, loadDebugSettings, saveDebugSettings, startGameWithSeed, getBiomeForLevel } from './game.js?v=20260308-2337';
import { getRandomUpgrades, getRandomSpecialUpgrades, getUpgradeDef, getWeaponStats, MAIN_WEAPONS, ALT_WEAPONS, getMainWeapon, getAltWeapon } from './weapons.js?v=20260308-2337';
import {
  playShoothSound, playHitSound, playExplosionSound, playDamageSound,
  playFastEnemySpawn, playSwarmEnemySpawn, playBasicEnemySpawn, playTankEnemySpawn,
  playBossSpawn, playMenuClick, playErrorSound, playBuckshotSound,
  playProximityAlert, playSwarmProximityAlert, playUpgradeSound,
  playSlowMoSound, playSlowMoReverseSound,
  startLightningSound, stopLightningSound,
  startLowHealthWarningSound, stopLowHealthWarningSound,
  playMusic, playBossMusic, stopMusic, fadeOutMusic, getMusicFrequencyData
} from './audio.js?v=20260308-2337';
import {
  initEnemies, spawnEnemy, updateEnemies, updateExplosions, getEnemyMeshes,
  getEnemyByMesh, clearAllEnemies, getEnemyCount, hitEnemy, destroyEnemy,
  applyEffects, getSpawnPosition, getEnemies, getFastEnemies, getSwarmEnemies,
  getBoss, spawnBoss, hitBoss, updateBoss, clearBoss, getBossMinionMeshes, getBossMinionByMesh, hitBossMinion, updateBossMinions,
  updateBossProjectiles, getBossProjectiles, updateStatusBubbles, setPlayerForward
} from './enemies.js?v=20260308-2337';
import { setActiveStasisFields, getStasisSlowFactor } from './stasis.js?v=20260308-2337';
import {
  initHUD, showTitle, hideTitle, updateTitle, showHUD, hideHUD, updateHUD,
  showLevelComplete, hideLevelComplete, showUpgradeCards, hideUpgradeCards,
  updateUpgradeCards, getUpgradeCardHit, showGameOver, showVictory, updateEndScreen,
  hideGameOver, triggerHitFlash, updateHitFlash, spawnDamageNumber, spawnCritIndicator, updateDamageNumbers, updateFPS,
  showBossHealthBar, hideBossHealthBar, updateBossHealthBar,
  getTitleButtonHit, showNameEntry, hideNameEntry, getNameEntryHit, updateKeyboardHover, getNameEntryName,
  showScoreboard, hideScoreboard, getScoreboardHit, updateScoreboardScroll,
  showCountrySelect, hideCountrySelect, getCountrySelectHit,
  showDebugJumpScreen, getDebugJumpHit,
  showDebugMenu, hideDebugMenu, getDebugMenuHit, showReadyScreen, hideReadyScreen, updateReadyCountdownText, updateTitleDebugIndicator,
  updateHUDHover
} from './hud.js?v=20260308-2337';

import {
  initDesktopControls, update as updateDesktopControls, getWeaponState,
  getPosition, getAimRaycaster, getVirtualController,
  isLocked, isEnabled as isDesktopEnabled
} from './desktop-controls.js?v=20260308-2337';
import {
  submitScore, fetchTopScores, fetchScoresByCountry, fetchScoresByContinent,
  isNameClean, COUNTRIES, CONTINENTS,
  getStoredCountry, setStoredCountry, getStoredName, setStoredName
} from './scoreboard.js?v=20260308-2337';
import { getThemeForLevel, initAmbientParticles, updateAmbientParticles } from './scenery.js?v=20260308-2337';
import { getBiomePool } from './seed.js?v=20260308-2337';

// Expose game state to window for debugging/testing
window.State = State;
window.game = game;

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

function getCountryDisplayLabel() {
  const code = getStoredCountry();
  if (!code) return 'COUNTRY: NOT SET';
  const country = COUNTRIES.find(c => c.code === code);
  const label = country ? country.name : code;
  let flag = '';
  try {
    flag = String.fromCodePoint(...[...code.toUpperCase()].map(c => 0x1F1E6 + c.charCodeAt(0) - 65));
  } catch (e) {
    flag = '';
  }
  const prefix = flag ? `${flag} ` : '';
  return `COUNTRY: ${prefix}${label}`;
}

// ── Module State ───────────────────────────────────────────
let scene, camera, renderer;
const controllers = [];
const controllerTriggerPressed = [false, false];
const projectiles = [];
let lastTime = 0;
let frameCount = 0;  // For staggering updates

// Ready screen countdown
const READY_COUNTDOWN_SECONDS = 3;
let readyCountdownActive = false;
let readyCountdownStartTime = 0;
let readyCountdownLastValue = READY_COUNTDOWN_SECONDS;

// ALT weapon state
const activeShields = [];  // { mesh, hand, expiresAt }
const activeLaserMines = [];  // { mesh, armedAt, isArmed, position, triggered, laserMesh, autoDetonateAt }
const activeStasisFields = [];  // { mesh, position, radius, expiresAt, slowFactor }
const activePlasmaOrbs = [];  // { mesh, velocity, damage, aoeRadius, expiresAt, detonatable }

// Phase Dash afterimages
const activePhaseDashAfterimages = [];  // { mesh, position, expiresAt, damage, aoeRadius }

// Laser mine passive tracking
let playerLastPosition = new THREE.Vector3();
let playerStillnessStartTime = null;
let laserMineSpawnCooldown = 0;

// PERFORMANCE: Hard cap on active projectiles to prevent accumulation
const MAX_PROJECTILES = 50;

// PERFORMANCE: Projectile pool for reuse (avoid creating geometry per shot)
const projectilePool = [];
const PROJECTILE_POOL_SIZE = 60;

// PHYSICS DEATH SYSTEM: Voxel pool for death explosions
const voxelPool = [];
const activeVoxels = [];
const VOXEL_POOL_SIZE = 200;
const MAX_ACTIVE_VOXELS = 200;

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
let gridHelper = null;
let starsRef = null;
let horizonRingRef = null;
let horizonInnerRingRef = null;
let auroraRef = null;
let atmosphereRef = null;
let currentTheme = null;
let biomePropsGroup = null;
let biomePropsBiome = null;
const biomePropFloaters = [];
let biomeSceneGroup = null;
let biomeSceneBiome = null;


let environmentFade = 0;
let environmentFadeState = null;
const environmentFadeTargets = [];
let levelFadeReady = false;

// Floor damage flash
let floorMaterial = null;
let floorBaseColor = new THREE.Color(0x220044);
let floorFlashTimer = 0;
let floorFlashing = false;

// Low health warning
let lowHealthWarningActive = false;
let lowHealthPulseTimer = 0;

// Upgrade selection
let upgradeSelectionCooldown = 0;
let pendingUpgrades = [];

// Game over cooldown
let gameOverCooldown = 0;

// Bullet-time slow-mo
let slowMoActive = false;
let slowMoDuration = 0;
let slowMoSoundPlayed = false;
let slowMoRampOut = false;       // Ramp timeScale back to 1 over 0.5s when nearby enemies cleared
let slowMoRampOutTimer = 0;
const SLOW_MO_TRIGGER_DIST = 1.2;  // Only trigger when enemies are too close
const SLOW_MO_RAMP_OUT_DURATION = 0.5;
const SLOW_MO_DURATION = 1.4;
const SLOW_MO_COOLDOWN = 4.0;
let slowMoCooldown = 0;
let timeScale = 1.0;
let slowMoTriggerEnemyIds = new Set();

// Accuracy bonus shot tracking
let accuracyShotId = 0;
const accuracyShots = new Map();

function startAccuracyShot(pelletCount) {
  const shotId = ++accuracyShotId;
  accuracyShots.set(shotId, { remaining: pelletCount, hit: false });
  return shotId;
}

function markAccuracyHit(shotId) {
  const shot = accuracyShots.get(shotId);
  if (!shot || shot.hit) return;
  shot.hit = true;
  registerAccuracyHit();
}

function resolveAccuracyPellet(shotId) {
  const shot = accuracyShots.get(shotId);
  if (!shot) return;
  shot.remaining -= 1;
  if (shot.remaining <= 0) {
    accuracyShots.delete(shotId);
    if (!shot.hit) registerAccuracyMiss();
  }
}

// Camera shake on damage
let cameraShake = 0;
let cameraShakeIntensity = 0;
const originalCameraPos = new THREE.Vector3();

// Screen shake system
let screenShakeIntensity = 0;
let screenShakeTime = 0;

// Decoy system
const activeDecoys = [];
const MAX_DECOYS = 3;

// Black hole system
const activeBlackHoles = [];
const activeMines = [];
const MAX_BLACK_HOLES = 2;
const MAX_MINES = 5;

// Tether harpoon system
const activeTethers = [];
const MAX_TETHERS = 2;

// Nanite swarm system
const activeNaniteSwarms = [];
const MAX_NANITE_SWARMS = 2;

// Reflector drone system
const activeReflectorDrones = [];
const MAX_REFLECTOR_DRONES = 2;

// ── Bootstrap ──────────────────────────────────────────────
init();

// ============================================================
//  INITIALISATION
// ============================================================
function init() {
  console.log('[SPACEOMICIDE] Initialising...');

  // Load debug settings from localStorage
  loadDebugSettings();

  // Scene — use black background for Adreno GPU "Fast clear" optimization on Quest
  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x000000);
  scene.fog = new THREE.FogExp2(0x000000, 0.012);

  // Camera
  camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.1, 1000);
  camera.position.set(0, 1.6, 0);

  // Renderer — optimized for Quest performance
  renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));  // Cap pixel ratio for perf
  renderer.xr.enabled = true;
  // No tone mapping — we use MeshBasicMaterial so ACES adds shader cost with no benefit
  renderer.toneMapping = THREE.NoToneMapping;
  document.body.appendChild(renderer.domElement);

  // VR Button
  const vrButton = VRButton.createButton(renderer);
  document.body.appendChild(vrButton);

  // Don't show "VR NOT AVAILABLE" message - game works in desktop mode
  // Desktop controls will auto-enable if VR isn't available
  if (!navigator.xr) {
    console.warn('[init] WebXR not supported - desktop mode will be enabled');
    if (vrButton && vrButton.parentNode) vrButton.parentNode.removeChild(vrButton);
  } else {
    navigator.xr.isSessionSupported('immersive-vr').then((supported) => {
      if (!supported) {
        console.warn('[init] immersive-vr not supported - desktop mode will be enabled');
        if (vrButton && vrButton.parentNode) vrButton.parentNode.removeChild(vrButton);
      }
    });
  }

  // Build world
  createEnvironment();
  applyThemeForLevel(1);
  applyEnvironmentFade(0);
  setupControllers();

  // Init subsystems
  initEnemies(scene);
  initHUD(camera, scene);

  // PERFORMANCE: Initialize projectile pool
  initProjectilePool();
  
  // PHYSICS DEATH SYSTEM: Initialize voxel pool
  initVoxelPool();
  
  // Set voxel explosion reference for enemies.js
  import('./enemies.js').then(module => {
    module.setVFXReference(spawnVoxelExplosion);
    console.log('[physics-death] Voxel explosion reference set');
  });

  // Set up stasis field reference for shared access
  setActiveStasisFields(activeStasisFields);

  // Desktop controls for non-VR playtesting
  initDesktopControls(scene, camera, renderer);

  // PERFORMANCE: Initialize projectile pool
  initProjectilePool();

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
  gridHelper = new THREE.GridHelper(120, 48, NEON_PINK, 0xff0088);
  if (Array.isArray(gridHelper.material)) {
    gridHelper.material.forEach(m => { m.transparent = true; m.opacity = 0.85; registerFadeMaterial(m); });
  } else {
    gridHelper.material.transparent = true;
    gridHelper.material.opacity = 0.85;
    registerFadeMaterial(gridHelper.material);
  }
  gridHelper.frustumCulled = false;
  scene.add(gridHelper);

  const floorGeo = new THREE.PlaneGeometry(200, 200);
  const floorMat = new THREE.MeshBasicMaterial({ color: floorBaseColor });
  floorMaterial = floorMat;  // Store reference for damage flash
  floorMaterial.userData.floorHeight = -0.01;
  registerFadeMaterial(floorMaterial);
  const floor = new THREE.Mesh(floorGeo, floorMat);
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = -0.01;
  floor.frustumCulled = false;
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
  horizonRingRef = new THREE.Mesh(horizonGeo, horizonMat);
  horizonRingRef.position.set(0, horizonHeight / 2 - 0.5, 0);
  horizonRingRef.renderOrder = -2;
  scene.add(horizonRingRef);
  registerFadeMaterial(horizonRingRef.material);

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
  horizonInnerRingRef = new THREE.Mesh(horizonInnerGeo, horizonInnerMat);
  horizonInnerRingRef.position.set(0, 0.25, 0);
  horizonInnerRingRef.renderOrder = -2;
  scene.add(horizonInnerRingRef);
  registerFadeMaterial(horizonInnerRingRef.material);

  createSun();
  createMountains();
  createStars();
  initAmbientParticles(scene);

  // NOTE: Lights removed — all materials are MeshBasicMaterial (unlit)
  // so lights have zero visual effect but cost GPU overhead.
  // If PBR materials are added later, re-add lights here.
}

function registerFadeMaterial(material) {
  if (!material) return;
  const baseOpacity = material.opacity !== undefined ? material.opacity : 1;
  material.transparent = true;
  material.__fadeBase = baseOpacity;
  environmentFadeTargets.push(material);
}

// ── Biome Props ───────────────────────────────────────────
function clearBiomeProps() {
  if (!biomePropsGroup) return;
  scene.remove(biomePropsGroup);
  biomePropsGroup.traverse((child) => {
    if (child.geometry) child.geometry.dispose();
    if (child.material) child.material.dispose();
  });
  biomePropsGroup = null;
  biomePropsBiome = null;
  biomePropFloaters.length = 0;
}

function clearBiomeScene() {
  if (!biomeSceneGroup) return;
  scene.remove(biomeSceneGroup);
  biomeSceneGroup.traverse((child) => {
    if (child.geometry) child.geometry.dispose();
    if (child.material) {
      if (Array.isArray(child.material)) child.material.forEach(m => m.dispose());
      else child.material.dispose();
    }
  });
  biomeSceneGroup = null;
  biomeSceneBiome = null;
}

function updateBiomeProps(now, dt) {
  if (!biomePropsGroup && !biomeSceneGroup) return;
  if (biomePropsGroup && biomePropsGroup.userData && typeof biomePropsGroup.userData.update === 'function') {
    biomePropsGroup.userData.update(now, dt);
  }
  if (biomeSceneGroup && biomeSceneGroup.userData && typeof biomeSceneGroup.userData.update === 'function') {
    biomeSceneGroup.userData.update(now, dt);
  }
  biomePropFloaters.forEach((floater) => {
    const { mesh, baseY, amp, speed, phase, rotateSpeed } = floater;
    mesh.position.y = baseY + Math.sin(now * speed + phase) * amp;
    mesh.rotation.y += rotateSpeed * dt;
  });
}

function rebuildBiomeProps(biomeId, theme) {
  if (!scene || !theme || !biomeId) return;
  if (biomePropsGroup && biomePropsBiome === biomeId) return;

  clearBiomeProps();

  if (theme.hideBaseEnv) {
    return;
  }

  biomePropsGroup = new THREE.Group();
  biomePropsGroup.name = `biome-props-${biomeId}`;
  scene.add(biomePropsGroup);
  biomePropsBiome = biomeId;

  const primary = new THREE.Color(theme.mountainWire);
  const secondary = new THREE.Color(theme.gridColor);
  const accent = new THREE.Color(theme.sunGlowColor);

  const makeMat = (color, options = {}) => {
    const mat = new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity: options.opacity ?? 0.75,
      blending: options.blending ?? THREE.AdditiveBlending,
      depthWrite: false,
      wireframe: options.wireframe ?? false,
    });
    registerFadeMaterial(mat);
    return mat;
  };

  const addFloatingPlatform = (mesh, baseY, amp, speed, rotateSpeed) => {
    biomePropFloaters.push({
      mesh,
      baseY,
      amp,
      speed,
      phase: Math.random() * Math.PI * 2,
      rotateSpeed,
    });
  };

  const addSidePillars = ({
    count,
    radiusTop,
    radiusBottom,
    height,
    xOffset,
    zStart,
    zStep,
    material,
    segments = 10,
    tilt = 0,
  }) => {
    const geo = new THREE.CylinderGeometry(radiusTop, radiusBottom, 1, segments, 1);
    for (let i = 0; i < count; i++) {
      const z = zStart + i * zStep;
      [-1, 1].forEach((side) => {
        const pillar = new THREE.Mesh(geo, material);
        pillar.scale.set(1, height, 1);
        pillar.position.set(side * xOffset, height * 0.5, z);
        pillar.rotation.z = tilt * side;
        biomePropsGroup.add(pillar);
      });
    }
  };

  const addArches = ({
    count,
    radius,
    tube,
    y,
    zStart,
    zStep,
    material,
    tilt = 0,
  }) => {
    const geo = new THREE.TorusGeometry(1, tube, 10, 32, Math.PI);
    for (let i = 0; i < count; i++) {
      const z = zStart + i * zStep;
      const arch = new THREE.Mesh(geo, material);
      arch.scale.set(radius, radius, radius);
      arch.position.set(0, y, z);
      arch.rotation.x = Math.PI;
      arch.rotation.z = tilt * (i % 2 === 0 ? 1 : -1);
      biomePropsGroup.add(arch);
    }
  };

  const addRectArches = ({
    count,
    width,
    height,
    depth,
    thickness,
    y,
    zStart,
    zStep,
    material,
  }) => {
    const legGeo = new THREE.BoxGeometry(thickness, height, depth);
    const topGeo = new THREE.BoxGeometry(width + thickness * 2, thickness, depth);
    for (let i = 0; i < count; i++) {
      const z = zStart + i * zStep;
      const left = new THREE.Mesh(legGeo, material);
      const right = new THREE.Mesh(legGeo, material);
      const top = new THREE.Mesh(topGeo, material);
      left.position.set(-width * 0.5, y + height * 0.5, z);
      right.position.set(width * 0.5, y + height * 0.5, z);
      top.position.set(0, y + height + thickness * 0.5, z);
      biomePropsGroup.add(left, right, top);
    }
  };

  const addPlatforms = ({
    count,
    size,
    thickness,
    y,
    zStart,
    zStep,
    xSpread,
    material,
    platformType = 'box',
  }) => {
    const geo = platformType === 'disc'
      ? new THREE.CylinderGeometry(1, 1, thickness, 10, 1)
      : platformType === 'hex'
      ? new THREE.CylinderGeometry(1, 1, thickness, 6, 1)
      : new THREE.BoxGeometry(1, thickness, 1);

    for (let i = 0; i < count; i++) {
      const z = zStart + i * zStep;
      const x = (Math.random() - 0.5) * xSpread;
      const platform = new THREE.Mesh(geo, material);
      platform.scale.set(size, 1, size);
      platform.position.set(x, y, z);
      platform.rotation.y = Math.random() * Math.PI * 2;
      biomePropsGroup.add(platform);
      addFloatingPlatform(platform, y, 0.35 + Math.random() * 0.25, 0.001 + Math.random() * 0.0015, 0.15 + Math.random() * 0.25);
    }
  };

  switch (biomeId) {
    case 'hellscape': {
      const pillarMat = makeMat(primary, { opacity: 0.8 });
      addSidePillars({
        count: 4,
        radiusTop: 0.4,
        radiusBottom: 1.1,
        height: 11,
        xOffset: 14,
        zStart: -18,
        zStep: -22,
        material: pillarMat,
        tilt: 0.1,
      });
      addArches({ count: 1, radius: 7, tube: 0.18, y: 7.5, zStart: -50, zStep: -30, material: makeMat(accent, { opacity: 0.5 }) });
      addPlatforms({ count: 2, size: 5.5, thickness: 0.35, y: 4.2, zStart: -20, zStep: -28, xSpread: 10, material: makeMat(accent, { opacity: 0.65 }), platformType: 'box' });
      break;
    }
    case 'ocean_floor': {
      addSidePillars({ count: 5, radiusTop: 0.35, radiusBottom: 0.5, height: 12, xOffset: 13, zStart: -16, zStep: -18, material: makeMat(primary, { opacity: 0.7 }) });
      addArches({ count: 2, radius: 8, tube: 0.14, y: 6.5, zStart: -40, zStep: -30, material: makeMat(secondary, { opacity: 0.6 }) });
      addPlatforms({ count: 3, size: 4.5, thickness: 0.25, y: 3.6, zStart: -22, zStep: -24, xSpread: 12, material: makeMat(accent, { opacity: 0.5 }), platformType: 'disc' });
      break;
    }
    case 'circuit_board': {
      addSidePillars({ count: 5, radiusTop: 0.6, radiusBottom: 0.6, height: 8, xOffset: 13, zStart: -12, zStep: -16, material: makeMat(primary, { opacity: 0.75 }), segments: 4 });
      addRectArches({ count: 2, width: 10, height: 4.5, depth: 1, thickness: 0.4, y: 1.2, zStart: -30, zStep: -28, material: makeMat(secondary, { opacity: 0.6 }) });
      addPlatforms({ count: 3, size: 6, thickness: 0.2, y: 3.2, zStart: -20, zStep: -24, xSpread: 10, material: makeMat(accent, { opacity: 0.65 }) });
      break;
    }
    case 'frozen': {
      addSidePillars({ count: 4, radiusTop: 0.5, radiusBottom: 0.7, height: 10, xOffset: 14, zStart: -18, zStep: -22, material: makeMat(primary, { opacity: 0.7 }), segments: 6 });
      addArches({ count: 2, radius: 7, tube: 0.12, y: 6, zStart: -38, zStep: -30, material: makeMat(secondary, { opacity: 0.5 }) });
      addPlatforms({ count: 3, size: 4.8, thickness: 0.25, y: 3.8, zStart: -20, zStep: -24, xSpread: 11, material: makeMat(accent, { opacity: 0.55 }), platformType: 'hex' });
      break;
    }
    case 'corruption': {
      addSidePillars({ count: 4, radiusTop: 0.35, radiusBottom: 0.8, height: 11, xOffset: 13.5, zStart: -18, zStep: -22, material: makeMat(primary, { opacity: 0.8 }), tilt: 0.15 });
      addArches({ count: 2, radius: 6.5, tube: 0.16, y: 6.5, zStart: -36, zStep: -26, material: makeMat(secondary, { opacity: 0.6 }), tilt: 0.2 });
      addPlatforms({ count: 2, size: 5.2, thickness: 0.3, y: 4.1, zStart: -22, zStep: -28, xSpread: 9, material: makeMat(accent, { opacity: 0.6 }) });
      break;
    }
    case 'digital_rain': {
      addSidePillars({ count: 6, radiusTop: 0.25, radiusBottom: 0.35, height: 13, xOffset: 12.5, zStart: -14, zStep: -16, material: makeMat(primary, { opacity: 0.6 }) });
      addArches({ count: 1, radius: 6.5, tube: 0.1, y: 6.5, zStart: -32, zStep: -30, material: makeMat(secondary, { opacity: 0.45 }) });
      addPlatforms({ count: 2, size: 4.2, thickness: 0.2, y: 3.4, zStart: -18, zStep: -24, xSpread: 9, material: makeMat(accent, { opacity: 0.5 }) });
      break;
    }
    case 'retro_arcade': {
      addSidePillars({ count: 4, radiusTop: 0.6, radiusBottom: 0.6, height: 9, xOffset: 13, zStart: -16, zStep: -18, material: makeMat(primary, { opacity: 0.7 }) });
      addArches({ count: 3, radius: 7, tube: 0.2, y: 6.5, zStart: -34, zStep: -22, material: makeMat(secondary, { opacity: 0.6 }) });
      addPlatforms({ count: 4, size: 4.5, thickness: 0.25, y: 3.6, zStart: -20, zStep: -18, xSpread: 12, material: makeMat(accent, { opacity: 0.6 }) });
      break;
    }
    case 'void_garden': {
      addSidePillars({ count: 3, radiusTop: 0.45, radiusBottom: 0.65, height: 8.5, xOffset: 12.5, zStart: -20, zStep: -24, material: makeMat(primary, { opacity: 0.65 }) });
      addArches({ count: 2, radius: 8, tube: 0.14, y: 7, zStart: -42, zStep: -26, material: makeMat(secondary, { opacity: 0.55 }) });
      addPlatforms({ count: 5, size: 5.2, thickness: 0.25, y: 4.6, zStart: -18, zStep: -18, xSpread: 13, material: makeMat(accent, { opacity: 0.6 }), platformType: 'hex' });
      break;
    }
    case 'neon_rainforest': {
      addSidePillars({ count: 6, radiusTop: 0.35, radiusBottom: 0.6, height: 12, xOffset: 13.5, zStart: -14, zStep: -16, material: makeMat(primary, { opacity: 0.7 }) });
      addArches({ count: 2, radius: 7.5, tube: 0.12, y: 6, zStart: -36, zStep: -26, material: makeMat(secondary, { opacity: 0.5 }) });
      addPlatforms({ count: 3, size: 4.6, thickness: 0.25, y: 3.6, zStart: -20, zStep: -22, xSpread: 12, material: makeMat(accent, { opacity: 0.55 }) });
      break;
    }
    case 'the_stack': {
      addSidePillars({ count: 4, radiusTop: 0.9, radiusBottom: 1.1, height: 9, xOffset: 14, zStart: -16, zStep: -20, material: makeMat(primary, { opacity: 0.65 }), segments: 4 });
      addRectArches({ count: 2, width: 9, height: 3.5, depth: 1.2, thickness: 0.6, y: 1.1, zStart: -32, zStep: -28, material: makeMat(secondary, { opacity: 0.5 }) });
      addPlatforms({ count: 3, size: 5.5, thickness: 0.3, y: 3.2, zStart: -20, zStep: -24, xSpread: 10, material: makeMat(accent, { opacity: 0.55 }) });
      break;
    }
    default: {
      addSidePillars({ count: 4, radiusTop: 0.55, radiusBottom: 0.75, height: 9.5, xOffset: 13, zStart: -16, zStep: -20, material: makeMat(primary, { opacity: 0.7 }) });
      addArches({ count: 2, radius: 7, tube: 0.16, y: 6.5, zStart: -36, zStep: -26, material: makeMat(secondary, { opacity: 0.55 }) });
      addPlatforms({ count: 3, size: 4.8, thickness: 0.25, y: 3.8, zStart: -20, zStep: -22, xSpread: 11, material: makeMat(accent, { opacity: 0.6 }) });
      break;
    }
  }
}

function applyEnvironmentFade(fade) {
  environmentFade = Math.max(0, Math.min(1, fade));
  const mixColor = new THREE.Color(0x000000);

  if (scene && currentTheme) {
    const bg = new THREE.Color(currentTheme.skyColor).lerp(mixColor, environmentFade);
    const fog = new THREE.Color(currentTheme.fogColor).lerp(mixColor, environmentFade);
    scene.background.copy(bg);
    scene.fog.color.copy(fog);
  }

  environmentFadeTargets.forEach((material) => {
    const base = material.__fadeBase ?? 1;
    material.opacity = base * (1 - environmentFade);
  });
}

function updateSunTexture(colors) {
  if (!sunMeshRef || !sunMeshRef.material || !sunMeshRef.material.map) return;

  const canvas = sunMeshRef.material.map.image;
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, 512, 512);

  const grad = ctx.createLinearGradient(256, 30, 256, 482);
  colors.forEach((c, i) => grad.addColorStop(i / (colors.length - 1), c));

  ctx.beginPath();
  ctx.arc(256, 256, 248, 0, Math.PI * 2);
  ctx.fillStyle = grad;
  ctx.fill();

  ctx.shadowColor = colors[0];
  ctx.shadowBlur = 20;
  ctx.beginPath();
  ctx.arc(256, 256, 248, 0, Math.PI * 2);
  ctx.fillStyle = grad;
  ctx.fill();
  ctx.shadowBlur = 0;

  ctx.globalCompositeOperation = 'destination-out';
  const bandDefs = [
    { y: 0.90, h: 0.065 },
    { y: 0.82, h: 0.050 },
    { y: 0.75, h: 0.038 },
    { y: 0.69, h: 0.028 },
    { y: 0.64, h: 0.020 },
    { y: 0.60, h: 0.013 },
    { y: 0.57, h: 0.008 },
    { y: 0.54, h: 0.004 },
  ];
  for (const b of bandDefs) {
    const cy = b.y * 512;
    const ch = b.h * 512;
    ctx.fillStyle = 'black';
    ctx.fillRect(0, cy - ch / 2, 512, ch);
  }
  ctx.globalCompositeOperation = 'source-over';

  sunMeshRef.material.map.needsUpdate = true;
}

function applyThemeForLevel(level) {
  const theme = getThemeForLevel(level);
  if (!theme || !scene) return;

  currentTheme = theme;

  const hideBaseEnv = !!theme.hideBaseEnv;
  if (gridHelper) gridHelper.visible = !hideBaseEnv;
  if (horizonRingRef) horizonRingRef.visible = !hideBaseEnv;
  if (horizonInnerRingRef) horizonInnerRingRef.visible = !hideBaseEnv;
  if (sunMeshRef) sunMeshRef.visible = !hideBaseEnv;
  if (sunGlowRef) sunGlowRef.visible = !hideBaseEnv;
  if (starsRef) starsRef.visible = theme.keepStars ? true : !hideBaseEnv;

  rebuildBiomeProps(getBiomeForLevel(level), theme);

  if (gridHelper) {
    const updateGridMat = (mat) => {
      mat.color.setHex(theme.gridColor);
      mat.opacity = theme.gridOpacity;
      mat.__fadeBase = theme.gridOpacity;
      mat.transparent = true;
    };

    if (Array.isArray(gridHelper.material)) {
      gridHelper.material.forEach(updateGridMat);
    } else {
      updateGridMat(gridHelper.material);
    }

    const gridScale = theme.gridScale !== undefined ? theme.gridScale : 1;
    gridHelper.scale.set(gridScale, 1, gridScale);
  }

  if (floorMaterial) {
    const floorColor = theme.floorColor !== undefined ? theme.floorColor : theme.mountainFill;
    floorBaseColor.setHex(floorColor);
    floorMaterial.color.copy(floorBaseColor);
    floorMaterial.opacity = theme.hideBaseEnv ? 0 : 1;
    floorMaterial.__fadeBase = floorMaterial.opacity;
  }

  const mountainScale = theme.mountainScale !== undefined ? theme.mountainScale : 1;
  mountainLines.forEach((layer) => {
    if (layer.fillMesh && layer.fillMesh.material) {
      layer.fillMesh.material.color.setHex(theme.mountainFill);
      layer.fillMesh.material.__fadeBase = 1;
      layer.fillMesh.scale.set(1, mountainScale, 1);
    }
    if (layer.line && layer.line.material) {
      layer.line.material.color.setHex(theme.mountainWire);
      layer.line.material.opacity = theme.mountainWireOpacity;
      layer.line.material.__fadeBase = theme.mountainWireOpacity;
      layer.line.material.transparent = true;
      layer.line.scale.set(1, mountainScale, 1);
    }
  });

  updateSunTexture(theme.sunColors);

  const sunScale = theme.sunScale !== undefined ? theme.sunScale : 1;
  if (sunMeshRef) sunMeshRef.scale.set(sunScale, sunScale, sunScale);
  if (sunGlowRef) sunGlowRef.scale.set(sunScale, sunScale, sunScale);

  if (sunGlowRef && sunGlowRef.material) {
    sunGlowRef.material.color.setHex(theme.sunGlowColor);
  }

  if (horizonRingRef && horizonRingRef.material) {
    const horizonColor = theme.horizonColor !== undefined ? theme.horizonColor : theme.sunGlowColor;
    horizonRingRef.material.color.setHex(horizonColor);
  }

  if (horizonInnerRingRef && horizonInnerRingRef.material) {
    const horizonInnerColor = theme.horizonInnerColor !== undefined ? theme.horizonInnerColor : theme.gridColor;
    horizonInnerRingRef.material.color.setHex(horizonInnerColor);
  }

  if (starsRef && starsRef.material) {
    starsRef.material.color.setHex(theme.starColor);
    const starSize = theme.starSize !== undefined ? theme.starSize : 0.5;
    starsRef.material.size = starSize;
  }

  if (theme.starCount || theme.starHeight || theme.starSpread) {
    rebuildStars(theme);
  }

  rebuildBiomeScene(getBiomeForLevel(level), theme);

  applyEnvironmentFade(environmentFade);
}

function startEnvironmentFade(direction, duration, onComplete) {
  environmentFadeState = {
    direction,
    duration,
    timer: duration,
    onComplete,
  };
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
  registerFadeMaterial(sunMeshRef.material);

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
  registerFadeMaterial(sunGlowRef.material);

  createOminousHorizon();
  createAurora();
  // Atmosphere: vertical gradient cylinder around player
  createAtmosphere();
}

/** Low-res aurora borealis on sky dome — performance friendly (small texture, single mesh) */
function createAurora() {
  const w = 32;
  const h = 64;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  const grad = ctx.createLinearGradient(0, 0, 0, h);
  grad.addColorStop(0, 'rgba(0,40,60,0)');
  grad.addColorStop(0.3, 'rgba(0,200,180,0.08)');
  grad.addColorStop(0.5, 'rgba(0,255,200,0.12)');
  grad.addColorStop(0.7, 'rgba(0,180,220,0.06)');
  grad.addColorStop(1, 'rgba(0,40,80,0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, w, h);
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  const geo = new THREE.CylinderGeometry(95, 95, 25, 32, 1, true);
  const mat = new THREE.MeshBasicMaterial({
    map: tex,
    transparent: true,
    opacity: 0.9,
    side: THREE.BackSide,
    depthWrite: false,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.set(0, 15, 0);
  mesh.renderOrder = -21;
  scene.add(mesh);
  auroraRef = mesh;
  registerFadeMaterial(auroraRef.material);
}

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
  registerFadeMaterial(ominousRef.material);
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
  atmosphereRef = cylinder;
  registerFadeMaterial(atmosphereRef.material);
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
    registerFadeMaterial(fillMesh.material);

    const edgePoints = [new THREE.Vector3(-100, 0, z)];
    peaks.forEach(([x, y]) => edgePoints.push(new THREE.Vector3(x, y, z)));
    edgePoints.push(new THREE.Vector3(100, 0, z));
    const geometry = new THREE.BufferGeometry().setFromPoints(edgePoints);
    const edgeLine = new THREE.Line(geometry, new THREE.LineBasicMaterial({ color: MTN_WIRE, transparent: true, opacity: 0.8 }));
    scene.add(edgeLine);
    registerFadeMaterial(edgeLine.material);

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
  const theme = currentTheme || {};
  const count = theme.starCount || 800;
  const spread = theme.starSpread || 300;
  const height = theme.starHeight || 80;
  const base = theme.starBase || 10;
  const positions = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    const i3 = i * 3;
    positions[i3] = (Math.random() - 0.5) * spread;
    positions[i3 + 1] = Math.random() * height + base;
    positions[i3 + 2] = (Math.random() - 0.5) * spread;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  const mat = new THREE.PointsMaterial({ color: 0xffffff, size: 0.5 });
  const stars = new THREE.Points(geo, mat);
  stars.renderOrder = -20;
  scene.add(stars);
  starsRef = stars;
  registerFadeMaterial(starsRef.material);
}

function rebuildStars(theme) {
  if (!scene) return;
  if (starsRef) {
    scene.remove(starsRef);
    if (starsRef.geometry) starsRef.geometry.dispose();
    if (starsRef.material) starsRef.material.dispose();
    starsRef = null;
  }
  const count = theme.starCount || 800;
  const spread = theme.starSpread || 300;
  const height = theme.starHeight || 80;
  const base = theme.starBase || 10;
  const positions = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    const i3 = i * 3;
    positions[i3] = (Math.random() - 0.5) * spread;
    positions[i3 + 1] = Math.random() * height + base;
    positions[i3 + 2] = (Math.random() - 0.5) * spread;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  const mat = new THREE.PointsMaterial({ color: theme.starColor || 0xffffff, size: theme.starSize || 0.5 });
  const stars = new THREE.Points(geo, mat);
  stars.renderOrder = -20;
  scene.add(stars);
  starsRef = stars;
  registerFadeMaterial(starsRef.material);
}

// ============================================================
//  CONTROLLERS
// ============================================================
function setupControllers() {
  for (let i = 0; i < 2; i++) {
    const controller = renderer.xr.getController(i);

    // MAIN weapon triggers (top/select trigger)
    controller.addEventListener('selectstart', () => { controllerTriggerPressed[i] = true; onTriggerPress(controller, i); });
    controller.addEventListener('selectend', () => { controllerTriggerPressed[i] = false; onTriggerRelease(i); });
    
    // ALT weapon triggers (bottom/squeeze trigger)
    controller.addEventListener('squeezestart', () => { onSqueezePress(controller, i); });
    controller.addEventListener('squeezeend', () => { onSqueezeRelease(i); });
    
    controller.addEventListener('connected', (e) => {
      console.log(`[controller] ${i} connected — ${e.data.handedness}`);
      controller.userData.handedness = e.data.handedness;
      const display = blasterDisplays[i];
      if (display) {
        display.userData.hand = controller.userData.handedness;
        display.userData.needsUpdate = true;
      }
    });
    controller.addEventListener('disconnected', () => {
      console.log(`[controller] ${i} disconnected`);
    });

    controller.add(createControllerVisual(i));
    scene.add(controller);
    controllers.push(controller);
  }

  // Desktop click handler for non-VR playtesting
  document.addEventListener('mousedown', (e) => {
    if (!isDesktopEnabled() || e.button !== 0) return;
    if (e.target && e.target.closest && (e.target.closest('#debug-panel') || e.target.closest('#debug-toggle'))) {
      return;
    }
    handleDesktopClick();
  });
}

/**
 * Get the actual hand ('left' or 'right') for a controller index
 * Uses controller handedness if available, falls back to index-based mapping
 */
function getHandForController(controllerIndex) {
  const controller = controllers[controllerIndex];
  if (controller && controller.userData.handedness) {
    // Use actual controller handedness (from VR system)
    return controller.userData.handedness;
  }
  // Fallback to index-based mapping (controller 0 = left, controller 1 = right)
  return controllerIndex === 0 ? 'left' : 'right';
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
  const hand = getHandForController(controllerIndex);

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

  const hand = getHandForController(controllerIndex);
  display.userData.hand = hand;
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
    fireMainWeapon(controller, index);  // Changed from shootWeapon
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
  } else if (st === State.READY_SCREEN) {
    handleReadyScreenTrigger(controller);
  } else if (st === State.DEBUG_MENU) {
    handleDebugMenuTrigger(controller);
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
    playMenuClick();
    scoreboardFromGameOver = false;
    game.state = State.SCOREBOARD;
    hideTitle();
    showScoreboard([], 'LOADING...');
    fetchTopScores().then(scores => {
      showScoreboard(scores, 'GLOBAL');
    });
    return;
  }
  if (btnHit === 'debug_menu') {
    playMenuClick();
    game.state = State.DEBUG_MENU;
    hideTitle();
    showDebugMenu();
    return;
  }
  playMenuClick();
  startGame();
}

// ── Desktop Controls Handlers ───────────────────────────────

function handleDesktopClick() {
  if (!isDesktopEnabled()) return;

  const st = game.state;

  if (st === State.TITLE) {
    handleDesktopTitleClick();
  } else if (st === State.UPGRADE_SELECT) {
    handleDesktopUpgradeSelectClick();
  } else if (st === State.GAME_OVER || st === State.VICTORY) {
    if (gameOverCooldown <= 0) {
      handleDesktopGameOverClick();
    }
  } else if (st === State.NAME_ENTRY) {
    handleDesktopNameEntryClick();
  } else if (st === State.SCOREBOARD || st === State.REGIONAL_SCORES) {
    handleDesktopScoreboardClick();
  } else if (st === State.COUNTRY_SELECT) {
    handleDesktopCountrySelectClick();
  } else if (st === State.READY_SCREEN) {
    handleDesktopReadyScreenClick();
  } else if (st === State.DEBUG_MENU) {
    handleDesktopDebugMenuClick();
  }
}

function handleDesktopTitleClick() {
  const raycaster = getAimRaycaster();
  if (!raycaster) {
    // No raycaster - just start the game
    playMenuClick();
    startGame();
    return;
  }

  const btnHit = getTitleButtonHit(raycaster);
  if (btnHit === 'scoreboard') {
    playMenuClick();
    scoreboardFromGameOver = false;
    game.state = State.SCOREBOARD;
    hideTitle();
    showScoreboard([], 'LOADING...');
    fetchTopScores().then(scores => {
      showScoreboard(scores, 'GLOBAL');
    });
    return;
  }
  if (btnHit === 'debug_menu') {
    playMenuClick();
    game.state = State.DEBUG_MENU;
    hideTitle();
    showDebugMenu();
    return;
  }
  playMenuClick();
  startGame();
}

function handleDesktopGameOverClick() {
  game.finalScore = game.score;
  game.finalLevel = game.level;
  scoreboardFromGameOver = true;
  hideGameOver();

  if (!getStoredCountry()) {
    game.state = State.COUNTRY_SELECT;
    showCountrySelect(COUNTRIES, CONTINENTS, 'North America');
  } else {
    game.state = State.NAME_ENTRY;
    showNameEntry(game.finalScore, game.finalLevel, getStoredName(), getCountryDisplayLabel());
  }
}

function handleDesktopNameEntryClick() {
  const raycaster = getAimRaycaster();
  if (!raycaster) return;

  const result = getNameEntryHit(raycaster);
  if (result && result.action === 'country') {
    playMenuClick();
    scoreboardFromGameOver = true;
    game.state = State.COUNTRY_SELECT;
    hideNameEntry();
    showCountrySelect(COUNTRIES, CONTINENTS, 'North America');
    return;
  }
  if (result && result.action === 'submit') {
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
      return new Promise(resolve => setTimeout(resolve, 500));
    }).then(() => {
      return fetchTopScores();
    }).then(scores => {
      showScoreboard(scores, 'GLOBAL');
    }).catch(err => {
      console.error('[scoreboard] Detailed error in submission flow:', err);
      showScoreboard([], 'ERROR SUBMITTING SCORE');
    });
  }
}

function handleDesktopScoreboardClick() {
  const raycaster = getAimRaycaster();
  if (!raycaster) return;

  const action = getScoreboardHit(raycaster);
  if (action === 'back') {
    playMenuClick();
    hideScoreboard();
    resetGame();
    showTitle();
    return;
  }
  if (action === 'country') {
    scoreboardFromGameOver = false;
    game.state = State.COUNTRY_SELECT;
    hideScoreboard();
    showCountrySelect(COUNTRIES, CONTINENTS, 'North America');
    return;
  }
  if (action === 'continent') {
    scoreboardFromGameOver = false;
    game.state = State.COUNTRY_SELECT;
    hideScoreboard();
    showCountrySelect(COUNTRIES, CONTINENTS, 'North America', null, 'continent');
    return;
  }
}

function handleDesktopCountrySelectClick() {
  const raycaster = getAimRaycaster();
  if (!raycaster) return;

  const result = getCountrySelectHit(raycaster, COUNTRIES);
  if (!result) return;

  if (result.action === 'back') {
    playMenuClick();
    hideCountrySelect();
    if (scoreboardFromGameOver) {
      game.state = State.NAME_ENTRY;
      showNameEntry(game.finalScore, game.finalLevel, getStoredName(), getCountryDisplayLabel());
    } else {
      game.state = State.SCOREBOARD;
      showScoreboard([], 'LOADING...');
      fetchTopScores().then(scores => {
        showScoreboard(scores, 'GLOBAL');
      });
    }
    return;
  }

  if (result.action === 'select') {
    playMenuClick();
    setStoredCountry(result.code);
    hideCountrySelect();

    if (scoreboardFromGameOver) {
      game.state = State.NAME_ENTRY;
      showNameEntry(game.finalScore, game.finalLevel, getStoredName(), getCountryDisplayLabel());
    } else {
      game.state = State.REGIONAL_SCORES;
      const country = COUNTRIES.find(c => c.code === result.code);
      const label = country ? country.name : result.code;
      showScoreboard([], 'LOADING...');
      fetchScoresByCountry(result.code).then(scores => {
        showScoreboard(scores, `COUNTRY:${country.flag} ${label.toUpperCase()}`);
      });
    }
  }

  if (result.action === 'select_continent') {
    playMenuClick();
    hideCountrySelect();
    if (!scoreboardFromGameOver) {
      game.state = State.REGIONAL_SCORES;
      showScoreboard([], 'LOADING...');
      fetchScoresByContinent(result.continent).then(scores => {
        showScoreboard(scores, `CONTINENT:🌎 ${result.continent.toUpperCase()}`);
      });
    }
  }
}

function handleDesktopUpgradeSelectClick() {
  if (upgradeSelectionCooldown > 0) return;

  const raycaster = getAimRaycaster();
  if (!raycaster) return;

  const result = getUpgradeCardHit(raycaster);
  if (result) {
    selectUpgradeAndAdvance(result.upgrade, result.hand);
  }
}

function handleDesktopReadyScreenClick() {
  if (readyCountdownActive) return;
  playMenuClick();
  startReadyCountdown();
}

function handleDesktopDebugMenuClick() {
  const raycaster = getAimRaycaster();
  if (!raycaster) return;

  const result = getDebugMenuHit(raycaster);
  if (result && result.action === 'back') {
    playMenuClick();
    saveDebugSettings();
    hideDebugMenu();
    resetGame();
    showTitle();
    updateTitleDebugIndicator();
    return;
  }
  if (result && result.action === 'biome_next') {
    playMenuClick();
    cycleDebugBiomeWithFade();
  }
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
    showNameEntry(game.finalScore, game.finalLevel, getStoredName(), getCountryDisplayLabel());
  }
}

function handleNameEntryTrigger(controller) {
  const origin = new THREE.Vector3();
  const quat = new THREE.Quaternion();
  controller.getWorldPosition(origin);
  controller.getWorldQuaternion(quat);
  const direction = new THREE.Vector3(0, 0, -1).applyQuaternion(quat);
  const raycaster = new THREE.Raycaster(origin, direction, 0, 10);

  const result = getNameEntryHit(raycaster);
  if (result && result.action === 'country') {
    playMenuClick();
    scoreboardFromGameOver = true;
    game.state = State.COUNTRY_SELECT;
    hideNameEntry();
    showCountrySelect(COUNTRIES, CONTINENTS, 'North America');
    return;
  }
  if (result && result.action === 'submit') {
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
      showScoreboard(scores, 'GLOBAL');
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
    hideScoreboard();
    resetGame();
    showTitle();
    return;
  }
  if (action === 'country') {
    // Show country select for filtering
    scoreboardFromGameOver = false;
    game.state = State.COUNTRY_SELECT;
    hideScoreboard();
    showCountrySelect(COUNTRIES, CONTINENTS, 'North America');
    return;
  }
  if (action === 'continent') {
    // Show continent picker
    scoreboardFromGameOver = false;
    game.state = State.COUNTRY_SELECT;
    hideScoreboard();
    showCountrySelect(COUNTRIES, CONTINENTS, 'North America', null, 'continent');
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
    hideCountrySelect();
    if (scoreboardFromGameOver) {
      // Back to name entry
      game.state = State.NAME_ENTRY;
      showNameEntry(game.finalScore, game.finalLevel, getStoredName(), getCountryDisplayLabel());
    } else {
      // Back to scoreboard
      game.state = State.SCOREBOARD;
      showScoreboard([], 'LOADING...');
      fetchTopScores().then(scores => {
        showScoreboard(scores, 'GLOBAL');
      });
    }
    return;
  }

  if (result.action === 'select') {
    playMenuClick();
    setStoredCountry(result.code);
    hideCountrySelect();

    if (scoreboardFromGameOver) {
      // After setting country during game-over flow, go to name entry
      game.state = State.NAME_ENTRY;
      showNameEntry(game.finalScore, game.finalLevel, getStoredName(), getCountryDisplayLabel());
    } else {
      // Filtering scoreboard by country
      game.state = State.REGIONAL_SCORES;
      const country = COUNTRIES.find(c => c.code === result.code);
      const label = country ? country.name : result.code;
      showScoreboard([], 'LOADING...');
      fetchScoresByCountry(result.code).then(scores => {
        showScoreboard(scores, `COUNTRY:${country.flag} ${label.toUpperCase()}`);
      });
    }
  }

  if (result.action === 'select_continent') {
    playMenuClick();
    hideCountrySelect();
    if (!scoreboardFromGameOver) {
      game.state = State.REGIONAL_SCORES;
      showScoreboard([], 'LOADING...');
      fetchScoresByContinent(result.continent).then(scores => {
        showScoreboard(scores, `CONTINENT:🌎 ${result.continent.toUpperCase()}`);
      });
    }
  }
}

function onTriggerRelease(index) {
  // Charge shot: fire beam on release
  if (chargeShotStartTime[index] !== null) {
    const hand = getHandForController(index);
    const stats = getWeaponStats(game.mainWeapon[hand], game.upgrades[hand]);
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
//  ALT WEAPON HANDLERS (squeeze trigger)
// ============================================================
function onSqueezePress(controller, index) {
  const st = game.state;
  
  // Only fire ALT weapons during gameplay
  if (st === State.PLAYING) {
    fireAltWeapon(controller, index);
  }
}

function onSqueezeRelease(index) {
  // Currently no release logic needed for ALT weapons
  // Could add charge-up ALT weapons in future
}

// ============================================================
//  ALT WEAPON FIRING
// ============================================================
function fireAltWeapon(controller, index) {
  const hand = getHandForController(index);
  const altWeaponId = game.altWeapon[hand];
  
  // Check if ALT weapon is equipped
  if (!altWeaponId) {
    // No ALT weapon equipped for this hand
    return;
  }
  
  // Check cooldown
  const now = performance.now();
  if (now < game.altCooldowns[hand]) {
    // Still on cooldown
    return;
  }
  
  const altWeapon = getAltWeapon(altWeaponId);
  if (!altWeapon) {
    console.warn(`Unknown ALT weapon: ${altWeaponId}`);
    return;
  }
  
  // Get controller position and direction
  const origin = new THREE.Vector3();
  const quat = new THREE.Quaternion();
  controller.getWorldPosition(origin);
  controller.getWorldQuaternion(quat);
  const direction = new THREE.Vector3(0, 0, -1).applyQuaternion(quat);
  
  // Execute ALT weapon specific logic
  console.log(`[ALT weapon] Firing ${altWeaponId} from ${hand} hand`);
  
  switch (altWeaponId) {
    case 'shield':
      fireShield(controller, index, hand, altWeapon);
      break;

    case 'laser_mine':
      fireLaserMine(controller, index, hand, altWeapon);
      break;
      
    case 'grenade':
      fireGrenade(origin, direction, hand, altWeapon);
      break;

    case 'mine':
      fireProximityMine(origin, hand, altWeapon);
      break;

    case 'drone':
      fireAttackDrone(origin, hand, altWeapon);
      break;

    case 'emp':
      fireEMP(origin, hand, altWeapon);
      break;

    case 'teleport':
      fireTeleport(origin, direction, hand, altWeapon);
      break;

    case 'stasis_field':
      fireStasisField(origin, direction, hand, altWeapon);
      break;

    case 'plasma_orb':
      firePlasmaOrb(origin, direction, hand, altWeapon);
      break;

    case 'decoy':
      fireDecoy(origin, hand, altWeapon);
      break;

    case 'black_hole':
      fireBlackHole(origin, direction, hand, altWeapon);
      break;

    case 'tether_harpoon':
      fireTetherHarpoon(origin, direction, hand, altWeapon);
      break;

    case 'nanite_swarm':
      fireNaniteSwarm(origin, hand, altWeapon);
      break;

    case 'phase_dash':
      firePhaseDash(controller, index, hand, altWeapon, origin, direction);
      break;

    case 'reflector_drone':
      fireReflectorDrone(origin, hand, altWeapon);
      break;

    default:
      console.warn(`Unknown ALT weapon type: ${altWeaponId}`);
      return;
  }
  
  // Set cooldown
  game.altCooldowns[hand] = now + altWeapon.cooldown;
  playShoothSound();  // Placeholder sound
}

// ============================================================
//  SHIELD ALT WEAPON
// ============================================================
function fireShield(controller, index, hand, altWeapon) {
  // Get player camera position (shield surrounds player)
  const playerPos = camera.position.clone();
  
  // Create blue translucent sphere around player
  const shieldGeo = new THREE.SphereGeometry(1.2, 24, 24);
  const shieldMat = new THREE.MeshBasicMaterial({
    color: 0x4488ff,
    transparent: true,
    opacity: 0.4,
    side: THREE.DoubleSide,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  const shieldMesh = new THREE.Mesh(shieldGeo, shieldMat);
  shieldMesh.position.copy(playerPos);
  shieldMesh.renderOrder = 500;
  scene.add(shieldMesh);
  
  // Track active shield
  const shieldData = {
    mesh: shieldMesh,
    hand: hand,
    expiresAt: performance.now() + altWeapon.duration,
    position: playerPos.clone(),
    radius: 1.2,
  };
  activeShields.push(shieldData);
  
  console.log(`[Shield] Activated for ${altWeapon.duration / 1000}s at ${hand} hand`);
  playShoothSound();
}

function updateShields(now) {
  for (let i = activeShields.length - 1; i >= 0; i--) {
    const shield = activeShields[i];
    
    // Check if expired
    if (now >= shield.expiresAt) {
      scene.remove(shield.mesh);
      shield.mesh.geometry.dispose();
      shield.mesh.material.dispose();
      activeShields.splice(i, 1);
      console.log('[Shield] Expired');
      continue;
    }
    
    // Make shield follow player
    const playerPos = camera.position.clone();
    shield.mesh.position.copy(playerPos);
    shield.position.copy(playerPos);
    
    // Fade out effect in last 0.5s
    const remaining = shield.expiresAt - now;
    if (remaining < 500) {
      shield.mesh.material.opacity = 0.4 * (remaining / 500);
    }
    
    // Pulse effect
    const pulse = 1 + Math.sin(now * 0.01) * 0.05;
    shield.mesh.scale.setScalar(pulse);
  }
}

function checkShieldBlock(projectilePos) {
  for (const shield of activeShields) {
    const dist = projectilePos.distanceTo(shield.position);
    if (dist < 0.8) {
      return true;  // Blocked
    }
  }
  return false;
}

// ============================================================
//  LASER MINE ALT WEAPON (PASSIVE)
// ============================================================

/**
 * Spawn laser mines around player when standing still for 2+ seconds
 * This is called from the update loop, not from trigger press
 */
function spawnLaserMinesPassively(playerPos, now, dt) {
  // Check if player has laser mine equipped in either hand
  const leftAlt = game.altWeapon.left;
  const rightAlt = game.altWeapon.right;

  const hasLeftLaserMine = leftAlt === 'laser_mine';
  const hasRightLaserMine = rightAlt === 'laser_mine';

  if (!hasLeftLaserMine && !hasRightLaserMine) {
    playerStillnessStartTime = null;
    return;
  }

  // Track cooldown
  if (laserMineSpawnCooldown > 0) {
    laserMineSpawnCooldown -= dt * 1000;
    return;
  }

  // Check if player is standing still (within 0.3m movement threshold)
  const moveDistance = playerPos.distanceTo(playerLastPosition);
  const STILLNESS_THRESHOLD = 0.3;

  if (moveDistance < STILLNESS_THRESHOLD) {
    // Player is standing still
    if (!playerStillnessStartTime) {
      playerStillnessStartTime = now;
    } else {
      const stillnessDuration = now - playerStillnessStartTime;
      const altWeapon = getAltWeapon('laser_mine');
      const requiredTime = altWeapon.stillnessTime || 2000;

      if (stillnessDuration >= requiredTime) {
        // Spawn mines around player
        const mineCount = altWeapon.mineCount || 3;
        const mineRadius = 1.5; // Distance from player

        for (let i = 0; i < mineCount; i++) {
          const angle = (i / mineCount) * Math.PI * 2;
          const minePos = new THREE.Vector3(
            playerPos.x + Math.cos(angle) * mineRadius,
            0.1,
            playerPos.z + Math.sin(angle) * mineRadius
          );

          // Determine which hand this mine belongs to
          const hand = hasLeftLaserMine ? 'left' : 'right';

          // Spawn the mine
          spawnSingleLaserMine(minePos, hand, altWeapon);
        }

        // Set cooldown and reset stillness tracking
        laserMineSpawnCooldown = 5000; // 5 second cooldown between spawns
        playerStillnessStartTime = null;

        console.log(`[Laser Mine] Spawned ${mineCount} passive mines around player`);
      }
    }
  } else {
    // Player moved - reset stillness tracking
    playerStillnessStartTime = null;
  }

  // Update last position
  playerLastPosition.copy(playerPos);
}

/**
 * Spawn a single laser mine at a position
 */
function spawnSingleLaserMine(position, hand, altWeapon) {
  // Check max active mines for this hand
  const handMines = activeLaserMines.filter(m => m.hand === hand);
  if (handMines.length >= (altWeapon.maxActive || 5)) {
    // Remove oldest mine
    const oldest = handMines[0];
    if (oldest.mesh) {
      scene.remove(oldest.mesh);
      oldest.mesh.geometry.dispose();
      oldest.mesh.material.dispose();
    }
    if (oldest.glowMesh) {
      scene.remove(oldest.glowMesh);
      oldest.glowMesh.geometry.dispose();
      oldest.glowMesh.material.dispose();
    }
    if (oldest.laserMesh) {
      scene.remove(oldest.laserMesh);
      oldest.laserMesh.geometry.dispose();
      oldest.laserMesh.material.dispose();
    }
    const idx = activeLaserMines.indexOf(oldest);
    if (idx >= 0) activeLaserMines.splice(idx, 1);
  }

  // Create purple icosahedron mine
  const mineGeo = new THREE.IcosahedronGeometry(0.12, 0);
  const mineMat = new THREE.MeshBasicMaterial({
    color: 0xaa00ff,  // Purple
    transparent: true,
    opacity: 0.9,
  });
  const mineMesh = new THREE.Mesh(mineGeo, mineMat);
  mineMesh.position.copy(position);
  mineMesh.renderOrder = 400;
  scene.add(mineMesh);

  // Add outer glow sphere
  const glowGeo = new THREE.SphereGeometry(0.2, 12, 12);
  const glowMat = new THREE.MeshBasicMaterial({
    color: 0xaa00ff,
    transparent: true,
    opacity: 0.3,
    side: THREE.BackSide,
  });
  const glowMesh = new THREE.Mesh(glowGeo, glowMat);
  glowMesh.position.copy(position);
  glowMesh.renderOrder = 399;
  scene.add(glowMesh);

  const now = performance.now();

  // Track active mine
  const mineData = {
    mesh: mineMesh,
    glowMesh: glowMesh,
    hand: hand,
    position: position.clone(),
    placedAt: now,
    armedAt: now + (altWeapon.armTime || 1000),
    autoDetonateAt: now + (altWeapon.autoDetonateTime || 4000),
    isArmed: false,
    triggered: false,
    triggeredAt: null,
    laserMesh: null,
    damage: altWeapon.damage || 50,
    triggerRadius: altWeapon.triggerRadius || 3,
    pulsePhase: Math.random() * Math.PI * 2,
  };
  activeLaserMines.push(mineData);
}

// Legacy function - no longer triggered by squeeze, kept for compatibility
function fireLaserMine(controller, index, hand, altWeapon) {
  // Laser mines are now passive - no trigger-based firing
  console.log('[Laser Mine] Passive weapon - use spawnLaserMinesPassively()');
}

function updateLaserMines(now, dt) {
  const enemies = getEnemies();

  for (let i = activeLaserMines.length - 1; i >= 0; i--) {
    const mine = activeLaserMines[i];

    // Pulsing glow effect
    if (mine.glowMesh) {
      mine.pulsePhase += dt * 3;
      const pulse = 0.2 + Math.sin(mine.pulsePhase) * 0.15;
      mine.glowMesh.material.opacity = pulse;
      const scale = 1 + Math.sin(mine.pulsePhase) * 0.1;
      mine.glowMesh.scale.setScalar(scale);
    }

    // Rotate mine
    if (mine.mesh) {
      mine.mesh.rotation.x += dt * 0.5;
      mine.mesh.rotation.y += dt * 0.7;
    }

    // Not armed yet
    if (now < mine.armedAt) {
      // Flashing effect while arming
      const flash = Math.sin(now * 0.02) > 0 ? 0.9 : 0.4;
      mine.mesh.material.opacity = flash;
      continue;
    }

    // Just armed
    if (!mine.isArmed) {
      mine.isArmed = true;
      mine.mesh.material.opacity = 1.0;
      mine.mesh.material.color.setHex(0xcc44ff);  // Brighter purple when armed
      console.log('[Laser Mine] Armed');
    }

    // Check for auto-detonation
    if (now >= mine.autoDetonateAt && !mine.triggered) {
      triggerLaserMine(mine, null, enemies);
      continue;
    }

    // Already triggered - skip
    if (mine.triggered) continue;

    // Check for enemy proximity
    let nearestEnemy = null;
    let nearestDist = mine.triggerRadius;

    for (const e of enemies) {
      const dist = e.mesh.position.distanceTo(mine.position);
      if (dist < nearestDist) {
        nearestDist = dist;
        nearestEnemy = e;
      }
    }

    // Trigger mine if enemy in range
    if (nearestEnemy) {
      triggerLaserMine(mine, nearestEnemy, enemies);
    }
  }

  // Clean up triggered mines after laser duration
  for (let i = activeLaserMines.length - 1; i >= 0; i--) {
    const mine = activeLaserMines[i];
    if (mine.triggered && mine.triggeredAt && now - mine.triggeredAt > 500) {
      // Remove laser visual after 500ms
      if (mine.laserMesh) {
        scene.remove(mine.laserMesh);
        mine.laserMesh.geometry.dispose();
        mine.laserMesh.material.dispose();
        mine.laserMesh = null;
      }
      // Remove mine visuals
      if (mine.mesh) {
        scene.remove(mine.mesh);
        mine.mesh.geometry.dispose();
        mine.mesh.material.dispose();
      }
      if (mine.glowMesh) {
        scene.remove(mine.glowMesh);
        mine.glowMesh.geometry.dispose();
        mine.glowMesh.material.dispose();
      }
      activeLaserMines.splice(i, 1);
      console.log('[Laser Mine] Cleaned up');
    }
  }
}

function triggerLaserMine(mine, nearestEnemy, allEnemies) {
  mine.triggered = true;
  mine.triggeredAt = performance.now();
  
  // Create laser beam from mine to nearest enemy
  const start = mine.position.clone();
  start.y = 0.5;  // Mine height
  const end = nearestEnemy.mesh.position.clone();
  
  // Create laser line
  const points = [start, end];
  const laserGeo = new THREE.BufferGeometry().setFromPoints(points);
  const laserMat = new THREE.LineBasicMaterial({
    color: 0xff0000,
    transparent: true,
    opacity: 0.9,
    linewidth: 3,
  });
  const laserMesh = new THREE.Line(laserGeo, laserMat);
  laserMesh.renderOrder = 600;
  scene.add(laserMesh);
  mine.laserMesh = laserMesh;
  
  // Damage all enemies in line (simplified: check distance to line)
  const lineDir = new THREE.Vector3().subVectors(end, start).normalize();
  const lineLength = start.distanceTo(end);
  
  for (const e of allEnemies) {
    const toEnemy = new THREE.Vector3().subVectors(e.mesh.position, start);
    const projection = toEnemy.dot(lineDir);
    
    // Check if enemy is along the laser line
    if (projection >= 0 && projection <= lineLength) {
      const closestPoint = start.clone().addScaledVector(lineDir, projection);
      const distToLine = e.mesh.position.distanceTo(closestPoint);
      
      // Within 0.5m of laser line takes damage
      if (distToLine < 0.5) {
        const enemyIndex = allEnemies.indexOf(e);
        if (enemyIndex >= 0) {
          hitEnemy(enemyIndex, mine.damage);
          spawnDamageNumber(e.mesh.position, mine.damage, '#ff0000');
          console.log(`[Laser Mine] Hit enemy for ${mine.damage} damage`);
        }
      }
    }
  }
  
  // Explosion sound
  playExplosionSound();
  
  // Visual feedback on mine
  mine.mesh.material.color.setHex(0xffffff);
  mine.mesh.scale.setScalar(2);
}

// ============================================================
//  DECOY HOLOGRAM IMPLEMENTATION
// ============================================================

function fireDecoy(origin, hand, altWeapon) {
  // Limit active decoys
  if (activeDecoys.length >= MAX_DECOYS) {
    // Remove oldest decoy
    const oldest = activeDecoys.shift();
    destroyDecoy(oldest, false);
  }

  console.log(`[ALT] Decoy deployed at ${origin.x.toFixed(2)}, ${origin.y.toFixed(2)}, ${origin.z.toFixed(2)}`);

  // Create holographic copy of player (simple sphere for now)
  const decoyGroup = new THREE.Group();

  // Body - glitchy semi-transparent sphere
  const bodyGeo = new THREE.SphereGeometry(0.4, 12, 12);
  const bodyMat = new THREE.MeshBasicMaterial({
    color: 0x00ffaa,
    transparent: true,
    opacity: 0.6,
    wireframe: true,
  });
  const body = new THREE.Mesh(bodyGeo, bodyMat);
  decoyGroup.add(body);

  // Static overlay - glitchy particles
  const staticGeo = new THREE.BufferGeometry();
  const staticCount = 50;
  const staticPositions = new Float32Array(staticCount * 3);
  for (let i = 0; i < staticCount; i++) {
    staticPositions[i * 3] = (Math.random() - 0.5) * 0.8;
    staticPositions[i * 3 + 1] = (Math.random() - 0.5) * 0.8;
    staticPositions[i * 3 + 2] = (Math.random() - 0.5) * 0.8;
  }
  staticGeo.setAttribute('position', new THREE.BufferAttribute(staticPositions, 3));
  const staticMat = new THREE.PointsMaterial({
    color: 0xffffff,
    size: 0.05,
    transparent: true,
    opacity: 0.8,
  });
  const staticParticles = new THREE.Points(staticGeo, staticMat);
  decoyGroup.add(staticParticles);

  // Outer glow
  const glowGeo = new THREE.SphereGeometry(0.6, 12, 12);
  const glowMat = new THREE.MeshBasicMaterial({
    color: 0x00ffaa,
    transparent: true,
    opacity: 0.2,
    side: THREE.BackSide,
  });
  const glow = new THREE.Mesh(glowGeo, glowMat);
  decoyGroup.add(glow);

  decoyGroup.position.copy(origin);
  decoyGroup.position.y = Math.max(0.5, origin.y);  // Ensure above ground

  // Decoy state
  const decoy = {
    mesh: decoyGroup,
    bodyMat,
    staticParticles,
    glowMat,
    createdAt: performance.now(),
    duration: altWeapon.duration || 8000,
    position: decoyGroup.position.clone(),
    targetingEnemies: new Set(),
    hand,
    explosionDamage: altWeapon.explosionDamage || 30,
    explosionDamagePerTarget: altWeapon.explosionDamagePerTarget || 15,
  };

  scene.add(decoyGroup);
  activeDecoys.push(decoy);

  playShoothSound();
}

function updateDecoys(dt, now, playerPos) {
  for (let i = activeDecoys.length - 1; i >= 0; i--) {
    const decoy = activeDecoys[i];
    const age = now - decoy.createdAt;

    // Check if expired
    if (age >= decoy.duration) {
      destroyDecoy(decoy, true);
      activeDecoys.splice(i, 1);
      continue;
    }

    // Glitch effect - random position jitter
    const glitchIntensity = 0.02;
    decoy.mesh.position.x = decoy.position.x + (Math.random() - 0.5) * glitchIntensity;
    decoy.mesh.position.y = decoy.position.y + (Math.random() - 0.5) * glitchIntensity;
    decoy.mesh.position.z = decoy.position.z + (Math.random() - 0.5) * glitchIntensity;

    // Flicker opacity
    const flicker = 0.4 + Math.random() * 0.4;
    decoy.bodyMat.opacity = flicker;
    decoy.glowMat.opacity = flicker * 0.3;

    // Update static particles
    const positions = decoy.staticParticles.geometry.attributes.position.array;
    for (let j = 0; j < positions.length; j += 3) {
      positions[j] = (Math.random() - 0.5) * 0.8;
      positions[j + 1] = (Math.random() - 0.5) * 0.8;
      positions[j + 2] = (Math.random() - 0.5) * 0.8;
    }
    decoy.staticParticles.geometry.attributes.position.needsUpdate = true;

    // Attract enemies - find enemies targeting this decoy
    decoy.targetingEnemies.clear();
    const enemies = getEnemies();
    enemies.forEach((e, idx) => {
      const distToDecoy = e.mesh.position.distanceTo(decoy.position);
      const distToPlayer = e.mesh.position.distanceTo(playerPos);

      // Enemy targets decoy if it's closer than player (with some leeway)
      if (distToDecoy < distToPlayer * 1.2 && distToDecoy < 15) {
        decoy.targetingEnemies.add(idx);

        // Redirect enemy toward decoy
        const toDecoy = new THREE.Vector3().subVectors(decoy.position, e.mesh.position).normalize();
        e.targetPosition = decoy.position.clone();
      }
    });

    // Check if decoy is "destroyed" by nearby enemies
    const tooCloseEnemies = enemies.filter(e => e.mesh.position.distanceTo(decoy.position) < 0.8);
    if (tooCloseEnemies.length > 0) {
      destroyDecoy(decoy, true);
      activeDecoys.splice(i, 1);
    }
  }
}

function destroyDecoy(decoy, explode) {
  if (explode) {
    // Calculate explosion damage based on enemies targeting it
    const targetCount = decoy.targetingEnemies.size;
    const totalDamage = decoy.explosionDamage + (targetCount * decoy.explosionDamagePerTarget);

    console.log(`[Decoy] Destroyed! Targets: ${targetCount}, Total damage: ${totalDamage}`);

    // Damage nearby enemies
    const enemies = getEnemies();
    enemies.forEach((e, idx) => {
      const dist = e.mesh.position.distanceTo(decoy.position);
      if (dist < 3) {
        const damageMultiplier = 1 - (dist / 3);  // More damage closer to decoy
        const damage = Math.round(totalDamage * damageMultiplier);
        const result = hitEnemy(idx, damage);
        spawnDamageNumber(e.mesh.position, damage, '#00ffaa');
        playExplosionSound();

        if (result.killed) {
          const destroyData = destroyEnemy(idx);
          if (destroyData) {
            game.kills++;
            game.totalKills++;
            addScore(destroyData.scoreValue);
            updateHUD(game);
          }
        }
      }
    });

    // Visual explosion
    spawnExplosionVisual(decoy.position, 2);
    triggerScreenShake(0.2, 200);
  }

  // Clean up mesh
  scene.remove(decoy.mesh);
  decoy.mesh.children.forEach(child => {
    if (child.geometry) child.geometry.dispose();
    if (child.material) child.material.dispose();
  });
}

// ============================================================
//  BLACK HOLE (SINGULARITY MINE) IMPLEMENTATION
// ============================================================

function fireBlackHole(origin, direction, hand, altWeapon) {
  // Limit active mines
  if (activeMines.length >= MAX_MINES) {
    // Remove oldest mine
    const oldest = activeMines.shift();
    scene.remove(oldest.mesh);
    oldest.mesh.geometry.dispose();
    oldest.mesh.material.dispose();
  }

  console.log(`[ALT] Black hole mine thrown from ${hand} hand`);

  // Create mine projectile
  const mineGeo = new THREE.SphereGeometry(0.15, 8, 8);
  const mineMat = new THREE.MeshBasicMaterial({
    color: 0x8800ff,
    transparent: true,
    opacity: 0.9,
  });
  const mine = new THREE.Mesh(mineGeo, mineMat);

  // Add glow
  const glowGeo = new THREE.SphereGeometry(0.25, 8, 8);
  const glowMat = new THREE.MeshBasicMaterial({
    color: 0x8800ff,
    transparent: true,
    opacity: 0.3,
    side: THREE.BackSide,
  });
  const glow = new THREE.Mesh(glowGeo, glowMat);
  mine.add(glow);

  mine.position.copy(origin);

  const mineData = {
    mesh: mine,
    glowMat,
    velocity: direction.clone().multiplyScalar(8),  // Toss speed
    createdAt: performance.now(),
    hand,
    armed: false,
    armTime: 1000,  // 1 second to arm
    triggerRadius: altWeapon.triggerRadius || 2,
    blackHoleDuration: altWeapon.duration || 2000,
    damage: altWeapon.damage || 40,
    pullRadius: altWeapon.pullRadius || 5,
    stunDuration: altWeapon.stunDuration || 1000,
  };

  scene.add(mine);
  activeMines.push(mineData);

  playShoothSound();
}

function updateMinesAndBlackHoles(dt, now, playerPos) {
  // Update mines (projectiles that haven't triggered yet)
  for (let i = activeMines.length - 1; i >= 0; i--) {
    const mine = activeMines[i];
    const age = now - mine.createdAt;

    // Move mine (with gravity)
    mine.velocity.y -= 9.8 * dt;  // Gravity
    mine.mesh.position.addScaledVector(mine.velocity, dt);

    // Ground collision
    if (mine.mesh.position.y < 0.15) {
      mine.mesh.position.y = 0.15;
      mine.velocity.set(0, 0, 0);
    }

    // Check if armed
    if (!mine.armed && age >= mine.armTime) {
      mine.armed = true;
      mine.mesh.material.color.setHex(0xff00ff);  // Change color when armed
      console.log('[Mine] Armed!');
    }

    // Check for proximity trigger (if armed)
    if (mine.armed) {
      const enemies = getEnemies();
      for (const e of enemies) {
        const dist = e.mesh.position.distanceTo(mine.mesh.position);
        if (dist < mine.triggerRadius) {
          // Trigger black hole!
          triggerBlackHole(mine, i);
          break;
        }
      }
    }

    // Pulse glow
    const pulse = 0.3 + Math.sin(age * 0.01) * 0.15;
    mine.glowMat.opacity = pulse;
  }

  // Update active black holes
  for (let i = activeBlackHoles.length - 1; i >= 0; i--) {
    const bh = activeBlackHoles[i];
    const age = now - bh.createdAt;

    // Check if expired
    if (age >= bh.duration) {
      destroyBlackHole(bh);
      activeBlackHoles.splice(i, 1);
      continue;
    }

    // Progress through duration
    const progress = age / bh.duration;

    // Pull enemies toward center
    const enemies = getEnemies();
    const affectedEnemies = [];

    enemies.forEach((e, idx) => {
      const dist = e.mesh.position.distanceTo(bh.position);
      if (dist < bh.pullRadius) {
        affectedEnemies.push({ index: idx, enemy: e, dist });

        // Pull strength increases toward center, fades at end
        const pullStrength = (1 - dist / bh.pullRadius) * (1 - progress * 0.5) * 8;
        const toCenter = new THREE.Vector3().subVectors(bh.position, e.mesh.position).normalize();
        e.mesh.position.addScaledVector(toCenter, pullStrength * dt);

        // Record that this enemy was affected (for stun)
        if (!bh.affectedEnemies.has(idx)) {
          bh.affectedEnemies.add(idx);
        }
      }
    });

    // Visual rotation and pulse
    bh.mesh.rotation.y += dt * 3;
    bh.mesh.rotation.z += dt * 2;

    // Inner vortex rotation
    if (bh.innerRing) {
      bh.innerRing.rotation.z -= dt * 5;
    }

    // Particle spiral effect
    const particlePositions = bh.particles.geometry.attributes.position.array;
    for (let j = 0; j < particlePositions.length; j += 3) {
      const angle = Math.atan2(particlePositions[j + 2], particlePositions[j]);
      const radius = Math.sqrt(particlePositions[j] ** 2 + particlePositions[j + 2] ** 2);
      const newAngle = angle + dt * 3;
      const newRadius = Math.max(0.3, radius - dt * 0.5);  // Spiral inward

      particlePositions[j] = Math.cos(newAngle) * newRadius;
      particlePositions[j + 2] = Math.sin(newAngle) * newRadius;
      particlePositions[j + 1] += (Math.random() - 0.5) * dt * 2;
    }
    bh.particles.geometry.attributes.position.needsUpdate = true;

    // Apply damage when black hole ends
    if (progress >= 0.9 && !bh.damageApplied) {
      bh.damageApplied = true;

      affectedEnemies.forEach(({ index, enemy, dist }) => {
        const damageMultiplier = 1 - (dist / bh.pullRadius);
        const damage = Math.round(bh.damage * damageMultiplier);
        const result = hitEnemy(index, damage);
        spawnDamageNumber(enemy.mesh.position, damage, '#8800ff');
        playHitSound();

        if (result.killed) {
          const destroyData = destroyEnemy(index);
          if (destroyData) {
            game.kills++;
            game.totalKills++;
            addScore(destroyData.scoreValue);
            updateHUD(game);
          }
        }
      });
    }
  }
}

function triggerBlackHole(mine, mineIndex) {
  console.log('[Black Hole] Triggered!');

  // Remove mine
  scene.remove(mine.mesh);
  mine.mesh.geometry.dispose();
  mine.mesh.material.dispose();
  activeMines.splice(mineIndex, 1);

  // Limit active black holes
  if (activeBlackHoles.length >= MAX_BLACK_HOLES) {
    const oldest = activeBlackHoles.shift();
    destroyBlackHole(oldest);
  }

  // Create black hole visual
  const bhGroup = new THREE.Group();

  // Core - dark sphere
  const coreGeo = new THREE.SphereGeometry(0.3, 16, 16);
  const coreMat = new THREE.MeshBasicMaterial({
    color: 0x110022,
    transparent: true,
    opacity: 0.9,
  });
  const core = new THREE.Mesh(coreGeo, coreMat);
  bhGroup.add(core);

  // Outer ring - purple vortex
  const ringGeo = new THREE.RingGeometry(0.4, 1.5, 32);
  const ringMat = new THREE.MeshBasicMaterial({
    color: 0x8800ff,
    transparent: true,
    opacity: 0.6,
    side: THREE.DoubleSide,
  });
  const ring = new THREE.Mesh(ringGeo, ringMat);
  ring.rotation.x = Math.PI / 2;
  bhGroup.add(ring);

  // Inner spinning ring
  const innerRingGeo = new THREE.RingGeometry(0.3, 0.5, 16);
  const innerRingMat = new THREE.MeshBasicMaterial({
    color: 0xaa44ff,
    transparent: true,
    opacity: 0.8,
    side: THREE.DoubleSide,
  });
  const innerRing = new THREE.Mesh(innerRingGeo, innerRingMat);
  innerRing.rotation.x = Math.PI / 2;
  bhGroup.add(innerRing);

  // Particle spiral
  const particleCount = 100;
  const particleGeo = new THREE.BufferGeometry();
  const particlePositions = new Float32Array(particleCount * 3);
  for (let j = 0; j < particleCount; j++) {
    const angle = (j / particleCount) * Math.PI * 6;  // 3 spirals
    const radius = 0.3 + (j / particleCount) * 1.2;
    particlePositions[j * 3] = Math.cos(angle) * radius;
    particlePositions[j * 3 + 1] = (Math.random() - 0.5) * 0.5;
    particlePositions[j * 3 + 2] = Math.sin(angle) * radius;
  }
  particleGeo.setAttribute('position', new THREE.BufferAttribute(particlePositions, 3));
  const particleMat = new THREE.PointsMaterial({
    color: 0xcc88ff,
    size: 0.08,
    transparent: true,
    opacity: 0.8,
  });
  const particles = new THREE.Points(particleGeo, particleMat);
  bhGroup.add(particles);

  // Event horizon glow
  const glowGeo = new THREE.SphereGeometry(1.8, 16, 16);
  const glowMat = new THREE.MeshBasicMaterial({
    color: 0x4400aa,
    transparent: true,
    opacity: 0.3,
    side: THREE.BackSide,
  });
  const glow = new THREE.Mesh(glowGeo, glowMat);
  bhGroup.add(glow);

  bhGroup.position.copy(mine.mesh.position);
  bhGroup.position.y = 0.5;

  const blackHole = {
    mesh: bhGroup,
    innerRing,
    particles,
    glowMat,
    ringMat,
    position: bhGroup.position.clone(),
    createdAt: performance.now(),
    duration: mine.blackHoleDuration,
    damage: mine.damage,
    pullRadius: mine.pullRadius,
    stunDuration: mine.stunDuration,
    affectedEnemies: new Set(),
    damageApplied: false,
  };

  scene.add(bhGroup);
  activeBlackHoles.push(blackHole);

  playExplosionSound();
  triggerScreenShake(0.4, 300);
}

function destroyBlackHole(bh) {
  console.log('[Black Hole] Collapsed!');

  // Apply stun to affected enemies
  const enemies = getEnemies();
  bh.affectedEnemies.forEach(idx => {
    if (enemies[idx]) {
      // Apply stun effect
      if (!enemies[idx].statusEffects) {
        enemies[idx].statusEffects = { stun: { stacks: 0, timer: 0 } };
      }
      if (!enemies[idx].statusEffects.stun) {
        enemies[idx].statusEffects.stun = { stacks: 0, timer: 0 };
      }
      enemies[idx].statusEffects.stun.stacks += 1;
      enemies[idx].statusEffects.stun.timer = Math.max(
        enemies[idx].statusEffects.stun.timer,
        bh.stunDuration
      );
    }
  });

  // Visual collapse
  spawnExplosionVisual(bh.position, 1.5);

  // Clean up mesh
  scene.remove(bh.mesh);
  bh.mesh.children.forEach(child => {
    if (child.geometry) child.geometry.dispose();
    if (child.material) child.material.dispose();
  });
}

// Check if projectile hits a mine (for triggering black holes by shooting)
function checkProjectileHitsMine(proj) {
  for (let i = activeMines.length - 1; i >= 0; i--) {
    const mine = activeMines[i];
    if (!mine.armed) continue;

    const dist = proj.position.distanceTo(mine.mesh.position);
    if (dist < 0.3) {
      triggerBlackHole(mine, i);
      return true;
    }
  }
  return false;
}

// ============================================================
//  NANITE SWARM IMPLEMENTATION
// ============================================================

function fireNaniteSwarm(origin, hand, altWeapon) {
  // Limit active swarms
  if (activeNaniteSwarms.length >= MAX_NANITE_SWARMS) {
    // Check if there's already an active swarm from this hand - recall it
    const existingIndex = activeNaniteSwarms.findIndex(s => s.hand === hand);
    if (existingIndex >= 0) {
      // Recall early - remove existing swarm
      const swarm = activeNaniteSwarms[existingIndex];
      destroyNaniteSwarm(swarm);
      activeNaniteSwarms.splice(existingIndex, 1);
      console.log('[Nanite Swarm] Recalled early from', hand, 'hand');
    } else {
      // Remove oldest swarm
      const oldest = activeNaniteSwarms.shift();
      destroyNaniteSwarm(oldest);
    }
  }

  console.log(`[ALT] Nanite Swarm deployed from ${hand} hand`);

  // Create golden shimmering cloud at player position
  const swarmGroup = new THREE.Group();

  // Core sphere - golden glow
  const coreGeo = new THREE.SphereGeometry(0.2, 12, 12);
  const coreMat = new THREE.MeshBasicMaterial({
    color: 0xffd700,  // Gold
    transparent: true,
    opacity: 0.4,
    blending: THREE.AdditiveBlending,
  });
  const core = new THREE.Mesh(coreGeo, coreMat);
  swarmGroup.add(core);

  // Outer glow sphere
  const glowGeo = new THREE.SphereGeometry(altWeapon.radius || 3.0, 24, 24);
  const glowMat = new THREE.MeshBasicMaterial({
    color: 0xffaa00,
    transparent: true,
    opacity: 0.15,
    side: THREE.BackSide,
    blending: THREE.AdditiveBlending,
  });
  const glow = new THREE.Mesh(glowGeo, glowMat);
  swarmGroup.add(glow);

  // Glitter particles - golden sparkles
  const particleCount = 80;
  const particles = [];
  for (let i = 0; i < particleCount; i++) {
    const particleGeo = new THREE.SphereGeometry(0.03, 4, 4);
    const particleMat = new THREE.MeshBasicMaterial({
      color: 0xffff00,
      transparent: true,
      opacity: 0.8,
      blending: THREE.AdditiveBlending,
    });
    const particle = new THREE.Mesh(particleGeo, particleMat);

    // Random position within sphere
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.acos(2 * Math.random() - 1);
    const r = (altWeapon.radius || 3.0) * Math.pow(Math.random(), 0.5);
    particle.position.x = r * Math.sin(phi) * Math.cos(theta);
    particle.position.y = r * Math.sin(phi) * Math.sin(theta);
    particle.position.z = r * Math.cos(phi);

    swarmGroup.add(particle);
    particles.push({
      mesh: particle,
      angle: Math.random() * Math.PI * 2,
      speed: 0.3 + Math.random() * 0.5,
      radius: r,
      phi,
      theta,
      verticalSpeed: (Math.random() - 0.5) * 0.5,
    });
  }

  // Position at player location (use camera position for desktop, controller for VR)
  const playerPos = camera.position.clone();
  swarmGroup.position.copy(playerPos);
  swarmGroup.position.y = 1.0; // Hip height

  // Swarm data
  const swarm = {
    mesh: swarmGroup,
    coreMat,
    glowMat,
    particles,
    hand,
    createdAt: performance.now(),
    expiresAt: performance.now() + (altWeapon.duration || 10000),
    duration: altWeapon.duration || 10000,
    dotDamage: altWeapon.dotDamage || 5,
    radius: altWeapon.radius || 3.0,
    position: swarmGroup.position.clone(),
    affectedEnemies: new Set(),
    lastDotTick: performance.now(),
  };

  scene.add(swarmGroup);
  activeNaniteSwarms.push(swarm);

  playShoothSound();
}

function updateNaniteSwarms(now, dt, playerPos) {
  for (let i = activeNaniteSwarms.length - 1; i >= 0; i--) {
    const swarm = activeNaniteSwarms[i];
    const age = now - swarm.createdAt;

    // Check if expired
    if (age >= swarm.duration) {
      destroyNaniteSwarm(swarm);
      activeNaniteSwarms.splice(i, 1);
      console.log('[Nanite Swarm] Expired');
      continue;
    }

    // Animate particles - swirling glitter effect
    swarm.particles.forEach(p => {
      // Update angle for rotation
      p.angle += p.speed * dt;
      p.phi += p.verticalSpeed * dt * 0.1;

      // Calculate new position
      p.mesh.position.x = p.radius * Math.sin(p.phi) * Math.cos(p.angle);
      p.mesh.position.y = p.radius * Math.sin(p.phi) * Math.sin(p.angle);
      p.mesh.position.z = p.radius * Math.cos(p.phi);

      // Twinkle effect - random opacity
      p.mesh.material.opacity = 0.3 + Math.sin(now * 0.01 + p.angle) * 0.5;
    });

    // Pulse the core
    const pulse = 1 + Math.sin(age * 0.003) * 0.1;
    swarm.mesh.children[0].scale.setScalar(pulse); // Core pulse

    // Pulsing glow opacity
    const glowPulse = 0.15 + Math.sin(age * 0.005) * 0.05;
    swarm.glowMat.opacity = glowPulse;

    // Apply DoT to enemies in cloud every second
    const enemies = getEnemies();
    const dotInterval = 1000; // 1 second between DoT ticks

    if (now - swarm.lastDotTick >= dotInterval) {
      swarm.lastDotTick = now;

      enemies.forEach((e, index) => {
        const dist = e.mesh.position.distanceTo(swarm.position);
        if (dist < swarm.radius) {
          // Apply DoT damage
          const result = hitEnemy(index, swarm.dotDamage);
          spawnDamageNumber(e.mesh.position, swarm.dotDamage, '#ffd700');
          playHitSound();

          // Mark enemy as revealed - add sparkle effect
          if (!e._naniteRevealed) {
            e._naniteRevealed = true;
            // Add visible outline through walls
            if (e.mesh.material) {
              e.mesh.material.emissive = new THREE.Color(0xffd700);
              e.mesh.material.emissiveIntensity = 0.5;
            }
          }

          // Track affected enemy
          if (!swarm.affectedEnemies.has(index)) {
            swarm.affectedEnemies.add(index);
          }

          // Check if killed by DoT
          if (result.killed) {
            const destroyData = destroyEnemy(index);
            if (destroyData) {
              game.kills++;
              game.totalKills++;
              addScore(destroyData.scoreValue);
              updateHUD(game);


              const cfg = game._levelConfig;
              if (cfg && game.kills >= cfg.killTarget) {
                completeLevel();
              }
            }
          }
        }
      });
    }

    // Reveal enemies in range - show them through walls
    enemies.forEach((e, index) => {
      const dist = e.mesh.position.distanceTo(swarm.position);
      if (dist < swarm.radius) {
        e._naniteRevealed = true;
        if (e.mesh.material && !e.mesh._originalOpacity) {
          e.mesh._originalOpacity = e.mesh.material.opacity;
        }
        if (e.mesh.material) {
          e.mesh.material.emissive = new THREE.Color(0xffd700);
          e.mesh.material.emissiveIntensity = 0.5;
        }
      }
    });
  }
}

function destroyNaniteSwarm(swarm) {
  console.log('[Nanite Swarm] Destroyed');

  // Clear reveal effect from enemies
  const enemies = getEnemies();
  enemies.forEach(e => {
    if (e._naniteRevealed) {
      e._naniteRevealed = false;
      if (e.mesh.material) {
        e.mesh.material.emissive = new THREE.Color(0x000000);
        e.mesh.material.emissiveIntensity = 0;
      }
    }
  });

  // Remove mesh
  scene.remove(swarm.mesh);
  swarm.mesh.children.forEach(child => {
    if (child.geometry) child.geometry.dispose();
    if (child.material) child.material.dispose();
  });
}

// Check if projectile passes through nanite swarm and add damage
function checkProjectileNaniteInteraction(proj) {
  for (const swarm of activeNaniteSwarms) {
    const dist = proj.position.distanceTo(swarm.position);
    if (dist < swarm.radius && !proj.userData.naniteInfused) {
      // Projectile carries nanites - mark it
      proj.userData.naniteInfused = true;
      proj.userData.naniteSwarm = swarm;
      // Visual: change projectile color slightly golden
      if (proj.children && proj.children[0]) {
        proj.children[0].material.color.setHex(0xffcc00);
      }
      break;
    }
  }

  return proj.userData.naniteInfused;
}

// ============================================================
//  TETHER HARPOON IMPLEMENTATION
// ============================================================

function fireTetherHarpoon(origin, direction, hand, altWeapon) {
  // Raycast to find enemy within range
  const raycaster = new THREE.Raycaster(origin, direction, 0, altWeapon.range);
  const enemyMeshes = getEnemyMeshes(true);
  const hits = raycaster.intersectObjects(enemyMeshes, true);

  if (hits.length === 0) {
    console.log('[Tether Harpoon] No target in range');
    return;  // No target
  }

  // Find the enemy from the hit mesh
  const result = getEnemyByMesh(hits[0].object);
  if (!result || result.index === undefined) {
    console.log('[Tether Harpoon] Hit but no enemy found');
    return;
  }

  const enemy = result.enemy;
  const enemyIndex = result.index;

  // Check if this enemy is already tethered
  const alreadyTethered = activeTethers.some(t => t.enemyIndex === enemyIndex);
  if (alreadyTethered) {
    console.log('[Tether Harpoon] Enemy already tethered');
    return;
  }

  // Limit active tethers
  if (activeTethers.length >= MAX_TETHERS) {
    const oldest = activeTethers.shift();
    destroyTether(oldest);
  }

  console.log(`[Tether Harpoon] Connected to enemy ${enemyIndex}!`);

  // Create green energy rope visual
  const tetherGroup = new THREE.Group();

  // Main tether line
  const tetherGeo = new THREE.BufferGeometry();
  const positions = new Float32Array(6);  // 2 points * 3 coords
  tetherGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  const tetherMat = new THREE.LineBasicMaterial({
    color: 0x00ff88,
    transparent: true,
    opacity: 0.9,
    linewidth: 2,
  });
  const tetherLine = new THREE.Line(tetherGeo, tetherMat);
  tetherGroup.add(tetherLine);

  // Glow effect
  const glowGeo = new THREE.BufferGeometry();
  glowGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(6), 3));
  const glowMat = new THREE.LineBasicMaterial({
    color: 0x00ff88,
    transparent: true,
    opacity: 0.3,
    linewidth: 4,
  });
  const glowLine = new THREE.Line(glowGeo, glowMat);
  tetherGroup.add(glowLine);

  // Energy particles along tether
  const particleCount = 10;
  const particles = [];
  for (let i = 0; i < particleCount; i++) {
    const particleGeo = new THREE.SphereGeometry(0.03, 4, 4);
    const particleMat = new THREE.MeshBasicMaterial({
      color: 0x00ffaa,
      transparent: true,
      opacity: 0.7,
    });
    const particle = new THREE.Mesh(particleGeo, particleMat);
    particle.userData.offset = i / particleCount;
    particle.userData.speed = 1 + Math.random();
    tetherGroup.add(particle);
    particles.push(particle);
  }

  scene.add(tetherGroup);

  // Create tether data
  const tether = {
    mesh: tetherGroup,
    line: tetherLine,
    glowLine,
    particles,
    lineGeo: tetherGeo,
    glowGeo,
    hand,
    enemyIndex,
    enemy,
    createdAt: performance.now(),
    duration: altWeapon.tetherDuration || 8000,
    damage: altWeapon.damage || 25,
    yankForce: altWeapon.yankForce || 12,
    lastCollisionTime: 0,
    yankActive: false,
    yankStartTime: 0,
  };

  activeTethers.push(tether);
  playShoothSound();
}

function updateTethers(dt, now, playerPos) {
  const enemies = getEnemies();

  for (let i = activeTethers.length - 1; i >= 0; i--) {
    const tether = activeTethers[i];
    const age = now - tether.createdAt;

    // Check if expired
    if (age >= tether.duration) {
      destroyTether(tether);
      activeTethers.splice(i, 1);
      continue;
    }

    // Check if enemy still exists
    const enemy = enemies[tether.enemyIndex];
    if (!enemy) {
      destroyTether(tether);
      activeTethers.splice(i, 1);
      continue;
    }

    // Update tether line positions
    const start = playerPos.clone();
    start.y = Math.max(0.5, start.y);  // Clamp to reasonable height
    const end = enemy.mesh.position.clone();

    // Update main line
    const positions = tether.lineGeo.attributes.position.array;
    positions[0] = start.x;
    positions[1] = start.y;
    positions[2] = start.z;
    positions[3] = end.x;
    positions[4] = end.y;
    positions[5] = end.z;
    tether.lineGeo.attributes.position.needsUpdate = true;

    // Update glow line
    const glowPositions = tether.glowGeo.attributes.position.array;
    glowPositions[0] = start.x;
    glowPositions[1] = start.y;
    glowPositions[2] = start.z;
    glowPositions[3] = end.x;
    glowPositions[4] = end.y;
    glowPositions[5] = end.z;
    tether.glowGeo.attributes.position.needsUpdate = true;

    // Animate particles along tether
    const tetherLength = start.distanceTo(end);
    const direction = new THREE.Vector3().subVectors(end, start).normalize();

    tether.particles.forEach(p => {
      const t = ((now * 0.001 * p.userData.speed + p.userData.offset) % 1);
      const pos = start.clone().addScaledVector(direction, t * tetherLength);
      p.position.copy(pos);
      p.material.opacity = 0.7 * Math.sin(t * Math.PI);  // Fade at ends
    });

    // Calculate tether tension (stretch factor)
    const restLength = 3.0;  // Comfortable tether length
    const stretch = Math.max(0, tetherLength - restLength);

    // Yank mechanic: pull enemy toward player when stretched
    if (stretch > 0) {
      const pullStrength = Math.min(1, stretch / 5) * tether.yankForce * dt;
      const toPlayer = new THREE.Vector3().subVectors(start, end).normalize();
      enemy.mesh.position.addScaledVector(toPlayer, pullStrength);
    }

    // Collision damage: check if tethered enemy hits other enemies
    const collisionCooldown = 500;  // 500ms between collision damage
    if (now - tether.lastCollisionTime > collisionCooldown) {
      for (let j = 0; j < enemies.length; j++) {
        if (j === tether.enemyIndex) continue;

        const otherEnemy = enemies[j];
        const dist = enemy.mesh.position.distanceTo(otherEnemy.mesh.position);

        if (dist < 1.0) {  // Collision radius
          // Apply collision damage to both enemies
          hitEnemy(tether.enemyIndex, tether.damage);
          hitEnemy(j, tether.damage * 0.5);  // Half damage to other enemy

          spawnDamageNumber(enemy.mesh.position, tether.damage, '#00ff88');
          spawnDamageNumber(otherEnemy.mesh.position, tether.damage * 0.5, '#00ff88');

          playHitSound();
          tether.lastCollisionTime = now;

          // Check if killed
          if (enemy.hp <= 0) {
            const destroyData = destroyEnemy(tether.enemyIndex);
            if (destroyData) {
              game.kills++;
              game.totalKills++;
              addScore(destroyData.scoreValue);
              updateHUD(game);
            }
            destroyTether(tether);
            activeTethers.splice(i, 1);
            break;
          }

          // Visual feedback
          spawnExplosionVisual(enemy.mesh.position, 0.5);
        }
      }
    }

    // Pulse opacity based on age (fade out near end)
    const fadeStart = tether.duration * 0.8;
    if (age > fadeStart) {
      const fadeProgress = (age - fadeStart) / (tether.duration - fadeStart);
      tether.line.material.opacity = 0.9 * (1 - fadeProgress);
      tether.glowLine.material.opacity = 0.3 * (1 - fadeProgress);
    }
  }
}

function destroyTether(tether) {
  scene.remove(tether.mesh);
  tether.mesh.children.forEach(child => {
    if (child.geometry) child.geometry.dispose();
    if (child.material) child.material.dispose();
  });
  console.log('[Tether Harpoon] Tether destroyed');
}

// ============================================================
//  PHASE DASH
// ============================================================

/**
 * Fire Phase Dash - instant teleport in movement direction
 * Leaves explosive afterimage that detonates after 1 second
 * Damages enemies in dash path
 */
function firePhaseDash(controller, index, hand, altWeapon, origin, direction) {
  console.log(`[Phase Dash] Teleporting ${hand} hand`);

  const dashDistance = altWeapon.dashDistance || 5;
  const afterimageDamage = altWeapon.afterimageDamage || 40;
  const afterimageDelay = altWeapon.afterimageDelay || 1000;

  // Get player position (camera position)
  const playerPos = camera.position.clone();
  const oldPosition = playerPos.clone();

  // Calculate teleport destination
  // Dash in movement direction (controller aim direction)
  const destination = playerPos.clone().addScaledVector(direction, dashDistance);

  // Clamp destination to ground level
  destination.y = Math.max(0.5, destination.y);

  // Teleport player
  camera.position.copy(destination);
  console.log(`[Phase Dash] Teleported from (${oldPosition.x.toFixed(2)}, ${oldPosition.y.toFixed(2)}, ${oldPosition.z.toFixed(2)}) to (${destination.x.toFixed(2)}, ${destination.y.toFixed(2)}, ${destination.z.toFixed(2)})`);

  // Create blue ghostly afterimage at old position
  const afterimageGroup = new THREE.Group();

  // Main afterimage shell (semi-transparent sphere)
  const shellGeo = new THREE.SphereGeometry(0.4, 16, 16);
  const shellMat = new THREE.MeshBasicMaterial({
    color: 0x4488ff,  // Blue
    transparent: true,
    opacity: 0.6,
    side: THREE.DoubleSide,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  const shell = new THREE.Mesh(shellGeo, shellMat);
  afterimageGroup.add(shell);

  // Pixel dissolution effect (small cubes)
  const pixelCount = 20;
  const pixels = [];
  for (let i = 0; i < pixelCount; i++) {
    const pixelGeo = new THREE.BoxGeometry(0.08, 0.08, 0.08);
    const pixelMat = new THREE.MeshBasicMaterial({
      color: 0x88ccff,
      transparent: true,
      opacity: 0.7,
    });
    const pixel = new THREE.Mesh(pixelGeo, pixelMat);

    // Random position around the shell
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.acos(2 * Math.random() - 1);
    const r = 0.4 + Math.random() * 0.2;
    pixel.position.x = r * Math.sin(phi) * Math.cos(theta);
    pixel.position.y = r * Math.sin(phi) * Math.sin(theta);
    pixel.position.z = r * Math.cos(phi);

    afterimageGroup.add(pixel);
    pixels.push({
      mesh: pixel,
      velocity: new THREE.Vector3(
        (Math.random() - 0.5) * 2,
        (Math.random() - 0.5) * 2,
        (Math.random() - 0.5) * 2
      ),
    });
  }

  afterimageGroup.position.copy(oldPosition);
  afterimageGroup.position.y = Math.max(0.5, oldPosition.y);

  scene.add(afterimageGroup);

  // Add to active afterimages
  const afterimageData = {
    mesh: afterimageGroup,
    shell,
    pixels,
    position: oldPosition.clone(),
    damage: afterimageDamage,
    aoeRadius: 2.0,
    createdAt: performance.now(),
    expiresAt: performance.now() + afterimageDelay,
    hand,
  };
  activePhaseDashAfterimages.push(afterimageData);

  // Check for enemies in dash path and damage them
  const enemies = getEnemies();
  const dashEndPos = destination.clone();
  const dashDir = new THREE.Vector3().subVectors(dashEndPos, oldPosition).normalize();
  const dashLength = oldPosition.distanceTo(dashEndPos);

  enemies.forEach((e, enemyIndex) => {
    const enemyPos = e.mesh.position;

    // Check if enemy is along the dash path
    const toEnemy = new THREE.Vector3().subVectors(enemyPos, oldPosition);
    const projection = toEnemy.dot(dashDir);

    if (projection >= 0 && projection <= dashLength) {
      const closestPoint = oldPosition.clone().addScaledVector(dashDir, projection);
      const distToLine = enemyPos.distanceTo(closestPoint);

      // Damage enemies within 1.5m of dash line
      if (distToLine < 1.5) {
        const dashDamage = Math.round(afterimageDamage * 0.5);  // Half damage during dash
        const result = hitEnemy(enemyIndex, dashDamage);
        spawnDamageNumber(enemyPos, dashDamage, '#4488ff');
        console.log(`[Phase Dash] Hit enemy for ${dashDamage} damage`);

        if (result.killed) {
          const destroyData = destroyEnemy(enemyIndex);
          if (destroyData) {
            game.kills++;
            game.totalKills++;
            addScore(destroyData.scoreValue);
            updateHUD(game);
          }
        }
      }
    }
  });

  playShoothSound();
  triggerScreenShake(0.2, 200);
}

/**
 * Update Phase Dash afterimages
 * Handles pixel dissolution and detonation
 */
function updatePhaseDashAfterimages(now, dt) {
  for (let i = activePhaseDashAfterimages.length - 1; i >= 0; i--) {
    const afterimage = activePhaseDashAfterimages[i];
    const age = now - afterimage.createdAt;

    // Update pixel dissolution effect
    afterimage.pixels.forEach(pixel => {
      // Move pixels outward
      pixel.mesh.position.addScaledVector(pixel.velocity, dt);

      // Fade out pixels over time
      const fadeProgress = age / afterimage.expiresAt;
      pixel.mesh.material.opacity = 0.7 * (1 - fadeProgress);
      pixel.mesh.scale.setScalar(1 - fadeProgress);
    });

    // Check if afterimage should detonate
    if (age >= afterimage.expiresAt) {
      // Detonate - AOE damage
      const enemies = getEnemies();
      enemies.forEach((e, enemyIndex) => {
        const dist = e.mesh.position.distanceTo(afterimage.position);
        if (dist < afterimage.aoeRadius) {
          const damageMultiplier = 1 - (dist / afterimage.aoeRadius);
          const damage = Math.round(afterimage.damage * damageMultiplier);
          const result = hitEnemy(enemyIndex, damage);
          spawnDamageNumber(e.mesh.position, damage, '#88ccff');
          console.log(`[Phase Dash] Afterimage exploded for ${damage} damage`);

          if (result.killed) {
            const destroyData = destroyEnemy(enemyIndex);
            if (destroyData) {
              game.kills++;
              game.totalKills++;
              addScore(destroyData.scoreValue);
              updateHUD(game);
            }
          }
        }
      });

      // Visual explosion
      spawnExplosionVisual(afterimage.position, afterimage.aoeRadius);
      playExplosionSound();
      triggerScreenShake(0.3, 300);

      // Clean up afterimage
      scene.remove(afterimage.mesh);
      afterimage.mesh.children.forEach(child => {
        if (child.geometry) child.geometry.dispose();
        if (child.material) child.material.dispose();
      });
      activePhaseDashAfterimages.splice(i, 1);
      console.log('[Phase Dash] Afterimage detonated');
    }
  }
}

// ============================================================
//  REFLECTOR DRONE IMPLEMENTATION
// ============================================================

/**
 * Fire Reflector Drone - spawns orbiting drone that reflects enemy projectiles
 * Overcharge: player can shoot the drone for 100% reflect but drone takes damage
 */
function fireReflectorDrone(origin, hand, altWeapon) {
  // Limit active drones
  if (activeReflectorDrones.length >= MAX_REFLECTOR_DRONES) {
    // Check if there's already an active drone from this hand - remove it
    const existingIndex = activeReflectorDrones.findIndex(d => d.hand === hand);
    if (existingIndex >= 0) {
      const drone = activeReflectorDrones[existingIndex];
      destroyReflectorDrone(drone);
      activeReflectorDrones.splice(existingIndex, 1);
      console.log('[Reflector Drone] Recalled early from', hand, 'hand');
    } else {
      // Remove oldest drone
      const oldest = activeReflectorDrones.shift();
      destroyReflectorDrone(oldest);
    }
  }

  console.log(`[ALT] Reflector Drone deployed from ${hand} hand`);

  // Create hexagonal drone
  const droneGroup = new THREE.Group();

  // Hexagon body
  const hexShape = new THREE.Shape();
  const hexRadius = 0.2;
  for (let i = 0; i < 6; i++) {
    const angle = (i / 6) * Math.PI * 2 - Math.PI / 2;
    const x = Math.cos(angle) * hexRadius;
    const y = Math.sin(angle) * hexRadius;
    if (i === 0) hexShape.moveTo(x, y);
    else hexShape.lineTo(x, y);
  }
  hexShape.closePath();

  const hexGeo = new THREE.ShapeGeometry(hexShape);
  const hexMat = new THREE.MeshBasicMaterial({
    color: 0x00ffcc,
    transparent: true,
    opacity: 0.9,
    side: THREE.DoubleSide,
  });
  const hexMesh = new THREE.Mesh(hexGeo, hexMat);
  hexMesh.rotation.x = Math.PI / 2;  // Lay flat
  droneGroup.add(hexMesh);

  // Inner glow core
  const coreGeo = new THREE.SphereGeometry(0.08, 8, 8);
  const coreMat = new THREE.MeshBasicMaterial({
    color: 0x00ffcc,
    transparent: true,
    opacity: 0.8,
  });
  const core = new THREE.Mesh(coreGeo, coreMat);
  droneGroup.add(core);

  // Shimmering shield effect (semi-transparent sphere)
  const shieldGeo = new THREE.SphereGeometry(0.4, 16, 16);
  const shieldMat = new THREE.MeshBasicMaterial({
    color: 0x00ffcc,
    transparent: true,
    opacity: 0.2,
    side: THREE.BackSide,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  const shield = new THREE.Mesh(shieldGeo, shieldMat);
  droneGroup.add(shield);

  // Orbiting particles
  const particleCount = 12;
  const particles = [];
  for (let i = 0; i < particleCount; i++) {
    const particleGeo = new THREE.SphereGeometry(0.02, 4, 4);
    const particleMat = new THREE.MeshBasicMaterial({
      color: 0x00ffaa,
      transparent: true,
      opacity: 0.7,
    });
    const particle = new THREE.Mesh(particleGeo, particleMat);
    particle.userData.orbitAngle = (i / particleCount) * Math.PI * 2;
    particle.userData.orbitRadius = 0.25;
    droneGroup.add(particle);
    particles.push(particle);
  }

  // Position at player location
  const playerPos = camera.position.clone();
  droneGroup.position.copy(playerPos);
  droneGroup.position.y = 1.2;  // Chest height

  scene.add(droneGroup);

  // Drone data
  const drone = {
    mesh: droneGroup,
    hexMesh,
    hexMat,
    coreMat,
    shieldMat,
    particles,
    hand,
    createdAt: performance.now(),
    expiresAt: performance.now() + (altWeapon.duration || 15000),
    duration: altWeapon.duration || 15000,
    reflectChance: altWeapon.reflectChance || 0.5,
    overchargeReflect: altWeapon.overchargeReflect || 1.0,
    health: altWeapon.droneHealth || 50,
    maxHealth: altWeapon.droneHealth || 50,
    orbitRadius: altWeapon.orbitRadius || 2.0,
    orbitSpeed: altWeapon.orbitSpeed || 1.5,
    orbitAngle: 0,
    overcharged: false,
    lastReflectTime: 0,
  };

  activeReflectorDrones.push(drone);
  playShoothSound();
}

/**
 * Update Reflector Drones - orbit player, check for projectile reflection
 */
function updateReflectorDrones(now, dt, playerPos) {
  for (let i = activeReflectorDrones.length - 1; i >= 0; i--) {
    const drone = activeReflectorDrones[i];
    const age = now - drone.createdAt;

    // Check if expired
    if (age >= drone.duration || drone.health <= 0) {
      if (drone.health <= 0) {
        console.log('[Reflector Drone] Destroyed!');
        spawnExplosionVisual(drone.mesh.position, 0.5);
        playExplosionSound();
      }
      destroyReflectorDrone(drone);
      activeReflectorDrones.splice(i, 1);
      continue;
    }

    // Orbit around player
    drone.orbitAngle += drone.orbitSpeed * dt;
    const orbitX = Math.cos(drone.orbitAngle) * drone.orbitRadius;
    const orbitZ = Math.sin(drone.orbitAngle) * drone.orbitRadius;

    drone.mesh.position.x = playerPos.x + orbitX;
    drone.mesh.position.z = playerPos.z + orbitZ;
    drone.mesh.position.y = 1.2 + Math.sin(age * 0.002) * 0.1;  // Gentle bob

    // Rotate drone
    drone.mesh.rotation.y = -drone.orbitAngle + Math.PI / 2;

    // Animate orbiting particles
    drone.particles.forEach((p, idx) => {
      p.userData.orbitAngle += dt * 3;
      const radius = p.userData.orbitRadius;
      p.position.x = Math.cos(p.userData.orbitAngle) * radius;
      p.position.z = Math.sin(p.userData.orbitAngle) * radius;
      p.position.y = Math.sin(age * 0.005 + idx) * 0.05;
    });

    // Pulse shield effect
    const shieldPulse = 0.15 + Math.sin(age * 0.008) * 0.05;
    drone.shieldMat.opacity = shieldPulse;

    // Change color based on overcharge state
    if (drone.overcharged) {
      drone.hexMat.color.setHex(0xff6600);  // Orange when overcharged
      drone.shieldMat.color.setHex(0xff6600);
      drone.coreMat.color.setHex(0xff6600);
    } else {
      drone.hexMat.color.setHex(0x00ffcc);  // Cyan-green normally
      drone.shieldMat.color.setHex(0x00ffcc);
      drone.coreMat.color.setHex(0x00ffcc);
    }

    // Fade out near end of duration
    const fadeStart = drone.duration * 0.85;
    if (age > fadeStart) {
      const fadeProgress = (age - fadeStart) / (drone.duration - fadeStart);
      drone.hexMat.opacity = 0.9 * (1 - fadeProgress);
      drone.coreMat.opacity = 0.8 * (1 - fadeProgress);
      drone.shieldMat.opacity = Math.min(drone.shieldMat.opacity, 0.2 * (1 - fadeProgress));
    }
  }
}

/**
 * Check if enemy projectile should be reflected by a drone
 * @returns {boolean} true if projectile was reflected
 */
function checkReflectorDroneReflection(projPos, isBossProjectile = false) {
  for (const drone of activeReflectorDrones) {
    const dist = projPos.distanceTo(drone.mesh.position);
    if (dist < 0.5) {  // Within drone shield radius
      // Determine reflect chance
      const reflectChance = drone.overcharged ? drone.overchargeReflect : drone.reflectChance;

      if (Math.random() < reflectChance) {
        // Reflect the projectile!
        console.log(`[Reflector Drone] Reflected projectile! (${drone.overcharged ? '100%' : '50%'} chance)`);
        spawnExplosionVisual(projPos, 0.3);
        playHitSound();
        drone.lastReflectTime = performance.now();

        return true;  // Projectile reflected
      }
    }
  }
  return false;
}

/**
 * Check if player projectile hits a drone (overcharge mechanic)
 * @returns {boolean} true if drone was hit
 */
function checkPlayerProjectileHitsDrone(projPos, projControllerIndex) {
  for (let i = 0; i < activeReflectorDrones.length; i++) {
    const drone = activeReflectorDrones[i];

    // Don't let the same hand that spawned the drone hit it
    const droneHand = drone.hand;
    const projHand = getHandForController(projControllerIndex);
    if (droneHand === projHand) continue;

    const dist = projPos.distanceTo(drone.mesh.position);
    if (dist < 0.3) {  // Hit drone
      // Overcharge the drone (100% reflect but takes damage)
      drone.overcharged = true;
      drone.health -= 10;  // 10 damage per shot

      console.log(`[Reflector Drone] Overcharged! Health: ${drone.health}/${drone.maxHealth}`);

      // Visual feedback
      drone.hexMat.color.setHex(0xff6600);  // Flash orange
      drone.shieldMat.color.setHex(0xff6600);
      spawnDamageNumber(drone.mesh.position, 10, '#ff6600');
      playHitSound();

      // Spawn reflected projectile back at nearest enemy
      spawnReflectedProjectile(drone.mesh.position.clone());

      return true;
    }
  }
  return false;
}

/**
 * Spawn a reflected projectile from drone position
 */
function spawnReflectedProjectile(origin) {
  // Find nearest enemy
  const enemies = getEnemies();
  let nearestEnemy = null;
  let nearestDist = 20;

  enemies.forEach(e => {
    const dist = e.mesh.position.distanceTo(origin);
    if (dist < nearestDist) {
      nearestDist = dist;
      nearestEnemy = e;
    }
  });

  // Also check boss
  const boss = getBoss();
  if (boss) {
    const dist = boss.mesh.position.distanceTo(origin);
    if (dist < nearestDist) {
      nearestDist = dist;
      nearestEnemy = boss;
    }
  }

  if (!nearestEnemy) {
    // No target, just shoot forward
    return;
  }

  // Create reflected projectile
  const direction = new THREE.Vector3()
    .subVectors(nearestEnemy.mesh ? nearestEnemy.mesh.position : nearestEnemy.position, origin)
    .normalize();

  const reflectedGeo = new THREE.SphereGeometry(0.05, 8, 8);
  const reflectedMat = new THREE.MeshBasicMaterial({
    color: 0x00ffcc,
    transparent: true,
    opacity: 0.9,
  });
  const reflectedProj = new THREE.Mesh(reflectedGeo, reflectedMat);
  reflectedProj.position.copy(origin);
  reflectedProj.userData.velocity = direction.clone().multiplyScalar(30);
  reflectedProj.userData.createdAt = performance.now();
  reflectedProj.userData.lifetime = 2000;
  reflectedProj.userData.damage = 20;
  reflectedProj.userData.isReflected = true;
  scene.add(reflectedProj);
  projectiles.push(reflectedProj);

  console.log('[Reflector Drone] Spawned reflected projectile');
}

/**
 * Destroy a reflector drone
 */
function destroyReflectorDrone(drone) {
  scene.remove(drone.mesh);
  drone.mesh.children.forEach(child => {
    if (child.geometry) child.geometry.dispose();
    if (child.material) child.material.dispose();
  });
  console.log('[Reflector Drone] Destroyed');
}

// ============================================================
//  STASIS FIELD
// ============================================================
function fireStasisField(origin, direction, hand, altWeapon) {
  // Create stasis field at target location
  const targetPosition = origin.clone().addScaledVector(direction, 8); // 8 units forward

  // Create visual sphere (blue translucent)
  const radius = altWeapon.radius || 3.0;
  const geometry = new THREE.SphereGeometry(radius, 24, 24);
  const material = new THREE.MeshBasicMaterial({
    color: 0x4488ff,
    transparent: true,
    opacity: 0.3,
    side: THREE.BackSide,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.copy(targetPosition);
  scene.add(mesh);

  // Create particle effect (blue particles swirling)
  const particleCount = 30;
  const particles = [];
  for (let i = 0; i < particleCount; i++) {
    const particleGeo = new THREE.SphereGeometry(0.05, 4, 4);
    const particleMat = new THREE.MeshBasicMaterial({
      color: 0x88ccff,
      transparent: true,
      opacity: 0.6,
      blending: THREE.AdditiveBlending,
    });
    const particle = new THREE.Mesh(particleGeo, particleMat);

    // Random position on sphere surface
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.acos(2 * Math.random() - 1);
    const r = radius * 0.9 + Math.random() * 0.2;
    particle.position.x = r * Math.sin(phi) * Math.cos(theta);
    particle.position.y = r * Math.sin(phi) * Math.sin(theta);
    particle.position.z = r * Math.cos(phi);

    mesh.add(particle);
    particles.push({
      mesh: particle,
      angle: Math.random() * Math.PI * 2,
      speed: 0.5 + Math.random() * 0.5,
      heightOffset: Math.random() * Math.PI * 2,
    });
  }

  // Add to active stasis fields
  const expiresAt = performance.now() + (altWeapon.duration || 5000);
  activeStasisFields.push({
    mesh,
    position: targetPosition,
    radius,
    expiresAt,
    slowFactor: altWeapon.slowFactor || 0.2,
    particles,
  });

  console.log(`[Stasis Field] Created at (${targetPosition.x.toFixed(2)}, ${targetPosition.y.toFixed(2)}, ${targetPosition.z.toFixed(2)}) for ${altWeapon.duration / 1000}s`);
}

function updateStasisFields(now, dt) {
  for (let i = activeStasisFields.length - 1; i >= 0; i--) {
    const field = activeStasisFields[i];

    // Remove expired fields
    if (now > field.expiresAt) {
      scene.remove(field.mesh);
      field.mesh.geometry.dispose();
      field.mesh.material.dispose();
      activeStasisFields.splice(i, 1);
      continue;
    }

    // Animate particles (swirling effect)
    field.particles.forEach(p => {
      p.angle += p.speed * dt;
      p.mesh.position.x = field.radius * Math.sin(p.angle) * Math.cos(p.heightOffset);
      p.mesh.position.z = field.radius * Math.sin(p.angle) * Math.sin(p.heightOffset);
      p.mesh.position.y = field.radius * Math.cos(p.angle);
    });

    // Pulsing opacity
    const age = now - (field.expiresAt - (field.slowFactor ? 5000 : 5000));
    const pulse = Math.sin(age * 0.005) * 0.1 + 0.3;
    field.mesh.material.opacity = pulse;
  }
}

// ============================================================
//  PLASMA ORB
// ============================================================
function firePlasmaOrb(origin, direction, hand, altWeapon) {
  // Create plasma orb
  const geometry = new THREE.SphereGeometry(0.15, 16, 16);
  const material = new THREE.MeshBasicMaterial({
    color: 0xaa44ff,
    transparent: true,
    opacity: 0.8,
    blending: THREE.AdditiveBlending,
  });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.copy(origin);
  scene.add(mesh);

  // Add glow trail (smaller trailing spheres)
  const trailLength = 8;
  const trailParticles = [];
  for (let i = 0; i < trailLength; i++) {
    const trailGeo = new THREE.SphereGeometry(0.08, 8, 8);
    const trailMat = new THREE.MeshBasicMaterial({
      color: 0xcc66ff,
      transparent: true,
      opacity: 0.5 - (i * 0.05),
      blending: THREE.AdditiveBlending,
    });
    const trail = new THREE.Mesh(trailGeo, trailMat);
    trail.position.copy(origin);
    trail.visible = false;
    scene.add(trail);
    trailParticles.push({ mesh: trail, age: 0 });
  }

  // Calculate velocity
  const speed = altWeapon.speed || 5;
  const velocity = direction.clone().multiplyScalar(speed);

  // Add to active plasma orbs
  const expiresAt = performance.now() + 10000; // 10 second lifetime
  activePlasmaOrbs.push({
    mesh,
    velocity,
    damage: altWeapon.damage || 75,
    aoeRadius: altWeapon.aoeRadius || 2.0,
    homingRange: altWeapon.homingRange || 15,
    expiresAt,
    detonatable: altWeapon.detonateOnHit !== false,
    trailParticles,
    lastTrailUpdate: performance.now(),
  });

  console.log(`[Plasma Orb] Fired from ${hand} hand, damage: ${altWeapon.damage}`);
}

function updatePlasmaOrbs(now, dt) {
  for (let i = activePlasmaOrbs.length - 1; i >= 0; i--) {
    const orb = activePlasmaOrbs[i];

    // Remove expired orbs
    if (now > orb.expiresAt) {
      // Remove trail particles
      orb.trailParticles.forEach(t => {
        scene.remove(t.mesh);
        t.mesh.geometry.dispose();
        t.mesh.material.dispose();
      });
      scene.remove(orb.mesh);
      orb.mesh.geometry.dispose();
      orb.mesh.material.dispose();
      activePlasmaOrbs.splice(i, 1);
      continue;
    }

    // Find nearest enemy for homing
    const enemies = getEnemies();
    let nearestEnemy = null;
    let nearestDist = orb.homingRange;

    enemies.forEach(e => {
      const dist = e.mesh.position.distanceTo(orb.mesh.position);
      if (dist < nearestDist) {
        nearestDist = dist;
        nearestEnemy = e;
      }
    });

    // Homing behavior: steer towards nearest enemy
    if (nearestEnemy) {
      const toEnemy = new THREE.Vector3()
        .subVectors(nearestEnemy.mesh.position, orb.mesh.position)
        .normalize();
      const homingStrength = 3.0; // Steering force
      orb.velocity.lerp(toEnemy.multiplyScalar(orb.velocity.length()), homingStrength * dt);
    }

    // Move orb
    orb.mesh.position.addScaledVector(orb.velocity, dt);

    // Update trail particles
    if (now - orb.lastTrailUpdate > 50) { // Update every 50ms
      orb.lastTrailUpdate = now;

      // Shift trail particles
      for (let j = orb.trailParticles.length - 1; j > 0; j--) {
        orb.trailParticles[j].mesh.position.copy(orb.trailParticles[j - 1].mesh.position);
        orb.trailParticles[j].mesh.visible = true;
        orb.trailParticles[j].age = orb.trailParticles[j - 1].age + dt;
      }

      // First particle follows orb
      orb.trailParticles[0].mesh.position.copy(orb.mesh.position);
      orb.trailParticles[0].mesh.visible = true;
      orb.trailParticles[0].age = 0;

      // Fade out trail particles based on age
      orb.trailParticles.forEach(t => {
        const maxAge = 0.5; // Trail particles last 0.5 seconds
        const opacity = Math.max(0, 0.5 * (1 - t.age / maxAge));
        t.mesh.material.opacity = opacity;
        if (t.age >= maxAge) t.mesh.visible = false;
      });
    }

    // Check collision with enemies
    enemies.forEach((e, index) => {
      const dist = orb.mesh.position.distanceTo(e.mesh.position);
      if (dist < 0.3) { // Collision radius
        // Detonate orb
        detonatePlasmaOrb(orb, index);
        return; // Exit loop after detonation
      }
    });

    // Check if orb can be shot by player (detonate early)
    // This is handled in projectile collision detection
  }
}

function detonatePlasmaOrb(orb, enemyIndex) {
  // Apply damage to enemy
  if (enemyIndex !== undefined) {
    const result = hitEnemy(enemyIndex, orb.damage);
    spawnDamageNumber(orb.mesh.position, orb.damage, '#aa44ff');

    if (result.killed) {
      playExplosionSound();
      const destroyData = destroyEnemy(enemyIndex);
      if (destroyData) {
        game.kills++;
        game.totalKills++;
        game.killsWithoutHit++;
        addScore(destroyData.scoreValue);

        // Update HUD
        updateHUD(game);

        // Check level complete
        const cfg = game._levelConfig;
        if (cfg && game.kills >= cfg.killTarget) {
          completeLevel();
        }
      }
    }
  }

  // AOE damage to nearby enemies
  if (orb.aoeRadius > 0) {
    const enemies = getEnemies();
    enemies.forEach((e, i) => {
      if (i === enemyIndex) return; // Skip the enemy we already hit
      const dist = e.mesh.position.distanceTo(orb.mesh.position);
      if (dist < orb.aoeRadius) {
        const aoeDamage = orb.damage * 0.5 * (1 - dist / orb.aoeRadius);
        hitEnemy(i, aoeDamage);
        spawnDamageNumber(e.mesh.position, aoeDamage, '#aa44ff');
      }
    });
  }

  // Visual explosion
  spawnExplosionVisual(orb.mesh.position, orb.aoeRadius || 2.0);

  // Remove orb and trail
  orb.trailParticles.forEach(t => {
    scene.remove(t.mesh);
    t.mesh.geometry.dispose();
    t.mesh.material.dispose();
  });
  scene.remove(orb.mesh);
  orb.mesh.geometry.dispose();
  orb.mesh.material.dispose();

  // Remove from active array
  const index = activePlasmaOrbs.indexOf(orb);
  if (index !== -1) {
    activePlasmaOrbs.splice(index, 1);
  }

  console.log('[Plasma Orb] Detonated!');
}

// Check if player projectiles can detonate plasma orbs
function checkPlasmaOrbDetonation(proj) {
  for (let i = activePlasmaOrbs.length - 1; i >= 0; i--) {
    const orb = activePlasmaOrbs[i];
    if (!orb.detonatable) continue;

    const dist = proj.position.distanceTo(orb.mesh.position);
    if (dist < 0.5) { // Player projectile hit orb
      // Detonate orb with smaller AOE (early detonation)
      orb.aoeRadius *= 0.6; // 60% of normal radius
      detonatePlasmaOrb(orb, undefined);
      console.log('[Plasma Orb] Detonated early by player shot!');
      return true;
    }
  }
  return false;
}

// ============================================================
//  GRENADE - Throwable explosive
// ============================================================

const activeGrenades = [];
const MAX_GRENADES = 5;

function fireGrenade(origin, direction, hand, altWeapon) {
  // Limit active grenades
  if (activeGrenades.length >= MAX_GRENADES) {
    const oldest = activeGrenades.shift();
    destroyGrenade(oldest);
  }

  console.log(`[Grenade] Thrown from ${hand} hand`);

  // Create grenade mesh (small red sphere)
  const grenadeGeo = new THREE.SphereGeometry(0.1, 8, 8);
  const grenadeMat = new THREE.MeshBasicMaterial({
    color: 0xff4444,
    transparent: true,
    opacity: 0.9,
  });
  const grenade = new THREE.Mesh(grenadeGeo, grenadeMat);

  // Add glow
  const glowGeo = new THREE.SphereGeometry(0.15, 8, 8);
  const glowMat = new THREE.MeshBasicMaterial({
    color: 0xff4444,
    transparent: true,
    opacity: 0.3,
    side: THREE.BackSide,
  });
  const glow = new THREE.Mesh(glowGeo, glowMat);
  grenade.add(glow);

  grenade.position.copy(origin);

  const grenadeData = {
    mesh: grenade,
    glowMat,
    velocity: direction.clone().multiplyScalar(12), // Toss speed
    createdAt: performance.now(),
    hand,
    damage: altWeapon.damage || 40,
    aoeRadius: altWeapon.aoeRadius || 2.0,
    fuseTime: 2000, // 2 second fuse
    bounceCount: 0,
  };

  scene.add(grenade);
  activeGrenades.push(grenadeData);
  playShoothSound();
}

function updateGrenades(dt, now) {
  for (let i = activeGrenades.length - 1; i >= 0; i--) {
    const grenade = activeGrenades[i];
    const age = now - grenade.createdAt;

    // Apply gravity
    grenade.velocity.y -= 9.8 * dt;

    // Move grenade
    grenade.mesh.position.addScaledVector(grenade.velocity, dt);

    // Ground collision with bounce
    if (grenade.mesh.position.y < 0.1) {
      grenade.mesh.position.y = 0.1;
      grenade.velocity.y *= -0.4; // Bounce
      grenade.velocity.x *= 0.7; // Friction
      grenade.velocity.z *= 0.7;
      grenade.bounceCount++;
    }

    // Pulse glow effect
    const pulse = 0.3 + Math.sin(age * 0.02) * 0.15;
    grenade.glowMat.opacity = pulse;

    // Check fuse timer
    if (age >= grenade.fuseTime) {
      detonateGrenade(grenade, i);
    }
  }
}

function detonateGrenade(grenade, index) {
  console.log('[Grenade] Detonated!');

  // AOE damage to enemies
  const enemies = getEnemies();
  enemies.forEach((e, i) => {
    const dist = e.mesh.position.distanceTo(grenade.mesh.position);
    if (dist < grenade.aoeRadius) {
      const damageMultiplier = 1 - (dist / grenade.aoeRadius);
      const damage = Math.round(grenade.damage * damageMultiplier);
      const result = hitEnemy(i, damage);
      spawnDamageNumber(e.mesh.position, damage, '#ff4444');

      if (result.killed) {
        const destroyData = destroyEnemy(i);
        if (destroyData) {
          game.kills++;
          game.totalKills++;
          addScore(destroyData.scoreValue);
          updateHUD(game);

          const cfg = game._levelConfig;
          if (cfg && game.kills >= cfg.killTarget) {
            completeLevel();
          }
        }
      }
    }
  });

  // Visual explosion
  spawnExplosionVisual(grenade.mesh.position, grenade.aoeRadius);
  playExplosionSound();
  triggerScreenShake(0.3, 300);

  // Remove grenade
  destroyGrenade(grenade);
  activeGrenades.splice(index, 1);
}

function destroyGrenade(grenade) {
  scene.remove(grenade.mesh);
  grenade.mesh.geometry.dispose();
  grenade.mesh.material.dispose();
}

// ============================================================
//  PROXIMITY MINE - Placeable explosive trap
// ============================================================

const activeProximityMines = [];
const MAX_PROXIMITY_MINES = 3;

function fireProximityMine(origin, hand, altWeapon) {
  // Limit active mines per hand
  const handMines = activeProximityMines.filter(m => m.hand === hand);
  if (handMines.length >= (altWeapon.maxActive || 3)) {
    // Remove oldest mine from this hand
    const oldest = handMines[0];
    destroyProximityMine(oldest);
    const idx = activeProximityMines.indexOf(oldest);
    if (idx >= 0) activeProximityMines.splice(idx, 1);
  }

  console.log(`[Mine] Placed from ${hand} hand`);

  // Create mine mesh (orange icosahedron)
  const mineGeo = new THREE.IcosahedronGeometry(0.12, 0);
  const mineMat = new THREE.MeshBasicMaterial({
    color: 0xffaa00,
    transparent: true,
    opacity: 0.9,
  });
  const mine = new THREE.Mesh(mineGeo, mineMat);

  // Add glow
  const glowGeo = new THREE.SphereGeometry(0.2, 8, 8);
  const glowMat = new THREE.MeshBasicMaterial({
    color: 0xffaa00,
    transparent: true,
    opacity: 0.3,
    side: THREE.BackSide,
  });
  const glow = new THREE.Mesh(glowGeo, glowMat);
  mine.add(glow);

  // Place at ground level
  mine.position.copy(origin);
  mine.position.y = 0.15;

  const mineData = {
    mesh: mine,
    glowMat,
    hand,
    position: mine.position.clone(),
    placedAt: performance.now(),
    armedAt: performance.now() + 1000, // 1 second arm time
    damage: altWeapon.damage || 60,
    aoeRadius: altWeapon.aoeRadius || 2.5,
    triggerRadius: 2.0,
    isArmed: false,
    pulsePhase: Math.random() * Math.PI * 2,
  };

  scene.add(mine);
  activeProximityMines.push(mineData);
  playShoothSound();
}

function updateProximityMines(now, dt) {
  const enemies = getEnemies();

  for (let i = activeProximityMines.length - 1; i >= 0; i--) {
    const mine = activeProximityMines[i];
    const age = now - mine.placedAt;

    // Pulsing glow effect
    mine.pulsePhase += dt * 3;
    const pulse = 0.2 + Math.sin(mine.pulsePhase) * 0.15;
    mine.glowMat.opacity = pulse;

    // Rotate mine
    mine.mesh.rotation.x += dt * 0.5;
    mine.mesh.rotation.y += dt * 0.7;

    // Check if armed
    if (!mine.isArmed && now >= mine.armedAt) {
      mine.isArmed = true;
      mine.mesh.material.color.setHex(0xffcc00); // Brighter when armed
      console.log('[Mine] Armed!');
    }

    // Not armed yet - skip proximity check
    if (!mine.isArmed) continue;

    // Check for enemy proximity
    for (const e of enemies) {
      const dist = e.mesh.position.distanceTo(mine.position);
      if (dist < mine.triggerRadius) {
        detonateProximityMine(mine, i);
        break;
      }
    }
  }
}

function detonateProximityMine(mine, index) {
  console.log('[Mine] Detonated!');

  // AOE damage to enemies
  const enemies = getEnemies();
  enemies.forEach((e, i) => {
    const dist = e.mesh.position.distanceTo(mine.position);
    if (dist < mine.aoeRadius) {
      const damageMultiplier = 1 - (dist / mine.aoeRadius);
      const damage = Math.round(mine.damage * damageMultiplier);
      const result = hitEnemy(i, damage);
      spawnDamageNumber(e.mesh.position, damage, '#ffaa00');

      if (result.killed) {
        const destroyData = destroyEnemy(i);
        if (destroyData) {
          game.kills++;
          game.totalKills++;
          addScore(destroyData.scoreValue);
          updateHUD(game);

          const cfg = game._levelConfig;
          if (cfg && game.kills >= cfg.killTarget) {
            completeLevel();
          }
        }
      }
    }
  });

  // Visual explosion
  spawnExplosionVisual(mine.position, mine.aoeRadius);
  playExplosionSound();
  triggerScreenShake(0.4, 350);

  // Remove mine
  destroyProximityMine(mine);
  activeProximityMines.splice(index, 1);
}

function destroyProximityMine(mine) {
  scene.remove(mine.mesh);
  mine.mesh.geometry.dispose();
  mine.mesh.material.dispose();
}

// ============================================================
//  ATTACK DRONE - Orbiting auto-targeting helper
// ============================================================

const activeAttackDrones = [];
const MAX_ATTACK_DRONES = 2;

function fireAttackDrone(origin, hand, altWeapon) {
  // Limit active drones
  const handDrones = activeAttackDrones.filter(d => d.hand === hand);
  if (handDrones.length >= MAX_ATTACK_DRONES) {
    const oldest = handDrones[0];
    destroyAttackDrone(oldest);
    const idx = activeAttackDrones.indexOf(oldest);
    if (idx >= 0) activeAttackDrones.splice(idx, 1);
  }

  console.log(`[Drone] Deployed from ${hand} hand`);

  // Create drone mesh (green hexagon)
  const droneGroup = new THREE.Group();

  // Hexagon body
  const hexShape = new THREE.Shape();
  const hexRadius = 0.15;
  for (let i = 0; i < 6; i++) {
    const angle = (i / 6) * Math.PI * 2 - Math.PI / 2;
    const x = Math.cos(angle) * hexRadius;
    const y = Math.sin(angle) * hexRadius;
    if (i === 0) hexShape.moveTo(x, y);
    else hexShape.lineTo(x, y);
  }
  hexShape.closePath();

  const hexGeo = new THREE.ShapeGeometry(hexShape);
  const hexMat = new THREE.MeshBasicMaterial({
    color: 0x88ff88,
    transparent: true,
    opacity: 0.9,
    side: THREE.DoubleSide,
  });
  const hex = new THREE.Mesh(hexGeo, hexMat);
  hex.rotation.x = Math.PI / 2;
  droneGroup.add(hex);

  // Core glow
  const coreGeo = new THREE.SphereGeometry(0.06, 8, 8);
  const coreMat = new THREE.MeshBasicMaterial({
    color: 0x88ff88,
    transparent: true,
    opacity: 0.8,
  });
  const core = new THREE.Mesh(coreGeo, coreMat);
  droneGroup.add(core);

  // Outer glow
  const glowGeo = new THREE.SphereGeometry(0.25, 12, 12);
  const glowMat = new THREE.MeshBasicMaterial({
    color: 0x88ff88,
    transparent: true,
    opacity: 0.2,
    side: THREE.BackSide,
  });
  const glow = new THREE.Mesh(glowGeo, glowMat);
  droneGroup.add(glow);

  // Position at player location
  const playerPos = camera.position.clone();
  droneGroup.position.copy(playerPos);
  droneGroup.position.y = 1.2;

  scene.add(droneGroup);

  const droneData = {
    mesh: droneGroup,
    coreMat,
    glowMat,
    hand,
    createdAt: performance.now(),
    expiresAt: performance.now() + (altWeapon.duration || 10000),
    damage: altWeapon.damage || 8,
    fireInterval: altWeapon.fireInterval || 200,
    lastFireTime: 0,
    orbitAngle: Math.random() * Math.PI * 2,
    orbitRadius: 2.0,
    orbitSpeed: 1.5,
  };

  activeAttackDrones.push(droneData);
  playShoothSound();
}

function updateAttackDrones(now, dt, playerPos) {
  for (let i = activeAttackDrones.length - 1; i >= 0; i--) {
    const drone = activeAttackDrones[i];
    const age = now - drone.createdAt;

    // Check if expired
    if (now >= drone.expiresAt) {
      destroyAttackDrone(drone);
      activeAttackDrones.splice(i, 1);
      console.log('[Drone] Expired');
      continue;
    }

    // Orbit around player
    drone.orbitAngle += drone.orbitSpeed * dt;
    const orbitX = Math.cos(drone.orbitAngle) * drone.orbitRadius;
    const orbitZ = Math.sin(drone.orbitAngle) * drone.orbitRadius;

    drone.mesh.position.x = playerPos.x + orbitX;
    drone.mesh.position.z = playerPos.z + orbitZ;
    drone.mesh.position.y = 1.2 + Math.sin(age * 0.002) * 0.1;

    // Rotate drone
    drone.mesh.rotation.y = -drone.orbitAngle + Math.PI / 2;

    // Pulse glow
    const pulse = 0.15 + Math.sin(age * 0.008) * 0.05;
    drone.glowMat.opacity = pulse;

    // Fire at nearest enemy
    if (now - drone.lastFireTime >= drone.fireInterval) {
      const enemies = getEnemies();
      let nearestEnemy = null;
      let nearestDist = 15;

      enemies.forEach(e => {
        const dist = e.mesh.position.distanceTo(drone.mesh.position);
        if (dist < nearestDist) {
          nearestDist = dist;
          nearestEnemy = e;
        }
      });

      if (nearestEnemy) {
        // Fire projectile at enemy
        const direction = new THREE.Vector3()
          .subVectors(nearestEnemy.mesh.position, drone.mesh.position)
          .normalize();

        // Create small projectile
        const projGeo = new THREE.SphereGeometry(0.04, 6, 6);
        const projMat = new THREE.MeshBasicMaterial({
          color: 0x88ff88,
          transparent: true,
          opacity: 0.8,
        });
        const proj = new THREE.Mesh(projGeo, projMat);
        proj.position.copy(drone.mesh.position);
        proj.userData.velocity = direction.clone().multiplyScalar(25);
        proj.userData.createdAt = now;
        proj.userData.lifetime = 1500;
        proj.userData.damage = drone.damage;
        proj.userData.isDroneProjectile = true;
        scene.add(proj);
        projectiles.push(proj);

        drone.lastFireTime = now;
      }
    }

    // Fade out near end
    const fadeStart = (drone.expiresAt - drone.createdAt) * 0.85;
    if (age > fadeStart) {
      const fadeProgress = (age - fadeStart) / ((drone.expiresAt - drone.createdAt) - fadeStart);
      drone.coreMat.opacity = 0.8 * (1 - fadeProgress);
      drone.glowMat.opacity = Math.min(drone.glowMat.opacity, 0.2 * (1 - fadeProgress));
    }
  }
}

function destroyAttackDrone(drone) {
  scene.remove(drone.mesh);
  drone.mesh.children.forEach(child => {
    if (child.geometry) child.geometry.dispose();
    if (child.material) child.material.dispose();
  });
}

// ============================================================
//  EMP - Area effect that stuns/shocks enemies
// ============================================================

function fireEMP(origin, hand, altWeapon) {
  console.log(`[EMP] Activated from ${hand} hand`);

  const range = altWeapon.range || 5;
  const duration = altWeapon.duration || 3000;
  const playerPos = camera.position.clone();

  // Create expanding ring effect
  const ringGeo = new THREE.RingGeometry(0.1, range, 32);
  const ringMat = new THREE.MeshBasicMaterial({
    color: 0x00ffff,
    transparent: true,
    opacity: 0.6,
    side: THREE.DoubleSide,
  });
  const ring = new THREE.Mesh(ringGeo, ringMat);
  ring.position.copy(playerPos);
  ring.position.y = 1.0;
  ring.rotation.x = Math.PI / 2;
  scene.add(ring);

  // Track for animation
  const empData = {
    ring,
    ringMat,
    createdAt: performance.now(),
    expiresAt: performance.now() + 500, // Quick burst
    range,
    duration,
    damageApplied: false,
  };

  // Damage and stun enemies in range
  const enemies = getEnemies();
  enemies.forEach((e, i) => {
    const dist = e.mesh.position.distanceTo(playerPos);
    if (dist < range) {
      // Apply shock/stun effect
      if (!e.statusEffects) {
        e.statusEffects = { shock: { stacks: 0, timer: 0 } };
      }
      if (!e.statusEffects.shock) {
        e.statusEffects.shock = { stacks: 0, timer: 0 };
      }
      e.statusEffects.shock.stacks += 3;
      e.statusEffects.shock.timer = Math.max(e.statusEffects.shock.timer, duration);

      // Small damage
      const empDamage = 10;
      const result = hitEnemy(i, empDamage);
      spawnDamageNumber(e.mesh.position, empDamage, '#00ffff');

      if (result.killed) {
        const destroyData = destroyEnemy(i);
        if (destroyData) {
          game.kills++;
          game.totalKills++;
          addScore(destroyData.scoreValue);
          updateHUD(game);

          const cfg = game._levelConfig;
          if (cfg && game.kills >= cfg.killTarget) {
            completeLevel();
          }
        }
      }
    }
  });

  // Also affect boss if present
  const boss = getBoss();
  if (boss) {
    const dist = boss.mesh.position.distanceTo(playerPos);
    if (dist < range) {
      hitBoss(15);
      spawnDamageNumber(boss.mesh.position, 15, '#00ffff');
    }
  }

  // Add to active visuals for animation
  activeEMPVisuals.push(empData);

  playShoothSound();
  triggerScreenShake(0.3, 300);
}

const activeEMPVisuals = [];

function updateEMPVisuals(now, dt) {
  for (let i = activeEMPVisuals.length - 1; i >= 0; i--) {
    const emp = activeEMPVisuals[i];
    const age = now - emp.createdAt;

    // Fade out ring
    const progress = age / 500;
    emp.ringMat.opacity = 0.6 * (1 - progress);

    // Scale ring outward
    emp.ring.scale.setScalar(1 + progress * 2);

    // Remove when done
    if (age >= 500) {
      scene.remove(emp.ring);
      emp.ring.geometry.dispose();
      emp.ring.material.dispose();
      activeEMPVisuals.splice(i, 1);
    }
  }
}

// ============================================================
//  TELEPORT - Instant movement to target location
// ============================================================

function fireTeleport(origin, direction, hand, altWeapon) {
  console.log(`[Teleport] Activated from ${hand} hand`);

  const range = altWeapon.range || 10;
  const playerPos = camera.position.clone();

  // Calculate teleport destination
  const destination = playerPos.clone().addScaledVector(direction, range);

  // Clamp destination to ground level
  destination.y = Math.max(0.5, destination.y);

  // Create visual effect at start position
  const startEffectGeo = new THREE.SphereGeometry(0.5, 16, 16);
  const startEffectMat = new THREE.MeshBasicMaterial({
    color: 0xaa00ff,
    transparent: true,
    opacity: 0.5,
    blending: THREE.AdditiveBlending,
  });
  const startEffect = new THREE.Mesh(startEffectGeo, startEffectMat);
  startEffect.position.copy(playerPos);
  scene.add(startEffect);

  // Teleport player
  camera.position.copy(destination);
  console.log(`[Teleport] Moved from (${playerPos.x.toFixed(2)}, ${playerPos.y.toFixed(2)}, ${playerPos.z.toFixed(2)}) to (${destination.x.toFixed(2)}, ${destination.y.toFixed(2)}, ${destination.z.toFixed(2)})`);

  // Create visual effect at end position
  const endEffectGeo = new THREE.SphereGeometry(0.5, 16, 16);
  const endEffectMat = new THREE.MeshBasicMaterial({
    color: 0xaa00ff,
    transparent: true,
    opacity: 0.5,
    blending: THREE.AdditiveBlending,
  });
  const endEffect = new THREE.Mesh(endEffectGeo, endEffectMat);
  endEffect.position.copy(destination);
  scene.add(endEffect);

  // Track effects for fade-out
  const teleportData = {
    startEffect,
    startEffectMat,
    endEffect,
    endEffectMat,
    createdAt: performance.now(),
    duration: 300,
  };

  activeTeleportEffects.push(teleportData);
  playShoothSound();
  triggerScreenShake(0.2, 200);
}

const activeTeleportEffects = [];

function updateTeleportEffects(now, dt) {
  for (let i = activeTeleportEffects.length - 1; i >= 0; i--) {
    const effect = activeTeleportEffects[i];
    const age = now - effect.createdAt;

    // Fade out both effects
    const progress = age / effect.duration;
    const opacity = 0.5 * (1 - progress);
    effect.startEffectMat.opacity = opacity;
    effect.endEffectMat.opacity = opacity;

    // Scale up effects
    effect.startEffect.scale.setScalar(1 + progress);
    effect.endEffect.scale.setScalar(1 + progress);

    // Remove when done
    if (age >= effect.duration) {
      scene.remove(effect.startEffect);
      scene.remove(effect.endEffect);
      effect.startEffect.geometry.dispose();
      effect.startEffect.material.dispose();
      effect.endEffect.geometry.dispose();
      effect.endEffect.material.dispose();
      activeTeleportEffects.splice(i, 1);
    }
  }
}

// ============================================================
//  GAME STATE TRANSITIONS
// ============================================================
function debugJumpToLevel(targetLevel) {
  console.log('[debug] Jump to level ' + targetLevel);
  hideTitle();
  resetGame();
  game.state = State.READY_SCREEN;
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


  showReadyScreen(targetLevel);
  resetReadyCountdown();
}

function cycleDebugBiome() {
  const pool = getBiomePool();
  const current = game.debugBiomeOverride;
  let next = null;

  if (!current) {
    next = pool[0] || null;
  } else {
    const index = pool.indexOf(current);
    if (index === -1 || index === pool.length - 1) {
      next = null;
    } else {
      next = pool[index + 1];
    }
  }

  game.debugBiomeOverride = next;
  saveDebugSettings();
  console.log('[debug] Biome override set to', next || 'auto');
  return next;
}

function cycleDebugBiomeWithFade() {
  if (environmentFadeState) return;
  if (!game.level || game.level < 1) {
    game.level = 1;
    game._levelConfig = getLevelConfig();
  }
  startEnvironmentFade('out', 250, () => {
    cycleDebugBiome();
    applyThemeForLevel(game.level);
    startEnvironmentFade('in', 250);
    showDebugMenu();
  });
}

window.debugCycleBiomeWithFade = () => {
  console.log('[debug] Next biome requested');
  cycleDebugBiomeWithFade();
};

function resetReadyCountdown() {
  readyCountdownActive = false;
  readyCountdownStartTime = 0;
  readyCountdownLastValue = READY_COUNTDOWN_SECONDS;
  updateReadyCountdownText(null);
}

function beginGameplayFromReady() {
  readyCountdownActive = false;
  updateReadyCountdownText(null);
  hideReadyScreen();
  hideHUD();

  // Actually start playing
  game.state = State.PLAYING;
  showHUD();

  // Stagger setup
  game.spawnTimer = 1.0;
}

function startReadyCountdown() {
  if (readyCountdownActive) return;
  readyCountdownActive = true;
  readyCountdownStartTime = performance.now();
  readyCountdownLastValue = READY_COUNTDOWN_SECONDS;
  updateReadyCountdownText(`${READY_COUNTDOWN_SECONDS}`);
}

function updateReadyCountdown(now) {
  if (!readyCountdownActive) return;
  const elapsed = (now - readyCountdownStartTime) / 1000;
  const remaining = READY_COUNTDOWN_SECONDS - elapsed;
  if (remaining <= 0) {
    beginGameplayFromReady();
    return;
  }
  const displayValue = Math.ceil(remaining);
  if (displayValue !== readyCountdownLastValue) {
    readyCountdownLastValue = displayValue;
    updateReadyCountdownText(`${displayValue}`);
  }
}

function handleReadyScreenTrigger(controller) {
  if (readyCountdownActive) return;
  playMenuClick();
  startReadyCountdown();
}

function handleDebugMenuTrigger(controller) {
  const origin = new THREE.Vector3();
  const quat = new THREE.Quaternion();
  controller.getWorldPosition(origin);
  controller.getWorldQuaternion(quat);
  const direction = new THREE.Vector3(0, 0, -1).applyQuaternion(quat);
  const raycaster = new THREE.Raycaster(origin, direction, 0, 10);

  const result = getDebugMenuHit(raycaster);
  if (result && result.action === 'back') {
    playMenuClick();
    saveDebugSettings();  // Save settings before leaving
    hideDebugMenu();
    resetGame();
    showTitle();
    updateTitleDebugIndicator();  // Update the indicator on title screen
    return;
  }
  if (result && result.action === 'biome_next') {
    playMenuClick();
    cycleDebugBiome();
    applyThemeForLevel(game.level);
    showDebugMenu();
    return;
  }
  // Toggle clicks are handled in getDebugMenuHit with visual updates
}

function startGame() {
  console.log('[game] Starting new game');
  hideTitle();
  
  // Hide HTML overlays for desktop mode
  const noVr = document.getElementById('no-vr');
  const info = document.getElementById('info');
  if (noVr) noVr.style.display = 'none';
  if (info) info.style.display = 'none';
  
  // Check for seed configuration from HTML inputs
  const seed = window.gameSeed !== undefined ? window.gameSeed : null;
  const tier = window.gameSeedTier || 'standard';
  
  if (seed !== null) {
    // Start game with seed
    console.log(`[seed] Using seed: ${seed}, tier: ${tier}`);
    startGameWithSeed(seed, tier);
  } else {
    // Start game without seed (random)
    console.log('[seed] No seed set, using random seed');
    resetGame();
  }
  
  game.state = State.READY_SCREEN;
  game.level = 1;
  game._levelConfig = getLevelConfig();
  applyThemeForLevel(1);
  applyEnvironmentFade(0);
  showHUD();
  updateHUD(game);
  showReadyScreen(game.level, camera.position);
  resetReadyCountdown();

  // Hide blaster displays during gameplay
  blasterDisplays.forEach(d => { if (d) d.visible = false; });

  // Start level music
  playMusic('levels1to5');
}

function shouldFadeForBiomeTransition(level) {
  if (level >= 20) return false;
  const currentBiome = getBiomeForLevel(level);
  const nextBiome = getBiomeForLevel(level + 1);
  return currentBiome !== nextBiome;
}

function completeLevel() {
  console.log(`[game] Level ${game.level} complete`);
  
  // Update HUD one final time to show correct kill count
  updateHUD(game);
  
  game.state = State.LEVEL_COMPLETE;
  clearAllEnemies();

  // PERFORMANCE: Clear all projectiles on level complete
  clearAllProjectiles();

  stopLightningSound();
  game.justBossKill = game._levelConfig && game._levelConfig.isBoss;
  game.stateTimer = 2.0; // cooldown before upgrade screen
  levelFadeReady = false;
  const shouldFade = shouldFadeForBiomeTransition(game.level);
  if (shouldFade) {
    startEnvironmentFade('out', 0.8, () => {
      levelFadeReady = true;
      applyEnvironmentFade(1);
    });
  } else {
    levelFadeReady = true;
  }
  showLevelComplete(game.level, camera.position);

  if (!game.justBossKill && [4, 9, 14, 19].includes(game.level)) {
    fadeOutMusic(1200);
  }
}

// PERFORMANCE: Clear all active projectiles and return them to pool
function clearAllProjectiles() {
  for (let i = projectiles.length - 1; i >= 0; i--) {
    const proj = projectiles[i];
    if (proj.userData.isPooled) {
      returnProjectileToPool(proj);
    } else {
      scene.remove(proj);
    }
  }
  projectiles.length = 0;
}

function showUpgradeScreen() {
  console.log('[game] Showing upgrade selection');
  game.state = State.UPGRADE_SELECT;
  hideLevelComplete();

  // Stop lightning sound during upgrade screen
  stopLightningSound();

  // Get the hand for this upgrade
  const hand = getNextUpgradeHand();

  // Check if this is the level 1→2 transition where player chooses MAIN weapon
  if (needsMainWeaponChoice()) {
    // Show MAIN weapon selection (all 6 types)
    console.log('[game] Level 1→2: Showing MAIN weapon selection');
    const mainWeaponOptions = Object.values(MAIN_WEAPONS);
    pendingUpgrades = mainWeaponOptions;
    showUpgradeCards(pendingUpgrades, camera.position, hand);
    upgradeSelectionCooldown = 1.5;
    blasterDisplays.forEach(d => { if (d) d.userData.needsUpdate = true; });
    return;
  }

  // Normal upgrade selection
  // Get the MAIN weapon for this hand
  const mainWeaponId = game.mainWeapon[hand];
  
  // Check if MAIN weapon is already locked for this hand
  if (game.mainWeaponLocked[hand]) {
    // Show upgrades filtered by equipped MAIN weapon
    console.log(`[game] Showing upgrades for ${hand} hand (${mainWeaponId})`);
    pendingUpgrades = game.justBossKill ? 
      getRandomSpecialUpgrades(3, mainWeaponId) : 
      getRandomUpgrades(3, mainWeaponId);
  } else {
    // MAIN weapon not locked yet - show all upgrades (shouldn't happen after level 2)
    console.log(`[game] WARNING: MAIN weapon not locked for ${hand} hand at level ${game.level}`);
    pendingUpgrades = game.justBossKill ? getRandomSpecialUpgrades(3, mainWeaponId) : getRandomUpgrades(3, mainWeaponId);
  }

  showUpgradeCards(pendingUpgrades, camera.position, hand);
  if (game.justBossKill) game.justBossKill = false;
  upgradeSelectionCooldown = 1.5; // prevent instant selection

  // Mark blaster displays for update
  blasterDisplays.forEach(d => { if (d) d.userData.needsUpdate = true; });
}

function selectUpgradeAndAdvance(upgrade, hand) {
  console.log(`[game] Selected: ${upgrade.name} for ${hand} hand`);

  // Handle SKIP option - restore full health instead of upgrade
  if (upgrade.id === 'SKIP') {
    game.health = game.maxHealth;
    console.log('[game] Skipped upgrade, health restored to full');
    playUpgradeSound();
    hideUpgradeCards();
    advanceLevelAfterUpgrade();
    return;
  }

  // Check if this is a MAIN weapon selection (level 1→2)
  if (upgrade.type === 'main') {
    console.log(`[game] Selected MAIN weapon: ${upgrade.id} for ${hand} hand`);
    setMainWeapon(upgrade.id, hand);
    playUpgradeSound();
    hideUpgradeCards();
    advanceLevelAfterUpgrade();
    return;
  }

  // Check if this is an ALT weapon
  if (upgrade.type === 'alt') {
    console.log(`[game] Selected ALT weapon: ${upgrade.id} for ${hand} hand`);
    setAltWeapon(upgrade.id, hand);
    playUpgradeSound();
    hideUpgradeCards();
    advanceLevelAfterUpgrade();
    return;
  }

  // Regular upgrade
  addUpgrade(upgrade.id, hand);
  playUpgradeSound();
  hideUpgradeCards();
  advanceLevelAfterUpgrade();
}

function advanceLevelAfterUpgrade() {
  game.level++;
  game.kills = 0;

  if (game.level > 20) {
    endGame(true); // victory
  } else {
    game.state = State.PLAYING;
    game._levelConfig = getLevelConfig();
    applyThemeForLevel(game.level);
    const shouldFade = shouldFadeForBiomeTransition(game.level - 1);
    if (shouldFade) {
      applyEnvironmentFade(1);
      startEnvironmentFade('in', 0.8);
    } else {
      applyEnvironmentFade(0);
    }
    hideReadyScreen();
    showHUD();

    // Stagger setup
    game.spawnTimer = 1.0;

    // Hide blaster displays during gameplay
    blasterDisplays.forEach(d => { if (d) d.visible = false; });

    if (game.level === 6) {
      playMusic('levels6to10');
    } else if (game.level === 11) {
      playMusic('levels11to14');
    } else if (game.level === 16) {
      playMusic('levels16to19');
    }
  }
}

function endGame(victory) {
  console.log(`[game] Game ${victory ? 'won' : 'over'} — score: ${game.score}`);
  game.state = victory ? State.VICTORY : State.GAME_OVER;
  game.finalScore = game.score;
  game.finalLevel = game.level;
  clearAllEnemies();
  clearBoss();

  // PERFORMANCE: Clear all projectiles on game end
  clearAllProjectiles();

  hideHUD();
  hideBossHealthBar();
  gameOverCooldown = 2.0;  // 2 second cooldown before restart allowed

  // Stop music
  stopMusic();
  stopLightningSound();

  if (victory) {
    showVictory(game.score, camera.position);
  } else {
    showGameOver(game.score, camera.position);
  }
}

// ============================================================
//  SHOOTING & COMBAT
// ============================================================

// Screen shake trigger function
function triggerScreenShake(intensity, duration) {
  screenShakeIntensity = intensity;
  screenShakeTime = performance.now() + duration;
  console.log(`[Shake] Intensity: ${intensity}, Duration: ${duration}ms`);
}

// PERFORMANCE: Initialize projectile pool for reuse
function initProjectilePool() {
  // Pre-create pooled projectile meshes (both types: laser and buckshot)
  const colors = [NEON_CYAN, NEON_PINK];

  for (let i = 0; i < PROJECTILE_POOL_SIZE; i++) {
    const color = colors[i % 2];

    // Create laser bolt (most common)
    const group = new THREE.Group();
    const boltLength = 1.0;
    const boltGeo = new THREE.CylinderGeometry(0.015, 0.015, boltLength, 6);
    const bolt = new THREE.Mesh(boltGeo, new THREE.MeshBasicMaterial({ color }));
    bolt.rotation.x = Math.PI / 2;
    bolt.position.z = -boltLength / 2;
    group.add(bolt);

    // Glow cylinder
    const glowGeo = new THREE.CylinderGeometry(0.035, 0.035, boltLength, 6);
    const glowBolt = new THREE.Mesh(glowGeo, new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.2 }));
    glowBolt.rotation.x = Math.PI / 2;
    glowBolt.position.z = -boltLength / 2;
    group.add(glowBolt);

    group.visible = false;
    group.userData.isPooled = true;
    group.userData.poolType = 'laser';
    scene.add(group);
    projectilePool.push(group);
  }

  // Add some buckshot pellets to pool
  for (let i = 0; i < 20; i++) {
    const mesh = new THREE.Mesh(
      new THREE.SphereGeometry(0.025, 6, 6),
      new THREE.MeshBasicMaterial({ color: 0xdddddd })
    );
    mesh.visible = false;
    mesh.userData.isPooled = true;
    mesh.userData.poolType = 'buckshot';
    scene.add(mesh);
    projectilePool.push(mesh);
  }

  console.log(`[performance] Projectile pool initialized: ${projectilePool.length} objects`);
}

// PERFORMANCE: Get a projectile from pool or return null if exhausted
function getPooledProjectile(isBuckshot, color) {
  const poolType = isBuckshot ? 'buckshot' : 'laser';

  // Find inactive projectile of correct type
  for (const proj of projectilePool) {
    if (!proj.visible && proj.userData.poolType === poolType) {
      // Update color for laser bolts
      if (!isBuckshot && proj.children) {
        proj.children.forEach(child => {
          if (child.material) child.material.color.setHex(color);
        });
      }
      return proj;
    }
  }

  // Pool exhausted - return null (caller should skip spawn)
  return null;
}

// PERFORMANCE: Return projectile to pool instead of destroying
function returnProjectileToPool(proj) {
  proj.visible = false;
  proj.userData.velocity = null;
  proj.userData.stats = null;
  proj.userData.controllerIndex = undefined;
  proj.userData.isExploding = undefined;
  proj.userData.lifetime = undefined;
  proj.userData.createdAt = undefined;
  proj.userData.hitEnemies = null;
}

// ============================================================
//  PHYSICS DEATH SYSTEM - Voxel Pool
// ============================================================

/**
 * Initialize voxel pool for physics-based death explosions
 */
function initVoxelPool() {
  const voxelGeo = new THREE.BoxGeometry(0.05, 0.05, 0.05);
  
  for (let i = 0; i < VOXEL_POOL_SIZE; i++) {
    const material = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 1.0,
    });
    const voxel = new THREE.Mesh(voxelGeo, material);
    voxel.visible = false;
    voxel.userData.isPooledVoxel = true;
    scene.add(voxel);
    voxelPool.push(voxel);
  }
  
  console.log(`[physics-death] Voxel pool initialized: ${voxelPool.length} voxels`);
}

/**
 * Get a voxel from the pool or return null if exhausted
 */
function getPooledVoxel() {
  for (const voxel of voxelPool) {
    if (!voxel.visible) {
      return voxel;
    }
  }
  return null; // Pool exhausted
}

/**
 * Return voxel to pool
 */
function returnVoxelToPool(voxel) {
  voxel.visible = false;
  voxel.userData.velocity = null;
  voxel.userData.createdAt = undefined;
  voxel.userData.lifetime = undefined;
  voxel.userData.isGold = undefined;
}

/**
 * Spawn voxel explosion at position with physics
 * @param {THREE.Vector3} position - Center of explosion
 * @param {number} color - Hex color of voxels
 * @param {number} voxelCount - Number of voxels to spawn
 * @param {string} enemyType - Type of enemy for death pattern
 * @param {boolean} isCritical - Whether this was a critical kill (gold particles)
 * @param {boolean} isOverkill - Whether this was an overkill (double voxels)
 */
function spawnVoxelExplosion(position, color, voxelCount, enemyType = 'basic', isCritical = false, isOverkill = false) {
  // Performance safeguard: cap active voxels
  if (activeVoxels.length >= MAX_ACTIVE_VOXELS) {
    console.log(`[physics-death] Voxel cap reached (${activeVoxels.length}/${MAX_ACTIVE_VOXELS})`);
    return;
  }
  
  // Double voxels for overkill
  if (isOverkill) {
    voxelCount *= 2;
  }
  
  // Cap at 20 voxels per enemy to prevent spam
  voxelCount = Math.min(voxelCount, 20);
  
  // Calculate available space in pool
  const availableVoxels = MAX_ACTIVE_VOXELS - activeVoxels.length;
  voxelCount = Math.min(voxelCount, availableVoxels);
  
  console.log(`[physics-death] Spawning ${voxelCount} voxels for ${enemyType} (critical: ${isCritical}, overkill: ${isOverkill})`);
  
  // Enemy-specific death patterns
  const pattern = getDeathPattern(enemyType);
  
  for (let i = 0; i < voxelCount; i++) {
    const voxel = getPooledVoxel();
    if (!voxel) break; // Pool exhausted
    
    // Set position (slightly randomized around center)
    voxel.position.copy(position);
    voxel.position.x += (Math.random() - 0.5) * 0.3;
    voxel.position.y += (Math.random() - 0.5) * 0.3;
    voxel.position.z += (Math.random() - 0.5) * 0.3;
    
    // Set color (gold for critical kills, enemy color otherwise)
    const voxelColor = isCritical ? 0xffd700 : color;
    voxel.material.color.setHex(voxelColor);
    voxel.material.opacity = 1.0;
    
    // Calculate velocity based on pattern
    const velocity = pattern.calculateVelocity(i, voxelCount);
    
    // Initialize voxel physics data
    voxel.userData.velocity = velocity;
    voxel.userData.createdAt = performance.now();
    voxel.userData.lifetime = 2000 + Math.random() * 1000; // 2-3 seconds
    voxel.userData.isGold = isCritical;
    voxel.visible = true;
    
    activeVoxels.push(voxel);
  }
  
  // Screen shake for critical kills
  if (isCritical) {
    triggerScreenShake(0.3, 200);
  }
  
  // LOUDER explosion for overkill
  if (isOverkill) {
    playExplosionSound();
    playExplosionSound(); // Double sound
  }
}

/**
 * Get death pattern for enemy type
 */
function getDeathPattern(enemyType) {
  const patterns = {
    basic: {
      calculateVelocity: (i, total) => {
        return new THREE.Vector3(
          (Math.random() - 0.5) * 6,
          Math.random() * 4 + 2,
          (Math.random() - 0.5) * 6
        );
      }
    },
    tank: {
      calculateVelocity: (i, total) => {
        // Slow, heavy chunks
        return new THREE.Vector3(
          (Math.random() - 0.5) * 2,
          Math.random() * 2 + 1,
          (Math.random() - 0.5) * 2
        );
      }
    },
    fast: {
      calculateVelocity: (i, total) => {
        // Rapid explosion trail
        return new THREE.Vector3(
          (Math.random() - 0.5) * 10,
          Math.random() * 6 + 3,
          (Math.random() - 0.5) * 10
        );
      }
    },
    swarm: {
      calculateVelocity: (i, total) => {
        // Tiny scatter
        return new THREE.Vector3(
          (Math.random() - 0.5) * 8,
          Math.random() * 5 + 2,
          (Math.random() - 0.5) * 8
        );
      }
    },
    boss: {
      calculateVelocity: (i, total) => {
        // Massive burst + shockwave
        const angle = (i / total) * Math.PI * 2;
        const speed = 8 + Math.random() * 4;
        return new THREE.Vector3(
          Math.cos(angle) * speed,
          Math.random() * 8 + 4,
          Math.sin(angle) * speed
        );
      }
    }
  };
  
  return patterns[enemyType] || patterns.basic;
}

/**
 * Update voxel physics (gravity, bounce, fade)
 */
function updateVoxelPhysics(dt, now) {
  const gravity = -9.8;
  const bounceCoefficient = 0.3;
  const floorY = 0;
  
  for (let i = activeVoxels.length - 1; i >= 0; i--) {
    const voxel = activeVoxels[i];
    const age = now - voxel.userData.createdAt;
    
    // Remove expired voxels
    if (age > voxel.userData.lifetime) {
      returnVoxelToPool(voxel);
      activeVoxels.splice(i, 1);
      continue;
    }
    
    // Apply gravity
    voxel.userData.velocity.y += gravity * dt;
    
    // Update position
    voxel.position.addScaledVector(voxel.userData.velocity, dt);
    
    // Floor collision with bounce
    if (voxel.position.y <= floorY) {
      voxel.position.y = floorY;
      voxel.userData.velocity.y *= -bounceCoefficient;
      
      // Apply friction on bounce
      voxel.userData.velocity.x *= 0.8;
      voxel.userData.velocity.z *= 0.8;
    }
    
    // Fade out in last 0.5 seconds
    const fadeStart = voxel.userData.lifetime - 500;
    if (age > fadeStart) {
      const fadeProgress = (age - fadeStart) / 500;
      voxel.material.opacity = 1 - fadeProgress;
    }
    
    // Rotate voxels for visual effect
    voxel.rotation.x += dt * 2;
    voxel.rotation.y += dt * 3;
  }
}

// ============================================================
//  MAIN WEAPON FIRING
// ============================================================
function fireMainWeapon(controller, index) {
  const now = performance.now();
  const hand = getHandForController(index);
  const mainWeaponId = game.mainWeapon[hand];
  const stats = getWeaponStats(mainWeaponId, game.upgrades[hand]);

  // Lightning beam mode - handled separately in update loop
  if (stats.lightning) {
    return;  // Lightning is continuous hold-to-fire
  }

  // Check cooldown
  if (now - weaponCooldowns[index] < stats.fireInterval) return;
  weaponCooldowns[index] = now;

  const origin = new THREE.Vector3();
  const quat = new THREE.Quaternion();
  controller.getWorldPosition(origin);
  controller.getWorldQuaternion(quat);
  const direction = new THREE.Vector3(0, 0, -1).applyQuaternion(quat);

  // Fire projectile(s)
  const count = stats.projectileCount;
  const shotId = startAccuracyShot(count);
  const isBuckshot = stats.spreadAngle > 0;

  // Calculate perpendicular offset axis for parallel multi-shot
  const rightAxis = new THREE.Vector3(1, 0, 0).applyQuaternion(quat);
  const gap = 0.08; // Gap between parallel shots

  for (let i = 0; i < count; i++) {
    let spawnOrigin = origin.clone();

    if (count > 1 && !isBuckshot) {
      // Position shots side-by-side with small gap, all parallel
      // Spread evenly around center: for 2 shots [-0.5, 0.5], for 3 [-1, 0, 1], etc.
      const offsetIndex = i - (count - 1) / 2;
      spawnOrigin.addScaledVector(rightAxis, offsetIndex * gap);
    }

    spawnProjectile(spawnOrigin, direction, index, stats, shotId);
  }

  console.log(`[MAIN weapon] ${hand} hand fired ${count} projectile(s) from ${mainWeaponId}`);
}

function updateLightningBeam(controller, index, stats, dt) {
  const origin = new THREE.Vector3();
  const quat = new THREE.Quaternion();
  controller.getWorldPosition(origin);
  controller.getWorldQuaternion(quat);
  const direction = new THREE.Vector3(0, 0, -1).applyQuaternion(quat);

  // Find all enemies within range and chain to them
  const enemies = getEnemies();
  const targets = [];
  const maxChains = 2 + Math.floor(stats.lightningRange / 8);  // More chains with upgrades

  enemies.forEach((e, i) => {
    const dist = e.mesh.position.distanceTo(origin);
    const toEnemy = e.mesh.position.clone().sub(origin).normalize();
    const angle = toEnemy.dot(direction);

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
    // Start sound if not playing
    startLightningSound();

    // Remove old beam group
    if (lightningBeams[index]) {
      scene.remove(lightningBeams[index]);
    }

    const beamGroup = new THREE.Group();

    // Draw zigzag lightning bolts to each target
    let lastPos = origin.clone();
    chainTargets.forEach(({ enemy }) => {
      const targetPos = enemy.mesh.position;
      const bolt = createLightningBolt(lastPos, targetPos);
      beamGroup.add(bolt);
      lastPos = targetPos.clone();
    });

    scene.add(beamGroup);
    lightningBeams[index] = beamGroup;

    // Apply damage at lightningTickInterval (reduced by barrel / fire rate upgrades)
    const tickInterval = stats.lightningTickInterval != null ? stats.lightningTickInterval : 0.2;
    lightningTimers[index] += dt;
    if (lightningTimers[index] >= tickInterval) {
      lightningTimers[index] = 0;

      let accuracyHitRegistered = false;
      chainTargets.forEach(({ index: enemyIndex, enemy }) => {
        const result = hitEnemy(enemyIndex, stats.lightningDamage);
        if (!accuracyHitRegistered) {
          registerAccuracyHit();
          accuracyHitRegistered = true;
        }
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

            // Update HUD immediately to show correct kill count before level complete check
            updateHUD(game);


            // Check for slow-mo death (last enemy of wave)
            const cfg = game._levelConfig;
            if (cfg && !cfg.isBoss) {
              const enemiesRemaining = getEnemyCount();
              if (enemiesRemaining === 0 && game.kills < cfg.killTarget) {
                // Last enemy killed but not level complete yet - trigger slow-mo
                triggerSlowmoDeathSequence();
              }
            }

            // Check level complete
            if (cfg && game.kills >= cfg.killTarget) {
              completeLevel();
            }
          }
        }
      });
    }
  } else {
    // No targets - clear beam and stop sound
    if (lightningBeams[index]) {
      scene.remove(lightningBeams[index]);
      lightningBeams[index] = null;
    }
    stopLightningSound();
    lightningTimers[index] = 0;
  }
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
const _playerForward = new THREE.Vector3();

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
  const hand = getHandForController(index);

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
        cameraShake = 0.3;
        cameraShakeIntensity = 0.03;
        originalCameraPos.copy(camera.position);

        // Light screen shake on player damage
        triggerScreenShake(0.15, 500); // 0.15 shake for 500ms

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

        // Update HUD immediately to show correct kill count before level complete
        updateHUD(game);

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

function spawnProjectile(origin, direction, controllerIndex, stats, shotId) {
  // PERFORMANCE: Enforce hard cap on active projectiles
  if (projectiles.length >= MAX_PROJECTILES) {
    // Skip spawning - too many projectiles active
    // This prevents accumulation with dual blasters + multi-shot upgrades
    resolveAccuracyPellet(shotId);
    return;
  }

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

  // PERFORMANCE: Get projectile from pool instead of creating new
  let mesh = getPooledProjectile(isBuckshot, color);

  if (!mesh) {
    // Pool exhausted - skip this projectile (prevents unbounded growth)
    resolveAccuracyPellet(shotId);
    return;
  }

  // Reset and activate pooled projectile
  mesh.position.copy(origin);
  let shotDirection = direction.clone();
  if (isBuckshot) {
    const minSpread = THREE.MathUtils.degToRad(0.5);
    const maxSpread = THREE.MathUtils.degToRad(2.5);
    const angle = minSpread + Math.random() * (maxSpread - minSpread);
    let axis = new THREE.Vector3(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5);
    if (axis.lengthSq() < 0.0001) axis.set(0, 1, 0);
    axis.cross(shotDirection);
    if (axis.lengthSq() < 0.0001) axis.set(1, 0, 0);
    axis.normalize();
    shotDirection.applyAxisAngle(axis, angle);
  }
  const projectileSpeed = stats.projectileSpeed || (isBuckshot ? 20 : 40);
  mesh.userData.velocity = shotDirection.clone().multiplyScalar(projectileSpeed);
  mesh.userData.stats = stats;
  mesh.userData.controllerIndex = controllerIndex;
  mesh.userData.isExploding = isExploding;
  mesh.userData.lifetime = 3000;
  mesh.userData.createdAt = performance.now();
  mesh.userData.hitEnemies = new Set();
  mesh.userData.shotId = shotId;
  mesh.userData.hitConfirmed = false;
  mesh.visible = true;

  // Orient bolt along direction
  if (!isBuckshot) {
    mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, -1), direction);
  }

  projectiles.push(mesh);

  if (isBuckshot) {
    playBuckshotSound();
  } else {
    playShoothSound();
  }
}

// ============================================================
//  SLOW-MO DEATH CAMERA
// ============================================================
function triggerSlowmoDeathSequence() {
  game.slowmoActive = true;
  game.slowmoTimer = performance.now() + game.slowmoDuration;
  console.log('[slow-mo] Death sequence triggered!');
}

function lerp(a, b, t) {
  return a + (b - a) * t;
}

function handleHit(enemyIndex, enemy, stats, hitPoint, controllerIndex, isExploding = false, hitWeakPoint = false) {
  // Calculate damage
  let damage = stats.damage;

  // Tank weak point (one random voxel takes double damage)
  if (hitWeakPoint) damage *= 2;

  // Critical hit
  if (stats.critChance > 0 && Math.random() < stats.critChance) {
    damage *= (stats.critMultiplier || 2);
  }

  // Impact freeze for critical hits or weak points
  const isCritical = damage > 30 || hitWeakPoint;
  if (isCritical) {
    // Freeze frame briefly (0.1s visual pause)
    const freezeDuration = 100; // 0.1 seconds

    // Small camera jolt
    camera.position.x += (Math.random() - 0.5) * 0.05;
    camera.position.y += (Math.random() - 0.5) * 0.05;

    // White flash overlay using existing hit flash system
    triggerHitFlash();

    console.log(`[Impact] CRITICAL HIT! Damage: ${Math.round(damage)}, Freeze: ${freezeDuration}ms`);
  }

  // Fire debuff increases damage taken
  if (enemy.statusEffects.fire.stacks > 0) {
    damage *= stats.fireWeakenMult;
  }

  // Apply damage
  const result = hitEnemy(enemyIndex, damage);

  // Track damage for hand stats
  if (controllerIndex !== undefined) {
    const hand = getHandForController(controllerIndex);
    game.handStats[hand].totalDamage += damage;
  }

  // Spawn damage number
  spawnDamageNumber(hitPoint, damage, '#ffffff');
  
  // CRIT indicator for critical hits
  if (isCritical) {
    spawnCritIndicator(hitPoint);
  }
  
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
    const destroyData = destroyEnemy(enemyIndex, isCritical, result.overkill > 0);
    if (destroyData) {
      game.kills++;
      game.totalKills++;
      game.killsWithoutHit++;
      addScore(destroyData.scoreValue);

      // Update HUD immediately to show correct kill count before level complete check
      updateHUD(game);


      // Check for slow-mo death (last enemy of wave)
      const cfg = game._levelConfig;
      if (cfg && !cfg.isBoss) {
        const enemiesRemaining = getEnemyCount();
        if (enemiesRemaining === 0 && game.kills < cfg.killTarget) {
          // Last enemy killed but not level complete yet - trigger slow-mo
          triggerSlowmoDeathSequence();
        }
      }

      // Track kills for hand stats
      if (controllerIndex !== undefined) {
        const hand = getHandForController(controllerIndex);
        game.handStats[hand].kills++;
      }

      // Vampiric healing
      if (stats.vampiricInterval > 0 && game.totalKills % stats.vampiricInterval === 0) {
        game.health = Math.min(game.maxHealth, game.health + 1);
        console.log('[vampiric] Healed 1 HP');
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
    cameraShake = 0.3;
    cameraShakeIntensity = 0.03;
    originalCameraPos.copy(camera.position);

    // Light screen shake on player damage
    triggerScreenShake(0.15, 500); // 0.15 shake for 500ms

    floorFlashing = true;
    floorFlashTimer = 0.5;
    console.log('[boss] Shield reflected damage!');
    if (dead) endGame(false);
    return;
  }

  if (controllerIndex !== undefined) {
    const hand = getHandForController(controllerIndex);
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

    // Update HUD immediately to show correct kill count before level complete
    updateHUD(game);

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
        const hand = getHandForController(controllerIndex);
        game.handStats[hand].totalDamage += aoeDamage;
      }
    }
  });
}

/** Spawn a short-lived visible explosion (expanding sphere) at center. */
function spawnExplosionVisual(center, radius) {
  // Bigger shake for explosions
  triggerScreenShake(0.3, 300); // 0.3 shake for 300ms

  // PERFORMANCE: Cap explosion visuals to prevent accumulation
  const MAX_EXPLOSION_VISUALS = 15;
  if (explosionVisuals.length >= MAX_EXPLOSION_VISUALS) {
    // Remove oldest explosion visual
    const oldest = explosionVisuals.shift();
    scene.remove(oldest);
    oldest.geometry.dispose();
    oldest.material.dispose();
  }

  const duration = 350; // ms
  const geo = new THREE.SphereGeometry(radius * 0.3, 12, 12);
  const mat = new THREE.MeshBasicMaterial({
    color: 0xff8800,
    transparent: true,
    opacity: 0.7,
    side: THREE.BackSide,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.copy(center);
  mesh.renderOrder = 900;
  mesh.userData.createdAt = performance.now();
  mesh.userData.duration = duration;
  mesh.userData.radius = radius;
  scene.add(mesh);
  explosionVisuals.push(mesh);
}

function updateExplosionVisuals(dt, now) {
  for (let i = explosionVisuals.length - 1; i >= 0; i--) {
    const m = explosionVisuals[i];
    const age = now - m.userData.createdAt;
    if (age > m.userData.duration) {
      scene.remove(m);
      m.geometry.dispose();
      m.material.dispose();
      explosionVisuals.splice(i, 1);
    } else {
      const t = age / m.userData.duration;
      if (m.userData.isChargeBeam) {
        m.material.opacity = (0.4 + 0.4) * (1 - t);
      } else if (m.userData.isToxicPool) {
        // Toxic pool - check for player damage over time
        m.material.opacity = 0.6 * (1 - t * 0.5);
        
        // Deal damage every 0.5 seconds
        if (now - m.userData.lastDamageTime > 500) {
          const playerPos = camera.position;
          const dist = new THREE.Vector2(
            playerPos.x - m.position.x,
            playerPos.z - m.position.z
          ).length();
          
          if (dist < m.userData.radius && typeof damagePlayer === 'function') {
            damagePlayer(m.userData.damage);
          }
          m.userData.lastDamageTime = now;
        }
      } else if (m.userData.isBossShield) {
        // Boss shield - pulsing effect
        m.material.opacity = 0.3 + Math.sin(now * 0.01) * 0.1;
      } else {
        const scale = 1 + t * 2.5;
        m.scale.setScalar(scale);
        m.material.opacity = 0.7 * (1 - t);
      }
    }
  }
}

// ============================================================
//  BOSS ATTACK HELPER FUNCTIONS
// ============================================================

// Create shockwave for Scrap Golem
if (typeof window !== 'undefined') {
  window.createBossShockwave = function(position, radius, damage) {
    // Visual shockwave ring
    const ringGeo = new THREE.RingGeometry(0.5, radius, 32);
    const ringMat = new THREE.MeshBasicMaterial({
      color: 0x886644,
      transparent: true,
      opacity: 0.8,
      side: THREE.DoubleSide
    });
    const ring = new THREE.Mesh(ringGeo, ringMat);
    ring.position.copy(position);
    ring.rotation.x = -Math.PI / 2;
    ring.userData.createdAt = performance.now();
    ring.userData.duration = 1000;
    ring.userData.radius = radius;
    scene.add(ring);
    explosionVisuals.push(ring);
    
    // Spawn debris projectiles that can be shot down
    const debrisCount = 5 + Math.floor(damage / 10);
    for (let i = 0; i < debrisCount; i++) {
      const angle = (i / debrisCount) * Math.PI * 2;
      const debrisGeo = new THREE.BoxGeometry(0.15, 0.15, 0.15);
      const debrisMat = new THREE.MeshBasicMaterial({
        color: 0x886644,
        transparent: true,
        opacity: 0.9
      });
      const debris = new THREE.Mesh(debrisGeo, debrisMat);
      debris.position.copy(position);
      debris.position.y += 0.5;
      
      const direction = new THREE.Vector3(
        Math.cos(angle),
        0.3,
        Math.sin(angle)
      ).normalize();
      
      debris.userData.direction = direction;
      debris.userData.speed = 8;
      debris.userData.damage = Math.floor(damage / debrisCount);
      debris.userData.isBossProjectile = true;
      debris.userData.createdAt = performance.now();
      debris.userData.duration = 1500;
      scene.add(debris);
      projectiles.push(debris);
    }
  };

  // Create explosion for Holo Phantom decoys
  window.createExplosionAt = function(position, radius, damage) {
    spawnExplosionVisual(position, radius);
    
    // Check if player is in range
    const playerPos = camera.position;
    const dist = playerPos.distanceTo(position);
    if (dist < radius) {
      if (typeof damagePlayer === 'function') {
        damagePlayer(damage);
      }
    }
  };
  
  // Create shootable decoy for Holo Phantom
  window.createHoloDecoy = function(position, explosionDamage, explosionRadius) {
    const decoyGeo = new THREE.SphereGeometry(0.4, 8, 8);
    const decoyMat = new THREE.MeshBasicMaterial({
      color: 0x00ffff,
      transparent: true,
      opacity: 0.7
    });
    const decoy = new THREE.Mesh(decoyGeo, decoyMat);
    decoy.position.copy(position);
    decoy.userData.isBossProjectile = true;
    decoy.userData.isDecoy = true;
    decoy.userData.explosionDamage = explosionDamage;
    decoy.userData.explosionRadius = explosionRadius;
    decoy.userData.createdAt = performance.now();
    decoy.userData.duration = 2500;
    scene.add(decoy);
    projectiles.push(decoy);
  };

  // Fire pulse wave for Pulse Emitter
  window.fireBossPulse = function(fromPos, targetPos, damage) {
    const direction = targetPos.clone().sub(fromPos).normalize();
    const pulseGeo = new THREE.SphereGeometry(0.3, 8, 8);
    const pulseMat = new THREE.MeshBasicMaterial({
      color: 0xff0088,
      transparent: true,
      opacity: 0.9
    });
    const pulse = new THREE.Mesh(pulseGeo, pulseMat);
    pulse.position.copy(fromPos);
    pulse.userData.direction = direction;
    pulse.userData.speed = 15;
    pulse.userData.damage = damage;
    pulse.userData.isBossProjectile = true;
    pulse.userData.createdAt = performance.now();
    pulse.userData.duration = 3000;
    scene.add(pulse);
    projectiles.push(pulse);
  };

  // Create shield for Pulse Emitter
  window.createBossShield = function(position, radius) {
    const shieldGeo = new THREE.SphereGeometry(radius, 16, 16);
    const shieldMat = new THREE.MeshBasicMaterial({
      color: 0xff0088,
      transparent: true,
      opacity: 0.3,
      side: THREE.DoubleSide
    });
    const shield = new THREE.Mesh(shieldGeo, shieldMat);
    shield.position.copy(position);
    shield.userData.isBossShield = true;
    shield.userData.isBossProjectile = true; // Can be shot down
    shield.userData.createdAt = performance.now();
    shield.userData.duration = 3000;
    scene.add(shield);
    explosionVisuals.push(shield);
  };

  // Create toxic pool for Rust Serpent
  window.createToxicPool = function(position, radius, damage) {
    const poolGeo = new THREE.CircleGeometry(radius, 32);
    const poolMat = new THREE.MeshBasicMaterial({
      color: 0xcc4400,
      transparent: true,
      opacity: 0.6,
      side: THREE.DoubleSide
    });
    const pool = new THREE.Mesh(poolGeo, poolMat);
    pool.position.copy(position);
    pool.position.y = 0.1;
    pool.rotation.x = -Math.PI / 2;
    pool.userData.isToxicPool = true;
    pool.userData.isBossProjectile = true; // Can be shot
    pool.userData.damage = damage;
    pool.userData.createdAt = performance.now();
    pool.userData.duration = 5000;
    pool.userData.lastDamageTime = 0;
    scene.add(pool);
    explosionVisuals.push(pool);
  };

  // Fire lightning bolt for Static Wisp
  window.fireBossLightning = function(fromPos, targetPos, damage) {
    // Create visual lightning bolt
    createLightningBolt(fromPos, targetPos);
    
    // Also create a projectile that can be shot down
    const direction = targetPos.clone().sub(fromPos).normalize();
    const lightningGeo = new THREE.SphereGeometry(0.25, 6, 6);
    const lightningMat = new THREE.MeshBasicMaterial({
      color: 0xffff00,
      transparent: true,
      opacity: 0.95
    });
    const lightning = new THREE.Mesh(lightningGeo, lightningMat);
    lightning.position.copy(fromPos);
    lightning.userData.direction = direction;
    lightning.userData.speed = 20;
    lightning.userData.damage = damage;
    lightning.userData.isBossProjectile = true;
    lightning.userData.createdAt = performance.now();
    lightning.userData.duration = 2000;
    scene.add(lightning);
    projectiles.push(lightning);
  };
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

function markProjectileHit(proj) {
  if (!proj?.userData?.shotId) return;
  proj.userData.hitConfirmed = true;
  markAccuracyHit(proj.userData.shotId);
}

function resolveProjectileAccuracy(proj) {
  if (!proj?.userData?.shotId) return;
  resolveAccuracyPellet(proj.userData.shotId);
}

function updateProjectiles(dt) {
  const now = performance.now();
  const raycaster = new THREE.Raycaster();
  const enemies = getEnemyMeshes(true).concat(getBossMinionMeshes());

  for (let i = projectiles.length - 1; i >= 0; i--) {
    const proj = projectiles[i];

    // Skip undefined projectiles (safety check)
    if (!proj) {
      projectiles.splice(i, 1);
      continue;
    }

    // Skip projectiles with missing data (safety check)
    if (!proj.userData || !proj.userData.stats) {
      // Check if this is a boss projectile
      if (proj.userData && proj.userData.damage && proj.userData.direction) {
        // Boss projectile - move it
        const age = now - proj.userData.createdAt;
        if (age > proj.userData.duration) {
          scene.remove(proj);
          projectiles.splice(i, 1);
          continue;
        }
        
        // Move boss projectile
        proj.position.addScaledVector(proj.userData.direction, proj.userData.speed * dt);
        
        // Check collision with player
        const playerPos = camera.position;
        const dist = proj.position.distanceTo(playerPos);
        if (dist < 1.0) {
          // Hit player
          if (typeof damagePlayer === 'function') {
            damagePlayer(proj.userData.damage);
          }
          scene.remove(proj);
          projectiles.splice(i, 1);
          continue;
        }
        
        continue;
      }
      
      resolveProjectileAccuracy(proj);
      if (proj.userData?.isPooled) {
        returnProjectileToPool(proj);
      } else {
        scene.remove(proj);
      }
      projectiles.splice(i, 1);
      continue;
    }
    
    const age = now - proj.userData.createdAt;

    // Remove expired projectiles - return to pool
    if (age > proj.userData.lifetime) {
      resolveProjectileAccuracy(proj);
      if (proj.userData.isPooled) {
        returnProjectileToPool(proj);
      } else {
        scene.remove(proj);
      }
      projectiles.splice(i, 1);
      continue;
    }

    // Check if projectile is inside a stasis field
    const slowFactor = getStasisSlowFactor(proj.position);
    const adjustedDt = dt * slowFactor;

    // Move projectile (apply stasis slow effect)
    const moveDistance = proj.userData.velocity.length() * adjustedDt;
    proj.position.addScaledVector(proj.userData.velocity, adjustedDt);

    // Check if projectile passes through nanite swarm and gains nanite damage
    checkProjectileNaniteInteraction(proj);

    // Check collision with plasma orbs (player can shoot orbs to detonate early)
    if (checkPlasmaOrbDetonation(proj)) {
      markProjectileHit(proj);
      resolveProjectileAccuracy(proj);
      if (proj.userData.isPooled) {
        returnProjectileToPool(proj);
      } else {
        scene.remove(proj);
      }
      projectiles.splice(i, 1);
      continue;
    }

    // Check collision with reflector drones (overcharge mechanic)
    if (proj.userData.controllerIndex !== undefined && checkPlayerProjectileHitsDrone(proj.position, proj.userData.controllerIndex)) {
      markProjectileHit(proj);
      resolveProjectileAccuracy(proj);
      if (proj.userData.isPooled) {
        returnProjectileToPool(proj);
      } else {
        scene.remove(proj);
      }
      projectiles.splice(i, 1);
      continue;
    }

    // Check collision with enemies
    raycaster.set(proj.position, proj.userData.velocity.clone().normalize());
    const hits = raycaster.intersectObjects(enemies, true);

    if (hits.length > 0 && hits[0].distance < moveDistance * 2) {
      const result = getEnemyByMesh(hits[0].object);
      if (result && result.boss) {
        markProjectileHit(proj);
        handleBossHit(result.boss, proj.userData.stats, hits[0].point, proj.userData.controllerIndex);
        if (!proj.userData.stats?.piercing) {
          resolveProjectileAccuracy(proj);
          if (proj.userData.isPooled) {
            returnProjectileToPool(proj);
          } else {
            scene.remove(proj);
          }
          projectiles.splice(i, 1);
        }
      } else if (result && result.index !== undefined && !proj.userData.hitEnemies.has(result.index)) {
        proj.userData.hitEnemies.add(result.index);
        const hitObj = hits[0].object;
        const hitWeakPoint = hitObj.userData && hitObj.userData.weakPoint === true;

        // Check if projectile is nanite-infused (passed through nanite swarm)
        const naniteDamage = proj.userData.naniteInfused ? 5 : 0;

        // Apply nanite damage and reveal enemy
        if (naniteDamage > 0) {
          const enemy = result.enemy;
          if (!enemy._naniteRevealed) {
            enemy._naniteRevealed = true;
            if (enemy.mesh.material) {
              enemy.mesh.material.emissive = new THREE.Color(0xffd700);
              enemy.mesh.material.emissiveIntensity = 0.5;
            }
          }
        }

        markProjectileHit(proj);
        handleHit(result.index, result.enemy, { ...proj.userData.stats, damage: proj.userData.stats.damage + naniteDamage }, hits[0].point, proj.userData.controllerIndex, proj.userData.isExploding, hitWeakPoint);

        // Ricochet effect
        if (proj.userData.stats?.ricochetBounces > 0) {
          handleRicochet(hits[0].point, proj.userData.stats, 0, proj.userData.controllerIndex);
        }

        // Remove projectile if not piercing - return to pool
        if (!proj.userData.stats?.piercing) {
          resolveProjectileAccuracy(proj);
          if (proj.userData.isPooled) {
            returnProjectileToPool(proj);
          } else {
            scene.remove(proj);
          }
          projectiles.splice(i, 1);
        }
      } else {
        const minionResult = getBossMinionByMesh(hits[0].object);
        if (minionResult) {
          markProjectileHit(proj);
          const mResult = hitBossMinion(minionResult.index, proj.userData.stats?.damage);
          spawnDamageNumber(hits[0].point, proj.userData.stats?.damage, '#ff8800');
          if (mResult.killed) playExplosionSound();
          if (!proj.userData.stats?.piercing) {
            resolveProjectileAccuracy(proj);
            if (proj.userData.isPooled) {
              returnProjectileToPool(proj);
            } else {
              scene.remove(proj);
            }
            projectiles.splice(i, 1);
          }
        }
      }
    }
    
    // Check collision with boss projectiles (player can shoot them down)
    if (proj.userData.stats) { // Only player projectiles
      const bossProjs = getBossProjectiles();
      if (bossProjs.length > 0) {
        for (let j = bossProjs.length - 1; j >= 0; j--) {
          const bossProj = bossProjs[j];
          if (!bossProj || !bossProj.mesh) continue;
          const dist = proj.position.distanceTo(bossProj.mesh.position);
          if (dist < 0.5) {
            spawnExplosionVisual(bossProj.mesh.position.clone(), 0.5);
            markProjectileHit(proj);
            scene.remove(bossProj.mesh);
            if (bossProj.mesh.geometry) bossProj.mesh.geometry.dispose();
            if (bossProj.mesh.material) bossProj.mesh.material.dispose();
            bossProjs.splice(j, 1);

            if (!proj.userData.stats?.piercing) {
              markProjectileHit(proj);
              resolveProjectileAccuracy(proj);
              if (proj.userData.isPooled) {
                returnProjectileToPool(proj);
              } else {
                scene.remove(proj);
              }
              projectiles.splice(i, 1);
            }
            break;
          }
        }
      }

      for (let j = i - 1; j >= 0; j--) {
        const bossProj = projectiles[j];
        if (!bossProj || !bossProj.userData) continue;
        
        // Check if this is a boss projectile
        if (bossProj.userData.isBossProjectile || bossProj.userData.damage) {
          const dist = proj.position.distanceTo(bossProj.position);
          if (dist < 0.5) { // Collision radius
            // Destroy boss projectile
            spawnExplosionVisual(bossProj.position.clone(), 0.5);
            markProjectileHit(proj);
            
            // If it's a decoy, explode it
            if (bossProj.userData.isDecoy && typeof window !== 'undefined' && window.createExplosionAt) {
              window.createExplosionAt(bossProj.position.clone(), bossProj.userData.explosionRadius, bossProj.userData.explosionDamage);
            }
            
            scene.remove(bossProj);
            projectiles.splice(j, 1);
            
            // Destroy player projectile (unless piercing)
            if (!proj.userData.stats?.piercing) {
              markProjectileHit(proj);
              resolveProjectileAccuracy(proj);
              if (proj.userData.isPooled) {
                returnProjectileToPool(proj);
              } else {
                scene.remove(proj);
              }
              projectiles.splice(i, 1);
            }
            
            break; // Only hit one boss projectile
          }
        }
      }
      
      // Also check collision with explosionVisuals (toxic pools, etc.)
      if (proj.userData.stats && projectiles[i]) { // Make sure projectile still exists
        for (let k = explosionVisuals.length - 1; k >= 0; k--) {
          const visual = explosionVisuals[k];
          if (visual.userData.isBossProjectile) {
            const dist = proj.position.distanceTo(visual.position);
            if (dist < 1.0) { // Larger radius for area effects
              // Destroy the visual
              spawnExplosionVisual(visual.position.clone(), 0.3);
              scene.remove(visual);
              explosionVisuals.splice(k, 1);
              markProjectileHit(proj);
              
              // Destroy player projectile (unless piercing)
              if (!proj.userData.stats?.piercing) {
                resolveProjectileAccuracy(proj);
                if (proj.userData.isPooled) {
                  returnProjectileToPool(proj);
                } else {
                  scene.remove(proj);
                }
                projectiles.splice(i, 1);
              }
              
              break;
            }
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
      if (bossId) {
        spawnBoss(bossId, cfg);
        playBossSpawn();
        playBossMusic(getBossTier(game.level));
      }
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

      // Alert on enemy spawn
      if (type === 'fast') {
        playFastEnemySpawn();
      } else if (type === 'swarm') {
        playSwarmEnemySpawn();
      } else if (type === 'tank') {
        playTankEnemySpawn();
      } else {
        playBasicEnemySpawn();
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
  frameCount++;
  const now = timestamp || performance.now();
  const rawDt = Math.min((now - lastTime) / 1000, 0.1);
  lastTime = now;

  // PERFORMANCE: Log stats every 5 seconds in debug mode
  if (typeof window !== 'undefined' && window.debugPerfMonitor && frameCount % 300 === 0) {
    console.log(`[PERF] Projectiles: ${projectiles.length}/${MAX_PROJECTILES}, ` +
                `Pool: ${projectilePool.filter(p => p.visible).length}/${projectilePool.length} active, ` +
                `Explosions: ${explosionVisuals.length}`);
  }

  if (slowMoCooldown > 0) {
    slowMoCooldown = Math.max(0, slowMoCooldown - rawDt);
  }

  // Apply bullet-time slow-mo, ramp-out, and death sequence (use raw dt)
  if (slowMoRampOut) {
    slowMoRampOutTimer -= rawDt;
    if (slowMoRampOutTimer <= 0) {
      slowMoRampOut = false;
      timeScale = 1.0;
    } else {
      timeScale = 0.2 + (1 - slowMoRampOutTimer / SLOW_MO_RAMP_OUT_DURATION) * 0.8;
    }
  } else if (game.slowmoActive) {
    // Death sequence slow-mo
    const remaining = game.slowmoTimer - now;
    if (remaining <= 0) {
      // Time's up - rapid ramp back
      game.slowmoActive = false;
      game.timeScale = 1.0;
      console.log('[slow-mo] Death sequence ended');
    } else {
      game.timeScale = game.slowmoIntensity;
    }
  } else if (slowMoActive) {
    slowMoDuration -= rawDt;
    if (slowMoDuration <= 0) {
      slowMoActive = false;
      slowMoSoundPlayed = false;
      timeScale = 1.0;
      slowMoTriggerEnemyIds.clear();
      console.log('[bullet-time] ENDED');
    } else {
      timeScale = 0.2;
    }
  } else {
    timeScale = 1.0;
    game.timeScale = 1.0;
  }

  // Use game.timeScale if death sequence is active, otherwise use bullet-time timeScale
  const effectiveTimeScale = game.slowmoActive ? game.timeScale : timeScale;

  const dt = rawDt * effectiveTimeScale;  // Scaled time for game logic

  if (currentTheme) {
    updateAmbientParticles(rawDt, currentTheme, camera.position);
  }
  updateBiomeProps(now, rawDt);

  const st = game.state;

  // ── Title screen ──
  if (st === State.TITLE) {
    updateTitle(now);
    if (typeof window !== 'undefined' && window.debugJumpToLevel) {
      const level = window.debugJumpToLevel;
      window.debugJumpToLevel = null;
      debugJumpToLevel(level);
    }
  }

  // ── Playing ──
  else if (st === State.PLAYING) {
    // SAFEGUARD: Ensure blaster displays are visible during gameplay
    // Prevents text/billboard elements from disappearing
    blasterDisplays.forEach(d => { if (d) d.visible = false; });  // Hidden during gameplay
    spawnEnemyWave(dt);

    // Full-auto shooting / Lightning beams (VR controllers)
    for (let i = 0; i < 2; i++) {
      if (controllerTriggerPressed[i]) {
        const hand = getHandForController(i);
        const mainWeaponId = game.mainWeapon[hand];
        const stats = getWeaponStats(mainWeaponId, game.upgrades[hand]);

        if (stats.chargeShot) {
          if (chargeShotStartTime[i] === null) chargeShotStartTime[i] = now;
        } else if (stats.lightning) {
          updateLightningBeam(controllers[i], i, stats, dt);
        } else {
          fireMainWeapon(controllers[i], i);
        }
      } else {
        if (chargeShotStartTime[i] !== null) chargeShotStartTime[i] = null;
        if (lightningBeams[i]) {
          scene.remove(lightningBeams[i]);
          lightningBeams[i] = null;
        }
      }
    }

    // Desktop controls firing (keyboard/mouse)
    if (isDesktopEnabled()) {
      const desktopWeapon = getWeaponState();
      
      if (desktopWeapon.triggerPressed) {
        // Handle fire mode: left, right, or both
        if (desktopWeapon.fireMode === 'left' || desktopWeapon.fireMode === 'both') {
          const virtualController = getVirtualController('left');
          if (virtualController) {
            const stats = getWeaponStats(game.mainWeapon.left, game.upgrades.left);
            if (stats.chargeShot) {
              if (chargeShotStartTime[0] === null) chargeShotStartTime[0] = now;
            } else if (stats.lightning) {
              updateLightningBeam(virtualController, 0, stats, dt);
            } else {
              fireMainWeapon(virtualController, 0);
            }
          }
        }

        if (desktopWeapon.fireMode === 'right' || desktopWeapon.fireMode === 'both') {
          const virtualController = getVirtualController('right');
          if (virtualController) {
            const stats = getWeaponStats(game.mainWeapon.right, game.upgrades.right);
            if (stats.chargeShot) {
              if (chargeShotStartTime[1] === null) chargeShotStartTime[1] = now;
            } else if (stats.lightning) {
              updateLightningBeam(virtualController, 1, stats, dt);
            } else {
              fireMainWeapon(virtualController, 1);
            }
          }
        }
      } else {
        // Release charge shots when not pressing fire
        if (chargeShotStartTime[0] !== null) {
          // Fire the charge shot on release
          const virtualController = getVirtualController('left');
          if (virtualController) {
            fireMainWeapon(virtualController, 0);
          }
          chargeShotStartTime[0] = null;
        }
        if (chargeShotStartTime[1] !== null) {
          // Fire the charge shot on release
          const virtualController = getVirtualController('right');
          if (virtualController) {
            fireMainWeapon(virtualController, 1);
          }
          chargeShotStartTime[1] = null;
        }
        // Clear lightning beams
        if (lightningBeams[0]) {
          scene.remove(lightningBeams[0]);
          lightningBeams[0] = null;
        }
        if (lightningBeams[1]) {
          scene.remove(lightningBeams[1]);
          lightningBeams[1] = null;
        }
      }
    }

    // Fast enemy proximity alerts
    updateFastEnemyAlerts(dt, camera.position);

    // Update enemies
    const playerPos = camera.position.clone();
    camera.getWorldDirection(_playerForward);
    _playerForward.y = 0;
    if (_playerForward.lengthSq() < 0.0001) {
      _playerForward.set(0, 0, -1);
    } else {
      _playerForward.normalize();
    }
    setPlayerForward(_playerForward);

    // Update decoys and black holes
    updateDecoys(dt, now, playerPos);
    updateMinesAndBlackHoles(dt, now, playerPos);
    updateTethers(dt, now, playerPos);
    updateNaniteSwarms(now, dt, playerPos);
    updatePhaseDashAfterimages(now, dt);
    updateReflectorDrones(now, dt, playerPos);

    // Laser mine passive spawning (when player stands still)
    spawnLaserMinesPassively(playerPos, now, dt);

    // Update laser mines
    updateLaserMines(now, dt);

    // If in slow-mo, check whether the triggering enemies are dead → ramp out over 0.5s + reverse sound
    if (slowMoActive && !slowMoRampOut) {
      const enemiesForRamp = getEnemies();
      const aliveIds = new Set(enemiesForRamp.map(e => e.mesh.uuid));
      const anyAlive = [...slowMoTriggerEnemyIds].some(id => aliveIds.has(id));
      if (!anyAlive) {
        slowMoActive = false;
        slowMoSoundPlayed = false;
        slowMoRampOut = true;
        slowMoRampOutTimer = SLOW_MO_RAMP_OUT_DURATION;
        slowMoTriggerEnemyIds.clear();
        playSlowMoReverseSound();
        console.log('[bullet-time] RAMP OUT — enemies dead');
      }
    }

    // Check for danger-close bullet-time trigger (ONLY when enemies are too close)
    if (!slowMoActive && !slowMoRampOut && slowMoCooldown <= 0) {
      const enemies = getEnemies();
      const closeEnemies = enemies.filter(e => e.mesh.position.distanceTo(playerPos) < SLOW_MO_TRIGGER_DIST);
      if (closeEnemies.length > 0) {
        slowMoActive = true;
        slowMoDuration = SLOW_MO_DURATION;
        slowMoCooldown = SLOW_MO_COOLDOWN;
        slowMoTriggerEnemyIds = new Set(closeEnemies.map(e => e.mesh.uuid));
        console.log('[bullet-time] ACTIVATED — enemy too close!');
      }
      if (slowMoActive && !slowMoSoundPlayed) {
        playSlowMoSound();
        slowMoSoundPlayed = true;
      }
    }

    // Update desktop controls (WASD + mouse) if in desktop mode
    const desktopUpdates = updateDesktopControls(dt);
    const collisions = updateEnemies(dt, now, playerPos);

    // Boss update and health bar
    const boss = getBoss();
    if (boss) {
      updateBoss(dt, now, playerPos);
      updateBossMinions(dt, playerPos);
      showBossHealthBar(boss.hp, boss.maxHp, boss.phases);
      updateBossHealthBar(boss.hp, boss.maxHp, boss.phases);

      // Check if boss was killed
      if (boss.hp <= 0) {
        console.log(`[boss] Boss defeated!`);
        if (typeof window !== 'undefined' && window.playBossDeath) {
          window.playBossDeath();
        }
        stopMusic();

        // Clean up boss
        clearBoss();

        // Complete the level (boss level)
        completeLevel();
      }
    } else {
      hideBossHealthBar();
    }

    // Handle enemy collisions with player
    collisions.forEach(index => {
      destroyEnemy(index);
      const dead = damagePlayer(1);
      triggerHitFlash();
      playDamageSound();

      // Trigger camera shake
      cameraShake = 0.5;  // 0.5 second shake duration
      cameraShakeIntensity = 0.05;  // shake magnitude
      originalCameraPos.copy(camera.position);

      // Light screen shake on player damage
      triggerScreenShake(0.15, 500); // 0.15 shake for 500ms

      // Trigger floor flash
      floorFlashing = true;
      floorFlashTimer = 0.5;

      slowMoActive = false;
      slowMoRampOut = false;
      timeScale = 1.0;
      slowMoTriggerEnemyIds.clear();
      console.log(`[damage] Player hit! Health: ${game.health}`);
      if (dead) {
        endGame(false);
      }
    });

    // Boss collision with player
    if (boss && boss.mesh.position.distanceTo(playerPos) < 1.5) {
      const now = performance.now();
      const contactCooldown = boss.def?.contactCooldown ?? 800;
      const contactDamage = boss.def?.contactDamage ?? 2;

      if (!boss._lastContactHit || now - boss._lastContactHit >= contactCooldown) {
        boss._lastContactHit = now;
        const dead = damagePlayer(contactDamage);
        triggerHitFlash();
        playDamageSound();
        cameraShake = 0.6;
        cameraShakeIntensity = 0.06;
        originalCameraPos.copy(camera.position);

        // Bigger shake for boss collision
        triggerScreenShake(0.3, 300); // 0.3 shake for 300ms

        floorFlashing = true;
        floorFlashTimer = 0.5;
        slowMoActive = false;
        slowMoRampOut = false;
        timeScale = 1.0;
        slowMoTriggerEnemyIds.clear();
        if (dead) endGame(false);
      }
    }

    // Boss projectiles
    updateBossProjectiles(dt, now, playerPos);
    const bossProjs = getBossProjectiles();
    for (let i = bossProjs.length - 1; i >= 0; i--) {
      const proj = bossProjs[i];
      if (proj.hitPlayer) {
        // Check if reflector drone can reflect this projectile
        if (checkReflectorDroneReflection(proj.mesh.position, true)) {
          // Projectile was reflected - remove it without damaging player
          scene.remove(proj.mesh);
          proj.mesh.geometry.dispose();
          proj.mesh.material.dispose();
          bossProjs.splice(i, 1);
          continue;
        }

        scene.remove(proj.mesh);
        proj.mesh.geometry.dispose();
        proj.mesh.material.dispose();
        bossProjs.splice(i, 1);

        const dead = damagePlayer(1);
        triggerHitFlash();
        playDamageSound();
        cameraShake = 0.4;
        cameraShakeIntensity = 0.04;
        originalCameraPos.copy(camera.position);

        // Light screen shake on projectile damage
        triggerScreenShake(0.15, 500); // 0.15 shake for 500ms

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

            // Update HUD immediately to show correct kill count before level complete check
            updateHUD(game);

            // KILL CHAIN SYSTEM (same as handleHit)
            const now = performance.now();


            // Check for slow-mo death (last enemy of wave)
            const cfg = game._levelConfig;
            if (cfg && !cfg.isBoss) {
              const enemiesRemaining = getEnemyCount();
              if (enemiesRemaining === 0 && game.kills < cfg.killTarget) {
                // Last enemy killed but not level complete yet - trigger slow-mo
                triggerSlowmoDeathSequence();
              }
            }

            if (cfg && game.kills >= cfg.killTarget) {
              completeLevel();
            }
          }
        }
      }
    });

    // Update HUD (staggered — every 3rd frame to reduce geometry recreation cost)
    game._levelConfig = getLevelConfig();
    if (frameCount % 3 === 0) {
      updateHUD(game);
    }
  }

  // ── Ready screen countdown ──
  else if (st === State.READY_SCREEN) {
    updateReadyCountdown(now);
  }

  // ── Level complete (cooldown before upgrade screen) ──
  else if (st === State.LEVEL_COMPLETE) {
    game.stateTimer -= dt;
    if (game.stateTimer <= 0 && levelFadeReady) {
      showUpgradeScreen();
    }
  }

  // ── Upgrade selection ──
  else if (st === State.UPGRADE_SELECT) {
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
      break;  // Only need one controller for hover
    }
  }

  // ── Unified UI hover detection for all menu states ──
  if (st === State.TITLE || st === State.UPGRADE_SELECT || st === State.SCOREBOARD || 
      st === State.REGIONAL_SCORES || st === State.COUNTRY_SELECT || st === State.READY_SCREEN) {
    // Collect all raycasters from controllers
    const raycasters = [];
    for (let i = 0; i < controllers.length; i++) {
      const ctrl = controllers[i];
      if (!ctrl) continue;
      const origin = new THREE.Vector3();
      const quat = new THREE.Quaternion();
      ctrl.getWorldPosition(origin);
      ctrl.getWorldQuaternion(quat);
      const dir = new THREE.Vector3(0, 0, -1).applyQuaternion(quat);
      raycasters.push(new THREE.Raycaster(origin, dir, 0, 10));
    }
    // Also add desktop aim raycaster if available
    if (isDesktopEnabled()) {
      const desktopRC = getAimRaycaster();
      if (desktopRC) raycasters.push(desktopRC);
    }
    // Update hover effects
    if (raycasters.length > 0) {
      updateHUDHover(raycasters);
    }
  }

  // ── Scoreboard / Regional Scores ──
  // (scrolling handled by button hits in trigger handler)

  // ── Country Select ──
  // (interaction handled in trigger handler)

  // ── Environment fade transitions ──
  if (environmentFadeState) {
    environmentFadeState.timer -= rawDt;
    const progress = 1 - Math.max(0, environmentFadeState.timer) / environmentFadeState.duration;
    const fadeValue = environmentFadeState.direction === 'out' ? progress : 1 - progress;
    applyEnvironmentFade(fadeValue);

    if (environmentFadeState.timer <= 0) {
      const onComplete = environmentFadeState.onComplete;
      const finalFade = environmentFadeState.direction === 'out' ? 1 : 0;
      environmentFadeState = null;
      applyEnvironmentFade(finalFade);
      if (onComplete) onComplete();
    }
  }

  // ── Camera shake on damage ──
  if (cameraShake > 0) {
    cameraShake -= rawDt;
    if (cameraShake <= 0) {
      cameraShake = 0;
    } else {
      // Apply random shake offset
      const shake = cameraShakeIntensity * (cameraShake / 0.5);  // Fade out over duration
      camera.position.x += (Math.random() - 0.5) * shake;
      camera.position.y += (Math.random() - 0.5) * shake;
      camera.position.z += (Math.random() - 0.5) * shake;
    }
  }

  // ── Screen shake removed - using floor flash instead ──
  // Screen shake was causing camera position issues
  // Floor flash provides better damage feedback

  // ── Low health warning (half heart) ──
  const lowHealthThreshold = 1;
  const shouldLowHealthWarn = game.state === State.PLAYING && game.health > 0 && game.health <= lowHealthThreshold;
  if (shouldLowHealthWarn && !lowHealthWarningActive) {
    lowHealthWarningActive = true;
    lowHealthPulseTimer = 0;
    startLowHealthWarningSound();
  } else if (!shouldLowHealthWarn && lowHealthWarningActive) {
    lowHealthWarningActive = false;
    lowHealthPulseTimer = 0;
    stopLowHealthWarningSound();
    if (floorMaterial && !floorFlashing) {
      floorMaterial.color.copy(floorBaseColor);
    }
  }

  // ── Floor damage flash ──
  if (floorFlashing && floorMaterial) {
    floorFlashTimer -= rawDt;
    if (floorFlashTimer <= 0) {
      floorFlashing = false;
      floorMaterial.color.copy(floorBaseColor);
    } else {
      // Lerp from red/white back to base color
      const t = floorFlashTimer / 0.5;  // 0.5s flash duration
      const flashColor = new THREE.Color(0xff2222);  // Bright red
      floorMaterial.color.lerpColors(floorBaseColor, flashColor, t);
    }
  }

  // ── Low health pulse (only when not flashing) ──
  if (!floorFlashing && lowHealthWarningActive && floorMaterial) {
    lowHealthPulseTimer += rawDt;
    const pulse = (Math.sin(lowHealthPulseTimer * 2.6) + 1) * 0.5;
    const intensity = 0.2 + pulse * 0.45;
    const warningColor = new THREE.Color(0xaa0000);
    floorMaterial.color.lerpColors(floorBaseColor, warningColor, intensity);
  }

  // ── Environment: sun stays constant size (removed level scaling) ──
  // Sun scaling removed - was old progression system
  // Biomes will handle environment changes instead
  if (ominousRef) {
    if (game.level >= 10) {
      const t = Math.min(1, (game.level - 10) / 6); // 0 at 10, 1 at 16
      ominousRef.visible = true;
      ominousRef.material.opacity = 0.25 + t * 0.6;
      ominousRef.scale.setScalar(0.5 + t * 1.2);
    } else {
      ominousRef.visible = false;
    }
  }

  // ── Universal updates ──
  updateProjectiles(dt);
  updateVoxelPhysics(dt, now);  // PHYSICS DEATH SYSTEM
  updateShields(now);
  updateStasisFields(now, dt);
  updatePlasmaOrbs(now, dt);
  updateExplosions(dt, now);
  updateExplosionVisuals(now);
  updateDamageNumbers(dt, now);
  updateStatusBubbles(dt, now);
  updateHitFlash(rawDt);  // Use rawDt so flash works during bullet-time

  // ── New ALT weapon updates ──
  updateGrenades(dt, now);
  updateProximityMines(now, dt);
  updateAttackDrones(now, dt, camera.position);
  updateEMPVisuals(now, dt);
  updateTeleportEffects(now, dt);
  updateFPS(now, {
    perfMonitor: (typeof window !== 'undefined' && window.debugPerfMonitor) || game.debugPerfMonitor,
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
//  MUSIC VISUALIZER
// ============================================================
function updateMountainVisualizer() {
  const freqData = getMusicFrequencyData();
  if (!freqData || mountainLines.length === 0) return;

  mountainLines.forEach((layer, layerIndex) => {
    const peaks = mountainBasePeaks[layerIndex];
    if (!peaks) return;

    const points = [new THREE.Vector3(-100, 0, layer.z)];

    peaks.forEach((peak, i) => {
      // Map frequency bins to peaks (spread across spectrum)
      const binIndex = Math.floor((i / peaks.length) * freqData.length);
      const amplitude = freqData[binIndex] / 255;  // Normalize 0-1

      // Subtle height modulation (max 2 units up/down)
      const heightMod = amplitude * 2 * (layerIndex === 0 ? 0.8 : 1.2);
      const newY = peak.baseY + heightMod;

      points.push(new THREE.Vector3(peak.x, newY, layer.z));
    });

    points.push(new THREE.Vector3(100, 0, layer.z));

    // Update line geometry
    layer.geometry.setFromPoints(points);
    layer.geometry.attributes.position.needsUpdate = true;
  });
}


// ============================================================
//  WINDOW RESIZE
// ============================================================
function onWindowResize() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
}

// ── Custom biome scenes (new HTML-extracted biomes) ─────────

function rebuildBiomeScene(biomeId, theme) {
  if (!scene || !theme || !theme.customScene) {
    clearBiomeScene();
    return;
  }
  if (biomeSceneGroup && biomeSceneBiome === biomeId) return;

  clearBiomeScene();

  biomeSceneGroup = new THREE.Group();
  biomeSceneGroup.name = `biome-scene-${biomeId}`;
  scene.add(biomeSceneGroup);
  biomeSceneBiome = biomeId;

  if (theme.customScene === 'synthwave_valley') {
    buildSynthwaveValleyScene(biomeSceneGroup);
  } else if (theme.customScene === 'desert_night') {
    buildDesertNightScene(biomeSceneGroup);
  } else if (theme.customScene === 'alien_planet') {
    buildAlienPlanetScene(biomeSceneGroup);
  } else if (theme.customScene === 'hellscape_lava') {
    buildHellscapeLavaScene(biomeSceneGroup);
  }
}

function buildSynthwaveValleyScene(group) {
  const floorHeight = (floorMaterial && floorMaterial.userData && floorMaterial.userData.floorHeight) || -0.01;
  const floorY = floorHeight;
  // Lower brightness compared to HTML version
  const brightness = 0.55;

  // Sky dome (no stars, we use global starfield)
  const skyGeo = new THREE.SphereGeometry(2800, 32, 24);
  const skyMat = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    uniforms: {
      topColor: { value: new THREE.Color(0x2a004a) },
      midColor: { value: new THREE.Color(0x5c1b8f) },
      horizonColor: { value: new THREE.Color(0xaa2b7e) },
      glowColor: { value: new THREE.Color(0xff8fd6) },
    },
    vertexShader: `varying vec3 vWorldPosition; void main(){ vec4 worldPosition=modelMatrix*vec4(position,1.0); vWorldPosition=worldPosition.xyz; gl_Position=projectionMatrix*viewMatrix*worldPosition; }`,
    fragmentShader: `varying vec3 vWorldPosition; uniform vec3 topColor; uniform vec3 midColor; uniform vec3 horizonColor; uniform vec3 glowColor; void main(){ vec3 dir=normalize(vWorldPosition); float h=clamp(dir.y*0.5+0.5,0.0,1.0); vec3 col=mix(midColor, topColor, smoothstep(0.55,1.0,h)); col=mix(horizonColor, col, smoothstep(0.0,0.58,h)); float horizonBand=exp(-pow(abs(h-0.48)*10.0,2.0)); col+=glowColor*horizonBand*0.18; gl_FragColor=vec4(col*${brightness.toFixed(2)},1.0); }`,
    depthWrite: false,
  });
  const sky = new THREE.Mesh(skyGeo, skyMat);
  group.add(sky);
  registerFadeMaterial(skyMat);

  // Terrain
  const terrainUniforms = {
    uTime: { value: 0 },
    uGridColor: { value: new THREE.Color(0xff2ed1) },
    uBaseColor: { value: new THREE.Color(0x05000d) },
    uFogColor: { value: new THREE.Color(0x2a004a) },
    uRepeatZ: { value: 2000.0 },
    uOffsetZ: { value: 0.0 },
  };
  const terrainGeo = new THREE.PlaneGeometry(2000, 2000, 240, 240);
  terrainGeo.rotateX(-Math.PI / 2);
  const terrainMat = new THREE.ShaderMaterial({
    uniforms: terrainUniforms,
    side: THREE.DoubleSide,
    vertexShader: `uniform float uOffsetZ; uniform float uRepeatZ; varying vec3 vWorldPos; varying vec3 vObjPos; varying float vHeight; vec2 hash2(vec2 p){ p=vec2(dot(p, vec2(127.1,311.7)), dot(p, vec2(269.5,183.3))); return -1.0+2.0*fract(sin(p)*43758.5453123);} float noise(in vec2 p){ vec2 i=floor(p); vec2 f=fract(p); vec2 u=f*f*(3.0-2.0*f); return mix(mix(dot(hash2(i+vec2(0.0,0.0)), f-vec2(0.0,0.0)), dot(hash2(i+vec2(1.0,0.0)), f-vec2(1.0,0.0)), u.x), mix(dot(hash2(i+vec2(0.0,1.0)), f-vec2(0.0,1.0)), dot(hash2(i+vec2(1.0,1.0)), f-vec2(1.0,1.0)), u.x), u.y);} float fbm(vec2 p){ float value=0.0; float amp=0.5; for(int i=0;i<5;i++){ value+=amp*noise(p); p*=2.0; amp*=0.5;} return value;} float ridgeNoise(vec2 p){ float sum=0.0; float amp=0.55; for(int i=0;i<5;i++){ float n=noise(p); n=1.0-abs(n); n*=n; sum+=n*amp; p*=2.15; amp*=0.5;} return sum;} void main(){ vec3 pos=position; float tiledZ=mod(pos.z+uOffsetZ+uRepeatZ*0.5, uRepeatZ)-uRepeatZ*0.5; pos.z=tiledZ; vec2 p=pos.xz; float valleyMask=smoothstep(0.0,1.0, clamp(abs(pos.x)/240.0,0.0,1.0)); float broad=fbm(p*vec2(0.0035,0.0024))*16.0; float detail=fbm(p*vec2(0.012,0.01))*5.0; float ridges=ridgeNoise((p+vec2(0.0,-260.0))*0.008)*180.0; float mountainMask=pow(valleyMask,1.55); float centerDip=-10.0*(1.0-valleyMask); float distanceFade=smoothstep(750.0,120.0, abs(pos.z+120.0)); float h=broad+detail+centerDip; h+=ridges*mountainMask*distanceFade; if(pos.z>700.0){ h*=smoothstep(1000.0,700.0,pos.z);} pos.y=h; vec4 world=modelMatrix*vec4(pos,1.0); vWorldPos=world.xyz; vObjPos=pos; vHeight=h; gl_Position=projectionMatrix*viewMatrix*world; }`,
    fragmentShader: `uniform vec3 uGridColor; uniform vec3 uBaseColor; uniform vec3 uFogColor; varying vec3 vWorldPos; varying vec3 vObjPos; varying float vHeight; float gridLine(float coord,float width){ float g=abs(fract(coord-0.5)-0.5)/fwidth(coord); return 1.0-smoothstep(width,width+1.0,g);} void main(){ float gridScale=1.0/3.0; float gx=gridLine(vObjPos.x*gridScale,0.35); float gz=gridLine(vObjPos.z*gridScale,0.35); float grid=max(gx,gz); float glowPath=exp(-abs(vObjPos.x)*0.014)*smoothstep(350.0,-150.0,vObjPos.z); grid=max(grid, glowPath*0.30); vec3 base=uBaseColor; vec3 col=mix(base, uGridColor, grid); float ridgeGlow=smoothstep(48.0,160.0,vHeight)*smoothstep(100.0,350.0,abs(vObjPos.x)); col+=uGridColor*ridgeGlow*0.12; float fogAmount=1.0-exp(-0.0008*0.0008*gl_FragCoord.z*gl_FragCoord.z); col=mix(col,uFogColor, clamp(fogAmount*0.55,0.0,1.0)); gl_FragColor=vec4(col*${brightness.toFixed(2)},1.0); }`,
  });
  const terrain = new THREE.Mesh(terrainGeo, terrainMat);
  terrain.position.set(0, floorY, -700);
  terrain.frustumCulled = false;
  group.add(terrain);
  registerFadeMaterial(terrainMat);

  // Mountains
  const makeLayer = (color, opacity, scaleY, z, y) => {
    const points = [];
    const width = 2000;
    const step = 80;
    for (let x = -width / 2; x <= width / 2; x += step) {
      const n1 = Math.sin(x * 0.012 + z * 0.003) * 0.5 + 0.5;
      const n2 = Math.sin(x * 0.043 - z * 0.001) * 0.5 + 0.5;
      const spike = Math.pow(n1, 2.8) * 0.7 + Math.pow(n2, 5.0) * 0.5;
      points.push(new THREE.Vector2(x, spike * scaleY));
    }
    points.unshift(new THREE.Vector2(-width / 2, -120));
    points.push(new THREE.Vector2(width / 2, -120));
    const shape = new THREE.Shape(points);
    const geo = new THREE.ShapeGeometry(shape);
    const mat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity, depthWrite: false });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(0, y, z);
    group.add(mesh);
    registerFadeMaterial(mat);
  };
  makeLayer(0x5f1da8, 0.18, 80, -850, -10);
  makeLayer(0x7b2cbf, 0.22, 120, -700, -8);
  makeLayer(0x4a126e, 0.3, 150, -560, -5);

  // Sun + glow
  const sunGroup = new THREE.Group();
  sunGroup.position.set(0, 30, -760);
  group.add(sunGroup);

  const makeRadial = (inner, outer) => {
    const c = document.createElement('canvas');
    c.width = 512; c.height = 512;
    const ctx = c.getContext('2d');
    const g = ctx.createRadialGradient(256,256,0,256,256,256);
    g.addColorStop(0.0, inner);
    g.addColorStop(0.35, inner);
    g.addColorStop(0.6, outer);
    g.addColorStop(1.0, 'rgba(255,102,204,0)');
    ctx.fillStyle = g; ctx.fillRect(0,0,512,512);
    return new THREE.CanvasTexture(c);
  };
  const sunGlowTex = makeRadial('rgba(255,160,230,0.18)', 'rgba(255,102,204,0.0)');
  const sunCoreTex = makeRadial('rgba(255,255,255,0.85)', 'rgba(255,180,230,0.65)');
  const sunGlow = new THREE.Sprite(new THREE.SpriteMaterial({ map: sunGlowTex, color: 0xff66cc, transparent: true, opacity: 0.7, depthWrite: false }));
  sunGlow.scale.set(300, 300, 1);
  sunGroup.add(sunGlow);
  const sunCore = new THREE.Sprite(new THREE.SpriteMaterial({ map: sunCoreTex, color: 0xffffff, transparent: true, opacity: 0.9, depthWrite: false }));
  sunCore.scale.set(160, 160, 1);
  sunGroup.add(sunCore);

  // Horizon glow
  const horizonGlowGeo = new THREE.PlaneGeometry(900, 70);
  const horizonGlowMat = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    uniforms: { c1: { value: new THREE.Color(0xfff2bc) }, c2: { value: new THREE.Color(0xff72d5) } },
    vertexShader: `varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);} `,
    fragmentShader: `varying vec2 vUv; uniform vec3 c1; uniform vec3 c2; void main(){ float alpha=smoothstep(0.0,0.4,vUv.y)*(1.0-smoothstep(0.6,1.0,vUv.y)); float side=1.0-smoothstep(0.0,0.5,abs(vUv.x-0.5)*2.0); vec3 col=mix(c2,c1,1.0-abs(vUv.x-0.5)*2.0); gl_FragColor=vec4(col, alpha*side*0.45); }`,
  });
  const horizonGlow = new THREE.Mesh(horizonGlowGeo, horizonGlowMat);
  horizonGlow.position.set(0, 8, -745);
  group.add(horizonGlow);
  registerFadeMaterial(horizonGlowMat);

  // Animate terrain flow
  let travel = 0;
  group.userData.update = (now, dt) => {
    travel = (travel + dt * 55.0) % terrainUniforms.uRepeatZ.value;
    terrainUniforms.uTime.value = now * 0.001;
    terrainUniforms.uOffsetZ.value = travel;
    const pulse = 1 + Math.sin(now * 0.0015) * 0.03;
    sunGroup.scale.set(pulse, pulse, 1);
  };

  // Rotate so player faces sun
  group.rotation.y = 0;
}

function buildDesertNightScene(group) {
  const floorHeight = (floorMaterial && floorMaterial.userData && floorMaterial.userData.floorHeight) || -0.01;
  const floorY = floorHeight;
  const sceneColor = 0x06080c;
  // Ground
  const geometry = new THREE.PlaneGeometry(140, 140, 70, 70);
  geometry.rotateX(-Math.PI / 2);
  const positions = geometry.attributes.position;
  const colors = [];
  const flatRadius = 12.0;
  const mountainStart = 18.0;
  for (let i = 0; i < positions.count; i++) {
    const x = positions.getX(i);
    const z = positions.getZ(i);
    const dist = Math.sqrt(x * x + z * z);
    let heightFactor = Math.min(Math.max((dist - flatRadius) / (mountainStart - flatRadius), 0), 1);
    heightFactor = heightFactor * heightFactor * (3 - 2 * heightFactor);
    let height = 0;
    height += Math.sin(x * 0.08 + 0.5) * Math.cos(z * 0.06) * 4.0;
    height += Math.sin(x * 0.04 + 2) * Math.sin(z * 0.05 + 1) * 3.0;
    height += Math.sin(x * 0.15 + z * 0.1) * 1.5;
    height += Math.cos(z * 0.12 - x * 0.08) * 1.0;
    height += Math.sin(x * 0.3) * Math.cos(z * 0.25) * 0.5;
    if (dist > mountainStart) {
      height += Math.sin(x * 0.4 + z * 0.3) * 2.0;
      height += Math.cos(x * 0.2 - z * 0.5) * 2.5;
    }
    const finalHeight = height * heightFactor;
    positions.setY(i, finalHeight);
    const heightNorm = (finalHeight + 5) / 15;
    const baseColor = new THREE.Color(0x2a241b);
    const highlightColor = new THREE.Color(0x585144);
    const moonTint = new THREE.Color(0x404a5a);
    let color = baseColor.clone().lerp(highlightColor, Math.max(0, Math.min(1, heightNorm)));
    color.lerp(moonTint, heightNorm * 0.2);
    colors.push(color.r, color.g, color.b);
  }
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geometry.computeVertexNormals();
  const material = new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true });
  const terrain = new THREE.Mesh(geometry, material);
  terrain.position.y = floorY;
  terrain.frustumCulled = false;
  group.add(terrain);
  registerFadeMaterial(material);

  // Moon
  const moonGroup = new THREE.Group();
  const moonGeometry = new THREE.IcosahedronGeometry(8, 2);
  const moonMaterial = new THREE.MeshBasicMaterial({ color: 0xfffef8 });
  const moon = new THREE.Mesh(moonGeometry, moonMaterial);
  moonGroup.add(moon);
  const innerGlow = new THREE.Mesh(new THREE.IcosahedronGeometry(9.5, 2), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.25 }));
  const outerGlow = new THREE.Mesh(new THREE.IcosahedronGeometry(13, 2), new THREE.MeshBasicMaterial({ color: 0xd4e5f7, transparent: true, opacity: 0.12 }));
  const farGlow = new THREE.Mesh(new THREE.IcosahedronGeometry(18, 2), new THREE.MeshBasicMaterial({ color: 0xaaccff, transparent: true, opacity: 0.06 }));
  moonGroup.add(innerGlow, outerGlow, farGlow);
  moonGroup.position.set(-45, 35, -60);
  group.add(moonGroup);

  group.rotation.y = 0; // face toward moon
}

function buildAlienPlanetScene(group) {
  const floorHeight = (floorMaterial && floorMaterial.userData && floorMaterial.userData.floorHeight) || -0.01;
  const floorY = floorHeight;
  // Ground
  const groundGeo = new THREE.PlaneGeometry(300, 300, 20, 20);
  const groundPositions = groundGeo.attributes.position;
  for (let i = 0; i < groundPositions.count; i++) {
    const x = groundPositions.getX(i);
    const y = groundPositions.getY(i);
    groundPositions.setZ(i, Math.sin(x * 0.05) * Math.cos(y * 0.05) * 0.5);
  }
  groundGeo.computeVertexNormals();
  const groundMat = new THREE.MeshStandardMaterial({ color: 0x0a0510, roughness: 1, metalness: 0, flatShading: true });
  const ground = new THREE.Mesh(groundGeo, groundMat);
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = floorY;
  ground.frustumCulled = false;
  group.add(ground);

  // Moon and glow
  const moonGeo = new THREE.IcosahedronGeometry(24, 1);
  const moonMat = new THREE.MeshBasicMaterial({ color: 0xddaaff, transparent: true, opacity: 0.95 });
  const moon = new THREE.Mesh(moonGeo, moonMat);
  moon.position.set(60, 80, -40);
  group.add(moon);
  const moonGlowGeo = new THREE.IcosahedronGeometry(36, 1);
  const moonGlowMat = new THREE.MeshBasicMaterial({ color: 0xaa66ff, transparent: true, opacity: 0.15, side: THREE.BackSide });
  const moonGlow = new THREE.Mesh(moonGlowGeo, moonGlowMat);
  moonGlow.position.copy(moon.position);
  group.add(moonGlow);

  // River
  const riverPoints = [];
  for (let i = 0; i < 60; i++) {
    const t = i / 59;
    const x = Math.sin(t * Math.PI * 2.5) * 12 + Math.sin(t * Math.PI * 5) * 4;
    const z = t * 120 - 60;
    riverPoints.push(new THREE.Vector3(x, 0.1, z));
  }
  const riverCurve = new THREE.CatmullRomCurve3(riverPoints);
  const riverGeo = new THREE.TubeGeometry(riverCurve, 120, 2, 6, false);
  const riverMat = new THREE.MeshBasicMaterial({ color: 0x00ff66, transparent: true, opacity: 0.85 });
  const river = new THREE.Mesh(riverGeo, riverMat);
  group.add(river);
  const glowGeo = new THREE.TubeGeometry(riverCurve, 120, 5, 6, false);
  const riverGlowMat = new THREE.MeshBasicMaterial({ color: 0x00ff44, transparent: true, opacity: 0.08, side: THREE.BackSide });
  const riverGlow = new THREE.Mesh(glowGeo, riverGlowMat);
  group.add(riverGlow);

  // Instanced city
  const cityShaderMat = new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uMoonDir: { value: new THREE.Vector3(60, 80, -40).normalize() },
      uMoonColor: { value: new THREE.Color(0xcc88ff) },
      uBaseColor: { value: new THREE.Color(0x0a0a15) }
    },
    vertexShader: `varying vec2 vUv; varying vec3 vNormal; varying vec3 vWorldPos; void main(){ vUv=uv; vNormal=normalize(normalMatrix*normal); vec4 worldPos=modelMatrix*instanceMatrix*vec4(position,1.0); vWorldPos=worldPos.xyz; gl_Position=projectionMatrix*viewMatrix*worldPos; }`,
    fragmentShader: `uniform float uTime; uniform vec3 uMoonDir; uniform vec3 uMoonColor; uniform vec3 uBaseColor; varying vec2 vUv; varying vec3 vNormal; float rand(vec2 co){ return fract(sin(dot(co, vec2(12.9898,78.233)))*43758.5453);} void main(){ float moonLight=max(dot(vNormal,uMoonDir),0.0); vec3 finalColor=uBaseColor*(0.2+moonLight*0.8)*uMoonColor; vec2 uv=vUv; float numWindowsX=6.0; float numWindowsY=15.0; vec2 grid=floor(vec2(uv.x*numWindowsX, uv.y*numWindowsY)); vec2 gridUv=fract(vec2(uv.x*numWindowsX, uv.y*numWindowsY)); float windowMask=step(0.15,gridUv.x)*step(gridUv.x,0.85)*step(0.1,gridUv.y)*step(gridUv.y,0.9); float r=rand(grid); float isLit=step(0.5,r); if(windowMask>0.5 && isLit>0.5){ vec3 windowColor=mix(vec3(0.0,1.0,0.5), vec3(0.5,0.0,1.0), rand(grid*0.5)); float flicker=0.9+0.1*sin(uTime*2.0+rand(grid)*10.0); finalColor=windowColor*flicker*1.5; } gl_FragColor=vec4(finalColor,1.0); }`
  });
  const boxGeo = new THREE.BoxGeometry(1, 1, 1);
  const cylinderGeo = new THREE.CylinderGeometry(0.5, 0.5, 1, 6);
  const coneGeo = new THREE.ConeGeometry(0.5, 1, 4);
  const dummy = new THREE.Object3D();

  const generateCityLayer = (geometry, count, minDist, maxDist, minHeight, maxHeight) => {
    const mesh = new THREE.InstancedMesh(geometry, cityShaderMat, count);
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const dist = minDist + Math.random() * (maxDist - minDist);
      const height = minHeight + Math.random() * (maxHeight - minHeight);
      const width = 0.5 + Math.random() * 1.5;
      dummy.position.set(Math.cos(angle) * dist, height / 2, Math.sin(angle) * dist);
      dummy.scale.set(width, height, width);
      dummy.rotation.y = Math.random() * Math.PI;
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
    }
    return mesh;
  };
  group.add(generateCityLayer(boxGeo, 100, 55, 85, 30, 60));
  group.add(generateCityLayer(cylinderGeo, 80, 65, 95, 40, 80));
  group.add(generateCityLayer(coneGeo, 60, 70, 100, 50, 100));
  const megaGeo = new THREE.CylinderGeometry(1, 1.5, 1, 5);
  const megaMesh = new THREE.InstancedMesh(megaGeo, cityShaderMat, 10);
  for (let i = 0; i < 10; i++) {
    const angle = (i / 10) * Math.PI * 2;
    const dist = 60 + Math.random() * 10;
    const h = 110 + Math.random() * 20;
    dummy.position.set(Math.cos(angle) * dist, h / 2, Math.sin(angle) * dist);
    dummy.scale.set(5, h, 5);
    dummy.updateMatrix();
    megaMesh.setMatrixAt(i, dummy.matrix);
  }
  group.add(megaMesh);

  group.userData.update = (now, dt) => {
    cityShaderMat.uniforms.uTime.value = now * 0.001;
  };

  group.rotation.y = 0.2; // aim player slightly toward river flow
}

function buildHellscapeLavaScene(group) {
  const floorHeight = (floorMaterial && floorMaterial.userData && floorMaterial.userData.floorHeight) || -0.01;
  const floorY = floorHeight;
  const valleyWidth = 35.0;
  const geometry = new THREE.PlaneGeometry(300, 300, 200, 200);
  geometry.rotateX(-Math.PI / 2);
  const positions = geometry.attributes.position;
  for (let i = 0; i < positions.count; i++) {
    const x = positions.getX(i);
    const z = positions.getZ(i);
    const riverX = Math.sin(z * 0.03) * 15.0;
    const distToRiver = Math.abs(x - riverX);
    const riverWidth = 5.0;
    const distFromCenter = Math.abs(x);
    let height = 0;
    const valleyFloorHeight = 2.0;
    if (distFromCenter > valleyWidth) {
      const mountainFactor = (distFromCenter - valleyWidth) / 15.0;
      let mHeight = 0;
      mHeight += Math.abs(Math.sin(x * 0.05) * Math.cos(z * 0.04)) * 15.0;
      mHeight += Math.abs(Math.sin(z * 0.08 + 1.0)) * 10.0;
      mHeight += Math.abs(Math.cos(x * 0.12 - z * 0.08)) * 6.0;
      mHeight += (Math.random() * 3.0);
      height = valleyFloorHeight + mHeight * Math.min(mountainFactor, 1.0);
    } else {
      height = valleyFloorHeight;
      height += (Math.sin(x * 0.5) * Math.cos(z * 0.5)) * 0.3;
      if (distToRiver < riverWidth) {
        height = -1.0;
      } else if (distToRiver < riverWidth + 3.0) {
        height = Math.min(height, valleyFloorHeight - (riverWidth + 3.0 - distToRiver) * 0.5);
      }
    }
    positions.setY(i, height);
  }
  geometry.computeVertexNormals();

  const material = new THREE.MeshStandardMaterial({
    color: 0x110505,
    roughness: 0.9,
    metalness: 0.1,
    flatShading: true,
    onBeforeCompile: (shader) => {
      shader.uniforms.uTime = { value: 0 };
      shader.vertexShader = shader.vertexShader.replace('#include <common>', `#include <common>\nvarying vec3 vPosition; varying float vElevation; uniform float uTime;`);
      shader.vertexShader = shader.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>\nvPosition = position; vElevation = position.y;`);
      shader.fragmentShader = shader.fragmentShader.replace('#include <common>', `#include <common>\nvarying vec3 vPosition; varying float vElevation; uniform float uTime;`);
      shader.fragmentShader = shader.fragmentShader.replace('#include <emissive_fragment>', `float lavaThreshold = 0.5; if (vElevation < lavaThreshold) { } else { float distToLava = vElevation - lavaThreshold; float glowReflection = smoothstep(5.0, 0.0, distToLava); float pulse = sin(uTime * 0.8 + vPosition.x * 0.5 + vPosition.z * 0.5) * 0.5 + 0.5; totalEmissiveRadiance = vec3(0.6, 0.1, 0.0) * glowReflection * pulse; } #include <emissive_fragment>`);
      shader.fragmentShader = shader.fragmentShader.replace('#include <output_fragment>', `float lavaThreshold = 0.5; if (vElevation < lavaThreshold) { vec3 lavaColorBase = vec3(1.0, 0.3, 0.0); vec3 lavaColorBright = vec3(1.0, 0.8, 0.2); float pulse = sin(uTime * 0.8 + vPosition.x * 0.5 + vPosition.z * 0.5) * 0.5 + 0.5; float glow = 0.6 + 0.4 * pulse; vec3 finalLavaColor = mix(lavaColorBase, lavaColorBright, glow); gl_FragColor = vec4(finalLavaColor, 1.0); } else { gl_FragColor = vec4( outgoingLight, diffuseColor.a ); }`);
      material.userData.shader = shader;
    }
  });

  const terrain = new THREE.Mesh(geometry, material);
  terrain.receiveShadow = true;
  terrain.position.y = floorY;
  group.add(terrain);

  // Moons
  const createMoon = (size, color, glowColor) => {
    const mGroup = new THREE.Group();
    const moonGeo = new THREE.IcosahedronGeometry(size, 2);
    const moonMat = new THREE.MeshBasicMaterial({ color });
    mGroup.add(new THREE.Mesh(moonGeo, moonMat));
    const glowGeo = new THREE.IcosahedronGeometry(size * 1.2, 2);
    const glowMat = new THREE.MeshBasicMaterial({ color: glowColor, transparent: true, opacity: 0.3 });
    mGroup.add(new THREE.Mesh(glowGeo, glowMat));
    const farGlowGeo = new THREE.IcosahedronGeometry(size * 1.5, 2);
    const farGlowMat = new THREE.MeshBasicMaterial({ color: glowColor, transparent: true, opacity: 0.1 });
    mGroup.add(new THREE.Mesh(farGlowGeo, farGlowMat));
    return mGroup;
  };
  const moon1 = createMoon(10.5, 0xaa1111, 0xff2200);
  moon1.position.set(20, 25, -100);
  group.add(moon1);
  const moon2 = createMoon(7.5, 0x880000, 0xaa0000);
  moon2.position.set(-40, 20, -90);
  group.add(moon2);
  const moon3 = createMoon(5.4, 0x550000, 0x770000);
  moon3.position.set(-20, 35, -95);
  group.add(moon3);

  group.userData.update = (now, dt) => {
    if (material.userData.shader) material.userData.shader.uniforms.uTime.value = now * 0.001;
  };

  group.rotation.y = 0; // face moons
}
