# Mobile-First Implementation Plan
## Wubby Parasocial Workbench - Technical Implementation Guide

**Version:** 1.0
**Last Updated:** 2025-11-13
**Estimated Timeline:** 5-7 weeks
**Complexity:** Medium to High

---

## Table of Contents

1. [Overview](#overview)
2. [Phase 1: Mobile-First Foundation](#phase-1-mobile-first-foundation)
3. [Phase 2: Visual Polish](#phase-2-visual-polish)
4. [Phase 3: Performance Optimization](#phase-3-performance-optimization)
5. [Phase 4: Advanced Features](#phase-4-advanced-features)
6. [Testing Strategy](#testing-strategy)
7. [Rollback Plan](#rollback-plan)

---

## Overview

### Goals
1. Transform desktop-first design into mobile-first responsive design
2. Implement YouTube/Netflix best practices for video platforms
3. Improve touch interaction and gesture support
4. Optimize performance for mobile networks
5. Maintain accessibility standards (WCAG 2.1 AA)

### Success Metrics
- Lighthouse Mobile Score: >90 (currently unknown)
- Mobile Conversion Rate: +20% (play video clicks)
- Time to Interactive: <3.5s on 3G
- Touch Target Compliance: 100%
- Accessibility Score: 100

### Prerequisites
- Node.js 18+ installed
- Git workflow established
- Access to mobile devices for testing
- Supabase credentials configured

---

## Phase 1: Mobile-First Foundation

**Duration:** 1-2 weeks
**Risk Level:** Medium
**Effort:** 40-60 hours

### Task 1.1: Reverse Tailwind Breakpoints (Critical)

**Current Problem:**
```tsx
// Desktop-first approach
<div className="hidden sm:block md:flex lg:grid">
```

**Solution: Mobile-First**
```tsx
// Mobile default, enhance for larger screens
<div className="block md:flex lg:grid">
```

**Implementation Steps:**

1. **Update Tailwind Config** (`tailwind.config.ts`)
   ```ts
   // Already uses default mobile-first breakpoints
   export default {
     theme: {
       screens: {
         'sm': '640px',  // Small tablets
         'md': '768px',  // Tablets
         'lg': '1024px', // Laptops
         'xl': '1280px', // Desktops
         '2xl': '1536px' // Large desktops
       }
     }
   }
   ```

2. **Audit All Components**
   ```bash
   # Find all responsive class usage
   cd web-new
   grep -r "sm:" components/ app/ --include="*.tsx" > responsive-audit.txt
   ```

3. **Refactor Pattern**
   ```tsx
   // BEFORE (Desktop-first)
   <div className="flex flex-row gap-6 sm:gap-4">
     // Desktop: 24px, Mobile: 16px (backwards!)
   </div>

   // AFTER (Mobile-first)
   <div className="flex flex-col gap-4 md:flex-row md:gap-6">
     // Mobile: column, 16px | Desktop: row, 24px (correct!)
   </div>
   ```

**Files to Update:**
- `components/vod-diary/VideoCard.tsx` (line 64, 84, 108)
- `components/vod-diary/VideoList.tsx` (grid layout)
- `app/vod-diary/page.tsx` (filter layout, line 116)
- `components/Header.tsx` (navigation layout)
- `app/page.tsx` (video selector layout)

**Example: VideoCard Refactor**

```tsx
// BEFORE
<div className={cn(
  'flex gap-4 bg-[#111] border border-[#333] rounded-lg p-4 pb-10 min-h-[180px]',
  // ^ Desktop-first: large by default
)}>
  <div className="relative w-40 h-full min-h-[90px]">
    // ^ Large thumbnail
  </div>
</div>

// AFTER (Mobile-first)
<div className={cn(
  'flex flex-col gap-3 p-3 pb-12',          // Mobile: vertical, compact
  'md:flex-row md:gap-4 md:p-4 md:pb-10',  // Desktop: horizontal, spacious
  'bg-[#111] border border-[#333] rounded-lg min-h-[180px]'
)}>
  <div className={cn(
    'relative w-full h-48',                 // Mobile: full-width, taller
    'md:w-40 md:h-full md:min-h-[90px]'    // Desktop: fixed width
  )}>
    // Thumbnail
  </div>
</div>
```

### Task 1.2: Touch Target Optimization (Critical)

**Goal:** All interactive elements ≥44x44px (WCAG 2.5.5)

**Current Issues:**
```tsx
// TOO SMALL ❌
<Button className="text-xs h-6 px-2">  // ~24px height
  {isExpanded ? 'Collapse ▲' : 'Expand ▼'}
</Button>

// Badge tap target unclear
<Badge className="absolute top-3 right-3 px-3 py-1">
  {video.platform}
</Badge>
```

**Solutions:**

1. **Create Touch-Optimized Button Variants**
   ```tsx
   // components/ui/button.tsx
   const buttonVariants = cva(
     "inline-flex items-center justify-center...",
     {
       variants: {
         size: {
           default: "h-10 px-4 py-2",         // 40px
           sm: "h-9 rounded-md px-3",         // 36px
           lg: "h-11 rounded-md px-8",        // 44px
           touch: "h-11 min-w-[44px] px-4",   // NEW: 44x44px minimum
           icon: "h-10 w-10",                 // 40x40px
           "icon-lg": "h-11 w-11",            // NEW: 44x44px for touch
         },
       },
     }
   );
   ```

2. **Update VideoCard Expand Button**
   ```tsx
   // components/vod-diary/VideoCard.tsx
   <CollapsibleTrigger asChild>
     <Button
       variant="ghost"
       size="touch"  // Changed from "sm"
       onClick={(e) => e.stopPropagation()}
       className={cn(
         "absolute bottom-2 left-1/2 -translate-x-1/2",
         "text-sm font-medium",                    // Readable text
         "text-[#888] hover:text-[#aaa]",
         "hover:bg-[#222]",
         "min-w-[120px]"                           // Wider for easier tap
       )}
     >
       {isExpanded ? 'Collapse ▲' : 'Expand ▼'}
     </Button>
   </CollapsibleTrigger>
   ```

3. **Make Badges Interactive (Optional)**
   ```tsx
   // If badges should filter by platform when tapped
   <Badge
     variant={getSolidBadgeVariant(video.platform)}
     onClick={(e) => {
       e.stopPropagation();
       onFilterByPlatform(video.platform);
     }}
     className={cn(
       "absolute top-3 right-3",
       "font-semibold z-10",
       "px-4 py-2",              // Larger padding
       "min-w-[60px] h-[32px]",  // Minimum size
       "cursor-pointer",
       "transition-transform hover:scale-105"
     )}
   >
     {video.platform}
   </Badge>
   ```

### Task 1.3: Bottom Navigation Pattern (High Impact)

**Goal:** Move navigation to thumb-friendly bottom area on mobile

**Implementation:**

1. **Create BottomNav Component**
   ```tsx
   // components/layout/BottomNav.tsx
   'use client';

   import Link from 'next/link';
   import { usePathname } from 'next/navigation';
   import { Home, FileText, Video, Menu } from 'lucide-react';
   import { cn } from '@/lib/utils';

   const navItems = [
     { href: '/', label: 'Index', icon: Home },
     { href: '/transcript', label: 'Transcript', icon: FileText },
     { href: '/vod-diary', label: 'VODs', icon: Video },
     { href: '/player', label: 'Player', icon: Menu },
   ];

   export function BottomNav() {
     const pathname = usePathname();

     return (
       <nav className={cn(
         "fixed bottom-0 left-0 right-0 z-50",
         "md:hidden",  // Only show on mobile
         "bg-[#111] border-t border-[#333]",
         "safe-area-inset-bottom"  // iOS notch support
       )}>
         <div className="flex justify-around items-center h-16">
           {navItems.map(({ href, label, icon: Icon }) => {
             const isActive = pathname === href;
             return (
               <Link
                 key={href}
                 href={href}
                 className={cn(
                   "flex flex-col items-center justify-center",
                   "w-full h-full gap-1",
                   "transition-colors",
                   isActive
                     ? "text-[#28a745]"  // Kick green for active
                     : "text-[#888] hover:text-[#aaa]"
                 )}
                 aria-label={label}
                 aria-current={isActive ? 'page' : undefined}
               >
                 <Icon className="w-6 h-6" />
                 <span className="text-xs font-medium">{label}</span>
               </Link>
             );
           })}
         </div>
       </nav>
     );
   }
   ```

2. **Update Root Layout**
   ```tsx
   // app/layout.tsx
   import { BottomNav } from '@/components/layout/BottomNav';

   export default function RootLayout({ children }) {
     return (
       <html lang="en">
         <body>
           <Header />  {/* Hide on mobile scroll */}
           <main className="pb-16 md:pb-0"> {/* Add bottom padding for nav */}
             {children}
           </main>
           <BottomNav />
         </body>
       </html>
     );
   }
   ```

3. **Update Header for Mobile**
   ```tsx
   // components/Header.tsx
   export function Header() {
     return (
       <header className={cn(
         "border-b border-[#333] bg-[#111]",
         "sticky top-0 z-40",
         "hidden md:block"  // Hide on mobile (use bottom nav instead)
       )}>
         {/* Desktop navigation */}
       </header>
     );
   }
   ```

4. **Add Safe Area Support** (iOS notches)
   ```css
   /* app/globals.css */
   @supports (padding: env(safe-area-inset-bottom)) {
     .safe-area-inset-bottom {
       padding-bottom: env(safe-area-inset-bottom);
     }
   }
   ```

### Task 1.4: Pull-to-Refresh (Mobile UX Enhancement)

**Goal:** Allow users to refresh VOD list by pulling down

**Implementation:**

1. **Install Dependency**
   ```bash
   npm install react-simple-pull-to-refresh
   ```

2. **Wrap VOD List**
   ```tsx
   // app/vod-diary/page.tsx
   import PullToRefresh from 'react-simple-pull-to-refresh';

   export default function VodDiaryPage() {
     const handleRefresh = async () => {
       logger.log('Pull-to-refresh triggered');
       await loadVideos();
     };

     return (
       <div className="space-y-6">
         <PageHeader ... />

         {/* Mobile: Pull-to-refresh */}
         <div className="md:hidden">
           <PullToRefresh
             onRefresh={handleRefresh}
             pullingContent={<div className="text-center">Pull to refresh...</div>}
             refreshingContent={<div className="text-center">Refreshing...</div>}
           >
             <VideoList ... />
           </PullToRefresh>
         </div>

         {/* Desktop: Standard list */}
         <div className="hidden md:block">
           <VideoList ... />
         </div>
       </div>
     );
   }
   ```

---

## Phase 2: Visual Polish

**Duration:** 1 week
**Risk Level:** Low
**Effort:** 20-30 hours

### Task 2.1: Enhanced Video Cards

**Goal:** Improve visual hierarchy and mobile layout

**Implementation:**

1. **Add Thumbnail Gradient Overlay**
   ```tsx
   // components/vod-diary/VideoCard.tsx
   <div className="relative w-full h-48 md:w-40 md:h-full bg-black rounded overflow-hidden group">
     {/* Thumbnail (future: actual image) */}
     <div className="absolute inset-0 bg-black" />

     {/* NEW: Gradient overlay for text legibility */}
     <div className={cn(
       "absolute inset-0",
       "bg-gradient-to-t from-black/90 via-black/20 to-transparent",
       "opacity-0 group-hover:opacity-100",
       "transition-opacity duration-300"
     )} />

     {/* Play button (existing) */}
     <div className="absolute inset-0 flex items-center justify-center">
       <PlayButton platform={video.platform} />
     </div>

     {/* NEW: Duration badge (bottom-right) */}
     <div className={cn(
       "absolute bottom-2 right-2",
       "px-2 py-1 rounded",
       "bg-black/80 text-white text-xs font-medium"
     )}>
       {video.duration || '2:34:56'}
     </div>
   </div>
   ```

2. **Platform-Specific Glow Effect**
   ```tsx
   // Create reusable PlayButton component
   // components/video/PlayButton.tsx
   'use client';

   import { Play } from 'lucide-react';
   import { cn } from '@/lib/utils';

   interface PlayButtonProps {
     platform: string;
     size?: 'sm' | 'md' | 'lg';
   }

   export function PlayButton({ platform, size = 'md' }: PlayButtonProps) {
     const sizeClasses = {
       sm: 'w-12 h-12',
       md: 'w-16 h-16',
       lg: 'w-20 h-20',
     };

     const iconSizes = {
       sm: 'w-5 h-5',
       md: 'w-6 h-6',
       lg: 'w-8 h-8',
     };

     return (
       <div
         className={cn(
           sizeClasses[size],
           'rounded-full flex items-center justify-center',
           'backdrop-blur-sm',
           'transition-all duration-300',
           'animate-[playButtonPulse_2s_ease-in-out_infinite]',
           'hover:animate-none hover:scale-110',
           // Base style
           'bg-gradient-to-br from-black/90 to-black/70',
           // Platform-specific hover
           platform === 'kick' &&
             'hover:from-[#28a745]/95 hover:to-[#28a745]/80 hover:shadow-[0_0_20px_rgba(30,126,52,0.8)]',
           platform === 'twitch' &&
             'hover:from-[#6441A5]/95 hover:to-[#6441A5]/80 hover:shadow-[0_0_20px_rgba(100,65,165,0.8)]',
         )}
       >
         <Play className={cn(iconSizes[size], 'text-white fill-white ml-0.5')} />
       </div>
     );
   }
   ```

3. **Mobile-Optimized Card Layout**
   ```tsx
   // components/vod-diary/VideoCard.tsx - Full refactor
   export const VideoCard = memo(function VideoCard({ video, onCardClick }: VideoCardProps) {
     const [isExpanded, setIsExpanded] = useState(false);
     // ... handlers

     return (
       <Collapsible open={isExpanded} onOpenChange={setIsExpanded}>
         <div
           onClick={handleCardClick}
           className={cn(
             // Mobile: Vertical layout, compact
             'flex flex-col gap-3 p-3 rounded-lg',
             'bg-[#111] border border-[#333]',
             'hover:bg-[#1a1a1a] hover:border-[#444]',
             'transition-all duration-200',
             'cursor-pointer',
             // Desktop: Horizontal layout, spacious
             'md:flex-row md:gap-4 md:p-4',
             'relative pb-14', // Space for expand button
             isExpanded && 'bg-[#1a1a1a] border-[#444]'
           )}
         >
           {/* Platform badge - top right */}
           <Badge
             variant={getSolidBadgeVariant(video.platform)}
             className="absolute top-3 right-3 z-10 px-3 py-1.5"
           >
             {video.platform}
           </Badge>

           {/* Thumbnail - full width on mobile */}
           <Link
             href="/player"
             target="_blank"
             onClick={handleThumbnailClick}
             className="group block"
             aria-label={`Play ${video.title}`}
           >
             <div className={cn(
               'relative rounded overflow-hidden bg-black',
               // Mobile: 16:9 aspect ratio, full width
               'w-full aspect-video',
               // Desktop: Fixed width
               'md:w-48 md:aspect-auto md:h-28',
               'flex-shrink-0'
             )}>
               {/* Thumbnail placeholder */}
               <div className="absolute inset-0 bg-black" />

               {/* Play button overlay */}
               <div className="absolute inset-0 flex items-center justify-center">
                 <PlayButton platform={video.platform} size="md" />
               </div>

               {/* Duration badge */}
               <div className="absolute bottom-2 right-2 px-2 py-1 rounded bg-black/80 text-white text-xs font-medium">
                 2:34:56
               </div>
             </div>
           </Link>

           {/* Info section */}
           <div className="flex-1 flex flex-col min-w-0">
             {/* Title */}
             <h3 className={cn(
               'font-semibold text-white mb-1',
               'text-base md:text-lg',  // Slightly smaller on mobile
               'line-clamp-2'            // Max 2 lines
             )}>
               {video.title}
             </h3>

             {/* Metadata row - inline on mobile */}
             <div className="flex items-center gap-2 text-sm text-[#999] mb-2">
               {formattedDate && (
                 <>
                   <span>{formattedDate}</span>
                   <span>•</span>
                 </>
               )}
               <span>123K views</span>
             </div>

             {/* Summary */}
             <p className={cn(
               'text-sm text-[#ccc] leading-relaxed',
               !isExpanded && 'line-clamp-2 md:line-clamp-3'
             )}>
               {video.summary}
             </p>

             {/* Tags - collapsible */}
             <CollapsibleContent>
               <div className="flex flex-wrap gap-2 mt-3">
                 {video.tags
                   .filter((tag) => tag !== video.platform)
                   .map((tag, index) => (
                     <Badge key={index} variant="tag">
                       {tag}
                     </Badge>
                   ))}
               </div>
             </CollapsibleContent>
           </div>

           {/* Expand button */}
           <CollapsibleTrigger asChild>
             <Button
               variant="ghost"
               size="touch"
               onClick={(e) => e.stopPropagation()}
               className={cn(
                 'absolute bottom-2 left-1/2 -translate-x-1/2',
                 'min-w-[120px]',
                 'text-sm font-medium',
                 'text-[#888] hover:text-white hover:bg-[#222]'
               )}
             >
               {isExpanded ? (
                 <>
                   Collapse <span className="ml-1">▲</span>
                 </>
               ) : (
                 <>
                   Expand <span className="ml-1">▼</span>
                 </>
               )}
             </Button>
           </CollapsibleTrigger>
         </div>
       </Collapsible>
     );
   });
   ```

### Task 2.2: Enhanced Loading States

**Goal:** Progressive loading with better perceived performance

**Implementation:**

1. **Progressive Image Loading** (Future when thumbnails added)
   ```tsx
   // components/video/VideoThumbnail.tsx
   'use client';

   import { useState } from 'react';
   import Image from 'next/image';
   import { cn } from '@/lib/utils';

   interface VideoThumbnailProps {
     src?: string;
     alt: string;
     blurDataURL?: string;
     aspectRatio?: 'video' | 'square';
   }

   export function VideoThumbnail({
     src,
     alt,
     blurDataURL,
     aspectRatio = 'video',
   }: VideoThumbnailProps) {
     const [isLoading, setIsLoading] = useState(true);
     const [error, setError] = useState(false);

     if (!src || error) {
       // Fallback to black placeholder
       return (
         <div className={cn(
           'w-full h-full bg-black',
           'flex items-center justify-center',
           'text-[#666]'
         )}>
           <Video className="w-12 h-12" />
         </div>
       );
     }

     return (
       <div className="relative w-full h-full">
         {/* Loading skeleton */}
         {isLoading && (
           <div className="absolute inset-0 bg-[#222] animate-pulse" />
         )}

         {/* Image */}
         <Image
           src={src}
           alt={alt}
           fill
           className={cn(
             'object-cover transition-opacity duration-300',
             isLoading ? 'opacity-0' : 'opacity-100'
           )}
           sizes="(max-width: 768px) 100vw, 192px"
           placeholder={blurDataURL ? 'blur' : 'empty'}
           blurDataURL={blurDataURL}
           onLoad={() => setIsLoading(false)}
           onError={() => setError(true)}
         />
       </div>
     );
   }
   ```

2. **Skeleton Updates**
   ```tsx
   // components/vod-diary/SkeletonVideoCard.tsx
   export function SkeletonVideoCard() {
     return (
       <div className={cn(
         'flex flex-col gap-3 p-3 rounded-lg',
         'md:flex-row md:gap-4 md:p-4',
         'bg-[#111] border border-[#333]',
         'animate-pulse'
       )}>
         {/* Thumbnail skeleton */}
         <div className={cn(
           'rounded overflow-hidden bg-[#222]',
           'w-full aspect-video',
           'md:w-48 md:aspect-auto md:h-28',
           'flex-shrink-0'
         )} />

         {/* Content skeleton */}
         <div className="flex-1 space-y-3">
           {/* Title */}
           <div className="h-5 bg-[#222] rounded w-3/4" />
           <div className="h-5 bg-[#222] rounded w-1/2" />

           {/* Metadata */}
           <div className="h-4 bg-[#222] rounded w-1/3" />

           {/* Summary */}
           <div className="space-y-2">
             <div className="h-3 bg-[#222] rounded" />
             <div className="h-3 bg-[#222] rounded w-5/6" />
           </div>
         </div>
       </div>
     );
   }
   ```

### Task 2.3: Page Transitions

**Goal:** Smooth animations between routes

**Implementation:**

1. **Add Framer Motion**
   ```bash
   npm install framer-motion
   ```

2. **Create PageTransition Component**
   ```tsx
   // components/layout/PageTransition.tsx
   'use client';

   import { motion, AnimatePresence } from 'framer-motion';
   import { usePathname } from 'next/navigation';

   const variants = {
     hidden: { opacity: 0, y: 10 },
     enter: { opacity: 1, y: 0 },
     exit: { opacity: 0, y: -10 },
   };

   export function PageTransition({ children }: { children: React.ReactNode }) {
     const pathname = usePathname();

     return (
       <AnimatePresence mode="wait" initial={false}>
         <motion.div
           key={pathname}
           variants={variants}
           initial="hidden"
           animate="enter"
           exit="exit"
           transition={{ duration: 0.2, ease: 'easeOut' }}
         >
           {children}
         </motion.div>
       </AnimatePresence>
     );
   }
   ```

3. **Wrap Page Content**
   ```tsx
   // app/vod-diary/page.tsx
   import { PageTransition } from '@/components/layout/PageTransition';

   export default function VodDiaryPage() {
     return (
       <PageTransition>
         <div className="space-y-6">
           {/* Page content */}
         </div>
       </PageTransition>
     );
   }
   ```

4. **Respect prefers-reduced-motion**
   ```tsx
   // components/layout/PageTransition.tsx
   import { useReducedMotion } from 'framer-motion';

   export function PageTransition({ children }: { children: React.ReactNode }) {
     const shouldReduceMotion = useReducedMotion();

     if (shouldReduceMotion) {
       return <>{children}</>;
     }

     // ... rest of component
   }
   ```

---

## Phase 3: Performance Optimization

**Duration:** 1 week
**Risk Level:** Medium
**Effort:** 30-40 hours

### Task 3.1: Dynamic Imports

**Goal:** Reduce initial bundle size with code splitting

**Implementation:**

1. **Lazy Load Video Player**
   ```tsx
   // app/player/page.tsx
   import dynamic from 'next/dynamic';
   import { SkeletonPlayer } from '@/components/video/SkeletonPlayer';

   const VidstackPlayer = dynamic(
     () => import('@/components/video/VidstackPlayer'),
     {
       loading: () => <SkeletonPlayer />,
       ssr: false, // Video player doesn't need SSR
     }
   );

   export default function PlayerPage() {
     // ... state and logic

     return (
       <div>
         <PageHeader title="Video Player" />
         {videoUrl ? (
           <VidstackPlayer url={videoUrl} subtitleUrl={subtitleUrl} />
         ) : (
           <EmptyState />
         )}
       </div>
     );
   }
   ```

2. **Create SkeletonPlayer**
   ```tsx
   // components/video/SkeletonPlayer.tsx
   export function SkeletonPlayer() {
     return (
       <div className="w-full aspect-video bg-black rounded-lg animate-pulse flex items-center justify-center">
         <Loader2 className="w-12 h-12 text-[#666] animate-spin" />
       </div>
     );
   }
   ```

3. **Lazy Load Date Picker**
   ```tsx
   // app/vod-diary/page.tsx
   import dynamic from 'next/dynamic';
   import { Skeleton } from '@/components/ui/skeleton';

   const DateRangePicker = dynamic(
     () => import('@/components/vod-diary/DateRangePicker').then(mod => ({
       default: mod.DateRangePicker
     })),
     {
       loading: () => <Skeleton className="h-10 w-[280px]" />,
     }
   );
   ```

### Task 3.2: Image Optimization

**Goal:** Optimize all images for web delivery

**Implementation:**

1. **Create optimized Image component**
   ```tsx
   // components/ui/optimized-image.tsx
   'use client';

   import { useState } from 'react';
   import NextImage, { ImageProps } from 'next/image';
   import { cn } from '@/lib/utils';

   interface OptimizedImageProps extends Omit<ImageProps, 'onLoad' | 'onError'> {
     fallback?: React.ReactNode;
   }

   export function OptimizedImage({
     className,
     fallback,
     alt,
     ...props
   }: OptimizedImageProps) {
     const [isLoading, setIsLoading] = useState(true);
     const [error, setError] = useState(false);

     if (error && fallback) {
       return <>{fallback}</>;
     }

     return (
       <div className="relative">
         {isLoading && (
           <div className={cn(
             'absolute inset-0 bg-[#222] animate-pulse',
             className
           )} />
         )}
         <NextImage
           {...props}
           alt={alt}
           className={cn(
             'transition-opacity duration-300',
             isLoading ? 'opacity-0' : 'opacity-100',
             className
           )}
           onLoad={() => setIsLoading(false)}
           onError={() => setError(true)}
         />
       </div>
     );
   }
   ```

2. **Update next.config.js for external images**
   ```js
   // next.config.js
   /** @type {import('next').NextConfig} */
   const nextConfig = {
     images: {
       domains: ['archive.wubby.tv'], // Add trusted image domains
       formats: ['image/avif', 'image/webp'], // Modern formats
       deviceSizes: [320, 420, 768, 1024, 1200],
       imageSizes: [16, 32, 48, 64, 96, 128, 256],
     },
   };

   module.exports = nextConfig;
   ```

### Task 3.3: React Query Integration

**Goal:** Add intelligent caching layer for API calls

**Implementation:**

1. **Install React Query**
   ```bash
   npm install @tanstack/react-query
   ```

2. **Create QueryProvider**
   ```tsx
   // components/providers/QueryProvider.tsx
   'use client';

   import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
   import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
   import { useState } from 'react';

   export function QueryProvider({ children }: { children: React.ReactNode }) {
     const [queryClient] = useState(() => new QueryClient({
       defaultOptions: {
         queries: {
           staleTime: 5 * 60 * 1000, // 5 minutes
           cacheTime: 10 * 60 * 1000, // 10 minutes
           retry: 1,
           refetchOnWindowFocus: false,
         },
       },
     }));

     return (
       <QueryClientProvider client={queryClient}>
         {children}
         {process.env.NODE_ENV === 'development' && <ReactQueryDevtools />}
       </QueryClientProvider>
     );
   }
   ```

3. **Update Root Layout**
   ```tsx
   // app/layout.tsx
   import { QueryProvider } from '@/components/providers/QueryProvider';

   export default function RootLayout({ children }) {
     return (
       <html lang="en">
         <body>
           <QueryProvider>
             {/* ... rest of layout */}
           </QueryProvider>
         </body>
       </html>
     );
   }
   ```

4. **Create Custom Hooks**
   ```tsx
   // lib/hooks/useVideos.ts
   import { useQuery } from '@tanstack/react-query';
   import { fetchRecentVideos, searchVideos } from '@/lib/api/supabase';
   import { Video, Platform } from '@/types/video';

   interface UseVideosOptions {
     platform: Platform;
     fromDate: Date | null;
     toDate: Date | null;
     searchTerm?: string;
   }

   export function useVideos({
     platform,
     fromDate,
     toDate,
     searchTerm,
   }: UseVideosOptions) {
     const isSearchMode = !!searchTerm && searchTerm.trim().length > 0;

     return useQuery({
       queryKey: ['videos', platform, fromDate, toDate, searchTerm],
       queryFn: async () => {
         if (isSearchMode) {
           return searchVideos({ searchTerm: searchTerm!, limit: 200 });
         }
         return fetchRecentVideos({
           limit: 50,
           platform: platform as any,
           fromDate,
           toDate,
         });
       },
       staleTime: 5 * 60 * 1000, // Consider data fresh for 5 min
       cacheTime: 10 * 60 * 1000, // Keep in cache for 10 min
     });
   }
   ```

5. **Refactor VOD Diary to Use Hook**
   ```tsx
   // app/vod-diary/page.tsx
   'use client';

   import { useState } from 'react';
   import { useVideos } from '@/lib/hooks/useVideos';

   export default function VodDiaryPage() {
     const [platform, setPlatform] = useState<Platform>('both');
     const [dateRange, setDateRange] = useState<DateRange | undefined>(() => {
       const { from, to } = getThisWeekRange();
       return { from, to };
     });
     const [searchTerm, setSearchTerm] = useState('');

     // Use React Query hook instead of manual fetching
     const {
       data: videos = [],
       isLoading,
       error,
       refetch,
     } = useVideos({
       platform,
       fromDate: dateRange?.from || null,
       toDate: dateRange?.to || null,
       searchTerm,
     });

     const { showError } = useToast();

     // Handle errors
     useEffect(() => {
       if (error) {
         showError('Failed to load videos. Please try again.', {
           action: {
             label: 'Retry',
             onClick: () => refetch(),
           },
         });
       }
     }, [error, showError, refetch]);

     return (
       <div className="space-y-6">
         <PageHeader ... />
         <VideoList
           videos={videos}
           loading={isLoading}
           isSearchMode={!!searchTerm}
         />
       </div>
     );
   }
   ```

### Task 3.4: Bundle Analysis

**Goal:** Identify and optimize large dependencies

**Implementation:**

1. **Install Analyzer**
   ```bash
   npm install --save-dev @next/bundle-analyzer
   ```

2. **Update next.config.js**
   ```js
   // next.config.js
   const withBundleAnalyzer = require('@next/bundle-analyzer')({
     enabled: process.env.ANALYZE === 'true',
   });

   module.exports = withBundleAnalyzer({
     // ... your existing config
   });
   ```

3. **Add Script to package.json**
   ```json
   {
     "scripts": {
       "analyze": "ANALYZE=true next build"
     }
   }
   ```

4. **Run Analysis**
   ```bash
   npm run analyze
   ```

5. **Review and Optimize**
   - Look for duplicate dependencies
   - Identify large libraries to lazy load
   - Check for unused code to tree-shake

---

## Phase 4: Advanced Features

**Duration:** 2 weeks
**Risk Level:** Low (optional enhancements)
**Effort:** 40-60 hours

### Task 4.1: Filter Bottom Sheet (Mobile)

**Goal:** Move filters to bottom sheet for better mobile UX

**Implementation:**

1. **Install Vaul (Drawer library)**
   ```bash
   npm install vaul
   ```

2. **Create FilterSheet Component**
   ```tsx
   // components/vod-diary/FilterSheet.tsx
   'use client';

   import { Drawer } from 'vaul';
   import { Button } from '@/components/ui/button';
   import { Sliders } from 'lucide-react';
   import { Platform } from './PlatformSlider';
   import { DateRange } from 'react-day-picker';

   interface FilterSheetProps {
     platform: Platform;
     onPlatformChange: (platform: Platform) => void;
     dateRange: DateRange | undefined;
     onDateRangeChange: (range: DateRange | undefined) => void;
   }

   export function FilterSheet({
     platform,
     onPlatformChange,
     dateRange,
     onDateRangeChange,
   }: FilterSheetProps) {
     const [isOpen, setIsOpen] = useState(false);

     const handleApply = () => {
       setIsOpen(false);
     };

     const handleReset = () => {
       onPlatformChange('both');
       onDateRangeChange(getThisWeekRange());
     };

     return (
       <Drawer.Root open={isOpen} onOpenChange={setIsOpen}>
         <Drawer.Trigger asChild>
           <Button
             variant="outline"
             size="touch"
             className="md:hidden"  // Only show on mobile
           >
             <Sliders className="w-5 h-5 mr-2" />
             Filters
           </Button>
         </Drawer.Trigger>

         <Drawer.Portal>
           <Drawer.Overlay className="fixed inset-0 bg-black/40" />
           <Drawer.Content className="bg-[#111] border-t border-[#333] flex flex-col rounded-t-[10px] h-[80vh] mt-24 fixed bottom-0 left-0 right-0">
             <div className="p-4 flex-1 overflow-auto">
               {/* Handle */}
               <div className="mx-auto w-12 h-1.5 flex-shrink-0 rounded-full bg-[#333] mb-6" />

               {/* Title */}
               <Drawer.Title className="font-semibold text-xl mb-6">
                 Filter VODs
               </Drawer.Title>

               {/* Platform Filter */}
               <div className="mb-6">
                 <label className="block text-sm font-medium mb-3">
                   Platform
                 </label>
                 <div className="flex gap-2">
                   {(['both', 'kick', 'twitch'] as const).map((p) => (
                     <Button
                       key={p}
                       variant={platform === p ? 'default' : 'outline'}
                       onClick={() => onPlatformChange(p)}
                       className="flex-1 capitalize"
                     >
                       {p}
                     </Button>
                   ))}
                 </div>
               </div>

               {/* Date Range Filter */}
               <div className="mb-6">
                 <label className="block text-sm font-medium mb-3">
                   Date Range
                 </label>
                 <DateRangePicker
                   value={dateRange}
                   onChange={onDateRangeChange}
                 />
               </div>
             </div>

             {/* Actions */}
             <div className="p-4 border-t border-[#333] flex gap-3">
               <Button
                 variant="outline"
                 onClick={handleReset}
                 className="flex-1"
               >
                 Reset
               </Button>
               <Button
                 onClick={handleApply}
                 className="flex-1"
               >
                 Apply
               </Button>
             </div>
           </Drawer.Content>
         </Drawer.Portal>
       </Drawer.Root>
     );
   }
   ```

3. **Update VOD Diary Page**
   ```tsx
   // app/vod-diary/page.tsx
   <div className="flex flex-wrap gap-4 justify-end items-center">
     {/* Mobile: Filter button opens sheet */}
     <FilterSheet
       platform={platform}
       onPlatformChange={handlePlatformChange}
       dateRange={dateRange}
       onDateRangeChange={handleDateRangeChange}
     />

     {/* Desktop: Inline filters (existing) */}
     <div className="hidden md:flex gap-4">
       <DateRangePicker value={dateRange} onChange={handleDateRangeChange} />
       <PlatformSlider value={platform} onChange={handlePlatformChange} />
     </div>

     {/* Search (both mobile and desktop) */}
     <SearchInput onSearch={handleSearch} />
   </div>
   ```

### Task 4.2: Keyboard Shortcuts (Desktop)

**Goal:** Add power-user keyboard shortcuts

**Implementation:**

1. **Create useKeyboardShortcuts Hook**
   ```tsx
   // lib/hooks/useKeyboardShortcuts.ts
   import { useEffect } from 'react';
   import { useRouter } from 'next/navigation';

   interface KeyboardShortcut {
     key: string;
     ctrl?: boolean;
     meta?: boolean;
     shift?: boolean;
     handler: () => void;
   }

   export function useKeyboardShortcuts(shortcuts: KeyboardShortcut[]) {
     useEffect(() => {
       const handleKeyDown = (e: KeyboardEvent) => {
         // Ignore if typing in input
         if (
           e.target instanceof HTMLInputElement ||
           e.target instanceof HTMLTextAreaElement
         ) {
           return;
         }

         for (const shortcut of shortcuts) {
           const ctrlMatch = shortcut.ctrl ? e.ctrlKey || e.metaKey : true;
           const metaMatch = shortcut.meta ? e.metaKey : true;
           const shiftMatch = shortcut.shift ? e.shiftKey : !e.shiftKey;

           if (
             e.key.toLowerCase() === shortcut.key.toLowerCase() &&
             ctrlMatch &&
             metaMatch &&
             shiftMatch
           ) {
             e.preventDefault();
             shortcut.handler();
           }
         }
       };

       window.addEventListener('keydown', handleKeyDown);
       return () => window.removeEventListener('keydown', handleKeyDown);
     }, [shortcuts]);
   }

   // Global shortcuts hook
   export function useGlobalShortcuts() {
     const router = useRouter();

     useKeyboardShortcuts([
       {
         key: '/',
         handler: () => {
           // Focus search input
           document.querySelector<HTMLInputElement>('[data-search-input]')?.focus();
         },
       },
       {
         key: 'k',
         ctrl: true,
         handler: () => {
           // Open command palette (future)
           console.log('Open command palette');
         },
       },
       {
         key: '1',
         handler: () => router.push('/'),
       },
       {
         key: '2',
         handler: () => router.push('/transcript'),
       },
       {
         key: '3',
         handler: () => router.push('/vod-diary'),
       },
       {
         key: '4',
         handler: () => router.push('/player'),
       },
     ]);
   }
   ```

2. **Add to Root Layout**
   ```tsx
   // components/layout/KeyboardShortcutsProvider.tsx
   'use client';

   import { useGlobalShortcuts } from '@/lib/hooks/useKeyboardShortcuts';

   export function KeyboardShortcutsProvider({ children }) {
     useGlobalShortcuts();
     return <>{children}</>;
   }

   // app/layout.tsx
   <KeyboardShortcutsProvider>
     {children}
   </KeyboardShortcutsProvider>
   ```

3. **Create Shortcuts Help Modal**
   ```tsx
   // components/layout/ShortcutsModal.tsx
   'use client';

   import { useState, useEffect } from 'react';
   import {
     Dialog,
     DialogContent,
     DialogHeader,
     DialogTitle,
   } from '@/components/ui/dialog';

   const shortcuts = [
     { key: '/', description: 'Focus search' },
     { key: 'Ctrl+K', description: 'Command palette' },
     { key: '1-4', description: 'Navigate pages' },
     { key: 'Esc', description: 'Close dialogs' },
   ];

   export function ShortcutsModal() {
     const [isOpen, setIsOpen] = useState(false);

     useEffect(() => {
       const handleKeyDown = (e: KeyboardEvent) => {
         if (e.key === '?' && e.shiftKey) {
           e.preventDefault();
           setIsOpen(true);
         }
       };

       window.addEventListener('keydown', handleKeyDown);
       return () => window.removeEventListener('keydown', handleKeyDown);
     }, []);

     return (
       <Dialog open={isOpen} onOpenChange={setIsOpen}>
         <DialogContent>
           <DialogHeader>
             <DialogTitle>Keyboard Shortcuts</DialogTitle>
           </DialogHeader>
           <div className="space-y-3">
             {shortcuts.map(({ key, description }) => (
               <div key={key} className="flex items-center justify-between">
                 <span className="text-[#ccc]">{description}</span>
                 <kbd className="px-3 py-1 bg-[#222] border border-[#444] rounded text-sm font-mono">
                   {key}
                 </kbd>
               </div>
             ))}
           </div>
           <p className="text-sm text-[#888] mt-4">
             Press <kbd className="px-2 py-1 bg-[#222] rounded">?</kbd> to toggle this modal
           </p>
         </DialogContent>
       </Dialog>
     );
   }
   ```

---

## Testing Strategy

### Manual Testing Checklist

**Phase 1: Foundation**
- [ ] All pages render correctly on 320px, 375px, 768px, 1024px viewports
- [ ] All touch targets are ≥44x44px (use browser DevTools touch emulation)
- [ ] Bottom navigation works on mobile (<768px)
- [ ] Top navigation works on desktop (≥768px)
- [ ] Pull-to-refresh works on VOD Diary (mobile only)
- [ ] No horizontal scrolling at any breakpoint

**Phase 2: Visual**
- [ ] Video cards look polished on mobile and desktop
- [ ] Play button has platform-specific glow on hover
- [ ] Card expand/collapse animation is smooth
- [ ] Skeleton loading shows before content loads
- [ ] Empty states have clear messaging and actions
- [ ] Page transitions are smooth (no flashing)

**Phase 3: Performance**
- [ ] Lighthouse mobile score ≥90
- [ ] Initial page load <3s on 3G
- [ ] Video player lazy loads (not in initial bundle)
- [ ] Date picker lazy loads
- [ ] No console errors or warnings
- [ ] React Query DevTools show cached queries (dev only)

**Phase 4: Features**
- [ ] Filter sheet opens on mobile
- [ ] Filters apply correctly from sheet
- [ ] Keyboard shortcuts work (desktop only)
- [ ] Search focus on `/` key press
- [ ] Page navigation on number keys (1-4)

### Automated Testing

**Unit Tests** (Future)
```bash
# Test utilities
npm test lib/utils/

# Test hooks
npm test lib/hooks/

# Test components
npm test components/
```

**E2E Tests** (Existing)
```bash
# Already have Playwright tests
npm run test:e2e
```

### Performance Testing

**Lighthouse CI**
```bash
# Run Lighthouse locally
npm install -g @lhci/cli

# Collect results
lhci autorun --config=.lighthouserc.json
```

**Create `.lighthouserc.json`**
```json
{
  "ci": {
    "collect": {
      "url": [
        "http://localhost:3000/",
        "http://localhost:3000/vod-diary",
        "http://localhost:3000/player"
      ],
      "numberOfRuns": 3
    },
    "assert": {
      "assertions": {
        "categories:performance": ["error", {"minScore": 0.9}],
        "categories:accessibility": ["error", {"minScore": 1}]
      }
    }
  }
}
```

---

## Rollback Plan

### Git Workflow

1. **Create Feature Branch Per Phase**
   ```bash
   git checkout -b phase-1-mobile-foundation
   # Work on phase 1
   git commit -m "feat: implement mobile-first breakpoints"
   git push origin phase-1-mobile-foundation
   ```

2. **Test Thoroughly Before Merge**
   - Manual testing on real devices
   - E2E tests pass
   - Performance benchmarks met

3. **Merge to Main Only When Complete**
   ```bash
   git checkout main
   git merge phase-1-mobile-foundation
   git push origin main
   ```

### Rollback Commands

**If Something Breaks:**
```bash
# Revert last commit
git revert HEAD
git push origin main

# Or reset to previous working state
git reset --hard <commit-hash>
git push origin main --force
```

### Feature Flags (Optional)

For gradual rollout, use environment variables:

```tsx
// lib/features.ts
export const features = {
  mobileBottomNav: process.env.NEXT_PUBLIC_FEATURE_BOTTOM_NAV === 'true',
  pullToRefresh: process.env.NEXT_PUBLIC_FEATURE_PTR === 'true',
  filterSheet: process.env.NEXT_PUBLIC_FEATURE_FILTER_SHEET === 'true',
};

// app/layout.tsx
{features.mobileBottomNav && <BottomNav />}
```

---

## Timeline & Effort Estimates

| Phase | Duration | Effort (Hours) | Risk | Priority |
|-------|----------|----------------|------|----------|
| **Phase 1: Mobile-First Foundation** | 1-2 weeks | 40-60 | Medium | CRITICAL |
| Task 1.1: Reverse breakpoints | 3-5 days | 16-24 | Low | Critical |
| Task 1.2: Touch targets | 2-3 days | 8-12 | Low | Critical |
| Task 1.3: Bottom navigation | 2-3 days | 12-16 | Medium | High |
| Task 1.4: Pull-to-refresh | 1 day | 4-8 | Low | Medium |
| **Phase 2: Visual Polish** | 1 week | 20-30 | Low | HIGH |
| Task 2.1: Enhanced cards | 3-4 days | 12-16 | Low | High |
| Task 2.2: Loading states | 1-2 days | 4-8 | Low | Medium |
| Task 2.3: Page transitions | 1-2 days | 4-6 | Low | Low |
| **Phase 3: Performance** | 1 week | 30-40 | Medium | HIGH |
| Task 3.1: Dynamic imports | 1-2 days | 6-10 | Low | High |
| Task 3.2: Image optimization | 2-3 days | 10-16 | Medium | High |
| Task 3.3: React Query | 2-3 days | 10-14 | Medium | High |
| Task 3.4: Bundle analysis | 1 day | 4-6 | Low | Medium |
| **Phase 4: Advanced Features** | 2 weeks | 40-60 | Low | MEDIUM |
| Task 4.1: Filter sheet | 3-4 days | 16-24 | Low | Medium |
| Task 4.2: Keyboard shortcuts | 2-3 days | 8-16 | Low | Low |
| **Total** | **5-7 weeks** | **130-190** | Medium | - |

---

## Success Criteria

### Phase 1 Complete When:
- ✅ No horizontal scrolling on any viewport
- ✅ All touch targets ≥44px
- ✅ Bottom nav functional on mobile
- ✅ Pull-to-refresh working

### Phase 2 Complete When:
- ✅ Video cards look polished (subjective but clear)
- ✅ Loading states feel fast
- ✅ Animations smooth (60fps)

### Phase 3 Complete When:
- ✅ Lighthouse mobile score ≥90
- ✅ Bundle size reduced by 30%+
- ✅ API calls cached intelligently

### Phase 4 Complete When:
- ✅ Filter sheet UX excellent on mobile
- ✅ Keyboard shortcuts documented and functional

---

## Next Steps

1. **Review this plan** with team/stakeholders
2. **Prioritize phases** based on business needs
3. **Set up development branch**
4. **Begin Phase 1, Task 1.1** (Reverse breakpoints)
5. **Test incrementally** on real devices

---

**Document Version:** 1.0
**Last Updated:** 2025-11-13
**Maintainer:** Claude AI
**Next Review:** After Phase 1 completion
