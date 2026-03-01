# INSTRUCTION SET 2: FPS Monitor

## Overview
Add an in-VR FPS monitor using Stats.js that displays in the headset view.

## Implementation Steps

### Step 1: Add Stats.js to index.html

In `index.html`, add to the import map:

```html
<script type="importmap">
{
  "imports": {
    "three": "https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js",
    "three/addons/": "https://cdn.jsdelivr.net/npm/three@0.160.0/examples/jsm/",
    "@supabase/supabase-js": "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm",
    "stats.js": "https://cdn.jsdelivr.net/npm/stats.js@0.17.0/build/stats.min.js"
  }
}
</script>
```

**IMPORTANT:** Stats.js is not an ES6 module, so we need to load it differently:

```html
<!-- Add this BEFORE the importmap -->
<script src="https://cdn.jsdelivr.net/npm/stats.js@0.17.0/build/stats.min.js"></script>
```

### Step 2: Initialize Stats in main.js

At the top of `main.js`:

```javascript
// Stats instance (initialized in init())
let stats = null;
let statsEnabled = false;
```

In the `init()` function, after setting up the scene:

```javascript
function init() {
  // ... existing scene setup ...

  // Initialize Stats.js
  if (typeof Stats !== 'undefined') {
    stats = new Stats();
    stats.showPanel(0);  // 0: fps, 1: ms, 2: mb
    stats.dom.style.position = 'absolute';
    stats.dom.style.top = '0px';
    stats.dom.style.left = '0px';
    document.body.appendChild(stats.dom);

    // Check if debug flag or localStorage preference
    statsEnabled = window.debugPerfMonitor || localStorage.getItem('showStats') === 'true';
    stats.dom.style.display = statsEnabled ? 'block' : 'none';
  }

  // ... rest of init ...
}
```

### Step 3: Update Stats in Render Loop

In the `animate()` function:

```javascript
function animate() {
  // Start stats measurement
  if (stats && statsEnabled) {
    stats.begin();
  }

  // ... all existing game logic ...

  // Render
  renderer.render(scene, camera);

  // End stats measurement
  if (stats && statsEnabled) {
    stats.end();
  }
}
```

### Step 4: Toggle Stats with Keyboard

Add keyboard shortcut to toggle stats (F3 key, like Minecraft):

```javascript
// Add to existing keyboard event listeners
window.addEventListener('keydown', (e) => {
  // ... existing keyboard handlers ...

  // Toggle stats with F3
  if (e.key === 'F3') {
    e.preventDefault();
    if (stats) {
      statsEnabled = !statsEnabled;
      stats.dom.style.display = statsEnabled ? 'block' : 'none';
      localStorage.setItem('showStats', statsEnabled);
      console.log('Stats:', statsEnabled ? 'enabled' : 'disabled');
    }
  }
});
```

### Step 5: Connect to Debug Panel

Update the debug panel checkbox to control stats:

In `index.html`, modify the debug panel checkbox handler:

```javascript
document.getElementById('debug-perf-monitor').addEventListener('change', function() {
  window.debugPerfMonitor = this.checked;
  if (window.stats) {
    window.statsEnabled = this.checked;
    window.stats.dom.style.display = this.checked ? 'block' : 'none';
  }
});
```

Make stats accessible globally:

```javascript
// In main.js init()
window.stats = stats;
window.statsEnabled = statsEnabled;
```

### Step 6: In-VR Stats Display (Optional Advanced Feature)

For stats visible inside the VR headset (not just on desktop monitor):

```javascript
// Create a 3D plane with stats texture in VR
function createVRStats() {
  // Create canvas for stats rendering
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 128;
  const ctx = canvas.getContext('2d');

  const texture = new THREE.CanvasTexture(canvas);
  const geometry = new THREE.PlaneGeometry(0.3, 0.075);
  const material = new THREE.MeshBasicMaterial({
    map: texture,
    transparent: true,
    side: THREE.DoubleSide
  });

  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.set(0, 1.7, -1);  // Floating in front of player
  scene.add(mesh);

  return { canvas, ctx, texture, mesh };
}

let vrStats = null;
let fpsHistory = [];

// In init(), after XR session starts:
renderer.xr.addEventListener('sessionstart', () => {
  if (statsEnabled) {
    vrStats = createVRStats();
  }
});

// In animate(), update VR stats display:
function updateVRStats(fps) {
  if (!vrStats || !statsEnabled) return;

  const { canvas, ctx, texture } = vrStats;

  // Clear canvas
  ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Draw FPS text
  ctx.font = '48px monospace';
  ctx.fillStyle = fps >= 72 ? '#00ff00' : fps >= 60 ? '#ffff00' : '#ff0000';
  ctx.fillText(`${Math.round(fps)} FPS`, 20, 60);

  // Draw target line (72fps)
  ctx.strokeStyle = '#00ffff';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(200, 64);
  ctx.lineTo(500, 64);
  ctx.stroke();
  ctx.fillStyle = '#00ffff';
  ctx.font = '20px monospace';
  ctx.fillText('72 target', 350, 85);

  // Update texture
  texture.needsUpdate = true;
}

// Calculate FPS in animate():
let lastTime = performance.now();
function animate() {
  const now = performance.now();
  const delta = now - lastTime;
  lastTime = now;
  const fps = 1000 / delta;

  fpsHistory.push(fps);
  if (fpsHistory.length > 60) fpsHistory.shift();  // Keep last 60 frames

  updateVRStats(fps);

  // ... rest of animate ...
}
```

## Performance Targets

- **Target:** 72 FPS (Meta Quest 2 native refresh rate)
- **Acceptable:** 60 FPS (minimum for VR comfort)
- **Warning:** < 60 FPS (causes motion sickness)

Color coding:
- Green: >= 72 FPS
- Yellow: 60-71 FPS
- Red: < 60 FPS

## Testing Checklist

- [ ] Stats appear in top-left corner on desktop
- [ ] F3 key toggles stats on/off
- [ ] Debug panel checkbox controls stats
- [ ] Stats persist across page reloads (localStorage)
- [ ] Stats show correct FPS (matches VR headset performance monitor)
- [ ] Stats don't cause performance drop themselves
- [ ] (Optional) Stats visible inside VR headset

## Notes

- Stats.js is lightweight and won't impact performance
- The desktop stats panel won't be visible in VR headset
- For VR stats, use the optional 3D canvas method
- Consider adding memory usage stats with `stats.showPanel(2)`
- Test with high enemy counts to verify performance
