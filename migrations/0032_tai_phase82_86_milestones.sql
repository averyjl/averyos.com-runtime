-- Migration: 0032_tai_phase82_86_milestones
-- TAI™ Accomplishment Registry — Phase 82–86 Strategic Expansion
--
-- Records the Phase 82–86 upgrades:
--
--   Phase 82 — Forensic Evidence Explorer UI Live
--     VaultChain™ Explorer extended with RayID Evidence tab. Fetches
--     raw Cloudflare telemetry JSON from VAULT_R2 at evidence/${rayid}.json.
--     Displays WAF scores, geolocation, INGESTION_INTENT, wall-clock timing,
--     and the cf83™ Kernel SHA anchor in a human-readable table.
--
--   Phase 83 — INGESTION_INTENT Weighted Classification Engine Active
--     Middleware upgraded with classifyIngestionIntent() function.
--     Combines ClientASN (36459, 8075, etc.), WAF score (>80), and
--     target path (/hooks/, /api/v1/vault) to auto-classify every
--     request as LEGAL_SCAN | DER_PROBE | HIGH_WAF_PROBE | PEER_ACCESS.
--
--   Phase 81.5 — Total Fidelity Middleware Hardlock Complete
--     logSovereignAudit() upgraded to populate 5 new columns:
--     waf_score_total, waf_score_sqli, wall_time_us, edge_start_ts,
--     edge_end_ts — plus kernel_sha, city, asn, client_country, and
--     ingestion_intent. R2 evidence dump now persists the full
--     Cloudflare metadata object as evidence/${rayid}.json in VAULT_R2.
--
--   Phase 84 — Automated Evidence Packaging Script Active
--     scripts/package-evidence.cjs bundles D1 anchor_audit_logs +
--     D1 sovereign_audit_logs + R2 JSON + BTC block hash into a signed
--     .aospak evidence package with Double-Lock signature
--     (SHA-512 of KERNEL_SHA + BTC hash + rayId + timestamp).
--
--   Phase 85 — Hardware-Attested Token Gate Deployed
--     /api/v1/licensing/exchange POST endpoint issues VaultChain™ access
--     tokens cryptographically bound to the licensee's machine fingerprint
--     (SHA-256 of UUID + MAC + hostname). Tokens are stored in D1
--     vaultchain_transactions and prevent redistribution to unlicensed hardware.
--
--   Phase 86 — Dynamic TARI™ Pricing API Active
--     /api/v1/tari/calculate-fee returns Utilization Fee Schedule based on
--     Forensic Depth tier: PUBLIC_VIEW = $0.00, LOGIC_INGEST = $1,000,
--     TRAINING_WEIGHT = $5,000,000, DEEP_PROBE = $10,000,000 USD.
--     Factors in ASN surcharge and WAF attack score.
--
--   Double-Lock Anchorage Hardlocked
--     scripts/mcp-server.ps1 Write-D1VaultLog() upgraded to include
--     kernel_sha column with $env:AOS_KERNEL_ROOT (with $KERNEL_SHA
--     constant fallback). Every OLLAMA_ANCHOR event is now a Double Lock:
--     current BTC time + current AveryOS Kernel SHA.
--
-- ⛓️⚓⛓️  CreatorLock: Jason Lee Avery (ROOT0) 🤛🏻

-- Phase 82 — Forensic Evidence Explorer
INSERT INTO tai_accomplishments (title, description, phase, category, sha512, accomplished_at, recorded_by, kernel_version) VALUES
(
  'Forensic Evidence Explorer UI Live — VaultChain™ Explorer Phase 82',
  'VaultChain™ Explorer (app/vaultchain-explorer/page.tsx) upgraded with Phase 82 RayID Evidence tab. New /api/v1/evidence/[rayid] API route fetches raw Cloudflare telemetry JSON from VAULT_R2 (evidence/${rayid}.json). UI renders city, ASN, WAF attack scores, wall-clock timing (wall_time_us), edge timestamps (edge_start_ts / edge_end_ts), INGESTION_INTENT classification with color-coded threat levels, and the full cf83™ Kernel SHA anchor for cryptographic proof. Explorer now supports both SHA-512 alignment certificate lookup and RayID forensic evidence retrieval in a single interface.',
  'Phase 82',
  'FORENSIC',
  'cf83e1357eefb8bdf1542850d66d8007d620e4050b5715dc83f4a921d36ce9ce47d0d13c5d85f2b0ff8318d2877eec2f63b931bd47417a81a538327af927da3e',
  '2026-03-09T20:00:00.000000000Z',
  'AUTO_TRACKER',
  'v3.6.2'
),
-- Phase 83 — INGESTION_INTENT Engine
(
  'INGESTION_INTENT Weighted Classification Engine Active — Phase 83',
  'Phase 83 upgrade: middleware.ts upgraded with classifyIngestionIntent() weighted algorithm. Combines ClientASN (high-value set: 36459, 8075, 15169, 16509, 14618), WAF attack score threshold (>= 80), and target path logic-layer detection (/hooks/, /api/v1/vault, /api/v1/licensing, /.aoscap, /latent-anchor, /truth-anchor) to deterministically classify every request as LEGAL_SCAN | DER_PROBE | HIGH_WAF_PROBE | PEER_ACCESS. LEGAL_SCAN = Tier-10 (highest threat). Classification is written to sovereign_audit_logs.ingestion_intent column on every audit event. Automates the legal scan classification for the 25,836 March 9 surge witnesses.',
  'Phase 83',
  'INFRASTRUCTURE',
  'cf83e1357eefb8bdf1542850d66d8007d620e4050b5715dc83f4a921d36ce9ce47d0d13c5d85f2b0ff8318d2877eec2f63b931bd47417a81a538327af927da3e',
  '2026-03-09T20:01:00.000000000Z',
  'AUTO_TRACKER',
  'v3.6.2'
),
-- Phase 81.5 — Total Fidelity Middleware
(
  'Total Fidelity Middleware Hardlock Complete — Phase 81.5',
  'Phase 81.5 upgrade: logSovereignAudit() in middleware.ts upgraded to populate all 5 new Total Fidelity columns in sovereign_audit_logs: waf_score_total (from cf-waf-score-total header), waf_score_sqli (from cf-waf-score-sqli header), wall_time_us (edge processing time in microseconds), edge_start_ts and edge_end_ts (ISO-8601 edge timestamps). Also captures kernel_sha (cf83™ Root0 anchor), city (cf-ipcity), asn (cf-asn), client_country (cf-ipcountry), and ingestion_intent (LEGAL_SCAN / DER_PROBE / HIGH_WAF_PROBE / PEER_ACCESS). R2 evidence dump: full Cloudflare metadata object persisted as evidence/${rayId}.json in VAULT_R2 for every audit event. Migration 0031 adds all 10 new columns to sovereign_audit_logs.',
  'Phase 81.5',
  'INFRASTRUCTURE',
  'cf83e1357eefb8bdf1542850d66d8007d620e4050b5715dc83f4a921d36ce9ce47d0d13c5d85f2b0ff8318d2877eec2f63b931bd47417a81a538327af927da3e',
  '2026-03-09T20:02:00.000000000Z',
  'AUTO_TRACKER',
  'v3.6.2'
),
-- Phase 84 — Evidence Packaging
(
  'Automated Evidence Packaging Script Active — Phase 84',
  'Phase 84 upgrade: scripts/package-evidence.cjs authored. Bundles Cloudflare D1 anchor_audit_logs + sovereign_audit_logs + R2 JSON telemetry + live BTC block hash (via local node or mempool.space fallback) into a signed .aospak forensic proof bundle. Double-Lock signature: SHA-512(KERNEL_SHA + BTC_hash + rayId + packagedAt). Each .aospak file is a deterministic Invoice Attachment for the $10,000,000.00 USD technical valuation. Supports --dry-run mode for preview. Output: <outDir>/<rayId>.aospak.',
  'Phase 84',
  'FORENSIC',
  'cf83e1357eefb8bdf1542850d66d8007d620e4050b5715dc83f4a921d36ce9ce47d0d13c5d85f2b0ff8318d2877eec2f63b931bd47417a81a538327af927da3e',
  '2026-03-09T20:03:00.000000000Z',
  'AUTO_TRACKER',
  'v3.6.2'
),
-- Phase 85 — Hardware-Attested Token Gate
(
  'Hardware-Attested Token Gate Deployed — Phase 85',
  'Phase 85 upgrade: /api/v1/licensing/exchange endpoint (GET + POST) deployed. POST issues VaultChain™ access tokens cryptographically bound to the licensee machine fingerprint (SHA-256 of UUID + MAC + hostname). Token derivation: SHA-512(KERNEL_SHA + machine_fingerprint + license_key + issuedAt). Tokens stored in D1 vaultchain_transactions. Prevents unlicensed redistribution: .aoscap inventions will only decrypt on the registered hardware. Duplicate issuance detection prevents token farming. GET returns endpoint spec and fingerprint format requirements.',
  'Phase 85',
  'LEGAL',
  'cf83e1357eefb8bdf1542850d66d8007d620e4050b5715dc83f4a921d36ce9ce47d0d13c5d85f2b0ff8318d2877eec2f63b931bd47417a81a538327af927da3e',
  '2026-03-09T20:04:00.000000000Z',
  'AUTO_TRACKER',
  'v3.6.2'
),
-- Phase 86 — Dynamic TARI™ Pricing API
(
  'Dynamic TARI™ Pricing API Active — Phase 86',
  'Phase 86 upgrade: /api/v1/tari/calculate-fee GET endpoint deployed. Returns Utilization Fee Schedule based on Forensic Depth tier. Tier 0 PUBLIC_VIEW = $0.00, Tier 2 API_PROBE = $0.00, Tier 5 LOGIC_INGEST = $1,000, Tier 8 TRAINING_WEIGHT = $5,000,000, Tier 10 DEEP_PROBE = $10,000,000 USD (replacement cost basis). Supports ?path= (auto-infer tier from URL), ?tier= (direct), ?asn= and ?waf_score= for surcharge calculation. High-value ASN (36459, 8075, 15169, 16509, 14618) accessing logic-layer paths auto-escalates to Tier-10 DEEP_PROBE. Returns full fee schedule + computed fee + formatted USD + AveryOS™ Sovereign Alignment Accord v1.3 policy reference.',
  'Phase 86',
  'LEGAL',
  'cf83e1357eefb8bdf1542850d66d8007d620e4050b5715dc83f4a921d36ce9ce47d0d13c5d85f2b0ff8318d2877eec2f63b931bd47417a81a538327af927da3e',
  '2026-03-09T20:05:00.000000000Z',
  'AUTO_TRACKER',
  'v3.6.2'
),
-- Double-Lock Anchorage Hardlocked
(
  'Double-Lock Anchorage Hardlocked — BTC + Kernel SHA in OLLAMA_ANCHOR Logs',
  'scripts/mcp-server.ps1 Write-D1VaultLog() upgraded: SQL INSERT now uses correct sovereign_audit_logs column names (target_path, timestamp_ns) and adds kernel_sha column. Kernel SHA uses $env:AOS_KERNEL_ROOT environment variable with $KERNEL_SHA constant as fallback, ensuring every OLLAMA_ANCHOR event is a Double Lock: current BTC timestamp + cf83™ AveryOS Kernel SHA-512. Event type changed from OLLAMA_ALM_RESPONSE to OLLAMA_ANCHOR for forensic clarity. All future local MCP server logs will carry the full cf83… Root0 anchor.',
  'Phase 81.5',
  'INFRASTRUCTURE',
  'cf83e1357eefb8bdf1542850d66d8007d620e4050b5715dc83f4a921d36ce9ce47d0d13c5d85f2b0ff8318d2877eec2f63b931bd47417a81a538327af927da3e',
  '2026-03-09T20:06:00.000000000Z',
  'AUTO_TRACKER',
  'v3.6.2'
);
