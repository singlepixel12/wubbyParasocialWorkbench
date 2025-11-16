'use client';

import { useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { VideoDetailView } from '@/components/video/VideoDetailView';
import { getWubbySummaryByHash } from '@/lib/api/supabase';
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
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchVideo() {
      if (!id) {
        setError('No video ID provided');
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        const videoData = await getWubbySummaryByHash(id);
        if (!videoData) {
          setError('Video not found');
        } else {
          setVideo(videoData);
        }
      } catch (err) {
        setError('Failed to load video');
        console.error(err);
      } finally {
        setLoading(false);
      }
    }

    fetchVideo();
  }, [id]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center">
        <div className="text-muted-foreground">Loading video...</div>
      </div>
    );
  }

  if (error || !video) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-foreground mb-2">Video Not Found</h1>
          <p className="text-muted-foreground">{error || 'The requested video could not be found.'}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0a0a]">
      {/* Video Player Section */}
      <div className="w-full bg-black">
        <div className="max-w-7xl mx-auto">
          <VideoDetailView video={video} />
        </div>
      </div>
    </div>
  );
}
