import { useMemo } from 'react';
import { useAuthStore } from '@/store/useAuthStore';

/**
 * Lista de organizaciones para el usuario actual (igual lógica que el switcher).
 * Super Admin: superAdminOrganizations; resto: user.organizations o user.companies.
 */
function useOrganizationsList() {
  const user = useAuthStore((s) => s.user);
  const superAdminOrganizations = useAuthStore((s) => s.superAdminOrganizations);
  const selectedOrganizationId = useAuthStore((s) => s.selectedOrganizationId);
  const selectedCompanyId = useAuthStore((s) => s.selectedCompanyId);
  return useMemo(() => {
    if (user?.isSuperAdmin && superAdminOrganizations.length > 0) {
      return superAdminOrganizations;
    }
    if (user?.organizations?.length) return user.organizations;
    if (user?.companies?.length) {
      return user.companies.map((c) => ({
        id: c.id,
        name: c.name,
        slug: c.name.toLowerCase().replace(/\s+/g, '-'),
        plan: 'FREE',
        role: c.role,
      }));
    }
    return [];
  }, [user, superAdminOrganizations]);
}

/**
 * Hook para verificar permisos basados en el rol del usuario en la organización actual.
 * Para Super Admin usa la misma fuente que el switcher (superAdminOrganizations) así
 * el rol es correcto aunque no sea miembro de la org seleccionada.
 */
export function usePermission() {
  const selectedOrganizationId = useAuthStore((s) => s.selectedOrganizationId);
  const selectedCompanyId = useAuthStore((s) => s.selectedCompanyId);
  const organizations = useOrganizationsList();
  const selectedId = selectedOrganizationId ?? selectedCompanyId;

  const currentOrg = useMemo(
    () => organizations.find((o) => o.id === selectedId) ?? null,
    [organizations, selectedId]
  );

  const permissions = useMemo(() => {
    const roleString = currentOrg?.role?.toString() ?? '';
    const role = roleString.toUpperCase().trim() as
      | 'SUPER_ADMIN'
      | 'ADMIN'
      | 'MANAGER'
      | 'SELLER'
      | 'WAREHOUSE'
      | string;

    const isSuperAdmin = role === 'SUPER_ADMIN';
    const isAdmin = role === 'ADMIN';
    const isManager = role === 'MANAGER';
    const isSeller = role === 'SELLER';
    const isWarehouse = role === 'WAREHOUSE';

    return {
      role,
      isSuperAdmin,
      isAdmin,
      isManager,
      isSeller,
      isWarehouse,
      canManageExpenses: isSuperAdmin || isAdmin || isManager,
      canManageTeam: isSuperAdmin || isAdmin,
      canDelete: isSuperAdmin || isAdmin,
      canInviteMembers: isSuperAdmin || isAdmin,
      canAssignTasks: isSuperAdmin || isAdmin || isManager,
      canCreateOrganization: isSuperAdmin,
      canViewReports: isSuperAdmin || isAdmin || isManager,
      canManageSettings: isSuperAdmin || isAdmin,
      canAnulateInvoices: isSuperAdmin || isAdmin,
      canDeleteInvoices: isSuperAdmin || isAdmin,
      canManageProducts: isSuperAdmin || isAdmin || isManager || isWarehouse,
      canManageInventory: isSuperAdmin || isAdmin || isManager || isWarehouse,
      canManageCustomers: isSuperAdmin || isAdmin || isManager || isSeller,
      canViewDashboard: true,
      canViewFinancialCharts: isSuperAdmin || isAdmin || isManager,
    };
  }, [currentOrg]);

  return permissions;
}
