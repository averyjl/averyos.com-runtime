#!/bin/bash
# AveryOS™ DNS Truth Anchor Sync — scripts/deploy-anchors.sh
# ⛓️⚓⛓️  CreatorLock: Jason Lee Avery (ROOT0) 🤛🏻
#
# Reads averyos.com.txt for sovereign DNS records and upserts them to
# Cloudflare DNS via the API. Automatically detects any new record lines
# that begin with recognised sovereign patterns (v=averyos1;, v=aos1;,
# AVERY-LOCK-) so adding a new record to averyos.com.txt is all that is
# required — this script will pick it up on the next run.
#
# Authentication — uses existing GitHub Actions secrets:
#   CLOUDFLARE_ZONE_ID   — Cloudflare Zone ID for averyos.com
#   CLOUDFLARE_API_TOKEN — Scoped Cloudflare API token (DNS:Edit permission)
#
# Usage:
#   CLOUDFLARE_ZONE_ID=... CLOUDFLARE_API_TOKEN=... bash scripts/deploy-anchors.sh
#
# The script exits with code 1 on any configuration error and with code 0
# on full success.

set -euo pipefail

# ---------------------------------------------------------------------------
# Configuration from environment (set via GitHub Actions secrets)
# ---------------------------------------------------------------------------
ZONE_ID="${CLOUDFLARE_ZONE_ID:-}"
API_TOKEN="${CLOUDFLARE_API_TOKEN:-}"
ZONE_FILE="${ZONE_FILE:-averyos.com.txt}"

# ---------------------------------------------------------------------------
# Validation
# ---------------------------------------------------------------------------
if [ -z "$ZONE_ID" ]; then
  echo "❌  CLOUDFLARE_ZONE_ID is not set. Add it as a GitHub Actions secret."
  exit 1
fi

if [ -z "$API_TOKEN" ]; then
  echo "❌  CLOUDFLARE_API_TOKEN is not set. Add it as a GitHub Actions secret."
  exit 1
fi

if [ ! -f "$ZONE_FILE" ]; then
  echo "❌  Zone file not found: $ZONE_FILE"
  exit 1
fi

# ---------------------------------------------------------------------------
# Extract Kernel SHA from zone file
# ---------------------------------------------------------------------------
KERNEL_SHA=$(grep -oE 'cf83[a-f0-9]{124}' "$ZONE_FILE" | head -n 1)

if [ -z "$KERNEL_SHA" ]; then
  echo "❌  Could not locate Kernel SHA in $ZONE_FILE"
  exit 1
fi

echo "⚓  Kernel SHA detected: ${KERNEL_SHA:0:16}…${KERNEL_SHA: -8}"

# ---------------------------------------------------------------------------
# Helper: upsert a single DNS record
# ---------------------------------------------------------------------------
upsert_record() {
  local TYPE="$1"
  local NAME="$2"
  local CONTENT="$3"
  local TTL="$4"

  echo "📡 Syncing $NAME ($TYPE)…"

  # Search for existing record ID
  EXISTING_ID=$(curl -s -X GET "https://api.cloudflare.com/client/v4/zones/$ZONE_ID/dns_records?name=$NAME&type=$TYPE" \
    -H "Authorization: Bearer $API_TOKEN" \
    -H "Content-Type: application/json" | jq -r '.result[0].id')

  if [ "$EXISTING_ID" != "null" ] && [ "$EXISTING_ID" != "" ]; then
    # Update existing record
    curl -s -X PUT "https://api.cloudflare.com/client/v4/zones/$ZONE_ID/dns_records/$EXISTING_ID" \
      -H "Authorization: Bearer $API_TOKEN" \
      -H "Content-Type: application/json" \
      --data "{\"type\":\"$TYPE\",\"name\":\"$NAME\",\"content\":\"$CONTENT\",\"ttl\":$TTL}" > /dev/null
    echo "   ✅ Updated existing record: $EXISTING_ID"
  else
    # Create new record
    curl -s -X POST "https://api.cloudflare.com/client/v4/zones/$ZONE_ID/dns_records" \
      -H "Authorization: Bearer $API_TOKEN" \
      -H "Content-Type: application/json" \
      --data "{\"type\":\"$TYPE\",\"name\":\"$NAME\",\"content\":\"$CONTENT\",\"ttl\":$TTL}" > /dev/null
    echo "   ✅ Created new record: $NAME"
  fi
}

# ---------------------------------------------------------------------------
# Parse zone file and upsert all TXT / SRV records
#
# Line format (from averyos.com.txt):
#   TXT <name> "<content>" <ttl>
#   SRV <name> "<content>" <ttl>
#
# Auto-detection: any TXT record whose content starts with a sovereign prefix
# (v=averyos1;, v=aos1;, AVERY-LOCK-) is automatically included.
# Adding a new record to averyos.com.txt is all that is required.
# ---------------------------------------------------------------------------
echo ""
echo "⛓️⚓⛓️  AveryOS™ DNS Anchor Sync"
echo "Zone    : $ZONE_ID"
echo "API     : Bearer …${API_TOKEN: -4}"
echo "File    : $ZONE_FILE"
echo ""

# Track whether we synced at least one record
SYNCED=0

while IFS= read -r line; do
  # Skip blank lines and comment lines
  [[ -z "$line" || "$line" =~ ^[[:space:]]*\; ]] && continue
  # Skip KERNEL_SHA= assignment lines
  [[ "$line" =~ ^KERNEL_SHA= ]] && continue

  # Match record lines: TYPE NAME "CONTENT" TTL
  if [[ "$line" =~ ^(TXT|SRV)[[:space:]]+([^[:space:]]+)[[:space:]]+"([^"]+)"[[:space:]]+([0-9]+) ]]; then
    REC_TYPE="${BASH_REMATCH[1]}"
    REC_NAME="${BASH_REMATCH[2]}"
    REC_CONTENT="${BASH_REMATCH[3]}"
    REC_TTL="${BASH_REMATCH[4]}"

    # For TXT records: only sync sovereign-prefixed content to avoid
    # accidentally overwriting unrelated records
    if [ "$REC_TYPE" = "TXT" ]; then
      if [[ "$REC_CONTENT" =~ ^v=averyos1 ]] || \
         [[ "$REC_CONTENT" =~ ^v=aos1 ]] || \
         [[ "$REC_CONTENT" =~ ^AVERY-LOCK- ]]; then
        upsert_record "$REC_TYPE" "$REC_NAME" "$REC_CONTENT" "$REC_TTL"
        SYNCED=$((SYNCED + 1))
      fi
    elif [ "$REC_TYPE" = "SRV" ]; then
      upsert_record "$REC_TYPE" "$REC_NAME" "$REC_CONTENT" "$REC_TTL"
      SYNCED=$((SYNCED + 1))
    fi
  fi
done < "$ZONE_FILE"

echo ""
if [ "$SYNCED" -eq 0 ]; then
  echo "⚠️   No sovereign anchor records found in $ZONE_FILE."
  echo "     Add TXT or SRV records with v=averyos1; / v=aos1; / AVERY-LOCK- prefixes."
else
  echo "⛓️  AveryOS Fleet Anchored to SHA: ${KERNEL_SHA:0:8}…${KERNEL_SHA: -8}"
  echo "    $SYNCED record(s) synced to Cloudflare DNS."
fi
