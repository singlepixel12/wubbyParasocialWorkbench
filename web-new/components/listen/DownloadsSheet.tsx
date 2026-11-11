'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Play, RotateCw, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { progress, totals, type DownloadManifest } from '@/lib/listen/download-model';
import { onMobileData, removeDownload, resumeDownload } from '@/lib/listen/downloads';
import { useOnlineStatus } from '@/lib/hooks/useOnlineStatus';

const size = (b: number) => (b >= 1e9 ? `${(b / 1e9).toFixed(2)} GB` : `${Math.round(b / 1e6)} MB`);
const pctOf = (m: DownloadManifest) => Math.round(progress(m) * 100);
const stateLabel = (m: DownloadManifest) =>
  m.state === 'ready'
    ? 'Ready'
    : m.state === 'downloading'
      ? `Downloading ${pctOf(m)}%`
      : m.state === 'stale'
        ? 'Changed on the archive'
        : `Paused ${pctOf(m)}%`;

/** What the sheet is asking the user to confirm, if anything. Deleting loses a ~55-minute download. */
type Confirm = { hash: string; kind: 'delete' | 'cellular' } | null;
const ALL = 'all';

/**
 * The offline library: every saved VOD opens from here (it's the one list that works with no
 * signal), a paused one resumes, and deleting asks first.
 */
export function DownloadsSheet({ open, onOpenChange, manifests }: { open: boolean; onOpenChange: (o: boolean) => void; manifests: readonly DownloadManifest[] }) {
  const online = useOnlineStatus();
  const [estimate, setEstimate] = useState<{ usage?: number; quota?: number } | null>(null);
  const [confirm, setConfirm] = useState<Confirm>(null);
  const [note, setNote] = useState<{ hash: string; text: string } | null>(null);
  useEffect(() => {
    if (open) void navigator.storage?.estimate?.().then(setEstimate).catch(() => setEstimate(null));
  }, [open]);

  const close = () => onOpenChange(false);
  const resume = async (m: DownloadManifest, skipCellularCheck = false) => {
    setNote(null);
    if (!skipCellularCheck && onMobileData()) return setConfirm({ hash: m.hash, kind: 'cellular' });
    setConfirm(null);
    try {
      if (!(await resumeDownload(m))) setNote({ hash: m.hash, text: 'Open the VOD to resume it.' });
    } catch (err) {
      setNote({ hash: m.hash, text: `Couldn't resume: ${err instanceof Error ? err.message : String(err)}` });
    }
  };

  return (
    <Sheet
      open={open}
      onOpenChange={(o) => {
        if (!o) setConfirm(null);
        onOpenChange(o);
      }}
    >
      <SheetContent side="bottom" className="max-h-[80vh] overflow-y-auto border-t border-rule bg-background">
        <SheetHeader>
          <SheetTitle className="font-display text-foreground">Saved for offline</SheetTitle>
          <SheetDescription className="text-ink-muted">
            {manifests.length ? 'Tap a VOD to open it. Saved audio plays with no signal.' : 'Nothing saved yet. On a VOD, tap Download to keep its audio on your phone.'}
          </SheetDescription>
        </SheetHeader>
        <ul className="mt-2 divide-y divide-rule px-4">
          {manifests.map((m) => {
            const asking = confirm?.hash === m.hash ? confirm.kind : null;
            return (
              <li key={m.hash} className="py-3">
                <div className="flex items-center gap-3">
                  <Link href={`/watch?id=${m.hash}`} onClick={close} className="group flex min-w-0 flex-1 items-center gap-3 rounded-md">
                    <span className="relative h-10 w-16 shrink-0 overflow-hidden rounded-sm bg-black">
                      {m.thumbnailUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element -- served from the offline thumbnail cache
                        <img src={m.thumbnailUrl} alt="" className="h-full w-full object-cover grayscale transition group-hover:grayscale-0" />
                      ) : null}
                      <Play className="absolute inset-0 m-auto h-4 w-4 text-white/80" aria-hidden />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-foreground group-hover:text-accent-green">{m.title}</span>
                      <span className="block font-mono text-xs text-ink-muted">
                        {stateLabel(m)} · {size(m.bytesDone)} · listened {new Date(m.lastListenedAt).toLocaleDateString()}
                      </span>
                    </span>
                  </Link>
                  {!asking && m.state === 'paused' && (
                    <Button type="button" variant="ghost" size="icon" disabled={!online} aria-label={`Resume ${m.title}`} onClick={() => void resume(m)}>
                      <RotateCw className="h-4 w-4" />
                    </Button>
                  )}
                  {!asking && (
                    <Button type="button" variant="ghost" size="icon" aria-label={`Delete ${m.title}`} onClick={() => setConfirm({ hash: m.hash, kind: 'delete' })}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
                {asking === 'delete' && (
                  <div role="alert" className="mt-2 flex flex-wrap items-center justify-end gap-2 text-sm">
                    <span className="mr-auto text-ink-muted">Delete {size(m.bytesDone)} from your phone? Downloading it again takes a while.</span>
                    <Button type="button" size="sm" variant="ghost" onClick={() => setConfirm(null)}>
                      Keep
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="destructive"
                      onClick={() => {
                        setConfirm(null);
                        void removeDownload(m.hash);
                      }}
                    >
                      Delete
                    </Button>
                  </div>
                )}
                {asking === 'cellular' && (
                  <div role="alert" className="mt-2 flex flex-wrap items-center justify-end gap-2 text-sm">
                    <span className="mr-auto text-ink-muted">You&apos;re on mobile data. About {size(m.bytesTotal - m.bytesDone)} left.</span>
                    <Button type="button" size="sm" variant="ghost" onClick={() => setConfirm(null)}>
                      Not now
                    </Button>
                    <Button type="button" size="sm" onClick={() => void resume(m, true)}>
                      Resume anyway
                    </Button>
                  </div>
                )}
                {note?.hash === m.hash && <p className="mt-1 font-mono text-xs text-ink-muted">{note.text}</p>}
              </li>
            );
          })}
        </ul>
        {manifests.length > 1 && (
          <div className="px-4">
            {confirm?.hash === ALL ? (
              <div role="alert" className="mt-3 space-y-2 text-sm">
                <p className="text-ink-muted">
                  Delete all {manifests.length} downloads ({size(totals(manifests).bytesStored)})? This can&apos;t be undone.
                </p>
                <div className="flex gap-2">
                  <Button type="button" variant="ghost" className="flex-1" onClick={() => setConfirm(null)}>
                    Keep them
                  </Button>
                  <Button
                    type="button"
                    variant="destructive"
                    className="flex-1"
                    onClick={async () => {
                      setConfirm(null);
                      for (const m of manifests) await removeDownload(m.hash);
                    }}
                  >
                    Delete all
                  </Button>
                </div>
              </div>
            ) : (
              <Button type="button" variant="outline" className="mt-3 w-full" onClick={() => setConfirm({ hash: ALL, kind: 'delete' })}>
                Delete all
              </Button>
            )}
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
