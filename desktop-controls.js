// ============================================================
//  DESKTOP CONTROLS - Keyboard/Mouse Input for Non-VR Play
// ============================================================
import * as THREE from 'three';

// ── Module State ───────────────────────────────────────────
let enabled = false;
let sceneRef = null;
let cameraRef = null;
let rendererRef = null;

// Movement state
const keys = {
  w: false, a: false, s: false, d: false,
  shift: false, space: false
};

// Mouse state
const mouse = {
  x: 0, y: 0,
  buttons: 0,
  locked: false
};

// Desktop player state
const player = {
  position: new THREE.Vector3(0, 1.6, 0),
  rotation: new THREE.Euler(0, 0, 0, 'YXZ'),
  velocity: new THREE.Vector3(),
  isMoving: false
};

// Weapon state
const weaponState = {
  fireMode: 'both', // 'left', 'right', 'both'
  leftFiring: false,
  rightFiring: false,
  lastFireTime: 0,
  fireCooldown: 150 // ms
};

// Raycaster for aiming (replaces VR controller raycaster)
const aimRaycaster = new THREE.Raycaster();
const aimOrigin = new THREE.Vector3();
const aimDirection = new THREE.Vector3();

// ── Public API ─────────────────────────────────────────────

/**
 * Initialize desktop controls system.
 * Call from init() in main.js after scene/camera/renderer are set up.
 */
export function initDesktopControls(scene, camera, renderer) {
  sceneRef = scene;
  cameraRef = camera;
  rendererRef = renderer;

  // Auto-detect VR availability
  if (navigator.xr) {
    navigator.xr.isSessionSupported('immersive-vr').then((supported) => {
      console.log(`[desktop-controls] VR available: ${supported}`);
      if (!supported) {
        console.log('[desktop-controls] No VR detected - enabling desktop mode');
        enable();
      }
    });
  } else {
    console.log('[desktop-controls] WebXR not supported - enabling desktop mode');
    enable();
  }

  // Setup event listeners (but don't enable yet)
  setupEventListeners();
}

/**
 * Enable desktop controls.
 * Call when switching from VR to desktop mode.
 */
export function enable() {
  if (enabled) return;
  enabled = true;
  console.log('[desktop-controls] Enabled');

  // Sync player position with camera
  if (cameraRef) {
    player.position.copy(cameraRef.position);
  }

  // Request pointer lock for mouse look
  document.body.requestPointerLock = document.body.requestPointerLock ||
    document.body.mozRequestPointerLock ||
    document.body.webkitRequestPointerLock;

  if (document.body.requestPointerLock) {
    document.body.requestPointerLock().catch(() => {
      console.log('[desktop-controls] Click to enable mouse look');
    });
  }

  // Show desktop mode indicator
  showDesktopHUD();
}

/**
 * Disable desktop controls.
 * Call when entering VR mode.
 */
export function disable() {
  if (!enabled) return;
  enabled = false;
  console.log('[desktop-controls] Disabled');

  // Exit pointer lock
  document.exitPointerLock = document.exitPointerLock ||
    document.mozExitPointerLock ||
    document.webkitExitPointerLock;

  if (document.exitPointerLock) {
    document.exitPointerLock();
  }

  hideDesktopHUD();
}

/**
 * Toggle between VR and desktop mode.
 */
export function toggleMode() {
  if (enabled) {
    disable();
    return false; // VR mode
  } else {
    enable();
    return true; // Desktop mode
  }
}

/**
 * Check if desktop mode is currently enabled.
 */
export function isEnabled() {
  return enabled;
}

/**
 * Get current player position (for shooting, etc).
 */
export function getPosition() {
  return player.position;
}

/**
 * Get shooting direction.
 * Returns normalized direction vector from player position.
 */
export function getShootDirection() {
  aimDirection.set(0, 0, -1);
  aimDirection.applyQuaternion(cameraRef.quaternion);
  return aimDirection;
}

/**
 * Get raycaster for aiming (for UI interaction).
 */
export function getAimRaycaster() {
  if (!enabled || !cameraRef) return null;

  // Ray from camera center
  aimRaycaster.setFromCamera({ x: 0, y: 0 }, cameraRef);
  return aimRaycaster;
}

/**
 * Check if user is currently locked (mouse look enabled).
 */
export function isLocked() {
  return mouse.locked;
}

/**
 * Update player movement and camera rotation.
 * Call from game loop.
 */
export function update(dt) {
  if (!enabled || !cameraRef) return;

  const moveSpeed = 0; // Disabled for testing - player should be stationary // units per second
  const mouseSensitivity = 0.002;

  // Process keyboard input
  player.velocity.set(0, 0, 0);
  player.isMoving = false;

  if (keys.w) player.velocity.z -= 1;
  if (keys.s) player.velocity.z += 1;
  if (keys.a) player.velocity.x -= 1;
  if (keys.d) player.velocity.x += 1;

  // Normalize diagonal movement
  if (player.velocity.length() > 0) {
    player.velocity.normalize();
    player.isMoving = true;
  }

  // Apply movement
  const speed = keys.shift ? moveSpeed * 1.5 : moveSpeed;
  player.position.addScaledVector(player.velocity, speed * dt);

  // Update camera position
  cameraRef.position.copy(player.position);

  // Mouse look is handled by pointerlockchange event
  // Camera rotation is applied to player.rotation

  return {
    moved: player.isMoving,
    position: player.position.clone(),
    direction: getShootDirection()
  };
}

/**
 * Get weapon firing state.
 * Returns { leftFiring, rightFiring, fireMode }.
 */
export function getWeaponState() {
  return {
    leftFiring: weaponState.leftFiring,
    rightFiring: weaponState.rightFiring,
    fireMode: weaponState.fireMode,
    triggerPressed: mouse.buttons > 0 || keys.space
  };
}

/**
 * Get "virtual controller" for compatibility with shootWeapon().
 * Returns an object with getWorldPosition() and getWorldQuaternion() methods.
 */
export function getVirtualController(hand = 'both') {
  if (!enabled || !cameraRef) return null;

  return {
    getWorldPosition: (target) => { target.copy(cameraRef.position); return target; },
    getWorldQuaternion: (target) => { target.copy(cameraRef.quaternion); return target; },
    userData: { handedness: hand }
  };
}

// ── Event Listeners ────────────────────────────────────────

function setupEventListeners() {
  // Keyboard events
  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);

  // Mouse events
  window.addEventListener('mousemove', onMouseMove);
  window.addEventListener('mousedown', onMouseDown);
  window.addEventListener('mouseup', onMouseUp);
  window.addEventListener('wheel', onMouseWheel);

  // Pointer lock events
  document.addEventListener('pointerlockchange', onPointerLockChange);
  document.addEventListener('pointerlockerror', onPointerLockError);

  // Click to request pointer lock
  document.addEventListener('click', () => {
    if (enabled && !mouse.locked) {
      document.body.requestPointerLock = document.body.requestPointerLock ||
        document.body.mozRequestPointerLock ||
        document.body.webkitRequestPointerLock;

      if (document.body.requestPointerLock) {
        document.body.requestPointerLock();
      }
    }
  });
}

function onKeyDown(e) {
  if (!enabled) return;

  const key = e.key.toLowerCase();

  // Movement
  if (key === 'w' || key === 'arrowup') keys.w = true;
  if (key === 's' || key === 'arrowdown') keys.s = true;
  if (key === 'a' || key === 'arrowleft') keys.a = true;
  if (key === 'd' || key === 'arrowright') keys.d = true;
  if (key === 'shift') keys.shift = true;

  // Fire
  if (key === ' ') {
    keys.space = true;
    handleFireInput();
  }

  // Weapon switching (1-4)
  if (key === '1') weaponState.fireMode = 'left';
  if (key === '2') weaponState.fireMode = 'right';
  if (key === '3') weaponState.fireMode = 'both';
  if (key === '4') weaponState.fireMode = 'both'; // Alternate both mode

  // ESC for menu/pause
  if (key === 'escape') {
    // Pause menu will be handled by main.js
    console.log('[desktop-controls] ESC pressed');
  }
}

function onKeyUp(e) {
  const key = e.key.toLowerCase();

  if (key === 'w' || key === 'arrowup') keys.w = false;
  if (key === 's' || key === 'arrowdown') keys.s = false;
  if (key === 'a' || key === 'arrowleft') keys.a = false;
  if (key === 'd' || key === 'arrowright') keys.d = false;
  if (key === 'shift') keys.shift = false;
  if (key === ' ') keys.space = false;
}

function onMouseMove(e) {
  if (!enabled || !mouse.locked) return;

  const movementX = e.movementX || e.mozMovementX || e.webkitMovementX || 0;
  const movementY = e.movementY || e.mozMovementY || e.webkitMovementY || 0;

  const mouseSensitivity = 0.002;

  // Yaw (horizontal rotation)
  player.rotation.y -= movementX * mouseSensitivity;

  // Pitch (vertical rotation) - clamped to prevent looking straight up/down
  player.rotation.x -= movementY * mouseSensitivity;
  player.rotation.x = Math.max(-Math.PI / 2 + 0.1, Math.min(Math.PI / 2 - 0.1, player.rotation.x));

  // Apply to camera
  if (cameraRef) {
    cameraRef.rotation.copy(player.rotation);
  }
}

function onMouseDown(e) {
  if (!enabled) return;

  mouse.buttons = e.buttons;

  if (e.button === 0) { // Left click
    handleFireInput();
  }
}

function onMouseUp(e) {
  mouse.buttons = e.buttons;
}

function onMouseWheel(e) {
  if (!enabled) return;

  // Weapon switching with scroll wheel
  const modes = ['left', 'right', 'both'];
  const currentIndex = modes.indexOf(weaponState.fireMode);

  if (e.deltaY < 0) {
    // Scroll up
    weaponState.fireMode = modes[(currentIndex + 1) % modes.length];
  } else {
    // Scroll down
    weaponState.fireMode = modes[(currentIndex - 1 + modes.length) % modes.length];
  }

  console.log(`[desktop-controls] Fire mode: ${weaponState.fireMode}`);
}

function onPointerLockChange() {
  mouse.locked = document.pointerLockElement === document.body ||
    document.mozPointerLockElement === document.body ||
    document.webkitPointerLockElement === document.body;

  console.log(`[desktop-controls] Pointer lock: ${mouse.locked}`);
}

function onPointerLockError() {
  // Pointer lock errors are normal when user presses ESC - ignore
}

function handleFireInput() {
  const now = performance.now();
  if (now - weaponState.lastFireTime < weaponState.fireCooldown) return;
  weaponState.lastFireTime = now;

  // Set firing flags based on fire mode
  if (weaponState.fireMode === 'left') {
    weaponState.leftFiring = true;
  } else if (weaponState.fireMode === 'right') {
    weaponState.rightFiring = true;
  } else {
    weaponState.leftFiring = true;
    weaponState.rightFiring = true;
  }
}

// ── HUD Helpers ────────────────────────────────────────────

let desktopHUDElement = null;

function showDesktopHUD() {
  if (desktopHUDElement) {
    desktopHUDElement.style.display = 'block';
    return;
  }

  // Create HUD element
  desktopHUDElement = document.createElement('div');
  desktopHUDElement.id = 'desktop-controls-hud';
  desktopHUDElement.style.cssText = `
    position: fixed;
    top: 10px;
    left: 10px;
    color: #00ffff;
    font-family: 'Courier New', monospace;
    font-size: 14px;
    text-shadow: 0 0 10px #00ffff;
    pointer-events: none;
    z-index: 1000;
  `;

  desktopHUDElement.innerHTML = `
    <div style="margin-bottom: 8px;"><strong>DESKTOP MODE</strong></div>
    <div>WASD: Move</div>
    <div>Mouse: Look & Aim</div>
    <div>Click/Space: Fire</div>
    <div>1/2/3: Weapon</div>
    <div>Scroll: Cycle Weapon</div>
    <div>ESC: Menu</div>
    <div style="margin-top: 8px; opacity: 0.7;">Click to enable mouse look</div>
  `;

  document.body.appendChild(desktopHUDElement);
}

function hideDesktopHUD() {
  if (desktopHUDElement) {
    desktopHUDElement.style.display = 'none';
  }
}

/**
 * Get control scheme name for display.
 */
export function getControlScheme() {
  return enabled ? 'Desktop (Keyboard/Mouse)' : 'VR Controllers';
}
