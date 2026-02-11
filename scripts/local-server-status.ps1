[CmdletBinding()]
param(
  [ValidateRange(1, 65535)]
  [int]$Port = 8080,

  [string]$BindAddress = '127.0.0.1'
)

$ErrorActionPreference = 'Stop'

$scriptDir = Split-Path -Parent $PSCommandPath
$repoRoot = Split-Path -Parent $scriptDir
$statePath = Join-Path (Join-Path $repoRoot '.local') 'local-server.json'
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

if (Test-Path -LiteralPath $statePath) {
  try {
    $state = Get-Content -LiteralPath $statePath -Raw | ConvertFrom-Json
    if ($state.pid -and $state.port -and $state.bind) {
      $statePid = [int]$state.pid
      $statePort = [int]$state.port
      $stateBind = [string]$state.bind
      $stateHit = @(Get-ListeningSockets -Port $statePort |
        Where-Object {
          $_.ProcessId -eq $statePid -and $_.Address -eq $stateBind -and (Is-PythonProcessName $_.ProcessName)
        })
      if ($stateHit.Count -gt 0) {
        Write-Output "running pid=$statePid url=$($state.url) port=$statePort bind=$stateBind source=state"
        exit 0
      }
    }
  }
  catch {
    Write-Warning 'Failed to read state file. Falling back to scan mode.'
  }
}

$scan = @(Get-ListeningSockets -Port $Port |
  Where-Object {
    $_.Address -eq $BindAddress -and (Is-PythonProcessName $_.ProcessName)
  })

if ($scan.Count -gt 0) {
  $pids = ($scan | ForEach-Object { $_.ProcessId }) -join ','
  Write-Output "running pid=$pids url=$url port=$Port bind=$BindAddress source=scan"
  exit 0
}

Write-Output "stopped port=$Port bind=$BindAddress"
