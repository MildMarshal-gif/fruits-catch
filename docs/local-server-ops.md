# Local Server Ops

## Purpose

Standardize local preview server operations for this repository.

## Default Settings

- Port: `8080`
- Bind address: `127.0.0.1`
- State file: `./.local/local-server.json`

## Daily Workflow

1. Start server

```powershell
powershell -ExecutionPolicy Bypass -File scripts/start-local-server.ps1
```

2. Open in browser

```text
http://localhost:8080/
```

3. Check status (optional)

```powershell
powershell -ExecutionPolicy Bypass -File scripts/local-server-status.ps1
```

4. Stop server at end of work

```powershell
powershell -ExecutionPolicy Bypass -File scripts/stop-local-server.ps1
```

## Optional Parameters

Start with custom port and bind:

```powershell
powershell -ExecutionPolicy Bypass -File scripts/start-local-server.ps1 -Port 9090 -BindAddress 127.0.0.1
```

Stop custom target:

```powershell
powershell -ExecutionPolicy Bypass -File scripts/stop-local-server.ps1 -Port 9090 -BindAddress 127.0.0.1
```

## Safety Notes

- Default bind is localhost only.
- `0.0.0.0` can expose the server to other devices on the network.
- Stop script validates command line before process termination.

## Troubleshooting

No response after start:

1. Run status script and verify `running`.
2. Check if port is already used by another app.
3. Restart with a different port.

State file exists but process is gone:

1. Run stop script once (it clears stale state).
2. Start again.
