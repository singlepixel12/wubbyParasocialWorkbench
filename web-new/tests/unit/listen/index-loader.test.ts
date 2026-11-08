import { describe, it, expect, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { childBoxes } from '@/lib/listen/boxes';
import { locateMoov, loadAudioIndex, type FetchRangeFn } from '@/lib/listen/index-loader';
import { parseAudioTrack } from '@/lib/listen/mp4-index';
import { RangeFetchError } from '@/lib/listen/range-fetch';

const fixture = (f: string) => new Uint8Array(readFileSync(path.resolve(__dirname, '../../fixtures/listen', f)));

function fakeFetch(file: Uint8Array): FetchRangeFn & { calls: Array<[number, number]> } {
  const calls: Array<[number, number]> = [];
  const fn = vi.fn(async (_url: string, start: number, end: number) => {
    calls.push([start, end]);
    if (start >= file.length) throw new RangeFetchError('range-unsupported', '416', 416);
    return { bytes: file.slice(start, Math.min(end, file.length - 1) + 1), lastModified: 'LM' };
  });
  return Object.assign(fn, { calls });
}

describe('locateMoov', () => {
  it('walks top-level boxes with 16-byte reads to the moov at the end', async () => {
    const file = fixture('tiny.mp4');
    const expected = childBoxes(file, 0, file.length).find((b) => b.type === 'moov')!;
    const fetchRange = fakeFetch(file);
    const loc = await locateMoov('u', { fetchRange });
    expect(loc).toEqual({ start: expected.start, size: expected.size, lastModified: 'LM' });
    expect(fetchRange.calls.every(([s, e]) => e - s === 15)).toBe(true);
  });

  it('finds an early moov in a faststart file', async () => {
    const fetchRange = fakeFetch(fixture('tiny-faststart.mp4'));
    await locateMoov('u', { fetchRange });
    expect(fetchRange.calls.length).toBeLessThanOrEqual(3);
  });

  it('reports no-moov when the file ends without one', async () => {
    const file = fixture('tiny.mp4');
    const moov = childBoxes(file, 0, file.length).find((b) => b.type === 'moov')!;
    await expect(locateMoov('u', { fetchRange: fakeFetch(file.slice(0, moov.start)) })).rejects.toMatchObject({ code: 'no-moov' });
  });

  it('reports no-moov when a box runs to end-of-file (size 0)', async () => {
    const file = Uint8Array.from([0, 0, 0, 16, 0x66, 0x74, 0x79, 0x70, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0x6d, 0x64, 0x61, 0x74, 9, 9, 9, 9, 9, 9, 9, 9]);
    await expect(locateMoov('u', { fetchRange: fakeFetch(file) })).rejects.toMatchObject({ code: 'no-moov' });
  });
});

describe('loadAudioIndex', () => {
  it('downloads the moov in pieces, reports progress, and parses it', async () => {
    const file = fixture('tiny.mp4');
    const moov = childBoxes(file, 0, file.length).find((b) => b.type === 'moov')!;
    const fetchRange = fakeFetch(file);
    const progress = vi.fn();
    const index = await loadAudioIndex('u', { fetchRange, pieceSize: 1000, onProgress: progress });
    const direct = parseAudioTrack(file.subarray(moov.start, moov.start + moov.size), 'LM');
    expect(Array.from(index.sampleSizes)).toEqual(Array.from(direct.sampleSizes));
    expect(index.lastModified).toBe('LM');
    expect(progress).toHaveBeenLastCalledWith(moov.size, moov.size);
    // Exclude locateMoov's 16-byte header read, which also starts at moov.start.
    const pieces = fetchRange.calls.filter(([s, e]) => s >= moov.start && e - s !== 15);
    expect(pieces.length).toBe(Math.ceil(moov.size / 1000));
    expect(pieces.every(([s, e]) => e - s < 1000)).toBe(true);
  });

  it('pins Last-Modified on every moov piece', async () => {
    const file = fixture('tiny.mp4');
    const fetchRange = fakeFetch(file);
    await loadAudioIndex('u', { fetchRange, pieceSize: 4000 });
    const opts = (fetchRange as unknown as { mock: { calls: unknown[][] } }).mock.calls.slice(1).map((c) => c[3] as { expectedLastModified?: string });
    expect(opts.every((o) => o.expectedLastModified === 'LM')).toBe(true);
  });
});
