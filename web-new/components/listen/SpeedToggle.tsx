'use client';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { PlaybackRate } from '@/lib/listen/types';

export function SpeedToggle({ rate, onChange, className }: { rate: PlaybackRate; onChange: (rate: PlaybackRate) => void; className?: string }) {
  const fast = rate === 1.5;
  return (
    <Button
      type="button"
      variant="outline"
      aria-pressed={fast}
      aria-label={fast ? 'Speed 1.5×, tap for normal speed' : 'Speed 1×, tap for 1.5×'}
      onClick={() => onChange(fast ? 1 : 1.5)}
      className={cn('h-12 font-mono text-base', fast && 'border-accent-green bg-accent-green/15 text-accent-green', className)}
    >
      {fast ? '1.5× on' : '1.5×'}
    </Button>
  );
}
