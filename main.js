// ============================================================
//  SPACEOMICIDE — Main Game Controller
//  Phase 1: Core game loop with levels, enemies, upgrades, HUD
// ============================================================

// ============================================================
// MODULE IMPORTS
// Dependencies: game.js, weapons.js, audio.js, enemies.js,
//   stasis.js, vfx.js, biome-scenes.js, boss-death-cinematic.js,
//   hud.js, desktop-controls.js, scoreboard.js, scenery.js,
//   dream-world.js, spatial-hash.js
// ============================================================

import * as THREE from 'three';
import { VRButton } from 'three/addons/webxr/VRButton.js';
import { AnaglyphEffect } from 'three/addons/effects/AnaglyphEffect.js';
import { StereoEffect } from 'three/addons/effects/StereoEffect.js';
import { State, game, resetGame, getLevelConfig, getBossTier, getRandomBossIdForLevel, addScore, registerAccuracyHit, registerAccuracyMiss, damagePlayer, addUpgrade, setMainWeapon, setAltWeapon, getNextUpgradeHand, needsMainWeaponChoice, LEVELS, loadDebugSettings, saveDebugSettings, loadDreamState, saveDreamState, startGameWithSeed, getBiomeForLevel, trackKill, trackShot, trackShotHit, trackCrit, registerResetHook } from './game.js';
import { getRandomUpgrades, getRandomSpecialUpgrades, getUpgradeDef, getWeaponStats, MAIN_WEAPONS, ALT_WEAPONS, getMainWeapon, getAltWeapon } from './weapons.js';
import {
  playShoothSound, playHitSound, playExplosionSound, playDamageSound,
  playFastEnemySpawn, playSwarmEnemySpawn, playBasicEnemySpawn, playTankEnemySpawn,
  playBossSpawn, playBossAlertSound, playMenuClick, playErrorSound, playBuckshotSound,
  playProximityAlert, playSwarmProximityAlert, playUpgradeSound,
  playSlowMoSound, playSlowMoReverseSound, playComboSound,
  startLightningSound, stopLightningSound,
  startLowHealthWarningSound, stopLowHealthWarningSound,
  playMusic, playBossMusic, stopMusic, fadeOutMusic,
  playKillsAlertSound, playTingSound, playSeekerBurstSound, playHealSound,
  playCountdown321,
  // Charge cannon sounds
  startChargeSound, updateChargeSound, stopChargeSound,
  playChargeReadySound, playChargeFireSound,
  // Boss and name entry sounds
  playIncomingBossSound, playNoOneMakesItSound,
  playProjectileWarningSound
} from './audio.js';
import {
  initEnemies, spawnEnemy, updateEnemies, updateExplosions, getEnemyMeshes,
  getEnemyByMesh, clearAllEnemies, getEnemyCount, hitEnemy, destroyEnemy,
  applyEffects, getSpawnPosition, getEnemies, getFastEnemies, getSwarmEnemies,
  getBoss, spawnBoss, hitBoss, updateBoss, clearBoss, getBossMinionMeshes, getBossMinionByMesh, hitBossMinion, updateBossMinions,
  updateBossProjectiles, getBossProjectiles, updateStatusBubbles, setPlayerForward, setBossSpawnForward,
  updateBossDebris, clearBossDebris, spawnBossDebris, setVFXReference, clearBossProjectiles, clearAllElectricArcs,
  releaseBossProjIndex, clearBossMinions,
  clearAllTelegraphs, spawnHealthGainPopup
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
  updateUpgradeCards, getUpgradeCardHit, showGameOver, showVictory, updateEndScreen,
  hideGameOver, triggerHitFlash, updateHitFlash, spawnDamageNumber, spawnCritIndicator, updateDamageNumbers, updateFPS,
  showBossHealthBar, hideBossHealthBar, updateBossHealthBar,
  getTitleButtonHit, showNameEntry, hideNameEntry, getNameEntryHit, updateKeyboardHover, getNameEntryName,
  showScoreboard, hideScoreboard, getScoreboardHit, updateScoreboardScroll,
  showCountrySelect, hideCountrySelect, getCountrySelectHit,
  showDebugJumpScreen, getDebugJumpHit,
  showDebugMenu, hideDebugMenu, getDebugMenuHit, showReadyScreen, hideReadyScreen, updateReadyCountdownText, updateTitleDebugIndicator,
  showPauseMenu, hidePauseMenu, updatePauseMenu, showPauseCountdown, hidePauseCountdown, updatePauseCountdownDisplay, getPauseMenuHit,
  updateHUDHover,
  showKillsRemainingAlert, updateKillsAlert, hideKillsAlert, showBossAlert, hideBossAlert,
  spawnKillChainPopup, triggerHeartHitAnimation, triggerHealthGainAnimation, triggerAccuracyHurt, updateKillChainPopups,
  updateHolographicGlitch, resetHoloGlitch,
  showFloatingMessage, hideFloatingMessage, updateFloatingMessage,
  nameEntryGroup,
  setLastSubmittedTimestamp,
  setLastSubmittedPageIndex,
  setFPSVisible
} from './hud.js';

import {
  initDesktopControls, update as updateDesktopControls, getWeaponState,
  getPosition, getAimRaycaster, getVirtualController,
  isLocked, isEnabled as isDesktopEnabled, setOnPauseCallback, setOnNukeCallback
} from './desktop-controls.js';
import {
  submitScore, fetchTopScores, fetchScoresByCountry, fetchScoresByContinent,
  isNameClean, COUNTRIES, CONTINENTS,
  getStoredCountry, setStoredCountry, getStoredName, setStoredName
} from './scoreboard.js';
import { getThemeForLevel, initAmbientParticles, updateAmbientParticles } from './scenery.js';
import { initDreamWorld, enterDreamWorld, exitDreamWorld, getDreamFogSettings, getDreamSpawnPosition, handleDreamProjectileHit, updateDreamWorld } from './dream-world.js';
import { SpatialHash } from './spatial-hash.js';
import { enableTelemetry, disableTelemetry, isTelemetryEnabled, setTelemetryHistoryMs, recordTelemetrySample, getTelemetrySnapshot } from './telemetry.js';

// Expose game state to window for debugging/testing
window.State = State;
window.game = game;
window.hud = { setFPSVisible };

// Debug flag for projectile firing investigation
window.DEBUG_PROJECTILES = false;

// ============================================================
// CONSTANTS & CONFIGURATION
// Color palette, timing, physics constants
// ============================================================

// ── Constants ──────────────────────────────────────────────
const NEON_PINK = 0xff00ff;
const NEON_CYAN = 0x00aaaa;  // Muted teal (not bright neon cyan)
const DARK_BG = 0x0a0015;
const SUN_CORE = 0xffaa00;
const SUN_GLOW = 0xff6600;
const MTN_DARK = 0x1a0033;
const MTN_WIRE = 0x6600aa;

// VR camera height fix: Shift entire scene down so XR camera at ~0.875m appears 1.6m above floor
const SCENE_Y_OFFSET = -0.725;

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

// ============================================================
// MODULE STATE
// Scene, camera, renderer, controller state, pools, queues
// COUPLING: Many functions reference these globals directly
// ============================================================

// ── Module State ───────────────────────────────────────────
let scene, camera, renderer;
let biomeAmbientLight = null;
let biomeDirectionalLight = null;
let biomePointLight = null;
let currentBiomeLightingConfig = null;
// Camera added directly to scene (no rig - VR hands need direct camera)
// floorHUDDebugMarker removed - was debug white plane
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
const PROJECTILE_POOL_SIZE = 120;

// Stable single-material projectile visuals. Keep the instanced system and simple,
// visible projectile bodies. We can revisit a fancier blaster shader later.
const PROJECTILE_BOLT = {
  opacity: 0.75,
};

function createProjectileMaterial(colorHex) {
  const material = new THREE.MeshBasicMaterial({
    color: colorHex,
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

// PHYSICS DEATH SYSTEM: Voxel pool for death explosions
const voxelPool = [];
const activeVoxels = [];
const VOXEL_POOL_SIZE = 50;
const MAX_ACTIVE_VOXELS = 25;  // Cap for performance (reduced from 200)

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
const CHARGE_SHOT_MIN_FIRE = 0.1;  // minimum charge time to fire (was 0.6)
const CHARGE_SHOT_MIN_DAMAGE = 20;   // minimum damage at no charge
const CHARGE_SHOT_MAX_DAMAGE = 1000; // maximum damage at full charge

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

// Mountain visualizer references (for per-theme color updates)
const mountainLines = [];

// Environment refs for level-based scaling (sun, ominous horizon)
let sunMeshRef = null;
let sunGlowRef = null;
let ominousRef = null;
let gridHelper = null;
let starsRef = null;
let horizonRingRef = null;
let horizonInnerRingRef = null;
let auroraRef = null;
let auroraCanvas = null;
let auroraCtx = null;
let atmosphereRef = null;
let vhsRetroShellRef = null;
let vhsRetroScanlineMatRef = null;
let vhsRetroGlowMatRef = null;
let vhsRetroNoiseMatRef = null;
let vhsRetroScanlineTexRef = null;
let vhsRetroNoiseTexRef = null;
let currentTheme = null;
let biomePropsGroup = null;
let biomePropsBiome = null;
const biomePropFloaters = [];
let biomeSceneGroup = null;
let biomeSceneBiome = null;

// Dream sequence trigger - DISABLED until player can collect upgrades in dreamworld
// The dream sequence code and transition system remain intact, just hidden from players
const DREAM_TRIGGER_ENABLED = false;

let dreamTriggerMesh = null;
let dreamTransition = null;
let dreamFadeOverlay = null;
let dreamReturnPosition = new THREE.Vector3();
let dreamOriginalEnv = null;
let dreamTrail = null;


let environmentFade = 0;
let environmentFadeState = null;
const DEFAULT_LEVEL_SPAWN_FORWARD = new THREE.Vector3(0, 0, -1);
const _levelSpawnForward = new THREE.Vector3(0, 0, -1);
let biomeClearedForBossCinematic = false;
const environmentFadeTargets = [];
let levelFadeReady = false;

// Floor damage flash
let floorMaterial = null;
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

// Pooled UI hover raycasters for controller/desktop hover detection
// Avoids creating new Raycaster/Vector3/Quaternion every frame in menu states
const _uiHoverRaycasters = [new THREE.Raycaster(), new THREE.Raycaster()];
const _uiHoverOrigins = [new THREE.Vector3(), new THREE.Vector3()];
const _uiHoverQuats = [new THREE.Quaternion(), new THREE.Quaternion()];
const _uiHoverDirs = [new THREE.Vector3(), new THREE.Vector3()];

// Dream trigger hit-test temp vectors (avoid per-frame allocations in projectile loop)
const _dreamPrevProjectilePos = new THREE.Vector3();
const _dreamSegment = new THREE.Vector3();
const _dreamToCenter = new THREE.Vector3();
const _dreamClosestPoint = new THREE.Vector3();
const _vhsPlayerPos = new THREE.Vector3();
const _debugShellColor = new THREE.Color();
const _debugShellGlowColor = new THREE.Color(0xff8ac1);
const _debugShellWhite = new THREE.Color(0xffffff);
const _debugShellHSL = { h: 0, s: 0, l: 0 };

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

// Accuracy bonus shot tracking
let accuracyShotId = 0;
const accuracyShots = new Map();

function startAccuracyShot(pelletCount, hand) {
  const shotId = ++accuracyShotId;
  accuracyShots.set(shotId, { remaining: pelletCount, hit: false, hand });
  trackShot(hand);
  return shotId;
}

// Track previous accuracy multiplier for popup triggers
let prevAccuracyMultiplier = 1;

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
    console.log(`[accuracy] ${newThreshold}x accuracy bonus!`);
  }

  prevAccuracyMultiplier = newMultiplier;
}

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

// ============================================================
// BOOTSTRAP & INITIALISATION
// Entry point: init() called at module load
// Dependencies: All module state must be declared above
// ============================================================

// ── Bootstrap ──────────────────────────────────────────────

// Visual tuning defaults for debug sliders in index.html.
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

// References that let debug visual tuning affect synthwave valley elements.
const synthVisualRefs = {
  terrainUniforms: null,
  sunOuterGlowMat: null,
  sunGlowMat: null,
  sunCoreMat: null,
};

// Player projectile materials that should respond to visual tuning sliders.
const playerProjectileMaterials = new Set();

// Desktop-only post-style helpers. XR continues to use renderer.render(scene, camera).
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
    directional: { color: 0xaaccff, intensity: 0.6, position: [-40, 60, -30] },
    point: { color: 0xddddff, intensity: 1.2, distance: 18 },
  },
  alien_planet: {
    ambient: { color: 0x0a1a0a, intensity: 0.1 },
    directional: { color: 0x44ffaa, intensity: 0.5, position: [-30, 50, 40] },
    point: { color: 0x88ff88, intensity: 1.0, distance: 16 },
  },
  hellscape_lava: {
    ambient: { color: 0x1a0505, intensity: 0.08 },
    directional: { color: 0xff2222, intensity: 0.7, position: [20, 40, -50] },
    point: { color: 0xff4444, intensity: 1.3, distance: 15 },
  },
  default: {
    ambient: { color: 0x110022, intensity: 0.15 },
    directional: { color: 0xff8844, intensity: 0.6, position: [50, 80, 30] },
    point: { color: 0xffeedd, intensity: 1.0, distance: 18 },
  },
};

const AVAILABLE_BIOMES = Object.keys(BIOME_LIGHTING).filter((key) => key !== 'default');

function applyBiomeLighting(biome) {
  if (!biomeAmbientLight || !biomeDirectionalLight || !biomePointLight) {
    console.warn('[lighting] Lights not initialized yet');
    return;
  }
  const config = BIOME_LIGHTING[biome] || BIOME_LIGHTING.default;
  currentBiomeLightingConfig = config;
  biomeAmbientLight.color.setHex(config.ambient.color);
  biomeAmbientLight.intensity = config.ambient.intensity;
  biomeDirectionalLight.color.setHex(config.directional.color);
  biomeDirectionalLight.intensity = config.directional.intensity;
  biomeDirectionalLight.position.set(config.directional.position[0], config.directional.position[1], config.directional.position[2]);
  biomePointLight.color.setHex(config.point.color);
  biomePointLight.intensity = config.point.intensity;
  biomePointLight.distance = config.point.distance;
  console.log('[lighting] Applied lighting for biome:', biome);
}

// ── Progression automation helpers (test hooks) ─────────────────────────
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

function init() {
  console.log('[SPACEOMICIDE] Initialising...');

  // Load debug settings from localStorage
  loadDebugSettings();
  loadDreamState();

  // Sync desktop position panel with game state (may differ from HTML checkbox default)
  if (typeof window !== 'undefined') {
    window.debugPositionPanel = game.debugShowPosition;
  }

  // Scene — use black background for Adreno GPU "Fast clear" optimization on Quest
  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x000000);
  // Camera - added directly to scene for proper VR hand positioning
  camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.1, 5000);
  camera.rotation.set(0, 0, 0);
  scene.add(camera);

  // Camera position is controlled by WebXR in VR mode, desktop mode sets it elsewhere

  // Renderer — optimized for Quest performance
  renderer = new THREE.WebGLRenderer({
    antialias: !navigator.webdriver,  // Disable AA in headless/Puppeteer
    alpha: true,
    powerPreference: 'high-performance'
  });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));  // Cap at 1.5 — DPR 2 quadruples pixel count
  renderer.xr.enabled = true;
  // Fix 1.8: Disable shadows by default (catastrophic perf in SwiftShader/headless)
  // Only enable for real devices (not webdriver) with high quality tier
  const enableShadows = !navigator.webdriver && (window.devicePixelRatio >= 2 || window.matchMedia?.('(min-width: 1200px)')?.matches);
  renderer.shadowMap.enabled = enableShadows;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  // No tone mapping — we use MeshBasicMaterial so ACES adds shader cost with no benefit
  renderer.toneMapping = THREE.NoToneMapping;
  document.body.appendChild(renderer.domElement);

  // ── Biome Lighting System Init ───────────────────────────────────
  biomeAmbientLight = new THREE.AmbientLight(0x110022, 0.15);
  scene.add(biomeAmbientLight);

  biomeDirectionalLight = new THREE.DirectionalLight(0xff8844, 0.8);
  biomeDirectionalLight.position.set(50, 100, 50);
  biomeDirectionalLight.castShadow = true;
  biomeDirectionalLight.shadow.mapSize.set(256, 256);
  biomeDirectionalLight.shadow.bias = -0.01;
  biomeDirectionalLight.shadow.normalBias = 0;
  biomeDirectionalLight.shadow.camera.near = 10;
  biomeDirectionalLight.shadow.camera.far = 200;
  biomeDirectionalLight.shadow.camera.left = -50;
  biomeDirectionalLight.shadow.camera.right = 50;
  biomeDirectionalLight.shadow.camera.top = 50;
  biomeDirectionalLight.shadow.camera.bottom = -50;
  scene.add(biomeDirectionalLight);

  biomePointLight = new THREE.PointLight(0xffeedd, 1.5, 20, 2);
  biomePointLight.position.set(0, 2, 0);
  biomePointLight.castShadow = false;
  scene.add(biomePointLight);
  console.log('[lighting] Biome lights initialized');

  // VR Button - disable foveated rendering to remove visible quality boxes
  const vrButton = VRButton.createButton(renderer, {
    optionalFeatures: ['local-floor', 'bounded-floor'],
  });
  document.body.appendChild(vrButton);

  // Fix 1.3: Cache scanlines element once at init (not per-frame query)
  _cachedScanlinesEl = document.getElementById('scanlines');

  // Disable foveated rendering (removes visible quality boxes in Quest VR)
  renderer.xr.addEventListener('sessionstart', () => {
    console.log('[vr] Session started - disabling foveation');
    renderer.xr.setFoveation(0);
    // Camera is added directly to scene - VR hands work correctly now
  });

  // No camera rig reset needed - camera is direct child of scene
  renderer.xr.addEventListener('sessionend', () => {
    console.log('[vr] Session ended');
  });

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
    camera,
    game,
    State,
    spawnBossDebris,
    spawnExplosionVisual,
    hideBossHealthBar,
    clearBoss,
    clearAllTelegraphs,
    playExplosionSound,
    stopMusic,
    completeLevel,
    endGame,
    applyEnvironmentFade,
    resetAllSlowMoState,
    hideKillsAlert,
    unloadBiomeForBossCinematic: purgeBiomeForBossCinematic,
  });

  // Init subsystems
  initEnemies(scene);
  initHUD(camera, scene);
  initBossDeathOverlays();

  // Nuke flash overlay (white screen flash on nuke activation)
  const nukeFlashGeo = new THREE.PlaneGeometry(10, 10);
  const nukeFlashMat = new THREE.MeshBasicMaterial({
    color: 0xffffff,
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
  initVoxelPool();
  
  // Set voxel explosion reference for enemies.js (same module instance as import)
  setVFXReference(spawnVoxelExplosion);
  console.log('[physics-death] Voxel explosion reference set');

  // Set up stasis field reference for shared access
  setActiveStasisFields(activeStasisFields);

  // Desktop controls for non-VR playtesting
  initDesktopControls(scene, camera, renderer);

  // Set up pause callback for ESC key
  setOnPauseCallback(togglePause);
  setOnNukeCallback(activateNuke);

  // Test helpers for automation
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

  // ── Frame profiler API (debug/test only) ──
  // Enable:  window.__perf.startProfileBuckets()
  // Read:    window.__perf._profileBuckets
  // Reset:   window.__perf.startProfileBuckets()  (call again)
  // Report:  window.__perf.dumpProfileBuckets()
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

  // Test hook: deterministic single-shot at a chosen enemy for headless runs.
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

function resizeDesktopStereoEffects() {
  if (desktopEffectRefs.anaglyph) {
    desktopEffectRefs.anaglyph.setSize(window.innerWidth, window.innerHeight);
  }
  if (desktopEffectRefs.stereo) {
    desktopEffectRefs.stereo.setSize(window.innerWidth, window.innerHeight);
  }
}

function clampDebugValue(value, min, max, fallback) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}

function getVisualTuning() {
  if (typeof window === 'undefined') {
    return { ...VISUAL_TUNING_DEFAULTS };
  }

  return {
    glowStrength: clampDebugValue(window.debugGlowStrength, 0, 2, VISUAL_TUNING_DEFAULTS.glowStrength),
    smokeStrength: clampDebugValue(window.debugSmokeStrength, 0, 2, VISUAL_TUNING_DEFAULTS.smokeStrength),
    fogIntensity: clampDebugValue(window.debugFogIntensity, 0, 1, VISUAL_TUNING_DEFAULTS.fogIntensity),
    shellStrength: clampDebugValue(window.debugShellStrength, 0, 2, VISUAL_TUNING_DEFAULTS.shellStrength),
    shellSaturation: clampDebugValue(window.debugShellSaturation, 0, 2, VISUAL_TUNING_DEFAULTS.shellSaturation),
    shellScanlineSpeed: clampDebugValue(window.debugShellScanlineSpeed, 0, 3, VISUAL_TUNING_DEFAULTS.shellScanlineSpeed),
    shellNoiseAmount: clampDebugValue(window.debugShellNoiseAmount, 0, 2, VISUAL_TUNING_DEFAULTS.shellNoiseAmount),
    renderMode: typeof window.debugRenderMode === 'string' ? window.debugRenderMode : VISUAL_TUNING_DEFAULTS.renderMode,
    stereoEyeSeparation: clampDebugValue(window.debugStereoEyeSeparation, 0.01, 0.2, VISUAL_TUNING_DEFAULTS.stereoEyeSeparation),
    shellTint: typeof window.debugShellTint === 'string' ? window.debugShellTint : VISUAL_TUNING_DEFAULTS.shellTint,
  };
}

function getDebugShellColor(tuning) {
  _debugShellColor.set(tuning.shellTint);
  _debugShellColor.getHSL(_debugShellHSL);
  _debugShellColor.setHSL(
    _debugShellHSL.h,
    Math.min(1, _debugShellHSL.s * tuning.shellSaturation),
    _debugShellHSL.l
  );
  return _debugShellColor;
}

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

  // VR-safe shell tuning. This is the supported XR path for debug effects.
  const shellColor = getDebugShellColor(tuning);
  if (vhsRetroScanlineMatRef) {
    vhsRetroScanlineMatRef.color.copy(shellColor).multiplyScalar(0.95 + tuning.glowStrength * 0.25);
  }
  if (vhsRetroGlowMatRef) {
    vhsRetroGlowMatRef.color.copy(shellColor).lerp(_debugShellGlowColor, 0.35);
  }
  if (vhsRetroNoiseMatRef) {
    vhsRetroNoiseMatRef.color.copy(shellColor).lerp(_debugShellWhite, 0.4);
  }
}

function getDesktopRenderMode(tuning) {
  if (renderer?.xr?.isPresenting) return 'normal';
  if (tuning.renderMode === 'anaglyph' || tuning.renderMode === 'stereo') {
    return tuning.renderMode;
  }
  return 'normal';
}

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
    if (mesh.parent) mesh.parent.remove(mesh);
    disposeObject3D(mesh);
    console.log(`[biome] Removed stale ShapeGeometry legacy mountain at world origin (${idx + 1}/${staleMeshes.length})`);
  });
}

function sanitizeBiomeMeshName(name) {
  return String(name || '')
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

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
// Sun, aurora, mountains, stars, horizon, VHS retro shell
// COUPLING: Updates scene directly, registers fade materials
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
  gridHelper.matrixAutoUpdate = false;

  const floorGeo = new THREE.PlaneGeometry(200, 200);
  const floorMat = new THREE.MeshBasicMaterial({
    color: floorBaseColor,
    depthWrite: false,  // Prevent depth buffer conflicts with grid and biome terrains
    polygonOffset: true,  // Prevent z-fighting with GridHelper at y=0
    polygonOffsetFactor: 1.0,
    polygonOffsetUnits: 4.0,
  });
  floorMaterial = floorMat;  // Store reference for damage flash
  floorMaterial.userData.floorHeight = -0.01;
  registerFadeMaterial(floorMaterial);
  const floor = new THREE.Mesh(floorGeo, floorMat);
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = -0.01 + SCENE_Y_OFFSET;
  floor.frustumCulled = false;
  floor.renderOrder = -1;  // Render before other transparent objects
  // Ensure floor is always visible by setting a large bounding sphere
  floor.geometry.computeBoundingSphere();
  floor.geometry.boundingSphere.radius = 150;
  floor.geometry.boundingSphere.center.set(0, 0, 0);
  scene.add(floor);
  floor.matrixAutoUpdate = false;

  // Horizon glow ring — a cylinder ring at the grid edge, visible from inside
  // Provides the illusion of a glowing horizon all around the player
  const horizonRadius = 60;  // At grid edge
  const horizonHeight = 3;
  const horizonSegments = 48;

  // Create gradient texture for horizon glow (bright at bottom, fading up)
  // EXACT synthwave colors: Horizon #FE9053 (orange) → Pink #E00186 → Purple #2C0051
  const horizonCanvas = document.createElement('canvas');
  horizonCanvas.width = 4;
  horizonCanvas.height = 64;
  const horizonCtx = horizonCanvas.getContext('2d');
  const horizonGrad = horizonCtx.createLinearGradient(0, 64, 0, 0);
  horizonGrad.addColorStop(0, '#FE9053');   // EXACT: Horizon orange at base
  horizonGrad.addColorStop(0.4, '#E00186'); // EXACT: Mountain tips pink
  horizonGrad.addColorStop(1.0, '#1A004A'); // EXACT: Dark purple at top
  horizonCtx.fillStyle = horizonGrad;
  horizonCtx.fillRect(0, 0, 4, 64);

  // const horizonTexture = new THREE.CanvasTexture(horizonCanvas);
  // const horizonGeo = new THREE.CylinderGeometry(horizonRadius, horizonRadius, horizonHeight, horizonSegments, 1, true);
  // const horizonMat = new THREE.MeshBasicMaterial({
  //   map: horizonTexture,
  //   transparent: true,
  //   side: THREE.BackSide,
  //   depthWrite: false,
  //   blending: THREE.AdditiveBlending,
  // });
  // horizonRingRef = new THREE.Mesh(horizonGeo, horizonMat);
  // horizonRingRef.name = 'horizonRingRef';  // Debug panel name
  // horizonRingRef.position.set(0, horizonHeight / 2 - 0.5, 0);
  // horizonRingRef.renderOrder = -2;
  // scene.add(horizonRingRef);
  // registerFadeMaterial(horizonRingRef.material);

  // Second brighter, shorter glow layer for intensity at ground level
  // REMOVED: Was causing conflicts with synthwave scene
  // const horizonInnerGeo = new THREE.CylinderGeometry(horizonRadius - 0.5, horizonRadius - 0.5, 1.5, horizonSegments, 1, true);
  // const horizonInnerMat = new THREE.MeshBasicMaterial({
  //   color: 0xFE9053,  // EXACT: Horizon orange
  //   transparent: true,
  //   opacity: 0.5,
  //   side: THREE.BackSide,
  //   depthWrite: false,
  //   blending: THREE.AdditiveBlending,
  // });
  // horizonInnerRingRef = new THREE.Mesh(horizonInnerGeo, horizonInnerMat);
  // horizonInnerRingRef.name = 'horizonInnerRingRef';  // Debug panel name
  // horizonInnerRingRef.position.set(0, 0.25, 0);
  // horizonInnerRingRef.renderOrder = -2;
  // scene.add(horizonInnerRingRef);
  // registerFadeMaterial(horizonInnerRingRef.material);

  createSun();
  // createVHSRetroShell();  // REMOVED: Debug sphere for visual effects testing
  // Removed legacy flat ShapeGeometry mountain layers. They were stale overlays
  // that conflicted with the biome-specific terrain scenes.
  createStars();
  initAmbientParticles(scene);
  createDreamTrigger();

  // NOTE: Lights removed — all materials are MeshBasicMaterial (unlit)
  // so lights have zero visual effect but cost GPU overhead.
  // If PBR materials are added later, re-add lights here.
}

function registerFadeMaterial(material) {
  if (!material) return;
  // Prevent unbounded growth across level rebuilds.
  if (environmentFadeTargets.includes(material)) return;
  const baseOpacity = material.opacity !== undefined ? material.opacity : 1;
  material.transparent = true;
  material.__fadeBase = baseOpacity;
  environmentFadeTargets.push(material);
}

function unregisterFadeMaterial(material) {
  if (!material) return;
  const idx = environmentFadeTargets.indexOf(material);
  if (idx !== -1) environmentFadeTargets.splice(idx, 1);
}

function unregisterFadeMaterialsForObject(obj) {
  if (!obj || typeof obj.traverse !== 'function') return;
  obj.traverse((child) => {
    if (!child.material) return;
    if (Array.isArray(child.material)) child.material.forEach(unregisterFadeMaterial);
    else unregisterFadeMaterial(child.material);
  });
}

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

function setMaterialEmissiveSafe(material, color, intensity = 1) {
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

// ── Biome Props ───────────────────────────────────────────
function clearBiomeProps() {
  if (!biomePropsGroup) return;
  scene.remove(biomePropsGroup);

  // Prevent stale materials from keeping the old biome scene alive.
  unregisterFadeMaterialsForObject(biomePropsGroup);

  biomePropsGroup.traverse((child) => {
    if (child.geometry) child.geometry.dispose();
    if (child.material) disposeMaterialDeep(child.material);
  });
  biomePropsGroup = null;
  biomePropsBiome = null;
  biomePropFloaters.length = 0;
}

function clearBiomeScene() {
  if (!biomeSceneGroup) return;
  scene.remove(biomeSceneGroup);

  // Prevent stale materials from keeping the old biome scene alive.
  unregisterFadeMaterialsForObject(biomeSceneGroup);

  biomeSceneGroup.traverse((child) => {
    if (child.geometry) child.geometry.dispose();
    if (child.material) disposeMaterialDeep(child.material);
  });
  biomeSceneGroup = null;
  biomeSceneBiome = null;
  biomeTerrainMaterials = [];  // Clear terrain flash references

  synthVisualRefs.terrainUniforms = null;
  synthVisualRefs.sunOuterGlowMat = null;
  synthVisualRefs.sunGlowMat = null;
  synthVisualRefs.sunCoreMat = null;
}

function purgeBiomeForBossCinematic() {
  if (biomeClearedForBossCinematic) return;
  biomeClearedForBossCinematic = true;

  // Drop the current biome geometry while the screen is black so upgrades
  // appear on a clean slate before the next biome loads.
  clearBiomeScene();
  clearBiomeProps();

  if (gridHelper) gridHelper.visible = false;
  if (horizonRingRef) horizonRingRef.visible = false;
  if (horizonInnerRingRef) horizonInnerRingRef.visible = false;
  if (sunMeshRef) sunMeshRef.visible = false;
  if (sunGlowRef) sunGlowRef.visible = false;
  if (starsRef) starsRef.visible = false;
  if (atmosphereRef) atmosphereRef.visible = false;
  if (auroraRef) auroraRef.visible = false;
  if (vhsRetroShellRef) vhsRetroShellRef.visible = false;
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

function disposeObject3D(obj) {
  if (!obj) return;
  // Guard: only traverse if obj is a THREE.Object3D (proxy objects from InstancedMesh pools don't have .traverse)
  if (typeof obj.traverse !== 'function') return;

  unregisterFadeMaterialsForObject(obj);

  obj.traverse((child) => {
    if (child.geometry) child.geometry.dispose();
    if (child.material) disposeMaterialDeep(child.material);
  });
}

function updateBiomeProps(now, dt) {
  if (!biomePropsGroup && !biomeSceneGroup) return;
  if (biomePropsGroup && biomePropsGroup.userData && typeof biomePropsGroup.userData.update === 'function') {
    biomePropsGroup.userData.update(now, dt);
  }
  if (biomeSceneGroup && biomeSceneGroup.userData && typeof biomeSceneGroup.userData.update === 'function') {
    biomeSceneGroup.userData.update(now, dt);
  }
  if (starsRef && starsRef.userData && typeof starsRef.userData.update === 'function') {
    starsRef.userData.update(now, dt);
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
        pillar.name = `pillar_${i}_${side > 0 ? 'right' : 'left'}`;
        pillar.scale.set(1, height, 1);
        pillar.position.set(side * xOffset, height * 0.5 + SCENE_Y_OFFSET, z);
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
      arch.name = `arch_${i}`;
      arch.userData.sceneryName = 'arch';
      arch.scale.set(radius, radius, radius);
      arch.position.set(0, y + SCENE_Y_OFFSET, z);
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
      left.name = `rect_arch_${i}_left`;
      right.name = `rect_arch_${i}_right`;
      top.name = `rect_arch_${i}_top`;
      left.position.set(-width * 0.5, y + height * 0.5 + SCENE_Y_OFFSET, z);
      right.position.set(width * 0.5, y + height * 0.5 + SCENE_Y_OFFSET, z);
      top.position.set(0, y + height + thickness * 0.5 + SCENE_Y_OFFSET, z);
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
      platform.name = `platform_${platformType}_${i}`;
      platform.scale.set(size, 1, size);
      platform.position.set(x, y + SCENE_Y_OFFSET, z);
      platform.rotation.y = Math.random() * Math.PI * 2;
      biomePropsGroup.add(platform);
      addFloatingPlatform(platform, y + SCENE_Y_OFFSET, 0.35 + Math.random() * 0.25, 0.001 + Math.random() * 0.0015, 0.15 + Math.random() * 0.25);
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
    scene.background.copy(bg);
  }

  environmentFadeTargets.forEach((material) => {
    const base = material.__fadeBase ?? 1;
    material.opacity = base * (1 - environmentFade);
  });
}

function updateSunTexture(colors) {
  if (!sunMeshRef || !sunMeshRef.material || !sunMeshRef.material.map) return;
  if (!colors || colors.length < 2) return; // Need at least 2 colors for gradient

  const canvas = sunMeshRef.material.map.image;
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, 512, 512);

  const grad = ctx.createLinearGradient(256, 30, 256, 482);
  colors.forEach((c, i) => {
    const stop = i / (colors.length - 1);
    if (isFinite(stop)) grad.addColorStop(stop, c);
  });

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
  const biome = getBiomeForLevel(level);
  console.log('[debug] applyThemeForLevel: level=', level, 'biome=', biome, 'theme=', theme?.name);
  if (!theme || !scene) return;

  currentTheme = theme;

  const hideBaseEnv = !!theme.hideBaseEnv;
  if (gridHelper) gridHelper.visible = !hideBaseEnv;
  if (horizonRingRef) horizonRingRef.visible = !hideBaseEnv;
  if (horizonInnerRingRef) horizonInnerRingRef.visible = !hideBaseEnv;
  if (sunMeshRef) sunMeshRef.visible = !hideBaseEnv;
  if (atmosphereRef) atmosphereRef.visible = !hideBaseEnv;
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
    if (layer.fillMesh) {
      layer.fillMesh.visible = !hideBaseEnv;
    }
    if (layer.fillMesh && layer.fillMesh.material) {
      layer.fillMesh.material.color.setHex(theme.mountainFill);
      layer.fillMesh.material.__fadeBase = 1;
      layer.fillMesh.scale.set(1, mountainScale, 1);
    }
    if (layer.line) {
      layer.line.visible = !hideBaseEnv;
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
    // Keep the reduced bloom level after theme refreshes instead of snapping back brighter.
    sunGlowRef.material.opacity = 0.24;
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
    if (starsRef.material.color) {
      starsRef.material.color.setHex(theme.starColor);
    } else if (starsRef.material.uniforms && starsRef.material.uniforms.uColor) {
      starsRef.material.uniforms.uColor.value.setHex(theme.starColor);
    }
    const starSize = theme.starSize !== undefined ? theme.starSize : 0.5;
    starsRef.material.size = starSize;
  }

  if (theme.starCount || theme.starHeight || theme.starSpread) {
    rebuildStars(theme);
  }

  rebuildBiomeScene(getBiomeForLevel(level), theme);
  applyBiomeLighting(getBiomeForLevel(level));
  
  // Always update aurora colors for the current theme (not just customScene biomes)
  updateAuroraColors(theme);
  
  // Make aurora visible for night/dark themes
  if (auroraRef) {
    const isDarkTheme = theme.hideBaseEnv || theme.skyColor === 0x000000 || 
                        (theme.skyColor & 0xFFFFFF) < 0x222222;
    auroraRef.visible = isDarkTheme || (theme.aurora !== undefined);
  }

  applyEnvironmentFade(environmentFade);
}

function hideBaseEnvironment() {
  if (!dreamOriginalEnv) return;
  if (gridHelper) gridHelper.visible = false;
  if (horizonRingRef) horizonRingRef.visible = false;
  if (horizonInnerRingRef) horizonInnerRingRef.visible = false;
  if (sunMeshRef) sunMeshRef.visible = false;
  if (sunGlowRef) sunGlowRef.visible = false;
  if (starsRef) starsRef.visible = false;
  if (auroraRef) auroraRef.visible = false;
  if (vhsRetroShellRef) vhsRetroShellRef.visible = false;
  if (floorMaterial) floorMaterial.opacity = 0;
  if (biomePropsGroup) biomePropsGroup.visible = false;
  if (biomeSceneGroup) biomeSceneGroup.visible = false;
}

function restoreBaseEnvironment() {
  if (!dreamOriginalEnv) return;
  if (gridHelper) gridHelper.visible = dreamOriginalEnv.gridVisible;
  if (horizonRingRef) horizonRingRef.visible = dreamOriginalEnv.horizonVisible;
  if (horizonInnerRingRef) horizonInnerRingRef.visible = dreamOriginalEnv.horizonInnerVisible;
  if (sunMeshRef) sunMeshRef.visible = dreamOriginalEnv.sunVisible;
  if (sunGlowRef) sunGlowRef.visible = dreamOriginalEnv.sunGlowVisible;
  if (starsRef) starsRef.visible = dreamOriginalEnv.starsVisible;
  if (auroraRef) auroraRef.visible = dreamOriginalEnv.auroraVisible;
  if (vhsRetroShellRef) vhsRetroShellRef.visible = dreamOriginalEnv.vhsRetroVisible !== false;
  if (floorMaterial && typeof dreamOriginalEnv.floorOpacity === 'number') {
    floorMaterial.opacity = dreamOriginalEnv.floorOpacity;
  }
  if (biomePropsGroup) biomePropsGroup.visible = dreamOriginalEnv.biomePropsVisible;
  if (biomeSceneGroup) biomeSceneGroup.visible = dreamOriginalEnv.biomeSceneVisible;
}

function enterDreamWorldScene() {
  if (game.inDreamWorld) return;
  game.inDreamWorld = true;
  dreamOriginalEnv = {
    background: scene.background ? scene.background.clone() : new THREE.Color(0x000000),
    gridVisible: gridHelper ? gridHelper.visible : true,
    horizonVisible: horizonRingRef ? horizonRingRef.visible : true,
    horizonInnerVisible: horizonInnerRingRef ? horizonInnerRingRef.visible : true,
    sunVisible: sunMeshRef ? sunMeshRef.visible : true,
    sunGlowVisible: sunGlowRef ? sunGlowRef.visible : true,
    starsVisible: starsRef ? starsRef.visible : true,
    auroraVisible: auroraRef ? auroraRef.visible : false,
    vhsRetroVisible: vhsRetroShellRef ? vhsRetroShellRef.visible : true,
    floorOpacity: floorMaterial ? floorMaterial.opacity : 1,
    biomePropsVisible: biomePropsGroup ? biomePropsGroup.visible : true,
    biomeSceneVisible: biomeSceneGroup ? biomeSceneGroup.visible : true,
  };

  clearAllEnemies();
  clearBoss();
  clearBossDebris();
  clearBossProjectiles();
  clearAllTelegraphs();
  clearAllProjectiles();
  clearAllAltWeaponEffects();

  initDreamWorld(scene);
  enterDreamWorld();

  if (scene.background) scene.background.setHex(0x120018);
  hideBaseEnvironment();

  // Only modify camera position in desktop mode (in VR, WebXR controls camera)
  if (!renderer.xr.isPresenting) {
    camera.position.copy(getDreamSpawnPosition());
  }
  refreshDreamTriggerVisibility();
}

function exitDreamWorldScene() {
  if (!game.inDreamWorld) return;
  game.inDreamWorld = false;
  exitDreamWorld();

  if (dreamOriginalEnv) {
    if (scene.background) scene.background.copy(dreamOriginalEnv.background);
  }
  restoreBaseEnvironment();
  // Only modify camera position in desktop mode (in VR, WebXR controls camera)
  if (!renderer.xr.isPresenting) {
    camera.position.copy(dreamReturnPosition);
  }
  refreshDreamTriggerVisibility();
}

function startDreamFragmentTrail() {
  if (!camera) return;
  if (dreamTrail && dreamTrail.group) {
    camera.remove(dreamTrail.group);
  }

  const count = 40;
  const positions = new Float32Array(count * 3);
  const offsets = [];
  for (let i = 0; i < count; i++) {
    const angle = Math.random() * Math.PI * 2;
    const radius = 0.1 + Math.random() * 0.2;
    const height = (Math.random() - 0.5) * 0.3;
    offsets.push({ angle, radius, height, speed: 0.6 + Math.random() * 0.6 });
    positions[i * 3] = Math.cos(angle) * radius;
    positions[i * 3 + 1] = height;
    positions[i * 3 + 2] = Math.sin(angle) * radius - 0.6;
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  const mat = new THREE.PointsMaterial({
    color: 0xaa88ff,
    size: 0.08,
    transparent: true,
    opacity: 0.75,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  const points = new THREE.Points(geo, mat);
  const group = new THREE.Group();
  group.add(points);
  group.position.set(0, 0.05, 0);
  camera.add(group);

  dreamTrail = {
    group,
    points,
    geo,
    offsets,
    startedAt: performance.now(),
    expiresAt: performance.now() + 30000,
  };
}

function startEnvironmentFade(direction, duration, onComplete) {
  environmentFadeState = {
    direction,
    duration,
    timer: duration,
    onComplete,
  };
}

function createDreamTrigger() {
  if (!scene || dreamTriggerMesh) return;

  const triggerGroup = new THREE.Group();
  triggerGroup.name = 'dream-secret-trigger';

  const core = new THREE.Mesh(
    new THREE.IcosahedronGeometry(0.35, 1),
    new THREE.MeshBasicMaterial({ color: 0xaa66ff, transparent: true, opacity: 0.9, depthWrite: false })
  );
  core.name = 'dream-trigger-core';
  triggerGroup.add(core);

  const glow = new THREE.Mesh(
    new THREE.SphereGeometry(0.7, 12, 12),
    new THREE.MeshBasicMaterial({
      color: 0xcc88ff,
      transparent: true,
      opacity: 0.3,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.DoubleSide,
    })
  );
  glow.name = 'dream-trigger-glow';
  triggerGroup.add(glow);

  triggerGroup.userData = {
    radius: 0.85,
    pulseBaseScale: 1,
    glow,
    core,
    placedForRun: false,
  };

  scene.add(triggerGroup);
  dreamTriggerMesh = triggerGroup;
  placeDreamTriggerBehindPlayer(true);
  refreshDreamTriggerVisibility();
}

function placeDreamTriggerBehindPlayer(force = false) {
  if (!dreamTriggerMesh || !camera) return;
  if (dreamTriggerMesh.userData.placedForRun && !force) return;

  const playerPos = getAdjustedCameraPosition();
  const facing = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion);
  facing.y = 0;
  if (facing.lengthSq() < 0.0001) facing.set(0, 0, -1);
  facing.normalize();

  const behind = facing.clone().multiplyScalar(-8.0);
  dreamTriggerMesh.position.set(
    playerPos.x + behind.x,
    Math.max(1.2, playerPos.y - 0.05),
    playerPos.z + behind.z,
  );
  dreamTriggerMesh.lookAt(playerPos.x, dreamTriggerMesh.position.y, playerPos.z);
  dreamTriggerMesh.userData.placedForRun = true;
}

function refreshDreamTriggerVisibility() {
  if (!dreamTriggerMesh) return;
  // Dream trigger disabled until player can collect upgrades in dreamworld
  dreamTriggerMesh.visible = DREAM_TRIGGER_ENABLED && !game.inDreamWorld && !game.dreamCompleted;
}

function didProjectileHitDreamTrigger(previousPos, currentPos) {
  if (!dreamTriggerMesh?.visible) return false;

  const radius = dreamTriggerMesh.userData?.radius || 0.85;
  const radiusSq = radius * radius;
  const center = dreamTriggerMesh.position;

  // Segment-vs-sphere test so fast projectiles cannot tunnel through the trigger.
  _dreamSegment.subVectors(currentPos, previousPos);
  const segmentLenSq = _dreamSegment.lengthSq();

  if (segmentLenSq < 1e-6) {
    return previousPos.distanceToSquared(center) <= radiusSq;
  }

  _dreamToCenter.subVectors(center, previousPos);
  const t = THREE.MathUtils.clamp(_dreamToCenter.dot(_dreamSegment) / segmentLenSq, 0, 1);
  _dreamClosestPoint.copy(previousPos).addScaledVector(_dreamSegment, t);
  return _dreamClosestPoint.distanceToSquared(center) <= radiusSq;
}

function triggerDreamWorldFromSecret() {
  if (game.inDreamWorld || dreamTransition) return;

  dreamTransition = { state: 'entering' };
  dreamReturnPosition.copy(getAdjustedCameraPosition());

  // Fade through black so the secret transfer feels intentional in VR.
  startEnvironmentFade('out', 0.45, () => {
    enterDreamWorldScene();
    refreshDreamTriggerVisibility();
    startEnvironmentFade('in', 0.45, () => {
      dreamTransition = null;
    });
  });
}

function completeDreamWorldRun() {
  if (!game.dreamCompleted) {
    game.dreamCompleted = true;
    addUpgrade('dream_fragment', 'left');
    addUpgrade('dream_fragment', 'right');
    saveDreamState();
    showFloatingMessage('DREAM FRAGMENT ACQUIRED', { color: '#cc88ff', duration: 3000 });
  }

  exitDreamWorldScene();
  refreshDreamTriggerVisibility();
}

function updateDreamTriggerVisual(now) {
  if (!dreamTriggerMesh?.visible) return;

  const pulse = 1 + Math.sin(now * 0.0022) * 0.08;
  dreamTriggerMesh.scale.setScalar(pulse);

  const glow = dreamTriggerMesh.userData?.glow;
  if (glow?.material) {
    glow.material.opacity = 0.22 + (Math.sin(now * 0.0031) * 0.08 + 0.08);
  }
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

  // FIXED: Use radial gradient for bright center to dimmer edges (like reference image)
  // Combined with vertical gradient for top-to-bottom color variation
  const sunGrad = ctx.createRadialGradient(256, 256, 0, 256, 256, 248);
  sunGrad.addColorStop(0, '#ffffff');    // Bright white center
  sunGrad.addColorStop(0.2, '#ffff99');  // Bright yellow
  sunGrad.addColorStop(0.4, '#ffcc66');  // Orange-yellow
  sunGrad.addColorStop(0.6, '#ff9933');  // Orange
  sunGrad.addColorStop(0.8, '#ff6600');  // Red-orange
  sunGrad.addColorStop(1.0, '#ff4400');  // Red at edges

  ctx.beginPath();
  ctx.arc(256, 256, 248, 0, Math.PI * 2);
  ctx.fillStyle = sunGrad;
  ctx.fill();

  // Outer glow baked into texture for visibility
  ctx.shadowColor = '#ffaa00';  // Orange glow
  ctx.shadowBlur = 40;          // Large glow radius
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
  sunMesh.position.set(0, 12 + SCENE_Y_OFFSET, -89);
  sunMesh.renderOrder = -10;
  scene.add(sunMesh);
  sunMeshRef = sunMesh;
  registerFadeMaterial(sunMeshRef.material);

  // Outer glow behind sun (additive for bloom effect)
  const glowMat = new THREE.MeshBasicMaterial({
    color: 0xffaa00,        // Orange glow (matching sun gradient)
    side: THREE.DoubleSide,
    transparent: true,
    // Tone down the legacy synth halo so it does not wash out the rest of the skyline.
    opacity: 0.24,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  const glow = new THREE.Mesh(new THREE.CircleGeometry(35, 32), glowMat);
  glow.position.set(0, 12 + SCENE_Y_OFFSET, -89.5);
  glow.renderOrder = -11;
  scene.add(glow);
  sunGlowRef = glow;
  registerFadeMaterial(sunGlowRef.material);

  createOminousHorizon();
  // createAurora(); // REMOVED: auroraRef cylinder deleted, using atmosphereRef only
  // Atmosphere: vertical gradient cylinder around player
  createAtmosphere();
}

/** Low-res aurora borealis on sky dome — performance friendly (small texture, single mesh) */
function createAurora() {
  const w = 32;
  const h = 64;
  auroraCanvas = document.createElement('canvas');
  auroraCanvas.width = w;
  auroraCanvas.height = h;
  auroraCtx = auroraCanvas.getContext('2d');

  // Default colors - much brighter and more visible
  const defaultColors = [
    'rgba(0,40,60,0)',
    'rgba(0,255,200,0.25)',
    'rgba(100,255,220,0.4)',
    'rgba(0,200,255,0.3)',
    'rgba(0,100,150,0.15)',
    'rgba(0,40,80,0)',
  ];
  const grad = auroraCtx.createLinearGradient(0, 0, 0, h);
  defaultColors.forEach((c, i) => grad.addColorStop(i / (defaultColors.length - 1), c));
  auroraCtx.fillStyle = grad;
  auroraCtx.fillRect(0, 0, w, h);

  const tex = new THREE.CanvasTexture(auroraCanvas);
  tex.wrapS = THREE.RepeatWrapping;
  // Taller cylinder for better visibility (height 45 instead of 25)
  const geo = new THREE.CylinderGeometry(95, 95, 45, 32, 1, true);
  const mat = new THREE.MeshBasicMaterial({
    map: tex,
    transparent: true,
    opacity: 1.0,
    side: THREE.BackSide,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.name = 'auroraRef';  // Debug panel name
  mesh.position.set(0, 25 + SCENE_Y_OFFSET, 0);  // Raised from y=15 to y=25
  mesh.renderOrder = -21;
  scene.add(mesh);
  auroraRef = mesh;
  registerFadeMaterial(auroraRef.material);
}

/** Update aurora colors based on current biome theme */
function updateAuroraColors(theme) {
  if (!auroraCtx || !auroraRef || !auroraRef.material || !auroraRef.material.map) return;

  // Use theme aurora colors if available, otherwise use bright defaults
  // Boost opacity values to make aurora more visible
  let colors = (theme && theme.aurora && theme.aurora.colors);
  if (!colors) {
    colors = [
      'rgba(0,40,60,0)',
      'rgba(0,255,200,0.25)',
      'rgba(100,255,220,0.4)',
      'rgba(0,200,255,0.3)',
      'rgba(0,100,150,0.15)',
      'rgba(0,40,80,0)',
    ];
  } else {
    // Boost the alpha values in the theme colors for better visibility
    colors = colors.map(c => {
      // Parse rgba and boost alpha by 2.5x (capped at 0.5)
      const match = c.match(/rgba?\((\d+),(\d+),(\d+),?([\d.]+)?\)/);
      if (match) {
        const r = match[1];
        const g = match[2];
        const b = match[3];
        const a = match[4] ? Math.min(0.5, parseFloat(match[4]) * 2.5) : 1;
        return `rgba(${r},${g},${b},${a.toFixed(2)})`;
      }
      return c;
    });
  }

  const h = auroraCanvas.height;
  auroraCtx.clearRect(0, 0, auroraCanvas.width, h);
  const grad = auroraCtx.createLinearGradient(0, 0, 0, h);
  colors.forEach((c, i) => grad.addColorStop(i / (colors.length - 1), c));
  auroraCtx.fillStyle = grad;
  auroraCtx.fillRect(0, 0, auroraCanvas.width, h);

  auroraRef.material.map.needsUpdate = true;
}

/** Update aurora animation - subtle color shifting and movement */
function updateAurora(dt, now) {
  if (!auroraRef || !auroraRef.material || !auroraRef.material.map) return;
  
  // Slow rotation for aurora drift effect
  auroraRef.rotation.y += dt * 0.02;
  
  // Subtle opacity pulsing - keep it visible (min 0.7, max 1.0)
  const pulse = 0.85 + Math.sin(now * 0.0003) * 0.15;
  auroraRef.material.opacity = pulse;
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
  // #2 FIX: Increased height for taller gradient reach into the sky
  const segments = 48;
  const radius = 92;  // Just behind mountains
  const height = 54;  // 20% taller than 45

  // Create a canvas for the gradient texture
  // Use full-opacity colors and control alpha separately in the gradient
  const canvas = document.createElement('canvas');
  canvas.width = 4;
  canvas.height = 256;
  const ctx = canvas.getContext('2d');

  // #2 FIX: DRAMATICALLY brighter and taller gradient for maximum visibility
  // EXACT synthwave colors: Horizon #FE9053 (orange) → Pink #E00186 → Dark purple #1A004A
  const grad = ctx.createLinearGradient(0, 256, 0, 0);  // bottom to top
  grad.addColorStop(0, 'rgba(255, 126, 49, 1.0)');       // #ff7e31 (lowest Y)
  grad.addColorStop(0.4, 'rgba(243, 7, 135, 0.9)');      // #f30787 (40% height)
  grad.addColorStop(0.75, 'rgba(113, 0, 110, 0.6)');     // #71006e (75% height)
  grad.addColorStop(1.0, 'rgba(26, 0, 74, 0.0)');        // #1a004a (top, fade to transparent)
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 4, 256);

  const atmTexture = new THREE.CanvasTexture(canvas);
  atmTexture.wrapS = THREE.RepeatWrapping;

  // Create a cylinder geometry (open-ended, only the side)
  const cylGeo = new THREE.CylinderGeometry(radius, radius, height, segments, 1, true);
  const cylMat = new THREE.MeshBasicMaterial({
    map: atmTexture,
    transparent: true,
    opacity: 1.0,  // #2 FIX: Increased from 0.8 to 1.0 for better visibility
    side: THREE.BackSide,  // Visible from inside
    depthWrite: false,
  });
  const cylinder = new THREE.Mesh(cylGeo, cylMat);
  cylinder.name = 'atmosphereRef';  // Debug panel name
  cylinder.position.set(0, height / 2 - 2 + SCENE_Y_OFFSET, 0);  // Base near ground level (adjusted for new height)
  cylinder.renderOrder = -13;
  scene.add(cylinder);
  atmosphereRef = cylinder;
  registerFadeMaterial(atmosphereRef.material);
}

function createVHSScanlineTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 256;
  const ctx = canvas.getContext('2d');

  // Transparent base keeps the effect subtle in VR.
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  for (let y = 0; y < canvas.height; y += 2) {
    const alpha = 0.06 + Math.random() * 0.045;
    ctx.fillStyle = `rgba(210, 230, 255, ${alpha.toFixed(3)})`;
    ctx.fillRect(0, y, canvas.width, 1);
  }

  // Add sparse tape-noise streaks for a light VHS feel.
  for (let i = 0; i < 22; i++) {
    const y = Math.floor(Math.random() * canvas.height);
    const h = 1 + Math.floor(Math.random() * 2);
    const alpha = 0.03 + Math.random() * 0.03;
    ctx.fillStyle = `rgba(255, 200, 235, ${alpha.toFixed(3)})`;
    ctx.fillRect(0, y, canvas.width, h);
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(1, 2);
  return texture;
}

function createVHSGlowTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 16;
  canvas.height = 256;
  const ctx = canvas.getContext('2d');

  const grad = ctx.createLinearGradient(0, 256, 0, 0);
  grad.addColorStop(0.0, 'rgba(255, 120, 165, 0.18)');
  grad.addColorStop(0.35, 'rgba(180, 130, 255, 0.10)');
  grad.addColorStop(0.7, 'rgba(120, 180, 255, 0.04)');
  grad.addColorStop(1.0, 'rgba(120, 180, 255, 0.0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  return texture;
}

function createVHSNoiseTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext('2d');
  const image = ctx.createImageData(canvas.width, canvas.height);
  const data = image.data;

  for (let i = 0; i < data.length; i += 4) {
    const value = Math.floor(Math.random() * 255);
    data[i] = value;
    data[i + 1] = value;
    data[i + 2] = value;
    data[i + 3] = 255;
  }

  ctx.putImageData(image, 0, 0);

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(3, 2);
  return texture;
}

function createVHSRetroShell() {
  if (!scene || vhsRetroShellRef) return;

  // VR-CRITICAL: Keep this as geometry around the player, not a head-locked
  // post-process. XR continues to render through renderer.render(scene, camera).
  // The previous open cylinder was fragile from inside the head in VR. These
  // layered spheres stay visible when looking up/down and avoid side-culling.
  const shellGroup = new THREE.Group();
  shellGroup.name = 'vhsRetroShellRef';

  const radius = 80;
  const segments = 40;
  const rings = 28;

  const scanlineGeo = new THREE.SphereGeometry(radius, segments, rings);
  const scanlineTex = createVHSScanlineTexture();
  const scanlineMat = new THREE.MeshBasicMaterial({
    map: scanlineTex,
    color: 0x99b8ff,
    transparent: true,
    opacity: 0.09,
    side: THREE.DoubleSide,
    depthTest: false,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  const scanlineShell = new THREE.Mesh(scanlineGeo, scanlineMat);
  scanlineShell.name = 'vhs-scanline-shell';
  scanlineShell.renderOrder = 950;
  shellGroup.add(scanlineShell);

  const glowGeo = new THREE.SphereGeometry(radius - 1.2, segments, rings);
  const glowTex = createVHSGlowTexture();
  const glowMat = new THREE.MeshBasicMaterial({
    map: glowTex,
    color: 0xff7aa6,
    transparent: true,
    opacity: 0.06,
    side: THREE.DoubleSide,
    depthTest: false,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  const glowShell = new THREE.Mesh(glowGeo, glowMat);
  glowShell.name = 'vhs-glow-shell';
  glowShell.renderOrder = 951;
  shellGroup.add(glowShell);

  const noiseGeo = new THREE.SphereGeometry(radius - 2.6, 28, 20);
  const noiseTex = createVHSNoiseTexture();
  const noiseMat = new THREE.MeshBasicMaterial({
    map: noiseTex,
    color: 0xcad6ff,
    transparent: true,
    opacity: 0.02,
    side: THREE.DoubleSide,
    depthTest: false,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  const noiseShell = new THREE.Mesh(noiseGeo, noiseMat);
  noiseShell.name = 'vhs-noise-shell';
  noiseShell.renderOrder = 952;
  shellGroup.add(noiseShell);

  shellGroup.frustumCulled = false;
  scene.add(shellGroup);

  vhsRetroShellRef = shellGroup;
  vhsRetroScanlineMatRef = scanlineMat;
  vhsRetroGlowMatRef = glowMat;
  vhsRetroNoiseMatRef = noiseMat;
  vhsRetroScanlineTexRef = scanlineTex;
  vhsRetroNoiseTexRef = noiseTex;

  registerFadeMaterial(scanlineMat);
  registerFadeMaterial(glowMat);
  registerFadeMaterial(noiseMat);
}

function updateVHSRetroShell(now, tuning = getVisualTuning()) {
  if (!vhsRetroShellRef || !camera) return;

  camera.getWorldPosition(_vhsPlayerPos);
  vhsRetroShellRef.position.copy(_vhsPlayerPos);

  if (vhsRetroScanlineTexRef) {
    const scanSpeed = 0.00002 + tuning.shellScanlineSpeed * 0.000045;
    vhsRetroScanlineTexRef.offset.y = (now * scanSpeed) % 1;
    vhsRetroScanlineTexRef.offset.x = Math.sin(now * 0.0001) * 0.01 * tuning.shellStrength;
  }

  if (vhsRetroNoiseTexRef) {
    vhsRetroNoiseTexRef.offset.x = (now * 0.000037 * (0.4 + tuning.shellScanlineSpeed)) % 1;
    vhsRetroNoiseTexRef.offset.y = (now * 0.000061 * (0.3 + tuning.shellScanlineSpeed)) % 1;
  }

  const fadeScale = 1 - environmentFade;
  if (vhsRetroScanlineMatRef) {
    const base = (vhsRetroScanlineMatRef.__fadeBase ?? 0.09) * tuning.shellStrength * (0.45 + tuning.glowStrength * 0.75);
    const flicker = 0.95 + Math.sin(now * 0.0018) * 0.05;
    vhsRetroScanlineMatRef.opacity = base * fadeScale * flicker;
  }

  if (vhsRetroGlowMatRef) {
    const base = (vhsRetroGlowMatRef.__fadeBase ?? 0.06) * tuning.shellStrength * (0.25 + tuning.glowStrength * 0.85);
    const pulse = 0.9 + Math.sin(now * 0.0011) * 0.1;
    vhsRetroGlowMatRef.opacity = base * fadeScale * pulse;
  }

  if (vhsRetroNoiseMatRef) {
    const base = (vhsRetroNoiseMatRef.__fadeBase ?? 0.02) * tuning.shellStrength * tuning.shellNoiseAmount * (0.3 + tuning.glowStrength * 0.7);
    const shimmer = 0.7 + Math.sin(now * 0.0031) * 0.3;
    vhsRetroNoiseMatRef.opacity = base * fadeScale * shimmer;
  }
}

function createMountains() {
  const layers = [
    { z: -85, color: 0x0d001a, peaks: generatePeaks(12, 6, 20), layerIndex: 0 },
    { z: -75, color: MTN_DARK, peaks: generatePeaks(10, 4, 14), layerIndex: 1 },
  ];
  layers.forEach(({ z, color, peaks, layerIndex }) => {
    const shape = new THREE.Shape();
    shape.moveTo(-100, 0);
    peaks.forEach(([x, y]) => shape.lineTo(x, y));
    shape.lineTo(100, 0);
    shape.closePath();

    const fillMesh = new THREE.Mesh(new THREE.ShapeGeometry(shape), new THREE.MeshBasicMaterial({ color, side: THREE.DoubleSide }));
    fillMesh.position.set(0, 0, z);
    fillMesh.renderOrder = -5;  // Draw after foreground, before sun
    fillMesh.matrixAutoUpdate = false;
    scene.add(fillMesh);
    registerFadeMaterial(fillMesh.material);

    const edgePoints = [new THREE.Vector3(-100, 0, z)];
    peaks.forEach(([x, y]) => edgePoints.push(new THREE.Vector3(x, y, z)));
    edgePoints.push(new THREE.Vector3(100, 0, z));
    const geometry = new THREE.BufferGeometry().setFromPoints(edgePoints);
    const edgeLine = new THREE.Line(geometry, new THREE.LineBasicMaterial({ color: MTN_WIRE, transparent: true, opacity: 0.5 }));
    edgeLine.matrixAutoUpdate = false;
    scene.add(edgeLine);
    registerFadeMaterial(edgeLine.material);

    // Store for theme color updates
    mountainLines[layerIndex] = { line: edgeLine, geometry, z, fillMesh };
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

function createSparklingStars(theme) {
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
      uPixelRatio: { value: Math.min(window.devicePixelRatio, 2) }
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
        float size = (8.0 * uPixelRatio + vTwinkle * 2.0) * (800.0 / -mvPosition.z);
        gl_PointSize = max(size, 2.5);  // Minimum 2.5px for visibility
        gl_Position = projectionMatrix * mvPosition;
      }
    `,
    fragmentShader: `
      uniform vec3 uColor;
      varying float vTwinkle;
      void main() {
        float dist = length(gl_PointCoord - vec2(0.5));
        if (dist > 0.5) discard;
        float alpha = 1.0 - smoothstep(0.0, 0.5, dist);
        gl_FragColor = vec4(uColor * (0.7 + vTwinkle * 0.4), alpha * vTwinkle);
      }
    `,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending
  });
  const stars = new THREE.Points(geo, mat);
  stars.renderOrder = 10;  // Render after skydome (-20) and sun (-3 to -1)
  stars.userData.update = (now) => {
    mat.uniforms.uTime.value = now * 0.001;
  };
  scene.add(stars);
  starsRef = stars;
  registerFadeMaterial(starsRef.material);
}

function createStars() {
  const theme = currentTheme || {};
  if (theme.customScene === 'synthwave_valley') {
    createSparklingStars(theme);
    return;
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
  const mat = new THREE.PointsMaterial({ color: 0xffffff, size: 0.5 });
  const stars = new THREE.Points(geo, mat);
  stars.renderOrder = 10;  // Render after skydome (-20) and sun (-3 to -1)
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
  if (theme.customScene === 'synthwave_valley') {
    createSparklingStars(theme);
    return;
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
  stars.renderOrder = 10;  // Render after skydome (-20) and sun (-3 to -1)
  scene.add(stars);
  starsRef = stars;
  registerFadeMaterial(starsRef.material);
}

// ============================================================
// CONTROLLER SETUP & INPUT HANDLING
// VR controllers, trigger press/release, squeeze, desktop click
// HOT PATH: onTriggerPress called every frame when trigger held
// COUPLING: Directly calls fireMainWeapon, fireAltWeapon
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
    
    // Pause via left controller secondary/menu button
    if (i === 0) {
      controller.addEventListener('secondary', () => { togglePause(); });
    }
    
    controller.addEventListener('connected', (e) => {
      console.log(`[controller] ${i} connected — ${e.data.handedness}`);
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
function createBlasterDisplay(controllerIndex) {
  const group = new THREE.Group();
  const hand = getHandForController(controllerIndex);

  // ═══════════════════════════════════════════════════════════════
  // HOLOGRAM SHADER - Single draw call replaces 8 scan line meshes
  // ═══════════════════════════════════════════════════════════════
  
  // Vertex shader: compute world-space position and normals for Fresnel effect
  const holoVertexShader = `
    varying vec2 vUv;
    varying vec3 vPositionW;
    varying vec4 vPos;
    varying vec3 vNormalW;

    void main() {
      vUv = uv;
      vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
      vPos = projectionMatrix * mvPosition;
      vPositionW = (modelMatrix * vec4(position, 1.0)).xyz;
      vNormalW = normalize(mat3(modelMatrix) * normal);
      gl_Position = vPos;
    }
  `;

  // Fragment shader: scan lines, Fresnel glow, flicker - all in one pass
  const holoFragmentShader = `
    uniform float uTime;
    uniform vec3 uColor;
    uniform float uOpacity;
    uniform float uScanlineSize;
    uniform float uSignalSpeed;
    uniform float uFresnelAmount;
    uniform float uFresnelOpacity;

    varying vec2 vUv;
    varying vec3 vPositionW;
    varying vec4 vPos;
    varying vec3 vNormalW;

    float flicker(float amt, float time) {
      return clamp(fract(cos(time) * 43758.5453123), amt, 1.0);
    }
    float random(float a, float b) {
      return fract(cos(dot(vec2(a,b), vec2(12.9898,78.233))) * 43758.5453);
    }

    void main() {
      // Screen-space coordinates for scanlines
      vec2 vCoords = vPos.xy / vPos.w;
      vCoords = vCoords * 0.5 + 0.5;
      vec2 myUV = fract(vCoords);
      
      // Base hologram color with vertical gradient
      vec4 holoColor = vec4(uColor, mix(1.0, vUv.y, 0.5));
      
      // Animated scanlines
      float scanlines = 10.0;
      scanlines += 20.0 * sin(uTime * uSignalSpeed * 20.8 - myUV.y * 60.0 * uScanlineSize);
      scanlines *= smoothstep(1.3 * cos(uTime * uSignalSpeed + myUV.y * uScanlineSize), 0.78, 0.9);
      scanlines *= max(0.25, sin(uTime * uSignalSpeed) * 1.0);
      
      // Random noise offsets for glitch effect
      float r = random(vUv.x, vUv.y);
      float b = random(vUv.y * 0.9, vUv.y * 0.2);
      holoColor += vec4(r * scanlines, b * scanlines, r, 1.0) / 84.0;
      
      // Fresnel edge glow (view-dependent rim lighting)
      vec3 viewDir = normalize(cameraPosition - vPositionW);
      float fresnel = dot(viewDir, vNormalW) * (1.6 - uFresnelOpacity / 2.0);
      fresnel = clamp(uFresnelAmount - fresnel, 0.0, uFresnelOpacity);
      
      // Subtle flicker for old-TV effect
      float blink = flicker(0.6 - uSignalSpeed, uTime * uSignalSpeed * 0.02);
      
      // Final composition
      vec3 finalColor = holoColor.rgb * blink + fresnel;
      gl_FragColor = vec4(finalColor, uOpacity);
    }
  `;

  // Create shader material with hologram effect uniforms
  const holoMaterial = new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0.0 },
      uColor: { value: new THREE.Vector3(0.0, 0.84, 1.0) },  // Cyan to match game theme
      uOpacity: { value: 0.85 },
      uScanlineSize: { value: 8.0 },
      uSignalSpeed: { value: 1.0 },
      uFresnelAmount: { value: 0.45 },
      uFresnelOpacity: { value: 1.0 }
    },
    vertexShader: holoVertexShader,
    fragmentShader: holoFragmentShader,
    transparent: true,
    side: THREE.DoubleSide,
    depthWrite: false,
    blending: THREE.AdditiveBlending
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
  display.add(makeText(`UPGRADES: ${upgradeCount}`, -0.08, 16));

  display.userData.needsUpdate = false;
}

// ============================================================
//  INPUT HANDLING
// ============================================================
// Scoreboard flow context
var scoreboardFromGameOver = false;  // true = came from game over, false = came from title

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
  } else if (st === State.PAUSED) {
    handlePauseTrigger(controller);
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
  if (getPauseMenuHit(_uiRaycaster) === 'resume') {
    playMenuClick();
    startPauseCountdown();
  }
}

function handleTitleTrigger(controller) {
  const origin = new THREE.Vector3();
  const quat = new THREE.Quaternion();
  controller.getWorldPosition(origin);
  controller.getWorldQuaternion(quat);
  const direction = new THREE.Vector3(0, 0, -1).applyQuaternion(quat);
  _uiRaycaster.set(origin, direction, 0, 20);

  const btnHit = getTitleButtonHit(_uiRaycaster);
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
  } else if (st === State.PAUSED) {
    handleDesktopPauseClick();
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
    submitScore(name, game.finalScore, game.finalLevel, country).then((data) => {
      // Store the timestamp of the submitted score for highlighting
      if (data && data[0] && data[0].created_at) {
        setLastSubmittedTimestamp(data[0].created_at);
      }
      return new Promise(resolve => setTimeout(resolve, 500));
    }).then(() => {
      return fetchTopScores();
    }).then(scores => {
      // Find the page the submitted score is on and auto-navigate
      if (lastSubmittedTimestamp) {
        const idx = scores.findIndex(s => s.created_at === lastSubmittedTimestamp);
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

  const action = getScoreboardHit(raycaster);
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

function handleDesktopPauseClick() {
  const raycaster = getAimRaycaster();
  // Match VR behavior: desktop pause only resumes when the button is actually selected.
  if (raycaster && getPauseMenuHit(raycaster) === 'resume') {
    playMenuClick();
    startPauseCountdown();
  }
}

function handleDesktopDebugMenuClick() {
  console.log('[debug] handleDesktopDebugMenuClick called');
  const raycaster = getAimRaycaster();
  if (!raycaster) {
    console.log('[debug] No raycaster available');
    return;
  }

  const result = getDebugMenuHit(raycaster);
  console.log('[debug] getDebugMenuHit result:', result);
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
    console.log('[debug] biome_next action detected, calling cycleDebugBiomeWithFade');
    playMenuClick();
    cycleDebugBiomeWithFade();
  }
}

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

function handleNameEntryTrigger(controller) {
  const origin = new THREE.Vector3();
  const quat = new THREE.Quaternion();
  controller.getWorldPosition(origin);
  controller.getWorldQuaternion(quat);
  const direction = new THREE.Vector3(0, 0, -1).applyQuaternion(quat);
  _uiRaycaster.set(origin, direction, 0, 10);

  const result = getNameEntryHit(_uiRaycaster);
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
    submitScore(name, game.finalScore, game.finalLevel, country).then((data) => {
      // Store the timestamp of the submitted score for highlighting
      if (data && data[0] && data[0].created_at) {
        setLastSubmittedTimestamp(data[0].created_at);
      }
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
  _uiRaycaster.set(origin, direction, 0, 20);

  const action = getScoreboardHit(_uiRaycaster);
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

function handleCountrySelectTrigger(controller) {
  const origin = new THREE.Vector3();
  const quat = new THREE.Quaternion();
  controller.getWorldPosition(origin);
  controller.getWorldQuaternion(quat);
  const direction = new THREE.Vector3(0, 0, -1).applyQuaternion(quat);
  _uiRaycaster.set(origin, direction, 0, 10);

  const result = getCountrySelectHit(_uiRaycaster, COUNTRIES);
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
  // Stop lightning beam when trigger released
  if (lightningBeams[index]) {
    scene.remove(lightningBeams[index]);
    lightningBeams[index] = null;
    stopLightningSound();
  }
}

// ============================================================
//  NUKE — ALT-FIRE SCREEN CLEAR
//  Instantly kills all non-boss enemies. Both controllers trigger it.
//  Cooldown: 0.5s between activations to prevent double-fire.
// ============================================================
let lastNukeTime = 0;
const NUKE_COOLDOWN = 500;

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
    game.kills++;
    trackKill(false);
    addScore(50); // Base score per nuked enemy
    killed++;
  }

  if (killed > 0) {
    updateHUD(game);

    const cfg = game._levelConfig;
    if (!killsAlertShownThisLevel && killsAlertTriggerKill && game.kills >= killsAlertTriggerKill) {
      const remaining = cfg ? cfg.killTarget - game.kills : 0;
      showKillsRemainingAlert(remaining);
      playKillsAlertSound(remaining);
      killsAlertShownThisLevel = true;
    }

    if (cfg && game.kills >= cfg.killTarget) {
      completeLevel();
    }
  }

  console.log(`[nuke] Activated! Killed ${killed} enemies. ${game.nukes} remaining.`);
  return true;
}

// ============================================================
// ALT WEAPON SYSTEMS
// Shield, laser mines, decoys, black holes, tethers, nanites,
// phase dash, reflector drones, stasis, plasma orbs, grenades,
// proximity mines, attack drones, EMP, teleport
// COUPLING: Updates scene, activeShields/activeLaserMines/etc arrays
// ============================================================
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
            trackKill();
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

// Pooled temp vector for black hole pull (per-enemy per-frame)
const _bhPullToCenter = new THREE.Vector3();

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

        if (result.killed) {
          const destroyData = destroyEnemy(index);
          if (destroyData) {
            game.kills++;
            trackKill();
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
          if (result.killed) {
            const destroyData = destroyEnemy(index);
            if (destroyData) {
              game.kills++;
              trackKill();
              addScore(destroyData.scoreValue);
              updateHUD(game);

              // Check for kills remaining alert
              const cfg = game._levelConfig;
              if (!killsAlertShownThisLevel && killsAlertTriggerKill && game.kills >= killsAlertTriggerKill) {
                const remaining = cfg ? cfg.killTarget - game.kills : 0;
                showKillsRemainingAlert(remaining);
                playKillsAlertSound(remaining);
                killsAlertShownThisLevel = true;
              }

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
          setMaterialEmissiveSafe(e.mesh.material, new THREE.Color(0xffd700), 0.5);
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
        setMaterialEmissiveSafe(e.mesh.material, new THREE.Color(0x000000), 0);
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
  _uiRaycaster.set(origin, direction, 0, altWeapon.range);
  const enemyMeshes = getEnemyMeshes(true);
  const hits = _uiRaycaster.intersectObjects(enemyMeshes, true);

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
              trackKill();
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

  // Teleport player (desktop only - in VR, WebXR controls camera position)
  if (!renderer.xr.isPresenting) {
    camera.position.copy(destination);
    console.log(`[Phase Dash] Teleported from (${oldPosition.x.toFixed(2)}, ${oldPosition.y.toFixed(2)}, ${oldPosition.z.toFixed(2)}) to (${destination.x.toFixed(2)}, ${destination.y.toFixed(2)}, ${destination.z.toFixed(2)})`);
  } else {
    console.log(`[Phase Dash] VR mode - teleport visual only (WebXR controls camera)`);
  }

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
            trackKill();
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
          console.log(`[Phase Dash] Afterimage exploded for ${damage} damage`);

          if (result.killed) {
            const destroyData = destroyEnemy(enemyIndex);
            if (destroyData) {
              game.kills++;
              trackKill();
              addScore(destroyData.scoreValue);
              updateHUD(game);
            }
          }
        }
      }

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
  const enemies = getEnemies();  // Still needed for index lookup
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
        trackKill();
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

      if (result.killed) {
        const destroyData = destroyEnemy(i);
        if (destroyData) {
          game.kills++;
          trackKill();
          addScore(destroyData.scoreValue);
          updateHUD(game);

          // Check for kills remaining alert
          const cfg = game._levelConfig;
          if (!killsAlertShownThisLevel && killsAlertTriggerKill && game.kills >= killsAlertTriggerKill) {
            const remaining = cfg ? cfg.killTarget - game.kills : 0;
            showKillsRemainingAlert(remaining);
            playKillsAlertSound(remaining);
            killsAlertShownThisLevel = true;
          }

          if (cfg && game.kills >= cfg.killTarget) {
            completeLevel();
          }
        }
      }
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

function detonateProximityMine(mine, index) {
  console.log('[Mine] Detonated!');

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

      if (result.killed) {
        const destroyData = destroyEnemy(i);
        if (destroyData) {
          game.kills++;
          trackKill();
          addScore(destroyData.scoreValue);
          updateHUD(game);

          const cfg = game._levelConfig;
          // Check for kills remaining alert
          if (!killsAlertShownThisLevel && killsAlertTriggerKill && game.kills >= killsAlertTriggerKill) {
            const remaining = cfg ? cfg.killTarget - game.kills : 0;
            showKillsRemainingAlert(remaining);
            playKillsAlertSound(remaining);
            killsAlertShownThisLevel = true;
          }

          if (cfg && game.kills >= cfg.killTarget) {
            completeLevel();
          }
        }
      }
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

function destroyProximityMine(mine) {
  scene.remove(mine.mesh);
  // Dispose all children (glow mesh) to prevent geometry/material leak
  mine.mesh.children.forEach(child => {
    if (child.geometry) child.geometry.dispose();
    if (child.material) child.material.dispose();
  });
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
          trackKill();
          addScore(destroyData.scoreValue);
          updateHUD(game);

          const cfg = game._levelConfig;
          // Check for kills remaining alert
          if (!killsAlertShownThisLevel && killsAlertTriggerKill && game.kills >= killsAlertTriggerKill) {
            const remaining = cfg ? cfg.killTarget - game.kills : 0;
            showKillsRemainingAlert(remaining);
            playKillsAlertSound(remaining);
            killsAlertShownThisLevel = true;
          }

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

  // Teleport player (desktop only - in VR, WebXR controls camera position)
  if (!renderer.xr.isPresenting) {
    camera.position.copy(destination);
    console.log(`[Teleport] Moved from (${playerPos.x.toFixed(2)}, ${playerPos.y.toFixed(2)}, ${playerPos.z.toFixed(2)}) to (${destination.x.toFixed(2)}, ${destination.y.toFixed(2)}, ${destination.z.toFixed(2)})`);
  } else {
    console.log(`[Teleport] VR mode - teleport visual only (WebXR controls camera)`);
  }

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

function cycleDebugBiome() {
  // #9 FIX: Cycle through specific biomes: SYNTHWAVE > DESERT > ALIEN PLANET > HELLSCAPE > SYNTHWAVE
  const debugBiomeCycle = ['synthwave_valley', 'desert_night', 'alien_planet', 'hellscape_lava'];
  const current = game.debugBiomeOverride;
  let next = null;

  console.log('[debug] cycleDebugBiome: current=', current);

  if (!current) {
    // Start with first biome in cycle
    next = debugBiomeCycle[0];
    console.log('[debug] No current biome, starting with:', next);
  } else {
    const index = debugBiomeCycle.indexOf(current);
    console.log('[debug] Current biome index:', index);
    if (index === -1) {
      // If current biome is not in cycle, start from beginning
      next = debugBiomeCycle[0];
      console.log('[debug] Biome not in cycle, resetting to:', next);
    } else if (index === debugBiomeCycle.length - 1) {
      // Wrap around to first biome
      next = debugBiomeCycle[0];
      console.log('[debug] End of cycle, wrapping to:', next);
    } else {
      // Move to next biome in cycle
      next = debugBiomeCycle[index + 1];
      console.log('[debug] Moving to next biome:', next);
    }
  }

  game.debugBiomeOverride = next;
  saveDebugSettings();
  console.log('[debug] Biome override set to', next || 'auto');
  return next;
}

function cycleDebugBiomeWithFade() {
  console.log('[debug] cycleDebugBiomeWithFade called, environmentFadeState:', environmentFadeState);
  if (environmentFadeState) {
    console.log('[debug] Fade already in progress, skipping');
    return;
  }
  if (!game.level || game.level < 1) {
    console.log('[debug] Setting level to 1 for biome cycle');
    game.level = 1;
    game._levelConfig = getLevelConfig();
  }
  // Fade durations are in SECONDS (0.3s = 300ms fade)
  console.log('[debug] Starting fade out...');
  startEnvironmentFade('out', 0.3, () => {
    console.log('[debug] Fade out complete, cycling biome...');
    cycleDebugBiome();
    console.log('[debug] Applying theme for level', game.level);
    applyThemeForLevel(game.level);
    console.log('[debug] Starting fade in...');
    startEnvironmentFade('in', 0.3);
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

  if (dreamTriggerMesh) {
    dreamTriggerMesh.userData.placedForRun = false;
    placeDreamTriggerBehindPlayer(true);
    refreshDreamTriggerVisibility();
  }
}

function startReadyCountdown() {
  if (readyCountdownActive) return;
  readyCountdownActive = true;
  readyCountdownStartTime = performance.now();
  readyCountdownLastValue = READY_COUNTDOWN_SECONDS;
  updateReadyCountdownText(`${READY_COUNTDOWN_SECONDS}`);
  playCountdown321();  // 321 sound triggers on the "3"
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
  _uiRaycaster.set(origin, direction, 0, 10);

  const result = getDebugMenuHit(_uiRaycaster);
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
    cycleDebugBiomeWithFade();  // Use the fade version for VR too
    return;
  }
  // Toggle clicks are handled in getDebugMenuHit with visual updates
}

// ============================================================
// GAME FLOW & STATE MANAGEMENT
// startGame, completeLevel, togglePause, endGame, debug jump
// COUPLING: Transitions game.state, calls HUD show/hide, audio
// ============================================================
function captureLevelSpawnForward() {
  _levelSpawnForward.copy(DEFAULT_LEVEL_SPAWN_FORWARD);
  setBossSpawnForward(_levelSpawnForward);
  biomeClearedForBossCinematic = false;
}

function startGame() {
  console.log('[game] Starting new game');
  hideTitle();

  // Clean up any leftover boss minions from previous run
  clearBossMinions();
  
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

  resetAllSlowMoState();
  dreamTransition = null;

  if (dreamTriggerMesh) {
    dreamTriggerMesh.userData.placedForRun = false;
    placeDreamTriggerBehindPlayer(true);
    refreshDreamTriggerVisibility();
  }
  
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
  killsAlertShownThisLevel = false;
  const cfg = game._levelConfig;
  if (cfg && !cfg.isBoss) {
    const threshold = game.level >= 16 ? 20 : game.level >= 11 ? 15 : game.level >= 6 ? 10 : 5;
    killsAlertTriggerKill = cfg.killTarget - threshold;
    if (killsAlertTriggerKill <= 0) killsAlertTriggerKill = null;
  } else {
    killsAlertTriggerKill = null;
  }

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

function completeLevel() {
  if (isBossDeathCinematicActive()) return;

  console.log(`[game] Level ${game.level} complete`);

  // Hide kills remaining alert if showing
  hideKillsAlert();

  // Update HUD one final time to show correct kill count
  updateHUD(game);

  // Ensure level-end timing is not slowed by proximity slow-mo
  resetAllSlowMoState();

  game.state = State.LEVEL_COMPLETE;
  clearAllEnemies();

  // PERFORMANCE: Clear all projectiles on level complete
  clearAllProjectiles();

  // Clear all lightning beams
  clearAllLightningBeams();

  // Clear all conductor electric arcs
  clearAllElectricArcs();
  clearBossProjectiles();

  // Clear all telegraph effects
  clearAllTelegraphs();

  // Clear all alt-weapon effects (grenades, mines, drones, etc.)
  clearAllAltWeaponEffects();

  stopLightningSound();
  game.justBossKill = game._levelConfig && game._levelConfig.isBoss;
  game.stateTimer = 2.0; // cooldown before upgrade screen
  levelFadeReady = false;
  const shouldFade = shouldFadeForBiomeTransition(game.level);
  // If the boss death overlay is still active, the environment is already fully
  // faded to black. Skip the fade-out animation to prevent a pop-back flash.
  if (isBossDeathOverlayActive()) {
    console.log('[game] Boss death overlay active, skipping environment fade-out');
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

  if (!game.justBossKill && [4, 9, 14, 19].includes(game.level)) {
    fadeOutMusic(1200);
  }
}

// PERFORMANCE: Clear all active projectiles and return them to pool
function clearAllProjectiles() {
  for (let i = projectiles.length - 1; i >= 0; i--) {
    const proj = projectiles[i];
    if (proj?.userData?.isPooled) {
      returnProjectileToPool(proj);
    } else {
      scene.remove(proj);
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
function clearAllLightningBeams() {
  for (let i = 0; i < lightningBeams.length; i++) {
    if (lightningBeams[i]) {
      scene.remove(lightningBeams[i]);
      lightningBeams[i] = null;
    }
  }
  lightningTimers.fill(0);
}

// Clear all alt-weapon effects (grenades, mines, decoys, drones, etc.)
// Called during level transitions to prevent geometry/material accumulation
function clearAllAltWeaponEffects() {
  // Clear active shields
  for (let i = activeShields.length - 1; i >= 0; i--) {
    const shield = activeShields[i];
    scene.remove(shield.mesh);
    shield.mesh.geometry.dispose();
    shield.mesh.material.dispose();
  }
  activeShields.length = 0;

  // Clear active laser mines
  for (let i = activeLaserMines.length - 1; i >= 0; i--) {
    const mine = activeLaserMines[i];
    if (mine.mesh) {
      scene.remove(mine.mesh);
      mine.mesh.children.forEach(child => {
        if (child.geometry) child.geometry.dispose();
        if (child.material) child.material.dispose();
      });
      if (mine.mesh.geometry) mine.mesh.geometry.dispose();
      if (mine.mesh.material) mine.mesh.material.dispose();
    }
  }
  activeLaserMines.length = 0;

  // Clear active decoys
  for (let i = activeDecoys.length - 1; i >= 0; i--) {
    const decoy = activeDecoys[i];
    scene.remove(decoy.mesh);
    decoy.mesh.children.forEach(child => {
      if (child.geometry) child.geometry.dispose();
      if (child.material) child.material.dispose();
    });
  }
  activeDecoys.length = 0;

  // Clear active black holes
  for (let i = activeBlackHoles.length - 1; i >= 0; i--) {
    const bh = activeBlackHoles[i];
    scene.remove(bh.mesh);
    bh.mesh.children.forEach(child => {
      if (child.geometry) child.geometry.dispose();
      if (child.material) child.material.dispose();
    });
  }
  activeBlackHoles.length = 0;

  // Clear active mines (black hole mines)
  for (let i = activeMines.length - 1; i >= 0; i--) {
    const mine = activeMines[i];
    if (mine.mesh) {
      scene.remove(mine.mesh);
      mine.mesh.children.forEach(child => {
        if (child.geometry) child.geometry.dispose();
        if (child.material) child.material.dispose();
      });
    }
  }
  activeMines.length = 0;

  // Clear active tethers
  for (let i = activeTethers.length - 1; i >= 0; i--) {
    const tether = activeTethers[i];
    scene.remove(tether.mesh);
    tether.mesh.children.forEach(child => {
      if (child.geometry) child.geometry.dispose();
      if (child.material) child.material.dispose();
    });
  }
  activeTethers.length = 0;

  // Clear active nanite swarms
  for (let i = activeNaniteSwarms.length - 1; i >= 0; i--) {
    const swarm = activeNaniteSwarms[i];
    scene.remove(swarm.mesh);
    swarm.mesh.children.forEach(child => {
      if (child.geometry) child.geometry.dispose();
      if (child.material) child.material.dispose();
    });
  }
  activeNaniteSwarms.length = 0;

  // Clear active reflector drones
  for (let i = activeReflectorDrones.length - 1; i >= 0; i--) {
    const drone = activeReflectorDrones[i];
    scene.remove(drone.mesh);
    drone.mesh.children.forEach(child => {
      if (child.geometry) child.geometry.dispose();
      if (child.material) child.material.dispose();
    });
  }
  activeReflectorDrones.length = 0;

  // Clear active grenades
  for (let i = activeGrenades.length - 1; i >= 0; i--) {
    const grenade = activeGrenades[i];
    scene.remove(grenade.mesh);
    grenade.mesh.children.forEach(child => {
      if (child.geometry) child.geometry.dispose();
      if (child.material) child.material.dispose();
    });
    grenade.mesh.geometry.dispose();
    grenade.mesh.material.dispose();
  }
  activeGrenades.length = 0;

  // Clear active proximity mines
  for (let i = activeProximityMines.length - 1; i >= 0; i--) {
    const mine = activeProximityMines[i];
    scene.remove(mine.mesh);
    mine.mesh.children.forEach(child => {
      if (child.geometry) child.geometry.dispose();
      if (child.material) child.material.dispose();
    });
    mine.mesh.geometry.dispose();
    mine.mesh.material.dispose();
  }
  activeProximityMines.length = 0;

  // Clear active attack drones
  for (let i = activeAttackDrones.length - 1; i >= 0; i--) {
    const drone = activeAttackDrones[i];
    scene.remove(drone.mesh);
    drone.mesh.children.forEach(child => {
      if (child.geometry) child.geometry.dispose();
      if (child.material) child.material.dispose();
    });
  }
  activeAttackDrones.length = 0;

  // Clear active plasma orbs
  for (let i = activePlasmaOrbs.length - 1; i >= 0; i--) {
    const orb = activePlasmaOrbs[i];
    orb.trailParticles.forEach(t => {
      scene.remove(t.mesh);
      t.mesh.geometry.dispose();
      t.mesh.material.dispose();
    });
    scene.remove(orb.mesh);
    orb.mesh.geometry.dispose();
    orb.mesh.material.dispose();
  }
  activePlasmaOrbs.length = 0;

  // Clear active phase dash afterimages
  for (let i = activePhaseDashAfterimages.length - 1; i >= 0; i--) {
    const afterimage = activePhaseDashAfterimages[i];
    scene.remove(afterimage.mesh);
    afterimage.mesh.children.forEach(child => {
      if (child.geometry) child.geometry.dispose();
      if (child.material) child.material.dispose();
    });
  }
  activePhaseDashAfterimages.length = 0;

  // Clear active stasis fields
  for (let i = activeStasisFields.length - 1; i >= 0; i--) {
    const field = activeStasisFields[i];
    scene.remove(field.mesh);
    field.mesh.children.forEach(child => {
      if (child.geometry) child.geometry.dispose();
      if (child.material) child.material.dispose();
    });
  }
  activeStasisFields.length = 0;

  // Clear active EMP visuals
  for (let i = activeEMPVisuals.length - 1; i >= 0; i--) {
    const emp = activeEMPVisuals[i];
    scene.remove(emp.mesh);
    if (emp.mesh.geometry) emp.mesh.geometry.dispose();
    if (emp.mesh.material) emp.mesh.material.dispose();
  }
  activeEMPVisuals.length = 0;

  // Clear active teleport effects
  for (let i = activeTeleportEffects.length - 1; i >= 0; i--) {
    const effect = activeTeleportEffects[i];
    scene.remove(effect.mesh);
    if (effect.mesh.geometry) effect.mesh.geometry.dispose();
    if (effect.mesh.material) effect.mesh.material.dispose();
  }
  activeTeleportEffects.length = 0;

  // Clear explosion visuals (toxic pools, boss shields, etc.)
  for (let i = explosionVisuals.length - 1; i >= 0; i--) {
    const visual = explosionVisuals[i];
    scene.remove(visual);
    if (visual.geometry) visual.geometry.dispose();
    if (visual.material) visual.material.dispose();
  }
  explosionVisuals.length = 0;

  // Clear active voxels
  for (let i = activeVoxels.length - 1; i >= 0; i--) {
    const voxel = activeVoxels[i];
    voxel.visible = false;
    voxel.userData.velocity = null;
    voxel.userData.createdAt = undefined;
    voxel.userData.lifetime = undefined;
  }
  activeVoxels.length = 0;

  console.log('[cleanup] Cleared all alt-weapon effects and visuals');
}

// Register clearAllAltWeaponEffects as a resetGame() hook so voxels/effects
// are properly cleared even on full game restart (not just level transitions).
registerResetHook(clearAllAltWeaponEffects);

function showUpgradeScreen() {
  console.log('[game] Showing upgrade selection');
  game.state = State.UPGRADE_SELECT;
  hideLevelComplete();
  resetHoloGlitch();

  // Dismiss boss death overlay so upgrade cards are visible
  dismissBossDeathOverlay();

  // Stop lightning sound during upgrade screen
  stopLightningSound();

  // Get the hand for this upgrade
  const hand = getNextUpgradeHand();
  pendingUpgradeHand = hand;

  // Check if this is the level 1→2 transition where player chooses MAIN weapon
  if (needsMainWeaponChoice()) {
    // Show MAIN weapon selection (all except Standard Blaster - it's the default)
    console.log('[game] Level 1→2: Showing MAIN weapon selection');
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
    console.log(`[game] Showing upgrades for ${hand} hand (${mainWeaponId})`);
    pendingUpgrades = game.justBossKill ? 
      getRandomSpecialUpgrades(3, mainWeaponId) : 
      getRandomUpgrades(3, mainWeaponId);
  } else {
    // MAIN weapon not locked yet - show all upgrades (shouldn't happen after level 2)
    console.log(`[game] WARNING: MAIN weapon not locked for ${hand} hand at level ${game.level}`);
    pendingUpgrades = game.justBossKill ? getRandomSpecialUpgrades(3, mainWeaponId) : getRandomUpgrades(3, mainWeaponId);
  }

  showUpgradeCards(pendingUpgrades, getAdjustedCameraPosition(), hand);
  upgradeSelectionCooldown = 1.5; // prevent instant selection

  // Mark blaster displays for update
  blasterDisplays.forEach(d => { if (d) d.userData.needsUpdate = true; });
}

function clearPendingUpgradeState() {
  pendingUpgrades = [];
  pendingUpgradeHand = null;
}

function finalizeUpgradeSelection() {
  clearPendingUpgradeState();
  playUpgradeSound();
  hideUpgradeCards();
  advanceLevelAfterUpgrade();
}

function selectUpgradeAndAdvance(upgrade, hand) {
  console.log(`[game] Selected: ${upgrade.name} for ${hand} hand`);

  if (upgrade?.id === 'SKIP') {
    game.health = game.maxHealth;
    console.log('[game] Skipped upgrade, health restored to full');
    finalizeUpgradeSelection();
    return;
  }

  if (upgrade?.type === 'main') {
    console.log(`[game] Selected MAIN weapon: ${upgrade.id} for ${hand} hand`);
    setMainWeapon(upgrade.id, hand);
    finalizeUpgradeSelection();
    return;
  }

  if (upgrade?.type === 'alt') {
    console.log(`[game] Selected ALT weapon: ${upgrade.id} for ${hand} hand`);
    setAltWeapon(upgrade.id, hand);
    finalizeUpgradeSelection();
    return;
  }

  addUpgrade(upgrade.id, hand);

  if (upgrade?.id === 'extra_nuke') {
    game.nukes = (game.nukes || 0) + 1;
    console.log(`[nuke] Extra nuke granted. Total: ${game.nukes}`);
  }

  finalizeUpgradeSelection();
}

function advanceLevelAfterUpgrade() {
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
      game.state = State.BOSS_ALERT;
      game.stateTimer = 3.0; // 3 second alert sequence
      // Start boss music immediately at alert screen
      const bossCategory = `boss${game.level}`;
      playMusic(bossCategory);
      playBossAlertSound();
      showBossAlert();
      playIncomingBossSound();
      console.log(`[game] Boss alert for level ${game.level} - boss music started`);
      
      // Hide blaster displays during alert
      blasterDisplays.forEach(d => { if (d) d.visible = false; });
      
      game.justBossKill = false;
    }
    // After boss kill with biome transition, show ready screen with countdown
    else if (game.justBossKill && shouldFade) {
      console.log('[game] Boss killed with biome transition, showing ready screen');
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
      killsAlertShownThisLevel = false;
      const cfg = game._levelConfig;
      if (cfg && !cfg.isBoss) {
        const threshold = game.level >= 16 ? 20 : game.level >= 11 ? 15 : game.level >= 6 ? 10 : 5;
        killsAlertTriggerKill = cfg.killTarget - threshold;
        if (killsAlertTriggerKill <= 0) killsAlertTriggerKill = null;
      } else {
        killsAlertTriggerKill = null;
      }

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

function updatePauseCountdown(now) {
  if (!pauseCountdownActive) return;
  const elapsed = (now - pauseCountdownStartTime) / 1000;
  const remaining = PAUSE_COUNTDOWN_DURATION - elapsed;
  if (remaining <= 0) {
    pauseCountdownActive = false;
    pauseCountdown = 0;
    hidePauseCountdown();
    game.state = State.PLAYING;
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

function endGame(victory) {
  console.log(`[game] Game ${victory ? 'won' : 'over'} — score: ${game.score}`);
  resetAllSlowMoState();
  game.state = victory ? State.VICTORY : State.GAME_OVER;
  game.finalScore = game.score;
  game.finalLevel = game.level;
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

  // Stop music and play game over track
  stopMusic();
  stopLightningSound();

  if (victory) {
    showVictory(game.score, getAdjustedCameraPosition());
  } else {
    showGameOver(game.score, getAdjustedCameraPosition());
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
function triggerScreenShake(intensity, duration) {
  screenShakeIntensity = intensity;
  screenShakeTime = performance.now() + duration;
  console.log(`[Shake] Intensity: ${intensity}, Duration: ${duration}ms`);
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
function initProjectilePool() {
  if (instancedProjectiles['laser']) return;

  // ── Laser bolts (standard blaster) ──
  const laserGeo = new THREE.CylinderGeometry(0.04, 0.04, 1.0, 6);
  laserGeo.rotateX(Math.PI / 2);
  const laserMat = createProjectileMaterial(0x00ffff);
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
  const buckIM = new THREE.InstancedMesh(buckGeo, buckMat, 20);
  buckIM.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  buckIM.count = 0;
  buckIM.frustumCulled = false;
  buckIM.renderOrder = 950;
  scene.add(buckIM);
  instancedProjectiles['buckshot'] = { mesh: buckIM, maxCount: 20, freeIndices: new Set() };

  // ── Seeker burst bolts ──
  const seekerGeo = new THREE.SphereGeometry(0.06, 8, 8);
  const seekerMat = createProjectileMaterial(0xff8800);
  registerPlayerProjectileMaterial(seekerMat);
  const seekerIM = new THREE.InstancedMesh(seekerGeo, seekerMat, 28);
  seekerIM.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  seekerIM.count = 0;
  seekerIM.frustumCulled = false;
  seekerIM.renderOrder = 950;
  scene.add(seekerIM);
  instancedProjectiles['seeker'] = { mesh: seekerIM, maxCount: 28, freeIndices: new Set() };

  // ── Plasma carbine darts ──
  const plasmaGeo = new THREE.CylinderGeometry(0.05, 0.05, 0.5, 6);
  plasmaGeo.rotateX(Math.PI / 2);
  const plasmaMat = createProjectileMaterial(0x00ff88);
  registerPlayerProjectileMaterial(plasmaMat);
  const plasmaIM = new THREE.InstancedMesh(plasmaGeo, plasmaMat, 30);
  plasmaIM.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  plasmaIM.count = 0;
  plasmaIM.frustumCulled = false;
  plasmaIM.renderOrder = 950;
  scene.add(plasmaIM);
  instancedProjectiles['plasma_carbine'] = { mesh: plasmaIM, maxCount: 30, freeIndices: new Set() };

  Object.keys(projectileInstanceData).forEach(poolType => {
    const maxCount = instancedProjectiles[poolType].maxCount;
    for (let i = 0; i < maxCount; i++) {
      projectileInstanceData[poolType].push(null);
    }
  });

  console.log('[performance] InstancedMesh projectile pools initialized: laser(120), buckshot(20), seeker(28), plasma_carbine(30)');
}

// PERFORMANCE: Acquire an instance slot from the InstancedMesh pool.
// Returns { index, pool } or null if pool exhausted.
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
    commitProjectileInstance(poolType, instanceIndex, _projMatrix);
  };

  return proxy;
}

function commitProjectileInstance(poolType, instanceIndex, matrix) {
  const pool = instancedProjectiles[poolType];
  if (!pool) return;
  pool.mesh.setMatrixAt(instanceIndex, matrix);
  pool.mesh.instanceMatrix.needsUpdate = true;
}

// PERFORMANCE: Return projectile instance to pool (deactivate)
function returnProjectileToPool(proj) {
  if (!proj || !proj.userData) return;

  const poolType = proj.userData.poolType;
  const instanceIndex = proj.userData.instanceIndex;

  if (poolType && instanceIndex !== undefined && instancedProjectiles[poolType]) {
    const pool = instancedProjectiles[poolType];

    // Hide instance by scaling to zero
    _projMatrix.makeScale(0, 0, 0);
    commitProjectileInstance(poolType, instanceIndex, _projMatrix);

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

function isHostileProjectile(proj) {
  return !!(proj && proj.userData && (proj.userData.isBossProjectile || (proj.userData.damage && !proj.userData.stats)));
}

function triggerHostileProjectileExplosion(position, radius = 0.35, damage = 0) {
  const blastPos = position.clone();
  spawnExplosionVisual(blastPos, radius);
  if (typeof window !== 'undefined' && typeof window.createExplosionAt === 'function' && damage > 0) {
    window.createExplosionAt(blastPos, radius, damage);
  }
}

function spawnBossProjectileDestructionFX(position) {
  spawnExplosionVisual(position.clone(), 0.22);
  // Yellow bits matching projectile color, capped at 3 per projectile death
  spawnVoxelExplosion(position.clone(), 0xffff00, 3, 'basic', false, false);
}

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

function findSeekerTarget(proj) {
  const homingRange = proj.userData.homingRange || 0;
  if (homingRange <= 0) return null;

  const candidates = [];
  const enemies = getEnemies();
  for (const enemy of enemies) {
    if (enemy?.mesh) candidates.push(enemy.mesh);
  }

  const boss = getBoss();
  if (boss?.mesh) {
    candidates.push(boss.mesh);
  }

  let nearestTarget = null;
  let nearestDist = homingRange;
  for (const mesh of candidates) {
    const dist = mesh.position.distanceTo(proj.position);
    if (dist < nearestDist) {
      nearestDist = dist;
      nearestTarget = mesh;
    }
  }

  return nearestTarget;
}

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
// HOT PATH: updateVoxelPhysics() called every frame
// COUPLING: voxelPool, activeVoxels arrays, scene.add/remove
// ============================================================

// Pre-allocated temp vectors to avoid per-kill GC
const _deathVel = new THREE.Vector3();
const _spriteVel = new THREE.Vector3();

/**
 * Initialize voxel pool for physics-based death explosions
 */
function initVoxelPool() {
  const voxelGeo = new THREE.BoxGeometry(0.15, 0.15, 0.15);  // 40% smaller death voxels
  
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
  voxel.material.opacity = 1.0;
  voxel.scale.set(1, 1, 1);
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
  // Double voxels for overkill
  if (isOverkill) {
    voxelCount *= 2;
  }
  
  // Cap at 10 voxels per enemy to prevent spam
  voxelCount = Math.min(voxelCount, 8);
  
  // Make room by removing oldest voxels if at cap
  while (activeVoxels.length >= MAX_ACTIVE_VOXELS && activeVoxels.length > 0) {
    const oldest = activeVoxels.shift();
    returnVoxelToPool(oldest);
  }
  
  // Calculate available space in pool
  const availableVoxels = MAX_ACTIVE_VOXELS - activeVoxels.length;
  voxelCount = Math.min(voxelCount, availableVoxels);
  
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
    
    // Keep death voxels matched to the enemy's original color.
    voxel.material.color.setHex(color);
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
        return _deathVel.set(
          (Math.random() - 0.5) * 6,
          Math.random() * 4 + 2,
          (Math.random() - 0.5) * 6
        ).clone();
      }
    },
    tank: {
      calculateVelocity: (i, total) => {
        return _deathVel.set(
          (Math.random() - 0.5) * 2,
          Math.random() * 2 + 1,
          (Math.random() - 0.5) * 2
        ).clone();
      }
    },
    fast: {
      calculateVelocity: (i, total) => {
        return _deathVel.set(
          (Math.random() - 0.5) * 10,
          Math.random() * 6 + 3,
          (Math.random() - 0.5) * 10
        ).clone();
      }
    },
    swarm: {
      calculateVelocity: (i, total) => {
        return _deathVel.set(
          (Math.random() - 0.5) * 8,
          Math.random() * 5 + 2,
          (Math.random() - 0.5) * 8
        ).clone();
      }
    },
    boss: {
      calculateVelocity: (i, total) => {
        const angle = (i / total) * Math.PI * 2;
        const speed = 8 + Math.random() * 4;
        return _deathVel.set(
          Math.cos(angle) * speed,
          Math.random() * 8 + 4,
          Math.sin(angle) * speed
        ).clone();
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
  const floorY = 0;  // Fixed: use 0 for reliable floor collision (was -0.01 from floorMaterial)
  
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
// MAIN WEAPON FIRING
// fireMainWeapon, lightning beams, charge shots, plasma carbine
// HOT PATH: Called every frame when trigger held during PLAYING
// COUPLING: weaponCooldowns, chargeShotStartTime, projectiles[]
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

  // Debug logging for projectile investigation
  if (window.DEBUG_PROJECTILES) {
    const handLabel = index === 0 ? 'LEFT' : 'RIGHT';
  }

  // Fire projectile(s)
  const count = stats.projectileCount;
  const shotId = startAccuracyShot(count, hand);
  const isBuckshot = stats.spreadAngle > 0 && !stats.homing;

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
    for (let i = 0; i < count; i++) {
      let spawnOrigin = origin.clone();

      if (count > 1 && !isBuckshot) {
        // Position shots side-by-side with small gap, all parallel
        // Spread evenly around center: for 2 shots [-0.5, 0.5], for 3 [-1, 0, 1], etc.
        const offsetIndex = i - (count - 1) / 2;
        spawnOrigin.addScaledVector(rightAxis, offsetIndex * gap);
      }

      spawnProjectile(spawnOrigin, direction, index, stats, shotId, { suppressSound: false });
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
function updateLightningBeam(controller, index, stats, dt) {
  const origin = new THREE.Vector3();
  const quat = new THREE.Quaternion();
  controller.getWorldPosition(origin);
  controller.getWorldQuaternion(quat);
  const direction = new THREE.Vector3(0, 0, -1).applyQuaternion(quat);

  // Find enemies within range using spatial hash (O(1) lookup)
  const enemies = getEnemies();  // Still needed for index lookup
  const nearbyEnemies = enemySpatialHash.query(origin.x, origin.z, stats.lightningRange);
  const targets = [];
  const maxChains = 2 + Math.floor(stats.lightningRange / 8);  // More chains with upgrades

  for (const e of nearbyEnemies) {
    const dist = e.mesh.position.distanceTo(origin);
    const toEnemy = e.mesh.position.clone().sub(origin).normalize();
    const angle = toEnemy.dot(direction);

    // Within range and roughly in front (45° cone)
    if (dist < stats.lightningRange && angle > 0.7) {
      // Find enemy index for hitEnemy call
      const enemyIndex = enemies.indexOf(e);
      targets.push({ index: enemyIndex, enemy: e, dist });
    }
  }

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
          // Track multiplier increase for accuracy popup
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
          const destroyData = destroyEnemy(enemyIndex);
          if (destroyData) {
            game.kills++;
            trackKill();
            game.killsWithoutHit++;
            addScore(destroyData.scoreValue);

            // Update HUD immediately to show correct kill count before level complete check
            updateHUD(game);

            const cfg = game._levelConfig;

            // Check for kills remaining alert
            if (!killsAlertShownThisLevel && killsAlertTriggerKill && game.kills >= killsAlertTriggerKill) {
              const remaining = cfg ? cfg.killTarget - game.kills : 0;
              showKillsRemainingAlert(remaining);
              playKillsAlertSound(remaining);
              killsAlertShownThisLevel = true;
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

// Pooled temp vectors for lightning bolt generation (per-segment)
const _lightningDir = new THREE.Vector3();
const _lightningPerp = new THREE.Vector3();

// Create zigzag lightning bolt between two points
function createLightningBolt(start, end) {
  const points = [start.clone()];
  const segments = 8;
  const zigzagAmount = 0.15;

  for (let i = 1; i < segments; i++) {
    const t = i / segments;
    const mid = new THREE.Vector3().lerpVectors(start, end, t);

    // Random perpendicular offset
    _lightningDir.subVectors(end, start).normalize();
    _lightningPerp.set(-_lightningDir.z, 0, _lightningDir.x).normalize();
    const offset = _lightningPerp.clone().multiplyScalar((Math.random() - 0.5) * zigzagAmount);

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

/**
 * Get charge damage based on charge time (Mega Man style curve)
 * @param {number} t - charge time in seconds
 * @returns {number} damage value
 */
function chargeTimeToDamage(t) {
  // Clamp to max time
  const clampedT = Math.min(t, CHARGE_SHOT_MAX_TIME);

  // Use exponential ease-out for fast initial ramp, slow approach to max
  // Formula: min + (max - min) * (1 - e^(-k*t)) where k controls curve shape
  // k = 2 gives: ~63% of remaining damage in first second, then slower approach
  const k = 2.0;
  const progress = 1 - Math.exp(-k * clampedT);

  // Interpolate between min and max damage
  return CHARGE_SHOT_MIN_DAMAGE + (CHARGE_SHOT_MAX_DAMAGE - CHARGE_SHOT_MIN_DAMAGE) * progress;
}

/**
 * Get charge progress (0-1) for visual effects
 * Uses the same curve as damage for consistent feedback
 */
function chargeTimeToProgress(t) {
  const clampedT = Math.min(t, CHARGE_SHOT_MAX_TIME);
  const k = 2.0;
  return 1 - Math.exp(-k * clampedT);
}

/**
 * Create or update charge visual effects on controller
 * - Glowing sphere that gets brighter with charge
 * - Orbiting particles for Mega Man style charging
 * @param {THREE.Controller} controller - The controller
 * @param {number} index - Controller index (0=left, 1=right)
 * @param {number} progress - Charge progress from 0 to 1
 */
function updateChargeVisuals(controller, index, progress) {
  if (!controller || typeof controller.add !== 'function') return;

  // Initialize glow sphere if needed
  if (!chargeGlowSpheres[index]) {
    // Main glow sphere at controller tip
    const glowGeo = new THREE.SphereGeometry(0.05, 16, 16);
    const glowMat = new THREE.MeshBasicMaterial({
      color: 0x00ffff,
      transparent: true,
      opacity: 0.1,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const glowSphere = new THREE.Mesh(glowGeo, glowMat);
    glowSphere.position.set(0, 0, -0.1);  // In front of controller
    controller.add(glowSphere);
    chargeGlowSpheres[index] = glowSphere;

    // Create orbiting particles (8 small spheres in a ring)
    const particleGroup = new THREE.Group();
    const particleCount = 8;
    for (let i = 0; i < particleCount; i++) {
      const particleGeo = new THREE.SphereGeometry(0.015, 8, 8);
      const particleMat = new THREE.MeshBasicMaterial({
        color: 0x00ffff,
        transparent: true,
        opacity: 0.5,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      });
      const particle = new THREE.Mesh(particleGeo, particleMat);
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
  const color = new THREE.Color().lerpColors(
    new THREE.Color(0x00ffff),  // Cyan
    new THREE.Color(0xffffff),  // White
    progress
  );
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
function hideChargeVisuals(index) {
  if (chargeGlowSpheres[index]) {
    chargeGlowSpheres[index].visible = false;
  }
  if (chargeParticleSystems[index]) {
    chargeParticleSystems[index].visible = false;
  }
}

// Pooled temp vectors for pointToSegmentDist (hot path)
const _ptsAb = new THREE.Vector3();
const _ptsAp = new THREE.Vector3();
const _ptsProj = new THREE.Vector3();

/** Distance from point to line segment (a to b) */
function pointToSegmentDist(p, a, b) {
  _ptsAb.subVectors(b, a);
  _ptsAp.subVectors(p, a);
  const t = Math.max(0, Math.min(1, _ptsAp.dot(_ptsAb) / _ptsAb.lengthSq()));
  _ptsProj.copy(a).addScaledVector(_ptsAb, t);
  return p.distanceTo(_ptsProj);
}

const _chargeBeamA = new THREE.Vector3();
const _chargeBeamB = new THREE.Vector3();
const _playerForward = new THREE.Vector3();
const _chargeBeamOrigin = new THREE.Vector3();
const _chargeBeamQuat = new THREE.Quaternion();
const _chargeBeamDir = new THREE.Vector3(0, 0, -1);

function fireChargeBeam(controller, index, chargeTimeSec, stats) {
  if (chargeTimeSec < CHARGE_SHOT_MIN_FIRE) return; // minimum charge to fire

  // Use Mega Man style damage curve
  const damage = Math.round(chargeTimeToDamage(chargeTimeSec));
  const progress = chargeTimeToProgress(chargeTimeSec);

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
      const result = hitBoss(Math.round(damage), { isChargeCannon: true });

      // Shield reflection
      if (result.shieldReflected) {
        spawnDamageNumber(boss.mesh.position.clone(), 0, '#ff00ff');
        playHitSound();
        const dead = damagePlayer(1);
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
        if (!killsAlertShownThisLevel && killsAlertTriggerKill && game.kills >= killsAlertTriggerKill) {
          const cfg = game._levelConfig;
          const remaining = cfg ? cfg.killTarget - game.kills : 0;
          showKillsRemainingAlert(remaining);
          playKillsAlertSound(remaining);
          killsAlertShownThisLevel = true;
        }

        startBossDeathCinematic(boss);
      }
    }
  }

  // Check collision with boss projectiles (charge beam destroys them)
  const bossProjectiles = getBossProjectiles();
  if (bossProjectiles.length > 0) {
    for (let i = bossProjectiles.length - 1; i >= 0; i--) {
      const bossProj = bossProjectiles[i];
      if (!bossProj || !bossProj.mesh) continue;
      
      // Check if boss projectile intersects with beam line
      const dist = pointToSegmentDist(bossProj.mesh.position, _chargeBeamA, _chargeBeamB);
      if (dist < beamWidth + 0.3) { // Slightly larger collision radius
        // Destroy boss projectile with explosion effect
        spawnBossProjectileDestructionFX(bossProj.mesh.position.clone());
        if (bossProj._instIdx !== undefined) releaseBossProjIndex(bossProj._instIdx);
        bossProjectiles.splice(i, 1);
      }
    }
  }

  // Brief beam visual (cylinder) - color shifts from cyan to white based on charge
  // Visual width is thinner than hit detection for better aesthetics
  const visualBeamWidth = beamWidth * 0.3; // 30% of hit detection width
  
  // Color interpolates from cyan (low charge) to white (full charge)
  const beamColor = new THREE.Color().lerpColors(
    new THREE.Color(0x00ffff),  // Cyan at low charge
    new THREE.Color(0xffffff),  // White at full charge
    progress
  );
  
  // CORE BEAM: Always visible against all backgrounds (including bright terrain)
  // Uses normal blending with higher opacity - this ensures visibility regardless of
  // what's behind the beam. Critical for desert biome where additive-only beams vanish.
  const coreWidth = visualBeamWidth * 0.4; // 40% of outer glow width
  const coreGeo = new THREE.CylinderGeometry(coreWidth, coreWidth * 0.15, range, 6);
  const coreMat = new THREE.MeshBasicMaterial({
    color: beamColor,
    transparent: true,
    opacity: 0.9, // High opacity for visibility
    side: THREE.DoubleSide,
    depthWrite: false,
    blending: THREE.NormalBlending, // Normal blending ensures visibility on bright terrain
  });
  const coreMesh = new THREE.Mesh(coreGeo, coreMat);
  coreMesh.position.copy(_chargeBeamOrigin).addScaledVector(_chargeBeamDir, range * 0.5);
  coreMesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), _chargeBeamDir);
  coreMesh.userData.createdAt = performance.now();
  coreMesh.userData.duration = 200;
  coreMesh.userData.isChargeBeamCore = true; // Distinguish from glow for animation
  coreMesh.userData.pulsePhase = 0;
  coreMesh.userData.maxOpacity = 0.9;
  coreMesh.renderOrder = 100; // Render after terrain
  scene.add(coreMesh);
  explosionVisuals.push(coreMesh);
  
  // OUTER GLOW: Additive blending for neon aesthetic
  // This creates the signature glow effect but alone can vanish against bright terrain
  const beamGeo = new THREE.CylinderGeometry(visualBeamWidth, visualBeamWidth * 0.1, range, 8); // Tapers toward horizon
  const beamMat = new THREE.MeshBasicMaterial({
    color: beamColor,
    transparent: true,
    opacity: 0.7,
    side: THREE.DoubleSide,
    depthWrite: false,
    blending: THREE.AdditiveBlending,  // Glow effect
  });
  const beamMesh = new THREE.Mesh(beamGeo, beamMat);
  beamMesh.position.copy(_chargeBeamOrigin).addScaledVector(_chargeBeamDir, range * 0.5);
  beamMesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), _chargeBeamDir);
  beamMesh.userData.createdAt = performance.now();
  beamMesh.userData.duration = 200; // Longer duration for fade effect
  beamMesh.userData.isChargeBeam = true;
  beamMesh.userData.pulsePhase = 0; // For pulse animation
  beamMesh.userData.maxOpacity = 0.7;
  beamMesh.renderOrder = 101; // Render just after core
  scene.add(beamMesh);
  explosionVisuals.push(beamMesh);
}

function spawnProjectile(origin, direction, controllerIndex, stats, shotId, options = {}) {
  // PERFORMANCE: Recycle oldest projectile when at cap to keep fire continuous
  if (projectiles.length >= MAX_PROJECTILES) {
    const recycled = projectiles.shift();
    if (recycled) {
      returnProjectileToPool(recycled);
    }
  }

  const now = performance.now();
  const color = controllerIndex === 0 ? NEON_CYAN : NEON_PINK;
  // Use spread threshold: only treat as buckshot if spread > 5 degrees (0.087 rad)
  // This prevents plasma carbine (1.5 deg spread) from being treated as buckshot
  const BUCKSHOT_SPREAD_THRESHOLD = 0.087; // ~5 degrees
  const isBuckshot = (stats.spreadAngle || 0) > BUCKSHOT_SPREAD_THRESHOLD && !stats.homing;
  const isPlasmaCarbine = stats.mainWeaponId === 'plasma_carbine';
  const poolType = stats.homing ? 'seeker' : (isPlasmaCarbine ? 'plasma_carbine' : (isBuckshot ? 'buckshot' : 'laser'));
  
  // Seeker color override: bright orange instead of controller-based cyan/pink
  const projectileColor = stats.homing ? 0xff8800 : color;

  // Debug logging for projectile investigation
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
  mesh.userData.homingRange = stats.homing ? (stats.homingRange || 15) : 0;
  mesh.userData.homingStrength = stats.homing ? 15 : 0;
  mesh.userData.baseSpeed = projectileSpeed;
  mesh.userData.homingTarget = null;
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

function lerp(a, b, t) {
  return a + (b - a) * t;
}

function handleHit(enemyIndex, enemy, stats, hitPoint, controllerIndex, isExploding = false, hitWeakPoint = false, hitInfo = {}) {
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
  const isCritical = damage > 30 || hitWeakPoint;
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

    console.log(`[Impact] CRITICAL HIT! Damage: ${Math.round(damage)}, Freeze: ${freezeDuration}ms`);
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
      trackKill();
      game.killsWithoutHit++;
      addScore(destroyData.scoreValue);

      // Update HUD immediately to show correct kill count before level complete check
      updateHUD(game);

      // KILL CHAIN SYSTEM
      const now = performance.now();

      // Check combo timeout
      if (now - game.lastKillTime > game.comboResetTime) {
        game.comboCount = 0;
        game.comboMultiplier = 1;
      }

      // Increment combo (for internal tracking, but popups are now accuracy-based)
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

      // NOTE: Popups are now accuracy-based, not kill-chain based
      // Accuracy popups are triggered in markAccuracyHit() when multiplier increases

      const cfg = game._levelConfig;

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
        console.log('[vampiric] Healed 1 HP');
        spawnHealthGainPopup(destroyData.position);  // Spawn +💖 popup at enemy position
        playHealSound();  // Play healing sound
      }

      // Check for kills remaining alert
      if (!killsAlertShownThisLevel && killsAlertTriggerKill && game.kills >= killsAlertTriggerKill) {
        const remaining = cfg ? cfg.killTarget - game.kills : 0;
        showKillsRemainingAlert(remaining);
        playKillsAlertSound(remaining);
        killsAlertShownThisLevel = true;
      }

      // Check level complete
      if (cfg && game.kills >= cfg.killTarget) {
        completeLevel();
      }
    }
  }
}

function handleBossHit(boss, stats, hitPoint, controllerIndex, handIndex) {
  let damage = stats.damage;
  if (stats.critChance > 0 && Math.random() < stats.critChance) {
    damage *= (stats.critMultiplier || 2);
    trackCrit();
  }
  const result = hitBoss(damage, { handIndex });

  // Shield reflection: damage player instead of boss
  if (result.shieldReflected) {
    spawnDamageNumber(hitPoint, 0, '#ff00ff');  // Show 0 damage in magenta
    playHitSound();
    const dead = damagePlayer(1);
    triggerHitFlash(true);
    playDamageSound();
    cameraShake = 0.3;
    cameraShakeIntensity = 0.03;
    originalCameraPos.copy(camera.position);

    // Light screen shake on player damage
    triggerScreenShake(0.15, 500); // 0.15 shake for 500ms

    floorFlashing = true;
    floorFlashTimer = 1.0;
    console.log('[boss] Shield reflected damage!');
    if (dead) endGame(false);
    return;
  }

  // Immune hit (e.g., skull boss head before hands destroyed)
  if (result.immune) {
    spawnDamageNumber(hitPoint, 0, '#aaaaaa');  // Show 0 damage in gray
    playTingSound();  // Metallic ping sound
    console.log('[boss] Hit was immune!');
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
    if (!killsAlertShownThisLevel && killsAlertTriggerKill && game.kills >= killsAlertTriggerKill) {
      const cfg = game._levelConfig;
      const remaining = cfg ? cfg.killTarget - game.kills : 0;
      showKillsRemainingAlert(remaining);
      playKillsAlertSound(remaining);
      killsAlertShownThisLevel = true;
    }

    startBossDeathCinematic(boss);
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
  // Play explosion sound
  playExplosionSound();

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

// Pooled temp vectors for projectile hot paths (per-frame allocations)
const _projHomingDesired = new THREE.Vector3();
const _projHomingQuatDir = new THREE.Vector3(0, 0, -1);
const _projHomingVelNorm = new THREE.Vector3();
const _hostileProjDesired = new THREE.Vector3();
const _hostileProjCurrent = new THREE.Vector3();
const _hostileProjSide = new THREE.Vector3();
const _projectileRayDir = new THREE.Vector3();
const _projectileNearbyMeshes = [];

// ============================================================
// PROJECTILE UPDATE LOOP
// Movement, homing, hostile projectiles, collision detection
// HOT PATH: Called every frame from render()
// COUPLING: projectiles[], instancedProjectiles, enemies spatial hash
// RISK: Changes here affect hit detection, game feel, performance
// ============================================================
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
      // Check if this is a hostile projectile
      if (proj.userData && proj.userData.damage && proj.userData.direction) {
        const age = now - proj.userData.createdAt;
        if (age > proj.userData.duration) {
          triggerHostileProjectileExplosion(proj.position, 0.3, 0);
          scene.remove(proj);
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
            damagePlayer(proj.userData.damage);
          }
          triggerHostileProjectileExplosion(proj.position, 0.4, 0);
          scene.remove(proj);
          disposeObject3D(proj);
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
        scene.remove(proj);
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
      const targetStillValid = targetMesh && targetMesh.parent && targetMesh.position.distanceTo(proj.position) <= proj.userData.homingRange;
      if (!targetStillValid) {
        targetMesh = findSeekerTarget(proj);
        proj.userData.homingTarget = targetMesh || null;
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
        proj.quaternion.setFromUnitVectors(_projHomingQuatDir, _projHomingVelNorm);
      }
      updateSeekerProjectileVisual(proj, adjustedDt);
    }

    // Move projectile (apply stasis slow effect)
    const moveDistance = proj.userData.velocity.length() * adjustedDt;
    _dreamPrevProjectilePos.copy(proj.position);
    proj.position.addScaledVector(proj.userData.velocity, adjustedDt);

    // Commit position to InstancedMesh (sync GPU buffer)
    if (proj.commit) {
      proj.commit();
    }

    // Check if projectile passes through nanite swarm and gains nanite damage
    checkProjectileNaniteInteraction(proj);

    // Secret dream trigger: shoot the hidden object behind spawn to enter dream mode.
    // Use segment-vs-sphere test so high-speed shots still register.
    if (proj.userData.stats && !game.inDreamWorld && didProjectileHitDreamTrigger(_dreamPrevProjectilePos, proj.position)) {
      markProjectileHit(proj);
      resolveProjectileAccuracy(proj);
      if (proj.userData.isPooled) {
        returnProjectileToPool(proj);
      } else {
        scene.remove(proj);
        disposeObject3D(proj);
      }
      projectiles.splice(i, 1);
      triggerDreamWorldFromSecret();
      continue;
    }

    // Dream-world interactions (torches can be lit by shooting them).
    if (proj.userData.stats && game.inDreamWorld && handleDreamProjectileHit(proj)) {
      markProjectileHit(proj);
      resolveProjectileAccuracy(proj);
      if (proj.userData.isPooled) {
        returnProjectileToPool(proj);
      } else {
        scene.remove(proj);
        disposeObject3D(proj);
      }
      projectiles.splice(i, 1);
      continue;
    }

    // Check collision with plasma orbs (player can shoot orbs to detonate early)
    if (checkPlasmaOrbDetonation(proj)) {
      markProjectileHit(proj);
      resolveProjectileAccuracy(proj);
      if (proj.userData.isPooled) {
        returnProjectileToPool(proj);
      } else {
        scene.remove(proj);
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
        scene.remove(proj);
        disposeObject3D(proj);
      }
      projectiles.splice(i, 1);
      continue;
    }

    // Check collision with enemies
    // PERFORMANCE: Use spatial hash to shrink candidate set before raycasting.
    const projPos = proj.position;
    const broadRadius = moveDistance * 2 + 1.5; // Move distance + max hitbox radius
    const hashRadius = broadRadius + 3;
    _projectileNearbyMeshes.length = 0;
    const hashed = enemySpatialHash.query(projPos.x, projPos.z, hashRadius);
    for (let ei = 0; ei < hashed.length; ei++) {
      const enemy = hashed[ei];
      if (!enemy || !enemy.mesh) continue;
      const dx = projPos.x - enemy.mesh.position.x;
      const dy = projPos.y - enemy.mesh.position.y;
      const dz = projPos.z - enemy.mesh.position.z;
      const distSq = dx * dx + dy * dy + dz * dz;
      const r = (enemy.hitboxRadius || 1) + broadRadius;
      if (distSq < r * r) {
        _projectileNearbyMeshes.push(enemy.mesh);
      }
    }

    // Also check active boss (bosses are not in regular enemies array)
    const boss = getBoss();
    if (boss && boss.mesh) {
      const dx = projPos.x - boss.mesh.position.x;
      const dy = projPos.y - boss.mesh.position.y;
      const dz = projPos.z - boss.mesh.position.z;
      const distSq = dx * dx + dy * dy + dz * dz;
      if (distSq < (broadRadius + 3) * (broadRadius + 3)) {
        _projectileNearbyMeshes.push(boss.mesh);
      }
    }

    // Also check boss minions (orange minions spawned by bosses)
    const bossMinionMeshes = getBossMinionMeshes();
    if (bossMinionMeshes.length > 0) {
      for (let mi = 0; mi < bossMinionMeshes.length; mi++) {
        const minionMesh = bossMinionMeshes[mi];
        if (!minionMesh) continue;
        const dx = projPos.x - minionMesh.position.x;
        const dy = projPos.y - minionMesh.position.y;
        const dz = projPos.z - minionMesh.position.z;
        const distSq = dx * dx + dy * dy + dz * dz;
        if (distSq < (broadRadius + 1) * (broadRadius + 1)) {
          _projectileNearbyMeshes.push(minionMesh);
        }
      }
    }

    let hits = [];
    if (_projectileNearbyMeshes.length > 0) {
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
      _uiRaycaster.set(proj.position, _projectileRayDir);
      hits = _uiRaycaster.intersectObjects(_projectileNearbyMeshes, true);
    }

    if (hits.length > 0 && hits[0].distance < moveDistance * 2) {
      const result = getEnemyByMesh(hits[0].object);
      if (result && result.boss) {
        markProjectileHit(proj);
        handleBossHit(result.boss, proj.userData.stats, hits[0].point, proj.userData.controllerIndex, result.handIndex);
        if (!proj.userData.stats?.piercing) {
          resolveProjectileAccuracy(proj);
          if (proj.userData.isPooled) {
            returnProjectileToPool(proj);
          } else {
            scene.remove(proj);
            disposeObject3D(proj);
          }
          projectiles.splice(i, 1);
        }
      } else if (result && result.index !== undefined && !proj.userData.hitEnemies.has(result.index)) {
        proj.userData.hitEnemies.add(result.index);
        const hitObj = hits[0].object;
        const hitWeakPoint = hitObj.userData && hitObj.userData.weakPoint === true;
        const hitInfo = {
          trainIndex: hitObj.userData?.trainIndex,
          isScout: hitObj.userData?.isScout,
          hitObject: hitObj,
        };

        // Check if projectile is nanite-infused (passed through nanite swarm)
        const naniteDamage = proj.userData.naniteInfused ? 5 : 0;

        // Apply nanite damage and reveal enemy
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
        handleHit(result.index, result.enemy, { ...proj.userData.stats, damage: proj.userData.stats.damage + naniteDamage }, hits[0].point, proj.userData.controllerIndex, proj.userData.isExploding, hitWeakPoint, hitInfo);

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
            disposeObject3D(proj);
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
              disposeObject3D(proj);
            }
            projectiles.splice(i, 1);
          }
        }
      }
    }
    
    // Check collision with boss projectiles (player can shoot them down)
    // Boss projectiles should NOT collide with other boss projectiles - only with player
    if (proj.userData.stats && !proj.userData.isBossProjectile) { // Only player projectiles, exclude boss projectiles
      const bossProjs = getBossProjectiles();
      if (bossProjs.length > 0) {
        for (let j = bossProjs.length - 1; j >= 0; j--) {
          const bossProj = bossProjs[j];
          if (!bossProj || !bossProj.mesh) continue;
          const dist = proj.position.distanceTo(bossProj.mesh.position);
          if (dist < 0.5) {
            spawnBossProjectileDestructionFX(bossProj.mesh.position.clone());
            if (bossProj._instIdx !== undefined) releaseBossProjIndex(bossProj._instIdx);
            bossProjs.splice(j, 1);

            if (!proj.userData.stats?.piercing) {
              markProjectileHit(proj);
              resolveProjectileAccuracy(proj);
              if (proj.userData.isPooled) {
                returnProjectileToPool(proj);
              } else {
                scene.remove(proj);
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
          const dist = proj.position.distanceTo(bossProj.position);
          if (dist < 0.5) { // Collision radius
            // Destroy hostile projectile with a small blast
            triggerHostileProjectileExplosion(bossProj.position.clone(), 0.35, 0);
            markProjectileHit(proj);
            
            // If it's a decoy, explode it
            if (bossProj.userData.isDecoy && typeof window !== 'undefined' && window.createExplosionAt) {
              window.createExplosionAt(bossProj.position.clone(), bossProj.userData.explosionRadius, bossProj.userData.explosionDamage);
            }
            
            scene.remove(bossProj);
            disposeObject3D(bossProj);
            projectiles.splice(j, 1);
            
            // Destroy player projectile (unless piercing)
            if (!proj.userData.stats?.piercing) {
              markProjectileHit(proj);
              resolveProjectileAccuracy(proj);
              if (proj.userData.isPooled) {
                returnProjectileToPool(proj);
              } else {
                scene.remove(proj);
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
            const dist = proj.position.distanceTo(visual.position);
            if (dist < 1.0) { // Larger radius for area effects
              // Destroy the visual
              spawnExplosionVisual(visual.position.clone(), 0.3);
              scene.remove(visual);
              disposeObject3D(visual);
              explosionVisuals.splice(k, 1);
              markProjectileHit(proj);
              
              // Destroy player projectile (unless piercing)
              if (!proj.userData.stats?.piercing) {
                resolveProjectileAccuracy(proj);
                if (proj.userData.isPooled) {
                  returnProjectileToPool(proj);
                } else {
                  scene.remove(proj);
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

function selectUpgrade(controller) {
  if (upgradeSelectionCooldown > 0) return;

  const origin = new THREE.Vector3();
  const quat = new THREE.Quaternion();
  controller.getWorldPosition(origin);
  controller.getWorldQuaternion(quat);
  const direction = new THREE.Vector3(0, 0, -1).applyQuaternion(quat);
  _uiRaycaster.set(origin, direction, 0, 10);
  const result = getUpgradeCardHit(_uiRaycaster);

  if (result) {
    selectUpgradeAndAdvance(result.upgrade, result.hand);
  }
}

// ============================================================
// ENEMY WAVE SPAWNING
// spawnEnemyWave, fast enemy proximity alerts
// Called every frame during PLAYING state
// COUPLING: game._levelConfig, getBoss/spawnBoss, enemies.js
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
// RENDER LOOP (THE BIG ONE)
// Core game loop: time scaling, state machine, all subsystems
// HOT PATH: Called every frame (60fps target)
// SUB-SECTIONS: Title, Playing, Boss Death Cinematic, Paused,
//   Ready Screen, Boss Alert, Level Complete, Upgrade Select,
//   Game Over/Victory, UI Hover, Universal Updates
// COUPLING: Reads/writes game.state, calls ALL update functions
// RISK: Any change here affects frame timing, game feel, audio sync
// ============================================================
function render(timestamp) {
  frameCount++;
  const now = timestamp || performance.now();
  const rawDt = Math.min((now - lastTime) / 1000, 0.1);
  // Fix B: Cap delta time for game simulation to prevent enemies warping during frame spikes
  const MAX_FRAME_DT = 0.033; // ~30 FPS cap — enemies can never advance more than 33ms per frame
  const clampedRawDt = Math.min(rawDt, MAX_FRAME_DT);
  lastTime = now;

  // ── Frame profiler (debug/test only) ──
  const _prof = (typeof window !== 'undefined' && window.__perf && window.__perf._profileBuckets) ? window.__perf._profileBuckets : null;
  let _lastMark = _prof ? performance.now() : 0;
  const _mark = _prof ? (name) => { const t = performance.now(); _prof[name] = (_prof[name] || 0) + (t - _lastMark); _lastMark = t; } : () => {};
  if (_prof) { _prof._frames = (_prof._frames || 0) + 1; _prof._wallTotal = (_prof._wallTotal || 0) + (now - (_prof._prevFrameNow || now)); _prof._prevFrameNow = now; }

  // PERFORMANCE: Log stats every 5 seconds in debug mode
  if (typeof window !== 'undefined' && window.debugPerfMonitor && frameCount % 300 === 0) {
    const instancedCounts = Object.entries(instancedProjectiles).map(([t, p]) => `${t}:${p.mesh.count}/${p.maxCount}`).join(', ');
    console.log(`[PERF] Projectiles: ${projectiles.length}/${MAX_PROJECTILES}, ` +
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
      console.log('[slow-mo] Death sequence ended');
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

  if (currentTheme) {
    updateAmbientParticles(rawDt, currentTheme, getAdjustedCameraPosition());
  }
  updateBiomeProps(now, rawDt);
  _mark('ambient_biome'); // ── end: ambient particles + biome props

  // Update player-following point light
  if (biomePointLight && camera) {
    biomePointLight.position.copy(camera.position);
    biomePointLight.position.y += 0.5;
  }

  // Process seeker burst queue (burst fire timing)
  processSeekerBurstQueue(now);

  // Fix 1.9: Profile desktop controls update
  if (!renderer.xr.isPresenting) {
    updateDesktopControls(dt);
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
    if (typeof window !== 'undefined' && window.debugJumpToLevel) {
      const level = window.debugJumpToLevel;
      window.debugJumpToLevel = null;
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

    if (!game.inDreamWorld) {
      spawnEnemyWave(dt);
    } else {
      const dreamState = updateDreamWorld(now, dt, getAdjustedCameraPosition());
      if (dreamState?.exit) {
        completeDreamWorldRun();
      }
    }

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
            const progress = chargeTimeToProgress(chargeTimeSec);
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
          scene.remove(lightningBeams[i]);
          lightningBeams[i] = null;
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
                const progress = chargeTimeToProgress(chargeTimeSec);
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
                const progress = chargeTimeToProgress(chargeTimeSec);
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
          scene.remove(lightningBeams[0]);
          lightningBeams[0] = null;
        }
        if (lightningBeams[1]) {
          scene.remove(lightningBeams[1]);
          lightningBeams[1] = null;
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
        console.log('[bullet-time] ENDED');
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
        console.log('[bullet-time] RAMP OUT — enemies cleared');
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
          if (p.mesh && p.mesh.position.distanceTo(playerPos) < SLOW_MO_TRIGGER_DIST) {
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
          console.log('[bullet-time] RAMP OUT — enemies cleared');
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
          console.log('[bullet-time] ACTIVATED!');
          break;
        }
      }
      if (!slowMoActive) {
        const bossProjs = getBossProjectiles();
        for (const proj of bossProjs) {
          const dist = proj.mesh.position.distanceTo(playerPos);
          if (dist < SLOW_MO_TRIGGER_DIST) {
            slowMoActive = true;
            slowMoDuration = 2.5;
            console.log('[bullet-time] ACTIVATED!');
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
            console.log('[bullet-time] ACTIVATED!');
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
    const collisions = updateEnemies(dt, now, playerPos);

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
    const boss = getBoss();
    if (boss) {
      updateBoss(dt, now, playerPos);
      updateBossMinions(dt, playerPos);
      showBossHealthBar(boss.hp, boss.maxHp, boss.phases);
      updateBossHealthBar(boss.hp, boss.maxHp, boss.phases);

      // Check if boss was killed
      if (boss.hp <= 0) {
        console.log(`[boss] Boss defeated!`);
        startBossDeathCinematic(boss);
      }
    } else {
      hideBossHealthBar();
    }
    _mark('boss_update'); // ── end: boss updates + minions + health bar

    // Fix 1.9: Profile player collision handling
    // Handle enemy collisions with player
    collisions.forEach(index => {
      destroyEnemy(index);
      const dead = damagePlayer(1);
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
    const bossMinionMeshes = getBossMinionMeshes();
    if (bossMinionMeshes.length > 0) {
      const now2 = performance.now();
      for (let mi = 0; mi < bossMinionMeshes.length; mi++) {
        const minionMesh = bossMinionMeshes[mi];
        if (!minionMesh) continue;
        if (minionMesh.position.distanceTo(playerPos) < 1.0) {
          if (!minionMesh.userData._lastContactHit || now2 - minionMesh.userData._lastContactHit >= 1200) {
            minionMesh.userData._lastContactHit = now2;
            const dead = damagePlayer(1);
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
      if (proj.mesh && !proj._warned && proj.mesh.position.distanceTo(playerPos) < 4.0) {
        playProjectileWarningSound();
        proj._warned = true;
      }

      if (!proj.hitPlayer) continue;

      // Check if reflector drone can reflect this projectile
      if (checkReflectorDroneReflection(proj.mesh.position, true)) {
        // Projectile was reflected - remove it without damaging player
        if (proj._instIdx !== undefined) releaseBossProjIndex(proj._instIdx);
        bossProjs.splice(i, 1);
        continue;
      }

      triggerHostileProjectileExplosion(proj.mesh.position.clone(), 0.35, 0);
      if (proj._instIdx !== undefined) releaseBossProjIndex(proj._instIdx);
      bossProjs.splice(i, 1);

      const dead = damagePlayer(proj.damage || 1);
      triggerHitFlash(true);
      playDamageSound();
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
          const destroyData = destroyEnemy(i);
          if (destroyData) {
            game.kills++;
            trackKill();
            game.killsWithoutHit++;
            addScore(destroyData.scoreValue);

            // Update HUD immediately to show correct kill count before level complete check
            updateHUD(game);

            // KILL CHAIN SYSTEM (same as handleHit)
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

            // NOTE: Popups are now accuracy-based, not kill-chain based
            // Accuracy popups are triggered in markAccuracyHit() when multiplier increases

            const cfg = game._levelConfig;

            // Check for kills remaining alert
            if (!killsAlertShownThisLevel && killsAlertTriggerKill && game.kills >= killsAlertTriggerKill) {
              const remaining = cfg ? cfg.killTarget - game.kills : 0;
              showKillsRemainingAlert(remaining);
              playKillsAlertSound(remaining);
              killsAlertShownThisLevel = true;
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
      // Boss music already started in advanceLevelAfterUpgrade
      console.log(`[game] Boss fight starting at level ${game.level}`);
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
    upgradeSelectionCooldown = Math.max(0, upgradeSelectionCooldown - dt);
    updateUpgradeCards(now, upgradeSelectionCooldown);

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
    updateHolographicGlitch(now);
  }

  // ── Unified UI hover detection for all menu states ──
  if (st === State.TITLE || st === State.UPGRADE_SELECT || st === State.SCOREBOARD || 
      st === State.REGIONAL_SCORES || st === State.COUNTRY_SELECT || st === State.READY_SCREEN ||
      st === State.NAME_ENTRY) {
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
      raycasters.push(rc);
    }
    // Also add desktop aim raycaster if available
    if (isDesktopEnabled()) {
      const desktopRC = getAimRaycaster();
      if (desktopRC) raycasters.push(desktopRC);
    }
    // Add keyboard hover raycaster if name entry is visible
    if (nameEntryGroup.visible) {
      const keyboardRC = getAimRaycaster();
      if (keyboardRC) raycasters.push(keyboardRC);
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
  } else if (!shouldLowHealthWarn && lowHealthWarningActive) {
    lowHealthWarningActive = false;
    lowHealthPulseTimer = 0;
    stopLowHealthWarningSound();
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
      // Reset grid colors
      if (gridHelper && gridHelper.visible) {
        const resetGridMat = (m) => { m.color.setHex(NEON_PINK); };
        if (Array.isArray(gridHelper.material)) {
          gridHelper.material.forEach(resetGridMat);
        } else {
          resetGridMat(gridHelper.material);
        }
      }
    } else {
      // Lerp from bright red back to base color over 1 second
      const t = floorFlashTimer / 1.0;  // 1s flash duration
      const flashIntensity = t;  // 0 to 1, fading out
      const flashColor = new THREE.Color(0xff0000);
      // Flash terrain materials
      biomeTerrainMaterials.forEach(item => {
        if (item.type === 'shader') {
          item.material.uniforms.uFlashIntensity.value = flashIntensity * 0.5;  // Max 50% red
        } else {
          item.material.opacity = flashIntensity * 0.4;  // Max 40% opacity
        }
      });
      // Flash grid to red
      if (gridHelper && gridHelper.visible) {
        const flashGridMat = (m) => {
          const baseColor = new THREE.Color(NEON_PINK);
          m.color.lerpColors(baseColor, flashColor, t);
        };
        if (Array.isArray(gridHelper.material)) {
          gridHelper.material.forEach(flashGridMat);
        } else {
          flashGridMat(gridHelper.material);
        }
      }
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

  // ── Environment: sun stays constant size (removed level scaling) ──
  // Sun scaling removed - was old progression system
  // Biomes will handle environment changes instead
  
  // Update aurora borealis animation
  updateAurora(rawDt, now);
  
  if (ominousRef) {
    if (game.level >= 10 && game.state === State.PLAYING) {
      const t = Math.min(1, (game.level - 10) / 6); // 0 at 10, 1 at 16
      ominousRef.visible = true;
      // Start very subtle (0.08) and ramp to 0.5 at level 16
      // so it doesn't look like a black wall on first appearance
      ominousRef.material.opacity = 0.08 + t * 0.42;
      ominousRef.scale.setScalar(0.5 + t * 1.2);
    } else {
      ominousRef.visible = false;
    }
  }

  _mark('state_dispatch'); // ── end: state_dispatch (PLAYING/TITLE/PAUSE logic)
  // ── Universal updates ──
  updateProjectiles(dt);
  updateVoxelPhysics(dt, now);  // PHYSICS DEATH SYSTEM
  if (activeShields.length > 0) updateShields(now);
  if (activeStasisFields.length > 0) updateStasisFields(now, dt);
  if (activePlasmaOrbs.length > 0) updatePlasmaOrbs(now, dt);
  updateExplosions(dt, now);
  updateVFX(dt);
  if (explosionVisuals.length > 0) updateExplosionVisuals(dt, now);
  updateDamageNumbers(dt, now);
  updateStatusBubbles(dt, now);
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
    perfMonitor: (typeof window !== 'undefined' && window.debugPerfMonitor) || game.debugPerfMonitor,
    frameTimeMs: rawDt * 1000,
    rendererInfo: renderer.info,
  });

  // Hide scanlines overlay in VR — it creates a dark box that follows the head and obscures the view
  // Fix 1.3: Use cached element instead of per-frame query
  if (_cachedScanlinesEl) _cachedScanlinesEl.style.display = renderer.xr.isPresenting ? 'none' : '';

  _mark('scanlines_misc'); // ── end: FPS, scanlines DOM
  // Fix 1.4: Gate visual tuning behind debug flag to avoid per-frame object allocation + material iteration
  // Only run when debug panel is open or visual tuning has changed
  const visualTuning = (window.debugPerfMonitor || game.debugPerfMonitor) ? getVisualTuning() : null;
  if (visualTuning) {
    applyVisualTuning(visualTuning);
    updateVHSRetroShell(now, visualTuning);
  }
  updateDreamTriggerVisual(now);
  _mark('visual_tuning'); // ── end: applyVisualTuning + updateVHSRetroShell + updateDreamTriggerVisual

  // Update pause countdown BEFORE any early-return render path so desktop debug
  // effects never freeze the countdown.
  updatePauseCountdown(now);

  maybeRecordTelemetry(now, rawDt, dt);
  _mark('telemetry'); // ── end: maybeRecordTelemetry

  // Desktop-only debug effects. XR intentionally keeps the default renderer path.
  // Fix 1.4: visualTuning may be null when debug mode is off
  if (!renderer.xr.isPresenting && visualTuning && renderDesktopDebugEffect(visualTuning)) {
    _mark('render_gpu'); _mark('total');
    return;
  }

  renderer.render(scene, camera);
  _mark('render_gpu'); _mark('total');
}

// ============================================================
//  PERFORMANCE TELEMETRY SUPPORT
// ============================================================
function shouldCollectTelemetrySample() {
  if (!renderer) return false;
  // Always sample at 1/6 rate (every 6th frame) even when enabled,
  // to keep telemetry overhead under 1ms per frame.
  if (frameCount % 6 !== 0) return false;
  if (isTelemetryEnabled()) return true;
  if (game.debugPerfMonitor) return true;
  if (typeof window !== 'undefined' && window.debugPerfMonitor) return true;
  return false;
}

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

function collectRuntimeCounts() {
  const instancedStats = {};
  Object.entries(instancedProjectiles).forEach(([key, pool]) => {
    instancedStats[key] = {
      active: pool.mesh ? pool.mesh.count : 0,
      max: pool.maxCount || 0,
      free: pool.freeIndices ? pool.freeIndices.size : 0,
    };
  });

  const bossMinionMeshes = typeof getBossMinionMeshes === 'function' ? getBossMinionMeshes() : null;

  return {
    enemies: getEnemyCount(),
    bossActive: !!getBoss(),
    bossProjectiles: getBossProjectiles().length,
    bossMinions: bossMinionMeshes ? bossMinionMeshes.length : 0,
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
    inDreamWorld: game.inDreamWorld,
    dreamCompleted: game.dreamCompleted,
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
    updateAuroraColors,
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
function getBiomeFloorY() {
  return getBiomeFloorYModule(biomeSceneBiome, SCENE_Y_OFFSET);
}
