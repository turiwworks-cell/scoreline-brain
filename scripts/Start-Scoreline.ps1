param(
    [switch]$NoBrowser,
    [ValidateRange(1024, 65535)]
    [int]$Port = 5173
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

try {
    $projectRoot = Split-Path -Parent $PSScriptRoot
    Set-Location -LiteralPath $projectRoot

    if (-not (Test-Path -LiteralPath 'package.json') -or -not (Test-Path -LiteralPath 'package-lock.json')) {
        throw 'Extract the whole project ZIP first. Keep Open-Scoreline.cmd beside package.json.'
    }

    $nodeCommand = Get-Command node.exe -ErrorAction SilentlyContinue
    $npmCommand = Get-Command npm.cmd -ErrorAction SilentlyContinue
    if (-not $nodeCommand -or -not $npmCommand) {
        throw 'Install Node.js 22.12 or newer from https://nodejs.org, then open Scoreline again.'
    }
    $nodeVersionText = (& $nodeCommand.Source --version).Trim()
    if ($LASTEXITCODE -ne 0) { throw 'Node.js could not run.' }
    $nodeVersion = [version]$nodeVersionText.TrimStart('v')
    if ($nodeVersion.Major -lt 22 -or ($nodeVersion.Major -eq 22 -and $nodeVersion.Minor -lt 12)) {
        throw "Node.js $nodeVersionText is too old. Install Node.js 22.12 or newer."
    }

    $viteEntry = Join-Path $projectRoot 'node_modules\vite\bin\vite.js'
    $stampPath = Join-Path $projectRoot 'node_modules\.scoreline-deps.sha256'
    $fingerprint = (Get-FileHash -LiteralPath 'package-lock.json' -Algorithm SHA256).Hash +
        ':' + (Get-FileHash -LiteralPath 'package.json' -Algorithm SHA256).Hash + ':' + $nodeVersionText
    $installedFingerprint = if (Test-Path -LiteralPath $stampPath) {
        [IO.File]::ReadAllText($stampPath).Trim()
    } else { '' }

    Write-Host ''
    Write-Host 'Scoreline - local design and animation review' -ForegroundColor Cyan
    if (-not (Test-Path -LiteralPath $viteEntry) -or $installedFingerprint -ne $fingerprint) {
        Write-Host 'Installing dependencies. Internet is needed for this step...' -ForegroundColor Yellow
        & $npmCommand.Source ci --no-audit --no-fund
        if ($LASTEXITCODE -ne 0) { throw 'Dependency installation failed. Check the message above and your internet connection.' }
        [IO.File]::WriteAllText($stampPath, $fingerprint, [Text.Encoding]::ASCII)
    } else {
        Write-Host 'Dependencies are ready; no installation needed.' -ForegroundColor Green
    }

    Write-Host 'Starting Scoreline. Keep this window open while using the app.'
    Write-Host 'Press Ctrl+C or close this window when you are finished.'
    $viteArguments = @('--host', '127.0.0.1', '--port', [string]$Port)
    if (-not $NoBrowser) { $viteArguments += @('--open', '/?demo') }
    & $nodeCommand.Source $viteEntry @viteArguments
    if ($LASTEXITCODE -ne 0) { throw "The local server stopped with exit code $LASTEXITCODE." }
    exit 0
} catch {
    Write-Host ''
    Write-Host $_.Exception.Message -ForegroundColor Red
    exit 1
}
