'use client';

import { useDisplayCurrency } from '@/hooks/useDisplayCurrency';
import { cn } from '@/lib/utils';

interface DisplayCurrencyToggleProps {
  className?: string;
  /** Si true, muestra etiquetas cortas ($ / Bs.). Si false, muestra USD / Bs. */
  short?: boolean;
}

/**
 * Toggle para alternar entre USD y Bs. en la visualización de datos.
 * Usa la tasa de la organización activa (misma que POS y configuración).
 */
export function DisplayCurrencyToggle({ className, short }: DisplayCurrencyToggleProps) {
  const { displayCurrency, setDisplayCurrency, exchangeRate } = useDisplayCurrency();

  const titleBs = exchangeRate !== 1
    ? `Ver datos en bolívares (tasa: 1 USD = ${Number(exchangeRate).toFixed(2)} Bs.)`
    : 'Ver datos en bolívares';

  return (
    <div
      role="group"
      aria-label="Moneda de visualización de datos"
      className={cn(
        'inline-flex rounded-lg border border-border bg-muted/30 p-0.5 text-sm shadow-sm',
        className
      )}
    >
      <button
        type="button"
        onClick={() => setDisplayCurrency('USD')}
        className={cn(
          'rounded-md px-2.5 sm:px-3 py-1.5 font-medium transition-colors min-h-[40px] sm:min-h-[44px] touch-manipulation focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
          displayCurrency === 'USD'
            ? 'bg-background text-foreground shadow-sm border border-border'
            : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
        )}
        title="Ver datos en dólares (USD)"
        aria-pressed={displayCurrency === 'USD'}
      >
        {short ? '$' : 'USD'}
      </button>
      <button
        type="button"
        onClick={() => setDisplayCurrency('BS')}
        className={cn(
          'rounded-md px-2.5 sm:px-3 py-1.5 font-medium transition-colors min-h-[40px] sm:min-h-[44px] touch-manipulation focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
          displayCurrency === 'BS'
            ? 'bg-background text-foreground shadow-sm border border-border'
            : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
        )}
        title={titleBs}
        aria-pressed={displayCurrency === 'BS'}
      >
        Bs.
      </button>
    </div>
  );
}
