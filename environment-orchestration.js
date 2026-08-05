// ============================================================
//  ENVIRONMENT ORCHESTRATION (Issue #196 Phase 5)
//  Pure-move extraction from main.js: biome scene lifecycle, theme
//  application, environment fades, stars, and transition bursts.
//
//  Ownership:
//  - THIS MODULE: all biome/theme/fade/star state + the functions that
//    create, tear down, and update the environment. main.js flow code
//    calls the exported functions and reads the exported state
//    (currentTheme, synthVisualRefs, floorMaterial) — never writes it.
//  - main.js: flow-owned flags (levelFadeReady), camera helpers, visual
//    tuning (getVisualTuning is injected — it reads runtimeConfig).
//
//  Notes:
//  - ES module bindings are read-only (AGENTS.md §17): main.js may READ
//    `currentTheme`/`floorMaterial`/`synthVisualRefs` but assignments
//    live here. Mutations of object properties (synthVisualRefs.*) are
//    fine from anywhere.
//  - biome-scenes.js receives deps through rebuildBiomeScene() below —
//    no import cycle (biome-scenes.js never imports this module).
//  - Pure move: function bodies are unchanged from main.js.
// ============================================================

import * as THREE from 'three';
import { rebuildBiomeScene as rebuildBiomeSceneModule, getBiomeFloorY as getBiomeFloorYModule } from './biome-scenes.js';
import { getThemeForLevel } from './scenery.js';
import { getBiomeForLevel } from './game.js';
import { setThreatCompassTheme } from './threat-compass.js';

const DEBUG = false;
const _log = DEBUG ? console.log.bind(console) : () => {};

// Injected deps (initEnvironment, called once from main.js init)
let _deps = {};

// ── Environment state (owned here; main.js may read) ─────────

// Environment fade scratch colors (module-level to avoid per-frame `new`)
const _envFadeMixColor = new THREE.Color(0x000000);       // environment fade mix
const _envFadeBgColor = new THREE.Color(0x000000);        // environment fade background

let starsRef = null;
let starsBiomeId = null;
export let currentTheme = null;
export let biomeSceneGroup = null; // main.js boss-alert cinematic reads this
let biomeSceneBiome = null;
let biomeClearedForBossCinematic = false;
let environmentFade = 0;
let environmentFadeState = null;
const environmentFadeTargets = [];
export let floorMaterial = null;
export let biomeTerrainMaterials = [];  // Array of { type: 'shader'|'overlay', material }

// [DEBUG] References that let debug visual tuning affect synthwave valley elements.
export const synthVisualRefs = {
  terrainUniforms: null,
  sunOuterGlowMat: null,
  sunGlowMat: null,
  sunCoreMat: null,
  mountainCylMat: null,
  // Desert biome refs (Prism Boss cinematic)
  desertSkyMat: null,
  desertMoonMat: null,
  desertMoonGlowMat: null,
  // Alien biome refs (Minotaur cinematic)
  alienSkyMat: null,
  alienCityShaderMat: null,
  alienGreenLight: null,
};

// BIOME_LIGHTING removed — all biomes provide their own lighting
export const AVAILABLE_BIOMES = ['synthwave_valley', 'desert_night', 'alien_planet', 'hellscape_lava'];

// ── Biome transition burst particle system ──
const TRANSITION_BURST_COUNT = 24;
let transitionBurst = null;
let transitionBurstGeo = null;
let transitionBurstActive = false;
let transitionBurstAge = 0;
const TRANSITION_BURST_DURATION = 1.2;

/**
 * Wire environment orchestration deps. Called once from main.js init.
 * deps: { scene, getVisualTuning, sceneYOffset }
 *   - getVisualTuning: main.js debug helper (reads runtimeConfig)
 *   - sceneYOffset: main.js SCENE_Y_OFFSET constant (single source)
 */
export function initEnvironment(deps) {
  _deps = deps || {};
  _log('[environment] orchestration initialized');
}

// [CORE] Reset the boss-cinematic biome purge flag (main.js flow calls
// this when a level's spawn forward is captured)
export function setBiomeClearedForBossCinematic(value) {
  biomeClearedForBossCinematic = !!value;
}

// ============================================================
//  DISPOSAL HELPERS (shared with other modules via main.js deps)
// ============================================================

// [CORE] Dispose mesh and remove from parent
// Recursively disposes geometry + material and removes from parent.
// Use for any Three.js mesh/group that is no longer needed.
// For objects with textures (biome scenes), prefer disposeObject3D().
export function disposeMesh(obj, removeFromParent = true) {
  if (!obj) return;
  // Dispose children recursively
  if (obj.children) {
    for (let i = obj.children.length - 1; i >= 0; i--) {
      disposeMesh(obj.children[i], false);
    }
  }
  // Dispose own geometry and material
  if (obj.geometry) obj.geometry.dispose();
  if (obj.material) {
    if (Array.isArray(obj.material)) {
      obj.material.forEach(m => m.dispose());
    } else {
      obj.material.dispose();
    }
  }
  // Remove from parent (scene or group)
  if (removeFromParent && obj.parent) {
    obj.parent.remove(obj);
  }
}

// [CORE] Deep dispose material and textures
export function disposeMaterialDeep(material) {
  if (!material) return;
  if (Array.isArray(material)) {
    material.forEach(disposeMaterialDeep);
    return;
  }

  // three.js does NOT dispose textures when a material is disposed.
  const maps = [
    'map',
    'alphaMap',
    'aoMap',
    'bumpMap',
    'displacementMap',
    'emissiveMap',
    'envMap',
    'lightMap',
    'metalnessMap',
    'normalMap',
    'roughnessMap',
    'specularMap',
  ];
  for (const key of maps) {
    const tex = material[key];
    if (tex && tex.isTexture && typeof tex.dispose === 'function') {
      tex.dispose();
    }
  }

  // ShaderMaterial uniforms can contain textures under custom names
  // (e.g., uNoiseTexture, uGridTexture) that aren't in the standard maps list.
  if (material.uniforms) {
    for (const key of Object.keys(material.uniforms)) {
      const val = material.uniforms[key]?.value;
      if (val && val.isTexture && typeof val.dispose === 'function') {
        val.dispose();
      }
    }
  }

  if (typeof material.dispose === 'function') material.dispose();
}

// [CORE] Safely set material emissive color
export function setMaterialEmissiveSafe(material, color, intensity) {
  if (!material) return;
  if (Array.isArray(material)) {
    material.forEach((m) => setMaterialEmissiveSafe(m, color, intensity));
    return;
  }

  if (material.emissive && typeof material.emissive.copy === 'function') {
    material.emissive.copy(color);
    material.emissiveIntensity = intensity;
    return;
  }

  if (Object.prototype.hasOwnProperty.call(material, 'emissive')) delete material.emissive;
  if (Object.prototype.hasOwnProperty.call(material, 'emissiveIntensity')) delete material.emissiveIntensity;
}

// [CORE] Deep dispose Object3D and children
export function disposeObject3D(obj) {
  if (!obj) return;
  // Guard: only traverse if obj is a THREE.Object3D (proxy objects from InstancedMesh pools don't have .traverse)
  if (typeof obj.traverse !== 'function') return;

  unregisterFadeMaterialsForObject(obj);

  obj.traverse((child) => {
    // Skip disposal of shared pool resources (drone projectiles share geo/mat)
    if (child.userData?._sharedPool) return;
    if (child.geometry) child.geometry.dispose();
    if (child.material) disposeMaterialDeep(child.material);
  });

  // Remove from parent (scene or group). Safe to call even if already removed.
  if (obj.parent) obj.parent.remove(obj);
}

// ============================================================
//  FADE SYSTEM (materials fade to black on biome transitions)
// ============================================================

// [CORE] Register material for environment fade
export function registerFadeMaterial(material) {
  if (!material) return;
  // Prevent unbounded growth across level rebuilds.
  if (environmentFadeTargets.includes(material)) return;
  const baseOpacity = material.opacity !== undefined ? material.opacity : 1;
  material.transparent = true;
  material.__fadeBase = baseOpacity;
  environmentFadeTargets.push(material);
}

// [CORE] Unregister material from fade system
export function unregisterFadeMaterial(material) {
  if (!material) return;
  const idx = environmentFadeTargets.indexOf(material);
  if (idx !== -1) environmentFadeTargets.splice(idx, 1);
}

// [CORE] Unregister all fade materials for an object
export function unregisterFadeMaterialsForObject(obj) {
  if (!obj || typeof obj.traverse !== 'function') return;
  obj.traverse((child) => {
    if (!child.material) return;
    if (Array.isArray(child.material)) child.material.forEach(unregisterFadeMaterial);
    else unregisterFadeMaterial(child.material);
  });
}

// [CORE] Start environment fade (in or out)
export function startEnvironmentFade(direction, duration, onComplete) {
  environmentFadeState = {
    direction,
    duration,
    timer: duration,
    onComplete,
  };
}

/** True while a fade is in progress (main.js flow reads this for gating). */
export function isEnvironmentFadeActive() {
  return !!environmentFadeState;
}

// [CORE] Apply current environment fade to registered materials
export function applyEnvironmentFade(fade) {
  environmentFade = Math.max(0, Math.min(1, fade));
  // Perf: module scratch Colors (was new THREE.Color per call; called every frame during fades)
  const mixColor = _envFadeMixColor;

  if (_deps.scene && currentTheme) {
    const bg = _envFadeBgColor.copy(currentTheme.skyColor).lerp(mixColor, environmentFade);
    if (_deps.scene.background && _deps.scene.background.copy) {
      _deps.scene.background.copy(bg);
    }
  }

  environmentFadeTargets.forEach((material) => {
    const base = material.__fadeBase ?? 1;
    material.opacity = base * (1 - environmentFade);
  });
}

// [CORE] Tick an active environment fade (called from the main render loop
// during ALL states — fades run through title/upgrade/boss transitions)
export function updateEnvironmentFade(dt) {
  if (!environmentFadeState) return;
  environmentFadeState.timer -= dt;
  const progress = 1 - Math.max(0, environmentFadeState.timer) / environmentFadeState.duration;
  const fadeValue = environmentFadeState.direction === 'out' ? progress : 1 - progress;
  applyEnvironmentFade(fadeValue);

  if (environmentFadeState.timer <= 0) {
    const onComplete = environmentFadeState.onComplete;
    const finalFade = environmentFadeState.direction === 'out' ? 1 : 0;
    environmentFadeState = null;
    applyEnvironmentFade(finalFade);
    if (onComplete) onComplete();
  }
}

// ============================================================
//  BIOME SCENE LIFECYCLE
// ============================================================

// applyBiomeLighting — stubbed, all biomes provide their own lighting
function applyBiomeLighting(biome) {
  // No base lights exist. Biome scenes handle their own lighting.
}

// [CORE] Biome mesh name sanitization
function sanitizeBiomeMeshName(name) {
  return String(name || '')
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

// [CORE] Assign biome-specific names to floor planes
function assignBiomePlaneNames(targetGroup, biomeId) {
  if (!targetGroup) return;

  const usedPlaneNames = new Set();

  targetGroup.traverse((child) => {
    if (!child?.isMesh || !child.geometry) return;
    if (child.geometry.type !== 'PlaneGeometry') return;

    const geoParams = child.geometry.parameters || {};
    const widthTag = Number.isFinite(geoParams.width) ? `w${Math.round(geoParams.width)}` : 'w';
    const heightTag = Number.isFinite(geoParams.height) ? `h${Math.round(geoParams.height)}` : 'h';

    const preferredName =
      sanitizeBiomeMeshName(child.userData?.planeName) ||
      sanitizeBiomeMeshName(child.name) ||
      sanitizeBiomeMeshName(child.parent?.name) ||
      `${biomeId}-plane-${widthTag}-${heightTag}`;

    let baseName = preferredName || `${biomeId}-plane-${widthTag}-${heightTag}`;
    let uniqueName = baseName;
    let suffix = 2;

    while (usedPlaneNames.has(uniqueName)) {
      uniqueName = `${baseName}-${suffix++}`;
    }

    // Keep userData + mesh name in sync so debug tooling and inspector searches
    // both resolve to the same human-readable PlaneGeometry label.
    child.name = uniqueName;
    child.userData.planeName = uniqueName;
    usedPlaneNames.add(uniqueName);
  });
}

// [CORE] Clean up legacy ShapeGeometry mountains locked at world origin
function cleanupLegacyShapeGeometry(targetGroup) {
  if (!targetGroup) return;

  const staleMeshes = [];
  const worldPos = new THREE.Vector3();
  const boundsSize = new THREE.Vector3();

  targetGroup.traverse((child) => {
    if (!child?.isMesh || !child.geometry) return;
    if (child.geometry.type !== 'ShapeGeometry') return;

    child.getWorldPosition(worldPos);
    const atWorldOrigin = worldPos.lengthSq() <= 0.0001;

    // Non-obvious safety guard: legacy audio-peak mountains were large flat
    // ShapeGeometry meshes locked at world origin. Keep this strict so we do
    // not remove gameplay hex meshes that also use ShapeGeometry.
    if (!child.geometry.boundingBox) child.geometry.computeBoundingBox();
    if (!child.geometry.boundingBox) return;
    child.geometry.boundingBox.getSize(boundsSize);
    const isLargeLegacyPlane = boundsSize.lengthSq() >= (25 * 25);

    if (!atWorldOrigin || !isLargeLegacyPlane) return;
    staleMeshes.push(child);
  });

  staleMeshes.forEach((mesh, idx) => {
    disposeObject3D(mesh);
    _log(`[biome] Removed stale ShapeGeometry legacy mountain at world origin (${idx + 1}/${staleMeshes.length})`);
  });
}

// [CORE] Clear current biome scene
export function clearBiomeScene() {
  if (!biomeSceneGroup) return;
  disposeObject3D(biomeSceneGroup);
  biomeSceneGroup = null;
  biomeSceneBiome = null;
  biomeTerrainMaterials = [];  // Clear terrain flash references

  synthVisualRefs.terrainUniforms = null;
  synthVisualRefs.sunOuterGlowMat = null;
  synthVisualRefs.sunGlowMat = null;
  synthVisualRefs.sunCoreMat = null;
  synthVisualRefs.mountainCylMat = null;
  synthVisualRefs.desertSkyMat = null;
  synthVisualRefs.desertMoonMat = null;
  synthVisualRefs.desertMoonGlowMat = null;
  synthVisualRefs.alienSkyMat = null;
  synthVisualRefs.alienCityShaderMat = null;
  synthVisualRefs.alienGreenLight = null;
}

// [CORE] Purge biome geometry for boss cinematic
export function purgeBiomeForBossCinematic() {
  if (biomeClearedForBossCinematic) return;
  biomeClearedForBossCinematic = true;

  // Drop the current biome geometry while the screen is black so upgrades
  // appear on a clean slate before the next biome loads.
  clearBiomeScene();

  // Stars are added directly to scene (not biomeSceneGroup), so they must
  // be cleaned up separately. Without this, old star particles leak into
  // the upgrade card screen and accumulate across biome transitions (#4, #8, #20).
  if (starsRef) {
    unregisterFadeMaterial(starsRef.material);
    disposeMesh(starsRef, true);
    starsRef = null;
    starsBiomeId = null;
  }

  if (floorMaterial) floorMaterial.opacity = 0;
  applyEnvironmentFade(1);
  if (_deps.scene) {
    if (_deps.scene.background && _deps.scene.background.isColor) {
      _deps.scene.background.set(0x000000);
    } else {
      _deps.scene.background = new THREE.Color(0x000000);
    }
  }
}

// [CORE] Update biome props (animated scenery)
export function updateBiomeProps(now, dt) {
  if (!biomeSceneGroup) return;
  if (biomeSceneGroup.userData && typeof biomeSceneGroup.userData.update === 'function') {
    biomeSceneGroup.userData.update(now, dt);
  }
  if (starsRef && starsRef.userData && typeof starsRef.userData.update === 'function') {
    starsRef.userData.update(now, dt);
  }
}

// ── Biome transition burst particle system ──

function initTransitionBurst(scene) {
  const positions = new Float32Array(TRANSITION_BURST_COUNT * 3);
  transitionBurstGeo = new THREE.BufferGeometry();
  transitionBurstGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  const mat = new THREE.PointsMaterial({
    size: 0.3,
    transparent: true,
    opacity: 1.0,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    color: 0xffffff,
    sizeAttenuation: true,
  });
  transitionBurst = new THREE.Points(transitionBurstGeo, mat);
  transitionBurst.visible = false;
  transitionBurst.frustumCulled = false;
  scene.add(transitionBurst);
}

export function triggerTransitionBurst(playerPos, oldTheme, scene) {
  // Lazy init on first trigger (avoids const-before-init ordering issue)
  if (!transitionBurst && scene) initTransitionBurst(scene);
  if (!transitionBurst) return;
  const colorMap = {
    synthwave_valley: 0xff44cc,
    desert_night: 0x88aacc,
    alien_planet: 0x44ff88,
    hellscape_lava: 0xff4400,
  };
  transitionBurst.material.color.setHex(colorMap[oldTheme] || 0xffffff);
  const positions = transitionBurstGeo.attributes.position.array;
  for (let i = 0; i < TRANSITION_BURST_COUNT; i++) {
    const i3 = i * 3;
    positions[i3] = playerPos.x;
    positions[i3 + 1] = playerPos.y;
    positions[i3 + 2] = playerPos.z;
  }
  transitionBurstGeo.attributes.position.needsUpdate = true;
  transitionBurst.userData.velocities = new Float32Array(TRANSITION_BURST_COUNT * 3);
  for (let i = 0; i < TRANSITION_BURST_COUNT; i++) {
    const angle = (i / TRANSITION_BURST_COUNT) * Math.PI * 2;
    const i3 = i * 3;
    transitionBurst.userData.velocities[i3] = Math.cos(angle) * 8.0;
    transitionBurst.userData.velocities[i3 + 1] = 1.0 + Math.random() * 2.0;
    transitionBurst.userData.velocities[i3 + 2] = Math.sin(angle) * 8.0;
  }
  transitionBurst.visible = true;
  transitionBurst.material.opacity = 1.0;
  transitionBurstActive = true;
  transitionBurstAge = 0;
}

export function updateTransitionBurst(dt) {
  if (!transitionBurstActive) return;
  transitionBurstAge += dt;
  const t = transitionBurstAge / TRANSITION_BURST_DURATION;
  if (t >= 1.0) {
    transitionBurstActive = false;
    transitionBurst.visible = false;
    return;
  }
  const positions = transitionBurstGeo.attributes.position.array;
  const velocities = transitionBurst.userData.velocities;
  for (let i = 0; i < TRANSITION_BURST_COUNT; i++) {
    const i3 = i * 3;
    positions[i3] += velocities[i3] * dt;
    positions[i3 + 1] += velocities[i3 + 1] * dt;
    positions[i3 + 2] += velocities[i3 + 2] * dt;
    velocities[i3] *= 0.97;
    velocities[i3 + 2] *= 0.97;
  }
  transitionBurst.material.opacity = 1.0 - t * t;
  transitionBurst.material.size = 0.3 + t * 0.4;
  transitionBurstGeo.attributes.position.needsUpdate = true;
}

// ============================================================
//  THEME + STARFIELD
// ============================================================

// [CORE] Create initial game environment
// Base floor/sun/stars/lights REMOVED — all 4 biomes are custom scenes with hideBaseEnv:true
// Each biome provides its own terrain, sky, lighting, and atmosphere.
export function createEnvironment() {
  // No base environment needed — biomes provide everything
}

// [CORE] Create sparkling star particles
function createSparklingStars(theme) {
  // Dispose any existing stars to prevent scene leaks
  if (starsRef) {
    if (starsRef.parent) starsRef.parent.remove(starsRef);
    starsRef.geometry.dispose();
    starsRef.material.dispose();
    starsRef = null;
  }
  const count = theme.starCount || 800;
  // FIX: Stars should be on a dome/hemisphere, not a clumped box
  // Dome radius should be inside the sky sphere (2800 radius) so stars are visible
  const domeRadius = theme.starDomeRadius || 2200;  // Inside sky sphere (2800)
  const domeCenterY = theme.starDomeCenterY || 400;  // Raise center so dome covers horizon
  
  const positions = new Float32Array(count * 3);
  const phases = new Float32Array(count);
  
  for (let i = 0; i < count; i++) {
    const i3 = i * 3;
    
    // Hemisphere distribution: random point on upper hemisphere
    // Use spherical coordinates for even distribution
    // theta: 0 to 2*PI (around the dome)
    // phi: 0 to PI/2 (from top to horizon for hemisphere)
    const theta = Math.random() * Math.PI * 2;
    // Use cos(phi) distribution for even spacing on sphere surface
    // phi from 0 (top) to PI/2 (horizon)
    const phi = Math.acos(1.0 - Math.random() * 0.9);  // Slight bias toward horizon for visual interest
    
    const x = Math.sin(phi) * Math.cos(theta);
    const y = Math.cos(phi);  // y is up
    const z = Math.sin(phi) * Math.sin(theta);
    
    // Scale by radius and offset by center
    positions[i3] = x * domeRadius;
    positions[i3 + 1] = y * domeRadius + domeCenterY;
    positions[i3 + 2] = z * domeRadius;
    
    phases[i] = Math.random() * Math.PI * 2;
  }
  
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geo.setAttribute('aPhase', new THREE.BufferAttribute(phases, 1));
  const tint = new THREE.Color(theme.starColor || 0xff66cc);
  const mat = new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uColor: { value: tint },
      uPixelRatio: { value: Math.min(window.devicePixelRatio, 2) },
      uOpacity: { value: 1.0 }
    },
    vertexShader: `
      attribute float aPhase;
      uniform float uTime;
      uniform float uPixelRatio;
      varying float vTwinkle;
      void main() {
        vTwinkle = 0.5 + 0.5 * sin(uTime * 2.0 + aPhase);
        vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
        // FIX: Increased base size from 2.2 to 8.0 and distance scale from 200 to 800
        // Stars were ~0.2px at dome radius 2200, now ~3px minimum
        // 25% larger: 8.0→10.0, 2.0→2.5, 800→1000, 2.5→3.125
        float size = (10.0 * uPixelRatio + vTwinkle * 2.5) * (1000.0 / -mvPosition.z);
        gl_PointSize = max(size, 3.125);  // Minimum 3.125px for visibility
        gl_Position = projectionMatrix * mvPosition;
      }
    `,
    fragmentShader: `
      uniform vec3 uColor;
      uniform float uOpacity;
      varying float vTwinkle;
      void main() {
        float dist = length(gl_PointCoord - vec2(0.5));
        if (dist > 0.5) discard;
        float alpha = 1.0 - smoothstep(0.0, 0.5, dist);
        gl_FragColor = vec4(uColor * (0.7 + vTwinkle * 0.4), alpha * vTwinkle * uOpacity);
      }
    `,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending
  });
  const stars = new THREE.Points(geo, mat);
  stars.name = 'sparkling-stars';
  stars.renderOrder = 10;  // Render after skydome (-20) and sun (-3 to -1)
  stars.userData.update = (now) => {
    mat.uniforms.uTime.value = now * 0.001;
    // Sync material.opacity (set by fade system) to shader uniform
    mat.uniforms.uOpacity.value = mat.opacity;
  };
  _deps.scene.add(stars);
  starsRef = stars;
  registerFadeMaterial(starsRef.material);
  // NOTE: Do NOT set starsBiomeId here — applyThemeForLevel() owns that.
}

// [CORE] Create background stars
// createStars() REMOVED — base environment deleted, biomes provide their own stars
// rebuildStars() REMOVED — was for non-custom biomes only

// [CORE] Rebuild stars on biome change
function rebuildStars(theme, biomeId) {
  if (!_deps.scene) return;
  if (starsRef) {
    unregisterFadeMaterial(starsRef.material);
    disposeMesh(starsRef, true);
    starsRef = null;
  }
  // Biomes that create their own stars inside biomeSceneGroup don't need
  // global stars. Only synthwave_valley relies on the global starfield.
  if (theme.customScene && theme.customScene !== 'synthwave_valley') {
    return;
  }
  if (theme.customScene === 'synthwave_valley') {
    createSparklingStars(theme);
    return;
  }
  // Fallback (should never happen)
  console.warn('[stars] No customScene for theme:', theme?.name);
}

// [CORE] Apply theme and rebuild biome for a level
export function applyThemeForLevel(level) {
  const theme = getThemeForLevel(level);
  const biome = getBiomeForLevel(level);
  _log('[debug] applyThemeForLevel: level=', level, 'biome=', biome, 'theme=', theme?.name);
  if (!theme || !_deps.scene) return;

  currentTheme = theme;

  // Rebuild stars when biome changes
  const biomeId = getBiomeForLevel(level);
  if (biomeId !== starsBiomeId) {
    rebuildStars(theme, biomeId);
    starsBiomeId = biomeId;
  }

  // Rebuild biome scene + lighting for the level
  rebuildBiomeScene(biome, theme);
  applyBiomeLighting(biome);

  // Issue #206: recolor the threat-compass glow to match the new biome
  setThreatCompassTheme(biomeId);

  applyEnvironmentFade(environmentFade);
}

// [CORE] Rebuild biome scene through the biome-scenes module
// (state accessor object lets biome-scenes.js read/write our module state)
function rebuildBiomeScene(biomeId, theme) {
  // State object that the module can update
  const state = {
    get biomeSceneGroup() { return biomeSceneGroup; },
    set biomeSceneGroup(val) { biomeSceneGroup = val; },
    get biomeSceneBiome() { return biomeSceneBiome; },
    set biomeSceneBiome(val) { biomeSceneBiome = val; },
  };

  rebuildBiomeSceneModule({
    scene: _deps.scene,
    biomeId,
    theme,
    state,
    clearBiomeScene,
    registerFadeMaterial,
    cleanupLegacyShapeGeometry,
    assignBiomePlaneNames,
    refs: {
      floorMaterial,
      synthVisualRefs,
      getVisualTuning: _deps.getVisualTuning,
    },
    biomeTerrainMaterials,
  });
}

// Get physics floor Y for current biome (matches visual floor HUD height)
// [CORE] Get biome floor Y coordinate — all biome floors are normalized to
// world y=0, so this returns 0.0 (biomeSceneBiome kept for signature compat).
export function getBiomeFloorY() {
  return getBiomeFloorYModule(biomeSceneBiome, _deps.sceneYOffset);
}
