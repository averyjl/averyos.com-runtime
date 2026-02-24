/** @type {import('next').NextConfig} */
const nextConfig = {
  // PROMOTED: This must be at the root for Next.js 15
  serverExternalPackages: ['stripe'],
  
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  }
};

export default nextConfig;
