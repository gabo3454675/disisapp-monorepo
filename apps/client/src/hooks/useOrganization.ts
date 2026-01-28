import { useEffect } from 'react';
import { useAuthStore } from '@/store/useAuthStore';

/**
 * Hook personalizado para manejar la organización actual
 * Proporciona acceso fácil a la organización seleccionada y métodos para cambiarla
 */
export function useOrganization() {
  const selectedCompanyId = useAuthStore((state) => state.selectedCompanyId);
  const user = useAuthStore((state) => state.user);
  const selectCompany = useAuthStore((state) => state.selectCompany);
  const getCurrentOrganization = useAuthStore((state) => state.getCurrentOrganization);
  const hasOrganizations = useAuthStore((state) => state.hasOrganizations);

  const currentOrganization = getCurrentOrganization();
  const organizations = user?.companies || [];

  // Escuchar cambios de organización para recargar datos si es necesario
  useEffect(() => {
    const handleOrganizationChange = () => {
      // Los componentes pueden escuchar este evento para recargar datos
      // Ejemplo: window.addEventListener('organization-changed', handleReload)
    };

    window.addEventListener('organization-changed', handleOrganizationChange);
    return () => {
      window.removeEventListener('organization-changed', handleOrganizationChange);
    };
  }, []);

  return {
    currentOrganization,
    selectedOrganizationId: selectedCompanyId,
    organizations,
    selectOrganization: selectCompany,
    hasOrganizations: hasOrganizations(),
    isLoading: !selectedCompanyId && hasOrganizations(),
  };
}
