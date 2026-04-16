'use client';

import { useState, useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { Grid2x2, ShoppingCart, Box, MoreVertical, Users, FileText, CreditCard, DollarSign, Settings, LogOut, Car, PackageMinus, History, BarChart3, Wallet, AlertTriangle, TrendingUp, Truck, Landmark } from 'lucide-react';
import { ThemeToggle } from '@/components/theme-toggle';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import { cn } from '@/lib/utils';
import { usePermission } from '@/hooks/usePermission';
import { canShowNavItem } from '@/hooks/useNavByRole';
import { useAuthStore } from '@/store/useAuthStore';
import { apiClient, authService } from '@/lib/api';

const navigationItems = [
  { id: 'dashboard', label: 'Dashboard', icon: Grid2x2, href: '/', permission: 'canViewDashboard' as const },
  { id: 'pos', label: 'POS', icon: ShoppingCart, href: '/pos', permission: 'canManageCustomers' as const },
  { id: 'products', label: 'Inventario', icon: Box, href: '/products', permission: 'canManageProducts' as const },
];

// Enlaces adicionales que aparecen en el menú "Más" (filtrados por rol)
const additionalMenuItems = [
  { id: 'customers', label: 'Clientes', icon: Users, href: '/customers', permission: 'canManageCustomers' as const },
  { id: 'invoices', label: 'Facturas', icon: FileText, href: '/invoices', permission: 'canManageCustomers' as const },
  { id: 'history', label: 'Historial de Ventas', icon: History, href: '/history', permission: 'canManageCustomers' as const },
  { id: 'cierre-caja', label: 'Cierre de caja', icon: Wallet, href: '/cierre-caja', permission: 'canManageCustomers' as const },
  { id: 'credits', label: 'Cuentas por Cobrar', icon: CreditCard, href: '/credits', permission: 'canManageCustomers' as const },
  { id: 'expenses', label: 'Gastos', icon: DollarSign, href: '/expenses', permission: 'canManageExpenses' as const },
  { id: 'suppliers', label: 'Proveedores', icon: Truck, href: '/suppliers', permission: 'canManageExpenses' as const },
  { id: 'accounts-payable', label: 'Cuentas por pagar', icon: Landmark, href: '/accounts-payable', permission: 'canManageExpenses' as const },
  { id: 'alertas-stock', label: 'Alertas inventario', icon: AlertTriangle, href: '/alertas-stock', permission: 'canManageInventory' as const },
  { id: 'tasas', label: 'Tasas BCV / Diferencial', icon: TrendingUp, href: '/tasas', permission: 'canManageExpenses' as const },
  { id: 'movements', label: 'Movimientos inventario', icon: PackageMinus, href: '/inventory/movements', permission: 'canManageInventory' as const },
  { id: 'autoconsumo', label: 'Autoconsumo', icon: BarChart3, href: '/autoconsumo', permission: 'canManageInventory' as const },
  { id: 'inspections', label: 'Inspección vehículo', icon: Car, href: '/inspections', permission: 'canManageInventory' as const },
  { id: 'settings', label: 'Configuración', icon: Settings, href: '/settings', permission: 'canManageTeam' as const },
];

export default function BottomNav() {
  const router = useRouter();
  const pathname = usePathname();
  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const permissions = usePermission();
  const {
    user,
    selectedCompanyId,
    selectedOrganizationId,
    selectCompany,
    selectOrganization,
    setSuperAdminOrganizations,
    getOrganizations,
    getCurrentOrganization,
    clearAuth,
  } = useAuthStore();

  // Super Admin: cargar todas las organizaciones (la auto-selección y reload la hace el Sidebar para evitar doble recarga)
  useEffect(() => {
    if (!user?.isSuperAdmin) return;
    apiClient
      .get<{ id: number; name: string; slug: string; plan: string; currencyCode?: string; currencySymbol?: string; exchangeRate?: number; rateUpdatedAt?: string | null }[]>('/tenants/organizations-all')
      .then((res) => {
        const orgs = (res.data || []).map((o) => ({
          id: o.id,
          name: o.name,
          slug: o.slug,
          plan: o.plan ?? 'FREE',
          role: 'SUPER_ADMIN',
          currencyCode: o.currencyCode ?? 'USD',
          currencySymbol: o.currencySymbol ?? '$',
          exchangeRate: o.exchangeRate ?? 1,
          rateUpdatedAt: o.rateUpdatedAt ?? null,
        }));
        setSuperAdminOrganizations(orgs);
      })
      .catch(() => {});
  }, [user?.isSuperAdmin, setSuperAdminOrganizations]);

  const organizations = getOrganizations();
  const currentOrg = getCurrentOrganization();
  const hasMultipleOrganizations = organizations.length > 1 || (user?.isSuperAdmin === true && organizations.length >= 1);
  const selectedId = selectedOrganizationId || selectedCompanyId;

  const handleOrganizationChange = async (organizationId: number) => {
    if (user?.isSuperAdmin || (user?.organizations && user.organizations.length > 0)) {
      try {
        const data = await authService.switchOrganization(organizationId);
        if (data?.access_token) {
          // Actualizar el JWT con el tenant correcto y reflejar selección en el store
          useAuthStore.getState().setToken(data.access_token);
          selectOrganization(data.organizationId ?? organizationId);
        } else {
          selectOrganization(organizationId);
        }
      } catch {
        // Si falla el switch en backend, al menos actualizar selección local
        selectOrganization(organizationId);
      }
    } else {
      selectCompany(organizationId);
    }

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new Event('organization-changed'));
      window.location.href = '/';
    }
  };

  const getActiveItem = () => {
    if (pathname === '/') return 'dashboard';
    if (pathname.startsWith('/pos')) return 'pos';
    if (pathname.startsWith('/products')) return 'products';
    if (pathname.startsWith('/inventory/movements')) return 'movements';
    if (pathname.startsWith('/autoconsumo')) return 'autoconsumo';
    if (pathname.startsWith('/inventory')) return 'products';
    return 'dashboard';
  };

  const activeItem = getActiveItem();

  const currentOrgName = (currentOrg as { name?: string } | null)?.name ?? '';
  const role = String(permissions.role || '').toUpperCase();
  const canSeeInspections =
    !!user?.isSuperAdmin ||
    currentOrgName.toLowerCase().includes('davean');

  const visibleMainNav = navigationItems.filter((item) =>
    canShowNavItem(item, permissions, { canSeeInspections }),
  );
  const filteredAdditionalItems = additionalMenuItems.filter((item) =>
    canShowNavItem(item, permissions, { canSeeInspections }),
  );

  const handleMenuItemClick = (href: string) => {
    router.push(href);
    setIsSheetOpen(false);
  };

  const handleLogout = () => {
    setIsSheetOpen(false);
    clearAuth();
    router.push('/login');
  };

  return (
    <nav className="fixed bottom-0 left-0 right-0 lg:hidden bg-card border-t border-border z-50">
      <div className="flex items-center justify-around h-20 px-2">
        {visibleMainNav.map((item) => (
            <Button
            key={item.id}
            variant="ghost"
            size="icon"
            className={cn(
              'min-h-[44px] min-w-[44px] h-12 w-12 rounded-lg',
              activeItem === item.id
                ? 'bg-sidebar-primary text-sidebar-primary-foreground hover:bg-sidebar-primary'
                : 'text-muted-foreground hover:text-foreground hover:bg-secondary'
            )}
            onClick={() => router.push(item.href)}
            title={item.label}
          >
            <item.icon className="h-5 w-5" />
          </Button>
        ))}
        <Sheet open={isSheetOpen} onOpenChange={setIsSheetOpen}>
          <SheetTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className={cn(
                'min-h-[44px] min-w-[44px] h-12 w-12 rounded-lg',
                isSheetOpen
                  ? 'bg-sidebar-primary text-sidebar-primary-foreground hover:bg-sidebar-primary'
                  : 'text-muted-foreground hover:text-foreground hover:bg-secondary'
              )}
            >
              <MoreVertical className="h-5 w-5" />
            </Button>
          </SheetTrigger>
          <SheetContent side="bottom" className="h-auto max-h-[80vh] pb-20 overflow-y-auto">
            <SheetHeader>
              <SheetTitle>Menú</SheetTitle>
            </SheetHeader>

            {/* Selector de Organización (Mobile) - Touch-friendly min 44px */}
            <div className="mt-4">
              <p className="text-xs font-medium text-muted-foreground mb-2">
                Organización activa
              </p>

              {hasMultipleOrganizations ? (
                <Select
                  value={selectedId ? selectedId.toString() : undefined}
                  onValueChange={(value) => {
                    const id = Number(value);
                    if (!Number.isNaN(id)) {
                      handleOrganizationChange(id);
                    }
                  }}
                >
                  <SelectTrigger className="w-full md:w-auto min-h-[44px] py-3 text-base touch-manipulation">
                    <SelectValue
                      placeholder={currentOrg?.name || 'Seleccionar organización'}
                    />
                  </SelectTrigger>
                  <SelectContent
                    side="bottom"
                    collisionPadding={10}
                    className="max-w-[calc(100vw-20px)]"
                  >
                    {organizations.map((org) => (
                      <SelectItem
                        key={org.id}
                        value={org.id.toString()}
                        className="min-h-[44px] py-3 text-base touch-manipulation"
                      >
                        {org.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <div className="w-full rounded-md border border-border bg-secondary/30 px-3 py-3 text-sm min-h-[44px] flex items-center">
                  {currentOrg?.name || 'Mi Organización'}
                </div>
              )}
            </div>

            <div className="mt-6 space-y-2">
              <ThemeToggle variant="full" className="mb-2" />
              {filteredAdditionalItems.map((item) => {
                const isActive = pathname.startsWith(item.href);
                return (
                  <Button
                    key={item.id}
                    variant="ghost"
                    className={cn(
                      'w-full justify-start gap-3 h-12',
                      isActive
                        ? 'bg-sidebar-primary text-sidebar-primary-foreground hover:bg-sidebar-primary'
                        : 'text-foreground hover:bg-secondary'
                    )}
                    onClick={() => handleMenuItemClick(item.href)}
                  >
                    <item.icon className="h-5 w-5" />
                    <span className="text-base">{item.label}</span>
                  </Button>
                );
              })}
              <Button
                variant="ghost"
                className="w-full justify-start gap-3 h-12 mt-4 pt-4 border-t border-border text-destructive hover:text-destructive hover:bg-destructive/10"
                onClick={handleLogout}
              >
                <LogOut className="h-5 w-5" />
                <span className="text-base">Cerrar Sesión</span>
              </Button>
            </div>
          </SheetContent>
        </Sheet>
      </div>
    </nav>
  );
}
