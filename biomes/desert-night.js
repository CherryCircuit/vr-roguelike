// ============================================================
//  BIOME: Desert Night (Aurora Machine Desert)
//  Monumental machine ruins in moonlit desert with aurora
// ============================================================
import * as THREE from 'three';

export function buildDesertNightScene(group, deps) {
  const { registerFadeMaterial, floorMaterial, biomeTerrainMaterials } = deps;
  const floorY = (floorMaterial?.userData?.floorHeight) ?? -0.01;

  group.fog = new THREE.FogExp2(0x0a1525, 0.003);

  const moonLight = new THREE.DirectionalLight(0xc8daf0, 1.8);
  moonLight.position.set(-60, 80, -60);
  moonLight.castShadow = true;
  moonLight.shadow.mapSize.width = 1024;
  moonLight.shadow.mapSize.height = 1024;
  moonLight.shadow.camera.left = -60;
  moonLight.shadow.camera.right = 60;
  moonLight.shadow.camera.top = 60;
  moonLight.shadow.camera.bottom = -60;
  moonLight.shadow.camera.near = 0.5;
  moonLight.shadow.camera.far = 200;
  group.add(moonLight);

  const ambientLight = new THREE.AmbientLight(0x2a3545, 0.3);
  group.add(ambientLight);

  const hemiLight = new THREE.HemisphereLight(0x2a5545, 0x4a3a2a, 0.35);
  group.add(hemiLight);

  const reactorLight = new THREE.PointLight(0xffaa00, 3.0, 40);
  reactorLight.position.set(0, floorY + 3, 0);
  group.add(reactorLight);

  const auroraLight = new THREE.PointLight(0x00ffaa, 0.8, 200);
  auroraLight.position.set(0, 60, -100);
  group.add(auroraLight);

  const terrainSize = 400;
  const terrainGeo = new THREE.PlaneGeometry(terrainSize, terrainSize, 100, 100);
  terrainGeo.rotateX(-Math.PI / 2);
  const terrainPos = terrainGeo.attributes.position;
  const terrainColors = [];
  const flatRadius = 20;
  const duneStart = 40;
  const cDark = new THREE.Color(0x2a2218);
  const cMid = new THREE.Color(0x5a4838);
  const cLit = new THREE.Color(0x706858);
  const cMoon = new THREE.Color(0x405060);
  for (let i = 0; i < terrainPos.count; i++) {
    const x = terrainPos.getX(i);
    const z = terrainPos.getZ(i);
    const dist = Math.sqrt(x * x + z * z);
    let heightFactor = (dist - flatRadius) / (duneStart - flatRadius);
    heightFactor = Math.min(Math.max(heightFactor, 0), 1);
    heightFactor = heightFactor * heightFactor * (3 - 2 * heightFactor);
    let h = Math.sin(x * 0.018 + 0.5) * Math.cos(z * 0.014) * 12.0;
    h += Math.sin(x * 0.01 + 2) * Math.sin(z * 0.012 + 1) * 8.0;
    h += Math.cos(z * 0.024 - x * 0.016) * 4.0;
    if (dist > duneStart) h += Math.abs(Math.sin(x * 0.032 + z * 0.024)) * 3.0;
    const finalY = h * heightFactor;
    terrainPos.setY(i, finalY);
    const hNorm = Math.min(1, Math.max(0, (finalY + 5) / 20));
    const col = cDark.clone().lerp(cMid, hNorm * 0.7).lerp(cLit, hNorm * hNorm * 0.6).lerp(cMoon, hNorm * 0.2);
    terrainColors.push(col.r, col.g, col.b);
  }
  terrainGeo.setAttribute('color', new THREE.Float32BufferAttribute(terrainColors, 3));
  terrainGeo.computeVertexNormals();
  const terrainMat = new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true });
  registerFadeMaterial(terrainMat);
  const terrain = new THREE.Mesh(terrainGeo, terrainMat);
  terrain.name = 'desert-night-terrain';
  terrain.position.y = floorY;
  terrain.frustumCulled = false;
  group.add(terrain);

  const flashMat = new THREE.MeshBasicMaterial({ color: 0xff0000, transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide });
  registerFadeMaterial(flashMat);
  const flashPlane = new THREE.Mesh(new THREE.PlaneGeometry(terrainSize, terrainSize), flashMat);
  flashPlane.name = 'desert-night-damage-flash-plane';
  flashPlane.rotation.x = -Math.PI / 2;
  flashPlane.position.y = floorY + 0.02;
  flashPlane.frustumCulled = false;
  group.add(flashPlane);
  biomeTerrainMaterials.push({ type: 'overlay', material: flashMat });

  const skyMat = new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0 } },
    vertexShader: `varying vec3 vWorldPosition; void main() { vec4 worldPos = modelMatrix * vec4(position, 1.0); vWorldPosition = worldPos.xyz; gl_Position = projectionMatrix * viewMatrix * worldPos; }`,
    fragmentShader: `uniform float uTime; varying vec3 vWorldPosition; void main() { float height = normalize(vWorldPosition).y; vec3 horizonColor = vec3(0.15, 0.20, 0.35); vec3 zenithColor = vec3(0.02, 0.02, 0.10); vec3 sky = mix(horizonColor, zenithColor, smoothstep(0.0, 0.8, height)); float auroraTint = exp(-height * 4.0) * 0.15; sky += vec3(0.0, 0.4, 0.2) * auroraTint; gl_FragColor = vec4(sky, 1.0); }`,
    side: THREE.BackSide,
    depthWrite: false
  });
  registerFadeMaterial(skyMat);
  const sky = new THREE.Mesh(new THREE.SphereGeometry(200, 32, 16), skyMat);
  sky.name = 'desert-night-sky-dome';
  sky.frustumCulled = false;
  sky.renderOrder = -100;
  group.add(sky);

  const platformGroup = new THREE.Group();
  platformGroup.name = 'desert-platform';
  platformGroup.position.set(0, floorY, 0);
  group.add(platformGroup);
  const ringMats = [
    new THREE.MeshLambertMaterial({ color: 0xb0b0b0, emissive: 0x101518, emissiveIntensity: 0.3 }),
    new THREE.MeshLambertMaterial({ color: 0x3a3a3a, flatShading: true }),
    new THREE.MeshLambertMaterial({ color: 0x2a2a30, flatShading: true }),
    new THREE.MeshLambertMaterial({ color: 0x222222 })
  ];
  ringMats.forEach((m) => registerFadeMaterial(m));
  const ringGeos = [new THREE.RingGeometry(22, 25, 64), new THREE.RingGeometry(15, 22, 64), new THREE.RingGeometry(8, 15, 48), new THREE.CircleGeometry(8, 32)];
  const ringYs = [0.3, 0.6, 1.0, 1.5];
  ringGeos.forEach((g, i) => {
    const mesh = new THREE.Mesh(g, ringMats[i]);
    mesh.name = `desert-platform-ring-${i}`;
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.y = ringYs[i];
    mesh.frustumCulled = false;
    platformGroup.add(mesh);
  });
  for (let i = 0; i < 8; i++) {
    const strip = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.1, 7), new THREE.MeshBasicMaterial({ color: 0x00ddff, transparent: true, opacity: 0.4, blending: THREE.AdditiveBlending, depthWrite: false }));
    registerFadeMaterial(strip.material);
    strip.name = `desert-platform-led-${i}`;
    strip.position.set(Math.cos((i / 8) * Math.PI * 2) * 10.5, 0.72, Math.sin((i / 8) * Math.PI * 2) * 10.5);
    strip.rotation.y = (i / 8) * Math.PI * 2;
    strip.frustumCulled = false;
    platformGroup.add(strip);
  }

  const towerGroup = new THREE.Group();
  towerGroup.name = 'desert-central-tower';
  towerGroup.position.set(0, floorY + 1.5, 0);
  platformGroup.add(towerGroup);
  const towerMat = new THREE.MeshLambertMaterial({ color: 0x8888aa, emissive: 0x445566, emissiveIntensity: 0.3, transparent: true, opacity: 0.85, flatShading: true });
  registerFadeMaterial(towerMat);
  const towerSegs = [
    [2.0, 1.5, 6, 0], [1.5, 1.0, 6, 6], [1.0, 0.5, 5, 12], [0.5, 0.15, 4, 17], [0.15, 0, 2, 21]
  ];
  towerSegs.forEach(([rb, rt, h, y], i) => {
    const mesh = new THREE.Mesh(new THREE.CylinderGeometry(rb, rt, h, 6, 1, false), towerMat);
    mesh.name = `desert-central-tower-segment-${i}`;
    mesh.position.y = y + h / 2;
    mesh.frustumCulled = false;
    towerGroup.add(mesh);
  });
  const coreMat = new THREE.MeshBasicMaterial({ color: 0xffaa00 });
  registerFadeMaterial(coreMat);
  const coreGlowMat = new THREE.MeshBasicMaterial({ color: 0xff8800, transparent: true, opacity: 0.25, blending: THREE.AdditiveBlending, depthWrite: false });
  registerFadeMaterial(coreGlowMat);
  const reactorCore = new THREE.Mesh(new THREE.SphereGeometry(1.5, 16, 16), coreMat);
  reactorCore.name = 'desert-reactor-core';
  reactorCore.position.set(0, 2.5, 0);
  reactorCore.frustumCulled = false;
  towerGroup.add(reactorCore);
  const reactorGlow = new THREE.Mesh(new THREE.SphereGeometry(2.5, 12, 12), coreGlowMat);
  reactorGlow.name = 'desert-reactor-core-glow';
  reactorGlow.position.copy(reactorCore.position);
  reactorGlow.frustumCulled = false;
  towerGroup.add(reactorGlow);

  const leftSpireGroup = new THREE.Group();
  leftSpireGroup.name = 'desert-spire-left';
  leftSpireGroup.position.set(-40, floorY, -25);
  leftSpireGroup.rotation.y = 0.3;
  group.add(leftSpireGroup);
  const leftBodyMat = new THREE.MeshStandardMaterial ? new THREE.MeshStandardMaterial({ color: 0x1a1a1a, metalness: 0.9, roughness: 0.15 }) : new THREE.MeshLambertMaterial({ color: 0x252525, emissive: 0x081820, emissiveIntensity: 0.4, flatShading: true });
  registerFadeMaterial(leftBodyMat);
  [[5, 12, 5, 0], [3.5, 15, 3.5, 12], [2, 13, 2, 27]].forEach(([w, h, d, y], i) => {
    const seg = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), leftBodyMat);
    seg.name = `desert-spire-left-segment-${i}`;
    seg.position.y = y + h / 2;
    seg.frustumCulled = false;
    leftSpireGroup.add(seg);
  });
  for (let i = 0; i < 4; i++) {
    const ledMat = new THREE.MeshBasicMaterial({ color: 0x00bfff, transparent: true, opacity: 0.6, blending: THREE.AdditiveBlending, depthWrite: false });
    registerFadeMaterial(ledMat);
    const led = new THREE.Mesh(new THREE.BoxGeometry(0.3, 1.5, 0.05), ledMat);
    led.name = `desert-spire-left-led-${i}`;
    led.position.set(i % 2 === 0 ? 1.75 : -1.75, 14 + i * 3, 2.55);
    led.frustumCulled = false;
    leftSpireGroup.add(led);
  }

  const rightSpireGroup = new THREE.Group();
  rightSpireGroup.name = 'desert-spire-right';
  rightSpireGroup.position.set(40, floorY, -20);
  rightSpireGroup.rotation.y = -0.5;
  group.add(rightSpireGroup);
  const rightBaseMat = new THREE.MeshLambertMaterial({ color: 0x8b6914, emissive: 0x3a2500, emissiveIntensity: 0.6 });
  const rightTopMat = new THREE.MeshLambertMaterial({ color: 0x2a2a2a, flatShading: true });
  registerFadeMaterial(rightBaseMat);
  registerFadeMaterial(rightTopMat);
  [[8, 4], [6, 4], [4.5, 4]].forEach(([r, h], i) => {
    const mesh = new THREE.Mesh(new THREE.CylinderGeometry(r, r, h, 8), rightBaseMat);
    mesh.name = `desert-spire-right-step-${i}`;
    mesh.position.y = i * 4 + h / 2;
    mesh.frustumCulled = false;
    rightSpireGroup.add(mesh);
  });
  [[3.5, 14, 12, 12], [2, 12, 26, 13], [1, 6, 38, 14]].forEach(([w, h, y, yoff], i) => {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, w), rightTopMat);
    mesh.name = `desert-spire-right-shaft-${i}`;
    mesh.position.y = y + h / 2;
    mesh.frustumCulled = false;
    rightSpireGroup.add(mesh);
  });
  for (let i = 0; i < 12; i++) {
    const wire = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 12, 4, 1, true), rightTopMat);
    wire.name = `desert-spire-right-wire-${i}`;
    const a = (i / 12) * Math.PI * 2;
    wire.position.set(Math.cos(a) * 4.5, 2 + Math.sin(a * 2) * 0.2, Math.sin(a) * 4.5);
    wire.rotation.z = Math.PI / 2;
    wire.rotation.y = a;
    wire.frustumCulled = false;
    rightSpireGroup.add(wire);
  }

  const ringGroup = new THREE.Group();
  ringGroup.name = 'desert-orbital-ring';
  ringGroup.position.set(0, 35, -20);
  ringGroup.rotation.x = 0.174;
  group.add(ringGroup);
  const ringMat = new THREE.MeshLambertMaterial({ color: 0x3a3a40, emissive: 0x0a1015, emissiveIntensity: 0.5, flatShading: true });
  const ringGlowMat = new THREE.MeshBasicMaterial({ color: 0x0088aa, transparent: true, opacity: 0.2, blending: THREE.AdditiveBlending, depthWrite: false });
  registerFadeMaterial(ringMat);
  registerFadeMaterial(ringGlowMat);
  const ringMain = new THREE.Mesh(new THREE.TorusGeometry(40, 2.0, 8, 64), ringMat);
  ringMain.name = 'desert-orbital-ring-main';
  ringMain.frustumCulled = false;
  ringGroup.add(ringMain);
  const ringGlow = new THREE.Mesh(new THREE.TorusGeometry(40, 2.4, 6, 64), ringGlowMat);
  ringGlow.name = 'desert-orbital-ring-glow';
  ringGlow.frustumCulled = false;
  ringGroup.add(ringGlow);
  const ringLights = [];
  for (let i = 0; i < 24; i++) {
    const lightMat = new THREE.MeshBasicMaterial({ color: 0x00ddff, transparent: true, opacity: 0.7, blending: THREE.AdditiveBlending, depthWrite: false });
    registerFadeMaterial(lightMat);
    const light = new THREE.Mesh(new THREE.SphereGeometry(0.3, 6, 6), lightMat);
    light.name = `desert-orbital-ring-light-${i}`;
    const angle = i * (Math.PI * 2 / 24);
    light.position.set(40 * Math.cos(angle), 2 * Math.sin(angle), 40 * Math.sin(angle));
    light.frustumCulled = false;
    ringGroup.add(light);
    ringLights.push(light);
  }

  const auroraGeo = new THREE.PlaneGeometry(350, 30, 1, 1);
  const auroraBaseMat = new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uColor1: { value: new THREE.Color(0x00ff88) },
      uColor2: { value: new THREE.Color(0x0066ff) },
      uColor3: { value: new THREE.Color(0x8800ff) }
    },
    vertexShader: `varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: `uniform float uTime; uniform vec3 uColor1; uniform vec3 uColor2; uniform vec3 uColor3; varying vec2 vUv; void main() { float wave1 = sin(vUv.x * 3.14159 + uTime * 0.25) * 0.5 + 0.5; float wave2 = sin(vUv.x * 6.28 + uTime * 0.4 + 1.5) * 0.3 + 0.5; float wave = wave1 * 0.7 + wave2 * 0.3; float edgeFade = smoothstep(0.0, 0.2, vUv.y) * smoothstep(1.0, 0.8, vUv.y); float hFade = smoothstep(0.0, 0.15, vUv.x) * smoothstep(1.0, 0.85, vUv.x); float pulse = 0.8 + 0.2 * sin(uTime * 0.15); vec3 color = mix(uColor1, uColor2, wave2 * 0.4); color = mix(color, uColor3, wave1 * wave2 * 0.3); float alpha = edgeFade * hFade * (0.15 + wave * 0.1) * pulse; gl_FragColor = vec4(color, alpha); }`,
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending
  });
  registerFadeMaterial(auroraBaseMat);
  const auroraCfgs = [[65, -110, -0.25, 0.08, 0.0], [80, -130, -0.12, -0.12, 1.8], [55, -90, -0.35, 0.15, 3.6], [90, -150, -0.08, -0.05, 5.4], [50, -75, -0.45, 0.18, 7.2]];
  const auroras = [];
  auroraCfgs.forEach((cfg, i) => {
    const m = auroraBaseMat.clone();
    registerFadeMaterial(m);
    const mesh = new THREE.Mesh(auroraGeo, m);
    mesh.name = `desert-aurora-strip-${i}`;
    mesh.position.set(0, cfg[0], cfg[1]);
    mesh.rotation.x = cfg[2];
    mesh.rotation.z = cfg[3];
    mesh.userData.phaseOffset = cfg[4];
    mesh.frustumCulled = false;
    group.add(mesh);
    auroras.push(mesh);
  });

  const droneGeo = new THREE.OctahedronGeometry(0.4, 0);
  const droneMat = new THREE.MeshLambertMaterial({ color: 0x4466aa, emissive: 0x1a3366, emissiveIntensity: 0.4, flatShading: true });
  registerFadeMaterial(droneMat);
  const droneMesh = new THREE.InstancedMesh(droneGeo, droneMat, 6);
  droneMesh.name = 'desert-floating-drones';
  droneMesh.frustumCulled = false;
  const droneConfigs = [
    { x: 10, baseY: 3.0, z: 5, amp: 0.8, speed: 1.2 },
    { x: -12, baseY: 4.0, z: -8, amp: 1.0, speed: 0.9 },
    { x: 8, baseY: 2.5, z: -15, amp: 0.6, speed: 1.5 },
    { x: -6, baseY: 3.5, z: 12, amp: 0.9, speed: 1.1 },
    { x: 18, baseY: 4.5, z: -3, amp: 0.7, speed: 0.8 },
    { x: -15, baseY: 3.0, z: 0, amp: 1.1, speed: 1.3 }
  ];
  const droneDummy = new THREE.Object3D();
  droneConfigs.forEach((cfg, i) => {
    droneDummy.position.set(cfg.x, cfg.baseY, cfg.z);
    droneDummy.updateMatrix();
    droneMesh.setMatrixAt(i, droneDummy.matrix);
  });
  group.add(droneMesh);

  const sparkCount = 300;
  const sparkPos = new Float32Array(sparkCount * 3);
  const sparkPhase = new Float32Array(sparkCount);
  for (let i = 0; i < sparkCount; i++) { sparkPos[i * 3] = (Math.random() - 0.5) * 200; sparkPos[i * 3 + 1] = floorY + 0.1 + Math.random() * 0.3; sparkPos[i * 3 + 2] = (Math.random() - 0.5) * 200; sparkPhase[i] = Math.random() * Math.PI * 2; }
  const sparkGeo = new THREE.BufferGeometry();
  sparkGeo.setAttribute('position', new THREE.BufferAttribute(sparkPos, 3));
  sparkGeo.setAttribute('aPhase', new THREE.BufferAttribute(sparkPhase, 1));
  const sparkMat = new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0 }, uPixelRatio: { value: Math.min(globalThis.devicePixelRatio || 1, 2) } },
    vertexShader: `attribute float aPhase; uniform float uTime; uniform float uPixelRatio; varying float vBrightness; void main() { float cycle = fract(uTime * 0.5 + aPhase); vBrightness = smoothstep(0.95, 1.0, cycle) * 5.0; vBrightness = min(vBrightness, 1.0); vec4 mvPosition = modelViewMatrix * vec4(position, 1.0); gl_PointSize = (1.5 + vBrightness * 2.0) * uPixelRatio * (100.0 / -mvPosition.z); gl_PointSize = max(gl_PointSize, 0.5); gl_Position = projectionMatrix * mvPosition; }`,
    fragmentShader: `varying float vBrightness; void main() { float dist = length(gl_PointCoord - vec2(0.5)); if (dist > 0.5) discard; float alpha = (1.0 - smoothstep(0.0, 0.5, dist)) * vBrightness; vec3 color = vec3(1.0, 0.9, 0.6); gl_FragColor = vec4(color, alpha); }`,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    fog: false
  });
  registerFadeMaterial(sparkMat);
  const sparks = new THREE.Points(sparkGeo, sparkMat);
  sparks.name = 'desert-sand-sparkles';
  sparks.frustumCulled = false;
  group.add(sparks);

  const dustCount = 150;
  const dustPos = new Float32Array(dustCount * 3);
  const dustPhase = new Float32Array(dustCount);
  for (let i = 0; i < dustCount; i++) { dustPos[i * 3] = (Math.random() - 0.5) * 40; dustPos[i * 3 + 1] = floorY + 0.5 + Math.random() * 8; dustPos[i * 3 + 2] = (Math.random() - 0.5) * 40; dustPhase[i] = Math.random() * Math.PI * 2; }
  const dustGeo = new THREE.BufferGeometry();
  dustGeo.setAttribute('position', new THREE.BufferAttribute(dustPos, 3));
  dustGeo.setAttribute('aPhase', new THREE.BufferAttribute(dustPhase, 1));
  const dustMat = new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0 } },
    vertexShader: `attribute float aPhase; uniform float uTime; varying float vAlpha; void main() { vec3 pos = position; pos.x += sin(uTime * 0.1 + aPhase) * 2.0; pos.y += sin(uTime * 0.15 + aPhase * 1.3) * 0.5; pos.z += cos(uTime * 0.12 + aPhase * 0.7) * 2.0; vAlpha = 0.3 + 0.2 * sin(uTime * 0.3 + aPhase); vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0); gl_PointSize = 4.0 * (80.0 / -mvPosition.z); gl_PointSize = max(gl_PointSize, 1.0); gl_Position = projectionMatrix * mvPosition; }`,
    fragmentShader: `varying float vAlpha; void main() { float dist = length(gl_PointCoord - vec2(0.5)); if (dist > 0.5) discard; float alpha = (1.0 - smoothstep(0.1, 0.5, dist)) * vAlpha; vec3 color = vec3(1.0, 0.85, 0.5); gl_FragColor = vec4(color, alpha); }`,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    fog: false
  });
  registerFadeMaterial(dustMat);
  const dust = new THREE.Points(dustGeo, dustMat);
  dust.name = 'desert-golden-dust';
  dust.frustumCulled = false;
  group.add(dust);

  const debrisGeo = new THREE.OctahedronGeometry(0.25, 0);
  const debrisMat = new THREE.MeshLambertMaterial({ color: 0x808080, flatShading: true });
  registerFadeMaterial(debrisMat);
  const debris = new THREE.InstancedMesh(debrisGeo, debrisMat, 30);
  debris.name = 'desert-metallic-debris';
  debris.frustumCulled = false;
  const debrisDummy = new THREE.Object3D();
  const debrisCols = [0x808080, 0x1e3a8a, 0xc0a060, 0x1c1c1c];
  for (let i = 0; i < 30; i++) {
    const r = 60 + Math.random() * 60;
    const a = Math.random() * Math.PI * 2;
    debrisDummy.position.set(Math.cos(a) * r, floorY + 0.15, Math.sin(a) * r);
    debrisDummy.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, Math.random() * Math.PI);
    debrisDummy.scale.setScalar(0.3 + Math.random() * 0.7);
    debrisDummy.updateMatrix();
    debris.setMatrixAt(i, debrisDummy.matrix);
    debris.setColorAt(i, new THREE.Color(debrisCols[i % debrisCols.length]));
  }
  group.add(debris);

  const bgSpireMat = new THREE.MeshLambertMaterial({ color: 0x3a3a3a, flatShading: true });
  registerFadeMaterial(bgSpireMat);
  const bgSpirePositions = [[-120, -100, 35, 2.5, 0.2], [130, -90, 28, 2.0, -0.4], [-80, -130, 22, 1.8, 0.8], [100, -120, 30, 2.2, -0.1]];
  bgSpirePositions.forEach((cfg, i) => {
    const g = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), bgSpireMat);
    g.name = `desert-background-spire-${i}`;
    g.position.set(cfg[0], floorY, cfg[1]);
    g.scale.set(cfg[3], cfg[2], cfg[3]);
    g.rotation.y = cfg[4];
    g.frustumCulled = false;
    group.add(g);
    if (i < 2) {
      const tipMat = new THREE.MeshBasicMaterial({ color: 0x00ddff, transparent: true, opacity: 0.3, blending: THREE.AdditiveBlending, depthWrite: false });
      registerFadeMaterial(tipMat);
      const tip = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.5, 1.2), tipMat);
      tip.name = `desert-background-spire-tip-${i}`;
      tip.position.set(cfg[0], floorY + cfg[2] * 0.5 + 0.25, cfg[1]);
      tip.frustumCulled = false;
      group.add(tip);
    }
  });

  const starCount = 500;
  const starPositions = new Float32Array(starCount * 3);
  const starPhases = new Float32Array(starCount);
  const pixelRatio = Math.min(globalThis.devicePixelRatio || 1, 2);
  for (let i = 0; i < starCount; i++) {
    const theta = Math.random() * Math.PI * 2;
    const radius = 150 + Math.random() * 80;
    const phi = Math.random() * Math.PI * 0.5;
    starPositions[i * 3] = Math.cos(theta) * Math.sin(phi) * radius;
    starPositions[i * 3 + 1] = Math.cos(phi) * radius + 20;
    starPositions[i * 3 + 2] = Math.sin(theta) * Math.sin(phi) * radius;
    starPhases[i] = Math.random() * Math.PI * 2;
  }
  const starGeometry = new THREE.BufferGeometry();
  starGeometry.setAttribute('position', new THREE.BufferAttribute(starPositions, 3));
  starGeometry.setAttribute('aPhase', new THREE.BufferAttribute(starPhases, 1));
  const starMat = new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0 }, uPixelRatio: { value: pixelRatio } },
    vertexShader: `attribute float aPhase; uniform float uTime; uniform float uPixelRatio; varying float vTwinkle; void main() { vTwinkle = 0.5 + 0.5 * sin(uTime * 2.0 + aPhase); vec4 mvPosition = modelViewMatrix * vec4(position, 1.0); float size = 2.5 * uPixelRatio * vTwinkle; gl_PointSize = size * (200.0 / -mvPosition.z); gl_Position = projectionMatrix * mvPosition; }`,
    fragmentShader: `varying float vTwinkle; void main() { float dist = length(gl_PointCoord - vec2(0.5)); if (dist > 0.5) discard; float alpha = 1.0 - smoothstep(0.0, 0.5, dist); vec3 color = mix(vec3(0.7, 0.85, 1.0), vec3(0.5, 1.0, 0.85), vTwinkle); gl_FragColor = vec4(color * (0.8 + vTwinkle * 0.2), alpha * vTwinkle); }`,
    transparent: true, depthWrite: false, fog: false, blending: THREE.AdditiveBlending
  });
  registerFadeMaterial(starMat);
  const stars = new THREE.Points(starGeometry, starMat);
  stars.name = 'desert-night-stars';
  stars.frustumCulled = false;
  stars.renderOrder = 999;
  group.add(stars);

  const moonGroup = new THREE.Group();
  moonGroup.name = 'desert-moon';
  const moonMat = new THREE.MeshBasicMaterial({ color: 0xfffef8 });
  registerFadeMaterial(moonMat);
  moonGroup.add(new THREE.Mesh(new THREE.IcosahedronGeometry(15, 2), moonMat));
  const moonGlowMat = new THREE.MeshBasicMaterial({ color: 0xc8daf0, transparent: true, opacity: 0.2, side: THREE.BackSide, depthWrite: false });
  registerFadeMaterial(moonGlowMat);
  const moonGlow = new THREE.Mesh(new THREE.IcosahedronGeometry(25, 2), moonGlowMat);
  moonGroup.add(moonGlow);
  moonGroup.position.set(-90, 50, -120);
  group.add(moonGroup);

  group.rotation.y = -0.436;
  group.position.set(-2.12, -0.20, -4.82);

  group.userData.update = (now, dt) => {
    const time = now * 0.001;
    skyMat.uniforms.uTime.value = time;
    starMat.uniforms.uTime.value = time;
    sparkMat.uniforms.uTime.value = time;
    dustMat.uniforms.uTime.value = time;
    auroraLight.intensity = 0.8;
    reactorLight.intensity = 3.0 + Math.sin(time * 2.0) * 0.5;
    reactorCore.scale.set(1 + Math.sin(time * 2.0) * 0.15, 1, 1 + Math.sin(time * 2.0) * 0.15);
    reactorGlow.scale.setScalar(1 + Math.sin(time * 2.0) * 0.15);
    droneConfigs.forEach((cfg, i) => {
      const y = cfg.baseY + Math.sin(time * cfg.speed + i * 1.2) * cfg.amp;
      const dummy = new THREE.Object3D();
      dummy.position.set(cfg.x, y, cfg.z);
      dummy.rotation.y = time * (0.3 + i * 0.05);
      dummy.rotation.x = Math.sin(time * 0.3 + i) * 0.1;
      dummy.updateMatrix();
      droneMesh.setMatrixAt(i, dummy.matrix);
    });
    droneMesh.instanceMatrix.needsUpdate = true;
    ringLights.forEach((light, i) => {
      const brightness = Math.sin(time * 1.5 + i * (Math.PI * 2 / 24));
      light.material.opacity = 0.3 + brightness * 0.4;
      light.scale.setScalar(0.8 + brightness * 0.2);
    });
    auroras.forEach((strip) => { strip.material.uniforms.uTime.value = time + strip.userData.phaseOffset; });
    moonGroup.position.x = -90 + Math.sin(time * 0.001) * 2;
    moonGroup.position.y = 50 + Math.cos(time * 0.0008) * 1.5;
  };
}
