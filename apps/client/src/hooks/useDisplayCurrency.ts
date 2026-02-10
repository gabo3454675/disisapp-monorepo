import { useMemo } from 'react';
import { useDisplayCurrencyStore } from '@/store/useDisplayCurrencyStore';
import { useExchangeRate } from '@/hooks/useExchangeRate';

export type DisplayCurrency = 'USD' | 'BS';

/** Tasa válida para conversión: nunca 0 ni NaN (fallback 1). */
function safeRate(rate: number): number {
  const n = Number(rate);
  return Number.isFinite(n) && n > 0 ? n : 1;
}

/**
 * Preferencia de moneda para visualizar datos (Dashboard, Facturas, Gastos, Créditos).
 * Convierte montos USD → Bs. con la tasa de la organización activa cuando el usuario elige "Bs.".
 * La tasa viene de la organización seleccionada en el header/sidebar (misma que POS y configuración).
 */
export function useDisplayCurrency() {
  const displayCurrency = useDisplayCurrencyStore((s) => s.displayCurrency);
  const setDisplayCurrency = useDisplayCurrencyStore((s) => s.setDisplayCurrency);
  const toggleDisplayCurrency = useDisplayCurrencyStore((s) => s.toggleDisplayCurrency);
  const rawRate = useExchangeRate();
  const exchangeRate = useMemo(() => safeRate(rawRate), [rawRate]);

  const formatForDisplay = useMemo(() => {
    return (amountUsd: number): string => {
      const amount = Number(amountUsd);
      if (!Number.isFinite(amount)) return new Intl.NumberFormat('es-VE', { style: 'currency', currency: 'USD', minimumFractionDigits: 2 }).format(0);
      const value = displayCurrency === 'BS' ? amount * exchangeRate : amount;
      const currency = displayCurrency === 'BS' ? 'VES' : 'USD';
      return new Intl.NumberFormat('es-VE', {
        style: 'currency',
        currency,
        minimumFractionDigits: 2,
      }).format(value);
    };
  }, [displayCurrency, exchangeRate]);

  const toDisplayAmount = useMemo(() => {
    return (amountUsd: number): number => {
      const amount = Number(amountUsd);
      if (!Number.isFinite(amount)) return 0;
      return displayCurrency === 'BS' ? amount * exchangeRate : amount;
    };
  }, [displayCurrency, exchangeRate]);

  return {
    displayCurrency,
    setDisplayCurrency,
    toggleDisplayCurrency,
    formatForDisplay,
    toDisplayAmount,
    exchangeRate,
    /** Etiqueta corta para el toggle: "USD" o "Bs." */
    label: displayCurrency === 'BS' ? 'Bs.' : 'USD',
  };
}
