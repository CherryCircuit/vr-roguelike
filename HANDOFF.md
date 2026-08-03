# SESSION HANDOFF — Feature/Fix Sprint (pick up here with a fresh context)

Paste this whole file's contents (plus `AGENTS.md` is auto-loaded from the repo) into a
new opencode session. Everything below is verified current as of commit `9215aba` (pushed).

---

## WHAT THIS PROJECT IS

**SPACEOMICIDE** — a WebXR VR roguelike FPS (stationary player, dual-wield, synthwave).
No build step (browser ES modules), no npm packages at runtime (THREE/Supabase via CDN
import map in index.html), all audio procedural (Web Audio), all visuals procedural.
Deployed to Vercel from GitHub (repo `CherryCircuit/vr-roguelike`, live at
`spaceomicide.vercel.app`). `AGENTS.md` in the repo root has the project rules —
READ IT. Key rules: no build step, VR perf is critical (72fps), comment code thoroughly,
test incrementally, search online resources before implementing.

## CURRENT MODULE LAYOUT

| File | Lines | Role |
|---|---|---|
| `main.js` | ~6,600 | Game flow/state machine, render loop, input, HUD orchestration, upgrade selection, telemetry |
| `beam-weapons.js` | ~1,340 | Charge cannon + lightning rod (extracted #196 P1) |
| `projectile-system.js` | ~2,100 | Projectile spawn/update/hit pipeline, instanced pools, accuracy, explosions, **screenFx** (extracted #196 P2) |
| `alt-weapons.js` | ~3,630 | All 20 alt weapons + pools (extracted #196 P3) |
| `enemies.js` | ~12,200 | Enemies, bosses, status effects, **synergy elemental behaviors** (never extracted; oldest module) |
| `weapons.js` | ~710 | Weapon/upgrade defs, `getWeaponStats`, **`detectSynergies`** |
| `game.js` | ~543 | Central state (`game` object incl. `game.synergies`), resetGame, hooks |
| `audio.js`, `hud.js`, `damage-numbers.js`, `voxel-debris.js`, `stasis.js`, `boss-death-cinematic.js` | | Supporting modules |

**Cross-module cycles (intentional, documented in code, runtime-only usage — valid in
native ES modules):** beam-weapons ↔ projectile-system, projectile-system ↔ alt-weapons,
beam-weapons ↔ enemies (chain arc import), enemies → weapons (synergy).

## DONE THIS SESSION (chronological, all pushed to `main`)

1. **`89d58d2` — Audio pack (#142 reactive 4-stem music layer + #184 threat spatial audio)**
   - Hybrid per user choice: procedural stems (ambient pad/percussion/melody/intensity)
     layered OVER the CDN soundtrack; BPM glides 100/120/140/160 by intensity state;
     ducks outside PLAYING. `startReactiveMusic()` at init, per-frame
     `updateReactiveMusic({playing, enemyCount, bossActive, comboMultiplier, lowHealth})`.
   - Threat audio: pooled HRTF PannerNodes per enemy type (8 profiles in
     `THREAT_PROFILES`), listener synced to camera each frame, cap 10 emitters.
   - New file `tests/automation/test-audio-pack.cjs`.

2. **`0e08005` — Refactor #196 Phase 1: beam-weapons.js** (charge cannon + lightning rod
   + pending-timer registry + `getHandForController`). Dependency-injection pattern:
   `initBeamWeapons(deps)` called from main.js init (mirrors `initBossDeathCinematic`).

3. **`252d8b4` — Refactor #196 Phase 2: projectile-system.js** (spawn/update/hit,
   instanced pools, accuracy, explosions, hostile cache, debris glow, seeker queue).
   `initProjectileSystem(deps)`. Live-binding exports: `projectiles`,
   `explosionVisuals`, `explosionPool`, `instancedProjectiles`, `seekerBurstQueue`,
   `playerProjectileMaterials`, `_hostileProjectilesInArray`.

4. **`7c67a03` — Refactor #196 Phase 3: alt-weapons.js** (all 20 weapons).
   `initAltWeapons(deps)`. Exports all `active*` arrays + update fns.
   (`939e869` cleanup: test screenshots gitignored.)

5. **`87ebb5e` — #216 Elemental Ammo: lightning chain + verification** — discovered the
   elemental system (fire/freeze/shock upgrades, DoT, slows, status VFX pool, status
   bubbles) was already ~90% built. Added the missing **shock chain** mechanic
   (`chainShockToNearbyEnemy` in enemies.js, 15 dmg/stack to nearest enemy within 6m,
   transient bolt arc). Fixed latent `explosionVisuals` bug in beam-weapons.
   New test `test-elemental.cjs`.

6. **`c16c4af` — #211 Synergy Engine** — `detectSynergies(upgrades)` in weapons.js,
   `game.synergies` snapshot recomputed by main.js `recomputeSynergies()` on every
   upgrade pick + init, per-run "NEW SYNERGY DISCOVERED" toast. Elemental combos in
   enemies.js: **Thermal Shock** (frozen + fire DoT → shatter, 50% maxHP AoE 3m),
   **Plasma Arc** (electrified burn 2x faster; fire spreads via chains), **Cryo-Conduction**
   (shock+freeze enemies emit 3m 30% slow aura), **PRIME STATE** (3x status damage;
   chains to ALL non-statused enemies in range, cap 6). Stat synergies in
   getWeaponStats: **Lethal Precision** (crit 3x), **Blood Letter** (heal every 3 kills).
   Dev test hook `window.__test.recomputeSynergies`. New test `test-synergy.cjs`.

7. **Deploy fixes** (`d960a45`, `2165fdd`, `df0fe6d`, `8b8550e`, `01c5cd3`):
   - Version text was hand-baked in index.html AND clobbered at runtime by
     `launcher-common.js` GAME_VERSION → now auto-stamped by Vercel build command
     (`scripts/stamp-version.mjs` via vercel.json `buildCommand` + `outputDirectory "."`)
     and launcher-common only fills in if empty.
   - `.vercelignore` was excluding files the game needs at runtime (bake-clouds.js 404
     broke the game on prod). Added `scripts/verify-deploy-assets.mjs` — checks every
     relative import/index.html reference resolves inside the deployed file set.
   - `.vercelignore` pitfalls learned: buildCommand files must NOT be ignored; setting
     buildCommand makes Vercel require explicit `outputDirectory`.

8. **`8240c4a` — PRODUCTION CRASH FIX**: `_uiRaycaster is not defined` on tank weak-point
   hits (user-reported). My Phase-2 identifier sweep had filtered `_ui`-prefixed names as
   noise. Fixed via `uiRaycaster` dep + null guard. New test `test-tank-hit.cjs` (spawns
   real tank at level 4, shoots through the weak-point raycast path).

9. **`9215aba` — Hidden-coupling audit** (current HEAD): new static checker
   `scripts/verify-module-identifiers.mjs` found 6 latent bugs in the extracted modules:
   - `State` not imported in beam-weapons (triple-shot guard crashed on live site only —
     dev tests masked it via `window.State`; SAME trap as the version-text bug)
   - `cameraShake`/`cameraShakeIntensity`/`originalCameraPos`/`floorFlashing`/
     `floorFlashTimer` referenced from beam-weapons + projectile-system but owned by
     main.js → refactored to a shared **`screenFx`** object exported from
     projectile-system
   - `BIG_BOOM_COOLDOWN_MS`/`lastExplodingShotTime` moved into projectile-system
   - `damagePlayer` silently no-opped in projectile-system (typeof guard) → now imported
     from game.js
   - `_evoV3a` never declared in alt-weapons (drone homing crash) → declared

## CRITICAL LESSONS (do not relearn these the hard way)

1. **ES module imported bindings are READ-ONLY even for `export let`** — importers CANNOT
   assign to them (both Node and Chrome throw "Assignment to constant variable"). Shared
   mutable state between modules must be a **shared object whose properties are mutated**
   (the `screenFx` pattern). If a test passes in dev but a binding assignment fails, check
   this first.
2. **Dev environment masks prod-only bugs**: dev.html sets `window.State`, `window.game`,
   `window.__test` (testAPI). Free identifiers like `State` resolve via `window` in dev
   but throw on the live site. Always ask "does this reference a dev-only global?" after
   extracting code.
3. **Identifier sweep filters are dangerous** — the `_ui` filter hid the `_uiRaycaster`
   crash. Now automated: run `scripts/verify-module-identifiers.mjs` on any touched module.
4. **Test coverage must match the feature**: tank weak points need a tank test, elemental
   effects need elemental tests, etc. The 6 test files below each cover a real gameplay
   path — extend them rather than trusting generic smoke tests.
5. **Vercel + .vercelignore gotchas**: ignored files are absent during the build (build
   commands need their files un-ignored); adding a buildCommand requires
   `outputDirectory`; always verify the deployed asset set with
   `verify-deploy-assets.mjs` before pushing deploy-affecting changes, and boot the game
   from the simulated deployed set (see Testing).
6. **Vercel deploy date**: the version stamp runs at build time; stale dates in browsers
   are usually browser cache, but check launcher-common.js isn't overwriting (fixed).
7. **module.exports vs ESM**: all files are browser ESM with relative imports; bare
   specifiers (three) resolve via the import map in index.html (and __repro.html-style
   test pages must include the import map).

## TESTING WORKFLOW (the gate before every commit)

1. Start the server: `python3 -m http.server 8000` (background) — tests hit
   `http://localhost:8000/dev.html`.
2. Run ALL suites (each ~30-90s, puppeteer headless):
   - `node tests/automation/test-bugfixes.cjs` — boots game, 15s gameplay, reset loop
   - `node tests/automation/test-timer-cleanup.cjs` — charge cannon + triple-shot timer
   - `node tests/automation/test-audio-pack.cjs` — reactive music stems + threat emitters
   - `node tests/automation/test-elemental.cjs` — fire DoT / shock chain / freeze
   - `node tests/automation/test-synergy.cjs` — all 4 elemental combos + stat synergies
   - `node tests/automation/test-tank-hit.cjs` — tank weak-point raycast path
3. Static checks: `node --check <files>`, `node scripts/verify-module-identifiers.mjs`,
   `node scripts/verify-deploy-assets.mjs`.
4. Deploy simulation (when deploy-affecting): copy the exact deployed file set
   (respect .vercelignore) to /tmp, serve on :801x, boot index.html via puppeteer, assert
   zero console errors + zero failed requests + canvas present. Note: the LIVE launcher
   (index.html) has no `window.__test`/`window.game` — use dynamic imports
   (`await import('./game.js')`) in sim scripts instead.
5. Commit one feature per commit, descriptive messages referencing issue numbers.
6. `git push origin main` triggers Vercel deploy (check GitHub checks after).

## ROADMAP STATUS

**Done:** #204 timer cleanup · #142+#184 audio pack · #196 Phases 1-3 (refactor) ·
#216 elemental ammo · #211 synergy engine · deploy/stability fixes.

**Remaining packs (recommended order):**
1. **#215 Upgrade Card Preview + #185 Upgrade Alchemy** (upgrade screen pack, M) —
   builds directly on the synergy system (card previews should show synergy hints, which
   #211 explicitly wants). Both touch the upgrade-card UI in main.js/hud.js.
2. **#143 Weapon Evolution** (L) — transform weapons via recipes; triggers at card
   selection.
3. **#189 Bullet Carnival + #218 Dual-Wield Combos** (combat feel pack, L).
4. **#213 Weapon Mastery** (L) — cross-run progression (new module, localStorage).
5. **#172 Eclipse Engine Phase 2** (M).
6. **#206 Threat Compass** (S) — quick standalone win, any time.
7. **#196 Phases 4-5** (game flow/input + environment extraction) — lower value; main.js
   is now mostly flow orchestration.

**Deferred within #211 (flagged in commit):** weapon-specific combos (Tesla Tower, Final
Solution, Swarm Leader), kill-chain combos (Soul Chain, Pinball Wizard, Momentum), HUD
icon glow. **Back of the line (from earlier triage):** new enemies/bosses (#199, #198,
#171, #169, #167, #170, #168, #197, #200), #138 Breach Events, #139 Void Marks, #210
Constellation Map, #212 Lore, #183 Death Haiku, #209 Death Panorama, #201 Phase Echoes,
#178/#177 death effects, #179/#208/#180 atmosphere, #191 Rhythm Core, #190 Execution
Cascade, #188 Void Gauntlet, #182 Weapon Soul, #155 Prestige Hand, #154/#158/#160 weapon
upgrades, #157 Bullet Weaving, #153 Mutator Cards.

**Closed/merged issue notes:** #217/#213 weapon mastery → keep #213; #214 music → keep
#142; #187/#151 elemental combos → keep #211; #141/#152 scoring → keep #189; #137/#159 →
keep #218; #176 → keep #205; #207 → keep #181; #146/#164 → keep #196; #195 → merged into
#204; #156 → keep #219.

## QUICK-START CHECKLIST FOR THE NEXT SESSION

1. `git pull` / verify HEAD is `9215aba`.
2. `python3 -m http.server 8000 &` then run all 6 test suites to confirm green baseline.
3. Read `AGENTS.md` if you haven't (auto-loaded).
4. Pick the next pack (recommended: #215+#185 upgrade screen pack) and explore the
   upgrade-card flow in main.js (`showUpgradeScreen`, `finalizeUpgradeSelection`,
   `selectUpgradeAndAdvance`, hud.js card rendering) before writing code.
5. Follow the Testing Workflow above before every commit.
