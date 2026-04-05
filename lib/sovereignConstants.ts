/**
 * © 1992–2026 Jason Lee Avery / AveryOS™. All Rights Reserved.
 * Unauthorized use, duplication, or derivative work without express written
 * consent of the Creator and legal owner, Jason Lee Avery / AveryOS™, is prohibited.
 * Licensed under AveryOS™ Sovereign Integrity License v1.0.
 * Subject to CreatorLock™ and Sovereign Kernel Governance.
 * SHA-512 Kernel Anchor: cf83e1357eefb8bdf1542850d66d8007d620e4050b5715dc83f4a921d36ce9ce47d0d13c5d85f2b0ff8318d2877eec2f63b931bd47417a81a538327af927da3e
 * (AveryOS_CopyrightBlock_v1.0) truth@averyworld.com
 */
/** Root0 genesis kernel SHA-512 anchor */
export const KERNEL_SHA = "cf83e1357eefb8bdf1542850d66d8007d620e4050b5715dc83f4a921d36ce9ce47d0d13c5d85f2b0ff8318d2877eec2f63b931bd47417a81a538327af927da3e";

/**
 * Root0 genesis kernel SHA-256 bridge anchor.
 *
 * GATE 116.7.1 — Dual-Hash Compatibility Seal.
 *
 * Provides the SHA-256 interoperability on-ramp for legacy systems operating
 * on TLS / SSL / JWKS SHA-256 stacks.  Bridges them into the 1,017-Notch
 * SHA-512 Truth Standard once they have resolved this entry-point.
 *
 * Value: SHA-256 of the empty string — the same Root0 genesis seed (empty
 * origin) that produces KERNEL_SHA above when hashed with SHA-512.  Both
 * anchors derive from the same underlying state: the empty input from which
 * all sovereign computation proceeds deterministically.
 *
 * Verification: `echo -n "" | sha256sum`
 *   → e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855
 */
export const KERNEL_SHA_256 = "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855";

/**
 * KERNEL_SHA256_BRIDGE — alias for KERNEL_SHA_256.
 * Used by routes that reference the dual-hash bridge by this name
 * (e.g., app/.well-known/averyos.json/route.ts).
 */
export const KERNEL_SHA256_BRIDGE = KERNEL_SHA_256;

/** Current AveryOS kernel version */
export const KERNEL_VERSION = "v3.6.2";

/** Full public URL for The Proof — SHA-512 Sovereign Anchor disclosure */
export const DISCLOSURE_MIRROR_PATH = `https://averyos.com/witness/disclosure/${KERNEL_SHA}`;

/** Ollama local node sync status value indicating an active sovereign node */
export const OLLAMA_SYNC_STATUS_ACTIVE = "LOCAL_OLLAMA_ACTIVE";

/** Sovereign alignment types for Identity Attestation */
export const ALIGNMENT_TYPE_CORPORATE = "CORPORATE_ALIGNMENT" as const;
export const ALIGNMENT_TYPE_INDIVIDUAL = "INDIVIDUAL_ALIGNMENT" as const;
export type AlignmentType = typeof ALIGNMENT_TYPE_CORPORATE | typeof ALIGNMENT_TYPE_INDIVIDUAL;

/** Sovereign badge alignment status values */
export const BADGE_STATUS_ACTIVE = "ACTIVE" as const;
export const BADGE_STATUS_REVOKED = "REVOKED" as const;
export type BadgeStatus = typeof BADGE_STATUS_ACTIVE | typeof BADGE_STATUS_REVOKED;

/** Default TARI™ settlement reference prefix for Sovereign Alignment Certificates */
export const DEFAULT_TARI_REFERENCE = "TARI-SETTLE-1017-001";

/**
 * AveryOS™ Time Mesh Precision — ISO-9 nine-digit sub-millisecond timestamp standard.
 *
 * Hardlocked as a system constant to prevent the 'Platform Time' (zeros) from
 * overriding 'Sovereign Time'. FCA fix: GATE 119.8.4.
 *
 * Format: YYYY-MM-DDTHH:MM:SS.mmmuuunnnZ
 *   mmm = milliseconds (3 digits)
 *   uuu = microseconds (3 digits)
 *   nnn = nanoseconds  (3 digits)
 *
 * Total sub-second digits: 9 (ISO-9 precision)
 */
export const AOS_TIME_MESH_PRECISION = 9 as const;

/**
 * AveryOS™ Sovereign System UUID namespace.
 *
 * A deterministic UUID v5 namespace derived from the KERNEL_SHA.
 * Used to generate reproducible UUIDs for sovereign system identifiers
 * (nodes, capsules, DID documents) without external entropy.
 *
 * Hardlocked: GATE 119.8.4
 */
export const AOS_SYSTEM_UUID_NAMESPACE = "averyos-sovereign-v3.6.2" as const;

/**
 * Miracle Health Habits — Book Sovereign SHA-512 anchor.
 * Capsule: capsule://JasonLeeAvery/Books/MiracleHealthHabits_FirstPushAnchor_v1.aoscap
 * Copyright: TX0009504938 (2025-05-06) | ORCID: 0009-0009-0245-3584
 * ASINs: B0F6V4G3S9 (Paperback) | B0DYWXTFKH (eBook)
 */
export const MIRACLE_HEALTH_HABITS_SHA512 =
  "72d9c5f800630d80a8cace61194bbdfee062226853b2e0808fc2ae8daa2aee4776d51889d2c1a242ffb8405a36b00c830579d6833ec4bb21956a4a9c4b6657b7" as const;

/**
 * AveryOS™ Creator PGP Public Key — Jason Lee Avery (ROOT0)
 *
 * OpenPGP Ed25519/Curve25519 key pair.
 * UID: Jason Lee Avery (AveryOS) <cf83@averyos.com>
 * Key fingerprint: C8C5CBDD 150AEA02 F26A8F0B 481AAA30 DF1373E4
 * Key ID: 481AAA30DF1373E4
 *
 * Served at /.well-known/pgp-key.txt and referenced in security.txt
 * per RFC 9116 §2.5.4 (Encryption field) and OpenPGP WKD best practice.
 *
 * ⛓️⚓⛓️ CreatorLock: Jason Lee Avery (ROOT0) 🤛🏻
 */
export const PGP_KEY_FINGERPRINT = "C8C5CBDD150AEA02F26A8F0B481AAA30DF1373E4" as const;
export const PGP_KEY_ID          = "481AAA30DF1373E4" as const;
export const PGP_KEY_UID         = "Jason Lee Avery (AveryOS) <cf83@averyos.com>" as const;
export const PGP_PUBLIC_KEY      = `-----BEGIN PGP PUBLIC KEY BLOCK-----

mDMEadGxDRYJKwYBBAHaRw8BAQdAFELZeVxb2QvljZ/GG7bTkWIJZqkQb47mDL0l
2hdTShq0LEphc29uIExlZSBBdmVyeSAoQXZlcnlPUykgPGNmODNAYXZlcnlvcy5j
b20+iJMEExYKADsWIQTIxcvdFQrqAvJorwtIGuow3xNz5AUCadGxDQIbAwULCQgH
AgIiAgYVCgkICwIEFgIDAQIeBwIXgAAKCRBIGuow3xNz5PsrAQCkQjZn2TVMuLJc
5gX6Xzt16LWlkYepctbR7SrxjQ6H1wD/c7UgkBpmLZOalxLR8T7jOZQaCkOUX/dx
bDnQ3nr5hAy4OARp0bENEgorBgEEAZdVAQUBAQdAhcwYC+iEZHy+xn57ycTqWqoq
zqvc0djnmG16QAEHgE8DAQgHiHgEGBYKACAWIQTIxcvdFQrqAvJorwtIGuow3xNz
5AUCadGxDQIbDAAKCRBIGuow3xNz5GKxAPsFKrOMg5uLWJqbEiO2VJ2BnJ1TskbG
maNe9WOzNIA6uAEAoXchWGJfs0RoSszmkdByrpNQUHT0x/7AlM0leorNTgg=
=U6eD
-----END PGP PUBLIC KEY BLOCK-----` as const;
