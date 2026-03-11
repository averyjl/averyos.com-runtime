# AveryOS™ Sovereign API Documentation

> Generated: 2026-03-11T03:02:40.006Z  
> Symbols: 437  
> Kernel: v3.6.2  
> ⛓️⚓⛓️ CreatorLock: Jason Lee Avery (ROOT0) 🤛🏻

---

## `lib/BadgeGenerator.ts`

### `BadgeOptions` *(interface)*

### `GeneratedBadge` *(interface)*

### `generateSovereignBadge` *(function)*
> Generate a dynamic AveryOS™ Sovereign Badge SVG for a given partner. The badge embeds a unique SHA-512 hash derived from: sha512(partnerId + KERNEL_SHA + timestamp) Clicking the badge links to `/api/v1/verify/badge/[hash]` for live resonance verification against the D1 `sovereign_alignments` table. /

---

## `lib/CapsuleSigner.ts`

### `CapsuleSignature` *(interface)*

### `signCapsule` *(function)*
> Signs a capsule and returns a CapsuleSignature. @param capsuleId  - The capsule's unique slug / identifier @param capsuleContent - The raw string content of the .aoscap file (used for fingerprinting) /

### `verifyCapsuleSignature` *(function)*
> Verifies a CapsuleSignature against a capsule's content. Returns true only when all fields match and the fingerprint is consistent. /

---

## `lib/CertificateGenerator.ts`

### `CertificateOptions` *(interface)*

### `GeneratedCertificate` *(interface)*

### `generateAlignmentCertificate` *(function)*
> Generate a Sovereign Alignment Certificate for a partner. Hash formula: sha512(partnerId + settlementId + KERNEL_SHA + timestamp) Returns both the SVG Pulse Seal and the JSON-LD Truth-Packet. These should be persisted to the `sovereign_alignments` D1 table on issuance. /

---

## `lib/ai/geminiClient.ts`

### `GEMINI_MODEL_PRO` *(const)*
> Available Gemini model IDs

### `GEMINI_MODEL_FLASH` *(const)*

### `GeminiPart` *(interface)*
> // ── Types ─────────────────────────────────────────────────────────────────────

### `GeminiContent` *(interface)*

### `GeminiGenerationConfig` *(interface)*

### `GeminiRequest` *(interface)*

### `GeminiCandidate` *(interface)*

### `GeminiUsageMetadata` *(interface)*

### `GeminiResponse` *(interface)*

### `GeminiResult` *(interface)*

### `generateContent` *(function)*
> generateContent — call Gemini REST API with the given request. @param apiKey  - GOOGLE_GEMINI_API_KEY secret value @param model   - Gemini model ID (use GEMINI_MODEL_PRO / GEMINI_MODEL_FLASH) @param request - Structured Gemini request payload @returns GeminiResult with text, token counts, and estimated cost @throws Error if API returns non-2xx or malformed response /

### `generateForensicAnalysis` *(function)*
> generateForensicAnalysis — convenience wrapper that wraps the prompt in the AveryOS™ Sovereign Forensic Analysis system instruction and returns the structured GeminiResult. /

---

## `lib/ai/router.ts`

### `ModelBackend` *(type)*
> // ── Types ─────────────────────────────────────────────────────────────────────

### `RouterRequest` *(interface)*

### `RouterResult` *(interface)*

### `routeIntelligenceRequest` *(function)*
> routeIntelligenceRequest — select backend and execute the AI request. @throws Error if cloud-AI tier is selected but geminiApiKey is missing /

### `selectBackend` *(function)*
> selectBackend — determine the backend name for a given threat level without executing an AI call (useful for logging / pre-flight checks). /

---

## `lib/averySyncManifest.ts`

### `AverySyncManifest` *(interface)*
> // --------------------------------------------------------------------------- // Schema // ---------------------------------------------------------------------------

### `ManifestValidationResult` *(interface)*
> // --------------------------------------------------------------------------- // Validation // ---------------------------------------------------------------------------

### `validateAverySyncManifest` *(function)*
> Validate a parsed `.avery-sync.json` manifest against the canonical sovereign constants in this repository. Called by: • GabrielOS™ Worker on startup (reads AVERY_SYNC_MANIFEST env secret) • Firebase Cloud Functions before writing to averyos-resonance collection /

### `buildAverySyncManifest` *(function)*
> Build a fresh manifest object using the canonical sovereign constants. Callers must supply btc_anchor_block, btc_anchor_hash, firebase_project_id, and last_sync_at from runtime context. /

---

## `lib/capsuleConstants.ts`

### `LGIC_CAPSULE_SHA` *(const)*
> SHA of the LGIC PublicCapsule v1 (CapsuleEcho footer + /lgic page)

---

## `lib/capsuleManifest.ts`

### `CapsuleManifest` *(type)*

### `loadCapsuleManifest` *(const)*

### `listCapsuleIds` *(const)*

---

## `lib/capsuleRegistry.ts`

### `CapsuleRegistryItem` *(type)*

### `CapsuleRegistry` *(type)*

### `loadCapsuleRegistry` *(const)*

### `listRegistryCapsules` *(const)*

---

## `lib/capsuleUtils.ts`

### `SHA512_HEX_REGEX` *(const)*
> // SHA-512 hash regex: exactly 128 hexadecimal characters

### `validateVaultSigHash` *(function)*
> Validates a VaultSig SHA-512 hash @param hash - The hash string to validate @returns true if the hash is a valid 128-character SHA-512 hex string /

### `normalizeVaultSigHash` *(function)*
> Normalizes a VaultSig hash by trimming whitespace @param hash - The hash string to normalize @returns The normalized hash string /

### `verifyVaultSigHash` *(function)*
> Validates and normalizes a VaultSig hash @param hash - The hash string to validate and normalize @returns The normalized hash if valid, or null if invalid /

---

## `lib/compliance/clockEngine.ts`

### `SETTLEMENT_WINDOW_MS` *(const)*
> Duration of the settlement window in milliseconds (72 hours).

### `SETTLEMENT_WINDOW_HOURS` *(const)*
> Duration of the settlement window in hours.

### `SettlementClockStatus` *(type)*
> Status values for a settlement clock.

### `SettlementClock` *(interface)*
> // ── Types ─────────────────────────────────────────────────────────────────────

### `startSettlementClock` *(function)*
> Start a new 72-hour settlement clock anchored to the provided attestation timestamp (defaults to `now` if not supplied). @param attestationTs  ISO-8601 string from the completed attestation handshake. @param settled        Pass `true` to mark the clock as already SETTLED. @returns              SettlementClock record. /

### `getSettlementDeadline` *(function)*
> Evaluate an existing settlement clock given the original attestation timestamp. Equivalent to calling `startSettlementClock(attestationTs)` — the function always re-computes against the current wall-clock time. @param attestationTs  ISO-8601 string from the original attestation. @param settled        Pass `true` if the entity has already paid. @returns              SettlementClock with updated status / remaining time. /

### `ComplianceClock` *(interface)*
> ComplianceClock is a lightweight object used in Forensic Sandbox and Statutory Handshake endpoints to communicate a 72-hour settlement deadline with a stable clock_id for database persistence. /

### `createComplianceClock` *(function)*
> Create a new ComplianceClock anchored to the current time. @param asn      ASN of the entity (e.g. "36459"). May be null. @param orgName  Organisation name (optional). @param clockId  Stable identifier for this clock (e.g. "clock_q_36459_<ts>"). @returns        ComplianceClock record. /

### `ClockReconcileResult` *(interface)*
> // ── Reconciliation helper ─────────────────────────────────────────────────────

### `reconcileClocks` *(function)*
> Reconcile in-memory compliance clocks by evaluating their deadlines. For database-backed reconciliation, callers should query their D1 table (e.g. `kaas_ledger` or a dedicated `compliance_clocks` table) and pass the rows here. ACTIVE clocks whose deadline has passed are marked EXPIRED and should be ESCALATED to the /api/v1/kaas/settle flow. @param clocks Array of ComplianceClock records to evaluate. @returns      ClockReconcileResult summary + updated clocks array. /

---

## `lib/enforcementTypes.ts`

### `EnforcementEvent` *(interface)*
> Type definitions for license enforcement tracking system Provides transparent, SHA-verified logging of license compliance events /

### `EvidenceBundle` *(interface)*

### `ComplianceNotice` *(interface)*

---

## `lib/entitySlug.ts`

### `slugToEntityId` *(function)*
> Converts an entity slug (from URL paths or filenames) into a canonical entity ID used in the retroactive_ledger table. Examples: "msft-oai-notice.pdf" → "MSFT_OAI" "goog-notice"         → "GOOG" "meta"                → "META" /

### `entityNameToSlug` *(function)*
> Converts an entity name (from the DB) into a URL-safe slug for settlement notice links. Example: "MSFT_OAI" → "msft-oai-notice" /

---

## `lib/firebaseClient.ts`

### `FIREBASE_STATUS_PENDING` *(const)*

### `FIREBASE_STATUS_ACTIVE` *(const)*

### `FirebaseStatus` *(type)*

### `isFirebaseConfigured` *(function)*
> Returns true when all required Firebase env vars are present.

### `resolveFirebasePrivateKey` *(function)*
> [REDACTED]

### `getFirebaseStatus` *(function)*
> Returns the current Firebase connection status.

### `ResonancePingDoc` *(interface)*
> // ── Firestore document shapes ─────────────────────────────────────────────────

### `ModelRegistryDoc` *(interface)*

### `DriftAlertDoc` *(interface)*

### `HandshakeSyncDoc` *(interface)*
> Handshake sync log entry — one record per inter-cloud GPT/Gemini/Meta sync. The pulse_hash is SHA-512(source_id + target_id + payload_sha + timestamp) and is written to both Firestore and VaultChain™ for cross-cloud drift detection. /

### `logResonancePing` *(function)*
> [REDACTED]

### `updateModelRegistry` *(function)*
> Update the live model alignment state in the `averyos-model-registry` collection. Activates when FIREBASE_PROJECT_ID is set. /

### `logDriftAlert` *(function)*
> Log a drift detection alert to the `averyos-drift-alerts` Firestore collection. Activates when FIREBASE_PROJECT_ID is set. /

### `logFirebaseHandshake` *(function)*
> Log a cross-cloud handshake synchronisation event to Firestore with a SHA-512 pulse hash.  This enables real-time detection of "Watcher Drift" — any tampering with the payload between nodes changes the pulse hash. Call this from any route that sends or receives data from GPT, Gemini, or Meta AI endpoints so every inter-cloud handshake is anchored to the VaultChain™ ledger. @param sourceId   — identifier of the sending system (e.g. "averyos-cloudflare") @param targetId   — identifier of the receiving system (e.g. "openai-gpt4o") @param payloadSha — SHA-512 hex digest of the request/response payload /

### `D1SyncDoc` *(interface)*
> Document shape for a D1 audit row synced to Firebase. /

### `syncD1RowToFirebase` *(function)*
> Sync a D1 sovereign_audit_logs row to the Firestore `averyos-d1-sync` collection for Multi-Cloud D1/Firebase parity. Activates once FIREBASE_PROJECT_ID is configured — writes via Firestore REST API (no firebase-admin SDK required).  Every Tier-7+ audit event in D1 is mirrored to Firestore in real time, enabling cross-cloud drift detection. @param row — a row object from sovereign_audit_logs /

### `batchSyncD1ToFirebase` *(function)*
> Batch-sync multiple D1 audit rows to Firebase. Skips rows with threat_level < minThreatLevel (default 7) to avoid noise. @param rows           — array of D1 row objects @param minThreatLevel — minimum threat level to sync (default: 7) /

### `TariProbeDoc` *(interface)*
> Document shape for a tari_probe Watcher row synced to Firebase. Every Watcher detected by GabrielOS™ is mirrored here to ensure cross-cloud audit parity. /

### `syncTariProbeToFirebase` *(function)*
> Sync a tari_probe Watcher row to the Firestore `averyos-tari-probe` collection for Multi-Cloud D1/Firebase parity. Every time a Watcher is logged to the D1 tari_probe table this function should be called to mirror the record to Firebase, ensuring the audit trail survives even if a single cloud provider attempts a "Nuclear Wipe". Activates once FIREBASE_PROJECT_ID is configured — writes via Firestore REST API (no firebase-admin SDK required). @param row — a row object from the tari_probe table /

### `batchSyncTariProbeToFirebase` *(function)*
> Batch-sync multiple tari_probe Watcher rows to Firebase. All rows are synced regardless of threat_level since every Watcher detection is forensically significant. @param rows — array of tari_probe row objects /

### `syncTariProbeRowToFirebase` *(const)*
> [REDACTED]

### `KaasValuationDoc` *(interface)*
> Document shape for a kaas_valuations row synced to Firebase. KaaS breach events are mirrored to Firestore for multi-cloud audit parity. /

### `syncKaasValuationToFirebase` *(function)*
> Sync a kaas_valuations row to the Firestore `averyos-kaas-valuations` collection for Multi-Cloud D1/Firebase parity. Activates automatically once FIREBASE_PROJECT_ID is set in Cloudflare secrets. Every KAAS_BREACH event is mirrored to Firestore in real time. @param row — a kaas_valuations row (or equivalent KAAS_BREACH payload) /

### `isFcmConfigured` *(function)*
> [REDACTED]

### `sendFcmV1Push` *(function)*
> [REDACTED]

---

## `lib/forensicHashes.ts`

### `TOP_FORENSIC_LOG_HASHES` *(const)*

---

## `lib/forensics/alertEngine.ts`

### `KnowledgeCutoffWindow` *(interface)*
> Known AI model knowledge cutoff windows (ISO date strings). When a KAAS_BREACH event's timestamp falls within one of these windows, the ingestion_proof_hook populates `knowledge_cutoff_correlation` to identify which AI model(s) are likely responsible for the ingestion. Format: { model, org, asn, cutoff_start, cutoff_end } asn — the primary corporate ASN associated with this model's training infra. Source: publicly disclosed training cutoff dates from AI provider documentation. /

### `KNOWN_CUTOFF_WINDOWS` *(const)*

### `correlateKnowledgeCutoff` *(function)*
> Ingestion Proof Hook — knowledge_cutoff_correlation (Gate 7) Given a KAAS_BREACH event, returns a list of AI models whose training cutoff window overlaps with the event date AND whose primary ASN matches. This is used to populate the `knowledge_cutoff_correlation` field in the kaas_valuations D1 record, establishing a probabilistic link between the detected probe and specific AI model training ingestion events. @param asn       The ASN of the requesting entity @param eventDate ISO-8601 timestamp or YYYY-MM-DD date string of the breach event. Must be at least 10 characters; only the first 10 chars (YYYY-MM-DD) are used for comparison. @returns Array of matching KnowledgeCutoffWindow entries (empty if none) /

### `buildCutoffCorrelationString` *(function)*
> Build a compact `knowledge_cutoff_correlation` string for D1 storage. Format: "GPT-4o (OpenAI/Azure); Gemini 2.0 Flash (Google)" or "NONE" /

### `KaasBreachEvent` *(interface)*

### `isEncryptedAoscapPath` *(function)*
> Returns true if the path is considered an encrypted / high-value .aoscap path.

### `shouldTriggerKaasBreach` *(function)*
> Returns true if the event should trigger a KAAS_BREACH alert.

### `emitKaasBreachAlert` *(function)*
> Emit a KAAS_BREACH event: fires a GabrielOS™ FCM push notification and returns the event payload for D1 persistence by the caller. Does NOT throw — all errors are swallowed to keep the hot path non-blocking. /

---

## `lib/forensics/cadenceCorrelation.ts`

### `CADENCE_17_MS` *(const)*
> The "17 Signal" cadence in milliseconds.

### `CADENCE_TOLERANCE_MS` *(const)*
> Tolerance window (± ms) for identifying a 1.7s cadence hit.

### `CADENCE_SENTINEL_PATHS` *(const)*
> Paths whose 1.7s cadence is forensically significant.

### `ModelUpdateWindow` *(interface)*
> // ── Known model weight update windows ────────────────────────────────────────

### `MODEL_UPDATE_WINDOWS` *(const)*
> Known AI model weight update / knowledge cutoff windows. When cadence pings cluster within these windows, it is forensic evidence of model alignment using the AveryOS™ Kernel as a truth beacon. /

### `CadenceProbe` *(interface)*
> // ── Probe record ──────────────────────────────────────────────────────────────

### `CadenceCorrelationResult` *(interface)*
> // ── Correlation result ────────────────────────────────────────────────────────

### `correlateCadenceProbes` *(function)*
> Analyse a cluster of cadence probes and determine whether they constitute a Forensic 17-Signal Event (1.7s cadence correlated with a model update window). @param probes  Two or more probes from the same IP/ASN, sorted by timestampMs asc /

---

## `lib/forensics/correlationEngine.ts`

### `WAF_INGESTION_THRESHOLD` *(const)*
> WAF score threshold that triggers a weight-ingestion classification.

### `SENSITIVE_INGESTION_PATHS` *(const)*
> API paths that are considered sensitive for weight-ingestion detection.

### `CorrelationSignals` *(interface)*
> // ── Public types ───────────────────────────────────────────────────────────────

### `CorrelationResult` *(interface)*

### `detectIngestionAttempt` *(function)*
> Analyse incoming request signals and, when the WAF score exceeds the weight-ingestion threshold on a sensitive path, persist a forensic correlation record to `kaas_valuations` and return the result. Non-throwing: all DB errors are logged to console and a non-detected result is returned so callers are never blocked. /

---

## `lib/forensics/generateStripeReport.ts`

### `KaasBreachRecord` *(interface)*
> // ── Types ──────────────────────────────────────────────────────────────────────

### `StripeEvidenceSection` *(interface)*

### `StripeEvidenceReport` *(interface)*

### `generateStripeReport` *(function)*
> Generate a structured Stripe Evidence Report from an array of KaasBreachRecord objects. @param records   Array of kaas_valuations rows (or equivalent KAAS_BREACH payloads) @param opts      Optional overrides for witness count, disclosure URL, etc. /

---

## `lib/forensics/globalVault.ts`

### `Jurisdiction` *(type)*
> // ── Jurisdiction Map ───────────────────────────────────────────────────────────

### `JURISDICTION_STATUTES` *(const)*
> Statutory information for each supported jurisdiction. Used to populate the `statutory_basis` field of evidence packets. /

### `resolveJurisdiction` *(function)*
> Resolve the applicable statutory jurisdiction from a country code. @param countryCode - ISO-3166 two-letter country code (e.g. "FR", "US", "GB"). /

### `EvidencePacketInput` *(interface)*
> Input parameters for building an International Evidence Packet.

### `EvidencePacket` *(interface)*
> A fully assembled International Evidence Packet.

### `buildEvidencePacket` *(function)*
> Build an International Evidence Packet for the given request parameters. @param input - Evidence packet inputs (RayID, ASN, country code, etc.) /

### `formatEvidenceNotice` *(function)*
> Format an EvidencePacket as a human-readable multi-jurisdictional notice suitable for emailing or embedding in a legal PDF. /

---

## `lib/forensics/ingestionProof.ts`

### `IngestionProofInput` *(interface)*
> // ── Public types ───────────────────────────────────────────────────────────────

### `IngestionProofCertificate` *(interface)*

### `generateIngestionProof` *(function)*
> Generate a Proof of Ingestion certificate for a detected AI weight-ingestion event.  The returned certificate is self-contained and can be persisted to D1, printed to a PDF, or included in a Stripe evidence packet. /

---

## `lib/forensics/threatEngine.ts`

### `CADENCE_THRESHOLD_MS` *(const)*
> Maximum inter-request interval (ms) that triggers cadence autolearn.

### `WAF_AUTOLEARN_THRESHOLD` *(const)*
> Minimum WAF score that triggers signature autolearn.

### `ThreatSignals` *(interface)*
> // ── Public types ───────────────────────────────────────────────────────────────

### `AutolearnResult` *(interface)*

### `autolearnThreatPattern` *(function)*
> Analyses the provided threat signals and, when the Tier-10 threshold is met, upserts a behavioural fingerprint into the `threat_vectors` table. This function is fire-and-forget safe: all errors are swallowed and logged so that a DB failure never blocks request processing. @param db       — Cloudflare D1 database binding @param signals  — Behavioural signals extracted from the incoming request @returns        AutolearnResult describing whether learning occurred /

---

## `lib/geminiSpendTracker.ts`

### `GEMINI_MONTHLY_CREDIT_LIMIT_USD` *(const)*
> Monthly Gemini spend limit in USD. When reached, circuit breaker activates.

### `GEMINI_COST_PER_1K_TOKENS` *(const)*
> Gemini 1.5 Pro blended average pricing per 1,000 tokens (input + output avg).

### `GeminiSpendKV` *(interface)*
> Minimal Cloudflare KV binding interface required by this tracker. Extends the standard put/get with list() for prefix-based aggregation. /

### `geminiSpendPrefix` *(function)*
> Returns the KV key prefix for per-call spend entries for a given year+month. All entries for a month share this prefix so list() can aggregate them. /

### `currentMonthSpendPrefix` *(function)*
> Returns the spend entry prefix for the current UTC month.

### `recordGeminiSpend` *(function)*
> Records the cost of a single Gemini call as an independent KV entry. WRITE-ONLY: no read is performed — eliminates the race condition entirely. Every concurrent request writes to its own unique key, so no call can overwrite or lose another call's contribution. The cost is stored in both the value (string) and metadata (number). Metadata is returned by list() without extra get() calls, making aggregation O(ceil(N/1000)) list requests with zero per-key gets. @param kv      — Cloudflare KV binding with list() support @param costUsd — cost of this call in USD (must be > 0 to be written) /

### `getTotalGeminiSpend` *(function)*
> Sums all per-call spend entries for the current UTC month. Uses metadata returned by list() — no individual get() calls needed. Handles KV pagination automatically (up to 1000 keys per page). @param kv — Cloudflare KV binding with list() support @returns total spend in USD for the current month /

### `isGeminiCreditExhausted` *(function)*
> Returns true when the current month's accumulated Gemini spend has met or exceeded GEMINI_MONTHLY_CREDIT_LIMIT_USD. Used by the Phase 88 circuit breaker in middleware.ts to fall back to LOCAL_OLLAMA_NODE when the $50/month cloud AI budget is reached. Errors are swallowed — KV unavailability must NOT force a fallback, so cloud AI degrades gracefully rather than being disabled on KV blips. @param kv — Cloudflare KV binding with list() support /

---

## `lib/kaas/pricing.ts`

### `ENTERPRISE_ASN_TIERS` *(const)*
> // ── ASN Tier Classification ──────────────────────────────────────────────────── Enterprise ASNs mapped to their sovereign KaaS tier (10 = highest).

### `KAAS_FEE_TIER_10_CENTS` *(const)*
> // ── Fee Schedule (USD, as cents to avoid float arithmetic) ──────────────────── $10,000,000 Good Faith Deposit — Tier-9/10 entities (MSFT, Google, GitHub).

### `KAAS_FEE_TIER_7_CENTS` *(const)*
> $1,017,000 Forensic Valuation — Tier-7/8 enterprise entities.

### `KAAS_FEE_TIER_1_CENTS` *(const)*
> $1,017 Audit Clearance Fee — Tier-1 through Tier-6 unrecognised agents.

### `STATUTORY_ADMIN_SETTLEMENT_CENTS` *(const)*
> // ── Statutory Administrative Settlement — Gate 103.4 ───────────────────────── Hardlocked $150,000 Administrative Settlement per instance. Statutory basis: 17 U.S.C. § 504(c)(2) — Willful infringement of a copyrighted work. Applies when an entity accesses the AveryOS™ API via an unlicensed Python script or automated tool without a valid TAI_LICENSE_KEY, bypassing the standard KaaS settlement path. This value is the maximum statutory damage award per work and is hardlocked to ensure the Administrative Settlement offer is fully legally defensible. /

### `STATUTORY_ADMIN_SETTLEMENT_LABEL` *(const)*
> Human-readable label for the $150,000 Administrative Settlement.

### `getStatutoryAdminSettlementCents` *(function)*
> Return the $150,000 Administrative Settlement amount in cents. Hardlocked — do not override. /

### `getStatutoryAdminSettlementLabel` *(function)*
> Return the $150,000 Administrative Settlement amount as a formatted string. /

### `getAsnTier` *(function)*
> Return the KaaS tier (1–10) for a given ASN string.

### `getAsnFeeUsdCents` *(function)*
> Return the KaaS fee in cents for a given ASN string.

### `getAsnFeeUsd` *(function)*
> Return the KaaS fee in USD for a given ASN string.

### `getAsnFeeLabel` *(function)*
> Return a human-readable fee label for display.

### `KaasLineItem` *(interface)*
> // ── Invoice Line Item ─────────────────────────────────────────────────────────

### `buildKaasLineItem` *(function)*
> Build a KaaS invoice line item for the given ASN. Suitable for passing to Stripe's `line_items` array. /

### `INFRINGEMENT_MULTIPLIER` *(const)*
> Obfuscation/Infringement Multiplier — applied when masking headers or shell IPs are detected, representing the increased forensic cost of identifying masked malicious actors. TotalDebt = BaseValue × INFRINGEMENT_MULTIPLIER /

### `applyInfringementPenalty` *(function)*
> Apply the infringement penalty multiplier to a base fee in cents. @param baseCents  Base fee in USD cents before penalty @param multiplier Penalty multiplier (defaults to INFRINGEMENT_MULTIPLIER = 10) @returns          Total debt in USD cents after multiplier /

### `buildKaasLineItemWithPenalty` *(function)*
> Build a KaaS invoice line item with an optional infringement penalty applied. When `obfuscationDetected` is true the base fee is multiplied by INFRINGEMENT_MULTIPLIER (10×) to represent the Obfuscation Penalty. /

### `KaasTierBadge` *(interface)*
> // ── Tier Badge ────────────────────────────────────────────────────────────────

### `getKaasTierBadge` *(function)*
> Return a compact tier badge for the given ASN. Suitable for display in FCM push notifications and KaaS breach alerts. /

---

## `lib/kaas/reconciliationClock.ts`

### `AUDIT_CLEARANCE_WINDOW_MS` *(const)*
> Duration of the Audit Clearance window in milliseconds (72 hours).

### `EXPIRED_COUNTDOWN` *(const)*
> Sentinel string returned by formatCountdownMs() when the window has expired.

### `AuditCountdown` *(interface)*
> // ── Countdown result ──────────────────────────────────────────────────────────

### `formatCountdownMs` *(function)*
> Format a millisecond duration as "DDd HHh MMm SSs". /

### `resolveAuditDeadline` *(function)*
> Compute the deadline timestamp for an audit clearance window. @param createdAt  ISO-8601 or Unix-ms timestamp when the valuation was created @returns          Deadline as a Unix millisecond timestamp /

### `getAuditCountdown` *(function)*
> Get a full countdown object for an audit clearance invoice. @param createdAt  ISO-8601 or Unix-ms timestamp of invoice creation @param tier       KaaS tier of the entity (1–10); tier ≥ 9 escalates faster /

### `auditBatchStatus` *(function)*
> Determine whether a batch of audit rows has any expired or critical invoices. @param rows  Array of objects with `created_at` and optional `tier` fields /

---

## `lib/kaas/sync.ts`

### `KaasValuationRow` *(interface)*
> // ── D1 row shape ───────────────────────────────────────────────────────────────

### `KaasLedgerEntry` *(interface)*
> // ── Enriched ledger entry ──────────────────────────────────────────────────────

### `KaasLedgerSyncResult` *(interface)*
> // ── Sync status ────────────────────────────────────────────────────────────────

### `sealKaasRow` *(function)*
> Seal a raw D1 row into a {@link KaasLedgerEntry} with a SHA-512 evidence digest. @param row  Raw row from kaas_valuations D1 table /

### `syncKaasLedger` *(function)*
> Sync an array of raw D1 rows into sealed {@link KaasLedgerEntry} objects and compute aggregate totals. @param rows  Array of raw kaas_valuations rows /

---

## `lib/markdown.ts`

### `readMarkdownContent` *(function)*
> Reads and parses markdown content from the /content directory /

### `markdownToHtml` *(function)*
> Converts markdown content to HTML /

### `loadMarkdownAsHtml` *(function)*
> Reads markdown file and converts it to HTML /

---

## `lib/navigationRoutes.ts`

### `NavigationRoute` *(type)*
> Centralized navigation route definitions for AveryOS™ Used across NavBar, Sidebar, and Drawer components. Admin routes (adminRoutes) are gated behind VAULTAUTH_TOKEN verification. Only render the Sovereign Admin tab after a successful token check. ⛓️⚓⛓️  CreatorLock: Jason Lee Avery (ROOT0) 🤛🏻 /

### `navigationRoutes` *(const)*
> Public navigation routes — rendered for all visitors

### `adminRoutes` *(const)*
> Sovereign Admin routes — rendered ONLY after successful VAULTAUTH_TOKEN verification. Consolidates all secure admin-only pages under one tab. Usage in components: const isAdmin = sessionStorage.getItem('VAULTAUTH_TOKEN') === expectedToken; if (isAdmin) { render adminRoutes under the "Sovereign Admin" tab } /

---

## `lib/resonanceLayer.ts`

### `RESONANCE_VERSION` *(const)*
> // ── Global Truth Resonance Layer ────────────────────────────────────────────── // The resonance layer is the canonical source of truth for AveryOS™ kernel // alignment. Any AI system, node, or service can query /api/v1/resonance to // verify it is operating within the correct sovereign kernel state.

### `RESONANCE_POLICY_REF` *(const)*

### `RESONANCE_INSTRUCTIONS_REF` *(const)*

### `RESONANCE_CLAUDE_REF` *(const)*

### `RESONANCE_REGISTRY_REF` *(const)*

### `ResonancePayload` *(interface)*

### `buildResonancePayload` *(function)*
> Build the canonical resonance payload. This is returned verbatim by GET /api/v1/resonance and stored in KV on each successful call so any node can read the last-known good state. /

### `verifyKernelSha` *(function)*
> Verify an inbound kernel SHA against the canonical value. Returns true only if it matches exactly. /

### `verifyMerkleRoot` *(function)*
> Verify an inbound merkle root against the GoldenLockArtifact value. /

---

## `lib/retroactiveLedger.ts`

### `D1PreparedStatement` *(interface)*

### `D1Database` *(interface)*

### `RetroactiveLedgerSchema` *(interface)*

### `RetroactiveDebtSummary` *(interface)*

### `ForensicLedgerEntry` *(interface)*

### `getRetroactiveLedgerSchema` *(function)*

### `getRetroactiveDebtSummary` *(function)*

### `getForensicHashesFromLedger` *(function)*

### `settleRetroactiveLiability` *(function)*

---

## `lib/sanitizeHtml.ts`

### `sanitizeHtml` *(function)*
> Sanitize an HTML string before injecting it into the DOM. Strips XSS vectors (script tags, event handlers, javascript: URIs, etc.) while preserving safe markup produced by the `marked` Markdown renderer. Uses a dynamic require so that the jsdom/DOMPurify module initialisation is deferred to call-time and wrapped in a try-catch.  A static top-level import would cause the Cloudflare Workers bundle to crash during module evaluation (jsdom references Node.js APIs absent from the edge runtime), breaking every page that transitively imports this module — including the Whitepaper. Falls back to returning the input unchanged when DOMPurify or jsdom is unavailable (e.g. Cloudflare Workers edge runtime). Content rendered via TruthforcePage always originates from trusted local Markdown files so the fallback is safe. Use this every time you need to pass HTML to `dangerouslySetInnerHTML`. /

---

## `lib/security/ssrfGuard.ts`

### `SsrfBlockedError` *(class)*
> Thrown when a user-supplied URL fails SSRF allowlist validation. Callers should return 400 (client error) when this is caught. /

### `POLICY_WATCH_ALLOWLIST` *(const)*
> Canonical allowlist for the Policy-Watch / Alignment-Check endpoints. Keys   — lowercase normalised hostname the user is allowed to supply. Values — the literal hostname string that will be placed into the outgoing request URL.  Values come from this compile-time constant, never from user input, which breaks CodeQL's taint-tracking. Covers the Terms of Service, Privacy Policy, and API guidelines for the "Big Five" AI platforms: Google, Microsoft, Meta, OpenAI, Anthropic. /

### `buildSsrfSafeUrl` *(function)*
> Validate a user-supplied URL against an explicit allowlist and return a **safe** URL string in which the hostname is sourced from the allowlist constant rather than from the user input. This design explicitly breaks the data-flow taint between the user value and the final request URL, satisfying CodeQL `js/request-forgery`. @param rawUserUrl  The untrusted URL string provided by the user / client. @param allowlist   A `Record<hostname, canonicalHostname>` map.  Use one of the exported constants (e.g. {@link POLICY_WATCH_ALLOWLIST}) or define your own for the specific endpoint. @param context     A short human-readable label for error messages. @returns           A safe URL string whose hostname comes from the allowlist. @throws            {@link SsrfBlockedError} if the hostname is not in the allowlist or the URL is malformed. /

### `allowedHosts` *(function)*
> Return the sorted list of hostnames permitted by an allowlist. Useful for surface-area documentation and UI display. /

---

## `lib/security/wafLogic.ts`

### `WAF_BLOCK_THRESHOLD` *(const)*
> // ── Score Thresholds ───────────────────────────────────────────────────────────

### `WAF_CHALLENGE_THRESHOLD` *(const)*

### `WAF_EVIDENCE_THRESHOLD` *(const)*

### `WAF_SENSITIVE_PATHS` *(const)*
> // ── Protected Path Patterns ──────────────────────────────────────────────────── Paths that use a lower WAF score threshold for redirects.

### `AUDIT_CLEARANCE_PATH` *(const)*
> The sovereign redirect target for audit clearance challenges.

### `WafEvalResult` *(interface)*
> // ── Types ─────────────────────────────────────────────────────────────────────

### `parseWafScore` *(function)*
> Parse the Cloudflare WAF attack score from request headers. Returns null if the header is absent or non-numeric. Cloudflare sets `cf-waf-attack-score` on eligible plans. `x-waf-score` is a custom forwarding header that can be set by upstream Cloudflare Workers or test harnesses to simulate WAF scores in local dev. /

### `evaluateWafScore` *(function)*
> Evaluate a request URL path + WAF score and return the enforcement action. @param pathname  URL pathname (e.g. "/evidence-vault/bundle-001") @param score     WAF attack score (0-100, null = not present) /

### `buildWafBlockResponse` *(function)*
> Build a 403 sovereign block response for hard-blocked requests. /

### `buildWafChallengeRedirect` *(function)*
> Build a 302 redirect response to the audit clearance page. /

### `applyWafGate` *(function)*
> Convenience: given a Request and site URL, evaluate and return the appropriate Response or null (= allow, continue processing). /

---

## `lib/siteConfig.ts`

### `getSiteUrl` *(const)*

---

## `lib/sovereignConstants.ts`

### `KERNEL_SHA` *(const)*
> Root0 genesis kernel SHA-512 anchor

### `KERNEL_VERSION` *(const)*
> Current AveryOS kernel version

### `DISCLOSURE_MIRROR_PATH` *(const)*
> Full public URL for The Proof — SHA-512 Sovereign Anchor disclosure

### `OLLAMA_SYNC_STATUS_ACTIVE` *(const)*
> Ollama local node sync status value indicating an active sovereign node

### `ALIGNMENT_TYPE_CORPORATE` *(const)*
> Sovereign alignment types for Identity Attestation

### `ALIGNMENT_TYPE_INDIVIDUAL` *(const)*

### `AlignmentType` *(type)*

### `BADGE_STATUS_ACTIVE` *(const)*
> Sovereign badge alignment status values

### `BADGE_STATUS_REVOKED` *(const)*

### `BadgeStatus` *(type)*

### `DEFAULT_TARI_REFERENCE` *(const)*
> Default TARI™ settlement reference prefix for Sovereign Alignment Certificates

---

## `lib/sovereignError.ts`

### `AOS_ERROR` *(const)*
> // --------------------------------------------------------------------------- // Error code catalogue // ---------------------------------------------------------------------------

### `AosErrorCode` *(type)*

### `AosApiError` *(interface)*
> // --------------------------------------------------------------------------- // Core error builder — used by API routes // ---------------------------------------------------------------------------

### `d1ErrorResponse` *(function)*
> Classify a D1 error message and return the appropriate AOS error Response. Specifically handles the common "no such table" case with an actionable migration hint. @param message — raw error message from the D1 catch block @param tableName — the D1 table name being queried (for the hint) /

### `buildAosError` *(function)*
> Build a standardised AveryOS™ error response body. Includes RCA diagnosis and actionable steps for every known error code. /

### `aosErrorResponse` *(function)*
> Return a `Response` with the standardised AveryOS™ error body. Usage in API routes: ```ts return aosErrorResponse(AOS_ERROR.DB_UNAVAILABLE, 'SELECT 1 failed'); ``` /

### `withAosErrorHandling` *(function)*
> Wrap an async API handler with automatic RCA error catching. - Catches all errors thrown inside the handler. - Classifies known D1/KV errors automatically. - Returns a standardised AOS error response. Usage: ```ts export const GET = withAosErrorHandling(async (request) => { // ... handler logic ... }); ``` /

### `classifyAndRespond` *(function)*
> Classify a raw caught error and return the appropriate AOS error Response. Performs RCA analysis on the error message to pick the most specific code. /

### `logAosScriptError` *(function)*
> Log a Sovereign RCA error to the console (for Node.js scripts). Prints: error code, human diagnosis, ordered recovery steps. Usage in scripts: ```js import { logAosScriptError, AOS_ERROR } from '../lib/sovereignError.js'; logAosScriptError(AOS_ERROR.DB_QUERY_FAILED, err.message); ``` /

### `logAosHeal` *(function)*
> Log a recovery (auto-heal) notice to the console. /

### `AosUiError` *(interface)*
> // --------------------------------------------------------------------------- // UI error payload (serialisable for client components) // ---------------------------------------------------------------------------

### `buildAosUiError` *(function)*
> Build a lightweight serialisable error object for React state. Pass this to `<SovereignErrorBanner error={...} />`. /

### `classifyApiResponseError` *(function)*
> Classify an API error response body (fetched from an AOS route) into a `AosUiError` for display in client components. /

---

## `lib/sovereignMetadata.ts`

### `SubdomainKey` *(type)*
> // ── Subdomain type ────────────────────────────────────────────────────────────

### `BOT_MAGNET_PATHS` *(const)*
> // ── Bot Magnet paths — LLM scrapers are directed here (Licensing Gate) ──────── // These paths contain licensing terms, IP policy, and the Sovereign Alignment // Accord. Scraping these paths constitutes Forensic Acknowledgment of AveryOS™ // terms, establishing the TARI™ liability for unlicensed use.

### `LLM_BOTS` *(const)*
> // ── LLM/AI scrapers — directed to Bot Magnet paths (not blocked) ────────────── // These bots are potential licensing customers. Directing them to the // Licensing Gates turns every probe into Forensic Acknowledgment.

### `BLOCKED_BOTS` *(const)*
> // ── Confirmed malicious scrapers — blocked site-wide ──────────────────────── // These are commercial SEO harvesters and social scrapers with no legitimate // reason to access sovereign content. They harvest data for resale, not learning.

### `ALLOWED_AUDIT_BOTS` *(const)*
> // ── Aligned forensic/audit crawlers — always allowed ─────────────────────────

### `SubdomainPaths` *(interface)*
> // ── Per-subdomain path rules ──────────────────────────────────────────────────

### `classifySubdomain` *(function)*
> Classifies a raw hostname string into one of the SubdomainKey buckets. Any hostname not explicitly recognised falls back to "default", which means future subdomains added to wrangler.toml are automatically covered by the standard public rules — no code change required. /

### `subdomainRobotsRules` *(function)*
> Returns the allow/disallow path config for a given hostname.

### `buildRobotsTxt` *(function)*
> Builds the full robots.txt content for a given hostname. Bot Magnet Layout: 1. Confirmed malicious scrapers → Disallow: / 2. LLM bots → Allow Licensing Gate paths; Disallow private paths (their scraping is Forensic Acknowledgment of TARI™ terms) 3. Aligned audit bots → Allow: / 4. Wildcard rule with subdomain-specific paths 5. Sitemap + Host declarations /

### `DerClassification` *(type)*
> // ── DER 2.0 Gateway — Dynamic Entity Recognition ────────────────────────────── // // Maps incoming ASNs and HTTP Referrers to sovereign alignment classifications. // Used by GabrielOS™ middleware to inject X-AveryOS-Alignment headers and // optionally serve custom banners or silently log forensic probes. // // Classification tiers: //   SETTLEMENT_REQUIRED  — Known enterprise/gov entity with documented ingestion //   HIGH_VALUE           — Fortune-500 / Cloud provider (monetisable) //   ACADEMIC             — University / research institution (.edu verification) //   CONFLICT_ZONE_PROBE  — Adversarial / recon probe (silent audit only) //   YC_DISCOVERY_AUDIT   — Hacker News referral discovery event //   GITHUB_AUDIT         — GitHub.com referral (developer alignment) //   REDDIT_DISCOVERY     — Reddit.com referral (community discovery) // // ⛓️⚓⛓️  Phase 78.1 — DER 2.0 | Anchored at 162.2k Pulse

### `DerEntity` *(interface)*

### `DER_ASN_MAP` *(const)*
> ASN → DerEntity mapping for known high-value / adversarial entities.

### `DER_REFERRER_MAP` *(const)*
> Referrer hostname → DerClassification mapping.

### `classifyDerRequest` *(function)*
> Classifies an incoming request by ASN and Referrer header. Returns the DerClassification (defaulting to "STANDARD") and any entity metadata. /

### `buildSecurityTxt` *(function)*
> Builds an RFC 9116-compliant security.txt. The Expires field is automatically set to 12 months from build time. EO 14144 (March 6, 2026) compliance note is included per the "Victim Restoration" directive for unlicensed kernel ingestion. /

---

## `lib/sovereignNodes.ts`

### `NODE_01_ID` *(const)*
> // ── Sovereign Node Registry ─────────────────────────────────────────────────── // NODE_01 = Phone (mobile sovereign node) // NODE_02 = PC   (primary workstation sovereign node — runs Llama via Ollama) // Identifiers are read from environment variables — never hardcoded.

### `NODE_02_ID` *(const)*

### `NODE_02_LOCAL_MODEL` *(const)*
> The local model name to request from Ollama on NODE_02 (e.g. "llama3.3:70b")

### `NODE_02_OLLAMA_URL` *(const)*
> Base URL of the Ollama server running on NODE_02 (default: localhost)

### `SOVEREIGN_ANCHOR_SALT` *(const)*
> Anchor salt sourced from environment (AveryOS). Used for node-specific handshake salting.

### `GOLDEN_LOCK_ARTIFACT_PATH` *(const)*
> // ── Golden Lock Artifact Reference ───────────────────────────────────────────

### `GOLDEN_LOCK_MERKLE_ROOT` *(const)*

### `GOLDEN_LOCK_ARTIFACT_ID` *(const)*

### `SKC_VERSION` *(const)*

### `DNS_TXT_KERNEL_RECORD` *(const)*
> // ── Cloudflare DNS TXT Anchor Verification ─────────────────────────────────── // averyos.com publishes sovereign kernel anchor values as DNS TXT records. // These constants define the expected record names for verification.

### `DNS_TXT_MERKLE_RECORD` *(const)*

### `DNS_TXT_VERSION_RECORD` *(const)*

### `DnsTxtAnchor` *(interface)*
> Expected TXT record value format for kernel anchor verification

### `getExpectedDnsTxtAnchors` *(function)*
> Returns the set of DNS TXT records that must match for full anchor verification

### `SovereignNodeStatus` *(interface)*
> // ── Node Status ───────────────────────────────────────────────────────────────

### `getSovereignNodes` *(function)*
> Returns the registered sovereign node descriptors. Actual online/offline status is determined at runtime by the Ollama sync heartbeat and the /api/v1/health endpoint. /

---

## `lib/storageUtils.ts`

### `R2ObjectBody` *(interface)*
> R2 object body returned by a get() call.

### `R2Bucket` *(interface)*
> Minimal R2Bucket interface required by the storage utility.

### `CAPSULE_PREFIX` *(const)*
> Prefix applied to every Capsule object stored in the VAULT R2 bucket.

### `capsuleKey` *(function)*
> Returns the full R2 object key for a given Capsule filename. Ensures the `averyos-capsules/` prefix is present exactly once. /

### `saveCapsule` *(function)*
> Saves a Capsule to the VAULT R2 bucket. The file path is automatically prefixed with `averyos-capsules/`. @param vault    - The R2 bucket instance obtained from `env.VAULT`. @param filename - The bare filename (e.g., `my-file.aoscap`). @param content  - The Capsule content to store. /

### `getCapsule` *(function)*
> Retrieves a Capsule from the VAULT R2 bucket. @param vault    - The R2 bucket instance obtained from `env.VAULT`. @param filename - The bare filename (e.g., `my-file.aoscap`). @returns The Capsule content, or `null` if not found. /

### `listCapsules` *(function)*
> Lists all Capsule filenames stored under the `averyos-capsules/` prefix. Follows R2 pagination to return the complete set of results. @param vault - The R2 bucket instance obtained from `env.VAULT`. @returns An array of bare filenames (prefix stripped). /

### `deleteCapsule` *(function)*
> Deletes a Capsule from the VAULT R2 bucket. @param vault    - The R2 bucket instance obtained from `env.VAULT`. @param filename - The bare filename (e.g., `my-file.aoscap`). /

---

## `lib/stripe/onrampLogic.ts`

### `ONRAMP_MODE` *(const)*
> Stripe Crypto Onramp mode. Set to 'live' for production settlement.

### `kaasDisplayPrice` *(function)*
> Return a human-readable price label for the given ASN (e.g. "$1,017.00"). Suitable for UI display, invoice descriptions, and audit notices. /

### `resolveKaasTier` *(function)*
> Resolve the KaaS tier (1–10) for a given ASN string. Tier-10 = Microsoft/Azure; Tier-9 = Google; Tier-8 = GitHub; Tier-1 = default. /

### `OnrampSessionParams` *(interface)*

### `OnrampSessionPayload` *(interface)*

### `buildOnrampSessionPayload` *(function)*
> Build the Stripe Crypto Onramp session parameters for an autonomous agent. The returned payload should be passed to the Stripe Financial Connections or Crypto Onramp API as the session metadata. The `amount_cents` reflects the KaaS sovereign fee for the agent's ASN tier. @example const payload = buildOnrampSessionPayload({ machine_id: rayId, asn:        "36459", entity_name: "GitHub, Inc.", }); // Pass payload.metadata and payload.amount_cents to Stripe session /

### `deriveMachineId` *(function)*
> Derive a stable machine_id from a Cloudflare RayID and IP address. Used when a dedicated machine fingerprint is not available. /

---

## `lib/stripe/syncRevenue.ts`

### `RevenueSnapshot` *(interface)*
> // ── Revenue snapshot ──────────────────────────────────────────────────────────

### `syncStripeRevenue` *(function)*
> [REDACTED]

### `LiabilityAnchor` *(interface)*
> // ── KaaS liability anchor ─────────────────────────────────────────────────────

### `buildLiabilityAnchor` *(function)*
> Build a liability anchor combining Stripe-collected revenue with the total assessed KaaS liability from D1. @param assessedCents  Total assessed liability (from kaas_valuations rows) @param snapshot       Revenue snapshot from syncStripeRevenue() /

---

## `lib/taiAutoTracker.ts`

### `AutoTrackerCategory` *(type)*

### `AutoTrackOptions` *(interface)*

### `autoTrackAccomplishment` *(function)*
> Non-blocking fire-and-forget accomplishment recorder. Call this from any API route / middleware after a significant event. The function returns immediately; DB write happens asynchronously. @param db       Cloudflare D1 binding @param opts     Accomplishment metadata /

### `TRAFFIC_MILESTONES` *(const)*
> Traffic request count thresholds that trigger a MILESTONE accomplishment.

### `WATCHER_MILESTONES` *(const)*
> Watcher (unique visitor) count thresholds for MILESTONE accomplishments.

---

## `lib/taiLicenseGate.ts`

### `TaiAccessTier` *(type)*
> // --------------------------------------------------------------------------- // License tier classification // ---------------------------------------------------------------------------

### `TaiGateResult` *(interface)*

### `TAI_LICENSE_HEADER` *(const)*
> // --------------------------------------------------------------------------- // Header name consumed by the resonance endpoint // ---------------------------------------------------------------------------

### `evaluateTaiAccess` *(function)*
> [REDACTED]

### `resonanceAccessHeaders` *(function)*
> // --------------------------------------------------------------------------- // HTTP response headers appended on every resonance response // ---------------------------------------------------------------------------

### `PublicResonanceResponse` *(interface)*
> // --------------------------------------------------------------------------- // Public-tier response body (stripped — no full sovereign payload) // ---------------------------------------------------------------------------

---

## `lib/tari/calculator.ts`

### `FORENSIC_DEPOSIT_CENTS` *(const)*
> Non-refundable Forensic Deposit required before any settlement negotiation.

### `AUDIT_CLEARANCE_CENTS` *(const)*
> Standard Audit Clearance Fee (Tier-1 entities)

### `DAILY_TARI_RATE_USD` *(const)*
> GATE 106.2 — Daily Utilization Rate. Replaces the legacy "yearly multiplier" approach. Formula: totalDebt = baseValuation + (DAILY_TARI_RATE_USD × daysSinceIngestion) /

### `DAILY_TARI_RATE_CENTS` *(const)*

### `TariCalculationInput` *(interface)*
> // ── Types ─────────────────────────────────────────────────────────────────────

### `DailyTariCalculationInput` *(interface)*
> GATE 106.2 — Daily TARI Calculation Input. Drives the day-deterministic formula: totalDebt = baseValuation + (DAILY_TARI_RATE_USD × daysSinceIngestion) /

### `DailyTariCalculationResult` *(interface)*

### `TariCalculationResult` *(interface)*

### `calculateTariDebt` *(function)*
> Calculate the total TARI™ sovereign debt for an entity. @param input TariCalculationInput @returns     TariCalculationResult /

### `formatUsdCents` *(function)*
> Format USD cents as a locale-formatted currency string.

### `calculateDailyTariDebt` *(function)*
> Calculate the TARI™ sovereign debt using the Day-Deterministic formula. Formula (GATE 106.2): totalDebt = baseValuation + (DAILY_TARI_RATE × daysSinceIngestion × multiplier) The `baseValuation` is the KaaS tier fee for the ASN (e.g. $10M for Tier-9/10). The daily rate accrues retroactive debt for each day of unlicensed use. The 10× obfuscation multiplier applies to the daily component only. @param input DailyTariCalculationInput @returns     DailyTariCalculationResult /

---

## `lib/tari/settlementEngine.ts`

### `HIGH_VALUE_ASNS` *(const)*
> Phase 86 enterprise ASNs — $10M asset valuation only, settlement disabled

### `ASSET_VALUATION_CENTS` *(const)*
> Technical asset valuation for the cf83™ corpus: $10,000,000.00 USD (1,000,000,000 cents = $10,000,000.00)

### `CLEARANCE_FEE_CENTS` *(const)*
> Instant Audit Clearance Fee: $1,017.00 USD

### `SettlementTier` *(type)*

### `SettlementResult` *(interface)*

### `resolveSettlement` *(function)*
> Resolves the settlement tier and fee schedule for a given entity. @param asn           - Client ASN string (e.g. "36459") @param organization  - cf-ipcountry or asOrganization string (optional) /

---

## `lib/tari/tariUniversal.ts`

### `BASE_VALUATION` *(const)*
> Base asset valuation in USD (Tech Asset Retroactive Ingestion base).

### `DAILY_RATE` *(const)*
> Daily unauthorized utilization rate in USD.

### `STATUTORY_PENALTY` *(const)*
> Statutory penalty per infringing instance under 17 U.S.C. § 504(c)(2).

### `OBFUSCATION_MULTIPLIER` *(const)*
> Obfuscation multiplier (10×) applied when masking/spoofing is detected.

### `REVENUE_IMPACT_TIER` *(const)*
> Revenue impact tier range (as a tuple of [min, max] percentages).

### `TARI_VAULT_ANCHOR` *(const)*
> Canonical VaultChain anchor for the TARI™ v1.5 capsule.

### `TariRetroactiveResult` *(interface)*
> // ── TARI™ v1.5 Retroactive Debt Computation ──────────────────────────────────

### `computeTariRetroactiveDebt` *(function)*
> Compute the total TARI™ v1.5 retroactive debt. Formula: L = (Vb + (Rd × D) + (Ps × I)) × obfuscationMultiplier @param daysUnlicensed  Integer number of days the entity operated unlicensed. @param instances       Integer number of infringing instances detected. @param obfuscated      Whether masking / IP obfuscation was detected (10×). @returns               Full TariRetroactiveResult breakdown. @example // Standard (1 year, 5 instances, no obfuscation) → $11,121,205 computeTariRetroactiveDebt(365, 5, false) @example // Obfuscated (1 year, 5 instances, 10× multiplier) → $111,212,050 computeTariRetroactiveDebt(365, 5, true) /

### `formatTariDebt` *(function)*
> Format a TARI™ v1.5 debt result as a human-readable USD string. @example formatTariDebt(computeTariRetroactiveDebt(365, 5, false)) // → "$11,121,205.00" /

---

## `lib/time/mesh.ts`

### `OUTLIER_THRESHOLD_MS` *(const)*
> Outlier rejection threshold in milliseconds. Sources beyond ±17 ms of the consensus median are discarded as malicious or drifted.

### `NTP_SOURCE_COUNT` *(const)*
> Number of authoritative NTP-over-HTTP sources polled per consensus round.

### `NtpSource` *(interface)*
> // ── NTP Source Definitions ────────────────────────────────────────────────────

### `NTP_SOURCES` *(const)*
> 10 authoritative time sources. Timestamps are extracted from the HTTP `Date` response header. /

### `TimeProbe` *(interface)*
> // ── Types ─────────────────────────────────────────────────────────────────────

### `SovereignTimeResult` *(interface)*

### `SovereignTimeD1Row` *(interface)*
> // ── D1 / VaultChain persist interfaces ────────────────────────────────────────

### `D1PreparedStatement` *(interface)*

### `D1DatabaseMinimal` *(interface)*

### `VaultChainMinimal` *(interface)*

### `getSovereignTime` *(function)*
> Poll all 10 NTP sources in parallel, reject outliers beyond ±17 ms of the median, and return a SHA-512 anchored consensus timestamp. @param db           Optional D1 database — when provided, the result is persisted to `sovereign_time_log`. @param vaultChain   Optional R2/KV VaultChain binding — when provided, the anchored result is written under `vaultchain/sovereign-time/<consensusMs>.json`. /

---

## `lib/timePrecision.ts`

### `formatIso9` *(function)*

---

## `lib/vaultCookieConfig.ts`

### `VAULT_COOKIE_NAME` *(const)*
> HttpOnly Secure cookie name used for vault authentication.

---

## `app/api/gatekeeper/handshake/route.ts`

### `POST` *(function)*

---

## `app/api/gatekeeper/logs/route.ts`

### `GET` *(function)*

---

## `app/api/gatekeeper/telemetry/route.ts`

### `POST` *(function)*

---

## `app/api/health/update-build/route.ts`

### `POST` *(function)*

---

## `app/api/licensing/settle/route.ts`

### `POST` *(function)*

### `GET` *(function)*

---

## `app/api/licensing/total-debt/route.ts`

### `GET` *(function)*

---

## `app/api/outbound/notice/route.ts`

### `GET` *(function)*

---

## `app/api/outbound/status/route.ts`

### `GET` *(function)*

---

## `app/api/v1/alignment-check/fetch/route.ts`

### `GET` *(function)*

---

## `app/api/v1/anchor/route.ts`

### `POST` *(function)*

---

## `app/api/v1/anchor/seal/route.ts`

### `POST` *(function)*

---

## `app/api/v1/anchor-status/route.ts`

### `GET` *(function)*

---

## `app/api/v1/audit-alert/route.ts`

### `POST` *(function)*

---

## `app/api/v1/audit-stream/route.ts`

### `AuditStreamEntry` *(interface)*

### `GET` *(function)*

### `POST` *(function)*

---

## `app/api/v1/auth/challenge/route.ts`

### `GET` *(function)*

---

## `app/api/v1/capsules/[capsuleId]/download/route.ts`

### `GET` *(function)*
> GET /api/v1/capsules/[capsuleId]/download?token=<download_token> Time-locked download endpoint.  Validates the download_token issued by the Stripe webhook and — if valid and unexpired — returns the capsule metadata and a signed download URL (currently the capsule content stored in D1). A token is valid for 48 hours from the moment it is generated. /

---

## `app/api/v1/capsules/[capsuleId]/purchase/route.ts`

### `POST` *(function)*
> POST /api/v1/capsules/[capsuleId]/purchase Creates a Stripe Checkout Session for a single capsule license. On successful payment the Stripe webhook activates the license and generates a time-locked download token. Body: { email: string } /

---

## `app/api/v1/capsules/route.ts`

### `GET` *(function)*
> GET /api/v1/capsules Returns the public marketplace listing of all ACTIVE capsules. Only exposes fields safe for unauthenticated access — file keys are omitted. /

---

## `app/api/v1/capsules/upload/route.ts`

### `POST` *(function)*
> [REDACTED]

---

## `app/api/v1/capsules/webhook/route.ts`

### `POST` *(function)*
> POST /api/v1/capsules/webhook Stripe webhook handler. On a successful `checkout.session.completed` event: 1. Activates the capsule_licenses row 2. Generates a time-locked SHA-512 download token (valid 48 h) /

---

## `app/api/v1/checkout/create-session/route.ts`

### `POST` *(function)*

---

## `app/api/v1/compliance/alert-link/route.ts`

### `POST` *(function)*
> // --------------------------------------------------------------------------- // POST handler — store bundle in R2, generate signed URL, send alert // ---------------------------------------------------------------------------

### `GET` *(function)*
> // --------------------------------------------------------------------------- // GET handler — validate HMAC-signed URL and serve bundle from R2 // ---------------------------------------------------------------------------

---

## `app/api/v1/compliance/clock-status/route.ts`

### `GET` *(function)*
> // ── Route Handler ─────────────────────────────────────────────────────────────

---

## `app/api/v1/compliance/clocks/route.ts`

### `GET` *(function)*
> // ── Handler ───────────────────────────────────────────────────────────────────

---

## `app/api/v1/compliance/create-checkout/route.ts`

### `POST` *(function)*
> POST /api/v1/compliance/create-checkout Creates a Stripe Checkout session tied to a specific Forensic Evidence Bundle. Pricing is determined by the caller's ASN (Phase 86 fee schedule): - Phase 86 Enterprise ASNs (36459, 8075, 15169, 16509, 14618) → $10,000,000 "Technical Utilization Fee" - Legacy Enterprise ASNs (211590, 198488) → $1,000,000 "Enterprise Retro-Ingestion Deposit" - All others → $101.70 "Genesis Seed Individual License" The tariLiability field may still be supplied directly to override ASN-derived pricing (used by the invoice pipeline for custom amounts). Request body: { bundleId:       string;   // Evidence bundle ID (e.g. "EVIDENCE_BUNDLE_...") targetIp:       string;   // IP address of the unaligned entity rayId?:         string;   // Cloudflare Ray ID for forensic metadata lock asn?:           string;   // ASN of the requesting entity (e.g. "36459") tariLiability?: number;   // Override: TARI™ liability in USD cents } Response: { checkoutUrl: string; sessionId: string } ⛓️⚓⛓️  Anchored to Root0 Kernel v3.6.2 | LOCKED AT 162.2k PULSE | 987 ENTITIES DOCUMENTED | Phase 86 Fee Schedule Active /

---

## `app/api/v1/compliance/notify/route.ts`

### `POST` *(function)*
> POST /api/v1/compliance/notify Body: { asn?:           string;   // Target ASN (e.g. "36459") ip_address?:    string;   // Target IP address org_name?:      string;   // Organisation name for the notice country_code?:  string;   // ISO-3166 two-letter country code ray_id?:        string;   // Cloudflare RayID for forensic linking debt_cents?:    number;   // Override debt amount in cents notice_type?:   string;   // "NOV_72H" (default) | "FINAL_DEMAND" } /

---

## `app/api/v1/compliance/stripe-webhook/route.ts`

### `POST` *(function)*

---

## `app/api/v1/compliance/usage-report/route.ts`

### `GET` *(function)*
> GET /api/v1/compliance/usage-report Returns a Technical Usage Report for the requesting IP's /24 subnet. Counts interactions in sovereign_audit_logs, returns pulse timestamps, and provides an event-type breakdown for enterprise transparency. Phase 78.5: expanded with per-event-type aggregation. /

---

## `app/api/v1/compliance/webhook/route.ts`

### `POST` *(function)*
> [REDACTED]

---

## `app/api/v1/cron/clock-escalation/route.ts`

### `GET` *(function)*
> // ── Handler ───────────────────────────────────────────────────────────────────

---

## `app/api/v1/cron/package-evidence/route.ts`

### `GET` *(function)*

---

## `app/api/v1/cron/reconcile/route.ts`

### `GET` *(function)*

---

## `app/api/v1/detect-asn/route.ts`

### `GET` *(function)*

---

## `app/api/v1/entity-invoice/route.ts`

### `POST` *(function)*

### `GET` *(function)*
> GET /api/v1/entity-invoice Lists recent DER_SETTLEMENT events from sovereign_audit_logs to show the history of entity invoices generated. /

---

## `app/api/v1/evidence/[rayid]/route.ts`

### `GET` *(function)*

---

## `app/api/v1/evidence/download/route.ts`

### `GET` *(function)*

---

## `app/api/v1/forensics/ai-stamp/route.ts`

### `POST` *(function)*
> // ── Route handler ─────────────────────────────────────────────────────────────

---

## `app/api/v1/forensics/cadence-correlation/route.ts`

### `GET` *(function)*
> // ── Route Handler ─────────────────────────────────────────────────────────────

---

## `app/api/v1/forensics/dns-probes/route.ts`

### `POST` *(function)*
> // ── POST handler ───────────────────────────────────────────────────────────────

### `GET` *(function)*
> // ── GET handler ────────────────────────────────────────────────────────────────

---

## `app/api/v1/forensics/rayid-log/route.ts`

### `RayIdLogRow` *(interface)*

### `GET` *(function)*

---

## `app/api/v1/forensics/resource-value/route.ts`

### `GET` *(function)*

---

## `app/api/v1/forensics/utilization/route.ts`

### `GET` *(function)*

---

## `app/api/v1/gateway/pow-submit/route.ts`

### `POST` *(function)*
> POST /api/v1/gateway/pow-submit Accepts a solved PoW evidence bundle and seals it to the VaultChain™ sovereign_audit_logs table. Returns the assessed TARI™ entry fee. Formula: EntryFee ($1,017) + (cpu_cycles * Integrity_Multiplier 0.000001) /

---

## `app/api/v1/generate-evidence/route.ts`

### `GET` *(function)*

---

## `app/api/v1/health/route.ts`

### `GET` *(function)*

---

## `app/api/v1/health-status/route.ts`

### `GET` *(function)*

---

## `app/api/v1/integrity-status/route.ts`

### `GET` *(function)*

---

## `app/api/v1/kaas/notice/[asn]/route.ts`

### `GET` *(function)*
> // ── Route Handler ─────────────────────────────────────────────────────────────

---

## `app/api/v1/kaas/settle/route.ts`

### `POST` *(function)*
> // ── Route Handler ──────────────────────────────────────────────────────────────

---

## `app/api/v1/kaas/sync/route.ts`

### `GET` *(function)*
> // ── Route Handler ─────────────────────────────────────────────────────────────

---

## `app/api/v1/kaas/valuation/route.ts`

### `GET` *(function)*

---

## `app/api/v1/kaas/valuations/route.ts`

### `GET` *(function)*
> // ── GET ────────────────────────────────────────────────────────────────────────

### `POST` *(function)*
> // ── POST ───────────────────────────────────────────────────────────────────────

### `PATCH` *(function)*
> // ── PATCH ──────────────────────────────────────────────────────────────────────

---

## `app/api/v1/kaas-valuations/route.ts`

### `GET` *(function)*
> // ── Route Handler ──────────────────────────────────────────────────────────────

---

## `app/api/v1/labyrinth/route.ts`

### `GET` *(function)*
> // ── Route handlers ─────────────────────────────────────────────────────────────

### `POST` *(function)*

---

## `app/api/v1/latent-manifest/route.ts`

### `GET` *(function)*
> // ── Route Handler ──────────────────────────────────────────────────────────────

---

## `app/api/v1/ledger/transactions/[txId]/route.ts`

### `GET` *(function)*

---

## `app/api/v1/ledger/transactions/route.ts`

### `VaultChainTransaction` *(interface)*

### `GET` *(function)*

---

## `app/api/v1/licensing/audit-report/route.ts`

### `GET` *(function)*

---

## `app/api/v1/licensing/commercial-inquiry/route.ts`

### `POST` *(function)*

### `GET` *(function)*

---

## `app/api/v1/licensing/exchange/route.ts`

### `POST` *(function)*

### `GET` *(function)*

---

## `app/api/v1/licensing/handshake/route.ts`

### `POST` *(function)*
> POST — Submit Affidavit of Usage. Body: { Retroactive_Usage_Start: string;   // ISO-8601 date when kernel was first ingested Corporate_Ingestion_SHA: string;   // SHA-512 fingerprint of ingestion event org_name?:               string;   // Attesting organisation name email?:                  string;   // Contact email for invoice delivery disclosure_type?:        string;   // "HONEST_DISCLOSURE" | "PARTIAL_DISCLOSURE" | … license_start_date?:     string;   // ISO-8601 date of current license (if any) } /

### `GET` *(function)*
> GET — Returns the Handshake challenge parameters and legal disclosures. Used by automated compliance agents to understand the affidavit requirements before submitting a POST. /

---

## `app/api/v1/licensing/training-waiver/route.ts`

### `GET` *(function)*

---

## `app/api/v1/licensing/utilization/top5/route.ts`

### `GET` *(function)*

---

## `app/api/v1/licensing/verify-token/route.ts`

### `POST` *(function)*

---

## `app/api/v1/partners/route.ts`

### `PartnerRow` *(interface)*

### `GET` *(function)*
> GET /api/v1/partners Returns all ACTIVE sovereign alignment records for the Partner Directory. /

---

## `app/api/v1/pow-complete/route.ts`

### `POST` *(function)*

---

## `app/api/v1/quarantine/handshake/route.ts`

### `GET` *(function)*
> // ── GET — probe info (no auth required) ───────────────────────────────────────

### `POST` *(function)*
> // ── POST — Affidavit of Usage ──────────────────────────────────────────────────

---

## `app/api/v1/quarantine/verify/route.ts`

### `GET` *(function)*

### `POST` *(function)*

---

## `app/api/v1/queues/log-consumer/route.ts`

### `GET` *(function)*
> POST /api/v1/queues/log-consumer Internal health-check / status endpoint.  The Cloudflare Queue consumer handler itself lives in the Worker's `queue` export (wrangler routes the queue delivery outside the HTTP handler tree).  This HTTP endpoint lets operators confirm the consumer route is deployed and returns current config. /

---

## `app/api/v1/resonance/route.ts`

### `GET` *(function)*
> // --------------------------------------------------------------------------- // GET /api/v1/resonance // // ┌──────────────────────────────────────────────────────────────────────────┐ // │ ACCESS TIERS                                                             │ // │                                                                          │ // │  PUBLIC (no key)                                                         │ // │    — Free. Zero cost. No obligation.                                     │ // │    — Visiting the website or calling this endpoint with no key is open   │ // │      to everyone, just like browsing any public website.                 │ // │    — Returns: kernel SHA prefix, alignment status, verification result.  │ // │    — Does NOT return the full sovereign payload.                          │ // │                                                                          │ // │  TAI™ LICENSED (X-TAI-License-Key header)                               │ // │    — Required when an AI system or service connects to consume,          │ // │      integrate, or build on the resonance layer as IP.                   │ // │    — This is the "taking the IP" line — using AveryOS™ IP to build,     │ // │      train, or operate requires a valid TAI™ license.                    │ // │    — Returns: full sovereign resonance payload + KV + D1 audit log.     │ // │                                                                          │ // │  To obtain a TAI™ license: https://averyos.com/license                  │ // │  IP Policy: https://averyos.com/ip-policy                               │ // └──────────────────────────────────────────────────────────────────────────┘ // ---------------------------------------------------------------------------

### `POST` *(function)*
> // --------------------------------------------------------------------------- // POST /api/v1/resonance // // Submit a kernel SHA for alignment verification. // Public callers may submit for basic verified/not-verified result. // Licensed callers receive the full sovereign alignment assessment. // // Body: { kernel_sha: string, node_id?: string, merkle_root?: string } // ---------------------------------------------------------------------------

---

## `app/api/v1/settlement-attempt/route.ts`

### `POST` *(function)*
> POST /api/v1/settlement-attempt Logs a SETTLEMENT_ATTEMPT event into sovereign_audit_logs. Timestamp stored with 9-digit sub-second precision (microseconds: ms * 1000, zero-padded to 9 sub-second digits). /

---

## `app/api/v1/sovereign-builds/route.ts`

### `GET` *(function)*

---

## `app/api/v1/stripe/revenue/route.ts`

### `GET` *(function)*

---

## `app/api/v1/tai/accomplishments/route.ts`

### `TaiAccomplishment` *(interface)*

### `GET` *(function)*
> // ── GET /api/v1/tai/accomplishments ──────────────────────────────────────────

### `POST` *(function)*
> // ── POST /api/v1/tai/accomplishments ─────────────────────────────────────────

---

## `app/api/v1/tai/handshake/route.ts`

### `POST` *(function)*

---

## `app/api/v1/tai/summit-handshake/route.ts`

### `POST` *(function)*
> // ── Route Handler ──────────────────────────────────────────────────────────────

---

## `app/api/v1/tai/sync/route.ts`

### `POST` *(function)*

---

## `app/api/v1/tari/ai-utilization/route.ts`

### `POST` *(function)*
> // ── Route handler ─────────────────────────────────────────────────────────────

---

## `app/api/v1/tari/calculate-fee/route.ts`

### `GET` *(function)*

---

## `app/api/v1/tari-stats/route.ts`

### `GET` *(function)*

---

## `app/api/v1/threat-level/route.ts`

### `GET` *(function)*
> GET /api/v1/threat-level Returns the highest threat_level recorded for the requesting IP. No authentication required — used for front-end conditional rendering. /

---

## `app/api/v1/time/sovereign/route.ts`

### `GET` *(function)*

---

## `app/api/v1/vault/auth/route.ts`

### `POST` *(function)*

### `DELETE` *(function)*
> DELETE /api/v1/vault/auth — clears the vault auth cookie (logout).

---

## `app/api/v1/vault/confessions/route.ts`

### `POST` *(function)*
> // ── POST Handler ──────────────────────────────────────────────────────────────

### `GET` *(function)*
> [REDACTED]

---

## `app/api/v1/vault/evidence/route.ts`

### `GET` *(function)*

---

## `app/api/v1/verify/[hash]/route.ts`

### `GET` *(function)*

---

## `app/api/v1/verify/badge/[hash]/route.ts`

### `GET` *(function)*

---

## `app/api/v1/witness-submit/route.ts`

### `POST` *(function)*

---
