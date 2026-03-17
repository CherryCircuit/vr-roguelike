// ============================================================
//  SCENERY — Level-Based Theme System & Ambient Particles
// ============================================================

import * as THREE from 'three';
import { getBiomeForLevel } from './game.js';

// ── Theme Definitions ─────────────────────────────────────
export const THEMES = {
  // Levels 1-5: Sunrise Highway (Easy)
  sunrise_highway: {
    skyColor: 0xff8866,
    fogColor: 0xffaa88,
    fogDensity: 0.008,
    gridColor: '#ffffff',
    gridOpacity: 0.9,
    gridScale: 1.0,
    mountainFill: 0x442266,
    mountainWire: 0x8866aa,
    mountainWireOpacity: 0.7,
    mountainScale: 0.9,
    floorColor: 0x331144,
    sunColors: ['#ffddaa', '#ffaa77', '#ff8855', '#ff6644', '#ff4422'],
    sunGlowColor: 0xffaa66,
    sunScale: 1.05,
    horizonColor: 0xffccaa,
    horizonInnerColor: 0xffaa88,
    starColor: 0xffffff,
    starSize: 0.55,
    particles: { type: 'dust', color: 0xffddaa, count: 20, speed: 0.2 },
    // Enhanced: Highway dust clouds and car lights
    secondaryParticles: { type: 'highway_dust', color: 0xffccaa, count: 15, speed: 0.8, size: 0.25 },
    ambientMotion: { type: 'drift', intensity: 0.05, speed: 0.3 },
    lightIntensity: 1.1, // Bright morning
  },

  // Vapor Sunset (Easy) - Classic vaporwave beach
  vapor_sunset: {
    skyColor: 0xff77aa,
    fogColor: 0xff99bb,
    fogDensity: 0.006,
    gridColor: '#00ffff',
    gridOpacity: 0.7,
    gridScale: 0.9,
    mountainFill: 0x220033,
    mountainWire: 0x660066,
    mountainWireOpacity: 0.5,
    mountainScale: 0.8,
    floorColor: 0x220022,
    sunColors: ['#ff88cc', '#ff66aa', '#ff4488', '#cc2266', '#aa0044'],
    sunGlowColor: 0xff66aa,
    sunScale: 1.15,
    horizonColor: 0xff99dd,
    horizonInnerColor: 0xff66aa,
    starColor: 0xffffaa,
    starSize: 0.6,
    particles: { type: 'sparkle', color: 0xffaaee, count: 30, speed: 0.15 },
    // Enhanced: Wave particles and gentle beach atmosphere
    secondaryParticles: { type: 'wave_ripple', color: 0x00ffff, count: 20, speed: 0.1, size: 0.35 },
    ambientMotion: { type: 'wave', intensity: 0.12, speed: 0.6 },
    lightIntensity: 1.0,
  },

  // Levels 6-9: Ocean Floor (Easy-Medium)
  ocean_floor: {
    skyColor: 0x001133,
    fogColor: 0x002244,
    fogDensity: 0.012,
    gridColor: '#00ffaa',
    gridOpacity: 0.6,
    gridScale: 0.8,
    mountainFill: 0x001133,
    mountainWire: 0x00ffaa,
    mountainWireOpacity: 0.5,
    mountainScale: 0.6,
    floorColor: 0x001b2d,
    sunColors: ['#00aaff', '#0088cc', '#006699'],
    sunGlowColor: 0x00aaff,
    sunScale: 0.85,
    horizonColor: 0x00ccaa,
    horizonInnerColor: 0x009988,
    starColor: 0x88ddff,
    starSize: 0.35,
    particles: { type: 'bubbles', color: 0x88ffdd, count: 30, speed: 0.4 },
    // Enhanced: Caustic light patterns and currents
    secondaryParticles: { type: 'current_flow', color: 0x00ddff, count: 20, speed: 0.6, size: 0.08 },
    ambientMotion: { type: 'sway', intensity: 0.15, speed: 0.8 },
    lightIntensity: 0.7, // Dimmer underwater
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
    // Aurora for dark synthwave nights
    aurora: {
      colors: ['rgba(0,0,40,0)', 'rgba(0,255,255,0.2)', 'rgba(255,0,255,0.35)', 'rgba(0,200,255,0.3)', 'rgba(100,0,150,0.15)', 'rgba(0,0,60,0)'],
    },
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
    particles: { type: 'embers', color: 0xff4400, count: 30, speed: 0.5, size: 0.12 },
    // Enhanced: Secondary smoke particles
    secondaryParticles: { type: 'smoke', color: 0x331111, count: 15, speed: 0.15, size: 0.3 },
    // Enhanced: Pulsing danger lights
    ambientMotion: { type: 'pulse', intensity: 0.3, speed: 2.0 },
  },

  // Levels 10-14: Circuit Board (Medium-Hard) - Micro-scale PCB theme
  circuit_board: {
    skyColor: 0x003300,
    fogColor: 0x004400,
    fogDensity: 0.015,
    gridColor: '#ffcc00',
    gridOpacity: 0.8,
    gridScale: 1.3,
    mountainFill: 0x002200,
    mountainWire: 0xffcc00,
    mountainWireOpacity: 0.6,
    mountainScale: 0.7,
    floorColor: 0x002b00,
    sunColors: ['#ff0000', '#cc0000', '#990000'],
    sunGlowColor: 0xff0000,
    sunScale: 0.9,
    horizonColor: 0xffcc00,
    horizonInnerColor: 0xffaa00,
    starColor: 0xff6600,
    starSize: 0.45,
    particles: { type: 'electrons', color: 0x00ffff, count: 40, speed: 2.0 },
    // Enhanced: Power surges and LED pulses
    secondaryParticles: { type: 'power_surge', color: 0xffcc00, count: 25, speed: 1.5, size: 0.15 },
    ambientMotion: { type: 'pulse', intensity: 0.4, speed: 3.0 },
    lightFlicker: { intensity: 0.15, speed: 5.0 },
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
    // Enhanced: Ice crystals and frost
    secondaryParticles: { type: 'ice_crystal', color: 0xaaddff, count: 20, speed: 0.1, size: 0.18 },
    ambientMotion: { type: 'drift', intensity: 0.1, speed: 0.5 },
    lightIntensity: 1.2, // Brighter ice
    // Aurora for frozen nights - cyan/blue
    aurora: {
      colors: ['rgba(0,20,40,0)', 'rgba(100,200,255,0.2)', 'rgba(150,220,255,0.35)', 'rgba(50,150,255,0.3)', 'rgba(0,100,200,0.15)', 'rgba(0,30,60,0)'],
    },
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
    // Aurora for corruption void - purple/magenta
    aurora: {
      colors: ['rgba(20,0,20,0)', 'rgba(170,0,255,0.2)', 'rgba(255,0,255,0.35)', 'rgba(150,0,200,0.3)', 'rgba(80,0,100,0.15)', 'rgba(30,0,30,0)'],
    },
  },

  // The Stack: Brutalist industrial megastructure
  the_stack: {
    skyColor: 0x333333,
    fogColor: 0x444444,
    fogDensity: 0.01,
    gridColor: '#ffaa00',
    gridOpacity: 0.7,
    gridScale: 1.4,
    mountainFill: 0x222222,
    mountainWire: 0x888888,
    mountainWireOpacity: 0.6,
    mountainScale: 0.5,
    floorColor: 0x222222,
    sunColors: ['#ffffff', '#dddddd', '#bbbbbb'],
    sunGlowColor: 0xcccccc,
    sunScale: 0.8,
    horizonColor: 0x666666,
    horizonInnerColor: 0x444444,
    starColor: 0xffffff,
    starSize: 0.35,
    particles: { type: 'debris', color: 0x888888, count: 35, speed: 0.25 },
    // Enhanced: Industrial steam and sparks
    secondaryParticles: { type: 'steam', color: 0x666666, count: 20, speed: 0.2, size: 0.4 },
    ambientMotion: { type: 'vibration', intensity: 0.08, speed: 15.0 },
    lightIntensity: 0.9,
  },

  // Digital Rain (Hard) - Matrix-style biome
  digital_rain: {
    skyColor: 0x000000,
    fogColor: 0x001100,
    fogDensity: 0.008,
    gridColor: '#00ff00',
    gridOpacity: 0.5,
    gridScale: 1.1,
    mountainFill: 0x000500,
    mountainWire: 0x00ff00,
    mountainWireOpacity: 0.4,
    mountainScale: 1.2,
    floorColor: 0x000a00,
    sunColors: ['#00ff00', '#00cc00', '#009900'],
    sunGlowColor: 0x00ff00,
    sunScale: 0.7,
    horizonColor: 0x00aa00,
    horizonInnerColor: 0x007700,
    starColor: 0x00ff00,
    starSize: 0.4,
    particles: { type: 'code_rain', color: 0x00ff00, count: 50, speed: 3.0 },
    // Enhanced: Glitch bursts and data corruption
    secondaryParticles: { type: 'glitch_burst', color: 0x00ff00, count: 15, speed: 5.0, size: 0.25 },
    ambientMotion: { type: 'glitch', intensity: 0.5, speed: 10.0 },
    lightFlicker: { intensity: 0.3, speed: 8.0 },
    // Aurora for digital void - green matrix
    aurora: {
      colors: ['rgba(0,20,0,0)', 'rgba(0,255,0,0.2)', 'rgba(100,255,50,0.35)', 'rgba(0,200,0,0.3)', 'rgba(0,100,0,0.15)', 'rgba(0,30,0,0)'],
    },
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
    // Aurora for boss battles - red/crimson danger
    aurora: {
      colors: ['rgba(20,0,0,0)', 'rgba(255,0,0,0.25)', 'rgba(255,50,0,0.4)', 'rgba(200,0,0,0.35)', 'rgba(100,0,0,0.15)', 'rgba(30,0,0,0)'],
    },
  },

  // Kaleidoscope: Infinite mirror maze (Very Hard)
  kaleidoscope: {
    skyColor: 0x000000,
    fogColor: 0x111111,
    fogDensity: 0.015,
    gridColor: '#ffffff',
    gridOpacity: 0.9,
    gridScale: 0.6,
    mountainFill: 0x000000,
    mountainWire: 0xffffff,
    mountainWireOpacity: 0.95,
    mountainScale: 1.4,
    floorColor: 0x000000,
    sunColors: ['#ff00ff', '#00ffff', '#ffff00'],
    sunGlowColor: 0xffffff,
    sunScale: 1.25,
    horizonColor: 0xffffff,
    horizonInnerColor: 0xcccccc,
    starColor: 0xffffff,
    starSize: 0.75,
    particles: { type: 'prism', color: 0xffffff, count: 50, speed: 0.6 },
    // Enhanced: Mirror shards and geometric rotations
    secondaryParticles: { type: 'mirror_shard', color: 0xffffff, count: 25, speed: 0.8, size: 0.22 },
    ambientMotion: { type: 'rotation', intensity: 0.6, speed: 0.5 },
    lightIntensity: 1.3,
  },

  // Retro Arcade: Inside an 80s arcade with neon marquees and carpet patterns
  retro_arcade: {
    skyColor: 0x110022,
    fogColor: 0x220033,
    fogDensity: 0.012,
    gridColor: '#ff00ff',
    gridOpacity: 0.75,
    gridScale: 1.5,
    mountainFill: 0x110022,
    mountainWire: 0xff00ff,
    mountainWireOpacity: 0.7,
    mountainScale: 0.9,
    floorColor: 0x1a0033,
    sunColors: ['#ff00ff', '#00ffff', '#ff0088'],
    sunGlowColor: 0xff00ff,
    sunScale: 0.9,
    horizonColor: 0xff00ff,
    horizonInnerColor: 0x8800ff,
    starColor: 0xff88ff,
    starSize: 0.5,
    particles: { type: 'pixels', color: 0xff00ff, count: 40, speed: 0.4 },
    // Enhanced: Neon signs and scanlines
    secondaryParticles: { type: 'neon_sign', color: 0x00ffff, count: 15, speed: 0.0, size: 0.5 },
    ambientMotion: { type: 'flicker', intensity: 0.25, speed: 4.0 },
    lightFlicker: { intensity: 0.2, speed: 6.0 },
  },

  // Void Garden: Space garden with floating platforms and crystalline plants
  void_garden: {
    skyColor: 0x000005,
    fogColor: 0x000011,
    fogDensity: 0.008,
    gridColor: '#aaaaff',
    gridOpacity: 0.5,
    gridScale: 0.7,
    mountainFill: 0x000008,
    mountainWire: 0xaaaaff,
    mountainWireOpacity: 0.4,
    mountainScale: 1.3,
    floorColor: 0x000010,
    sunColors: ['#ffd700', '#daa520', '#b8860b'],
    sunGlowColor: 0xffd700,
    sunScale: 1.2,
    horizonColor: 0x6666ff,
    horizonInnerColor: 0x333399,
    starColor: 0xffffff,
    starSize: 0.7,
    particles: { type: 'crystal', color: 0xaa88ff, count: 35, speed: 0.15 },
    // Enhanced: Star fields and nebula wisps
    secondaryParticles: { type: 'nebula', color: 0x8866ff, count: 20, speed: 0.05, size: 0.6 },
    ambientMotion: { type: 'float', intensity: 0.25, speed: 0.3 },
    lightIntensity: 0.65, // Dimmer space
  },

  // Neon Rainforest: Cyberpunk jungle with bioluminescence
  neon_rainforest: {
    skyColor: 0x001a0d,
    fogColor: 0x002211,
    fogDensity: 0.014,
    gridColor: '#00ff88',
    gridOpacity: 0.65,
    gridScale: 1.2,
    mountainFill: 0x001a0d,
    mountainWire: 0x00ff88,
    mountainWireOpacity: 0.6,
    mountainScale: 0.8,
    floorColor: 0x002018,
    sunColors: ['#00ffff', '#00ff88', '#88ff00'],
    sunGlowColor: 0x00ff88,
    sunScale: 0.95,
    horizonColor: 0x00ff88,
    horizonInnerColor: 0x008844,
    starColor: 0x88ffaa,
    starSize: 0.45,
    particles: { type: 'pollen', color: 0xffff00, count: 45, speed: 0.2 },
    // Enhanced: Fireflies and glowing spores
    secondaryParticles: { type: 'firefly', color: 0x88ff00, count: 25, speed: 0.3, size: 0.12 },
    ambientMotion: { type: 'sway', intensity: 0.2, speed: 1.2 },
    lightIntensity: 0.85,
  },

  // ── New biomes (replace legacy reskins) ───────────────────
  synthwave_valley: {
    skyColor: 0x05000d,
    fogColor: 0x2a004a,
    fogDensity: 0.0008,
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
    starCount: 1200,
    starHeight: 140,
    starSpread: 420,
    starBase: 20,
    particles: null,
    hideBaseEnv: true,
    keepStars: true,
    customScene: 'synthwave_valley',
    // Aurora borealis colors: cyan/magenta/purple - BRIGHTER
    aurora: {
      colors: ['rgba(0,255,255,0)', 'rgba(0,255,200,0.2)', 'rgba(200,0,255,0.35)', 'rgba(255,0,200,0.3)', 'rgba(100,0,180,0.15)', 'rgba(0,100,150,0)'],
    },
  },

  desert_night: {
    skyColor: 0x06080c,
    fogColor: 0x06080c,
    fogDensity: 0.012,
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
    starCount: 900,
    starHeight: 110,
    starSpread: 360,
    starBase: 15,
    particles: null,
    hideBaseEnv: true,
    keepStars: true,
    customScene: 'desert_night',
    // Aurora borealis colors: warm orange/red - BRIGHTER
    aurora: {
      colors: ['rgba(60,20,0,0)', 'rgba(255,100,0,0.2)', 'rgba(255,150,50,0.35)', 'rgba(255,80,30,0.3)', 'rgba(200,50,20,0.15)', 'rgba(80,20,10,0)'],
    },
  },

  alien_planet: {
    skyColor: 0x080812,
    fogColor: 0x0a0815,
    fogDensity: 0.006,
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
    starCount: 700,
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
    fogColor: 0x000000,
    fogDensity: 0.0,
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
    starCount: 900,
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

  return THEMES.synthwave;
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

// Secondary particle system for layered effects
const SECONDARY_POOL = 30;
let secondaryParticles = null;
let secondaryGeo = null;

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
  scene.add(secondaryPoints);

  secondaryParticles = secondaryPoints;
  secondaryGeo = secondaryGeoInstance;

  console.log('[scenery] Initialized ambient particles (60 primary, 30 secondary)');
}

export function updateAmbientParticles(dt, theme, playerPos) {
  // Update primary particles
  if (!ambientParticles || !theme.particles) {
    if (ambientParticles) ambientParticles.visible = false;
  } else {
    ambientParticles.visible = true;

    const maxCount = Math.min(theme.particles.count || AMBIENT_POOL, AMBIENT_POOL);
    ambientGeo.setDrawRange(0, maxCount);

    const particleSize = theme.particles.size || 0.05;
    if (ambientParticles.material.size !== particleSize) {
      ambientParticles.material.size = particleSize;
    }

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

    for (let i = 0; i < maxCount; i++) {
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
          break;

        case 'crystal':
          // Void Garden: Floating crystalline particles drifting in void
          const crystalAngle = now * 0.0002 + (i / AMBIENT_POOL) * Math.PI * 4;
          positions[i3] += Math.cos(crystalAngle) * speed * dt * 0.5;
          positions[i3 + 1] += Math.sin(now * 0.0003 + i) * 0.01;
          positions[i3 + 2] += Math.sin(crystalAngle) * speed * dt * 0.5;
          break;

        case 'pixels':
          // Retro Arcade: Floating neon pixel sparks
          positions[i3] += Math.sin(now * 0.0003 + i * 0.7) * 0.02;
          positions[i3 + 1] += Math.cos(now * 0.0004 + i) * 0.015;
          positions[i3 + 2] += Math.cos(now * 0.00025 + i * 0.5) * 0.018;
          break;

        case 'pollen':
          // Neon Rainforest: Floating pollen particles
          positions[i3] += Math.sin(now * 0.0002 + i * 0.6) * 0.018;
          positions[i3 + 1] += Math.cos(now * 0.0003 + i) * 0.012;
          positions[i3 + 2] += Math.sin(now * 0.00025 + i * 0.4) * 0.015;
          break;

        // NEW ENHANCED PARTICLE TYPES
        case 'bubbles':
          // Ocean Floor: Rising bubbles with wobble
          positions[i3 + 1] += speed * dt * 0.8;
          positions[i3] += Math.sin(now * 0.002 + i * 1.5) * 0.025;
          positions[i3 + 2] += Math.cos(now * 0.0018 + i * 1.2) * 0.022;
          break;

        case 'current_flow':
          // Ocean Floor: Directional water currents
          positions[i3] += speed * dt * 0.6; // Flow in +X direction
          positions[i3 + 1] += Math.sin(now * 0.0008 + i) * 0.01;
          break;

        case 'smoke':
          // Hellscape: Rising smoke clouds
          positions[i3 + 1] += speed * dt;
          positions[i3] += Math.sin(now * 0.0003 + i * 0.8) * 0.03;
          positions[i3 + 2] += Math.cos(now * 0.00025 + i * 0.6) * 0.025;
          break;

        case 'power_surge':
          // Circuit Board: Power surges along traces
          const surgeDir = i % 2 === 0 ? 1 : -1;
          positions[i3] += surgeDir * speed * dt * 1.2;
          positions[i3 + 1] += Math.sin(now * 0.005 + i) * 0.005;
          break;

        case 'ice_crystal':
          // Frozen: Slowly rotating ice crystals
          const iceAngle = now * 0.0001 + (i / AMBIENT_POOL) * Math.PI * 2;
          positions[i3] += Math.cos(iceAngle) * speed * dt * 0.3;
          positions[i3 + 1] += Math.sin(now * 0.0002 + i) * 0.008;
          positions[i3 + 2] += Math.sin(iceAngle) * speed * dt * 0.3;
          break;

        case 'glitch_burst':
          // Digital Rain: Random glitch teleports
          if (Math.random() < 0.001) { // Random teleport
            positions[i3] = playerPos.x + (Math.random() - 0.5) * 30;
            positions[i3 + 1] = Math.random() * 12 + 2;
            positions[i3 + 2] = playerPos.z + (Math.random() - 0.5) * 30;
          }
          positions[i3 + 1] -= speed * dt * 0.5; // Slow fall
          break;

        case 'steam':
          // The Stack: Industrial steam
          positions[i3 + 1] += speed * dt * 0.7;
          positions[i3] += Math.sin(now * 0.0002 + i * 0.9) * 0.035;
          positions[i3 + 2] += Math.cos(now * 0.00018 + i * 0.7) * 0.03;
          break;

        case 'mirror_shard':
          // Kaleidoscope: Rotating mirror fragments
          const mirrorAngle = now * 0.0003 + (i / AMBIENT_POOL) * Math.PI * 8;
          positions[i3] += Math.cos(mirrorAngle) * speed * dt;
          positions[i3 + 2] += Math.sin(mirrorAngle) * speed * dt;
          positions[i3 + 1] += Math.sin(now * 0.0004 + i) * 0.015;
          break;

        case 'neon_sign':
          // Retro Arcade: Static neon sign particles (minimal movement)
          positions[i3 + 1] += Math.sin(now * 0.00005 + i) * 0.002;
          break;

        case 'firefly':
          // Neon Rainforest: Glowing fireflies with random movement
          positions[i3] += Math.sin(now * 0.0006 + i * 1.3) * 0.025;
          positions[i3 + 1] += Math.cos(now * 0.0007 + i * 1.1) * 0.02;
          positions[i3 + 2] += Math.sin(now * 0.0005 + i * 0.9) * 0.022;
          break;

        case 'nebula':
          // Void Garden: Slow nebula wisps
          const nebulaAngle = now * 0.00005 + (i / AMBIENT_POOL) * Math.PI * 2;
          positions[i3] += Math.cos(nebulaAngle) * speed * dt * 0.2;
          positions[i3 + 1] += Math.sin(now * 0.00008 + i) * 0.003;
          positions[i3 + 2] += Math.sin(nebulaAngle) * speed * dt * 0.2;
          break;

        case 'highway_dust':
          // Sunrise Highway: Road dust clouds
          positions[i3] += speed * dt * 0.5; // Drift forward
          positions[i3 + 1] += Math.sin(now * 0.0003 + i * 0.7) * 0.015;
          positions[i3 + 2] += Math.cos(now * 0.00025 + i * 0.5) * 0.012;
          break;

        case 'wave_ripple':
          // Vapor Sunset: Gentle wave ripples
          const waveAngle = now * 0.0004 + (i / AMBIENT_POOL) * Math.PI * 3;
          positions[i3] += Math.cos(waveAngle) * speed * dt * 0.3;
          positions[i3 + 1] += Math.sin(now * 0.0003 + i) * 0.008;
          positions[i3 + 2] += Math.sin(waveAngle) * speed * dt * 0.3;
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
                            (theme.particles.type === 'electrons' ? 1 :
                            (theme.particles.type === 'crystal' ? Math.random() * 8 + 1 : Math.random() * 2)));
        positions[i3 + 2] = playerPos.z + (Math.random() - 0.5) * 40;
      }
    }

    ambientGeo.attributes.position.needsUpdate = true;
  }

  // Update secondary particles
  if (!secondaryParticles || !theme.secondaryParticles) {
    if (secondaryParticles) secondaryParticles.visible = false;
  } else {
    secondaryParticles.visible = true;

    const maxCount = Math.min(theme.secondaryParticles.count || SECONDARY_POOL, SECONDARY_POOL);
    secondaryGeo.setDrawRange(0, maxCount);

    const particleSize = theme.secondaryParticles.size || 0.08;
    if (secondaryParticles.material.size !== particleSize) {
      secondaryParticles.material.size = particleSize;
    }

    secondaryParticles.material.color.setHex(theme.secondaryParticles.color);

    const positions = secondaryGeo.attributes.position.array;
    const speed = theme.secondaryParticles.speed;
    const now = performance.now();

    for (let i = 0; i < maxCount; i++) {
      const i3 = i * 3;

      // Apply same particle logic as primary (simplified - just use same switch)
      switch (theme.secondaryParticles.type) {
        case 'current_flow':
          positions[i3] += speed * dt * 0.6;
          positions[i3 + 1] += Math.sin(now * 0.0008 + i) * 0.01;
          break;
        case 'smoke':
          positions[i3 + 1] += speed * dt;
          positions[i3] += Math.sin(now * 0.0003 + i * 0.8) * 0.03;
          positions[i3 + 2] += Math.cos(now * 0.00025 + i * 0.6) * 0.025;
          break;
        case 'power_surge':
          const surgeDir = i % 2 === 0 ? 1 : -1;
          positions[i3] += surgeDir * speed * dt * 1.2;
          break;
        case 'ice_crystal':
          const iceAngle = now * 0.0001 + (i / SECONDARY_POOL) * Math.PI * 2;
          positions[i3] += Math.cos(iceAngle) * speed * dt * 0.3;
          positions[i3 + 2] += Math.sin(iceAngle) * speed * dt * 0.3;
          break;
        case 'glitch_burst':
          if (Math.random() < 0.001) {
            positions[i3] = playerPos.x + (Math.random() - 0.5) * 30;
            positions[i3 + 1] = Math.random() * 12 + 2;
            positions[i3 + 2] = playerPos.z + (Math.random() - 0.5) * 30;
          }
          positions[i3 + 1] -= speed * dt * 0.5;
          break;
        case 'steam':
          positions[i3 + 1] += speed * dt * 0.7;
          positions[i3] += Math.sin(now * 0.0002 + i * 0.9) * 0.035;
          positions[i3 + 2] += Math.cos(now * 0.00018 + i * 0.7) * 0.03;
          break;
        case 'mirror_shard':
          const mirrorAngle = now * 0.0003 + (i / SECONDARY_POOL) * Math.PI * 8;
          positions[i3] += Math.cos(mirrorAngle) * speed * dt;
          positions[i3 + 2] += Math.sin(mirrorAngle) * speed * dt;
          break;
        case 'neon_sign':
          positions[i3 + 1] += Math.sin(now * 0.00005 + i) * 0.002;
          break;
        case 'firefly':
          positions[i3] += Math.sin(now * 0.0006 + i * 1.3) * 0.025;
          positions[i3 + 1] += Math.cos(now * 0.0007 + i * 1.1) * 0.02;
          positions[i3 + 2] += Math.sin(now * 0.0005 + i * 0.9) * 0.022;
          break;
        case 'nebula':
          const nebulaAngle = now * 0.00005 + (i / SECONDARY_POOL) * Math.PI * 2;
          positions[i3] += Math.cos(nebulaAngle) * speed * dt * 0.2;
          positions[i3 + 2] += Math.sin(nebulaAngle) * speed * dt * 0.2;
          break;
        case 'highway_dust':
          positions[i3] += speed * dt * 0.5;
          positions[i3 + 1] += Math.sin(now * 0.0003 + i * 0.7) * 0.015;
          positions[i3 + 2] += Math.cos(now * 0.00025 + i * 0.5) * 0.012;
          break;
        case 'wave_ripple':
          const waveAngle = now * 0.0004 + (i / SECONDARY_POOL) * Math.PI * 3;
          positions[i3] += Math.cos(waveAngle) * speed * dt * 0.3;
          positions[i3 + 1] += Math.sin(now * 0.0003 + i) * 0.008;
          positions[i3 + 2] += Math.sin(waveAngle) * speed * dt * 0.3;
          break;
        default:
          // Default floating behavior
          positions[i3 + 1] += Math.sin(now * 0.0002 + i) * 0.01;
          positions[i3] += Math.cos(now * 0.0001 + i) * 0.015;
          positions[i3 + 2] += Math.sin(now * 0.00015 + i) * 0.012;
      }

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

// ── Innkeeper NPC ─────────────────────────────────────────
export function createInnkeeper() {
  const group = new THREE.Group();
  group.name = 'innkeeper';

  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 256;
  const ctx = canvas.getContext('2d');

  ctx.fillStyle = '#000000';
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // Simple pixel-like character
  ctx.fillStyle = '#332211';
  ctx.fillRect(48, 160, 32, 60);

  ctx.fillStyle = '#aa8855';
  ctx.fillRect(44, 120, 40, 40);

  ctx.fillStyle = '#552200';
  ctx.fillRect(52, 80, 24, 40);

  ctx.fillStyle = '#ffeecc';
  ctx.fillRect(54, 60, 20, 20);

  ctx.fillStyle = '#ffffff';
  ctx.fillRect(58, 66, 4, 4);
  ctx.fillRect(66, 66, 4, 4);

  ctx.fillStyle = '#ff88aa';
  ctx.fillRect(60, 74, 8, 4);

  const texture = new THREE.CanvasTexture(canvas);
  texture.minFilter = THREE.NearestFilter;
  texture.magFilter = THREE.NearestFilter;

  const spriteMat = new THREE.SpriteMaterial({ map: texture, transparent: true });
  const sprite = new THREE.Sprite(spriteMat);
  sprite.scale.set(2.2, 4.4, 1);
  sprite.position.y = 2.2;
  group.add(sprite);

  const base = new THREE.Mesh(
    new THREE.CylinderGeometry(0.8, 1.0, 0.4, 8),
    new THREE.MeshBasicMaterial({ color: 0x2a1a10 })
  );
  base.position.y = 0.2;
  group.add(base);

  group.userData.sprite = sprite;
  return group;
}
