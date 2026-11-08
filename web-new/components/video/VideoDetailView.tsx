'use client';

/**
 * VideoDetailView — /watch. Video by default; Listen swaps the player for an audio-only card
 * that streams just the AAC runs (see lib/listen). Back navigation lives in the sticky Header.
 */

import { useEffect, useRef, useState } from 'react';
import { Tag, Calendar, FileText } from 'lucide-react';
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
import type { PlaybackRate } from '@/lib/listen/types';
import { formatDateDisplay, extractOriginalTitle } from '@/lib/utils/video-helpers';
import { SUPABASE_URL } from '@/lib/constants';

interface VideoDetailViewProps {
  video: Video;
}

const videoVariants = { initial: { opacity: 0, scale: 0.98 }, animate: { opacity: 1, scale: 1, transition: { duration: 0.3 } } };
const metadataVariants = { initial: { opacity: 0, y: 20 }, animate: { opacity: 1, y: 0, transition: { delay: 0.15, duration: 0.3 } } };

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
            <DownloadButton vod={{ hash, url: video.url, title: video.title, thumbnailUrl: video.thumbnailUrl }} />
          </div>
          <p className="font-mono text-xs text-ink-muted">Listen streams audio only · about 73 MB per hour</p>
        </div>
      )}

      <motion.div className="space-y-3 px-2 md:px-0" variants={metadataVariants} initial="initial" animate="animate">
        <div className="space-y-2">
          <h1 className="font-display text-2xl leading-tight text-foreground md:text-3xl">{video.title}</h1>
          {originalTitle && (
            <div className="flex items-center gap-2 text-sm text-ink-muted">
              <FileText className="h-4 w-4" />
              <span className="font-mono">{originalTitle}</span>
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
