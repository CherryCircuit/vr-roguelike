# SESSION HANDOFF — Feature/Fix Sprint (pick up here with a fresh context)

Paste this whole file's contents (plus `AGENTS.md` is auto-loaded from the repo) into a
new opencode session. Everything below is verified current as of commit `7825c6c` (pushed).

---

## WHAT THIS PROJECT IS

**SPACEOMICIDE** — a WebXR VR roguelike FPS (stationary player, dual-wield, synthwave).
No build step (browser ES modules), no npm packages at runtime (THREE/Supabase via CDN
import map in index.html), all audio procedural (Web Audio), all visuals procedural.
Deployed to Vercel from GitHub (repo `CherryCircuit/vr-roguelike`, live at
`spaceomicide.vercel.app`). `AGENTS.md` in the repo root has the project rules —
READ IT. Key rules: no build step, VR perf is critical (72fps), comment code thoroughly,
test incrementally, search online resources before implementing. Automation conventions
and module architecture rules live in AGENTS.md §16-17.

## CURRENT MODULE LAYOUT (approximate line counts)

| File | Lines | Role |
|---|---|---|
| `main.js` | ~7,660 | Game flow/state machine, render loop, input, HUD orchestration, upgrade selection, telemetry |
| `beam-weapons.js` | ~1,360 | Charge cannon + lightning rod (extracted #196 P1) |
| `projectile-system.js` | ~2,220 | Projectile spawn/update/hit pipeline, instanced pools, accuracy, explosions, **screenFx** (extracted #196 P2) |
| `alt-weapons.js` | ~3,630 | All 20 alt weapons + pools (extracted #196 P3) |
| `enemies.js` | ~12,180 | Enemies, bosses, status effects, **synergy elemental behaviors** (never extracted; oldest module) |
| `weapons.js` | ~1,210 | Weapon/upgrade defs, `getWeaponStats(weaponId, upgrades)`, **`detectSynergies`**, **`MASTERY_CARDS`** |
| `mastery.js` | ~110 | Per-weapon mastery: tier math, localStorage persistence, best-mastery helper |
| `eclipse.js` | ~340 | Eclipse Engine corruption layer (#172): eclipse state, `applyEclipseToStats`, drains, purge |
| `threat-compass.js` | ~300 | Ground-glow threat indicator (#206): shader lobes, biome tint, scratch-buffer lobes |
| `environment-orchestration.js` | ~460 | Biome/theme/fade/star lifecycle (#196 P5): owns env state, main.js reads exports |
| `flow-countdowns.js` | ~140 | Ready + pause 3-2-1 state machines (#196 P4, reduced) |
| `input-router.js` | ~150 | State→handler dispatch tables for trigger/click/squeeze (#196 P4, reduced) |
| `breach-events.js` | ~330 | Mid-level arena hazards (#138): 5 seeded events, EMP fire gate |
| `void-marks.js` | ~330 | Death persistence (#139): localStorage scars, inherit/purge |
| `transitions.js` | ~430 | Round 11: camera-attached cinematic level transitions (shader iris wipe + level card), VR-safe (no post-processing) |
| `menu-presence.js` | ~230 | Round 11: re-anchors world-space menus in front of the player when they turn away (pause, cards, settings, title, scoreboard, …) |
| `ui-kit.js` | ~250 | Round 11: cached canvas textures for AAA panel/card/meter skins (no per-open uploads) |
| `game.js` | ~616 | Central state (`game` object incl. `game.synergies`), resetGame, hooks |
| `audio.js`, `hud.js`, `damage-numbers.js`, `voxel-debris.js`, `stasis.js`, `boss-death-cinematic.js` | | Supporting modules |

**Cross-module cycles (intentional, documented in code, runtime-only usage — valid in
native ES modules):** beam-weapons ↔ projectile-system, projectile-system ↔ alt-weapons,
beam-weapons ↔ enemies (chain arc import), enemies → weapons (synergy).

## DONE THIS SESSION (chronological, all pushed to `main`)

A marathon session — every commit below is verified with its own puppeteer suite
(now 30 total) + the deploy-sim gate. All live at spaceomicide.vercel.app.

0l. **round-11: readability / presence / presentation pass** (this session;
    all verified with the new `test-visuals.cjs` plus the existing suites):

    - **three.js 0.160 → 0.187** in `index.html`, `dev.html` and the layout
      tools. The game boots, renders and passes the suite on r187. Added a
      once-per-level `renderer.compileAsync(scene, camera)` warm-up so new
      biome/boss materials compile off the critical path (Quest hitch).
    - **Cinematic level transitions** (`transitions.js`): camera-attached
      shader quad (never a post pass — XR-safe), iris closes with an
      accent-coloured energy band, a "SECTOR CLEARED / LEVEL N / BIOME" card
      animates through the black beat, then the iris opens. Runs at run start
      (`RUN INITIATED`) and every level advance (boss alerts keep their own
      arrival cinematic). `__test.transitions` exposes state for tests.
    - **Menus can no longer be lost behind the player** (`menu-presence.js`):
      every world-space modal (upgrade cards, alchemy/evolutions children,
      pause, settings, title, game over, name entry, scoreboard, country
      select, ready screen) re-anchors in front of the camera — preserving its
      authored distance/height — after ~0.35 s off-gaze (>52°), with a 1.4 s
      cooldown and a 0.32 s glide. The pause menu gets an anchor callback
      because its own update() owns its position each frame.
    - **Quest thumbstick scroll fixed**: `updateEvolutionsScrollInput` only
      read `axes[1]`; Quest reports the stick on `axes[3]`, so the alchemy
      bench/evolutions menus looked unscrollable. It now takes the larger of
      axes[1]/axes[3] and is frame-rate independent (wall-clock accumulation).
    - **Lightning beam audio was silent in production (CORS)**: the loop used
      `crossOrigin='anonymous'` + `createMediaElementSource`, but the R2 bucket
      sends no `Access-Control-Allow-Origin`, so the element was blocked (and
      every menu test saw the CORS error). It now uses a plain media element
      with `volume` (synced to the SFX slider), which plays cross-origin.
    - **All menu buttons audited + two dead paths fixed**: the settings
      `resetMastery` button was missing from `getSettingsHit`/hover lists
      (unclickable), and `showUpgradeCards` stacked stale card faces when
      re-opened (visible but unselectable). Both fixed and covered by
      `buttons-*-hit` checks that raycast every visible button through the
      same hit function the trigger path uses. The bestiary BACK button is
      tilted toward the player so a downward gaze lands on it.
    - **Enemy silhouettes redesigned** (still voxels): every type now has a
      recognisable 2D pattern extruded 2 voxels deep — saucer drone, swept
      dart, armoured sentinel, wasp, launcher, turret, gravity ring, rooted
      spike, humanoid echo, curled leech, relay, crowned knight. Swarm went
      from 1 cube → 10 voxels; all combat types are 10–40 voxels.
    - **Enemy action communication**: one instanced contact-shadow pool under
      every enemy (depth + pathing), one instanced intent-ring pool that
      appears only while an enemy is winding up (red mortar, orange
      bombardier, green leech drain, violet barrier/anchor pulse, pink
      conductor link, white mirror immunity), and pooled mortar landing
      markers at the exact impact point for the shell's whole flight.
    - **Boss fidelity + draw calls**: base-pattern bosses (Scrap Golem, Holo
      Phantom, Pulse Emitter, Rust Serpent, Static Wisp, The Maw) get 9×9
      patterns and `mergeBody` — the whole body is one merged BufferGeometry
      (1 draw call) with 3–6 separate weak-point voxels (was up to 19). Boss
      death debris rebuilds body cubes from recorded positions instead of
      cloning the merged slab. The TelegraphingSystem now shares geometries
      and a single flash texture (was allocating a canvas + texture + geo per
      boss shot and disposing them a second later).
    - **UI skin** (`ui-kit.js`): cached canvas textures give cards a dark-glass
      surface with cut corners, accent frame, header rail, micro-grid and
      power-cell ticks; menus get a deep-glass panel with accent bloom, corner
      brackets, vignette and hatch. Applied to upgrade/SKIP cards, pause,
      settings, alchemy, evolutions, training and the accuracy meter. Cached
      per accent colour — no per-open texture uploads.
    - **New suite `test-visuals.cjs` (30th)**: transition lifecycle (camera
      child, animated cover, teardown), menu recentring + on-screen projection,
      every menu button's angular size (≥2.5°) and raycast action, Quest
      axes[3] scrolling, enemy/boss silhouette stats, ground/intent/mortar
      markers, boss merge + weak-point cap, projectile core+glow visibility
      for all four pools, hostile projectile pool, and a 22-enemy stress
      sample with frame-time/draw-call/leak ceilings.

0k. **round-10: enemy spawning is world-fixed again (the pre-alchemy behaviour)**
    — rounds 9/9b made spawning depend on the headset. It must not. Restored
    and locked down against commit `746eceb~1` (the last commit before the
    alchemy bench, confirmed by reading that revision):
    - `getSpawnPosition()` is the historical function again: **world -Z,
      100° total (±50°)**, centred on the world origin, y=1.5 (air spawns
      0.5..3) plus the level's `verticalAngle` (10/20/30°) lift. It reads no
      camera at all. Only addition: a hard floor clamp so a body can never dip
      below the arena floor.
    - `captureLevelSpawnForward()` is the historical one-liner again:
      `_levelSpawnForward.copy(DEFAULT_LEVEL_SPAWN_FORWARD)` — no camera read.
      Boss framing and every front-arc clamp (bosses, mortars, minions, leech
      bursts, breach hazards) use that same constant.
    - Training ground: fixed world -Z cone at ±50°, same as the main game.
    - Audit phases now turn the head to 0°/80°/175°/-20°/200° and still require
      every spawn within ±55° of world -Z: max measured spawn angle across all
      types is 50°.

0k. **round-10: FIXED spawn cone (correction to 0j)** — the 0j change made
    spawning follow the *live head direction*, which is wrong: turning your head
    redefined "in front" every second and enemies still arrived outside the
    level's framing. Restored a **fixed front axis per level**:
    - `getSpawnPosition()` uses `getSpawnForward()` — the level front captured
      ONCE by `captureLevelSpawnForward()` (camera stance at level start) and
      never the live view. `setPlayerForward()` / the per-frame view ref were
      deleted so no placement path can read the head direction again.
    - Cone widened to **150° total (±75°)**, with vertical rules restored: bodies
      spawn at floor+1.1 (never below floor+0.8) and the cone tilts UP with the
      level's `verticalAngle` (10°/20°/30°) — late waves arc in from above.
    - Every front-arc clamp (bosses, mortars, boss/leech minions, breach hazards)
      now defaults to that same fixed axis; the training ground captures its own
      fixed front at `startTraining()`.
    - Audit updated: it now measures against `getSpawnForward()` and runs phases
      where the head is turned 175°/200° AWAY from the level front, proving the
      spawn arc does not follow the view (0 spawns behind / outside ±78°).

0j. **round-9: enemy placement audit + menu overhaul** (player feedback round 9):
    - **Enemy visibility audit** (`test-enemy-visibility.cjs`): a per-frame
      in-page probe over 4 levels × 4 fixed player facings plus a per-type
      sweep. It measures, per enemy type: spawn angle vs the player's facing
      (behind / outside the ±65° cone), every-sample angle (behind), body
      bounds vs the biome floor, occlusion by biome geometry (raycast from the
      camera), plus "active but invisible". Data drove every fix below.
    - **Spawns now follow the player's FACING**: `getSpawnPosition()` used the
      world -Z axis (and the camera-xz origin), so turning in VR — or a level
      framed in another direction — spawned whole waves behind the player.
      Boss framing (`captureLevelSpawnForward`) captures the camera's actual
      forward; boss/leech minions and breach hazards (flare, meteors, rift) are
      pinned to the front arc; the training ground's own spawner uses the
      camera basis too.
    - **Under-floor / hidden enemies**: the bombardier planted its ORIGIN at
      floor+0.2 with a 0.5 hitbox (30cm buried) — it now plants its body on the
      floor; the rift breach pulled enemies downward (now horizontal only).
      Non-instanced enemy bodies (jelly, bombardier, anchor, tendril, leech,
      echo, minions) now use renderOrder 10 like the InstancedMesh pools, so
      biome overlays (sun reflection 1, horizon glow 0.5) cannot wash them out.
    - **updateEnemies** skips array holes left by nested destroyEnemy splices
      (was throwing "reading '_warpActive' of undefined" and killing the frame).
    - **ALCHEMY/EVOLUTIONS dead-button fix**: `selectUpgrade` now tests the
      bench/evolutions buttons BEFORE the card-selection cooldown. The cooldown
      (1.5s after every level-up) swallowed the first presses, which read as
      "the buttons only work once".
    - **Menu overhaul** (evolutions + alchemy + training): compact opaque
      panels (3.4–3.8 × 2.2 at ~4m) that sit above the floor, single-line
      labels (the alchemy label canvas width was ~6× too small, wrapping every
      label into 2-3 lines inside a short button — the root of the
      "overlapping/ugly" menus), real scrolling windows instead of pages, and
      the rest of the UI hidden behind the panel. Performance: opaque quads
      instead of stacked translucent layers, no per-frame shader essence squares,
      no per-frame counter traverse, rows built once and only moved/toggled on
      scroll. The training menu dropped its 21 canvas-texture "alarm clock"
      counters (the queue count lives in the button label) and its lists are
      windowed so hidden rows never draw outside the panel.
    - New suite `test-menus.cjs` (29th): first-press open after a level change,
      no overlapping buttons (pairwise AABB), panels above the floor/inside the
      panel bounds, bench + evolutions scrolling, windowed training lists.
    - NOTE: the training menu geometry is now code-defined constants in
      `training-ground.js` (`MENU_*`), so `layouts/training-ground.json` no
      longer drives it (the layout editor still drives every other screen).
      The upgrade-card screens (evolutions/alchemy) keep using
      `layouts/upgrade-cards.json` lists, whose values were re-synced.

0i. **round-8 feedback batch** (game-crashing upgrade bug + 4 polish items, from
    the player's in-headset session):
    - **GAME CRASH on every upgrade pick — ROOT CAUSE**: `selectUpgrade()` still
      called `getSandboxHit()` / `handleSandboxAction()`, which commit `658fd3e`
      deleted along with the dev sandbox. Every VR trigger during
      UPGRADE_SELECT (the `selectstart` route AND the held-trigger poll in the
      render loop) threw `ReferenceError: getSandboxHit is not defined`. That
      killed card picks, the ALCHEMY bench and the EVOLUTIONS menu (all three
      go through `selectUpgrade`). Dead block removed.
    - **Training Ground unusable in VR**: the menu raycast used
      `getAimRaycaster()` — the desktop centre-camera ray, which returns `null`
      when desktop controls are off, so every trigger did nothing. New
      `aimControllerRaycaster(index)` (pooled, per-hand) drives the trigger hit,
      the hover pass and a real SELECTOR mode: the aim beam brightens to 95%
      opacity, stops on the button face, the weapon ball shrinks to a reticle
      dot, and triggers no longer keep shooting through the panel. Menu now
      opens 2.9m along the gaze and yawed to face the player (walking away used
      to leave it behind you), with the placement captured once per open so
      rebuilds don't jump. Button faces are cached (`_menuTargets`) instead of
      re-traversing the menu 4× per frame; thumbstick scroll also accepts
      axes[3] (Quest mapping).
    - **Holodeck grid aliasing**: replaced the hard `step()` grid with analytic
      `fwidth()` anti-aliased lines (constant ~1-2px width, so distant lines
      soften instead of shimmering into moiré), split floor/wall materials into
      separate uniform sets, and fade to the fog colour by 62m (floor) / 170m
      (dome).
    - **Bestiary backdrop off to the left**: `CylinderGeometry` places vertices
      at `x=r·sinθ, z=r·cosθ`, so the arc centre is `thetaStart + len/2`. It was
      `-π/2 - 1.2` → centre at `(-r, 0)` (the player's LEFT). Now
      `π - len/2` → centred at -Z, straight ahead (mean x = 0 verified).
    - **Right blaster wrist panel text**: `layouts/upgrade-wrist-right.json` had
      drifted to bigger fonts (50/70/40 vs the left's 40/50/30) and offset rows.
      Synced the rendered element metrics to the LEFT layout (the one that looks
      right) and made `updateBlasterDisplay`/`createBlasterDisplay` fall back to
      the left metrics if a right-hand layout fails to load.
    - New suite `test-training-vr.cjs` (27th) covers the trigger crash on both
      paths, a real controller card pick, wrist-display parity, controller-driven
      training menu (beam/WAVE SIZE/queue/GO), grid uniforms, backdrop centring.

0. **`2e10f9b` — post-marathon bugfix trio** (three real production bugs found by
   the player, all rooted in the #196 extraction + stale biome Y coordinates):
   - **Black title screen + logo/version overlap**: `applyThemeForLevel(1)` ran
     BEFORE `initEnvironment()` wired `_deps.scene`, so the boot-time biome build
     was a silent no-op — the camera sat at y=0 and the 3D title logo projected
     onto the HTML logo/version zone. Moved the theme apply to after initEnvironment.
   - **Bombardier plants below the floor / compass & boss debris buried**:
     `getBiomeFloorY()` returned `floorY + SCENE_Y_OFFSET` with stale per-biome
     constants (~-0.6..-0.9) — 0.6m BELOW the actual visual floors, so floor-
     planting enemies (bombardier, void anchor, The Maw tiles), the threat
     compass disc, and boss debris all sank under the ground.
   - **Synthwave→Desert camera/floor mismatch**: biome group Y positions were
     legacy Needle coords (desert -0.20, alien -0.28, hellscape -1.55), leaving
     each floor at a different world height while the stationary camera stays at
     eye level. Normalized ALL biome floor surfaces to world y=0 (floor HUD at
     y=0 "sits flush"; synthwave was already 0.0) and made `getBiomeFloorY()`
     return 0.0. Also biased the void anchor's plant angle toward the player's
     forward arc (±30° of spawn bearing instead of a full random 2π) so it
     stops drifting off to the side.
     Verified: raycast floor = 0.0 in all 4 biomes; bombardier plants at y=0.2,
     anchor at y=0.9 in front, compass at floor+0.03; 12 suites + deploy-sim green.
   - **Group-rigidity proof**: a live-page test shifted each biome group +0.5 and
     confirmed EVERY mesh/points/line (152 objects) moved by exactly the group
     delta — no absolute-world-Y authors inside the scenes. Name-collision
     artifacts (GLB clones share mesh names) were ruled out by keying on UUID.

0b. **`3bae8bd` — follow-up player-feedback batch** (three small issues):
    - **Void-mark inherit prompt was a giant in-your-face banner** (the old
      `showFloatingMessage` style the UX passes removed): shrunk to a compact
      two-line hint (fontSize 26, scale 0.2, offsetY 0.62, offsetZ -1.3,
      maxWidth 300 — now word-wrapped via a new maxWidth pass-through in
      `showFloatingMessage`).
    - **Pink/purple planes at world origin under the player**: the XR controller
      visuals (cyan/pink cores + wrist-hologram planes) have no pose in desktop
      mode and sat at (0,0,0). Hidden while `!renderer.xr.isPresenting` (desktop
      input uses the virtual controller); re-shown in VR where they track hands.
    - **Frustum-culling insurance**: the user's past "objects vanish when the
      camera tilts up 1-3°" symptom. Headless real-frustum tests proved the
      upgrade-card border/EVO bar are NOT culled at any tilt (they're world-fixed
      UI at z=-4; the "purple bowl" that vanishes on tilt is the threat-compass
      ground disc + synthwave horizon-glow ring — both `frustumCulled:false`,
      they simply leave the view geometrically). Added `frustumCulled = false`
      to the card border LineSegments + EVO bar/text anyway (cheap, matches the
      repo's past culling fixes 18e2b14/e7389bd).

0c. **`658fd3e` — Training Ground** (the "holodeck", replaces the dev sandbox):
    - **TRAINING GROUND button on the title screen** (between the blink text
      and the button row) — a full player-facing practice arena, not a dev
      tool. The old O-key/debug-panel sandbox was removed.
    - **Holodeck arena**: while training is active the biome is swapped for an
      endless grid room — a 400m glowing grid floor + faint grid dome walls +
      center glow, dark backdrop (Star-Trek-holodeck look). Restored on exit.
    - **Reuses the entire combat loop**: `game.trainingMode = true` keeps state
      PLAYING; enemies/bosses/projectiles/evolutions all behave normally. The
      player is INVINCIBLE (`damagePlayer` early-returns; health bar never
      drops). No auto waves, no kill-target level complete, no boss-death
      cinematic (bosses clear cleanly), so the arena never advances.
    - **Training menu** (thumbstick-click / T / pause-button-free toggle):
      COMBAT view — 13 enemy types (scrollable list via thumbstick/wheel),
      8 bosses, a WAVE SIZE stepper (+5/+1/-1/-5, 1–30) that the enemy
      buttons spawn, CLEAR ENEMIES / LOADOUT → / EXIT. LOADOUT view — every
      upgrade (both hands; weapon-specifics to their hand) + all six
      EVOLUTIONS (applied to both hands) + RESET LOADOUT. Menu is modal while
      open (no firing), buttons hover-highlight, spawns appear 9–16m ahead.
    - **Training config**: hpMultiplier ×3 (~level-9 meat) so enemies/bosses
      survive long enough to test damage output; killTarget 9999.
    - Wired: VR trigger, desktop click, thumbstick Y scroll, wheel, T key;
      exit restores the biome + resetGame to title. New module
      `training-ground.js` (initX pattern). Verified live: title→holodeck→
      spawn 5× drone→Twin Helix kills them→Maw boss spawns→invincible→exit;
      12 regression suites green; deploy-sim green.

0d. **`5b48323` — round-4 feedback batch** (training ground + menus):
    - **Tiny-text cured systemically**: new `makeSizedText` (hud.js) sizes
      sprites by GLYPH size (sprite height × fontSize/canvasHeight) instead of
      sprite height — applied to training menu buttons/labels, evolutions rows,
      alchemy headings/descriptions/buttons, essence counter, bestiary. All
      the old 0.03-glyph text is now 0.045–0.06.
    - **Training Ground**: HTML logo/version overlay hidden on entry; menu
      renderOrder 1000+ (above the floor HUD's 999); the "you are invincible"
      hint is a WORLD-SPACE sign out on the field (never camera-pinned);
      holodeck floor got the synthwave pulsing-grid shader (pink↔blue breathe +
      outward ripple + distance fade); WAVE QUEUE system — enemy/boss buttons
      add to a pending wave (counts shown), GO releases bosses immediately and
      trickles enemies out in batches of 3 every 1.2s like a real level.
    - **Evolutions menu redesign**: pop in/out animation (easeOutBack scale);
      content now sits in a CROPPED box between the title and BACK with a
      scroll bar + thumb (row-window rendering, 3 rows visible); left-aligned
      rows, tightened spacing, glyph-sized fonts.
    - **Alchemy bench**: centered "ALCHEMY BENCH" title; headings LEFT
      BLASTER / FORGE / RIGHT BLASTER; essence is now THREE bordered squares
      that fill with an animated blue magic shader (swirl + pulse), shifting
      GREEN when all three are filled; forge buttons re-spaced (no overlap);
      headings/descriptions glyph-sized.
    - **Title TRAINING button**: same size as SCOREBOARD (1.0×0.25), moved
      below the button row (no overlap), added to the hoverables so it
      scales/glows like every other button.
    - **Bestiary**: entries now arc AROUND the player (curved-monitor wrap,
      cards rotate to face you), bosses get generous angular spacing (no
      overlap), descriptions widened (maxWidth 470) and TOP-ALIGNED below the
      level badge (the old centered desc overlapped the level text); backdrop
      panel moved behind the arc.
    - **Void-mark prompt**: camera-pinned floating message REMOVED — each mark
      carries world-space labels ("VOID MARK — <offer>" + "TRIGGER: INHERIT ·
      NUKE: PURGE") shown when in range, readable where the ghost died.
    - Regression: 10 suites green; deploy-sim green.

0e. **`6bbade7` — round-5 feedback batch** (crash fix + training/bestiary polish):
    - **Prism boss crash FIXED** (game-breaker): `takeDamage`'s damage-tint
      traverse called `.color.copy()` on ShaderMaterial meshes (Prism facets)
      → "Cannot read properties of undefined (reading 'copy')". Guard now
      checks `c.material.color.copy` exists (also hardened the Skull-boss
      hand tint). Verified: spawn Prism in training, 5 hits, no crash.
    - **Training menu**: floor HUD now hidden while the menu is open (its
      depthTest:false sprites drew over the menu regardless of renderOrder);
      buttons narrowed ~3× (enemy 0.72, boss 1.05, center ≤1.5); text boxes
      now FILL the button (maxWidth derived from button width × fontSize/glyph
      — the old fixed maxWidth wrapped text on a 15×-wider button); fonts
      bumped again (button glyphs 0.055–0.07); GO! closes the menu so the
      player can fight (reopen via thumbstick/T).
    - **Holodeck sign**: moved to (0, 2.15, -5.2) and ~200% larger glyphs
      (0.34 title / 0.13 hint) so it's legible and clear of the floor.
    - **Holodeck grid**: pulses LIME (0x88ff44) ↔ dark FOREST GREEN (0x1a5c1a)
      instead of pink/blue — "cool digital green grid".
    - **Evolutions menu + alchemy bench**: another font pass (evolutions name
      glyph 0.085, recipe 0.046 filling the row width; alchemy headings 0.085,
      descriptions 0.05, chips 0.05 with narrower buttons; text boxes derived
      from button widths).
    - **Bestiary**: rebuilt as TWO SCROLLABLE ARCS at close range (regulars
      R 2.35, bosses R 2.75, ±45°, 7 cards visible per row) with a CURVED
      cylinder backdrop (the flat plane is gone); scrolls via thumbstick /
      mouse wheel; models/names/levels + top-aligned descriptions.
    - test-mirror: both hands now get scope so the 70%-damage assertion isn't
      a wall-clock race (the boss alternates hands per volley).

0f. **`ff4decb` — round-6 feedback batch**:
    - **Training menu**: menu width shrunk (5.6) with columns hugging the
      center; ENEMIES/BOSSES/TRAINING GROUND headings doubled; LOADOUT button
      fixed (showTrainingMenu was resetting the view on rebuild); the menu
      PAUSES the wave while open; CLEAR WAVE now does a FULL reset (queue +
      every enemy/boss + boss bar); CURRENT WAVE text indicator removed —
      each enemy/boss button now has a DIGITAL alarm-clock counter (lime on
      black, "Digital Clock" font by LunasFont added to assets/fonts,
      non-commercial license) that flashes on update and pulses while active;
      WAVE SIZE stepper shrunk 40% with 25% bigger text, overlap fixed, moved
      down; enemy spawns use the STRICT ±50° front-arc rule (the old ±135°
      ring spawned behind the player).
    - **Bestiary**: all 21 entries visible on two arcs (R 4.2/4.6), every card
      now FACES the player (rotation.y = π − angle; the old −angle faced away
      on both flanks), curved cylinder backdrop re-centered on −Z (the old
      thetaStart put the wall off to the side / behind the player), BACK
      button raised into view.
    - **A**: EXIT from training now clears the boss health bar + boss.
    - **B**: THE MAW's minions now spawn on the front arc with a cap of 8
      concurrent boss-summoned minions (was unlimited, 360°, 1FPS).
    - **C**: boss deaths in training no longer fade the holodeck to black —
      startBossDeathCinematic early-returns when game.trainingMode (beams/
      projectile kill paths were bypassing the main-loop guard).
    - **D**: BLOOD MINOTAUR lunge rewritten as an ARC sweep at fixed radius
      (angle interpolation) — the old chord interpolation grazed the
      min-distance clamp mid-sweep (closest approach ≈ minDistance) and the
      boss hung up near the invisible wall. Lunges now land at ±51° inside
      the front arc; phase 2/3 diagonal height + speed preserved.
    - **E**: training plays a random level-music category; the settings menu
      (volume + track skip) is reachable via pause → SETTINGS.
    - **F**: all four new bosses now have REAL 3-phase fights with invulnerable
      "rage" windows — a generic phase-transition system in the base Boss
      (2.5s immune + pulse + roar at each 66%/33% threshold) enabled for
      Maw/Mirror/Conductor/Masquerade; the Conductor went from 2 to 3 phases
      (15s/12s/8s symphonies, 0.8/0.9/0.95 shield).
    - **G**: upgrade-card spinning prism icon halved (0.18 → 0.09, matching
      the SKIP card).
    - test-conductor updated for the new phase model.

0g. **`ac7556d` — round-7 feedback batch** (training menu polish):
    - Enemy/boss button+counter rows now CENTERED under their column titles
      (the pairs drifted off-center and clipped the panel edge).
    - LOADOUT view rebuilt: per-hand upgrade columns — LEFT BLASTER gets two
      upgrade columns with a LIVE digital counter per upgrade (shows how many
      of each that hand owns; clicking adds +1 to that hand), RIGHT BLASTER
      mirrors it; EVOLUTIONS moved to the CENTER column; RESET LOADOUT /
      ← COMBAT / EXIT TRAINING sit in a bottom action bar. Panel widens for
      the loadout view (6.7). Compact short-names for long upgrade labels;
      per-column scroll metadata (baseY/rowH) so scrolling works in the new
      layout.

0h. **`193b478` — big UX batch (player feedback round 3)**:
    - **Hover preview 2-row layout**: the 3 side-by-side columns overlapped on
      long labels (FIRE RATE: over 9/s). Each stat is now a heading line with an
      indented bold value + colored delta below it. SHOTS → PROJECTILES.
    - **Alchemy bench redesign**: 3 columns — dissolve LEFT / FORGE / dissolve
      RIGHT, per-column titles + descriptions, "LEAVES HAND BARE" and hand
      prefixes removed, ALCHEMY button emoji dropped, button labels word-wrap
      (new makeAlchemyLabelSprite scales by single-line canvas height so glyphs
      don't shrink). Forge + dissolve now open a CONFIRM POPUP (3D spinning
      icon, wrapped info, CONFIRM/BACK): forge rolls the result ONCE at preview
      and confirm applies that exact upgrade; dissolve shows the
      "dissolved upgrades are destroyed" warning. popup_back discards.
    - **EVOLUTIONS menu**: new EVOLUTIONS button under the cards → scrollable
      panel (Quest thumbstick Y + desktop wheel) listing all six evolutions with
      name, source weapon, progress bar (x/total), and the recipe upgrades to
      watch for (✓ collected / ○ missing). Scroll math in
      updateEvolutionsScroll (content Y offset, clamped).
    - **Card menu animations**: cards shrink out when ALCHEMY/EVOLUTIONS open
      and grow back on close (reverse of the warp intro) via a 200ms
      card-transition state ticked in updateUpgradeCards.
    - **Pause menu**: blaster sections redesigned — upgrades moved UP right
      under the weapon name in a 2-column list at the same size as the ENEMIES
      section; all text ~50% bigger (22px→33px); stats + enemies pushed down to
      fixed anchor rows so long upgrade lists never overlap them.
    - **Settings menu**: the four decorative border rects defaulted to
      visible:true at (0,0,0) — stacked cyan bars through the center. Defaults
      now hidden; real top/bottom/left/right border rects added to settings.json.
      Hover glow now derives from the button's own borderColor (was always cyan
      — makeBtn sets userData.borderColor alias).
    - **Desktop camera shake removed** — replaced with one-shot VR controller
      haptic pulses on damage (edge-triggered on the shake timer;
      pulseControllerHaptics). Damage feedback remains the hit-flash vignette.
    - **EVO bar real fix + redesign**: ROOT CAUSE found by pixel-bisection —
      the bar and the card face shared renderOrder 1, so three.js broke the tie
      by view-space CENTER depth; the bar at the card's top became "farther"
      than the card center at pitch ≥ +1° and the 91%-opaque card face blended
      over it. renderOrder 999 keeps it visible at every pitch (verified
      -15°..+25°). Retitled to "EVOLUTION" (no ⚡) and moved to a small gold
      extension ON TOP of the card (y=0.8).
    - **Bestiary expanded**: the new enemies (Bombardier, Void Anchor, Void
      Tendril, Echo Phantom, Leech) and bosses (Maw, Mirror Gauntlet, Conductor,
      Masquerade) now have entries + descriptions + voxel models (boss row
      spacing tightened for 8 entries).
    - **Boss-name mismatch fixed**: game.js's tier pools include the new bosses,
      but enemies.js's getBossNameForLevel used a stale 4-boss pool and always
      returned pool[0] (NECRO at level 5). The boss id is now rolled ONCE at the
      alert (game._pendingBossId) and reused at spawn so the name always matches.
    - **Debug sandbox (dev-only)**: O key or the debug panel button opens a 3D
      spawn/eval menu (works in desktop AND VR) — spawn any enemy/boss, add any
      upgrade, from inside the game, for in-headset review.

1. **`7825c6c` — #139 Void Marks**: deaths record to localStorage (`void_marks`,
   max 20); future runs at the same level+biome spawn a spectral hologram at the
   death spot. TRIGGER = inherit one random universal upgrade from the ghost run
   (boss deaths → special pool); NUKE = purge for +500×level score. Consumed
   either way. `void-marks.js` DI module; inherit hooks the trigger router,
   purge hooks activateNuke (nuke not spent).
2. **`9bce161` — #138 Breach Events**: ~40% of levels after 3 trigger one seeded
   arena event (never boss levels, never stacked, min 10s in, 3s telegraph).
   Five starters: solar_flare (zone burns player+enemies 2 DPS), gravity_inversion
   (enemies float), asteroid_rain (5-8 impacts, 50 AoE), dimensional_rift (pull +
   3 weak rift echoes), emp_wave (fire disabled). `breach-events.js` DI module.
3. **`cc28829` — #200 The Masquerade** (tier-3 boss): disguised as a basic enemy,
   body-swaps on "kill" (25% HP per swap, max 2, purple flash + whoosh), then
   reveals a voxel mask alternating comedy (gold spiral bolts) / tragedy (purple
   charged shot), disguise minions heal it on contact; <25% HP: 4-way cross fire
   + teleports behind the player. `destroyEnemy` intercepts the host death.
4. **`f08a8ef` — #197 Mirror Gauntlet** (tier-2 boss): chrome sphere firing 70%-damage
   copies of YOUR weapons (blaster bolts / buckshot spread / seeker triples /
   charge shots / plasma sprays). Phase 2 reveals a voxel humanoid, fires both
   hands, blinks every 4s. Phase 3: 1.5x rate + hostile afterimages.
   `spawnBossProjectile` gained an optional damage param.
5. **`5414180` — #168 The Maw** (tier-1 boss) + a real bug fix: the reflector-drone
   reflection was called in main.js's hostile-projectile loop without an import —
   a ReferenceError froze the whole frame loop the first time any boss projectile
   hit the player (pre-existing; export + import fixed). The Maw: 80 floor tiles
   crumble inward over 3 phases, orbits closer (14/11/8m), spawns basic/fast/swarm
   minions, chomp wind-ups expose a glowing core (3x damage, immune when closed).
6. **`da1d214` — #170 Conductor Ascendant** (tier-3 boss): conducts randomized
   symphonies of real enemies — spiral fasts / wave basics / grid tanks / pincer
   swarms — with per-movement disruption thresholds that drop an 80% shield for
   3s; <50% HP: mixed types, 12s movements, 90% shield.
7. **`3813ec9` — #169 Echo Phantom**: aim-replay enemy. main.js records per-hand
   aim every 100ms (3s window) + fire events; the phantom replays your shots as
   cyan projectiles that damage OTHER enemies (accidental ally), fades after 4s.
   Spawns after 5+ shots in 3s (level 11+).
8. **`32a5e16` + `1bf6ab1` — #167 Parasitic Leech** (and the test-port move):
   latches within 2m, orbits at 1.5m, drains 0.5 HP/s while swelling, bursts into
   3-4 minions after 3 HP stolen (freeze halves the drain). **All 26 suites now
   target :8001** — an unrelated uvicorn service took :8000.
9. **`cb8f199` — #171 Void Tendril**: spatial-control enemy growing a 60° arc
   barrier (3-12m from the player) that CONSUMES player projectiles; 3 hits to
   break (fire status: 1), then the 2-HP anchor is exposed. Weighted spawn.
10. **`f012904` — #198 Void Anchor**: stationary gravity well (3→5m over 8s) that
    bends player projectiles toward it at 15°/s (seekers resist); pulses damage
    at full size. Per-frame scratch-anchor list in updateProjectiles.
11. **`82a728f` — #199 Bombardier Beetle**: floor-turret — flies in, plants,
    sprays a tracking 45° cone (1 HP/0.3s in it), dies in a 2m friendly-fire
    burst. Capped 1/2/3 by level.
12. **`e002d02` — deferred combos** + **`d516744`/`f7b44d2` — #196 Phases 4-5**:
    see the earlier sections of this file (Soul Chain, Pinball Wizard, Momentum,
    Tesla Tower, Final Solution, Swarm Leader, HUD glow; environment-orchestration,
    flow-countdowns, input-router).

## RECENTLY COMPLETED## RECENTLY COMPLETED (prior sessions, all on `main`)

- **#206 Threat Compass** (`3ec7cb5`, `e145dc7`): ground-glow threat indicator —
  shader lobes, biome tint, scratch-buffer lobes, test-threat-compass.cjs.

- **#172 Eclipse Engine Phase 2** (`c355a56`, `bbd8ff1`): eclipse.js corruption
  layer — the final boss eclipses your universal upgrades below 50% HP (damage
  penalty, slower fire, projectile scatter, crit reflect, vampiric/status
  self-drain), escalating intervals + SHOCK counterplay, HUD warning banner with
  countdown, 4 new sounds, test-eclipse.cjs.

- **#213 Weapon Mastery** (`de882a3`): mastery.js tiers (Novice→Master), six mastery
  cards, kill tracking, game-over title, RESET MASTERY setting, test-mastery.cjs.
- **#215 Upgrade Card Preview + #185 Alchemy Bench + #189 Bullet Carnival + #218
  Dual-Wield Combos + #143 Weapon Evolution** (`c695d53`, `746eceb`, `39eb4ec`,
  `3f4bd5f`, `5ce5ece`, `2407142`): card preview panel (stat deltas/synergy hints/DPS),
  dissolve+forge alchemy, fusion cinematic + all six evolved weapons, D→SSS combat
  grading, simultaneous/alternate/sustained/cross combos. Follow-up UX polish rounds
  `1e82927`, `67a6b9a`, `449dd37`, `a489902` (Pacific-time stamp, on-card hover stats,
  no camera popups, text rendering, floating toasts, card layout).
- **Earlier**: audio pack (#142+#184), #196 refactor Phases 1-3, #216 elemental ammo,
  #211 synergy engine, deploy/stability fixes (see git log for details).

## CRITICAL LESSONS (do not relearn these the hard way)

1. **Test constants drift with seeded bonuses** — the mastery Adept bonus (+10%) changed
   blaster damage 15→17, and the 10th-shot Last Light hit became 85 (17×5), not 75.
   Seeker base damage is 12, not 8. The mastery title sprite's `userData.text` has no
   'MASTERY: ' prefix (the check is `/⚡/` + `/MASTER/`). Always debug-dump actual
   runtime values (`ps.projectiles.map(p => p.userData?.stats?.damage)`) BEFORE writing
   the assertion constants. Debug-dump showed Last Light actually worked all along.
2. **Batch test runs flake on load contention** — `test-evolution.cjs` fails only when
   run back-to-back with other suites; always green in isolation. Run suites
   individually; re-run any failure solo before investigating.
3. **Resource 404s report generic console text** — the death-stats API 404s on the
   static dev server (Vercel-only route) and the console message has no URL in its
   text. Filter the benign case via `msg.location().url.includes('death-stats')`.
4. **Test coverage must match the feature**: tank weak points need a tank test,
   elemental effects need elemental tests, mastery needs a mastery test. The 13 test
   files each cover a real gameplay path — extend them rather than trusting generic
   smoke tests.
5. **Durable architecture rules are in AGENTS.md §16-17** — automation conventions
   (input mapping, seeding, benign console noise, `page.evaluate` dynamic imports) and
   module rules (read-only bindings, dev-global masking, `initX(deps)` pattern,
   `getWeaponStats` signature, intentional cross-module cycles).
6. **Projectile pools recycle entries** — `ps.projectiles` retains stale
   `userData.stats` on recycled pool entries; snapshots after a state change must
   filter `p.visible && (p.userData?.createdAt || 0) >= t0` or the OLD damage value
   false-fails the assertion (test-eclipse Phase 4).
7. **Wrist holograms only render during UPGRADE_SELECT** — anything boss-fight
   related (eclipse corruption tint etc.) is invisible there; put the indicator in
   the HUD sprite layer instead. Don't plan features around hidden UI.
8. **Vercel deploy verification**: `git push origin main` triggers deploy; poll
   `gh api repos/CherryCircuit/vr-roguelike/deployments` and boot the live site with
   `node tests/automation/deploy-sim-check.cjs https://spaceomicide.vercel.app`
   (parameterized in `e23f9f6`). Version stamp is auto-generated at build time
   (`scripts/stamp-version.mjs` via vercel.json) in Pacific time.
9. **GLSL reserved words bite silently** — `active` is reserved in GLSL ES 3.00
   (and rejected by some WebGL1 compilers): the threat-compass shader failed to
   compile with `'active' : Illegal use of reserved word` and THREE only logged it
   via the console, while the mesh still rendered black and uniform assertions
   still passed. When a shader "works but is black", dump the FULL console error
   and check for reserved identifiers (`active`, `attribute`, `varying`…).
10. **Port 8000 can be grabbed by other services** — an unrelated uvicorn took it
    mid-session. All suites target :8001 now; before killing a process on a test
    port, check `ps -p <pid>` — it may not be yours.
11. **Proximity slow-mo bleeds test timing** — damage near enemies lerps
    `window._timeScale` down each frame, silently slowing boss/event timers.
    Tests that wait on timed boss phases must force `window._timeScale = 1.0` +
    `game.timeScale = 1.0` continuously (every 200ms) and block enemy spawns
    (`game.spawnTimer = 9999`). Also: buff the test player (`maxHealth = 30`) —
    a 6-HP player dies between health restores and endGame clears the boss.
12. **New enemy/boss integration seams**: spawnEnemy caps can return null (push a
    null slot to keep indices aligned); boss formations flag enemies
    `_conductorHeld`/`_bossSummoned`; hidden-boss body-swaps intercept
    `destroyEnemy` BEFORE the normal death path; `spawnBossProjectile` takes an
    optional damage param; the reflector-drone reflection bug (missing import,
    frame loop froze on first boss-projectile hit) is fixed — keep hostile-projectile
    loop callbacks imported.
13. **Extractions leak moved locals** — after moving module state out of main.js,
    the identifier sweep did NOT flag leftover references (`environmentFadeState`,
    `biomeTerrainMaterials` survived the sweep because they were never window
    globals — they're just gone locals). Only the runtime caught them. After any
    extraction: `rg` EVERY moved name across main.js (both reads and writes), not
    just the identifiers the sweep checks.
14. **init-order breaks are silent in extracted modules** — `applyThemeForLevel(1)`
    ran before `initEnvironment()` and returned early on `!_deps.scene`, so the
    title screen booted black with zero console errors. When an extracted module
    is initialized via `initX(deps)`, audit the CALL ORDER of every module
    function that consumes `_deps` at boot.
15. **Floor Y is a world-coordinate invariant** — all four biome floor surfaces
    are now normalized to world y=0 (floor HUD at 0.0 sits flush; camera eye
    height 1.6; `getBiomeFloorY()` returns 0.0). Never add a per-biome Y offset
    to a biome group again without re-normalizing its floor to 0.0 — the
    stationary player's camera can't follow a moving floor.

## TESTING WORKFLOW (the gate before every commit)

1. Start the server: `python3 -m http.server 8001` (background) — tests hit
   `http://localhost:8001/dev.html`. (:8000 was claimed by an unrelated uvicorn
   service — do NOT kill it; all suites target :8001.)
2. Run each suite individually (~30-90s each, puppeteer headless):
   `node tests/automation/<suite>.cjs` for: test-bugfixes, test-timer-cleanup,
   test-audio-pack, test-elemental, test-synergy, test-tank-hit, test-upgrade-preview,
   test-alchemy, test-evolution, test-dualwield, test-style, test-mastery, test-eclipse,
   test-threat-compass, test-combos, test-bombardier, test-void-anchor,
   test-void-tendril, test-echo-phantom, test-leech, test-conductor, test-maw,
   test-mirror, test-masquerade, test-breach, test-void-marks.
   (26 suites total. Do NOT chain them in one shell loop — see Critical Lessons #2.)
3. Static checks: `node --check <touched files>`,
   `node scripts/verify-module-identifiers.mjs`,
   `node scripts/verify-deploy-assets.mjs` (deploy-affecting changes only).
4. Deploy simulation (when deploy-affecting): copy the exact deployed file set (respect
   .vercelignore) to /tmp, serve on :801x, boot index.html via puppeteer, assert zero
   console errors + zero failed requests + canvas present — or run deploy-sim-check
   against the live URL after pushing. The LIVE launcher (index.html) has no
   `window.__test`/`window.game` — use dynamic imports in sim scripts.
5. Commit one feature per commit, descriptive messages referencing issue numbers.
6. `git push origin main` triggers Vercel deploy (poll GitHub deployments).

## ROADMAP STATUS

**Done:** #204 · #142+#184 · #196 Phases 1-3 · #216 · #211 · #215 · #185 · #143 ·
#189 · #218 · #213 weapon mastery · #172 Eclipse Engine Phase 2 · #206 Threat
Compass · #196 Phases 4-5 (reduced) · deferred combos (#211/#218) · #199 · #198 ·
#171 · #169 · #167 · #170 · #168 · #197 · #200 · #138 · #139 — **everything through
#139, this session** · deploy/stability fixes.

**Remaining (recommended order):** #210 Constellation Map, #212 Lore, #183 Death
Haiku, #209 Death Panorama, #201 Phase Echoes, #178/#177 death effects, #179/#208/
#180 atmosphere, #191 Rhythm Core, #190 Execution Cascade, #188 Void Gauntlet,
#182 Weapon Soul, #155 Prestige Hand, #154/#158/#160 weapon upgrades, #157 Bullet
Weaving, #153 Mutator Cards.

**Closed/merged issue notes:** #217/#213 weapon mastery → keep #213 (done); #214 music →
keep #142; #187/#151 elemental combos → keep #211; #141/#152 scoring → keep #189;
#137/#159 → keep #218; #176 → keep #205; #207 → keep #181; #146/#164 → keep #196;
#195 → merged into #204; #156 → keep #219.

**Note:** `WORKING.md` is stale (2026-04-05, predates the module extraction and all
recent features) — this file is the single source of truth for project state.

## QUICK-START CHECKLIST FOR THE NEXT SESSION

1. `git pull` / verify HEAD is `7825c6c` (see DONE THIS SESSION).
2. `python3 -m http.server 8001 &` then run all 26 test suites individually to
   confirm green baseline (see Testing Workflow).
3. Read `AGENTS.md` if you haven't (auto-loaded; §16-17 cover automation + modules).
4. Pick the next pack (recommended: #210 Constellation Map or #183 Death Haiku —
   the remaining queue is all S-sized items). test-void-marks.cjs is the most recent
   small DI-module + test example; breach-events.js shows the seeded-event pattern.
5. Follow the Testing Workflow above before every commit.
