/** @type {import('next').NextConfig} */
const nextConfig = {
  // Promotion: serverExternalPackages is now a root property in Next.js 15
  serverExternalPackages: ['stripe'],
  
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  }
};

export default nextConfig;
