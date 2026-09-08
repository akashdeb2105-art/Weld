import type { NextConfig } from 'next';

// `output: 'standalone'` emits a self-contained server that frontend/Dockerfile
// copies from .next/standalone. It is ONLY wanted for the Docker image: with it
// set, `next start` warns ("does not work with output: standalone") and
// Netlify's Next runtime (@netlify/plugin-nextjs) expects the default output.
// So gate it on an explicit build-time flag the Dockerfile sets.
const isDockerBuild = process.env.DOCKER_BUILD === 'true';

const nextConfig: NextConfig = {
  ...(isDockerBuild ? { output: 'standalone' as const } : {}),
  reactStrictMode: true,
  poweredByHeader: false,
};

export default nextConfig;
