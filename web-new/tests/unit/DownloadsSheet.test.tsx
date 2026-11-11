/**
 * The downloads sheet is the offline library: rows open the VOD, a paused one resumes, and a
 * delete (which loses a ~55-minute download) asks first and stops a running download.
 *
 * WHAT THIS FILE CANNOT COVER (Lee's phone):
 * - that a row reads as tappable (thumbnail + title) without looking like a second card list
 * - that the confirm row fits a 375 px phone without the buttons wrapping awkwardly
 * - that Resume really restarts a paused download in Chrome (pixel-chrome E2E covers Download)
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import type { DownloadManifest } from '@/lib/listen/download-model';

const state = vi.hoisted(() => ({ online: true, cellular: false }));
const api = vi.hoisted(() => ({
  removeDownload: vi.fn(async () => {}),
  resumeDownload: vi.fn(async () => true),
  onMobileData: vi.fn(() => state.cellular),
}));
vi.mock('@/lib/listen/downloads', () => api);
vi.mock('@/lib/hooks/useOnlineStatus', () => ({ useOnlineStatus: () => state.online }));

import { DownloadsSheet } from '@/components/listen/DownloadsSheet';

const m = (hash: string, title: string, s: DownloadManifest['state'], bytesDone: number) =>
  ({ hash: hash.repeat(64), title, state: s, bytesDone, bytesTotal: 400e6, lastListenedAt: 1, url: 'u' }) as DownloadManifest;
const ready = m('a', 'Ready stream', 'ready', 400e6);
const paused = m('b', 'Paused stream', 'paused', 100e6);
const onOpenChange = vi.fn();
const renderSheet = (ms = [ready, paused]) => render(<DownloadsSheet open onOpenChange={onOpenChange} manifests={ms} />);

beforeEach(() => {
  state.online = true;
  state.cellular = false;
  vi.clearAllMocks();
});

describe('DownloadsSheet', () => {
  it('every row opens its VOD, and closes the sheet', () => {
    renderSheet();
    const link = screen.getByRole('link', { name: /Ready stream/ });
    expect(link).toHaveAttribute('href', `/watch?id=${'a'.repeat(64)}`);
    expect(screen.getByRole('link', { name: /Paused stream/ })).toHaveAttribute('href', `/watch?id=${'b'.repeat(64)}`);
    fireEvent.click(link);
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('a paused download has Resume; a finished one does not', async () => {
    renderSheet();
    expect(screen.queryByRole('button', { name: 'Resume Ready stream' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Resume Paused stream' }));
    await waitFor(() => expect(api.resumeDownload).toHaveBeenCalledWith(paused));
  });

  it('Resume is disabled offline, and asks first on mobile data', async () => {
    state.online = false;
    const { unmount } = renderSheet();
    expect(screen.getByRole('button', { name: 'Resume Paused stream' })).toBeDisabled();
    unmount();
    state.online = true;
    state.cellular = true;
    renderSheet();
    fireEvent.click(screen.getByRole('button', { name: 'Resume Paused stream' }));
    expect(api.resumeDownload).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Resume anyway' }));
    await waitFor(() => expect(api.resumeDownload).toHaveBeenCalled());
  });

  it('says to open the VOD when its index is gone', async () => {
    api.resumeDownload.mockResolvedValueOnce(false);
    renderSheet();
    fireEvent.click(screen.getByRole('button', { name: 'Resume Paused stream' }));
    expect(await screen.findByText('Open the VOD to resume it.')).toBeInTheDocument();
  });

  it('delete asks first; Keep keeps it, Delete removes it (stopping it if it runs)', async () => {
    renderSheet();
    fireEvent.click(screen.getByRole('button', { name: 'Delete Ready stream' }));
    expect(api.removeDownload).not.toHaveBeenCalled();
    expect(screen.getByRole('alert')).toHaveTextContent('Delete 400 MB from your phone?');
    fireEvent.click(screen.getByRole('button', { name: 'Keep' }));
    expect(screen.queryByRole('alert')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Delete Ready stream' }));
    fireEvent.click(screen.getByRole('button', { name: 'Delete' }));
    await waitFor(() => expect(api.removeDownload).toHaveBeenCalledWith('a'.repeat(64)));
  });

  it('Delete all asks first, then removes every download', async () => {
    renderSheet();
    fireEvent.click(screen.getByRole('button', { name: 'Delete all' }));
    expect(api.removeDownload).not.toHaveBeenCalled();
    expect(screen.getByRole('alert')).toHaveTextContent(/Delete all 2 downloads \(500 MB\)\? This can.t be undone/);
    fireEvent.click(screen.getByRole('button', { name: 'Delete all' }));
    await waitFor(() => expect(api.removeDownload).toHaveBeenCalledTimes(2));
  });
});
