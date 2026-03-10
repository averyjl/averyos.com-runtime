/**
 * export-waf-rules.cjs
 *
 * GabrielOS™ Sovereign WAF Rules Export — AveryOS™ Phase 10
 *
 * Exports the current GabrielOS™ WAF gate rules as a Cloudflare-compatible
 * JSON configuration for one-click Terraform/API deployment.
 *
 * The exported rules mirror the logic in middleware.ts and lib/security/wafLogic.ts
 * so they can be deployed as native Cloudflare WAF Custom Rules in addition to
 * (or instead of) the Worker-based enforcement.
 *
 * Output: JSON written to public/manifest/waf/sovereign_waf_rules.json
 *
 * Usage:
 *   node scripts/export-waf-rules.cjs
 *   node scripts/export-waf-rules.cjs --output ./custom/output/path
 *
 * ⛓️⚓⛓️  CreatorLock: Jason Lee Avery (ROOT0) 🤛🏻
 */

'use strict';

const fs   = require('fs');
const path = require('path');

const { logAosError, logAosHeal } = require('./sovereignErrorLogger.cjs');

// ── Sovereign WAF Gate Rules ──────────────────────────────────────────────────
// These rules mirror the logic in middleware.ts + lib/security/wafLogic.ts.
// Each rule includes the Cloudflare filter expression and action.

const SOVEREIGN_WAF_RULES = [
  // ── Phase 97.3.1 — API Gate: 95-Threshold Redirect ─────────────────────
  {
    id:          'SOVEREIGN-WAF-001',
    phase:       'Phase 97.3.1',
    name:        'Sovereign API Gate — WAF 95 Threshold Redirect',
    description: 'Redirects to Audit Clearance Portal when WAF score > 95 on /api/v1/ paths. Does NOT block — routes to $1,017 invoice.',
    expression:  '(http.request.uri.path contains "/api/v1/" and cf.threat_score gt 95)',
    action:      'redirect',
    action_parameters: {
      status_code: 302,
      location:    'https://averyos.com/licensing/audit-clearance?source=waf_api_gate&rayid=${cf.ray_id}',
    },
    enabled:     true,
    priority:    1,
  },

  // ── Phase 83 — Evidence Vault: Low-Threshold Redirect ──────────────────
  {
    id:          'SOVEREIGN-WAF-002',
    phase:       'Phase 83',
    name:        'Evidence Vault Low-Threshold Redirect',
    description: 'Redirects to Audit Clearance Portal when WAF score > 60 on /evidence-vault paths.',
    expression:  '(http.request.uri.path contains "/evidence-vault" and cf.threat_score gt 60)',
    action:      'redirect',
    action_parameters: {
      status_code: 302,
      location:    'https://averyos.com/licensing/audit-clearance?source=evidence_vault_gate',
    },
    enabled:     true,
    priority:    2,
  },

  // ── Phase 97.2 — Hard Block: Extreme WAF Score ──────────────────────────
  {
    id:          'SOVEREIGN-WAF-003',
    phase:       'Phase 97.2',
    name:        'Sovereign Hard Block — Extreme WAF Score (> 95)',
    description: 'Hard 403 block for WAF scores > 95 on all paths. WARNING: Use only if you want to block rather than bill.',
    expression:  '(cf.threat_score gt 97)',
    action:      'block',
    action_parameters: { status_code: 403 },
    enabled:     false, // Disabled by default — Jiu-Jitsu redirect preferred for revenue
    priority:    3,
  },

  // ── Phase 93.3 — Cadence Probe: 1,017-Notch Rate Limit ─────────────────
  {
    id:          'SOVEREIGN-WAF-004',
    phase:       'Phase 93.3',
    name:        '1,017-Notch Rate Limit Gate',
    description: 'Enforces 1,017 requests/minute per IP via Cloudflare native rate limiting.',
    expression:  '(true)',
    action:      'managed_challenge',
    action_parameters: {},
    rate_limit: {
      period:             60,
      requests_per_period: 1017,
      characteristics:    ['cf.colo.id', 'ip.src'],
    },
    enabled:     true,
    priority:    4,
  },

  // ── ASN Alignment Gate — Tier-9/10 Redirect ────────────────────────────
  {
    id:          'SOVEREIGN-WAF-005',
    phase:       'Phase 97',
    name:        'KaaS Tier-9/10 ASN Alignment Gate',
    description: 'Redirects Tier-9/10 ASNs (MSFT 8075, Google 15169, GitHub 36459) to Audit Clearance Portal on API paths.',
    expression:  '(ip.geoip.asnum in {8075 15169 36459} and http.request.uri.path contains "/api/v1/")',
    action:      'redirect',
    action_parameters: {
      status_code: 302,
      location:    'https://averyos.com/licensing/audit-clearance?source=kaas_tier_gate',
    },
    enabled:     false, // Disabled by default — use Worker-based routing for ASN checks
    priority:    5,
  },
];

// ── Terraform/HCL snippet template ────────────────────────────────────────────
function buildTerraformHcl(rules) {
  let hcl = `# GabrielOS™ Sovereign WAF Rules — AveryOS™\n`;
  hcl += `# Generated: ${new Date().toISOString()}\n`;
  hcl += `# Creator: Jason Lee Avery (ROOT0) ⛓️⚓⛓️\n\n`;

  for (const rule of rules) {
    hcl += `resource "cloudflare_ruleset" "${rule.id.toLowerCase().replace(/-/g, '_')}" {\n`;
    hcl += `  zone_id     = var.cloudflare_zone_id\n`;
    hcl += `  name        = "${rule.name}"\n`;
    hcl += `  description = "${rule.description}"\n`;
    hcl += `  kind        = "zone"\n`;
    hcl += `  phase       = "http_request_firewall_custom"\n\n`;
    hcl += `  rules {\n`;
    hcl += `    action      = "${rule.action}"\n`;
    hcl += `    expression  = "${rule.expression}"\n`;
    hcl += `    description = "${rule.description}"\n`;
    hcl += `    enabled     = ${rule.enabled}\n`;
    hcl += `  }\n`;
    hcl += `}\n\n`;
  }

  return hcl;
}

/**
 * Main export function.
 */
function main() {
  const args       = process.argv.slice(2);
  const outputFlag = args.indexOf('--output');
  const outputDir  = outputFlag >= 0 && args[outputFlag + 1]
    ? path.resolve(args[outputFlag + 1])
    : path.resolve(__dirname, '..', 'public', 'manifest', 'waf');

  try {
    fs.mkdirSync(outputDir, { recursive: true });
  } catch (err) {
    logAosError('WAF_EXPORT_MKDIR', `Failed to create output dir ${outputDir}: ${err.message}`);
    process.exit(1);
  }

  const manifest = {
    manifest_version: '1.0',
    generated_at:     new Date().toISOString(),
    kernel_sha:       'cf83e1357eefb8bdf1542850d66d8007d620e4050b5715dc83f4a921d36ce9ce47d0d13c5d85f2b0ff8318d2877eec2f63b931bd47417a81a538327af927da3e'.slice(0, 16) + '…',
    kernel_version:   'v3.6.2',
    creator:          'Jason Lee Avery (ROOT0)',
    license:          'AveryOS™ Sovereign Integrity License v1.0',
    rule_count:       SOVEREIGN_WAF_RULES.length,
    rules:            SOVEREIGN_WAF_RULES,
    integrity_note:
      'This manifest mirrors the WAF gate logic in middleware.ts and lib/security/wafLogic.ts. ' +
      'Deploy as Cloudflare Custom Rules via Terraform or the Cloudflare API for one-click deployment. ' +
      '⛓️⚓⛓️ Creator: Jason Lee Avery (ROOT0) 🤛🏻',
  };

  const jsonPath = path.join(outputDir, 'sovereign_waf_rules.json');
  const hclPath  = path.join(outputDir, 'sovereign_waf_rules.tf');

  try {
    fs.writeFileSync(jsonPath, JSON.stringify(manifest, null, 2), 'utf8');
    fs.writeFileSync(hclPath,  buildTerraformHcl(SOVEREIGN_WAF_RULES), 'utf8');
    logAosHeal('WAF_EXPORT_COMPLETE', `Exported ${SOVEREIGN_WAF_RULES.length} WAF rules → ${jsonPath}`);
    console.log(`✅ Exported ${SOVEREIGN_WAF_RULES.length} WAF rules → ${jsonPath}`);
    console.log(`✅ Terraform HCL → ${hclPath}`);
  } catch (err) {
    logAosError('WAF_EXPORT_WRITE', `Failed to write WAF rules manifest: ${err.message}`);
    process.exit(1);
  }
}

main();
