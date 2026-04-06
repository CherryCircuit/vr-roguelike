// ============================================================
//  HUD, TITLE SCREEN, MENUS, DAMAGE NUMBERS
//  All in-VR UI elements rendered as 3D objects.
// ============================================================

import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { State, game } from './game.js';
import { playMenuHoverSound, playMenuClick } from './audio.js';

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
const pauseMenuGroup = new THREE.Group();  // Pause menu
const pauseCountdownGroup = new THREE.Group();  // 3-2-1 countdown overlay
const floatingMessageGroup = new THREE.Group();

// ── HUD Text Geometry Cache ───────────────────────────────────
// Pool PlaneGeometry by aspect ratio bins to avoid GPU object churn
// when HUD text changes frequently (score, kills, etc.)
const hudGeoCache = {};

function getHudGeo(width, height) {
  // Bin to nearest 0.25 aspect ratio for cache efficiency
  const ar = width / height;
  const binnedAr = Math.round(ar * 4) / 4;
  const binnedW = binnedAr * height;
  const key = `${binnedW.toFixed(2)}x${height.toFixed(2)}`;
  if (!hudGeoCache[key]) {
    hudGeoCache[key] = new THREE.PlaneGeometry(binnedW, height);
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
let debugToggleItems = [];

// ── TextPopupPool: Object pool for popup meshes ────────────────────
// Reuses pre-allocated PlaneGeometry + CanvasTexture + MeshBasicMaterial
// to prevent GEO climbing from constant create/destroy cycles.

class TextPopupPool {
  constructor(scene, maxSize, defaults = {}) {
    this.scene = scene;
    this.maxSize = maxSize;
    this.defaults = defaults;
    this.pool = [];      // Available (inactive) meshes
    this.active = [];    // Currently animating meshes

    for (let i = 0; i < maxSize; i++) {
      const canvas = document.createElement('canvas');
      canvas.width = defaults.canvasWidth || 128;
      canvas.height = defaults.canvasHeight || 64;

      const texture = new THREE.CanvasTexture(canvas);
      texture.minFilter = THREE.LinearFilter;
      texture.premultiplyAlpha = false;

      const geometry = new THREE.PlaneGeometry(
        defaults.width || 1,
        defaults.height || 0.5
      );

      const material = new THREE.MeshBasicMaterial({
        map: texture,
        transparent: true,
        opacity: 0,
        depthTest: defaults.depthTest !== undefined ? defaults.depthTest : false,
        depthWrite: false,
        side: THREE.DoubleSide,
      });

      const mesh = new THREE.Mesh(geometry, material);
      mesh.renderOrder = defaults.renderOrder || 998;
      mesh.visible = false;

      mesh.userData = {
        canvas: canvas,
        ctx: canvas.getContext('2d'),
        active: false,
        velocity: new THREE.Vector3(),
        createdAt: 0,
        lifetime: 0,
      };

      this.pool.push(mesh);
    }
  }

  acquire(position, drawFn, opts = {}) {
    if (this.pool.length === 0) {
      // Pool exhausted: steal oldest active mesh
      if (this.active.length === 0) return null;
      const stolen = this.active.shift();
      this._deactivate(stolen);
      this.pool.push(stolen);
    }

    const mesh = this.pool.pop();
    const ud = mesh.userData;

    // Clear and redraw canvas
    ud.ctx.clearRect(0, 0, ud.canvas.width, ud.canvas.height);
    ud.ctx.shadowColor = 'transparent';
    ud.ctx.shadowBlur = 0;
    drawFn(ud.canvas, ud.ctx, ud.canvas.width, ud.canvas.height);
    mesh.material.map.needsUpdate = true;

    // Store the draw function for potential updates
    ud._drawFn = drawFn;

    // Use scale to adjust apparent size (geometry is fixed at pool creation)
    const w = opts.width || this.defaults.width || 1;
    const h = opts.height || this.defaults.height || 0.5;
    const scaleX = w / (this.defaults.width || 1);
    const scaleY = h / (this.defaults.height || 0.5);
    mesh.scale.set(scaleX, scaleY, 1);

    // Position
    mesh.position.copy(position);
    if (opts.offsetX) mesh.position.x += opts.offsetX;
    if (opts.offsetY) mesh.position.y += opts.offsetY;
    if (opts.offsetZ) mesh.position.z += opts.offsetZ;

    // Velocity
    ud.velocity.copy(opts.velocity || new THREE.Vector3(0, 0.5, 0));

    // Timing
    ud.createdAt = performance.now();
    ud.lifetime = opts.lifetime || 1000;
    ud.active = true;

    // Copy extra userData fields for custom animations
    if (opts.userData) {
      for (const key of Object.keys(opts.userData)) {
        ud[key] = opts.userData[key];
      }
    }

    // Material
    mesh.material.opacity = opts.opacity !== undefined ? opts.opacity : 0.9;
    mesh.material.depthTest = opts.depthTest !== undefined ? opts.depthTest : false;
    mesh.renderOrder = opts.renderOrder || this.defaults.renderOrder || 998;

    mesh.visible = true;
    this.scene.add(mesh);
    this.active.push(mesh);

    return mesh;
  }

  /**
   * Return a single active mesh back to the pool.
   * Used when custom update logic needs to expire individual items.
   */
  release(mesh) {
    const idx = this.active.indexOf(mesh);
    if (idx !== -1) {
      this.active.splice(idx, 1);
      this._deactivate(mesh);
      this.pool.push(mesh);
    }
  }

  /**
   * Update the text on an active mesh without re-acquiring.
   * Used for damage number consolidation.
   */
  updateText(mesh, drawFn) {
    const ud = mesh.userData;
    ud.ctx.clearRect(0, 0, ud.canvas.width, ud.canvas.height);
    ud.ctx.shadowColor = 'transparent';
    ud.ctx.shadowBlur = 0;
    drawFn(ud.canvas, ud.ctx, ud.canvas.width, ud.canvas.height);
    mesh.material.map.needsUpdate = true;
    ud._drawFn = drawFn;
  }

  update(dt, now, onExpire = null) {
    for (let i = this.active.length - 1; i >= 0; i--) {
      const mesh = this.active[i];
      const ud = mesh.userData;
      const age = now - ud.createdAt;

      if (age > ud.lifetime) {
        this.active.splice(i, 1);
        this._deactivate(mesh);
        this.pool.push(mesh);
        if (onExpire) onExpire(mesh);
      } else {
        mesh.position.addScaledVector(ud.velocity, dt);
        if (this.defaults.gravity) {
          ud.velocity.y -= dt * 1.5;
        }
      }
    }
  }

  clearAll() {
    for (const mesh of this.active) {
      this._deactivate(mesh);
      this.pool.push(mesh);
    }
    this.active.length = 0;
  }

  get count() { return this.active.length; }

  _deactivate(mesh) {
    mesh.visible = false;
    mesh.userData.active = false;
    this.scene.remove(mesh);
    mesh.scale.set(1, 1, 1);
    // Reset material opacity so next acquire sets it fresh
    mesh.material.opacity = 0;
  }

  dispose() {
    this.clearAll();
    for (const mesh of this.pool) {
      mesh.material.map.dispose();
      mesh.material.dispose();
      mesh.geometry.dispose();
    }
    this.pool.length = 0;
  }
}

// Popup pool instances (lazy-initialized when sceneRef is available)
let damageNumberPool = null;
let comboPopupPool = null;
let killChainPool = null;

// Damage number consolidation: track active numbers by position key
const activeDamageNumbers = new Map(); // positionKey -> { mesh, totalDamage, color, positionKey }

function ensurePools() {
  if (damageNumberPool) return;
  damageNumberPool = new TextPopupPool(sceneRef, 15, {
    canvasWidth: 128, canvasHeight: 64,
    width: 0.65, height: 0.325,
    gravity: true,
    renderOrder: 998,
  });
  comboPopupPool = new TextPopupPool(sceneRef, 5, {
    canvasWidth: 512, canvasHeight: 128,
    width: 3.2, height: 0.8,
    gravity: false,
    renderOrder: 999,
  });
  killChainPool = new TextPopupPool(sceneRef, 5, {
    canvasWidth: 512, canvasHeight: 256,
    width: 3.0, height: 1.5,
    gravity: false,
    renderOrder: 999,
  });
}

function disposePools() {
  if (damageNumberPool) { damageNumberPool.dispose(); damageNumberPool = null; }
  if (comboPopupPool) { comboPopupPool.dispose(); comboPopupPool = null; }
  if (killChainPool) { killChainPool.dispose(); killChainPool = null; }
}

// Upgrade card meshes (for raycasting)
let upgradeCards = [];
let upgradeChoices = [];

// Hit flash (red sphere inside camera)
let hitFlash = null;
let hitFlashOpacity = 0;

// Speed lines overlay (radial streaks during slow-mo)
const ENABLE_SPEED_LINES = true;
let speedLinesMesh = null;
let speedLinesOpacity = 0;

// Boss health bar (camera-attached, 3 segments for phases)
let bossHealthGroup = null;
let bossHealthBars = []; // 3 segments

// Title blink
let titleBlinkSprite = null;

// Title scoreboard button
let titleScoreboardBtn = null;

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

// Holographic HUD effect state
let holographicState = {
  glitchIntensity: 0,      // 0-1, triggered on player hit
  glitchStartTime: 0,
  scanLineOffset: 0,       // Animated scan line position
  flickerPhase: 0,         // Subtle flicker animation
  colorShift: 0,           // Color distortion during glitch
};

// Holographic overlay mesh (scan lines)
let holoScanLineMesh = null;
let holoGlitchMesh = null;

function drawHeart(ctx, x, y, pixSize, state, animState = {}) {
  // state: 'full', 'half', 'empty'
  // animState: { glowIntensity, hitFlash, isHealthGain }
  
  const glowIntensity = animState.glowIntensity || 0;
  const hitFlash = animState.hitFlash || 0;
  const isHealthGain = animState.isHealthGain || false;
  
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
        // Base color
        let r = 255, g = 0, b = 68;
        
        // #23: Health gain animation - turn green
        if (isHealthGain) {
          r = 0; g = 255; b = 100;
        }
        // #23: Hit flash animation - fade red
        else if (hitFlash > 0) {
          // Interpolate from bright red (#ff0000) back to pink (#ff0044)
          const t = hitFlash; // 1.0 = bright red, 0.0 = normal
          r = 255;
          g = Math.floor(t * 50); // Add some red tint
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
    // Draw a larger heart shape for glow
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

export function initHUD(camera, scene) {
  sceneRef = scene;
  cameraRef = camera;

  // #11: Load November font for scoreboard
  loadNovemberFont();

  // ── Title Screen (world-space, fixed position) ──
  createTitleScreen();
  titleGroup.position.set(0, 1.2, -3.5);  // Moved down for better centering
  titleGroup.rotation.set(0, 0, 0);
  titleGroup.visible = true;
  scene.add(titleGroup);

  // ── VR HUD (stationary on floor, Space Pirate Trainer style) ──
  createHUDElements();
  hudGroup.position.set(0, 0.0, -3);  // On floor, 3 feet in front of spawn; Y=0 to sit flush
  hudGroup.rotation.x = -Math.PI / 2 + 0.349;  // Face up + 20° tilt toward player (one-time static)
  scene.add(hudGroup);

  // ── UI Groups (initially hidden) ──
  floatingMessageGroup.visible = false;
  floatingMessageGroup.position.set(0, 0.1, -0.8);
  camera.add(floatingMessageGroup);

  [levelTextGroup, upgradeGroup, gameOverGroup, nameEntryGroup, scoreboardGroup, countrySelectGroup, readyGroup, debugMenuGroup].forEach(g => {
    g.visible = false;
    g.rotation.set(0, 0, 0);
    scene.add(g);
  });

  // Pause menu in 3D world space (fixed position, not camera-locked)
  pauseMenuGroup.visible = false;
  pauseMenuGroup.rotation.set(0, 0, 0);
  scene.add(pauseMenuGroup);

  // Disable frustum culling on all UI groups to prevent disappearing when looking around
  // UI elements have unreliable bounding boxes/spheres that cause false culling
  [
    titleGroup, hudGroup, floatingMessageGroup, levelTextGroup, upgradeGroup,
    gameOverGroup, nameEntryGroup, scoreboardGroup, countrySelectGroup,
    readyGroup, debugMenuGroup, pauseMenuGroup, pauseCountdownGroup
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
      blending: THREE.AdditiveBlending,  // Makes flash visible even on bright backgrounds
    }),
  );
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
  fpsSprite.position.set(-0.15, 0.12, -0.5);  // Moved closer to center
  fpsSprite.renderOrder = 1001;
  fpsSprite.frustumCulled = false;  // Prevent disappearing when looking around
  camera.add(fpsSprite);

  // ── Boss health bar (top center, camera-attached, 3 segments) ──
  bossHealthGroup = new THREE.Group();
  bossHealthGroup.position.set(0, 0.28, -0.5);
  bossHealthGroup.visible = false;
  const barWidth = 0.30;
  const barHeight = 0.04;
  const gap = 0.014;

  // Background bar for contrast (dark strip behind the health segments)
  const bgGeo = new THREE.PlaneGeometry(barWidth * 3 + gap * 4, barHeight + 0.01);
  const bgMat = new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.6, side: THREE.DoubleSide, depthTest: false, depthWrite: false });
  const bgBar = new THREE.Mesh(bgGeo, bgMat);
  bgBar.renderOrder = 999;
  bossHealthGroup.add(bgBar);

  for (let i = 0; i < 3; i++) {
    const geo = new THREE.PlaneGeometry(barWidth, barHeight);
    const mat = new THREE.MeshBasicMaterial({ color: 0xff0044, transparent: true, opacity: 0.95, side: THREE.DoubleSide, depthTest: false, depthWrite: false });
    const bar = new THREE.Mesh(geo, mat);
    bar.position.x = (i - 1) * (barWidth + gap);
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

function createTitleScreen() {
  // Big title: SPACEOMICIDE
  const titleSprite = makeSprite('SPACEOMICIDE', {
    fontSize: 70,
    color: '#00ffff',
    glow: true, glowColor: '#0088ff', glowSize: 15,
    scale: 0.9,
  });
  titleSprite.position.set(0, 0.9, 0);  // Moved down for better centering
  titleGroup.add(titleSprite);

  // Subtitle
  const subSprite = makeSprite('VR ROGUELIKE BLASTER', {
    fontSize: 24,
    color: '#ff00ff',
    glow: true, glowColor: '#ff00ff', glowSize: 5,
    scale: 0.3,
  });
  subSprite.position.set(0, 0.4, 0);  // Moved down for better centering
  titleGroup.add(subSprite);

  // Blinking "Press Trigger to Begin"
  titleBlinkSprite = makeSprite('PRESS TRIGGER TO BEGIN', {
    fontSize: 26,
    color: '#ffffff',
    glow: true, glowColor: '#ffffff',
    scale: 0.25,
  });
  titleBlinkSprite.position.set(0, -0.2, 0);  // Moved down for better centering
  titleGroup.add(titleBlinkSprite);

  // Scoreboard button
  const btnGroup = new THREE.Group();
  btnGroup.position.set(0, -0.8, 0);  // Moved down for better centering
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

// Create holographic scan line texture - subtle floor projection effect
function createHoloScanLineTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d');

  // Transparent background
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // Draw very subtle horizontal scan lines with gaps
  ctx.fillStyle = 'rgba(0, 255, 255, 0.06)';  // Much more subtle
  const lineSpacing = 8;  // Wider spacing
  for (let y = 0; y < canvas.height; y += lineSpacing) {
    ctx.fillRect(0, y, canvas.width, 1);
  }

  // Minimal noise for authentic hologram look
  ctx.fillStyle = 'rgba(0, 255, 255, 0.03)';
  for (let i = 0; i < 50; i++) {  // Fewer dots
    const x = Math.random() * canvas.width;
    const y = Math.random() * canvas.height;
    ctx.fillRect(x, y, 1, 1);  // Smaller dots
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.minFilter = THREE.LinearFilter;
  return texture;
}

// Create glitch overlay texture with dramatic color separation
function createGlitchTexture(intensity) {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 256;
  const ctx = canvas.getContext('2d');

  ctx.clearRect(0, 0, canvas.width, canvas.height);

  if (intensity > 0) {
    // Heavy horizontal glitch bars with RGB separation
    const barCount = Math.floor(intensity * 20);
    for (let i = 0; i < barCount; i++) {
      const y = Math.random() * canvas.height;
      const h = Math.random() * 30 + 3;
      const offset = (Math.random() - 0.5) * intensity * 80;

      // Red channel offset
      ctx.fillStyle = `rgba(255, 0, 50, ${0.4 * intensity})`;
      ctx.fillRect(offset - 15, y, canvas.width + 30, h);

      // Cyan channel offset (opposite direction)
      ctx.fillStyle = `rgba(0, 255, 255, ${0.4 * intensity})`;
      ctx.fillRect(15 - offset, y, canvas.width + 30, h);

      // White center for digital corruption look
      ctx.fillStyle = `rgba(255, 255, 255, ${0.2 * intensity})`;
      ctx.fillRect(0, y, canvas.width, h / 2);
    }

    // Random noise blocks (digital artifacts)
    ctx.fillStyle = `rgba(255, 255, 255, ${0.3 * intensity})`;
    for (let i = 0; i < 80 * intensity; i++) {
      const x = Math.random() * canvas.width;
      const y = Math.random() * canvas.height;
      const w = Math.random() * 50 + 5;
      const h = Math.random() * 8 + 2;
      ctx.fillRect(x, y, w, h);
    }

    // Vertical tear lines
    ctx.strokeStyle = `rgba(0, 255, 255, ${0.5 * intensity})`;
    ctx.lineWidth = 2;
    for (let i = 0; i < 5 * intensity; i++) {
      const x = Math.random() * canvas.width;
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x + (Math.random() - 0.5) * 20, canvas.height);
      ctx.stroke();
    }

    // Random colored blocks
    const colors = ['#ff0066', '#00ffff', '#ffff00', '#ff00ff'];
    for (let i = 0; i < 15 * intensity; i++) {
      ctx.fillStyle = colors[Math.floor(Math.random() * colors.length)];
      ctx.globalAlpha = 0.3 * intensity;
      const x = Math.random() * canvas.width;
      const y = Math.random() * canvas.height;
      ctx.fillRect(x, y, Math.random() * 40, Math.random() * 10);
    }
    ctx.globalAlpha = 1;
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.minFilter = THREE.LinearFilter;
  return texture;
}

function createHUDElements() {
  hudGroup.visible = false;
  hudGroup.renderOrder = 999;

  // Floor-based HUD layout (Space Pirate Trainer style)
  // Increased by 200% (3x) for better visibility

  // HOLOGRAPHIC BASE - removed, no background box
  // HUD elements themselves will have holographic glow effects

  // HOLOGRAPHIC SCAN LINES OVERLAY - very subtle, minimal idle effect
  const scanLineGeo = new THREE.PlaneGeometry(4.8, 2.0);
  const scanLineTexture = createHoloScanLineTexture();
  const scanLineMat = new THREE.MeshBasicMaterial({
    map: scanLineTexture,
    transparent: true,
    opacity: 0.08,  // Very subtle idle effect
    depthTest: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending,
  });
  holoScanLineMesh = new THREE.Mesh(scanLineGeo, scanLineMat);
  holoScanLineMesh.position.set(0, -0.001, 0);
  holoScanLineMesh.renderOrder = 998;
  hudGroup.add(holoScanLineMesh);

  // GLITCH OVERLAY (initially invisible, only shows on player hit)
  const glitchGeo = new THREE.PlaneGeometry(4.8, 2.0);
  const glitchMat = new THREE.MeshBasicMaterial({
    transparent: true,
    opacity: 0,
    depthTest: false,
    depthWrite: false,
    side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending,
  });
  holoGlitchMesh = new THREE.Mesh(glitchGeo, glitchMat);
  holoGlitchMesh.position.set(0, 0.001, 0);
  holoGlitchMesh.renderOrder = 1000;
  hudGroup.add(holoGlitchMesh);

  // Lives (hearts) - left side on floor
  // #19: Hearts aligned with TOP of SCORE and LEVEL X titles
  // Layout: Spread horizontally to avoid overlap
  const heartsGeo = new THREE.PlaneGeometry(1.2, 0.24);
  const heartsMat = new THREE.MeshBasicMaterial({ transparent: true, depthTest: true, depthWrite: false, side: THREE.DoubleSide });
  heartsSprite = new THREE.Mesh(heartsGeo, heartsMat);
  heartsSprite.position.set(-1.1, 0.45, 0);  // Left, top row (tighter spacing)
  heartsSprite.renderOrder = 999;
  hudGroup.add(heartsSprite);

  // SCORE - center-left on floor with title above
  // Layout: Spread from hearts, number centered under SCORE title
  scoreSprite = makeSprite('0', { fontSize: 75, color: '#ffff00', shadow: true, scale: 0.45 });
  scoreSprite.position.set(-0.15, 0.0, 0);  // Centered under SCORE title
  hudGroup.add(scoreSprite);

  // SCORE title - above score in yellow same style as level
  scoreTitleSprite = makeSprite('SCORE', { fontSize: 72, color: '#ffff00', glow: true, glowColor: '#ffff00', scale: 0.45 });
  scoreTitleSprite.position.set(-0.15, 0.45, 0);  // Top row, aligned with score number below
  hudGroup.add(scoreTitleSprite);

  // Kill counter — below LEVEL display
  // Layout: Center-right, below level
  killCountSprite = makeSprite('0/0', { fontSize: 75, color: '#ffffff', shadow: true, scale: 0.45 });
  killCountSprite.position.set(0.5, 0.0, 0);  // Center-right, second row
  hudGroup.add(killCountSprite);

  // Level indicator — above kill counter
  // Layout: Center-right, top row
  levelSprite = makeSprite('LEVEL 1', { fontSize: 72, color: '#00ffff', glow: true, scale: 0.45 });
  levelSprite.position.set(0.5, 0.45, 0);  // Center-right, top row
  hudGroup.add(levelSprite);

  // Nuke counter — far right, top row; emoji 2x size, count text normal
  nukeEmojiSprite = makeSprite('☢', { fontSize: 144, color: '#ffff44', glow: true, glowColor: '#ffff44', scale: 0.45 });
  nukeEmojiSprite.position.set(0.9, 0.45, 0);  // Far right, top row (emoji, left)
  hudGroup.add(nukeEmojiSprite);
  nukeCountSprite = makeSprite('X3', { fontSize: 72, color: '#ffff44', glow: true, glowColor: '#ffff44', scale: 0.45 });
  nukeCountSprite.position.set(1.3, 0.45, 0);  // Far right, top row (count, right)
  hudGroup.add(nukeCountSprite);

  // Accuracy bonus — center, just below main HUD row
  // Y=-0.45 keeps it close to the SCORE/LEVEL row (Y=0.3) without overlap
  comboSprite = makeSprite('1x', { fontSize: 40, color: '#ff8800', shadow: true, scale: 1.8 });
  comboSprite.position.set(0, -0.23, 0);  // Moved up closer to main HUD (gap halved)
  comboSprite.visible = false;
  hudGroup.add(comboSprite);

  // Accuracy bonus meter bar — directly below combo text
  const cooldownGeo = new THREE.PlaneGeometry(0.5, 0.03);
  const cooldownMat = new THREE.MeshBasicMaterial({ color: 0xff8800, transparent: true, opacity: 0.8 });
  comboCooldownSprite = new THREE.Mesh(cooldownGeo, cooldownMat);
  comboCooldownSprite.position.set(0, -0.38, 0);  // Below bonus text (moved up, gap halved)
  comboCooldownSprite.visible = false;
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

// Holographic glitch effect trigger
export function triggerHoloGlitch() {
  holographicState.glitchIntensity = 1.0;
  holographicState.glitchStartTime = performance.now();
  holographicState.colorShift = 1.0;
}

export function resetHoloGlitch() {
  holographicState.glitchIntensity = 0;
  holographicState.colorShift = 0;
  if (holoGlitchMesh) {
    holoGlitchMesh.material.opacity = 0;
  }
  if (hudGroup) {
    hudGroup.position.x = 0;
    hudGroup.position.z = -3;
  }
  if (holoScanLineMesh) {
    holoScanLineMesh.position.x = 0;
  }
}

export function updateHolographicGlitch(now) {
  // Update scan line animation (moving downward)
  holographicState.scanLineOffset = (now * 0.0005) % 1;
  if (holoScanLineMesh && holoScanLineMesh.material.map) {
    holoScanLineMesh.material.map.offset.y = holographicState.scanLineOffset;
  }

  // REMOVED: Random idle flicker - HUD should ONLY glitch when player takes damage
  // Keep scan lines stable when no damage
  if (holoScanLineMesh) {
    holoScanLineMesh.material.opacity = 0.08;
  }

  // Decay glitch effect
  if (holographicState.glitchIntensity > 0) {
    const glitchAge = now - holographicState.glitchStartTime;
    const glitchDuration = 600; // 600ms glitch duration for noticeable effect
    if (glitchAge > glitchDuration) {
      holographicState.glitchIntensity = 0;
      holographicState.colorShift = 0;
    } else {
      holographicState.glitchIntensity = Math.max(0, 1 - (glitchAge / glitchDuration));
    }

    // Update glitch overlay
    if (holoGlitchMesh) {
      if (holographicState.glitchIntensity > 0.05) {
        const glitchTexture = createGlitchTexture(holographicState.glitchIntensity);
        if (holoGlitchMesh.material.map) holoGlitchMesh.material.map.dispose();
        holoGlitchMesh.material.map = glitchTexture;
        holoGlitchMesh.material.opacity = holographicState.glitchIntensity * 0.9;
        holoGlitchMesh.material.needsUpdate = true;

        // Shake the entire HUD group during glitch
        const shakeX = (Math.random() - 0.5) * 0.08 * holographicState.glitchIntensity;
        const shakeZ = (Math.random() - 0.5) * 0.05 * holographicState.glitchIntensity;
        hudGroup.position.x = shakeX;
        hudGroup.position.z = -3 + shakeZ;

        // Also shake the scan lines for extra effect
        if (holoScanLineMesh) {
          holoScanLineMesh.position.x = shakeX * 0.5;
        }
      } else {
        holoGlitchMesh.material.opacity = 0;
        // Reset HUD position
        hudGroup.position.x = 0;
        hudGroup.position.z = -3;
        if (holoScanLineMesh) {
          holoScanLineMesh.position.x = 0;
        }
      }
    }
  } else {
    // Ensure HUD position is reset
    hudGroup.position.x = 0;
    hudGroup.position.z = -3;
    if (holoScanLineMesh) {
      holoScanLineMesh.position.x = 0;
    }
  }
}

export function triggerHealthGainAnimation() {
  heartAnimationState.healthGain = 1.0;
}

function updateSpriteText(sprite, text, opts = {}) {
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

  // === HOLOGRAPHIC EFFECTS ===
  updateHolographicGlitch(now);

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
      heartsSprite.geometry = getHudGeo(ha * 0.48, 0.48);
    }
  }

  // Kill counter - #5: Moved up closer to LEVEL display
  // #6: Moved left to x=0.5 (center-right) to be closer to SCORE display
  const cfg = gameState._levelConfig;
  const killTarget = cfg ? cfg.killTarget : 0;
  updateSpriteText(killCountSprite, `${gameState.kills} / ${killTarget}`, { color: '#ffffff', scale: 0.45 });

  // Level - #6: Moved left to x=0.5 (center-right) closer to SCORE display
  // #7: Scale 0.45 matches SCORE title for perfect alignment
  updateSpriteText(levelSprite, `LEVEL ${gameState.level}`, { color: '#00ffff', glow: true, glowColor: '#00ffff', scale: 0.45 });

  // Score - #4: fontSize:75 scale:0.45 matches kill counter for consistency
  updateSpriteText(scoreSprite, `${gameState.score}`, { color: '#ffff00', scale: 0.45 });

  // Nuke counter - #6: Moved to x=1.4 (right) on top row, right of LEVEL display
  const nukeCount = gameState.nukes || 0;
  if (nukeCount > 0 && nukeEmojiSprite) {
    nukeEmojiSprite.visible = true;
    nukeCountSprite.visible = true;
    updateSpriteText(nukeCountSprite, `X${nukeCount}`, { color: '#ffff44', glow: true, glowColor: '#ffff44', scale: 0.45 });
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
    updateSpriteText(comboSprite, `${accuracyMult}X ACCURACY BONUS`, { color: '#ff8800', scale: 0.18 });

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
  upgradeGroup.add(header);

  // Cooldown text
  const cooldownSprite = makeSprite('WAIT...', { fontSize: 36, color: '#ffff00', scale: 0.3 });
  cooldownSprite.position.set(0, 0.8, 0);
  cooldownSprite.name = 'cooldown';
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
  // Add null check for position - provide default if undefined
  if (position && typeof position.x === 'number') {
    group.position.copy(position);
  } else {
    console.warn('[hud] createUpgradeCard received invalid position, using default');
    group.position.set(0, 0, 0);
  }
  group.userData.upgradeId = upgrade.id;

  // Card background plane
  const cardGeo = new THREE.PlaneGeometry(1.2, 1.5);
  const cardMat = new THREE.MeshBasicMaterial({
    color: 0x110033,
    transparent: true,
    opacity: 0.91,  // Match SKIP card transparency
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
  
  // Store border color on card for hover glow matching
  card.userData.borderColor = borderColor;

  // Name text - increased proportionally to card size
  const nameSprite = makeSprite(upgrade.name.toUpperCase(), {
    fontSize: 45,
    color: upgrade.color || '#00ffff',
    glow: true,
    glowColor: upgrade.color,
    scale: 0.24,
    depthTest: true,
    maxWidth: 600,  // Increased from 400 to reduce 2-line wrapping
  });
  nameSprite.position.set(0, 0.55, 0.01);
  group.add(nameSprite);

  // #18: Description text - static font size, width matches title boundary, moved up
  const descSprite = makeSprite(upgrade.desc, {
    fontSize: 32,  // Static font size (was variable 60)
    color: '#cccccc',
    scale: 0.36,   // Adjusted scale for readability
    depthTest: true,
    maxWidth: 280, // Width matches title text boundary
  });
  descSprite.position.set(0, 0.15, 0.01);  // Moved up (was -0.05)
  group.add(descSprite);

  // Side-grade note (different color) when present
  if (upgrade.sideGradeNote) {
    const noteSprite = makeSprite(upgrade.sideGradeNote, {
      fontSize: 22,
      color: '#ffdd00',
      scale: 0.14,
      depthTest: true,
      maxWidth: 280,
    });
    noteSprite.position.set(0, -0.15, 0.01);  // Moved up (was -0.28)
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
  // Add null check for position - provide default if undefined
  if (position && typeof position.x === 'number') {
    group.position.copy(position);
  } else {
    console.warn('[hud] createSkipCard received invalid position, using default');
    group.position.set(0, 0, 0);
  }
  group.userData.upgradeId = 'SKIP';  // Special ID for skip

  // Smaller card (0.7×0.9 vs 0.9×1.1 for upgrades)
  const cardGeo = new THREE.PlaneGeometry(1.0, 1.3);
  const cardMat = new THREE.MeshBasicMaterial({
    color: 0x220044,
    transparent: true,
    opacity: 0.91,  // Increased from 0.7 by 30%
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
  
  // Store border color on card for hover glow matching (green for skip)
  card.userData.borderColor = 0x00ff88;

  // "SKIP" text - increased proportionally
  const nameSprite = makeSprite('SKIP', {
    fontSize: 45,
    color: '#00ff88',
    glow: true,
    glowColor: '#00ff88',
    scale: 0.24,
    depthTest: true,
  });
  nameSprite.position.set(0, 0.48, 0.01);
  group.add(nameSprite);

  // Description
  const descSprite = makeSprite('Skip upgrades and gain full health.', {
    fontSize: 32,  // Match upgrade card description sizing
    color: '#88ffaa',
    scale: 0.36,
    depthTest: true,
    maxWidth: 280,
  });
  descSprite.position.set(0, -0.02, 0.01);
  group.add(descSprite);

  // Heart icon
  const iconMesh = new THREE.Mesh(
    new THREE.OctahedronGeometry(0.08, 0),
    new THREE.MeshBasicMaterial({ color: '#ff0044', wireframe: true }),
  );
  iconMesh.position.set(0, -0.42, 0.05);
  group.add(iconMesh);
  group.userData.iconMesh = iconMesh;

  return group;
}

export function hideUpgradeCards() {
  disposeGroupChildren(upgradeGroup);
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
  disposeGroupChildren(gameOverGroup);

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

  // Position in front of player (VR-friendly)
  gameOverGroup.position.copy(playerPos);
  gameOverGroup.position.y += 1.6 + SCENE_Y_OFFSET; // Eye level
  gameOverGroup.position.z -= 5; // 5 feet in front of player
  gameOverGroup.visible = true;
}

export function showVictory(score, playerPos) {
  hideAll();
  disposeGroupChildren(gameOverGroup);

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

  // Position in front of player (VR-friendly)
  gameOverGroup.position.copy(playerPos);
  gameOverGroup.position.y += 1.6 + SCENE_Y_OFFSET; // Eye level
  gameOverGroup.position.z -= 5; // 5 feet in front of player
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

// VR damage indicator: bright environment flash when player takes damage
// This is the PRIMARY hit indicator in VR (camera shake doesn't work well)
// Must be very visible across all biomes (Synthwave, Desert, Alien Planet, Hellscape)
export function triggerHitFlash(includeHoloGlitch = false) {
  // High initial opacity for maximum visibility
  // Additive blending makes this visible even on bright/colored backgrounds
  hitFlashOpacity = 0.9;

  // HUD glitch should only happen when the player takes damage.
  if (includeHoloGlitch) {
    triggerHoloGlitch();
  }
}

export function updateHitFlash(dt) {
  if (hitFlashOpacity > 0) {
    hitFlash.visible = true;
    hitFlash.material.opacity = hitFlashOpacity;
    // Quick fade but not instant - 0.5s total duration
    // Fast enough to not linger, slow enough to be seen
    hitFlashOpacity -= dt * 1.8;
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

// ── Damage Numbers ─────────────────────────────────────────

function makePositionKey(position) {
  // Round position to nearest 0.5 to group hits on the same enemy
  const x = Math.round(position.x * 2) / 2;
  const y = Math.round(position.y * 2) / 2;
  const z = Math.round(position.z * 2) / 2;
  return `${x},${y},${z}`;
}

export function spawnDamageNumber(position, damage, color) {
  ensurePools();

  const posKey = makePositionKey(position);
  const existing = activeDamageNumbers.get(posKey);

  if (existing) {
    // Consolidate: add damage to existing number
    existing.totalDamage += damage;
    const totalDamage = existing.totalDamage;
    const existingColor = existing.color;

    const scale = (0.25 + Math.min(totalDamage / 100, 0.15)) * 1.3;
    const width = scale * 2;
    const height = scale;
    existing.mesh.scale.set(width / 0.65, height / 0.325, 1);

    damageNumberPool.updateText(existing.mesh, (canvas, ctx) => {
      const fontSize = Math.min(48, 28 + totalDamage / 6);
      ctx.font = `bold ${fontSize}px Arial, sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';

      // Drop shadow
      ctx.fillStyle = 'rgba(0,0,0,0.7)';
      ctx.fillText(Math.round(totalDamage).toString(), 66, 34);

      // Main text
      ctx.fillStyle = existingColor || '#ffffff';
      ctx.fillText(Math.round(totalDamage).toString(), 64, 32);
    });

    // Reset lifetime to keep it visible while under fire
    existing.mesh.userData.createdAt = performance.now();
    existing.mesh.userData.lifetime = 600;

    // Pulse effect: briefly scale up
    const baseScaleX = width / 0.65;
    const baseScaleY = height / 0.325;
    existing.mesh.scale.set(baseScaleX * 1.3, baseScaleY * 1.3, 1);
    setTimeout(() => {
      if (existing.mesh.userData.active) {
        existing.mesh.scale.set(baseScaleX, baseScaleY, 1);
      }
    }, 50);

    // Slight upward bump
    existing.mesh.position.y += 0.05;

    return;
  }

  // No existing number: create new one
  const scale = (0.25 + Math.min(damage / 100, 0.15)) * 1.3;
  const width = scale * 2;
  const height = scale;

  const mesh = damageNumberPool.acquire(position, (canvas, ctx) => {
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
  }, {
    width, height, lifetime: 600,
    offsetX: (Math.random() - 0.5) * 0.3,
    offsetY: Math.random() * 0.2,
    offsetZ: (Math.random() - 0.5) * 0.3,
    velocity: new THREE.Vector3(
      (Math.random() - 0.5) * 0.5,
      0.8 + Math.random() * 0.5,
      (Math.random() - 0.5) * 0.5,
    ),
  });

  if (mesh) {
    // Track for consolidation
    mesh.userData._positionKey = posKey;
    activeDamageNumbers.set(posKey, {
      mesh,
      totalDamage: damage,
      color: color || '#ffffff',
      positionKey: posKey,
    });
  }
}

function spawnOuchBubble(position, text = 'OUCH!') {
  ensurePools();

  // Ouch bubbles need a larger canvas, so use comboPopupPool which has 512x128
  // Actually, let's use a separate acquire from a small pool. The damageNumberPool
  // canvas is 128x64 which is too small for the bubble. We'll draw on a bigger canvas.
  // Use comboPopupPool temporarily for the bubble since it has 512x128 canvas.
  comboPopupPool.acquire(position, (canvas, ctx) => {
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
    ctx.fillText(text, 256, 64);
  }, {
    width: 1.5, height: 0.75, lifetime: 800,
    opacity: 1,
    offsetY: 1.0,
    offsetZ: 0.5,
    renderOrder: 999,
    velocity: new THREE.Vector3((Math.random() - 0.5) * 0.5, 1.5, (Math.random() - 0.5) * 0.5),
    userData: { _isOuchBubble: true },
  });
}

// ── CRIT Indicator ─────────────────────────────────────────

export function spawnCritIndicator(position) {
  ensurePools();

  damageNumberPool.acquire(position, (canvas, ctx) => {
    ctx.font = 'bold 36px Arial, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    // Glow effect
    ctx.shadowColor = '#ffff00';
    ctx.shadowBlur = 10;
    ctx.fillStyle = '#ffff00';
    ctx.fillText('CRIT!', 64, 32);
  }, {
    width: 0.4, height: 0.2, lifetime: 1000,
    opacity: 1,
    offsetY: 0.5,
    offsetX: (Math.random() - 0.5) * 0.2,
    renderOrder: 999,
    velocity: new THREE.Vector3(0, 2, 0),
  });
}

export function updateDamageNumbers(dt, now) {
  // Damage number pool uses gravity (set in defaults)
  // Ouch bubbles are in comboPopupPool but need gravity-like animation too
  if (damageNumberPool) {
    // Clean up expired consolidated damage numbers from the map
    for (const [posKey, entry] of activeDamageNumbers) {
      if (!entry.mesh.userData.active) {
        activeDamageNumbers.delete(posKey);
      }
    }
    damageNumberPool.update(dt, now);
  }
  // Update any ouch bubbles sitting in comboPopupPool (they use the pool's non-gravity update)
  if (comboPopupPool) {
    comboPopupPool.update(dt, now);
  }
}

// ── Combo Popups ────────────────────────────────────────────
// Uses comboPopupPool (updated in updateDamageNumbers)
let lastComboValue = 1;

export function spawnComboPopup(combo, cameraPos) {
  ensurePools();

  const text = `${combo}X COMBO!`;

  comboPopupPool.acquire(cameraPos, (canvas, ctx) => {
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
  }, {
    width: 3.2, height: 0.8, lifetime: 2000,
    opacity: 1,
    offsetY: 0.8,
    offsetZ: -2.5,
    renderOrder: 999,
    velocity: new THREE.Vector3(0, 0.3, 0),
  });
}

// updateComboPopups is no longer needed - combo popups are updated
// via comboPopupPool.update() inside updateDamageNumbers().
// The fade-out-in-last-500ms behavior was in the old updateComboPopups
// which was never called from main.js, so it was already not working.

function checkComboIncrease(currentCombo, cameraPos, playSoundFn) {
  if (currentCombo > lastComboValue && currentCombo > 1) {
    spawnComboPopup(currentCombo, cameraPos);
    if (playSoundFn) playSoundFn();
  }
  lastComboValue = currentCombo;
}

// ── Kill Chain Popups (accuracy-based with quick deterioration) ────────
// Uses killChainPool, but with custom animation (pop-in, hold, fade+shrink)
// so we manage the active array manually.

// Hurt effect state for miss penalty
let accuracyHurtState = {
  active: false,
  startTime: 0,
  intensity: 0,
  shrinkMultiplier: 1,  // Extra shrink speed when hurt
};

/**
 * Trigger hurt effect when player misses a shot
 * Adds red flash, shake, and faster shrink/fade of popups
 */
export function triggerAccuracyHurt() {
  accuracyHurtState.active = true;
  accuracyHurtState.startTime = performance.now();
  accuracyHurtState.intensity = 1.0;
  accuracyHurtState.shrinkMultiplier = 3.0;  // 3x faster shrink when hurt

  // Also trigger the hit flash for red screen effect
  triggerHitFlash();
}

export function spawnKillChainPopup(multiplier, cameraPos) {
  ensurePools();

  const text = `${multiplier}X`;
  const lifetime = 600 + (multiplier - 2) * 200;
  const sizeScale = 0.6 + (multiplier - 2) * 0.3;
  const width = sizeScale * 2;
  const height = sizeScale;
  const randomOffsetX = (Math.random() - 0.5) * 1.0;
  const randomOffsetY = (Math.random() - 0.5) * 1.0;

  killChainPool.acquire(cameraPos, (canvas, ctx) => {
    const fontSize = 140;
    ctx.font = `bold ${fontSize}px Arial, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    // Glow effect
    ctx.shadowColor = multiplier >= 5 ? '#ff0088' : multiplier >= 3 ? '#ffaa00' : '#00ffff';
    ctx.shadowBlur = 30;

    // Drop shadow
    ctx.fillStyle = 'rgba(0,0,0,0.9)';
    ctx.fillText(text, 258, 130);

    // Main text - color based on multiplier level
    let color = '#00ffff';
    if (multiplier >= 5) color = '#ff0088';
    else if (multiplier >= 4) color = '#ff00ff';
    else if (multiplier >= 3) color = '#ffaa00';

    ctx.fillStyle = color;
    ctx.fillText(text, 256, 128);

    // Add "ACCURACY!" subtitle
    ctx.font = 'bold 36px Arial, sans-serif';
    ctx.shadowBlur = 10;
    ctx.fillStyle = '#ffffff';
    ctx.fillText('ACCURACY!', 256, 200);
  }, {
    width, height, lifetime, opacity: 1,
    offsetX: randomOffsetX,
    offsetY: 1.0 + randomOffsetY,
    offsetZ: -6,
    renderOrder: 999,
    velocity: new THREE.Vector3(0, 0.15, 0),
    userData: {
      initialScale: 0.3,
      targetScale: 1.0,
      maxScale: 1.0,
      fadeProgress: 0,
      shrinkProgress: 0,
      multiplier: multiplier,
    },
  });
}

export function updateKillChainPopups(dt, now, onFadeComplete) {
  if (!killChainPool) return;

  // Update hurt effect decay
  if (accuracyHurtState.active) {
    const hurtAge = now - accuracyHurtState.startTime;
    const hurtDecayTime = 500;
    if (hurtAge > hurtDecayTime) {
      accuracyHurtState.active = false;
      accuracyHurtState.intensity = 0;
      accuracyHurtState.shrinkMultiplier = 1;
    } else {
      accuracyHurtState.intensity = 1 - (hurtAge / hurtDecayTime);
      accuracyHurtState.shrinkMultiplier = 1 + (2 * accuracyHurtState.intensity);
    }
  }

  // Custom animation loop for kill chain popups (pop-in, hold, fade+shrink)
  for (let i = killChainPool.active.length - 1; i >= 0; i--) {
    const popup = killChainPool.active[i];
    const ud = popup.userData;
    const age = now - ud.createdAt;
    const lifetime = ud.lifetime;
    const shrinkMultiplier = accuracyHurtState.shrinkMultiplier;

    if (age > lifetime) {
      // Return to pool instead of disposing
      killChainPool.release(popup);

      if (onFadeComplete && typeof onFadeComplete === 'function') {
        onFadeComplete(ud.multiplier);
      }
    } else {
      const ageMs = age;
      const popInDuration = 150;
      const holdDuration = 250;
      const fadeOutDuration = 400;
      const fadeOutStart = popInDuration + holdDuration;

      if (ageMs < popInDuration) {
        const t = ageMs / popInDuration;
        const easeOut = 1 - Math.pow(1 - t, 3);
        const scale = ud.initialScale + (ud.targetScale - ud.initialScale) * easeOut;
        popup.scale.setScalar(scale);
      } else if (ageMs < fadeOutStart) {
        popup.scale.setScalar(ud.targetScale);
      } else {
        const fadeProgress = (ageMs - fadeOutStart) / fadeOutDuration;
        const adjustedFadeProgress = Math.min(1, fadeProgress * shrinkMultiplier);

        popup.material.opacity = 1 - adjustedFadeProgress;

        const shrinkScale = ud.targetScale * (1 - adjustedFadeProgress * 0.7);
        popup.scale.setScalar(Math.max(0.1, shrinkScale));

        ud.fadeProgress = adjustedFadeProgress;
      }

      popup.position.addScaledVector(ud.velocity, dt);
    }
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
  debugMenuGroup.visible = false;  // Hide debug menu
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

// ── Debug Menu Screen ──────────────────────────────────────

/**
 * Show the debug menu with toggle options for FPS monitor settings
 */
export function showDebugMenu() {
  console.log('[debug] showDebugMenu called, debugBiomeOverride=', game.debugBiomeOverride);
  hideAll();
  disposeGroupChildren(debugMenuGroup);
  debugToggleItems = [];

  debugMenuGroup.position.set(0, 1.6 + SCENE_Y_OFFSET, -4);
  debugMenuGroup.visible = true;

  // Header
  const header = makeSprite('DEBUG MENU', {
    fontSize: 60, color: '#00ffff', glow: true, glowColor: '#00ffff', scale: 0.6,
  });
  header.position.set(0, 1.4, 0);
  debugMenuGroup.add(header);

  const biomeLabel = game.debugBiomeOverride
    ? game.debugBiomeOverride.replace(/_/g, ' ').toUpperCase()
    : 'AUTO';

  // Toggle and action options
  const options = [
    {
      id: 'fps',
      type: 'toggle',
      label: 'FPS COUNTER',
      getState: () => game.debugShowFPS,
      toggle: () => { game.debugShowFPS = !game.debugShowFPS; }
    },
    {
      id: 'position',
      type: 'toggle',
      label: 'POSITION BOX',
      getState: () => game.debugShowPosition,
      toggle: () => {
        game.debugShowPosition = !game.debugShowPosition;
        // Sync with desktop DOM panel so both stay in lock-step
        if (typeof window !== 'undefined') {
          window.debugPositionPanel = game.debugShowPosition;
        }
      }
    },
    {
      id: 'perf',
      type: 'toggle',
      label: 'PERF MONITOR',
      getState: () => game.debugPerfMonitor,
      toggle: () => { game.debugPerfMonitor = !game.debugPerfMonitor; }
    },
    {
      id: 'biome',
      type: 'action',
      label: 'BIOME',
      action: 'biome_next',
      getStatus: () => biomeLabel,
    },
  ];

  const startY = 0.8;
  const itemHeight = 0.35;
  const itemWidth = 1.8;

  options.forEach((opt, i) => {
    const y = startY - i * itemHeight;
    const isToggle = opt.type === 'toggle';
    const isOn = isToggle ? opt.getState() : true;

    // Background
    const itemGroup = new THREE.Group();
    itemGroup.position.set(0, y, 0);

    const bgGeo = new THREE.PlaneGeometry(itemWidth, 0.28);
    const bgMat = new THREE.MeshBasicMaterial({
      color: isToggle ? (isOn ? 0x003322 : 0x221133) : 0x112233,
      transparent: true,
      opacity: 0.9,
      side: THREE.DoubleSide,
    });
    const bgMesh = new THREE.Mesh(bgGeo, bgMat);
    if (isToggle) {
      bgMesh.userData.debugToggle = opt.id;
    } else {
      bgMesh.userData.debugAction = opt.action;
    }
    itemGroup.add(bgMesh);

    // Border
    itemGroup.add(new THREE.LineSegments(
      new THREE.EdgesGeometry(bgGeo),
      new THREE.LineBasicMaterial({ color: isToggle ? (isOn ? 0x00ff88 : 0x888888) : 0x00ffff })
    ));

    // Label
    const label = makeSprite(opt.label, {
      fontSize: 28, color: '#ffffff', scale: 0.18,
    });
    label.position.set(-0.3, 0, 0.01);
    itemGroup.add(label);

    // Status indicator (ON/OFF or current biome)
    const statusText = isToggle ? (isOn ? 'ON' : 'OFF') : opt.getStatus();
    const statusColor = isToggle ? (isOn ? '#00ff88' : '#ff4444') : '#00ffff';
    const status = makeSprite(statusText, {
      fontSize: 28, color: statusColor, glow: isToggle ? isOn : true, glowColor: statusColor, scale: 0.15,
    });
    status.position.set(0.6, 0, 0.01);
    status.userData.isStatusLabel = true;
    itemGroup.add(status);

    debugMenuGroup.add(itemGroup);
    if (isToggle) {
      debugToggleItems.push({ group: itemGroup, mesh: bgMesh, option: opt });
    }
  });

  // Instructions
  const instructions = makeSprite('CLICK TO TOGGLE OR CYCLE', {
    fontSize: 24, color: '#888888', scale: 0.15,
  });
  instructions.position.set(0, -0.65, 0);
  debugMenuGroup.add(instructions);

  // BACK button
  const backGroup = new THREE.Group();
  backGroup.position.set(0, -1.05, 0);
  const backGeo = new THREE.PlaneGeometry(0.8, 0.28);
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
        const { texture, aspect } = makeTextTexture(statusText, { fontSize: 28, color: statusColor, glow: isOn, glowColor: statusColor });
        if (statusLabel.material.map) statusLabel.material.map.dispose();
        statusLabel.material.map = texture;
        statusLabel.material.needsUpdate = true;
        statusLabel.scale.set(aspect * 0.15, 0.15, 1);
      }
    }
    return null;  // Don't change state, just toggle
  }

  // Check action buttons (like NEXT BIOME)
  const actionMeshes = [];
  debugMenuGroup.traverse(c => {
    if (c.userData && c.userData.debugAction) {
      console.log('[debug-hud] Found action mesh:', c.userData.debugAction);
      actionMeshes.push(c);
    }
  });
  console.log('[debug-hud] Total action meshes:', actionMeshes.length);
  hits = raycaster.intersectObjects(actionMeshes, false);
  console.log('[debug-hud] Action hits:', hits.length);
  if (hits.length > 0) {
    console.log('[debug-hud] Hit action:', hits[0].object.userData.debugAction);
    return { action: hits[0].object.userData.debugAction };
  }

  return null;
}

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
  readyGroup.add(header);

  const instruction = makeSprite('SHOOT TO BEGIN', {
    fontSize: 40, color: '#00ffff', scale: 0.4,
  });
  instruction.position.set(0, 0.4, 0);
  readyGroup.add(instruction);

  readyCountdownSprite = makeSprite('3', {
    fontSize: 120, color: '#ffffff', glow: true, glowColor: '#00ffff', scale: 0.7,
  });
  readyCountdownSprite.position.set(0, -0.05, 0.01);
  readyCountdownSprite.visible = false;
  readyGroup.add(readyCountdownSprite);
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

export function showBossAlert() {
  // Position in front of player (VR-friendly)
  levelTextGroup.position.set(0, 1.6 + SCENE_Y_OFFSET, -4.5);
  levelTextGroup.visible = true;

  // Clear any existing content with proper disposal
  disposeGroupChildren(levelTextGroup);

  // Main alert text
  const alertText = makeSprite('⚠ INCOMING BOSS ⚠', {
    fontSize: 72,
    color: '#ff0000',
    glow: true,
    glowColor: '#ff0000',
    scale: 0.6,
  });
  alertText.position.set(0, 0, 0);
  levelTextGroup.add(alertText);
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
function disposeGroupChildren(group) {
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
  scoreboardGroup.add(mainHeader);

  if (headerInfo.main !== 'LOADING') {
    const subHeader = makeSprite('LEADERBOARD', {
      fontSize: 44, color: '#00ffff', glow: true, glowColor: '#00ffff', scale: 0.5,
    });
    subHeader.position.set(0, 1.95, 0);
    scoreboardGroup.add(subHeader);
  }

  // Score list canvas
  renderScoreboardCanvas();
  scoreboardMesh.position.set(0, 0.45, 0);
  scoreboardGroup.add(scoreboardMesh);

  // Buttons on right side
  const btnDefs = [
    { label: 'COUNTRY', y: 1.2, action: 'country' },
    { label: 'CONTINENT', y: 0.85, action: 'continent' },
    { label: '⬅️ PREV PAGE', y: 0.1, action: 'page_prev' },
    { label: 'NEXT PAGE ➡️', y: -0.25, action: 'page_next' },
  ];

  for (const def of btnDefs) {
    const btnGroup = new THREE.Group();
    btnGroup.position.set(1.55, def.y, 0);

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

  // 6. Name Entry (keyboard keys and actions)
  if (nameEntryGroup.visible) {
    keyboardKeys.forEach(k => { if (k.mesh) hoverables.push(k.mesh); });
    nameEntryActionMeshes.forEach(m => { if (m) hoverables.push(m); });
  }

  // 7. Pause Menu (RESUME button)
  if (pauseMenuGroup.visible) {
    pauseMenuGroup.traverse(c => {
      if (c.userData && c.userData.isResumeButton) hoverables.push(c);
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

// ============================================================
//  PAUSE MENU
// ============================================================

let pauseMenuElements = {
  panel: null,
  leftBlasterSection: null,
  rightBlasterSection: null,
  statsSection: null,
  chartCanvas: null,
  resumeButton: null,
};

let pauseMenuAnimation = {
  slideIn: 0,
  targetSlideIn: 0,
  startTime: 0,
  chartAnimation: 0,
  numbersAnimated: false,
};

let pauseCountdownHeader = null;
let pauseCountdownText = null;
let pauseCountdownOverlay = null;
let pauseCountdownInitialized = false;

/**
 * Show the pause menu with stats and blaster upgrade info
 */
let pauseMenuBasePosition = new THREE.Vector3();
const PAUSE_MENU_SCALE = 0.78;          // ~40% smaller than previous 1.3 scale
const PAUSE_MENU_DISTANCE = 2.6;        // Slightly farther from player in VR
const PAUSE_MENU_RENDER_ORDER = 10000;  // Draw over floor HUD layers
const PAUSE_MENU_FONT_MULTIPLIER = 2.5;

// Render order constants for pause menu elements (layered back to front)
const PAUSE_PANEL_RENDER_ORDER = 10000;
const PAUSE_BORDER_RENDER_ORDER = 10001;
const PAUSE_SECTION_BG_RENDER_ORDER = 10002;
const PAUSE_TEXT_RENDER_ORDER = 10010;

function scalePauseFont(baseFontSize) {
  return Math.round(baseFontSize * PAUSE_MENU_FONT_MULTIPLIER);
}

function scalePauseText(baseScale) {
  return baseScale * PAUSE_MENU_FONT_MULTIPLIER;
}

function applyPauseMenuRenderPriority(root) {
  if (!root) return;
  root.traverse((child) => {
    if (!child.material) return;

    const materials = Array.isArray(child.material) ? child.material : [child.material];
    materials.forEach((mat) => {
      if (!mat) return;
      // CRITICAL: Both must be false for UI to render correctly over scene
      mat.depthTest = false;
      mat.depthWrite = false;
      // Ensure transparency is enabled
      if (mat.opacity !== undefined && mat.opacity < 1) {
        mat.transparent = true;
      }
    });

    // Set render order if not already set
    if (child.renderOrder === 0 || child.renderOrder === undefined) {
      child.renderOrder = PAUSE_TEXT_RENDER_ORDER;
    }
  });
}

/**
 * Create a consistent UI material for pause menu elements
 */
function createPauseMaterial(color, opacity = 0.85) {
  return new THREE.MeshBasicMaterial({
    color,
    transparent: true,
    opacity,
    depthTest: false,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
}

export function showPauseMenu() {
  pauseMenuGroup.visible = true;
  pauseMenuGroup.scale.set(PAUSE_MENU_SCALE, PAUSE_MENU_SCALE, PAUSE_MENU_SCALE);

  // Hide floor HUD while pause menu is open
  if (hudGroup) hudGroup.visible = false;

  // Position menu at fixed world position slightly farther from camera when paused.
  // This makes it stay in 3D space so player can walk around it
  if (cameraRef) {
    const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(cameraRef.quaternion);
    forward.y = 0;
    forward.normalize();
    pauseMenuBasePosition.set(
      cameraRef.position.x + forward.x * PAUSE_MENU_DISTANCE,
      cameraRef.position.y,
      cameraRef.position.z + forward.z * PAUSE_MENU_DISTANCE
    );
    pauseMenuGroup.position.copy(pauseMenuBasePosition);
    // Face the camera once (billboard on pause, not every frame)
    pauseMenuGroup.lookAt(cameraRef.position.x, cameraRef.position.y, cameraRef.position.z);
  }

  if (pauseMenuElements.panel) {
    // Already initialized - rebuild blaster sections so stats are fresh
    ['left', 'right'].forEach(hand => {
      const oldSection = pauseMenuElements[hand + 'BlasterSection'];
      if (oldSection) {
        // Dispose all children properly
        oldSection.traverse(child => {
          if (child.geometry) child.geometry.dispose();
          if (child.material) {
            if (child.material.map) child.material.map.dispose();
            child.material.dispose();
          }
        });
        pauseMenuGroup.remove(oldSection);
      }
      const newSection = createBlasterSection(hand);
      newSection.position.set(hand === 'left' ? -1.25 : 1.25, 0.4, 0.02);
      pauseMenuGroup.add(newSection);
      pauseMenuElements[hand + 'BlasterSection'] = newSection;
    });

    pauseMenuAnimation.targetSlideIn = 1;
    pauseMenuAnimation.startTime = performance.now();
    pauseMenuAnimation.chartAnimation = 0;
    pauseMenuAnimation.numbersAnimated = false;
    applyPauseMenuRenderPriority(pauseMenuGroup);
    return;
  }

  createPauseMenu();
}

/**
 * Hide the pause menu
 */
export function hidePauseMenu() {
  pauseMenuGroup.visible = false;

  // Restore floor HUD
  if (hudGroup) hudGroup.visible = true;
}

/**
 * Update pause menu animations and charts
 */
export function updatePauseMenu(now) {
  if (!pauseMenuGroup.visible) return;

  // Menu stays at fixed world position (set in showPauseMenu)
  // No per-frame repositioning - player can walk around it in 3D space

  // Animate slide-in
  const slideDuration = 500; // ms
  if (pauseMenuAnimation.slideIn < 1) {
    pauseMenuAnimation.slideIn = Math.min(1, (now - pauseMenuAnimation.startTime) / slideDuration);
  }

  // Slide menu in from right (offset X in local space, relative to base position)
  const slideOffset = new THREE.Vector3((1 - pauseMenuAnimation.slideIn) * 4, 0, 0);
  slideOffset.applyQuaternion(pauseMenuGroup.quaternion);
  pauseMenuGroup.position.copy(pauseMenuBasePosition).add(slideOffset);

  // Animate charts
  if (pauseMenuAnimation.chartAnimation < 1) {
    pauseMenuAnimation.chartAnimation += 0.02;
    if (pauseMenuAnimation.chartAnimation > 1) pauseMenuAnimation.chartAnimation = 1;
    updatePauseCharts();
  }

  // Animate numbers
  if (!pauseMenuAnimation.numbersAnimated && pauseMenuAnimation.slideIn > 0.5) {
    pauseMenuAnimation.numbersAnimated = true;
    updatePauseStatsNumbers();
  }
}

/**
 * Create the pause menu UI
 */
function createPauseMenu() {
  const group = pauseMenuGroup;

  // Main panel - ONE dark see-through plane
  const panelWidth = 4.6;
  const panelHeight = 3.6;  // Taller to fit blaster sections with enemies killed

  // Background panel - semi-transparent black, no depth interaction
  const panelGeo = new THREE.PlaneGeometry(panelWidth, panelHeight);
  const panelMat = createPauseMaterial(0x0a0015, 0.85);
  const panel = new THREE.Mesh(panelGeo, panelMat);
  panel.renderOrder = PAUSE_PANEL_RENDER_ORDER;
  group.add(panel);

  // Neon border (cyan) - no depth interaction
  const borderThickness = 0.03;
  const borderMat = createPauseMaterial(0x00ffff, 1.0);
  [
    { w: panelWidth, h: borderThickness, x: 0, y: panelHeight / 2 },
    { w: panelWidth, h: borderThickness, x: 0, y: -panelHeight / 2 },
    { w: borderThickness, h: panelHeight, x: panelWidth / 2, y: 0 },
    { w: borderThickness, h: panelHeight, x: -panelWidth / 2, y: 0 },
  ].forEach(b => {
    const border = new THREE.Mesh(new THREE.PlaneGeometry(b.w, b.h), borderMat);
    border.position.set(b.x, b.y, 0.01);
    border.renderOrder = PAUSE_BORDER_RENDER_ORDER;
    group.add(border);
  });

  pauseMenuElements.panel = panel;

  // Left blaster section (includes stats now)
  const leftSection = createBlasterSection('left');
  leftSection.position.set(-1.25, 0.2, 0.02);
  group.add(leftSection);
  pauseMenuElements.leftBlasterSection = leftSection;

  // Right blaster section (includes stats now)
  const rightSection = createBlasterSection('right');
  rightSection.position.set(1.25, 0.2, 0.02);
  group.add(rightSection);
  pauseMenuElements.rightBlasterSection = rightSection;

  // No more separate stats section - stats are in blaster sections

  // Resume button
  const resumeBtn = createResumeButton();
  resumeBtn.position.set(0, -1.35, 0.03);
  group.add(resumeBtn);
  pauseMenuElements.resumeButton = resumeBtn;

  // Initialize animation
  pauseMenuAnimation.startTime = performance.now();
  pauseMenuAnimation.slideIn = 0;
  pauseMenuAnimation.chartAnimation = 0;
  pauseMenuAnimation.numbersAnimated = false;

  applyPauseMenuRenderPriority(group);
}

// Upgrade icons and colors
const UPGRADE_ICONS = {
  rapid_fire: { icon: '🔥', color: '#ff6600' },
  damage_up: { icon: '⚡', color: '#ffff00' },
  spread_shot: { icon: '💫', color: '#00ffff' },
  piercing: { icon: '🗡️', color: '#ff0000' },
  homing: { icon: '🎯', color: '#00ff00' },
  magnetize: { icon: '🧲', color: '#ff00ff' },
  charge_shot: { icon: '💥', color: '#ff8800' },
  bounce: { icon: '🔄', color: '#88ff00' },
  chain_lightning: { icon: '⚡', color: '#00ffff' },
};

// Enemy type icons for kill tracking
const ENEMY_ICONS = {
  grunt: '👾',
  tank: '🤖',
  speeder: '💨',
  shooter: '🔫',
  bomber: '💣',
  boss: '👹',
};

/**
 * Create a separator line (glowing cyan)
 */
function createSeparator(width = 1.8) {
  const group = new THREE.Group();
  const lineGeo = new THREE.PlaneGeometry(width, 0.02);
  const lineMat = createPauseMaterial(0x00ffff, 0.6);
  const line = new THREE.Mesh(lineGeo, lineMat);
  line.renderOrder = PAUSE_TEXT_RENDER_ORDER;
  group.add(line);
  
  // Glow effect
  const glowGeo = new THREE.PlaneGeometry(width, 0.06);
  const glowMat = createPauseMaterial(0x00ffff, 0.15);
  const glow = new THREE.Mesh(glowGeo, glowMat);
  glow.position.z = -0.01;
  glow.renderOrder = PAUSE_TEXT_RENDER_ORDER - 1;
  group.add(glow);
  
  return group;
}

/**
 * Create blaster upgrade section for one hand (no nested background)
 */
function createBlasterSection(hand, panelX) {
  const group = new THREE.Group();
  let yPos = 1.3;

  // Title
  const titleText = makeSprite(`${hand.toUpperCase()} BLASTER`, {
    fontSize: scalePauseFont(44),
    color: '#00ffff',
    scale: scalePauseText(0.13),
    renderOrder: PAUSE_TEXT_RENDER_ORDER
  });
  titleText.position.set(0, yPos, 0.02);
  group.add(titleText);
  yPos -= 0.20;

  // Weapon name
  const weaponId = game.mainWeapon[hand] || 'BLASTER';
  const weaponName = weaponId.replace(/_/g, ' ').toUpperCase();
  const weaponText = makeSprite(weaponName, {
    fontSize: scalePauseFont(32),
    color: '#ffffff',
    scale: scalePauseText(0.08),
    renderOrder: PAUSE_TEXT_RENDER_ORDER
  });
  weaponText.position.set(0, yPos, 0.02);
  group.add(weaponText);
  yPos -= 0.10;

  // Separator after weapon name
  const sep1 = createSeparator(1.8);
  sep1.position.set(0, yPos, 0.02);
  group.add(sep1);
  yPos -= 0.08;

  // Upgrades header
  const upgradesHeader = makeSprite('[UPGRADES]', {
    fontSize: scalePauseFont(24),
    color: '#888888',
    scale: scalePauseText(0.06),
    renderOrder: PAUSE_TEXT_RENDER_ORDER
  });
  upgradesHeader.position.set(0, yPos, 0.02);
  group.add(upgradesHeader);
  yPos -= 0.10;

  // Upgrades list - 2 columns (exclude dream_fragment - it's a collectible, not an upgrade)
  const upgrades = game.upgrades[hand] || {};
  const upgradeEntries = Object.entries(upgrades).filter(([id]) => id !== 'dream_fragment');

  const colLeft = -0.48;
  const colRight = 0.48;
  const upgScale = 0.05;   // actual scale = 0.05 * 2.5 = 0.125
  const upgRowHeight = 0.14; // must exceed sprite visual height (~0.125)

  if (upgradeEntries.length > 0) {
    upgradeEntries.forEach(([id, count], index) => {
      const iconData = UPGRADE_ICONS[id] || { icon: '•', color: '#ffffff' };
      const displayName = id.replace(/_/g, ' ').toUpperCase();
      const x = index % 2 === 0 ? colLeft : colRight;
      const row = Math.floor(index / 2);
      const upgradeText = makeSprite(`${iconData.icon} ${displayName} x${count}`, {
        fontSize: scalePauseFont(22),
        color: iconData.color,
        scale: scalePauseText(upgScale),
        renderOrder: PAUSE_TEXT_RENDER_ORDER
      });
      upgradeText.position.set(x, yPos - (row * upgRowHeight), 0.02);
      upgradeText.userData = { isUpgradeSprite: true };
      group.add(upgradeText);
    });
    const upgRows = Math.ceil(upgradeEntries.length / 2);
    yPos -= (upgRows * upgRowHeight + 0.10);  // extra gap after upgrades
  } else {
    const noUpgradesText = makeSprite('NO UPGRADES', {
      fontSize: scalePauseFont(22),
      color: '#666666',
      scale: scalePauseText(upgScale),
      renderOrder: PAUSE_TEXT_RENDER_ORDER
    });
    noUpgradesText.position.set(0, yPos, 0.02);
    noUpgradesText.userData = { isUpgradeSprite: true };
    group.add(noUpgradesText);
    yPos -= 0.18;
  }

  // Separator after upgrades
  const sep2 = createSeparator(1.8);
  sep2.position.set(0, yPos, 0.02);
  group.add(sep2);
  yPos -= 0.10;

  // Stats: compact 2-column layout
  const handData = game.handStats[hand] || {};
  const stats = {
    kills: handData.kills ?? 0,
    shotsFired: handData.shotsFired ?? 0,
    shotsHit: handData.shotsHit ?? 0
  };
  const accuracy = stats.shotsFired > 0 ? Math.round((stats.shotsHit / stats.shotsFired) * 100) : 0;

  const statLines = [
    { label: 'KILLS', value: stats.kills, color: '#ff00ff' },
    { label: 'SHOTS', value: stats.shotsFired, color: '#00ffff' },
    { label: 'HITS', value: stats.shotsHit, color: '#00ffff' },
    { label: 'ACC', value: `${accuracy}%`, color: accuracy >= 50 ? '#00ff00' : '#ff4444' },
  ];

  // Render stats in 2 columns: left (KILLS, HITS) and right (SHOTS, ACC)
  const statScale = 0.055;  // actual = 0.055 * 2.5 = 0.1375
  const statRowHeight = 0.15; // must exceed sprite visual height
  statLines.forEach((stat, index) => {
    const x = index % 2 === 0 ? colLeft : colRight;
    const row = Math.floor(index / 2);
    const statText = makeSprite(`${stat.label}: ${stat.value}`, {
      fontSize: scalePauseFont(22),
      color: stat.color,
      scale: scalePauseText(statScale),
      renderOrder: PAUSE_TEXT_RENDER_ORDER
    });
    statText.position.set(x, yPos - (row * statRowHeight), 0.02);
    statText.userData = { isStatSprite: true, hand, statKey: stat.label };
    group.add(statText);
  });
  yPos -= (2 * statRowHeight + 0.10);

  // Separator after stats
  const sep3 = createSeparator(1.8);
  sep3.position.set(0, yPos, 0.02);
  group.add(sep3);
  yPos -= 0.10;

  // Enemies Killed section - compact two-column layout
  const enemiesHeader = makeSprite('[ENEMIES KILLED]', {
    fontSize: scalePauseFont(22),
    color: '#888888',
    scale: scalePauseText(0.05),
    renderOrder: PAUSE_TEXT_RENDER_ORDER
  });
  enemiesHeader.position.set(0, yPos, 0.02);
  group.add(enemiesHeader);
  yPos -= 0.10;

  // Enemy kills by type - 2 columns
  const enemyKills = handData.enemyKills || {};
  const enemyEntries = Object.entries(enemyKills).filter(([_, count]) => count > 0);

  if (enemyEntries.length > 0) {
    const enemyRowHeight = 0.14;
    enemyEntries.forEach(([type, count], index) => {
      const icon = ENEMY_ICONS[type] || '💀';
      const x = index % 2 === 0 ? colLeft : colRight;
      const row = Math.floor(index / 2);
      const enemyText = makeSprite(`${icon} ${type.toUpperCase()} x${count}`, {
        fontSize: scalePauseFont(22),
        color: '#ff6666',
        scale: scalePauseText(0.05),
        renderOrder: PAUSE_TEXT_RENDER_ORDER
      });
      enemyText.position.set(x, yPos - (row * enemyRowHeight), 0.02);
      enemyText.userData = { isEnemyKillSprite: true };
      group.add(enemyText);
    });
  } else {
    const noEnemiesText = makeSprite('NO ENEMIES', {
      fontSize: scalePauseFont(22),
      color: '#666666',
      scale: scalePauseText(0.05),
      renderOrder: PAUSE_TEXT_RENDER_ORDER
    });
    noEnemiesText.position.set(0, yPos, 0.02);
    noEnemiesText.userData = { isEnemyKillSprite: true };
    group.add(noEnemiesText);
  }

  return group;
}

/**
 * Create stats section with charts
 */
function createStatsSection() {
  const group = new THREE.Group();

  // Background (higher opacity for readability)
  const bg = new THREE.Mesh(
    new THREE.PlaneGeometry(4.2, 2.2),
    createPauseMaterial(0x15002a, 0.85)
  );
  bg.renderOrder = PAUSE_SECTION_BG_RENDER_ORDER;
  group.add(bg);

  // Title
  const titleText = makeSprite('RUN STATISTICS', {
    fontSize: scalePauseFont(48),
    color: '#ff00ff',
    scale: scalePauseText(0.15),
    renderOrder: PAUSE_TEXT_RENDER_ORDER
  });
  titleText.position.set(0, 0.84, 0.02);
  group.add(titleText);

  // KILLS/SHOTS/HITS centered under the blaster sections
  const primaryStats = [
    `KILLS: ${game.runStats.totalKills || game.totalKills || 0}`,
    `SHOTS: ${game.runStats.shotsFired}`,
    `HITS: ${game.runStats.shotsHit}`,
  ];

  primaryStats.forEach((stat, index) => {
    const text = makeSprite(stat, {
      fontSize: scalePauseFont(36),
      color: '#00ffff',
      scale: scalePauseText(0.1),
      renderOrder: PAUSE_TEXT_RENDER_ORDER
    });
    text.position.set(0, 0.44 - (index * 0.24), 0.02);
    text.userData = { isPauseStatText: true };
    group.add(text);
  });

  // Everything else sits below KILLS/SHOTS/HITS
  const secondaryStats = [
    `ACCURACY: ${calculateAccuracy()}%`,
    `STREAK: ${game.runStats.longestKillStreak}`,
    `BOSS: ${game.runStats.bossesKilled}`,
  ];

  secondaryStats.forEach((stat, index) => {
    const text = makeSprite(stat, {
      fontSize: scalePauseFont(36),
      color: '#00ffff',
      scale: scalePauseText(0.1),
      renderOrder: PAUSE_TEXT_RENDER_ORDER
    });
    text.position.set(-1.08, -0.34 - (index * 0.22), 0.02);
    text.userData = { isPauseStatText: true };
    group.add(text);
  });

  // Canvas for charts (accuracy donut + damage bars)
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 128;
  const chartTexture = new THREE.CanvasTexture(canvas);
  const chartMat = new THREE.MeshBasicMaterial({
    map: chartTexture,
    transparent: true,
    depthTest: false,
    depthWrite: false,
    side: THREE.DoubleSide
  });
  const chartMesh = new THREE.Mesh(new THREE.PlaneGeometry(1.7, 0.9), chartMat);
  chartMesh.position.set(1.1, -0.82, 0.02);
  chartMesh.renderOrder = PAUSE_TEXT_RENDER_ORDER;
  group.add(chartMesh);

  pauseMenuElements.chartCanvas = { canvas, texture: chartTexture, mesh: chartMesh };

  return group;
}

/**
 * Update pause menu charts
 */
function updatePauseCharts() {
  if (!pauseMenuElements.chartCanvas) return;

  const { canvas, texture, mesh } = pauseMenuElements.chartCanvas;
  const ctx = canvas.getContext('2d');
  const anim = pauseMenuAnimation.chartAnimation;

  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // Draw accuracy donut chart
  const centerX = 80;
  const centerY = canvas.height / 2;
  const radius = 35;
  const accuracy = calculateAccuracy();
  const accuracyAngle = (accuracy / 100) * Math.PI * 2;

  // Outer ring (cyan)
  ctx.beginPath();
  ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
  ctx.strokeStyle = '#004444';
  ctx.lineWidth = 8;
  ctx.stroke();

  // Accuracy arc (animated)
  ctx.beginPath();
  ctx.arc(centerX, centerY, radius, -Math.PI / 2, -Math.PI / 2 + accuracyAngle * anim);
  ctx.strokeStyle = '#00ffff';
  ctx.lineWidth = 8;
  ctx.lineCap = 'round';
  ctx.stroke();

  // Accuracy percentage text
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 24px monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(`${Math.floor(accuracy * anim)}%`, centerX, centerY);

  // Draw damage per hand bar chart
  const barBaseX = 160;
  const barBaseY = canvas.height - 20;
  const barWidth = 20;
  const barSpacing = 25;

  ['left', 'right'].forEach((hand, i) => {
    const damage = game.handStats[hand].totalDamage || 0;
    const maxDamage = Math.max(game.handStats.left.totalDamage, game.handStats.right.totalDamage, 100);
    const barHeight = (damage / maxDamage) * 50 * anim;

    // Bar background
    ctx.fillStyle = '#333333';
    ctx.fillRect(barBaseX + (i * barSpacing), barBaseY - 50, barWidth, 50);

    // Bar (pink for left, cyan for right)
    ctx.fillStyle = hand === 'left' ? '#ff00ff' : '#00ffff';
    ctx.fillRect(barBaseX + (i * barSpacing), barBaseY - barHeight, barWidth, barHeight);

    // Label
    ctx.fillStyle = '#888888';
    ctx.font = `${scalePauseFont(10)}px monospace`;
    ctx.textAlign = 'center';
    ctx.fillText(hand.toUpperCase(), barBaseX + (i * barSpacing) + barWidth / 2, barBaseY + 10);
  });

  // Update texture
  texture.needsUpdate = true;
}

/**
 * Update stats numbers with counting animation
 */
function updatePauseStatsNumbers() {
  if (!pauseMenuElements.leftBlasterSection || !pauseMenuElements.rightBlasterSection) return;

  // Update left blaster section
  updateSectionStats(pauseMenuElements.leftBlasterSection, 'left');
  updateSectionStats(pauseMenuElements.rightBlasterSection, 'right');
  updateStatsSectionText();
  applyPauseMenuRenderPriority(pauseMenuGroup);
}

/**
 * Update stats section text
 */
function updateStatsSectionText() {
  if (!pauseMenuElements.statsSection) return;

  // Remove old stat text sprites, keep panel/title/chart mesh.
  const section = pauseMenuElements.statsSection;
  [...section.children].forEach((child) => {
    if (child.userData && child.userData.isPauseStatText) {
      section.remove(child);
    }
  });

  // Add updated centered KILLS/SHOTS/HITS block.
  const primaryStats = [
    `KILLS: ${game.runStats.totalKills || game.totalKills || 0}`,
    `SHOTS: ${game.runStats.shotsFired}`,
    `HITS: ${game.runStats.shotsHit}`,
  ];

  primaryStats.forEach((stat, index) => {
    const text = makeSprite(stat, {
      fontSize: scalePauseFont(36),
      color: '#00ffff',
      scale: scalePauseText(0.1),
      renderOrder: PAUSE_TEXT_RENDER_ORDER
    });
    text.position.set(0, 0.44 - (index * 0.24), 0.03);
    text.userData = { isPauseStatText: true };
    section.add(text);
  });

  // Add the rest of the stats below.
  const secondaryStats = [
    `ACCURACY: ${calculateAccuracy()}%`,
    `STREAK: ${game.runStats.longestKillStreak}`,
    `BOSS: ${game.runStats.bossesKilled}`,
  ];

  secondaryStats.forEach((stat, index) => {
    const text = makeSprite(stat, {
      fontSize: scalePauseFont(36),
      color: '#00ffff',
      scale: scalePauseText(0.1),
      renderOrder: PAUSE_TEXT_RENDER_ORDER
    });
    text.position.set(-1.08, -0.34 - (index * 0.22), 0.03);
    text.userData = { isPauseStatText: true };
    section.add(text);
  });
}

/**
 * Update section stats for blasters
 */
function updateSectionStats(section, hand) {
  // Remove old upgrade sprites
  [...section.children].forEach((child) => {
    if (child.userData && child.userData.isUpgradeSprite) {
      section.remove(child);
    }
  });

  // Update blaster section with current stats (exclude dream_fragment)
  const upgrades = game.upgrades[hand] || {};
  const upgradeEntries = Object.entries(upgrades).filter(([id]) => id !== 'dream_fragment');
  const yOffset = 0.08;

  if (upgradeEntries.length > 0) {
    upgradeEntries.forEach(([id, count], index) => {
      const iconData = UPGRADE_ICONS[id] || { icon: '•', color: '#ffffff' };
      const displayName = id.replace(/_/g, ' ').toUpperCase();
      const upgradeText = makeSprite(`${iconData.icon} ${displayName} x${count}`, {
        fontSize: scalePauseFont(36),
        color: iconData.color,
        scale: scalePauseText(0.1),
        renderOrder: PAUSE_TEXT_RENDER_ORDER
      });
      const yPos = yOffset - (index * 0.24);
      upgradeText.position.set(0, yPos, 0.03);
      upgradeText.userData = { isUpgradeSprite: true };
      section.add(upgradeText);
    });
  } else {
    const noUpgradesText = makeSprite('NO UPGRADES', {
      fontSize: scalePauseFont(36),
      color: '#888888',
      scale: scalePauseText(0.1),
      renderOrder: PAUSE_TEXT_RENDER_ORDER
    });
    noUpgradesText.position.set(0, 0.08, 0.03);
    noUpgradesText.userData = { isUpgradeSprite: true };
    section.add(noUpgradesText);
  }
}

/**
 * Create resume button
 */
function createResumeButton() {
  const group = new THREE.Group();

  // Match the title SCOREBOARD button style so pause/resume remains readable in VR.
  const btnGeo = new THREE.PlaneGeometry(1.55, 0.34);
  const btnMat = new THREE.MeshBasicMaterial({
    color: 0x110033,
    transparent: true,
    opacity: 0.85,
    side: THREE.DoubleSide,
    depthTest: false,
    depthWrite: false,
  });
  const btnMesh = new THREE.Mesh(btnGeo, btnMat);
  btnMesh.userData.isResumeButton = true;
  group.add(btnMesh);

  const btnBorder = new THREE.LineSegments(
    new THREE.EdgesGeometry(btnGeo),
    new THREE.LineBasicMaterial({
      color: 0xffff00,
      transparent: true,
      opacity: 1.0,
      depthTest: false,
      depthWrite: false,
    })
  );
  btnBorder.renderOrder = PAUSE_TEXT_RENDER_ORDER;
  group.add(btnBorder);

  const text = makeSprite('RESUME', {
    fontSize: scalePauseFont(42),
    color: '#ffff00',
    glow: true,
    glowColor: '#ffff00',
    scale: scalePauseText(0.14),
    renderOrder: PAUSE_TEXT_RENDER_ORDER
  });
  text.position.set(0, 0, 0.02);
  group.add(text);

  // Store button data for raycasting (hitbox is larger than text)
  group.userData = {
    isResumeButton: true,
    width: 2.0,
    height: 0.5
  };

  return group;
}

/**
 * Show pause countdown overlay (3, 2, 1)
 * Rebuilds every time to match the start-of-game ready screen style exactly.
 */
export function showPauseCountdown(seconds) {
  // Clear and rebuild every time (same pattern as showReadyScreen)
  disposeGroupChildren(pauseCountdownGroup);
  pauseCountdownInitialized = false;
  pauseCountdownHeader = null;
  pauseCountdownText = null;

  pauseCountdownGroup.visible = true;
  pauseCountdownGroup.position.set(0, 0, -2.5);

  // Match showReadyScreen exactly: "READY?" header in yellow
  const header = makeSprite('READY?', {
    fontSize: 70, color: '#ffff00', glow: true, scale: 0.6,
  });
  header.position.set(0, 0.8, 0);
  pauseCountdownHeader = header;
  pauseCountdownGroup.add(header);

  // Show only the countdown number so the pause flow always resolves through the RESUME button.
  const text = makeSprite(`${Math.ceil(seconds)}`, {
    fontSize: 120, color: '#ffffff', glow: true, glowColor: '#00ffff', scale: 0.7,
  });
  text.position.set(0, 0.1, 0.01);
  pauseCountdownText = text;
  pauseCountdownGroup.add(text);
  pauseCountdownInitialized = true;
}

/**
 * Hide pause countdown
 */
export function hidePauseCountdown() {
  pauseCountdownGroup.visible = false;
}

/**
 * Update pause countdown display
 */
export function updatePauseCountdownDisplay(seconds) {
  if (!pauseCountdownText) return;

  if (!seconds) {
    pauseCountdownText.visible = false;
    return;
  }

  pauseCountdownText.visible = true;
  const newSeconds = Math.ceil(seconds);
  updateSpriteText(pauseCountdownText, `${newSeconds}`, {
    fontSize: 120,
    color: '#ffffff',
    glow: true,
    glowColor: '#00ffff',
    scale: 0.7,
  });
}

/**
 * Handle raycast hits on pause menu (for desktop clicks)
 */
export function getPauseMenuHit(raycaster) {
  if (!pauseMenuGroup.visible) return null;

  const intersects = raycaster.intersectObjects(pauseMenuGroup.children, true);

  for (const intersect of intersects) {
    let obj = intersect.object;
    while (obj && !obj.userData.isResumeButton) {
      obj = obj.parent;
    }

    if (obj && obj.userData.isResumeButton) {
      return 'resume';
    }
  }

  return null;
}

/**
 * Calculate accuracy percentage
 */
function calculateAccuracy() {
  const fired = game.runStats.shotsFired;
  const hit = game.runStats.shotsHit;
  if (fired === 0) return 0;
  return Math.round((hit / fired) * 100);
}

// ── Cleanup functions (reset/level-complete hooks) ────────────────

export function clearAllDamageNumbers() {
  if (damageNumberPool) damageNumberPool.clearAll();
  if (comboPopupPool) comboPopupPool.clearAll();  // Ouch bubbles too
}

export function clearAllComboPopups() {
  if (comboPopupPool) comboPopupPool.clearAll();
}

export function clearAllKillChainPopups() {
  if (killChainPool) killChainPool.clearAll();
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
export { nameEntryGroup, pauseMenuGroup, pauseCountdownGroup };
