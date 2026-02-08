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
    metadata: Record<string, any>;
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
