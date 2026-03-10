#!/usr/bin/env pwsh
<#
.SYNOPSIS
    AveryOS™ DNS Proxy Shield — Phase 98 (Roadmap Item 10)

.DESCRIPTION
    Monitors Stripe and Firebase DNS records for averyos.com and alerts if any
    critical record moves to Cloudflare "Proxied" (orange-cloud) status, which
    would interfere with Stripe's webhook TLS verification or Firebase's domain
    validation.

    Records monitored:
        mail.averyos.com              — Stripe email relay
        _amazonses.averyos.com        — SES DKIM probe detector
        enterpriseregistration.averyos.com  — Microsoft/Azure enrollment signal

    Exit codes:
        0 — All monitored records are in expected state
        1 — One or more records have drifted to Proxied (alert triggered)

.PARAMETER SiteUrl
    Base URL of the live AveryOS site. Default: https://averyos.com

.PARAMETER VaultPassphrase
    VAULT_PASSPHRASE for posting DNS probe alerts to /api/v1/forensics/dns-probes.

.PARAMETER DryRun
    Preview alerts without posting to the API.

.EXAMPLE
    ./scripts/verify-dns.ps1 -SiteUrl https://averyos.com -VaultPassphrase $env:VAULT_PASSPHRASE
#>

[CmdletBinding()]
param(
    [string] $SiteUrl        = ($env:SITE_URL          ?? "https://averyos.com"),
    [string] $VaultPassphrase = ($env:VAULT_PASSPHRASE ?? ""),
    [switch] $DryRun
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

# ── Records to monitor ─────────────────────────────────────────────────────────
# Format: @{ Subdomain = "…"; RecordType = "TXT|CNAME|MX"; ExpectedValue = "…" }
$MonitoredRecords = @(
    @{ Subdomain = "_amazonses";             RecordType = "TXT";   Description = "SES DKIM probe detector" },
    @{ Subdomain = "enterpriseregistration"; RecordType = "CNAME"; Description = "Microsoft/Azure enrollment signal" },
    @{ Subdomain = "mail";                   RecordType = "MX";    Description = "Stripe/SendGrid mail relay" }
)

$Domain  = "averyos.com"
$Drifted = @()

Write-Host ""
Write-Host "⛓️⚓⛓️  AveryOS™ DNS Proxy Shield"
Write-Host "   Domain:  $Domain"
Write-Host "   Dry-run: $DryRun"
Write-Host ""

foreach ($record in $MonitoredRecords) {
    $fqdn = "$($record.Subdomain).$Domain"
    Write-Host "→ Resolving $fqdn [$($record.RecordType)] …" -NoNewline

    try {
        $result = Resolve-DnsName -Name $fqdn -Type $record.RecordType -ErrorAction SilentlyContinue
        if ($null -eq $result -or $result.Count -eq 0) {
            Write-Host " NOT FOUND (expected for probe-only records)" -ForegroundColor Yellow
            continue
        }
        Write-Host " RESOLVED ($($result.Count) record(s))" -ForegroundColor Green

        # Check if any answer IP is a Cloudflare proxy IP range (104.16.0.0/12 or 172.64.0.0/13)
        foreach ($r in $result) {
            if ($r.PSObject.Properties["IPAddress"]) {
                $ip = $r.IPAddress
                # 104.16.0.0/12 → 104.16.x.x – 104.31.x.x
                $is104Range = $ip -match "^104\.(1[6-9]|2[0-9]|3[0-1])\."
                # 172.64.0.0/13 → 172.64.x.x – 172.71.x.x
                $is172Range = $ip -match "^172\.(6[4-9]|7[01])\."
                if ($is104Range -or $is172Range) {
                    $msg = "PROXY DRIFT DETECTED: $fqdn resolves to Cloudflare proxy IP $ip"
                    Write-Host "   ⚠  $msg" -ForegroundColor Red
                    $Drifted += @{ Subdomain = $record.Subdomain; FQDN = $fqdn; IP = $ip; Description = $record.Description; Message = $msg }
                }
            }
        }
    } catch {
        Write-Host " ERROR: $_" -ForegroundColor Red
    }
}

Write-Host ""

if ($Drifted.Count -eq 0) {
    Write-Host "✔ All monitored DNS records are in expected state. No proxy drift detected." -ForegroundColor Green
    exit 0
}

# ── Post alerts ────────────────────────────────────────────────────────────────
Write-Host "⚠  $($Drifted.Count) record(s) drifted to Proxied status. Posting alerts…" -ForegroundColor Red
Write-Host ""

foreach ($d in $Drifted) {
    Write-Host "   Drift: $($d.FQDN) → $($d.IP)"

    if (-not $DryRun -and $SiteUrl -and $VaultPassphrase) {
        $body = @{
            subdomain   = $d.Subdomain
            source_ip   = $d.IP
            description = $d.Description
        } | ConvertTo-Json -Compress

        try {
            $resp = Invoke-RestMethod `
                -Uri     "$SiteUrl/api/v1/forensics/dns-probes" `
                -Method  POST `
                -Headers @{ "Content-Type" = "application/json"; "Authorization" = "Bearer $VaultPassphrase" } `
                -Body    $body
            Write-Host "   Alert posted: $($resp.status)" -ForegroundColor Yellow
        } catch {
            Write-Host "   Failed to post alert: $_" -ForegroundColor Red
        }
    } elseif ($DryRun) {
        Write-Host "   [DRY-RUN] Alert would be posted to $SiteUrl/api/v1/forensics/dns-probes" -ForegroundColor Cyan
    }
}

Write-Host ""
exit 1
