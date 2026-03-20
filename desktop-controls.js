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
  space: false,
  w: false,
  a: false,
  s: false,
  d: false,
  q: false,
  e: false
};

// Mouse state
const mouse = {
  x: 0, y: 0,
  buttons: 0,
  locked: false,
  isPressed: false  // Explicit press tracking (more reliable for trackpad)
};

// Desktop player state
const player = {
  position: new THREE.Vector3(0, 1.6, 0),
  rotation: new THREE.Euler(0, 0, 0, 'YXZ'),
  velocity: new THREE.Vector3(),
  isMoving: false,
  // Separate yaw/pitch tracking for clean FPS camera (no roll)
  yaw: 0,
  pitch: 0
};

// Debug movement settings (for desktop no-clip mode)
const walkSpeed = 8.0; // starting speed
const sprintSpeed = 18.0; // max speed after holding ~1.5s
const rampTime = 1.5; // seconds to reach sprint speed
let currentMoveSpeed = walkSpeed;
let moveRampTimer = 0; // how long movement keys have been held
const verticalSpeed = 5.0; // units per second for Q/E
const friction = 10.0; // damping factor
const acceleration = 30.0; // acceleration factor
let debugMode = true; // debug movement enabled by default for positioning

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

// ESC/pause callback
let onPauseCallback = null;

export function setOnPauseCallback(callback) {
  onPauseCallback = callback;
}

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
  debugMode = true; // Enable debug movement in desktop mode
  console.log('[desktop-controls] Enabled (debug mode)');

  // Sync player position with camera
  if (cameraRef) {
    player.position.copy(cameraRef.position);
    // Extract yaw/pitch from camera rotation
    player.yaw = cameraRef.rotation.y;
    player.pitch = cameraRef.rotation.x;
    // Rebuild rotation with zero roll
    player.rotation.set(player.pitch, player.yaw, 0, 'YXZ');
    cameraRef.rotation.copy(player.rotation);
  }

  // Request pointer lock for mouse look
  document.body.requestPointerLock = document.body.requestPointerLock ||
    document.body.mozRequestPointerLock ||
    document.body.webkitRequestPointerLock;

  if (document.body.requestPointerLock) {
    const req = document.body.requestPointerLock();
    if (req && req.catch) {
      req.catch((err) => {
        if (err && err.name === 'SecurityError') return;
        console.log('[desktop-controls] Click to enable mouse look');
      });
    }
  }

  // Show desktop mode indicator and debug panel
  showDesktopHUD();
  showDebugPositionPanel();
}

/**
 * Disable desktop controls.
 * Call when entering VR mode.
 */
export function disable() {
  if (!enabled) return;
  enabled = false;
  debugMode = false;
  console.log('[desktop-controls] Disabled');

  // Exit pointer lock
  document.exitPointerLock = document.exitPointerLock ||
    document.mozExitPointerLock ||
    document.webkitExitPointerLock;

  if (document.exitPointerLock) {
    document.exitPointerLock();
  }

  hideDesktopHUD();
  hideDebugPositionPanel();
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
  // Only need camera reference for movement, not full gameplay enable
  if (!cameraRef) return;

  player.isMoving = false;

  // Allow debug movement whenever desktop mode is available
  if (debugMode || enabled) {
    // Calculate movement direction based on camera orientation
    const moveDir = new THREE.Vector3();

    // Get forward and right vectors from camera orientation
    const forward = new THREE.Vector3();
    const right = new THREE.Vector3();
    const up = new THREE.Vector3(0, 1, 0);

    cameraRef.getWorldDirection(forward);
    forward.y = 0; // Keep movement horizontal
    forward.normalize();
    right.crossVectors(forward, up).normalize();

    // WASD movement
    if (keys.w) {
      moveDir.add(forward);
      player.isMoving = true;
    }
    if (keys.s) {
      moveDir.sub(forward);
      player.isMoving = true;
    }
    if (keys.a) {
      moveDir.sub(right);
      player.isMoving = true;
    }
    if (keys.d) {
      moveDir.add(right);
      player.isMoving = true;
    }

    // Q/E vertical movement
    if (keys.q) {
      moveDir.y -= 1;
      player.isMoving = true;
    }
    if (keys.e) {
      moveDir.y += 1;
      player.isMoving = true;
    }

    // Normalize horizontal movement if any
    if (moveDir.lengthSq() > 0) {
      const horizontal = new THREE.Vector3(moveDir.x, 0, moveDir.z);
      if (horizontal.lengthSq() > 0) {
        // Ramp speed from walk to sprint
        moveRampTimer = Math.min(moveRampTimer + dt, rampTime);
        currentMoveSpeed = walkSpeed + (sprintSpeed - walkSpeed) * (moveRampTimer / rampTime);
        horizontal.normalize().multiplyScalar(currentMoveSpeed);
      }

      // Apply vertical speed
      if (moveDir.y !== 0) {
        moveDir.y *= verticalSpeed;
      } else {
        moveDir.y = 0;
      }

      // Apply acceleration to velocity
      const targetVelocity = new THREE.Vector3(horizontal.x, moveDir.y, horizontal.z);
      player.velocity.lerp(targetVelocity, acceleration * dt);
    } else {
      // Apply friction when not moving
      player.velocity.multiplyScalar(1 - friction * dt);
      // Reset speed ramp when no movement keys held
      moveRampTimer = 0;
      currentMoveSpeed = walkSpeed;
    }

    // Stop very small velocities
    if (player.velocity.lengthSq() < 0.0001) {
      player.velocity.set(0, 0, 0);
      player.isMoving = false;
    }

    // Apply velocity to position
    player.position.addScaledVector(player.velocity, dt);
  } else {
    // Non-debug mode: keep player position synced to camera
    player.position.copy(cameraRef.position);
  }

  // Sync camera to player position
  cameraRef.position.copy(player.position);

  // Lock roll (horizon tilt) every frame - critical for FPS-style mouse look
  if (cameraRef.rotation) {
    cameraRef.rotation.z = 0;
  }
  player.rotation.z = 0;

  // Update debug position display
  updateDebugPositionPanel();

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
    // Use explicit isPressed flag (more reliable for trackpad) with fallbacks
    triggerPressed: mouse.isPressed || mouse.buttons > 0 || keys.space
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

  // Prevent context menu from interrupting fire
  window.addEventListener('contextmenu', (e) => {
    if (enabled) e.preventDefault();
  });

  // Reset button state on focus loss (critical for trackpad)
  window.addEventListener('blur', () => {
    mouse.buttons = 0;
    mouse.isPressed = false;
    keys.space = false;
  });

  // Reset on visibility change (tab switch, minimize)
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      mouse.buttons = 0;
      mouse.isPressed = false;
      keys.space = false;
    }
  });

  // Pointer lock events
  document.addEventListener('pointerlockchange', onPointerLockChange);
  document.addEventListener('pointerlockerror', onPointerLockError);

  // Click to request pointer lock
  document.addEventListener('click', (e) => {
    if (!enabled || mouse.locked) return;
    if (e && e.target && e.target.closest && (e.target.closest('#debug-panel') || e.target.closest('#debug-toggle'))) {
      return;
    }
    document.body.requestPointerLock = document.body.requestPointerLock ||
      document.body.mozRequestPointerLock ||
      document.body.webkitRequestPointerLock;

    if (document.body.requestPointerLock) {
      const req = document.body.requestPointerLock();
      if (req && req.catch) {
        req.catch((err) => {
          if (err && err.name === 'SecurityError') return;
          console.log('[desktop-controls] Click to enable mouse look');
        });
      }
    }
  });
}

function onKeyDown(e) {
  if (!enabled) return;

  const key = e.key.toLowerCase();

  // Movement keys
  if (key === 'w') keys.w = true;
  if (key === 'a') keys.a = true;
  if (key === 's') keys.s = true;
  if (key === 'd') keys.d = true;
  if (key === 'q') keys.q = true;
  if (key === 'e') keys.e = true;

  // Fire
  if (key === ' ') {
    keys.space = true;
    handleFireInput();
  }

  // Copy position (C key)
  if (key === 'c') {
    copyPositionToClipboard();
  }

  // Weapon switching (1-4)
  if (key === '1') weaponState.fireMode = 'left';
  if (key === '2') weaponState.fireMode = 'right';
  if (key === '3') weaponState.fireMode = 'both';
  if (key === '4') weaponState.fireMode = 'both'; // Alternate both mode

  // ESC for menu/pause
  if (key === 'escape') {
    if (onPauseCallback) {
      onPauseCallback();
    }
    console.log('[desktop-controls] ESC pressed');
  }
}

function onKeyUp(e) {
  const key = e.key.toLowerCase();

  // Movement keys - always allow
  if (key === 'w') keys.w = false;
  if (key === 'a') keys.a = false;
  if (key === 's') keys.s = false;
  if (key === 'd') keys.d = false;
  if (key === 'q') keys.q = false;
  if (key === 'e') keys.e = false;

  if (key === ' ') keys.space = false;
}

function onMouseMove(e) {
  if (!enabled || !mouse.locked) return;

  const movementX = e.movementX || e.mozMovementX || e.webkitMovementX || 0;
  const movementY = e.movementY || e.mozMovementY || e.webkitMovementY || 0;

  const mouseSensitivity = 0.002;

  // Update yaw (horizontal) and pitch (vertical) separately
  player.yaw -= movementX * mouseSensitivity;
  player.pitch -= movementY * mouseSensitivity;

  // Clamp pitch to prevent flipping
  player.pitch = Math.max(-Math.PI / 2 + 0.1, Math.min(Math.PI / 2 - 0.1, player.pitch));

  // Rebuild rotation from yaw/pitch (roll always 0)
  player.rotation.set(player.pitch, player.yaw, 0, 'YXZ');

  // Apply to camera
  if (cameraRef) {
    cameraRef.rotation.copy(player.rotation);
  }
}

function onMouseDown(e) {
  if (!enabled) return;

  mouse.buttons = e.buttons;
  mouse.isPressed = true;  // Track explicit press

  if (e.button === 0) { // Left click
    handleFireInput();
  }
}

function onMouseUp(e) {
  mouse.buttons = e.buttons;
  mouse.isPressed = false;  // Clear on explicit release
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
  console.warn('[desktop-controls] Pointer lock error');
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

// ── Debug Position Panel ────────────────────────────────────

let debugPanelElement = null;
let lookAtRaycaster = null;
let currentLookTarget = null;
let originalMaterials = new Map(); // Store original materials for highlight reset

function showDebugPositionPanel() {
  if (debugPanelElement) {
    debugPanelElement.style.display = 'block';
    return;
  }

  // Create raycaster for look-at detection
  lookAtRaycaster = new THREE.Raycaster();
  lookAtRaycaster.far = 100; // Max distance to detect objects

  // Create debug panel element
  debugPanelElement = document.createElement('div');
  debugPanelElement.id = 'debug-position-panel';
  debugPanelElement.style.cssText = `
    position: fixed;
    top: 10px;
    left: 10px;
    background: rgba(0, 0, 0, 0.75);
    border: 2px solid rgba(0, 255, 255, 0.5);
    border-radius: 8px;
    padding: 12px;
    font-family: 'Courier New', monospace;
    font-size: 13px;
    color: #00ffff;
    z-index: 1000;
    pointer-events: none;
    min-width: 200px;
    backdrop-filter: blur(4px);
  `;
  debugPanelElement.innerHTML = `
    <div style="margin-bottom: 8px; font-weight: bold; color: #ffffff;">DEBUG POSITION</div>
    <div id="debug-pos-x">X: 0.00</div>
    <div id="debug-pos-y">Y: 0.00</div>
    <div id="debug-pos-z">Z: 0.00</div>
    <div style="margin-top: 8px; color: #ffffff;">Rotation (degrees):</div>
    <div id="debug-rot-x">Pitch: 0.00</div>
    <div id="debug-rot-y">Yaw: 0.00</div>
    <div style="margin-top: 8px; padding-top: 8px; border-top: 1px solid rgba(0,255,255,0.3); color: #ffff00;">LOOKING AT:</div>
    <div id="debug-look-name" style="color: #00ff88; font-weight: bold;">Nothing</div>
    <div id="debug-look-type" style="color: #888888; font-size: 11px;">Type: -</div>
    <div id="debug-look-dist" style="color: #888888; font-size: 11px;">Distance: -</div>
    <div style="margin-top: 12px; font-size: 11px; color: #888888;">
      WASD: Move | Q/E: Up/Down<br>
      C: Copy to clipboard
    </div>
    <button id="debug-copy-btn" style="
      margin-top: 10px;
      padding: 6px 12px;
      background: rgba(0, 255, 255, 0.2);
      border: 1px solid rgba(0, 255, 255, 0.5);
      color: #00ffff;
      border-radius: 4px;
      cursor: pointer;
      font-family: inherit;
      font-size: 11px;
      pointer-events: auto;
    ">Copy Position</button>
  `;
  document.body.appendChild(debugPanelElement);

  // Add click handler for copy button
  const copyBtn = debugPanelElement.querySelector('#debug-copy-btn');
  if (copyBtn) {
    copyBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      copyPositionToClipboard();
    });
  }
}

function hideDebugPositionPanel() {
  if (debugPanelElement) {
    debugPanelElement.style.display = 'none';
  }
  // Clear any active highlight
  if (currentLookTarget) {
    clearHighlight(currentLookTarget);
    currentLookTarget = null;
  }
  originalMaterials.clear();
}

function updateDebugPositionPanel() {
  if (!debugPanelElement || debugPanelElement.style.display === 'none') return;

  const posXEl = debugPanelElement.querySelector('#debug-pos-x');
  const posYEl = debugPanelElement.querySelector('#debug-pos-y');
  const posZEl = debugPanelElement.querySelector('#debug-pos-z');
  const rotXEl = debugPanelElement.querySelector('#debug-rot-x');
  const rotYEl = debugPanelElement.querySelector('#debug-rot-y');
  const lookNameEl = debugPanelElement.querySelector('#debug-look-name');
  const lookTypeEl = debugPanelElement.querySelector('#debug-look-type');
  const lookDistEl = debugPanelElement.querySelector('#debug-look-dist');

  if (posXEl) posXEl.textContent = `X: ${player.position.x.toFixed(2)}`;
  if (posYEl) posYEl.textContent = `Y: ${player.position.y.toFixed(2)}`;
  if (posZEl) posZEl.textContent = `Z: ${player.position.z.toFixed(2)}`;

  // Convert rotation from radians to degrees
  const pitchDeg = THREE.MathUtils.radToDeg(player.pitch);
  const yawDeg = THREE.MathUtils.radToDeg(player.yaw);

  if (rotXEl) rotXEl.textContent = `Pitch: ${pitchDeg.toFixed(2)}°`;
  if (rotYEl) rotYEl.textContent = `Yaw: ${yawDeg.toFixed(2)}°`;

  // === LOOK-AT DETECTION ===
  if (lookAtRaycaster && cameraRef && sceneRef) {
    // Cast ray from camera center
    lookAtRaycaster.setFromCamera({ x: 0, y: 0 }, cameraRef);
    const intersects = lookAtRaycaster.intersectObjects(sceneRef.children, true);

    // Remove highlight from previous target
    if (currentLookTarget) {
      clearHighlight(currentLookTarget);
      currentLookTarget = null;
    }

    // Find first valid hit (skip camera-attached objects and very close objects)
    let validHit = null;
    let validObj = null;
    
    for (const hit of intersects) {
      const obj = hit.object;
      
      // Skip objects very close (likely camera-attached UI)
      if (hit.distance < 0.5) continue;
      
      // Check if this object or any parent is the camera
      let isCameraChild = false;
      let checkParent = obj.parent;
      while (checkParent) {
        if (checkParent === cameraRef || checkParent.isCamera) {
          isCameraChild = true;
          break;
        }
        checkParent = checkParent.parent;
      }
      if (isCameraChild) continue;
      
      // This is a valid scene object
      validHit = hit;
      validObj = obj;
      break;
    }

    if (validHit && validObj) {
      const obj = validObj;
      
      // Walk up to find named ancestor (groups often have names, meshes may not)
      let objName = null;
      
      // Check userData fields first (more likely to have meaningful names)
      const userDataFields = ['name', 'id', 'enemyType', 'sceneryType', 'type', 'label'];
      for (const field of userDataFields) {
        if (obj.userData?.[field]) {
          objName = obj.userData[field];
          break;
        }
      }
      
      // Then check object.name
      if (!objName && obj.name) {
        objName = obj.name;
      }
      
      // Walk up parent chain looking for name
      let parent = obj.parent;
      while (!objName && parent && parent !== sceneRef) {
        // Check parent name
        if (parent.name) {
          objName = parent.name;
          break;
        }
        // Check parent userData
        for (const field of userDataFields) {
          if (parent.userData?.[field]) {
            objName = parent.userData[field];
            break;
          }
        }
        parent = parent.parent;
      }

      // Determine object type
      let objType = 'Unknown';
      if (obj.geometry) {
        const geoType = obj.geometry.type?.replace('Geometry', '').replace('Buffer', '') || 'Mesh';
        objType = geoType;
      }
      if (obj.type) {
        objType = obj.type;
      }
      if (obj.userData?.enemyType) {
        objType = `Enemy: ${obj.userData.enemyType}`;
      }
      if (obj.userData?.scenery) {
        objType = 'Scenery';
      }
      if (obj.userData?.isUpgradeCard) {
        objType = 'Upgrade Card';
      }

      // Fallback name if none found - use geometry info
      if (!objName) {
        if (obj.geometry) {
          const geoInfo = obj.geometry.type || 'Geometry';
          objName = `<${geoInfo}>`;
        } else {
          objName = `<unnamed ${objType}>`;
        }
      }

      // Update display with more detail
      const geoType = obj.geometry?.type?.replace('Geometry', '').replace('Buffer', '') || objType;
      if (lookNameEl) lookNameEl.textContent = objName;
      if (lookTypeEl) lookTypeEl.textContent = `Type: ${geoType} (${obj.type})`;
      if (lookDistEl) lookDistEl.textContent = `Distance: ${validHit.distance.toFixed(2)}`;

      // Highlight the object
      currentLookTarget = obj;
      applyHighlight(obj);
    } else {
      // Nothing in view
      if (lookNameEl) lookNameEl.textContent = 'Nothing';
      if (lookTypeEl) lookTypeEl.textContent = 'Type: -';
      if (lookDistEl) lookDistEl.textContent = 'Distance: -';
    }
  }
}

// === HIGHLIGHT SYSTEM ===

/**
 * Apply a highlight effect to an object
 */
function applyHighlight(obj) {
  if (!obj || !obj.material) return;

  // Store original material properties
  if (!originalMaterials.has(obj)) {
    originalMaterials.set(obj, {
      emissive: obj.material.emissive ? obj.material.emissive.clone() : null,
      emissiveIntensity: obj.material.emissiveIntensity || 0,
      color: obj.material.color ? obj.material.color.clone() : null,
    });
  }

  // Apply highlight (yellow glow)
  if (obj.material.emissive) {
    obj.material.emissive.setHex(0xffff00);
    obj.material.emissiveIntensity = 0.5;
  }
  // Also tint the color slightly if no emissive
  if (obj.material.color && !obj.material.emissive) {
    obj.material.color.setHex(0xffff88);
  }

  // Mark as highlighted
  obj.userData._debugHighlighted = true;
}

/**
 * Clear highlight effect from an object
 */
function clearHighlight(obj) {
  if (!obj) return;

  const original = originalMaterials.get(obj);
  if (original) {
    // Restore original material properties
    if (obj.material.emissive && original.emissive) {
      obj.material.emissive.copy(original.emissive);
      obj.material.emissiveIntensity = original.emissiveIntensity;
    }
    if (obj.material.color && original.color && !obj.material.emissive) {
      obj.material.color.copy(original.color);
    }
    originalMaterials.delete(obj);
  }

  obj.userData._debugHighlighted = false;
}

function copyPositionToClipboard() {
  const pos = player.position;
  const pitchDeg = THREE.MathUtils.radToDeg(player.pitch);
  const yawDeg = THREE.MathUtils.radToDeg(player.yaw);

  const text = `Position: (${pos.x.toFixed(3)}, ${pos.y.toFixed(3)}, ${pos.z.toFixed(3)})\nRotation: (pitch: ${pitchDeg.toFixed(2)}°, yaw: ${yawDeg.toFixed(2)}°)`;

  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(text).then(() => {
      console.log('[desktop-controls] Position copied to clipboard');
      // Visual feedback
      if (debugPanelElement) {
        const copyBtn = debugPanelElement.querySelector('#debug-copy-btn');
        if (copyBtn) {
          const originalText = copyBtn.textContent;
          copyBtn.textContent = 'Copied!';
          copyBtn.style.background = 'rgba(0, 255, 136, 0.3)';
          copyBtn.style.borderColor = 'rgba(0, 255, 136, 0.5)';
          setTimeout(() => {
            copyBtn.textContent = originalText;
            copyBtn.style.background = 'rgba(0, 255, 255, 0.2)';
            copyBtn.style.borderColor = 'rgba(0, 255, 255, 0.5)';
          }, 1000);
        }
      }
    }).catch((err) => {
      console.error('[desktop-controls] Failed to copy to clipboard:', err);
    });
  } else {
    console.warn('[desktop-controls] Clipboard API not available');
  }
}

/**
 * Get current position string formatted for biome spawn.
 * Returns: "{ x: X, y: Y, z: Z }"
 */
export function getPositionString() {
  const pos = player.position;
  return `{ x: ${pos.x.toFixed(3)}, y: ${pos.y.toFixed(3)}, z: ${pos.z.toFixed(3)} }`;
}

// ── HUD Helpers ────────────────────────────────────────────

let crosshairElement = null;

function showDesktopHUD() {
  if (crosshairElement) {
    crosshairElement.style.display = 'block';
    return;
  }

  // Create crosshair element
  crosshairElement = document.createElement('div');
  crosshairElement.id = 'desktop-crosshair';
  crosshairElement.style.cssText = `
    position: fixed;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    width: 24px;
    height: 24px;
    pointer-events: none;
    z-index: 999;
  `;
  crosshairElement.innerHTML = `
    <svg width="24" height="24" viewBox="0 0 24 24">
      <circle cx="12" cy="12" r="8" fill="none" stroke="rgba(255,255,255,0.5)" stroke-width="2"/>
      <line x1="12" y1="4" x2="12" y2="8" stroke="rgba(255,255,255,0.5)" stroke-width="2"/>
      <line x1="12" y1="16" x2="12" y2="20" stroke="rgba(255,255,255,0.5)" stroke-width="2"/>
      <line x1="4" y1="12" x2="8" y2="12" stroke="rgba(255,255,255,0.5)" stroke-width="2"/>
      <line x1="16" y1="12" x2="20" y2="12" stroke="rgba(255,255,255,0.5)" stroke-width="2"/>
    </svg>
  `;
  document.body.appendChild(crosshairElement);
}

function hideDesktopHUD() {
  if (crosshairElement) {
    crosshairElement.style.display = 'none';
  }
}

/**
 * Get control scheme name for display.
 */
export function getControlScheme() {
  return enabled ? 'Desktop (Keyboard/Mouse)' : 'VR Controllers';
}
