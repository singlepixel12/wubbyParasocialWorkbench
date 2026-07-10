/**
 * Test utilities for React Testing Library
 * Provides custom render function with providers and common test helpers
 */

import { ReactElement } from 'react';
import { render, RenderOptions } from '@testing-library/react';

/**
 * Custom render function that wraps components with necessary providers
 */
export function renderWithProviders(
  ui: ReactElement,
  options?: Omit<RenderOptions, 'wrapper'>
) {
  return render(ui, { ...options });
}

/**
 * Mock localStorage for testing
 */
export function mockLocalStorage() {
  const storage: Record<string, string> = {};

  return {
    getItem: (key: string) => storage[key] || null,
    setItem: (key: string, value: string) => {
      storage[key] = value;
    },
    removeItem: (key: string) => {
      delete storage[key];
    },
    clear: () => {
      Object.keys(storage).forEach((key) => delete storage[key]);
    },
    get length() {
      return Object.keys(storage).length;
    },
    key: (index: number) => {
      const keys = Object.keys(storage);
      return keys[index] || null;
    },
  };
}

/**
 * Create a mock video object for testing.
 * Includes a videoHash by default — every video from the DB has one, and it is what
 * makes a card navigable. Pass `{ videoHash: undefined }` to exercise the inert case.
 */
export function createMockVideo(overrides = {}) {
  return {
    id: 1,
    url: 'https://archive.wubby.tv/vods/public/test.mp4',
    title: 'Test Video',
    summary: 'This is a test video summary',
    date: '2025-01-01',
    platform: 'twitch',
    tags: ['test', 'twitch'],
    videoHash: 'a'.repeat(64),
    ...overrides,
  };
}

// Re-export everything from @testing-library/react
export * from '@testing-library/react';
