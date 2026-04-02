// ============================================================
//  BIOME SCENES — Custom visual scene builders for biomes
//  Extracted from main.js for modular architecture
// ============================================================

import * as THREE from 'three';
import { buildDesertNightScene } from './biomes/desert-night.js';
import { buildAlienPlanetScene } from './biomes/alien-planet.js';
import { buildHellscapeLavaScene } from './biomes/hellscape-lava.js';

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

// ── Scene Builders ──────────────────────────────────────────
// Note: Synthwave remains inline for now (kept as-is for stability)

function buildSynthwaveValleyScene(group, deps) {
  const { registerFadeMaterial, floorMaterial, synthVisualRefs, biomeTerrainMaterials, getVisualTuning } = deps;
  
  const floorHeight = (floorMaterial && floorMaterial.userData && floorMaterial.userData.floorHeight) || -0.01;
  const floorY = floorHeight;

  // Reset synth visual tuning refs each time this biome scene is rebuilt.
  synthVisualRefs.terrainUniforms = null;
  synthVisualRefs.sunOuterGlowMat = null;
  synthVisualRefs.sunGlowMat = null;
  synthVisualRefs.sunCoreMat = null;

  // Fix for synthwave valley lighting regression: the extracted scene lost the
  // original standalone scene's punch after we removed postprocessing, so raise
  // the local material brightness without affecting other biomes.
  const brightness = 1.0;

  // Sky dome (no stars, we use global starfield)
  // EXACT colors: Horizon #FE9053 (orange) → Mountain tips #E00186 (pink) → Sun top #2C0051 (purple) → Top #1A004A (dark purple) → Black
  const skyGeo = new THREE.SphereGeometry(2800, 32, 24);
  const skyMat = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    uniforms: {
      topColor: { value: new THREE.Color(0x1A004A) },      // Top: dark purple
      midColor: { value: new THREE.Color(0x71006E) },      // 75% from equator: deep purple
      horizonColor: { value: new THREE.Color(0xFF8626) },  // Equator: bright orange
      glowColor: { value: new THREE.Color(0xF30787) },     // 40% from equator: pink
    },
    // VR-CRITICAL: Use the standard modelViewMatrix path so the sky remains
    // stable in stereo rendering and does not rely on manual clip-space math.
    vertexShader: `varying vec3 vWorldPosition; void main(){ vec4 worldPosition=modelMatrix*vec4(position,1.0); vWorldPosition=worldPosition.xyz; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }`,
    fragmentShader: `varying vec3 vWorldPosition; uniform vec3 topColor; uniform vec3 midColor; uniform vec3 horizonColor; uniform vec3 glowColor; void main(){ float worldY=vWorldPosition.y; float t1=smoothstep(0.0,550.0,worldY); float t2=smoothstep(0.0,950.0,worldY); float t3=smoothstep(0.0,1400.0,worldY); vec3 col=horizonColor; col=mix(col,glowColor,t1); col=mix(col,midColor,t2); col=mix(col,topColor,t3); col=pow(col,vec3(1.0/2.2)); gl_FragColor=vec4(col*${brightness.toFixed(2)},1.0); }`,
    depthWrite: false,
  });
  const sky = new THREE.Mesh(skyGeo, skyMat);
  sky.frustumCulled = false;
  sky.renderOrder = -20;  // Draw before sun (which is at -3 to -1)
  group.add(sky);
  registerFadeMaterial(skyMat);

  // Terrain - EXACT colors: Gridlines #015CC1 (bright blue), Between gridlines #0C0E3E (dark blue)
  // PERFORMANCE FIX: Reduced from 240x240 (57,600 vertices) to 120x120 (14,400 vertices) for 75% reduction
  // Still provides good visual quality while improving FPS at level start
  const terrainUniforms = {
    uGridColor: { value: new THREE.Color(0x4368AC) },     // Gridlines
    uBaseColor: { value: new THREE.Color(0x0C1347) },     // Primary/base color
    uFogColor: { value: new THREE.Color(0x2C0051) },      // EXACT: Sun top purple fog
    uPulseColorA: { value: new THREE.Color(0xF30787) },   // Pink phase for grid and mountain-edge pulse
    uPulseColorB: { value: new THREE.Color(0x00D9FF) },   // Blue phase for grid and mountain-edge pulse
    uFlashIntensity: { value: 0.0 },
    uGlowIntensity: { value: getVisualTuning().glowStrength },
    uFogIntensity: { value: getVisualTuning().fogIntensity },
    uTime: { value: 0.0 },
  };
  const terrainGeo = new THREE.PlaneGeometry(2000, 2000, 240, 240);
  terrainGeo.rotateX(-Math.PI / 2);
  const terrainMat = new THREE.ShaderMaterial({
    uniforms: terrainUniforms,
    side: THREE.DoubleSide,
    depthWrite: true,
    depthTest: true,
    polygonOffset: true,
    polygonOffsetFactor: 2.0,
    polygonOffsetUnits: 8.0,
    // Fix for synthwave floor popping in VR: keep the terrain static and use the
    // built-in modelViewMatrix projection instead of manual projection math.
    vertexShader: `varying vec3 vWorldPos; varying vec3 vObjPos; varying float vHeight; varying float vFogDistance; vec2 hash2(vec2 p){ p=vec2(dot(p, vec2(127.1,311.7)), dot(p, vec2(269.5,183.3))); return -1.0+2.0*fract(sin(p)*43758.5453123);} float noise(in vec2 p){ vec2 i=floor(p); vec2 f=fract(p); vec2 u=f*f*(3.0-2.0*f); return mix(mix(dot(hash2(i+vec2(0.0,0.0)), f-vec2(0.0,0.0)), dot(hash2(i+vec2(1.0,0.0)), f-vec2(1.0,0.0)), u.x), mix(dot(hash2(i+vec2(0.0,1.0)), f-vec2(0.0,1.0)), dot(hash2(i+vec2(1.0,1.0)), f-vec2(1.0,1.0)), u.x), u.y);} float fbm(vec2 p){ float value=0.0; float amp=0.5; for(int i=0;i<5;i++){ value+=amp*noise(p); p*=2.0; amp*=0.5;} return value;} float ridgeNoise(vec2 p){ float sum=0.0; float amp=0.55; for(int i=0;i<5;i++){ float n=noise(p); n=1.0-abs(n); n*=n; sum+=n*amp; p*=2.15; amp*=0.5;} return sum;} void main(){ vec3 pos=position; vec2 p=pos.xz; float valleyMask=smoothstep(0.0,1.0, clamp(abs(pos.x)/240.0,0.0,1.0)); float broad=fbm(p*vec2(0.0035,0.0024))*16.0; float detail=fbm(p*vec2(0.012,0.01))*5.0; float ridges=ridgeNoise((p+vec2(0.0,-260.0))*0.008)*180.0; float mountainMask=pow(valleyMask,1.55); float centerDip=-10.0*(1.0-valleyMask); float distanceFade=smoothstep(750.0,120.0, abs(pos.z+120.0)); float h=broad+detail+centerDip; h+=ridges*mountainMask*distanceFade; if(pos.z>700.0){ h*=smoothstep(1000.0,700.0,pos.z);} pos.y=h; vec4 world=modelMatrix*vec4(pos,1.0); vec4 mvPosition=modelViewMatrix*vec4(pos,1.0); vWorldPos=world.xyz; vObjPos=pos; vHeight=h; vFogDistance=length(mvPosition.xyz); gl_Position=projectionMatrix*mvPosition; }`,
    // Drive a color wave through both the grid and ridge highlights without moving geometry.
    fragmentShader: `uniform vec3 uGridColor; uniform vec3 uBaseColor; uniform vec3 uFogColor; uniform vec3 uPulseColorA; uniform vec3 uPulseColorB; uniform float uFlashIntensity; uniform float uGlowIntensity; uniform float uFogIntensity; uniform float uTime; varying vec3 vWorldPos; varying vec3 vObjPos; varying float vHeight; varying float vFogDistance; float gridLine(float coord,float width){ float g=abs(fract(coord-0.5)-0.5)/fwidth(coord); return 1.0-smoothstep(width,width+1.0,g);} void main(){ float gridScale=1.0/6.0; float dist=length(vObjPos.xz); float lineW=0.25*smoothstep(1000.0,100.0,dist); float gx=gridLine(vObjPos.x*gridScale,lineW); float gz=gridLine(vObjPos.z*gridScale,lineW); float grid=max(gx,gz); float glowPath=exp(-abs(vObjPos.x)*0.014)*smoothstep(350.0,-150.0,vObjPos.z); grid=max(grid, glowPath*0.34*uGlowIntensity); float wave=0.5+0.5*sin(uTime*1.8 + vObjPos.x*0.018 + vObjPos.z*0.012); vec3 pulseColor=mix(uPulseColorA, uPulseColorB, wave); vec3 animatedGridColor=mix(uGridColor, pulseColor, 0.7); vec3 col=mix(uBaseColor, animatedGridColor, clamp(grid*uGlowIntensity,0.0,1.0)); float ridgeGlow=smoothstep(48.0,160.0,vHeight)*smoothstep(100.0,350.0,abs(vObjPos.x)); col+=pulseColor*ridgeGlow*0.22*uGlowIntensity; float fogAmount=1.0-exp(-0.0000012*vFogDistance*vFogDistance); col=mix(col,uFogColor, clamp(fogAmount*uFogIntensity,0.0,1.0)); vec3 flashColor=vec3(1.0,0.0,0.0); col=mix(col,flashColor,uFlashIntensity); gl_FragColor=vec4(col*${brightness.toFixed(2)},1.0); }`,
  });
  const terrain = new THREE.Mesh(terrainGeo, terrainMat);
  terrain.name = 'synthwave-valley-floor-and-mountains';
  terrain.userData.planeName = 'synthwave-valley-floor-and-mountains';
  terrain.position.set(0, floorY + 1.5, -700);
  terrain.frustumCulled = false;
  group.add(terrain);
  registerFadeMaterial(terrainMat);
  // Store terrain material for damage flash
  biomeTerrainMaterials.push({ type: 'shader', material: terrainMat });

  synthVisualRefs.terrainUniforms = terrainUniforms;

  // Sun + glow - flat planes (no billboard), using retro synthwave PNG
  const sunGroup = new THREE.Group();
  sunGroup.name = 'synthwave-sun-group';
  sunGroup.position.set(0, 270, -1700);  // Y raised so full circle is above horizon
  group.add(sunGroup);

  const makeRadial = (inner, outer) => {
    const c = document.createElement('canvas');
    c.width = 512; c.height = 512;
    const ctx = c.getContext('2d');
    const g = ctx.createRadialGradient(256,256,0,256,256,256);
    g.addColorStop(0.0, inner);
    g.addColorStop(0.35, inner);
    g.addColorStop(0.6, outer);
    g.addColorStop(1.0, 'rgba(255,102,204,0)');
    ctx.fillStyle = g; ctx.fillRect(0,0,512,512);
    return new THREE.CanvasTexture(c);
  };

  const sunGlowTex = makeRadial('rgba(255,255,255,1.0)', 'rgba(254,151,83,0.85)');
  const sunOuterGlowTex = makeRadial('rgba(254,151,83,0.9)', 'rgba(224,1,134,0.3)');

  // Outer massive glow (flat plane, no billboard, fog-proof, no depth test)
  // Pull the outer glow down by roughly two thirds so the disc and skyline stay legible.
  const sunOuterGlowMat = new THREE.MeshBasicMaterial({ map: sunOuterGlowTex, color: 0xffffff, transparent: true, opacity: 0.32, depthWrite: false, depthTest: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, fog: false });
  const sunOuterGlow = new THREE.Mesh(new THREE.PlaneGeometry(875, 875), sunOuterGlowMat); // 10% smaller again (81% of original)
  sunOuterGlow.name = 'synthwave-sun-outer-glow';
  sunOuterGlow.userData.planeName = 'synthwave-sun-outer-glow';
  sunOuterGlow.frustumCulled = false;
  sunOuterGlow.renderOrder = -3;
  sunGroup.add(sunOuterGlow);
  registerFadeMaterial(sunOuterGlowMat);
  synthVisualRefs.sunOuterGlowMat = sunOuterGlowMat;

  // Main bright glow (fog-proof, no depth test)
  const sunGlowMat = new THREE.MeshBasicMaterial({ map: sunGlowTex, color: 0xffffff, transparent: true, opacity: 1.0, depthWrite: false, depthTest: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, fog: false });
  const sunGlow = new THREE.Mesh(new THREE.PlaneGeometry(700, 700), sunGlowMat); // 10% smaller again (81% of original)
  sunGlow.name = 'synthwave-sun-main-glow';
  sunGlow.userData.planeName = 'synthwave-sun-main-glow';
  sunGlow.frustumCulled = false;
  sunGlow.renderOrder = -2;
  sunGroup.add(sunGlow);
  registerFadeMaterial(sunGlowMat);
  synthVisualRefs.sunGlowMat = sunGlowMat;

  // Retro synthwave sun disc from PNG (flat plane, no billboard)
  // PNG has white background - process to make white pixels transparent
  const sunDiscTex = new THREE.TextureLoader().load('assets/sun-retro.png');
  const sunCoreMat = new THREE.MeshBasicMaterial({ map: sunDiscTex, color: 0xffffff, transparent: true, depthWrite: false, depthTest: false, side: THREE.DoubleSide, fog: false });
  // Process: load PNG, threshold white pixels to transparent, replace material map
  const sunDiscImg = new Image();
  sunDiscImg.crossOrigin = 'anonymous';
  sunDiscImg.onload = () => {
    const c = document.createElement('canvas');
    c.width = sunDiscImg.width;
    c.height = sunDiscImg.height;
    const ctx = c.getContext('2d');
    ctx.drawImage(sunDiscImg, 0, 0);
    const id = ctx.getImageData(0, 0, c.width, c.height);
    const d = id.data;
    for (let i = 0; i < d.length; i += 4) {
      if ((d[i] + d[i+1] + d[i+2]) / 3 > 240) d[i+3] = 0;
    }
    ctx.putImageData(id, 0, 0);
    if (sunCoreMat.map) sunCoreMat.map.dispose();
    sunCoreMat.map = new THREE.CanvasTexture(c);
    sunCoreMat.map.needsUpdate = true;
    sunCoreMat.needsUpdate = true;
  };
  sunDiscImg.src = 'assets/sun-retro.png';
  const sunCore = new THREE.Mesh(new THREE.PlaneGeometry(466, 466), sunCoreMat); // 10% smaller again (81% of original)
  sunCore.name = 'synthwave-sun-core-disc';
  sunCore.userData.planeName = 'synthwave-sun-core-disc';
  sunCore.frustumCulled = false;
  sunCore.renderOrder = -1;
  sunGroup.add(sunCore);
  registerFadeMaterial(sunCoreMat);
  synthVisualRefs.sunCoreMat = sunCoreMat;

  // Log cylinder colors for debugging
  // logCylinderColors(refs); // Disabled - only for debugging

  // Keep geometry static for VR comfort while still animating shader color via one uniform update.
  group.userData.update = (now) => {
    terrainUniforms.uTime.value = now * 0.001;
  };

  // Synthwave floor HUD height: group.position.y = 5.82
  group.position.set(0, 5.82, 0);

  // Rotate so player faces sun
  group.rotation.y = 0;
}
