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
let fpsSprite        = null;

// Damage numbers
const damageNumbers  = [];

// Upgrade card meshes (for raycasting)
let upgradeCards     = [];
let upgradeChoices   = [];

// Hit flash (red sphere inside camera)
let hitFlash         = null;
let hitFlashOpacity  = 0;

// Boss health bar (camera-attached, 3 segments for phases)
let bossHealthGroup  = null;
let bossHealthBars   = []; // 3 segments

// Title blink
let titleBlinkSprite = null;

// ── Canvas text utility ────────────────────────────────────
function makeTextTexture(text, opts = {}) {
  const canvas = document.createElement('canvas');
  const ctx    = canvas.getContext('2d');
  const fontSize = opts.fontSize || 64;
  const font     = `bold ${fontSize}px Arial, sans-serif`;
  const maxWidth = opts.maxWidth || null;

  ctx.font = font;

  // Word wrapping if maxWidth is specified
  let lines = [text];
  if (maxWidth) {
    lines = [];
    const words = text.split(' ');
    let currentLine = '';

    for (const word of words) {
      const testLine = currentLine ? `${currentLine} ${word}` : word;
      const metrics = ctx.measureText(testLine);

      if (metrics.width > maxWidth && currentLine) {
        lines.push(currentLine);
        currentLine = word;
      } else {
        currentLine = testLine;
      }
    }
    if (currentLine) lines.push(currentLine);
  }

  // Measure text to size canvas
  const textWidth  = maxWidth || Math.ceil(Math.max(...lines.map(l => ctx.measureText(l).width)));
  const lineHeight = fontSize * 1.3;
  const textHeight = lines.length * lineHeight;

  canvas.width  = Math.ceil(textWidth) + 40;
  canvas.height = Math.ceil(textHeight);

  // Re-set after resize
  ctx.font      = font;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  // Clear canvas with transparency (prevent black background)
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // Optional glow
  if (opts.glow) {
    ctx.shadowColor = opts.glowColor || opts.color || '#00ffff';
    ctx.shadowBlur  = opts.glowSize || 15;
  }

  // Drop shadow
  if (opts.shadow) {
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    lines.forEach((line, i) => {
      const y = (canvas.height / 2) - ((lines.length - 1) * lineHeight / 2) + (i * lineHeight);
      ctx.fillText(line, canvas.width / 2 + 2, y + 2);
    });
  }

  // Main text
  ctx.fillStyle = opts.color || '#00ffff';
  lines.forEach((line, i) => {
    const y = (canvas.height / 2) - ((lines.length - 1) * lineHeight / 2) + (i * lineHeight);
    ctx.fillText(line, canvas.width / 2, y);
  });

  const texture = new THREE.CanvasTexture(canvas);
  texture.minFilter = THREE.LinearFilter;
  return { texture, aspect: canvas.width / canvas.height };
}

function makeSprite(text, opts = {}) {
  const { texture, aspect } = makeTextTexture(text, opts);

  // Use PlaneGeometry instead of Sprite to prevent billboarding
  const scale = opts.scale || 0.3;
  const width = aspect * scale;
  const height = scale;

  const geometry = new THREE.PlaneGeometry(width, height);
  const mat = new THREE.MeshBasicMaterial({
    map: texture,
    transparent: true,
    opacity: opts.opacity ?? 1,
    depthTest: opts.depthTest ?? false,
    depthWrite: false,
    side: THREE.DoubleSide,
  });

  const mesh = new THREE.Mesh(geometry, mat);
  mesh.renderOrder = opts.renderOrder ?? 999;
  return mesh;
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
        // Don't draw empty hearts at all (transparent)
        return;
      } else if (state === 'half' && px >= 4) {
        // Don't draw right side of half hearts (gone, not faded)
        return;
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

  // ── VR HUD (stationary on floor, Space Pirate Trainer style) ──
  createHUDElements();
  hudGroup.position.set(0, 0.05, -3);  // On floor, 3 feet in front of spawn
  hudGroup.rotation.x = -Math.PI / 2;  // Rotate to face up (floor plane)
  scene.add(hudGroup);

  // ── Level transition text (world-space) ──
  levelTextGroup.visible = false;
  levelTextGroup.rotation.set(0, 0, 0);  // Lock rotation
  scene.add(levelTextGroup);

  // ── Upgrade selection (world-space) ──
  upgradeGroup.visible = false;
  upgradeGroup.rotation.set(0, 0, 0);  // Lock rotation
  scene.add(upgradeGroup);

  // ── Game over / Victory (world-space) ──
  gameOverGroup.visible = false;
  gameOverGroup.rotation.set(0, 0, 0);  // Lock rotation
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

  // ── FPS Counter (top right, attached to camera) ──
  fpsSprite = makeSprite('FPS: 0', { fontSize: 32, color: '#00ff00', shadow: true, scale: 0.15 });
  fpsSprite.position.set(0.4, 0.25, -0.5);  // Top right of view
  fpsSprite.renderOrder = 1001;
  // Discard transparent pixels so the plane doesn't render as a dark box in VR
  fpsSprite.material.alphaTest = 0.05;
  camera.add(fpsSprite);

  // ── Boss health bar (top center, camera-attached, 3 segments) ──
  bossHealthGroup = new THREE.Group();
  bossHealthGroup.position.set(0, 0.3, -0.6);
  bossHealthGroup.visible = false;
  const barWidth = 0.25;
  const barHeight = 0.03;
  const gap = 0.01;
  for (let i = 0; i < 3; i++) {
    const geo = new THREE.PlaneGeometry(barWidth, barHeight);
    const mat = new THREE.MeshBasicMaterial({ color: 0xff0044, side: THREE.DoubleSide, depthTest: false });
    const bar = new THREE.Mesh(geo, mat);
    bar.position.x = (i - 1) * (barWidth + gap);
    bar.renderOrder = 1000;
    bossHealthGroup.add(bar);
    bossHealthBars.push(bar);
  }
  camera.add(bossHealthGroup);
}

export function showBossHealthBar(hp, maxHp, phases = 3) {
  if (!bossHealthGroup) return;
  bossHealthGroup.visible = true;
  updateBossHealthBar(hp, maxHp, phases);
}

export function hideBossHealthBar() {
  if (bossHealthGroup) bossHealthGroup.visible = false;
}

export function updateBossHealthBar(hp, maxHp, phases = 3) {
  if (!bossHealthGroup || !bossHealthGroup.visible || phases < 1) return;
  const segmentHp = maxHp / phases;
  for (let i = 0; i < 3; i++) {
    const bar = bossHealthBars[i];
    if (!bar) continue;
    if (i >= phases) {
      bar.scale.x = 0;
      continue;
    }
    const segStart = i * segmentHp;
    const segEnd = (i + 1) * segmentHp;
    const segFill = Math.max(0, Math.min(1, (hp - segStart) / (segEnd - segStart)));
    bar.scale.x = segFill;
  }
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

  // Version number
  const now = new Date();
  const pst = new Date(now.toLocaleString('en-US', { timeZone: 'America/Los_Angeles' }));
  const dateStr = `${pst.getMonth()+1}/${pst.getDate()}/${pst.getFullYear()} ${pst.getHours()}:${String(pst.getMinutes()).padStart(2,'0')} PT`;
  const versionSprite = makeSprite(`ver. 0.023\n${dateStr}`, {
    fontSize: 32,
    color: '#888888',
    scale: 0.25,
  });
  versionSprite.position.set(0, -0.6, 0);
  titleGroup.add(versionSprite);
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

  // Floor-based HUD layout (Space Pirate Trainer style)
  // Increased by 200% (3x) for better visibility
  // Lives (hearts) - left side on floor
  // Use PlaneGeometry (not Sprite) to prevent billboarding/rotation
  const heartsGeo = new THREE.PlaneGeometry(1.2, 0.24);
  const heartsMat = new THREE.MeshBasicMaterial({ transparent: true, depthTest: true, depthWrite: false, side: THREE.DoubleSide });
  heartsSprite = new THREE.Mesh(heartsGeo, heartsMat);
  heartsSprite.position.set(-1.5, 0, 0);  // Spread out horizontally
  heartsSprite.renderOrder = 999;
  hudGroup.add(heartsSprite);

  // Score - right side on floor
  scoreSprite = makeSprite('0', { fontSize: 60, color: '#ffff00', shadow: true, scale: 2.4 });  // 0.8 * 3
  scoreSprite.position.set(1.5, 0, 0);
  hudGroup.add(scoreSprite);

  // Kill counter — center on floor
  killCountSprite = makeSprite('0/0', { fontSize: 50, color: '#ffffff', shadow: true, scale: 2.1 });  // 0.7 * 3
  killCountSprite.position.set(0, 0, 0);
  hudGroup.add(killCountSprite);

  // Level indicator — above kill counter
  levelSprite = makeSprite('LEVEL 1', { fontSize: 48, color: '#00ffff', glow: true, scale: 1.95 });  // 0.65 * 3
  levelSprite.position.set(0, 0.45, 0);  // Moved up proportionally
  hudGroup.add(levelSprite);

  // Combo multiplier — near score
  comboSprite = makeSprite('1x', { fontSize: 40, color: '#ff8800', shadow: true, scale: 1.8 });  // 0.6 * 3
  comboSprite.position.set(1.5, -0.45, 0);  // Moved down proportionally
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

  // Update geometry to match aspect ratio (prevents stretching)
  const scale = opts.scale || 0.3;
  sprite.geometry.dispose();
  sprite.geometry = new THREE.PlaneGeometry(aspect * scale, scale);
}

export function updateHUD(gameState) {
  if (!hudGroup.visible) return;

  // Hearts - proper aspect ratio with correct scale
  const { texture: ht, aspect: ha } = makeHeartsTexture(gameState.health, gameState.maxHealth);
  if (heartsSprite.material.map) heartsSprite.material.map.dispose();
  heartsSprite.material.map = ht;
  heartsSprite.material.needsUpdate = true;
  // Update geometry to match aspect ratio (200% larger: height 0.48)
  heartsSprite.geometry.dispose();
  heartsSprite.geometry = new THREE.PlaneGeometry(ha * 0.48, 0.48);

  // Kill counter - 200% larger
  const cfg = gameState._levelConfig;
  if (cfg) {
    updateSpriteText(killCountSprite, `${gameState.kills} / ${cfg.killTarget}`, { color: '#ffffff', scale: 0.30 });
  }

  // Level - 200% larger
  updateSpriteText(levelSprite, `LEVEL ${gameState.level}`, { color: '#00ffff', glow: true, glowColor: '#00ffff', scale: 0.30 });

  // Score - 200% larger
  updateSpriteText(scoreSprite, `${gameState.score}`, { color: '#ffff00', scale: 0.26 });

  // Combo - 200% larger
  const combo = gameState._combo || 1;
  if (combo > 1) {
    comboSprite.visible = true;
    updateSpriteText(comboSprite, `${combo}x`, { color: '#ff8800', scale: 0.22 });
  } else {
    comboSprite.visible = false;
  }
}

// ── Level Complete / Transition Text ───────────────────────

export function showLevelComplete(level, playerPos) {
  // Clear old
  while (levelTextGroup.children.length) levelTextGroup.remove(levelTextGroup.children[0]);

  // Reduced by 25% (scale 1.0 → 0.75, 0.7 → 0.525)
  const s1 = makeSprite('LEVEL COMPLETE!', { fontSize: 80, color: '#00ffff', glow: true, glowSize: 20, scale: 0.75 });
  s1.position.set(0, 0.9, 0);
  levelTextGroup.add(s1);

  const s2 = makeSprite(`LEVEL ${level + 1}`, { fontSize: 60, color: '#ff00ff', glow: true, scale: 0.525 });
  s2.position.set(0, 0.2, 0);
  levelTextGroup.add(s2);

  // Fixed world position in front of spawn
  levelTextGroup.position.set(0, 1.6, -5);
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

  // Fixed world position in front of spawn
  upgradeGroup.position.set(0, 1.6, -4);

  // "Choose an upgrade for [HAND]" header - reduced size significantly
  const handName = hand === 'left' ? 'LEFT HAND' : 'RIGHT HAND';
  const header = makeSprite(`CHOOSE UPGRADE: ${handName}`, { fontSize: 48, color: '#ffffff', glow: true, scale: 0.4 });
  header.position.set(0, 1.4, 0);
  upgradeGroup.add(header);

  // Cooldown text
  const cooldownSprite = makeSprite('WAIT...', { fontSize: 36, color: '#ffff00', scale: 0.3 });
  cooldownSprite.position.set(0, 0.8, 0);
  cooldownSprite.name = 'cooldown';
  upgradeGroup.add(cooldownSprite);

  // Four cards in an arc (3 upgrades + 1 skip option)
  const positions = [
    new THREE.Vector3(-2, 0, 0),
    new THREE.Vector3(-0.7, 0, 0),
    new THREE.Vector3(0.7, 0, 0),
    new THREE.Vector3(2, 0, 0),
  ];

  upgrades.forEach((upg, i) => {
    const card = createUpgradeCard(upg, positions[i]);
    upgradeGroup.add(card);
    upgradeCards.push(card);
  });

  // Add SKIP card as 4th option
  const skipCard = createSkipCard(positions[3]);
  upgradeGroup.add(skipCard);
  upgradeCards.push(skipCard);
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

  // Border (gold for side-grade / shot-type cards)
  const borderColor = upgrade.sideGrade ? 0xffdd00 : (typeof upgrade.color === 'string' ? parseInt(upgrade.color.replace('#', ''), 16) : (upgrade.color || 0x00ffff));
  const borderGeo = new THREE.EdgesGeometry(cardGeo);
  const borderMat = new THREE.LineBasicMaterial({ color: borderColor });
  group.add(new THREE.LineSegments(borderGeo, borderMat));

  // Name text - smaller to prevent overlap
  const nameSprite = makeSprite(upgrade.name.toUpperCase(), {
    fontSize: 28,
    color: upgrade.color || '#00ffff',
    glow: true,
    glowColor: upgrade.color,
    scale: 0.19,
    depthTest: true,
  });
  nameSprite.position.set(0, 0.35, 0.01);
  group.add(nameSprite);

  // Description text - standard size with padding (well inside box)
  const descSprite = makeSprite(upgrade.desc, {
    fontSize: 20,
    color: '#cccccc',
    scale: 0.15,
    depthTest: true,
    maxWidth: 180,
  });
  descSprite.position.set(0, -0.05, 0.01);
  group.add(descSprite);

  // Side-grade note (different color) when present
  if (upgrade.sideGradeNote) {
    const noteSprite = makeSprite(upgrade.sideGradeNote, {
      fontSize: 16,
      color: '#ffdd00',
      scale: 0.12,
      depthTest: true,
      maxWidth: 200,
    });
    noteSprite.position.set(0, -0.22, 0.01);
    group.add(noteSprite);
  }

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

function createSkipCard(position) {
  const group = new THREE.Group();
  group.position.copy(position);
  group.userData.upgradeId = 'SKIP';  // Special ID for skip

  // Smaller card (0.7×0.9 vs 0.9×1.1 for upgrades)
  const cardGeo = new THREE.PlaneGeometry(0.7, 0.9);
  const cardMat = new THREE.MeshBasicMaterial({
    color: 0x220044,
    transparent: true,
    opacity: 0.7,
    side: THREE.DoubleSide,
  });
  const card = new THREE.Mesh(cardGeo, cardMat);
  card.userData.isUpgradeCard = true;
  card.userData.upgradeId = 'SKIP';
  group.add(card);

  // Border
  const borderGeo = new THREE.EdgesGeometry(cardGeo);
  const borderMat = new THREE.LineBasicMaterial({ color: '#00ff88' });
  group.add(new THREE.LineSegments(borderGeo, borderMat));

  // "SKIP" text
  const nameSprite = makeSprite('SKIP', {
    fontSize: 28,
    color: '#00ff88',
    glow: true,
    glowColor: '#00ff88',
    scale: 0.2,
    depthTest: true,
  });
  nameSprite.position.set(0, 0.25, 0.01);
  group.add(nameSprite);

  // Description
  const descSprite = makeSprite('Full health', {
    fontSize: 18,
    color: '#88ffaa',
    scale: 0.12,
    depthTest: true,
    maxWidth: 120,
  });
  descSprite.position.set(0, -0.02, 0.01);
  group.add(descSprite);

  // Heart icon
  const iconMesh = new THREE.Mesh(
    new THREE.OctahedronGeometry(0.08, 0),
    new THREE.MeshBasicMaterial({ color: '#ff0044', wireframe: true }),
  );
  iconMesh.position.set(0, -0.25, 0.05);
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

    // Handle SKIP card
    if (id === 'SKIP') {
      return { upgrade: { id: 'SKIP', name: 'Skip' }, hand: upgradeGroup.userData.hand };
    }

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

  // Fixed world position in front of spawn
  gameOverGroup.position.set(0, 1.6, -5);
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

  // Fixed world position in front of spawn
  gameOverGroup.position.set(0, 1.6, -5);
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
  ctx.font = `bold ${fontSize}px Arial, sans-serif`;
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

  // Use PlaneGeometry instead of Sprite to prevent billboarding
  // Increased scale significantly for better visibility
  const scale = 0.25 + Math.min(damage / 100, 0.15);  // Much larger base scale
  const width = scale * 2;
  const height = scale;

  const geometry = new THREE.PlaneGeometry(width, height);
  const mat = new THREE.MeshBasicMaterial({
    map: texture,
    transparent: true,
    opacity: 0.9,
    depthTest: false,
    side: THREE.DoubleSide,
  });

  const mesh = new THREE.Mesh(geometry, mat);
  mesh.position.copy(position);
  mesh.position.x += (Math.random() - 0.5) * 0.3;
  mesh.position.y += Math.random() * 0.2;
  mesh.position.z += (Math.random() - 0.5) * 0.3;

  mesh.renderOrder = 998;

  mesh.userData.velocity = new THREE.Vector3(
    (Math.random() - 0.5) * 0.5,
    0.8 + Math.random() * 0.5,
    (Math.random() - 0.5) * 0.5,
  );
  mesh.userData.lifetime  = 500;  // Reduced from 1000ms for performance
  mesh.userData.createdAt = performance.now();

  sceneRef.add(mesh);
  damageNumbers.push(mesh);

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
      // No fade - keep full opacity for performance
    }
  }
}

// ── FPS Counter & Performance Monitor ───────────────────────
let fpsFrames = [];
let fpsFrameTimes = [];
let lastFpsUpdate = 0;

export function updateFPS(now, opts = {}) {
  if (!fpsSprite) return;

  const perfMonitor = opts.perfMonitor || (typeof window !== 'undefined' && window.debugPerfMonitor);
  const frameTimeMs = opts.frameTimeMs;

  // Track frame times
  fpsFrames.push(now);
  if (frameTimeMs != null) fpsFrameTimes.push(frameTimeMs);
  while (fpsFrameTimes.length > fpsFrames.length) fpsFrameTimes.shift();

  // Keep only last second
  while (fpsFrames.length > 0 && fpsFrames[0] < now - 1000) {
    fpsFrames.shift();
    if (fpsFrameTimes.length > 0) fpsFrameTimes.shift();
  }

  if (now - lastFpsUpdate > 250) {
    const fps = Math.round(fpsFrames.length);
    const avgFrameMs = fpsFrameTimes.length > 0
      ? fpsFrameTimes.reduce((a, b) => a + b, 0) / fpsFrameTimes.length
      : (fps > 0 ? 1000 / fps : 0);
    const memMb = typeof performance !== 'undefined' && performance.memory
      ? (performance.memory.usedJSHeapSize / 1048576).toFixed(0)
      : null;

    let text = `FPS: ${fps}`;
    if (perfMonitor) {
      text += ` | FT: ${avgFrameMs.toFixed(1)}ms`;
      if (memMb != null) text += ` | Mem: ${memMb}MB`;
    }

    const fpsColor = fps < 30 ? '#ff0000' : fps < 60 ? '#ffff00' : '#00ff00';
    const ftColor = avgFrameMs > 33 ? '#ff0000' : avgFrameMs > 20 ? '#ffff00' : '#00ff00';
    const color = perfMonitor ? ftColor : fpsColor;

    const { texture, aspect } = makeTextTexture(text, {
      fontSize: perfMonitor ? 24 : 32,
      color,
      shadow: true,
      maxWidth: perfMonitor ? 300 : null,
    });
    if (fpsSprite.material.map) fpsSprite.material.map.dispose();
    fpsSprite.material.map = texture;
    fpsSprite.material.needsUpdate = true;
    fpsSprite.scale.set(aspect * 0.15, 0.15, 1);
    fpsSprite.visible = true;
    lastFpsUpdate = now;
  }
}

// ── Helpers ────────────────────────────────────────────────

function hideAll() {
  titleGroup.visible     = false;
  levelTextGroup.visible = false;
  upgradeGroup.visible   = false;
  gameOverGroup.visible  = false;
}
