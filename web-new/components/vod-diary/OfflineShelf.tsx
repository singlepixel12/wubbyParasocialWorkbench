'use client';

import { useMemo } from 'react';
import { WifiOff } from 'lucide-react';
import { useDownloads } from '@/lib/listen/downloads-store';
import { videoFromManifest } from '@/lib/offline/saved-vods';
import { VideoList } from '@/components/vod-diary/VideoList';
import { Button } from '@/components/ui/button';

/**
 * The diary with no signal: the VODs downloaded to this phone, as ordinary cards (they open
 * /watch, and Listen plays from the phone). Only finished downloads; a partial one needs signal
 * to finish, so it's counted, not listed.
 */
/**
 * `reason`: no signal at all, or a signal but the archive unreachable (lie-fi, an outage). The
 * shelf is the same; only the kicker says which, so "You're offline" is never said on Wi-Fi.
 */
export function OfflineShelf({ onRetry, reason = 'offline' }: { onRetry: () => void; reason?: 'offline' | 'unreachable' }) {
  const manifests = useDownloads();
  const { videos, partial } = useMemo(() => {
    const ready = manifests.filter((m) => m.state === 'ready').sort((a, b) => b.lastListenedAt - a.lastListenedAt);
    return { videos: ready.map(videoFromManifest), partial: manifests.length - ready.length };
  }, [manifests]);

  return (
    <section aria-labelledby="offline-shelf-title" className="space-y-5">
      <div className="space-y-2 border-y border-rule py-4">
        <p className="flex items-center gap-2 font-mono text-[0.7rem] uppercase tracking-[0.15em] text-accent-green">
          <WifiOff className="h-3.5 w-3.5" aria-hidden />
          {reason === 'offline' ? <>You&apos;re offline</> : <>Can&apos;t reach the archive</>}
        </p>
        <h2 id="offline-shelf-title" className="font-display text-2xl text-foreground">
          Saved on your phone
        </h2>
        <p className="text-sm text-ink-muted">
          {videos.length === 0
            ? 'Nothing is downloaded yet. On a VOD, tap Download to keep its audio for no-signal listening.'
            : `${videos.length} ${videos.length === 1 ? 'VOD plays' : 'VODs play'} with no signal.`}
          {partial > 0 && ` ${partial} unfinished ${partial === 1 ? 'download needs' : 'downloads need'} signal to finish.`}
        </p>
        <Button
          type="button"
          variant="outline"
          onClick={onRetry}
          className="font-mono text-[0.7rem] uppercase tracking-[0.15em] text-accent-green hover:text-foreground"
        >
          Try the archive again
        </Button>
      </div>
      {videos.length > 0 && <VideoList videos={videos} />}
    </section>
  );
}
