import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Get Transcript',
  description:
    'Extract and view video transcripts from Wubby stream VODs. Load subtitles, view formatted transcripts with timestamps, and navigate video content.',
  openGraph: {
    title: 'Get Transcript | Wubby Parasocial Workbench',
    description:
      'Extract and view video transcripts from Wubby stream VODs with timestamps.',
    url: 'https://your-domain.com/transcript',
    siteName: 'Wubby Parasocial Workbench',
    type: 'website',
  },
  twitter: {
    card: 'summary',
    title: 'Get Transcript | Wubby Parasocial Workbench',
    description:
      'Extract and view video transcripts from Wubby stream VODs with timestamps.',
  },
};

export default function TranscriptLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
