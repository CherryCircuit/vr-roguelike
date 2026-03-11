# TASK_INBOX.md - SPACEOMICIDE Task Backlog

> Living document of all pending tasks. Synced with GitHub Issues.

## Status Legend

- 🔴 **Planning** - Needs review before starting
- 🟡 **To Do** - Ready to pick up
- 🟢 **Doing** - In progress
- 🔵 **To Test** - Dev complete, needs QA
- 🟣 **To Improve** - Needs refinement

---

## Critical Blockers

These prevent further development or autonomous testing:

| ID | Title | Status | Priority |
|----|-------|--------|----------|
| #16 | Enable keyboard/mouse controls for bot testing | Planning | 🔴 CRITICAL |
| #14 | Implement FPS monitor for debugging | Planning | 🔴 HIGH |
| #9 | Fix transparency black box overlay | Planning | 🔴 HIGH |
| #10 | Investigate dual blaster performance degradation | Planning | 🔴 HIGH |

---

## Bugs

| ID | Title | Status | Impact |
|----|-------|--------|--------|
| #7 | Fix score display on floor HUD | Planning | Medium |
| #8 | Fix floor HUD kills counter (X/Y) | Planning | Medium |
| #9 | Fix transparency black box overlay | Planning | High |
| #10 | Investigate dual blaster performance | Planning | High |

---

## UI/UX

| ID | Title | Status | Notes |
|----|-------|--------|-------|
| #11 | Add padding to Scoreboard button | Planning | Cosmetic |
| #22 | Add health/score to level-up screen | Planning | |
| #23 | Improve button hover sound + both controllers | Planning | |
| #20 | Improve "kills remaining" alert position + sound | Planning | |

---

## Audio/Visual

| ID | Title | Status | Notes |
|----|-------|--------|-------|
| #17 | Implement level transition (sound + fade) | Planning | |
| #18 | Implement LEVEL INTRO sequence | Planning | |
| #19 | Boss death effects (music stop, voxel physics) | Planning | |
| #24 | Low health pulsing alert (1/2 heart) | Planning | |
| #26 | Aurora borealis sky-dome effect | Planning | Performance risk |

---

## Gameplay

| ID | Title | Status | Notes |
|----|-------|--------|-------|
| #21 | Change "5 kills remaining" to 10 at L11+ | Planning | |
| #25 | Add weak point to tank enemies | Planning | |

---

## Features

| ID | Title | Status | Notes |
|----|-------|--------|-------|
| #12 | Fix Supabase scoreboard (enable writes) | Planning | |
| #13 | Fix scoreboard screen choppy performance | Planning | |
| #15 | Improve DEBUG menu with diagnostics | Planning | |

---

## Boss System Overhaul

**Parent Issue: #28 (Boss Framework)**

| ID | Title | Status | Dependencies |
|----|-------|--------|--------------|
| #27 | Fix and improve teleporting boss | Planning | None |
| #28 | Refactor boss system - remove old bosses | Planning | #27 |
| #29 | Implement Level 5 bosses (5 unique) | Planning | #28 |
| #30 | Implement Level 10 bosses (5 harder) | Planning | #28, #29 |
| #31 | Implement Level 15 bosses (5 tough) | Planning | #28, #30 |
| #32 | Implement Level 20 bosses (5 final) | Planning | #28, #31 |

**Total: 20 new bosses across 4 levels**

---

## Weapon System Overhaul

**Parent Issue: #33 (Weapon Architecture)**

| ID | Title | Status | Dependencies |
|----|-------|--------|--------------|
| #33 | Refactor weapon system (MAIN/ALT/UPGRADE) | Planning | None |
| #34 | Implement 6 MAIN WEAPONS + upgrades | Planning | #33 |
| #35 | Implement 6 ALT WEAPONS + cooldowns | Planning | #33 |
| #36 | Implement universal + weapon-specific upgrades | Planning | #33 |
| #37 | Implement boss special upgrades (RARE/EPIC/ULTRA) | Planning | #33, #28-32 |
| #38 | Fix charge cannon visuals + scaling | Planning | Standalone |

---

## Completed

*No tasks completed yet - all in Planning.*

---

## Task Creation Guidelines

When creating new tasks:
1. Use format: `[TYPE] Title` (e.g., `[BUG] Fix score display`)
2. Include: Summary, Acceptance Criteria, Files, Risks, Dependencies
3. Set status to **Planning** by default
4. Only move to **To Do** when explicitly approved

---

*Auto-generated from brain dump session Feb 2026.*
*Sync with GitHub Issues: https://github.com/CherryCircuit/vr-roguelike/issues*
