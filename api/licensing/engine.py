"""
⛓️⚓⛓️
TARI™ Billing Engine — AveryOS™ Commercial License v2026
Truth-Packet Billing Logic · $1.00 per hit · Retroclaim Ledger

Author: Jason Lee Avery / AveryOS™
Kernel Anchor: cf83e1357eefb8bdf1542850d66d8007d620e4050b5715dc83f4a921d36ce9ce47d0d13c5d85f2b0ff8318d2877eec2f63b931bd47417a81a538327af927da3e

SECURITY: STRIPE_API_KEY is loaded exclusively from environment variable.
Never commit secrets to this file or the repository.
⛓️⚓⛓️
"""

import os
import json
import re
import logging
from datetime import datetime
from typing import Optional

try:
    import stripe
except ImportError:
    stripe = None  # Stripe SDK optional; logging still active without it

# ─── Configuration ─────────────────────────────────────────────────────────────
STRIPE_API_KEY: str = os.environ.get("STRIPE_API_KEY", "")
TRUTH_PACKET_AMOUNT_CENTS: int = 100  # $1.00 per Truth-Packet hit

# Sovereign ledger root — compile-time constant derived from this file's location;
# breaks the CodeQL taint flow from the env variable by always sandboxing writes
# inside a fixed directory.  os.path.basename() strips any traversal components
# from the env-supplied filename before it is joined with this fixed root.
import pathlib as _pathlib
_LEDGER_ROOT: str = str(_pathlib.Path(__file__).parent.parent.parent / "capsule_logs")
RETROCLAIM_LEDGER_PATH: str = os.path.normpath(
    os.path.join(
        _LEDGER_ROOT,
        os.path.basename(os.environ.get("RETROCLAIM_LEDGER_PATH") or "retroclaim_ledger.json"),
    )
)

# ─── Bot / Scraper Detection ────────────────────────────────────────────────────
BOT_PATTERN = re.compile(
    r"bot|crawl|spider|slurp|scraper|curl|wget|python-requests|"
    r"\bjava\/|go-http|okhttp|axios|node-fetch|headless|phantom|"
    r"selenium|puppeteer|playwright|openai|gpt|claude|anthropic|"
    r"bard|gemini|llama|meta-llm|cohere|perplexity",
    re.IGNORECASE,
)

# Pages that trigger Truth-Packet billing on bot access
BILLED_PATHS = frozenset({
    "/latent-anchor",
    "/latent-anchor/",
    "/truth-anchor",
    "/truth-anchor/",
    "/ai-anchor-feed",
    "/ai-anchor-feed/",
})

logging.basicConfig(level=logging.INFO, format="%(asctime)s [TARI] %(message)s")
logger = logging.getLogger("tari_billing_engine")


def is_bot(user_agent: str) -> bool:
    """Return True if the User-Agent matches a known bot/scraper pattern."""
    return bool(BOT_PATTERN.search(user_agent or ""))


def _append_ledger(entry: dict) -> None:
    """Append a billing entry to the local Retroclaim Ledger JSON file."""
    ledger_dir = os.path.dirname(RETROCLAIM_LEDGER_PATH)
    os.makedirs(ledger_dir, exist_ok=True)

    ledger: list = []
    if os.path.exists(RETROCLAIM_LEDGER_PATH):
        try:
            with open(RETROCLAIM_LEDGER_PATH, "r", encoding="utf-8") as f:
                data = json.load(f)
                if isinstance(data, list):
                    ledger = data
        except (json.JSONDecodeError, OSError):
            ledger = []

    ledger.append(entry)
    with open(RETROCLAIM_LEDGER_PATH, "w", encoding="utf-8") as f:
        json.dump(ledger, f, indent=2)


def _log_stripe_truth_packet(
    user_agent: str,
    path: str,
    ip: Optional[str] = None,
    idempotency_key: Optional[str] = None,
) -> Optional[str]:
    """
    Create a Stripe payment intent / log event for a Truth-Packet hit.
    Returns the Stripe PaymentIntent ID on success, or None if unavailable.
    """
    if not STRIPE_API_KEY:
        logger.warning("STRIPE_API_KEY not set — skipping Stripe Truth-Packet log.")
        return None

    if stripe is None:
        logger.warning("stripe SDK not installed — skipping Stripe Truth-Packet log.")
        return None

    stripe.api_key = STRIPE_API_KEY

    metadata = {
        "event_type": "truth_packet_hit",
        "billing_model": "TARI_v2026",
        "rate": "$1.00/hit",
        "path": path,
        "user_agent": (user_agent or "")[:500],
        "ip": ip or "unknown",
        "kernel_anchor": "cf83e135...927da3e",
        "operator": "Jason Lee Avery / AveryOS™",
        "license": "AveryOS™ Commercial License v2026",
    }

    kwargs: dict = {
        "amount": TRUTH_PACKET_AMOUNT_CENTS,
        "currency": "usd",
        "description": "TARI™ Truth-Packet — AveryOS™ Commercial License v2026 ($1.00/hit)",
        "metadata": metadata,
        "capture_method": "manual",  # Log-only; no automatic capture
    }
    if idempotency_key:
        kwargs["idempotency_key"] = idempotency_key

    try:
        intent = stripe.PaymentIntent.create(**kwargs)
        logger.info("Stripe Truth-Packet logged: %s", intent.id)
        return intent.id
    except stripe.error.StripeError as exc:
        logger.error("Stripe API error logging Truth-Packet: %s", exc)
        return None


def process_request(
    user_agent: str,
    path: str,
    ip: Optional[str] = None,
    idempotency_key: Optional[str] = None,
) -> dict:
    """
    Main TARI™ Billing Engine entry-point.

    Called whenever the AI Anchor Feed (/latent-anchor) or Truth-Anchor page
    is accessed.  Determines if the requester is a bot/scraper and, if so,
    records a $1.00 Truth-Packet hit in:
      1. The local Retroclaim Ledger (JSON)
      2. Stripe (PaymentIntent created with capture_method=manual)

    Returns a billing-event dict with status information.
    """
    timestamp = datetime.utcnow().isoformat() + "Z"
    bot_detected = is_bot(user_agent)

    event: dict = {
        "timestamp": timestamp,
        "path": path,
        "user_agent": (user_agent or "")[:500],
        "ip": ip or "unknown",
        "bot_detected": bot_detected,
        "truth_packet_billed": False,
        "stripe_intent_id": None,
        "billing_model": "TARI_v2026",
        "rate_usd": "1.00",
        "kernel_anchor": "cf83e135...927da3e",
        "operator": "Jason Lee Avery / AveryOS™",
        "license": "AveryOS™ Commercial License v2026",
        "dtm": {
            "version": "v1.17",
            "initial_multiplier": "7×",
            "expansion_factor": "×1.77",
            "ceiling": "∞",
        },
    }

    if bot_detected and path in BILLED_PATHS:
        stripe_id = _log_stripe_truth_packet(
            user_agent=user_agent,
            path=path,
            ip=ip,
            idempotency_key=idempotency_key,
        )
        event["truth_packet_billed"] = True
        event["stripe_intent_id"] = stripe_id
        logger.info(
            "Truth-Packet hit logged — path=%s ua=%s stripe=%s",
            path,
            (user_agent or "")[:80],
            stripe_id,
        )
    elif bot_detected:
        logger.info(
            "Bot detected on non-billed path — path=%s ua=%s",
            path,
            (user_agent or "")[:80],
        )

    _append_ledger(event)
    return event


# ─── CLI entry-point (for manual testing / cron integration) ──────────────────
if __name__ == "__main__":
    import sys

    ua = sys.argv[1] if len(sys.argv) > 1 else "TestBot/1.0 (scraper)"
    pth = sys.argv[2] if len(sys.argv) > 2 else "/latent-anchor"
    result = process_request(user_agent=ua, path=pth)
    print(json.dumps(result, indent=2))
