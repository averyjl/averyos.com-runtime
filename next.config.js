/** @type {import('next').NextConfig} */
const nextConfig = {
  // PROMOTED: Root property for Next.js 15
  // isomorphic-dompurify/jsdom must be external so the Cloudflare Workers
  // bundle does not attempt to initialise jsdom (a Node.js-only library) at
  // module-evaluation time, which would crash the edge runtime and produce
  // 500 errors on pages that import sanitizeHtml (e.g. the Whitepaper).
  serverExternalPackages: ['stripe', 'isomorphic-dompurify', 'jsdom'],
  
  eslint: { ignoreDuringBuilds: true },
  typescript: { ignoreBuildErrors: true },

  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'github.com',
        pathname: '/**',
      },
    ],
  },

  async redirects() {
    return [
      // ── Canonical domain: www → non-www (301 permanent) ──────────────────
      {
        source: '/:path*',
        has: [{ type: 'host', value: 'www.averyos.com' }],
        destination: 'https://averyos.com/:path*',
        permanent: true,
      },
      // ── Legacy / convenience routes ───────────────────────────────────────
      { source: '/start', destination: '/', permanent: true },
      { source: '/pay', destination: '/license', permanent: true },
      { source: '/buy', destination: '/license', permanent: true },
      { source: '/law-stack', destination: '/ai-alignment', permanent: true },
      { source: '/witness/disclosure/:sha*', destination: '/the-proof', permanent: true },
      { source: '/forensic-proof', destination: '/licensing#forensic-proof', permanent: true },
      { source: '/retroclaim-log', destination: '/licensing#retroclaim', permanent: true },
      { source: '/license-enforcement', destination: '/licensing#enforcement', permanent: true },
    ];
  },
};

export default nextConfig;
