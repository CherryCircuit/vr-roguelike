# Unified Game Layout Editor - Phase 1 Feature Checklist

## What We're Building

One HTML file (`tools/layout-editor.html`) that replaces `floor-hud-editor.html` and `pause-menu-editor.html`, with room to grow. All in-game UI screens editable in one place, with saved defaults and direct JSON output the game can load.

---

## A. Unified Editor Shell

### A1. Screen Selector
- [ ] Dropdown at top of sidebar: Floor HUD, Pause Menu, Title Screen, Scoreboard, Upgrade Cards, Game Over, Ready Screen
- [ ] Switching screens clears the viewport and loads that screen's element definitions
- [ ] Current screen name shown in page title: `"Layout Editor - Floor HUD"`

### A2. Shared Infrastructure
- [ ] One Three.js scene, camera, orbit controls, transform controls (already shared in both editors)
- [ ] Common sidebar layout: toolbar, selected element panel, element list
- [ ] Common export/import, undo, reset buttons
- [ ] Camera position remembered per screen (Floor HUD looks down at floor, Pause Menu looks straight on, etc.)

---

## B. Multi-Select & Input Improvements

### B1. Multi-Select Input Fields
- [ ] When multiple elements selected (shift-click OR group), show "N elements selected" in the sel-name area
- [ ] X/Y/Z number inputs show relative deltas, not absolute values
- [ ] Clicking the up/down spinner on X moves ALL selected elements +0.02 (or whatever the step is) in X
- [ ] Typing a new value into X sets ALL selected elements to that absolute X position (or we could make it always relative for multi-select? Your call)
- [ ] Scale/width/height inputs: when multi-selected, apply the same value to all (useful for uniform scaling)

### B2. Drag Handle Reliability Fix
- [ ] Current issue: clicking a transform handle sometimes selects a different object underneath
- [ ] Fix: when transform controls are active (dragging), suppress raycasting for element selection
- [ ] Fix: increase handle hit area or add a dead zone so handles don't compete with element meshes for clicks
- [ ] Alternative approach: use a selection lock. Once an element is selected, handles don't trigger re-selection until you click empty space first

---

## C. Per-Screen Saved Defaults (localStorage)

### C1. Auto-Save
- [ ] Every change auto-saves to `localStorage` with key like `layout-editor:floor-hud`
- [ ] Next time you open the editor and select Floor HUD, your last layout is already there
- [ ] No manual "save" button needed (but Export still available for JSON)

### C2. Named Presets (optional nice-to-have)
- [ ] Save/load named presets per screen (e.g. "Floor HUD - compact", "Floor HUD - wide")
- [ ] Stored in localStorage as `layout-editor:floor-hud:presets`

---

## D. Direct JSON Config Pipeline (Game → External Layout Files)

### D1. Layout JSON Files
Create JSON config files the game loads at startup:

| File | Screen | Game File to Modify |
|------|--------|-------------------|
| `layouts/floor-hud.json` | Floor HUD | `hud.js` (hudGroup children) |
| `layouts/pause-menu.json` | Pause Menu | `pause-menu.js` (pauseMenuGroup children) |
| `layouts/title-screen.json` | Title Screen | `hud.js` (titleGroup children) |
| `layouts/scoreboard.json` | Scoreboard | `hud.js` (scoreboardGroup children) |
| `layouts/upgrade-cards.json` | Upgrade Cards | `hud.js` (upgradeGroup children) |
| `layouts/game-over.json` | Game Over | `hud.js` (gameOverGroup children) |

### D2. JSON Schema (per element)
```json
{
  "id": "hearts",
  "x": -1.52,
  "y": 0.46, 
  "z": 0.01,
  "scale": 1.0,
  "align": "left"
}
```
Minimal. Only position, scale, align. Text content, colors, and font sizes stay hardcoded in the game (those aren't layout concerns).

### D3. Game-Side Loading
- [ ] In `hud.js`, add `loadLayout(screenName)` function that fetches `layouts/{screenName}.json`
- [ ] Falls back to hardcoded defaults if fetch fails (file not found, running locally without server)
- [ ] Called once during `initHUD()` for floor-hud
- [ ] Called during `showTitle()` for title screen
- [ ] Called during `showPauseMenu()` for pause menu
- [ ] Same pattern for each screen

### D4. Editor Export Matches Game Load
- [ ] Editor "Export" button saves JSON in the exact format `loadLayout()` expects
- [ ] One-click workflow: edit in browser, export JSON, drop into `layouts/` folder, game picks it up next load
- [ ] Editor can also POST to a local endpoint if we want live-reload (stretch goal)

---

## E. Game Code Changes Required

### E1. hud.js - Floor HUD
Current: hardcoded `position.set()` calls for heartsSprite, scoreSprite, scoreTitleSprite, killCountSprite, levelSprite, nukeEmojiSprite, nukeCountSprite, comboSprite, comboCooldownSprite

Change to:
```javascript
// After creating each sprite:
const layout = await loadLayout('floor-hud');
if (layout.elements[id]) {
  sprite.position.set(layout.elements[id].x, layout.elements[id].y, layout.elements[id].z);
}
```

### E2. pause-menu.js - Pause Menu
Current: positions hardcoded in `pauseMenuElements` object and `showPauseMenu()`

Change to: load `layouts/pause-menu.json`, apply positions to `pauseMenuGroup` children

### E3. hud.js - Title Screen
Current: `titleSprite.position.set()`, `subSprite.position.set()`, `titleBlinkSprite.position.set()`, `btnGroup.position.set()`

Change to: load `layouts/title-screen.json`, apply to titleGroup children

### E4. hud.js - Scoreboard
Current: scoreboardGroup with canvas-based rendering

Change to: load `layouts/scoreboard.json` for scoreboard mesh position/scale

### E5. hud.js - Upgrade Cards
Current: upgradeGroup with card positions set in `showUpgradeCards()`

Change to: load `layouts/upgrade-cards.json` for card layout offsets

### E6. hud.js - Game Over / Ready Screen
Current: gameOverGroup, readyGroup with hardcoded positions

Change to: same pattern, load from JSON

---

## F. New Screen Definitions for Editor

Each screen needs a `DEFS` array (like the existing ones) defining elements:

### F1. Title Screen
Elements: SPACEOMICIDE title, "VR ROGUELIKE BLASTER" subtitle, "PRESS TRIGGER TO BEGIN" blink text, SCOREBOARD button, debug indicator

### F2. Scoreboard
Elements: Scoreboard mesh/panel, header, scroll area, navigation buttons

### F3. Upgrade Cards
Elements: Header text, cooldown sprite, 3 upgrade card positions, skip card position

### F4. Game Over
Elements: "GAME OVER" text, final score, stats lines

### F5. Ready Screen
Elements: "GET READY" text, level number

---

## Build Order

1. **B2** - Fix drag handle reliability (standalone fix, improves current editors immediately)
2. **A** - Unified editor shell with screen selector
3. **B1** - Multi-select input fields (relative movement for all selected)
4. **C1** - Auto-save per screen to localStorage
5. **D1-D3** - JSON layout files + game loading code
6. **E1** - Floor HUD reads from JSON (proof of concept)
7. **D4** - Editor export format matches game load format
8. **E2-E6** - Remaining screens read from JSON
9. **F1-F5** - New screen definitions added to editor

Steps 1-4 can be done in the editor only (no game changes). Steps 5-9 add the game pipeline.

---

## File Structure After Phase 1

```
tools/
  layout-editor.html          ← unified editor (replaces both old editors)
  floor-hud-editor.html       ← kept as backup, no longer updated
  pause-menu-editor.html      ← kept as backup, no longer updated

layouts/                      ← new directory
  floor-hud.json
  pause-menu.json
  title-screen.json
  scoreboard.json
  upgrade-cards.json
  game-over.json
```
