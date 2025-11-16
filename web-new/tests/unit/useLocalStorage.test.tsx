/**
 * Unit tests for useLocalStorage hook
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import {
  useLocalStorage,
  useLocalStorageValue,
  removeFromLocalStorage,
  clearLocalStorage,
} from '@/lib/hooks/useLocalStorage';
import { mockLocalStorage } from '../test-utils';

describe('useLocalStorage', () => {
  let mockStorage: ReturnType<typeof mockLocalStorage>;

  beforeEach(() => {
    // Mock localStorage
    mockStorage = mockLocalStorage();
    Object.defineProperty(window, 'localStorage', {
      value: mockStorage,
      writable: true,
    });
  });

  it('should initialize with default value when localStorage is empty', () => {
    const { result } = renderHook(() => useLocalStorage('test-key', 'default'));

    expect(result.current[0]).toBe('default');
  });

  it('should initialize with stored value when localStorage has data', () => {
    mockStorage.setItem('test-key', JSON.stringify('stored-value'));

    const { result } = renderHook(() => useLocalStorage('test-key', 'default'));

    expect(result.current[0]).toBe('stored-value');
  });

  it('should update localStorage when value changes', () => {
    const { result } = renderHook(() => useLocalStorage('test-key', 'initial'));

    act(() => {
      result.current[1]('updated');
    });

    expect(result.current[0]).toBe('updated');
    expect(JSON.parse(mockStorage.getItem('test-key')!)).toBe('updated');
  });

  it('should support functional updates', () => {
    const { result } = renderHook(() => useLocalStorage('test-key', 5));

    act(() => {
      result.current[1]((prev) => prev + 10);
    });

    expect(result.current[0]).toBe(15);
    expect(JSON.parse(mockStorage.getItem('test-key')!)).toBe(15);
  });

  it('should handle complex objects', () => {
    const complexObj = { name: 'test', nested: { value: 42 }, array: [1, 2, 3] };

    const { result } = renderHook(() => useLocalStorage('test-key', complexObj));

    act(() => {
      result.current[1]({ ...complexObj, name: 'updated' });
    });

    expect(result.current[0].name).toBe('updated');
    expect(JSON.parse(mockStorage.getItem('test-key')!).name).toBe('updated');
  });

  it('should handle storage events from other tabs', async () => {
    const { result } = renderHook(() => useLocalStorage('test-key', 'initial'));

    // Manually update storage and trigger event listener
    act(() => {
      const newValue = JSON.stringify('from-other-tab');
      mockStorage.setItem('test-key', newValue);

      // Manually call the storage event handler
      const storageEvent = new Event('storage') as StorageEvent;
      Object.defineProperty(storageEvent, 'key', { value: 'test-key' });
      Object.defineProperty(storageEvent, 'newValue', { value: newValue });
      window.dispatchEvent(storageEvent);
    });

    await waitFor(() => {
      expect(result.current[0]).toBe('from-other-tab');
    });
  });

  it('should handle JSON parse errors gracefully', () => {
    mockStorage.setItem('test-key', 'invalid-json-{');

    const { result } = renderHook(() => useLocalStorage('test-key', 'default'));

    // Should fall back to default value
    expect(result.current[0]).toBe('default');
  });

  it('should handle arrays', () => {
    const { result } = renderHook(() => useLocalStorage<number[]>('test-key', []));

    act(() => {
      result.current[1]([1, 2, 3]);
    });

    expect(result.current[0]).toEqual([1, 2, 3]);
    expect(JSON.parse(mockStorage.getItem('test-key')!)).toEqual([1, 2, 3]);
  });
});

describe('useLocalStorageValue', () => {
  let mockStorage: ReturnType<typeof mockLocalStorage>;

  beforeEach(() => {
    mockStorage = mockLocalStorage();
    Object.defineProperty(window, 'localStorage', {
      value: mockStorage,
      writable: true,
    });
  });

  it('should return stored value', () => {
    mockStorage.setItem('test-key', JSON.stringify('stored'));

    const { result } = renderHook(() => useLocalStorageValue('test-key', 'default'));

    expect(result.current).toBe('stored');
  });

  it('should return default value when nothing stored', () => {
    const { result } = renderHook(() => useLocalStorageValue('test-key', 'default'));

    expect(result.current).toBe('default');
  });

  it('should handle parse errors', () => {
    mockStorage.setItem('test-key', 'invalid-json');

    const { result } = renderHook(() => useLocalStorageValue('test-key', 'default'));

    expect(result.current).toBe('default');
  });
});

describe('removeFromLocalStorage', () => {
  let mockStorage: ReturnType<typeof mockLocalStorage>;

  beforeEach(() => {
    mockStorage = mockLocalStorage();
    Object.defineProperty(window, 'localStorage', {
      value: mockStorage,
      writable: true,
    });
  });

  it('should remove item from localStorage', () => {
    mockStorage.setItem('test-key', JSON.stringify('value'));
    expect(mockStorage.getItem('test-key')).not.toBeNull();

    removeFromLocalStorage('test-key');

    expect(mockStorage.getItem('test-key')).toBeNull();
  });

  it('should not throw if key does not exist', () => {
    expect(() => removeFromLocalStorage('non-existent')).not.toThrow();
  });
});

describe('clearLocalStorage', () => {
  let mockStorage: ReturnType<typeof mockLocalStorage>;

  beforeEach(() => {
    mockStorage = mockLocalStorage();
    Object.defineProperty(window, 'localStorage', {
      value: mockStorage,
      writable: true,
    });
  });

  it('should clear all localStorage items', () => {
    mockStorage.setItem('key1', 'value1');
    mockStorage.setItem('key2', 'value2');
    expect(mockStorage.length).toBe(2);

    clearLocalStorage();

    expect(mockStorage.length).toBe(0);
  });
});
