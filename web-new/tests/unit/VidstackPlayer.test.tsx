import { describe, it, expect, beforeEach } from 'vitest';
import { render } from '@testing-library/react';
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
