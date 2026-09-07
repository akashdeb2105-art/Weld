import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // Emit a self-contained server for the Docker image (frontend/Dockerfile
  // copies .next/standalone). `next start` is unaffected.
  output: 'standalone',
  reactStrictMode: true,
  poweredByHeader: false,
};

export default nextConfig;
