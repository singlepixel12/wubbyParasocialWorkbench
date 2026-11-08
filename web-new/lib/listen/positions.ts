// Per-VOD listening/watching position and the global speed, in localStorage.
// Storage failures (quota, private mode) are swallowed: losing a position is acceptable, crashing is not.
import type { PlaybackRate } from './types';

export interface SavedPosition {
  t: number;
  d: number;
  at: number;
}

const POS_PREFIX = 'listen:pos:';
export const RATE_KEY = 'listen:rate';
/** Fired on window after a same-tab write (the `storage` event only fires in OTHER tabs). */
export const POSITION_EVENT = 'listen-position';
/** Within this many seconds of the end counts as finished. */
export const FINISHED_WITHIN_SEC = 120;

type Reader = Pick<Storage, 'getItem'>;
type Writer = Pick<Storage, 'setItem' | 'removeItem'>;

function safeStorage(): Storage | null {
  try {
    return typeof window === 'undefined' ? null : window.localStorage;
  } catch {
    return null;
  }
}

export const positionKey = (hash: string) => POS_PREFIX + hash;

export function parsePosition(raw: string | null): SavedPosition | null {
  if (!raw) return null;
  try {
    const p = JSON.parse(raw) as Partial<SavedPosition>;
    if (typeof p.t !== 'number' || !Number.isFinite(p.t) || typeof p.d !== 'number') return null;
    return { t: p.t, d: p.d, at: Number(p.at) || 0 };
  } catch {
    return null;
  }
}

export function readPosition(hash: string, storage: Reader | null = safeStorage()): SavedPosition | null {
  return storage ? parsePosition(storage.getItem(positionKey(hash))) : null;
}

export function writePosition(hash: string, t: number, d: number, storage: Writer | null = safeStorage(), now = Date.now()): void {
  if (!storage || !Number.isFinite(t) || t < 5) return;
  try {
    storage.setItem(positionKey(hash), JSON.stringify({ t: Math.round(t), d: Number.isFinite(d) ? Math.round(d) : 0, at: now }));
  } catch {
    return;
  }
  if (typeof window !== 'undefined') window.dispatchEvent(new Event(POSITION_EVENT));
}

export function isFinished(p: SavedPosition | null): boolean {
  return !!p && p.d > 0 && p.t >= p.d - FINISHED_WITHIN_SEC;
}

/** Where to start: 3 s before the saved spot for context, or 0 if none or finished. */
export function resumeTime(p: SavedPosition | null): number {
  if (!p || isFinished(p)) return 0;
  return Math.max(0, p.t - 3);
}

export function readRate(storage: Reader | null = safeStorage()): PlaybackRate {
  return storage?.getItem(RATE_KEY) === '1.5' ? 1.5 : 1;
}

export function writeRate(rate: PlaybackRate, storage: Writer | null = safeStorage()): void {
  try {
    storage?.setItem(RATE_KEY, String(rate));
  } catch {
    // ignore
  }
}

export function formatClock(totalSec: number): string {
  const s = Math.max(0, Math.floor(totalSec));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = String(s % 60).padStart(2, '0');
  return h ? `${h}:${String(m).padStart(2, '0')}:${sec}` : `${m}:${sec}`;
}
