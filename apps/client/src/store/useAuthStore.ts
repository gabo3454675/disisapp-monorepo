import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

export interface Company {
  id: number;
  name: string;
  taxId: string;
  logoUrl?: string | null;
  currency: string;
  role: string;
}

export interface Organization {
  id: number;
  name: string;
  slug: string;
  plan: string;
  role: string;
  currencyCode?: string;
  currencySymbol?: string;
  exchangeRate?: number;
  /** ISO date string; última actualización de la tasa (para tarea "Actualizar Tasa del Día") */
  rateUpdatedAt?: string | null;
  /** Email de quien actualizó la tasa por última vez (toda la org ve lo mismo) */
  rateUpdatedBy?: string | null;
}

interface User {
  id: number;
  email: string;
  fullName?: string | null;
  isSuperAdmin?: boolean;
  requiresPasswordChange?: boolean; // Usuario con clave temporal debe cambiarla
  organizations?: Organization[]; // Nuevo sistema
  companies?: Company[]; // Legacy - mantener para compatibilidad
}

interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  selectedCompanyId: number | null; // Mantener compatibilidad con "companies"
  selectedOrganizationId: number | null; // Nuevo sistema - preferir organizations
  /** Lista de todas las orgs (solo Super Admin). Se carga por fetch a /tenants/organizations-all. */
  superAdminOrganizations: Organization[];
  _hasHydrated: boolean;
  setAuth: (user: User, token: string) => void;
  clearAuth: () => void;
  selectCompany: (companyId: number) => void; // Legacy
  selectOrganization: (organizationId: number) => void; // Nuevo
  setSuperAdminOrganizations: (orgs: Organization[]) => void;
  setHasHydrated: (state: boolean) => void;
  // Helpers para obtener la organización actual
  getCurrentOrganization: () => Organization | Company | null;
  hasOrganizations: () => boolean;
  getOrganizations: () => Organization[];
  setOrganizationExchangeRate: (organizationId: number, exchangeRate: number, rateUpdatedAt?: string | null) => void;
  /** Actualiza la configuración de moneda/tasa de la organización en el store (tras guardar en backend). */
  setOrganizationConfig: (organizationId: number, config: { exchangeRate?: number; rateUpdatedAt?: string | null; rateUpdatedBy?: string | null; currencyCode?: string; currencySymbol?: string }) => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      token: null,
      isAuthenticated: false,
      selectedCompanyId: null,
      selectedOrganizationId: null,
      superAdminOrganizations: [],
      _hasHydrated: false,
      setAuth: (user, token) => {
        // Bloquear sesión si requiere cambio de contraseña (no debería llegar aquí; backend retorna 403)
        if (user.requiresPasswordChange) {
          if (typeof window !== 'undefined') {
            window.location.href = `/reset-password?email=${encodeURIComponent(user.email)}`;
          }
          return;
        }
        if (typeof window !== 'undefined') {
          localStorage.setItem('auth_token', token);
        }
        const organizations = user.organizations || [];
        const companies = user.companies || [];
        // Default Tenant: Super Admin sin org seleccionada → asignar la primera disponible
        const defaultOrgId = organizations.length > 0 ? organizations[0].id : (companies.length > 0 ? companies[0].id : null);
        // Super Admin: poblar superAdminOrganizations con todas las orgs para que el switcher muestre todas de inmediato
        const superAdminOrgs = user.isSuperAdmin && organizations.length > 0 ? organizations : undefined;
        set({
          user,
          token,
          isAuthenticated: true,
          selectedOrganizationId: defaultOrgId,
          selectedCompanyId: companies.length > 0 ? companies[0].id : defaultOrgId, // Compatibilidad con dashboard/api
          ...(superAdminOrgs && { superAdminOrganizations: superAdminOrgs }),
        });
      },
      clearAuth: () => {
        if (typeof window !== 'undefined') {
          localStorage.removeItem('auth_token');
        }
        set({
          user: null,
          token: null,
          isAuthenticated: false,
          selectedCompanyId: null,
          selectedOrganizationId: null,
          superAdminOrganizations: [],
        });
      },
      selectCompany: (companyId: number) => {
        // Legacy - mantener para compatibilidad
        const state = get();
        const isValidCompany = state.user?.companies?.some(
          (c) => c.id === companyId
        );
        
        if (isValidCompany) {
          set({ selectedCompanyId: companyId });
          // Persistir inmediatamente
          if (typeof window !== 'undefined') {
            const currentStorage = localStorage.getItem('auth-storage');
            if (currentStorage) {
              try {
                const storageData = JSON.parse(currentStorage);
                storageData.state.selectedCompanyId = companyId;
                localStorage.setItem('auth-storage', JSON.stringify(storageData));
              } catch (error) {
                // Error silencioso
              }
            }
          }
        } else {
          console.warn(`Company con ID ${companyId} no encontrada`);
        }
      },
      selectOrganization: (organizationId: number) => {
        const state = get();
        const isValidOrganization = state.user?.organizations?.some(
          (o) => o.id === organizationId
        );
        const isSuperAdmin = state.user?.isSuperAdmin === true;
        
        if (isValidOrganization || isSuperAdmin) {
          set({ selectedOrganizationId: organizationId });
          // Persistir inmediatamente en localStorage para que el interceptor lo lea
          if (typeof window !== 'undefined') {
            const currentStorage = localStorage.getItem('auth-storage');
            if (currentStorage) {
              try {
                const storageData = JSON.parse(currentStorage);
                storageData.state.selectedOrganizationId = organizationId;
                storageData.state.selectedCompanyId = organizationId; // También para compatibilidad
                localStorage.setItem('auth-storage', JSON.stringify(storageData));
              } catch (error) {
                // Error silencioso
              }
            }
          }
        } else {
          console.warn(`Organización con ID ${organizationId} no encontrada`);
        }
      },
      setSuperAdminOrganizations: (orgs: Organization[]) => {
        set({ superAdminOrganizations: orgs });
      },
      setHasHydrated: (state: boolean) => {
        set({ _hasHydrated: state });
      },
      // Helper para obtener la organización actual (prioriza organizations)
      getCurrentOrganization: () => {
        const state = get();
        const selectedId = state.selectedOrganizationId || state.selectedCompanyId;
        if (state.user?.isSuperAdmin && state.superAdminOrganizations.length > 0 && selectedId) {
          const found = state.superAdminOrganizations.find((o) => o.id === selectedId);
          if (found) return found;
        }
        if (selectedId && state.user?.organizations) {
          const found = state.user.organizations.find((o) => o.id === selectedId);
          return found || null;
        }
        if (state.selectedCompanyId && state.user?.companies) {
          const found = state.user.companies.find(
            (c) => c.id === state.selectedCompanyId
          );
          return found || null;
        }
        return null;
      },
      // Helper para verificar si el usuario tiene organizaciones (Super Admin cuenta como "tiene" para exigir selección)
      hasOrganizations: () => {
        const state = get();
        if (state.user?.isSuperAdmin) return true;
        const orgs = state.user?.organizations || [];
        const companies = state.user?.companies || [];
        return orgs.length > 0 || companies.length > 0;
      },
      // Helper para obtener todas las organizaciones
      getOrganizations: () => {
        const state = get();
        // Super Admin: usar lista de todas las orgs si está cargada
        if (state.user?.isSuperAdmin && state.superAdminOrganizations.length > 0) {
          return state.superAdminOrganizations;
        }
        // Priorizar organizations, pero incluir companies como fallback
        if (state.user?.organizations && state.user.organizations.length > 0) {
          return state.user.organizations;
        }
        // Convertir companies a formato organization si no hay organizations
        return (state.user?.companies || []).map((c) => ({
          id: c.id,
          name: c.name,
          slug: c.name.toLowerCase().replace(/\s+/g, '-'),
          plan: 'FREE',
          role: c.role,
          currencyCode: 'USD',
          currencySymbol: '$',
          exchangeRate: 1,
        }));
      },
      setOrganizationExchangeRate: (organizationId: number, exchangeRate: number, rateUpdatedAt?: string | null) => {
        const state = get();
        const orgs = state.user?.organizations;
        if (!orgs) return;
        const updated = orgs.map((o) =>
          o.id === organizationId ? { ...o, exchangeRate, ...(rateUpdatedAt !== undefined && { rateUpdatedAt }) } : o
        );
        set({ user: state.user ? { ...state.user, organizations: updated } : null });
      },
      setOrganizationConfig: (organizationId: number, config: { exchangeRate?: number; rateUpdatedAt?: string | null; rateUpdatedBy?: string | null; currencyCode?: string; currencySymbol?: string }) => {
        const state = get();
        const patch = (o: Organization): Organization => (o.id === organizationId ? { ...o, ...config } : o);
        if (state.user?.organizations?.length) {
          set({ user: { ...state.user, organizations: state.user.organizations.map(patch) } });
        }
        if (state.superAdminOrganizations?.length) {
          set({ superAdminOrganizations: state.superAdminOrganizations.map(patch) });
        }
      },
    }),
    {
      name: 'auth-storage',
      storage: createJSONStorage(() => {
        if (typeof window !== 'undefined') {
          return localStorage;
        }
        // Mock storage para SSR
        return {
          getItem: () => null,
          setItem: () => {},
          removeItem: () => {},
        };
      }),
      onRehydrateStorage: () => (state, error) => {
        if (error) {
          // Error silencioso - el store se inicializará con valores por defecto
        }
        if (state) {
          // Hydration: verificar isSuperAdmin y marcar como hidratado
          setTimeout(() => {
            state.setHasHydrated(true);
          }, 0);
        }
      },
      partialize: (state) => ({
        user: state.user,
        token: state.token,
        isAuthenticated: state.isAuthenticated,
        selectedCompanyId: state.selectedCompanyId,
        selectedOrganizationId: state.selectedOrganizationId,
      }),
    }
  )
);

// Hook para forzar hidratación si no se ha completado
if (typeof window !== 'undefined') {
  // En el cliente, asegurar que se marque como hidratado después de cargar
  const store = useAuthStore.getState();
  if (!store._hasHydrated) {
    setTimeout(() => {
      useAuthStore.getState().setHasHydrated(true);
    }, 100);
  }
}
