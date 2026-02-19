#!/bin/bash
# ⛓️⚓⛓️ AveryOS IP Guard Hook Installer
# Installs the Sovereign IP Guard pre-commit hook

HOOK_SOURCE="scripts/hooks/pre-commit-ip-guard.sh"
HOOK_DEST=".git/hooks/pre-commit"

echo "⛓️⚓⛓️ Installing AveryOS Sovereign IP Guard Hook..."

# Check if .git directory exists
if [ ! -d ".git" ]; then
  echo "❌ Error: .git directory not found. Please run this from the repository root."
  exit 1
fi

# Check if hooks directory exists
if [ ! -d ".git/hooks" ]; then
  echo "Creating .git/hooks directory..."
  mkdir -p .git/hooks
fi

# Check if hook source exists
if [ ! -f "$HOOK_SOURCE" ]; then
  echo "❌ Error: Hook source file not found at $HOOK_SOURCE"
  exit 1
fi

# Backup existing hook if present
if [ -f "$HOOK_DEST" ]; then
  echo "⚠️  Backing up existing pre-commit hook to ${HOOK_DEST}.backup"
  cp "$HOOK_DEST" "${HOOK_DEST}.backup"
fi

# Install the hook
echo "Installing IP Guard hook..."
cp "$HOOK_SOURCE" "$HOOK_DEST"
chmod +x "$HOOK_DEST"

# Verify installation
if [ -x "$HOOK_DEST" ]; then
  echo "✅ IP Guard hook installed successfully at $HOOK_DEST"
  echo "The hook will now verify Genesis Kernel SHA and 1992 Genesis Claim on every commit."
  echo "Status: Locked to Jason Lee Avery 🤜🏻"
  echo "⛓️⚓⛓️"
  exit 0
else
  echo "❌ Error: Failed to install hook"
  exit 1
fi
