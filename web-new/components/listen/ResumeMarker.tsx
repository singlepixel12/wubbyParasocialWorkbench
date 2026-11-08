'use client';

import { Headphones } from 'lucide-react';
import { formatClock, isFinished } from '@/lib/listen/positions';
import { useSavedPosition } from '@/lib/listen/useSavedPosition';

export function ResumeMarker({ hash }: { hash?: string }) {
  const position = useSavedPosition(hash);
  if (!position || isFinished(position)) return null;
  return (
    <span className="flex items-center gap-1 text-accent-green">
      <Headphones className="h-3 w-3" aria-hidden />
      Resume {formatClock(position.t)}
    </span>
  );
}
