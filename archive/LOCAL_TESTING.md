# Local Testing Guide

This guide explains how to run and test the VR roguelike game locally on your machine.

## Quick Start

```bash
cd ~/git/vr-roguelike
python3 -m http.server 8000
```

Then open your browser and navigate to: http://localhost:8000

## Desktop Controls

When VR hardware is not detected, the game automatically runs in desktop mode with keyboard/mouse controls.

### Movement
- **W / A / S / D** - Move forward/left/back/right
- **Arrow Keys** - Alternative movement keys
- **Shift** - Sprint (1.5x movement speed)

### Aiming & Firing
- **Mouse** - Look around (click once to enable pointer lock)
- **Left Click** or **Space** - Fire weapons
- **1** - Fire left weapon only
- **2** - Fire right weapon only
- **3** - Fire both weapons (default)
- **Mouse Scroll** - Cycle through fire modes

### Game Controls
- **ESC** - Pause / Open menu

## Testing Your Changes

### Before Pushing
Always test your changes locally before creating a pull request:

1. Start the local server: `python3 -m http.server 8000`
2. Open http://localhost:8000 in Chrome or Firefox
3. Verify your feature works as expected
4. Test edge cases (e.g., weapon switching, level transitions, enemy spawning)
5. Check for console errors (F12 → Console)

### Common Testing Scenarios

**Weapon Upgrades:**
- Fire weapons in all three modes (1/2/3)
- Verify damage numbers appear on hit
- Test weapon switching mid-game

**Level Progression:**
- Complete a level and verify upgrade screen appears
- Test different upgrade selections
- Verify boss levels spawn correctly

**Enemy Behavior:**
- Test fast, swarm, and tank enemy types
- Verify damage numbers and hit detection
- Check for performance issues with many enemies

## Troubleshooting

### Pointer Lock Not Working
- **Cause:** Some browsers require HTTPS for pointer lock API
- **Solution:** Use Chrome or Firefox; localhost usually works without HTTPS
- **Alternative:** If pointer lock fails, reload the page and click again

### Game Won't Start
- **Cause:** Missing JavaScript files or CORS issues
- **Solution:** Ensure you're serving from the repo root with `python3 -m http.server`
- **Check:** Open browser console (F12) for specific error messages

### Performance Issues
- **Cause:** Too many enemies or particles
- **Solution:** Check console for frame rate, close other tabs
- **Tip:** Lower browser resolution or close other applications

### VR Mode Not Available
- **Cause:** No VR headset connected or WebXR not supported
- **Solution:** Game automatically falls back to desktop mode
- **Manual Toggle:** Run `window.toggleDesktopMode()` in browser console

## Browser Compatibility

**Tested Browsers:**
- ✅ Chrome 120+ (recommended)
- ✅ Firefox 121+
- ⚠️ Edge (Chrome-based - should work)
- ❌ Safari (limited WebXR support)

**For VR Testing:**
- Chrome is recommended for best WebXR support
- Firefox has good VR support but may have performance differences
- Oculus/Meta Quest browser works for standalone testing

## Performance Monitoring

The game includes a built-in FPS counter (bottom-right corner). Enable debug monitoring:

```javascript
// In browser console:
window.debugPerfMonitor = true
```

This displays detailed performance metrics in the console.

## Developer Guidelines

**All developers should:**
1. Test locally before every push
2. Verify no console errors appear
3. Check performance on target hardware (if available)
4. Test on both desktop and VR modes (if possible)
5. Document any known issues in the PR description

## Getting Help

If you encounter issues:
1. Check the browser console for error messages
2. Verify you're on the latest version of the branch
3. Search existing GitHub issues for similar problems
4. File a new issue if the problem persists

## Notes

- Local testing is much faster than waiting for GitHub Pages deployment
- Desktop mode provides full access to game mechanics without VR hardware
- The game state is saved in local storage (reset by clearing browser data)
- Changes to HTML/CSS/JS files are reflected on page reload
