import * as THREE from 'three';

import {
  buildExtrudedProfileMesh,
  buildProfileMesh,
  createClearanceOverlay,
  createGradientCanvasTexture,
  createInstancedMesh,
  createLevelRoot,
  createShot
} from '../shared/biomeUtils.js';

export const levelMeta = {
  id: 'synthwave-planet',
  name: 'Synthwave Planet',
  dominantColors: ['#ff4fa3', '#ff8d4d', '#ffd36f', '#6f2cff'],
  targetBudgets: '12-18 draws'
};

export async function loadLevel(ctx) {
  const tracker = ctx.resourceTracker;
  const groups = createLevelRoot();

  const sky = tracker.trackObject(new THREE.Mesh(
    tracker.trackGeometry(new THREE.SphereGeometry(150, 32, 24)),
    ctx.registerFadeMaterial(tracker.trackMaterial(new THREE.MeshBasicMaterial({
      map: createGradientCanvasTexture(tracker, 8, 1024, [
        [0.00, '#090214'],
        [0.12, '#1d0830'],
        [0.30, '#5e1d74'],
        [0.56, '#b23886'],
        [0.76, '#ff6793'],
        [0.90, '#ffb06e'],
        [1.00, '#ffe19a']
      ]),
      side: THREE.BackSide
    })))
  ));
  sky.frustumCulled = false;
  groups.skyGroup.add(sky);

  const baseFloor = tracker.trackObject(new THREE.Mesh(
    tracker.trackGeometry(new THREE.PlaneGeometry(160, 150)),
    tracker.trackMaterial(new THREE.MeshBasicMaterial({ color: 0x18071d }))
  ));
  baseFloor.rotation.x = -Math.PI / 2;
  baseFloor.position.z = -18;
  groups.terrainGroup.add(baseFloor);

  const sideLandGeometry = tracker.trackGeometry(new THREE.BoxGeometry(44, 1.0, 144));
  const sideLandMaterial = tracker.trackMaterial(new THREE.MeshBasicMaterial({ color: 0x0b0311 }));
  const leftLand = tracker.trackObject(new THREE.Mesh(sideLandGeometry, sideLandMaterial));
  leftLand.position.set(-46, 0.34, -22);
  leftLand.rotation.z = 0.04;
  const rightLand = tracker.trackObject(new THREE.Mesh(sideLandGeometry, sideLandMaterial));
  rightLand.position.set(46, 0.34, -22);
  rightLand.rotation.z = -0.04;
  groups.terrainGroup.add(leftLand, rightLand);

  const gridMaterial = ctx.registerFadeMaterial(tracker.trackMaterial(new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    uniforms: {
      uTime: { value: 0 },
      uGridA: { value: new THREE.Color('#ff2fa8') },
      uGridB: { value: new THREE.Color('#4cc7ff') },
      uFadeColor: { value: new THREE.Color('#18071d') }
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
      uniform vec3 uGridA;
      uniform vec3 uGridB;
      uniform vec3 uFadeColor;

      float gridLine(float value, float density, float thickness) {
        float line = abs(fract(value * density) - 0.5);
        return 1.0 - smoothstep(0.5 - thickness, 0.5 + thickness, line * 2.0);
      }

      void main() {
        float perspectiveDensity = mix(7.0, 48.0, 1.0 - vUv.y);
        float horizontal = gridLine(vUv.y, perspectiveDensity, 0.08);
        float vertical = gridLine(vUv.x, 12.0, 0.03);
        float centerMask = smoothstep(0.16, 0.36, abs(vUv.x - 0.5));
        float lines = max(horizontal, vertical * centerMask);
        float horizonGlow = smoothstep(0.18, 0.92, 1.0 - vUv.y);
        vec3 color = mix(uGridB, uGridA, 1.0 - vUv.y);
        color += uGridA * horizonGlow * 0.32;
        float alpha = lines * (0.26 + horizonGlow * 0.55);
        gl_FragColor = vec4(mix(uFadeColor, color, 0.95), alpha);
      }
    `
  })));
  const gridPlane = tracker.trackObject(new THREE.Mesh(
    tracker.trackGeometry(new THREE.PlaneGeometry(112, 130)),
    gridMaterial
  ));
  gridPlane.rotation.x = -Math.PI / 2;
  gridPlane.position.set(0, 0.04, -20);
  groups.terrainGroup.add(gridPlane);

  const waterMaterial = ctx.registerFadeMaterial(tracker.trackMaterial(new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    polygonOffset: true,
    polygonOffsetFactor: -2,
    polygonOffsetUnits: -4,
    uniforms: {
      uTime: { value: 0 },
      uSunColor: { value: new THREE.Color('#ffd87a') },
      uMagenta: { value: new THREE.Color('#ff4fa3') },
      uBlue: { value: new THREE.Color('#38bbff') }
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
      uniform vec3 uSunColor;
      uniform vec3 uMagenta;
      uniform vec3 uBlue;

      void main() {
        vec2 uv = vUv;
        float center = smoothstep(0.48, 0.06, abs(uv.x - 0.5));
        float ripples = 0.5 + 0.5 * sin(uv.y * 34.0 - uTime * 0.95 + uv.x * 9.0);
        float scan = 0.5 + 0.5 * sin(uv.y * 12.0 + uTime * 0.4);
        float horizon = smoothstep(0.12, 0.95, 1.0 - uv.y);
        float specular = pow(center, 1.8) * horizon * (0.45 + ripples * 0.55);
        vec3 color = mix(uBlue, uMagenta, scan * 0.35 + ripples * 0.25);
        color = mix(color, uSunColor, specular);
        float alpha = center * (0.34 + horizon * 0.42);
        gl_FragColor = vec4(color, alpha);
      }
    `
  })));
  const waterStrip = tracker.trackObject(new THREE.Mesh(
    tracker.trackGeometry(new THREE.PlaneGeometry(38, 126)),
    waterMaterial
  ));
  waterStrip.rotation.x = -Math.PI / 2;
  waterStrip.position.set(0, 0.06, -24);
  groups.terrainGroup.add(waterStrip);

  const sideGlowMaterial = ctx.registerFadeMaterial(tracker.trackMaterial(new THREE.MeshBasicMaterial({
    map: createGradientCanvasTexture(tracker, 8, 512, [
      [0.0, 'rgba(255,120,178,0.00)'],
      [0.25, 'rgba(255,90,160,0.18)'],
      [0.72, 'rgba(90,178,255,0.20)'],
      [1.0, 'rgba(44,120,255,0.00)']
    ]),
    transparent: true,
    opacity: 0.88,
    depthWrite: false
  })));
  const sideGlowLeft = tracker.trackObject(new THREE.Mesh(
    tracker.trackGeometry(new THREE.PlaneGeometry(5.5, 122)),
    sideGlowMaterial
  ));
  sideGlowLeft.rotation.x = -Math.PI / 2;
  sideGlowLeft.position.set(-19.8, 0.05, -22);
  const sideGlowRight = tracker.trackObject(sideGlowLeft.clone());
  sideGlowRight.material = sideGlowMaterial.clone();
  tracker.trackMaterial(sideGlowRight.material);
  sideGlowRight.position.x = 19.8;
  groups.terrainGroup.add(sideGlowLeft, sideGlowRight);

  const backMountains = tracker.trackObject(buildExtrudedProfileMesh([
    [-82, 10], [-66, 16], [-46, 14], [-26, 20], [-10, 16], [10, 20], [32, 28], [54, 18], [82, 14]
  ], -122, 0x41215a, tracker, { left: -84, right: 84, depth: 18 }));
  const middleMountains = tracker.trackObject(buildExtrudedProfileMesh([
    [-82, 8], [-62, 10], [-36, 13], [-10, 16], [6, 12], [30, 18], [48, 14], [62, 18], [82, 9]
  ], -108, 0x2d1343, tracker, { left: -84, right: 84, depth: 15 }));
  const frontMountains = tracker.trackObject(buildExtrudedProfileMesh([
    [-82, 8], [-68, 16], [-52, 11], [-34, 13], [-12, 5], [0, 4], [18, 8], [42, 14], [64, 18], [82, 12]
  ], -100, 0x200c31, tracker, { left: -84, right: 84, depth: 12 }));
  const leftShoulderMount = tracker.trackObject(buildExtrudedProfileMesh([
    [-38, 6], [-26, 10], [-12, 13], [2, 10], [18, 7], [34, 6], [38, 6]
  ], -62, 0x16071c, tracker, { left: -38, right: 38, depth: 14 }));
  leftShoulderMount.position.x = -54;
  leftShoulderMount.rotation.y = 0.18;
  const rightShoulderMount = tracker.trackObject(buildExtrudedProfileMesh([
    [-38, 6], [-18, 9], [-6, 14], [14, 11], [28, 7], [38, 6]
  ], -62, 0x16071c, tracker, { left: -38, right: 38, depth: 14 }));
  rightShoulderMount.position.x = 54;
  rightShoulderMount.rotation.y = -0.18;
  groups.landmarksGroup.add(backMountains, middleMountains, frontMountains, leftShoulderMount, rightShoulderMount);

  const horizonMistMaterial = ctx.registerFadeMaterial(tracker.trackMaterial(new THREE.MeshBasicMaterial({
    map: createGradientCanvasTexture(tracker, 8, 256, [
      [0.0, 'rgba(255,164,94,0.00)'],
      [0.22, 'rgba(255,130,102,0.18)'],
      [0.54, 'rgba(255,86,170,0.24)'],
      [0.82, 'rgba(109,56,190,0.12)'],
      [1.0, 'rgba(0,0,0,0.00)']
    ]),
    transparent: true,
    opacity: 0.92,
    depthWrite: false
  })));
  const horizonMist = tracker.trackObject(new THREE.Mesh(
    tracker.trackGeometry(new THREE.PlaneGeometry(150, 30)),
    horizonMistMaterial
  ));
  horizonMist.position.set(0, 12, -96);
  groups.fxGroup.add(horizonMist);

  const horizonLine = tracker.trackObject(new THREE.Mesh(
    tracker.trackGeometry(new THREE.PlaneGeometry(126, 1.4)),
    ctx.registerFadeMaterial(tracker.trackMaterial(new THREE.MeshBasicMaterial({
      color: 0xff4fa3,
      transparent: true,
      opacity: 0.94,
      depthWrite: false
    })))
  ));
  horizonLine.position.set(0, 1.1, -86);
  groups.fxGroup.add(horizonLine);

  const sunDisc = tracker.trackObject(new THREE.Mesh(
    tracker.trackGeometry(new THREE.PlaneGeometry(88, 88)),
    ctx.registerFadeMaterial(tracker.trackMaterial(new THREE.MeshBasicMaterial({
      map: createSynthSunTexture(tracker),
      transparent: true,
      depthWrite: false
    })))
  ));
  sunDisc.position.set(0, 20, -108);
  sunDisc.frustumCulled = false;
  groups.skyGroup.add(sunDisc);

  const sunGlow = tracker.trackObject(new THREE.Mesh(
    tracker.trackGeometry(new THREE.CircleGeometry(58, 40)),
    ctx.registerFadeMaterial(tracker.trackMaterial(new THREE.MeshBasicMaterial({
      color: 0xff8d4d,
      transparent: true,
      opacity: 0.34,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    })))
  ));
  sunGlow.position.set(0, 20, -110);
  sunGlow.frustumCulled = false;
  groups.skyGroup.add(sunGlow);

  const cloudBand = tracker.trackObject(new THREE.Mesh(
    tracker.trackGeometry(new THREE.PlaneGeometry(76, 18)),
    ctx.registerFadeMaterial(tracker.trackMaterial(new THREE.MeshBasicMaterial({
      map: createCloudBandTexture(tracker),
      transparent: true,
      opacity: 0.72,
      depthWrite: false
    })))
  ));
  cloudBand.position.set(0, 8.4, -98);
  groups.fxGroup.add(cloudBand);

  const sideCityGlow = tracker.trackObject(new THREE.Mesh(
    tracker.trackGeometry(new THREE.PlaneGeometry(110, 10)),
    ctx.registerFadeMaterial(tracker.trackMaterial(new THREE.MeshBasicMaterial({
      map: createGradientCanvasTexture(tracker, 8, 256, [
        [0.0, 'rgba(255,90,170,0.00)'],
        [0.25, 'rgba(255,90,170,0.18)'],
        [0.60, 'rgba(70,188,255,0.16)'],
        [1.0, 'rgba(70,188,255,0.00)']
      ]),
      transparent: true,
      opacity: 0.55,
      depthWrite: false
    })))
  ));
  sideCityGlow.position.set(0, 3.2, -84);
  groups.fxGroup.add(sideCityGlow);

  const starTexture = createGradientCanvasTexture(tracker, 8, 512, [
    [0.0, 'rgba(255,255,255,0.00)'],
    [1.0, 'rgba(255,255,255,1.00)']
  ]);
  const starMaterial = tracker.trackMaterial(new THREE.PointsMaterial({
    color: 0xffffff,
    size: 0.28,
    transparent: true,
    opacity: 0.65,
    depthWrite: false,
    map: starTexture
  }));
  const starPositions = new Float32Array(84 * 3);
  for (let i = 0; i < 84; i++) {
    const i3 = i * 3;
    starPositions[i3] = ctx.rng.range(-90, 90);
    starPositions[i3 + 1] = ctx.rng.range(28, 88);
    starPositions[i3 + 2] = ctx.rng.range(-130, -12);
  }
  const starGeometry = tracker.trackGeometry(new THREE.BufferGeometry());
  starGeometry.setAttribute('position', new THREE.BufferAttribute(starPositions, 3));
  const stars = tracker.trackObject(new THREE.Points(starGeometry, starMaterial));
  stars.frustumCulled = false;
  groups.fxGroup.add(stars);

  buildPalmRows(ctx, tracker, groups.propsGroup);

  const clearanceOverlay = createClearanceOverlay(tracker);
  groups.debugGroup.add(clearanceOverlay);

  return {
    root: groups.root,
    debug: { clearanceOverlay },
    fallbackActive: false,
    sceneOptions: {
      background: 0x0d0417,
      fog: new THREE.FogExp2(0x15061b, 0.0092),
      cameraStart: [0, 1.6, 2.5],
      cameraLookAt: [0, 1.8, -28],
      heroShot: createShot([0, 8.0, 46], [0, 12, -102], 44),
      gameplayShot: createShot([0, 1.6, 0], [0, 2.2, -38], 70)
    },
    update(_dt, elapsed) {
      gridMaterial.uniforms.uTime.value = elapsed;
      waterMaterial.uniforms.uTime.value = elapsed;
      horizonMist.material.opacity = 0.88 + Math.sin(elapsed * 0.14) * 0.04;
      horizonLine.material.opacity = 0.68 + Math.sin(elapsed * 0.22 + 0.8) * 0.04;
      sunGlow.material.opacity = 0.22 + Math.sin(elapsed * 0.32) * 0.03;
      cloudBand.material.opacity = 0.68 + Math.sin(elapsed * 0.1 + 1.2) * 0.04;
      sideCityGlow.material.opacity = 0.48 + Math.sin(elapsed * 0.2) * 0.05;
      starMaterial.opacity = 0.58 + Math.sin(elapsed * 0.18) * 0.05;
    },
    dispose() {}
  };
}

function buildPalmRows(ctx, tracker, parent) {
  const palmCountPerSide = 12;
  const transforms = [];
  for (let i = 0; i < palmCountPerSide; i++) {
    const z = -10 - i * 9.8;
    const scale = 0.92 + i * 0.05;
    transforms.push({
      position: [-28 - (i % 3) * 3.1, 5.2 * scale, z],
      rotation: [0, 0.12, -0.11],
      scale: [scale, scale, scale]
    });
    transforms.push({
      position: [28 + (i % 3) * 3.1, 5.2 * scale, z],
      rotation: [0, Math.PI, 0.11],
      scale: [scale, scale, scale]
    });
  }

  const trunkMesh = createInstancedMesh(
    new THREE.CylinderGeometry(0.24, 0.46, 11.4, 5),
    new THREE.MeshBasicMaterial({ color: 0x1c0a24 }),
    transforms,
    tracker
  );
  parent.add(trunkMesh);

  const frondGeometry = new THREE.PlaneGeometry(1.8, 10.6, 1, 1);
  const frondMaterial = new THREE.MeshBasicMaterial({
    color: 0x220b2d,
    side: THREE.DoubleSide,
    transparent: true,
    opacity: 0.98
  });
  const frondLayouts = [
    { yawOffset: 0.0, pitch: -1.24, roll: 0.38, x: 0.0, y: 10.0, z: 2.8 },
    { yawOffset: 0.82, pitch: -1.06, roll: -0.20, x: 1.9, y: 9.6, z: 1.2 },
    { yawOffset: -0.82, pitch: -1.06, roll: 0.20, x: -1.9, y: 9.6, z: 1.2 },
    { yawOffset: 1.76, pitch: -0.96, roll: -0.30, x: 2.0, y: 9.0, z: -1.4 },
    { yawOffset: -1.76, pitch: -0.96, roll: 0.30, x: -2.0, y: 9.0, z: -1.4 },
    { yawOffset: 2.6, pitch: -0.84, roll: -0.22, x: 0.9, y: 8.7, z: -2.8 },
    { yawOffset: -2.6, pitch: -0.84, roll: 0.22, x: -0.9, y: 8.7, z: -2.8 }
  ];
  const basePosition = new THREE.Vector3();
  const baseScale = new THREE.Vector3();
  const offset = new THREE.Vector3();
  const position = new THREE.Vector3();
  const scale = new THREE.Vector3();
  const quaternion = new THREE.Quaternion();
  const palmRotation = new THREE.Quaternion();
  const matrix = new THREE.Matrix4();

  frondLayouts.forEach((layout) => {
    const fronds = tracker.trackObject(new THREE.InstancedMesh(
      tracker.trackGeometry(frondGeometry),
      tracker.trackMaterial(frondMaterial.clone()),
      transforms.length
    ));
    for (let i = 0; i < transforms.length; i++) {
      const transform = transforms[i];
      basePosition.set(transform.position[0], transform.position[1], transform.position[2]);
      baseScale.set(transform.scale[0], transform.scale[1], transform.scale[2]);
      palmRotation.setFromEuler(new THREE.Euler(
        transform.rotation[0],
        transform.rotation[1],
        transform.rotation[2]
      ));
      offset.set(layout.x, layout.y, layout.z).multiply(baseScale).applyQuaternion(palmRotation);
      position.copy(basePosition).add(offset);
      quaternion.setFromEuler(new THREE.Euler(layout.pitch, transform.rotation[1] + layout.yawOffset, layout.roll));
      scale.set(baseScale.x, baseScale.y, baseScale.z);
      matrix.compose(position, quaternion, scale);
      fronds.setMatrixAt(i, matrix);
    }
    fronds.instanceMatrix.needsUpdate = true;
    parent.add(fronds);
  });
}

function createCloudBandTexture(tracker) {
  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = 256;
  const ctx2d = canvas.getContext('2d');
  ctx2d.clearRect(0, 0, canvas.width, canvas.height);
  const blobs = [
    [96, 154, 136, 44], [244, 132, 162, 54], [418, 138, 150, 48],
    [604, 124, 188, 58], [798, 134, 144, 44], [930, 150, 110, 34]
  ];
  blobs.forEach(([x, y, w, h]) => {
    const gradient = ctx2d.createRadialGradient(x, y, 10, x, y, w * 0.55);
    gradient.addColorStop(0.0, 'rgba(255,216,154,0.92)');
    gradient.addColorStop(0.45, 'rgba(255,120,152,0.42)');
    gradient.addColorStop(1.0, 'rgba(255,108,142,0.00)');
    ctx2d.fillStyle = gradient;
    ctx2d.beginPath();
    ctx2d.ellipse(x, y, w, h, 0, 0, Math.PI * 2);
    ctx2d.fill();
  });
  const texture = tracker.trackTexture(new THREE.CanvasTexture(canvas));
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function createSynthSunTexture(tracker) {
  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = 1024;
  const ctx2d = canvas.getContext('2d');
  ctx2d.clearRect(0, 0, canvas.width, canvas.height);

  const fill = ctx2d.createRadialGradient(512, 420, 60, 512, 520, 438);
  fill.addColorStop(0.0, '#fff5c8');
  fill.addColorStop(0.16, '#ffe88a');
  fill.addColorStop(0.40, '#ffb259');
  fill.addColorStop(0.68, '#ff6f7a');
  fill.addColorStop(1.0, '#d23176');
  ctx2d.fillStyle = fill;
  ctx2d.beginPath();
  ctx2d.arc(512, 520, 438, 0, Math.PI * 2);
  ctx2d.fill();

  ctx2d.fillStyle = 'rgba(255,255,255,0.16)';
  ctx2d.beginPath();
  ctx2d.arc(512, 466, 332, 0, Math.PI * 2);
  ctx2d.fill();

  ctx2d.globalCompositeOperation = 'destination-out';
  const cuts = [
    [526, 10], [562, 14], [602, 18], [648, 20], [698, 24], [754, 28], [816, 34], [886, 40]
  ];
  cuts.forEach(([y, height], index) => {
    const leftInset = index < 2 ? 94 : 60;
    const rightInset = index > 5 ? 96 : 58;
    ctx2d.fillRect(leftInset, y, 1024 - leftInset - rightInset, height);
  });

  ctx2d.globalCompositeOperation = 'source-over';
  ctx2d.strokeStyle = 'rgba(255,255,255,0.20)';
  ctx2d.lineWidth = 10;
  ctx2d.beginPath();
  ctx2d.arc(512, 520, 438, 0, Math.PI);
  ctx2d.stroke();
  const texture = tracker.trackTexture(new THREE.CanvasTexture(canvas));
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}
