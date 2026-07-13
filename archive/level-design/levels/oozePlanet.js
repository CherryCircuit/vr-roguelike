import * as THREE from 'three';

import {
  applyTerrainHeights,
  buildExtrudedProfileMesh,
  buildProfileMesh,
  createClearanceOverlay,
  createGradientCanvasTexture,
  createInstancedMesh,
  createLevelRoot,
  createRibbonGeometry,
  createShot
} from '../shared/biomeUtils.js';

export const levelMeta = {
  id: 'ooze-planet',
  name: 'Ooze Planet',
  dominantColors: ['#0f0818', '#2a1340', '#59ff91', '#9a4bff'],
  targetBudgets: '15-18 draws'
};

export async function loadLevel(ctx) {
  const tracker = ctx.resourceTracker;
  const groups = createLevelRoot();

  const lightningBolts = [];
  let lightningCooldown = 1.4;
  let lightningStrength = 0;

  const sky = tracker.trackObject(new THREE.Mesh(
    tracker.trackGeometry(new THREE.SphereGeometry(150, 32, 24)),
    ctx.registerFadeMaterial(tracker.trackMaterial(new THREE.MeshBasicMaterial({
      map: createGradientCanvasTexture(tracker, 8, 1024, [
        [0.00, '#06020e'],
        [0.16, '#0d0617'],
        [0.38, '#25103a'],
        [0.60, '#5b2d82'],
        [0.78, '#a35af0'],
        [1.00, '#ff8ddb']
      ]),
      side: THREE.BackSide
    })))
  ));
  sky.frustumCulled = false;
  groups.skyGroup.add(sky);

  const groundGeometry = tracker.trackGeometry(new THREE.PlaneGeometry(150, 150, 74, 74));
  applyTerrainHeights(groundGeometry, (x, _y, z) => {
    const wave = Math.sin(x * 0.075) * 0.28 + Math.cos(z * 0.055) * 0.26;
    const valley = Math.max(0, 12 - Math.abs(x + 8)) * -0.017;
    const sideRise = Math.max(0, Math.abs(x) - 18) * 0.064;
    const farRise = Math.max(0, -z - 34) * 0.021;
    const shelves = Math.max(0, -z - 18) * Math.max(0, Math.abs(x) - 8) * 0.0007;
    return wave + valley + sideRise + farRise + shelves;
  });
  const ground = tracker.trackObject(new THREE.Mesh(
    groundGeometry,
    tracker.trackMaterial(new THREE.ShaderMaterial({
      uniforms: {
        uLightDir: { value: new THREE.Vector3(-0.4, 1.0, -0.2).normalize() },
        uBase: { value: new THREE.Color('#15091e') },
        uHighlight: { value: new THREE.Color('#412660') },
        uShadow: { value: new THREE.Color('#09050f') }
      },
      vertexShader: `
        varying vec3 vWorldPosition;
        varying vec3 vWorldNormal;
        void main() {
          vec4 worldPosition = modelMatrix * vec4(position, 1.0);
          vWorldPosition = worldPosition.xyz;
          vWorldNormal = normalize(mat3(modelMatrix) * normal);
          gl_Position = projectionMatrix * viewMatrix * worldPosition;
        }
      `,
      fragmentShader: `
        varying vec3 vWorldPosition;
        varying vec3 vWorldNormal;
        uniform vec3 uLightDir;
        uniform vec3 uBase;
        uniform vec3 uHighlight;
        uniform vec3 uShadow;
        void main() {
          float light = clamp(dot(normalize(vWorldNormal), normalize(uLightDir)) * 0.5 + 0.5, 0.0, 1.0);
          float basin = clamp((-vWorldPosition.z - 8.0) / 120.0, 0.0, 1.0);
          vec3 color = mix(uShadow, uBase, light * 0.9);
          color = mix(color, uHighlight, basin * 0.58);
          gl_FragColor = vec4(color, 1.0);
        }
      `
    }))
  ));
  ground.rotation.x = -Math.PI / 2;
  groups.terrainGroup.add(ground);

  const volcanicTint = tracker.trackObject(new THREE.Mesh(
    tracker.trackGeometry(new THREE.PlaneGeometry(150, 150)),
    ctx.registerFadeMaterial(tracker.trackMaterial(new THREE.MeshBasicMaterial({
      map: createGradientCanvasTexture(tracker, 4, 512, [
        [0.0, 'rgba(111,48,198,0.00)'],
        [0.34, 'rgba(120,50,205,0.06)'],
        [0.74, 'rgba(27,12,46,0.20)'],
        [1.0, 'rgba(0,0,0,0.00)']
      ]),
      transparent: true,
      depthWrite: false
    })))
  ));
  volcanicTint.rotation.x = -Math.PI / 2;
  volcanicTint.position.set(0, 0.06, -10);
  groups.terrainGroup.add(volcanicTint);

  const backRange = tracker.trackObject(buildExtrudedProfileMesh([
    [-84, 10], [-66, 18], [-40, 14], [-10, 18], [14, 26], [42, 20], [66, 16], [84, 12]
  ], -122, 0x1d0d2a, tracker, { left: -84, right: 84, depth: 14 }));
  const midRange = tracker.trackObject(buildExtrudedProfileMesh([
    [-84, 14], [-64, 24], [-38, 18], [-10, 22], [18, 28], [38, 22], [58, 34], [84, 16]
  ], -104, 0x28153c, tracker, { left: -84, right: 84, depth: 16 }));
  const leftShelf = tracker.trackObject(buildExtrudedProfileMesh([
    [-40, 6], [-28, 10], [-12, 14], [6, 11], [22, 8], [40, 6]
  ], -70, 0x180c24, tracker, { left: -40, right: 40, depth: 14 }));
  leftShelf.position.x = -50;
  leftShelf.rotation.y = 0.14;
  const rightShelf = tracker.trackObject(buildExtrudedProfileMesh([
    [-40, 6], [-24, 9], [-8, 14], [10, 12], [26, 9], [40, 6]
  ], -70, 0x180c24, tracker, { left: -40, right: 40, depth: 14 }));
  rightShelf.position.x = 50;
  rightShelf.rotation.y = -0.16;
  groups.landmarksGroup.add(backRange, midRange, leftShelf, rightShelf);

  const riverMaterial = ctx.registerFadeMaterial(tracker.trackMaterial(new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    uniforms: {
      uTime: { value: 0 },
      uFlowA: { value: new THREE.Color('#52ff8f') },
      uFlowB: { value: new THREE.Color('#dbffd0') },
      uGlow: { value: new THREE.Color('#86ffbd') }
    },
    vertexShader: `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      varying vec2 vUv;
      uniform float uTime;
      uniform vec3 uFlowA;
      uniform vec3 uFlowB;
      uniform vec3 uGlow;
      void main() {
        float streams = 0.5 + 0.5 * sin(vUv.y * 22.0 - uTime * 1.2 + vUv.x * 12.0);
        float seams = 0.5 + 0.5 * sin(vUv.y * 12.0 - uTime * 0.55 - vUv.x * 3.0);
        float edge = smoothstep(0.0, 0.18, vUv.x) + (1.0 - smoothstep(0.82, 1.0, vUv.x));
        vec3 color = mix(uFlowA, uFlowB, streams * 0.7 + seams * 0.3);
        color += uGlow * edge * 0.45;
        float alpha = 0.78 + streams * 0.12;
        gl_FragColor = vec4(color, alpha);
      }
    `
  })));
  const river = tracker.trackObject(new THREE.Mesh(
    createRibbonGeometry([
      new THREE.Vector3(-40, 0, -18),
      new THREE.Vector3(-28, 0, -28),
      new THREE.Vector3(-10, 0, -34),
      new THREE.Vector3(12, 0, -42),
      new THREE.Vector3(20, 0, -56),
      new THREE.Vector3(4, 0, -74),
      new THREE.Vector3(12, 0, -92)
    ], [6.4, 13.8], tracker, 0.14),
    riverMaterial
  ));
  groups.terrainGroup.add(river);

  buildOozeProps(tracker, ctx, groups.propsGroup);
  const citadel = buildCitadel(tracker);
  groups.landmarksGroup.add(citadel);

  const auroraTexture = createAuroraTexture(tracker);
  const auroraMaterial = ctx.registerFadeMaterial(tracker.trackMaterial(new THREE.MeshBasicMaterial({
    map: auroraTexture,
    transparent: true,
    opacity: 0.72,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    side: THREE.DoubleSide
  })));
  const auroraA = tracker.trackObject(new THREE.Mesh(
    tracker.trackGeometry(new THREE.PlaneGeometry(120, 48)),
    auroraMaterial
  ));
  auroraA.position.set(-10, 36, -108);
  auroraA.rotation.y = 0.1;
  const auroraB = tracker.trackObject(new THREE.Mesh(
    tracker.trackGeometry(new THREE.PlaneGeometry(106, 44)),
    tracker.trackMaterial(auroraMaterial.clone())
  ));
  auroraB.position.set(18, 30, -100);
  auroraB.rotation.y = -0.18;
  groups.fxGroup.add(auroraA, auroraB);

  const stormCloud = tracker.trackObject(new THREE.Mesh(
    tracker.trackGeometry(new THREE.PlaneGeometry(64, 26)),
    ctx.registerFadeMaterial(tracker.trackMaterial(new THREE.MeshBasicMaterial({
      map: createStormCloudTexture(tracker),
      transparent: true,
      opacity: 0.82,
      depthWrite: false
    })))
  ));
  stormCloud.position.set(38, 36, -88);
  groups.fxGroup.add(stormCloud);

  const stormGlow = tracker.trackObject(new THREE.Mesh(
    tracker.trackGeometry(new THREE.PlaneGeometry(56, 20)),
    ctx.registerFadeMaterial(tracker.trackMaterial(new THREE.MeshBasicMaterial({
      map: createStormGlowTexture(tracker),
      transparent: true,
      opacity: 0.22,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    })))
  ));
  stormGlow.position.set(38, 24, -88);
  groups.fxGroup.add(stormGlow);

  const citadelGlow = tracker.trackObject(new THREE.Mesh(
    tracker.trackGeometry(new THREE.PlaneGeometry(42, 18)),
    ctx.registerFadeMaterial(tracker.trackMaterial(new THREE.MeshBasicMaterial({
      map: createGradientCanvasTexture(tracker, 8, 256, [
        [0.0, 'rgba(255,120,220,0.00)'],
        [0.28, 'rgba(255,120,220,0.20)'],
        [0.72, 'rgba(120,255,200,0.10)'],
        [1.0, 'rgba(255,120,220,0.00)']
      ]),
      transparent: true,
      opacity: 0.66,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    })))
  ));
  citadelGlow.position.set(30, 8.2, -92);
  groups.fxGroup.add(citadelGlow);

  const moonLarge = buildMoon(tracker, '#cd81ff', 40, [-42, 38, -112], '#7b2cff');
  const moonSmall = buildMoon(tracker, '#ff8ef5', 18, [-4, 50, -122], '#7d43ff');
  groups.skyGroup.add(moonLarge.group, moonSmall.group);

  const stars = buildStars(tracker, ctx.rng);
  groups.fxGroup.add(stars.points, stars.constellations);

  const lightningMaterial = tracker.trackMaterial(new THREE.LineBasicMaterial({
    color: 0xffb2ff,
    transparent: true,
    opacity: 0,
    depthWrite: false
  }));
  const boltAnchors = [
    [[26, 34, -88], [18, 16, -84]],
    [[36, 38, -92], [28, 18, -88]],
    [[46, 32, -90], [42, 15, -90]],
    [[54, 37, -94], [50, 20, -92]]
  ];
  boltAnchors.forEach(([start, end]) => {
    const line = buildLightningBolt(start, end, tracker, lightningMaterial);
    lightningBolts.push(line);
    groups.fxGroup.add(line);
  });

  const clearanceOverlay = createClearanceOverlay(tracker);
  groups.debugGroup.add(clearanceOverlay);

  return {
    root: groups.root,
    debug: { clearanceOverlay },
    fallbackActive: false,
    sceneOptions: {
      background: 0x090511,
      fog: new THREE.FogExp2(0x0d0614, 0.0101),
      cameraStart: [0, 1.6, 2.5],
      cameraLookAt: [0, 1.8, -28],
      heroShot: createShot([-6, 6.6, 34], [24, 13, -90], 48),
      gameplayShot: createShot([0, 1.6, 0], [0, 2.0, -36], 70)
    },
    update(dt, elapsed) {
      riverMaterial.uniforms.uTime.value = elapsed;
      auroraA.material.opacity = 0.78 + Math.sin(elapsed * 0.16) * 0.05;
      auroraB.material.opacity = 0.68 + Math.sin(elapsed * 0.17 + 0.8) * 0.05;
      stormCloud.material.opacity = 0.76 + Math.sin(elapsed * 0.1 + 0.4) * 0.04;
      stormGlow.material.opacity = 0.18 + Math.sin(elapsed * 0.22 + 0.6) * 0.04 + lightningMaterial.opacity * 0.24;
      moonLarge.glow.material.opacity = 0.24 + Math.sin(elapsed * 0.12) * 0.02;
      moonSmall.glow.material.opacity = 0.18 + Math.sin(elapsed * 0.14 + 0.7) * 0.02;
      citadelGlow.material.opacity = 0.58 + Math.sin(elapsed * 0.22 + 0.5) * 0.05;

      lightningCooldown -= dt;
      if (lightningCooldown <= 0) {
        lightningStrength = 0.22;
        lightningCooldown = 2.8 + ctx.rng.range(0.0, 3.1);
      }
      if (lightningStrength > 0) {
        lightningStrength = Math.max(0, lightningStrength - dt);
        lightningMaterial.opacity = lightningStrength > 0.12 ? 0.95 : 0.42;
      } else {
        lightningMaterial.opacity = 0.12;
      }
    },
    dispose() {}
  };
}

function buildOozeProps(tracker, ctx, parent) {
  const crystalTransforms = [];
  const basaltTransforms = [];
  const floraTransforms = [];
  for (let i = 0; i < 16; i++) {
    const side = i % 2 === 0 ? -1 : 1;
    const z = -10 - i * 6.0;
    crystalTransforms.push({
      position: [side * (28 + (i % 3) * 4.8), 2.0 + (i % 2) * 0.2, z],
      rotation: [0, ctx.rng.range(-Math.PI, Math.PI), 0],
      scale: [1.0 + (i % 3) * 0.18, 1.2 + (i % 4) * 0.24, 1.0 + (i % 2) * 0.12]
    });
  }
  for (let i = 0; i < 14; i++) {
    const side = i % 2 === 0 ? -1 : 1;
    const z = -8 - i * 5.8;
    basaltTransforms.push({
      position: [side * (18 + (i % 4) * 4.0), 1.6, z],
      rotation: [0, ctx.rng.range(-Math.PI, Math.PI), 0.2 * side],
      scale: [0.8 + (i % 3) * 0.12, 1.4 + (i % 2) * 0.3, 0.7 + (i % 4) * 0.16]
    });
  }
  for (let i = 0; i < 18; i++) {
    const side = i % 2 === 0 ? -1 : 1;
    const z = -6 - i * 4.4;
    floraTransforms.push({
      position: [side * (24 + (i % 5) * 3.1), 0.9, z],
      rotation: [0, ctx.rng.range(-Math.PI, Math.PI), 0],
      scale: [0.78 + (i % 3) * 0.16, 1.0 + (i % 4) * 0.18, 0.78 + (i % 2) * 0.14]
    });
  }

  const crystals = createInstancedMesh(
    new THREE.ConeGeometry(0.7, 4.8, 5),
    new THREE.MeshBasicMaterial({ color: 0x7cecff }),
    crystalTransforms,
    tracker
  );
  const basalts = createInstancedMesh(
    new THREE.BoxGeometry(0.9, 3.4, 0.5),
    new THREE.MeshBasicMaterial({ color: 0x1c1027 }),
    basaltTransforms,
    tracker
  );
  const floraA = createInstancedMesh(
    new THREE.ConeGeometry(0.34, 2.0, 5),
    new THREE.MeshBasicMaterial({ color: 0x44f88d }),
    floraTransforms,
    tracker
  );
  const floraB = createInstancedMesh(
    new THREE.ConeGeometry(0.26, 1.4, 5),
    new THREE.MeshBasicMaterial({ color: 0xb855ff }),
    floraTransforms.map((transform, index) => ({
      position: [transform.position[0] + (index % 2 === 0 ? 0.7 : -0.7), 0.7, transform.position[2] + 0.4],
      rotation: transform.rotation,
      scale: [transform.scale[0] * 0.7, transform.scale[1] * 0.7, transform.scale[2] * 0.7]
    })),
    tracker
  );
  parent.add(crystals, basalts, floraA, floraB);
}

function buildCitadel(tracker) {
  const citadel = tracker.trackObject(new THREE.Group());
  const darkMaterial = tracker.trackMaterial(new THREE.MeshBasicMaterial({ color: 0x1b0e26 }));
  const glowMaterial = tracker.trackMaterial(new THREE.MeshBasicMaterial({
    color: 0xff6ad9,
    transparent: true,
    opacity: 0.96,
    depthWrite: false
  }));

  const spireHeights = [18, 26, 34, 28, 20, 24, 18];
  for (let i = 0; i < spireHeights.length; i++) {
    const spire = tracker.trackObject(new THREE.Mesh(
      tracker.trackGeometry(new THREE.ConeGeometry(1.9 - i * 0.1, spireHeights[i], 6)),
      darkMaterial
    ));
    spire.position.set(i * 3.4 - 10.5, spireHeights[i] * 0.5, (i % 2) * -2.6);
    citadel.add(spire);

    const windowStrip = tracker.trackObject(new THREE.Mesh(
      tracker.trackGeometry(new THREE.PlaneGeometry(0.6, spireHeights[i] * 0.42)),
      glowMaterial
    ));
    windowStrip.position.set(spire.position.x, spire.position.y * 0.84, spire.position.z + 1.22);
    citadel.add(windowStrip);
  }

  const dome = tracker.trackObject(new THREE.Mesh(
    tracker.trackGeometry(new THREE.SphereGeometry(8.0, 12, 8, 0, Math.PI * 2, 0, Math.PI * 0.5)),
    darkMaterial
  ));
  dome.position.set(2.4, 7.8, -5.4);
  citadel.add(dome);

  citadel.position.set(30, 2.6, -92);
  citadel.rotation.y = -0.48;
  citadel.scale.setScalar(1.9);
  return citadel;
}

function buildMoon(tracker, color, size, position, glowColor) {
  const disc = tracker.trackObject(new THREE.Mesh(
    tracker.trackGeometry(new THREE.PlaneGeometry(size, size)),
    tracker.trackMaterial(new THREE.MeshBasicMaterial({
      map: createMoonTexture(tracker, color),
      transparent: true,
      depthWrite: false
    }))
  ));
  disc.position.set(...position);
  const glow = tracker.trackObject(new THREE.Mesh(
    tracker.trackGeometry(new THREE.CircleGeometry(size * 0.72, 32)),
    tracker.trackMaterial(new THREE.MeshBasicMaterial({
      color: glowColor,
      transparent: true,
      opacity: 0.18,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    }))
  ));
  glow.position.set(position[0], position[1], position[2] - 1);
  const group = tracker.trackObject(new THREE.Group());
  group.add(disc, glow);
  return { group, glow };
}

function buildStars(tracker, rng) {
  const positions = new Float32Array(140 * 3);
  for (let i = 0; i < 140; i++) {
    const i3 = i * 3;
    positions[i3] = rng.range(-96, 96);
    positions[i3 + 1] = rng.range(24, 92);
    positions[i3 + 2] = rng.range(-138, -12);
  }
  const geometry = tracker.trackGeometry(new THREE.BufferGeometry());
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  const points = tracker.trackObject(new THREE.Points(
    geometry,
    tracker.trackMaterial(new THREE.PointsMaterial({
      color: 0xffffff,
      size: 0.22,
      transparent: true,
      opacity: 0.74,
      depthWrite: false
    }))
  ));

  const constellationPositions = [
    -76, 82, -110, -72, 86, -112,
    -72, 86, -112, -66, 78, -114,
    -22, 72, -106, -14, 78, -108,
    -14, 78, -108, -6, 70, -110
  ];
  const constellationGeometry = tracker.trackGeometry(new THREE.BufferGeometry());
  constellationGeometry.setAttribute('position', new THREE.Float32BufferAttribute(constellationPositions, 3));
  const constellations = tracker.trackObject(new THREE.LineSegments(
    constellationGeometry,
    tracker.trackMaterial(new THREE.LineBasicMaterial({
      color: 0xb79cff,
      transparent: true,
      opacity: 0.28
    }))
  ));
  return { points, constellations };
}

function createMoonTexture(tracker, baseColor) {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx2d = canvas.getContext('2d');
  const gradient = ctx2d.createRadialGradient(170, 160, 30, 256, 256, 230);
  gradient.addColorStop(0.0, '#ffffff');
  gradient.addColorStop(0.16, baseColor);
  gradient.addColorStop(1.0, '#7848a8');
  ctx2d.fillStyle = gradient;
  ctx2d.beginPath();
  ctx2d.arc(256, 256, 226, 0, Math.PI * 2);
  ctx2d.fill();
  const craters = [
    [140, 144, 40], [212, 104, 22], [286, 188, 30], [188, 248, 36],
    [324, 278, 28], [230, 328, 24], [336, 118, 18]
  ];
  craters.forEach(([x, y, r]) => {
    ctx2d.fillStyle = 'rgba(44,18,74,0.45)';
    ctx2d.beginPath();
    ctx2d.arc(x, y, r, 0, Math.PI * 2);
    ctx2d.fill();
  });
  const texture = tracker.trackTexture(new THREE.CanvasTexture(canvas));
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function createAuroraTexture(tracker) {
  const canvas = document.createElement('canvas');
  canvas.width = 768;
  canvas.height = 512;
  const ctx2d = canvas.getContext('2d');
  const bands = [
    [90, 98, 90, '#5eff9d'],
    [220, 110, 102, '#6bf3b2'],
    [372, 94, 82, '#c57cff'],
    [536, 122, 88, '#61ffb0'],
    [664, 100, 74, '#8deeff']
  ];
  bands.forEach(([x, w, h, color], index) => {
    const gradient = ctx2d.createLinearGradient(0, 0, 0, canvas.height);
    gradient.addColorStop(0.0, 'rgba(255,255,255,0.0)');
        gradient.addColorStop(0.20, `${color}28`);
        gradient.addColorStop(0.58, `${color}aa`);
        gradient.addColorStop(1.0, 'rgba(255,255,255,0.0)');
    ctx2d.fillStyle = gradient;
    for (let y = 0; y < canvas.height; y += 6) {
      const offset = Math.sin(y * 0.04 + index * 0.7) * 12;
      ctx2d.fillRect(x + offset - w * 0.5, y, w, h);
    }
  });
  const texture = tracker.trackTexture(new THREE.CanvasTexture(canvas));
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function createStormCloudTexture(tracker) {
  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = 512;
  const ctx2d = canvas.getContext('2d');
  const blobs = [
    [220, 250, 170, 76], [380, 220, 180, 82], [560, 230, 210, 88], [770, 260, 170, 72]
  ];
  blobs.forEach(([x, y, w, h], index) => {
    const gradient = ctx2d.createRadialGradient(x, y, 16, x, y, w * 0.6);
    gradient.addColorStop(0.0, index % 2 === 0 ? 'rgba(56,36,92,0.82)' : 'rgba(42,28,76,0.82)');
    gradient.addColorStop(1.0, 'rgba(10,6,22,0.00)');
    ctx2d.fillStyle = gradient;
    ctx2d.beginPath();
    ctx2d.ellipse(x, y, w, h, 0, 0, Math.PI * 2);
    ctx2d.fill();
  });
  const texture = tracker.trackTexture(new THREE.CanvasTexture(canvas));
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function createStormGlowTexture(tracker) {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 256;
  const ctx2d = canvas.getContext('2d');
  const gradient = ctx2d.createRadialGradient(256, 128, 20, 256, 128, 180);
  gradient.addColorStop(0.0, 'rgba(255,190,255,0.70)');
  gradient.addColorStop(0.32, 'rgba(205,120,255,0.34)');
  gradient.addColorStop(1.0, 'rgba(205,120,255,0.00)');
  ctx2d.fillStyle = gradient;
  ctx2d.fillRect(0, 0, canvas.width, canvas.height);
  const texture = tracker.trackTexture(new THREE.CanvasTexture(canvas));
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function buildLightningBolt(start, end, tracker, material) {
  const tValues = [0.0, 0.16, 0.34, 0.52, 0.70, 0.86, 1.0];
  const xOffsets = [0.0, 2.2, -1.8, 2.8, -1.2, 1.2, 0.0];
  const positions = [];
  for (let i = 0; i < tValues.length; i++) {
    const t = tValues[i];
    positions.push(
      THREE.MathUtils.lerp(start[0], end[0], t) + xOffsets[i],
      THREE.MathUtils.lerp(start[1], end[1], t),
      THREE.MathUtils.lerp(start[2], end[2], t)
    );
  }
  const geometry = tracker.trackGeometry(new THREE.BufferGeometry());
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  return tracker.trackObject(new THREE.Line(geometry, material));
}
