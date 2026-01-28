'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/useAuthStore';
import Sidebar from '@/components/sidebar';
import BottomNav from '@/components/bottom-nav';
import { PermissionDebug } from '@/components/permission-debug';
import { Loader2 } from 'lucide-react';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const hasHydrated = useAuthStore((state) => state._hasHydrated);
  const selectedOrganizationId = useAuthStore((state) => state.selectedOrganizationId);
  const selectedCompanyId = useAuthStore((state) => state.selectedCompanyId);
  const hasOrganizations = useAuthStore((state) => state.hasOrganizations());
  const user = useAuthStore((state) => state.user);
  const [mounted, setMounted] = useState(false);
  
  // Usar organizationId o companyId como fallback
  const selectedId = selectedOrganizationId || selectedCompanyId;

  // Asegurar que solo renderizamos en el cliente
  useEffect(() => {
    setMounted(true);
    // Forzar hidratación si no se ha completado después de 500ms
    const timer = setTimeout(() => {
      if (!hasHydrated) {
        useAuthStore.getState().setHasHydrated(true);
      }
    }, 500);
    return () => clearTimeout(timer);
  }, [hasHydrated]);

  useEffect(() => {
    // Solo redirigir después de que el estado se haya hidratado y montado
    if (mounted && hasHydrated) {
      if (!isAuthenticated) {
        router.push('/login');
        return;
      }

      // Validar que hay organizaciones disponibles
      if (hasOrganizations && !selectedId) {
        // Priorizar organizations sobre companies
        if (user?.organizations && user.organizations.length > 0) {
          useAuthStore.getState().selectOrganization(user.organizations[0].id);
        } else if (user?.companies && user.companies.length > 0) {
          useAuthStore.getState().selectCompany(user.companies[0].id);
        }
      }
    }
  }, [mounted, hasHydrated, isAuthenticated, selectedId, hasOrganizations, user, router]);

  // Mientras se carga o hidrata, mostrar un estado de carga
  if (!mounted || !hasHydrated) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto mb-2" />
          <p className="text-muted-foreground">Cargando...</p>
        </div>
      </div>
    );
  }

  // Si no está autenticado después de hidratar, mostrar carga mientras redirige
  if (!isAuthenticated) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto mb-2" />
          <p className="text-muted-foreground">Redirigiendo al login...</p>
        </div>
      </div>
    );
  }

  // Validar que hay una organización seleccionada antes de mostrar el contenido
  // (solo si el usuario tiene organizaciones)
  if (hasOrganizations && !selectedId) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto mb-2" />
          <p className="text-muted-foreground">Seleccionando organización...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col lg:flex-row min-h-screen bg-background text-foreground">
      {/* Desktop Sidebar */}
      <Sidebar />

      {/* Main Content */}
      <main className="flex-1 pb-24 lg:pb-0">
        {children}
      </main>

      {/* Mobile Bottom Navigation */}
      <BottomNav />
      
      {/* Debug Component (solo en desarrollo) */}
      <PermissionDebug />
    </div>
  );
}
