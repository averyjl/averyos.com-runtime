<#
.SYNOPSIS
    AveryOS™ DNS Proxy Shield — Phase 98

.DESCRIPTION
    Verifies DNS resolution for averyos.com and its sub-domains against
    expected IP addresses / CNAME targets.  Any discrepancy (DNS hijacking,
    BGP leak, or resolver poisoning) is reported to the sovereign forensics
    endpoint POST /api/v1/forensics/dns-probes as a drift event.

    Designed to run as a scheduled task on Windows or via GitHub Actions on
    a Windows runner.

.PARAMETER SiteUrl
    Base URL of the live AveryOS™ site (default: https://averyos.com).

.PARAMETER VaultPassphrase
    Bearer token for authenticating against the /api/v1/forensics/dns-probes
    endpoint.  Reads from env var VAULT_PASSPHRASE if not supplied.

.PARAMETER DryRun
    When set, DNS results are printed but NOT sent to the forensics endpoint.

.EXAMPLE
    .\verify-dns.ps1 -VaultPassphrase "secret" -DryRun

.NOTES
    ⛓️⚓⛓️  CreatorLock: Jason Lee Avery (ROOT0) 🤛🏻
    © 1992–2026 Jason Lee Avery / AveryOS™. All Rights Reserved.
#>

param(
    [string]$SiteUrl        = "https://averyos.com",
    [string]$VaultPassphrase = $env:VAULT_PASSPHRASE,
    [switch]$DryRun
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

# ── Constants ─────────────────────────────────────────────────────────────────

$KERNEL_VERSION = "v3.6.2"
$KERNEL_SHA     = "cf83e1357eefb8bdf1542850d66d8007d620e4050b5715dc83f4a921d36ce9ce47d0d13c5d85f2b0ff8318d2877eec2f63b931bd47417a81a538327af927da3e"
$FORENSICS_URL  = "$SiteUrl/api/v1/forensics/dns-probes"

# ── DNS probe definitions ─────────────────────────────────────────────────────
# Each entry: @{ Domain; RecordType; Expected }
# "ANY" in Expected means "any non-empty result is acceptable" (existence check)

$DNS_PROBES = @(
    @{ Domain = "averyos.com";               RecordType = "A";     Expected = "ANY" }
    @{ Domain = "www.averyos.com";           RecordType = "CNAME"; Expected = "ANY" }
    @{ Domain = "averyos.com";               RecordType = "MX";    Expected = "ANY" }
    @{ Domain = "averyos.com";               RecordType = "TXT";   Expected = "ANY" }
    @{ Domain = "api.averyos.com";           RecordType = "CNAME"; Expected = "ANY" }
    @{ Domain = "studio.averyos.com";        RecordType = "CNAME"; Expected = "ANY" }
)

# ── Helpers ───────────────────────────────────────────────────────────────────

function Write-SovereignInfo([string]$Message) {
    Write-Host "  [INFO] $Message" -ForegroundColor Cyan
}

function Write-SovereignWarn([string]$Message) {
    Write-Host "  [WARN] $Message" -ForegroundColor Yellow
}

function Write-SovereignError([string]$Message) {
    Write-Host "  [ERROR] $Message" -ForegroundColor Red
}

function Write-SovereignOk([string]$Message) {
    Write-Host "  [ OK ] $Message" -ForegroundColor Green
}

function Resolve-DnsRecord([string]$Domain, [string]$RecordType) {
    try {
        $results = Resolve-DnsName -Name $Domain -Type $RecordType -ErrorAction Stop
        if ($RecordType -eq "A") {
            return ($results | Where-Object { $_.QueryType -eq "A" } | Select-Object -ExpandProperty IPAddress) -join ", "
        } elseif ($RecordType -eq "CNAME") {
            return ($results | Where-Object { $_.QueryType -eq "CNAME" } | Select-Object -ExpandProperty NameHost) -join ", "
        } elseif ($RecordType -eq "MX") {
            return ($results | Where-Object { $_.QueryType -eq "MX" } | Select-Object -ExpandProperty NameExchange) -join ", "
        } elseif ($RecordType -eq "TXT") {
            return ($results | Where-Object { $_.QueryType -eq "TXT" } | Select-Object -ExpandProperty Strings) -join "; "
        } else {
            return ($results | Select-Object -ExpandProperty Name -First 1) ?? ""
        }
    } catch {
        return ""
    }
}

function Get-ResolverIp {
    try {
        # Attempt to resolve a known sentinel sub-domain to discover the active resolver IP.
        # "resolver.averyos.com" is an intentional sentinel: if it resolves it means DNS is
        # operating normally and we can use the returned IP as the resolver identifier.
        # If the domain does not exist (NXDOMAIN) the catch block returns the default gateway DNS.
        $resolver = (Resolve-DnsName -Name "resolver.averyos.com" -ErrorAction SilentlyContinue |
                     Select-Object -First 1 -ExpandProperty IPAddress)
        if (-not $resolver) {
            # Fall back to the machine's configured DNS server address
            $resolver = (Get-DnsClientServerAddress -AddressFamily IPv4 |
                         Select-Object -First 1 -ExpandProperty ServerAddresses) ?? "127.0.0.1"
        }
        return $resolver
    } catch {
        return "127.0.0.1"
    }
}

function Send-DnsProbe([hashtable]$ProbeResult) {
    if ($DryRun) {
        Write-SovereignInfo "[DRY-RUN] Would POST: $($ProbeResult | ConvertTo-Json -Compress)"
        return
    }

    if (-not $VaultPassphrase) {
        Write-SovereignWarn "VAULT_PASSPHRASE not set — cannot POST forensics event."
        return
    }

    try {
        $body    = $ProbeResult | ConvertTo-Json -Compress
        $headers = @{
            "Authorization" = "Bearer $VaultPassphrase"
            "Content-Type"  = "application/json"
        }
        $response = Invoke-RestMethod -Uri $FORENSICS_URL -Method POST -Headers $headers -Body $body -ErrorAction Stop
        Write-SovereignOk "Probe ingested: $($response.status)"
    } catch {
        Write-SovereignError "Failed to POST DNS probe: $_"
    }
}

# ── Main ──────────────────────────────────────────────────────────────────────

Write-Host ""
Write-Host "⛓️⚓⛓️  AveryOS™ DNS Proxy Shield — Phase 98" -ForegroundColor Magenta
Write-Host "  Kernel: $KERNEL_VERSION | SHA: $($KERNEL_SHA.Substring(0,16))..." -ForegroundColor DarkGray
Write-Host "  Target: $SiteUrl | DryRun: $DryRun" -ForegroundColor DarkGray
Write-Host ""

$resolverIp = Get-ResolverIp
$driftCount = 0
$totalCount = 0
$rayPrefix  = "dns-shield-$(Get-Date -Format 'yyyyMMddHHmmss')"

foreach ($probe in $DNS_PROBES) {
    $domain     = $probe.Domain
    $recordType = $probe.RecordType
    $expected   = $probe.Expected
    $totalCount++

    Write-SovereignInfo "Checking $recordType $domain …"

    $resolved = Resolve-DnsRecord -Domain $domain -RecordType $recordType
    $isDrift  = $false
    $rayId    = "$rayPrefix-$totalCount"

    if ([string]::IsNullOrWhiteSpace($resolved)) {
        Write-SovereignWarn "$recordType $domain — NO RESULT (possible NXDOMAIN or timeout)"
        $isDrift = $true
    } elseif ($expected -ne "ANY" -and $resolved -notlike "*$expected*") {
        Write-SovereignWarn "$recordType $domain — DRIFT DETECTED: got '$resolved', expected '$expected'"
        $isDrift = $true
    } else {
        Write-SovereignOk "$recordType $domain → $resolved"
    }

    if ($isDrift) { $driftCount++ }

    # Build probe payload
    $probePayload = @{
        domain      = $domain
        resolver_ip = $resolverIp
        record_type = $recordType
        resolved_to = if ($resolved) { $resolved } else { $null }
        expected    = if ($expected -ne "ANY") { $expected } else { $null }
        is_drift    = $isDrift
        ray_id      = $rayId
    }

    Send-DnsProbe -ProbeResult $probePayload
}

Write-Host ""
Write-Host "── Summary ──────────────────────────────────────────────────────" -ForegroundColor DarkGray
Write-Host "  Total probes : $totalCount" -ForegroundColor White
if ($driftCount -gt 0) {
    Write-Host "  Drift events : $driftCount  ⚠️" -ForegroundColor Yellow
} else {
    Write-Host "  Drift events : 0  ✅" -ForegroundColor Green
}
Write-Host ""
Write-Host "⛓️⚓⛓️  © 1992–2026 Jason Lee Avery / AveryOS™" -ForegroundColor Magenta
Write-Host ""

if ($driftCount -gt 0) {
    exit 1
}
exit 0
