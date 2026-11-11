'use client';

/**
 * Sticky wordmark header: a back arrow on /watch, and the menu (install, the diary, what's saved
 * for offline, transcripts). The downloads sheet opens from here on every page, not only from the
 * diary masthead chip.
 */

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { Menu, FileText, ArrowLeft, Download, BookOpen, Smartphone, type LucideIcon } from 'lucide-react';
import { promptInstall, useCanInstall } from '@/lib/offline/install-prompt';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { cn } from '@/lib/utils';
import { useStandalone } from '@/lib/hooks/useStandalone';
import { useDownloads } from '@/lib/listen/downloads-store';
import { totals } from '@/lib/listen/download-model';
import { DownloadsSheet } from '@/components/listen/DownloadsSheet';

const size = (b: number) => (b >= 1e9 ? `${(b / 1e9).toFixed(1)} GB` : `${Math.round(b / 1e6)} MB`);

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

function MenuLink({ href, label, description, icon: Icon, active, onNavigate }: { href: string; label: string; description: string; icon: LucideIcon; active: boolean; onNavigate: () => void }) {
  return (
    <Link
      href={href}
      onClick={onNavigate}
      aria-current={active ? 'page' : undefined}
      className={cn('flex items-start gap-3 rounded-md p-3 transition-colors', active ? 'bg-muted text-foreground' : 'text-ink-muted hover:bg-muted hover:text-foreground')}
    >
      <Icon className={cn('mt-0.5 h-5 w-5 flex-shrink-0', active && 'text-accent-green')} />
      <div className="flex-1">
        <div className="font-medium text-foreground">{label}</div>
        <div className="mt-0.5 text-xs text-ink-muted">{description}</div>
      </div>
    </Link>
  );
}

export function Header() {
  const pathname = usePathname();
  const [isOpen, setIsOpen] = useState(false);
  const canInstall = useCanInstall();
  const standalone = useStandalone();
  const downloads = useDownloads();
  const saved = totals(downloads);
  const [showDownloads, setShowDownloads] = useState(false);
  const router = useRouter();

  // Where the app was before this page. Back from /watch to a diary we came from in this window
  // (the installed app opens cards here; so does the downloads sheet) is a real Back, so the diary
  // returns with its filters, loaded pages and scroll (see diary-snapshot). Anything else (a /watch
  // opened in its own tab, or from a notification) links to the diary.
  const current = useRef<string | null>(null);
  const previous = useRef<string | null>(null);
  useEffect(() => {
    if (current.current === pathname) return;
    previous.current = current.current;
    current.current = pathname;
  }, [pathname]);

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
                onClick={(e) => {
                  if (previous.current !== '/') return;
                  e.preventDefault();
                  router.back();
                }}
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
                <p className="font-mono text-[0.65rem] uppercase tracking-[0.25em] text-ink-muted">The Wubby Archive</p>
                <SheetTitle className="font-display text-foreground">Menu</SheetTitle>
              </SheetHeader>

              {/* Only while Chrome offers it, and first: the installed app opens with no signal
                  (the worker caches the whole site). */}
              {canInstall && (
                <button
                  type="button"
                  onClick={() => {
                    setIsOpen(false);
                    void promptInstall();
                  }}
                  className="mx-4 flex items-start gap-3 rounded-md border border-accent-green/50 p-3 text-left text-foreground transition-colors hover:bg-muted"
                >
                  <Smartphone className="mt-0.5 h-5 w-5 flex-shrink-0 text-accent-green" />
                  <div className="flex-1">
                    <div className="font-medium">Install app</div>
                    <div className="mt-0.5 text-xs text-ink-muted">On your home screen, and it opens with no signal</div>
                  </div>
                </button>
              )}

              <nav className="mt-2 space-y-1 px-4">
                <MenuLink href="/" label="VOD Diary" description="This week's VODs, search and dates" icon={BookOpen} active={pathname === '/'} onNavigate={() => setIsOpen(false)} />
                <button
                  type="button"
                  onClick={() => {
                    setIsOpen(false);
                    setShowDownloads(true);
                  }}
                  className="flex w-full items-start gap-3 rounded-md p-3 text-left text-ink-muted transition-colors hover:bg-muted hover:text-foreground"
                >
                  <Download className="mt-0.5 h-5 w-5 flex-shrink-0" />
                  <div className="flex-1">
                    <div className="font-medium text-foreground">Saved for offline</div>
                    <div className="mt-0.5 text-xs text-ink-muted">
                      {downloads.length ? `${saved.ready} ready${saved.partial ? ` · ${saved.partial} unfinished` : ''} · ${size(saved.bytesStored)}` : 'Nothing saved yet'}
                    </div>
                  </div>
                </button>
                {MENU_LINKS.map((link) => (
                  <MenuLink key={link.href} {...link} active={pathname === link.href} onNavigate={() => setIsOpen(false)} />
                ))}
              </nav>

              <div className="absolute bottom-6 left-6 right-6 text-center font-mono text-[0.65rem] uppercase tracking-[0.2em] text-ink-muted">
                {standalone ? 'Installed · opens with no signal' : 'Archive · est. wubby.tv'}
              </div>
            </SheetContent>
          </Sheet>
          <DownloadsSheet open={showDownloads} onOpenChange={setShowDownloads} manifests={downloads} />
        </div>
      </div>
    </header>
  );
}
