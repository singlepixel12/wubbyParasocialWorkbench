import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: 'export', // Required for static GitHub Pages deployment
  basePath: process.env.NODE_ENV === 'production' ? '/wubbyParasocialWorkbench' : '', // Only use basePath in production
  images: {
    unoptimized: true, // Required for static export
  },
  // turbopack config removed for Next.js 15 compatibility
};

export default nextConfig;
