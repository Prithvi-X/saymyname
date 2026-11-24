/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ['@saymyname/design-tokens', '@saymyname/validation'],
  experimental: {
    workerThreads: false,
    cpus: 1,
  },
};

export default nextConfig;
