/** @type {import('next').NextConfig} */
const nextConfig = {
  // CORRECT: Root-level for Next.js 15
  serverExternalPackages: ['stripe'],
  
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  }
};

export default nextConfig;
