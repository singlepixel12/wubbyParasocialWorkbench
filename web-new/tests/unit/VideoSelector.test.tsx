/**
 * Unit tests for VideoSelector component
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { VideoSelector } from '@/components/video/VideoSelector';
import { renderWithProviders } from '../test-utils';

// Mock logger
vi.mock('@/lib/utils/logger', () => ({
  logger: {
    debug: vi.fn(),
    log: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    group: vi.fn(),
    groupEnd: vi.fn(),
  },
}));

describe('VideoSelector', () => {
  const defaultProps = {
    videoUrl: '',
    onVideoUrlChange: vi.fn(),
    onLoad: vi.fn(),
    onClear: vi.fn(),
    isLoading: false,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Rendering', () => {
    it('should render input field', () => {
      renderWithProviders(<VideoSelector {...defaultProps} />);

      const input = screen.getByRole('combobox', { name: /video url/i });
      expect(input).toBeInTheDocument();
    });

    it('should render Load button', () => {
      renderWithProviders(<VideoSelector {...defaultProps} />);

      const loadButton = screen.getByRole('button', { name: /load video data/i });
      expect(loadButton).toBeInTheDocument();
    });

    it('should render Clear button', () => {
      renderWithProviders(<VideoSelector {...defaultProps} />);

      const clearButton = screen.getByRole('button', { name: /clear video input/i });
      expect(clearButton).toBeInTheDocument();
    });

    it('should display placeholder text', () => {
      renderWithProviders(<VideoSelector {...defaultProps} />);

      const input = screen.getByPlaceholderText(/enter archive.wubby.tv url/i);
      expect(input).toBeInTheDocument();
    });

    it('should render datalist with sample videos', () => {
      renderWithProviders(<VideoSelector {...defaultProps} />);

      const datalist = document.getElementById('video-options');
      expect(datalist).toBeInTheDocument();
      expect(datalist?.children.length).toBeGreaterThan(0);
    });
  });

  describe('Input Interaction', () => {
    it('should call onVideoUrlChange when input value changes', async () => {
      const user = userEvent.setup();
      const onVideoUrlChange = vi.fn();

      renderWithProviders(
        <VideoSelector {...defaultProps} onVideoUrlChange={onVideoUrlChange} />
      );

      const input = screen.getByRole('combobox', { name: /video url/i });
      await user.type(input, 'https://archive.wubby.tv/test.mp4');

      expect(onVideoUrlChange).toHaveBeenCalled();
    });

    it('should display the current videoUrl value', () => {
      renderWithProviders(
        <VideoSelector {...defaultProps} videoUrl="https://archive.wubby.tv/test.mp4" />
      );

      const input = screen.getByRole('combobox', { name: /video url/i }) as HTMLInputElement;
      expect(input.value).toBe('https://archive.wubby.tv/test.mp4');
    });

    it('should disable input when loading', () => {
      renderWithProviders(<VideoSelector {...defaultProps} isLoading={true} />);

      const input = screen.getByRole('combobox', { name: /video url/i });
      expect(input).toBeDisabled();
    });
  });

  describe('Load Button', () => {
    it('should call onLoad when clicked', async () => {
      const user = userEvent.setup();
      const onLoad = vi.fn();

      renderWithProviders(
        <VideoSelector
          {...defaultProps}
          videoUrl="https://archive.wubby.tv/test.mp4"
          onLoad={onLoad}
        />
      );

      const loadButton = screen.getByRole('button', { name: /load video data/i });
      await user.click(loadButton);

      expect(onLoad).toHaveBeenCalledTimes(1);
    });

    it('should be disabled when videoUrl is empty', () => {
      renderWithProviders(<VideoSelector {...defaultProps} videoUrl="" />);

      const loadButton = screen.getByRole('button', { name: /load video data/i });
      expect(loadButton).toBeDisabled();
    });

    it('should be disabled when videoUrl is only whitespace', () => {
      renderWithProviders(<VideoSelector {...defaultProps} videoUrl="   " />);

      const loadButton = screen.getByRole('button', { name: /load video data/i });
      expect(loadButton).toBeDisabled();
    });

    it('should be disabled when loading', () => {
      renderWithProviders(
        <VideoSelector
          {...defaultProps}
          videoUrl="https://archive.wubby.tv/test.mp4"
          isLoading={true}
        />
      );

      const loadButton = screen.getByRole('button', { name: /load video data/i });
      expect(loadButton).toBeDisabled();
    });

    it('should be enabled when videoUrl is not empty and not loading', () => {
      renderWithProviders(
        <VideoSelector
          {...defaultProps}
          videoUrl="https://archive.wubby.tv/test.mp4"
          isLoading={false}
        />
      );

      const loadButton = screen.getByRole('button', { name: /load video data/i });
      expect(loadButton).not.toBeDisabled();
    });

    it('should show "Loading..." text when loading', () => {
      renderWithProviders(
        <VideoSelector
          {...defaultProps}
          videoUrl="https://archive.wubby.tv/test.mp4"
          isLoading={true}
        />
      );

      const loadButton = screen.getByRole('button', { name: /load video data/i });
      expect(loadButton).toHaveTextContent('Loading...');
    });

    it('should show "Load" text when not loading', () => {
      renderWithProviders(
        <VideoSelector
          {...defaultProps}
          videoUrl="https://archive.wubby.tv/test.mp4"
          isLoading={false}
        />
      );

      const loadButton = screen.getByRole('button', { name: /load video data/i });
      expect(loadButton).toHaveTextContent('Load');
    });
  });

  describe('Clear Button', () => {
    it('should call onClear when clicked', async () => {
      const user = userEvent.setup();
      const onClear = vi.fn();

      renderWithProviders(<VideoSelector {...defaultProps} onClear={onClear} />);

      const clearButton = screen.getByRole('button', { name: /clear video input/i });
      await user.click(clearButton);

      expect(onClear).toHaveBeenCalledTimes(1);
    });

    it('should be disabled when loading', () => {
      renderWithProviders(<VideoSelector {...defaultProps} isLoading={true} />);

      const clearButton = screen.getByRole('button', { name: /clear video input/i });
      expect(clearButton).toBeDisabled();
    });

    it('should be enabled when not loading', () => {
      renderWithProviders(<VideoSelector {...defaultProps} isLoading={false} />);

      const clearButton = screen.getByRole('button', { name: /clear video input/i });
      expect(clearButton).not.toBeDisabled();
    });
  });

  describe('Accessibility', () => {
    it('should have aria-label on input', () => {
      renderWithProviders(<VideoSelector {...defaultProps} />);

      const input = screen.getByRole('combobox', { name: /video url/i });
      expect(input).toHaveAttribute('aria-label', 'Video URL');
    });

    it('should have aria-describedby on input', () => {
      renderWithProviders(<VideoSelector {...defaultProps} />);

      const input = screen.getByRole('combobox', { name: /video url/i });
      expect(input).toHaveAttribute('aria-describedby', 'video-input-help');
    });

    it('should have sr-only help text', () => {
      renderWithProviders(<VideoSelector {...defaultProps} />);

      const helpText = document.getElementById('video-input-help');
      expect(helpText).toBeInTheDocument();
      expect(helpText).toHaveClass('sr-only');
    });

    it('should have aria-label on buttons', () => {
      renderWithProviders(<VideoSelector {...defaultProps} />);

      const loadButton = screen.getByRole('button', { name: /load video data/i });
      const clearButton = screen.getByRole('button', { name: /clear video input/i });

      expect(loadButton).toHaveAttribute('aria-label');
      expect(clearButton).toHaveAttribute('aria-label');
    });
  });
});
