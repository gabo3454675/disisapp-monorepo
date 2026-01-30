'use client';

import { useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { Grid2x2, ShoppingCart, Box, MoreVertical, Users, FileText, DollarSign, Settings } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import { cn } from '@/lib/utils';
import { usePermission } from '@/hooks/usePermission';

const navigationItems = [
  { id: 'dashboard', label: 'Dashboard', icon: Grid2x2, href: '/' },
  { id: 'pos', label: 'POS', icon: ShoppingCart, href: '/pos' },
  { id: 'products', label: 'Inventario', icon: Box, href: '/products' },
];

// Enlaces adicionales que aparecen en el menú "Más"
const additionalMenuItems = [
  { id: 'customers', label: 'Clientes', icon: Users, href: '/customers', permission: 'canManageCustomers' },
  { id: 'invoices', label: 'Facturas', icon: FileText, href: '/invoices', permission: 'canManageCustomers' },
  { id: 'expenses', label: 'Gastos', icon: DollarSign, href: '/expenses', permission: 'canManageExpenses' },
  { id: 'settings', label: 'Configuración', icon: Settings, href: '/settings/team', permission: 'canManageTeam' },
];

export default function BottomNav() {
  const router = useRouter();
  const pathname = usePathname();
  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const permissions = usePermission();

  const getActiveItem = () => {
    if (pathname === '/') return 'dashboard';
    if (pathname.startsWith('/pos')) return 'pos';
    if (pathname.startsWith('/products') || pathname.startsWith('/inventory')) return 'products';
    return 'dashboard';
  };

  const activeItem = getActiveItem();

  // Filtrar items adicionales basados en permisos
  const filteredAdditionalItems = additionalMenuItems.filter((item) => {
    if (item.permission) {
      const permissionKey = item.permission as keyof typeof permissions;
      return permissions[permissionKey] === true;
    }
    return true;
  });

  const handleMenuItemClick = (href: string) => {
    router.push(href);
    setIsSheetOpen(false);
  };

  return (
    <nav className="fixed bottom-0 left-0 right-0 lg:hidden bg-card border-t border-border z-50">
      <div className="flex items-center justify-around h-20 px-2">
        {navigationItems.map((item) => (
          <Button
            key={item.id}
            variant="ghost"
            size="icon"
            className={cn(
              'h-10 w-10 rounded-lg',
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
                'h-10 w-10 rounded-lg',
                isSheetOpen
                  ? 'bg-sidebar-primary text-sidebar-primary-foreground hover:bg-sidebar-primary'
                  : 'text-muted-foreground hover:text-foreground hover:bg-secondary'
              )}
            >
              <MoreVertical className="h-5 w-5" />
            </Button>
          </SheetTrigger>
          <SheetContent side="bottom" className="h-auto max-h-[80vh] pb-20">
            <SheetHeader>
              <SheetTitle>Menú</SheetTitle>
            </SheetHeader>
            <div className="mt-6 space-y-2">
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
            </div>
          </SheetContent>
        </Sheet>
      </div>
    </nav>
  );
}
