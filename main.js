// ============================================================
//  SPACEOMICIDE — Main Game Controller
//  Phase 1: Core game loop with levels, enemies, upgrades, HUD
// ============================================================

import * as THREE from 'three';
import { VRButton } from 'three/addons/webxr/VRButton.js';

import { State, game, resetGame, getLevelConfig, addScore, getComboMultiplier, damagePlayer, addUpgrade } from './game.js';
import { getRandomUpgrades, getWeaponStats } from './upgrades.js';
import { playShoothSound, playHitSound, playExplosionSound, playDamageSound, playFastEnemySpawn, playSwarmEnemySpawn, playProximityAlert, playSwarmProximityAlert, playUpgradeSound, playSlowMoSound, startLightningSound, stopLightningSound, playMusic, stopMusic, getMusicFrequencyData } from './audio.js';
import {
  initEnemies, spawnEnemy, updateEnemies, updateExplosions, getEnemyMeshes,
  getEnemyByMesh, clearAllEnemies, getEnemyCount, hitEnemy, destroyEnemy,
  applyEffects, getSpawnPosition, getEnemies, getFastEnemies, getSwarmEnemies
} from './enemies.js';
import {
  initHUD, showTitle, hideTitle, updateTitle, showHUD, hideHUD, updateHUD,
  showLevelComplete, hideLevelComplete, showUpgradeCards, hideUpgradeCards,
  updateUpgradeCards, getUpgradeCardHit, showGameOver, showVictory, updateEndScreen,
  hideGameOver, triggerHitFlash, updateHitFlash, spawnDamageNumber, updateDamageNumbers, updateFPS
} from './hud.js';

// ── Constants ──────────────────────────────────────────────
const NEON_PINK  = 0xff00ff;
const NEON_CYAN  = 0x00ffff;
const DARK_BG    = 0x0a0015;
const SUN_CORE   = 0xffaa00;
const SUN_GLOW   = 0xff6600;
const MTN_DARK   = 0x1a0033;
const MTN_WIRE   = 0x6600aa;

const LASER_RANGE    = 50;
const LASER_DURATION = 250;

// ── Module State ───────────────────────────────────────────
let scene, camera, renderer;
const controllers = [];
const controllerTriggerPressed = [false, false];
const projectiles = [];
let lastTime = 0;

// Weapon firing cooldowns (per controller)
const weaponCooldowns = [0, 0];

// Lightning beam state (per controller)
const lightningBeams = [null, null];
const lightningTimers = [0, 0];

// Holographic blaster displays (per controller)
const blasterDisplays = [null, null];

// Mountain visualizer
const mountainLines = [];
const mountainBasePeaks = [];

// Upgrade selection
let upgradeSelectionCooldown = 0;
let pendingUpgrades = [];
let upgradeHand = 'left';  // which hand is selecting

// Game over cooldown
let gameOverCooldown = 0;

// Bullet-time slow-mo
let slowMoActive = false;
let slowMoDuration = 0;
let slowMoSoundPlayed = false;
let timeScale = 1.0;

// Camera shake on damage
let cameraShake = 0;
let cameraShakeIntensity = 0;
const originalCameraPos = new THREE.Vector3();

// ── Bootstrap ──────────────────────────────────────────────
init();

// ============================================================
//  INITIALISATION
// ============================================================
function init() {
  console.log('[SPACEOMICIDE] Initialising...');

  // Scene
  scene = new THREE.Scene();
  scene.background = new THREE.Color(DARK_BG);
  scene.fog = new THREE.FogExp2(DARK_BG, 0.012);

  // Camera
  camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.1, 1000);
  camera.position.set(0, 1.6, 0);

  // Renderer
  renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(window.devicePixelRatio);
  renderer.xr.enabled = true;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.5;
  document.body.appendChild(renderer.domElement);

  // VR Button
  const vrButton = VRButton.createButton(renderer);
  document.body.appendChild(vrButton);

  if (!navigator.xr) {
    document.getElementById('no-vr').style.display = 'block';
    console.warn('[init] WebXR not supported');
  } else {
    navigator.xr.isSessionSupported('immersive-vr').then((supported) => {
      if (!supported) {
        document.getElementById('no-vr').style.display = 'block';
        console.warn('[init] immersive-vr not supported');
      }
    });
  }

  // Build world
  createEnvironment();
  setupControllers();

  // Init subsystems
  initEnemies(scene);
  initHUD(camera, scene);

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

// ============================================================
//  ENVIRONMENT
// ============================================================
function createEnvironment() {
  // Grid floor - brighter with higher opacity
  const grid = new THREE.GridHelper(200, 80, NEON_PINK, 0xff0088);
  if (Array.isArray(grid.material)) {
    grid.material.forEach(m => { m.transparent = true; m.opacity = 0.85; });
  } else {
    grid.material.transparent = true;
    grid.material.opacity = 0.85;
  }
  scene.add(grid);

  const floorGeo = new THREE.PlaneGeometry(200, 200);
  const floorMat = new THREE.MeshBasicMaterial({ color: 0x220044, side: THREE.DoubleSide });
  const floor = new THREE.Mesh(floorGeo, floorMat);
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = -0.01;
  scene.add(floor);

  createSun();
  createMountains();
  createStars();

  // Lighting - much brighter
  scene.add(new THREE.AmbientLight(0x5500aa, 0.8));
  const pinkLight = new THREE.PointLight(NEON_PINK, 2.5, 35);
  pinkLight.position.set(-6, 4, -6);
  scene.add(pinkLight);
  const cyanLight = new THREE.PointLight(NEON_CYAN, 2.5, 35);
  cyanLight.position.set(6, 4, -6);
  scene.add(cyanLight);
}

function createSun() {
  const coreMat = new THREE.MeshBasicMaterial({ color: SUN_CORE, side: THREE.DoubleSide });
  const core = new THREE.Mesh(new THREE.CircleGeometry(14, 64), coreMat);
  core.position.set(0, 10, -90);
  scene.add(core);

  // Brighter glow with higher opacity
  const glowMat = new THREE.MeshBasicMaterial({ color: SUN_GLOW, side: THREE.DoubleSide, transparent: true, opacity: 0.5 });
  const glow = new THREE.Mesh(new THREE.CircleGeometry(20, 64), glowMat);
  glow.position.set(0, 10, -90.5);
  scene.add(glow);

  const stripeMat = new THREE.LineBasicMaterial({ color: DARK_BG });
  for (let y = -10; y <= 0; y += 2) {
    const points = [new THREE.Vector3(-15, 10 + y, -89.9), new THREE.Vector3(15, 10 + y, -89.9)];
    const stripe = new THREE.Line(new THREE.BufferGeometry().setFromPoints(points), stripeMat);
    scene.add(stripe);
  }
}

function createMountains() {
  const layers = [
    { z: -85, color: 0x0d001a, peaks: generatePeaks(12, 6, 20), layerIndex: 0 },
    { z: -75, color: MTN_DARK,  peaks: generatePeaks(10, 4, 14), layerIndex: 1 },
  ];
  layers.forEach(({ z, color, peaks, layerIndex }) => {
    // Store base peaks for animation
    mountainBasePeaks[layerIndex] = peaks.map(([x, y]) => ({ x, y, baseY: y }));

    const shape = new THREE.Shape();
    shape.moveTo(-100, 0);
    peaks.forEach(([x, y]) => shape.lineTo(x, y));
    shape.lineTo(100, 0);
    shape.closePath();

    const fillMesh = new THREE.Mesh(new THREE.ShapeGeometry(shape), new THREE.MeshBasicMaterial({ color, side: THREE.DoubleSide }));
    fillMesh.position.set(0, 0, z);
    scene.add(fillMesh);

    const edgePoints = [new THREE.Vector3(-100, 0, z)];
    peaks.forEach(([x, y]) => edgePoints.push(new THREE.Vector3(x, y, z)));
    edgePoints.push(new THREE.Vector3(100, 0, z));
    const geometry = new THREE.BufferGeometry().setFromPoints(edgePoints);
    const edgeLine = new THREE.Line(geometry, new THREE.LineBasicMaterial({ color: MTN_WIRE, transparent: true, opacity: 0.8 }));
    scene.add(edgeLine);

    // Store for animation
    mountainLines[layerIndex] = { line: edgeLine, geometry, z, fillMesh, shape };
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

function createStars() {
  const count = 1500;
  const positions = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    const i3 = i * 3;
    positions[i3]     = (Math.random() - 0.5) * 300;
    positions[i3 + 1] = Math.random() * 80 + 10;
    positions[i3 + 2] = (Math.random() - 0.5) * 300;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  // Brighter stars with higher opacity
  const mat = new THREE.PointsMaterial({ color: 0xffffff, size: 0.4, transparent: true, opacity: 0.95 });
  scene.add(new THREE.Points(geo, mat));
}

// ============================================================
//  CONTROLLERS
// ============================================================
function setupControllers() {
  for (let i = 0; i < 2; i++) {
    const controller = renderer.xr.getController(i);

    controller.addEventListener('selectstart', () => { controllerTriggerPressed[i] = true; onTriggerPress(controller, i); });
    controller.addEventListener('selectend',   () => { controllerTriggerPressed[i] = false; onTriggerRelease(i); });
    controller.addEventListener('connected', (e) => {
      console.log(`[controller] ${i} connected — ${e.data.handedness}`);
      controller.userData.handedness = e.data.handedness;
    });
    controller.addEventListener('disconnected', () => {
      console.log(`[controller] ${i} disconnected`);
    });

    controller.add(createControllerVisual(i));
    scene.add(controller);
    controllers.push(controller);
  }
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

function createBlasterDisplay(controllerIndex) {
  const group = new THREE.Group();
  const hand = controllerIndex === 0 ? 'left' : 'right';

  // Background panel with cyan glow
  const panelGeo = new THREE.PlaneGeometry(0.2, 0.25);
  const panelMat = new THREE.MeshBasicMaterial({
    color: 0x003344,
    transparent: true,
    opacity: 0.7,
    side: THREE.DoubleSide
  });
  const panel = new THREE.Mesh(panelGeo, panelMat);
  group.add(panel);

  // Cyan scan lines for hologram effect
  for (let i = 0; i < 10; i++) {
    const lineGeo = new THREE.PlaneGeometry(0.2, 0.002);
    const lineMat = new THREE.MeshBasicMaterial({
      color: 0x00ffff,
      transparent: true,
      opacity: 0.3
    });
    const line = new THREE.Mesh(lineGeo, lineMat);
    line.position.y = -0.1 + (i * 0.025);
    line.position.z = 0.001;
    group.add(line);
  }

  // Border
  const borderGeo = new THREE.EdgesGeometry(panelGeo);
  const borderMat = new THREE.LineBasicMaterial({ color: 0x00ffff, linewidth: 2 });
  const border = new THREE.LineSegments(borderGeo, borderMat);
  border.position.z = 0.001;
  group.add(border);

  // Position above controller
  group.position.set(0, 0.15, -0.05);
  group.rotation.x = -Math.PI / 4;  // Tilt toward user

  // Create text sprites (will be updated later)
  group.userData.hand = hand;
  group.userData.needsUpdate = true;

  return group;
}

function updateBlasterDisplay(display, controllerIndex) {
  if (!display || !display.visible) return;

  const hand = display.userData.hand;
  const stats = game.handStats[hand];
  const upgrades = game.upgrades[hand];

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

  // Show upgrade count
  const upgradeCount = Object.values(upgrades).reduce((sum, count) => sum + count, 0);
  display.add(makeText(`UPGRADES: ${upgradeCount}`, -0.08, 16));

  display.userData.needsUpdate = false;
}

// ============================================================
//  INPUT HANDLING
// ============================================================
function onTriggerPress(controller, index) {
  const st = game.state;

  if (st === State.TITLE) {
    startGame();
  } else if (st === State.PLAYING) {
    shootWeapon(controller, index);
  } else if (st === State.UPGRADE_SELECT) {
    selectUpgrade(controller);
  } else if (st === State.GAME_OVER || st === State.VICTORY) {
    if (gameOverCooldown <= 0) {
      hideGameOver();
      resetGame();
      showTitle();
    }
  }
}

function onTriggerRelease(index) {
  // Stop lightning beam when trigger released
  if (lightningBeams[index]) {
    scene.remove(lightningBeams[index]);
    lightningBeams[index] = null;
    stopLightningSound();
  }
}

// ============================================================
//  GAME STATE TRANSITIONS
// ============================================================
function startGame() {
  console.log('[game] Starting new game');
  hideTitle();
  resetGame();
  game.state = State.PLAYING;
  game.level = 1;
  game._levelConfig = getLevelConfig();
  showHUD();

  // Hide blaster displays during gameplay
  blasterDisplays.forEach(d => { if (d) d.visible = false; });

  // Start level music
  playMusic('levels1to5');
}

function completeLevel() {
  console.log(`[game] Level ${game.level} complete`);
  game.state = State.LEVEL_COMPLETE;
  clearAllEnemies();
  game.stateTimer = 2.0; // cooldown before upgrade screen
  showLevelComplete(game.level, camera.position);
}

function showUpgradeScreen() {
  console.log('[game] Showing upgrade selection');
  game.state = State.UPGRADE_SELECT;
  hideLevelComplete();

  // Stop lightning sound during upgrade screen
  stopLightningSound();

  // Alternate between left and right hand
  upgradeHand = upgradeHand === 'left' ? 'right' : 'left';

  pendingUpgrades = getRandomUpgrades(3);
  showUpgradeCards(pendingUpgrades, camera.position, upgradeHand);
  upgradeSelectionCooldown = 1.5; // prevent instant selection

  // Mark blaster displays for update
  blasterDisplays.forEach(d => { if (d) d.userData.needsUpdate = true; });
}

function selectUpgradeAndAdvance(upgrade, hand) {
  console.log(`[game] Selected upgrade: ${upgrade.name} for ${hand} hand`);
  addUpgrade(upgrade.id, hand);
  playUpgradeSound();
  hideUpgradeCards();

  // Advance to next level
  game.level++;
  game.kills = 0;

  if (game.level > 20) {
    endGame(true); // victory
  } else {
    game.state = State.PLAYING;
    game._levelConfig = getLevelConfig();
    showHUD();

    // Hide blaster displays during gameplay
    blasterDisplays.forEach(d => { if (d) d.visible = false; });

    // Change music on level 6 (levels 6-10)
    if (game.level === 6) {
      playMusic('levels6to10');
    }
  }
}

function endGame(victory) {
  console.log(`[game] Game ${victory ? 'won' : 'over'} — score: ${game.score}`);
  game.state = victory ? State.VICTORY : State.GAME_OVER;
  clearAllEnemies();
  hideHUD();
  gameOverCooldown = 2.0;  // 2 second cooldown before restart allowed

  // Stop music
  stopMusic();

  if (victory) {
    showVictory(game.score, camera.position);
  } else {
    showGameOver(game.score, camera.position);
  }
}

// ============================================================
//  SHOOTING & COMBAT
// ============================================================
function shootWeapon(controller, index) {
  const now = performance.now();
  const hand = index === 0 ? 'left' : 'right';
  const stats = getWeaponStats(game.upgrades[hand]);

  // Lightning beam mode - handled separately in update loop
  if (stats.lightning) {
    return;  // Lightning is continuous hold-to-fire
  }

  // Check cooldown
  if (now - weaponCooldowns[index] < stats.fireInterval) return;
  weaponCooldowns[index] = now;

  const origin = new THREE.Vector3();
  const quat   = new THREE.Quaternion();
  controller.getWorldPosition(origin);
  controller.getWorldQuaternion(quat);
  const direction = new THREE.Vector3(0, 0, -1).applyQuaternion(quat);

  // Fire projectile(s)
  const count = stats.projectileCount;
  for (let i = 0; i < count; i++) {
    let spreadDir;
    if (count > 1) {
      // Random spread within 7.5° cone for buckshot
      const maxConeAngle = 7.5 * Math.PI / 180;  // 7.5 degrees in radians
      const randomAngle = (Math.random() - 0.5) * 2 * maxConeAngle;
      const randomPitch = (Math.random() - 0.5) * 2 * maxConeAngle;

      spreadDir = direction.clone();
      // Apply random yaw
      spreadDir.applyAxisAngle(new THREE.Vector3(0, 1, 0), randomAngle);
      // Apply random pitch
      const rightAxis = new THREE.Vector3(1, 0, 0).applyQuaternion(quat);
      spreadDir.applyAxisAngle(rightAxis, randomPitch);
      spreadDir.normalize();
    } else {
      spreadDir = direction.clone();
    }
    spawnProjectile(origin, spreadDir, index, stats);
  }

  console.log(`[shoot] ${hand} hand fired ${count} projectile(s)`);
}

function updateLightningBeam(controller, index, stats, dt) {
  const origin = new THREE.Vector3();
  const quat   = new THREE.Quaternion();
  controller.getWorldPosition(origin);
  controller.getWorldQuaternion(quat);
  const direction = new THREE.Vector3(0, 0, -1).applyQuaternion(quat);

  // Find all enemies within range and chain to them
  const enemies = getEnemies();
  const targets = [];
  const maxChains = 2 + Math.floor(stats.lightningRange / 8);  // More chains with upgrades

  enemies.forEach((e, i) => {
    const dist = e.mesh.position.distanceTo(origin);
    const toEnemy = e.mesh.position.clone().sub(origin).normalize();
    const angle = toEnemy.dot(direction);

    // Within range and roughly in front (45° cone)
    if (dist < stats.lightningRange && angle > 0.7) {
      targets.push({ index: i, enemy: e, dist });
    }
  });

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

    // Apply damage every 0.2s to all chained targets (250% faster than 0.5s)
    lightningTimers[index] += dt;
    if (lightningTimers[index] >= 0.2) {
      lightningTimers[index] = 0;

      chainTargets.forEach(({ index: enemyIndex, enemy }) => {
        const result = hitEnemy(enemyIndex, stats.lightningDamage);
        spawnDamageNumber(enemy.mesh.position, stats.lightningDamage, '#ffff44');
        playHitSound();

        if (result.killed) {
          playExplosionSound();
          const destroyData = destroyEnemy(enemyIndex);
          if (destroyData) {
            game.kills++;
            game.totalKills++;
            game.killsWithoutHit++;
            addScore(destroyData.scoreValue);

            // Check level complete
            const cfg = game._levelConfig;
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

// Create zigzag lightning bolt between two points
function createLightningBolt(start, end) {
  const points = [start.clone()];
  const segments = 8;
  const zigzagAmount = 0.15;

  for (let i = 1; i < segments; i++) {
    const t = i / segments;
    const mid = new THREE.Vector3().lerpVectors(start, end, t);

    // Random perpendicular offset
    const dir = new THREE.Vector3().subVectors(end, start).normalize();
    const perp = new THREE.Vector3(-dir.z, 0, dir.x).normalize();
    const offset = perp.multiplyScalar((Math.random() - 0.5) * zigzagAmount);

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

function spawnProjectile(origin, direction, controllerIndex, stats) {
  const color = controllerIndex === 0 ? NEON_CYAN : NEON_PINK;
  const isBuckshot = stats.spreadAngle > 0;

  // Star Wars style laser bolt (thin cylinder) or pellet
  let mesh;
  if (isBuckshot) {
    // Pellet: small sphere
    mesh = new THREE.Mesh(
      new THREE.SphereGeometry(0.025, 6, 6),
      new THREE.MeshBasicMaterial({ color: 0xdddddd })
    );
  } else {
    // Laser bolt: elongated cylinder (3-4 feet ~ 1 meter)
    const group = new THREE.Group();
    const boltLength = 1.0;
    const boltGeo = new THREE.CylinderGeometry(0.015, 0.015, boltLength, 6);
    const bolt = new THREE.Mesh(boltGeo, new THREE.MeshBasicMaterial({ color }));
    bolt.rotation.x = Math.PI / 2; // align with forward direction
    bolt.position.z = -boltLength / 2;
    group.add(bolt);

    // Glow cylinder
    const glowGeo = new THREE.CylinderGeometry(0.035, 0.035, boltLength, 6);
    const glowBolt = new THREE.Mesh(glowGeo, new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.2 }));
    glowBolt.rotation.x = Math.PI / 2;
    glowBolt.position.z = -boltLength / 2;
    group.add(glowBolt);

    mesh = group;
  }

  mesh.position.copy(origin);
  mesh.userData.velocity = direction.clone().multiplyScalar(isBuckshot ? 20 : 40);
  mesh.userData.stats = stats;
  mesh.userData.controllerIndex = controllerIndex;
  mesh.userData.lifetime = 3000;
  mesh.userData.createdAt = performance.now();
  mesh.userData.hitEnemies = new Set();

  // Orient bolt along direction
  if (!isBuckshot) {
    mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, -1), direction);
  }

  scene.add(mesh);
  projectiles.push(mesh);
  playShoothSound();
}

function handleHit(enemyIndex, enemy, stats, hitPoint, controllerIndex) {
  // Calculate damage
  let damage = stats.damage;

  // Critical hit
  if (stats.critChance > 0 && Math.random() < stats.critChance) {
    damage *= 2;
  }

  // Fire debuff increases damage taken
  if (enemy.statusEffects.fire.stacks > 0) {
    damage *= stats.fireWeakenMult;
  }

  // Apply damage
  const result = hitEnemy(enemyIndex, damage);

  // Track damage for hand stats
  if (controllerIndex !== undefined) {
    const hand = controllerIndex === 0 ? 'left' : 'right';
    game.handStats[hand].totalDamage += damage;
  }

  // Spawn damage number
  spawnDamageNumber(hitPoint, damage, '#ffffff');
  playHitSound();

  // Apply status effects
  if (stats.effects.length > 0) {
    applyEffects(enemyIndex, stats.effects);
  }

  // AOE explosion
  if (stats.aoeRadius > 0) {
    handleAOE(hitPoint, stats.aoeRadius, stats.damage * 0.6, controllerIndex);
  }

  // If killed
  if (result.killed) {
    playExplosionSound();
    const destroyData = destroyEnemy(enemyIndex);
    if (destroyData) {
      game.kills++;
      game.totalKills++;
      game.killsWithoutHit++;
      addScore(destroyData.scoreValue);

      // Track kills for hand stats
      if (controllerIndex !== undefined) {
        const hand = controllerIndex === 0 ? 'left' : 'right';
        game.handStats[hand].kills++;
      }

      // Vampiric healing
      if (stats.vampiricInterval > 0 && game.totalKills % stats.vampiricInterval === 0) {
        game.health = Math.min(game.maxHealth, game.health + 1);
        console.log('[vampiric] Healed 1 HP');
      }

      // Check level complete
      const cfg = game._levelConfig;
      if (cfg && game.kills >= cfg.killTarget) {
        completeLevel();
      }
    }
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
        const hand = controllerIndex === 0 ? 'left' : 'right';
        game.handStats[hand].totalDamage += aoeDamage;
      }
    }
  });
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

function updateProjectiles(dt) {
  const now = performance.now();
  const raycaster = new THREE.Raycaster();
  const enemies = getEnemyMeshes();

  for (let i = projectiles.length - 1; i >= 0; i--) {
    const proj = projectiles[i];
    const age = now - proj.userData.createdAt;

    // Remove expired projectiles
    if (age > proj.userData.lifetime) {
      scene.remove(proj);
      projectiles.splice(i, 1);
      continue;
    }

    // Move projectile
    const moveDistance = proj.userData.velocity.length() * dt;
    proj.position.addScaledVector(proj.userData.velocity, dt);

    // Check collision with enemies
    raycaster.set(proj.position, proj.userData.velocity.clone().normalize());
    const hits = raycaster.intersectObjects(enemies, true);

    if (hits.length > 0 && hits[0].distance < moveDistance * 2) {
      const result = getEnemyByMesh(hits[0].object);
      if (result && !proj.userData.hitEnemies.has(result.index)) {
        proj.userData.hitEnemies.add(result.index);
        handleHit(result.index, result.enemy, proj.userData.stats, hits[0].point, proj.userData.controllerIndex);

        // Ricochet effect
        if (proj.userData.stats.ricochetBounces > 0) {
          handleRicochet(hits[0].point, proj.userData.stats, 0, proj.userData.controllerIndex);
        }

        // Remove projectile if not piercing
        if (!proj.userData.stats.piercing) {
          scene.remove(proj);
          projectiles.splice(i, 1);
        }
      }
    }
  }
}

function selectUpgrade(controller) {
  if (upgradeSelectionCooldown > 0) return;

  const origin = new THREE.Vector3();
  const quat   = new THREE.Quaternion();
  controller.getWorldPosition(origin);
  controller.getWorldQuaternion(quat);
  const direction = new THREE.Vector3(0, 0, -1).applyQuaternion(quat);

  const raycaster = new THREE.Raycaster(origin, direction, 0, 10);
  const result = getUpgradeCardHit(raycaster);

  if (result) {
    selectUpgradeAndAdvance(result.upgrade, result.hand);
  }
}

// ============================================================
//  ENEMY SPAWNING
// ============================================================
function spawnEnemyWave(dt) {
  if (game.state !== State.PLAYING) return;

  const cfg = game._levelConfig;
  if (!cfg) return;

  game.spawnTimer -= dt;
  if (game.spawnTimer <= 0) {
    game.spawnTimer = cfg.spawnInterval;

    // Don't spawn if we already have enough enemies
    if (getEnemyCount() < 15) {
      const types = cfg.enemyTypes;
      const type = types[Math.floor(Math.random() * types.length)];

      // Calculate vertical spawn angle based on level
      let verticalAngle = 0;
      if (game.level >= 16) verticalAngle = 60;
      else if (game.level >= 11) verticalAngle = 40;
      else if (game.level >= 6) verticalAngle = 20;

      const pos = getSpawnPosition(cfg.airSpawns, verticalAngle);
      spawnEnemy(type, pos, cfg);

      // Alert on fast/swarm enemy spawn
      if (type === 'fast') {
        playFastEnemySpawn();
      } else if (type === 'swarm') {
        playSwarmEnemySpawn();
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
//  RENDER / UPDATE LOOP
// ============================================================
function render(timestamp) {
  const now = timestamp || performance.now();
  const rawDt  = Math.min((now - lastTime) / 1000, 0.1);
  lastTime  = now;

  // Apply bullet-time slow-mo (use raw dt for countdown)
  if (slowMoActive) {
    slowMoDuration -= rawDt;
    if (slowMoDuration <= 0) {
      slowMoActive = false;
      slowMoSoundPlayed = false;  // Reset sound flag for next activation
      timeScale = 1.0;
      console.log('[bullet-time] ENDED');
    } else {
      timeScale = 0.2;  // Slower time scale (was 0.25)
    }
  } else {
    timeScale = 1.0;
  }

  const dt = rawDt * timeScale;  // Scaled time for game logic

  const st = game.state;

  // ── Title screen ──
  if (st === State.TITLE) {
    updateTitle(now);
  }

  // ── Playing ──
  else if (st === State.PLAYING) {
    spawnEnemyWave(dt);

    // Full-auto shooting / Lightning beams
    for (let i = 0; i < 2; i++) {
      if (controllerTriggerPressed[i]) {
        const hand = i === 0 ? 'left' : 'right';
        const stats = getWeaponStats(game.upgrades[hand]);

        if (stats.lightning) {
          updateLightningBeam(controllers[i], i, stats, dt);
        } else {
          shootWeapon(controllers[i], i);
        }
      } else {
        // Trigger released - clear lightning beam
        if (lightningBeams[i]) {
          scene.remove(lightningBeams[i]);
          lightningBeams[i] = null;
        }
      }
    }

    // Fast enemy proximity alerts
    updateFastEnemyAlerts(dt, camera.position);

    // Update enemies
    const playerPos = camera.position.clone();

    // Check for near-miss bullet-time trigger
    if (!slowMoActive) {
      const enemies = getEnemies();
      for (const e of enemies) {
        const dist = e.mesh.position.distanceTo(playerPos);
        if (dist < 2.0) {  // Enemy within 2m triggers slow-mo (increased from 0.5m)
          slowMoActive = true;
          slowMoDuration = 2.5;  // 2.5 seconds of slow-mo (increased from 1.5s)
          console.log('[bullet-time] ACTIVATED!');
          break;
        }
      }
      // Play sound once per activation (outside loop)
      if (slowMoActive && !slowMoSoundPlayed) {
        playSlowMoSound();
        slowMoSoundPlayed = true;
      }
    }

    const collisions = updateEnemies(dt, now, playerPos);

    // Handle enemy collisions with player
    collisions.forEach(index => {
      destroyEnemy(index);
      const dead = damagePlayer(1);
      triggerHitFlash();
      playDamageSound();

      // Trigger camera shake
      cameraShake = 0.5;  // 0.5 second shake duration
      cameraShakeIntensity = 0.05;  // shake magnitude
      originalCameraPos.copy(camera.position);

      slowMoActive = false;  // End slow-mo on hit
      timeScale = 1.0;
      console.log(`[damage] Player hit! Health: ${game.health}`);
      if (dead) {
        endGame(false);
      }
    });

    // Check for DoT damage on enemies
    const enemies = getEnemies();
    enemies.forEach((e, i) => {
      if (e._lastDoT) {
        const colorMap = { fire: '#ff4400', shock: '#4488ff', freeze: '#88ccff' };
        spawnDamageNumber(e.mesh.position, e._lastDoT.damage, colorMap[e._lastDoT.type] || '#ffffff');
        delete e._lastDoT;

        if (e.hp <= 0) {
          const destroyData = destroyEnemy(i);
          if (destroyData) {
            game.kills++;
            game.totalKills++;
            game.killsWithoutHit++;
            addScore(destroyData.scoreValue);

            const cfg = game._levelConfig;
            if (cfg && game.kills >= cfg.killTarget) {
              completeLevel();
            }
          }
        }
      }
    });

    // Update HUD
    game._levelConfig = getLevelConfig();
    game._combo = getComboMultiplier();
    updateHUD(game);
  }

  // ── Level complete (cooldown before upgrade screen) ──
  else if (st === State.LEVEL_COMPLETE) {
    game.stateTimer -= dt;
    if (game.stateTimer <= 0) {
      showUpgradeScreen();
    }
  }

  // ── Upgrade selection ──
  else if (st === State.UPGRADE_SELECT) {
    upgradeSelectionCooldown = Math.max(0, upgradeSelectionCooldown - dt);
    updateUpgradeCards(now, upgradeSelectionCooldown);

    // Show and update blaster displays
    blasterDisplays.forEach((display, i) => {
      if (display) {
        display.visible = true;
        if (display.userData.needsUpdate) {
          updateBlasterDisplay(display, i);
        }
      }
    });
  }

  // ── Game over / Victory ──
  else if (st === State.GAME_OVER || st === State.VICTORY) {
    updateEndScreen(now);
    gameOverCooldown = Math.max(0, gameOverCooldown - dt);
  }

  // ── Camera shake on damage ──
  if (cameraShake > 0) {
    cameraShake -= rawDt;
    if (cameraShake <= 0) {
      cameraShake = 0;
    } else {
      // Apply random shake offset
      const shake = cameraShakeIntensity * (cameraShake / 0.5);  // Fade out over duration
      camera.position.x += (Math.random() - 0.5) * shake;
      camera.position.y += (Math.random() - 0.5) * shake;
      camera.position.z += (Math.random() - 0.5) * shake;
    }
  }

  // ── Universal updates ──
  updateProjectiles(dt);
  updateExplosions(dt, now);
  updateDamageNumbers(dt, now);
  updateHitFlash(rawDt);  // Use rawDt so flash works during bullet-time
  updateFPS(now);  // Update FPS counter

  // Music visualizer (DISABLED - causing FPS drops)
  // if (now % 3 < 1) {
  //   updateMountainVisualizer();
  // }

  renderer.render(scene, camera);
}

// ============================================================
//  MUSIC VISUALIZER
// ============================================================
function updateMountainVisualizer() {
  const freqData = getMusicFrequencyData();
  if (!freqData || mountainLines.length === 0) return;

  mountainLines.forEach((layer, layerIndex) => {
    const peaks = mountainBasePeaks[layerIndex];
    if (!peaks) return;

    const points = [new THREE.Vector3(-100, 0, layer.z)];

    peaks.forEach((peak, i) => {
      // Map frequency bins to peaks (spread across spectrum)
      const binIndex = Math.floor((i / peaks.length) * freqData.length);
      const amplitude = freqData[binIndex] / 255;  // Normalize 0-1

      // Subtle height modulation (max 2 units up/down)
      const heightMod = amplitude * 2 * (layerIndex === 0 ? 0.8 : 1.2);
      const newY = peak.baseY + heightMod;

      points.push(new THREE.Vector3(peak.x, newY, layer.z));
    });

    points.push(new THREE.Vector3(100, 0, layer.z));

    // Update line geometry
    layer.geometry.setFromPoints(points);
    layer.geometry.attributes.position.needsUpdate = true;
  });
}


// ============================================================
//  WINDOW RESIZE
// ============================================================
function onWindowResize() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
}
