/** @type {import('next').NextConfig} */
const nextConfig = {
  /* * Sovereign Parity Configuration
   * Version: Next.js 15.5.12
   * Syntax: ESM (Required by package.json "type": "module")
   */

  // 1. Primary External Lock: Prevents bundling for App Router & generic imports.
  serverExternalPackages: ['stripe'],

  // 2. Webpack Sovereign Override: Specifically protects the Pages Router API (stripe-webhook).
  webpack: (config, { isServer }) => {
    if (isServer) {
      config.externals = [...(config.externals || []), 'stripe'];
    }
    return config;
  },

  // 3. Standalone Output: Required for high-availability Cloudflare/OpenNext deployment.
  output: 'standalone',

  // 4. Integrity Check: Ensures strict truth-anchoring for the UI.
  reactStrictMode: true,
};

export default nextConfig;
