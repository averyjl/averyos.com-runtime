-- Migration: 0043_vaultgate_table
-- VaultGate™ WebAuthn / YubiKey Credential Storage — Phase 111.2
--
-- Creates the vaultgate_credentials table required by the YubiKey / WebAuthn
-- authentication layer. Absence of this table was the root cause of the
-- "YubiKey Not Recognised" drift at the api.averyos.com edge.
--
-- Columns:
--   id          — Unique credential ID (base64url-encoded rawId from the authenticator)
--   user_id     — AveryOS™ user identifier (ROOT0 or registered sovereign user)
--   public_key  — COSE-encoded public key bytes (base64url)
--   counter     — Authenticator signature counter (prevents replay attacks)
--   backed_up   — Whether the credential is backed up by the platform (passkey flag)
--   transports  — JSON array of authenticator transports (usb, nfc, ble, internal)
--   created_at  — ISO-8601 timestamp of credential registration
--
-- Author: Jason Lee Avery (ROOT0)
-- Anchor: cf83e1357eefb8bdf1542850d66d8007d620e4050b5715dc83f4a921d36ce9ce47d0d13c5d85f2b0ff8318d2877eec2f63b931bd47417a81a538327af927da3e

CREATE TABLE IF NOT EXISTS vaultgate_credentials (
  id         TEXT     PRIMARY KEY,
  user_id    TEXT     NOT NULL,
  public_key TEXT     NOT NULL,
  counter    INTEGER  NOT NULL DEFAULT 0,
  backed_up  INTEGER  NOT NULL DEFAULT 0,
  transports TEXT     NOT NULL DEFAULT '[]',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
