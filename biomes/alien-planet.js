// ============================================================
//  BIOME: Alien Planet
//  Purple/green alien world with glowing plants and city
//  Extracted from biome-scenes.js (restored version)
// ============================================================

import * as THREE from 'three';
import { bakeCloudsToCanvas } from '../bake-clouds.js';

export function buildAlienPlanetScene(group, deps) {
  const { registerFadeMaterial, floorMaterial, biomeTerrainMaterials } = deps;
  const floorHeight = (floorMaterial && floorMaterial.userData && floorMaterial.userData.floorHeight) || -0.01;
  const floorY = floorHeight - 0.3; // Move everything down 0.3 units to fix floor HUD being under floor

  // Fix 6: Ground with noise-based color variation for visual interest (Quest-friendly)
  // Uses a simple ShaderMaterial with cheap hash-based noise instead of flat MeshLambertMaterial
  const groundGeo = new THREE.PlaneGeometry(345, 345, 96, 96);
  const groundPositions = groundGeo.attributes.position;
  // Seeded pseudo-random for consistent terrain across reloads
  let _seed = 42;
  const srand = () => { _seed = (_seed * 16807 + 0) % 2147483647; return (_seed - 1) / 2147483646; };
  for (let i = 0; i < groundPositions.count; i++) {
    const x = groundPositions.getX(i);
    const y = groundPositions.getY(i);
    const dist = Math.sqrt(x * x + y * y);
    const rawHeight = srand() * 0.7;
    // Flat combat area: within 20m of origin, clamp to 0-0.2
    const maxHeight = dist < 20 ? 0.2 : 0.7;
    groundPositions.setZ(i, Math.min(rawHeight, maxHeight));
  }
  groundGeo.computeVertexNormals();
  const groundMat = new THREE.ShaderMaterial({
    uniforms: {
      uBaseColor: { value: new THREE.Color(0x0a0510) },
      uLightDir: { value: new THREE.Vector3(0.3, 1.0, 0.2).normalize() },
    },
    vertexShader: `
      varying vec2 vUv;
      varying vec3 vNormal;
      varying vec3 vWorldPos;
      void main() {
        vUv = uv;
        vNormal = normalize(normalMatrix * normal);
        vec4 worldPos = modelMatrix * vec4(position, 1.0);
        vWorldPos = worldPos.xyz;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform vec3 uBaseColor;
      uniform vec3 uLightDir;
      varying vec2 vUv;
      varying vec3 vNormal;
      varying vec3 vWorldPos;
      // Cheap hash-based noise for ground variation
      float hash(vec2 p) {
        return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
      }
      float noise(vec2 p) {
        vec2 i = floor(p);
        vec2 f = fract(p);
        f = f * f * (3.0 - 2.0 * f);
        float a = hash(i);
        float b = hash(i + vec2(1.0, 0.0));
      float c = hash(i + vec2(0.0, 1.0));
        float d = hash(i + vec2(1.0, 1.0));
        return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
      }
      void main() {
        // World-space noise for color variation
        float n = noise(vWorldPos.xz * 0.04) * 0.6 + noise(vWorldPos.xz * 0.1) * 0.4;
        // Subtle color bands: dark purple to dark green
        vec3 color1 = vec3(0.04, 0.02, 0.06);  // Dark purple
        vec3 color2 = vec3(0.02, 0.05, 0.03);  // Dark green
        vec3 color3 = vec3(0.03, 0.02, 0.04);  // Mid purple
        vec3 baseColor = mix(color1, color2, smoothstep(0.3, 0.7, n));
        baseColor = mix(baseColor, color3, smoothstep(0.4, 0.6, noise(vWorldPos.xz * 0.02 + 5.0)));
        // Simple diffuse lighting
        float diffuse = max(dot(vNormal, uLightDir), 0.0) * 0.4 + 0.6;
        // Noise-based ground texture: layered noise for organic alien ground look
        float detail1 = noise(vWorldPos.xz * 0.15);
        float detail2 = noise(vWorldPos.xz * 0.4 + 3.7);
        float detail = detail1 * 0.6 + detail2 * 0.4;
        // Mix in subtle color variation: mossy green and deep purple patches
        vec3 patchColor = mix(vec3(0.03, 0.06, 0.02), vec3(0.05, 0.02, 0.07), detail);
        baseColor = mix(baseColor, patchColor, 0.35);
        // Sparse bright speckles (alien mineral deposits)
        float speckle = smoothstep(0.82, 0.88, noise(vWorldPos.xz * 1.2 + 7.0));
        baseColor += vec3(0.0, 0.08, 0.04) * speckle;
        gl_FragColor = vec4(baseColor * diffuse, 1.0);
      }
    `,
    depthWrite: true,
  });
  const ground = new THREE.Mesh(groundGeo, groundMat);
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = floorY;
  ground.frustumCulled = false;
  group.add(ground);
  registerFadeMaterial(groundMat);

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
  flashPlane.rotation.x = -Math.PI / 2;
  flashPlane.position.y = floorY + 0.1;
  flashPlane.frustumCulled = false;
  group.add(flashPlane);
  biomeTerrainMaterials.push({ type: 'overlay', material: flashMat });

  // Green-gradient skydome (similar structure to desert biome but green tones)
  const skyGeo = new THREE.SphereGeometry(2200, 24, 18);
  const skyMat = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    uniforms: {
      topColor: { value: new THREE.Color(0x020a04) },      // Deep dark green-black
      midColor: { value: new THREE.Color(0x0a2a12) },       // Dark forest green
      horizonColor: { value: new THREE.Color(0x1a4a1a) },   // Bright green horizon
      glowColor: { value: new THREE.Color(0x22aa44) },      // Neon green glow band
    },
    vertexShader: `varying vec3 vWorldPosition; void main(){ vec4 worldPosition=modelMatrix*vec4(position,1.0); vWorldPosition=worldPosition.xyz; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }`,
    fragmentShader: `varying vec3 vWorldPosition; uniform vec3 topColor; uniform vec3 midColor; uniform vec3 horizonColor; uniform vec3 glowColor; void main(){ float worldY=vWorldPosition.y; float t1=smoothstep(-140.0,220.0,worldY); float t2=smoothstep(120.0,780.0,worldY); float t3=smoothstep(300.0,1200.0,worldY); vec3 col=horizonColor; col=mix(col,glowColor,t1); col=mix(col,midColor,t2); col=mix(col,topColor,t3); col=pow(col,vec3(1.0/2.2)); gl_FragColor=vec4(col*0.6,1.0); }`,
    depthWrite: false,
  });
  const sky = new THREE.Mesh(skyGeo, skyMat);
  sky.frustumCulled = false;
  sky.renderOrder = -20;
  group.add(sky);
  registerFadeMaterial(skyMat);

  // ── CLOUD DOME (baked to texture for Quest performance) ──
  // Fix 3: Dark clouds - very low color values for near-black storm clouds
  const cloudTex = bakeCloudsToCanvas({
    width: 1024, height: 512,
    horizonColor: [0.005, 0.008, 0.005],  // Near-black dark green
    cloudColor: [0.008, 0.003, 0.012],    // Near-black dark purple
    skyColor: [0.002, 0.001, 0.004],      // Almost black
    sunDir: [60, 80, -40],
    seed: 99,
  });
  const cloudGeo = new THREE.SphereGeometry(900, 24, 12);
  const cloudMat = new THREE.MeshBasicMaterial({
    map: cloudTex,
    side: THREE.BackSide,
    transparent: true,
    depthWrite: false,
    depthTest: true,
    fog: false,
  });
  const cloudDome = new THREE.Mesh(cloudGeo, cloudMat);
  cloudDome.name = 'alien-planet-cloud-dome';
  cloudDome.position.set(0, 0, 0);
  cloudDome.frustumCulled = false;
  cloudDome.renderOrder = -15;
  group.add(cloudDome);
  registerFadeMaterial(cloudMat);

  // Fix 4: Moon moved to new position with compensated scale for same apparent size
  // Old pos: (60, 80, -40), D1 ≈ 107.7
  // New pos: (167.604, 179.058, -259.910), D2 ≈ 357.4
  // Scale factor = D2/D1 ≈ 3.317
  const moonTargetPos = new THREE.Vector3(167.604, 179.058, -259.910);
  const moonScaleFactor = 3.317;
  const moonGeo = new THREE.IcosahedronGeometry(24, 1);
  const moonMat = new THREE.MeshBasicMaterial({ color: 0xddaaff, transparent: true, opacity: 0.95 });
  const moon = new THREE.Mesh(moonGeo, moonMat);
  moon.position.copy(moonTargetPos);
  moon.scale.setScalar(moonScaleFactor);
  moon.frustumCulled = false;
  group.add(moon);
  const moonGlowGeo = new THREE.IcosahedronGeometry(36, 1);
  const moonGlowMat = new THREE.MeshBasicMaterial({ color: 0xaa66ff, transparent: true, opacity: 0.15, side: THREE.BackSide });
  const moonGlow = new THREE.Mesh(moonGlowGeo, moonGlowMat);
  moonGlow.position.copy(moonTargetPos);
  moonGlow.scale.setScalar(moonScaleFactor);
  moonGlow.frustumCulled = false;
  group.add(moonGlow);

  // Lighting - moonLight for ambient scene lighting (shadows DISABLED for FPS)
  const moonLight = new THREE.DirectionalLight(0xcc88ff, 35);
  moonLight.position.copy(moonTargetPos);
  // SHADOWS DISABLED - major FPS cost in this biome
  moonLight.castShadow = false;
  group.add(moonLight);

  // Green light - moved HIGH (y: 35) to not block view
  const greenLight = new THREE.PointLight(0x44ffaa, 8, 80);
  greenLight.position.set(0, 35, 0);
  group.add(greenLight);

  // Purple accent lights
  const purpleLight1 = new THREE.PointLight(0x6622aa, 1.5, 50);
  purpleLight1.position.set(-30, 20, -30);
  group.add(purpleLight1);

  const purpleLight2 = new THREE.PointLight(0x8833cc, 1.2, 45);
  purpleLight2.position.set(25, 18, 35);
  group.add(purpleLight2);

  // River path used for plant placement (but no visible river mesh)
  const riverPoints = [];
  for (let i = 0; i < 60; i++) {
    const t = i / 59;
    const x = Math.sin(t * Math.PI * 2.5) * 12 + Math.sin(t * Math.PI * 5) * 4;
    const z = t * 120 - 60;
    riverPoints.push(new THREE.Vector3(x, 0.1, z));
  }
  // Green river-object REMOVED - was blocking view and looking out of place

  // ── Shared materials & geometries (PERF: reduces ~120 unique mats to ~12) ──
  const sharedMountainMat = new THREE.MeshLambertMaterial({
    color: 0x1a1020, flatShading: true
  });
  const sharedDistantMountainMat = new THREE.MeshLambertMaterial({
    color: 0x0a2015, flatShading: true
  });
  const sharedSpireMat = new THREE.MeshLambertMaterial({
    color: 0x00aa33, emissive: 0x00ff44, emissiveIntensity: 0.6
  });
  const sharedOrbGeo = new THREE.IcosahedronGeometry(0.3, 1);
  const sharedOrbMat = new THREE.MeshBasicMaterial({ color: 0x00ff66 });
  const sharedCrystalMat = new THREE.MeshLambertMaterial({
    color: 0x00cc55, emissive: 0x00ff66, emissiveIntensity: 0.7
  });
  const sharedStemMat = new THREE.MeshLambertMaterial({ color: 0x204020 });
  const sharedCapGeo = new THREE.SphereGeometry(0.4, 6, 4, 0, Math.PI * 2, 0, Math.PI / 2);
  const sharedCapMat = new THREE.MeshLambertMaterial({
    color: 0x00aa44, emissive: 0x00ff55, emissiveIntensity: 0.5
  });
  const sharedCritterBodyMat = new THREE.MeshLambertMaterial({
    color: 0x00aa55, emissive: 0x00ff66, emissiveIntensity: 0.4
  });
  const sharedCritterGlowMat = new THREE.MeshBasicMaterial({
    color: 0x33ffaa, transparent: true, opacity: 0.3
  });

  // Mountains - 3 rings of procedural jagged mountains
  const createMountain = (x, z, scale) => {
    const peakCount = 1 + Math.floor(Math.random() * 3);
    const mountainGroup = new THREE.Group();
    for (let p = 0; p < peakCount; p++) {
      const height = (12 + Math.random() * 18) * scale;
      const radius = Math.max(2.5, (2 + Math.random() * 3) * scale);
      const peakGeo = new THREE.ConeGeometry(radius, height, 6);
      const peak = new THREE.Mesh(peakGeo, sharedMountainMat);
      peak.position.set(
        (Math.random() - 0.5) * 4 * scale,
        height / 2,
        (Math.random() - 0.5) * 4 * scale
      );
      peak.castShadow = true;
      peak.receiveShadow = true;
      mountainGroup.add(peak);
    }
    mountainGroup.position.set(x, floorY, z);
    mountainGroup.frustumCulled = false;
    return mountainGroup;
  };

  // Mountains - single ring for FPS (was 2 rings = 24 mountains)
  for (let ring = 0; ring < 1; ring++) {
    const count = 14;  // Single ring of 14 mountains (was 8+16=24)
    const radius = 60;  // Pushed 20 units farther from player
    for (let i = 0; i < count; i++) {
      const angle = (i / count) * Math.PI * 2 + Math.random() * 0.3;
      const r = radius + (Math.random() - 0.5) * 10;
      const x = Math.cos(angle) * r;
      const z = Math.sin(angle) * r;
      group.add(createMountain(x, z, 1.2 + Math.random() * 0.6));
    }
  }

  // Alien Plants - 3 types along river (removed fern type - too expensive with 40-72 meshes)
  const alienPlants = [];

  const createAlienPlant = (x, z, type) => {
    const plantGroup = new THREE.Group();

    if (type === 0) {
      // Glowing Spire - tall thin cone with glowing orb on top (shared mat/geo)
      const height = 3 + Math.random() * 5;
      const spireGeo = new THREE.ConeGeometry(0.2, height, 4);
      const spire = new THREE.Mesh(spireGeo, sharedSpireMat);
      spire.position.y = height / 2;
      plantGroup.add(spire);

      const orb = new THREE.Mesh(sharedOrbGeo, sharedOrbMat);
      orb.position.y = height + 0.2;
      plantGroup.add(orb);

    } else if (type === 1) {
      // Crystal Cluster - 2 small angular cones (reduced from 3, shared mat)
      for (let c = 0; c < 2; c++) {
        const height = 0.8 + Math.random() * 1.2;
        const crystalGeo = new THREE.ConeGeometry(0.15, height, 3);
        const crystal = new THREE.Mesh(crystalGeo, sharedCrystalMat);
        crystal.position.set(
          (Math.random() - 0.5) * 0.4,
          height / 2,
          (Math.random() - 0.5) * 0.4
        );
        crystal.rotation.set(
          (Math.random() - 0.5) * 0.4,
          Math.random() * Math.PI,
          (Math.random() - 0.5) * 0.4
        );
        plantGroup.add(crystal);
      }

    } else if (type === 2) {
      // Mushroom - cylinder stem + hemisphere cap (shared mat/geo)
      const stemHeight = 0.5 + Math.random() * 0.5;
      const stemGeo = new THREE.CylinderGeometry(0.1, 0.15, stemHeight, 6);
      const stem = new THREE.Mesh(stemGeo, sharedStemMat);
      stem.position.y = stemHeight / 2;
      plantGroup.add(stem);

      const cap = new THREE.Mesh(sharedCapGeo, sharedCapMat);
      cap.position.y = stemHeight;
      plantGroup.add(cap);
    }

    plantGroup.position.set(x, floorY, z);
    return plantGroup;
  };

  // Place 15 plants along river with random offsets (reduced for FPS)
  for (let i = 0; i < 15; i++) {
    const t = Math.random();
    const riverT = t * 59;
    const idx = Math.floor(riverT);
    const frac = riverT - idx;

    const p1 = riverPoints[Math.min(idx, 59)];
    const p2 = riverPoints[Math.min(idx + 1, 59)];

    const x = p1.x + (p2.x - p1.x) * frac + (Math.random() - 0.5) * 8;
    const z = p1.z + (p2.z - p1.z) * frac + (Math.random() - 0.5) * 8;

    // Keep plants away from river center
    const distToCenter = Math.abs(x - (p1.x + (p2.x - p1.x) * frac));
    if (distToCenter < 3) continue;

    // AGGRESSIVE: Skip plants behind player (positive Z)
    if (z > 0) continue;

    // Clearance zone: no tall plants within 12 units directly in front of player spawn
    const clearanceRadius = 12;
    const distToPlayer = Math.sqrt(x * x + z * z);
    if (distToPlayer < clearanceRadius && z < 5) {
      continue; // Skip this plant to keep front area clear
    }

    const plantType = Math.floor(Math.random() * 3);  // Only 3 types (removed fern)
    const plant = createAlienPlant(x, z, plantType);
    // Shadow casting disabled for FPS
    alienPlants.push(plant);
    group.add(plant);
  }

  // Extra flora spread around the player (reduced for FPS)
  // AGGRESSIVE: Only spawn in front of player (negative Z, front 180-degree arc)
  for (let i = 0; i < 15; i++) {  // Reduced from 50 to 15 (total plants: 30 instead of 100)
    const angle = Math.random() * Math.PI * 2;
    const radius = 8 + Math.random() * 40;
    const x = Math.cos(angle) * radius + (Math.random() - 0.5) * 8;
    const z = Math.sin(angle) * radius + (Math.random() - 0.5) * 8;

    // AGGRESSIVE: Skip objects behind player (positive Z)
    if (z > 0) continue;

    // Clearance zone: no tall plants within 12 units directly in front of player spawn
    const clearanceRadius = 12;
    const distToPlayer = Math.sqrt(x * x + z * z);
    if (distToPlayer < clearanceRadius && z < 5) {
      continue; // Skip this plant to keep front area clear
    }

    const plantType = Math.floor(Math.random() * 3);  // Only 3 types (removed fern)
    const plant = createAlienPlant(x, z, plantType);
    alienPlants.push(plant);
    group.add(plant);
  }

  // Small fauna critters (reduced for FPS, shared materials)
  // AGGRESSIVE: Only spawn in front of player (negative Z)
  const critterGeo = new THREE.SphereGeometry(0.18, 6, 4);
  const critterGlowGeo = new THREE.SphereGeometry(0.3, 6, 4);
  for (let i = 0; i < 5; i++) {  // Reduced from 10 to 5 for FPS
    const angle = Math.random() * Math.PI * 2;
    const radius = 6 + Math.random() * 35;
    const x = Math.cos(angle) * radius + (Math.random() - 0.5) * 4;
    const z = Math.sin(angle) * radius + (Math.random() - 0.5) * 4;

    // AGGRESSIVE: Skip critters behind player (positive Z)
    if (z > 0) continue;

    const critterGroup = new THREE.Group();
    const body = new THREE.Mesh(critterGeo, sharedCritterBodyMat);
    body.position.y = 0.2;
    critterGroup.add(body);

    const glow = new THREE.Mesh(critterGlowGeo, sharedCritterGlowMat);
    glow.position.y = 0.2;
    critterGroup.add(glow);

    critterGroup.position.set(x, floorY, z);
    critterGroup.rotation.y = Math.random() * Math.PI * 2;
    group.add(critterGroup);
  }

  // Fireflies - 25 particles with gentle drift (reduced from 60 for FPS)
  // AGGRESSIVE: Only spawn in front of player (negative Z)
  const fireflyPositions = [];
  const fireflyGeo = new THREE.BufferGeometry();

  for (let i = 0; i < 25; i++) {
    const angle = Math.random() * Math.PI * 2;
    const radius = 4 + Math.random() * 35;
    const x = Math.cos(angle) * radius + (Math.random() - 0.5) * 3;
    const z = Math.sin(angle) * radius + (Math.random() - 0.5) * 3;
    const y = 0.5 + Math.random() * 3;  // Float above ground

    // AGGRESSIVE: Skip fireflies behind player (positive Z)
    if (z > 0) continue;

    fireflyPositions.push(x, y, z);
  }

  fireflyGeo.setAttribute('position', new THREE.Float32BufferAttribute(fireflyPositions, 3));
  const fireflyMat = new THREE.PointsMaterial({
    color: 0x44ff88,
    size: 0.12,
    transparent: true,
    opacity: 0.9,
    sizeAttenuation: true
  });
  const fireflies = new THREE.Points(fireflyGeo, fireflyMat);
  fireflies.frustumCulled = false; // Fix disappearing when looking up
  group.add(fireflies);

  // River sparkles removed along with river mesh

  // Instanced city - FAR on horizon (was too close at 55-100)
  // Fix 5: Building lights now animate colors via slow sine wave modulation
  const cityShaderMat = new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uMoonDir: { value: new THREE.Vector3(167.604, 179.058, -259.910).normalize() },
      uMoonColor: { value: new THREE.Color(0xcc88ff) },
      uBaseColor: { value: new THREE.Color(0x0a0a15) }
    },
    vertexShader: `varying vec2 vUv; varying vec3 vNormal; varying vec3 vWorldPos; void main(){ vUv=uv; vNormal=normalize(normalMatrix*normal); vec4 worldPos=modelMatrix*instanceMatrix*vec4(position,1.0); vWorldPos=worldPos.xyz; gl_Position=projectionMatrix*viewMatrix*worldPos; }`,
    fragmentShader: `uniform float uTime; uniform vec3 uMoonDir; uniform vec3 uMoonColor; uniform vec3 uBaseColor; varying vec2 vUv; varying vec3 vNormal; float rand(vec2 co){ return fract(sin(dot(co, vec2(12.9898,78.233)))*43758.5453);} void main(){ float moonLight=max(dot(vNormal,uMoonDir),0.0); vec3 finalColor=uBaseColor*(0.2+moonLight*0.8)*uMoonColor; vec2 uv=vUv; float numWindowsX=6.0; float numWindowsY=15.0; vec2 grid=floor(vec2(uv.x*numWindowsX, uv.y*numWindowsY)); vec2 gridUv=fract(vec2(uv.x*numWindowsX, uv.y*numWindowsY)); float windowMask=smoothstep(0.12,0.18,gridUv.x)*smoothstep(0.18,0.12,1.0-gridUv.x)*smoothstep(0.08,0.13,gridUv.y)*smoothstep(0.13,0.08,1.0-gridUv.y); float r=rand(grid); float isLit=step(0.5,r); if(windowMask>0.5 && isLit>0.5){ float colorShift=sin(uTime*0.3+rand(grid)*6.283)*0.5+0.5; vec3 windowColor=mix(vec3(0.0,1.0,0.5),vec3(0.5,0.0,1.0),colorShift); vec3 accentColor=mix(vec3(1.0,0.2,0.4),vec3(0.2,0.8,1.0),sin(uTime*0.15+rand(grid*1.3)*6.283)*0.5+0.5); windowColor=mix(windowColor,accentColor,step(0.7,rand(grid*2.1))); float flicker=0.9+0.1*sin(uTime*2.0+rand(grid)*10.0); finalColor=windowColor*flicker*1.5; } gl_FragColor=vec4(finalColor,1.0); }`
  });
  const boxGeo = new THREE.BoxGeometry(1, 1, 1);
  const cylinderGeo = new THREE.CylinderGeometry(0.5, 0.5, 1, 6);
  const coneGeo = new THREE.BoxGeometry(1, 1, 1);
  const dummy = new THREE.Object3D();
  const cityMeshes = [];

  const generateCityLayer = (geometry, count, minDist, maxDist, minHeight, maxHeight) => {
    const mesh = new THREE.InstancedMesh(geometry, cityShaderMat, count);
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const dist = minDist + Math.random() * (maxDist - minDist);
      const height = minHeight + Math.random() * (maxHeight - minHeight);
      const width = 1.5 + Math.random() * 4.5; // 3x thicker (was 0.5 + Math.random() * 1.5)
      dummy.position.set(Math.cos(angle) * dist, (height / 2) - 3, Math.sin(angle) * dist);
      dummy.scale.set(width, height, width);
      dummy.rotation.y = Math.random() * Math.PI;
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
    }
    return mesh;
  };

  // Far background city on horizon (REDUCED for FPS: was 100+80+60=240, now 30+25+20=75)
  cityMeshes.push(generateCityLayer(boxGeo, 30, 120, 150, 30, 60));
  cityMeshes.push(generateCityLayer(cylinderGeo, 25, 140, 180, 40, 80));
  cityMeshes.push(generateCityLayer(coneGeo, 20, 160, 200, 50, 100));
  cityMeshes.forEach((mesh) => group.add(mesh));

  // Mega towers - far on horizon (REDUCED for FPS: was 10)
  const megaGeo = new THREE.CylinderGeometry(1, 1.5, 1, 5);
  const megaMesh = new THREE.InstancedMesh(megaGeo, cityShaderMat, 5);
  for (let i = 0; i < 5; i++) {
    const angle = (i / 5) * Math.PI * 2;
    const dist = 160 + Math.random() * 20;
    const h = 110 + Math.random() * 20;
    dummy.position.set(Math.cos(angle) * dist, (h / 2) - 3, Math.sin(angle) * dist); // Issue 5: Lower mega towers by 3 units
    dummy.scale.set(5, h, 5);
    dummy.updateMatrix();
    megaMesh.setMatrixAt(i, dummy.matrix);
  }
  cityMeshes.push(megaMesh);
  group.add(megaMesh);

  // Issue 7: Distant low-poly mountains at ~100 units (alien planet colors)
  const createDistantMountain = (x, z, scale) => {
    const peakCount = 1 + Math.floor(Math.random() * 2);
    const mountainGroup = new THREE.Group();
    for (let p = 0; p < peakCount; p++) {
      const height = (30 + Math.random() * 50) * scale;
      const radius = Math.max(6, (6 + Math.random() * 10) * scale);
      const peakGeo = new THREE.ConeGeometry(radius, height, 6);
      const peak = new THREE.Mesh(peakGeo, sharedDistantMountainMat);
      peak.position.set(
        (Math.random() - 0.5) * 6 * scale,
        height / 2,
        (Math.random() - 0.5) * 6 * scale
      );
      mountainGroup.add(peak);
    }
    mountainGroup.position.set(x, floorY, z);
    mountainGroup.frustumCulled = false;
    return mountainGroup;
  };

  // Ring of 10 distant mountains at ~100 units (closer for visibility with fog)
  const distantMountainCount = 10;
  const distantMountainRadius = 100;
  for (let i = 0; i < distantMountainCount; i++) {
    const angle = (i / distantMountainCount) * Math.PI * 2 + (Math.random() - 0.5) * 0.3;
    const r = distantMountainRadius + (Math.random() - 0.5) * 20;
    const x = Math.cos(angle) * r;
    const z = Math.sin(angle) * r;
    group.add(createDistantMountain(x, z, 1.0 + Math.random() * 0.5));
  }

  // Darkened mountain wrap cylinder (synthwave asset, very dark for silhouette backdrop)
  const alienMountainTex = new THREE.TextureLoader().load('assets/mountain_wrap.png');
  alienMountainTex.wrapS = THREE.RepeatWrapping;
  alienMountainTex.wrapT = THREE.ClampToEdgeWrapping;
  const alienMtnRadius = 148;  // Fits within 300x300 floor
  const alienMtnRepeatWidth = 2808;
  alienMountainTex.repeat.set((2 * Math.PI * alienMtnRadius) / alienMtnRepeatWidth, 1);
  const alienMtnRepeatCount = alienMountainTex.repeat.x;
  alienMountainTex.offset.x = 0.5 - (0.5 / alienMtnRepeatCount);

  // Height proportional to keep PNG aspect: circumference / aspect_ratio
  // circumference = 2*PI*148 ≈ 930, aspect = 14.78, so height ≈ 63
  // Fix 1: Reduced to 50% height (scaled Y by 0.5)
  const alienMtnHeight = Math.round((2 * Math.PI * alienMtnRadius) / 14.78);
  const alienMtnCylGeo = new THREE.CylinderGeometry(alienMtnRadius, alienMtnRadius, alienMtnHeight, 64, 1, true);
  const alienMtnCylMat = new THREE.ShaderMaterial({
    uniforms: {
      uTexture: { value: alienMountainTex }
    },
    vertexShader: `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform sampler2D uTexture;
      varying vec2 vUv;
      void main() {
        vec4 texColor = texture2D(uTexture, vUv);
        // Fix 2: Discard near-transparent pixels so they don't occlude objects behind
        if (texColor.a < 0.3) discard;
        float brightness = dot(texColor.rgb, vec3(0.299, 0.587, 0.114));
        // Keep mountains near-black, just enough shape to see silhouettes
        vec3 darkColor = vec3(brightness * 0.08);
        gl_FragColor = vec4(darkColor, 1.0);
      }
    `,
    transparent: false,
    side: THREE.BackSide,
    depthWrite: true,
    depthTest: true,
    fog: false
  });
  const alienMtnCylinder = new THREE.Mesh(alienMtnCylGeo, alienMtnCylMat);
  alienMtnCylinder.name = 'alien-mountain-wrap';
  // Fix 1: Position at 50% height (half of original alienMtnHeight/2)
  alienMtnCylinder.position.set(-6.628, alienMtnHeight / 4, 13.926);
  alienMtnCylinder.scale.y = 0.5;  // Fix 1: 50% height, maintains XZ proportions
  alienMtnCylinder.frustumCulled = false;
  alienMtnCylinder.renderOrder = -1;
  group.add(alienMtnCylinder);

  // Animation update - OPTIMIZED: stagger updates to reduce per-frame cost
  let frameCounter = 0;
  group.userData.update = (now, dt) => {
    frameCounter++;
    const time = now * 0.001;

    // City shader: update every frame (cheap - just uniform)
    cityShaderMat.uniforms.uTime.value = time;

    // Cloud dome: update every frame (cheap - just uniform)
    // Cloud animation disabled for Quest performance - static clouds
    // cloudUniforms.uTime.value = time;

    // Green light pulse: every frame (cheap - single value)
    greenLight.intensity = 8 + Math.sin(time * 2) * 0.3;

    // REMOVED: Firefly drift animation - per-frame position updates were too expensive
    // Fireflies are now static for better FPS

    // REMOVED: Plant sway animation - per-frame rotation was too expensive
    // Plants are now static for better FPS
  };

  group.rotation.y = -0.062; // yaw: 3.55°

  // Alien floor HUD height: group.position.y = -0.28
  group.position.set(6.628, -0.28, -13.926);
}
