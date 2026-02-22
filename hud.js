// ============================================================
//  HUD, TITLE SCREEN, MENUS, DAMAGE NUMBERS
//  All in-VR UI elements rendered as 3D objects.
// ============================================================

import * as THREE from 'three';
import { State, getComboMultiplier, game } from './game.js';

// ── Module state ───────────────────────────────────────────
let sceneRef, cameraRef;

// Groups for different UI states
const titleGroup = new THREE.Group();
const hudGroup = new THREE.Group();
const levelTextGroup = new THREE.Group();
const upgradeGroup = new THREE.Group();
const gameOverGroup = new THREE.Group();
const nameEntryGroup = new THREE.Group();
const scoreboardGroup = new THREE.Group();
const countrySelectGroup = new THREE.Group();
const readyGroup = new THREE.Group();
const debugMenuGroup = new THREE.Group();  // DEBUG menu

// HUD element references
let heartsSprite = null;
let killCountSprite = null;
let levelSprite = null;
let scoreSprite = null;
let comboSprite = null;
let fpsSprite = null;

// Debug menu state
let debugToggleItems = [];

// Live debug stats overlay (shown during gameplay)
let debugStatsGroup = null;
let debugStatsMesh = null;
let debugStatsCanvas = null;
let debugStatsCtx = null;
let debugStatsTexture = null;

// Damage numbers
const damageNumbers = [];

// Upgrade card meshes (for raycasting)
let upgradeCards = [];
let upgradeChoices = [];

// Hit flash (red sphere inside camera)
let hitFlash = null;
let hitFlashOpacity = 0;

// Boss health bar (camera-attached, 3 segments for phases)
let bossHealthGroup = null;
let bossHealthBars = []; // 3 segments

// Title blink
let titleBlinkSprite = null;

// Title scoreboard button
let titleScoreboardBtn = null;

// Title diagnostics button
let titleDiagBtn = null;

// Name entry state
let nameEntryName = '';
let nameEntryCursor = 0;
let nameEntrySlots = [];
let keyboardKeys = [];
let hoveredKey = null;

// Scoreboard state
let scoreboardCanvas = null;
let scoreboardCtx = null;  // PERFORMANCE: Reuse canvas context
let scoreboardTexture = null;
let scoreboardMesh = null;
let scoreboardScrollOffset = 0;
let scoreboardScores = [];
let scoreboardHeader = '';
let scoreboardNeedsRender = false;  // PERFORMANCE: Only render when data changes

// Country select state
let countryListCanvas = null;
let countryListCtx = null;  // PERFORMANCE: Reuse canvas context
let countryListTexture = null;
let countryListMesh = null;
let countrySelectContinent = 'North America';
let countrySelectScrollOffset = 0;
let continentTabs = [];
let countryItems = [];

// PERFORMANCE: Cached country sprites to avoid recreating textures
const countrySpriteCache = new Map();

// ── TEXTURE CACHING SYSTEM ────────────────────────────────────────────

// Cache for HUD element textures to avoid recreation every frame
const hudTextureCache = {};

/**
 * Create or get a cached texture for the given text and color.
 * Returns the texture and aspect ratio.
 */
function getCachedTextTexture(text, fontSize, color, shadow, glow, glowColor, maxWidth) {
  const cacheKey = `${text}:${fontSize}:${color}:${shadow}:${glow}:${glowColor}:${maxWidth}`;
  
  if (hudTextureCache[cacheKey]) {
    return hudTextureCache[cacheKey];
  }

  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');

  // Measure text to size canvas
  ctx.font = `bold ${fontSize}px Arial, sans-serif`;
  const textWidth = maxWidth || Math.ceil(ctx.measureText(text).width);
  const lineHeight = fontSize * 1.3;
  const textHeight = lineHeight; // Single line

  canvas.width = Math.ceil(textWidth) + 40;
  canvas.height = Math.ceil(textHeight) + 40;

  // Re-set after resize
  ctx.font = `bold ${fontSize}px Arial, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  // Clear canvas with transparency
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // Optional glow
  if (glow) {
    ctx.shadowColor = glowColor || color;
    ctx.shadowBlur = 15;
  }

  // Drop shadow
  if (shadow) {
    ctx.fillStyle = 'rgba(0,0,0,0.7)';
    ctx.fillText(text, canvas.width / 2 + 2, canvas.height / 2 + 2);
  }

  // Main text
  ctx.fillStyle = color;
  ctx.fillText(text, canvas.width / 2, canvas.height / 2);

  const texture = new THREE.CanvasTexture(canvas);
  texture.minFilter = THREE.LinearFilter;

  // Cache the texture
  hudTextureCache[cacheKey] = { texture, aspect: canvas.width / canvas.height };

  return hudTextureCache[cacheKey];
}

/**
 * Create or get a cached texture for the hearts display.
 */
function getCachedHeartsTexture(health, maxHealth, scaleMultiplier) {
  const cacheKey = `hearts:${health}:${maxHealth}:${scaleMultiplier}`;
  
  if (hudTextureCache[cacheKey]) {
    return hudTextureCache[cacheKey];
  }

  const heartCount = maxHealth / 2;
  const pixSize = 8;
  const heartW = 7 * pixSize;
  const heartH = 6 * pixSize;
  const gap = 6;
  const canvasWidth = heartCount * (heartW + gap) + gap;
  const canvasHeight = heartH + 10;

  const canvas = document.createElement('canvas');
  canvas.width = canvasWidth;
  canvas.height = canvasHeight;
  const ctx = canvas.getContext('2d');

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

  const aspect = canvasWidth / canvasHeight;
  hudTextureCache[cacheKey] = { texture, aspect };

  return hudTextureCache[cacheKey];
}

/**
 * Clear the texture cache periodically to prevent memory buildup.
 * Called once per second or when needed.
 */
function clearHudCache() {
  Object.keys(hudTextureCache).forEach(key => {
    if (hudTextureCache[key]) {
      if (hudTextureCache[key].texture) {
        hudTextureCache[key].texture.dispose();
      }
    }
    delete hudTextureCache[key];
  });
}

// ── Canvas text utility ────────────────────────────────────
function makeTextTexture(text, opts = {}) {
  return getCachedTextTexture(
    text,
    opts.fontSize || 64,
    opts.color || '#00ffff',
    opts.shadow,
    opts.glow,
    opts.glowColor,
    opts.maxWidth
  );
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
    opacity: opts.opacity !== undefined ? opts.opacity : 1,
    depthTest: opts.depthTest !== undefined ? opts.depthTest : false,
    depthWrite: false,
    side: THREE.DoubleSide,
  });

  const mesh = new THREE.Mesh(geometry, mat);
  mesh.renderOrder = opts.renderOrder !== undefined ? opts.renderOrder : 999;
  return mesh;
}

// ── Pixel heart drawing ────────────────────────────────────
const HEART_PIXELS = [
  [0, 1, 1, 0, 1, 1, 0],
  [1, 1, 1, 1, 1, 1, 1],
  [1, 1, 1, 1, 1, 1, 1],
  [0, 1, 1, 1, 1, 1, 0],
  [0, 0, 1, 1, 1, 0, 0],
  [0, 0, 0, 1, 0, 0, 0],
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

// ── Public API ─────────────────────────────────────────────

export function initHUD(camera, scene) {
  sceneRef = scene;
  cameraRef = camera;

  // ── Title Screen (world-space, fixed position) ──
  createTitleScreen();
  titleGroup.position.set(0, 1.6, -3.5);
  titleGroup.rotation.set(0, 0, 0);
  titleGroup.visible = true;
  scene.add(titleGroup);

  // ── VR HUD (stationary on floor, Space Pirate Trainer style) ──
  createHUDElements();
  hudGroup.position.set(0, 0.05, -3);  // On floor, 3 feet in front of spawn
  hudGroup.rotation.x = -Math.PI / 2;  // Rotate to face up (floor plane)
  scene.add(hudGroup);

  // ── UI Groups (initially hidden) ──
  [levelTextGroup, upgradeGroup, gameOverGroup, nameEntryGroup, scoreboardGroup, countrySelectGroup, readyGroup, debugMenuGroup].forEach(g => {
    g.visible = false;
    g.rotation.set(0, 0, 0);
    scene.add(g);
  });

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

  // ── FPS Counter (top left, attached to camera, more visible in VR) ──
  fpsSprite = makeSprite('FPS: 0', { fontSize: 36, color: '#00ff00', shadow: true, scale: 0.15 });
  fpsSprite.position.set(-0.15, 0.12, -0.5);  // Moved closer to center
  fpsSprite.renderOrder = 1001;
  fpsSprite.material.depthTest = false;  // Always render on top
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

  // ── Debug Stats Overlay (camera-attached) ──
  initDebugStatsOverlay();

  // ── Start cache clear timer (every 60 seconds) ──
  setInterval(clearHudCache, 60000);
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

  // Scoreboard button
  const btnGroup = new THREE.Group();
  btnGroup.position.set(0, -0.6, 0);
  const btnGeo = new THREE.PlaneGeometry(1.2, 0.3);
  const btnMat = new THREE.MeshBasicMaterial({
    color: 0x110033,
    transparent: true,
    opacity: 0.85,
    side: THREE.DoubleSide,
  });
  const btnMesh = new THREE.Mesh(btnGeo, btnMat);
  btnMesh.userData.isTitleScoreboardBtn = true;
  btnGroup.add(btnMesh);
  const btnBorderGeo = new THREE.EdgesGeometry(btnGeo);
  btnGroup.add(new THREE.LineSegments(btnBorderGeo, new THREE.LineBasicMaterial({ color: 0xffff00 })));
  const btnText = makeSprite('SCOREBOARD', {
    fontSize: 36,
    color: '#ffff00',
    glow: true,
    glowColor: '#ffff00',
    scale: 0.20,
  });
  btnText.position.set(0, 0, 0.01);
  btnGroup.add(btnText);
  titleGroup.add(btnGroup);
  titleScoreboardBtn = btnMesh;

  // Diagnostics button
  const diagBtnGroup = new THREE.Group();
  diagBtnGroup.position.set(1.5, -0.6, 0);
  const diagBtnGeo = new THREE.PlaneGeometry(1.2, 0.3);
  const diagBtnMat = new THREE.MeshBasicMaterial({
    color: 0x001133,
    transparent: true,
    opacity: 0.85,
    side: THREE.DoubleSide,
  });
  const diagBtnMesh = new THREE.Mesh(diagBtnGeo, diagBtnMat);
  diagBtnMesh.userData.isTitleDiagBtn = true;
  diagBtnGroup.add(diagBtnMesh);
  const diagBtnBorderGeo = new THREE.EdgesGeometry(diagBtnGeo);
  diagBtnGroup.add(new THREE.LineSegments(diagBtnBorderGeo, new THREE.LineBasicMaterial({ color: 0x00ff88 })));
  const diagBtnText = makeSprite('DIAGNOSTICS', {
    fontSize: 36,
    color: '#00ff88',
    glow: true,
    glowColor: '#00ff88',
    scale: 0.20,
  });
  diagBtnText.position.set(0, 0, 0.01);
  diagBtnGroup.add(diagBtnText);
  titleGroup.add(diagBtnGroup);
  titleDiagBtn = diagBtnMesh;

  // Version number
  const versionDate = 'FEB 10 2026   12:10PM PT';
  const versionNum = 'v0.044';
  const versionSprite = makeSprite(`${versionNum}\nLAST UPDATED: ${versionDate}`, {
    fontSize: 32,
    color: '#888888',
    scale: 0.28,
  });
  versionSprite.position.set(0, -1.0, 0);
  titleGroup.add(versionSprite);

  // Debug mode indicator (uses game state)
  const isPerfMonitor = game.debugPerfMonitor;
  const debugText = isPerfMonitor ? 'PERF: ON' : 'PERF: OFF';
  const debugSprite = makeSprite(debugText, {
    fontSize: 24,
    color: isPerfMonitor ? '#00ff00' : '#666666',
    scale: 0.15,
  });
  debugSprite.position.set(2.5, -0.85, 0);
  debugSprite.name = 'debugIndicator';
  titleGroup.add(debugSprite);
}

export function showTitle() {
  titleGroup.visible = true;
  hudGroup.visible = false;
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
  hudGroup.visible = false;
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
  // Use cached texture
  const { texture, aspect } = getCachedTextTexture(
    text,
    opts.fontSize || 40,
    opts.color || '#ffffff',
    opts.shadow,
    opts.glow,
    opts.glowColor,
    opts.maxWidth
  );
  
  if (sprite.material.map) sprite.material.map.dispose();
  sprite.material.map = texture;
  sprite.material.needsUpdate = true;

  // Update geometry to match aspect ratio (prevents stretching)
  const scale = opts.scale || 0.3;
  sprite.geometry.dispose();
  sprite.geometry = new THREE.PlaneGeometry(aspect * scale, scale);
}

export function updateHUD(gameState) {
  if (!hudGroup.visible) return;

  // Hearts - use cached texture
  const cfg = gameState._levelConfig;
  const killTarget = cfg ? cfg.killTarget : 0;
  
  // Use scale based on level to prevent overwhelming UI at high levels
  const level = gameState.level;
  const scaleMultiplier = Math.min(3.0, 1.0 + level * 0.08);  // Cap at 3x
  
  const { texture: ht, aspect: ha } = getCachedHeartsTexture(gameState.health, gameState.maxHealth, scaleMultiplier);
  if (heartsSprite.material.map) heartsSprite.material.map.dispose();
  heartsSprite.material.map = ht;
  heartsSprite.material.needsUpdate = true;
  
  // Update geometry to match aspect ratio (200% larger: height 0.48)
  heartsSprite.geometry.dispose();
  heartsSprite.geometry = new THREE.PlaneGeometry(ha * 0.48, 0.48);

  // Kill counter - 200% larger
  updateSpriteText(killCountSprite, `${gameState.kills} / ${killTarget}`, { color: '#ffffff', scale: 0.30 });

  // Level - 200% larger
  updateSpriteText(levelSprite, `LEVEL ${gameState.level}`, { color: '#00ffff', glow: true, glowColor: '#00ffff', scale: 0.30 });

  // Score - 200% larger
  updateSpriteText(scoreSprite, `${gameState.score}`, { color: '#ffff00', scale: 0.26 });

  // Combo - 200% larger with descriptive label
  const combo = getComboMultiplier();
  if (combo > 1) {
    comboSprite.visible = true;
    const pulse = 1.0 + Math.sin(performance.now() * 0.01) * 0.1;
    updateSpriteText(comboSprite, `${combo}X SCORE MULTIPLIER`, { color: '#ff8800', scale: 0.18 * pulse });
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
  upgradeCards = [];
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
  card.userData.upgradeId = upgrade.id;
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
      const { texture, aspect } = getCachedTextTexture(
        `WAIT ${Math.ceil(cooldownRemaining)}...`,
        40,
        '#ffff00',
        false,
        false,
        null,
        null
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
  const ctx = canvas.getContext('2d');
  canvas.width = 128;
  canvas.height = 64;

  const fontSize = Math.min(48, 28 + damage / 6);
  ctx.font = `bold ${fontSize}px Arial, sans-serif`;
  ctx.textAlign = 'center';
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
  // Increased scale significantly for better visibility (+30% from before)
  const scale = (0.25 + Math.min(damage / 100, 0.15)) * 1.3;
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
  mesh.userData.lifetime = 500;  // Reduced from 1000ms for performance
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

export function spawnOuchBubble(position, text = 'OUCH!') {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  canvas.width = 256;
  canvas.height = 128;

  // Background bubble
  ctx.fillStyle = text.includes('STREAK') ? '#00ff44' : '#ffff00';
  ctx.strokeStyle = '#000000';
  ctx.lineWidth = 6;

  // Flashy comic bubble shape
  ctx.beginPath();
  ctx.moveTo(40, 60);
  ctx.lineTo(20, 20); ctx.lineTo(80, 40);
  ctx.lineTo(128, 10); ctx.lineTo(176, 40);
  ctx.lineTo(236, 20); ctx.lineTo(216, 60);
  ctx.lineTo(236, 100); ctx.lineTo(176, 80);
  ctx.lineTo(128, 110); ctx.lineTo(80, 80);
  ctx.lineTo(20, 100); ctx.closePath();
  ctx.fill();
  ctx.stroke();

  ctx.font = 'bold 36px "Comic Sans MS", cursive, sans-serif';
  if (text.length > 8) ctx.font = 'bold 24px "Comic Sans MS", cursive, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = text.includes('STREAK') ? '#003311' : '#ff0000';
  ctx.fillText(text, 128, 64);

  const texture = new THREE.CanvasTexture(canvas);
  const mesh = new THREE.Mesh(
    new THREE.PlaneGeometry(1.5, 0.75),
    new THREE.MeshBasicMaterial({ map: texture, transparent: true, depthTest: false, side: THREE.DoubleSide })
  );
  mesh.position.copy(position);
  mesh.position.y += 1.0;
  mesh.position.z += 0.5;
  mesh.renderOrder = 999;
  mesh.userData.createdAt = performance.now();
  mesh.userData.lifetime = 800;
  mesh.userData.velocity = new THREE.Vector3((Math.random() - 0.5) * 0.5, 1.5, (Math.random() - 0.5) * 0.5);

  sceneRef.add(mesh);
  damageNumbers.push(mesh);
}

export function updateDamageNumbers(dt, now) {
  for (let i = damageNumbers.length - 1; i >= 0; i--) {
    const s = damageNumbers[i];
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

// ── Combo Popups ────────────────────────────────────────────
const comboPopups = [];
let lastComboValue = 1;

export function spawnComboPopup(combo, cameraPos) {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  canvas.width = 512;
  canvas.height = 128;

  const text = `${combo}X COMBO!`;
  const fontSize = 72;
  ctx.font = `bold ${fontSize}px Arial, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  // Drop shadow
  ctx.fillStyle = 'rgba(0,0,0,0.8)';
  ctx.fillText(text, 258, 66);

  // Main text - bright orange/yellow
  ctx.fillStyle = '#ffaa00';
  ctx.fillText(text, 256, 64);

  const texture = new THREE.CanvasTexture(canvas);
  texture.minFilter = THREE.LinearFilter;

  // Large, prominent display
  const scale = 0.8;
  const width = scale * 4;
  const height = scale;

  const geometry = new THREE.PlaneGeometry(width, height);
  const mat = new THREE.MeshBasicMaterial({
    map: texture,
    transparent: true,
    depthTest: false,
    depthWrite: false,
  });

  const mesh = new THREE.Mesh(geometry, mat);

  // Position in front of player, slightly up
  mesh.position.copy(cameraPos);
  mesh.position.y += 0.8;
  mesh.position.z -= 2.5;

  mesh.userData.createdAt = performance.now();
  mesh.userData.lifetime = 2000;  // 2 seconds
  mesh.userData.velocity = new THREE.Vector3(0, 0.3, 0);  // Float upward
  mesh.renderOrder = 999;

  sceneRef.add(mesh);
  comboPopups.push(mesh);
}

export function updateComboPopups(dt, now) {
  for (let i = comboPopups.length - 1; i >= 0; i--) {
    const popup = comboPopups[i];
    const age = now - popup.userData.createdAt;

    if (age > popup.userData.lifetime) {
      sceneRef.remove(popup);
      popup.material.map.dispose();
      popup.material.dispose();
      popup.geometry.dispose();
      comboPopups.splice(i, 1);
    } else {
      popup.position.addScaledVector(popup.userData.velocity, dt);
      // Fade out in last 0.5s
      const fadeStart = popup.userData.lifetime - 500;
      if (age > fadeStart) {
        popup.material.opacity = 1 - (age - fadeStart) / 500;
      }
    }
  }
}

export function checkComboIncrease(currentCombo, cameraPos, playSoundFn) {
  if (currentCombo > lastComboValue && currentCombo > 1) {
    spawnComboPopup(currentCombo, cameraPos);
    if (playSoundFn) playSoundFn();
  }
  lastComboValue = currentCombo;
}

// ── FPS Counter & Performance Monitor ───────────────────────
let fpsFrames = [];
let fpsFrameTimes = [];
let lastFpsUpdate = 0;

export function updateFPS(now, opts = {}) {
  if (!fpsSprite) return;

  // Use game state for settings (supports VR toggle via debug menu)
  const showFPS = game.debugShowFPS;
  const perfMonitor = game.debugPerfMonitor || opts.perfMonitor;
  const frameTimeMs = opts.frameTimeMs;

  // Hide FPS if disabled
  if (!showFPS) {
    fpsSprite.visible = false;
    return;
  }

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

    const { texture, aspect } = getCachedTextTexture(text, perfMonitor ? 24 : 32, color, true, false, null, perfMonitor ? 300 : null);
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
  titleGroup.visible = false;
  levelTextGroup.visible = false;
  upgradeGroup.visible = false;
  gameOverGroup.visible = false;
  nameEntryGroup.visible = false;
  scoreboardGroup.visible = false;
  countrySelectGroup.visible = false;
  readyGroup.visible = false;
  debugMenuGroup.visible = false;  // Hide debug menu
  // Floor HUD shouldn't necessarily disappear during everything
  // Specifically don't hide it if we want it visible during upgrades
}

// ── Title Scoreboard Button Hit ─────────────────────────────

export function getTitleButtonHit(raycaster) {
  if (!titleGroup.visible) return null;

  // Check diagnostics/debug button
  if (titleDiagBtn) {
    const diagHits = raycaster.intersectObject(titleDiagBtn, false);
    if (diagHits.length > 0) return 'debug_menu';
  }

  // Check scoreboard button
  if (titleScoreboardBtn) {
    const hits = raycaster.intersectObject(titleScoreboardBtn, false);
    if (hits.length > 0) return 'scoreboard';
  }

  return null;
}

/**
 * Update the title screen debug indicator when settings change
 */
export function updateTitleDebugIndicator() {
  const indicator = titleGroup.getObjectByName('debugIndicator');
  if (indicator) {
    const isPerfMonitor = game.debugPerfMonitor;
    const debugText = isPerfMonitor ? 'PERF: ON' : 'PERF: OFF';
    const { texture, aspect } = getCachedTextTexture(debugText, 24, isPerfMonitor ? '#00ff00' : '#666666', false, false, null, null);
    if (indicator.material.map) indicator.material.map.dispose();
    indicator.material.map = texture;
    indicator.material.needsUpdate = true;
    indicator.scale.set(aspect * 0.15, 0.15, 1);
  }
}

// ── Run Diagnostics ──────────────────────────────────────
export function runDiagnostics() {
  const results = [];
  let allPassed = true;

  // Check scene
  if (!sceneRef) {
    results.push('❌ Scene reference is missing');
    allPassed = false;
  } else if (sceneRef.children.length === 0) {
    results.push('❌ Scene is empty (no objects)');
    allPassed = false;
  } else {
    results.push(`✅ Scene has ${sceneRef.children.length} objects`);
  }

  // Check camera
  if (!cameraRef) {
    results.push('❌ Camera reference is missing');
    allPassed = false;
  } else {
    results.push(`✅ Camera at (${cameraRef.position.x.toFixed(1)}, ${cameraRef.position.y.toFixed(1)}, ${cameraRef.position.z.toFixed(1)})`);
  }

  // Check groups visibility
  if (!titleGroup.visible) {
    results.push('⚠️ Title group is not visible (expected)');
  } else {
    results.push('✅ Title group is visible');
  }

  // Check UI groups are in scene
  const groupsToCheck = [titleGroup, hudGroup, levelTextGroup, upgradeGroup, gameOverGroup];
  groupsToCheck.forEach((g, i) => {
    if (g) {
      if (!sceneRef.children.includes(g)) {
        results.push(`❌ Group ${i} is not in scene`);
        allPassed = false;
      } else {
        results.push(`✅ Group ${i} is in scene`);
      }
    }
  });

  // Show results in console
  console.log('=== DIAGNOSTICS RESULTS ===');
  results.forEach(r => console.log(r));
  console.log('===========================');

  // Also show on the web page
  if (typeof window !== 'undefined' && window.showWebError) {
    const status = allPassed ? 'ALL DIAGNOSTICS PASSED' : 'SOME DIAGNOSTICS FAILED';
    window.showWebError(status, results.join('\n'));
  }

  return allPassed;
}

// ── Debug Menu Screen ──────────────────────────────────────

/**
 * Show the debug menu with toggle options for FPS monitor settings
 */
export function showDebugMenu() {
  hideAll();
  while (debugMenuGroup.children.length) debugMenuGroup.remove(debugMenuGroup.children[0]);
  debugToggleItems = [];
  
  debugMenuGroup.position.set(0, 1.6, -4);
  debugMenuGroup.visible = true;

  // Header
  const header = makeSprite('DEBUG MENU', {
    fontSize: 60, color: '#00ffff', glow: true, glowColor: '#00ffff', scale: 0.6,
  });
  header.position.set(0, 1.4, 0);
  debugMenuGroup.add(header);

  // Toggle options - expanded with more debug features
  const options = [
    { 
      id: 'fps', 
      label: 'FPS COUNTER', 
      desc: 'Show FPS in VR',
      getState: () => game.debugShowFPS,
      toggle: () => { game.debugShowFPS = !game.debugShowFPS; }
    },
    { 
      id: 'perf', 
      label: 'PERF MONITOR', 
      desc: 'Show frame time + memory',
      getState: () => game.debugPerfMonitor,
      toggle: () => { game.debugPerfMonitor = !game.debugPerfMonitor; }
    },
    { 
      id: 'stats', 
      label: 'LIVE STATS', 
      desc: 'Game state overlay',
      getState: () => game.debugShowStats,
      toggle: () => { game.debugShowStats = !game.debugShowStats; }
    },
    { 
      id: 'upgrades', 
      label: 'UPGRADE INFO', 
      desc: 'Show upgrade counts',
      getState: () => game.debugShowUpgrades,
      toggle: () => { game.debugShowUpgrades = !game.debugShowUpgrades; }
    },
  ];

  const startY = 1.0;
  const itemHeight = 0.38;
  const itemWidth = 2.0;

  options.forEach((opt, i) => {
    const y = startY - i * itemHeight;
    const isOn = opt.getState();

    // Background
    const itemGroup = new THREE.Group();
    itemGroup.position.set(0, y, 0);

    const bgGeo = new THREE.PlaneGeometry(itemWidth, 0.32);
    const bgMat = new THREE.MeshBasicMaterial({
      color: isOn ? 0x003322 : 0x221133,
      transparent: true,
      opacity: 0.9,
      side: THREE.DoubleSide,
    });
    const bgMesh = new THREE.Mesh(bgGeo, bgMat);
    bgMesh.userData.debugToggle = opt.id;
    itemGroup.add(bgMesh);

    // Border
    itemGroup.add(new THREE.LineSegments(
      new THREE.EdgesGeometry(bgGeo),
      new THREE.LineBasicMaterial({ color: isOn ? 0x00ff88 : 0x888888 })
    ));

    // Label
    const label = makeSprite(opt.label, {
      fontSize: 26, color: '#ffffff', scale: 0.16,
    });
    label.position.set(-0.4, 0.05, 0.01);
    itemGroup.add(label);

    // Description (smaller text below label)
    const desc = makeSprite(opt.desc, {
      fontSize: 18, color: '#888888', scale: 0.12,
    });
    desc.position.set(-0.4, -0.08, 0.01);
    itemGroup.add(desc);

    // Status indicator (ON/OFF)
    const statusText = isOn ? 'ON' : 'OFF';
    const statusColor = isOn ? '#00ff88' : '#ff4444';
    const status = makeSprite(statusText, {
      fontSize: 26, color: statusColor, glow: isOn, glowColor: statusColor, scale: 0.14,
    });
    status.position.set(0.7, 0, 0.01);
    status.userData.isStatusLabel = true;
    itemGroup.add(status);

    debugMenuGroup.add(itemGroup);
    debugToggleItems.push({ group: itemGroup, mesh: bgMesh, option: opt });
  });

  // System info section
  const sysInfoY = startY - options.length * itemHeight - 0.15;
  const sysInfo = makeSprite('SYSTEM INFO', {
    fontSize: 22, color: '#666666', scale: 0.14,
  });
  sysInfo.position.set(-0.7, sysInfoY, 0);
  debugMenuGroup.add(sysInfo);

  // Show current debug status
  const memInfo = typeof performance !== 'undefined' && performance.memory
    ? `${(performance.memory.usedJSHeapSize / 1048576).toFixed(0)}MB`
    : 'N/A';
  const sysText = makeSprite(`Memory: ${memInfo}`, {
    fontSize: 18, color: '#888888', scale: 0.11,
  });
  sysText.position.set(-0.5, sysInfoY - 0.15, 0);
  sysText.name = 'sysMemInfo';
  debugMenuGroup.add(sysText);

  // BACK button
  const backGroup = new THREE.Group();
  backGroup.position.set(0, -1.1, 0);
  const backGeo = new THREE.PlaneGeometry(1.0, 0.3);
  const backMat = new THREE.MeshBasicMaterial({
    color: 0x330000, transparent: true, opacity: 0.9, side: THREE.DoubleSide,
  });
  const backMesh = new THREE.Mesh(backGeo, backMat);
  backMesh.userData.debugAction = 'back';
  backGroup.add(backMesh);
  backGroup.add(new THREE.LineSegments(
    new THREE.EdgesGeometry(backGeo),
    new THREE.LineBasicMaterial({ color: 0xff4444 })
  ));
  const backTxt = makeSprite('BACK', { fontSize: 28, color: '#ff4444', scale: 0.15 });
  backTxt.position.set(0, 0, 0.01);
  backGroup.add(backTxt);
  debugMenuGroup.add(backGroup);

  sceneRef.add(debugMenuGroup);
}

export function hideDebugMenu() {
  debugMenuGroup.visible = false;
  if (sceneRef && debugMenuGroup.parent === sceneRef) {
    sceneRef.remove(debugMenuGroup);
  }
}

/**
 * Handle raycast hits on debug menu
 */
export function getDebugMenuHit(raycaster) {
  if (!debugMenuGroup.visible) return null;

  // Check toggle items
  const toggleMeshes = debugToggleItems.map(t => t.mesh);
  let hits = raycaster.intersectObjects(toggleMeshes, false);
  if (hits.length > 0) {
    const toggleId = hits[0].object.userData.debugToggle;
    const item = debugToggleItems.find(t => t.option.id === toggleId);
    if (item) {
      // Toggle the state
      item.option.toggle();
      
      // Save settings
      if (typeof window !== 'undefined') {
        // Import and call saveDebugSettings from game.js
        import('./game.js').then(module => {
          if (module.saveDebugSettings) module.saveDebugSettings();
        });
      }
      
      // Update visuals
      const isOn = item.option.getState();
      item.mesh.material.color.setHex(isOn ? 0x003322 : 0x221133);
      
      // Update border
      const border = item.group.children.find(c => c.type === 'LineSegments');
      if (border) {
        border.material.color.setHex(isOn ? 0x00ff88 : 0x888888);
      }
      
      // Update status label
      const statusLabel = item.group.children.find(c => c.userData && c.userData.isStatusLabel);
      if (statusLabel) {
        const statusText = isOn ? 'ON' : 'OFF';
        const statusColor = isOn ? '#00ff88' : '#ff4444';
        const { texture, aspect } = getCachedTextTexture(statusText, 28, statusColor, false, isOn, statusColor, null);
        if (statusLabel.material.map) statusLabel.material.map.dispose();
        statusLabel.material.map = texture;
        statusLabel.material.needsUpdate = true;
        statusLabel.scale.set(aspect * 0.15, 0.15, 1);
      }
    }
    return null;  // Don't change state, just toggle
  }

  // Check back button
  const actionMeshes = [];
  debugMenuGroup.traverse(c => {
    if (c.userData && c.userData.debugAction) actionMeshes.push(c);
  });
  hits = raycaster.intersectObjects(actionMeshes, false);
  if (hits.length > 0) {
    return { action: hits[0].object.userData.debugAction };
  }

  return null;
}

// ── Live Debug Stats Overlay ─────────────────────────────────

/**
 * Initialize the debug stats overlay (called once during initHUD)
 */
function initDebugStatsOverlay() {
  debugStatsGroup = new THREE.Group();
  debugStatsGroup.visible = false;
  
  // Create canvas for stats display
  debugStatsCanvas = document.createElement('canvas');
  debugStatsCanvas.width = 400;
  debugStatsCanvas.height = 300;
  debugStatsCtx = debugStatsCanvas.getContext('2d');
  
  debugStatsTexture = new THREE.CanvasTexture(debugStatsCanvas);
  debugStatsTexture.minFilter = THREE.LinearFilter;
  
  // Create mesh
  const geo = new THREE.PlaneGeometry(0.5, 0.375);
  const mat = new THREE.MeshBasicMaterial({
    map: debugStatsTexture,
    transparent: true,
    opacity: 0.9,
    side: THREE.DoubleSide,
    depthTest: false,
  });
  debugStatsMesh = new THREE.Mesh(geo, mat);
  debugStatsMesh.renderOrder = 1002;
  
  // Position in bottom-right of camera view
  debugStatsGroup.add(debugStatsMesh);
  
  // Attach to camera
  cameraRef.add(debugStatsGroup);
}

/**
 * Update the live debug stats overlay
 * @param {Object} stats - Debug stats from getDebugStats()
 * @param {Object} entityCounts - Entity counts {enemies, projectiles, explosions, particles}
 */
export function updateDebugStatsOverlay(stats, entityCounts) {
  if (!debugStatsCanvas || !game.debugShowStats) {
    if (debugStatsGroup) debugStatsGroup.visible = false;
    return;
  }
  
  debugStatsGroup.visible = true;
  
  const ctx = debugStatsCtx;
  const w = debugStatsCanvas.width;
  const h = debugStatsCanvas.height;
  
  // Clear
  ctx.clearRect(0, 0, w, h);
  
  // Background
  ctx.fillStyle = 'rgba(0, 0, 20, 0.85)';
  ctx.fillRect(0, 0, w, h);
  
  // Border
  ctx.strokeStyle = '#00ffff';
  ctx.lineWidth = 2;
  ctx.strokeRect(1, 1, w - 2, h - 2);
  
  ctx.font = 'bold 14px monospace';
  ctx.textBaseline = 'top';
  
  let y = 10;
  const lineHeight = 18;
  
  // State info
  ctx.fillStyle = '#00ffff';
  ctx.fillText(`STATE: ${stats.state}`, 10, y);
  y += lineHeight;
  
  ctx.fillStyle = '#ffffff';
  ctx.fillText(`LVL: ${stats.level} | ${stats.isBoss ? 'BOSS' : 'KILLS: ' + stats.kills + '/' + stats.killTarget}`, 10, y);
  y += lineHeight;
  
  ctx.fillStyle = '#ff00ff';
  ctx.fillText(`HP: ${stats.health} | SCORE: ${stats.score}`, 10, y);
  y += lineHeight;
  
  ctx.fillStyle = '#ffff00';
  ctx.fillText(`COMBO: ${stats.combo}x | STREAK: ${stats.streak}`, 10, y);
  y += lineHeight + 5;
  
  // Entity counts
  ctx.fillStyle = '#888888';
  ctx.fillText('─── ENTITIES ───', 10, y);
  y += lineHeight;
  
  ctx.fillStyle = '#ff8800';
  ctx.fillText(`Enemies: ${entityCounts.enemies}`, 10, y);
  y += lineHeight;
  
  ctx.fillStyle = '#00ff00';
  ctx.fillText(`Projectiles: ${entityCounts.projectiles}`, 10, y);
  y += lineHeight;
  
  ctx.fillStyle = '#ff4444';
  ctx.fillText(`Explosions: ${entityCounts.explosions}`, 10, y);
  y += lineHeight;
  
  ctx.fillStyle = '#ffff88';
  ctx.fillText(`Particles: ${entityCounts.particles}`, 10, y);
  y += lineHeight + 5;
  
  // Weapons
  ctx.fillStyle = '#888888';
  ctx.fillText('─── WEAPONS ───', 10, y);
  y += lineHeight;
  
  ctx.fillStyle = '#00ffff';
  ctx.fillText(`L: ${stats.mainWeapon.left}${stats.altWeapon.left ? ' + ' + stats.altWeapon.left : ''}`, 10, y);
  y += lineHeight;
  
  ctx.fillStyle = '#ff00ff';
  ctx.fillText(`R: ${stats.mainWeapon.right}${stats.altWeapon.right ? ' + ' + stats.altWeapon.right : ''}`, 10, y);
  
  // Update texture
  debugStatsTexture.needsUpdate = true;
  
  // Position in bottom-right corner of camera view
  debugStatsMesh.position.set(0.25, -0.12, -0.5);
}

/**
 * Show/hide debug stats overlay based on settings
 */
export function setDebugStatsVisible(visible) {
  if (debugStatsGroup) {
    debugStatsGroup.visible = visible && game.debugShowStats;
  }
}

export function getDebugJumpHit(raycaster) {
  return getReadyScreenHit(raycaster);
}

export function showDebugJumpScreen(targetLevel) {
  hideAll();
  while (readyGroup.children.length) readyGroup.remove(readyGroup.children[0]);
  readyGroup.position.set(0, 1.6, -4);
  readyGroup.visible = true;

  const header = makeSprite(`DEBUG JUMP`, {
    fontSize: 70, color: '#ff00ff', glow: true, scale: 0.6,
  });
  header.position.set(0, 0.8, 0);
  readyGroup.add(header);

  const levelTxt = makeSprite(`LEVEL ${targetLevel}`, {
    fontSize: 50, color: '#ffffff', scale: 0.5,
  });
  levelTxt.position.set(0, 0.4, 0);
  readyGroup.add(levelTxt);

  const btnGeo = new THREE.PlaneGeometry(1, 0.4);
  const btnMat = new THREE.MeshBasicMaterial({ color: 0x330033, transparent: true, opacity: 0.8 });
  const btn = new THREE.Mesh(btnGeo, btnMat);
  btn.userData.readyAction = 'start';
  btn.position.set(0, -0.2, 0);
  readyGroup.add(btn);

  readyGroup.add(new THREE.LineSegments(
    new THREE.EdgesGeometry(btnGeo),
    new THREE.LineBasicMaterial({ color: 0xff00ff })
  ));

  const startTxt = makeSprite('START', { fontSize: 40, color: '#ff00ff', scale: 0.3 });
  startTxt.position.set(0, -0.2, 0.01);
  readyGroup.add(startTxt);
}

// ── Ready Screen ──────────────────────────────────────────
export function showReadyScreen(level, playerPos) {
  hideAll();
  while (readyGroup.children.length) readyGroup.remove(readyGroup.children[0]);

  // Position in front of the player
  if (playerPos) {
    readyGroup.position.copy(playerPos);
    readyGroup.position.y = 1.6;
    readyGroup.position.z -= 4;
  } else {
    readyGroup.position.set(0, 1.6, -4);
  }
  readyGroup.visible = true;

  const header = makeSprite(`READY?`, {
    fontSize: 70, color: '#ffff00', glow: true, scale: 0.6,
  });
  header.position.set(0, 0.8, 0);
  readyGroup.add(header);

  const subheader = makeSprite('SHOOT TO START', {
    fontSize: 40, color: '#00ffff', scale: 0.4,
  });
  subheader.position.set(0, 0.4, 0);
  readyGroup.add(subheader);

  // START target
  const btnGeo = new THREE.PlaneGeometry(1, 0.4);
  const btnMat = new THREE.MeshBasicMaterial({ color: 0x003300, transparent: true, opacity: 0.8 });
  const btn = new THREE.Mesh(btnGeo, btnMat);
  btn.userData.readyAction = 'start';
  btn.position.set(0, -0.2, 0);
  readyGroup.add(btn);

  readyGroup.add(new THREE.LineSegments(
    new THREE.EdgesGeometry(btnGeo),
    new THREE.LineBasicMaterial({ color: 0x00ff00 })
  ));

  const startTxt = makeSprite('START', { fontSize: 40, color: '#00ff00', scale: 0.3 });
  startTxt.position.set(0, -0.2, 0.01);
  readyGroup.add(startTxt);
}

export function hideReadyScreen() {
  readyGroup.visible = false;
}

export function getReadyScreenHit(raycaster) {
  if (!readyGroup.visible) return null;
  const actionMeshes = [];
  readyGroup.traverse(c => {
    if (c.userData && c.userData.readyAction) actionMeshes.push(c);
  });
  const hits = raycaster.intersectObjects(actionMeshes, false);
  if (hits.length > 0) return hits[0].object.userData.readyAction;
  return null;
}

// ── Name Entry Screen ───────────────────────────────────────

export function showNameEntry(score, level, storedName) {
  hideAll();
  while (nameEntryGroup.children.length) nameEntryGroup.remove(nameEntryGroup.children[0]);
  nameEntrySlots = [];
  keyboardKeys = [];
  hoveredKey = null;
  nameEntryName = storedName || '';
  nameEntryCursor = nameEntryName.length;

  nameEntryGroup.position.set(0, 1.6, -4);
  nameEntryGroup.visible = true;

  // Header
  const header = makeSprite('ENTER YOUR NAME', {
    fontSize: 60, color: '#00ffff', glow: true, glowColor: '#00ffff', scale: 0.6,
  });
  header.position.set(0, 1.4, 0);
  nameEntryGroup.add(header);

  // Score display
  const scoreText = makeSprite(`SCORE: ${score}  LEVEL: ${level}`, {
    fontSize: 40, color: '#ffff00', scale: 0.4,
  });
  scoreText.position.set(0, 1.05, 0);
  nameEntryGroup.add(scoreText);

  // 6 character slot boxes
  const slotWidth = 0.18;
  const slotGap = 0.04;
  const totalWidth = 6 * slotWidth + 5 * slotGap;
  const startX = -totalWidth / 2 + slotWidth / 2;

  for (let i = 0; i < 6; i++) {
    const slotGroup = new THREE.Group();
    const x = startX + i * (slotWidth + slotGap);
    slotGroup.position.set(x, 0.75, 0);

    const boxGeo = new THREE.PlaneGeometry(slotWidth, 0.22);
    const boxMat = new THREE.MeshBasicMaterial({
      color: i === nameEntryCursor ? 0x003344 : 0x110022,
      transparent: true, opacity: 0.9, side: THREE.DoubleSide,
    });
    const box = new THREE.Mesh(boxGeo, boxMat);
    slotGroup.add(box);

    const borderGeo = new THREE.EdgesGeometry(boxGeo);
    const borderColor = i === nameEntryCursor ? 0x00ffff : 0x666666;
    slotGroup.add(new THREE.LineSegments(borderGeo, new THREE.LineBasicMaterial({ color: borderColor })));

    const char = nameEntryName[i] || '';
    if (char) {
      const charSprite = makeSprite(char, {
        fontSize: 48, color: '#ffffff', scale: 0.18,
      });
      charSprite.position.set(0, 0, 0.01);
      charSprite.userData.isSlotChar = true;
      slotGroup.add(charSprite);
    }

    nameEntrySlots.push({ group: slotGroup, box, boxMat });
    nameEntryGroup.add(slotGroup);
  }

  // Virtual keyboard
  const rows = [
    ['Q', 'W', 'E', 'R', 'T', 'Y', 'U', 'I', 'O', 'P'],
    ['A', 'S', 'D', 'F', 'G', 'H', 'J', 'K', 'L'],
    ['Z', 'X', 'C', 'V', 'B', 'N', 'M', 'DEL'],
    ['SPACE', 'OK'],
  ];

  const keySize = 0.12;
  const keyGap = 0.02;
  let rowY = 0.4;

  for (const row of rows) {
    const rowWidth = row.reduce((sum, key) => {
      if (key === 'SPACE') return sum + keySize * 3 + keyGap;
      if (key === 'OK') return sum + keySize * 1.5 + keyGap;
      if (key === 'DEL') return sum + keySize * 1.5 + keyGap;
      return sum + keySize + keyGap;
    }, -keyGap);
    let keyX = -rowWidth / 2;

    for (const key of row) {
      let w = keySize;
      if (key === 'SPACE') w = keySize * 3;
      else if (key === 'OK' || key === 'DEL') w = keySize * 1.5;

      const keyGroup = new THREE.Group();
      keyGroup.position.set(keyX + w / 2, rowY, 0);

      const keyGeo = new THREE.PlaneGeometry(w, keySize);
      const isAction = key === 'OK' || key === 'DEL' || key === 'SPACE';
      const keyColor = key === 'OK' ? 0x003300 : (key === 'DEL' ? 0x330000 : 0x111133);
      const keyMat = new THREE.MeshBasicMaterial({
        color: keyColor, transparent: true, opacity: 0.9, side: THREE.DoubleSide,
      });
      const keyMesh = new THREE.Mesh(keyGeo, keyMat);
      keyMesh.userData.keyValue = key;
      keyMesh.userData.isKeyboardKey = true;
      keyGroup.add(keyMesh);

      const borderGeo = new THREE.EdgesGeometry(keyGeo);
      const borderColor = key === 'OK' ? 0x00ff00 : (key === 'DEL' ? 0xff4444 : 0x444488);
      keyGroup.add(new THREE.LineSegments(borderGeo, new THREE.LineBasicMaterial({ color: borderColor })));

      const label = key === 'SPACE' ? '___' : key;
      const textColor = key === 'OK' ? '#00ff00' : (key === 'DEL' ? '#ff4444' : '#ccccff');
      const keyLabel = makeSprite(label, {
        fontSize: 28, color: textColor, scale: 0.09,
      });
      keyLabel.position.set(0, 0, 0.01);
      keyGroup.add(keyLabel);

      keyboardKeys.push({ group: keyGroup, mesh: keyMesh, mat: keyMat, key, baseColor: keyColor });
      nameEntryGroup.add(keyGroup);

      keyX += w + keyGap;
    }
    rowY -= keySize + keyGap;
  }
}

export function hideNameEntry() {
  nameEntryGroup.visible = false;
}

export function getNameEntryName() {
  return nameEntryName;
}

export function getKeyboardHit(raycaster) {
  if (!nameEntryGroup.visible) return null;
  const meshes = keyboardKeys.map(k => k.mesh);
  const hits = raycaster.intersectObjects(meshes, false);
  if (hits.length > 0) {
    const key = hits[0].object.userData.keyValue;
    return processKeyPress(key);
  }
  return null;
}

function processKeyPress(key) {
  if (key === 'OK') {
    if (nameEntryName.length > 0) return { action: 'submit', name: nameEntryName };
    return null;
  }
  if (key === 'DEL') {
    if (nameEntryCursor > 0) {
      nameEntryName = nameEntryName.slice(0, -1);
      nameEntryCursor = nameEntryName.length;
      refreshNameSlots();
    }
    return null;
  }
  if (key === 'SPACE') {
    if (nameEntryName.length < 6) {
      nameEntryName += ' ';
      nameEntryCursor = nameEntryName.length;
      refreshNameSlots();
    }
    return null;
  }
  // Letter key
  if (nameEntryName.length < 6) {
    nameEntryName += key;
    nameEntryCursor = nameEntryName.length;
    refreshNameSlots();
  }
  return null;
}

function refreshNameSlots() {
  nameEntrySlots.forEach((slot, i) => {
    // Update cursor highlight
    const isCursor = i === nameEntryCursor || (nameEntryCursor >= 6 && i === 5);
    slot.boxMat.color.setHex(isCursor ? 0x003344 : 0x110022);

    // Remove old char sprite
    const old = slot.group.children.filter(c => c.userData && c.userData.isSlotChar);
    old.forEach(c => slot.group.remove(c));

    // Add new char
    const char = nameEntryName[i] || '';
    if (char) {
      const charSprite = makeSprite(char, {
        fontSize: 48, color: '#ffffff', scale: 0.18,
      });
      charSprite.position.set(0, 0, 0.01);
      charSprite.userData.isSlotChar = true;
      slot.group.add(charSprite);
    }
  });
}

export function updateKeyboardHover(raycaster) {
  if (!nameEntryGroup.visible) return;

  // Reset previous hover
  if (hoveredKey) {
    hoveredKey.mat.color.setHex(hoveredKey.baseColor);
    hoveredKey = null;
  }

  const meshes = keyboardKeys.map(k => k.mesh);
  const hits = raycaster.intersectObjects(meshes, false);
  if (hits.length > 0) {
    const hit = keyboardKeys.find(k => k.mesh === hits[0].object);
    if (hit) {
      hoveredKey = hit;
      hit.mat.color.setHex(0x004455);
    }
  }
}

// ── Scoreboard Screen ───────────────────────────────────────

export function showScoreboard(scores, headerText) {
  hideAll();
  while (scoreboardGroup.children.length) scoreboardGroup.remove(scoreboardGroup.children[0]);

  scoreboardScores = scores;
  scoreboardScrollOffset = 0;
  scoreboardHeader = headerText || 'GLOBAL LEADERBOARD';
  scoreboardGroup.position.set(0, 1.6, -5);
  scoreboardGroup.visible = true;

  // Header
  const header = makeSprite(scoreboardHeader, {
    fontSize: 60, color: '#00ffff', glow: true, glowColor: '#00ffff', scale: 0.6,
  });
  header.position.set(0, 1.8, 0);
  scoreboardGroup.add(header);

  // Score list canvas
  renderScoreboardCanvas();
  scoreboardMesh.position.set(0, 0.5, 0);
  scoreboardGroup.add(scoreboardMesh);

  // Buttons on right side
  const btnDefs = [
    { label: 'COUNTRY', y: 1.2, action: 'country' },
    { label: 'CONTINENT', y: 0.85, action: 'continent' },
    { label: 'SCROLL UP', y: 0.1, action: 'scroll_up' },
    { label: 'SCROLL DOWN', y: -0.25, action: 'scroll_down' },
  ];

  for (const def of btnDefs) {
    const btnGroup = new THREE.Group();
    btnGroup.position.set(1.2, def.y, 0);

    const btnGeo = new THREE.PlaneGeometry(0.5, 0.25);
    const btnMat = new THREE.MeshBasicMaterial({
      color: 0x111133, transparent: true, opacity: 0.9, side: THREE.DoubleSide,
    });
    const btnMesh = new THREE.Mesh(btnGeo, btnMat);
    btnMesh.userData.scoreboardAction = def.action;
    btnGroup.add(btnMesh);

    btnGroup.add(new THREE.LineSegments(
      new THREE.EdgesGeometry(btnGeo),
      new THREE.LineBasicMaterial({ color: 0x888888 })
    ));

    const txt = makeSprite(def.label, { fontSize: 22, color: '#ffffff', scale: 0.12 });
    txt.position.set(0, 0, 0.01);
    btnGroup.add(txt);

    scoreboardGroup.add(btnGroup);
  }

  // BACK button bottom center
  const backGroup = new THREE.Group();
  backGroup.position.set(0, -0.7, 0);
  const backGeo = new THREE.PlaneGeometry(0.6, 0.25);
  const backMat = new THREE.MeshBasicMaterial({
    color: 0x330000, transparent: true, opacity: 0.9, side: THREE.DoubleSide,
  });
  const backMesh = new THREE.Mesh(backGeo, backMat);
  backMesh.userData.scoreboardAction = 'back';
  backGroup.add(backMesh);
  backGroup.add(new THREE.LineSegments(
    new THREE.EdgesGeometry(backGeo),
    new THREE.LineBasicMaterial({ color: 0xff4444 })
  ));
  const backTxt = makeSprite('BACK', { fontSize: 24, color: '#ff4444', scale: 0.12 });
  backTxt.position.set(0, 0, 0.01);
  backGroup.add(backTxt);
  scoreboardGroup.add(backGroup);
}

function renderScoreboardCanvas() {
  // PERFORMANCE: Reuse canvas instead of recreating every frame
  const w = 800;
  const h = 1000;
  
  if (!scoreboardCanvas) {
    scoreboardCanvas = document.createElement('canvas');
    scoreboardCanvas.width = w;
    scoreboardCanvas.height = h;
    scoreboardCtx = scoreboardCanvas.getContext('2d');
  }
  
  const canvas = scoreboardCanvas;
  const ctx = scoreboardCtx;
  ctx.clearRect(0, 0, w, h);

  // Background
  ctx.fillStyle = 'rgba(10, 0, 30, 0.9)';
  ctx.fillRect(0, 0, w, h);

  // Border
  ctx.strokeStyle = '#444488';
  ctx.lineWidth = 2;
  ctx.strokeRect(1, 1, w - 2, h - 2);

  const rowHeight = 30; // Reduced from 42
  const maxVisible = Math.floor(h / rowHeight);
  const startIdx = scoreboardScrollOffset;
  const endIdx = Math.min(startIdx + maxVisible, scoreboardScores.length);

  ctx.font = 'bold 18px Arial, sans-serif'; // Reduced from 24
  ctx.textBaseline = 'middle';

  for (let i = startIdx; i < endIdx; i++) {
    const score = scoreboardScores[i];
    const y = (i - startIdx) * rowHeight + rowHeight / 2 + 4;
    const rank = i + 1;

    // Rank color
    if (rank === 1) ctx.fillStyle = '#ffdd00';
    else if (rank === 2) ctx.fillStyle = '#cccccc';
    else if (rank === 3) ctx.fillStyle = '#cc8844';
    else ctx.fillStyle = '#888888';

    ctx.textAlign = 'left';
    ctx.fillText(`#${rank}`, 15, y);

    // Name
    ctx.fillStyle = '#ffffff';
    ctx.fillText(score.name || 'ANONYMOUS', 90, y);

    // Score
    ctx.fillStyle = '#ffff00';
    ctx.textAlign = 'right';
    const scoreVal = score.score !== undefined && score.score !== null ? score.score.toLocaleString() : '0';
    ctx.fillText(scoreVal, 520, y);

    // Level
    ctx.fillStyle = '#00ffff';
    ctx.textAlign = 'right';
    const levelVal = score.level_reached !== undefined && score.level_reached !== null ? `L${score.level_reached}` : 'L?';
    ctx.fillText(levelVal, 600, y);

    // Country flag (if available)
    if (score.country) {
      try {
        const flag = String.fromCodePoint(
          ...[...score.country.toUpperCase()].map(c => 0x1F1E6 + c.charCodeAt(0) - 65)
        );
        ctx.textAlign = 'left';
        ctx.font = '16px Arial, sans-serif';
        ctx.fillText(flag, 640, y);
        ctx.font = 'bold 18px Arial, sans-serif';
      } catch (e) { /* skip flag */ }
    }

    // Divider line
    ctx.strokeStyle = 'rgba(100, 100, 200, 0.2)';
    ctx.beginPath();
    ctx.moveTo(10, (i - startIdx + 1) * rowHeight + 4);
    ctx.lineTo(w - 10, (i - startIdx + 1) * rowHeight + 4);
    ctx.stroke();
  }

  // "Loading" or "No scores" message
  if (scoreboardScores.length === 0) {
    ctx.fillStyle = '#666666';
    ctx.textAlign = 'center';
    ctx.font = 'bold 32px Arial, sans-serif';
    ctx.fillText('NO SCORES YET', w / 2, h / 2);
  }

  // Scroll indicator
  if (scoreboardScores.length > maxVisible) {
    ctx.fillStyle = '#444488';
    ctx.textAlign = 'center';
    ctx.font = '18px Arial, sans-serif';
    ctx.fillText(`${startIdx + 1}-${endIdx} of ${scoreboardScores.length}`, w / 2, h - 15);
  }

  // PERFORMANCE: Only create texture once, then just update it
  if (!scoreboardTexture) {
    scoreboardTexture = new THREE.CanvasTexture(canvas);
    scoreboardTexture.minFilter = THREE.LinearFilter;
  } else {
    scoreboardTexture.needsUpdate = true;
  }

  if (!scoreboardMesh) {
    const geo = new THREE.PlaneGeometry(1.8, 2.2);
    const mat = new THREE.MeshBasicMaterial({
      map: scoreboardTexture, transparent: true, side: THREE.DoubleSide, depthTest: false,
    });
    scoreboardMesh = new THREE.Mesh(geo, mat);
    scoreboardMesh.renderOrder = 999;
  } else {
    scoreboardMesh.material.map = scoreboardTexture;
    scoreboardMesh.material.needsUpdate = true;
  }
}

export function hideScoreboard() {
  scoreboardGroup.visible = false;
  
  // PERFORMANCE: Clean up scoreboard resources
  while (scoreboardGroup.children.length) {
    const child = scoreboardGroup.children[0];
    if (child.geometry) child.geometry.dispose();
    if (child.material) {
      if (child.material.map && child.material.map !== scoreboardTexture) {
        child.material.map.dispose();
      }
      child.material.dispose();
    }
    scoreboardGroup.remove(child);
  }
  
  // Reset mesh reference (keep canvas and texture for reuse)
  scoreboardMesh = null;
}

export function getScoreboardHit(raycaster) {
  if (!scoreboardGroup.visible) return null;
  const actionMeshes = [];
  scoreboardGroup.traverse(c => {
    if (c.userData && c.userData.scoreboardAction) actionMeshes.push(c);
  });
  const hits = raycaster.intersectObjects(actionMeshes, false);
  if (hits.length > 0) {
    const action = hits[0].object.userData.scoreboardAction;
    if (action === 'scroll_up') {
      scoreboardScrollOffset = Math.max(0, scoreboardScrollOffset - 10);
      renderScoreboardCanvas();
      return null;
    }
    if (action === 'scroll_down') {
      scoreboardScrollOffset = Math.min(
        Math.max(0, scoreboardScores.length - 20),
        scoreboardScrollOffset + 10
      );
      renderScoreboardCanvas();
      return null;
    }
    return action;
  }
  return null;
}

export function updateScoreboardScroll(delta) {
  if (!scoreboardGroup.visible) return;
  scoreboardScrollOffset = Math.max(0, Math.min(
    Math.max(0, scoreboardScores.length - 20),
    scoreboardScrollOffset + delta
  ));
  renderScoreboardCanvas();
}

// ── Country Select Screen ───────────────────────────────────

export function showCountrySelect(countries, continents, initialContinent) {
  hideAll();

  // PERFORMANCE: Clean up old resources before recreating
  while (countrySelectGroup.children.length) {
    const child = countrySelectGroup.children[0];
    if (child.geometry) child.geometry.dispose();
    if (child.material) {
      if (child.material.map) child.material.map.dispose();
      child.material.dispose();
    }
    countrySelectGroup.remove(child);
  }
  
  continentTabs = [];
  countryItems = [];
  countrySelectContinent = initialContinent || 'North America';
  countrySelectScrollOffset = 0;
  
  // Reset canvas mesh reference
  countryListMesh = null;

  countrySelectGroup.position.set(0, 1.6, -4);
  countrySelectGroup.visible = true;

  // Header
  const header = makeSprite('SELECT YOUR COUNTRY', {
    fontSize: 60, color: '#00ffff', glow: true, glowColor: '#00ffff', scale: 0.6,
  });
  header.position.set(0, 1.6, 0);
  countrySelectGroup.add(header);

  // Continent tabs across top
  const tabWidth = 0.45;
  const tabGap = 0.04;
  const totalTabWidth = continents.length * tabWidth + (continents.length - 1) * tabGap;
  let tabX = -totalTabWidth / 2 + tabWidth / 2;

  for (const continent of continents) {
    const tabGroup = new THREE.Group();
    tabGroup.position.set(tabX, 1.2, 0);

    const isActive = continent === countrySelectContinent;
    const tabGeo = new THREE.PlaneGeometry(tabWidth, 0.2);
    const tabMat = new THREE.MeshBasicMaterial({
      color: isActive ? 0x003344 : 0x111133,
      transparent: true, opacity: 0.9, side: THREE.DoubleSide,
    });
    const tabMesh = new THREE.Mesh(tabGeo, tabMat);
    tabMesh.userData.continentTab = continent;
    tabGroup.add(tabMesh);

    tabGroup.add(new THREE.LineSegments(
      new THREE.EdgesGeometry(tabGeo),
      new THREE.LineBasicMaterial({ color: isActive ? 0x00ffff : 0x444466 })
    ));

    // Short label
    const shortName = continent.length > 8 ? continent.slice(0, 7) + '.' : continent;
    const tabLabel = makeSprite(shortName, {
      fontSize: 18, color: isActive ? '#00ffff' : '#888888', scale: 0.1,
    });
    tabLabel.position.set(0, 0, 0.01);
    tabGroup.add(tabLabel);

    continentTabs.push({ group: tabGroup, mesh: tabMesh, continent });
    countrySelectGroup.add(tabGroup);
    tabX += tabWidth + tabGap;
  }

  // Country list
  renderCountryList(countries);

  // Scroll buttons on right side (only if there are more countries than visible)
  const btnDefs = [
    { label: 'UP', y: 0.5, action: 'scroll_up' },
    { label: 'DOWN', y: -0.3, action: 'scroll_down' },
  ];

  for (const def of btnDefs) {
    const btnGroup = new THREE.Group();
    btnGroup.position.set(1.2, def.y, 0);

    const btnGeo = new THREE.PlaneGeometry(0.4, 0.25);
    const btnMat = new THREE.MeshBasicMaterial({
      color: 0x111133, transparent: true, opacity: 0.9, side: THREE.DoubleSide,
    });
    const btnMesh = new THREE.Mesh(btnGeo, btnMat);
    btnMesh.userData.countryAction = def.action;
    btnGroup.add(btnMesh);

    btnGroup.add(new THREE.LineSegments(
      new THREE.EdgesGeometry(btnGeo),
      new THREE.LineBasicMaterial({ color: 0x888888 })
    ));

    const txt = makeSprite(def.label, { fontSize: 20, color: '#ffffff', scale: 0.1 });
    txt.position.set(0, 0, 0.01);
    btnGroup.add(txt);

    countrySelectGroup.add(btnGroup);
  }

  // BACK button
  const backGroup = new THREE.Group();
  backGroup.position.set(0, -0.9, 0); // Moved down from -0.8
  const backGeo = new THREE.PlaneGeometry(0.6, 0.25);
  const backMat = new THREE.MeshBasicMaterial({
    color: 0x330000, transparent: true, opacity: 0.9, side: THREE.DoubleSide,
  });
  const backMesh = new THREE.Mesh(backGeo, backMat);
  backMesh.userData.countryAction = 'back';
  backGroup.add(backMesh);
  backGroup.add(new THREE.LineSegments(
    new THREE.EdgesGeometry(backGeo),
    new THREE.LineBasicMaterial({ color: 0xff4444 })
  ));
  const backTxt = makeSprite('BACK', { fontSize: 28, color: '#ff4444', scale: 0.15 });
  backTxt.position.set(0, 0, 0.01);
  backGroup.add(backTxt);
  countrySelectGroup.add(backGroup);
}

// PERFORMANCE: Render country list to a single canvas (like scoreboard)
// This avoids creating 50+ individual 3D objects which kills performance
function renderCountryList(countries, scrollOffset = 0) {
  // Remove old country item meshes
  countryItems.forEach(item => {
    if (item.group) {
      countrySelectGroup.remove(item.group);
    }
    if (item.mesh) {
      countrySelectGroup.remove(item.mesh);
      if (item.mesh.geometry) item.mesh.geometry.dispose();
      if (item.mesh.material) item.mesh.material.dispose();
    }
  });
  countryItems = [];
  
  // Remove old canvas mesh if exists
  if (countryListMesh) {
    countrySelectGroup.remove(countryListMesh);
    if (countryListMesh.geometry) countryListMesh.geometry.dispose();
    if (countryListMesh.material) countryListMesh.material.dispose();
    countryListMesh = null;
  }

  const filtered = countries.filter(c => c.continent === countrySelectContinent);
  
  // Clamp scroll offset
  const maxVisible = 12;
  const maxScroll = Math.max(0, filtered.length - maxVisible);
  scrollOffset = Math.max(0, Math.min(scrollOffset, maxScroll));
  
  // PERFORMANCE: Use single canvas for all countries
  const w = 600;
  const rowHeight = 32;
  const visibleCount = Math.min(filtered.length - scrollOffset, maxVisible);
  const h = visibleCount * rowHeight + 20;
  
  if (!countryListCanvas) {
    countryListCanvas = document.createElement('canvas');
    countryListCtx = countryListCanvas.getContext('2d');
  }
  
  countryListCanvas.width = w;
  countryListCanvas.height = h;
  const ctx = countryListCtx;
  ctx.clearRect(0, 0, w, h);

  // Background
  ctx.fillStyle = 'rgba(10, 0, 30, 0.9)';
  ctx.fillRect(0, 0, w, h);

  // Border
  ctx.strokeStyle = '#444488';
  ctx.lineWidth = 2;
  ctx.strokeRect(1, 1, w - 2, h - 2);

  ctx.font = 'bold 22px Arial, sans-serif';
  ctx.textBaseline = 'middle';

  for (let i = 0; i < visibleCount; i++) {
    const country = filtered[scrollOffset + i];
    const y = i * rowHeight + rowHeight / 2 + 10;

    // Row background
    ctx.fillStyle = 'rgba(17, 17, 51, 0.85)';
    ctx.fillRect(5, i * rowHeight + 5, w - 10, rowHeight - 4);

    // Country flag and name
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'left';
    ctx.fillText(`${country.flag}  ${country.name}`, 20, y);

    // Divider line
    if (i < visibleCount - 1) {
      ctx.strokeStyle = 'rgba(68, 68, 102, 0.5)';
      ctx.beginPath();
      ctx.moveTo(10, (i + 1) * rowHeight + 5);
      ctx.lineTo(w - 10, (i + 1) * rowHeight + 5);
      ctx.stroke();
    }
  }
  
  // Scroll indicator
  if (filtered.length > maxVisible) {
    ctx.fillStyle = '#444488';
    ctx.textAlign = 'center';
    ctx.font = '16px Arial, sans-serif';
    ctx.fillText(`${scrollOffset + 1}-${scrollOffset + visibleCount} of ${filtered.length}`, w / 2, h - 10);
  }

  // Create or update texture
  if (!countryListTexture) {
    countryListTexture = new THREE.CanvasTexture(countryListCanvas);
    countryListTexture.minFilter = THREE.LinearFilter;
  } else {
    countryListTexture.needsUpdate = true;
  }

  // Create mesh for the canvas
  const aspect = w / h;
  const meshHeight = 1.8;
  const meshWidth = meshHeight * aspect;
  const geo = new THREE.PlaneGeometry(meshWidth, meshHeight);
  const mat = new THREE.MeshBasicMaterial({
    map: countryListTexture,
    transparent: true,
    side: THREE.DoubleSide,
    depthTest: false,
  });
  countryListMesh = new THREE.Mesh(geo, mat);
  countryListMesh.position.set(0, 0.1, 0);
  countryListMesh.renderOrder = 999;
  countrySelectGroup.add(countryListMesh);

  // Create invisible hitboxes for each visible country (much cheaper than full 3D objects)
  const startY = 0.85;
  const itemHeight = meshHeight / visibleCount;
  const topY = startY - itemHeight / 2;
  
  for (let i = 0; i < visibleCount; i++) {
    const country = filtered[scrollOffset + i];
    const y = topY - i * itemHeight;
    
    // Create a simple invisible hitbox
    const hitboxGeo = new THREE.PlaneGeometry(meshWidth * 0.95, itemHeight * 0.9);
    const hitboxMat = new THREE.MeshBasicMaterial({
      transparent: true,
      opacity: 0,
      depthTest: false,
    });
    const hitbox = new THREE.Mesh(hitboxGeo, hitboxMat);
    hitbox.position.set(0, y, 0.01);
    hitbox.userData.countryCode = country.code;
    hitbox.userData.countryAction = 'select';
    countrySelectGroup.add(hitbox);
    countryItems.push({ mesh: hitbox, code: country.code });
  }
  
  // Store filtered countries and scroll info
  countrySelectGroup.userData.filteredCountries = filtered;
  countrySelectGroup.userData.scrollOffset = scrollOffset;
  countrySelectGroup.userData.maxVisible = maxVisible;
  countrySelectScrollOffset = scrollOffset;
}

export function hideCountrySelect() {
  countrySelectGroup.visible = false;
  
  // PERFORMANCE: Clean up country list resources
  countryItems.forEach(item => {
    if (item.group) {
      countrySelectGroup.remove(item.group);
    }
    if (item.mesh) {
      countrySelectGroup.remove(item.mesh);
      if (item.mesh.geometry) item.mesh.geometry.dispose();
      if (item.mesh.material) item.mesh.material.dispose();
    }
  });
  countryItems = [];
  
  // Clean up canvas mesh
  if (countryListMesh) {
    countrySelectGroup.remove(countryListMesh);
    if (countryListMesh.geometry) countryListMesh.geometry.dispose();
    if (countryListMesh.material) countryListMesh.material.dispose();
    countryListMesh = null;
  }
}

export function getCountrySelectHit(raycaster, countries) {
  if (!countrySelectGroup.visible) return null;

  // Check scroll and action buttons first
  const actionMeshes = [];
  countrySelectGroup.traverse(c => {
    if (c.userData && c.userData.countryAction) actionMeshes.push(c);
  });
  let hits = raycaster.intersectObjects(actionMeshes, false);
  if (hits.length > 0) {
    const action = hits[0].object.userData.countryAction;
    
    // Handle scroll actions
    if (action === 'scroll_up') {
      const newOffset = Math.max(0, countrySelectScrollOffset - 4);
      if (newOffset !== countrySelectScrollOffset) {
        renderCountryList(countries, newOffset);
      }
      return null;
    }
    if (action === 'scroll_down') {
      const filtered = countries.filter(c => c.continent === countrySelectContinent);
      const maxScroll = Math.max(0, filtered.length - 12);
      const newOffset = Math.min(maxScroll, countrySelectScrollOffset + 4);
      if (newOffset !== countrySelectScrollOffset) {
        renderCountryList(countries, newOffset);
      }
      return null;
    }
    
    return { action };
  }

  // Check continent tabs
  const tabMeshes = continentTabs.map(t => t.mesh);
  hits = raycaster.intersectObjects(tabMeshes, false);
  if (hits.length > 0) {
    const continent = hits[0].object.userData.continentTab;
    if (continent !== countrySelectContinent) {
      countrySelectContinent = continent;
      // Reset scroll when changing continent
      countrySelectScrollOffset = 0;
      // Refresh tabs and list
      renderCountryList(countries, 0);
      // Update tab visuals
      continentTabs.forEach(tab => {
        const isActive = tab.continent === countrySelectContinent;
        tab.mesh.material.color.setHex(isActive ? 0x003344 : 0x111133);
      });
    }
    return null;
  }

  // Check country items
  const itemMeshes = countryItems.map(i => i.mesh).filter(Boolean);
  hits = raycaster.intersectObjects(itemMeshes, false);
  if (hits.length > 0) {
    const code = hits[0].object.userData.countryCode;
    return { action: 'select', code };
  }

  return null;
}

/**
 * Unified hover effect for all HUD buttons and upgrade cards.
 * Accepts an array of raycasters (one per controller).
 * Returns true if a NEW hover occurred (to trigger sound).
 */
export function updateHUDHover(raycasters) {
  const hoverables = [];

  // 1. Title Scoreboard & Diagnostics
  if (titleGroup.visible) {
    if (titleScoreboardBtn) hoverables.push(titleScoreboardBtn);
    if (titleDiagBtn) hoverables.push(titleDiagBtn);
  }

  // 2. Upgrade Cards
  if (upgradeGroup.visible) {
    upgradeCards.forEach(card => {
      const mesh = card.children.find(c => c.userData.isUpgradeCard);
      if (mesh) hoverables.push(mesh);
    });
  }

  // 3. Scoreboard / Regional
  if (scoreboardGroup.visible) {
    scoreboardGroup.traverse(c => {
      if (c.userData && c.userData.scoreboardAction) hoverables.push(c);
    });
  }

  // 4. Country Select
  if (countrySelectGroup.visible) {
    countrySelectGroup.traverse(c => {
      // Continent tabs, country grid items, or the BACK button
      if (c.userData && (c.userData.continentTab || c.userData.countryCode || c.userData.countryAction)) {
        hoverables.push(c);
      }
    });
  }

  // 5. Ready Screen
  if (readyGroup.visible) {
    readyGroup.traverse(c => {
      if (c.userData && c.userData.readyAction) hoverables.push(c);
    });
  }

  if (hoverables.length === 0) return false;

  // Find ALL hovered objects from ALL raycasters
  const hoveredObjs = new Set();
  raycasters.forEach(rc => {
    const hits = rc.intersectObjects(hoverables, false);
    if (hits.length > 0) hoveredObjs.add(hits[0].object);
  });

  let newHover = false;

  // We need to keep track of ALL hoverables to reset those NOT hovered
  // Traverse and reset or set scale
  hoverables.forEach(obj => {
    let target = obj;
    // For many of our UI elements, the 'active area' is a Mesh inside a Group. 
    // We want to scale the Group for the best visual effect.
    if (obj.parent && obj.parent.type === 'Group') {
      target = obj.parent;
    }

    if (hoveredObjs.has(obj)) {
      if (!obj.userData._isActuallyHovered) {
        obj.userData._isActuallyHovered = true;
        newHover = true;
      }
      target.scale.set(1.1, 1.1, 1.1);
    } else {
      if (obj.userData._isActuallyHovered) {
        obj.userData._isActuallyHovered = false;
        target.scale.set(1.0, 1.0, 1.0);
      }
    }
  });

  return newHover;
}

/** Highlights the controller currently selected for upgrade */
export function showUpgradeHandHighlight(hand, controllers) {
  controllers.forEach((ctrl, i) => {
    const isHand = (i === 0 && hand === 'left') || (i === 1 && hand === 'right');
    const existing = ctrl.getObjectByName('upgradeHighlight');
    if (existing) ctrl.remove(existing);

    if (isHand) {
      const group = new THREE.Group();
      group.name = 'upgradeHighlight';

      const geo = new THREE.OctahedronGeometry(0.1, 0);
      const mat = new THREE.MeshBasicMaterial({ color: 0x00ffff, wireframe: true, transparent: true, opacity: 0.6 });
      const mesh = new THREE.Mesh(geo, mat);
      group.add(mesh);

      const glow = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: 0x00ffff, transparent: true, opacity: 0.2 }));
      glow.scale.set(1.4, 1.4, 1.4);
      group.add(glow);

      group.position.set(0, 0.05, 0);
      ctrl.add(group);
    }
  });
}

export function hideUpgradeHandHighlights(controllers) {
  controllers.forEach(ctrl => {
    const existing = ctrl.getObjectByName('upgradeHighlight');
    if (existing) ctrl.remove(existing);
  });
}

/** Updates the spinning animation of the highlight */
export function updateUpgradeHandHighlights(now) {
  [readyGroup, upgradeGroup].forEach(g => {
    // This is handled via normal scene graph if attached to controller
  });
}
