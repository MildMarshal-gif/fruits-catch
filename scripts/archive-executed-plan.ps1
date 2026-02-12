[CmdletBinding()]
param(
  [Parameter(Mandatory = $true)]
  [string]$PlanPath
)

$ErrorActionPreference = 'Stop'

$repoRoot = Split-Path -Parent $PSScriptRoot
$docsRoot = [System.IO.Path]::GetFullPath((Join-Path $repoRoot 'docs'))
$archiveDir = Join-Path $docsRoot 'plans-archive'

if (!(Test-Path -LiteralPath $archiveDir)) {
  New-Item -Path $archiveDir -ItemType Directory | Out-Null
}

try {
  $resolvedPlan = Resolve-Path -LiteralPath $PlanPath
} catch {
  throw "Plan file not found: $PlanPath"
}

$sourcePath = [System.IO.Path]::GetFullPath($resolvedPlan.Path)

if ([System.IO.Path]::GetExtension($sourcePath).ToLowerInvariant() -ne '.md') {
  throw "Only markdown plan files are supported: $sourcePath"
}

if (!$sourcePath.StartsWith($docsRoot, [System.StringComparison]::OrdinalIgnoreCase)) {
  throw "Plan file must be under docs/: $sourcePath"
}

$fileName = Split-Path -Leaf $sourcePath
$destinationPath = Join-Path $archiveDir $fileName

if (Test-Path -LiteralPath $destinationPath) {
  $baseName = [System.IO.Path]::GetFileNameWithoutExtension($fileName)
  $extension = [System.IO.Path]::GetExtension($fileName)
  $timestamp = (Get-Date).ToString('yyyyMMdd-HHmmss')
  $destinationPath = Join-Path $archiveDir "$baseName-executed-$timestamp$extension"
}

Move-Item -LiteralPath $sourcePath -Destination $destinationPath -Force
Write-Output $destinationPath
