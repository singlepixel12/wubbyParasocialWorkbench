/**
 * The player must download nothing until the viewer asks for video (load="custom"), because the
 * VODs keep a 23.6 MB moov at the end of a 27 GB file and Vidstack's default preload pulled ~31 MB
 * just for opening /watch on mobile data.
 *
 * Its own file: it defines a stand-in <media-player> custom element so startLoading/play can be
 * spied on, and that definition must not leak into other test files.
 */
import { describe, it, expect, vi, beforeAll } from 'vitest';
import { render, fireEvent, waitFor } from '@testing-library/react';
import { VidstackPlayer } from '@/components/video/VidstackPlayer';

class FakePlayer extends HTMLElement {
  startLoading = vi.fn();
  play = vi.fn(async () => {});
  currentTime = 0;
}

beforeAll(() => {
  customElements.define('media-player', FakePlayer);
});

const playerIn = (container: HTMLElement) => container.querySelector('media-player') as FakePlayer;

describe('VidstackPlayer loading', () => {
  it('uses load="custom", so opening the page downloads nothing', async () => {
    const { container } = render(<VidstackPlayer videoUrl="https://example.com/v.mp4" />);
    const player = playerIn(container);
    expect(player.getAttribute('load')).toBe('custom');
    await new Promise((r) => setTimeout(r, 50));
    expect(player.startLoading).not.toHaveBeenCalled();
  });

  it('starts loading on the first touch, once, and plays when it can', async () => {
    const { container } = render(<VidstackPlayer videoUrl="https://example.com/v.mp4" />);
    const player = playerIn(container);
    fireEvent.pointerDown(player);
    fireEvent.pointerDown(player);
    await waitFor(() => expect(player.startLoading).toHaveBeenCalledTimes(1));
    expect(player.play).not.toHaveBeenCalled();
    player.dispatchEvent(new Event('can-play'));
    expect(player.play).toHaveBeenCalledTimes(1);
  });

  it('starts loading from the keyboard too (Enter / Space)', async () => {
    const { container } = render(<VidstackPlayer videoUrl="https://example.com/v.mp4" />);
    const player = playerIn(container);
    fireEvent.keyDown(player, { key: 'Tab' });
    await new Promise((r) => setTimeout(r, 20));
    expect(player.startLoading).not.toHaveBeenCalled();
    fireEvent.keyDown(player, { key: 'Enter' });
    await waitFor(() => expect(player.startLoading).toHaveBeenCalledTimes(1));
  });

  it('autoPlay loads straight away and plays (Watch pressed from Listen)', async () => {
    const { container } = render(<VidstackPlayer videoUrl="https://example.com/v.mp4" autoPlay />);
    const player = playerIn(container);
    await waitFor(() => expect(player.startLoading).toHaveBeenCalledTimes(1));
    player.dispatchEvent(new Event('can-play'));
    expect(player.play).toHaveBeenCalledTimes(1);
  });
});
