# WebGL Testing Setup for WSL

## Overview
This guide explains how to test WebGL applications (like the VR roguelike game) from WSL with headless Chrome.

## What Was Done

### 1. GPU Configuration
Your RTX 4070 is now properly configured for WSL:
- NVIDIA driver (591.86) has WSL support
- WSLg provides GPU passthrough
- Mesa uses ANGLE/Vulkan for WebGL translation

### 2. Permanent Setup
- **Environment variable added to `~/.bashrc`:**
  ```bash
  export MESA_D3D12_DEFAULT_ADAPTER_NAME=NVIDIA
  ```

- **Chrome launch script created:**
  ```
  /home/graeme/.openclaw/scripts/start-chrome-webgl.sh [port]
  ```

### 3. Testing Method
Workers can now:
1. Start Chrome with WebGL: `~/openclaw/scripts/start-chrome-webgl.sh 9222`
2. Connect via WebSocket to test games
3. Verify WebGL rendering works

## How to Use

### Start Chrome with WebGL
```bash
# Start on port 9222 (default)
/home/graeme/.openclaw/scripts/start-chrome-webgl.sh

# Or specify a different port
/home/graeme/.openclaw/scripts/start-chrome-webgl.sh 9223
```

### Test a Game
```javascript
const WebSocket = require('ws');
const ws = new WebSocket('ws://localhost:9222/devtools/browser/[browser-id]');

// Create page, navigate to game, check console for errors
// See test-permanent-webgl.js for full example
```

## Chrome Flags That Make It Work
```bash
--headless=new              # New headless mode (supports GPU)
--use-gl=angle              # Use ANGLE for GL translation
--use-angle=vulkan          # Vulkan backend for ANGLE
--ignore-gpu-blocklist      # Don't block GPU features
--no-sandbox                # Required for WSL
--enable-webgl              # Enable WebGL support
--enable-webgl2             # Enable WebGL2 support
```

## Troubleshooting

### Check GPU is detected
```bash
glxinfo -B
# Should show: Device: D3D12 (NVIDIA ...) Accelerated: yes
# NOT: llvmpipe
```

### Check NVIDIA driver
```bash
/usr/lib/wsl/lib/nvidia-smi
# Should show your GPU and driver version
```

### Test WebGL manually
```bash
# Start Chrome
/home/graeme/.openclaw/scripts/start-chrome-webgl.sh

# Navigate to test page
curl -s http://localhost:9222/json/new?https://get.webgl.org/
```

## Notes
- The MESA variable must be set before Chrome starts
- Chrome must use ANGLE+Vulkan, not native GL
- Port 9222 is used by default (9223, 9224, etc. for multiple instances)
- Headless Chrome with WebGL is slower than visible, but works for testing

## Verification
Run this to verify everything is working:
```bash
cd /tmp
timeout 10 node test-permanent-webgl.js
```

Should output: "✅ WebGL WORKING - Permanent solution confirmed!"
