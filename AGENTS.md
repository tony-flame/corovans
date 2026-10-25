# AGENTS.md

## Project

Browser demo "Корованы: Тёмная дорога" — a Daggerfall-like first-person raycaster where you rob caravans. Vanilla JS ES modules + Canvas 2D, no build step and no npm dependencies. All art/audio is procedural.

## Commands

- `npm start` — static server on port 8000 (runs `python -m http.server 8000`). Open `http://localhost:8000`.
- `npm run verify` — syntax-check every module and run unit tests. Run before committing.
- `npm test` — unit tests only; `node --test tests/logic.test.js` for one file.
- `?debug=1` on the game URL exposes `window.__corovans` (`game`, `world`, `player`, `ui`, `input`, `renderer`) for CDP/manual debugging.

ES modules require HTTP; opening `index.html` via `file://` fails. There is no bundler, transpiler, or browser test runner.

## Architecture

- `src/main.js` — all game wiring: state, loop, interactions, trade, wanted, caravan respawn, overlays. Start here when changing behavior.
- `src/world.js` — 40×40 tile map built in code, props/actors, collision, line of sight, interaction radii, camp spawns. Map coordinates are code, not data files.
- `src/raycaster.js` — DDA walls, floor casting, billboard sprites, weapon overlay. Fixed internal 640×360 buffer scaled by CSS.
- `src/enemies.js` — guard/driver AI. Requires `game.damagePlayer` and `game.onGuardAlert`, assigned in `main.js`; don't call AI before that wiring.
- `src/player.js` — movement, stamina, crouch/sprint, bob.
- `src/inventory.js`, `src/economy.js`, `src/combat.js` — pure logic, covered by `node:test`.
- `src/ui.js`, `src/audio.js`, `src/textures.js`, `src/sprites.js` — browser/DOM-dependent; don't import them in Node tests.

## Gameplay state quirks

- `world.wagonLooted` blocks repeat looting. `spawnCamp(world, tier)` resets it and replaces camp guards; `main.js` schedules that only after loot is sold.
- Stealing requires holding `E` within 2.5 of the wagon. Taking damage does not reset progress, but releasing `E` or leaving range does.
- `game.wanted` comes from witnessed thefts and kills; the village guard turns hostile while it is above 0. The merchant clears it for a fee.
- Losing pointer lock pauses the game. Trade/help set `game.uiOpen = true` before `exitLock()` so that loss doesn't also pause.
- Player spawn is `(7.5, 24.5)`; the camp wagon is `(30.3, 8.1)`. The intended route is east along the road, then north.

## Verification

`npm run verify` covers syntax, economy/inventory/combat formulas, map collision, LOS, and caravan tier spawning. For a browser smoke test, use `?debug=1` and check: start → walk east/north → hold `E` at the wagon → sell at Mardo → buy an upgrade → wait for the next caravan. Also check pause, death, and the 300-gold victory overlay.
