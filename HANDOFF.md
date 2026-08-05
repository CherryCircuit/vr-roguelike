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
| `game.js` | ~616 | Central state (`game` object incl. `game.synergies`), resetGame, hooks |
| `audio.js`, `hud.js`, `damage-numbers.js`, `voxel-debris.js`, `stasis.js`, `boss-death-cinematic.js` | | Supporting modules |

**Cross-module cycles (intentional, documented in code, runtime-only usage — valid in
native ES modules):** beam-weapons ↔ projectile-system, projectile-system ↔ alt-weapons,
beam-weapons ↔ enemies (chain arc import), enemies → weapons (synergy).

## DONE THIS SESSION (chronological, all pushed to `main`)

A marathon session — every commit below is verified with its own puppeteer suite
(now 26 total) + the deploy-sim gate. All live at spaceomicide.vercel.app.

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
