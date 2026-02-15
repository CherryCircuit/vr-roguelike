// ============================================================
//  SYNTHWAVE VR BLASTER - Babylon.js Port (main.js)
// Build: TWISTED SISTER (Optimized)
// ============================================================

import * as BABYLON from '@babylonjs/core';
import '@babylonjs/gui';
import '@babylonjs/loaders/glTF/2.0/glTFLoader';  // Register glTF loader with SceneLoader
import { resumeAudioContext } from './audio.js';
import * as game from './game.js';

// ── Global Variables ─────────────────────────────────────────
let engine;
let scene;
let xr;
let xrCamera;
let controllers = { left: null, right: null };
let frameCount = 0;
let lastTime = 0;
let delta = 0;

// Performance monitoring
let perfMonitor = { fps: 0, frameTime: 0 };
let perfMonitorEnabled = false;

// Debug flags
window.debugJumpToLevel = null;
window.debugPerfMonitor = false;

// ── Initialization ───────────────────────────────────────────
async function init() {
  console.log('[main] Initializing Babylon.js...');
  
  // Create canvas
  const canvas = document.getElementById('renderCanvas');
  if (!canvas) {
    console.error('[main] Canvas element not found!');
    return;
  }

  // Create Babylon engine
  engine = new BABYLON.Engine(canvas, true, {
    preserveDrawingBuffer: true,
    stencil: true,
  });
  
  console.log('[main] Engine created:', engine.getFps().toFixed(1), 'FPS');

  // Create scene
  scene = createScene();
  
  // Resize handler
  window.addEventListener('resize', () => engine.resize());

  // Run render loop
  engine.runRenderLoop(() => {
    renderLoop();
  });

  console.log('[main] Babylon.js initialized successfully!');
}

// ── Scene Creation ───────────────────────────────────────────
function createScene() {
  const scene = new BABYLON.Scene(engine);
  
  // CRITICAL: Opaque black background (no transparency to avoid black box bug)
  scene.clearColor = new BABYLON.Color4(0, 0, 0, 1);
  
  // Camera (will be replaced by XR camera)
  const camera = new BABYLON.FreeCamera('camera', new BABYLON.Vector3(0, 1.6, 0), scene);
  camera.attachControl(document.getElementById('renderCanvas'), true);

  // Lighting (minimal, we use emissive materials)
  const hemisphericLight = new BABYLON.HemisphericLight('light', new BABYLON.Vector3(0, 1, 0), scene);
  hemisphericLight.intensity = 0.5;

  // Fog for synthwave depth (reduced density so sun is visible)
  scene.fogMode = BABYLON.Scene.FOGMODE_EXP2;
  scene.fogDensity = 0.008;
  scene.fogColor = new BABYLON.Color3(0, 0, 0);

  // Create environment
  createEnvironment(scene);

  // Set up WebXR
  setupWebXR(scene);

  return scene;
}

// ── Environment Setup ───────────────────────────────────────
function createEnvironment(scene) {
  console.log('[main] Creating environment...');

  // Synthwave grid floor using lines (simpler, no GridMaterial dependency)
  createGridFloor(scene);

  // Stars background - OPTIMIZED: Use single particle system instead of 2000 meshes
  // This reduces draw calls from 2000 to just 1!
  createStarField(scene);

  // Sun disk (retro synthwave style) - WebXR player faces +Z, so sun at +Z is in front
  const sun = BABYLON.MeshBuilder.CreatePlane('sun', { width: 30, height: 30 }, scene);
  sun.position = new BABYLON.Vector3(0, 15, 100);  // In front of player (positive Z)
  // No rotation needed - plane faces -Z by default, which is correct for sun at +Z
  
  const sunMat = new BABYLON.StandardMaterial('sunMat', scene);
  sunMat.disableLighting = true;
  sunMat.emissiveColor = new BABYLON.Color3(1, 0.4, 0.2);
  sun.material = sunMat;

  // Sun gradient bands (horizontal strips)
  for (let i = 0; i < 8; i++) {
    const band = BABYLON.MeshBuilder.CreatePlane('sunBand' + i, { width: 30, height: 1.5 }, scene);
    band.position = new BABYLON.Vector3(0, 15 - (i * 1.8), 99.5);  // Same Z as sun (positive)
    // No rotation needed - plane faces -Z by default, which is correct for sun at +Z
    
    const bandMat = new BABYLON.StandardMaterial('sunBandMat' + i, scene);
    bandMat.disableLighting = true;
    const colorIntensity = 0.3 + (i * 0.1);
    bandMat.emissiveColor = new BABYLON.Color3(1, colorIntensity * 0.4, colorIntensity * 0.2);
    band.material = bandMat;
  }

  // Wireframe mountains with glowing cyan edges
  createWireframeMountains(scene);

  console.log('[main] Environment created');
}

// ── Grid Floor (OPTIMIZED: Single LineSystem instead of 121 separate lines) ───
function createGridFloor(scene) {
  const gridSize = 200;
  const divisions = 40;  // Reduced from 60 to 40 (fewer lines, still looks good)
  const step = gridSize / divisions;
  const gridLines = [];

  // Collect all horizontal line points
  for (let i = -divisions / 2; i <= divisions / 2; i++) {
    gridLines.push([
      new BABYLON.Vector3(-gridSize / 2, 0, i * step),
      new BABYLON.Vector3(gridSize / 2, 0, i * step)
    ]);
  }

  // Collect all vertical line points
  for (let i = -divisions / 2; i <= divisions / 2; i++) {
    gridLines.push([
      new BABYLON.Vector3(i * step, 0, -gridSize / 2),
      new BABYLON.Vector3(i * step, 0, gridSize / 2)
    ]);
  }

  // Create a single LineSystem (one draw call for all grid lines!)
  const lineSystem = BABYLON.MeshBuilder.CreateLineSystem('grid', { lines: gridLines }, scene);
  lineSystem.color = new BABYLON.Color3(1, 0, 1); // Magenta
  lineSystem.isPickable = false;
  
  console.log('[main] Grid floor created (optimized: 82 lines in 1 draw call)');
}

// ── Star Field (OPTIMIZED: ParticleSystem instead of 2000 meshes) ───
function createStarField(scene) {
  const starCount = 2000;
  
  // Create particle system
  const particleSystem = new BABYLON.ParticleSystem('stars', starCount, scene);
  
  // Use a simple white texture (procedural)
  // Create a small dynamic texture for the star
  const starTexture = new BABYLON.DynamicTexture('starTex', 32, scene);
  const ctx = starTexture.getContext();
  ctx.fillStyle = 'white';
  ctx.beginPath();
  ctx.arc(16, 16, 8, 0, Math.PI * 2);
  ctx.fill();
  starTexture.update();
  particleSystem.particleTexture = starTexture;
  
  // Emitter covers the sky dome
  particleSystem.createBoxEmitter(
    new BABYLON.Vector3(0, -0.1, 0),  // Direction: slightly down
    new BABYLON.Vector3(-100, 5, -100),  // Min emit box
    new BABYLON.Vector3(100, 55, 100)    // Max emit box
  );
  
  // Star appearance
  particleSystem.minSize = 0.1;
  particleSystem.maxSize = 0.3;
  particleSystem.minLifeTime = 999999;  // Essentially permanent
  particleSystem.maxLifeTime = 999999;
  particleSystem.emitRate = 0;  // Don't emit new particles
  
  // Manual initial particles (2000 stars in random positions)
  particleSystem.manualEmitCount = starCount;
  
  // White color, no alpha variation
  particleSystem.color1 = new BABYLON.Color4(1, 1, 1, 1);
  particleSystem.color2 = new BABYLON.Color4(0.9, 0.9, 1, 1);
  particleSystem.colorDead = new BABYLON.Color4(1, 1, 1, 1);
  
  // No movement (static stars)
  particleSystem.minEmitPower = 0;
  particleSystem.maxEmitPower = 0;
  particleSystem.updateSpeed = 0;  // Don't update (static)
  
  // Blending
  particleSystem.blendMode = BABYLON.ParticleSystem.BLENDMODE_ADD;
  
  particleSystem.start();
  
  console.log('[main] Star field created (optimized: 2000 stars in 1 draw call)');
}

// ── Wireframe Mountains ─────────────────────────────────────
function createWireframeMountains(scene) {
  const mountainCount = 12;
  const radius = 80;

  for (let i = 0; i < mountainCount; i++) {
    const angle = (i / mountainCount) * Math.PI * 2;
    const x = Math.cos(angle) * radius;
    const z = Math.sin(angle) * radius;

    // Create mountain as a simple pyramid
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

    // Wireframe material with GLOWING CYAN edges
    const mountainMat = new BABYLON.StandardMaterial('mountainMat' + i, scene);
    mountainMat.wireframe = true;
    mountainMat.disableLighting = true;
    mountainMat.emissiveColor = new BABYLON.Color3(0, 1, 1); // CYAN
    mountain.material = mountainMat;
  }
}

// ── WebXR Setup ────────────────────────────────────────────
function setupWebXR(scene) {
  console.log('[main] Setting up WebXR...');

  const xrHelper = scene.createDefaultXRExperienceAsync({
    floorMeshes: [],
    disableTeleportation: true,
    inputOptions: {
      doNotLoadControllerMeshes: true,  // Prevent loading default controller models
    },
  });

  xrHelper.then((xrExperience) => {
    console.log('[main] WebXR experience created');
    xr = xrExperience;
    
    // Check if WebXR is supported
    if (!xr.baseExperience) {
      console.warn('[main] WebXR not supported, showing fallback');
      document.getElementById('no-vr').style.display = 'block';
      return;
    }

    // Handle VR session start
    xr.baseExperience.onStateChangedObservable.add((state) => {
      console.log('[main] XR state changed:', state);
      
      if (state === BABYLON.WebXRState.IN_XR) {
        console.log('[main] Entered VR session');
        resumeAudioContext();
        
        // Hide non-VR UI
        document.getElementById('scanlines').style.display = 'none';
        
        // Initialize game state if not already
        if (game.state === 'TITLE') {
          // Wait for user to start game
        }
      } else if (state === BABYLON.WebXRState.NOT_IN_XR) {
        console.log('[main] Exited VR session');
        document.getElementById('scanlines').style.display = 'block';
      }
    });

    // Get controller references
    xr.input.onControllerAddedObservable.add((controller) => {
      console.log('[main] Controller added:', controller.uniqueId);
      setupController(controller);
    });

    xr.input.onControllerRemovedObservable.add((controller) => {
      console.log('[main] Controller removed:', controller.uniqueId);
      if (controller.handedness === 'left') controllers.left = null;
      if (controller.handedness === 'right') controllers.right = null;
    });

  }).catch((err) => {
    console.error('[main] WebXR setup failed:', err);
    document.getElementById('no-vr').style.display = 'block';
  });
}

// ── Controller Setup ───────────────────────────────────────
function setupController(controller) {
  // Store controller reference immediately (before motion controller init)
  // controller is WebXRInputSource which has .grip and .pointer meshes
  console.log('[main] Controller added, waiting for motion controller init:', controller.uniqueId);
  
  controller.onMotionControllerInitObservable.add((motionController) => {
    console.log('[main] Motion controller initialized:', motionController.handedness);
    
    const handedness = motionController.handedness;
    
    // Store motion controller reference for button input
    if (handedness === 'left') controllers.left = motionController;
    if (handedness === 'right') controllers.right = motionController;

    // Hide the default controller mesh by scaling it to 0 (don't use setEnabled - it destroys the controller!)
    // The rootMesh is loaded async, so we need to wait for it
    const hideDefaultMesh = () => {
      if (motionController.rootMesh) {
        motionController.rootMesh.scaling = new BABYLON.Vector3(0, 0, 0);  // Invisible but still tracked
        console.log('[main] Hidden default controller mesh for:', handedness);
      }
    };
    
    // Try immediately first
    hideDefaultMesh();
    
    // Also try when mesh loads (async)
    controller.onMeshLoadedObservable.add((mesh) => {
      hideDefaultMesh();
    });

    // Create custom synthwave blaster attached to controller
    // Pass the WebXRInputSource (controller) which has .grip, not motionController
    createCustomBlaster(controller, handedness);

    // Set up button listeners
    setupButtonListeners(motionController);
  });
}

// ── Custom Blaster Creation ───────────────────────────────
function createCustomBlaster(xrController, handedness) {
  // xrController is WebXRInputSource with .grip and .pointer meshes that track pose
  console.log('[main] Creating blaster, grip available:', !!xrController.grip);
  
  // Create a glowing cylinder as the blaster barrel
  const blaster = BABYLON.MeshBuilder.CreateCylinder('blaster_' + handedness, {
    height: 0.18,    // Length of barrel
    diameter: 0.035  // Thickness
  }, scene);
  
  // Cylinder axis is Y by default - rotate around X to point forward (Z direction)
  blaster.rotation.x = Math.PI / 2;
  
  // Position in front of grip, pointing forward
  blaster.position = new BABYLON.Vector3(0, 0, 0.12);  // Forward from grip
  blaster.parent = xrController.grip;  // Attach to grip mesh (tracks controller pose)
  
  // Glowing cyan material
  const blasterMat = new BABYLON.StandardMaterial('blasterMat_' + handedness, scene);
  blasterMat.disableLighting = true;
  blasterMat.emissiveColor = new BABYLON.Color3(0, 1, 1); // CYAN
  blaster.material = blasterMat;
  
  // Add glow effect (brighter core inside barrel)
  const core = BABYLON.MeshBuilder.CreateCylinder('blasterCore_' + handedness, {
    height: 0.18,
    diameter: 0.015
  }, scene);
  core.rotation.x = Math.PI / 2;
  core.position = new BABYLON.Vector3(0, 0, 0.12);
  core.parent = xrController.grip;  // Attach to grip mesh (tracks controller pose)
  
  const coreMat = new BABYLON.StandardMaterial('blasterCoreMat_' + handedness, scene);
  coreMat.disableLighting = true;
  coreMat.emissiveColor = new BABYLON.Color3(0.5, 1, 1); // BRIGHTER CYAN
  core.material = coreMat;
  
  // Create a handle that attaches to the grip point
  const handle = BABYLON.MeshBuilder.CreateCylinder('blasterHandle_' + handedness, {
    height: 0.08,
    diameter: 0.025
  }, scene);
  // Handle points down from grip (Y axis)
  handle.position = new BABYLON.Vector3(0, -0.04, 0);
  handle.parent = xrController.grip;
  
  const handleMat = new BABYLON.StandardMaterial('blasterHandleMat_' + handedness, scene);
  handleMat.disableLighting = true;
  handleMat.emissiveColor = new BABYLON.Color3(0, 0.8, 0.8); // Darker cyan
  handle.material = handleMat;
  
  console.log('[main] Created custom blaster for:', handedness, 'parent:', xrController.grip ? 'grip' : 'NO GRIP!');
}

// ── Button Listeners ───────────────────────────────────────
function setupButtonListeners(motionController) {
  // Main trigger (top trigger) - using proper pattern from Babylon.js playground #1FTUSC#37
  const trigger = motionController.getComponent('xr-standard-trigger');
  if (trigger) {
    trigger.onButtonStateChangedObservable.add((component) => {
      // Use changes.pressed to detect state changes (not just checking .pressed)
      if (component.changes.pressed) {
        if (component.pressed) {
          console.log('[main] Trigger pressed:', motionController.handedness);
          handleMainTrigger(motionController.handedness);
        } else {
          console.log('[main] Trigger released:', motionController.handedness);
          // Could add release handling here for charge shots etc.
        }
      }
    });
  }

  // Alt trigger (lower trigger/squeeze)
  const squeeze = motionController.getComponent('xr-standard-squeeze');
  if (squeeze) {
    squeeze.onButtonStateChangedObservable.add((component) => {
      if (component.changes.pressed) {
        if (component.pressed) {
          console.log('[main] Squeeze pressed:', motionController.handedness);
          handleAltTrigger(motionController.handedness);
        }
      }
    });
  }

  // Menu button (pause)
  const menuButton = motionController.getComponent('xr-standard-menu');
  if (menuButton) {
    menuButton.onButtonStateChangedObservable.add((component) => {
      if (component.changes.pressed && component.pressed && motionController.handedness === 'left') {
        console.log('[main] Menu button pressed - toggling pause');
        handlePause();
      }
    });
  }
}

// ── Input Handlers ──────────────────────────────────────────
function handleMainTrigger(handedness) {
  // TODO: Fire main weapon
  console.log('[main] Firing main weapon:', handedness);
}

function handleAltTrigger(handedness) {
  // TODO: Fire alt weapon
  console.log('[main] Firing alt weapon:', handedness);
}

function handlePause() {
  // TODO: Toggle pause state
  console.log('[main] Toggle pause');
}

// ── Render Loop ────────────────────────────────────────────
function renderLoop() {
  const now = performance.now();
  delta = (now - lastTime) / 1000;
  lastTime = now;
  frameCount++;

  // Performance monitoring
  if (perfMonitorEnabled && frameCount % 30 === 0) {
    perfMonitor.fps = engine.getFps();
    perfMonitor.frameTime = delta * 1000;
  }

  // Update debug flags
  if (window.debugPerfMonitor && !perfMonitorEnabled) {
    perfMonitorEnabled = true;
    console.log('[main] Performance monitor enabled');
  }

  // TODO: Update game logic based on game.state
  // - Update enemies
  // - Update projectiles
  // - Update particles
  // - Check collisions
  
  // TODO: Update UI (HUD, menus, etc.)
  
  scene.render();
}

// ── Start ───────────────────────────────────────────────────
init().catch((err) => {
  console.error('[main] Failed to initialize:', err);
});