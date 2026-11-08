import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { childBoxes, findPath, readBoxHeader, type BoxHeader } from '@/lib/listen/boxes';
import { parseAudioTrack, sampleDurations, sampleOffsets } from '@/lib/listen/mp4-index';
import { ListenError } from '@/lib/listen/types';

const dir = path.resolve(__dirname, '../../fixtures/listen');
const load = (f: string) => new Uint8Array(readFileSync(path.join(dir, f)));
const golden: { pos: number; size: number; duration: number }[] = JSON.parse(readFileSync(path.join(dir, 'tiny.audio-packets.json'), 'utf8'));

function moovOf(file: Uint8Array): Uint8Array {
  const moov = childBoxes(file, 0, file.byteLength).find((b) => b.type === 'moov');
  if (!moov) throw new Error('fixture has no moov');
  return file.subarray(moov.start, moov.start + moov.size);
}

/** Rewrite the audio track's stco as co64 with every offset + 2^32, fixing ancestor sizes. */
function withCo64(moov: Uint8Array): Uint8Array {
  const root = readBoxHeader(moov, 0)!;
  const traks = childBoxes(moov, root.headerSize, root.size).filter((b) => b.type === 'trak');
  for (const trak of traks) {
    const hdlr = findPath(moov, trak, ['mdia', 'hdlr'])!;
    if (String.fromCharCode(...moov.subarray(hdlr.start + 16, hdlr.start + 20)) !== 'soun') continue;
    const chain: BoxHeader[] = [root, trak];
    for (const t of ['mdia', 'minf', 'stbl']) chain.push(findPath(moov, chain.at(-1)!, [t])!);
    const stco = findPath(moov, chain.at(-1)!, ['stco'])!;
    const v = new DataView(moov.buffer, moov.byteOffset, moov.byteLength);
    const n = v.getUint32(stco.start + 12);
    const co64 = new Uint8Array(16 + n * 8);
    const cv = new DataView(co64.buffer);
    cv.setUint32(0, co64.length);
    co64.set([0x63, 0x6f, 0x36, 0x34], 4); // 'co64'
    cv.setUint32(12, n);
    for (let i = 0; i < n; i++) cv.setBigUint64(16 + i * 8, BigInt(v.getUint32(stco.start + 16 + i * 4)) + BigInt(2 ** 32));
    const delta = co64.length - stco.size;
    const out = new Uint8Array(moov.length + delta);
    out.set(moov.subarray(0, stco.start), 0);
    out.set(co64, stco.start);
    out.set(moov.subarray(stco.start + stco.size), stco.start + co64.length);
    const ov = new DataView(out.buffer);
    for (const b of chain) ov.setUint32(b.start, ov.getUint32(b.start) + delta);
    return out;
  }
  throw new Error('no audio trak');
}

describe('parseAudioTrack', () => {
  const index = parseAudioTrack(moovOf(load('tiny.mp4')), 'LM');

  it('reads the codec setup', () => {
    expect(index.codec).toBe('mp4a.40.2');
    expect(index.sampleRate).toBe(48000);
    expect(index.channelCount).toBe(2);
    expect(index.timescale).toBe(48000);
    expect(index.durationSec).toBeCloseTo(12.02, 1);
    expect(index.lastModified).toBe('LM');
    expect(index.audioSpecificConfig.length).toBeGreaterThanOrEqual(2);
  });

  it('matches ffprobe sample offsets, sizes and durations exactly', () => {
    expect(index.sampleSizes.length).toBe(golden.length);
    expect(Array.from(sampleOffsets(index))).toEqual(golden.map((p) => p.pos));
    expect(Array.from(index.sampleSizes)).toEqual(golden.map((p) => p.size));
    expect(Array.from(sampleDurations(index, 0, golden.length))).toEqual(golden.map((p) => p.duration));
  });

  it('groups samples into byte-contiguous runs that cover every sample once', () => {
    let next = 0;
    for (let r = 0; r < index.runFirst.length; r++) {
      expect(index.runFirst[r]).toBe(next);
      let bytes = 0;
      for (let k = 0; k < index.runCount[r]; k++) bytes += index.sampleSizes[next + k];
      expect(index.runSize[r]).toBe(bytes);
      next += index.runCount[r];
    }
    expect(next).toBe(golden.length);
    expect(index.runStartTicks[0]).toBe(0);
    for (let r = 1; r < index.runStartTicks.length; r++) expect(index.runStartTicks[r]).toBeGreaterThan(index.runStartTicks[r - 1]);
  });

  it('gives the same index for a faststart (moov-first) file', () => {
    const fast = parseAudioTrack(moovOf(load('tiny-faststart.mp4')), null);
    expect(Array.from(fast.sampleSizes)).toEqual(Array.from(index.sampleSizes));
    expect(fast.runFirst.length).toBe(index.runFirst.length);
  });

  it('reads 64-bit chunk offsets (co64), as in files over 4 GB', () => {
    const big = parseAudioTrack(withCo64(moovOf(load('tiny.mp4'))), null);
    expect(Array.from(sampleOffsets(big))).toEqual(golden.map((p) => p.pos + 2 ** 32));
  });

  it('throws no-audio-track for a video-only file', () => {
    let error: unknown;
    try {
      parseAudioTrack(moovOf(load('tiny-noaudio.mp4')), null);
    } catch (e) {
      error = e;
    }
    expect(error).toBeInstanceOf(ListenError);
    expect(error).toMatchObject({ code: 'no-audio-track' });
  });

  it('throws malformed-mp4 when given something that is not a moov', () => {
    expect(() => parseAudioTrack(Uint8Array.from([0, 0, 0, 8, 0x66, 0x72, 0x65, 0x65]), null)).toThrow(ListenError);
  });
});

describe('sampleDurations', () => {
  it('crosses stts entry boundaries (last AAC frame is shorter)', () => {
    const index = parseAudioTrack(moovOf(load('tiny.mp4')), null);
    const n = index.sampleSizes.length;
    const tail = sampleDurations(index, n - 3, 3);
    expect(Array.from(tail)).toEqual(golden.slice(-3).map((p) => p.duration));
  });
});
