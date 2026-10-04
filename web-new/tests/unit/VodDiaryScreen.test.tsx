/**
 * Unit tests for VodDiaryScreen's load lifecycle: superseded queries are cancelled
 * and can never overwrite newer results, and the error toast's Retry re-runs the
 * *current* filters rather than the ones captured when the toast was raised.
 *
 * The API module and toast hook are mocked so each request can be resolved or
 * rejected by hand, in any order.
 *
 * WHAT THIS FILE CANNOT COVER (needs a human in a real browser):
 * - That typing quickly against live Supabase never flashes an error toast or a
 *   skeleton flicker between keystrokes.
 * - That the staggered card reveal still plays cleanly when results swap mid-animation.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMockVideo, renderWithProviders } from '../test-utils';

const api = vi.hoisted(() => ({
  fetchRecentVideos: vi.fn(),
  searchVideos: vi.fn(),
}));
const toast = vi.hoisted(() => ({ showError: vi.fn() }));

vi.mock('@/lib/api/supabase', () => ({
  ...api,
  isAbortError: (e: unknown) => (e as { name?: string } | null)?.name === 'AbortError',
}));
vi.mock('@/lib/hooks/useToast', () => ({ useToast: () => toast }));

import { VodDiaryScreen } from '@/components/vod-diary/VodDiaryScreen';

/** A promise plus its settle functions, so tests choose the resolution order. */
function deferred<T>() {
  let resolve!: (v: T) => void;
  let reject!: (e: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

async function openSearchAndType(term: string) {
  const user = userEvent.setup();
  await user.click(screen.getByRole('button', { name: 'Open search' }));
  await user.type(screen.getByRole('textbox', { name: 'Search videos' }), term);
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('VodDiaryScreen — superseded loads', () => {
  it('aborts the in-flight diary load when a search replaces it', async () => {
    api.fetchRecentVideos.mockReturnValue(new Promise(() => {}));
    api.searchVideos.mockResolvedValue([]);

    renderWithProviders(<VodDiaryScreen />);
    await waitFor(() => expect(api.fetchRecentVideos).toHaveBeenCalledTimes(1));
    const firstSignal: AbortSignal = api.fetchRecentVideos.mock.calls[0][0].signal;
    expect(firstSignal.aborted).toBe(false);

    await openSearchAndType('cooking');
    await waitFor(() => expect(api.searchVideos).toHaveBeenCalled());

    expect(firstSignal.aborted).toBe(true);
  });

  it('never renders a stale result that resolves after the newer one', async () => {
    const stale = deferred<ReturnType<typeof createMockVideo>[]>();
    api.fetchRecentVideos.mockReturnValue(stale.promise);
    api.searchVideos.mockResolvedValue([
      createMockVideo({ title: 'Fresh search hit', videoHash: 'b'.repeat(64) }),
    ]);

    renderWithProviders(<VodDiaryScreen />);
    await waitFor(() => expect(api.fetchRecentVideos).toHaveBeenCalled());

    await openSearchAndType('cooking');
    expect(await screen.findByText('Fresh search hit')).toBeInTheDocument();

    // The superseded diary load lands late — it must be ignored
    await act(async () => {
      stale.resolve([createMockVideo({ title: 'Stale diary row', videoHash: 'c'.repeat(64) })]);
    });

    expect(screen.queryByText('Stale diary row')).not.toBeInTheDocument();
    expect(screen.getByText('Fresh search hit')).toBeInTheDocument();
  });

  it('does not raise an error toast for a cancelled request', async () => {
    api.fetchRecentVideos.mockImplementation(
      ({ signal }: { signal: AbortSignal }) =>
        new Promise((_res, reject) =>
          signal.addEventListener('abort', () =>
            reject(new DOMException('aborted', 'AbortError'))
          )
        )
    );
    api.searchVideos.mockResolvedValue([]);

    renderWithProviders(<VodDiaryScreen />);
    await waitFor(() => expect(api.fetchRecentVideos).toHaveBeenCalled());
    await openSearchAndType('cooking');
    await waitFor(() => expect(api.searchVideos).toHaveBeenCalled());

    expect(toast.showError).not.toHaveBeenCalled();
  });
});

describe('VodDiaryScreen — Retry', () => {
  it('re-runs the current filters, not the ones captured when the toast was raised', async () => {
    api.fetchRecentVideos.mockRejectedValueOnce(new Error('Failed to load videos: server error'));
    api.searchVideos.mockResolvedValue([]);

    renderWithProviders(<VodDiaryScreen />);
    await waitFor(() => expect(toast.showError).toHaveBeenCalledTimes(1));
    const retry = toast.showError.mock.calls[0][1].action.onClick as () => void;

    // Filters move on to a search before the user clicks the old toast's Retry
    await openSearchAndType('cooking');
    await waitFor(() => expect(api.searchVideos).toHaveBeenCalledTimes(1));
    const diaryCalls = api.fetchRecentVideos.mock.calls.length;

    await act(async () => retry());

    await waitFor(() => expect(api.searchVideos).toHaveBeenCalledTimes(2));
    expect(api.searchVideos.mock.calls[1][0].searchTerm).toBe('cooking');
    expect(api.fetchRecentVideos).toHaveBeenCalledTimes(diaryCalls);
  });
});
