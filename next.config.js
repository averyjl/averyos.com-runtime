/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    // This tells Next.js to treat stripe as an external package
    serverExternalPackages: ['stripe'],
  },
};

export default nextConfig;
