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
  exchangeRate?: number;
}

interface User {
  id: number;
  email: string;
  fullName?: string | null;
  organizations?: Organization[]; // Nuevo sistema
  companies?: Company[]; // Legacy - mantener para compatibilidad
}

interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  selectedCompanyId: number | null; // Mantener compatibilidad con "companies"
  selectedOrganizationId: number | null; // Nuevo sistema - preferir organizations
  _hasHydrated: boolean;
  setAuth: (user: User, token: string) => void;
  clearAuth: () => void;
  selectCompany: (companyId: number) => void; // Legacy
  selectOrganization: (organizationId: number) => void; // Nuevo
  setHasHydrated: (state: boolean) => void;
  // Helpers para obtener la organización actual
  getCurrentOrganization: () => Organization | Company | null;
  hasOrganizations: () => boolean;
  getOrganizations: () => Organization[];
  setOrganizationExchangeRate: (organizationId: number, exchangeRate: number) => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      token: null,
      isAuthenticated: false,
      selectedCompanyId: null,
      selectedOrganizationId: null,
      _hasHydrated: false,
      setAuth: (user, token) => {
        if (typeof window !== 'undefined') {
          localStorage.setItem('auth_token', token);
        }
        
        // Debug: Ver qué se está guardando
        console.log('🔍 [useAuthStore] setAuth llamado');
        console.log('[useAuthStore] User recibido:', user);
        console.log('[useAuthStore] User.organizations:', user.organizations);
        console.log('[useAuthStore] User.companies:', user.companies);
        
        // Priorizar organizations sobre companies
        const organizations = user.organizations || [];
        const companies = user.companies || [];
        
        console.log('[useAuthStore] Organizations array:', organizations);
        console.log('[useAuthStore] Companies array:', companies);
        
        // Seleccionar la primera organización o company disponible
        const selectedOrgId = organizations.length > 0 
          ? organizations[0].id 
          : companies.length > 0 
            ? companies[0].id 
            : null;
        
        console.log('[useAuthStore] Selected Org ID:', selectedOrgId);
        console.log('[useAuthStore] First organization:', organizations[0]);
        if (organizations[0]) {
          console.log('[useAuthStore] First organization role:', organizations[0].role);
        }
        
        set({
          user,
          token,
          isAuthenticated: true,
          selectedOrganizationId: organizations.length > 0 ? organizations[0].id : null,
          selectedCompanyId: companies.length > 0 ? companies[0].id : null,
        });
        
        console.log('🔍 [useAuthStore] setAuth completado');
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
        // Nuevo sistema - preferir organizations
        const state = get();
        const isValidOrganization = state.user?.organizations?.some(
          (o) => o.id === organizationId
        );
        
        if (isValidOrganization) {
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
      setHasHydrated: (state: boolean) => {
        set({ _hasHydrated: state });
      },
      // Helper para obtener la organización actual (prioriza organizations)
      getCurrentOrganization: () => {
        const state = get();
        
        // Debug
        if (typeof window !== 'undefined') {
          console.log('🔍 [getCurrentOrganization] Llamado');
          console.log('[getCurrentOrganization] Selected Org ID:', state.selectedOrganizationId);
          console.log('[getCurrentOrganization] Selected Company ID:', state.selectedCompanyId);
          console.log('[getCurrentOrganization] User:', state.user);
          console.log('[getCurrentOrganization] User Organizations:', state.user?.organizations);
        }
        
        // Priorizar organizations sobre companies
        if (state.selectedOrganizationId && state.user?.organizations) {
          const found = state.user.organizations.find(
            (o) => o.id === state.selectedOrganizationId
          );
          if (typeof window !== 'undefined') {
            console.log('[getCurrentOrganization] Found org:', found);
          }
          return found || null;
        }
        
        if (state.selectedCompanyId && state.user?.companies) {
          const found = state.user.companies.find(
            (c) => c.id === state.selectedCompanyId
          );
          if (typeof window !== 'undefined') {
            console.log('[getCurrentOrganization] Found company:', found);
          }
          return found || null;
        }
        
        if (typeof window !== 'undefined') {
          console.warn('[getCurrentOrganization] ⚠️ No se encontró organización');
        }
        return null;
      },
      // Helper para verificar si el usuario tiene organizaciones
      hasOrganizations: () => {
        const state = get();
        const orgs = state.user?.organizations || [];
        const companies = state.user?.companies || [];
        return orgs.length > 0 || companies.length > 0;
      },
      // Helper para obtener todas las organizaciones
      getOrganizations: () => {
        const state = get();
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
        }));
      },
      setOrganizationExchangeRate: (organizationId: number, exchangeRate: number) => {
        const state = get();
        const orgs = state.user?.organizations;
        if (!orgs) return;
        const updated = orgs.map((o) =>
          o.id === organizationId ? { ...o, exchangeRate } : o
        );
        set({ user: state.user ? { ...state.user, organizations: updated } : null });
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
          // Forzar hidratación después de un pequeño delay para asegurar que se complete
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
