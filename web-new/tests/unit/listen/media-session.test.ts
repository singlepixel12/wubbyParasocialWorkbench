import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { bindMediaSession } from '@/lib/listen/media-session';

type Handler = ((details: MediaSessionActionDetails) => void) | null;
let handlers: Record<string, Handler>;
let session: { metadata: unknown; playbackState: string; setActionHandler: ReturnType<typeof vi.fn>; setPositionState: ReturnType<typeof vi.fn> };

beforeEach(() => {
  handlers = {};
  session = {
    metadata: null,
    playbackState: 'none',
    setActionHandler: vi.fn((action: string, h: Handler) => {
      handlers[action] = h;
    }),
    setPositionState: vi.fn(),
  };
  Object.defineProperty(navigator, 'mediaSession', { value: session, configurable: true });
  vi.stubGlobal('MediaMetadata', class {
    init: unknown;
    constructor(init: unknown) {
      this.init = init;
    }
  });
});
afterEach(() => vi.unstubAllGlobals());

function fakeAudio() {
  const audio = document.createElement('audio');
  Object.defineProperty(audio, 'duration', { value: 3600, configurable: true });
  Object.defineProperty(audio, 'currentTime', { value: 120, writable: true, configurable: true });
  return audio;
}

describe('bindMediaSession', () => {
  it('sets title and artwork and wires the lock-screen actions', () => {
    const h = { play: vi.fn(), pause: vi.fn(), seekBy: vi.fn(), seekTo: vi.fn() };
    bindMediaSession(fakeAudio(), { title: 'Costco Pizzas', artist: 'PayMoneyWubby', artworkUrl: 'https://x/t.webp' }, h);
    expect(session.metadata).toMatchObject({ init: { title: 'Costco Pizzas', artist: 'PayMoneyWubby', artwork: [{ src: 'https://x/t.webp' }] } });
    handlers.play!({ action: 'play' });
    handlers.pause!({ action: 'pause' });
    handlers.seekbackward!({ action: 'seekbackward' });
    handlers.seekforward!({ action: 'seekforward', seekOffset: 10 });
    handlers.seekto!({ action: 'seekto', seekTime: 600 });
    expect(h.play).toHaveBeenCalled();
    expect(h.pause).toHaveBeenCalled();
    expect(h.seekBy.mock.calls).toEqual([[-30], [10]]);
    expect(h.seekTo).toHaveBeenCalledWith(600);
  });

  it('reports position including playback rate on play/ratechange/seeked', () => {
    const audio = fakeAudio();
    bindMediaSession(audio, { title: 't' }, { play: vi.fn(), pause: vi.fn(), seekBy: vi.fn(), seekTo: vi.fn() });
    audio.playbackRate = 1.5;
    audio.dispatchEvent(new Event('ratechange'));
    expect(session.setPositionState).toHaveBeenLastCalledWith({ duration: 3600, position: 120, playbackRate: 1.5 });
  });

  it('unbinds everything', () => {
    const unbind = bindMediaSession(fakeAudio(), { title: 't' }, { play: vi.fn(), pause: vi.fn(), seekBy: vi.fn(), seekTo: vi.fn() });
    unbind();
    expect(session.metadata).toBeNull();
    expect(handlers.play).toBeNull();
    expect(handlers.seekto).toBeNull();
  });
});
