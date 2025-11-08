'use client';

/**
 * Header component with navigation
 * Provides main navigation between all pages in the app
 */

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';

/**
 * Navigation links configuration
 */
const NAV_LINKS = [
  {
    href: '/',
    label: 'Transcription Details',
    ariaLabel: 'Go to Transcription Details page',
  },
  {
    href: '/transcript',
    label: 'Get Transcript',
    ariaLabel: 'Go to Get Transcript page',
  },
  {
    href: '/vod-diary',
    label: 'VOD Diary',
    ariaLabel: 'Go to VOD Diary page',
  },
  {
    href: '/player',
    label: 'Player',
    ariaLabel: 'Go to Video Player page',
  },
] as const;

export function Header() {
  const pathname = usePathname();

  return (
    <header className="border-b border-border bg-background">
      <div className="container mx-auto px-4 py-4">
        {/* Site Title */}
        <h1 className="mb-4 text-2xl font-bold text-foreground">
          Parasocial Workbench
        </h1>

        {/* Navigation */}
        <nav aria-label="Main navigation">
          <ul
            role="menubar"
            className="flex flex-wrap gap-2 md:gap-4"
          >
            {NAV_LINKS.map((link) => {
              const isActive = pathname === link.href;

              return (
                <li key={link.href} role="none">
                  <Link
                    href={link.href}
                    role="menuitem"
                    aria-label={link.ariaLabel}
                    aria-current={isActive ? 'page' : undefined}
                    className={cn(
                      // Base styles
                      'inline-block rounded-md px-4 py-2 text-sm font-medium transition-colors',
                      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
                      // Active state
                      isActive
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-muted text-muted-foreground hover:bg-accent hover:text-accent-foreground'
                    )}
                  >
                    {link.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
      </div>
    </header>
  );
}
