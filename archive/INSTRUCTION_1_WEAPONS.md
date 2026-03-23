# INSTRUCTION SET 1: Main & Alt Weapon System

## Overview
Implement the dual-weapon system: Main weapons (top trigger) and Alt weapons (bottom trigger/squeeze). Each hand tracks weapons independently.

## Requirements from User

**Main Weapons (Top Trigger):**
- First weapon offer is always a side-grade (buckshot, lightning, charge_shot, plasma, seeker)
- After accepting first weapon, future upgrades go left-right-left-right alternating
- Standard weapon: single raycast shot
- Side-grades replace the weapon type completely

**Alt Weapons (Bottom Trigger/Squeeze):**
- Activated with controller squeeze button
- Each alt weapon has cooldown timer
- Visual indicator shows cooldown state
- Types: rocket, helper_bot, shield, gravity_well, ion_mortar, hologram

## Implementation Steps

### Step 1: Track First Weapon Offer

In `game.js`, add to the `game` object:
```javascript
firstWeaponOffered: false,
nextUpgradeHand: null,  // 'left' or 'right'
```

In `resetGame()`, reset these:
```javascript
firstWeaponOffered: false,
nextUpgradeHand: null,
```

### Step 2: Modify Upgrade Selection Flow

In `main.js` or wherever upgrades are generated, check if this is the first upgrade:

```javascript
// When generating upgrade cards
if (!game.firstWeaponOffered) {
  // First upgrade MUST be a side-grade weapon
  const sideGradeWeapons = UPGRADE_POOL.filter(u => u.sideGrade);
  // Show only side-grade options
  game.firstWeaponOffered = true;
  game.nextUpgradeHand = 'left';  // Start with left hand
} else {
  // Normal upgrade flow
  // Use game.nextUpgradeHand to determine which hand gets the upgrade
}
```

### Step 3: Hand Alternation Logic

When player selects an upgrade:
```javascript
function onUpgradeSelected(upgradeId) {
  const hand = game.nextUpgradeHand || 'left';
  addUpgrade(upgradeId, hand);

  // Alternate hands for next upgrade
  game.nextUpgradeHand = hand === 'left' ? 'right' : 'left';

  // If it was a side-grade, offer immediate bonus upgrade
  const upgrade = UPGRADE_POOL.find(u => u.id === upgradeId);
  if (upgrade && upgrade.sideGrade) {
    // Trigger additional upgrade selection immediately
    showBonusUpgrade();
  }
}
```

### Step 4: Alt Weapon Tracking

In `game.js`, add alt weapon state:
```javascript
altWeapons: {
  left: null,   // Alt weapon ID or null
  right: null
},
altCooldowns: {
  left: 0,      // Cooldown timer in seconds
  right: 0
},
```

Reset in `resetGame()`:
```javascript
altWeapons: { left: null, right: null },
altCooldowns: { left: 0, right: 0 },
```

### Step 5: Alt Weapon Firing

In `main.js`, add squeeze button handling:

```javascript
// In the controller input handling section (where triggers are checked)
function checkControllerInput(controller, hand) {
  const gamepad = controller.gamepad;
  if (!gamepad) return;

  // Main weapon (trigger)
  const triggerValue = gamepad.buttons[0]?.value || 0;
  if (triggerValue > 0.5 && !controller.userData.triggerPressed) {
    controller.userData.triggerPressed = true;
    fireMainWeapon(controller, hand);
  } else if (triggerValue < 0.5) {
    controller.userData.triggerPressed = false;
  }

  // Alt weapon (squeeze)
  const squeezeValue = gamepad.buttons[1]?.value || 0;
  if (squeezeValue > 0.5 && !controller.userData.squeezePressed) {
    controller.userData.squeezePressed = true;
    fireAltWeapon(controller, hand);
  } else if (squeezeValue < 0.5) {
    controller.userData.squeezePressed = false;
  }
}

function fireAltWeapon(controller, hand) {
  // Check if alt weapon exists
  const altWeaponId = game.altWeapons[hand];
  if (!altWeaponId) return;

  // Check cooldown
  if (game.altCooldowns[hand] > 0) {
    // Play "not ready" sound
    playErrorSound();
    return;
  }

  // Fire the alt weapon
  switch (altWeaponId) {
    case 'rocket':
      fireRocket(controller, hand);
      game.altCooldowns[hand] = 5.0;  // 5 second cooldown
      break;
    case 'helper_bot':
      spawnHelperBot(controller, hand);
      game.altCooldowns[hand] = 15.0;  // 15 second cooldown
      break;
    case 'shield':
      activateShield(hand);
      game.altCooldowns[hand] = 10.0;
      break;
    case 'gravity_well':
      createGravityWell(controller);
      game.altCooldowns[hand] = 8.0;
      break;
    case 'ion_mortar':
      fireIonMortar(controller);
      game.altCooldowns[hand] = 6.0;
      break;
    case 'hologram':
      spawnHologram(controller);
      game.altCooldowns[hand] = 12.0;
      break;
  }

  playAltWeaponSound();
}
```

### Step 6: Update Cooldowns

In `main.js` animate loop, update cooldowns:

```javascript
function animate() {
  // ... existing code ...

  if (game.state === State.PLAYING) {
    const delta = clock.getDelta();

    // Update alt weapon cooldowns
    if (game.altCooldowns.left > 0) {
      game.altCooldowns.left = Math.max(0, game.altCooldowns.left - delta);
    }
    if (game.altCooldowns.right > 0) {
      game.altCooldowns.right = Math.max(0, game.altCooldowns.right - delta);
    }
  }

  // ... rest of animation loop ...
}
```

### Step 7: Visual Cooldown Indicator

Add a visual ring or bar on each controller showing cooldown:

```javascript
// In controller setup, add cooldown indicator
function setupController(controller) {
  // ... existing controller setup ...

  // Add cooldown ring (circular progress indicator)
  const ringGeo = new THREE.RingGeometry(0.04, 0.05, 32);
  const ringMat = new THREE.MeshBasicMaterial({
    color: 0x00ffff,
    side: THREE.DoubleSide,
    transparent: true,
    opacity: 0.5
  });
  const ring = new THREE.Mesh(ringGeo, ringMat);
  ring.rotation.x = -Math.PI / 2;  // Face up
  ring.position.set(0, 0, -0.1);  // In front of controller
  controller.add(ring);
  controller.userData.cooldownRing = ring;
  ring.visible = false;
}

// In animate loop, update ring scale based on cooldown
function updateCooldownIndicator(controller, hand) {
  const cooldown = game.altCooldowns[hand];
  const ring = controller.userData.cooldownRing;

  if (cooldown > 0 && game.altWeapons[hand]) {
    ring.visible = true;
    // Scale ring based on cooldown (0 = ready, 1 = just fired)
    const maxCooldown = getAltWeaponCooldown(game.altWeapons[hand]);
    const progress = cooldown / maxCooldown;
    ring.scale.setScalar(progress);

    // Color: red when cooling down, green when ready
    ring.material.color.setHex(progress > 0.2 ? 0xff0000 : 0x00ff00);
  } else {
    ring.visible = false;
  }
}
```

## Alt Weapon Implementations (Stubs)

Implement basic versions of each alt weapon:

```javascript
function fireRocket(controller, hand) {
  // Create rocket projectile (faster, more damage than regular shot)
  const direction = new THREE.Vector3(0, 0, -1);
  controller.getWorldDirection(direction);

  const rocket = {
    position: controller.position.clone(),
    direction: direction,
    speed: 15,  // Faster than regular bullets
    damage: 50,  // High damage
    explosionRadius: 2,  // AOE damage
    lifetime: 3.0
  };

  rocketProjectiles.push(rocket);
  console.log(`[${hand}] Fired rocket`);
}

function spawnHelperBot(controller, hand) {
  // Create floating bot that auto-targets enemies
  const bot = {
    position: controller.position.clone(),
    lifetime: 10.0,  // Lasts 10 seconds
    fireRate: 0.5,   // Shoots every 0.5 seconds
    fireTimer: 0,
    hand: hand
  };

  helperBots.push(bot);
  console.log(`[${hand}] Spawned helper bot`);
}

function activateShield(hand) {
  // Create temporary damage shield
  game.shieldActive = true;
  game.shieldDuration = 5.0;  // 5 second shield
  console.log(`[${hand}] Activated shield`);
}

function createGravityWell(controller) {
  // Create area that pulls enemies in
  const well = {
    position: controller.position.clone(),
    radius: 3,
    pullStrength: 5,
    lifetime: 5.0
  };

  gravityWells.push(well);
  console.log('Created gravity well');
}

function fireIonMortar(controller) {
  // Arcing projectile that explodes on impact
  const direction = new THREE.Vector3(0, 0.5, -1);  // Arc upward
  controller.getWorldDirection(direction);

  const mortar = {
    position: controller.position.clone(),
    velocity: direction.multiplyScalar(10),
    gravity: -9.8,
    explosionRadius: 3,
    damage: 40,
    lifetime: 5.0
  };

  mortarProjectiles.push(mortar);
  console.log('Fired ion mortar');
}

function spawnHologram(controller) {
  // Create decoy that attracts enemies
  const hologram = {
    position: controller.position.clone(),
    lifetime: 8.0,
    attractRadius: 5  // Enemies target this instead of player
  };

  holograms.push(hologram);
  console.log('Spawned hologram decoy');
}
```

## Testing Checklist

- [ ] First upgrade offers only side-grade weapons
- [ ] After first weapon, upgrades alternate left-right
- [ ] Squeeze button fires alt weapon (not trigger)
- [ ] Alt weapon respects cooldown (can't spam)
- [ ] Cooldown indicator shows on controller
- [ ] Each alt weapon has distinct behavior
- [ ] Works for both left and right hands independently

## Notes

- Alt weapon projectiles need separate arrays (rocketProjectiles, mortarProjectiles, etc.)
- Update those arrays in animate loop
- Consider using object pooling for projectiles (see AGENTS.md)
- Test in VR - squeeze button might be different index on different controllers
