/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: {
    // Don't fail the build on ESLint warnings or errors
    ignoreDuringBuilds: true,
  },
  typescript: {
    // Keep type checking to catch real issues during build
    ignoreBuildErrors: false,
  },
};

export default nextConfig;

