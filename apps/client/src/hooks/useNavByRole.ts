import type { usePermission } from '@/hooks/usePermission';

export type PermissionKey = keyof ReturnType<typeof usePermission>;

export interface NavItem {
  id: string;
  label: string;
  href: string;
  permission?: PermissionKey;
  icon?: unknown;
}

/**
 * Determina si un ítem del menú debe mostrarse según permisos y reglas especiales (ej. Inspección solo Davean).
 * Centraliza la lógica para Sidebar y BottomNav: solo se muestran módulos a los que el usuario tiene acceso.
 */
export function canShowNavItem(
  item: NavItem,
  permissions: ReturnType<typeof usePermission>,
  options?: { canSeeInspections?: boolean },
): boolean {
  if (item.id === 'inspections') {
    return options?.canSeeInspections === true;
  }
  if (item.permission) {
    const value = permissions[item.permission];
    const hasPermission = value === true;
    const role = String(permissions.role || '').toUpperCase();
    if (item.id === 'settings') {
      return hasPermission || role === 'ADMIN' || role === 'SUPER_ADMIN';
    }
    return hasPermission;
  }
  return false;
}
