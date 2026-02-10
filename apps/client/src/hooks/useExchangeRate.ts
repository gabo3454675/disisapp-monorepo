import { useMemo } from 'react';
import { useAuthStore } from '@/store/useAuthStore';

/**
 * Tasa de cambio global y reactiva desde el store (Zustand).
 * Cualquier componente que use este hook se re-renderiza cuando se actualiza
 * la tasa en la organización activa (Configuración → Guardar tasa), sin recargar.
 * Usar en: Facturación/POS, Dashboard, Gastos, Sidebar, etc.
 */
export function useExchangeRate(): number {
  const user = useAuthStore((state) => state.user);
  const selectedOrganizationId = useAuthStore((state) => state.selectedOrganizationId);
  const selectedCompanyId = useAuthStore((state) => state.selectedCompanyId);

  return useMemo(() => {
    const orgId = selectedOrganizationId || selectedCompanyId;
    if (!orgId || !user?.organizations?.length) return 1;
    const org = user.organizations.find((o) => o.id === orgId);
    if (org?.exchangeRate != null) return Number(org.exchangeRate);
    return 1;
  }, [user, selectedOrganizationId, selectedCompanyId]);
}

export interface TenantCurrency {
  exchangeRate: number;
  currencyCode: string;
  currencySymbol: string;
}

/**
 * Moneda del tenant activo (organización seleccionada).
 * Usar para formatear precios, totales y cálculos de IVA/IGTF según la organización.
 */
export function useTenantCurrency(): TenantCurrency {
  const user = useAuthStore((state) => state.user);
  const selectedOrganizationId = useAuthStore((state) => state.selectedOrganizationId);
  const selectedCompanyId = useAuthStore((state) => state.selectedCompanyId);

  return useMemo(() => {
    const orgId = selectedOrganizationId || selectedCompanyId;
    const defaultCurrency: TenantCurrency = { exchangeRate: 1, currencyCode: 'USD', currencySymbol: '$' };
    if (!orgId || !user?.organizations?.length) return defaultCurrency;
    const org = user.organizations.find((o) => o.id === orgId);
    if (!org) return defaultCurrency;
    return {
      exchangeRate: org?.exchangeRate != null ? Number(org.exchangeRate) : 1,
      currencyCode: org?.currencyCode ?? 'USD',
      currencySymbol: org?.currencySymbol ?? '$',
    };
  }, [user, selectedOrganizationId, selectedCompanyId]);
}
