import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { childBoxes, findPath, readBoxHeader } from '@/lib/listen/boxes';
import { parseAudioTrack } from '@/lib/listen/mp4-index';
import { buildInitSegment, buildMediaSegment, buildRunSegment } from '@/lib/listen/fmp4';

const file = new Uint8Array(readFileSync(path.resolve(__dirname, '../../fixtures/listen/tiny.mp4')));
const moovBox = childBoxes(file, 0, file.length).find((b) => b.type === 'moov')!;
const index = parseAudioTrack(file.subarray(moovBox.start, moovBox.start + moovBox.size), null);
const indexOf = (hay: Uint8Array, needle: Uint8Array) => {
  outer: for (let i = 0; i <= hay.length - needle.length; i++) {
    for (let j = 0; j < needle.length; j++) if (hay[i + j] !== needle[j]) continue outer;
    return i;
  }
  return -1;
};

describe('buildInitSegment', () => {
  const init = buildInitSegment(index);
  const top = childBoxes(init, 0, init.length);

  it('is ftyp + moov with an mvex (fragmented)', () => {
    expect(top.map((b) => b.type)).toEqual(['ftyp', 'moov']);
    expect(findPath(init, top[1], ['mvex', 'trex'])).not.toBeNull();
  });

  it('carries the original AudioSpecificConfig inside mp4a/esds', () => {
    const stsd = findPath(init, top[1], ['trak', 'mdia', 'minf', 'stbl', 'stsd'])!;
    const mp4a = readBoxHeader(init, stsd.start + 16)!;
    expect(mp4a.type).toBe('mp4a');
    expect(indexOf(init.subarray(mp4a.start, mp4a.start + mp4a.size), index.audioSpecificConfig)).toBeGreaterThan(0);
  });
});

describe('buildMediaSegment', () => {
  const payload = Uint8Array.from([1, 2, 3, 4, 5, 6]);
  const seg = buildMediaSegment({ sequenceNumber: 7, baseDecodeTime: 2 ** 33, sizes: [2, 4], durations: [1024, 512], payload });
  const [moof, mdat] = childBoxes(seg, 0, seg.length);
  const v = new DataView(seg.buffer, seg.byteOffset, seg.byteLength);

  it('is moof + mdat holding the payload verbatim', () => {
    expect([moof.type, mdat.type]).toEqual(['moof', 'mdat']);
    expect(Array.from(seg.subarray(mdat.start + 8, mdat.start + mdat.size))).toEqual([1, 2, 3, 4, 5, 6]);
  });

  it('points trun.data_offset at the first payload byte', () => {
    const trun = findPath(seg, moof, ['traf', 'trun'])!;
    expect(v.getUint32(trun.start + 12)).toBe(2); // sample_count
    expect(v.getUint32(trun.start + 16)).toBe(mdat.start + 8 - moof.start); // data_offset
    expect([v.getUint32(trun.start + 20), v.getUint32(trun.start + 24)]).toEqual([1024, 2]);
    expect([v.getUint32(trun.start + 28), v.getUint32(trun.start + 32)]).toEqual([512, 4]);
  });

  it('writes a 64-bit tfdt and the sequence number', () => {
    const tfdt = findPath(seg, moof, ['traf', 'tfdt'])!;
    expect(seg[tfdt.start + 8]).toBe(1); // version 1
    expect(Number(v.getBigUint64(tfdt.start + 12))).toBe(2 ** 33);
    const mfhd = findPath(seg, moof, ['mfhd'])!;
    expect(v.getUint32(mfhd.start + 12)).toBe(7);
  });
});

describe('buildRunSegment', () => {
  it("uses the run's sample sizes, durations and start tick", () => {
    const r = 3;
    const payload = file.slice(index.runOffset[r], index.runOffset[r] + index.runSize[r]);
    const seg = buildRunSegment(index, r, payload, 1);
    const [moof, mdat] = childBoxes(seg, 0, seg.length);
    const v = new DataView(seg.buffer, seg.byteOffset, seg.byteLength);
    const trun = findPath(seg, moof, ['traf', 'trun'])!;
    expect(v.getUint32(trun.start + 12)).toBe(index.runCount[r]);
    expect(Number(v.getBigUint64(findPath(seg, moof, ['traf', 'tfdt'])!.start + 12))).toBe(index.runStartTicks[r]);
    expect(mdat.size - 8).toBe(index.runSize[r]);
  });
});
