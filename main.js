// ============================================================
//  SYNTHWAVE VR BLASTER - Babylon.js Port (main.js)
//  Build: WARRANT
//  Babylon.js Port v0.2.5 - Agent Output Workflow
// ============================================================

import * as BABYLON from '@babylonjs/core';
import '@babylonjs/gui';
import '@babylonjs/loaders/glTF/2.0/glTFLoader';
import { resumeAudioContext, playShoothSound, playHitSound, playExplosionSound, playDamageSound, playUpgradeSound, playMenuClick, playMusic, stopMusic, playBossSpawn, playBossAlertSound, playSlowMoSound, playSlowMoReverseSound, playGameOverSound, playRocketSound, playLightningSound, playChargeSound, playPlasmaSound, playSeekerSound, playShieldSound, playGravityWellSound } from './audio.js';
import * as game from './game.js';
import { getSpecialUpgradesForBossTier, getWeaponStats, getRandomUpgrades, getRandomSpecialUpgrades, WEAPON_TYPES, ALT_WEAPON_DEFS, getWeaponType } from './upgrades.js';
import * as enemies from './enemies.js';
import * as hud from './hud.js';

// ── Global Variables ─────────────────────────────────────────
let engine;
let scene;
let xr;
let xrCamera;
let controllers = { left: null, right: null };
let xrControllers = { left: null, right: null };  // WebXRInputSource references
let frameCount = 0;
let lastTime = 0;
let delta = 0;
let gameState = null;

// Performance monitoring
let perfMonitor = { fps: 0, frameTime: 0 };
let perfMonitorEnabled = false;

// Debug flags
window.debugJumpToLevel = null;
window.debugPerfMonitor = false;

// Shooting state per hand
const weaponState = {
  left: { 
    lastFireTime: 0, 
    chargeStartTime: 0, 
    isCharging: false,
    shotCount: 0,  // For Nova Tip
    lastChargeFireTime: 0,  // For Excess Heat
    plasmaRamp: 0,  // For Plasma Carbine ramping
  },
  right: { 
    lastFireTime: 0, 
    chargeStartTime: 0, 
    isCharging: false,
    shotCount: 0,
    lastChargeFireTime: 0,
    plasmaRamp: 0,
  }
};

// Alt weapon state per hand
const altWeaponState = {
  left: {
    equipped: null,  // Current alt weapon type
    cooldownEnd: 0,  // Timestamp when cooldown ends
    active: false,   // Is alt weapon currently active?
    activeUntil: 0,  // Timestamp when active effect ends
    charges: 0,      // For shield (hit counter)
  },
  right: {
    equipped: null,
    cooldownEnd: 0,
    active: false,
    activeUntil: 0,
    charges: 0,
  }
};

// Projectiles
const projectiles = [];
const projectileMeshPools = {
  standard: [],
  seeker: [],
  plasma: [],
  bot: [],
  charge: [],
};
const projectileMaterials = {};

// Alt weapon entities (rockets, gravity wells, etc.)
const altWeaponEntities = [];

// Weapon pickups (dropped by enemies)
const weaponPickups = [];

// Charge indicator meshes per hand
const chargeIndicators = { left: null, right: null };

// Lightning beam lines per hand
const lightningBeams = { left: null, right: null };

// Shield meshes per hand
const shieldMeshes = { left: null, right: null };

// Gravity well active effect
const gravityWells = [];

// Helper bots
const helperBots = [];

// Hologram decoys
const holograms = [];

// Level state
let spawnTimer = 0;
let levelStartTime = 0;
let upgradeCooldown = 0;
const UPGRADE_COOLDOWN_TIME = 1.5;

// Reflex buff tracking
let reflexBuffUntil = 0;

// Boss types per tier
const BOSS_TYPES = {
  1: ['grave_voxel', 'iron_sentry', 'chrono_wraith', 'siege_ram', 'core_guardian'],
  2: ['grave_voxel2', 'iron_sentry2', 'chrono_wraith2', 'siege_ram2', 'core_guardian2'],
  3: ['grave_voxel3', 'iron_sentry3', 'chrono_wraith3', 'siege_ram3', 'core_guardian3'],
  4: ['grave_voxel4', 'iron_sentry4', 'chrono_wraith4', 'siege_ram4', 'core_guardian4'],
};

// Pickup drop chance (percentage)
const PICKUP_DROP_CHANCE = 0.08;  // 8% chance per kill

// ── Initialization ───────────────────────────────────────────
async function init() {
  console.log('[main] Initializing Babylon.js...');
  
  const canvas = document.getElementById('renderCanvas');
  if (!canvas) {
    console.error('[main] Canvas element not found!');
    return;
  }

  engine = new BABYLON.Engine(canvas, true, {
    preserveDrawingBuffer: true,
    stencil: true,
  });
  
  console.log('[main] Engine created:', engine.getFps().toFixed(1), 'FPS');

  scene = await createScene();
  
  // Initialize game state
  gameState = game.init();
  console.log('[main] Game state initialized, state:', gameState.state);
  
  // Initialize enemy system
  enemies.initEnemies(scene);
  console.log('[main] Enemy system initialized');
  
  window.addEventListener('resize', () => engine.resize());

  engine.runRenderLoop(() => {
    renderLoop();
  });

  console.log('[main] Babylon.js initialized successfully!');
}

// ── Scene Creation ───────────────────────────────────────────
async function createScene() {
  const scene = new BABYLON.Scene(engine);
  scene.clearColor = new BABYLON.Color4(0, 0, 0, 1);
  
  const camera = new BABYLON.FreeCamera('camera', new BABYLON.Vector3(0, 1.6, 0), scene);
  camera.attachControl(document.getElementById('renderCanvas'), true);

  const hemisphericLight = new BABYLON.HemisphericLight('light', new BABYLON.Vector3(0, 1, 0), scene);
  hemisphericLight.intensity = 0.5;

  scene.fogMode = BABYLON.Scene.FOGMODE_EXP2;
  scene.fogDensity = 0.008;
  scene.fogColor = new BABYLON.Color3(0, 0, 0);

  createEnvironment(scene);
  await setupWebXR(scene);

  return scene;
}

// ── Environment Setup ───────────────────────────────────────
function createEnvironment(scene) {
  console.log('[main] Creating environment...');
  createGridFloor(scene);
  createStarField(scene);

  // Sun
  const sun = BABYLON.MeshBuilder.CreatePlane('sun', { width: 30, height: 30 }, scene);
  sun.position = new BABYLON.Vector3(0, 15, -100);
  const sunMat = new BABYLON.StandardMaterial('sunMat', scene);
  sunMat.disableLighting = true;
  sunMat.emissiveColor = new BABYLON.Color3(1, 0.4, 0.2);
  sun.material = sunMat;

  for (let i = 0; i < 8; i++) {
    const band = BABYLON.MeshBuilder.CreatePlane('sunBand' + i, { width: 30, height: 1.5 }, scene);
    band.position = new BABYLON.Vector3(0, 15 - (i * 1.8), -99.5);
    const bandMat = new BABYLON.StandardMaterial('sunBandMat' + i, scene);
    bandMat.disableLighting = true;
    const colorIntensity = 0.3 + (i * 0.1);
    bandMat.emissiveColor = new BABYLON.Color3(1, colorIntensity * 0.4, colorIntensity * 0.2);
    band.material = bandMat;
  }

  createWireframeMountains(scene);
  console.log('[main] Environment created');
}

function createGridFloor(scene) {
  const gridSize = 200;
  const divisions = 40;
  const step = gridSize / divisions;
  const gridLines = [];

  for (let i = -divisions / 2; i <= divisions / 2; i++) {
    gridLines.push([
      new BABYLON.Vector3(-gridSize / 2, 0, i * step),
      new BABYLON.Vector3(gridSize / 2, 0, i * step)
    ]);
  }

  for (let i = -divisions / 2; i <= divisions / 2; i++) {
    gridLines.push([
      new BABYLON.Vector3(i * step, 0, -gridSize / 2),
      new BABYLON.Vector3(i * step, 0, gridSize / 2)
    ]);
  }

  const lineSystem = BABYLON.MeshBuilder.CreateLineSystem('grid', { lines: gridLines }, scene);
  lineSystem.color = new BABYLON.Color3(1, 0, 1);
  lineSystem.isPickable = false;
}

function createStarField(scene) {
  const starCount = 2000;
  const particleSystem = new BABYLON.ParticleSystem('stars', starCount, scene);
  
  const starTexture = new BABYLON.DynamicTexture('starTex', 32, scene);
  const ctx = starTexture.getContext();
  ctx.fillStyle = 'white';
  ctx.beginPath();
  ctx.arc(16, 16, 8, 0, Math.PI * 2);
  ctx.fill();
  starTexture.update();
  particleSystem.particleTexture = starTexture;
  
  particleSystem.createBoxEmitter(
    new BABYLON.Vector3(0, -0.1, 0),
    new BABYLON.Vector3(0, -0.1, 0),
    new BABYLON.Vector3(-100, 5, -100),
    new BABYLON.Vector3(100, 55, 100)
  );
  
  particleSystem.minSize = 0.1;
  particleSystem.maxSize = 0.3;
  particleSystem.minLifeTime = 999999;
  particleSystem.maxLifeTime = 999999;
  particleSystem.emitRate = 0;
  particleSystem.manualEmitCount = starCount;
  particleSystem.color1 = new BABYLON.Color4(1, 1, 1, 1);
  particleSystem.color2 = new BABYLON.Color4(0.9, 0.9, 1, 1);
  particleSystem.colorDead = new BABYLON.Color4(1, 1, 1, 1);
  particleSystem.minEmitPower = 0;
  particleSystem.maxEmitPower = 0;
  particleSystem.updateSpeed = 0;
  particleSystem.blendMode = BABYLON.ParticleSystem.BLENDMODE_ADD;
  particleSystem.start();
}

function createWireframeMountains(scene) {
  const mountainCount = 12;
  const radius = 80;

  for (let i = 0; i < mountainCount; i++) {
    const angle = (i / mountainCount) * Math.PI * 2;
    const x = Math.cos(angle) * radius;
    const z = Math.sin(angle) * radius;

    const height = 15 + Math.random() * 20;
    const mountain = BABYLON.MeshBuilder.CreateCylinder('mountain' + i, {
      diameterTop: 0,
      diameterBottom: 20 + Math.random() * 10,
      height: height,
      tessellation: 4
    }, scene);
    
    mountain.position = new BABYLON.Vector3(x, height / 2, z);
    mountain.rotation.y = angle + Math.PI / 4;
    mountain.isPickable = false;

    const mountainMat = new BABYLON.StandardMaterial('mountainMat' + i, scene);
    mountainMat.wireframe = true;
    mountainMat.disableLighting = true;
    mountainMat.emissiveColor = new BABYLON.Color3(0, 1, 1);
    mountain.material = mountainMat;
  }
}

// ── WebXR Setup ────────────────────────────────────────────
async function setupWebXR(scene) {
  console.log('[main] Setting up WebXR...');

  try {
    const xrExperience = await scene.createDefaultXRExperienceAsync({
      floorMeshes: [],
      disableTeleportation: true,
      inputOptions: {
        doNotLoadControllerMeshes: true,
      },
    });

    console.log('[main] WebXR experience created');
    xr = xrExperience;
    
    if (!xr.baseExperience) {
      console.warn('[main] WebXR not supported');
      document.getElementById('no-vr').style.display = 'block';
      return;
    }

    xr.baseExperience.onStateChangedObservable.add((state) => {
      console.log('[main] XR state changed:', state);
      
      if (state === BABYLON.WebXRState.IN_XR) {
        console.log('[main] Entered VR session');
        xrCamera = xr.baseExperience.camera;
        resumeAudioContext();
        
        // Initialize HUD with XR camera
        hud.initHUD(xrCamera, scene);
        hud.showTitle();
        
        document.getElementById('scanlines').style.display = 'none';
        document.getElementById('info').style.display = 'none';
        
        // Start menu music
        playMusic('menu');
      } else if (state === BABYLON.WebXRState.NOT_IN_XR) {
        console.log('[main] Exited VR session');
        document.getElementById('scanlines').style.display = 'block';
        document.getElementById('info').style.display = 'block';
      }
    });

    xr.input.onControllerAddedObservable.add((controller) => {
      console.log('[main] Controller added:', controller.uniqueId);
      setupController(controller);
    });

    xr.input.onControllerRemovedObservable.add((controller) => {
      console.log('[main] Controller removed:', controller.uniqueId);
      const h = controller.inputSource?.handedness;
      if (h === 'left') { controllers.left = null; xrControllers.left = null; }
      if (h === 'right') { controllers.right = null; xrControllers.right = null; }
    });
  } catch (err) {
    console.error('[main] WebXR setup failed:', err);
    document.getElementById('no-vr').style.display = 'block';
  }
}

// ── Controller Setup ───────────────────────────────────────
function setupController(controller) {
  controller.onMotionControllerInitObservable.add((motionController) => {
    console.log('[main] Motion controller initialized:', motionController.handedness);
    
    const handedness = motionController.handedness;
    
    if (handedness === 'left') { controllers.left = motionController; xrControllers.left = controller; }
    if (handedness === 'right') { controllers.right = motionController; xrControllers.right = controller; }

    // Hide default mesh
    const hideDefaultMesh = () => {
      if (motionController.rootMesh) {
        motionController.rootMesh.scaling = new BABYLON.Vector3(0, 0, 0);
      }
    };
    hideDefaultMesh();
    controller.onMeshLoadedObservable.add(() => hideDefaultMesh());

    createCustomBlaster(controller, handedness);
    createChargeIndicator(controller, handedness);
    createShieldMesh(handedness);
    createLightningBeam(handedness);
    setupButtonListeners(motionController);
  });
}

// ── Custom Blaster Creation ───────────────────────────────
function createCustomBlaster(xrController, handedness) {
  const sphere = BABYLON.MeshBuilder.CreateSphere('blaster_' + handedness, {
    diameter: 0.04
  }, scene);
  sphere.position = new BABYLON.Vector3(0, 0, 0);
  sphere.parent = xrController.grip;

  const blasterMat = new BABYLON.StandardMaterial('blasterMat_' + handedness, scene);
  blasterMat.disableLighting = true;
  blasterMat.emissiveColor = new BABYLON.Color3(0, 1, 1);
  sphere.material = blasterMat;

  const aimPoints = [
    new BABYLON.Vector3(0, 0, 0),
    new BABYLON.Vector3(0, 0, 2)
  ];
  const aimLine = BABYLON.MeshBuilder.CreateLines('aimLine_' + handedness, { points: aimPoints }, scene);
  aimLine.color = new BABYLON.Color3(0, 1, 1);
  aimLine.parent = xrController.grip;
  aimLine.isPickable = false;
}

// ── Charge Indicator ───────────────────────────────────────
function createChargeIndicator(xrController, handedness) {
  // Create a ring that expands as charge builds
  const indicator = BABYLON.MeshBuilder.CreateTorus('chargeIndicator_' + handedness, {
    diameter: 0.06,
    thickness: 0.008,
    tessellation: 16
  }, scene);
  indicator.position = new BABYLON.Vector3(0, 0, 0.2);
  indicator.parent = xrController.grip;
  indicator.isVisible = false;
  
  const mat = new BABYLON.StandardMaterial('chargeIndicatorMat_' + handedness, scene);
  mat.disableLighting = true;
  mat.emissiveColor = new BABYLON.Color3(1, 1, 1);
  indicator.material = mat;
  
  chargeIndicators[handedness] = indicator;
}

// ── Shield Mesh ─────────────────────────────────────────────
function createShieldMesh(handedness) {
  const shield = BABYLON.MeshBuilder.CreateDisc('shield_' + handedness, {
    radius: 0.4,
    tessellation: 6  // Hexagon
  }, scene);
  shield.rotation.x = Math.PI / 2;
  shield.position = new BABYLON.Vector3(0, 0, 0.3);
  shield.isVisible = false;
  shield.isPickable = false;
  
  const mat = new BABYLON.StandardMaterial('shieldMat_' + handedness, scene);
  mat.disableLighting = true;
  mat.emissiveColor = new BABYLON.Color3(0.3, 0.5, 1);
  shield.material = mat;
  
  shieldMeshes[handedness] = shield;
}

// ── Lightning Beam ──────────────────────────────────────────
function createLightningBeam(handedness) {
  // Create line system for lightning effect
  const points = [
    new BABYLON.Vector3(0, 0, 0),
    new BABYLON.Vector3(0, 0, 8)
  ];
  const line = BABYLON.MeshBuilder.CreateLines('lightningBeam_' + handedness, { points }, scene);
  line.color = new BABYLON.Color3(1, 1, 0);
  line.isVisible = false;
  line.isPickable = false;
  
  lightningBeams[handedness] = line;
}

// ── Button Listeners ───────────────────────────────────────
function setupButtonListeners(motionController) {
  const trigger = motionController.getComponent('xr-standard-trigger');
  if (trigger) {
    trigger.onButtonStateChangedObservable.add((component) => {
      if (component.changes.pressed) {
        const hand = motionController.handedness;
        if (component.pressed) {
          handleTriggerPressed(hand);
        } else {
          handleTriggerReleased(hand);
        }
      }
    });
  }

  const squeeze = motionController.getComponent('xr-standard-squeeze');
  if (squeeze) {
    squeeze.onButtonStateChangedObservable.add((component) => {
      if (component.changes.pressed && component.pressed) {
        handleSqueezePressed(motionController.handedness);
      }
    });
  }

  const menuButton = motionController.getComponent('xr-standard-menu');
  if (menuButton) {
    menuButton.onButtonStateChangedObservable.add((component) => {
      if (component.changes.pressed && component.pressed && motionController.handedness === 'left') {
        handlePause();
      }
    });
  }
}

function getControllerForward(xrController) {
  if (!xrController || !xrController.pointer) return new BABYLON.Vector3(0, 0, 1);
  const forward = new BABYLON.Vector3(0, 0, 1);
  const worldMatrix = xrController.pointer.getWorldMatrix();
  return BABYLON.Vector3.TransformNormal(forward, worldMatrix).normalize();
}

function getControllerRay(xrController, length = 100) {
  if (!xrController || !xrController.pointer) return null;
  const direction = getControllerForward(xrController);
  if (!direction) return null;
  const origin = xrController.pointer.absolutePosition.clone();
  return new BABYLON.Ray(origin, direction, length);
}

// ── Input Handlers ──────────────────────────────────────────
function handleTriggerPressed(hand) {
  const state = gameState.state;
  
  // Title screen - start game
  if (state === game.State.TITLE) {
    startGame();
    return;
  }
  
  // Game over - restart
  if (state === game.State.GAME_OVER || state === game.State.VICTORY) {
    restartGame();
    return;
  }
  
  // Upgrade selection
  if (state === game.State.UPGRADE_SELECT) {
    selectUpgrade(hand);
    return;
  }
  
  // Name entry
  if (state === game.State.NAME_ENTRY) {
    submitNameEntry();
    return;
  }
  
  // Playing - fire weapon or start charging
  if (state === game.State.PLAYING || state === game.State.BOSS_FIGHT) {
    const ws = weaponState[hand];
    ws.isCharging = true;
    ws.chargeStartTime = performance.now();
    
    // For non-charge weapons, fire immediately
    const stats = getWeaponStats(gameState.upgrades[hand] || {}, gameState.globalUpgrades || {});
    if (!stats.chargeShot) {
      fireWeapon(hand);
    }
  }
}

function handleTriggerReleased(hand) {
  const ws = weaponState[hand];
  
  // Check for charge shot release
  if (ws.isCharging && (gameState.state === game.State.PLAYING || gameState.state === game.State.BOSS_FIGHT)) {
    const stats = getWeaponStats(gameState.upgrades[hand] || {}, gameState.globalUpgrades || {});
    
    if (stats.chargeShot) {
      // Fire charge shot based on how long we charged
      const chargeDuration = performance.now() - ws.chargeStartTime;
      const chargePercent = Math.min(1, chargeDuration / stats.chargeTime);
      
      if (chargePercent > 0.2) {  // Minimum 20% charge to fire
        fireChargeShot(hand, chargePercent, stats);
      }
    }
    
    ws.isCharging = false;
    
    // Hide charge indicator
    if (chargeIndicators[hand]) {
      chargeIndicators[hand].isVisible = false;
    }
  }
}

function handleSqueezePressed(hand) {
  // Alt weapon fire
  if (gameState.state === game.State.PLAYING || gameState.state === game.State.BOSS_FIGHT) {
    fireAltWeapon(hand);
  }
}

function handlePause() {
  if (gameState.state === game.State.PLAYING) {
    game.setState(game.State.PAUSED);
  } else if (gameState.state === game.State.PAUSED) {
    game.setState(game.State.PLAYING);
  }
}

function resetWeaponState() {
  ['left', 'right'].forEach(hand => {
    weaponState[hand].isCharging = false;
    weaponState[hand].chargeStartTime = 0;
    weaponState[hand].plasmaRamp = 0;

    if (chargeIndicators[hand]) chargeIndicators[hand].isVisible = false;
    if (lightningBeams[hand]) lightningBeams[hand].isVisible = false;
  });
}

function clearActiveProjectiles() {
  projectiles.forEach(proj => releaseProjectile(proj));
  projectiles.length = 0;
}

function clearAltWeaponProjectiles() {
  altWeaponEntities.forEach(entity => {
    if (entity.mesh) entity.mesh.dispose();
    if (entity.particles) entity.particles.dispose();
  });
  altWeaponEntities.length = 0;
}

// ── Game Flow ───────────────────────────────────────────────
function startGame() {
  console.log('[main] Starting game!');
  
  // Check for debug jump
  if (window.debugJumpToLevel) {
    game.setLevel(window.debugJumpToLevel - 1);
    console.log('[main] Debug jump to level:', window.debugJumpToLevel);
  }
  
  game.startGame();
  hud.hideTitle();
  hud.showHUD();
  
  stopMusic();
  playMusic('levels1to5');
  
  startLevel();
}

function restartGame() {
  console.log('[main] Restarting game');
  resetWeaponState();
  
  enemies.clearAllEnemies();
  enemies.clearBoss();
  game.reset();
  
  // Clear all projectiles and pickups
  projectiles.forEach(p => releaseProjectile(p));
  projectiles.length = 0;
  
  weaponPickups.forEach(p => {
    if (p.mesh) p.mesh.dispose();
    if (p.particles) p.particles.dispose();
  });
  weaponPickups.length = 0;
  
  altWeaponEntities.forEach(e => {
    if (e.mesh) e.mesh.dispose();
    if (e.particles) e.particles.dispose();
  });
  altWeaponEntities.length = 0;
  
  gravityWells.forEach(g => {
    if (g.mesh) g.mesh.dispose();
    if (g.particles) g.particles.dispose();
  });
  gravityWells.length = 0;
  
  helperBots.forEach(h => {
    if (h.mesh) h.mesh.dispose();
  });
  helperBots.length = 0;
  
  holograms.forEach(h => {
    if (h.mesh) h.mesh.dispose();
  });
  holograms.length = 0;
  
  // Reset alt weapon state
  altWeaponState.left = { equipped: null, cooldownEnd: 0, active: false, activeUntil: 0, charges: 0 };
  altWeaponState.right = { equipped: null, cooldownEnd: 0, active: false, activeUntil: 0, charges: 0 };
  
  hud.hideGameOver();
  hud.showTitle();
  
  stopMusic();
  playMusic('menu');
}

function startLevel() {
  const level = gameState.level;
  console.log('[main] Starting level:', level);
  
  game.startLevel();
  levelStartTime = performance.now();
  spawnTimer = 0;
  
  // Reset plasma ramp
  weaponState.left.plasmaRamp = 0;
  weaponState.right.plasmaRamp = 0;
  
  // Boss levels
  if (level % 5 === 0) {
    const tier = level / 5;
    startBossFight(tier);
  }
}

function startBossFight(tier) {
  console.log('[main] Starting boss fight, tier:', tier);
  resetWeaponState();
  clearActiveProjectiles();
  
  game.setState(game.State.BOSS_ALERT);
  hud.showBossAlert();
  playBossAlertSound();
  
  // Spawn boss after alert
  setTimeout(() => {
    hud.hideBossAlert();
    
    const bossTypes = BOSS_TYPES[tier] || BOSS_TYPES[1];
    const bossType = bossTypes[Math.floor(Math.random() * bossTypes.length)];
    
    enemies.spawnBoss(bossType, gameState._levelConfig);
    game.setState(game.State.BOSS_FIGHT);
    
    const boss = enemies.getBoss();
    if (boss) {
      hud.showBossHealthBar(boss.hp, boss.maxHp, boss.phases);
    }
    
    // Boss music
    stopMusic();
    const bossMusicKey = `boss${tier * 5}`;
    playMusic(bossMusicKey);
    
    playBossSpawn();
  }, 2500);
}

function completeLevel() {
  console.log('[main] Level complete!');
  resetWeaponState();
  
  game.completeLevel();
  enemies.clearAllEnemies();
  clearActiveProjectiles();
  clearAltWeaponProjectiles();
  
  hud.showLevelComplete(gameState.level, getPlayerPosition());
  playSlowMoSound();
  
  // Transition to upgrade selection after delay
  setTimeout(() => {
    hud.hideLevelComplete();
    showUpgradeSelection();
  }, 2000);
}

function showUpgradeSelection() {
  resetWeaponState();
  const level = gameState.level;
  const hand = gameState.lastUpgradeHand || 'left';
  
  // Get appropriate upgrades
  let upgrades;
  if (level % 5 === 0) {
    // After boss - special upgrades
    const tier = level / 5;
    upgrades = getSpecialUpgradesForBossTier(tier, 3);
  } else {
    upgrades = getRandomUpgrades(3);
  }
  
  game.setState(game.State.UPGRADE_SELECT);
  upgradeCooldown = UPGRADE_COOLDOWN_TIME;
  
  hud.showUpgradeCards(upgrades, getPlayerPosition(), hand);
  playMenuClick();
}

function selectUpgrade(hand) {
  if (upgradeCooldown > 0) return;
  
  // Get controller pose for raycasting
  const xrController = xrControllers[hand];
  if (!xrController) return;
  
  // Create ray from controller
  const ray = getControllerRay(xrController);
  if (!ray) return;
  
  const hit = hud.getUpgradeCardHit(ray);
  if (hit && hit.upgrade) {
    applyUpgrade(hit.upgrade, hit.hand);
    hud.hideUpgradeCards();
    
    // Check for side-grade (triggers another upgrade selection)
    if (hit.upgrade.sideGrade) {
      setTimeout(() => {
        const newUpgrades = getRandomUpgrades(3);
        hud.showUpgradeCards(newUpgrades, getPlayerPosition(), hit.hand);
      }, 500);
    } else {
      // Continue to next level or playing state
      if (gameState.level >= 20) {
        victory();
      } else {
        game.setState(game.State.PLAYING);
        game.nextLevel();
        startLevel();
      }
    }
  }
}

function applyUpgrade(upgrade, hand) {
  if (upgrade.id === 'SKIP') {
    // Full health
    gameState.health = gameState.maxHealth;
    playUpgradeSound();
    return;
  }
  
  game.addUpgrade(upgrade.id, hand);
  playUpgradeSound();
  console.log('[main] Applied upgrade:', upgrade.id, 'to', hand);
}

function submitNameEntry() {
  const name = hud.getNameEntryName();
  if (name.length > 0) {
    game.setName(name);
    hud.hideNameEntry();
    // Show scoreboard (simplified)
    game.setState(game.State.SCOREBOARD);
  }
}

function victory() {
  console.log('[main] VICTORY!');
  resetWeaponState();
  game.setState(game.State.VICTORY);
  hud.showVictory(gameState.score, getPlayerPosition());
  stopMusic();
}

function gameOver() {
  console.log('[main] GAME OVER');
  resetWeaponState();
  game.setState(game.State.GAME_OVER);
  hud.showGameOver(gameState.score, getPlayerPosition());
  enemies.clearAllEnemies();
  stopMusic();
  playGameOverSound();
}

// ── Combat System ───────────────────────────────────────────
function fireWeapon(hand) {
  const now = performance.now();
  const ws = weaponState[hand];
  
  // Get weapon stats
  const stats = getWeaponStats(gameState.upgrades[hand] || {}, gameState.globalUpgrades || {});
  
  // Fire rate check with Reflex bonus
  let effectiveInterval = stats.fireInterval;
  if (stats.reflexBonus && now < reflexBuffUntil) {
    effectiveInterval *= 0.5;  // Double fire rate
  }
  
  if (now - ws.lastFireTime < effectiveInterval) return;
  ws.lastFireTime = now;
  
  // Get controller position and direction
  const xrController = xrControllers[hand];
  if (!xrController || !xrController.pointer) return;
  
  const pos = xrController.pointer.absolutePosition.clone();
  const dir = getControllerForward(xrController);
  if (!dir) return;
  
  // Handle different weapon types
  if (stats.lightning) {
    fireLightning(hand, pos, dir, stats);
  } else if (stats.seeker) {
    fireSeekerBurst(hand, pos, dir, stats);
  } else if (stats.plasma) {
    firePlasma(hand, pos, dir, stats);
  } else {
    // Standard, buckshot
    const count = stats.projectileCount || 1;
    
    for (let i = 0; i < count; i++) {
      let projDir = dir.clone();
      
      // Apply spread for buckshot
      if (stats.spreadAngle > 0) {
        const spreadX = (Math.random() - 0.5) * stats.spreadAngle * 2;
        const spreadY = (Math.random() - 0.5) * stats.spreadAngle * 2;
        projDir = projDir.add(new BABYLON.Vector3(spreadX, spreadY, 0)).normalize();
      }
      
      createProjectile(pos, projDir, hand, stats);
    }
  }
  
  // Sound based on weapon type
  playWeaponSound(stats);
}

function fireChargeShot(hand, chargePercent, stats) {
  const now = performance.now();
  const ws = weaponState[hand];
  
  // Check Excess Heat: free second shot within 2s
  const isFreeShot = stats.chargeExcess && (now - ws.lastChargeFireTime < 2000);
  
  if (!isFreeShot) {
    ws.lastChargeFireTime = now;
  }
  
  // Get controller position and direction
  const xrController = xrControllers[hand];
  if (!xrController || !xrController.pointer) return;
  
  const pos = xrController.pointer.absolutePosition.clone();
  const dir = getControllerForward(xrController);
  if (!dir) return;
  
  // Calculate damage based on charge percent
  const damage = stats.damage * (1 + (stats.chargeDamageMult - 1) * chargePercent);
  
  // Create a powerful beam projectile from pool
  const beam = acquirePooledProjectile('charge');
  beam.position = pos.clone().add(dir.scale(1));
  beam.rotation.x = Math.PI / 2;
  const height = 2 * chargePercent;
  const diameter = Math.max(0.04, 0.1 * chargePercent);
  beam.scaling.copyFromFloats(diameter, height, diameter);
  beam.lookAt(pos.clone().add(dir.scale(10)));
  
  const chargeColor = new BABYLON.Color3(1, 0.5 + chargePercent * 0.5, 1);
  const chargeMaterialKey = chargePercent > 0.66 ? 'charge_high' : (chargePercent > 0.33 ? 'charge_mid' : 'charge_low');
  beam.material = getProjectileMaterial(chargeMaterialKey, chargeColor);
  
  const projData = {
    mesh: beam,
    direction: dir.normalize(),
    speed: 40 + chargePercent * 20,
    damage: Math.round(damage),
    hand,
    stats,
    createdAt: performance.now(),
    lifetime: 2000,
    pierced: [],
    isChargeBeam: true,
    chargePercent,
    poolKind: 'charge',
  };
  
  projectiles.push(projData);
  playChargeSound();
}

function fireLightning(hand, pos, dir, stats) {
  // Find nearest enemy in range
  const nearestEnemy = findNearestEnemy(pos, stats.lightningRange);
  
  if (nearestEnemy) {
    // Update lightning beam visualization
    const beam = lightningBeams[hand];
    if (beam) {
      const xrController = xrControllers[hand];
      if (xrController && xrController.pointer) {
        const origin = xrController.pointer.absolutePosition.clone();
        const targetPos = nearestEnemy.enemy.mesh.position.clone();
        BABYLON.MeshBuilder.CreateLines('lightningBeam_' + hand, {
          points: [origin, targetPos],
          instance: beam,
        });
        beam.color = new BABYLON.Color3(1, 1, 0.3);
        beam.isVisible = true;
      }
    }
    
    // Deal damage
    const damage = stats.lightningDamage;
    const result = enemies.hitEnemy(nearestEnemy.index, damage);
    
    if (result.killed) {
      handleEnemyKilled(nearestEnemy.index, nearestEnemy, damage);
    } else {
      hud.spawnDamageNumber(nearestEnemy.enemy.mesh.position, damage, '#ffff44');
      if (stats.effects) {
        enemies.applyEffects(nearestEnemy.index, stats.effects);
      }
    }
    
    // Chain lightning
    if (stats.lightningChainTargets > 0) {
      chainLightning(nearestEnemy.enemy.mesh.position, stats.lightningChainTargets, damage * 0.5, stats);
    }
  } else {
    // No target - hide beam
    if (lightningBeams[hand]) {
      lightningBeams[hand].isVisible = false;
    }
  }
  
  playLightningSound();
}

function chainLightning(sourcePos, chainCount, damage, stats) {
  let lastPos = sourcePos;
  const hitEnemies = new Set();
  
  for (let i = 0; i < chainCount; i++) {
    const nearest = findNearestEnemy(lastPos, 5, hitEnemies);
    if (!nearest) break;
    
    hitEnemies.add(nearest.index);
    
    // Deal chain damage
    const result = enemies.hitEnemy(nearest.index, damage);
    if (result.killed) {
      handleEnemyKilled(nearest.index, nearest, damage);
    } else {
      hud.spawnDamageNumber(nearest.enemy.mesh.position, damage, '#ffff88');
    }
    
    lastPos = nearest.enemy.mesh.position;
  }
}

function fireSeekerBurst(hand, pos, dir, stats) {
  const count = stats.seekerShots || 3;
  
  for (let i = 0; i < count; i++) {
    // Slight spread for burst
    const spreadDir = dir.clone();
    spreadDir.x += (Math.random() - 0.5) * 0.1;
    spreadDir.y += (Math.random() - 0.5) * 0.1;
    spreadDir.normalize();
    
    createSeekerProjectile(pos, spreadDir, hand, stats);
  }
  
  playSeekerSound();
}

function firePlasma(hand, pos, dir, stats) {
  const ws = weaponState[hand];
  
  // Apply plasma ramp damage bonus
  const rampBonus = 1 + (ws.plasmaRamp * stats.plasmaRampDamage);
  const damage = Math.round(stats.damage * rampBonus);
  
  // Increment ramp (resets after not firing for a bit)
  ws.plasmaRamp = Math.min(20, ws.plasmaRamp + 1);
  
  // Apply spread
  let projDir = dir.clone();
  if (stats.spreadAngle > 0) {
    const spreadX = (Math.random() - 0.5) * stats.spreadAngle * 2;
    const spreadY = (Math.random() - 0.5) * stats.spreadAngle * 2;
    projDir = projDir.add(new BABYLON.Vector3(spreadX, spreadY, 0)).normalize();
  }
  
  createPlasmaProjectile(pos, projDir, hand, stats, damage);
  playPlasmaSound();
}

function getProjectileMaterial(key, color) {
  if (projectileMaterials[key]) return projectileMaterials[key];
  const mat = new BABYLON.StandardMaterial('projMat_' + key, scene);
  mat.disableLighting = true;
  mat.emissiveColor = color.clone ? color.clone() : color;
  projectileMaterials[key] = mat;
  return mat;
}

function createPooledProjectileMesh(poolKind) {
  let mesh = null;
  if (poolKind === 'charge') {
    mesh = BABYLON.MeshBuilder.CreateCylinder('projPool_charge', {
      height: 1,
      diameter: 1,
    }, scene);
  } else {
    mesh = BABYLON.MeshBuilder.CreateSphere('projPool_' + poolKind, { diameter: 1 }, scene);
  }

  mesh.isPickable = false;
  mesh.setEnabled(false);
  mesh.isVisible = false;
  mesh.metadata = mesh.metadata || {};
  mesh.metadata.poolKind = poolKind;
  return mesh;
}

function acquirePooledProjectile(poolKind) {
  const pool = projectileMeshPools[poolKind];
  if (!pool) {
    return createPooledProjectileMesh(poolKind);
  }

  const mesh = pool.pop() || createPooledProjectileMesh(poolKind);
  mesh.setEnabled(true);
  mesh.isVisible = true;
  return mesh;
}

function releaseProjectile(proj) {
  if (!proj || !proj.mesh) return;

  const mesh = proj.mesh;
  const poolKind = proj.poolKind || mesh.metadata?.poolKind;
  const pool = projectileMeshPools[poolKind];

  if (!pool) {
    mesh.dispose();
    return;
  }

  mesh.setEnabled(false);
  mesh.isVisible = false;
  mesh.position.copyFromFloats(0, -1000, 0);
  mesh.rotation.copyFromFloats(0, 0, 0);
  mesh.scaling.copyFromFloats(1, 1, 1);
  pool.push(mesh);
}

function createProjectile(position, direction, hand, stats) {
  const projectile = acquirePooledProjectile('standard');
  projectile.position.copyFrom(position);
  projectile.scaling.copyFromFloats(0.05, 0.05, 0.05);
  const color = getProjectileColor(stats);
  const materialKey = stats.weaponType === WEAPON_TYPES.BUCKSHOT ? 'standard_buckshot' : 'standard_default';
  projectile.material = getProjectileMaterial(materialKey, color);
  
  // Increment shot count for Nova Tip
  const ws = weaponState[hand];
  ws.shotCount++;
  const isNovaShot = stats.novaTipInterval > 0 && ws.shotCount % stats.novaTipInterval === 0;
  
  const projData = {
    mesh: projectile,
    direction: direction.normalize(),
    speed: 50,
    damage: stats.damage,
    hand,
    stats,
    createdAt: performance.now(),
    lifetime: 3000,
    pierced: [],
    isNovaShot,
    poolKind: 'standard',
  };
  
  projectiles.push(projData);
}

function createSeekerProjectile(position, direction, hand, stats) {
  const projectile = acquirePooledProjectile('seeker');
  projectile.position.copyFrom(position);
  projectile.scaling.copyFromFloats(0.04, 0.04, 0.04);
  projectile.material = getProjectileMaterial('seeker', new BABYLON.Color3(1, 0.5, 0.2));
  
  const projData = {
    mesh: projectile,
    direction: direction.normalize(),
    speed: 25,
    damage: stats.damage,
    hand,
    stats,
    createdAt: performance.now(),
    lifetime: 4000,
    pierced: [],
    isHoming: true,
    homingStrength: stats.seekerHomingStrength || 0.5,
    poolKind: 'seeker',
  };
  
  projectiles.push(projData);
}

function createPlasmaProjectile(position, direction, hand, stats, damage) {
  const projectile = acquirePooledProjectile('plasma');
  projectile.position.copyFrom(position);
  projectile.scaling.copyFromFloats(0.03, 0.03, 0.03);
  projectile.material = getProjectileMaterial('plasma', new BABYLON.Color3(0.3, 1, 0.3));
  
  const projData = {
    mesh: projectile,
    direction: direction.normalize(),
    speed: 60,
    damage: damage,
    hand,
    stats,
    createdAt: performance.now(),
    lifetime: 2000,
    pierced: [],
    isPlasma: true,
    poolKind: 'plasma',
  };
  
  projectiles.push(projData);
}

function getProjectileColor(stats) {
  if (stats.weaponType === WEAPON_TYPES.BUCKSHOT) {
    return new BABYLON.Color3(0.8, 0.8, 0.8);
  }
  // Default cyan
  return new BABYLON.Color3(0, 1, 1);
}

function playWeaponSound(stats) {
  if (stats.weaponType === WEAPON_TYPES.BUCKSHOT) {
    playShoothSound();  // TODO: Add shotgun sound
  } else if (stats.weaponType === WEAPON_TYPES.PLASMA) {
    playPlasmaSound();
  } else if (stats.weaponType === WEAPON_TYPES.SEEKER) {
    playSeekerSound();
  } else {
    playShoothSound();
  }
}

// ── Alt Weapon System ────────────────────────────────────────
function fireAltWeapon(hand) {
  const now = performance.now();
  const alt = altWeaponState[hand];
  
  // Check if we have an alt weapon equipped
  if (!alt.equipped) {
    console.log('[main] No alt weapon equipped for hand:', hand);
    return;
  }
  
  // Check cooldown
  if (now < alt.cooldownEnd) {
    console.log('[main] Alt weapon on cooldown:', (alt.cooldownEnd - now) / 1000, 's remaining');
    return;
  }
  
  const def = ALT_WEAPON_DEFS[alt.equipped];
  if (!def) return;
  
  // Get stats for cooldown reduction
  const stats = getWeaponStats(gameState.upgrades[hand] || {}, gameState.globalUpgrades || {});
  const cooldown = def.cooldown * stats.altCooldownMult;
  
  // Fire based on type
  switch (alt.equipped) {
    case 'rocket':
      fireRocket(hand, def);
      break;
    case 'helper_bot':
      deployHelperBot(hand, def);
      break;
    case 'shield':
      activateShield(hand, def);
      break;
    case 'gravity_well':
      deployGravityWell(hand, def);
      break;
    case 'ion_mortar':
      fireIonMortar(hand, def);
      break;
    case 'hologram':
      deployHologram(hand, def);
      break;
  }
  
  // Set cooldown
  alt.cooldownEnd = now + cooldown;
  
  console.log('[main] Fired alt weapon:', alt.equipped);
}

function fireRocket(hand, def) {
  const xrController = xrControllers[hand];
  if (!xrController || !xrController.pointer) return;
  
  const pos = xrController.pointer.absolutePosition.clone();
  const dir = getControllerForward(xrController);
  if (!dir) return;
  
  // Create rocket mesh
  const rocket = BABYLON.MeshBuilder.CreateCylinder('rocket', {
    height: 0.15,
    diameter: 0.05
  }, scene);
  rocket.position = pos.clone();
  rocket.rotation.x = Math.PI / 2;
  
  const mat = new BABYLON.StandardMaterial('rocketMat', scene);
  mat.disableLighting = true;
  mat.emissiveColor = new BABYLON.Color3(1, 0.2, 0.2);
  rocket.material = mat;
  
  // Create trail particles
  const trail = createTrailParticles(rocket, new BABYLON.Color3(1, 0.5, 0));
  
  const rocketData = {
    mesh: rocket,
    particles: trail,
    direction: dir.normalize(),
    speed: 30,
    damage: def.damage,
    splashRadius: def.splashRadius,
    createdAt: performance.now(),
    lifetime: 5000,
  };
  
  altWeaponEntities.push(rocketData);
  playRocketSound();
}

function deployHelperBot(hand, def) {
  const xrController = xrControllers[hand];
  if (!xrController || !xrController.pointer) return;
  
  const pos = xrController.pointer.absolutePosition.clone();
  
  // Create bot mesh (small voxel robot)
  const bot = createHelperBotMesh(pos);
  
  const botData = {
    mesh: bot,
    damage: def.damage,
    fireRate: def.fireRate,
    lastFireTime: 0,
    activeUntil: performance.now() + def.duration,
  };
  
  helperBots.push(botData);
  console.log('[main] Helper bot deployed');
}

function createHelperBotMesh(position) {
  // Body
  const body = BABYLON.MeshBuilder.CreateBox('botBody', { width: 0.1, height: 0.12, depth: 0.1 }, scene);
  body.position = position.clone();
  body.position.y += 0.1;
  
  const bodyMat = new BABYLON.StandardMaterial('botBodyMat', scene);
  bodyMat.disableLighting = true;
  bodyMat.emissiveColor = new BABYLON.Color3(0.3, 1, 0.3);
  body.material = bodyMat;
  
  // Head
  const head = BABYLON.MeshBuilder.CreateBox('botHead', { width: 0.06, height: 0.06, depth: 0.06 }, scene);
  head.position = body.position.clone();
  head.position.y += 0.09;
  head.parent = body;
  
  const headMat = new BABYLON.StandardMaterial('botHeadMat', scene);
  headMat.disableLighting = true;
  headMat.emissiveColor = new BABYLON.Color3(0.5, 1, 0.5);
  head.material = headMat;
  
  return body;
}

function activateShield(hand, def) {
  const alt = altWeaponState[hand];
  
  // Attach shield to controller
  const shield = shieldMeshes[hand];
  const xrController = xrControllers[hand];
  
  if (shield && xrController && xrController.grip) {
    shield.parent = xrController.grip;
    shield.isVisible = true;
    
    alt.active = true;
    alt.activeUntil = performance.now() + def.duration;
    alt.charges = def.maxHits;
    
    playShieldSound();
  }
}

function deployGravityWell(hand, def) {
  const xrController = xrControllers[hand];
  if (!xrController || !xrController.pointer) return;
  
  // Deploy at point 3m in front of controller
  const pos = xrController.pointer.absolutePosition.clone();
  const dir = getControllerForward(xrController);
  if (!dir) return;
  const deployPos = pos.add(dir.scale(3));
  deployPos.y = 0.5;  // Just above ground
  
  // Create gravity well sphere
  const well = BABYLON.MeshBuilder.CreateSphere('gravityWell', { diameter: 0.5 }, scene);
  well.position = deployPos;
  
  const wellMat = new BABYLON.StandardMaterial('gravityWellMat', scene);
  wellMat.disableLighting = true;
  wellMat.emissiveColor = new BABYLON.Color3(0.6, 0.2, 1);
  well.material = wellMat;
  
  // Create particles
  const particles = createGravityWellParticles(well);
  
  const wellData = {
    mesh: well,
    particles,
    pullRadius: def.pullRadius,
    pullForce: def.pullForce,
    activeUntil: performance.now() + def.duration,
  };
  
  gravityWells.push(wellData);
  playGravityWellSound();
}

function createGravityWellParticles(emitter) {
  const ps = new BABYLON.ParticleSystem('gravityWellParticles', 100, scene);
  
  // Create swirl texture
  const tex = new BABYLON.DynamicTexture('swirlTex', 32, scene);
  const ctx = tex.getContext();
  ctx.fillStyle = 'rgba(170, 68, 255, 0.8)';
  ctx.beginPath();
  ctx.arc(16, 16, 10, 0, Math.PI * 2);
  ctx.fill();
  tex.update();
  ps.particleTexture = tex;
  
  ps.emitter = emitter;
  ps.createSphereEmitter(0.5);
  ps.minSize = 0.05;
  ps.maxSize = 0.15;
  ps.minLifeTime = 0.3;
  ps.maxLifeTime = 0.8;
  ps.emitRate = 50;
  ps.color1 = new BABYLON.Color4(0.6, 0.2, 1, 1);
  ps.color2 = new BABYLON.Color4(0.4, 0.1, 0.8, 1);
  ps.minEmitPower = 0.5;
  ps.maxEmitPower = 1;
  ps.blendMode = BABYLON.ParticleSystem.BLENDMODE_ADD;
  ps.start();
  
  return ps;
}

function fireIonMortar(hand, def) {
  const xrController = xrControllers[hand];
  if (!xrController || !xrController.pointer) return;
  
  const pos = xrController.pointer.absolutePosition.clone();
  const dir = getControllerForward(xrController);
  if (!dir) return;
  
  // Create mortar projectile (larger sphere)
  const mortar = BABYLON.MeshBuilder.CreateSphere('ionMortar', { diameter: 0.12 }, scene);
  mortar.position = pos.clone();
  
  const mat = new BABYLON.StandardMaterial('mortarMat', scene);
  mat.disableLighting = true;
  mat.emissiveColor = new BABYLON.Color3(0.3, 1, 0.7);
  mortar.material = mat;
  
  // Create trail
  const trail = createTrailParticles(mortar, new BABYLON.Color3(0.3, 1, 0.7));
  
  const mortarData = {
    mesh: mortar,
    particles: trail,
    direction: dir.normalize(),
    speed: 20,
    damage: def.damage,
    splashRadius: def.splashRadius,
    arcingHeight: def.arcingHeight,
    startPos: pos.clone(),
    createdAt: performance.now(),
    lifetime: 3000,
    isMortar: true,
  };
  
  altWeaponEntities.push(mortarData);
}

function deployHologram(hand, def) {
  const playerPos = getPlayerPosition();
  
  // Create hologram mesh (simplified player silhouette)
  const hologram = BABYLON.MeshBuilder.CreateBox('hologram', { width: 0.3, height: 1.6, depth: 0.2 }, scene);
  hologram.position = playerPos.add(new BABYLON.Vector3(0, 0, -2));
  
  const mat = new BABYLON.StandardMaterial('hologramMat', scene);
  mat.disableLighting = true;
  mat.emissiveColor = new BABYLON.Color3(0.3, 1, 1);
  hologram.material = mat;
  
  const holoData = {
    mesh: hologram,
    activeUntil: performance.now() + def.duration,
  };
  
  holograms.push(holoData);
  console.log('[main] Hologram deployed');
}

function createTrailParticles(emitter, color) {
  const ps = new BABYLON.ParticleSystem('trail', 50, scene);
  
  const tex = new BABYLON.DynamicTexture('trailTex', 16, scene);
  const ctx = tex.getContext();
  ctx.fillStyle = 'white';
  ctx.beginPath();
  ctx.arc(8, 8, 6, 0, Math.PI * 2);
  ctx.fill();
  tex.update();
  ps.particleTexture = tex;
  
  ps.emitter = emitter;
  ps.minEmitBox = new BABYLON.Vector3(-0.02, 0, -0.02);
  ps.maxEmitBox = new BABYLON.Vector3(0.02, 0, 0.02);
  ps.minSize = 0.03;
  ps.maxSize = 0.08;
  ps.minLifeTime = 0.1;
  ps.maxLifeTime = 0.3;
  ps.emitRate = 30;
  ps.color1 = new BABYLON.Color4(color.r, color.g, color.b, 1);
  ps.color2 = new BABYLON.Color4(color.r * 0.5, color.g * 0.5, color.b * 0.5, 0.5);
  ps.minEmitPower = 0.1;
  ps.maxEmitPower = 0.3;
  ps.blendMode = BABYLON.ParticleSystem.BLENDMODE_ADD;
  ps.start();
  
  return ps;
}

// ── Weapon Pickup System ─────────────────────────────────────
function spawnWeaponPickup(position) {
  // Randomly select alt weapon type
  const types = Object.keys(ALT_WEAPON_DEFS);
  const type = types[Math.floor(Math.random() * types.length)];
  const def = ALT_WEAPON_DEFS[type];
  
  // Create pickup mesh
  const pickup = createPickupMesh(position, def);
  
  const pickupData = {
    mesh: pickup,
    particles: null,  // Add glow particles
    type,
    createdAt: performance.now(),
    lifetime: 15000,  // 15 seconds before despawn
  };
  
  // Create glow effect
  pickupData.particles = createPickupGlow(pickup, hexToColor3(def.color));
  
  weaponPickups.push(pickupData);
  console.log('[main] Spawned weapon pickup:', type);
}

function createPickupMesh(position, def) {
  let mesh;
  
  // Create different mesh shapes based on type
  switch (def.iconMesh) {
    case 'rocket':
      mesh = BABYLON.MeshBuilder.CreateCylinder('pickup', { height: 0.48, diameter: 0.16 }, scene);
      break;
    case 'robot':
      mesh = BABYLON.MeshBuilder.CreateBox('pickup', { width: 0.24, height: 0.32, depth: 0.24 }, scene);
      break;
    case 'hexagon':
      mesh = BABYLON.MeshBuilder.CreateDisc('pickup', { radius: 0.20, tessellation: 6 }, scene);
      break;
    case 'sphere':
      mesh = BABYLON.MeshBuilder.CreateSphere('pickup', { diameter: 0.32 }, scene);
      break;
    case 'mortar':
      mesh = BABYLON.MeshBuilder.CreateCylinder('pickup', { height: 0.24, diameter: 0.32 }, scene);
      break;
    case 'figure':
      mesh = BABYLON.MeshBuilder.CreateCylinder('pickup', { height: 0.40, diameter: 0.12 }, scene);
      break;
    default:
      mesh = BABYLON.MeshBuilder.CreateBox('pickup', { size: 0.24 }, scene);
  }
  
  mesh.position = position.clone();
  mesh.position.y += 0.8;  // Float above ground
  
  const mat = new BABYLON.StandardMaterial('pickupMat', scene);
  mat.disableLighting = true;
  mat.emissiveColor = hexToColor3(def.color);
  mesh.material = mat;
  
  return mesh;
}

function createPickupGlow(emitter, color) {
  const ps = new BABYLON.ParticleSystem('pickupGlow', 20, scene);
  
  const tex = new BABYLON.DynamicTexture('glowTex', 16, scene);
  const ctx = tex.getContext();
  ctx.fillStyle = 'white';
  ctx.beginPath();
  ctx.arc(8, 8, 6, 0, Math.PI * 2);
  ctx.fill();
  tex.update();
  ps.particleTexture = tex;
  
  ps.emitter = emitter;
  ps.minEmitBox = new BABYLON.Vector3(-0.02, -0.02, -0.02);
  ps.maxEmitBox = new BABYLON.Vector3(0.02, 0.02, 0.02);
  ps.minSize = 0.02;
  ps.maxSize = 0.05;
  ps.minLifeTime = 0.3;
  ps.maxLifeTime = 0.6;
  ps.emitRate = 10;
  ps.color1 = new BABYLON.Color4(color.r, color.g, color.b, 0.8);
  ps.color2 = new BABYLON.Color4(color.r, color.g, color.b, 0.3);
  ps.minEmitPower = 0.05;
  ps.maxEmitPower = 0.1;
  ps.blendMode = BABYLON.ParticleSystem.BLENDMODE_ADD;
  ps.start();
  
  return ps;
}

function hexToColor3(hex) {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result ? new BABYLON.Color3(
    parseInt(result[1], 16) / 255,
    parseInt(result[2], 16) / 255,
    parseInt(result[3], 16) / 255
  ) : new BABYLON.Color3(1, 1, 1);
}

function checkPickupCollisions() {
  const playerPos = getPlayerPosition();
  
  for (let i = weaponPickups.length - 1; i >= 0; i--) {
    const pickup = weaponPickups[i];
    const dist = BABYLON.Vector3.Distance(playerPos, pickup.mesh.position);
    
    if (dist < 0.5) {  // Pickup radius
      // Equip to whichever hand doesn't have one, or first free
      let hand = null;
      if (!altWeaponState.left.equipped) hand = 'left';
      else if (!altWeaponState.right.equipped) hand = 'right';
      else {
        // Both have weapons, replace left
        hand = 'left';
      }
      
      altWeaponState[hand].equipped = pickup.type;
      
      console.log('[main] Equipped alt weapon:', pickup.type, 'to', hand);
      
      // Remove pickup
      pickup.mesh.dispose();
      if (pickup.particles) pickup.particles.dispose();
      weaponPickups.splice(i, 1);
    }
  }
}

function updatePickups(dt, now) {
  for (let i = weaponPickups.length - 1; i >= 0; i--) {
    const pickup = weaponPickups[i];
    
    // Spin animation
    pickup.mesh.rotation.y += dt * 2;
    pickup.mesh.position.y = 0.8 + Math.sin(now / 300) * 0.1;  // Bob up and down
    
    // Lifetime check
    if (now - pickup.createdAt > pickup.lifetime) {
      pickup.mesh.dispose();
      if (pickup.particles) pickup.particles.dispose();
      weaponPickups.splice(i, 1);
    }
  }
}

// ── Projectile Updates ───────────────────────────────────────
function updateProjectiles(dt, now) {
  const playerPos = getPlayerPosition();
  
  for (let i = projectiles.length - 1; i >= 0; i--) {
    const proj = projectiles[i];
    
    // Homing behavior for seeker projectiles
    if (proj.isHoming) {
      const nearest = findNearestEnemy(proj.mesh.position, 10);
      if (nearest) {
        const toTarget = nearest.enemy.mesh.position.subtract(proj.mesh.position).normalize();
        proj.direction = BABYLON.Vector3.Lerp(proj.direction, toTarget, proj.homingStrength * dt);
      }
    }
    
    // Move projectile
    proj.mesh.position.addInPlace(proj.direction.scale(proj.speed * dt));
    
    // Charge beam visualization
    if (proj.isChargeBeam) {
      proj.mesh.lookAt(proj.mesh.position.add(proj.direction.scale(10)));
    }
    
    // Lifetime check
    if (now - proj.createdAt > proj.lifetime) {
      releaseProjectile(proj);
      projectiles.splice(i, 1);
      continue;
    }
    
    // Check enemy hits
    let hitTargetThisFrame = false;
    const enemyList = enemies.getEnemies();
    for (let j = enemyList.length - 1; j >= 0; j--) {
      const enemy = enemyList[j];
      const dist = BABYLON.Vector3.Distance(proj.mesh.position, enemy.mesh.position);
      
      if (dist < enemy.hitboxRadius) {
        // Calculate damage with Execute bonus
        let damage = proj.damage;
        if (proj.stats.executeBonus > 0 && enemy.hp / enemy.maxHp < 0.25) {
          damage *= (1 + proj.stats.executeBonus);
        }
        
        const result = enemies.hitEnemy(j, damage);
        
        if (result.killed) {
          handleEnemyKilled(j, enemy, damage);
        } else {
          hud.spawnDamageNumber(enemy.mesh.position, damage, '#ffffff');
          playHitSound();
          
          // Apply status effects
          if (proj.stats.effects) {
            enemies.applyEffects(j, proj.stats.effects);
          }
        }
        
        // Nova Tip AoE
        if (proj.isNovaShot) {
          createNovaExplosion(proj.mesh.position, proj.stats);
        }
        
        // Remove projectile (unless piercing)
        if (!proj.stats.piercing) {
          releaseProjectile(proj);
          projectiles.splice(i, 1);
        } else {
          proj.pierced.push(j);
        }
        hitTargetThisFrame = true;
        
        break;
      }
    }

    if (hitTargetThisFrame) {
      continue;
    }

    // Check boss hit
    const boss = enemies.getBoss();
    if (boss && boss.mesh) {
      const bossPos = boss.mesh.position;
      const dist = BABYLON.Vector3.Distance(proj.mesh.position, bossPos);
      const bossHitboxRadius = 1.5;

      if (dist < bossHitboxRadius) {
        let damage = proj.damage;
        if (proj.stats.executeBonus > 0 && boss.hp / boss.maxHp < 0.25) {
          damage *= (1 + proj.stats.executeBonus);
        }
        if (proj.stats.heavyHunterBonus > 0) {
          damage *= (1 + proj.stats.heavyHunterBonus);
        }

        enemies.hitBoss(damage);
        hud.spawnDamageNumber(bossPos, damage, '#ffffff');
        playHitSound();

        if (!proj.stats.piercing) {
          releaseProjectile(proj);
          projectiles.splice(i, 1);
        }

        continue;
      }
    }
  }
}

function updateAltWeaponEntities(dt, now) {
  for (let i = altWeaponEntities.length - 1; i >= 0; i--) {
    const entity = altWeaponEntities[i];
    
    // Move projectile
    entity.mesh.position.addInPlace(entity.direction.scale(entity.speed * dt));
    
    // Mortar arcing
    if (entity.isMortar) {
      const t = (now - entity.createdAt) / entity.lifetime;
      const arcHeight = Math.sin(t * Math.PI) * entity.arcingHeight;
      entity.mesh.position.y = entity.startPos.y + arcHeight;
    }
    
    // Lifetime check
    if (now - entity.createdAt > entity.lifetime) {
      // Explode on timeout
      if (entity.splashRadius) {
        createExplosion(entity.mesh.position, entity.damage, entity.splashRadius);
      }
      entity.mesh.dispose();
      if (entity.particles) entity.particles.dispose();
      altWeaponEntities.splice(i, 1);
      continue;
    }
    
    // Check enemy hits
    let hitTargetThisFrame = false;
    const enemyList = enemies.getEnemies();
    for (let j = enemyList.length - 1; j >= 0; j--) {
      const enemy = enemyList[j];
      const dist = BABYLON.Vector3.Distance(entity.mesh.position, enemy.mesh.position);
      
      if (dist < enemy.hitboxRadius) {
        // Direct hit + splash damage
        createExplosion(entity.mesh.position, entity.damage, entity.splashRadius);
        
        entity.mesh.dispose();
        if (entity.particles) entity.particles.dispose();
        altWeaponEntities.splice(i, 1);
        hitTargetThisFrame = true;
        break;
      }
    }

    if (hitTargetThisFrame) {
      continue;
    }

    // Check boss hits for alt-weapon projectiles (rocket/mortar)
    const boss = enemies.getBoss();
    if (boss && boss.mesh) {
      const dist = BABYLON.Vector3.Distance(entity.mesh.position, boss.mesh.position);
      const bossHitboxRadius = 1.5;

      if (dist < bossHitboxRadius) {
        enemies.hitBoss(entity.damage);
        hud.spawnDamageNumber(boss.mesh.position, entity.damage, '#ff8800');
        playHitSound();
        createExplosion(entity.mesh.position, entity.damage, entity.splashRadius);
        entity.mesh.dispose();
        if (entity.particles) entity.particles.dispose();
        altWeaponEntities.splice(i, 1);
      }
    }
  }
}

function createExplosion(position, damage, radius) {
  // Damage all enemies in radius
  const enemyList = enemies.getEnemies();
  for (let i = enemyList.length - 1; i >= 0; i--) {
    const enemy = enemyList[i];
    const dist = BABYLON.Vector3.Distance(position, enemy.mesh.position);
    
    if (dist < radius) {
      // Falloff damage
      const falloff = 1 - (dist / radius);
      const actualDamage = Math.round(damage * falloff);
      
      const result = enemies.hitEnemy(i, actualDamage);
      if (result.killed) {
        handleEnemyKilled(i, enemy, actualDamage);
      } else {
        hud.spawnDamageNumber(enemy.mesh.position, actualDamage, '#ff8800');
      }
    }
  }
  
  // Visual explosion
  createExplosionParticles(position);
  playExplosionSound();
}

function createExplosionParticles(position) {
  const ps = new BABYLON.ParticleSystem('explosion', 50, scene);
  
  const tex = new BABYLON.DynamicTexture('expTex', 32, scene);
  const ctx = tex.getContext();
  ctx.fillStyle = 'white';
  ctx.beginPath();
  ctx.arc(16, 16, 12, 0, Math.PI * 2);
  ctx.fill();
  tex.update();
  ps.particleTexture = tex;
  
  ps.emitter = position;
  ps.createSphereEmitter(0.1);
  ps.minSize = 0.1;
  ps.maxSize = 0.3;
  ps.minLifeTime = 0.2;
  ps.maxLifeTime = 0.5;
  ps.emitRate = 100;
  ps.manualEmitCount = 30;
  ps.color1 = new BABYLON.Color4(1, 0.5, 0, 1);
  ps.color2 = new BABYLON.Color4(1, 0.2, 0, 1);
  ps.minEmitPower = 2;
  ps.maxEmitPower = 5;
  ps.blendMode = BABYLON.ParticleSystem.BLENDMODE_ADD;
  ps.start();
  
  // Auto-dispose after particles finish
  setTimeout(() => ps.dispose(), 1000);
}

function createNovaExplosion(position, stats) {
  const radius = 3;  // Nova radius
  createExplosion(position, stats.damage * 0.5, radius);
}

function updateGravityWells(dt, now) {
  for (let i = gravityWells.length - 1; i >= 0; i--) {
    const well = gravityWells[i];
    
    // Pull enemies
    const enemyList = enemies.getEnemies();
    for (let j = 0; j < enemyList.length; j++) {
      const enemy = enemyList[j];
      const dist = BABYLON.Vector3.Distance(well.mesh.position, enemy.mesh.position);
      
      if (dist < well.pullRadius && dist > 0.5) {
        const pullDir = well.mesh.position.subtract(enemy.mesh.position).normalize();
        const pullStrength = well.pullForce * (1 - dist / well.pullRadius) * dt;
        enemy.mesh.position.addInPlace(pullDir.scale(pullStrength));
      }
    }
    
    // Lifetime check
    if (now > well.activeUntil) {
      well.mesh.dispose();
      if (well.particles) well.particles.dispose();
      gravityWells.splice(i, 1);
    }
  }
}

function updateHelperBots(dt, now) {
  for (let i = helperBots.length - 1; i >= 0; i--) {
    const bot = helperBots[i];
    
    // Find nearest enemy
    const nearest = findNearestEnemy(bot.mesh.position, 10);
    
    if (nearest) {
      // Face enemy
      const toEnemy = nearest.enemy.mesh.position.subtract(bot.mesh.position);
      bot.mesh.lookAt(nearest.enemy.mesh.position);
      
      // Fire at enemy
      if (now - bot.lastFireTime > bot.fireRate) {
        bot.lastFireTime = now;
        
        // Create small projectile
        const proj = acquirePooledProjectile('bot');
        proj.position = bot.mesh.position.clone();
        proj.scaling.copyFromFloats(0.02, 0.02, 0.02);
        proj.material = getProjectileMaterial('bot', new BABYLON.Color3(0.3, 1, 0.3));
        
        const projData = {
          mesh: proj,
          direction: toEnemy.normalize(),
          speed: 40,
          damage: bot.damage,
          hand: 'bot',
          stats: {},
          createdAt: now,
          lifetime: 1500,
          pierced: [],
          poolKind: 'bot',
        };
        
        projectiles.push(projData);
      }
    }
    
    // Lifetime check
    if (now > bot.activeUntil) {
      bot.mesh.dispose();
      helperBots.splice(i, 1);
    }
  }
}

function updateHolograms(dt, now) {
  for (let i = holograms.length - 1; i >= 0; i--) {
    const holo = holograms[i];
    
    // Make enemies target hologram (simplified - just attract nearby enemies)
    const enemyList = enemies.getEnemies();
    for (const enemy of enemyList) {
      const dist = BABYLON.Vector3.Distance(holo.mesh.position, enemy.mesh.position);
      if (dist < 5) {
        // Redirect enemy toward hologram
        // This is a simplified version - full implementation would modify enemy AI
      }
    }
    
    // Flicker effect without transparency changes (Quest-safe)
    const flicker = 0.7 + Math.sin(now / 50) * 0.3;
    if (holo.mesh.material?.emissiveColor) {
      holo.mesh.material.emissiveColor = new BABYLON.Color3(0.3, 1, 1).scale(flicker);
    }
    
    // Lifetime check
    if (now > holo.activeUntil) {
      holo.mesh.dispose();
      holograms.splice(i, 1);
    }
  }
}

function updateShields(now) {
  ['left', 'right'].forEach(hand => {
    const alt = altWeaponState[hand];
    const shield = shieldMeshes[hand];
    
    if (alt.active && shield) {
      // Check if shield should deactivate
      if (now > alt.activeUntil || alt.charges <= 0) {
        alt.active = false;
        shield.isVisible = false;
      }
      
      // Pulse effect
      shield.scaling = new BABYLON.Vector3(
        1 + Math.sin(now / 100) * 0.05,
        1 + Math.sin(now / 100) * 0.05,
        1
      );
    }
  });
}

function updateChargeIndicators(now) {
  ['left', 'right'].forEach(hand => {
    const ws = weaponState[hand];
    const indicator = chargeIndicators[hand];
    
    if (ws.isCharging && indicator) {
      const stats = getWeaponStats(gameState.upgrades[hand] || {}, gameState.globalUpgrades || {});
      
      if (stats.chargeShot) {
        const chargeDuration = now - ws.chargeStartTime;
        const chargePercent = Math.min(1, chargeDuration / stats.chargeTime);
        
        indicator.isVisible = true;
        indicator.scaling = new BABYLON.Vector3(
          1 + chargePercent,
          1 + chargePercent,
          1 + chargePercent
        );
        
        // Color change from cyan to magenta as it charges
        const mat = indicator.material;
        mat.emissiveColor = new BABYLON.Color3(
          chargePercent,
          1 - chargePercent * 0.5,
          1 - chargePercent * 0.5
        );
      }
    }
  });
}

function updateLightningBeams(now) {
  ['left', 'right'].forEach(hand => {
    const ws = weaponState[hand];
    const beam = lightningBeams[hand];
    
    // If not firing lightning, hide beam
    if (!ws.isCharging && beam) {
      // Check if we have lightning weapon
      const stats = getWeaponStats(gameState.upgrades[hand] || {}, gameState.globalUpgrades || {});
      if (!stats.lightning) {
        beam.isVisible = false;
      }
    }
  });
}

// ── Helper Functions ──────────────────────────────────────────
function findNearestEnemy(position, range, excludeSet = null) {
  const enemyList = enemies.getEnemies();
  let nearest = null;
  let nearestDist = range;
  
  for (let i = 0; i < enemyList.length; i++) {
    if (excludeSet && excludeSet.has(i)) continue;
    
    const enemy = enemyList[i];
    const dist = BABYLON.Vector3.Distance(position, enemy.mesh.position);
    
    if (dist < nearestDist) {
      nearestDist = dist;
      nearest = { index: i, enemy };
    }
  }
  
  return nearest;
}

function handleEnemyKilled(index, enemy, damage) {
  const destroyed = enemies.destroyEnemy(index);
  if (destroyed) {
    // Score and combo
    game.addKill(destroyed.scoreValue);
    game.addScore(destroyed.scoreValue * (gameState._combo || 1));
    
    // Damage number
    hud.spawnDamageNumber(destroyed.position, damage, '#ffffff');
    
    // Sound
    playExplosionSound();
    
    // Chance to drop alt weapon pickup
    if (Math.random() < PICKUP_DROP_CHANCE) {
      spawnWeaponPickup(destroyed.position);
    }
  }
}

// ── Game Loop ───────────────────────────────────────────────
function renderLoop() {
  const now = performance.now();
  delta = (now - lastTime) / 1000;
  lastTime = now;
  
  // Cap delta to prevent huge jumps
  delta = Math.min(delta, 0.1);

  // Update FPS
  if (frameCount % 30 === 0) {
    perfMonitor.fps = engine.getFps();
  }
  
  // Debug flags
  perfMonitorEnabled = window.debugPerfMonitor;

  // Update based on game state
  if (gameState) {
    updateGameState(now, delta);
  }
  
  // Update HUD
  hud.updateFPS(now, { perfMonitor: perfMonitorEnabled });
  
  scene.render();
}

function updateGameState(now, dt) {
  const state = gameState.state;
  
  // Update title screen
  if (state === game.State.TITLE) {
    hud.updateTitle(now);
    return;
  }
  
  // Update game over screen
  if (state === game.State.GAME_OVER || state === game.State.VICTORY) {
    hud.updateEndScreen(now);
    return;
  }
  
  // Update upgrade selection
  if (state === game.State.UPGRADE_SELECT) {
    upgradeCooldown -= dt;
    hud.updateUpgradeCards(now, upgradeCooldown);
    return;
  }
  
  // Boss alert
  if (state === game.State.BOSS_ALERT) {
    hud.updateBossAlert(now);
    return;
  }
  
  // Playing / boss fight
  if (state === game.State.PLAYING || state === game.State.BOSS_FIGHT) {
    updatePlaying(now, dt);
  }
  
  // Update damage numbers
  hud.updateDamageNumbers(dt, now);
  
  // Update hit flash
  hud.updateHitFlash(dt);
  
  // Update HUD
  if (state === game.State.PLAYING || state === game.State.BOSS_FIGHT) {
    hud.updateHUD(gameState);
  }
}

function updatePlaying(now, dt) {
  const playerPos = getPlayerPosition();
  const levelConfig = gameState._levelConfig;
  
  // Update enemies
  const collisions = enemies.updateEnemies(dt, now, playerPos);
  
  // Handle player damage from collisions
  for (const idx of collisions) {
    enemies.destroyEnemy(idx);
    damagePlayer(1);
  }
  
  // Check for enemies killed by DoT
  const enemyList = enemies.getEnemies();
  for (let i = enemyList.length - 1; i >= 0; i--) {
    const enemy = enemyList[i];
    if (enemy.hp <= 0) {
      const destroyed = enemies.destroyEnemy(i);
      if (destroyed) {
        game.addKill(destroyed.scoreValue);
        game.addScore(destroyed.scoreValue * (gameState._combo || 1));
        playExplosionSound();
        
        // Chance to drop pickup
        if (Math.random() < PICKUP_DROP_CHANCE) {
          spawnWeaponPickup(destroyed.position);
        }
      }
    }
  }
  
  // Update boss
  const boss = enemies.getBoss();
  if (boss) {
    enemies.updateBoss(dt, now, playerPos);
    hud.updateBossHealthBar(boss.hp, boss.maxHp, boss.phases, boss.mesh);
    
    // Check boss defeat
    if (boss.hp <= 0) {
      game.addScore(boss.scoreValue * 10);
      enemies.clearBoss();
      hud.hideBossHealthBar();
      
      // Level complete
      setTimeout(() => completeLevel(), 1000);
    }
  }
  
  // Spawn enemies (non-boss levels)
  if (gameState.state === game.State.PLAYING) {
    spawnTimer -= dt;
    if (spawnTimer <= 0 && gameState.kills < levelConfig.killTarget) {
      spawnEnemy();
      spawnTimer = levelConfig.spawnInterval;
    }
    
    // Check level complete
    if (gameState.kills >= levelConfig.killTarget) {
      completeLevel();
    }
  }
  
  // Continuous firing while trigger held (all weapon types)
  ['left', 'right'].forEach(hand => {
    const ws = weaponState[hand];
    if (!ws.isCharging) return;

    const mc = controllers[hand];
    if (mc) {
      const trigger = mc.getComponent('xr-standard-trigger');
      if (trigger && !trigger.pressed) {
        ws.isCharging = false;
        return;
      }
    }

    const stats = getWeaponStats(gameState.upgrades[hand] || {}, gameState.globalUpgrades || {});
    if (stats.chargeShot) {
      // Charge weapons fire on release only.
      return;
    } else if (stats.lightning) {
      // Lightning fires on its own tick interval.
      if (now - ws.lastFireTime > stats.lightningTickInterval * 1000) {
        const xrController = xrControllers[hand];
        if (xrController && xrController.pointer) {
          const pos = xrController.pointer.absolutePosition.clone();
          const dir = getControllerForward(xrController);
          if (dir) {
            fireLightning(hand, pos, dir, stats);
          }
        }
        ws.lastFireTime = now;
      }
    } else {
      // Standard, buckshot, plasma, seeker all reuse fireWeapon rate checks.
      fireWeapon(hand);
    }
  });
  
  // Update projectiles
  updateProjectiles(dt, now);
  
  // Update alt weapon entities
  updateAltWeaponEntities(dt, now);
  
  // Update gravity wells
  updateGravityWells(dt, now);
  
  // Update helper bots
  updateHelperBots(dt, now);
  
  // Update holograms
  updateHolograms(dt, now);
  
  // Update shields
  updateShields(now);
  
  // Update charge indicators
  updateChargeIndicators(now);
  
  // Update lightning beams
  updateLightningBeams(now);
  
  // Update weapon pickups
  updatePickups(dt, now);
  
  // Check pickup collisions
  checkPickupCollisions();
  
  // Plasma ramp decay
  ['left', 'right'].forEach(hand => {
    const ws = weaponState[hand];
    if (!ws.isCharging && ws.plasmaRamp > 0) {
      ws.plasmaRamp = Math.max(0, ws.plasmaRamp - dt * 5);
    }
  });
  
  // Update combo decay
  game.updateCombo(dt);
}

function spawnEnemy() {
  const levelConfig = gameState._levelConfig;
  const airSpawns = gameState.level >= 6;
  
  const position = enemies.getSpawnPosition(airSpawns);
  const types = game.getEnemyTypes(gameState.level);
  const type = types[Math.floor(Math.random() * types.length)];
  
  enemies.spawnEnemy(type, position, levelConfig);
}

function damagePlayer(amount) {
  // Check for shield
  let blocked = false;
  ['left', 'right'].forEach(hand => {
    const alt = altWeaponState[hand];
    if (alt.active && alt.charges > 0) {
      alt.charges--;
      blocked = true;
      console.log('[main] Shield blocked damage, charges left:', alt.charges);
    }
  });
  
  if (blocked) {
    playShieldSound();
    return;
  }
  
  const killed = game.damage(amount);
  
  // Trigger reflex buff
  reflexBuffUntil = performance.now() + 2000;  // 2 seconds of double fire rate
  
  if (killed) {
    hud.triggerHitFlash();
    playDamageSound();
    
    // Check for second wind
    if (gameState.globalUpgrades.second_wind && !gameState.globalUpgrades.second_wind_used) {
      gameState.globalUpgrades.second_wind_used = true;
      gameState.health = 4; // 2 hearts
      console.log('[main] Second Wind activated!');
    } else {
      gameOver();
    }
  } else {
    hud.triggerHitFlash();
    playDamageSound();
  }
}

function getPlayerPosition() {
  if (xrCamera) {
    return xrCamera.position.clone();
  }
  return new BABYLON.Vector3(0, 1.6, 0);
}

// ── Start ───────────────────────────────────────────────────
init().catch((err) => {
  console.error('[main] Failed to initialize:', err);
});
