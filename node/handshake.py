"""
⛓️⚓⛓️ AveryOS™ First Contact Protocol — Physical Node Handshake
Path: ~/averyos/node/handshake.py

Turns a local PC into a Primary Sovereign Node of the global AveryOS mesh.
Generates a Hardware Signature and broadcasts it to the GabrielOS™ Gatekeeper,
securing the node's place in the VaultChain™.

Environment variables (required — never hardcode):
  GITHUB_PAT   Bearer token accepted by the GabrielOS Gatekeeper sync endpoint.
               Set in your shell profile or a .env.local file (see README.md).

Usage:
  python node/handshake.py
"""

import hashlib
import os
import time

import requests

# ⛓️⚓⛓️ AVERYOS PHYSICAL ANCHOR CONFIG
GATEKEEPER_URL = "https://gabriel-gatekeeper.jla.workers.dev/api/gatekeeper/sync"

# Root0 genesis kernel SHA-512 anchor (mirrors lib/sovereignConstants.ts KERNEL_SHA)
KERNEL_ROOT = (
    "cf83e1357eefb8bdf1542850d66d8007d620e4050b5715dc83f4a921d36ce9ce47d0d13c5d85f2b0ff8318d2877eec2f63b931bd47417a81a538327af927da3e"
)


def execute_first_contact() -> None:
    """Sign a heartbeat with the Physical Anchor and broadcast to the Cloud Gatekeeper."""

    print("⛓️⚓⛓️ INITIALIZING FIRST CONTACT PROTOCOL...")

    # Load token from environment — never hardcode credentials
    github_pat = os.environ.get("GITHUB_PAT", "").strip()
    if not github_pat:
        print("❌ FATAL: GITHUB_PAT environment variable is not set. See node/README.md.")
        return

    # 1. Generate Local Hardware Signature (microsecond-precision Unix timestamp)
    timestamp = str(int(time.time() * 1_000_000))
    payload = f"{timestamp}:{KERNEL_ROOT}:PHYSICAL_NODE_01"
    sig = hashlib.sha512(payload.encode()).hexdigest()

    # 2. Broadcast to Cloud Gatekeeper
    headers = {
        "Authorization": f"Bearer {github_pat}",
        "X-AveryOS-Sig": sig,
        "X-AveryOS-Timestamp": timestamp,
    }

    try:
        response = requests.post(GATEKEEPER_URL, headers=headers, timeout=10)
        if response.status_code == 200:
            print("✅ SYNC_LOCKED: Local Node-01 is now an anchored peer.")
            print(f"🔗 VaultChain Receipt: {response.text}")
        else:
            print(f"❌ USI_ALERT: Contact rejected by GabrielOS. Status: {response.status_code}")
    except requests.exceptions.RequestException as exc:
        print(f"⚠️ NETWORK_DRIFT: Failed to reach the Mesh. {exc}")


if __name__ == "__main__":
    execute_first_contact()
