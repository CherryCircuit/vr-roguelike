// ============================================================
//  UI KIT — shared, cached canvas textures for the 3D menus
//
//  Every menu is a three.js plane, so "modern AAA UI" here means texture
//  design, not CSS. These generators produce a premium dark-glass panel /
//  card look once per accent colour and cache the CanvasTexture; menus
//  reuse the same texture across opens (no per-open uploads).
//
//  No imports: pure THREE + canvas helpers, usable from hud.js,
//  pause-menu.js, settings-menu.js and training-ground.js without cycles.
// ============================================================

import * as THREE from 'three';

const _panelTextures = new Map();   // key: accent|variant
const _cardTextures = new Map();
let _barTexture = null;

function hexToRgb(hex) {
  const n = Number(hex) || 0;
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

function makeCanvas(w, h) {
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  return canvas;
}

function toTexture(canvas) {
  const tex = new THREE.CanvasTexture(canvas);
  tex.minFilter = THREE.LinearFilter;
  tex.magFilter = THREE.LinearFilter;
  tex.generateMipmaps = false;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/**
 * Large panel skin: deep-glass gradient, accent header rail, corner
 * brackets, vignette and a whisper of diagonal hatching.
 * @param {number} accentHex
 * @param {'panel'|'panelWarm'} [variant]
 */
export function getPanelTexture(accentHex = 0x00ffff, variant = 'panel') {
  const key = `${accentHex}|${variant}`;
  if (_panelTextures.has(key)) return _panelTextures.get(key);

  const W = 512;
  const H = 384;
  const canvas = makeCanvas(W, H);
  const ctx = canvas.getContext('2d');
  const { r, g, b } = hexToRgb(accentHex);
  const accent = `rgba(${r},${g},${b}`;

  // Base: vertical deep-navy gradient with a warm centre bias.
  const base = ctx.createLinearGradient(0, 0, 0, H);
  base.addColorStop(0, 'rgba(10,14,30,0.965)');
  base.addColorStop(0.55, 'rgba(7,10,22,0.96)');
  base.addColorStop(1, 'rgba(4,6,15,0.97)');
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, W, H);

  // Accent bloom behind the header area.
  const bloom = ctx.createRadialGradient(W * 0.5, 0, 0, W * 0.5, 0, H * 0.75);
  bloom.addColorStop(0, accent + ',0.16)');
  bloom.addColorStop(0.55, accent + ',0.04)');
  bloom.addColorStop(1, accent + ',0)');
  ctx.fillStyle = bloom;
  ctx.fillRect(0, 0, W, H);

  // Faint diagonal hatch (texture, not noise — cheap and reads as "material").
  ctx.save();
  ctx.globalAlpha = 0.035;
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 1;
  for (let x = -H; x < W + H; x += 14) {
    ctx.beginPath();
    ctx.moveTo(x, H);
    ctx.lineTo(x + H, 0);
    ctx.stroke();
  }
  ctx.restore();

  // Vignette to pull the eye to the content.
  const vig = ctx.createRadialGradient(W / 2, H / 2, H * 0.25, W / 2, H / 2, H * 0.95);
  vig.addColorStop(0, 'rgba(0,0,0,0)');
  vig.addColorStop(1, 'rgba(0,0,0,0.55)');
  ctx.fillStyle = vig;
  ctx.fillRect(0, 0, W, H);

  // Outer hairline border.
  ctx.strokeStyle = accent + ',0.5)';
  ctx.lineWidth = 2;
  ctx.strokeRect(4, 4, W - 8, H - 8);

  // Header rail: bright accent line under the title zone.
  const rail = ctx.createLinearGradient(0, 0, W, 0);
  rail.addColorStop(0, accent + ',0)');
  rail.addColorStop(0.22, accent + ',0.95)');
  rail.addColorStop(0.78, accent + ',0.95)');
  rail.addColorStop(1, accent + ',0)');
  ctx.fillStyle = rail;
  ctx.fillRect(W * 0.12, 62, W * 0.76, 2.5);

  // Corner brackets (AAA HUD motif).
  ctx.strokeStyle = accent + ',0.9)';
  ctx.lineWidth = 3;
  const m = 14;
  const len = 34;
  const corners = [
    [m, m, 1, 1],
    [W - m, m, -1, 1],
    [m, H - m, 1, -1],
    [W - m, H - m, -1, -1],
  ];
  for (let ci = 0; ci < corners.length; ci++) {
    const corner = corners[ci];
    const cornerX = corner[0];
    const cornerY = corner[1];
    const dirX = corner[2];
    const dirY = corner[3];
    ctx.beginPath();
    ctx.moveTo(cornerX + dirX * len, cornerY);
    ctx.lineTo(cornerX, cornerY);
    ctx.lineTo(cornerX, cornerY + dirY * len);
    ctx.stroke();
  }

  // Bottom-edge "data ticks" (subtle detail in empty corners).
  ctx.fillStyle = accent + ',0.32)';
  for (let i = 0; i < 6; i++) {
    ctx.fillRect(W - 40 - i * 10, H - 22, 6, 2);
  }

  const tex = toTexture(canvas);
  _panelTextures.set(key, tex);
  return tex;
}

/**
 * Upgrade-card skin sized for the 1.2 x 1.5 card plane (4:5).
 * Dark glass + accent frame with cut corners, header rail, bottom power cell.
 */
export function getCardTexture(accentHex = 0x00ffff) {
  const key = `${accentHex}`;
  if (_cardTextures.has(key)) return _cardTextures.get(key);

  const W = 384;
  const H = 480;
  const canvas = makeCanvas(W, H);
  const ctx = canvas.getContext('2d');
  const { r, g, b } = hexToRgb(accentHex);
  const accent = `rgba(${r},${g},${b}`;

  // Base gradient.
  const base = ctx.createLinearGradient(0, 0, 0, H);
  base.addColorStop(0, 'rgba(16,18,40,0.97)');
  base.addColorStop(0.5, 'rgba(10,10,26,0.955)');
  base.addColorStop(1, 'rgba(6,6,18,0.97)');
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, W, H);

  // Accent glow from the top edge + a low pool bottom-right.
  const topGlow = ctx.createLinearGradient(0, 0, 0, H * 0.5);
  topGlow.addColorStop(0, accent + ',0.20)');
  topGlow.addColorStop(1, accent + ',0)');
  ctx.fillStyle = topGlow;
  ctx.fillRect(0, 0, W, H * 0.5);

  const lowGlow = ctx.createRadialGradient(W * 0.78, H * 0.92, 0, W * 0.78, H * 0.92, W * 0.55);
  lowGlow.addColorStop(0, accent + ',0.16)');
  lowGlow.addColorStop(1, accent + ',0)');
  ctx.fillStyle = lowGlow;
  ctx.fillRect(0, H * 0.4, W, H * 0.6);

  // Micro-grid (the card reads as an interface surface, not a flat quad).
  ctx.save();
  ctx.globalAlpha = 0.05;
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 1;
  for (let y = 40; y < H - 40; y += 22) {
    ctx.beginPath();
    ctx.moveTo(24, y);
    ctx.lineTo(W - 24, y);
    ctx.stroke();
  }
  ctx.restore();

  // Cut-corner frame.
  const inset = 10;
  const cut = 22;
  ctx.beginPath();
  ctx.moveTo(inset + cut, inset);
  ctx.lineTo(W - inset - cut, inset);
  ctx.lineTo(W - inset, inset + cut);
  ctx.lineTo(W - inset, H - inset - cut);
  ctx.lineTo(W - inset - cut, H - inset);
  ctx.lineTo(inset + cut, H - inset);
  ctx.lineTo(inset, H - inset - cut);
  ctx.lineTo(inset, inset + cut);
  ctx.closePath();
  ctx.strokeStyle = accent + ',0.85)';
  ctx.lineWidth = 3;
  ctx.stroke();

  // Inner hairline for depth.
  ctx.strokeStyle = 'rgba(255,255,255,0.10)';
  ctx.lineWidth = 1;
  ctx.strokeRect(inset + 5, inset + 5, W - (inset + 5) * 2, H - (inset + 5) * 2);

  // Header rail (sits under the card name).
  ctx.fillStyle = accent + ',0.95)';
  ctx.fillRect(W * 0.18, 96, W * 0.64, 3);
  ctx.fillStyle = accent + ',0.28)';
  ctx.fillRect(W * 0.28, 104, W * 0.44, 1.5);

  // Corner ticks.
  ctx.fillStyle = accent + ',0.9)';
  ctx.fillRect(inset + 8, inset + 8, 16, 3);
  ctx.fillRect(inset + 8, inset + 8, 3, 16);
  ctx.fillRect(W - inset - 24, H - inset - 11, 16, 3);
  ctx.fillRect(W - inset - 11, H - inset - 24, 3, 16);

  // Bottom "power cell" segments.
  for (let i = 0; i < 5; i++) {
    ctx.fillStyle = i < 3 ? accent + ',0.8)' : accent + ',0.22)';
    ctx.fillRect(W * 0.30 + i * 24, H - 56, 16, 4);
  }

  const tex = toTexture(canvas);
  _cardTextures.set(key, tex);
  return tex;
}

/**
 * Small horizontal meter skin (accuracy bonus bar): rounded ends, bright top
 * highlight, transparent edge falloff. Tinted by the mesh material colour.
 */
export function getBarTexture() {
  if (_barTexture) return _barTexture;
  const W = 256;
  const H = 32;
  const canvas = makeCanvas(W, H);
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, W, H);
  // Rounded capsule mask.
  const r = H / 2;
  ctx.beginPath();
  ctx.moveTo(r, 0);
  ctx.lineTo(W - r, 0);
  ctx.arc(W - r, r, r, -Math.PI / 2, Math.PI / 2);
  ctx.lineTo(r, H);
  ctx.arc(r, r, r, Math.PI / 2, -Math.PI / 2);
  ctx.closePath();
  const grad = ctx.createLinearGradient(0, 0, 0, H);
  grad.addColorStop(0, 'rgba(255,255,255,0.55)');
  grad.addColorStop(0.35, 'rgba(255,255,255,1)');
  grad.addColorStop(0.75, 'rgba(255,255,255,0.92)');
  grad.addColorStop(1, 'rgba(255,255,255,0.45)');
  ctx.fillStyle = grad;
  ctx.fill();
  // Soft inner bevel.
  ctx.strokeStyle = 'rgba(255,255,255,0.9)';
  ctx.lineWidth = 2;
  ctx.stroke();
  _barTexture = toTexture(canvas);
  return _barTexture;
}

/**
 * Apply the panel skin to an existing MeshBasicMaterial plane in place.
 * Returns the material for chaining.
 */
export function applyPanelSkin(mesh, accentHex = 0x00ffff, opts = {}) {
  if (!mesh || !mesh.material) return null;
  const material = mesh.material;
  material.map = getPanelTexture(accentHex, opts.variant || 'panel');
  material.color.setHex(opts.color != null ? opts.color : 0xffffff);
  material.needsUpdate = true;
  if (material.opacity === undefined) material.opacity = 1;
  if (opts.opacity !== undefined) material.opacity = opts.opacity;
  material.transparent = true;
  // UI planes must never be tone-mapped or fogged.
  material.toneMapped = false;
  material.fog = false;
  return material;
}

/** Dispose every cached UI texture (full page teardown/tests). */
export function disposeUiKitTextures() {
  for (const tex of _panelTextures.values()) tex.dispose();
  for (const tex of _cardTextures.values()) tex.dispose();
  if (_barTexture) { _barTexture.dispose(); _barTexture = null; }
  _panelTextures.clear();
  _cardTextures.clear();
}
