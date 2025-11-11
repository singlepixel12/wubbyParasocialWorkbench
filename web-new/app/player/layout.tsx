import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Video Player',
  description:
    'Watch Wubby VODs with subtitle support. Full-featured video player with playback controls, subtitle tracks, and metadata display.',
  openGraph: {
    title: 'Video Player | Wubby Parasocial Workbench',
    description:
      'Watch Wubby VODs with subtitle support and full playback controls.',
    url: 'https://your-domain.com/player',
    siteName: 'Wubby Parasocial Workbench',
    type: 'website',
  },
  twitter: {
    card: 'summary',
    title: 'Video Player | Wubby Parasocial Workbench',
    description:
      'Watch Wubby VODs with subtitle support and full playback controls.',
  },
};

export default function PlayerLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
