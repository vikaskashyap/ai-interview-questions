/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // pdf-parse / mammoth are server-only; keep them external to the bundle
  experimental: {
    serverComponentsExternalPackages: ["pdf-parse", "mammoth"],
  },
};

module.exports = nextConfig;
