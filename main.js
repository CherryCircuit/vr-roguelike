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
import { State, game, resetGame, getLevelConfig, getBossTier, getRandomBossIdForLevel, addScore, registerAccuracyHit, registerAccuracyMiss, damagePlayer, addUpgrade, setMainWeapon, setAltWeapon, getNextUpgradeHand, needsMainWeaponChoice, LEVELS, loadDebugSettings, saveDebugSettings, startGameWithSeed, getBiomeForLevel, trackKill, trackShot, trackShotHit, trackCrit, registerResetHook, setWeaponEvolution, getWeaponEvolution, isWeaponEvolved } from './game.js';
import { getRandomUpgrades, getRandomSpecialUpgrades, getUpgradeDef, getWeaponStats, MAIN_WEAPONS, ALT_WEAPONS, getMainWeapon, getAltWeapon, detectSynergies, getEssenceValue, getForgeUpgrade, ALCHEMY_FORGE_COST, checkEvolutionReady, getEvolutionForWeapon, getEvolutionProgress, detectFireCombos, computeStyleGrade, COMBO_DEFS } from './weapons.js';
import {
  playShoothSound, playHitSound, playExplosionSound, playDamageSound, playNukeExplosionSound,
  playFastEnemySpawn, playSwarmEnemySpawn, playBasicEnemySpawn, playTankEnemySpawn, playMortarEnemySpawn,
  playBossSpawn, playBossAlertSound, playMenuClick, playErrorSound, playBuckshotSound,
  playUpgradeSound,
  playSlowMoSound, playSlowMoReverseSound, playComboSound,
  startLightningSound, stopLightningSound, pauseLightningSound,
  startLightningOrbChargeSound, updateLightningOrbChargeSound, stopLightningOrbChargeSound,
  playLightningOrbFireSound, startLightningOrbTravelLoop, stopLightningOrbTravelLoop,
  startLowHealthWarningSound, stopLowHealthWarningSound,
  playMusic, playBossMusic, stopMusic, fadeOutMusic,
  playKillsAlertSound, playTingSound, playSeekerBurstSound, playHealSound, playLevelCompleteSound,
  playCountdown321,
  // Charge cannon sounds
  startChargeSound, updateChargeSound, stopChargeSound,
  playChargeReadySound, playChargeFireSound,
  // Boss and name entry sounds
  playIncomingBossSound, playNoOneMakesItSound, playYouMadeItSound,
  playProjectileWarningSound,
  playBuffedHitSound,
  playPhaseWraithCharge as playMortarCharge,
  playBossProjectileDestroySound,
  // Skull boss sounds
  playSkullDeathKnell, playSkullLaughSound,
  // Final boss sounds
  playFinalBossAwakenSound, playFinalBossCollapseGroan, playFinalBossVictorySting,
  resumeAudioContext,
  // Reactive music layer (Issue #142) + threat spatial audio (Issue #184)
  startReactiveMusic, updateReactiveMusic, updateThreatAudio,
  // Alchemy bench sounds (Issue #185)
  playDissolveSound, playForgeSound,
  // Bullet Carnival grade sting (Issue #189)
  playStyleGradeUpSound,
  // Eclipse Engine corruption layer (Issue #172)
  playEclipseCorruptSound, playEclipsePurgeSound,
  playEclipsePhase2StartSound, playEclipseSelfDamageSound,
  // Void Marks (Issue #139)
  playInheritSound, playPurgeSound,
} from './audio.js';
// Beam weapons module (Issue #196 Phase 1 extraction): charge cannon,
// lightning rod beams/orbs, charge visuals, pending timer registry.
import {
  initBeamWeapons, resetChargeSystems, clearAllPendingTimers,
  getHandForController, isLightningOrbCharging, getLightningOrbChargeSec,
  fireChargeBeam, fireLightningOrb, updateLightningOrbCharge, clearLightningOrbCharge,
  updateLightningBeam, clearLightningBeam, clearAllLightningBeams, clearAllLightningOrbs,
  updateLightningOrbs, isBossLightningLevel, chargeTimeToDamage,
  updateChargeVisuals, hideChargeVisuals, clearAllChargeBeamVisuals,
  updateChargeExplosions, updateChargeBeamVisuals,
  chargeTimeToProgress, pointToSegmentDistSq, spawnTransientLightningBolt,
} from './beam-weapons.js';
// Projectile system module (Issue #196 Phase 2 extraction): projectile
// spawn/update/hit pipeline, instanced pools, accuracy, explosion visuals.
import {
  initProjectileSystem, initProjectileScene, resetProjectilePools, resetDebrisGlow,
  updateDebrisGlow,
  projectiles, explosionVisuals, explosionPool, instancedProjectiles,
  projectileInstanceData, seekerBurstQueue, playerProjectileMaterials,
  initExplosionPool, clearAllProjectiles, spawnProjectile, getPooledProjectile,
  processSeekerBurstQueue, updateProjectiles, updateExplosionVisuals,
  spawnExplosionVisual, isHostileProjectile, resolveDroppedShot,
  startAccuracyShot, spawnBossProjectileDestructionFX,
  triggerHostileProjectileExplosion, PROJECTILE_BOLT, MAX_PROJECTILES,
  screenFx, seekerBurstCooldownEnd, SEEKER_BURST_DELAY,
} from './projectile-system.js';
// Alt weapons module (Issue #196 Phase 3 extraction): 20 special weapons,
// their pools and active arrays.
import {
  initAltWeapons, fireAltWeapon, clearAllAltWeaponEffects, _disposeDroneProjPool,
  updateShields, spawnLaserMinesPassively, updateLaserMines, updateDecoys,
  updateMinesAndBlackHoles, updateNaniteSwarms, updateTethers,
  updatePhaseDashAfterimages, updateReflectorDrones, updateStasisFields,
  updatePlasmaOrbs, updateGrenades, updateProximityMines, updateAttackDrones,
  updateEMPVisuals, updateTeleportEffects,
  activeShields, activeLaserMines, activeStasisFields, activePlasmaOrbs,
  activePhaseDashAfterimages, activeDecoys, activeBlackHoles, activeMines,
  activeTethers, activeNaniteSwarms, activeReflectorDrones, activeGrenades,
  // Fix: reflector-drone reflection was called in the hostile projectile
  // loop without an import — threw a ReferenceError the first time any boss
  // projectile actually reached the player (frame loop froze)
  checkReflectorDroneReflection,
  activeProximityMines, activeAttackDrones, activeEMPVisuals, activeTeleportEffects,
} from './alt-weapons.js';
import {
  initEnemies, spawnEnemy, updateEnemies, updateExplosions, getEnemyMeshes,
  getEnemyByMesh, clearAllEnemies, getEnemyCount, hitEnemy, destroyEnemy,
  applyEffects, getSpawnPosition, getEnemies,
  updatePhaseEchoes,
  getBoss, spawnBoss, getBossNameForLevel, hitBoss, updateBoss, clearBoss, hitBossMinion, updateBossMinions,
  getBossMinions,
  updateBossProjectiles, getBossProjectiles, updateStatusBubbles, setPlayerForward, setBossSpawnForward,
  updateBossDebris, clearBossDebris, spawnBossDebris, setVFXReference, clearBossProjectiles,
  releaseBossProjIndex, clearBossMinions,
  clearAllTelegraphs, spawnHealthGainPopup,
  clearGeometryCaches, setCameraRef, setPulseRingHitCallback,
  setBombardierConeHitCallback, countActiveBombardiers,
  setVoidAnchorPulseCallback, countActiveVoidAnchors,
  countActiveVoidTendrils, spawnEchoPhantom, countActiveEchoPhantoms,
  setLeechDrainCallback, countActiveLeeches,
  setMasqueradeMinionHitCallback
} from './enemies.js';
import { getStasisSlowFactor } from './stasis.js';
import { initVFX, updateVFX } from './vfx.js';
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
  getTitleButtonHit, showNameEntry, hideNameEntry, getNameEntryHit, getNameEntryName,
  desktopTypeChar, processKeyPress,
  showScoreboard, hideScoreboard, getScoreboardHit, updateScoreboardScroll,
  showCountrySelect, hideCountrySelect, getCountrySelectHit,
  showReadyScreen, hideReadyScreen, updateReadyCountdownText,
  showPauseMenu, hidePauseMenu, updatePauseMenu, showPauseCountdown, hidePauseCountdown, updatePauseCountdownDisplay, getPauseMenuHit,
  showSettings, hideSettings, isSettingsVisible, getSettingsHit, executeSettingsAction, getPreviousMenu,
  updateHUDHover,
  showBestiary, hideBestiary, isBestiaryVisible, getBestiaryHit, updateBestiary,
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
  layoutCache,
  // Alchemy bench (Issue #185)
  showAlchemyBench, hideAlchemyBench, showAlchemyCategoryView,
  isAlchemyBenchOpen,
  getAlchemyBenchHit, getHoveredAlchemyAction,
  // Bullet Carnival style flash (Issue #189)
  triggerStyleFlash,
  // Eclipse Engine corruption warning (Issue #172)
  showEclipseWarning, updateEclipseWarning, hideEclipseWarning,
  // Combo icon glow (Issue #218 deferred)
  triggerComboGlow,
} from './hud.js';
import {
  initWristHolograms, showWristHolograms, updateWristHolograms, hideAllWristHolograms
} from './wrist-holograms.js';
// Evolved weapon systems (Issue #143 Phase C): firing + update loops for the
// six evolved weapons. Beam evolutions are driven by intercepts in the
// hold/release paths below; projectile evolutions dispatch from fireMainWeapon.
import {
  initEvolutions, fireTwinHelix, fireDragonsBreath, fireHiveMind,
  updateTeslaTower, fireSingularityShot,
  updateObliteratorBeam, hideObliteratorBeam,
  updateEvolvedSystems, clearAllEvolvedSystems,
} from './evolutions.js';
// Weapon mastery (Issue #213): permanent per-weapon progression
import {
  loadMastery, saveMastery, addMasteryKill, getMasteryTierIndex,
  getMasteryCardId, getBestMastery, getMasteryTier,
} from './mastery.js';
// Eclipse Engine corruption layer (Issue #172): upgrade-possession mechanic
import {
  initEclipseSystem, updateEclipse, purgeAllEclipses,
  getActiveEclipseIds, applyEclipseToStats,
} from './eclipse.js';
// Threat Compass (Issue #206): ground glow pointing at nearest dangers
import {
  initThreatCompass, updateThreatCompass, setThreatCompassVisible, setThreatCompassTheme,
} from './threat-compass.js';
// Environment orchestration (Issue #196 Phase 5): biome/theme/fade lifecycle,
// stars, transition bursts — pure-move extraction; flow code reads
// currentTheme/synthVisualRefs/floorMaterial (never writes them)
import {
  initEnvironment, applyThemeForLevel, applyEnvironmentFade, startEnvironmentFade,
  clearBiomeScene, purgeBiomeForBossCinematic, updateBiomeProps,
  updateTransitionBurst, triggerTransitionBurst, getBiomeFloorY, updateEnvironmentFade,
  registerFadeMaterial, unregisterFadeMaterial, disposeObject3D,
  setMaterialEmissiveSafe, disposeMesh, createEnvironment,
  setBiomeClearedForBossCinematic, currentTheme, synthVisualRefs, floorMaterial,
  biomeTerrainMaterials, AVAILABLE_BIOMES, isEnvironmentFadeActive, biomeSceneGroup,
} from './environment-orchestration.js';
// Flow countdowns (Issue #196 Phase 4): ready-screen + pause-resume 3-2-1 state machines
import {
  initFlowCountdowns, startReadyCountdown, resetReadyCountdown, updateReadyCountdown,
  isReadyCountdownActive, startPauseCountdown, updatePauseCountdown,
} from './flow-countdowns.js';
// Input router (Issue #196 Phase 4): state→handler dispatch tables
import {
  initInputRouter, handleTriggerPress, handleTriggerRelease,
  handleSqueezePress, handleSqueezeRelease, handleDesktopClick as routeDesktopClick,
} from './input-router.js';
// Breach Events (Issue #138): mid-level arena hazards
import {
  initBreachEvents, updateBreachEvents, resetBreachState,
  startBreachEvent, isBreachEmpActive,
} from './breach-events.js';
// Void Marks (Issue #139): deaths leave inheritable scars in future runs
import {
  initVoidMarks, recordVoidMark, spawnLevelVoidMarks, updateVoidMarks,
  tryVoidMarkInherit, tryVoidMarkPurge, isVoidMarkInRange,
} from './void-marks.js';

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
 * Pulse both VR controllers when the player takes damage.
 * WebXR/Gamepad haptics are experimental and vary by browser, so every access
 * is guarded and unsupported controllers silently no-op.
 */
function pulsePlayerHitHaptics(severity = 1) {
  const intensity = THREE.MathUtils.clamp(0.45 + severity * 0.2, 0.35, 1.0);
  const duration = Math.round(80 + THREE.MathUtils.clamp(severity, 0, 3) * 45);
  for (let i = 0; i < controllers.length; i++) {
    const gamepad = controllers[i]?.userData?.inputSource?.gamepad;
    if (!gamepad) continue;
    try {
      const actuator = gamepad.hapticActuators?.[0];
      if (actuator?.pulse) {
        actuator.pulse(intensity, duration).catch(() => {});
      } else if (gamepad.vibrationActuator?.playEffect) {
        gamepad.vibrationActuator.playEffect('dual-rumble', {
          startDelay: 0,
          duration,
          weakMagnitude: intensity,
          strongMagnitude: intensity,
        }).catch(() => {});
      }
    } catch (e) {
      // Haptics support is partial; gameplay feedback continues via flash/SFX.
    }
  }
}

function applyPlayerDamage(amount, severity = amount) {
  const dead = damagePlayer(amount);
  pulsePlayerHitHaptics(severity);
  return dead;
}

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

let lastTime = 0;
let frameCount = 0;  // For staggering updates

// Ready screen countdown
// Ready-screen + pause countdown state moved to flow-countdowns.js (#196 Phase 4)

const enemySpatialHash = new SpatialHash(15);  // 15 unit cells >= max query radius

// Perf: scratch result arrays for spatial-hash queries — query() allocates a
// fresh array per call; queryInto() + these reused arrays keep the render
// loop allocation-free. Each call site gets its OWN scratch array because
// results must stay live while the caller iterates them.
const _hashScratchMineAoe = [];

// Perf: module-level scratch objects for render-loop math — eliminates
// per-frame `new THREE.Vector3()/Color()` allocations (GC pressure in VR)
const _floorFlashColor = new THREE.Color(0xff0000);       // floor damage flash
const _lowHealthWarningColor = new THREE.Color(0xaa0000); // low-health pulse
const _shieldPlayerPos = new THREE.Vector3();             // shield follow position

// Perf: boss-alert cinematic target colors — the sequence runs 3-7.4s and
// previously allocated ~20 new THREE.Color per frame (only used as stateless
// lerp targets)
const _cinRedGrid = new THREE.Color(0x880000);          // Dark crimson grid
const _cinRedBase = new THREE.Color(0x1a0000);          // Very dark red base
const _cinRedFog = new THREE.Color(0x220000);           // Dark red fog
const _cinRedPulseA = new THREE.Color(0xcc0000);        // Normal red (former pink)
const _cinRedPulseB = new THREE.Color(0x660000);        // Dark red (former cyan)
const _cinRedTop = new THREE.Color(0x12000a);
const _cinRedMid = new THREE.Color(0x32001a);
const _cinRedHorizon = new THREE.Color(0x701a1a);
const _cinRedGlow = new THREE.Color(0x6a0020);
const _cinRedMoonGlow = new THREE.Color(0x301020);
const _cinRedSunOuter = new THREE.Color(0xff2200);
const _cinRedSunGlow = new THREE.Color(0xff3300);
const _cinRedSunCore = new THREE.Color(0xff0000);
const _cinRedSunRefl = new THREE.Color(0xff0000);
const _cinRedHorizonGlow = new THREE.Color(0xff2200);
const _cinRedMountain = new THREE.Color(0x882244);      // Dark red-purple tint
const _cinRedDesertMoon = new THREE.Color(0xcc0000);
const _cinRedDesertMoonGlow = new THREE.Color(0xff2200);
const _cinRedAlienMoon = new THREE.Color(0xff2200);
const _cinRedAlienBase = new THREE.Color(0x150005);
const _cinRedAlienGreen = new THREE.Color(0xff2200);

// voxelPool and activeVoxels now imported from voxel-debris.js

// Weapon firing cooldowns (per controller)
const weaponCooldowns = [0, 0];

// Big Boom: only one "exploding" shot per hand every 2.75s (ms)
// (state moved to projectile-system.js — exported live bindings)

// Charge shot state (per controller): time when trigger was pressed (ms) or null
const chargeShotStartTime = [null, null];

// Plasma carbine wind-up state (per controller): time when trigger was pressed (ms) or null
const plasmaCarbineSpinStart = [null, null];
const plasmaCarbineLastFireTime = [0, 0];

// Holographic blaster displays (per controller)
const blasterDisplays = [null, null];

// Environment state (stars/theme/biome group/fades) moved to
// environment-orchestration.js (#196 Phase 5) — read via imports.
const DEFAULT_LEVEL_SPAWN_FORWARD = new THREE.Vector3(0, 0, -1);
const _levelSpawnForward = new THREE.Vector3(0, 0, -1);
let levelFadeReady = false;

// Floor damage flash
// Floor refs removed — no base floor exists, biomes provide their own terrain
let floorRef = null;
let floorBaseColor = new THREE.Color(0x220044);
// floorFlashTimer/floorFlashing moved to projectile-system.js (screenFx object)

// ============================================================
// CRASH REPORTER
// Captures unhandled errors and sends them to /api/report-error
// for Supabase storage + optional Telegram notification.
// ============================================================

let _crashReporterReady = false;
let _sessionPlaythrough = 0;

function initCrashReporter() {
  if (typeof window === 'undefined') return;
  if (_crashReporterReady) return;
  _crashReporterReady = true;

  window.addEventListener('error', (event) => {
    sendCrashReport({
      errorType: event.error?.constructor?.name || 'Error',
      errorMessage: event.message || 'Unknown error',
      stackTrace: event.error?.stack || '',
    });
  });

  window.addEventListener('unhandledrejection', (event) => {
    const reason = event.reason;
    sendCrashReport({
      errorType: reason?.constructor?.name || 'UnhandledRejection',
      errorMessage: reason?.message || String(reason),
      stackTrace: reason?.stack || '',
    });
  });

  _log('[crash-reporter] Initialized — unhandled errors will auto-report');
}

function sendCrashReport({ errorType, errorMessage, stackTrace }) {
  try {
    // Don't report errors from the crash reporter itself
    if (errorMessage?.includes('report-error')) return;

    const report = {
      errorType,
      errorMessage,
      stackTrace,
      url: window.location?.href || '',
      level: game?.level || null,
      bossName: activeBoss?.name || game?.killedBy?.name || '',
      bossPhase: activeBoss?.phase || null,
      weapon: game?.mainWeapon?.left || '',
      health: game?.health || null,
      score: game?.score || null,
      kills: game?.totalKills || null,
      sessionPlaythrough: _sessionPlaythrough || null,
      timestamp: new Date().toISOString(),
    };

    // Capture renderer stats if available
    if (renderer?.info) {
      report.rendererInfo = {
        geometries: renderer.info.memory?.geometries,
        textures: renderer.info.memory?.textures,
        programs: renderer.info.programs?.length,
      };
    }

    // Capture performance if available
    if (performance?.memory) {
      report.memory = Math.round(performance.memory.usedJSHeapSize / 1048576 * 10) / 10;
    }

    report.userAgent = navigator?.userAgent || '';

    // Fire-and-forget (don't block, don't await)
    fetch('/api/report-error', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(report),
      keepalive: true, // Ensures request survives page crash/unload
    }).catch(() => {
      // Silently fail — reporting is best-effort
    });

    console.error(`[crash-reporter] ${errorType}: ${errorMessage}`);
  } catch (e) {
    // Absolute last resort — never throw from error handler
    console.error('[crash-reporter] Failed to report error:', e);
  }
}

// Increment playthrough counter on each new game
function trackPlaythrough() {
  _sessionPlaythrough++;
  _log('[crash-reporter] Playthrough #' + _sessionPlaythrough);
}

// Manual report — call from anywhere to report a non-fatal but noteworthy error
// Usage: reportError('Boss spawn failed', error)
function reportError(context, error) {
  sendCrashReport({
    errorType: error?.constructor?.name || 'ReportedError',
    errorMessage: `${context}: ${error?.message || String(error)}`,
    stackTrace: error?.stack || '',
  });
}

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

// Upgrade selection
let upgradeSelectionCooldown = 0;
let pendingUpgrades = [];
let pendingUpgradeHand = null;

// Game over cooldown
let gameOverCooldown = 0;

// Pause countdown state moved to flow-countdowns.js (#196 Phase 4)

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

// ── Dual-Wield Combo state (Issue #218) ────────────────────
// Per-controller fire tracking feeds detectFireCombos in fireMainWeapon.
// Hold weapons (lightning/charge) record one fire event per trigger press
// via comboFireLatch so timing combos work across weapon types.
const comboFireTimes = [0, 0];
// Issue #213 Last Light: consecutive-shot counter per hand (5x on the 10th)
const masteryShotCount = [0, 0];
const masteryShotTime = [0, 0];
const comboFireRateBoostUntil = [0, 0];   // Resonance: +10% fire rate for 1s
const sustainedFireCount = [0, 0];        // Shots within the 1s Heat Wave window
const sustainedFireWindowStart = [0, 0];
const comboFireLatch = [false, false];    // One fire event per press for hold weapons
function recordComboFire(index) {
  comboFireTimes[index] = performance.now();
}

// Momentum kill-chain (Issue #211): per-hand kill streak damage stacks.
// Each kill adds +5% damage for 2s (cap 5x); decayed lazily in
// computeWeaponStats on the next fire.
const momentumKillStacks = [0, 0];
const momentumKillLastAt = [0, 0];

// Issue #138 breach-event bookkeeping (per-level, main.js side)
let _lastBreachLevel = -1;
let _levelPlayStart = 0;
let _breachTriggeredThisLevel = false;

// ── Echo Phantom aim recording (Issue #169) ────────────────
// Records each hand's aim direction every 100ms (3s window) + fire events.
// Echo Phantoms play this back to "replay your last attack pattern".
const AIM_HISTORY_DURATION = 3000;
const AIM_HISTORY_SAMPLE_RATE = 100;
const _aimHistory = { left: [], right: [] };
let _aimSampleAccum = 0;

function sampleAimHistory(dt, now) {
  _aimSampleAccum += dt * 1000;
  if (_aimSampleAccum < AIM_HISTORY_SAMPLE_RATE) return;
  _aimSampleAccum = 0;

  for (const hand of ['left', 'right']) {
    const history = _aimHistory[hand];
    // Prune old samples
    while (history.length > 0 && now - history[0].timestamp > AIM_HISTORY_DURATION) {
      history.shift();
    }
    const vc = getVirtualController(hand);
    if (!vc || !vc.position) continue;
    const dir = new THREE.Vector3(0, 0, -1).applyQuaternion(vc.quaternion);
    if (history.length >= AIM_HISTORY_DURATION / AIM_HISTORY_SAMPLE_RATE) history.shift();
    history.push({ position: vc.position.clone(), direction: dir, timestamp: now });
  }
}

// Record a fire event per hand (pruned to the 3s window)
function recordAimFire(hand, now) {
  const history = _aimHistory[hand];
  history.push({ fire: true, timestamp: now });
  while (history.length > 0 && now - history[0].timestamp > AIM_HISTORY_DURATION) {
    history.shift();
  }
}

/** Snapshot of one hand's aim history (for the echo phantom at spawn). */
function getAimHistorySnapshot(hand) {
  return _aimHistory[hand].map(s => ({ ...s }));
}

// Apply a detected combo's modifiers to the shot's stats.
// ALL combos are SILENT (effects speak for themselves via damage numbers,
// explosions, fire-rate). Even the once-per-level build-based toasts were
// removed per player feedback — the Overload toast fired right after picking
// Lightning Rod and was 'massive text in my face'.
function applyFireCombo(comboId, stats, index, now) {
  // Issue #218 deferred: timing combos are silent (no popup) — flash the
  // accuracy bar in the combo color as the only feedback
  const comboDef = COMBO_DEFS[comboId];
  if (comboDef && comboDef.color) {
    triggerComboGlow(parseInt(comboDef.color.replace('#', ''), 16));
  }
  switch (comboId) {
    case 'dual_strike':
      stats.damage = Math.round(stats.damage * 1.25);
      return;
    case 'resonance':
      comboFireRateBoostUntil[index] = now + 1000;
      return;
    case 'drill':
      stats.critChance = 1;
      return;
    case 'momentum':
      stats.damage = Math.round(stats.damage * 1.2);
      return;
    case 'heat_wave':
      stats.aoeRadius = 1.5;         // 50% of a 'big boom' radius (balance note)
      stats.forceExplosion = true;   // bypasses the 2.75s big-boom cooldown
      return;
    case 'overload':
      if (!stats.lightning) {
        stats.aoeRadius = 1.2;
        stats.aoeDamage = 30;
        stats.forceExplosion = true;
      }
      return;
    case 'scatter_seek':
      stats.scatterSeek = true;
      return;
    default:
      return;
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

  // Issue #189: Bullet Carnival style scoring runs BEFORE scoring so the
  // kill's own contribution (variety/tempo/precision/creativity) is reflected
  // in the grade multiplier applied to THIS kill's score.
  trackStyleOnKill(destroyData, {
    hand: opts.hand,
    isRicochet: opts.isRicochet,
    statusCombo: opts.statusCombo,
    overkill: opts.overkill,
  });

  // Issue #213: permanent per-weapon kill tracking (hand-attributed kills)
  if (opts.hand && game.mainWeapon[opts.hand]) {
    addMasteryKill(game.mainWeapon[opts.hand]);
  }

  // Momentum kill-chain (Issue #211): kills while overcharge is owned add
  // +5% damage per stack for 2s (cap 5x). Per-hand, so only the overcharge
  // hand's shots get the boost.
  if (opts.hand && game.synergies?.[opts.hand]?.some(s => s.id === 'momentum_chain')) {
    const handIdx = opts.hand === 'right' ? 1 : 0;
    if (performance.now() - momentumKillLastAt[handIdx] > 2000) momentumKillStacks[handIdx] = 0;
    momentumKillStacks[handIdx] = Math.min(5, momentumKillStacks[handIdx] + 1);
    momentumKillLastAt[handIdx] = performance.now();
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

  // Issue #189: Bullet Carnival style scoring on every kill
  // (trackStyleOnKill already ran before addScore above — the health-drop
  // roll stays after so pickups spawn from the final death position).
  // Issue #189: at S+ grade, 5% of kills drop a health pickup. Computed fresh
  // so direct state changes (tests) and event timing both behave.
  if (computeStyleGrade(game.styleState).tier <= 2 && Math.random() < 0.05) {
    spawnHealthPickup(destroyData.position);
  }

  return destroyData;
}

// ── BULLET CARNIVAL STYLE SYSTEM (Issue #189) ──────────────
// Four 0-100 meters (variety/precision/tempo/creativity) grade the player's
// combat style D→SSS. The grade multiplies score, upgrades card quality at
// A+, and drops health at S+. Decay forces continuous play — you can't
// coast at SSS.

function trackStyleOnKill(destroyData, opts = {}) {
  const style = game.styleState;
  const now = performance.now();
  const { hand, isRicochet, statusCombo, overkill } = opts;
  const weaponId = hand ? (game.mainWeapon?.[hand] || null) : null;

  // Variety: kill with a different hand/weapon than the last kill; repeating
  // the same hand+weapon drains it (punishes one-trigger play)
  if (hand && weaponId) {
    if (hand !== style.lastKillHand || weaponId !== style.lastKillWeapon) {
      style.variety = Math.min(100, style.variety + 15);
    } else {
      style.variety = Math.max(0, style.variety - 4);
    }
    style.lastKillHand = hand;
    style.lastKillWeapon = weaponId;
  }
  // DoT/environment kills (no hand) are variety-neutral

  // Tempo: kill within 2s of the previous kill
  if (now - style.lastKillTime < 2000) {
    style.tempo = Math.min(100, style.tempo + 12);
  }
  style.lastKillTime = now;

  // Precision: small per-kill boost (large boosts come from accuracy/crits)
  style.precision = Math.min(100, style.precision + 5);

  // Creativity: special kill types
  if (isRicochet) style.creativity = Math.min(100, style.creativity + 20);
  if (statusCombo) style.creativity = Math.min(100, style.creativity + 25);
  if (overkill) style.creativity = Math.min(100, style.creativity + 10);

  onStyleStateChanged();
}

// Recompute grade after a style event; fire grade-up feedback.
function onStyleStateChanged() {
  const prev = game.styleGrade;
  const next = computeStyleGrade(game.styleState);
  game.styleGrade = next;
  if (next.tier < prev.tier) {
    triggerStyleGradeUp(next);
  } else if (next.tier > prev.tier && styleTrailTintActive && next.tier > 2) {
    // Silent grade-down below SS: drop the trail tint
    applyStyleTrailTint(null);
  }
  if (next.tier <= 2 && !styleTrailTintActive) {
    applyStyleTrailTint(next.color);
  }
}

// Per-frame decay (2%/s, tempo 3%/s, creativity 1%/s — issue balance notes).
// NOTE: dt is in SECONDS (rawDt = (now-lastTime)/1000 in render()).
function updateStyleDecay(dt) {
  const style = game.styleState;
  const decay = 0.02 * dt * 1000; // 2% per second (dt in seconds → ×1000)
  style.variety = Math.max(0, style.variety - decay);
  style.precision = Math.max(0, style.precision - decay);
  style.tempo = Math.max(0, style.tempo - decay * 1.5);
  style.creativity = Math.max(0, style.creativity - decay * 0.5);
  const next = computeStyleGrade(style);
  if (next.tier !== game.styleGrade.tier) {
    const wasSS = game.styleGrade.tier <= 2;
    game.styleGrade = next;
    if (wasSS && next.tier > 2 && styleTrailTintActive) applyStyleTrailTint(null);
  }
}

// Grade-up moment: colored screen flash + sting. The floating "A GREAT!"
// popup was removed per player feedback — camera-locked text in the face.
function triggerStyleGradeUp(grade) {
  triggerStyleFlash(grade.color);
  playStyleGradeUpSound(grade.tier);
}

// SS+ visual flair: tint player projectile materials toward the grade color
let styleTrailTintActive = false;
function applyStyleTrailTint(color) {
  styleTrailTintActive = !!color;
  for (const mat of playerProjectileMaterials) {
    if (!mat) continue;
    if (mat.userData.baseStyleColor === undefined) {
      mat.userData.baseStyleColor = mat.color ? mat.color.getHex() : 0xffffff;
    }
    if (color) {
      const target = new THREE.Color(color);
      target.lerp(new THREE.Color(mat.userData.baseStyleColor), 0.6);
      if (mat.color) mat.color.copy(target);
    } else if (mat.color) {
      mat.color.setHex(mat.userData.baseStyleColor);
    }
  }
}

// Health pickups (S+ drops): drift toward the stationary player, collect on
// proximity, expire after 5s.
const healthPickups = [];
function spawnHealthPickup(position) {
  if (!position) return;
  const geo = new THREE.OctahedronGeometry(0.06, 0);
  const mat = basicMat(0x00ff44, { transparent: true, opacity: 0.9 });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.name = 'health-pickup';
  mesh.position.copy(position);
  mesh.position.y = Math.max(mesh.position.y, 0.8);
  scene.add(mesh);
  healthPickups.push({ mesh, born: performance.now(), lifetime: 5000 });
}

function updateHealthPickups(now, playerPos) {
  for (let i = healthPickups.length - 1; i >= 0; i--) {
    const p = healthPickups[i];
    const age = now - p.born;
    if (age > p.lifetime) {
      scene.remove(p.mesh);
      p.mesh.geometry.dispose();
      p.mesh.material.dispose();
      healthPickups.splice(i, 1);
      continue;
    }
    // Slow drift toward the player + bob/pulse
    const toPlayer = _adjustedCameraPosScratch.copy(playerPos).sub(p.mesh.position);
    const dist = toPlayer.length();
    if (dist > 0.2) {
      p.mesh.position.addScaledVector(toPlayer.normalize(), Math.min(0.9, dist) * 0.02);
    }
    p.mesh.position.y = Math.max(0.8 + Math.sin(age * 0.006) * 0.05, p.mesh.position.y);
    p.mesh.rotation.y += 0.05;
    if (dist < 0.9) {
      // Collect: heal one half-heart
      game.health = Math.min(game.maxHealth, game.health + 1);
      playHealSound();
      spawnHealthGainPopup(p.mesh.position.clone());
      triggerHealthGainAnimation();
      scene.remove(p.mesh);
      p.mesh.geometry.dispose();
      p.mesh.material.dispose();
      healthPickups.splice(i, 1);
    }
  }
}

function clearHealthPickups() {
  for (const p of healthPickups) {
    if (p.mesh.parent) scene.remove(p.mesh);
    p.mesh.geometry.dispose();
    p.mesh.material.dispose();
  }
  healthPickups.length = 0;
}
registerResetHook(clearHealthPickups);
registerResetHook(() => {
  if (styleTrailTintActive) applyStyleTrailTint(null);
});

// Camera shake on damage — state moved to projectile-system.js
// (exported live bindings shared with beam-weapons.js)

// Nuke flash overlay
let nukeFlash = null;
let nukeFlashTimer = 0;
const NUKE_FLASH_DURATION = 600; // ms

// Fix 1.5: Pre-allocated scratch vector for getAdjustedCameraPosition()
const _adjustedCameraPosScratch = new THREE.Vector3();

// Fix 1.3: Cached scanlines element (set once at init, not every frame)
let _cachedScanlinesEl = null;
let _scanlinesDisplayShown = true;  // Perf: tracks last style.display write (avoid per-frame DOM writes)

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

// [DEBUG] References for debug visual tuning moved to
// environment-orchestration.js (#196 Phase 5) — read via import.

// Desktop-only post-processing helpers. XR uses renderer.render(scene, camera).
const desktopEffectRefs = {
  anaglyph: null,
  stereo: null,
};

// VR pause button edge tracking (gamepad/menu style buttons).
const vrPauseButtonPressed = new Map();
let lastVRPauseToggleTime = 0;
const VR_PAUSE_DEBOUNCE_MS = 350;

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
    // Card picks advance immediately (the old post-select bar was removed),
    // so auto-selection exits UPGRADE_SELECT on its own; the evolution
    // cinematic finalizes when it completes.
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
  if (options.fadeDuration && !isEnvironmentFadeActive()) {
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

  // Initialize crash reporter early so errors during setup are caught
  initCrashReporter();

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

  // Biome transition burst particle system — initialized lazily on first biome change
  // (constants defined later in file; initTransitionBurst called from triggerTransitionBurst)

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
    // Fix: entering VR can suspend the AudioContext (SFX would silently die)
    resumeAudioContext();
    // Camera is added directly to scene - VR hands work correctly now
    // Validate controller handedness on session start
    validateControllerHandedness();

    // Listen for controller changes (e.g., Quest sleep/wake causing hand swap)
    // Fix: this used to run at init when getSession() is still null — the
    // listener was never attached. Attach it here once the session exists.
    const activeSession = renderer.xr.getSession();
    if (activeSession && activeSession.inputSourcesChange && !activeSession.userData._swapListenerAttached) {
      activeSession.userData._swapListenerAttached = true;
      activeSession.inputSourcesChange.addEventListener('inputsourceschange', () => {
        validateControllerHandedness();
      });
    }
  });

  // No camera rig reset needed - camera is direct child of scene
  renderer.xr.addEventListener('sessionend', () => {
    _log('[vr] Session ended');
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
  initBossDeathCinematic({    scene,
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

  // Init beam weapons module (charge cannon + lightning rod) with
  // dependencies — mirrors the initBossDeathCinematic injection pattern
  initBeamWeapons({
    scene,
    camera,
    controllers,
    enemySpatialHash,
    basicMat,
    hooks: {
      handleEnemyKilled,
      disposeObject3D,
      setKilledBy,
      applyPlayerDamage,
      checkKillsAlert,
      endGame,
      triggerScreenShake,
    },
  });

  // Init projectile system module (pools, hit pipeline, accuracy, explosions)
  initProjectileSystem({
    scene,
    camera,
    enemySpatialHash,
    basicMat,
    isXrPresenting: () => renderer.xr.isPresenting,
    uiRaycaster: _uiRaycaster,
    hooks: {
      handleEnemyKilled,
      disposeMesh,
      disposeObject3D,
      applyPlayerDamage,
      checkKillsAlert,
      endGame,
      setKilledBy,
      triggerScreenShake,
      setMaterialEmissiveSafe,
    },
  });

  // Init alt weapons module (20 special weapons + pools)
  initAltWeapons({
    scene,
    camera,
    enemySpatialHash,
    basicMat,
    isXrPresenting: () => renderer.xr.isPresenting,
    uiRaycaster: _uiRaycaster,
    hooks: {
      disposeMesh,
      handleEnemyKilled,
      setMaterialEmissiveSafe,
      triggerScreenShake,
    },
  });

  // Init eclipse corruption layer (Issue #172) with its injected deps.
  // Guards inside eclipse.js make this a safe no-op if any dep is missing.
  initEclipseSystem({
    getUpgrades: () => game.upgrades,
    applyPlayerDamage,
    triggerHitFlash,
    triggerStyleFlash,
    showEclipseWarning,
    hideEclipseWarning,
    showFloatingMessage,
    playEclipseCorruptSound,
    playEclipsePurgeSound,
    playEclipsePhase2StartSound,
    playEclipseSelfDamageSound,
  });

  // Init threat compass (Issue #206): ground glow toward nearest dangers.
  // getFloorY resolves the biome floor each frame so the disc tracks the
  // current arena's floor height.
  initThreatCompass({
    scene,
    getEnemies,
    getCamera: () => camera,
    getFloorY: getBiomeFloorY,
  });

  // Init environment orchestration (Issue #196 Phase 5). getVisualTuning is
  // injected (it reads runtimeConfig); sceneYOffset keeps the constant in
  // main.js as the single source.
  initEnvironment({
    scene,
    getVisualTuning,
    sceneYOffset: SCENE_Y_OFFSET,
  });

  // Init flow countdowns (Issue #196 Phase 4): ready + pause 3-2-1 machines.
  // Completion callbacks own the actual state transitions.
  initFlowCountdowns({
    updateReadyCountdownText,
    playCountdown321,
    hideReadyScreen,
    hideHUD,
    showHUD,
    hidePauseMenu,
    showPauseCountdown,
    updatePauseCountdownDisplay,
    hidePauseCountdown,
    onReadyCountdownComplete: beginGameplayFromReady,
    onPauseCountdownComplete: resumeFromPauseCountdown,
  });

  // Init input router (Issue #196 Phase 4): state→handler dispatch tables.
  // Heavy per-state handlers stay here; the router owns only the routing.
  initInputRouter({
    isSettingsVisible,
    trigger: {
      settingsTrigger: handleSettingsTrigger,
      titleTrigger: handleTitleTrigger,
      playingTrigger: (controller, index) => {
        // Issue #139: a trigger near a Void Mark INHERITS from the ghost run
        // instead of firing
        if (tryVoidMarkInherit()) return;
        fireMainWeapon(controller, index);
      },
      upgradeTrigger: selectUpgrade,
      gameOverTrigger: (controller, index) => {
        // Cooldown gate keeps the game-over screen from advancing on
        // double-trigger (original onTriggerPress behavior)
        if (gameOverCooldown <= 0) handleGameOverTrigger(controller, index);
      },
      nameEntryTrigger: handleNameEntryTrigger,
      scoreboardTrigger: handleScoreboardTrigger,
      countrySelectTrigger: handleCountrySelectTrigger,
      readyTrigger: handleReadyScreenTrigger,
      pauseTrigger: handlePauseTrigger,
    },
    desktop: {
      settingsTrigger: handleDesktopSettingsClick,
      titleTrigger: () => {
        // Bestiary check only exists on desktop (original handleDesktopClick)
        if (isBestiaryVisible()) handleDesktopBestiaryClick();
        else handleDesktopTitleClick();
      },
      upgradeTrigger: handleDesktopUpgradeSelectClick,
      gameOverTrigger: () => {
        if (gameOverCooldown <= 0) handleDesktopGameOverClick();
      },
      nameEntryTrigger: handleDesktopNameEntryClick,
      scoreboardTrigger: handleDesktopScoreboardClick,
      countrySelectTrigger: handleDesktopCountrySelectClick,
      readyTrigger: handleDesktopReadyScreenClick,
      pauseTrigger: handleDesktopPauseClick,
    },
    squeeze: {
      playingSqueezePress: (controller, index) => {
        // Nuke takes priority: if player has nukes, squeeze activates nuke
        if (game.nukes > 0) {
          if (activateNuke()) return;
        }
        fireAltWeapon(controller, index);
      },
    },
    triggerRelease: onTriggerRelease,
  });

  // Init subsystems
  initEnemies(scene);
  setCameraRef(camera);
  // Fix: wire Pulse Bomber sonic ring damage (was purely visual before)
  setPulseRingHitCallback((damage) => {
    const dead = applyPlayerDamage(damage);
    setKilledBy({ type: 'enemy', name: 'Pulse Bomber', enemyType: 'pulse_bomber' });
    triggerHitFlash(true);
    playDamageSound();
    screenFx.cameraShake = 0.5;  // 0.5 second shake duration
    screenFx.cameraShakeIntensity = 0.05;  // shake magnitude
    screenFx.originalCameraPos.copy(camera.position);
    triggerScreenShake(0.15, 500);
    screenFx.floorFlashing = true;
    screenFx.floorFlashTimer = 1.0;
    window._timeScale = 1.0;
    window._wasCloseEnemy = false;
    timeScale = 1.0;
    if (dead && game.state === State.PLAYING) endGame(false);
  });
  // Issue #199: Bombardier cone damage (floor-turret spray) — mirror of the
  // Pulse Bomber ring wiring above
  setBombardierConeHitCallback((damage) => {
    const dead = applyPlayerDamage(damage);
    setKilledBy({ type: 'enemy', name: 'BOMBARDIER BEETLE', enemyType: 'bombardier' });
    triggerHitFlash(true);
    playDamageSound();
    screenFx.cameraShake = 0.3;
    screenFx.cameraShakeIntensity = 0.02;
    screenFx.originalCameraPos.copy(camera.position);
    triggerScreenShake(0.1, 300);
    screenFx.floorFlashing = true;
    screenFx.floorFlashTimer = 0.6;
    if (dead && game.state === State.PLAYING) endGame(false);
  });
  // Issue #198: Void Anchor full-size pulse damage (subtle pressure to
  // deal with the well) — same damage pipeline as enemy contact
  setVoidAnchorPulseCallback((damage) => {
    const dead = applyPlayerDamage(damage);
    setKilledBy({ type: 'enemy', name: 'VOID ANCHOR', enemyType: 'void_anchor' });
    triggerHitFlash(true);
    playDamageSound();
    screenFx.cameraShake = 0.2;
    screenFx.cameraShakeIntensity = 0.02;
    screenFx.originalCameraPos.copy(camera.position);
    triggerScreenShake(0.08, 250);
    if (dead && game.state === State.PLAYING) endGame(false);
  });
  // Issue #167: leech HP drain (latched parasites) — same damage pipeline
  setLeechDrainCallback((damage) => {
    const dead = applyPlayerDamage(damage);
    setKilledBy({ type: 'enemy', name: 'PARASITIC LEECH', enemyType: 'leech' });
    triggerHitFlash(true);
    playDamageSound();
    screenFx.cameraShake = 0.15;
    screenFx.cameraShakeIntensity = 0.015;
    triggerScreenShake(0.06, 200);
    if (dead && game.state === State.PLAYING) endGame(false);
  });
  // Issue #200: Masquerade disguise-minion contact damage
  setMasqueradeMinionHitCallback((damage) => {
    const dead = applyPlayerDamage(damage);
    setKilledBy({ type: 'enemy', name: 'MASQUERADE MINION', enemyType: 'basic' });
    triggerHitFlash(true);
    playDamageSound();
    screenFx.cameraShake = 0.15;
    screenFx.cameraShakeIntensity = 0.015;
    triggerScreenShake(0.06, 200);
    if (dead && game.state === State.PLAYING) endGame(false);
  });

  // Issue #138: breach events (mid-level arena hazards)
  initBreachEvents({
    scene,
    getEnemies,
    getBoss,
    getPlayerPos: () => camera.position,
    applyPlayerDamage,
    hitEnemy,
    spawnEnemy,
    showFloatingMessage,
  });

  // Issue #139: void marks (death persistence + inherit/purge)
  initVoidMarks({
    scene,
    getPlayerPos: () => camera.position,
    getBiomeForLevel,
    getUpgradeDef,
    addUpgrade,
    getRandomSpecialUpgrades,
    addScore,
    showFloatingMessage,
    hideFloatingMessage,
    playInheritSound,
    playPurgeSound,
  });
  initHUD(camera, scene);
  initWristHolograms();
  // Evolved weapon systems (Issue #143): deps needed by the update loops
  initEvolutions({
    scene,
    enemySpatialHash,
    getController: (i) => controllers[i] || null,
    spawnDamageNumber,
  });
  // Weapon mastery (Issue #213): load persistent progression
  loadMastery();
  // Preload wrist layout JSONs so updateBlasterDisplay can read them
  import('./hud.js').then(m => { m.loadLayout('upgrade-wrist-left'); m.loadLayout('upgrade-wrist-right'); });
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

  // PERFORMANCE: Initialize projectile pools, explosion pool + debris glow
  initProjectileScene(scene);

  // PHYSICS DEATH SYSTEM: Initialize voxel pool
  initVoxelDebris(scene, triggerScreenShake, playExplosionSound);
  
  // Set voxel explosion reference for enemies.js (same module instance as import)
  setVFXReference(spawnVoxelExplosion);
  _log('[physics-death] Voxel explosion reference set');

  // Init stasis field reference for shared access — owned by alt-weapons.js
  // (initAltWeapons registers its activeStasisFields array with stasis.js)

  // [DEBUG] Desktop controls for non-VR playtesting
  initDesktopControls(scene, camera, renderer);

  // Reactive music layer (Issue #142): procedural stems layered over the
  // CDN soundtrack. Runs for the session; per-frame updates duck it outside
  // gameplay states, so no start/stop churn across state transitions.
  startReactiveMusic();

  // Initial synergy snapshot (empty at game start, filled after upgrade picks)
  recomputeSynergies();

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
    // Return true only when the key was actually consumed by name entry.
    // Returning false lets gameplay keys (1-4 fire mode, WASD, nuke) pass
    // through during PLAYING — see desktop-controls onKeyDown.
    if (!nameEntryGroup.visible) return false;
    const result = desktopTypeChar(key);
    if (result && result.action === 'submit') {
      const name = result.name.trim();
      if (!isNameClean(name)) {
        _log('[scoreboard] Name rejected by profanity filter');
        return true;
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
    return true; // name entry visible: every key is consumed
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
    // Synergy Engine (Issue #211): recompute the snapshot after direct
    // test manipulation of game.upgrades (normally runs on upgrade picks)
    window.__test.recomputeSynergies = recomputeSynergies;
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
// CONTROLLER SETUP & INPUT HANDLING
// VR controllers, trigger press/release, squeeze, desktop click
// HOT PATH: handleTriggerPress (input-router.js) routes every frame when trigger held
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
      handleTriggerPress(controller, i);
    });
    controller.addEventListener('selectend', () => {
      controllerTriggerPressed[i] = false;
      upgradeTriggerLatched[i] = false;
      handleTriggerRelease(i);
    });
    
    // ALT weapon triggers (bottom/squeeze trigger)
    controller.addEventListener('squeezestart', () => { handleSqueezePress(controller, i); });
    controller.addEventListener('squeezeend', () => { handleSqueezeRelease(i); });
    
    // Note: pause via menu button is handled by updateVRPauseButton() polling —
    // three.js XRController has no 'secondary' event, so a listener here was dead
    
    controller.addEventListener('connected', (e) => {
      _log(`[controller] ${i} connected — ${e.data.handedness}`);
      controller.userData.handedness = e.data.handedness;
      controller.userData.inputSource = e.data;
      const display = blasterDisplays[i];
      if (display) {
        display.userData.hand = controller.userData.handedness;
        display.userData.needsUpdate = true;
      }
    });
    controller.addEventListener('disconnected', () => {
      _log(`[controller] ${i} disconnected`);
      controller.userData.inputSource = null;
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
    routeDesktopClick();
  });
}

/**
 * Get the actual hand ('left' or 'right') for a controller index
 * Uses controller handedness if available, falls back to index-based mapping
 */
// [CORE] Get hand assignment for controller index
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

  // Issue #143: evolved weapons get their signature color + a 30% larger
  // sphere so the transformation is obvious at a glance.
  const evo = game.weaponEvolution?.[hand];
  const color = evo ? evo.sigColor : getWeaponSphereColor(game.mainWeapon[hand], hand);

  const core = visual.children.find(c => c.name === `controller-core-${hand}`);
  const glowSphere = visual.children.find(c => c.name === `controller-glow-${hand}`);
  const aimLine = visual.children.find(c => c.name === `controller-aim-${hand}`);

  if (core) core.material.color.setHex(color);
  if (glowSphere) glowSphere.material.color.setHex(color);
  if (aimLine) aimLine.material.color.setHex(color);
  // 30% larger than the base sphere (0.03 → 0.039), per the issue spec
  if (core) core.scale.setScalar(evo ? 1.3 : 1);
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

  // Read bg dimensions from layout if available (async, may not be loaded yet)
  const layoutKey = `upgrade-wrist-${hand}`;
  const els = layoutCache[layoutKey]?.elements;
  const bgEl = els?.wrist_holo_bg;
  const bgW = bgEl?.w || 0.21;
  const bgH = bgEl?.h || 0.26;

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

  // Single plane with hologram shader - size from layout
  const holoGeo = new THREE.PlaneGeometry(bgW, bgH);
  const holoPlane = new THREE.Mesh(holoGeo, holoMaterial);
  holoPlane.position.z = bgEl?.z || 0.003;
  holoPlane.renderOrder = 500;
  group.add(holoPlane);

  // Store material reference for animation (uTime updates in render loop)
  group.userData.holoMaterial = holoMaterial;

  // Subtle border outline (kept for visual definition)
  const borderPanelGeo = new THREE.PlaneGeometry(bgW - 0.01, bgH - 0.01);
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
  group.userData.lastRenderedHash = null;

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
  const upgradeKeys = Object.entries(upgrades).filter(([,v]) => v > 0).map(([k,v]) => `${k}x${v}`).sort().join(',');
  const weaponId = game.mainWeapon?.[hand] || 'standard_blaster';
  const currentHash = `${hand}|${weaponId}|${stats.kills}|${Math.round(stats.totalDamage)}|${upgradeKeys}`;

  // Skip text rebuild if data hasn't changed (cache hit)
  if (display.userData.lastRenderedHash === currentHash) {
    display.userData.needsUpdate = false;
    return;
  }

  // Data changed - rebuild text sprites (cache miss)
  display.userData.lastRenderedHash = currentHash;

  // Remove old text
  const oldText = display.children.filter(c => c.userData.isText);
  oldText.forEach(t => { t.geometry?.dispose(); t.material?.dispose(); if (t.material.map) t.material.map.dispose(); display.remove(t); });

  // Load layout data for this hand
  const layoutKey = `upgrade-wrist-${hand}`;
  const layout = layoutCache[layoutKey];
  const els = layout?.elements;

  // Fallback font constants
  const november = novemberFontFamily;
  const handColor = hand === 'left' ? '#00ffff' : '#ff88aa';

  // Helper: create a text mesh from layout element or fallback
  const makeText = (text, layoutEl, fallbackY, fallbackSize = 20, fallbackColor = '#00ffff') => {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    const fontSize = layoutEl?.fontSize || fallbackSize;
    const color = layoutEl?.color != null ? '#' + layoutEl.color.toString(16).padStart(6, '0') : fallbackColor;
    const scale = layoutEl?.scale || 0.03;

    ctx.font = `bold ${fontSize}px ${november}`;
    const textWidth = ctx.measureText(text).width;
    const pad = 20;
    canvas.width = Math.max(1, Math.ceil(textWidth) + pad * 2);
    canvas.height = Math.max(1, Math.ceil(fontSize * 1.5) + pad * 2);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.font = `bold ${fontSize}px ${november}`;
    ctx.fillStyle = color;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, canvas.width / 2, canvas.height / 2);

    const texture = new THREE.CanvasTexture(canvas);
    // Scale plane to match the layout scale, preserving aspect ratio
    const aspect = canvas.width / canvas.height;
    const h = scale;
    const w = aspect * scale;
    const geometry = new THREE.PlaneGeometry(w, h);
    const material = new THREE.MeshBasicMaterial({
      map: texture, transparent: true, alphaTest: 0.05,
      side: THREE.DoubleSide, depthTest: true
    });
    const mesh = new THREE.Mesh(geometry, material);
    const x = layoutEl?.x || 0;
    const y = layoutEl?.y || fallbackY;
    const z = layoutEl?.z || 0.006;
    mesh.position.set(x, y, z);
    mesh.userData.isText = true;
    return mesh;
  };

  // Weapon name (top, prominent)
  const weaponNameMap = {
    'standard_blaster': 'STANDARD BLASTER', 'buckshot': 'BUCKSHOT',
    'charge_cannon': 'CHARGE CANNON', 'plasma_carbine': 'PLASMA CARBINE',
    'lightning_rod': 'LIGHTNING ROD', 'seeker_burst': 'SEEKER BURST'
  };
  const weaponName = weaponNameMap[weaponId] || 'BLASTER';
  const weaponEl = els?.dup_18_wrist_header || els?.wrist_header;
  display.add(makeText(weaponName, weaponEl, 0.116, 100, handColor));

  // Hand label
  const headerEl = els?.wrist_header;
  display.add(makeText(hand.toUpperCase() + ' BLASTER', headerEl, 0.094, 50, '#00ffff'));

  // Stats row: KILLS / TOTAL DMG / DPS
  const killsLabelEl = els?.wrist_kills;
  display.add(makeText('KILLS:', killsLabelEl, 0.054, 50, '#00ffff'));
  const dmgLabelEl = els?.wrist_dmg;
  display.add(makeText('TOTAL DMG:', dmgLabelEl, 0.054, 50, '#00ffff'));
  const dpsLabelEl = els?.dup_21_wrist_dmg;
  display.add(makeText('DPS:', dpsLabelEl, 0.054, 50, '#00ffff'));

  // Stat values
  const killsValEl = els?.dup_19_wrist_kills;
  display.add(makeText(`${stats.kills}`, killsValEl, 0.04, 70, handColor));
  const dmgValEl = els?.dup_20_dup_19_wrist_kills;
  display.add(makeText(`${Math.round(stats.totalDamage)}`, dmgValEl, 0.04, 70, handColor));
  // Fix: was `totalDamage / stats.shots` — stats.shots doesn't exist (NaN after
  // first kill) and it's damage-per-shot, not DPS. Compute real weapon DPS:
  // damage per trigger × triggers per second (fireInterval is in ms).
  const weaponStats = getWeaponStats(weaponId, upgrades);
  let dps = 0;
  if (weaponStats) {
    if (weaponId === 'charge_cannon') {
      dps = null; // charge weapon: no continuous DPS — show 'CHG'
    } else {
      const fireIntervalMs = Math.max(1, weaponStats.fireInterval || 0);
      dps = Math.round((weaponStats.damage || 0) * (weaponStats.projectileCount || 1) * (1000 / fireIntervalMs));
    }
  }
  const dpsValEl = els?.dup_22_dup_19_wrist_kills;
  display.add(makeText(dps === null ? 'CHG' : `${dps}`, dpsValEl, 0.04, 70, handColor));

  // Upgrade list
  const upgradeCount = Object.values(upgrades).reduce((sum, count) => sum + count, 0);
  const upgradeHeaderEl = els?.wrist_upgrade_count;
  display.add(makeText(`UPGRADES (${upgradeCount})`, upgradeHeaderEl, -0.007, 50, '#00ffff'));

  // List individual upgrades (max 8, two columns)
  const upgradeEntries = Object.entries(upgrades).filter(([,v]) => v > 0);
  const upgradeNameMap = {
    'rapid_fire': 'RAPID FIRE', 'damage_up': 'DAMAGE UP', 'homing': 'HOMING',
    'spread_shot': 'SPREAD SHOT', 'piercing': 'PIERCING', 'scope': 'SCOPE',
    'mega_scope': 'MEGA SCOPE', 'double_shot': 'DOUBLE SHOT', 'triple_shot': 'TRIPLE SHOT',
    'barrel': 'BARREL', 'turbo_barrel': 'TURBO BARREL', 'duck_hunt': 'DUCK HUNT',
    'focused_frenzy': 'FOCUSED FRENZY', 'its_electric': "IT'S ELECTRIC",
    'tesla_coil': 'TESLA COIL', 'quick_charge': 'QUICK CHARGE',
    'excess_heat': 'EXCESS HEAT', 'death_ray': 'DEATH RAY',
    'hold_together': 'HOLD TOGETHER', 'vampiric': 'VAMPIRIC', 'shock': 'SHOCK'
  };
  // Find the dup_23-30 elements for upgrade positions
  const upgradePosKeys = [
    'dup_23_wrist_upgrade_count', 'dup_24_dup_23_wrist_upgrade_count',
    'dup_25_dup_23_wrist_upgrade_count', 'dup_26_dup_24_dup_23_wrist_upgrade_count',
    'dup_27_dup_25_dup_23_wrist_upgrade_count', 'dup_28_dup_26_dup_24_dup_23_wrist_upgrade_count',
    'dup_29_dup_28_dup_26_dup_24_dup_23_wrist_upgrade_count', 'dup_30_dup_27_dup_25_dup_23_wrist_upgrade_count'
  ];
  upgradeEntries.slice(0, 8).forEach(([id, count], i) => {
    const posEl = els?.[upgradePosKeys[i]];
    const name = (upgradeNameMap[id] || id).toUpperCase();
    const label = count > 1 ? `${name} (x${count})` : name;
    const upgradeColor = handColor;
    display.add(makeText(label, posEl, -0.03 - i * 0.03, 40, upgradeColor));
  });

  display.userData.needsUpdate = false;
}

// ============================================================
//  INPUT HANDLING
// ============================================================
// Scoreboard flow context
var scoreboardFromGameOver = false;  // true = came from game over, false = came from title

// [CORE] VR trigger press routing moved to input-router.js (#196 Phase 4);
// the per-state handlers below are registered into the router at init.

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

// ── Highest Level Tracking (localStorage) ─────────────
function getHighestLevel() {
  return parseInt(localStorage.getItem('spaceomicide_highest_level') || '0', 10);
}
function saveHighestLevel(level) {
  const current = getHighestLevel();
  if (level > current) localStorage.setItem('spaceomicide_highest_level', String(level));
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
    if (hover && (hover.action === 'scoreboard' || hover.action === 'settings' || hover.action === 'diagnostics' || hover.action === 'bestiary')) btnHit = hover.action;
  }
  // Check if bestiary is open
  if (isBestiaryVisible()) {
    const action = getBestiaryHit(_uiRaycaster);
    if (action === 'back') {
      playMenuClick();
      hideBestiary();
      showTitle();
      return;
    }
    return; // Consume trigger while bestiary is open
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
  if (btnHit === 'bestiary') {
    playMenuClick();
    hideTitle();
    showBestiary(new THREE.Vector3(0, 1.6, 0));
    return;
  }
  playMenuClick();
  startGame();
}

// ── Desktop Controls Handlers ───────────────────────────────
// [DEBUG] Desktop mouse click handlers for non-VR playtesting
// [CORE] Desktop click routing moved to input-router.js (#196 Phase 4);
// the desktop handlers below are registered into the router at init.

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
    if (hover && (hover.action === 'scoreboard' || hover.action === 'settings' || hover.action === 'diagnostics' || hover.action === 'bestiary')) btnHit = hover.action;
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
  if (btnHit === 'bestiary') {
    playMenuClick();
    hideTitle();
    showBestiary(new THREE.Vector3(0, 1.6, 0));
    return;
  }
  playMenuClick();
  startGame();
}

function handleDesktopBestiaryClick() {
  const raycaster = getAimRaycaster();
  if (!raycaster) return;
  const action = getBestiaryHit(raycaster);
  if (action === 'back') {
    playMenuClick();
    hideBestiary();
    showTitle();
    return;
  }
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
    if (game.finalLevel >= 20) { playYouMadeItSound(); } else { playNoOneMakesItSound(); }
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
  // Page navigation (may come from direct hit or hover fallback)
  if (action === 'page_prev' || action === 'page_next') {
    playMenuClick();
    updateScoreboardScroll(action === 'page_next' ? 1 : -1);
    return;
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
  // Issue #143: no card selection during the evolution cinematic
  if (evoCinematicState) return;

  const raycaster = getAimRaycaster();
  if (!raycaster) return;
  raycaster._hudSourceKey = 'desktop';

  // Issue #185: bench/post-bar priority, mirroring the VR trigger path
  const benchHit = getAlchemyBenchHit(raycaster);
  if (benchHit) {
    handleAlchemyAction(benchHit);
    return;
  }
  if (isAlchemyBenchOpen()) return;

  // Desktop and VR should share the same "hovered card" fallback so local
  // playtesting catches the same interaction regressions players would feel in-headset.
  const result = getUpgradeCardHit(raycaster) || getHoveredUpgradeCardHit('desktop');
  if (result) {
    selectUpgradeAndAdvance(result.upgrade, result.hand);
  }
}

function handleDesktopReadyScreenClick() {
  if (isReadyCountdownActive()) return;
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
    if (game.finalLevel >= 20) { playYouMadeItSound(); } else { playNoOneMakesItSound(); }
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
  // Page navigation (may come from direct hit or hover fallback)
  if (action === 'page_prev' || action === 'page_next') {
    playMenuClick();
    updateScoreboardScroll(action === 'page_next' ? 1 : -1);
    return;
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
  if (isLightningOrbCharging(index)) {
    const hand = getHandForController(index);
    const stats = computeWeaponStats(hand);
    if (stats.lightning && isBossLightningLevel()) {
      const chargeTimeSec = getLightningOrbChargeSec(index, performance.now());
      const controller = controllers[index];
      if (controller) fireLightningOrb(controller, index, chargeTimeSec, stats);
    }
    clearLightningOrbCharge(index);
  }

  // Charge shot: fire beam on release
  if (chargeShotStartTime[index] !== null) {
    const hand = getHandForController(index);
    const stats = computeWeaponStats(hand);
    if (stats.chargeShot) {
      const chargeTimeSec = (performance.now() - chargeShotStartTime[index]) / 1000;
      // Issue #143: Singularity Launcher replaces the beam on release;
      // Issue #213: the Overkill mastery card splits max-charge shots into 3.
      const evo = game.weaponEvolution?.[hand];
      if (evo && evo.id === 'singularity_launcher') {
        fireSingularityShot(controllers[index], index, chargeTimeSec, stats, evo);
      } else if (!fireMasteryCharge(controllers[index], index, chargeTimeSec, stats, hand)) {
        fireChargeBeam(controllers[index], index, chargeTimeSec, stats);
      }
    }
    // Clean up charge sound and visuals
    stopChargeSound(index);
    hideChargeVisuals(index);
    if (controllers[index]) controllers[index].userData.chargeReadySoundPlayed = false;
    chargeShotStartTime[index] = null;
  }
  // Stop lightning beam when trigger released (dispose to prevent GEO leak)
  clearLightningBeam(index);
  pauseLightningSound();
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
  // Issue #139: nuking near a Void Mark PURGES it for score instead —
  // the nuke itself is not spent
  if (tryVoidMarkPurge()) return true;
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

  // Big explosion sound: low rumble with distortion, pitch glides down over 2s
  playNukeExplosionSound();

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
// [CORE] Squeeze press/release routing moved to input-router.js
// (#196 Phase 4); the PLAYING handler is registered at init.

// ============================================================
//  ALT WEAPON FIRING
// ============================================================
// [CORE] Fire alt weapon based on type dispatch
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
  _log('[debug] cycleDebugBiomeWithFade called, environmentFadeState:', isEnvironmentFadeActive());
  if (isEnvironmentFadeActive()) {
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

// [CORE] Ready countdown timer state moved to flow-countdowns.js (#196
// Phase 4); beginGameplayFromReady is registered as its completion callback.

// [CORE] Begin gameplay from ready screen (called when the 3-2-1 completes)
function beginGameplayFromReady() {
  updateReadyCountdownText(null);
  hideReadyScreen();
  hideHUD();

  // Actually start playing
  game.state = State.PLAYING;
  showHUD();

  // Stagger setup
  game.spawnTimer = 1.0;
}

// [CORE] Handle ready screen VR trigger
function handleReadyScreenTrigger(controller) {
  if (isReadyCountdownActive()) return;
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
  // Issue #196 Phase 5: flag lives in environment-orchestration.js
  setBiomeClearedForBossCinematic(false);
}

// [CORE] Start new game
function startGame() {
  _log('[game] Starting new game');
  trackPlaythrough();
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

  // Cancel any pending combat timers (e.g. charge-beam triple-shot delay)
  // so they can't fire during the upgrade screen or into the next level.
  clearAllPendingTimers();

  // Force-clear lightning beams so they don't persist through upgrade screen
  clearAllLightningBeams();
  clearAllLightningOrbs();
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

// Clear all alt-weapon effects (grenades, mines, decoys, drones, etc.)
// Called during level transitions to prevent geometry/material accumulation
// [CORE] Clear all alt weapon effects (shields, mines, drones, etc.)
// Register clearAllAltWeaponEffects as a resetGame() hook so voxels/effects
// are properly cleared even on full game restart (not just level transitions).
registerResetHook(clearAllAltWeaponEffects);

// Cancel pending gameplay timers (triple-shot delay, etc.) on full game restart
registerResetHook(clearAllPendingTimers);

// Reset controller sphere colors to default (cyan left, pink right) on game reset
registerResetHook(() => updateAllControllerSphereColors());

// Register HUD cleanup hooks (damage numbers, combo popups, kill-chain popups, floating messages)
registerResetHook(clearAllDamageNumbers);
registerResetHook(clearAllComboPopups);
registerResetHook(clearAllKillChainPopups);
registerResetHook(clearFloatingMessage);

// Register enemy cleanup hooks (boss debris already called in clearAllEnemies,
// but registered as separate hooks for safety on full game reset)
registerResetHook(clearBossDebris);

// Clear geometry/texture caches to prevent GPU object leaks on game restart
registerResetHook(clearGeometryCaches);
registerResetHook(clearHudGeoCache);

// Clean up active charge explosions on game reset
// Reset InstancedMesh projectile pools on full game restart
// (pools owned by projectile-system.js; drone/boss-helper pools stay here)
registerResetHook(() => {
  resetProjectilePools();
  // Reset drone proj pool
  _disposeDroneProjPool();
  // Reset boss helper pool
  _disposeBossHelperPool();
});

// Reset charge explosions + beam/lightning visuals on full game restart
// (ownership moved to beam-weapons.js in the Issue #196 refactor)
registerResetHook(resetChargeSystems);

// Issue #172: purge any active eclipses on full game restart
registerResetHook(purgeAllEclipses);

// Issue #211: clear Momentum kill-chain stacks on full game restart
registerResetHook(() => {
  momentumKillStacks[0] = 0;
  momentumKillStacks[1] = 0;
  momentumKillLastAt[0] = 0;
  momentumKillLastAt[1] = 0;
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

  // Issue #185: Essence NEVER carries between levels ('use it or lose it')
  // and the forge lock releases once per level.
  game.alchemyEssence = 0;
  game.alchemyForgedThisLevel = false;

  // Dismiss boss death overlay so upgrade cards are visible
  dismissBossDeathOverlay();

  // Stop lightning sound during upgrade screen
  stopLightningSound();
  clearAllLightningOrbs();

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
    // Issue #189: at A+ grade one of the 3 cards is a SPECIAL upgrade
    // (normally boss-only) — the real prize for sustained style play.
    // Computed fresh so direct state changes and event timing both behave.
    const styleGradeNow = computeStyleGrade(game.styleState);
    // Issue #213: at Master tier the weapon's unique mastery card is offered
    // (once — never re-offered once owned).
    const masteryCardId = getMasteryCardId(mainWeaponId);
    const ownsMasteryCard = masteryCardId && (game.upgrades[hand]?.[masteryCardId] || 0) > 0;
    if (masteryCardId && !ownsMasteryCard && getMasteryTierIndex(mainWeaponId) >= 3) {
      pendingUpgrades = getRandomUpgrades(2, mainWeaponId);
      const card = getUpgradeDef(masteryCardId);
      if (card) pendingUpgrades.push(card);
      _log(`[mastery] Master tier — mastery card offered (${masteryCardId})`);
    } else if (styleGradeNow.tier <= 3) {
      pendingUpgrades = getRandomUpgrades(2, mainWeaponId);
      const special = getRandomSpecialUpgrades(1, mainWeaponId);
      if (special.length > 0) pendingUpgrades.push(special[0]);
      _log(`[style] A+ grade — replaced one card with a SPECIAL upgrade (${special[0]?.id || 'none'})`);
    } else {
      pendingUpgrades = game.justBossKill ?
        getRandomSpecialUpgrades(3, mainWeaponId) :
        getRandomUpgrades(3, mainWeaponId);
    }
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

  // Note: wrist-holograms.js system disabled - using original blasterDisplay system
  // which has the scanline shader. Layout data from wrist JSON will be applied
  // to the original system in a follow-up.
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
  // hideAllWristHolograms(); // disabled - using original blasterDisplay system
  recomputeSynergies();
  advanceLevelAfterUpgrade();
}

// ── SYNERGY ENGINE (Issue #211) ─────────────────────────────
// Recompute the per-hand synergy snapshot after every upgrade pick
// and toast first-time discoveries. Runs at init and after each
// upgrade selection; enemies.js + weapons.js read game.synergies.
function recomputeSynergies() {
  const left = detectSynergies(game.upgrades.left);
  const right = detectSynergies(game.upgrades.right);
  game.synergies = { left, right };

  // First-time discovery is tracked silently — the old floating toast was
  // removed per player feedback (massive camera-locked text on upgrade picks).
  for (const syn of [...left, ...right]) {
    const discovered = game.runStats.synergiesDiscovered || [];
    if (!discovered.includes(syn.id)) {
      discovered.push(syn.id);
    }
  }
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
    playUpgradeSound();
    finalizeUpgradeSelection();
    return;
  }

  if (upgrade?.type === 'main') {
    _log(`[game] Selected MAIN weapon: ${upgrade.id} for ${targetHand} hand`);
    setMainWeapon(upgrade.id, targetHand);
    updateAllControllerSphereColors();
    playUpgradeSound();
    finalizeUpgradeSelection();
    return;
  }

  if (upgrade?.type === 'alt') {
    _log(`[game] Selected ALT weapon: ${upgrade.id} for ${targetHand} hand`);
    setAltWeapon(upgrade.id, targetHand);
    playUpgradeSound();
    finalizeUpgradeSelection();
    return;
  }

  addUpgrade(upgrade.id, targetHand);

  if (upgrade?.id === 'extra_nuke') {
    game.nukes = (game.nukes || 0) + 1;
    _log(`[nuke] Extra nuke granted. Total: ${game.nukes}`);
  }

  // Issue #143: if this pick completes the weapon's evolution recipe, run the
  // fusion/transformation cinematic INSTEAD of advancing immediately. The
  // cinematic ends with finalizeUpgradeSelection().
  const mainWepId = game.mainWeapon[targetHand];
  const evo = checkEvolutionReady(mainWepId, game.upgrades[targetHand]);
  if (evo && !isWeaponEvolved(targetHand)) {
    setWeaponEvolution(evo, targetHand);
    _log(`[evolution] ${mainWepId} evolved into ${evo.name}!`);
    startEvolutionCinematic(evo, targetHand);
    return;
  }

  playUpgradeSound();
  finalizeUpgradeSelection();
}

// ── EVOLUTION CINEMATIC (Issue #143) ───────────────────────
// Six phases: announce → gather → card_spin → merge → reveal → return.
// The weapon sphere detaches from the controller (scene.attach), 3 recipe
// cards orbit it faster and faster, white-flash merge into the evolved
// color, then the weapon floats back to the hand. Ends with
// finalizeUpgradeSelection() (advance to next level).
// Ported from feature/weapon-evolution branch, adapted to the refactored
// main.js (controllers/scene/camera owned here, state machine unchanged).

let evoCinematicState = null;
// State: { evo, hand, controllerIndex, phase, phaseStart, objects, particles, cardMeshes, coreWorldPos, coreWorldQuat }

// Pre-allocated scratch vectors (perf: no per-frame GC during cinematic)
const _evoV3a = new THREE.Vector3();
const _evoV3b = new THREE.Vector3();
const _evoQuat = new THREE.Quaternion();

function startEvolutionCinematic(evo, hand) {
  const controllerIndex = hand === 'left' ? 0 : 1;
  const controller = controllers[controllerIndex];

  if (!controller) {
    // Fallback: no controller attached (headless/desktop edge) — advance
    // directly so the run never strands the player on the upgrade screen.
    _log('[evolution] No controller, skipping cinematic');
    finalizeUpgradeSelection();
    return;
  }

  evoCinematicState = {
    evo,
    hand,
    controllerIndex,
    phase: 'announce',
    phaseStart: performance.now(),
    objects: {},
    particles: [],
    cardMeshes: [],
    coreWorldPos: new THREE.Vector3(),
    coreWorldQuat: new THREE.Quaternion(),
  };

  // Announce the evolution name (Issue #143 HUD fade-in)
  showFloatingMessage(`⚡ ${evo.name.toUpperCase()}`, {
    duration: 2000,
    color: '#' + evo.sigColor.toString(16).padStart(6, '0'),
    size: 0.8,
  });
  _log(`[evolution] Cinematic started for ${evo.name}`);
}

// Spawn a trail particle at world position (capped for Quest perf)
function _evoSpawnParticle(pos, color, particles) {
  if (particles.length >= 50) return;
  const geo = new THREE.SphereGeometry(0.015, 4, 4);
  const mat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.8 });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.copy(pos);
  mesh.userData._born = performance.now();
  mesh.userData._life = 500;
  scene.add(mesh);
  particles.push(mesh);
}

// Update + cull cinematic particles
function _evoUpdateParticles(particles, now) {
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    const age = now - p.userData._born;
    if (age > p.userData._life) {
      scene.remove(p);
      p.geometry.dispose();
      p.material.dispose();
      particles.splice(i, 1);
    } else {
      p.material.opacity = 0.8 * (1 - age / p.userData._life);
      p.scale.setScalar(1 - (age / p.userData._life) * 0.5);
    }
  }
}

// Full cleanup — all geometries/materials disposed (no leaks across runs)
function _evoCleanup(state) {
  const { objects, particles, cardMeshes } = state;
  for (const p of particles) {
    scene.remove(p);
    p.geometry.dispose();
    p.material.dispose();
  }
  particles.length = 0;
  for (const c of cardMeshes) {
    scene.remove(c);
    c.geometry.dispose();
    c.material.dispose();
  }
  cardMeshes.length = 0;
  if (objects.aura) {
    scene.remove(objects.aura);
    objects.aura.geometry.dispose();
    objects.aura.material.dispose();
  }
  if (objects.rig) {
    scene.remove(objects.rig);
  }
}

function updateEvolutionCinematic(now, dt) {
  if (!evoCinematicState) return;

  const { evo, hand, controllerIndex, objects, particles, cardMeshes } = evoCinematicState;
  const controller = controllers[controllerIndex];
  const phase = evoCinematicState.phase;
  const phaseStart = evoCinematicState.phaseStart;
  const elapsed = (now - phaseStart) / 1000;

  _evoUpdateParticles(particles, now);

  // ── Phase 1: ANNOUNCE (0-2s) ──
  if (phase === 'announce') {
    if (elapsed > 2.0) {
      evoCinematicState.phase = 'gather';
      evoCinematicState.phaseStart = now;

      // Find the weapon sphere inside the controller visual group
      const visual = controller.children.find(c => c.name === `controller-visual-${hand}`);
      const core = visual?.children.find(c => c.name === `controller-core-${hand}`);

      if (!core) {
        _log('[evolution] Core not found, skipping cinematic');
        evoCinematicState = null;
        finalizeUpgradeSelection();
        return;
      }

      // Capture world transform BEFORE reparenting (scene.attach preserves it)
      core.getWorldPosition(evoCinematicState.coreWorldPos);
      core.getWorldQuaternion(evoCinematicState.coreWorldQuat);

      const rig = new THREE.Group();
      rig.name = 'evo-rig';
      scene.add(rig);

      scene.attach(core);
      rig.add(core);
      core.position.set(0, 0, 0);
      core.quaternion.set(0, 0, 0, 1);

      objects.core = core;
      objects.rig = rig;
      objects.rigWorldStart = evoCinematicState.coreWorldPos.clone();

      // Float target: 1.5m in front of camera at eye level
      const camDir = new THREE.Vector3();
      camera.getWorldDirection(camDir);
      objects.floatTarget = camera.position.clone().add(camDir.multiplyScalar(1.5));
      objects.floatTarget.y = Math.max(objects.floatTarget.y, 1.2);

      // Signature color on the core
      core.material.color.setHex(evo.sigColor);
      core.material.emissive?.setHex(evo.sigColor);

      // Glow aura (child of rig, independent of core)
      const auraGeo = new THREE.SphereGeometry(0.08, 16, 16);
      const auraMat = new THREE.MeshBasicMaterial({
        color: evo.sigColor,
        transparent: true,
        opacity: 0.4,
      });
      const aura = new THREE.Mesh(auraGeo, auraMat);
      aura.name = 'evo-aura';
      rig.add(aura);
      objects.aura = aura;

      // 3 recipe cards orbiting the core (colored by signature/base colors)
      const cardColors = [evo.sigColor, evo.sigColorAlt || evo.sigColor, evo.baseColor || evo.sigColor];
      for (let i = 0; i < 3; i++) {
        const cardGeo = new THREE.BoxGeometry(0.12, 0.18, 0.01);
        const cardMat = new THREE.MeshBasicMaterial({
          color: cardColors[i],
          transparent: true,
          opacity: 0.9,
        });
        const card = new THREE.Mesh(cardGeo, cardMat);
        card.name = `evo-card-${i}`;
        card.userData.angleOffset = (i / 3) * Math.PI * 2;
        rig.add(card);
        cardMeshes.push(card);
      }
    }
  }

  // ── Phase 2: GATHER (2-3.5s) — core floats to center ──
  else if (phase === 'gather') {
    const t = Math.min(1, elapsed / 1.5);
    const eased = 1 - Math.pow(1 - t, 3);
    objects.rig.position.lerpVectors(objects.rigWorldStart, objects.floatTarget, eased);

    if (objects.aura) {
      const pulse = 1 + Math.sin(elapsed * 10) * 0.3;
      objects.aura.scale.setScalar(pulse);
      objects.aura.material.opacity = 0.3 + Math.sin(elapsed * 8) * 0.15;
    }

    for (const card of cardMeshes) {
      const angle = card.userData.angleOffset + elapsed * 1.5;
      const radius = 1.5 * (1 - eased * 0.5);
      card.position.set(Math.cos(angle) * radius, Math.sin(angle * 0.5) * 0.2, Math.sin(angle) * radius);
      card.rotation.z = angle;
    }

    if (elapsed > 1.5) {
      evoCinematicState.phase = 'card_spin';
      evoCinematicState.phaseStart = now;
    }
  }

  // ── Phase 3: CARD_SPIN (3.5-6.5s) — accelerating orbit ──
  else if (phase === 'card_spin') {
    const speedMultiplier = 2 + elapsed * 4.5;
    objects.rig.position.copy(objects.floatTarget);

    if (objects.core) {
      objects.core.scale.setScalar(1 + Math.sin(elapsed * 8) * 0.1);
    }
    if (objects.aura) {
      const pulse = 1.5 + elapsed * 0.3;
      objects.aura.scale.setScalar(pulse);
      objects.aura.material.opacity = Math.min(0.7, 0.3 + elapsed * 0.1);
    }

    const baseAngle = elapsed * speedMultiplier;
    for (let i = 0; i < cardMeshes.length; i++) {
      const card = cardMeshes[i];
      const angle = card.userData.angleOffset + baseAngle;
      const radius = 0.4;
      card.position.set(Math.cos(angle) * radius, Math.sin(angle * 0.7) * 0.1, Math.sin(angle) * radius);
      card.rotation.z = angle;

      // Trail particles (probabilistic to keep counts low)
      if (Math.random() < 0.15) {
        _evoV3a.copy(objects.rig.position).add(card.position);
        _evoSpawnParticle(_evoV3a, evo.sigColor, particles);
      }
    }

    if (elapsed > 3.0) {
      evoCinematicState.phase = 'merge';
      evoCinematicState.phaseStart = now;
    }
  }

  // ── Phase 4: MERGE (6.5-7.5s) — spiral in + white flash ──
  else if (phase === 'merge') {
    const t = Math.min(1, elapsed / 1.0);
    const eased = 1 - Math.pow(1 - t, 2);
    objects.rig.position.copy(objects.floatTarget);

    const spiralRadius = 0.4 * (1 - eased);
    const angle = elapsed * 20;
    for (const card of cardMeshes) {
      card.position.set(Math.cos(angle) * spiralRadius, 0, Math.sin(angle) * spiralRadius);
      card.rotation.z = angle;
      card.material.opacity = 1 - eased * 0.5;
      if (Math.random() < 0.3) {
        _evoV3a.copy(objects.rig.position).add(card.position);
        _evoSpawnParticle(_evoV3a, evo.sigColor, particles);
      }
    }

    // White flash + haptics at the merge point
    if (t > 0.6 && !objects._flashed) {
      objects._flashed = true;
      renderer.setClearColor(0xffffff, 1);
      setTimeout(() => {
        if (renderer) renderer.setClearColor(0x000000, 1);
      }, 150);
      try {
        const gamepad = navigator.getGamepads?.()?.[controllerIndex];
        gamepad?.hapticActuators?.[0]?.pulse?.(1.0, 300);
      } catch (_) { /* non-critical */ }
      playTingSound();
    }

    if (objects.core && t > 0.6) {
      objects.core.scale.setScalar(1 + (t - 0.6) * 5);
    }

    if (t >= 1.0) {
      for (const card of cardMeshes) {
        scene.remove(card);
        card.geometry.dispose();
        card.material.dispose();
      }
      cardMeshes.length = 0;
      evoCinematicState.phase = 'reveal';
      evoCinematicState.phaseStart = now;
    }
  }

  // ── Phase 5: REVEAL (7.5-9s) — evolved weapon pulses + tagline ──
  else if (phase === 'reveal') {
    objects.rig.position.copy(objects.floatTarget);

    if (objects.core) {
      const shrinkT = Math.min(1, elapsed / 0.5);
      const scale = 3 - (3 - 1.3) * shrinkT;
      objects.core.scale.setScalar(scale);
      objects.core.material.color.setHex(evo.sigColor);
    }

    if (elapsed < 1.0 && Math.random() < 0.2) {
      const angle = Math.random() * Math.PI * 2;
      const dist = 0.1 + elapsed * 0.3;
      _evoV3a.copy(objects.floatTarget).add(
        _evoV3b.set(Math.cos(angle) * dist, Math.sin(angle) * dist * 0.5, Math.sin(angle) * dist)
      );
      _evoSpawnParticle(_evoV3a, evo.sigColor, particles);
    }

    if (elapsed > 0.3 && !objects._taglineShown) {
      objects._taglineShown = true;
      showFloatingMessage(evo.desc || '', {
        duration: 1500,
        color: '#' + evo.sigColor.toString(16).padStart(6, '0'),
        size: 0.5,
      });
    }

    if (elapsed > 1.5) {
      evoCinematicState.phase = 'return';
      evoCinematicState.phaseStart = now;
      objects.returnStart = objects.rig.position.clone();
      controller.getWorldPosition(_evoV3a);
      objects.returnTarget = _evoV3a.clone();
    }
  }

  // ── Phase 6: RETURN (9-10s) — weapon floats back to hand ──
  else if (phase === 'return') {
    const t = Math.min(1, elapsed / 1.0);
    const eased = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;

    controller.getWorldPosition(_evoV3a);
    objects.rig.position.lerpVectors(objects.returnStart, _evoV3a, eased);

    if (objects.aura) {
      objects.aura.material.opacity = 0.4 * (1 - t);
    }

    if (t >= 1.0) {
      const visual = controller.children.find(c => c.name === `controller-visual-${hand}`);
      if (visual && objects.core) {
        visual.attach(objects.core); // preserves world transform
        objects.core.position.set(0, 0, 0);
        objects.core.quaternion.set(0, 0, 0, 1);
        objects.core.scale.setScalar(1.0);
      }

      _evoCleanup(evoCinematicState);

      // Evolved weapon look: signature color + 30% larger sphere
      updateControllerSphereColor(controllerIndex);

      evoCinematicState = null;
      _log(`[evolution] Cinematic complete — ${evo.name} equipped on ${hand}`);

      // Advance to next level (post-select bar is bypassed for evolutions)
      finalizeUpgradeSelection();
    }
  }
}

// Abort an in-flight cinematic cleanly (used on full game reset so the core
// sphere never stays detached from the controller).
function cancelEvolutionCinematic() {
  if (!evoCinematicState) return;
  const { hand, controllerIndex, objects } = evoCinematicState;
  const controller = controllers[controllerIndex];
  if (controller && objects.core) {
    const visual = controller.children.find(c => c.name === `controller-visual-${hand}`);
    if (visual && objects.core.parent !== visual) {
      visual.attach(objects.core);
      objects.core.position.set(0, 0, 0);
      objects.core.quaternion.set(0, 0, 0, 1);
      objects.core.scale.setScalar(1);
    }
  }
  _evoCleanup(evoCinematicState);
  evoCinematicState = null;
}
registerResetHook(cancelEvolutionCinematic);

// Clear evolved-weapon systems (drones/trails/coils/singularities/beams) on
// full game reset so no orphaned visuals survive into the next run.
registerResetHook(clearAllEvolvedSystems);

// Reset any evolved weapon-sphere scale residue after a full reset
registerResetHook(() => {
  for (let i = 0; i < controllers.length; i++) {
    const controller = controllers[i];
    const hand = i === 0 ? 'left' : 'right';
    const visual = controller?.children.find(c => c.name === `controller-visual-${hand}`);
    const core = visual?.children.find(c => c.name === `controller-core-${hand}`);
    if (core) core.scale.setScalar(1);
  }
});

// ── ALCHEMY BENCH (Issue #185) ─────────────────────────────
// The bench is reached from the ALCHEMY button on the card screen (the old
// post-select bar was removed per player feedback). The bench replaces the
// card row while open; BACK returns to the cards; picking a card advances
// the level directly.

// Single entry point for bench action payloads from triggers.
function handleAlchemyAction(action) {
  if (!action || !action.type) return;

  if (action.type === 'alchemy') {
    // Bench takes over the upgrade screen (cards stay behind, not selectable)
    playMenuClick();
    showAlchemyBench(action.hand);
    return;
  }

  if (action.type === 'back') {
    // Close the bench back to the card screen (category view or main)
    playMenuClick();
    hideAlchemyBench();
    return;
  }

  if (action.type === 'dissolve') {
    handleAlchemyDissolve(action.hand, action.upgradeId);
    return;
  }

  if (action.type === 'forge') {
    handleAlchemyForge(action.forgeType, action.category);
    return;
  }

  // Targeted Infusion category picker is a sub-view of the bench
  if (action.type === 'targeted') {
    playMenuClick();
    showAlchemyCategoryView();
  }
}

// Track which hand the bench forges into / dissolves around (the hand that
// received this level's upgrade screen).
function alchemyPendingHand() {
  return pendingUpgradeHand || 'left';
}

// Dissolve one stack of an upgrade into Essence. IRREVERSIBLE.
function handleAlchemyDissolve(hand, upgradeId) {
  const def = getUpgradeDef(upgradeId);
  if (!def) { playErrorSound(); return; }
  const map = game.upgrades[hand];
  if (!map || !(map[upgradeId] > 0)) { playErrorSound(); return; }

  map[upgradeId]--;
  if (map[upgradeId] <= 0) delete map[upgradeId];
  game.alchemyEssence += getEssenceValue(def);
  _log(`[alchemy] Dissolved ${upgradeId} (${hand}) → essence ${game.alchemyEssence}`);

  // Dissolving elemental upgrades can DEACTIVATE synergies (e.g. dropping
  // freeze kills thermal_shock) — recompute the snapshot immediately.
  recomputeSynergies();
  playDissolveSound();
  showAlchemyBench(alchemyPendingHand());
}

// Forge a new upgrade with 3 Essence. Once per level, per the issue.
function handleAlchemyForge(forgeType, category) {
  if (game.alchemyEssence < ALCHEMY_FORGE_COST) { playErrorSound(); return; }
  if (game.alchemyForgedThisLevel) { playErrorSound(); return; }

  const hand = alchemyPendingHand();
  const result = getForgeUpgrade(forgeType, {
    mainWeaponId: game.mainWeapon[hand] || 'standard_blaster',
    owned: game.upgrades[hand] || {},
    category,
  });

  // Weapon Synthesis safety net: no weapon-specific upgrades for this main
  // weapon → refund 1 Essence (spend 3, get 1 back — issue's 'not profitable').
  // The forge attempt still counts toward the once-per-level lock so the
  // bench can't become an infinite reroll machine.
  if (!result) { playErrorSound(); return; }
  if (result.refund) {
    game.alchemyEssence -= (ALCHEMY_FORGE_COST - 1);
    game.alchemyForgedThisLevel = true;
    // Refund is communicated by the bench's essence counter — no floating
    // toast (camera-locked text removed per player feedback).
    playErrorSound();
    showAlchemyBench(hand);
    return;
  }

  game.alchemyEssence -= ALCHEMY_FORGE_COST;
  game.alchemyForgedThisLevel = true;
  addUpgrade(result.upgrade.id, hand);
  recomputeSynergies();
  _log(`[alchemy] Forged ${result.upgrade.id} (${forgeType}) for ${hand}`);
  playForgeSound();
  showAlchemyBench(hand);
}

// Swap the bench to the Targeted Infusion category picker.
function showAlchemyBenchCategoryView() {
  showAlchemyCategoryView();
}

// Issue #213 Overkill mastery card: a max-charge shot splits into 3 spread
// projectiles instead of the single charge beam. Returns true when handled.
function fireMasteryCharge(controller, index, chargeTimeSec, stats, hand) {
  if (!(game.upgrades[hand]?.overkill > 0)) return false;
  const progress = chargeTimeToProgress(chargeTimeSec, stats.chargeRateMultiplier || 1);
  if (progress < 0.99) return false;

  const totalDamage = Math.round(
    chargeTimeToDamage(chargeTimeSec, stats.chargeRateMultiplier || 1, stats.chargeDeathRayMultiplier || 1)
  );
  const origin = new THREE.Vector3();
  const quat = new THREE.Quaternion();
  controller.getWorldPosition(origin);
  controller.getWorldQuaternion(quat);
  const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(quat);
  const right = new THREE.Vector3(1, 0, 0).applyQuaternion(quat);
  const shotId = startAccuracyShot(3, getHandForController(index));
  for (let i = -1; i <= 1; i++) {
    const dir = forward.clone().applyAxisAngle(right, i * 0.05); // ±~3° spread
    spawnProjectile(origin.clone(), dir, index, {
      ...stats, damage: Math.round(totalDamage / 3), projectileCount: 1,
    }, shotId, { suppressSound: true });
  }
  playChargeFireSound(1);
  return true;
}

// [CORE] Advance to next level after upgrade selection
function advanceLevelAfterUpgrade() {
  // Deferred cleanup from level complete - explosions already played during LEVEL_COMPLETE state
  clearAllEnemies();
  clearAllProjectiles();
  clearAllLightningBeams();
  clearAllLightningOrbs();
  clearAllChargeBeamVisuals();
  clearBossProjectiles();
  clearAllTelegraphs();
  clearAllAltWeaponEffects();
  clearAllEvolvedSystems();
  clearAllDamageNumbers();
  clearAllComboPopups();
  clearAllKillChainPopups();
  clearFloatingMessage();
  // Issue #213: persist mastery on level transitions (debounced writes can't
  // lose progress on a quit mid-run)
  saveMastery();
  stopLightningSound();

  game.level++;
  game.kills = 0;

  if (game.level > 20) {
    endGame(true); // victory
  } else {
    game._levelConfig = getLevelConfig();
    captureLevelSpawnForward();
    // Trigger biome transition burst using OLD biome colors
    const oldBiome = getBiomeForLevel(game.level - 1);
    const newBiome = getBiomeForLevel(game.level);
    if (oldBiome !== newBiome) {
      triggerTransitionBurst(getAdjustedCameraPosition(), oldBiome, scene);
    }
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
    clearAllLightningBeams();
    pauseLightningSound();
    clearAllLightningOrbs();
    // Release pointer lock when pausing
    if (document.pointerLockElement) {
      document.exitPointerLock();
    }
  } else if (game.state === State.PAUSED) {
    startPauseCountdown();
  }
}

// [CORE] Pause countdown state machine moved to flow-countdowns.js (#196
// Phase 4); resumeFromPauseCountdown is registered as its completion callback.

// [CORE] Resume gameplay when the pause 3-2-1 completes
function resumeFromPauseCountdown() {
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
}

// [CORE] Set kill tracking data before endGame
const ENEMY_DISPLAY_NAMES = {
  basic: 'DRONE',
  fast: 'SNEAK',
  tank: 'SENTINEL',
  swarm: 'DART',
  spiral_swimmer: 'SPIRAL SWIMMER',
  jelly: 'STACK',
  mortar: 'MORTAR',
  conductor: 'COMMANDER',
  mirror_knight: 'MIRROR KNIGHT',
};

function setKilledBy(info) {
  game.killedBy = info;
}

// [CORE] End game (victory or game over)
function endGame(victory) {
  _log(`[game] Game ${victory ? 'won' : 'over'} — score: ${game.score}`);
  // Log renderer memory at game end for leak diagnosis
  const mem = renderer?.info?.memory;
  const jsHeap = performance.memory ? `JS:${Math.round(performance.memory.usedJSHeapSize / 1048576)}MB` : '';
  _log(`[MEM] At game end — playthrough #${_sessionPlaythrough}` +
    (mem ? ` | GPU geo:${mem.geometries} tex:${mem.textures}` : '') +
    (jsHeap ? ` ${jsHeap}` : ''));
  resetAllSlowMoState();
  game.state = victory ? State.VICTORY : State.GAME_OVER;
  game.finalScore = game.score;
  game.finalLevel = game.level;

  // Save highest level reached to localStorage
  saveHighestLevel(game.level);

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
  // Issue #172: purge any active eclipses (game over must never leave a
  // corrupted loadout state behind)
  purgeAllEclipses();

  // Issue #139: record the death as a Void Mark for future runs
  if (!victory) {
    recordVoidMark(camera.position, game.level, game.upgrades, game.killedBy);
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
  clearAllLightningOrbs();

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
function fireMainWeapon(controller, index) {
  // Issue #138: EMP wave disables all weapon fire (dodge-and-survive)
  if (isBreachEmpActive()) return;
  const now = performance.now();
  const hand = getHandForController(index);
  const mainWeaponId = game.mainWeapon[hand];
  let stats = computeWeaponStats(hand);

  // Issue #218: Resonance fire-rate boost applies to the cooldown gate
  if (now < comboFireRateBoostUntil[index]) {
    stats = { ...stats, fireInterval: stats.fireInterval * 0.9 };
  }

  // Lightning beam mode - handled separately in update loop
  if (stats.lightning) {
    return;  // Lightning is continuous hold-to-fire
  }

  // Charge shot mode - handled separately, fires on trigger release
  if (stats.chargeShot) {
    return;  // Charge shot fires on release, not on press
  }

  // Issue #143: evolved weapons replace the base firing behavior.
  // Beam/charge evolutions (tesla_tower, singularity_launcher) are driven by
  // their hold/release loops; obliterator_beam is driven by the hold loop
  // (fireMainWeapon must NOT fire projectiles for it).
  const evo = game.weaponEvolution?.[hand];
  if (evo) {
    if (evo.id === 'obliterator_beam') return;
    if (evo.id === 'twin_helix') { fireTwinHelix(controller, index, stats, evo); recordComboFire(index); return; }
    if (evo.id === 'dragons_breath') { fireDragonsBreath(controller, index, stats, evo); recordComboFire(index); return; }
    if (evo.id === 'hive_mind') { fireHiveMind(controller, index, stats, evo); recordComboFire(index); return; }
  }

  // Check cooldown (resonance boost already applied to stats.fireInterval)
  if (now - weaponCooldowns[index] < stats.fireInterval) return;
  weaponCooldowns[index] = now;

  // Issue #169: record the fire event for Echo Phantom playback
  recordAimFire(hand, now);

  // ── Dual-Wield Combos (Issue #218) ──
  // Detect + apply combo modifiers to THIS shot before spawning. Detection
  // reads the OTHER hand's most recent fire time (already recorded); this
  // hand's fire is recorded afterwards so it can feed the next shot.
  // NOTE: runs AFTER the cooldown gate so blocked fires can't inflate the
  // sustained-fire counter or waste combo windows.
  const otherIndex = index === 0 ? 1 : 0;
  const otherWeaponId = game.mainWeapon[hand === 'left' ? 'right' : 'left'];
  const otherDelta = now - comboFireTimes[otherIndex];

  // Sustained-fire window: 5+ shots within 1s charges Heat Wave (6th+ shot)
  if (now - sustainedFireWindowStart[index] > 1000) {
    sustainedFireCount[index] = 0;
    sustainedFireWindowStart[index] = now;
  }
  sustainedFireCount[index]++;

  const comboList = detectFireCombos({
    otherFiredDeltaMs: otherDelta,
    sameWeapon: otherWeaponId === mainWeaponId,
    sustainedShots: sustainedFireCount[index],
    otherWeaponId,
    selfLightning: !!stats.lightning,
    seekerBuckshotPair: (mainWeaponId === 'seeker_burst' && otherWeaponId === 'buckshot') ||
                        (mainWeaponId === 'buckshot' && otherWeaponId === 'seeker_burst'),
  });
  if (comboList.length > 0) {
    for (const comboId of comboList) {
      applyFireCombo(comboId, stats, index, now);
    }
  }
  recordComboFire(index);
  weaponCooldowns[index] = now;

  // ── Mastery Cards (Issue #213) ──
  // Effects read game.upgrades[hand] directly (cards are normal upgrades).
  const masteries = game.upgrades[hand] || {};
  // Last Light: every 10th consecutive shot (≤1.2s apart) deals 5x damage
  if (masteries.last_light > 0) {
    if (now - masteryShotTime[index] > 1200) masteryShotCount[index] = 0;
    masteryShotCount[index]++;
    masteryShotTime[index] = now;
    if (masteryShotCount[index] % 10 === 0) stats.damage = Math.round(stats.damage * 5);
  }
  // Point Blank: shotgun damage ramps at close range (applied in handleHit)
  if (masteries.point_blank > 0 && mainWeaponId === 'buckshot') {
    stats.pointBlank = true;
  }
  // Swarm Intelligence: seekers deal double damage
  if (masteries.swarm_intelligence > 0 && mainWeaponId === 'seeker_burst') {
    stats.damage = Math.round(stats.damage * 2);
  }
  // Melting Point: plasma sustained fire (held ≥3s) ignites enemies
  if (masteries.melting_point > 0 && mainWeaponId === 'plasma_carbine' &&
      plasmaCarbineSpinStart[index] !== null && (now - plasmaCarbineSpinStart[index]) >= 3000) {
    stats.effects = [...stats.effects, { type: 'fire', stacks: 1 }];
  }

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
    // Enforce burst cooldown: prevent firing if still in cooldown from previous burst
    if (now < seekerBurstCooldownEnd[index]) return;
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
    // Issue #172: eclipsed projectile upgrades make every shot veer at a
    // wide random angle — the upgrade "scatters" instead of grouping.
    const scattered = !!stats.eclipsedScatter;
    for (let i = 0; i < count; i++) {
      let spawnOrigin = origin.clone();
      let fireDirection = direction;

      if (scattered) {
        const scatterAngle = THREE.MathUtils.degToRad(14 + Math.random() * 20); // 14-34° veer
        const scatterRight = (Math.random() - 0.5) * 2;
        const scatterUp = (Math.random() - 0.5) * 2;
        fireDirection = direction.clone()
          .addScaledVector(rightAxis, scatterRight * Math.sin(scatterAngle))
          .addScaledVector(upAxis, scatterUp * Math.sin(scatterAngle))
          .normalize();
      } else if (count > 1 && !isBuckshot) {
        // Position shots side-by-side with small gap, all parallel
        // Spread evenly around center: for 2 shots [-0.5, 0.5], for 3 [-1, 0, 1], etc.
        const offsetIndex = i - (count - 1) / 2;
        spawnOrigin.addScaledVector(rightAxis, offsetIndex * gap);
      }

      spawnProjectile(spawnOrigin, fireDirection, index, stats, shotId, { suppressSound: multiProjectile });
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

// Issue #172: compute a hand's weapon stats, then apply any active eclipse
// corruption. Pure pipeline — getWeaponStats stays untouched (AGENTS.md
// §14); applyEclipseToStats returns the same object when nothing is
// eclipsed, so this is zero-cost outside the Eclipse Engine fight.
function computeWeaponStats(hand) {
  const stats = getWeaponStats(game.mainWeapon[hand], game.upgrades[hand]);
  // Momentum kill-chain (Issue #211): each kill adds +5% damage for 2s,
  // stacks up to 5x (lazy decay — no timer, checked on next fire)
  const handIdx = hand === 'right' ? 1 : 0;
  if (momentumKillStacks[handIdx] > 0) {
    if (performance.now() - momentumKillLastAt[handIdx] > 2000) {
      momentumKillStacks[handIdx] = 0;
    } else {
      stats.damage = Math.max(1, Math.round(stats.damage * (1 + 0.05 * momentumKillStacks[handIdx])));
    }
  }
  const eclipsed = getActiveEclipseIds(hand);
  return eclipsed.length > 0 ? applyEclipseToStats(stats, eclipsed) : stats;
}

function lerp(a, b, t) {
  return a + (b - a) * t;
}

// Boss helper pool (shared geometry/material for boss attack VFX)
// NOTE: was accidentally swept into the Issue #196 Phase 2 extraction range —
// restored here; ownership stays in main.js for now.
const _bossHelperPool = {
  debrisMat: null,
  decoyGeo: null,
  decoyMat: null,
  pulseGeo: null,
  pulseMat: null,
  lightningGeo: null,
  lightningMat: null,
};

function _getBossHelperGeo(type) {
  switch (type) {
    case 'debris':
      if (!_bossHelperPool.debrisGeo) _bossHelperPool.debrisGeo = new THREE.BoxGeometry(0.15, 0.15, 0.15);
      return _bossHelperPool.debrisGeo;
    case 'decoy':
      if (!_bossHelperPool.decoyGeo) _bossHelperPool.decoyGeo = new THREE.SphereGeometry(0.4, 8, 8);
      return _bossHelperPool.decoyGeo;
    case 'pulse':
      if (!_bossHelperPool.pulseGeo) _bossHelperPool.pulseGeo = new THREE.SphereGeometry(0.3, 8, 8);
      return _bossHelperPool.pulseGeo;
    case 'lightning':
      if (!_bossHelperPool.lightningGeo) _bossHelperPool.lightningGeo = new THREE.SphereGeometry(0.25, 6, 6);
      return _bossHelperPool.lightningGeo;
  }
}

function _disposeBossHelperPool() {
  for (const key of Object.keys(_bossHelperPool)) {
    if (_bossHelperPool[key]) {
      _bossHelperPool[key].dispose();
      _bossHelperPool[key] = null;
    }
  }
}

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
      const debris = new THREE.Mesh(_getBossHelperGeo('debris'), basicMat(0x886644, {
        transparent: true,
        opacity: 0.9
      }));
      debris.userData._sharedPool = true; // geometry is pooled
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
        const _dead = applyPlayerDamage(damage);
        triggerHitFlash(true);
        playDamageSound();
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
    const decoy = new THREE.Mesh(_getBossHelperGeo('decoy'), basicMat(0x00ffff, {
      transparent: true,
      opacity: 0.7
    }));
    decoy.userData._sharedPool = true;
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
    const pulse = new THREE.Mesh(_getBossHelperGeo('pulse'), basicMat(0xff0088, {
      transparent: true,
      opacity: 0.9
    }));
    pulse.userData._sharedPool = true;
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
    const lightning = new THREE.Mesh(_getBossHelperGeo('lightning'), basicMat(0xffff00, {
      transparent: true,
      opacity: 0.95
    }));
    lightning.userData._sharedPool = true;
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
function selectUpgrade(controller, index = -1) {
  if (upgradeSelectionCooldown > 0) return;
  // Issue #143: while the evolution cinematic plays, card selection is
  // disabled — the player must witness the transformation first.
  if (evoCinematicState) return;

  controller.getWorldPosition(_uiSelectOrigin);
  controller.getWorldQuaternion(_uiSelectQuat);
  _uiSelectDir.set(0, 0, -1).applyQuaternion(_uiSelectQuat);
  _uiRaycaster.set(_uiSelectOrigin, _uiSelectDir, 0, 10);
  const hoverSourceKey = index >= 0 ? `controller-${index}` : 'controller';

  // Issue #185: the alchemy bench and post-select bar take priority over the
  // cards. While the bench is open, cards are NOT selectable (they sit behind
  // the bench panel) — the player must explicitly hit a bench button.
  const benchHit = getAlchemyBenchHit(_uiRaycaster);
  if (benchHit) {
    if (index >= 0) upgradeTriggerLatched[index] = true;
    handleAlchemyAction(benchHit);
    return;
  }
  if (isAlchemyBenchOpen()) return; // bench covers the cards — no card picks

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

      // Bombardier (Issue #199): cap concurrent floor-turrets by level
      // (1 at 7-10, 2 at 11-15, 3 at 16+) so fire lanes never overlap
      if (type === 'bombardier') {
        const bombardierCap = game.level <= 10 ? 1 : game.level <= 15 ? 2 : 3;
        if (countActiveBombardiers() >= bombardierCap) return;
      }

      // Void Anchor (Issue #198): cap concurrent gravity wells (1 at 8-11,
      // 2 at 12+) — overlapping wells make shots impossible to compensate
      if (type === 'void_anchor') {
        const anchorCap = game.level <= 11 ? 1 : 2;
        if (countActiveVoidAnchors() >= anchorCap) return;
      }

      // Void Tendril (Issue #171): weighted spawn (10% at 9-12, 15% at 13+)
      // + hard cap of 2 concurrent barriers
      if (type === 'void_tendril') {
        if (countActiveVoidTendrils() >= 2) return;
        const tendrilChance = game.level >= 13 ? 0.15 : 0.10;
        if (Math.random() > tendrilChance) return;
      }

      // Echo Phantom (Issue #169): only appears after the player fires 5+
      // shots in 3s (max 2, one per hand's aim), 15% per spawn tick
      if (type === 'echo_phantom') {
        if (countActiveEchoPhantoms() >= 2) return;
        const recentFires = _aimHistory.left.filter(s => s.fire).length +
          _aimHistory.right.filter(s => s.fire).length;
        if (recentFires < 5) return;
        if (Math.random() > 0.15) return;
        const hand = Math.random() < 0.5 ? 'left' : 'right';
        const snapshot = getAimHistorySnapshot(hand);
        if (snapshot.length === 0) return;
        const echoPos = getSpawnPosition(cfg.airSpawns, 0, null);
        spawnEchoPhantom(echoPos, hand, snapshot);
        return; // echo replaces this tick's normal spawn
      }

      // Parasitic Leech (Issue #167): weighted spawn (15% at 8-12, 20% at
      // 13+), soft cap of 4 concurrent (parents + minions)
      if (type === 'leech') {
        if (countActiveLeeches() >= 4) return;
        const leechChance = game.level >= 13 ? 0.20 : 0.15;
        if (Math.random() > leechChance) return;
      }

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

// ============================================================
// Shared camera-forward scratch for the render loop (survived the Issue #196
// beam-weapons extraction — it lives outside that module's scope)
const _playerForward = new THREE.Vector3();

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
    const mem = renderer?.info?.memory;
    const jsHeap = performance.memory ? `JS:${Math.round(performance.memory.usedJSHeapSize / 1048576)}MB` : '';
    _log(`[PERF] Projectiles: ${projectiles.length}/${MAX_PROJECTILES}, ` +
                `InstancedMesh: {${instancedCounts}}, ` +
                `Explosions: ${explosionVisuals.length}` +
                (mem ? ` | GPU geo:${mem.geometries} tex:${mem.textures}` : '') +
                (jsHeap ? ` ${jsHeap}` : ''));
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
  updateTransitionBurst(rawDt);
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

  // Issue #206: threat compass renders only during active combat — hidden
  // on the title, upgrade screens, pause, game over, etc.
  setThreatCompassVisible(st === State.PLAYING);

  // Reactive music ducking (Issue #142) — runs outside the state dispatch so
  // stem targets always match the current state (drums stop on the upgrade
  // screen, intensity swells for bosses, everything ducks on the title).
  updateReactiveMusic({
    playing: st === State.PLAYING,
    enemyCount: getEnemies().length,
    bossActive: !!getBoss(),
    comboMultiplier: game.comboMultiplier || 1,
    lowHealth: game.health <= 2,
  });

  // ── Title screen ──
  _mark('pre_state_dispatch'); // ── end: controls, seek, vr pause, desktop controls
  if (st === State.TITLE) {
    updateTitle(now);
    updateBestiary(now);
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

  // Issue #172: eclipse corruption ticking (durations + self-damage
  // drains) and the corrupted-upgrade HUD countdown
  updateEclipse(dt, now);
  updateEclipseWarning(now);

  // Issue #169: record controller aim for Echo Phantoms (every 100ms)
  sampleAimHistory(rawDt, now);

  // Issue #138: breach events — one per level, min 10s in, seeded choice
  if (game.level !== _lastBreachLevel) {
    _lastBreachLevel = game.level;
    resetBreachState();
    _levelPlayStart = now;
    // Issue #139: spawn void marks matching this level/biome
    spawnLevelVoidMarks(game.level, camera.position);
  }
  if (!_breachTriggeredThisLevel && now - _levelPlayStart > 10000 && !getBoss()) {
    _breachTriggeredThisLevel = true;
    startBreachEvent(game.seed, game.level);
  }
  updateBreachEvents(dt, now);
  updateVoidMarks(dt, now);

    // SAFEGUARD: Ensure blaster displays are visible during gameplay
    // Prevents text/billboard elements from disappearing
    blasterDisplays.forEach(d => { if (d) d.visible = false; });  // Hidden during gameplay

    spawnEnemyWave(dt);

    // Full-auto shooting / Lightning beams / Charge shots (VR controllers)
    for (let i = 0; i < 2; i++) {
      if (controllerTriggerPressed[i]) {
        const hand = getHandForController(i);
        const stats = computeWeaponStats(hand);

        if (stats.chargeShot) {
          if (chargeShotStartTime[i] === null) {
            // Start charging
            chargeShotStartTime[i] = now;
            // Issue #218: record the charge press as a fire event
            comboFireTimes[i] = now;
            comboFireLatch[i] = true;
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
          // Issue #218: record one fire event per press for timing combos
          if (!comboFireLatch[i]) {
            comboFireTimes[i] = now;
            comboFireLatch[i] = true;
          }
          // Issue #143: Tesla Tower replaces the continuous beam
          const evo = game.weaponEvolution?.[hand];
          if (evo && evo.id === 'tesla_tower') {
            updateTeslaTower(controllers[i], i, stats, evo, now);
          } else if (isBossLightningLevel()) {
            updateLightningOrbCharge(controllers[i], i, stats, now);
          } else {
            updateLightningBeam(controllers[i], i, stats, dt);
          }
        } else if (stats.windUp) {
          // Issue #143: Obliterator Beam replaces the projectile wind-up
          const evo = game.weaponEvolution?.[hand];
          if (evo && evo.id === 'obliterator_beam') {
            updateObliteratorBeam(controllers[i], i, evo, stats, now, dt);
          } else if (plasmaCarbineSpinStart[i] === null) {
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
      } else if (renderer.xr.isPresenting) {
        // VR-only trigger-release cleanup. The desktop fire path below has its
        // own complete release/cleanup handling; without this isPresenting
        // guard, chargeShotStartTime[] (and lightning/plasma state) was nulled
        // every frame on desktop, so charge shots could never accumulate charge
        // or fire on release (VR/desktop duplication divergence, see #164).
        // Trigger released - clean up charge state
        if (chargeShotStartTime[i] !== null) {
          stopChargeSound(i);
          hideChargeVisuals(i);
          if (controllers[i]) controllers[i].userData.chargeReadySoundPlayed = false;
        }
        chargeShotStartTime[i] = null;
        clearLightningBeam(i);
        clearLightningOrbCharge(i);
        // Issue #218: allow a new combo fire event on the next press
        comboFireLatch[i] = false;
        // Issue #143: hide the evolved continuous beam on release
        hideObliteratorBeam(i);
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
            const stats = computeWeaponStats('left');
            if (stats.chargeShot) {
              if (chargeShotStartTime[0] === null) {
                // Start charging
                chargeShotStartTime[0] = now;
                // Issue #218: record the charge press as a fire event
                comboFireTimes[0] = now;
                comboFireLatch[0] = true;
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
              // Issue #218: record one fire event per press for timing combos
              if (!comboFireLatch[0]) {
                comboFireTimes[0] = now;
                comboFireLatch[0] = true;
              }
              // Issue #143: Tesla Tower replaces the continuous beam
              const evo = game.weaponEvolution?.left;
              if (evo && evo.id === 'tesla_tower') {
                updateTeslaTower(virtualController, 0, stats, evo, now);
              } else if (isBossLightningLevel()) {
                updateLightningOrbCharge(virtualController, 0, stats, now);
              } else {
                updateLightningBeam(virtualController, 0, stats, dt);
              }
            } else if (stats.windUp) {
              // Issue #143: Obliterator Beam replaces the projectile wind-up
              const evo = game.weaponEvolution?.left;
              if (evo && evo.id === 'obliterator_beam') {
                updateObliteratorBeam(virtualController, 0, evo, stats, now, dt);
              } else if (plasmaCarbineSpinStart[0] === null) {
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
            const stats = computeWeaponStats('right');
            if (stats.chargeShot) {
              if (chargeShotStartTime[1] === null) {
                // Start charging
                chargeShotStartTime[1] = now;
                // Issue #218: record the charge press as a fire event
                comboFireTimes[1] = now;
                comboFireLatch[1] = true;
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
              // Issue #218: record one fire event per press for timing combos
              if (!comboFireLatch[1]) {
                comboFireTimes[1] = now;
                comboFireLatch[1] = true;
              }
              // Issue #143: Tesla Tower replaces the continuous beam
              const evo = game.weaponEvolution?.right;
              if (evo && evo.id === 'tesla_tower') {
                updateTeslaTower(virtualController, 1, stats, evo, now);
              } else if (isBossLightningLevel()) {
                updateLightningOrbCharge(virtualController, 1, stats, now);
              } else {
                updateLightningBeam(virtualController, 1, stats, dt);
              }
            } else if (stats.windUp) {
              // Issue #143: Obliterator Beam replaces the projectile wind-up
              const evo = game.weaponEvolution?.right;
              if (evo && evo.id === 'obliterator_beam') {
                updateObliteratorBeam(virtualController, 1, evo, stats, now, dt);
              } else if (plasmaCarbineSpinStart[1] === null) {
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
          const stats = computeWeaponStats('left');
          if (virtualController && stats.chargeShot) {
            const chargeTimeSec = (now - chargeShotStartTime[0]) / 1000;
            // Issue #143: Singularity Launcher replaces the beam on release;
            // Issue #213: the Overkill mastery card splits max-charge shots.
            const evo = game.weaponEvolution?.left;
            if (evo && evo.id === 'singularity_launcher') {
              fireSingularityShot(virtualController, 0, chargeTimeSec, stats, evo);
            } else if (!fireMasteryCharge(virtualController, 0, chargeTimeSec, stats, 'left')) {
              fireChargeBeam(virtualController, 0, chargeTimeSec, stats);
            }
          }
          stopChargeSound(0);
          hideChargeVisuals(0);
          if (virtualController) virtualController.userData.chargeReadySoundPlayed = false;
          chargeShotStartTime[0] = null;
        }
        if (isLightningOrbCharging(0)) {
          const virtualController = getVirtualController('left');
          const stats = computeWeaponStats('left');
          if (virtualController && stats.lightning && isBossLightningLevel()) {
            fireLightningOrb(virtualController, 0, getLightningOrbChargeSec(0, now), stats);
          }
          clearLightningOrbCharge(0);
        }
        if (chargeShotStartTime[1] !== null) {
          // Fire the charge shot on release
          const virtualController = getVirtualController('right');
          const stats = computeWeaponStats('right');
          if (virtualController && stats.chargeShot) {
            const chargeTimeSec = (now - chargeShotStartTime[1]) / 1000;
            // Issue #143: Singularity Launcher replaces the beam on release;
            // Issue #213: the Overkill mastery card splits max-charge shots.
            const evo = game.weaponEvolution?.right;
            if (evo && evo.id === 'singularity_launcher') {
              fireSingularityShot(virtualController, 1, chargeTimeSec, stats, evo);
            } else if (!fireMasteryCharge(virtualController, 1, chargeTimeSec, stats, 'right')) {
              fireChargeBeam(virtualController, 1, chargeTimeSec, stats);
            }
          }
          stopChargeSound(1);
          hideChargeVisuals(1);
          if (virtualController) virtualController.userData.chargeReadySoundPlayed = false;
          chargeShotStartTime[1] = null;
        }
        if (isLightningOrbCharging(1)) {
          const virtualController = getVirtualController('right');
          const stats = computeWeaponStats('right');
          if (virtualController && stats.lightning && isBossLightningLevel()) {
            fireLightningOrb(virtualController, 1, getLightningOrbChargeSec(1, now), stats);
          }
          clearLightningOrbCharge(1);
        }
        // Clear lightning beams
        clearLightningBeam(0);
        clearLightningBeam(1);
        // Issue #143: hide evolved continuous beams on release
        hideObliteratorBeam(0);
        hideObliteratorBeam(1);
        // Clear plasma carbine spin state
        plasmaCarbineSpinStart[0] = null;
        plasmaCarbineSpinStart[1] = null;
        // Issue #218: allow new combo fire events on the next press
        comboFireLatch[0] = false;
        comboFireLatch[1] = false;
      }
    }

    // Issue #213: Expert+ weapons get a pulsing mastery glow on their
    // controller sphere (subtle; non-Expert weapons ease back to 0.2)
    for (let hi = 0; hi < 2; hi++) {
      const hnd = hi === 0 ? 'left' : 'right';
      const v = controllers[hi]?.children.find(c => c.name === `controller-visual-${hnd}`);
      const glow = v?.children.find(c => c.name === `controller-glow-${hnd}`);
      if (!glow || !glow.material) continue;
      if (getMasteryTierIndex(game.mainWeapon[hnd]) >= 2) {
        glow.material.opacity = 0.25 + Math.sin(now * 0.008 + hi * 1.7) * 0.15;
      } else {
        glow.material.opacity += (0.2 - glow.material.opacity) * 0.05;
      }
    }

    // Threat spatial audio (Issue #184): directional per-enemy-type cues
    // via HRTF panners, listener synced to the camera for VR head tracking
    updateThreatAudio(dt, getEnemies(), getAdjustedCameraPosition(), camera);

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

    // Issue #143: evolved weapon update loops (fire trails, hive drones,
    // tesla coils, singularity wells — all early-out when empty)
    updateEvolvedSystems(now, dt, playerPos);

    // Issue #189: style meter decay + health pickup drift/collection
    updateStyleDecay(dt);
    updateHealthPickups(now, playerPos);

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

    // Issue #206: threat compass lobes from the freshly-updated enemy
    // positions (cheap: one pass + 8-slot insertion sort into scratch)
    updateThreatCompass(dt, now);

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
        // Issue #172: end all eclipses the moment the boss dies — the
        // purge wave is part of the collapse (boss.destroy() also purges).
        purgeAllEclipses();
        startBossDeathCinematic(boss);
      }
    } else {
      hideBossHealthBar();
    }
    profiler.end('boss');
    _mark('boss_update'); // ── end: boss updates + minions + health bar

    // Fix 1.9: Profile player collision handling
    // Handle enemy collisions with player
    // Fix: destroyEnemy() splices activeEnemies, shifting all higher indices.
    // Iterate collisions in REVERSE (highest index first) so earlier indices
    // stay valid — previously the 2nd+ colliding enemy destroyed the WRONG enemy.
    for (let ci = collisions.length - 1; ci >= 0; ci--) {
      const index = collisions[ci];
      const _enemy = enemies[index];
      const _enemyType = _enemy?.type || 'unknown';
      destroyEnemy(index);
      const dead = applyPlayerDamage(1);
      setKilledBy({ type: 'enemy', name: ENEMY_DISPLAY_NAMES[_enemyType] || _enemyType.toUpperCase(), enemyType: _enemyType });
      triggerHitFlash(true);
      playDamageSound();

      // Trigger camera shake
      screenFx.cameraShake = 0.5;  // 0.5 second shake duration
      screenFx.cameraShakeIntensity = 0.05;  // shake magnitude
      screenFx.originalCameraPos.copy(camera.position);

      // Light screen shake on player damage
      triggerScreenShake(0.15, 500); // 0.15 shake for 500ms

      // Trigger floor flash
      screenFx.floorFlashing = true;
      screenFx.floorFlashTimer = 1.0;

      // Reset slow-mo state
      window._timeScale = 1.0;
      window._wasCloseEnemy = false;
      timeScale = 1.0;
      _log(`[damage] Player hit! Health: ${game.health}`);
      if (dead) {
        endGame(false);
      }
    }

    // Boss collision with player
    if (boss && boss.mesh.position.distanceTo(playerPos) < 1.5) {
      const now = performance.now();
      const contactCooldown = boss.def?.contactCooldown ?? 800;
      const contactDamage = boss.def?.contactDamage ?? 2;

      if (!boss._lastContactHit || now - boss._lastContactHit >= contactCooldown) {
        boss._lastContactHit = now;
        const dead = applyPlayerDamage(contactDamage);
        setKilledBy({ type: 'boss', name: boss.def?.name || 'Boss', enemyType: boss.def?.behavior || '' });
        triggerHitFlash(true);
        playDamageSound();
        screenFx.cameraShake = 0.6;
        screenFx.cameraShakeIntensity = 0.06;
        screenFx.originalCameraPos.copy(camera.position);

        // Bigger shake for boss collision
        triggerScreenShake(0.3, 300); // 0.3 shake for 300ms

        screenFx.floorFlashing = true;
        screenFx.floorFlashTimer = 1.0;
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
            const dead = applyPlayerDamage(1);
            setKilledBy({ type: 'boss', name: boss?.def?.name || 'Boss Minion', enemyType: boss?.def?.behavior || 'minion' });
            triggerHitFlash(true);
            playDamageSound();
            triggerScreenShake(0.15, 200);
            screenFx.floorFlashing = true;
            screenFx.floorFlashTimer = 0.6;
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

      const dead = applyPlayerDamage(proj.damage || 1);
      const projBossName = proj.userData?.bossName || getBoss()?.def?.name || 'Boss';
      const projBossBehavior = proj.userData?.bossBehavior || getBoss()?.def?.behavior || '';
      setKilledBy({ type: 'boss', name: projBossName, enemyType: projBossBehavior });
      triggerHitFlash(true);
      playDamageSound();
      const _boss = getBoss();
      if (_boss && _boss.def && (_boss.def.behavior === 'skull' || _boss.def.behavior === 'minotaur' || _boss.def.behavior === 'prism')) {
        playSkullLaughSound();
      }
      screenFx.cameraShake = 0.4;
      screenFx.cameraShakeIntensity = 0.04;
      screenFx.originalCameraPos.copy(camera.position);

      // Light screen shake on projectile damage
      triggerScreenShake(0.15, 500); // 0.15 shake for 500ms

      screenFx.floorFlashing = true;
      screenFx.floorFlashTimer = 1.0;
      if (dead) endGame(false);
    }

    // Check for dead enemies (DoT ticks, conductor chain kills, black hole deaths)
    // Fix 1: collect references FIRST — destroyEnemy() splices activeEnemies,
    // so indices captured during iteration go stale after the first kill.
    // Fix 2: hp<=0 without _lastDoT (chain/black-hole kills) previously had no
    // destroy signal and left "zombie" enemies alive forever — sweep them too.
    const deadRefs = [];
    for (let ei = 0; ei < enemies.length; ei++) {
      const e = enemies[ei];
      if (e._lastDoT) {
        const colorMap = { fire: '#ff4400', shock: '#4488ff', freeze: '#88ccff', shatter: '#aaddff' };
        spawnDamageNumber(e.mesh.position, e._lastDoT.damage, colorMap[e._lastDoT.type] || '#ffffff');
        delete e._lastDoT;
      }
      if (e.hp <= 0) deadRefs.push(e);
    }
    // Kill by reference: re-resolve the (possibly shifted) index after each kill
    for (let di = 0; di < deadRefs.length; di++) {
      const idx = enemies.indexOf(deadRefs[di]);
      if (idx >= 0) {
        handleEnemyKilled(idx, { killsWithoutHit: true, skipChain: false });
      }
    }

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
        // Perf: module scratch Colors (were new THREE.Color per frame in cinematic)
        synthVisualRefs.terrainUniforms.uGridColor.value.copy(game._cinOrigGridColor).lerp(_cinRedGrid, t);
        synthVisualRefs.terrainUniforms.uBaseColor.value.copy(game._cinOrigBaseColor).lerp(_cinRedBase, t);
        synthVisualRefs.terrainUniforms.uFogColor.value.copy(game._cinOrigFogColor).lerp(_cinRedFog, t);
        if (game._cinOrigPulseA) {
          synthVisualRefs.terrainUniforms.uPulseColorA.value.copy(game._cinOrigPulseA).lerp(_cinRedPulseA, t);
        }
        if (game._cinOrigPulseB) {
          synthVisualRefs.terrainUniforms.uPulseColorB.value.copy(game._cinOrigPulseB).lerp(_cinRedPulseB, t);
        }
      }

      // 4b. Fade skydome gradient to dark reds (~30% darker than original brightness)
      if (game._cinSkyMat && game._cinSkyMat.uniforms) {
        const su = game._cinSkyMat.uniforms;
        if (su.topColor && game._cinOrigSkyTopColor) {
          su.topColor.value.copy(game._cinOrigSkyTopColor).lerp(_cinRedTop, t);
        }
        if (su.midColor && game._cinOrigSkyMidColor) {
          su.midColor.value.copy(game._cinOrigSkyMidColor).lerp(_cinRedMid, t);
        }
        if (su.horizonColor && game._cinOrigSkyHorizonColor) {
          su.horizonColor.value.copy(game._cinOrigSkyHorizonColor).lerp(_cinRedHorizon, t);
        }
        if (su.glowColor && game._cinOrigSkyGlowColor) {
          su.glowColor.value.copy(game._cinOrigSkyGlowColor).lerp(_cinRedGlow, t);
        }
        if (su.moonGlowColor && game._cinOrigSkyMoonGlowColor) {
          su.moonGlowColor.value.copy(game._cinOrigSkyMoonGlowColor).lerp(_cinRedMoonGlow, t);
        }
      }

      // 5. Shift sun glow materials to red
      if (synthVisualRefs.sunOuterGlowMat) {
        synthVisualRefs.sunOuterGlowMat.color.lerp(_cinRedSunOuter, t * 0.1);
      }
      if (synthVisualRefs.sunGlowMat) {
        synthVisualRefs.sunGlowMat.color.lerp(_cinRedSunGlow, t * 0.1);
      }
      if (synthVisualRefs.sunCoreMat) {
        synthVisualRefs.sunCoreMat.color.lerp(_cinRedSunCore, t * 0.1);
      }
      if (synthVisualRefs.sunReflMat) {
        synthVisualRefs.sunReflMat.color.lerp(_cinRedSunRefl, t * 0.1);
      }
      if (synthVisualRefs.horizonGlowMat) {
        synthVisualRefs.horizonGlowMat.color.lerp(_cinRedHorizonGlow, t * 0.1);
      }

      // 6. Tint mountain wrap cylinder to red during cinematic
      if (synthVisualRefs.mountainCylMat && game._cinOrigMountainColor) {
        synthVisualRefs.mountainCylMat.color.copy(game._cinOrigMountainColor).lerp(_cinRedMountain, t);
      }

      // 7. Desert biome: tint moon and moon glow red (Prism Boss)
      if (synthVisualRefs.desertMoonMat && !game._cinOrigDesertMoonColor) {
        game._cinOrigDesertMoonColor = synthVisualRefs.desertMoonMat.color.clone();
      }
      if (synthVisualRefs.desertMoonMat && game._cinOrigDesertMoonColor) {
        synthVisualRefs.desertMoonMat.color.copy(game._cinOrigDesertMoonColor).lerp(_cinRedDesertMoon, t);
      }
      if (synthVisualRefs.desertMoonGlowMat && !game._cinOrigDesertMoonGlowColor) {
        game._cinOrigDesertMoonGlowColor = synthVisualRefs.desertMoonGlowMat.color.clone();
      }
      if (synthVisualRefs.desertMoonGlowMat && game._cinOrigDesertMoonGlowColor) {
        synthVisualRefs.desertMoonGlowMat.color.copy(game._cinOrigDesertMoonGlowColor).lerp(_cinRedDesertMoonGlow, t);
      }

      // 8. Alien biome: tint city buildings and green light red (Minotaur)
      if (synthVisualRefs.alienCityShaderMat && !game._cinOrigAlienMoonColor) {
        game._cinOrigAlienMoonColor = synthVisualRefs.alienCityShaderMat.uniforms.uMoonColor.value.clone();
        game._cinOrigAlienBaseColor = synthVisualRefs.alienCityShaderMat.uniforms.uBaseColor.value.clone();
      }
      if (synthVisualRefs.alienCityShaderMat && game._cinOrigAlienMoonColor) {
        synthVisualRefs.alienCityShaderMat.uniforms.uMoonColor.value.copy(game._cinOrigAlienMoonColor).lerp(_cinRedAlienMoon, t);
        synthVisualRefs.alienCityShaderMat.uniforms.uBaseColor.value.copy(game._cinOrigAlienBaseColor).lerp(_cinRedAlienBase, t);
      }
      if (synthVisualRefs.alienGreenLight && !game._cinOrigAlienGreenLightColor) {
        game._cinOrigAlienGreenLightColor = synthVisualRefs.alienGreenLight.color.clone();
      }
      if (synthVisualRefs.alienGreenLight && game._cinOrigAlienGreenLightColor) {
        synthVisualRefs.alienGreenLight.color.copy(game._cinOrigAlienGreenLightColor).lerp(_cinRedAlienGreen, t);
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

    // Issue #143: evolution cinematic runs on top of the upgrade screen
    // (cheap no-op when no cinematic is active)
    updateEvolutionCinematic(now, dt);

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

    // Update wrist holograms with live data (disabled - using original blasterDisplay system)
    // updateWristHolograms(game.handStats, game.upgrades, game.mainWeapon);
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

  // ── Environment fade transitions (state owned by environment-orchestration.js) ──
  updateEnvironmentFade(rawDt);

  // ── Camera shake on damage ──
  // NOTE: Skip camera position modification in VR - WebXR controls camera position
  // and modifying it directly causes fighting/alternation with headset tracking
  if (screenFx.cameraShake > 0 && !renderer.xr.isPresenting) {
    screenFx.cameraShake -= rawDt;
    if (screenFx.cameraShake <= 0) {
      screenFx.cameraShake = 0;
    } else {
      // Apply random shake offset (desktop only)
      const shake = screenFx.cameraShakeIntensity * (screenFx.cameraShake / 0.5);  // Fade out over duration
      camera.position.x += (Math.random() - 0.5) * shake;
      camera.position.y += (Math.random() - 0.5) * shake;
      camera.position.z += (Math.random() - 0.5) * shake;
    }
  } else if (screenFx.cameraShake > 0) {
    // In VR, just decrement timer without modifying camera position
    screenFx.cameraShake -= rawDt;
    if (screenFx.cameraShake <= 0) screenFx.cameraShake = 0;
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
  if (screenFx.floorFlashing) {
    screenFx.floorFlashTimer -= rawDt;
    if (screenFx.floorFlashTimer <= 0) {
      screenFx.floorFlashing = false;
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
      const t = screenFx.floorFlashTimer / 0.3;  // 0.3s flash duration (VR comfort)
      const flashIntensity = t;  // 0 to 1, fading out
      // Perf: module scratch Color (was new THREE.Color per frame while flashing)
      const flashColor = _floorFlashColor;
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
  if (!screenFx.floorFlashing && lowHealthWarningActive && floorMaterial) {
    lowHealthPulseTimer += rawDt;
    const pulse = (Math.sin(lowHealthPulseTimer * 2.6) + 1) * 0.5;
    const intensity = 0.2 + pulse * 0.45;
    // Perf: module scratch Color (was new THREE.Color per frame while pulsing)
    const warningColor = _lowHealthWarningColor;
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
  // (owned by projectile-system.js in the Issue #196 refactor)
  updateDebrisGlow(camera);
  profiler.end('voxelDebris');
  if (activeShields.length > 0) updateShields(now);
  if (activeStasisFields.length > 0) updateStasisFields(now, dt);
  if (activePlasmaOrbs.length > 0) updatePlasmaOrbs(now, dt);
  updateLightningOrbs(dt, now);
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
  // Perf: only write style.display when the value actually changes (DOM writes
  // are layout-invalidating; this used to write every frame)
  if (_cachedScanlinesEl) {
    const shouldShow = !renderer.xr.isPresenting;
    if (_scanlinesDisplayShown !== shouldShow) {
      _scanlinesDisplayShown = shouldShow;
      _cachedScanlinesEl.style.display = shouldShow ? '' : 'none';
    }
  }

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
