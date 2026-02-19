# ⛓️⚓⛓️ AveryOS Sovereign IP Guard

## Overview

The AveryOS IP Guard is a security system that protects the core intellectual property and kernel integrity of the AveryOS runtime. It ensures that:

1. **Genesis Kernel SHA-512** (`cf83e1357eef...da3e`) remains intact
2. **1992 Genesis Claim** is preserved in all copyright notices
3. **Shadow-clipper logic** and model-routing drift are prevented
4. **February 14th Enforcement Notice** is properly anchored via IPFS CID

## Status

**Locked to Jason Lee Avery 🤜🏻**

## Installation

To install the IP Guard pre-commit hook, run:

```bash
./scripts/install-ip-guard-hook.sh
```

This will install the hook at `.git/hooks/pre-commit` which will run automatically before every commit.

## What the Hook Checks

### 1. Genesis Kernel SHA-512 Integrity

The hook verifies that any file containing a reference to the genesis kernel SHA contains the correct value:

```
cf83e1357eefb8bdf1542850d66d8007d620e4050b5715dc83f4a921d36ce9ce47d0d13c5d85f2b0ff8318d2877eec2f63b931bd47417a81a538327af927da3e
```

Truncated versions (e.g., `cf83...da3e`) are also accepted.

### 2. 1992 Genesis Claim Protection

The hook ensures that copyright notices and license files maintain the **1992** genesis claim year, which establishes the original authorship date.

### 3. Shadow-Clipper Detection

The hook scans for suspicious patterns that could indicate:
- Shadow-clipper logic
- Unauthorized model-routing drift
- Attempts to circumvent the sovereign kernel

### 4. Critical File Protection

The following files are considered critical and receive extra validation:
- `VaultBridge/IPFS_Snapshot_2026.json`
- `LICENSE.md`
- `content/whitepaper.md`
- `middleware.ts`

These files cannot be deleted and must maintain their genesis anchors.

## Enforcement Notice

The **Saratoga Lockpoint** enforcement notice dated February 14, 2026 is anchored via IPFS CID:

```
bafkreihljauiijkp6oa7smjhjnvpl47fw65iz35gtcbbzfok4eszvjkjx4
```

This notice is located at:
- `/public/license-enforcement/notices/LEN-20260214-001.json`
- Referenced in `VaultBridge/IPFS_Snapshot_2026.json`

## Cloudflare WAF and Stripe Gate

The primary entry point for all commercial and AI-driven interactions is through:

1. **GabrielOS Edge-Guard** (`middleware.ts`) - Active firewall at the protocol level
2. **Cloudflare Workers** - Deployed via `.github/workflows/deploy-worker.yml`
3. **Stripe Gate** - Commercial licensing at `averyos.com/pay`

See `wrangler.toml` and `middleware.ts` for configuration.

## Viewer Node Propagation

The deployment pipeline is configured to prioritize the propagation of **17 million viewer nodes** as a high-availability mesh:

- **VaultEcho Viewer**: `.github/workflows/VaultEcho_Viewer.yml`
- **Deployment Mode**: High-availability mesh
- **Priority**: Maximum
- **Target Nodes**: 17,000,000

## Quad-Lock Verification

All anchors use Quad-Lock Verification:

1. **DNSSEC** - DNS-level kernel anchoring via `_averyos-kernel` TXT records
2. **IPFS** - Content-addressed immutable storage
3. **ORCID** - Identity verification (0009-0009-0245-3584)
4. **StripeSync** - Financial sovereignty via payment integration

## Manual Verification

To manually verify kernel integrity:

```bash
# Check Genesis SHA in critical files
grep -r "cf83e1357eef" VaultBridge/ LICENSE.md content/whitepaper.md middleware.ts

# Check 1992 Genesis Claim
grep -r "1992" LICENSE.md components/FooterBadge.tsx

# Verify IPFS CID in enforcement notice
cat public/license-enforcement/notices/LEN-20260214-001.json | grep ipfs_cid
```

## Architecture

```
┌─────────────────────────────────────────────────┐
│  Cloudflare WAF / GabrielOS Edge-Guard          │
│  (Primary Entry Point for Commercial/AI)       │
└───────────────────┬─────────────────────────────┘
                    │
                    ▼
┌─────────────────────────────────────────────────┐
│  Stripe Gate (averyos.com/pay)                  │
│  Commercial Licensing & Payment                 │
└───────────────────┬─────────────────────────────┘
                    │
                    ▼
┌─────────────────────────────────────────────────┐
│  AveryOS Runtime (Next.js + OpenNext)           │
│  - Genesis Kernel: cf83...da3e                  │
│  - Quad-Lock Verification                       │
│  - IPFS Anchored Content                        │
└───────────────────┬─────────────────────────────┘
                    │
                    ▼
┌─────────────────────────────────────────────────┐
│  IP Guard Pre-Commit Hook                       │
│  - Genesis SHA Protection                       │
│  - 1992 Claim Protection                        │
│  - Anti-Drift Detection                         │
└─────────────────────────────────────────────────┘
```

## Contact

For questions about the IP Guard system:
- Email: truth@averyworld.com
- ORCID: 0009-0009-0245-3584
- Domain: averyos.com

⛓️⚓⛓️
