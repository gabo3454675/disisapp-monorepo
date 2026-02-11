'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/useAuthStore';
import { apiClient } from '@/lib/api';
import Sidebar from '@/components/sidebar';
import BottomNav from '@/components/bottom-nav';
import { ExchangeRateIndicator } from '@/components/exchange-rate-indicator';
import { DisplayCurrencyToggle } from '@/components/display-currency-toggle';
import { TasksNotificationBell } from '@/components/tasks-notification-bell';
import { RateConfigModal } from '@/components/rate-config-modal';
import { PermissionDebug } from '@/components/permission-debug';
import { PWAInstallPrompt } from '@/components/pwa-install-prompt';
import { useSync } from '@/hooks/useSync';
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
  const [rateConfigModalOpen, setRateConfigModalOpen] = useState(false);

  // Sincronizar facturas pendientes al volver online
  useSync();

  // Sincronizar tasa de cambio desde el servidor: todos ven la misma tasa por organización
  const syncOrganizationRate = useCallback(() => {
    const id = useAuthStore.getState().selectedOrganizationId || useAuthStore.getState().selectedCompanyId;
    if (!id) return;
    apiClient
      .get<{ exchangeRate?: number; rateUpdatedAt?: string | null; rateUpdatedBy?: string | null; currencyCode?: string; currencySymbol?: string }>('/tenants/organization')
      .then((res) => {
        const d = res.data;
        useAuthStore.getState().setOrganizationConfig(id, {
          exchangeRate: d.exchangeRate,
          rateUpdatedAt: d.rateUpdatedAt ?? undefined,
          rateUpdatedBy: d.rateUpdatedBy ?? undefined,
          currencyCode: d.currencyCode,
          currencySymbol: d.currencySymbol,
        });
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!mounted || !hasHydrated || !isAuthenticated || !selectedId) return;
    syncOrganizationRate();
  }, [mounted, hasHydrated, isAuthenticated, selectedId, syncOrganizationRate]);

  useEffect(() => {
    if (!isAuthenticated || !selectedId) return;
    const onSync = () => syncOrganizationRate();
    const onVisibility = () => { if (document.visibilityState === 'visible') onSync(); };
    window.addEventListener('focus', onSync);
    window.addEventListener('visibilitychange', onVisibility);
    return () => {
      window.removeEventListener('focus', onSync);
      window.removeEventListener('visibilitychange', onVisibility);
    };
  }, [isAuthenticated, selectedId, syncOrganizationRate]);

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

      // requiresPasswordChange: bloquear acceso hasta actualizar clave temporal
      if (user?.requiresPasswordChange) {
        router.push(`/auth/reset-password?email=${encodeURIComponent(user.email)}`);
        return;
      }

      // Validar que hay organizaciones disponibles
      if (hasOrganizations && !selectedId) {
        // Priorizar organizations sobre companies
        if (user?.organizations && user.organizations.length > 0) {
          useAuthStore.getState().selectOrganization(user.organizations[0].id);
        } else if (user?.companies && user.companies.length > 0) {
          useAuthStore.getState().selectCompany(user.companies[0].id);
        } else if (user?.isSuperAdmin) {
          // Super Admin sin org seleccionada: fetch y asignar la primera disponible
          apiClient.get<{ id: number; name: string; slug: string; plan: string }[]>('/tenants/organizations-all')
            .then((res) => {
              const orgs = res.data || [];
              if (orgs.length > 0) {
                useAuthStore.getState().selectOrganization(orgs[0].id);
                useAuthStore.getState().setSuperAdminOrganizations(orgs.map((o) => ({
                  id: o.id,
                  name: o.name,
                  slug: o.slug,
                  plan: o.plan,
                  role: 'SUPER_ADMIN',
                  currencyCode: 'USD',
                  currencySymbol: '$',
                  exchangeRate: 1,
                  rateUpdatedAt: null,
                })));
              }
            })
            .catch(() => {});
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
      <main className="flex-1 flex flex-col pb-24 lg:pb-0 min-w-0 overflow-x-hidden">
        {/* Header: indicador de tasa + campanita de tareas */}
        <header className="sticky top-0 z-10 flex shrink-0 flex-wrap items-center justify-end gap-2 sm:gap-3 border-b border-border bg-background/95 px-3 py-2 sm:px-4 backdrop-blur supports-[backdrop-filter]:bg-background/80">
          <TasksNotificationBell />
          <DisplayCurrencyToggle className="shrink-0" short />
          <ExchangeRateIndicator onOpenConfig={() => setRateConfigModalOpen(true)} className="shrink-0" />
        </header>
        <div className="flex-1 min-w-0 overflow-x-hidden">{children}</div>
      </main>

      {/* Modal de configuración de tasa (abierto desde el indicador) */}
      <RateConfigModal open={rateConfigModalOpen} onOpenChange={setRateConfigModalOpen} />

      {/* Mobile Bottom Navigation */}
      <BottomNav />
      
      {/* PWA Install Prompt */}
      <PWAInstallPrompt />
      
      {/* Debug Component (solo en desarrollo) */}
      <PermissionDebug />
    </div>
  );
}
