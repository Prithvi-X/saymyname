/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ['@saymyname/contracts', '@saymyname/validation', '@saymyname/design-tokens'],
  experimental: {
    workerThreads: false,
    cpus: 1,
  },
  async rewrites() {
    const backendUrl = process.env.API_BACKEND_URL || 'https://saymyname-ri9e.onrender.com';
    return [
      {
        source: '/api/v1/:path*',
        destination: `${backendUrl}/api/v1/:path*`,
      },
    ];
  },
};

export default nextConfig;
