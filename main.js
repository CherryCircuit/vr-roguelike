// ============================================================
//  SPACEOMICIDE — Main Game Controller
//  Phase 1: Core game loop with levels, enemies, upgrades, HUD
// ============================================================

// ============================================================
// MODULE IMPORTS
// Dependencies: game.js, weapons.js, audio.js, enemies.js,
//   stasis.js, vfx.js, biome-scenes.js, boss-death-cinematic.js,
//   hud.js, desktop-controls.js, scoreboard.js, scenery.js,
//   spatial-hash.js
// ============================================================

import * as THREE from 'three';
import { VRButton } from 'three/addons/webxr/VRButton.js';
import { AnaglyphEffect } from 'three/addons/effects/AnaglyphEffect.js';
import { StereoEffect } from 'three/addons/effects/StereoEffect.js';
import * as BufferGeometryUtils from 'three/addons/utils/BufferGeometryUtils.js';
import { State, game, resetGame, getLevelConfig, getBossTier, getRandomBossIdForLevel, addScore, registerAccuracyHit, registerAccuracyMiss, damagePlayer, addUpgrade, setMainWeapon, setAltWeapon, getNextUpgradeHand, needsMainWeaponChoice, LEVELS, loadDebugSettings, saveDebugSettings, startGameWithSeed, getBiomeForLevel, trackKill, trackShot, trackShotHit, trackCrit, registerResetHook } from './game.js';
import { getRandomUpgrades, getRandomSpecialUpgrades, getUpgradeDef, getWeaponStats, MAIN_WEAPONS, ALT_WEAPONS, getMainWeapon, getAltWeapon } from './weapons.js';
import {
  playShoothSound, playHitSound, playExplosionSound, playDamageSound,
  playFastEnemySpawn, playSwarmEnemySpawn, playBasicEnemySpawn, playTankEnemySpawn, playMortarEnemySpawn,
  playBossSpawn, playBossAlertSound, playMenuClick, playErrorSound, playBuckshotSound,
  playProximityAlert, playSwarmProximityAlert, playUpgradeSound,
  playSlowMoSound, playSlowMoReverseSound, playComboSound,
  startLightningSound, stopLightningSound, pauseLightningSound,
  startLowHealthWarningSound, stopLowHealthWarningSound,
  playMusic, playBossMusic, stopMusic, fadeOutMusic,
  playKillsAlertSound, playTingSound, playSeekerBurstSound, playHealSound, playLevelCompleteSound,
  playCountdown321,
  // Charge cannon sounds
  startChargeSound, updateChargeSound, stopChargeSound,
  playChargeReadySound, playChargeFireSound,
  // Boss and name entry sounds
  playIncomingBossSound, playNoOneMakesItSound,
  playProjectileWarningSound,
  playBuffedHitSound,
  playPhaseWraithCharge as playMortarCharge,
  playBossProjectileDestroySound,
  // Skull boss sounds
  playSkullDeathKnell, playSkullLaughSound,
  // Final boss sounds
  playFinalBossAwakenSound, playFinalBossCollapseGroan, playFinalBossVictorySting,
} from './audio.js';
import {
  initEnemies, spawnEnemy, updateEnemies, updateExplosions, getEnemyMeshes,
  getEnemyByMesh, clearAllEnemies, getEnemyCount, hitEnemy, destroyEnemy,
  applyEffects, getSpawnPosition, getEnemies, getFastEnemies, getSwarmEnemies,
  updatePhaseEchoes,
  getBoss, spawnBoss, getBossNameForLevel, hitBoss, updateBoss, clearBoss, hitBossMinion, updateBossMinions,
  getBossMinions,
  updateBossProjectiles, getBossProjectiles, updateStatusBubbles, setPlayerForward, setBossSpawnForward,
  updateBossDebris, clearBossDebris, spawnBossDebris, setVFXReference, clearBossProjectiles, clearAllElectricArcs,
  releaseBossProjIndex, clearBossMinions,
  clearAllTelegraphs, spawnHealthGainPopup,
  clearGeometryCaches, setCameraRef
} from './enemies.js';
import { setActiveStasisFields, getStasisSlowFactor } from './stasis.js';
import { initVFX, updateVFX } from './vfx.js';
import { rebuildBiomeScene as rebuildBiomeSceneModule, getBiomeFloorY as getBiomeFloorYModule } from './biome-scenes.js';
import {
  initBossDeathCinematic, initBossDeathOverlays, startBossDeathCinematic,
  updateBossDeathCinematic, updateBossDeathFreeze, shouldFreezeTime,
  isBossDeathCinematicActive, isBossDeathOverlayActive, dismissBossDeathOverlay,
  BOSS_DEATH_FREEZE
} from './boss-death-cinematic.js';
import {
  initHUD, showTitle, hideTitle, updateTitle, showHUD, hideHUD, updateHUD,
  showLevelComplete, hideLevelComplete, showUpgradeCards, hideUpgradeCards,
  updateUpgradeCards, getUpgradeCardHit, getHoveredUpgradeCardHit, getHoveredAction, showGameOver, showVictory, updateEndScreen,
  hideGameOver, triggerHitFlash, updateHitFlash, setLowHealthScreenPulse, updateSpeedLines, spawnDamageNumber, spawnCritIndicator, updateDamageNumbers, updateFPS,
  showBossHealthBar, hideBossHealthBar, updateBossHealthBar, flashBossHealthBarGreen,
  getTitleButtonHit, showNameEntry, hideNameEntry, getNameEntryHit, updateKeyboardHover, getNameEntryName,
  desktopTypeChar, processKeyPress,
  showScoreboard, hideScoreboard, getScoreboardHit, updateScoreboardScroll,
  showCountrySelect, hideCountrySelect, getCountrySelectHit,
  showDebugJumpScreen, getDebugJumpHit,
  showReadyScreen, hideReadyScreen, updateReadyCountdownText, updateTitleDebugIndicator,
  showPauseMenu, hidePauseMenu, updatePauseMenu, showPauseCountdown, hidePauseCountdown, updatePauseCountdownDisplay, getPauseMenuHit,
  showSettings, hideSettings, isSettingsVisible, getSettingsHit, executeSettingsAction, getPreviousMenu,
  updateHUDHover,
  showKillsRemainingAlert, updateKillsAlert, hideKillsAlert, showBossAlert, hideBossAlert,
  spawnKillChainPopup, triggerHeartHitAnimation, triggerHealthGainAnimation, triggerAccuracyHurt, updateKillChainPopups,
  resetHoloGlitch,
  showFloatingMessage, hideFloatingMessage, updateFloatingMessage,
  clearAllDamageNumbers, clearAllComboPopups, clearAllKillChainPopups, clearFloatingMessage,
  nameEntryGroup,
  setLastSubmittedTimestamp,
  setLastSubmittedPageIndex,
  setFPSVisible,
  clearHudGeoCache,
  novemberFontFamily,
} from './hud.js';

import {
  initDesktopControls, update as updateDesktopControls, getWeaponState,
  getPosition, getAimRaycaster, getVirtualController,
  isLocked, isEnabled as isDesktopEnabled, setOnPauseCallback, setOnNukeCallback,
  setMenuStateCallback, setNameKeyCallback
} from './desktop-controls.js';
import {
  submitScore, fetchTopScores, fetchScoresByCountry, fetchScoresByContinent,
  isNameClean, COUNTRIES, CONTINENTS,
  getStoredCountry, setStoredCountry, getStoredName, setStoredName
} from './scoreboard.js';
import { getThemeForLevel, updateAmbientParticles, removeAmbientParticles } from './scenery.js';
import { SpatialHash } from './spatial-hash.js';
import { enableTelemetry, disableTelemetry, isTelemetryEnabled, setTelemetryHistoryMs, recordTelemetrySample, getTelemetrySnapshot } from './telemetry.js';
import { getRuntimeConfig, isDevRuntime, registerRuntimeAction, consumeDebugJump, getSeedSelection } from './runtime-config.js';
import {
  initVoxelDebris, spawnVoxelExplosion, updateVoxelPhysics,
  voxelPool, activeVoxels
} from './voxel-debris.js';

const runtimeConfig = getRuntimeConfig();
const devRuntimeEnabled = isDevRuntime();

// Dev launcher can opt into globals for browser-console workflows without
// exposing that surface in the live player runtime.
if (devRuntimeEnabled && runtimeConfig.dev.exposeGlobals && typeof window !== 'undefined') {
  window.State = State;
  window.game = game;
  window.hud = { setFPSVisible };
  window.DEBUG_PROJECTILES = false;
}

// [DEBUG] Debug flag to disable console.log in hot paths on Quest
const DEBUG = false;

// [DEBUG] Conditional logging helpers. When DEBUG=false, V8 inlines to zero cost.
const _log = DEBUG ? console.log.bind(console) : () => {};
const _warn = DEBUG ? console.warn.bind(console) : () => {};

// ============================================================
// MUZZLE FLASH EFFECT
// Billboard sprite shown briefly on weapon fire.
// Toggle with ENABLE_MUZZLE_FLASH.
// ============================================================
const ENABLE_MUZZLE_FLASH = true;

let _muzzleFlashSprite = null;
let _muzzleFlashTimer = 0;
const MUZZLE_FLASH_DURATION = 50; // ms

// [CORE] Muzzle flash sprite creation
function createMuzzleFlashSprite() {
  const size = 64;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');

  // Draw a bright hexagonal flash
  const cx = size / 2, cy = size / 2, r = size * 0.4;
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  for (let i = 0; i < 6; i++) {
    const a = (Math.PI / 3) * i - Math.PI / 2;
    const x = cx + r * Math.cos(a);
    const y = cy + r * Math.sin(a);
    i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
  }
  ctx.closePath();
  ctx.fill();

  // Inner glow
  const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
  grad.addColorStop(0, 'rgba(255,255,220,1)');
  grad.addColorStop(0.5, 'rgba(255,255,150,0.8)');
  grad.addColorStop(1, 'rgba(255,200,50,0)');
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fill();

  const texture = new THREE.CanvasTexture(canvas);
  const mat = new THREE.SpriteMaterial({
    map: texture,
    blending: THREE.AdditiveBlending,
    transparent: true,
    depthWrite: false,
    fog: false,
  });
  const sprite = new THREE.Sprite(mat);
  sprite.scale.set(0.08, 0.08, 1);
  sprite.visible = false;
  scene.add(sprite);
  return sprite;
}

// [CORE] Show muzzle flash at weapon position
function showMuzzleFlash(position, direction) {
  if (!_muzzleFlashSprite) _muzzleFlashSprite = createMuzzleFlashSprite();
  _muzzleFlashSprite.position.copy(position);
  // Offset slightly forward along barrel direction
  _muzzleFlashSprite.position.addScaledVector(direction, 0.05);
  _muzzleFlashSprite.visible = true;
  _muzzleFlashTimer = performance.now();
}

// [CORE] Update muzzle flash visibility timer
function updateMuzzleFlash() {
  if (!_muzzleFlashSprite || !_muzzleFlashSprite.visible) return;
  if (performance.now() - _muzzleFlashTimer > MUZZLE_FLASH_DURATION) {
    _muzzleFlashSprite.visible = false;
  }
}

// ============================================================
// CONSTANTS & CONFIGURATION
// Color palette, timing, physics constants
// ============================================================

// ── Constants ──────────────────────────────────────────────
const NEON_PINK = 0xff00ff;
const NEON_CYAN = 0x00ffff;

// VR camera height fix: Shift entire scene down so XR camera at ~0.875m appears 1.6m above floor
const SCENE_Y_OFFSET = -0.725;

const LASER_RANGE = 50;
const LASER_DURATION = 250;

// ============================================================
// FRAME PROFILER
// Lightweight profiler that tracks which systems are running each frame
// ============================================================
const profiler = {
  enabled: false,
  marks: {},
  currentFrame: {},
  stats: { slowFrames: 0, worstFrame: 0, worstLabel: '', systemTotals: {} },
  frameStart() { if (!this.enabled) return; this.currentFrame = {}; this._frameT0 = performance.now(); },
  mark(label) { if (!this.enabled) return; this.currentFrame[label] = { start: performance.now() }; },
  end(label) {
    if (!this.enabled || !this.currentFrame[label]) return;
    const ms = performance.now() - this.currentFrame[label].start;
    this.currentFrame[label].ms = ms;
    this.stats.systemTotals[label] = (this.stats.systemTotals[label] || 0) + ms;
  },
  frameEnd() {
    if (!this.enabled) return;
    const total = performance.now() - this._frameT0;
    if (total > 20) { // >20ms = below 50fps
      this.stats.slowFrames++;
      if (total > this.stats.worstFrame) {
        this.stats.worstFrame = total;
        // Find the slowest system
        let worstLabel = '';
        let worstTime = 0;
        for (const [label, data] of Object.entries(this.currentFrame)) {
          if (data.ms > worstTime) {
            worstTime = data.ms;
            worstLabel = label;
          }
        }
        this.stats.worstLabel = worstLabel;
      }
      const parts = Object.entries(this.currentFrame)
        .filter(([k,v]) => v.ms > 1)
        .sort((a,b) => b[1].ms - a[1].ms)
        .map(([k,v]) => `${k}(${v.ms.toFixed(1)}ms)`)
        .join(', ');
      console.log(`[PERF] Slow frame: ${total.toFixed(1)}ms — ${parts || 'unknown'}`);
    }
  },
  getStats() {
    return {
      enabled: this.enabled,
      slowFrames: this.stats.slowFrames,
      worstFrame: this.stats.worstFrame.toFixed(1) + 'ms',
      worstLabel: this.stats.worstLabel,
      systemTotals: Object.fromEntries(
        Object.entries(this.stats.systemTotals).map(([k, v]) => [k, v.toFixed(1) + 'ms'])
      )
    };
  },
  reset() {
    this.stats = { slowFrames: 0, worstFrame: 0, worstLabel: '', systemTotals: {} };
  }
};

// Export profiler for use in other modules
if (typeof window !== 'undefined') {
  window.frameProfiler = profiler;
}

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

// ============================================================
// DISPOSE HELPER
// Recursively disposes geometry + material and removes from parent.
// Use for any Three.js mesh/group that is no longer needed.
// For objects with textures (biome scenes), prefer disposeObject3D().
// ============================================================
// [CORE] Dispose mesh and remove from parent
function disposeMesh(obj, removeFromParent = true) {
  if (!obj) return;
  // Dispose children recursively
  if (obj.children) {
    for (let i = obj.children.length - 1; i >= 0; i--) {
      disposeMesh(obj.children[i], false);
    }
  }
  // Dispose own geometry and material
  if (obj.geometry) obj.geometry.dispose();
  if (obj.material) {
    if (Array.isArray(obj.material)) {
      obj.material.forEach(m => m.dispose());
    } else {
      obj.material.dispose();
    }
  }
  // Remove from parent (scene or group)
  if (removeFromParent && obj.parent) {
    obj.parent.remove(obj);
  }
}

// ============================================================
// MATERIAL FACTORY
// Creates MeshBasicMaterial with sensible defaults.
// Reduces boilerplate for common transparent/glow materials.
// ============================================================
// [CORE] Create basic colored material
function basicMat(color, opts) {
  return new THREE.MeshBasicMaterial({
    color,
    transparent: opts.transparent ?? false,
    opacity: opts.opacity ?? 1,
    side: opts.side ?? THREE.FrontSide,
    depthTest: opts.depthTest ?? true,
    depthWrite: opts.depthWrite ?? true,
    blending: opts.blending ?? THREE.NormalBlending,
    fog: opts.fog ?? true,
    map: opts.map ?? null,
    ...opts
  });
}

// ============================================================
// MODULE STATE
// Scene, camera, renderer, controller state, pools, queues
// COUPLING: Many functions reference these globals directly
// ============================================================

// ── Module State ───────────────────────────────────────────
let scene, camera, renderer;
// Base lights removed — all biomes provide their own lighting
let currentBiomeLightingConfig = null;
// Camera added directly to scene (no rig - VR hands need direct camera)
// floorHUDDebugMarker removed - was debug white plane
const controllers = [];
const controllerTriggerPressed = [false, false];
// Fix for upgrade-screen softlock: UI selection can fall back to held-trigger
// polling when WebXR selectstart timing drifts against the menu cooldown.
const upgradeTriggerLatched = [false, false];

/**
 * Validate controller handedness after Quest sleep/wake.
 * If controllers swapped (e.g., right controller now shows as left),
 * re-map the controller references to match actual handedness.
 */
function validateControllerHandedness() {
  const session = renderer.xr ? renderer.xr.getSession() : null;
  if (!session) return;
  const inputSources = session.inputSources;
  if (inputSources.length < 2) return;
  const expectedLeft = inputSources[0]?.handedness === 'left';
  const expectedRight = inputSources[1]?.handedness === 'right';
  if (expectedLeft && !expectedRight) {
    _log('[controller] Controller swap detected - swapping controllers 0 and 1');
    const temp = controllers[0];
    controllers[0] = controllers[1];
    controllers[1] = temp;
    const tempTrigger = controllerTriggerPressed[0];
    controllerTriggerPressed[0] = controllerTriggerPressed[1];
    controllerTriggerPressed[1] = tempTrigger;
    const tempUpgradeLatch = upgradeTriggerLatched[0];
    upgradeTriggerLatched[0] = upgradeTriggerLatched[1];
    upgradeTriggerLatched[1] = tempUpgradeLatch;
  }
}

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
const STASIS_FIELD_POOL_SIZE = 3;
const PLASMA_ORB_POOL_SIZE = 4;
const stasisFieldVisualPool = [];
const plasmaOrbVisualPool = [];
let stasisFieldPoolInitialized = false;
let plasmaOrbPoolInitialized = false;

// Phase Dash afterimages
const activePhaseDashAfterimages = [];  // { mesh, position, expiresAt, damage, aoeRadius }

// Spatial hash for fast enemy proximity queries (rebuilds each frame)
const enemySpatialHash = new SpatialHash(15);  // 15 unit cells >= max query radius

// Laser mine passive tracking
let playerLastPosition = new THREE.Vector3();
let playerStillnessStartTime = null;
let laserMineSpawnCooldown = 0;

// PERFORMANCE: Hard cap on active projectiles to prevent accumulation
const MAX_PROJECTILES = 100;

// PERFORMANCE: InstancedMesh projectile system
// Instead of individual THREE.Group/Mesh objects per projectile (each a draw call),
// we use ONE InstancedMesh per projectile type. This collapses ~100 draw calls
// down to ~4, matching the three.js physics_ammo_instancing pattern.
// Increased from 120 to 150 to handle buckshot with +4 pellets upgrade (worst case: 21 pellets × 2 hands = 42)
const PROJECTILE_POOL_SIZE = 150;

// Stable single-material projectile visuals. Keep the instanced system and simple,
// visible projectile bodies. We can revisit a fancier blaster shader later.
const PROJECTILE_BOLT = {
  opacity: 0.7,
};

// [CORE] Create reusable projectile material
function createProjectileMaterial(colorHex) {
  const material = basicMat(colorHex, {
    transparent: true,
    opacity: PROJECTILE_BOLT.opacity,
    depthWrite: false,
  });
  material.userData.baseOpacity = PROJECTILE_BOLT.opacity;
  return material;
}

// Per-instance data arrays (parallel to InstancedMesh instance indices)
// FIXED: Use pool-specific data arrays to prevent corruption when multiple weapon types fire simultaneously
const projectileInstanceData = {
  laser: [],
  buckshot: [],
  seeker: [],
  plasma_carbine: []
};  // poolType -> [{ active, velocity, stats, controllerIndex, ... }]

// InstancedMesh references per pool type
const instancedProjectiles = {};  // poolType -> { mesh, glowMesh, haloMesh, maxCount, freeIndices: Set }

// Reusable temp objects (avoid GC pressure)
const _projMatrix = new THREE.Matrix4();
const _projPosition = new THREE.Vector3();
const _projQuaternion = new THREE.Quaternion();
const _projScale = new THREE.Vector3(1, 1, 1);
const _projColor = new THREE.Color();

// voxelPool and activeVoxels now imported from voxel-debris.js

// Debris glow plane pool (for boss projectile explosion bits)
let _debrisGlowPool = null;       // InstancedMesh for billboarded orange glow
let _debrisGlowActive = [];       // { voxelIndex, poolIndex } mappings
let _debrisGlowFree = [];         // Free instance indices
const DEBRIS_GLOW_POOL_SIZE = 20; // Enough for several simultaneous explosions
const _debrisGlowMatrix = new THREE.Matrix4();
const _debrisGlowQuat = new THREE.Quaternion();
const _debrisGlowScale = new THREE.Vector3();
const _debrisGlowBillboardMat = new THREE.Matrix4();
const _debrisGlowUpVec = new THREE.Vector3(0, 1, 0);
const _debrisGlowHideMat = new THREE.Matrix4().makeScale(0, 0, 0);

// Weapon firing cooldowns (per controller)
const weaponCooldowns = [0, 0];

// Big Boom: only one "exploding" shot per hand every 2.75s (ms)
const BIG_BOOM_COOLDOWN_MS = 2750;
const lastExplodingShotTime = [0, 0];

// Explosion visuals - pooled for Quest performance (pre-allocated geometry)
const EXPLOSION_POOL_SIZE = 8;
const explosionPool = [];
const explosionVisuals = []; // still used for rare non-pooled visuals (toxic pools, shields, boss VFX)
let _explosionGeo = null; // shared unit sphere, created once

// [CORE] Initialize explosion visual pool
function initExplosionPool(scene) {
  _explosionGeo = new THREE.SphereGeometry(1, 12, 12); // unit sphere, scaled per-use
  _explosionGeo.name = 'explosion-pool-geo';
  for (let i = 0; i < EXPLOSION_POOL_SIZE; i++) {
    const mat = basicMat(0xff8800, {
      transparent: true, opacity: 0.7, side: THREE.BackSide,
      depthWrite: false, blending: THREE.AdditiveBlending,
    });
    const mesh = new THREE.Mesh(_explosionGeo, mat);
    mesh.name = `explosion-pool-${i}`;
    mesh.visible = false;
    mesh.renderOrder = 900;
    scene.add(mesh);
    explosionPool.push({ mesh, active: false, createdAt: 0, duration: 0, radius: 0 });
  }
}

// Lightning beam state (per controller)
const lightningBeams = [null, null];
const lightningTimers = [0, 0];
const LIGHTNING_BOLT_SEGMENTS = 8;
const MAX_LIGHTNING_CHAINS = 6;

// Charge shot state (per controller): time when trigger was pressed (ms) or null
const chargeShotStartTime = [null, null];
const CHARGE_SHOT_MAX_TIME = 3.0;  // seconds to reach full charge
const CHARGE_SHOT_MIN_FIRE = 0.1;  // minimum charge time to fire
const CHARGE_SHOT_MIN_DAMAGE = 50;   // minimum damage at no charge
const CHARGE_SHOT_MAX_DAMAGE = 1000; // maximum damage at full charge
const chargeBeamVisuals = [null, null];

// Plasma carbine wind-up state (per controller): time when trigger was pressed (ms) or null
const plasmaCarbineSpinStart = [null, null];
const plasmaCarbineLastFireTime = [0, 0];

// Seeker burst fire queue: pending shots for burst-fire weapons
// Each entry: { origin, direction, controllerIndex, stats, shotId, fireTime }
const seekerBurstQueue = [];
const SEEKER_BURST_DELAY = 45; // 45ms between shots in burst ("pew-pew-pew") - reduced from 80ms for faster burst

// Charge shot visual effects (per controller)
const chargeGlowSpheres = [null, null];
const chargeParticleSystems = [null, null];

// Holographic blaster displays (per controller)
const blasterDisplays = [null, null];

// Environment refs for level-based scaling (sun, stars)
// Base sun/glow refs removed — no base environment exists
let starsRef = null;
let starsBiomeId = null;
let currentTheme = null;
let biomeSceneGroup = null;
let biomeSceneBiome = null;



let environmentFade = 0;
let environmentFadeState = null;
const DEFAULT_LEVEL_SPAWN_FORWARD = new THREE.Vector3(0, 0, -1);
const _levelSpawnForward = new THREE.Vector3(0, 0, -1);
let biomeClearedForBossCinematic = false;
const environmentFadeTargets = [];
let levelFadeReady = false;

// Floor damage flash
// Floor refs removed — no base floor exists, biomes provide their own terrain
let floorMaterial = null;
let floorRef = null;
let floorBaseColor = new THREE.Color(0x220044);
let floorFlashTimer = 0;
let floorFlashing = false;

// ============================================================
// POOLED OBJECTS (HOT PATH OPTIMIZATION)
// Pre-allocated Raycasters, Vector3, Quaternion to avoid GC
// COUPLING: Reused across render loop, projectile updates, UI hover
// ============================================================

// Pre-allocated raycasters (reused to avoid per-frame GC)
const _uiRaycaster = new THREE.Raycaster();
const _uiSelectOrigin = new THREE.Vector3();
const _uiSelectQuat = new THREE.Quaternion();
const _uiSelectDir = new THREE.Vector3();

// Pooled UI hover raycasters for controller/desktop hover detection
// Avoids creating new Raycaster/Vector3/Quaternion every frame in menu states
const _uiHoverRaycasters = [new THREE.Raycaster(), new THREE.Raycaster()];
const _uiHoverOrigins = [new THREE.Vector3(), new THREE.Vector3()];
const _uiHoverQuats = [new THREE.Quaternion(), new THREE.Quaternion()];
const _uiHoverDirs = [new THREE.Vector3(), new THREE.Vector3()];


// Low health warning
let lowHealthWarningActive = false;
let lowHealthPulseTimer = 0;

// Biome terrain materials for damage flash
let biomeTerrainMaterials = [];  // Array of { type: 'shader'|'overlay', material }

// Upgrade selection
let upgradeSelectionCooldown = 0;
let pendingUpgrades = [];
let pendingUpgradeHand = null;

// Game over cooldown
let gameOverCooldown = 0;

// Pause menu state
let pauseCountdown = 0;
let pauseCountdownActive = false;
let pauseCountdownStartTime = 0;
let pauseCountdownLastValue = 0;
const PAUSE_COUNTDOWN_DURATION = 3.0;

// Bullet-time slow-mo (restored from commit 5bb0b69)
let slowMoActive = false;
let slowMoDuration = 0;
let slowMoSoundPlayed = false;
let slowMoRampOut = false;       // Ramp timeScale back to 1 over 0.5s when nearby enemies cleared
let slowMoRampOutTimer = 0;
const SLOW_MO_TRIGGER_DIST = 2.0;
const SLOW_MO_RAMP_OUT_DURATION = 0.5;
let timeScale = 1.0;

// Slow-mo quality reduction state (Fix A: reduce GPU load during bullet-time)
let _slowMoQualityReduced = false;
let _slowMoOriginalBg = null;

/**
 * Reduce GPU load during bullet-time by lowering pixel ratio and clearing background.
 * Only applies when NOT in VR mode (VR has its own render pipeline).
 * @param {boolean} enabled - true to reduce quality, false to restore
 */
// [CORE] Slow-motion quality reduction for performance
function setSlowMoQuality(enabled) {
  // Skip entirely in VR mode
  if (renderer.xr.isPresenting) return;
  
  if (enabled && !_slowMoQualityReduced) {
    // Reduce quality: lower pixel ratio, remove background
    renderer.setPixelRatio(1.0);
    _slowMoOriginalBg = scene.background;
    scene.background = null;
    _slowMoQualityReduced = true;
  } else if (!enabled && _slowMoQualityReduced) {
    // Restore quality
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
    scene.background = _slowMoOriginalBg;
    _slowMoQualityReduced = false;
  }
}

// Kills remaining alert state
let killsAlertShownThisLevel = false;
let killsAlertTriggerKill = null;

// [CORE] Setup kills remaining alert for current level
function setupKillsAlert() {
  killsAlertShownThisLevel = false;
  const cfg = game._levelConfig;
  if (cfg && !cfg.isBoss) {
    const threshold = game.level >= 16 ? 20 : game.level >= 11 ? 15 : game.level >= 6 ? 10 : 5;
    killsAlertTriggerKill = cfg.killTarget - threshold;
    if (killsAlertTriggerKill <= 0) killsAlertTriggerKill = null;
  } else {
    killsAlertTriggerKill = null;
  }
}

// [CORE] Check kills remaining and show alert
function checkKillsAlert() {
  if (!killsAlertShownThisLevel && killsAlertTriggerKill && game.kills >= killsAlertTriggerKill) {
    const remaining = game._levelConfig ? game._levelConfig.killTarget - game.kills : 0;
    if (typeof showKillsRemainingAlert === 'function') showKillsRemainingAlert(remaining);
    if (typeof playKillsAlertSound === 'function') playKillsAlertSound(remaining);
    killsAlertShownThisLevel = true;
  }
}

// [CORE] Handle enemy killed event: score, effects, progression
function handleEnemyKilled(enemyIndex, opts = {}) {
  const { isCritical, overkill, skipChain = true, skipLevelComplete = false, killsWithoutHit } = opts;
  const destroyData = destroyEnemy(enemyIndex, isCritical, overkill);
  if (!destroyData) return null;

  const countsForLevelProgress = !destroyData.skipLevelProgress;
  if (countsForLevelProgress) {
    game.kills++;
    trackKill();
    if (killsWithoutHit) game.killsWithoutHit++;
  }
  addScore(destroyData.scoreValue);
  updateHUD(game);
  if (countsForLevelProgress) checkKillsAlert();

  // Kill chain system (direct projectile hits and DoT kills only)
  if (!skipChain) {
    const now = performance.now();
    // Check combo timeout
    if (now - game.lastKillTime > game.comboResetTime) {
      game.comboCount = 0;
      game.comboMultiplier = 1;
    }
    // Increment combo
    game.comboCount++;
    game.lastKillTime = now;
    // Calculate multiplier based on streak (for internal use)
    if (game.comboCount >= 5) {
      game.comboMultiplier = 5;
    } else if (game.comboCount >= 4) {
      game.comboMultiplier = 4;
    } else if (game.comboCount >= 3) {
      game.comboMultiplier = 3;
    } else if (game.comboCount >= 2) {
      game.comboMultiplier = 2;
    }

    // Second alert check after chain updates
    if (countsForLevelProgress) checkKillsAlert();
  }

  // Level complete check
  if (!skipLevelComplete && countsForLevelProgress) {
    const cfg = game._levelConfig;
    if (cfg && !cfg.isBoss && game.kills >= cfg.killTarget) {
      completeLevel();
    }
  }

  return destroyData;
}

// Accuracy bonus shot tracking
let accuracyShotId = 0;
const accuracyShots = new Map();

// [CORE] Accuracy tracking: start shot
function startAccuracyShot(pelletCount, hand) {
  const shotId = ++accuracyShotId;
  accuracyShots.set(shotId, { remaining: pelletCount, hit: false, hand });
  trackShot(hand);
  return shotId;
}

// Track previous accuracy multiplier for popup triggers
let prevAccuracyMultiplier = 1;

// [CORE] Accuracy tracking: mark hit
function markAccuracyHit(shotId, hand) {
  const shot = accuracyShots.get(shotId);
  if (!shot || shot.hit) return;
  shot.hit = true;
  trackShotHit(0, hand);

  // Store previous multiplier before hit
  const oldMultiplier = game.accuracyMultiplier || 1;
  registerAccuracyHit();
  const newMultiplier = game.accuracyMultiplier || 1;

  // Spawn accuracy popup if multiplier increased to a new integer threshold (2x, 3x, 4x, 5x)
  const oldThreshold = Math.floor(oldMultiplier);
  const newThreshold = Math.floor(newMultiplier);
  if (newThreshold > oldThreshold && newThreshold >= 2) {
    spawnKillChainPopup(newThreshold, camera.position);
    playComboSound(newThreshold);
    _log(`[accuracy] ${newThreshold}x accuracy bonus!`);
  }

  prevAccuracyMultiplier = newMultiplier;
}

// [CORE] Accuracy tracking: resolve shot and apply bonus
function resolveAccuracyPellet(shotId) {
  const shot = accuracyShots.get(shotId);
  if (!shot) return;
  shot.remaining -= 1;
  if (shot.remaining <= 0) {
    accuracyShots.delete(shotId);
    if (!shot.hit) {
      registerAccuracyMiss();
      // REMOVED: triggerAccuracyHurt() - red flash should only trigger on player damage, not missed shots
    }
  }
}

// Camera shake on damage
let cameraShake = 0;
let cameraShakeIntensity = 0;
const originalCameraPos = new THREE.Vector3();

// Nuke flash overlay
let nukeFlash = null;
let nukeFlashTimer = 0;
const NUKE_FLASH_DURATION = 600; // ms

// Fix 1.5: Pre-allocated scratch vector for getAdjustedCameraPosition()
const _adjustedCameraPosScratch = new THREE.Vector3();

// Fix 1.3: Cached scanlines element (set once at init, not every frame)
let _cachedScanlinesEl = null;

// Helper: Get camera position for UI positioning and enemy targeting
// Returns the WORLD position of the camera (including camera rig offset)
// In VR mode, the camera rig adds a height offset, so we need to get the world position
// to ensure enemies target the correct height.
// [CORE] Get camera position adjusted for VR/desktop
function getAdjustedCameraPosition() {
  camera.getWorldPosition(_adjustedCameraPosScratch);
  return _adjustedCameraPosScratch;
}

// Screen shake system
let screenShakeIntensity = 0;
let screenShakeTime = 0;

// Boss death cinematic state is now in boss-death-cinematic.js module

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
const reflectorDronePool = [];
let reflectorDronePoolInitialized = false;

function initReflectorDronePool() {
  if (reflectorDronePoolInitialized || !scene) return;

  for (let poolIndex = 0; poolIndex < MAX_REFLECTOR_DRONES; poolIndex++) {
    const droneGroup = new THREE.Group();
    droneGroup.visible = false;

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
    const hexMat = basicMat(0x00ffcc, {
      transparent: true,
      opacity: 0.9,
      side: THREE.DoubleSide,
    });
    const hexMesh = new THREE.Mesh(hexGeo, hexMat);
    hexMesh.rotation.x = Math.PI / 2;
    droneGroup.add(hexMesh);

    const coreGeo = new THREE.SphereGeometry(0.08, 8, 8);
    const coreMat = basicMat(0x00ffcc, {
      transparent: true,
      opacity: 0.8,
    });
    const core = new THREE.Mesh(coreGeo, coreMat);
    core.name = 'reflector-drone-core';
    droneGroup.add(core);

    const shieldGeo = new THREE.SphereGeometry(0.4, 16, 16);
    const shieldMat = basicMat(0x00ffcc, {
      transparent: true,
      opacity: 0.2,
      side: THREE.BackSide,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const shield = new THREE.Mesh(shieldGeo, shieldMat);
    shield.name = 'reflector-drone-shield';
    droneGroup.add(shield);

    const particles = [];
    for (let i = 0; i < 12; i++) {
      const particleGeo = new THREE.SphereGeometry(0.02, 4, 4);
      const particleMat = basicMat(0x00ffaa, {
        transparent: true,
        opacity: 0.7,
      });
      const particle = new THREE.Mesh(particleGeo, particleMat);
      particle.name = 'reflector-drone-particle';
      particle.userData.orbitAngle = (i / 12) * Math.PI * 2;
      particle.userData.orbitRadius = 0.25;
      droneGroup.add(particle);
      particles.push(particle);
    }

    scene.add(droneGroup);
    reflectorDronePool.push({
      mesh: droneGroup,
      hexMesh,
      hexMat,
      coreMat,
      shieldMat,
      particles,
      active: false,
    });
  }

  reflectorDronePoolInitialized = true;
}

function acquireReflectorDroneVisual() {
  initReflectorDronePool();
  for (let i = 0; i < reflectorDronePool.length; i++) {
    const entry = reflectorDronePool[i];
    if (entry.active) continue;
    entry.active = true;
    entry.mesh.visible = true;
    entry.mesh.scale.setScalar(1);
    entry.mesh.rotation.set(0, 0, 0);
    entry.hexMat.opacity = 0.9;
    entry.coreMat.opacity = 0.8;
    entry.shieldMat.opacity = 0.2;
    entry.hexMat.color.setHex(0x00ffcc);
    entry.coreMat.color.setHex(0x00ffcc);
    entry.shieldMat.color.setHex(0x00ffcc);
    for (let j = 0; j < entry.particles.length; j++) {
      entry.particles[j].visible = true;
      entry.particles[j].material.opacity = 0.7;
      entry.particles[j].scale.setScalar(1);
    }
    return entry;
  }
  return null;
}

function releaseReflectorDroneVisual(entry) {
  if (!entry) return;
  entry.active = false;
  entry.mesh.visible = false;
}

const attackDronePool = [];
let attackDronePoolInitialized = false;

// ============================================================
// BOOTSTRAP & INITIALISATION
// Entry point: init() called at module load
// Dependencies: All module state must be declared above
// ============================================================

// ── Bootstrap ──────────────────────────────────────────────

// [DEBUG] Visual tuning defaults for debug sliders in index.html.
const VISUAL_TUNING_DEFAULTS = {
  glowStrength: 1.0,
  smokeStrength: 1.0,
  fogIntensity: 0.58,
  shellStrength: 1.0,
  shellTint: '#99b8ff',
  shellSaturation: 1.0,
  shellScanlineSpeed: 1.0,
  shellNoiseAmount: 0.35,
  renderMode: 'normal',
  stereoEyeSeparation: 0.064,
};

// [DEBUG] References that let debug visual tuning affect synthwave valley elements.
const synthVisualRefs = {
  terrainUniforms: null,
  sunOuterGlowMat: null,
  sunGlowMat: null,
  sunCoreMat: null,
  mountainCylMat: null,
  // Desert biome refs (Prism Boss cinematic)
  desertSkyMat: null,
  desertMoonMat: null,
  desertMoonGlowMat: null,
  // Alien biome refs (Minotaur cinematic)
  alienSkyMat: null,
  alienCityShaderMat: null,
  alienGreenLight: null,
};

// [DEBUG] Player projectile materials that should respond to visual tuning sliders.
const playerProjectileMaterials = new Set();

// [DEBUG] Desktop-only post-processing helpers. XR uses renderer.render(scene, camera).
const desktopEffectRefs = {
  anaglyph: null,
  stereo: null,
};

// VR pause button edge tracking (gamepad/menu style buttons).
const vrPauseButtonPressed = new Map();
let lastVRPauseToggleTime = 0;
const VR_PAUSE_DEBOUNCE_MS = 350;

const BIOME_LIGHTING = {
  synthwave_valley: {
    ambient: { color: 0x110022, intensity: 0.15 },
    directional: { color: 0xff8844, intensity: 0.8, position: [50, 80, 30] },
    point: { color: 0xffeedd, intensity: 1.5, distance: 20 },
  },
  desert_night: {
    ambient: { color: 0x0a0a1a, intensity: 0.12 },
    directional: { color: 0xaaccff, intensity: 0.2, position: [-40, 60, -30] },
    point: { color: 0xddddff, intensity: 1.2, distance: 18 },
  },
  alien_planet: {
    ambient: { color: 0x0a1a0a, intensity: 0.1 },
    directional: { color: 0x44ffaa, intensity: 3.0, position: [-30, 50, 40] },
    point: { color: 0x88ff88, intensity: 1.0, distance: 16 },
  },
  hellscape_lava: {
    ambient: { color: 0x1a0505, intensity: 0.08 },
    directional: { color: 0xff2222, intensity: 0.7, position: [20, 40, -50] },
    point: { color: 0xff4444, intensity: 1.3, distance: 15 },
  },
};
// BIOME_LIGHTING removed — all biomes provide their own lighting
const AVAILABLE_BIOMES = ['synthwave_valley', 'desert_night', 'alien_planet', 'hellscape_lava'];

// applyBiomeLighting — stubbed, all biomes provide their own lighting
function applyBiomeLighting(biome) {
  // No base lights exist. Biome scenes handle their own lighting.
}

// [DEBUG] Progression automation helpers (test hooks for headless/Puppeteer)
const PROGRESSION_AUTO_STRATEGIES = ['first-card', 'last-card', 'random', 'skip'];
let progressionAutoStrategy = 'first-card';

function normalizeBiomeInput(rawBiome, { preserveUndefined = false } = {}) {
  if (rawBiome === undefined) {
    return preserveUndefined ? undefined : null;
  }
  if (rawBiome === null) return null;
  const normalized = String(rawBiome).trim().toLowerCase().replace(/[\s-]+/g, '_');
  if (!normalized || normalized === 'auto' || normalized === 'default' || normalized === 'none') {
    return null;
  }
  const match = AVAILABLE_BIOMES.find((name) => name === normalized);
  return match || null;
}

function clampLevelNumber(value) {
  const n = Math.round(Number(value));
  if (!Number.isFinite(n)) return 1;
  return Math.min(20, Math.max(1, n));
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function waitForCondition(check, options = {}) {
  const { timeout = 10000, interval = 50, label = 'condition' } = options;
  const start = performance.now();
  return new Promise((resolve, reject) => {
    function poll() {
      try {
        if (check()) {
          resolve(true);
          return;
        }
      } catch (err) {
        reject(err);
        return;
      }
      if (performance.now() - start >= timeout) {
        reject(new Error(`Timed out waiting for ${label}`));
        return;
      }
      setTimeout(poll, interval);
    }
    poll();
  });
}

function waitForStateMatch(targetState, options = {}) {
  return waitForCondition(() => game.state === targetState, {
    timeout: options.timeout || 10000,
    interval: options.interval || 50,
    label: options.label || `state ${targetState}`,
  });
}

function getPendingUpgradeSummaries() {
  if (game.state !== State.UPGRADE_SELECT) return [];
  if (!Array.isArray(pendingUpgrades)) return [];
  const entries = pendingUpgrades.map((upgrade, index) => ({
    id: upgrade?.id || null,
    name: upgrade?.name || null,
    type: upgrade?.type || null,
    hand: pendingUpgradeHand,
    index,
  })).filter((entry) => entry.id);
  entries.push({ id: 'SKIP', name: 'Skip', type: 'skip', hand: pendingUpgradeHand, index: 'skip' });
  return entries;
}

function trySelectUpgradeByIdForTests(upgradeId) {
  if (game.state !== State.UPGRADE_SELECT) {
    return { ok: false, reason: 'not_in_upgrade_select' };
  }
  if (upgradeSelectionCooldown > 0) {
    return { ok: false, reason: 'cooldown_active' };
  }
  let upgrade = null;
  if (upgradeId === 'SKIP') {
    upgrade = { id: 'SKIP', name: 'Skip', type: 'skip' };
  } else {
    upgrade = pendingUpgrades.find((item) => item?.id === upgradeId) || null;
  }
  if (!upgrade) {
    return { ok: false, reason: 'upgrade_not_available' };
  }
  const hand = pendingUpgradeHand || 'left';
  selectUpgradeAndAdvance(upgrade, hand);
  return {
    ok: true,
    selected: {
      id: upgrade.id,
      name: upgrade.name || upgrade.id,
      type: upgrade.type || null,
      hand,
    },
  };
}

function trySelectUpgradeByIndexForTests(index) {
  const idx = Number.isInteger(index) ? index : 0;
  const options = Array.isArray(pendingUpgrades) ? pendingUpgrades : [];
  const upgrade = options[idx];
  if (!upgrade) {
    return { ok: false, reason: 'index_out_of_range' };
  }
  return trySelectUpgradeByIdForTests(upgrade.id);
}
function normalizeUpgradeStrategy(strategy) {
  if (!strategy && strategy !== 0) return null;
  const value = String(strategy).trim().toLowerCase();
  if (value === 'first' || value === 'left') return 'first-card';
  if (value === 'last' || value === 'right') return 'last-card';
  if (value.startsWith('rand')) return 'random';
  if (value === 'skip') return 'skip';
  if (PROGRESSION_AUTO_STRATEGIES.includes(value)) return value;
  return null;
}

async function autoSelectUpgradeByStrategy(strategy) {
  const normalized = normalizeUpgradeStrategy(strategy) || progressionAutoStrategy;
  const options = getPendingUpgradeSummaries().filter((entry) => entry.index !== 'skip');
  let targetId = null;
  if (normalized === 'skip') {
    targetId = 'SKIP';
  } else if (normalized === 'last-card' && options.length > 0) {
    targetId = options[options.length - 1].id;
  } else if (normalized === 'random' && options.length > 0) {
    targetId = options[Math.floor(Math.random() * options.length)].id;
  } else if (options.length > 0) {
    targetId = options[0].id;
  } else {
    targetId = 'SKIP';
  }
  const result = trySelectUpgradeByIdForTests(targetId);
  return { ...result, strategy: normalized };
}

async function waitForUpgradeEntry(timeout = 15000) {
  const deadline = performance.now() + timeout;
  while (performance.now() < deadline) {
    const state = game.state;
    if (state === State.UPGRADE_SELECT) return 'upgrade';
    if (state === State.VICTORY || state === State.GAME_OVER) return state;
    await sleep(50);
  }
  throw new Error('Timed out waiting for upgrade selection');
}

async function settlePostUpgradeState() {
  if (game.state === State.READY_SCREEN) {
    beginGameplayFromReady();
    await waitForStateMatch(State.PLAYING, { timeout: 10000, label: 'ready_playing' });
  } else if (game.state === State.BOSS_ALERT) {
    game.stateTimer = 0;
    await waitForStateMatch(State.PLAYING, { timeout: 10000, label: 'boss_alert_playing' });
  }
  return game.state;
}

async function settlePendingUpgradeIfNeeded(strategy) {
  if (game.state === State.LEVEL_COMPLETE) {
    await waitForUpgradeEntry();
  }
  if (game.state === State.UPGRADE_SELECT) {
    await waitForCondition(() => upgradeSelectionCooldown <= 0, { timeout: 5000, label: 'upgrade_cooldown' });
    await autoSelectUpgradeByStrategy(strategy);
    await waitForCondition(() => game.state !== State.UPGRADE_SELECT, { timeout: 15000, label: 'upgrade_exit' });
    await settlePostUpgradeState();
  }
}
async function ensureReadyForProgression({ restart = false } = {}) {
  if (restart || game.state === State.TITLE || game.state === State.VICTORY || game.state === State.GAME_OVER) {
    await restartRunForProgression();
    return;
  }
  const deadline = performance.now() + 15000;
  while (performance.now() < deadline) {
    const state = game.state;
    if (state === State.PLAYING) return;
    if (state === State.READY_SCREEN) {
      beginGameplayFromReady();
    } else if (state === State.BOSS_ALERT) {
      game.stateTimer = 0;
    }
    await sleep(50);
  }
  throw new Error('Timed out waiting for playing state');
}

async function restartRunForProgression() {
  resetGame();
  showTitle();
  startGame();
  beginGameplayFromReady();
  await waitForStateMatch(State.PLAYING, { timeout: 10000, label: 'restart_playing' });
}

function configureAutoStrategy(autoOptions) {
  if (autoOptions === undefined || autoOptions === null) {
    return progressionAutoStrategy;
  }
  const value = typeof autoOptions === 'string' ? autoOptions : autoOptions?.strategy;
  const normalized = normalizeUpgradeStrategy(value) || progressionAutoStrategy;
  if (PROGRESSION_AUTO_STRATEGIES.includes(normalized)) {
    progressionAutoStrategy = normalized;
  }
  return progressionAutoStrategy;
}

function applyBiomeOverrideForProgression(biome, options = {}) {
  const normalized = normalizeBiomeInput(biome);
  if (normalized === undefined) {
    return game.debugBiomeOverride || null;
  }
  game.debugBiomeOverride = normalized || null;
  saveDebugSettings();
  const level = game.level || 1;
  if (options.fadeDuration && !environmentFadeState) {
    const duration = Number(options.fadeDuration) || 0.3;
    startEnvironmentFade('out', duration, () => {
      applyThemeForLevel(level);
      startEnvironmentFade('in', duration);
    });
  } else {
    applyThemeForLevel(level);
  }
  return game.debugBiomeOverride;
}
async function startRunAtLevelForProgression(options = {}) {
  const targetLevel = clampLevelNumber(options.level || 1);
  debugJumpToLevel(targetLevel);
  if (options.biome !== undefined) {
    applyBiomeOverrideForProgression(options.biome);
  }
  if (options.skipCountdown === false) {
    startReadyCountdown();
  } else {
    beginGameplayFromReady();
  }
  if (options.startPlaying !== false) {
    await waitForStateMatch(State.PLAYING, { timeout: 10000, label: 'start_level_playing' });
  }
  return {
    ok: true,
    level: game.level,
    biome: getBiomeForLevel(game.level),
    state: game.state,
  };
}

async function concludeUpgradeSelection(strategy) {
  const phase = await waitForUpgradeEntry();
  if (phase !== 'upgrade') {
    return {
      ok: true,
      skipped: true,
      reason: phase,
      state: game.state,
    };
  }
  await waitForCondition(() => upgradeSelectionCooldown <= 0, { timeout: 5000, label: 'upgrade_cooldown' });
  const selection = await autoSelectUpgradeByStrategy(strategy);
  await waitForCondition(() => game.state !== State.UPGRADE_SELECT, { timeout: 15000, label: 'upgrade_exit' });
  await settlePostUpgradeState();
  return selection;
}

async function forceLevelCompleteForTests(options = {}) {
  const strategy = configureAutoStrategy(options?.autoUpgrades || options?.strategy);
  await settlePendingUpgradeIfNeeded(strategy);
  await ensureReadyForProgression({ restart: Boolean(options?.restart) });
  game._levelConfig = getLevelConfig();
  if (game.state === State.PLAYING) {
    const targetKills = game._levelConfig?.killTarget;
    if (Number.isFinite(targetKills)) {
      game.kills = targetKills;
    }
    completeLevel();
  }
  if (options?.autoSelect === false) {
    return {
      ok: true,
      awaitingUpgrade: true,
      level: game.level,
      state: game.state,
    };
  }
  const selection = await concludeUpgradeSelection(strategy);
  return {
    ok: true,
    selection,
    level: game.level,
    state: game.state,
  };
}
async function runSingleLevelCycle(strategy) {
  await settlePendingUpgradeIfNeeded(strategy);
  await ensureReadyForProgression();
  const startLevel = game.level;
  const startBiome = getBiomeForLevel(startLevel);
  const isBossLevel = Boolean(game._levelConfig?.isBoss || (startLevel % 5 === 0));
  game._levelConfig = getLevelConfig();
  if (game.state === State.PLAYING) {
    const targetKills = game._levelConfig?.killTarget;
    if (Number.isFinite(targetKills)) {
      game.kills = targetKills;
    }
    completeLevel();
  }
  const selection = await concludeUpgradeSelection(strategy);
  return {
    level: startLevel,
    biome: startBiome,
    isBoss: isBossLevel,
    selection,
    nextLevel: game.level,
    state: game.state,
  };
}

function normalizeProgressionSegment(segment) {
  const payload = typeof segment === 'object' && segment !== null ? segment : {};
  const biome = Object.prototype.hasOwnProperty.call(payload, 'biome')
    ? normalizeBiomeInput(payload.biome, { preserveUndefined: true })
    : undefined;
  const count = Math.max(1, Math.floor(Number(payload.levelCount ?? payload.levels ?? 1)));
  const stopAfterBoss = Boolean(payload.stopAfterBoss || payload.stopOnBoss);
  return { biome, levelCount: count, stopAfterBoss };
}

async function executeProgressionSegments(segmentsInput, autoOptions, { single = false, restart = false } = {}) {
  const segments = Array.isArray(segmentsInput) && segmentsInput.length > 0
    ? segmentsInput
    : [{ levelCount: 1 }];
  if (restart) {
    await restartRunForProgression();
  } else {
    await ensureReadyForProgression();
  }
  const strategy = configureAutoStrategy(autoOptions);
  const summaries = [];
  for (const rawSegment of segments) {
    const segment = normalizeProgressionSegment(rawSegment);
    if (segment.biome !== undefined) {
      applyBiomeOverrideForProgression(segment.biome);
    }
    const levelSummaries = [];
    for (let i = 0; i < segment.levelCount; i += 1) {
      const levelResult = await runSingleLevelCycle(strategy);
      levelSummaries.push(levelResult);
      if (segment.stopAfterBoss && levelResult.isBoss) break;
      if (game.state === State.VICTORY || game.state === State.GAME_OVER) break;
    }
    summaries.push({
      biome: segment.biome !== undefined ? segment.biome : game.debugBiomeOverride || null,
      requestedLevels: segment.levelCount,
      completedLevels: levelSummaries.length,
      stopAfterBoss: segment.stopAfterBoss,
      levels: levelSummaries,
    });
    if (game.state === State.VICTORY || game.state === State.GAME_OVER) break;
  }
  if (single) {
    return summaries[0] || {
      biome: game.debugBiomeOverride || null,
      requestedLevels: 0,
      completedLevels: 0,
      stopAfterBoss: false,
      levels: [],
    };
  }
  return {
    ok: true,
    strategy,
    segments: summaries,
    finalLevel: game.level,
    finalState: game.state,
    biome: getBiomeForLevel(game.level),
  };
}
function createProgressionAPI() {
  return {
    describe() {
      return {
        biomes: AVAILABLE_BIOMES.slice(),
        autoUpgradeStrategies: PROGRESSION_AUTO_STRATEGIES.slice(),
        defaultStrategy: progressionAutoStrategy,
      };
    },
    getPendingUpgrades: () => getPendingUpgradeSummaries(),
    selectUpgradeById: (upgradeId) => trySelectUpgradeByIdForTests(upgradeId),
    selectUpgradeByIndex: (index) => trySelectUpgradeByIndexForTests(index),
    skipUpgrade: () => trySelectUpgradeByIdForTests('SKIP'),
    setAutoUpgrades: (options = {}) => ({ strategy: configureAutoStrategy(options) }),
    startAt: (options = {}) => startRunAtLevelForProgression(options),
    setBiome: (biome, options = {}) => ({ biome: applyBiomeOverrideForProgression(biome, options) }),
    clearBiomeOverride: () => ({ biome: applyBiomeOverrideForProgression(null) }),
    forceLevelComplete: (options = {}) => forceLevelCompleteForTests(options),
    runSegment: (segment = {}) => executeProgressionSegments([segment], segment?.autoUpgrades || null, { single: true, restart: false }),
    runPlan: (payload = {}) => executeProgressionSegments(payload?.segments || [], payload?.autoUpgrades || null, { single: false, restart: true }),
  };
}

init();

// ============================================================
//  INITIALISATION
// ============================================================

// [CORE] Main initialization entry point
function init() {
  _log('[SPACEOMICIDE] Initialising...');

  // Dev-only: load persisted debug settings in the dev launcher.
  // Live players should not pay localStorage / debug bootstrap costs here.
  if (devRuntimeEnabled) {
    loadDebugSettings();
    runtimeConfig.dev.showFPS = game.debugShowFPS === true;
    runtimeConfig.dev.perfMonitor = game.debugPerfMonitor === true;
    runtimeConfig.dev.positionPanel = game.debugShowPosition === true;
  }

  // Scene — use black background for Adreno GPU "Fast clear" optimization on Quest
  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x000000);
  // Camera - added directly to scene for proper VR hand positioning
  camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.1, 5000);
  camera.rotation.set(0, 0, 0);
  scene.add(camera);

  // Pre-allocate explosion visual pool for Quest perf
  initExplosionPool(scene);

  // Camera position is controlled by WebXR in VR mode, desktop mode sets it elsewhere

  // Renderer — optimized for Quest performance
  renderer = new THREE.WebGLRenderer({
    antialias: !navigator.webdriver,  // [DEBUG] Disable AA in headless/Puppeteer
    alpha: true,
    powerPreference: 'high-performance'
  });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));  // Cap at 1.5 — DPR 2 quadruples pixel count
  renderer.xr.enabled = true;
  // [DEBUG] Disable shadows in headless/Puppeteer mode
  const enableDesktopShadows = !navigator.webdriver && (window.devicePixelRatio >= 2 || window.matchMedia?.('(min-width: 1200px)')?.matches);
  const isQuest = /OculusBrowser|Meta Quest/i.test(navigator.userAgent);
  renderer.shadowMap.enabled = !isQuest && enableDesktopShadows;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  // No tone mapping — we use MeshBasicMaterial so ACES adds shader cost with no benefit
  renderer.toneMapping = THREE.NoToneMapping;
  document.body.appendChild(renderer.domElement);

    // VR Button - disable foveated rendering to remove visible quality boxes
  const vrButton = VRButton.createButton(renderer, {
    optionalFeatures: ['local-floor', 'bounded-floor'],
  });
  document.body.appendChild(vrButton);

  // Fix 1.3: Cache scanlines element once at init (not per-frame query)
  _cachedScanlinesEl = document.getElementById('scanlines');

  // Disable foveated rendering (removes visible quality boxes in Quest VR)
  renderer.xr.addEventListener('sessionstart', () => {
    const isQuest = /OculusBrowser|Meta Quest/i.test(navigator.userAgent);
    renderer.xr.setFoveation(isQuest ? 0.4 : 0.2);
    // Camera is added directly to scene - VR hands work correctly now
    // Validate controller handedness on session start
    validateControllerHandedness();
  });

  // No camera rig reset needed - camera is direct child of scene
  renderer.xr.addEventListener('sessionend', () => {
    _log('[vr] Session ended');
  });

  // Listen for controller changes (e.g., Quest sleep/wake causing hand swap)
  if (renderer.xr.getSession) {
    const session = renderer.xr.getSession();
    if (session && session.inputSourcesChange) {
      session.inputSourcesChange.addEventListener('inputsourceschange', () => {
        validateControllerHandedness();
      });
    }
  }

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

  // Init boss death cinematic module with dependencies
  initBossDeathCinematic({
    scene,
    camera,
    game,
    State,
    spawnBossDebris,
    spawnExplosionVisual,
    hideBossHealthBar,
    clearBoss,
    clearBossProjectiles,
    clearAllTelegraphs,
    playExplosionSound,
    stopMusic,
    completeLevel,
    endGame,
    applyEnvironmentFade,
    resetAllSlowMoState,
    hideKillsAlert,
    unloadBiomeForBossCinematic: purgeBiomeForBossCinematic,
    playSkullDeathKnell,
    playFinalBossCollapseGroan,
    showFloatingMessage,
    playFinalBossVictorySting,
  });

  // Init subsystems
  initEnemies(scene);
  setCameraRef(camera);
  initHUD(camera, scene);
  if (devRuntimeEnabled && runtimeConfig.dev.showFPS) {
    setFPSVisible(true);
  }
  initBossDeathOverlays();

  // Nuke flash overlay (white screen flash on nuke activation)
  const nukeFlashGeo = new THREE.PlaneGeometry(10, 10);
  const nukeFlashMat = basicMat(0xffffff, {
    transparent: true,
    opacity: 0,
    depthTest: false,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  nukeFlash = new THREE.Mesh(nukeFlashGeo, nukeFlashMat);
  nukeFlash.renderOrder = 1001;
  nukeFlash.frustumCulled = false;
  nukeFlash.position.set(0, 0, -0.3);
  camera.add(nukeFlash);

  initVFX(scene);

  // PERFORMANCE: Initialize projectile pool
  initProjectilePool();
  
  // PHYSICS DEATH SYSTEM: Initialize voxel pool
  initVoxelDebris(scene, triggerScreenShake, playExplosionSound);
  
  // Set voxel explosion reference for enemies.js (same module instance as import)
  setVFXReference(spawnVoxelExplosion);
  _log('[physics-death] Voxel explosion reference set');

  // Initialize debris glow plane pool (orange glow for boss projectile debris)
  if (!_debrisGlowPool) {
    const glowSize = 64;
    const glowCanvas = document.createElement('canvas');
    glowCanvas.width = glowSize;
    glowCanvas.height = glowSize;
    const glowCtx = glowCanvas.getContext('2d');
    const half = glowSize / 2;
    const grad = glowCtx.createRadialGradient(half, half, 0, half, half, half);
    grad.addColorStop(0, 'rgba(255,160,40,1)');
    grad.addColorStop(0.3, 'rgba(255,100,10,0.7)');
    grad.addColorStop(0.6, 'rgba(255,50,0,0.3)');
    grad.addColorStop(1, 'rgba(200,20,0,0)');
    glowCtx.fillStyle = grad;
    glowCtx.fillRect(0, 0, glowSize, glowSize);
    const glowTex = new THREE.CanvasTexture(glowCanvas);
    glowTex.minFilter = THREE.LinearFilter;
    const glowGeo = new THREE.PlaneGeometry(0.4, 0.4);
    const glowMat = new THREE.MeshBasicMaterial({
      map: glowTex,
      color: 0xff6600,
      transparent: true,
      opacity: 0.85,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      depthTest: true,
      side: THREE.DoubleSide,
    });
    _debrisGlowPool = new THREE.InstancedMesh(glowGeo, glowMat, DEBRIS_GLOW_POOL_SIZE);
    _debrisGlowPool.name = 'debris-glow-pool';
    _debrisGlowPool.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    _debrisGlowPool.count = 0;
    _debrisGlowPool.frustumCulled = false;
    _debrisGlowPool.renderOrder = 8;
    _debrisGlowPool.visible = true;
    scene.add(_debrisGlowPool);
    _debrisGlowFree = [];
    for (let i = 0; i < DEBRIS_GLOW_POOL_SIZE; i++) _debrisGlowFree.push(i);
    _debrisGlowActive = [];
    _log('[debris-glow] Glow plane pool initialized (20 instances)');
  }

  // Set up stasis field reference for shared access
  setActiveStasisFields(activeStasisFields);

  // [DEBUG] Desktop controls for non-VR playtesting
  initDesktopControls(scene, camera, renderer);

  // [DEBUG] Set up pause/nuke callbacks for keyboard shortcuts
  setOnPauseCallback(togglePause);
  setOnNukeCallback(activateNuke);
  setMenuStateCallback(() => {
    const st = game.state;
    return st === State.NAME_ENTRY || st === State.SCOREBOARD || st === State.REGIONAL_SCORES ||
           st === State.COUNTRY_SELECT || st === State.TITLE || st === State.UPGRADE_SELECT ||
           st === State.PAUSED || st === State.READY_SCREEN || st === State.GAME_OVER;
  });
  setNameKeyCallback((key) => {
    const result = desktopTypeChar(key);
    if (result && result.action === 'submit') {
      const name = result.name.trim();
      if (!isNameClean(name)) {
        _log('[scoreboard] Name rejected by profanity filter');
        return;
      }
      setStoredName(name);
      hideNameEntry();
      game.state = State.SCOREBOARD;
      showScoreboard([], 'SUBMITTING...');
      const country = getStoredCountry() || '';
      let submittedAt = null;
      submitScore(name, game.finalScore, game.finalLevel, country).then((data) => {
        if (data && data[0] && data[0].created_at) {
          submittedAt = data[0].created_at;
          setLastSubmittedTimestamp(submittedAt);
        }
        return new Promise(resolve => setTimeout(resolve, 500));
      }).then(() => {
        return fetchTopScores();
      }).then(scores => {
        showScoreboard(scores, null, submittedAt);
      }).catch(err => {
        console.error('[scoreboard] Submit failed:', err);
        showScoreboard([], 'FAILED TO LOAD');
      });
    }
  });

  registerRuntimeAction('setFpsVisible', (visible) => setFPSVisible(visible === true));
  registerRuntimeAction('cycleBiomeWithFade', () => cycleDebugBiomeWithFade());

  // Dev/test automation surfaces stay out of the live launcher.
  if (devRuntimeEnabled && runtimeConfig.dev.testAPI && typeof window !== 'undefined') {
    window.__test = window.__test || {};
    window.__test.getEnemies = getEnemies;
    window.__test.getEnemyCount = getEnemyCount;
    window.__test.getCamera = () => camera;
    window.__test.getRenderer = () => renderer;
    window.__test.getScene = () => scene;
    window.__test.activateNuke = activateNuke;
    window.__test.getNukeCount = () => game.nukes;
    const telemetryBridge = {
      enable: (options = {}) => enableTelemetry(options),
      disable: () => disableTelemetry(),
      isEnabled: () => isTelemetryEnabled(),
      setHistoryWindow: (ms) => setTelemetryHistoryMs(ms),
      snapshot: () => getTelemetrySnapshot(),
      getSnapshot: () => getTelemetrySnapshot(),
      collect: () => getTelemetrySnapshot(),
    };
    window.__test.telemetry = telemetryBridge;
    const perfTarget = window.__perf || {};
    perfTarget.enable = telemetryBridge.enable;
    perfTarget.disable = telemetryBridge.disable;
    perfTarget.isEnabled = telemetryBridge.isEnabled;
    perfTarget.setHistoryWindow = telemetryBridge.setHistoryWindow;
    perfTarget.snapshot = telemetryBridge.snapshot;
    perfTarget.getSnapshot = telemetryBridge.getSnapshot;
    perfTarget.collect = telemetryBridge.collect;
    window.__perf = perfTarget;
    perfTarget.startProfileBuckets = () => {
      perfTarget._profileBuckets = {};
      return perfTarget._profileBuckets;
    };
    perfTarget.dumpProfileBuckets = () => {
      const b = perfTarget._profileBuckets;
      if (!b || !b._frames) return 'No profile data. Call __perf.startProfileBuckets() first.';
      const frames = b._frames;
      const omit = new Set(['_frames', '_wallTotal']);
      const entries = Object.keys(b).filter(k => !omit.has(k)).map(k => [k, b[k]]);
      entries.sort((a, b) => b[1] - a[1]);
      const wallTotal = b._wallTotal || 0;
      let report = `=== Frame Profile Report (${frames} frames, wall total ${wallTotal.toFixed(1)}ms, avg ${(wallTotal / frames).toFixed(2)}ms/frame) ===\n`;
      report += entries.map(([k, v]) => `${k}: ${v.toFixed(2)}ms total, avg ${(v / frames).toFixed(3)}ms/frame (${(v / wallTotal * 100).toFixed(1)}% of wall)`).join('\n');
      return report;
    };

    const progressionAPI = createProgressionAPI();
    window.__test.progression = progressionAPI;
    perfTarget.progression = progressionAPI;
    window.__progression = progressionAPI;

    // [DEBUG] Test hook: deterministic single-shot at a chosen enemy for headless runs.
    // Params: enemyIndex (number), options { distance, hp, snapToCamera }.
    // Returns true if a projectile was fired.
    window.__test.fireAtEnemy = (enemyIndex, options = {}) => {
      const enemies = getEnemies();
      const enemy = enemies && Number.isInteger(enemyIndex) ? enemies[enemyIndex] : null;
      if (!enemy || !enemy.mesh || !camera) return false;

    const distance = Number.isFinite(options.distance) ? options.distance : 6;
    const snapToCamera = options.snapToCamera !== false;
    if (snapToCamera) {
      const forward = camera.getWorldDirection(new THREE.Vector3());
      enemy.mesh.position.copy(camera.position).add(forward.multiplyScalar(distance));
      enemy.mesh.updateMatrixWorld(true);
    }

    if (typeof enemy.hp === 'number') {
      const targetHp = Number.isFinite(options.hp) ? options.hp : 1;
      enemy.hp = Math.min(enemy.hp, targetHp);
    }

    const origin = camera.position.clone();
    const target = enemy.mesh.position.clone();
    const direction = target.clone().sub(origin);
    if (direction.lengthSq() === 0) {
      direction.set(0, 0, -1);
    }
    direction.normalize();

    const quat = new THREE.Quaternion().setFromUnitVectors(
      new THREE.Vector3(0, 0, -1),
      direction
    );

    const testController = {
      getWorldPosition: (vec) => { vec.copy(origin); return vec; },
      getWorldQuaternion: (vec) => { vec.copy(quat); return vec; },
      userData: { handedness: 'left' }
    };

    weaponCooldowns[0] = 0;
    fireMainWeapon(testController, 0);
    return true;
    };
  }

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

  _log('[init] SPACEOMICIDE ready — pull trigger at title screen to start');
}

// [DEBUG] Desktop-only stereo/anaglyph post-processing
function initDesktopStereoEffects() {
  if (!renderer) return;

  if (!desktopEffectRefs.anaglyph) {
    desktopEffectRefs.anaglyph = new AnaglyphEffect(renderer, window.innerWidth, window.innerHeight);
  }

  if (!desktopEffectRefs.stereo) {
    desktopEffectRefs.stereo = new StereoEffect(renderer);
    desktopEffectRefs.stereo.eyeSeparation = VISUAL_TUNING_DEFAULTS.stereoEyeSeparation;
  }

  resizeDesktopStereoEffects();
}

// [DEBUG] Resize desktop stereo effects on window resize
function resizeDesktopStereoEffects() {
  if (desktopEffectRefs.anaglyph) {
    desktopEffectRefs.anaglyph.setSize(window.innerWidth, window.innerHeight);
  }
  if (desktopEffectRefs.stereo) {
    desktopEffectRefs.stereo.setSize(window.innerWidth, window.innerHeight);
  }
}

// [DEBUG] Clamp debug slider values to safe ranges
function clampDebugValue(value, min, max, fallback) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}

// [DEBUG] Read visual tuning parameters from the dev launcher runtime config.
function getVisualTuning() {
  const tuning = runtimeConfig.dev.visualTuning || {};

  return {
    glowStrength: clampDebugValue(tuning.glowStrength, 0, 2, VISUAL_TUNING_DEFAULTS.glowStrength),
    smokeStrength: clampDebugValue(tuning.smokeStrength, 0, 2, VISUAL_TUNING_DEFAULTS.smokeStrength),
    fogIntensity: clampDebugValue(tuning.fogIntensity, 0, 1, VISUAL_TUNING_DEFAULTS.fogIntensity),
    shellStrength: clampDebugValue(tuning.shellStrength, 0, 2, VISUAL_TUNING_DEFAULTS.shellStrength),
    shellSaturation: clampDebugValue(tuning.shellSaturation, 0, 2, VISUAL_TUNING_DEFAULTS.shellSaturation),
    shellScanlineSpeed: clampDebugValue(tuning.shellScanlineSpeed, 0, 3, VISUAL_TUNING_DEFAULTS.shellScanlineSpeed),
    shellNoiseAmount: clampDebugValue(tuning.shellNoiseAmount, 0, 2, VISUAL_TUNING_DEFAULTS.shellNoiseAmount),
    renderMode: typeof tuning.renderMode === 'string' ? tuning.renderMode : VISUAL_TUNING_DEFAULTS.renderMode,
    stereoEyeSeparation: clampDebugValue(tuning.stereoEyeSeparation, 0.01, 0.2, VISUAL_TUNING_DEFAULTS.stereoEyeSeparation),
    shellTint: typeof tuning.shellTint === 'string' ? tuning.shellTint : VISUAL_TUNING_DEFAULTS.shellTint,
  };
}

// [DEBUG] Register projectile material for visual tuning glow adjustment
function registerPlayerProjectileMaterial(material) {
  if (!material) return;
  if (!material.userData) material.userData = {};
  if (material.userData.baseOpacity === undefined) {
    material.userData.baseOpacity = material.opacity !== undefined ? material.opacity : 1;
  }
  if (material.uniforms?.uOpacity && material.userData.baseUniformOpacity === undefined) {
    material.userData.baseUniformOpacity = material.uniforms.uOpacity.value;
  }
  playerProjectileMaterials.add(material);
}

// [DEBUG] Apply visual tuning slider values to materials and effects
function applyVisualTuning(tuning = getVisualTuning()) {

  if (synthVisualRefs.terrainUniforms) {
    if (synthVisualRefs.terrainUniforms.uGlowIntensity) {
      synthVisualRefs.terrainUniforms.uGlowIntensity.value = tuning.glowStrength;
    }
    if (synthVisualRefs.terrainUniforms.uFogIntensity) {
      synthVisualRefs.terrainUniforms.uFogIntensity.value = tuning.fogIntensity;
    }
  }

  const glowOpacityScale = 0.2 + (tuning.glowStrength * 0.8);
  [
    synthVisualRefs.sunOuterGlowMat,
    synthVisualRefs.sunGlowMat,
    synthVisualRefs.sunCoreMat,
  ].forEach((mat) => {
    if (!mat) return;
    if (!mat.userData) mat.userData = {};
    if (mat.userData.baseOpacity === undefined) {
      mat.userData.baseOpacity = mat.opacity !== undefined ? mat.opacity : 1;
    }
    mat.opacity = mat.userData.baseOpacity * glowOpacityScale;
  });

  // Also apply glow tuning to all pooled player projectile materials.
  const projectileOpacityScale = 0.35 + (tuning.glowStrength * 0.65);
  playerProjectileMaterials.forEach((mat) => {
    if (!mat) return;
    if (!mat.userData) mat.userData = {};
    if (mat.uniforms?.uOpacity) {
      if (mat.userData.baseUniformOpacity === undefined) {
        mat.userData.baseUniformOpacity = mat.uniforms.uOpacity.value;
      }
      mat.uniforms.uOpacity.value = (mat.userData.baseUniformOpacity ?? PROJECTILE_BOLT.opacity) * projectileOpacityScale;
      mat.opacity = mat.uniforms.uOpacity.value;
    } else {
      if (mat.userData.baseOpacity === undefined) {
        mat.userData.baseOpacity = mat.opacity !== undefined ? mat.opacity : 1;
      }
      mat.opacity = mat.userData.baseOpacity * projectileOpacityScale;
    }
  });

  if (desktopEffectRefs.stereo) {
    desktopEffectRefs.stereo.eyeSeparation = tuning.stereoEyeSeparation;
  }
}

// [DEBUG] Determine desktop render mode (normal/anaglyph/stereo)
function getDesktopRenderMode(tuning) {
  if (renderer?.xr?.isPresenting) return 'normal';
  if (tuning.renderMode === 'anaglyph' || tuning.renderMode === 'stereo') {
    return tuning.renderMode;
  }
  return 'normal';
}

// [DEBUG] Render desktop-only debug stereo/anaglyph effects
function renderDesktopDebugEffect(tuning) {
  const mode = getDesktopRenderMode(tuning);
  if (mode === 'normal') return false;

  initDesktopStereoEffects();

  // Desktop-only caveat: these stereo passes bypass the normal renderer path,
  // so additive tweaks (like fake glow) should be considered inactive while they run.
  if (mode === 'anaglyph' && desktopEffectRefs.anaglyph) {
    desktopEffectRefs.anaglyph.render(scene, camera);
    return true;
  }

  if (mode === 'stereo' && desktopEffectRefs.stereo) {
    desktopEffectRefs.stereo.render(scene, camera);
    return true;
  }

  return false;
}

// [CORE] Cleanup legacy ShapeGeometry mountains
function cleanupLegacyShapeGeometry(targetGroup) {
  if (!targetGroup) return;

  const staleMeshes = [];
  const worldPos = new THREE.Vector3();
  const boundsSize = new THREE.Vector3();

  targetGroup.traverse((child) => {
    if (!child?.isMesh || !child.geometry) return;
    if (child.geometry.type !== 'ShapeGeometry') return;

    child.getWorldPosition(worldPos);
    const atWorldOrigin = worldPos.lengthSq() <= 0.0001;

    // Non-obvious safety guard: legacy audio-peak mountains were large flat
    // ShapeGeometry meshes locked at world origin. Keep this strict so we do
    // not remove gameplay hex meshes that also use ShapeGeometry.
    if (!child.geometry.boundingBox) child.geometry.computeBoundingBox();
    if (!child.geometry.boundingBox) return;
    child.geometry.boundingBox.getSize(boundsSize);
    const isLargeLegacyPlane = boundsSize.lengthSq() >= (25 * 25);

    if (!atWorldOrigin || !isLargeLegacyPlane) return;
    staleMeshes.push(child);
  });

  staleMeshes.forEach((mesh, idx) => {
    disposeObject3D(mesh);
    _log(`[biome] Removed stale ShapeGeometry legacy mountain at world origin (${idx + 1}/${staleMeshes.length})`);
  });
}

// [CORE] Biome mesh name sanitization
function sanitizeBiomeMeshName(name) {
  return String(name || '')
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

// [CORE] Assign biome-specific names to floor planes
function assignBiomePlaneNames(targetGroup, biomeId) {
  if (!targetGroup) return;

  const usedPlaneNames = new Set();

  targetGroup.traverse((child) => {
    if (!child?.isMesh || !child.geometry) return;
    if (child.geometry.type !== 'PlaneGeometry') return;

    const geoParams = child.geometry.parameters || {};
    const widthTag = Number.isFinite(geoParams.width) ? `w${Math.round(geoParams.width)}` : 'w';
    const heightTag = Number.isFinite(geoParams.height) ? `h${Math.round(geoParams.height)}` : 'h';

    const preferredName =
      sanitizeBiomeMeshName(child.userData?.planeName) ||
      sanitizeBiomeMeshName(child.name) ||
      sanitizeBiomeMeshName(child.parent?.name) ||
      `${biomeId}-plane-${widthTag}-${heightTag}`;

    let baseName = preferredName || `${biomeId}-plane-${widthTag}-${heightTag}`;
    let uniqueName = baseName;
    let suffix = 2;

    while (usedPlaneNames.has(uniqueName)) {
      uniqueName = `${baseName}-${suffix++}`;
    }

    // Keep userData + mesh name in sync so debug tooling and inspector searches
    // both resolve to the same human-readable PlaneGeometry label.
    child.name = uniqueName;
    child.userData.planeName = uniqueName;
    usedPlaneNames.add(uniqueName);
  });
}

// [CORE] Update VR pause button state
function updateVRPauseButton(now) {
  const session = renderer?.xr?.getSession?.();
  if (!session) {
    vrPauseButtonPressed.clear();
    return;
  }

  let pausePressedThisFrame = false;

  session.inputSources.forEach((source, sourceIndex) => {
    const gamepad = source.gamepad;
    if (!gamepad?.buttons || gamepad.buttons.length === 0) return;

    // WebXR mappings vary by controller. Check common non-trigger buttons so
    // at least one hardware button can open pause on most headsets/controllers.
    const pressed = !!(
      gamepad.buttons[3]?.pressed || // thumbstick click
      gamepad.buttons[4]?.pressed || // X/A
      gamepad.buttons[5]?.pressed || // Y/B
      gamepad.buttons[2]?.pressed    // touchpad/menu fallback on some mappings
    );

    const key = `${source.handedness || 'none'}-${sourceIndex}`;
    const wasPressed = vrPauseButtonPressed.get(key) === true;
    vrPauseButtonPressed.set(key, pressed);

    if (pressed && !wasPressed) {
      pausePressedThisFrame = true;
    }
  });

  if (!pausePressedThisFrame) return;
  if (now - lastVRPauseToggleTime < VR_PAUSE_DEBOUNCE_MS) return;

  if (game.state === State.PLAYING || game.state === State.PAUSED) {
    lastVRPauseToggleTime = now;
    togglePause();
  }
}

// ============================================================
// ENVIRONMENT CREATION
// Sun, mountains, stars, horizon
// COUPLING: Updates scene directly, registers fade materials
// ============================================================

// [CORE] Create initial game environment
// Base floor/sun/stars/lights REMOVED — all 4 biomes are custom scenes with hideBaseEnv:true
// Each biome provides its own terrain, sky, lighting, and atmosphere.
function createEnvironment() {
  // No base environment needed — biomes provide everything
}

// [CORE] Register material for environment fade
function registerFadeMaterial(material) {
  if (!material) return;
  // Prevent unbounded growth across level rebuilds.
  if (environmentFadeTargets.includes(material)) return;
  const baseOpacity = material.opacity !== undefined ? material.opacity : 1;
  material.transparent = true;
  material.__fadeBase = baseOpacity;
  environmentFadeTargets.push(material);
}

// [CORE] Unregister material from fade system
function unregisterFadeMaterial(material) {
  if (!material) return;
  const idx = environmentFadeTargets.indexOf(material);
  if (idx !== -1) environmentFadeTargets.splice(idx, 1);
}

// [CORE] Unregister all fade materials for an object
function unregisterFadeMaterialsForObject(obj) {
  if (!obj || typeof obj.traverse !== 'function') return;
  obj.traverse((child) => {
    if (!child.material) return;
    if (Array.isArray(child.material)) child.material.forEach(unregisterFadeMaterial);
    else unregisterFadeMaterial(child.material);
  });
}

// [CORE] Deep dispose material and textures
function disposeMaterialDeep(material) {
  if (!material) return;
  if (Array.isArray(material)) {
    material.forEach(disposeMaterialDeep);
    return;
  }

  // three.js does NOT dispose textures when a material is disposed.
  const maps = [
    'map',
    'alphaMap',
    'aoMap',
    'bumpMap',
    'displacementMap',
    'emissiveMap',
    'envMap',
    'lightMap',
    'metalnessMap',
    'normalMap',
    'roughnessMap',
    'specularMap',
  ];
  for (const key of maps) {
    const tex = material[key];
    if (tex && tex.isTexture && typeof tex.dispose === 'function') {
      tex.dispose();
    }
  }

  if (typeof material.dispose === 'function') material.dispose();
}

// [CORE] Safely set material emissive color
function setMaterialEmissiveSafe(material, color, intensity) {
  if (!material) return;
  if (Array.isArray(material)) {
    material.forEach((m) => setMaterialEmissiveSafe(m, color, intensity));
    return;
  }

  if (material.emissive && typeof material.emissive.copy === 'function') {
    material.emissive.copy(color);
    material.emissiveIntensity = intensity;
    return;
  }

  if (Object.prototype.hasOwnProperty.call(material, 'emissive')) delete material.emissive;
  if (Object.prototype.hasOwnProperty.call(material, 'emissiveIntensity')) delete material.emissiveIntensity;
}

// [CORE] Clear current biome scene
function clearBiomeScene() {
  if (!biomeSceneGroup) return;
  disposeObject3D(biomeSceneGroup);
  biomeSceneGroup = null;
  biomeSceneBiome = null;
  biomeTerrainMaterials = [];  // Clear terrain flash references

  synthVisualRefs.terrainUniforms = null;
  synthVisualRefs.sunOuterGlowMat = null;
  synthVisualRefs.sunGlowMat = null;
  synthVisualRefs.sunCoreMat = null;
  synthVisualRefs.mountainCylMat = null;
  synthVisualRefs.desertSkyMat = null;
  synthVisualRefs.desertMoonMat = null;
  synthVisualRefs.desertMoonGlowMat = null;
  synthVisualRefs.alienSkyMat = null;
  synthVisualRefs.alienCityShaderMat = null;
  synthVisualRefs.alienGreenLight = null;
}

// [CORE] Purge biome geometry for boss cinematic
function purgeBiomeForBossCinematic() {
  if (biomeClearedForBossCinematic) return;
  biomeClearedForBossCinematic = true;

  // Drop the current biome geometry while the screen is black so upgrades
  // appear on a clean slate before the next biome loads.
  clearBiomeScene();

  // Stars are added directly to scene (not biomeSceneGroup), so they must
  // be cleaned up separately. Without this, old star particles leak into
  // the upgrade card screen and accumulate across biome transitions (#4, #8, #20).
  if (starsRef) {
    unregisterFadeMaterial(starsRef.material);
    disposeMesh(starsRef, true);
    starsRef = null;
    starsBiomeId = null;
  }

  if (floorMaterial) floorMaterial.opacity = 0;
  applyEnvironmentFade(1);
  if (scene) {
    if (scene.background && scene.background.isColor) {
      scene.background.set(0x000000);
    } else {
      scene.background = new THREE.Color(0x000000);
    }
  }
}

// [CORE] Deep dispose Object3D and children
function disposeObject3D(obj) {
  if (!obj) return;
  // Guard: only traverse if obj is a THREE.Object3D (proxy objects from InstancedMesh pools don't have .traverse)
  if (typeof obj.traverse !== 'function') return;

  unregisterFadeMaterialsForObject(obj);

  obj.traverse((child) => {
    if (child.geometry) child.geometry.dispose();
    if (child.material) disposeMaterialDeep(child.material);
  });

  // Remove from parent (scene or group). Safe to call even if already removed.
  if (obj.parent) obj.parent.remove(obj);
}

// [CORE] Update biome props (animated scenery)
function updateBiomeProps(now, dt) {
  if (!biomeSceneGroup) return;
  if (biomeSceneGroup.userData && typeof biomeSceneGroup.userData.update === 'function') {
    biomeSceneGroup.userData.update(now, dt);
  }
  if (starsRef && starsRef.userData && typeof starsRef.userData.update === 'function') {
    starsRef.userData.update(now, dt);
  }
}

// [CORE] Start environment fade (in or out)
function startEnvironmentFade(direction, duration, onComplete) {
  environmentFadeState = {
    direction,
    duration,
    timer: duration,
    onComplete,
  };
}

// [CORE] Apply current environment fade to registered materials
function applyEnvironmentFade(fade) {
  environmentFade = Math.max(0, Math.min(1, fade));
  const mixColor = new THREE.Color(0x000000);

  if (scene && currentTheme) {
    const bg = new THREE.Color(currentTheme.skyColor).lerp(mixColor, environmentFade);
    if (scene.background && scene.background.copy) {
      scene.background.copy(bg);
    }
  }

  environmentFadeTargets.forEach((material) => {
    const base = material.__fadeBase ?? 1;
    material.opacity = base * (1 - environmentFade);
  });
}

// [CORE] Apply theme and rebuild biome for a level
function applyThemeForLevel(level) {
  const theme = getThemeForLevel(level);
  const biome = getBiomeForLevel(level);
  _log('[debug] applyThemeForLevel: level=', level, 'biome=', biome, 'theme=', theme?.name);
  if (!theme || !scene) return;

  currentTheme = theme;

  // Rebuild stars when biome changes
  const biomeId = getBiomeForLevel(level);
  if (biomeId !== starsBiomeId) {
    rebuildStars(theme, biomeId);
    starsBiomeId = biomeId;
  }

  rebuildBiomeScene(biome, theme);
  applyBiomeLighting(biome);

  applyEnvironmentFade(environmentFade);
}

// [CORE] Create sun mesh and glow for biome scene
// createSun() REMOVED — base environment deleted, biomes provide their own sun/moon

// [CORE] Create sparkling star particles
function createSparklingStars(theme) {
  // Dispose any existing stars to prevent scene leaks
  if (starsRef) {
    if (starsRef.parent) starsRef.parent.remove(starsRef);
    starsRef.geometry.dispose();
    starsRef.material.dispose();
    starsRef = null;
  }
  const count = theme.starCount || 800;
  // FIX: Stars should be on a dome/hemisphere, not a clumped box
  // Dome radius should be inside the sky sphere (2800 radius) so stars are visible
  const domeRadius = theme.starDomeRadius || 2200;  // Inside sky sphere (2800)
  const domeCenterY = theme.starDomeCenterY || 400;  // Raise center so dome covers horizon
  
  const positions = new Float32Array(count * 3);
  const phases = new Float32Array(count);
  
  for (let i = 0; i < count; i++) {
    const i3 = i * 3;
    
    // Hemisphere distribution: random point on upper hemisphere
    // Use spherical coordinates for even distribution
    // theta: 0 to 2*PI (around the dome)
    // phi: 0 to PI/2 (from top to horizon for hemisphere)
    const theta = Math.random() * Math.PI * 2;
    // Use cos(phi) distribution for even spacing on sphere surface
    // phi from 0 (top) to PI/2 (horizon)
    const phi = Math.acos(1.0 - Math.random() * 0.9);  // Slight bias toward horizon for visual interest
    
    const x = Math.sin(phi) * Math.cos(theta);
    const y = Math.cos(phi);  // y is up
    const z = Math.sin(phi) * Math.sin(theta);
    
    // Scale by radius and offset by center
    positions[i3] = x * domeRadius;
    positions[i3 + 1] = y * domeRadius + domeCenterY;
    positions[i3 + 2] = z * domeRadius;
    
    phases[i] = Math.random() * Math.PI * 2;
  }
  
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geo.setAttribute('aPhase', new THREE.BufferAttribute(phases, 1));
  const tint = new THREE.Color(theme.starColor || 0xff66cc);
  const mat = new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uColor: { value: tint },
      uPixelRatio: { value: Math.min(window.devicePixelRatio, 2) },
      uOpacity: { value: 1.0 }
    },
    vertexShader: `
      attribute float aPhase;
      uniform float uTime;
      uniform float uPixelRatio;
      varying float vTwinkle;
      void main() {
        vTwinkle = 0.5 + 0.5 * sin(uTime * 2.0 + aPhase);
        vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
        // FIX: Increased base size from 2.2 to 8.0 and distance scale from 200 to 800
        // Stars were ~0.2px at dome radius 2200, now ~3px minimum
        // 25% larger: 8.0→10.0, 2.0→2.5, 800→1000, 2.5→3.125
        float size = (10.0 * uPixelRatio + vTwinkle * 2.5) * (1000.0 / -mvPosition.z);
        gl_PointSize = max(size, 3.125);  // Minimum 3.125px for visibility
        gl_Position = projectionMatrix * mvPosition;
      }
    `,
    fragmentShader: `
      uniform vec3 uColor;
      uniform float uOpacity;
      varying float vTwinkle;
      void main() {
        float dist = length(gl_PointCoord - vec2(0.5));
        if (dist > 0.5) discard;
        float alpha = 1.0 - smoothstep(0.0, 0.5, dist);
        gl_FragColor = vec4(uColor * (0.7 + vTwinkle * 0.4), alpha * vTwinkle * uOpacity);
      }
    `,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending
  });
  const stars = new THREE.Points(geo, mat);
  stars.name = 'sparkling-stars';
  stars.renderOrder = 10;  // Render after skydome (-20) and sun (-3 to -1)
  stars.userData.update = (now) => {
    mat.uniforms.uTime.value = now * 0.001;
    // Sync material.opacity (set by fade system) to shader uniform
    mat.uniforms.uOpacity.value = mat.opacity;
  };
  scene.add(stars);
  starsRef = stars;
  registerFadeMaterial(starsRef.material);
  // NOTE: Do NOT set starsBiomeId here — applyThemeForLevel() owns that.
}

// [CORE] Create background stars
// createStars() REMOVED — base environment deleted, biomes provide their own stars
// rebuildStars() REMOVED — was for non-custom biomes only

// [CORE] Rebuild stars on biome change
function rebuildStars(theme, biomeId) {
  if (!scene) return;
  if (starsRef) {
    unregisterFadeMaterial(starsRef.material);
    disposeMesh(starsRef, true);
    starsRef = null;
  }
  // Biomes that create their own stars inside biomeSceneGroup don't need
  // global stars. Only synthwave_valley relies on the global starfield.
  if (theme.customScene && theme.customScene !== 'synthwave_valley') {
    return;
  }
  if (theme.customScene === 'synthwave_valley') {
    createSparklingStars(theme);
    return;
  }
  // Fallback (should never happen)
  console.warn('[stars] No customScene for theme:', theme?.name);
}

// ============================================================
// CONTROLLER SETUP & INPUT HANDLING
// VR controllers, trigger press/release, squeeze, desktop click
// HOT PATH: onTriggerPress called every frame when trigger held
// COUPLING: Directly calls fireMainWeapon, fireAltWeapon
// ============================================================
// [CORE] VR controller setup and event binding
function setupControllers() {
  for (let i = 0; i < 2; i++) {
    const controller = renderer.xr.getController(i);

    // MAIN weapon triggers (top/select trigger)
    controller.addEventListener('selectstart', () => {
      controllerTriggerPressed[i] = true;
      upgradeTriggerLatched[i] = false;
      onTriggerPress(controller, i);
    });
    controller.addEventListener('selectend', () => {
      controllerTriggerPressed[i] = false;
      upgradeTriggerLatched[i] = false;
      onTriggerRelease(i);
    });
    
    // ALT weapon triggers (bottom/squeeze trigger)
    controller.addEventListener('squeezestart', () => { onSqueezePress(controller, i); });
    controller.addEventListener('squeezeend', () => { onSqueezeRelease(i); });
    
    // Pause via left controller secondary/menu button
    if (i === 0) {
      controller.addEventListener('secondary', () => { togglePause(); });
    }
    
    controller.addEventListener('connected', (e) => {
      _log(`[controller] ${i} connected — ${e.data.handedness}`);
      const display = blasterDisplays[i];
      if (display) {
        display.userData.hand = controller.userData.handedness;
        display.userData.needsUpdate = true;
      }
    });
    controller.addEventListener('disconnected', () => {
      _log(`[controller] ${i} disconnected`);
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
// [CORE] Get hand assignment for controller index
function getHandForController(controllerIndex) {
  const controller = controllers[controllerIndex];
  if (controller && controller.userData.handedness) {
    // Use actual controller handedness (from VR system)
    return controller.userData.handedness;
  }
  // Fallback to index-based mapping (controller 0 = left, controller 1 = right)
  return controllerIndex === 0 ? 'left' : 'right';
}

function getControllerIndex(controller) {
  return controllers.indexOf(controller);
}

import { CONTROLLER_RENDER_ORDER } from './pause-menu.js';
// Weapon identity colors for controller spheres
const WEAPON_SPHERE_COLORS = {
  standard_blaster: { left: 0x00ffff, right: 0xff00ff },  // Cyan left, Pink right
  seeker_burst: 0x83FF2B,      // Lightsaber green
  buckshot: 0xff8800,           // Orange
  lightning_rod: 0xF1DF25,     // Yellow
  plasma_carbine: 0xA450B6,    // Purple
  charge_cannon: 0xff0000,     // Red
};

function getWeaponSphereColor(weaponId, hand) {
  const entry = WEAPON_SPHERE_COLORS[weaponId];
  if (!entry) return hand === 'right' ? NEON_PINK : NEON_CYAN;
  if (typeof entry === 'number') return entry;
  return entry[hand] || entry.left;
}

function updateControllerSphereColor(index) {
  const hand = index === 0 ? 'left' : 'right';
  const controller = controllers[index];
  if (!controller) return;
  const visual = controller.children.find(c => c.name === `controller-visual-${hand}`);
  if (!visual) return;

  const weaponId = game.mainWeapon[hand];
  const color = getWeaponSphereColor(weaponId, hand);

  const core = visual.children.find(c => c.name === `controller-core-${hand}`);
  const glowSphere = visual.children.find(c => c.name === `controller-glow-${hand}`);
  const aimLine = visual.children.find(c => c.name === `controller-aim-${hand}`);

  if (core) core.material.color.setHex(color);
  if (glowSphere) glowSphere.material.color.setHex(color);
  if (aimLine) aimLine.material.color.setHex(color);
}

function updateAllControllerSphereColors() {
  updateControllerSphereColor(0);
  updateControllerSphereColor(1);
}

function createControllerVisual(index) {
  const hand = index === 0 ? 'left' : 'right';
  const color = index === 0 ? NEON_CYAN : NEON_PINK;
  const group = new THREE.Group();
  group.name = `controller-visual-${hand}`;
  // CRITICAL: Controller visuals must render on TOP of all menus (pause, settings, scoreboard)
  // so the player can always see their pointer beam when aiming at buttons.
  group.renderOrder = CONTROLLER_RENDER_ORDER;

  const core = new THREE.Mesh(new THREE.SphereGeometry(0.03, 16, 16), new THREE.MeshBasicMaterial({ color }));
  core.name = `controller-core-${hand}`;
  core.renderOrder = CONTROLLER_RENDER_ORDER;
  group.add(core);
  const glow = new THREE.Mesh(new THREE.SphereGeometry(0.055, 16, 16), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.2 }));
  glow.name = `controller-glow-${hand}`;
  glow.renderOrder = CONTROLLER_RENDER_ORDER;
  group.add(glow);

  // Aim line extending forward — must render on top of menus
  const aimGeo = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, 0, -10)]);
  const aimLine = new THREE.Line(aimGeo, new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.3, depthTest: false, depthWrite: false }));
  aimLine.name = `controller-aim-${hand}`;
  aimLine.renderOrder = CONTROLLER_RENDER_ORDER;
  group.add(aimLine);

  // Create holographic display (initially hidden)
  const display = createBlasterDisplay(index);
  display.visible = false;
  display.name = `blaster-display-${hand}`;
  group.add(display);
  blasterDisplays[index] = display;

  return group;
}

/**
 * Creates a blaster display with hologram shader effect.
 * PERFORMANCE: Uses a single ShaderMaterial instead of 8 scan line meshes.
 * This reduces draw calls from 16 (8 lines × 2 displays) to just 2 shader draws.
 * 
 * The hologram shader provides:
 * - Animated scan lines (computed in fragment shader, no mesh animation)
 * - Fresnel edge glow (view-dependent rim lighting)
 * - Subtle flicker/glitch effects
 * 
 * Text sprites are cached and only rebuilt when weapon/upgrades change.
 */
// [CORE] Create blaster HUD display on controller
function createBlasterDisplay(controllerIndex) {
  const group = new THREE.Group();
  const hand = getHandForController(controllerIndex);
  group.name = `blaster-display-group-${hand}`;

  // ═══════════════════════════════════════════════════════════════
  // HOLOGRAM SHADER - Single draw call replaces 8 scan line meshes
  // ═══════════════════════════════════════════════════════════════
  
  const holoVertexShader = `
    varying vec2 vUv;

    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `;

  const holoFragmentShader = `
    uniform float uTime;
    uniform vec3 uColor;
    uniform float uOpacity;

    varying vec2 vUv;

    void main() {
      vec2 uv = vUv;

      // Edge glow: bright at edges, dark at center
      float distX = abs(uv.x - 0.5) * 2.0;
      float distY = abs(uv.y - 0.5) * 2.0;
      float edge = max(distX, distY);
      float glow = smoothstep(0.0, 1.0, edge);

      // Core color: bright cyan at edges, dark blue at center
      vec3 edgeColor = uColor;
      vec3 coreColor = uColor * 0.2;
      vec3 color = mix(coreColor, edgeColor, glow);

      // Animated scanlines scrolling downward
      float scanline = sin(uv.y * 80.0 + uTime * 2.0) * 0.5 + 0.5;
      scanline = smoothstep(0.3, 0.7, scanline);
      color += uColor * scanline * 0.15;

      // Opacity: mostly transparent at center, more visible at edges
      float alpha = glow * 0.6 + 0.05;

      gl_FragColor = vec4(color, alpha * uOpacity);
    }
  `;

  const holoMaterial = new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0.0 },
      uColor: { value: new THREE.Vector3(0.0, 0.84, 1.0) },
      uOpacity: { value: 0.45 }
    },
    vertexShader: holoVertexShader,
    fragmentShader: holoFragmentShader,
    transparent: true,
    side: THREE.DoubleSide,
    depthWrite: false,
    blending: THREE.NormalBlending
  });

  // Single plane with hologram shader replaces 8 scan line meshes
  const holoGeo = new THREE.PlaneGeometry(0.21, 0.26);
  const holoPlane = new THREE.Mesh(holoGeo, holoMaterial);
  holoPlane.position.z = 0.003;  // Behind text but in front of border
  holoPlane.renderOrder = 500;   // Render before text (text is default order)
  group.add(holoPlane);

  // Store material reference for animation (uTime updates in render loop)
  group.userData.holoMaterial = holoMaterial;

  // Subtle border outline (kept for visual definition)
  const borderPanelGeo = new THREE.PlaneGeometry(0.2, 0.25);
  const borderGeo = new THREE.EdgesGeometry(borderPanelGeo);
  const borderMat = new THREE.LineBasicMaterial({ color: 0x00ffff, transparent: true, opacity: 0.3 });
  const border = new THREE.LineSegments(borderGeo, borderMat);
  border.position.z = 0.001;
  group.add(border);

  // Position above controller
  group.position.set(0, 0.15, -0.05);
  group.rotation.x = -Math.PI / 4;  // Tilt toward user

  // Initialize caching metadata for text sprites
  group.userData.hand = hand;
  group.userData.needsUpdate = true;
  group.userData.lastRenderedHash = null;  // Hash of weapon+upgrades for dirty checking

  return group;
}

/**
 * Updates blaster display text - CACHED to avoid per-frame Canvas recreation.
 * 
 * PERFORMANCE: Only recreates text sprites when weapon/upgrades actually change.
 * Uses a hash of current stats to detect changes, eliminating the per-frame
 * Canvas texture creation that was causing GC pressure and FPS drops.
 * 
 * The hologram shader animation (scan lines, glow) is handled separately by
 * updating the uTime uniform in the render loop - no texture updates needed.
 */
// [CORE] Update blaster display text and ammo
function updateBlasterDisplay(display, controllerIndex) {
  if (!display || !display.visible) return;

  const hand = getHandForController(controllerIndex);
  display.userData.hand = hand;
  const stats = game.handStats[hand];
  const upgrades = game.upgrades[hand];

  // Compute hash of current data for dirty checking
  const upgradeCount = Object.values(upgrades).reduce((sum, count) => sum + count, 0);
  const currentHash = `${hand}|${stats.kills}|${Math.round(stats.totalDamage)}|${upgradeCount}`;

  // Skip text rebuild if data hasn't changed (cache hit)
  if (display.userData.lastRenderedHash === currentHash) {
    display.userData.needsUpdate = false;
    return;
  }

  // Data changed - rebuild text sprites (cache miss)
  display.userData.lastRenderedHash = currentHash;

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

    ctx.font = `bold ${size}px ${novemberFontFamily}`;
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
  display.add(makeText(`UPGRADES: ${upgradeCount}`, -0.08, 16));

  display.userData.needsUpdate = false;
}

// ============================================================
//  INPUT HANDLING
// ============================================================
// Scoreboard flow context
var scoreboardFromGameOver = false;  // true = came from game over, false = came from title

// [CORE] Handle VR/desktop controller trigger press
function onTriggerPress(controller, index) {
  const st = game.state;

  if (st === State.TITLE) {
    if (isSettingsVisible()) {
      handleSettingsTrigger(controller);
    } else {
      handleTitleTrigger(controller);
    }
  } else if (st === State.PLAYING) {
    fireMainWeapon(controller, index);  // Changed from shootWeapon
  } else if (st === State.UPGRADE_SELECT) {
    selectUpgrade(controller, index);
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
  } else if (st === State.PAUSED) {
    if (isSettingsVisible()) {
      handleSettingsTrigger(controller);
    } else {
      handlePauseTrigger(controller);
    }
  }
}

function handlePauseTrigger(controller) {
  const origin = new THREE.Vector3();
  const quat = new THREE.Quaternion();
  controller.getWorldPosition(origin);
  controller.getWorldQuaternion(quat);
  const direction = new THREE.Vector3(0, 0, -1).applyQuaternion(quat);
  _uiRaycaster.set(origin, direction, 0, 20);

  // Require an explicit pause-menu button hit so desktop and VR share the same resume path.
  let pauseHit = getPauseMenuHit(_uiRaycaster);
  // Fallback: use hover cache when raycast misses
  if (!pauseHit) {
    const idx = getControllerIndex(controller);
    const hover = getHoveredAction(idx >= 0 ? `controller-${idx}` : 'controller');
    if (hover && (hover.action === 'resume' || hover.action === 'settings')) pauseHit = hover.action;
  }
  if (pauseHit === 'resume') {
    playMenuClick();
    startPauseCountdown();
  } else if (pauseHit === 'settings') {
    playMenuClick();
    showSettings('pause');
  }
}

function handleSettingsTrigger(controller) {
  const origin = new THREE.Vector3();
  const quat = new THREE.Quaternion();
  controller.getWorldPosition(origin);
  controller.getWorldQuaternion(quat);
  const direction = new THREE.Vector3(0, 0, -1).applyQuaternion(quat);
  _uiRaycaster.set(origin, direction, 0, 20);

  let action = getSettingsHit(_uiRaycaster);
  // Fallback: use hover cache when raycast misses
  if (!action) {
    const idx = getControllerIndex(controller);
    const hover = getHoveredAction(idx >= 0 ? `controller-${idx}` : 'controller');
    if (hover && hover.userData && hover.userData.isSettingsBtn) action = hover.userData.settingsAction;
  }
  if (!action) return;

  const shouldClose = executeSettingsAction(action);
  if (shouldClose) {
    hideSettings();
  }
}

function handleTitleTrigger(controller) {
  const origin = new THREE.Vector3();
  const quat = new THREE.Quaternion();
  controller.getWorldPosition(origin);
  controller.getWorldQuaternion(quat);
  const direction = new THREE.Vector3(0, 0, -1).applyQuaternion(quat);
  _uiRaycaster.set(origin, direction, 0, 20);

  let btnHit = getTitleButtonHit(_uiRaycaster);
  // Fallback: use hover cache when raycast misses
  if (!btnHit) {
    const idx = getControllerIndex(controller);
    const hover = getHoveredAction(idx >= 0 ? `controller-${idx}` : 'controller');
    if (hover && (hover.action === 'scoreboard' || hover.action === 'settings' || hover.action === 'diagnostics')) btnHit = hover.action;
  }
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
  if (btnHit === 'settings') {
    playMenuClick();
    showSettings('title');
    return;
  }
  playMenuClick();
  startGame();
}

// ── Desktop Controls Handlers ───────────────────────────────
// [DEBUG] Desktop mouse click handlers for non-VR playtesting
function handleDesktopClick() {
  if (!isDesktopEnabled()) return;

  const st = game.state;

  if (st === State.TITLE) {
    if (isSettingsVisible()) {
      handleDesktopSettingsClick();
    } else {
      handleDesktopTitleClick();
    }
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
  } else if (st === State.PAUSED) {
    if (isSettingsVisible()) {
      handleDesktopSettingsClick();
    } else {
      handleDesktopPauseClick();
    }
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

  let btnHit = getTitleButtonHit(raycaster);
  if (!btnHit) {
    const hover = getHoveredAction('desktop');
    if (hover && (hover.action === 'scoreboard' || hover.action === 'settings' || hover.action === 'diagnostics')) btnHit = hover.action;
  }
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
  if (btnHit === 'settings') {
    playMenuClick();
    showSettings('title');
    return;
  }
  playMenuClick();
  startGame();
}

function handleDesktopGameOverClick() {
  // Skip scoreboard if score is zero
  if (game.score <= 0) {
    hideGameOver();
    resetGame();
    showTitle();
    return;
  }

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
    playNoOneMakesItSound();
  }
}

function handleDesktopNameEntryClick() {
  const raycaster = getAimRaycaster();
  if (!raycaster) return;

  let result = getNameEntryHit(raycaster);
  if (!result) {
    const hover = getHoveredAction('desktop');
    if (hover) {
      if (hover.userData.nameEntryAction) {
        result = { action: hover.userData.nameEntryAction };
        if (hover.userData.nameEntryAction === 'submit') {
          result.name = getNameEntryName();
        }
      } else if (hover.userData.isKeyboardKey && hover.userData.keyValue) {
        result = processKeyPress(hover.userData.keyValue);
      }
    }
  }
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
      _log('[scoreboard] Name rejected by profanity filter');
      return;
    }
    setStoredName(name);
    hideNameEntry();

    // Submit score and show scoreboard
    game.state = State.SCOREBOARD;
    showScoreboard([], 'SUBMITTING...');
    const country = getStoredCountry() || '';
    let submittedAt = null;
    submitScore(name, game.finalScore, game.finalLevel, country).then((data) => {
      if (data && data[0] && data[0].created_at) {
        submittedAt = data[0].created_at;
        setLastSubmittedTimestamp(submittedAt);
      }
      return new Promise(resolve => setTimeout(resolve, 500));
    }).then(() => {
      return fetchTopScores();
    }).then(scores => {
      if (submittedAt) {
        const idx = scores.findIndex(s => s.created_at === submittedAt);
        if (idx >= 0) {
          setLastSubmittedPageIndex(Math.floor(idx / 10));
        }
      }
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

  let action = getScoreboardHit(raycaster);
  if (!action) {
    const hover = getHoveredAction('desktop');
    if (hover && hover.userData.scoreboardAction) action = hover.userData.scoreboardAction;
  }
  if (action === 'back') {
    playMenuClick();
    hideScoreboard();
    resetGame();
    showTitle();
    return;
  }
  if (action === 'country') {
    playMenuClick();  // #7: Activate sound for COUNTRY
    scoreboardFromGameOver = false;
    game.state = State.COUNTRY_SELECT;
    hideScoreboard();
    showCountrySelect(COUNTRIES, CONTINENTS, 'North America');
    return;
  }
  if (action === 'continent') {
    playMenuClick();  // #7: Activate sound for CONTINENT
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

  let result = getCountrySelectHit(raycaster, COUNTRIES);
  if (!result) {
    const hover = getHoveredAction('desktop');
    if (hover) {
      if (hover.userData.countryCode) {
        result = { action: 'select', code: hover.userData.countryCode };
      } else if (hover.userData.continentTab) {
        result = { action: 'select_continent', continent: hover.userData.continentTab };
      } else if (hover.userData.countryAction === 'back') {
        result = { action: 'back' };
      }
    }
  }
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
  raycaster._hudSourceKey = 'desktop';

  // Desktop and VR should share the same "hovered card" fallback so local
  // playtesting catches the same interaction regressions players would feel in-headset.
  const result = getUpgradeCardHit(raycaster) || getHoveredUpgradeCardHit('desktop');
  if (result) {
    selectUpgradeAndAdvance(result.upgrade, result.hand);
  }
}

function handleDesktopReadyScreenClick() {
  if (readyCountdownActive) return;
  playMenuClick();
  startReadyCountdown();
}

function handleDesktopPauseClick() {
  const raycaster = getAimRaycaster();
  // Match VR behavior: desktop pause only resumes when the button is actually selected.
  let pauseHit = getPauseMenuHit(raycaster);
  if (!pauseHit) {
    const hover = getHoveredAction('desktop');
    if (hover && (hover.action === 'resume' || hover.action === 'settings')) pauseHit = hover.action;
  }
  if (pauseHit === 'resume') {
    playMenuClick();
    startPauseCountdown();
  } else if (pauseHit === 'settings') {
    playMenuClick();
    showSettings('pause');
  }
}

function handleDesktopSettingsClick() {
  const raycaster = getAimRaycaster();
  if (!raycaster) return;

  let action = getSettingsHit(raycaster);
  if (!action) {
    const hover = getHoveredAction('desktop');
    if (hover && hover.userData && hover.userData.isSettingsBtn) action = hover.userData.settingsAction;
  }
  if (!action) return;

  const shouldClose = executeSettingsAction(action);
  if (shouldClose) {
    hideSettings();
  }
}

// [DEBUG] Desktop click handler for debug menu (REMOVED — 3D debug menu deleted)

// [CORE] Handle game over screen VR trigger
function handleGameOverTrigger(controller) {
  // Skip scoreboard if score is zero
  if (game.score <= 0) {
    hideGameOver();
    resetGame();
    showTitle();
    return;
  }

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
    playNoOneMakesItSound();
  }
}

// [CORE] Handle name entry VR trigger
function handleNameEntryTrigger(controller) {
  const origin = new THREE.Vector3();
  const quat = new THREE.Quaternion();
  controller.getWorldPosition(origin);
  controller.getWorldQuaternion(quat);
  const direction = new THREE.Vector3(0, 0, -1).applyQuaternion(quat);
  _uiRaycaster.set(origin, direction, 0, 10);

  let result = getNameEntryHit(_uiRaycaster);
  // Fallback: use hover cache when raycast misses
  if (!result) {
    const idx = getControllerIndex(controller);
    const hover = getHoveredAction(idx >= 0 ? `controller-${idx}` : 'controller');
    if (hover) {
      if (hover.userData.nameEntryAction) {
        result = { action: hover.userData.nameEntryAction };
        if (hover.userData.nameEntryAction === 'submit') {
          result.name = getNameEntryName();
        }
      } else if (hover.userData.isKeyboardKey && hover.userData.keyValue) {
        result = processKeyPress(hover.userData.keyValue);
      }
    }
  }
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
      _log('[scoreboard] Name rejected by profanity filter');
      return;
    }
    setStoredName(name);
    hideNameEntry();

    // Submit score and show scoreboard
    game.state = State.SCOREBOARD;
    showScoreboard([], 'SUBMITTING...');
    const country = getStoredCountry() || '';
    let submittedAt = null;
    submitScore(name, game.finalScore, game.finalLevel, country).then((data) => {
      if (data && data[0] && data[0].created_at) {
        submittedAt = data[0].created_at;
        setLastSubmittedTimestamp(submittedAt);
      }
      // Small artificial delay to ensure DB indexing is finished for consistent read-after-write
      return new Promise(resolve => setTimeout(resolve, 500));
    }).then(() => {
      return fetchTopScores();
    }).then(scores => {
      if (submittedAt) {
        const idx = scores.findIndex(s => s.created_at === submittedAt);
        if (idx >= 0) {
          setLastSubmittedPageIndex(Math.floor(idx / 10));
        }
      }
      showScoreboard(scores, 'GLOBAL');
    }).catch(err => {
      console.error('[scoreboard] Detailed error in submission flow:', err);
      showScoreboard([], 'ERROR SUBMITTING SCORE');
    });
  }
}

// [CORE] Handle scoreboard VR trigger
function handleScoreboardTrigger(controller) {
  const origin = new THREE.Vector3();
  const quat = new THREE.Quaternion();
  controller.getWorldPosition(origin);
  controller.getWorldQuaternion(quat);
  const direction = new THREE.Vector3(0, 0, -1).applyQuaternion(quat);
  _uiRaycaster.set(origin, direction, 0, 20);

  let action = getScoreboardHit(_uiRaycaster);
  // Fallback: use hover cache when raycast misses
  if (!action) {
    const idx = getControllerIndex(controller);
    const hover = getHoveredAction(idx >= 0 ? `controller-${idx}` : 'controller');
    if (hover && hover.userData.scoreboardAction) action = hover.userData.scoreboardAction;
  }
  if (action === 'back') {
    playMenuClick();  // #7: Activate sound for BACK
    hideScoreboard();
    resetGame();
    showTitle();
    return;
  }
  if (action === 'country') {
    playMenuClick();  // #7: Activate sound for COUNTRY
    // Show country select for filtering
    scoreboardFromGameOver = false;
    game.state = State.COUNTRY_SELECT;
    hideScoreboard();
    showCountrySelect(COUNTRIES, CONTINENTS, 'North America');
    return;
  }
  if (action === 'continent') {
    playMenuClick();  // #7: Activate sound for CONTINENT
    // Show continent picker
    scoreboardFromGameOver = false;
    game.state = State.COUNTRY_SELECT;
    hideScoreboard();
    showCountrySelect(COUNTRIES, CONTINENTS, 'North America', null, 'continent');
    return;
  }
}

// [CORE] Handle country select VR trigger
function handleCountrySelectTrigger(controller) {
  const origin = new THREE.Vector3();
  const quat = new THREE.Quaternion();
  controller.getWorldPosition(origin);
  controller.getWorldQuaternion(quat);
  const direction = new THREE.Vector3(0, 0, -1).applyQuaternion(quat);
  _uiRaycaster.set(origin, direction, 0, 10);

  let result = getCountrySelectHit(_uiRaycaster, COUNTRIES);
  // Fallback: use hover cache when raycast misses
  if (!result) {
    const idx = getControllerIndex(controller);
    const hover = getHoveredAction(idx >= 0 ? `controller-${idx}` : 'controller');
    if (hover) {
      if (hover.userData.countryCode) {
        result = { action: 'select', code: hover.userData.countryCode };
      } else if (hover.userData.continentTab) {
        result = { action: 'select_continent', continent: hover.userData.continentTab };
      } else if (hover.userData.countryAction === 'back') {
        result = { action: 'back' };
      }
    }
  }
  if (!result) return;

  if (result.action === 'back') {
    playMenuClick();  // #7: Activate sound for BACK
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

// [CORE] Handle trigger release (stop firing)
function onTriggerRelease(index) {
  // Charge shot: fire beam on release
  if (chargeShotStartTime[index] !== null) {
    const hand = getHandForController(index);
    const stats = getWeaponStats(game.mainWeapon[hand], game.upgrades[hand]);
    if (stats.chargeShot) {
      const chargeTimeSec = (performance.now() - chargeShotStartTime[index]) / 1000;
      fireChargeBeam(controllers[index], index, chargeTimeSec, stats);
    }
    // Clean up charge sound and visuals
    stopChargeSound(index);
    hideChargeVisuals(index);
    if (controllers[index]) controllers[index].userData.chargeReadySoundPlayed = false;
    chargeShotStartTime[index] = null;
  }
  // Stop lightning beam when trigger released (dispose to prevent GEO leak)
  if (lightningBeams[index]) {
    clearLightningBeam(index);
    pauseLightningSound();
  }
}

// ============================================================
//  NUKE — ALT-FIRE SCREEN CLEAR
//  Instantly kills all non-boss enemies. Both controllers trigger it.
//  Cooldown: 0.5s between activations to prevent double-fire.
// ============================================================
let lastNukeTime = 0;
const NUKE_COOLDOWN = 500;

// [CORE] Nuke activation: kill all enemies
function activateNuke() {
  if (game.state !== State.PLAYING) return false;
  if (!game.nukes || game.nukes <= 0) return false;

  const now = performance.now();
  if (now - lastNukeTime < NUKE_COOLDOWN) return false;
  lastNukeTime = now;

  // Consume nuke
  game.nukes--;
  game.runStats.nukesUsed++;

  // White flash
  if (nukeFlash) {
    nukeFlash.material.opacity = 1.0;
    nukeFlashTimer = now;
  }

  // Kill all non-boss enemies
  const enemies = getEnemies();
  let killed = 0;
  // Iterate backwards since destroyEnemy splices the array
  for (let i = enemies.length - 1; i >= 0; i--) {
    const e = enemies[i];
    // Bosses survive (mesh.userData.isBoss or isBoss property)
    if (e.mesh && e.mesh.userData && e.mesh.userData.isBoss) continue;
    if (e.isBoss) continue;

    // Set HP to 0 so the death system handles cleanup naturally
    e.hp = 0;
    destroyEnemy(i, false, true); // isCritical=false, isOverkill=true (nuke)
    if (!e._bossSummoned) {
      game.kills++;
      trackKill(false);
    }
    addScore(50); // Base score per nuked enemy
    killed++;
  }

  // Destroy all boss projectiles
  const bossProjectiles = getBossProjectiles();
  let projDestroyed = 0;
  for (let i = 0; i < bossProjectiles.length; i++) {
    const bossProj = bossProjectiles[i];
    if (bossProj) {
      // Trigger destruction VFX and release the instance
      spawnBossProjectileDestructionFX(bossProj.position.clone(), 0xff0000);
      // Release the projectile instance
      if (bossProj._instIdx !== undefined) {
        releaseBossProjIndex(bossProj._instIdx);
      }
      projDestroyed++;
    }
  }
  // Clear the boss projectiles array after destroying all instances
  bossProjectiles.length = 0;

  if (killed > 0) {
    updateHUD(game);

    const cfg = game._levelConfig;
    checkKillsAlert();

    if (cfg && !cfg.isBoss && game.kills >= cfg.killTarget) {
      completeLevel();
    }
  }

  _log(`[nuke] Activated! Killed ${killed} enemies. ${game.nukes} remaining.`);
  return true;
}

// ============================================================
// ALT WEAPON SYSTEMS
// Shield, laser mines, decoys, black holes, tethers, nanites,
// phase dash, reflector drones, stasis, plasma orbs, grenades,
// proximity mines, attack drones, EMP, teleport
// COUPLING: Updates scene, activeShields/activeLaserMines/etc arrays
// ============================================================
// [CORE] Handle squeeze press (alt weapon fire)
function onSqueezePress(controller, index) {
  const st = game.state;
  
  if (st === State.PLAYING) {
    // Nuke takes priority: if player has nukes, squeeze activates nuke
    if (game.nukes > 0) {
      if (activateNuke()) return;
    }
    fireAltWeapon(controller, index);
  }
}

// [CORE] Handle squeeze release
function onSqueezeRelease(index) {
  // Currently no release logic needed for ALT weapons
  // Could add charge-up ALT weapons in future
}

// ============================================================
//  ALT WEAPON FIRING
// ============================================================
// [CORE] Fire alt weapon based on type dispatch
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
  _log(`[ALT weapon] Firing ${altWeaponId} from ${hand} hand`);
  
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
// [CORE] Shield weapon system
function fireShield(controller, index, hand, altWeapon) {
  // Get player camera position (shield surrounds player)
  const playerPos = camera.position.clone();
  
  // Create blue translucent sphere around player
  const shieldGeo = new THREE.SphereGeometry(1.2, 24, 24);
  shieldGeo.name = 'shield-sphere';
  const shieldMat = basicMat(0x4488ff, {
    transparent: true,
    opacity: 0.4,
    side: THREE.DoubleSide,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  const shieldMesh = new THREE.Mesh(shieldGeo, shieldMat);
    shieldMesh.name = 'shield-energy';
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
  
  _log(`[Shield] Activated for ${altWeapon.duration / 1000}s at ${hand} hand`);
  playShoothSound();
}

// [CORE] Update active shields
function updateShields(now) {
  for (let i = activeShields.length - 1; i >= 0; i--) {
    const shield = activeShields[i];
    
    // Check if expired
    if (now >= shield.expiresAt) {
      disposeMesh(shield.mesh);
      activeShields.splice(i, 1);
      _log('[Shield] Expired');
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

// ============================================================
//  LASER MINE ALT WEAPON (PASSIVE)
// ============================================================

/**
 * Spawn laser mines around player when standing still for 2+ seconds
 * This is called from the update loop, not from trigger press
 */
// [CORE] Laser mine passive spawning
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

        _log(`[Laser Mine] Spawned ${mineCount} passive mines around player`);
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
      disposeMesh(oldest.mesh);
    }
    if (oldest.glowMesh) {
      disposeMesh(oldest.glowMesh);
    }
    if (oldest.laserMesh) {
      disposeMesh(oldest.laserMesh);
    }
    const idx = activeLaserMines.indexOf(oldest);
    if (idx >= 0) activeLaserMines.splice(idx, 1);
  }

  // Create purple icosahedron mine
  const mineGeo = new THREE.IcosahedronGeometry(0.12, 0);
  const mineMat = basicMat(0xaa00ff, {
    transparent: true,
    opacity: 0.9,
  });
  const mineMesh = new THREE.Mesh(mineGeo, mineMat);
  mineMesh.position.copy(position);
  mineMesh.renderOrder = 400;
  scene.add(mineMesh);

  // Add outer glow sphere
  const glowGeo = new THREE.SphereGeometry(0.2, 12, 12);
  const glowMat = basicMat(0xaa00ff, {
    transparent: true,
    opacity: 0.3,
    side: THREE.BackSide,
  });
  const glowMesh = new THREE.Mesh(glowGeo, glowMat);
  glowMesh.name = 'laser-mine-glow';
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
// [CORE] Fire laser mine alt weapon
function fireLaserMine(controller, index, hand, altWeapon) {
  // Laser mines are now passive - no trigger-based firing
  _log('[Laser Mine] Passive weapon - use spawnLaserMinesPassively()');
}

// [CORE] Update laser mines (arming, targeting, detonating)
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
      _log('[Laser Mine] Armed');
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
        disposeMesh(mine.laserMesh);
        mine.laserMesh = null;
      }
      // Remove mine visuals
      if (mine.mesh) {
        disposeMesh(mine.mesh);
      }
      if (mine.glowMesh) {
        disposeMesh(mine.glowMesh);
      }
      activeLaserMines.splice(i, 1);
      _log('[Laser Mine] Cleaned up');
    }
  }
}

// [CORE] Trigger laser mine explosion
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
          _log(`[Laser Mine] Hit enemy for ${mine.damage} damage`);
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

// [CORE] Decoy weapon system
function fireDecoy(origin, hand, altWeapon) {
  // Limit active decoys
  if (activeDecoys.length >= MAX_DECOYS) {
    // Remove oldest decoy
    const oldest = activeDecoys.shift();
    destroyDecoy(oldest, false);
  }

  _log(`[ALT] Decoy deployed at ${origin.x.toFixed(2)}, ${origin.y.toFixed(2)}, ${origin.z.toFixed(2)}`);

  // Create holographic copy of player (simple sphere for now)
  const decoyGroup = new THREE.Group();

  // Body - glitchy semi-transparent sphere
  const bodyGeo = new THREE.SphereGeometry(0.4, 12, 12);
  const bodyMat = basicMat(0x00ffaa, {
    transparent: true,
    opacity: 0.6,
    wireframe: true,
  });
  const body = new THREE.Mesh(bodyGeo, bodyMat);
    body.name = 'decoy-body';
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
  const glowMat = basicMat(0x00ffaa, {
    transparent: true,
    opacity: 0.2,
    side: THREE.BackSide,
  });
  const glow = new THREE.Mesh(glowGeo, glowMat);
  decoyGroup.add(glow);
    glow.name = 'decoy-glow';

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

// [CORE] Update decoy targets and animations
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

// [CORE] Destroy decoy with optional explosion
function destroyDecoy(decoy, explode) {
  if (explode) {
    // Calculate explosion damage based on enemies targeting it
    const targetCount = decoy.targetingEnemies.size;
    const totalDamage = decoy.explosionDamage + (targetCount * decoy.explosionDamagePerTarget);

    _log(`[Decoy] Destroyed! Targets: ${targetCount}, Total damage: ${totalDamage}`);

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

        handleEnemyKilled(idx);
      }
    });

    // Visual explosion
    spawnExplosionVisual(decoy.position, 2);
    triggerScreenShake(0.2, 200);
  }

  // Clean up mesh
  disposeMesh(decoy.mesh);
}

// ============================================================
//  BLACK HOLE (SINGULARITY MINE) IMPLEMENTATION
// ============================================================

// [CORE] Black hole weapon system
function fireBlackHole(origin, direction, hand, altWeapon) {
  // Limit active mines
  if (activeMines.length >= MAX_MINES) {
    // Remove oldest mine
    const oldest = activeMines.shift();
    disposeMesh(oldest.mesh);
  }

  _log(`[ALT] Black hole mine thrown from ${hand} hand`);

  // Create mine projectile
  const mineGeo = new THREE.SphereGeometry(0.15, 8, 8);
  const mineMat = basicMat(0x8800ff, {
    transparent: true,
    opacity: 0.9,
  });
  const mine = new THREE.Mesh(mineGeo, mineMat);
    mine.name = 'black-hole-mine';

  // Add glow
  const glowGeo = new THREE.SphereGeometry(0.25, 8, 8);
  const glowMat = basicMat(0x8800ff, {
    transparent: true,
    opacity: 0.3,
    side: THREE.BackSide,
  });
  const glow = new THREE.Mesh(glowGeo, glowMat);
  glow.name = 'black-hole-mine';
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

// Pooled temp vector for black hole pull (per-enemy per-frame)
const _bhPullToCenter = new THREE.Vector3();

// [CORE] Update mines and black holes
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
      _log('[Mine] Armed!');
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
        _bhPullToCenter.subVectors(bh.position, e.mesh.position).normalize();
        e.mesh.position.addScaledVector(_bhPullToCenter, pullStrength * dt);

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

        handleEnemyKilled(index);
      });
    }
  }
}

// [CORE] Trigger black hole collapse
function triggerBlackHole(mine, mineIndex) {
  _log('[Black Hole] Triggered!');

  // Remove mine
  disposeMesh(mine.mesh);
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
  coreGeo.name = 'black-hole-core-geo';
  const coreMat = basicMat(0x110022, {
    transparent: true,
    opacity: 0.9,
  });
  const core = new THREE.Mesh(coreGeo, coreMat);
  core.name = 'black-hole-core';
  bhGroup.add(core);

  // Outer ring - purple vortex
  const ringGeo = new THREE.RingGeometry(0.4, 1.5, 32);
  const ringMat = basicMat(0x8800ff, {
    transparent: true,
    opacity: 0.6,
    side: THREE.DoubleSide,
  });
  const ring = new THREE.Mesh(ringGeo, ringMat);
  ring.name = 'black-hole-core';
  ring.rotation.x = Math.PI / 2;
  bhGroup.add(ring);

  // Inner spinning ring
  const innerRingGeo = new THREE.RingGeometry(0.3, 0.5, 16);
  const innerRingMat = basicMat(0xaa44ff, {
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
  const glowMat = basicMat(0x4400aa, {
    transparent: true,
    opacity: 0.3,
    side: THREE.BackSide,
  });
  const glow = new THREE.Mesh(glowGeo, glowMat);
  glow.name = 'black-hole-mine-glow';
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

// [CORE] Destroy black hole and cleanup
function destroyBlackHole(bh) {
  _log('[Black Hole] Collapsed!');

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
  // Clean up mesh
  disposeMesh(bh.mesh);
}

// ============================================================
//  NANITE SWARM IMPLEMENTATION
// ============================================================

// [CORE] Nanite swarm weapon system
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
      _log('[Nanite Swarm] Recalled early from', hand, 'hand');
    } else {
      // Remove oldest swarm
      const oldest = activeNaniteSwarms.shift();
      destroyNaniteSwarm(oldest);
    }
  }

  _log(`[ALT] Nanite Swarm deployed from ${hand} hand`);

  // Create golden shimmering cloud at player position
  const swarmGroup = new THREE.Group();

  // Core sphere - golden glow
  const coreGeo = new THREE.SphereGeometry(0.2, 12, 12);
  const coreMat = basicMat(0xffd700, {
    transparent: true,
    opacity: 0.4,
    blending: THREE.AdditiveBlending,
  });
  const core = new THREE.Mesh(coreGeo, coreMat);
  core.name = 'nanite-swarm-core';
  swarmGroup.add(core);

  // Outer glow sphere
  const glowGeo = new THREE.SphereGeometry(altWeapon.radius || 3.0, 24, 24);
  const glowMat = basicMat(0xffaa00, {
    transparent: true,
    opacity: 0.15,
    side: THREE.BackSide,
    blending: THREE.AdditiveBlending,
  });
  const glow = new THREE.Mesh(glowGeo, glowMat);
  glow.name = 'nanite-swarm-core';
  swarmGroup.add(glow);

  // Glitter particles - golden sparkles
  const particleCount = 80;
  const particles = [];
  for (let i = 0; i < particleCount; i++) {
    const particleGeo = new THREE.SphereGeometry(0.03, 4, 4);
    const particleMat = basicMat(0xffff00, {
      transparent: true,
      opacity: 0.8,
      blending: THREE.AdditiveBlending,
    });
    const particle = new THREE.Mesh(particleGeo, particleMat);
    particle.name = 'nanite-swarm-particle';

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

// [CORE] Update nanite swarms
function updateNaniteSwarms(now, dt, playerPos) {
  for (let i = activeNaniteSwarms.length - 1; i >= 0; i--) {
    const swarm = activeNaniteSwarms[i];
    const age = now - swarm.createdAt;

    // Check if expired
    if (age >= swarm.duration) {
      destroyNaniteSwarm(swarm);
      activeNaniteSwarms.splice(i, 1);
      _log('[Nanite Swarm] Expired');
      continue;
    }

    // Animate particles - swirling glitter effect
    // GPU optimization: update twinkle opacity every 3 frames instead of every frame
    const twinkleFrame = Math.floor(now / 50) % 3 === 0;
    swarm.particles.forEach(p => {
      // Update angle for rotation
      p.angle += p.speed * dt;
      p.phi += p.verticalSpeed * dt * 0.1;

      // Calculate new position
      p.mesh.position.x = p.radius * Math.sin(p.phi) * Math.cos(p.angle);
      p.mesh.position.y = p.radius * Math.sin(p.phi) * Math.sin(p.angle);
      p.mesh.position.z = p.radius * Math.cos(p.phi);

      // Twinkle effect - GPU optimization: throttle to every 3rd frame (~20fps twinkle)
      if (twinkleFrame) {
        p.mesh.material.opacity = 0.3 + Math.sin(now * 0.01 + p.angle) * 0.5;
      }
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
              setMaterialEmissiveSafe(e.mesh.material, new THREE.Color(0xffd700), 0.5);
            }
          }

          // Track affected enemy
          if (!swarm.affectedEnemies.has(index)) {
            swarm.affectedEnemies.add(index);
          }

          // Check if killed by DoT
          handleEnemyKilled(index);
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
          setMaterialEmissiveSafe(e.mesh.material, new THREE.Color(0xffd700), 0.5);
        }
      }
    });
  }
}

// [CORE] Destroy nanite swarm
function destroyNaniteSwarm(swarm) {
  _log('[Nanite Swarm] Destroyed');

  // Clear reveal effect from enemies
  const enemies = getEnemies();
  enemies.forEach(e => {
    if (e._naniteRevealed) {
      e._naniteRevealed = false;
      if (e.mesh.material) {
        setMaterialEmissiveSafe(e.mesh.material, new THREE.Color(0x000000), 0);
      }
    }
  });

  // Remove mesh
  disposeMesh(swarm.mesh);
}

// Check if projectile passes through nanite swarm and add damage
// [CORE] Check projectile-nanite interaction
function checkProjectileNaniteInteraction(proj) {
  for (const swarm of activeNaniteSwarms) {
    if (proj.position.distanceToSquared(swarm.position) < swarm.radius * swarm.radius && !proj.userData.naniteInfused) {
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

// [CORE] Tether harpoon weapon system
function fireTetherHarpoon(origin, direction, hand, altWeapon) {
  // Raycast to find enemy within range
  _uiRaycaster.set(origin, direction, 0, altWeapon.range);
  const enemyMeshes = getEnemyMeshes(true);
  const hits = _uiRaycaster.intersectObjects(enemyMeshes, true);

  if (hits.length === 0) {
    _log('[Tether Harpoon] No target in range');
    return;  // No target
  }

  // Find the enemy from the hit mesh
  const result = getEnemyByMesh(hits[0].object);
  if (!result || result.index === undefined) {
    _log('[Tether Harpoon] Hit but no enemy found');
    return;
  }

  const enemy = result.enemy;
  const enemyIndex = result.index;

  // Check if this enemy is already tethered
  const alreadyTethered = activeTethers.some(t => t.enemyIndex === enemyIndex);
  if (alreadyTethered) {
    _log('[Tether Harpoon] Enemy already tethered');
    return;
  }

  // Limit active tethers
  if (activeTethers.length >= MAX_TETHERS) {
    const oldest = activeTethers.shift();
    destroyTether(oldest);
  }

  _log(`[Tether Harpoon] Connected to enemy ${enemyIndex}!`);

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
    const particleMat = basicMat(0x00ffaa, {
      transparent: true,
      opacity: 0.7,
    });
    const particle = new THREE.Mesh(particleGeo, particleMat);
    particle.name = 'tether-particle';
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

// [CORE] Update active tethers
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
            handleEnemyKilled(tether.enemyIndex);
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

// [CORE] Destroy tether and cleanup
function destroyTether(tether) {
  disposeMesh(tether.mesh);
  _log('[Tether Harpoon] Tether destroyed');
}

// ============================================================
//  PHASE DASH
// ============================================================

/**
 * Fire Phase Dash - instant teleport in movement direction
 * Leaves explosive afterimage that detonates after 1 second
 * Damages enemies in dash path
 */
// [CORE] Phase dash weapon system
function firePhaseDash(controller, index, hand, altWeapon, origin, direction) {
  _log(`[Phase Dash] Teleporting ${hand} hand`);

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

  // Teleport player (desktop only - in VR, WebXR controls camera position)
  if (!renderer.xr.isPresenting) {
    camera.position.copy(destination);
    _log(`[Phase Dash] Teleported from (${oldPosition.x.toFixed(2)}, ${oldPosition.y.toFixed(2)}, ${oldPosition.z.toFixed(2)}) to (${destination.x.toFixed(2)}, ${destination.y.toFixed(2)}, ${destination.z.toFixed(2)})`);
  } else {
    _log(`[Phase Dash] VR mode - teleport visual only (WebXR controls camera)`);
  }

  // Create blue ghostly afterimage at old position
  const afterimageGroup = new THREE.Group();

  // Main afterimage shell (semi-transparent sphere)
  const shellGeo = new THREE.SphereGeometry(0.4, 16, 16);
  const shellMat = basicMat(0x4488ff, {
    transparent: true,
    opacity: 0.6,
    side: THREE.DoubleSide,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  const shell = new THREE.Mesh(shellGeo, shellMat);
    shell.name = 'phase-dash-shell';
  afterimageGroup.add(shell);

  // Pixel dissolution effect (small cubes)
  const pixelCount = 20;
  const pixels = [];
  for (let i = 0; i < pixelCount; i++) {
    const pixelGeo = new THREE.BoxGeometry(0.08, 0.08, 0.08);
    const pixelMat = basicMat(0x88ccff, {
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
        _log(`[Phase Dash] Hit enemy for ${dashDamage} damage`);

        handleEnemyKilled(enemyIndex);
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
// [CORE] Update phase dash afterimages
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
      // Detonate - AOE damage using spatial hash
      const enemies = getEnemies();  // Still needed for index lookup
      const nearby = enemySpatialHash.query(afterimage.position.x, afterimage.position.z, afterimage.aoeRadius);
      for (const e of nearby) {
        const enemyIndex = enemies.indexOf(e);
        const dist = e.mesh.position.distanceTo(afterimage.position);
        if (dist < afterimage.aoeRadius) {
          const damageMultiplier = 1 - (dist / afterimage.aoeRadius);
          const damage = Math.round(afterimage.damage * damageMultiplier);
          const result = hitEnemy(enemyIndex, damage);
          spawnDamageNumber(e.mesh.position, damage, '#88ccff');
          _log(`[Phase Dash] Afterimage exploded for ${damage} damage`);

          handleEnemyKilled(enemyIndex);
        }
      }

      // Visual explosion
      spawnExplosionVisual(afterimage.position, afterimage.aoeRadius);
      playExplosionSound();
      triggerScreenShake(0.3, 300);

      // Clean up afterimage
      disposeMesh(afterimage.mesh);
      activePhaseDashAfterimages.splice(i, 1);
      _log('[Phase Dash] Afterimage detonated');
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
// [CORE] Reflector drone weapon system
function fireReflectorDrone(origin, hand, altWeapon) {
  // Limit active drones
  if (activeReflectorDrones.length >= MAX_REFLECTOR_DRONES) {
    // Check if there's already an active drone from this hand - remove it
    const existingIndex = activeReflectorDrones.findIndex(d => d.hand === hand);
    if (existingIndex >= 0) {
      const drone = activeReflectorDrones[existingIndex];
      destroyReflectorDrone(drone);
      activeReflectorDrones.splice(existingIndex, 1);
      _log('[Reflector Drone] Recalled early from', hand, 'hand');
    } else {
      // Remove oldest drone
      const oldest = activeReflectorDrones.shift();
      destroyReflectorDrone(oldest);
    }
  }

  _log(`[ALT] Reflector Drone deployed from ${hand} hand`);
  const pooledVisual = acquireReflectorDroneVisual();
  if (!pooledVisual) return;

  // Position at player location
  const playerPos = camera.position.clone();
  pooledVisual.mesh.position.copy(playerPos);
  pooledVisual.mesh.position.y = 1.2;  // Chest height

  // Drone data
  const drone = {
    poolEntry: pooledVisual,
    mesh: pooledVisual.mesh,
    hexMesh: pooledVisual.hexMesh,
    hexMat: pooledVisual.hexMat,
    coreMat: pooledVisual.coreMat,
    shieldMat: pooledVisual.shieldMat,
    particles: pooledVisual.particles,
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
// [CORE] Update reflector drones
function updateReflectorDrones(now, dt, playerPos) {
  for (let i = activeReflectorDrones.length - 1; i >= 0; i--) {
    const drone = activeReflectorDrones[i];
    const age = now - drone.createdAt;

    // Check if expired
    if (age >= drone.duration || drone.health <= 0) {
      if (drone.health <= 0) {
        _log('[Reflector Drone] Destroyed!');
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
// [CORE] Check reflector drone projectile reflection
function checkReflectorDroneReflection(projPos, isBossProjectile = false) {
  for (const drone of activeReflectorDrones) {
    const dist = projPos.distanceTo(drone.mesh.position);
    if (dist < 0.5) {  // Within drone shield radius
      // Determine reflect chance
      const reflectChance = drone.overcharged ? drone.overchargeReflect : drone.reflectChance;

      if (Math.random() < reflectChance) {
        // Reflect the projectile!
        _log(`[Reflector Drone] Reflected projectile! (${drone.overcharged ? '100%' : '50%'} chance)`);
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
// [CORE] Check player projectile hits drone
function checkPlayerProjectileHitsDrone(projPos, projControllerIndex) {
  for (let i = 0; i < activeReflectorDrones.length; i++) {
    const drone = activeReflectorDrones[i];

    // Don't let the same hand that spawned the drone hit it
    const droneHand = drone.hand;
    const projHand = getHandForController(projControllerIndex);
    if (droneHand === projHand) continue;

    if (projPos.distanceToSquared(drone.mesh.position) < 0.09) {  // 0.3m hit radius
      // Overcharge the drone (100% reflect but takes damage)
      drone.overcharged = true;
      drone.health -= 10;  // 10 damage per shot

      _log(`[Reflector Drone] Overcharged! Health: ${drone.health}/${drone.maxHealth}`);

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
// [CORE] Spawn reflected projectile from drone
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
  const reflectedMat = basicMat(0x00ffcc, {
    transparent: true,
    opacity: 0.9,
  });
  const reflectedProj = new THREE.Mesh(reflectedGeo, reflectedMat);
    reflectedProj.name = 'reflected-projectile';
  reflectedProj.position.copy(origin);
  reflectedProj.userData.velocity = direction.clone().multiplyScalar(30);
  reflectedProj.userData.createdAt = performance.now();
  reflectedProj.userData.lifetime = 2000;
  reflectedProj.userData.damage = 20;
  reflectedProj.userData.isReflected = true;
  scene.add(reflectedProj);
  projectiles.push(reflectedProj);

  _log('[Reflector Drone] Spawned reflected projectile');
}

/**
 * Destroy a reflector drone
 */
// [CORE] Destroy reflector drone
function destroyReflectorDrone(drone) {
  if (drone?.poolEntry) {
    releaseReflectorDroneVisual(drone.poolEntry);
    return;
  }
  disposeMesh(drone.mesh);
  _log('[Reflector Drone] Destroyed');
}

// ============================================================
//  STASIS FIELD
// ============================================================

/**
 * Initialize pooled stasis visuals.
 * VR-CRITICAL: Stasis spheres are expensive translucent meshes with many particles,
 * so we allocate a tiny fixed pool and reskin/reposition it instead of rebuilding
 * geometry every cast.
 */
function initStasisFieldVisualPool() {
  if (stasisFieldPoolInitialized || !scene) return;

  for (let poolIndex = 0; poolIndex < STASIS_FIELD_POOL_SIZE; poolIndex++) {
    const fieldGeo = new THREE.SphereGeometry(1, 24, 24);
    const fieldMat = basicMat(0x4488ff, {
      transparent: true,
      opacity: 0.3,
      side: THREE.BackSide,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    const fieldMesh = new THREE.Mesh(fieldGeo, fieldMat);
    fieldMesh.name = 'stasis-field';
    fieldMesh.visible = false;
    scene.add(fieldMesh);

    const particles = [];
    for (let i = 0; i < 30; i++) {
      const particleGeo = new THREE.SphereGeometry(0.05, 4, 4);
      const particleMat = basicMat(0x88ccff, {
        transparent: true,
        opacity: 0.6,
        blending: THREE.AdditiveBlending,
      });
      const particle = new THREE.Mesh(particleGeo, particleMat);
      particle.name = 'stasis-field-particle';
      particle.visible = false;
      fieldMesh.add(particle);
      particles.push({
        mesh: particle,
        angle: Math.random() * Math.PI * 2,
        speed: 0.5 + Math.random() * 0.5,
        heightOffset: Math.random() * Math.PI * 2,
      });
    }

    stasisFieldVisualPool.push({
      mesh: fieldMesh,
      material: fieldMat,
      particles,
      active: false,
    });
  }

  stasisFieldPoolInitialized = true;
}

/**
 * Acquire one pooled stasis field visual.
 * Resets particle state so repeat casts do not inherit stale animation.
 */
function acquireStasisFieldVisual(radius) {
  initStasisFieldVisualPool();
  for (let i = 0; i < stasisFieldVisualPool.length; i++) {
    const entry = stasisFieldVisualPool[i];
    if (entry.active) continue;
    entry.active = true;
    entry.mesh.visible = true;
    entry.mesh.scale.setScalar(radius);
    entry.material.opacity = 0.3;
    for (let j = 0; j < entry.particles.length; j++) {
      const particle = entry.particles[j];
      particle.angle = Math.random() * Math.PI * 2;
      particle.speed = 0.5 + Math.random() * 0.5;
      particle.heightOffset = Math.random() * Math.PI * 2;
      particle.mesh.visible = true;
      particle.mesh.material.opacity = 0.6;
      particle.mesh.position.set(0, 0, 0);
    }
    return entry;
  }
  return null;
}

function releaseStasisFieldVisual(entry) {
  if (!entry) return;
  entry.active = false;
  entry.mesh.visible = false;
}

function destroyStasisField(field) {
  if (field?.poolEntry) {
    releaseStasisFieldVisual(field.poolEntry);
    return;
  }
  disposeMesh(field.mesh);
}

// [CORE] Stasis field weapon system
function fireStasisField(origin, direction, hand, altWeapon) {
  // Create stasis field at target location
  const targetPosition = origin.clone().addScaledVector(direction, 8); // 8 units forward

  const radius = altWeapon.radius || 3.0;
  const pooledVisual = acquireStasisFieldVisual(radius);
  if (!pooledVisual) return;
  const mesh = pooledVisual.mesh;
  mesh.position.copy(targetPosition);

  // Add to active stasis fields
  const expiresAt = performance.now() + (altWeapon.duration || 5000);
  activeStasisFields.push({
    poolEntry: pooledVisual,
    mesh,
    material: pooledVisual.material,
    position: targetPosition,
    radius,
    expiresAt,
    slowFactor: altWeapon.slowFactor || 0.2,
    particles: pooledVisual.particles,
  });

  _log(`[Stasis Field] Created at (${targetPosition.x.toFixed(2)}, ${targetPosition.y.toFixed(2)}, ${targetPosition.z.toFixed(2)}) for ${altWeapon.duration / 1000}s`);
}

// [CORE] Update stasis fields
function updateStasisFields(now, dt) {
  for (let i = activeStasisFields.length - 1; i >= 0; i--) {
    const field = activeStasisFields[i];

    // Remove expired fields
    if (now > field.expiresAt) {
      destroyStasisField(field);
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
    field.material.opacity = pulse;
  }
}

// ============================================================
//  PLASMA ORB
// ============================================================

/**
 * Initialize pooled plasma orb visuals.
 * Perf: each orb previously allocated its own mesh plus eight trail meshes.
 * Pooling keeps this weapon from spraying transient geometry into the scene.
 */
function initPlasmaOrbVisualPool() {
  if (plasmaOrbPoolInitialized || !scene) return;

  for (let poolIndex = 0; poolIndex < PLASMA_ORB_POOL_SIZE; poolIndex++) {
    const orbGeo = new THREE.SphereGeometry(0.15, 16, 16);
    const orbMat = basicMat(0xaa44ff, {
      transparent: true,
      opacity: 0.8,
      blending: THREE.AdditiveBlending,
    });
    const orbMesh = new THREE.Mesh(orbGeo, orbMat);
    orbMesh.name = 'plasma-orb';
    orbMesh.visible = false;
    scene.add(orbMesh);

    const trailParticles = [];
    for (let i = 0; i < 8; i++) {
      const trailGeo = new THREE.SphereGeometry(0.08, 8, 8);
      const trailMat = basicMat(0xcc66ff, {
        transparent: true,
        opacity: 0.5 - (i * 0.05),
        blending: THREE.AdditiveBlending,
      });
      const trail = new THREE.Mesh(trailGeo, trailMat);
      trail.name = 'plasma-trail';
      trail.visible = false;
      scene.add(trail);
      trailParticles.push({
        mesh: trail,
        material: trailMat,
        baseOpacity: 0.5 - (i * 0.05),
        age: 0,
      });
    }

    plasmaOrbVisualPool.push({
      mesh: orbMesh,
      material: orbMat,
      trailParticles,
      active: false,
    });
  }

  plasmaOrbPoolInitialized = true;
}

function acquirePlasmaOrbVisual(origin) {
  initPlasmaOrbVisualPool();
  for (let i = 0; i < plasmaOrbVisualPool.length; i++) {
    const entry = plasmaOrbVisualPool[i];
    if (entry.active) continue;
    entry.active = true;
    entry.mesh.visible = true;
    entry.mesh.position.copy(origin);
    entry.material.opacity = 0.8;
    for (let j = 0; j < entry.trailParticles.length; j++) {
      const trail = entry.trailParticles[j];
      trail.age = 0;
      trail.mesh.visible = false;
      trail.mesh.position.copy(origin);
      trail.material.opacity = trail.baseOpacity;
    }
    return entry;
  }
  return null;
}

function releasePlasmaOrbVisual(entry) {
  if (!entry) return;
  entry.active = false;
  entry.mesh.visible = false;
  for (let i = 0; i < entry.trailParticles.length; i++) {
    entry.trailParticles[i].mesh.visible = false;
  }
}

function destroyPlasmaOrb(orb) {
  if (orb?.poolEntry) {
    releasePlasmaOrbVisual(orb.poolEntry);
    return;
  }
  if (orb?.trailParticles) {
    orb.trailParticles.forEach(t => disposeMesh(t.mesh));
  }
  disposeMesh(orb.mesh);
}

// [CORE] Plasma orb weapon system
function firePlasmaOrb(origin, direction, hand, altWeapon) {
  const pooledVisual = acquirePlasmaOrbVisual(origin);
  if (!pooledVisual) return;
  const mesh = pooledVisual.mesh;

  // Calculate velocity
  const speed = altWeapon.speed || 5;
  const velocity = direction.clone().multiplyScalar(speed);

  // Add to active plasma orbs
  const expiresAt = performance.now() + 10000; // 10 second lifetime
  activePlasmaOrbs.push({
    poolEntry: pooledVisual,
    mesh,
    material: pooledVisual.material,
    velocity,
    damage: altWeapon.damage || 75,
    aoeRadius: altWeapon.aoeRadius || 2.0,
    homingRange: altWeapon.homingRange || 15,
    expiresAt,
    detonatable: altWeapon.detonateOnHit !== false,
    trailParticles: pooledVisual.trailParticles,
    lastTrailUpdate: performance.now(),
  });

  _log(`[Plasma Orb] Fired from ${hand} hand, damage: ${altWeapon.damage}`);
}

// [CORE] Update plasma orbs
function updatePlasmaOrbs(now, dt) {
  const enemies = getEnemies();  // Still needed for index lookup
  for (let i = activePlasmaOrbs.length - 1; i >= 0; i--) {
    const orb = activePlasmaOrbs[i];

    // Remove expired orbs
    if (now > orb.expiresAt) {
      destroyPlasmaOrb(orb);
      activePlasmaOrbs.splice(i, 1);
      continue;
    }

    // Find nearest enemy for homing using spatial hash
    const nearbyForHoming = enemySpatialHash.query(orb.mesh.position.x, orb.mesh.position.z, orb.homingRange);
    let nearestEnemy = null;
    let nearestDist = orb.homingRange;

    for (const e of nearbyForHoming) {
      const dist = e.mesh.position.distanceTo(orb.mesh.position);
      if (dist < nearestDist) {
        nearestDist = dist;
        nearestEnemy = e;
      }
    }

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

    // Check collision with enemies using spatial hash
    const nearbyForCollision = enemySpatialHash.query(orb.mesh.position.x, orb.mesh.position.z, 0.5);
    for (const e of nearbyForCollision) {
      const dist = orb.mesh.position.distanceTo(e.mesh.position);
      if (dist < 0.3) { // Collision radius
        // Detonate orb
        const enemyIndex = enemies.indexOf(e);
        detonatePlasmaOrb(orb, enemyIndex);
        return; // Exit loop after detonation
      }
    }

    // Check if orb can be shot by player (detonate early)
    // This is handled in projectile collision detection
  }
}

// [CORE] Detonate plasma orb
function detonatePlasmaOrb(orb, enemyIndex) {
  // Apply damage to enemy
  if (enemyIndex !== undefined) {
    const result = hitEnemy(enemyIndex, orb.damage);
    spawnDamageNumber(orb.mesh.position, orb.damage, '#aa44ff');

    if (result.killed) {
      playExplosionSound();
      handleEnemyKilled(enemyIndex, { killsWithoutHit: true });
    }
  }

  // AOE damage to nearby enemies using spatial hash
  if (orb.aoeRadius > 0) {
    const enemies = getEnemies();  // Still needed for index lookup
    const nearby = enemySpatialHash.query(orb.mesh.position.x, orb.mesh.position.z, orb.aoeRadius);
    for (const e of nearby) {
      const i = enemies.indexOf(e);
      if (i === enemyIndex) continue; // Skip the enemy we already hit
      const dist = e.mesh.position.distanceTo(orb.mesh.position);
      if (dist < orb.aoeRadius) {
        const aoeDamage = orb.damage * 0.5 * (1 - dist / orb.aoeRadius);
        hitEnemy(i, aoeDamage);
        spawnDamageNumber(e.mesh.position, aoeDamage, '#aa44ff');
      }
    }
  }

  // Visual explosion
  spawnExplosionVisual(orb.mesh.position, orb.aoeRadius || 2.0);

  // Remove orb and trail
  destroyPlasmaOrb(orb);

  // Remove from active array
  const index = activePlasmaOrbs.indexOf(orb);
  if (index !== -1) {
    activePlasmaOrbs.splice(index, 1);
  }

  _log('[Plasma Orb] Detonated!');
}

// Check if player projectiles can detonate plasma orbs
// [CORE] Check plasma orb detonation on projectile hit
function checkPlasmaOrbDetonation(proj) {
  for (let i = activePlasmaOrbs.length - 1; i >= 0; i--) {
    const orb = activePlasmaOrbs[i];
    if (!orb.detonatable) continue;

    if (proj.position.distanceToSquared(orb.mesh.position) < 0.25) { // 0.5m hit radius
      // Detonate orb with smaller AOE (early detonation)
      orb.aoeRadius *= 0.6; // 60% of normal radius
      detonatePlasmaOrb(orb, undefined);
      _log('[Plasma Orb] Detonated early by player shot!');
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
const grenadePool = [];
let grenadePoolInitialized = false;

function initGrenadePool() {
  if (grenadePoolInitialized || !scene) return;

  for (let i = 0; i < MAX_GRENADES; i++) {
    const grenadeGeo = new THREE.SphereGeometry(0.1, 8, 8);
    const grenadeMat = basicMat(0xff4444, {
      transparent: true,
      opacity: 0.9,
    });
    const grenade = new THREE.Mesh(grenadeGeo, grenadeMat);
    grenade.name = 'grenade';
    grenade.visible = false;

    const glowGeo = new THREE.SphereGeometry(0.15, 8, 8);
    const glowMat = basicMat(0xff4444, {
      transparent: true,
      opacity: 0.3,
      side: THREE.BackSide,
    });
    const glow = new THREE.Mesh(glowGeo, glowMat);
    glow.name = 'grenade-glow';
    grenade.add(glow);

    scene.add(grenade);
    grenadePool.push({ mesh: grenade, glowMat, active: false });
  }

  grenadePoolInitialized = true;
}

function acquireGrenadeVisual() {
  initGrenadePool();
  for (let i = 0; i < grenadePool.length; i++) {
    const entry = grenadePool[i];
    if (entry.active) continue;
    entry.active = true;
    entry.mesh.visible = true;
    entry.mesh.scale.setScalar(1);
    entry.mesh.rotation.set(0, 0, 0);
    entry.mesh.material.opacity = 0.9;
    entry.glowMat.opacity = 0.3;
    return entry;
  }
  return null;
}

function releaseGrenadeVisual(entry) {
  if (!entry) return;
  entry.active = false;
  entry.mesh.visible = false;
}

// [CORE] Grenade weapon system
function fireGrenade(origin, direction, hand, altWeapon) {
  // Limit active grenades
  if (activeGrenades.length >= MAX_GRENADES) {
    const oldest = activeGrenades.shift();
    destroyGrenade(oldest);
  }

  _log(`[Grenade] Thrown from ${hand} hand`);

  const pooledVisual = acquireGrenadeVisual();
  if (!pooledVisual) return;
  pooledVisual.mesh.position.copy(origin);

  const grenadeData = {
    poolEntry: pooledVisual,
    mesh: pooledVisual.mesh,
    glowMat: pooledVisual.glowMat,
    velocity: direction.clone().multiplyScalar(12), // Toss speed
    createdAt: performance.now(),
    hand,
    damage: altWeapon.damage || 40,
    aoeRadius: altWeapon.aoeRadius || 2.0,
    fuseTime: 2000, // 2 second fuse
    bounceCount: 0,
  };

  activeGrenades.push(grenadeData);
  playShoothSound();
}

// [CORE] Update grenades (physics, arming)
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

// [CORE] Detonate grenade
function detonateGrenade(grenade, index) {
  _log('[Grenade] Detonated!');

  // AOE damage to enemies using spatial hash
  const enemies = getEnemies();  // Still needed for index lookup
  const nearby = enemySpatialHash.query(grenade.mesh.position.x, grenade.mesh.position.z, grenade.aoeRadius);
  for (const e of nearby) {
    const i = enemies.indexOf(e);
    const dist = e.mesh.position.distanceTo(grenade.mesh.position);
    if (dist < grenade.aoeRadius) {
      const damageMultiplier = 1 - (dist / grenade.aoeRadius);
      const damage = Math.round(grenade.damage * damageMultiplier);
      const result = hitEnemy(i, damage);
      spawnDamageNumber(e.mesh.position, damage, '#ff4444');

      handleEnemyKilled(i);
    }
  }

  // Visual explosion
  spawnExplosionVisual(grenade.mesh.position, grenade.aoeRadius);
  playExplosionSound();
  triggerScreenShake(0.3, 300);

  // Remove grenade
  destroyGrenade(grenade);
  activeGrenades.splice(index, 1);
}

// [CORE] Destroy grenade mesh
function destroyGrenade(grenade) {
  if (grenade?.poolEntry) {
    releaseGrenadeVisual(grenade.poolEntry);
    return;
  }
  disposeMesh(grenade.mesh);
}

// ============================================================
//  PROXIMITY MINE - Placeable explosive trap
// ============================================================

const activeProximityMines = [];
const MAX_PROXIMITY_MINES = 3;
const proximityMinePool = [];
let proximityMinePoolInitialized = false;

function initProximityMinePool() {
  if (proximityMinePoolInitialized || !scene) return;

  for (let i = 0; i < MAX_PROXIMITY_MINES; i++) {
    const mineGeo = new THREE.IcosahedronGeometry(0.12, 0);
    const mineMat = basicMat(0xffaa00, {
      transparent: true,
      opacity: 0.9,
    });
    const mine = new THREE.Mesh(mineGeo, mineMat);
    mine.visible = false;

    const glowGeo = new THREE.SphereGeometry(0.2, 8, 8);
    const glowMat = basicMat(0xffaa00, {
      transparent: true,
      opacity: 0.3,
      side: THREE.BackSide,
    });
    const glow = new THREE.Mesh(glowGeo, glowMat);
    glow.name = 'proximity-mine-glow';
    mine.add(glow);

    scene.add(mine);
    proximityMinePool.push({ mesh: mine, glowMat, active: false });
  }

  proximityMinePoolInitialized = true;
}

function acquireProximityMineVisual() {
  initProximityMinePool();
  for (let i = 0; i < proximityMinePool.length; i++) {
    const entry = proximityMinePool[i];
    if (entry.active) continue;
    entry.active = true;
    entry.mesh.visible = true;
    entry.mesh.scale.setScalar(1);
    entry.mesh.rotation.set(0, 0, 0);
    entry.mesh.material.opacity = 0.9;
    entry.mesh.material.color.setHex(0xffaa00);
    entry.glowMat.opacity = 0.3;
    return entry;
  }
  return null;
}

function releaseProximityMineVisual(entry) {
  if (!entry) return;
  entry.active = false;
  entry.mesh.visible = false;
}

// [CORE] Proximity mine weapon system
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

  _log(`[Mine] Placed from ${hand} hand`);

  const pooledVisual = acquireProximityMineVisual();
  if (!pooledVisual) return;
  const mine = pooledVisual.mesh;

  // Place at ground level
  mine.position.copy(origin);
  mine.position.y = 0.15;

  const mineData = {
    poolEntry: pooledVisual,
    mesh: mine,
    glowMat: pooledVisual.glowMat,
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

  activeProximityMines.push(mineData);
  playShoothSound();
}

// [CORE] Update proximity mines
function updateProximityMines(now, dt) {
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
      _log('[Mine] Armed!');
    }

    // Not armed yet - skip proximity check
    if (!mine.isArmed) continue;

    // Check for enemy proximity using spatial hash
    const nearby = enemySpatialHash.query(mine.position.x, mine.position.z, mine.triggerRadius);
    for (const e of nearby) {
      const dist = e.mesh.position.distanceTo(mine.position);
      if (dist < mine.triggerRadius) {
        detonateProximityMine(mine, i);
        break;
      }
    }
  }
}

// [CORE] Detonate proximity mine
function detonateProximityMine(mine, index) {
  _log('[Mine] Detonated!');

  // AOE damage to enemies using spatial hash
  const enemies = getEnemies();  // Still needed for index lookup
  const nearby = enemySpatialHash.query(mine.position.x, mine.position.z, mine.aoeRadius);
  for (const e of nearby) {
    const i = enemies.indexOf(e);
    const dist = e.mesh.position.distanceTo(mine.position);
    if (dist < mine.aoeRadius) {
      const damageMultiplier = 1 - (dist / mine.aoeRadius);
      const damage = Math.round(mine.damage * damageMultiplier);
      const result = hitEnemy(i, damage);
      spawnDamageNumber(e.mesh.position, damage, '#ffaa00');

      handleEnemyKilled(i);
    }
  }

  // Visual explosion
  spawnExplosionVisual(mine.position, mine.aoeRadius);
  playExplosionSound();
  triggerScreenShake(0.4, 350);

  // Remove mine
  destroyProximityMine(mine);
  activeProximityMines.splice(index, 1);
}

// [CORE] Destroy proximity mine
function destroyProximityMine(mine) {
  if (mine?.poolEntry) {
    releaseProximityMineVisual(mine.poolEntry);
    return;
  }
  disposeMesh(mine.mesh);
}

// ============================================================
//  ATTACK DRONE - Orbiting auto-targeting helper
// ============================================================

const activeAttackDrones = [];
const MAX_ATTACK_DRONES = 2;

function initAttackDronePool() {
  if (attackDronePoolInitialized || !scene) return;

  for (let poolIndex = 0; poolIndex < MAX_ATTACK_DRONES; poolIndex++) {
    const droneGroup = new THREE.Group();
    droneGroup.visible = false;

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
    const hexMat = basicMat(0x88ff88, {
      transparent: true,
      opacity: 0.9,
      side: THREE.DoubleSide,
    });
    const hex = new THREE.Mesh(hexGeo, hexMat);
    hex.rotation.x = Math.PI / 2;
    droneGroup.add(hex);

    const coreGeo = new THREE.SphereGeometry(0.06, 8, 8);
    const coreMat = basicMat(0x88ff88, {
      transparent: true,
      opacity: 0.8,
    });
    const core = new THREE.Mesh(coreGeo, coreMat);
    core.name = 'attack-drone-core';
    droneGroup.add(core);

    const glowGeo = new THREE.SphereGeometry(0.25, 12, 12);
    const glowMat = basicMat(0x88ff88, {
      transparent: true,
      opacity: 0.2,
      side: THREE.BackSide,
    });
    const glow = new THREE.Mesh(glowGeo, glowMat);
    glow.name = 'attack-drone-glow';
    droneGroup.add(glow);

    scene.add(droneGroup);
    attackDronePool.push({
      mesh: droneGroup,
      hexMat,
      coreMat,
      glowMat,
      active: false,
    });
  }

  attackDronePoolInitialized = true;
}

function acquireAttackDroneVisual() {
  initAttackDronePool();
  for (let i = 0; i < attackDronePool.length; i++) {
    const entry = attackDronePool[i];
    if (entry.active) continue;
    entry.active = true;
    entry.mesh.visible = true;
    entry.mesh.scale.setScalar(1);
    entry.mesh.rotation.set(0, 0, 0);
    entry.coreMat.opacity = 0.8;
    entry.glowMat.opacity = 0.2;
    entry.hexMat.opacity = 0.9;
    return entry;
  }
  return null;
}

function releaseAttackDroneVisual(entry) {
  if (!entry) return;
  entry.active = false;
  entry.mesh.visible = false;
}

// [CORE] Attack drone weapon system
function fireAttackDrone(origin, hand, altWeapon) {
  // Limit active drones
  const handDrones = activeAttackDrones.filter(d => d.hand === hand);
  if (handDrones.length >= MAX_ATTACK_DRONES) {
    const oldest = handDrones[0];
    destroyAttackDrone(oldest);
    const idx = activeAttackDrones.indexOf(oldest);
    if (idx >= 0) activeAttackDrones.splice(idx, 1);
  }

  _log(`[Drone] Deployed from ${hand} hand`);
  const pooledVisual = acquireAttackDroneVisual();
  if (!pooledVisual) return;

  // Position at player location
  const playerPos = camera.position.clone();
  pooledVisual.mesh.position.copy(playerPos);
  pooledVisual.mesh.position.y = 1.2;

  const droneData = {
    poolEntry: pooledVisual,
    mesh: pooledVisual.mesh,
    coreMat: pooledVisual.coreMat,
    glowMat: pooledVisual.glowMat,
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

// [CORE] Update attack drones (targeting, firing)
function updateAttackDrones(now, dt, playerPos) {
  for (let i = activeAttackDrones.length - 1; i >= 0; i--) {
    const drone = activeAttackDrones[i];
    const age = now - drone.createdAt;

    // Check if expired
    if (now >= drone.expiresAt) {
      destroyAttackDrone(drone);
      activeAttackDrones.splice(i, 1);
      _log('[Drone] Expired');
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
        const projMat = basicMat(0x88ff88, {
          transparent: true,
          opacity: 0.8,
        });
        const proj = new THREE.Mesh(projGeo, projMat);
        proj.name = 'drone-projectile';
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

// [CORE] Destroy attack drone
function destroyAttackDrone(drone) {
  if (drone?.poolEntry) {
    releaseAttackDroneVisual(drone.poolEntry);
    return;
  }
  disposeMesh(drone.mesh);
}

// ============================================================
//  EMP - Area effect that stuns/shocks enemies
// ============================================================

// [CORE] EMP weapon system
const EMP_VISUAL_POOL_SIZE = 4;
const empVisualPool = [];
let empVisualPoolInitialized = false;

function initEMPVisualPool() {
  if (empVisualPoolInitialized || !scene) return;

  for (let i = 0; i < EMP_VISUAL_POOL_SIZE; i++) {
    const ringGeo = new THREE.RingGeometry(0.1, 5, 32);
    const ringMat = basicMat(0x00ffff, {
      transparent: true,
      opacity: 0.6,
      side: THREE.DoubleSide,
    });
    const ring = new THREE.Mesh(ringGeo, ringMat);
    ring.visible = false;
    scene.add(ring);
    empVisualPool.push({ ring, ringMat, active: false });
  }

  empVisualPoolInitialized = true;
}

function acquireEMPVisual() {
  initEMPVisualPool();
  for (let i = 0; i < empVisualPool.length; i++) {
    const entry = empVisualPool[i];
    if (entry.active) continue;
    entry.active = true;
    entry.ring.visible = true;
    entry.ring.scale.setScalar(1);
    entry.ringMat.opacity = 0.6;
    return entry;
  }
  return null;
}

function releaseEMPVisual(entry) {
  if (!entry) return;
  entry.active = false;
  entry.ring.visible = false;
}

function fireEMP(origin, hand, altWeapon) {
  _log(`[EMP] Activated from ${hand} hand`);

  const range = altWeapon.range || 5;
  const duration = altWeapon.duration || 3000;
  const playerPos = camera.position.clone();

  const pooledVisual = acquireEMPVisual();
  if (!pooledVisual) return;
  const ring = pooledVisual.ring;
  ring.position.copy(playerPos);
  ring.position.y = 1.0;
  ring.rotation.x = Math.PI / 2;

  // Track for animation
  const empData = {
    poolEntry: pooledVisual,
    ring,
    ringMat: pooledVisual.ringMat,
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

      handleEnemyKilled(i);
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

// [CORE] Update EMP visuals
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
      releaseEMPVisual(emp.poolEntry);
      activeEMPVisuals.splice(i, 1);
    }
  }
}

// ============================================================
//  TELEPORT - Instant movement to target location
// ============================================================

// [CORE] Teleport weapon system
const TELEPORT_VISUAL_POOL_SIZE = 4;
const teleportVisualPool = [];
let teleportVisualPoolInitialized = false;

function initTeleportVisualPool() {
  if (teleportVisualPoolInitialized || !scene) return;

  for (let i = 0; i < TELEPORT_VISUAL_POOL_SIZE; i++) {
    const startEffectGeo = new THREE.SphereGeometry(0.5, 16, 16);
    const startEffectMat = basicMat(0xaa00ff, {
      transparent: true,
      opacity: 0.5,
      blending: THREE.AdditiveBlending,
    });
    const startEffect = new THREE.Mesh(startEffectGeo, startEffectMat);
    startEffect.name = 'teleport-start-effect';
    startEffect.visible = false;
    scene.add(startEffect);

    const endEffectGeo = new THREE.SphereGeometry(0.5, 16, 16);
    const endEffectMat = basicMat(0xaa00ff, {
      transparent: true,
      opacity: 0.5,
      blending: THREE.AdditiveBlending,
    });
    const endEffect = new THREE.Mesh(endEffectGeo, endEffectMat);
    endEffect.name = 'teleport-end-effect';
    endEffect.visible = false;
    scene.add(endEffect);

    teleportVisualPool.push({
      startEffect,
      startEffectMat,
      endEffect,
      endEffectMat,
      active: false,
    });
  }

  teleportVisualPoolInitialized = true;
}

function acquireTeleportVisual() {
  initTeleportVisualPool();
  for (let i = 0; i < teleportVisualPool.length; i++) {
    const entry = teleportVisualPool[i];
    if (entry.active) continue;
    entry.active = true;
    entry.startEffect.visible = true;
    entry.endEffect.visible = true;
    entry.startEffect.scale.setScalar(1);
    entry.endEffect.scale.setScalar(1);
    entry.startEffectMat.opacity = 0.5;
    entry.endEffectMat.opacity = 0.5;
    return entry;
  }
  return null;
}

function releaseTeleportVisual(entry) {
  if (!entry) return;
  entry.active = false;
  entry.startEffect.visible = false;
  entry.endEffect.visible = false;
}

function fireTeleport(origin, direction, hand, altWeapon) {
  _log(`[Teleport] Activated from ${hand} hand`);

  const range = altWeapon.range || 10;
  const playerPos = camera.position.clone();

  // Calculate teleport destination
  const destination = playerPos.clone().addScaledVector(direction, range);

  // Clamp destination to ground level
  destination.y = Math.max(0.5, destination.y);

  const pooledVisual = acquireTeleportVisual();
  if (!pooledVisual) return;
  const startEffect = pooledVisual.startEffect;
  startEffect.position.copy(playerPos);

  // Teleport player (desktop only - in VR, WebXR controls camera position)
  if (!renderer.xr.isPresenting) {
    camera.position.copy(destination);
    _log(`[Teleport] Moved from (${playerPos.x.toFixed(2)}, ${playerPos.y.toFixed(2)}, ${playerPos.z.toFixed(2)}) to (${destination.x.toFixed(2)}, ${destination.y.toFixed(2)}, ${destination.z.toFixed(2)})`);
  } else {
    _log(`[Teleport] VR mode - teleport visual only (WebXR controls camera)`);
  }

  const endEffect = pooledVisual.endEffect;
  endEffect.position.copy(destination);

  // Track effects for fade-out
  const teleportData = {
    poolEntry: pooledVisual,
    startEffect,
    startEffectMat: pooledVisual.startEffectMat,
    endEffect,
    endEffectMat: pooledVisual.endEffectMat,
    createdAt: performance.now(),
    duration: 300,
  };

  activeTeleportEffects.push(teleportData);
  playShoothSound();
  triggerScreenShake(0.2, 200);
}

const activeTeleportEffects = [];

// [CORE] Update teleport effects
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
      releaseTeleportVisual(effect.poolEntry);
      activeTeleportEffects.splice(i, 1);
    }
  }
}

// ============================================================
//  GAME STATE TRANSITIONS
// ============================================================
// [DEBUG] Jump to a specific level for testing (skips progression)
function debugJumpToLevel(targetLevel) {
  _log('[debug] Jump to level ' + targetLevel);
  hideTitle();
  resetGame();
  game.state = State.READY_SCREEN;
  game.level = targetLevel;
  game._levelConfig = getLevelConfig();
  captureLevelSpawnForward();
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

// [DEBUG] Cycle through biomes for testing: synthwave > desert > alien > hellscape
function cycleDebugBiome() {
  // #9 FIX: Cycle through specific biomes: SYNTHWAVE > DESERT > ALIEN PLANET > HELLSCAPE > SYNTHWAVE
  const debugBiomeCycle = ['synthwave_valley', 'desert_night', 'alien_planet', 'hellscape_lava'];
  const current = game.debugBiomeOverride;
  let next = null;

  _log('[debug] cycleDebugBiome: current=', current);

  if (!current) {
    // Start with first biome in cycle
    next = debugBiomeCycle[0];
    _log('[debug] No current biome, starting with:', next);
  } else {
    const index = debugBiomeCycle.indexOf(current);
    _log('[debug] Current biome index:', index);
    if (index === -1) {
      // If current biome is not in cycle, start from beginning
      next = debugBiomeCycle[0];
      _log('[debug] Biome not in cycle, resetting to:', next);
    } else if (index === debugBiomeCycle.length - 1) {
      // Wrap around to first biome
      next = debugBiomeCycle[0];
      _log('[debug] End of cycle, wrapping to:', next);
    } else {
      // Move to next biome in cycle
      next = debugBiomeCycle[index + 1];
      _log('[debug] Moving to next biome:', next);
    }
  }

  game.debugBiomeOverride = next;
  saveDebugSettings();
  _log('[debug] Biome override set to', next || 'auto');
  return next;
}

// [DEBUG] Cycle biome with visual fade transition (used by debug menu)
function cycleDebugBiomeWithFade() {
  _log('[debug] cycleDebugBiomeWithFade called, environmentFadeState:', environmentFadeState);
  if (environmentFadeState) {
    _log('[debug] Fade already in progress, skipping');
    return;
  }
  if (!game.level || game.level < 1) {
    _log('[debug] Setting level to 1 for biome cycle');
    game.level = 1;
    game._levelConfig = getLevelConfig();
  }
  // Fade durations are in SECONDS (0.3s = 300ms fade)
  _log('[debug] Starting fade out...');
  startEnvironmentFade('out', 0.3, () => {
    _log('[debug] Fade out complete, cycling biome...');
    cycleDebugBiome();
    _log('[debug] Applying theme for level', game.level);
    applyThemeForLevel(game.level);
    _log('[debug] Starting fade in...');
    startEnvironmentFade('in', 0.3);
  });
}

// [CORE] Reset ready countdown timer
function resetReadyCountdown() {
  readyCountdownActive = false;
  readyCountdownStartTime = 0;
  readyCountdownLastValue = READY_COUNTDOWN_SECONDS;
  updateReadyCountdownText(null);
}

// [CORE] Begin gameplay from ready screen
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

// [CORE] Start ready countdown before gameplay
function startReadyCountdown() {
  if (readyCountdownActive) return;
  readyCountdownActive = true;
  readyCountdownStartTime = performance.now();
  readyCountdownLastValue = READY_COUNTDOWN_SECONDS;
  updateReadyCountdownText(`${READY_COUNTDOWN_SECONDS}`);
  playCountdown321();  // 321 sound triggers on the "3"
}

// [CORE] Update ready countdown display
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

// [CORE] Handle ready screen VR trigger
function handleReadyScreenTrigger(controller) {
  if (readyCountdownActive) return;
  playMenuClick();
  startReadyCountdown();
}

// [DEBUG] Handle VR controller input in debug menu state (REMOVED — 3D debug menu deleted)

// ============================================================
// GAME FLOW & STATE MANAGEMENT
// startGame, completeLevel, togglePause, endGame, debug jump
// COUPLING: Transitions game.state, calls HUD show/hide, audio
// ============================================================
// [CORE] Capture level spawn forward direction for boss alignment
function captureLevelSpawnForward() {
  _levelSpawnForward.copy(DEFAULT_LEVEL_SPAWN_FORWARD);
  setBossSpawnForward(_levelSpawnForward);
  biomeClearedForBossCinematic = false;
}

// [CORE] Start new game
function startGame() {
  _log('[game] Starting new game');
  hideTitle();

  // Clean up any leftover boss minions from previous run
  clearBossMinions();
  
  // Hide HTML overlays for desktop mode
  const noVr = document.getElementById('no-vr');
  const info = document.getElementById('info');
  if (noVr) noVr.style.display = 'none';
  if (info) info.style.display = 'none';
  
  // Check for seed configuration from HTML inputs
  const seedConfig = getSeedSelection();
  const seed = seedConfig.value;
  const tier = seedConfig.tier || 'standard';
  
  if (seed !== null) {
    // Start game with seed
    _log(`[seed] Using seed: ${seed}, tier: ${tier}`);
    startGameWithSeed(seed, tier);
  } else {
    // Start game without seed (random)
    _log('[seed] No seed set, using random seed');
    resetGame();
  }

  resetAllSlowMoState();

  game.state = State.READY_SCREEN;
  game.level = 1;
  game._levelConfig = getLevelConfig();
  captureLevelSpawnForward();
  applyThemeForLevel(1);
  applyEnvironmentFade(0);
  showHUD();
  updateHUD(game);
  showReadyScreen(game.level, getAdjustedCameraPosition());
  resetReadyCountdown();

  // Setup kills remaining alert for level 1
  setupKillsAlert();

  // Hide blaster displays during gameplay
  blasterDisplays.forEach(d => { if (d) d.visible = false; });

  // Start level music
  playMusic('levels1to5');
}

// [CORE] Check if level needs biome transition fade
function shouldFadeForBiomeTransition(level) {
  if (level >= 20) return false;
  const currentBiome = getBiomeForLevel(level);
  const nextBiome = getBiomeForLevel(level + 1);
  return currentBiome !== nextBiome;
}

// [CORE] Reset all slow-motion state
function resetAllSlowMoState() {
  slowMoActive = false;
  slowMoDuration = 0;
  slowMoSoundPlayed = false;
  slowMoRampOut = false;
  slowMoRampOutTimer = 0;
  timeScale = 1.0;

  game.slowmoActive = false;
  game.slowmoTimer = 0;
  game.timeScale = 1.0;

  if (typeof window !== 'undefined') {
    window._timeScale = 1.0;
    window._wasCloseEnemy = false;
  }
}

// Boss death cinematic functions are now in boss-death-cinematic.js (imported at top)

// [CORE] Complete current level, show upgrade/victory
function completeLevel() {
  if (isBossDeathCinematicActive()) return;

  _log(`[game] Level ${game.level} complete`);

  // Hide kills remaining alert if showing
  hideKillsAlert();

  // Update HUD one final time to show correct kill count
  updateHUD(game);

  // Ensure level-end timing is not slowed by proximity slow-mo
  resetAllSlowMoState();

  game.state = State.LEVEL_COMPLETE;

  // Force-clear lightning beams so they don't persist through upgrade screen
  clearAllLightningBeams();
  stopLightningSound();

  // Play victory fanfare
  playLevelCompleteSound();

  // Kill all remaining enemies with explosions
  // Cleanup is deferred to advanceLevelAfterUpgrade() so explosions are visible
  const remaining = getEnemies();
  for (let i = remaining.length - 1; i >= 0; i--) {
    if (remaining[i] && remaining[i].hp > 0) {
      if (remaining[i].mesh && remaining[i].mesh.position) {
        spawnExplosionVisual(remaining[i].mesh.position, 0.5);
      }
      destroyEnemy(i, false, false);
    }
  }
  // Note: clearAllEnemies() and other cleanup moved to advanceLevelAfterUpgrade()
  // so the player can see the explosion visuals during the level-complete delay.
  game.justBossKill = game._levelConfig && game._levelConfig.isBoss;
  game.stateTimer = 2.0; // cooldown before upgrade screen
  levelFadeReady = false;
  const shouldFade = shouldFadeForBiomeTransition(game.level);
  // If the boss death overlay is still active, the environment is already fully
  // faded to black. Skip the fade-out animation to prevent a pop-back flash.
  if (isBossDeathOverlayActive()) {
    _log('[game] Boss death overlay active, skipping environment fade-out');
    levelFadeReady = true;
  } else if (shouldFade) {
    startEnvironmentFade('out', 0.8, () => {
      levelFadeReady = true;
      applyEnvironmentFade(1);
    });
  } else {
    levelFadeReady = true;
  }
  showLevelComplete(game.level, getAdjustedCameraPosition());

  // Pre-boss music fade is handled in showUpgradeScreen() so the fade
  // happens during the upgrade card screen, not during the level-complete
  // celebration. Keeping the fade here caused the music to fade too early,
  // and the second call in showUpgradeScreen was a no-op (currentMusic null).
}

// PERFORMANCE: Clear all active projectiles and return them to pool
// [CORE] Clear all projectiles from scene
function clearAllProjectiles() {
  for (let i = projectiles.length - 1; i >= 0; i--) {
    const proj = projectiles[i];
    if (proj?.userData?.isPooled) {
      returnProjectileToPool(proj);
    } else {
      // Many hostile/boss helper projectiles allocate unique geo/mat per shot.
      // Remove and dispose so GPU resources do not accumulate across levels.
      disposeObject3D(proj);
    }
  }
  projectiles.length = 0;

  // Prune disposed materials from the projectile tuning set
  for (const mat of playerProjectileMaterials) {
    if (mat.disposed) playerProjectileMaterials.delete(mat);
  }
}

// Clear all lightning gun beams
// [CORE] Clear all lightning beam visuals
function clearAllLightningBeams() {
  for (let i = 0; i < lightningBeams.length; i++) {
    if (lightningBeams[i]) {
      clearLightningBeam(i);
    }
  }
  lightningTimers.fill(0);
}

// Clear all alt-weapon effects (grenades, mines, decoys, drones, etc.)
// Called during level transitions to prevent geometry/material accumulation
// [CORE] Clear all alt weapon effects (shields, mines, drones, etc.)
function clearAllAltWeaponEffects() {
  // Clear active shields
  for (let i = activeShields.length - 1; i >= 0; i--) {
    disposeMesh(activeShields[i].mesh);
  }
  activeShields.length = 0;

  // Clear active laser mines
  for (let i = activeLaserMines.length - 1; i >= 0; i--) {
    const mine = activeLaserMines[i];
    if (mine.mesh) disposeMesh(mine.mesh);
  }
  activeLaserMines.length = 0;

  // Clear active decoys
  for (let i = activeDecoys.length - 1; i >= 0; i--) {
    disposeMesh(activeDecoys[i].mesh);
  }
  activeDecoys.length = 0;

  // Clear active black holes
  for (let i = activeBlackHoles.length - 1; i >= 0; i--) {
    disposeMesh(activeBlackHoles[i].mesh);
  }
  activeBlackHoles.length = 0;

  // Clear active mines (black hole mines)
  for (let i = activeMines.length - 1; i >= 0; i--) {
    if (activeMines[i].mesh) disposeMesh(activeMines[i].mesh);
  }
  activeMines.length = 0;

  // Clear active tethers
  for (let i = activeTethers.length - 1; i >= 0; i--) {
    disposeMesh(activeTethers[i].mesh);
  }
  activeTethers.length = 0;

  // Clear active nanite swarms
  for (let i = activeNaniteSwarms.length - 1; i >= 0; i--) {
    disposeMesh(activeNaniteSwarms[i].mesh);
  }
  activeNaniteSwarms.length = 0;

  // Clear active reflector drones
  for (let i = activeReflectorDrones.length - 1; i >= 0; i--) {
    destroyReflectorDrone(activeReflectorDrones[i]);
  }
  activeReflectorDrones.length = 0;

  // Clear active grenades
  for (let i = activeGrenades.length - 1; i >= 0; i--) {
    destroyGrenade(activeGrenades[i]);
  }
  activeGrenades.length = 0;

  // Clear active proximity mines
  for (let i = activeProximityMines.length - 1; i >= 0; i--) {
    destroyProximityMine(activeProximityMines[i]);
  }
  activeProximityMines.length = 0;

  // Clear active attack drones
  for (let i = activeAttackDrones.length - 1; i >= 0; i--) {
    destroyAttackDrone(activeAttackDrones[i]);
  }
  activeAttackDrones.length = 0;

  // Clear active plasma orbs
  for (let i = activePlasmaOrbs.length - 1; i >= 0; i--) {
    destroyPlasmaOrb(activePlasmaOrbs[i]);
  }
  activePlasmaOrbs.length = 0;

  // Clear active phase dash afterimages
  for (let i = activePhaseDashAfterimages.length - 1; i >= 0; i--) {
    disposeMesh(activePhaseDashAfterimages[i].mesh);
  }
  activePhaseDashAfterimages.length = 0;

  // Clear active stasis fields
  for (let i = activeStasisFields.length - 1; i >= 0; i--) {
    destroyStasisField(activeStasisFields[i]);
  }
  activeStasisFields.length = 0;

  // Clear active EMP visuals
  for (let i = activeEMPVisuals.length - 1; i >= 0; i--) {
    releaseEMPVisual(activeEMPVisuals[i].poolEntry);
  }
  activeEMPVisuals.length = 0;

  // Clear active teleport effects
  for (let i = activeTeleportEffects.length - 1; i >= 0; i--) {
    releaseTeleportVisual(activeTeleportEffects[i].poolEntry);
  }
  activeTeleportEffects.length = 0;

  // Clear explosion visuals (toxic pools, boss shields, etc.)
  for (let i = explosionVisuals.length - 1; i >= 0; i--) {
    disposeMesh(explosionVisuals[i]);
  }
  explosionVisuals.length = 0;
  clearAllChargeBeamVisuals();

  // Remove explosion pool meshes from scene and clear pool, then reinitialize
  for (let i = 0; i < explosionPool.length; i++) {
    if (explosionPool[i].mesh.parent) {
      explosionPool[i].mesh.parent.remove(explosionPool[i].mesh);
    }
    disposeMesh(explosionPool[i].mesh);
  }
  explosionPool.length = 0;
  // Reinitialize pool with fresh meshes for the new level
  if (scene) initExplosionPool(scene);

  // Clear active voxels
  for (let i = activeVoxels.length - 1; i >= 0; i--) {
    const voxel = activeVoxels[i];
    voxel.visible = false;
    voxel.userData.velocity = null;
    voxel.userData.createdAt = undefined;
    voxel.userData.lifetime = undefined;
  }
  activeVoxels.length = 0;

  // Reset debris glow pool
  if (_debrisGlowPool) {
    _debrisGlowPool.count = 0;
    _debrisGlowPool.instanceMatrix.needsUpdate = true;
    _debrisGlowActive.length = 0;
    _debrisGlowFree = [];
    for (let i = 0; i < DEBRIS_GLOW_POOL_SIZE; i++) _debrisGlowFree.push(i);
  }

  _log('[cleanup] Cleared all alt-weapon effects and visuals');
}

// Register clearAllAltWeaponEffects as a resetGame() hook so voxels/effects
// are properly cleared even on full game restart (not just level transitions).
registerResetHook(clearAllAltWeaponEffects);

// Reset controller sphere colors to default (cyan left, pink right) on game reset
registerResetHook(() => updateAllControllerSphereColors());

// Register HUD cleanup hooks (damage numbers, combo popups, kill-chain popups, floating messages)
registerResetHook(clearAllDamageNumbers);
registerResetHook(clearAllComboPopups);
registerResetHook(clearAllKillChainPopups);
registerResetHook(clearFloatingMessage);

// Register enemy cleanup hooks (boss debris, electric arcs already called in clearAllEnemies,
// but registered as separate hooks for safety on full game reset)
registerResetHook(clearBossDebris);
registerResetHook(clearAllElectricArcs);

// Clear geometry/texture caches to prevent GPU object leaks on game restart
registerResetHook(clearGeometryCaches);
registerResetHook(clearHudGeoCache);

// Clean up active charge explosions on game reset
registerResetHook(() => {
  for (let i = activeChargeExplosions.length - 1; i >= 0; i--) {
    const exp = activeChargeExplosions[i];
    scene.remove(exp.mesh);
    exp.mesh.geometry.dispose();
    exp.mesh.material.dispose();
  }
  activeChargeExplosions.length = 0;
});

// Reset nuke flash opacity on full game restart
registerResetHook(() => {
  if (nukeFlash) {
    nukeFlash.material.opacity = 0;
    nukeFlashTimer = 0;
  }
});

// [CORE] Show upgrade selection screen
function showUpgradeScreen() {
  _log('[game] Showing upgrade selection');
  game.state = State.UPGRADE_SELECT;
  upgradeTriggerLatched[0] = false;
  upgradeTriggerLatched[1] = false;
  hideLevelComplete();
  resetHoloGlitch();

  // Dismiss boss death overlay so upgrade cards are visible
  dismissBossDeathOverlay();

  // Stop lightning sound during upgrade screen
  stopLightningSound();

  // Fade out music before boss fights (levels 4→5, 9→10, 14→15, 19→20)
  if ([4, 9, 14, 19].includes(game.level)) {
    _log('[game] Fading out music before boss fight');
    fadeOutMusic(1200);
  }

  // Get the hand for this upgrade
  const hand = getNextUpgradeHand();
  pendingUpgradeHand = hand;

  // Check if this is the level 1→2 transition where player chooses MAIN weapon
  if (needsMainWeaponChoice()) {
    // Show MAIN weapon selection (all except Standard Blaster - it's the default)
    _log('[game] Level 1→2: Showing MAIN weapon selection');
    const mainWeaponOptions = Object.values(MAIN_WEAPONS).filter(w => w.id !== 'standard_blaster');
    pendingUpgrades = mainWeaponOptions;
    showUpgradeCards(pendingUpgrades, getAdjustedCameraPosition(), hand);
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
    _log(`[game] Showing upgrades for ${hand} hand (${mainWeaponId})`);
    pendingUpgrades = game.justBossKill ? 
      getRandomSpecialUpgrades(3, mainWeaponId) : 
      getRandomUpgrades(3, mainWeaponId);
  } else {
    // MAIN weapon not locked yet - show all upgrades (shouldn't happen after level 2)
    _log(`[game] WARNING: MAIN weapon not locked for ${hand} hand at level ${game.level}`);
    pendingUpgrades = game.justBossKill ? getRandomSpecialUpgrades(3, mainWeaponId) : getRandomUpgrades(3, mainWeaponId);
  }

  // Exclude mega_scope from charge cannon (not useful for beam weapon)
  if (mainWeaponId === 'charge_cannon') {
    pendingUpgrades = pendingUpgrades.filter(u => u.id !== 'mega_scope');
  }

  showUpgradeCards(pendingUpgrades, getAdjustedCameraPosition(), hand);
  upgradeSelectionCooldown = 1.5; // prevent instant selection

  // Mark blaster displays for update
  blasterDisplays.forEach(d => { if (d) d.userData.needsUpdate = true; });
}

// [CORE] Clear pending upgrade state
function clearPendingUpgradeState() {
  pendingUpgrades = [];
  pendingUpgradeHand = null;
}

// [CORE] Finalize upgrade selection and advance
function finalizeUpgradeSelection() {
  clearPendingUpgradeState();
  playUpgradeSound();
  hideUpgradeCards();
  advanceLevelAfterUpgrade();
}

// [CORE] Select upgrade and advance to next level
function selectUpgradeAndAdvance(upgrade, hand) {
  const targetHand = hand || pendingUpgradeHand;
  if (!upgrade?.id || !targetHand) {
    // Fail gracefully instead of silently stranding the player on the upgrade screen.
    console.error('[upgrade] Invalid upgrade selection payload', { upgrade, hand, pendingUpgradeHand });
    playErrorSound();
    return;
  }

  _log(`[game] Selected: ${upgrade.name} for ${targetHand} hand`);

  if (upgrade?.id === 'SKIP') {
    game.health = game.maxHealth;
    _log('[game] Skipped upgrade, health restored to full');
    finalizeUpgradeSelection();
    return;
  }

  if (upgrade?.type === 'main') {
    _log(`[game] Selected MAIN weapon: ${upgrade.id} for ${targetHand} hand`);
    setMainWeapon(upgrade.id, targetHand);
    updateAllControllerSphereColors();
    finalizeUpgradeSelection();
    return;
  }

  if (upgrade?.type === 'alt') {
    _log(`[game] Selected ALT weapon: ${upgrade.id} for ${targetHand} hand`);
    setAltWeapon(upgrade.id, targetHand);
    finalizeUpgradeSelection();
    return;
  }

  addUpgrade(upgrade.id, targetHand);

  if (upgrade?.id === 'extra_nuke') {
    game.nukes = (game.nukes || 0) + 1;
    _log(`[nuke] Extra nuke granted. Total: ${game.nukes}`);
  }

  finalizeUpgradeSelection();
}

// [CORE] Advance to next level after upgrade selection
function advanceLevelAfterUpgrade() {
  // Deferred cleanup from level complete - explosions already played during LEVEL_COMPLETE state
  clearAllEnemies();
  clearAllProjectiles();
  clearAllLightningBeams();
  clearAllChargeBeamVisuals();
  clearAllElectricArcs();
  clearBossProjectiles();
  clearAllTelegraphs();
  clearAllAltWeaponEffects();
  clearAllDamageNumbers();
  clearAllComboPopups();
  clearAllKillChainPopups();
  clearFloatingMessage();
  stopLightningSound();

  game.level++;
  game.kills = 0;

  if (game.level > 20) {
    endGame(true); // victory
  } else {
    game._levelConfig = getLevelConfig();
    captureLevelSpawnForward();
    applyThemeForLevel(game.level);
    const shouldFade = shouldFadeForBiomeTransition(game.level - 1);
    
    // Check for boss level - enter BOSS_ALERT state
    if (game._levelConfig.isBoss) {
      // Reset boss-alert cinematic state every boss level so repeated full runs
      // or replays in the same session always rebuild the authored intro cleanly.
      game._bossCinematicInit = false;
      game._bossCinematicCleaned = false;
      game._alertSound2 = false;
      game._cinFinalBoss = null;
      game._cinFinalMoonGroup = null;
      game._cinFinalMoonCore = null;
      game._cinFinalMoonGlow = null;
      game._cinFinalBurst = null;
      game._cinFinalMeteorGroup = null;
      game._cinFinalMeteorGeo = null;
      game.state = State.BOSS_ALERT;
      game.stateTimer = game.level >= 20 ? 7.4 : 3.0; // Final boss gets a longer authored arrival
      // Start boss music immediately at alert screen
      const bossTier = getBossTier(game.level);
      playBossMusic(bossTier);
      playBossAlertSound();
      game._pendingBossName = getBossNameForLevel(game.level);
      showBossAlert(
        game.level >= 20 ? '⚠ FINAL BOSS ⚠' : '⚠ INCOMING BOSS ⚠',
        game.level >= 20 ? 'ECLIPSE ENGINE' : (game._pendingBossName || '')
      );
      playIncomingBossSound();
      _log(`[game] Boss alert for level ${game.level} - boss music started`);
      
      // Hide blaster displays during alert
      blasterDisplays.forEach(d => { if (d) d.visible = false; });
      
      game.justBossKill = false;
    }
    // After boss kill with biome transition, show ready screen with countdown
    else if (game.justBossKill && shouldFade) {
      _log('[game] Boss killed with biome transition, showing ready screen');
      game.state = State.READY_SCREEN;
      applyEnvironmentFade(1);

      // CRITICAL: Apply new biome theme after boss kill
      applyThemeForLevel(game.level);

      // Dismiss the boss death overlay now that the new biome is set up.
      // The environment is at full fade so nothing pops back.
      dismissBossDeathOverlay();

      // Show ready screen with countdown
      showReadyScreen(game.level, getAdjustedCameraPosition());
      resetReadyCountdown();

      // Setup kills remaining alert for the new level
      setupKillsAlert();

      if (game.level === 6) {
        playMusic('levels6to10');
      } else if (game.level === 11) {
        playMusic('levels11to14');
      } else if (game.level === 16) {
        playMusic('levels16to19');
      }
      
      // Start environment fade in
      startEnvironmentFade('in', 0.8);
      
      // Hide blaster displays during ready screen
      blasterDisplays.forEach(d => { if (d) d.visible = false; });
      
      game.justBossKill = false;
    } else {
      game.state = State.PLAYING;
      if (shouldFade) {
        applyEnvironmentFade(1);
        dismissBossDeathOverlay();
        startEnvironmentFade('in', 0.8);
      } else {
        applyEnvironmentFade(0);
        dismissBossDeathOverlay();
      }
      hideReadyScreen();
      showHUD();

      // Stagger setup
      game.spawnTimer = 1.0;

      // Hide blaster displays during gameplay
      blasterDisplays.forEach(d => { if (d) d.visible = false; });

      // Setup kills remaining alert
      setupKillsAlert();

      if (game.level === 6) {
        playMusic('levels6to10');
      } else if (game.level === 11) {
        playMusic('levels11to14');
      } else if (game.level === 16) {
        playMusic('levels16to19');
      }
      
      game.justBossKill = false;
    }
  }
}

// ── Pause System ───────────────────────────────────────────
// [CORE] Toggle game pause
function togglePause() {
  if (game.state === State.PLAYING) {
    game.state = State.PAUSED;
    showPauseMenu();
    // Release pointer lock when pausing
    if (document.pointerLockElement) {
      document.exitPointerLock();
    }
  } else if (game.state === State.PAUSED) {
    startPauseCountdown();
  }
}

// [CORE] Start pause countdown before resuming
function startPauseCountdown() {
  if (pauseCountdownActive) return;
  hidePauseMenu();
  pauseCountdownActive = true;
  pauseCountdownStartTime = performance.now();
  pauseCountdownLastValue = Math.ceil(PAUSE_COUNTDOWN_DURATION);
  pauseCountdown = PAUSE_COUNTDOWN_DURATION;
  showPauseCountdown(pauseCountdown);
  updatePauseCountdownDisplay(pauseCountdown);
  playCountdown321();  // 321 sound triggers on the "3"
}

// [CORE] Update pause countdown display
function updatePauseCountdown(now) {
  if (!pauseCountdownActive) return;
  const elapsed = (now - pauseCountdownStartTime) / 1000;
  const remaining = PAUSE_COUNTDOWN_DURATION - elapsed;
  if (remaining <= 0) {
    pauseCountdownActive = false;
    pauseCountdown = 0;
    hidePauseCountdown();
    game.state = State.PLAYING;
    // Validate controller handedness after resuming from pause (Quest sleep/wake)
    if (renderer.xr.isPresenting) {
      validateControllerHandedness();
    }
    // Re-request pointer lock when resuming (suppress error if user just exited)
    if (!renderer.xr.isPresenting && isDesktopEnabled()) {
      try {
        document.body.requestPointerLock?.();
      } catch (e) {
        // SecurityError is expected if user just exited pointer lock via ESC
        console.debug('[pause] Pointer lock request deferred (user exit)');
      }
    }
    return;
  }

  pauseCountdown = remaining;
  const displayValue = Math.ceil(remaining);
  if (displayValue !== pauseCountdownLastValue) {
    pauseCountdownLastValue = displayValue;
    updatePauseCountdownDisplay(pauseCountdown);
  }
}

// [CORE] Set kill tracking data before endGame
const ENEMY_DISPLAY_NAMES = {
  basic: 'DRONE',
  fast: 'DART',
  tank: 'TANK',
  swarm: 'SWARM',
  spiral_swimmer: 'SERPENT',
  jelly: 'JELLY',
  mortar: 'MORTAR',
  conductor: 'CONDUCTOR',
  mirror_knight: 'MIRROR KNIGHT',
};

function setKilledBy(info) {
  game.killedBy = info;
}

// [CORE] End game (victory or game over)
function endGame(victory) {
  _log(`[game] Game ${victory ? 'won' : 'over'} — score: ${game.score}`);
  resetAllSlowMoState();
  game.state = victory ? State.VICTORY : State.GAME_OVER;
  game.finalScore = game.score;
  game.finalLevel = game.level;

  // Record death stats to Supabase (game over only)
  if (!victory && game.killedBy) {
    fetch('/api/death-stats', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        killerType: game.killedBy.type,
        killerName: game.killedBy.name,
        killerEnemyType: game.killedBy.enemyType || '',
        levelReached: game.level,
      }),
    }).catch(() => {}); // Fire-and-forget
  }
  clearAllEnemies();
  clearBoss();
  clearBossProjectiles();
  clearAllTelegraphs();

  // PERFORMANCE: Clear all projectiles on game end
  clearAllProjectiles();

  // Clear all alt-weapon effects
  clearAllAltWeaponEffects();

  hideHUD();
  hideBossHealthBar();
  gameOverCooldown = 2.0;  // 2 second cooldown before restart allowed

  // Release pointer lock so player can interact with end-game menus
  if (document.pointerLockElement) document.exitPointerLock();

  // Stop music and play game over track
  stopMusic();
  stopLightningSound();

  if (victory) {
    showVictory(game.score, getAdjustedCameraPosition());
  } else {
    showGameOver(game.score, getAdjustedCameraPosition(), game.killedBy);
    // Play game over music (no loop - play once)
    playMusic('gameOver', false);
  }
}

// ============================================================
// SHOOTING & COMBAT
// Projectile pool, weapon firing, hit detection, explosions
// HOT PATH: updateProjectiles() called every frame
// ============================================================

// Screen shake trigger function
// [CORE] Trigger screen shake effect
function triggerScreenShake(intensity, duration) {
  screenShakeIntensity = intensity;
  screenShakeTime = performance.now() + duration;
  if (DEBUG) console.log(`[Shake] Intensity: ${intensity}, Duration: ${duration}ms`);
}

// ============================================================
// PROJECTILE POOL MANAGEMENT
// InstancedMesh pools for laser, buckshot, seeker, plasma_carbine
// HOT PATH: getPooledProjectile, returnProjectileToPool, commit()
// COUPLING: instancedProjectiles, projectileInstanceData arrays
// ============================================================

// PERFORMANCE: Initialize InstancedMesh projectile pools
// One InstancedMesh per projectile type = minimal draw calls.
// Each instance is positioned via setMatrixAt(), colored via setColorAt().
// TWIN-MESH: Core mesh + Fresnel glow mesh for visibility.
// [CORE] Initialize instanced mesh projectile pools
function initProjectilePool() {
  if (instancedProjectiles['laser']) return;

  // ── Laser bolts (standard blaster) ──
  const laserGeo = new THREE.CylinderGeometry(0.03, 0.03, 1.0, 6);
  laserGeo.rotateX(Math.PI / 2);
  const laserMat = createProjectileMaterial(0xffffff);
  registerPlayerProjectileMaterial(laserMat);
  const laserIM = new THREE.InstancedMesh(laserGeo, laserMat, 120);
  laserIM.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  laserIM.count = 0;
  laserIM.frustumCulled = false;
  laserIM.renderOrder = 950;
  scene.add(laserIM);
  instancedProjectiles['laser'] = { mesh: laserIM, maxCount: 120, freeIndices: new Set() };

  // ── Buckshot pellets ──
  const buckGeo = new THREE.SphereGeometry(0.05, 6, 6);
  const buckMat = createProjectileMaterial(0xffffff);
  registerPlayerProjectileMaterial(buckMat);
  const buckIM = new THREE.InstancedMesh(buckGeo, buckMat, 40);
  buckIM.name = 'buckshot-instanced';
  buckIM.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  buckIM.count = 0;
  buckIM.frustumCulled = false;
  buckIM.renderOrder = 950;
  scene.add(buckIM);
  instancedProjectiles['buckshot'] = { mesh: buckIM, maxCount: 40, freeIndices: new Set() };

  // ── Seeker burst bolts: tadpole/sperm shape via LatheGeometry ──
  // Profile curve (radius at each Z position), revolved around Y axis, then rotated to point -Z
  const seekerProfile = new THREE.CurvePath();
  const seekerPts = [
    new THREE.Vector2(0.0, 0.0),    // z=-0.06 tip of head
    new THREE.Vector2(0.06, 0.03),  // z=-0.04 widest head (1.5x)
    new THREE.Vector2(0.03, 0.09), // z=0 neck
    new THREE.Vector2(0.012, 0.165),// z=0.05 tail start
    new THREE.Vector2(0.003, 0.315),// z=0.15 tail end
  ];
  const seekerCurve = new THREE.SplineCurve(seekerPts);
  const seekerGeo = new THREE.LatheGeometry(seekerCurve.getPoints(20), 8, 0, Math.PI * 2);
  // LatheGeometry revolves around Y axis: profile X=radius, Y=height
  // Rotate so head points -Z (forward) and tail extends +Z
  seekerGeo.rotateX(Math.PI / 2);
  const seekerMat = createProjectileMaterial(0xffffff);
  registerPlayerProjectileMaterial(seekerMat);
  const seekerIM = new THREE.InstancedMesh(seekerGeo, seekerMat, 60);
  seekerIM.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  seekerIM.count = 0;
  seekerIM.frustumCulled = false;
  seekerIM.renderOrder = 950;
  scene.add(seekerIM);
  instancedProjectiles['seeker'] = { mesh: seekerIM, maxCount: 60, freeIndices: new Set() };

  // ── Plasma carbine darts ──
  // PERFORMANCE: Bumped from 30 to 80 to support dual wield + fire rate upgrades
  const plasmaGeo = new THREE.CylinderGeometry(0.0375, 0.0375, 0.5, 6);
  plasmaGeo.rotateX(Math.PI / 2);
  const plasmaMat = createProjectileMaterial(0xffffff);
  registerPlayerProjectileMaterial(plasmaMat);
  const plasmaIM = new THREE.InstancedMesh(plasmaGeo, plasmaMat, 80);
  plasmaIM.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  plasmaIM.count = 0;
  plasmaIM.frustumCulled = false;
  plasmaIM.renderOrder = 950;
  scene.add(plasmaIM);
  instancedProjectiles['plasma_carbine'] = { mesh: plasmaIM, maxCount: 80, freeIndices: new Set() };

  Object.keys(projectileInstanceData).forEach(poolType => {
    const maxCount = instancedProjectiles[poolType].maxCount;
    for (let i = 0; i < maxCount; i++) {
      projectileInstanceData[poolType].push(null);
    }
  });

  // ── Player projectile glow planes (Star Wars-style bloom) ──
  // Create separate glow textures per weapon type with matching colors
  function createGlowTexture(r, g, b) {
    const size = 64;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    const half = size / 2;
    const grad = ctx.createRadialGradient(half, half, 0, half, half, half);
    grad.addColorStop(0, `rgba(255,255,255,1)`);       // Bright white core
    grad.addColorStop(0.2, `rgba(${Math.floor(r*255)},${Math.floor(g*255)},${Math.floor(b*255)},0.7)`);
    grad.addColorStop(0.5, `rgba(${Math.floor(r*200)},${Math.floor(g*200)},${Math.floor(b*200)},0.3)`);
    grad.addColorStop(1, `rgba(${Math.floor(r*100)},${Math.floor(g*100)},${Math.floor(b*100)},0)`);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, size, size);
    const tex = new THREE.CanvasTexture(canvas);
    tex.minFilter = THREE.LinearFilter;
    return tex;
  }

  // Weapon glow colors (weapon identity colors, not hand-based)
  // Standard blaster: cyan left / pink right (per hand)
  // Other weapons: single identity color
  const glowTextures = {
    laser: createGlowTexture(0.0, 1.0, 1.0),              // Cyan (standard blaster left)
    laser_right: createGlowTexture(1.0, 0.0, 1.0),        // Pink (standard blaster right)
    buckshot: createGlowTexture(1.0, 0.53, 0.0),          // Orange #ff8800
    seeker: createGlowTexture(0.51, 1.0, 0.17),           // Lightsaber green #83FF2B
    plasma_carbine: createGlowTexture(0.64, 0.31, 0.71),  // Purple #A450B6
  };

  // Create glow pool for each projectile type
  // Standard blaster (laser) gets two pools: cyan for left, pink for right
  // Other weapons get a single identity-colored pool
  const glowGeo = new THREE.PlaneGeometry(0.35, 0.35);
  const glowPoolConfigs = [
    { poolType: 'laser', texKey: 'laser', count: 60 },
    { poolType: 'laser_right', texKey: 'laser_right', count: 60 },
    { poolType: 'buckshot', texKey: 'buckshot', count: instancedProjectiles['buckshot'].maxCount },
    { poolType: 'seeker', texKey: 'seeker', count: instancedProjectiles['seeker'].maxCount },
    { poolType: 'plasma_carbine', texKey: 'plasma_carbine', count: instancedProjectiles['plasma_carbine'].maxCount },
  ];

  for (const cfg of glowPoolConfigs) {
    const glowTex = glowTextures[cfg.texKey] || glowTextures.laser;
    const glowMat = new THREE.MeshBasicMaterial({
      map: glowTex,
      transparent: true,
      opacity: 0.8,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      depthTest: true,
      side: THREE.DoubleSide,
    });
    registerPlayerProjectileMaterial(glowMat);

    const glowIM = new THREE.InstancedMesh(glowGeo, glowMat, cfg.count);
    glowIM.name = `${cfg.poolType}-glow-pool`;
    glowIM.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    glowIM.count = 0;
    glowIM.frustumCulled = false;
    glowIM.renderOrder = 949;  // Just behind the projectile cores (950)
    glowIM.visible = true;
    scene.add(glowIM);

    // Store glow pool reference
    // laser -> laser glow, laser_right -> laser glow (both map to 'laser' projectile pool)
    if (cfg.poolType === 'laser_right') {
      instancedProjectiles['laser'].glowMeshRight = glowIM;
    } else {
      instancedProjectiles[cfg.poolType].glowMesh = glowIM;
    }

    // Initialize all glow instances as hidden (scale 0)
    const hideMatrix = new THREE.Matrix4().makeScale(0, 0, 0);
    for (let i = 0; i < cfg.count; i++) {
      glowIM.setMatrixAt(i, hideMatrix);
    }
    glowIM.instanceMatrix.needsUpdate = true;
  }

  _log('[performance] InstancedMesh projectile pools initialized: laser(120), buckshot(40), seeker(28), plasma_carbine(80) + glow planes');
}

// PERFORMANCE: Acquire an instance slot from the InstancedMesh pool.
// Returns { index, pool } or null if pool exhausted.
// [CORE] Get a pooled projectile from the instanced mesh pool
function getPooledProjectile(poolType, color) {
  const pool = instancedProjectiles[poolType];
  if (!pool) return null;

  // Find a free slot
  let slotIndex = -1;
  if (pool.freeIndices.size > 0) {
    slotIndex = pool.freeIndices.values().next().value;
    pool.freeIndices.delete(slotIndex);
  } else if (pool.mesh.count < pool.maxCount) {
    slotIndex = pool.mesh.count;
    pool.mesh.count = slotIndex + 1;
  } else {
    // Pool exhausted - try to recycle oldest
    return null;
  }

  pool.mesh.setColorAt(slotIndex, _projColor.setHex(color));
  pool.mesh.instanceColor.needsUpdate = true;

  // Reset transforms so projectile + glow twins start hidden
  _projMatrix.makeScale(0, 0, 0);
  commitProjectileInstance(poolType, slotIndex, _projMatrix);

  // Initialize instance data
  if (!projectileInstanceData[poolType][slotIndex]) {
    projectileInstanceData[poolType][slotIndex] = {};
  }
  const data = projectileInstanceData[poolType][slotIndex];
  data.active = true;
  data.poolType = poolType;
  data.instanceIndex = slotIndex;
  data.position = new THREE.Vector3();
  data.quaternion = new THREE.Quaternion();

  // Return a lightweight proxy object that updateProjectiles() can use
  // This proxy mimics the old mesh interface: .position, .userData, .visible
  return createProjectileProxy(poolType, slotIndex, color);
}

// Create a proxy object that mimics THREE.Mesh for projectile compatibility.
// The proxy tracks position/rotation in the parallel data array and syncs
// to the InstancedMesh via commitProjectileInstance().
// [CORE] Create projectile proxy for instanced rendering
function createProjectileProxy(poolType, instanceIndex, color) {
  const pool = instancedProjectiles[poolType];
  const data = projectileInstanceData[poolType][instanceIndex];

  // Proxy position that writes to InstancedMatrix on commit
  const pos = new THREE.Vector3();

  const proxy = {
    // Compatible with existing code that checks these
    visible: true,
    userData: {
      isPooled: true,
      poolType: poolType,
      instanceIndex: instanceIndex,
      velocity: null,
      stats: null,
      controllerIndex: undefined,
      isExploding: undefined,
      lifetime: undefined,
      createdAt: undefined,
      hitEnemies: null,
      shotId: undefined,
      hitConfirmed: false,
      homingRange: 0,
      homingStrength: 0,
      baseSpeed: 0,
      homingTarget: null,
      tailPhase: 0,
      tailSpeed: 0,
      direction: null,
      speed: 0,
      wigglePhase: Math.random() * Math.PI * 2,
      damage: 0,
      duration: 0,
      isBossProjectile: false,
      isDecoy: false,
      explosionRadius: 0,
      explosionDamage: 0,
      naniteInfused: false,
      isDroneProjectile: false,
    },
    // Position accessor - returns a vector that we sync to the instance matrix
    get position() { return pos; },
    set position(v) { pos.copy(v); },
    // Quaternion for orientation
    get quaternion() { return data.quaternion; },
    set quaternion(q) { data.quaternion.copy(q); },
    // Children accessor (compatibility for seeker visual updates)
    children: [],
    // Material (compatibility)
    material: pool.mesh.material,
  };

  // Sync position to the InstancedMesh pair (core + glow)
  proxy.commit = function() {
    _projMatrix.compose(pos, data.quaternion, _projScale);
    commitProjectileInstance(poolType, instanceIndex, _projMatrix, proxy._controllerIndex);
  };

  return proxy;
}

// Reusable temp objects for glow billboarding
const _projGlowMat = new THREE.Matrix4();
const _projGlowQuat = new THREE.Quaternion();
const _projGlowScale = new THREE.Vector3(1, 1, 1);
const _projGlowScale0 = new THREE.Vector3(0, 0, 0);
const _projGlowPos = new THREE.Vector3();
const _projGlowTmpQ = new THREE.Quaternion();
const _projGlowScl = new THREE.Vector3();
const _upVec = new THREE.Vector3(0, 1, 0);

// [CORE] Commit projectile instance transform to instanced mesh + glow billboard
function commitProjectileInstance(poolType, instanceIndex, matrix, controllerIndex) {
  const pool = instancedProjectiles[poolType];
  if (!pool) return;
  pool.mesh.setMatrixAt(instanceIndex, matrix);
  pool.mesh.instanceMatrix.needsUpdate = true;

  // Select glow mesh: laser pool uses left/right glow based on controller
  let glow = pool.glowMesh;
  if (poolType === 'laser' && pool.glowMeshRight) {
    glow = (controllerIndex === 1) ? pool.glowMeshRight : pool.glowMesh;
  }

  // Keep glow mesh count in sync with core
  if (glow && glow.count < pool.mesh.count) {
    glow.count = pool.mesh.count;
  }

  // Update glow billboard plane (if pool has one)
  if (glow && camera) {
    _projGlowPos.setFromMatrixPosition(matrix);
    matrix.decompose(_projGlowPos, _projGlowTmpQ, _projGlowScl);
    const isHidden = _projGlowScl.x < 0.001;
    // Re-get position since decompose overwrites it
    _projGlowPos.setFromMatrixPosition(matrix);

    if (isHidden) {
      glow.setMatrixAt(instanceIndex, _projGlowMat.compose(_projGlowPos, _projGlowQuat, _projGlowScale0));
    } else {
      _projGlowMat.lookAt(_projGlowPos, camera.position, _upVec);
      _projGlowQuat.setFromRotationMatrix(_projGlowMat);
      glow.setMatrixAt(instanceIndex, _projGlowMat.compose(_projGlowPos, _projGlowQuat, _projGlowScale));
    }
    glow.instanceMatrix.needsUpdate = true;
  }
}

// PERFORMANCE: Return projectile instance to pool (deactivate)
// [CORE] Return projectile to pool for reuse
function returnProjectileToPool(proj) {
  if (!proj || !proj.userData) return;

  const poolType = proj.userData.poolType;
  const instanceIndex = proj.userData.instanceIndex;

  if (poolType && instanceIndex !== undefined && instancedProjectiles[poolType]) {
    const pool = instancedProjectiles[poolType];

    // Hide instance by scaling to zero
    _projMatrix.makeScale(0, 0, 0);
    commitProjectileInstance(poolType, instanceIndex, _projMatrix, proj.userData.controllerIndex);

    // Also hide right-hand glow if laser pool
    if (poolType === 'laser' && pool.glowMeshRight) {
      const rightGlow = pool.glowMeshRight;
      if (rightGlow.count > instanceIndex) {
        rightGlow.setMatrixAt(instanceIndex, _projMatrix);
        rightGlow.instanceMatrix.needsUpdate = true;
      }
    }

    // Mark as free (DO NOT shrink count - can hide active instances at higher indices)
    pool.freeIndices.add(instanceIndex);

    // Clear instance data
    if (projectileInstanceData[poolType][instanceIndex]) {
      const d = projectileInstanceData[poolType][instanceIndex];
      d.active = false;
      // Reset all userData fields
      const ud = proj.userData;
      ud.velocity = null;
      ud.stats = null;
      ud.controllerIndex = undefined;
      ud.isExploding = undefined;
      ud.lifetime = undefined;
      ud.createdAt = undefined;
      ud.hitEnemies = null;
      ud.homingRange = 0;
      ud.homingStrength = 0;
      ud.baseSpeed = 0;
      ud.homingTarget = null;
      ud.tailPhase = 0;
      ud.tailSpeed = 0;
      ud.direction = null;
      ud.speed = 0;
      ud.damage = 0;
      ud.duration = 0;
      ud.isBossProjectile = false;
      ud.isDecoy = false;
      ud.naniteInfused = false;
      ud.isDroneProjectile = false;
    }
  } else {
    // Fallback for non-instanced projectiles (hostile projectiles, decoys, etc.)
    proj.visible = false;
  }
}

// [CORE] Check if projectile is hostile (boss projectile)
function isHostileProjectile(proj) {
  return !!(proj && proj.userData && (proj.userData.isBossProjectile || (proj.userData.damage && !proj.userData.stats)));
}

// [CORE] Trigger hostile projectile explosion effect
function triggerHostileProjectileExplosion(position, radius, damage) {
  const blastPos = position.clone();
  spawnExplosionVisual(blastPos, radius);
  if (typeof window !== 'undefined' && typeof window.createExplosionAt === 'function' && damage > 0) {
    window.createExplosionAt(blastPos, radius, damage);
  }
}

// [CORE] Spawn boss projectile destruction VFX
function spawnBossProjectileDestructionFX(position, projColor) {
  // Debris: orange/warm voxels matching boss projectile orb color
  const sparkCount = 4 + Math.floor(Math.random() * 3); // 4-6
  const bossDebrisColor = 0xff8833; // Warm orange matching boss projectile orb
  spawnVoxelExplosion(position.clone(), bossDebrisColor, sparkCount, 'basic', false, false);
  // Scale to 55% (larger than old 30%, still smaller than enemy 100%)
  for (let i = Math.max(0, activeVoxels.length - sparkCount); i < activeVoxels.length; i++) {
    activeVoxels[i].scale.setScalar(0.55);
    activeVoxels[i].userData.isBossDebris = true;
    // Acquire a glow plane for this debris bit
    if (_debrisGlowFree.length > 0) {
      const gIdx = _debrisGlowFree.pop();
      if (gIdx >= _debrisGlowPool.count) _debrisGlowPool.count = gIdx + 1;
      _debrisGlowActive.push({ voxel: activeVoxels[i], glowIdx: gIdx });
    }
  }
  // Play fizzle sound (throttled in audio.js to avoid spam)
  playBossProjectileDestroySound();
}

const SEEKER_RETARGET_INTERVAL_MS = 120;

// [CORE] Update seeker projectile visual (homing curve)
function updateSeekerProjectileVisual(proj, dt) {
  if (!proj || !proj.children || proj.children.length < 2) return;
  proj.userData.tailPhase = (proj.userData.tailPhase || Math.random() * Math.PI * 2) + dt * (proj.userData.tailSpeed || 18);
  const head = proj.children[0];
  const tail = proj.children[1];
  const glow = proj.children[2];
  const sway = Math.sin(proj.userData.tailPhase) * 0.06;
  tail.rotation.z = sway;
  tail.scale.y = 0.85 + Math.sin(proj.userData.tailPhase * 1.7) * 0.12;
  head.position.x = Math.sin(proj.userData.tailPhase * 0.5) * 0.01;
  if (glow && glow.material) {
    glow.material.opacity = 0.18 + Math.sin(proj.userData.tailPhase * 1.5) * 0.08;
  }
}

// [CORE] Find nearest enemy target for seeker projectile
function findSeekerTarget(proj) {
  const homingRange = proj.userData.homingRange || 0;
  if (homingRange <= 0) return null;
  const enemies = getEnemies();

  let nearestTarget = null;
  let nearestDistSq = homingRange * homingRange;
  for (let i = 0; i < enemies.length; i++) {
    const mesh = enemies[i]?.mesh;
    if (!mesh) continue;
    const distSq = mesh.position.distanceToSquared(proj.position);
    if (distSq < nearestDistSq) {
      nearestDistSq = distSq;
      nearestTarget = mesh;
    }
  }

  const boss = getBoss();
  if (boss?.mesh) {
    const bossDistSq = boss.mesh.position.distanceToSquared(proj.position);
    if (bossDistSq < nearestDistSq) {
      nearestTarget = boss.mesh;
    }
  }

  return nearestTarget;
}

// [CORE] Update hostile projectile visual effects
function updateHostileProjectileVisual(proj, now) {
  if (!proj) return;
  const pulse = 0.75 + Math.sin(now * 0.012 + (proj.userData.glowPhase || 0)) * 0.25;
  if (proj.material) {
    proj.material.opacity = Math.min(1, 0.8 + pulse * 0.2);
  }
  if (proj.children) {
    proj.children.forEach((child, index) => {
      if (!child.material) return;
      if (index === 0) {
        child.scale.setScalar(0.9 + pulse * 0.15);
      } else {
        child.scale.setScalar(0.95 + pulse * 0.3);
        child.material.opacity = Math.min(1, 0.25 + pulse * 0.4);
      }
    });
  }
}

// ============================================================
// VOXEL PHYSICS DEATH SYSTEM
// Pooled voxels for enemy death explosions
// MAIN WEAPON FIRING
// fireMainWeapon, lightning beams, charge shots, plasma carbine
// HOT PATH: Called every frame when trigger held during PLAYING
// COUPLING: weaponCooldowns, chargeShotStartTime, projectiles[]
// ============================================================
// [CORE] Fire main weapon (pistol, shotgun, etc.)
function fireMainWeapon(controller, index) {
  const now = performance.now();
  const hand = getHandForController(index);
  const mainWeaponId = game.mainWeapon[hand];
  const stats = getWeaponStats(mainWeaponId, game.upgrades[hand]);

  // Lightning beam mode - handled separately in update loop
  if (stats.lightning) {
    return;  // Lightning is continuous hold-to-fire
  }

  // Charge shot mode - handled separately, fires on trigger release
  if (stats.chargeShot) {
    return;  // Charge shot fires on release, not on press
  }

  // Check cooldown
  if (now - weaponCooldowns[index] < stats.fireInterval) return;
  weaponCooldowns[index] = now;

  const origin = new THREE.Vector3();
  const quat = new THREE.Quaternion();
  controller.getWorldPosition(origin);
  controller.getWorldQuaternion(quat);
  const direction = new THREE.Vector3(0, 0, -1).applyQuaternion(quat);

  // Muzzle flash effect
  if (ENABLE_MUZZLE_FLASH) {
    showMuzzleFlash(origin, direction);
  }

  // [DEBUG] Projectile investigation logging in fireMainWeapon
  if (window.DEBUG_PROJECTILES) {
    const handLabel = index === 0 ? 'LEFT' : 'RIGHT';
  }

  // Fire projectile(s)
  const count = stats.projectileCount;
  const shotId = startAccuracyShot(count, hand);
  // Use same threshold as spawnProjectile to prevent plasma carbine from being treated as buckshot
  const BUCKSHOT_SPREAD_THRESHOLD = 0.087; // ~5 degrees
  const isBuckshot = (stats.spreadAngle || 0) > BUCKSHOT_SPREAD_THRESHOLD && !stats.homing;

  // Calculate perpendicular offset axis for multi-shot
  const rightAxis = new THREE.Vector3(1, 0, 0).applyQuaternion(quat);
  const upAxis = new THREE.Vector3(0, 1, 0).applyQuaternion(quat);
  const gap = 0.08; // Gap between parallel shots

  // BURST FIRE for seeker weapons: rapid succession with spread
  if (stats.homing && count > 1) {
    const now = performance.now();
    for (let i = 0; i < count; i++) {
      // Add random spread angle (like buckshot but for homing)
      const spreadAngle = THREE.MathUtils.degToRad(3 + Math.random() * 5); // 3-8 degrees
      const spreadDir = direction.clone();
      
      // Random spread direction
      const spreadRight = (Math.random() - 0.5) * 2;
      const spreadUp = (Math.random() - 0.5) * 2;
      spreadDir.addScaledVector(rightAxis, spreadRight * Math.sin(spreadAngle));
      spreadDir.addScaledVector(upAxis, spreadUp * Math.sin(spreadAngle));
      spreadDir.normalize();

      // Queue shot with delay for burst effect
      const isLastShot = i === count - 1;
      seekerBurstQueue.push({
        origin: origin.clone(),
        direction: spreadDir,
        controllerIndex: index,
        stats: stats,
        shotId: shotId,
        fireTime: now + i * SEEKER_BURST_DELAY,
        isLastShot: isLastShot,
        burstIndex: i,
        totalShots: count
      });
    }
    // Play first shot sound (staccato "p")
    playSeekerBurstSound(false, count);
  } else {
    // Standard simultaneous fire for non-homing weapons
    // Suppress per-projectile sounds and play a single batched sound below
    // to avoid audio overload from projectile sound stacking (Issue #10).
    const multiProjectile = count > 1;
    for (let i = 0; i < count; i++) {
      let spawnOrigin = origin.clone();

      if (count > 1 && !isBuckshot) {
        // Position shots side-by-side with small gap, all parallel
        // Spread evenly around center: for 2 shots [-0.5, 0.5], for 3 [-1, 0, 1], etc.
        const offsetIndex = i - (count - 1) / 2;
        spawnOrigin.addScaledVector(rightAxis, offsetIndex * gap);
      }

      spawnProjectile(spawnOrigin, direction, index, stats, shotId, { suppressSound: multiProjectile });
    }
    // Play a single batched sound for multi-projectile shots
    if (multiProjectile) {
      if (isBuckshot) {
        playBuckshotSound(count);
      } else {
        playShoothSound(count);
      }
    }
  }
}

/**
 * Handle the continuous lightning beam while the trigger is held.
 * fireMainWeapon() returns early for lightning weapons, then the main update loop
 * calls this every frame to: (1) read the controller pose, (2) grab nearby enemies
 * from the spatial hash, (3) maintain the beam visuals/sound, and (4) tick damage
 * on lightningTickInterval. This keeps lightning weapons feel like hold-to-fire beams
 * without going through the projectile system.
 */
// [CORE] Update lightning beam weapon (continuous beam)
// Issue #22: Always fires forward. Curves toward enemies if nearby.
// Forward beam hits and destroys boss projectiles.
const LIGHTNING_FORWARD_RANGE = 30;  // Max forward beam length (units)
const LIGHTNING_BOSS_PROJ_RADIUS_SQ = 1.0;  // Hit radius squared for boss projectile intersection

function updateLightningBeam(controller, index, stats, dt) {
  controller.getWorldPosition(_lightningOrigin);
  controller.getWorldQuaternion(_lightningQuat);
  _lightningDirCalc.set(0, 0, -1).applyQuaternion(_lightningQuat);

  // Calculate forward beam endpoint
  _lightningForwardEnd.copy(_lightningOrigin).addScaledVector(_lightningDirCalc, LIGHTNING_FORWARD_RANGE);

  // Find enemies within lock-on range using spatial hash
  const nearbyEnemies = enemySpatialHash.query(_lightningOrigin.x, _lightningOrigin.z, stats.lightningRange);
  const targets = [];
  const maxChains = 2 + Math.floor(stats.lightningRange / 8);
  const lightningRangeSq = stats.lightningRange * stats.lightningRange;

  for (const e of nearbyEnemies) {
    // Verify enemy is still valid (alive, mesh present, and registered in enemy list)
    if (!e || !e.mesh || !e.mesh.parent || e.hp <= 0) continue;
    const distSq = e.mesh.position.distanceToSquared(_lightningOrigin);
    _lightningToEnemy.copy(e.mesh.position).sub(_lightningOrigin).normalize();
    const angle = _lightningToEnemy.dot(_lightningDirCalc);

    // Within range and roughly in front (45° cone)
    if (distSq < lightningRangeSq && angle > 0.7) {
      targets.push({ enemy: e, distSq });
    }
  }

  // Sort by distance, take closest N
  targets.sort((a, b) => a.distSq - b.distSq);
  const chainCount = Math.min(targets.length, maxChains);

  // Always show beam (sound + visuals)
  startLightningSound();
  const beam = ensureLightningBeam(index);
  const positions = beam.userData.positions;
  let offset = 0;

  // Draw beam forward from controller
  _lightningLastPos.copy(_lightningOrigin);

  if (chainCount > 0) {
    // First segment: forward beam then curve to first target
    // Draw a short forward segment, then zigzag to each target
    _lightningMidPoint.copy(_lightningOrigin).addScaledVector(_lightningDirCalc, 2.0);  // 2 units forward before curving
    offset = writeLightningBoltPositions(_lightningOrigin, _lightningMidPoint, positions, offset);
    for (let ti = 0; ti < chainCount; ti++) {
      const targetPos = targets[ti].enemy.mesh.position;
      const startPos = ti === 0 ? _lightningMidPoint : targets[ti - 1].enemy.mesh.position;
      offset = writeLightningBoltPositions(startPos, targetPos, positions, offset);
    }
  } else {
    // No enemies: straight forward beam
    offset = writeLightningBoltPositions(_lightningOrigin, _lightningForwardEnd, positions, offset);
  }

  beam.geometry.attributes.position.needsUpdate = true;
  beam.geometry.setDrawRange(0, offset / 3);
  beam.visible = offset > 0;

  // Check boss projectile intersection with forward beam segment
  const bossProjectiles = getBossProjectiles();
  if (bossProjectiles.length > 0) {
    // Use origin -> forwardEnd as the beam line for intersection
    const beamStart = chainCount > 0 ? _lightningOrigin : _lightningOrigin;
    const beamEnd = _lightningForwardEnd;
    for (let i = bossProjectiles.length - 1; i >= 0; i--) {
      const bossProj = bossProjectiles[i];
      if (!bossProj) continue;
      const distSq = pointToSegmentDistSq(bossProj.position, beamStart, beamEnd);
      if (distSq < LIGHTNING_BOSS_PROJ_RADIUS_SQ) {
        spawnBossProjectileDestructionFX(bossProj.position.clone());
        if (bossProj._instIdx !== undefined) releaseBossProjIndex(bossProj._instIdx);
        bossProjectiles.splice(i, 1);
      }
    }
  }

  // Apply damage to enemy targets at tick interval
  if (chainCount > 0) {
    const tickInterval = stats.lightningTickInterval != null ? stats.lightningTickInterval : 0.2;
    lightningTimers[index] += dt;
    if (lightningTimers[index] >= tickInterval) {
      lightningTimers[index] = 0;

      let accuracyHitRegistered = false;
      for (let ti = 0; ti < chainCount; ti++) {
        const { enemy } = targets[ti];
        const liveTarget = enemy?.mesh ? getEnemyByMesh(enemy.mesh) : null;
        const enemyIndex = liveTarget?.index;
        if (enemyIndex === undefined) continue;
        const result = hitEnemy(enemyIndex, stats.lightningDamage);
        if (!accuracyHitRegistered) {
          const oldMultiplier = game.accuracyMultiplier || 1;
          registerAccuracyHit();
          const newMultiplier = game.accuracyMultiplier || 1;
          const oldThreshold = Math.floor(oldMultiplier);
          const newThreshold = Math.floor(newMultiplier);
          if (newThreshold > oldThreshold && newThreshold >= 2) {
            spawnKillChainPopup(newThreshold, camera.position);
            playComboSound(newThreshold);
          }
          accuracyHitRegistered = true;
        }
        spawnDamageNumber(enemy.mesh.position, stats.lightningDamage, '#ffff44');
        playHitSound();
        if (stats.effects && stats.effects.length > 0) applyEffects(enemyIndex, stats.effects);

        if (result.killed) {
          playExplosionSound();
          handleEnemyKilled(enemyIndex, { killsWithoutHit: true });
        }
      }
    }
  }
}

// Pooled temp vectors for lightning bolt generation (per-segment)
const _lightningDir = new THREE.Vector3();
const _lightningPerp = new THREE.Vector3();
const _lightningPrevPoint = new THREE.Vector3();
const _lightningNextPoint = new THREE.Vector3();
const _lightningUp = new THREE.Vector3(0, 1, 0);
const _lightningAltPerp = new THREE.Vector3();

// PERFORMANCE: Scratch vectors for updateLightningBeam hot path
const _lightningOrigin = new THREE.Vector3();
const _lightningQuat = new THREE.Quaternion();
const _lightningDirCalc = new THREE.Vector3();
const _lightningToEnemy = new THREE.Vector3();
const _lightningLastPos = new THREE.Vector3();
const _lightningForwardEnd = new THREE.Vector3();
const _lightningMidPoint = new THREE.Vector3();

// PERFORMANCE: Pooled lightning material (reused across bolts)
const _lightningMaterial = new THREE.LineBasicMaterial({
  color: 0xffff44,
  linewidth: 2,
  transparent: true,
  opacity: 0.9
});

/**
 * Lazily create one persistent lightning beam per hand.
 * VR-CRITICAL: Reusing one geometry avoids per-frame BufferGeometry churn.
 */
function ensureLightningBeam(index) {
  if (lightningBeams[index]) return lightningBeams[index];

  const maxVertices = (MAX_LIGHTNING_CHAINS + 2) * LIGHTNING_BOLT_SEGMENTS * 2;  // +2 for forward beam + midpoint
  const positions = new Float32Array(maxVertices * 3);
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setDrawRange(0, 0);

  const beam = new THREE.LineSegments(geometry, _lightningMaterial);
  beam.name = `lightning-beam-${index}`;
  beam.frustumCulled = false;
  beam.renderOrder = 95;
  beam.visible = false;
  beam.userData.positions = positions;
  scene.add(beam);
  lightningBeams[index] = beam;
  return beam;
}

/**
 * Hide a pooled lightning beam without disposing its shared GPU resources.
 * This keeps trigger spam from causing GC or driver hitches in VR.
 */
function clearLightningBeam(index) {
  const beam = lightningBeams[index];
  if (!beam) return;
  beam.visible = false;
  beam.geometry.setDrawRange(0, 0);
}

/**
 * Write a zig-zag lightning chain into a shared LineSegments position buffer.
 * @returns {number} Updated vertex offset into the Float32Array
 */
function writeLightningBoltPositions(start, end, positions, offset) {
  _lightningDir.subVectors(end, start);
  const length = _lightningDir.length();
  if (length <= 0.0001) {
    return offset;
  }
  _lightningDir.divideScalar(length);
  _lightningPerp.crossVectors(_lightningDir, _lightningUp);
  if (_lightningPerp.lengthSq() < 0.0001) {
    _lightningPerp.set(1, 0, 0);
  } else {
    _lightningPerp.normalize();
  }
  _lightningAltPerp.crossVectors(_lightningDir, _lightningPerp).normalize();

  _lightningPrevPoint.copy(start);
  const zigzagAmount = Math.min(0.28, 0.08 + length * 0.04);

  for (let i = 1; i <= LIGHTNING_BOLT_SEGMENTS; i++) {
    const t = i / LIGHTNING_BOLT_SEGMENTS;
    _lightningNextPoint.lerpVectors(start, end, t);

    if (i < LIGHTNING_BOLT_SEGMENTS) {
      const jitterA = (Math.random() - 0.5) * zigzagAmount;
      const jitterB = (Math.random() - 0.5) * zigzagAmount * 0.45;
      _lightningNextPoint.addScaledVector(_lightningPerp, jitterA);
      _lightningNextPoint.addScaledVector(_lightningAltPerp, jitterB);
    }

    positions[offset++] = _lightningPrevPoint.x;
    positions[offset++] = _lightningPrevPoint.y;
    positions[offset++] = _lightningPrevPoint.z;
    positions[offset++] = _lightningNextPoint.x;
    positions[offset++] = _lightningNextPoint.y;
    positions[offset++] = _lightningNextPoint.z;

    _lightningPrevPoint.copy(_lightningNextPoint);
  }

  return offset;
}

/**
 * Rare-use helper for boss-authored lightning VFX.
 * This is intentionally separate from the player beam pool because bosses fire it
 * infrequently, so a tiny transient line is cheaper than adding another global system.
 */
function spawnTransientLightningBolt(start, end, duration = 120) {
  const maxVertices = LIGHTNING_BOLT_SEGMENTS * 2;
  const positions = new Float32Array(maxVertices * 3);
  const offset = writeLightningBoltPositions(start, end, positions, 0);
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setDrawRange(0, offset / 3);

  const material = _lightningMaterial.clone();
  const bolt = new THREE.LineSegments(geometry, material);
  bolt.name = 'boss-lightning-bolt';
  bolt.frustumCulled = false;
  bolt.userData.createdAt = performance.now();
  bolt.userData.duration = duration;
  scene.add(bolt);
  explosionVisuals.push(bolt);
}

/**
 * Get charge damage based on charge time (Mega Man style curve)
 * @param {number} t - charge time in seconds
 * @returns {number} damage value
 */
// [CORE] Charge cannon damage calculation
function chargeTimeToDamage(t, chargeRateMultiplier = 1, damageMultiplier = 1) {
  // chargeRateMultiplier: from quick_charge upgrade (e.g. 2.0 = half charge time)
  // damageMultiplier: from death_ray upgrade (e.g. 2.0 = double max damage)
  const effectiveMaxTime = CHARGE_SHOT_MAX_TIME / chargeRateMultiplier;
  const clampedT = Math.min(t, effectiveMaxTime);
  const progress = clampedT / effectiveMaxTime;
  const maxDamage = CHARGE_SHOT_MAX_DAMAGE * damageMultiplier;

  return CHARGE_SHOT_MIN_DAMAGE + (maxDamage - CHARGE_SHOT_MIN_DAMAGE) * progress;
}

/**
 * Get charge progress (0-1) for visual effects
 * Uses the same curve as damage for consistent feedback
 */
// [CORE] Charge cannon progress calculation
function chargeTimeToProgress(t, chargeRateMultiplier = 1) {
  const effectiveMaxTime = CHARGE_SHOT_MAX_TIME / chargeRateMultiplier;
  const clampedT = Math.min(t, effectiveMaxTime);
  return clampedT / effectiveMaxTime;
}

/**
 * Create or update charge visual effects on controller
 * - Glowing sphere that gets brighter with charge
 * - Orbiting particles for Mega Man style charging
 * @param {THREE.Controller} controller - The controller
 * @param {number} index - Controller index (0=left, 1=right)
 * @param {number} progress - Charge progress from 0 to 1
 */
// [CORE] Update charge cannon visual effects
function updateChargeVisuals(controller, index, progress) {
  if (!controller || typeof controller.add !== 'function') return;

  // Initialize glow sphere if needed
  if (!chargeGlowSpheres[index]) {
    // Main glow sphere at controller tip
    const glowGeo = new THREE.SphereGeometry(0.05, 16, 16);
    const glowMat = basicMat(0x00ffff, {
      transparent: true,
      opacity: 0.1,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const glowSphere = new THREE.Mesh(glowGeo, glowMat);
    glowSphere.name = 'charge-glow-sphere';
    glowSphere.position.set(0, 0, -0.1);  // In front of controller
    controller.add(glowSphere);
    chargeGlowSpheres[index] = glowSphere;

    // Create orbiting particles (8 small spheres in a ring)
    const particleGroup = new THREE.Group();
    const particleCount = 8;
    for (let i = 0; i < particleCount; i++) {
      const particleGeo = new THREE.SphereGeometry(0.015, 8, 8);
      const particleMat = basicMat(0x00ffff, {
        transparent: true,
        opacity: 0.5,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      });
      const particle = new THREE.Mesh(particleGeo, particleMat);
      particle.name = 'charge-particle';
      particle.userData.orbitAngle = (i / particleCount) * Math.PI * 2;
      particle.userData.orbitRadius = 0.08;
      particleGroup.add(particle);
    }
    particleGroup.position.set(0, 0, -0.1);
    controller.add(particleGroup);
    chargeParticleSystems[index] = particleGroup;
  }

  const glowSphere = chargeGlowSpheres[index];
  const particleGroup = chargeParticleSystems[index];

  if (!glowSphere || !particleGroup) return;

  // Show the effects
  glowSphere.visible = true;
  particleGroup.visible = true;

  // Update glow sphere: scale and color based on charge
  // Scale from 0.05 to 0.15 radius
  const scale = 1 + progress * 2;
  glowSphere.scale.setScalar(scale);

  // Color shifts from cyan (low) to white/pink (high)
  _chargeVisualColor.lerpColors(_chargeBeamBaseColor, _chargeBeamHotColor, progress);
  const color = _chargeVisualColor;
  glowSphere.material.color.copy(color);

  // Opacity increases with charge
  glowSphere.material.opacity = 0.1 + progress * 0.6;

  // Update orbiting particles
  const time = performance.now() * 0.001;
  const orbitSpeed = 2 + progress * 6;  // Faster orbit as charge increases
  const orbitRadius = 0.08 + progress * 0.07;  // Wider orbit as charge increases

  particleGroup.children.forEach((particle, i) => {
    const baseAngle = particle.userData.orbitAngle;
    const angle = baseAngle + time * orbitSpeed;

    particle.position.x = Math.cos(angle) * orbitRadius;
    particle.position.y = Math.sin(angle) * orbitRadius;
    particle.position.z = Math.sin(angle * 0.5) * 0.02;  // Slight wobble

    // Particle color matches glow
    particle.material.color.copy(color);

    // Particles get brighter as charge increases
    particle.material.opacity = 0.3 + progress * 0.7;

    // Particle size increases
    const particleScale = 0.5 + progress * 1.5;
    particle.scale.setScalar(particleScale);
  });
}

/**
 * Hide and clean up charge visual effects
 * @param {number} index - Controller index (0=left, 1=right)
 */
// [CORE] Hide charge cannon visual effects
function hideChargeVisuals(index) {
  if (chargeGlowSpheres[index]) {
    chargeGlowSpheres[index].visible = false;
  }
  if (chargeParticleSystems[index]) {
    chargeParticleSystems[index].visible = false;
  }
}

/**
 * Create persistent charge beam meshes for one hand.
 * VR-CRITICAL: The charge cannon is a marquee effect, so we pool it instead of
 * allocating cylinders into explosionVisuals on every shot.
 */
function ensureChargeBeamVisual(index) {
  if (chargeBeamVisuals[index]) return chargeBeamVisuals[index];

  const coreGeo = new THREE.CylinderGeometry(1, 0.15, 1, 6);
  const glowGeo = new THREE.CylinderGeometry(1, 0.1, 1, 8);
  const coreMat = basicMat(0x00ffff, {
    transparent: true,
    opacity: 0.9,
    side: THREE.DoubleSide,
    depthWrite: false,
    blending: THREE.NormalBlending,
  });
  const glowMat = basicMat(0x00ffff, {
    transparent: true,
    opacity: 0.7,
    side: THREE.DoubleSide,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });

  const coreMesh = new THREE.Mesh(coreGeo, coreMat);
  coreMesh.name = `charge-beam-core-${index}`;
  coreMesh.renderOrder = 100;
  coreMesh.visible = false;
  coreMesh.frustumCulled = false;
  scene.add(coreMesh);

  const glowMesh = new THREE.Mesh(glowGeo, glowMat);
  glowMesh.name = `charge-beam-glow-${index}`;
  glowMesh.renderOrder = 101;
  glowMesh.visible = false;
  glowMesh.frustumCulled = false;
  scene.add(glowMesh);

  chargeBeamVisuals[index] = {
    coreMesh,
    glowMesh,
    createdAt: 0,
    duration: 0,
    maxCoreOpacity: 0.9,
    maxGlowOpacity: 0.7,
    baseCoreWidth: 0,
    baseGlowWidth: 0,
    range: 0,
  };
  return chargeBeamVisuals[index];
}

function clearChargeBeamVisual(index) {
  const beam = chargeBeamVisuals[index];
  if (!beam) return;
  beam.coreMesh.visible = false;
  beam.glowMesh.visible = false;
  beam.duration = 0;
}

function clearAllChargeBeamVisuals() {
  for (let i = 0; i < chargeBeamVisuals.length; i++) {
    clearChargeBeamVisual(i);
  }
}

/**
 * Reuse one core+glow beam pair per hand for the charge cannon.
 * This preserves the old look while eliminating per-shot geometry churn.
 */

// ── Charge Cannon AoE Explosion Visuals ──────────────────────
const activeChargeExplosions = [];

/**
 * Spawn a billboard explosion at the given position.
 * @param {THREE.Vector3} position - World position of explosion center
 * @param {string|number} color - Color tint (CSS string or hex)
 */
function spawnChargeExplosion(position, color) {
  // Canvas-based radial gradient glow for a proper round explosion effect
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d');
  const gradient = ctx.createRadialGradient(128, 128, 0, 128, 128, 128);
  const c = new THREE.Color(color);
  const r = Math.round(c.r * 255);
  const g = Math.round(c.g * 255);
  const b = Math.round(c.b * 255);
  gradient.addColorStop(0.0, `rgba(255,255,255,1.0)`); // White core
  gradient.addColorStop(0.15, `rgba(${r},${g},${b},1.0)`); // Colored bright
  gradient.addColorStop(0.4, `rgba(${r},${g},${b},0.6)`);
  gradient.addColorStop(0.7, `rgba(${r},${g},${b},0.2)`);
  gradient.addColorStop(1.0, `rgba(${r},${g},${b},0)`);
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 256, 256);

  const texture = new THREE.CanvasTexture(canvas);
  const geo = new THREE.PlaneGeometry(3.0, 3.0);
  const mat = new THREE.MeshBasicMaterial({
    map: texture,
    transparent: true,
    opacity: 1.0,
    depthTest: false,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.copy(position);
  mesh.scale.setScalar(0.3);
  scene.add(mesh);
  activeChargeExplosions.push({
    mesh,
    texture,
    age: 0,
    maxAge: 0.6,
  });
}

/**
 * Update active charge explosions (billboard + animate fade/scale).
 * Call from the main render loop.
 */
function updateChargeExplosions(dt) {
  const camPos = camera.position;
  for (let i = activeChargeExplosions.length - 1; i >= 0; i--) {
    const exp = activeChargeExplosions[i];
    exp.age += dt;
    const t = Math.min(exp.age / exp.maxAge, 1);
    // Scale: 0.5 -> 3.0 over 0.4s (ease out)
    const scaleT = Math.min(exp.age / 0.4, 1);
    exp.mesh.scale.setScalar(0.5 + 2.5 * scaleT);
    // Opacity: 0.9 -> 0.0 over 0.5s
    exp.mesh.material.opacity = 0.9 * (1 - t);
    // Billboard: always face camera
    exp.mesh.lookAt(camPos);
    // Clean up when done
    if (exp.age >= exp.maxAge) {
      scene.remove(exp.mesh);
      exp.mesh.geometry.dispose();
      exp.mesh.material.dispose();
      if (exp.texture) exp.texture.dispose();
      activeChargeExplosions.splice(i, 1);
    }
  }
}

function activateChargeBeamVisual(index, origin, direction, range, beamWidth, progress, now) {
  const beam = ensureChargeBeamVisual(index);
  const visualBeamWidth = beamWidth * 0.3;
  const coreWidth = visualBeamWidth * 0.4;

  _chargeBeamColor.lerpColors(_chargeBeamBaseColor, _chargeBeamHotColor, progress);

  beam.createdAt = now;
  beam.duration = 200;
  beam.maxCoreOpacity = 0.9;
  beam.maxGlowOpacity = 0.7;
  beam.baseCoreWidth = coreWidth;
  beam.baseGlowWidth = visualBeamWidth;
  beam.range = range;

  beam.coreMesh.visible = true;
  beam.glowMesh.visible = true;

  beam.coreMesh.position.copy(origin).addScaledVector(direction, range * 0.5);
  beam.glowMesh.position.copy(beam.coreMesh.position);
  beam.coreMesh.quaternion.setFromUnitVectors(_chargeBeamUp, direction);
  beam.glowMesh.quaternion.copy(beam.coreMesh.quaternion);

  beam.coreMesh.scale.set(coreWidth, range, coreWidth);
  beam.glowMesh.scale.set(visualBeamWidth, range, visualBeamWidth);

  beam.coreMesh.material.color.copy(_chargeBeamColor);
  beam.glowMesh.material.color.copy(_chargeBeamColor);
  beam.coreMesh.material.opacity = beam.maxCoreOpacity;
  beam.glowMesh.material.opacity = beam.maxGlowOpacity;
}

function updateChargeBeamVisuals(now) {
  for (let i = 0; i < chargeBeamVisuals.length; i++) {
    const beam = chargeBeamVisuals[i];
    if (!beam || !beam.coreMesh.visible || beam.duration <= 0) continue;

    const age = now - beam.createdAt;
    if (age > beam.duration) {
      clearChargeBeamVisual(i);
      continue;
    }

    const t = age / beam.duration;
    const pulsePhase = t < 0.3 ? t / 0.3 : 1.0;
    const fadePhase = t < 0.3 ? 0 : (t - 0.3) / 0.7;
    const pulseIntensity = Math.sin(pulsePhase * Math.PI) * 0.2;
    const fadeOpacity = 1 - Math.pow(fadePhase, 2);
    const scaleDown = 1 - fadePhase * 0.3;

    beam.coreMesh.material.opacity = beam.maxCoreOpacity * (1 + pulseIntensity) * fadeOpacity;
    beam.glowMesh.material.opacity = beam.maxGlowOpacity * (1 + pulseIntensity) * fadeOpacity;
    beam.coreMesh.scale.set(
      Math.max(0.0001, beam.baseCoreWidth * scaleDown),
      beam.range,
      Math.max(0.0001, beam.baseCoreWidth * scaleDown)
    );
    beam.glowMesh.scale.set(
      Math.max(0.0001, beam.baseGlowWidth * scaleDown),
      beam.range,
      Math.max(0.0001, beam.baseGlowWidth * scaleDown)
    );
  }
}

// Pooled temp vectors for pointToSegmentDist (hot path)
const _ptsAb = new THREE.Vector3();
const _ptsAp = new THREE.Vector3();
const _ptsProj = new THREE.Vector3();

/**
 * Distance squared from point to line segment (a to b).
 * Perf: Hot collision path uses squared distance to avoid sqrt churn.
 */
function pointToSegmentDistSq(p, a, b, outClosestPoint = null) {
  _ptsAb.subVectors(b, a);
  const abLenSq = _ptsAb.lengthSq();
  let t = 0;
  if (abLenSq > 0.000001) {
    _ptsAp.subVectors(p, a);
    t = Math.max(0, Math.min(1, _ptsAp.dot(_ptsAb) / abLenSq));
  }
  _ptsProj.copy(a).addScaledVector(_ptsAb, t);
  if (outClosestPoint) outClosestPoint.copy(_ptsProj);
  return p.distanceToSquared(_ptsProj);
}

/** Distance from point to line segment (a to b) */
// [CORE] Point-to-line-segment distance calculation
function pointToSegmentDist(p, a, b) {
  return Math.sqrt(pointToSegmentDistSq(p, a, b));
}

const _chargeBeamA = new THREE.Vector3();
const _chargeBeamB = new THREE.Vector3();
const _playerForward = new THREE.Vector3();
const _chargeBeamOrigin = new THREE.Vector3();
const _chargeBeamQuat = new THREE.Quaternion();
const _chargeBeamDir = new THREE.Vector3(0, 0, -1);
const _chargeBeamUp = new THREE.Vector3(0, 1, 0);
const _chargeBeamColor = new THREE.Color();
const _chargeBeamBaseColor = new THREE.Color(0x00ffff);
const _chargeBeamHotColor = new THREE.Color(0xffffff);
const _chargeVisualColor = new THREE.Color();

// [CORE] Fire charge beam weapon
function fireChargeBeam(controller, index, chargeTimeSec, stats, options = {}) {
  if (chargeTimeSec < CHARGE_SHOT_MIN_FIRE) return; // minimum charge to fire

  const chargeRateMultiplier = stats.chargeRateMultiplier || 1;
  const damageMultiplier = stats.chargeDeathRayMultiplier || 1;

  // Use Mega Man style damage curve
  const damage = Math.round(chargeTimeToDamage(chargeTimeSec, chargeRateMultiplier, damageMultiplier));
  const progress = chargeTimeToProgress(chargeTimeSec, chargeRateMultiplier);

  // Play the charge fire sound with progress for intensity
  playChargeFireSound(progress);

  // Beam width scales with progress (0.2 at min, 1.5 at max)
  const beamWidth = 0.2 + progress * 1.3;
  const range = 50;

  controller.getWorldPosition(_chargeBeamOrigin);
  controller.getWorldQuaternion(_chargeBeamQuat);
  _chargeBeamDir.set(0, 0, -1).applyQuaternion(_chargeBeamQuat);

  _chargeBeamA.copy(_chargeBeamOrigin);
  _chargeBeamB.copy(_chargeBeamOrigin).addScaledVector(_chargeBeamDir, range);

  const controllerIndex = index;
  const hand = getHandForController(index);

  // Track positions of enemies killed by this beam for AoE effects
  const aoeKillPositions = [];
  const isFullCharge = progress >= 1.0;

  const chargeStats = { ...stats, damage: Math.round(damage) };
  const beamWidthSq = beamWidth * beamWidth;
  getEnemies().forEach((e, i) => {
    const distSq = pointToSegmentDistSq(e.mesh.position, _chargeBeamA, _chargeBeamB);
    if (distSq < beamWidthSq) {
      // Record position before hit (enemy may be destroyed after handleHit)
      const enemyPos = e.mesh.position.clone();
      const hpBefore = e.hp;
      handleHit(i, e, chargeStats, enemyPos, controllerIndex, false, false);
      // If killed by this beam and it was a full charge, track for AoE
      if (isFullCharge && hpBefore > 0 && e.hp <= 0) {
        aoeKillPositions.push(enemyPos);
      }
    }
  });

  const boss = getBoss();
  if (boss) {
    const distSq = pointToSegmentDistSq(boss.mesh.position, _chargeBeamA, _chargeBeamB);
    if (distSq < beamWidthSq) {
      const result = hitBoss(Math.round(damage), { isChargeCannon: true });

      // Shield reflection
      if (result.shieldReflected) {
        spawnDamageNumber(boss.mesh.position.clone(), 0, '#ff00ff');
        playHitSound();
        const dead = damagePlayer(1);
        setKilledBy({ type: 'boss', name: boss.def?.name || 'Boss', enemyType: boss.def?.behavior || '' });
        triggerHitFlash(true);
        playDamageSound();
        cameraShake = 0.3;
        cameraShakeIntensity = 0.03;
        originalCameraPos.copy(camera.position);

        // Light screen shake on player damage
        triggerScreenShake(0.15, 500); // 0.15 shake for 500ms

        floorFlashing = true;
        floorFlashTimer = 1.0;
        if (dead) endGame(false);
        return;
      }

      spawnDamageNumber(boss.mesh.position.clone(), Math.round(damage), '#ff4444');
      game.handStats[hand].totalDamage += damage;
      if (result.killed) {
        playExplosionSound();
        game.kills++;
        trackKill(true);
        addScore(boss.scoreValue);

        // Update HUD immediately to show correct kill count before level complete
        updateHUD(game);

        // Check for kills remaining alert (for non-boss levels that might call this)
        checkKillsAlert();

        startBossDeathCinematic(boss);
      }
    }
  }

  // Check collision with boss projectiles (charge beam destroys them)
  const bossProjectiles = getBossProjectiles();
  if (bossProjectiles.length > 0) {
    for (let i = bossProjectiles.length - 1; i >= 0; i--) {
      const bossProj = bossProjectiles[i];
      if (!bossProj) continue;
      
      // Check if boss projectile intersects with beam line
      const hitRadius = beamWidth + 0.3;
      const distSq = pointToSegmentDistSq(bossProj.position, _chargeBeamA, _chargeBeamB);
      if (distSq < hitRadius * hitRadius) { // Slightly larger collision radius
        // Destroy boss projectile with explosion effect
        spawnBossProjectileDestructionFX(bossProj.position.clone());
        if (bossProj._instIdx !== undefined) releaseBossProjIndex(bossProj._instIdx);
        bossProjectiles.splice(i, 1);
      }
    }
  }
  activateChargeBeamVisual(index, _chargeBeamOrigin, _chargeBeamDir, range, beamWidth, progress, performance.now());

  // AoE explosion effects on full charge kills
  if (isFullCharge && aoeKillPositions.length > 0) {
    const aoeRadius = 3.0;
    const aoeDamage = 200;
    const enemies = getEnemies();

    aoeKillPositions.forEach(killPos => {
      // Determine which element effects to apply
      const hasFire = stats.hasExcessHeat || stats.hasChargeAoEFire;
      const hasFreeze = stats.hasChargeAoEFreeze;
      const hasShock = stats.hasChargeAoEShock;

      if (hasFire) {
        spawnChargeExplosion(killPos, '#ff4400');
        enemies.forEach((e, i) => {
          if (!e || e.hp <= 0) return;
          const dist = e.mesh.position.distanceTo(killPos);
          if (dist <= aoeRadius) {
            const result = hitEnemy(i, aoeDamage);
            spawnDamageNumber(e.mesh.position.clone(), aoeDamage, '#ff4400');
            // Apply fire DoT
            applyEffects(i, [{ type: 'fire', stacks: 2 }]);
            if (result.killed) {
              handleEnemyKilled(i, { killsWithoutHit: true, skipChain: false });
            }
          }
        });
      }
      if (hasFreeze) {
        if (!hasFire) spawnChargeExplosion(killPos, '#88ccff'); // Don't double-spawn visual
        enemies.forEach((e, i) => {
          if (!e || e.hp <= 0) return;
          const dist = e.mesh.position.distanceTo(killPos);
          if (dist <= aoeRadius) {
            const result = hitEnemy(i, Math.round(aoeDamage * 0.5)); // Freeze deals less direct damage
            spawnDamageNumber(e.mesh.position.clone(), Math.round(aoeDamage * 0.5), '#88ccff');
            applyEffects(i, [{ type: 'freeze', stacks: 2 }]);
            if (result.killed) {
              handleEnemyKilled(i, { killsWithoutHit: true, skipChain: false });
            }
          }
        });
      }
      if (hasShock) {
        if (!hasFire && !hasFreeze) spawnChargeExplosion(killPos, '#ffff44');
        enemies.forEach((e, i) => {
          if (!e || e.hp <= 0) return;
          const dist = e.mesh.position.distanceTo(killPos);
          if (dist <= aoeRadius) {
            const result = hitEnemy(i, Math.round(aoeDamage * 0.75));
            spawnDamageNumber(e.mesh.position.clone(), Math.round(aoeDamage * 0.75), '#ffff44');
            applyEffects(i, [{ type: 'shock', stacks: 2 }]);
            if (result.killed) {
              handleEnemyKilled(i, { killsWithoutHit: true, skipChain: false });
            }
          }
        });
      }

      // If no element but still full charge, spawn a generic explosion (white)
      if (!hasFire && !hasFreeze && !hasShock) {
        spawnChargeExplosion(killPos, '#ffffff');
        // No element damage, just the visual
      }
    });
  }

  // Triple shot: schedule a second beam 300ms later (only on initial fire, not on delayed shots)
  if ((game.upgrades[hand].triple_shot || 0) > 0 && !options._isDelayedShot) {
    const savedChargeTime = chargeTimeSec;
    const savedStats = { ...stats };
    const savedIndex = index;
    const savedController = controller;
    setTimeout(() => {
      // Guard: weapon still equipped, game still playing
      if (!game || game.state !== State.PLAYING) return;
      const currentHand = getHandForController(savedIndex);
      if (game.mainWeapon[currentHand] !== stats.mainWeaponId) return;
      const ctrl = savedIndex < 2 ? controllers[savedIndex] : savedController;
      if (ctrl) {
        fireChargeBeam(ctrl, savedIndex, savedChargeTime, savedStats, { _isDelayedShot: true });
      }
    }, 300);
  }
}

// [CORE] Spawn a projectile with given parameters
function spawnProjectile(origin, direction, controllerIndex, stats, shotId, options = {}) {
  // PERFORMANCE: Recycle oldest projectile when at cap to keep fire continuous
  if (projectiles.length >= MAX_PROJECTILES) {
    const recycled = projectiles.shift();
    if (recycled) {
      returnProjectileToPool(recycled);
    }
  }

  const now = performance.now();
  // Use spread threshold: only treat as buckshot if spread > 5 degrees (0.087 rad)
  // This prevents plasma carbine (1.5 deg spread) from being treated as buckshot
  const BUCKSHOT_SPREAD_THRESHOLD = 0.087; // ~5 degrees
  const isBuckshot = (stats.spreadAngle || 0) > BUCKSHOT_SPREAD_THRESHOLD && !stats.homing;
  const isPlasmaCarbine = stats.mainWeaponId === 'plasma_carbine';
  const poolType = stats.homing ? 'seeker' : (isPlasmaCarbine ? 'plasma_carbine' : (isBuckshot ? 'buckshot' : 'laser'));
  
  // All projectile cores are white (Star Wars blaster style)
  // Color identity comes from glow billboards + controller spheres
  const projectileColor = 0xffffff;

  // [DEBUG] Projectile investigation logging in spawnProjectile
  if (window.DEBUG_PROJECTILES) {
    const handLabel = controllerIndex === 0 ? 'LEFT' : 'RIGHT';
  }

  // Big Boom: only one exploding shot per hand every 2.75s
  let isExploding = false;
  if (stats.aoeRadius > 0) {
    if (now - lastExplodingShotTime[controllerIndex] >= BIG_BOOM_COOLDOWN_MS) {
      isExploding = true;
      lastExplodingShotTime[controllerIndex] = now;
    }
  }

  // PERFORMANCE: Get projectile from pool instead of creating new
  let mesh = getPooledProjectile(poolType, projectileColor);

  if (!mesh) {
    // Pool exhausted - recycle oldest active projectile to keep fire continuous
    const recycled = projectiles.shift();
    if (recycled) {
      returnProjectileToPool(recycled);
      // BUG FIX: Don't reuse the recycled proxy - get a fresh one from the pool
      // The recycled proxy's instance index may have been invalidated by count adjustment
      mesh = getPooledProjectile(poolType, projectileColor);
    }
  }

  if (!mesh) {
    // No available projectile to recycle
    return;
  }

  // Reset and activate pooled projectile
  mesh.position.copy(origin);
  let shotDirection = direction.clone();
  if (isBuckshot) {
    // Use half the spreadAngle as max per-pellet deviation for natural distribution
    const halfCone = (stats.spreadAngle || THREE.MathUtils.degToRad(8)) * 0.5;
    const angle = Math.random() * halfCone;
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
  mesh._controllerIndex = controllerIndex;  // For commitProjectileInstance glow routing
  mesh.userData.isExploding = isExploding;
  mesh.userData.lifetime = 1500;
  mesh.userData.createdAt = performance.now();
  mesh.userData.hitEnemies = new Set();
  mesh.userData.shotId = shotId;
  mesh.userData.hitConfirmed = false;
  mesh.userData.homingRange = stats.homing ? (stats.homingRange || 15) : 0;
  mesh.userData.homingStrength = stats.homing ? 15 : 0;
  mesh.userData.baseSpeed = projectileSpeed;
  mesh.userData.homingTarget = null;
  mesh.userData.nextHomingTargetRefreshAt = 0;
  mesh.userData.tailPhase = stats.homing ? Math.random() * Math.PI * 2 : 0;
  mesh.userData.tailSpeed = stats.homing ? 16 + Math.random() * 5 : 0;
  mesh.visible = true;

  // Orient bolt along direction
  if (!isBuckshot) {
    mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, -1), direction);
  }

  // Commit initial position to InstancedMesh
  if (mesh.commit) {
    mesh.commit();
  }

  projectiles.push(mesh);

  if (!options.suppressSound) {
    if (isBuckshot) {
      playBuckshotSound();
    } else {
      playShoothSound();
    }
  }
}

// Process seeker burst queue - fires queued shots at their scheduled time
// [CORE] Process seeker burst queue
function processSeekerBurstQueue(now) {
  if (seekerBurstQueue.length === 0) return;
  
  // Process all shots that are ready to fire
  for (let i = seekerBurstQueue.length - 1; i >= 0; i--) {
    const shot = seekerBurstQueue[i];
    if (now >= shot.fireTime) {
      spawnProjectile(shot.origin, shot.direction, shot.controllerIndex, shot.stats, shot.shotId, { suppressSound: true });
      // Play per-shot sound: "p" for middle shots, full "pew" for last
      playSeekerBurstSound(shot.isLastShot, shot.totalShots, shot.burstIndex);
      seekerBurstQueue.splice(i, 1);
    }
  }
}

// ============================================================
//  SLOW-MO DEATH CAMERA
// ============================================================

// [CORE] Linear interpolation helper
function lerp(a, b, t) {
  return a + (b - a) * t;
}

// [CORE] Handle projectile hit on enemy
function handleHit(enemyIndex, enemy, stats, hitPoint, controllerIndex, isExploding, hitWeakPoint, hitInfo) {
  // Calculate damage
  let damage = stats.damage;

  // Tank weak point (one random voxel takes double damage)
  if (hitWeakPoint) damage *= 2;

  // Critical hit
  let isCrit = false;
  if (stats.critChance > 0 && Math.random() < stats.critChance) {
    damage *= (stats.critMultiplier || 2);
    isCrit = true;
    trackCrit();
  }

  // Impact freeze for critical hits or weak points
  const isCritical = isCrit;
  if (isCritical) {
    // Freeze frame briefly (0.1s visual pause)
    const freezeDuration = 100; // 0.1 seconds

    // Small camera jolt (desktop only - skip in VR to avoid fighting with WebXR tracking)
    if (!renderer.xr.isPresenting) {
      camera.position.x += (Math.random() - 0.5) * 0.05;
      camera.position.y += (Math.random() - 0.5) * 0.05;
    }

    // No red screen flash on crits - removed per user request
    // triggerHitFlash();

    if (DEBUG) console.log(`[Impact] CRITICAL HIT! Damage: ${Math.round(damage)}, Freeze: ${freezeDuration}ms`);
  }

  // Fire debuff increases damage taken
  if (enemy.statusEffects.fire.stacks > 0) {
    damage *= stats.fireWeakenMult;
  }

  // Apply damage
  const resolvedHitInfo = { ...hitInfo, weakPoint: hitWeakPoint };
  const result = hitEnemy(enemyIndex, damage, resolvedHitInfo);

  // Track damage for hand stats
  if (controllerIndex !== undefined) {
    const hand = getHandForController(controllerIndex);
    game.handStats[hand].totalDamage += damage;
  }

  // Spawn damage number (reddish if enemy is buffed by conductor)
  const isBuffed = enemy.linkedByConductor && enemy.linkedDamageReduction > 0;
  spawnDamageNumber(hitPoint, damage, isBuffed ? '#ff6666' : '#ffffff');
  
  // CRIT indicator for critical hits
  if (isCritical) {
    spawnCritIndicator(hitPoint);
  }
  
  // Muffled hit sound for buffed enemies, normal hit otherwise
  if (isBuffed) {
    playBuffedHitSound();
  } else {
    playHitSound();
  }

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
    const destroyData = handleEnemyKilled(enemyIndex, { isCritical, overkill: result.overkill > 0, killsWithoutHit: true, skipChain: false });
    if (destroyData) {
      // Track kills for hand stats
      if (controllerIndex !== undefined) {
        const hand = getHandForController(controllerIndex);
        game.handStats[hand].kills++;
        
        // Track enemy kills by type
        if (destroyData.type) {
          if (!game.handStats[hand].enemyKills) {
            game.handStats[hand].enemyKills = {};
          }
          game.handStats[hand].enemyKills[destroyData.type] = (game.handStats[hand].enemyKills[destroyData.type] || 0) + 1;
        }
      }

      // Vampiric healing
      if (stats.vampiricInterval > 0 && game.totalKills % stats.vampiricInterval === 0) {
        game.health = Math.min(game.maxHealth, game.health + 1);
        if (DEBUG) console.log('[vampiric] Healed 1 HP');
        spawnHealthGainPopup(destroyData.position);  // Spawn +💖 popup at enemy position
        playHealSound();  // Play healing sound
      }
    }
  }
}

// [CORE] Handle projectile hit on boss
function handleBossHit(boss, stats, hitPoint, controllerIndex, handIndex, hitObject) {
  let damage = stats.damage;
  if (stats.critChance > 0 && Math.random() < stats.critChance) {
    damage *= (stats.critMultiplier || 2);
    trackCrit();
  }

  // Extract facet/shard/weak point info from hit object for PrismBoss
  const bossHitInfo = { handIndex };
  if (hitObject && hitObject.userData) {
    if (hitObject.userData.facetIndex !== undefined) bossHitInfo.facetIndex = hitObject.userData.facetIndex;
    if (hitObject.userData.isWeakPoint) bossHitInfo.isWeakPoint = true;
    if (hitObject.userData.isHealWeakPoint) bossHitInfo.isHealWeakPoint = true;
    if (hitObject.userData.healWeakPointIndex !== undefined) bossHitInfo.healWeakPointIndex = hitObject.userData.healWeakPointIndex;
    if (hitObject.userData.isPrismCore) bossHitInfo.isPrismCore = true;
    if (hitObject.userData.shardIndex !== undefined) bossHitInfo.shardIndex = hitObject.userData.shardIndex;
    if (hitObject.userData.eclipseNodeId !== undefined) bossHitInfo.eclipseNodeId = hitObject.userData.eclipseNodeId;
    if (hitObject.userData.eclipseNodeType) bossHitInfo.eclipseNodeType = hitObject.userData.eclipseNodeType;
    if (hitObject.userData.isEclipseHeart) bossHitInfo.isEclipseHeart = true;
  }
  // Walk up to find facet info on parent groups
  let walk = hitObject;
  while (walk && (
    bossHitInfo.facetIndex === undefined
    || bossHitInfo.eclipseNodeId === undefined
    || bossHitInfo.eclipseNodeType === undefined
  )) {
    if (walk.userData && walk.userData.facetIndex !== undefined && bossHitInfo.facetIndex === undefined) {
      bossHitInfo.facetIndex = walk.userData.facetIndex;
    }
    if (walk.userData && walk.userData.shardIndex !== undefined && bossHitInfo.shardIndex === undefined) {
      bossHitInfo.shardIndex = walk.userData.shardIndex;
    }
    if (walk.userData && walk.userData.eclipseNodeId !== undefined && bossHitInfo.eclipseNodeId === undefined) {
      bossHitInfo.eclipseNodeId = walk.userData.eclipseNodeId;
    }
    if (walk.userData && walk.userData.eclipseNodeType && bossHitInfo.eclipseNodeType === undefined) {
      bossHitInfo.eclipseNodeType = walk.userData.eclipseNodeType;
    }
    if (walk.userData && walk.userData.isEclipseHeart) {
      bossHitInfo.isEclipseHeart = true;
    }
    if (
      bossHitInfo.facetIndex !== undefined
      && bossHitInfo.shardIndex !== undefined
      && bossHitInfo.eclipseNodeId !== undefined
      && bossHitInfo.eclipseNodeType !== undefined
    ) {
      break;
    }
    walk = walk.parent;
  }

  const result = hitBoss(damage, bossHitInfo);

  // Shield reflection: damage player instead of boss
  if (result.shieldReflected) {
    spawnDamageNumber(hitPoint, 0, '#ff00ff');  // Show 0 damage in magenta
    playHitSound();
    const dead = damagePlayer(1);
    setKilledBy({ type: 'boss', name: boss.def?.name || 'Boss', enemyType: boss.def?.behavior || '' });
    triggerHitFlash(true);
    playDamageSound();
    cameraShake = 0.3;
    cameraShakeIntensity = 0.03;
    originalCameraPos.copy(camera.position);

    // Light screen shake on player damage
    triggerScreenShake(0.15, 500); // 0.15 shake for 500ms

    floorFlashing = true;
    floorFlashTimer = 1.0;
    if (DEBUG) console.log('[boss] Shield reflected damage!');
    if (dead) endGame(false);
    return;
  }

  // Immune hit (e.g., skull boss head before hands destroyed)
  if (result.immune) {
    spawnDamageNumber(hitPoint, 0, '#aaaaaa');  // Show 0 damage in gray
    playTingSound();  // Metallic ping sound
    if (DEBUG) console.log('[boss] Hit was immune!');
    return;
  }

  // Healed hit (wrong facet on PrismBoss - boss heals instead of taking damage)
  if (result.healed) {
    const healAmt = result.healAmount || damage;
    spawnDamageNumber(hitPoint, healAmt, '#00ff44');  // Green number showing heal amount
    playHealSound();  // Distinctive heal sound
    if (DEBUG) console.log(`[boss] Wrong facet hit! Boss healed for ${healAmt}`);
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
    game.kills++;
    trackKill(true);
    game.killsWithoutHit++;
    addScore(boss.scoreValue);

    // Update HUD immediately to show correct kill count before level complete
    updateHUD(game);

    // Check for kills remaining alert (for non-boss levels that might call this)
    checkKillsAlert();

    startBossDeathCinematic(boss);
  }
}

// [CORE] Handle area-of-effect damage
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
// [CORE] Spawn explosion visual at position
function spawnExplosionVisual(center, radius) {
  // Play explosion sound
  playExplosionSound();

  // Bigger shake for explosions
  triggerScreenShake(0.3, 300); // 0.3 shake for 300ms

  // PERFORMANCE: Use pooled explosion meshes instead of allocating new geometry each call
  let entry = null;
  for (let i = 0; i < EXPLOSION_POOL_SIZE; i++) {
    if (!explosionPool[i].active) { entry = explosionPool[i]; break; }
  }
  if (!entry) return; // All busy, skip (avoids accumulation)

  const duration = 350; // ms
  entry.active = true;
  entry.createdAt = performance.now();
  entry.duration = duration;
  entry.radius = radius;
  entry.mesh.visible = true;
  entry.mesh.position.copy(center);
  entry.mesh.scale.setScalar(radius * 0.3);
  // Reset material opacity for pooled mesh
  entry.mesh.material.opacity = 0.7;
}

// [CORE] Update explosion visual animations
function updateExplosionVisuals(dt, now) {
  updateChargeBeamVisuals(now);

  // Update pooled explosion visuals
  for (let i = 0; i < EXPLOSION_POOL_SIZE; i++) {
    const entry = explosionPool[i];
    if (!entry.active) continue;
    const age = now - entry.createdAt;
    if (age > entry.duration) {
      entry.active = false;
      entry.mesh.visible = false;
    } else {
      const t = age / entry.duration;
      const scale = 1 + t * 2.5;
      entry.mesh.scale.setScalar(entry.radius * 0.3 * scale);
      entry.mesh.material.opacity = 0.7 * (1 - t);
    }
  }

  // Update rare non-pooled visuals (toxic pools, boss shields, transient bolts)
  for (let i = explosionVisuals.length - 1; i >= 0; i--) {
    const m = explosionVisuals[i];
    const age = now - m.userData.createdAt;
    if (age > m.userData.duration) {
      disposeMesh(m);
      explosionVisuals.splice(i, 1);
    } else {
      const t = age / m.userData.duration;
      if (m.userData.isChargeBeamCore || m.userData.isChargeBeam) {
        // Horizon-fade animation: appears full, then fades toward distance
        // Pulse effect: beam feels like it's "shooting through" the scene
        // Both core (NormalBlending) and glow (AdditiveBlending) share the same animation
        
        // Phase 1: Full opacity pulse (0-30% of duration)
        // Phase 2: Horizon fade (30-100% of duration)
        const pulsePhase = t < 0.3 ? t / 0.3 : 1.0;
        const fadePhase = t < 0.3 ? 0 : (t - 0.3) / 0.7;
        
        // Opacity: starts at max, pulses slightly, then fades
        const pulseIntensity = Math.sin(pulsePhase * Math.PI) * 0.2;
        const baseOpacity = m.userData.maxOpacity || 0.8;
        const fadeOpacity = 1 - Math.pow(fadePhase, 2); // Quadratic fade for smoother effect
        
        m.material.opacity = baseOpacity * (1 + pulseIntensity) * fadeOpacity;
        
        // Scale the beam down slightly over time (shooting into space effect)
        const scaleDown = 1 - fadePhase * 0.3;
        m.scale.set(scaleDown, 1, scaleDown);
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
            const _dead = damagePlayer(m.userData.damage);
            if (_dead && game.state === State.PLAYING) {
              const _boss = getBoss();
              setKilledBy({ type: 'environment', name: _boss?.def?.name || 'Toxic Pool', enemyType: 'toxic_pool' });
              endGame(false);
            }
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
    const ringMat = basicMat(0x886644, {
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
      const debrisMat = basicMat(0x886644, {
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
        const _dead = damagePlayer(damage);
        if (_dead && game.state === State.PLAYING) {
          const _boss = getBoss();
          setKilledBy({ type: 'explosion', name: _boss?.def?.name || 'Explosion', enemyType: 'explosion' });
          endGame(false);
        }
      }
    }
  };

  // Flash boss health bar green when Prism boss heals from wrong facet hit
  window.flashBossHealthBar = flashBossHealthBarGreen;
  
  // Create shootable decoy for Holo Phantom
  window.createHoloDecoy = function(position, explosionDamage, explosionRadius) {
    const decoyGeo = new THREE.SphereGeometry(0.4, 8, 8);
    const decoyMat = basicMat(0x00ffff, {
      transparent: true,
      opacity: 0.7
    });
    const decoy = new THREE.Mesh(decoyGeo, decoyMat);
    decoy.name = 'boss-decoy';
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
    const pulseMat = basicMat(0xff0088, {
      transparent: true,
      opacity: 0.9
    });
    const pulse = new THREE.Mesh(pulseGeo, pulseMat);
    pulse.name = 'boss-pulse';
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
    const shieldMat = basicMat(0xff0088, {
      transparent: true,
      opacity: 0.3,
      side: THREE.DoubleSide
    });
    const shield = new THREE.Mesh(shieldGeo, shieldMat);
    shield.position.copy(position);
    shield.name = 'boss-shield';
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
    const poolMat = basicMat(0xcc4400, {
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
    spawnTransientLightningBolt(fromPos, targetPos);
    
    // Also create a projectile that can be shot down
    const direction = targetPos.clone().sub(fromPos).normalize();
    const lightningGeo = new THREE.SphereGeometry(0.25, 6, 6);
    const lightningMat = basicMat(0xffff00, {
      transparent: true,
      opacity: 0.95
    });
    const lightning = new THREE.Mesh(lightningGeo, lightningMat);
    lightning.name = 'boss-lightning-proj';
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

// [CORE] Handle ricochet projectile bounce
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

// [CORE] Mark projectile as having scored a hit
function markProjectileHit(proj) {
  if (!proj?.userData?.shotId) return;
  proj.userData.hitConfirmed = true;
  markAccuracyHit(proj.userData.shotId);
}

// [CORE] Resolve projectile accuracy tracking
function resolveProjectileAccuracy(proj) {
  if (!proj?.userData?.shotId) return;
  resolveAccuracyPellet(proj.userData.shotId);
}

// Pooled temp vectors for projectile hot paths (per-frame allocations)
const _projHomingDesired = new THREE.Vector3();
const _projHomingQuatDir = new THREE.Vector3(0, 0, -1);
const _projHomingVelNorm = new THREE.Vector3();
const _hostileProjDesired = new THREE.Vector3();
const _hostileProjCurrent = new THREE.Vector3();
const _hostileProjSide = new THREE.Vector3();
const _projectileRayDir = new THREE.Vector3();
const _projectileNearbyMeshes = [];
const _projectileSegmentStart = new THREE.Vector3();
const _projectileSegmentEnd = new THREE.Vector3();
const _projectileClosestPoint = new THREE.Vector3();
const _projectileBestHitPoint = new THREE.Vector3();

function enemyNeedsPreciseProjectileHit(enemy) {
  return !!enemy && (enemy.type === 'tank' || enemy.isTrain);
}

// ============================================================
// PROJECTILE UPDATE LOOP
// Movement, homing, hostile projectiles, collision detection
// HOT PATH: Called every frame from render()
// COUPLING: projectiles[], instancedProjectiles, enemies spatial hash
// RISK: Changes here affect hit detection, game feel, performance
// ============================================================
// [CORE] Update all projectiles (movement, collision, lifetime)
function updateProjectiles(dt) {
  const now = performance.now();

  for (let i = projectiles.length - 1; i >= 0; i--) {
    const proj = projectiles[i];

    // Skip undefined projectiles (safety check)
    if (!proj) {
      projectiles.splice(i, 1);
      continue;
    }

    // Skip projectiles with missing data (safety check)
    if (!proj.userData || !proj.userData.stats) {
      // Check if this is a hostile projectile (moving)
      if (proj.userData && proj.userData.damage && proj.userData.direction) {
        const age = now - proj.userData.createdAt;
        if (age > proj.userData.duration) {
          triggerHostileProjectileExplosion(proj.position, 0.3, 0);
          disposeObject3D(proj);
          projectiles.splice(i, 1);
          continue;
        }

        const slowFactor = getStasisSlowFactor(proj.position);
        const adjustedDt = dt * slowFactor;
        const playerPos = camera.position;

        // Mini-swarm style steering and visual pop so hostile shots feel alive.
        _hostileProjDesired.subVectors(playerPos, proj.position).normalize();
        _hostileProjCurrent.copy(proj.userData.direction).normalize();
        _hostileProjCurrent.lerp(_hostileProjDesired, Math.min(1, adjustedDt * 2.8));
        proj.userData.direction.copy(_hostileProjCurrent.normalize());

        const wigglePhase = (proj.userData.wigglePhase || Math.random() * Math.PI * 2) + adjustedDt * 8;
        proj.userData.wigglePhase = wigglePhase;
        _hostileProjSide.set(-proj.userData.direction.z, 0, proj.userData.direction.x).normalize();
        proj.position.addScaledVector(_hostileProjSide, Math.sin(wigglePhase) * 0.015);
        proj.position.addScaledVector(proj.userData.direction, proj.userData.speed * adjustedDt);
        updateHostileProjectileVisual(proj, now);

        const dist = proj.position.distanceTo(playerPos);

        // Warning beep when an enemy projectile is getting dangerously close.
        if (dist < 4.0 && !proj.userData.warned) {
          playProjectileWarningSound();
          proj.userData.warned = true;
        }

        if (dist < 1.0) {
          if (typeof damagePlayer === 'function') {
            const _dead = damagePlayer(proj.userData.damage);
            if (_dead && game.state === State.PLAYING) {
              if (proj.userData.isBossProjectile) {
                const _boss = getBoss();
                setKilledBy({ type: 'boss_projectile', name: _boss?.def?.name || 'Boss', enemyType: 'projectile' });
              } else {
                setKilledBy({ type: 'enemy', name: 'Enemy Projectile', enemyType: 'projectile' });
              }
              endGame(false);
            }
          }
          triggerHostileProjectileExplosion(proj.position, 0.4, 0);
          disposeObject3D(proj);
          projectiles.splice(i, 1);
          continue;
        }

        continue;
      }

      // Check if this is a stationary boss projectile (decoy, shield, etc.) with duration
      if (proj.userData && proj.userData.isBossProjectile && proj.userData.duration && proj.userData.createdAt) {
        const age = now - proj.userData.createdAt;
        if (age > proj.userData.duration) {
          // Explode if it's a decoy
          if (proj.userData.isDecoy && typeof window !== 'undefined' && window.createExplosionAt) {
            window.createExplosionAt(proj.position.clone(), proj.userData.explosionRadius, proj.userData.explosionDamage);
          }
          disposeObject3D(proj);
          projectiles.splice(i, 1);
          continue;
        }
      }
      
      resolveProjectileAccuracy(proj);
      if (proj.userData?.isPooled) {
        returnProjectileToPool(proj);
      } else {
        disposeObject3D(proj);
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
        disposeObject3D(proj);
      }
      projectiles.splice(i, 1);
      continue;
    }

    // Check if projectile is inside a stasis field
    const slowFactor = getStasisSlowFactor(proj.position);
    const adjustedDt = dt * slowFactor;

    // Homing behavior (Seeker Burst)
    if (proj.userData.homingRange && proj.userData.homingRange > 0) {
      let targetMesh = proj.userData.homingTarget;
      const targetStillValid = targetMesh
        && targetMesh.parent
        && targetMesh.position.distanceToSquared(proj.position) <= proj.userData.homingRange * proj.userData.homingRange;
      if (!targetStillValid && now >= (proj.userData.nextHomingTargetRefreshAt || 0)) {
        targetMesh = findSeekerTarget(proj);
        proj.userData.homingTarget = targetMesh || null;
        proj.userData.nextHomingTargetRefreshAt = now + SEEKER_RETARGET_INTERVAL_MS;
      }

      const baseSpeed = proj.userData.baseSpeed || proj.userData.velocity.length();
      if (targetMesh) {
        _projHomingDesired.subVectors(targetMesh.position, proj.position).normalize().multiplyScalar(baseSpeed);
        // Use high homing strength so seekers directly target enemies
        // instead of circling them at low turn rates
        const homingStrength = proj.userData.homingStrength || 15;
        proj.userData.velocity.lerp(_projHomingDesired, Math.min(1, homingStrength * adjustedDt));
        if (proj.userData.velocity.lengthSq() > 0.0001) {
          proj.userData.velocity.setLength(baseSpeed);
        }
      } else if (proj.userData.velocity.lengthSq() > 0.0001) {
        proj.userData.velocity.setLength(baseSpeed);
      }

      if (proj.userData.velocity.lengthSq() > 0.0001) {
        _projHomingQuatDir.set(0, 0, -1);
        _projHomingVelNorm.copy(proj.userData.velocity).normalize();
        const _seekDot = _projHomingQuatDir.dot(_projHomingVelNorm);
        if (_seekDot > 0.9999) {
          proj.quaternion.identity();
        } else if (_seekDot < -0.9999) {
          proj.quaternion.setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI);
        } else {
          proj.quaternion.setFromUnitVectors(_projHomingQuatDir, _projHomingVelNorm);
        }
      }
      updateSeekerProjectileVisual(proj, adjustedDt);
    }

    // Move projectile (apply stasis slow effect)
    const moveDistance = proj.userData.velocity.length() * adjustedDt;
    proj.position.addScaledVector(proj.userData.velocity, adjustedDt);

    // Commit position to InstancedMesh (sync GPU buffer)
    if (proj.commit) {
      proj.commit();
    }

    // Check if projectile passes through nanite swarm and gains nanite damage
    checkProjectileNaniteInteraction(proj);

    // Check collision with plasma orbs (player can shoot orbs to detonate early)
    if (checkPlasmaOrbDetonation(proj)) {
      markProjectileHit(proj);
      resolveProjectileAccuracy(proj);
      if (proj.userData.isPooled) {
        returnProjectileToPool(proj);
      } else {
        disposeObject3D(proj);
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
        disposeObject3D(proj);
      }
      projectiles.splice(i, 1);
      continue;
    }

    // Check collision with enemies
    // VR-CRITICAL: Use direct segment-vs-sphere tests for standard enemies/minions,
    // and only recurse through child meshes when weak-point logic actually needs it.
    const projPos = proj.position;
    const broadRadius = moveDistance * 2 + 1.5; // Move distance + max hitbox radius
    const hashRadius = broadRadius + 3;
    _projectileNearbyMeshes.length = 0;

    if (proj.userData.velocity && typeof proj.userData.velocity.lengthSq === 'function') {
      _projectileRayDir.copy(proj.userData.velocity);
    } else {
      _projectileRayDir.set(0, 0, -1);
    }
    if (_projectileRayDir.lengthSq() === 0) {
      _projectileRayDir.set(0, 0, -1);
    } else {
      _projectileRayDir.normalize();
    }

    _projectileSegmentEnd.copy(proj.position);
    _projectileSegmentStart.copy(proj.position).addScaledVector(_projectileRayDir, -moveDistance);

    let directEnemyHit = null;
    let directEnemyHitDistanceSq = Infinity;
    let directMinionHit = null;
    let directMinionHitDistanceSq = Infinity;

    const hashed = enemySpatialHash.query(projPos.x, projPos.z, hashRadius);
    for (let ei = 0; ei < hashed.length; ei++) {
      const enemy = hashed[ei];
      if (!enemy || !enemy.mesh) continue;

      const dx = projPos.x - enemy.mesh.position.x;
      const dy = projPos.y - enemy.mesh.position.y;
      const dz = projPos.z - enemy.mesh.position.z;
      const centerDistSq = dx * dx + dy * dy + dz * dz;
      const hitRadius = (enemy.hitboxRadius || 1) + broadRadius;
      if (centerDistSq >= hitRadius * hitRadius) continue;

      if (enemyNeedsPreciseProjectileHit(enemy)) {
        _projectileNearbyMeshes.push(enemy.mesh);
        continue;
      }

      const directHitRadius = (enemy.hitboxRadius || 1) + 0.12;
      const hitDistSq = pointToSegmentDistSq(enemy.mesh.position, _projectileSegmentStart, _projectileSegmentEnd, _projectileClosestPoint);
      if (hitDistSq <= directHitRadius * directHitRadius) {
        const liveEnemy = getEnemyByMesh(enemy.mesh);
        const enemyIndex = liveEnemy?.index;
        if (enemyIndex === undefined || proj.userData.hitEnemies.has(enemyIndex)) continue;
        const pathDistSq = _projectileSegmentStart.distanceToSquared(_projectileClosestPoint);
        if (pathDistSq < directEnemyHitDistanceSq) {
          directEnemyHitDistanceSq = pathDistSq;
          _projectileBestHitPoint.copy(_projectileClosestPoint);
          directEnemyHit = { index: enemyIndex, enemy: liveEnemy.enemy, point: _projectileBestHitPoint.clone() };
        }
      }
    }

    // Bosses still use precise mesh hits so custom weak-point logic stays intact.
    const boss = getBoss();
    if (boss && boss.mesh) {
      const dx = projPos.x - boss.mesh.position.x;
      const dy = projPos.y - boss.mesh.position.y;
      const dz = projPos.z - boss.mesh.position.z;
      const distSq = dx * dx + dy * dy + dz * dz;
      const bossRadius = boss.hands && boss.hands.length > 0 ? 8.0 : 3.0;
      if (distSq < (broadRadius + bossRadius) * (broadRadius + bossRadius)) {
        _projectileNearbyMeshes.push(boss.mesh);
      }
    }

    // Boss minions do not need child-mesh precision, so we can hit them with a cheap sphere test.
    const bossMinions = getBossMinions();
    if (bossMinions.length > 0) {
      for (let mi = 0; mi < bossMinions.length; mi++) {
        const minion = bossMinions[mi];
        const minionMesh = minion?.mesh;
        if (!minionMesh) continue;

        const dx = projPos.x - minionMesh.position.x;
        const dy = projPos.y - minionMesh.position.y;
        const dz = projPos.z - minionMesh.position.z;
        const centerDistSq = dx * dx + dy * dy + dz * dz;
        const minionRadius = (minionMesh.userData.hitRadius || 0.8) + broadRadius;
        if (centerDistSq >= minionRadius * minionRadius) continue;

        const hitRadiusSq = (minionMesh.userData.hitRadius || 0.8) * (minionMesh.userData.hitRadius || 0.8);
        const hitDistSq = pointToSegmentDistSq(minionMesh.position, _projectileSegmentStart, _projectileSegmentEnd, _projectileClosestPoint);
        if (hitDistSq <= hitRadiusSq) {
          const pathDistSq = _projectileSegmentStart.distanceToSquared(_projectileClosestPoint);
          if (pathDistSq < directMinionHitDistanceSq) {
            directMinionHitDistanceSq = pathDistSq;
            directMinionHit = { index: mi, minion, point: _projectileClosestPoint.clone() };
          }
        }
      }
    }

    let preciseHit = null;
    if (_projectileNearbyMeshes.length > 0) {
      _uiRaycaster.set(_projectileSegmentStart, _projectileRayDir);
      _uiRaycaster.near = 0;
      _uiRaycaster.far = Math.max(moveDistance, 0.5) + 1.5;
      const hits = _uiRaycaster.intersectObjects(_projectileNearbyMeshes, true);
      if (hits.length > 0) {
        preciseHit = hits[0];
      }
    }

    const preciseHitDistanceSq = preciseHit ? preciseHit.distance * preciseHit.distance : Infinity;
    const shouldUsePreciseHit = preciseHit
      && preciseHit.distance <= Math.max(moveDistance, 0.5) + 1.5
      && preciseHitDistanceSq <= directEnemyHitDistanceSq
      && preciseHitDistanceSq <= directMinionHitDistanceSq;

    if (shouldUsePreciseHit) {
      const result = getEnemyByMesh(preciseHit.object);
      if (result && result.boss) {
        markProjectileHit(proj);
        handleBossHit(result.boss, proj.userData.stats, preciseHit.point, proj.userData.controllerIndex, result.handIndex, preciseHit.object);
        if (!proj.userData.stats?.piercing) {
          resolveProjectileAccuracy(proj);
          if (proj.userData.isPooled) {
            returnProjectileToPool(proj);
          } else {
            disposeObject3D(proj);
          }
          projectiles.splice(i, 1);
        }
      } else if (result && result.index !== undefined && !proj.userData.hitEnemies.has(result.index)) {
        proj.userData.hitEnemies.add(result.index);
        const hitObj = preciseHit.object;
        const hitWeakPoint = hitObj.userData && hitObj.userData.weakPoint === true;
        const hitInfo = {
          trainIndex: hitObj.userData?.trainIndex,
          isScout: hitObj.userData?.isScout,
          hitObject: hitObj,
        };

        const naniteDamage = proj.userData.naniteInfused ? 5 : 0;
        if (naniteDamage > 0) {
          const enemy = result.enemy;
          if (!enemy._naniteRevealed) {
            enemy._naniteRevealed = true;
            if (enemy.mesh.material) {
              setMaterialEmissiveSafe(enemy.mesh.material, new THREE.Color(0xffd700), 0.5);
            }
          }
        }

        markProjectileHit(proj);
        handleHit(result.index, result.enemy, { ...proj.userData.stats, damage: proj.userData.stats.damage + naniteDamage }, preciseHit.point, proj.userData.controllerIndex, proj.userData.isExploding, hitWeakPoint, hitInfo);

        if (proj.userData.stats?.ricochetBounces > 0) {
          handleRicochet(preciseHit.point, proj.userData.stats, 0, proj.userData.controllerIndex);
        }

        if (!proj.userData.stats?.piercing) {
          resolveProjectileAccuracy(proj);
          if (proj.userData.isPooled) {
            returnProjectileToPool(proj);
          } else {
            disposeObject3D(proj);
          }
          projectiles.splice(i, 1);
        }
      }
    } else if (directEnemyHit) {
      proj.userData.hitEnemies.add(directEnemyHit.index);
      const naniteDamage = proj.userData.naniteInfused ? 5 : 0;

      if (naniteDamage > 0 && !directEnemyHit.enemy._naniteRevealed) {
        directEnemyHit.enemy._naniteRevealed = true;
        if (directEnemyHit.enemy.mesh.material) {
          setMaterialEmissiveSafe(directEnemyHit.enemy.mesh.material, new THREE.Color(0xffd700), 0.5);
        }
      }

      markProjectileHit(proj);
      handleHit(
        directEnemyHit.index,
        directEnemyHit.enemy,
        { ...proj.userData.stats, damage: proj.userData.stats.damage + naniteDamage },
        directEnemyHit.point,
        proj.userData.controllerIndex,
        proj.userData.isExploding,
        false,
        { hitObject: directEnemyHit.enemy.mesh }
      );

      if (proj.userData.stats?.ricochetBounces > 0) {
        handleRicochet(directEnemyHit.point, proj.userData.stats, 0, proj.userData.controllerIndex);
      }

      if (!proj.userData.stats?.piercing) {
        resolveProjectileAccuracy(proj);
        if (proj.userData.isPooled) {
          returnProjectileToPool(proj);
        } else {
          disposeObject3D(proj);
        }
        projectiles.splice(i, 1);
      }
    } else if (directMinionHit) {
      markProjectileHit(proj);
      const mResult = hitBossMinion(directMinionHit.index, proj.userData.stats?.damage);
      spawnDamageNumber(directMinionHit.point, proj.userData.stats?.damage, '#ff8800');
      if (mResult.killed) playExplosionSound();
      if (!proj.userData.stats?.piercing) {
        resolveProjectileAccuracy(proj);
        if (proj.userData.isPooled) {
          returnProjectileToPool(proj);
        } else {
          disposeObject3D(proj);
        }
        projectiles.splice(i, 1);
      }
    }

    // Safety: once a collision removed this projectile, skip the remaining collision tiers.
    if (!projectiles[i] || projectiles[i] !== proj) {
      continue;
    }
    
    // Check collision with boss projectiles (player can shoot them down)
    // Boss projectiles should NOT collide with other boss projectiles - only with player
    if (proj.userData.stats && !proj.userData.isBossProjectile) { // Only player projectiles, exclude boss projectiles
      const bossProjs = getBossProjectiles();
      if (bossProjs.length > 0) {
        for (let j = bossProjs.length - 1; j >= 0; j--) {
          const bossProj = bossProjs[j];
          if (!bossProj) continue;
        if (proj.position.distanceToSquared(bossProj.position) < 0.25) {
            spawnBossProjectileDestructionFX(bossProj.position.clone());
            if (bossProj._instIdx !== undefined) releaseBossProjIndex(bossProj._instIdx);
            bossProjs.splice(j, 1);

            if (!proj.userData.stats?.piercing) {
              markProjectileHit(proj);
              resolveProjectileAccuracy(proj);
              if (proj.userData.isPooled) {
                returnProjectileToPool(proj);
              } else {
                disposeObject3D(proj);
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
          if (proj.position.distanceToSquared(bossProj.position) < 0.25) { // 0.5m collision radius
            // Destroy hostile projectile with a small blast
            triggerHostileProjectileExplosion(bossProj.position.clone(), 0.35, 0);
            markProjectileHit(proj);
            
            // If it's a decoy, explode it
            if (bossProj.userData.isDecoy && typeof window !== 'undefined' && window.createExplosionAt) {
              window.createExplosionAt(bossProj.position.clone(), bossProj.userData.explosionRadius, bossProj.userData.explosionDamage);
            }
            
            disposeObject3D(bossProj);
            projectiles.splice(j, 1);
            
            // Destroy player projectile (unless piercing)
            if (!proj.userData.stats?.piercing) {
              markProjectileHit(proj);
              resolveProjectileAccuracy(proj);
              if (proj.userData.isPooled) {
                returnProjectileToPool(proj);
              } else {
                disposeObject3D(proj);
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
            if (proj.position.distanceToSquared(visual.position) < 1.0) { // 1.0m radius squared
              // Destroy the visual
              spawnExplosionVisual(visual.position.clone(), 0.3);
              disposeObject3D(visual);
              explosionVisuals.splice(k, 1);
              markProjectileHit(proj);
              
              // Destroy player projectile (unless piercing)
              if (!proj.userData.stats?.piercing) {
                resolveProjectileAccuracy(proj);
                if (proj.userData.isPooled) {
                  returnProjectileToPool(proj);
                } else {
                  disposeObject3D(proj);
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

// [CORE] Handle VR upgrade card selection
function selectUpgrade(controller, index = -1) {
  if (upgradeSelectionCooldown > 0) return;

  controller.getWorldPosition(_uiSelectOrigin);
  controller.getWorldQuaternion(_uiSelectQuat);
  _uiSelectDir.set(0, 0, -1).applyQuaternion(_uiSelectQuat);
  _uiRaycaster.set(_uiSelectOrigin, _uiSelectDir, 0, 10);
  const hoverSourceKey = index >= 0 ? `controller-${index}` : 'controller';

  // Fix for the post-optimization regression: use the exact hovered card as a
  // fallback so trigger selection matches the card this controller is seeing.
  const result = getUpgradeCardHit(_uiRaycaster) || getHoveredUpgradeCardHit(hoverSourceKey);

  if (result) {
    if (index >= 0) upgradeTriggerLatched[index] = true;
    selectUpgradeAndAdvance(result.upgrade, result.hand);
  }
}

// ============================================================
// ENEMY WAVE SPAWNING
// spawnEnemyWave, fast enemy proximity alerts
// Called every frame during PLAYING state
// COUPLING: game._levelConfig, getBoss/spawnBoss, enemies.js
// ============================================================
// [CORE] Spawn enemy wave based on level config
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
        if (bossId === 'eclipse_engine') {
          playFinalBossAwakenSound();
        } else {
          playSkullLaughSound(); // Legacy boss intro/taunt
        }
        // Note: boss music already started during BOSS_ALERT, don't restart here
      }
    }
    return;
  }

  game.spawnTimer -= dt;
  if (game.spawnTimer <= 0) {
    game.spawnTimer = cfg.spawnInterval;

    // Don't spawn if we already have enough enemies
    if (getEnemyCount() < 15) {
      let types = cfg.enemyTypes;
      if (game.level === 19) {
        types = ['swarm', 'tank'];
      }
      const type = types[Math.floor(Math.random() * types.length)];

      // Calculate vertical spawn angle based on level
      let verticalAngle = 0;
      if (game.level >= 16) verticalAngle = 30;
      else if (game.level >= 11) verticalAngle = 20;
      else if (game.level >= 6) verticalAngle = 10;

      const distanceRange = type === 'conductor' ? { min: 8, max: 13 } : null;
      const pos = getSpawnPosition(cfg.airSpawns, verticalAngle, distanceRange);
      spawnEnemy(type, pos, cfg);

      // Alert on enemy spawn
      if (type === 'fast') {
        playFastEnemySpawn();
      } else if (type === 'swarm') {
        playSwarmEnemySpawn();
      } else if (type === 'tank') {
        playTankEnemySpawn();
      } else if (type === 'mortar') {
        playMortarEnemySpawn();
      } else {
        playBasicEnemySpawn();
      }
    }
  }
}

// [CORE] Update fast enemy proximity alerts
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
// RENDER LOOP (THE BIG ONE)
// Core game loop: time scaling, state machine, all subsystems
// HOT PATH: Called every frame (60fps target)
// SUB-SECTIONS: Title, Playing, Boss Death Cinematic, Paused,
//   Ready Screen, Boss Alert, Level Complete, Upgrade Select,
//   Game Over/Victory, UI Hover, Universal Updates
// COUPLING: Reads/writes game.state, calls ALL update functions
// RISK: Any change here affects frame timing, game feel, audio sync
// ============================================================
// [CORE] Main render loop (called every frame)
function render(timestamp) {
  frameCount++;
  const now = timestamp || performance.now();
  const rawDt = Math.min((now - lastTime) / 1000, 0.1);
  // Fix B: Cap delta time for game simulation to prevent enemies warping during frame spikes
  const MAX_FRAME_DT = 0.033; // ~30 FPS cap — enemies can never advance more than 33ms per frame
  const clampedRawDt = Math.min(rawDt, MAX_FRAME_DT);
  lastTime = now;

  // Frame profiler: start timing
  profiler.frameStart();

  // ── Frame profiler (debug/test only) ──
  const _prof = (typeof window !== 'undefined' && window.__perf && window.__perf._profileBuckets) ? window.__perf._profileBuckets : null;
  let _lastMark = _prof ? performance.now() : 0;
  const _mark = _prof ? (name) => { const t = performance.now(); _prof[name] = (_prof[name] || 0) + (t - _lastMark); _lastMark = t; } : () => {};
  if (_prof) { _prof._frames = (_prof._frames || 0) + 1; _prof._wallTotal = (_prof._wallTotal || 0) + (now - (_prof._prevFrameNow || now)); _prof._prevFrameNow = now; }

  // PERFORMANCE: Log stats every 5 seconds in debug mode
  if (runtimeConfig.dev.perfMonitor && frameCount % 300 === 0) {
    const instancedCounts = Object.entries(instancedProjectiles).map(([t, p]) => `${t}:${p.mesh.count}/${p.maxCount}`).join(', ');
    _log(`[PERF] Projectiles: ${projectiles.length}/${MAX_PROJECTILES}, ` +
                `InstancedMesh: {${instancedCounts}}, ` +
                `Explosions: ${explosionVisuals.length}`);
  }

  // Apply bullet-time slow-mo via smooth lerp, and death sequence
  if (game.slowmoActive) {
    // Death sequence slow-mo (takes priority)
    const remaining = game.slowmoTimer - now;
    if (remaining <= 0) {
      game.slowmoActive = false;
      game.timeScale = 1.0;
      _log('[slow-mo] Death sequence ended');
    } else {
      game.timeScale = game.slowmoIntensity;
    }
  } else {
    // Use proximity-based time scale from smooth lerp
    game.timeScale = window._timeScale || 1.0;
  }

  // Use game.timeScale if death sequence is active, otherwise use bullet-time timeScale
  let effectiveTimeScale = game.slowmoActive ? game.timeScale : timeScale;
  if (shouldFreezeTime()) {
    updateBossDeathFreeze(clampedRawDt);  // Fix B: use clamped dt for game simulation
    effectiveTimeScale = 0;
  }

  _mark('pre_ambient'); // ── end: timeScale + slowmo logic
  const dt = clampedRawDt * effectiveTimeScale;  // Fix B: use clamped dt for game simulation

  profiler.mark('scenery');
  if (currentTheme) {
    updateAmbientParticles(rawDt, currentTheme, getAdjustedCameraPosition());
  }
  updateBiomeProps(now, rawDt);
  profiler.end('scenery');
  _mark('ambient_biome'); // ── end: ambient particles + biome props

  // Process seeker burst queue (burst fire timing)
  processSeekerBurstQueue(now);

  // Fix 1.9: Profile desktop controls update
  if (!renderer.xr.isPresenting) {
    updateDesktopControls(dt);
    // #9: Synthwave pre-VR camera too low — ensure standing eye height
    if (currentTheme && currentTheme.customScene === 'synthwave_valley' && camera.position.y < 1.6) {
      camera.position.y = 1.6;
    }
  }
  _mark('desktop_controls'); // ── end: desktop controls update

  // Poll VR menu/thumbstick buttons so at least one hardware button can pause.
  updateVRPauseButton(now);

  let st = game.state;
  if (isBossDeathCinematicActive() && st !== State.BOSS_DEATH_CINEMATIC) {
    st = State.BOSS_DEATH_CINEMATIC;
    game.state = st;
  }

  // ── Title screen ──
  _mark('pre_state_dispatch'); // ── end: controls, seek, vr pause, desktop controls
  if (st === State.TITLE) {
    updateTitle(now);
    const level = consumeDebugJump();
    if (level) {
      debugJumpToLevel(level);
    }
  }

  // ── Playing ──
  else if (st === State.PLAYING) {
    // Track time played
    game.runStats.timePlayed += rawDt;

    // Update kills remaining alert (auto-hide after timeout)
    updateKillsAlert(now);

    // SAFEGUARD: Ensure blaster displays are visible during gameplay
    // Prevents text/billboard elements from disappearing
    blasterDisplays.forEach(d => { if (d) d.visible = false; });  // Hidden during gameplay

    spawnEnemyWave(dt);

    // Full-auto shooting / Lightning beams / Charge shots (VR controllers)
    for (let i = 0; i < 2; i++) {
      if (controllerTriggerPressed[i]) {
        const hand = getHandForController(i);
        const mainWeaponId = game.mainWeapon[hand];
        const stats = getWeaponStats(mainWeaponId, game.upgrades[hand]);

        if (stats.chargeShot) {
          if (chargeShotStartTime[i] === null) {
            // Start charging
            chargeShotStartTime[i] = now;
            startChargeSound(i);
            updateChargeVisuals(controllers[i], i, 0);  // Initialize visual at 0 charge
          } else {
            // Update charge progress
            const chargeTimeSec = (now - chargeShotStartTime[i]) / 1000;
            const progress = chargeTimeToProgress(chargeTimeSec, stats.chargeRateMultiplier || 1);
            updateChargeSound(i, progress);
            updateChargeVisuals(controllers[i], i, progress);

            // Play "ready" sound when fully charged (once)
            if (progress >= 0.99 && !controllers[i].userData.chargeReadySoundPlayed) {
              playChargeReadySound(i);
              controllers[i].userData.chargeReadySoundPlayed = true;
            }
          }
        } else if (stats.lightning) {
          updateLightningBeam(controllers[i], i, stats, dt);
        } else if (stats.windUp) {
          // Plasma carbine wind-up mechanic
          if (plasmaCarbineSpinStart[i] === null) {
            // Start spinning
            plasmaCarbineSpinStart[i] = now;
          } else {
            const spinTime = now - plasmaCarbineSpinStart[i];
            
            // Check if spin-up time has elapsed
            if (spinTime >= stats.windUpSpinTime) {
              // Calculate ramp progress (0 to 1 over ramp time)
              const rampProgress = Math.min(1, (spinTime - stats.windUpSpinTime) / stats.windUpRampTime);
              
              // Calculate current fire interval (interpolate from start to end)
              const currentInterval = stats.windUpStartInterval - 
                (stats.windUpStartInterval - stats.windUpEndInterval) * rampProgress;
              
              // Check if we can fire based on current interval
              if (now - plasmaCarbineLastFireTime[i] >= currentInterval) {
                fireMainWeapon(controllers[i], i);
                plasmaCarbineLastFireTime[i] = now;
              }
            }
          }
        } else {
          fireMainWeapon(controllers[i], i);
        }
      } else {
        // Trigger released - clean up charge state
        if (chargeShotStartTime[i] !== null) {
          stopChargeSound(i);
          hideChargeVisuals(i);
          if (controllers[i]) controllers[i].userData.chargeReadySoundPlayed = false;
        }
        chargeShotStartTime[i] = null;
        if (lightningBeams[i]) {
          clearLightningBeam(i);
        }
        // Clean up plasma carbine spin state
        plasmaCarbineSpinStart[i] = null;
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
              if (chargeShotStartTime[0] === null) {
                // Start charging
                chargeShotStartTime[0] = now;
                startChargeSound(0);
                updateChargeVisuals(virtualController, 0, 0);
              } else {
                // Update charge progress
                const chargeTimeSec = (now - chargeShotStartTime[0]) / 1000;
                const progress = chargeTimeToProgress(chargeTimeSec, stats.chargeRateMultiplier || 1);
                updateChargeSound(0, progress);
                updateChargeVisuals(virtualController, 0, progress);

                // Play "ready" sound when fully charged (once)
                if (progress >= 0.99 && !virtualController.userData.chargeReadySoundPlayed) {
                  playChargeReadySound(0);
                  virtualController.userData.chargeReadySoundPlayed = true;
                }
              }
            } else if (stats.lightning) {
              updateLightningBeam(virtualController, 0, stats, dt);
            } else if (stats.windUp) {
              // Plasma carbine wind-up mechanic
              if (plasmaCarbineSpinStart[0] === null) {
                plasmaCarbineSpinStart[0] = now;
              } else {
                const spinTime = now - plasmaCarbineSpinStart[0];
                if (spinTime >= stats.windUpSpinTime) {
                  const rampProgress = Math.min(1, (spinTime - stats.windUpSpinTime) / stats.windUpRampTime);
                  const currentInterval = stats.windUpStartInterval - 
                    (stats.windUpStartInterval - stats.windUpEndInterval) * rampProgress;
                  if (now - plasmaCarbineLastFireTime[0] >= currentInterval) {
                    fireMainWeapon(virtualController, 0);
                    plasmaCarbineLastFireTime[0] = now;
                  }
                }
              }
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
              if (chargeShotStartTime[1] === null) {
                // Start charging
                chargeShotStartTime[1] = now;
                startChargeSound(1);
                updateChargeVisuals(virtualController, 1, 0);
              } else {
                // Update charge progress
                const chargeTimeSec = (now - chargeShotStartTime[1]) / 1000;
                const progress = chargeTimeToProgress(chargeTimeSec, stats.chargeRateMultiplier || 1);
                updateChargeSound(1, progress);
                updateChargeVisuals(virtualController, 1, progress);

                // Play "ready" sound when fully charged (once)
                if (progress >= 0.99 && !virtualController.userData.chargeReadySoundPlayed) {
                  playChargeReadySound(1);
                  virtualController.userData.chargeReadySoundPlayed = true;
                }
              }
            } else if (stats.lightning) {
              updateLightningBeam(virtualController, 1, stats, dt);
            } else if (stats.windUp) {
              // Plasma carbine wind-up mechanic
              if (plasmaCarbineSpinStart[1] === null) {
                plasmaCarbineSpinStart[1] = now;
              } else {
                const spinTime = now - plasmaCarbineSpinStart[1];
                if (spinTime >= stats.windUpSpinTime) {
                  const rampProgress = Math.min(1, (spinTime - stats.windUpSpinTime) / stats.windUpRampTime);
                  const currentInterval = stats.windUpStartInterval - 
                    (stats.windUpStartInterval - stats.windUpEndInterval) * rampProgress;
                  if (now - plasmaCarbineLastFireTime[1] >= currentInterval) {
                    fireMainWeapon(virtualController, 1);
                    plasmaCarbineLastFireTime[1] = now;
                  }
                }
              }
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
          const stats = getWeaponStats(game.mainWeapon.left, game.upgrades.left);
          if (virtualController && stats.chargeShot) {
            const chargeTimeSec = (now - chargeShotStartTime[0]) / 1000;
            fireChargeBeam(virtualController, 0, chargeTimeSec, stats);
          }
          stopChargeSound(0);
          hideChargeVisuals(0);
          if (virtualController) virtualController.userData.chargeReadySoundPlayed = false;
          chargeShotStartTime[0] = null;
        }
        if (chargeShotStartTime[1] !== null) {
          // Fire the charge shot on release
          const virtualController = getVirtualController('right');
          const stats = getWeaponStats(game.mainWeapon.right, game.upgrades.right);
          if (virtualController && stats.chargeShot) {
            const chargeTimeSec = (now - chargeShotStartTime[1]) / 1000;
            fireChargeBeam(virtualController, 1, chargeTimeSec, stats);
          }
          stopChargeSound(1);
          hideChargeVisuals(1);
          if (virtualController) virtualController.userData.chargeReadySoundPlayed = false;
          chargeShotStartTime[1] = null;
        }
        // Clear lightning beams
        if (lightningBeams[0]) {
          clearLightningBeam(0);
        }
        if (lightningBeams[1]) {
          clearLightningBeam(1);
        }
        // Clear plasma carbine spin state
        plasmaCarbineSpinStart[0] = null;
        plasmaCarbineSpinStart[1] = null;
      }
    }

    // Fast enemy proximity alerts
    updateFastEnemyAlerts(dt, getAdjustedCameraPosition());

    // Update enemies - use adjusted camera position for VR mode
    // This ensures enemies target the correct height (1.6m) regardless of VR camera Y
    const playerPos = getAdjustedCameraPosition();
    camera.getWorldDirection(_playerForward);
    _playerForward.y = 0;
    if (_playerForward.lengthSq() < 0.0001) {
      _playerForward.set(0, 0, -1);
    } else {
      _playerForward.normalize();
    }
    setPlayerForward(_playerForward);

    // Update decoys and black holes (guarded to skip when no active instances)
    if (activeDecoys.length > 0) updateDecoys(dt, now, playerPos);
    if (activeMines.length > 0 || activeBlackHoles.length > 0) updateMinesAndBlackHoles(dt, now, playerPos);
    if (activeTethers.length > 0) updateTethers(dt, now, playerPos);
    if (activeNaniteSwarms.length > 0) updateNaniteSwarms(now, dt, playerPos);
    updatePhaseDashAfterimages(now, dt);
    if (activeReflectorDrones.length > 0) updateReflectorDrones(now, dt, playerPos);

    // Laser mine passive spawning (when player stands still)
    spawnLaserMinesPassively(playerPos, now, dt);

    // Update laser mines (guarded to skip when no active instances)
    if (activeLaserMines.length > 0) updateLaserMines(now, dt);

    // Apply bullet-time slow-mo and ramp-out (timer-based from commit 5bb0b69)
    if (slowMoRampOut) {
      slowMoRampOutTimer -= clampedRawDt;  // Fix B: use clamped dt for game simulation
      if (slowMoRampOutTimer <= 0) {
        slowMoRampOut = false;
        timeScale = 1.0;
        setSlowMoQuality(false);  // Fix A: restore GPU quality when ramp-out completes
      } else {
        timeScale = 0.2 + (1 - slowMoRampOutTimer / SLOW_MO_RAMP_OUT_DURATION) * 0.8;
      }
    } else if (slowMoActive) {
      slowMoDuration -= clampedRawDt;  // Fix B: use clamped dt for game simulation
      if (slowMoDuration <= 0) {
        slowMoActive = false;
        slowMoSoundPlayed = false;
        timeScale = 1.0;
        setSlowMoQuality(false);  // Fix A: restore GPU quality when slow-mo ends
        _log('[bullet-time] ENDED');
      } else {
        timeScale = 0.2;
      }
    } else {
      timeScale = 1.0;
    }

    // Fix 1.6: Eliminate per-frame closures in bullet-time
    // Replace filter() + some() with for loops and early exit
    // Skip entirely when there are no potential threats
    if (slowMoActive && !slowMoRampOut) {
      const enemiesForRamp = getEnemies();
      const bossProjsForRamp = getBossProjectiles();
      
      // Quick early exit if no threats exist at all
      if (enemiesForRamp.length === 0 && bossProjsForRamp.length === 0 && projectiles.length === 0) {
        // No threats - ramp out
        slowMoActive = false;
        slowMoSoundPlayed = false;
        slowMoRampOut = true;
        slowMoRampOutTimer = SLOW_MO_RAMP_OUT_DURATION;
        playSlowMoReverseSound();
        _log('[bullet-time] RAMP OUT — enemies cleared');
      } else {
        // Check for nearby enemies
        let anyNear = false;
        for (let i = 0; i < enemiesForRamp.length && !anyNear; i++) {
          const e = enemiesForRamp[i];
          if (e.mesh && e.mesh.position.distanceTo(playerPos) < SLOW_MO_TRIGGER_DIST) {
            anyNear = true;
          }
        }
        // Check for nearby boss projectiles
        for (let i = 0; i < bossProjsForRamp.length && !anyNear; i++) {
          const p = bossProjsForRamp[i];
          if (p && p.position.distanceTo(playerPos) < SLOW_MO_TRIGGER_DIST) {
            anyNear = true;
          }
        }
        // Check for nearby hostile shots (avoid filter allocation)
        for (let i = 0; i < projectiles.length && !anyNear; i++) {
          const p = projectiles[i];
          if (isHostileProjectile(p) && p.position.distanceTo(playerPos) < SLOW_MO_TRIGGER_DIST) {
            anyNear = true;
          }
        }
        
        if (!anyNear) {
          slowMoActive = false;
          slowMoSoundPlayed = false;
          slowMoRampOut = true;
          slowMoRampOutTimer = SLOW_MO_RAMP_OUT_DURATION;
          playSlowMoReverseSound();
          _log('[bullet-time] RAMP OUT — enemies cleared');
        }
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
          _log('[bullet-time] ACTIVATED!');
          break;
        }
      }
      if (!slowMoActive) {
        const bossProjs = getBossProjectiles();
        for (const proj of bossProjs) {
          const dist = proj.position.distanceTo(playerPos);
          if (dist < SLOW_MO_TRIGGER_DIST) {
            slowMoActive = true;
            slowMoDuration = 2.5;
            _log('[bullet-time] ACTIVATED!');
            break;
          }
        }
      }
      if (!slowMoActive) {
        for (const proj of projectiles) {
          if (!isHostileProjectile(proj)) continue;
          const dist = proj.position.distanceTo(playerPos);
          if (dist < SLOW_MO_TRIGGER_DIST) {
            slowMoActive = true;
            slowMoDuration = 2.5;
            _log('[bullet-time] ACTIVATED!');
            break;
          }
        }
      }
      if (slowMoActive && !slowMoSoundPlayed) {
        playSlowMoSound();
        slowMoSoundPlayed = true;
        setSlowMoQuality(true);  // Fix A: reduce GPU load during bullet-time
      }
    }

    // Fix 1.9: Profile enemy updates
    profiler.mark('enemies');
    const collisions = updateEnemies(dt, now, playerPos);
    profiler.end('enemies');

    // Update phase echo ghosts (clean up expired echoes)
    updatePhaseEchoes(dt, now);

    // Rebuild spatial hash for enemy proximity queries (O(1) lookups)
    // Skip entirely when no enemies exist to avoid per-frame overhead.
    const enemies = getEnemies();
    if (enemies.length > 0) {
      enemySpatialHash.clear();
      for (const e of enemies) {
        if (e.mesh) {
          const pos = e.mesh.position;
          enemySpatialHash.insert(e, pos.x, pos.z);
        }
      }
    }
    _mark('enemy_update'); // ── end: enemy updates + spatial hash

    // Fix 1.9: Profile boss updates
    profiler.mark('boss');
    const boss = getBoss();
    if (boss) {
      updateBoss(dt, now, playerPos);
      updateBossMinions(dt, playerPos);
      showBossHealthBar(boss.hp, boss.maxHp, boss.phases);
      updateBossHealthBar(boss.hp, boss.maxHp, boss.phases);

      // Check if boss was killed
      if (boss.hp <= 0) {
        _log(`[boss] Boss defeated!`);
        startBossDeathCinematic(boss);
      }
    } else {
      hideBossHealthBar();
    }
    profiler.end('boss');
    _mark('boss_update'); // ── end: boss updates + minions + health bar

    // Fix 1.9: Profile player collision handling
    // Handle enemy collisions with player
    collisions.forEach(index => {
      const _enemy = enemies[index];
      const _enemyType = _enemy?.type || 'unknown';
      destroyEnemy(index);
      const dead = damagePlayer(1);
      setKilledBy({ type: 'enemy', name: ENEMY_DISPLAY_NAMES[_enemyType] || _enemyType.toUpperCase(), enemyType: _enemyType });
      triggerHitFlash(true);
      playDamageSound();

      // Trigger camera shake
      cameraShake = 0.5;  // 0.5 second shake duration
      cameraShakeIntensity = 0.05;  // shake magnitude
      originalCameraPos.copy(camera.position);

      // Light screen shake on player damage
      triggerScreenShake(0.15, 500); // 0.15 shake for 500ms

      // Trigger floor flash
      floorFlashing = true;
      floorFlashTimer = 1.0;

      // Reset slow-mo state
      window._timeScale = 1.0;
      window._wasCloseEnemy = false;
      timeScale = 1.0;
      _log(`[damage] Player hit! Health: ${game.health}`);
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
        setKilledBy({ type: 'boss', name: boss.def?.name || 'Boss', enemyType: boss.def?.behavior || '' });
        triggerHitFlash(true);
        playDamageSound();
        cameraShake = 0.6;
        cameraShakeIntensity = 0.06;
        originalCameraPos.copy(camera.position);

        // Bigger shake for boss collision
        triggerScreenShake(0.3, 300); // 0.3 shake for 300ms

        floorFlashing = true;
        floorFlashTimer = 1.0;
        // Reset slow-mo state
        window._timeScale = 1.0;
        window._wasCloseEnemy = false;
        timeScale = 1.0;
        if (dead) endGame(false);
      }
    }

    // Boss minion collision with player
    const bossMinions = getBossMinions();
    if (bossMinions.length > 0) {
      const now2 = performance.now();
      for (let mi = 0; mi < bossMinions.length; mi++) {
        const minionMesh = bossMinions[mi]?.mesh;
        if (!minionMesh) continue;
        if (minionMesh.position.distanceTo(playerPos) < 1.0) {
          if (!minionMesh.userData._lastContactHit || now2 - minionMesh.userData._lastContactHit >= 1200) {
            minionMesh.userData._lastContactHit = now2;
            const dead = damagePlayer(1);
            setKilledBy({ type: 'boss', name: boss?.def?.name || 'Boss Minion', enemyType: boss?.def?.behavior || 'minion' });
            triggerHitFlash(true);
            playDamageSound();
            triggerScreenShake(0.15, 200);
            floorFlashing = true;
            floorFlashTimer = 0.6;
            if (dead) endGame(false);
          }
        }
      }
    }

    // Boss projectiles
    updateBossProjectiles(dt, now, playerPos);
    const bossProjs = getBossProjectiles();
    for (let i = bossProjs.length - 1; i >= 0; i--) {
      const proj = bossProjs[i];
      if (!proj) continue;

      // Warning beep when instanced boss projectiles are about to ruin your day.
      if (!proj._warned && proj.position.distanceTo(playerPos) < 4.0) {
        playProjectileWarningSound();
        proj._warned = true;
      }

      if (!proj.hitPlayer) continue;

      // Check if reflector drone can reflect this projectile
      if (checkReflectorDroneReflection(proj.position, true)) {
        // Projectile was reflected - remove it without damaging player
        if (proj._instIdx !== undefined) releaseBossProjIndex(proj._instIdx);
        bossProjs.splice(i, 1);
        continue;
      }

      triggerHostileProjectileExplosion(proj.position.clone(), 0.35, 0);
      if (proj._instIdx !== undefined) releaseBossProjIndex(proj._instIdx);
      bossProjs.splice(i, 1);

      const dead = damagePlayer(proj.damage || 1);
      const _skullBoss = getBoss();
      setKilledBy({ type: 'boss_projectile', name: _skullBoss?.def?.name || 'Boss', enemyType: _skullBoss?.def?.behavior || 'projectile' });
      triggerHitFlash(true);
      playDamageSound();
      if (_skullBoss && _skullBoss.def && (_skullBoss.def.behavior === 'skull' || _skullBoss.def.behavior === 'minotaur' || _skullBoss.def.behavior === 'prism')) {
        playSkullLaughSound();
      }
      cameraShake = 0.4;
      cameraShakeIntensity = 0.04;
      originalCameraPos.copy(camera.position);

      // Light screen shake on projectile damage
      triggerScreenShake(0.15, 500); // 0.15 shake for 500ms

      floorFlashing = true;
      floorFlashTimer = 1.0;
      if (dead) endGame(false);
    }

    // Check for DoT damage on enemies (reuse from spatial hash rebuild above)
    // enemies already declared
    enemies.forEach((e, i) => {
      if (e._lastDoT) {
        const colorMap = { fire: '#ff4400', shock: '#4488ff', freeze: '#88ccff' };
        spawnDamageNumber(e.mesh.position, e._lastDoT.damage, colorMap[e._lastDoT.type] || '#ffffff');
        delete e._lastDoT;

        if (e.hp <= 0) {
          handleEnemyKilled(i, { killsWithoutHit: true, skipChain: false });
        }
      }
    });

    // Update HUD (staggered — every 3rd frame to reduce geometry recreation cost)
    game._levelConfig = getLevelConfig();
    if (frameCount % 3 === 0) {
      updateHUD(game);
    }
  }

  // ── Boss death cinematic ──
  else if (st === State.BOSS_DEATH_CINEMATIC) {
    updateBossDeathCinematic(clampedRawDt);  // Fix B: use clamped dt for game simulation
  }

  // ── Paused ──
  else if (st === State.PAUSED) {
    // Game is paused - just update pause menu visuals
    updatePauseMenu(now);
  }

  // ── Ready screen countdown ──
  else if (st === State.READY_SCREEN) {
    updateReadyCountdown(now);
  }

  // ── Boss alert sequence ──
  // ── Universal Boss Spawn Cinematic (All boss levels) ──
  if (st === State.BOSS_ALERT && game._levelConfig && game._levelConfig.isBoss && !game._bossCinematicInit) {
    game._bossCinematicInit = true;
    const isFinalBossAlert = game.level >= 20;
    game._bossCinematicDuration = isFinalBossAlert ? 7.4 : 3.0;
    game._bossCinematicElapsed = 0;

    // Final boss gets an authored arrival in hellscape instead of the generic
    // red-shift intro. Spawn the real boss early, keep its health bar hidden,
    // and animate the mesh from the exploding moon into the arena.
    if (isFinalBossAlert) {
      game._cinFinalMoonGroup = null;
      game._cinFinalMoonCore = null;
      game._cinFinalMoonGlow = null;
      if (biomeSceneGroup) {
        biomeSceneGroup.traverse((child) => {
          if (child.name === 'hellscape-moon-group-1') game._cinFinalMoonGroup = child;
          if (child.name === 'hellscape-moon-1') game._cinFinalMoonCore = child;
          if (child.name === 'hellscape-moon-1-fake-glow') game._cinFinalMoonGlow = child;
        });
      }

      if (!getBoss()) {
        const bossId = getRandomBossIdForLevel(game.level);
        if (bossId) {
          spawnBoss(bossId, game._levelConfig);
          hideBossHealthBar();
        }
      }

      game._cinFinalBoss = getBoss();
      const moonPos = game._cinFinalMoonGroup
        ? game._cinFinalMoonGroup.getWorldPosition(new THREE.Vector3())
        : new THREE.Vector3(20, 30, -160);
      game._cinFinalBossIntroStartPos = moonPos.clone().add(new THREE.Vector3(0, 0, 10));
      game._cinFinalBossIntroEndPos = new THREE.Vector3(0, 5.8, -17.2);
      game._cinFinalMoonScale = game._cinFinalMoonGroup ? game._cinFinalMoonGroup.scale.clone() : new THREE.Vector3(1, 1, 1);
      game._cinFinalMoonVisible = true;
      game._cinFinalBossRevealSound = false;

      if (game._cinFinalBoss?.mesh) {
        game._cinFinalBoss.mesh.visible = false;
        game._cinFinalBoss.mesh.position.copy(game._cinFinalBossIntroStartPos);
        game._cinFinalBoss.mesh.scale.setScalar(0.16);
      }

      const burstMat = new THREE.MeshBasicMaterial({
        color: 0xffa54d,
        transparent: true,
        opacity: 0,
        depthWrite: false,
        fog: false,
      });
      game._cinFinalBurst = new THREE.Mesh(new THREE.SphereGeometry(3.5, 18, 14), burstMat);
      game._cinFinalBurst.position.copy(moonPos);
      game._cinFinalBurst.visible = false;
      scene.add(game._cinFinalBurst);

      const meteorGroup = new THREE.Group();
      const meteorGeo = new THREE.BoxGeometry(0.18, 0.18, 3.2);
      game._cinFinalMeteorGeo = meteorGeo;
      const meteorTargets = [
        [-12, 14, -38], [-7, 18, -32], [-3, 12, -26], [2, 16, -29],
        [7, 10, -24], [12, 15, -34], [16, 11, -28], [-16, 9, -30],
        [-10, 7, -20], [-4, 8, -18], [4, 6, -16], [10, 8, -22],
      ];
      meteorTargets.forEach((target, idx) => {
        const streak = new THREE.Mesh(
          meteorGeo,
          new THREE.MeshBasicMaterial({
            color: idx % 2 === 0 ? 0xffc06d : 0xff7a3d,
            transparent: true,
            opacity: 0,
            depthWrite: false,
            fog: false,
          }),
        );
        streak.visible = false;
        streak.userData.delay = 0.22 + idx * 0.035;
        streak.userData.start = moonPos.clone().add(new THREE.Vector3(
          (Math.random() - 0.5) * 5.5,
          (Math.random() - 0.5) * 4.0,
          (Math.random() - 0.5) * 4.0,
        ));
        streak.userData.end = new THREE.Vector3(target[0], target[1], target[2]);
        streak.userData.travel = 0.48 + Math.random() * 0.18;
        meteorGroup.add(streak);
      });
      scene.add(meteorGroup);
      game._cinFinalMeteorGroup = meteorGroup;

      _log('[Boss Cinematic] Starting final boss arrival cinematic');
    } else {
      // Find sun group in biome scene
      game._cinSunGroup = null;
      game._cinSkyMat = null;
      if (biomeSceneGroup) {
        biomeSceneGroup.traverse(child => {
          if (child.name === 'synthwave-sun-group') game._cinSunGroup = child;
          if (child.material && child.material.uniforms && child.material.uniforms.topColor) {
            game._cinSkyMat = child.material;
          }
        });
      }

      // Store original values for restoration later
      game._cinOrigSunY = game._cinSunGroup ? game._cinSunGroup.position.y : 270;
      game._cinOrigAmbientIntensity = 0.15;
      game._cinOrigDirIntensity = 0.8;
      game._cinOrigSkyOpacity = game._cinSkyMat ? game._cinSkyMat.opacity : 1.0;

      // Store original terrain colors if available
      game._cinOrigGridColor = null;
      game._cinOrigBaseColor = null;
      game._cinOrigPulseA = null;
      game._cinOrigPulseB = null;
      if (synthVisualRefs.terrainUniforms) {
        game._cinOrigGridColor = synthVisualRefs.terrainUniforms.uGridColor.value.clone();
        game._cinOrigBaseColor = synthVisualRefs.terrainUniforms.uBaseColor.value.clone();
        game._cinOrigFogColor = synthVisualRefs.terrainUniforms.uFogColor.value.clone();
        game._cinOrigPulseA = synthVisualRefs.terrainUniforms.uPulseColorA.value.clone();
        game._cinOrigPulseB = synthVisualRefs.terrainUniforms.uPulseColorB.value.clone();
      }

      // Store original mountain cylinder color for red tint
      if (synthVisualRefs.mountainCylMat) {
        game._cinOrigMountainColor = synthVisualRefs.mountainCylMat.color.clone();
      }

      // Store original skydome gradient colors for red fade
      game._cinOrigSkyTopColor = null;
      game._cinOrigSkyMidColor = null;
      game._cinOrigSkyHorizonColor = null;
      game._cinOrigSkyGlowColor = null;
      if (game._cinSkyMat && game._cinSkyMat.uniforms) {
        const su = game._cinSkyMat.uniforms;
        if (su.topColor) game._cinOrigSkyTopColor = su.topColor.value.clone();
        if (su.midColor) game._cinOrigSkyMidColor = su.midColor.value.clone();
        if (su.horizonColor) game._cinOrigSkyHorizonColor = su.horizonColor.value.clone();
        if (su.glowColor) game._cinOrigSkyGlowColor = su.glowColor.value.clone();
        // Also store moonGlowColor for desert biome
        if (su.moonGlowColor) game._cinOrigSkyMoonGlowColor = su.moonGlowColor.value.clone();
      }

      _log(`[Boss Cinematic] Starting spawn cinematic for level ${game.level}`);
    }
  }
  
  // Update boss cinematic during BOSS_ALERT
  if (st === State.BOSS_ALERT && game._levelConfig && game._levelConfig.isBoss && game._bossCinematicInit) {
    const elapsed = game._bossCinematicDuration - game.stateTimer;
    const t = Math.min(1, elapsed / game._bossCinematicDuration); // 0 to 1 progress

    if (game.level >= 20) {
      const moonCharge = Math.min(1, t / 0.24);
      const detonate = Math.min(1, Math.max(0, (t - 0.22) / 0.14));
      const bossApproach = Math.min(1, Math.max(0, (t - 0.28) / 0.52));
      const meteorT = Math.max(0, t - 0.24);

      if (game._cinFinalMoonGroup) {
        const pulse = 1 + moonCharge * 0.08 + Math.sin(now * 0.02) * 0.02;
        game._cinFinalMoonGroup.scale.copy(game._cinFinalMoonScale).multiplyScalar(pulse);
      }
      if (game._cinFinalMoonGlow?.material) {
        game._cinFinalMoonGlow.material.opacity = 0.6 + moonCharge * 0.95 - detonate * 0.55;
      }
      if (game._cinFinalMoonCore && detonate >= 1 && game._cinFinalMoonVisible) {
        game._cinFinalMoonCore.visible = false;
        game._cinFinalMoonVisible = false;
      }

      if (game._cinFinalBurst) {
        const burstProgress = Math.max(0, Math.min(1, (t - 0.2) / 0.26));
        game._cinFinalBurst.visible = burstProgress > 0;
        game._cinFinalBurst.scale.setScalar(1 + burstProgress * 7.5);
        game._cinFinalBurst.material.opacity = burstProgress > 0 ? (1 - burstProgress) * 0.9 : 0;
      }

      if (game._cinFinalMeteorGroup) {
        game._cinFinalMeteorGroup.children.forEach((streak) => {
          const local = (meteorT - streak.userData.delay) / streak.userData.travel;
          if (local < 0 || local > 1) {
            streak.visible = false;
            return;
          }
          streak.visible = true;
          streak.position.lerpVectors(streak.userData.start, streak.userData.end, local);
          streak.lookAt(streak.userData.end);
          streak.material.opacity = 0.85 * (1 - local * 0.35);
        });
      }

      if (game._cinFinalBoss?.mesh) {
        if (!game._cinFinalBossRevealSound && bossApproach > 0.05) {
          game._cinFinalBossRevealSound = true;
          playBossSpawn();
          playFinalBossAwakenSound();
        }

        const ease = 1 - Math.pow(1 - bossApproach, 3);
        game._cinFinalBoss.mesh.visible = bossApproach > 0.01;
        game._cinFinalBoss.mesh.position.lerpVectors(game._cinFinalBossIntroStartPos, game._cinFinalBossIntroEndPos, ease);
        const introScale = 0.16 + ease * 1.35;
        game._cinFinalBoss.mesh.scale.setScalar(introScale);
        game._cinFinalBoss.mesh.rotation.y += clampedRawDt * (0.4 + (1 - bossApproach) * 1.8);
      }
    } else {
      // 1. Move sun downward (-Y) below horizon
      if (game._cinSunGroup) {
        game._cinSunGroup.position.y = game._cinOrigSunY * (1 - t * 1.5);
      }

      // 3. Fade skydome opacity to 20%
      if (game._cinSkyMat) {
        game._cinSkyMat.opacity = game._cinOrigSkyOpacity * (1 - t * 0.8);
      }

      // 4. Shift floor grid and base colors to locked red shades
      if (synthVisualRefs.terrainUniforms && game._cinOrigGridColor) {
        const redGrid = new THREE.Color(0x880000);  // Dark crimson grid
        const redBase = new THREE.Color(0x1a0000);  // Very dark red base
        const redFog = new THREE.Color(0x220000);   // Dark red fog
        const redPulseA = new THREE.Color(0xcc0000); // Normal red (former pink)
        const redPulseB = new THREE.Color(0x660000); // Dark red (former cyan)
        synthVisualRefs.terrainUniforms.uGridColor.value.copy(game._cinOrigGridColor).lerp(redGrid, t);
        synthVisualRefs.terrainUniforms.uBaseColor.value.copy(game._cinOrigBaseColor).lerp(redBase, t);
        synthVisualRefs.terrainUniforms.uFogColor.value.copy(game._cinOrigFogColor).lerp(redFog, t);
        if (game._cinOrigPulseA) {
          synthVisualRefs.terrainUniforms.uPulseColorA.value.copy(game._cinOrigPulseA).lerp(redPulseA, t);
        }
        if (game._cinOrigPulseB) {
          synthVisualRefs.terrainUniforms.uPulseColorB.value.copy(game._cinOrigPulseB).lerp(redPulseB, t);
        }
      }

      // 4b. Fade skydome gradient to dark reds (~30% darker than original brightness)
      if (game._cinSkyMat && game._cinSkyMat.uniforms) {
        const su = game._cinSkyMat.uniforms;
        const redTop = new THREE.Color(0x12000a);
        const redMid = new THREE.Color(0x32001a);
        const redHorizon = new THREE.Color(0x701a1a);
        const redGlow = new THREE.Color(0x6a0020);
        const redMoonGlow = new THREE.Color(0x301020);
        if (su.topColor && game._cinOrigSkyTopColor) {
          su.topColor.value.copy(game._cinOrigSkyTopColor).lerp(redTop, t);
        }
        if (su.midColor && game._cinOrigSkyMidColor) {
          su.midColor.value.copy(game._cinOrigSkyMidColor).lerp(redMid, t);
        }
        if (su.horizonColor && game._cinOrigSkyHorizonColor) {
          su.horizonColor.value.copy(game._cinOrigSkyHorizonColor).lerp(redHorizon, t);
        }
        if (su.glowColor && game._cinOrigSkyGlowColor) {
          su.glowColor.value.copy(game._cinOrigSkyGlowColor).lerp(redGlow, t);
        }
        if (su.moonGlowColor && game._cinOrigSkyMoonGlowColor) {
          su.moonGlowColor.value.copy(game._cinOrigSkyMoonGlowColor).lerp(redMoonGlow, t);
        }
      }

      // 5. Shift sun glow materials to red
      if (synthVisualRefs.sunOuterGlowMat) {
        synthVisualRefs.sunOuterGlowMat.color.lerp(new THREE.Color(0xff2200), t * 0.1);
      }
      if (synthVisualRefs.sunGlowMat) {
        synthVisualRefs.sunGlowMat.color.lerp(new THREE.Color(0xff3300), t * 0.1);
      }
      if (synthVisualRefs.sunCoreMat) {
        synthVisualRefs.sunCoreMat.color.lerp(new THREE.Color(0xff0000), t * 0.1);
      }

      // 6. Tint mountain wrap cylinder to red during cinematic
      if (synthVisualRefs.mountainCylMat && game._cinOrigMountainColor) {
        const redMountain = new THREE.Color(0x882244);  // Dark red-purple tint
        synthVisualRefs.mountainCylMat.color.copy(game._cinOrigMountainColor).lerp(redMountain, t);
      }

      // 7. Desert biome: tint moon and moon glow red (Prism Boss)
      if (synthVisualRefs.desertMoonMat && !game._cinOrigDesertMoonColor) {
        game._cinOrigDesertMoonColor = synthVisualRefs.desertMoonMat.color.clone();
      }
      if (synthVisualRefs.desertMoonMat && game._cinOrigDesertMoonColor) {
        synthVisualRefs.desertMoonMat.color.copy(game._cinOrigDesertMoonColor).lerp(new THREE.Color(0xcc0000), t);
      }
      if (synthVisualRefs.desertMoonGlowMat && !game._cinOrigDesertMoonGlowColor) {
        game._cinOrigDesertMoonGlowColor = synthVisualRefs.desertMoonGlowMat.color.clone();
      }
      if (synthVisualRefs.desertMoonGlowMat && game._cinOrigDesertMoonGlowColor) {
        synthVisualRefs.desertMoonGlowMat.color.copy(game._cinOrigDesertMoonGlowColor).lerp(new THREE.Color(0xff2200), t);
      }

      // 8. Alien biome: tint city buildings and green light red (Minotaur)
      if (synthVisualRefs.alienCityShaderMat && !game._cinOrigAlienMoonColor) {
        game._cinOrigAlienMoonColor = synthVisualRefs.alienCityShaderMat.uniforms.uMoonColor.value.clone();
        game._cinOrigAlienBaseColor = synthVisualRefs.alienCityShaderMat.uniforms.uBaseColor.value.clone();
      }
      if (synthVisualRefs.alienCityShaderMat && game._cinOrigAlienMoonColor) {
        synthVisualRefs.alienCityShaderMat.uniforms.uMoonColor.value.copy(game._cinOrigAlienMoonColor).lerp(new THREE.Color(0xff2200), t);
        synthVisualRefs.alienCityShaderMat.uniforms.uBaseColor.value.copy(game._cinOrigAlienBaseColor).lerp(new THREE.Color(0x150005), t);
      }
      if (synthVisualRefs.alienGreenLight && !game._cinOrigAlienGreenLightColor) {
        game._cinOrigAlienGreenLightColor = synthVisualRefs.alienGreenLight.color.clone();
      }
      if (synthVisualRefs.alienGreenLight && game._cinOrigAlienGreenLightColor) {
        synthVisualRefs.alienGreenLight.color.copy(game._cinOrigAlienGreenLightColor).lerp(new THREE.Color(0xff2200), t);
      }
    }
  }
  
  // Reset cinematic state when leaving BOSS_ALERT for boss levels
  if (st === State.PLAYING && game._bossCinematicInit && !game._bossCinematicCleaned) {
    game._bossCinematicCleaned = true;
    if (game.level >= 20) {
      if (game._cinFinalMeteorGroup?.parent) {
        game._cinFinalMeteorGroup.children.forEach((child) => {
          if (child.material) child.material.dispose();
        });
        game._cinFinalMeteorGroup.parent.remove(game._cinFinalMeteorGroup);
      }
      if (game._cinFinalMeteorGeo) {
        game._cinFinalMeteorGeo.dispose();
        game._cinFinalMeteorGeo = null;
      }
      if (game._cinFinalBurst?.parent) {
        if (game._cinFinalBurst.material) game._cinFinalBurst.material.dispose();
        if (game._cinFinalBurst.geometry) game._cinFinalBurst.geometry.dispose();
        game._cinFinalBurst.parent.remove(game._cinFinalBurst);
      }
      if (game._cinFinalBoss?.mesh) {
        game._cinFinalBoss.mesh.visible = true;
        game._cinFinalBoss.mesh.scale.setScalar(1.15);
        if (game._cinFinalBoss.currentScale !== undefined) game._cinFinalBoss.currentScale = 1.15;
        if (game._cinFinalBoss.targetScale !== undefined) game._cinFinalBoss.targetScale = 1.15;
      }
    }
    _log(`[Boss Cinematic] Cinematic complete for level ${game.level}, boss fight in red environment`);
    // Don't restore original values - keep the red-shifted environment for the boss fight
  }

  else if (st === State.BOSS_ALERT) {
    game.stateTimer -= clampedRawDt;  // Fix B: use clamped dt for game simulation
    
    // Play alert sound periodically
    if (game.stateTimer > 1.0 && game.stateTimer < 2.5 && !game._alertSound2) {
      game._alertSound2 = true;
      playBossAlertSound();
    }
    
    // After 3s: transition to PLAYING, spawn boss (music already started)
    if (game.stateTimer <= 0) {
      game._alertSound2 = false;
      hideBossAlert();
      game.state = State.PLAYING;
      showHUD();
      const boss = getBoss();
      if (boss) {
        showBossHealthBar(boss.hp, boss.maxHp, boss.phases);
      }
      // Boss music already started in advanceLevelAfterUpgrade
      _log(`[game] Boss fight starting at level ${game.level}`);
    }
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
    // UI cooldown should use unscaled frame time so menu interaction never gets
    // trapped behind bullet-time, death-freeze, or other gameplay time scaling.
    upgradeSelectionCooldown = Math.max(0, upgradeSelectionCooldown - clampedRawDt);
    updateUpgradeCards(now, upgradeSelectionCooldown);

    // WebXR selectstart can occasionally drift around state transitions.
    // Poll held trigger state as a fallback so upgrades remain selectable even
    // if the initial edge was missed while the screen was entering.
    if (upgradeSelectionCooldown <= 0) {
      for (let i = 0; i < controllers.length; i++) {
        if (!controllerTriggerPressed[i] || upgradeTriggerLatched[i] || !controllers[i]) continue;
        selectUpgrade(controllers[i], i);
      }
    }

    // Show and update blaster displays
    // PERFORMANCE: Shader animation replaces mesh-based scan lines
    // Single uTime uniform update per display vs 8 mesh position updates
    const holoTime = performance.now() * 0.001;
    blasterDisplays.forEach((display, i) => {
      if (display) {
        display.visible = true;
        if (display.userData.needsUpdate) {
          updateBlasterDisplay(display, i);
        }
        // Update hologram shader time uniform for scan line animation
        if (display.userData.holoMaterial) {
          display.userData.holoMaterial.uniforms.uTime.value = holoTime;
        }
      }
    });
  }

  // ── Game over / Victory ──
  else if (st === State.GAME_OVER || st === State.VICTORY) {
    updateEndScreen(now);
    gameOverCooldown = Math.max(0, gameOverCooldown - dt);
  }

  // ── Name entry hover is handled by the unified updateHUDHover below ──

  if (st !== State.PLAYING) {
    // (holographic glitch update removed)
  }

  // ── Unified UI hover detection for all menu states ──
  if (st === State.TITLE || st === State.UPGRADE_SELECT || st === State.SCOREBOARD || 
      st === State.REGIONAL_SCORES || st === State.COUNTRY_SELECT || st === State.READY_SCREEN ||
      st === State.NAME_ENTRY || st === State.PAUSED) {
    // PERFORMANCE: Reuse pooled raycasters instead of creating new ones each frame
    // This reduces GC pressure during menu navigation and keyboard name entry
    const raycasters = [];
    for (let i = 0; i < controllers.length; i++) {
      const ctrl = controllers[i];
      if (!ctrl) continue;
      // Reuse pooled objects instead of creating new ones
      const origin = _uiHoverOrigins[i];
      const quat = _uiHoverQuats[i];
      const dir = _uiHoverDirs[i];
      ctrl.getWorldPosition(origin);
      ctrl.getWorldQuaternion(quat);
      dir.set(0, 0, -1).applyQuaternion(quat);
      // Reuse pooled raycaster and update its properties
      const rc = _uiHoverRaycasters[i];
      rc.set(origin, dir, 0, 10);
      rc._hudSourceKey = `controller-${i}`;
      raycasters.push(rc);
    }
    // Also add desktop aim raycaster if available
    if (isDesktopEnabled()) {
      const desktopRC = getAimRaycaster();
      if (desktopRC) {
        desktopRC._hudSourceKey = 'desktop';
        raycasters.push(desktopRC);
      }
    }
    // Add keyboard hover raycaster if name entry is visible
    if (nameEntryGroup.visible) {
      const keyboardRC = getAimRaycaster();
      if (keyboardRC) raycasters.push(keyboardRC);
    }
    // Update hover effects (throttled to 30Hz to reduce raycasting cost)
    if (raycasters.length > 0 && frameCount % 2 === 0) {
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
  // NOTE: Skip camera position modification in VR - WebXR controls camera position
  // and modifying it directly causes fighting/alternation with headset tracking
  if (cameraShake > 0 && !renderer.xr.isPresenting) {
    cameraShake -= rawDt;
    if (cameraShake <= 0) {
      cameraShake = 0;
    } else {
      // Apply random shake offset (desktop only)
      const shake = cameraShakeIntensity * (cameraShake / 0.5);  // Fade out over duration
      camera.position.x += (Math.random() - 0.5) * shake;
      camera.position.y += (Math.random() - 0.5) * shake;
      camera.position.z += (Math.random() - 0.5) * shake;
    }
  } else if (cameraShake > 0) {
    // In VR, just decrement timer without modifying camera position
    cameraShake -= rawDt;
    if (cameraShake <= 0) cameraShake = 0;
  }

  // ── VR camera height is handled by XR reference space offset ──
  // The offset is applied once when the XR session starts (see sessionstart handler)
  // No per-frame modification needed - the reference space handles it correctly

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
    setLowHealthScreenPulse(true);
  } else if (!shouldLowHealthWarn && lowHealthWarningActive) {
    lowHealthWarningActive = false;
    lowHealthPulseTimer = 0;
    stopLowHealthWarningSound();
    setLowHealthScreenPulse(false);
    // Reset terrain flash
    biomeTerrainMaterials.forEach(item => {
      if (item.type === 'shader') {
        item.material.uniforms.uFlashIntensity.value = 0;
      } else {
        item.material.opacity = 0;
      }
    });
  }

  // ── Floor damage flash (primary VR hit indicator) ──
  if (floorFlashing) {
    floorFlashTimer -= rawDt;
    if (floorFlashTimer <= 0) {
      floorFlashing = false;
      // Reset terrain flash
      biomeTerrainMaterials.forEach(item => {
        if (item.type === 'shader') {
          item.material.uniforms.uFlashIntensity.value = 0;
        } else {
          item.material.opacity = 0;
        }
      });
    } else {
      // Lerp from bright red back to base color over 1 second
      const t = floorFlashTimer / 0.3;  // 0.3s flash duration (VR comfort)
      const flashIntensity = t;  // 0 to 1, fading out
      const flashColor = new THREE.Color(0xff0000);
      // Flash terrain materials
      biomeTerrainMaterials.forEach(item => {
        if (item.type === 'shader') {
          item.material.uniforms.uFlashIntensity.value = flashIntensity * 0.2;  // Max 20% red (VR comfort)
        } else {
          item.material.opacity = flashIntensity * 0.2;  // Max 20% opacity (VR comfort)
        }
      });
    }
  }

  // ── Low health pulse (only when not flashing) ──
  if (!floorFlashing && lowHealthWarningActive && floorMaterial) {
    lowHealthPulseTimer += rawDt;
    const pulse = (Math.sin(lowHealthPulseTimer * 2.6) + 1) * 0.5;
    const intensity = 0.2 + pulse * 0.45;
    const warningColor = new THREE.Color(0xaa0000);
    floorMaterial.color.lerpColors(floorBaseColor, warningColor, intensity);
    // Also pulse terrain
    biomeTerrainMaterials.forEach(item => {
      if (item.type === 'shader') {
        item.material.uniforms.uFlashIntensity.value = intensity * 0.3;
      } else {
        item.material.opacity = intensity * 0.25;
      }
    });
  }

  _mark('state_dispatch'); // ── end: state_dispatch (PLAYING/TITLE/PAUSE logic)
  // ── Universal updates ──
  profiler.mark('projectiles');
  updateProjectiles(dt);
  profiler.end('projectiles');
  profiler.mark('voxelDebris');
  updateVoxelPhysics(dt, now);  // PHYSICS DEATH SYSTEM

  // Update debris glow planes: billboard toward camera, follow voxel position
  if (_debrisGlowActive.length > 0 && _debrisGlowPool) {
    for (let gi = _debrisGlowActive.length - 1; gi >= 0; gi--) {
      const entry = _debrisGlowActive[gi];
      const voxel = entry.voxel;
      if (!voxel || !voxel.visible) {
        // Voxel returned to pool, release glow instance
        _debrisGlowPool.setMatrixAt(entry.glowIdx, _debrisGlowHideMat);
        _debrisGlowFree.push(entry.glowIdx);
        _debrisGlowActive.splice(gi, 1);
        continue;
      }
      // Billboard toward camera
      if (camera) {
        _debrisGlowBillboardMat.lookAt(voxel.position, camera.position, _debrisGlowUpVec);
        _debrisGlowQuat.setFromRotationMatrix(_debrisGlowBillboardMat);
      }
      // Fade glow with voxel opacity
      const age = performance.now() - voxel.userData.createdAt;
      const fadeStart = voxel.userData.lifetime - 500;
      const glowOpacity = age > fadeStart ? Math.max(0, 1.0 - (age - fadeStart) / 500) : 1.0;
      const s = 0.55 * glowOpacity;
      _debrisGlowScale.set(Math.max(s, 0.01), Math.max(s, 0.01), Math.max(s, 0.01));
      _debrisGlowMatrix.compose(voxel.position, _debrisGlowQuat, _debrisGlowScale);
      _debrisGlowPool.setMatrixAt(entry.glowIdx, _debrisGlowMatrix);
    }
    _debrisGlowPool.instanceMatrix.needsUpdate = true;
  }
  profiler.end('voxelDebris');
  if (activeShields.length > 0) updateShields(now);
  if (activeStasisFields.length > 0) updateStasisFields(now, dt);
  if (activePlasmaOrbs.length > 0) updatePlasmaOrbs(now, dt);
  updateExplosions(dt, now);
  updateVFX(dt);
  // Always update: handles both pooled explosions and non-pooled visuals.
  // Was gated on explosionVisuals.length > 0, which caused pooled spheres
  // to freeze visible when no non-pooled effects existed (level transition bug).
  updateExplosionVisuals(dt, now);
  profiler.mark('damageNumbers');
  updateDamageNumbers(dt, now);
  profiler.end('damageNumbers');
  updateStatusBubbles(dt, now);
  updateChargeExplosions(dt);
  updateBossDebris(dt, now, getBiomeFloorY());  // Boss debris physics with biome-aware floor
  // Update accuracy popups with fade-complete callback to reset bonus
  updateKillChainPopups(dt, now, (multiplier) => {
    // When popup fully fades, reset accuracy bonus if no new popup appeared
    // This creates the "quick deterioration" feel - bonus only lasts while popup is visible
    if (game.accuracyMultiplier <= multiplier) {
      // Only reset if we haven't built up a higher multiplier
      game.accuracyBonus = 0;
      game.accuracyMultiplier = 1;
    }
  });
  updateHitFlash(rawDt);  // Use rawDt so flash works during bullet-time
  // Speed lines: intensity 0 (normal) to 1 (full slow-mo)
  if (effectiveTimeScale < 0.99) {
    updateSpeedLines(Math.min(1.0, (1.0 - effectiveTimeScale) / 0.8));
  } else {
    updateSpeedLines(0);
  }
  if (ENABLE_MUZZLE_FLASH) updateMuzzleFlash();

  // Nuke flash decay
  if (nukeFlash && nukeFlashTimer > 0) {
    const elapsed = performance.now() - nukeFlashTimer;
    const t = Math.max(0, 1 - elapsed / NUKE_FLASH_DURATION);
    nukeFlash.material.opacity = t * t; // Quadratic ease-out
    if (t <= 0) {
      nukeFlashTimer = 0;
      nukeFlash.material.opacity = 0;
    }
  }

  // ── New ALT weapon updates (guarded to skip when no active instances) ──
  if (activeGrenades.length > 0) updateGrenades(dt, now);
  if (activeProximityMines.length > 0) updateProximityMines(now, dt);
  if (activeAttackDrones.length > 0) updateAttackDrones(now, dt, getAdjustedCameraPosition());
  if (activeEMPVisuals.length > 0) updateEMPVisuals(now, dt);
  if (activeTeleportEffects.length > 0) updateTeleportEffects(now, dt);
  _mark('universal_updates'); // ── end: projectiles, physics, shields, VFX, damage numbers, grenades, FPS
  updateFPS(now, {
    perfMonitor: runtimeConfig.dev.perfMonitor,
    frameTimeMs: rawDt * 1000,
    rendererInfo: renderer.info,
  });

  // Hide scanlines overlay in VR — it creates a dark box that follows the head and obscures the view
  // Fix 1.3: Use cached element instead of per-frame query
  if (_cachedScanlinesEl) _cachedScanlinesEl.style.display = renderer.xr.isPresenting ? 'none' : '';

  _mark('scanlines_misc'); // ── end: FPS, scanlines DOM
  // Fix 1.4: Gate visual tuning behind debug flag to avoid per-frame object allocation + material iteration
  // Only run when debug panel is open or visual tuning has changed
  const visualTuning = runtimeConfig.dev.perfMonitor ? getVisualTuning() : null;
  if (visualTuning) {
    applyVisualTuning(visualTuning);
  }
  _mark('visual_tuning'); // ── end: applyVisualTuning

  // Update pause countdown BEFORE any early-return render path so desktop debug
  // effects never freeze the countdown.
  updatePauseCountdown(now);

  maybeRecordTelemetry(now, rawDt, dt);
  _mark('telemetry'); // ── end: maybeRecordTelemetry

  // Desktop-only debug effects. XR intentionally keeps the default renderer path.
  // Fix 1.4: visualTuning may be null when debug mode is off
  if (!renderer.xr.isPresenting && visualTuning && renderDesktopDebugEffect(visualTuning)) {
    _mark('render_gpu'); _mark('total');
    profiler.frameEnd();
    return;
  }

  renderer.render(scene, camera);
  _mark('render_gpu'); _mark('total');
  profiler.frameEnd();
}

// ============================================================
//  PERFORMANCE TELEMETRY SUPPORT
// ============================================================
// [CORE] Check if telemetry sample should be collected
function shouldCollectTelemetrySample() {
  if (!renderer) return false;
  // Always sample at 1/6 rate (every 6th frame) even when enabled,
  // to keep telemetry overhead under 1ms per frame.
  if (frameCount % 6 !== 0) return false;
  if (isTelemetryEnabled()) return true;
  if (runtimeConfig.dev.perfMonitor) return true;
  return false;
}

// [CORE] Record telemetry sample if conditions are met
function maybeRecordTelemetry(now, rawDt, scaledDt) {
  if (!shouldCollectTelemetrySample()) return false;
  recordTelemetrySample({
    now,
    frame: frameCount,
    frameTimeMs: rawDt * 1000,
    rawDelta: rawDt,
    delta: scaledDt,
    renderer: collectRendererStats(),
    memory: collectHeapStats(),
    counts: collectRuntimeCounts(),
    gameplay: collectGameplaySnapshot(),
  });
  return true;
}

// [CORE] Collect renderer statistics
function collectRendererStats() {
  if (!renderer || !renderer.info) return null;
  const info = renderer.info;
  return {
    drawCalls: info.render.calls,
    triangles: info.render.triangles,
    lines: info.render.lines,
    points: info.render.points,
    geometries: info.memory.geometries,
    textures: info.memory.textures,
    programs: Array.isArray(info.programs) ? info.programs.length : (info.programs || 0),
  };
}

// [CORE] Collect heap memory statistics
function collectHeapStats() {
  if (typeof performance === 'undefined' || !performance.memory) return null;
  const { usedJSHeapSize, totalJSHeapSize, jsHeapSizeLimit } = performance.memory;
  const toMb = (bytes) => Number((bytes / 1048576).toFixed(2));
  return {
    usedBytes: usedJSHeapSize,
    totalBytes: totalJSHeapSize,
    limitBytes: jsHeapSizeLimit,
    usedMB: toMb(usedJSHeapSize),
    totalMB: toMb(totalJSHeapSize),
    limitMB: toMb(jsHeapSizeLimit),
  };
}

// [CORE] Collect runtime object counts
function collectRuntimeCounts() {
  const instancedStats = {};
  Object.entries(instancedProjectiles).forEach(([key, pool]) => {
    instancedStats[key] = {
      active: pool.mesh ? pool.mesh.count : 0,
      max: pool.maxCount || 0,
      free: pool.freeIndices ? pool.freeIndices.size : 0,
    };
  });

  const bossMinions = typeof getBossMinions === 'function' ? getBossMinions() : null;

  return {
    enemies: getEnemyCount(),
    bossActive: !!getBoss(),
    bossProjectiles: getBossProjectiles().length,
    bossMinions: bossMinions ? bossMinions.length : 0,
    projectiles: projectiles.length,
    instancedProjectiles: instancedStats,
    projectileQueue: seekerBurstQueue.length,
    explosionVisuals: explosionVisuals.length,
    voxelsActive: activeVoxels.length,
    voxelPoolFree: voxelPool.length,
    shields: activeShields.length,
    stasisFields: activeStasisFields.length,
    plasmaOrbs: activePlasmaOrbs.length,
    laserMines: activeLaserMines.length,
    grenades: activeGrenades.length,
    decoys: activeDecoys.length,
    blackHoles: activeBlackHoles.length,
    mines: activeMines.length,
    tethers: activeTethers.length,
    naniteSwarms: activeNaniteSwarms.length,
    reflectorDrones: activeReflectorDrones.length,
    attackDrones: activeAttackDrones.length,
    teleportEffects: activeTeleportEffects.length,
    empBursts: activeEMPVisuals.length,
    phaseDashAfterimages: activePhaseDashAfterimages.length,
  };
}

// [CORE] Collect gameplay state snapshot
function collectGameplaySnapshot() {
  const levelConfig = getLevelConfig();
  return {
    state: game.state,
    level: game.level,
    isBossLevel: levelConfig?.isBoss || false,
    killTarget: levelConfig?.killTarget ?? null,
    kills: game.kills,
    totalKills: game.totalKills,
    score: game.score,
    health: game.health,
    maxHealth: game.maxHealth,
    nukes: game.nukes,
    slowmoActive: game.slowmoActive,
    slowmoIntensity: game.slowmoIntensity,
    timeScale: game.timeScale,
    bulletTimeScale: timeScale,
    runStats: {
      timePlayed: game.runStats.timePlayed,
      shotsFired: game.runStats.shotsFired,
      shotsHit: game.runStats.shotsHit,
      bossesKilled: game.runStats.bossesKilled,
    },
  };
}

// ============================================================
//  WINDOW RESIZE
// ============================================================
// [CORE] Handle window resize
function onWindowResize() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
  resizeDesktopStereoEffects();
}

// ============================================================
// BIOME SCENE ORCHESTRATION
// Delegates to biome-scenes.js module for scene building
// COUPLING: biomeSceneGroup, biomeSceneBiome state shared via getters
// ============================================================

// Wrapper that delegates to biome-scenes.js module
// [CORE] Rebuild biome scene from biome-scenes module
function rebuildBiomeScene(biomeId, theme) {
  // State object that the module can update
  const state = {
    get biomeSceneGroup() { return biomeSceneGroup; },
    set biomeSceneGroup(val) { biomeSceneGroup = val; },
    get biomeSceneBiome() { return biomeSceneBiome; },
    set biomeSceneBiome(val) { biomeSceneBiome = val; },
  };

  rebuildBiomeSceneModule({
    scene,
    biomeId,
    theme,
    state,
    clearBiomeScene,
    registerFadeMaterial,
    cleanupLegacyShapeGeometry,
    assignBiomePlaneNames,
    refs: {
      floorMaterial,
      synthVisualRefs,
      getVisualTuning,
    },
    biomeTerrainMaterials,
  });
}

// Get physics floor Y for current biome (matches visual floor HUD height)
// [CORE] Get biome floor Y coordinate
function getBiomeFloorY() {
  return getBiomeFloorYModule(biomeSceneBiome, SCENE_Y_OFFSET);
}
