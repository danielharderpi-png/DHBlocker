# Builds dist/DHBlocker_v<version>.zip with manifest.json at the zip root (Chrome Web Store layout).
$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'
$root = Split-Path -Parent $PSScriptRoot
$manifest = Get-Content (Join-Path $root 'manifest.json') -Raw | ConvertFrom-Json
$out = Join-Path $root "dist\DHBlocker_v$($manifest.version).zip"
$stage = Join-Path $env:TEMP "dhblocker_stage"
if (Test-Path $stage) { Remove-Item $stage -Recurse -Force }
New-Item -ItemType Directory $stage | Out-Null
foreach ($item in 'manifest.json','assets','rules','src') { Copy-Item (Join-Path $root $item) $stage -Recurse }
New-Item -ItemType Directory (Join-Path $root 'dist') -Force | Out-Null
if (Test-Path $out) { Remove-Item $out }
Compress-Archive -Path (Join-Path $stage '*') -DestinationPath $out
Remove-Item $stage -Recurse -Force
Write-Host "Built $out"
