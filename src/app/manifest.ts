import type { MetadataRoute } from 'next';

// A .ts manifest (rather than a static .json) so the icon paths can carry the
// production basePath — on GitHub Pages the app is served from a subdirectory.
const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? '';

export const dynamic = 'force-static';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Prime Visualizer',
    short_name: 'Prime Visualizer',
    description: 'Interactive 3D visualization of prime numbers arranged in a spiral.',
    start_url: `${basePath}/`,
    display: 'standalone',
    theme_color: '#050810',
    background_color: '#050810',
    icons: [
      {
        src: `${basePath}/web-app-manifest-192x192.png`,
        sizes: '192x192',
        type: 'image/png',
        purpose: 'maskable',
      },
      {
        src: `${basePath}/web-app-manifest-512x512.png`,
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
    ],
  };
}
