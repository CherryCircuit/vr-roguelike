# SESSION HANDOFF — Feature/Fix Sprint (pick up here with a fresh context)

Paste this whole file's contents (plus `AGENTS.md` is auto-loaded from the repo) into a
new opencode session. Everything below is verified current as of commit `de882a3` (pushed).

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
| `game.js` | ~616 | Central state (`game` object incl. `game.synergies`), resetGame, hooks |
| `audio.js`, `hud.js`, `damage-numbers.js`, `voxel-debris.js`, `stasis.js`, `boss-death-cinematic.js` | | Supporting modules |

**Cross-module cycles (intentional, documented in code, runtime-only usage — valid in
native ES modules):** beam-weapons ↔ projectile-system, projectile-system ↔ alt-weapons,
beam-weapons ↔ enemies (chain arc import), enemies → weapons (synergy).

## DONE THIS SESSION (chronological, all pushed to `main`)

1. **`<TBD-COMMIT>` — #172 Eclipse Engine Phase 2** (upgrade corruption; current HEAD):
   the final boss now corrupts your upgrades during the back half of the fight.
   - **New module `eclipse.js`** (`initEclipseSystem(deps)` DI pattern, §17): effect
     defs, active-eclipse state, pure `applyEclipseToStats(stats, eclipseIds)`
     transform (no-op same-ref when clean), self-damage drains, purge. Never imports
     game state — all deps injected.
   - **Boss layer in `EclipseEngineBoss`** (enemies.js): SEPARATE from the existing
     phase 1/2/3 structure — activates at 50% HP on top of the current phase
     (purple shell tint while active). Escalation: 50-33% = 12s/10s/1 stack,
     33-14% = 10s/10s/2, last stand <14% = 8s/12s/2. SHOCK status hits on the boss
     extend the interval +3s for 4s (counterplay). Purges on boss death/destroy.
   - **Effects (eclipsable = universal stat upgrades only, never mastery cards or
     weapon-specific)**: damage upgrades → 30% damage penalty; barrel/turbo → 70%
     slower fire; double/triple shot → projectiles halve + veer 14-34° random
     (stats.eclipsedScatter read in fireMainWeapon); crit → 15% of crits reflect 1
     HP back at the player (projectile-system handleHit/handleBossHit) and lose
     the crit; pierce/overcharge → piercing sealed; vampiric/life_steal → no
     healing + 1 HP drain/2s; fire/shock/freeze → status ammo stripped + 1 HP
     drain/2s (capped 2/tick ≈ 1 dmg/s max).
   - **Fire pipeline**: `computeWeaponStats(hand)` wrapper in main.js replaces all 9
     fire-time `getWeaponStats` call sites; beams/charge/evolved weapons receive the
     same corrupted stats. Alt weapons (nukes, shields…) are intentionally NOT
     covered.
   - **HUD**: `showEclipseWarning`/`updateEclipseWarning`/`hideEclipseWarning`
     sprite banner on its own camera-attached group with 1s-countdown re-render
     (not the issue's DOM sketch — VR HUD is all sprites). Purge = white
     `triggerStyleFlash` + bright pop sound.
   - **Audio**: 4 new procedural sounds in audio.js (`playEclipsePhase2StartSound`,
     `playEclipseCorruptSound`, `playEclipsePurgeSound`, `playEclipseSelfDamageSound`).
     No continuous drone loop — looping oscillators add frame-budget risk for
     marginal payoff.
   - **Wrist-hologram corruption tint SKIPPED** (deviation from plan): wrist
     holograms only render during UPGRADE_SELECT, never during the boss fight, so
     the tint would have been dead code. The corrupted-upgrade indicator lives in
     the HUD warning banner instead.
   - New test `test-eclipse.cjs` (pure transform + purity, pickEclipseTarget,
     50% HP trigger, scheduler auto-trigger, escalation, shock window, purge on
     destroy, real fired-projectile damage 25↔35 revert, HUD visibility/countdown/
     expiry, drains, crit reflect). Verified: all 13 suites green (test-evolution
     flaked once, green on solo re-run — known quirk), deploy-sim clean on :8015,
     verify-deploy-assets resolves eclipse.js.

## RECENTLY COMPLETED (prior sessions, all on `main`)

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

## TESTING WORKFLOW (the gate before every commit)

1. Start the server: `python3 -m http.server 8000` (background) — tests hit
   `http://localhost:8000/dev.html`.
2. Run each suite individually (~30-90s each, puppeteer headless):
   `node tests/automation/<suite>.cjs` for: test-bugfixes, test-timer-cleanup,
   test-audio-pack, test-elemental, test-synergy, test-tank-hit, test-upgrade-preview,
   test-alchemy, test-evolution, test-dualwield, test-style, test-mastery, test-eclipse.
   (13 suites total. Do NOT chain them in one shell loop — see Critical Lessons #2.)
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
#189 · #218 · #213 weapon mastery · **#172 Eclipse Engine Phase 2 (this session)** ·
deploy/stability fixes.

**Remaining packs (recommended order):**
1. **#206 Threat Compass** (S) — quick standalone win, any time.
2. **#196 Phases 4-5** (game flow/input + environment extraction) — lower value; main.js
   is now mostly flow orchestration.
3. **Deferred combos (flagged in #211/#218 commits)**: weapon-specific combos (Tesla
   Tower, Final Solution, Swarm Leader), kill-chain combos (Soul Chain, Pinball Wizard,
   Momentum), HUD icon glow.
4. **Back of the line (from earlier triage):** new enemies/bosses (#199, #198, #171,
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

1. `git pull` / verify HEAD is the #172 commit (see DONE THIS SESSION).
2. `python3 -m http.server 8000 &` then run all 13 test suites individually to confirm
   green baseline (see Testing Workflow).
3. Read `AGENTS.md` if you haven't (auto-loaded; §16-17 cover automation + modules).
4. Pick the next pack (recommended: #206 Threat Compass — the last S-sized standalone
   win). Explore the eclipse.js DI pattern + EclipseEngineBoss corruption layer as the
   most recent boss-flow reference before writing code.
5. Follow the Testing Workflow above before every commit.
