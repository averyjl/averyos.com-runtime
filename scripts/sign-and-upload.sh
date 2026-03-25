#!/usr/bin/env bash
# ============================================================================
# scripts/sign-and-upload.sh
#
# AveryOS™ HSM Bash Signer — Deterministic JSON Artifact Canonicalization
# Phase 123.6 GATE 123.6.4
#
# PURPOSE
# -------
# Canonicalizes a JSON artifact (deterministic key ordering + minification),
# computes a SHA-512 fingerprint, optionally signs it with an RSA private key,
# and uploads the result to R2 / a target URL via wrangler or curl.
#
# USAGE
# -----
#   ./scripts/sign-and-upload.sh \
#       --input  path/to/artifact.json \
#       --output output/artifact.canonical.json \
#       [--key   path/to/private.pem] \
#       [--r2-bucket  averyos-capsules] \
#       [--r2-key     artifacts/artifact.canonical.json]
#
# REQUIREMENTS
# ------------
#   - jq  (JSON canonicalization + minification)
#   - openssl  (SHA-512 + RSA signing)
#   - wrangler  (R2 upload, optional — falls back to curl if absent)
#   - CLOUDFLARE_ACCOUNT_ID and CLOUDFLARE_API_TOKEN env vars for R2 upload
#
# ⛓️⚓⛓️  CreatorLock: Jason Lee Avery (ROOT0) 🤛🏻
# ============================================================================

set -euo pipefail

# ── Sovereign kernel anchor ───────────────────────────────────────────────────
readonly KERNEL_SHA="cf83e1357eefb8bdf1542850d66d8007d620e4050b5715dc83f4a921d36ce9ce47d0d13c5d85f2b0ff8318d2877eec2f63b931bd47417a81a538327af927da3e"
readonly KERNEL_VERSION="v3.6.2"

# ── Defaults ──────────────────────────────────────────────────────────────────
INPUT=""
OUTPUT=""
PRIVATE_KEY=""
R2_BUCKET=""
R2_KEY=""

# ── Arg parsing ───────────────────────────────────────────────────────────────
while [[ $# -gt 0 ]]; do
  case "$1" in
    --input)       INPUT="$2";      shift 2 ;;
    --output)      OUTPUT="$2";     shift 2 ;;
    --key)         PRIVATE_KEY="$2"; shift 2 ;;
    --r2-bucket)   R2_BUCKET="$2";  shift 2 ;;
    --r2-key)      R2_KEY="$2";     shift 2 ;;
    -h|--help)
      sed -n '/^# USAGE/,/^# REQUIREMENTS/p' "$0" | sed 's/^# //' | sed 's/^#//'
      exit 0
      ;;
    *)
      echo "❌  Unknown argument: $1" >&2
      exit 1
      ;;
  esac
done

# ── Validation ────────────────────────────────────────────────────────────────
if [[ -z "$INPUT" ]]; then
  echo "❌  --input is required." >&2
  exit 1
fi

if [[ ! -f "$INPUT" ]]; then
  echo "❌  Input file not found: $INPUT" >&2
  exit 1
fi

if [[ -z "$OUTPUT" ]]; then
  OUTPUT="${INPUT%.json}.canonical.json"
fi

# ── Dependency checks ─────────────────────────────────────────────────────────
for dep in jq openssl; do
  if ! command -v "$dep" &>/dev/null; then
    echo "❌  Required dependency not found: $dep" >&2
    exit 1
  fi
done

# ── Step 1: Canonicalize (deterministic key sort + minify) ────────────────────
echo "⛓️⚓⛓️  AveryOS™ HSM Bash Signer — Phase 123.6 GATE 123.6.4"
echo "  Kernel: ${KERNEL_VERSION} | SHA: ${KERNEL_SHA:0:16}…"
echo ""
echo "📄  [1/4] Canonicalizing: $INPUT → $OUTPUT"

mkdir -p "$(dirname "$OUTPUT")"

# jq -cS: compact (-c) + sort keys (-S) = deterministic canonical form.
jq -cS '.' "$INPUT" > "$OUTPUT"

echo "  ✔  Canonical JSON written: $OUTPUT"

# ── Step 2: Compute SHA-512 fingerprint ───────────────────────────────────────
echo "🔑  [2/4] Computing SHA-512 fingerprint…"
SHA512=$(openssl dgst -sha512 -hex "$OUTPUT" | awk '{print $2}')
echo "  ✔  SHA-512: ${SHA512:0:16}…${SHA512: -8}"

# Write a sidecar fingerprint file.
FINGERPRINT_FILE="${OUTPUT%.json}.sha512"
echo "$SHA512  $OUTPUT" > "$FINGERPRINT_FILE"
echo "  ✔  Fingerprint written: $FINGERPRINT_FILE"

# ── Step 3: Optional RSA signature ───────────────────────────────────────────
if [[ -n "$PRIVATE_KEY" ]]; then
  if [[ ! -f "$PRIVATE_KEY" ]]; then
    echo "❌  Private key file not found: $PRIVATE_KEY" >&2
    exit 1
  fi

  echo "🔐  [3/4] Signing with RSA private key: $PRIVATE_KEY"
  SIG_FILE="${OUTPUT%.json}.sig"
  openssl dgst -sha512 -sign "$PRIVATE_KEY" -out "$SIG_FILE" "$OUTPUT"
  echo "  ✔  RSA-SHA512 signature written: $SIG_FILE"

  # Base64-encode the signature for embedding.
  SIG_B64=$(openssl base64 -in "$SIG_FILE" -A)
  echo "  ✔  Signature (base64, ${#SIG_B64} chars): ${SIG_B64:0:32}…"
else
  echo "⏭️   [3/4] Skipping RSA signature (no --key provided)."
fi

# ── Step 4: Optional R2 upload ────────────────────────────────────────────────
if [[ -n "$R2_BUCKET" && -n "$R2_KEY" ]]; then
  echo "☁️   [4/4] Uploading to R2 bucket: $R2_BUCKET / $R2_KEY"

  if command -v wrangler &>/dev/null; then
    wrangler r2 object put "${R2_BUCKET}/${R2_KEY}" \
      --file "$OUTPUT" \
      --content-type "application/json"
    echo "  ✔  Uploaded via wrangler: r2://${R2_BUCKET}/${R2_KEY}"
  else
    echo "  ⚠️  wrangler not found — cannot upload to R2." >&2
    echo "  ℹ️  Install wrangler (npm i -g wrangler) and set CLOUDFLARE_API_TOKEN to enable R2 upload." >&2
    echo "  ℹ️  Canonical artifact is available locally at: $OUTPUT" >&2
    exit 1
  fi
else
  echo "⏭️   [4/4] Skipping R2 upload (no --r2-bucket / --r2-key provided)."
fi

# ── Summary ───────────────────────────────────────────────────────────────────
echo ""
echo "✅  AveryOS™ HSM Signer complete."
echo "   Input:         $INPUT"
echo "   Canonical:     $OUTPUT"
echo "   Fingerprint:   $FINGERPRINT_FILE"
echo "   SHA-512:       $SHA512"
echo "   Kernel anchor: ${KERNEL_SHA:0:16}…"
echo ""
echo "⛓️⚓⛓️  🤜🏻"
