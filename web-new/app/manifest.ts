import type { MetadataRoute } from 'next';

// Static for `output: 'export'`. Next doesn't add the basePath inside the manifest, so it's here.
export const dynamic = 'force-static';

const BASE = process.env.NEXT_PUBLIC_BASE_PATH ?? '';

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: `${BASE}/`,
    name: 'The Wubby Archive',
    short_name: 'Wubby Archive',
    description: 'Wubby VODs: summaries, and audio you can take offline.',
    start_url: `${BASE}/`,
    scope: `${BASE}/`,
    display: 'standalone',
    orientation: 'portrait',
    background_color: '#0e0d0b',
    theme_color: '#0e0d0b',
    icons: [
      { src: `${BASE}/icons/icon-192.png`, sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: `${BASE}/icons/icon-512.png`, sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: `${BASE}/icons/maskable-512.png`, sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  };
}
