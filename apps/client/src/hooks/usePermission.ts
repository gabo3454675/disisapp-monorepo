import { useMemo } from 'react';
import { useAuthStore } from '@/store/useAuthStore';

/**
 * Hook para verificar permisos basados en el rol del usuario
 * en la organización actual
 */
export function usePermission() {
  // Obtener valores reactivos directamente del store
  const selectedOrganizationId = useAuthStore((state) => state.selectedOrganizationId);
  const selectedCompanyId = useAuthStore((state) => state.selectedCompanyId);
  const user = useAuthStore((state) => state.user);

  // Calcular la organización actual de forma reactiva
  const currentOrg = useMemo(() => {
    // Priorizar organizations sobre companies
    if (selectedOrganizationId && user?.organizations) {
      return user.organizations.find((o) => o.id === selectedOrganizationId) || null;
    }
    
    if (selectedCompanyId && user?.companies) {
      return user.companies.find((c) => c.id === selectedCompanyId) || null;
    }
    
    return null;
  }, [selectedOrganizationId, selectedCompanyId, user]);

  // Calcular permisos de forma reactiva
  const permissions = useMemo(() => {
    // Normalizar el rol a mayúsculas para comparación
    const roleString = currentOrg?.role?.toString() || '';
    const role = roleString.toUpperCase().trim() as 'OWNER' | 'ADMIN' | 'SELLER' | 'WAREHOUSE' | string;
    
    // Debug - SIEMPRE mostrar información para diagnóstico
    if (typeof window !== 'undefined') {
      console.log('🔍 [usePermission] ===== DEBUG PERMISOS =====');
      console.log('[usePermission] Current Org:', currentOrg);
      console.log('[usePermission] Selected Org ID:', selectedOrganizationId);
      console.log('[usePermission] Selected Company ID:', selectedCompanyId);
      console.log('[usePermission] User:', user);
      console.log('[usePermission] User Organizations:', user?.organizations);
      console.log('[usePermission] User Companies:', user?.companies);
      console.log('[usePermission] Role (raw):', currentOrg?.role);
      console.log('[usePermission] Role (normalized):', role);
      
      if (!currentOrg) {
        console.warn('[usePermission] ⚠️ No se encontró organización actual');
      }
    }

    // Permisos basados en roles - comparación estricta
    const isOwner = role === 'OWNER';
    const isAdmin = role === 'ADMIN';
    const isSeller = role === 'SELLER';
    const isWarehouse = role === 'WAREHOUSE';

    // Permisos específicos
    const canManageExpenses = isOwner || isAdmin;
    const canManageTeam = isOwner || isAdmin;
    const canDelete = isOwner || isAdmin;
    const canInviteMembers = isOwner || isAdmin;
    const canCreateOrganization = isOwner; // Solo Super Admin puede crear organizaciones
    const canViewReports = isOwner || isAdmin;
    const canManageSettings = isOwner || isAdmin;
    const canAnulateInvoices = isOwner || isAdmin;
    const canDeleteInvoices = isOwner || isAdmin;
    const canManageProducts = isOwner || isAdmin || isWarehouse;
    const canManageCustomers = isOwner || isAdmin || isSeller;
    const canViewDashboard = true; // Todos pueden ver el dashboard básico
    const canViewFinancialCharts = isOwner || isAdmin; // Solo OWNER/ADMIN ven gráficos financieros

    return {
      role,
      isOwner,
      isAdmin,
      isSeller,
      isWarehouse,
      canManageExpenses,
      canManageTeam,
      canDelete,
      canInviteMembers,
      canCreateOrganization,
      canViewReports,
      canManageSettings,
      canAnulateInvoices,
      canDeleteInvoices,
      canManageProducts,
      canManageCustomers,
      canViewDashboard,
      canViewFinancialCharts,
    };
  }, [currentOrg, selectedOrganizationId, selectedCompanyId, user]);

  return permissions;
}
