// ============================================================
//  SYNTHWAVE VR BLASTER - Babylon.js Port (main.js)
// ============================================================

import * as BABYLON from '@babylonjs/core';
import '@babylonjs/gui';
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

  // Stars background
  const starCount = 2000;
  const stars = [];
  for (let i = 0; i < starCount; i++) {
    const x = (Math.random() - 0.5) * 200;
    const y = Math.random() * 50 + 5;
    const z = (Math.random() - 0.5) * 200;
    const star = BABYLON.MeshBuilder.CreateBox('star', { size: 0.1 }, scene);
    star.position = new BABYLON.Vector3(x, y, z);
    star.isPickable = false;
    
    const starMat = new BABYLON.StandardMaterial('starMat', scene);
    starMat.disableLighting = true;
    starMat.emissiveColor = new BABYLON.Color3(1, 1, 1);
    star.material = starMat;
    stars.push(star);
  }

  // Sun disk (retro synthwave style) - rotate 180° to face player
  const sun = BABYLON.MeshBuilder.CreatePlane('sun', { width: 30, height: 30 }, scene);
  sun.position = new BABYLON.Vector3(0, 15, -100);  // In front of player (negative Z)
  sun.rotation.y = Math.PI;  // Rotate to face player
  
  const sunMat = new BABYLON.StandardMaterial('sunMat', scene);
  sunMat.disableLighting = true;
  sunMat.emissiveColor = new BABYLON.Color3(1, 0.4, 0.2);
  sun.material = sunMat;

  // Sun gradient bands (horizontal strips)
  for (let i = 0; i < 8; i++) {
    const band = BABYLON.MeshBuilder.CreatePlane('sunBand' + i, { width: 30, height: 1.5 }, scene);
    band.position = new BABYLON.Vector3(0, 15 - (i * 1.8), -99.5);
    band.rotation.y = Math.PI;  // Same rotation as sun
    
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

// ── Grid Floor ──────────────────────────────────────────────
function createGridFloor(scene) {
  const gridSize = 200;
  const divisions = 60;
  const step = gridSize / divisions;

  // Create horizontal lines
  for (let i = -divisions / 2; i <= divisions / 2; i++) {
    const points = [
      new BABYLON.Vector3(-gridSize / 2, 0, i * step),
      new BABYLON.Vector3(gridSize / 2, 0, i * step)
    ];
    const line = BABYLON.MeshBuilder.CreateLines('grid_line_x_' + i, { points }, scene);
    line.color = new BABYLON.Color3(1, 0, 1); // Magenta
    line.isPickable = false;
  }

  // Create vertical lines
  for (let i = -divisions / 2; i <= divisions / 2; i++) {
    const points = [
      new BABYLON.Vector3(i * step, 0, -gridSize / 2),
      new BABYLON.Vector3(i * step, 0, gridSize / 2)
    ];
    const line = BABYLON.MeshBuilder.CreateLines('grid_line_z_' + i, { points }, scene);
    line.color = new BABYLON.Color3(1, 0, 1); // Magenta
    line.isPickable = false;
  }

  console.log('[main] Grid floor created');
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
      console.log('[main] Controller added:', controller.id);
      setupController(controller);
    });

    xr.input.onControllerRemovedObservable.add((controller) => {
      console.log('[main] Controller removed:', controller.id);
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
  controller.onMotionControllerInitObservable.add((motionController) => {
    console.log('[main] Motion controller initialized:', motionController.handedness);
    
    const handedness = motionController.handedness;
    
    // Store controller reference
    if (handedness === 'left') controllers.left = motionController;
    if (handedness === 'right') controllers.right = motionController;

    // Set up button listeners
    setupButtonListeners(motionController);
  });
}

// ── Button Listeners ───────────────────────────────────────
function setupButtonListeners(motionController) {
  // Main trigger (top trigger)
  const trigger = motionController.getComponent('xr-standard-trigger');
  if (trigger) {
    trigger.onButtonStateChangedObservable.add((component) => {
      if (component.pressed && component.changed) {
        console.log('[main] Trigger pressed:', motionController.handedness);
        handleMainTrigger(motionController.handedness);
      }
    });
  }

  // Alt trigger (lower trigger/squeeze)
  const squeeze = motionController.getComponent('xr-standard-squeeze');
  if (squeeze) {
    squeeze.onButtonStateChangedObservable.add((component) => {
      if (component.pressed && component.changed) {
        console.log('[main] Squeeze pressed:', motionController.handedness);
        handleAltTrigger(motionController.handedness);
      }
    });
  }

  // Menu button (pause)
  const menuButton = motionController.getComponent('xr-standard-menu');
  if (menuButton) {
    menuButton.onButtonStateChangedObservable.add((component) => {
      if (component.pressed && component.changed && motionController.handedness === 'left') {
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