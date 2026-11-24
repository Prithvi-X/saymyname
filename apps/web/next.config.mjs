/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ['@saymyname/contracts', '@saymyname/validation', '@saymyname/design-tokens'],
  experimental: {
    workerThreads: false,
    cpus: 1,
  },
};

export default nextConfig;
