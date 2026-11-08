'use client';

import { useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { VideoDetailView } from '@/components/video/VideoDetailView';
import { getWubbySummaryByHash, isNetworkError } from '@/lib/api/supabase';
import { Button } from '@/components/ui/button';
import type { Video } from '@/types/video';

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
  const [error, setError] = useState<{ kind: 'not-found' | 'network'; message: string } | null>(null);
  // Bumped by Retry to run the load again (the API already retried a few times by then).
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    async function fetchVideo() {
      if (!id) {
        setError({ kind: 'not-found', message: 'No video ID provided' });
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setError(null);
        const videoData = await getWubbySummaryByHash(id);
        if (!videoData) {
          setError({ kind: 'not-found', message: 'Video not found' });
        } else {
          setVideo(videoData);
        }
      } catch (err) {
        // A flaky connection is not a missing video: say so, and offer Retry.
        setError(
          isNetworkError(err)
            ? { kind: 'network', message: "Couldn't reach the archive. Check your connection and try again." }
            : { kind: 'not-found', message: 'Failed to load video' },
        );
        console.error(err);
      } finally {
        setLoading(false);
      }
    }

    fetchVideo();
  }, [id, attempt]);

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-muted-foreground">Loading video...</div>
      </div>
    );
  }

  if (error?.kind === 'network') {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="space-y-4 text-center">
          <h1 className="font-display text-2xl md:text-3xl text-foreground">Connection problem</h1>
          <p className="text-muted-foreground">{error.message}</p>
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
