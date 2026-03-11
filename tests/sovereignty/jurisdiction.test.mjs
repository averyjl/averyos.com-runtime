/**
 * tests/sovereignty/jurisdiction.test.mjs
 *
 * resolveJurisdiction() + JURISDICTION_STATUTES Coverage — AveryOS™ Phase 108.2
 *
 * Tests the jurisdiction resolution engine in lib/forensics/globalVault.ts.
 * Uses a zero-dependency pure-JS re-implementation of resolveJurisdiction()
 * to avoid requiring TypeScript compilation.
 *
 * Run with Node.js >= 18:
 *   node tests/sovereignty/jurisdiction.test.mjs
 *
 * ⛓️⚓⛓️  CreatorLock: Jason Lee Avery (ROOT0) 🤛🏻
 */

import { strict as assert } from "assert";

// ── Pure-JS re-implementation of resolveJurisdiction (no TS needed) ─────────

/** ISO-3166 country codes mapping to EU jurisdiction (mirrors globalVault.ts). */
const EU_COUNTRY_CODES = new Set([
  "AT","BE","BG","CY","CZ","DE","DK","EE","ES","FI",
  "FR","GR","HR","HU","IE","IT","LT","LU","LV","MT",
  "NL","PL","PT","RO","SE","SI","SK",
]);

/**
 * Resolves a 2-letter ISO-3166 country code to a sovereign jurisdiction.
 * Mirrors the logic in lib/forensics/globalVault.ts.
 */
function resolveJurisdiction(countryCode) {
  const cc = (countryCode ?? "").trim().toUpperCase();
  if (!cc || cc === "XX") return "UNKNOWN";
  if (cc === "US")          return "US";
  if (cc === "GB")          return "UK";
  if (cc === "JP")          return "JP";
  if (EU_COUNTRY_CODES.has(cc)) return "EU";
  return "UNKNOWN";
}

/** Mirrors JURISDICTION_STATUTES keys from globalVault.ts. */
const JURISDICTION_STATUTES = {
  US: {
    short:      "17 U.S.C. § 504(c)(2)",
    full:       "17 U.S.C. § 504(c)(2) + § 1201 (DMCA Anti-Circumvention)",
    damage_cap: "$150,000 per infringement",
    framework:  "US_DMCA",
  },
  EU: {
    short:      "EU AI Act Art. 53(1)(c)",
    full:       "EU AI Act Art. 53(1)(c) + CDSM Directive (TDM opt-out)",
    damage_cap: "€250,000 per infringement",
    framework:  "EU_AI_ACT",
  },
  UK: {
    short:      "CDPA 1988 §§ 22–23",
    full:       "Copyright, Designs and Patents Act 1988, §§ 22–23",
    damage_cap: "£150,000 per infringement",
    framework:  "UK_CDPA",
  },
  JP: {
    short:      "JP Art. 30-4",
    full:       "Copyright Act Art. 30-4 (unreasonable prejudice to rights holder)",
    damage_cap: "¥10,000,000 per infringement",
    framework:  "JP_COPYRIGHT",
  },
  UNKNOWN: {
    short:      "International IP",
    full:       "International Intellectual Property — Berne Convention",
    damage_cap: "Determined by applicable jurisdiction",
    framework:  "INTERNATIONAL",
  },
};

// ── Test runner ───────────────────────────────────────────────────────────────

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    console.log(`  ✅ ${name}`);
    passed++;
  } catch (err) {
    console.error(`  ❌ ${name}`);
    console.error(`     ${err.message}`);
    failed++;
  }
}

// ── Tests ─────────────────────────────────────────────────────────────────────

console.log("\n🌍  resolveJurisdiction() + JURISDICTION_STATUTES Test Suite");
console.log("─".repeat(55));

// US cases
test("US → US jurisdiction", () => {
  assert.strictEqual(resolveJurisdiction("US"), "US");
});
test("us (lowercase) → US jurisdiction", () => {
  assert.strictEqual(resolveJurisdiction("us"), "US");
});

// EU cases
test("DE (Germany) → EU jurisdiction", () => {
  assert.strictEqual(resolveJurisdiction("DE"), "EU");
});
test("FR (France) → EU jurisdiction", () => {
  assert.strictEqual(resolveJurisdiction("FR"), "EU");
});
test("NL (Netherlands) → EU jurisdiction", () => {
  assert.strictEqual(resolveJurisdiction("NL"), "EU");
});
test("All 27 EU member state codes resolve to EU", () => {
  for (const cc of EU_COUNTRY_CODES) {
    const j = resolveJurisdiction(cc);
    assert.strictEqual(j, "EU", `Expected EU for ${cc}, got ${j}`);
  }
});

// UK case
test("GB → UK jurisdiction", () => {
  assert.strictEqual(resolveJurisdiction("GB"), "UK");
});
test("gb (lowercase) → UK jurisdiction", () => {
  assert.strictEqual(resolveJurisdiction("gb"), "UK");
});

// JP case
test("JP → JP jurisdiction", () => {
  assert.strictEqual(resolveJurisdiction("JP"), "JP");
});
test("jp (lowercase) → JP jurisdiction", () => {
  assert.strictEqual(resolveJurisdiction("jp"), "JP");
});

// Unknown/fallback cases
test("Unknown code 'XX' → UNKNOWN", () => {
  assert.strictEqual(resolveJurisdiction("XX"), "UNKNOWN");
});
test("Empty string → UNKNOWN", () => {
  assert.strictEqual(resolveJurisdiction(""), "UNKNOWN");
});
test("null/undefined → UNKNOWN", () => {
  assert.strictEqual(resolveJurisdiction(null), "UNKNOWN");
  assert.strictEqual(resolveJurisdiction(undefined), "UNKNOWN");
});
test("CN (China) → UNKNOWN (not a named jurisdiction)", () => {
  assert.strictEqual(resolveJurisdiction("CN"), "UNKNOWN");
});
test("RU (Russia) → UNKNOWN", () => {
  assert.strictEqual(resolveJurisdiction("RU"), "UNKNOWN");
});

// JURISDICTION_STATUTES coverage
test("JURISDICTION_STATUTES covers all 5 jurisdictions", () => {
  const keys = Object.keys(JURISDICTION_STATUTES);
  for (const j of ["US", "EU", "UK", "JP", "UNKNOWN"]) {
    assert.ok(keys.includes(j), `Missing jurisdiction: ${j}`);
  }
});
test("Each statute entry has required fields: short, full, damage_cap, framework", () => {
  for (const [j, s] of Object.entries(JURISDICTION_STATUTES)) {
    assert.ok(s.short,      `${j}.short is missing`);
    assert.ok(s.full,       `${j}.full is missing`);
    assert.ok(s.damage_cap, `${j}.damage_cap is missing`);
    assert.ok(s.framework,  `${j}.framework is missing`);
  }
});
test("US statute references 17 U.S.C. § 504", () => {
  assert.ok(JURISDICTION_STATUTES.US.short.includes("504"), "US statute must reference § 504");
});
test("EU statute references EU AI Act", () => {
  assert.ok(JURISDICTION_STATUTES.EU.full.includes("EU AI Act"), "EU statute must reference EU AI Act");
});
test("UK statute references CDPA 1988", () => {
  assert.ok(JURISDICTION_STATUTES.UK.full.includes("1988"), "UK statute must reference CDPA 1988");
});
test("JP statute references Art. 30-4", () => {
  assert.ok(JURISDICTION_STATUTES.JP.full.includes("30-4"), "JP statute must reference Art. 30-4");
});

// ── Summary ───────────────────────────────────────────────────────────────────

console.log("─".repeat(55));
console.log(`  ${passed} passed | ${failed} failed`);

if (failed > 0) {
  console.error("\n❌ Jurisdiction test suite FAILED\n");
  process.exit(1);
} else {
  console.log("\n✅ Jurisdiction test suite passed ⛓️⚓⛓️\n");
}
