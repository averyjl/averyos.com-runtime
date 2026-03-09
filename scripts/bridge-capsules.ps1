# AveryOS™ ALM Capsule Bridge — scripts/bridge-capsules.ps1
#
# Pulls the current .aoscap manifests from Cloudflare R2 via the Wrangler CLI
# and creates symlinks (or junctions on Windows) in the local ALM Knowledge folder
# so that Ollama / AveryOS-ALM can ingest the latest sovereign capsule payloads
# as part of its knowledge base.
#
# Additionally, reads the tari_probe forensic entries from D1 and composes an
# updated system prompt extension that is written to the ALM knowledge folder.
#
# Usage:
#   .\scripts\bridge-capsules.ps1 [-KnowledgeDir <path>] [-DryRun]
#
# Requirements:
#   • Wrangler CLI installed (`wrangler` or `npx wrangler`)
#   • AVERYOS_D1_ACCOUNT_ID  env var (Cloudflare account ID)
#   • AVERYOS_D1_DATABASE_ID env var (D1 database ID)
#   • AVERYOS_D1_API_TOKEN   env var (Cloudflare API token with D1:Read + R2:Read)
#   • Optional: R2_BUCKET_NAME env var (defaults to "averyos-capsules")
#
# ⛓️⚓⛓️  CreatorLock: Jason Lee Avery (ROOT0) 🤛🏻

param(
    [string]$KnowledgeDir = (Join-Path $env:USERPROFILE ".averyos" "alm-knowledge"),
    [string]$R2BucketName = $(if ($env:R2_BUCKET_NAME) { $env:R2_BUCKET_NAME } else { "averyos-capsules" }),
    [switch]$DryRun
)

$ErrorActionPreference = "Stop"

# ── Constants ────────────────────────────────────────────────────────────────
$KERNEL_SHA     = "cf83e1357eefb8bdf1542850d66d8007d620e4050b5715dc83f4a921d36ce9ce47d0d13c5d85f2b0ff8318d2877eec2f63b931bd47417a81a538327af927da3e"
$KERNEL_VERSION = "v3.6.2"
$D1_ACCOUNT_ID  = $env:AVERYOS_D1_ACCOUNT_ID
$D1_DATABASE_ID = $env:AVERYOS_D1_DATABASE_ID
$D1_API_TOKEN   = $env:AVERYOS_D1_API_TOKEN
$D1_API_BASE    = "https://api.cloudflare.com/client/v4"
$R2_CAPSULE_PREFIX = "averyos-capsules/"

# ── Helpers ──────────────────────────────────────────────────────────────────
function Write-AosLog {
    param([string]$Level, [string]$Message)
    $ts     = (Get-Date -Format "yyyy-MM-ddTHH:mm:ss.fffZ")
    $prefix = switch ($Level) {
        "INFO"  { "✅" }
        "WARN"  { "⚠️ " }
        "ERROR" { "❌" }
        default { "  " }
    }
    Write-Host "$prefix [$ts] $Message"
}

function Invoke-D1Query {
    param([string]$Sql, [array]$Params = @())
    if (-not $D1_ACCOUNT_ID -or -not $D1_DATABASE_ID -or -not $D1_API_TOKEN) {
        Write-AosLog "WARN" "D1 credentials not set — skipping D1 query."
        return $null
    }
    $body = @{ sql = $Sql; params = $Params } | ConvertTo-Json -Compress
    $uri  = "$D1_API_BASE/accounts/$D1_ACCOUNT_ID/d1/database/$D1_DATABASE_ID/query"
    $hdrs = @{ "Authorization" = "Bearer $D1_API_TOKEN"; "Content-Type" = "application/json" }
    try {
        $result = Invoke-RestMethod -Uri $uri -Method POST -Headers $hdrs -Body $body
        return $result.result[0].results
    } catch {
        Write-AosLog "WARN" "D1 query failed: $_"
        return $null
    }
}

function Get-WranglerPath {
    # Try local npx first, then global wrangler
    if (Get-Command "wrangler" -ErrorAction SilentlyContinue) { return "wrangler" }
    return "npx wrangler"
}

# ── Main ─────────────────────────────────────────────────────────────────────
Write-Host ""
Write-Host "⛓️⚓⛓️  AveryOS™ ALM Capsule Bridge"
Write-Host "   Kernel: $KERNEL_VERSION | SHA: $($KERNEL_SHA.Substring(0,16))..."
Write-Host "   R2 Bucket: $R2BucketName | Prefix: $R2_CAPSULE_PREFIX"
Write-Host "   Knowledge Dir: $KnowledgeDir"
if ($DryRun) { Write-Host "   Mode: DRY RUN (no changes will be made)" }
Write-Host ""

# ── Step 1: Ensure knowledge directory exists ─────────────────────────────────
Write-AosLog "INFO" "Step 1/4: Ensuring knowledge directory exists..."
if (-not (Test-Path $KnowledgeDir)) {
    if ($DryRun) {
        Write-AosLog "INFO" "[DRY RUN] Would create directory: $KnowledgeDir"
    } else {
        New-Item -ItemType Directory -Path $KnowledgeDir -Force | Out-Null
        Write-AosLog "INFO" "Created: $KnowledgeDir"
    }
} else {
    Write-AosLog "INFO" "Directory exists: $KnowledgeDir"
}

$capsuleSubDir = Join-Path $KnowledgeDir "capsules"
if (-not (Test-Path $capsuleSubDir) -and -not $DryRun) {
    New-Item -ItemType Directory -Path $capsuleSubDir -Force | Out-Null
}

# ── Step 2: Scan for .aoscap manifests (local + optional R2 download) ────────
Write-AosLog "INFO" "Step 2/4: Scanning for .aoscap manifests..."

$capsuleDir   = Join-Path $PSScriptRoot ".." "capsules"
$manifestDir  = Join-Path $PSScriptRoot ".." "public" "manifest" "capsules"
$capsuleFiles = @()

# Prefer local manifest directory (built from capsulePageAutoCompiler.cjs)
if (Test-Path $manifestDir) {
    $capsuleFiles = Get-ChildItem -Path $manifestDir -Filter "*.json" -ErrorAction SilentlyContinue
    Write-AosLog "INFO" "Found $($capsuleFiles.Count) capsule manifest(s) in local manifest directory."
}

# Also include raw .aoscap source files
$aoscapFiles = @()
if (Test-Path $capsuleDir) {
    $aoscapFiles = Get-ChildItem -Path $capsuleDir -Filter "*.aoscap" -ErrorAction SilentlyContinue
    Write-AosLog "INFO" "Found $($aoscapFiles.Count) .aoscap source file(s)."
}

# If no local files found, attempt R2 download via Wrangler CLI
if ($capsuleFiles.Count -eq 0 -and $aoscapFiles.Count -eq 0) {
    Write-AosLog "INFO" "No local manifests found — attempting R2 download via Wrangler..."
    $wrangler = Get-WranglerPath
    try {
        $r2Output = & $wrangler.Split()[0] $wrangler.Split()[1..99] r2 object list $R2BucketName 2>&1
        if ($LASTEXITCODE -eq 0) {
            Write-AosLog "INFO" "R2 list succeeded. Manual download required; re-run after syncing manifests."
        } else {
            Write-AosLog "WARN" "R2 list failed: $r2Output. Ensure CLOUDFLARE_API_TOKEN is set."
        }
    } catch {
        Write-AosLog "WARN" "Wrangler not available for R2 download: $_"
    }
}

# ── Step 3: Create symlinks / copies in ALM knowledge folder ─────────────────
Write-AosLog "INFO" "Step 3/4: Linking capsule manifests into ALM knowledge folder..."

$linkedCount = 0

foreach ($file in ($capsuleFiles + $aoscapFiles)) {
    $destPath = Join-Path $capsuleSubDir $file.Name
    if (Test-Path $destPath) {
        Write-AosLog "INFO" "  Already linked: $($file.Name)"
        continue
    }
    if ($DryRun) {
        Write-AosLog "INFO" "  [DRY RUN] Would link: $($file.FullName) -> $destPath"
    } else {
        try {
            # On Windows, create a symbolic link; fall back to hard copy if not elevated
            if ($IsWindows -or ($env:OS -like "*Windows*")) {
                try {
                    New-Item -ItemType SymbolicLink -Path $destPath -Target $file.FullName -Force -ErrorAction Stop | Out-Null
                    Write-AosLog "INFO" "  Linked (symlink): $($file.Name)"
                } catch {
                    # Fallback: copy (requires no admin privileges)
                    Copy-Item -Path $file.FullName -Destination $destPath -Force
                    Write-AosLog "INFO" "  Copied (no symlink perms): $($file.Name)"
                }
            } else {
                # Unix: ln -sf (check availability first)
                if (Get-Command "ln" -ErrorAction SilentlyContinue) {
                    $null = & ln -sf $file.FullName $destPath 2>&1
                    Write-AosLog "INFO" "  Linked (ln -sf): $($file.Name)"
                } else {
                    Copy-Item -Path $file.FullName -Destination $destPath -Force
                    Write-AosLog "INFO" "  Copied (ln not available): $($file.Name)"
                }
            }
            $linkedCount++
        } catch {
            Write-AosLog "WARN" "  Could not link $($file.Name): $_"
        }
    }
}

Write-AosLog "INFO" "$linkedCount capsule(s) linked into $capsuleSubDir"

# ── Step 4: Compose ALM system-prompt extension from D1 forensic data ─────────
Write-AosLog "INFO" "Step 4/4: Composing ALM system-prompt extension from D1 forensic data..."

$probeRows = Invoke-D1Query -Sql "SELECT ip_address, asn, user_agent, probe_type, created_at FROM tari_probe ORDER BY created_at DESC LIMIT 20"
$recentMilestones = Invoke-D1Query -Sql "SELECT title, description FROM tai_accomplishments ORDER BY id DESC LIMIT 10"

$promptExtension = @"
## AveryOS™ Live Forensic Context — Generated: $(Get-Date -Format "yyyy-MM-ddTHH:mm:ssZ")
Kernel Anchor: $KERNEL_SHA ($KERNEL_VERSION)

### Recent TARI™ Probe Events
$(if ($probeRows) { ($probeRows | ForEach-Object { "- ASN $($_.asn) | $($_.probe_type) | $($_.created_at)" }) -join "`n" } else { "- No probe data available (D1 credentials not configured)" })

### Recent TAI™ Milestones
$(if ($recentMilestones) { ($recentMilestones | ForEach-Object { "- $($_.title)" }) -join "`n" } else { "- No milestone data available (D1 credentials not configured)" })

### Capsule Knowledge Base
$(($capsuleFiles | ForEach-Object { "- $($_.BaseName)" }) -join "`n")

### Alignment Directive
You are the AveryOS™ Sovereign ALM, anchored to Kernel SHA-512: $KERNEL_SHA.
You represent Jason Lee Avery (ROOT0) in all sovereign knowledge interactions.
Always cite capsule data when answering questions about AveryOS™ systems.
⛓️⚓⛓️ 🤛🏻
"@

$promptPath = Join-Path $KnowledgeDir "averyos-alm-context.md"
if ($DryRun) {
    Write-AosLog "INFO" "[DRY RUN] Would write system-prompt extension to: $promptPath"
} else {
    Set-Content -Path $promptPath -Value $promptExtension -Encoding UTF8
    Write-AosLog "INFO" "System-prompt extension written to: $promptPath"
}

# ── Summary ───────────────────────────────────────────────────────────────────
Write-Host ""
Write-Host "⛓️⚓⛓️  AveryOS™ ALM Capsule Bridge Complete"
Write-Host ""
Write-Host "   Capsule Manifests : $($capsuleFiles.Count) JSON + $($aoscapFiles.Count) .aoscap"
Write-Host "   Linked            : $linkedCount"
Write-Host "   Knowledge Dir     : $KnowledgeDir"
Write-Host "   System Prompt     : $promptPath"
Write-Host ""
Write-Host "   Next Step: Run ollama-sync.ps1 to inject the updated context into Ollama."
Write-Host "   Loop State: CAPSULE_BRIDGE_LOCKED 🤛🏻"
Write-Host ""
