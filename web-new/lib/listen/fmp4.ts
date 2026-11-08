// Minimal fragmented-MP4 writer for ONE AAC audio track: an init segment (ftyp+moov with mvex)
// and media segments (moof+mdat). The AAC frames are copied, never re-encoded.
import { sampleDurations } from './mp4-index';
import type { AudioIndex, Bytes } from './types';

const ascii = (s: string): Bytes => Uint8Array.from(s, (c) => c.charCodeAt(0));
const u8 = (n: number): Bytes => Uint8Array.of(n & 255);
const u16 = (n: number): Bytes => Uint8Array.of((n >>> 8) & 255, n & 255);
const u32 = (n: number): Bytes => Uint8Array.of((n >>> 24) & 255, (n >>> 16) & 255, (n >>> 8) & 255, n & 255);
const u64 = (n: number): Bytes => {
  const b = new Uint8Array(8);
  new DataView(b.buffer).setBigUint64(0, BigInt(n));
  return b;
};
const zeros = (n: number): Bytes => new Uint8Array(n);

function concat(parts: readonly Uint8Array[]): Bytes {
  const out = new Uint8Array(parts.reduce((a, p) => a + p.length, 0));
  let o = 0;
  for (const p of parts) {
    out.set(p, o);
    o += p.length;
  }
  return out;
}
const box = (type: string, ...parts: Uint8Array[]): Bytes => {
  const body = concat(parts);
  return concat([u32(8 + body.length), ascii(type), body]);
};
const fullBox = (type: string, version: number, flags: number, ...parts: Uint8Array[]): Bytes =>
  box(type, u8(version), Uint8Array.of((flags >>> 16) & 255, (flags >>> 8) & 255, flags & 255), ...parts);
const descriptor = (tag: number, body: Uint8Array): Bytes => concat([u8(tag), Uint8Array.of(0x80, 0x80, 0x80, body.length & 0x7f), body]);
const MATRIX = concat([u32(0x10000), u32(0), u32(0), u32(0), u32(0x10000), u32(0), u32(0), u32(0), u32(0x40000000)]);

type InitFields = Pick<AudioIndex, 'timescale' | 'sampleRate' | 'channelCount' | 'audioSpecificConfig'>;

export function buildInitSegment(index: InitFields): Bytes {
  const esds = fullBox(
    'esds', 0, 0,
    descriptor(0x03, concat([
      u16(1), u8(0),
      descriptor(0x04, concat([u8(0x40), u8(0x15), zeros(3), u32(0), u32(0), descriptor(0x05, index.audioSpecificConfig)])),
      descriptor(0x06, u8(0x02)),
    ])),
  );
  const mp4a = box('mp4a', zeros(6), u16(1), zeros(8), u16(index.channelCount), u16(16), zeros(4), u32((index.sampleRate * 65536) >>> 0), esds);
  const stbl = box(
    'stbl',
    fullBox('stsd', 0, 0, u32(1), mp4a),
    fullBox('stts', 0, 0, u32(0)),
    fullBox('stsc', 0, 0, u32(0)),
    fullBox('stsz', 0, 0, u32(0), u32(0)),
    fullBox('stco', 0, 0, u32(0)),
  );
  const minf = box('minf', fullBox('smhd', 0, 0, zeros(4)), box('dinf', fullBox('dref', 0, 0, u32(1), fullBox('url ', 0, 1))), stbl);
  const mdia = box(
    'mdia',
    fullBox('mdhd', 0, 0, u32(0), u32(0), u32(index.timescale), u32(0), u16(0x55c4), u16(0)),
    fullBox('hdlr', 0, 0, u32(0), ascii('soun'), zeros(12), ascii('SoundHandler\0')),
    minf,
  );
  const tkhd = fullBox('tkhd', 0, 3, u32(0), u32(0), u32(1), u32(0), u32(0), zeros(8), u16(0), u16(0), u16(0x0100), u16(0), MATRIX, u32(0), u32(0));
  const mvhd = fullBox('mvhd', 0, 0, u32(0), u32(0), u32(index.timescale), u32(0), u32(0x10000), u16(0x0100), zeros(10), MATRIX, zeros(24), u32(2));
  const mvex = box('mvex', fullBox('trex', 0, 0, u32(1), u32(1), u32(0), u32(0), u32(0)));
  return concat([box('ftyp', ascii('iso6'), u32(0), ascii('iso6'), ascii('mp41')), box('moov', mvhd, box('trak', tkhd, mdia), mvex)]);
}

export interface MediaSegmentInput {
  sequenceNumber: number;
  baseDecodeTime: number;
  sizes: ArrayLike<number>;
  durations: ArrayLike<number>;
  payload: Uint8Array;
}

export function buildMediaSegment({ sequenceNumber, baseDecodeTime, sizes, durations, payload }: MediaSegmentInput): Bytes {
  const entries: Bytes[] = [];
  for (let i = 0; i < sizes.length; i++) entries.push(u32(durations[i]), u32(sizes[i]));
  const moof = (dataOffset: number) =>
    box(
      'moof',
      fullBox('mfhd', 0, 0, u32(sequenceNumber)),
      box(
        'traf',
        fullBox('tfhd', 0, 0x020000, u32(1)), // default-base-is-moof
        fullBox('tfdt', 1, 0, u64(baseDecodeTime)),
        fullBox('trun', 0, 0x000301, u32(sizes.length), u32(dataOffset), ...entries), // data-offset, duration, size
      ),
    );
  const moofSize = moof(0).length;
  return concat([moof(moofSize + 8), box('mdat', payload)]);
}

/** One run of the index (fetched as `payload`) as a media segment. */
export function buildRunSegment(index: AudioIndex, run: number, payload: Uint8Array, sequenceNumber: number): Bytes {
  const first = index.runFirst[run];
  const count = index.runCount[run];
  return buildMediaSegment({
    sequenceNumber,
    baseDecodeTime: index.runStartTicks[run],
    sizes: index.sampleSizes.subarray(first, first + count),
    durations: sampleDurations(index, first, count),
    payload,
  });
}
