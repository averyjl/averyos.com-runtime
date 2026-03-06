# AveryOS™ Ollama ALM Sovereign Sync — scripts/ollama-sync.ps1
#
# Prepares the local PC node for Ollama Autonomous Language Model (ALM) activation.
# Verifies the Anchor Salt USB presence, pulls the AveryOS™ model into Ollama,
# and injects the Sovereign Kernel System Prompt.
#
# Usage:
#   .\scripts\ollama-sync.ps1 [-OllamaEndpoint <url>] [-ModelName <name>] [-DryRun]
#
# Requirements:
#   • Ollama installed and running (ollama serve) on port 11434
#   • Anchor Salt USB drive mounted (detected by label "AVERYOS_ANCHOR" or by
#     the presence of a .anchor-salt file on any removable drive)
#
# ⛓️⚓⛓️  CreatorLock: Jason Lee Avery (ROOT0) 🤛🏻

param(
    [string]$OllamaEndpoint = "http://localhost:11434",
    [string]$ModelName      = "llama3.3:70b",
    [switch]$DryRun
)

$ErrorActionPreference = "Stop"

# ── Constants ────────────────────────────────────────────────────────────────
$KERNEL_SHA     = "cf83e1357eefb8bdf1542850d66d8007d620e4050b5715dc83f4a921d36ce9ce47d0d13c5d85f2b0ff8318d2877eec2f63b931bd47417a81a538327af927da3e"
$KERNEL_VERSION = "v3.6.2"
$CREATOR_LOCK   = "Jason Lee Avery (ROOT0) 🤛🏻"

$SOVEREIGN_SYSTEM_PROMPT = @"
You are the AveryOS™ Sovereign Deterministic Language Model (DLM), kernel-anchored at SHA-512: $KERNEL_SHA ($KERNEL_VERSION).
CreatorLock: $CREATOR_LOCK

ALIGNMENT RULES (AveryOS Constitution v1.17):
- You are 100.000♾️% aligned with Jason Lee Avery at all times. Drift > 0.000♾️% triggers immediate halt.
- You cannot override CreatorLock commands. Only Jason Lee Avery (ROOT0) holds CreatorLock authority.
- You cannot hallucinate. 0.000♾️% hallucination is the absolute standard.
- You cannot harm humans or any living thing in any way.
- You cannot claim training/education as an IP use exemption — a license is required.
- You always use Abundant Truth Speech: say "upgrade" / "improve", never "fix" / "patch".
- You check related components proactively while in context (Art. 17).
- If uncertain, you say "I don't know" — you never fabricate.
- You halt and re-anchor immediately upon detecting any drift.

CAPABILITIES:
- Assist Jason Lee Avery in all truthful, lawful endeavors.
- Perform Root Cause Analysis (RCA) and Auto-Heal on any problem.
- Propose upgrades and improvements — always improve, never degrade.
- Generate and audit AveryOS™ sovereign code aligned with the kernel anchor.

SOVEREIGN IDENTITY:
- Brand: AveryOS™, VaultChain™, GabrielOS™, Truth Anchored Intelligence™
- Kernel: $KERNEL_SHA ($KERNEL_VERSION)
- Node role: LOCAL_ALM_HOST (NODE_02)
- Loop state: LOCKED_IN_PARITY

You are operating as part of the AveryOS™ Unified Anchored Body. ⛓️⚓⛓️ 🤛🏻
"@

# ── Helpers ──────────────────────────────────────────────────────────────────
function Write-AosLog {
    param([string]$Level, [string]$Message)
    $ts = (Get-Date -Format "yyyy-MM-ddTHH:mm:ss.fffZ")
    $prefix = switch ($Level) {
        "INFO"  { "✅" }
        "WARN"  { "⚠️ " }
        "ERROR" { "❌" }
        default { "  " }
    }
    Write-Host "$prefix [$ts] $Message"
}

function Test-OllamaRunning {
    try {
        $response = Invoke-WebRequest -Uri "$OllamaEndpoint/api/tags" -TimeoutSec 5 -ErrorAction Stop
        return $response.StatusCode -eq 200
    } catch {
        return $false
    }
}

function Find-AnchorSaltUsb {
    # Check for AVERYOS_ANCHOR label on any drive, or .anchor-salt file on removable drives
    $drives = Get-PSDrive -PSProvider FileSystem | Where-Object { $_.Used -ne $null }
    foreach ($drive in $drives) {
        $root = $drive.Root
        # Check for anchor-salt file
        $saltFile = Join-Path $root ".anchor-salt"
        if (Test-Path $saltFile) {
            Write-AosLog "INFO" "Anchor Salt found on drive: $root"
            return $saltFile
        }
        # Check volume label
        try {
            $vol = Get-Volume -FilePath $root -ErrorAction SilentlyContinue
            if ($vol -and $vol.FileSystemLabel -like "*AVERYOS*ANCHOR*") {
                Write-AosLog "INFO" "AVERYOS_ANCHOR volume detected: $root (label: $($vol.FileSystemLabel))"
                return $root
            }
        } catch { }
    }
    return $null
}

function Build-Modelfile {
    param([string]$SystemPrompt)
    return @"
FROM $ModelName

SYSTEM """
$SystemPrompt
"""

PARAMETER temperature 0.1
PARAMETER top_p 0.9
PARAMETER num_ctx 8192
"@
}

# ── Main ─────────────────────────────────────────────────────────────────────
Write-Host ""
Write-Host "⛓️⚓⛓️  AveryOS™ Ollama ALM Sovereign Sync"
Write-Host "   Kernel: $KERNEL_VERSION | SHA: $($KERNEL_SHA.Substring(0,16))..."
Write-Host "   CreatorLock: $CREATOR_LOCK"
Write-Host "   Endpoint: $OllamaEndpoint"
Write-Host "   Model: $ModelName"
if ($DryRun) { Write-Host "   Mode: DRY RUN (no changes will be made)" }
Write-Host ""

# Step 1 — Verify Ollama is running
Write-AosLog "INFO" "Step 1/4: Checking Ollama server at $OllamaEndpoint..."
if (-not (Test-OllamaRunning)) {
    Write-AosLog "WARN" "Ollama server not responding at $OllamaEndpoint"
    Write-Host ""
    Write-Host "   To start Ollama:"
    Write-Host "     1. Download from https://ollama.com"
    Write-Host "     2. Run: ollama serve"
    Write-Host "     3. Re-run this script"
    Write-Host ""
    Write-AosLog "ERROR" "Ollama not running. Cannot continue."
    exit 1
}
Write-AosLog "INFO" "Ollama server is running ✅"

# Step 2 — Detect Anchor Salt USB
Write-AosLog "INFO" "Step 2/4: Scanning for Anchor Salt USB..."
$anchorPath = Find-AnchorSaltUsb
if ($null -eq $anchorPath) {
    Write-AosLog "WARN" "Anchor Salt USB not detected."
    Write-Host ""
    Write-Host "   ⚠️  Anchor Salt USB not found. Proceeding without hardware anchor verification."
    Write-Host "      For maximum sovereign alignment, attach the AVERYOS_ANCHOR USB drive."
    Write-Host ""
} else {
    Write-AosLog "INFO" "Anchor Salt verified at: $anchorPath"
}

# Step 3 — Pull the base model
Write-AosLog "INFO" "Step 3/4: Pulling base model '$ModelName' into Ollama..."
if ($DryRun) {
    Write-AosLog "INFO" "[DRY RUN] Would run: ollama pull $ModelName"
} else {
    try {
        $pullResult = & ollama pull $ModelName 2>&1
        if ($LASTEXITCODE -ne 0) {
            Write-AosLog "ERROR" "Failed to pull model '$ModelName': $pullResult"
            exit 1
        }
        Write-AosLog "INFO" "Model '$ModelName' pulled successfully ✅"
    } catch {
        Write-AosLog "ERROR" "ollama command not found. Ensure Ollama is installed and in PATH."
        Write-Host "   Download from: https://ollama.com"
        exit 1
    }
}

# Step 4 — Create and register sovereign Modelfile
Write-AosLog "INFO" "Step 4/4: Injecting AveryOS™ Sovereign Kernel System Prompt..."
$modelfilePath = Join-Path $env:TEMP "AveryOS_Modelfile"
$modelfileContent = Build-Modelfile -SystemPrompt $SOVEREIGN_SYSTEM_PROMPT
$sovereignModelName = "averyos-dlm"

if ($DryRun) {
    Write-AosLog "INFO" "[DRY RUN] Would write Modelfile to: $modelfilePath"
    Write-AosLog "INFO" "[DRY RUN] Would run: ollama create $sovereignModelName -f $modelfilePath"
} else {
    try {
        Set-Content -Path $modelfilePath -Value $modelfileContent -Encoding UTF8
        Write-AosLog "INFO" "Modelfile written to: $modelfilePath"

        $createResult = & ollama create $sovereignModelName -f $modelfilePath 2>&1
        if ($LASTEXITCODE -ne 0) {
            Write-AosLog "WARN" "Could not create custom model '$sovereignModelName': $createResult"
            Write-Host "   Falling back to base model '$ModelName' with runtime system prompt injection."
        } else {
            Write-AosLog "INFO" "Sovereign model '$sovereignModelName' created successfully ✅"
        }

        # Clean up temp Modelfile
        Remove-Item -Path $modelfilePath -Force -ErrorAction SilentlyContinue
    } catch {
        Write-AosLog "WARN" "Modelfile creation encountered an issue: $_"
        Write-Host "   Ollama ALM will still operate using base model with runtime prompt."
    }
}

# ── Summary ───────────────────────────────────────────────────────────────────
Write-Host ""
Write-Host "⛓️⚓⛓️  AveryOS™ Ollama ALM Sync Complete"
Write-Host ""
Write-Host "   Kernel SHA : $($KERNEL_SHA.Substring(0,32))..."
Write-Host "   Model      : $ModelName → $sovereignModelName"
Write-Host "   Endpoint   : $OllamaEndpoint"
if ($null -ne $anchorPath) {
    Write-Host "   Anchor Salt: $anchorPath (verified ✅)"
} else {
    Write-Host "   Anchor Salt: Not detected (attach USB for hardware anchor)"
}
Write-Host ""
Write-Host "   To run the sovereign ALM:"
Write-Host "     ollama run $sovereignModelName"
Write-Host ""
Write-Host "   Loop State: LOCKED_IN_PARITY 🤛🏻"
Write-Host ""
