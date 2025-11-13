# Two-Tier UX Flow: Scan First, Read Later
## Wubby Parasocial Workbench - Progressive Disclosure Design

**Version:** 1.0
**Last Updated:** 2025-11-13
**Design Principle:** Scan first, read later

---

## Core Philosophy

> **"Don't remove the 200-word AI summary - just move it one click deeper and make the transition buttery."**

### The Problem
Showing full 3-4 line summaries on every card = **overwhelming** when scanning 50+ videos.

### The Solution
**Two-tier disclosure:**
1. **Browse/Home (VOD Diary):** Scannable 1-2 line hook
2. **Watch/Detail Page:** Full 200-word summary, AI context, chapters, related videos

### Why This Works Better
- ✅ **Faster scanning** - Users can browse 50 cards quickly
- ✅ **Stronger impact** - Full summary feels like a reward when clicked
- ✅ **Better contrast** - "Other sites: nothing. You: 200 words of AI gold"
- ✅ **Mobile-friendly** - Less scroll fatigue

---

## Visual Flow

### Current Design (Too Heavy)
```
┌─────────────────────────────┐
│ ✨ AI Summary  🏷️ 12 tags  │
│ ✨ Title                     │
│ 📄 Original                 │
│                             │
│ 💚 Summary: This is a long │ ← 3-4 lines on EVERY card
│    three to four line...   │    (overwhelming!)
│    description of video    │
│    content that goes on... │
│                             │
│ 🏷️ [tags] [tags] [tags]    │
└─────────────────────────────┘

(Repeat 50 times → scroll fatigue)
```

### New Design (Scannable)
```
┌─────────────────────────────┐
│ ✨ AI Summary  🏷️ 12 tags  │
│ ✨ Title                     │
│                             │
│ 💚 Hilarious Reddit reacts │ ← 1 line hook (scannable!)
│    + Alluux joins...       │
│                             │
│ 🏷️ [6 tags] [Read more →] │ ← "Read more" opens detail
└─────────────────────────────┘

(50 cards = easy to scan)

Click "Read more" or card →

┌─────────────────────────────┐
│     VIDEO PLAYER            │
│    [=====●=====]            │
│                             │
│ ✨ Full AI Title            │
│ 📄 Original filename        │
│                             │
│ ━━━━━━━━━━━━━━━━━━━━━━     │
│                             │
│ 💚 AI SUMMARY (200 words)  │
│    Full context here...    │
│    Multiple paragraphs...  │
│    All the details...      │
│                             │
│ 🏷️ All tags (clickable)    │
│                             │
│ 📊 CHAPTERS (if available) │
│    00:00 Intro             │
│    05:23 Reddit Review     │
│    15:45 Alluux Joins      │
│                             │
│ 🎬 MORE FROM THIS SERIES   │
│    [related] [videos]      │
└─────────────────────────────┘
```

---

## Implementation Options

### Option A: Dialog/Modal (Simplest)

**When to use:** Quick implementation, no routing changes needed

```tsx
// components/vod-diary/VideoCard.tsx
import { Dialog, DialogContent, DialogTrigger } from '@/components/ui/dialog';
import { VideoDetailView } from '@/components/video/VideoDetailView';

export function VideoCard({ video }: VideoCardProps) {
  return (
    <Dialog>
      {/* Card shows 1-2 line hook */}
      <DialogTrigger asChild>
        <div className="video-card cursor-pointer">
          {/* ... card content ... */}
          <p className="text-sm text-[#ccc] line-clamp-2">
            {extractHook(video.summary)} {/* First 1-2 sentences */}
          </p>
          <button className="text-[#28a745] text-xs hover:underline">
            Read more →
          </button>
        </div>
      </DialogTrigger>

      {/* Full detail in modal */}
      <DialogContent className="max-w-6xl h-[90vh] overflow-auto">
        <VideoDetailView video={video} />
      </DialogContent>
    </Dialog>
  );
}
```

**Pros:**
- ✅ Simple to implement (no routing)
- ✅ Preserves scroll position
- ✅ Can use Framer Motion for smooth open/close

**Cons:**
- ❌ No deep linking (can't share specific video)
- ❌ Browser back button doesn't work
- ❌ Not great for SEO

### Option B: Route-Based (Recommended)

**When to use:** Better UX, sharable links, better SEO

```tsx
// app/watch/[id]/page.tsx
export default function WatchPage({ params }: { params: { id: string } }) {
  return (
    <div className="max-w-7xl mx-auto">
      {/* Player */}
      <VideoPlayer videoId={params.id} />

      {/* Full context below */}
      <VideoDetailView videoId={params.id} />
    </div>
  );
}

// components/vod-diary/VideoCard.tsx
import Link from 'next/link';

export function VideoCard({ video }: VideoCardProps) {
  return (
    <Link href={`/watch/${video.id}`}>
      <div className="video-card cursor-pointer hover:bg-[#1a1a1a]">
        {/* ... card content ... */}
        <p className="text-sm text-[#ccc] line-clamp-2">
          {extractHook(video.summary)}
        </p>
        <span className="text-[#28a745] text-xs hover:underline">
          Watch & read more →
        </span>
      </div>
    </Link>
  );
}
```

**Pros:**
- ✅ Deep linking (shareable URLs)
- ✅ Browser back button works
- ✅ Better for SEO
- ✅ Can use Framer Motion shared layout transitions

**Cons:**
- ❌ More routing setup
- ❌ Need to fetch video data on watch page

### Option C: Hybrid (Best of Both)

**Desktop:** Route-based (better for power users, sharable)
**Mobile:** Dialog-based (faster, preserves context)

```tsx
export function VideoCard({ video }: VideoCardProps) {
  const isMobile = useMediaQuery('(max-width: 768px)');

  if (isMobile) {
    // Mobile: Dialog
    return (
      <Dialog>
        <DialogTrigger asChild>
          <VideoCardContent video={video} />
        </DialogTrigger>
        <DialogContent className="h-[95vh]">
          <VideoDetailView video={video} />
        </DialogContent>
      </Dialog>
    );
  }

  // Desktop: Route
  return (
    <Link href={`/watch/${video.id}`}>
      <VideoCardContent video={video} />
    </Link>
  );
}
```

---

## Component Design: Browse Cards (Scannable)

### Home/VOD Diary Card (1-2 Line Hook)

```tsx
// components/vod-diary/VideoCard.tsx
'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Sparkles, Tag, Play } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

export function VideoCard({ video }: VideoCardProps) {
  const [isHovered, setIsHovered] = useState(false);

  // Extract first 1-2 sentences as hook (max ~100 chars)
  const hook = extractHook(video.summary, 100);

  return (
    <Link href={`/watch/${video.id}`}>
      <div
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        className={cn(
          'flex flex-col gap-3 p-3 rounded-lg',
          'bg-[#111] border border-[#333]',
          'hover:bg-[#1a1a1a] hover:border-[#444]',
          'transition-all duration-200',
          'cursor-pointer relative',
          'md:flex-row md:gap-4 md:p-4'
        )}
      >
        {/* Platform badge */}
        <Badge
          variant={getSolidBadgeVariant(video.platform)}
          className="absolute top-3 right-3 z-10 px-3 py-1.5"
        >
          {video.platform}
        </Badge>

        {/* Thumbnail */}
        <div className={cn(
          'relative rounded overflow-hidden bg-black',
          'w-full aspect-video',
          'md:w-48 md:aspect-auto md:h-28',
          'flex-shrink-0'
        )}>
          {/* Thumbnail content */}
          <div className="absolute inset-0 bg-black" />

          {/* Play button */}
          <div className="absolute inset-0 flex items-center justify-center">
            <div
              className={cn(
                'w-16 h-16 rounded-full flex items-center justify-center',
                'backdrop-blur-sm transition-all duration-300',
                'bg-gradient-to-br from-black/90 to-black/70',
                isHovered && 'scale-110',
                video.platform === 'kick' &&
                  isHovered &&
                  'from-[#28a745]/95 to-[#28a745]/80 shadow-[0_0_20px_rgba(30,126,52,0.8)]',
                video.platform === 'twitch' &&
                  isHovered &&
                  'from-[#6441A5]/95 to-[#6441A5]/80 shadow-[0_0_20px_rgba(100,65,165,0.8)]'
              )}
            >
              <Play className="w-6 h-6 text-white fill-white ml-0.5" />
            </div>
          </div>

          {/* Duration badge */}
          <div className="absolute bottom-2 right-2 px-2 py-1 rounded bg-black/80 text-white text-xs font-medium">
            {formatDuration(video.duration)}
          </div>
        </div>

        {/* Content - SCANNABLE */}
        <div className="flex-1 flex flex-col min-w-0">
          {/* AI badges (keep these!) */}
          <div className="flex items-center gap-2 mb-2">
            <Badge variant="outline" className="border-[#28a745] text-[#28a745] text-xs">
              <Sparkles className="w-3 h-3 mr-1" />
              AI Summary
            </Badge>
            <Badge variant="outline" className="border-[#6441A5] text-[#6441A5] text-xs">
              <Tag className="w-3 h-3 mr-1" />
              {video.tags.length} tags
            </Badge>
          </div>

          {/* Title (keep AI + original) */}
          <h3 className="text-base md:text-lg font-semibold text-white line-clamp-2 mb-2">
            {video.title}
          </h3>

          {/* Metadata */}
          <div className="flex items-center gap-2 text-xs text-[#888] mb-2">
            {formattedDate && <span>{formattedDate}</span>}
            {formattedDate && <span>•</span>}
            <span>{formatViews(video.views)} views</span>
          </div>

          {/* 🎯 NEW: 1-2 LINE HOOK (not full summary!) */}
          <p className="text-sm text-[#ccc] leading-relaxed mb-2 line-clamp-2">
            {hook}
          </p>

          {/* Read more indicator */}
          <div className="flex items-center justify-between mt-auto">
            {/* Tags preview (3 tags) */}
            <div className="flex gap-1.5 flex-wrap">
              {video.tags.slice(0, 3).map((tag, i) => (
                <Badge key={i} variant="tag" className="text-xs">
                  {tag}
                </Badge>
              ))}
              {video.tags.length > 3 && (
                <span className="text-xs text-[#666]">+{video.tags.length - 3}</span>
              )}
            </div>

            {/* Read more CTA */}
            <span className={cn(
              "text-xs font-medium transition-colors",
              "text-[#28a745] group-hover:text-white"
            )}>
              Read more →
            </span>
          </div>
        </div>
      </div>
    </Link>
  );
}

// Helper function to extract hook (first 1-2 sentences)
function extractHook(summary: string, maxLength: number = 100): string {
  // Split by period, exclamation, or question mark
  const sentences = summary.split(/[.!?]+\s/);

  let hook = sentences[0];

  // If first sentence is too short, add second
  if (hook.length < 50 && sentences[1]) {
    hook += '. ' + sentences[1];
  }

  // Trim to max length
  if (hook.length > maxLength) {
    hook = hook.substring(0, maxLength) + '...';
  }

  return hook;
}
```

**Key Changes from Previous Design:**
1. ❌ **Removed:** Green accent bar (too heavy for browse view)
2. ❌ **Removed:** 3-4 line summary (now 1-2 line hook)
3. ✅ **Kept:** AI badges (shows it's AI-generated)
4. ✅ **Kept:** Tag count (shows depth)
5. ✅ **Added:** "Read more →" CTA
6. ✅ **Added:** Tag preview (3 tags instead of 6)

---

## Component Design: Watch/Detail Page (Full Context)

### /watch/[id] - The Full Experience

```tsx
// app/watch/[id]/page.tsx
import { notFound } from 'next/navigation';
import { fetchVideoById } from '@/lib/api/supabase';
import { VideoDetailView } from '@/components/video/VideoDetailView';

export default async function WatchPage({ params }: { params: { id: string } }) {
  const video = await fetchVideoById(params.id);

  if (!video) {
    notFound();
  }

  return (
    <div className="min-h-screen bg-[#0a0a0a]">
      {/* Video Player Section */}
      <div className="w-full bg-black">
        <div className="max-w-7xl mx-auto">
          <VidstackPlayer
            url={video.url}
            subtitleUrl={video.subtitleUrl}
          />
        </div>
      </div>

      {/* Content Section */}
      <div className="max-w-7xl mx-auto px-4 py-6">
        <VideoDetailView video={video} />
      </div>
    </div>
  );
}
```

```tsx
// components/video/VideoDetailView.tsx
'use client';

import { Sparkles, Tag, Calendar, Eye, Clock, FileText } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { RelatedVideos } from '@/components/video/RelatedVideos';

export function VideoDetailView({ video }: { video: Video }) {
  return (
    <div className="space-y-6">
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
          {extractOriginalTitle(video.url) && (
            <div className="flex items-center gap-2 text-sm text-[#888]">
              <FileText className="w-4 h-4" />
              <span className="font-mono">
                {extractOriginalTitle(video.url)}
              </span>
            </div>
          )}
        </div>

        {/* Metadata Row */}
        <div className="flex flex-wrap items-center gap-4 text-sm text-[#888]">
          <div className="flex items-center gap-1.5">
            <Calendar className="w-4 h-4" />
            <span>{formatDateDisplay(new Date(video.date))}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <Eye className="w-4 h-4" />
            <span>{formatViews(video.views)} views</span>
          </div>
          <div className="flex items-center gap-1.5">
            <Clock className="w-4 h-4" />
            <span>{formatDuration(video.duration)}</span>
          </div>
        </div>
      </div>

      <Separator />

      {/* 🎯 FULL AI SUMMARY (The Payoff!) */}
      <Card className="p-6 bg-gradient-to-br from-[#28a745]/10 via-transparent to-transparent border-l-4 border-[#28a745]">
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
              {video.summary}
            </p>
          </div>
        </div>
      </Card>

      {/* Tags Section */}
      <div className="space-y-3">
        <h3 className="text-sm font-medium text-[#888] uppercase tracking-wide">
          Topics & Tags
        </h3>
        <div className="flex flex-wrap gap-2">
          {video.tags.map((tag, index) => (
            <Badge
              key={index}
              variant="tag"
              onClick={() => navigateToSearch(tag)}
              className="cursor-pointer hover:bg-[#28a745] hover:text-white transition-colors"
            >
              <Tag className="w-3 h-3 mr-1" />
              {tag}
            </Badge>
          ))}
        </div>
      </div>

      {/* Chapters (if available) */}
      {video.chapters && video.chapters.length > 0 && (
        <>
          <Separator />
          <div className="space-y-3">
            <h3 className="text-sm font-medium text-[#888] uppercase tracking-wide">
              Chapters
            </h3>
            <div className="space-y-2">
              {video.chapters.map((chapter, index) => (
                <button
                  key={index}
                  onClick={() => seekToChapter(chapter.timestamp)}
                  className={cn(
                    "w-full flex items-center gap-3 p-3 rounded-lg",
                    "bg-[#111] hover:bg-[#1a1a1a]",
                    "border border-[#333] hover:border-[#28a745]",
                    "transition-colors text-left"
                  )}
                >
                  <span className="text-[#28a745] font-mono text-sm">
                    {formatTimestamp(chapter.timestamp)}
                  </span>
                  <span className="text-white">{chapter.title}</span>
                </button>
              ))}
            </div>
          </div>
        </>
      )}

      {/* Related Videos */}
      <Separator />
      <div className="space-y-4">
        <h3 className="text-lg font-semibold text-white">
          More from this series
        </h3>
        <RelatedVideos currentVideoId={video.id} tags={video.tags} />
      </div>
    </div>
  );
}
```

---

## Framer Motion Transitions

### Shared Layout Animation

```tsx
// app/layout.tsx
'use client';

import { LayoutGroup } from 'framer-motion';

export default function RootLayout({ children }) {
  return (
    <html>
      <body>
        <LayoutGroup>
          {children}
        </LayoutGroup>
      </body>
    </html>
  );
}

// components/vod-diary/VideoCard.tsx
import { motion } from 'framer-motion';

export function VideoCard({ video }) {
  return (
    <Link href={`/watch/${video.id}`}>
      <motion.div
        layoutId={`video-${video.id}`}  // Shared layout ID
        className="video-card"
        whileHover={{ scale: 1.02 }}
        transition={{ duration: 0.2 }}
      >
        {/* Thumbnail */}
        <motion.div
          layoutId={`thumbnail-${video.id}`}
          className="thumbnail"
        >
          {/* ... */}
        </motion.div>

        {/* Title */}
        <motion.h3
          layoutId={`title-${video.id}`}
          className="title"
        >
          {video.title}
        </motion.h3>
      </motion.div>
    </Link>
  );
}

// app/watch/[id]/page.tsx
import { motion } from 'framer-motion';

export default function WatchPage({ params }) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.3 }}
    >
      {/* Player uses same layoutId */}
      <motion.div
        layoutId={`thumbnail-${params.id}`}
        className="player-container"
      >
        <VidstackPlayer />
      </motion.div>

      {/* Title uses same layoutId */}
      <motion.h1
        layoutId={`title-${params.id}`}
        className="title-large"
      >
        {video.title}
      </motion.h1>

      {/* Summary fades in */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2, duration: 0.4 }}
      >
        <Card>{/* Full summary */}</Card>
      </motion.div>
    </motion.div>
  );
}
```

---

## Rails/Categories (Optional)

### Home Page with Smart Rails

```tsx
// app/page.tsx
export default async function HomePage() {
  const recentVideos = await fetchRecentVideos({ limit: 10 });
  const gameVideos = await searchVideos({ searchTerm: 'game', limit: 10 });
  const reactVideos = await searchVideos({ searchTerm: 'react', limit: 10 });

  return (
    <div className="space-y-8">
      {/* Hero */}
      <HeroSection />

      {/* Rail 1: Recent */}
      <VideoRail
        title="Recently Added"
        videos={recentVideos}
        href="/vod-diary?filter=recent"
      />

      {/* Rail 2: Game Nights */}
      <VideoRail
        title="Game Nights"
        videos={gameVideos}
        href="/vod-diary?tag=game"
      />

      {/* Rail 3: React Content */}
      <VideoRail
        title="React Videos"
        videos={reactVideos}
        href="/vod-diary?tag=react"
      />
    </div>
  );
}

// components/video/VideoRail.tsx
import { Embla } from '@/components/ui/embla';

export function VideoRail({ title, videos, href }) {
  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">{title}</h2>
        <Link href={href} className="text-[#28a745] hover:underline">
          See all →
        </Link>
      </div>

      {/* Horizontal scrolling carousel */}
      <Embla className="overflow-hidden">
        <div className="flex gap-4">
          {videos.map((video) => (
            <VideoCard key={video.id} video={video} compact />
          ))}
        </div>
      </Embla>
    </section>
  );
}
```

---

## Summary: What Changed

### Before (Too Heavy)
- ❌ 3-4 line summary on every card
- ❌ All tags shown (6+)
- ❌ Green accent bar on list
- ❌ Overwhelming to scan 50+ cards

### After (Scannable → Detailed)

**Browse Page (VOD Diary):**
- ✅ 1-2 line hook (scannable)
- ✅ 3 tag preview
- ✅ "Read more →" CTA
- ✅ AI badges still visible
- ✅ Easy to scan 50+ cards

**Watch/Detail Page:**
- ✅ Full 200-word AI summary (the payoff!)
- ✅ All tags (clickable)
- ✅ Chapters (if available)
- ✅ Related videos
- ✅ Green accent card for summary
- ✅ Feels like a reward

---

## Implementation Priority

### Week 0 Updated Tasks

| Task | Priority | Effort | Files |
|------|----------|--------|-------|
| 0.1 Extract hook function (1-2 lines) | 🎯 HERO | 1-2h | video-helpers.ts, VideoCard.tsx |
| 0.2 Update VideoCard to show hook | 🎯 HERO | 2-3h | VideoCard.tsx |
| 0.3 Create /watch/[id] route | 🎯 HERO | 3-4h | app/watch/[id]/page.tsx |
| 0.4 Create VideoDetailView component | 🎯 HERO | 4-6h | VideoDetailView.tsx |
| 0.5 Add Framer Motion transitions | 🟡 MEDIUM | 2-3h | Layout, VideoCard |
| 0.6 Create Rails for home page | 🟢 LOW | 4-6h | app/page.tsx, VideoRail.tsx |

**Total: 16-24 hours for two-tier UX**

---

## Technical Stack Integration

### shadcn/ui
- ✅ `Card` - Video tiles, summary card
- ✅ `Dialog` - Modal option (if not using routes)
- ✅ `Separator` - Section dividers
- ✅ `Badge` - Tags, platform, AI indicators

### Framer Motion
- ✅ Shared layout transitions (thumbnail → player)
- ✅ Fade-in animations for detail view
- ✅ Hover lift effects on cards
- ✅ Smooth scroll animations

### Embla Carousel (Optional)
- ✅ Horizontal rails on home page
- ✅ Touch-friendly mobile scrolling
- ✅ "See all" CTA at end

### Next.js
- ✅ App Router for /watch/[id]
- ✅ Server Components for initial data
- ✅ Client Components for interactions
- ✅ Dynamic metadata per video

---

**Conclusion:** Your designers nailed it. This approach makes the app feel **lighter** to browse, while making your AI differentiators feel even **more impressive** when revealed on the detail page. It's the perfect balance of scan-first simplicity with read-later depth.
