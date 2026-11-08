import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

const api = vi.hoisted(() => ({
  getWubbySummaryByHash: vi.fn(),
  isNetworkError: vi.fn((e: unknown) => e instanceof TypeError),
}));
vi.mock('@/lib/api/supabase', () => api);
vi.mock('next/navigation', () => ({ useSearchParams: () => new URLSearchParams({ id: 'a'.repeat(64) }) }));
vi.mock('@/components/video/VideoDetailView', () => ({ VideoDetailView: ({ video }: { video: { title: string } }) => <h1>{video.title}</h1> }));

import WatchPage from '@/app/watch/page';

beforeEach(() => vi.clearAllMocks());

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
