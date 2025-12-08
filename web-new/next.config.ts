import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: 'export', // Required for static GitHub Pages deployment
  basePath: process.env.NODE_ENV === 'production' ? '/wubbyParasocialWorkbench' : '', // Only use basePath in production
  images: {
    unoptimized: true, // Required for static export
  },
  // React Compiler for automatic memoization (Next.js 16)
  reactCompiler: true,
  // Silence turbopack root warning for monorepo structure
  turbopack: {
    root: __dirname,
  },
};

export default nextConfig;
