import { childBoxes, findChild, findPath, readBoxHeader, type BoxHeader } from './boxes';
import { ListenError, type AudioIndex } from './types';

const fourcc = (b: Uint8Array, at: number) => String.fromCharCode(b[at], b[at + 1], b[at + 2], b[at + 3]);

/**
 * Parse the first AAC audio track of a `moov` box. Only the audio trak's tables are read, so a
 * 23.6 MB moov with a 1.3M-sample video track parses in tens of milliseconds.
 */
export function parseAudioTrack(moov: Uint8Array, lastModified: string | null): AudioIndex {
  const root = readBoxHeader(moov, 0);
  if (!root || root.type !== 'moov') throw new ListenError('malformed-mp4', 'Expected a moov box');
  const view = new DataView(moov.buffer, moov.byteOffset, moov.byteLength);
  const traks = childBoxes(moov, root.headerSize, root.size).filter((b) => b.type === 'trak');

  for (const trak of traks) {
    const hdlr = findPath(moov, trak, ['mdia', 'hdlr']);
    if (!hdlr || fourcc(moov, hdlr.start + 16) !== 'soun') continue;
    return parseSoundTrak(moov, view, trak, lastModified);
  }
  throw new ListenError('no-audio-track', 'This file has no audio track');
}

function need(box: BoxHeader | null, what: string): BoxHeader {
  if (!box) throw new ListenError('malformed-mp4', `Audio track is missing ${what}`);
  return box;
}

function parseSoundTrak(moov: Uint8Array, v: DataView, trak: BoxHeader, lastModified: string | null): AudioIndex {
  const mdhd = need(findPath(moov, trak, ['mdia', 'mdhd']), 'mdhd');
  const v1 = moov[mdhd.start + 8] === 1;
  const timescale = v.getUint32(mdhd.start + (v1 ? 28 : 20));
  const durationTicks = v1 ? Number(v.getBigUint64(mdhd.start + 32)) : v.getUint32(mdhd.start + 24);

  const stbl = need(findPath(moov, trak, ['mdia', 'minf', 'stbl']), 'stbl');
  const stsd = need(findChild(moov, stbl, 'stsd'), 'stsd');
  const entry = need(readBoxHeader(moov, stsd.start + 16), 'a sample entry');
  if (entry.type !== 'mp4a') throw new ListenError('unsupported-audio', `Audio codec "${entry.type}" isn't supported`);
  const channelCount = v.getUint16(entry.start + 24);
  const sampleRate = v.getUint32(entry.start + 32) >>> 16;
  const esds = childBoxes(moov, entry.start + 36, entry.start + entry.size).find((b) => b.type === 'esds');
  const audioSpecificConfig = readAudioSpecificConfig(need(esds ?? null, 'esds'), moov);
  const objectType = audioSpecificConfig[0] >> 3;
  if (objectType === 0 || objectType === 31) throw new ListenError('unsupported-audio', `AAC object type ${objectType} isn't supported`);

  // stts: sample durations as (count, delta) runs
  const stts = need(findChild(moov, stbl, 'stts'), 'stts');
  const sttsN = v.getUint32(stts.start + 12);
  const sttsCounts = new Uint32Array(sttsN);
  const sttsDeltas = new Uint32Array(sttsN);
  for (let i = 0; i < sttsN; i++) {
    sttsCounts[i] = v.getUint32(stts.start + 16 + i * 8);
    sttsDeltas[i] = v.getUint32(stts.start + 20 + i * 8);
  }

  // stsz: sample sizes
  const stsz = findChild(moov, stbl, 'stsz');
  if (!stsz) throw new ListenError('unsupported-audio', 'Compact sample sizes (stz2) are not supported');
  const fixedSize = v.getUint32(stsz.start + 12);
  const sampleCount = v.getUint32(stsz.start + 16);
  const sampleSizes = new Uint16Array(sampleCount);
  for (let i = 0; i < sampleCount; i++) {
    const size = fixedSize || v.getUint32(stsz.start + 20 + i * 4);
    if (size > 0xffff) throw new ListenError('unsupported-audio', `Audio sample ${i} is ${size} bytes; expected AAC frames under 64 KB`);
    sampleSizes[i] = size;
  }

  // stco / co64: chunk offsets; stsc: samples per chunk
  const co = need(findChild(moov, stbl, 'co64') ?? findChild(moov, stbl, 'stco'), 'stco/co64');
  const wide = co.type === 'co64';
  const chunkCount = v.getUint32(co.start + 12);
  const chunkOffset = (i: number) => (wide ? Number(v.getBigUint64(co.start + 16 + i * 8)) : v.getUint32(co.start + 16 + i * 4));
  const stsc = need(findChild(moov, stbl, 'stsc'), 'stsc');
  const stscN = v.getUint32(stsc.start + 12);
  const stscFirst = new Uint32Array(stscN);
  const stscPer = new Uint32Array(stscN);
  for (let i = 0; i < stscN; i++) {
    stscFirst[i] = v.getUint32(stsc.start + 16 + i * 12);
    stscPer[i] = v.getUint32(stsc.start + 20 + i * 12);
  }

  // Walk chunks, merging byte-contiguous samples into runs (one Range request each).
  const runFirst: number[] = [];
  const runCount: number[] = [];
  const runOffset: number[] = [];
  const runSize: number[] = [];
  let sample = 0;
  let entryIdx = 0;
  for (let c = 0; c < chunkCount && sample < sampleCount; c++) {
    while (entryIdx + 1 < stscN && c + 1 >= stscFirst[entryIdx + 1]) entryIdx++;
    let offset = chunkOffset(c);
    for (let k = 0; k < stscPer[entryIdx] && sample < sampleCount; k++, sample++) {
      const last = runFirst.length - 1;
      if (last >= 0 && runOffset[last] + runSize[last] === offset) {
        runCount[last]++;
        runSize[last] += sampleSizes[sample];
      } else {
        runFirst.push(sample);
        runCount.push(1);
        runOffset.push(offset);
        runSize.push(sampleSizes[sample]);
      }
      offset += sampleSizes[sample];
    }
  }
  if (sample !== sampleCount) throw new ListenError('malformed-mp4', `Chunk tables cover ${sample} of ${sampleCount} samples`);

  // Start tick of each run.
  const runStartTicks = new Float64Array(runFirst.length);
  let ticks = 0;
  let run = 0;
  let sttsIdx = 0;
  let left = sttsN ? sttsCounts[0] : 0;
  for (let s = 0; s < sampleCount; s++) {
    if (run < runFirst.length && runFirst[run] === s) runStartTicks[run++] = ticks;
    while (left === 0 && sttsIdx + 1 < sttsN) left = sttsCounts[++sttsIdx];
    ticks += sttsDeltas[sttsIdx];
    left--;
  }

  return {
    version: 1,
    lastModified,
    timescale,
    durationSec: durationTicks / timescale,
    sampleRate,
    channelCount,
    codec: `mp4a.40.${objectType}`,
    audioSpecificConfig,
    sampleSizes,
    sttsCounts,
    sttsDeltas,
    runFirst: Uint32Array.from(runFirst),
    runCount: Uint32Array.from(runCount),
    runOffset: Float64Array.from(runOffset),
    runSize: Uint32Array.from(runSize),
    runStartTicks,
  };
}

/** esds -> ES_Descriptor(0x03) -> DecoderConfigDescriptor(0x04) -> DecoderSpecificInfo(0x05) = AudioSpecificConfig. */
function readAudioSpecificConfig(esds: BoxHeader, moov: Uint8Array): Uint8Array {
  const d = moov.subarray(esds.start + 12, esds.start + esds.size);
  let p = 0;
  const readDescriptor = () => {
    const tag = d[p++];
    let len = 0;
    for (let i = 0; i < 4; i++) {
      const b = d[p++];
      len = (len << 7) | (b & 0x7f);
      if (!(b & 0x80)) break;
    }
    return { tag, len };
  };
  if (readDescriptor().tag !== 0x03) throw new ListenError('malformed-mp4', 'esds has no ES_Descriptor');
  p += 2; // ES_ID
  const flags = d[p++];
  if (flags & 0x80) p += 2; // dependsOn_ES_ID
  if (flags & 0x40) p += 1 + d[p]; // URL
  if (flags & 0x20) p += 2; // OCR_ES_Id
  if (readDescriptor().tag !== 0x04) throw new ListenError('malformed-mp4', 'esds has no DecoderConfigDescriptor');
  if (d[p] !== 0x40) throw new ListenError('unsupported-audio', `Audio object type 0x${d[p].toString(16)} is not AAC`);
  p += 13; // objectTypeIndication, streamType, bufferSizeDB(3), maxBitrate(4), avgBitrate(4)
  const info = readDescriptor();
  if (info.tag !== 0x05) throw new ListenError('malformed-mp4', 'esds has no DecoderSpecificInfo');
  return d.slice(p, p + info.len);
}

/** Durations (in timescale ticks) of `count` samples starting at `first`. */
export function sampleDurations(index: AudioIndex, first: number, count: number): Uint32Array {
  const out = new Uint32Array(count);
  let i = 0;
  let base = 0;
  while (i < index.sttsCounts.length && base + index.sttsCounts[i] <= first) base += index.sttsCounts[i++];
  let left = index.sttsCounts[i] - (first - base);
  for (let k = 0; k < count; k++) {
    while (left === 0) left = index.sttsCounts[++i];
    out[k] = index.sttsDeltas[i];
    left--;
  }
  return out;
}

/** Absolute byte offset of every sample. For tests and diagnostics, not the hot path. */
export function sampleOffsets(index: AudioIndex): Float64Array {
  const out = new Float64Array(index.sampleSizes.length);
  for (let r = 0; r < index.runFirst.length; r++) {
    let offset = index.runOffset[r];
    for (let k = 0; k < index.runCount[r]; k++) {
      const s = index.runFirst[r] + k;
      out[s] = offset;
      offset += index.sampleSizes[s];
    }
  }
  return out;
}
