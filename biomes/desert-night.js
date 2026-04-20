// ============================================================
//  BIOME: Desert Night
//  Moonlit desert with cacti, stars, and dust particles
//  Extracted from biome-scenes.js (restored version)
// ============================================================

import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

export function buildDesertNightScene(group, deps) {
  const { registerFadeMaterial, floorMaterial, biomeTerrainMaterials, synthVisualRefs } = deps;
  const floorHeight = (floorMaterial && floorMaterial.userData && floorMaterial.userData.floorHeight) || -0.01;
  const floorY = floorHeight;
  const sceneColor = 0x06080c;
  const duneOutlineColor = 0xAB3A93;

  // === LIGHTING (CRITICAL) ===
  // Pale moonlight with shadows
  const moonLight = new THREE.DirectionalLight(0xd4e5f7, 2.34);
  moonLight.position.set(-30, 50, -30);
  moonLight.castShadow = true;
  moonLight.shadow.mapSize.width = 512;
  moonLight.shadow.mapSize.height = 512;
  moonLight.shadow.camera.near = 1;
  moonLight.shadow.camera.far = 200;
  moonLight.shadow.camera.left = -60;
  moonLight.shadow.camera.right = 60;
  moonLight.shadow.camera.top = 60;
  moonLight.shadow.camera.bottom = -60;
  moonLight.shadow.bias = -0.0005;
  group.add(moonLight);

  // Hemisphere light provides sky/ground ambient (replaces separate AmbientLight + HemisphereLight)
  const hemiLight = new THREE.HemisphereLight(0x1a2035, 0x2d1f1a, 0.35);
  group.add(hemiLight);

  // Front-fill light - moonlit blue over player position
  const frontFillLight = new THREE.PointLight(0xe0f4ff, 120, 60);
  frontFillLight.position.set(2.12, 6, 4.82);  // Centered over player (world origin)
  group.add(frontFillLight);

  // Desert skydome mirrors the synthwave setup structurally, but uses moonlit sand tones
  // at half brightness so the desert reads darker and calmer than the neon biome.
  const skyGeo = new THREE.SphereGeometry(2200, 24, 18);
  const skyMat = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    uniforms: {
      topColor: { value: new THREE.Color(0x0c0610) },
      midColor: { value: new THREE.Color(0x2a1230) },
      horizonColor: { value: new THREE.Color(0x6a1848) },
      moonGlowColor: { value: new THREE.Color(0x8a4068) },
    },
    vertexShader: `varying vec3 vWorldPosition; void main(){ vec4 worldPosition=modelMatrix*vec4(position,1.0); vWorldPosition=worldPosition.xyz; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }`,
    fragmentShader: `varying vec3 vWorldPosition; uniform vec3 topColor; uniform vec3 midColor; uniform vec3 horizonColor; uniform vec3 moonGlowColor; void main(){ float worldY=vWorldPosition.y; float t1=smoothstep(-140.0,220.0,worldY); float t2=smoothstep(120.0,780.0,worldY); float t3=smoothstep(300.0,1200.0,worldY); vec3 col=horizonColor; col=mix(col,moonGlowColor,t1); col=mix(col,midColor,t2); col=mix(col,topColor,t3); col=pow(col,vec3(1.0/2.2)); gl_FragColor=vec4(col*0.5,1.0); }`,
    depthWrite: false,
  });
  const sky = new THREE.Mesh(skyGeo, skyMat);
  sky.name = 'desert-skydome';
  sky.frustumCulled = false;
  sky.renderOrder = -20;
  group.add(sky);
  registerFadeMaterial(skyMat);

  const buildDunePanel = ({ width, depth, segmentsX, segmentsZ, centerX, centerZ, flatRadius, mountainStart }, panelIndex) => {
    const geometry = new THREE.PlaneGeometry(width, depth, segmentsX, segmentsZ);
    geometry.rotateX(-Math.PI / 2);
    const positions = geometry.attributes.position;
    const colors = [];
    const baseColor = new THREE.Color(0x2a241b);
    const highlightColor = new THREE.Color(0x585144);
    const moonTint = new THREE.Color(0x404a5a);

    for (let i = 0; i < positions.count; i++) {
      const localX = positions.getX(i);
      const localZ = positions.getZ(i);
      const worldX = centerX + localX;
      const worldZ = centerZ + localZ;
      const dist = Math.sqrt(localX * localX + localZ * localZ);
      let heightFactor = Math.min(Math.max((dist - flatRadius) / (mountainStart - flatRadius), 0), 1);
      heightFactor = heightFactor * heightFactor * (3 - 2 * heightFactor);

      let height = 0;
      height += Math.sin(worldX * 0.08 + 0.5) * Math.cos(worldZ * 0.06) * 4.0;
      height += Math.sin(worldX * 0.04 + 2) * Math.sin(worldZ * 0.05 + 1) * 3.0;
      height += Math.sin(worldX * 0.15 + worldZ * 0.1) * 1.5;
      height += Math.cos(worldZ * 0.12 - worldX * 0.08) * 1.0;
      height += Math.sin(worldX * 0.3) * Math.cos(worldZ * 0.25) * 0.5;
      if (dist > mountainStart) {
        height += Math.sin(worldX * 0.4 + worldZ * 0.3) * 2.0;
        height += Math.cos(worldX * 0.2 - worldZ * 0.5) * 2.5;
      }

      const finalHeight = height * heightFactor;
      positions.setY(i, finalHeight);
      const heightNorm = (finalHeight + 5) / 15;
      const color = baseColor.clone().lerp(highlightColor, Math.max(0, Math.min(1, heightNorm)));
      color.lerp(moonTint, heightNorm * 0.2);
      colors.push(color.r, color.g, color.b);
    }

    geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    geometry.computeVertexNormals();

    const material = new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true });
    const terrain = new THREE.Mesh(geometry, material);
    terrain.name = `desert-dune-panel-${panelIndex}`;
    terrain.position.set(centerX, floorY, centerZ);
    terrain.frustumCulled = false;
    terrain.receiveShadow = true;
    group.add(terrain);
    registerFadeMaterial(material);

    // Outline the dune crests with a saturated pink so the desert keeps a stylized neon read.
    const outline = new THREE.LineSegments(
      new THREE.EdgesGeometry(geometry, 14),
      new THREE.LineBasicMaterial({
        color: duneOutlineColor,
        transparent: true,
        opacity: 0.7,
        depthWrite: false,
      })
    );
    outline.name = `desert-dune-outline-${panelIndex}`;
    outline.position.copy(terrain.position);
    outline.frustumCulled = false;
    group.add(outline);
    registerFadeMaterial(outline.material);
  };

  // Replace the oversized single terrain slab with curated dune panels. This drops
  // rear geometry and keeps only the front, side, and nearest rear dune row visible.
  const dunePanels = [
    { width: 96, depth: 96, segmentsX: 36, segmentsZ: 36, centerX: 0, centerZ: 0, flatRadius: 12.0, mountainStart: 18.0 },
    { width: 92, depth: 42, segmentsX: 26, segmentsZ: 12, centerX: 0, centerZ: -58, flatRadius: 8.0, mountainStart: 14.0 },
    { width: 40, depth: 110, segmentsX: 12, segmentsZ: 28, centerX: -58, centerZ: -8, flatRadius: 6.0, mountainStart: 12.0 },
    // { width: 72, depth: 28, segmentsX: 20, segmentsZ: 8, centerX: 0, centerZ: 56, flatRadius: 6.0, mountainStart: 12.0 },  // Removed: never seen by player
  ];
  dunePanels.forEach((panel, idx) => buildDunePanel(panel, idx));

  // Flash overlay removed — biomeTerrainMaterials overlay entries must also be removed.

  // === ALIEN PYRAMIDS (distant mysterious silhouettes on the horizon) ===
  const buildAlienPyramid = ({ x, z, height, width, bodyColor, edgeOpacity }) => {
    const pyramidGroup = new THREE.Group();
    pyramidGroup.name = `desert-alien-pyramid-${x}-${z}`;

    // 4-sided cone = pyramid shape
    const pyramidGeo = new THREE.ConeGeometry(1, 1, 4);
    pyramidGeo.rotateY(Math.PI / 4); // Align edges to cardinal directions
    const pyramidMat = new THREE.MeshBasicMaterial({ color: bodyColor });
    const pyramidMesh = new THREE.Mesh(pyramidGeo, pyramidMat);
    pyramidMesh.name = `desert-alien-pyramid-body-${x}-${z}`;
    pyramidMesh.scale.set(width, height, width);
    pyramidMesh.position.y = height / 2; // Sit on ground
    pyramidMesh.frustumCulled = false;
    pyramidGroup.add(pyramidMesh);
    registerFadeMaterial(pyramidMat);

    // Faint neon edge lines — the only thing making them readable against the dark sky
    const edgeGeo = new THREE.EdgesGeometry(pyramidGeo, 1);
    const edgeMat = new THREE.LineBasicMaterial({
      color: duneOutlineColor, // 0xAB3A93 — matches dune outlines
      transparent: true,
      opacity: edgeOpacity,
      depthWrite: false,
    });
    const edgeLines = new THREE.LineSegments(edgeGeo, edgeMat);
    edgeLines.name = `desert-alien-pyramid-edges-${x}-${z}`;
    edgeLines.scale.copy(pyramidMesh.scale);
    edgeLines.position.copy(pyramidMesh.position);
    edgeLines.frustumCulled = false;
    pyramidGroup.add(edgeLines);
    registerFadeMaterial(edgeMat);

    pyramidGroup.position.set(x, floorY, z);
    return pyramidGroup;
  };

  // Pyramid 1: large, left horizon — looming silhouette below the moon
  const pyramid1 = buildAlienPyramid({
    x: -80, z: -90,
    height: 22, width: 35,
    bodyColor: 0x0a0a0c,
    edgeOpacity: 0.25,
  });
  pyramid1.name = 'desert-alien-pyramid-1';
  group.add(pyramid1);

  // Pyramid 2: medium, right horizon — further, more mysterious
  const pyramid2 = buildAlienPyramid({
    x: 85, z: -85,
    height: 15, width: 25,
    bodyColor: 0x080810,
    edgeOpacity: 0.20,
  });
  pyramid2.name = 'desert-alien-pyramid-2';
  group.add(pyramid2);

  // === GIANT ALIEN RIBCAGE (distant horizon skeleton) ===
  const gltfLoader = new GLTFLoader();
  gltfLoader.load('./assets/models/rib_cage.glb', (gltf) => {
    const model = gltf.scene;

    // Collect meshes for edge overlay after traverse
    const ribcageMeshes = [];
    model.traverse((child) => {
      if (child.isMesh) {
        // Bone-white/ivory tone — weathered, ancient look under moonlight
        child.material = new THREE.MeshLambertMaterial({
          color: 0x8a7a6a,
          flatShading: false,
        });
        child.frustumCulled = false;
        child.castShadow = true;
        registerFadeMaterial(child.material);
        ribcageMeshes.push(child);
      }
    });

    // --- Main ribcage: MASSIVE, tilted, partially buried ---
    // Scale 8x — this should tower over the player like a building
    model.scale.setScalar(8.0);
    model.position.set(40, -1.5, -55);
    model.rotation.set(0.3, -0.8, 0.15); // Tilted forward, yawed, slight roll
    model.frustumCulled = false;
    model.name = 'desert-ribcage-main';
    group.add(model);

    // --- Scattered fragment: still big, different angle ---
    const fragment = model.clone();
    fragment.scale.setScalar(5.0);
    fragment.position.set(-45, -2.0, -65);
    fragment.rotation.set(-0.5, 1.2, -0.3); // More buried, different orientation
    fragment.name = 'desert-ribcage-fragment';
    group.add(fragment);

    // --- Subtle pink edge highlights (matching dune outlines at low opacity) ---
    const addRibcageEdges = (parent, opacity) => {
      parent.traverse((child) => {
        if (child.isMesh) {
          const edgeGeo = new THREE.EdgesGeometry(child.geometry, 30);
          const edgeMat = new THREE.LineBasicMaterial({
            color: duneOutlineColor, // 0xAB3A93 — matches dune outlines
            transparent: true,
            opacity: opacity,
            depthWrite: false,
          });
          const edgeLines = new THREE.LineSegments(edgeGeo, edgeMat);
          edgeLines.position.copy(child.position);
          edgeLines.rotation.copy(child.rotation);
          edgeLines.scale.copy(child.scale);
          edgeLines.frustumCulled = false;
          parent.add(edgeLines);
          registerFadeMaterial(edgeMat);
        }
      });
    };

    addRibcageEdges(model, 0.1);
    addRibcageEdges(fragment, 0.08);
  });

  // === CACTUSES (8 procedural, simplified for perf) ===
  // Shared materials to avoid per-segment allocation
  const cactusBodyMat = new THREE.MeshLambertMaterial({ color: 0x1a3d20, flatShading: true });
  const cactusArmMat = new THREE.MeshLambertMaterial({ color: 0x2d5535, flatShading: true });
  registerFadeMaterial(cactusBodyMat);
  registerFadeMaterial(cactusArmMat);

  // Shared cylinder geometries (4 radial segments instead of 5)
  const cactusGeoCache = {};

  const createCactus = (height, cactusIndex) => {
    const cactusGroup = new THREE.Group();
    cactusGroup.name = `desert-cactus-${cactusIndex}`;
    const segments = 2 + Math.floor(Math.random() * 2); // 2-3 segments (was 3-4)
    let currentY = 0;
    const segmentHeight = height / segments;

    // Main body segments
    for (let i = 0; i < segments; i++) {
      const radius = 0.12 + (segments - i) * 0.03; // Taper upward
      const geoKey = `body_${radius.toFixed(2)}_${segmentHeight.toFixed(2)}`;
      if (!cactusGeoCache[geoKey]) {
        cactusGeoCache[geoKey] = new THREE.CylinderGeometry(radius * 0.9, radius, segmentHeight, 4);
      }
      const segment = new THREE.Mesh(cactusGeoCache[geoKey], cactusBodyMat);
      segment.name = `desert-cactus-${cactusIndex}-body-${i}`;
      segment.position.y = currentY + segmentHeight / 2;
      segment.castShadow = true;  // Cacti cast shadows
      segment.receiveShadow = true;
      segment.frustumCulled = false; // Fix #9: prevent cacti from disappearing when looking up
      cactusGroup.add(segment);
      currentY += segmentHeight;
    }

    // Random arms (0-1 instead of 0-2)
    const numArms = Math.floor(Math.random() * 2);
    for (let a = 0; a < numArms; a++) {
      const armY = segmentHeight * (1 + Math.floor(Math.random() * (segments - 1)));
      const side = Math.random() > 0.5 ? 1 : -1;
      const armLength = 0.4 + Math.random() * 0.4;

      // Horizontal part (cached geometry)
      const hArmKey = `harm_${armLength.toFixed(2)}`;
      if (!cactusGeoCache[hArmKey]) {
        cactusGeoCache[hArmKey] = new THREE.CylinderGeometry(0.08, 0.1, armLength, 4);
      }
      const hArm = new THREE.Mesh(cactusGeoCache[hArmKey], cactusArmMat);
      hArm.name = `desert-cactus-${cactusIndex}-arm-h-${a}`;
      hArm.rotation.z = Math.PI / 2;
      hArm.position.set(side * armLength / 2, armY, 0);
      hArm.castShadow = true;
      hArm.frustumCulled = false; // Fix #9: prevent cactus arms from disappearing
      cactusGroup.add(hArm);

      // Vertical part (cached geometry)
      const vArmHeight = 0.5 + Math.random() * 0.5;
      const vArmKey = `varm_${vArmHeight.toFixed(2)}`;
      if (!cactusGeoCache[vArmKey]) {
        cactusGeoCache[vArmKey] = new THREE.CylinderGeometry(0.06, 0.08, vArmHeight, 4);
      }
      const vArm = new THREE.Mesh(cactusGeoCache[vArmKey], cactusArmMat);
      vArm.name = `desert-cactus-${cactusIndex}-arm-v-${a}`;
      vArm.position.set(side * armLength, armY + vArmHeight / 2, 0);
      vArm.castShadow = true;
      vArm.frustumCulled = false; // Fix #9: prevent vertical cactus arms from disappearing
      cactusGroup.add(vArm);
    }

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

  cactusPositions.forEach((pos, idx) => {
    const cactus = createCactus(pos.h, idx);
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
  starGeometry.name = 'biome-desert-stars';
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
  stars.name = 'biome-desert-stars';
  stars.frustumCulled = false; // Fix disappearing when looking up
  stars.renderOrder = 999;
  group.add(stars);
  registerFadeMaterial(starMaterial);



  // Moon
  const moonGroup = new THREE.Group();
  moonGroup.name = 'desert-moon-group';
  const moonGeometry = new THREE.IcosahedronGeometry(8, 2);
  const moonMaterial = new THREE.MeshBasicMaterial({ color: 0xaaaaaa });
  const moon = new THREE.Mesh(moonGeometry, moonMaterial);
  moon.name = 'desert-moon';
  moon.frustumCulled = false; // Fix #9: prevent disappearing when looking up
  moonGroup.add(moon);
  registerFadeMaterial(moonMaterial);
  // Fake glow via canvas radial gradient (same pattern as synthwave-valley sun glow)
  const makeRadial = (inner, outer) => {
    const c = document.createElement('canvas');
    c.width = 512; c.height = 512;
    const ctx = c.getContext('2d');
    const g = ctx.createRadialGradient(256,256,0,256,256,256);
    g.addColorStop(0.0, inner);
    g.addColorStop(0.35, inner);
    g.addColorStop(0.6, outer);
    g.addColorStop(1.0, 'rgba(170,200,255,0)');
    ctx.fillStyle = g; ctx.fillRect(0,0,512,512);
    return new THREE.CanvasTexture(c);
  };
  const moonGlowTex = makeRadial('rgba(220,230,255,0.6)', 'rgba(180,200,240,0.25)');
  const moonGlowMat = new THREE.MeshBasicMaterial({ map: moonGlowTex, transparent: true, opacity: 0.7, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, fog: false });
  const moonGlow = new THREE.Mesh(new THREE.PlaneGeometry(40, 40), moonGlowMat);
  moonGlow.name = 'desert-moon-fake-glow';
  moonGlow.frustumCulled = false;
  moonGlow.lookAt(0, 0, 0); // Fix #7: face player position when created
  moonGroup.add(moonGlow);
  registerFadeMaterial(moonGlowMat);
  moonGroup.position.set(-45, 35, -60);
  group.add(moonGroup);

  // Desert floor HUD height: Y = -0.20, rotated 25 degrees (-0.436 rad)
  group.rotation.y = -0.436; // yaw: -25 degrees
  group.position.set(-2.12, -0.20, -4.82);  // Moved 5 units +X and +Z



  // === Store refs for boss cinematic red tinting ===
  if (synthVisualRefs) {
    synthVisualRefs.desertSkyMat = skyMat;
    synthVisualRefs.desertMoonMat = moonMaterial;
    synthVisualRefs.desertMoonGlowMat = moonGlowMat;
  }

  // === ANIMATION UPDATE ===
  group.userData.update = (now, dt) => {
    const time = now * 0.001;
    // Update stars twinkle (shader-based, already efficient)
    starMaterial.uniforms.uTime.value = time;

  };
}
