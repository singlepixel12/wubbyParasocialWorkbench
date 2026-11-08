import { readBoxHeader } from './boxes';
import { mapLimit } from './concurrency';
import { parseAudioTrack } from './mp4-index';
import { fetchRange as defaultFetchRange, RangeFetchError, type FetchRangeOptions, type RangeResult } from './range-fetch';
import { ListenError, type AudioIndex } from './types';

export type FetchRangeFn = (url: string, start: number, endInclusive: number, opts?: FetchRangeOptions) => Promise<RangeResult>;

export interface MoovLocation {
  start: number;
  size: number;
  lastModified: string | null;
}

export interface LoadIndexOptions {
  signal?: AbortSignal;
  onProgress?: (loaded: number, total: number) => void;
  onRetry?: FetchRangeOptions['onRetry'];
  onOffline?: () => void;
  fetchRange?: FetchRangeFn;
  /** moov is fetched in pieces this big so a slow link isn't one giant request. Default 1 MiB. */
  pieceSize?: number;
  /** Default 4. */
  concurrency?: number;
}

const MAX_TOP_LEVEL_BOXES = 32;

/** Find the moov by reading 16-byte box headers from the start of the file (ftyp, mdat, …). */
export async function locateMoov(url: string, opts: LoadIndexOptions = {}): Promise<MoovLocation> {
  const fetchRange = opts.fetchRange ?? defaultFetchRange;
  let offset = 0;
  let lastModified: string | null = null;
  for (let i = 0; i < MAX_TOP_LEVEL_BOXES; i++) {
    let head: RangeResult;
    try {
      head = await fetchRange(url, offset, offset + 15, { signal: opts.signal, expectedLastModified: lastModified, onRetry: opts.onRetry, onOffline: opts.onOffline });
    } catch (err) {
      if (i > 0 && err instanceof RangeFetchError && err.status === 416) {
        throw new ListenError('no-moov', 'Reached the end of the file without finding the moov box');
      }
      throw err;
    }
    lastModified ??= head.lastModified;
    const header = readBoxHeader(head.bytes, 0);
    if (!header) throw new ListenError('malformed-mp4', `Unreadable box header at byte ${offset}`);
    if (header.type === 'moov') return { start: offset, size: header.size, lastModified };
    if (header.size === 0) throw new ListenError('no-moov', `Box "${header.type}" runs to the end of the file before any moov`);
    if (header.size < header.headerSize) throw new ListenError('malformed-mp4', `Box "${header.type}" at ${offset} has size ${header.size}`);
    offset += header.size;
  }
  throw new ListenError('no-moov', `No moov in the first ${MAX_TOP_LEVEL_BOXES} boxes`);
}

/** Locate, download and parse the audio track. The one-off cost per VOD (23.6 MB on a 6 h stream). */
export async function loadAudioIndex(url: string, opts: LoadIndexOptions = {}): Promise<AudioIndex> {
  const fetchRange = opts.fetchRange ?? defaultFetchRange;
  const loc = await locateMoov(url, opts);
  const pieceSize = opts.pieceSize ?? 1 << 20;
  const pieces: Array<[number, number]> = [];
  for (let s = 0; s < loc.size; s += pieceSize) pieces.push([s, Math.min(loc.size, s + pieceSize)]);

  const moov = new Uint8Array(loc.size);
  let loaded = 0;
  opts.onProgress?.(0, loc.size);
  await mapLimit(pieces, opts.concurrency ?? 4, async ([s, e]) => {
    const { bytes } = await fetchRange(url, loc.start + s, loc.start + e - 1, {
      signal: opts.signal,
      expectedLastModified: loc.lastModified,
      onRetry: opts.onRetry,
      onOffline: opts.onOffline,
    });
    moov.set(bytes, s);
    loaded += bytes.byteLength;
    opts.onProgress?.(loaded, loc.size);
  });
  return parseAudioTrack(moov, loc.lastModified);
}
