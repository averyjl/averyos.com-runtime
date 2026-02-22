/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  trailingSlash: true,
  basePath: '',
  eslint: {
    ignoreDuringBuilds: true,
  },
  images: {
    domains: ['averyos.com', 'averyjl.github.io'],
  },
};

export default nextConfig;
