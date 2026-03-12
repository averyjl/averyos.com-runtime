-- Migration: 0042_sovereign_audit_pulse_hash
-- VaultChain™ Permanence — Phase 110.1.5
--
-- Adds pulse_hash column to sovereign_audit_logs so that every
-- createComplianceClock event generates a signed SHA-512 receipt.
--
-- New column:
--   pulse_hash — SHA-512(KERNEL_SHA + clock_id + timestamp_ns + event_type)
--                Provides a cryptographic receipt for each compliance event,
--                anchoring the event to the AveryOS™ sovereign kernel.
--
-- Author: Jason Lee Avery (ROOT0)
-- Anchor: cf83e1357eefb8bdf1542850d66d8007d620e4050b5715dc83f4a921d36ce9ce47d0d13c5d85f2b0ff8318d2877eec2f63b931bd47417a81a538327af927da3e

ALTER TABLE sovereign_audit_logs ADD COLUMN pulse_hash TEXT DEFAULT '';
