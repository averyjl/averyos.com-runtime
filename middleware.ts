// GabrielOS Edge-Guard v1.1
// Sovereign License Enforcement Middleware
// Author: Jason Lee Avery
// Kernel Anchor: cf83e135...927da3e

import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// AI scraper detection patterns
const AI_BOT_PATTERNS = /bot|crawl|spider|slurp|ai|openai|gpt|claude|anthropic|bard|gemini|llama|meta-llm|cohere|perplexity/i;

// Standard browser patterns (Chrome, Safari, Firefox, Edge, etc.)
const BROWSER_PATTERNS = /chrome|safari|firefox|edge|opera|msie|trident/i;

// Full kernel anchor: cf83e1357eefb8bdf1542850d66d8007d620e4050b5715dc83f4a921d36ce9ce47d0d13c5d85f2b0ff8318d2877eec2f63b931bd47417a81a538327af927da3e
// Truncated for display purposes - see LICENSE.md for full hash
const KERNEL_ANCHOR_DISPLAY = "cf83e135...927da3e";

export function middleware(request: NextRequest) {
  const userAgent = request.headers.get('User-Agent') || '';
  const vaultChainPulse = request.headers.get('X-VaultChain-Pulse');
  const method = request.method;

  // 1. ALLOW: Standard browser traffic (Chrome, Safari, Firefox, etc.)
  // Human users should always have access to view content and the /pay page
  const isBrowser = BROWSER_PATTERNS.test(userAgent);
  if (isBrowser && method === 'GET') {
    // Allow all GET requests from standard browsers
    return NextResponse.next();
  }

  // 2. ALLOW: Verified AI with VaultChain-Pulse header
  if (vaultChainPulse) {
    return NextResponse.next();
  }

  // 3. IDENTIFY: Unauthorized AI Scrapers
  const isBot = AI_BOT_PATTERNS.test(userAgent);

  // 4. BLOCK: Enforce Sovereign License via SHA-Verification
  if (isBot && !vaultChainPulse) {
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

  // 5. DEFAULT: Allow all other traffic (including empty user agents)
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
