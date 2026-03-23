# Debug Positioning Tool - Quick Reference

## Controls

### Movement
| Key | Action |
|-----|--------|
| W | Move forward |
| A | Move left |
| S | Move backward |
| D | Move right |
| Q | Move down |
| E | Move up |

### Debug Features
| Key | Action |
|-----|--------|
| C | Copy position & rotation to clipboard |
| Click button | Copy position & rotation to clipboard |

### Standard Controls
| Key | Action |
|-----|--------|
| Space | Fire weapon |
| 1/2/3 | Switch weapon mode |
| Mouse | Look around |

## Copy Format

When you press C or click the button, this is copied to clipboard:

```
Position: (12.345, 1.600, -8.765)
Rotation: (pitch: 15.00°, yaw: 45.00°)
```

## Debug Panel

Location: Top-left corner

Shows:
- X, Y, Z position (real-time)
- Pitch (vertical rotation) in degrees
- Yaw (horizontal rotation) in degrees

## Movement Settings

- Horizontal speed: 8.0 units/second
- Vertical speed: 5.0 units/second
- Smooth acceleration and friction
- Camera-relative movement

## Example Workflow

1. Load game in desktop mode
2. Click to enable mouse look
3. Use WASD + Q/E to navigate
4. Find perfect spawn spot
5. Press C (or click button) to copy coordinates
6. Paste into biome configuration

## Tips

- Movement is smooth with physics
- Can move diagonally (e.g., W+E = forward+up)
- Mouse look still works normally
- Panel stays visible but doesn't block view
