// ============================================================
//  HUD, TITLE SCREEN, MENUS, DAMAGE NUMBERS - Babylon.js Port
//  All in-VR UI elements rendered as 3D objects.
// ============================================================

import * as BABYLON from '@babylonjs/core';
import { State } from './game.js';

// ── Module state ───────────────────────────────────────────
let sceneRef = null;
let cameraRef = null;

// Groups for different UI states
let titleGroup = null;
let hudGroup = null;
let levelTextGroup = null;
let upgradeGroup = null;
let gameOverGroup = null;
let nameEntryGroup = null;
let scoreboardGroup = null;
let countrySelectGroup = null;

// HUD element references
let heartsMesh = null;
let killCountMesh = null;
let levelMesh = null;
let scoreMesh = null;
let comboMesh = null;
let fpsMesh = null;

// Damage numbers
const damageNumbers = [];
const damageNumberPool = [];
const DAMAGE_NUMBER_POOL_SIZE = 40;

// Upgrade card meshes (for raycasting)
let upgradeCards = [];
let upgradeChoices = [];

// Hit flash
let hitFlash = null;
let hitFlashOpacity = 0;

// Boss health bar
let bossHealthGroup = null;
let bossHealthFillBar = null;

// Title blink
let titleBlinkMesh = null;

// Title scoreboard button
let titleScoreboardBtn = null;

// Name entry state
let nameEntryName = '';
let nameEntryCursor = 0;
let nameEntrySlots = [];
let keyboardKeys = [];
let hoveredKey = null;

// Scoreboard state
let scoreboardTexture = null;
let scoreboardMesh = null;
let scoreboardScrollOffset = 0;
let scoreboardScores = [];

// Country select state
let countrySelectContinent = 'North America';
let continentTabs = [];
let countryItems = [];

// ── Canvas text utility ────────────────────────────────────
function configureAlphaTestMaterial(mat, texture) {
  mat.diffuseTexture = texture;
  mat.diffuseTexture.hasAlpha = true;
  mat.emissiveTexture = texture;
  mat.backFaceCulling = false;
  mat.disableLighting = true;
  mat.useAlphaFromDiffuseTexture = true;
}

function makeTextTexture(text, opts = {}, existingObj = null) {
  let canvas = existingObj ? existingObj.canvas : document.createElement('canvas');
  let ctx = existingObj ? existingObj.ctx : canvas.getContext('2d');

  const fontSize = opts.fontSize || 64;
  const font = `bold ${fontSize}px Arial, sans-serif`;
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
  const textWidth = maxWidth || Math.ceil(Math.max(...lines.map(l => ctx.measureText(l).width)));
  const lineHeight = fontSize * 1.3;
  const textHeight = lines.length * lineHeight;

  const neededWidth = Math.ceil(textWidth) + 40;
  const neededHeight = Math.ceil(textHeight);

  if (canvas.width !== neededWidth || canvas.height !== neededHeight) {
    canvas.width = neededWidth;
    canvas.height = neededHeight;
  } else {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  }

  // Re-set after resize
  ctx.font = font;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  // Optional glow
  if (opts.glow) {
    ctx.shadowColor = opts.glowColor || opts.color || '#00ffff';
    ctx.shadowBlur = opts.glowSize || 15;
  } else {
    ctx.shadowBlur = 0;
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

  let texture;
  if (existingObj && existingObj.texture) {
    texture = existingObj.texture;
    texture.update();
  } else {
    texture = new BABYLON.DynamicTexture('textTex', canvas, sceneRef);
    texture.hasAlpha = true;
  }

  return { texture, aspect: canvas.width / canvas.height, canvas, ctx };
}

function makeTextPlane(text, opts = {}) {
  const { texture, aspect, canvas, ctx } = makeTextTexture(text, opts);

  const scale = opts.scale || 0.3;
  const width = aspect * scale;
  const height = scale;

  const plane = BABYLON.MeshBuilder.CreatePlane('textPlane', { width: 1, height: 1 }, sceneRef);
  plane.scaling.x = width;
  plane.scaling.y = height;
  
  const mat = new BABYLON.StandardMaterial('textMat', sceneRef);
  configureAlphaTestMaterial(mat, texture);
  
  plane.material = mat;
  plane.renderingGroupId = 1;

  // Store rendering context for reuse
  plane.metadata = plane.metadata || {};
  plane.metadata.renderContext = { canvas, ctx, texture };

  return plane;
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
  HEART_PIXELS.forEach((row, py) => {
    row.forEach((px_on, px) => {
      if (!px_on) return;
      if (state === 'empty') {
        return;
      } else if (state === 'half' && px >= 4) {
        return;
      } else {
        ctx.fillStyle = '#ff0044';
      }
      ctx.fillRect(x + px * pixSize, y + py * pixSize, pixSize, pixSize);
    });
  });
}

function makeHeartsTexture(health, maxHealth, existingObj = null) {
  const heartCount = maxHealth / 2;
  const pixSize = 8;
  const heartW = 7 * pixSize;
  const heartH = 6 * pixSize;
  const gap = 6;

  const width = heartCount * (heartW + gap) + gap;
  const height = heartH + 10;

  let canvas = existingObj ? existingObj.canvas : document.createElement('canvas');
  let ctx = existingObj ? existingObj.ctx : canvas.getContext('2d');

  if (canvas.width !== width || canvas.height !== height) {
    canvas.width = width;
    canvas.height = height;
  } else {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  }

  for (let i = 0; i < heartCount; i++) {
    const hpForThisHeart = health - i * 2;
    let state;
    if (hpForThisHeart >= 2) state = 'full';
    else if (hpForThisHeart === 1) state = 'half';
    else state = 'empty';

    drawHeart(ctx, gap + i * (heartW + gap), 5, pixSize, state);
  }

  let texture;
  if (existingObj && existingObj.texture) {
    texture = existingObj.texture;
    texture.update();
  } else {
    texture = new BABYLON.DynamicTexture('heartsTex', canvas, sceneRef);
    texture.hasAlpha = true;
  }

  return { texture, aspect: canvas.width / canvas.height, canvas, ctx };
}

// ── Public API ─────────────────────────────────────────────

export function initHUD(camera, scene) {
  sceneRef = scene;
  cameraRef = camera;

  // ── Title Screen ──
  titleGroup = createTitleScreen();
  titleGroup.position = new BABYLON.Vector3(0, 1.6, 6);
  titleGroup.rotation.y = Math.PI;
  titleGroup.scaling.x = -1;
  
  // ── VR HUD (floor-mounted) ──
  hudGroup = createHUDElements();
  hudGroup.position = new BABYLON.Vector3(0, 0.05, 3);
  hudGroup.rotation.x = Math.PI / 2;

  // ── Level transition text ──
  levelTextGroup = new BABYLON.TransformNode('levelTextGroup', scene);
  levelTextGroup.setEnabled(false);

  // ── Upgrade selection ──
  upgradeGroup = new BABYLON.TransformNode('upgradeGroup', scene);
  upgradeGroup.setEnabled(false);

  // ── Game over ──
  gameOverGroup = new BABYLON.TransformNode('gameOverGroup', scene);
  gameOverGroup.setEnabled(false);

  // ── Name entry ──
  nameEntryGroup = new BABYLON.TransformNode('nameEntryGroup', scene);
  nameEntryGroup.setEnabled(false);

  // ── Scoreboard ──
  scoreboardGroup = new BABYLON.TransformNode('scoreboardGroup', scene);
  scoreboardGroup.setEnabled(false);

  // ── Country select ──
  countrySelectGroup = new BABYLON.TransformNode('countrySelectGroup', scene);
  countrySelectGroup.setEnabled(false);

  // ── Hit flash (sphere around camera) ──
  hitFlash = BABYLON.MeshBuilder.CreateSphere('hitFlash', { diameter: 0.8, segments: 16 }, scene);
  const hitFlashMat = new BABYLON.StandardMaterial('hitFlashMat', scene);
  hitFlashMat.diffuseColor = new BABYLON.Color3(1, 0, 0);
  hitFlashMat.emissiveColor = new BABYLON.Color3(1, 0, 0);
  hitFlashMat.wireframe = true;
  hitFlashMat.backFaceCulling = false;
  hitFlashMat.disableLighting = true;
  hitFlash.material = hitFlashMat;
  hitFlash.parent = camera;
  hitFlash.setEnabled(false);

  // ── FPS Counter ──
  fpsMesh = makeTextPlane('FPS: 0', { fontSize: 36, color: '#00ff00', shadow: true, scale: 0.2 });
  fpsMesh.position = new BABYLON.Vector3(-0.35, 0.2, -0.5);
  fpsMesh.parent = camera;

  // ── Boss health bar ──
  bossHealthGroup = new BABYLON.TransformNode('bossHealthGroup', scene);
  bossHealthGroup.setEnabled(false);
  
  const bossBarWidth = 1.5;
  const bossBarHeight = 0.08;
  
  const bgBar = BABYLON.MeshBuilder.CreatePlane('bossHealthBg', { width: bossBarWidth, height: bossBarHeight }, scene);
  const bgBarMat = new BABYLON.StandardMaterial('bossHealthBgMat', scene);
  bgBarMat.diffuseColor = new BABYLON.Color3(0.13, 0.27, 0.13);
  bgBarMat.backFaceCulling = false;
  bgBarMat.disableLighting = true;
  bgBarMat.disableDepthWrite = true;
  bgBar.material = bgBarMat;
  bgBar.parent = bossHealthGroup;
  
  bossHealthFillBar = BABYLON.MeshBuilder.CreatePlane('bossHealthFill', { width: bossBarWidth, height: bossBarHeight }, scene);
  const fillBarMat = new BABYLON.StandardMaterial('bossHealthFillMat', scene);
  fillBarMat.diffuseColor = new BABYLON.Color3(0, 1, 0.27);
  fillBarMat.backFaceCulling = false;
  fillBarMat.disableLighting = true;
  fillBarMat.disableDepthWrite = true;
  bossHealthFillBar.material = fillBarMat;
  bossHealthFillBar.position.z = 0.01;
  bossHealthFillBar.parent = bossHealthGroup;
}

// ── Boss Health Bar ────────────────────────────────────────

export function showBossHealthBar(hp, maxHp, phases = 3) {
  if (!bossHealthGroup) return;
  bossHealthGroup.setEnabled(true);
  bossHealthGroup.metadata = bossHealthGroup.metadata || {};
  bossHealthGroup.metadata.maxHp = maxHp;
  bossHealthGroup.metadata.phases = phases;
}

export function hideBossHealthBar() {
  if (bossHealthGroup) bossHealthGroup.setEnabled(false);
}

export function updateBossHealthBar(hp, maxHp, phases = 3, bossMesh = null) {
  if (!bossHealthGroup || !bossHealthGroup.isEnabled()) return;
  
  const t = Math.max(0, Math.min(1, hp / maxHp));
  const barWidth = 1.5;
  
  if (bossHealthFillBar) {
    bossHealthFillBar.scaling.x = Math.max(0.001, t);
    bossHealthFillBar.position.x = -(1 - t) * barWidth / 2;
    
    // Color transition: green → yellow → red
    const color = new BABYLON.Color3();
    if (t > 0.5) {
      color.copyFromFloats(0, 1, 0.27);
      BABYLON.Color3.LerpToRef(color, new BABYLON.Color3(1, 1, 0), (1 - (t - 0.5) * 2), color);
    } else if (t > 0.25) {
      color.copyFromFloats(1, 1, 0);
      BABYLON.Color3.LerpToRef(color, new BABYLON.Color3(1, 0.13, 0), (1 - (t - 0.25) * 4), color);
    } else {
      color.copyFromFloats(1, 0.13, 0);
      BABYLON.Color3.LerpToRef(color, new BABYLON.Color3(0.53, 0, 0), (1 - t * 4), color);
    }
    bossHealthFillBar.material.diffuseColor = color;
  }
  
  if (bossMesh) {
    bossHealthGroup.position = bossMesh.position.clone();
    bossHealthGroup.position.y += 1.2;
    bossHealthGroup.lookAt(cameraRef.position);
  }
}

// ── Title Screen ───────────────────────────────────────────

function createTitleScreen() {
  const group = new BABYLON.TransformNode('titleGroup', sceneRef);

  // Big title: SPACEOMICIDE
  const titleMesh = makeTextPlane('SPACEOMICIDE', {
    fontSize: 140,
    color: '#00ffff',
    glow: true, glowColor: '#0088ff', glowSize: 30,
    scale: 1.8,
  });
  titleMesh.position = new BABYLON.Vector3(0, 1.6, 0);
  titleMesh.parent = group;

  // Subtitle
  const subMesh = makeTextPlane('VR ROGUELIKE BLASTER', {
    fontSize: 48,
    color: '#ff00ff',
    glow: true, glowColor: '#ff00ff', glowSize: 10,
    scale: 0.6,
  });
  subMesh.position = new BABYLON.Vector3(0, 0.8, 0);
  subMesh.parent = group;

  // Blinking "Press Trigger to Begin"
  titleBlinkMesh = makeTextPlane('PRESS TRIGGER TO BEGIN', {
    fontSize: 52,
    color: '#ffffff',
    glow: true, glowColor: '#ffffff',
    scale: 0.5,
  });
  titleBlinkMesh.position = new BABYLON.Vector3(0, 0, 0);
  titleBlinkMesh.parent = group;

  // Scoreboard button
  const btnPlane = BABYLON.MeshBuilder.CreatePlane('titleBtn', { width: 1.2, height: 0.3 }, sceneRef);
  const btnMat = new BABYLON.StandardMaterial('btnMat', sceneRef);
  btnMat.diffuseColor = new BABYLON.Color3(0.07, 0, 0.2);
  btnMat.backFaceCulling = false;
  btnMat.disableLighting = true;
  btnPlane.material = btnMat;
  btnPlane.position = new BABYLON.Vector3(0, -0.6, 0);
  btnPlane.parent = group;
  
  // Button border
  const borderLines = [];
  borderLines.push([new BABYLON.Vector3(-0.6, -0.15, 0), new BABYLON.Vector3(0.6, -0.15, 0)]);
  borderLines.push([new BABYLON.Vector3(0.6, -0.15, 0), new BABYLON.Vector3(0.6, 0.15, 0)]);
  borderLines.push([new BABYLON.Vector3(0.6, 0.15, 0), new BABYLON.Vector3(-0.6, 0.15, 0)]);
  borderLines.push([new BABYLON.Vector3(-0.6, 0.15, 0), new BABYLON.Vector3(-0.6, -0.15, 0)]);
  const borderSystem = BABYLON.MeshBuilder.CreateLineSystem('btnBorder', { lines: borderLines }, sceneRef);
  borderSystem.color = new BABYLON.Color3(1, 1, 0);
  borderSystem.position = new BABYLON.Vector3(0, -0.6, 0.01);
  borderSystem.parent = group;

  const btnText = makeTextPlane('SCOREBOARD', {
    fontSize: 36,
    color: '#ffff00',
    glow: true, glowColor: '#ffff00',
    scale: 0.25,
  });
  btnText.position = new BABYLON.Vector3(0, -0.6, 0.02);
  btnText.parent = group;

  titleScoreboardBtn = btnPlane;

  // Version number
  const versionMesh = makeTextPlane('v0.3.1 (SKID ROW)\nLAST UPDATED: FEB 15 2026', {
    fontSize: 32,
    color: '#888888',
    scale: 0.28,
  });
  versionMesh.position = new BABYLON.Vector3(0, -1.0, 0);
  versionMesh.parent = group;

  return group;
}

export function showTitle() {
  titleGroup.setEnabled(true);
  hudGroup.setEnabled(false);
}

export function hideTitle() {
  titleGroup.setEnabled(false);
}

export function updateTitle(now) {
  if (titleBlinkMesh) {
    titleBlinkMesh.setEnabled(Math.sin(now * 0.004) > -0.15);
  }
}

// ── VR HUD ────────────────────────────────────────────────

function createHUDElements() {
  const group = new BABYLON.TransformNode('hudGroup', sceneRef);
  group.setEnabled(false);

  // Hearts (left side)
  const heartsTex = makeHeartsTexture(6, 6);
  heartsMesh = BABYLON.MeshBuilder.CreatePlane('hearts', { width: 1, height: 1 }, sceneRef);
  const heartsMat = new BABYLON.StandardMaterial('heartsMat', sceneRef);
  heartsMat.diffuseTexture = heartsTex.texture;
  heartsMat.diffuseTexture.hasAlpha = true;
  heartsMat.emissiveTexture = heartsTex.texture;
  heartsMat.useAlphaFromDiffuseTexture = true;
  heartsMat.transparencyMode = BABYLON.Material.MATERIAL_ALPHATEST;
  heartsMat.alphaCutOff = 0.1;
  heartsMat.backFaceCulling = false;
  heartsMat.disableLighting = true;
  heartsMesh.material = heartsMat;
  heartsMesh.position = new BABYLON.Vector3(-1.5, 0, 0);
  heartsMesh.renderingGroupId = 1;
  heartsMesh.metadata = heartsMesh.metadata || {};
  heartsMesh.metadata.renderContext = { canvas: heartsTex.canvas, ctx: heartsTex.ctx, texture: heartsTex.texture };
  heartsMesh.parent = group;

  // Score (right side)
  scoreMesh = makeTextPlane('0', { fontSize: 60, color: '#ffff00', shadow: true, scale: 2.4 });
  scoreMesh.position = new BABYLON.Vector3(1.5, 0, 0);
  scoreMesh.parent = group;

  // Kill counter (center)
  killCountMesh = makeTextPlane('0/0', { fontSize: 50, color: '#ffffff', shadow: true, scale: 2.1 });
  killCountMesh.position = new BABYLON.Vector3(0, 0, 0);
  killCountMesh.parent = group;

  // Level indicator (above kill counter)
  levelMesh = makeTextPlane('LEVEL 1', { fontSize: 48, color: '#00ffff', glow: true, scale: 1.95 });
  levelMesh.position = new BABYLON.Vector3(0, 0.45, 0);
  levelMesh.parent = group;

  // Combo multiplier
  comboMesh = makeTextPlane('1x', { fontSize: 40, color: '#ff8800', shadow: true, scale: 1.8 });
  comboMesh.position = new BABYLON.Vector3(1.5, -0.45, 0);
  comboMesh.setEnabled(false);
  comboMesh.parent = group;

  return group;
}

export function showHUD() {
  hudGroup.setEnabled(true);
}

export function hideHUD() {
  hudGroup.setEnabled(false);
}

function updatePlaneText(plane, text, opts = {}) {
  const existingObj = plane.metadata?.renderContext || null;
  const { texture, aspect, canvas, ctx } = makeTextTexture(text, opts, existingObj);

  if (!plane.material.diffuseTexture) {
    plane.material.diffuseTexture = texture;
    plane.material.diffuseTexture.hasAlpha = true;
    plane.material.emissiveTexture = texture;
    plane.material.useAlphaFromDiffuseTexture = true;
  }
  if (!existingObj) {
    plane.metadata = plane.metadata || {};
    plane.metadata.renderContext = { canvas, ctx, texture };
  }

  const scale = opts.scale || 0.3;
  plane.scaling.x = aspect * scale;
  plane.scaling.y = scale;
}

export function updateHUD(gameState) {
  if (!hudGroup.isEnabled()) return;

  // Hearts
  const existingObj = heartsMesh.metadata?.renderContext || null;
  const { texture: ht, aspect: ha, canvas, ctx } = makeHeartsTexture(gameState.health, gameState.maxHealth, existingObj);

  if (!heartsMesh.material.diffuseTexture) {
    heartsMesh.material.diffuseTexture = ht;
    heartsMesh.material.diffuseTexture.hasAlpha = true;
    heartsMesh.material.emissiveTexture = ht;
    heartsMesh.material.useAlphaFromDiffuseTexture = true;
  }
  if (!existingObj) {
    heartsMesh.metadata = heartsMesh.metadata || {};
    heartsMesh.metadata.renderContext = { canvas, ctx, texture: ht };
  }

  heartsMesh.scaling.x = ha * 0.48;
  heartsMesh.scaling.y = 0.48;

  // Kill counter
  const cfg = gameState._levelConfig;
  if (cfg) {
    updatePlaneText(killCountMesh, `${gameState.kills} / ${cfg.killTarget}`, { color: '#ffffff', scale: 0.30 });
  }

  // Level
  updatePlaneText(levelMesh, `LEVEL ${gameState.level}`, { color: '#00ffff', glow: true, glowColor: '#00ffff', scale: 0.30 });

  // Score
  updatePlaneText(scoreMesh, `${gameState.score}`, { color: '#ffff00', scale: 0.26 });

  // Combo
  const combo = gameState._combo || 1;
  if (combo > 1) {
    comboMesh.setEnabled(true);
    updatePlaneText(comboMesh, `${combo}X SCORE MULTIPLIER`, { color: '#ff8800', scale: 0.18 });
  } else {
    comboMesh.setEnabled(false);
  }
}

// ── Level Complete / Transition Text ───────────────────────

export function showLevelComplete(level, playerPos) {
  // Clear old children
  levelTextGroup.getChildren().forEach(c => c.dispose());

  const s1 = makeTextPlane('LEVEL COMPLETE!', { fontSize: 80, color: '#00ffff', glow: true, glowSize: 20, scale: 0.75 });
  s1.position = new BABYLON.Vector3(0, 0.9, 0);
  s1.parent = levelTextGroup;

  const s2 = makeTextPlane(`LEVEL ${level + 1}`, { fontSize: 60, color: '#ff00ff', glow: true, scale: 0.525 });
  s2.position = new BABYLON.Vector3(0, 0.2, 0);
  s2.parent = levelTextGroup;

  levelTextGroup.position = new BABYLON.Vector3(0, 1.6, 5);
  levelTextGroup.rotation.y = Math.PI;
  levelTextGroup.scaling.x = -1;
  levelTextGroup.setEnabled(true);
}

export function hideLevelComplete() {
  levelTextGroup.setEnabled(false);
}

// ── Upgrade Selection Cards ────────────────────────────────

export function showUpgradeCards(upgrades, playerPos, hand) {
  hideAll();
  upgradeGroup.setEnabled(true);
  upgradeCards = [];
  const displayedUpgrades = upgrades.filter(u => u.id !== 'SKIP').slice(0, 3);
  upgradeChoices = displayedUpgrades;
  upgradeGroup.metadata = upgradeGroup.metadata || {};
  upgradeGroup.metadata.hand = hand;

  upgradeGroup.position = new BABYLON.Vector3(0, 1.6, 4);
  upgradeGroup.rotation.y = Math.PI;
  upgradeGroup.scaling.x = -1;

  // Header
  const header = makeTextPlane('CHOOSE UPGRADE:', { fontSize: 48, color: '#ffffff', glow: true, scale: 0.4 });
  header.position = new BABYLON.Vector3(0, 1.6, 0);
  header.parent = upgradeGroup;

  const handName = hand === 'left' ? 'LEFT HAND' : 'RIGHT HAND';
  const handMesh = makeTextPlane(handName, { fontSize: 48, color: '#00ffff', glow: true, glowColor: '#00ffff', scale: 0.4 });
  handMesh.position = new BABYLON.Vector3(0, 1.15, 0);
  handMesh.parent = upgradeGroup;

  // Cooldown text
  const cooldownMesh = makeTextPlane('WAIT...', { fontSize: 36, color: '#ffff00', scale: 0.3 });
  cooldownMesh.position = new BABYLON.Vector3(0, 0.8, 0);
  cooldownMesh.name = 'cooldown';
  cooldownMesh.parent = upgradeGroup;

  // Card positions
  const positions = [
    new BABYLON.Vector3(-2.1, 0, 0),
    new BABYLON.Vector3(-0.7, 0, 0),
    new BABYLON.Vector3(0.7, 0, 0),
    new BABYLON.Vector3(2.1, 0, 0),
  ];

  displayedUpgrades.forEach((upg, i) => {
    const card = createUpgradeCard(upg, positions[i]);
    card.parent = upgradeGroup;
    upgradeCards.push(card);
  });

  // Add SKIP card
  const skipCard = createSkipCard(positions[3]);
  skipCard.parent = upgradeGroup;
  upgradeCards.push(skipCard);
}

function createUpgradeCard(upgrade, position) {
  const group = new BABYLON.TransformNode('card', sceneRef);
  group.position = position;
  group.metadata = group.metadata || {};
  group.metadata.upgradeId = upgrade.id;

  // Card background
  const cardPlane = BABYLON.MeshBuilder.CreatePlane('cardBg', { width: 1.035, height: 1.1 }, sceneRef);
  const cardMat = new BABYLON.StandardMaterial('cardMat', sceneRef);
  cardMat.diffuseColor = new BABYLON.Color3(0.07, 0, 0.2);
  cardMat.backFaceCulling = false;
  cardMat.disableLighting = true;
  cardPlane.material = cardMat;
  cardPlane.metadata = cardPlane.metadata || {};
  cardPlane.metadata.isUpgradeCard = true;
  cardPlane.metadata.upgradeId = upgrade.id;
  cardPlane.parent = group;

  // Border
  const borderColor = upgrade.sideGrade ? new BABYLON.Color3(1, 0.87, 0) : 
    (typeof upgrade.color === 'string' ? hexToColor3(upgrade.color) : (upgrade.color || new BABYLON.Color3(0, 1, 1)));
  const borderLines = createRectBorder(1.035, 1.1);
  const borderSystem = BABYLON.MeshBuilder.CreateLineSystem('cardBorder', { lines: borderLines }, sceneRef);
  borderSystem.color = borderColor;
  borderSystem.position.z = 0.01;
  borderSystem.parent = group;

  // Name
  const nameMesh = makeTextPlane(upgrade.name.toUpperCase(), {
    fontSize: 28,
    color: upgrade.color || '#00ffff',
    glow: true,
    glowColor: upgrade.color,
    scale: 0.19,
  });
  nameMesh.position = new BABYLON.Vector3(0, 0.35, 0.01);
  nameMesh.parent = group;

  // Description
  const descMesh = makeTextPlane(upgrade.desc, {
    fontSize: 20,
    color: '#cccccc',
    scale: 0.15,
    maxWidth: 180,
  });
  descMesh.position = new BABYLON.Vector3(0, -0.05, 0.01);
  descMesh.parent = group;

  // Side-grade note
  if (upgrade.sideGradeNote) {
    const noteMesh = makeTextPlane(upgrade.sideGradeNote, {
      fontSize: 16,
      color: '#ffdd00',
      scale: 0.12,
      maxWidth: 200,
    });
    noteMesh.position = new BABYLON.Vector3(0, -0.22, 0.01);
    noteMesh.parent = group;
  }

  // Icon (octahedron)
  const icon = BABYLON.MeshBuilder.CreatePolyhedron('icon', { type: 1, size: 0.12 }, sceneRef);
  const iconMat = new BABYLON.StandardMaterial('iconMat', sceneRef);
  iconMat.wireframe = true;
  iconMat.emissiveColor = typeof upgrade.color === 'string' ? hexToColor3(upgrade.color) : (upgrade.color || new BABYLON.Color3(0, 1, 1));
  iconMat.disableLighting = true;
  icon.material = iconMat;
  icon.position = new BABYLON.Vector3(0, -0.35, 0.05);
  icon.parent = group;
  group.metadata.iconMesh = icon;

  return group;
}

function createSkipCard(position) {
  const group = new BABYLON.TransformNode('skipCard', sceneRef);
  group.position = position;
  group.metadata = group.metadata || {};
  group.metadata.upgradeId = 'SKIP';

  const cardPlane = BABYLON.MeshBuilder.CreatePlane('skipBg', { width: 0.805, height: 0.9 }, sceneRef);
  const cardMat = new BABYLON.StandardMaterial('skipMat', sceneRef);
  cardMat.diffuseColor = new BABYLON.Color3(0.13, 0, 0.27);
  cardMat.backFaceCulling = false;
  cardMat.disableLighting = true;
  cardPlane.material = cardMat;
  cardPlane.metadata = cardPlane.metadata || {};
  cardPlane.metadata.isUpgradeCard = true;
  cardPlane.metadata.upgradeId = 'SKIP';
  cardPlane.parent = group;

  const borderLines = createRectBorder(0.805, 0.9);
  const borderSystem = BABYLON.MeshBuilder.CreateLineSystem('skipBorder', { lines: borderLines }, sceneRef);
  borderSystem.color = new BABYLON.Color3(0, 1, 0.53);
  borderSystem.position.z = 0.01;
  borderSystem.parent = group;

  const nameMesh = makeTextPlane('SKIP', {
    fontSize: 28,
    color: '#00ff88',
    glow: true,
    glowColor: '#00ff88',
    scale: 0.2,
  });
  nameMesh.position = new BABYLON.Vector3(0, 0.25, 0.01);
  nameMesh.parent = group;

  const descMesh = makeTextPlane('Full health', {
    fontSize: 18,
    color: '#88ffaa',
    scale: 0.12,
    maxWidth: 120,
  });
  descMesh.position = new BABYLON.Vector3(0, -0.02, 0.01);
  descMesh.parent = group;

  const icon = BABYLON.MeshBuilder.CreatePolyhedron('icon', { type: 1, size: 0.08 }, sceneRef);
  const iconMat = new BABYLON.StandardMaterial('iconMat', sceneRef);
  iconMat.wireframe = true;
  iconMat.emissiveColor = new BABYLON.Color3(1, 0, 0.27);
  iconMat.disableLighting = true;
  icon.material = iconMat;
  icon.position = new BABYLON.Vector3(0, -0.25, 0.05);
  icon.parent = group;
  group.metadata.iconMesh = icon;

  return group;
}

function createRectBorder(width, height) {
  const hw = width / 2;
  const hh = height / 2;
  return [
    [new BABYLON.Vector3(-hw, -hh, 0), new BABYLON.Vector3(hw, -hh, 0)],
    [new BABYLON.Vector3(hw, -hh, 0), new BABYLON.Vector3(hw, hh, 0)],
    [new BABYLON.Vector3(hw, hh, 0), new BABYLON.Vector3(-hw, hh, 0)],
    [new BABYLON.Vector3(-hw, hh, 0), new BABYLON.Vector3(-hw, -hh, 0)],
  ];
}

function hexToColor3(hex) {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (result) {
    return new BABYLON.Color3(
      parseInt(result[1], 16) / 255,
      parseInt(result[2], 16) / 255,
      parseInt(result[3], 16) / 255
    );
  }
  return new BABYLON.Color3(0, 1, 1);
}

export function hideUpgradeCards() {
  upgradeGroup.getChildren().forEach(c => c.dispose());
  upgradeGroup.setEnabled(false);
  upgradeCards = [];
  upgradeChoices = [];
}

export function updateUpgradeCards(now, cooldownRemaining) {
  upgradeCards.forEach(card => {
    if (card.metadata?.iconMesh) {
      card.metadata.iconMesh.rotation.y += 0.02;
      card.metadata.iconMesh.rotation.x += 0.01;
    }
  });
}

export function getUpgradeCardHit(ray) {
  const meshes = upgradeCards.map(g => g.getChildren().find(c => c.metadata?.isUpgradeCard)).filter(Boolean);
  
  const pickInfo = sceneRef.pickWithRay(ray, m => meshes.includes(m));
  
  if (pickInfo.hit && pickInfo.pickedMesh) {
    const id = pickInfo.pickedMesh.metadata?.upgradeId;

    if (id === 'SKIP') {
      return { upgrade: { id: 'SKIP', name: 'Skip' }, hand: upgradeGroup.metadata?.hand };
    }

    const upgrade = upgradeChoices.find(u => u.id === id) || null;
    if (upgrade) {
      return { upgrade, hand: upgradeGroup.metadata?.hand };
    }
  }
  return null;
}

// ── Controller Hand Highlights ─────────────────────────────

export function showUpgradeHandHighlight(hand, controllers) {
  // Simplified for Babylon.js port
}

export function hideUpgradeHandHighlights(controllers) {
  // Simplified for Babylon.js port
}

export function updateUpgradeHandHighlights(now) {
  // Handled via scene graph
}

// ── Game Over / Victory ────────────────────────────────────

export function showGameOver(score, playerPos) {
  hideAll();
  gameOverGroup.getChildren().forEach(c => c.dispose());

  const s1 = makeTextPlane('GAME OVER', { fontSize: 120, color: '#ff0044', glow: true, glowSize: 30, scale: 1.4 });
  s1.position = new BABYLON.Vector3(0, 1.2, 0);
  s1.parent = gameOverGroup;

  const s2 = makeTextPlane(`SCORE: ${score}`, { fontSize: 60, color: '#ffff00', glow: true, scale: 0.7 });
  s2.position = new BABYLON.Vector3(0, 0.4, 0);
  s2.parent = gameOverGroup;

  const s3 = makeTextPlane('PRESS TRIGGER TO RESTART', { fontSize: 44, color: '#ffffff', scale: 0.5 });
  s3.position = new BABYLON.Vector3(0, -0.3, 0);
  s3.name = 'restartBlink';
  s3.parent = gameOverGroup;

  gameOverGroup.position = new BABYLON.Vector3(0, 1.6, 5);
  gameOverGroup.rotation.y = Math.PI;
  gameOverGroup.scaling.x = -1;
  gameOverGroup.setEnabled(true);
}

export function showVictory(score, playerPos) {
  hideAll();
  gameOverGroup.getChildren().forEach(c => c.dispose());

  const s1 = makeTextPlane('VICTORY!', { fontSize: 120, color: '#ffff00', glow: true, glowSize: 30, scale: 1.5 });
  s1.position = new BABYLON.Vector3(0, 1.2, 0);
  s1.parent = gameOverGroup;

  const s2 = makeTextPlane(`FINAL SCORE: ${score}`, { fontSize: 60, color: '#00ffff', glow: true, scale: 0.7 });
  s2.position = new BABYLON.Vector3(0, 0.4, 0);
  s2.parent = gameOverGroup;

  const s3 = makeTextPlane('PRESS TRIGGER TO RETURN', { fontSize: 44, color: '#ffffff', scale: 0.5 });
  s3.position = new BABYLON.Vector3(0, -0.3, 0);
  s3.name = 'restartBlink';
  s3.parent = gameOverGroup;

  gameOverGroup.position = new BABYLON.Vector3(0, 1.6, 5);
  gameOverGroup.rotation.y = Math.PI;
  gameOverGroup.scaling.x = -1;
  gameOverGroup.setEnabled(true);
}

export function updateEndScreen(now) {
  const blink = gameOverGroup.getChildren().find(c => c.name === 'restartBlink');
  if (blink) {
    blink.setEnabled(Math.sin(now * 0.004) > -0.15);
  }
}

export function hideGameOver() {
  gameOverGroup.setEnabled(false);
}

// ── Boss Alert ─────────────────────────────────────────────

let bossAlertGroup = null;

export function showBossAlert() {
  if (!bossAlertGroup) {
    bossAlertGroup = new BABYLON.TransformNode('bossAlertGroup', sceneRef);
    
    const alertMesh = makeTextPlane('⚠ ALERT! ALERT! ⚠', {
      fontSize: 64, color: '#ff0044', glow: true, glowColor: '#ff0000', glowSize: 25, scale: 0.7,
    });
    alertMesh.position = new BABYLON.Vector3(0, 0.3, 0);
    alertMesh.name = 'alertLine1';
    alertMesh.parent = bossAlertGroup;

    const incomingMesh = makeTextPlane('INCOMING BOSS!', {
      fontSize: 56, color: '#ffff00', glow: true, glowColor: '#ffff00', glowSize: 20, scale: 0.6,
    });
    incomingMesh.position = new BABYLON.Vector3(0, -0.3, 0);
    incomingMesh.name = 'alertLine2';
    incomingMesh.parent = bossAlertGroup;
  }
  
  bossAlertGroup.position = new BABYLON.Vector3(0, 2.0, 4);
  bossAlertGroup.rotation.y = Math.PI;
  bossAlertGroup.scaling.x = -1;
  bossAlertGroup.setEnabled(true);
}

export function hideBossAlert() {
  if (bossAlertGroup) {
    bossAlertGroup.setEnabled(false);
  }
}

export function updateBossAlert(now) {
  if (!bossAlertGroup || !bossAlertGroup.isEnabled()) return;
  
  const line2 = bossAlertGroup.getChildren().find(c => c.name === 'alertLine2');
  if (line2) {
    line2.setEnabled(Math.sin(now * 0.008) > -0.2);
  }
}

// ── Kills Remaining Message ────────────────────────────────

let killsRemainingGroup = null;

export function showKillsRemainingMessage(count) {
  if (killsRemainingGroup) {
    killsRemainingGroup.dispose();
  }
  
  killsRemainingGroup = new BABYLON.TransformNode('killsRemaining', sceneRef);
  
  const text = `${count} KILLS REMAINING`;
  const mesh = makeTextPlane(text, {
    fontSize: 52, color: '#ffff00', glow: true, glowColor: '#ffff00', glowSize: 15, scale: 0.6,
  });
  mesh.parent = killsRemainingGroup;
  
  killsRemainingGroup.position = new BABYLON.Vector3(0, 2.0, 5);
  killsRemainingGroup.rotation.y = Math.PI;
  killsRemainingGroup.scaling.x = -1;
  killsRemainingGroup.metadata = killsRemainingGroup.metadata || {};
  killsRemainingGroup.metadata.createdAt = performance.now();
  killsRemainingGroup.metadata.lifetime = 2000;
  killsRemainingGroup.setEnabled(true);
}

export function updateKillsRemainingMessage(now) {
  if (!killsRemainingGroup || !killsRemainingGroup.isEnabled()) return;
  
  const age = now - killsRemainingGroup.metadata.createdAt;
  if (age > killsRemainingGroup.metadata.lifetime) {
    killsRemainingGroup.dispose();
    killsRemainingGroup = null;
  } else {
    const fadeStart = killsRemainingGroup.metadata.lifetime - 500;
    if (age > fadeStart) {
      killsRemainingGroup.scaling = new BABYLON.Vector3(1, Math.max(0.6, 1 - (age - fadeStart) / 1000), 1);
    }
  }
}

// ── Hit Flash ──────────────────────────────────────────────

export function triggerHitFlash() {
  hitFlashOpacity = 0.5;
}

export function updateHitFlash(dt) {
  if (hitFlashOpacity > 0) {
    hitFlash.setEnabled(true);
    const pulse = 1 + hitFlashOpacity * 0.15;
    hitFlash.scaling = new BABYLON.Vector3(pulse, pulse, pulse);
    hitFlashOpacity -= dt * 2.5;
  } else {
    hitFlash.setEnabled(false);
  }
}

// ── Damage Numbers ─────────────────────────────────────────

function createDamageNumberEntry() {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  canvas.width = 128;
  canvas.height = 64;

  const texture = new BABYLON.DynamicTexture('dmgTexPooled', canvas, sceneRef);
  texture.hasAlpha = true;

  const plane = BABYLON.MeshBuilder.CreatePlane('dmgNumPooled', { width: 1, height: 1 }, sceneRef);
  const mat = new BABYLON.StandardMaterial('dmgMatPooled', sceneRef);
  configureAlphaTestMaterial(mat, texture);
  plane.material = mat;
  plane.renderingGroupId = 1;
  plane.setEnabled(false);

  const entry = { plane, canvas, ctx, texture, inUse: false };
  plane.metadata = plane.metadata || {};
  plane.metadata.poolEntry = entry;
  damageNumberPool.push(entry);
  return entry;
}

function releaseDamageNumberMesh(plane) {
  const entry = plane.metadata?.poolEntry;
  if (!entry) {
    plane.dispose();
    return;
  }

  entry.inUse = false;
  plane.setEnabled(false);
  plane.isVisible = false;
  plane.position.copyFromFloats(0, -1000, 0);
}

function acquireDamageNumberEntry() {
  let entry = damageNumberPool.find(e => !e.inUse);

  if (!entry && damageNumberPool.length < DAMAGE_NUMBER_POOL_SIZE) {
    entry = createDamageNumberEntry();
  }

  if (!entry) {
    // Reclaim the oldest pooled plane.
    const recycledPlane = damageNumbers.find(p => p.metadata?.poolEntry);
    if (recycledPlane) {
      const idx = damageNumbers.indexOf(recycledPlane);
      if (idx !== -1) damageNumbers.splice(idx, 1);
      releaseDamageNumberMesh(recycledPlane);
      entry = recycledPlane.metadata.poolEntry;
    }
  }

  if (!entry) {
    entry = createDamageNumberEntry();
  }

  entry.inUse = true;
  entry.plane.setEnabled(true);
  entry.plane.isVisible = true;
  return entry;
}

export function spawnDamageNumber(position, damage, color, isCrit = false) {
  const entry = acquireDamageNumberEntry();
  const { plane, ctx, texture } = entry;
  const canvas = entry.canvas;
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  const fontSize = isCrit
    ? Math.min(48, 28 + damage / 6) * 2
    : Math.min(48, 28 + damage / 6);
  ctx.font = `bold ${fontSize}px Arial, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  ctx.fillStyle = 'rgba(0,0,0,0.7)';
  ctx.fillText(Math.round(damage).toString(), 66, 34);

  const displayColor = isCrit ? '#ffff00' : (color || '#ffffff');
  ctx.fillStyle = displayColor;
  ctx.fillText(Math.round(damage).toString(), 64, 32);
  texture.update();

  const scale = isCrit
    ? (0.25 + Math.min(damage / 100, 0.15)) * 2
    : (0.25 + Math.min(damage / 100, 0.15));
  plane.scaling = new BABYLON.Vector3(scale * 2, scale, 1);
  
  plane.position = position.clone();
  plane.position.x += (Math.random() - 0.5) * 0.3;
  plane.position.y += Math.random() * 0.2;
  plane.position.z += (Math.random() - 0.5) * 0.3;
  plane.billboardMode = BABYLON.Mesh.BILLBOARDMODE_ALL;

  plane.renderingGroupId = 1;

  plane.metadata = plane.metadata || {};
  plane.metadata.velocity = new BABYLON.Vector3(
    (Math.random() - 0.5) * 0.5,
    0.8 + Math.random() * 0.5,
    (Math.random() - 0.5) * 0.5,
  );
  plane.metadata.lifetime = 500;
  plane.metadata.createdAt = performance.now();

  damageNumbers.push(plane);

  if (isCrit) {
    spawnCritLabel(position);
  }

  while (damageNumbers.length > DAMAGE_NUMBER_POOL_SIZE) {
    const old = damageNumbers.shift();
    releaseDamageNumberMesh(old);
  }
}

function spawnCritLabel(position) {
  const entry = acquireDamageNumberEntry();
  const { plane, ctx, texture } = entry;
  const canvas = entry.canvas;
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  ctx.font = 'bold 36px Arial, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  ctx.fillStyle = 'rgba(0,0,0,0.7)';
  ctx.fillText('CRIT!', 66, 26);

  ctx.fillStyle = '#ff4400';
  ctx.fillText('CRIT!', 64, 24);
  texture.update();

  const scale = 0.3;
  plane.scaling = new BABYLON.Vector3(scale * 2, scale, 1);
  
  plane.position = position.clone();
  plane.position.x += (Math.random() - 0.5) * 0.2;
  plane.position.y += 0.4 + Math.random() * 0.2;
  plane.position.z += (Math.random() - 0.5) * 0.2;
  plane.billboardMode = BABYLON.Mesh.BILLBOARDMODE_ALL;

  plane.renderingGroupId = 1;

  plane.metadata = plane.metadata || {};
  plane.metadata.velocity = new BABYLON.Vector3(
    (Math.random() - 0.5) * 0.3,
    0.6 + Math.random() * 0.3,
    (Math.random() - 0.5) * 0.3,
  );
  plane.metadata.lifetime = 600;
  plane.metadata.createdAt = performance.now();

  damageNumbers.push(plane);
}

export function updateDamageNumbers(dt, now) {
  for (let i = damageNumbers.length - 1; i >= 0; i--) {
    const plane = damageNumbers[i];
    const age = now - plane.metadata.createdAt;

    if (age > plane.metadata.lifetime) {
      releaseDamageNumberMesh(plane);
      damageNumbers.splice(i, 1);
    } else {
      plane.position.addInPlace(plane.metadata.velocity.scale(dt));
      plane.metadata.velocity.y -= dt * 1.5;
    }
  }
}

export function spawnOuchBubble(position, text = 'OUCH!') {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  canvas.width = 256;
  canvas.height = 128;

  ctx.fillStyle = text.includes('STREAK') ? '#00ff44' : '#ffff00';
  ctx.strokeStyle = '#000000';
  ctx.lineWidth = 6;

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

  const texture = new BABYLON.DynamicTexture('ouchTex', canvas, sceneRef);
  texture.hasAlpha = true;

  const plane = BABYLON.MeshBuilder.CreatePlane('ouchBubble', { width: 1.5, height: 0.75 }, sceneRef);
  const mat = new BABYLON.StandardMaterial('ouchMat', sceneRef);
  mat.diffuseTexture = texture;
  mat.diffuseTexture.hasAlpha = true;
  mat.emissiveTexture = texture;
  mat.backFaceCulling = false;
  mat.disableLighting = true;
  mat.useAlphaFromDiffuseTexture = true;
  plane.material = mat;
  
  plane.position = position.clone();
  plane.position.y += 1.0;
  plane.position.z += 0.5;
  plane.billboardMode = BABYLON.Mesh.BILLBOARDMODE_ALL;
  plane.renderingGroupId = 1;
  plane.metadata = plane.metadata || {};
  plane.metadata.createdAt = performance.now();
  plane.metadata.lifetime = 800;

  damageNumbers.push(plane);

  while (damageNumbers.length > 5) {
    const old = damageNumbers.shift();
    old.dispose();
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
  ctx.font = 'bold 72px Arial, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  ctx.fillStyle = 'rgba(0,0,0,0.8)';
  ctx.fillText(text, 258, 66);

  ctx.fillStyle = '#ffaa00';
  ctx.fillText(text, 256, 64);

  const texture = new BABYLON.DynamicTexture('comboTex', canvas, sceneRef);
  texture.hasAlpha = true;

  const scale = 0.8;
  const width = scale * 4;
  const height = scale;

  const plane = BABYLON.MeshBuilder.CreatePlane('comboPopup', { width, height }, sceneRef);
  const mat = new BABYLON.StandardMaterial('comboMat', sceneRef);
  mat.diffuseTexture = texture;
  mat.diffuseTexture.hasAlpha = true;
  mat.emissiveTexture = texture;
  mat.backFaceCulling = false;
  mat.disableLighting = true;
  mat.useAlphaFromDiffuseTexture = true;
  plane.material = mat;

  plane.position = cameraPos.clone();
  plane.position.y += 0.8;
  plane.position.z -= 2.5;
  plane.billboardMode = BABYLON.Mesh.BILLBOARDMODE_ALL;

  plane.metadata = plane.metadata || {};
  plane.metadata.createdAt = performance.now();
  plane.metadata.lifetime = 2000;
  plane.metadata.velocity = new BABYLON.Vector3(0, 0.3, 0);
  plane.renderingGroupId = 1;

  comboPopups.push(plane);
}

export function updateComboPopups(dt, now) {
  for (let i = comboPopups.length - 1; i >= 0; i--) {
    const popup = comboPopups[i];
    const age = now - popup.metadata.createdAt;

    if (age > popup.metadata.lifetime) {
      popup.dispose();
      comboPopups.splice(i, 1);
    } else {
      popup.position.addInPlace(popup.metadata.velocity.scale(dt));
      const fadeStart = popup.metadata.lifetime - 500;
      if (age > fadeStart) {
        const scale = Math.max(0.7, 1 - (age - fadeStart) / 1000);
        popup.scaling = new BABYLON.Vector3(scale, scale, scale);
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

// ── FPS Counter ────────────────────────────────────────────
let fpsFrames = [];
let lastFpsUpdate = 0;

export function updateFPS(now, opts = {}) {
  if (!fpsMesh) return;

  const perfMonitor = opts.perfMonitor || (typeof window !== 'undefined' && window.debugPerfMonitor);

  fpsFrames.push(now);
  while (fpsFrames.length > 0 && fpsFrames[0] < now - 1000) {
    fpsFrames.shift();
  }

  if (now - lastFpsUpdate > 250) {
    const fps = Math.round(fpsFrames.length);
    
    let text = `FPS: ${fps}`;
    if (perfMonitor && sceneRef) {
      const activeMeshes = sceneRef.getActiveMeshes().length;
      const activeParticles = typeof sceneRef.getActiveParticles === 'function' ? sceneRef.getActiveParticles() : 0;
      const totalVertices = sceneRef.getTotalVertices();
      const drawCalls = opts.engine?.drawCallsLast ?? opts.engine?.drawCalls ?? 0;
      const timeScale = (typeof window !== 'undefined' && window._timeScale) ? window._timeScale.toFixed(2) : '1.00';
      text = `FPS: ${fps}\nMeshes: ${activeMeshes}\nParticles: ${activeParticles}\nVerts: ${totalVertices}\nDraw: ${drawCalls}\nTimeScale: ${timeScale}`;
    }
    const fpsColor = fps < 30 ? '#ff0000' : fps < 60 ? '#ffff00' : '#00ff00';

    const existingObj = fpsMesh.metadata?.renderContext || null;
    const { texture, aspect } = makeTextTexture(text, {
      fontSize: perfMonitor ? 24 : 32,
      color: fpsColor,
      shadow: true,
    }, existingObj);

    if (!fpsMesh.material.diffuseTexture) {
      fpsMesh.material.diffuseTexture = texture;
      fpsMesh.material.diffuseTexture.hasAlpha = true;
      fpsMesh.material.emissiveTexture = texture;
      fpsMesh.material.useAlphaFromDiffuseTexture = true;
    }
    
    fpsMesh.scaling.x = aspect * 0.15;
    fpsMesh.scaling.y = 0.15;
    fpsMesh.setEnabled(true);
    lastFpsUpdate = now;
  }
}

// ── Helpers ────────────────────────────────────────────────

function hideAll() {
  if (titleGroup) titleGroup.setEnabled(false);
  if (levelTextGroup) levelTextGroup.setEnabled(false);
  if (upgradeGroup) upgradeGroup.setEnabled(false);
  if (gameOverGroup) gameOverGroup.setEnabled(false);
  if (nameEntryGroup) nameEntryGroup.setEnabled(false);
  if (scoreboardGroup) scoreboardGroup.setEnabled(false);
  if (countrySelectGroup) countrySelectGroup.setEnabled(false);
}

// ── Title Scoreboard Button Hit ─────────────────────────────

export function getTitleButtonHit(ray) {
  if (!titleScoreboardBtn || !titleGroup.isEnabled()) return null;
  
  const pickInfo = sceneRef.pickWithRay(ray, m => m === titleScoreboardBtn);
  
  if (pickInfo.hit) return 'scoreboard';
  return null;
}

// ── Name Entry Screen (simplified) ──────────────────────────

export function showNameEntry(score, level, storedName) {
  hideAll();
  nameEntryGroup.getChildren().forEach(c => c.dispose());
  nameEntrySlots = [];
  keyboardKeys = [];
  hoveredKey = null;
  nameEntryName = storedName || '';
  nameEntryCursor = nameEntryName.length;

  nameEntryGroup.position = new BABYLON.Vector3(0, 1.6, 4);
  nameEntryGroup.rotation.y = Math.PI;
  nameEntryGroup.scaling.x = -1;
  nameEntryGroup.setEnabled(true);

  const header = makeTextPlane('ENTER YOUR NAME', {
    fontSize: 60, color: '#00ffff', glow: true, glowColor: '#00ffff', scale: 0.6,
  });
  header.position = new BABYLON.Vector3(0, 1.4, 0);
  header.parent = nameEntryGroup;

  const scoreText = makeTextPlane(`SCORE: ${score}  LEVEL: ${level}`, {
    fontSize: 40, color: '#ffff00', scale: 0.4,
  });
  scoreText.position = new BABYLON.Vector3(0, 1.05, 0);
  scoreText.parent = nameEntryGroup;

  // Simplified: just show text input prompt
  const promptText = makeTextPlane('Type your name and press ENTER', {
    fontSize: 36, color: '#ffffff', scale: 0.35,
  });
  promptText.position = new BABYLON.Vector3(0, 0.5, 0);
  promptText.parent = nameEntryGroup;
}

export function hideNameEntry() {
  nameEntryGroup.setEnabled(false);
}

export function getNameEntryName() {
  return nameEntryName;
}

export function getKeyboardHit(ray) {
  return null; // Simplified for port
}

export function updateKeyboardHover(ray) {
  // Simplified for port
}

// ── Scoreboard Screen (simplified) ──────────────────────────

export function showScoreboard(scores, headerText, opts = null) {
  hideAll();
  scoreboardGroup.getChildren().forEach(c => c.dispose());

  scoreboardScores = scores;
  scoreboardScrollOffset = 0;
  scoreboardGroup.position = new BABYLON.Vector3(0, 1.6, 5);
  scoreboardGroup.rotation.y = Math.PI;
  scoreboardGroup.scaling.x = -1;
  scoreboardGroup.setEnabled(true);

  const header = makeTextPlane(headerText || 'GLOBAL LEADERBOARD', {
    fontSize: 60, color: '#00ffff', glow: true, glowColor: '#00ffff', scale: 0.6,
  });
  header.position = new BABYLON.Vector3(0, 1.8, 0);
  header.parent = scoreboardGroup;

  // Score list
  const scoreTexts = scores.slice(0, 10).map((s, i) => 
    `#${i + 1} ${s.name || 'ANONYMOUS'} - ${s.score?.toLocaleString() || '0'} L${s.level_reached || '?'}`
  ).join('\n');

  if (scoreTexts) {
    const listMesh = makeTextPlane(scoreTexts, {
      fontSize: 28, color: '#ffffff', scale: 0.35, maxWidth: 400,
    });
    listMesh.position = new BABYLON.Vector3(0, 0.5, 0);
    listMesh.parent = scoreboardGroup;
  }

  // Back button
  const backPlane = BABYLON.MeshBuilder.CreatePlane('backBtn', { width: 0.6, height: 0.25 }, sceneRef);
  const backMat = new BABYLON.StandardMaterial('backMat', sceneRef);
  backMat.diffuseColor = new BABYLON.Color3(0.2, 0, 0);
  backMat.backFaceCulling = false;
  backMat.disableLighting = true;
  backPlane.material = backMat;
  backPlane.position = new BABYLON.Vector3(0, -0.95, 0);
  backPlane.metadata = backPlane.metadata || {};
  backPlane.metadata.scoreboardAction = 'back';
  backPlane.parent = scoreboardGroup;

  const backText = makeTextPlane('BACK', { fontSize: 28, color: '#ff4444', scale: 0.15 });
  backText.position = new BABYLON.Vector3(0, -0.95, 0.01);
  backText.parent = scoreboardGroup;
}

export function hideScoreboard() {
  scoreboardGroup.setEnabled(false);
}

export function getScoreboardHit(ray) {
  if (!scoreboardGroup.isEnabled()) return null;
  
  const pickInfo = sceneRef.pickWithRay(ray, m => m.metadata?.scoreboardAction);
  
  if (pickInfo.hit && pickInfo.pickedMesh) {
    return pickInfo.pickedMesh.metadata.scoreboardAction;
  }
  return null;
}

export function updateScoreboardScroll(delta) {
  // Simplified for port
}

// ── Country Select Screen (simplified) ──────────────────────

export function showCountrySelect(countries, continents, initialContinent) {
  hideAll();
  countrySelectGroup.getChildren().forEach(c => c.dispose());
  countrySelectContinent = initialContinent || 'North America';

  countrySelectGroup.position = new BABYLON.Vector3(0, 1.6, 4);
  countrySelectGroup.rotation.y = Math.PI;
  countrySelectGroup.scaling.x = -1;
  countrySelectGroup.setEnabled(true);

  const header = makeTextPlane('SELECT YOUR COUNTRY', {
    fontSize: 60, color: '#00ffff', glow: true, glowColor: '#00ffff', scale: 0.6,
  });
  header.position = new BABYLON.Vector3(0, 1.6, 0);
  header.parent = countrySelectGroup;

  // Simplified country list
  const filtered = countries.filter(c => c.continent === countrySelectContinent);
  const countryText = filtered.slice(0, 10).map(c => `${c.flag} ${c.name}`).join('\n');

  const listMesh = makeTextPlane(countryText, {
    fontSize: 28, color: '#ffffff', scale: 0.3, maxWidth: 300,
  });
  listMesh.position = new BABYLON.Vector3(0, 0.5, 0);
  listMesh.parent = countrySelectGroup;
}

export function hideCountrySelect() {
  countrySelectGroup.setEnabled(false);
}

export function getCountrySelectHit(ray, countries) {
  if (!countrySelectGroup.isEnabled()) return null;
  return null; // Simplified for port
}
