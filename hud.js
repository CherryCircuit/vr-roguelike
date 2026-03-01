// ============================================================
//  HUD, TITLE SCREEN, MENUS, DAMAGE NUMBERS
//  All in-VR UI elements rendered as 3D objects.
// ============================================================

import * as THREE from 'three';
import { State } from './game.js';

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

// HUD element references
let heartsSprite = null;
let killCountSprite = null;
let levelSprite = null;
let scoreSprite = null;
let comboSprite = null;
let fpsSprite = null;

// [Instruction 1] Alt weapon cooldown indicators (per hand)
let altWeaponIndicators = { left: null, right: null };

// Damage numbers
const damageNumbers = [];

// Upgrade card meshes (for raycasting)
let upgradeCards = [];
let upgradeChoices = [];

// Hit flash (red sphere inside camera)
let hitFlash = null;
let hitFlashOpacity = 0;

// Boss health bar (world-space, floats above boss head)
// [Power Outage Update] #4: Changed from camera-attached 3 segments
let bossHealthGroup = null;
let bossHealthFillBar = null; // Single continuous fill bar
let bossHealthBars = []; // Kept for backwards compatibility (now empty)

// Title blink
let titleBlinkSprite = null;

// Title scoreboard button
let titleScoreboardBtn = null;
let titleScoreboardBtnData = null;

// Name entry state
let nameEntryName = '';
let nameEntryCursor = 0;
let nameEntrySlots = [];
let keyboardKeys = [];
let hoveredKey = null;

// Scoreboard state
let scoreboardCanvas = null;
let scoreboardTexture = null;
let scoreboardMesh = null;
let scoreboardScrollOffset = 0;
let scoreboardScores = [];
let scoreboardHeader = '';

// Country select state
let countryListCanvas = null;
let countryListTexture = null;
let countryListMesh = null;
let countrySelectContinent = 'North America';
let countrySelectScrollOffset = 0;
let continentTabs = [];
let countryItems = [];

// ── Button Hover System ───────────────────────────────────────
const hoverableButtons = [];
let lastHoveredButton = null;
let hoverSoundCooldown = 0;
const HOVER_SCALE_MULT = 1.15;
const HOVER_LERP_SPEED = 8.0;

export function registerHoverableButton(buttonData) {
  hoverableButtons.push(buttonData);
}

export function clearHoverableButtons() {
  hoverableButtons.length = 0;
  lastHoveredButton = null;
}

export function updateAllButtonHovers(raycaster, now, dt, playHoverSound, playClickSound) {
  if (hoverSoundCooldown > 0) hoverSoundCooldown -= dt * 1000;
  
  // Find hit
  let hitButton = null;
  const meshes = hoverableButtons.map(b => b.mesh).filter(Boolean);
  const hits = raycaster.intersectObjects(meshes, false);
  
  if (hits.length > 0) {
    hitButton = hoverableButtons.find(b => b.mesh === hits[0].object);
  }
  
  // Update all buttons
  hoverableButtons.forEach(btn => {
    const isHovered = btn === hitButton;
    const targetScale = isHovered ? HOVER_SCALE_MULT : 1.0;
    
    // Ease-out lerp (deceleration)
    if (btn.currentScale === undefined) btn.currentScale = 1.0;
    const lerpFactor = 1 - Math.exp(-HOVER_LERP_SPEED * dt);
    btn.currentScale += (targetScale - btn.currentScale) * lerpFactor;
    
    // Apply scale to group
    if (btn.group) {
      btn.group.scale.setScalar(btn.currentScale);
    }
    
    // Color change on hover
    if (btn.baseColor !== undefined && btn.mat) {
      if (isHovered) {
        const brightColor = new THREE.Color(btn.baseColor).multiplyScalar(1.3);
        btn.mat.color.copy(brightColor);
      } else {
        btn.mat.color.setHex(btn.baseColor);
      }
    }
    
    // Highlight border (thin white line, slightly offset)
    if (btn.highlightBorder) {
      btn.highlightBorder.visible = isHovered;
      if (isHovered) {
        btn.highlightBorder.material.opacity = 0.5 + Math.sin(now * 0.005) * 0.3;
      }
    }
  });
  
  // Hover enter sound
  if (hitButton && hitButton !== lastHoveredButton && hoverSoundCooldown <= 0) {
    if (playHoverSound) playHoverSound();
    hoverSoundCooldown = 100;
  }
  
  lastHoveredButton = hitButton;
  
  return hitButton;
}

// Helper to create highlight border for a button (thicker border)
function createHighlightBorder(geo, gap = 0.025) {
  const scale = 1 + gap * 2;
  const highlightGeo = new THREE.EdgesGeometry(
    new THREE.PlaneGeometry(
      geo.parameters.width * scale + 0.05,
      geo.parameters.height * scale + 0.05
    )
  );
  const highlightMat = new THREE.LineBasicMaterial({
    color: 0xffffff,
    transparent: true,
    opacity: 0,
  });
  return new THREE.LineSegments(highlightGeo, highlightMat);
}

// ── Canvas text utility ────────────────────────────────────
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
    ctx.clearRect(0, 0, canvas.width, canvas.height); // Clear if size didn't change
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
    texture.image = canvas;
    texture.needsUpdate = true;
  } else {
    texture = new THREE.CanvasTexture(canvas);
    texture.minFilter = THREE.LinearFilter;
  }

  return { texture, aspect: canvas.width / canvas.height, canvas, ctx };
}

function makeSprite(text, opts = {}) {
  // Initial creation - no existing object
  const { texture, aspect, canvas, ctx } = makeTextTexture(text, opts);

  // Use PlaneGeometry instead of Sprite to prevent billboarding
  const scale = opts.scale || 0.3;
  const width = aspect * scale;
  const height = scale;

  const geometry = new THREE.PlaneGeometry(1, 1); // Unit quad
  const mat = new THREE.MeshBasicMaterial({
    map: texture,
    transparent: true,
    opacity: opts.opacity ?? 1,
    depthTest: opts.depthTest ?? false,
    depthWrite: false,
    side: THREE.DoubleSide,
  });

  const mesh = new THREE.Mesh(geometry, mat);
  mesh.scale.set(width, height, 1);
  mesh.renderOrder = opts.renderOrder ?? 999;

  // Store rendering context for reuse
  mesh.userData.renderContext = { canvas, ctx, texture };

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
    texture.image = canvas;
    texture.needsUpdate = true;
  } else {
    texture = new THREE.CanvasTexture(canvas);
    texture.minFilter = THREE.LinearFilter;
  }

  return { texture, aspect: canvas.width / canvas.height, canvas, ctx };
}

// ── Public API ─────────────────────────────────────────────

export function initHUD(camera, scene) {
  sceneRef = scene;
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
  gameOverGroup.rotation.set(0, 0, 0);
  scene.add(gameOverGroup);

  // ── Name entry (world-space) ──
  nameEntryGroup.visible = false;
  nameEntryGroup.rotation.set(0, 0, 0);
  scene.add(nameEntryGroup);

  // ── Scoreboard (world-space) ──
  scoreboardGroup.visible = false;
  scoreboardGroup.rotation.set(0, 0, 0);
  scene.add(scoreboardGroup);

  // ── Country select (world-space) ──
  countrySelectGroup.visible = false;
  countrySelectGroup.rotation.set(0, 0, 0);
  scene.add(countrySelectGroup);

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
  fpsSprite = makeSprite('FPS: 0', { fontSize: 36, color: '#00ff00', shadow: true, scale: 0.2 });
  fpsSprite.position.set(-0.35, 0.2, -0.5);  // Top left of view, more centered
  fpsSprite.renderOrder = 1001;
  // Discard transparent pixels so the plane doesn't render as a dark box in VR
  fpsSprite.material.alphaTest = 0.05;
  fpsSprite.material.depthTest = false;  // Always render on top
  camera.add(fpsSprite);

  // [Power Outage Update] #4: Boss health bar - now world-space, floats above boss head
  // Single continuous bar instead of 3 segments
  bossHealthGroup = new THREE.Group();
  bossHealthGroup.visible = false;
  
  // Background bar (dark)
  const bossBarWidth = 1.5;
  const bossBarHeight = 0.08;
  const bgBarGeo = new THREE.PlaneGeometry(bossBarWidth, bossBarHeight);
  const bgBarMat = new THREE.MeshBasicMaterial({ 
    color: 0x224422, 
    side: THREE.DoubleSide, 
    depthTest: false,
    transparent: true,
    opacity: 0.8
  });
  const bgBar = new THREE.Mesh(bgBarGeo, bgBarMat);
  bgBar.name = 'bossHealthBg';
  bossHealthGroup.add(bgBar);
  
  // Fill bar (foreground, scales with HP)
  const fillBarGeo = new THREE.PlaneGeometry(bossBarWidth, bossBarHeight);
  const fillBarMat = new THREE.MeshBasicMaterial({ 
    color: 0x00ff44, 
    side: THREE.DoubleSide, 
    depthTest: false 
  });
  bossHealthFillBar = new THREE.Mesh(fillBarGeo, fillBarMat);
  bossHealthFillBar.name = 'bossHealthFill';
  bossHealthFillBar.position.z = 0.01;
  bossHealthGroup.add(bossHealthFillBar);
  
  scene.add(bossHealthGroup);
}

// [Power Outage Update] #4: Updated for world-space bar above boss
export function showBossHealthBar(hp, maxHp, phases = 3) {
  if (!bossHealthGroup) return;
  bossHealthGroup.visible = true;
  // Store for positioning in update
  bossHealthGroup.userData.maxHp = maxHp;
  bossHealthGroup.userData.phases = phases;
}

export function hideBossHealthBar() {
  if (bossHealthGroup) bossHealthGroup.visible = false;
}

// [Power Outage Update] #4: Updated - single continuous bar, color transitions
export function updateBossHealthBar(hp, maxHp, phases = 3, bossMesh = null) {
  if (!bossHealthGroup || !bossHealthGroup.visible) return;
  
  const t = Math.max(0, Math.min(1, hp / maxHp)); // 0..1
  const barWidth = 1.5;
  
  // Scale fill bar
  if (bossHealthFillBar) {
    bossHealthFillBar.scale.x = Math.max(0.001, t);
    // Position so it drains from right to left
    bossHealthFillBar.position.x = -(1 - t) * barWidth / 2;
    
    // Color transition: green → yellow → red → dark red
    const color = new THREE.Color();
    if (t > 0.5) {
      color.setHex(0x00ff44).lerp(new THREE.Color(0xffff00), (1 - (t - 0.5) * 2));
    } else if (t > 0.25) {
      color.setHex(0xffff00).lerp(new THREE.Color(0xff2200), (1 - (t - 0.25) * 4));
    } else {
      color.setHex(0xff2200).lerp(new THREE.Color(0x880000), (1 - t * 4));
    }
    bossHealthFillBar.material.color.copy(color);
  }
  
  // Position above boss if mesh provided
  if (bossMesh) {
    bossHealthGroup.position.copy(bossMesh.position);
    bossHealthGroup.position.y += 1.2;
    // Billboard: always face camera
    if (cameraRef) {
      bossHealthGroup.lookAt(cameraRef.position);
    }
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
  
  // Highlight border for hover
  const btnHighlightBorder = createHighlightBorder(btnGeo, 0.02);
  btnHighlightBorder.position.z = 0.02;
  btnHighlightBorder.visible = false;
  btnGroup.add(btnHighlightBorder);
  
  const btnText = makeSprite('SCOREBOARD', {
    fontSize: 36,
    color: '#ffff00',
    glow: true,
    glowColor: '#ffff00',
    scale: 0.25,
  });
  btnText.position.set(0, 0, 0.01);
  btnGroup.add(btnText);
  titleGroup.add(btnGroup);
  titleScoreboardBtn = btnMesh;
  
  // Register title scoreboard button as hoverable
  titleScoreboardBtnData = {
    mesh: btnMesh,
    group: btnGroup,
    mat: btnMat,
    baseColor: 0x110033,
    currentScale: 1.0,
    highlightBorder: btnHighlightBorder,
  };

  // Version number
  const versionDate = 'FEB 11 2026   12:00AM PT';
  const versionNum = 'v0.045';
  const versionSprite = makeSprite(`${versionNum}\nLAST UPDATED: ${versionDate}`, {
    fontSize: 32,
    color: '#888888',
    scale: 0.28,
  });
  versionSprite.position.set(0, -1.0, 0);
  titleGroup.add(versionSprite);
}

export function showTitle() {
  titleGroup.visible = true;
  hudGroup.visible = false;
  
  // Register title scoreboard button as hoverable
  clearHoverableButtons();
  if (titleScoreboardBtnData) {
    registerHoverableButton(titleScoreboardBtnData);
  }
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
  // Lives (hearts) - left side on floor
  // Use PlaneGeometry (not Sprite) to prevent billboarding/rotation
  const heartsGeo = new THREE.PlaneGeometry(1, 1); // Unit quad
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
  // Reuse existing render context if available
  const existingObj = sprite.userData.renderContext || null;

  const { texture, aspect, canvas, ctx } = makeTextTexture(text, {
    fontSize: opts.fontSize || 40,
    color: opts.color || '#ffffff',
    shadow: true,
    glow: opts.glow,
    glowColor: opts.glowColor,
  }, existingObj);

  if (!sprite.material.map) {
    sprite.material.map = texture;
  }
  // Store context back if it was newly created
  if (!existingObj) {
    sprite.userData.renderContext = { canvas, ctx, texture };
  }

  // Update scale to match aspect ratio (prevents stretching)
  const scale = opts.scale || 0.3;
  sprite.scale.set(aspect * scale, scale, 1);
}

export function updateHUD(gameState) {
  if (!hudGroup.visible) return;

  // Hearts - proper aspect ratio with correct scale
  const existingObj = heartsSprite.userData.renderContext || null;
  const { texture: ht, aspect: ha, canvas, ctx } = makeHeartsTexture(gameState.health, gameState.maxHealth, existingObj);

  if (!heartsSprite.material.map) {
    heartsSprite.material.map = ht;
  }
  if (!existingObj) {
    heartsSprite.userData.renderContext = { canvas, ctx, texture: ht };
  }

  // Update scale (200% larger: height 0.48)
  heartsSprite.scale.set(ha * 0.48, 0.48, 1);

  // Kill counter - 200% larger
  const cfg = gameState._levelConfig;
  if (cfg) {
    updateSpriteText(killCountSprite, `${gameState.kills} / ${cfg.killTarget}`, { color: '#ffffff', scale: 0.30 });
  }

  // Level - 200% larger
  updateSpriteText(levelSprite, `LEVEL ${gameState.level}`, { color: '#00ffff', glow: true, glowColor: '#00ffff', scale: 0.30 });

  // Score - 200% larger
  updateSpriteText(scoreSprite, `${gameState.score}`, { color: '#ffff00', scale: 0.26 });

  // Combo - 200% larger with descriptive label
  const combo = gameState._combo || 1;
  if (combo > 1) {
    comboSprite.visible = true;
    updateSpriteText(comboSprite, `${combo}X SCORE MULTIPLIER`, { color: '#ff8800', scale: 0.18 });
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

  // Clear hoverable buttons for fresh registration
  clearHoverableButtons();

  // Fixed world position in front of spawn
  upgradeGroup.position.set(0, 1.6, -4);

  // "Choose an upgrade for [HAND]" header - separated into two lines, centered
  const header = makeSprite('CHOOSE UPGRADE:', { fontSize: 48, color: '#ffffff', glow: true, scale: 0.4 });
  header.position.set(0, 1.6, 0);
  upgradeGroup.add(header);

  const handName = hand === 'left' ? 'LEFT HAND' : 'RIGHT HAND';
  const handSprite = makeSprite(handName, { fontSize: 48, color: '#00ffff', glow: true, glowColor: '#00ffff', scale: 0.4 });
  handSprite.position.set(0, 1.15, 0);
  upgradeGroup.add(handSprite);

  // Cooldown text
  const cooldownSprite = makeSprite('WAIT...', { fontSize: 36, color: '#ffff00', scale: 0.3 });
  cooldownSprite.position.set(0, 0.8, 0);
  cooldownSprite.name = 'cooldown';
  upgradeGroup.add(cooldownSprite);

  // Four cards in an arc (3 upgrades + 1 skip option)
  // [Power Outage Update] #5: Wider card spacing for 15% wider cards
  const positions = [
    new THREE.Vector3(-2.1, 0, 0),
    new THREE.Vector3(-0.7, 0, 0),
    new THREE.Vector3(0.7, 0, 0),
    new THREE.Vector3(2.1, 0, 0),
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
  // [Power Outage Update] #5: Widened by 15% (0.9 * 1.15 = 1.035)
  const cardGeo = new THREE.PlaneGeometry(1.035, 1.1);
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

  // Highlight border for hover
  const highlightBorder = createHighlightBorder(cardGeo, 0.02);
  highlightBorder.position.z = 0.02;
  highlightBorder.visible = false;
  group.add(highlightBorder);

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

  // NEW WEAPON badge for side-grades
  if (upgrade.sideGrade) {
    const badge = makeSprite("⚡ NEW WEAPON ⚡", {
      fontSize: 18,
      color: '#ffdd00',
      glow: true,
      glowColor: '#ffdd00',
      scale: 0.12
    });
    badge.position.set(0, 0.52, 0.01);
    group.add(badge);
  }
  group.add(iconMesh);
  group.userData.iconMesh = iconMesh;

  // Register as hoverable
  registerHoverableButton({
    mesh: card,
    group: group,
    mat: cardMat,
    baseColor: 0x110033,
    currentScale: 1.0,
    highlightBorder: highlightBorder,
  });

  return group;
}

function createSkipCard(position) {
  const group = new THREE.Group();
  group.position.copy(position);
  group.userData.upgradeId = 'SKIP';  // Special ID for skip

  // [Power Outage Update] #5: Widened by 15% to match upgrade cards
  // Smaller card (0.7×0.9 scaled by 1.15 ≈ 0.805)
  const cardGeo = new THREE.PlaneGeometry(0.805, 0.9);
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

  // Highlight border for hover
  const highlightBorder = createHighlightBorder(cardGeo, 0.02);
  highlightBorder.position.z = 0.02;
  highlightBorder.visible = false;
  group.add(highlightBorder);

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

  // Register as hoverable
  registerHoverableButton({
    mesh: card,
    group: group,
    mat: cardMat,
    baseColor: 0x220044,
    currentScale: 1.0,
    highlightBorder: highlightBorder,
  });

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
      const { texture } = makeTextTexture(
        `WAIT ${Math.ceil(cooldownRemaining)}...`,
        { fontSize: 40, color: '#ffff00' }
      );
      cd.material.map = texture;
      cd.material.needsUpdate = true;
      cd.scale.set(0.4, 0.4, 1);
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

// ── Controller Hand Highlights for Upgrade Selection ───────

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

export function updateUpgradeHandHighlights(now) {
  // This is handled via normal scene graph if attached to controller
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

// ── Boss Alert (Power Outage Update) #3 ─────────────────────────────────

let bossAlertGroup = null;

export function showBossAlert() {
  if (!bossAlertGroup) {
    bossAlertGroup = new THREE.Group();
    
    // Line 1: "⚠ ALERT! ALERT! ⚠" in red, large, with glow
    const alertSprite = makeSprite('⚠ ALERT! ALERT! ⚠', {
      fontSize: 64, color: '#ff0044', glow: true, glowColor: '#ff0000', glowSize: 25, scale: 0.7,
    });
    alertSprite.position.set(0, 0.3, 0);
    alertSprite.name = 'alertLine1';
    bossAlertGroup.add(alertSprite);

    // Line 2: "INCOMING BOSS!" in yellow, pulsing
    const incomingSprite = makeSprite('INCOMING BOSS!', {
      fontSize: 56, color: '#ffff00', glow: true, glowColor: '#ffff00', glowSize: 20, scale: 0.6,
    });
    incomingSprite.position.set(0, -0.3, 0);
    incomingSprite.name = 'alertLine2';
    bossAlertGroup.add(incomingSprite);
  }
  
  // Position at midfield, eye level
  bossAlertGroup.position.set(0, 2.0, -4);
  bossAlertGroup.visible = true;
  sceneRef.add(bossAlertGroup);
}

export function hideBossAlert() {
  if (bossAlertGroup) {
    bossAlertGroup.visible = false;
  }
}

export function updateBossAlert(now) {
  if (!bossAlertGroup || !bossAlertGroup.visible) return;
  
  // Pulse the "INCOMING BOSS!" text
  const line2 = bossAlertGroup.getObjectByName('alertLine2');
  if (line2) {
    line2.material.opacity = 0.6 + Math.sin(now * 0.008) * 0.4;
  }
}

// ── Kills Remaining Message (Power Outage Update) #8 ─────────────────────

let killsRemainingGroup = null;

export function showKillsRemainingMessage(count) {
  if (killsRemainingGroup) {
    sceneRef.remove(killsRemainingGroup);
  }
  
  killsRemainingGroup = new THREE.Group();
  
  const text = `${count} KILLS REMAINING`;
  const sprite = makeSprite(text, {
    fontSize: 52, color: '#ffff00', glow: true, glowColor: '#ffff00', glowSize: 15, scale: 0.6,
  });
  sprite.position.set(0, 0, 0);
  killsRemainingGroup.add(sprite);
  
  // Position at midfield
  killsRemainingGroup.position.set(0, 2.0, -5);
  killsRemainingGroup.userData.createdAt = performance.now();
  killsRemainingGroup.userData.lifetime = 2000; // 2 seconds
  killsRemainingGroup.visible = true;
  
  sceneRef.add(killsRemainingGroup);
}

export function updateKillsRemainingMessage(now) {
  if (!killsRemainingGroup || !killsRemainingGroup.visible) return;
  
  const age = now - killsRemainingGroup.userData.createdAt;
  if (age > killsRemainingGroup.userData.lifetime) {
    killsRemainingGroup.visible = false;
    sceneRef.remove(killsRemainingGroup);
    killsRemainingGroup = null;
  } else {
    // Fade out in last 0.5s
    const fadeStart = killsRemainingGroup.userData.lifetime - 500;
    if (age > fadeStart) {
      const opacity = 1 - (age - fadeStart) / 500;
      killsRemainingGroup.children.forEach(child => {
        if (child.material) child.material.opacity = opacity;
      });
    }
  }
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

// [Power Outage Update] #14: Modified to accept isCrit parameter
export function spawnDamageNumber(position, damage, color, isCrit = false) {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  canvas.width = 128;
  canvas.height = 64;

  // [Power Outage Update] #14: 1.5x size for crits (reduced from 2x by 25%)
  const fontSize = isCrit
    ? Math.min(48, 28 + damage / 6) * 1.5
    : Math.min(48, 28 + damage / 6);
  ctx.font = `bold ${fontSize}px Arial, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  // Drop shadow
  ctx.fillStyle = 'rgba(0,0,0,0.7)';
  ctx.fillText(Math.round(damage).toString(), 66, 34);

  // [Power Outage Update] #14: Use crit color override
  const displayColor = isCrit ? '#ffff00' : (color || '#ffffff');
  ctx.fillStyle = displayColor;
  ctx.fillText(Math.round(damage).toString(), 64, 32);

  const texture = new THREE.CanvasTexture(canvas);
  texture.minFilter = THREE.LinearFilter;

  // [Power Outage Update] #14: 1.5x mesh scale for crits (reduced from 2x by 25%)
  const scale = isCrit
    ? (0.25 + Math.min(damage / 100, 0.15)) * 1.5
    : (0.25 + Math.min(damage / 100, 0.15));
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

  // [Power Outage Update] #14: Spawn "CRIT!" label for critical hits
  if (isCrit) {
    spawnCritLabel(position);
  }

  // Cap total to prevent perf issues
  while (damageNumbers.length > 20) {
    const old = damageNumbers.shift();
    sceneRef.remove(old);
    old.material.map.dispose();
    old.material.dispose();
  }
}

// [Power Outage Update] #14: New helper for crit label
function spawnCritLabel(position) {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  canvas.width = 128;
  canvas.height = 48;

  ctx.font = 'bold 36px Arial, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  // Drop shadow
  ctx.fillStyle = 'rgba(0,0,0,0.7)';
  ctx.fillText('CRIT!', 66, 26);

  // Orange/red crit text
  ctx.fillStyle = '#ff4400';
  ctx.fillText('CRIT!', 64, 24);

  const texture = new THREE.CanvasTexture(canvas);
  texture.minFilter = THREE.LinearFilter;

  const scale = 0.3;
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
  // Position slightly above the damage number
  mesh.position.copy(position);
  mesh.position.x += (Math.random() - 0.5) * 0.2;
  mesh.position.y += 0.4 + Math.random() * 0.2;
  mesh.position.z += (Math.random() - 0.5) * 0.2;

  mesh.renderOrder = 998;

  mesh.userData.velocity = new THREE.Vector3(
    (Math.random() - 0.5) * 0.3,
    0.6 + Math.random() * 0.3,
    (Math.random() - 0.5) * 0.3,
  );
  mesh.userData.lifetime = 600;
  mesh.userData.createdAt = performance.now();

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

  sceneRef.add(mesh);

  const ouchBubbles = damageNumbers;
  ouchBubbles.push(mesh);

  while (ouchBubbles.length > 5) {
    const old = ouchBubbles.shift();
    sceneRef.remove(old);
    old.material.map.dispose();
    old.material.dispose();
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

// ── Vampire Heal Indicator ─────────────────────────────────────
export function spawnVampireHealIndicator(position) {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  canvas.width = 96;
  canvas.height = 48;

  // Draw "+" symbol
  ctx.fillStyle = '#00ff00';
  ctx.font = 'bold 32px Arial';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText('+', 8, 24);

  // Draw half pixel heart (left side only, same design as HUD hearts)
  const pixSize = 4;
  const heartOffsetX = 40;
  const heartOffsetY = 12;
  
  ctx.fillStyle = '#ff0044';
  HEART_PIXELS.forEach((row, py) => {
    row.forEach((px_on, px) => {
      if (!px_on) return;
      // Only draw left half (px < 4)
      if (px < 4) {
        ctx.fillRect(heartOffsetX + px * pixSize, heartOffsetY + py * pixSize, pixSize, pixSize);
      }
    });
  });

  const texture = new THREE.CanvasTexture(canvas);
  texture.minFilter = THREE.LinearFilter;

  const scale = 0.4; // Doubled from 0.2 for 2x size
  const width = scale * 2;
  const height = scale;

  const geometry = new THREE.PlaneGeometry(width, height);
  const mat = new THREE.MeshBasicMaterial({
    map: texture,
    transparent: true,
    opacity: 1,
    depthTest: false,
    side: THREE.DoubleSide,
  });

  const mesh = new THREE.Mesh(geometry, mat);
  mesh.position.copy(position);
  mesh.position.y += 0.3;
  mesh.position.x += (Math.random() - 0.5) * 0.2;

  mesh.renderOrder = 997;
  mesh.userData.velocity = new THREE.Vector3(0, 0.8, 0);
  mesh.userData.lifetime = 800;
  mesh.userData.createdAt = performance.now();

  sceneRef.add(mesh);
  damageNumbers.push(mesh);

  // Cap total
  while (damageNumbers.length > 25) {
    const old = damageNumbers.shift();
    sceneRef.remove(old);
    old.material.map.dispose();
    old.material.dispose();
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
  titleGroup.visible = false;
  levelTextGroup.visible = false;
  upgradeGroup.visible = false;
  gameOverGroup.visible = false;
  nameEntryGroup.visible = false;
  scoreboardGroup.visible = false;
  countrySelectGroup.visible = false;
}

// ── Title Scoreboard Button Hit ─────────────────────────────

export function getTitleButtonHit(raycaster) {
  if (!titleScoreboardBtn || !titleGroup.visible) return null;
  const hits = raycaster.intersectObject(titleScoreboardBtn, false);
  if (hits.length > 0) return 'scoreboard';
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

// [Power Outage Update] #13: Accept optional country info for header split
export function showScoreboard(scores, headerText, opts = null) {
  hideAll();
  while (scoreboardGroup.children.length) scoreboardGroup.remove(scoreboardGroup.children[0]);

  // Clear hoverable buttons for fresh registration
  clearHoverableButtons();

  scoreboardScores = scores;
  scoreboardScrollOffset = 0;
  scoreboardHeader = headerText || 'GLOBAL LEADERBOARD';
  scoreboardGroup.position.set(0, 1.6, -5);
  scoreboardGroup.visible = true;

  // [Power Outage Update] #13: Split header into two lines with flag for country leaderboards
  if (opts && opts.countryCode && opts.countryName) {
    // Get flag emoji from country code
    const flag = String.fromCodePoint(
      ...[...opts.countryCode.toUpperCase()].map(c => 0x1F1E6 + c.charCodeAt(0) - 65)
    );
    
    // Line 1: Flag + country name in cyan
    const countrySprite = makeSprite(`${flag} ${opts.countryName}`, {
      fontSize: 52, color: '#00ffff', glow: true, glowColor: '#00ffff', scale: 0.55,
    });
    countrySprite.position.set(0, 2.0, 0);
    scoreboardGroup.add(countrySprite);
    
    // Line 2: "LEADERBOARD" in white
    const lbSprite = makeSprite('LEADERBOARD', {
      fontSize: 42, color: '#ffffff', glow: true, glowColor: '#ffffff', scale: 0.45,
    });
    lbSprite.position.set(0, 1.55, 0);
    scoreboardGroup.add(lbSprite);
  } else {
    // Default: single header
    const header = makeSprite(scoreboardHeader, {
      fontSize: 60, color: '#00ffff', glow: true, glowColor: '#00ffff', scale: 0.6,
    });
    header.position.set(0, 1.8, 0);
    scoreboardGroup.add(header);
  }

  // Score list canvas
  renderScoreboardCanvas();
  scoreboardMesh.position.set(0, 0.5, 0);
  scoreboardGroup.add(scoreboardMesh);

  // Buttons on right side
  // [Power Outage Update] #10, #11: Wider buttons, moved right, back button moved down
  const btnDefs = [
    { label: 'COUNTRY', y: 1.2, action: 'country' },
    { label: 'CONTINENT', y: 0.85, action: 'continent' },
    { label: 'SCROLL UP', y: 0.1, action: 'scroll_up' },
    { label: 'SCROLL DOWN', y: -0.25, action: 'scroll_down' },
  ];

  for (const def of btnDefs) {
    const btnGroup = new THREE.Group();
    btnGroup.position.set(1.5, def.y, 0); // [Power Outage Update] #10: Moved right from 1.2 to 1.5

    const btnGeo = new THREE.PlaneGeometry(0.7, 0.25); // [Power Outage Update] #10: Wider from 0.5 to 0.7
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

    // Highlight border for hover
    const highlightBorder = createHighlightBorder(btnGeo, 0.02);
    highlightBorder.position.z = 0.02;
    highlightBorder.visible = false;
    btnGroup.add(highlightBorder);

    const txt = makeSprite(def.label, { fontSize: 22, color: '#ffffff', scale: 0.12 });
    txt.position.set(0, 0, 0.01);
    btnGroup.add(txt);

    scoreboardGroup.add(btnGroup);
    
    // Register as hoverable
    registerHoverableButton({
      mesh: btnMesh,
      group: btnGroup,
      mat: btnMat,
      baseColor: 0x111133,
      currentScale: 1.0,
      highlightBorder: highlightBorder,
    });
  }

  // BACK button bottom center
  // [Power Outage Update] #11: Moved down from -0.7 to -0.95 to avoid overlap
  const backGroup = new THREE.Group();
  backGroup.position.set(0, -0.95, 0);
  const backGeo = new THREE.PlaneGeometry(0.6, 0.25);
  const backMat = new THREE.MeshBasicMaterial({
    color: 0x330000, transparent: true, opacity: 0.9, side: THREE.DoubleSide,
  });
  const backMesh = new THREE.Mesh(backGeo, backMat);
  backMesh.userData.scoreboardAction = 'back';
  backGroup.add(backMesh);
  
  const backHighlightBorder = createHighlightBorder(backGeo, 0.02);
  backHighlightBorder.position.z = 0.02;
  backHighlightBorder.visible = false;
  backGroup.add(backHighlightBorder);
  
  backGroup.add(new THREE.LineSegments(
    new THREE.EdgesGeometry(backGeo),
    new THREE.LineBasicMaterial({ color: 0xff4444 })
  ));
  const backTxt = makeSprite('BACK', { fontSize: 28, color: '#ff4444', scale: 0.15 });
  backTxt.position.set(0, 0, 0.01);
  backGroup.add(backTxt);
  scoreboardGroup.add(backGroup);
  
  // Register back button as hoverable
  registerHoverableButton({
    mesh: backMesh,
    group: backGroup,
    mat: backMat,
    baseColor: 0x330000,
    currentScale: 1.0,
    highlightBorder: backHighlightBorder,
  });
}

function renderScoreboardCanvas() {
  const canvas = document.createElement('canvas');
  const w = 800;
  const h = 1000;
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, w, h);

  // Background
  ctx.fillStyle = 'rgba(10, 0, 30, 0.9)';
  ctx.fillRect(0, 0, w, h);

  // Border
  ctx.strokeStyle = '#444488';
  ctx.lineWidth = 2;
  ctx.strokeRect(1, 1, w - 2, h - 2);

  const rowHeight = 42;
  const maxVisible = Math.floor(h / rowHeight);
  const startIdx = scoreboardScrollOffset;
  const endIdx = Math.min(startIdx + maxVisible, scoreboardScores.length);

  ctx.font = 'bold 24px Arial, sans-serif';
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
        ctx.font = '22px Arial, sans-serif';
        ctx.fillText(flag, 640, y);
        ctx.font = 'bold 24px Arial, sans-serif';
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

  if (scoreboardTexture) scoreboardTexture.dispose();
  scoreboardTexture = new THREE.CanvasTexture(canvas);
  scoreboardTexture.minFilter = THREE.LinearFilter;

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
  while (countrySelectGroup.children.length) countrySelectGroup.remove(countrySelectGroup.children[0]);
  
  // Clear hoverable buttons for fresh registration
  clearHoverableButtons();
  
  continentTabs = [];
  countryItems = [];
  countrySelectContinent = initialContinent || 'North America';
  countrySelectScrollOffset = 0;

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

    // Highlight border for hover
    const tabHighlightBorder = createHighlightBorder(tabGeo, 0.015);
    tabHighlightBorder.position.z = 0.02;
    tabHighlightBorder.visible = false;
    tabGroup.add(tabHighlightBorder);

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
    
    // Register tab as hoverable
    registerHoverableButton({
      mesh: tabMesh,
      group: tabGroup,
      mat: tabMat,
      baseColor: isActive ? 0x003344 : 0x111133,
      currentScale: 1.0,
      highlightBorder: tabHighlightBorder,
    });
    
    tabX += tabWidth + tabGap;
  }

  // Country list
  renderCountryList(countries);

  // BACK button
  const backGroup = new THREE.Group();
  backGroup.position.set(0, -0.8, 0);
  const backGeo = new THREE.PlaneGeometry(0.6, 0.25);
  const backMat = new THREE.MeshBasicMaterial({
    color: 0x330000, transparent: true, opacity: 0.9, side: THREE.DoubleSide,
  });
  const backMesh = new THREE.Mesh(backGeo, backMat);
  backMesh.userData.countryAction = 'back';
  backGroup.add(backMesh);
  
  const backHighlightBorder = createHighlightBorder(backGeo, 0.02);
  backHighlightBorder.position.z = 0.02;
  backHighlightBorder.visible = false;
  backGroup.add(backHighlightBorder);
  
  backGroup.add(new THREE.LineSegments(
    new THREE.EdgesGeometry(backGeo),
    new THREE.LineBasicMaterial({ color: 0xff4444 })
  ));
  const backTxt = makeSprite('BACK', { fontSize: 28, color: '#ff4444', scale: 0.15 });
  backTxt.position.set(0, 0, 0.01);
  backGroup.add(backTxt);
  countrySelectGroup.add(backGroup);
  
  // Register back button as hoverable
  registerHoverableButton({
    mesh: backMesh,
    group: backGroup,
    mat: backMat,
    baseColor: 0x330000,
    currentScale: 1.0,
    highlightBorder: backHighlightBorder,
  });
}

function renderCountryList(countries) {
  // Remove old country item meshes
  countryItems.forEach(item => countrySelectGroup.remove(item.group));
  countryItems = [];

  const filtered = countries.filter(c => c.continent === countrySelectContinent);
  const itemHeight = 0.22;
  const itemGap = 0.04;
  const startY = 0.85;

  // [Power Outage Update] #12: Multi-column layout for long lists
  const MAX_ROWS_PER_COLUMN = 5;
  const useColumns = filtered.length > MAX_ROWS_PER_COLUMN;
  const colWidth = 0.85;
  const colGap = 0.1;
  const cols = useColumns ? Math.ceil(filtered.length / MAX_ROWS_PER_COLUMN) : 1;
  const totalWidth = cols * colWidth + (cols - 1) * colGap;
  const startX = -totalWidth / 2 + colWidth / 2;

  for (let i = 0; i < filtered.length; i++) {
    const country = filtered[i];
    const itemGroup = new THREE.Group();
    
    // Calculate position based on column layout
    let x, y;
    if (useColumns) {
      const col = Math.floor(i / MAX_ROWS_PER_COLUMN);
      const row = i % MAX_ROWS_PER_COLUMN;
      x = startX + col * (colWidth + colGap);
      y = startY - row * (itemHeight + itemGap);
    } else {
      x = 0;
      y = startY - i * (itemHeight + itemGap);
    }
    
    itemGroup.position.set(x, y, 0);

    // [Power Outage Update] #12: Narrower width for multi-column layout
    const itemWidth = useColumns ? colWidth : 1.8;
    const itemGeo = new THREE.PlaneGeometry(itemWidth, itemHeight);
    const itemMat = new THREE.MeshBasicMaterial({
      color: 0x111133, transparent: true, opacity: 0.85, side: THREE.DoubleSide,
    });
    const itemMesh = new THREE.Mesh(itemGeo, itemMat);
    itemMesh.userData.countryCode = country.code;
    itemMesh.userData.countryAction = 'select';
    itemGroup.add(itemMesh);

    // Highlight border for hover
    const itemHighlightBorder = createHighlightBorder(itemGeo, 0.015);
    itemHighlightBorder.position.z = 0.02;
    itemHighlightBorder.visible = false;
    itemGroup.add(itemHighlightBorder);

    itemGroup.add(new THREE.LineSegments(
      new THREE.EdgesGeometry(itemGeo),
      new THREE.LineBasicMaterial({ color: 0x444466 })
    ));

    const label = makeSprite(`${country.flag}  ${country.name}`, {
      fontSize: 28, color: '#ffffff', scale: 0.15,
    });
    label.position.set(0, 0, 0.01);
    itemGroup.add(label);

    countryItems.push({ group: itemGroup, mesh: itemMesh, code: country.code });
    countrySelectGroup.add(itemGroup);
    
    // Register country item as hoverable
    registerHoverableButton({
      mesh: itemMesh,
      group: itemGroup,
      mat: itemMat,
      baseColor: 0x111133,
      currentScale: 1.0,
      highlightBorder: itemHighlightBorder,
    });
  }
}

export function hideCountrySelect() {
  countrySelectGroup.visible = false;
}

export function getCountrySelectHit(raycaster, countries) {
  if (!countrySelectGroup.visible) return null;

  // Check continent tabs
  const tabMeshes = continentTabs.map(t => t.mesh);
  let hits = raycaster.intersectObjects(tabMeshes, false);
  if (hits.length > 0) {
    const continent = hits[0].object.userData.continentTab;
    if (continent !== countrySelectContinent) {
      countrySelectContinent = continent;
      // Refresh tabs and list
      renderCountryList(countries);
      // Update tab visuals
      continentTabs.forEach(tab => {
        const isActive = tab.continent === countrySelectContinent;
        tab.mesh.material.color.setHex(isActive ? 0x003344 : 0x111133);
      });
    }
    return null;
  }

  // Check country items
  const itemMeshes = countryItems.map(i => i.mesh);
  hits = raycaster.intersectObjects(itemMeshes, false);
  if (hits.length > 0) {
    const code = hits[0].object.userData.countryCode;
    return { action: 'select', code };
  }

  // Check back button
  const actionMeshes = [];
  countrySelectGroup.traverse(c => {
    if (c.userData && c.userData.countryAction === 'back') actionMeshes.push(c);
  });
  hits = raycaster.intersectObjects(actionMeshes, false);
  if (hits.length > 0) return { action: 'back' };

  return null;
}

// ── [Instruction 1] Alt Weapon Cooldown Indicators ─────────────────────────

/**
 * Create circular cooldown indicators attached to the camera.
 * Shows fill progress that empties as cooldown progresses, fills when ready.
 * Position: bottom corners of view (left hand = bottom left, right hand = bottom right)
 */
export function initAltWeaponIndicators(camera) {
  const indicatorSize = 0.12;
  const positions = {
    left: new THREE.Vector3(-0.38, -0.25, -0.6),   // Bottom left of view
    right: new THREE.Vector3(0.38, -0.25, -0.6),   // Bottom right of view
  };

  ['left', 'right'].forEach(hand => {
    const group = new THREE.Group();
    group.name = `altWeaponIndicator_${hand}`;
    
    // Background ring (dark, full circle)
    const bgRingGeo = new THREE.RingGeometry(indicatorSize * 0.7, indicatorSize, 32);
    const bgRingMat = new THREE.MeshBasicMaterial({
      color: 0x222233,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.6,
      depthTest: false,
    });
    const bgRing = new THREE.Mesh(bgRingGeo, bgRingMat);
    bgRing.name = 'bgRing';
    group.add(bgRing);
    
    // Progress ring (fills as cooldown decreases)
    // Using a separate ring that scales from 0 to 1
    const progressRingGeo = new THREE.RingGeometry(indicatorSize * 0.7, indicatorSize, 32, 1, 0, Math.PI * 2);
    const progressRingMat = new THREE.MeshBasicMaterial({
      color: 0x00ffff,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.8,
      depthTest: false,
    });
    const progressRing = new THREE.Mesh(progressRingGeo, progressRingMat);
    progressRing.name = 'progressRing';
    progressRing.userData.indicatorSize = indicatorSize;
    group.add(progressRing);
    
    // Inner glow (brightens when ready)
    const innerGlowGeo = new THREE.CircleGeometry(indicatorSize * 0.65, 32);
    const innerGlowMat = new THREE.MeshBasicMaterial({
      color: 0x00ffff,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0,
      depthTest: false,
    });
    const innerGlow = new THREE.Mesh(innerGlowGeo, innerGlowMat);
    innerGlow.name = 'innerGlow';
    group.add(innerGlow);
    
    // Weapon name label (hidden by default)
    const labelSprite = makeSprite('', {
      fontSize: 20, color: '#ffffff', scale: 0.08,
    });
    labelSprite.name = 'weaponLabel';
    labelSprite.position.set(0, -indicatorSize * 1.5, 0);
    labelSprite.visible = false;
    group.add(labelSprite);
    
    group.position.copy(positions[hand]);
    group.visible = false; // Hidden until player has an alt weapon
    
    camera.add(group);
    altWeaponIndicators[hand] = group;
  });
}

/**
 * Update alt weapon cooldown indicators.
 * @param {Object} altWeapons - { left: weaponId|null, right: weaponId|null }
 * @param {Object} altCooldowns - { left: secondsRemaining, right: secondsRemaining }
 * @param {Object} altReadySoundPlayed - { left: bool, right: bool } - tracks if "ready" sound played
 * @param {Object} weaponDefs - ALT_WEAPON_DEFS from upgrades.js
 * @returns {Object} which hands just became ready (to trigger sound) { left: bool, right: bool }
 */
export function updateAltWeaponIndicators(altWeapons, altCooldowns, altReadySoundPlayed, weaponDefs, now) {
  const readyStatus = { left: false, right: false };
  
  ['left', 'right'].forEach(hand => {
    const group = altWeaponIndicators[hand];
    if (!group) return;
    
    const weaponId = altWeapons[hand];
    const cooldown = altCooldowns[hand] || 0;
    
    // Hide if no weapon for this hand
    if (!weaponId) {
      group.visible = false;
      return;
    }
    
    group.visible = true;
    
    const def = weaponDefs[weaponId] || {};
    const maxCooldown = (def.cooldown || 10000) / 1000; // Convert ms to seconds
    const weaponColor = def.color ? parseInt(def.color.replace('#', ''), 16) : 0x00ffff;
    
    // Calculate progress: 0 = just fired (empty), 1 = ready (full)
    const progress = Math.max(0, Math.min(1, 1 - (cooldown / maxCooldown)));
    const isReady = cooldown <= 0;
    
    // Update progress ring
    const progressRing = group.getObjectByName('progressRing');
    if (progressRing) {
      // Scale the progress ring based on cooldown
      // When progress = 0 (just fired), ring is small
      // When progress = 1 (ready), ring is full size
      const baseSize = progressRing.userData.indicatorSize;
      const innerRadius = baseSize * 0.7;
      const outerRadius = innerRadius + (baseSize - innerRadius) * progress;
      
      // Recreate geometry with new outer radius for "fill" effect
      progressRing.geometry.dispose();
      progressRing.geometry = new THREE.RingGeometry(innerRadius, outerRadius, 32);
      
      // Color: dim when cooling down, bright when ready
      progressRing.material.color.setHex(isReady ? weaponColor : 0x666688);
      progressRing.material.opacity = isReady ? 1.0 : 0.6;
    }
    
    // Update inner glow (pulses when ready)
    const innerGlow = group.getObjectByName('innerGlow');
    if (innerGlow) {
      if (isReady) {
        // Pulse glow when ready
        const pulse = 0.3 + Math.sin(now * 0.006) * 0.2;
        innerGlow.material.opacity = pulse;
        innerGlow.material.color.setHex(weaponColor);
      } else {
        innerGlow.material.opacity = 0;
      }
    }
    
    // Update weapon label
    const label = group.getObjectByName('weaponLabel');
    if (label) {
      if (def.name) {
        label.visible = true;
        // Update text if changed
        const labelText = def.name.toUpperCase();
        if (label.userData.lastText !== labelText) {
          const { texture, aspect } = makeTextTexture(labelText, {
            fontSize: 18, color: isReady ? '#ffffff' : '#888888',
          });
          if (label.material.map) label.material.map.dispose();
          label.material.map = texture;
          label.scale.set(aspect * 0.08, 0.08, 1);
          label.userData.lastText = labelText;
        }
      } else {
        label.visible = false;
      }
    }
    
    // Check if just became ready (for sound trigger)
    if (isReady && !altReadySoundPlayed[hand]) {
      readyStatus[hand] = true;
    }
  });
  
  return readyStatus;
}

/**
 * Show the "Acquired New Alternate Weapon" message.
 * Creates a floating popup near the center of the screen.
 */
let altWeaponAcquiredGroup = null;

export function showAltWeaponAcquired(weaponName, weaponColor) {
  // Remove existing if present
  if (altWeaponAcquiredGroup) {
    sceneRef.remove(altWeaponAcquiredGroup);
  }
  
  altWeaponAcquiredGroup = new THREE.Group();
  
  // Line 1: "ACQUIRED NEW"
  const line1 = makeSprite('ACQUIRED NEW', {
    fontSize: 36, color: '#00ffff', glow: true, glowColor: '#00ffff', glowSize: 10, scale: 0.4,
  });
  line1.position.set(0, 0.2, 0);
  altWeaponAcquiredGroup.add(line1);
  
  // Line 2: "ALTERNATE WEAPON:"
  const line2 = makeSprite('ALTERNATE WEAPON:', {
    fontSize: 32, color: '#ffffff', scale: 0.35,
  });
  line2.position.set(0, 0, 0);
  altWeaponAcquiredGroup.add(line2);
  
  // Line 3: Weapon name (in weapon color)
  const line3 = makeSprite(weaponName.toUpperCase(), {
    fontSize: 48, color: weaponColor || '#ff00ff', glow: true, glowColor: weaponColor || '#ff00ff', glowSize: 15, scale: 0.5,
  });
  line3.position.set(0, -0.3, 0);
  altWeaponAcquiredGroup.add(line3);
  
  // Position in front of player
  altWeaponAcquiredGroup.position.set(0, 1.6, -3);
  altWeaponAcquiredGroup.userData.createdAt = performance.now();
  altWeaponAcquiredGroup.userData.lifetime = 3000; // 3 seconds
  altWeaponAcquiredGroup.visible = true;
  
  sceneRef.add(altWeaponAcquiredGroup);
}

export function updateAltWeaponAcquired(now) {
  if (!altWeaponAcquiredGroup || !altWeaponAcquiredGroup.visible) return;
  
  const age = now - altWeaponAcquiredGroup.userData.createdAt;
  if (age > altWeaponAcquiredGroup.userData.lifetime) {
    altWeaponAcquiredGroup.visible = false;
    sceneRef.remove(altWeaponAcquiredGroup);
    altWeaponAcquiredGroup = null;
  } else {
    // Fade out in last 0.5s
    const fadeStart = altWeaponAcquiredGroup.userData.lifetime - 500;
    if (age > fadeStart) {
      const opacity = 1 - (age - fadeStart) / 500;
      altWeaponAcquiredGroup.children.forEach(child => {
        if (child.material) child.material.opacity = opacity;
      });
    }
  }
}

/**
 * Create a spinning 3D star pickup for alt weapon drops.
 * These are rare drops from enemies that give the player alt weapons.
 */
export function createAltWeaponStar(position, weaponId, weaponDefs) {
  const def = weaponDefs[weaponId];
  if (!def) return null;
  
  const color = def.color ? parseInt(def.color.replace('#', ''), 16) : 0x00ffff;
  
  // Create star geometry (3D octahedron style)
  const group = new THREE.Group();
  
  // Core star shape (double pyramid / octahedron)
  const coreGeo = new THREE.OctahedronGeometry(0.15, 0);
  const coreMat = new THREE.MeshBasicMaterial({
    color: color,
    wireframe: false,
    transparent: true,
    opacity: 0.9,
  });
  const core = new THREE.Mesh(coreGeo, coreMat);
  group.add(core);
  
  // Wireframe outer glow
  const wireGeo = new THREE.OctahedronGeometry(0.2, 0);
  const wireMat = new THREE.MeshBasicMaterial({
    color: color,
    wireframe: true,
    transparent: true,
    opacity: 0.5,
  });
  const wire = new THREE.Mesh(wireGeo, wireMat);
  group.add(wire);
  
  // Point light glow effect (additive sphere)
  const glowGeo = new THREE.SphereGeometry(0.25, 8, 8);
  const glowMat = new THREE.MeshBasicMaterial({
    color: color,
    transparent: true,
    opacity: 0.2,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  const glow = new THREE.Mesh(glowGeo, glowMat);
  group.add(glow);
  
  // Position and metadata
  group.position.copy(position);
  group.userData = {
    isAltWeaponStar: true,
    weaponId: weaponId,
    weaponName: def.name,
    weaponColor: def.color,
    createdAt: performance.now(),
    lifetime: 15000, // 15 seconds before disappearing
    bobOffset: Math.random() * Math.PI * 2,
  };
  
  return group;
}

/**
 * Update all alt weapon stars (spinning, bobbing animation).
 * Called from main.js render loop.
 */
const altWeaponStars = [];

export function updateAltWeaponStars(dt, now) {
  for (let i = altWeaponStars.length - 1; i >= 0; i--) {
    const star = altWeaponStars[i];
    const age = now - star.userData.createdAt;
    
    // Remove expired stars
    if (age > star.userData.lifetime) {
      sceneRef.remove(star);
      altWeaponStars.splice(i, 1);
      continue;
    }
    
    // Spin animation
    star.rotation.y += dt * 2;
    star.rotation.x += dt * 0.5;
    
    // Bob up and down
    const bob = Math.sin(now * 0.003 + star.userData.bobOffset) * 0.1;
    star.position.y = star.userData.baseY + bob;
    
    // Pulse glow
    const pulse = 0.3 + Math.sin(now * 0.005) * 0.1;
    star.children.forEach(child => {
      if (child.material && child.material.opacity !== undefined && child !== star.children[0]) {
        child.material.opacity = pulse + 0.2;
      }
    });
    
    // Fade out in last 3 seconds
    const fadeStart = star.userData.lifetime - 3000;
    if (age > fadeStart) {
      const fadeOpacity = 1 - (age - fadeStart) / 3000;
      star.children.forEach(child => {
        if (child.material) {
          child.material.opacity *= fadeOpacity;
        }
      });
    }
  }
}

export function addAltWeaponStar(star) {
  if (!star) return;
  star.userData.baseY = star.position.y;
  sceneRef.add(star);
  altWeaponStars.push(star);
}

export function getAltWeaponStars() {
  return altWeaponStars;
}

export function removeAltWeaponStar(star) {
  const idx = altWeaponStars.indexOf(star);
  if (idx >= 0) {
    altWeaponStars.splice(idx, 1);
    sceneRef.remove(star);
  }
}

/**
 * Check if a raycaster hits an alt weapon star.
 * Returns the star or null.
 */
export function getAltWeaponStarHit(raycaster) {
  const starMeshes = altWeaponStars.map(s => s.children[0]).filter(Boolean);
  const hits = raycaster.intersectObjects(starMeshes, false);
  if (hits.length > 0) {
    // Find the parent star group
    return altWeaponStars.find(s => s.children.includes(hits[0].object)) || null;
  }
  return null;
}

/**
 * Show weapon name tooltip when hovering over a star.
 */
let starTooltipGroup = null;

export function showStarTooltip(star, playerPos) {
  if (!star) return;
  
  if (!starTooltipGroup) {
    starTooltipGroup = new THREE.Group();
    sceneRef.add(starTooltipGroup);
  }
  
  // Clear old children
  while (starTooltipGroup.children.length) {
    starTooltipGroup.remove(starTooltipGroup.children[0]);
  }
  
  // Create tooltip text
  const name = star.userData.weaponName || 'Unknown Weapon';
  const color = star.userData.weaponColor || '#00ffff';
  
  const tooltip = makeSprite(name.toUpperCase(), {
    fontSize: 28, color: color, glow: true, glowColor: color, glowSize: 8, scale: 0.25,
  });
  tooltip.position.set(0, 0, 0);
  starTooltipGroup.add(tooltip);
  
  // Position above the star
  starTooltipGroup.position.copy(star.position);
  starTooltipGroup.position.y += 0.4;
  starTooltipGroup.visible = true;
}

export function hideStarTooltip() {
  if (starTooltipGroup) {
    starTooltipGroup.visible = false;
  }
}
