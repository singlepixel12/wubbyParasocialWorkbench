import { useEffect, useState } from 'react';

/**
 * useDebounce Hook
 * Debounces a value by a specified delay (default: 300ms)
 * Used for search input to prevent excessive API calls
 * Ported from: src/vodDiary.js debouncing logic
 */

export function useDebounce<T>(value: T, delay: number = 300): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    // Set up the timeout to update debounced value after delay
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    // Clean up timeout if value changes before delay completes
    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);

  return debouncedValue;
}
