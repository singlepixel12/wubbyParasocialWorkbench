/**
 * Unit tests for VideoCard component
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { VideoCard } from '@/components/vod-diary/VideoCard';
import { createMockVideo, renderWithProviders } from '../test-utils';

// Mock Next.js Link component
vi.mock('next/link', () => ({
  default: ({ children, ...props }: any) => <a {...props}>{children}</a>,
}));

// Mock logger
vi.mock('@/lib/utils/logger', () => ({
  logger: {
    debug: vi.fn(),
    log: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

// Mock video-helpers
vi.mock('@/lib/utils/video-helpers', () => ({
  formatDateDisplay: (date: Date) => 'Jan 1, 2025',
  extractOriginalTitle: (url: string) => 'Original Title',
}));

describe('VideoCard', () => {
  let mockLocalStorage: Storage;

  beforeEach(() => {
    vi.clearAllMocks();

    // Mock localStorage
    const storage: Record<string, string> = {};
    mockLocalStorage = {
      getItem: vi.fn((key: string) => storage[key] || null),
      setItem: vi.fn((key: string, value: string) => {
        storage[key] = value;
      }),
      removeItem: vi.fn((key: string) => {
        delete storage[key];
      }),
      clear: vi.fn(() => {
        Object.keys(storage).forEach((key) => delete storage[key]);
      }),
      length: 0,
      key: vi.fn(),
    };
    Object.defineProperty(window, 'localStorage', {
      value: mockLocalStorage,
      writable: true,
    });
  });

  describe('Rendering', () => {
    it('should render video title', () => {
      const video = createMockVideo({ title: 'Test Video Title' });
      renderWithProviders(<VideoCard video={video} />);

      expect(screen.getByText('Test Video Title')).toBeInTheDocument();
    });

    it('should render video summary', () => {
      const video = createMockVideo({ summary: 'Test video summary' });
      renderWithProviders(<VideoCard video={video} />);

      expect(screen.getByText('Test video summary')).toBeInTheDocument();
    });

    it('should render platform badge', () => {
      const video = createMockVideo({ platform: 'twitch' });
      renderWithProviders(<VideoCard video={video} />);

      expect(screen.getByText('twitch')).toBeInTheDocument();
    });

    it('should render formatted date', () => {
      const video = createMockVideo({ date: '2025-01-01' });
      renderWithProviders(<VideoCard video={video} />);

      expect(screen.getByText('Jan 1, 2025')).toBeInTheDocument();
    });

    it('should render original title from URL', () => {
      const video = createMockVideo();
      renderWithProviders(<VideoCard video={video} />);

      expect(screen.getByText('Original Title')).toBeInTheDocument();
    });

    it('should render play button', () => {
      const video = createMockVideo();
      renderWithProviders(<VideoCard video={video} />);

      const playLink = screen.getByRole('link', { name: /play/i });
      expect(playLink).toBeInTheDocument();
    });
  });

  describe('Expand/Collapse Functionality', () => {
    it('should start collapsed', () => {
      const video = createMockVideo({ tags: ['tag1', 'tag2'] });
      renderWithProviders(<VideoCard video={video} />);

      const expandButton = screen.getByRole('button', { name: /expand/i });
      expect(expandButton).toBeInTheDocument();
      expect(expandButton).toHaveTextContent('Expand ▼');
    });

    it('should expand when clicked', async () => {
      const user = userEvent.setup();
      const video = createMockVideo({ tags: ['tag1', 'tag2'] });
      renderWithProviders(<VideoCard video={video} />);

      const expandButton = screen.getByRole('button', { name: /expand/i });
      await user.click(expandButton);

      expect(screen.getByRole('button', { name: /collapse/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /collapse/i })).toHaveTextContent(
        'Collapse ▲'
      );
    });

    it('should show tags when expanded', async () => {
      const user = userEvent.setup();
      const video = createMockVideo({ tags: ['gaming', 'funny', 'twitch'] });
      renderWithProviders(<VideoCard video={video} />);

      // Initially tags shouldn't be visible (in collapsed content)
      const expandButton = screen.getByRole('button', { name: /expand/i });
      await user.click(expandButton);

      // After expanding, tags should be visible (except platform tag)
      expect(screen.getByText('gaming')).toBeInTheDocument();
      expect(screen.getByText('funny')).toBeInTheDocument();
    });

    it('should toggle between expanded and collapsed', async () => {
      const user = userEvent.setup();
      const video = createMockVideo();
      renderWithProviders(<VideoCard video={video} />);

      const expandButton = screen.getByRole('button', { name: /expand/i });

      // Expand
      await user.click(expandButton);
      expect(screen.getByRole('button', { name: /collapse/i })).toBeInTheDocument();

      // Collapse
      const collapseButton = screen.getByRole('button', { name: /collapse/i });
      await user.click(collapseButton);
      expect(screen.getByRole('button', { name: /expand/i })).toBeInTheDocument();
    });

    it('should expand when clicking card body', async () => {
      const user = userEvent.setup();
      const video = createMockVideo({ title: 'Click Me' });
      const { container } = renderWithProviders(<VideoCard video={video} />);

      // Click on the card container
      const cardDiv = container.querySelector('.cursor-pointer');
      if (cardDiv) {
        await user.click(cardDiv);
      }

      expect(screen.getByRole('button', { name: /collapse/i })).toBeInTheDocument();
    });
  });

  describe('Platform Badge Styling', () => {
    it('should show Kick badge for Kick videos', () => {
      const video = createMockVideo({ platform: 'kick' });
      renderWithProviders(<VideoCard video={video} />);

      const badge = screen.getByText('kick');
      expect(badge).toBeInTheDocument();
    });

    it('should show Twitch badge for Twitch videos', () => {
      const video = createMockVideo({ platform: 'twitch' });
      renderWithProviders(<VideoCard video={video} />);

      const badge = screen.getByText('twitch');
      expect(badge).toBeInTheDocument();
    });

    it('should filter out platform tag from tags list', async () => {
      const user = userEvent.setup();
      const video = createMockVideo({ platform: 'twitch', tags: ['gaming', 'twitch', 'funny'] });
      renderWithProviders(<VideoCard video={video} />);

      const expandButton = screen.getByRole('button', { name: /expand/i });
      await user.click(expandButton);

      // Should show gaming and funny tags
      expect(screen.getByText('gaming')).toBeInTheDocument();
      expect(screen.getByText('funny')).toBeInTheDocument();

      // Platform badge should be shown separately, not duplicated in tags
      const twitchElements = screen.getAllByText('twitch');
      expect(twitchElements.length).toBe(1); // Only in badge, not in tags
    });
  });

  describe('Thumbnail Click Behavior', () => {
    it('should store video URL in localStorage when thumbnail clicked', async () => {
      const user = userEvent.setup();
      const video = createMockVideo({ url: 'https://archive.wubby.tv/test.mp4' });
      renderWithProviders(<VideoCard video={video} />);

      const playLink = screen.getByRole('link', { name: /play/i });
      await user.click(playLink);

      expect(mockLocalStorage.setItem).toHaveBeenCalledWith(
        'selectedVideoUrl',
        'https://archive.wubby.tv/test.mp4'
      );
    });

    it('should call onCardClick callback when thumbnail clicked', async () => {
      const user = userEvent.setup();
      const onCardClick = vi.fn();
      const video = createMockVideo();
      renderWithProviders(<VideoCard video={video} onCardClick={onCardClick} />);

      const playLink = screen.getByRole('link', { name: /play/i });
      await user.click(playLink);

      expect(onCardClick).toHaveBeenCalledWith(video);
    });

    it('should not expand card when thumbnail is clicked', async () => {
      const user = userEvent.setup();
      const video = createMockVideo();
      renderWithProviders(<VideoCard video={video} />);

      const playLink = screen.getByRole('link', { name: /play/i });
      await user.click(playLink);

      // Card should still be collapsed
      expect(screen.getByRole('button', { name: /expand/i })).toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    it('should have proper link aria-label', () => {
      const video = createMockVideo({ title: 'Test Video' });
      renderWithProviders(<VideoCard video={video} />);

      const playLink = screen.getByRole('link', { name: /play test video/i });
      expect(playLink).toBeInTheDocument();
    });

    it('should open player in new tab', () => {
      const video = createMockVideo();
      renderWithProviders(<VideoCard video={video} />);

      const playLink = screen.getByRole('link', { name: /play/i });
      expect(playLink).toHaveAttribute('target', '_blank');
    });

    it('should have proper button labels', () => {
      const video = createMockVideo();
      renderWithProviders(<VideoCard video={video} />);

      const expandButton = screen.getByRole('button', { name: /expand/i });
      expect(expandButton).toBeInTheDocument();
    });
  });
});
