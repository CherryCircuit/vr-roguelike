// ============================================================
//  BIOME: Hellscape Lava
//  Volcanic landscape with lava river, rocks, and flame pillars
//  Extracted from biome-scenes.js (restored version)
// ============================================================

import * as THREE from 'three';

export function buildHellscapeLavaScene(group, deps) {
  const { registerFadeMaterial, floorMaterial, biomeTerrainMaterials } = deps;
  const floorHeight = (floorMaterial && floorMaterial.userData && floorMaterial.userData.floorHeight) || -0.01;
  const floorY = floorHeight;  // Player stands on riverbanks at correct height
  const valleyWidth = 35.0;

  // ========================================
  // 1. LIGHTING (CRITICAL)
  // ========================================
  // Red moonlight with shadows
  const moonLight = new THREE.DirectionalLight(0xff3333, 2.5);
  moonLight.position.set(20, 30, -100);
  moonLight.castShadow = true;
  moonLight.shadow.mapSize.width = 2048;
  moonLight.shadow.mapSize.height = 2048;
  moonLight.shadow.camera.near = 0.5;
  moonLight.shadow.camera.far = 500;
  moonLight.shadow.camera.left = -100;
  moonLight.shadow.camera.right = 100;
  moonLight.shadow.camera.top = 100;
  moonLight.shadow.camera.bottom = -100;
  group.add(moonLight);

  // Very dim ambient
  const ambientLight = new THREE.AmbientLight(0x220505, 0.1);
  group.add(ambientLight);

  // Lava glow point light (will animate)
  const lavaGlow = new THREE.PointLight(0xff3300, 2.5, 60);
  lavaGlow.position.set(0, 5, 0);
  group.add(lavaGlow);

  // ========================================
  // TERRAIN (existing logic)
  // ========================================
  // OPTIMIZED: Reduced from 200x200 (40,401 verts) to 100x100 (10,201 verts)
  // Visual impact: Slightly less smooth terrain, but acceptable for hellscape
  const geometry = new THREE.PlaneGeometry(300, 300, 100, 100);
  geometry.rotateX(-Math.PI / 2);
  const positions = geometry.attributes.position;
  for (let i = 0; i < positions.count; i++) {
    const x = positions.getX(i);
    const z = positions.getZ(i);
    const riverX = Math.sin(z * 0.03) * 15.0;
    const distToRiver = Math.abs(x - riverX);
    const riverWidth = 5.0;
    const distFromCenter = Math.abs(x);
    let height = 0;
    const valleyFloorHeight = 0.0;  // Fixed: was 1.5, causing camera to appear below ground
    if (distFromCenter > valleyWidth) {
      const mountainFactor = (distFromCenter - valleyWidth) / 15.0;
      let mHeight = 0;
      mHeight += Math.abs(Math.sin(x * 0.05) * Math.cos(z * 0.04)) * 15.0;
      mHeight += Math.abs(Math.sin(z * 0.08 + 1.0)) * 10.0;
      mHeight += Math.abs(Math.cos(x * 0.12 - z * 0.08)) * 6.0;
      mHeight += (Math.random() * 3.0);
      height = valleyFloorHeight + mHeight * Math.min(mountainFactor, 1.0);
    } else {
      height = valleyFloorHeight;
      height += (Math.sin(x * 0.5) * Math.cos(z * 0.5)) * 0.3;
      if (distToRiver < riverWidth) {
        height = -1.0;
      } else if (distToRiver < riverWidth + 3.0) {
        height = Math.min(height, valleyFloorHeight - (riverWidth + 3.0 - distToRiver) * 0.5);
      }
    }
    positions.setY(i, height);
  }
  geometry.computeVertexNormals();

  const material = new THREE.MeshStandardMaterial({
    color: 0x110505,
    roughness: 0.9,
    metalness: 0.1,
    flatShading: true,
    onBeforeCompile: (shader) => {
      shader.uniforms.uTime = { value: 0 };
      shader.vertexShader = shader.vertexShader.replace('#include <common>', `#include <common>
varying vec3 vPosition; varying float vElevation; uniform float uTime;`);
      shader.vertexShader = shader.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
vPosition = position; vElevation = position.y;`);
      shader.fragmentShader = shader.fragmentShader.replace('#include <common>', `#include <common>
varying vec3 vPosition; varying float vElevation; uniform float uTime;`);
      shader.fragmentShader = shader.fragmentShader.replace('#include <emissive_fragment>', `float lavaThreshold = 0.5; if (vElevation < lavaThreshold) { } else { float distToLava = vElevation - lavaThreshold; float glowReflection = smoothstep(5.0, 0.0, distToLava); float pulse = sin(uTime * 0.8 + vPosition.x * 0.5 + vPosition.z * 0.5) * 0.5 + 0.5; totalEmissiveRadiance = vec3(0.6, 0.1, 0.0) * glowReflection * pulse; } #include <emissive_fragment>`);
      shader.fragmentShader = shader.fragmentShader.replace('#include <output_fragment>', `float lavaThreshold = 0.5; if (vElevation < lavaThreshold) { vec3 lavaColorBase = vec3(1.0, 0.05, 0.05); vec3 lavaColorBright = vec3(1.0, 0.25, 0.2); float pulse = sin(uTime * 0.8 + vPosition.x * 0.5 + vPosition.z * 0.5) * 0.5 + 0.5; float glow = 0.7 + 0.3 * pulse; vec3 finalLavaColor = mix(lavaColorBase, lavaColorBright, glow); gl_FragColor = vec4(finalLavaColor, 0.9); } else { gl_FragColor = vec4( outgoingLight, diffuseColor.a ); }`);
      material.userData.shader = shader;
    }
  });

  const terrain = new THREE.Mesh(geometry, material);
  terrain.receiveShadow = true;
  terrain.position.y = floorY;
  terrain.position.x = -10.0;  // Shift terrain left so player spawns on riverbank (not riverbed)
  terrain.position.z = 0.0;  // Player on flat valley floor
  group.add(terrain);

  // Flash overlay plane for damage feedback
  const flashGeo = new THREE.PlaneGeometry(300, 300);
  const flashMat = new THREE.MeshBasicMaterial({
    color: 0xff0000,
    transparent: true,
    opacity: 0,
    depthWrite: false,
    side: THREE.DoubleSide
  });
  const flashPlane = new THREE.Mesh(flashGeo, flashMat);
  flashPlane.rotation.x = -Math.PI / 2;
  flashPlane.position.y = floorY + 0.05;
  flashPlane.frustumCulled = false;
  group.add(flashPlane);
  biomeTerrainMaterials.push({ type: 'overlay', material: flashMat });

  // ========================================
  // 2. JAGGED ROCKS (50 scattered)
  // ========================================
  const rockGeo = new THREE.TetrahedronGeometry(1, 0);
  const rockMat = new THREE.MeshStandardMaterial({
    color: 0x1a1a1a,
    roughness: 0.8,
    metalness: 0.2,
    flatShading: true
  });

  for (let i = 0; i < 50; i++) {
    const rock = new THREE.Mesh(rockGeo, rockMat);
    let x, z, riverX, distToRiver;
    let attempts = 0;
    do {
      x = (Math.random() - 0.5) * 60;
      z = (Math.random() - 0.5) * 100;
      riverX = Math.sin(z * 0.03) * 15.0;
      distToRiver = Math.abs(x - riverX);
      attempts++;
    } while (distToRiver < 8 && attempts < 20);

    rock.position.set(x, floorY + 0.5, z);
    // Scale: taller than wide (0.5-4.0)
    const scaleY = 0.5 + Math.random() * 3.5;
    const scaleX = 0.5 + Math.random() * 1.5;
    rock.scale.set(scaleX, scaleY, scaleX);
    rock.rotation.set(
      Math.random() * Math.PI,
      Math.random() * Math.PI * 2,
      Math.random() * Math.PI
    );
    rock.castShadow = true;
    rock.receiveShadow = true;
    group.add(rock);
  }

  // ========================================
  // 3. DEAD TREES (20 procedural, simplified)
  // OPTIMIZED: Replaced recursive depth-3 trees (15-40 meshes each)
  // with 2 simpler procedural variants (2-3 meshes each).
  // Original: ~375-1000 cylinders, New: ~40-60 cylinders
  // Visual tradeoff: Less complex branching, but maintains hellscape vibe
  // ========================================
  const treeMat = new THREE.MeshStandardMaterial({
    color: 0x0a0a0a,
    roughness: 0.9,
    metalness: 0.1,
    flatShading: true
  });

  // Shared geometries for dead trees (reduce GPU memory)
  const trunkGeo = new THREE.CylinderGeometry(0.12, 0.18, 4, 5); // Main trunk
  const branchGeo = new THREE.CylinderGeometry(0.06, 0.1, 2, 5); // Branch

  // Variant A: Forked dead tree (trunk + 2 branches)
  const createForkedTree = () => {
    const group = new THREE.Group();
    const trunk = new THREE.Mesh(trunkGeo, treeMat);
    trunk.position.y = 2;
    trunk.castShadow = true;
    trunk.receiveShadow = true;
    group.add(trunk);

    // Two main branches
    for (let i = 0; i < 2; i++) {
      const branch = new THREE.Mesh(branchGeo, treeMat);
      branch.position.y = 3.5 + Math.random() * 0.5;
      branch.rotation.z = (i === 0 ? 1 : -1) * (0.4 + Math.random() * 0.4);
      branch.rotation.y = i * Math.PI + Math.random() * 0.5;
      branch.castShadow = true;
      group.add(branch);
    }
    return group;
  };

  // Variant B: Twisted snag (single bent trunk, optional small branch)
  const createTwistedSnag = () => {
    const group = new THREE.Group();
    const trunk = new THREE.Mesh(trunkGeo, treeMat);
    trunk.position.y = 2;
    trunk.rotation.z = (Math.random() - 0.5) * 0.3; // Slight lean
    trunk.castShadow = true;
    trunk.receiveShadow = true;
    group.add(trunk);

    // Optional small branch
    if (Math.random() > 0.5) {
      const branch = new THREE.Mesh(branchGeo, treeMat);
      branch.position.y = 2.5 + Math.random();
      branch.rotation.z = (Math.random() > 0.5 ? 1 : -1) * (0.6 + Math.random() * 0.4);
      branch.rotation.y = Math.random() * Math.PI * 2;
      branch.scale.setScalar(0.7); // Smaller branch
      branch.castShadow = true;
      group.add(branch);
    }
    return group;
  };

  // Spawn 20 trees (reduced from 25), mixed variants
  for (let i = 0; i < 20; i++) {
    let x, z, riverX, distToRiver;
    let attempts = 0;
    do {
      x = (Math.random() - 0.5) * 60;
      z = (Math.random() - 0.5) * 100;
      riverX = Math.sin(z * 0.03) * 15.0;
      distToRiver = Math.abs(x - riverX);
      attempts++;
    } while (distToRiver < 8 && attempts < 20);

    const tree = Math.random() > 0.5 ? createForkedTree() : createTwistedSnag();
    tree.position.set(x, floorY, z);
    tree.rotation.y = Math.random() * Math.PI * 2;
    const treeScale = 0.8 + Math.random() * 0.6;
    tree.scale.setScalar(treeScale);
    group.add(tree);
  }

  // ========================================
  // 4. TWINKLING STARS (1500 particles with red tint)
  // ========================================
  const starCount = 1500;
  const starPositions = new Float32Array(starCount * 3);
  const starColors = new Float32Array(starCount * 3);
  const starSizes = new Float32Array(starCount);
  const starPhases = new Float32Array(starCount);

  for (let i = 0; i < starCount; i++) {
    const i3 = i * 3;
    // Position in a dome
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.random() * Math.PI * 0.5; // Upper hemisphere
    const r = 120 + Math.random() * 80;
    starPositions[i3] = r * Math.sin(phi) * Math.cos(theta);
    starPositions[i3 + 1] = r * Math.cos(phi) + 20;
    starPositions[i3 + 2] = r * Math.sin(phi) * Math.sin(theta);

    // Red-tinted colors: mix between (0.6, 0.2, 0.2) and (1.0, 0.8, 0.8)
    const colorMix = Math.random();
    starColors[i3] = 0.6 + colorMix * 0.4;     // R
    starColors[i3 + 1] = 0.2 + colorMix * 0.6; // G
    starColors[i3 + 2] = 0.2 + colorMix * 0.6; // B

    starSizes[i] = 0.5 + Math.random() * 1.5;
    starPhases[i] = Math.random() * Math.PI * 2;
  }

  const starGeo = new THREE.BufferGeometry();
  starGeo.setAttribute('position', new THREE.BufferAttribute(starPositions, 3));
  starGeo.setAttribute('aColor', new THREE.BufferAttribute(starColors, 3));
  starGeo.setAttribute('aSize', new THREE.BufferAttribute(starSizes, 1));
  starGeo.setAttribute('aPhase', new THREE.BufferAttribute(starPhases, 1));

  const starMat = new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 }
    },
    vertexShader: `
      attribute vec3 aColor;
      attribute float aSize;
      attribute float aPhase;
      varying vec3 vColor;
      varying float vTwinkle;
      uniform float uTime;
      void main() {
        vColor = aColor;
        vTwinkle = 0.5 + 0.5 * sin(uTime * 2.0 + aPhase);
        vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
        gl_PointSize = aSize * (300.0 / -mvPosition.z) * vTwinkle;
        gl_Position = projectionMatrix * mvPosition;
      }
    `,
    fragmentShader: `
      varying vec3 vColor;
      varying float vTwinkle;
      void main() {
        float dist = length(gl_PointCoord - vec2(0.5));
        if (dist > 0.5) discard;
        float alpha = 1.0 - smoothstep(0.0, 0.5, dist);
        gl_FragColor = vec4(vColor * vTwinkle, alpha);
      }
    `,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending
  });

  const stars = new THREE.Points(starGeo, starMat);
  group.add(stars);

  // ========================================
  // 5. SPARK PARTICLES (150 rising from lava - optimized from 200)
  // ========================================
  const sparkCount = 150;
  const sparkPositions = new Float32Array(sparkCount * 3);
  const sparkVelocities = new Float32Array(sparkCount * 3);
  const sparkLifetimes = new Float32Array(sparkCount);
  const sparkMaxLifetimes = new Float32Array(sparkCount);

  const initSpark = (idx) => {
    const i3 = idx * 3;
    const z = (Math.random() - 0.5) * 100;
    const riverX = Math.sin(z * 0.03) * 15.0 + 10.0;  // Account for terrain X shift
    sparkPositions[i3] = riverX + (Math.random() - 0.5) * 4;
    sparkPositions[i3 + 1] = floorY - 0.5 + Math.random() * 0.5;  // Account for terrain Y offset
    sparkPositions[i3 + 2] = z;
    sparkVelocities[i3] = (Math.random() - 0.5) * 0.02;
    sparkVelocities[i3 + 1] = 0.03 + Math.random() * 0.05;
    sparkVelocities[i3 + 2] = (Math.random() - 0.5) * 0.02;
    sparkLifetimes[idx] = 0;
    sparkMaxLifetimes[idx] = 2 + Math.random() * 3;
  };

  for (let i = 0; i < sparkCount; i++) {
    initSpark(i);
    sparkLifetimes[i] = Math.random() * sparkMaxLifetimes[i]; // Stagger initial lifetimes
  }

  const sparkGeo = new THREE.BufferGeometry();
  sparkGeo.setAttribute('position', new THREE.BufferAttribute(sparkPositions, 3));

  const sparkMat = new THREE.PointsMaterial({
    color: 0xffaa00,
    size: 0.3,
    transparent: true,
    opacity: 0.8,
    blending: THREE.AdditiveBlending,
    depthWrite: false
  });

  const sparks = new THREE.Points(sparkGeo, sparkMat);
  group.add(sparks);

  // ========================================
  // 5b. ASH PARTICLES (dark floating - optimized from 260)
  // ========================================
  const ashCount = 200;
  const ashPositions = new Float32Array(ashCount * 3);
  const ashVelocities = new Float32Array(ashCount * 3);
  for (let i = 0; i < ashCount; i++) {
    const i3 = i * 3;
    ashPositions[i3] = (Math.random() - 0.5) * 80;
    ashPositions[i3 + 1] = 1 + Math.random() * 10;
    ashPositions[i3 + 2] = (Math.random() - 0.5) * 80;
    ashVelocities[i3] = (Math.random() - 0.5) * 0.02;
    ashVelocities[i3 + 1] = 0.01 + Math.random() * 0.015;
    ashVelocities[i3 + 2] = (Math.random() - 0.5) * 0.02;
  }
  const ashGeo = new THREE.BufferGeometry();
  ashGeo.setAttribute('position', new THREE.BufferAttribute(ashPositions, 3));
  const ashMat = new THREE.PointsMaterial({
    color: 0x2b2b2b,
    size: 0.06,  // Smaller than alien particles (0.0875)
    transparent: true,
    opacity: 0.5,
    depthWrite: false
  });
  const ash = new THREE.Points(ashGeo, ashMat);
  group.add(ash);

  // ========================================
  // 6. FLAME GEYSERS (periodic eruptions)
  // ========================================
  const geyserParticles = [];
  let lastGeyserTime = 0;
  const geyserInterval = 5000; // 5 seconds

  const createGeyserBurst = (now) => {
    const particleCount = 100;
    // Spawn from mountainsides (outside valleyWidth), accounting for terrain X shift
    const side = Math.random() > 0.5 ? 1 : -1;
    const x = side * (valleyWidth + 5 + Math.random() * 20) + 10.0;  // Account for terrain X shift
    const z = (Math.random() - 0.5) * 80;
    const baseY = floorY + 5;

    for (let i = 0; i < particleCount; i++) {
      geyserParticles.push({
        x: x + (Math.random() - 0.5) * 2,
        y: baseY,
        z: z + (Math.random() - 0.5) * 2,
        vx: (Math.random() - 0.5) * 0.1,
        vy: 0.8 + Math.random() * 0.5, // Strong upward velocity
        vz: (Math.random() - 0.5) * 0.1,
        life: 0,
        maxLife: 1.5 + Math.random() * 1.5
      });
    }
  };

  const geyserGeo = new THREE.BufferGeometry();
  const geyserPositions = new Float32Array(350 * 3); // Max 350 particles (optimized from 500)
  geyserGeo.setAttribute('position', new THREE.BufferAttribute(geyserPositions, 3));
  geyserGeo.setDrawRange(0, 0);

  const geyserMat = new THREE.PointsMaterial({
    color: 0xff6600,
    size: 0.4,
    transparent: true,
    opacity: 0.9,
    blending: THREE.AdditiveBlending,
    depthWrite: false
  });

  const geyserPoints = new THREE.Points(geyserGeo, geyserMat);
  group.add(geyserPoints);

  // ========================================
  // 7. FLAME PILLARS (distant fire columns)
  // ========================================
  const PILLAR_COUNT = 7;
  const PARTICLES_PER_PILLAR = 28;
  const TOTAL_FLAME_PILLAR_PARTICLES = PILLAR_COUNT * PARTICLES_PER_PILLAR;

  // Canvas-drawn flame sprite texture (64x64, soft radial gradient)
  const flameCanvas = document.createElement('canvas');
  flameCanvas.width = 64;
  flameCanvas.height = 64;
  const fCtx = flameCanvas.getContext('2d');
  const flameGrad = fCtx.createRadialGradient(32, 32, 0, 32, 32, 32);
  flameGrad.addColorStop(0, 'rgba(255,255,200,1.0)');
  flameGrad.addColorStop(0.2, 'rgba(255,200,50,0.9)');
  flameGrad.addColorStop(0.5, 'rgba(255,100,0,0.6)');
  flameGrad.addColorStop(0.8, 'rgba(200,30,0,0.2)');
  flameGrad.addColorStop(1, 'rgba(100,0,0,0.0)');
  fCtx.fillStyle = flameGrad;
  fCtx.fillRect(0, 0, 64, 64);
  const flameTexture = new THREE.CanvasTexture(flameCanvas);

  // Pillar positions: spread around the arena at 30-70 units distance
  const pillarDefs = [];
  for (let i = 0; i < PILLAR_COUNT; i++) {
    const angle = (i / PILLAR_COUNT) * Math.PI * 2 + (Math.random() - 0.5) * 0.6;
    const dist = 35 + Math.random() * 40; // 35-75 units away
    pillarDefs.push({
      x: Math.cos(angle) * dist + 10.0, // Account for terrain X shift
      z: Math.sin(angle) * dist,
      height: 12 + Math.random() * 10, // Pillar height 12-22 units
      radius: 1.5 + Math.random() * 1.5, // Base radius 1.5-3 units
      speed: 0.6 + Math.random() * 0.4 // Rise speed multiplier
    });
  }

  // Particle arrays
  const flamePositions = new Float32Array(TOTAL_FLAME_PILLAR_PARTICLES * 3);
  const flameSizes = new Float32Array(TOTAL_FLAME_PILLAR_PARTICLES);
  const flameParticleData = []; // Per-particle: { pillarIdx, t (0-1 life progress) }

  const initFlameParticle = (idx) => {
    const pillarIdx = idx % PILLAR_COUNT;
    const pillar = pillarDefs[pillarIdx];
    const i3 = idx * 3;
    const angle = Math.random() * Math.PI * 2;
    const r = Math.random() * pillar.radius;
    const t = Math.random(); // Start at random height for stagger

    flamePositions[i3] = pillar.x + Math.cos(angle) * r;
    flamePositions[i3 + 1] = floorY + t * pillar.height;
    flamePositions[i3 + 2] = pillar.z + Math.sin(angle) * r;
    flameSizes[idx] = 1.0 + (1.0 - t) * 2.0; // Larger at base, smaller at top

    if (!flameParticleData[idx]) {
      flameParticleData[idx] = { pillarIdx, speed: 0.3 + Math.random() * 0.3 };
    }
    flameParticleData[idx].t = t;
    flameParticleData[idx].pillarIdx = pillarIdx;
  };

  for (let i = 0; i < TOTAL_FLAME_PILLAR_PARTICLES; i++) {
    initFlameParticle(i);
  }

  const flamePillarGeo = new THREE.BufferGeometry();
  flamePillarGeo.setAttribute('position', new THREE.BufferAttribute(flamePositions, 3));
  flamePillarGeo.setAttribute('aSize', new THREE.BufferAttribute(flameSizes, 1));

  // Use ShaderMaterial for per-particle size with sizeAttenuation
  const flamePillarMat = new THREE.ShaderMaterial({
    uniforms: {
      uTexture: { value: flameTexture },
      uPixelRatio: { value: Math.min(window.devicePixelRatio, 2) }
    },
    vertexShader: `
      attribute float aSize;
      varying float vAlpha;
      uniform float uPixelRatio;
      void main() {
        vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
        gl_PointSize = aSize * uPixelRatio * (200.0 / -mvPosition.z);
        gl_PointSize = clamp(gl_PointSize, 1.0, 64.0);
        gl_Position = projectionMatrix * mvPosition;
        // Fade particles that are very high (near top of pillar)
        vAlpha = aSize / 3.0;
      }
    `,
    fragmentShader: `
      uniform sampler2D uTexture;
      varying float vAlpha;
      void main() {
        vec4 texColor = texture2D(uTexture, gl_PointCoord);
        gl_FragColor = vec4(texColor.rgb, texColor.a * vAlpha);
      }
    `,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending
  });

  const flamePillarPoints = new THREE.Points(flamePillarGeo, flamePillarMat);
  group.add(flamePillarPoints);

  // ========================================
  // MOONS (existing)
  // ========================================
  const createMoon = (size, color, glowColor) => {
    const mGroup = new THREE.Group();
    const moonGeo = new THREE.IcosahedronGeometry(size, 2);
    const moonMat = new THREE.MeshBasicMaterial({ color });
    mGroup.add(new THREE.Mesh(moonGeo, moonMat));
    const glowGeo = new THREE.IcosahedronGeometry(size * 1.2, 2);
    const glowMat = new THREE.MeshBasicMaterial({ color: glowColor, transparent: true, opacity: 0.3 });
    mGroup.add(new THREE.Mesh(glowGeo, glowMat));
    const farGlowGeo = new THREE.IcosahedronGeometry(size * 1.5, 2);
    const farGlowMat = new THREE.MeshBasicMaterial({ color: glowColor, transparent: true, opacity: 0.1 });
    mGroup.add(new THREE.Mesh(farGlowGeo, farGlowMat));
    return mGroup;
  };
  const moon1 = createMoon(10.5, 0xaa1111, 0xff2200);
  moon1.position.set(20, 25, -100);
  group.add(moon1);
  const moon2 = createMoon(7.5, 0x880000, 0xaa0000);
  moon2.position.set(-40, 20, -90);
  group.add(moon2);
  const moon3 = createMoon(5.4, 0x550000, 0x770000);
  moon3.position.set(-20, 35, -95);
  group.add(moon3);

  // ========================================
  // ANIMATION UPDATE
  // ========================================
  group.userData.update = (now, dt) => {
    const time = now * 0.001;

    // Terrain shader
    if (material.userData.shader) {
      material.userData.shader.uniforms.uTime.value = time;
    }

    // Star twinkle
    starMat.uniforms.uTime.value = time;

    // Lava glow position animation (circle)
    lavaGlow.position.x = Math.sin(time * 0.3) * 15;
    lavaGlow.position.z = Math.cos(time * 0.3) * 20;
    lavaGlow.position.y = 5 + Math.sin(time * 0.5) * 2;

    // Lava glow intensity pulse
    lavaGlow.intensity = 2.0 + Math.sin(time * 2) * 0.5;

    // Update spark particles - continuously spawn from lava river
    const sparkPos = sparkGeo.attributes.position.array;

    // Continuously spawn 8-12 new sparks each frame from random positions along the river
    // (optimized spawn rate for performance)
    const sparksToSpawn = 8 + Math.floor(Math.random() * 5);  // Was 6 + Math.floor(Math.random() * 4)
    for (let s = 0; s < sparksToSpawn; s++) {
      const randomIdx = Math.floor(Math.random() * sparkCount);
      // Only respawn if lifetime is mostly elapsed or just starting fresh
      if (sparkLifetimes[randomIdx] > sparkMaxLifetimes[randomIdx] * 0.8) {
        initSpark(randomIdx);
      }
    }

    for (let i = 0; i < sparkCount; i++) {
      const i3 = i * 3;
      sparkLifetimes[i] += dt * 0.001;

      if (sparkLifetimes[i] > sparkMaxLifetimes[i]) {
        initSpark(i);
      } else {
        sparkPos[i3] += sparkVelocities[i3];
        sparkPos[i3 + 1] += sparkVelocities[i3 + 1];
        sparkPos[i3 + 2] += sparkVelocities[i3 + 2];
      }
    }
    sparkGeo.attributes.position.needsUpdate = true;

    // Ash drift
    const ashPos = ashGeo.attributes.position.array;
    for (let i = 0; i < ashCount; i++) {
      const i3 = i * 3;
      ashPos[i3] += ashVelocities[i3] * dt * 0.6;
      ashPos[i3 + 1] += ashVelocities[i3 + 1] * dt * 0.6;
      ashPos[i3 + 2] += ashVelocities[i3 + 2] * dt * 0.6;
      if (ashPos[i3 + 1] > 12) ashPos[i3 + 1] = 1;
      if (ashPos[i3] > 40) ashPos[i3] = -40;
      if (ashPos[i3] < -40) ashPos[i3] = 40;
      if (ashPos[i3 + 2] > 40) ashPos[i3 + 2] = -40;
      if (ashPos[i3 + 2] < -40) ashPos[i3 + 2] = 40;
    }
    ashGeo.attributes.position.needsUpdate = true;

    // Geyser trigger and update
    if (now - lastGeyserTime > geyserInterval) {
      createGeyserBurst(now);
      lastGeyserTime = now;
    }

    // Update geyser particles
    const geyserPos = geyserGeo.attributes.position.array;
    let activeCount = 0;
    for (let i = geyserParticles.length - 1; i >= 0; i--) {
      const p = geyserParticles[i];
      p.life += dt * 0.001;

      if (p.life > p.maxLife) {
        geyserParticles.splice(i, 1);
        continue;
      }

      p.x += p.vx;
      p.y += p.vy;
      p.z += p.vz;
      p.vy -= 0.03; // Gravity

      const idx = activeCount * 3;
      geyserPos[idx] = p.x;
      geyserPos[idx + 1] = p.y;
      geyserPos[idx + 2] = p.z;
      activeCount++;
    }
    geyserGeo.setDrawRange(0, activeCount);
    geyserGeo.attributes.position.needsUpdate = true;

    // Flame pillar animation
    const fpPos = flamePillarGeo.attributes.position.array;
    const fpSizes = flamePillarGeo.attributes.aSize.array;
    for (let i = 0; i < TOTAL_FLAME_PILLAR_PARTICLES; i++) {
      const pd = flameParticleData[i];
      const pillar = pillarDefs[pd.pillarIdx];
      const i3 = i * 3;
      const dtSec = dt * 0.001;

      // Advance particle up the pillar
      pd.t += dtSec * pd.speed * pillar.speed / pillar.height;

      if (pd.t >= 1.0) {
        // Respawn at base
        initFlameParticle(i);
      } else {
        // Slight horizontal drift as particle rises
        const drift = (Math.random() - 0.5) * 0.05;
        fpPos[i3] += drift;
        fpPos[i3 + 1] += pd.speed * dtSec * pillar.speed;
        fpPos[i3 + 2] += drift;

        // Shrink as particle rises
        fpSizes[i] = Math.max(0.3, (1.0 - pd.t) * 3.0);
      }
    }
    flamePillarGeo.attributes.position.needsUpdate = true;
    flamePillarGeo.attributes.aSize.needsUpdate = true;
  };

  // Hellscape floor HUD height: group.position.y = 0.05
  group.position.set(26.599, 0.05, -0.486);
  group.rotation.y = 0.248; // yaw: 14.21°
}


