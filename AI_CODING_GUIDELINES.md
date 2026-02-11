# AI CODING AGENT GUIDELINES

## IMPORTANT RULES FOR MAKING EDITS TO THIS PROJECT

### 1. **ALWAYS UPDATE VERSION DATE/TIME**

Before making ANY code edit, update the version display in `hud.js`:

**Location:** `hud.js` lines 404-406

**Current format:**
```javascript
const versionDate = 'FEB 11 2026   2:45PM PT';
const versionNum = 'v0.045';
```

**Update BOTH:**
- `versionNum` - Increment version number (e.g., v0.045 → v0.046)
- `versionDate` - Update to current Pacific date/time

**Example Pacific time format:** `MON DD YYYY   HH:MM AM/PM PT`

---

### 2. **NEVER USE `sed` ON WINDOWS**

**CRITICAL:** The `sed` command on Windows DOES NOT handle multi-line replacements correctly and can CORRUPT FILES.

**What happened:** sed on Windows created duplicate lines and broke file structure when used with multi-line patterns.

**ALTERNATIVE: Use the Edit tool (or your IDE's built-in refactoring) instead**

---

### 3. **USE EDIT TOOL WITH SMALL, TARGETED CHANGES**

When making multiple edits:
- Make one small, specific edit at a time
- Read the file first to see exact context
- Test that the edit applied correctly
- Move to the next edit

This prevents file corruption and makes it easier to identify issues.

---

### 4. **BEFORE COMMITTING**

After completing a batch of edits:
1. Test the game in VR
2. Check console for errors
3. If any crashes occur, copy the console log (use the "Copy Log to Clipboard" debug button)
4. Commit only when changes are verified working

---

### 5. **DEBUGGING APPROACH**

If game crashes:
1. Use the detailed logging output to identify where crash occurs
2. Look for log patterns like:
   - `[SHOOT]` - Shooting system
   - `[SPAWN PROJ]` - Projectile spawning
   - `[spawnDamageNumber]` - Damage number creation
   - `[MAIN]` - Main game loop/HUD updates
3. Copy full console log using the debug panel's "Copy Log to Clipboard" button
4. Provide the log to the AI agent for analysis

---

## FILE STRUCTURE

- **main.js** - Game loop, shooting, combat logic
- **game.js** - Shared game state, level configuration
- **enemies.js** - Enemy spawning, movement, boss system
- **upgrades.js** - Upgrade definitions, weapon stats
- **audio.js** - Sound effects and music
- **hud.js** - All UI elements (title screen, HUD, damage numbers, etc.)
- **scoreboard.js** - Scoreboard API integration
- **index.html** - HTML structure, import maps, debug panel

---

## TESTING CHECKLIST

Before marking an edit as complete:
- [ ] File edited successfully
- [ ] No syntax errors in browser console
- [ ] Game starts without crash
- [ ] Tested the specific feature/functionality
- [ ] Version date/time updated in hud.js
- [ ] Committed changes (after testing)

---

## BROWSER CACHING

If changes don't appear to load:
1. **Hard refresh** - Reload the page (Ctrl+F5 or Cmd+Shift+R)
2. **Clear browser cache** - DevTools → Application → Clear site data
3. **Check version display** - Verify the date/time on title screen matches what you expect

The version display helps identify which build is currently loaded.

---

**LAST UPDATED:** FEB 11 2026   2:45PM PT
**VERSION:** v0.045
