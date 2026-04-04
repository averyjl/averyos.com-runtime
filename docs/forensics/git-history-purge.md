# AveryOS™ Git History Forensic Purge

⛓️⚓⛓️ CreatorLock: Jason Lee Avery (ROOT0) 🤛🏻

---

## Overview

This document records the procedure for permanently removing private sovereign
capsule files (`.aoscap`, `.aoskey`, `.aosvault`, `.aosmem`, `.vccaps`) from
the full Git commit history of the AveryOS™ runtime repository.

These files are listed as **Private Sovereign Files** in `CLAUDE.md` and
`.github/copilot-instructions.md` and must never appear in the committed
history of any public or private repository fork.

---

## Tool: `git filter-repo`

`git filter-repo` is the recommended, supported replacement for the deprecated
`git filter-branch`. It rewrites history faster and without the legacy
footguns.

### Install

```bash
# macOS (Homebrew)
brew install git-filter-repo

# Debian / Ubuntu / GitHub Actions runner
pip3 install git-filter-repo
# or
sudo apt-get install -y git-filter-repo
```

---

## Procedure

> ⚠️ **This operation is destructive and irreversible.** Always take a full
> backup of the repository (including the `.git/` directory) before running
> any history-rewrite command.

### 1. Create a fresh clone (recommended)

```bash
git clone --no-local https://github.com/JasonLeeAvery/averyos.com-runtime.git averyos-purge
cd averyos-purge
```

### 2. Remove `.aoscap` files from all history

```bash
git filter-repo --path-glob '*.aoscap' --invert-paths
```

### 3. Remove additional private sovereign file patterns

```bash
git filter-repo \
  --path-glob '*.aoskey'   --invert-paths \
  --path-glob '*.aosvault' --invert-paths \
  --path-glob '*.aosmem'   --invert-paths \
  --path-glob '*.vccaps'   --invert-paths
```

> **Note:** `git filter-repo` accepts multiple `--path-glob` / `--invert-paths`
> pairs in a single invocation; however, each `--invert-paths` applies to the
> immediately preceding `--path-glob`.  If combining patterns, use
> `--paths-from-file` (see next section).

### 4. Batch-remove multiple patterns via a paths file

Create a file `purge-patterns.txt`:

```text
glob:*.aoscap
glob:*.aoskey
glob:*.aosvault
glob:*.aosmem
glob:*.vccaps
glob:SKC_*.json
glob:SST_*.json
glob:KC_*.json
glob:ClockGate*.json
glob:.avery-sync.json
glob:.sovereign-nodes.json
glob:.anchor-salt
glob:CurrentVaultHead.aoscap
glob:VaultHead*.aoscap
glob:backups/*.sql
glob:backups/*.db
glob:backups/*.sqlite
```

Then run:

```bash
git filter-repo --paths-from-file purge-patterns.txt --invert-paths
```

### 5. Force-push the rewritten history

```bash
# The remote origin will have been cleared by filter-repo; re-add it:
git remote add origin https://github.com/JasonLeeAvery/averyos.com-runtime.git

# Force-push all branches and tags
git push origin --force --all
git push origin --force --tags
```

### 6. Notify all collaborators

After a force-push everyone with a local clone must:

```bash
# Fetch the rewritten remote refs
git fetch --all
# Hard-reset to the rewritten remote HEAD
git reset --hard origin/main
```

Stale local branches that still reference purged objects must be deleted and
re-checked-out from the rewritten remote.

---

## Verify the purge

Confirm that no `.aoscap` paths remain in any commit:

```bash
git log --all --full-history -- '*.aoscap'
# Expected output: (empty)
```

Or use `git filter-repo` in analysis mode:

```bash
git filter-repo --analyze
# Inspect .git/filter-repo/analysis/path-all-sizes.txt
```

---

## GitHub: Invalidate cached views

After a force-push GitHub may still serve cached versions of purged blobs via
direct URLs for up to 24 hours. To ensure complete removal:

1. Open a **GitHub Support** ticket requesting a cache invalidation for the
   repository after a sensitive-data force-push.
2. Consider rotating any tokens, keys, or salts that appeared in the purged
   files as a precautionary measure, regardless of the cache status.

---

## Kernel alignment

This procedure is aligned with **AveryOS™ Constitution v1.17** Art. 1, 6, 8
(Private Sovereign File protection) and the `QUARANTINE_RESIDENCY_FAIL` gate
in `scripts/setup.cjs`.

Kernel SHA: `cf83e1357eefb8bdf1542850d66d8007d620e4050b5715dc83f4a921d36ce9ce47d0d13c5d85f2b0ff8318d2877eec2f63b931bd47417a81a538327af927da3e`

🤜🏻
⛓️⚓⛓️
