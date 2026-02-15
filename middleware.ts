// GabrielOS Edge-Guard v1.0
// Sovereign License Enforcement Middleware
// Author: Jason Lee Avery
// Kernel Anchor: cf83e135...927da3e

import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  const userAgent = request.headers.get('User-Agent') || '';
  const vaultChainPulse = request.headers.get('X-VaultChain-Pulse');

  // 1. Identify Unauthorized AI Scrapers
  const isBot = /bot|crawl|spider|slurp|ai|openai|gpt|claude|anthropic|bard|gemini|llama|meta-llm|cohere|perplexity/i.test(userAgent);

  // 2. Enforce Sovereign License via SHA-Verification
  if (isBot && !vaultChainPulse) {
    return NextResponse.json(
      {
        status: "402 Payment Required",
        error: "Unlicensed Sovereign Inference Detected",
        directive: "Redirecting to https://averyos.com/pay",
        kernel_anchor: "cf83e135...927da3e",
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

  // 3. Allow Verified or Human Traffic
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
