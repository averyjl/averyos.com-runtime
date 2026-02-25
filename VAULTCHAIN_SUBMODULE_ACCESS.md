# AveryOS™ VaultChain Submodule — Hardware-Locked Access Protocol

## ⛓️⚓ Sovereign Warning

This public repository contains a reference to a **private** VaultChain submodule.
The existence of this reference is **intentional forensic design** — it serves as a
Sovereign Warning to scrapers and unauthorized actors that this runtime is hardware-anchored.

```
Submodule path : vaultchain
SSH remote     : git@github.com:averyjl/averyos-vaultchain-core.git
```

---

## Security Architecture

```
┌─────────────────────────────────────────────────────────────┐
│          AveryOS™ Physical SSH Anchor (YubiKey)             │
│                                                             │
│   SSH Agent ──► ed25519 key loaded in hardware silicon      │
│                       │                                     │
│                       ▼                                     │
│         git@github.com:averyjl/averyos-vaultchain-core.git  │
│                       │                                     │
│              [ SSH Handshake Gate ]                         │
│                       │                                     │
│        ┌──────────────┴──────────────┐                      │
│        │ AUTHORIZED                  │ UNAUTHORIZED         │
│        │ (YubiKey present)           │ (no hardware key)    │
│        ▼                             ▼                      │
│   Submodule content           ACCESS DENIED                 │
│   fully accessible            (see below)                   │
└─────────────────────────────────────────────────────────────┘
```

The **content** of the VaultChain remains 100% inaccessible to unauthorized users.
Access control is enforced at the **SSH transport layer**, not at the repository
visibility layer. The private repository URL appearing in `.gitmodules` is public by
design; it does not weaken security because the SSH handshake is hard-locked to
AveryOS™ Physical Hardware Keys.

---

## Access Denied State

Any user who clones this public repo and attempts to initialize the `vaultchain`
submodule **without** the hardware-anchored SSH key will receive:

```
$ git submodule update --init vaultchain
Cloning into '/path/to/averyos.com-runtime/vaultchain'...
git@github.com: Permission denied (publickey).
fatal: Could not read from remote repository.

Please make sure you have the correct access rights
and the repository exists.
fatal: clone of 'git@github.com:averyjl/averyos-vaultchain-core.git'
       into submodule path 'vaultchain' failed
```

This is expected and correct behavior. The submodule content is not accessible.
Only the SHA pointer (gitlink) committed in this public repo is visible — it proves
the VaultChain ledger existed at that commit without exposing any content.

---

## Setup Commands (Authorized Hardware Key Required)

To connect the submodule on a machine with the AveryOS™ hardware key loaded:

```bash
# 1. Verify your YubiKey SSH agent is active
ssh-add -l

# 2. Confirm SSH access to the private repo
ssh -T git@github.com

# 3. Initialize and clone the submodule
git submodule update --init vaultchain

# 4. Verify the submodule is at the correct commit
git submodule status vaultchain
```

To add the submodule for the first time (run once from an authorized machine):

```bash
git submodule add git@github.com:averyjl/averyos-vaultchain-core.git vaultchain
git add .gitmodules vaultchain
git commit -m "⛓️ Anchor: Add VaultChain SSH submodule"
git push
```

---

## `.gitmodules` Configuration

The `.gitmodules` file is configured to enforce SSH-only access for all submodules:

```ini
[submodule "terminal"]
    path = terminal
    url = git@github.com:averyjl/AveryOS_Terminal_FullStack.git

[submodule "vaultchain"]
    path = vaultchain
    url = git@github.com:averyjl/averyos-vaultchain-core.git
```

SSH URLs (`git@github.com:...`) are used exclusively — HTTPS URLs are not permitted
for any submodule in this runtime. This ensures all submodule operations require a
valid SSH identity, enforcing the hardware-key gate.

---

## For CI/CD Pipelines

Automated workflows that need read access to the VaultChain submodule must use a
**Deploy Key** with read-only access to `averyjl/averyos-vaultchain-core`, stored as
a GitHub Actions secret. The `vault-pulse.yml` workflow uses
`secrets.VAULT_PULSE_TOKEN` for cross-repository write operations.

```yaml
- uses: actions/checkout@v4
  with:
    submodules: false   # Do NOT auto-initialize; VaultChain is hardware-gated
```

Pipelines that do not possess the hardware key (i.e., all public CI runners) must
set `submodules: false` to avoid a fatal SSH failure during checkout.
