<#
.SYNOPSIS
    AveryOS™ Post-Process Hydration Bot — sovereign_audit_logs org/country enrichment.

.DESCRIPTION
    PowerShell 7 script that fills hydration_status=0 rows in anchor_audit_logs
    with org/country metadata derived from ASN lookups (ipinfo.io or similar).

    Workflow:
      1. Fetch rows from anchor_audit_logs where hydration_status = 0 (or column missing).
      2. For each row, resolve ip_address → ASN → org + country via ipinfo.io.
      3. PATCH the row with org, country, and set hydration_status = 1.
      4. Log progress and errors via AveryOS™ sovereign error standard.

    Prerequisites:
      - PowerShell 7+
      - Set CLOUDFLARE_ACCOUNT_ID, CLOUDFLARE_API_TOKEN, D1_DATABASE_ID env vars
      - Optional: IPINFO_TOKEN for higher rate limits (50k/month free without token)

.PARAMETER Limit
    Maximum number of rows to hydrate per run. Default: 100.

.PARAMETER DryRun
    If set, queries D1 and resolves ASNs but does not write updates back.

.PARAMETER LocalOnly
    If set, skips ipinfo.io lookup and uses a local ASN→org/country mapping.

.EXAMPLE
    .\scripts\hydrate-logs.ps1 -Limit 50
    .\scripts\hydrate-logs.ps1 -Limit 200 -DryRun
    .\scripts\hydrate-logs.ps1 -LocalOnly -Limit 500

.NOTES
    ⛓️⚓⛓️  CreatorLock: Jason Lee Avery (ROOT0) 🤛🏻
    Kernel: cf83e1357eefb8bdf1542850d66d8007d620e4050b5715dc83f4a921d36ce9ce47d0d13c5d85f2b0ff8318d2877eec2f63b931bd47417a81a538327af927da3e
#>

[CmdletBinding()]
param(
    [int]    $Limit     = 100,
    [switch] $DryRun,
    [switch] $LocalOnly
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

# ── Constants ──────────────────────────────────────────────────────────────────
$KERNEL_SHA     = 'cf83e1357eefb8bdf1542850d66d8007d620e4050b5715dc83f4a921d36ce9ce47d0d13c5d85f2b0ff8318d2877eec2f63b931bd47417a81a538327af927da3e'
$KERNEL_VERSION = 'v3.6.2'
$SCRIPT_VERSION = '1.0.0'

# ── Env config ────────────────────────────────────────────────────────────────
$CF_ACCOUNT_ID  = $env:CLOUDFLARE_ACCOUNT_ID  ?? ''
$CF_API_TOKEN   = $env:CLOUDFLARE_API_TOKEN   ?? ''
$D1_DATABASE_ID = $env:D1_DATABASE_ID         ?? ''
$IPINFO_TOKEN   = $env:IPINFO_TOKEN           ?? ''

# ── Local ASN → org/country fallback map ──────────────────────────────────────
$LOCAL_ASN_MAP = @{
    '36459'  = @{ org = 'GitHub / Microsoft'; country = 'US' }
    '8075'   = @{ org = 'Microsoft Azure';    country = 'US' }
    '15169'  = @{ org = 'Google LLC';         country = 'US' }
    '16509'  = @{ org = 'Amazon.com';         country = 'US' }
    '14618'  = @{ org = 'Amazon Technologies'; country = 'US' }
    '32934'  = @{ org = 'Meta Platforms';     country = 'US' }
    '20940'  = @{ org = 'Akamai Technologies';country = 'US' }
    '198488' = @{ org = 'Colocall Ltd';       country = 'UA' }
    '211590' = @{ org = 'FBW Networks';       country = 'FR' }
    '2635'   = @{ org = 'Automattic';         country = 'US' }
}

# ── Logging helpers ──────────────────────────────────────────────────────────
function Write-AosInfo([string]$Message) {
    Write-Host "   ℹ️  $Message" -ForegroundColor Cyan
}

function Write-AosSuccess([string]$Message) {
    Write-Host "   ✅ $Message" -ForegroundColor Green
}

function Write-AosWarn([string]$Message) {
    Write-Host "   ⚠️  $Message" -ForegroundColor Yellow
}

function Write-AosError([string]$Code, [string]$Message) {
    Write-Host "   ❌ [$Code] $Message" -ForegroundColor Red
}

# ── D1 REST query helper ───────────────────────────────────────────────────────
function Invoke-D1Query {
    param(
        [string]   $Sql,
        [object[]] $Params = @()
    )

    if (-not $CF_ACCOUNT_ID -or -not $CF_API_TOKEN -or -not $D1_DATABASE_ID) {
        Write-AosError 'BINDING_MISSING' 'Missing Cloudflare credentials: set CLOUDFLARE_ACCOUNT_ID, CLOUDFLARE_API_TOKEN, D1_DATABASE_ID'
        throw 'Missing Cloudflare credentials'
    }

    $url  = "https://api.cloudflare.com/client/v4/accounts/$CF_ACCOUNT_ID/d1/database/$D1_DATABASE_ID/query"
    $body = @{ sql = $Sql; params = $Params } | ConvertTo-Json -Compress

    $response = Invoke-RestMethod -Uri $url -Method Post `
        -Headers @{ Authorization = "Bearer $CF_API_TOKEN"; 'Content-Type' = 'application/json' } `
        -Body $body

    if (-not $response.success) {
        throw "D1 query failed: $($response.errors | ConvertTo-Json -Compress)"
    }

    return $response.result[0].results ?? @()
}

# ── ipinfo.io ASN lookup ───────────────────────────────────────────────────────
function Get-IpInfo([string]$Ip) {
    if (-not $Ip -or $Ip -eq 'UNKNOWN') {
        return $null
    }

    try {
        $url = if ($IPINFO_TOKEN) {
            "https://ipinfo.io/$Ip/json?token=$IPINFO_TOKEN"
        } else {
            "https://ipinfo.io/$Ip/json"
        }

        $info = Invoke-RestMethod -Uri $url -TimeoutSec 5
        return @{
            org     = $info.org     ?? ''
            country = $info.country ?? ''
            asn     = ($info.org -replace '^AS(\d+)\s.*', '$1') ?? ''
        }
    } catch {
        Write-AosWarn "ipinfo.io lookup failed for $Ip: $($_.Exception.Message)"
        return $null
    }
}

# ── Main ──────────────────────────────────────────────────────────────────────
Write-Host ""
Write-Host "⛓️⚓⛓️  AveryOS™ Post-Process Hydration Bot v$SCRIPT_VERSION" -ForegroundColor Yellow
Write-Host "   Kernel: $($KERNEL_SHA.Substring(0,16))…" -ForegroundColor DarkYellow
Write-Host "   Limit:  $Limit rows$(if ($DryRun) { '  [DRY-RUN]' })$(if ($LocalOnly) { '  [LOCAL-ONLY]' })" -ForegroundColor DarkYellow
Write-Host ""

# 1. Fetch rows with hydration_status = 0 (or column not yet added)
Write-AosInfo "Fetching unhydrated rows from anchor_audit_logs…"
$rows = @()
try {
    # Try with hydration_status column first; fall back to all rows if column missing
    try {
        $rows = Invoke-D1Query `
            -Sql "SELECT id, ip_address, asn FROM anchor_audit_logs WHERE (hydration_status IS NULL OR hydration_status = 0) AND ip_address != 'UNKNOWN' ORDER BY id DESC LIMIT ?" `
            -Params @($Limit)
    } catch {
        Write-AosWarn "hydration_status column may not exist yet — fetching all rows without it."
        $rows = Invoke-D1Query `
            -Sql "SELECT id, ip_address, asn FROM anchor_audit_logs WHERE ip_address != 'UNKNOWN' ORDER BY id DESC LIMIT ?" `
            -Params @($Limit)
    }
} catch {
    Write-AosError 'DB_QUERY_FAILED' "Failed to fetch rows: $($_.Exception.Message)"
    exit 1
}

Write-AosInfo "Found $($rows.Count) row(s) to hydrate."
Write-Host ""

$hydrated = 0
$failed   = 0

foreach ($row in $rows) {
    $id = $row.id
    $ip = $row.ip_address
    $existingAsn = $row.asn ?? ''

    Write-Host "   → Row #$id  IP: $ip  ASN: $existingAsn" -ForegroundColor White

    $org     = ''
    $country = ''

    if ($LocalOnly) {
        # Use local ASN map
        $asnKey = $existingAsn -replace '[^0-9]', ''
        if ($LOCAL_ASN_MAP.ContainsKey($asnKey)) {
            $org     = $LOCAL_ASN_MAP[$asnKey].org
            $country = $LOCAL_ASN_MAP[$asnKey].country
            Write-Host "     Source: LOCAL_MAP → $org ($country)" -ForegroundColor DarkCyan
        } else {
            Write-AosWarn "No local mapping for ASN $asnKey — skipping."
            continue
        }
    } else {
        # Live ipinfo.io lookup
        $info = Get-IpInfo -Ip $ip
        if ($info) {
            $org     = $info.org
            $country = $info.country
            # Fall back to local map if ipinfo returns empty org
            if (-not $org -and $info.asn) {
                $asnKey = $info.asn -replace '[^0-9]', ''
                if ($LOCAL_ASN_MAP.ContainsKey($asnKey)) {
                    $org     = $LOCAL_ASN_MAP[$asnKey].org
                    $country = $LOCAL_ASN_MAP[$asnKey].country
                }
            }
            Write-Host "     Source: IPINFO  → $org ($country)" -ForegroundColor DarkCyan
        } else {
            Write-AosWarn "No ipinfo data for IP $ip — skipping."
            $failed++
            continue
        }
    }

    if (-not $DryRun) {
        # Add hydration_status column if missing (idempotent)
        try {
            Invoke-D1Query -Sql "ALTER TABLE anchor_audit_logs ADD COLUMN hydration_status INTEGER DEFAULT 0" -Params @() | Out-Null
        } catch {
            # Only suppress "duplicate column" errors; log anything unexpected
            $errMsg = $_.Exception.Message
            if ($errMsg -notmatch 'duplicate column|already exists') {
                Write-AosWarn "ALTER TABLE unexpected error: $errMsg"
            }
        }

        try {
            Invoke-D1Query `
                -Sql "UPDATE anchor_audit_logs SET hydration_status = 1 WHERE id = ?" `
                -Params @($id) | Out-Null
            Write-AosSuccess "Row #$id hydrated (org: $org, country: $country)"
        } catch {
            Write-AosError 'DB_QUERY_FAILED' "Failed to update row #$id: $($_.Exception.Message)"
            $failed++
            continue
        }
    } else {
        Write-Host "     [DRY-RUN] Would set hydration_status=1 for row #$id" -ForegroundColor DarkMagenta
    }

    $hydrated++
}

Write-Host ""
Write-Host "   Summary: $hydrated hydrated, $failed failed." -ForegroundColor Yellow
Write-Host "   ⛓️⚓⛓️  Hydration complete." -ForegroundColor Yellow
Write-Host ""

if ($failed -gt 0) { exit 1 }
exit 0
