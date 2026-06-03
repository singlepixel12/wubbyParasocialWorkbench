/**
 * Unit tests for VideoCard component
 *
 * Covers the editorial "archive record" card: Fraunces title, running record
 * number, a scannable hook that expands in place ("Read more" / "Show less"),
 * topic tags (no platform badge), and a thumbnail that opens the watch page in
 * a new tab. There is intentionally no platform badge and no localStorage write
 * on click — the card navigates via the video hash.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { VideoCard } from '@/components/vod-diary/VideoCard';
import { createMockVideo, renderWithProviders } from '../test-utils';

// Mock the video-helpers used by VideoCard so rendering is deterministic.
// extractHook returns the text unchanged so the collapsed hook === the summary.
vi.mock('@/lib/utils/video-helpers', () => ({
  formatDateDisplay: () => 'Jan 1, 2025',
  extractOriginalTitle: () => 'Original Title',
  extractHook: (text: string) => text,
}));

describe('VideoCard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Rendering', () => {
    it('should render the video title', () => {
      const video = createMockVideo({ title: 'Test Video Title' });
      renderWithProviders(<VideoCard video={video} />);

      expect(screen.getByText('Test Video Title')).toBeInTheDocument();
    });

    it('should render the video summary hook', () => {
      const video = createMockVideo({ summary: 'Test video summary' });
      renderWithProviders(<VideoCard video={video} />);

      expect(screen.getByText('Test video summary')).toBeInTheDocument();
    });

    it('should render the formatted date', () => {
      const video = createMockVideo({ date: '2025-01-01' });
      renderWithProviders(<VideoCard video={video} />);

      expect(screen.getByText('Jan 1, 2025')).toBeInTheDocument();
    });

    it('should render the original title from the URL', () => {
      const video = createMockVideo();
      renderWithProviders(<VideoCard video={video} />);

      expect(screen.getByText('Original Title')).toBeInTheDocument();
    });

    it('should render the record number when an index is provided', () => {
      const video = createMockVideo();
      renderWithProviders(<VideoCard video={video} index={0} />);

      // index 0 → "№ 01"
      expect(screen.getByText(/№/)).toHaveTextContent('01');
    });

    it('should render a play affordance labelled with the title', () => {
      const video = createMockVideo({ title: 'Test Video' });
      renderWithProviders(<VideoCard video={video} />);

      expect(screen.getByLabelText('Play Test Video')).toBeInTheDocument();
    });

    it('should not render a platform badge', () => {
      const video = createMockVideo({ platform: 'twitch', tags: [] });
      renderWithProviders(<VideoCard video={video} />);

      expect(screen.queryByText('twitch')).not.toBeInTheDocument();
    });
  });

  describe('Expand and collapse', () => {
    it('should start collapsed with a "Read more" control', () => {
      const video = createMockVideo();
      renderWithProviders(<VideoCard video={video} />);

      expect(screen.getByRole('button', { name: /read more/i })).toBeInTheDocument();
    });

    it('should reveal the full summary and a "Show less" control when expanded', async () => {
      const user = userEvent.setup();
      const video = createMockVideo({ summary: 'Full summary body text' });
      renderWithProviders(<VideoCard video={video} />);

      await user.click(screen.getByRole('button', { name: /read more/i }));

      expect(screen.getByRole('button', { name: /show less/i })).toBeInTheDocument();
      expect(screen.getByText('Full summary body text')).toBeInTheDocument();
    });

    it('should toggle back to collapsed', async () => {
      const user = userEvent.setup();
      const video = createMockVideo();
      renderWithProviders(<VideoCard video={video} />);

      await user.click(screen.getByRole('button', { name: /read more/i }));
      await user.click(screen.getByRole('button', { name: /show less/i }));

      expect(screen.getByRole('button', { name: /read more/i })).toBeInTheDocument();
    });
  });

  describe('Tags', () => {
    it('should render topic tags', () => {
      const video = createMockVideo({ tags: ['gaming', 'funny'] });
      renderWithProviders(<VideoCard video={video} />);

      // Tags appear in both the mobile and desktop preview containers.
      expect(screen.getAllByText('gaming').length).toBeGreaterThan(0);
      expect(screen.getAllByText('funny').length).toBeGreaterThan(0);
    });

    it('should filter out a tag that duplicates the platform', () => {
      const video = createMockVideo({ platform: 'twitch', tags: ['gaming', 'twitch'] });
      renderWithProviders(<VideoCard video={video} />);

      expect(screen.queryByText('twitch')).not.toBeInTheDocument();
      expect(screen.getAllByText('gaming').length).toBeGreaterThan(0);
    });
  });

  describe('Thumbnail interaction', () => {
    let openSpy: ReturnType<typeof vi.spyOn>;

    beforeEach(() => {
      openSpy = vi.spyOn(window, 'open').mockImplementation(() => null);
    });

    afterEach(() => {
      openSpy.mockRestore();
    });

    it('should open the watch page in a new tab using the video hash', async () => {
      const user = userEvent.setup();
      const video = createMockVideo({ videoHash: 'abc123' });
      renderWithProviders(<VideoCard video={video} />);

      await user.click(screen.getByLabelText(`Play ${video.title}`));

      expect(openSpy).toHaveBeenCalledWith(
        expect.stringContaining('/watch?id=abc123'),
        '_blank'
      );
    });

    it('should call onCardClick when the thumbnail is clicked', async () => {
      const user = userEvent.setup();
      const onCardClick = vi.fn();
      const video = createMockVideo({ videoHash: 'abc123' });
      renderWithProviders(<VideoCard video={video} onCardClick={onCardClick} />);

      await user.click(screen.getByLabelText(`Play ${video.title}`));

      expect(onCardClick).toHaveBeenCalledWith(video);
    });

    it('should not toggle expansion when the thumbnail is clicked', async () => {
      const user = userEvent.setup();
      const video = createMockVideo({ videoHash: 'abc123' });
      renderWithProviders(<VideoCard video={video} />);

      await user.click(screen.getByLabelText(`Play ${video.title}`));

      // Still collapsed.
      expect(screen.getByRole('button', { name: /read more/i })).toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    it('should label the play affordance with the video title', () => {
      const video = createMockVideo({ title: 'My Stream' });
      renderWithProviders(<VideoCard video={video} />);

      expect(screen.getByLabelText('Play My Stream')).toBeInTheDocument();
    });

    it('should expose the expand control as a button', () => {
      const video = createMockVideo();
      renderWithProviders(<VideoCard video={video} />);

      expect(screen.getByRole('button', { name: /read more/i })).toBeInTheDocument();
    });
  });
});
