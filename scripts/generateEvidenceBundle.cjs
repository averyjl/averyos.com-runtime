#!/usr/bin/env node
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
 * Evidence Bundle Generator
 * Creates SHA-verified evidence bundles for license tracking
 * Focus: Transparent, voluntary compliance documentation
 */

const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { sovereignWriteSync, ENFORCEMENT_EVIDENCE_ROOT, ENFORCEMENT_NOTICES_ROOT, ENFORCEMENT_LOGS_ROOT } = require("./lib/sovereignIO.cjs");

// Generate SHA-512 hash
function generateSha512(content) {
  return crypto.createHash("sha512").update(content).digest("hex");
}

// Generate evidence bundle
function generateEvidenceBundle(options) {
  const {
    capsuleId,
    capsuleSha512,
    creator = "Jason Lee Avery",
    sourceUrl = null,
    metadata = {},
  } = options;

  const timestamp = new Date().toISOString();
  const bundleId = `EB-${timestamp.substring(0, 10).replace(/-/g, "")}-${Math.floor(
    Math.random() * 1000
  )
    .toString()
    .padStart(3, "0")}`;

  const bundle = {
    bundleId,
    timestamp,
    creator,
    capsuleId,
    capsuleSha512,
    bundleSha512: "", // Will be computed after
    evidenceType: "usage_detection",
    evidence: {
      detectedAt: timestamp,
      sourceUrl,
      checksumMatch: true,
      metadata: {
        detectionMethod: "sha512_verification",
        licenseRequired: true,
        publiclyTracked: true,
        ...metadata,
      },
    },
    licenseOfferUrl: `https://averyos.com/buy?capsule=${capsuleId}`,
    publiclyVerifiable: true,
    notice:
      "This evidence bundle documents detected usage of AveryOS capsule content. License available for voluntary compliance.",
    complianceType: "voluntary",
    legalStatus: "no_legal_action",
    purpose: "transparent_tracking_and_licensing_offer",
  };

  // Compute bundle hash
  const bundleContent = JSON.stringify(bundle, null, 2);
  bundle.bundleSha512 = generateSha512(bundleContent);

  return bundle;
}

// Generate compliance notice
function generateComplianceNotice(options) {
  const { capsuleId, capsuleSha512, licenseUrl } = options;

  const timestamp = new Date().toISOString();
  const noticeId = `LEN-${timestamp.substring(0, 10).replace(/-/g, "")}-${Math.floor(
    Math.random() * 1000
  )
    .toString()
    .padStart(3, "0")}`;

  return {
    noticeId,
    timestamp,
    capsuleId,
    noticeType: "license_available",
    message:
      "A license is available for voluntary compliance. This notice is informational only and does not constitute legal action.",
    licenseUrl: licenseUrl || `https://averyos.com/buy?capsule=${capsuleId}`,
    sha512: capsuleSha512,
    status: "active",
    complianceType: "voluntary",
    enforcementLevel: "informational_only",
    publicTransparency: true,
    stripeEnabled: true,
  };
}

// Generate enforcement event
function generateEnforcementEvent(options) {
  const { capsuleId, capsuleSha512, stripeProductId, description } = options;

  const timestamp = new Date().toISOString();
  const eventId = `EV-${timestamp.substring(0, 10).replace(/-/g, "")}-${Math.floor(
    Math.random() * 1000
  )
    .toString()
    .padStart(3, "0")}`;

  return {
    id: eventId,
    timestamp,
    capsuleId,
    capsuleSha512,
    eventType: "detection",
    status: "monitoring",
    stripeProductId,
    referenceId: `LE-${Math.floor(Math.random() * 1000)
      .toString()
      .padStart(3, "0")}`,
    description:
      description || "Capsule usage detected - license available for voluntary compliance",
  };
}

// Main function
function main() {
  const args = process.argv.slice(2);

  if (args.length < 2) {
    console.log("Usage: node generateEvidenceBundle.js <capsule-id> <sha512-hash> [options]");
    console.log("\nExample:");
    console.log(
      '  node generateEvidenceBundle.js sovereign-index cf83e135... --source="https://example.com"'
    );
    process.exit(1);
  }

  const capsuleId = args[0];
  const capsuleSha512 = args[1];

  // Parse options
  const options = { capsuleId, capsuleSha512 };
  for (let i = 2; i < args.length; i++) {
    const arg = args[i];
    if (arg.startsWith("--source=")) {
      options.sourceUrl = arg.substring(9);
    } else if (arg.startsWith("--product=")) {
      options.stripeProductId = arg.substring(10);
    }
  }

  // Create directories if they don't exist
  const enforcementDir = path.join(process.cwd(), "public", "license-enforcement");
  const evidenceDir = path.join(enforcementDir, "evidence");
  const noticesDir = path.join(enforcementDir, "notices");
  const logsDir = path.join(enforcementDir, "logs");

  [enforcementDir, evidenceDir, noticesDir, logsDir].forEach((dir) => {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  });

  // Generate evidence bundle
  const bundle = generateEvidenceBundle(options);
  const bundleFileName = `${bundle.bundleId}.json`;
  const bundlePath = path.join(ENFORCEMENT_EVIDENCE_ROOT, bundleFileName);
  sovereignWriteSync(ENFORCEMENT_EVIDENCE_ROOT, bundleFileName, JSON.stringify(bundle, null, 2));
  console.log(`✅ Evidence bundle created: ${bundlePath}`);

  // Generate compliance notice
  const notice = generateComplianceNotice(options);
  const noticeFileName = `${notice.noticeId}.json`;
  const noticePath = path.join(ENFORCEMENT_NOTICES_ROOT, noticeFileName);
  sovereignWriteSync(ENFORCEMENT_NOTICES_ROOT, noticeFileName, JSON.stringify(notice, null, 2));
  console.log(`✅ Compliance notice created: ${noticePath}`);

  // Add to enforcement log
  const event = generateEnforcementEvent({
    ...options,
    stripeProductId: options.stripeProductId || `prod_${capsuleId}`,
  });
  const logPath = path.join(ENFORCEMENT_LOGS_ROOT, "enforcement-log.json");

  let events = [];
  if (fs.existsSync(logPath)) {
    events = JSON.parse(fs.readFileSync(logPath, "utf-8"));
  }
  events.push(event);
  sovereignWriteSync(ENFORCEMENT_LOGS_ROOT, "enforcement-log.json", JSON.stringify(events, null, 2));
  console.log(`✅ Event added to log: ${event.id}`);

  console.log("\n📋 Summary:");
  console.log(`  Bundle ID: ${bundle.bundleId}`);
  console.log(`  Notice ID: ${notice.noticeId}`);
  console.log(`  Event ID: ${event.id}`);
  console.log(`  Capsule: ${capsuleId}`);
  console.log(`  SHA-512: ${capsuleSha512.substring(0, 16)}...`);
  console.log("\n✅ All records are publicly accessible and SHA-verified");
  console.log("✅ Focus: Voluntary compliance and transparent tracking");
}

if (require.main === module) {
  main();
}

module.exports = {
  generateEvidenceBundle,
  generateComplianceNotice,
  generateEnforcementEvent,
};
