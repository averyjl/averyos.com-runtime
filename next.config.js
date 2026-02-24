/** @type {import('next').NextConfig} */
const nextConfig = {
  /* * Sovereign Parity Configuration
   * Version: Next.js 15.5.12
   * Purpose: Resolve Stripe resolution error during Cloudflare/OpenNext build.
   */

  // Move Stripe to top-level external packages to prevent bundling into the worker.
  serverExternalPackages: ['stripe'],

  // Enable standalone output for deployment to high-availability environments.
  output: 'standalone',

  experimental: {
    // Keep other Sovereign-specific experimental flags here.
  },

  // Ensure strict truth-anchoring for the UI components.
  reactStrictMode: true,
};

module.exports = nextConfig;
