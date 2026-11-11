// Subtitles for the Vidstack player (0.6.15). Checked in Chrome on 2026-11-10.
//
// - Vidstack draws captions itself (<media-captions>) from ITS OWN track list. The old <track> in
//   <media-outlet> never reached that list (the <video> renders inside Vidstack's own
//   <shadow-root> element), so no subtitles ever showed.
// - Vidstack also mirrors each track into a native <track> on the <video>. For a cross-origin
//   .vtt that copy is blocked ("Unsafe attempt to load URL") unless the <video> has
//   `crossorigin`, which would change how the 27 GB VOD itself is fetched.
// So: fetch the .vtt once with CORS (Supabase storage allows any origin) and hand Vidstack a
// same-origin blob: URL. Both its renderer and the native mirror load that without errors.
import { logger } from '../utils/logger';

interface VidstackTextTrackList {
  add(init: { src: string; kind: 'subtitles'; label: string; language: string; default?: boolean }): unknown;
}

/**
 * Fetch the English subtitles and register them with the player, showing. Call it once
 * playback loads, so opening /watch downloads nothing.
 * Returns the blob URL (revoke it on cleanup), or null when there's nothing to show: the VOD has
 * no subtitles yet (storage answers 400), the file isn't WebVTT, or the player has no track list.
 * Rejects on a network error or an abort.
 */
export async function addSubtitles(player: HTMLElement, url: string, signal: AbortSignal): Promise<string | null> {
  const list = (player as HTMLElement & { textTracks?: VidstackTextTrackList }).textTracks;
  if (!list || typeof list.add !== 'function') return null;
  const res = await fetch(url, { mode: 'cors', signal });
  if (!res.ok) return null;
  const text = await res.text();
  if (!text.trimStart().startsWith('WEBVTT')) {
    logger.warn('Subtitle file is not WebVTT; skipping');
    return null;
  }
  signal.throwIfAborted();
  const blobUrl = URL.createObjectURL(new Blob([text], { type: 'text/vtt' }));
  list.add({ src: blobUrl, kind: 'subtitles', label: 'English', language: 'en-US', default: true });
  return blobUrl;
}
