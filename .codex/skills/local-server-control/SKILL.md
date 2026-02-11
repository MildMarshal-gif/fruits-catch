---
name: local-server-control
description: Handle local preview server lifecycle via fixed PowerShell scripts. Use when asked to start/stop/check local server.
argument-hint: start | stop | status [--port <port>] [--bind <address>]
---

# Local Server Control

Use fixed scripts only. Do not run ad-hoc process kill/start commands unless the scripts fail.

## Trigger Phrases

- Start:
  - `サーバを開いて`
  - `ローカルサーバ起動`
  - `確認サーバ起動`
- Stop:
  - `ポートを閉じて`
  - `ローカルサーバ停止`
  - `8080止めて`
- Status:
  - `サーバ状態見せて`
  - `今動いてる？`

## Commands

- Start:
  - `powershell -ExecutionPolicy Bypass -File scripts/start-local-server.ps1`
- Stop:
  - `powershell -ExecutionPolicy Bypass -File scripts/stop-local-server.ps1`
- Status:
  - `powershell -ExecutionPolicy Bypass -File scripts/local-server-status.ps1`

Optional arguments:

- `-Port <int>`
- `-BindAddress <string>`

Example:

- `powershell -ExecutionPolicy Bypass -File scripts/start-local-server.ps1 -Port 8080 -BindAddress 127.0.0.1`

## Safety Rules

- Default bind must remain `127.0.0.1`.
- If bind is `0.0.0.0`, warn before execution because it exposes beyond localhost.
- For stop, always prefer script behavior that validates process commandline before kill.
