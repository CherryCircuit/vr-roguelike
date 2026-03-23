# Branch preservation manifest — 2026-03-23

Preserved boss-history refs before branch cleanup. Tags are immutable archive anchors; branches are intentionally kept for now.

## Preserved boss refs

| Ref | Commit | Archive tag | Subject |
|---|---|---|---|
| `feature/96-merge-bosses` | `f83d1ec92e87` | `archive/boss-feature-96-merge-bosses-2026-03-23` | feat: implement all 20 boss fights across 4 tiers (#96) |
| `origin/openclaw-feb26` | `b8b8bd674183` | `archive/boss-openclaw-feb26-2026-03-23` | Merge pull request #101 from CherryCircuit/feature/96-merge-bosses |
| `origin/feature/93-performance-monitoring-object-pooling` | `a4dda69e9cce` | `archive/boss-feature-93-perf-pooling-2026-03-23` | feat: implement automated performance monitoring with object pooling (#93) |
| `origin/issue-32-level20-bosses` | `51b741fe0767` | `archive/boss-issue-32-level20-bosses-2026-03-23` | feat: Implement 5 Level 20 final bosses |
| `origin/issue-27-fix-teleport-boss` | `da9378849a9d` | `archive/boss-issue-27-fix-teleport-boss-2026-03-23` | feat: implement improved teleporting boss mechanics (#27) |
| `origin/feature/65-boss-framework` | `40fff3c0130b` | `archive/boss-feature-65-boss-framework-2026-03-23` | feat: implement Boss Framework with new boss types (#65) |
| `origin/feature/19-boss-death-effects` | `2abb1b5d1a3c` | `archive/boss-feature-19-boss-death-effects-2026-03-23` | feat: boss death effects - music stop, death sound, voxel physics (#19) |

## Kept branches after cleanup target

- `feature/96-merge-bosses`
- `gh-pages`
- `main`
- `origin/HEAD`
- `origin/feature/19-boss-death-effects`
- `origin/feature/65-boss-framework`
- `origin/feature/93-performance-monitoring-object-pooling`
- `origin/feature/96-merge-bosses`
- `origin/gh-pages`
- `origin/issue-27-fix-teleport-boss`
- `origin/issue-32-level20-bosses`
- `origin/main`
- `origin/openclaw-feb26`

## Delete candidates executed in this cleanup

### Local branches to delete

### Remote branches to delete from origin
- `origin/CherryCircuit/webxr-synthwave-demo` at `6dbd8c3`: feat: Major gameplay improvements - bosses, UI feedback, combat balance
- `origin/GLM-5-time` at `8f3107c`: Tried editing some code without bots
- `origin/docs/brain-dump-docs` at `af9e496`: docs: add AGENTS.TLDR.md, PROJECT_CONTEXT.md, TASK_INBOX.md, DECISIONS.md
- `origin/feature/102-fix-runtime-errors` at `a933bf2`: fix: resolve runtime errors - missing imports and variable scope (#102)
- `origin/feature/107-fix-aurora-sky` at `db84f3d`: fix: Make aurora/sky effects visible (#107)
- `origin/feature/108-fix-button-hover` at `ac879d2`: fix: Button hover effects and sound now work with both controllers (#108)
- `origin/feature/109-restore-kills-alerts` at `1672d1d`: fix: Restore "kills remaining" alerts (#109)
- `origin/feature/111-fix-upgrade-cards` at `28c1ea5`: fix: Upgrade cards - restore proper text sizes and fix glow clipping (#111)
- `origin/feature/111-upgrade-cards-fix` at `0a4bdb9`: fix: Upgrade cards - restore proper text sizes and fix glow clipping
- `origin/feature/112-keyboard-upgrade-selection` at `f502404`: fix: Enable keyboard/mouse upgrade selection (#112)
- `origin/feature/113-verify-upgrade-system` at `75c7494`: docs: Add upgrade system verification report (#113)
- `origin/feature/114-fix-scoreboard` at `a42485c`: fix: Improve scoreboard error handling and add configuration validation (#114)
- `origin/feature/14-fps-monitor` at `f2884a3`: feat: implement WebXR FPS monitor with debug menu toggle (#14)
- `origin/feature/15-debug-menu-improvements` at `081a8ca`: feat: improve DEBUG menu with diagnostic info (#15)
- `origin/feature/28-boss-framework` at `e08d16f`: feat: Boss system refactor - create framework with telegraphing (#28)
- `origin/feature/30-level10-bosses` at `89844ed`: feat: Implement 5 Level 10 bosses with unique mechanics (#30)
- `origin/feature/31-level-15-bosses` at `67fa5f5`: feat: implement 5 Level 15 TOUGH bosses (#31)
- `origin/feature/43-weapon-architecture` at `f2057db`: docs: Weapon system architecture design (#43)
- `origin/feature/44-boss-architecture` at `40d5110`: feat: Complete MAIN/ALT/UPGRADE weapon system integration (#33)
- `origin/feature/78-fix-js-syntax` at `5bd1f5b`: fix: resolve merge conflict - keep main branch version
- `origin/feature/89-alt-fire-tutorial` at `dfac37c`: feat: Add alt fire tutorial system with improved visuals and HUD (#89)
- `origin/feature/93-performance-monitoring` at `0504581`: feat: integrate performance monitoring and add desktop controls testing
- `origin/fix/102-runtime-errors` at `b4d0ac6`: fix: resolve runtime errors preventing game from loading
- `origin/fix/105-charge-beam-fix` at `836c3fa`: fix: Remove duplicate beamInner/beamOuter references in onTriggerRelease
- `origin/fix/106-post-level-text` at `518e900`: fix: post-level text not appearing (#106)
- `origin/fix/109-kills-remaining-alerts` at `3819c66`: fix: restore kills remaining alerts visibility in VR (#109)
- `origin/fix/110-hud-kill-count` at `94f5abf`: fix: HUD kill count showing 14/15 instead of 15/15 (#110)
- `origin/fix/110-reapply-hud-fix` at `9337b73`: fix: Upgrade cards - restore proper text sizes and fix glow clipping
- `origin/fix/113-upgrade-overhaul-syntax` at `069fbe6`: fix: upgrade overhaul syntax error - missing closing bracket for UPGRADE_POOL array (#113)
- `origin/fix/115-showReadyScreen-import` at `aae8ba9`: fix: showReadyScreen undefined error in debugJumpToLevel (#115)
- `origin/fix/13-scoreboard-performance` at `ed42b5b`: fix: optimize scoreboard and country select screen performance (#13)
- `origin/fix/78-syntax-errors` at `d9464dd`: fix: add missing playBossTeleportDisappear function to audio.js
- `origin/fix/80-zombie-worker-detection` at `75ee253`: docs: add zombie worker diagnostic script and fix documentation for #80
- `origin/fix/84-code-review-verification` at `5399194`: fix: correct import syntax in main.js (enable as enableDesktop)
- `origin/fix/87-weapon-upgrade-filter` at `aa0a58e`: fix: Filter weapon-specific upgrades for all weapon types (#87)
- `origin/fix/88-charge-gun-improvements` at `dbe3db8`: fix: charge gun improvements for issue #88
- `origin/fix/89-alt-fire-tutorial` at `241ec3d`: feat: add alt weapon tutorial foundation (partial #89)
- `origin/fix/94-score-display-update` at `c6cb455`: fix: Restore broken functions to fix HUD score display
- `origin/fix/95-upgrade-card-font-size` at `80d28ee`: fix: Reduce upgrade card font size to prevent text overflow (#95)
- `origin/issue-11-scoreboard-padding` at `b8c69f9`: feat: add padding to Scoreboard and Diagnostics buttons on main menu
- `origin/issue-16-desktop-controls` at `46484f6`: feat: implement keyboard/mouse desktop controls (#16)
- `origin/issue-17-level-transition-fade` at `425b7a6`: fix: implement sound effect matching sfxr parameters exactly
- `origin/issue-18-level-intro` at `6c812e3`: feat: implement level intro sequence before each standard level
- `origin/issue-20-kills-alert` at `754b045`: feat: improve kills remaining alert positioning and sound
- `origin/issue-21-kills-threshold` at `de74e7e`: feat: change kills remaining alert threshold to 10 at level 11+
- `origin/issue-22-levelup-hud` at `0c596cf`: fix: show HUD during UPGRADE_SELECT state (actual level-up screen)
- `origin/issue-23-hover-sound` at `501791d`: fix: add dual-controller hover detection in PLAYING state
- `origin/issue-24-lowhealth-alert` at `ec5d7bb`: fix: complete sfxr parameters and fix floor pulse/hit flash conflict
- `origin/issue-25-tank-weak-point` at `a8c4fde`: feat: Add weak point visual indicator to tank enemies
- `origin/issue-26-aurora-skydome` at `b40d87f`: feat: Add animated aurora borealis sky-dome effect
- `origin/issue-34-main-weapons` at `ee88f8c`: feat: Add 6 main weapons with specific upgrades
- `origin/issue-35-alt-weapons` at `5f7d88a`: feat: Add 6 ALT WEAPONS with cooldown system
- `origin/issue-36-universal-upgrades` at `2424ae4`: feat: Implement 6 universal upgrades (issue #36)
- `origin/issue-37-boss-upgrades` at `f7b9c44`: feat: Implement boss-specific special upgrades (RARE/EPIC/ULTRA)
- `origin/issue-8-fix-kills-counter` at `8052b43`: fix: reset level config and fix kills counter display (#8)
- `origin/last-working` at `dee903b`: REVERT PHASE 1 CHANGES ALTOGETHER MOTHER
- `origin/merge-weapons-from-babylon` at `9b425a4`: feat: Implement Mega Man-style charge shot system with audio and visual effects
- `origin/noclue` at `acdf548`: fix: Update HUD positions and rotations for VR elements; adjust proximity alert system and slow-mo mechanics
- `origin/verify/84-js-syntax` at `ee6214d`: docs: verify JavaScript syntax errors fixed for issue #84
- `origin/verify/94-score-display-fixed` at `fe871ba`: Merge pull request #90 from CherryCircuit/fix/87-weapon-upgrade-filter
- `origin` at `a9abf3f`: fix: restore desktop controls (WASD + mouse) in render loop

