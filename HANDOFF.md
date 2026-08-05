# SESSION HANDOFF — Feature/Fix Sprint (pick up here with a fresh context)

Paste this whole file's contents (plus `AGENTS.md` is auto-loaded from the repo) into a
new opencode session. Everything below is verified current as of commit `c355a56` (pushed).

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
| `game.js` | ~616 | Central state (`game` object incl. `game.synergies`), resetGame, hooks |
| `audio.js`, `hud.js`, `damage-numbers.js`, `voxel-debris.js`, `stasis.js`, `boss-death-cinematic.js` | | Supporting modules |

**Cross-module cycles (intentional, documented in code, runtime-only usage — valid in
native ES modules):** beam-weapons ↔ projectile-system, projectile-system ↔ alt-weapons,
beam-weapons ↔ enemies (chain arc import), enemies → weapons (synergy).

## DONE THIS SESSION (chronological, all pushed to `main`)

1. **`<TBD-COMMIT>` — #206 Threat Compass** (ground glow; current HEAD): a subtle
   pulsing glow on the floor beneath the player that shifts toward the nearest
   dangers — diegetic spatial awareness for VR (no minimap/arrow UI).
   - **New module `threat-compass.js`** (`initThreatCompass(deps)` DI pattern, §17):
     8m disc on the biome floor, custom ShaderMaterial. Up to 8 gaussian lobes
     (angle+intensity) computed each frame from the live enemy list via a scratch
     `Float32Array` insertion sort — zero per-frame allocations (VR-CRITICAL).
   - **Shader**: fixed-size loop (no `break` — WebGL1/2-safe on Quest; the GLSL
     reserved word `active` broke compile, renamed to `lobeGate`); amber→red color
     ramp by closest-threat intensity; pulse speed scales with closeness; alpha
     capped 0.35.
   - **Integration** (main.js): init at boot; per-frame update in the PLAYING
     branch after the enemy/spatial-hash pass; `setThreatCompassVisible(st ===
     PLAYING)` each frame (hidden on title/upgrades/pause/game-over); mesh tracks
     camera XZ + `getBiomeFloorY()`; biome tint via `setThreatCompassTheme(biomeId)`
     in `applyThemeForLevel` (synthwave pink / desert blue-white / alien toxic
     green / hellscape volcanic orange).
   - **Audio synergy NOT needed**: #184 threat spatial audio already covers the
     audio warning layer — no new sounds.
   - New test `test-threat-compass.cjs` (mesh exists + visible in PLAYING, hidden
     in PAUSED + restores, lobe count/angles/intensity ordering vs real enemy
     positions, zero-lobe case, biome tint, zero console errors). Verified: all 14
     suites green, deploy-sim clean on :8016, verify-deploy-assets resolves
     threat-compass.js.

## RECENTLY COMPLETED (prior sessions, all on `main`)

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

## TESTING WORKFLOW (the gate before every commit)

1. Start the server: `python3 -m http.server 8000` (background) — tests hit
   `http://localhost:8000/dev.html`.
2. Run each suite individually (~30-90s each, puppeteer headless):
   `node tests/automation/<suite>.cjs` for: test-bugfixes, test-timer-cleanup,
   test-audio-pack, test-elemental, test-synergy, test-tank-hit, test-upgrade-preview,
   test-alchemy, test-evolution, test-dualwield, test-style, test-mastery, test-eclipse,
   test-threat-compass.
   (14 suites total. Do NOT chain them in one shell loop — see Critical Lessons #2.)
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
#189 · #218 · #213 weapon mastery · #172 Eclipse Engine Phase 2 · **#206 Threat
Compass (this session)** · deploy/stability fixes.

**Remaining packs (recommended order):**
1. **#196 Phases 4-5** (game flow/input + environment extraction) — lower value; main.js
   is now mostly flow orchestration.
2. **Deferred combos (flagged in #211/#218 commits)**: weapon-specific combos (Tesla
   Tower, Final Solution, Swarm Leader), kill-chain combos (Soul Chain, Pinball Wizard,
   Momentum), HUD icon glow.
3. **Back of the line (from earlier triage):** new enemies/bosses (#199, #198, #171,
   #169, #167, #170, #168, #197, #200), #138 Breach Events, #139 Void Marks, #210
   Constellation Map, #212 Lore, #183 Death Haiku, #209 Death Panorama, #201 Phase
   Echoes, #178/#177 death effects, #179/#208/#180 atmosphere, #191 Rhythm Core, #190
   Execution Cascade, #188 Void Gauntlet, #182 Weapon Soul, #155 Prestige Hand,
   #154/#158/#160 weapon upgrades, #157 Bullet Weaving, #153 Mutator Cards.

**Closed/merged issue notes:** #217/#213 weapon mastery → keep #213 (done); #214 music →
keep #142; #187/#151 elemental combos → keep #211; #141/#152 scoring → keep #189;
#137/#159 → keep #218; #176 → keep #205; #207 → keep #181; #146/#164 → keep #196;
#195 → merged into #204; #156 → keep #219.

**Note:** `WORKING.md` is stale (2026-04-05, predates the module extraction and all
recent features) — this file is the single source of truth for project state.

## QUICK-START CHECKLIST FOR THE NEXT SESSION

1. `git pull` / verify HEAD is the #206 commit (see DONE THIS SESSION).
2. `python3 -m http.server 8000 &` then run all 14 test suites individually to confirm
   green baseline (see Testing Workflow).
3. Read `AGENTS.md` if you haven't (auto-loaded; §16-17 cover automation + modules).
4. Pick the next pack (recommended: #196 Phases 4-5, or a deferred combo from
   #211/#218 — the remaining queue is all lower-value extraction/polish items).
   threat-compass.js is the most recent example of a small self-contained
   `initX(deps)` module with a shader + scratch buffers.
5. Follow the Testing Workflow above before every commit.
