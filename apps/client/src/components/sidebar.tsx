'use client';

import { useState, useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { ChevronLeft, Grid2x2, ShoppingCart, Box, ChevronDown, LogOut, Check, DollarSign, FileText, Users, Settings, Download, CreditCard } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import { useAuthStore } from '@/store/useAuthStore';
import { apiClient } from '@/lib/api';
import { usePermission } from '@/hooks/usePermission';
import { usePWAInstall } from '@/hooks/usePWAInstall';
import { useExchangeRate } from '@/hooks/useExchangeRate';
import { ThemeToggle } from '@/components/theme-toggle';

const navigationItems = [
  { id: 'dashboard', label: 'Dashboard', icon: Grid2x2, href: '/', permission: 'canViewDashboard' },
  { id: 'pos', label: 'POS', icon: ShoppingCart, href: '/pos', permission: 'canManageCustomers' },
  { id: 'products', label: 'Inventario', icon: Box, href: '/products', permission: 'canManageProducts' },
  { id: 'customers', label: 'Clientes', icon: Users, href: '/customers', permission: 'canManageCustomers' },
  { id: 'invoices', label: 'Facturas', icon: FileText, href: '/invoices', permission: 'canManageCustomers' },
  { id: 'credits', label: 'Cuentas por Cobrar', icon: CreditCard, href: '/credits', permission: 'canManageCustomers' },
  { id: 'expenses', label: 'Gastos', icon: DollarSign, href: '/expenses', permission: 'canManageExpenses' },
  { id: 'settings', label: 'Configuración', icon: Settings, href: '/settings', permission: 'canManageTeam' },
];

export default function Sidebar() {
  const router = useRouter();
  const pathname = usePathname();
  const [isCollapsed, setIsCollapsed] = useState(false);
  const { 
    user, 
    clearAuth, 
    selectedCompanyId, 
    selectedOrganizationId,
    selectCompany,
    selectOrganization,
    setSuperAdminOrganizations,
    getCurrentOrganization,
    getOrganizations,
  } = useAuthStore();

  // Super Admin: cargar todas las organizaciones y, si no hay org seleccionada, elegir la primera y recargar
  useEffect(() => {
    if (!user?.isSuperAdmin) return;
    apiClient
      .get<{ id: number; name: string; slug: string; plan: string; currencyCode?: string; currencySymbol?: string; exchangeRate?: number; rateUpdatedAt?: string | null }[]>('/tenants/organizations-all')
      .then((res) => {
        const orgs = (res.data || []).map((o) => ({
          id: o.id,
          name: o.name,
          slug: o.slug,
          plan: o.plan,
          role: 'SUPER_ADMIN',
          currencyCode: o.currencyCode ?? 'USD',
          currencySymbol: o.currencySymbol ?? '$',
          exchangeRate: o.exchangeRate ?? 1,
          rateUpdatedAt: o.rateUpdatedAt ?? null,
        }));
        setSuperAdminOrganizations(orgs);
        const currentId = useAuthStore.getState().selectedOrganizationId || useAuthStore.getState().selectedCompanyId;
        if (orgs.length > 0 && !currentId) {
          useAuthStore.getState().selectOrganization(orgs[0].id);
          window.location.href = '/';
        }
      })
      .catch(() => {});
  }, [user?.isSuperAdmin, setSuperAdminOrganizations]);
  
  // Obtener permisos del usuario actual
  const permissions = usePermission();
  const { isInstallable, install } = usePWAInstall();
  
  // Determinar el item activo basado en la ruta actual
  const getActiveItem = () => {
    if (pathname === '/') return 'dashboard';
    if (pathname.startsWith('/pos')) return 'pos';
    if (pathname.startsWith('/products') || pathname.startsWith('/inventory')) return 'products';
    if (pathname.startsWith('/customers')) return 'customers';
    if (pathname.startsWith('/invoices')) return 'invoices';
    if (pathname.startsWith('/credits')) return 'credits';
    if (pathname.startsWith('/expenses')) return 'expenses';
    if (pathname.startsWith('/settings')) return 'settings';
    return 'dashboard';
  };

  const activeItem = getActiveItem();

  const handleNavigation = (href: string) => {
    router.push(href);
  };

  const handleLogout = () => {
    clearAuth();
    router.push('/login');
  };

  // Cambio de organización: persistir en store/localStorage y recarga total para que todo (dashboard, facturas, etc.) sea de la nueva org
  const handleOrganizationChange = (organizationId: number) => {
    if (user?.isSuperAdmin || (user?.organizations && user.organizations.length > 0)) {
      selectOrganization(organizationId);
    } else {
      selectCompany(organizationId);
    }
    if (typeof window !== 'undefined') {
      window.location.href = '/';
    }
  };

  // Obtener iniciales del usuario
  const getUserInitials = () => {
    if (user?.fullName) {
      return user.fullName
        .split(' ')
        .map((n) => n[0])
        .join('')
        .toUpperCase()
        .slice(0, 2);
    }
    return user?.email?.slice(0, 2).toUpperCase() || 'U';
  };

  // Obtener organización/empresa actual y tasa global (reactiva al guardar en Configuración)
  const currentOrg = getCurrentOrganization();
  const organizations = getOrganizations();
  const hasMultipleOrganizations = organizations.length > 1 || (user?.isSuperAdmin === true && organizations.length >= 1);
  const displayRate = useExchangeRate();

  const organizationName = currentOrg?.name || 'Mi Organización';
  const organizationInitials = organizationName
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  // ID seleccionado (priorizar organizationId)
  const selectedId = selectedOrganizationId || selectedCompanyId;

  return (
    <aside
      className={cn(
        'hidden lg:flex flex-col border-r border-sidebar-border bg-sidebar transition-all duration-300 h-screen sticky top-0 overflow-hidden',
        isCollapsed ? 'w-20' : 'w-64'
      )}
    >
      {/* Header */}
      <div className={cn('flex items-center border-b border-sidebar-border gap-2', isCollapsed ? 'justify-center h-16 px-2' : 'justify-between h-16 px-4')}>
        {!isCollapsed ? (
          <div className="flex flex-col min-w-0 flex-1 gap-0.5">
            <div className="flex items-center gap-2">
              <img
                src="/logo.png"
                alt="Logo"
                className="h-9 w-9 flex-shrink-0 rounded-md object-contain"
                onError={(e) => {
                  (e.target as HTMLImageElement).style.display = 'none';
                }}
              />
              <h1 className="text-xl font-bold text-sidebar-foreground truncate">Facturación</h1>
            </div>
            {displayRate !== 1 && (
              <span className="text-xs text-muted-foreground font-medium tabular-nums">
                Tasa: {displayRate.toFixed(2)}
              </span>
            )}
          </div>
        ) : (
          <img
            src="/logo.png"
            alt="Logo"
            className="h-9 w-9 flex-shrink-0 rounded-md object-contain"
            onError={(e) => {
              (e.target as HTMLImageElement).style.display = 'none';
            }}
          />
        )}
        <div className="flex items-center gap-1 flex-shrink-0">
          {!isCollapsed && isInstallable && (
            <Button
              variant="outline"
              size="sm"
              className="text-xs h-8 gap-1.5 border-sidebar-border text-sidebar-foreground hover:bg-sidebar-accent"
              onClick={() => install()}
            >
              <Download className="h-3.5 w-3.5" />
              Instalar App
            </Button>
          )}
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setIsCollapsed(!isCollapsed)}
            className="text-sidebar-foreground hover:bg-sidebar-accent"
          >
            <ChevronLeft
              className={cn('h-5 w-5 transition-transform', isCollapsed && 'rotate-180')}
            />
          </Button>
        </div>
      </div>

      {/* Organization Switcher - Solo mostrar si hay múltiples organizaciones */}
      {!isCollapsed && (
        <div className="p-4 border-b border-sidebar-border">
          {hasMultipleOrganizations ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="outline"
                  className="w-full justify-between text-sidebar-foreground border-sidebar-border hover:bg-sidebar-accent min-h-[44px] py-3"
                >
                  <span className="text-sm truncate">{organizationName}</span>
                  <ChevronDown className="h-4 w-4 flex-shrink-0" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                align="start"
                side="bottom"
                collisionPadding={10}
                className="w-[--radix-dropdown-menu-trigger-width] max-w-[calc(100vw-20px)]"
              >
                <DropdownMenuLabel>Seleccionar Organización</DropdownMenuLabel>
                <DropdownMenuSeparator />
                {organizations.map((org) => (
                  <DropdownMenuItem
                    key={org.id}
                    onClick={() => handleOrganizationChange(org.id)}
                    className="cursor-pointer min-h-[44px] py-3"
                  >
                    <div className="flex items-center justify-between w-full">
                      <div className="flex flex-col">
                        <span className="font-medium">{org.name}</span>
                        {org.role && (
                          <span className="text-xs text-muted-foreground">
                            {org.role}
                          </span>
                        )}
                      </div>
                      {selectedId === org.id && (
                        <Check className="h-4 w-4 text-primary flex-shrink-0" />
                      )}
                    </div>
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            // Si solo tiene una organización, mostrar como div estático (no clickeable)
            <div className="w-full px-3 py-2 rounded-lg bg-sidebar-accent/50 border border-sidebar-border">
              <div className="flex items-center gap-2">
                <div className="h-8 w-8 rounded-lg bg-sidebar-primary/10 flex items-center justify-center text-xs font-semibold text-sidebar-foreground">
                  {organizationInitials}
                </div>
                <div className="flex flex-col min-w-0 flex-1">
                  <span className="text-sm font-medium text-sidebar-foreground truncate">
                    {organizationName}
                  </span>
                  {currentOrg?.role && (
                    <span className="text-xs text-muted-foreground">
                      {currentOrg.role}
                    </span>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      )}
      {isCollapsed && (
        <div className="p-2 border-b border-sidebar-border flex justify-center">
          {hasMultipleOrganizations ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="h-8 w-8 rounded-lg bg-sidebar-primary/10 flex items-center justify-center text-xs font-semibold text-sidebar-foreground hover:bg-sidebar-accent transition-colors">
                  {organizationInitials}
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                align="start"
                side="bottom"
                collisionPadding={10}
                className="w-[--radix-dropdown-menu-trigger-width] max-w-[calc(100vw-20px)]"
              >
                <DropdownMenuLabel>Seleccionar Organización</DropdownMenuLabel>
                <DropdownMenuSeparator />
                {organizations.map((org) => (
                  <DropdownMenuItem
                    key={org.id}
                    onClick={() => handleOrganizationChange(org.id)}
                    className="cursor-pointer min-h-[44px] py-3"
                  >
                    <div className="flex items-center justify-between w-full">
                      <div className="flex flex-col">
                        <span className="font-medium">{org.name}</span>
                        {org.role && (
                          <span className="text-xs text-muted-foreground">
                            {org.role}
                          </span>
                        )}
                      </div>
                      {selectedId === org.id && (
                        <Check className="h-4 w-4 text-primary flex-shrink-0" />
                      )}
                    </div>
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            // Si solo tiene una organización, mostrar como div estático
            <div className="h-8 w-8 rounded-lg bg-sidebar-primary/10 flex items-center justify-center text-xs font-semibold text-sidebar-foreground">
              {organizationInitials}
            </div>
          )}
        </div>
      )}

      {/* Navigation - Scrollable */}
      <nav className="flex-1 p-4 space-y-2 overflow-y-auto overflow-x-hidden min-h-0">
        {navigationItems
          .filter((item) => {
            if (item.permission) {
              const permissionKey = item.permission as keyof typeof permissions;
              const permissionValue = permissions[permissionKey];
              const hasPermission = permissionValue === true;
              // ADMIN y SUPER_ADMIN deben ver Configuración (Invitar Miembro, Tasa BCV)
              const role = String(permissions.role || '').toUpperCase();
              if (item.id === 'settings') {
                return hasPermission || role === 'ADMIN' || role === 'SUPER_ADMIN';
              }
              return hasPermission;
            }
            return true;
          })
          .map((item) => (
            <Button
              key={item.id}
              variant={activeItem === item.id ? 'default' : 'ghost'}
              className={cn(
                'w-full justify-start gap-3',
                activeItem === item.id
                  ? 'bg-sidebar-primary text-sidebar-primary-foreground hover:bg-sidebar-primary'
                  : 'text-sidebar-foreground hover:bg-sidebar-accent',
                isCollapsed && 'justify-center p-0 h-10 w-10'
              )}
              onClick={() => handleNavigation(item.href)}
            >
              <item.icon className="h-5 w-5 flex-shrink-0" />
              {!isCollapsed && <span>{item.label}</span>}
            </Button>
          ))}
      </nav>

      {/* User Section - Fixed at bottom */}
      <div className={cn('p-4 border-t border-sidebar-border flex-shrink-0', isCollapsed && 'px-2')}>
        {!isCollapsed ? (
          <div className="flex flex-col gap-3">
            <div className="flex items-center gap-3">
              <Avatar className="h-10 w-10 flex-shrink-0">
                <AvatarFallback className="bg-gradient-to-br from-blue-500 to-emerald-500 text-white font-semibold">
                  {getUserInitials()}
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-sidebar-foreground truncate">
                  {user?.fullName || 'Usuario'}
                </p>
                <p className="text-xs text-muted-foreground truncate">{user?.email}</p>
              </div>
            </div>
            <div className="flex items-center justify-between gap-2 py-1">
              <span className="text-xs text-sidebar-foreground/80">Modo oscuro</span>
              <ThemeToggle variant="compact" className="shrink-0" />
            </div>
            <Button
              variant="ghost"
              className="w-full justify-start gap-2 text-sidebar-foreground hover:bg-sidebar-accent text-sm h-8"
              onClick={handleLogout}
            >
              <LogOut className="h-4 w-4" />
              Cerrar Sesión
            </Button>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-2">
            <Button
              variant="ghost"
              className="w-full justify-center p-0 h-10 w-10 flex-shrink-0"
              title={`${user?.fullName || 'Usuario'} - ${user?.email}`}
            >
              <Avatar className="h-8 w-8">
                <AvatarFallback className="bg-gradient-to-br from-blue-500 to-emerald-500 text-white text-xs font-semibold">
                  {getUserInitials()}
                </AvatarFallback>
              </Avatar>
            </Button>
            <ThemeToggle variant="compact" />
          </div>
        )}
      </div>
    </aside>
  );
}
