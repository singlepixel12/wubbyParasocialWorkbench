'use client';

import { useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { VideoDetailView } from '@/components/video/VideoDetailView';
import { getWubbySummaryByHash, isNetworkError } from '@/lib/api/supabase';
import { Button } from '@/components/ui/button';
import type { Video } from '@/types/video';
import { savedVideo } from '@/lib/offline/saved-vods';
import { rememberVodDetails } from '@/lib/listen/downloads';

/**
 * Watch Page - Full video detail view (Two-Tier UX)
 * Shows complete AI summary, all tags, chapters, and related videos
 * This is the "read later" destination from scannable browse cards
 * Uses query parameter: /watch?id=video_hash
 * Client component for GitHub Pages static export compatibility
 */
export default function WatchPage() {
  const searchParams = useSearchParams();
  const id = searchParams.get('id');
  const [video, setVideo] = useState<Video | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<{ kind: 'not-found' | 'network' | 'offline'; message: string } | null>(null);
  // Bumped by Retry to run the load again (the API already retried a few times by then).
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;

    async function fetchVideo() {
      if (!id) {
        setError({ kind: 'not-found', message: 'No video ID provided' });
        setLoading(false);
        return;
      }

      setLoading(true);
      setError(null);
      // A downloaded VOD shows at once from what's saved on the phone, signal or not. The API
      // still runs, but only to refresh the saved copy: the page never swaps the video under you.
      const saved = await savedVideo(id);
      if (cancelled) return;
      if (saved) {
        setVideo(saved);
        setLoading(false);
      } else if (typeof navigator !== 'undefined' && navigator.onLine === false) {
        // The API would wait for a connection forever; say so instead of "Loading".
        setError({ kind: 'offline', message: "This VOD isn't saved on your phone. Downloaded VODs open with no signal." });
        setLoading(false);
        return;
      }

      try {
        const videoData = await getWubbySummaryByHash(id);
        if (cancelled) return;
        if (videoData) void rememberVodDetails(videoData);
        if (saved) return;
        if (!videoData) {
          setError({ kind: 'not-found', message: 'Video not found' });
        } else {
          setVideo(videoData);
        }
      } catch (err) {
        if (cancelled || saved) return;
        // A flaky connection is not a missing video: say so, and offer Retry.
        setError(
          isNetworkError(err)
            ? { kind: 'network', message: "Couldn't reach the archive. Check your connection and try again." }
            : { kind: 'not-found', message: 'Failed to load video' },
        );
        console.error(err);
      } finally {
        if (!cancelled && !saved) setLoading(false);
      }
    }

    fetchVideo();
    return () => {
      cancelled = true;
    };
  }, [id, attempt]);

  // Offline, or the archive unreachable: try again by itself when the signal comes back, the way
  // the diary does, instead of waiting for a Retry tap.
  const waitingForNetwork = error?.kind === 'offline' || error?.kind === 'network';
  useEffect(() => {
    if (!waitingForNetwork) return;
    const again = () => setAttempt((n) => n + 1);
    window.addEventListener('online', again);
    return () => window.removeEventListener('online', again);
  }, [waitingForNetwork]);

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-muted-foreground">Loading video...</div>
      </div>
    );
  }

  if (error?.kind === 'network' || error?.kind === 'offline') {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="space-y-4 text-center">
          <h1 className="font-display text-2xl md:text-3xl text-foreground">{error.kind === 'offline' ? "You're offline" : 'Connection problem'}</h1>
          <p className="text-muted-foreground">{error.message}</p>
          {error.kind === 'offline' ? <p className="text-sm text-ink-muted">It opens by itself when you&apos;re back online.</p> : null}
          <Button type="button" onClick={() => setAttempt((n) => n + 1)}>
            Retry
          </Button>
        </div>
      </div>
    );
  }

  if (error || !video) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <h1 className="font-display text-2xl md:text-3xl text-foreground mb-2">Video Not Found</h1>
          <p className="text-muted-foreground">{error?.message || 'The requested video could not be found.'}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Video Player Section */}
      <div className="w-full bg-black">
        <div className="max-w-7xl mx-auto">
          <VideoDetailView video={video} />
        </div>
      </div>
    </div>
  );
}
