import { useEffect, useState } from 'react';

/**
 * Debounce a rapidly changing value (e.g. a search box) so downstream effects
 * and queries only run once the user pauses typing.
 */
export function useDebouncedValue<T>(value: T, delayMs = 300): T {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(timer);
  }, [value, delayMs]);

  return debounced;
}
