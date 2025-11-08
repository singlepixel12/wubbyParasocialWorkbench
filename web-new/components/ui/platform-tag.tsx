/**
 * PlatformTag Component
 * Reusable platform tag with consistent color styling
 * Supports both simple solid color and ring-badge variants
 */

import { cn } from '@/lib/utils';

interface PlatformTagProps {
  platform: string;
  variant?: 'simple' | 'badge';
  className?: string;
}

/**
 * Get platform-specific color classes
 * @param platform - Platform name (kick, twitch, or other)
 * @param variant - Style variant
 */
function getPlatformClasses(platform: string, variant: 'simple' | 'badge'): string {
  const normalizedPlatform = platform.toLowerCase();

  if (variant === 'simple') {
    // Solid color variant (for VideoCard, player/page)
    switch (normalizedPlatform) {
      case 'kick':
        return 'bg-[#1e7e34] text-white';
      case 'twitch':
        return 'bg-[#6441A5] text-white';
      default:
        return 'bg-[#666] text-white';
    }
  } else {
    // Badge variant with rings (for VideoMetadata)
    switch (normalizedPlatform) {
      case 'kick':
        return 'bg-green-50 text-green-700 ring-green-600/20 dark:bg-green-500/10 dark:text-green-400 dark:ring-green-500/30';
      case 'twitch':
        return 'bg-purple-50 text-purple-700 ring-purple-600/20 dark:bg-purple-500/10 dark:text-purple-400 dark:ring-purple-500/30';
      default:
        return 'bg-gray-50 text-gray-700 ring-gray-600/20 dark:bg-gray-500/10 dark:text-gray-400 dark:ring-gray-500/30';
    }
  }
}

export function PlatformTag({ platform, variant = 'simple', className }: PlatformTagProps) {
  const baseClasses =
    variant === 'simple'
      ? 'inline-block px-3 py-1 rounded-full text-xs font-medium'
      : 'inline-flex items-center rounded-full px-3 py-1 text-xs font-medium ring-1 ring-inset';

  return (
    <span className={cn(baseClasses, getPlatformClasses(platform, variant), className)}>
      {platform}
    </span>
  );
}
