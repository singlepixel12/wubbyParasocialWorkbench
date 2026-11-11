'use client';

/**
 * VideoDetailView — /watch. Video by default; Listen swaps the player for an audio-only card
 * that streams just the AAC runs (see lib/listen). Back navigation lives in the sticky Header.
 * Offline, the video can't play (it streams from the archive, and the player itself loads from a
 * CDN), so a poster that says so stands in for it and Listen leads.
 */

import { useEffect, useRef, useState } from 'react';
import { Tag, Calendar, FileText, WifiOff } from 'lucide-react';
import { motion } from 'framer-motion';
import { Video } from '@/types/video';
import { Badge } from '@/components/ui/badge';
import { VidstackPlayer } from '@/components/video/VidstackPlayer';
import { AudioCard } from '@/components/listen/AudioCard';
import { ListenButton } from '@/components/listen/ListenButton';
import { SpeedToggle } from '@/components/listen/SpeedToggle';
import { DownloadButton } from '@/components/listen/DownloadButton';
import { ListenEngine } from '@/lib/listen/listen-engine';
import { formatClock, isFinished, readPosition, readRate, resumeTime, writePosition, writeRate } from '@/lib/listen/positions';
import { useSavedPosition } from '@/lib/listen/useSavedPosition';
import { useDownloads } from '@/lib/listen/downloads-store';
import { progress, type DownloadManifest } from '@/lib/listen/download-model';
import { useOnlineStatus } from '@/lib/hooks/useOnlineStatus';
import type { PlaybackRate } from '@/lib/listen/types';
import { formatDateDisplay, extractOriginalTitle } from '@/lib/utils/video-helpers';
import { SUPABASE_URL } from '@/lib/constants';

interface VideoDetailViewProps {
  video: Video;
}

const videoVariants = { initial: { opacity: 0, scale: 0.98 }, animate: { opacity: 1, scale: 1, transition: { duration: 0.3 } } };
const metadataVariants = { initial: { opacity: 0, y: 20 }, animate: { opacity: 1, y: 0, transition: { delay: 0.15, duration: 0.3 } } };

/** The line under Listen: what Listen will cost, given what's saved on the phone. */
function listenCaption(download: DownloadManifest | undefined, online: boolean): string {
  if (download?.state === 'ready') return 'Saved on your phone · Listen uses no data';
  const pct = download ? Math.round(progress(download) * 100) : 0;
  if (!online) return pct > 0 ? `${pct}% saved on your phone · the rest needs a connection` : 'Listen needs a connection';
  return pct > 0 ? `${pct}% saved on your phone · the rest streams at about 73 MB per hour` : 'Listen streams audio only · about 73 MB per hour';
}

/** Stands in for the player offline: the poster, and what does work. */
function OfflinePoster({ poster, saved }: { poster?: string; saved: boolean }) {
  return (
    <div className="relative aspect-video w-full overflow-hidden bg-black" role="img" aria-label="Video needs a connection">
      {poster ? (
        // eslint-disable-next-line @next/next/no-img-element -- served from the offline thumbnail cache, not next/image
        <img src={poster} alt="" className="absolute inset-0 h-full w-full object-cover opacity-40 grayscale" />
      ) : null}
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-gradient-to-t from-black/80 via-black/40 to-black/10 px-6 text-center">
        <WifiOff className="h-6 w-6 text-ink-muted" aria-hidden />
        <p className="font-mono text-[0.65rem] uppercase tracking-[0.25em] text-ink-muted">Offline</p>
        <p className="font-display text-lg text-foreground md:text-xl">Video needs a connection</p>
        {saved ? <p className="text-sm text-foreground/70">The audio is on your phone. Listen plays with no signal.</p> : null}
      </div>
    </div>
  );
}

export function VideoDetailView({ video }: VideoDetailViewProps) {
  const hash = video.videoHash;
  const formattedDate = video.date ? formatDateDisplay(new Date(video.date)) : '';
  const originalTitle = extractOriginalTitle(video.url);
  const subtitleUrl = hash ? `${SUPABASE_URL}/storage/v1/object/public/wubbytranscript/${hash}/en/subtitle.vtt` : undefined;

  const [rate, setRate] = useState<PlaybackRate>(() => readRate());
  const [engine, setEngine] = useState<ListenEngine | null>(null);
  const [videoStart, setVideoStart] = useState(() => (hash ? resumeTime(readPosition(hash)) : 0));
  // The video downloads nothing until tapped; Watch pressed in Listen is that tap, so play at once.
  const [videoAutoPlay, setVideoAutoPlay] = useState(false);
  const videoTime = useRef({ t: 0, d: 0 });
  const lastVideoSave = useRef(0);
  const saved = useSavedPosition(hash);
  const online = useOnlineStatus();
  const download = useDownloads().find((m) => m.hash === hash);
  // A video already playing keeps its player if the signal drops (it may have buffered ahead);
  // only a player that never started gives way to the offline poster.
  const [videoStarted, setVideoStarted] = useState(false);

  // Disposing on change/unmount stops all audio fetching when leaving Listen or the page.
  useEffect(() => () => engine?.dispose(), [engine]);

  const changeRate = (next: PlaybackRate) => {
    setRate(next);
    writeRate(next);
  };

  const onVideoTime = (t: number, d: number, paused: boolean) => {
    // A paused video sitting at its initial ~0.1 s is not "where you got to": only trust the
    // video's time once it has actually played, or been moved past the first few seconds.
    if (paused && t < 5) return;
    if (!paused && !videoStarted) setVideoStarted(true);
    videoTime.current = { t, d };
    const now = Date.now();
    if (hash && now - lastVideoSave.current >= 5000) {
      lastVideoSave.current = now;
      writePosition(hash, t, d);
    }
  };

  const startListening = () => {
    if (!hash) return;
    const fromVideo = videoTime.current.t;
    if (fromVideo > 0) writePosition(hash, fromVideo, videoTime.current.d);
    const e = new ListenEngine({
      url: video.url,
      hash,
      title: video.title,
      artworkUrl: video.thumbnailUrl,
      startAt: fromVideo > 0 ? fromVideo : resumeTime(readPosition(hash)),
      rate,
    });
    e.play(); // inside the tap, so Chrome allows audio
    void e.start();
    setEngine(e);
  };

  const backToWatch = (atSec: number) => {
    videoTime.current = { t: 0, d: 0 };
    setVideoStart(atSec);
    setVideoAutoPlay(true);
    setEngine(null);
  };

  const resumeLabel = saved && !isFinished(saved) ? formatClock(saved.t) : undefined;

  return (
    <div className="space-y-4 px-0 py-4 md:space-y-6 md:px-4 md:py-6">
      <motion.div className="w-full" variants={videoVariants} initial="initial" animate="animate">
        {engine && hash ? (
          <AudioCard engine={engine} hash={hash} thumbnailUrl={video.thumbnailUrl} onWatch={backToWatch} onRateChange={changeRate} />
        ) : !online && !videoStarted ? (
          <OfflinePoster poster={video.thumbnailUrl} saved={download?.state === 'ready'} />
        ) : (
          <VidstackPlayer
            videoUrl={video.url}
            subtitleUrl={subtitleUrl}
            poster={video.thumbnailUrl}
            title={video.title}
            startTime={videoStart}
            playbackRate={rate}
            onTimeUpdate={onVideoTime}
            autoPlay={videoAutoPlay}
          />
        )}
      </motion.div>

      {!engine && hash && (
        <div className="space-y-2 px-2 md:px-0">
          <ListenButton onClick={startListening} resumeLabel={resumeLabel} />
          <div className="grid grid-cols-2 gap-2">
            <SpeedToggle rate={rate} onChange={changeRate} className="w-full" />
            <DownloadButton vod={{ hash, url: video.url, title: video.title, thumbnailUrl: video.thumbnailUrl, video }} />
          </div>
          <p className="font-mono text-xs text-ink-muted">{listenCaption(download, online)}</p>
        </div>
      )}

      <motion.div className="space-y-3 px-2 md:px-0" variants={metadataVariants} initial="initial" animate="animate">
        <div className="space-y-2">
          <h1 className="font-display text-2xl leading-tight text-foreground md:text-3xl">{video.title}</h1>
          {originalTitle && (
            <div className="flex min-w-0 items-start gap-2 text-sm text-ink-muted">
              <FileText className="mt-0.5 h-4 w-4 shrink-0" />
              {/* Archive filenames can be one unbroken token: wrap anywhere rather than widen the page. */}
              <span className="min-w-0 break-all font-mono">{originalTitle}</span>
            </div>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-4 text-sm text-ink-muted">
          {formattedDate && (
            <div className="flex items-center gap-1.5">
              <Calendar className="h-4 w-4" />
              <span>{formattedDate}</span>
            </div>
          )}
        </div>
      </motion.div>

      <div className="mx-2 h-px bg-rule md:mx-0" />

      <motion.div className="px-2 md:px-0" variants={metadataVariants} initial="initial" animate="animate">
        <div className="border-l-2 border-accent-green/50 pl-4 md:pl-5">
          <p className="whitespace-pre-line leading-relaxed text-foreground/80">{video.summary || 'No summary available for this video.'}</p>
        </div>
      </motion.div>

      {video.tags && video.tags.length > 0 && (
        <motion.div className="space-y-3 px-2 md:px-0" variants={metadataVariants} initial="initial" animate="animate">
          <h3 className="font-mono text-[0.65rem] font-medium uppercase tracking-[0.25em] text-ink-muted">Topics &amp; Tags</h3>
          <div className="flex flex-wrap gap-2">
            {video.tags
              .filter((tag) => tag !== video.platform)
              .map((tag, index) => (
                <Badge key={index} variant="tag" className="cursor-default transition-colors hover:border-accent-green hover:bg-accent-green hover:text-white">
                  <Tag className="mr-1 h-3 w-3" />
                  {tag}
                </Badge>
              ))}
          </div>
        </motion.div>
      )}
    </div>
  );
}
