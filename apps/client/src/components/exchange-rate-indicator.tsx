'use client';

import { useCallback, useMemo } from 'react';
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

function formatRateUpdatedAt(rateUpdatedAt: string | null | undefined): string {
  if (!rateUpdatedAt) return '';
  try {
    const d = new Date(rateUpdatedAt);
    return d.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  } catch {
    return '';
  }
}

interface ExchangeRateIndicatorProps {
  onOpenConfig: () => void;
  className?: string;
}

/**
 * Indicador de tasa en header. La tasa es única por organización y se sincroniza
 * desde el servidor para todos los usuarios; muestra quién la actualizó por última vez.
 */
export function ExchangeRateIndicator({ onOpenConfig, className }: ExchangeRateIndicatorProps) {
  const selectedOrganizationId = useAuthStore((s) => s.selectedOrganizationId);
  const selectedCompanyId = useAuthStore((s) => s.selectedCompanyId);
  const user = useAuthStore((s) => s.user);
  const superAdminOrganizations = useAuthStore((s) => s.superAdminOrganizations);
  const currentOrg = useMemo(
    () => useAuthStore.getState().getCurrentOrganization(),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- getCurrentOrganization() reads store; deps ensure recompute when selection changes
    [selectedOrganizationId, selectedCompanyId]
  );
  const orgWithRate = currentOrg && 'exchangeRate' in currentOrg ? currentOrg : null;
  const rate = orgWithRate?.exchangeRate;
  const hasRate = rate != null && Number.isFinite(rate);
  const isUpToDate = isRateUpdatedToday(orgWithRate?.rateUpdatedAt);
  const rateUpdatedBy = orgWithRate && 'rateUpdatedBy' in orgWithRate ? orgWithRate.rateUpdatedBy : null;
  const rateUpdatedAtFormatted = formatRateUpdatedAt(orgWithRate?.rateUpdatedAt);
  const isLoading = !currentOrg;
  const { isSuperAdmin, isAdmin, isManager } = usePermission();
  const canEdit = isSuperAdmin || isAdmin || isManager;

  const title = useMemo(() => {
    const parts = [canEdit ? 'Tocar para actualizar la tasa (aplica para toda la organización)' : 'Tasa (solo lectura)'];
    if (rateUpdatedBy) parts.push(`Actualizada por ${rateUpdatedBy}${rateUpdatedAtFormatted ? ` el ${rateUpdatedAtFormatted}` : ''}`);
    return parts.join('. ');
  }, [canEdit, rateUpdatedBy, rateUpdatedAtFormatted]);

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
      title={title}
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
