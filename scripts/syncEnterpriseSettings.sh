#!/usr/bin/env bash
# =============================================================================
# scripts/syncEnterpriseSettings.sh
#
# AveryOS™ Enterprise Settings-Sync Utility — Phase 119.2, GATE 119.2.1
#
# PURPOSE
# -------
# Copies GitHub Actions secrets, repository variables, and .github
# configurations from a legacy personal account or source organisation to the
# destination JasonLeeAvery Enterprise Organisation using the `gh` CLI.
#
# This eliminates the "Migration-Labor Drift" that occurs after moving
# repositories from a personal account to an Enterprise Organisation, where
# secrets, environment variables, and repository-level settings are not
# automatically transferred.
#
# PREREQUISITES
# -------------
#   1.  gh CLI >= 2.40 installed and authenticated:
#         gh auth login --hostname github.com
#   2.  The authenticated token must have the following scopes on BOTH
#       the source account and the destination organisation:
#         - repo
#         - admin:repo_hook
#         - secrets (read on source, write on destination)
#   3.  If migrating organisation-level secrets add:
#         - admin:org
#
# USAGE
# -----
#   # Required: destination organisation
#   DEST_ORG=JasonLeeAvery bash scripts/syncEnterpriseSettings.sh
#
#   # Optional overrides
#   SOURCE_OWNER=averyjl \
#   DEST_ORG=JasonLeeAvery \
#   REPOS="averyos.com-runtime other-repo" \   # space-separated (default: all)
#   DRY_RUN=true \                             # print commands without executing
#   bash scripts/syncEnterpriseSettings.sh
#
# WHAT IS SYNCED
# --------------
#   - Repository-level Actions secrets (via gh secret set)
#   - Repository-level Actions variables (via gh variable set)
#   - Branch-protection rules      (via gh api — read + write)
#   - .github/CODEOWNERS           (if present)
#   - .github/dependabot.yml       (if present)
#
# WHAT IS NOT SYNCED (requires manual action)
# --------------------------------------------
#   - Secret *values* — GitHub API never returns plaintext secret values.
#     The script lists secrets by name and prompts for each value.
#   - Deploy keys (contain private key material — migrate manually).
#   - Webhook secrets (regenerate via the webhook settings UI).
#
# NOTE — Administrative use only
# --------------------------------
# This script is intended to be run by the repository owner (Jason Lee Avery)
# in a trusted shell environment.  Repository names and variable values are
# sourced from the authenticated GitHub account — never from untrusted input.
#
# ⛓️⚓⛓️  CreatorLock: Jason Lee Avery (ROOT0) 🤛🏻
# =============================================================================

set -euo pipefail

# ── Configuration ─────────────────────────────────────────────────────────────

SOURCE_OWNER="${SOURCE_OWNER:-averyjl}"
DEST_ORG="${DEST_ORG:-JasonLeeAvery}"
DRY_RUN="${DRY_RUN:-false}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"

# Colour codes
R="\033[0m"
BOLD="\033[1m"
GREEN="\033[0;32m"
YELLOW="\033[0;33m"
RED="\033[0;31m"
CYAN="\033[0;36m"

# ── Helpers ───────────────────────────────────────────────────────────────────

log()  { echo -e "${BOLD}[sync-settings]${R} $*"; }
ok()   { echo -e "${GREEN}✅${R} $*"; }
warn() { echo -e "${YELLOW}⚠️ ${R} $*"; }

# Execute a command or print it in dry-run mode.
# Pass command and arguments as separate words — no eval, no string splitting.
#   run gh secret set NAME --repo owner/repo --body VALUE
run() {
  if [[ "${DRY_RUN}" == "true" ]]; then
    echo -e "${CYAN}[DRY-RUN]${R} $*"
  else
    "$@"
  fi
}

require_gh() {
  if ! command -v gh &>/dev/null; then
    echo -e "${RED}❌${R} gh CLI not found. Install from https://cli.github.com/ and authenticate." >&2
    exit 1
  fi
  if ! gh auth status &>/dev/null; then
    echo -e "${RED}❌${R} gh CLI is not authenticated. Run: gh auth login" >&2
    exit 1
  fi
}

# ── Discover repositories ─────────────────────────────────────────────────────

get_repos() {
  if [[ -n "${REPOS:-}" ]]; then
    echo "${REPOS}"
    return
  fi
  log "Discovering repositories under '${SOURCE_OWNER}'…"
  # List up to 200 repos; adjust --limit for larger orgs
  gh repo list "${SOURCE_OWNER}" --limit 200 --json name --jq '.[].name' 2>/dev/null || true
}

# ── Secrets sync ──────────────────────────────────────────────────────────────

sync_secrets() {
  local repo="$1"
  local src_full="${SOURCE_OWNER}/${repo}"
  local dst_full="${DEST_ORG}/${repo}"

  log "  Secrets for ${src_full} → ${dst_full}"

  # Retrieve secret names (values are never returned by the API)
  local secret_names
  secret_names="$(gh secret list --repo "${src_full}" --json name --jq '.[].name' 2>/dev/null || true)"

  if [[ -z "${secret_names}" ]]; then
    warn "  No secrets found in ${src_full} (or insufficient permissions)"
    return
  fi

  while IFS= read -r name; do
    [[ -z "${name}" ]] && continue
    warn "  Secret '${name}' — paste value when prompted (or press Enter to skip):"
    if [[ "${DRY_RUN}" == "true" ]]; then
      echo -e "${CYAN}[DRY-RUN]${R} gh secret set ${name} --repo ${dst_full} --body <VALUE>"
    else
      read -r -s -p "  Value for ${name} (Enter to skip): " secret_value
      echo
      if [[ -n "${secret_value}" ]]; then
        printf '%s' "${secret_value}" | gh secret set "${name}" --repo "${dst_full}" --body -
        ok "  Set secret '${name}' on ${dst_full}"
      else
        warn "  Skipped secret '${name}'"
      fi
    fi
  done <<< "${secret_names}"
}

# ── Variables sync ────────────────────────────────────────────────────────────

sync_variables() {
  local repo="$1"
  local src_full="${SOURCE_OWNER}/${repo}"
  local dst_full="${DEST_ORG}/${repo}"

  log "  Variables for ${src_full} → ${dst_full}"

  local vars_json
  vars_json="$(gh variable list --repo "${src_full}" --json name,value 2>/dev/null || echo '[]')"

  if [[ "${vars_json}" == "[]" || -z "${vars_json}" ]]; then
    warn "  No variables found in ${src_full}"
    return
  fi

  # Parse name/value pairs and set on destination
  while IFS=$'\t' read -r var_name var_value; do
    [[ -z "${var_name}" ]] && continue
    run gh variable set "${var_name}" --repo "${dst_full}" --body "${var_value}"
    ok "  Set variable '${var_name}' on ${dst_full}"
  done < <(
    python3 - "${vars_json}" <<'PYEOF'
import json, sys
data = json.loads(sys.argv[1])
for v in data:
    print(v["name"] + "\t" + v.get("value", ""))
PYEOF
  )
}

# ── Branch-protection sync ────────────────────────────────────────────────────

sync_branch_protection() {
  local repo="$1"
  local src_full="${SOURCE_OWNER}/${repo}"
  local dst_full="${DEST_ORG}/${repo}"

  log "  Branch protection for ${src_full} → ${dst_full}"

  local default_branch
  default_branch="$(gh repo view "${src_full}" --json defaultBranchRef --jq '.defaultBranchRef.name' 2>/dev/null || echo 'main')"

  local protection
  protection="$(gh api "/repos/${src_full}/branches/${default_branch}/protection" 2>/dev/null || true)"

  if [[ -z "${protection}" || "${protection}" == "{}" ]]; then
    warn "  No branch protection found on ${src_full}:${default_branch}"
    return
  fi

  if [[ "${DRY_RUN}" == "true" ]]; then
    echo -e "${CYAN}[DRY-RUN]${R} gh api --method PUT /repos/${dst_full}/branches/${default_branch}/protection --input -"
    return
  fi

  # Re-apply protection to destination by piping JSON via stdin
  printf '%s' "${protection}" | gh api --method PUT \
    "/repos/${dst_full}/branches/${default_branch}/protection" \
    --input - --silent
  ok "  Branch protection applied to ${dst_full}:${default_branch}"
}

# ── .github config sync ───────────────────────────────────────────────────────

sync_github_config() {
  local repo="$1"
  local dst_full="${DEST_ORG}/${repo}"
  local github_dir="${REPO_ROOT}/.github"

  log "  .github config for ${dst_full}"

  for config_file in CODEOWNERS dependabot.yml; do
    local src_path="${github_dir}/${config_file}"
    [[ -f "${src_path}" ]] || continue

    local encoded sha payload
    encoded="$(base64 --wrap=0 "${src_path}" 2>/dev/null || base64 "${src_path}")"
    sha="$(gh api "/repos/${dst_full}/contents/.github/${config_file}" \
      --jq '.sha' 2>/dev/null || true)"

    if [[ -n "${sha}" ]]; then
      payload="$(printf '{"message":"chore: sync .github/%s","content":"%s","sha":"%s"}' \
        "${config_file}" "${encoded}" "${sha}")"
    else
      payload="$(printf '{"message":"chore: add .github/%s","content":"%s"}' \
        "${config_file}" "${encoded}")"
    fi

    if [[ "${DRY_RUN}" == "true" ]]; then
      echo -e "${CYAN}[DRY-RUN]${R} gh api --method PUT /repos/${dst_full}/contents/.github/${config_file} --input -"
      continue
    fi

    printf '%s' "${payload}" | gh api --method PUT \
      "/repos/${dst_full}/contents/.github/${config_file}" \
      --input - --silent
    ok "  Synced .github/${config_file} to ${dst_full}"
  done
}

# ── Main ──────────────────────────────────────────────────────────────────────

main() {
  echo -e "\n⛓️⚓⛓️  ${BOLD}AveryOS™ Enterprise Settings-Sync${R}  ⛓️⚓⛓️\n"
  log "Source  : ${SOURCE_OWNER}"
  log "Dest    : ${DEST_ORG}"
  log "Dry-run : ${DRY_RUN}"
  echo

  require_gh

  local repos
  repos="$(get_repos)"

  if [[ -z "${repos}" ]]; then
    warn "No repositories found under '${SOURCE_OWNER}'. Exiting."
    exit 0
  fi

  local total=0 synced=0
  while IFS= read -r repo; do
    [[ -z "${repo}" ]] && continue
    total=$((total + 1))
    log "━━━ ${repo} ━━━"

    # Check destination repo exists
    if ! gh repo view "${DEST_ORG}/${repo}" &>/dev/null; then
      warn "  Destination repo '${DEST_ORG}/${repo}' not found — skipping"
      continue
    fi

    sync_secrets            "${repo}" || warn "  secrets sync failed for ${repo}"
    sync_variables          "${repo}" || warn "  variables sync failed for ${repo}"
    sync_branch_protection  "${repo}" || warn "  branch protection sync failed for ${repo}"
    sync_github_config      "${repo}" || warn "  .github sync failed for ${repo}"

    synced=$((synced + 1))
    echo
  done <<< "${repos}"

  echo -e "\n⛓️⚓⛓️  Sync complete: ${synced}/${total} repos processed.\n🤜🏻\n⛓️⚓⛓️\n"
}

main "$@"
