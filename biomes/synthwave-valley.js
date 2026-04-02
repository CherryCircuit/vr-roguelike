// ============================================================
//  BIOME: Synthwave Valley
//  Retro synthwave scene with grid terrain, sun, and aurora
// ============================================================
import * as THREE from 'three';

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
    uPulseColorA: { value: new THREE.Color(0xF30787) },   // Pink phase for grid and ridge pulsing
    uPulseColorB: { value: new THREE.Color(0x00D9FF) },   // Blue phase for grid and ridge pulsing
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

  // ---- CATHEDRAL REEF ADDITIONS ----
  const columnBodyMat = new THREE.MeshStandardMaterial({ color: 0x1A1A2E, metalness: 0.8, roughness: 0.3 });
  const columnNeonCyanMat = new THREE.MeshBasicMaterial({ color: 0x00FFFF, transparent: true, opacity: 0.9 });
  const columnNeonPurpleMat = new THREE.MeshBasicMaterial({ color: 0x8A2BE2, transparent: true, opacity: 0.9 });
  const columnBaseMat = new THREE.MeshStandardMaterial({ color: 0x0A0A1A, metalness: 0.9, roughness: 0.2 });
  const archFrameMat = new THREE.MeshStandardMaterial({ color: 0x1A1A3E, metalness: 0.7, roughness: 0.4 });
  const archGlowMat = new THREE.MeshBasicMaterial({ color: 0x00DDDD, transparent: true, opacity: 0.4 });
  const crystalLargeMat = new THREE.MeshStandardMaterial({ color: 0x008B8B, emissive: 0x004040, emissiveIntensity: 0.5, metalness: 0.3, roughness: 0.2, transparent: true, opacity: 0.85 });
  const crystalMediumMat = new THREE.MeshStandardMaterial({ color: 0x008B8B, emissive: 0x003333, emissiveIntensity: 0.3, metalness: 0.3, roughness: 0.3, transparent: true, opacity: 0.8 });
  const crystalSmallTealMat = new THREE.MeshBasicMaterial({ color: 0x20B2AA, transparent: true, opacity: 0.8 });
  const crystalSmallPurpleMat = new THREE.MeshBasicMaterial({ color: 0x9370DB, transparent: true, opacity: 0.8 });
  const crystalSmallPinkMat = new THREE.MeshBasicMaterial({ color: 0xFF69B4, transparent: true, opacity: 0.8 });
  const lightBeamMat = new THREE.MeshBasicMaterial({ color: 0x00FFFF, transparent: true, opacity: 0.12, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
  const orbCyanMat = new THREE.MeshBasicMaterial({ color: 0x00FFFF, transparent: true, opacity: 0.7 });
  const orbPurpleMat = new THREE.MeshBasicMaterial({ color: 0x8A2BE2, transparent: true, opacity: 0.7 });
  const orbPinkMat = new THREE.MeshBasicMaterial({ color: 0xFF69B4, transparent: true, opacity: 0.7 });
  const fanCoralMat = new THREE.MeshStandardMaterial({ color: 0xDAA520, emissive: 0x553300, emissiveIntensity: 0.2, transparent: true, opacity: 0.85, side: THREE.DoubleSide });
  const pyramidMat = new THREE.MeshStandardMaterial({ color: 0x008080, emissive: 0x2F4F4F, emissiveIntensity: 0.3, metalness: 0.5, roughness: 0.3 });
  const circuitTreeMat = new THREE.MeshStandardMaterial({ color: 0x1A1A2E, metalness: 0.8, roughness: 0.3 });
  [columnBodyMat, columnNeonCyanMat, columnNeonPurpleMat, columnBaseMat, archFrameMat, archGlowMat, crystalLargeMat, crystalMediumMat, crystalSmallTealMat, crystalSmallPurpleMat, crystalSmallPinkMat, lightBeamMat, orbCyanMat, orbPurpleMat, orbPinkMat, fanCoralMat, pyramidMat, circuitTreeMat].forEach(registerFadeMaterial);
  const columnMaterials = [columnNeonCyanMat, columnNeonPurpleMat];
  const addMesh = (mesh, x, y, z, rx = 0, ry = 0, rz = 0) => {
    mesh.position.set(x, y, z);
    mesh.rotation.set(rx, ry, rz);
    mesh.frustumCulled = false;
    group.add(mesh);
    return mesh;
  };
  const terrainYAt = (x, z) => floorY + 1.5 + Math.sin(x * 0.05) * 0.6 + Math.cos(z * 0.04) * 0.6;
  const makeColumn = (name, x, z, height, neonMat, angle = 0) => {
    const y = terrainYAt(x, z);
    const g = new THREE.Group();
    g.name = name;
    g.position.set(x, y, z);
    g.rotation.y = angle;
    const base = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.15, 1.5), columnBaseMat);
    base.name = `${name}-base`;
    base.position.y = 0.075;
    base.frustumCulled = false;
    g.add(base);
    const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.35, height, 8), columnBodyMat);
    shaft.name = `${name}-shaft`;
    shaft.position.y = height * 0.5 + 0.15;
    shaft.frustumCulled = false;
    g.add(shaft);
    const stripOffsets = [0, Math.PI * 0.5, Math.PI, Math.PI * 1.5];
    stripOffsets.forEach((a, idx) => {
      const strip = new THREE.Mesh(new THREE.BoxGeometry(0.05, height, 0.05), neonMat);
      strip.name = `${name}-led-${idx}`;
      strip.position.set(Math.cos(a) * 0.34, height * 0.5 + 0.15, Math.sin(a) * 0.34);
      strip.frustumCulled = false;
      g.add(strip);
    });
    group.add(g);
    return g;
  };
  makeColumn('synth-column-a-0', -34, -38, 8, columnNeonCyanMat, 0.1);
  makeColumn('synth-column-a-1', -28, -42, 10, columnNeonCyanMat, -0.3);
  makeColumn('synth-column-a-2', -30, -46, 12, columnNeonCyanMat, 0.5);
  makeColumn('synth-column-a-3', -24, -39, 10, columnNeonCyanMat, -0.8);
  makeColumn('synth-column-a-4', -37, -44, 8, columnNeonCyanMat, 1.0);
  makeColumn('synth-column-b-0', 37, -76, 10, columnNeonPurpleMat, 0.2);
  makeColumn('synth-column-b-1', 43, -82, 12, columnNeonPurpleMat, -0.4);
  makeColumn('synth-column-b-2', 46, -78, 10, columnNeonPurpleMat, 0.7);
  makeColumn('synth-column-c-0', -19, -116, 8, columnNeonCyanMat, 0.1);
  makeColumn('synth-column-c-1', -12, -122, 11, columnNeonPurpleMat, -0.2);
  makeColumn('synth-column-c-2', -16, -128, 11, columnNeonCyanMat, 0.6);
  makeColumn('synth-column-c-3', -10, -119, 8, columnNeonPurpleMat, -1.0);

  const makeArch = (name, x, z, ry) => {
    const y = terrainYAt(x, z);
    const g = new THREE.Group();
    g.name = name;
    g.position.set(x, y, z);
    g.rotation.y = ry;
    const parts = [
      [-5.6, 3.5, 0, 0.25, 7.0, 0.25],
      [5.6, 3.5, 0, 0.25, 7.0, 0.25],
      [-3.5, 10.0, 0, 0.25, 6.0, 0.25, 0, 0, -0.65],
      [3.5, 10.0, 0, 0.25, 6.0, 0.25, 0, 0, 0.65],
      [0, 12.4, 0, 0.35, 0.25, 2.0],
      [0, 6.7, 0, 8.0, 0.18, 0.18],
    ];
    parts.forEach((p, i) => {
      const m = new THREE.Mesh(new THREE.BoxGeometry(p[3], p[4], p[5]), archFrameMat);
      m.name = `${name}-frame-${i}`;
      m.position.set(p[0], p[1], p[2]);
      if (p.length > 6) m.rotation.set(p[6] || 0, p[7] || 0, p[8] || 0);
      m.frustumCulled = false;
      g.add(m);
      const glow = new THREE.Mesh(new THREE.BoxGeometry(p[3] * 0.25, p[4] * 0.9, p[5] * 0.25), archGlowMat);
      glow.name = `${name}-glow-${i}`;
      glow.position.copy(m.position);
      glow.rotation.copy(m.rotation);
      glow.frustumCulled = false;
      g.add(glow);
    });
    group.add(g);
  };
  makeArch('synth-arch-0', 0, -60, 0);
  makeArch('synth-arch-1', -25, -90, Math.PI * 0.15);

  const makeCrystal = (name, x, z, height, mat, tip = false) => {
    const y = terrainYAt(x, z);
    const g = new THREE.Group();
    g.name = name;
    g.position.set(x, y, z);
    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 0.8, height, 6), mat);
    body.name = `${name}-body`;
    body.position.y = height * 0.5;
    body.rotation.z = 0.15;
    body.frustumCulled = false;
    g.add(body);
    if (tip) {
      const tipMat = new THREE.MeshBasicMaterial({ color: 0xFFD700, transparent: true, opacity: 0.95 });
      registerFadeMaterial(tipMat);
      const cone = new THREE.Mesh(new THREE.ConeGeometry(0.25, 0.5, 6), tipMat);
      cone.name = `${name}-tip`;
      cone.position.y = height + 0.25;
      cone.frustumCulled = false;
      g.add(cone);
    }
    group.add(g);
    return g;
  };
  makeCrystal('synth-crystal-large-0', 20, -55, 4.8, crystalLargeMat, false);
  makeCrystal('synth-crystal-large-1', -35, -100, 5.2, crystalLargeMat, false);
  makeCrystal('synth-crystal-large-2', 10, -140, 4.5, crystalLargeMat, false);
  makeCrystal('synth-crystal-medium-0', 14, -58, 2.4, crystalMediumMat, true);
  makeCrystal('synth-crystal-medium-1', -40, -95, 2.8, crystalMediumMat, true);
  makeCrystal('synth-crystal-medium-2', -30, -108, 2.2, crystalMediumMat, true);
  makeCrystal('synth-crystal-medium-3', 18, -145, 2.6, crystalMediumMat, true);
  makeCrystal('synth-crystal-medium-4', 6, -132, 2.5, crystalMediumMat, true);
  makeCrystal('synth-crystal-medium-5', -2, -70, 2.1, crystalMediumMat, true);
  [[6, -61], [-2, -66], [22, -74], [-28, -103], [12, -118], [-12, -128], [31, -140], [-5, -145], [18, -88], [26, -57], [-18, -49], [0, -98], [9, -108], [42, -83], [-36, -74], [15, -35], [-20, -118], [5, -155]].forEach((p, i) => {
    const mats = [crystalSmallTealMat, crystalSmallPurpleMat, crystalSmallPinkMat];
    const m = mats[i % mats.length];
    const y = terrainYAt(p[0], p[1]);
    const c = new THREE.Mesh(new THREE.OctahedronGeometry(0.3), m);
    c.name = `synth-crystal-small-${i}`;
    c.position.set(p[0], y + 0.5, p[1]);
    c.scale.y = 1.5;
    c.rotation.set(0.3 * (i % 3), 0.4 * i, 0.2 * (i % 5));
    c.frustumCulled = false;
    group.add(c);
  });

  const makeBeam = (name, x, z) => {
    const y = terrainYAt(x, z);
    const core = new THREE.Mesh(new THREE.CylinderGeometry(1.0, 1.0, 40, 12, 1, true), lightBeamMat);
    core.name = `${name}-core`;
    core.position.set(x, y + 20, z);
    core.frustumCulled = false;
    group.add(core);
    const glow = new THREE.Mesh(new THREE.CylinderGeometry(1.6, 1.6, 40, 12, 1, true), new THREE.MeshBasicMaterial({ color: 0x00FFFF, transparent: true, opacity: 0.06, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
    glow.name = `${name}-glow`;
    glow.position.set(x, y + 20, z);
    glow.frustumCulled = false;
    registerFadeMaterial(glow.material);
    group.add(glow);
  };
  makeBeam('synth-beam-0', 20, -55);
  makeBeam('synth-beam-1', -35, -100);
  makeBeam('synth-beam-2', 10, -140);

  const orbDefs = [
    [5, 3, -30, orbCyanMat, 0.35],
    [-8, 4, -45, orbPurpleMat, 0.35],
    [15, 3, -65, orbPinkMat, 0.25],
    [-20, 4, -55, orbCyanMat, 0.25],
    [0, 3.5, -85, orbPurpleMat, 0.35],
    [30, 4, -75, orbPinkMat, 0.35],
    [-10, 3, -105, orbCyanMat, 0.35],
    [8, 3.5, -115, orbPurpleMat, 0.25],
  ];
  const orbitals = [];
  orbDefs.forEach((o, i) => {
    const mesh = new THREE.Mesh(new THREE.SphereGeometry(o[4], 12, 12), o[3]);
    mesh.name = `synth-orb-${i}`;
    mesh.position.set(o[0], floorY + o[1], o[2]);
    mesh.userData.baseY = mesh.position.y;
    mesh.userData.phase = i * 0.7;
    mesh.frustumCulled = false;
    group.add(mesh);
    orbitals.push(mesh);
  });

  const fanPositions = [[25, -50], [-30, -70], [15, -110]];
  fanPositions.forEach((p, i) => {
    const y = terrainYAt(p[0], p[1]);
    const g = new THREE.Group();
    g.name = `synth-fan-coral-${i}`;
    g.position.set(p[0], y, p[1]);
    for (let j = 0; j < 4; j++) {
      const plane = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 3), fanCoralMat);
      plane.name = `synth-fan-coral-${i}-plane-${j}`;
      plane.position.y = 1.5;
      plane.rotation.y = j * Math.PI * 0.5;
      plane.rotation.z = (j % 2 === 0 ? 0.15 : -0.15);
      plane.frustumCulled = false;
      g.add(plane);
    }
    group.add(g);
  });
  [[-12, -88], [8, -124], [34, -98], [-25, -60]].forEach((p, i) => {
    const y = terrainYAt(p[0], p[1]);
    const pyr = new THREE.Mesh(new THREE.ConeGeometry(1.0, 2.5, 4), pyramidMat);
    pyr.name = `synth-pyramid-${i}`;
    pyr.position.set(p[0], y + 1.25, p[1]);
    pyr.rotation.x = 0.15 + i * 0.03;
    pyr.rotation.z = 0.2 + i * 0.02;
    pyr.frustumCulled = false;
    group.add(pyr);
  });
  [[-20, -35], [35, -95]].forEach((p, i) => {
    const y = terrainYAt(p[0], p[1]);
    const g = new THREE.Group();
    g.name = `synth-circuit-tree-${i}`;
    g.position.set(p[0], y, p[1]);
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.25, 4, 6), circuitTreeMat);
    trunk.name = `synth-circuit-tree-${i}-trunk`;
    trunk.position.y = 2;
    trunk.frustumCulled = false;
    g.add(trunk);
    const nodeMat = new THREE.MeshBasicMaterial({ color: 0x00FFFF, transparent: true, opacity: 0.9 });
    registerFadeMaterial(nodeMat);
    for (let b = 0; b < 4; b++) {
      const branch = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.08, 2, 4), circuitTreeMat);
      branch.name = `synth-circuit-tree-${i}-branch-${b}`;
      branch.position.set(0, 2.4 + b * 0.2, 0);
      branch.rotation.set(0.7 - b * 0.1, b * 1.3, 0.4 * (b % 2 ? -1 : 1));
      branch.frustumCulled = false;
      g.add(branch);
      const node = new THREE.Mesh(new THREE.SphereGeometry(0.1), nodeMat);
      node.name = `synth-circuit-tree-${i}-node-${b}`;
      node.position.set(Math.cos(b) * 0.8, 3.2 + b * 0.3, Math.sin(b) * 0.8);
      node.frustumCulled = false;
      g.add(node);
    }
    group.add(g);
  });

  const crystalMaterials = [crystalLargeMat, crystalMediumMat, crystalSmallTealMat, crystalSmallPurpleMat, crystalSmallPinkMat, lightBeamMat, orbCyanMat, orbPurpleMat, orbPinkMat, archGlowMat, fanCoralMat, pyramidMat];
  group.userData.update = (time, deltaTime) => {
    const t = time;
    // Drive the floor and ridge color wave from one time uniform instead of touching geometry.
    terrainUniforms.uTime.value = t * 0.001;
    columnNeonCyanMat.opacity = 0.5 + 0.4 * Math.sin(t * 0.8);
    columnNeonPurpleMat.opacity = 0.5 + 0.4 * Math.sin(t * 0.6 + 1.0);
    archGlowMat.opacity = 0.25 + 0.15 * Math.sin(t * 0.5);
    crystalLargeMat.emissiveIntensity = 0.3 + 0.3 * Math.sin(t * 0.7);
    lightBeamMat.opacity = 0.08 + 0.06 * Math.sin(t * 0.4);
    orbCyanMat.opacity = 0.5 + 0.3 * Math.sin(t * 1.2);
    orbPurpleMat.opacity = 0.5 + 0.3 * Math.sin(t * 1.2 + 1.1);
    orbPinkMat.opacity = 0.5 + 0.3 * Math.sin(t * 1.2 + 2.2);
    orbitals.forEach((orb, i) => {
      orb.position.y = orb.userData.baseY + Math.sin(t * 0.6 + orb.userData.phase) * 0.8;
      orb.material.opacity = 0.5 + 0.3 * Math.sin(t * 1.2 + orb.userData.phase);
    });
    group.children.forEach((child) => {
      if (child.name && child.name.startsWith('synth-circuit-tree-')) {
        child.children.forEach((node) => {
          if (node.name && node.name.includes('-node-')) node.material.opacity = 0.55 + 0.35 * Math.sin(t * 1.1 + node.name.length);
        });
      }
    });
  };

  // Palm trees: solid black silhouettes on flat planes (not billboards) between player and mountains
  // Sparse placement, random scale/rotation, static in world space
  const palmTreeFiles = ['assets/palm_tree_1.svg', 'assets/palm_tree_2.svg', 'assets/palm_tree_3.svg'];
  const palmTreePositions = [
    { x: -8, z: -60, scale: 1.2, rotY: 0.1 },
    { x: 12, z: -80, scale: 0.9, rotY: -0.3 },
    { x: -15, z: -120, scale: 1.5, rotY: 0.5 },
    { x: 6, z: -45, scale: 0.7, rotY: -0.2 },
    { x: -4, z: -90, scale: 1.1, rotY: 0.4 },
    { x: 18, z: -140, scale: 1.3, rotY: -0.1 },
    { x: -20, z: -100, scale: 0.8, rotY: 0.2 },
  ];

  palmTreeFiles.forEach((svgPath, idx) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const size = 256;
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, size, size);
      const tex = new THREE.CanvasTexture(canvas);
      tex.needsUpdate = true;

      const mat = new THREE.MeshBasicMaterial({
        map: tex,
        color: 0x000000,  // Solid black silhouette
        transparent: true,
        side: THREE.DoubleSide,
        depthWrite: false,
        depthTest: true,
      });

      // Use position from array or generate random if more instances needed
      const pos = palmTreePositions[idx] || {
        x: (Math.random() - 0.5) * 40,
        z: -50 - Math.random() * 100,
        scale: 0.7 + Math.random() * 0.8,
        rotY: (Math.random() - 0.5) * 0.6
      };

      const planeGeo = new THREE.PlaneGeometry(8 * pos.scale, 12 * pos.scale);
      const palmPlane = new THREE.Mesh(planeGeo, mat);
      palmPlane.position.set(pos.x, 6 + 5.82, pos.z);  // Y offset to sit on ground + group offset
      palmPlane.rotation.y = pos.rotY;
      palmPlane.name = `palm-tree-${idx}`;
      palmPlane.userData.planeName = `palm-tree-${idx}`;
      group.add(palmPlane);
      registerFadeMaterial(mat);
    };
    img.src = svgPath;
  });

  // Fix for synthwave valley "jiggle":keep the imported scene static in-game.
  // The standalone HTML used perpetual scrolling and pulsing, but the game
  // version should behave like a stable biome backdrop.

  // Synthwave floor HUD height:group.position.y = 5.82
  group.position.set(0, 5.82, 0);

  // Rotate so player faces sun
  group.rotation.y = 0;
}
