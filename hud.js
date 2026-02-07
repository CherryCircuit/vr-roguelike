// ============================================================
//  HUD, TITLE SCREEN, MENUS, DAMAGE NUMBERS
//  All in-VR UI elements rendered as 3D objects.
// ============================================================

import * as THREE from 'three';
import { State } from './game.js';

// ── Module state ───────────────────────────────────────────
let sceneRef, cameraRef;

// Groups for different UI states
const titleGroup     = new THREE.Group();
const hudGroup       = new THREE.Group();
const levelTextGroup = new THREE.Group();
const upgradeGroup   = new THREE.Group();
const gameOverGroup  = new THREE.Group();

// HUD element references
let heartsSprite     = null;
let killCountSprite  = null;
let levelSprite      = null;
let scoreSprite      = null;
let comboSprite      = null;

// Damage numbers
const damageNumbers  = [];

// Upgrade card meshes (for raycasting)
let upgradeCards     = [];
let upgradeChoices   = [];

// Hit flash (red sphere inside camera)
let hitFlash         = null;
let hitFlashOpacity  = 0;

// Title blink
let titleBlinkSprite = null;

// ── Canvas text utility ────────────────────────────────────
function makeTextTexture(text, opts = {}) {
  const canvas = document.createElement('canvas');
  const ctx    = canvas.getContext('2d');
  const fontSize = opts.fontSize || 64;
  const font     = `bold ${fontSize}px "Courier New", monospace`;

  // Measure text to size canvas
  ctx.font = font;
  const metrics = ctx.measureText(text);
  canvas.width  = Math.ceil(metrics.width) + 40;
  canvas.height = Math.ceil(fontSize * 1.5);

  // Re-set after resize
  ctx.font      = font;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  // Optional glow
  if (opts.glow) {
    ctx.shadowColor = opts.glowColor || opts.color || '#00ffff';
    ctx.shadowBlur  = opts.glowSize || 15;
  }

  // Drop shadow
  if (opts.shadow) {
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.fillText(text, canvas.width / 2 + 2, canvas.height / 2 + 2);
  }

  // Main text
  ctx.fillStyle = opts.color || '#00ffff';
  ctx.fillText(text, canvas.width / 2, canvas.height / 2);

  const texture = new THREE.CanvasTexture(canvas);
  texture.minFilter = THREE.LinearFilter;
  return { texture, aspect: canvas.width / canvas.height };
}

function makeSprite(text, opts = {}) {
  const { texture, aspect } = makeTextTexture(text, opts);
  const mat = new THREE.SpriteMaterial({
    map: texture,
    transparent: true,
    opacity: opts.opacity ?? 1,
    depthTest: opts.depthTest ?? false,
    depthWrite: false,
  });
  const sprite  = new THREE.Sprite(mat);
  const scale   = opts.scale || 0.3;
  sprite.scale.set(aspect * scale, scale, 1);
  sprite.renderOrder = opts.renderOrder ?? 999;
  return sprite;
}

// ── Pixel heart drawing ────────────────────────────────────
const HEART_PIXELS = [
  [0,1,1,0,1,1,0],
  [1,1,1,1,1,1,1],
  [1,1,1,1,1,1,1],
  [0,1,1,1,1,1,0],
  [0,0,1,1,1,0,0],
  [0,0,0,1,0,0,0],
];

function drawHeart(ctx, x, y, pixSize, state) {
  // state: 'full', 'half', 'empty'
  HEART_PIXELS.forEach((row, py) => {
    row.forEach((px_on, px) => {
      if (!px_on) return;
      if (state === 'empty') {
        ctx.fillStyle = '#331133';
      } else if (state === 'half' && px >= 4) {
        ctx.fillStyle = '#331133';
      } else {
        ctx.fillStyle = '#ff0044';
      }
      ctx.fillRect(x + px * pixSize, y + py * pixSize, pixSize, pixSize);
    });
  });
}

function makeHeartsTexture(health, maxHealth) {
  const heartCount = maxHealth / 2;
  const pixSize    = 8;
  const heartW     = 7 * pixSize;
  const heartH     = 6 * pixSize;
  const gap        = 6;
  const canvas     = document.createElement('canvas');
  canvas.width     = heartCount * (heartW + gap) + gap;
  canvas.height    = heartH + 10;
  const ctx        = canvas.getContext('2d');

  for (let i = 0; i < heartCount; i++) {
    const hpForThisHeart = health - i * 2;
    let state;
    if (hpForThisHeart >= 2) state = 'full';
    else if (hpForThisHeart === 1) state = 'half';
    else state = 'empty';

    drawHeart(ctx, gap + i * (heartW + gap), 5, pixSize, state);
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.minFilter = THREE.LinearFilter;
  return { texture, aspect: canvas.width / canvas.height };
}

// ── Public API ─────────────────────────────────────────────

export function initHUD(camera, scene) {
  sceneRef  = scene;
  cameraRef = camera;

  // ── Title Screen (world-space, fixed position) ──
  createTitleScreen();
  titleGroup.position.set(0, 1.6, -6);
  scene.add(titleGroup);

  // ── VR HUD (attached to camera but only follows Y rotation) ──
  createHUDElements();
  camera.add(hudGroup);
  scene.add(camera);

  // ── Level transition text (world-space) ──
  levelTextGroup.visible = false;
  scene.add(levelTextGroup);

  // ── Upgrade selection (world-space) ──
  upgradeGroup.visible = false;
  scene.add(upgradeGroup);

  // ── Game over / Victory (world-space) ──
  gameOverGroup.visible = false;
  scene.add(gameOverGroup);

  // ── Hit flash (red sphere around camera) ──
  hitFlash = new THREE.Mesh(
    new THREE.SphereGeometry(0.4, 16, 16),
    new THREE.MeshBasicMaterial({
      color: 0xff0000,
      transparent: true,
      opacity: 0,
      side: THREE.BackSide,
      depthWrite: false,
    }),
  );
  hitFlash.renderOrder = 1000;
  hitFlash.visible = false;
  camera.add(hitFlash);
}

// ── Title Screen ───────────────────────────────────────────

function createTitleScreen() {
  // Big title: SPACEOMICIDE
  const titleSprite = makeSprite('SPACEOMICIDE', {
    fontSize: 140,
    color: '#00ffff',
    glow: true, glowColor: '#0088ff', glowSize: 30,
    scale: 1.8,
  });
  titleSprite.position.set(0, 1.6, 0);
  titleGroup.add(titleSprite);

  // Subtitle
  const subSprite = makeSprite('VR ROGUELIKE BLASTER', {
    fontSize: 48,
    color: '#ff00ff',
    glow: true, glowColor: '#ff00ff', glowSize: 10,
    scale: 0.6,
  });
  subSprite.position.set(0, 0.8, 0);
  titleGroup.add(subSprite);

  // Blinking "Press Trigger to Begin"
  titleBlinkSprite = makeSprite('PRESS TRIGGER TO BEGIN', {
    fontSize: 52,
    color: '#ffffff',
    glow: true, glowColor: '#ffffff',
    scale: 0.5,
  });
  titleBlinkSprite.position.set(0, 0, 0);
  titleGroup.add(titleBlinkSprite);
}

export function showTitle() {
  titleGroup.visible = true;
  hudGroup.visible   = false;
}

export function hideTitle() {
  titleGroup.visible = false;
}

export function updateTitle(now) {
  if (titleBlinkSprite) {
    titleBlinkSprite.material.opacity = 0.5 + Math.sin(now * 0.004) * 0.5;
  }
}

// ── VR HUD (hearts, kill counter, level, score) ────────────

function createHUDElements() {
  hudGroup.visible   = false;
  hudGroup.renderOrder = 999;

  // Hearts — positioned bottom-left of view
  heartsSprite = new THREE.Sprite(new THREE.SpriteMaterial({ transparent: true, depthTest: false, depthWrite: false }));
  heartsSprite.position.set(-0.35, -0.28, -1.0);
  heartsSprite.scale.set(0.22, 0.05, 1);
  heartsSprite.renderOrder = 999;
  hudGroup.add(heartsSprite);

  // Kill counter — bottom-center
  killCountSprite = makeSprite('0/0', { fontSize: 40, color: '#ffffff', shadow: true, scale: 0.12 });
  killCountSprite.position.set(0, -0.28, -1.0);
  hudGroup.add(killCountSprite);

  // Level indicator — bottom-right
  levelSprite = makeSprite('LEVEL 1', { fontSize: 40, color: '#00ffff', glow: true, scale: 0.12 });
  levelSprite.position.set(0.35, -0.28, -1.0);
  hudGroup.add(levelSprite);

  // Score — top-left
  scoreSprite = makeSprite('0', { fontSize: 36, color: '#ffff00', shadow: true, scale: 0.1 });
  scoreSprite.position.set(-0.35, 0.32, -1.0);
  hudGroup.add(scoreSprite);

  // Combo multiplier — below score
  comboSprite = makeSprite('1x', { fontSize: 32, color: '#ff8800', shadow: true, scale: 0.08 });
  comboSprite.position.set(-0.35, 0.26, -1.0);
  comboSprite.visible = false;
  hudGroup.add(comboSprite);
}

export function showHUD() {
  hudGroup.visible = true;
}

export function hideHUD() {
  hudGroup.visible = false;
}

function updateSpriteText(sprite, text, opts = {}) {
  // Dispose old texture
  if (sprite.material.map) sprite.material.map.dispose();

  const { texture, aspect } = makeTextTexture(text, {
    fontSize: opts.fontSize || 40,
    color: opts.color || '#ffffff',
    shadow: true,
    glow: opts.glow,
    glowColor: opts.glowColor,
  });
  sprite.material.map = texture;
  sprite.material.needsUpdate = true;
  const scale = opts.scale || sprite.scale.y;
  sprite.scale.set(aspect * scale, scale, 1);
}

export function updateHUD(gameState) {
  if (!hudGroup.visible) return;

  // Hearts
  const { texture: ht, aspect: ha } = makeHeartsTexture(gameState.health, gameState.maxHealth);
  if (heartsSprite.material.map) heartsSprite.material.map.dispose();
  heartsSprite.material.map = ht;
  heartsSprite.material.needsUpdate = true;
  heartsSprite.scale.set(ha * 0.05, 0.05, 1);

  // Kill counter
  const cfg = gameState._levelConfig;
  if (cfg) {
    updateSpriteText(killCountSprite, `${gameState.kills} / ${cfg.killTarget}`, { color: '#ffffff', scale: 0.12 });
  }

  // Level
  updateSpriteText(levelSprite, `LEVEL ${gameState.level}`, { color: '#00ffff', glow: true, glowColor: '#00ffff', scale: 0.12 });

  // Score
  updateSpriteText(scoreSprite, `${gameState.score}`, { color: '#ffff00', scale: 0.1 });

  // Combo
  const combo = gameState._combo || 1;
  if (combo > 1) {
    comboSprite.visible = true;
    updateSpriteText(comboSprite, `${combo}x`, { color: '#ff8800', scale: 0.08 });
  } else {
    comboSprite.visible = false;
  }
}

// ── Level Complete / Transition Text ───────────────────────

export function showLevelComplete(level, playerPos) {
  // Clear old
  while (levelTextGroup.children.length) levelTextGroup.remove(levelTextGroup.children[0]);

  const s1 = makeSprite('LEVEL COMPLETE!', { fontSize: 80, color: '#00ffff', glow: true, glowSize: 20, scale: 1.0 });
  s1.position.set(0, 0.9, 0);
  levelTextGroup.add(s1);

  const s2 = makeSprite(`LEVEL ${level + 1}`, { fontSize: 60, color: '#ff00ff', glow: true, scale: 0.7 });
  s2.position.set(0, 0.2, 0);
  levelTextGroup.add(s2);

  // Position in front of player
  levelTextGroup.position.set(playerPos.x, playerPos.y, playerPos.z);
  levelTextGroup.position.z -= 5;
  levelTextGroup.visible = true;
}

export function hideLevelComplete() {
  levelTextGroup.visible = false;
}

// ── Upgrade Selection Cards ────────────────────────────────

export function showUpgradeCards(upgrades, playerPos, hand) {
  hideAll();
  upgradeGroup.visible = true;
  upgradeCards   = [];
  upgradeChoices = upgrades;
  upgradeGroup.userData.hand = hand;

  // Position in front of player
  upgradeGroup.position.set(playerPos.x, playerPos.y, playerPos.z);
  upgradeGroup.position.z -= 4;

  // "Choose an upgrade for [HAND]" header
  const handName = hand === 'left' ? 'LEFT HAND' : 'RIGHT HAND';
  const header = makeSprite(`CHOOSE UPGRADE: ${handName}`, { fontSize: 56, color: '#ffffff', glow: true, scale: 0.7 });
  header.position.set(0, 1.4, 0);
  upgradeGroup.add(header);

  // Cooldown text
  const cooldownSprite = makeSprite('WAIT...', { fontSize: 40, color: '#ffff00', scale: 0.4 });
  cooldownSprite.position.set(0, 0.8, 0);
  cooldownSprite.name = 'cooldown';
  upgradeGroup.add(cooldownSprite);

  // Three cards in an arc
  const positions = [
    new THREE.Vector3(-1.5, 0, 0),
    new THREE.Vector3(0,    0, 0),
    new THREE.Vector3(1.5,  0, 0),
  ];

  upgrades.forEach((upg, i) => {
    const card = createUpgradeCard(upg, positions[i]);
    upgradeGroup.add(card);
    upgradeCards.push(card);
  });
}

function createUpgradeCard(upgrade, position) {
  const group = new THREE.Group();
  group.position.copy(position);
  group.userData.upgradeId = upgrade.id;

  // Card background plane
  const cardGeo = new THREE.PlaneGeometry(0.9, 1.1);
  const cardMat = new THREE.MeshBasicMaterial({
    color: 0x110033,
    transparent: true,
    opacity: 0.85,
    side: THREE.DoubleSide,
  });
  const card = new THREE.Mesh(cardGeo, cardMat);
  card.userData.isUpgradeCard = true;
  card.userData.upgradeId     = upgrade.id;
  group.add(card);

  // Border
  const borderGeo = new THREE.EdgesGeometry(cardGeo);
  const borderMat = new THREE.LineBasicMaterial({ color: upgrade.color || '#00ffff' });
  group.add(new THREE.LineSegments(borderGeo, borderMat));

  // Name text
  const nameSprite = makeSprite(upgrade.name.toUpperCase(), {
    fontSize: 52,
    color: upgrade.color || '#00ffff',
    glow: true,
    glowColor: upgrade.color,
    scale: 0.25,
    depthTest: true,
  });
  nameSprite.position.set(0, 0.25, 0.01);
  group.add(nameSprite);

  // Description text
  const descSprite = makeSprite(upgrade.desc, {
    fontSize: 32,
    color: '#cccccc',
    scale: 0.18,
    depthTest: true,
  });
  descSprite.position.set(0, -0.1, 0.01);
  group.add(descSprite);

  // Simple colored sphere as icon
  const iconMesh = new THREE.Mesh(
    new THREE.OctahedronGeometry(0.12, 0),
    new THREE.MeshBasicMaterial({ color: upgrade.color || '#00ffff', wireframe: true }),
  );
  iconMesh.position.set(0, -0.35, 0.05);
  group.add(iconMesh);
  group.userData.iconMesh = iconMesh;

  return group;
}

export function hideUpgradeCards() {
  while (upgradeGroup.children.length) upgradeGroup.remove(upgradeGroup.children[0]);
  upgradeGroup.visible = false;
  upgradeCards = [];
  upgradeChoices = [];
}

export function updateUpgradeCards(now, cooldownRemaining) {
  // Animate card icons
  upgradeCards.forEach(card => {
    if (card.userData.iconMesh) {
      card.userData.iconMesh.rotation.y += 0.02;
      card.userData.iconMesh.rotation.x += 0.01;
    }
  });

  // Update cooldown text
  const cd = upgradeGroup.getObjectByName('cooldown');
  if (cd) {
    if (cooldownRemaining > 0) {
      cd.visible = true;
      // Update the cooldown sprite text
      if (cd.material && cd.material.map) cd.material.map.dispose();
      const { texture, aspect } = makeTextTexture(
        `WAIT ${Math.ceil(cooldownRemaining)}...`,
        { fontSize: 40, color: '#ffff00' }
      );
      cd.material.map = texture;
      cd.material.needsUpdate = true;
      cd.scale.set(aspect * 0.4, 0.4, 1);
    } else {
      cd.visible = false;
    }
  }
}

/**
 * Check if a raycaster hits an upgrade card.
 * Returns the upgrade definition or null.
 */
export function getUpgradeCardHit(raycaster) {
  const meshes = upgradeCards.map(g => g.children.find(c => c.userData.isUpgradeCard)).filter(Boolean);
  const hits = raycaster.intersectObjects(meshes, false);
  if (hits.length > 0) {
    const id = hits[0].object.userData.upgradeId;
    const upgrade = upgradeChoices.find(u => u.id === id) || null;
    if (upgrade) {
      return { upgrade, hand: upgradeGroup.userData.hand };
    }
  }
  return null;
}

// ── Game Over / Victory ────────────────────────────────────

export function showGameOver(score, playerPos) {
  hideAll();
  while (gameOverGroup.children.length) gameOverGroup.remove(gameOverGroup.children[0]);

  const s1 = makeSprite('GAME OVER', { fontSize: 120, color: '#ff0044', glow: true, glowSize: 30, scale: 1.4 });
  s1.position.set(0, 1.2, 0);
  gameOverGroup.add(s1);

  const s2 = makeSprite(`SCORE: ${score}`, { fontSize: 60, color: '#ffff00', glow: true, scale: 0.7 });
  s2.position.set(0, 0.4, 0);
  gameOverGroup.add(s2);

  const s3 = makeSprite('PRESS TRIGGER TO RESTART', { fontSize: 44, color: '#ffffff', scale: 0.5 });
  s3.position.set(0, -0.3, 0);
  s3.name = 'restartBlink';
  gameOverGroup.add(s3);

  gameOverGroup.position.set(playerPos.x, playerPos.y, playerPos.z);
  gameOverGroup.position.z -= 5;
  gameOverGroup.visible = true;
}

export function showVictory(score, playerPos) {
  hideAll();
  while (gameOverGroup.children.length) gameOverGroup.remove(gameOverGroup.children[0]);

  const s1 = makeSprite('VICTORY!', { fontSize: 120, color: '#ffff00', glow: true, glowSize: 30, scale: 1.5 });
  s1.position.set(0, 1.2, 0);
  gameOverGroup.add(s1);

  const s2 = makeSprite(`FINAL SCORE: ${score}`, { fontSize: 60, color: '#00ffff', glow: true, scale: 0.7 });
  s2.position.set(0, 0.4, 0);
  gameOverGroup.add(s2);

  const s3 = makeSprite('PRESS TRIGGER TO RETURN', { fontSize: 44, color: '#ffffff', scale: 0.5 });
  s3.position.set(0, -0.3, 0);
  s3.name = 'restartBlink';
  gameOverGroup.add(s3);

  gameOverGroup.position.set(playerPos.x, playerPos.y, playerPos.z);
  gameOverGroup.position.z -= 5;
  gameOverGroup.visible = true;
}

export function updateEndScreen(now) {
  const blink = gameOverGroup.getObjectByName('restartBlink');
  if (blink) {
    blink.material.opacity = 0.5 + Math.sin(now * 0.004) * 0.5;
  }
}

export function hideGameOver() {
  gameOverGroup.visible = false;
}

// ── Hit Flash ──────────────────────────────────────────────

export function triggerHitFlash() {
  hitFlashOpacity = 0.5;
}

export function updateHitFlash(dt) {
  if (hitFlashOpacity > 0) {
    hitFlash.visible = true;
    hitFlash.material.opacity = hitFlashOpacity;
    hitFlashOpacity -= dt * 2;
  } else {
    hitFlash.visible = false;
  }
}

// ── Damage Numbers ─────────────────────────────────────────

export function spawnDamageNumber(position, damage, color) {
  const canvas = document.createElement('canvas');
  const ctx    = canvas.getContext('2d');
  canvas.width = 128;
  canvas.height = 64;

  const fontSize = Math.min(48, 28 + damage / 6);
  ctx.font = `bold ${fontSize}px "Courier New", monospace`;
  ctx.textAlign    = 'center';
  ctx.textBaseline = 'middle';

  // Drop shadow
  ctx.fillStyle = 'rgba(0,0,0,0.7)';
  ctx.fillText(Math.round(damage).toString(), 66, 34);

  // Main text
  ctx.fillStyle = color || '#ffffff';
  ctx.fillText(Math.round(damage).toString(), 64, 32);

  const texture = new THREE.CanvasTexture(canvas);
  texture.minFilter = THREE.LinearFilter;

  const mat    = new THREE.SpriteMaterial({ map: texture, transparent: true, opacity: 0.9, depthTest: false, sizeAttenuation: false });
  const sprite = new THREE.Sprite(mat);

  sprite.position.copy(position);
  sprite.position.x += (Math.random() - 0.5) * 0.3;
  sprite.position.y += Math.random() * 0.2;
  sprite.position.z += (Math.random() - 0.5) * 0.3;

  // Fixed screen size regardless of distance
  const scale = 0.015 + Math.min(damage / 200, 0.015);
  sprite.scale.set(scale * 2, scale, 1);
  sprite.renderOrder = 998;

  sprite.userData.velocity = new THREE.Vector3(
    (Math.random() - 0.5) * 0.5,
    0.8 + Math.random() * 0.5,
    (Math.random() - 0.5) * 0.5,
  );
  sprite.userData.lifetime  = 1000;
  sprite.userData.createdAt = performance.now();

  sceneRef.add(sprite);
  damageNumbers.push(sprite);

  // Cap total to prevent perf issues
  while (damageNumbers.length > 20) {
    const old = damageNumbers.shift();
    sceneRef.remove(old);
    old.material.map.dispose();
    old.material.dispose();
  }
}

export function updateDamageNumbers(dt, now) {
  for (let i = damageNumbers.length - 1; i >= 0; i--) {
    const s   = damageNumbers[i];
    const age = now - s.userData.createdAt;

    if (age > s.userData.lifetime) {
      sceneRef.remove(s);
      s.material.map.dispose();
      s.material.dispose();
      damageNumbers.splice(i, 1);
    } else {
      s.position.addScaledVector(s.userData.velocity, dt);
      s.userData.velocity.y -= dt * 1.5;  // gravity
      s.material.opacity = 0.7 * (1 - age / s.userData.lifetime);
    }
  }
}

// ── Helpers ────────────────────────────────────────────────

function hideAll() {
  titleGroup.visible     = false;
  levelTextGroup.visible = false;
  upgradeGroup.visible   = false;
  gameOverGroup.visible  = false;
}
