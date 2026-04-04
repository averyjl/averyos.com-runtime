/**
 * © 1992–2026 Jason Lee Avery / AveryOS™. All Rights Reserved.
 * Unauthorized use, duplication, or derivative work without express written
 * consent of the Creator and legal owner, Jason Lee Avery / AveryOS™, is prohibited.
 * Licensed under AveryOS™ Sovereign Integrity License v1.0.
 * Subject to CreatorLock™ and Sovereign Kernel Governance.
 * SHA-512 Kernel Anchor: cf83e1357eefb8bdf1542850d66d8007d620e4050b5715dc83f4a921d36ce9ce47d0d13c5d85f2b0ff8318d2877eec2f63b931bd47417a81a538327af927da3e
 * (AveryOS_CopyrightBlock_v1.0) truth@averyworld.com
 */
/**
 * Type definitions for license enforcement tracking system
 * Provides transparent, SHA-verified logging of license compliance events
 */

export interface EnforcementEvent {
  /** Unique event identifier */
  id: string;
  
  /** ISO 8601 timestamp */
  timestamp: string;
  
  /** Capsule identifier being tracked */
  capsuleId: string;
  
  /** SHA-512 hash of the capsule content */
  capsuleSha512: string;
  
  /** Type of enforcement event */
  eventType: "detection" | "notice" | "compliance" | "resolved";
  
  /** Current status */
  status: "pending" | "notified" | "licensed" | "monitoring";
  
  /** Optional Stripe product/price ID for licensing */
  stripeProductId?: string;
  
  /** Public reference ID */
  referenceId: string;
  
  /** Optional description */
  description?: string;
}

export interface EvidenceBundle {
  /** Bundle identifier */
  bundleId: string;
  
  /** ISO 8601 timestamp */
  timestamp: string;
  
  /** Creator identifier */
  creator: string;
  
  /** Capsule being tracked */
  capsuleId: string;
  
  /** SHA-512 hash of capsule */
  capsuleSha512: string;
  
  /** SHA-512 hash of this evidence bundle */
  bundleSha512: string;
  
  /** Evidence type */
  evidenceType: "usage_detection" | "license_check" | "compliance_verification";
  
  /** Evidence details */
  evidence: {
    detectedAt: string;
    sourceUrl?: string;
    checksumMatch: boolean;
    metadata: Record<string, unknown>;
  };
  
  /** Link to voluntary licensing option */
  licenseOfferUrl?: string;
  
  /** Public verification status */
  publiclyVerifiable: boolean;
}

export interface ComplianceNotice {
  /** Notice identifier */
  noticeId: string;
  
  /** ISO 8601 timestamp */
  timestamp: string;
  
  /** Capsule identifier */
  capsuleId: string;
  
  /** Notice type */
  noticeType: "voluntary_compliance_offer" | "license_available" | "resolved";
  
  /** Public message */
  message: string;
  
  /** Link to license purchase */
  licenseUrl?: string;
  
  /** SHA verification */
  sha512: string;
  
  /** Status */
  status: "active" | "resolved" | "expired";
}
