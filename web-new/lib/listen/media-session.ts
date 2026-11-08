// Lock-screen / notification controls for Listen. Returns an unbind function.
export interface SessionMeta {
  title: string;
  artist?: string;
  artworkUrl?: string;
}
export interface SessionHandlers {
  play(): void;
  pause(): void;
  seekBy(deltaSec: number): void;
  seekTo(sec: number): void;
}

const ACTIONS: MediaSessionAction[] = ['play', 'pause', 'seekbackward', 'seekforward', 'seekto'];
const SKIP_SEC = 30;

export function bindMediaSession(audio: HTMLMediaElement, meta: SessionMeta, h: SessionHandlers): () => void {
  if (typeof navigator === 'undefined' || !('mediaSession' in navigator)) return () => undefined;
  const session = navigator.mediaSession;

  try {
    if (typeof MediaMetadata !== 'undefined') {
      session.metadata = new MediaMetadata({
        title: meta.title,
        artist: meta.artist ?? 'PayMoneyWubby',
        album: 'The Wubby Archive',
        artwork: meta.artworkUrl ? [{ src: meta.artworkUrl, sizes: '512x288', type: 'image/webp' }] : [],
      });
    }
  } catch {
    // Metadata is cosmetic; controls still work without it.
  }

  const set = (action: MediaSessionAction, handler: MediaSessionActionHandler | null) => {
    try {
      session.setActionHandler(action, handler);
    } catch {
      // Older browsers throw for unsupported actions.
    }
  };
  set('play', () => h.play());
  set('pause', () => h.pause());
  set('seekbackward', (d) => h.seekBy(-(d.seekOffset ?? SKIP_SEC)));
  set('seekforward', (d) => h.seekBy(d.seekOffset ?? SKIP_SEC));
  set('seekto', (d) => {
    if (typeof d.seekTime === 'number') h.seekTo(d.seekTime);
  });

  const updatePosition = () => {
    session.playbackState = audio.paused ? 'paused' : 'playing';
    const duration = audio.duration;
    if (!Number.isFinite(duration) || duration <= 0 || !session.setPositionState) return;
    try {
      session.setPositionState({ duration, position: Math.min(Math.max(0, audio.currentTime), duration), playbackRate: audio.playbackRate || 1 });
    } catch {
      // A transiently inconsistent position must not break playback.
    }
  };
  const events = ['play', 'pause', 'ratechange', 'seeked', 'durationchange'] as const;
  for (const e of events) audio.addEventListener(e, updatePosition);
  updatePosition();

  return () => {
    for (const e of events) audio.removeEventListener(e, updatePosition);
    for (const a of ACTIONS) set(a, null);
    try {
      session.metadata = null;
      session.playbackState = 'none';
    } catch {
      // ignore
    }
  };
}
