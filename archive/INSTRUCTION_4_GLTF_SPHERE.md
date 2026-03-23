# INSTRUCTION SET 4: Rotating glTF Sphere Environment

## Overview
Load a glTF 3D model as a large sphere that constantly rotates around the player, creating a beautiful skybox effect. The camera stays at the center of the sphere.

## User's Vision
From the inspiration scenes: "camera is locked to the center of a sphere that is constantly rotating... Beautiful effect."

## Implementation Steps

### Step 1: Add GLTFLoader Import

In `main.js`, add the GLTFLoader import:

```javascript
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
```

### Step 2: Create Sphere Container

Add at top level of `main.js`:

```javascript
let environmentSphere = null;
const SPHERE_RADIUS = 50;  // Large enough to encompass play area
const SPHERE_ROTATION_SPEED = 0.0005;  // Slow rotation (radians per frame)
```

### Step 3: Load glTF Model

Create function to load and setup the sphere:

```javascript
function loadEnvironmentSphere() {
  const loader = new GLTFLoader();

  // Load the glTF model (replace with actual path)
  loader.load(
    '/path/to/your/model.gltf',  // TODO: Replace with actual model path
    (gltf) => {
      console.log('Environment sphere loaded');

      // Create a large sphere to hold the model
      const sphereGeo = new THREE.SphereGeometry(SPHERE_RADIUS, 64, 64);
      // Invert faces so we see the inside
      sphereGeo.scale(-1, 1, 1);

      // Option A: Use the loaded model's material
      const material = gltf.scene.children[0]?.material || new THREE.MeshBasicMaterial({
        color: 0x220044,
        wireframe: false,
        side: THREE.BackSide
      });

      environmentSphere = new THREE.Mesh(sphereGeo, material);
      environmentSphere.position.set(0, 0, 0);  // Center at world origin
      scene.add(environmentSphere);

      // Option B: Apply loaded model as texture
      // (If the glTF contains a texture map, extract and apply it)
      if (gltf.scene.children[0]?.material?.map) {
        const texture = gltf.scene.children[0].material.map;
        environmentSphere.material = new THREE.MeshBasicMaterial({
          map: texture,
          side: THREE.BackSide
        });
      }

      console.log('Environment sphere added to scene');
    },
    (progress) => {
      console.log('Loading:', (progress.loaded / progress.total * 100).toFixed(0) + '%');
    },
    (error) => {
      console.error('Error loading environment sphere:', error);

      // Fallback: Create basic gradient sphere
      createFallbackSphere();
    }
  );
}

function createFallbackSphere() {
  console.log('Using fallback procedural sphere');

  const sphereGeo = new THREE.SphereGeometry(SPHERE_RADIUS, 64, 64);
  sphereGeo.scale(-1, 1, 1);  // Invert to see inside

  // Create gradient material (synthwave colors)
  const material = new THREE.ShaderMaterial({
    uniforms: {
      color1: { value: new THREE.Color(0x0a0015) },  // Dark purple
      color2: { value: new THREE.Color(0x220044) },  // Purple
      color3: { value: new THREE.Color(0x8800ff) }   // Bright purple
    },
    vertexShader: `
      varying vec3 vPosition;
      void main() {
        vPosition = position;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform vec3 color1;
      uniform vec3 color2;
      uniform vec3 color3;
      varying vec3 vPosition;
      void main() {
        float y = normalize(vPosition).y;
        vec3 color;
        if (y > 0.0) {
          color = mix(color2, color3, y);
        } else {
          color = mix(color2, color1, -y);
        }
        gl_FragColor = vec4(color, 1.0);
      }
    `,
    side: THREE.BackSide
  });

  environmentSphere = new THREE.Mesh(sphereGeo, material);
  scene.add(environmentSphere);
}
```

### Step 4: Initialize Sphere in Setup

In `init()`, after scene creation:

```javascript
function init() {
  // ... existing scene setup ...

  // Load environment sphere
  loadEnvironmentSphere();

  // ... rest of init ...
}
```

### Step 5: Rotate Sphere in Animation Loop

In `animate()`, rotate the sphere continuously:

```javascript
function animate() {
  // ... existing code ...

  // Rotate environment sphere
  if (environmentSphere) {
    environmentSphere.rotation.y += SPHERE_ROTATION_SPEED;

    // Optional: Lock camera to sphere center
    // (Camera position can move, but sphere always centers on player)
    environmentSphere.position.copy(camera.position);
    environmentSphere.position.y = 0;  // Keep sphere grounded, or copy camera.position.y
  }

  // ... rest of animate ...
}
```

### Step 6: Alternative - Rotate Camera Instead

If you want the camera locked at center and the sphere actually rotates:

```javascript
function animate() {
  // Rotate the entire sphere around the world origin
  if (environmentSphere) {
    environmentSphere.rotation.y += SPHERE_ROTATION_SPEED;
    // Optionally add slight x-axis rotation for more dynamic effect
    environmentSphere.rotation.x += SPHERE_ROTATION_SPEED * 0.3;
  }

  // Keep camera at center (or in play area)
  // Don't update camera position to follow sphere

  // ... rest of animate ...
}
```

### Step 7: Performance Optimization

Since this is a large sphere, optimize it:

```javascript
function loadEnvironmentSphere() {
  // ... after creating sphere ...

  // Optimize: Sphere doesn't need to cast or receive shadows
  environmentSphere.castShadow = false;
  environmentSphere.receiveShadow = false;

  // Optimize: Use lower poly count if FPS drops
  // const sphereGeo = new THREE.SphereGeometry(SPHERE_RADIUS, 32, 32);  // Lower detail

  // Optimize: Frustum culling off (always visible)
  environmentSphere.frustumCulled = false;

  // Optimize: Use MeshBasicMaterial (no lighting calculations)
  // Already using MeshBasicMaterial above
}
```

## glTF Model Requirements

**For best results:**
- Model should be UV-unwrapped sphere or skybox
- Texture resolution: 2048x2048 or 4096x2048 (equirectangular)
- File size: Keep under 5MB for fast loading
- Format: .glb (binary) preferred over .gltf for size

**Alternative sources:**
- Use equirectangular image as texture (panorama photo)
- Procedural shader (see fallback example)
- Simple gradient or starfield

## Example: Using an Image Instead of glTF

If you have a spherical image instead of glTF:

```javascript
function loadEnvironmentSphereFromImage(imagePath) {
  const loader = new THREE.TextureLoader();

  loader.load(
    imagePath,
    (texture) => {
      const sphereGeo = new THREE.SphereGeometry(SPHERE_RADIUS, 64, 64);
      sphereGeo.scale(-1, 1, 1);

      const material = new THREE.MeshBasicMaterial({
        map: texture,
        side: THREE.BackSide
      });

      environmentSphere = new THREE.Mesh(sphereGeo, material);
      scene.add(environmentSphere);
      console.log('Environment sphere loaded from image');
    },
    undefined,
    (error) => {
      console.error('Error loading sphere texture:', error);
      createFallbackSphere();
    }
  );
}

// Usage:
// loadEnvironmentSphereFromImage('/assets/space-panorama.jpg');
```

## Synthwave Starfield Alternative

Create a procedural starfield sphere:

```javascript
function createStarfieldSphere() {
  const sphereGeo = new THREE.SphereGeometry(SPHERE_RADIUS, 64, 64);
  sphereGeo.scale(-1, 1, 1);

  // Create canvas texture with stars
  const canvas = document.createElement('canvas');
  canvas.width = 2048;
  canvas.height = 1024;
  const ctx = canvas.getContext('2d');

  // Background gradient
  const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
  gradient.addColorStop(0, '#0a0015');    // Top: dark purple
  gradient.addColorStop(0.5, '#220044');  // Middle: purple
  gradient.addColorStop(1, '#000000');    // Bottom: black
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Draw stars
  for (let i = 0; i < 1000; i++) {
    const x = Math.random() * canvas.width;
    const y = Math.random() * canvas.height;
    const radius = Math.random() * 2;
    const brightness = Math.random();

    ctx.fillStyle = `rgba(255, 255, 255, ${brightness})`;
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fill();

    // Add cyan/magenta tint to some stars (synthwave)
    if (Math.random() > 0.8) {
      ctx.fillStyle = Math.random() > 0.5 ? '#00ffff' : '#ff00ff';
      ctx.globalAlpha = 0.6;
      ctx.beginPath();
      ctx.arc(x, y, radius * 2, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1.0;
    }
  }

  const texture = new THREE.CanvasTexture(canvas);
  const material = new THREE.MeshBasicMaterial({
    map: texture,
    side: THREE.BackSide
  });

  environmentSphere = new THREE.Mesh(sphereGeo, material);
  scene.add(environmentSphere);
  console.log('Starfield sphere created');
}
```

## Testing Checklist

- [ ] Sphere loads without errors
- [ ] Sphere is visible from inside (player perspective)
- [ ] Sphere rotates smoothly
- [ ] Rotation speed looks good (not too fast/slow)
- [ ] No performance impact (check FPS)
- [ ] Works in VR headset (visible in both eyes)
- [ ] Sphere doesn't clip with game objects
- [ ] Fallback works if model fails to load

## Visual Tuning

Adjust these values to taste:

```javascript
const SPHERE_RADIUS = 50;           // Larger = more distant
const SPHERE_ROTATION_SPEED = 0.0005;  // Slower = more subtle

// Multi-axis rotation for dynamic effect
environmentSphere.rotation.y += SPHERE_ROTATION_SPEED;
environmentSphere.rotation.x += SPHERE_ROTATION_SPEED * 0.2;
environmentSphere.rotation.z += SPHERE_ROTATION_SPEED * 0.1;
```

## Notes

- The sphere should be large enough to never see the edges
- Use `side: THREE.BackSide` to render inside faces
- Invert geometry with `scale(-1, 1, 1)` OR use BackSide (not both)
- For best VR effect, keep rotation slow and smooth
- Consider making rotation speed configurable in debug panel
