// Owns one <audio> + MediaSource for one VOD: index loading, read-ahead, seeking, eviction,
// failures, Media Session, and cleanup. UI subscribes via subscribe/getSnapshot.
import { evictionEnd, planFetches, runIndexAt, runStartSec, runsStartingBefore } from './buffer-planner';
import { buildInitSegment, buildRunSegment } from './fmp4';
import { deleteCachedIndex, getCachedIndex, putCachedIndex } from './index-cache';
import { loadAudioIndex, type FetchRangeFn, type LoadIndexOptions } from './index-loader';
import { bindMediaSession } from './media-session';
import { readStoredRun } from './offline-store';
import { fetchRange as defaultFetchRange, RangeFetchError } from './range-fetch';
import { ListenError, type AudioIndex, type Bytes, type PlaybackRate } from './types';

export type ListenPhase = 'preparing' | 'ready' | 'stalled' | 'error';

export interface ListenSnapshot {
  phase: ListenPhase;
  prepare: { loaded: number; total: number } | null;
  errorMessage: string | null;
  playing: boolean;
  /** Playing but starved of data. */
  waiting: boolean;
  /** A fetch is retrying or waiting for the network. */
  reconnecting: boolean;
  currentTime: number;
  duration: number;
  rate: PlaybackRate;
  bytesFetched: number;
  /** Runs played from the phone's storage instead of the network. */
  storedRuns: number;
  bufferedAheadSec: number;
}

export interface ListenEngineDeps {
  fetchRange?: FetchRangeFn;
  loadIndex?: (url: string, opts: LoadIndexOptions) => Promise<AudioIndex>;
  getCached?: (hash: string) => Promise<AudioIndex | null>;
  putCached?: (hash: string, index: AudioIndex) => Promise<void>;
  deleteCached?: (hash: string) => Promise<void>;
  readStoredRun?: (hash: string, run: number) => Promise<Bytes | null>;
}

export interface ListenEngineOptions {
  url: string;
  hash: string;
  title: string;
  artworkUrl?: string;
  startAt: number;
  rate: PlaybackRate;
  /** Read-ahead target. Default 180 s. */
  aheadSec?: number;
  /** Concurrent run fetches. Default 6. */
  maxInFlight?: number;
  deps?: ListenEngineDeps;
}

/** Playing yet starved for this long → "stalled" with a Retry button. */
const STALL_AFTER_MS = 30_000;
/**
 * From "stalled" (range-fetch's retries exhausted, or starved for 30 s) try again on our own this
 * often, and immediately on `online`. A locked phone in a dead zone has nobody to tap Retry.
 */
const STALL_RETRY_MS = 15_000;

type Op =
  | { kind: 'append'; data: Bytes; resolve: () => void; reject: (e: unknown) => void }
  | { kind: 'remove'; start: number; end: number; resolve: () => void; reject: (e: unknown) => void };

const isAbort = (err: unknown) =>
  (err instanceof RangeFetchError && err.code === 'aborted') || (err instanceof DOMException && err.name === 'AbortError');
const isQuota = (err: unknown) => err instanceof DOMException && err.name === 'QuotaExceededError';
const superseded = () => new DOMException('Superseded', 'AbortError');

export function describeListenError(err: unknown): string {
  if (err instanceof RangeFetchError) {
    switch (err.code) {
      case 'not-found':
        return 'This VOD is no longer on the archive.';
      case 'file-changed':
        return 'This VOD changed on the archive. Close Listen and open it again.';
      case 'range-unsupported':
        return "The archive didn't send just the audio, so Listen stopped rather than download the whole video.";
      case 'exhausted':
        return "Couldn't reach the archive. Check your connection and retry.";
      default:
        return `The archive answered with an error (${err.status ?? err.code}).`;
    }
  }
  if (err instanceof ListenError) {
    if (err.code === 'no-audio-track') return 'This VOD has no audio track.';
    if (err.code === 'unsupported-audio') return "This VOD's audio format isn't supported for Listen.";
    return "This VOD's file couldn't be read for Listen.";
  }
  return 'Listen hit an unexpected error. Switch to Watch, or retry.';
}

export class ListenEngine {
  readonly audio: HTMLAudioElement;
  private readonly opts: ListenEngineOptions;
  private readonly maxInFlight: number;
  private aheadSec: number;
  private readonly mediaSource = new MediaSource();
  private readonly objectUrl: string;
  private readonly life = new AbortController();
  private gen = 0;
  private genController = new AbortController();
  private index: AudioIndex | null = null;
  private sourceBuffer: SourceBuffer | null = null;
  private readonly appended = new Set<number>();
  private readonly inFlight = new Set<number>();
  private ops: Op[] = [];
  private current: Op | null = null;
  private currentFailed = false;
  private sequence = 0;
  private desiredRate: PlaybackRate;
  private phase: ListenPhase = 'preparing';
  private prepare: { loaded: number; total: number } | null = null;
  private errorMessage: string | null = null;
  private reconnecting = false;
  private bytesFetched = 0;
  private storedRuns = 0;
  private starvedSince: number | null = null;
  private recoveryTimer: ReturnType<typeof setTimeout> | null = null;
  private tick: ReturnType<typeof setInterval> | null = null;
  private unbindSession: (() => void) | null = null;
  private disposed = false;
  private readonly listeners = new Set<() => void>();
  private snapshot: ListenSnapshot;

  constructor(opts: ListenEngineOptions) {
    this.opts = opts;
    this.maxInFlight = opts.maxInFlight ?? 6;
    this.aheadSec = opts.aheadSec ?? 180;
    this.desiredRate = opts.rate;
    this.audio = document.createElement('audio');
    this.audio.preload = 'auto';
    this.audio.hidden = true;
    this.audio.dataset.testid = 'listen-audio';
    document.body.appendChild(this.audio);
    this.objectUrl = URL.createObjectURL(this.mediaSource);
    this.audio.src = this.objectUrl;
    // Back online: recover straight away (from "stalled", even during the index load), else top up.
    window.addEventListener('online', () => (this.phase === 'stalled' ? this.retry() : this.pump()), { signal: this.life.signal });
    this.snapshot = this.computeSnapshot();
  }

  // ---- public API -------------------------------------------------------------------------

  subscribe = (onChange: () => void): (() => void) => {
    this.listeners.add(onChange);
    return () => {
      this.listeners.delete(onChange);
    };
  };

  getSnapshot = (): ListenSnapshot => this.snapshot;

  /** Call inside the tap handler, before start(), so Chrome treats playback as user-initiated. */
  play(): void {
    this.audio.playbackRate = this.desiredRate;
    void this.audio.play().catch(() => this.emit());
  }

  pause(): void {
    this.audio.pause();
  }

  toggle(): void {
    if (this.audio.paused) this.play();
    else this.pause();
  }

  seekTo(sec: number): void {
    const end = this.index ? Math.max(0, this.index.durationSec - 0.5) : sec;
    this.audio.currentTime = Math.min(Math.max(0, sec), end);
  }

  seekBy(deltaSec: number): void {
    this.seekTo(this.audio.currentTime + deltaSec);
  }

  setRate(rate: PlaybackRate): void {
    this.desiredRate = rate;
    this.audio.playbackRate = rate;
    this.emit();
  }

  retry(): void {
    if (this.disposed) return;
    if (this.recoveryTimer) {
      clearTimeout(this.recoveryTimer);
      this.recoveryTimer = null;
    }
    if (!this.index) {
      void this.start();
      return;
    }
    this.phase = 'ready';
    this.errorMessage = null;
    this.starvedSince = null;
    this.restartGeneration();
    this.pump();
    this.emit();
  }

  async start(): Promise<void> {
    if (this.disposed) return;
    this.phase = 'preparing';
    this.errorMessage = null;
    this.emit();
    const deps = this.opts.deps ?? {};
    try {
      let index = await (deps.getCached ?? getCachedIndex)(this.opts.hash);
      if (!index) {
        index = await (deps.loadIndex ?? loadAudioIndex)(this.opts.url, {
          signal: this.life.signal,
          fetchRange: deps.fetchRange,
          onProgress: (loaded, total) => {
            this.prepare = { loaded, total };
            this.reconnecting = false;
            this.emit();
          },
          onRetry: () => this.setReconnecting(true),
          onOffline: () => this.setReconnecting(true),
        });
        void (deps.putCached ?? putCachedIndex)(this.opts.hash, index);
      }
      if (this.disposed) return;
      this.index = index;
      this.prepare = null;
      this.reconnecting = false;
      await this.openSourceBuffer(index);
      if (this.disposed) return;
      this.audio.currentTime = Math.min(Math.max(0, this.opts.startAt), Math.max(0, index.durationSec - 1));
      this.attachListeners();
      this.unbindSession = bindMediaSession(
        this.audio,
        { title: this.opts.title, artworkUrl: this.opts.artworkUrl },
        { play: () => this.play(), pause: () => this.pause(), seekBy: (s) => this.seekBy(s), seekTo: (s) => this.seekTo(s) },
      );
      this.phase = 'ready';
      this.tick = setInterval(() => this.onTick(), 1000);
      this.pump();
      this.emit();
    } catch (err) {
      if (err instanceof RangeFetchError && err.code === 'exhausted') this.stall(); // index load: keep trying
      else this.fail(err);
    }
  }

  /** Out of retries for now: show it, and come back by ourselves. */
  private stall(): void {
    if (this.disposed) return;
    this.phase = 'stalled';
    if (this.recoveryTimer) clearTimeout(this.recoveryTimer);
    this.recoveryTimer = setTimeout(() => {
      this.recoveryTimer = null;
      if (!this.disposed && this.phase === 'stalled') this.retry();
    }, STALL_RETRY_MS);
    this.emit();
  }

  /** Idempotent. Aborts all fetches, detaches MSE, clears Media Session, removes the element. */
  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    if (this.tick) clearInterval(this.tick);
    if (this.recoveryTimer) clearTimeout(this.recoveryTimer);
    this.genController.abort();
    this.life.abort();
    this.dropPendingAppends();
    this.current?.reject(superseded());
    this.current = null;
    this.ops = [];
    this.unbindSession?.();
    this.audio.pause();
    try {
      if (this.mediaSource.readyState === 'open' && !this.sourceBuffer?.updating) this.mediaSource.endOfStream();
    } catch {
      // already closing
    }
    this.audio.removeAttribute('src');
    this.audio.load();
    URL.revokeObjectURL(this.objectUrl);
    this.audio.remove();
    this.listeners.clear();
  }

  // ---- setup ------------------------------------------------------------------------------

  private async openSourceBuffer(index: AudioIndex): Promise<void> {
    if (this.mediaSource.readyState !== 'open') {
      await new Promise<void>((resolve) => this.mediaSource.addEventListener('sourceopen', () => resolve(), { once: true }));
    }
    const mime = `audio/mp4; codecs="${index.codec}"`;
    if (!MediaSource.isTypeSupported(mime)) throw new ListenError('unsupported-audio', `This browser can't play ${index.codec}`);
    const sb = this.mediaSource.addSourceBuffer(mime);
    sb.mode = 'segments';
    sb.addEventListener('updateend', () => this.runOps());
    sb.addEventListener('error', () => {
      this.currentFailed = true;
    });
    this.sourceBuffer = sb;
    await this.enqueue({ kind: 'append', data: buildInitSegment(index) });
    this.mediaSource.duration = index.durationSec;
  }

  private attachListeners(): void {
    const signal = this.life.signal;
    const a = this.audio;
    a.addEventListener('seeking', () => this.onSeeking(), { signal });
    a.addEventListener('play', () => {
      // Some lock-screen resumes reset the rate; the user's choice wins.
      if (a.playbackRate !== this.desiredRate) a.playbackRate = this.desiredRate;
      this.emit();
    }, { signal });
    for (const e of ['pause', 'playing', 'waiting', 'timeupdate', 'ratechange', 'durationchange', 'ended'] as const) {
      a.addEventListener(e, () => this.emit(), { signal });
    }
  }

  // ---- fetching ---------------------------------------------------------------------------

  private pump(): void {
    const index = this.index;
    if (!index || this.disposed || this.phase !== 'ready' || !this.sourceBuffer) return;
    const playhead = this.audio.currentTime;

    // The browser may evict on its own; trust the buffer, not our bookkeeping.
    for (const r of [...this.appended]) if (!this.isBuffered(runStartSec(index, r) + 0.01)) this.appended.delete(r);

    const evictTo = evictionEnd(playhead, this.bufferedStart());
    if (evictTo !== null && evictTo > 0) void this.evict(evictTo);

    const runs = planFetches({ index, playheadSec: playhead, aheadSec: this.aheadSec, appended: this.appended, inFlight: this.inFlight, maxInFlight: this.maxInFlight });
    const gen = this.gen;
    const signal = this.genController.signal;
    for (const r of runs) {
      this.inFlight.add(r);
      void this.fetchRun(r, gen, signal);
    }
  }

  private async fetchRun(r: number, gen: number, signal: AbortSignal): Promise<void> {
    const index = this.index!;
    const fetchRange = this.opts.deps?.fetchRange ?? defaultFetchRange;
    const start = index.runOffset[r];
    try {
      // Downloaded runs play from the phone: zero network.
      const stored = await (this.opts.deps?.readStoredRun ?? readStoredRun)(this.opts.hash, r);
      if (gen !== this.gen || this.disposed) return;
      if (stored && stored.byteLength === index.runSize[r]) {
        this.storedRuns++;
        await this.appendRun(r, stored);
        return;
      }
      const { bytes } = await fetchRange(this.opts.url, start, start + index.runSize[r] - 1, {
        signal,
        expectedLastModified: index.lastModified,
        onRetry: () => this.setReconnecting(true),
        onOffline: () => this.setReconnecting(true),
      });
      if (gen !== this.gen || this.disposed) return;
      this.bytesFetched += bytes.byteLength;
      this.setReconnecting(false);
      await this.appendRun(r, bytes);
    } catch (err) {
      if (gen !== this.gen || this.disposed || isAbort(err)) return;
      if (err instanceof RangeFetchError && err.code === 'exhausted') {
        this.stall();
        return;
      }
      if (err instanceof RangeFetchError && err.code === 'file-changed') {
        void (this.opts.deps?.deleteCached ?? deleteCachedIndex)(this.opts.hash);
      }
      this.fail(err);
    } finally {
      if (gen === this.gen) {
        this.inFlight.delete(r);
        this.pump();
      }
    }
  }

  private async appendRun(r: number, bytes: Bytes): Promise<void> {
    const segment = buildRunSegment(this.index!, r, bytes, ++this.sequence);
    try {
      await this.enqueue({ kind: 'append', data: segment });
    } catch (err) {
      if (isQuota(err)) {
        // Memory pressure: shrink the read-ahead, drop more history; the run is refetched later.
        this.aheadSec = Math.max(60, Math.floor(this.aheadSec / 2));
        await this.evict(this.audio.currentTime - 10).catch(() => undefined);
        return;
      }
      throw err;
    }
    this.appended.add(r);
    this.maybeEndOfStream();
    this.emit();
  }

  private async evict(end: number): Promise<void> {
    if (end <= 0 || !this.index) return;
    for (const r of runsStartingBefore(this.index, this.appended, end)) this.appended.delete(r);
    await this.enqueue({ kind: 'remove', start: 0, end });
  }

  private maybeEndOfStream(): void {
    const index = this.index!;
    const last = index.runStartTicks.length - 1;
    if (!this.appended.has(last) || this.ops.length || this.sourceBuffer?.updating) return;
    for (let r = Math.max(0, runIndexAt(index, this.audio.currentTime)); r <= last; r++) if (!this.appended.has(r)) return;
    try {
      if (this.mediaSource.readyState === 'open') this.mediaSource.endOfStream();
    } catch {
      // A later append reopens the stream; nothing to do.
    }
  }

  // ---- SourceBuffer op queue (never append while updating) --------------------------------

  private enqueue(op: { kind: 'append'; data: Bytes } | { kind: 'remove'; start: number; end: number }): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      this.ops.push({ ...op, resolve, reject } as Op);
      this.runOps();
    });
  }

  private runOps(): void {
    const sb = this.sourceBuffer;
    if (!sb || sb.updating) return;
    if (this.current) {
      const done = this.current;
      this.current = null;
      if (this.currentFailed) done.reject(new Error('SourceBuffer rejected the data'));
      else done.resolve();
      this.currentFailed = false;
    }
    while (!sb.updating && !this.current && this.ops.length) {
      const op = this.ops.shift()!;
      try {
        if (op.kind === 'append') sb.appendBuffer(op.data);
        else sb.remove(op.start, op.end);
        this.current = op;
      } catch (err) {
        op.reject(err);
      }
    }
  }

  private dropPendingAppends(): void {
    this.ops = this.ops.filter((op) => {
      if (op.kind !== 'append') return true;
      op.reject(superseded());
      return false;
    });
  }

  // ---- events -----------------------------------------------------------------------------

  private onSeeking(): void {
    if (!this.isBuffered(this.audio.currentTime)) this.restartGeneration();
    this.pump();
    this.emit();
  }

  /** Abandon in-flight work for the old position; stale results are dropped by the gen check. */
  private restartGeneration(): void {
    this.gen++;
    this.genController.abort();
    this.genController = new AbortController();
    this.inFlight.clear();
    this.dropPendingAppends();
  }

  private onTick(): void {
    this.pump();
    const starving = !this.audio.paused && this.audio.readyState < HTMLMediaElement.HAVE_FUTURE_DATA;
    if (!starving) this.starvedSince = null;
    else if (this.starvedSince === null) this.starvedSince = Date.now();
    else if (this.phase === 'ready' && Date.now() - this.starvedSince > STALL_AFTER_MS) this.stall();
    this.emit();
  }

  private setReconnecting(value: boolean): void {
    if (this.reconnecting === value) return;
    this.reconnecting = value;
    this.emit();
  }

  private fail(err: unknown): void {
    if (this.disposed || isAbort(err)) return;
    this.phase = 'error';
    this.errorMessage = describeListenError(err);
    this.genController.abort();
    this.emit();
  }

  // ---- buffer inspection ------------------------------------------------------------------

  private isBuffered(t: number): boolean {
    try {
      const b = this.sourceBuffer?.buffered;
      if (!b) return false;
      for (let i = 0; i < b.length; i++) if (b.start(i) <= t && t < b.end(i)) return true;
    } catch {
      // SourceBuffer removed
    }
    return false;
  }

  private bufferedStart(): number | null {
    try {
      const b = this.sourceBuffer?.buffered;
      return b && b.length ? b.start(0) : null;
    } catch {
      return null;
    }
  }

  private bufferedAhead(t: number): number {
    try {
      const b = this.sourceBuffer?.buffered;
      if (b) for (let i = 0; i < b.length; i++) if (b.start(i) <= t && t < b.end(i)) return b.end(i) - t;
    } catch {
      // ignore
    }
    return 0;
  }

  // ---- snapshot ---------------------------------------------------------------------------

  private emit(): void {
    if (this.disposed) return;
    this.snapshot = this.computeSnapshot();
    for (const l of this.listeners) l();
  }

  private computeSnapshot(): ListenSnapshot {
    const t = this.audio.currentTime || 0;
    return {
      phase: this.phase,
      prepare: this.prepare,
      errorMessage: this.errorMessage,
      playing: !this.audio.paused,
      waiting: !this.audio.paused && this.audio.readyState < HTMLMediaElement.HAVE_FUTURE_DATA,
      reconnecting: this.reconnecting,
      currentTime: t,
      duration: this.index?.durationSec ?? 0,
      rate: this.desiredRate,
      bytesFetched: this.bytesFetched,
      storedRuns: this.storedRuns,
      bufferedAheadSec: this.bufferedAhead(t),
    };
  }
}
