// ============================================================
// ARCHIVED BOSSES — Backup from Level 10 and 15
// Moved during beta to have single boss per tier
// ============================================================

// === ARCHIVED BOSS DEFINITIONS ===

// --- LEVEL 10 BOSS (TIER 2) ---
export const ARCHIVED_HUNTER_BOSS = {
  name: 'Hunter Breakenridge',
  pattern: [
    [0, 1, 1],
    [1, 0, 1],
    [1, 1, 0],
    [1, 0, 1],
  ],
  voxelSize: 0.35,
  baseHp: 1000,
  phases: 3,
  color: 0x88aa88,
  scoreValue: 100,
  behavior: 'dodger',
  hitboxRadius: 0.6,
  vanishRate: 2.0,
  projectileRate: 2.2,
  weakPoints: false
};

export const ARCHIVED_DJ_BOSS = {
  name: 'DJ Drax',
  pattern: [
    [0, 1, 0, 1],
    [1, 0, 1, 1, 0],
    [0, 0, 1, 0, 1],
    [1, 1, 1, 1, 1],
  ],
  voxelSize: 0.35,
  baseHp: 900,
  phases: 3,
  color: 0x00ffff,
  scoreValue: 100,
  behavior: 'dj',
  hitboxRadius: 0.65,
  beatDropRate: 1.2,
  dropCount: 4,
  weakPoints: true
};

export const ARCHIVED_STARFIGHTER_BOSS = {
  name: 'Captain Kestrel',
  pattern: [
    [0, 1, 1],
    [1, 0, 1, 0],
    [1, 0, 1, 1],
    [0, 1, 1, 1, 1],
  ],
  voxelSize: 0.35,
  baseHp: 1100,
  phases: 3,
  color: 0x00aaff,
  scoreValue: 100,
  behavior: 'starfighter',
  hitboxRadius: 0.7,
  cannonFireRate: 2.0,
  missileRate: 5.0,
  weakPoints: true
};

export const ARCHIVED_SCIENTIST_BOSS = {
  name: 'Dr. Aster',
  pattern: [
    [0, 0, 0, 0, 1],
    [0, 0, 0, 1, 0],
    [0, 1, 1, 0, 1],
    [1, 1, 0, 1, 1, 1],
  ],
  voxelSize: 0.35,
  baseHp: 1000,
  phases: 3,
  color: 0x00ff88,
  scoreValue: 100,
  behavior: 'scientist',
  hitboxRadius: 0.65,
  teleportRate: 3.0,
  minionRate: 2.0,
  weakPoints: true
};

export const ARCHIVED_MONK_BOSS = {
  name: 'Sunflare Seraph',
  pattern: [
    [0, 0, 1, 0],
    [0, 1, 0, 1],
    [1, 1, 0, 1],
    [0, 1, 1, 1, 1],
  ],
  voxelSize: 0.35,
  baseHp: 1100,
  phases: 3,
  color: 0xffaa00,
  scoreValue: 100,
  behavior: 'monk',
  hitboxRadius: 0.7,
  sunNodeOrbitSpeed: 1.0,
  meditationDuration: 3.0,
  weakPoints: false
};

// --- LEVEL 15 BOSS (TIER 3) ---
export const ARCHIVED_OUTLAW_BOSS = {
  name: 'Theodore "Shady" Breakenridge',
  pattern: [
    [0, 0, 1, 0, 0],
    [0, 1, 1, 1, 0],
    [1, 1, 1, 1, 1],
    [0, 1, 1, 1, 1, 1],
  ],
  voxelSize: 0.4,
  baseHp: 1800,
  phases: 3,
  color: 0x8800ff,
  scoreValue: 400,
  behavior: 'outlaw',
  hitboxRadius: 0.7,
  vanishDuration: 2.0,
  shadowBulletRate: 0.8,
  weakPoints: true
};

export const ARCHIVED_COMMANDER_BOSS = {
  name: 'Commander Halcyon',
  pattern: [
    [0, 0, 1, 0, 0],
    [0, 1, 1, 1, 0],
    [1, 1, 1, 1, 1],
    [0, 1, 1, 1, 1, 1],
  ],
  voxelSize: 0.38,
  baseHp: 1750,
  phases: 3,
  color: 0x00aaff,
  scoreValue: 400,
  behavior: 'commander',
  hitboxRadius: 0.75,
  laserRate: 1.5,
  weakPoints: false
};

export const ARCHIVED_DIVA_BOSS = {
  name: 'Madame Coda',
  pattern: [
    [1, 1, 1],
    [1, 1, 1, 1],
    [1, 1, 1, 1],
  ],
  voxelSize: 0.32,
  baseHp: 1700,
  phases: 3,
  color: 0xff00ff,
  scoreValue: 400,
  behavior: 'diva',
  hitboxRadius: 0.7,
  beamRate: 1.2,
  performanceDuration: 3.0,
  weakPoints: false
};

export const ARCHIVED_TWIN_GLITCH_BOSS = {
  name: 'Twin Glitch Units',
  pattern: [
    [1, 1],
    [1, 1],
  ],
  voxelSize: 0.25,
  baseHp: 1600,
  phases: 3,
  color: 0x00ffff,
  scoreValue: 400,
  behavior: 'twin_glitch',
  hitboxRadius: 1.2,
  vulnerabilitySwapRate: 4.0,
  weakPoints: false
};
