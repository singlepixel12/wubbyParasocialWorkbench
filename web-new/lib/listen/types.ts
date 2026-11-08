export type PlaybackRate = 1 | 1.5;

/** Bytes we created ourselves: always ArrayBuffer-backed, so MSE's appendBuffer accepts them. */
export type Bytes = Uint8Array<ArrayBuffer>;

/**
 * The audio track of a remote MP4, reduced to what Listen needs. Typed arrays clone into IndexedDB as-is.
 * A *run* is a byte-contiguous group of audio samples: one Range request, one fMP4 segment.
 */
export interface AudioIndex {
  version: 1;
  /** Last-Modified of the remote file when indexed. Every later range must match it. */
  lastModified: string | null;
  timescale: number;
  durationSec: number;
  sampleRate: number;
  channelCount: number;
  /** e.g. "mp4a.40.2" */
  codec: string;
  audioSpecificConfig: Uint8Array;
  sampleSizes: Uint16Array;
  sttsCounts: Uint32Array;
  sttsDeltas: Uint32Array;
  runFirst: Uint32Array;
  runCount: Uint32Array;
  runOffset: Float64Array;
  runSize: Uint32Array;
  runStartTicks: Float64Array;
}

export type ListenErrorCode = 'no-moov' | 'no-audio-track' | 'unsupported-audio' | 'malformed-mp4';

export class ListenError extends Error {
  readonly code: ListenErrorCode;
  constructor(code: ListenErrorCode, message: string) {
    super(message);
    this.name = 'ListenError';
    this.code = code;
  }
}
