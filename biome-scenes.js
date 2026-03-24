// ============================================================
//  BIOME SCENES — Custom visual scene builders for biomes
//  Extracted from main.js for modular architecture
// ============================================================

import * as THREE from 'three';

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
    BLOOM_LAYER: refs.BLOOM_LAYER,
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

function buildSynthwaveValleyScene(group, deps) {
  const { registerFadeMaterial, floorMaterial, synthVisualRefs, biomeTerrainMaterials, BLOOM_LAYER, getVisualTuning } = deps;
  
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
    uFlashIntensity: { value: 0.0 },
    uGlowIntensity: { value: getVisualTuning().glowStrength },
    uFogIntensity: { value: getVisualTuning().fogIntensity },
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
    fragmentShader: `uniform vec3 uGridColor; uniform vec3 uBaseColor; uniform vec3 uFogColor; uniform float uFlashIntensity; uniform float uGlowIntensity; uniform float uFogIntensity; varying vec3 vWorldPos; varying vec3 vObjPos; varying float vHeight; varying float vFogDistance; float gridLine(float coord,float width){ float g=abs(fract(coord-0.5)-0.5)/fwidth(coord); return 1.0-smoothstep(width,width+1.0,g);} void main(){ float gridScale=1.0/6.0; float dist=length(vObjPos.xz); float lineW=0.25*smoothstep(1000.0,100.0,dist); float gx=gridLine(vObjPos.x*gridScale,lineW); float gz=gridLine(vObjPos.z*gridScale,lineW); float grid=max(gx,gz); float glowPath=exp(-abs(vObjPos.x)*0.014)*smoothstep(350.0,-150.0,vObjPos.z); grid=max(grid, glowPath*0.34*uGlowIntensity); vec3 col=mix(uBaseColor, uGridColor, clamp(grid*uGlowIntensity,0.0,1.0)); float ridgeGlow=smoothstep(48.0,160.0,vHeight)*smoothstep(100.0,350.0,abs(vObjPos.x)); col+=uGridColor*ridgeGlow*0.18*uGlowIntensity; float fogAmount=1.0-exp(-0.0000012*vFogDistance*vFogDistance); col=mix(col,uFogColor, clamp(fogAmount*uFogIntensity,0.0,1.0)); vec3 flashColor=vec3(1.0,0.0,0.0); col=mix(col,flashColor,uFlashIntensity); gl_FragColor=vec4(col*${brightness.toFixed(2)},1.0); }`,
  });
  const terrain = new THREE.Mesh(terrainGeo, terrainMat);
  terrain.name = 'synthwave-valley-floor-and-mountains';
  terrain.userData.planeName = 'synthwave-valley-floor-and-mountains';
  terrain.position.set(0, floorY + 1.5, -700);
  terrain.frustumCulled = false;
  terrain.layers.enable(BLOOM_LAYER);  // Selective bloom: floor grid glows
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
  const sunOuterGlowMat = new THREE.MeshBasicMaterial({ map: sunOuterGlowTex, color: 0xffffff, transparent: true, opacity: 1.0, depthWrite: false, depthTest: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, fog: false });
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

  // Fix for synthwave valley "jiggle": keep the imported scene static in-game.
  // The standalone HTML used perpetual scrolling and pulsing, but the game
  // version should behave like a stable biome backdrop.
  group.userData.update = null;

  // Synthwave floor HUD height: group.position.y = 5.82
  group.position.set(0, 5.82, 0);

  // Rotate so player faces sun
  group.rotation.y = 0;
}

function buildDesertNightScene(group, deps) {
  const { registerFadeMaterial, floorMaterial, biomeTerrainMaterials } = deps;
  
  const floorHeight = (floorMaterial && floorMaterial.userData && floorMaterial.userData.floorHeight) || -0.01;
  const floorY = floorHeight;
  const sceneColor = 0x06080c;

  // === LIGHTING (CRITICAL) ===
  // Pale moonlight
  const moonLight = new THREE.DirectionalLight(0xd4e5f7, 2.34);
  moonLight.position.set(-30, 50, -30);
  group.add(moonLight);

  // Point light for long moon-like shadows from cacti
  const shadowLight = new THREE.PointLight(0xd4e5f7, 1.5, 100);
  shadowLight.position.set(-45, 35, -60); // Same as moon position
  shadowLight.castShadow = true;
  shadowLight.shadow.mapSize.width = 1024;
  shadowLight.shadow.mapSize.height = 1024;
  shadowLight.shadow.camera.near = 10;
  shadowLight.shadow.camera.far = 100;
  group.add(shadowLight);

  // Very dim ambient
  const ambientLight = new THREE.AmbientLight(0x1a2035, 0.15);
  group.add(ambientLight);

  // Hemisphere light for sky/ground color
  const hemiLight = new THREE.HemisphereLight(0x1a2035, 0x2d1f1a, 0.2);
  group.add(hemiLight);

  // Ground
  const geometry = new THREE.PlaneGeometry(140, 140, 70, 70);
  geometry.rotateX(-Math.PI / 2);
  const positions = geometry.attributes.position;
  const colors = [];
  const flatRadius = 12.0;
  const mountainStart = 18.0;
  for (let i = 0; i < positions.count; i++) {
    const x = positions.getX(i);
    const z = positions.getZ(i);
    const dist = Math.sqrt(x * x + z * z);
    let heightFactor = Math.min(Math.max((dist - flatRadius) / (mountainStart - flatRadius), 0), 1);
    heightFactor = heightFactor * heightFactor * (3 - 2 * heightFactor);
    let height = 0;
    height += Math.sin(x * 0.08 + 0.5) * Math.cos(z * 0.06) * 4.0;
    height += Math.sin(x * 0.04 + 2) * Math.sin(z * 0.05 + 1) * 3.0;
    height += Math.sin(x * 0.15 + z * 0.1) * 1.5;
    height += Math.cos(z * 0.12 - x * 0.08) * 1.0;
    height += Math.sin(x * 0.3) * Math.cos(z * 0.25) * 0.5;
    if (dist > mountainStart) {
      height += Math.sin(x * 0.4 + z * 0.3) * 2.0;
      height += Math.cos(x * 0.2 - z * 0.5) * 2.5;
    }
    const finalHeight = height * heightFactor;
    positions.setY(i, finalHeight);
    const heightNorm = (finalHeight + 5) / 15;
    const baseColor = new THREE.Color(0x2a241b);
    const highlightColor = new THREE.Color(0x585144);
    const moonTint = new THREE.Color(0x404a5a);
    let color = baseColor.clone().lerp(highlightColor, Math.max(0, Math.min(1, heightNorm)));
    color.lerp(moonTint, heightNorm * 0.2);
    colors.push(color.r, color.g, color.b);
  }
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geometry.computeVertexNormals();
  const material = new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true });
  const terrain = new THREE.Mesh(geometry, material);
  terrain.name = 'desert-night-terrain';
  terrain.userData.planeName = 'desert-night-terrain';
  terrain.position.y = floorY;
  terrain.frustumCulled = false;
  terrain.receiveShadow = true;  // Sand dunes receive cactus shadows
  group.add(terrain);
  registerFadeMaterial(material);

  // Flash overlay plane for damage feedback (entire sand floor turns red)
  const flashGeo = new THREE.PlaneGeometry(140, 140);
  const flashMat = new THREE.MeshBasicMaterial({
    color: 0xff0000,
    transparent: true,
    opacity: 0,
    depthWrite: false,
    side: THREE.DoubleSide
  });
  const flashPlane = new THREE.Mesh(flashGeo, flashMat);
  flashPlane.name = 'desert-night-damage-flash-plane';
  flashPlane.userData.planeName = 'desert-night-damage-flash-plane';
  flashPlane.rotation.x = -Math.PI / 2;
  flashPlane.position.y = floorY + 0.02; // Very close to terrain surface
  flashPlane.frustumCulled = false;
  group.add(flashPlane);
  biomeTerrainMaterials.push({ type: 'overlay', material: flashMat });

  // === CACTUSES (9 procedural) ===
  const createCactus = (height) => {
    const cactusGroup = new THREE.Group();
    const bodyColor = 0x1a3d20;
    const armColor = 0x2d5535;
    const segments = 3 + Math.floor(Math.random() * 2); // 3-4 segments
    let currentY = 0;
    const segmentHeight = height / segments;

    // Main body segments
    for (let i = 0; i < segments; i++) {
      const radius = 0.12 + (segments - i) * 0.03; // Taper upward
      const segGeo = new THREE.CylinderGeometry(radius * 0.9, radius, segmentHeight, 5);
      const segMat = new THREE.MeshLambertMaterial({ color: bodyColor, flatShading: true });
      const segment = new THREE.Mesh(segGeo, segMat);
      segment.position.y = currentY + segmentHeight / 2;
      segment.castShadow = true;  // Cacti cast shadows
      segment.receiveShadow = true;
      cactusGroup.add(segment);
      currentY += segmentHeight;
    }

    // Random arms (0-2)
    const numArms = Math.floor(Math.random() * 3);
    for (let a = 0; a < numArms; a++) {
      const armY = segmentHeight * (1 + Math.floor(Math.random() * (segments - 1)));
      const side = Math.random() > 0.5 ? 1 : -1;
      const armLength = 0.4 + Math.random() * 0.4;

      // Horizontal part
      const hArmGeo = new THREE.CylinderGeometry(0.08, 0.1, armLength, 5);
      const hArmMat = new THREE.MeshLambertMaterial({ color: armColor, flatShading: true });
      const hArm = new THREE.Mesh(hArmGeo, hArmMat);
      hArm.castShadow = true;
      hArm.receiveShadow = true;
      hArm.rotation.z = Math.PI / 2;
      hArm.position.set(side * armLength / 2, armY, 0);
      cactusGroup.add(hArm);

      // Vertical part (upward)
      const vArmHeight = 0.5 + Math.random() * 0.5;
      const vArmGeo = new THREE.CylinderGeometry(0.06, 0.08, vArmHeight, 5);
      const vArmMat = new THREE.MeshLambertMaterial({ color: armColor, flatShading: true });
      const vArm = new THREE.Mesh(vArmGeo, vArmMat);
      vArm.castShadow = true;
      vArm.receiveShadow = true;
      vArm.position.set(side * armLength, armY + vArmHeight / 2, 0);
      cactusGroup.add(vArm);
    }

    // REMOVED: Fake circle shadow - now using point light for realistic moon shadows
    // Cacti will cast natural shadows from the shadowLight

    return cactusGroup;
  };

  const cactusPositions = [
    { x: 6, z: 4, h: 2.5 },
    { x: -4, z: 6, h: 3 },
    { x: 8, z: -3, h: 2 },
    { x: -7, z: -5, h: 2.8 },
    { x: 3, z: -8, h: 1.8 },
    { x: -10, z: 1, h: 2.2 },
    { x: 0, z: 10, h: 2.3 },
    // Removed cactus at {x: 5, z: 9, h: 1.9} - player now spawns there
    { x: -5, z: -9, h: 2.4 },
  ];

  cactusPositions.forEach(pos => {
    const cactus = createCactus(pos.h);
    cactus.position.set(pos.x, floorY, pos.z);
    cactus.rotation.y = Math.random() * Math.PI * 2;
    group.add(cactus);
  });

  // === TWINKLING STARS (400 particles - reduced from 800 for performance) ===
  const starCount = 400;
  const starPositions = new Float32Array(starCount * 3);
  const starPhases = new Float32Array(starCount);

  for (let i = 0; i < starCount; i++) {
    // Hemisphere distribution
    const theta = Math.random() * Math.PI * 2;
    const radius = 80 + Math.random() * 40; // 80-120
    const phi = Math.random() * Math.PI * 0.5; // Upper hemisphere

    starPositions[i * 3] = Math.cos(theta) * Math.sin(phi) * radius;
    starPositions[i * 3 + 1] = Math.cos(phi) * radius + 10; // Offset up
    starPositions[i * 3 + 2] = Math.sin(theta) * Math.sin(phi) * radius;
    starPhases[i] = Math.random() * Math.PI * 2;
  }

  const starGeometry = new THREE.BufferGeometry();
  starGeometry.setAttribute('position', new THREE.BufferAttribute(starPositions, 3));
  starGeometry.setAttribute('aPhase', new THREE.BufferAttribute(starPhases, 1));

  const starMaterial = new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uPixelRatio: { value: Math.min(window.devicePixelRatio, 2) }
    },
    vertexShader: `
      attribute float aPhase;
      uniform float uTime;
      uniform float uPixelRatio;
      varying float vTwinkle;
      void main() {
        vTwinkle = 0.5 + 0.5 * sin(uTime * 2.0 + aPhase);
        vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
        float size = 2.0 * uPixelRatio * vTwinkle;
        gl_PointSize = size * (200.0 / -mvPosition.z);
        gl_Position = projectionMatrix * mvPosition;
      }
    `,
    fragmentShader: `
      varying float vTwinkle;
      void main() {
        float dist = length(gl_PointCoord - vec2(0.5));
        if (dist > 0.5) discard;
        float alpha = 1.0 - smoothstep(0.0, 0.5, dist);
        vec3 color = mix(vec3(0.8, 0.85, 1.0), vec3(1.0, 0.95, 0.9), vTwinkle);
        gl_FragColor = vec4(color * (0.7 + vTwinkle * 0.3), alpha * vTwinkle);
      }
    `,
    transparent: true,
    depthWrite: false,
    fog: false,
    blending: THREE.AdditiveBlending
  });

  const stars = new THREE.Points(starGeometry, starMaterial);
  stars.frustumCulled = false; // Fix disappearing when looking up
  stars.renderOrder = 999;
  group.add(stars);
  registerFadeMaterial(starMaterial);

  // === DUST PARTICLES (300 particles - reduced from 600 for performance) ===
  const dustCount = 300;
  const dustPositions = new Float32Array(dustCount * 3);
  const dustPhases = new Float32Array(dustCount);

  for (let i = 0; i < dustCount; i++) {
    dustPositions[i * 3] = (Math.random() - 0.5) * 60;
    dustPositions[i * 3 + 1] = Math.random() * 15 + floorY;
    dustPositions[i * 3 + 2] = (Math.random() - 0.5) * 60;
    dustPhases[i] = Math.random() * Math.PI * 2;
  }

  const dustGeometry = new THREE.BufferGeometry();
  dustGeometry.setAttribute('position', new THREE.BufferAttribute(dustPositions, 3));
  dustGeometry.setAttribute('aPhase', new THREE.BufferAttribute(dustPhases, 1));

  const dustMaterial = new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uPixelRatio: { value: Math.min(window.devicePixelRatio, 2) }
    },
    vertexShader: `
      attribute float aPhase;
      uniform float uTime;
      uniform float uPixelRatio;
      varying float vAlpha;
      void main() {
        vAlpha = 0.5 + 0.3 * sin(uTime + aPhase);
        vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
        gl_PointSize = 4.0 * uPixelRatio;
        gl_Position = projectionMatrix * mvPosition;
      }
    `,
    fragmentShader: `
      varying float vAlpha;
      void main() {
        float dist = length(gl_PointCoord - vec2(0.5));
        if (dist > 0.5) discard;
        float alpha = (1.0 - smoothstep(0.0, 0.5, dist)) * vAlpha * 1.2;
        vec3 dustColor = vec3(0.8, 0.85, 0.9);
        gl_FragColor = vec4(dustColor, alpha);
      }
    `,
    transparent: true,
    depthWrite: false,
    fog: false,
    blending: THREE.AdditiveBlending
  });

  const dust = new THREE.Points(dustGeometry, dustMaterial);
  dust.renderOrder = 999;
  group.add(dust);
  registerFadeMaterial(dustMaterial);

  // Moon
  const moonGroup = new THREE.Group();
  const moonGeometry = new THREE.IcosahedronGeometry(8, 2);
  const moonMaterial = new THREE.MeshBasicMaterial({ color: 0xfffef8 });
  const moon = new THREE.Mesh(moonGeometry, moonMaterial);
  moonGroup.add(moon);
  registerFadeMaterial(moonMaterial);
  const innerGlowMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.25 });
  const innerGlow = new THREE.Mesh(new THREE.IcosahedronGeometry(9.5, 2), innerGlowMat);
  const outerGlowMat = new THREE.MeshBasicMaterial({ color: 0xd4e5f7, transparent: true, opacity: 0.12 });
  const outerGlow = new THREE.Mesh(new THREE.IcosahedronGeometry(13, 2), outerGlowMat);
  const farGlowMat = new THREE.MeshBasicMaterial({ color: 0xaaccff, transparent: true, opacity: 0.06 });
  const farGlow = new THREE.Mesh(new THREE.IcosahedronGeometry(18, 2), farGlowMat);
  moonGroup.add(innerGlow, outerGlow, farGlow);
  registerFadeMaterial(innerGlowMat);
  registerFadeMaterial(outerGlowMat);
  registerFadeMaterial(farGlowMat);
  moonGroup.position.set(-45, 35, -60);
  group.add(moonGroup);

  // Desert floor HUD height: Y = -0.20, rotated 25 degrees (-0.436 rad)
  group.rotation.y = -0.436; // yaw: -25 degrees
  group.position.set(-2.12, -0.20, -4.82);  // Moved 5 units +X and +Z

  // Frame counter for throttling dust particle updates (Issue 4: reduce CPU cost)
  let desertFrameCount = 0;

  // === ANIMATION UPDATE ===
  group.userData.update = (now, dt) => {
    const time = now * 0.001;
    // Update stars twinkle (shader-based, already efficient)
    starMaterial.uniforms.uTime.value = time;
    // Update dust shader time
    dustMaterial.uniforms.uTime.value = time;

    // Throttle dust particle position updates to every 5th frame (Issue 4: reduce CPU cost)
    desertFrameCount++;
    if (desertFrameCount % 5 === 0) {
      const dustPos = dustGeometry.attributes.position.array;
      for (let i = 0; i < dustCount; i++) {
        const idx = i * 3;
        // Gentle wind drift (scaled by 5 since we only update every 5th frame)
        dustPos[idx] += 0.025 * dt;
        dustPos[idx + 1] += Math.sin(time + dustPhases[i]) * 0.005 * dt;
        dustPos[idx + 2] += Math.cos(time * 0.7 + dustPhases[i]) * 0.01 * dt;

        // Wrap around boundaries
        if (dustPos[idx] > 30) dustPos[idx] = -30;
        if (dustPos[idx] < -30) dustPos[idx] = 30;
        if (dustPos[idx + 1] > floorY + 15) dustPos[idx + 1] = floorY;
        if (dustPos[idx + 1] < floorY) dustPos[idx + 1] = floorY + 15;
        if (dustPos[idx + 2] > 30) dustPos[idx + 2] = -30;
        if (dustPos[idx + 2] < -30) dustPos[idx + 2] = 30;
      }
      dustGeometry.attributes.position.needsUpdate = true;
    }
  };
}

function buildAlienPlanetScene(group, deps) {
  const { registerFadeMaterial, floorMaterial, biomeTerrainMaterials } = deps;
  
  const floorHeight = (floorMaterial && floorMaterial.userData && floorMaterial.userData.floorHeight) || -0.01;
  const floorY = floorHeight - 0.3; // Move everything down 0.3 units to fix floor HUD being under floor

  // Ground
  const groundGeo = new THREE.PlaneGeometry(300, 300, 84, 84);
  const groundPositions = groundGeo.attributes.position;
  for (let i = 0; i < groundPositions.count; i++) {
    const x = groundPositions.getX(i);
    const y = groundPositions.getY(i);
    groundPositions.setZ(i, Math.sin(x * 0.03) * Math.cos(y * 0.03) * 0.3);
  }
  groundGeo.computeVertexNormals();
  const groundMat = new THREE.MeshStandardMaterial({ color: 0x0a0510, roughness: 1, metalness: 0, flatShading: true });
  const ground = new THREE.Mesh(groundGeo, groundMat);
  ground.name = 'alien-planet-ground-plane';
  ground.userData.planeName = 'alien-planet-ground-plane';
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = floorY;
  ground.frustumCulled = false;
  group.add(ground);

  // Flash overlay plane for damage feedback (Issue 2: 320x320 for full floor coverage)
  const flashGeo = new THREE.PlaneGeometry(320, 320);
  const flashMat = new THREE.MeshBasicMaterial({
    color: 0xff0000,
    transparent: true,
    opacity: 0,
    depthWrite: false,
    side: THREE.DoubleSide
  });
  const flashPlane = new THREE.Mesh(flashGeo, flashMat);
  flashPlane.name = 'alien-planet-damage-flash-plane';
  flashPlane.userData.planeName = 'alien-planet-damage-flash-plane';
  flashPlane.rotation.x = -Math.PI / 2;
  flashPlane.position.y = floorY + 0.1;
  flashPlane.frustumCulled = false;
  group.add(flashPlane);
  biomeTerrainMaterials.push({ type: 'overlay', material: flashMat });

  // Moon and glow
  const moonGeo = new THREE.IcosahedronGeometry(24, 1);
  const moonMat = new THREE.MeshBasicMaterial({ color: 0xddaaff, transparent: true, opacity: 0.95 });
  const moon = new THREE.Mesh(moonGeo, moonMat);
  moon.position.set(60, 80, -40);
  moon.frustumCulled = false; // Fix disappearing when looking up
  group.add(moon);
  const moonGlowGeo = new THREE.IcosahedronGeometry(36, 1);
  const moonGlowMat = new THREE.MeshBasicMaterial({ color: 0xaa66ff, transparent: true, opacity: 0.15, side: THREE.BackSide });
  const moonGlow = new THREE.Mesh(moonGlowGeo, moonGlowMat);
  moonGlow.position.copy(moon.position);
  moonGlow.frustumCulled = false; // Fix disappearing when looking up
  group.add(moonGlow);
  registerFadeMaterial(moonMat);
  registerFadeMaterial(moonGlowMat);

  // Floating crystals (5)
  const crystalGeo = new THREE.OctahedronGeometry(1.2, 0);
  const crystalMat = new THREE.MeshBasicMaterial({ color: 0xff00ff, transparent: true, opacity: 0.8 });
  const crystalPositions = [
    { x: 10, z: 10 },
    { x: -12, z: 8 },
    { x: 8, z: -15 },
    { x: -15, z: -10 },
    { x: 0, z: 20 },
  ];
  const crystals = [];
  crystalPositions.forEach((pos) => {
    const crystal = new THREE.Mesh(crystalGeo, crystalMat);
    crystal.position.set(pos.x, floorY + 4 + Math.random() * 2, pos.z);
    crystal.scale.set(1, 2, 1);
    crystal.rotation.y = Math.random() * Math.PI;
    crystal.frustumCulled = false;
    group.add(crystal);
    crystals.push(crystal);
  });
  registerFadeMaterial(crystalMat);

  // Glowing orbs (4)
  const orbGeo = new THREE.SphereGeometry(0.8, 16, 16);
  const orbMat = new THREE.MeshBasicMaterial({ color: 0x00ffff, transparent: true, opacity: 0.7 });
  const orbPositions = [
    { x: 5, z: -5 },
    { x: -8, z: 12 },
    { x: 15, z: 5 },
    { x: -3, z: -18 },
  ];
  const orbs = [];
  orbPositions.forEach((pos) => {
    const orb = new THREE.Mesh(orbGeo, orbMat);
    orb.position.set(pos.x, floorY + 3 + Math.random() * 3, pos.z);
    orb.frustumCulled = false;
    group.add(orb);
    orbs.push(orb);
  });
  registerFadeMaterial(orbMat);

  // Atmospheric fog (very light, to add depth)
  // Removed THREE.Fog - causes visibility issues at distance

  // Stars
  const starCount = 200;
  const starPositions = new Float32Array(starCount * 3);
  for (let i = 0; i < starCount; i++) {
    starPositions[i * 3] = (Math.random() - 0.5) * 200;
    starPositions[i * 3 + 1] = Math.random() * 100 + 20;
    starPositions[i * 3 + 2] = (Math.random() - 0.5) * 200;
  }
  const starGeo = new THREE.BufferGeometry();
  starGeo.setAttribute('position', new THREE.BufferAttribute(starPositions, 3));
  const starMat = new THREE.PointsMaterial({ color: 0xffffff, size: 0.5, transparent: true, opacity: 0.8 });
  const stars = new THREE.Points(starGeo, starMat);
  stars.frustumCulled = false; // Fix disappearing when looking up
  group.add(stars);
  registerFadeMaterial(starMat);

  // Animation
  group.userData.update = (now, dt) => {
    const t = now * 0.001;
    // Float crystals
    crystals.forEach((crystal, i) => {
      crystal.position.y = floorY + 4 + Math.sin(t + i * 2) * 0.5;
      crystal.rotation.y += dt * 0.5;
    });
    // Float orbs
    orbs.forEach((orb, i) => {
      orb.position.y = floorY + 3 + Math.sin(t * 1.5 + i * 3) * 0.8;
    });
  };

  // Alien floor HUD height: Y = -0.28, no rotation
  group.position.set(-0.048, -0.28, -2.475);
}

function buildHellscapeLavaScene(group, deps) {
  const { registerFadeMaterial, floorMaterial, biomeTerrainMaterials } = deps;
  
  const floorHeight = (floorMaterial && floorMaterial.userData && floorMaterial.userData.floorHeight) || -0.01;
  const floorY = floorHeight;
  const sceneColor = 0x1a0505;

  // Sky dome (dark red/black)
  const skyGeo = new THREE.SphereGeometry(500, 32, 24);
  const skyMat = new THREE.MeshBasicMaterial({
    color: sceneColor,
    side: THREE.BackSide,
  });
  const sky = new THREE.Mesh(skyGeo, skyMat);
  sky.frustumCulled = false;
  sky.renderOrder = -20;
  group.add(sky);
  registerFadeMaterial(skyMat);

  // Lighting
  const ambientLight = new THREE.AmbientLight(0x331111, 0.3);
  group.add(ambientLight);

  // Ground with lava rivers
  const groundGeo = new THREE.PlaneGeometry(200, 200, 100, 100);
  groundGeo.rotateX(-Math.PI / 2);
  const groundPos = groundGeo.attributes.position;
  const groundColors = [];
  for (let i = 0; i < groundPos.count; i++) {
    const x = groundPos.getX(i);
    const z = groundPos.getZ(i);
    // Lava river pattern
    const lavaPattern = Math.sin(x * 0.05) * Math.cos(z * 0.05) + Math.sin(x * 0.1 + z * 0.1) * 0.5;
    const isLava = lavaPattern > 0.3;
    const height = isLava ? -0.5 : Math.sin(x * 0.02) * Math.cos(z * 0.02) * 2;
    groundPos.setY(i, height);
    const color = isLava ? new THREE.Color(0xff2200) : new THREE.Color(0x1a0505);
    groundColors.push(color.r, color.g, color.b);
  }
  groundGeo.setAttribute('color', new THREE.Float32BufferAttribute(groundColors, 3));
  groundGeo.computeVertexNormals();
  const groundMat = new THREE.MeshBasicMaterial({ vertexColors: true });
  const ground = new THREE.Mesh(groundGeo, groundMat);
  ground.name = 'hellscape-lava-ground';
  ground.userData.planeName = 'hellscape-lava-ground';
  ground.position.y = floorY;
  ground.frustumCulled = false;
  group.add(ground);
  registerFadeMaterial(groundMat);

  // Flash overlay for damage feedback
  const flashGeo = new THREE.PlaneGeometry(200, 200);
  const flashMat = new THREE.MeshBasicMaterial({
    color: 0xff0000,
    transparent: true,
    opacity: 0,
    depthWrite: false,
    side: THREE.DoubleSide
  });
  const flashPlane = new THREE.Mesh(flashGeo, flashMat);
  flashPlane.name = 'hellscape-lava-damage-flash-plane';
  flashPlane.userData.planeName = 'hellscape-lava-damage-flash-plane';
  flashPlane.rotation.x = -Math.PI / 2;
  flashPlane.position.y = floorY + 0.1;
  flashPlane.frustumCulled = false;
  group.add(flashPlane);
  biomeTerrainMaterials.push({ type: 'overlay', material: flashMat });

  // Lava glow plane (below ground for glow effect)
  const glowGeo = new THREE.PlaneGeometry(200, 200);
  const glowMat = new THREE.MeshBasicMaterial({
    color: 0xff4400,
    transparent: true,
    opacity: 0.5,
    depthWrite: false,
    side: THREE.DoubleSide
  });
  const glowPlane = new THREE.Mesh(glowGeo, glowMat);
  glowPlane.rotation.x = -Math.PI / 2;
  glowPlane.position.y = floorY - 0.6;
  glowPlane.frustumCulled = false;
  group.add(glowPlane);
  registerFadeMaterial(glowMat);

  // Fire particles
  const fireCount = 150;
  const firePositions = new Float32Array(fireCount * 3);
  const fireVelocities = [];
  const fireLifetimes = [];
  for (let i = 0; i < fireCount; i++) {
    firePositions[i * 3] = (Math.random() - 0.5) * 80;
    firePositions[i * 3 + 1] = floorY - 0.3;
    firePositions[i * 3 + 2] = (Math.random() - 0.5) * 80;
    fireVelocities.push({
      x: (Math.random() - 0.5) * 0.1,
      y: 0.5 + Math.random() * 1.5,
      z: (Math.random() - 0.5) * 0.1
    });
    fireLifetimes.push(Math.random() * 2);
  }
  const fireGeo = new THREE.BufferGeometry();
  fireGeo.setAttribute('position', new THREE.BufferAttribute(firePositions, 3));
  const fireMat = new THREE.PointsMaterial({
    color: 0xff6600,
    size: 0.8,
    transparent: true,
    opacity: 0.8,
    blending: THREE.AdditiveBlending
  });
  const fire = new THREE.Points(fireGeo, fireMat);
  fire.frustumCulled = false;
  group.add(fire);
  registerFadeMaterial(fireMat);

  // Ember particles (smaller, faster)
  const emberCount = 200;
  const emberPositions = new Float32Array(emberCount * 3);
  const emberVelocities = [];
  for (let i = 0; i < emberCount; i++) {
    emberPositions[i * 3] = (Math.random() - 0.5) * 100;
    emberPositions[i * 3 + 1] = floorY + Math.random() * 30;
    emberPositions[i * 3 + 2] = (Math.random() - 0.5) * 100;
    emberVelocities.push({
      x: (Math.random() - 0.5) * 0.2,
      y: 0.3 + Math.random() * 0.5,
      z: (Math.random() - 0.5) * 0.2
    });
  }
  const emberGeo = new THREE.BufferGeometry();
  emberGeo.setAttribute('position', new THREE.BufferAttribute(emberPositions, 3));
  const emberMat = new THREE.PointsMaterial({
    color: 0xffaa00,
    size: 0.3,
    transparent: true,
    opacity: 0.6,
    blending: THREE.AdditiveBlending
  });
  const embers = new THREE.Points(emberGeo, emberMat);
  embers.frustumCulled = false;
  group.add(embers);
  registerFadeMaterial(emberMat);

  // Rocky outcrops (procedural)
  const createRock = () => {
    const rockGeo = new THREE.DodecahedronGeometry(1, 0);
    const rockMat = new THREE.MeshBasicMaterial({ color: 0x2a1515, flatShading: true });
    const rock = new THREE.Mesh(rockGeo, rockMat);
    rock.scale.set(
      1 + Math.random() * 2,
      1 + Math.random() * 3,
      1 + Math.random() * 2
    );
    rock.rotation.set(
      Math.random() * Math.PI,
      Math.random() * Math.PI,
      Math.random() * Math.PI
    );
    registerFadeMaterial(rockMat);
    return rock;
  };

  const rockPositions = [
    { x: 15, z: 15 },
    { x: -20, z: 10 },
    { x: 10, z: -25 },
    { x: -15, z: -20 },
    { x: 25, z: -10 },
    { x: -30, z: 25 },
  ];
  rockPositions.forEach((pos) => {
    const rock = createRock();
    rock.position.set(pos.x, floorY + 1, pos.z);
    group.add(rock);
  });

  // Ash particles (floating grey particles)
  const ashCount = 100;
  const ashPositions = new Float32Array(ashCount * 3);
  for (let i = 0; i < ashCount; i++) {
    ashPositions[i * 3] = (Math.random() - 0.5) * 80;
    ashPositions[i * 3 + 1] = Math.random() * 20 + floorY;
    ashPositions[i * 3 + 2] = (Math.random() - 0.5) * 80;
  }
  const ashGeo = new THREE.BufferGeometry();
  ashGeo.setAttribute('position', new THREE.BufferAttribute(ashPositions, 3));
  const ashMat = new THREE.PointsMaterial({
    color: 0x666666,
    size: 0.2,
    transparent: true,
    opacity: 0.4
  });
  const ash = new THREE.Points(ashGeo, ashMat);
  ash.frustumCulled = false;
  group.add(ash);
  registerFadeMaterial(ashMat);

  // Geyser particles (periodic bursts)
  const GEYSER_PARTICLE_COUNT = 50;
  const geyserPos = new Float32Array(GEYSER_PARTICLE_COUNT * 3);
  const geyserSizes = new Float32Array(GEYSER_PARTICLE_COUNT);
  const geyserParticleData = [];
  for (let i = 0; i < GEYSER_PARTICLE_COUNT; i++) {
    geyserPos[i * 3] = 0;
    geyserPos[i * 3 + 1] = -1000; // Hidden initially
    geyserPos[i * 3 + 2] = 0;
    geyserSizes[i] = 0;
    geyserParticleData.push({
      active: false,
      x: 0, y: 0, z: 0,
      vx: 0, vy: 0, vz: 0,
      life: 0,
      maxLife: 0
    });
  }
  const geyserGeo = new THREE.BufferGeometry();
  geyserGeo.setAttribute('position', new THREE.BufferAttribute(geyserPos, 3));
  geyserGeo.setAttribute('aSize', new THREE.BufferAttribute(geyserSizes, 1));
  const geyserMat = new THREE.ShaderMaterial({
    uniforms: {
      uColor: { value: new THREE.Color(0xff6600) }
    },
    vertexShader: `
      attribute float aSize;
      void main() {
        vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
        gl_PointSize = aSize * (300.0 / -mvPosition.z);
        gl_Position = projectionMatrix * mvPosition;
      }
    `,
    fragmentShader: `
      uniform vec3 uColor;
      void main() {
        float dist = length(gl_PointCoord - vec2(0.5));
        if (dist > 0.5) discard;
        float alpha = 1.0 - smoothstep(0.0, 0.5, dist);
        gl_FragColor = vec4(uColor, alpha * 0.8);
      }
    `,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending
  });
  const geyserParticles = new THREE.Points(geyserGeo, geyserMat);
  geyserParticles.frustumCulled = false;
  group.add(geyserParticles);
  registerFadeMaterial(geyserMat);

  // Flame pillars (3 locations with constant particle streams)
  const FLAME_PILLAR_PARTICLES = 60;
  const TOTAL_FLAME_PILLAR_PARTICLES = FLAME_PILLAR_PARTICLES * 3;
  const flamePillarPos = new Float32Array(TOTAL_FLAME_PILLAR_PARTICLES * 3);
  const flamePillarSizes = new Float32Array(TOTAL_FLAME_PILLAR_PARTICLES);
  const flameParticleData = [];
  const pillarDefs = [
    { x: -20, z: -15, height: 15, speed: 8 },
    { x: 15, z: -20, height: 12, speed: 10 },
    { x: 0, z: 20, height: 18, speed: 7 }
  ];

  const initFlameParticle = (i) => {
    const pillarIdx = Math.floor(i / FLAME_PILLAR_PARTICLES);
    const pillar = pillarDefs[pillarIdx];
    const pd = flameParticleData[i];
    pd.pillarIdx = pillarIdx;
    pd.t = Math.random();
    pd.speed = 0.8 + Math.random() * 0.4;
    pd.driftPhase = Math.random() * Math.PI * 2;
    pd.driftAmp = 0.3 + Math.random() * 0.4;

    const i3 = i * 3;
    flamePillarPos[i3] = pillar.x + (Math.random() - 0.5) * 2;
    flamePillarPos[i3 + 1] = floorY + pd.t * pillar.height;
    flamePillarPos[i3 + 2] = pillar.z + (Math.random() - 0.5) * 2;
    flamePillarSizes[i] = 2.0;
  };

  for (let i = 0; i < TOTAL_FLAME_PILLAR_PARTICLES; i++) {
    flameParticleData.push({
      pillarIdx: 0,
      t: 0,
      speed: 1,
      driftPhase: 0,
      driftAmp: 0
    });
    initFlameParticle(i);
  }

  const flamePillarGeo = new THREE.BufferGeometry();
  flamePillarGeo.setAttribute('position', new THREE.BufferAttribute(flamePillarPos, 3));
  flamePillarGeo.setAttribute('aSize', new THREE.BufferAttribute(flamePillarSizes, 1));
  const flamePillarMat = new THREE.ShaderMaterial({
    uniforms: {
      uColor: { value: new THREE.Color(0xff4400) }
    },
    vertexShader: `
      attribute float aSize;
      void main() {
        vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
        gl_PointSize = aSize * (200.0 / -mvPosition.z);
        gl_Position = projectionMatrix * mvPosition;
      }
    `,
    fragmentShader: `
      uniform vec3 uColor;
      void main() {
        float dist = length(gl_PointCoord - vec2(0.5));
        if (dist > 0.5) discard;
        float alpha = 1.0 - smoothstep(0.0, 0.5, dist);
        gl_FragColor = vec4(uColor, alpha * 0.9);
      }
    `,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending
  });
  const flamePillars = new THREE.Points(flamePillarGeo, flamePillarMat);
  flamePillars.frustumCulled = false;
  group.add(flamePillars);
  registerFadeMaterial(flamePillarMat);

  // Geyser state
  let lastGeyserTime = 0;
  const geyserInterval = 2000; // ms between bursts
  const activeGeyserParticles = [];

  const createGeyserBurst = (now) => {
    const burstX = (Math.random() - 0.5) * 60;
    const burstZ = (Math.random() - 0.5) * 60;

    for (let i = 0; i < 15; i++) {
      const particleIdx = activeGeyserParticles.length % GEYSER_PARTICLE_COUNT;
      const pd = geyserParticleData[particleIdx];
      pd.active = true;
      pd.x = burstX + (Math.random() - 0.5) * 2;
      pd.y = floorY;
      pd.z = burstZ + (Math.random() - 0.5) * 2;
      pd.vx = (Math.random() - 0.5) * 4;
      pd.vy = 10 + Math.random() * 8;
      pd.vz = (Math.random() - 0.5) * 4;
      pd.life = 0;
      pd.maxLife = 1.5 + Math.random() * 1;

      if (activeGeyserParticles.length < GEYSER_PARTICLE_COUNT) {
        activeGeyserParticles.push(particleIdx);
      }
    }
  };

  // Animation update
  group.userData.update = (now, dt) => {
    const time = now * 0.001;
    const dtSec = dt * 0.001;

    // Fire particles
    const firePos = fireGeo.attributes.position.array;
    for (let i = 0; i < fireCount; i++) {
      const idx = i * 3;
      firePos[idx] += fireVelocities[i].x * dt;
      firePos[idx + 1] += fireVelocities[i].y * dt;
      firePos[idx + 2] += fireVelocities[i].z * dt;
      fireLifetimes[i] += dtSec;

      if (fireLifetimes[i] > 2 || firePos[idx + 1] > floorY + 10) {
        firePos[idx] = (Math.random() - 0.5) * 80;
        firePos[idx + 1] = floorY - 0.3;
        firePos[idx + 2] = (Math.random() - 0.5) * 80;
        fireLifetimes[i] = 0;
      }
    }
    fireGeo.attributes.position.needsUpdate = true;

    // Ember particles
    const emberPosArr = emberGeo.attributes.position.array;
    for (let i = 0; i < emberCount; i++) {
      const idx = i * 3;
      emberPosArr[idx] += emberVelocities[i].x * dt;
      emberPosArr[idx + 1] += emberVelocities[i].y * dt;
      emberPosArr[idx + 2] += emberVelocities[i].z * dt;

      if (emberPosArr[idx + 1] > floorY + 30) {
        emberPosArr[idx] = (Math.random() - 0.5) * 100;
        emberPosArr[idx + 1] = floorY;
        emberPosArr[idx + 2] = (Math.random() - 0.5) * 100;
      }
    }
    emberGeo.attributes.position.needsUpdate = true;

    // Ash particles
    const ashPosArr = ashGeo.attributes.position.array;
    for (let i = 0; i < ashCount; i++) {
      const idx = i * 3;
      ashPosArr[idx] += Math.sin(time + i) * 0.02;
      ashPosArr[idx + 1] += 0.01 * dt;
      ashPosArr[idx + 2] += Math.cos(time + i) * 0.02;

      if (ashPosArr[idx] > 40) ashPosArr[idx] = -40;
      if (ashPosArr[idx] < -40) ashPosArr[idx] = 40;
      if (ashPosArr[idx + 1] > floorY + 20) ashPosArr[idx + 1] = floorY;
      if (ashPosArr[idx + 2] > 40) ashPosArr[idx + 2] = -40;
      if (ashPosArr[idx + 2] < -40) ashPosArr[idx + 2] = 40;
    }
    ashGeo.attributes.position.needsUpdate = true;

    // Geyser trigger and update
    if (now - lastGeyserTime > geyserInterval) {
      createGeyserBurst(now);
      lastGeyserTime = now;
    }

    const geyserPosArr = geyserGeo.attributes.position.array;
    let activeCount = 0;
    for (let i = geyserParticleData.length - 1; i >= 0; i--) {
      const p = geyserParticleData[i];
      if (!p.active) continue;

      p.life += dtSec;

      if (p.life > p.maxLife) {
        p.active = false;
        continue;
      }

      p.x += p.vx * dtSec;
      p.y += p.vy * dtSec;
      p.z += p.vz * dtSec;
      p.vy -= 18 * dtSec;

      const idx = activeCount * 3;
      geyserPosArr[idx] = p.x;
      geyserPosArr[idx + 1] = p.y;
      geyserPosArr[idx + 2] = p.z;
      activeCount++;
    }
    geyserGeo.setDrawRange(0, activeCount);
    geyserGeo.attributes.position.needsUpdate = true;

    // Flame pillar animation
    const fpPos = flamePillarGeo.attributes.position.array;
    const fpSizes = flamePillarGeo.attributes.aSize.array;
    for (let i = 0; i < TOTAL_FLAME_PILLAR_PARTICLES; i++) {
      const pd = flameParticleData[i];
      const pillar = pillarDefs[pd.pillarIdx];
      const i3 = i * 3;

      pd.t += (pd.speed * dtSec * pillar.speed) / Math.max(1, pillar.height);

      if (pd.t >= 1.0) {
        initFlameParticle(i);
      } else {
        const driftWave = Math.sin(time * 2.2 + pd.driftPhase) * pd.driftAmp * dtSec;
        fpPos[i3] += Math.cos(pd.driftPhase) * driftWave;
        fpPos[i3 + 1] += pd.speed * dtSec * pillar.speed;
        fpPos[i3 + 2] += Math.sin(pd.driftPhase) * driftWave;

        fpSizes[i] = Math.max(0.3, (1.0 - pd.t) * 3.0);
      }
    }
    flamePillarGeo.attributes.position.needsUpdate = true;
    flamePillarGeo.attributes.aSize.needsUpdate = true;
  };

  // Hellscape floor HUD height: group.position.y = 0.05
  group.position.set(26.599, 0.05, -0.486);
  group.rotation.y = 0.248; // yaw: 14.21°
}
