/**
 * Custom React hook for type-safe localStorage access
 * Handles SSR/hydration safely and provides automatic JSON serialization
 */

'use client';
import { logger } from '@/lib/utils/logger';

import { useState, useEffect } from 'react';

/**
 * Custom hook for persisting state in localStorage
 *
 * Features:
 * - Type-safe storage and retrieval
 * - Automatic JSON serialization/deserialization
 * - SSR-safe (works with Next.js server-side rendering)
 * - Error handling for storage quota exceeded
 * - Synchronization across browser tabs/windows
 *
 * @param key - The localStorage key to use
 * @param initialValue - Default value if no stored value exists
 * @returns [storedValue, setValue] - Current value and setter function
 *
 * @example
 * ```tsx
 * function Component() {
 *   const [videoUrl, setVideoUrl] = useLocalStorage<string>('selected-video', '');
 *   const [errors, setErrors] = useLocalStorage<ErrorInfo[]>('parasocial_errors', []);
 *
 *   return (
 *     <input
 *       value={videoUrl}
 *       onChange={(e) => setVideoUrl(e.target.value)}
 *     />
 *   );
 * }
 * ```
 */
export function useLocalStorage<T>(
  key: string,
  initialValue: T
): [T, (value: T | ((val: T) => T)) => void] {
  // State to store our value
  // Pass initial state function to useState so logic is only executed once
  const [storedValue, setStoredValue] = useState<T>(() => {
    // SSR check - localStorage is not available on server
    if (typeof window === 'undefined') {
      return initialValue;
    }

    try {
      // Get from local storage by key
      const item = window.localStorage.getItem(key);

      // Parse stored json or return initialValue
      return item ? (JSON.parse(item) as T) : initialValue;
    } catch (error) {
      // If error (e.g., JSON parse error), return initial value
      logger.warn(`Error reading localStorage key "${key}":`, error);
      return initialValue;
    }
  });

  // Return a wrapped version of useState's setter function that
  // persists the new value to localStorage
  const setValue = (value: T | ((val: T) => T)) => {
    try {
      // Allow value to be a function so we have same API as useState
      const valueToStore = value instanceof Function ? value(storedValue) : value;

      // Save state
      setStoredValue(valueToStore);

      // SSR check
      if (typeof window !== 'undefined') {
        // Save to local storage
        window.localStorage.setItem(key, JSON.stringify(valueToStore));
      }
    } catch (error) {
      // Handle storage quota exceeded errors
      if (error instanceof Error) {
        if (error.name === 'QuotaExceededError') {
          logger.error(
            `localStorage quota exceeded for key "${key}". Please clear some storage.`
          );
        } else {
          logger.error(`Error setting localStorage key "${key}":`, error);
        }
      }
    }
  };

  // Listen for changes to localStorage from other tabs/windows
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === key && e.newValue !== null) {
        try {
          setStoredValue(JSON.parse(e.newValue) as T);
        } catch (error) {
          logger.warn(`Error parsing storage event for key "${key}":`, error);
        }
      }
    };

    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, [key]);

  return [storedValue, setValue];
}

/**
 * Hook for reading localStorage without state management
 * Useful for one-time reads or when you don't need reactivity
 *
 * @param key - The localStorage key to read
 * @param defaultValue - Default value if no stored value exists
 * @returns The stored value or default value
 *
 * @example
 * ```ts
 * const selectedVideo = useLocalStorageValue<string>('selected-video', '');
 * ```
 */
export function useLocalStorageValue<T>(key: string, defaultValue: T): T {
  if (typeof window === 'undefined') {
    return defaultValue;
  }

  try {
    const item = window.localStorage.getItem(key);
    return item ? (JSON.parse(item) as T) : defaultValue;
  } catch (error) {
    logger.warn(`Error reading localStorage key "${key}":`, error);
    return defaultValue;
  }
}

/**
 * Remove an item from localStorage
 *
 * @param key - The localStorage key to remove
 *
 * @example
 * ```ts
 * removeFromLocalStorage('parasocial_errors');
 * ```
 */
export function removeFromLocalStorage(key: string): void {
  if (typeof window === 'undefined') return;

  try {
    window.localStorage.removeItem(key);
  } catch (error) {
    logger.error(`Error removing localStorage key "${key}":`, error);
  }
}

/**
 * Clear all items from localStorage
 * Use with caution!
 *
 * @example
 * ```ts
 * clearLocalStorage();
 * ```
 */
export function clearLocalStorage(): void {
  if (typeof window === 'undefined') return;

  try {
    window.localStorage.clear();
  } catch (error) {
    logger.error('Error clearing localStorage:', error);
  }
}
