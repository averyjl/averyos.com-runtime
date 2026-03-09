/** @type {import('next').NextConfig} */
const nextConfig = {
  // PROMOTED: Root property for Next.js 15
  // isomorphic-dompurify/jsdom must be external so the Cloudflare Workers
  // bundle does not attempt to initialise jsdom (a Node.js-only library) at
  // module-evaluation time, which would crash the edge runtime and produce
  // 500 errors on pages that import sanitizeHtml (e.g. the Whitepaper).
  // katex is only used in app/whitepaper/page.tsx (force-static) — pre-rendered
  // at build time, never executed by the Cloudflare Worker at request time.
  // Externalising it prevents katex (~6.7 MB) from being bundled into
  // handler.mjs, keeping the gzip-compressed worker under the 3 MiB free-tier limit.
  // .aoscap files and JSON capsule manifests are served as static files from
  // public/manifest/capsules/ — they are never imported by server modules, so
  // webpack never includes them in the Worker bundle automatically.
  // NOTE: lucide-react and recharts are intentionally NOT listed here. Next.js 15
  // automatically adds client-component packages like recharts/lucide-react to its
  // internal transpilePackages list. Having them in both serverExternalPackages and
  // transpilePackages causes a fatal conflict: "packages specified in
  // 'transpilePackages' conflict with 'serverExternalPackages'".
  // Since recharts is only imported in 'use client' components it is never included
  // in the Cloudflare Worker server bundle, so omitting it here has no bundle-size
  // impact. Since lucide-react is not imported anywhere in this project, omitting it
  // from serverExternalPackages also has no bundle-size impact.
  // marked (~1.4 MB) is used only in statically pre-rendered pages (SSG/force-static)
  // — terms, privacy, whitepaper, creator-lock. Externalising it keeps it out of
  // handler.mjs without any runtime risk since those pages are fully pre-built.
  serverExternalPackages: ['stripe', 'isomorphic-dompurify', 'jsdom', 'katex', 'marked'],
  
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
      // NOTE: The canonical domain redirect (averyos.com → www.averyos.com)
      // is handled in middleware.ts via proper URL construction.
      // Do NOT use a next.config.js redirect for this — the /:path* template
      // variable is not substituted correctly in the @opennextjs/cloudflare
      // Workers build, causing the browser to land on the literal URL
      // https://www.averyos.com/:path* instead of the actual page.
      //
      // ── Legacy / convenience routes ───────────────────────────────────────
      { source: '/start', destination: '/', permanent: true },
      { source: '/pay', destination: '/license', permanent: true },
      { source: '/buy', destination: '/license', permanent: true },
      { source: '/law-stack', destination: '/ai-alignment', permanent: true },
      { source: '/witness/disclosure/:sha*', destination: '/the-proof', permanent: true },
      { source: '/forensic-proof', destination: '/licensing#forensic-proof', permanent: true },
      { source: '/retroclaim-log', destination: '/licensing#retroclaim', permanent: true },
      { source: '/license-enforcement', destination: '/licensing#enforcement', permanent: true },
      // ── Alignment Accord — primary index for all 301 alignment redirects ──
      { source: '/accord',           destination: '/alignment-accord', permanent: true },
      { source: '/amnesty',          destination: '/alignment-accord', permanent: true },
      { source: '/align',            destination: '/alignment-accord', permanent: true },
      { source: '/settlement',       destination: '/alignment-accord', permanent: true },
      { source: '/tari-accord',      destination: '/alignment-accord', permanent: true },
      // ── Sitemap convenience redirect ──────────────────────────────────────
      // Allows Google Search Console to index via /sitemap (without extension)
      // while the canonical URL remains /sitemap.xml
      { source: '/sitemap', destination: '/sitemap.xml', permanent: false },
    ];
  },
};

export default nextConfig;
