import { useState, useEffect } from 'react';

/**
 * Debounce de valores para búsquedas e inputs (React Native).
 * Evita llamadas excesivas a API o filtros mientras el usuario escribe.
 * @param value - Valor a debouncear (ej. texto de búsqueda)
 * @param delay - Retraso en ms (default 300)
 */
export function useDebounce<T>(value: T, delay: number = 300): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => clearTimeout(handler);
  }, [value, delay]);

  return debouncedValue;
}
