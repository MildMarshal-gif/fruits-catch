param(
    [string]$OutputPath = ".local\screenshots\screenshot-$(Get-Date -Format 'yyyyMMdd-HHmmss').png",
    [int]$DelaySeconds = 2
)

# Ensure output directory exists
$outputDir = Split-Path -Parent $OutputPath
if ($outputDir -and !(Test-Path $outputDir)) {
    New-Item -ItemType Directory -Path $outputDir -Force | Out-Null
}

# Wait for page to load
if ($DelaySeconds -gt 0) {
    Write-Host "Waiting $DelaySeconds seconds for page to load..."
    Start-Sleep -Seconds $DelaySeconds
}

# Capture screenshot
Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing

$screen = [System.Windows.Forms.Screen]::PrimaryScreen.Bounds
$bitmap = New-Object System.Drawing.Bitmap $screen.Width, $screen.Height
$graphics = [System.Drawing.Graphics]::FromImage($bitmap)

try {
    $graphics.CopyFromScreen($screen.Location, [System.Drawing.Point]::Empty, $screen.Size)

    # Resolve to absolute path
    $absolutePath = Resolve-Path -Path $OutputPath -ErrorAction SilentlyContinue
    if (-not $absolutePath) {
        $absolutePath = $ExecutionContext.SessionState.Path.GetUnresolvedProviderPathFromPSPath($OutputPath)
    }

    $bitmap.Save($absolutePath, [System.Drawing.Imaging.ImageFormat]::Png)
    Write-Output "saved path=$absolutePath"
} finally {
    $graphics.Dispose()
    $bitmap.Dispose()
}
