'use client';

/**
 * SearchInput Component
 * Toggleable search input with debouncing (300ms)
 * Ported from: vod-diary.html search functionality
 */

import React, { useState, useEffect } from 'react';
import { Search, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useDebounce } from '@/lib/hooks/useDebounce';
import { cn } from '@/lib/utils';

interface SearchInputProps {
  onSearch: (searchTerm: string) => void;
  isVisible?: boolean;
  onToggle?: (visible: boolean) => void;
  className?: string;
}

export function SearchInput({ onSearch, isVisible: controlledVisible, onToggle, className }: SearchInputProps) {
  const [internalVisible, setInternalVisible] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  // Use controlled visibility if provided, otherwise use internal state
  const isVisible = controlledVisible !== undefined ? controlledVisible : internalVisible;

  // Debounce search term by 300ms
  const debouncedSearchTerm = useDebounce(searchTerm, 300);

  // Trigger search when debounced value changes
  useEffect(() => {
    onSearch(debouncedSearchTerm);
  }, [debouncedSearchTerm, onSearch]);

  const handleToggle = () => {
    const newVisible = !isVisible;
    if (isVisible) {
      // Hiding search - clear it
      setSearchTerm('');
      onSearch('');
    }

    // Update visibility (controlled or internal)
    if (onToggle) {
      onToggle(newVisible);
    } else {
      setInternalVisible(newVisible);
    }
  };

  const handleClear = () => {
    setSearchTerm('');
    onSearch('');
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      // Immediate search on Enter
      onSearch(searchTerm);
    }
  };

  return (
    <div className={cn('flex items-center gap-2', className)}>
      {/* Search input (shown when visible) */}
      {isVisible && (
        <div className="relative flex-1">
          <Input
            type="text"
            placeholder="Search by title, tags, or URL..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            onKeyDown={handleKeyDown}
            className="pr-10"
            aria-label="Search videos"
            autoFocus
          />
          {searchTerm && (
            <Button
              variant="ghost"
              size="icon"
              onClick={handleClear}
              className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
              aria-label="Clear search"
            >
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>
      )}

      {/* Toggle button - now on the right */}
      <Button
        variant="outline"
        size="icon"
        onClick={handleToggle}
        className={cn(
          'transition-colors flex-shrink-0',
          isVisible && 'bg-primary text-primary-foreground hover:bg-primary/90'
        )}
        aria-label="Toggle search"
        title="Search videos"
      >
        <Search className="h-4 w-4" />
      </Button>
    </div>
  );
}
