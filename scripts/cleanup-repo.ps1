#!/usr/bin/env pwsh
# AveryOS™ Repo Cleanup Script — Phase 96
# Prunes build artifacts to reduce repo bloat from ~1.5 GB to <200 MB pure source.
# Run from the root of the averyos.com-runtime repository.
#
# ⛓️⚓⛓️  CreatorLock: Jason Lee Avery (ROOT0) 🤛🏻

param(
  [switch]$DryRun,
  [switch]$SkipGitGC
)

$ErrorActionPreference = "Stop"
$RepoRoot = $PSScriptRoot | Split-Path -Parent

Write-Host "⛓️⚓⛓️ AveryOS™ Repo Cleanup — Phase 96" -ForegroundColor Yellow
Write-Host "Repo root: $RepoRoot" -ForegroundColor Cyan

$ArtifactDirs = @(
  ".next",
  ".open-next",
  ".wrangler",
  "node_modules/.cache",
  ".turbo"
)

foreach ($dir in $ArtifactDirs) {
  $fullPath = Join-Path $RepoRoot $dir
  if (Test-Path $fullPath) {
    if ($DryRun) {
      Write-Host "[DRY-RUN] Would remove: $fullPath" -ForegroundColor DarkGray
    } else {
      Write-Host "Removing $fullPath..." -ForegroundColor Red
      Remove-Item -Recurse -Force $fullPath
      Write-Host "✓ Removed $dir" -ForegroundColor Green
    }
  } else {
    Write-Host "Skipping (not found): $dir" -ForegroundColor DarkGray
  }
}

if (-not $SkipGitGC) {
  Write-Host "`nRunning git gc --aggressive --prune=now..." -ForegroundColor Yellow
  if ($DryRun) {
    Write-Host "[DRY-RUN] Would run: git gc --aggressive --prune=now" -ForegroundColor DarkGray
  } else {
    Push-Location $RepoRoot
    try {
      git gc --aggressive --prune=now
      Write-Host "✓ git gc complete" -ForegroundColor Green
    } finally {
      Pop-Location
    }
  }
}

Write-Host "`n⛓️⚓⛓️ Cleanup complete. Run 'npm install && npm run build' to restore." -ForegroundColor Yellow
