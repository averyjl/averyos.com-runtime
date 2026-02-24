/** @type {import('next').NextConfig} */
const nextConfig = {
  // CORRECT: In Next.js 15, this is a root-level property
  serverExternalPackages: ['stripe'],
  
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  }
};

export default nextConfig;
