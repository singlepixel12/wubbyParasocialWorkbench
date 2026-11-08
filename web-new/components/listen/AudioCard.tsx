'use client';

import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { Headphones, Pause, Play, RotateCcw, RotateCw, Video } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { SpeedToggle } from '@/components/listen/SpeedToggle';
import type { ListenEngine, ListenSnapshot } from '@/lib/listen/listen-engine';
import { formatClock, writePosition } from '@/lib/listen/positions';
import type { PlaybackRate } from '@/lib/listen/types';

const mb = (bytes: number) => (bytes / 1e6).toFixed(1);

function statusLine(s: ListenSnapshot): string {
  if (s.phase === 'preparing') return s.prepare ? `Preparing audio · ${mb(s.prepare.loaded)} / ${mb(s.prepare.total)} MB` : 'Preparing audio…';
  if (s.phase === 'error') return s.errorMessage ?? 'Listen stopped.';
  if (s.phase === 'stalled') return "Can't reach the archive.";
  if (s.reconnecting) return 'Reconnecting…';
  if (s.waiting) return 'Buffering…';
  return `Streaming · ${mb(s.bytesFetched)} MB used`;
}

export interface AudioCardProps {
  engine: ListenEngine;
  hash: string;
  thumbnailUrl?: string;
  onWatch: (atSec: number) => void;
  onRateChange: (rate: PlaybackRate) => void;
}

export function AudioCard({ engine, hash, thumbnailUrl, onWatch, onRateChange }: AudioCardProps) {
  const s = useSyncExternalStore(engine.subscribe, engine.getSnapshot, engine.getSnapshot);
  const [drag, setDrag] = useState<number | null>(null);
  const pointerDown = useRef(false);

  // Save the position every 5 s while playing, and whenever the page is hidden or playback pauses.
  useEffect(() => {
    let last = 0;
    const save = () => {
      const snap = engine.getSnapshot();
      writePosition(hash, snap.currentTime, snap.duration);
    };
    const unsubscribe = engine.subscribe(() => {
      const now = Date.now();
      if (now - last >= 5000) {
        last = now;
        save();
      }
    });
    window.addEventListener('pagehide', save);
    document.addEventListener('visibilitychange', save);
    engine.audio.addEventListener('pause', save);
    return () => {
      save();
      unsubscribe();
      window.removeEventListener('pagehide', save);
      document.removeEventListener('visibilitychange', save);
      engine.audio.removeEventListener('pause', save);
    };
  }, [engine, hash]);

  const shown = drag ?? s.currentTime;
  const commit = (value: number) => {
    engine.seekTo(value);
    setDrag(null);
  };
  const canRetry = s.phase === 'stalled' || s.phase === 'error';

  return (
    <section aria-label="Listening" className="space-y-5 border-y border-rule bg-background px-4 py-6">
      <div className="flex items-center gap-4">
        {thumbnailUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- static export, images unoptimized
          <img src={thumbnailUrl} alt="" className="h-16 w-28 rounded object-cover grayscale" />
        ) : (
          <div className="flex h-16 w-28 items-center justify-center rounded bg-muted">
            <Headphones className="h-6 w-6 text-ink-muted" aria-hidden />
          </div>
        )}
        <p className="font-mono text-xs uppercase tracking-[0.2em] text-accent-green">Audio only</p>
      </div>

      <div>
        <input
          type="range"
          aria-label="Seek"
          min={0}
          max={Math.max(1, Math.floor(s.duration))}
          step={1}
          value={Math.floor(shown)}
          disabled={s.duration === 0}
          onPointerDown={() => {
            pointerDown.current = true;
          }}
          onPointerUp={(e) => {
            pointerDown.current = false;
            commit(Number(e.currentTarget.value));
          }}
          onChange={(e) => {
            const value = Number(e.currentTarget.value);
            setDrag(value);
            if (!pointerDown.current) commit(value);
          }}
          className="h-8 w-full accent-[hsl(var(--accent-green))]"
        />
        <div className="flex justify-between font-mono text-xs text-ink-muted">
          <span>{formatClock(shown)}</span>
          <span>{formatClock(s.duration)}</span>
        </div>
      </div>

      <div className="flex items-center justify-center gap-8">
        <Button type="button" variant="ghost" size="icon" className="h-14 w-14" aria-label="Back 30 seconds" onClick={() => engine.seekBy(-30)}>
          <RotateCcw className="h-7 w-7" />
        </Button>
        <Button
          type="button"
          size="icon"
          className="h-16 w-16 rounded-full bg-accent-green text-white hover:bg-accent-green/90"
          aria-label={s.playing ? 'Pause' : 'Play'}
          onClick={() => engine.toggle()}
        >
          {s.playing ? <Pause className="h-7 w-7" /> : <Play className="h-7 w-7" />}
        </Button>
        <Button type="button" variant="ghost" size="icon" className="h-14 w-14" aria-label="Forward 30 seconds" onClick={() => engine.seekBy(30)}>
          <RotateCw className="h-7 w-7" />
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <SpeedToggle
          rate={s.rate}
          onChange={(rate) => {
            engine.setRate(rate);
            onRateChange(rate);
          }}
        />
        <Button type="button" variant="outline" className="h-12 gap-2 text-base" onClick={() => onWatch(engine.getSnapshot().currentTime)}>
          <Video className="h-4 w-4" aria-hidden />
          Watch
        </Button>
      </div>

      <div className="flex items-center justify-between gap-3" role="status" aria-live="polite">
        <p className={s.phase === 'error' ? 'text-sm text-destructive' : 'font-mono text-xs text-ink-muted'}>{statusLine(s)}</p>
        {canRetry ? (
          <Button type="button" variant="outline" size="sm" onClick={() => engine.retry()}>
            Retry
          </Button>
        ) : null}
      </div>
    </section>
  );
}
