/**
 * WHAT THIS FILE CANNOT COVER (checked by hand in Chrome; see lib/video/subtitles.ts):
 * - that Vidstack 0.6.15 actually draws the cues in <media-captions> over the video, and shows
 *   the CC button
 * - that its native <track> mirror loads the blob: URL with no "Unsafe attempt to load URL"
 * - caption legibility on a phone, and in fullscreen
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { addSubtitles } from '@/lib/video/subtitles';

const URL_VTT = 'https://x.supabase.co/storage/v1/object/public/wubbytranscript/h/en/subtitle.vtt';

function player() {
  const add = vi.fn();
  const el = Object.assign(document.createElement('div'), { textTracks: { add } });
  return { el, add };
}

afterEach(() => vi.unstubAllGlobals());

describe('addSubtitles', () => {
  it('fetches the .vtt with CORS and gives Vidstack a same-origin blob URL, showing by default', async () => {
    const fetchMock = vi.fn(async () => new Response('WEBVTT\n\n00:00.000 --> 00:01.000\nhi\n'));
    vi.stubGlobal('fetch', fetchMock);
    const { el, add } = player();
    const blob = await addSubtitles(el, URL_VTT, new AbortController().signal);
    expect(fetchMock).toHaveBeenCalledWith(URL_VTT, expect.objectContaining({ mode: 'cors' }));
    expect(blob).toMatch(/^blob:/);
    expect(add).toHaveBeenCalledWith({ src: blob, kind: 'subtitles', label: 'English', language: 'en-US', default: true });
  });

  it('adds nothing when the VOD has no subtitles yet (storage answers 400)', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('{"error":"not found"}', { status: 400 })));
    const { el, add } = player();
    expect(await addSubtitles(el, URL_VTT, new AbortController().signal)).toBeNull();
    expect(add).not.toHaveBeenCalled();
  });

  it('adds nothing for a file that is not WebVTT', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('<html>oops</html>')));
    const { el, add } = player();
    expect(await addSubtitles(el, URL_VTT, new AbortController().signal)).toBeNull();
    expect(add).not.toHaveBeenCalled();
  });

  it('does not fetch at all when the player has no track list yet', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    expect(await addSubtitles(document.createElement('div'), URL_VTT, new AbortController().signal)).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('an abort (player torn down) adds nothing', async () => {
    const ctrl = new AbortController();
    vi.stubGlobal('fetch', vi.fn(async () => {
      ctrl.abort();
      return new Response('WEBVTT\n');
    }));
    const { el, add } = player();
    await expect(addSubtitles(el, URL_VTT, ctrl.signal)).rejects.toThrow();
    expect(add).not.toHaveBeenCalled();
  });
});
