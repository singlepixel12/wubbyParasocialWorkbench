/**
 * Unit tests for VodDiaryScreen: the load lifecycle (superseded queries are
 * cancelled and can never overwrite newer results; Retry re-runs the *current*
 * filters) and the URL as the source of truth for search + date range.
 *
 * The API module and toast hook are mocked so each request can be resolved or
 * rejected by hand, in any order. `next/navigation` is replaced by a tiny store
 * backed by jsdom's URL so router.push/replace re-render the screen.
 *
 * WHAT THIS FILE CANNOT COVER (needs a human in a real browser):
 * - That typing quickly against live Supabase never flashes an error toast or a
 *   skeleton flicker between keystrokes.
 * - That the staggered card reveal still plays cleanly when results swap mid-animation.
 * - Real App Router behaviour: Back/Forward through date-range history, the static
 *   export's Suspense fallback, and basePath on GitHub Pages.
 * - That the "Showing N of M" foot and Load more button read as part of the
 *   editorial list (type, spacing, green accent) rather than a bolted-on control,
 *   and that newly appended cards stagger in without the existing ones re-animating.
 * - That the masthead "No. NN" still looks right with a three-digit total.
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
  // The screen pages through fetchRecentVideosPage; route it through the
  // fetchRecentVideos mock so tests can return either a bare array (total
  // unknown) or a full { videos, total } page.
  fetchRecentVideosPage: (params: unknown) =>
    Promise.resolve(api.fetchRecentVideos(params)).then((r) =>
      Array.isArray(r) ? { videos: r, total: null } : r
    ),
  isAbortError: (e: unknown) => (e as { name?: string } | null)?.name === 'AbortError',
}));
vi.mock('@/lib/hooks/useToast', () => ({ useToast: () => toast }));

// Minimal App Router stand-in: the query string lives in jsdom's URL, and
// push/replace update it and notify subscribers so the screen re-renders.
const nav = vi.hoisted(() => {
  const listeners = new Set<() => void>();
  const navigate = (url: string) => {
    window.history.replaceState(null, '', url);
    listeners.forEach((l) => l());
  };
  return {
    navigate,
    subscribe: (l: () => void) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    router: { push: vi.fn(navigate), replace: vi.fn(navigate) },
  };
});

vi.mock('next/navigation', async () => {
  const React = await import('react');
  return {
    usePathname: () => '/',
    useRouter: () => nav.router,
    useSearchParams: () => {
      const search = React.useSyncExternalStore(nav.subscribe, () => window.location.search);
      return React.useMemo(() => new URLSearchParams(search), [search]);
    },
  };
});

import { VodDiaryScreen } from '@/components/vod-diary/VodDiaryScreen';
import { getThisWeekRange } from '@/lib/utils/video-helpers';

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
  window.history.replaceState(null, '', '/');
  api.fetchRecentVideos.mockResolvedValue([]);
  api.searchVideos.mockResolvedValue([]);
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

describe('VodDiaryScreen — filters live in the URL', () => {
  it('runs the search from a shared ?q= link and shows the term in the search box', async () => {
    window.history.replaceState(null, '', '/?q=cooking');

    renderWithProviders(<VodDiaryScreen />);

    await waitFor(() => expect(api.searchVideos).toHaveBeenCalled());
    expect(api.searchVideos.mock.calls[0][0].searchTerm).toBe('cooking');
    expect(api.fetchRecentVideos).not.toHaveBeenCalled();
    expect(screen.getByRole('textbox', { name: 'Search videos' })).toHaveValue('cooking');
  });

  it('queries the from/to days in the URL', async () => {
    window.history.replaceState(null, '', '/?from=2026-09-01&to=2026-09-30');

    renderWithProviders(<VodDiaryScreen />);

    await waitFor(() => expect(api.fetchRecentVideos).toHaveBeenCalled());
    const { fromDate, toDate } = api.fetchRecentVideos.mock.calls[0][0];
    expect(fromDate).toEqual(new Date(2026, 8, 1));
    expect(toDate).toEqual(new Date(2026, 8, 30));
  });

  it('defaults to This Week with no params, and for a malformed date', async () => {
    window.history.replaceState(null, '', '/?from=not-a-date');

    renderWithProviders(<VodDiaryScreen />);

    await waitFor(() => expect(api.fetchRecentVideos).toHaveBeenCalled());
    const { fromDate, toDate } = api.fetchRecentVideos.mock.calls[0][0];
    const week = getThisWeekRange();
    expect(fromDate).toEqual(week.from);
    expect(toDate).toEqual(week.to);
  });

  it('writes the search term with replace (typing never floods history)', async () => {
    renderWithProviders(<VodDiaryScreen />);
    await openSearchAndType('cooking');

    await waitFor(() => expect(window.location.search).toBe('?q=cooking'));
    expect(nav.router.push).not.toHaveBeenCalled();
    expect(nav.router.replace).toHaveBeenCalled();
  });

  it('keeps the date range in the URL when a search is added', async () => {
    window.history.replaceState(null, '', '/?from=2026-09-01&to=2026-09-30');
    renderWithProviders(<VodDiaryScreen />);

    await openSearchAndType('cooking');

    await waitFor(() =>
      expect(new URLSearchParams(window.location.search).get('q')).toBe('cooking')
    );
    const params = new URLSearchParams(window.location.search);
    expect(params.get('from')).toBe('2026-09-01');
    expect(params.get('to')).toBe('2026-09-30');
  });

  it('drops q from the URL when the search is closed', async () => {
    window.history.replaceState(null, '', '/?q=cooking');
    const user = userEvent.setup();
    renderWithProviders(<VodDiaryScreen />);
    await waitFor(() => expect(api.searchVideos).toHaveBeenCalled());

    await user.click(screen.getByRole('button', { name: 'Close search' }));

    await waitFor(() => expect(window.location.search).toBe(''));
    await waitFor(() => expect(api.fetchRecentVideos).toHaveBeenCalled());
  });

  it('does not rewrite the URL on load when nothing changed', async () => {
    window.history.replaceState(null, '', '/?q=cooking&from=2026-09-01&to=2026-09-30');

    renderWithProviders(<VodDiaryScreen />);
    await waitFor(() => expect(api.searchVideos).toHaveBeenCalled());
    // Let SearchInput's 300ms debounce fire its initial onSearch
    await new Promise((r) => setTimeout(r, 400));

    expect(nav.router.replace).not.toHaveBeenCalled();
    expect(nav.router.push).not.toHaveBeenCalled();
  });
});

/** n distinct mock videos, numbered from `start`. */
function videosFrom(start: number, n: number) {
  return Array.from({ length: n }, (_, i) =>
    createMockVideo({
      title: `Record ${start + i}`,
      url: `https://archive.wubby.tv/${start + i}.mp4`,
      videoHash: (start + i).toString(16).padStart(64, '0'),
    })
  );
}

describe('VodDiaryScreen — paging and the honest count', () => {
  it('says how many of the range are shown and loads the next page on demand', async () => {
    api.fetchRecentVideos
      .mockResolvedValueOnce({ videos: videosFrom(0, 50), total: 92 })
      .mockResolvedValueOnce({ videos: videosFrom(50, 42), total: 92 });
    const user = userEvent.setup();

    renderWithProviders(<VodDiaryScreen />);

    expect(await screen.findByText('Showing 50 of 92 records')).toBeInTheDocument();
    // The masthead issue number is the whole range, not the page
    expect(screen.getByText('No. 92')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Load 42 more' }));

    await waitFor(() => expect(screen.getByText('Record 91')).toBeInTheDocument());
    expect(api.fetchRecentVideos.mock.calls[1][0]).toMatchObject({ offset: 50, limit: 50 });
    expect(screen.getByText('Record 0')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^Load \d+ more$/ })).not.toBeInTheDocument();
  }, 20_000); // renders 92 / 200 cards in jsdom — slow, not logic

  it('shows no Load more when the whole range fits on one page', async () => {
    api.fetchRecentVideos.mockResolvedValueOnce({ videos: videosFrom(0, 7), total: 7 });

    renderWithProviders(<VodDiaryScreen />);

    expect(await screen.findByText('Record 6')).toBeInTheDocument();
    expect(screen.queryByText(/Showing \d+ of/)).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^Load \d+ more$/ })).not.toBeInTheDocument();
  });

  it('drops a duplicate at the page seam when a new upload shifts the offsets', async () => {
    api.fetchRecentVideos
      .mockResolvedValueOnce({ videos: videosFrom(0, 50), total: 60 })
      // One new upload arrived, so the next page starts with the last row already shown
      .mockResolvedValueOnce({ videos: videosFrom(49, 11), total: 61 });
    const user = userEvent.setup();

    renderWithProviders(<VodDiaryScreen />);
    await user.click(await screen.findByRole('button', { name: 'Load 10 more' }));

    await waitFor(() => expect(screen.getByText('Record 59')).toBeInTheDocument());
    expect(screen.getAllByText('Record 49')).toHaveLength(1);
  });

  it('cancels an in-flight Load more when the filters change, so it never appends', async () => {
    const more = deferred<{ videos: ReturnType<typeof createMockVideo>[]; total: number }>();
    api.fetchRecentVideos
      .mockResolvedValueOnce({ videos: videosFrom(0, 50), total: 92 })
      .mockReturnValueOnce(more.promise);
    api.searchVideos.mockResolvedValue(videosFrom(500, 1));
    const user = userEvent.setup();

    renderWithProviders(<VodDiaryScreen />);
    await user.click(await screen.findByRole('button', { name: 'Load 42 more' }));
    const loadMoreSignal: AbortSignal = api.fetchRecentVideos.mock.calls[1][0].signal;

    // Filters change under the pending page (as a search or Back would do)
    await act(async () => nav.navigate('/?q=cooking'));
    await screen.findByText('Record 500');
    expect(loadMoreSignal.aborted).toBe(true);

    await act(async () => more.resolve({ videos: videosFrom(50, 42), total: 92 }));
    expect(screen.queryByText('Record 50')).not.toBeInTheDocument();
  });

  it('says when a search hit the result cap instead of implying that is everything', async () => {
    api.searchVideos.mockResolvedValue(videosFrom(0, 200));
    window.history.replaceState(null, '', '/?q=a');

    renderWithProviders(<VodDiaryScreen />);

    expect(await screen.findByText(/Showing the first 200 matches/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^Load \d+ more$/ })).not.toBeInTheDocument();
  }, 20_000); // renders 92 / 200 cards in jsdom — slow, not logic
});
