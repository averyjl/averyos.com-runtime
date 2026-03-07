# AveryOS™ Sovereign Secret Vaulting Script — scripts/vault-secrets.ps1
#
# Securely vaults all AveryOS™ Cloudflare Worker secrets via `wrangler secret put`.
# Prompts for each value using Read-Host -AsSecureString so the input is never
# echoed to the console, never written to a log file, and never stored in memory
# beyond the current execution.
#
# Usage:
#   .\scripts\vault-secrets.ps1
#   .\scripts\vault-secrets.ps1 -SkipOptional      # only vault required secrets
#   .\scripts\vault-secrets.ps1 -Verify            # verify handshake after vaulting
#   .\scripts\vault-secrets.ps1 -DryRun            # print commands without executing
#
# ⛓️⚓⛓️  CreatorLock: Jason Lee Avery (ROOT0) 🤛🏻

param(
    [switch]$SkipOptional,
    [switch]$Verify,
    [switch]$DryRun
)

$ErrorActionPreference = "Stop"

# ── Constants ────────────────────────────────────────────────────────────────
$KERNEL_SHA     = "cf83e1357eefb8bdf1542850d66d8007d620e4050b5715dc83f4a921d36ce9ce47d0d13c5d85f2b0ff8318d2877eec2f63b931bd47417a81a538327af927da3e"
$KERNEL_VERSION = "v3.6.2"
$SITE_URL       = "https://averyos.com"
$D1_DB_NAME     = "averyos_kernel_db"
$WORKER_NAME    = "averyoscom-runtime"

# ── Helpers ──────────────────────────────────────────────────────────────────

function Write-VaultLog {
    param([string]$Level, [string]$Message)
    $ts = Get-Date -Format "yyyy-MM-ddTHH:mm:ssZ"
    $prefix = switch ($Level) {
        "INFO"  { "✅" }
        "WARN"  { "⚠️ " }
        "ERROR" { "❌" }
        "SKIP"  { "⏭️ " }
        default { "  " }
    }
    Write-Host "[$ts] $prefix  $Message"
}

function Read-SecureValue {
    param([string]$PromptText)
    $secure = Read-Host -Prompt $PromptText -AsSecureString
    # Convert SecureString to plain text only for the duration of the pipe to wrangler.
    # The plain text is never assigned to a PowerShell variable.
    $bstr = [System.Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
    try {
        return [System.Runtime.InteropServices.Marshal]::PtrToStringBSTR($bstr)
    } finally {
        [System.Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bstr)
        $secure.Dispose()
    }
}

function Invoke-VaultSecret {
    param(
        [string]$SecretName,
        [string]$PlainValue,
        [string[]]$ExtraArgs = @()
    )
    if ($DryRun) {
        Write-VaultLog "INFO" "[DRY RUN] Would run: wrangler secret put $SecretName $($ExtraArgs -join ' ')"
        return
    }
    # Pipe the plain-text value directly to wrangler via stdin.
    # It is never written to disk or printed to the console.
    $PlainValue | npx wrangler secret put $SecretName @ExtraArgs
    if ($LASTEXITCODE -ne 0) {
        Write-VaultLog "ERROR" "Failed to vault secret: $SecretName"
        throw "wrangler secret put $SecretName failed (exit code $LASTEXITCODE)"
    }
    Write-VaultLog "INFO" "Vaulted: $SecretName ✅"
    # Zero out the plain-text value from memory immediately after use
    $PlainValue = $null
    [System.GC]::Collect()
}

# ── Secret Manifest ───────────────────────────────────────────────────────────
# Each entry: [name, description, required]
$REQUIRED_SECRETS = @(
    @{ Name = "VAULT_PASSPHRASE";          Desc = "Hardware vault passphrase (Note 20 / USB anchor)";                 Required = $true  },
    @{ Name = "GITHUB_PAT";                Desc = "GitHub Personal Access Token (repo + workflow scope)";             Required = $true  },
    @{ Name = "STRIPE_SECRET_KEY";         Desc = "Stripe secret key (sk_live_... or sk_test_...)";                   Required = $true  },
    @{ Name = "STRIPE_WEBHOOK_SECRET";     Desc = "Stripe webhook signing secret (whsec_...)";                        Required = $true  },
    @{ Name = "SOVEREIGN_ANCHOR_SALT";     Desc = "Anchor salt (.anchor-salt value from npm run setup)";              Required = $true  },
    @{ Name = "TAI_LICENSE_KEY";           Desc = "TAI™ license gate key for /api/v1/resonance";                     Required = $true  },
    @{ Name = "BLOCKCHAIN_API_KEY";        Desc = "BlockCypher API key for BTC block anchor salt";                    Required = $false },
    @{ Name = "GABRIEL_SENTINEL_WEBHOOK";  Desc = "GabrielOS™ Sentinel webhook URL";                                 Required = $false },
    @{ Name = "PUSHOVER_APP_TOKEN";        Desc = "Pushover app token for Tier-9 mobile alerts";                     Required = $false },
    @{ Name = "PUSHOVER_USER_KEY";         Desc = "Pushover user key for Tier-9 mobile alerts";                      Required = $false },
    @{ Name = "FIREBASE_PROJECT_ID";       Desc = "Firebase Admin SDK project ID";                                    Required = $false },
    @{ Name = "FIREBASE_CLIENT_EMAIL";     Desc = "Firebase Admin SDK client email";                                  Required = $false },
    @{ Name = "FIREBASE_PRIVATE_KEY";      Desc = "Firebase Admin SDK private key (base64 or raw PEM)";              Required = $false },
    @{ Name = "FIREBASE_DATABASE_URL";     Desc = "Firebase Realtime Database URL";                                   Required = $false },
    @{ Name = "NODE_01_ID";                Desc = "Phone node identifier (NODE_01 — Note 20)";                        Required = $false },
    @{ Name = "NODE_02_ID";                Desc = "PC node identifier (NODE_02 — Ollama host)";                       Required = $false },
    @{ Name = "CLOUDFLARE_DNS_API_TOKEN";  Desc = "Cloudflare DNS:Read API token for TXT anchor verification";       Required = $false },
    @{ Name = "CREATOR_WEBHOOK_URL";       Desc = "licenseGate.js SIG_MISMATCH notification webhook URL";            Required = $false }
)

$GABRIEL_SECRETS = @(
    @{ Name = "VAULT_PASSPHRASE";          Desc = "Vault passphrase (shared with main worker)";                       Required = $true  },
    @{ Name = "GITHUB_PAT";                Desc = "GitHub PAT (shared with main worker)";                             Required = $true  },
    @{ Name = "BITCOIN_API_KEY";           Desc = "Bitcoin API key for gabriel-gatekeeper BTC anchoring";             Required = $false },
    @{ Name = "GABRIEL_SENTINEL_WEBHOOK";  Desc = "Sentinel webhook URL (shared with main worker)";                   Required = $false },
    @{ Name = "GITHUB_WEBHOOK_SECRET";     Desc = "GitHub webhook signing secret for gabriel-gatekeeper";            Required = $false }
)

# ── Banner ────────────────────────────────────────────────────────────────────
Write-Host ""
Write-Host "⛓️⚓⛓️  AveryOS™ Sovereign Secret Vaulting"
Write-Host "── averyos_kernel_db ← $WORKER_NAME ──────────────────────────────────────"
Write-Host "   Kernel: $KERNEL_VERSION | SHA: $($KERNEL_SHA.Substring(0,16))..."
Write-Host "   Worker: $WORKER_NAME"
Write-Host "   DB:     $D1_DB_NAME"
if ($DryRun) { Write-Host "   ⚠️  DRY RUN MODE — no secrets will be written" }
Write-Host ""
Write-Host "   Input is HIDDEN — values are never printed to the console."
Write-Host "   Press Enter without a value to SKIP any secret."
Write-Host ""

# ── Main worker secrets ───────────────────────────────────────────────────────
Write-Host "━━━ MAIN WORKER: $WORKER_NAME ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
foreach ($secret in $REQUIRED_SECRETS) {
    if ($secret.Required -eq $false -and $SkipOptional) {
        Write-VaultLog "SKIP" "$($secret.Name) — optional, skipped (-SkipOptional)"
        continue
    }

    $tag = if ($secret.Required) { "[REQUIRED]" } else { "[optional]" }
    $plainValue = Read-SecureValue -PromptText "  $tag $($secret.Name) — $($secret.Desc)"

    if ([string]::IsNullOrWhiteSpace($plainValue)) {
        if ($secret.Required) {
            Write-VaultLog "WARN" "$($secret.Name) is REQUIRED but was skipped — vault this manually."
        } else {
            Write-VaultLog "SKIP" "$($secret.Name) — skipped"
        }
        $plainValue = $null
        continue
    }

    try {
        Invoke-VaultSecret -SecretName $secret.Name -PlainValue $plainValue
    } catch {
        Write-VaultLog "ERROR" "Failed to vault $($secret.Name): $_"
    } finally {
        $plainValue = $null
        [System.GC]::Collect()
    }
}

# ── Gabriel-gatekeeper worker secrets ─────────────────────────────────────────
Write-Host ""
Write-Host "━━━ GABRIEL-GATEKEEPER WORKER ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
Write-Host "   Config: workers/wrangler.gabriel-gatekeeper.toml"
foreach ($secret in $GABRIEL_SECRETS) {
    if ($secret.Required -eq $false -and $SkipOptional) {
        Write-VaultLog "SKIP" "$($secret.Name) — optional, skipped (-SkipOptional)"
        continue
    }

    $tag = if ($secret.Required) { "[REQUIRED]" } else { "[optional]" }
    $plainValue = Read-SecureValue -PromptText "  $tag GK/$($secret.Name) — $($secret.Desc)"

    if ([string]::IsNullOrWhiteSpace($plainValue)) {
        if ($secret.Required) {
            Write-VaultLog "WARN" "GK/$($secret.Name) is REQUIRED but was skipped — vault this manually."
        } else {
            Write-VaultLog "SKIP" "GK/$($secret.Name) — skipped"
        }
        $plainValue = $null
        continue
    }

    try {
        Invoke-VaultSecret -SecretName $secret.Name -PlainValue $plainValue `
            -ExtraArgs @("--config", "workers/wrangler.gabriel-gatekeeper.toml")
    } catch {
        Write-VaultLog "ERROR" "Failed to vault GK/$($secret.Name): $_"
    } finally {
        $plainValue = $null
        [System.GC]::Collect()
    }
}

# ── VAULT_PASSPHRASE handshake verification (Note 20 / cloud node) ────────────
if ($Verify) {
    Write-Host ""
    Write-Host "━━━ VAULT_PASSPHRASE HANDSHAKE CHECK (Note 20 → Cloud Node) ━━━━━━━━━━━━━"
    Write-Host "   Checking $SITE_URL/api/gatekeeper/handshake-check ..."
    try {
        $response = Invoke-RestMethod `
            -Uri "$SITE_URL/api/gatekeeper/handshake-check" `
            -Method GET `
            -TimeoutSec 10 `
            -ErrorAction Stop

        $handshakeStatus = if ($response.status) { $response.status } else { "UNKNOWN" }
        $label           = if ($response.label)  { $response.label  } else { "" }

        if ($handshakeStatus -in @("LOCKED", "AUTHENTICATED")) {
            Write-VaultLog "INFO" "Handshake: $handshakeStatus $label ✅  — Note 20 can reach the cloud node."
        } else {
            Write-VaultLog "WARN" "Handshake returned status '$handshakeStatus' — verify VAULT_PASSPHRASE was vaulted correctly."
        }
    } catch {
        Write-VaultLog "WARN" "Handshake check failed: $_ — the Worker may still be deploying, retry in ~30 seconds."
    }
}

# ── Summary ───────────────────────────────────────────────────────────────────
Write-Host ""
Write-Host "━━━ VAULT COMPLETE ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
Write-Host "   ⛓️⚓⛓️  Sovereign secret vault sealed."
Write-Host "   To verify secrets are live:"
Write-Host "     npx wrangler secret list"
Write-Host "     npx wrangler secret list --config workers/wrangler.gabriel-gatekeeper.toml"
Write-Host "   To verify handshake (Note 20 ↔ cloud):"
Write-Host "     .\scripts\vault-secrets.ps1 -Verify"
Write-Host "   To apply D1 migrations:"
Write-Host "     npx wrangler d1 migrations apply $D1_DB_NAME --remote"
Write-Host ""
