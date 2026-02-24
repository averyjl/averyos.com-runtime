/** @type {import('next').NextConfig} */
const nextConfig = {
  /* * Sovereign Parity Configuration
   * Version: Next.js 15.5.12
   * Syntax: ESM (Required by package.json "type": "module")
   */

  // Resolve Stripe resolution error for Cloudflare/OpenNext
  serverExternalPackages: ['stripe'],

  // Enable standalone output for high-availability environments
  output: 'standalone',

  // Ensure strict truth-anchoring for UI components
  reactStrictMode: true,
  
  experimental: {
    // Other sovereign experimental flags can be added here
  }
};

// Use ESM export instead of module.exports
export default nextConfig;
