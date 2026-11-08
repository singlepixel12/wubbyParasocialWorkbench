import type { NextConfig } from "next";

const basePath = process.env.NODE_ENV === 'production' ? '/wubbyParasocialWorkbench' : '';

const nextConfig: NextConfig = {
  output: 'export', // Required for static GitHub Pages deployment
  basePath, // Only use basePath in production
  env: { NEXT_PUBLIC_BASE_PATH: basePath }, // the service worker URL and scope need it
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
