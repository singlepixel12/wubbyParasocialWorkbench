import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: 'export', // Required for static GitHub Pages deployment
  basePath: '/wubbyParasocialWorkbench', // Match your repo name
  images: {
    unoptimized: true, // Required for static export
  },
  turbopack: {
    root: __dirname,
  },
};

export default nextConfig;
