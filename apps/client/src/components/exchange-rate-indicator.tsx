'use client';

import { useCallback } from 'react';
import { useAuthStore } from '@/store/useAuthStore';
import { usePermission } from '@/hooks/usePermission';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { Loader2 } from 'lucide-react';

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
 * Indicador de tasa en header (desktop y móvil): lee exchangeRate del store global.
 * Se re-renderiza cuando se actualiza la tasa en Configuración o al cambiar de organización.
 * Muestra "Bs. XX.XX" con 2 decimales; si no hay tasa, muestra "---" o loading.
 */
export function ExchangeRateIndicator({ onOpenConfig, className }: ExchangeRateIndicatorProps) {
  const { user, selectedOrganizationId, selectedCompanyId } = useAuthStore();

  const selectedId = selectedOrganizationId || selectedCompanyId;
  const currentOrg = user?.organizations?.length && selectedId
    ? user.organizations.find((o) => o.id === selectedId)
    : null;
  const rate = currentOrg?.exchangeRate;
  const hasRate = rate != null && Number.isFinite(rate);
  const isLoading = !user && selectedId === null;
  const isUpToDate = isRateUpdatedToday(currentOrg?.rateUpdatedAt);
  const { isSuperAdmin, isAdmin, isManager } = usePermission();
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
          hasRate && (isUpToDate ? 'bg-emerald-500' : 'bg-amber-500'),
          !hasRate && 'bg-muted-foreground/50'
        )}
        aria-hidden
      />
      {isLoading ? (
        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" aria-hidden />
      ) : hasRate ? (
        <span className="tabular-nums">Bs. {Number(rate).toFixed(2)}</span>
      ) : (
        <span className="text-muted-foreground tabular-nums">---</span>
      )}
    </button>
  );
}
