// ============================================================
//  BIOME: Synthwave Valley
//  Retro synthwave scene with grid terrain, sun, and aurora
// ============================================================
import * as THREE from 'three';
import { bakeCloudsToCanvas } from '../bake-clouds.js';

/**
 * Build a non-uniform terrain grid for synthwave valley.
 * Concentrates vertices in the player-visible corridor and mountain
 * ridgeline while aggressively cutting density in fogged-out side/rear
 * regions the player never sees.
 *
 * Distribution strategy:
 *   X axis: 30-segment center corridor, 8-seg ridge transitions,
 *           4-seg mountain body, 2-seg far silhouette edges
 *   Z axis: 25-segment walking corridor, 15-seg far mountain zone,
 *           sparse behind-player tail
 *
 * Result: ~6k triangles (vs 16k prior, 28.8k uniform 120x120) with
 * concentrated detail where the player looks; fog-obscured regions
 * aggressively simplified.
 */
function buildTaperedTerrainGeo() {
  // Piecewise axis: each entry is [start, end, segmentCount].
  // Consecutive ranges share their boundary vertex (end_n == start_n+1).
  function piecewise(ranges) {
    const pts = [];
    for (let r = 0; r < ranges.length; r++) {
      const start = ranges[r][0];
      const end   = ranges[r][1];
      const count = ranges[r][2];
      const n = (r < ranges.length - 1) ? count : count + 1;
      for (let i = 0; i < n; i++) {
        pts.push(start + (end - start) * (i / count));
      }
    }
    return pts;
  }

  // X: dense center corridor, moderate mountain flanks, sparse far edges
  const xPos = piecewise([
    [-1200, -600,  2],   // far left silhouette (fogged)
    [-600,  -350,  4],   // left mountain body
    [-350,  -150,  8],   // left ridge transition
    [-150,   150, 30],   // center corridor — HIGH detail
    [ 150,   350,  8],   // right ridge transition
    [ 350,   600,  4],   // right mountain body
    [ 600,  1200,  2],   // far right silhouette (fogged)
  ]);

  // Z: dense walking path + near mountains, sparse behind player
  const zPos = piecewise([
    [-1200, -500,  6],   // far scenic backdrop
    [-500,  -100, 15],   // far mountains (ridgeline near z≈-260)
    [-100,   500, 25],   // walking corridor — HIGH detail
    [ 500,   750,  4],   // behind-player taper
    [ 750,  1200,  2],   // behind player — sparse
    [ 1200, 2000,  1],   // far behind player — reach mountain cylinder
  ]);

  const nx = xPos.length;   // ~94
  const nz = zPos.length;   // ~87
  const vCount = nx * nz;

  // Flat XZ plane (Y=0); the vertex shader displaces Y procedurally
  const positions = new Float32Array(vCount * 3);
  for (let j = 0; j < nz; j++) {
    for (let i = 0; i < nx; i++) {
      const idx = (j * nx + i) * 3;
      positions[idx]     = xPos[i];
      positions[idx + 1] = 0;
      positions[idx + 2] = zPos[j];
    }
  }

  // Triangle indices (two tris per quad)
  const indices = [];
  for (let j = 0; j < nz - 1; j++) {
    for (let i = 0; i < nx - 1; i++) {
      const a = j * nx + i;
      const b = a + 1;
      const c = a + nx;
      const d = c + 1;
      indices.push(a, c, b);
      indices.push(b, c, d);
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.name = 'biome-synthwave-tapered-terrain';
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geo.setIndex(indices);
  // Shader is purely position-based (no normals/UVs used), skip computeVertexNormals
  return geo;
}

export function buildSynthwaveValleyScene(group, deps) {
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
  const skyGeo = new THREE.SphereGeometry(2800, 24, 16);
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
    fragmentShader: `varying vec3 vWorldPosition; uniform vec3 topColor; uniform vec3 midColor; uniform vec3 horizonColor; uniform vec3 glowColor; void main(){ float worldY=vWorldPosition.y; float t1=smoothstep(0.0,437.0,worldY); float t2=smoothstep(0.0,750.0,worldY); float t3=smoothstep(0.0,1500.0,worldY); vec3 col=horizonColor; col=mix(col,glowColor,t1); col=mix(col,midColor,t2); col=mix(col,topColor,t3); col=pow(col,vec3(1.0/2.2)); gl_FragColor=vec4(col*${brightness.toFixed(2)},1.0); }`,
    depthWrite: false,
  });
  const sky = new THREE.Mesh(skyGeo, skyMat);
  sky.name = 'synthwave-skydome';
  sky.frustumCulled = false;
  sky.renderOrder = -20;  // Draw before sun (which is at -3 to -1)
  group.add(sky);
  registerFadeMaterial(skyMat);

  // Terrain - EXACT colors: Gridlines #015CC1 (bright blue), Between gridlines #0C0E3E (dark blue)
  // TAPERED TERRAIN: Non-uniform grid concentrates detail in visible corridor (30 seg center)
  // while cutting dead side/rear geometry. ~6k tris vs 16k prior, 28.8k uniform 120x120.
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
  const terrainGeo = buildTaperedTerrainGeo();
  const terrainMat = new THREE.ShaderMaterial({
    uniforms: terrainUniforms,
    side: THREE.FrontSide,
    depthWrite: true,
    depthTest: true,
    polygonOffset: true,
    polygonOffsetFactor: 2.0,
    polygonOffsetUnits: 8.0,
    // Fix for synthwave floor popping in VR: keep the terrain static and use the
    // built-in modelViewMatrix projection instead of manual projection math.
    vertexShader: `varying vec3 vWorldPos; varying vec3 vObjPos; varying float vHeight; varying float vFogDistance; vec2 hash2(vec2 p){ p=vec2(dot(p, vec2(127.1,311.7)), dot(p, vec2(269.5,183.3))); return -1.0+2.0*fract(sin(p)*43758.5453123);} float noise(in vec2 p){ vec2 i=floor(p); vec2 f=fract(p); vec2 u=f*f*(3.0-2.0*f); return mix(mix(dot(hash2(i+vec2(0.0,0.0)), f-vec2(0.0,0.0)), dot(hash2(i+vec2(1.0,0.0)), f-vec2(1.0,0.0)), u.x), mix(dot(hash2(i+vec2(0.0,1.0)), f-vec2(0.0,1.0)), dot(hash2(i+vec2(1.0,1.0)), f-vec2(1.0,1.0)), u.x), u.y);} float fbm(vec2 p){ float value=0.0; float amp=0.5; for(int i=0;i<5;i++){ value+=amp*noise(p); p*=2.0; amp*=0.5;} return value;} float ridgeNoise(vec2 p){ float sum=0.0; float amp=0.55; for(int i=0;i<5;i++){ float n=noise(p); n=1.0-abs(n); n*=n; sum+=n*amp; p*=2.15; amp*=0.5;} return sum;} void main(){ vec3 pos=position; vec2 p=pos.xz; float valleyMask=smoothstep(0.0,1.0, clamp(abs(pos.x)/240.0,0.0,1.0)); float broad=fbm(p*vec2(0.0035,0.0024))*16.0; float detail=fbm(p*vec2(0.012,0.01))*5.0; float ridges=ridgeNoise((p+vec2(0.0,-260.0))*0.008)*180.0; float mountainMask=pow(valleyMask,1.55); float centerDip=-10.0*(1.0-valleyMask); float distanceFade=smoothstep(750.0,120.0, abs(pos.z+120.0)); float h=broad+detail+centerDip; h+=ridges*mountainMask*distanceFade; if(pos.z>700.0){ h*=smoothstep(1000.0,700.0,pos.z);} h=max(0.0,h); pos.y=h; vec4 world=modelMatrix*vec4(pos,1.0); vec4 mvPosition=modelViewMatrix*vec4(pos,1.0); vWorldPos=world.xyz; vObjPos=pos; vHeight=h; vFogDistance=length(mvPosition.xyz); gl_Position=projectionMatrix*mvPosition; }`,
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

  // Floor bloom removed — effect was not visible on Quest, save the draw call.

  // ── MOUNTAIN WRAP CYLINDER ──
  // Large open cylinder with mountain PNG on the inside, positioned IN FRONT of sun.
  // This creates a 360° panoramic mountain backdrop as distant horizon.
  const mountainTex = new THREE.TextureLoader().load('assets/mountain_wrap_4k.png');
  mountainTex.wrapS = THREE.RepeatWrapping;
  mountainTex.wrapT = THREE.ClampToEdgeWrapping;
  // FIX: Ensure PNG colors display exactly as-is, no fading/washing
  mountainTex.colorSpace = THREE.SRGBColorSpace;  // Treat as sRGB (PNG standard)
  mountainTex.premultiplyAlpha = false;  // Avoid color washing from premultiplied alpha
  // 4096px width / 277px height ≈ 14.78 aspect (matches original 9003x609).
  // With a 190-high cylinder, one full image repeat should span ~2808 world units.
  const mountainRadius = 1162;
  const mountainRepeatWidth = 2808;
  mountainTex.repeat.set((2 * Math.PI * mountainRadius) / mountainRepeatWidth, 1);
  // Offset texture so middle of PNG faces -Z (forward in XR)
  const repeatCount = mountainTex.repeat.x;
  mountainTex.offset.x = 0.5 - (0.5 / repeatCount);

  const mountainCylinderGeo = new THREE.CylinderGeometry(mountainRadius, mountainRadius, 190, 64, 1, true);
  const mountainCylinderMat = new THREE.MeshBasicMaterial({
    map: mountainTex,
    color: 0xffffff,       // No tint - show raw PNG colors
    transparent: true,
    side: THREE.BackSide,  // Visible from inside
    depthWrite: false,
    depthTest: true,
    fog: false,            // Not affected by scene fog
    toneMapped: false,     // Show exact PNG colors, no tone mapping
    blending: THREE.NormalBlending,  // Standard alpha blending
  });
  const mountainCylinder = new THREE.Mesh(mountainCylinderGeo, mountainCylinderMat);
  mountainCylinder.name = 'synthwave-mountain-wrap';
  mountainCylinder.position.set(0, 95, 0);  // bottom=0, top=190, centered at world origin
  mountainCylinder.frustumCulled = false;
  // FIX: Mountain must have higher renderOrder than sun (-3 to -1) AND sun must respect depth.
  // Higher renderOrder = draws later = appears on top when depthTest is enabled.
  mountainCylinder.renderOrder = 0;  // In front of sun (sun is -3 to -1)
  group.add(mountainCylinder);
  registerFadeMaterial(mountainCylinderMat);

  // Store ref for boss cinematic red tint
  synthVisualRefs.mountainCylMat = mountainCylinderMat;

  // ── CLOUD DOME (baked to texture for Quest performance) ──
  // Clouds are baked once at init to a canvas texture. Zero per-frame GPU shader cost.
  const cloudTex = bakeCloudsToCanvas({
    width: 1024, height: 512,
    horizonColor: [1.0, 0.527, 0.149],   // #FF8626
    cloudColor: [1.0, 0.933, 0.867],      // #ffeedd
    skyColor: [0.102, 0.0, 0.29],         // #1A004A
    sunDir: [0, 0.3, -1],
    seed: 42,
  });
  const cloudDome1Geo = new THREE.SphereGeometry(2400, 18, 10);
  const cloudDome1Mat = new THREE.MeshBasicMaterial({
    map: cloudTex,
    side: THREE.BackSide,
    transparent: true,
    depthWrite: false,
    depthTest: true,
    fog: false,
  });
  const cloudDome1 = new THREE.Mesh(cloudDome1Geo, cloudDome1Mat);
  cloudDome1.name = 'synthwave-cloud-dome-1';
  cloudDome1.position.set(0, 0, -700);
  cloudDome1.frustumCulled = false;
  cloudDome1.renderOrder = -1;
  group.add(cloudDome1);
  registerFadeMaterial(cloudDome1Mat);



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

  // DIMMER, YELLOWISH glow (not bright white)
  const sunGlowTex = makeRadial('rgba(255,230,150,0.7)', 'rgba(254,151,83,0.4)');

  // Outer glow DELETED (Needle audit cleanup) — was synthwave-sun-outer-glow
  // synthVisualRefs.sunOuterGlowMat stays null

  // Main glow - dimmer, yellowish
  // FIX: Enable depthTest so mountain cylinder can occlude the sun
  const sunGlowMat = new THREE.MeshBasicMaterial({ map: sunGlowTex, color: 0xffdd99, transparent: true, opacity: 0.5, depthWrite: false, depthTest: true, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, fog: false });
  const sunGlow = new THREE.Mesh(new THREE.PlaneGeometry(700, 700), sunGlowMat);
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
  // FIX: Enable depthTest so mountain cylinder can occlude the sun
  const sunCoreMat = new THREE.MeshBasicMaterial({ map: sunDiscTex, color: 0xffffff, transparent: true, depthWrite: false, depthTest: true, side: THREE.DoubleSide, fog: false });
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

  // Keep the synthwave biome to the original clean backdrop. The extra experimental
  // cathedral/crystal/orb/palm props were not intended for the live game scene.
  group.userData.update = (time) => {
    const t = time;
    terrainUniforms.uTime.value = t * 0.001;
    // Floor bloom removed — no _bloomMat to update.
    // Cloud animation disabled for Quest performance - static clouds
    // cloudDome1Mat.uniforms.uTime.value = t * 0.0001;
  };

  // Fix for synthwave valley "jiggle": keep the imported scene static in-game.
  // The standalone HTML used perpetual scrolling and pulsing, but the game
  // version should behave like a stable biome backdrop.

  // Synthwave floor HUD height:group.position.y = 5.82
  group.position.set(0, -(floorY + 1.5), 0);

  // Rotate so player faces sun
  group.rotation.y = 0;
}
