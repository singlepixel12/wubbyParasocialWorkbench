import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';

const api = vi.hoisted(() => ({
  getWubbySummaryByHash: vi.fn(),
  isNetworkError: vi.fn((e: unknown) => e instanceof TypeError),
}));
vi.mock('@/lib/api/supabase', () => api);
const offline = vi.hoisted(() => ({ savedVideo: vi.fn(async (): Promise<unknown> => null), rememberVodDetails: vi.fn(async () => {}) }));
vi.mock('@/lib/offline/saved-vods', () => ({ savedVideo: offline.savedVideo }));
vi.mock('@/lib/listen/downloads', () => ({ rememberVodDetails: offline.rememberVodDetails }));
vi.mock('next/navigation', () => ({ useSearchParams: () => new URLSearchParams({ id: 'a'.repeat(64) }) }));
vi.mock('@/components/video/VideoDetailView', () => ({ VideoDetailView: ({ video }: { video: { title: string } }) => <h1>{video.title}</h1> }));

import WatchPage from '@/app/watch/page';

beforeEach(() => {
  vi.clearAllMocks();
  vi.restoreAllMocks();
  offline.savedVideo.mockResolvedValue(null);
});

describe('WatchPage', () => {
  it('says the archive could not be reached, and Retry loads it', async () => {
    api.getWubbySummaryByHash.mockRejectedValueOnce(new TypeError('Failed to fetch')).mockResolvedValueOnce({ title: 'Costco Pizzas' });
    render(<WatchPage />);
    expect(await screen.findByText(/couldn.t reach the archive/i)).toBeInTheDocument();
    expect(screen.queryByText(/not found/i)).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: /retry/i }));
    expect(await screen.findByRole('heading', { name: 'Costco Pizzas' })).toBeInTheDocument();
  });

  it('keeps "not found" for a VOD that genuinely does not exist, without Retry', async () => {
    api.getWubbySummaryByHash.mockResolvedValueOnce(null);
    render(<WatchPage />);
    expect(await screen.findByRole('heading', { name: /video not found/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /retry/i })).toBeNull();
  });
});

describe('WatchPage — offline (Phase 3b)', () => {
  it('a downloaded VOD shows at once from the phone, even while the API waits for a connection', async () => {
    offline.savedVideo.mockResolvedValue({ title: 'Saved Pizzas', videoHash: 'a'.repeat(64) });
    api.getWubbySummaryByHash.mockReturnValue(new Promise(() => undefined));
    render(<WatchPage />);
    expect(await screen.findByRole('heading', { name: 'Saved Pizzas' })).toBeInTheDocument();
  });

  it('a failing API never replaces a saved VOD with an error', async () => {
    offline.savedVideo.mockResolvedValue({ title: 'Saved Pizzas' });
    api.getWubbySummaryByHash.mockRejectedValue(new TypeError('Failed to fetch'));
    render(<WatchPage />);
    expect(await screen.findByRole('heading', { name: 'Saved Pizzas' })).toBeInTheDocument();
    await new Promise((r) => setTimeout(r, 20));
    expect(screen.queryByText(/connection problem/i)).toBeNull();
  });

  it('online, a fresh row refreshes the saved copy without swapping the page', async () => {
    offline.savedVideo.mockResolvedValue({ title: 'Saved Pizzas' });
    api.getWubbySummaryByHash.mockResolvedValue({ title: 'Fresh Pizzas' });
    render(<WatchPage />);
    expect(await screen.findByRole('heading', { name: 'Saved Pizzas' })).toBeInTheDocument();
    await vi.waitFor(() => expect(offline.rememberVodDetails).toHaveBeenCalledWith({ title: 'Fresh Pizzas' }));
    expect(screen.queryByRole('heading', { name: 'Fresh Pizzas' })).toBeNull();
  });

  it('offline and not saved: says so with Retry, instead of "Loading" forever', async () => {
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false);
    render(<WatchPage />);
    expect(await screen.findByRole('heading', { name: /you.re offline/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument();
    expect(api.getWubbySummaryByHash).not.toHaveBeenCalled();
  });

  it('offline and not saved: opens by itself when the signal comes back', async () => {
    const onLine = vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false);
    api.getWubbySummaryByHash.mockResolvedValue({ title: 'Back Online Pizzas' });
    render(<WatchPage />);
    expect(await screen.findByRole('heading', { name: /you.re offline/i })).toBeInTheDocument();
    expect(screen.getByText(/opens by itself/i)).toBeInTheDocument();
    onLine.mockReturnValue(true);
    act(() => void window.dispatchEvent(new Event('online')));
    expect(await screen.findByRole('heading', { name: 'Back Online Pizzas' })).toBeInTheDocument();
  });

  it('a connection problem also retries by itself on "online"', async () => {
    api.getWubbySummaryByHash.mockRejectedValueOnce(new TypeError('Failed to fetch')).mockResolvedValueOnce({ title: 'Recovered Pizzas' });
    render(<WatchPage />);
    expect(await screen.findByText(/couldn.t reach the archive/i)).toBeInTheDocument();
    act(() => void window.dispatchEvent(new Event('online')));
    expect(await screen.findByRole('heading', { name: 'Recovered Pizzas' })).toBeInTheDocument();
  });
});
