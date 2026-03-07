#!/usr/bin/env bash
# scripts/security-lint.sh
# AveryOS™ Security Linting — Pre-Commit Cleartext Auth-Token Storage Gate
#
# PURPOSE:
#   Scans staged files for cleartext storage of authentication tokens
#   (sessionStorage.setItem / localStorage.setItem with AUTH key names).
#   Non-sensitive values (feature flags, solved-PoW markers, etc.) are not flagged.
#
# SENSITIVE KEY PATTERNS (anything matching these is flagged):
#   - Keys containing: token, Token, TOKEN, auth, Auth, AUTH,
#                      pass, Pass, PASS, secret, SECRET, key, KEY
#
# USAGE (standalone):
#   bash scripts/security-lint.sh
#
# INSTALL as a git pre-commit hook:
#   cp scripts/security-lint.sh .git/hooks/pre-commit
#   chmod +x .git/hooks/pre-commit
#   # Or: npm run hooks:install
#
# AveryOS Sovereign Integrity License v1.0
# Author: Jason Lee Avery (ROOT0) ⛓️⚓⛓️

set -euo pipefail

VIOLATIONS=0

# Pattern: sessionStorage.setItem or localStorage.setItem where the key
# name contains auth-sensitive words (token, auth, pass, secret, key).
# Excludes comment lines.
STORAGE_PATTERN='(sessionStorage|localStorage)\.setItem\(\s*["'"'"']([^"'"'"']*[Tt]oken|[Aa]uth|[Pp]ass|[Ss]ecret|[Kk]ey|VAULT|vault|HASH|hash|CRED|cred)[^"'"'"']*["'"'"']'

# ── Files to scan ─────────────────────────────────────────────────────────
if git diff --cached --name-only --quiet 2>/dev/null; then
  # Standalone run — scan all source files
  mapfile -t SCAN_FILES < <(find . -type f \( -name "*.ts" -o -name "*.tsx" -o -name "*.js" -o -name "*.jsx" \) \
    ! -path "*/node_modules/*" ! -path "*/.next/*" ! -path "*/.open-next/*" 2>/dev/null)
else
  # Pre-commit run — only staged files
  mapfile -t SCAN_FILES < <(git diff --cached --name-only --diff-filter=ACMR 2>/dev/null | \
    grep -E '\.(ts|tsx|js|jsx)$' | grep -v "node_modules\|\.next\|\.open-next" || true)
fi

if [ "${#SCAN_FILES[@]}" -eq 0 ]; then
  echo "✅ Security lint: no TypeScript/JavaScript files to scan."
  exit 0
fi

echo "⛓️⚓⛓️  AveryOS™ Security Lint — Cleartext Auth-Token Storage Gate"
echo "──────────────────────────────────────────────────────────────────"

for file in "${SCAN_FILES[@]}"; do
  [ -f "$file" ] || continue

  matches=$(grep -En "$STORAGE_PATTERN" "$file" 2>/dev/null | grep -v '^\s*//' || true)
  if [ -n "$matches" ]; then
    echo ""
    echo "❌ AUTH-TOKEN STORAGE VIOLATION: $file"
    echo "   Line(s):"
    while IFS= read -r line; do
      echo "     $line"
    done <<< "$matches"
    VIOLATIONS=$((VIOLATIONS + 1))
  fi
done

echo ""
if [ "$VIOLATIONS" -gt 0 ]; then
  echo "❌ Security lint FAILED — $VIOLATIONS auth-token cleartext storage violation(s)."
  echo ""
  echo "   UPGRADE PATH:"
  echo "   • Replace sessionStorage.setItem / localStorage.setItem for auth tokens"
  echo "     with POST /api/v1/vault/auth which sets an HttpOnly Secure cookie."
  echo "   • See app/admin/forensics/page.tsx for the canonical pattern."
  echo ""
  echo "⛓️⚓⛓️  Commit BLOCKED. Upgrade the security pattern and retry."
  exit 1
else
  echo "✅ Security lint passed — no auth-token cleartext storage violations."
  echo "⛓️⚓⛓️"
  exit 0
fi
