<#
.SYNOPSIS
    AveryOS™ Infrastructure Cleanup — prune local build artifacts.

.DESCRIPTION
    Removes generated build directories (.next, .wrangler, .open-next) that
    accumulate between local builds and can cause stale-cache issues.
    Optionally runs 'git gc --aggressive' to compact the repository object store.

    Safe to run at any time. Does NOT touch source files, node_modules, or
    any sovereign runtime config files listed in CLAUDE.md.

.PARAMETER GcAggressive
    If specified, runs 'git gc --aggressive --prune=now' after pruning artifacts.
    This can take several minutes on large repos.

.PARAMETER DryRun
    List what would be deleted without actually deleting anything.

.EXAMPLE
    .\scripts\cleanup-repo.ps1
    .\scripts\cleanup-repo.ps1 -GcAggressive
    .\scripts\cleanup-repo.ps1 -DryRun

.NOTES
    ⛓️⚓⛓️ Kernel Anchor: cf83e135...927da3e — SKC-2026.1
    Author: Jason Lee Avery / AveryOS™
#>

[CmdletBinding(SupportsShouldProcess)]
param(
    [switch]$GcAggressive,
    [switch]$DryRun
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

# ── Paths to prune ─────────────────────────────────────────────────────────────
$ArtifactDirs = @(
    '.next',
    '.wrangler',
    '.open-next'
)

# ── Helper ──────────────────────────────────────────────────────────────────────
function Remove-ArtifactDir {
    param([string]$Dir)

    $fullPath = Join-Path (Get-Location) $Dir
    if (-not (Test-Path $fullPath)) {
        Write-Host "[AOS] Skipping (not found): $Dir" -ForegroundColor DarkGray
        return
    }

    $sizeMb = [math]::Round(
        (Get-ChildItem $fullPath -Recurse -File -ErrorAction SilentlyContinue |
         Measure-Object -Property Length -Sum).Sum / 1MB, 2
    )

    if ($DryRun) {
        Write-Host "[AOS][DRY-RUN] Would remove: $Dir  ($sizeMb MB)" -ForegroundColor Yellow
        return
    }

    Write-Host "[AOS] Removing: $Dir  ($sizeMb MB) ..." -ForegroundColor Cyan
    Remove-Item $fullPath -Recurse -Force
    Write-Host "[AOS] ✓ Removed: $Dir" -ForegroundColor Green
}

# ── Main ────────────────────────────────────────────────────────────────────────
Write-Host ""
Write-Host "⛓️ AveryOS™ Infrastructure Cleanup" -ForegroundColor Yellow
Write-Host "─────────────────────────────────────" -ForegroundColor DarkGray
if ($DryRun) { Write-Host "DRY-RUN mode — no files will be modified`n" -ForegroundColor Yellow }

foreach ($dir in $ArtifactDirs) {
    Remove-ArtifactDir -Dir $dir
}

# ── Optional: git gc ───────────────────────────────────────────────────────────
if ($GcAggressive) {
    Write-Host ""
    Write-Host "[AOS] Running git gc --aggressive --prune=now ..." -ForegroundColor Cyan
    if ($DryRun) {
        Write-Host "[AOS][DRY-RUN] Would run: git gc --aggressive --prune=now" -ForegroundColor Yellow
    } else {
        & git gc --aggressive --prune=now
        Write-Host "[AOS] ✓ git gc complete" -ForegroundColor Green
    }
}

Write-Host ""
Write-Host "⛓️⚓⛓️ Cleanup complete. Run 'npm run build' for a fresh build." -ForegroundColor Yellow
