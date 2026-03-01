# INSTRUCTION SET 3: Keyboard & Mouse Controls

## Overview
Add keyboard and mouse controls for desktop testing (without VR headset). This is a DEBUG feature only - the game is designed for VR.

## Controls Layout

**Mouse:**
- Left Click: Fire left hand weapon
- Right Click: Fire right hand weapon
- Mouse Movement: Aim/look around

**Keyboard:**
- WASD: Move forward/left/back/right
- Space: Jump (or move up)
- Shift: Move down
- Q: Fire left alt weapon
- E: Fire right alt weapon
- R: Reload/reset
- Escape: Pause/return to menu
- F3: Toggle FPS stats
- 1-9: Jump to level (debug)

## Implementation Steps

### Step 1: Add PointerLockControls

In `main.js`, import PointerLockControls:

```javascript
import { PointerLockControls } from 'three/addons/controls/PointerLockControls.js';
```

Add at top level:

```javascript
let pointerControls = null;
let keyboardEnabled = false;
const keyboard = {
  forward: false,
  backward: false,
  left: false,
  right: false,
  up: false,
  down: false
};
```

### Step 2: Initialize Controls

In `init()`, after camera setup:

```javascript
function init() {
  // ... existing camera setup ...

  // Setup keyboard/mouse controls (desktop only)
  if (!navigator.xr) {
    // No WebXR support, enable keyboard controls
    keyboardEnabled = true;
    setupKeyboardControls();
  } else {
    // WebXR available, but allow enabling keyboard with 'K' key for testing
    window.addEventListener('keydown', (e) => {
      if (e.key === 'k' || e.key === 'K') {
        keyboardEnabled = !keyboardEnabled;
        if (keyboardEnabled) {
          setupKeyboardControls();
          console.log('Keyboard controls enabled (debug mode)');
        } else {
          disableKeyboardControls();
          console.log('Keyboard controls disabled');
        }
      }
    });
  }

  // ... rest of init ...
}

function setupKeyboardControls() {
  // Create pointer lock controls
  pointerControls = new PointerLockControls(camera, document.body);

  // Lock pointer on click
  document.body.addEventListener('click', () => {
    if (!renderer.xr.isPresenting) {
      pointerControls.lock();
    }
  });

  // Unlock with Escape
  pointerControls.addEventListener('unlock', () => {
    console.log('Pointer unlocked - click to resume');
  });

  console.log('Keyboard controls ready - click to enable pointer lock');
}

function disableKeyboardControls() {
  if (pointerControls) {
    pointerControls.unlock();
    pointerControls.dispose();
    pointerControls = null;
  }
}
```

### Step 3: Keyboard Input Handlers

Add keyboard event listeners:

```javascript
window.addEventListener('keydown', (e) => {
  if (!keyboardEnabled) return;

  switch (e.key.toLowerCase()) {
    case 'w': keyboard.forward = true; break;
    case 's': keyboard.backward = true; break;
    case 'a': keyboard.left = true; break;
    case 'd': keyboard.right = true; break;
    case ' ': keyboard.up = true; e.preventDefault(); break;
    case 'shift': keyboard.down = true; break;

    // Weapon firing
    case 'q':
      fireAltWeapon(null, 'left');
      break;
    case 'e':
      fireAltWeapon(null, 'right');
      break;

    // Game controls
    case 'r':
      if (game.state === State.GAME_OVER) {
        resetGame();
        game.state = State.TITLE;
      }
      break;
    case 'escape':
      if (game.state === State.PLAYING) {
        game.state = State.TITLE;
      }
      break;

    // Debug: Jump to level
    case '1': case '2': case '3': case '4': case '5':
    case '6': case '7': case '8': case '9':
      const level = parseInt(e.key);
      game.level = level;
      game.state = State.PLAYING;
      console.log(`Jumped to level ${level}`);
      break;
  }
});

window.addEventListener('keyup', (e) => {
  if (!keyboardEnabled) return;

  switch (e.key.toLowerCase()) {
    case 'w': keyboard.forward = false; break;
    case 's': keyboard.backward = false; break;
    case 'a': keyboard.left = false; break;
    case 'd': keyboard.right = false; break;
    case ' ': keyboard.up = false; break;
    case 'shift': keyboard.down = false; break;
  }
});
```

### Step 4: Mouse Click Firing

Add mouse click handlers:

```javascript
window.addEventListener('mousedown', (e) => {
  if (!keyboardEnabled || !pointerControls?.isLocked) return;

  if (game.state !== State.PLAYING) return;

  // Left click = left hand, right click = right hand
  if (e.button === 0) {
    // Left click - fire left hand main weapon
    fireMainWeapon(null, 'left');
  } else if (e.button === 2) {
    // Right click - fire right hand main weapon
    fireMainWeapon(null, 'right');
    e.preventDefault();
  }
});

// Prevent context menu on right click
window.addEventListener('contextmenu', (e) => {
  if (keyboardEnabled && pointerControls?.isLocked) {
    e.preventDefault();
  }
});
```

### Step 5: Update Camera Position with Keyboard

In `animate()`, update camera position based on keyboard:

```javascript
function animate() {
  // ... existing code ...

  if (keyboardEnabled && pointerControls?.isLocked && game.state === State.PLAYING) {
    updateKeyboardMovement();
  }

  // ... rest of animate ...
}

function updateKeyboardMovement() {
  const moveSpeed = 0.1;  // Units per frame

  // Get camera direction vectors
  const forward = new THREE.Vector3();
  const right = new THREE.Vector3();
  camera.getWorldDirection(forward);
  right.crossVectors(forward, camera.up).normalize();

  // Movement
  if (keyboard.forward) camera.position.addScaledVector(forward, moveSpeed);
  if (keyboard.backward) camera.position.addScaledVector(forward, -moveSpeed);
  if (keyboard.left) camera.position.addScaledVector(right, -moveSpeed);
  if (keyboard.right) camera.position.addScaledVector(right, moveSpeed);
  if (keyboard.up) camera.position.y += moveSpeed;
  if (keyboard.down) camera.position.y -= moveSpeed;

  // Clamp Y position (don't go below floor)
  camera.position.y = Math.max(0.5, camera.position.y);
}
```

### Step 6: Modify Weapon Firing for Keyboard Mode

Update `fireMainWeapon()` to handle keyboard mode (no controller):

```javascript
function fireMainWeapon(controller, hand) {
  const stats = getWeaponStats(game.upgrades[hand]);

  let origin, direction;

  if (controller) {
    // VR mode: fire from controller
    origin = new THREE.Vector3();
    direction = new THREE.Vector3();
    controller.getWorldPosition(origin);
    controller.getWorldDirection(direction);
  } else if (keyboardEnabled) {
    // Keyboard mode: fire from camera
    origin = camera.position.clone();
    direction = new THREE.Vector3();
    camera.getWorldDirection(direction);
  } else {
    return;  // No input method available
  }

  // ... rest of firing logic using origin and direction ...
}
```

### Step 7: Add Keyboard Controls Help

In `index.html`, add a keyboard controls overlay:

```html
<!-- Add after the info div -->
<div id="keyboard-help" style="display:none;position:absolute;bottom:20px;right:20px;z-index:100;background:rgba(10,0,21,0.9);border:1px solid #00ffff;padding:15px;font-size:12px;max-width:300px;">
  <div style="color:#00ffff;margin-bottom:8px;font-weight:bold;">KEYBOARD CONTROLS (DEBUG)</div>
  <div style="color:#ff00ff;">
    <div>WASD - Move</div>
    <div>Space/Shift - Up/Down</div>
    <div>Left Click - Fire Left Hand</div>
    <div>Right Click - Fire Right Hand</div>
    <div>Q/E - Alt Weapons</div>
    <div>F3 - Toggle FPS</div>
    <div>K - Toggle Keyboard Mode</div>
    <div>1-9 - Jump to Level</div>
  </div>
</div>
```

Show/hide with keyboard toggle:

```javascript
function setupKeyboardControls() {
  // ... existing setup ...

  document.getElementById('keyboard-help').style.display = 'block';
}

function disableKeyboardControls() {
  // ... existing cleanup ...

  document.getElementById('keyboard-help').style.display = 'none';
}
```

## Testing Checklist

- [ ] Click to lock pointer (mouse look works)
- [ ] WASD moves camera around
- [ ] Space/Shift moves up/down
- [ ] Left/right click fires respective hand weapons
- [ ] Q/E fires alt weapons (if equipped)
- [ ] Can navigate and play full level with keyboard
- [ ] Escape unlocks pointer
- [ ] K key toggles keyboard mode on/off
- [ ] Help overlay shows when keyboard enabled

## Important Notes

**This is a DEBUG feature:**
- Not intended for real gameplay (game is VR-first)
- Useful for testing upgrades, enemies, levels without VR headset
- Performance testing on desktop
- Allows designers to test without VR hardware

**Limitations:**
- Won't have proper depth perception (no stereoscopic rendering)
- Some VR-specific features may not work correctly
- Aiming is easier with mouse than VR controllers (balance testing won't be accurate)

**Best Practices:**
- Always final-test in actual VR before releasing
- Use keyboard mode for quick iteration on non-VR-specific features
- Don't balance gameplay around keyboard controls
