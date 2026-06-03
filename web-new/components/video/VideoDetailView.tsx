'use client';

/**
 * VideoDetailView Component
 * Full detail view showing complete AI summary, all tags, and metadata
 * This is the "read later" payoff from the scannable browse cards
 * Part of Two-Tier UX: Scan first (VideoCard) → Read later (VideoDetailView)
 */

import { Tag, Calendar, FileText, ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { Video } from '@/types/video';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { VidstackPlayer } from '@/components/video/VidstackPlayer';
import { formatDateDisplay, extractOriginalTitle } from '@/lib/utils/video-helpers';
import { useState, useEffect } from 'react';
import { computeVideoHash } from '@/lib/utils/hash';
import { motion } from 'framer-motion';

interface VideoDetailViewProps {
  video: Video;
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

  // Animation variants
  const videoVariants = {
    initial: { opacity: 0, scale: 0.98 },
    animate: {
      opacity: 1,
      scale: 1,
      transition: { duration: 0.3 }
    }
  };

  const metadataVariants = {
    initial: { opacity: 0, y: 20 },
    animate: {
      opacity: 1,
      y: 0,
      transition: { delay: 0.15, duration: 0.3 }
    }
  };

  return (
    <div className="space-y-4 md:space-y-6 px-0 md:px-4 py-4 md:py-6">
      {/* Back to VOD Diary */}
      <div className="px-2 md:px-0">
        <Link href="/vod-diary">
          <Button variant="ghost" size="sm" className="text-ink-muted hover:text-foreground">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to VOD Diary
          </Button>
        </Link>
      </div>

      {/* Video Player - full width on mobile */}
      <motion.div
        className="w-full"
        variants={videoVariants}
        initial="initial"
        animate="animate"
      >
        <VidstackPlayer
          videoUrl={video.url}
          subtitleUrl={subtitleUrl}
          poster={video.thumbnailUrl}
        />
      </motion.div>

      {/* Header Section - with padding on mobile */}
      <motion.div
        className="space-y-3 px-2 md:px-0"
        variants={metadataVariants}
        initial="initial"
        animate="animate"
      >
        {/* Titles */}
        <div className="space-y-2">
          {/* AI Title — Fraunces display */}
          <h1 className="font-display text-2xl md:text-3xl leading-tight text-foreground">
            {video.title}
          </h1>

          {/* Original filename */}
          {originalTitle && (
            <div className="flex items-center gap-2 text-sm text-ink-muted">
              <FileText className="w-4 h-4" />
              <span className="font-mono">{originalTitle}</span>
            </div>
          )}
        </div>

        {/* Metadata Row */}
        <div className="flex flex-wrap items-center gap-4 text-sm text-ink-muted">
          {formattedDate && (
            <div className="flex items-center gap-1.5">
              <Calendar className="w-4 h-4" />
              <span>{formattedDate}</span>
            </div>
          )}
        </div>
      </motion.div>

      {/* Separator */}
      <div className="h-px bg-rule mx-2 md:mx-0" />

      {/* 🎯 FULL SUMMARY (The Payoff!) — minimal accent bar, no box */}
      <motion.div
        className="px-2 md:px-0"
        variants={metadataVariants}
        initial="initial"
        animate="animate"
      >
        <div className="border-l-2 border-accent-green/50 pl-4 md:pl-5">
          <p className="text-foreground/80 leading-relaxed whitespace-pre-line">
            {video.summary || 'No summary available for this video.'}
          </p>
        </div>
      </motion.div>

      {/* Tags Section */}
      {video.tags && video.tags.length > 0 && (
        <motion.div
          className="space-y-3 px-2 md:px-0"
          variants={metadataVariants}
          initial="initial"
          animate="animate"
        >
          <h3 className="font-mono text-[0.65rem] font-medium text-ink-muted uppercase tracking-[0.25em]">
            Topics &amp; Tags
          </h3>
          <div className="flex flex-wrap gap-2">
            {video.tags
              .filter((tag) => tag !== video.platform)
              .map((tag, index) => (
                <Badge
                  key={index}
                  variant="tag"
                  className="cursor-default transition-colors hover:border-accent-green hover:bg-accent-green hover:text-white"
                >
                  <Tag className="w-3 h-3 mr-1" />
                  {tag}
                </Badge>
              ))}
          </div>
        </motion.div>
      )}
    </div>
  );
}
