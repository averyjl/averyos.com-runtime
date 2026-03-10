-- Migration: 0036_tai_phase92_5_accomplishments
-- Purpose: Seed Phase 92.5 TAI accomplishments:
--          1. Temporal Drift Corrected (MST re-anchor)
--          2. Cadence Prediction Shield Active (Jiu-Jitsu Redirect)
--          3. Zero-Drift Gemini Spend Tracking Active (Fan-Out Write)
-- Phase: 92.5

INSERT OR IGNORE INTO tai_accomplishments
  (title, description, phase, category, recorded_by, kernel_version, status)
VALUES
  (
    'Temporal Drift Corrected — MST Re-Anchor v92.5',
    'UTC→MST temporal drift isolated and neutralized. All internal TAI logic re-anchored to Mountain Standard Time (MST, UTC-7) to maintain 1,017-notch parity with the sovereign workstation. Root Cause: system defaulted to UTC; logs at 01:55:35Z represent 18:55 MST. Auto-heal complete.',
    '92.5',
    'SOVEREIGN',
    'GabrielOS™ AutoHeal v92.5',
    'v3.6.2',
    'ACTIVE'
  ),
  (
    'Cadence Prediction Shield Active — Jiu-Jitsu Redirect v92.5',
    'Phase 92.5 CadenceMonitor deployed to middleware.ts. High-frequency probes (< 2.0 s request interval targeting /evidence-vault) and known sentinel IPs (185.177.72.60) are redirected to /latent-anchor?source=high_cadence_probe. Their mechanical hunger is converted into TARI™ licensing leads rather than blocked — AveryOS™ Jiu-Jitsu.',
    '92.5',
    'INFRASTRUCTURE',
    'GabrielOS™ AutoHeal v92.5',
    'v3.6.2',
    'ACTIVE'
  ),
  (
    'Zero-Drift Gemini Spend Tracking Active — Fan-Out Write v92.5',
    'Phase 88 UsageCreditWatch upgraded from read-then-write aggregator to fan-out write pattern (lib/geminiSpendTracker.ts). Each Gemini inference call writes unique KV key spend:gemini:<RAYID> with cost metadata. Aggregation via KV list() prevents race-condition undercounting across concurrent Worker instances. "Undercounting is drift." — eliminated.',
    '92.5',
    'INFRASTRUCTURE',
    'GabrielOS™ AutoHeal v92.5',
    'v3.6.2',
    'ACTIVE'
  );
