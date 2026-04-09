// bake-clouds.js — Bake procedural cloud noise to a canvas texture once at init.
// Replaces expensive per-frame 3D FBM shader with a static texture.
// Quest-friendly: zero per-frame GPU cost.

import * as THREE from 'three';

export function bakeCloudsToCanvas(opts) {
  const {
    width = 1024,
    height = 512,
    horizonColor = [1.0, 0.53, 0.15],
    cloudColor = [1.0, 0.93, 0.87],
    skyColor = [0.1, 0.0, 0.29],
    sunDir = [0, 0.3, -1],
    seed = 42,
  } = opts;

  // Normalize sun direction
  const sLen = Math.sqrt(sunDir[0]*sunDir[0] + sunDir[1]*sunDir[1] + sunDir[2]*sunDir[2]);
  const sun = [sunDir[0]/sLen, sunDir[1]/sLen, sunDir[2]/sLen];

  // Simple 2D value noise (matches the visual character of the GPU shader)
  function hash(x, y) {
    const n = Math.sin(x * 127.1 + y * 311.7 + seed) * 43758.5453;
    return n - Math.floor(n);
  }

  function noise2D(x, y) {
    const ix = Math.floor(x);
    const iy = Math.floor(y);
    const fx = x - ix;
    const fy = y - iy;
    const ux = fx * fx * (3 - 2 * fx);
    const uy = fy * fy * (3 - 2 * fy);
    const a = hash(ix, iy);
    const b = hash(ix + 1, iy);
    const c = hash(ix, iy + 1);
    const d = hash(ix + 1, iy + 1);
    return a + (b - a) * ux + (c - a) * uy + (a - b - c + d) * ux * uy;
  }

  function fbm(x, y, octaves) {
    let v = 0, amp = 0.5;
    for (let i = 0; i < octaves; i++) {
      v += amp * noise2D(x, y);
      x *= 2.0;
      y *= 2.0;
      amp *= 0.5;
    }
    return v;
  }

  // Gamma correction helper
  function gamma(c) { return Math.pow(Math.max(0, Math.min(1, c)), 1/2.2); }

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  const img = ctx.createImageData(width, height);

  for (let py = 0; py < height; py++) {
    // normalizedHeight: 0 at bottom, 1 at top
    const normalizedHeight = py / (height - 1);

    // Sky band mask (mid-sky only)
    const skyBandLow = smoothstep(0.15, 0.45, normalizedHeight);
    const skyBandHigh = smoothstep(0.92, 0.55, normalizedHeight);
    const skyBand = skyBandLow * skyBandHigh;

    // Edge fades
    const bottomFade = smoothstep(0.0, 0.15, normalizedHeight);
    const topFade = smoothstep(1.0, 0.85, normalizedHeight);

    // Base color gradient (horizon -> cloud -> sky)
    let r = mix(horizonColor[0], cloudColor[0], smoothstep(0.0, 0.5, normalizedHeight));
    let g = mix(horizonColor[1], cloudColor[1], smoothstep(0.0, 0.5, normalizedHeight));
    let b = mix(horizonColor[2], cloudColor[2], smoothstep(0.0, 0.5, normalizedHeight));
    r = mix(r, skyColor[0], smoothstep(0.5, 0.9, normalizedHeight));
    g = mix(g, skyColor[1], smoothstep(0.5, 0.9, normalizedHeight));
    b = mix(b, skyColor[2], smoothstep(0.5, 0.9, normalizedHeight));

    for (let px = 0; px < width; px++) {
      // Spherical UV -> 3D direction for noise
      const u = px / width;
      const theta = u * Math.PI * 2;
      const phi = normalizedHeight * Math.PI;
      const nx = Math.sin(phi) * Math.cos(theta);
      const ny = Math.cos(phi);
      const nz = Math.sin(phi) * Math.sin(theta);

      // Sun facing (approximate - use x position as proxy for azimuth)
      const sunFacing = Math.max(0, nx * sun[0] + ny * sun[1] + nz * sun[2]);
      const sunTint = 1.0 + sunFacing * 0.15;

      // Two layers of FBM noise
      const cx = nx * 2.0;
      const cy = ny * 2.0;
      const cz = nz * 2.0;
      const n1 = fbm(cx + 0.3, cy + cz, 3);
      const n2 = fbm(cx * 2.5 + 10.0, cy * 2.5 + 5.0, 3);
      let density = n1 * 0.6 + n2 * 0.4;

      // Soft cloud shapes
      let cloudMask = smoothstep(0.42, 0.72, density);
      cloudMask *= skyBand * bottomFade * topFade;

      // Apply sun tint
      let cr = r * sunTint;
      let cg = g * sunTint;
      let cb = b * sunTint;

      // Gamma correct
      cr = gamma(cr);
      cg = gamma(cg);
      cb = gamma(cb);

      const alpha = cloudMask * 0.85;

      const idx = (py * width + px) * 4;
      img.data[idx]     = Math.round(cr * 255);
      img.data[idx + 1] = Math.round(cg * 255);
      img.data[idx + 2] = Math.round(cb * 255);
      img.data[idx + 3] = Math.round(alpha * 255);
    }
  }

  ctx.putImageData(img, 0, 0);

  // Create THREE.CanvasTexture
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.ClampToEdgeWrapping;
  return tex;
}

function smoothstep(edge0, edge1, x) {
  const t = Math.max(0, Math.min(1, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

function mix(a, b, t) { return a + (b - a) * t; }
