'use client';

import { useRouter, usePathname } from 'next/navigation';
import { Grid2x2, ShoppingCart, Box, MoreVertical } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

const navigationItems = [
  { id: 'dashboard', label: 'Dashboard', icon: Grid2x2, href: '/' },
  { id: 'pos', label: 'POS', icon: ShoppingCart, href: '/pos' },
  { id: 'products', label: 'Inventario', icon: Box, href: '/inventory' },
];

export default function BottomNav() {
  const router = useRouter();
  const pathname = usePathname();

  const getActiveItem = () => {
    if (pathname === '/') return 'dashboard';
    if (pathname.startsWith('/pos')) return 'pos';
    if (pathname.startsWith('/inventory')) return 'products';
    return 'dashboard';
  };

  const activeItem = getActiveItem();

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
        <Button
          variant="ghost"
          size="icon"
          className="h-10 w-10 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary"
        >
          <MoreVertical className="h-5 w-5" />
        </Button>
      </div>
    </nav>
  );
}
