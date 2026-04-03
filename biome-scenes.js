// ============================================================
//  BIOME SCENES — Custom visual scene builders for biomes
//  Extracted from main.js for modular architecture
// ============================================================

import * as THREE from 'three';
import { buildDesertNightScene } from './biomes/desert-night.js';
import { buildAlienPlanetScene } from './biomes/alien-planet.js';
import { buildHellscapeLavaScene } from './biomes/hellscape-lava.js';
import { buildSynthwaveValleyScene } from './biomes/synthwave-valley.js';

// ── Exports ────────────────────────────────────────────────

/**
 * Rebuild the biome scene for a given biome ID.
 * Called from main.js when level/theme changes.
 * 
 * @param {Object} deps - Dependencies from main.js
 * @param {THREE.Scene} deps.scene - The main scene
 * @param {string} deps.biomeId - The biome ID to build
 * @param {Object} deps.theme - The theme object with colors/settings
 * @param {Object} deps.state - State object with biomeSceneGroup, biomeSceneBiome setters
 * @param {Function} deps.clearBiomeScene - Function to clear previous biome scene
 * @param {Function} deps.registerFadeMaterial - Function to register materials for fade
 * @param {Function} deps.updateAuroraColors - Function to update aurora for theme
 * @param {Function} deps.cleanupLegacyShapeGeometry - Function to cleanup stale meshes
 * @param {Function} deps.assignBiomePlaneNames - Function to name plane geometries
 * @param {Object} deps.refs - Reference objects (floorMaterial, synthVisualRefs, etc.)
 * @param {Array} deps.biomeTerrainMaterials - Array to push terrain materials to
 */
export function rebuildBiomeScene(deps) {
  const {
    scene,
    biomeId,
    theme,
    state,
    clearBiomeScene,
    registerFadeMaterial,
    updateAuroraColors,
    cleanupLegacyShapeGeometry,
    assignBiomePlaneNames,
    refs,
    biomeTerrainMaterials,
  } = deps;

  console.log('[debug] rebuildBiomeScene: biomeId=', biomeId, 'customScene=', theme?.customScene);
  
  if (!scene || !theme || !theme.customScene) {
    console.log('[debug] Clearing biome scene (no custom scene)');
    clearBiomeScene();
    return;
  }
  
  if (state.biomeSceneGroup && state.biomeSceneBiome === biomeId) {
    console.log('[debug] Biome scene already built for', biomeId, ', skipping');
    return;
  }

  console.log('[debug] Building new biome scene for', biomeId);
  clearBiomeScene();

  // Update aurora colors for new biome
  updateAuroraColors(theme);

  const biomeSceneGroup = new THREE.Group();
  biomeSceneGroup.name = `biome-scene-${biomeId}`;
  scene.add(biomeSceneGroup);
  
  // Update state
  state.biomeSceneGroup = biomeSceneGroup;
  state.biomeSceneBiome = biomeId;

  // Build the appropriate scene
  const buildDeps = {
    registerFadeMaterial,
    floorMaterial: refs.floorMaterial,
    synthVisualRefs: refs.synthVisualRefs,
    biomeTerrainMaterials,
    getVisualTuning: refs.getVisualTuning,
  };

  if (theme.customScene === 'synthwave_valley') {
    buildSynthwaveValleyScene(biomeSceneGroup, buildDeps);
  } else if (theme.customScene === 'desert_night') {
    buildDesertNightScene(biomeSceneGroup, buildDeps);
  } else if (theme.customScene === 'alien_planet') {
    buildAlienPlanetScene(biomeSceneGroup, buildDeps);
  } else if (theme.customScene === 'hellscape_lava') {
    buildHellscapeLavaScene(biomeSceneGroup, buildDeps);
  }

  // Cleanup stale legacy meshes and give all biome PlaneGeometry meshes
  // unique, readable names for debug look-at tooling.
  cleanupLegacyShapeGeometry(scene);
  assignBiomePlaneNames(biomeSceneGroup, biomeId);

  // Register all biome scene materials for environment fade
  // This ensures everything fades to black during boss death cinematic
  if (biomeSceneGroup) {
    biomeSceneGroup.traverse((child) => {
      if (child.isMesh && child.material) {
        if (Array.isArray(child.material)) {
          child.material.forEach(m => registerFadeMaterial(m));
        } else {
          registerFadeMaterial(child.material);
        }
      }
      if (child.isPoints && child.material) {
        registerFadeMaterial(child.material);
      }
      if (child.isLine && child.material) {
        registerFadeMaterial(child.material);
      }
    });
  }
}

/**
 * Get the physics floor Y for current biome (matches visual floor HUD height)
 * @param {string} biomeSceneBiome - Current biome ID
 * @param {number} SCENE_Y_OFFSET - Scene Y offset constant
 * @returns {number} Floor Y position
 */
export function getBiomeFloorY(biomeSceneBiome, SCENE_Y_OFFSET) {
  const floorY = (() => {
    switch (biomeSceneBiome) {
      case 'synthwave_valley': return 0.10;
      case 'desert_night': return -0.20;
      case 'alien_planet': return -0.28;
      case 'hellscape_lava': return 0.05;
      default: return 0.05;
    }
  })();
  // Apply scene Y offset for VR camera height fix
  return floorY + SCENE_Y_OFFSET;
}

/**
 * Log cylinder colors for debugging
 * @param {Object} refs - Reference objects (auroraRef, atmosphereRef)
 */
export function logCylinderColors(refs) {
  const { auroraRef, atmosphereRef } = refs;
  
  console.log('=== CYLINDER COLORS ===');
  
  // atmosphereRef
  if (typeof atmosphereRef !== 'undefined' && atmosphereRef && atmosphereRef.material) {
    if (atmosphereRef.material.uniforms) {
      const uni = atmosphereRef.material.uniforms;
      console.log('atmosphereRef (atmosphere cylinder):');
      console.log('  - uFogColor:', uni.uFogColor?.value?.getHexString());
      console.log('  - Gradient stops:');
      console.log('    0% (base): rgba(254,144,83,1.0) -> #FE9053 (horizon orange)');
      console.log('    20%: rgba(224,1,134,0.9) -> #E00186 (pink)');
      console.log('    50%: rgba(44,0,81,0.6) -> #2C0051 (sun top purple)');
      console.log('    100% (top): rgba(26,0,74,0.0) -> #1A004A (dark purple)');
    }
  }
  
  // auroraRef
  if (auroraRef && auroraRef.material) {
    const tex = auroraRef.material.map;
    if (tex && tex.image) {
      const canvas = tex.image;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        console.log('auroraRef (aurora cylinder):');
        const imageData = ctx.getImageData(0, 0, canvas.width, 1);
        console.log('  - Bottom pixel:', imageData.data);
      }
    }
    
    // Use scenery.js theme colors
    if (typeof window !== 'undefined' && window.THEMES && window.THEMES.synthwave_valley && window.THEMES.synthwave_valley.aurora) {
      const colors = window.THEMES.synthwave_valley.aurora.colors;
      console.log('  - Theme colors:', colors);
    }
  }
  
  // horizonRingRef and horizonInnerRingRef - REMOVED
  console.log('horizonRingRef: REMOVED');
  console.log('horizonInnerRingRef: REMOVED');
  
  console.log('====================');
}
