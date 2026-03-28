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
