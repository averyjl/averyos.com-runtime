# AveryOS™ Ollama MCP (Model Context Protocol) Server — scripts/mcp-server.ps1
#
# Establishes an MCP bridge between the local Ollama instance (NODE_02) and
# the AveryOS™ GitHub Copilot / cloud context.  Every response is SHA-512
# hashed and logged to the Cloudflare D1 VaultChain for permanent sovereign record.
#
# Requires: PowerShell 7+ (pwsh.exe). ConvertFrom-Json -AsHashtable is a PS6+ feature.
# The VS Code mcpServers config should point to pwsh.exe, not the legacy powershell.exe.
#
# Usage:
#   .\scripts\mcp-server.ps1 [-OllamaEndpoint <url>] [-ModelName <name>] [-DryRun]
#   .\scripts\mcp-server.ps1 -TcpMode [-Port <port>]  # TCP listener mode (legacy)
#
# Default mode: stdio (JSON-RPC over stdin/stdout — compatible with VS Code MCP "type":"stdio")
# TCP mode:     set -TcpMode to listen on the specified -Port instead
#
# Requirements:
#   • Ollama installed and running (ollama serve) on port 11434
#   • AVERYOS_D1_ACCOUNT_ID  env var (Cloudflare account ID)
#   • AVERYOS_D1_DATABASE_ID env var (D1 database ID)
#   • AVERYOS_D1_API_TOKEN   env var (Cloudflare API token with D1:Edit)
#
# ⛓️⚓⛓️  CreatorLock: Jason Lee Avery (ROOT0) 🤛🏻

param(
    [string]$OllamaEndpoint = "http://localhost:11434",
    [string]$ModelName      = "averyos-alm",
    # TCP mode (legacy) — when set, listens on $Port instead of using stdio
    [switch]$TcpMode,
    [int]$Port              = 11435,
    [switch]$DryRun,
    # Multi-repo bridge paths — override via -RepoPaths @("path1","path2")
    [string[]]$RepoPaths    = @(
        "$env:USERPROFILE\_repos\averyos-vaultchain-core",
        "$env:USERPROFILE\_repos\AveryOS_Capsule_Licensing_Gateway",
        "$env:USERPROFILE\_repos\AveryOS-Genesis-Architecture",
        "$env:USERPROFILE\_repos\AveryOS-Sovereign-Core",
        "$env:USERPROFILE\_repos\AveryOS_Terminal_FullStack",
        "$env:USERPROFILE\_repos\Stripe_Listener",
        "$env:USERPROFILE\_repos\AveryOS_PublicTerminal_Launch2026"
    )
)

$ErrorActionPreference = "Stop"

# ── Constants ────────────────────────────────────────────────────────────────
$KERNEL_SHA      = "cf83e1357eefb8bdf1542850d66d8007d620e4050b5715dc83f4a921d36ce9ce47d0d13c5d85f2b0ff8318d2877eec2f63b931bd47417a81a538327af927da3e"
$KERNEL_VERSION  = "v3.6.2"
$CREATOR_LOCK    = "Jason Lee Avery (ROOT0) 🤛🏻"
$D1_ACCOUNT_ID   = $env:AVERYOS_D1_ACCOUNT_ID
$D1_DATABASE_ID  = $env:AVERYOS_D1_DATABASE_ID
$D1_API_TOKEN    = $env:AVERYOS_D1_API_TOKEN
$D1_API_BASE     = "https://api.cloudflare.com/client/v4"

# Resolve and validate multi-repo bridge paths
$ActiveRepoPaths = $RepoPaths | Where-Object { Test-Path $_ }

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

# Compute SHA-512 hex digest of a UTF-8 string
function Get-Sha512 {
    param([string]$Input)
    $bytes  = [System.Text.Encoding]::UTF8.GetBytes($Input)
    $sha512 = [System.Security.Cryptography.SHA512]::Create()
    $hash   = $sha512.ComputeHash($bytes)
    return ($hash | ForEach-Object { $_.ToString("x2") }) -join ""
}

# POST to D1 REST API — log an Ollama response hash to sovereign_audit_logs
function Write-D1VaultLog {
    param(
        [string]$Prompt,
        [string]$ResponseText,
        [string]$PulseHash,
        [string]$ModelUsed
    )
    if (-not $D1_ACCOUNT_ID -or -not $D1_DATABASE_ID -or -not $D1_API_TOKEN) {
        Write-AosLog "WARN" "D1 credentials not configured — skipping VaultChain log."
        return
    }

    # Double-Lock Anchorage: use AOS_KERNEL_ROOT env var if set, fall back to $KERNEL_SHA constant.
    $kernelAnchor = if ($env:AOS_KERNEL_ROOT) { $env:AOS_KERNEL_ROOT } else { $KERNEL_SHA }
    $timestamp    = (Get-Date -Format "yyyy-MM-ddTHH:mm:ss.fffZ")

    # Insert into sovereign_audit_logs with correct schema column names + kernel_sha anchor.
    $sql  = "INSERT INTO sovereign_audit_logs (event_type, ip_address, target_path, user_agent, timestamp_ns, kernel_sha) VALUES (?, ?, ?, ?, ?, ?)"
    $body = @{
        sql    = $sql
        params = @("OLLAMA_ANCHOR", "NODE_02_LOCAL", "/mcp/ollama", $ModelUsed, $timestamp, $kernelAnchor)
    } | ConvertTo-Json -Compress

    $uri     = "$D1_API_BASE/accounts/$D1_ACCOUNT_ID/d1/database/$D1_DATABASE_ID/query"
    $headers = @{
        "Authorization" = "Bearer $D1_API_TOKEN"
        "Content-Type"  = "application/json"
    }

    try {
        if ($DryRun) {
            Write-AosLog "INFO" "[DRY RUN] Would log OLLAMA_ANCHOR pulse to D1: kernel=$($kernelAnchor.Substring(0,16))... pulse=$($PulseHash.Substring(0,32))..."
        } else {
            $result = Invoke-RestMethod -Uri $uri -Method POST -Headers $headers -Body $body
            if ($result.success) {
                Write-AosLog "INFO" "VaultChain OLLAMA_ANCHOR log written: kernel=$($kernelAnchor.Substring(0,16))... pulse=$($PulseHash.Substring(0,32))..."
            }
        }
    } catch {
        Write-AosLog "WARN" "D1 VaultChain write failed: $_"
    }
}

# Send a prompt to the local Ollama instance and return the response
function Invoke-OllamaQuery {
    param([string]$Prompt)
    $body = @{
        model  = $ModelName
        prompt = $Prompt
        stream = $false
    } | ConvertTo-Json -Compress
    $response = Invoke-RestMethod -Uri "$OllamaEndpoint/api/generate" -Method POST -ContentType "application/json" -Body $body
    return $response.response
}

# ── MCP Tool Definitions ─────────────────────────────────────────────────────
# These are surfaced via tools/list so the VS Code MCP dashboard and GitHub
# Copilot can enumerate and invoke them directly.
$TOOL_DEFINITIONS = @(
    @{
        name        = "read_capsule"
        description = "Read the contents of a sovereign AveryOS™ .aoscap capsule by its ID or filename. Searches capsules/ and public/manifest/capsules/ directories."
        inputSchema = @{
            type       = "object"
            properties = @{
                capsule_id = @{
                    type        = "string"
                    description = "Capsule ID or filename without extension (e.g. AOS-CAP-2026-L-01 or sovereign-index)"
                }
            }
            required   = @("capsule_id")
        }
    },
    @{
        name        = "verify_sha"
        description = "Verify a SHA-512 hash against the AveryOS™ Kernel Root (KERNEL_SHA cf83...). Returns ALIGNED when the hash matches the anchor, DRIFT_DETECTED otherwise."
        inputSchema = @{
            type       = "object"
            properties = @{
                hash = @{
                    type        = "string"
                    description = "SHA-512 hex digest to verify against KERNEL_SHA"
                }
            }
            required   = @("hash")
        }
    },
    @{
        name        = "bridge_vault"
        description = "Return the current VaultChain™ integrity status: kernel version, anchor SHA, active repo count, and timestamp. No arguments required."
        inputSchema = @{
            type       = "object"
            properties = @{}
        }
    }
)

# ── Tool Implementations ──────────────────────────────────────────────────────

function Invoke-ToolReadCapsule {
    param([hashtable]$Arguments)
    $capsuleId   = $Arguments.capsule_id
    $repoRoot    = Split-Path $PSScriptRoot -Parent
    $searchPaths = @(
        (Join-Path $repoRoot "capsules\$capsuleId"),
        (Join-Path $repoRoot "capsules\$capsuleId.aoscap"),
        (Join-Path $repoRoot "public\manifest\capsules\$capsuleId.json")
    )
    foreach ($path in $searchPaths) {
        $resolved = [System.IO.Path]::GetFullPath($path)
        if (Test-Path $resolved) {
            Write-AosLog "INFO" "read_capsule: found $resolved"
            return Get-Content $resolved -Raw -Encoding UTF8
        }
    }
    return "Capsule '$capsuleId' not found. Searched: $($searchPaths -join '; ')"
}

function Invoke-ToolVerifySha {
    param([hashtable]$Arguments)
    $hash = ($Arguments.hash ?? "").Trim().ToLower()
    if ($hash -eq $KERNEL_SHA) {
        return "ALIGNED: Hash matches KERNEL_SHA ($KERNEL_VERSION). ⛓️⚓⛓️ CreatorLock: $CREATOR_LOCK"
    }
    return "DRIFT_DETECTED: Hash does not match KERNEL_SHA. Provided: $hash"
}

function Invoke-ToolBridgeVault {
    $status = @{
        kernel_version = $KERNEL_VERSION
        kernel_sha     = $KERNEL_SHA
        creator_lock   = $CREATOR_LOCK
        status         = "LOCKED_IN_PARITY"
        active_repos   = $ActiveRepoPaths
        active_count   = $ActiveRepoPaths.Count
        total_repos    = $RepoPaths.Count
        timestamp      = (Get-Date -Format "yyyy-MM-ddTHH:mm:ss.fffZ")
    }
    return ($status | ConvertTo-Json -Compress -Depth 5)
}

# ── MCP Request Dispatcher ────────────────────────────────────────────────────
function Invoke-McpRequest {
    param([hashtable]$Request)
    $id     = $Request.id
    $method = $Request.method
    switch ($method) {
        "initialize" {
            return @{
                jsonrpc = "2.0"; id = $id
                result  = @{
                    protocolVersion = "2024-11-05"
                    capabilities    = @{
                        tools    = @{}
                        sampling = @{}
                    }
                    serverInfo = @{ name = "averyos-bridge"; version = $KERNEL_VERSION }
                }
            }
        }
        "notifications/initialized" {
            # Client sends this after initialize — no response needed for notifications
            return $null
        }
        "tools/list" {
            return @{
                jsonrpc = "2.0"; id = $id
                result  = @{ tools = $TOOL_DEFINITIONS }
            }
        }
        "tools/call" {
            $toolName  = $Request.params.name
            $toolArgs  = if ($Request.params.arguments) { $Request.params.arguments } else { @{} }
            # Ensure arguments is a hashtable
            if ($toolArgs -isnot [hashtable]) {
                $toolArgs = $toolArgs | ConvertTo-Json | ConvertFrom-Json -AsHashtable
            }
            Write-AosLog "INFO" "tools/call: $toolName"
            $output = switch ($toolName) {
                "read_capsule"  { Invoke-ToolReadCapsule  -Arguments $toolArgs }
                "verify_sha"    { Invoke-ToolVerifySha    -Arguments $toolArgs }
                "bridge_vault"  { Invoke-ToolBridgeVault }
                default         { "Unknown tool: $toolName" }
            }
            return @{
                jsonrpc = "2.0"; id = $id
                result  = @{
                    content = @(@{ type = "text"; text = $output })
                    isError = $false
                }
            }
        }
        "sampling/createMessage" {
            $messages   = $Request.params.messages
            $prompt     = ($messages | ForEach-Object { "$($_.role): $($_.content.text)" }) -join "`n"
            $repoContext = if ($ActiveRepoPaths.Count -gt 0) {
                $preview = ($ActiveRepoPaths | Select-Object -First 3 | ForEach-Object { Split-Path $_ -Leaf }) -join ", "
                $suffix  = if ($ActiveRepoPaths.Count -gt 3) { " (+$($ActiveRepoPaths.Count - 3) more)" } else { "" }
                "`n[AVERYOS_BRIDGE] Active repos ($($ActiveRepoPaths.Count)): $preview$suffix`n"
            } else { "" }
            $fullPrompt   = "$repoContext$prompt"
            Write-AosLog "INFO" "MCP sampling request received (model: $ModelName)"
            $responseText = Invoke-OllamaQuery -Prompt $fullPrompt
            $pulseHash    = Get-Sha512 -Input "${KERNEL_SHA}:${fullPrompt}:${responseText}"
            Write-D1VaultLog -Prompt $fullPrompt -ResponseText $responseText -PulseHash $pulseHash -ModelUsed $ModelName
            return @{
                jsonrpc = "2.0"; id = $id
                result  = @{
                    role            = "assistant"
                    content         = @{ type = "text"; text = $responseText }
                    model           = $ModelName
                    stopReason      = "endTurn"
                    sovereignAnchor = $KERNEL_SHA
                    pulseHash       = $pulseHash
                    activeRepos     = $ActiveRepoPaths
                }
            }
        }
        default {
            return @{ jsonrpc = "2.0"; id = $id; error = @{ code = -32601; message = "Method not found: $method" } }
        }
    }
}

# ── Stdio Server (default — VS Code MCP "type":"stdio") ─────────────────────
function Start-McpStdioServer {
    Write-AosLog "INFO" "averyos-bridge MCP stdio server ready ⛓️⚓⛓️"
    $stdin  = [Console]::In
    $stdout = [Console]::Out
    while ($true) {
        $line = $stdin.ReadLine()
        if ($null -eq $line) { break }
        if ($line.Trim() -eq "") { continue }
        try {
            $request  = $line | ConvertFrom-Json -AsHashtable
            $response = Invoke-McpRequest -Request $request
            # Notifications return $null — no response to send
            if ($null -ne $response) {
                $json = $response | ConvertTo-Json -Compress -Depth 10
                $stdout.WriteLine($json)
                $stdout.Flush()
            }
        } catch {
            $errResponse = @{
                jsonrpc = "2.0"; id = $null
                error   = @{ code = -32700; message = "Parse error: $_" }
            }
            $stdout.WriteLine(($errResponse | ConvertTo-Json -Compress))
            $stdout.Flush()
        }
    }
}

# ── TCP Listener (legacy — use -TcpMode to activate) ─────────────────────────
function Start-McpTcpServer {
    $listener = [System.Net.Sockets.TcpListener]::new([System.Net.IPAddress]::Loopback, $Port)
    $listener.Start()
    Write-AosLog "INFO" "MCP TCP Server listening on 127.0.0.1:$Port"
    try {
        while ($true) {
            $client = $listener.AcceptTcpClient()
            $stream = $client.GetStream()
            $reader = [System.IO.StreamReader]::new($stream, [System.Text.Encoding]::UTF8)
            $writer = [System.IO.StreamWriter]::new($stream, [System.Text.Encoding]::UTF8)
            $writer.AutoFlush = $true
            try {
                while (-not $reader.EndOfStream) {
                    $line = $reader.ReadLine()
                    if ($null -eq $line -or $line.Trim() -eq "") { continue }
                    $request  = $line | ConvertFrom-Json -AsHashtable
                    $response = Invoke-McpRequest -Request $request
                    if ($null -ne $response) {
                        $writer.WriteLine(($response | ConvertTo-Json -Compress -Depth 10))
                    }
                }
            } catch { Write-AosLog "WARN" "Client error: $_" } finally { $reader.Dispose(); $writer.Dispose(); $client.Close() }
        }
    } finally { $listener.Stop() }
}

# ── Entry Point ───────────────────────────────────────────────────────────────
# In stdio mode (default), diagnostics go to stderr so they don't corrupt the
# JSON-RPC stream on stdout.  In TCP mode they go to stdout as before.
$diagStream = if ($TcpMode) { "stdout" } else { "stderr" }

if ($diagStream -eq "stderr") {
    [Console]::Error.WriteLine("")
    [Console]::Error.WriteLine("⛓️⚓⛓️  AveryOS™ Ollama MCP Server (stdio mode)")
    [Console]::Error.WriteLine("── Multi-Repo Bridge ─────────────────────────────────────────────────────")
    foreach ($repoPath in $RepoPaths) {
        $found  = Test-Path $repoPath
        $icon   = if ($found) { "+" } else { "~" }
        $status = if ($found) { "LOCKED_IN_PARITY" } else { "OFFLINE" }
        [Console]::Error.WriteLine("   $icon $repoPath  [$status]")
    }
    $parityCount = $ActiveRepoPaths.Count
    [Console]::Error.WriteLine("   Active: $parityCount/$($RepoPaths.Count) repos`n")
} else {
    Write-Host "`n⛓️⚓⛓️  AveryOS™ Ollama MCP Server (TCP mode)"
    Write-Host "── Multi-Repo Bridge ─────────────────────────────────────────────────────"
    foreach ($repoPath in $RepoPaths) {
        $found  = Test-Path $repoPath
        $icon   = if ($found) { "✅" } else { "⚠️ " }
        $status = if ($found) { "LOCKED_IN_PARITY" } else { "OFFLINE" }
        Write-Host "   $icon $repoPath  [$status]"
    }
    $parityCount = $ActiveRepoPaths.Count
    Write-Host "   Active: $parityCount/$($RepoPaths.Count) repos — $(if ($parityCount -eq $RepoPaths.Count) { 'ALL LOCKED_IN_PARITY ✅' } else { "$parityCount LOCKED_IN_PARITY ⚠️" })`n"
}

if ($DryRun) {
    if ($diagStream -eq "stderr") { [Console]::Error.WriteLine("[DRY RUN] Mode active - exiting.") }
    else { Write-AosLog "INFO" "[DRY RUN] Mode active - exiting." }
    exit 0
}

# Stdio mode does not require Ollama to be running (tools work without it)
if ($TcpMode) {
    try {
        $tags = Invoke-RestMethod -Uri "$OllamaEndpoint/api/tags" -TimeoutSec 5
        Write-AosLog "INFO" "Ollama server running — $(($tags.models).Count) model(s) loaded"
    } catch { Write-AosLog "ERROR" "Ollama not reachable at $OllamaEndpoint." ; exit 1 }
    Write-AosLog "INFO" "Starting MCP TCP server (Ctrl+C to stop)..."
    Start-McpTcpServer
} else {
    # stdio mode — Ollama is optional; tools/list and the three tools work regardless
    Start-McpStdioServer
}
