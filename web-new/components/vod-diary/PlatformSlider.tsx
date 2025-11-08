'use client';

/**
 * PlatformSlider Component
 * Custom 3-state platform filter slider (Both/Twitch/Kick)
 * Ported from: vod-diary.html platform-slider
 */

import { cn } from '@/lib/utils';

export type Platform = 'both' | 'twitch' | 'kick';

interface PlatformSliderProps {
  value: Platform;
  onChange: (platform: Platform) => void;
  className?: string;
}

export function PlatformSlider({
  value,
  onChange,
  className,
}: PlatformSliderProps) {
  const handleClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const ratio = x / rect.width;

    let target: Platform = 'both';
    if (ratio < 0.33) target = 'both';
    else if (ratio < 0.66) target = 'twitch';
    else target = 'kick';

    onChange(target);
  };

  return (
    <div
      onClick={handleClick}
      className={cn(
        'relative w-full max-w-[180px] h-8 rounded-2xl cursor-pointer transition-colors duration-300 border',
        value === 'both' && 'bg-black border-[#666]',
        value === 'twitch' && 'bg-[#6441A5] border-[#6441A5]',
        value === 'kick' && 'bg-[#28a745] border-[#28a745]',
        className
      )}
      data-state={value}
      role="radiogroup"
      aria-label="Platform filter"
    >
      {/* Option labels */}
      <span
        className={cn(
          'absolute left-2.5 top-1/2 -translate-y-1/2 text-[0.65rem] pointer-events-none transition-all duration-300',
          value === 'both' && 'opacity-0',
          value === 'both' ? 'text-[#888]' : 'text-white'
        )}
      >
        both
      </span>
      <span
        className={cn(
          'absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-[0.65rem] pointer-events-none transition-all duration-300',
          value === 'twitch' && 'opacity-0',
          value === 'both' ? 'text-[#888]' : 'text-white'
        )}
      >
        twitch
      </span>
      <span
        className={cn(
          'absolute right-2.5 top-1/2 -translate-y-1/2 text-[0.65rem] pointer-events-none transition-all duration-300',
          value === 'kick' && 'opacity-0',
          value === 'both' ? 'text-[#888]' : 'text-white'
        )}
      >
        kick
      </span>

      {/* Sliding thumb */}
      <div
        className={cn(
          'absolute top-0 w-[60px] h-full rounded-2xl bg-white flex items-center justify-center text-[0.7rem] font-semibold text-black transition-[left] duration-300',
          value === 'both' && 'left-0',
          value === 'twitch' && 'left-[calc(50%-30px)]',
          value === 'kick' && 'left-[calc(100%-60px)]'
        )}
        role="radio"
        aria-checked={true}
        aria-label={`${value} platform selected`}
      >
        <span className="thumb-label">{value}</span>
      </div>
    </div>
  );
}
