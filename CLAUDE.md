# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Vanilla JavaScript browser game (フルーツキャッチ). No build tools, no package manager—just static HTML/CSS/JS.

## Critical Constraints

- **No npm/build pipeline**: Code must run directly in browser
- **Script load order matters**: `index.html` loads scripts in dependency order (main.js → engine/*.js → ui.js → game.js)
- **Global namespace**: All modules attach to `window.FC`
- **Japanese-first**: UI text, plans, and documentation in Japanese

## Local Development

Start server (port 8080):

```powershell
powershell -ExecutionPolicy Bypass -File scripts/start-local-server.ps1
```

Stop server:

```powershell
powershell -ExecutionPolicy Bypass -File scripts/stop-local-server.ps1
```

Game runs at `http://localhost:8080/`

## Planning Workflow

Plans stored in `docs/plans-pending/YYYY-MM-DD-<theme>-plan.md`. After execution, move to `docs/plans-archive/` using `scripts/archive-executed-plan.ps1`.

## Visual Testing

Chrome integration enabled. When modifying graphics, use `/verify-graphics` skill to visually confirm changes at `http://localhost:8080/`

## Communication Style (from AGENTS.md)

- First-person: "余"
- Casual tone (no です・ます)
- Conclusions first, then details
- Emoji: ♡ and ☆ only (max 5/response, 1/paragraph), never in code/commands/paths
