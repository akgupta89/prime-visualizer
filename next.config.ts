import type { NextConfig } from "next";

// GitHub Pages serves the app from /prime-visualizer. Local dev serves from the
// root, so the prefix is production-only.
const basePath = process.env.NODE_ENV === 'production' ? '/prime-visualizer' : '';

const nextConfig: NextConfig = {
  output: 'export',
  basePath,
  assetPrefix: basePath ? `${basePath}/` : undefined,
  // Exposed so runtime asset fetches (the font loader) can prefix their own URLs
  env: { NEXT_PUBLIC_BASE_PATH: basePath },
};

export default nextConfig;
