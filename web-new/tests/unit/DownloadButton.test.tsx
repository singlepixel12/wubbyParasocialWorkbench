import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import type { DownloadManifest } from '@/lib/listen/download-model';

const state = vi.hoisted(() => ({ manifests: [] as Partial<DownloadManifest>[], supported: true, cellular: false }));
vi.mock('@/lib/listen/downloads-store', () => ({ useDownloads: () => state.manifests, refreshDownloads: vi.fn() }));
vi.mock('@/lib/listen/background-fetch', () => ({ backgroundFetchSupported: () => state.supported }));
const api = vi.hoisted(() => ({
  startDownload: vi.fn(async () => {}),
  cancelDownload: vi.fn(async () => {}),
  preflight: vi.fn(async () => ({ bytesNeeded: 400e6, cap: { fits: true, suggest: [] as string[] }, quotaOk: true })),
  onMobileData: vi.fn(() => state.cellular),
  watchProgress: vi.fn(async () => () => {}),
}));
vi.mock('@/lib/listen/downloads', () => api);
vi.mock('@/lib/listen/index-cache', () => ({ getCachedIndex: vi.fn(async () => ({ runSize: Uint32Array.of(1) })), putCachedIndex: vi.fn() }));
vi.mock('@/lib/listen/offline-store', () => ({ deleteDownload: vi.fn(async () => {}) }));

import { DownloadButton } from '@/components/listen/DownloadButton';

const vod = { hash: 'h', url: 'u', title: 'T' };
beforeEach(() => {
  state.manifests = [];
  state.supported = true;
  state.cellular = false;
  vi.clearAllMocks();
});

describe('DownloadButton', () => {
  it('renders nothing where background downloads are unsupported', () => {
    state.supported = false;
    const { container } = render(<DownloadButton vod={vod} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('starts a download', async () => {
    render(<DownloadButton vod={vod} />);
    fireEvent.click(screen.getByRole('button', { name: /download/i }));
    await waitFor(() => expect(api.startDownload).toHaveBeenCalled());
  });

  it('asks first on mobile data', async () => {
    state.cellular = true;
    render(<DownloadButton vod={vod} />);
    fireEvent.click(screen.getByRole('button', { name: /download/i }));
    expect(await screen.findByText(/mobile data/i)).toBeInTheDocument();
    expect(api.startDownload).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: /download anyway/i }));
    await waitFor(() => expect(api.startDownload).toHaveBeenCalled());
  });

  it('offers to delete old downloads when over the 2 GB cap', async () => {
    state.manifests = [{ hash: 'old', title: 'Old stream', bytesDone: 1.9e9, state: 'ready' }];
    api.preflight.mockResolvedValueOnce({ bytesNeeded: 400e6, cap: { fits: false, suggest: ['old'] }, quotaOk: true });
    render(<DownloadButton vod={vod} />);
    fireEvent.click(screen.getByRole('button', { name: /download/i }));
    expect(await screen.findByText(/Old stream/)).toBeInTheDocument();
    expect(api.startDownload).not.toHaveBeenCalled();
  });

  it('shows progress with a cancel, a resume when paused, and a saved state', () => {
    state.manifests = [{ hash: 'h', state: 'downloading', bytesDone: 42, bytesTotal: 100 }];
    const { rerender } = render(<DownloadButton vod={vod} />);
    expect(screen.getByText(/42%/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /cancel download/i })).toBeInTheDocument();
    state.manifests = [{ hash: 'h', state: 'paused', bytesDone: 63, bytesTotal: 100, reason: 'cancelled' }];
    rerender(<DownloadButton vod={vod} />);
    expect(screen.getByRole('button', { name: /resume.*63%/i })).toBeInTheDocument();
    state.manifests = [{ hash: 'h', state: 'ready', bytesDone: 100, bytesTotal: 100 }];
    rerender(<DownloadButton vod={vod} />);
    expect(screen.getByText(/saved offline/i)).toBeInTheDocument();
  });
});
