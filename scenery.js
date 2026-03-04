// ============================================================
//  SCENERY — Level-Based Theme System & Ambient Particles
// ============================================================

import * as THREE from 'three';

// ── Theme Definitions ─────────────────────────────────────
export const THEMES = {
  // Levels 1-5: Sunrise Highway (Easy)
  sunrise_highway: {
    skyColor: 0xff8866,
    fogColor: 0xffaa88,
    fogDensity: 0.008,
    gridColor: '#ffffff',
    gridOpacity: 0.9,
    mountainFill: 0x442266,
    mountainWire: 0x8866aa,
    mountainWireOpacity: 0.7,
    sunColors: ['#ffddaa', '#ffaa77', '#ff8855', '#ff6644', '#ff4422'],
    sunGlowColor: 0xffaa66,
    starColor: 0xffffff,
    particles: { type: 'dust', color: 0xffddaa, count: 20, speed: 0.2 },
  },

  // Vapor Sunset (Easy) - Classic vaporwave beach
  vapor_sunset: {
    skyColor: 0xff77aa,
    fogColor: 0xff99bb,
    fogDensity: 0.006,
    gridColor: '#00ffff',
    gridOpacity: 0.7,
    mountainFill: 0x220033,
    mountainWire: 0x660066,
    mountainWireOpacity: 0.5,
    sunColors: ['#ff88cc', '#ff66aa', '#ff4488', '#cc2266', '#aa0044'],
    sunGlowColor: 0xff66aa,
    starColor: 0xffffaa,
    particles: { type: 'sparkle', color: 0xffaaee, count: 30, speed: 0.15 },
  },

  // Levels 6-9: Ocean Floor (Easy-Medium)
  ocean_floor: {
    skyColor: 0x001133,
    fogColor: 0x002244,
    fogDensity: 0.012,
    gridColor: '#00ffaa',
    gridOpacity: 0.6,
    mountainFill: 0x001133,
    mountainWire: 0x00ffaa,
    mountainWireOpacity: 0.5,
    sunColors: ['#00aaff', '#0088cc', '#006699'],
    sunGlowColor: 0x00aaff,
    starColor: 0x88ddff,
    particles: { type: 'bubbles', color: 0x88ffdd, count: 30, speed: 0.4 },
  },

  // Levels 6-9: Classic Synthwave (backup)
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

  // Levels 10-14: Circuit Board (Medium-Hard) - Micro-scale PCB theme
  circuit_board: {
    skyColor: 0x003300,
    fogColor: 0x004400,
    fogDensity: 0.015,
    gridColor: '#ffcc00',
    gridOpacity: 0.8,
    mountainFill: 0x002200,
    mountainWire: 0xffcc00,
    mountainWireOpacity: 0.6,
    sunColors: ['#ff0000', '#cc0000', '#990000'],
    sunGlowColor: 0xff0000,
    starColor: 0xff6600,
    particles: { type: 'electrons', color: 0x00ffff, count: 40, speed: 2.0 },
  },

  // Levels 15-19: Frozen Digital
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

  // The Stack: Brutalist industrial megastructure
  the_stack: {
    skyColor: 0x333333,
    fogColor: 0x444444,
    fogDensity: 0.01,
    gridColor: '#ffaa00',
    gridOpacity: 0.7,
    mountainFill: 0x222222,
    mountainWire: 0x888888,
    mountainWireOpacity: 0.6,
    sunColors: ['#ffffff', '#dddddd', '#bbbbbb'],
    sunGlowColor: 0xcccccc,
    starColor: 0xffffff,
    particles: { type: 'debris', color: 0x888888, count: 35, speed: 0.25 },
  },

  // Digital Rain (Hard) - Matrix-style biome
  digital_rain: {
    skyColor: 0x000000,
    fogColor: 0x001100,
    fogDensity: 0.008,
    gridColor: '#00ff00',
    gridOpacity: 0.5,
    mountainFill: 0x000500,
    mountainWire: 0x00ff00,
    mountainWireOpacity: 0.4,
    sunColors: ['#00ff00', '#00cc00', '#009900'],
    sunGlowColor: 0x00ff00,
    starColor: 0x00ff00,
    particles: { type: 'code_rain', color: 0x00ff00, count: 50, speed: 3.0 },
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

  // Kaleidoscope: Infinite mirror maze (Very Hard)
  kaleidoscope: {
    skyColor: 0x000000,
    fogColor: 0x111111,
    fogDensity: 0.015,
    gridColor: '#ffffff',
    gridOpacity: 0.9,
    mountainFill: 0x000000,
    mountainWire: 0xffffff,
    mountainWireOpacity: 0.95,
    sunColors: ['#ff00ff', '#00ffff', '#ffff00'],
    sunGlowColor: 0xffffff,
    starColor: 0xffffff,
    particles: { type: 'prism', color: 0xffffff, count: 50, speed: 0.6 },
  },
};

// ── Get Theme for Level ───────────────────────────────────
export function getThemeForLevel(level) {
  if (level % 5 === 0) return THEMES.boss;
  if (level <= 5) return THEMES.sunrise_highway;
  if (level <= 9) return THEMES.synthwave;
  if (level <= 14) return THEMES.circuit_board;
  if (level <= 19) return THEMES.frozen;
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

  if (mountainRefs && mountainRefs.fillMesh) {
    // Update all mountain meshes (arrays)
    if (Array.isArray(mountainRefs.fillMesh)) {
      mountainRefs.fillMesh.forEach(mesh => {
        mesh.material.color.setHex(theme.mountainFill);
      });
    }
    if (Array.isArray(mountainRefs.wireframe)) {
      mountainRefs.wireframe.forEach(wire => {
        wire.material.color.setHex(theme.mountainWire);
        wire.material.opacity = theme.mountainWireOpacity;
      });
    }
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
    size: 0.05,  // Smaller particles to avoid confusion with enemies
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
  
  // Kaleidoscope: Color-shifting particles
  if (theme.particles.type === 'prism') {
    const now = performance.now();
    const hue = (now * 0.0001) % 1.0;
    const color = new THREE.Color().setHSL(hue, 1.0, 0.5);
    ambientParticles.material.color = color;
  } else {
    ambientParticles.material.color.setHex(theme.particles.color);
  }

  const positions = ambientGeo.attributes.position.array;
  const speed = theme.particles.speed;
  const now = performance.now();

  for (let i = 0; i < AMBIENT_POOL; i++) {
    const i3 = i * 3;

    switch (theme.particles.type) {
      case 'dust':
        // Floating dust particles in sunrise light
        positions[i3 + 1] += Math.sin(now * 0.0002 + i) * 0.005;
        positions[i3] += Math.cos(now * 0.0001 + i) * 0.01;
        positions[i3 + 2] += Math.sin(now * 0.00015 + i) * 0.008;
        break;

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

      case 'sparkle':
        // Twinkling sparkles for vapor sunset
        positions[i3 + 1] += Math.sin(now * 0.0003 + i) * 0.008;
        positions[i3] += Math.cos(now * 0.0002 + i) * 0.015;
        positions[i3 + 2] += Math.sin(now * 0.00025 + i) * 0.012;
        break;

      case 'corruption':
      case 'danger':
        // Swirling corruption/danger particles
        const a = now * 0.0003 + (i / AMBIENT_POOL) * Math.PI * 2;
        positions[i3] += Math.cos(a) * speed * dt * 0.5;
        positions[i3 + 2] += Math.sin(a) * speed * dt * 0.5;
        break;

      case 'electrons':
        // Fast-moving electrons along circuit traces
        const direction = i % 4; // 0: +x, 1: -x, 2: +z, 3: -z
        const electronSpeed = speed * dt;
        if (direction === 0) positions[i3] += electronSpeed;
        else if (direction === 1) positions[i3] -= electronSpeed;
        else if (direction === 2) positions[i3 + 2] += electronSpeed;
        else positions[i3 + 2] -= electronSpeed;
        break;

      case 'code_rain':
        // Matrix-style falling code rain
        positions[i3 + 1] -= speed * dt; // Fall downward
        positions[i3] += Math.sin(now * 0.0008 + i * 0.5) * 0.02; // Slight horizontal drift
        break;

      case 'debris':
        // Industrial dust/debris drifting through The Stack
        positions[i3] += Math.sin(now * 0.0001 + i * 0.5) * 0.015;
        positions[i3 + 1] += Math.cos(now * 0.0002 + i) * 0.008 - 0.01; // slow descent
        positions[i3 + 2] += Math.cos(now * 0.00015 + i * 0.3) * 0.012;
        break;

      case 'prism':
        // Kaleidoscope: Color-shifting reflection particles
        const prismAngle = now * 0.0004 + (i / AMBIENT_POOL) * Math.PI * 6;
        positions[i3] += Math.cos(prismAngle) * speed * dt;
        positions[i3 + 1] += Math.sin(now * 0.0005 + i) * 0.02;
        positions[i3 + 2] += Math.sin(prismAngle) * speed * dt;
        // Color shifts handled in material update
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
      positions[i3 + 1] = theme.particles.type === 'snow' ? 15 : 
                          (theme.particles.type === 'code_rain' ? 20 : 
                          (theme.particles.type === 'electrons' ? 1 : Math.random() * 2));
      positions[i3 + 2] = playerPos.z + (Math.random() - 0.5) * 40;
    }
  }

  ambientGeo.attributes.position.needsUpdate = true;
}
