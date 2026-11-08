'use client';

import { useEffect, useState } from 'react';
import { Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { progress, type DownloadManifest } from '@/lib/listen/download-model';
import { deleteDownload } from '@/lib/listen/offline-store';

const size = (b: number) => (b >= 1e9 ? `${(b / 1e9).toFixed(2)} GB` : `${Math.round(b / 1e6)} MB`);
const stateLabel = (m: DownloadManifest) =>
  m.state === 'ready'
    ? 'Ready'
    : m.state === 'downloading'
      ? `Downloading ${Math.round(progress(m) * 100)}%`
      : m.state === 'stale'
        ? 'Changed on the archive'
        : `Paused ${Math.round(progress(m) * 100)}%`;

export function DownloadsSheet({ open, onOpenChange, manifests }: { open: boolean; onOpenChange: (o: boolean) => void; manifests: readonly DownloadManifest[] }) {
  const [estimate, setEstimate] = useState<{ usage?: number; quota?: number } | null>(null);
  useEffect(() => {
    if (open) void navigator.storage?.estimate?.().then(setEstimate).catch(() => setEstimate(null));
  }, [open]);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="max-h-[80vh] overflow-y-auto border-t border-rule bg-background">
        <SheetHeader>
          <SheetTitle className="font-display text-foreground">Saved for offline</SheetTitle>
        </SheetHeader>
        <ul className="mt-4 divide-y divide-rule px-4">
          {manifests.map((m) => (
            <li key={m.hash} className="flex items-center gap-3 py-3">
              <div className="min-w-0 flex-1">
                <p className="truncate text-foreground">{m.title}</p>
                <p className="font-mono text-xs text-ink-muted">
                  {stateLabel(m)} · {size(m.bytesDone)} · listened {new Date(m.lastListenedAt).toLocaleDateString()}
                </p>
              </div>
              <Button type="button" variant="ghost" size="icon" aria-label={`Delete ${m.title}`} onClick={() => void deleteDownload(m.hash)}>
                <Trash2 className="h-4 w-4" />
              </Button>
            </li>
          ))}
        </ul>
        {manifests.length > 1 && (
          <div className="px-4">
            <Button
              type="button"
              variant="outline"
              className="mt-3 w-full"
              onClick={async () => {
                for (const m of manifests) await deleteDownload(m.hash);
              }}
            >
              Delete all
            </Button>
          </div>
        )}
        {estimate?.quota ? (
          <p className="mt-4 px-4 pb-4 font-mono text-xs text-ink-muted">
            This site uses {size(estimate.usage ?? 0)} of {size(estimate.quota)} available.
          </p>
        ) : null}
      </SheetContent>
    </Sheet>
  );
}
