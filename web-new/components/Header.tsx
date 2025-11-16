'use client';

/**
 * Header component with hamburger menu
 * Main landing page is VOD Diary - other pages accessible via menu
 * Updated: Week 0-1 Two-Tier UX implementation
 */

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Menu, FileText, Video, Home } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { cn } from '@/lib/utils';

/**
 * Secondary navigation links (hidden in hamburger menu)
 */
const MENU_LINKS = [
  {
    href: '/video-metadata',
    label: 'Video Metadata',
    icon: Home,
    description: 'View video metadata and hash information',
  },
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

  return (
    <header className="sticky top-0 z-40 border-b border-[#333] bg-[#111]/95 backdrop-blur-sm">
      <div className="container mx-auto px-4 py-3">
        <div className="flex items-center justify-between">
          {/* Site Title */}
          <Link href="/" className="text-xl font-bold text-white hover:text-[#28a745] transition-colors">
            Wubby Parasocial Workbench
          </Link>

          {/* Hamburger Menu */}
          <Sheet open={isOpen} onOpenChange={setIsOpen}>
            <SheetTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="text-[#ccc] hover:text-white hover:bg-[#222]"
                aria-label="Open menu"
              >
                <Menu className="w-5 h-5" />
              </Button>
            </SheetTrigger>

            <SheetContent side="right" className="w-[300px] bg-[#111] border-l border-[#333]">
              <SheetHeader>
                <SheetTitle className="text-white">Navigation</SheetTitle>
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
                        'flex items-start gap-3 p-3 rounded-lg transition-colors',
                        isActive
                          ? 'bg-[#28a745] text-white'
                          : 'text-[#ccc] hover:bg-[#222] hover:text-white'
                      )}
                    >
                      <Icon className="w-5 h-5 mt-0.5 flex-shrink-0" />
                      <div className="flex-1">
                        <div className="font-medium">{link.label}</div>
                        <div className="text-xs text-[#888] mt-0.5">{link.description}</div>
                      </div>
                    </Link>
                  );
                })}
              </nav>

              <div className="absolute bottom-6 left-6 right-6">
                <div className="text-xs text-[#666] text-center">
                  Wubby Parasocial Workbench
                  <br />
                  v1.0 - Two-Tier UX
                </div>
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
  );
}
