# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

SPACEOMICIDE — a WebXR synthwave-style VR roguelike shooter built with Three.js. No build tools; pure ES modules loaded via import maps from CDN (Three.js r0.160.0).

## Running

Serve the directory with any static HTTP server (e.g. `npx serve .` or `python3 -m http.server`). Open in a WebXR-compatible browser (Meta Quest Browser, Chrome on VR device). The WebXR polyfill is included for fallback.

## Architecture

All code is vanilla JS ES modules with no build step:

- **`main.js`** — Entry point. Initializes Three.js scene/renderer/WebXR, builds the synthwave environment (grid, sun, mountains, stars), sets up VR controllers, and runs the game loop. Owns all state transitions (title → playing → level_complete → upgrade_select → victory/game_over). Handles shooting via raycasting against enemy meshes.
- **`game.js`** — Central shared game state (`game` object) and level configuration. Exports mutable `game` singleton, `State` enum, `LEVELS` array (20 levels with scaling HP/speed/spawn rates), and helpers for score/combo/damage.
- **`enemies.js`** — Enemy system. Enemies are voxel groups built from pixel-art patterns (Space Invaders style). 4 types: basic, fast, tank, swarm. Handles spawning, movement toward player, status effects (fire/shock/freeze DoT), death explosions (voxel particles).
- **`upgrades.js`** — 12 stackable upgrades (scope, barrel, buckshot, piercing, fire, shock, freeze, etc.). `getWeaponStats()` computes effective weapon stats from the player's upgrade inventory.
- **`hud.js`** — All in-VR UI as 3D sprites/meshes: title screen, HUD (pixel hearts, kill counter, level, score, combo), upgrade selection cards (raycasted for selection), game over/victory screens, damage numbers, hit flash.

## Key Patterns

- Game state is a shared mutable object (`game` from game.js) imported by all modules
- UI is rendered as Three.js sprites with canvas-drawn text (no DOM in VR)
- Enemy hit detection uses Three.js Raycaster against enemy mesh groups, walking up parent chain to find the enemy group
- Upgrades are stackable (stored as `{ id: count }`) and weapon stats are recomputed each shot
- 20 levels with escalating difficulty; every 5th level is a boss level
