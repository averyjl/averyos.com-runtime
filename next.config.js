// next.config.js

const nextConfig = {
  reactStrictMode: true,
  trailingSlash: true,
  basePath: '',
  eslint: {
    // Disable linting during builds to avoid circular structure error
    ignoreDuringBuilds: true,
  },
  images: {
    domains: ['averyos.com', 'averyjl.github.io'],
  },
};

module.exports = nextConfig;
