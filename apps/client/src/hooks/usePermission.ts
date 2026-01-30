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
    const role = roleString.toUpperCase().trim() as 'SUPER_ADMIN' | 'ADMIN' | 'MANAGER' | 'SELLER' | 'WAREHOUSE' | string;
    
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
    const isSuperAdmin = role === 'SUPER_ADMIN';
    const isAdmin = role === 'ADMIN';
    const isManager = role === 'MANAGER';
    const isSeller = role === 'SELLER';
    const isWarehouse = role === 'WAREHOUSE';

    // Permisos específicos
    // SUPER_ADMIN tiene todos los permisos
    // ADMIN tiene permisos de gestión pero no puede crear otros ADMIN
    // MANAGER tiene permisos intermedios
    const canManageExpenses = isSuperAdmin || isAdmin || isManager;
    const canManageTeam = isSuperAdmin || isAdmin;
    const canDelete = isSuperAdmin || isAdmin;
    const canInviteMembers = isSuperAdmin || isAdmin;
    const canCreateOrganization = isSuperAdmin; // Solo SUPER_ADMIN puede crear organizaciones
    const canViewReports = isSuperAdmin || isAdmin || isManager;
    const canManageSettings = isSuperAdmin || isAdmin;
    const canAnulateInvoices = isSuperAdmin || isAdmin;
    const canDeleteInvoices = isSuperAdmin || isAdmin;
    const canManageProducts = isSuperAdmin || isAdmin || isManager || isWarehouse;
    const canManageCustomers = isSuperAdmin || isAdmin || isManager || isSeller;
    const canViewDashboard = true; // Todos pueden ver el dashboard básico
    const canViewFinancialCharts = isSuperAdmin || isAdmin || isManager; // SUPER_ADMIN/ADMIN/MANAGER ven gráficos financieros

    return {
      role,
      isSuperAdmin,
      isAdmin,
      isManager,
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
