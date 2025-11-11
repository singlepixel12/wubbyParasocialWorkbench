'use client';
import { logger } from '@/lib/utils/logger';

/**
 * HashDisplay Component
 * Displays the video hash and API status
 * Ported from: index.html (lines 50-53)
 */

import { cn } from '@/lib/utils';

interface HashDisplayProps {
  hash: string;
  status: string;
  isSuccess: boolean;
}

export function HashDisplay({ hash, status, isSuccess }: HashDisplayProps) {
  logger.log('HashDisplay render:', { hash, status, isSuccess });

  return (
    <div
      className="flex flex-col gap-2 sm:flex-row sm:gap-4 rounded-md bg-muted p-3"
      role="status"
      aria-live="polite"
      aria-atomic="true"
    >
      {/* Hash Value */}
      <code className="text-xs sm:text-sm font-mono break-all">
        <span className="font-semibold">Hash:</span>{' '}
        <span className="text-muted-foreground">{hash || '-'}</span>
      </code>

      {/* Status Value */}
      <code
        className={cn(
          'text-xs sm:text-sm font-mono whitespace-nowrap',
          isSuccess ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'
        )}
      >
        <span className="font-semibold">Status:</span>{' '}
        <span>{status || '-'}</span>
      </code>
    </div>
  );
}
