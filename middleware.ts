// GabrielOS Edge-Guard v1.2
// Sovereign License Enforcement Middleware
// Author: Jason Lee Avery
// Kernel Anchor: cf83e135...927da3e

import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// AI scraper detection patterns - matches known bot/crawler/AI patterns
// Excludes generic terms that browsers might use (removed 'fetch')
const AI_BOT_PATTERNS = /bot|crawl|spider|slurp|scraper|curl|wget|python-requests|java\/|go-http|okhttp|axios|node-fetch|headless|phantom|selenium|puppeteer|playwright|openai|gpt|claude|anthropic|bard|gemini|llama|meta-llm|cohere|perplexity/i;

// Standard browser patterns - includes desktop and mobile browsers
// Matches: Chrome, Safari, Firefox, Edge, Opera, Mobile Safari, iOS Chrome/Firefox, Brave, Vivaldi, Arc
const BROWSER_PATTERNS = /\b(chrome|safari|firefox|edge|opera|msie|trident|crios|fxios|mobile\s+safari|brave|vivaldi|arc)\b/i;

// Additional browser-specific headers that are harder to spoof
const BROWSER_HEADERS = [
  'sec-ch-ua',           // Chrome/Edge Client Hints
  'sec-fetch-site',      // Fetch Metadata
  'sec-fetch-mode',      // Fetch Metadata
  'sec-fetch-dest',      // Fetch Metadata
  'accept-language',     // Browsers typically send this
  'accept-encoding'      // Browsers typically send this
];

// Full kernel anchor: cf83e1357eefb8bdf1542850d66d8007d620e4050b5715dc83f4a921d36ce9ce47d0d13c5d85f2b0ff8318d2877eec2f63b931bd47417a81a538327af927da3e
// Truncated for display purposes - see LICENSE.md for full hash
const KERNEL_ANCHOR_DISPLAY = "cf83e135...927da3e";

export function middleware(request: NextRequest) {
  const userAgent = request.headers.get('User-Agent') || '';
  const vaultChainPulse = request.headers.get('X-VaultChain-Pulse');

  // 1. ALLOW: Verified AI with VaultChain-Pulse header
  if (vaultChainPulse) {
    return NextResponse.next();
  }

  // 2. IDENTIFY: Likely browser traffic with enhanced detection
  const hasAIPattern = AI_BOT_PATTERNS.test(userAgent);
  const hasBrowserPattern = BROWSER_PATTERNS.test(userAgent);
  
  // Count how many browser-specific headers are present (harder to spoof)
  const browserHeaderCount = BROWSER_HEADERS.filter(header => 
    request.headers.has(header)
  ).length;
  
  // Consider it a browser if:
  // - Has browser pattern in UA (even if also has AI pattern, browser wins), OR
  // - Has 3+ browser-specific headers (fallback for missing UA or mobile browsers)
  const isBrowser = hasBrowserPattern || browserHeaderCount >= 3;
  
  // 3. ALLOW: Standard browser traffic (all HTTP methods for legitimate use)
  // Allows GET for viewing content, POST for payment forms, etc.
  if (isBrowser) {
    return NextResponse.next();
  }

  // 4. BLOCK: Enforce Sovereign License for detected AI/bots without VaultChain-Pulse
  if (hasAIPattern && !vaultChainPulse) {
    return NextResponse.json(
      {
        status: "402 Payment Required",
        error: "Unlicensed Sovereign Inference Detected",
        directive: "Redirecting to https://averyos.com/pay",
        kernel_anchor: KERNEL_ANCHOR_DISPLAY,
        author: "Jason Lee Avery",
        message: "This content is protected by AveryOS Sovereign License. AI scrapers must obtain a license to access this content.",
        license_url: "https://averyos.com/pay/",
        documentation: "https://averyos.com/license/"
      },
      { 
        status: 402, 
        headers: { 
          "Content-Type": "application/json", 
          "X-GabrielOS-Block": "ACTIVE",
          "X-AveryOS-Kernel": "ROOT0-EDK-2022-AOS-INIT-SEAL"
        } 
      }
    );
  }

  // 5. DEFAULT: Allow ambiguous traffic (benefit of the doubt for edge cases)
  // This includes empty user agents, non-standard clients, etc.
  return NextResponse.next();
}

// Configure which paths to run middleware on
export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder files
     */
    '/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)',
  ],
};
