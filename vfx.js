// ============================================================
//  VFX — Visual Effects Module
//  Currently a stub - voxel death system remains in main.js
//  due to tight coupling with triggerScreenShake and scene.
// ============================================================

import * as THREE from 'three';

// ── Module State ───────────────────────────────────────────
let sceneRef = null;

// ── Initialization ─────────────────────────────────────────
export function initVFX(scene) {
  sceneRef = scene;
}

// ── Update Loop ────────────────────────────────────────────
export function updateVFX(dt) {
  // Voxel physics and explosion visuals are updated in main.js
  // This stub exists for future VFX extraction if needed
}

// NOTE: The voxel death explosion system (spawnVoxelExplosion, voxelPool,
// activeVoxels, updateVoxelPhysics, getDeathPattern) remains in main.js
// because it depends on:
// - triggerScreenShake() - defined in main.js
// - playExplosionSound() - imported from audio.js in main.js
// - scene access for mesh management
//
// The explosion visual system (spawnExplosionVisual, explosionVisuals,
// updateExplosionVisuals) also remains in main.js due to similar dependencies
// and usage by boss-death-cinematic.js.
//
// Future refactoring could extract these if we create a proper VFX
// dependency injection pattern.
