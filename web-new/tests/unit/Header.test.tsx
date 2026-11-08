import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

const pathname = vi.hoisted(() => ({ value: '/' }));
vi.mock('next/navigation', () => ({ usePathname: () => pathname.value }));
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
});
