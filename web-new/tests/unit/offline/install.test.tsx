import { describe, expect, it, vi } from 'vitest';
import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMockVideo } from '../../test-utils';

vi.mock('next/navigation', () => ({ usePathname: () => '/' }));

import { VideoCard } from '@/components/vod-diary/VideoCard';
import { Header } from '@/components/Header';

function standalone(on: boolean) {
  vi.mocked(window.matchMedia).mockImplementation(
    (query: string) => ({ matches: on && query === '(display-mode: standalone)', media: query, addEventListener: vi.fn(), removeEventListener: vi.fn() }) as unknown as MediaQueryList,
  );
}

describe('cards in the installed app', () => {
  it('open /watch in a new tab in the browser', () => {
    standalone(false);
    render(<VideoCard video={createMockVideo({ title: 'In a tab' })} />);
    expect(screen.getByRole('link', { name: 'Play In a tab' })).toHaveAttribute('target', '_blank');
  });

  it('open /watch in the same window inside the installed app', () => {
    standalone(true);
    render(<VideoCard video={createMockVideo({ title: 'In the app' })} />);
    const link = screen.getByRole('link', { name: 'Play In the app' });
    expect(link).not.toHaveAttribute('target');
    standalone(false);
  });
});

describe('Install app (menu)', () => {
  it('appears only once Chrome offers an install, and shows Chrome\'s prompt', async () => {
    standalone(false);
    render(<Header />);
    await userEvent.click(screen.getByRole('button', { name: 'Open menu' }));
    expect(screen.queryByRole('button', { name: /install app/i })).toBeNull();

    const prompt = vi.fn(async () => {});
    const offer = Object.assign(new Event('beforeinstallprompt', { cancelable: true }), { prompt, userChoice: Promise.resolve({ outcome: 'accepted' }) });
    await act(async () => void window.dispatchEvent(offer));
    expect(offer.defaultPrevented).toBe(true); // no mini-infobar; it lives in the menu

    await userEvent.click(await screen.findByRole('button', { name: /install app/i }));
    expect(prompt).toHaveBeenCalledTimes(1);
  });
});
