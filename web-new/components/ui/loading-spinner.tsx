/**
 * LoadingSpinner Component
 * Reusable loading spinner with size variants and optional message
 * Replaces duplicate spinner code across the application
 */

import { cn } from '@/lib/utils';

interface LoadingSpinnerProps {
  size?: 'sm' | 'md' | 'lg';
  message?: string;
  className?: string;
}

const sizeMap = {
  sm: 'h-6 w-6',
  md: 'h-12 w-12',
  lg: 'h-16 w-16',
};

export function LoadingSpinner({ size = 'md', message, className }: LoadingSpinnerProps) {
  return (
    <div className={cn('flex items-center justify-center', className)}>
      <div className="text-center">
        <div
          className={cn(
            'inline-block animate-spin rounded-full border-b-2 border-white',
            sizeMap[size]
          )}
          role="status"
          aria-live="polite"
          aria-label={message || 'Loading'}
        >
          <span className="sr-only">{message || 'Loading...'}</span>
        </div>
        {message && <p className="mt-4 text-[#777]">{message}</p>}
      </div>
    </div>
  );
}
