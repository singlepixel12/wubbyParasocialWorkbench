/**
 * /watch with no signal: the video can't play (archive stream + CDN player), so a poster says so
 * and Listen leads; the caption under Listen tells the truth about what Listen will cost.
 *
 * WHAT THIS FILE CANNOT COVER (Lee's phone, airplane mode, opened cold from the home screen):
 * - that the poster reads as "this is offline", not as a broken player, at a glance
 * - that a video already playing keeps playing from its buffer when the signal drops
 * - that the greyed thumbnail actually comes out of the offline cache (wubby-thumbs) cold
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import type { DownloadManifest } from '@/lib/listen/download-model';
import { createMockVideo } from '../test-utils';

const state = vi.hoisted(() => ({ online: true, downloads: [] as unknown[], onTime: null as null | ((t: number, d: number, paused: boolean) => void) }));
vi.mock('@/lib/hooks/useOnlineStatus', () => ({ useOnlineStatus: () => state.online }));
vi.mock('@/lib/listen/downloads-store', () => ({ useDownloads: () => state.downloads }));
vi.mock('@/components/video/VidstackPlayer', () => ({
  VidstackPlayer: ({ onTimeUpdate }: { onTimeUpdate: (t: number, d: number, p: boolean) => void }) => {
    state.onTime = onTimeUpdate;
    return <div data-testid="player" />;
  },
}));
vi.mock('@/components/listen/DownloadButton', () => ({ DownloadButton: () => null }));

import { VideoDetailView } from '@/components/video/VideoDetailView';

const HASH = 'b'.repeat(64);
const video = createMockVideo({ videoHash: HASH, url: 'https://archive.wubby.tv/vods/public/' + 'x'.repeat(90) + '.mp4' });
const manifest = (state: DownloadManifest['state'], bytesDone: number) => ({ hash: HASH, state, bytesDone, bytesTotal: 100 }) as DownloadManifest;

beforeEach(() => {
  state.online = true;
  state.downloads = [];
  localStorage.clear();
});

describe('VideoDetailView offline', () => {
  it('online: the player, and the streaming cost under Listen', () => {
    render(<VideoDetailView video={video} />);
    expect(screen.getByTestId('player')).toBeInTheDocument();
    expect(screen.getByText('Listen streams audio only · about 73 MB per hour')).toBeInTheDocument();
  });

  it('online with the audio saved: Listen costs nothing', () => {
    state.downloads = [manifest('ready', 100)];
    render(<VideoDetailView video={video} />);
    expect(screen.getByText('Saved on your phone · Listen uses no data')).toBeInTheDocument();
  });

  it('offline with the audio saved: a poster instead of a player that cannot load, and Listen leads', () => {
    state.online = false;
    state.downloads = [manifest('ready', 100)];
    render(<VideoDetailView video={video} />);
    expect(screen.queryByTestId('player')).toBeNull();
    expect(screen.getByRole('img', { name: 'Video needs a connection' })).toBeInTheDocument();
    expect(screen.getByText(/Listen plays with no signal/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^Listen/ })).toBeInTheDocument();
    expect(screen.queryByText(/73 MB per hour/)).toBeNull();
  });

  it('offline, partly saved: says the rest needs a connection', () => {
    state.online = false;
    state.downloads = [manifest('paused', 40)];
    render(<VideoDetailView video={video} />);
    expect(screen.getByText('40% saved on your phone · the rest needs a connection')).toBeInTheDocument();
    expect(screen.queryByText(/Listen plays with no signal/)).toBeNull();
  });

  it('a video already playing keeps its player when the signal drops', () => {
    const { rerender } = render(<VideoDetailView video={video} />);
    act(() => state.onTime!(30, 3600, false));
    state.online = false;
    rerender(<VideoDetailView video={video} />);
    expect(screen.getByTestId('player')).toBeInTheDocument();
  });

  it('a long unbroken archive filename wraps instead of widening the page', () => {
    render(<VideoDetailView video={video} />);
    expect(screen.getByText(/x{90}/).className).toMatch(/break-all/);
  });
});
