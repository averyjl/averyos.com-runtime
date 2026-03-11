# scripts/fix-mcp-env.ps1
#
# AveryOS™ MCP PATH HARDLOCK — Phase 107.3 (GATE 107.3)
#
# Resolves 'ENOENT' errors in GitHub/Playwright MCP servers caused by missing
# PowerShell in the sanitised MCP environment PATH.
#
# What it does:
#   1. Locates the MCP configuration file (mcp.json or claude_desktop_config.json).
#   2. Injects the absolute PowerShell path into the `env.PATH` field of each
#      GitHub and Playwright server entry.
#   3. Writes the updated config back to disk (with backup).
#
# Usage:
#   powershell.exe -ExecutionPolicy Bypass -File .\scripts\fix-mcp-env.ps1
#
# ⛓️⚓⛓️  CreatorLock: Jason Lee Avery (ROOT0) 🤛🏻

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

# ── Absolute PowerShell paths ──────────────────────────────────────────────────
$PS_PATH_SYSTEM = "C:\Windows\System32\WindowsPowerShell\v1.0"
$PS_PATH_CORE   = if (Test-Path "C:\Program Files\PowerShell\7") {
  "C:\Program Files\PowerShell\7"
} else {
  $null
}

# ── MCP config file locations (ordered by priority) ──────────────────────────
$MCP_CONFIG_CANDIDATES = @(
  "$env:APPDATA\Claude\claude_desktop_config.json",
  "$env:LOCALAPPDATA\Claude\claude_desktop_config.json",
  "$PSScriptRoot\..\mcp.json",
  "$PSScriptRoot\..\..\.mcp\config.json",
  "$HOME\.mcp\config.json"
)

function Find-McpConfig {
  foreach ($candidate in $MCP_CONFIG_CANDIDATES) {
    $resolved = [System.IO.Path]::GetFullPath($candidate)
    if (Test-Path $resolved) {
      return $resolved
    }
  }
  return $null
}

function Inject-PowerShellPath {
  param (
    [string]$ConfigPath
  )

  Write-Host "[fix-mcp-env] Reading: $ConfigPath"
  $json = Get-Content -Path $ConfigPath -Raw -Encoding UTF8 | ConvertFrom-Json

  if (-not $json.mcpServers) {
    Write-Warning "[fix-mcp-env] No 'mcpServers' key found in config. Skipping."
    return
  }

  # Build the PATH injection string
  $psPathsToInject = @($PS_PATH_SYSTEM)
  if ($PS_PATH_CORE) { $psPathsToInject += $PS_PATH_CORE }
  $injectedPath = ($psPathsToInject + $env:PATH) -join ";"

  $changed = $false

  foreach ($serverName in $json.mcpServers.PSObject.Properties.Name) {
    $server = $json.mcpServers.$serverName

    # Target GitHub and Playwright MCP servers (anchored pattern to avoid partial matches)
    if ($serverName -notmatch "^(github|playwright|averyos)") {
      continue
    }

    Write-Host "[fix-mcp-env]   Patching server: $serverName"

    # Ensure the env object exists
    if (-not $server.env) {
      $server | Add-Member -MemberType NoteProperty -Name "env" -Value ([PSCustomObject]@{})
    }

    # Inject PATH
    if ($server.env.PATH -ne $injectedPath) {
      $server.env | Add-Member -MemberType NoteProperty -Name "PATH" -Value $injectedPath -Force
      $changed = $true
      Write-Host "[fix-mcp-env]     Injected PATH for $serverName"
    } else {
      Write-Host "[fix-mcp-env]     PATH already set for $serverName (no change)"
    }
  }

  if ($changed) {
    # Backup the original config
    $backupPath = "$ConfigPath.bak_$(Get-Date -Format 'yyyyMMdd_HHmmss')"
    Copy-Item -Path $ConfigPath -Destination $backupPath -Force
    Write-Host "[fix-mcp-env] Backup saved: $backupPath"

    # Write updated config
    $json | ConvertTo-Json -Depth 10 | Set-Content -Path $ConfigPath -Encoding UTF8
    Write-Host "[fix-mcp-env] Config updated: $ConfigPath"
  } else {
    Write-Host "[fix-mcp-env] No changes needed."
  }
}

# ── Main ──────────────────────────────────────────────────────────────────────

Write-Host "⛓️⚓⛓️ AveryOS™ MCP PATH HARDLOCK — Phase 107.3"
Write-Host "PowerShell system path: $PS_PATH_SYSTEM"
if ($PS_PATH_CORE) { Write-Host "PowerShell Core path:   $PS_PATH_CORE" }

$configPath = Find-McpConfig

if (-not $configPath) {
  Write-Warning "[fix-mcp-env] No MCP config file found in standard locations."
  Write-Host "[fix-mcp-env] Checked locations:"
  foreach ($c in $MCP_CONFIG_CANDIDATES) {
    Write-Host "  $c"
  }
  Write-Host "[fix-mcp-env] Create an mcp.json in the repo root and re-run this script."
  exit 1
}

Inject-PowerShellPath -ConfigPath $configPath

Write-Host "[fix-mcp-env] Done. Restart your MCP host to apply changes."
