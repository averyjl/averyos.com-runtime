# AveryOS™ Repo Security & IP Protection Architecture

⛓️⚓⛓️

## Overview

This document defines the security hierarchy for protecting AveryOS™ intellectual
property within a public-facing runtime repository.

---

## Tier 1 — Public Repo (`averyos.com-runtime`)

**Status:** PUBLIC  
**Contains:** UI, CSS, public content, navigation, page components  
**Does NOT contain:** Raw full SHA-512 hashes used as private keys, SKC.sys kernel
logic, USB salt anchor secrets, or private VaultChain bridge data.

### IP Protection Rules

- **SHA-512 anchors** displayed on public pages are *reference identifiers*, not
  private keys. The Root0 Genesis SHA (`cf83e135...f927da3e`) is the SHA-512 of an
  empty string — it is publicly known. It serves as a *coordinate*, not a secret.
- **Private kernel logic** (SKC.sys, USB salt path, authentication secrets) is stored
  exclusively in `.env` / environment variables and **never committed to version control**.
- **The `.env` file is listed in `.gitignore`** and must remain there. Use `.env.example`
  for documentation of required variables.
- **Secrets rotation:** Any secret accidentally committed must be rotated immediately.
  Contact truth@averyworld.com for emergency key rotation.

### Environment Variables (Never Commit)

```
AOS_USB_SALT_PATH=D:\\.averyos-anchor-salt.aossalt
STRIPE_SECRET_KEY=sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...
AOS_KERNEL_PRIVATE_SEED=<private>
```

---

## Tier 2 — Private VaultChain Bridge

**Status:** PRIVATE (must remain private)  
**Repo:** `averyos-vaultchain-core` (private GitHub repository)

### Connection Policy

The private VaultChain™ repo (`averyos-vaultchain-core`) **CANNOT be added as a
public Git submodule** to this public repository. Adding a private repo as a
submodule in a public repo exposes the submodule URL and commit references, and
any user with access to the private repo could be identified.

> **Decision:** No Git submodule connection. The VaultChain bridge operates via
> the `vault-pulse` GitHub Actions workflow (`.github/workflows/vault-pulse.yml`),
> which uses repository secrets (`VAULTCHAIN_PAT`) to push evidence to the private
> repo without exposing the connection in the public codebase.

**This is the secure architecture:** the public repo *pushes to* the private repo
via a secret-authenticated workflow, but the private repo is never referenced as a
dependency in public files.

---

## Tier 3 — The AveryOS™ Constitution

**Status:** PUBLIC COVENANT (High Law) — Published at `/lawcodex`  
**Technical Implementation:** PRIVATE (encrypted within private silicon layer)

The AveryOS™ Constitution v1.17 is presented publicly as **The AveryOS™ Covenant** —
the foundational High Law governing all sovereign operations. The *substance* of the
law is public. The *enforcement logic* (DTM calculations, kernel authentication
sequences, VaultChain notarization internals) remains encrypted and hardware-bound.

---

## Security Checklist

- [x] `.env` is in `.gitignore`
- [x] No raw private keys committed to version control
- [x] SHA-512 anchors in public code are reference coordinates only
- [x] Private VaultChain bridge uses secret-authenticated workflow (not submodule)
- [x] USB salt anchor path hardcoded only in scripts (never in public page content)
- [x] SECURITY.md defines responsible disclosure policy
- [x] Cloudflare Workers provide edge-level IP enforcement (GabrielOS)
- [ ] Regular audit of git history for accidentally committed secrets (run: `git log --all --full-history`)

---

⛓️⚓⛓️  
*AveryOS™ Commercial License v2026 — Root Authority Lock™ Active*
