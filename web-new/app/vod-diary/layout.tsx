import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'VOD Diary',
  description:
    'Browse and filter Wubby VODs by platform, date range, and search terms. View video cards with summaries, tags, and quick links to player.',
  openGraph: {
    title: 'VOD Diary | Wubby Parasocial Workbench',
    description:
      'Browse and filter Wubby VODs by platform (Twitch/Kick), date range, and search terms.',
    url: 'https://your-domain.com/vod-diary',
    siteName: 'Wubby Parasocial Workbench',
    type: 'website',
  },
  twitter: {
    card: 'summary',
    title: 'VOD Diary | Wubby Parasocial Workbench',
    description:
      'Browse and filter Wubby VODs by platform, date range, and search terms.',
  },
};

export default function VodDiaryLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
