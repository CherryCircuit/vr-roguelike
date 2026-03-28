import * as THREE from 'three';

export function buildAlienPlanetScene(group, deps) {
  const { registerFadeMaterial, floorMaterial, biomeTerrainMaterials } = deps;
  const floorHeight = (floorMaterial?.userData?.floorHeight) || -0.01;
  const floorY = floorHeight - 0.3;
  const pixelRatio = typeof window !== 'undefined' ? Math.min(window.devicePixelRatio || 1, 2) : 1;

  const c = (hex) => new THREE.Color(hex);
  const dummy = new THREE.Object3D();
  const rand = (min, max) => min + Math.random() * (max - min);

  const terrainStoneDark = c('#4A4A4A');
  const terrainStoneLight = c('#6B6B6B');
  const mossDark = c('#2E7D32');
  const mossBright = c('#4CAF50');
  const bioGlow = c('#00AA88');
  const waterBase = c('#4ECDC4');
  const waterDeep = c('#3A9B9B');
  const fogColor = c('#B8C5D1');
  const skyColor = c('#B8C5D1');
  const stemDark = c('#1A4A5A');
  const stemEmissive = c('#0A2A35');
  const gold = c('#D4AF37');

  const flowerTrees = [];
  const lanterns = [];
  const coralClusters = [];
  const ferns = [];
  const fogPlanes = [];

  const ambientLight = new THREE.AmbientLight(0x2A3545, 0.3);
  group.add(ambientLight);

  const hemiLight = new THREE.HemisphereLight(0x4A5A70, 0x1A3020, 0.5);
  group.add(hemiLight);

  const dirLight = new THREE.DirectionalLight(0xC0D0E0, 0.6);
  dirLight.position.set(-30, 40, -20);
  dirLight.castShadow = false;
  group.add(dirLight);

  const terrainGeo = new THREE.PlaneGeometry(300, 300, 120, 120);
  terrainGeo.rotateX(-Math.PI / 2);
  const terrainPos = terrainGeo.attributes.position;
  const terrainColors = [];
  for (let i = 0; i < terrainPos.count; i++) {
    const x = terrainPos.getX(i);
    const z = terrainPos.getZ(i);
    const dist = Math.sqrt(x * x + z * z);
    const flatFactor = THREE.MathUtils.smoothstep(dist, 0, 20);
    let h = Math.sin(x * 0.04 + 1.3) * Math.cos(z * 0.035 + 0.7) * 1.5;
    h += Math.sin(x * 0.08 + 2.1) * Math.sin(z * 0.06 + 1.5) * 0.8;
    h += Math.cos(x * 0.15 + z * 0.12) * 0.3;
    if (h > 0.3) h *= 1.5;
    else h = Math.min(h, -0.1);
    h *= flatFactor;
    terrainPos.setY(i, h);
    const heightNorm = THREE.MathUtils.clamp((h + 0.5) / 2.5, 0, 1);
    const color = terrainStoneDark.clone().lerp(terrainStoneLight, heightNorm * 0.6);
    if (h > 0.2 && h < 1.0) {
      const mossNoise = Math.sin(x * 0.12) * Math.cos(z * 0.1) + Math.sin(x * 0.2 + z * 0.15) * 0.5;
      const mossStrength = Math.max(0, mossNoise - 0.2) * 0.6;
      color.lerp(mossBright, mossStrength);
      color.lerp(mossDark, Math.max(0, 0.2 - mossStrength) * 0.15);
    }
    const bioNoise = Math.sin(x * 0.08 + 0.5) * Math.cos(z * 0.07) + Math.cos(x * 0.13 + z * 0.09) * 0.4;
    const bioStrength = Math.max(0, bioNoise - 0.5) * 0.4;
    color.lerp(bioGlow, bioStrength);
    terrainColors.push(color.r, color.g, color.b);
  }
  terrainGeo.setAttribute('color', new THREE.Float32BufferAttribute(terrainColors, 3));
  terrainGeo.computeVertexNormals();
  const groundMat = new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.85, metalness: 0.05 });
  const ground = new THREE.Mesh(terrainGeo, groundMat);
  ground.name = 'alien-terrain-ground';
  ground.position.y = floorY;
  ground.frustumCulled = false;
  group.add(ground);
  registerFadeMaterial(groundMat);

  const waterGeo = new THREE.PlaneGeometry(300, 300, 80, 80);
  waterGeo.rotateX(-Math.PI / 2);
  const waterMaterial = new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uBaseColor: { value: waterBase.clone() },
      uDeepColor: { value: waterDeep.clone() },
      uFogColor: { value: fogColor.clone() },
      uFogDensity: { value: 0.008 },
      uOpacity: { value: 0.75 },
      uPixelRatio: { value: pixelRatio },
      uFade: { value: 1 }
    },
    vertexShader: `
      varying vec2 vUv;
      varying vec3 vWorldPos;
      varying float vFogDepth;
      uniform float uTime;
      void main() {
        vUv = uv;
        vec4 worldPos = modelMatrix * vec4(position, 1.0);
        vWorldPos = worldPos.xyz;
        float wave = sin(worldPos.x * 0.5 + uTime * 0.8) * 0.02 + cos(worldPos.z * 0.4 + uTime * 0.6) * 0.015;
        worldPos.y += wave;
        vec4 mvPos = viewMatrix * worldPos;
        vFogDepth = -mvPos.z;
        gl_Position = projectionMatrix * mvPos;
      }
    `,
    fragmentShader: `
      uniform float uTime;
      uniform vec3 uBaseColor;
      uniform vec3 uDeepColor;
      uniform vec3 uFogColor;
      uniform float uFogDensity;
      uniform float uOpacity;
      uniform float uFade;
      varying vec2 vUv;
      varying vec3 vWorldPos;
      varying float vFogDepth;
      float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
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
        vec2 rippleUV = vWorldPos.xz * 0.15;
        float ripple1 = noise(rippleUV + uTime * 0.15);
        float ripple2 = noise(rippleUV * 2.0 - uTime * 0.1);
        float ripple = (ripple1 + ripple2) * 0.5;
        float distFromCenter = length(vWorldPos.xz) / 150.0;
        vec3 waterColor = mix(uBaseColor, uDeepColor, distFromCenter * 0.5 + ripple * 0.3);
        float highlight = pow(ripple, 3.0) * 0.4;
        waterColor += vec3(highlight * 0.5, highlight * 0.8, highlight);
        float opacity = uOpacity;
        float fogFactor = 1.0 - exp(-uFogDensity * vFogDepth * vFogDepth);
        waterColor = mix(waterColor, uFogColor, clamp(fogFactor, 0.0, 1.0));
        opacity = mix(opacity, 0.0, fogFactor * 0.5);
        gl_FragColor = vec4(waterColor, opacity * uFade);
      }
    `,
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    fog: false,
    blending: THREE.NormalBlending
  });
  const water = new THREE.Mesh(waterGeo, waterMaterial);
  water.name = 'alien-water-surface';
  water.position.y = floorY + 0.15;
  water.frustumCulled = false;
  group.add(water);
  registerFadeMaterial(waterMaterial);

  const flashGeo = new THREE.PlaneGeometry(320, 320);
  const flashMat = new THREE.MeshBasicMaterial({ color: 0xFF0000, transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide });
  const flashPlane = new THREE.Mesh(flashGeo, flashMat);
  flashPlane.name = 'alien-flash-overlay';
  flashPlane.rotation.x = -Math.PI / 2;
  flashPlane.position.y = floorY + 0.1;
  flashPlane.frustumCulled = false;
  group.add(flashPlane);
  biomeTerrainMaterials.push({ type: 'overlay', material: flashMat });

  const skyGeo = new THREE.SphereGeometry(150, 16, 16);
  const skyMat = new THREE.MeshBasicMaterial({ color: skyColor, side: THREE.BackSide, fog: false });
  const sky = new THREE.Mesh(skyGeo, skyMat);
  sky.name = 'alien-sky-dome';
  sky.position.y = floorY + 20;
  sky.frustumCulled = false;
  group.add(sky);
  registerFadeMaterial(skyMat);

  const flowerCfgs = [
    { x: -30, z: -25, height: 4.5, canopyWidth: 5.0, petalColor: '#00B4D8', petalEmissive: '#006080' },
    { x: 35, z: -20, height: 5.0, canopyWidth: 5.5, petalColor: '#6A4C93', petalEmissive: '#3A2850' },
    { x: -20, z: 40, height: 3.8, canopyWidth: 4.5, petalColor: '#7B2D8E', petalEmissive: '#451A52' },
    { x: 40, z: 35, height: 4.2, canopyWidth: 5.0, petalColor: '#00B4D8', petalEmissive: '#006080' },
    { x: -50, z: -40, height: 4.8, canopyWidth: 5.2, petalColor: '#6A4C93', petalEmissive: '#3A2850' }
  ];
  const stemGeo = new THREE.CylinderGeometry(0.25, 0.45, 1, 8, 4);
  stemGeo.translate(0, 0.5, 0);
  const stemMat = new THREE.MeshStandardMaterial({ color: stemDark, emissive: stemEmissive, emissiveIntensity: 0.3, roughness: 0.4, metalness: 0.3, flatShading: true });
  const ringGeo = new THREE.TorusGeometry(0.35, 0.08, 6, 8);
  const ringMat = new THREE.MeshStandardMaterial({ color: gold, emissive: gold, emissiveIntensity: 0.2, roughness: 0.3, metalness: 0.7 });
  const petalGeo = new THREE.SphereGeometry(1, 6, 4, 0, Math.PI / 4, 0, Math.PI * 0.35);
  const pistilGeo = new THREE.SphereGeometry(0.6, 8, 8);
  const pistilMat = new THREE.MeshBasicMaterial({ color: 0xD4AF37 });
  registerFadeMaterial(stemMat); registerFadeMaterial(ringMat); registerFadeMaterial(pistilMat);
  flowerCfgs.forEach((cfg, i) => {
    const g = new THREE.Group();
    g.name = `alien-flower-tree-${i}`;
    const stem = new THREE.Mesh(stemGeo, stemMat);
    stem.scale.y = cfg.height;
    stem.frustumCulled = false;
    g.add(stem);
    for (let r = 0; r < 4; r++) {
      const ring = new THREE.Mesh(ringGeo, ringMat);
      ring.rotation.x = Math.PI / 2;
      ring.position.y = (cfg.height * 0.18) + r * (cfg.height * 0.18);
      ring.scale.setScalar(0.85 + r * 0.05);
      ring.frustumCulled = false;
      g.add(ring);
    }
    const petalMat = new THREE.MeshStandardMaterial({ color: cfg.petalColor, emissive: cfg.petalEmissive, emissiveIntensity: 0.5, roughness: 0.3, metalness: 0.1, transparent: true, opacity: 0.85, side: THREE.DoubleSide });
    registerFadeMaterial(petalMat);
    for (let ringIdx = 0; ringIdx < 2; ringIdx++) {
      const petals = ringIdx === 0 ? 6 : 8;
      for (let p = 0; p < petals; p++) {
        const petal = new THREE.Mesh(petalGeo, petalMat);
        petal.scale.set(cfg.canopyWidth * (ringIdx === 0 ? 0.55 : 0.8), cfg.canopyWidth * (ringIdx === 0 ? 0.3 : 0.38), cfg.canopyWidth * (ringIdx === 0 ? 0.9 : 1.1));
        petal.position.y = cfg.height;
        petal.rotation.y = (Math.PI * 2 * p) / petals;
        petal.rotation.x = ringIdx === 0 ? -0.3 : -0.45;
        petal.position.x = Math.cos(petal.rotation.y) * (cfg.canopyWidth * 0.22);
        petal.position.z = Math.sin(petal.rotation.y) * (cfg.canopyWidth * 0.22);
        petal.frustumCulled = false;
        g.add(petal);
      }
    }
    const pistil = new THREE.Mesh(pistilGeo, pistilMat);
    pistil.position.y = cfg.height + 0.15;
    pistil.frustumCulled = false;
    g.add(pistil);
    g.position.set(cfg.x, floorY, cfg.z);
    g.frustumCulled = false;
    group.add(g);
    flowerTrees.push(g);

    if (i !== 2) {
      const lantern = new THREE.Group();
      lantern.name = `alien-lantern-${i}`;
      const cordMat = new THREE.MeshBasicMaterial({ color: 0x8B7355 });
      const bodyMat = new THREE.MeshBasicMaterial({ color: 0xFFA500, transparent: true, opacity: 0.6, side: THREE.DoubleSide });
      const capMat = new THREE.MeshStandardMaterial({ color: 0xFFD700, metalness: 0.7, roughness: 0.3 });
      registerFadeMaterial(cordMat); registerFadeMaterial(bodyMat); registerFadeMaterial(capMat);
      const cord = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 1.5, 4), cordMat);
      cord.position.y = -0.75;
      const body = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.3, 0.5, 8, 1, true), bodyMat);
      const top = new THREE.Mesh(new THREE.CircleGeometry(0.2, 8), capMat);
      const ring = new THREE.Mesh(new THREE.TorusGeometry(0.3, 0.03, 6, 8), capMat);
      body.frustumCulled = top.frustumCulled = ring.frustumCulled = cord.frustumCulled = false;
      top.rotation.x = -Math.PI / 2; top.position.y = 0.25;
      ring.rotation.x = Math.PI / 2; ring.position.y = -0.25;
      lantern.add(cord, body, top, ring);
      lantern.position.set(cfg.x + 1.4, floorY + cfg.height * 0.65, cfg.z + 0.6);
      lantern.add(new THREE.PointLight(0xFFA500, 0.8, 8, 2));
      lantern.frustumCulled = false;
      group.add(lantern);
      lanterns.push(lantern);
    }
  });

  function buildCoralCluster(colorHex, x, z, index) {
    const cluster = new THREE.Group();
    cluster.name = `alien-coral-cluster-${index}`;
    const coralMat = new THREE.MeshStandardMaterial({ color: c(colorHex), emissive: c(colorHex), emissiveIntensity: 0.35, roughness: 0.6, metalness: 0.1, flatShading: true });
    registerFadeMaterial(coralMat);
    const branchGeo = new THREE.CylinderGeometry(0.06, 0.1, 1, 6);
    branchGeo.translate(0, 0.5, 0);
    const tipGeo = new THREE.SphereGeometry(0.1, 6, 6);
    for (let i = 0; i < 4; i++) {
      const stem = new THREE.Mesh(branchGeo, coralMat);
      stem.scale.y = rand(0.5, 0.9);
      stem.rotation.z = rand(-0.3, 0.3);
      stem.rotation.y = (Math.PI * 2 * i) / 4;
      stem.position.y = 0;
      stem.frustumCulled = false;
      cluster.add(stem);
      const branch1 = new THREE.Mesh(branchGeo, coralMat);
      branch1.scale.y = rand(0.35, 0.6);
      branch1.position.y = rand(0.5, 0.8);
      branch1.position.x = rand(-0.15, 0.15);
      branch1.rotation.z = rand(0.35, 0.65);
      branch1.rotation.y = rand(0, Math.PI * 2);
      branch1.frustumCulled = false;
      cluster.add(branch1);
      const tip = new THREE.Mesh(tipGeo, coralMat);
      tip.position.set(branch1.position.x + 0.08, branch1.position.y + 0.35, 0);
      tip.frustumCulled = false;
      cluster.add(tip);
    }
    cluster.position.set(x, floorY + 0.15, z);
    cluster.scale.setScalar(rand(0.8, 1.2));
    cluster.frustumCulled = false;
    group.add(cluster);
    coralClusters.push(cluster);
  }
  buildCoralCluster('#6A4C93', 15, 20, 0);
  buildCoralCluster('#FF6B35', -25, 10, 1);
  buildCoralCluster('#E63946', 30, -35, 2);
  buildCoralCluster('#6A4C93', -40, -25, 3);

  const fernGeo = new THREE.ShapeGeometry((() => { const s = new THREE.Shape(); s.moveTo(0, 0); s.quadraticCurveTo(0.15, 0.5, 0.05, 1.2); s.lineTo(0, 1.3); s.quadraticCurveTo(-0.05, 1.2, -0.15, 0.5); s.lineTo(0, 0); return s; })(), 4);
  const fernMats = [
    new THREE.MeshStandardMaterial({ color: 0x00A896, emissive: 0x004040, emissiveIntensity: 0.3, roughness: 0.7, metalness: 0, side: THREE.DoubleSide, transparent: true, opacity: 0.9 }),
    new THREE.MeshStandardMaterial({ color: 0x4CAF50, emissive: 0x1A3A1A, emissiveIntensity: 0.2, roughness: 0.7, metalness: 0, side: THREE.DoubleSide, transparent: true, opacity: 0.9 })
  ];
  fernMats.forEach(registerFadeMaterial);
  const fernPositions = [
    [-12, 18], [8, 22], [22, 12], [-28, 30], [42, -5], [-42, 8], [18, -22], [-8, -30], [30, 28], [-34, -18], [48, 18]
  ];
  fernPositions.forEach((p, i) => {
    const fern = new THREE.Group();
    fern.name = `alien-fern-${i}`;
    const fronds = 5 + (i % 4);
    for (let f = 0; f < fronds; f++) {
      const mat = fernMats[f % 2];
      const frond = new THREE.Mesh(fernGeo, mat);
      frond.rotation.z = rand(-0.2, 0.2);
      frond.rotation.y = (Math.PI * 2 * f) / fronds;
      frond.rotation.x = rand(-1.0, -0.6);
      frond.scale.set(rand(0.75, 1.0), rand(0.9, 1.3), 1);
      frond.position.y = 0;
      frond.frustumCulled = false;
      fern.add(frond);
    }
    fern.position.set(p[0], floorY + 0.2, p[1]);
    fern.frustumCulled = false;
    group.add(fern);
    ferns.push(fern);
  });

  const spikeGeo = new THREE.ConeGeometry(0.03, 1.0, 4);
  const spikeMats = [
    new THREE.MeshStandardMaterial({ color: 0x1A237E, emissive: 0x0A1040, emissiveIntensity: 0.2, roughness: 0.8, flatShading: true }),
    new THREE.MeshStandardMaterial({ color: 0x4CAF50, emissive: 0x2A6A2A, emissiveIntensity: 0.3, roughness: 0.8, flatShading: true })
  ];
  spikeMats.forEach(registerFadeMaterial);
  [[-18, -8], [16, -12], [28, 18], [-32, 24], [44, -28], [-45, -5], [8, 38], [52, 5], [-6, 46]].forEach((p, i) => {
    const clump = new THREE.Group();
    clump.name = `alien-spiky-grass-${i}`;
    const spikes = 8 + (i % 5);
    for (let s = 0; s < spikes; s++) {
      const spike = new THREE.Mesh(spikeGeo, spikeMats[s % 2]);
      spike.scale.setScalar(rand(0.8, 1.5));
      spike.rotation.y = (Math.PI * 2 * s) / spikes;
      spike.rotation.z = rand(-0.2, 0.2);
      spike.position.y = 0.5;
      spike.frustumCulled = false;
      clump.add(spike);
    }
    clump.position.set(p[0], floorY + 0.18, p[1]);
    clump.frustumCulled = false;
    group.add(clump);
  });

  const bulbGeo = new THREE.SphereGeometry(0.2, 8, 8);
  const bulbMats = [
    new THREE.MeshStandardMaterial({ color: 0x00897B, emissive: 0x004040, emissiveIntensity: 0.4, roughness: 0.3, metalness: 0.2 }),
    new THREE.MeshStandardMaterial({ color: 0x9C27B0, emissive: 0x4A1360, emissiveIntensity: 0.4, roughness: 0.3, metalness: 0.2 })
  ];
  bulbMats.forEach(registerFadeMaterial);
  [[-24, 12], [20, -2], [36, 10], [-38, 16], [12, 34], [-8, -18], [46, -10]].forEach((p, i) => {
    const bulb = new THREE.Mesh(bulbGeo, bulbMats[i % 2]);
    bulb.name = `alien-bulbous-plant-${i}`;
    bulb.position.set(p[0], floorY + 0.3, p[1]);
    bulb.scale.setScalar(rand(0.8, 1.3));
    bulb.frustumCulled = false;
    group.add(bulb);
  });

  const ruinMat = new THREE.MeshStandardMaterial({ color: 0x8D6E63, roughness: 0.95, metalness: 0, flatShading: true, emissive: 0x3A2A20, emissiveIntensity: 0.1 });
  registerFadeMaterial(ruinMat);
  [
    { x: 80, z: -60, topR: 2, bottomR: 3, h: 25 },
    { x: -70, z: -80, topR: 1.5, bottomR: 2.5, h: 30 },
    { x: 90, z: 70, topR: 1, bottomR: 2, h: 20, broken: true },
    { x: -85, z: 50, topR: 2.5, bottomR: 3.5, h: 35 }
  ].forEach((cfg, i) => {
    const tower = new THREE.Mesh(new THREE.CylinderGeometry(cfg.topR, cfg.bottomR, cfg.h, 8, 1), ruinMat);
    tower.name = `alien-ruin-tower-${i}`;
    tower.position.set(cfg.x, floorY + cfg.h / 2, cfg.z);
    tower.rotation.z = (i % 2 ? 1 : -1) * 0.03;
    tower.frustumCulled = false;
    group.add(tower);
    if (cfg.broken) {
      const cap = new THREE.Mesh(new THREE.ConeGeometry(2, 3, 6), ruinMat);
      cap.position.set(cfg.x, floorY + cfg.h + 1.5, cfg.z);
      cap.rotation.z = 0.4;
      cap.frustumCulled = false;
      group.add(cap);
    }
  });

  const particleCount = 250;
  const pPos = new Float32Array(particleCount * 3);
  const pPhase = new Float32Array(particleCount);
  const pSize = new Float32Array(particleCount);
  for (let i = 0; i < particleCount; i++) {
    pPos[i * 3] = (Math.random() - 0.5) * 100;
    pPos[i * 3 + 1] = floorY + Math.random() * 12;
    pPos[i * 3 + 2] = (Math.random() - 0.5) * 100;
    pPhase[i] = Math.random() * Math.PI * 2;
    pSize[i] = 0.5 + Math.random() * 1.5;
  }
  const particleGeo = new THREE.BufferGeometry();
  particleGeo.setAttribute('position', new THREE.BufferAttribute(pPos, 3));
  particleGeo.setAttribute('aPhase', new THREE.BufferAttribute(pPhase, 1));
  particleGeo.setAttribute('aSize', new THREE.BufferAttribute(pSize, 1));
  const particleMaterial = new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0 }, uPixelRatio: { value: pixelRatio }, uFade: { value: 1 } },
    vertexShader: `
      attribute float aPhase;
      attribute float aSize;
      uniform float uTime;
      uniform float uPixelRatio;
      varying float vAlpha;
      void main() {
        vec3 pos = position;
        pos.y += mod(uTime * 0.15 + aPhase * 2.0, 15.0);
        pos.x += sin(uTime * 0.3 + aPhase) * 1.5;
        pos.z += cos(uTime * 0.25 + aPhase * 1.3) * 1.0;
        vAlpha = 0.3 + 0.7 * (0.5 + 0.5 * sin(uTime * 1.5 + aPhase * 3.0));
        vec4 mvPos = modelViewMatrix * vec4(pos, 1.0);
        gl_PointSize = aSize * uPixelRatio * (150.0 / -mvPos.z);
        gl_PointSize = clamp(gl_PointSize, 1.0, 8.0);
        gl_Position = projectionMatrix * mvPos;
      }
    `,
    fragmentShader: `
      varying float vAlpha;
      uniform float uFade;
      void main() {
        float dist = length(gl_PointCoord - vec2(0.5));
        if (dist > 0.5) discard;
        float alpha = (1.0 - smoothstep(0.0, 0.5, dist)) * vAlpha;
        vec3 color = vec3(1.0, 0.85, 0.5);
        gl_FragColor = vec4(color, alpha * 0.4 * uFade);
      }
    `,
    transparent: true,
    depthWrite: false,
    fog: false,
    blending: THREE.AdditiveBlending
  });
  const particles = new THREE.Points(particleGeo, particleMaterial);
  particles.name = 'alien-pollen-particles';
  particles.frustumCulled = false;
  group.add(particles);
  registerFadeMaterial(particleMaterial);

  const moonGeo = new THREE.IcosahedronGeometry(35, 2);
  const moonMat = new THREE.MeshBasicMaterial({ color: 0xDDAAFF, transparent: true, opacity: 0.95 });
  const moon = new THREE.Mesh(moonGeo, moonMat);
  moon.name = 'alien-moon';
  moon.position.set(80, 55, -100);
  moon.frustumCulled = false;
  group.add(moon);
  const moonGlowGeo = new THREE.IcosahedronGeometry(55, 2);
  const moonGlowMat = new THREE.MeshBasicMaterial({ color: 0xAA66FF, transparent: true, opacity: 0.25, side: THREE.BackSide });
  const moonGlow = new THREE.Mesh(moonGlowGeo, moonGlowMat);
  moonGlow.name = 'alien-moon-glow';
  moonGlow.position.copy(moon.position);
  moonGlow.frustumCulled = false;
  group.add(moonGlow);
  registerFadeMaterial(moonMat); registerFadeMaterial(moonGlowMat);

  const starCount = 350;
  const starPositions = new Float32Array(starCount * 3);
  const starPhases = new Float32Array(starCount);
  for (let i = 0; i < starCount; i++) {
    const theta = Math.random() * Math.PI * 2;
    const radius = 120 + Math.random() * 60;
    const phi = Math.random() * Math.PI * 0.5;
    starPositions[i * 3] = Math.cos(theta) * Math.sin(phi) * radius;
    starPositions[i * 3 + 1] = Math.cos(phi) * radius + 30;
    starPositions[i * 3 + 2] = Math.sin(theta) * Math.sin(phi) * radius;
    starPhases[i] = Math.random() * Math.PI * 2;
  }
  const starGeometry = new THREE.BufferGeometry();
  starGeometry.setAttribute('position', new THREE.BufferAttribute(starPositions, 3));
  starGeometry.setAttribute('aPhase', new THREE.BufferAttribute(starPhases, 1));
  const starMaterial = new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0 }, uPixelRatio: { value: pixelRatio }, uFade: { value: 1 } },
    vertexShader: `
      attribute float aPhase;
      uniform float uTime;
      uniform float uPixelRatio;
      varying float vTwinkle;
      void main() {
        vTwinkle = 0.5 + 0.5 * sin(uTime * 1.5 + aPhase);
        vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
        float size = 2.2 * uPixelRatio * vTwinkle;
        gl_PointSize = size * (200.0 / -mvPosition.z);
        gl_Position = projectionMatrix * mvPosition;
      }
    `,
    fragmentShader: `
      varying float vTwinkle;
      uniform float uFade;
      void main() {
        float dist = length(gl_PointCoord - vec2(0.5));
        if (dist > 0.5) discard;
        float alpha = 1.0 - smoothstep(0.0, 0.5, dist);
        vec3 color = mix(vec3(1.0, 0.9, 0.7), vec3(0.7, 1.0, 0.9), vTwinkle);
        gl_FragColor = vec4(color * (0.75 + vTwinkle * 0.25), alpha * vTwinkle * uFade);
      }
    `,
    transparent: true,
    depthWrite: false,
    fog: false,
    blending: THREE.AdditiveBlending
  });
  const stars = new THREE.Points(starGeometry, starMaterial);
  stars.name = 'alien-stars';
  stars.frustumCulled = false;
  stars.renderOrder = 999;
  group.add(stars);
  registerFadeMaterial(starMaterial);

  const fogDefs = [
    { y: floorY + 1.5, opacity: 0.10, color: 0xA0B0C0 },
    { y: floorY + 4.0, opacity: 0.06, color: 0xB0B8C8 },
    { y: floorY + 8.0, opacity: 0.04, color: 0xB8C5D1 }
  ];
  fogDefs.forEach((cfg, i) => {
    const mat = new THREE.MeshBasicMaterial({ color: cfg.color, transparent: true, opacity: cfg.opacity, depthWrite: false, side: THREE.DoubleSide, fog: false });
    registerFadeMaterial(mat);
    const fog = new THREE.Mesh(new THREE.PlaneGeometry(350, 350), mat);
    fog.name = `alien-fog-plane-${i}`;
    fog.rotation.x = -Math.PI / 2;
    fog.position.y = cfg.y;
    fog.frustumCulled = false;
    group.add(fog);
    fogPlanes.push(fog);
  });

  group.userData.update = (now, dt) => {
    const time = now * 0.001;
    waterMaterial.uniforms.uTime.value = time;
    particleMaterial.uniforms.uTime.value = time;
    starMaterial.uniforms.uTime.value = time;
    flowerTrees.forEach((tree, i) => {
      tree.rotation.z = Math.sin(time * 0.3 + i * 1.5) * 0.04;
      tree.rotation.x = Math.cos(time * 0.25 + i * 0.9) * 0.03;
    });
    lanterns.forEach((lantern, i) => {
      lantern.rotation.z = Math.sin(time * 0.7 + i * 2.0) * 0.08;
    });
    coralClusters.forEach((cluster, i) => {
      cluster.rotation.z = Math.sin(time * 0.4 + i * 1.3) * 0.05;
    });
    ferns.forEach((fern, i) => {
      fern.rotation.z = Math.sin(time * 0.5 + i * 0.7) * 0.06;
    });
    fogPlanes.forEach((fog, i) => {
      fog.position.y += Math.sin(time * 0.2 + i) * 0.001;
    });
  };

  group.position.set(-0.048, -0.28, -2.475);
}
