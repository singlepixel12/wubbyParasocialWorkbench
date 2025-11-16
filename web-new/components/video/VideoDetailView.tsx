'use client';

/**
 * VideoDetailView Component
 * Full detail view showing complete AI summary, all tags, and metadata
 * This is the "read later" payoff from the scannable browse cards
 * Part of Two-Tier UX: Scan first (VideoCard) → Read later (VideoDetailView)
 */

import { Sparkles, Tag, Calendar, FileText, ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { Video } from '@/types/video';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { VidstackPlayer } from '@/components/video/VidstackPlayer';
import { formatDateDisplay, extractOriginalTitle } from '@/lib/utils/video-helpers';
import { cn } from '@/lib/utils';
import { useState, useEffect } from 'react';
import { computeVideoHash } from '@/lib/utils/hash';

interface VideoDetailViewProps {
  video: Video;
}

/**
 * Get solid Badge variant for platform
 */
function getSolidBadgeVariant(platform: string): 'kick-solid' | 'twitch-solid' | 'tag-solid' {
  const normalized = platform.toLowerCase();
  if (normalized === 'kick') return 'kick-solid';
  if (normalized === 'twitch') return 'twitch-solid';
  return 'tag-solid';
}

export function VideoDetailView({ video }: VideoDetailViewProps) {
  const formattedDate = video.date ? formatDateDisplay(new Date(video.date)) : '';
  const originalTitle = extractOriginalTitle(video.url);

  const [subtitleUrl, setSubtitleUrl] = useState<string | undefined>();

  // Generate subtitle URL from video hash
  useEffect(() => {
    async function loadSubtitles() {
      try {
        const hash = await computeVideoHash(video.url);
        const subtitlePath = `https://sbvaclmypokafpxebusn.supabase.co/storage/v1/object/public/wubbytranscript/${hash}/en/subtitle.vtt`;
        setSubtitleUrl(subtitlePath);
      } catch (error) {
        console.error('Failed to generate subtitle URL:', error);
      }
    }

    if (video.url) {
      loadSubtitles();
    }
  }, [video.url]);

  return (
    <div className="space-y-6 px-4 py-6">
      {/* Back to VOD Diary */}
      <div>
        <Link href="/vod-diary">
          <Button variant="ghost" size="sm" className="text-[#888] hover:text-white">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to VOD Diary
          </Button>
        </Link>
      </div>

      {/* Video Player */}
      <div className="w-full">
        <VidstackPlayer videoUrl={video.url} subtitleUrl={subtitleUrl} />
      </div>

      {/* Header Section */}
      <div className="space-y-3">
        {/* Badges */}
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="border-[#28a745] text-[#28a745]">
            <Sparkles className="w-3 h-3 mr-1" />
            AI-Enhanced
          </Badge>
          <Badge variant={getSolidBadgeVariant(video.platform)}>
            {video.platform}
          </Badge>
        </div>

        {/* Titles */}
        <div className="space-y-2">
          {/* AI Title */}
          <h1 className="text-2xl md:text-3xl font-bold text-white">
            {video.title}
          </h1>

          {/* Original filename */}
          {originalTitle && (
            <div className="flex items-center gap-2 text-sm text-[#888]">
              <FileText className="w-4 h-4" />
              <span className="font-mono">{originalTitle}</span>
            </div>
          )}
        </div>

        {/* Metadata Row */}
        <div className="flex flex-wrap items-center gap-4 text-sm text-[#888]">
          {formattedDate && (
            <div className="flex items-center gap-1.5">
              <Calendar className="w-4 h-4" />
              <span>{formattedDate}</span>
            </div>
          )}
        </div>
      </div>

      {/* Separator */}
      <div className="h-px bg-[#333]" />

      {/* 🎯 FULL AI SUMMARY (The Payoff!) */}
      <Card className={cn(
        'p-6',
        'bg-gradient-to-br from-[#28a745]/10 via-transparent to-transparent',
        'border-l-4 border-[#28a745]'
      )}>
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-[#28a745]" />
            <h2 className="text-lg font-semibold text-white">
              AI Summary
            </h2>
          </div>

          {/* Full 200-word summary with nice formatting */}
          <div className="prose prose-invert prose-sm max-w-none">
            <p className="text-[#ccc] leading-relaxed whitespace-pre-line">
              {video.summary || 'No summary available for this video.'}
            </p>
          </div>
        </div>
      </Card>

      {/* Tags Section */}
      {video.tags && video.tags.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-sm font-medium text-[#888] uppercase tracking-wide">
            Topics & Tags
          </h3>
          <div className="flex flex-wrap gap-2">
            {video.tags
              .filter((tag) => tag !== video.platform)
              .map((tag, index) => (
                <Badge
                  key={index}
                  variant="tag"
                  className="cursor-default hover:bg-[#28a745] hover:text-white transition-colors"
                >
                  <Tag className="w-3 h-3 mr-1" />
                  {tag}
                </Badge>
              ))}
          </div>
        </div>
      )}
    </div>
  );
}
