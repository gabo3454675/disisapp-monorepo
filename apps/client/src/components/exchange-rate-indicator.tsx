'use client';

import { useCallback } from 'react';
import { useAuthStore } from '@/store/useAuthStore';
import { usePermission } from '@/hooks/usePermission';
import { useExchangeRate } from '@/hooks/useExchangeRate';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

function isRateUpdatedToday(rateUpdatedAt: string | null | undefined): boolean {
  if (!rateUpdatedAt) return false;
  try {
    const d = new Date(rateUpdatedAt);
    const today = new Date();
    return (
      d.getFullYear() === today.getFullYear() &&
      d.getMonth() === today.getMonth() &&
      d.getDate() === today.getDate()
    );
  } catch {
    return false;
  }
}

interface ExchangeRateIndicatorProps {
  onOpenConfig: () => void;
  className?: string;
}

/**
 * Indicador de tasa en header: muestra "Bs. [valor]" con semáforo (verde = actualizado hoy, ámbar/rojo = desactualizado).
 * Todos ven el indicador; solo ADMIN y MANAGER (y SUPER_ADMIN) pueden abrir la configuración al tocar.
 */
export function ExchangeRateIndicator({ onOpenConfig, className }: ExchangeRateIndicatorProps) {
  const rate = useExchangeRate();
  const getCurrentOrganization = useAuthStore((s) => s.getCurrentOrganization);
  const { isSuperAdmin, isAdmin, isManager } = usePermission();

  const currentOrg = getCurrentOrganization();
  const orgWithRate = currentOrg && 'rateUpdatedAt' in currentOrg ? currentOrg : null;
  const isUpToDate = isRateUpdatedToday(orgWithRate?.rateUpdatedAt);
  const canEdit = isSuperAdmin || isAdmin || isManager;

  const handleClick = useCallback(() => {
    if (canEdit) {
      onOpenConfig();
    } else {
      toast.info('Solo lectura', {
        description: 'Solo administradores y gerentes pueden actualizar la tasa.',
      });
    }
  }, [canEdit, onOpenConfig]);

  return (
    <button
      type="button"
      onClick={handleClick}
      className={cn(
        'inline-flex items-center gap-2 rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors',
        'hover:bg-muted/80 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2',
        'min-h-[44px] touch-manipulation',
        className
      )}
      title={canEdit ? 'Tocar para actualizar la tasa' : 'Tasa (solo lectura)'}
    >
      <span
        className={cn(
          'h-2 w-2 shrink-0 rounded-full',
          isUpToDate ? 'bg-emerald-500' : 'bg-amber-500'
        )}
        aria-hidden
      />
      <span className="tabular-nums">Bs. {rate.toFixed(2)}</span>
    </button>
  );
}
