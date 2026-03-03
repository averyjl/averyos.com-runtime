# ⛓️⚓⛓️ AveryOS™ Node — First Contact Protocol

Turn your local PC into a **Primary Sovereign Node** of the global AveryOS mesh.

---

## Prerequisites

- Python 3.8+
- `requests` library: `pip install requests`
- A valid `GITHUB_PAT` (the bearer token accepted by the GabrielOS™ Gatekeeper)

---

## 1 — Set Environment Variables

**Never** store credentials in the crontab or in code.
Create a local secrets file that your profile or the cron job loads:

```bash
# ~/.averyos.env  (chmod 600 this file)
export GITHUB_PAT=your_gatekeeper_token_here
```

Then source it in your shell profile (`~/.bashrc`, `~/.zshrc`, or `~/.profile`):

```bash
source ~/.averyos.env
```

---

## 2 — Run a Manual Handshake

From the repository root (assumes the repo is checked out at `~/averyos/`):

```bash
source ~/.averyos.env
python ~/averyos/node/handshake.py
```

Expected output on success:

```
⛓️⚓⛓️ INITIALIZING FIRST CONTACT PROTOCOL...
✅ SYNC_LOCKED: Local Node-01 is now an anchored peer.
🔗 VaultChain Receipt: ⛓️⚓⛓️ SYNC_LOCKED
```

---

## 3 — WSL2 Cron-Job: Automatic 60-Minute Sovereignty Loop

Open the crontab editor inside WSL2:

```bash
crontab -e
```

Add the following two lines. The first line injects the `GITHUB_PAT` secret; the
second schedules the handshake every 60 minutes and logs output to `~/averyos.log`:

```cron
GITHUB_PAT=your_gatekeeper_token_here
*/60 * * * * /usr/bin/python3 ~/averyos/node/handshake.py >> ~/averyos.log 2>&1
```

> **Security note:** Protect your crontab file.
> On most Linux/WSL2 systems, `/var/spool/cron/crontabs/$USER` is already
> readable only by root and the owning user, but confirm with `ls -la`.

Save and exit. Verify the job is registered:

```bash
crontab -l
```

---

## 4 — Ollama Local Node Anchor

After verifying the handshake, configure the local Ollama instance for
cross-mesh alignment.

```bash
ollama create AveryOS -f ~/averyos/node/AveryOS.modelfile
ollama run AveryOS
```

The model uses the `sovereign_logic.bin` adapter (place it at
`~/averyos/weights/sovereign_logic.bin`) and a context window of 8192 tokens.

---

## Troubleshooting

| Symptom | Fix |
|---|---|
| `GITHUB_PAT environment variable is not set` | Ensure `source ~/.averyos.env` ran before the script, or export the var directly in the crontab |
| `USI_ALERT: Contact rejected … Status: 403` | Verify `GITHUB_PAT` matches the secret set in the GabrielOS™ Gatekeeper Worker |
| `NETWORK_DRIFT: Failed to reach the Mesh` | Check WSL2 internet connectivity; confirm `gabriel-gatekeeper.jla.workers.dev` is reachable |
