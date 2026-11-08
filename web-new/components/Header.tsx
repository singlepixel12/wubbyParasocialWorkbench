'use client';

/**
 * Header component with hamburger menu
 * Main landing page is VOD Diary - other pages accessible via menu
 * Updated: Week 0-1 Two-Tier UX implementation
 */

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Menu, FileText, ArrowLeft, Download } from 'lucide-react';
import { promptInstall, useCanInstall } from '@/lib/offline/install-prompt';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { cn } from '@/lib/utils';

/**
 * Secondary navigation links (hidden in hamburger menu)
 */
const MENU_LINKS = [
  {
    href: '/transcript',
    label: 'Get Transcript',
    icon: FileText,
    description: 'Extract and view video transcripts',
  },
] as const;

export function Header() {
  const pathname = usePathname();
  const [isOpen, setIsOpen] = useState(false);
  const canInstall = useCanInstall();

  return (
    <header className="sticky top-0 z-40 border-b border-rule bg-background/90 backdrop-blur-sm">
      <div className="container mx-auto px-4 py-3">
        <div className="flex items-center justify-between">
          {/* Site Title — editorial wordmark */}
          <div className="flex items-center gap-1">
            {pathname === '/watch' && (
              <Link
                href="/"
                aria-label="Back to VOD Diary"
                className="-ml-2 flex h-10 w-10 items-center justify-center rounded-md text-ink-muted transition-colors hover:bg-muted hover:text-foreground"
              >
                <ArrowLeft className="h-5 w-5" />
              </Link>
            )}
            <Link
              href="/"
              className="font-display text-xl tracking-tight text-foreground transition-colors hover:text-accent-green"
            >
              The Wubby <span className="italic text-accent-green">Archive</span>
            </Link>
          </div>

          {/* Hamburger Menu */}
          <Sheet open={isOpen} onOpenChange={setIsOpen}>
            <SheetTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="text-ink-muted hover:bg-muted hover:text-foreground"
                aria-label="Open menu"
              >
                <Menu className="w-5 h-5" />
              </Button>
            </SheetTrigger>

            <SheetContent side="right" className="w-[300px] bg-background border-l border-rule">
              <SheetHeader>
                <SheetTitle className="font-display text-foreground">Navigation</SheetTitle>
              </SheetHeader>

              <nav className="mt-6 space-y-2">
                {MENU_LINKS.map((link) => {
                  const isActive = pathname === link.href;
                  const Icon = link.icon;

                  return (
                    <Link
                      key={link.href}
                      href={link.href}
                      onClick={() => setIsOpen(false)}
                      className={cn(
                        'flex items-start gap-3 p-3 rounded-md transition-colors',
                        isActive
                          ? 'bg-accent-green text-white'
                          : 'text-ink-muted hover:bg-muted hover:text-foreground'
                      )}
                    >
                      <Icon className="w-5 h-5 mt-0.5 flex-shrink-0" />
                      <div className="flex-1">
                        <div className="font-medium">{link.label}</div>
                        <div className="text-xs text-ink-muted mt-0.5">{link.description}</div>
                      </div>
                    </Link>
                  );
                })}
              </nav>

              {/* Only while Chrome offers it: installs the app to the home screen, where it opens
                  with no signal (the worker caches the whole site). */}
              {canInstall && (
                <button
                  type="button"
                  onClick={() => {
                    setIsOpen(false);
                    void promptInstall();
                  }}
                  className="mt-2 flex w-full items-start gap-3 rounded-md p-3 text-left text-ink-muted transition-colors hover:bg-muted hover:text-foreground"
                >
                  <Download className="w-5 h-5 mt-0.5 flex-shrink-0 text-accent-green" />
                  <div className="flex-1">
                    <div className="font-medium">Install app</div>
                    <div className="text-xs text-ink-muted mt-0.5">Home-screen app that opens with no signal</div>
                  </div>
                </button>
              )}

              <div className="absolute bottom-6 left-6 right-6">
                <div className="text-center font-mono text-[0.65rem] uppercase tracking-[0.2em] text-ink-muted">
                  The Wubby Archive
                  <br />
                  v1.0 — Two-Tier UX
                </div>
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
  );
}
