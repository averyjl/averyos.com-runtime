/** @type {import('next').NextConfig} */
const nextConfig = {
  // Move this OUT of experimental for Next.js 15+
  serverExternalPackages: ['stripe'], 
  
  // Keep your other settings here
  experimental: {
    // serverExternalPackages should NOT be here anymore
  }
};

export default nextConfig;
