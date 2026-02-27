/** @type {import('next').NextConfig} */
const nextConfig = {
  // PROMOTED: Root property for Next.js 15
  serverExternalPackages: ['stripe'],
  
  eslint: { ignoreDuringBuilds: true },
  typescript: { ignoreBuildErrors: true },

  async redirects() {
    return [
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
