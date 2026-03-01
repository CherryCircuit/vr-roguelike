// ============================================================
//  SCENERY — Level-Based Theme System & Ambient Particles
// ============================================================

import * as THREE from 'three';

// ── Theme Definitions ─────────────────────────────────────
export const THEMES = {
  // Levels 1-4: Classic Synthwave (default)
  synthwave: {
    skyColor: 0x000000,
    fogColor: 0x000000,
    fogDensity: 0.012,
    gridColor: '#ff00ff',
    gridOpacity: 0.85,
    mountainFill: 0x0a0020,
    mountainWire: 0x00ffff,
    mountainWireOpacity: 0.6,
    sunColors: ['#ffff88', '#ffdd33', '#ffaa00', '#ff6600', '#ff3300'],
    sunGlowColor: 0xff6600,
    starColor: 0xffffff,
    particles: null,
  },

  // Levels 6-9: Neon Hellscape
  hellscape: {
    skyColor: 0x0a0000,
    fogColor: 0x1a0000,
    fogDensity: 0.015,
    gridColor: '#ff4400',
    gridOpacity: 0.9,
    mountainFill: 0x1a0000,
    mountainWire: 0xff4400,
    mountainWireOpacity: 0.8,
    sunColors: ['#ff0000', '#ff4400', '#ff0000', '#880000', '#440000'],
    sunGlowColor: 0xff2200,
    starColor: 0xff4444,
    particles: { type: 'embers', color: 0xff4400, count: 30, speed: 0.5 },
  },

  // Levels 11-14: Frozen Digital
  frozen: {
    skyColor: 0x000a15,
    fogColor: 0x001122,
    fogDensity: 0.01,
    gridColor: '#0088ff',
    gridOpacity: 0.7,
    mountainFill: 0x001133,
    mountainWire: 0x44aaff,
    mountainWireOpacity: 0.7,
    sunColors: ['#aaddff', '#88bbff', '#4488ff', '#2255aa', '#112244'],
    sunGlowColor: 0x4488ff,
    starColor: 0x88ccff,
    particles: { type: 'snow', color: 0xccddff, count: 50, speed: 0.3 },
  },

  // Levels 16-19: Void Corruption
  corruption: {
    skyColor: 0x050005,
    fogColor: 0x0a000a,
    fogDensity: 0.018,
    gridColor: '#aa00ff',
    gridOpacity: 0.6,
    mountainFill: 0x0a000a,
    mountainWire: 0xaa00ff,
    mountainWireOpacity: 0.9,
    sunColors: ['#ff00ff', '#aa00ff', '#6600cc', '#330066', '#110033'],
    sunGlowColor: 0xaa00ff,
    starColor: 0xcc88ff,
    particles: { type: 'corruption', color: 0xaa00ff, count: 40, speed: 0.8 },
  },

  // Boss levels (5, 10, 15, 20): Red Alert
  boss: {
    skyColor: 0x0a0000,
    fogColor: 0x1a0000,
    fogDensity: 0.02,
    gridColor: '#ff0000',
    gridOpacity: 1.0,
    mountainFill: 0x1a0000,
    mountainWire: 0xff0000,
    mountainWireOpacity: 1.0,
    sunColors: ['#ff0000', '#ff0000', '#aa0000', '#660000', '#330000'],
    sunGlowColor: 0xff0000,
    starColor: 0xff2222,
    particles: { type: 'danger', color: 0xff0000, count: 60, speed: 1.0 },
  },
};

// ── Get Theme for Level ───────────────────────────────────
export function getThemeForLevel(level) {
  if (level % 5 === 0) return THEMES.boss;
  if (level <= 4) return THEMES.synthwave;
  if (level <= 9) return THEMES.hellscape;
  if (level <= 14) return THEMES.frozen;
  return THEMES.corruption;
}

// ── Apply Theme ───────────────────────────────────────────
export function applyTheme(theme, refs) {
  const { scene, gridData, mountainRefs, sunMesh, sunGlow } = refs;

  if (scene) {
    scene.background.setHex(theme.skyColor);
    scene.fog.color.setHex(theme.fogColor);
    scene.fog.density = theme.fogDensity;
  }

  if (gridData) {
    // Manually update the grid texture (can't use require() in ES6 modules)
    const canvas = gridData.texture.image;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, 256, 256);
    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, 256, 256);
    ctx.strokeStyle = theme.gridColor;
    ctx.lineWidth = 2;
    const cellSize = 256 / 16;
    for (let i = 0; i <= 16; i++) {
      const pos = i * cellSize;
      ctx.beginPath();
      ctx.moveTo(pos, 0);
      ctx.lineTo(pos, 256);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(0, pos);
      ctx.lineTo(256, pos);
      ctx.stroke();
    }
    gridData.texture.needsUpdate = true;
    gridData.material.opacity = theme.gridOpacity;
  }

  if (mountainRefs) {
    mountainRefs.fillMat.color.setHex(theme.mountainFill);
    mountainRefs.wireMat.color.setHex(theme.mountainWire);
    mountainRefs.wireMat.opacity = theme.mountainWireOpacity;
  }

  if (sunMesh) {
    // Regenerate sun texture with new colors
    const canvas = sunMesh.material.map.image;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, 512, 512);
    const grad = ctx.createLinearGradient(256, 30, 256, 482);
    theme.sunColors.forEach((c, i) => grad.addColorStop(i / (theme.sunColors.length - 1), c));
    ctx.beginPath();
    ctx.arc(256, 256, 248, 0, Math.PI * 2);
    ctx.fillStyle = grad;
    ctx.fill();
    ctx.shadowColor = theme.sunColors[0];
    ctx.shadowBlur = 20;
    ctx.beginPath();
    ctx.arc(256, 256, 248, 0, Math.PI * 2);
    ctx.fillStyle = grad;
    ctx.fill();
    ctx.shadowBlur = 0;
    // Cut bands
    ctx.globalCompositeOperation = 'destination-out';
    const bandDefs = [
      { y: 0.90, h: 0.065 },
      { y: 0.82, h: 0.050 },
      { y: 0.75, h: 0.038 },
      { y: 0.69, h: 0.028 },
      { y: 0.64, h: 0.020 },
      { y: 0.60, h: 0.013 },
      { y: 0.57, h: 0.008 },
      { y: 0.54, h: 0.004 },
    ];
    for (const b of bandDefs) {
      const cy = b.y * 512;
      const ch = b.h * 512;
      ctx.fillStyle = 'black';
      ctx.fillRect(0, cy - ch / 2, 512, ch);
    }
    ctx.globalCompositeOperation = 'source-over';
    sunMesh.material.map.needsUpdate = true;
  }

  if (sunGlow) {
    sunGlow.material.color.setHex(theme.sunGlowColor);
  }

  console.log(`[scenery] Applied theme: ${Object.keys(THEMES).find(k => THEMES[k] === theme)}`);
}

// ── Ambient Particle System ───────────────────────────────
const AMBIENT_POOL = 60;
let ambientParticles = null;
let ambientGeo = null;

export function initAmbientParticles(scene) {
  const positions = new Float32Array(AMBIENT_POOL * 3);

  for (let i = 0; i < AMBIENT_POOL; i++) {
    positions[i * 3] = (Math.random() - 0.5) * 40;
    positions[i * 3 + 1] = Math.random() * 15 + 1;
    positions[i * 3 + 2] = (Math.random() - 0.5) * 40;
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));

  const mat = new THREE.PointsMaterial({
    color: 0xffffff,
    size: 0.15,
    transparent: true,
    opacity: 0.6,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });

  const points = new THREE.Points(geo, mat);
  scene.add(points);

  ambientParticles = points;
  ambientGeo = geo;

  console.log('[scenery] Initialized ambient particles (60)');
}

export function updateAmbientParticles(dt, theme, playerPos) {
  if (!ambientParticles || !theme.particles) {
    if (ambientParticles) ambientParticles.visible = false;
    return;
  }

  ambientParticles.visible = true;
  ambientParticles.material.color.setHex(theme.particles.color);

  const positions = ambientGeo.attributes.position.array;
  const speed = theme.particles.speed;
  const now = performance.now();

  for (let i = 0; i < AMBIENT_POOL; i++) {
    const i3 = i * 3;

    switch (theme.particles.type) {
      case 'embers':
        // Rising embers
        positions[i3 + 1] += speed * dt;
        positions[i3] += Math.sin(now * 0.001 + i) * 0.01;
        break;

      case 'snow':
        // Falling snow
        positions[i3 + 1] -= speed * dt;
        positions[i3] += Math.sin(now * 0.0005 + i) * 0.02;
        break;

      case 'corruption':
      case 'danger':
        // Swirling corruption/danger particles
        const a = now * 0.0003 + (i / AMBIENT_POOL) * Math.PI * 2;
        positions[i3] += Math.cos(a) * speed * dt * 0.5;
        positions[i3 + 2] += Math.sin(a) * speed * dt * 0.5;
        break;
    }

    // Reset out-of-range particles
    const dx = positions[i3] - playerPos.x;
    const dz = positions[i3 + 2] - playerPos.z;

    if (
      positions[i3 + 1] > 20 ||
      positions[i3 + 1] < -1 ||
      dx * dx + dz * dz > 900
    ) {
      positions[i3] = playerPos.x + (Math.random() - 0.5) * 40;
      positions[i3 + 1] = theme.particles.type === 'snow' ? 15 : Math.random() * 2;
      positions[i3 + 2] = playerPos.z + (Math.random() - 0.5) * 40;
    }
  }

  ambientGeo.attributes.position.needsUpdate = true;
}
