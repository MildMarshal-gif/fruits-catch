[CmdletBinding()]
param(
  [ValidateRange(1, 65535)]
  [int]$Port = 8080,

  [string]$BindAddress = '127.0.0.1'
)

$ErrorActionPreference = 'Stop'

$scriptDir = Split-Path -Parent $PSCommandPath
$repoRoot = Split-Path -Parent $scriptDir
$stateDir = Join-Path $repoRoot '.local'
$statePath = Join-Path $stateDir 'local-server.json'
$url = "http://$BindAddress`:$Port/"

function Get-ListeningSockets {
  param([int]$Port)

  $rows = @()
  $lines = netstat -ano -p TCP | Select-String 'LISTENING'
  foreach ($line in $lines) {
    $parts = (($line.Line -replace '^\s+', '') -replace '\s+', ' ').Split(' ')
    if ($parts.Count -lt 5) { continue }

    $localEndpoint = $parts[1]
    $pidText = $parts[4]
    $m = [Regex]::Match($localEndpoint, '^(.*):(\d+)$')
    if (-not $m.Success) { continue }

    $localAddress = $m.Groups[1].Value.Trim('[', ']')
    $localPort = [int]$m.Groups[2].Value
    if ($localPort -ne $Port) { continue }

    $processId = 0
    if (-not [int]::TryParse($pidText, [ref]$processId)) { continue }

    $proc = Get-Process -Id $processId -ErrorAction SilentlyContinue
    $processName = if ($proc) { $proc.ProcessName } else { '' }

    $rows += [pscustomobject]@{
      Address = $localAddress
      Port = $localPort
      ProcessId = $processId
      ProcessName = $processName
    }
  }

  return $rows | Sort-Object ProcessId -Unique
}

function Is-PythonProcessName {
  param([string]$Name)
  return ($Name -match '^(python|py)(\d+(\.\d+)?)?$')
}

if ($BindAddress -eq '0.0.0.0') {
  Write-Warning '0.0.0.0 exposes the server to the network. Use 127.0.0.1 for local-only preview.'
}

$listeners = @(Get-ListeningSockets -Port $Port)
if ($listeners.Count -gt 0) {
  $sameBind = @($listeners | Where-Object { $_.Address -eq $BindAddress })

  if ($sameBind.Count -gt 0) {
    $pythonSameBind = @($sameBind | Where-Object { Is-PythonProcessName $_.ProcessName })
    if ($pythonSameBind.Count -gt 0) {
      $existing = $pythonSameBind | Select-Object -First 1
      New-Item -ItemType Directory -Force -Path $stateDir | Out-Null
      [pscustomobject]@{
        pid = [int]$existing.ProcessId
        port = $Port
        bind = $BindAddress
        url = $url
        startedAt = (Get-Date).ToString('o')
      } | ConvertTo-Json -Depth 3 | Set-Content -LiteralPath $statePath -Encoding utf8

      Write-Output "already_running pid=$($existing.ProcessId) url=$url"
      Write-Output $url
      exit 0
    }

    $occupiedPids = ($sameBind | ForEach-Object { $_.ProcessId }) -join ','
    throw "Port $Port and bind $BindAddress are already used by non-python process(es): $occupiedPids"
  }

  $occupied = ($listeners | ForEach-Object { "$($_.Address):$($_.Port)(pid=$($_.ProcessId))" }) -join '; '
  throw "Port $Port is already in use on different bind address(es): $occupied"
}

$python = Get-Command python -ErrorAction SilentlyContinue
if (-not $python) {
  throw 'python command not found. Install Python or update PATH.'
}

New-Item -ItemType Directory -Force -Path $stateDir | Out-Null
$null = Start-Process -FilePath $python.Source -ArgumentList @('-m', 'http.server', "$Port", '--bind', $BindAddress) -WorkingDirectory $repoRoot -PassThru

$started = $null
for ($i = 0; $i -lt 30; $i++) {
  Start-Sleep -Milliseconds 200
  $scan = @(Get-ListeningSockets -Port $Port | Where-Object { $_.Address -eq $BindAddress -and (Is-PythonProcessName $_.ProcessName) })
  if ($scan.Count -gt 0) {
    $started = $scan | Select-Object -First 1
    break
  }
}

if (-not $started) {
  throw "Failed to detect listening python server on ${BindAddress}:$Port"
}

[pscustomobject]@{
  pid = [int]$started.ProcessId
  port = $Port
  bind = $BindAddress
  url = $url
  startedAt = (Get-Date).ToString('o')
} | ConvertTo-Json -Depth 3 | Set-Content -LiteralPath $statePath -Encoding utf8

try {
  $res = Invoke-WebRequest -Uri $url -UseBasicParsing -TimeoutSec 5
  Write-Output "started pid=$($started.ProcessId) url=$url status=$($res.StatusCode)"
}
catch {
  Write-Warning "Server is listening but readiness check failed. url=$url"
  Write-Output "started pid=$($started.ProcessId) url=$url status=unknown"
}

Write-Output $url
