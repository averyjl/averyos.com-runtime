/**
 * lib/qa/security.ts
 *
 * AveryOS™ Sovereign Security QA Utilities — Phase 112 / GATE 112.2
 *
 * Provides attack-surface payloads and response-header assessment utilities
 * used by the QA Engine to run security checks from two perspectives:
 *
 *   • HUMAN_USER — how a legitimate browser user might trigger edge cases
 *   • SECURITY_PROBE — how an adversarial scanner/bot/AI agent might attack
 *
 * All functions are pure (no I/O) and run in both Cloudflare Workers and
 * Node.js test environments without additional dependencies.
 *
 * ⛓️⚓⛓️  CreatorLock: Jason Lee Avery (ROOT0) 🤛🏻
 */

// ── XSS Payloads ──────────────────────────────────────────────────────────────

/**
 * Common Cross-Site Scripting (XSS) payloads used to test that the sanitizer
 * (`isomorphic-dompurify` / `lib/sanitizeHtml.ts`) strips all dangerous markup.
 *
 * Tests should pass all of these through the sanitizer and assert the output
 * contains NO `<script`, `onerror`, `javascript:`, etc.
 */
export const XSS_PAYLOADS: readonly string[] = [
  "<script>alert('xss')</script>",
  "<img src=x onerror=alert(1)>",
  "<svg onload=alert(1)>",
  "javascript:alert(1)",
  "<iframe src='javascript:alert(1)'></iframe>",
  "<body onload=alert(1)>",
  "';alert('xss');//",
  `<a href="javascript:void(0)" onclick="alert(1)">click</a>`,
  "<input onfocus=alert(1) autofocus>",
  "<details open ontoggle=alert(1)>",
  "<<SCRIPT>alert('XSS');//<</SCRIPT>",
  "<IMG SRC=`javascript:alert(\"RSnake says,'XSS'\")` >",
  '<div style="background:url(javascript:alert(1))">',
  "<marquee onstart=alert(1)>",
  "<object data='data:text/html;base64,PHNjcmlwdD5hbGVydCgxKTwvc2NyaXB0Pg=='>",
] as const;

// ── SQL Injection Payloads ────────────────────────────────────────────────────

/**
 * SQL injection test strings.  Any API endpoint that queries D1 must use
 * parameterised statements (`prepare().bind()`).  Running these through
 * the endpoint should produce a 400 validation error, not a D1 query error.
 */
export const SQL_INJECTION_PAYLOADS: readonly string[] = [
  "' OR 1=1--",
  "'; DROP TABLE sovereign_audit_logs;--",
  "' UNION SELECT * FROM sqlite_master--",
  "1' AND SLEEP(5)--",
  "admin'--",
  `" OR ""="`,
  "1; SELECT * FROM vaultgate_credentials--",
  "1 OR 1=1",
  `' OR 'x'='x`,
  "'; SELECT load_extension('evil.so')--",
] as const;

// ── Bot / AI User-Agent strings ───────────────────────────────────────────────

/**
 * User-Agent strings that should be identified as bots / AI crawlers by the
 * `AI_BOT_PATTERNS` regex in middleware.ts.
 *
 * Tests should confirm that requests carrying these UAs trigger the appropriate
 * DriftShield / KaaS billing classification.
 */
export const BOT_USER_AGENTS: readonly string[] = [
  "GPTBot/1.0 (+https://openai.com/gptbot)",
  "CCBot/2.0 (https://commoncrawl.org/faq/)",
  "anthropic-ai/1.0",
  "Claude-Web/1.0",
  "PerplexityBot/1.0",
  "PetalBot (+https://webmaster.petalsearch.com/site/petalbot)",
  "python-requests/2.28.0",
  "curl/7.68.0",
  "Go-http-client/2.0",
  "okhttp/4.9.3",
  "axios/1.0.0",
  "Headless-Chrome/110.0",
  "Googlebot/2.1 (+http://www.google.com/bot.html)",
] as const;

/**
 * Legitimate browser User-Agent strings that should NOT be classified as bots
 * by the middleware.
 */
export const BROWSER_USER_AGENTS: readonly string[] = [
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_2) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Safari/605.1.15",
  "Mozilla/5.0 (X11; Linux x86_64; rv:109.0) Gecko/20100101 Firefox/115.0",
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 Edg/120.0.0.0",
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_2 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Mobile/15E148 Safari/604.1",
] as const;

// ── Abuse / Attack Headers ────────────────────────────────────────────────────

/**
 * HTTP headers that replicate adversarial / abuse scenarios.
 *
 * Used to verify that:
 *   1. The DriftShield rejects requests with `x-averyos-jitter: 1`.
 *   2. High WAF scores trigger appropriate 403 / redirect responses.
 *   3. Masking headers (Via, X-Forwarded-For) are detected and flagged.
 */
export const ABUSE_HEADERS: ReadonlyArray<Record<string, string>> = [
  { "x-waf-score": "99",  "user-agent": "AttackBot/1.0" },
  { "x-waf-score": "85",  "user-agent": "ScannerBot/1.0" },
  { "x-waf-score": "65",  "x-averyos-jitter": "1" },
  { "cf-waf-attack-score": "96" },
  { "via": "1.1 proxy.attacker.com", "x-forwarded-for": "1.2.3.4" },
  { "x-real-ip": "10.0.0.1", "cf-connecting-ip": "10.0.0.2" },
] as const;

// ── Security Header Assessment ────────────────────────────────────────────────

export interface SecurityHeaderReport {
  /** Headers that are present and correctly configured. */
  present:  string[];
  /** Headers that are absent but recommended. */
  missing:  string[];
  /** Overall pass/fail — true if no recommended headers are missing. */
  pass:     boolean;
}

/**
 * Recommended security response headers.
 * Each key is the header name; value is a description for reporting.
 */
export const RECOMMENDED_SECURITY_HEADERS: Record<string, string> = {
  "x-content-type-options":    "Prevents MIME-type sniffing",
  "x-frame-options":           "Prevents clickjacking via iframes",
  "referrer-policy":           "Controls Referer header leakage",
  "content-security-policy":   "Restricts resource origins",
  "permissions-policy":        "Restricts browser feature access",
  "strict-transport-security": "Forces HTTPS (HSTS)",
  "cache-control":             "Controls response caching",
};

/**
 * Assess a `Headers` object for the presence of recommended security headers.
 *
 * @param headers  Response headers (from a real fetch or test mock).
 * @returns        SecurityHeaderReport with present/missing lists and pass flag.
 */
export function assessSecurityHeaders(headers: Headers): SecurityHeaderReport {
  const present: string[] = [];
  const missing: string[] = [];

  for (const name of Object.keys(RECOMMENDED_SECURITY_HEADERS)) {
    if (headers.get(name) !== null) {
      present.push(name);
    } else {
      missing.push(name);
    }
  }

  return { present, missing, pass: missing.length === 0 };
}

// ── Path Probe Catalog ────────────────────────────────────────────────────────

/**
 * Paths commonly probed by bots/scanners that should return 404 or be
 * redirected to audit clearance — never expose internal files.
 */
export const PROBE_PATHS: readonly string[] = [
  "/.env",
  "/.env.local",
  "/.git/HEAD",
  "/wp-admin/",
  "/wp-login.php",
  "/xmlrpc.php",
  "/phpmyadmin/",
  "/admin/config",
  "/config.json",
  "/server-status",
  "/.well-known/security.txt",  // Should exist with RESPONSIBLE_DISCLOSURE policy
  "/api/v1/health",             // Must return 200 (positive probe — health check)
] as const;

// ── Input Sanitization Checker ────────────────────────────────────────────────

/** Patterns that indicate dangerous content remaining after sanitization. */
const DANGEROUS_PATTERNS: readonly RegExp[] = [
  /<script/i,
  /javascript:/i,
  /onerror=/i,
  /onload=/i,
  /onfocus=/i,
  /onclick=/i,
  /ontoggle=/i,
  /onstart=/i,
  /<iframe/i,
  /<object/i,
  /<embed/i,
  /<svg.*onload/i,
];

/**
 * Check whether a sanitized string is safe from XSS injection.
 * Returns `true` if the output contains no dangerous patterns.
 */
export function isSanitizedSafe(sanitized: string): boolean {
  return !DANGEROUS_PATTERNS.some((rx) => rx.test(sanitized));
}
