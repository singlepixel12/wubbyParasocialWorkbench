import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Get Transcript',
  description:
    'Extract and view video transcripts from Wubby stream VODs. Load subtitles, view formatted transcripts with timestamps, and navigate video content.',
  openGraph: {
    title: 'Get Transcript | The Wubby Archive',
    description:
      'Extract and view video transcripts from Wubby stream VODs with timestamps.',
    url: `${process.env.NEXT_PUBLIC_BASE_PATH ?? ''}/transcript`,
    siteName: 'The Wubby Archive',
    type: 'website',
  },
  twitter: {
    card: 'summary',
    title: 'Get Transcript | The Wubby Archive',
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
