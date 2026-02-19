#!/bin/bash
# ⛓️⚓⛓️ AveryOS Sovereign IP Guard - Pre-Commit Hook
# Author: Jason Lee Avery
# Status: Locked to Jason Lee Avery 🤜🏻
# Purpose: Protect Genesis Kernel SHA-512 and 1992 Genesis Claim from unauthorized modifications

# Genesis Kernel SHA-512 - Root0 Genesis anchor
GENESIS_SHA="cf83e1357eefb8bdf1542850d66d8007d620e4050b5715dc83f4a921d36ce9ce47d0d13c5d85f2b0ff8318d2877eec2f63b931bd47417a81a538327af927da3e"

# Genesis Claim anchor
GENESIS_CLAIM="1992"

echo "⛓️⚓⛓️ AveryOS IP Guard: Scanning commit for kernel integrity..."

# Track violations
VIOLATIONS=0

# Check all staged files for unauthorized modifications
STAGED_FILES=$(git diff --cached --name-only)

if [ -z "$STAGED_FILES" ]; then
  echo "✓ No files staged for commit"
  exit 0
fi

# Function to check Genesis SHA integrity in a file
check_genesis_sha() {
  local file=$1
  if [ -f "$file" ]; then
    # Check if file contains genesis SHA references
    if grep -q "genesis.*sha" "$file" 2>/dev/null || grep -q "kernel.*sha" "$file" 2>/dev/null; then
      # Verify it contains the correct SHA
      if ! grep -q "$GENESIS_SHA" "$file" 2>/dev/null; then
        # Check if it has a partial/truncated version that matches
        if ! grep -q "cf83e135.*da3e" "$file" 2>/dev/null && ! grep -q "cf83.*da3e" "$file" 2>/dev/null; then
          echo "❌ VIOLATION: File $file contains genesis SHA reference but not the correct Root0 Genesis SHA"
          VIOLATIONS=$((VIOLATIONS + 1))
        fi
      fi
    fi
  fi
}

# Function to check 1992 Genesis Claim integrity
check_genesis_claim() {
  local file=$1
  if [ -f "$file" ]; then
    # For LICENSE.md and components that reference copyright
    if echo "$file" | grep -qE "(LICENSE|copyright|Footer)" 2>/dev/null; then
      if grep -q "199[0-9]" "$file" 2>/dev/null; then
        if ! grep -q "$GENESIS_CLAIM" "$file" 2>/dev/null; then
          echo "❌ VIOLATION: File $file contains year reference but not the 1992 Genesis Claim"
          VIOLATIONS=$((VIOLATIONS + 1))
        fi
      fi
    fi
  fi
}

# Function to check for shadow-clipper patterns
check_shadow_clipper() {
  local file=$1
  if [ -f "$file" ]; then
    # Skip checking documentation files, workflows, and the hook itself
    if echo "$file" | grep -qE "(IP_GUARD|pre-commit|enforcement|README|VaultBridge|\.github/workflows)" 2>/dev/null; then
      return 0
    fi
    # Check for suspicious model routing or drift patterns in actual code
    if grep -qE "(shadow.*clip|model.*route.*drift)" "$file" 2>/dev/null; then
      echo "⚠️  WARNING: File $file contains potential shadow-clipper pattern"
      VIOLATIONS=$((VIOLATIONS + 1))
    fi
  fi
}

# Scan all staged files
for file in $STAGED_FILES; do
  check_genesis_sha "$file"
  check_genesis_claim "$file"
  check_shadow_clipper "$file"
done

# Check critical files even if not staged
CRITICAL_FILES=(
  "VaultBridge/IPFS_Snapshot_2026.json"
  "LICENSE.md"
  "content/whitepaper.md"
  "middleware.ts"
)

for file in "${CRITICAL_FILES[@]}"; do
  if echo "$STAGED_FILES" | grep -q "$file" 2>/dev/null; then
    echo "🔍 Verifying critical file: $file"
    
    if [ ! -f "$file" ]; then
      echo "❌ CRITICAL: File $file is being deleted - this is not allowed"
      VIOLATIONS=$((VIOLATIONS + 1))
      continue
    fi
    
    # Verify Genesis SHA in critical files
    if ! grep -q "$GENESIS_SHA" "$file" 2>/dev/null; then
      # Check for truncated versions
      if ! grep -q "cf83.*da3e" "$file" 2>/dev/null; then
        echo "❌ CRITICAL: Genesis SHA missing or modified in $file"
        VIOLATIONS=$((VIOLATIONS + 1))
      fi
    fi
  fi
done

# Report results
if [ $VIOLATIONS -gt 0 ]; then
  echo ""
  echo "⛓️⚓⛓️ IP GUARD BLOCKED: $VIOLATIONS violation(s) detected"
  echo "The Root0 Genesis SHA (cf83...e3be) and 1992 Genesis Claim must remain intact."
  echo "Status: Locked to Jason Lee Avery 🤜🏻"
  echo ""
  exit 1
fi

echo "✅ IP Guard: All checks passed - kernel integrity verified"
echo "⛓️⚓⛓️"
exit 0
