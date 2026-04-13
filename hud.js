// ============================================================
//  HUD, TITLE SCREEN, MENUS
//  All in-VR UI elements rendered as 3D objects.
// ============================================================

import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { State, game } from './game.js';
import { playMenuHoverSound, playMenuClick, playBasicEnemySpawn } from './audio.js';
import {
  TextPopupPool, initDamageNumbers, disposePools,
  spawnDamageNumber, spawnCritIndicator, updateDamageNumbers,
  spawnComboPopup, spawnKillChainPopup, updateKillChainPopups,
  triggerAccuracyHurt, clearAllDamageNumbers, clearAllComboPopups,
  clearAllKillChainPopups
} from './damage-numbers.js';
import {
  showPauseMenu, hidePauseMenu, updatePauseMenu, showPauseCountdown,
  hidePauseCountdown, updatePauseCountdownDisplay, getPauseMenuHit,
  updatePauseMenuHover
} from './pause-menu.js';
import {
  settingsGroup, showSettings, hideSettings, isSettingsVisible,
  getSettingsHit, executeSettingsAction, getPreviousMenu, updateSettingsHover
} from './settings-menu.js';

// Re-export so main.js imports still work
export {
  TextPopupPool, spawnDamageNumber, spawnCritIndicator, updateDamageNumbers,
  spawnComboPopup, spawnKillChainPopup, updateKillChainPopups,
  triggerAccuracyHurt, clearAllDamageNumbers, clearAllComboPopups,
  clearAllKillChainPopups,
  showPauseMenu, hidePauseMenu, updatePauseMenu, showPauseCountdown,
  hidePauseCountdown, updatePauseCountdownDisplay, getPauseMenuHit,
  updatePauseMenuHover,
  showSettings, hideSettings, isSettingsVisible, getSettingsHit,
  executeSettingsAction, getPreviousMenu, settingsGroup, updateSettingsHover
};

// VR camera height fix: Shift entire scene down so XR camera at ~0.875m appears 1.6m above floor
const SCENE_Y_OFFSET = -0.725;

// ── November Font Loading ───────────────────────────────────
let novemberFontLoaded = false;
let novemberFontFamily = 'November';

async function loadNovemberFont() {
  if (novemberFontLoaded) return true;

  try {
    const font = new FontFace('November', 'url(assets/fonts/november.ttf)');
    await font.load();
    document.fonts.add(font);
    novemberFontLoaded = true;
    console.log('[hud] November font loaded successfully');
    return true;
  } catch (err) {
    console.warn('[hud] Failed to load November font, falling back to monospace:', err);
    novemberFontFamily = '"Courier New", monospace';
    return false;
  }
}

// ── Module state ───────────────────────────────────────────
let sceneRef;
export let cameraRef;

const titleGroup = new THREE.Group();
titleGroup.name = 'title-screen';
export const hudGroup = new THREE.Group();
hudGroup.name = 'floor-hud';
const levelTextGroup = new THREE.Group();
levelTextGroup.name = 'level-text';
const upgradeGroup = new THREE.Group();
upgradeGroup.name = 'upgrade-cards';
const gameOverGroup = new THREE.Group();
gameOverGroup.name = 'game-over';
const nameEntryGroup = new THREE.Group();
nameEntryGroup.name = 'name-entry';
const scoreboardGroup = new THREE.Group();
scoreboardGroup.name = 'scoreboard';
const countrySelectGroup = new THREE.Group();
countrySelectGroup.name = 'country-select';
const readyGroup = new THREE.Group();
readyGroup.name = 'ready-screen';
// Debug menu group removed — in-game 3D debug menu deleted (Needle audit cleanup)
export const pauseMenuGroup = new THREE.Group();
pauseMenuGroup.name = 'pause-menu';
export const pauseCountdownGroup = new THREE.Group();
pauseCountdownGroup.name = 'pause-countdown';
const floatingMessageGroup = new THREE.Group();
floatingMessageGroup.name = 'floating-message';

// ── Layout Loading ──
// Loads layout JSON from layouts/ directory. Falls back to hardcoded positions if fetch fails.
const layoutCache = {};
export async function loadLayout(screenName) {
  if (layoutCache[screenName]) return layoutCache[screenName];
  try {
    const resp = await fetch(`layouts/${screenName}.json`);
    if (!resp.ok) return null;
    const data = await resp.json();
    layoutCache[screenName] = data;
    return data;
  } catch (e) {
    // File not found or fetch not supported (e.g. file:// protocol)
    return null;
  }
}

// ── HUD Text Geometry Cache ───────────────────────────────────
// Pool PlaneGeometry by aspect ratio bins to avoid GPU object churn
// when HUD text changes frequently (score, kills, etc.)
const hudGeoCache = {};

function getHudGeo(width, height) {
  // Exact dimensions (no binning) to match editor rendering
  const key = `${width.toFixed(4)}x${height.toFixed(4)}`;
  if (!hudGeoCache[key]) {
    hudGeoCache[key] = new THREE.PlaneGeometry(width, height);
  }
  return hudGeoCache[key];
}

export function clearHudGeoCache() {
  for (const key of Object.keys(hudGeoCache)) {
    hudGeoCache[key].dispose();
    delete hudGeoCache[key];
  }
}

// HUD element references
let floatingMessageSprite = null;
let floatingMessageHideAt = null;
let floatingMessageText = null;
let floatingMessageSticky = false;

let heartsSprite = null;
let killCountSprite = null;
let levelSprite = null;
let scoreSprite = null;
let scoreTitleSprite = null;
let nukeEmojiSprite = null;
let nukeCountSprite = null;
let comboSprite = null;
let comboCooldownSprite = null;
let fpsSprite = null;
const FPS_SPRITE_BASE_WIDTH = 0.16;
const FPS_SPRITE_BASE_HEIGHT = 0.03;

// FPS counter optimization: reuse canvas/texture to avoid churn
let fpsCanvas = null;
let fpsCtx = null;
let fpsTexture = null;

// Debug menu state
// debugToggleItems removed with debug menu


// Upgrade card meshes (for raycasting)
// ── Upgrade card pooling ──────────────────────────────────────────
// Pre-allocate card geometry and border geometry (shared across all cards)
let _cardGeo = null;
let _cardBorderGeo = null;
let _skipCardGeo = null;
let _skipCardBorderGeo = null;
let _cardIconGeo = null;
let _skipIconGeo = null;

function getCardGeo() {
  if (!_cardGeo) _cardGeo = new THREE.PlaneGeometry(1.2, 1.5);
  return _cardGeo;
}
function getCardBorderGeo() {
  if (!_cardBorderGeo) _cardBorderGeo = new THREE.EdgesGeometry(getCardGeo());
  return _cardBorderGeo;
}
function getSkipCardGeo() {
  if (!_skipCardGeo) _skipCardGeo = new THREE.PlaneGeometry(1.0, 1.3);
  return _skipCardGeo;
}
function getSkipCardBorderGeo() {
  if (!_skipCardBorderGeo) _skipCardBorderGeo = new THREE.EdgesGeometry(getSkipCardGeo());
  return _skipCardBorderGeo;
}
function getCardIconGeo() {
  if (!_cardIconGeo) _cardIconGeo = new THREE.OctahedronGeometry(0.12, 0);
  return _cardIconGeo;
}
function getSkipIconGeo() {
  if (!_skipIconGeo) _skipIconGeo = new THREE.OctahedronGeometry(0.08, 0);
  return _skipIconGeo;
}

let upgradeCards = [];
let upgradeChoices = [];

// Hit flash (red sphere inside camera)
let hitFlash = null;
let hitFlashOpacity = 0;

// Speed lines overlay (radial streaks during slow-mo)
const ENABLE_SPEED_LINES = false; // Disabled: no visible effect on Quest, wastes a draw call
let speedLinesMesh = null;
let speedLinesOpacity = 0;

// Boss health bar (camera-attached, 3 segments for phases)
let bossHealthGroup = null;
let bossHealthBars = []; // 3 segments

// Title blink
let titleBlinkSprite = null;

// Title scoreboard button
let titleScoreboardBtn = null;
let titleSettingsBtn = null;

// Title diagnostics button
let titleDiagBtn = null;

// Ready screen countdown
let readyCountdownSprite = null;

// Name entry state
let nameEntryName = '';
let nameEntryCursor = 0;
let nameEntrySlots = [];
let keyboardKeys = [];
let nameEntryActionMeshes = [];
let hoveredKey = null;
let keyboardMeshCache = []; // Cached array of keyboard meshes for faster hit testing

// Name entry optimization: cached sprites and reusable character slot canvases
let nameEntryHeaderSprite = null;
let nameEntryScoreSprite = null;
let nameEntryCountrySprite = null;
let nameEntryChangeTextSprite = null;
let nameEntryCharSprites = []; // 6 pre-created character slot sprites
let nameEntryCharCanvases = []; // 6 reusable canvases for character slots
let nameEntryCharCtxs = []; // 6 reusable canvas contexts
let nameEntryCharTextures = []; // 6 reusable textures
let nameEntryStaticGroup = null; // Group to hold cached static sprites
let nameEntryInitialized = false; // Flag to track if sprites are pre-created

// Keyboard optimization: pooled materials and geometries
const keyboardKeyPool = {
  materials: {},
  geometries: {},
  borderMaterials: {},
  textLabels: {},
  initialized: false
};

// ── Keyboard Instancing: Hybrid Merged/Per-Key Approach ──────────
// Per-key box meshes (36 draw calls) for individual highlight control,
// merged border geometries (4 draw calls) and merged label atlas (1 draw call).
// Total: ~41 draw calls vs ~108 original.
let keyboardKeyMeshes = [];        // Per-key box meshes (individual materials for highlighting)
let keyboardAtlasSprite = null;     // Single sprite for all key labels
let keyboardHitTargets = [];        // Invisible planes for raycasting (positioned over each key)
let keyboardKeyLayout = [];         // Layout data: { x, y, w, key, type } for each key

// Level intro state
let levelIntroActive = false;
let levelIntroStartTime = 0;
let levelIntroStage = 'level'; // 'level', 'level_fading', 'start', 'start_fading', 'done'
let levelIntroLevelText = null;
let levelIntroStartText = null;

// Kills remaining alert state
let killsAlertActive = false;
let killsAlertStartTime = 0;
let killsAlertDisplayTime = 0;
let killsAlertMesh = null;

// Scoreboard state
const SCOREBOARD_CANVAS_WIDTH = 900;
const SCOREBOARD_CANVAS_HEIGHT = 1080;
let scoreboardCanvas = null;
let scoreboardCtx = null;
let scoreboardTexture = null;
let scoreboardMesh = null;
let scoreboardScrollOffset = 0;
let scoreboardScores = [];
let scoreboardHeader = '';
let scoreboardPage = 0;
let scoreboardSpinnerTimer = null;
const SCOREBOARD_PAGE_SIZE = 10;
let lastSubmittedTimestamp = null; // Track most recent score submission for highlighting
let lastSubmittedPageIndex = -1; // Page to auto-navigate to after submission

export function setLastSubmittedTimestamp(timestamp) {
  lastSubmittedTimestamp = timestamp;
}

export function setLastSubmittedPageIndex(pageIndex) {
  lastSubmittedPageIndex = pageIndex;
}

// Country select state
let countryListCanvas = null;
let countryListTexture = null;
let countryListMesh = null;
let countrySelectContinent = 'North America';
let countrySelectScrollOffset = 0;
let continentTabs = [];
let countryItems = [];
let countrySelectMode = 'country';

// ── Canvas text utility ────────────────────────────────────
function makeTextTexture(text, opts = {}) {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
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

  // Add proper padding for glow effects (glowSize needs at least glowSize+5 pixels on each side)
  const padding = opts.glow ? (opts.glowSize || 15) + 10 : 40;
  canvas.width = Math.ceil(textWidth) + padding * 2;
  canvas.height = Math.ceil(textHeight) + padding * 2;

  // Re-set after resize
  ctx.font = font;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  // Adjust drawing position for new padding
  const offsetX = 0;
  const offsetY = 0;

  // Clear canvas with transparency (prevent black background)
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // Optional glow
  if (opts.glow) {
    ctx.shadowColor = opts.glowColor || opts.color || '#00ffff';
    ctx.shadowBlur = opts.glowSize || 15;
  }

  // Drop shadow
  if (opts.shadow) {
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    lines.forEach((line, i) => {
      const y = (canvas.height / 2) - ((lines.length - 1) * lineHeight / 2) + (i * lineHeight);
      ctx.fillText(line, canvas.width / 2 + 2, y + 2 + offsetY);
    });
  }

  // Main text
  ctx.fillStyle = opts.color || '#00ffff';
  lines.forEach((line, i) => {
    const y = (canvas.height / 2) - ((lines.length - 1) * lineHeight / 2) + (i * lineHeight);
    ctx.fillText(line, canvas.width / 2, y + offsetY);
  });

  const texture = new THREE.CanvasTexture(canvas);
  texture.minFilter = THREE.LinearFilter;
  texture.premultiplyAlpha = false;
  return { texture, aspect: canvas.width / canvas.height };
}

export function makeSprite(text, opts = {}) {
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

// #23: Heart animation state
let heartAnimationState = {
  glowPhase: 0,
  hitFlash: 0,      // Timer for hit flash animation
  healthGain: 0,    // Timer for health gain animation
  shakeX: 0,        // Horizontal shake offset
};

// PERFORMANCE: Cache hearts canvas and texture to avoid recreating every frame
let _heartsCanvas = null;
let _heartsTexture = null;
let _heartsPrevHealth = -1;
let _heartsPrevMaxHealth = -1;
let _heartsPrevHitFlash = 0;
let _heartsPrevHealthGain = 0;

// (holographicState and holoMesh removed - floor HUD hologram shader was never wanted)

function drawHeart(ctx, x, y, pixSize, state, animState = {}) {
  // state: 'full', 'half', 'empty'
  // animState: { glowIntensity, hitFlash, isHealthGain }
  
  const glowIntensity = animState.glowIntensity || 0;
  const hitFlash = animState.hitFlash || 0;
  const isHealthGain = animState.isHealthGain || false;

  // Draw outline FIRST for all heart shapes (empty, half, full)
  // This creates a permanent pink border that's always visible
  HEART_PIXELS.forEach((row, py) => {
    row.forEach((px_on, px) => {
      if (!px_on) return;
      // Draw the outline pixels (edge pixels of the heart shape)
      const hasTop = py > 0 && HEART_PIXELS[py - 1][px];
      const hasBot = py < 5 && HEART_PIXELS[py + 1][px];
      const hasLft = px > 0 && row[px - 1];
      const hasRgt = px < 6 && row[px + 1];
      const isEdge = !(hasTop && hasBot && hasLft && hasRgt);

      if (isEdge) {
        // Pink outline (always drawn, visible even on empty hearts)
        ctx.fillStyle = 'rgba(255, 60, 120, 0.6)';
        ctx.fillRect(x + px * pixSize, y + py * pixSize, pixSize, pixSize);
      }
    });
  });

  // Now fill the heart pixels based on state
  HEART_PIXELS.forEach((row, py) => {
    row.forEach((px_on, px) => {
      if (!px_on) return;
      if (state === 'empty') {
        // Empty hearts: outline already drawn above, skip fill
        return;
      } else if (state === 'half' && px >= 4) {
        // Don't fill right side of half hearts
        return;
      } else {
        // Base color
        let r = 255, g = 0, b = 68;
        
        // #23: Health gain animation - turn green
        if (isHealthGain) {
          r = 0; g = 255; b = 100;
        }
        // #23: Hit flash animation - fade red
        else if (hitFlash > 0) {
          const t = hitFlash;
          r = 255;
          g = Math.floor(t * 50);
          b = Math.floor(68 + t * 100);
        }
        
        ctx.fillStyle = `rgb(${r},${g},${b})`;
      }
      ctx.fillRect(x + px * pixSize, y + py * pixSize, pixSize, pixSize);
    });
  });
  
  // #23: Draw glow effect around full hearts
  if (state === 'full' && glowIntensity > 0) {
    ctx.shadowColor = '#ff0044';
    ctx.shadowBlur = 8 + glowIntensity * 10;
    ctx.fillStyle = 'rgba(255, 0, 68, ' + (glowIntensity * 0.3) + ')';
    ctx.beginPath();
    ctx.arc(x + 3.5 * pixSize, y + 2 * pixSize, 4 * pixSize, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
  }
}

function makeHeartsTexture(health, maxHealth, animParams = {}) {
  const heartCount = maxHealth / 2;
  const pixSize = 8;
  const heartW = 7 * pixSize;
  const heartH = 6 * pixSize;
  const gap = 6;
  const canvasWidth = heartCount * (heartW + gap) + gap;
  const canvasHeight = heartH + 10;
  
  // PERFORMANCE: Reuse cached canvas instead of creating new one each frame
  if (!_heartsCanvas) {
    _heartsCanvas = document.createElement('canvas');
  }
  // Resize canvas if needed (maxHealth changed)
  if (_heartsCanvas.width !== canvasWidth || _heartsCanvas.height !== canvasHeight) {
    _heartsCanvas.width = canvasWidth;
    _heartsCanvas.height = canvasHeight;
  }
  const ctx = _heartsCanvas.getContext('2d');
  
  // Clear canvas before redrawing
  ctx.clearRect(0, 0, canvasWidth, canvasHeight);
  
  // #23: Animation parameters
  const glowPhase = animParams.glowPhase || 0;
  const hitFlash = animParams.hitFlash || 0;
  const healthGain = animParams.healthGain || 0;
  const shakeX = animParams.shakeX || 0;

  for (let i = 0; i < heartCount; i++) {
    const hpForThisHeart = health - i * 2;
    let state;
    if (hpForThisHeart >= 2) state = 'full';
    else if (hpForThisHeart === 1) state = 'half';
    else state = 'empty';
    
    // #23: Removed continuous glow pulse - hearts are now static
    // Only show glow effect if explicitly triggered (not used in static mode)
    const animState = {
      glowIntensity: 0,  // Static hearts, no continuous glow pulse
      hitFlash: hitFlash > 0 && i === Math.floor(health / 2) ? hitFlash : 0,
      isHealthGain: healthGain > 0 && i === Math.floor((health - 2) / 2) && state === 'full'
    };

    // #23: Apply shake offset for hit animation
    const offsetX = hitFlash > 0 ? shakeX : 0;
    
    drawHeart(ctx, gap + i * (heartW + gap) + offsetX, 5, pixSize, state, animState);
  }

  // PERFORMANCE: Reuse cached texture, only update when canvas content changes
  if (!_heartsTexture) {
    _heartsTexture = new THREE.CanvasTexture(_heartsCanvas);
    _heartsTexture.minFilter = THREE.LinearFilter;
    _heartsTexture.premultiplyAlpha = false;
  } else {
    _heartsTexture.needsUpdate = true;
  }
  return { texture: _heartsTexture, aspect: canvasWidth / canvasHeight };
}
// ── Public API ─────────────────────────────────────────────

export async function initHUD(camera, scene) {
  sceneRef = scene;
  cameraRef = camera;

  // Initialize damage number pools (pass triggerHitFlash to avoid circular dep)
  initDamageNumbers(scene, triggerHitFlash);

  // #11: Load November font for scoreboard
  loadNovemberFont();

  // Preload all layout files so they're cached for sync access
  await Promise.all([
    loadLayout('title-screen'),
    loadLayout('game-over'),
    loadLayout('upgrade-cards'),
    loadLayout('ready-screen'),
    loadLayout('scoreboard'),
  ]);

  // ── Title Screen (world-space, fixed position) ──
  await createTitleScreen();
  titleGroup.position.set(0, 1.2, -3.5);  // Moved down for better centering
  titleGroup.rotation.set(0, 0, 0);
  titleGroup.visible = true;
  scene.add(titleGroup);

  // ── VR HUD (stationary on floor, Space Pirate Trainer style) ──
  await createHUDElements();
  hudGroup.position.set(0, 0.0, -3);  // On floor, 3 feet in front of spawn; Y=0 to sit flush
  hudGroup.rotation.x = -Math.PI / 2 + 0.349;  // Face up + 20° tilt toward player (one-time static)
  scene.add(hudGroup);

  // ── UI Groups (initially hidden) ──
  floatingMessageGroup.visible = false;
  floatingMessageGroup.position.set(0, 0.1, -0.8);
  camera.add(floatingMessageGroup);

  [levelTextGroup, upgradeGroup, gameOverGroup, nameEntryGroup, scoreboardGroup, countrySelectGroup, readyGroup].forEach(g => {
    g.visible = false;
    g.rotation.set(0, 0, 0);
    scene.add(g);
  });

  // Pause menu in 3D world space (fixed position, not camera-locked)
  pauseMenuGroup.visible = false;
  pauseMenuGroup.rotation.set(0, 0, 0);
  scene.add(pauseMenuGroup);

  // Settings menu in 3D world space
  settingsGroup.visible = false;
  settingsGroup.rotation.set(0, 0, 0);
  scene.add(settingsGroup);

  // Disable frustum culling on all UI groups to prevent disappearing when looking around
  // UI elements have unreliable bounding boxes/spheres that cause false culling
  [
    titleGroup, hudGroup, floatingMessageGroup, levelTextGroup, upgradeGroup,
    gameOverGroup, nameEntryGroup, scoreboardGroup, countrySelectGroup,
    readyGroup, pauseMenuGroup, pauseCountdownGroup, settingsGroup
  ].forEach(g => { if (g) g.frustumCulled = false; });

  // Countdown still follows camera so player can see it
  pauseCountdownGroup.visible = false;
  pauseCountdownGroup.rotation.set(0, 0, 0);
  camera.add(pauseCountdownGroup);

  // ── Hit flash (red plane in front of camera) ──
  // VR damage indicator: bright red flash that covers entire view
  // Critical for VR since camera shake doesn't work well
  hitFlash = new THREE.Mesh(
    new THREE.PlaneGeometry(6, 6),  // Large enough to cover entire VR FOV
    new THREE.MeshBasicMaterial({
      color: 0xff2200,  // Bright red-orange for visibility across all biomes
      transparent: true,
      opacity: 0,
      depthTest: false,
      depthWrite: false,
      side: THREE.DoubleSide,
      blending: THREE.NormalBlending,  // Less harsh than additive for VR comfort
    }),
  );
  hitFlash.name = 'hit-flash';
  hitFlash.renderOrder = 999;
  hitFlash.visible = false;
  hitFlash.frustumCulled = false;  // Prevent disappearing when looking around
  hitFlash.position.set(0, 0, -0.25);  // Very close to camera for full coverage
  camera.add(hitFlash);

  // ── Speed Lines Overlay (radial streaks during slow-mo) ──
  if (ENABLE_SPEED_LINES) {
    const slCanvas = document.createElement('canvas');
    slCanvas.width = 512;
    slCanvas.height = 512;
    const slCtx = slCanvas.getContext('2d');
    // Draw radial streaks emanating from center
    const cx = 256, cy = 256;
    slCtx.clearRect(0, 0, 512, 512);
    const numLines = 80;
    for (let i = 0; i < numLines; i++) {
      const angle = (i / numLines) * Math.PI * 2 + (Math.random() - 0.5) * 0.15;
      const innerR = 60 + Math.random() * 40;
      const outerR = 200 + Math.random() * 56;
      const width = 1 + Math.random() * 2.5;
      const alpha = 0.08 + Math.random() * 0.18;
      slCtx.beginPath();
      slCtx.moveTo(cx + Math.cos(angle) * innerR, cy + Math.sin(angle) * innerR);
      slCtx.lineTo(cx + Math.cos(angle) * outerR, cy + Math.sin(angle) * outerR);
      slCtx.strokeStyle = `rgba(200, 220, 255, ${alpha})`;
      slCtx.lineWidth = width;
      slCtx.stroke();
    }
    // Add a subtle radial gradient fade so center is clear and edges are streaky
    const grad = slCtx.createRadialGradient(cx, cy, 50, cx, cy, 256);
    grad.addColorStop(0, 'rgba(0,0,0,0.6)');
    grad.addColorStop(0.4, 'rgba(0,0,0,0)');
    slCtx.globalCompositeOperation = 'destination-out';
    slCtx.fillStyle = grad;
    slCtx.fillRect(0, 0, 512, 512);

    const slTexture = new THREE.CanvasTexture(slCanvas);
    speedLinesMesh = new THREE.Mesh(
      new THREE.PlaneGeometry(6, 6),
      new THREE.MeshBasicMaterial({
        map: slTexture,
        transparent: true,
        opacity: 0,
        depthTest: false,
        depthWrite: false,
        side: THREE.DoubleSide,
        blending: THREE.AdditiveBlending,
      }),
    );
    speedLinesMesh.name = 'speed-lines';
    speedLinesMesh.renderOrder = 998;
    speedLinesMesh.visible = false;
    speedLinesMesh.frustumCulled = false;
    speedLinesMesh.position.set(0, 0, -0.26);
    camera.add(speedLinesMesh);
  }

  // ── FPS Counter (top left, attached to camera, more visible in VR) ──
  // Optimized: reuse canvas/texture to avoid creating/disposing every 250ms
  fpsCanvas = document.createElement('canvas');
  fpsCanvas.width = 1024;
  fpsCanvas.height = 128;
  fpsCtx = fpsCanvas.getContext('2d');
  fpsTexture = new THREE.CanvasTexture(fpsCanvas);
  fpsTexture.minFilter = THREE.LinearFilter;

  const fpsGeo = new THREE.PlaneGeometry(FPS_SPRITE_BASE_WIDTH, FPS_SPRITE_BASE_HEIGHT);  // 80% smaller: 0.8*0.2, 0.15*0.2
  const fpsMat = new THREE.MeshBasicMaterial({
    map: fpsTexture,
    transparent: true,
    depthTest: false,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
  fpsSprite = new THREE.Mesh(fpsGeo, fpsMat);
  fpsSprite.name = 'fps-counter';
  fpsSprite.position.set(-0.15, 0.12, -0.5);  // Moved closer to center
  fpsSprite.renderOrder = 1001;
  fpsSprite.frustumCulled = false;  // Prevent disappearing when looking around
  camera.add(fpsSprite);

  // ── Boss health bar (top center, camera-attached, 3 segments) ──
  bossHealthGroup = new THREE.Group();
  bossHealthGroup.name = 'boss-health-bar';
  bossHealthGroup.position.set(0, 0.22, -0.8);
  bossHealthGroup.visible = false;
  const barWidth = 0.30;
  const barHeight = 0.03;
  const gap = 0.014;

  // Background bar for contrast (dark strip behind the health segments)
  const bgGeo = new THREE.PlaneGeometry(barWidth * 3 + gap * 4, barHeight + 0.008);
  const bgMat = new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.6, side: THREE.DoubleSide, depthTest: false, depthWrite: false });
  const bgBar = new THREE.Mesh(bgGeo, bgMat);
  bgBar.renderOrder = 999;
  bgBar.name = 'boss-health-bar-bg';
  bossHealthGroup.add(bgBar);

  for (let i = 0; i < 3; i++) {
    const geo = new THREE.PlaneGeometry(barWidth, barHeight);
    // Shift geometry so pivot is at left edge: bars shrink from left, not center
    geo.translate(barWidth / 2, 0, 0);
    const mat = new THREE.MeshBasicMaterial({ color: 0xff0044, transparent: true, opacity: 0.95, side: THREE.DoubleSide, depthTest: false, depthWrite: false });
    const bar = new THREE.Mesh(geo, mat);
    bar.position.x = (i - 1) * (barWidth + gap) - barWidth / 2;
    bar.name = `boss-health-bar-seg-${i}`;
    bar.renderOrder = 1000;
    bossHealthGroup.add(bar);
    bossHealthBars.push(bar);
  }
  bossHealthGroup.frustumCulled = false;  // Prevent disappearing when looking around
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

async function createTitleScreen() {
  // Big title: SPACEOMICIDE
  const titleSprite = makeSprite('SPACEOMICIDE', {
    fontSize: 70,
    color: '#00ffff',
    glow: true, glowColor: '#0088ff', glowSize: 15,
    scale: 1.0,
  });
  titleSprite.position.set(0, 0.932, 0);
  titleSprite.name = 'titleSprite';
  titleGroup.add(titleSprite);

  // Subtitle
  const subSprite = makeSprite('VR ROGUELIKE BLASTER', {
    fontSize: 24,
    color: '#ff00ff',
    glow: true, glowColor: '#ff00ff', glowSize: 5,
    scale: 0.7,
  });
  subSprite.position.set(0, 0.5, 0);
  subSprite.name = 'subSprite';
  titleGroup.add(subSprite);

  // Blinking "Press Trigger to Begin"
  titleBlinkSprite = makeSprite('PRESS TRIGGER TO BEGIN', {
    fontSize: 26,
    color: '#ffffff',
    glow: true, glowColor: '#ffffff',
    scale: 0.5,
  });
  titleBlinkSprite.position.set(0, -0.065, 0);
  titleBlinkSprite.name = 'titleBlinkSprite';
  titleGroup.add(titleBlinkSprite);

  // Scoreboard button
  const btnGroup = new THREE.Group();
  btnGroup.position.set(-0.36, -0.68, 0);
  btnGroup.name = 'btnGroup';
  const btnGeo = new THREE.PlaneGeometry(1.35, 0.3);
  const btnMat = new THREE.MeshBasicMaterial({
    color: 0x110033,
    transparent: true,
    opacity: 0.85,
    side: THREE.DoubleSide,
  });
  const btnMesh = new THREE.Mesh(btnGeo, btnMat);
  btnMesh.userData.isTitleScoreboardBtn = true;
  btnMesh.userData.borderColor = 0xffff00;  // Yellow border for hover glow
  btnGroup.add(btnMesh);
  const btnBorderGeo = new THREE.EdgesGeometry(btnGeo);
  btnGroup.add(new THREE.LineSegments(btnBorderGeo, new THREE.LineBasicMaterial({ color: 0xffff00 })));
  const btnText = makeSprite('SCOREBOARD', {
    fontSize: 48,
    color: '#ffff00',
    glow: true,
    glowColor: '#ffff00',
    scale: 0.16,
  });
  btnText.position.set(0, 0, 0.01);
  btnGroup.add(btnText);
  titleGroup.add(btnGroup);
  titleScoreboardBtn = btnMesh;

  // ── Settings gear button (next to SCOREBOARD) ──
  const settingsBtnGroup = new THREE.Group();
  settingsBtnGroup.position.set(0.82, -0.68, 0);
  settingsBtnGroup.name = 'settingsBtnGroup';
  const settingsBtnGeo = new THREE.PlaneGeometry(0.4, 0.3);
  const settingsBtnMat = new THREE.MeshBasicMaterial({
    color: 0x110033,
    transparent: true,
    opacity: 0.85,
    side: THREE.DoubleSide,
  });
  const settingsBtnMesh = new THREE.Mesh(settingsBtnGeo, settingsBtnMat);
  settingsBtnMesh.userData.isTitleSettingsBtn = true;
  settingsBtnMesh.userData.borderColor = 0x00ffff;
  settingsBtnGroup.add(settingsBtnMesh);
  settingsBtnGroup.add(new THREE.LineSegments(
    new THREE.EdgesGeometry(settingsBtnGeo),
    new THREE.LineBasicMaterial({ color: 0x00ffff })
  ));
  const settingsBtnText = makeSprite('\u2699', {
    fontSize: 48,
    color: '#00ffff',
    glow: true,
    glowColor: '#00ffff',
    scale: 0.5,
  });
  settingsBtnText.position.set(0, 0, 0.01);
  settingsBtnGroup.add(settingsBtnText);
  titleGroup.add(settingsBtnGroup);
  titleSettingsBtn = settingsBtnMesh;

  // Apply layout overrides
  const layout = await loadLayout('title-screen');
  if (layout?.elements) {
    if (layout.elements.titleSprite) {
      const _le = layout.elements.titleSprite;
      titleSprite.position.set(_le.x, _le.y, _le.z);
      if (_le.scale != null) titleSprite.scale.setScalar(_le.scale);
    }
    if (layout.elements.subSprite) {
      const _le = layout.elements.subSprite;
      subSprite.position.set(_le.x, _le.y, _le.z);
      if (_le.scale != null) subSprite.scale.setScalar(_le.scale);
    }
    if (layout.elements.titleBlinkSprite) {
      const _le = layout.elements.titleBlinkSprite;
      titleBlinkSprite.position.set(_le.x, _le.y, _le.z);
      if (_le.scale != null) titleBlinkSprite.scale.setScalar(_le.scale);
    }
    if (layout.elements.btnGroup) {
      const _le = layout.elements.btnGroup;
      btnGroup.position.set(_le.x, _le.y, _le.z);
    }
    if (layout.elements.settingsBtnGroup) {
      const _le = layout.elements.settingsBtnGroup;
      settingsBtnGroup.position.set(_le.x, _le.y, _le.z);
      if (_le.scale != null) settingsBtnText.scale.setScalar(_le.scale);
    }
  }
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

// (holoVertexShader, holoFragmentShader, createHoloShaderMaterial removed)

async function createHUDElements() {
  hudGroup.visible = false;
  hudGroup.renderOrder = 999;

  // Load layout from JSON (falls back to hardcoded values if missing)
  const floorLayout = await loadLayout('floor-hud');

  // Floor-based HUD layout (Space Pirate Trainer style)
  // Increased by 200% (3x) for better visibility

  // HOLOGRAPHIC BASE - no background box (glitch/scanline overlays are separate below)

  // (holoMesh removed - hologram shader overlay was never wanted)

  // Lives (hearts) - left side on floor
  // #19: Hearts aligned with TOP of SCORE and LEVEL X titles
  // Layout: Spread horizontally to avoid overlap
  const heartsGeo = new THREE.PlaneGeometry(1.7875, 0.55);
  const heartsMat = new THREE.MeshBasicMaterial({ transparent: true, depthTest: true, depthWrite: false, side: THREE.DoubleSide });
  heartsSprite = new THREE.Mesh(heartsGeo, heartsMat);
  heartsSprite.position.set(-2.3 + (1.7875 / 2), 0.56, 0.01);  // Left-aligned: offset by half width so left edge at -2.3 (v13)
  if (floorLayout?.elements?.hearts) {
    const _le = floorLayout.elements.hearts;
    heartsSprite.position.set(_le.x, _le.y, _le.z);
  }
  heartsSprite.renderOrder = 999;
  heartsSprite.name = 'floor-hud-hearts';
  hudGroup.add(heartsSprite);

  // SCORE - center-left on floor with title above
  // Layout: Spread from hearts, number centered under SCORE title
  scoreSprite = makeSprite('0', { fontSize: 72, color: '#ffff00', shadow: true, scale: 0.45 });
  scoreSprite.position.set(0, 0.32, 0.01);  // Centered under SCORE title (v13)
  if (floorLayout?.elements?.score_num) {
    const _le = floorLayout.elements.score_num;
    scoreSprite.position.set(_le.x, _le.y, _le.z);
  }
  scoreSprite.name = 'floor-hud-score';
  hudGroup.add(scoreSprite);

  // SCORE title - above score in yellow same style as level
  scoreTitleSprite = makeSprite('SCORE', { fontSize: 72, color: '#ffff00', glow: true, glowColor: '#ffff00', scale: 0.45 });
  scoreTitleSprite.position.set(0, 0.58, 0.01);  // Top row
  if (floorLayout?.elements?.score_title) {
    const _le = floorLayout.elements.score_title;
    scoreTitleSprite.position.set(_le.x, _le.y, _le.z);
  }
  scoreTitleSprite.name = 'floor-hud-score-title';
  hudGroup.add(scoreTitleSprite);

  // Kill counter — below LEVEL display
  // Layout: Center-right, below level
  killCountSprite = makeSprite('0/0', { fontSize: 72, color: '#ffffff', shadow: true, scale: 0.45 });
  killCountSprite.position.set(1.02, 0.3, 0.01);  // Center-right, second row
  if (floorLayout?.elements?.kills) {
    const _le = floorLayout.elements.kills;
    killCountSprite.position.set(_le.x, _le.y, _le.z);
  }
  killCountSprite.name = 'floor-hud-kills';
  hudGroup.add(killCountSprite);

  // Level indicator — above kill counter
  // Layout: Center-right, top row
  levelSprite = makeSprite('LEVEL 1', { fontSize: 72, color: '#00ffff', glow: true, scale: 0.45 });
  levelSprite.position.set(1.02, 0.58, 0.01);  // Center-right, top row
  if (floorLayout?.elements?.level) {
    const _le = floorLayout.elements.level;
    levelSprite.position.set(_le.x, _le.y, _le.z);
  }
  levelSprite.name = 'floor-hud-level';
  hudGroup.add(levelSprite);

  // Nuke counter — far right, top row; emoji 2x size, count text normal
  nukeEmojiSprite = makeSprite('☢', { fontSize: 144, color: '#ffff44', glow: true, glowColor: '#ffff44', scale: 0.9 });
  nukeEmojiSprite.position.set(1.82, 0.5, 0.01);  // Far right (v13)
  if (floorLayout?.elements?.nuke_icon) {
    const _le = floorLayout.elements.nuke_icon;
    nukeEmojiSprite.position.set(_le.x, _le.y, _le.z);
  }
  nukeEmojiSprite.name = 'floor-hud-nuke-icon';
  hudGroup.add(nukeEmojiSprite);
  nukeCountSprite = makeSprite('X3', { fontSize: 72, color: '#ffff44', glow: true, glowColor: '#ffff44', scale: 0.35 });
  nukeCountSprite.position.set(2.12, 0.5, 0.01);  // Far right (v13)
  if (floorLayout?.elements?.nuke_count) {
    const _le = floorLayout.elements.nuke_count;
    nukeCountSprite.position.set(_le.x, _le.y, _le.z);
  }
  nukeCountSprite.name = 'floor-hud-nuke-count';
  hudGroup.add(nukeCountSprite);

  // Accuracy bonus — center, just below main HUD row
  // Y=-0.45 keeps it close to the SCORE/LEVEL row (Y=0.3) without overlap
  // NOTE: combo_text uses center-aligned geometry; left-alignment would require
  // updating position each frame since text width varies with the accuracy multiplier.
  comboSprite = makeSprite('1x', { fontSize: 40, color: '#ff8800', shadow: true, scale: 0.25 });
  comboSprite.position.set(-2.26, 0.1, 0.01);
  // Left-align: offset by half geometry width so left edge sits at x=-2.26
  const comboGeoW = comboSprite.geometry.parameters?.width || 1;
  comboSprite.position.x = -2.26 + comboGeoW / 2;  // Left side, below hearts (v13)
  if (floorLayout?.elements?.combo_text) {
    const _le = floorLayout.elements.combo_text;
    comboSprite.position.set(_le.x, _le.y, _le.z);
  }
  comboSprite.visible = false;
  comboSprite.name = 'floor-hud-combo-text';
  hudGroup.add(comboSprite);

  // Accuracy bonus meter bar — directly below combo text
  // Geometry shifted so pivot is left edge: bar shrinks from left, not center
  const cooldownGeo = new THREE.PlaneGeometry(1.65, 0.05);
  cooldownGeo.translate(0.825, 0, 0); // shift right by half width for left-edge pivot
  const cooldownMat = new THREE.MeshBasicMaterial({ color: 0xff8800, transparent: true, opacity: 0.8 });
  comboCooldownSprite = new THREE.Mesh(cooldownGeo, cooldownMat);
  comboCooldownSprite.position.set(-2.202, 0.21, 0.01);  // Left side, below combo text (v13) - geo.translate handles left-edge pivot
  if (floorLayout?.elements?.combo_bar) {
    const _le = floorLayout.elements.combo_bar;
    comboCooldownSprite.position.set(_le.x, _le.y, _le.z);
  }
  comboCooldownSprite.visible = false;
  comboCooldownSprite.name = 'floor-hud-combo-bar';
  hudGroup.add(comboCooldownSprite);
}

export function showHUD() {
  hudGroup.visible = true;
}

export function hideHUD() {
  hudGroup.visible = false;
}

// #23: Heart animation triggers
export function triggerHeartHitAnimation() {
  heartAnimationState.hitFlash = 1.0;
  heartAnimationState.shakeX = 0;
}

// (triggerHoloGlitch removed)

export function resetHoloGlitch() {
  // Hologram mesh removed, but keep HUD position reset for safety
  if (hudGroup) {
    hudGroup.position.x = 0;
    hudGroup.position.z = -3;
  }
}

// (updateHolographicGlitch removed - hologram shader stripped)

export function triggerHealthGainAnimation() {
  heartAnimationState.healthGain = 1.0;
}

export function updateSpriteText(sprite, text, opts = {}) {
  // Build a cache key from text + opts to avoid recreating geometry/texture
  // when nothing visually changed (e.g. repeated updateHUD calls between kills)
  const cacheKey = text + '|' + (opts.fontSize || 40) + '|' + (opts.color || '#ffffff') +
    '|' + (opts.glow ? '1' : '0') + '|' + (opts.glowColor || '') + '|' + (opts.scale || 0.3);
  if (sprite.userData._lastTextCacheKey === cacheKey) return;
  sprite.userData._lastTextCacheKey = cacheKey;

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
  // Use cached geometry by aspect ratio bin to avoid GPU object churn
  const scale = opts.scale || 0.3;
  sprite.geometry = getHudGeo(aspect * scale, scale);
}

export function updateHUD(gameState) {
  if (!hudGroup.visible) return;

  // #23: Removed continuous glow pulse animation for performance
  // Hearts are now static - only animate when health changes (hitFlash, healthGain)
  const now = performance.now();

  // Update floating message (auto-hide after duration)
  updateFloatingMessage(now);

  // Decay hit flash
  if (heartAnimationState.hitFlash > 0) {
    heartAnimationState.hitFlash -= 0.05;
    if (heartAnimationState.hitFlash < 0) heartAnimationState.hitFlash = 0;
    // Shake effect
    heartAnimationState.shakeX = (Math.random() - 0.5) * 4 * heartAnimationState.hitFlash;
  }

  // Decay health gain flash
  if (heartAnimationState.healthGain > 0) {
    heartAnimationState.healthGain -= 0.03;
    if (heartAnimationState.healthGain < 0) heartAnimationState.healthGain = 0;
  }

  // (holographic update removed)

  // Hearts - proper aspect ratio with correct scale and animation
  // PERFORMANCE: Only rebuild texture when health or animation state actually changes
  const healthChanged = gameState.health !== _heartsPrevHealth || gameState.maxHealth !== _heartsPrevMaxHealth;
  const animChanged = heartAnimationState.hitFlash !== _heartsPrevHitFlash || heartAnimationState.healthGain !== _heartsPrevHealthGain;
  
  if (healthChanged || animChanged) {
    _heartsPrevHealth = gameState.health;
    _heartsPrevMaxHealth = gameState.maxHealth;
    _heartsPrevHitFlash = heartAnimationState.hitFlash;
    _heartsPrevHealthGain = heartAnimationState.healthGain;
    
    const { texture: ht, aspect: ha } = makeHeartsTexture(gameState.health, gameState.maxHealth, heartAnimationState);
    // PERFORMANCE: Don't dispose old texture - we're reusing the cached texture
    heartsSprite.material.map = ht;
    heartsSprite.material.needsUpdate = true;
    // Cache geometry by maxHealth to avoid recreating on every frame
    if (heartsSprite.userData._heartsMaxHP !== gameState.maxHealth) {
      heartsSprite.userData._heartsMaxHP = gameState.maxHealth;
      heartsSprite.geometry = getHudGeo(1.7875, 0.55);
    }
  }

  // Kill counter - #5: Moved up closer to LEVEL display
  // #6: Moved left to x=0.5 (center-right) to be closer to SCORE display
  const cfg = gameState._levelConfig;
  const killTarget = cfg ? cfg.killTarget : 0;
  updateSpriteText(killCountSprite, `${gameState.kills} / ${killTarget}`, { fontSize: 72, color: '#ffffff', scale: 0.45 });

  // Level - #6: Moved left to x=0.5 (center-right) closer to SCORE display
  // #7: Scale 0.45 matches SCORE title for perfect alignment
  updateSpriteText(levelSprite, `LEVEL ${gameState.level}`, { fontSize: 72, color: '#00ffff', glow: true, glowColor: '#00ffff', scale: 0.45 });

  // Score - #4: fontSize:75 scale:0.45 matches kill counter for consistency
  updateSpriteText(scoreSprite, `${gameState.score}`, { fontSize: 72, color: '#ffff00', scale: 0.45 });

  // Nuke counter - #6: Moved to x=1.4 (right) on top row, right of LEVEL display
  const nukeCount = gameState.nukes || 0;
  if (nukeCount > 0 && nukeEmojiSprite) {
    nukeEmojiSprite.visible = true;
    nukeCountSprite.visible = true;
    updateSpriteText(nukeCountSprite, `X${nukeCount}`, { color: '#ffff44', glow: true, glowColor: '#ffff44', scale: 0.35 });
  } else if (nukeEmojiSprite) {
    nukeEmojiSprite.visible = false;
    nukeCountSprite.visible = false;
  }

  // Accuracy bonus - 200% larger with descriptive label
  const accuracyBonus = game.accuracyBonus || 0;
  if (accuracyBonus > 0) {
    comboSprite.visible = true;
    comboCooldownSprite.visible = true;
    const accuracyMult = (game.accuracyMultiplier || 1).toFixed(1);
    updateSpriteText(comboSprite, `${accuracyMult}X ACCURACY BONUS`, { color: '#ff8800', scale: 0.25 });
    // Left-align: re-apply offset after text change (width varies with multiplier)
    const cw = comboSprite.geometry.parameters?.width || 1;
    comboSprite.position.x = -2.26 + cw / 2;

    // Update bonus meter
    const remainingRatio = Math.max(0, Math.min(1, accuracyBonus / 100));
    comboCooldownSprite.scale.x = remainingRatio;

    // Color changes as bonus grows
    if (remainingRatio > 0.66) {
      comboCooldownSprite.material.color.setHex(0xff8800);  // Orange
    } else if (remainingRatio > 0.33) {
      comboCooldownSprite.material.color.setHex(0xffaa00);  // Yellow-orange
    } else {
      comboCooldownSprite.material.color.setHex(0xff4444);  // Red (low bonus)
    }
  } else {
    comboSprite.visible = false;
    comboCooldownSprite.visible = false;
  }
}

// ── Level Complete / Transition Text ───────────────────────

export function showLevelComplete(level, playerPos) {
  // Clear old with proper disposal
  disposeGroupChildren(levelTextGroup);

  const s1 = makeSprite('LEVEL COMPLETE!', { fontSize: 80, color: '#00ffff', glow: true, glowSize: 20, scale: 0.75 });
  s1.position.set(0, 0.3, 0);  // Moved down for better centering
  levelTextGroup.add(s1);

  // Position in front of player (VR-friendly)
  levelTextGroup.position.copy(playerPos);
  levelTextGroup.position.y += 1.3 + SCENE_Y_OFFSET; // Moved down for better centering
  levelTextGroup.position.z -= 3; // 3 feet in front of player
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
  upgradeGroup.userData.hoveredSelections = {};

  // Position in front of player (VR-friendly)
  // Add null check for playerPos
  if (playerPos && typeof playerPos.x === 'number') {
    upgradeGroup.position.copy(playerPos);
  } else {
    console.warn('[hud] showUpgradeCards received invalid playerPos, using default');
    upgradeGroup.position.set(0, 1.6 + SCENE_Y_OFFSET, -4);
  }
  upgradeGroup.position.y += 0.9 + SCENE_Y_OFFSET; // Moved down for better centering
  upgradeGroup.position.z -= 4; // 4 feet in front of player

  // Two-line upgrade header: "CHOOSE UPGRADE" in white + hand name in hand color
  const handName = hand === 'left' ? 'LEFT BLASTER' : 'RIGHT BLASTER';
  const handColor = hand === 'left' ? '#00ffff' : '#ff88aa';  // cyan for left, pink for right
  const headerCanvas = document.createElement('canvas');
  const hCtx = headerCanvas.getContext('2d');
  const hFontSize = 48;
  hCtx.font = `bold ${hFontSize}px Arial, sans-serif`;
  const line1Text = 'CHOOSE UPGRADE';
  const line2Text = handName;
  const line1W = hCtx.measureText(line1Text).width;
  const line2W = hCtx.measureText(line2Text).width;
  const maxW = Math.ceil(Math.max(line1W, line2W));
  const hLineHeight = hFontSize * 1.3;
  const hPad = 25;  // glow padding
  headerCanvas.width = maxW + hPad * 2;
  headerCanvas.height = Math.ceil(hLineHeight * 2) + hPad * 2;
  hCtx.font = `bold ${hFontSize}px Arial, sans-serif`;
  hCtx.textAlign = 'center';
  hCtx.textBaseline = 'middle';
  // Line 1: white with glow
  hCtx.shadowColor = '#ffffff';
  hCtx.shadowBlur = 15;
  hCtx.fillStyle = '#ffffff';
  const hMidY = headerCanvas.height / 2;
  hCtx.fillText(line1Text, headerCanvas.width / 2, hMidY - hLineHeight / 2);
  // Line 2: hand color with glow
  hCtx.shadowColor = handColor;
  hCtx.fillStyle = handColor;
  hCtx.fillText(line2Text, headerCanvas.width / 2, hMidY + hLineHeight / 2);
  const headerTexture = new THREE.CanvasTexture(headerCanvas);
  headerTexture.minFilter = THREE.LinearFilter;
  headerTexture.premultiplyAlpha = false;
  const headerAspect = headerCanvas.width / headerCanvas.height;
  const headerScale = 0.4;
  const headerGeom = new THREE.PlaneGeometry(headerAspect * headerScale, headerScale);
  const headerMat = new THREE.MeshBasicMaterial({ map: headerTexture, transparent: true, depthTest: false, depthWrite: false, side: THREE.DoubleSide });
  const header = new THREE.Mesh(headerGeom, headerMat);
  header.renderOrder = 999;
  header.position.set(0, 1.05, 0);
  header.name = 'upgrade-cards-header';
  upgradeGroup.add(header);

  // Cooldown text
  const cooldownSprite = makeSprite('WAIT...', { fontSize: 36, color: '#ffff00', scale: 0.3 });
  cooldownSprite.position.set(0, 0.8, 0);
  cooldownSprite.name = 'upgrade-cards-cooldown';
  upgradeGroup.add(cooldownSprite);

  // Shuffle upgrades so cards are random each time
  const shuffledUpgrades = [...upgrades];
  for (let i = shuffledUpgrades.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffledUpgrades[i], shuffledUpgrades[j]] = [shuffledUpgrades[j], shuffledUpgrades[i]];
  }
  // Four cards evenly spaced (3 upgrades + 1 skip option)
  const positions = [
    new THREE.Vector3(-2.25, 0, 0),
    new THREE.Vector3(-0.75, 0, 0),
    new THREE.Vector3(0.75, 0, 0),
    new THREE.Vector3(2.25, 0, 0),
  ];

  // Limit to first 3 upgrades only
  shuffledUpgrades.slice(0, 3).forEach((upg, i) => {
    const card = createUpgradeCard(upg, positions[i], hand);
    card.name = `upgrade-card-${i}`;
    upgradeGroup.add(card);
    upgradeCards.push(card);
  });

  // Add SKIP card as 4th option
  const skipCard = createSkipCard(positions[3]);
  skipCard.name = 'upgrade-card-3';
  upgradeGroup.add(skipCard);
  upgradeCards.push(skipCard);

  // Warp-in animation: each card's children pop in with easeOutCubic (clean ease-out grow)
  const warpBaseTime = performance.now();
  _warpPieceIndex = 0; // Reset piece counter for text queue
  upgradeCards.forEach((cardGroup, i) => {
    const cardDelay = i * CARD_WARP_STAGGER;
    cardGroup.userData._warpBaseTime = warpBaseTime;
    cardGroup.userData._warpCardDelay = cardDelay;
    cardGroup.userData._warpActive = true;
    // Set warp start times on pre-created children (face, border, icon)
    cardGroup.children.forEach(child => {
      if (child.userData._warpPiece) {
        const pieceDelay = child.userData._warpPiece === 'face' ? 0
          : child.userData._warpPiece === 'border' ? PIECE_WARP_STAGGER
          : PIECE_WARP_STAGGER * 2;
        child.userData._warpStartTime = warpBaseTime + cardDelay + pieceDelay;
        child.userData._warpActive = true;
      }
    });
  });

  // Apply layout overrides (sync since preloaded)
  const layout = layoutCache['upgrade-cards'];
  if (layout?.elements) {
    if (layout.elements.header) {
      const _le = layout.elements.header;
      header.position.set(_le.x, _le.y, _le.z);
    }
    if (layout.elements.cooldownSprite) {
      const _le = layout.elements.cooldownSprite;
      cooldownSprite.position.set(_le.x, _le.y, _le.z);
    }
    // Apply card positions from layout
    for (let i = 0; i < 4; i++) {
      const cardKey = `card${i}`;
      if (layout.elements[cardKey] && upgradeCards[i]) {
        const _le = layout.elements[cardKey];
        upgradeCards[i].position.set(_le.x, _le.y, _le.z);
      }
    }
  }
}

// Helper function to generate "before → after" text for stackable upgrades
function getUpgradeTotalText(upgrade, hand) {
  const currentCount = game.upgrades[hand][upgrade.id] || 0;
  const nextCount = currentCount + 1;
  
  // Non-stackable upgrades - no total shown
  const nonStackable = [
    'piercing', 'focused_frenzy', 'duck_hunt', 'its_electric', 'tesla_coil',
    'quick_charge', 'excess_heat', 'death_ray', 'hold_together'
  ];
  if (nonStackable.includes(upgrade.id)) {
    return null;
  }
  
  // Generate appropriate format based on upgrade type
  switch (upgrade.id) {
    case 'scope':
    case 'mega_scope':
      // Damage: +10 per scope, +25 per mega_scope
      const dmgPerStack = upgrade.id === 'mega_scope' ? 25 : 10;
      const dmgPerMega = (game.upgrades[hand]['mega_scope'] || 0) * 25;
      const dmgPerScope = (game.upgrades[hand]['scope'] || 0) * 10;
      const currentDmg = dmgPerScope + dmgPerMega;
      const nextDmg = currentDmg + dmgPerStack;
      return `(+${currentDmg} → +${nextDmg})`;
    
    case 'barrel':
    case 'turbo_barrel':
      // Fire rate: +15% per barrel, +30% per turbo_barrel
      const firePerStack = upgrade.id === 'turbo_barrel' ? 30 : 15;
      const firePerBarrel = (game.upgrades[hand]['barrel'] || 0) * 15;
      const firePerTurbo = (game.upgrades[hand]['turbo_barrel'] || 0) * 30;
      const currentFire = firePerBarrel + firePerTurbo;
      const nextFire = currentFire + firePerStack;
      return `(+${currentFire}% → +${nextFire}%)`;
    
    case 'double_shot':
    case 'triple_shot':
      // Projectile count: +1 per double_shot, +2 per triple_shot
      const shotPerDouble = (game.upgrades[hand]['double_shot'] || 0) * 1;
      const shotPerTriple = (game.upgrades[hand]['triple_shot'] || 0) * 2;
      const currentShots = shotPerDouble + shotPerTriple;
      const addedShots = upgrade.id === 'triple_shot' ? 2 : 1;
      const nextShots = currentShots + addedShots;
      return `(${currentShots} → ${nextShots})`;
    
    case 'critical':
    case 'super_crit':
      // Crit chance: +15% per critical, +25% per super_crit
      const critPerStack = upgrade.id === 'super_crit' ? 25 : 15;
      const critPerCrit = (game.upgrades[hand]['critical'] || 0) * 15;
      const critPerSuper = (game.upgrades[hand]['super_crit'] || 0) * 25;
      const currentCrit = critPerCrit + critPerSuper;
      const nextCrit = Math.min(currentCrit + critPerStack, 90); // Max 90%
      return `(${currentCrit}% → ${nextCrit}%)`;
    
    case 'vampiric':
      // Heal every 5 kills
      const currentVamp = 6 - Math.min(currentCount, 4);
      const nextVamp = 6 - Math.min(nextCount, 4);
      return `(Heal every ${currentVamp} kills → ${nextVamp} kills)`;
    
    case 'life_steal':
      // Heal every 3 kills per stack (2x better than vampiric)
      const currentLife = Math.max(3 - (game.upgrades[hand]['vampiric'] || 0), 1);
      const nextLife = Math.max(3 - (game.upgrades[hand]['vampiric'] || 0) - 1, 1);
      return `(Heal every ${currentLife} kills → ${nextLife} kills)`;
    
    case 'shock':
    case 'fire':
    case 'freeze':
      // Status effect stacks
      return `(${currentCount} → ${nextCount} stacks)`;
    
    case 'ricochet':
      // Ricochet: bounce damage starts at 50%, +25% per stack
      const ricochetDmg = 50 + (currentCount * 25);
      const nextRicochetDmg = ricochetDmg + 25;
      return `(Ricochet @ ${ricochetDmg}% → ${nextRicochetDmg}% damage)`;
    
    case 'extra_nuke':
      // Nuke charges
      const currentNukes = game.nukes || 0;
      const nextNukes = currentNukes + 1;
      return `(${currentNukes} → ${nextNukes} charges)`;
    
    case 'overcharge':
      // 20% damage multiplier per stack
      const currentOvercharge = (currentCount * 20);
      const nextOvercharge = (nextCount * 20);
      return `(+${currentOvercharge}% → +${nextOvercharge}% damage)`;
    
    case 'mega_boom':
      // AOE + explosion damage
      return `(${currentCount} → ${nextCount} stacks)`;
    
    case 'buckshot_gentlemen':
      // Buckshot: +4 pellets per stack
      const currentBuckshots = currentCount * 4;
      const nextBuckshots = nextCount * 4;
      return `(+${currentBuckshots} → +${nextBuckshots} pellets)`;
    
    case 'gimme_more':
      // Seeker Burst: +2 homing shots per stack
      const currentGimme = currentCount * 2;
      const nextGimme = nextCount * 2;
      return `(+${currentGimme} → +${nextGimme} shots)`;
    
    default:
      // Generic fallback for any other stackable upgrade
      return `(${currentCount} → ${nextCount})`;
  }
}

// Queue for deferred text sprite creation (avoids 12-16 makeSprite calls in one frame)
const _textQueue = [];
const TEXT_PER_FRAME = 1; // One sprite per frame to spread GPU upload cost on Quest

// ── Upgrade card warp-in animation (matches enemy spawn warp) ──
const CARD_WARP_DURATION = 500; // ms per piece
const CARD_WARP_STAGGER = 200; // ms between cards
const PIECE_WARP_STAGGER = 100; // ms between pieces within a card

function easeOutCubic(t) {
  return 1 - Math.pow(1 - t, 3);
}

function queueTextSprite(group, text, opts, pos) {
  _textQueue.push({ group, text, opts, pos });
}

// Track per-card piece index for warp stagger
let _warpPieceIndex = 0;

function flushCardTextQueue() {
  if (_textQueue.length === 0) return;
  const batch = _textQueue.splice(0, TEXT_PER_FRAME);
  for (const item of batch) {
    const sprite = makeSprite(item.text, item.opts);
    sprite.position.copy(item.pos);
    sprite.scale.set(0.01, 0.01, 0.01); // Start invisible for warp-in
    sprite.userData._warpStartTime = performance.now();
    sprite.userData._warpActive = true;
    _warpPieceIndex++;
    item.group.add(sprite);
  }
}

/**
 * Attach stable selection metadata to the card Group and its clickable face.
 * This keeps hover and trigger selection resilient even if card composition changes.
 *
 * @param {THREE.Group} group - Upgrade card root group.
 * @param {THREE.Mesh} faceMesh - Visible card plane used for hover glow.
 * @param {object} upgrade - Upgrade definition or SKIP pseudo-upgrade.
 * @param {string} hand - Target hand for the selection.
 * @returns {{ upgrade: object, hand: string }}
 */
function attachUpgradeSelectionData(group, faceMesh, upgrade, hand) {
  const selection = { upgrade, hand };
  group.userData.isUpgradeCardGroup = true;
  group.userData.upgradeSelection = selection;
  faceMesh.userData.upgradeSelection = selection;
  return selection;
}

/**
 * Resolve upgrade-card selection metadata from any child object.
 * VR-CRITICAL: Trigger selection and hover must agree even when ray hits text/icon children.
 *
 * @param {THREE.Object3D|null} object - Intersected HUD object.
 * @returns {{ upgrade: object, hand: string }|null}
 */
function resolveUpgradeSelectionFromObject(object) {
  let node = object;
  while (node && node !== upgradeGroup) {
    if (node.userData?.upgradeSelection) {
      return node.userData.upgradeSelection;
    }
    node = node.parent;
  }
  return null;
}

function createUpgradeCard(upgrade, position, hand) {
  const group = new THREE.Group();
  // Add null check for position - provide default if undefined
  if (position && typeof position.x === 'number') {
    group.position.copy(position);
  } else {
    console.warn('[hud] createUpgradeCard received invalid position, using default');
    group.position.set(0, 0, 0);
  }
  group.userData.upgradeId = upgrade.id;

  // Card background plane (shared geometry)
  const cardGeo = getCardGeo();
  const cardMat = new THREE.MeshBasicMaterial({
    color: 0x110033,
    transparent: true,
    opacity: 0.91,
    side: THREE.DoubleSide,
  });
  const card = new THREE.Mesh(cardGeo, cardMat);
  card.scale.set(0.01, 0.01, 0.01); // Start tiny for warp-in
  card.userData.isUpgradeCard = true;
  card.userData.upgradeId = upgrade.id;
  card.userData._warpPiece = 'face'; // First piece to animate
  // Fix for upgrade-screen selection regression: store selection data on both
  // the card face and the parent group so hover, trigger, and descendant hits match.
  attachUpgradeSelectionData(group, card, upgrade, hand);
  group.add(card);

  // Border (shared geometry)
  const borderColor = upgrade.sideGrade ? 0xffdd00 : (typeof upgrade.color === 'string' ? parseInt(upgrade.color.replace('#', ''), 16) : (upgrade.color || 0x00ffff));
  const borderMat = new THREE.LineBasicMaterial({ color: borderColor });
  const border = new THREE.LineSegments(getCardBorderGeo(), borderMat);
  border.scale.set(0.01, 0.01, 0.01); // Start tiny for warp-in
  border.userData._warpPiece = 'border';
  group.add(border);
  
  // Store border color on card for hover glow matching
  card.userData.borderColor = borderColor;

  // Pre-create hover glow mesh (avoids first-hover geometry clone hitch on Quest)
  const glowR = (borderColor >> 16) & 255;
  const glowG = (borderColor >> 8) & 255;
  const glowB = borderColor & 255;
  const glowColorStr = `${glowR},${glowG},${glowB}`;
  const hoverGlowGeo = cardGeo.clone();
  const hoverGlowMat = new THREE.MeshBasicMaterial({
    map: getHoverGlowTexture(glowColorStr),
    transparent: true,
    opacity: 0,
    depthTest: false,
    depthWrite: false,
  });
  const hoverGlow = new THREE.Mesh(hoverGlowGeo, hoverGlowMat);
  hoverGlow.renderOrder = 998;
  hoverGlow.scale.set(1.3, 1.3, 1.3);
  hoverGlow.position.set(0, 0, -0.01);
  card.add(hoverGlow);
  card.userData._hoverGlow = hoverGlow;

  // Name text - queued for deferred creation
  queueTextSprite(group, upgrade.name.toUpperCase(), {
    fontSize: 45,
    color: upgrade.color || '#00ffff',
    glow: true,
    glowColor: upgrade.color,
    scale: 0.24,
    depthTest: true,
    maxWidth: 600,
  }, new THREE.Vector3(0, 0.55, 0.01));

  // #18: Description text - queued
  queueTextSprite(group, upgrade.desc, {
    fontSize: 32,
    color: '#cccccc',
    scale: 0.36,
    depthTest: true,
    maxWidth: 280,
  }, new THREE.Vector3(0, 0.15, 0.01));

  // Running total text for stackable upgrades - queued
  const totalText = getUpgradeTotalText(upgrade, hand);
  if (totalText) {
    queueTextSprite(group, totalText, {
      fontSize: 24,
      color: '#88ff88',
      scale: 0.14,
      depthTest: true,
      maxWidth: 300,
    }, new THREE.Vector3(0, -0.05, 0.01));
  }

  // Side-grade note - queued
  if (upgrade.sideGradeNote) {
    queueTextSprite(group, upgrade.sideGradeNote, {
      fontSize: 22,
      color: '#ffdd00',
      scale: 0.14,
      depthTest: true,
      maxWidth: 280,
    }, new THREE.Vector3(0, -0.15, 0.01));
  }

  // Simple colored icon (shared geometry, delayed reveal)
  const iconMesh = new THREE.Mesh(
    getCardIconGeo(),
    new THREE.MeshBasicMaterial({ color: upgrade.color || '#00ffff', wireframe: true }),
  );
  iconMesh.position.set(0, -0.35, 0.05);
  iconMesh.scale.set(0.01, 0.01, 0.01); // Start tiny for warp-in
  iconMesh.userData._warpPiece = 'icon';
  iconMesh.visible = true; // Visible immediately, warp-in animates it
  group.add(iconMesh);
  group.userData.iconMesh = iconMesh;

  return group;
}

function createSkipCard(position) {
  const group = new THREE.Group();
  // Add null check for position - provide default if undefined
  if (position && typeof position.x === 'number') {
    group.position.copy(position);
  } else {
    console.warn('[hud] createSkipCard received invalid position, using default');
    group.position.set(0, 0, 0);
  }
  group.userData.upgradeId = 'SKIP';  // Special ID for skip

  // Smaller card (0.7×0.9 vs 0.9×1.1 for upgrades) - shared geometry
  const cardGeo = getSkipCardGeo();
  const cardMat = new THREE.MeshBasicMaterial({
    color: 0x220044,
    transparent: true,
    opacity: 0.91,
    side: THREE.DoubleSide,
  });
  const card = new THREE.Mesh(cardGeo, cardMat);
  card.scale.set(0.01, 0.01, 0.01); // Start tiny for warp-in
  card.userData.isUpgradeCard = true;
  card.userData.upgradeId = 'SKIP';
  card.userData._warpPiece = 'face';
  // VR-CRITICAL: Keep SKIP card on the same metadata path as real upgrades so
  // the UI never ends up with a "hover works but trigger misses" split.
  attachUpgradeSelectionData(group, card, { id: 'SKIP', name: 'Skip' }, upgradeGroup.userData.hand);
  group.add(card);

  // Border (shared geometry)
  const skipBorder = new THREE.LineSegments(getSkipCardBorderGeo(), new THREE.LineBasicMaterial({ color: '#00ff88' }));
  skipBorder.scale.set(0.01, 0.01, 0.01); // Start tiny for warp-in
  skipBorder.userData._warpPiece = 'border';
  group.add(skipBorder);
  
  // Store border color on card for hover glow matching (green for skip)
  card.userData.borderColor = 0x00ff88;

  // Pre-create hover glow mesh (avoids first-hover geometry clone hitch on Quest)
  const skipGlowColor = '0,255,136';
  const skipHoverGlowGeo = cardGeo.clone();
  const skipHoverGlowMat = new THREE.MeshBasicMaterial({
    map: getHoverGlowTexture(skipGlowColor),
    transparent: true,
    opacity: 0,
    depthTest: false,
    depthWrite: false,
  });
  const skipHoverGlow = new THREE.Mesh(skipHoverGlowGeo, skipHoverGlowMat);
  skipHoverGlow.renderOrder = 998;
  skipHoverGlow.scale.set(1.3, 1.3, 1.3);
  skipHoverGlow.position.set(0, 0, -0.01);
  card.add(skipHoverGlow);
  card.userData._hoverGlow = skipHoverGlow;

  // "SKIP" text - queued for deferred creation
  queueTextSprite(group, 'SKIP', {
    fontSize: 45,
    color: '#00ff88',
    glow: true,
    glowColor: '#00ff88',
    scale: 0.24,
    depthTest: true,
  }, new THREE.Vector3(0, 0.48, 0.01));

  // Description - queued
  queueTextSprite(group, 'Skip upgrades and gain full health.', {
    fontSize: 32,
    color: '#88ffaa',
    scale: 0.36,
    depthTest: true,
    maxWidth: 280,
  }, new THREE.Vector3(0, -0.02, 0.01));

  // Heart icon (shared geometry, delayed reveal)
  const iconMesh = new THREE.Mesh(
    getSkipIconGeo(),
    new THREE.MeshBasicMaterial({ color: '#ff0044', wireframe: true }),
  );
  iconMesh.position.set(0, -0.42, 0.05);
  iconMesh.scale.set(0.01, 0.01, 0.01); // Start tiny for warp-in
  iconMesh.userData._warpPiece = 'icon';
  iconMesh.visible = true; // Warp-in animates it
  group.add(iconMesh);
  group.userData.iconMesh = iconMesh;

  return group;
}

export function hideUpgradeCards() {
  _textQueue.length = 0; // Clear any pending deferred text
  disposeGroupChildren(upgradeGroup);
  upgradeGroup.visible = false;
  upgradeGroup.userData.hoveredSelections = {};
  upgradeCards = [];
  upgradeChoices = [];
}

export function updateUpgradeCards(now, cooldownRemaining) {
  // Flush deferred text sprites (2-3 per frame to avoid frame drops)
  flushCardTextQueue();

  // Animate card icons (rotation) - only after warp-in completes
  upgradeCards.forEach(card => {
    if (card.userData.iconMesh && card.userData.iconMesh.userData._warpActive === false) {
      card.userData.iconMesh.rotation.y += 0.02;
      card.userData.iconMesh.rotation.x += 0.01;
    }
  });

  // Update cooldown text - only recreate texture when the displayed text changes
  const cd = upgradeGroup.getObjectByName('upgrade-cards-cooldown');
  if (cd) {
    if (cooldownRemaining > 0) {
      cd.visible = true;
      const cdText = `WAIT ${Math.ceil(cooldownRemaining)}...`;
      if (cd.userData._lastCdText !== cdText) {
        cd.userData._lastCdText = cdText;
        if (cd.material && cd.material.map) cd.material.map.dispose();
        const { texture, aspect } = makeTextTexture(cdText, { fontSize: 40, color: '#ffff00' });
        cd.material.map = texture;
        cd.material.needsUpdate = true;
        cd.scale.set(aspect * 0.4, 0.4, 1);
      }
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
  if (!upgradeGroup.visible || !raycaster) return null;

  // Only raycast against card face meshes (tagged isUpgradeCard), not all descendants.
  // Text sprites, borders, and hover glow meshes can extend beyond the card face
  // boundary and intercept rays meant for a neighboring card.
  const faceMeshes = [];
  for (let i = 0; i < upgradeCards.length; i++) {
    const face = upgradeCards[i].children?.find(c => c.userData?.isUpgradeCard);
    if (face) faceMeshes.push(face);
  }

  const hits = raycaster.intersectObjects(faceMeshes, false);
  for (let i = 0; i < hits.length; i++) {
    const selection = resolveUpgradeSelectionFromObject(hits[i].object);
    if (selection?.upgrade) {
      return selection;
    }
  }
  return null;
}

/**
 * Return the hovered upgrade selection for a specific input source.
 * This is used as a safety net when controller select timing drifts slightly
 * from the ray used by that same input source.
 *
 * @param {string} sourceKey - Stable input source key (controller index or desktop).
 * @returns {{ upgrade: object, hand: string }|null}
 */
export function getHoveredUpgradeCardHit(sourceKey = 'desktop') {
  return upgradeGroup.userData.hoveredSelections?.[sourceKey] || null;
}

// ── Game Over / Victory ────────────────────────────────────

export function showGameOver(score, playerPos) {
  hideAll();
  disposeGroupChildren(gameOverGroup);

  const s1 = makeSprite('GAME OVER', { fontSize: 120, color: '#ff0044', glow: true, glowSize: 30, scale: 1.4 });
  s1.position.set(0, 1.2, 0);
  s1.name = 'titleSprite';
  gameOverGroup.add(s1);

  const s2 = makeSprite(`SCORE: ${score}`, { fontSize: 60, color: '#ffff00', glow: true, scale: 0.7 });
  s2.position.set(0, 0.4, 0);
  s2.name = 'scoreSprite';
  gameOverGroup.add(s2);

  const s3 = makeSprite('PRESS TRIGGER TO RESTART', { fontSize: 44, color: '#ffffff', scale: 0.5 });
  s3.position.set(0, -0.3, 0);
  s3.name = 'restartBlink';
  gameOverGroup.add(s3);

  // Position in front of player (VR-friendly)
  gameOverGroup.position.copy(playerPos);
  gameOverGroup.position.y += 1.6 + SCENE_Y_OFFSET; // Eye level
  gameOverGroup.position.z -= 5; // 5 feet in front of player
  gameOverGroup.visible = true;

  // Apply layout overrides (sync since preloaded)
  const layout = layoutCache['game-over'];
  if (layout?.elements) {
    if (layout.elements.titleSprite) {
      const _le = layout.elements.titleSprite;
      s1.position.set(_le.x, _le.y, _le.z);
    }
    if (layout.elements.scoreSprite) {
      const _le = layout.elements.scoreSprite;
      s2.position.set(_le.x, _le.y, _le.z);
    }
    if (layout.elements.restartSprite) {
      const _le = layout.elements.restartSprite;
      s3.position.set(_le.x, _le.y, _le.z);
    }
  }
}

export function showVictory(score, playerPos) {
  hideAll();
  disposeGroupChildren(gameOverGroup);

  const s1 = makeSprite('VICTORY!', { fontSize: 120, color: '#ffff00', glow: true, glowSize: 30, scale: 1.5 });
  s1.position.set(0, 1.2, 0);
  s1.name = 'titleSprite';
  gameOverGroup.add(s1);

  const s2 = makeSprite(`FINAL SCORE: ${score}`, { fontSize: 60, color: '#00ffff', glow: true, scale: 0.7 });
  s2.position.set(0, 0.4, 0);
  s2.name = 'scoreSprite';
  gameOverGroup.add(s2);

  const s3 = makeSprite('PRESS TRIGGER TO RETURN', { fontSize: 44, color: '#ffffff', scale: 0.5 });
  s3.position.set(0, -0.3, 0);
  s3.name = 'restartBlink';
  gameOverGroup.add(s3);

  // Position in front of player (VR-friendly)
  gameOverGroup.position.copy(playerPos);
  gameOverGroup.position.y += 1.6 + SCENE_Y_OFFSET; // Eye level
  gameOverGroup.position.z -= 5; // 5 feet in front of player
  gameOverGroup.visible = true;
  gameOverGroup.userData.fadeInStart = performance.now();
  gameOverGroup.userData.fadeInDuration = 1100; // Slow enough to feel ceremonial after the final blackout
  gameOverGroup.traverse((child) => {
    if (child.material) child.material.opacity = 0;
  });

  // Apply layout overrides (sync since preloaded)
  const layout = layoutCache['game-over'];
  if (layout?.elements) {
    if (layout.elements.titleSprite) {
      const _le = layout.elements.titleSprite;
      s1.position.set(_le.x, _le.y, _le.z);
    }
    if (layout.elements.scoreSprite) {
      const _le = layout.elements.scoreSprite;
      s2.position.set(_le.x, _le.y, _le.z);
    }
    if (layout.elements.restartSprite) {
      const _le = layout.elements.restartSprite;
      s3.position.set(_le.x, _le.y, _le.z);
    }
  }
}

export function updateEndScreen(now) {
  if (gameOverGroup.userData.fadeInStart) {
    const elapsed = now - gameOverGroup.userData.fadeInStart;
    const fade = Math.min(1, elapsed / (gameOverGroup.userData.fadeInDuration || 1));
    gameOverGroup.traverse((child) => {
      if (!child.material) return;
      if (child.name === 'restartBlink') return;
      child.material.opacity = fade;
    });
    if (fade >= 1) {
      gameOverGroup.userData.fadeInStart = null;
    }
  }

  const blink = gameOverGroup.getObjectByName('restartBlink');
  if (blink) {
    const fadeBase = gameOverGroup.userData.fadeInStart ? Math.min(1, (now - gameOverGroup.userData.fadeInStart) / (gameOverGroup.userData.fadeInDuration || 1)) : 1;
    blink.material.opacity = fadeBase * (0.5 + Math.sin(now * 0.004) * 0.5);
  }
}

export function hideGameOver() {
  gameOverGroup.visible = false;
}

// ── Hit Flash ──────────────────────────────────────────────

// VR damage indicator: bright environment flash when player takes damage
// This is the PRIMARY hit indicator in VR (camera shake doesn't work well)
// Must be very visible across all biomes (Synthwave, Desert, Alien Planet, Hellscape)
export function triggerHitFlash(includeHoloGlitch = false) {
  // High initial opacity for maximum visibility
  // Additive blending makes this visible even on bright/colored backgrounds
  hitFlashOpacity = 0.35;

  // (holo glitch removed - was never wanted on floor HUD)
}

export function updateHitFlash(dt) {
  if (!hitFlash) return; // Guard: initHUD is async, render may start before hitFlash is created
  if (hitFlashOpacity > 0) {
    hitFlash.visible = true;
    hitFlash.material.opacity = hitFlashOpacity;
    // Quick fade but not instant - 0.5s total duration
    // Fast enough to not linger, slow enough to be seen
    hitFlashOpacity -= dt * 3.6;
  } else {
    hitFlash.visible = false;
  }
}

// ── Speed Lines ────────────────────────────────────────────

// intensity: 0.0 (normal speed) to 1.0 (full slow-mo). Call every frame.
export function updateSpeedLines(intensity) {
  if (!ENABLE_SPEED_LINES || !speedLinesMesh) return;
  // Target opacity based on slowmo intensity
  const target = intensity * 0.45;
  // Smooth approach (fast in, fast out)
  if (speedLinesOpacity < target) {
    speedLinesOpacity = Math.min(speedLinesOpacity + 0.08, target);
  } else {
    speedLinesOpacity = Math.max(speedLinesOpacity - 0.12, target);
  }
  if (speedLinesOpacity > 0.001) {
    speedLinesMesh.visible = true;
    speedLinesMesh.material.opacity = speedLinesOpacity;
    // Subtle rotation for dynamism
    speedLinesMesh.rotation.z += 0.003;
  } else {
    speedLinesMesh.visible = false;
  }
}

// ── FPS Counter & Performance Monitor ───────────────────────
// Ring buffer for FPS tracking — avoids O(n) Array.shift() in per-frame path.
const FPS_RING_SIZE = 120; // Enough for 2 seconds at 60fps
const _fpsRingTimes = new Float64Array(FPS_RING_SIZE);
const _fpsRingFrameTimes = new Float64Array(FPS_RING_SIZE);
let _fpsRingHead = 0;
let _fpsRingCount = 0;
let lastFpsUpdate = 0;

export function updateFPS(now, opts = {}) {
  if (!fpsSprite) return;

  const perfMonitor = opts.perfMonitor || (typeof window !== 'undefined' && window.debugPerfMonitor);
  const frameTimeMs = opts.frameTimeMs;

  // Write to ring buffer
  _fpsRingTimes[_fpsRingHead] = now;
  _fpsRingFrameTimes[_fpsRingHead] = frameTimeMs != null ? frameTimeMs : 0;
  _fpsRingHead = (_fpsRingHead + 1) % FPS_RING_SIZE;
  if (_fpsRingCount < FPS_RING_SIZE) _fpsRingCount++;

  // Evict entries older than 1 second and count valid frames
  let fps = 0;
  let frameTimeSum = 0;
  let frameTimeCount = 0;
  const cutoff = now - 1000;
  for (let i = 0; i < _fpsRingCount; i++) {
    const idx = (_fpsRingHead - 1 - i + FPS_RING_SIZE) % FPS_RING_SIZE;
    if (_fpsRingTimes[idx] < cutoff) break;
    fps++;
    if (_fpsRingFrameTimes[idx] > 0) {
      frameTimeSum += _fpsRingFrameTimes[idx];
      frameTimeCount++;
    }
  }

  if (now - lastFpsUpdate > 250) {
    const avgFrameMs = frameTimeCount > 0
      ? frameTimeSum / frameTimeCount
      : (fps > 0 ? 1000 / fps : 0);
    const memMb = typeof performance !== 'undefined' && performance.memory
      ? (performance.memory.usedJSHeapSize / 1048576).toFixed(0)
      : null;

    let text = `FPS: ${fps}`;
    let color = '#00ff00';
    if (perfMonitor) {
      text += ` | FT: ${avgFrameMs.toFixed(1)}ms`;
      if (memMb != null) text += ` | Mem: ${memMb}MB`;

      const ri = opts.rendererInfo;
      if (ri) {
        text += `\nDC: ${ri.render.calls} | Tri: ${(ri.render.triangles / 1000).toFixed(1)}k | Tex: ${ri.memory.textures} | Geo: ${ri.memory.geometries}`;
      }

      const ftColor = avgFrameMs > 33 ? '#ff0000' : avgFrameMs > 20 ? '#ffff00' : '#00ff00';
      const dcColor = ri && ri.render.calls > 200 ? '#ff0000' : ftColor;
      color = dcColor;
    } else {
      const fpsColor = fps < 30 ? '#ff0000' : fps < 60 ? '#ffff00' : '#00ff00';
      color = fpsColor;
    }

    // Optimized: reuse canvas/texture instead of creating new ones
    // Clear canvas
    fpsCtx.clearRect(0, 0, fpsCanvas.width, fpsCanvas.height);

    // Configure text style
    const fontSize = perfMonitor ? 48 : 72;
    fpsCtx.font = `bold ${fontSize}px Arial, sans-serif`;
    fpsCtx.textAlign = 'center';
    fpsCtx.textBaseline = 'middle';

    // Drop shadow
    fpsCtx.fillStyle = 'rgba(0,0,0,0.6)';
    const lines = text.split('\n');
    const lineHeight = fontSize * 1.3;
    lines.forEach((line, i) => {
      const y = (fpsCanvas.height / 2) - ((lines.length - 1) * lineHeight / 2) + (i * lineHeight);
      fpsCtx.fillText(line, fpsCanvas.width / 2 + 2, y + 2);
    });

    // Main text
    fpsCtx.fillStyle = color;
    lines.forEach((line, i) => {
      const y = (fpsCanvas.height / 2) - ((lines.length - 1) * lineHeight / 2) + (i * lineHeight);
      fpsCtx.fillText(line, fpsCanvas.width / 2, y);
    });

    // Update texture (no dispose/recreate)
    fpsTexture.needsUpdate = true;

    // Adjust sprite geometry to match canvas aspect ratio (prevents squishing)
    // Use fixed aspect ratio based on canvas size to avoid stretching
    const canvasAspect = fpsCanvas.width / fpsCanvas.height;  // 1024/128 = 8
    const baseHeight = perfMonitor ? 0.024 : 0.016;  // 80% smaller: 0.12*0.2, 0.08*0.2
    const spriteWidth = canvasAspect * baseHeight;
    const spriteHeight = baseHeight;
    const scaleX = spriteWidth / FPS_SPRITE_BASE_WIDTH;
    const scaleY = spriteHeight / FPS_SPRITE_BASE_HEIGHT;
    fpsSprite.scale.set(scaleX, scaleY, 1);
    fpsSprite.visible = game.debugShowFPS;  // Respect FPS display toggle
    lastFpsUpdate = now;
  }
}

// ── FPS Display Toggle ────────────────────────────────────────
export function setFPSVisible(visible) {
  if (fpsSprite) {
    fpsSprite.visible = visible;
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
  // Debug menu group removed
  // Floor HUD shouldn't necessarily disappear during everything
  // Specifically don't hide it if we want it visible during upgrades
}

// ── Title Scoreboard Button Hit ─────────────────────────────

export function getTitleButtonHit(raycaster) {
  if (!titleGroup.visible) return null;

  // Check diagnostics button
  if (titleDiagBtn) {
    const diagHits = raycaster.intersectObject(titleDiagBtn, false);
    if (diagHits.length > 0) return 'diagnostics';
  }

  // Check scoreboard button
  if (titleScoreboardBtn) {
    const hits = raycaster.intersectObject(titleScoreboardBtn, false);
    if (hits.length > 0) return 'scoreboard';
  }

  // Check settings button
  if (titleSettingsBtn) {
    const hits = raycaster.intersectObject(titleSettingsBtn, false);
    if (hits.length > 0) return 'settings';
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
    const { texture, aspect } = makeTextTexture(debugText, { fontSize: 24, color: isPerfMonitor ? '#00ff00' : '#666666' });
    if (indicator.material.map) indicator.material.map.dispose();
    indicator.material.map = texture;
    indicator.material.needsUpdate = true;
    indicator.scale.set(aspect * 0.15, 0.15, 1);
  }
}

// ── Debug Menu Screen (DELETED — in-game 3D debug menu removed, Needle audit cleanup) ──

export function getDebugJumpHit(raycaster) {
  return getReadyScreenHit(raycaster);
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

export function showDebugJumpScreen(targetLevel) {
  hideAll();
  disposeGroupChildren(readyGroup);
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
  disposeGroupChildren(readyGroup);

  // Position in front of the player
  if (playerPos) {
    readyGroup.position.copy(playerPos);
    readyGroup.position.y = 1.6 + SCENE_Y_OFFSET;
    readyGroup.position.z -= 4;
  } else {
    readyGroup.position.set(0, 1.6 + SCENE_Y_OFFSET, -4);
  }
  readyGroup.visible = true;

  const header = makeSprite(`READY?`, {
    fontSize: 70, color: '#ffff00', glow: true, scale: 0.6,
  });
  header.position.set(0, 0.8, 0);
  header.name = 'header';
  readyGroup.add(header);

  const instruction = makeSprite('SHOOT TO BEGIN', {
    fontSize: 40, color: '#00ffff', scale: 0.4,
  });
  instruction.position.set(0, 0.4, 0);
  instruction.name = 'instruction';
  readyGroup.add(instruction);

  readyCountdownSprite = makeSprite('3', {
    fontSize: 120, color: '#ffffff', glow: true, glowColor: '#00ffff', scale: 0.7,
  });
  readyCountdownSprite.position.set(0, -0.05, 0.01);
  readyCountdownSprite.name = 'countdown';
  readyCountdownSprite.visible = false;
  readyGroup.add(readyCountdownSprite);

  // Apply layout overrides (sync since preloaded)
  const layout = layoutCache['ready-screen'];
  if (layout?.elements) {
    if (layout.elements.header) {
      const _le = layout.elements.header;
      header.position.set(_le.x, _le.y, _le.z);
    }
    if (layout.elements.instruction) {
      const _le = layout.elements.instruction;
      instruction.position.set(_le.x, _le.y, _le.z);
    }
    if (layout.elements.countdown) {
      const _le = layout.elements.countdown;
      readyCountdownSprite.position.set(_le.x, _le.y, _le.z);
    }
  }
}

export function hideReadyScreen() {
  disposeGroupChildren(readyGroup);
  readyGroup.visible = false;
}

export function updateReadyCountdownText(text) {
  if (!readyCountdownSprite) return;
  if (!text) {
    readyCountdownSprite.visible = false;
    return;
  }

  readyCountdownSprite.visible = true;
  const isGo = text === 'GO';
  const color = isGo ? '#00ff88' : '#ffffff';
  updateSpriteText(readyCountdownSprite, text, {
    fontSize: 120,
    color,
    glow: true,
    glowColor: color,
    scale: 0.7,
  });
}

// ── Level Intro Screen ───────────────────────────────────────

function showLevelIntro(level) {
  hideAll();
  levelIntroActive = true;
  levelIntroStartTime = performance.now();
  levelIntroStage = 'level';

  // Position in front of spawn
  levelTextGroup.position.set(0, 1.6 + SCENE_Y_OFFSET, -4);
  levelTextGroup.visible = true;

  // "LEVEL" text
  const levelHeader = makeSprite('LEVEL', {
    fontSize: 80, color: '#ff00ff', glow: true, glowColor: '#ff00ff', scale: 0.7,
  });
  levelHeader.position.set(0, 0.5, 0);
  levelTextGroup.add(levelHeader);
  levelIntroLevelText = levelHeader;

  // Level number
  const levelNum = makeSprite(`${level}`, {
    fontSize: 120, color: '#00ffff', glow: true, glowColor: '#00ffff', scale: 1.0,
  });
  levelNum.position.set(0, -0.2, 0);
  levelTextGroup.add(levelNum);
}

function updateLevelIntro(now) {
  if (!levelIntroActive) return;

  const elapsed = now - levelIntroStartTime;
  const LEVEL_FADE_DURATION = 500; // 0.5 seconds
  const START_DISPLAY_DURATION = 1000; // 1 second

  if (levelIntroStage === 'level') {
    // Show "LEVEL X" for 0.5 seconds
    if (elapsed >= LEVEL_FADE_DURATION) {
      levelIntroStage = 'level_fading';
      levelIntroStartTime = now;
    }
  } else if (levelIntroStage === 'level_fading') {
    // Fade out "LEVEL X" over 0.5 seconds
    const progress = Math.min(elapsed / LEVEL_FADE_DURATION, 1);

    if (levelIntroLevelText) {
      levelTextGroup.traverse(child => {
        if (child.material) {
          child.material.opacity = 1 - progress;
        }
      });
    }

    if (progress >= 1) {
      // Clear and show "START!" with proper disposal
      disposeGroupChildren(levelTextGroup);

      const startText = makeSprite('START!', {
        fontSize: 100, color: '#00ff00', glow: true, glowColor: '#00ff00', scale: 0.9,
      });
      startText.position.set(0, 0, 0);
      levelTextGroup.add(startText);
      levelIntroStartText = startText;

      levelIntroStage = 'start';
      levelIntroStartTime = now;
    }
  } else if (levelIntroStage === 'start') {
    // Show "START!" for 1 second
    if (elapsed >= START_DISPLAY_DURATION) {
      levelIntroStage = 'start_fading';
      levelIntroStartTime = now;
    }
  } else if (levelIntroStage === 'start_fading') {
    // Fade out "START!" over 0.5 seconds
    const progress = Math.min(elapsed / LEVEL_FADE_DURATION, 1);

    if (levelIntroStartText) {
      levelIntroStartText.material.opacity = 1 - progress;
    }

    if (progress >= 1) {
      levelIntroStage = 'done';
      levelIntroActive = false;
      levelTextGroup.visible = false;
      return true; // Signal that intro is complete
    }
  }

  return false; // Still in progress
}

function hideLevelIntro() {
  levelIntroActive = false;
  levelTextGroup.visible = false;
}

// ── Kills Remaining Alert ─────────────────────────────────

export function showKillsRemainingAlert(remaining) {
  if (killsAlertActive) return; // Already showing an alert

  killsAlertActive = true;
  killsAlertStartTime = performance.now();
  killsAlertDisplayTime = 2000; // Display for 2 seconds

  // Position further from player (better depth)
  // Place at midfield distance with a small random offset (~20px)
  const jitter = 0.2;
  const jitterX = (Math.random() - 0.5) * jitter * 2;
  const jitterY = (Math.random() - 0.5) * jitter * 2;
  levelTextGroup.position.set(jitterX, 1.6 + jitterY + SCENE_Y_OFFSET, -4.5);
  levelTextGroup.visible = true;

  // Clear any existing content with proper disposal
  disposeGroupChildren(levelTextGroup);

  const alertText = makeSprite(`${remaining} KILLS REMAINING`, {
    fontSize: 60,
    color: '#ff8800',
    glow: true,
    glowColor: '#ff8800',
    scale: 0.5,
  });
  alertText.position.set(0, 0, 0);
  levelTextGroup.add(alertText);
  killsAlertMesh = alertText;
}

export function showBossAlert(text = '⚠ INCOMING BOSS ⚠', subtitle = '') {
  // Position in front of player (VR-friendly)
  levelTextGroup.position.set(0, 1.6 + SCENE_Y_OFFSET, -4.5);
  levelTextGroup.visible = true;

  // Clear any existing content with proper disposal
  disposeGroupChildren(levelTextGroup);

  // Main alert text
  const alertText = makeSprite(text, {
    fontSize: 72,
    color: '#ff0000',
    glow: true,
    glowColor: '#ff0000',
    scale: 0.6,
  });
  alertText.position.set(0, 0, 0);
  levelTextGroup.add(alertText);

  if (subtitle) {
    const subtitleText = makeSprite(subtitle, {
      fontSize: 42,
      color: '#ffd966',
      glow: true,
      glowColor: '#ff6600',
      scale: 0.42,
    });
    subtitleText.position.set(0, -0.42, 0);
    levelTextGroup.add(subtitleText);
  }
}

export function showFloatingMessage(text, options = {}) {
  if (!cameraRef) return;
  if (!text) return;

  const sameText = floatingMessageText === text && floatingMessageGroup.visible;
  if (sameText) {
    if (options.duration) floatingMessageHideAt = performance.now() + options.duration;
    return;
  }

  floatingMessageText = text;
  floatingMessageSticky = !!options.sticky;

  disposeGroupChildren(floatingMessageGroup);

  const sprite = makeSprite(text, {
    fontSize: options.fontSize || 60,
    color: options.color || '#ffffff',
    glow: true,
    glowColor: options.glowColor || options.color || '#ffffff',
    scale: options.scale || 0.45,
  });
  sprite.position.set(0, 0, 0);
  floatingMessageGroup.add(sprite);
  floatingMessageSprite = sprite;

  const offsetY = options.offsetY ?? 0.0;
  const offsetZ = options.offsetZ ?? -0.8;
  floatingMessageGroup.position.set(0, offsetY, offsetZ);
  floatingMessageGroup.visible = true;

  if (options.duration) {
    floatingMessageHideAt = performance.now() + options.duration;
  } else {
    floatingMessageHideAt = null;
  }
}

export function hideFloatingMessage() {
  disposeGroupChildren(floatingMessageGroup);
  floatingMessageGroup.visible = false;
  floatingMessageSprite = null;
  floatingMessageText = null;
  floatingMessageHideAt = null;
  floatingMessageSticky = false;
}

export function updateFloatingMessage(now) {
  if (!floatingMessageGroup.visible) return;
  if (floatingMessageSticky) return;
  if (floatingMessageHideAt && now >= floatingMessageHideAt) {
    hideFloatingMessage();
  }
}

export function hideBossAlert() {
  disposeGroupChildren(levelTextGroup);
  levelTextGroup.visible = false;
}

export function updateKillsAlert(now) {
  if (!killsAlertActive) return false;

  const elapsed = now - killsAlertStartTime;

  // Hide after display time
  if (elapsed >= killsAlertDisplayTime) {
    hideKillsAlert();
    return false; // Alert is no longer visible
  }

  return true; // Still visible
}

export function hideKillsAlert() {
  killsAlertActive = false;
  levelTextGroup.visible = false;
  if (killsAlertMesh) {
    if (killsAlertMesh.material) {
      if (killsAlertMesh.material.map) killsAlertMesh.material.map.dispose();
      killsAlertMesh.material.dispose();
    }
    if (killsAlertMesh.geometry) killsAlertMesh.geometry.dispose();
    levelTextGroup.remove(killsAlertMesh);
    killsAlertMesh = null;
  }
}

function isKillsAlertActive() {
  return killsAlertActive;
}

// ── Name Entry Screen ───────────────────────────────────────

// Initialize keyboard pool (call once at startup)
function initKeyboardPool() {
  if (keyboardKeyPool.initialized) return;

  // Pooled materials (shared across keys of same type)
  keyboardKeyPool.materials = {
    letter: new THREE.MeshBasicMaterial({ color: 0x111133, transparent: true, opacity: 0.9, side: THREE.DoubleSide }),
    ok: new THREE.MeshBasicMaterial({ color: 0x003300, transparent: true, opacity: 0.9, side: THREE.DoubleSide }),
    del: new THREE.MeshBasicMaterial({ color: 0x330000, transparent: true, opacity: 0.9, side: THREE.DoubleSide }),
    space: new THREE.MeshBasicMaterial({ color: 0x111133, transparent: true, opacity: 0.9, side: THREE.DoubleSide }),
  };

  // Pooled geometries (reused for same-sized keys)
  const keySize = 0.26;
  keyboardKeyPool.geometries = {
    normal: new THREE.PlaneGeometry(keySize, keySize),
    wide: new THREE.PlaneGeometry(keySize * 1.5, keySize),
    space: new THREE.PlaneGeometry(keySize * 3, keySize),
  };

  // Pooled border materials (shared across keys of same type)
  keyboardKeyPool.borderMaterials = {
    letter: new THREE.LineBasicMaterial({ color: 0x444488 }),
    ok: new THREE.LineBasicMaterial({ color: 0x00ff00 }),
    del: new THREE.LineBasicMaterial({ color: 0xff4444 }),
    space: new THREE.LineBasicMaterial({ color: 0x444488 }),
  };

  // Pooled text labels (cache sprite textures)
  // Labels created on-demand to reduce initial overhead

  keyboardKeyPool.initialized = true;
}

// Initialize name entry character slot sprites (call once)
// Creates reusable canvases/textures for 6 character slots to avoid
// creating/disposing textures on every keypress
function initNameEntryCharSprites() {
  if (nameEntryInitialized) return;

  const charSize = 256; // Canvas size for each character
  const slotScale = 0.22;
  const fontSize = 64;

  for (let i = 0; i < 6; i++) {
    // Create reusable canvas
    const canvas = document.createElement('canvas');
    canvas.width = charSize;
    canvas.height = charSize;
    const ctx = canvas.getContext('2d');

    // Create texture from canvas
    const texture = new THREE.CanvasTexture(canvas);
    texture.minFilter = THREE.LinearFilter;

    // Create sprite mesh (PlaneGeometry, not THREE.Sprite)
    const aspect = 1; // Square
    const geo = new THREE.PlaneGeometry(slotScale * aspect, slotScale);
    const mat = new THREE.MeshBasicMaterial({
      map: texture,
      transparent: true,
      depthTest: false,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.renderOrder = 999;
    mesh.userData.isSlotChar = true;
    mesh.visible = false; // Hidden until character is typed

    // Store references
    nameEntryCharCanvases.push(canvas);
    nameEntryCharCtxs.push(ctx);
    nameEntryCharTextures.push(texture);
    nameEntryCharSprites.push(mesh);
  }

  nameEntryInitialized = true;
}

// Update a single character slot sprite's texture
function updateCharSlotSprite(index, char) {
  if (index < 0 || index >= 6) return;
  
  const canvas = nameEntryCharCanvases[index];
  const ctx = nameEntryCharCtxs[index];
  const texture = nameEntryCharTextures[index];
  const mesh = nameEntryCharSprites[index];

  // Clear canvas
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  if (char) {
    // Draw character
    ctx.font = 'bold 64px Arial, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#ffffff';
    ctx.fillText(char, canvas.width / 2, canvas.height / 2);
    mesh.visible = true;
  } else {
    mesh.visible = false;
  }

  texture.needsUpdate = true;
}

export function showNameEntry(score, level, storedName, countryLabel, playerPos) {
  // Initialize pool on first use
  initKeyboardPool();
  // Initialize cached character slot sprites
  initNameEntryCharSprites();

  hideAll();
  disposeGroupChildren(nameEntryGroup);
  nameEntrySlots = [];
  keyboardKeys = [];
  nameEntryActionMeshes = [];
  keyboardMeshCache = []; // Clear mesh cache
  hoveredKey = null;
  nameEntryName = storedName || '';
  nameEntryCursor = nameEntryName.length;

  // Position in front of player (VR-friendly)
  if (playerPos) {
    nameEntryGroup.position.copy(playerPos);
    nameEntryGroup.position.y += 1.6 + SCENE_Y_OFFSET; // Eye level
    nameEntryGroup.position.z -= 4; // 4 feet in front of player
  } else {
    nameEntryGroup.position.set(0, 1.6 + SCENE_Y_OFFSET, -4); // Fallback
  }
  nameEntryGroup.visible = true;

  // Header
  const header = makeSprite('ENTER YOUR NAME', {
    fontSize: 56, color: '#00ffff', glow: true, glowColor: '#00ffff', scale: 0.55,
  });
  header.position.set(0, 1.45, 0);
  nameEntryGroup.add(header);

  // Score display
  const scoreText = makeSprite(`SCORE: ${score}  LEVEL: ${level}`, {
    fontSize: 36, color: '#ffff00', scale: 0.36,
  });
  scoreText.position.set(0, 1.1, 0);
  nameEntryGroup.add(scoreText);

  // Country display - centered between name boxes and keyboard
  const countryText = makeSprite(countryLabel || 'COUNTRY: NOT SET', {
    fontSize: 32, color: '#66ffff', scale: 0.32,
  });
  countryText.position.set(-0.45, 0.42, 0);  // Centered vertically, left side
  nameEntryGroup.add(countryText);

  // Change country button - centered between name boxes and keyboard, right side
  const changeGroup = new THREE.Group();
  changeGroup.position.set(0.45, 0.42, 0);  // Centered vertically with country text
  const changeGeo = new THREE.PlaneGeometry(0.7, 0.2);
  const changeMat = new THREE.MeshBasicMaterial({
    color: 0x332200, transparent: true, opacity: 0.9, side: THREE.DoubleSide,
  });
  const changeMesh = new THREE.Mesh(changeGeo, changeMat);
  changeMesh.userData.nameEntryAction = 'country';
  changeMesh.userData.borderColor = 0xffff00;
  changeMesh.userData.isUIButton = true;  // Mark for hover system
  changeGroup.add(changeMesh);
  changeGroup.add(new THREE.LineSegments(
    new THREE.EdgesGeometry(changeGeo),
    new THREE.LineBasicMaterial({ color: 0xffff00 })
  ));
  const changeText = makeSprite('CHANGE COUNTRY', {
    fontSize: 44, color: '#ffff00', scale: 0.16,
  });
  changeText.position.set(0, 0, 0.01);
  changeGroup.add(changeText);
  nameEntryGroup.add(changeGroup);
  nameEntryActionMeshes.push(changeMesh);

  // 6 character slot boxes (using cached sprites)
  const slotWidth = 0.22;
  const slotGap = 0.04;
  const totalWidth = 6 * slotWidth + 5 * slotGap;
  const startX = -totalWidth / 2 + slotWidth / 2;

  for (let i = 0; i < 6; i++) {
    const slotGroup = new THREE.Group();
    const x = startX + i * (slotWidth + slotGap);
    slotGroup.position.set(x, 0.75, 0);

    const boxGeo = new THREE.PlaneGeometry(slotWidth, 0.28);
    const boxMat = new THREE.MeshBasicMaterial({
      color: i === nameEntryCursor ? 0x003344 : 0x110022,
      transparent: true, opacity: 0.9, side: THREE.DoubleSide,
    });
    const box = new THREE.Mesh(boxGeo, boxMat);
    slotGroup.add(box);

    const borderGeo = new THREE.EdgesGeometry(boxGeo);
    const borderColor = i === nameEntryCursor ? 0x00ffff : 0x666666;
    slotGroup.add(new THREE.LineSegments(borderGeo, new THREE.LineBasicMaterial({ color: borderColor })));

    // Use cached character sprite instead of creating new one
    const char = nameEntryName[i] || '';
    const charSprite = nameEntryCharSprites[i];
    updateCharSlotSprite(i, char);
    charSprite.position.set(0, 0, 0.01);
    slotGroup.add(charSprite);

    nameEntrySlots.push({ group: slotGroup, box, boxMat });
    nameEntryGroup.add(slotGroup);
  }

  // ── Virtual keyboard: MERGED GEOMETRY (optimized from ~108 to ~12 draw calls) ──
  // Instead of 36 individual key groups (each with mesh + border + label),
  // we merge all face geometries by material type and all borders by type.
  // Raycasting uses invisible hit-target planes positioned over each key.
  const rows = [
    ['Q', 'W', 'E', 'R', 'T', 'Y', 'U', 'I', 'O', 'P'],
    ['A', 'S', 'D', 'F', 'G', 'H', 'J', 'K', 'L'],
    ['Z', 'X', 'C', 'V', 'B', 'N', 'M', 'DEL'],
    ['SPACE', 'OK'],
  ];

  const keySize = 0.26;
  const keyGap = 0.03;
  let rowY = 0.1;

  // Build layout data (positions, sizes, types) without creating any objects yet
  keyboardKeyLayout = [];
  keyboardKeys = [];
  keyboardMeshCache = [];
  keyboardHitTargets = [];

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
      let matType = 'letter';
      let geomType = 'normal';
      let borderType = 'letter';

      if (key === 'SPACE') {
        w = keySize * 3;
        matType = 'space';
        geomType = 'space';
        borderType = 'space';
      } else if (key === 'OK') {
        w = keySize * 1.5;
        matType = 'ok';
        geomType = 'wide';
        borderType = 'ok';
      } else if (key === 'DEL') {
        w = keySize * 1.5;
        matType = 'del';
        geomType = 'wide';
        borderType = 'del';
      }

      keyboardKeyLayout.push({
        x: keyX + w / 2,
        y: rowY,
        w,
        key,
        matType,
        geomType,
        borderType,
      });
      keyX += w + keyGap;
    }
    rowY -= keySize + keyGap;
  }

  // ── Per-key box meshes (individual materials for cursor/highlight) ──
  // Each key gets its own mesh + material so hover highlights affect only one key.
  // 36 individual box meshes = 36 draw calls (still much better than original ~108).
  keyboardKeyMeshes = [];
  for (const k of keyboardKeyLayout) {
    const geo = keyboardKeyPool.geometries[k.geomType].clone();
    const mat = keyboardKeyPool.materials[k.matType].clone();
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(k.x, k.y, 0);
    mesh.renderOrder = 1;
    nameEntryGroup.add(mesh);
    keyboardKeyMeshes.push(mesh);
    // Store per-key material reference for hover highlighting
    k.boxMat = mat;
    k.boxMesh = mesh;
    k.baseColor = mat.color.getHex();
  }

  // ── Merge border geometries by type ──
  // Same approach for wireframe borders: 4 draw calls for all borders.
  const borderGeometriesByType = { letter: [], ok: [], del: [], space: [] };
  for (const k of keyboardKeyLayout) {
    const edgeGeo = new THREE.EdgesGeometry(keyboardKeyPool.geometries[k.geomType]);
    edgeGeo.translate(k.x, k.y, 0);
    borderGeometriesByType[k.borderType].push(edgeGeo);
  }

  for (const [type, geos] of Object.entries(borderGeometriesByType)) {
    if (geos.length === 0) continue;
    const merged = mergeGeometries(geos);
    const lines = new THREE.LineSegments(merged, keyboardKeyPool.borderMaterials[type]);
    lines.renderOrder = 2;
    nameEntryGroup.add(lines);
    // Dispose source geometries
    geos.forEach(g => g.dispose());
  }

  // ── Single sprite atlas for all key labels (MERGED into 1 draw call) ──
  // Draw all labels onto one canvas, create UV-mapped planes, then merge
  // into a single geometry. Result: 1 draw call for all labels.
  const labelChars = [];
  const labelSet = new Set();
  for (const k of keyboardKeyLayout) {
    const label = k.key === 'SPACE' ? '___' : k.key;
    if (!labelSet.has(label)) {
      labelSet.add(label);
      const textColor = k.key === 'OK' ? '#00ff00' : (k.key === 'DEL' ? '#ff4444' : '#ccccff');
      labelChars.push({ label, color: textColor });
    }
  }

  // Create atlas: each label gets a cell in a horizontal strip
  const cellW = 128;
  const cellH = 96;
  const atlasCanvas = document.createElement('canvas');
  atlasCanvas.width = cellW * labelChars.length;
  atlasCanvas.height = cellH;
  const atlasCtx = atlasCanvas.getContext('2d');
  atlasCtx.textAlign = 'center';
  atlasCtx.textBaseline = 'middle';

  const labelUVMap = {};
  labelChars.forEach((lc, i) => {
    atlasCtx.font = 'bold 52px Arial, sans-serif';
    atlasCtx.fillStyle = lc.color;
    atlasCtx.fillText(lc.label, i * cellW + cellW / 2, cellH / 2);
    labelUVMap[lc.label] = {
      u: i / labelChars.length,
      uw: 1 / labelChars.length,
    };
  });

  const atlasTexture = new THREE.CanvasTexture(atlasCanvas);
  atlasTexture.minFilter = THREE.LinearFilter;
  atlasTexture.magFilter = THREE.LinearFilter;
  atlasTexture.premultiplyAlpha = false;

  // Build individual label planes with atlas UVs, then merge into single geometry
  const labelGeometries = [];
  for (const k of keyboardKeyLayout) {
    const label = k.key === 'SPACE' ? '___' : k.key;
    const uv = labelUVMap[label];
    if (!uv) continue;

    // Label plane aspect ratio must match atlas cell aspect ratio (cellW/cellH)
    // to prevent text stretching. Plane is sized to fit within key bounds.
    const planeW = k.w * 0.85;
    const planeH = planeW * (cellH / cellW);  // Match atlas cell aspect ratio (4:3)
    // Clamp height to not exceed key height
    const maxH = keySize * 0.7;
    const finalH = Math.min(planeH, maxH);
    const labelGeo = new THREE.PlaneGeometry(planeW, finalH);
    // Remap UVs to sample from the correct atlas cell
    const posAttr = labelGeo.attributes.uv;
    for (let vi = 0; vi < posAttr.count; vi++) {
      const u = posAttr.getX(vi);
      posAttr.setX(vi, uv.u + u * uv.uw);
    }
    // Translate to key position
    labelGeo.translate(k.x, k.y, 0.01);
    labelGeometries.push(labelGeo);
  }

  if (labelGeometries.length > 0) {
    const mergedLabelGeo = mergeGeometries(labelGeometries);
    const labelMat = new THREE.MeshBasicMaterial({
      map: atlasTexture,
      transparent: true,
      depthTest: false,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    const labelMesh = new THREE.Mesh(mergedLabelGeo, labelMat);
    labelMesh.renderOrder = 999;
    nameEntryGroup.add(labelMesh);
    // Dispose source geometries
    labelGeometries.forEach(g => g.dispose());
  }

  // ── Invisible hit-target planes for raycasting ──
  // One invisible plane per key for hit detection. These are very cheap since
  // they share geometry and are invisible (no GPU cost for the planes themselves,
  // only raycasting CPU cost which is minimal with ~36 targets).
  const hitGeo = keyboardKeyPool.geometries.normal; // Reuse pooled geometry for sizing
  for (const k of keyboardKeyLayout) {
    const hitMesh = new THREE.Mesh(
      keyboardKeyPool.geometries[k.geomType],
      new THREE.MeshBasicMaterial({ visible: false })
    );
    hitMesh.position.set(k.x, k.y, 0.02);
    hitMesh.userData.keyValue = k.key;
    hitMesh.userData.isKeyboardKey = true;
    hitMesh.userData._keyLayoutIndex = keyboardKeys.length;
    nameEntryGroup.add(hitMesh);
    keyboardKeys.push({
      mesh: hitMesh,
      key: k.key,
      baseColor: keyboardKeyPool.materials[k.matType].color.getHex(),
      matType: k.matType,
      x: k.x,
      y: k.y,
      w: k.w,
    });
    keyboardMeshCache.push(hitMesh);
    keyboardHitTargets.push(hitMesh);
  }

  // ── Per-key glow removed: per-key material highlighting handles hover feedback ──
  // Each key's boxMat color is smoothly interpolated in updateHUDHover(),
  // providing bright-on-hover feedback without the "all keys glow" artifact.
}

export function hideNameEntry() {
  nameEntryGroup.visible = false;
  // Dispose per-key box meshes and their materials
  if (keyboardKeyMeshes) {
    for (const mesh of keyboardKeyMeshes) {
      if (mesh.material) mesh.material.dispose();
      if (mesh.geometry) mesh.geometry.dispose();
    }
    keyboardKeyMeshes = [];
  }
  // Clear layout data
  keyboardKeyLayout = [];
  keyboardHitTargets = [];
}

export function getNameEntryName() {
  return nameEntryName;
}

export function getNameEntryHit(raycaster) {
  if (!nameEntryGroup.visible) return null;
  if (nameEntryActionMeshes.length > 0) {
    const actionHits = raycaster.intersectObjects(nameEntryActionMeshes, false);
    if (actionHits.length > 0) {
      const action = actionHits[0].object.userData.nameEntryAction;
      if (action) return { action };
    }
  }
  // Use pre-built hit target array
  const hits = raycaster.intersectObjects(keyboardHitTargets, false);
  if (hits.length > 0) {
    const key = hits[0].object.userData.keyValue;
    return processKeyPress(key);
  }
  return null;
}

function processKeyPress(key) {
  if (key === 'OK') {
    playMenuClick();  // #7: Activate sound for OK button
    if (nameEntryName.length > 0) return { action: 'submit', name: nameEntryName };
    return null;
  }
  if (key === 'DEL') {
    playMenuClick();  // #7: Activate sound for DEL button
    if (nameEntryCursor > 0) {
      nameEntryName = nameEntryName.slice(0, -1);
      nameEntryCursor = nameEntryName.length;
      refreshNameSlots();
    }
    return null;
  }
  if (key === 'SPACE') {
    playMenuClick();  // #7: Activate sound for SPACE button
    if (nameEntryName.length < 6) {
      nameEntryName += ' ';
      nameEntryCursor = nameEntryName.length;
      refreshNameSlots();
    }
    return null;
  }
  // Letter key
  playMenuClick();  // #7: Activate sound for letter keys
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

    // Optimized: just update the cached sprite's texture
    // instead of creating/disposing sprites on every keypress
    const char = nameEntryName[i] || '';
    updateCharSlotSprite(i, char);
  });
}

export function updateKeyboardHover(raycaster) {
  // NOTE: Visual hover effects (glow, scale, sound) are now handled uniformly
  // by updateHUDHover() for ALL buttons including keyboard keys and Change Country.
  // This function is kept for backward compatibility but no longer does visual effects.
  // The keyboard keys and nameEntryActionMeshes are already included in updateHUDHover's
  // hoverables list, so they get the same hover treatment as all other buttons.
}

// ── Scoreboard Screen ───────────────────────────────────────

function getScoreboardHeader(headerText) {
  if (!headerText) return { main: '🌎 GLOBAL' };
  if (headerText.startsWith('COUNTRY:')) {
    return { main: headerText.replace('COUNTRY:', '').trim() };
  }
  if (headerText.startsWith('CONTINENT:')) {
    return { main: headerText.replace('CONTINENT:', '').trim() };
  }
  if (headerText.startsWith('GLOBAL')) {
    return { main: '🌎 GLOBAL' };
  }
  if (headerText.startsWith('LOADING')) {
    return { main: 'LOADING' };
  }
  return { main: headerText };
}

/**
 * Generic helper to dispose all GPU resources (geometry, materials, textures)
 * from a group's children before removing them. Prevents memory leaks.
 */
export function disposeGroupChildren(group) {
  if (!group) return;
  group.traverse((child) => {
    if (child.geometry) {
      child.geometry.dispose();
      child.geometry = null;
    }
    if (child.material) {
      const materials = Array.isArray(child.material) ? child.material : [child.material];
      materials.forEach((mat) => {
        if (!mat) return;
        if (mat.map) {
          mat.map.dispose();
          mat.map = null;
        }
        if (mat.alphaMap) {
          mat.alphaMap.dispose();
          mat.alphaMap = null;
        }
        mat.dispose();
      });
      child.material = null;
    }
  });
  while (group.children.length > 0) {
    group.remove(group.children[0]);
  }
}

/**
 * Dispose a single node's GPU resources. Used for scoreboard cleanup.
 */
function disposeScoreboardNode(root) {
  if (!root) return;
  root.traverse((child) => {
    if (child === scoreboardMesh) return;
    if (child.geometry) {
      child.geometry.dispose();
    }
    if (!child.material) return;
    const materials = Array.isArray(child.material) ? child.material : [child.material];
    materials.forEach((mat) => {
      if (!mat) return;
      if (mat.map) {
        mat.map.dispose();
        mat.map = null;
      }
      if (mat.alphaMap) {
        mat.alphaMap.dispose();
        mat.alphaMap = null;
      }
      mat.dispose();
    });
  });
}

function ensureScoreboardCanvas() {
  if (!scoreboardCanvas) {
    scoreboardCanvas = document.createElement('canvas');
    scoreboardCanvas.width = SCOREBOARD_CANVAS_WIDTH;
    scoreboardCanvas.height = SCOREBOARD_CANVAS_HEIGHT;
    scoreboardCtx = scoreboardCanvas.getContext('2d');
  } else if (!scoreboardCtx) {
    scoreboardCtx = scoreboardCanvas.getContext('2d');
  } else if (scoreboardCanvas.width !== SCOREBOARD_CANVAS_WIDTH || scoreboardCanvas.height !== SCOREBOARD_CANVAS_HEIGHT) {
    scoreboardCanvas.width = SCOREBOARD_CANVAS_WIDTH;
    scoreboardCanvas.height = SCOREBOARD_CANVAS_HEIGHT;
    scoreboardCtx = scoreboardCanvas.getContext('2d');
  }
  return scoreboardCtx;
}

export function showScoreboard(scores, headerText, playerPos) {
  hideAll();
  while (scoreboardGroup.children.length) {
    const child = scoreboardGroup.children[0];
    scoreboardGroup.remove(child);
    if (child !== scoreboardMesh) {
      disposeScoreboardNode(child);
    }
  }

  scoreboardScores = scores;
  scoreboardScrollOffset = 0;
  scoreboardPage = lastSubmittedPageIndex >= 0 ? lastSubmittedPageIndex : 0;
  lastSubmittedPageIndex = -1; // Reset after use
  scoreboardHeader = headerText || 'GLOBAL LEADERBOARD';
  if (scoreboardSpinnerTimer) {
    clearInterval(scoreboardSpinnerTimer);
    scoreboardSpinnerTimer = null;
  }
  // Position in front of player (VR-friendly)
  if (playerPos) {
    scoreboardGroup.position.copy(playerPos);
    scoreboardGroup.position.y += 1.6 + SCENE_Y_OFFSET + 0.5; // Eye level + #9: Move up 0.5 units
    scoreboardGroup.position.z -= 5; // 5 feet in front of player
  } else {
    scoreboardGroup.position.set(0, 1.6 + SCENE_Y_OFFSET + 0.5, -5); // Fallback + #9: Move up 0.5 units
  }
  scoreboardGroup.visible = true;

  // Header
  // Header (two-line)
  const headerInfo = getScoreboardHeader(scoreboardHeader);
  const mainHeader = makeSprite(headerInfo.main, {
    fontSize: 60, color: '#ffffff', glow: true, glowColor: '#ffffff', scale: 0.65,
  });
  mainHeader.position.set(0, 2.25, 0);
  mainHeader.name = 'mainHeader';
  scoreboardGroup.add(mainHeader);

  let subHeader = null;
  if (headerInfo.main !== 'LOADING') {
    subHeader = makeSprite('LEADERBOARD', {
      fontSize: 44, color: '#00ffff', glow: true, glowColor: '#00ffff', scale: 0.5,
    });
    subHeader.position.set(0, 1.95, 0);
    subHeader.name = 'subHeader';
    scoreboardGroup.add(subHeader);
  }

  // Score list canvas
  renderScoreboardCanvas();
  scoreboardMesh.position.set(0, 0.45, 0);
  scoreboardMesh.name = 'scoreboardMesh';
  scoreboardGroup.add(scoreboardMesh);

  // Buttons on right side
  const btnDefs = [
    { label: 'COUNTRY', y: 1.2, action: 'country', name: 'btnCountry' },
    { label: 'CONTINENT', y: 0.85, action: 'continent', name: 'btnContinent' },
    { label: '⬅️ PREV PAGE', y: 0.1, action: 'page_prev', name: 'btnPrevPage' },
    { label: 'NEXT PAGE ➡️', y: -0.25, action: 'page_next', name: 'btnNextPage' },
  ];

  const buttonGroups = {};
  for (const def of btnDefs) {
    const btnGroup = new THREE.Group();
    btnGroup.position.set(1.55, def.y, 0);
    btnGroup.name = def.name;
    buttonGroups[def.name] = btnGroup;

    const btnGeo = new THREE.PlaneGeometry(0.65, 0.3);
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

    const txt = makeSprite(def.label, { fontSize: 54, color: '#ccffff', scale: 0.18 });
    txt.position.set(0, 0, 0.01);
    btnGroup.add(txt);

    scoreboardGroup.add(btnGroup);
  }

  // BACK button bottom center
  const backGroup = new THREE.Group();
  backGroup.position.set(0, -1.0, 0);  // #5: Aligned with Country screen
  backGroup.name = 'btnBack';
  const backGeo = new THREE.PlaneGeometry(0.9, 0.35);  // #5: Same size as Country
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
  const backTxt = makeSprite('BACK', { fontSize: 52, color: '#ff6666', scale: 0.2 });
  backTxt.position.set(0, 0, 0.01);
  backGroup.add(backTxt);
  scoreboardGroup.add(backGroup);

  // Apply layout overrides (sync since preloaded)
  const layout = layoutCache['scoreboard'];
  if (layout?.elements) {
    if (layout.elements.mainHeader) {
      const _le = layout.elements.mainHeader;
      mainHeader.position.set(_le.x, _le.y, _le.z);
    }
    if (layout.elements.subHeader && subHeader) {
      const _le = layout.elements.subHeader;
      subHeader.position.set(_le.x, _le.y, _le.z);
    }
    if (layout.elements.scoreboardMesh) {
      const _le = layout.elements.scoreboardMesh;
      scoreboardMesh.position.set(_le.x, _le.y, _le.z);
    }
    // Apply button positions
    for (const [key, group] of Object.entries(buttonGroups)) {
      if (layout.elements[key]) {
        const _le = layout.elements[key];
        group.position.set(_le.x, _le.y, _le.z);
      }
    }
    if (layout.elements.btnBack) {
      const _le = layout.elements.btnBack;
      backGroup.position.set(_le.x, _le.y, _le.z);
    }
  }
}

// #11: Helper function to draw text with letter spacing and drop shadow
function drawTextWithSpacing(ctx, text, x, y, color, letterSpacing = 3, fontSize = 44, align = 'left') {
  // Drop shadow offset at 125 degrees with small distance
  const shadowDistance = 3;
  const shadowAngle = 125 * Math.PI / 180;
  const shadowX = Math.cos(shadowAngle) * shadowDistance;
  const shadowY = Math.sin(shadowAngle) * shadowDistance;

  ctx.font = `bold ${fontSize}px ${novemberFontFamily}`;
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'left';  // Always use left alignment for character-by-character rendering

  // Calculate total width for alignment
  let totalWidth = 0;
  for (let i = 0; i < text.length; i++) {
    totalWidth += ctx.measureText(text[i]).width + letterSpacing;
  }
  totalWidth -= letterSpacing;  // Remove last letter spacing

  // Adjust starting position for alignment
  let startX = x;
  if (align === 'center') startX = x - totalWidth / 2;
  else if (align === 'right') startX = x - totalWidth;

  // Draw shadow first
  ctx.fillStyle = 'rgba(0, 0, 0, 0.9)';  // 90% opacity black
  let currentX = startX + shadowX;
  for (let i = 0; i < text.length; i++) {
    ctx.fillText(text[i], currentX, y + shadowY);
    currentX += ctx.measureText(text[i]).width + letterSpacing;
  }

  // Draw main text
  ctx.fillStyle = color;
  currentX = startX;
  for (let i = 0; i < text.length; i++) {
    ctx.fillText(text[i], currentX, y);
    currentX += ctx.measureText(text[i]).width + letterSpacing;
  }
}

function renderScoreboardCanvas() {
  const ctx = ensureScoreboardCanvas();
  if (!ctx) return;
  const canvas = scoreboardCanvas;
  const w = canvas.width;
  const h = canvas.height;
  ctx.clearRect(0, 0, w, h);

  // Background
  ctx.fillStyle = 'rgba(0, 20, 40, 0.9)';
  ctx.fillRect(0, 0, w, h);

  // Border
  ctx.strokeStyle = '#00ffff';
  ctx.lineWidth = 3;
  ctx.strokeRect(1, 1, w - 2, h - 2);

  const rowHeight = 80;  // #11: Slightly increased for better line spacing
  const maxVisible = SCOREBOARD_PAGE_SIZE;
  const totalPages = Math.max(1, Math.ceil(scoreboardScores.length / maxVisible));
  scoreboardPage = Math.max(0, Math.min(totalPages - 1, scoreboardPage));
  const startIdx = scoreboardPage * maxVisible;
  const endIdx = Math.min(startIdx + maxVisible, scoreboardScores.length);

  // #11: Header row with November font
  drawTextWithSpacing(ctx, '#', 20, 60, '#ffffff', 3, 44, 'left');
  drawTextWithSpacing(ctx, 'NAME', 110, 60, '#ffffff', 3, 44, 'left');
  drawTextWithSpacing(ctx, 'SCORE', 640, 60, '#ffffff', 3, 44, 'right');
  drawTextWithSpacing(ctx, 'LVL', 740, 60, '#ffffff', 3, 44, 'right');

  ctx.strokeStyle = 'rgba(255, 255, 255, 0.35)';
  ctx.beginPath();
  ctx.moveTo(12, 90);
  ctx.lineTo(w - 12, 90);
  ctx.stroke();

  const highlightName = nameEntryName.trim().toUpperCase();
  let playerHighlighted = false;

  for (let i = startIdx; i < endIdx; i++) {
    const score = scoreboardScores[i];
    const y = (i - startIdx) * rowHeight + rowHeight / 2 + 120;
    const rank = i + 1;
    // Highlight only if name matches AND timestamp matches the most recent submission
    const nameMatches = highlightName && (score.name || '').toUpperCase() === highlightName;
    const timestampMatches = lastSubmittedTimestamp && score.created_at === lastSubmittedTimestamp;
    const isPlayer = nameMatches && timestampMatches;

    // Highlight row background for the player's entry
    if (isPlayer) {
      ctx.fillStyle = 'rgba(0, 255, 255, 0.18)';
      ctx.fillRect(6, y - rowHeight / 2 + 4, w - 12, rowHeight - 8);
      ctx.strokeStyle = 'rgba(0, 255, 255, 0.7)';
      ctx.lineWidth = 2;
      ctx.strokeRect(6, y - rowHeight / 2 + 4, w - 12, rowHeight - 8);
    }

    // #11: Row color based on rank (full-line color)
    let rowColor;
    if (rank === 1) rowColor = '#FFD000';      // Gold for 1st
    else if (rank === 2) rowColor = '#B5B5B5'; // Silver for 2nd
    else if (rank === 3) rowColor = '#D68500'; // Bronze for 3rd
    else rowColor = '#68FDFF';                 // Cyan for all others

    // Rank
    const rankLabel = String(rank).padStart(2, '0');
    drawTextWithSpacing(ctx, rankLabel, 20, y, rowColor, 3, 44, 'left');

    // Flag
    if (score.country) {
      try {
        const flag = String.fromCodePoint(
          ...[...score.country.toUpperCase()].map(c => 0x1F1E6 + c.charCodeAt(0) - 65)
        );
        ctx.font = '40px "Segoe UI Emoji", "Apple Color Emoji", sans-serif';
        ctx.fillStyle = '#ffffff';
        ctx.textBaseline = 'middle';
        ctx.textAlign = 'left';
        ctx.fillText(flag, 95, y);
      } catch (e) { /* skip flag */ }
    }

    // Name (use row color)
    const displayName = (score.name || 'ANON').toUpperCase();
    drawTextWithSpacing(ctx, displayName, 160, y, isPlayer ? '#ffffff' : rowColor, 3, 44, 'left');

    // Score (use row color)
    const scoreVal = score.score !== undefined && score.score !== null ? score.score.toLocaleString() : '0';
    drawTextWithSpacing(ctx, scoreVal, 670, y, rowColor, 3, 44, 'right');

    // Level (use row color)
    const levelVal = score.level_reached !== undefined && score.level_reached !== null ? `L${String(score.level_reached).padStart(2, '0')}` : 'L?';
    drawTextWithSpacing(ctx, levelVal, 770, y, rowColor, 3, 44, 'right');

    // Divider line
    ctx.strokeStyle = 'rgba(0, 255, 255, 0.25)';
    ctx.beginPath();
    ctx.moveTo(12, y + rowHeight / 2);
    ctx.lineTo(w - 12, y + rowHeight / 2);
    ctx.stroke();
  }

  // Loading spinner when empty
  if (scoreboardScores.length === 0) {
    const cx = w / 2;
    const cy = h / 2;
    const radius = 60;
    const t = performance.now() * 0.005;
    ctx.lineWidth = 10;
    ctx.strokeStyle = 'rgba(0, 255, 255, 0.3)';
    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    ctx.stroke();
    ctx.strokeStyle = '#00ffff';
    ctx.beginPath();
    ctx.arc(cx, cy, radius, t, t + Math.PI * 0.7);
    ctx.stroke();
  }

  // #11: Page indicator with November font, #10: moved up by ~0.1 units
  if (scoreboardScores.length > 0) {
    drawTextWithSpacing(ctx, `PAGE ${scoreboardPage + 1} OF ${totalPages}`, w / 2, h - 110, '#ffffff', 3, 38, 'center');
  }

  if (!scoreboardTexture) {
    scoreboardTexture = new THREE.CanvasTexture(canvas);
    scoreboardTexture.premultiplyAlpha = false;
    scoreboardTexture.minFilter = THREE.LinearFilter;
  }
  scoreboardTexture.needsUpdate = true;

  if (!scoreboardMesh) {
    const geo = new THREE.PlaneGeometry(2.05, 2.45);
    const mat = new THREE.MeshBasicMaterial({
      map: scoreboardTexture,
      transparent: true,
      side: THREE.DoubleSide,
      depthTest: false,
    });
    scoreboardMesh = new THREE.Mesh(geo, mat);
    scoreboardMesh.renderOrder = 999;
  } else if (scoreboardMesh.material.map !== scoreboardTexture) {
    scoreboardMesh.material.map = scoreboardTexture;
  }
  scoreboardMesh.material.needsUpdate = true;

  if (scoreboardScores.length === 0 && !scoreboardSpinnerTimer) {
    scoreboardSpinnerTimer = setInterval(() => {
      if (!scoreboardGroup.visible || scoreboardScores.length > 0) {
        clearInterval(scoreboardSpinnerTimer);
        scoreboardSpinnerTimer = null;
        return;
      }
      renderScoreboardCanvas();
    }, 200);
  }
}

export function hideScoreboard() {
  scoreboardGroup.visible = false;
  if (scoreboardSpinnerTimer) {
    clearInterval(scoreboardSpinnerTimer);
    scoreboardSpinnerTimer = null;
  }
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
    if (action === 'page_prev') {
      playMenuClick();  // #7: Activate sound for PREV PAGE
      scoreboardPage = Math.max(0, scoreboardPage - 1);
      renderScoreboardCanvas();
      return null;
    }
    if (action === 'page_next') {
      playMenuClick();  // #7: Activate sound for NEXT PAGE
      const totalPages = Math.max(1, Math.ceil(scoreboardScores.length / SCOREBOARD_PAGE_SIZE));
      scoreboardPage = Math.min(totalPages - 1, scoreboardPage + 1);
      renderScoreboardCanvas();
      return null;
    }
    // #7: Activate sound for COUNTRY, CONTINENT, and BACK buttons
    playMenuClick();
    return action;
  }
  return null;
}

export function updateScoreboardScroll(delta) {
  if (!scoreboardGroup.visible) return;
  const totalPages = Math.max(1, Math.ceil(scoreboardScores.length / SCOREBOARD_PAGE_SIZE));
  scoreboardPage = Math.max(0, Math.min(totalPages - 1, scoreboardPage + delta));
  renderScoreboardCanvas();
}

// ── Country Select Screen ───────────────────────────────────

export function showCountrySelect(countries, continents, initialContinent, playerPos, mode = 'country') {
  hideAll();
  disposeGroupChildren(countrySelectGroup);
  continentTabs = [];
  countryItems = [];
  countrySelectContinent = initialContinent || 'North America';
  countrySelectScrollOffset = 0;
  countrySelectMode = mode;

  // Position in front of player (VR-friendly)
  if (playerPos) {
    countrySelectGroup.position.copy(playerPos);
    countrySelectGroup.position.y += 1.6 + SCENE_Y_OFFSET + 0.5; // Eye level + #9: Move up 0.5 units
    countrySelectGroup.position.z -= 4; // 4 feet in front of player
  } else {
    countrySelectGroup.position.set(0, 1.6 + SCENE_Y_OFFSET + 0.5, -4); // Fallback + #9: Move up 0.5 units
  }
  countrySelectGroup.visible = true;

  // Header
  const headerText = mode === 'continent' ? 'SELECT CONTINENT' : 'SELECT YOUR COUNTRY';
  const header = makeSprite(headerText, {
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
    const tabGeo = new THREE.PlaneGeometry(tabWidth, 0.28);
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
      fontSize: 42, color: isActive ? '#00ffff' : '#888888', scale: 0.225,
    });
    tabLabel.position.set(0, 0, 0.01);
    tabGroup.add(tabLabel);

    continentTabs.push({ group: tabGroup, mesh: tabMesh, continent });
    countrySelectGroup.add(tabGroup);
    tabX += tabWidth + tabGap;
  }

  // Country list
  if (mode !== 'continent') {
    renderCountryList(countries);
  }

  // BACK button
  const backGroup = new THREE.Group();
  backGroup.position.set(0, -1.0, 0);  // #5: Aligned with Scoreboard screen
  const backGeo = new THREE.PlaneGeometry(0.9, 0.35);  // #5: Same size as Scoreboard
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
  const backTxt = makeSprite('BACK', { fontSize: 52, color: '#ff6666', scale: 0.2 });
  backTxt.position.set(0, 0, 0.01);
  backGroup.add(backTxt);
  countrySelectGroup.add(backGroup);
}

function renderCountryList(countries) {
  // Remove old country item meshes
  countryItems.forEach(item => countrySelectGroup.remove(item.group));
  countryItems = [];

  const filtered = countries
    .filter(c => c.continent === countrySelectContinent)
    .sort((a, b) => a.name.localeCompare(b.name));

  // Required continent layouts:
  // Europe: 4 columns of 5 (20 total)
  // Asia: 3 columns of 5/5/4 (14 total)
  let columnRowCounts = [filtered.length];
  if (countrySelectContinent === 'Europe') {
    columnRowCounts = [5, 5, 5, 5];
  } else if (countrySelectContinent === 'Asia') {
    columnRowCounts = [5, 5, 4];
  }

  const positioned = [];
  let idx = 0;
  for (let col = 0; col < columnRowCounts.length; col++) {
    const rows = columnRowCounts[col];
    for (let row = 0; row < rows && idx < filtered.length; row++) {
      positioned.push({ country: filtered[idx], col, row });
      idx += 1;
    }
  }

  const itemHeight = 0.26;
  const itemGap = 0.04;
  const colGap = 0.1;
  const startY = 0.85;
  const colWidth = (columnRowCounts.length > 1) ? 0.9 : 1.8;
  const totalWidth = (columnRowCounts.length * colWidth) + ((columnRowCounts.length - 1) * colGap);
  const startX = -totalWidth / 2 + colWidth / 2;

  positioned.forEach(({ country, col, row }) => {
    const itemGroup = new THREE.Group();
    const x = startX + col * (colWidth + colGap);
    const y = startY - row * (itemHeight + itemGap);
    itemGroup.position.set(x, y, 0);

    const itemGeo = new THREE.PlaneGeometry(colWidth, itemHeight);
    const itemMat = new THREE.MeshBasicMaterial({
      color: 0x111133, transparent: true, opacity: 0.85, side: THREE.DoubleSide,
    });
    const itemMesh = new THREE.Mesh(itemGeo, itemMat);
    itemMesh.userData.countryCode = country.code;
    itemMesh.userData.countryAction = 'select';
    itemGroup.add(itemMesh);

    itemGroup.add(new THREE.LineSegments(
      new THREE.EdgesGeometry(itemGeo),
      new THREE.LineBasicMaterial({ color: 0x444466 })
    ));

    // +125% readability bump for country text, centered on each button
    const label = makeSprite(`${country.flag}  ${country.name}`, {
      fontSize: 42, color: '#ffffff', scale: 0.225,
    });
    label.position.set(0, 0, 0.01);
    itemGroup.add(label);

    countryItems.push({ group: itemGroup, mesh: itemMesh, code: country.code });
    countrySelectGroup.add(itemGroup);
  });
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
    playMenuClick();  // #7: Activate sound for continent tab
    if (countrySelectMode === 'continent') {
      return { action: 'select_continent', continent };
    }
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
  if (countrySelectMode !== 'continent') {
    const itemMeshes = countryItems.map(i => i.mesh);
    hits = raycaster.intersectObjects(itemMeshes, false);
    if (hits.length > 0) {
      const code = hits[0].object.userData.countryCode;
      playMenuClick();  // #7: Activate sound for country selection
      return { action: 'select', code };
    }
  }

  // Check back button
  const actionMeshes = [];
  countrySelectGroup.traverse(c => {
    if (c.userData && c.userData.countryAction === 'back') actionMeshes.push(c);
  });
  hits = raycaster.intersectObjects(actionMeshes, false);
  if (hits.length > 0) {
    playMenuClick();  // #7: Activate sound for back button
    return { action: 'back' };
  }

  return null;
}

/**
 * Unified hover effect for all HUD buttons and upgrade cards.
 * Accepts an array of raycasters (one per controller).
 * Returns true if a NEW hover occurred (to trigger sound).
 */
function getHoverGlowTexture(color = '0,255,255') {
  // Cache textures by color
  if (!getHoverGlowTexture._texCache) getHoverGlowTexture._texCache = {};
  if (getHoverGlowTexture._texCache[color]) return getHoverGlowTexture._texCache[color];

  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext('2d');
  // #3: Brighter glow effect with dynamic color
  const grad = ctx.createRadialGradient(64, 64, 5, 64, 64, 60);
  grad.addColorStop(0, `rgba(${color},0.9)`);  // Brighter center
  grad.addColorStop(0.3, `rgba(${color},0.6)`); // Added mid-stop
  grad.addColorStop(1, `rgba(${color},0)`);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 128, 128);
  const tex = new THREE.CanvasTexture(canvas);
  getHoverGlowTexture._texCache[color] = tex;
  return tex;
}

export function updateHUDHover(raycasters) {
  const hoverables = [];
  const hoveredUpgradeSelections = {};

  // 1. Title Scoreboard & Diagnostics
  if (titleGroup.visible) {
    if (titleScoreboardBtn) hoverables.push(titleScoreboardBtn);
    if (titleDiagBtn) hoverables.push(titleDiagBtn);
    if (titleSettingsBtn) hoverables.push(titleSettingsBtn);
  }

  // 2. Upgrade Cards
  if (upgradeGroup.visible) {
    // Animate per-piece warp-in (easeOutCubic, clean ease-out grow)
    // Iterates ALL children with _warpActive regardless of cardGroup state,
    // because text sprites are flushed from a queue after the initial warp starts.
    const now = performance.now();
    upgradeCards.forEach(cardGroup => {
      let hasActive = false;
      cardGroup.children.forEach(child => {
        if (!child.userData._warpActive) return;
        hasActive = true;
        const elapsed = now - child.userData._warpStartTime;
        if (elapsed < 0) return;
        // Play pop sound when card face warp starts
        if (child.userData._warpPiece === 'face' && !child.userData._warpSounded) {
          child.userData._warpSounded = true;
          playBasicEnemySpawn();
        }
        if (elapsed >= CARD_WARP_DURATION) {
          child.scale.set(1, 1, 1);
          child.userData._warpActive = false;
          return;
        }
        const t = elapsed / CARD_WARP_DURATION;
        const s = easeOutCubic(t);
        child.scale.set(s, s, s);
      });
      cardGroup.userData._warpActive = hasActive;
    });

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

  // 6. Name Entry (keyboard keys and actions)
  if (nameEntryGroup.visible) {
    keyboardKeys.forEach(k => { if (k.mesh) hoverables.push(k.mesh); });
    nameEntryActionMeshes.forEach(m => { if (m) hoverables.push(m); });
  }

  // 7. Pause Menu (RESUME and SETTINGS buttons)
  if (pauseMenuGroup.visible) {
    pauseMenuGroup.traverse(c => {
      if (c.userData && (c.userData.isResumeButton || c.userData.isPauseSettingsBtn)) hoverables.push(c);
    });
  }

  // 8. Settings Menu buttons
  if (settingsGroup.visible) {
    settingsGroup.traverse(c => {
      if (c.userData && c.userData.isSettingsBtn) hoverables.push(c);
    });
  }

  if (hoverables.length === 0) {
    upgradeGroup.userData.hoveredSelections = {};
    return false;
  }

  // Find ALL hovered objects from ALL raycasters
  const hoveredObjs = new Set();
  raycasters.forEach(rc => {
    const hits = rc.intersectObjects(hoverables, false);
    if (hits.length > 0) {
      hoveredObjs.add(hits[0].object);
      const sourceKey = rc._hudSourceKey;
      if (sourceKey) {
        const selection = resolveUpgradeSelectionFromObject(hits[0].object);
        if (selection) hoveredUpgradeSelections[sourceKey] = selection;
      }
    }
  });

  // Fix for upgrade trigger regression: cache hovered upgrade targets per input
  // source so each controller can only select the card it is actually aiming at.
  upgradeGroup.userData.hoveredSelections = hoveredUpgradeSelections;

  let newHover = false;

  // ── Per-key box highlighting is handled in the hoverables loop below ──
  // (no merged glow mesh needed; each key has its own material)

  // We need to keep track of ALL hoverables to reset those NOT hovered
  // Traverse and reset or set scale/rotation (skip keyboard keys - handled above)
  hoverables.forEach(obj => {
    // Skip keyboard keys: their glow is handled by pre-created meshes above
    if (obj.userData.isKeyboardKey) {
      const layoutIdx = obj.userData._keyLayoutIndex;
      const layoutEntry = keyboardKeyLayout[layoutIdx];
      if (hoveredObjs.has(obj)) {
        if (!obj.userData._isActuallyHovered) {
          obj.userData._isActuallyHovered = true;
          newHover = true;
        }
        // Per-key box highlight: brighten the hovered key's material
        if (layoutEntry && layoutEntry.boxMat) {
          const hc = layoutEntry.key === 'OK' ? 0x005500 : (layoutEntry.key === 'DEL' ? 0x550000 : 0x112255);
          layoutEntry.boxMat.color.lerp(new THREE.Color(hc), 0.2);
        }
      } else {
        if (obj.userData._isActuallyHovered) {
          obj.userData._isActuallyHovered = false;
        }
        // Revert to base color when not hovered
        if (layoutEntry && layoutEntry.boxMat && layoutEntry.baseColor !== undefined) {
          layoutEntry.boxMat.color.lerp(new THREE.Color(layoutEntry.baseColor), 0.15);
        }
      }
      return;
    }

    let target = obj;
    // For many of our UI elements, the 'active area' is a Mesh inside a Group. 
    // We want to scale the Group for the best visual effect.
    if (obj.parent && obj.parent.type === 'Group') {
      target = obj.parent;
    }

    // CRITICAL: For warping cards - immediately complete warp on hover
    // This prevents cards from getting stuck at small scale if hovered during warp animation
    if (target.userData._warpActive) {
      target.children.forEach(child => {
        if (child.userData._warpActive) {
          child.scale.set(1, 1, 1);
          child.userData._warpActive = false;
        }
      });
      target.userData._warpActive = false;
      target.userData._baseScale = new THREE.Vector3(1, 1, 1);
    }

    if (hoveredObjs.has(obj)) {
      if (!obj.userData._isActuallyHovered) {
        obj.userData._isActuallyHovered = true;
        newHover = true;
      }
      // Hover animation: scale with easing + outer glow
      const baseScale = target.userData._baseScale || target.scale.clone();
      target.userData._baseScale = baseScale;
      const currentScale = target.userData._hoverScale ?? 1;
      const desiredScale = 1.08;
      const nextScale = currentScale + (desiredScale - currentScale) * 0.2;
      target.userData._hoverScale = nextScale;
      target.scale.set(baseScale.x * nextScale, baseScale.y * nextScale, baseScale.z * nextScale);

      // #3: Enhanced glow mesh with dynamic color based on button type
      if (!obj.userData._hoverGlow && obj.geometry) {
        // Determine glow color based on button type
        let glowColor = '0,255,255'; // Default cyan

        // Check for upgrade cards - use border color for glow
        if (obj.userData.isUpgradeCard && obj.userData.borderColor !== undefined) {
          const bc = obj.userData.borderColor;
          const r = (bc >> 16) & 255;
          const g = (bc >> 8) & 255;
          const b = bc & 255;
          glowColor = `${r},${g},${b}`;
        }
        // Check for BACK buttons (red glow)
        else if (obj.userData.scoreboardAction === 'back' ||
            obj.userData.countryAction === 'back' ||
            obj.userData.debugAction === 'back') {
          glowColor = '255,68,68'; // Red (#ff4444)
        }
        // Check for SCOREBOARD button (yellow glow)
        else if (obj.userData.isTitleScoreboardBtn ||
                 obj.userData.scoreboardAction === 'scoreboard') {
          glowColor = '255,255,0'; // Yellow (#ffff00)
        }
        // Check for settings gear button (cyan glow)
        else if (obj.userData.isTitleSettingsBtn) {
          glowColor = '0,255,255'; // Cyan
        }

        const glowGeo = obj.geometry.clone();
        const glowMat = new THREE.MeshBasicMaterial({
          map: getHoverGlowTexture(glowColor),
          transparent: true,
          opacity: 0,
          depthTest: false,
          depthWrite: false,
        });
        const glow = new THREE.Mesh(glowGeo, glowMat);
        glow.renderOrder = 998;
        glow.scale.set(1.3, 1.3, 1.3);  // Larger glow
        glow.position.set(0, 0, -0.01);
        obj.add(glow);
        obj.userData._hoverGlow = glow;
      }
      if (obj.userData._hoverGlow) {
        const glow = obj.userData._hoverGlow;
        const current = glow.material.opacity || 0;
        // #3: Fade-in to brighter glow (0.65 instead of 0.35)
        glow.material.opacity = current + (0.65 - current) * 0.15;  // Slower fade-in for smoothness
      }
    } else {
      if (obj.userData._isActuallyHovered) {
        obj.userData._isActuallyHovered = false;
      }
      const baseScale = target.userData._baseScale || new THREE.Vector3(1, 1, 1);
      const currentScale = target.userData._hoverScale ?? 1;
      const nextScale = currentScale + (1 - currentScale) * 0.2;
      target.userData._hoverScale = nextScale;
      target.scale.set(baseScale.x * nextScale, baseScale.y * nextScale, baseScale.z * nextScale);
      if (obj.userData._hoverGlow) {
        const glow = obj.userData._hoverGlow;
        const current = glow.material.opacity || 0;
        // #3: Fade-out animation (slower for smoothness)
        glow.material.opacity = current + (0 - current) * 0.12;
      }
    }
  });

  // Play hover sound on new hover
  if (newHover) {
    playMenuHoverSound();
  }

  // Update border highlights on pause menu and settings buttons
  if (raycasters.length > 0) {
    const rc = raycasters[0];
    updatePauseMenuHover(rc);
    updateSettingsHover(rc);
  }

  return newHover;
}

/** Highlights the controller currently selected for upgrade */
function showUpgradeHandHighlight(hand, controllers) {
  controllers.forEach((ctrl, i) => {
    const ctrlHand = ctrl.userData && ctrl.userData.handedness;
    const isHand = ctrlHand ? ctrlHand === hand : ((i === 0 && hand === 'left') || (i === 1 && hand === 'right'));
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

function hideUpgradeHandHighlights(controllers) {
  controllers.forEach(ctrl => {
    const existing = ctrl.getObjectByName('upgradeHighlight');
    if (existing) ctrl.remove(existing);
  });
}

/** Updates spinning animation of the highlight */
function updateUpgradeHandHighlights(now) {
  [readyGroup, upgradeGroup].forEach(g => {
    // This is handled via normal scene graph if attached to controller
  });
}

export function clearFloatingMessage() {
  disposeGroupChildren(floatingMessageGroup);
  floatingMessageGroup.visible = false;
  floatingMessageSprite = null;
  floatingMessageText = null;
  floatingMessageHideAt = null;
  floatingMessageSticky = false;
}

// Export nameEntryGroup and pauseMenuGroup for use in other modules
export { nameEntryGroup };
