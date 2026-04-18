// ============================================================
//  DAMAGE NUMBERS, COMBO POPUPS, KILL CHAIN POPUPS
//  TextPopupPool class and all floating damage/accuracy UI.
// ============================================================

import * as THREE from 'three';
import { novemberFontFamily } from './hud.js';

// ── TextPopupPool: Object pool for popup meshes ────────────────────
// Reuses pre-allocated PlaneGeometry + CanvasTexture + MeshBasicMaterial
// to prevent GEO climbing from constant create/destroy cycles.

export class TextPopupPool {
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
      // Pool exhausted: steal oldest active mesh (O(1) swap-with-last)
      if (this.active.length === 0) return null;
      const stolen = this.active[0];
      // Swap last element to position 0 instead of shift()
      this.active[0] = this.active[this.active.length - 1];
      this.active.pop();
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
    mesh.userData._positionKey = null; // Clear consolidation tracking
    mesh.userData._pulseDecay = 0;
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

// ── Popup pool instances (lazy-initialized) ─────────────────────────
let sceneRef = null;
let damageNumberPool = null;
let comboPopupPool = null;
let killChainPool = null;

// Callback for hit flash (set from hud.js to avoid circular deps)
let _triggerHitFlash = null;

// Damage number consolidation: track active numbers by position key
const activeDamageNumbers = new Map(); // positionKey -> { mesh, totalDamage, color, positionKey }

// Number texture cache: avoids redundant canvas fillText for repeated values
// Key: "value|color", Value: { canvas, texture }
const _numberTexCache = new Map();
const NUMBER_CACHE_MAX = 200;

function getNumberDrawFn(value, color) {
  const rounded = Math.round(value);
  const cacheKey = `${rounded}|${color}`;

  // Check cache first
  const cached = _numberTexCache.get(cacheKey);
  if (cached) {
    // Return a drawFn that just stamps the cached canvas
    return (canvas, ctx, w, h) => {
      ctx.drawImage(cached.canvas, 0, 0);
    };
  }

  // Render and cache
  const fontSize = Math.min(48, 28 + value / 6);
  const isHeal = color === '#00ff44';
  const text = isHeal ? `+${rounded}` : rounded.toString();

  // Pre-render to offscreen canvas
  const offscreen = document.createElement('canvas');
  offscreen.width = 128;
  offscreen.height = 64;
  const offCtx = offscreen.getContext('2d');
  offCtx.font = `bold ${fontSize}px ${novemberFontFamily}`;
  offCtx.textAlign = 'center';
  offCtx.textBaseline = 'middle';

  // Drop shadow (offset by 2px)
  offCtx.fillStyle = 'rgba(0,0,0,0.7)';
  offCtx.fillText(text, 66, 34);

  // Main text
  offCtx.fillStyle = color;
  offCtx.fillText(text, 64, 32);

  // Cache it
  if (_numberTexCache.size < NUMBER_CACHE_MAX) {
    _numberTexCache.set(cacheKey, { canvas: offscreen });
  }

  return (canvas, ctx, w, h) => {
    ctx.drawImage(offscreen, 0, 0);
  };
}

/**
 * Initialize damage number pools. Call once after scene is available.
 */
export function initDamageNumbers(scene, triggerHitFlashFn) {
  sceneRef = scene;
  _triggerHitFlash = triggerHitFlashFn;
}

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

export function disposePools() {
  if (damageNumberPool) { damageNumberPool.dispose(); damageNumberPool = null; }
  if (comboPopupPool) { comboPopupPool.dispose(); comboPopupPool = null; }
  if (killChainPool) { killChainPool.dispose(); killChainPool = null; }
  _numberTexCache.clear();
}

// ── Damage Numbers ─────────────────────────────────────────

function makePositionKey(position) {
  // Round position to nearest 0.5 to group hits on the same enemy
  const x = Math.round(position.x * 2) / 2;
  const y = Math.round(position.y * 2) / 2;
  const z = Math.round(position.z * 2) / 2;
  return `${x},${y},${z}`;
}

export function spawnDamageNumber(position, damage, color, scaleMultiplier = 1.0) {
  ensurePools();

  const posKey = makePositionKey(position);
  const existing = activeDamageNumbers.get(posKey);
  const now = performance.now();

  if (existing) {
    // Consolidate: add damage to existing number
    existing.totalDamage += damage;
    const totalDamage = existing.totalDamage;
    const existingColor = existing.color;
    const sm = existing.scaleMultiplier || 1.0;

    const scale = (0.25 + Math.min(totalDamage / 100, 0.15)) * 1.3 * sm;
    const width = scale * 2;
    const height = scale;
    const baseScaleX = width / 0.65;
    const baseScaleY = height / 0.325;

    // Reset lifetime to keep it visible while under fire (500ms wait as specified)
    existing.mesh.userData.createdAt = now;
    existing.mesh.userData.lifetime = 500;

    // Reset velocity to keep the number airborne longer when damage is added
    existing.mesh.userData.velocity.set(
      (Math.random() - 0.5) * 0.3,
      0.6 + Math.random() * 0.3,  // Fresh upward velocity
      (Math.random() - 0.5) * 0.3
    );

    // Pulse effect: set scale up, decay handled in updateDamageNumbers
    existing.mesh.scale.set(baseScaleX * 1.3, baseScaleY * 1.3, 1);
    existing.mesh.userData._pulseDecay = now + 50; // decay time for pulse
    existing.mesh.userData._baseScaleX = baseScaleX;
    existing.mesh.userData._baseScaleY = baseScaleY;

    // Slight upward bump
    existing.mesh.position.y += 0.05;

    // Throttle canvas redraws to max ~2.5/sec per number (400ms interval)
    if (!existing._lastRedraw || now - existing._lastRedraw >= 400) {
      existing._lastRedraw = now;
      existing.mesh.scale.set(baseScaleX, baseScaleY, 1);
      const drawFn = getNumberDrawFn(totalDamage, existingColor);
      damageNumberPool.updateText(existing.mesh, drawFn);
    }

    return;
  }

  // No existing number: create new one
  const dmgScale = (0.25 + Math.min(damage / 100, 0.15)) * 1.3 * scaleMultiplier;
  const dmgW = dmgScale * 2;
  const dmgH = dmgScale;

  const mesh = damageNumberPool.acquire(position, getNumberDrawFn(damage, color || '#ffffff'), {
    width: dmgW, height: dmgH, lifetime: 500,
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
      scaleMultiplier,
      positionKey: posKey,
      _lastRedraw: now,
    });
  }
}

function spawnOuchBubble(position, text = 'OUCH!') {
  ensurePools();

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
    if (text.length > 8) ctx.font = `bold 24px "Comic Sans MS", cursive, sans-serif`;
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
    ctx.font = 'bold 36px ' + novemberFontFamily;
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
    // Decay pulse effects on consolidated damage numbers (replaces setTimeout)
    for (const entry of activeDamageNumbers.values()) {
      const ud = entry.mesh.userData;
      if (ud._pulseDecay && now >= ud._pulseDecay && ud._baseScaleX) {
        ud._pulseDecay = 0;
        entry.mesh.scale.set(ud._baseScaleX, ud._baseScaleY, 1);
      }
    }

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
    ctx.font = `bold ${fontSize}px ${novemberFontFamily}`;
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
  if (_triggerHitFlash) _triggerHitFlash();
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
    ctx.font = `bold ${fontSize}px ${novemberFontFamily}`;
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
    ctx.font = 'bold 36px ' + novemberFontFamily;
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

export function clearAllDamageNumbers() {
  if (damageNumberPool) damageNumberPool.clearAll();
  activeDamageNumbers.clear();
}

export function clearAllComboPopups() {
  if (comboPopupPool) comboPopupPool.clearAll();
}

export function clearAllKillChainPopups() {
  if (killChainPool) killChainPool.clearAll();
}
