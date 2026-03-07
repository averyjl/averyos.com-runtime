#!/usr/bin/env bash
# scripts/restore-dns.sh
# AveryOS™ DNS Restoration Script
#
# PURPOSE:
#   Restores the Cloudflare DNS CNAMEs for api, lighthouse, anchor, and
#   terminal subdomains, all pointing to the Cloudflare Worker via its
#   workers.dev endpoint (proxied / Orange Cloud).
#
# RCA — What caused the outage:
#   The bare root domain (averyos.com) was configured as a custom domain on
#   the averyoscom-runtime Worker.  Cloudflare Workers custom domains require
#   a DNS CNAME for the domain, but a zone's root (APEX) record cannot be a
#   CNAME — Cloudflare uses a special "CNAME flattening" proxy record (type A).
#   When the root domain record was deleted and re-added incorrectly, the
#   Worker stopped responding on averyos.com.
#
#   Resolution: Delete the averyos.com custom domain and add www.averyos.com
#   as the primary Worker custom domain.  www is a subdomain and supports a
#   standard CNAME, which is fully compatible with Cloudflare Workers custom
#   domains.  The averyos.com root record is now handled by a Cloudflare
#   proxied CNAME to www (or by a redirect rule), pointing all traffic to
#   www.averyos.com.
#
# PREVENTION:
#   1. Always use www.averyos.com as the primary Worker custom domain.
#   2. Redirect bare averyos.com → www via next.config.js and middleware.ts
#      (already implemented).
#   3. Never delete the www custom domain — only modify the root redirect.
#   4. Before changing DNS records: export the current zone state with
#      wrangler or the Cloudflare API as a backup.
#
# USAGE:
#   export CLOUDFLARE_API_TOKEN="<your-api-token>"
#   export CLOUDFLARE_ZONE_ID="<your-zone-id>"
#   bash scripts/restore-dns.sh
#
# REQUIREMENTS:
#   curl, jq
#
# Author: Jason Lee Avery (ROOT0)
# Anchor: cf83e135...927da3e ⛓️⚓⛓️

set -euo pipefail

# ── Configuration ─────────────────────────────────────────────────────────────
ZONE_ID="${CLOUDFLARE_ZONE_ID:-}"
API_TOKEN="${CLOUDFLARE_API_TOKEN:-}"
WORKER_NAME="averyoscom-runtime"
DOMAIN="averyos.com"

# Subdomains to restore → all point to the Worker (Proxied / Orange Cloud)
# Target: workers.dev CNAME (Cloudflare proxies this through the edge)
WORKER_CNAME="${WORKER_NAME}.workers.dev"

declare -A SUBDOMAINS=(
  ["api"]="${WORKER_CNAME}"
  ["lighthouse"]="${WORKER_CNAME}"
  ["anchor"]="${WORKER_CNAME}"
  ["terminal"]="${WORKER_CNAME}"
  ["www"]="${WORKER_CNAME}"
)

# ── Validation ────────────────────────────────────────────────────────────────
if [[ -z "$ZONE_ID" || -z "$API_TOKEN" ]]; then
  echo "❌ Missing required environment variables:"
  echo "   CLOUDFLARE_ZONE_ID  = ${ZONE_ID:-<not set>}"
  echo "   CLOUDFLARE_API_TOKEN = <hidden>"
  echo ""
  echo "Usage:"
  echo "   export CLOUDFLARE_API_TOKEN='<token>'"
  echo "   export CLOUDFLARE_ZONE_ID='<zone-id>'"
  echo "   bash scripts/restore-dns.sh"
  exit 1
fi

CF_API="https://api.cloudflare.com/client/v4"

# ── Helper: upsert a CNAME record ─────────────────────────────────────────────
upsert_cname() {
  local subdomain="$1"
  local target="$2"
  local full_name="${subdomain}.${DOMAIN}"

  echo "🔍 Checking ${full_name} …"

  # List existing records for this name
  local existing
  existing=$(curl -s -X GET \
    "${CF_API}/zones/${ZONE_ID}/dns_records?type=CNAME&name=${full_name}" \
    -H "Authorization: Bearer ${API_TOKEN}" \
    -H "Content-Type: application/json")

  local count
  count=$(echo "$existing" | jq '.result | length')

  if [[ "$count" -gt 0 ]]; then
    local record_id
    record_id=$(echo "$existing" | jq -r '.result[0].id')
    echo "   ✏️  Updating existing CNAME (id: ${record_id}) → ${target} [proxied]"
    curl -s -X PUT \
      "${CF_API}/zones/${ZONE_ID}/dns_records/${record_id}" \
      -H "Authorization: Bearer ${API_TOKEN}" \
      -H "Content-Type: application/json" \
      --data "{\"type\":\"CNAME\",\"name\":\"${full_name}\",\"content\":\"${target}\",\"proxied\":true,\"ttl\":1}" \
      | jq -r '.success | if . then "   ✅ Updated" else "   ❌ Update failed" end'
  else
    echo "   ➕ Creating new CNAME → ${target} [proxied]"
    curl -s -X POST \
      "${CF_API}/zones/${ZONE_ID}/dns_records" \
      -H "Authorization: Bearer ${API_TOKEN}" \
      -H "Content-Type: application/json" \
      --data "{\"type\":\"CNAME\",\"name\":\"${full_name}\",\"content\":\"${target}\",\"proxied\":true,\"ttl\":1}" \
      | jq -r '.success | if . then "   ✅ Created" else "   ❌ Create failed" end'
  fi
}

# ── Main ───────────────────────────────────────────────────────────────────────
echo ""
echo "⛓️⚓⛓️  AveryOS™ DNS Restoration"
echo "────────────────────────────────────────"
echo "Zone:   ${DOMAIN} (${ZONE_ID})"
echo "Worker: ${WORKER_NAME}"
echo ""

for subdomain in "${!SUBDOMAINS[@]}"; do
  upsert_cname "$subdomain" "${SUBDOMAINS[$subdomain]}"
done

echo ""
echo "✅ DNS restoration complete."
echo ""
echo "⚠️  Post-restore checklist:"
echo "   1. Verify www.averyos.com resolves and serves the Worker."
echo "   2. Verify api.averyos.com, lighthouse.averyos.com, anchor.averyos.com,"
echo "      and terminal.averyos.com all respond correctly."
echo "   3. Confirm SSL certificates are active in the Cloudflare dashboard"
echo "      (SSL/TLS → Edge Certificates).  New certs provision in < 15 min."
echo "   4. Confirm no pending certificate loops in Cloudflare SSL/TLS settings."
echo "⛓️⚓⛓️"
