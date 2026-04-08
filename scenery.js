// ============================================================
//  SCENERY — Level-Based Theme System & Ambient Particles
// ============================================================

import * as THREE from 'three';
import { getBiomeForLevel } from './game.js';

// ── Theme Definitions ─────────────────────────────────────
export const THEMES = {
  // ── Custom biomes ───────────────────────────────────────
  synthwave_valley: {
    skyColor: 0x1a004a,
    gridColor: '#ff2ed1',
    gridOpacity: 0,
    gridScale: 1,
    mountainFill: 0x000000,
    mountainWire: 0x000000,
    mountainWireOpacity: 0,
    mountainScale: 0,
    floorColor: 0x05000d,
    sunColors: ['#ff66cc', '#ff66cc', '#ff66cc'],
    sunGlowColor: 0xff66cc,
    sunScale: 0,
    horizonColor: 0x000000,
    horizonInnerColor: 0x000000,
    starColor: 0xffccee,
    starSize: 0.55,
    starCount: 840,
    starHeight: 180,
    starSpread: 420,
    starBase: 220,
    particles: null,
    hideBaseEnv: true,
    keepStars: true,
    customScene: 'synthwave_valley',
    // Aurora borealis colors: synthwave gradient - horizon orange to pink to dark purple
    aurora: {
      colors: [
        'rgba(254,144,83,0)',        // Transparent at very bottom
        'rgba(254,144,83,0.4)',      // EXACT: Horizon orange #FE9053
        'rgba(224,1,134,0.35)',      // EXACT: Mountain tips pink #E00186
        'rgba(26,0,74,0.25)',        // EXACT: Dark purple #1A004A
        'rgba(26,0,74,0.1)',         // Fade to transparent
        'rgba(26,0,74,0)',
      ],
    },
  },

  desert_night: {
    skyColor: 0x06080c,
    gridColor: '#000000',
    gridOpacity: 0,
    gridScale: 1,
    mountainFill: 0x000000,
    mountainWire: 0x000000,
    mountainWireOpacity: 0,
    mountainScale: 0,
    floorColor: 0x06080c,
    sunColors: ['#ffffff'],
    sunGlowColor: 0xffffff,
    sunScale: 0,
    horizonColor: 0x000000,
    horizonInnerColor: 0x000000,
    starColor: 0xc0cdee,
    starSize: 0.45,
    starCount: 630,
    starHeight: 110,
    starSpread: 360,
    starBase: 15,
    particles: null,
    hideBaseEnv: true,
    keepStars: true,
    customScene: 'desert_night',
    // Aurora borealis colors: cyan/green machine aurora
    aurora: {
      colors: ['rgba(0,20,30,0)', 'rgba(0,255,180,0.15)', 'rgba(0,220,200,0.30)', 'rgba(80,255,220,0.25)', 'rgba(0,180,150,0.12)', 'rgba(0,40,50,0)'],
    },
  },

  alien_planet: {
    skyColor: 0x080812,
    gridColor: '#000000',
    gridOpacity: 0,
    gridScale: 1,
    mountainFill: 0x000000,
    mountainWire: 0x000000,
    mountainWireOpacity: 0,
    mountainScale: 0,
    floorColor: 0x080812,
    sunColors: ['#ffffff'],
    sunGlowColor: 0xffffff,
    sunScale: 0,
    horizonColor: 0x000000,
    horizonInnerColor: 0x000000,
    starColor: 0xffdd88,
    starSize: 0.45,
    starCount: 490,
    starHeight: 120,
    starSpread: 360,
    starBase: 20,
    particles: null,
    hideBaseEnv: true,
    keepStars: true,
    customScene: 'alien_planet',
    // Aurora borealis colors: green/teal - BRIGHTER
    aurora: {
      colors: ['rgba(0,40,30,0)', 'rgba(0,255,150,0.2)', 'rgba(0,200,180,0.35)', 'rgba(50,220,150,0.3)', 'rgba(0,150,120,0.15)', 'rgba(0,60,50,0)'],
    },
  },

  hellscape_lava: {
    skyColor: 0x000000,
    gridColor: '#000000',
    gridOpacity: 0,
    gridScale: 1,
    mountainFill: 0x000000,
    mountainWire: 0x000000,
    mountainWireOpacity: 0,
    mountainScale: 0,
    floorColor: 0x000000,
    sunColors: ['#ffffff'],
    sunGlowColor: 0xffffff,
    sunScale: 0,
    horizonColor: 0x000000,
    horizonInnerColor: 0x000000,
    starColor: 0xff8888,
    starSize: 0.4,
    starCount: 630,
    starHeight: 120,
    starSpread: 380,
    starBase: 15,
    particles: null,
    hideBaseEnv: true,
    keepStars: true,
    customScene: 'hellscape_lava',
    // Aurora borealis colors: red/orange - BRIGHTER
    aurora: {
      colors: ['rgba(40,0,0,0)', 'rgba(255,50,0,0.2)', 'rgba(255,100,0,0.35)', 'rgba(255,30,0,0.3)', 'rgba(180,20,0,0.15)', 'rgba(60,10,0,0)'],
    },
  },
};

// ── Get Theme for Level ───────────────────────────────────
export function getThemeForLevel(level) {
  const biomeId = getBiomeForLevel(level);
  if (biomeId && THEMES[biomeId]) {
    return THEMES[biomeId];
  }

  return THEMES.synthwave_valley;
}

// ── Ambient Particle System ───────────────────────────────
const AMBIENT_POOL = 60;
let ambientParticles = null;
let ambientGeo = null;

// Fix 1.7: Pre-allocated scratch Color for prism particles (avoid per-frame allocation)
const _prismColorScratch = new THREE.Color();

// Secondary particle system for layered effects
const SECONDARY_POOL = 30;
let secondaryParticles = null;
let secondaryGeo = null;

// Lookup table for particle updates - eliminates switch statement overhead
const PARTICLE_UPDATERS = {
  dust: (positions, i3, now, speed, dt, i) => {
    positions[i3 + 1] += Math.sin(now * 0.0002 + i) * 0.005;
    positions[i3] += Math.cos(now * 0.0001 + i) * 0.01;
    positions[i3 + 2] += Math.sin(now * 0.00015 + i) * 0.008;
  },
  
  embers: (positions, i3, now, speed, dt, i) => {
    positions[i3 + 1] += speed * dt;
    positions[i3] += Math.sin(now * 0.001 + i) * 0.01;
  },
  
  snow: (positions, i3, now, speed, dt, i) => {
    positions[i3 + 1] -= speed * dt;
    positions[i3] += Math.sin(now * 0.0005 + i) * 0.02;
  },
  
  sparkle: (positions, i3, now, speed, dt, i) => {
    positions[i3 + 1] += Math.sin(now * 0.0003 + i) * 0.008;
    positions[i3] += Math.cos(now * 0.0002 + i) * 0.015;
    positions[i3 + 2] += Math.sin(now * 0.00025 + i) * 0.012;
  },
  
  corruption: (positions, i3, now, speed, dt, i, poolSize) => {
    const a = now * 0.0003 + (i / poolSize) * Math.PI * 2;
    positions[i3] += Math.cos(a) * speed * dt * 0.5;
    positions[i3 + 2] += Math.sin(a) * speed * dt * 0.5;
  },
  
  danger: (positions, i3, now, speed, dt, i, poolSize) => {
    // Same as corruption
    const a = now * 0.0003 + (i / poolSize) * Math.PI * 2;
    positions[i3] += Math.cos(a) * speed * dt * 0.5;
    positions[i3 + 2] += Math.sin(a) * speed * dt * 0.5;
  },
  
  electrons: (positions, i3, now, speed, dt, i) => {
    const direction = i % 4;
    const electronSpeed = speed * dt;
    if (direction === 0) positions[i3] += electronSpeed;
    else if (direction === 1) positions[i3] -= electronSpeed;
    else if (direction === 2) positions[i3 + 2] += electronSpeed;
    else positions[i3 + 2] -= electronSpeed;
  },
  
  code_rain: (positions, i3, now, speed, dt, i) => {
    positions[i3 + 1] -= speed * dt;
    positions[i3] += Math.sin(now * 0.0008 + i * 0.5) * 0.02;
  },
  
  debris: (positions, i3, now, speed, dt, i) => {
    positions[i3] += Math.sin(now * 0.0001 + i * 0.5) * 0.015;
    positions[i3 + 1] += Math.cos(now * 0.0002 + i) * 0.008 - 0.01;
    positions[i3 + 2] += Math.cos(now * 0.00015 + i * 0.3) * 0.012;
  },
  
  prism: (positions, i3, now, speed, dt, i, poolSize) => {
    const prismAngle = now * 0.0004 + (i / poolSize) * Math.PI * 6;
    positions[i3] += Math.cos(prismAngle) * speed * dt;
    positions[i3 + 1] += Math.sin(now * 0.0005 + i) * 0.02;
    positions[i3 + 2] += Math.sin(prismAngle) * speed * dt;
  },
  
  crystal: (positions, i3, now, speed, dt, i, poolSize) => {
    const crystalAngle = now * 0.0002 + (i / poolSize) * Math.PI * 4;
    positions[i3] += Math.cos(crystalAngle) * speed * dt * 0.5;
    positions[i3 + 1] += Math.sin(now * 0.0003 + i) * 0.01;
    positions[i3 + 2] += Math.sin(crystalAngle) * speed * dt * 0.5;
  },
  
  pixels: (positions, i3, now, speed, dt, i) => {
    positions[i3] += Math.sin(now * 0.0003 + i * 0.7) * 0.02;
    positions[i3 + 1] += Math.cos(now * 0.0004 + i) * 0.015;
    positions[i3 + 2] += Math.cos(now * 0.00025 + i * 0.5) * 0.018;
  },
  
  pollen: (positions, i3, now, speed, dt, i) => {
    positions[i3] += Math.sin(now * 0.0002 + i * 0.6) * 0.018;
    positions[i3 + 1] += Math.cos(now * 0.0003 + i) * 0.012;
    positions[i3 + 2] += Math.sin(now * 0.00025 + i * 0.4) * 0.015;
  },
  
  bubbles: (positions, i3, now, speed, dt, i) => {
    positions[i3 + 1] += speed * dt * 0.8;
    positions[i3] += Math.sin(now * 0.002 + i * 1.5) * 0.025;
    positions[i3 + 2] += Math.cos(now * 0.0018 + i * 1.2) * 0.022;
  },
  
  current_flow: (positions, i3, now, speed, dt, i) => {
    positions[i3] += speed * dt * 0.6;
    positions[i3 + 1] += Math.sin(now * 0.0008 + i) * 0.01;
  },
  
  smoke: (positions, i3, now, speed, dt, i) => {
    positions[i3 + 1] += speed * dt;
    positions[i3] += Math.sin(now * 0.0003 + i * 0.8) * 0.03;
    positions[i3 + 2] += Math.cos(now * 0.00025 + i * 0.6) * 0.025;
  },
  
  power_surge: (positions, i3, now, speed, dt, i) => {
    const surgeDir = i % 2 === 0 ? 1 : -1;
    positions[i3] += surgeDir * speed * dt * 1.2;
    positions[i3 + 1] += Math.sin(now * 0.005 + i) * 0.005;
  },
  
  ice_crystal: (positions, i3, now, speed, dt, i, poolSize) => {
    const iceAngle = now * 0.0001 + (i / poolSize) * Math.PI * 2;
    positions[i3] += Math.cos(iceAngle) * speed * dt * 0.3;
    positions[i3 + 1] += Math.sin(now * 0.0002 + i) * 0.008;
    positions[i3 + 2] += Math.sin(iceAngle) * speed * dt * 0.3;
  },
  
  glitch_burst: (positions, i3, now, speed, dt, i, poolSize, playerPos) => {
    if (Math.random() < 0.001) {
      positions[i3] = playerPos.x + (Math.random() - 0.5) * 30;
      positions[i3 + 1] = Math.random() * 12 + 2;
      positions[i3 + 2] = playerPos.z + (Math.random() - 0.5) * 30;
    }
    positions[i3 + 1] -= speed * dt * 0.5;
  },
  
  steam: (positions, i3, now, speed, dt, i) => {
    positions[i3 + 1] += speed * dt * 0.7;
    positions[i3] += Math.sin(now * 0.0002 + i * 0.9) * 0.035;
    positions[i3 + 2] += Math.cos(now * 0.00018 + i * 0.7) * 0.03;
  },
  
  mirror_shard: (positions, i3, now, speed, dt, i, poolSize) => {
    const mirrorAngle = now * 0.0003 + (i / poolSize) * Math.PI * 8;
    positions[i3] += Math.cos(mirrorAngle) * speed * dt;
    positions[i3 + 2] += Math.sin(mirrorAngle) * speed * dt;
    positions[i3 + 1] += Math.sin(now * 0.0004 + i) * 0.015;
  },
  
  neon_sign: (positions, i3, now, speed, dt, i) => {
    positions[i3 + 1] += Math.sin(now * 0.00005 + i) * 0.002;
  },
  
  firefly: (positions, i3, now, speed, dt, i) => {
    positions[i3] += Math.sin(now * 0.0006 + i * 1.3) * 0.025;
    positions[i3 + 1] += Math.cos(now * 0.0007 + i * 1.1) * 0.02;
    positions[i3 + 2] += Math.sin(now * 0.0005 + i * 0.9) * 0.022;
  },
  
  nebula: (positions, i3, now, speed, dt, i, poolSize) => {
    const nebulaAngle = now * 0.00005 + (i / poolSize) * Math.PI * 2;
    positions[i3] += Math.cos(nebulaAngle) * speed * dt * 0.2;
    positions[i3 + 1] += Math.sin(now * 0.00008 + i) * 0.003;
    positions[i3 + 2] += Math.sin(nebulaAngle) * speed * dt * 0.2;
  },
  
  highway_dust: (positions, i3, now, speed, dt, i) => {
    positions[i3] += speed * dt * 0.5;
    positions[i3 + 1] += Math.sin(now * 0.0003 + i * 0.7) * 0.015;
    positions[i3 + 2] += Math.cos(now * 0.00025 + i * 0.5) * 0.012;
  },
  
  wave_ripple: (positions, i3, now, speed, dt, i, poolSize) => {
    const waveAngle = now * 0.0004 + (i / poolSize) * Math.PI * 3;
    positions[i3] += Math.cos(waveAngle) * speed * dt * 0.3;
    positions[i3 + 1] += Math.sin(now * 0.0003 + i) * 0.008;
    positions[i3 + 2] += Math.sin(waveAngle) * speed * dt * 0.3;
  }
};

// Default updater for unknown particle types
const DEFAULT_UPDATER = (positions, i3, now, speed, dt, i) => {
  positions[i3 + 1] += Math.sin(now * 0.0002 + i) * 0.01;
  positions[i3] += Math.cos(now * 0.0001 + i) * 0.015;
  positions[i3 + 2] += Math.sin(now * 0.00015 + i) * 0.012;
};

export function initAmbientParticles(scene) {
  // Primary particle system
  const positions = new Float32Array(AMBIENT_POOL * 3);

  for (let i = 0; i < AMBIENT_POOL; i++) {
    positions[i * 3] = (Math.random() - 0.5) * 40;
    positions[i * 3 + 1] = Math.random() * 15 + 1;
    positions[i * 3 + 2] = (Math.random() - 0.5) * 40;
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geo.setDrawRange(0, AMBIENT_POOL);

  const mat = new THREE.PointsMaterial({
    color: 0xffffff,
    size: 0.05,  // Smaller particles to avoid confusion with enemies
    transparent: true,
    opacity: 0.6,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });

  const points = new THREE.Points(geo, mat);
  points.name = 'ambient-particles-primary';
  scene.add(points);

  ambientParticles = points;
  ambientGeo = geo;

  // Secondary particle system
  const secondaryPositions = new Float32Array(SECONDARY_POOL * 3);
  for (let i = 0; i < SECONDARY_POOL; i++) {
    secondaryPositions[i * 3] = (Math.random() - 0.5) * 40;
    secondaryPositions[i * 3 + 1] = Math.random() * 15 + 1;
    secondaryPositions[i * 3 + 2] = (Math.random() - 0.5) * 40;
  }

  const secondaryGeoInstance = new THREE.BufferGeometry();
  secondaryGeoInstance.setAttribute('position', new THREE.BufferAttribute(secondaryPositions, 3));
  secondaryGeoInstance.setDrawRange(0, SECONDARY_POOL);

  const secondaryMat = new THREE.PointsMaterial({
    color: 0xffffff,
    size: 0.08,
    transparent: true,
    opacity: 0.5,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });

  const secondaryPoints = new THREE.Points(secondaryGeoInstance, secondaryMat);
  secondaryPoints.name = 'ambient-particles-secondary';
  scene.add(secondaryPoints);

  secondaryParticles = secondaryPoints;
  secondaryGeo = secondaryGeoInstance;

  console.log('[scenery] Initialized ambient particles (60 primary, 30 secondary)');
}

export function updateAmbientParticles(dt, theme, playerPos) {
  const smokeStrengthRaw = typeof window !== 'undefined' ? Number(window.debugSmokeStrength) : NaN;
  const smokeStrength = Number.isFinite(smokeStrengthRaw)
    ? Math.min(2, Math.max(0, smokeStrengthRaw))
    : 1.0;

  // Update primary particles
  if (!ambientParticles || !theme.particles || smokeStrength <= 0.001) {
    if (ambientParticles) ambientParticles.visible = false;
  } else {
    ambientParticles.visible = true;

    const baseCount = Math.min(theme.particles.count || AMBIENT_POOL, AMBIENT_POOL);
    const maxCount = Math.max(1, Math.min(AMBIENT_POOL, Math.round(baseCount * smokeStrength)));
    ambientGeo.setDrawRange(0, maxCount);

    const particleSize = theme.particles.size || 0.05;
    if (ambientParticles.material.size !== particleSize) {
      ambientParticles.material.size = particleSize;
    }

    const baseOpacity = theme.particles.opacity !== undefined ? theme.particles.opacity : 0.6;
    ambientParticles.material.opacity = Math.min(1, baseOpacity * Math.max(0.05, smokeStrength));

    // Kaleidoscope: Color-shifting particles
    // Fix 1.7: Use pre-allocated scratch Color instead of new THREE.Color() each frame
    if (theme.particles.type === 'prism') {
      const now = performance.now();
      const hue = (now * 0.0001) % 1.0;
      _prismColorScratch.setHSL(hue, 1.0, 0.5);
      ambientParticles.material.color = _prismColorScratch;
    } else {
      ambientParticles.material.color.setHex(theme.particles.color);
    }

    const positions = ambientGeo.attributes.position.array;
    const speed = theme.particles.speed;
    const now = performance.now();

    // Lookup and cache the particle updater function once
    const particleType = theme.particles.type;
    const updater = PARTICLE_UPDATERS[particleType] || DEFAULT_UPDATER;
    
    for (let i = 0; i < maxCount; i++) {
      const i3 = i * 3;

      // Update particle using lookup table (faster than switch statement)
      updater(positions, i3, now, speed, dt, i, AMBIENT_POOL, playerPos);

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
                            (theme.particles.type === 'electrons' ? 1 :
                            (theme.particles.type === 'crystal' ? Math.random() * 8 + 1 : Math.random() * 2)));
        positions[i3 + 2] = playerPos.z + (Math.random() - 0.5) * 40;
      }
    }

    ambientGeo.attributes.position.needsUpdate = true;
  }

  // Update secondary particles
  if (!secondaryParticles || !theme.secondaryParticles || smokeStrength <= 0.001) {
    if (secondaryParticles) secondaryParticles.visible = false;
  } else {
    secondaryParticles.visible = true;

    const baseCount = Math.min(theme.secondaryParticles.count || SECONDARY_POOL, SECONDARY_POOL);
    const maxCount = Math.max(1, Math.min(SECONDARY_POOL, Math.round(baseCount * smokeStrength)));
    secondaryGeo.setDrawRange(0, maxCount);

    const particleSize = theme.secondaryParticles.size || 0.08;
    if (secondaryParticles.material.size !== particleSize) {
      secondaryParticles.material.size = particleSize;
    }

    const baseOpacity = theme.secondaryParticles.opacity !== undefined ? theme.secondaryParticles.opacity : 0.5;
    secondaryParticles.material.opacity = Math.min(1, baseOpacity * Math.max(0.05, smokeStrength));
    secondaryParticles.material.color.setHex(theme.secondaryParticles.color);

    const positions = secondaryGeo.attributes.position.array;
    const speed = theme.secondaryParticles.speed;
    const now = performance.now();

    // Lookup and cache the particle updater function once
    const secondaryType = theme.secondaryParticles.type;
    const secondaryUpdater = PARTICLE_UPDATERS[secondaryType] || DEFAULT_UPDATER;

    for (let i = 0; i < maxCount; i++) {
      const i3 = i * 3;

      // Update particle using lookup table (faster than switch statement)
      secondaryUpdater(positions, i3, now, speed, dt, i, SECONDARY_POOL, playerPos);

      // Reset out-of-range secondary particles
      const dx = positions[i3] - playerPos.x;
      const dz = positions[i3 + 2] - playerPos.z;

      if (
        positions[i3 + 1] > 20 ||
        positions[i3 + 1] < -1 ||
        dx * dx + dz * dz > 900
      ) {
        positions[i3] = playerPos.x + (Math.random() - 0.5) * 40;
        positions[i3 + 1] = Math.random() * 8 + 2;
        positions[i3 + 2] = playerPos.z + (Math.random() - 0.5) * 40;
      }
    }

    secondaryGeo.attributes.position.needsUpdate = true;
  }
}

