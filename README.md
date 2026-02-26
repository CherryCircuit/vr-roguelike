# vr-roguelike
WebXR synthwave-style 8-bit VR shooter roguelike

## Controls

### VR Mode
- **Left/Right Controller Trigger**: Fire weapons
- **Move**: Teleport locomotion (pull and release trigger to move)
- **Grip**: Not currently used

### Desktop Mode (Keyboard + Mouse)
The game auto-detects VR availability and switches to desktop mode when no VR headset is connected.

**Movement:**
- `W` / `A` / `S` / `D` - Move forward/left/back/right
- `Arrow Keys` - Alternative movement
- `Shift` - Sprint (1.5x speed)

**Aiming & Firing:**
- `Mouse` - Look around (click to enable pointer lock)
- `Left Click` or `Space` - Fire weapons
- `1` - Fire left weapon only
- `2` - Fire right weapon only
- `3` - Fire both weapons (default)
- `Mouse Scroll` - Cycle through fire modes

**Game Controls:**
- `ESC` - Pause / Menu
- Click to enable mouse look after loading

**Note:** Desktop mode uses a first-person shooter style with WASD movement and mouse aiming. The game automatically switches to desktop mode when VR is not available. You can also manually toggle between VR and desktop mode by calling `window.toggleDesktopMode()` in the browser console.

## Game Mechanics

- Defeat waves of voxel enemies
- Collect upgrades between levels
- Survive as long as possible
- Progress through increasingly difficult levels

## Development

This project is still in active development. For the latest status, check the issues on GitHub.
