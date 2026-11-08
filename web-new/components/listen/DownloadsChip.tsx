'use client';

import { useState } from 'react';
import { Download } from 'lucide-react';
import { totals } from '@/lib/listen/download-model';
import { useDownloads } from '@/lib/listen/downloads-store';
import { DownloadsSheet } from '@/components/listen/DownloadsSheet';

const size = (b: number) => (b >= 1e9 ? `${(b / 1e9).toFixed(1)} GB` : `${Math.round(b / 1e6)} MB`);

/** "⬇ 3 offline · 1.2 GB" in the diary masthead; nothing when nothing is stored. */
export function DownloadsChip() {
  const manifests = useDownloads();
  const [open, setOpen] = useState(false);
  if (!manifests.length) return null;
  const t = totals(manifests);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex items-center gap-1.5 rounded-full border border-rule px-2.5 py-1 font-mono text-xs text-ink-muted transition-colors hover:border-accent-green hover:text-accent-green"
      >
        <Download className="h-3 w-3" aria-hidden />
        {t.ready} offline{t.partial ? ` · ${t.partial} partial` : ''} · {size(t.bytesStored)}
      </button>
      <DownloadsSheet open={open} onOpenChange={setOpen} manifests={manifests} />
    </>
  );
}
