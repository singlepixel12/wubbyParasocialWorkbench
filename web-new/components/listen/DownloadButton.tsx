'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { CheckCircle2, Download, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { backgroundFetchSupported } from '@/lib/listen/background-fetch';
import { cancelDownload, onMobileData, preflight, removeDownload, startDownload, watchProgress, type VodRef } from '@/lib/listen/downloads';
import { progress } from '@/lib/listen/download-model';
import { useDownloads } from '@/lib/listen/downloads-store';
import { getCachedIndex, putCachedIndex } from '@/lib/listen/index-cache';
import { loadAudioIndex } from '@/lib/listen/index-loader';

const gb = (b: number) => (b >= 1e9 ? `${(b / 1e9).toFixed(1)} GB` : `${Math.round(b / 1e6)} MB`);

type Prompt = { kind: 'cellular' } | { kind: 'cap'; suggest: string[] } | { kind: 'space' } | { kind: 'error'; message: string } | null;

export function DownloadButton({ vod }: { vod: VodRef }) {
  const manifests = useDownloads();
  const mine = manifests.find((m) => m.hash === vod.hash);
  const [busy, setBusy] = useState(false);
  const [prompt, setPrompt] = useState<Prompt>(null);
  const [live, setLive] = useState<number | null>(null);

  // Chrome reports byte progress live while the page is open; the manifest only moves at the end
  // of a round. Polled (see watchProgress).
  useEffect(() => {
    if (mine?.state !== 'downloading') return;
    return watchProgress(vod.hash, (done, total) => setLive(total ? Math.min(1, done / total) : null));
  }, [mine?.state, vod.hash]);

  if (!backgroundFetchSupported()) return null;

  const begin = async (skipCellularCheck = false) => {
    setPrompt(null);
    if (!skipCellularCheck && onMobileData()) return setPrompt({ kind: 'cellular' });
    setBusy(true);
    try {
      let index = await getCachedIndex(vod.hash);
      if (!index) {
        index = await loadAudioIndex(vod.url);
        await putCachedIndex(vod.hash, index);
      }
      const pre = await preflight(vod.hash, index);
      if (!pre.quotaOk) return setPrompt({ kind: 'space' });
      if (!pre.cap.fits) return setPrompt({ kind: 'cap', suggest: pre.cap.suggest });
      await startDownload(vod, index, Date.now(), { manual: true });
    } catch (err) {
      setPrompt({ kind: 'error', message: err instanceof Error ? err.message : String(err) });
    } finally {
      setBusy(false);
    }
  };

  const pct = Math.round(100 * (live ?? (mine ? progress(mine) : 0)));

  let control: ReactNode;
  if (mine?.state === 'ready') {
    control = (
      <p className="flex h-12 items-center justify-center gap-2 rounded-md border border-accent-green/50 text-sm text-accent-green">
        <CheckCircle2 className="h-4 w-4" aria-hidden />
        Saved offline
      </p>
    );
  } else if (mine?.state === 'downloading') {
    control = (
      <div className="flex h-12 items-center gap-2 rounded-md border border-rule px-3">
        <div className="h-1.5 flex-1 rounded bg-muted" aria-hidden>
          <div className="h-1.5 rounded bg-accent-green" style={{ width: `${pct}%` }} />
        </div>
        <span className="font-mono text-xs text-ink-muted" aria-label={`Downloading ${pct}%`}>{pct}%</span>
        <Button type="button" variant="ghost" size="icon" aria-label="Cancel download" onClick={() => void cancelDownload(vod.hash)}>
          <X className="h-4 w-4" />
        </Button>
      </div>
    );
  } else {
    // Short visible labels: this sits in half the width of a 375 px phone.
    const paused = mine?.state === 'paused';
    const label = paused ? `Resume · ${pct}%` : 'Download';
    control = (
      <Button
        type="button"
        variant="outline"
        disabled={busy}
        aria-label={busy ? 'Preparing download' : paused ? `Resume download, ${pct}% saved` : 'Download for offline'}
        className="h-12 w-full gap-2 text-base"
        onClick={() => void begin()}
      >
        <Download className="h-4 w-4" aria-hidden />
        {busy ? 'Preparing…' : label}
      </Button>
    );
  }

  return (
    <div className="space-y-2">
      {control}
      {mine?.state === 'paused' && mine.reason ? <p className="font-mono text-xs text-ink-muted">Paused: {mine.reason}</p> : null}
      {prompt?.kind === 'cellular' && (
        <div role="alert" className="space-y-2 rounded-md border border-rule p-3 text-sm">
          <p>You&apos;re on mobile data. A long VOD is around 400 MB. Download anyway?</p>
          <div className="flex gap-2">
            <Button type="button" size="sm" onClick={() => void begin(true)}>Download anyway</Button>
            <Button type="button" size="sm" variant="ghost" onClick={() => setPrompt(null)}>Not now</Button>
          </div>
        </div>
      )}
      {prompt?.kind === 'cap' && (
        <div role="alert" className="space-y-2 rounded-md border border-rule p-3 text-sm">
          <p>Downloads are capped at 2 GB. Delete these first (least recently listened)?</p>
          <ul className="list-disc pl-5 text-ink-muted">
            {prompt.suggest.map((h) => {
              const m = manifests.find((x) => x.hash === h);
              return <li key={h}>{m?.title ?? h} · {gb(m?.bytesDone ?? 0)}</li>;
            })}
          </ul>
          <div className="flex gap-2">
            <Button
              type="button"
              size="sm"
              onClick={async () => {
                for (const h of prompt.suggest) await removeDownload(h);
                await begin(true);
              }}
            >
              Delete and download
            </Button>
            <Button type="button" size="sm" variant="ghost" onClick={() => setPrompt(null)}>Cancel</Button>
          </div>
        </div>
      )}
      {prompt?.kind === 'space' && <p role="alert" className="text-sm text-destructive">Not enough free space on this phone for this download.</p>}
      {prompt?.kind === 'error' && <p role="alert" className="text-sm text-destructive">Couldn&apos;t start the download: {prompt.message}</p>}
    </div>
  );
}
