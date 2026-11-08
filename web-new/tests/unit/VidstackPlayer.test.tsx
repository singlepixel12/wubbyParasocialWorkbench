import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, waitFor } from '@testing-library/react';
import { VidstackPlayer, VIDSTACK_CDN } from '@/components/video/VidstackPlayer';

describe('VidstackPlayer CDN assets', () => {
  beforeEach(() => {
    document.head.querySelectorAll('link, script').forEach((el) => el.remove());
  });

  it('pins an exact Vidstack version', () => {
    expect(VIDSTACK_CDN).toBe('https://cdn.jsdelivr.net/npm/vidstack@0.6.15');
  });

  it('loads the pinned CSS and JS', () => {
    render(<VidstackPlayer videoUrl="https://example.com/v.mp4" />);
    expect(document.head.querySelector(`link[href="${VIDSTACK_CDN}/styles/defaults.css"]`)).not.toBeNull();
    expect(document.head.querySelector(`link[href="${VIDSTACK_CDN}/styles/community-skin/video.css"]`)).not.toBeNull();
    expect(document.head.querySelector(`script[src="${VIDSTACK_CDN}/dist/cdn/prod.js"]`)).not.toBeNull();
  });
});

describe('VidstackPlayer video hooks', () => {
  it('applies the playback rate and reports time updates from the inner <video>', async () => {
    const onTimeUpdate = vi.fn();
    const { container } = render(<VidstackPlayer videoUrl="https://example.com/v.mp4" playbackRate={1.5} onTimeUpdate={onTimeUpdate} />);
    const video = document.createElement('video');
    container.querySelector('media-player')!.appendChild(video); // Vidstack would create this
    await waitFor(() => expect(video.playbackRate).toBe(1.5));
    video.dispatchEvent(new Event('timeupdate'));
    expect(onTimeUpdate).toHaveBeenCalled();
  });
});
