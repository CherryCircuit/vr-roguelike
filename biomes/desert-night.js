// ============================================================
//  BIOME: Desert Night
//  Moonlit desert with cacti, stars, and dust particles
//  Extracted from biome-scenes.js (restored version)
// ============================================================

import * as THREE from 'three';

export function buildDesertNightScene(group, deps) {
  const { registerFadeMaterial, floorMaterial, biomeTerrainMaterials } = deps;
  const floorHeight = (floorMaterial && floorMaterial.userData && floorMaterial.userData.floorHeight) || -0.01;
  const floorY = floorHeight;
  const sceneColor = 0x06080c;
  const duneOutlineColor = 0xAB3A93;

  // === LIGHTING (CRITICAL) ===
  // Pale moonlight
  const moonLight = new THREE.DirectionalLight(0xd4e5f7, 2.34);
  moonLight.position.set(-30, 50, -30);
  group.add(moonLight);

  // Point light for long moon-like shadows from cacti
  const shadowLight = new THREE.PointLight(0xd4e5f7, 4.0, 100);
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

  // Front-fill light - moonlit blue over player position
  const frontFillLight = new THREE.PointLight(0xe0f4ff, 200, 60);
  frontFillLight.position.set(2.12, 6, 4.82);  // Centered over player (world origin)
  group.add(frontFillLight);

  // Desert skydome mirrors the synthwave setup structurally, but uses moonlit sand tones
  // at half brightness so the desert reads darker and calmer than the neon biome.
  const skyGeo = new THREE.SphereGeometry(2200, 24, 18);
  const skyMat = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    uniforms: {
      topColor: { value: new THREE.Color(0x06080c) },
      midColor: { value: new THREE.Color(0x151b2d) },
      horizonColor: { value: new THREE.Color(0x3d2f2a) },
      moonGlowColor: { value: new THREE.Color(0x6a6271) },
    },
    vertexShader: `varying vec3 vWorldPosition; void main(){ vec4 worldPosition=modelMatrix*vec4(position,1.0); vWorldPosition=worldPosition.xyz; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }`,
    fragmentShader: `varying vec3 vWorldPosition; uniform vec3 topColor; uniform vec3 midColor; uniform vec3 horizonColor; uniform vec3 moonGlowColor; void main(){ float worldY=vWorldPosition.y; float t1=smoothstep(-140.0,220.0,worldY); float t2=smoothstep(120.0,780.0,worldY); float t3=smoothstep(300.0,1200.0,worldY); vec3 col=horizonColor; col=mix(col,moonGlowColor,t1); col=mix(col,midColor,t2); col=mix(col,topColor,t3); col=pow(col,vec3(1.0/2.2)); gl_FragColor=vec4(col*0.5,1.0); }`,
    depthWrite: false,
  });
  const sky = new THREE.Mesh(skyGeo, skyMat);
  sky.frustumCulled = false;
  sky.renderOrder = -20;
  group.add(sky);
  registerFadeMaterial(skyMat);

  const buildDunePanel = ({ width, depth, segmentsX, segmentsZ, centerX, centerZ, flatRadius, mountainStart }) => {
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
    { width: 40, depth: 110, segmentsX: 12, segmentsZ: 28, centerX: 58, centerZ: -8, flatRadius: 6.0, mountainStart: 12.0 },
    // { width: 72, depth: 28, segmentsX: 20, segmentsZ: 8, centerX: 0, centerZ: 56, flatRadius: 6.0, mountainStart: 12.0 },  // Removed: never seen by player
  ];
  dunePanels.forEach(buildDunePanel);

  // Flash overlay plane for damage feedback (entire sand floor turns red)
  // Only cover the playable center after culling rear dune rows to avoid red flashes on removed geometry.
  const flashGeo = new THREE.PlaneGeometry(96, 96);
  const flashMat = new THREE.MeshBasicMaterial({
    color: 0xff0000,
    transparent: true,
    opacity: 0,
    depthWrite: false,
    side: THREE.DoubleSide
  });
  const flashPlane = new THREE.Mesh(flashGeo, flashMat);
  flashPlane.rotation.x = -Math.PI / 2;
  flashPlane.position.y = floorY + 0.02; // Very close to terrain surface
  flashPlane.frustumCulled = false;
  group.add(flashPlane);
  biomeTerrainMaterials.push({ type: 'overlay', material: flashMat });

  // === CACTUSES (8 procedural, simplified for perf) ===
  // Shared materials to avoid per-segment allocation
  const cactusBodyMat = new THREE.MeshLambertMaterial({ color: 0x1a3d20, flatShading: true });
  const cactusArmMat = new THREE.MeshLambertMaterial({ color: 0x2d5535, flatShading: true });
  registerFadeMaterial(cactusBodyMat);
  registerFadeMaterial(cactusArmMat);

  // Shared cylinder geometries (4 radial segments instead of 5)
  const cactusGeoCache = {};

  const createCactus = (height) => {
    const cactusGroup = new THREE.Group();
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
      segment.position.y = currentY + segmentHeight / 2;
      segment.castShadow = true;  // Cacti cast shadows
      segment.receiveShadow = true;
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
      hArm.rotation.z = Math.PI / 2;
      hArm.position.set(side * armLength / 2, armY, 0);
      cactusGroup.add(hArm);

      // Vertical part (cached geometry)
      const vArmHeight = 0.5 + Math.random() * 0.5;
      const vArmKey = `varm_${vArmHeight.toFixed(2)}`;
      if (!cactusGeoCache[vArmKey]) {
        cactusGeoCache[vArmKey] = new THREE.CylinderGeometry(0.06, 0.08, vArmHeight, 4);
      }
      const vArm = new THREE.Mesh(cactusGeoCache[vArmKey], cactusArmMat);
      vArm.position.set(side * armLength, armY + vArmHeight / 2, 0);
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



  // === ANIMATION UPDATE ===
  group.userData.update = (now, dt) => {
    const time = now * 0.001;
    // Update stars twinkle (shader-based, already efficient)
    starMaterial.uniforms.uTime.value = time;

  };
}
