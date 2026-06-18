# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

Vanilla-JS Tetris using the HTML5 Canvas 2D API. No build step, no dependencies, no `package.json`. UI text is in Spanish.

## Running

Open `index.html` directly, or serve statically (e.g. `python3 -m http.server 8000`, then visit `http://localhost:8000`). There is no build, lint, or test tooling.

## Architecture

Three files: `index.html` (DOM + two `<canvas>` elements), `style.css` (dark theme), `game.js` (all logic). `game.js` runs as a flat module-less script (`'use strict'`) with module-level mutable state in a single `let` declaration (`board, current, next, score, ...`); functions mutate this shared state directly rather than passing it around.

Key invariants to respect when editing `game.js`:

- **Board model**: `board` is a `ROWS × COLS` matrix of cell values `0` (empty) or `1–7` (a color/piece-type index into `COLORS` and `PIECES`, which are 1-indexed with a `null` at index 0).
- **Canvas size is coupled to constants**: `#board` is `300×600` in `index.html`, equal to `COLS×BLOCK` by `ROWS×BLOCK`. Changing `COLS`, `ROWS`, or `BLOCK` requires updating the canvas `width`/`height` attributes too.
- **Rotation** (`rotateCW`) transposes + reverses rows; `tryRotate` applies basic wall kicks by trying x-offsets `[0, -1, 1, -2, 2]`.
- **Game loop** (`loop`) is `requestAnimationFrame`-driven, accumulating `dt` into `dropAccum` and stepping the piece down once `dropInterval` is exceeded. Pause cancels the frame (`animId`) and resumes by resetting `lastTime`.
- **Scoring/leveling**: `LINE_SCORES[cleared] * level`; level rises every 10 lines and recomputes `dropInterval = max(100, 1000 - (level-1)*90)`.
- **Lifecycle**: `init()` resets all state and is also the restart handler; `spawn()` promotes `next → current` and triggers `endGame()` if the new piece immediately collides.
