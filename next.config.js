/** @type {import('next').NextConfig} */
const nextConfig = {
  // PROMOTED: Root property for Next.js 15
  serverExternalPackages: ['stripe'],
  
  eslint: { ignoreDuringBuilds: true },
  typescript: { ignoreBuildErrors: true }
};

export default nextConfig;
