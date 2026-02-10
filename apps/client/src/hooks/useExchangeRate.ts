import { useMemo } from 'react';
import { useAuthStore } from '@/store/useAuthStore';

/**
 * Lista de organizaciones para el usuario actual (misma lógica que el switcher).
 */
function useOrganizationsForRate() {
  const user = useAuthStore((s) => s.user);
  const superAdminOrganizations = useAuthStore((s) => s.superAdminOrganizations);
  const selectedOrganizationId = useAuthStore((s) => s.selectedOrganizationId);
  const selectedCompanyId = useAuthStore((s) => s.selectedCompanyId);
  return useMemo(() => {
    if (user?.isSuperAdmin && superAdminOrganizations.length > 0) return superAdminOrganizations;
    if (user?.organizations?.length) return user.organizations;
    if (user?.companies?.length) {
      return user.companies.map((c) => ({ id: c.id, exchangeRate: 1 }));
    }
    return [];
  }, [user, superAdminOrganizations]);
}

/**
 * Tasa de cambio de la organización actual. Sincronizada desde el servidor para toda la org:
 * al montar y al recuperar foco se refetch y todos los usuarios ven la misma tasa.
 */
export function useExchangeRate(): number {
  const organizations = useOrganizationsForRate();
  const selectedOrganizationId = useAuthStore((s) => s.selectedOrganizationId);
  const selectedCompanyId = useAuthStore((s) => s.selectedCompanyId);
  const selectedId = selectedOrganizationId ?? selectedCompanyId;

  return useMemo(() => {
    const org = organizations.find((o) => o.id === selectedId);
    if (org && 'exchangeRate' in org && org.exchangeRate != null) return Number(org.exchangeRate);
    return 1;
  }, [organizations, selectedId]);
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
  const organizations = useOrganizationsForRate();
  const selectedOrganizationId = useAuthStore((s) => s.selectedOrganizationId);
  const selectedCompanyId = useAuthStore((s) => s.selectedCompanyId);
  const selectedId = selectedOrganizationId ?? selectedCompanyId;

  return useMemo(() => {
    const defaultCurrency: TenantCurrency = { exchangeRate: 1, currencyCode: 'USD', currencySymbol: '$' };
    const org = organizations.find((o) => o.id === selectedId);
    if (!org) return defaultCurrency;
    return {
      exchangeRate: org && 'exchangeRate' in org && org.exchangeRate != null ? Number(org.exchangeRate) : 1,
      currencyCode: org && 'currencyCode' in org ? (org.currencyCode ?? 'USD') : 'USD',
      currencySymbol: org && 'currencySymbol' in org ? (org.currencySymbol ?? '$') : '$',
    };
  }, [organizations, selectedId]);
}
