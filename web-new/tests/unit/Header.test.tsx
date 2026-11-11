import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const pathname = vi.hoisted(() => ({ value: '/' }));
const router = vi.hoisted(() => ({ back: vi.fn() }));
vi.mock('next/navigation', () => ({ usePathname: () => pathname.value, useRouter: () => router }));
const downloads = vi.hoisted(() => ({ list: [] as unknown[] }));
vi.mock('@/lib/listen/downloads-store', () => ({ useDownloads: () => downloads.list }));
vi.mock('@/lib/listen/downloads', () => ({ removeDownload: vi.fn(), resumeDownload: vi.fn(), onMobileData: () => false }));
import { Header } from '@/components/Header';

describe('Header', () => {
  it('shows a back arrow to the diary on /watch', () => {
    pathname.value = '/watch';
    render(<Header />);
    expect(screen.getByRole('link', { name: 'Back to VOD Diary' })).toHaveAttribute('href', '/');
  });

  it('has no back arrow on the diary', () => {
    pathname.value = '/';
    render(<Header />);
    expect(screen.queryByRole('link', { name: 'Back to VOD Diary' })).toBeNull();
  });

  it('back to a diary we came from in this window is a real Back (filters, pages and scroll return)', () => {
    pathname.value = '/';
    const { rerender } = render(<Header />);
    pathname.value = '/watch';
    rerender(<Header />);
    const back = screen.getByRole('link', { name: 'Back to VOD Diary' });
    expect(fireEvent.click(back)).toBe(false); // default prevented: no fresh navigation to "/"
    expect(router.back).toHaveBeenCalled();
  });

  it('a /watch opened on its own (new tab, notification) links to the diary instead', () => {
    router.back.mockClear();
    pathname.value = '/watch';
    render(<Header />);
    expect(fireEvent.click(screen.getByRole('link', { name: 'Back to VOD Diary' }))).toBe(true);
    expect(router.back).not.toHaveBeenCalled();
  });

  it('the menu is titled for the app, with no stale version line', async () => {
    pathname.value = '/';
    render(<Header />);
    await userEvent.click(screen.getByRole('button', { name: 'Open menu' }));
    expect(screen.getByRole('heading', { name: 'Menu' })).toBeInTheDocument();
    expect(screen.queryByText(/Navigation/)).toBeNull();
    expect(screen.queryByText(/Two-Tier UX/)).toBeNull();
    expect(screen.getByRole('link', { name: /VOD Diary/ })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('link', { name: /Get Transcript/ })).toBeInTheDocument();
  });

  it('"Saved for offline" opens the downloads list from any page', async () => {
    pathname.value = '/transcript';
    downloads.list = [{ hash: 'a'.repeat(64), title: 'Saved stream', state: 'ready', bytesDone: 400e6, bytesTotal: 400e6, lastListenedAt: 1 }];
    render(<Header />);
    await userEvent.click(screen.getByRole('button', { name: 'Open menu' }));
    await userEvent.click(screen.getByRole('button', { name: /Saved for offline.*1 ready · 400 MB/ }));
    expect(await screen.findByRole('link', { name: /Saved stream/ })).toHaveAttribute('href', `/watch?id=${'a'.repeat(64)}`);
    downloads.list = [];
  });
});
