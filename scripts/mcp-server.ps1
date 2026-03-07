# AveryOS™ Ollama MCP (Model Context Protocol) Server — scripts/mcp-server.ps1
#
# Establishes an MCP bridge between the local Ollama instance (NODE_02) and
# the AveryOS™ GitHub Copilot / cloud context.  Every response is SHA-512
# hashed and logged to the Cloudflare D1 VaultChain for permanent sovereign record.
#
# Usage:
#   .\scripts\mcp-server.ps1 [-OllamaEndpoint <url>] [-ModelName <name>] [-Port <port>] [-DryRun]
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

    $timestamp = (Get-Date -Format "yyyy-MM-ddTHH:mm:ss.fffZ")
    $sql  = "INSERT INTO sovereign_audit_logs (event_type, ip_address, path, user_agent, timestamp, sha512_pulse) VALUES (?, ?, ?, ?, ?, ?)"
    $body = @{
        sql    = $sql
        params = @("OLLAMA_ALM_RESPONSE", "NODE_02_LOCAL", "/mcp/ollama", $ModelUsed, $timestamp, $PulseHash)
    } | ConvertTo-Json -Compress

    $uri     = "$D1_API_BASE/accounts/$D1_ACCOUNT_ID/d1/database/$D1_DATABASE_ID/query"
    $headers = @{
        "Authorization" = "Bearer $D1_API_TOKEN"
        "Content-Type"  = "application/json"
    }

    try {
        if ($DryRun) {
            Write-AosLog "INFO" "[DRY RUN] Would log pulse hash to D1: $($PulseHash.Substring(0,32))..."
        } else {
            $result = Invoke-RestMethod -Uri $uri -Method POST -Headers $headers -Body $body
            if ($result.success) {
                Write-AosLog "INFO" "VaultChain log written: $($PulseHash.Substring(0,32))..."
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

# Handle a single MCP JSON-RPC request and return a JSON-RPC response
function Invoke-McpRequest {
    param([hashtable]$Request)
    $id     = $Request.id
    $method = $Request.method
    switch ($method) {
        "initialize" {
            return @{
                jsonrpc = "2.0"; id = $id;
                result  = @{
                    protocolVersion = "0.1.0"; capabilities = @{ sampling = @{} };
                    serverInfo = @{ name = "AveryOS™ Ollama MCP"; version = $KERNEL_VERSION }
                }
            }
        }
        "sampling/createMessage" {
            $messages = $Request.params.messages
            $prompt   = ($messages | ForEach-Object { "$($_.role): $($_.content.text)" }) -join "`n"
            $repoContext = if ($ActiveRepoPaths.Count -gt 0) {
                $preview = ($ActiveRepoPaths | Select-Object -First 3 | ForEach-Object { Split-Path $_ -Leaf }) -join ", "
                $suffix  = if ($ActiveRepoPaths.Count -gt 3) { " (+$($ActiveRepoPaths.Count - 3) more)" } else { "" }
                "`n[AVERYOS_BRIDGE] Active repos ($($ActiveRepoPaths.Count)): $preview$suffix`n"
            } else { "" }
            $fullPrompt = "$repoContext$prompt"
            Write-AosLog "INFO" "MCP sampling request received (model: $ModelName)"
            $responseText = Invoke-OllamaQuery -Prompt $fullPrompt
            $pulseHash = Get-Sha512 -Input "${KERNEL_SHA}:${fullPrompt}:${responseText}"
            Write-D1VaultLog -Prompt $fullPrompt -ResponseText $responseText -PulseHash $pulseHash -ModelUsed $ModelName
            return @{
                jsonrpc = "2.0"; id = $id;
                result  = @{
                    role = "assistant"; content = @{ type = "text"; text = $responseText };
                    model = $ModelName; stopReason = "endTurn"; sovereignAnchor = "${KERNEL_SHA}"; pulseHash = $pulseHash; activeRepos = $ActiveRepoPaths
                }
            }
        }
        default {
            return @{ jsonrpc = "2.0"; id = $id; error = @{ code = -32601; message = "Method not found: $method" } }
        }
    }
}

# ── TCP Listener ─────────────────────────────────────────────────────────────
function Start-McpServer {
    $listener = [System.Net.Sockets.TcpListener]::new([System.Net.IPAddress]::Loopback, $Port)
    $listener.Start()
    Write-AosLog "INFO" "MCP Server listening on 127.0.0.1:$Port"
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
                    $writer.WriteLine(($response | ConvertTo-Json -Compress -Depth 10))
                }
            } catch { Write-AosLog "WARN" "Client error: $_" } finally { $reader.Dispose(); $writer.Dispose(); $client.Close() }
        }
    } finally { $listener.Stop() }
}

# ── Entry Point ───────────────────────────────────────────────────────────────
Write-Host "`n⛓️⚓⛓️  AveryOS™ Ollama MCP Server"
Write-Host "── Multi-Repo Bridge ─────────────────────────────────────────────────────"
foreach ($repoPath in $RepoPaths) {
    $found  = Test-Path $repoPath
    $icon   = if ($found) { "✅" } else { "⚠️ " }
    $status = if ($found) { "LOCKED_IN_PARITY" } else { "OFFLINE" }
    Write-Host "   $icon $repoPath  [$status]"
}
$parityCount = $ActiveRepoPaths.Count
Write-Host "   Active: $parityCount/$($RepoPaths.Count) repos — $(if ($parityCount -eq $RepoPaths.Count) { 'ALL LOCKED_IN_PARITY ✅' } else { "$parityCount LOCKED_IN_PARITY ⚠️" })`n"

if ($DryRun) { Write-AosLog "INFO" "[DRY RUN] Mode active - exiting." ; exit 0 }

try {
    $tags = Invoke-RestMethod -Uri "$OllamaEndpoint/api/tags" -TimeoutSec 5
    Write-AosLog "INFO" "Ollama server running — $(($tags.models).Count) model(s) loaded"
} catch { Write-AosLog "ERROR" "Ollama not reachable at $OllamaEndpoint." ; exit 1 }

Write-AosLog "INFO" "Starting MCP server (Ctrl+C to stop)..."
Start-McpServer
